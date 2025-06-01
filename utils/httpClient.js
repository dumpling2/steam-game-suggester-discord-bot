const axios = require('axios');
const logger = require('./logger');

/**
 * リトライ機能付きHTTPクライアントを作成
 * @param {Object} config - 設定オプション
 * @returns {axios.AxiosInstance} 設定済みのaxiosインスタンス
 */
function createHttpClient(config = {}) {
  const {
    timeout = parseInt(process.env.API_TIMEOUT || '5000', 10),
    retries = 3,
    retryDelay = 1000,
    retryCondition = null,
  } = config;

  const client = axios.create({
    timeout,
    ...config,
  });

  // リクエストインターセプター
  client.interceptors.request.use(
    (config) => {
      logger.debug(`HTTP Request: ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    },
    (error) => {
      logger.error('リクエストエラー:', error);
      return Promise.reject(error);
    },
  );

  // レスポンスインターセプター（リトライロジック含む）
  client.interceptors.response.use(
    (response) => {
      logger.debug(`HTTP Response: ${response.status} ${response.config.url}`);
      return response;
    },
    async (error) => {
      const { config, response } = error;

      // リトライカウンターの初期化
      if (!config._retryCount) {
        config._retryCount = 0;
      }

      // リトライ条件の確認
      const shouldRetry = shouldRetryRequest(error, config._retryCount, retries, retryCondition);

      if (shouldRetry) {
        config._retryCount++;

        // エクスポネンシャルバックオフ
        const delay = retryDelay * Math.pow(2, config._retryCount - 1);

        logger.warn(`リトライ ${config._retryCount}/${retries} - ${delay}ms後に再試行: ${config.url}`);

        // 遅延実行
        await new Promise(resolve => setTimeout(resolve, delay));

        // リクエストの再実行
        return client(config);
      }

      // エラーログ
      if (response) {
        logger.error(`HTTP Error: ${response.status} ${config.url}`, {
          status: response.status,
          statusText: response.statusText,
          data: response.data,
        });
      } else if (error.code === 'ECONNABORTED') {
        logger.error(`Request timeout: ${config.url}`);
      } else {
        logger.error(`Network error: ${config.url}`, error.message);
      }

      return Promise.reject(error);
    },
  );

  return client;
}

/**
 * リトライすべきかどうかを判定
 * @param {Error} error - エラーオブジェクト
 * @param {number} retryCount - 現在のリトライ回数
 * @param {number} maxRetries - 最大リトライ回数
 * @param {Function|null} customCondition - カスタムリトライ条件
 * @returns {boolean} リトライすべきかどうか
 */
function shouldRetryRequest(error, retryCount, maxRetries, customCondition) {
  // リトライ回数の上限チェック
  if (retryCount >= maxRetries) {
    return false;
  }

  // カスタム条件がある場合はそれを使用
  if (customCondition && typeof customCondition === 'function') {
    return customCondition(error);
  }

  // デフォルトのリトライ条件
  const { response, code } = error;

  // ネットワークエラー
  if (!response && code !== 'ECONNABORTED') {
    return true;
  }

  // タイムアウト
  if (code === 'ECONNABORTED') {
    return true;
  }

  // HTTPステータスコードによる判定
  if (response) {
    const { status } = response;

    // 5xx エラー（サーバーエラー）
    if (status >= 500) {
      return true;
    }

    // 429 Too Many Requests
    if (status === 429) {
      return true;
    }

    // 408 Request Timeout
    if (status === 408) {
      return true;
    }
  }

  return false;
}

/**
 * レート制限を考慮したHTTPクライアントを作成
 * @param {Object} config - 設定オプション
 * @param {Object} rateLimitConfig - レート制限設定
 * @returns {Object} レート制限付きクライアント
 */
function createRateLimitedClient(config = {}, rateLimitConfig = {}) {
  const {
    maxRequestsPerSecond = 10,
    maxRequestsPerMinute = 100,
  } = rateLimitConfig;

  const client = createHttpClient(config);
  const requestTimestamps = [];

  // レート制限チェック
  const checkRateLimit = () => {
    const now = Date.now();

    // 1秒以上前のタイムスタンプを削除
    const oneSecondAgo = now - 1000;
    const oneMinuteAgo = now - 60000;

    // 古いタイムスタンプを削除
    while (requestTimestamps.length > 0 && requestTimestamps[0] < oneMinuteAgo) {
      requestTimestamps.shift();
    }

    // 1秒間のリクエスト数をカウント
    const recentRequests = requestTimestamps.filter(ts => ts > oneSecondAgo).length;

    // レート制限チェック
    if (recentRequests >= maxRequestsPerSecond || requestTimestamps.length >= maxRequestsPerMinute) {
      return false;
    }

    return true;
  };

  // リクエスト実行
  const executeRequest = async (method, url, ...args) => {
    // レート制限待機
    while (!checkRateLimit()) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // タイムスタンプを記録
    requestTimestamps.push(Date.now());

    // リクエスト実行
    return client[method](url, ...args);
  };

  // HTTPメソッドをラップ
  return {
    get: (url, config) => executeRequest('get', url, config),
    post: (url, data, config) => executeRequest('post', url, data, config),
    put: (url, data, config) => executeRequest('put', url, data, config),
    delete: (url, config) => executeRequest('delete', url, config),
    patch: (url, data, config) => executeRequest('patch', url, data, config),
    head: (url, config) => executeRequest('head', url, config),
    options: (url, config) => executeRequest('options', url, config),
  };
}

module.exports = {
  createHttpClient,
  createRateLimitedClient,
  shouldRetryRequest,
};
