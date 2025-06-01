const { createHttpClient, shouldRetryRequest } = require('../utils/httpClient');
const axios = require('axios');

// axios のモック
jest.mock('axios');

describe('HTTPクライアント', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('shouldRetryRequest', () => {
    test('ネットワークエラーの場合、リトライする', () => {
      const error = new Error('Network Error');
      error.code = 'ENOTFOUND';

      const result = shouldRetryRequest(error, 0, 3);
      expect(result).toBe(true);
    });

    test('タイムアウトの場合、リトライする', () => {
      const error = new Error('Timeout');
      error.code = 'ECONNABORTED';

      const result = shouldRetryRequest(error, 0, 3);
      expect(result).toBe(true);
    });

    test('5xxエラーの場合、リトライする', () => {
      const error = new Error('Server Error');
      error.response = { status: 500 };

      const result = shouldRetryRequest(error, 0, 3);
      expect(result).toBe(true);
    });

    test('429エラー（レート制限）の場合、リトライする', () => {
      const error = new Error('Too Many Requests');
      error.response = { status: 429 };

      const result = shouldRetryRequest(error, 0, 3);
      expect(result).toBe(true);
    });

    test('4xxエラー（429以外）の場合、リトライしない', () => {
      const error = new Error('Bad Request');
      error.response = { status: 400 };

      const result = shouldRetryRequest(error, 0, 3);
      expect(result).toBe(false);
    });

    test('リトライ回数が上限に達した場合、リトライしない', () => {
      const error = new Error('Server Error');
      error.response = { status: 500 };

      const result = shouldRetryRequest(error, 3, 3);
      expect(result).toBe(false);
    });
  });

  describe('createHttpClient', () => {
    test('HTTPクライアントが作成される', () => {
      const mockAxiosInstance = {
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      };

      axios.create.mockReturnValue(mockAxiosInstance);

      createHttpClient({
        timeout: 5000,
        retries: 3,
        retryDelay: 1000,
      });

      expect(axios.create).toHaveBeenCalledWith({
        timeout: 5000,
        retries: 3,
        retryDelay: 1000,
      });

      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });

    test('デフォルト設定でHTTPクライアントが作成される', () => {
      const mockAxiosInstance = {
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      };

      axios.create.mockReturnValue(mockAxiosInstance);

      createHttpClient();

      expect(axios.create).toHaveBeenCalledWith({
        timeout: 5000,
      });
    });
  });
});
