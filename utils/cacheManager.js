const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class CacheManager {
  constructor(cacheDir) {
    this.cacheDir = cacheDir;
    this.ensureCacheDirectory();
  }

  async ensureCacheDirectory() {
    try {
      await fs.access(this.cacheDir);
    } catch (error) {
      try {
        await fs.mkdir(this.cacheDir, { recursive: true });
        logger.info(`キャッシュディレクトリを作成しました: ${this.cacheDir}`);
      } catch (mkdirError) {
        logger.error('キャッシュディレクトリの作成に失敗しました', mkdirError);
      }
    }
  }

  /**
   * キャッシュファイルのパスを生成
   * @param {string} key - キャッシュキー
   * @returns {string} キャッシュファイルのパス
   */
  getCacheFilePath(key) {
    // キーを安全なファイル名に変換
    const safeKey = key.replace(/[^a-zA-Z0-9-_]/g, '_');
    return path.join(this.cacheDir, `${safeKey}.json`);
  }

  /**
   * キャッシュにデータを保存
   * @param {string} key - キャッシュキー
   * @param {any} data - 保存するデータ
   * @param {number} ttl - 有効期限（ミリ秒）
   */
  async set(key, data, ttl) {
    const filePath = this.getCacheFilePath(key);
    const cacheData = {
      data,
      timestamp: Date.now(),
      ttl,
      expiresAt: Date.now() + ttl,
    };

    try {
      await fs.writeFile(filePath, JSON.stringify(cacheData), 'utf8');
      logger.debug(`キャッシュに保存しました: ${key}`);
    } catch (error) {
      logger.error(`キャッシュの保存に失敗しました: ${key}`, error);
    }
  }

  /**
   * キャッシュからデータを取得
   * @param {string} key - キャッシュキー
   * @returns {any|null} キャッシュされたデータ、または null
   */
  async get(key) {
    const filePath = this.getCacheFilePath(key);

    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const cacheData = JSON.parse(fileContent);

      // 有効期限チェック
      if (Date.now() > cacheData.expiresAt) {
        logger.debug(`キャッシュの有効期限が切れています: ${key}`);
        await this.delete(key);
        return null;
      }

      logger.debug(`キャッシュから取得しました: ${key}`);
      return cacheData.data;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error(`キャッシュの読み込みエラー: ${key}`, error);
      }
      return null;
    }
  }

  /**
   * キャッシュからデータを削除
   * @param {string} key - キャッシュキー
   */
  async delete(key) {
    const filePath = this.getCacheFilePath(key);

    try {
      await fs.unlink(filePath);
      logger.debug(`キャッシュを削除しました: ${key}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error(`キャッシュの削除エラー: ${key}`, error);
      }
    }
  }

  /**
   * すべてのキャッシュをクリア
   */
  async clear() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      await Promise.all(
        jsonFiles.map(file => fs.unlink(path.join(this.cacheDir, file))),
      );

      logger.info(`${jsonFiles.length}個のキャッシュファイルを削除しました`);
    } catch (error) {
      logger.error('キャッシュのクリアに失敗しました', error);
    }
  }

  /**
   * 期限切れのキャッシュをクリーンアップ
   */
  async cleanup() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      let cleanedCount = 0;

      for (const file of jsonFiles) {
        const filePath = path.join(this.cacheDir, file);
        try {
          const fileContent = await fs.readFile(filePath, 'utf8');
          const cacheData = JSON.parse(fileContent);

          if (Date.now() > cacheData.expiresAt) {
            await fs.unlink(filePath);
            cleanedCount++;
          }
        } catch (error) {
          logger.error(`キャッシュファイルの処理エラー: ${file}`, error);
        }
      }

      if (cleanedCount > 0) {
        logger.info(`${cleanedCount}個の期限切れキャッシュを削除しました`);
      }
    } catch (error) {
      logger.error('キャッシュのクリーンアップに失敗しました', error);
    }
  }

  /**
   * キャッシュの統計情報を取得
   */
  async getStats() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      let totalSize = 0;
      let validCount = 0;
      let expiredCount = 0;

      for (const file of jsonFiles) {
        const filePath = path.join(this.cacheDir, file);
        const stat = await fs.stat(filePath);
        totalSize += stat.size;

        try {
          const fileContent = await fs.readFile(filePath, 'utf8');
          const cacheData = JSON.parse(fileContent);

          if (Date.now() > cacheData.expiresAt) {
            expiredCount++;
          } else {
            validCount++;
          }
        } catch (error) {
          // JSONパースエラーは無視
        }
      }

      return {
        totalFiles: jsonFiles.length,
        validFiles: validCount,
        expiredFiles: expiredCount,
        totalSizeBytes: totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      };
    } catch (error) {
      logger.error('キャッシュ統計の取得に失敗しました', error);
      return null;
    }
  }
}

module.exports = CacheManager;