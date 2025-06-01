const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const { STEAM_API_BASE_URL, CACHE_DURATION, API_TIMEOUT } = require('../config/constants');

class SteamApiService {
  constructor() {
    this.apiKey = process.env.STEAM_API_KEY;
    this.cacheDir = path.join(__dirname, '..', 'cache');
    this.appListCache = null;
    this.appListCacheTime = null;
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
      const response = await axios.get(`${STEAM_API_BASE_URL}/ISteamApps/GetAppList/v2/`, {
        timeout: API_TIMEOUT,
      });

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
    try {
      const response = await axios.get('https://store.steampowered.com/api/appdetails', {
        params: {
          appids: appId,
          l: language,
        },
        timeout: API_TIMEOUT,
      });

      if (response.data && response.data[appId]) {
        const data = response.data[appId];
        
        if (!data.success) {
          logger.warn('App details request unsuccessful', { appId });
          return null;
        }

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
      app.name.toLowerCase() === normalizedSearchTerm
    );
    
    if (exactMatch) {
      return exactMatch;
    }

    const partialMatches = appList.filter(app => 
      app.name.toLowerCase().includes(normalizedSearchTerm)
    );

    if (partialMatches.length > 0) {
      partialMatches.sort((a, b) => {
        const aStartsWith = a.name.toLowerCase().startsWith(normalizedSearchTerm);
        const bStartsWith = b.name.toLowerCase().startsWith(normalizedSearchTerm);
        
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        
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

  formatGameDetails(gameData) {
    if (!gameData) return null;

    return {
      name: gameData.name,
      appId: gameData.steam_appid,
      description: gameData.short_description || gameData.detailed_description?.substring(0, 300) || 'No description available',
      genres: gameData.genres?.map(g => g.description).slice(0, 3) || [],
      price: gameData.is_free ? 'Free' : gameData.price_overview?.final_formatted || 'Price not available',
      originalPrice: gameData.price_overview?.initial_formatted,
      discount: gameData.price_overview?.discount_percent,
      releaseDate: gameData.release_date?.date || 'TBA',
      headerImage: gameData.header_image,
      storeUrl: `https://store.steampowered.com/app/${gameData.steam_appid}`,
      developers: gameData.developers || [],
      publishers: gameData.publishers || [],
      platforms: {
        windows: gameData.platforms?.windows || false,
        mac: gameData.platforms?.mac || false,
        linux: gameData.platforms?.linux || false,
      },
    };
  }
}

module.exports = new SteamApiService();