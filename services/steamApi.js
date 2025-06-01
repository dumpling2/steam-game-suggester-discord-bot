const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const { createRateLimitedClient } = require('../utils/httpClient');
const CacheManager = require('../utils/cacheManager');
const { STEAM_API_BASE_URL, CACHE_DURATION, API_TIMEOUT } = require('../config/constants');

class SteamApiService {
  constructor() {
    this.apiKey = process.env.STEAM_API_KEY;
    this.cacheDir = path.join(__dirname, '..', 'cache');
    this.appListCache = null;
    this.appListCacheTime = null;

    // キャッシュマネージャーを初期化
    this.cacheManager = new CacheManager(this.cacheDir);

    // リトライ機能付きHTTPクライアントを作成
    this.httpClient = createRateLimitedClient(
      {
        timeout: parseInt(process.env.API_TIMEOUT || API_TIMEOUT, 10),
        retries: 3,
        retryDelay: 1000,
      },
      {
        maxRequestsPerSecond: 5,
        maxRequestsPerMinute: 50,
      },
    );
  }

  async getAppList() {
    const cacheFile = path.join(this.cacheDir, 'steam_app_list.json');

    try {
      const stats = await fs.stat(cacheFile);
      const cacheAge = Date.now() - stats.mtimeMs;

      if (cacheAge < CACHE_DURATION.STEAM_APP_LIST) {
        const cachedData = await fs.readFile(cacheFile, 'utf8');
        this.appListCache = JSON.parse(cachedData);
        logger.info('Loaded Steam app list from cache');
        return this.appListCache;
      }
    } catch (error) {
      logger.debug('Cache file not found or invalid', { error: error.message });
    }

    try {
      const response = await this.httpClient.get(`${STEAM_API_BASE_URL}/ISteamApps/GetAppList/v2/`);

      if (response.data && response.data.applist && response.data.applist.apps) {
        this.appListCache = response.data.applist.apps;

        await fs.writeFile(cacheFile, JSON.stringify(this.appListCache), 'utf8');
        logger.info('Fetched and cached Steam app list', { count: this.appListCache.length });

        return this.appListCache;
      }
    } catch (error) {
      logger.error('Failed to fetch Steam app list', error);
      throw new Error('Steam APIからゲームリストを取得できませんでした');
    }
  }

  async getAppDetails(appId, language = 'japanese') {
    const cacheKey = `steam_app_${appId}_${language}`;

    // キャッシュから取得を試みる
    const cachedData = await this.cacheManager.get(cacheKey);
    if (cachedData) {
      logger.info('App details loaded from cache', { appId });
      return cachedData;
    }

    try {
      const response = await this.httpClient.get('https://store.steampowered.com/api/appdetails', {
        params: {
          appids: appId,
          l: language,
        },
      });

      if (response.data && response.data[appId]) {
        const data = response.data[appId];

        if (!data.success) {
          logger.warn('App details request unsuccessful', { appId });
          return null;
        }

        // キャッシュに保存
        await this.cacheManager.set(cacheKey, data.data, CACHE_DURATION.GAME_DETAILS);

        return data.data;
      }
    } catch (error) {
      logger.error('Failed to fetch app details', error, { appId });
      return null;
    }
  }

  async searchGameByName(gameName) {
    const appList = await this.getAppList();

    const normalizedSearchTerm = gameName.toLowerCase().trim();

    const exactMatch = appList.find(app =>
      app.name.toLowerCase() === normalizedSearchTerm,
    );

    if (exactMatch) {
      return exactMatch;
    }

    const partialMatches = appList.filter(app =>
      app.name.toLowerCase().includes(normalizedSearchTerm),
    );

    if (partialMatches.length > 0) {
      partialMatches.sort((a, b) => {
        const aStartsWith = a.name.toLowerCase().startsWith(normalizedSearchTerm);
        const bStartsWith = b.name.toLowerCase().startsWith(normalizedSearchTerm);

        if (aStartsWith && !bStartsWith) {return -1;}
        if (!aStartsWith && bStartsWith) {return 1;}

        return a.name.length - b.name.length;
      });

      return partialMatches[0];
    }

    return null;
  }

  async getRandomGame() {
    const appList = await this.getAppList();

    if (!appList || appList.length === 0) {
      throw new Error('ゲームリストが空です');
    }

    const randomIndex = Math.floor(Math.random() * appList.length);
    return appList[randomIndex];
  }

  async getMultipleRandomGames(count) {
    const appList = await this.getAppList();

    if (!appList || appList.length === 0) {
      throw new Error('ゲームリストが空です');
    }

    const games = [];
    const usedIndices = new Set();

    while (games.length < count && usedIndices.size < appList.length) {
      const randomIndex = Math.floor(Math.random() * appList.length);
      if (!usedIndices.has(randomIndex)) {
        usedIndices.add(randomIndex);
        games.push(appList[randomIndex]);
      }
    }

    return games;
  }

