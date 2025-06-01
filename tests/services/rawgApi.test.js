// モック

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('RawgApiService', () => {
  let mockHttpClient;
  let rawgApi;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // createRateLimitedClientをモック
    mockHttpClient = {
      get: jest.fn(),
    };
    jest.doMock('../../utils/httpClient', () => ({
      createRateLimitedClient: jest.fn(() => mockHttpClient),
    }));
    
    // モジュールを再読み込み
    rawgApi = require('../../services/rawgApi');
  });

  describe('searchGames', () => {
    test('ゲームを検索できる', async () => {
      const mockResponse = {
        data: {
          count: 2,
          results: [
            { id: 1, name: 'Game 1' },
            { id: 2, name: 'Game 2' },
          ],
        },
      };

      mockHttpClient.get.mockResolvedValue(mockResponse);

      const result = await rawgApi.searchGames({
        search: 'test',
        pageSize: 10,
      });

      expect(result).toEqual(mockResponse.data);
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        'https://api.rawg.io/api/games',
        {
          params: expect.objectContaining({
            key: process.env.RAWG_API_KEY,
            search: 'test',
            page_size: 10,
          }),
        },
      );
    });

    test('APIエラーの場合、エラーをスローする', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('API Error'));

      await expect(rawgApi.searchGames()).rejects.toThrow(
        'RAWG APIからゲーム情報を取得できませんでした',
      );
    });
  });

  describe('getGameDetails', () => {
    test('ゲームの詳細を取得できる', async () => {
      const mockGameDetails = {
        id: 123,
        name: 'Test Game',
        description: 'A test game',
      };

      mockHttpClient.get.mockResolvedValue({ data: mockGameDetails });

      const result = await rawgApi.getGameDetails(123);

      expect(result).toEqual(mockGameDetails);
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        'https://api.rawg.io/api/games/123',
        {
          params: {
            key: process.env.RAWG_API_KEY,
          },
        },
      );
    });

    test('APIエラーの場合、nullを返す', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('API Error'));

      const result = await rawgApi.getGameDetails(123);

      expect(result).toBeNull();
    });
  });

  describe('getGenres', () => {
    test('ジャンル一覧を取得できる', async () => {
      const mockGenres = [
        { id: 1, name: 'Action', slug: 'action' },
        { id: 2, name: 'Adventure', slug: 'adventure' },
      ];

      mockHttpClient.get.mockResolvedValue({
        data: { results: mockGenres },
      });

      const result = await rawgApi.getGenres();

      expect(result).toEqual(mockGenres);
    });

    test('APIエラーの場合、空配列を返す', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('API Error'));

      const result = await rawgApi.getGenres();

      expect(result).toEqual([]);
    });
  });

  describe('getTopRatedGames', () => {
    test('高評価ゲームを取得できる', async () => {
      const mockGames = [
        { id: 1, name: 'Game 1', rating: 4.5, ratings_count: 100 },
        { id: 2, name: 'Game 2', rating: 4.2, ratings_count: 200 },
        { id: 3, name: 'Game 3', rating: 3.8, ratings_count: 150 }, // フィルタリングされる
      ];

      mockHttpClient.get.mockResolvedValue({
        data: { results: mockGames },
      });

      const result = await rawgApi.getTopRatedGames(4.0);

      expect(result).toHaveLength(2);
      expect(result[0].rating).toBeGreaterThanOrEqual(4.0);
    });

    test('APIエラーの場合、空配列を返す', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('API Error'));

      const result = await rawgApi.getTopRatedGames();

      expect(result).toEqual([]);
    });
  });

  describe('formatGameForEmbed', () => {
    test('ゲームデータを埋め込み用にフォーマットできる', () => {
      const mockGame = {
        name: 'Test Game',
        description_raw: 'Test description',
        genres: [{ name: 'Action' }, { name: 'Adventure' }],
        rating: 4.5,
        metacritic: 85,
        released: '2024-01-01',
        background_image: 'https://example.com/image.jpg',
        platforms: [
          { platform: { name: 'PC' } },
          { platform: { name: 'PlayStation 5' } },
        ],
        stores: [{ store: { name: 'Steam' } }],
        short_screenshots: [
          { image: 'https://example.com/screenshot1.jpg' },
          { image: 'https://example.com/screenshot2.jpg' },
        ],
      };

      const result = rawgApi.formatGameForEmbed(mockGame);

      expect(result).toEqual({
        name: 'Test Game',
        description: 'Test description',
        genres: ['Action', 'Adventure'],
        rating: '4.5/5.0',
        metacritic: 'Metacritic: 85',
        releaseDate: '2024-01-01',
        headerImage: 'https://example.com/image.jpg',
        platforms: ['PC', 'PlayStation 5'],
        stores: ['Steam'],
        screenshots: ['https://example.com/screenshot2.jpg'],
      });
    });

    test('nullの場合、nullを返す', () => {
      const result = rawgApi.formatGameForEmbed(null);
      expect(result).toBeNull();
    });
  });
});