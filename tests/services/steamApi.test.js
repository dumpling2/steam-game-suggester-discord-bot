const fs = require('fs').promises;
const path = require('path');

// モック
jest.mock('fs', () => ({
  promises: {
    stat: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('SteamApiService - API統合テスト', () => {
  let mockHttpClient;
  let steamApi;

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
    steamApi = require('../../services/steamApi');
  });

  describe('getAppList', () => {
    const mockAppList = [
      { appid: 570, name: 'Dota 2' },
      { appid: 730, name: 'Counter-Strike: Global Offensive' },
      { appid: 440, name: 'Team Fortress 2' },
    ];

    test('キャッシュがない場合、APIから取得する', async () => {
      fs.stat.mockRejectedValue(new Error('File not found'));
      mockHttpClient.get.mockResolvedValue({
        data: {
          applist: {
            apps: mockAppList,
          },
        },
      });

      const result = await steamApi.getAppList();

      expect(result).toEqual(mockAppList);
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        'https://api.steampowered.com/ISteamApps/GetAppList/v2/',
      );
      expect(fs.writeFile).toHaveBeenCalled();
    });

    test('有効なキャッシュがある場合、キャッシュから読み込む', async () => {
      const now = Date.now();
      fs.stat.mockResolvedValue({ mtimeMs: now - 1000 }); // 1秒前
      fs.readFile.mockResolvedValue(JSON.stringify(mockAppList));

      const result = await steamApi.getAppList();

      expect(result).toEqual(mockAppList);
      expect(mockHttpClient.get).not.toHaveBeenCalled();
    });

    test('APIエラーの場合、エラーをスローする', async () => {
      fs.stat.mockRejectedValue(new Error('File not found'));
      mockHttpClient.get.mockRejectedValue(new Error('API Error'));

      await expect(steamApi.getAppList()).rejects.toThrow(
        'Steam APIからゲームリストを取得できませんでした',
      );
    });
  });

  describe('getAppDetails', () => {
    const mockGameDetails = {
      type: 'game',
      name: 'Test Game',
      steam_appid: 12345,
      short_description: 'A test game',
    };

    test('ゲームの詳細情報を取得できる', async () => {
      mockHttpClient.get.mockResolvedValue({
        data: {
          '12345': {
            success: true,
            data: mockGameDetails,
          },
        },
      });

      const result = await steamApi.getAppDetails(12345);

      expect(result).toEqual(mockGameDetails);
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        'https://store.steampowered.com/api/appdetails',
        {
          params: {
            appids: 12345,
            l: 'japanese',
          },
        },
      );
    });

    test('成功フラグがfalseの場合、nullを返す', async () => {
      mockHttpClient.get.mockResolvedValue({
        data: {
          '12345': {
            success: false,
          },
        },
      });

      const result = await steamApi.getAppDetails(12345);

      expect(result).toBeNull();
    });

    test('APIエラーの場合、nullを返す', async () => {
      mockHttpClient.get.mockRejectedValue(new Error('API Error'));

      const result = await steamApi.getAppDetails(12345);

      expect(result).toBeNull();
    });
  });

  describe('searchGameByName', () => {
    const mockAppList = [
      { appid: 570, name: 'Dota 2' },
      { appid: 730, name: 'Counter-Strike: Global Offensive' },
      { appid: 440, name: 'Team Fortress 2' },
      { appid: 271590, name: 'Grand Theft Auto V' },
      { appid: 413150, name: 'Stardew Valley' },
    ];

    beforeEach(() => {
      // getAppListのモック
      steamApi.appListCache = mockAppList;
    });

    test('完全一致するゲームを見つける', async () => {
      const result = await steamApi.searchGameByName('Dota 2');

      expect(result).toEqual({ appid: 570, name: 'Dota 2' });
    });

    test('部分一致するゲームを見つける', async () => {
      const result = await steamApi.searchGameByName('Counter');

      expect(result).toEqual({ appid: 730, name: 'Counter-Strike: Global Offensive' });
    });

    test('一致するゲームがない場合、nullを返す', async () => {
      const result = await steamApi.searchGameByName('Nonexistent Game');

      expect(result).toBeNull();
    });

    test('大文字小文字を区別しない', async () => {
      const result = await steamApi.searchGameByName('dota 2');

      expect(result).toEqual({ appid: 570, name: 'Dota 2' });
    });
  });

  describe('getRandomGame', () => {
    test('ランダムなゲームを返す', async () => {
      const mockAppList = [
        { appid: 570, name: 'Dota 2' },
        { appid: 730, name: 'Counter-Strike: Global Offensive' },
      ];
      steamApi.appListCache = mockAppList;

      const result = await steamApi.getRandomGame();

      expect(mockAppList).toContainEqual(result);
    });

    test('ゲームリストが空の場合、エラーをスローする', async () => {
      steamApi.appListCache = [];

      await expect(steamApi.getRandomGame()).rejects.toThrow('ゲームリストが空です');
    });
  });
});