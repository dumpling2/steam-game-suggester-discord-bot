const GameEmbedBuilder = require('../utils/embedBuilder');
const { EMBED_COLORS } = require('../config/constants');

describe('GameEmbedBuilder', () => {
  describe('createGameEmbed', () => {
    it('should create a game embed with all fields', () => {
      const mockGameData = {
        name: 'Test Game',
        storeUrl: 'https://store.steampowered.com/app/12345',
        headerImage: 'https://example.com/image.jpg',
        description: 'A great test game',
        genres: ['Action', 'Adventure'],
        price: '¥1,000',
        discount: 50,
        originalPrice: '¥2,000',
        releaseDate: '2024-01-01',
        developers: ['Test Dev'],
        platforms: {
          windows: true,
          mac: true,
          linux: false,
        },
      };

      const embed = GameEmbedBuilder.createGameEmbed(mockGameData);

      expect(embed.data.title).toBe('Test Game');
      expect(embed.data.url).toBe('https://store.steampowered.com/app/12345');
      expect(embed.data.color).toBe(EMBED_COLORS.INFO);
      expect(embed.data.description).toBe('A great test game');
      expect(embed.data.image.url).toBe('https://example.com/image.jpg');

      const genreField = embed.data.fields.find(f => f.name === 'ジャンル');
      expect(genreField.value).toBe('Action, Adventure');

      const priceField = embed.data.fields.find(f => f.name === '価格');
      expect(priceField.value).toContain('¥1,000');
      expect(priceField.value).toContain('50%');
    });

    it('should truncate long descriptions', () => {
      const longDescription = 'a'.repeat(350);
      const mockGameData = {
        name: 'Test Game',
        storeUrl: 'https://example.com',
        description: longDescription,
        genres: [],
        price: 'Free',
        releaseDate: 'TBA',
        developers: [],
        platforms: {},
      };

      const embed = GameEmbedBuilder.createGameEmbed(mockGameData);

      expect(embed.data.description.length).toBeLessThanOrEqual(303);
      expect(embed.data.description).toContain('...');
    });
  });

  describe('createErrorEmbed', () => {
    it('should create an error embed', () => {
      const errorMessage = 'Something went wrong';
      const embed = GameEmbedBuilder.createErrorEmbed(errorMessage);

      expect(embed.data.title).toBe('エラー');
      expect(embed.data.description).toBe(errorMessage);
      expect(embed.data.color).toBe(EMBED_COLORS.ERROR);
    });
  });

  describe('createLoadingEmbed', () => {
    it('should create a loading embed', () => {
      const embed = GameEmbedBuilder.createLoadingEmbed();

      expect(embed.data.title).toBe('読み込み中...');
      expect(embed.data.color).toBe(EMBED_COLORS.WARNING);
    });
  });

  describe('createNoResultEmbed', () => {
    it('should create a no result embed', () => {
      const searchTerm = 'NonExistentGame';
      const embed = GameEmbedBuilder.createNoResultEmbed(searchTerm);

      expect(embed.data.title).toBe('検索結果なし');
      expect(embed.data.description).toContain(searchTerm);
      expect(embed.data.color).toBe(EMBED_COLORS.WARNING);
    });
  });
});
