const steamApi = require('../services/steamApi');

describe('SteamApiService', () => {
  describe('formatGameDetails', () => {
    it('should format game details correctly', () => {
      const mockGameData = {
        name: 'Test Game',
        steam_appid: 12345,
        short_description: 'A test game',
        genres: [{ description: 'Action' }, { description: 'Adventure' }],
        is_free: false,
        price_overview: {
          final_formatted: '¥1,000',
          initial_formatted: '¥2,000',
          discount_percent: 50
        },
        release_date: { date: '2024-01-01' },
        header_image: 'https://example.com/image.jpg',
        developers: ['Test Developer'],
        publishers: ['Test Publisher'],
        platforms: {
          windows: true,
          mac: false,
          linux: true
        }
      };

      const formatted = steamApi.formatGameDetails(mockGameData);

      expect(formatted).toEqual({
        name: 'Test Game',
        appId: 12345,
        description: 'A test game',
        genres: ['Action', 'Adventure'],
        price: '¥1,000',
        originalPrice: '¥2,000',
        discount: 50,
        releaseDate: '2024-01-01',
        headerImage: 'https://example.com/image.jpg',
        storeUrl: 'https://store.steampowered.com/app/12345',
        developers: ['Test Developer'],
        publishers: ['Test Publisher'],
        platforms: {
          windows: true,
          mac: false,
          linux: true
        }
      });
    });

    it('should handle free games correctly', () => {
      const mockFreeGame = {
        name: 'Free Game',
        steam_appid: 99999,
        is_free: true,
        platforms: {}
      };

      const formatted = steamApi.formatGameDetails(mockFreeGame);

      expect(formatted.price).toBe('Free');
      expect(formatted.discount).toBeUndefined();
    });

    it('should handle missing data gracefully', () => {
      const minimalGame = {
        name: 'Minimal Game',
        steam_appid: 11111
      };

      const formatted = steamApi.formatGameDetails(minimalGame);

      expect(formatted.name).toBe('Minimal Game');
      expect(formatted.appId).toBe(11111);
      expect(formatted.genres).toEqual([]);
      expect(formatted.developers).toEqual([]);
    });

    it('should return null for null input', () => {
      const formatted = steamApi.formatGameDetails(null);
      expect(formatted).toBeNull();
    });
  });
});