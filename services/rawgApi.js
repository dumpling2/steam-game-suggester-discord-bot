const axios = require('axios');
const logger = require('../utils/logger');
const { RAWG_API_BASE_URL, API_TIMEOUT } = require('../config/constants');

class RawgApiService {
  constructor() {
    this.apiKey = process.env.RAWG_API_KEY;
  }

  async searchGames(params = {}) {
    try {
      const response = await axios.get(`${RAWG_API_BASE_URL}/games`, {
        params: {
          key: this.apiKey,
          page_size: params.pageSize || 20,
          page: params.page || 1,
          search: params.search,
          genres: params.genres,
          tags: params.tags,
          ordering: params.ordering,
          metacritic: params.metacritic,
          ...params
        },
        timeout: API_TIMEOUT,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to search games from RAWG', error);
      throw new Error('RAWG APIからゲーム情報を取得できませんでした');
    }
  }

  async getGameDetails(gameId) {
    try {
      const response = await axios.get(`${RAWG_API_BASE_URL}/games/${gameId}`, {
        params: {
          key: this.apiKey,
        },
        timeout: API_TIMEOUT,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to get game details from RAWG', error, { gameId });
      return null;
    }
  }

  async getGenres() {
    try {
      const response = await axios.get(`${RAWG_API_BASE_URL}/genres`, {
        params: {
          key: this.apiKey,
        },
        timeout: API_TIMEOUT,
      });

      return response.data.results;
    } catch (error) {
      logger.error('Failed to get genres from RAWG', error);
      return [];
    }
  }

  async getRandomGameByGenre(genreSlug) {
    try {
      const totalGames = await this.searchGames({
        genres: genreSlug,
        page_size: 1,
      });

      if (!totalGames.count) {
        return null;
      }

      const randomPage = Math.floor(Math.random() * Math.min(500, totalGames.count)) + 1;
      
      const response = await this.searchGames({
        genres: genreSlug,
        page_size: 1,
        page: randomPage,
        ordering: '-rating',
      });

      return response.results[0] || null;
    } catch (error) {
      logger.error('Failed to get random game by genre', error, { genreSlug });
      return null;
    }
  }

  async getTopRatedGames(minRating = 4.0) {
    try {
      const response = await this.searchGames({
        ordering: '-rating',
        metacritic: '80,100',
        page_size: 40,
      });

      const filteredGames = response.results.filter(game => 
        game.rating >= minRating && game.ratings_count > 50
      );

      return filteredGames;
    } catch (error) {
      logger.error('Failed to get top rated games', error);
      return [];
    }
  }

  formatGameForEmbed(rawgGame) {
    if (!rawgGame) return null;

    return {
      name: rawgGame.name,
      description: rawgGame.description_raw || 'No description available',
      genres: rawgGame.genres?.map(g => g.name).slice(0, 3) || [],
      rating: rawgGame.rating ? `${rawgGame.rating}/5.0` : 'Not rated',
      metacritic: rawgGame.metacritic ? `Metacritic: ${rawgGame.metacritic}` : null,
      releaseDate: rawgGame.released || 'TBA',
      headerImage: rawgGame.background_image,
      platforms: rawgGame.platforms?.map(p => p.platform.name) || [],
      stores: rawgGame.stores?.map(s => s.store.name) || [],
      screenshots: rawgGame.short_screenshots?.slice(1, 4).map(s => s.image) || [],
    };
  }

  async searchSteamGame(gameName) {
    try {
      const response = await this.searchGames({
        search: gameName,
        stores: '1', // Steam store ID in RAWG
        page_size: 1,
      });

      if (response.results && response.results.length > 0) {
        const game = response.results[0];
        const steamStore = game.stores?.find(s => s.store.id === 1);
        
        if (steamStore && steamStore.url) {
          const steamIdMatch = steamStore.url.match(/\/app\/(\d+)/);
          if (steamIdMatch) {
            return {
              appId: steamIdMatch[1],
              rawgData: game,
            };
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to search Steam game in RAWG', error, { gameName });
      return null;
    }
  }
}

module.exports = new RawgApiService();