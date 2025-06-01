const CacheManager = require('./cacheManager');
const logger = require('./logger');
const path = require('path');

class ScheduledJobs {
  constructor() {
    this.jobs = [];
    this.cacheManager = new CacheManager(path.join(__dirname, '..', 'cache'));
  }

  /**
   * すべてのジョブを開始
   */
  start() {
    // キャッシュクリーンアップジョブ（1時間ごと）
    const cleanupInterval = setInterval(() => {
      this.runCacheCleanup();
    }, 60 * 60 * 1000); // 1時間

    this.jobs.push({
      name: 'cacheCleanup',
      interval: cleanupInterval,
    });

    // キャッシュ統計ログジョブ（24時間ごと）
    const statsInterval = setInterval(() => {
      this.logCacheStats();
    }, 24 * 60 * 60 * 1000); // 24時間

    this.jobs.push({
      name: 'cacheStats',
      interval: statsInterval,
    });

    logger.info('スケジュールジョブを開始しました');
    
    // 初回実行
    this.runCacheCleanup();
    this.logCacheStats();
  }

  /**
   * すべてのジョブを停止
   */
  stop() {
    for (const job of this.jobs) {
      clearInterval(job.interval);
    }
    this.jobs = [];
    logger.info('スケジュールジョブを停止しました');
  }

  /**
   * キャッシュクリーンアップを実行
   */
  async runCacheCleanup() {
    try {
      logger.info('キャッシュクリーンアップを開始します');
      await this.cacheManager.cleanup();
    } catch (error) {
      logger.error('キャッシュクリーンアップでエラーが発生しました', error);
    }
  }

  /**
   * キャッシュ統計をログに出力
   */
  async logCacheStats() {
    try {
      const stats = await this.cacheManager.getStats();
      if (stats) {
        logger.info('キャッシュ統計', {
          totalFiles: stats.totalFiles,
          validFiles: stats.validFiles,
          expiredFiles: stats.expiredFiles,
          totalSizeMB: stats.totalSizeMB,
        });
      }
    } catch (error) {
      logger.error('キャッシュ統計の取得でエラーが発生しました', error);
    }
  }
}

module.exports = new ScheduledJobs();