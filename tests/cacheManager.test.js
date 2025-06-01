const CacheManager = require('../utils/cacheManager');
const fs = require('fs').promises;
const path = require('path');

// モック
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
  },
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('CacheManager', () => {
  let cacheManager;
  const testCacheDir = '/test/cache';

  beforeEach(() => {
    jest.clearAllMocks();
    cacheManager = new CacheManager(testCacheDir);
  });

  describe('ensureCacheDirectory', () => {
    test('ディレクトリが存在する場合は何もしない', async () => {
      fs.access.mockResolvedValue(undefined);

      await cacheManager.ensureCacheDirectory();

      expect(fs.access).toHaveBeenCalledWith(testCacheDir);
      expect(fs.mkdir).not.toHaveBeenCalled();
    });

    test('ディレクトリが存在しない場合は作成する', async () => {
      fs.access.mockRejectedValue(new Error('ENOENT'));
      fs.mkdir.mockResolvedValue(undefined);

      await cacheManager.ensureCacheDirectory();

      expect(fs.mkdir).toHaveBeenCalledWith(testCacheDir, { recursive: true });
    });
  });

  describe('set/get', () => {
    const testKey = 'test_key';
    const testData = { foo: 'bar' };
    const ttl = 60000; // 1分

    test('データをキャッシュに保存できる', async () => {
      fs.writeFile.mockResolvedValue(undefined);

      await cacheManager.set(testKey, testData, ttl);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test_key.json'),
        expect.stringContaining('"foo":"bar"'),
        'utf8',
      );
    });

    test('キャッシュからデータを取得できる', async () => {
      const cacheData = {
        data: testData,
        timestamp: Date.now(),
        ttl,
        expiresAt: Date.now() + ttl,
      };
      fs.readFile.mockResolvedValue(JSON.stringify(cacheData));

      const result = await cacheManager.get(testKey);

      expect(result).toEqual(testData);
    });

    test('期限切れのキャッシュはnullを返す', async () => {
      const expiredCacheData = {
        data: testData,
        timestamp: Date.now() - 120000, // 2分前
        ttl,
        expiresAt: Date.now() - 60000, // 1分前に期限切れ
      };
      fs.readFile.mockResolvedValue(JSON.stringify(expiredCacheData));
      fs.unlink.mockResolvedValue(undefined);

      const result = await cacheManager.get(testKey);

      expect(result).toBeNull();
      expect(fs.unlink).toHaveBeenCalled();
    });

    test('キャッシュが存在しない場合はnullを返す', async () => {
      const error = new Error('ENOENT');
      error.code = 'ENOENT';
      fs.readFile.mockRejectedValue(error);

      const result = await cacheManager.get(testKey);

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    test('キャッシュを削除できる', async () => {
      fs.unlink.mockResolvedValue(undefined);

      await cacheManager.delete('test_key');

      expect(fs.unlink).toHaveBeenCalledWith(
        expect.stringContaining('test_key.json'),
      );
    });
  });

  describe('clear', () => {
    test('すべてのキャッシュをクリアできる', async () => {
      const files = ['cache1.json', 'cache2.json', 'other.txt'];
      fs.readdir.mockResolvedValue(files);
      fs.unlink.mockResolvedValue(undefined);

      await cacheManager.clear();

      expect(fs.unlink).toHaveBeenCalledTimes(2);
      expect(fs.unlink).toHaveBeenCalledWith(path.join(testCacheDir, 'cache1.json'));
      expect(fs.unlink).toHaveBeenCalledWith(path.join(testCacheDir, 'cache2.json'));
    });
  });

  describe('cleanup', () => {
    test('期限切れのキャッシュのみを削除する', async () => {
      const files = ['valid.json', 'expired.json'];
      fs.readdir.mockResolvedValue(files);

      // 有効なキャッシュ
      fs.readFile.mockResolvedValueOnce(JSON.stringify({
        expiresAt: Date.now() + 60000, // 1分後
      }));

      // 期限切れのキャッシュ
      fs.readFile.mockResolvedValueOnce(JSON.stringify({
        expiresAt: Date.now() - 60000, // 1分前
      }));

      fs.unlink.mockResolvedValue(undefined);

      await cacheManager.cleanup();

      expect(fs.unlink).toHaveBeenCalledTimes(1);
      expect(fs.unlink).toHaveBeenCalledWith(path.join(testCacheDir, 'expired.json'));
    });
  });

  describe('getStats', () => {
    test('キャッシュ統計を取得できる', async () => {
      const files = ['cache1.json', 'cache2.json'];
      fs.readdir.mockResolvedValue(files);
      fs.stat.mockResolvedValue({ size: 1024 });

      fs.readFile
        .mockResolvedValueOnce(JSON.stringify({
          expiresAt: Date.now() + 60000, // 有効
        }))
        .mockResolvedValueOnce(JSON.stringify({
          expiresAt: Date.now() - 60000, // 期限切れ
        }));

      const stats = await cacheManager.getStats();

      expect(stats).toEqual({
        totalFiles: 2,
        validFiles: 1,
        expiredFiles: 1,
        totalSizeBytes: 2048,
        totalSizeMB: '0.00',
      });
    });
  });
});
