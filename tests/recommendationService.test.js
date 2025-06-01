const recommendationService = require('../services/recommendationService');
const database = require('../services/database');

// モック
jest.mock('../services/database');
jest.mock('../services/steamApi');
jest.mock('../services/rawgApi');
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('RecommendationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    database.init.mockResolvedValue();
    database.createOrUpdateUser.mockResolvedValue();
    database.addGameHistory.mockResolvedValue();
    database.saveGameFeatures.mockResolvedValue();
    database.updateGenrePreference.mockResolvedValue();
    database.addGameRating.mockResolvedValue();
  });

  describe('recordUserAction', () => {
    const mockGameData = {
      appId: 123,
      name: 'Test Game',
      genres: ['Action', 'Adventure'],
      tags: ['Singleplayer'],
      rating: 4.5,
      releaseDate: '2023-01-01',
    };

    test('should record user action with rating', async () => {
      await recommendationService.recordUserAction(
        'user123',
        'testuser',
        mockGameData,
        'rated',
        5,
      );

      expect(database.createOrUpdateUser).toHaveBeenCalledWith('user123', 'testuser');
      expect(database.addGameHistory).toHaveBeenCalledWith(
        'user123',
        123,
        'Test Game',
        'rated',
      );
      expect(database.addGameRating).toHaveBeenCalledWith(
        'user123',
        123,
        'Test Game',
        5,
      );
      expect(database.updateGenrePreference).toHaveBeenCalledWith(
        'user123',
        'Action',
        0.6, // (5 - 3) * 0.3
      );
      expect(database.updateGenrePreference).toHaveBeenCalledWith(
        'user123',
        'Adventure',
        0.6,
      );
    });

    test('should record user action without rating', async () => {
      await recommendationService.recordUserAction(
        'user123',
        'testuser',
        mockGameData,
        'viewed',
      );

      expect(database.createOrUpdateUser).toHaveBeenCalledWith('user123', 'testuser');
      expect(database.addGameHistory).toHaveBeenCalledWith(
        'user123',
        123,
        'Test Game',
        'viewed',
      );
      expect(database.addGameRating).not.toHaveBeenCalled();
    });

    test('should update genre preferences for recommended games', async () => {
      await recommendationService.recordUserAction(
        'user123',
        'testuser',
        mockGameData,
        'recommended',
      );

      expect(database.updateGenrePreference).toHaveBeenCalledWith(
        'user123',
        'Action',
        0.1,
      );
      expect(database.updateGenrePreference).toHaveBeenCalledWith(
        'user123',
        'Adventure',
        0.1,
      );
    });
  });

  describe('getUserPreferences', () => {
    test('should return user preferences', async () => {
      const mockGenrePrefs = [
        { genre: 'Action', score: 4.5 },
        { genre: 'Adventure', score: 3.8 },
      ];
      const mockRatings = [
        { game_id: 123, game_name: 'Test Game', rating: 5 },
      ];
      const mockHistory = [
        { action: 'viewed' },
        { action: 'recommended' },
        { action: 'viewed' },
      ];

      database.getUserGenrePreferences.mockResolvedValue(mockGenrePrefs);
      database.getUserGameRatings.mockResolvedValue(mockRatings);
      database.getUserHistory.mockResolvedValue(mockHistory);

      const result = await recommendationService.getUserPreferences('user123');

      expect(result).toEqual({
        favoriteGenres: mockGenrePrefs.slice(0, 5),
        recentRatings: mockRatings,
        gamesViewed: 2,
        gamesRecommended: 1,
      });
    });
  });

  describe('getGenreBasedRecommendation', () => {
    test('should update genre preference and get recommendation', async () => {
      const mockGameResults = {
        results: [
          {
            id: 456,
            name: 'Genre Game',
            genres: [{ name: 'Action' }],
          },
        ],
      };

      const mockHistory = [];

      // モックセットアップ
      jest.doMock('../services/rawgApi', () => ({
        searchGames: jest.fn().mockResolvedValue(mockGameResults),
      }));

      database.getUserHistory.mockResolvedValue(mockHistory);

      // formatRAWGGameメソッドをモック
      recommendationService.formatRAWGGame = jest.fn().mockResolvedValue({
        id: 456,
        name: 'Genre Game',
        genres: ['Action'],
      });

      const result = await recommendationService.getGenreBasedRecommendation(
        'user123',
        'action',
      );

      expect(database.updateGenrePreference).toHaveBeenCalledWith(
        'user123',
        'action',
        0.2,
      );
      expect(result).toBeTruthy();
    });
  });
});