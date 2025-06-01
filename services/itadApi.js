const axios = require('axios');
const logger = require('../utils/logger');
const { ITAD_API_BASE_URL, API_TIMEOUT } = require('../config/constants');

class ItadApiService {
  constructor() {
    this.apiKey = process.env.ITAD_API_KEY;
  }

  async getCurrentDeals(options = {}) {
    try {
      const response = await axios.get(`${ITAD_API_BASE_URL}/deals/v01/list`, {
        params: {
          key: this.apiKey,
          country: 'JP',
          shops: 'steam',
          limit: options.limit || 20,
          offset: options.offset || 0,
          sort: options.sort || 'price:asc',
        },
        timeout: API_TIMEOUT,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to get deals from ITAD', error);
      throw new Error('IsThereAnyDeal APIからセール情報を取得できませんでした');
    }
  }

  async getGamePrices(gamePlainName) {
    try {
      const response = await axios.get(`${ITAD_API_BASE_URL}/game/prices`, {
        params: {
          key: this.apiKey,
          plains: gamePlainName,
          country: 'JP',
          shops: 'steam',
        },
        timeout: API_TIMEOUT,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to get game prices from ITAD', error, { gamePlainName });
      return null;
    }
  }

  async searchGame(gameName) {
    try {
      const response = await axios.get(`${ITAD_API_BASE_URL}/search/search`, {
        params: {
          key: this.apiKey,
          q: gameName,
          limit: 5,
        },
        timeout: API_TIMEOUT,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to search game in ITAD', error, { gameName });
      return null;
    }
  }

  async getTopDeals(minDiscount = 50) {
    try {
      const response = await axios.get(`${ITAD_API_BASE_URL}/deals/v01/list`, {
        params: {
          key: this.apiKey,
          country: 'JP',
          shops: 'steam',
          limit: 50,
          sort: 'cut:desc',
        },
        timeout: API_TIMEOUT,
      });

      if (response.data && response.data.list) {
        return response.data.list.filter(deal => deal.price_cut >= minDiscount);
      }

      return [];
    } catch (error) {
      logger.error('Failed to get top deals from ITAD', error);
      return [];
    }
  }

  async getGamesByPriceRange(maxPrice, isFree = false) {
    try {
      const params = {
        key: this.apiKey,
        country: 'JP',
        shops: 'steam',
        limit: 30,
        sort: 'price:asc',
      };

      if (isFree) {
        params.price_max = 0;
      } else if (maxPrice !== undefined) {
        params.price_max = maxPrice;
      }

      const response = await axios.get(`${ITAD_API_BASE_URL}/deals/v01/list`, {
        params,
        timeout: API_TIMEOUT,
      });

      return response.data.list || [];
    } catch (error) {
      logger.error('Failed to get games by price range from ITAD', error);
      return [];
    }
  }

  formatDealForEmbed(deal) {
    if (!deal) return null;

    const originalPrice = deal.price_old || deal.price_new;
    const currentPrice = deal.price_new;
    const discount = deal.price_cut || 0;

    return {
      title: deal.title,
      plainName: deal.plain,
      currentPrice: `¥${Math.round(currentPrice)}`,
      originalPrice: discount > 0 ? `¥${Math.round(originalPrice)}` : null,
      discount: discount > 0 ? `${discount}%` : null,
      shopName: deal.shop?.name || 'Steam',
      dealUrl: deal.urls?.buy || deal.urls?.game,
    };
  }

  async convertToPlainName(gameName) {
    try {
      const searchResult = await this.searchGame(gameName);
      if (searchResult && searchResult.results && searchResult.results.length > 0) {
        return searchResult.results[0].plain;
      }
      return null;
    } catch (error) {
      logger.error('Failed to convert game name to plain name', error, { gameName });
      return null;
    }
  }
}

module.exports = new ItadApiService();