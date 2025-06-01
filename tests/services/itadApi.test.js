// モック

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('ItadApiService', () => {
  let mockHttpClient;
  let itadApi;

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
    itadApi = require('../../services/itadApi');
  });

  describe('getCurrentDeals', () => {
    test('現在のセール情報を取得できる', async () => {
      const mockDeals = {
        data: {
          list: [
            { title: 'Game 1', price_new: 10, price_old: 20, price_cut: 50 },
            { title: 'Game 2', price_new: 15, price_old: 30, price_cut: 50 },
          ],
        },
      };

      mockHttpClient.get.mockResolvedValue(mockDeals);

      const result = await itadApi.getCurrentDeals({ limit: 10 });

      expect(result).toEqual(mockDeals.data);
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        'https://api.isthereanydeal.com/v01/deals/v01/list',
        {
          params: expect.objectContaining({
            key: process.env.ITAD_API_KEY,
            country: 'JP',
            shops: 'steam',
            limit: 10,
          }),
        },
      );
    });

    test('APIエラーの場合、エラーをスローする', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('API Error'));

      await expect(itadApi.getCurrentDeals()).rejects.toThrow(
        'IsThereAnyDeal APIからセール情報を取得できませんでした',
      );
    });
  });

  describe('getTopDeals', () => {
    test('指定した割引率以上のセールを取得できる', async () => {
      const mockDeals = {
        data: {
          list: [
            { title: 'Game 1', price_cut: 75 },
            { title: 'Game 2', price_cut: 60 },
            { title: 'Game 3', price_cut: 40 }, // フィルタリングされる
          ],
        },
      };

      mockHttpClient.get.mockResolvedValue(mockDeals);

      const result = await itadApi.getTopDeals(50);

      expect(result).toHaveLength(2);
      expect(result[0].price_cut).toBeGreaterThanOrEqual(50);
    });

    test('APIエラーの場合、空配列を返す', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('API Error'));

      const result = await itadApi.getTopDeals();

      expect(result).toEqual([]);
    });
  });

  describe('getGamesByPriceRange', () => {
    test('価格範囲でゲームを取得できる', async () => {
      const mockDeals = {
        data: {
          list: [
            { title: 'Game 1', price_new: 5 },
            { title: 'Game 2', price_new: 10 },
          ],
        },
      };

      mockHttpClient.get.mockResolvedValue(mockDeals);

      const result = await itadApi.getGamesByPriceRange(20);

      expect(result).toEqual(mockDeals.data.list);
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        'https://api.isthereanydeal.com/v01/deals/v01/list',
        {
          params: expect.objectContaining({
            price_max: 20,
          }),
        },
      );
    });

    test('無料ゲームを取得できる', async () => {
      const mockFreeGames = {
        data: {
          list: [
            { title: 'Free Game 1', price_new: 0 },
            { title: 'Free Game 2', price_new: 0 },
          ],
        },
      };

      mockHttpClient.get.mockResolvedValue(mockFreeGames);

      const result = await itadApi.getGamesByPriceRange(0, true);

      expect(result).toEqual(mockFreeGames.data.list);
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        'https://api.isthereanydeal.com/v01/deals/v01/list',
        {
          params: expect.objectContaining({
            price_max: 0,
          }),
        },
      );
    });
  });

  describe('formatDealForEmbed', () => {
    test('セール情報を埋め込み用にフォーマットできる', () => {
      const mockDeal = {
        title: 'Test Game',
        plain: 'test-game',
        price_new: 15.99,
        price_old: 29.99,
        price_cut: 47,
        shop: { name: 'Steam' },
        urls: {
          buy: 'https://store.steampowered.com/app/123',
          game: 'https://isthereanydeal.com/game/test-game',
        },
      };

      const result = itadApi.formatDealForEmbed(mockDeal);

      expect(result).toEqual({
        title: 'Test Game',
        plainName: 'test-game',
        currentPrice: '¥16',
        originalPrice: '¥30',
        discount: '47%',
        shopName: 'Steam',
        dealUrl: 'https://store.steampowered.com/app/123',
      });
    });

    test('割引がない場合の処理', () => {
      const mockDeal = {
        title: 'Test Game',
        plain: 'test-game',
        price_new: 29.99,
        price_cut: 0,
      };

      const result = itadApi.formatDealForEmbed(mockDeal);

      expect(result.originalPrice).toBeNull();
      expect(result.discount).toBeNull();
    });

    test('nullの場合、nullを返す', () => {
      const result = itadApi.formatDealForEmbed(null);
      expect(result).toBeNull();
    });
  });

  describe('searchGame', () => {
    test('ゲームを検索できる', async () => {
      const mockSearchResult = {
        data: {
          results: [
            { title: 'Test Game', plain: 'test-game' },
          ],
        },
      };

      mockHttpClient.get.mockResolvedValue(mockSearchResult);

      const result = await itadApi.searchGame('Test Game');

      expect(result).toEqual(mockSearchResult.data);
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        'https://api.isthereanydeal.com/v01/search/search',
        {
          params: {
            key: process.env.ITAD_API_KEY,
            q: 'Test Game',
            limit: 5,
          },
        },
      );
    });

    test('APIエラーの場合、nullを返す', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('API Error'));

      const result = await itadApi.searchGame('Test Game');

      expect(result).toBeNull();
    });
  });
});
