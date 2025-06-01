const database = require('./database');
const steamApi = require('./steamApi');
const rawgApi = require('./rawgApi');
const logger = require('../utils/logger');

class RecommendationService {
  constructor() {
    this.initialized = false;
  }

  async init() {
    if (!this.initialized) {
      await database.init();
      this.initialized = true;
    }
  }

  /**
   * ユーザーアクションを記録し、好みを学習
   */
  async recordUserAction(userId, username, gameData, action, rating = null) {
    await this.init();

    // ユーザープロファイルを作成/更新
    await database.createOrUpdateUser(userId, username);

    // アクション履歴を記録
    await database.addGameHistory(
      userId,
      gameData.appId || gameData.id,
      gameData.name,
      action,
    );

    // ゲーム情報を保存
    if (gameData.genres && gameData.genres.length > 0) {
      const releaseYear = gameData.releaseDate ?
        new Date(gameData.releaseDate).getFullYear() :
        null;

      await database.saveGameFeatures(
        gameData.appId || gameData.id,
        gameData.name,
        gameData.genres,
        gameData.tags || [],
        gameData.rating || 0,
        releaseYear,
      );
    }

    // 評価が提供された場合
    if (rating !== null) {
      await database.addGameRating(
        userId,
        gameData.appId || gameData.id,
        gameData.name,
        rating,
      );

      // ジャンルの好みを更新
      if (gameData.genres) {
        for (const genre of gameData.genres) {
          // 高評価なら好みスコアを上げる、低評価なら下げる
          const scoreChange = (rating - 3) * 0.3; // -0.6 ~ +0.6
          await database.updateGenrePreference(userId, genre, scoreChange);
        }
      }
    }

    // 推薦されたゲームの場合、ジャンルの好みをわずかに上げる
    if (action === 'recommended' && gameData.genres) {
      for (const genre of gameData.genres) {
        await database.updateGenrePreference(userId, genre, 0.1);
      }
    }

    logger.info('ユーザーアクションを記録しました', {
      userId,
      action,
      gameId: gameData.appId || gameData.id,
      rating,
    });
  }

  /**
   * パーソナライズされたゲーム推薦
   */
  async getPersonalizedRecommendation(userId) {
    await this.init();

    try {
      // データベースから推薦を取得
      const recommendations = await database.getRecommendedGames(userId, 20);

      if (recommendations.length > 0) {
        // ランダムに1つ選択
        const game = recommendations[Math.floor(Math.random() * recommendations.length)];

        // Steam APIから詳細情報を取得
        const gameDetails = await steamApi.getAppDetails(game.game_id);
        if (gameDetails) {
          return steamApi.formatGameDetails(gameDetails);
        }
      }

      // 推薦がない場合は、高評価ゲームからランダムに選択
      return await this.getHighRatedRecommendation();
    } catch (error) {
      logger.error('パーソナライズ推薦エラー:', error);
      // エラー時は通常のランダム推薦に戻る
      return await this.getRandomRecommendation();
    }
  }

  /**
   * 高評価ゲームから推薦
   */
  async getHighRatedRecommendation() {
    try {
      const topGames = await rawgApi.getTopRatedGames(4.0);

      if (topGames.length > 0) {
        // Steamで利用可能なゲームが見つかるまで試行
        let attempts = 0;
        const maxAttempts = Math.min(topGames.length, 20);

        while (attempts < maxAttempts) {
          const randomIndex = Math.floor(Math.random() * topGames.length);
          const selectedGame = topGames[randomIndex];

          // Steamで検索
          const steamInfo = await rawgApi.searchSteamGame(selectedGame.name);
          if (steamInfo && steamInfo.appId) {
            const gameDetails = await steamApi.getAppDetails(steamInfo.appId);
            if (gameDetails && gameDetails.type === 'game') {
              const formatted = steamApi.formatGameDetails(gameDetails);
              formatted.rating = selectedGame.rating;
              return formatted;
            }
          }

          attempts++;
        }
      }
    } catch (error) {
      logger.error('高評価ゲーム推薦エラー:', error);
    }

    // フォールバック - Steamゲームのランダム推薦
    return await this.getRandomRecommendation();
  }