  async getAppDetailsMultiple(appIds) {
    const detailsPromises = appIds.map(appId => this.getAppDetails(appId));
    const results = await Promise.allSettled(detailsPromises);

    return results
      .filter(result => result.status === 'fulfilled' && result.value)
      .map(result => result.value);
  }

  async getPopularGames(options = {}) {
    const {
      count = 10,
      minReviews = 100,
      freeOnly = false,
      maxPrice = null,
      minPrice = null,
      onSale = false,
    } = options;

    logger.info('人気ゲームを検索中...', options);

    const foundGames = [];
    const batchSize = 20;
    const maxBatches = 15; // より多くのゲームをチェック

    for (let batch = 0; batch < maxBatches && foundGames.length < count; batch++) {
      // 複数のランダムゲームを取得
      const randomApps = await this.getMultipleRandomGames(batchSize);
      const appIds = randomApps.map(app => app.appid);

      // 並列で詳細情報を取得
      const gamesDetails = await this.getAppDetailsMultiple(appIds);

      // 人気度でフィルタリングとソート
      for (const gameData of gamesDetails) {
        if (!gameData || gameData.type !== 'game') {continue;}

        // レビュー数でフィルタリング
        const totalReviews = gameData.recommendations?.total || 0;
        if (totalReviews < minReviews) {continue;}

        // 価格フィルタリング
        if (freeOnly && !gameData.is_free) {continue;}
        if (maxPrice !== null && gameData.price_overview) {
          const priceInYen = gameData.price_overview.final / 100;
          if (priceInYen > maxPrice) {continue;}
          if (minPrice !== null && priceInYen < minPrice) {continue;}
        }

        // セールフィルタリング
        if (onSale && (!gameData.price_overview || gameData.price_overview.discount_percent === 0)) {continue;}

        const formattedGame = this.formatGameDetails(gameData);
        foundGames.push(formattedGame);

        if (foundGames.length >= count) {break;}
      }
    }

    // レビュー数と評価スコアでソート
    return foundGames.sort((a, b) => {
      // まずレビュー数でソート
      const reviewDiff = (b.totalReviews || 0) - (a.totalReviews || 0);
      if (reviewDiff !== 0) {return reviewDiff;}

      // 次に評価スコアでソート
      return (b.reviewScore || 0) - (a.reviewScore || 0);
    }).slice(0, count);
  }

  formatGameDetails(gameData) {
    if (!gameData) {return null;}

    // レビュー情報を計算
    let reviewScore = null;
    let reviewText = null;
    let totalReviews = 0;

    if (gameData.recommendations) {
      totalReviews = gameData.recommendations.total || 0;
      if (totalReviews > 0) {
        // Steamのレビュースコアを計算（Steamの公式計算式に基づく近似）
        const positiveRatio = gameData.recommendations.total > 0
          ? (gameData.recommendations.total - (gameData.recommendations.total * 0.3)) / gameData.recommendations.total
          : 0;
        reviewScore = Math.round(positiveRatio * 100);

        // レビュー評価テキスト
        if (reviewScore >= 95 && totalReviews >= 50) {reviewText = '圧倒的に好評';}
        else if (reviewScore >= 80) {reviewText = '非常に好評';}
        else if (reviewScore >= 70) {reviewText = '好評';}
        else if (reviewScore >= 40) {reviewText = '賛否両論';}
        else {reviewText = '不評';}
      }
    }

    return {
      name: gameData.name,
      appId: gameData.steam_appid,
      id: gameData.steam_appid,
      description: gameData.short_description || gameData.detailed_description?.substring(0, 300) || 'No description available',
      genres: gameData.genres?.map(g => g.description).slice(0, 3) || [],
      price: gameData.is_free ? 'Free' : gameData.price_overview?.final_formatted || 'Price not available',
      originalPrice: gameData.price_overview?.initial_formatted,
      discount: gameData.price_overview?.discount_percent,
      releaseDate: gameData.release_date?.date || 'TBA',
      image: gameData.header_image,
      headerImage: gameData.header_image,
      url: `https://store.steampowered.com/app/${gameData.steam_appid}`,
      storeUrl: `https://store.steampowered.com/app/${gameData.steam_appid}`,
      developers: gameData.developers || [],
      publishers: gameData.publishers || [],
      platforms: {
        windows: gameData.platforms?.windows || false,
        mac: gameData.platforms?.mac || false,
        linux: gameData.platforms?.linux || false,
      },
      platform: 'Steam',
      // 新しいフィールド
      reviewScore,
      reviewText,
      totalReviews,
      recommendations: gameData.recommendations,
    };
  }
}

module.exports = new SteamApiService();