  /**
   * ジャンルベースの推薦
   */
  async getGenreBasedRecommendation(userId, genre) {
    await this.init();

    try {
      // ジャンルの好みを記録
      await database.updateGenrePreference(userId, genre, 0.2);

      // RAWGからジャンル別のゲームを取得
      const genreGames = await rawgApi.searchGames({
        genres: genre,
        ordering: '-rating',
        page_size: 20,
      });

      if (genreGames.results && genreGames.results.length > 0) {
        // ユーザーの履歴を取得
        const history = await database.getUserHistory(userId, null, 100);
        const playedGameIds = new Set(history.map(h => h.game_id));

        // 未プレイのゲームをフィルタリング
        const unplayedGames = genreGames.results.filter(game =>
          !playedGameIds.has(game.id),
        );

        // Steamで利用可能なゲームを探す
        for (const game of unplayedGames) {
          const steamGame = await this.formatRAWGGame(game);
          // formatRAWGGameがSteamゲームを返した場合のみ使用
          if (steamGame && steamGame.appId) {
            return steamGame;
          }
        }
      }
    } catch (error) {
      logger.error('ジャンルベース推薦エラー:', error);
    }

    // フォールバック
    return await this.getRandomRecommendation();
  }

  /**
   * 類似ゲーム推薦
   */
  async getSimilarGameRecommendation(gameId) {
    await this.init();

    try {
      const similarGames = await database.getSimilarGames(gameId, 10);

      if (similarGames.length > 0) {
        const game = similarGames[Math.floor(Math.random() * Math.min(5, similarGames.length))];
        const gameDetails = await steamApi.getAppDetails(game.game_id);

        if (gameDetails) {
          return steamApi.formatGameDetails(gameDetails);
        }
      }
    } catch (error) {
      logger.error('類似ゲーム推薦エラー:', error);
    }

    return null;
  }

  /**
   * ユーザーの好みの統計を取得
   */
  async getUserPreferences(userId) {
    await this.init();

    const [genrePrefs, ratings, history] = await Promise.all([
      database.getUserGenrePreferences(userId),
      database.getUserGameRatings(userId, 20),
      database.getUserHistory(userId, null, 50),
    ]);

    return {
      favoriteGenres: genrePrefs.slice(0, 5),
      recentRatings: ratings,
      gamesViewed: history.filter(h => h.action === 'viewed').length,
      gamesRecommended: history.filter(h => h.action === 'recommended').length,
    };
  }

  /**
   * 通常のランダム推薦（フォールバック）
   */
  async getRandomRecommendation() {
    const randomApp = await steamApi.getRandomGame();
    const gameDetails = await steamApi.getAppDetails(randomApp.appid);

    if (gameDetails && gameDetails.type === 'game') {
      return steamApi.formatGameDetails(gameDetails);
    }

    // リトライ
    return null;
  }

  /**
   * RAWGゲームデータをフォーマット
   */
  async formatRAWGGame(rawgGame) {
    // Steamで検索を試みる
    const steamInfo = await rawgApi.searchSteamGame(rawgGame.name);
    if (steamInfo && steamInfo.appId) {
      const steamDetails = await steamApi.getAppDetails(steamInfo.appId);
      if (steamDetails && steamDetails.type === 'game') {
        const steamFormatted = steamApi.formatGameDetails(steamDetails);
        // RAWGのレーティングを保持
        if (rawgGame.rating) {
          steamFormatted.rating = `${rawgGame.rating}/5.0`;
        }
        return steamFormatted;
      }
    }

    // Steamデータが見つからない場合はnullを返す
    return null;
  }
}

module.exports = new RecommendationService();
