const { validateRequiredEnvVars, validateOptionalEnvVars } = require('../utils/validateEnv');

describe('環境変数検証', () => {
  let originalEnv;

  beforeEach(() => {
    // 元の環境変数を保存
    originalEnv = { ...process.env };
    // ログ出力を無効化
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // 環境変数を復元
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('validateRequiredEnvVars', () => {
    test('全ての必須環境変数が設定されている場合、trueを返す', () => {
      process.env = {
        DISCORD_BOT_TOKEN: 'MTIzNDU2Nzg5MDEyMzQ1Njc4.ABCDEF.test-token-for-testing-only-not-real',
        DISCORD_CLIENT_ID: '123456789012345678',
        STEAM_API_KEY: 'A1B2C3D4E5F6789012345678901234AB',
        RAWG_API_KEY: 'test-rawg-api-key',
        ITAD_API_KEY: 'test-itad-api-key',
      };

      const result = validateRequiredEnvVars();
      expect(result).toBe(true);
    });

    test('必須環境変数が不足している場合、falseを返す', () => {
      process.env = {
        DISCORD_BOT_TOKEN: 'MTIzNDU2Nzg5MDEyMzQ1Njc4.ABCDEF.test-token-for-testing-only-not-real',
        // DISCORD_CLIENT_IDが不足
        STEAM_API_KEY: 'A1B2C3D4E5F6789012345678901234AB',
        RAWG_API_KEY: 'test-rawg-api-key',
        ITAD_API_KEY: 'test-itad-api-key',
      };

      const result = validateRequiredEnvVars();
      expect(result).toBe(false);
    });

    test('Discord Bot Tokenの形式が無効な場合、falseを返す', () => {
      process.env = {
        DISCORD_BOT_TOKEN: 'invalid-token',
        DISCORD_CLIENT_ID: '123456789012345678',
        STEAM_API_KEY: 'A1B2C3D4E5F6789012345678901234AB',
        RAWG_API_KEY: 'test-rawg-api-key',
        ITAD_API_KEY: 'test-itad-api-key',
      };

      const result = validateRequiredEnvVars();
      expect(result).toBe(false);
    });

    test('Discord Client IDの形式が無効な場合、falseを返す', () => {
      process.env = {
        DISCORD_BOT_TOKEN: 'MTIzNDU2Nzg5MDEyMzQ1Njc4.ABCDEF.test-token-for-testing-only-not-real',
        DISCORD_CLIENT_ID: 'invalid-id',
        STEAM_API_KEY: 'A1B2C3D4E5F6789012345678901234AB',
        RAWG_API_KEY: 'test-rawg-api-key',
        ITAD_API_KEY: 'test-itad-api-key',
      };

      const result = validateRequiredEnvVars();
      expect(result).toBe(false);
    });

    test('Steam API Keyの形式が無効な場合、falseを返す', () => {
      process.env = {
        DISCORD_BOT_TOKEN: 'MTIzNDU2Nzg5MDEyMzQ1Njc4.ABCDEF.test-token-for-testing-only-not-real',
        DISCORD_CLIENT_ID: '123456789012345678',
        STEAM_API_KEY: 'invalid-key',
        RAWG_API_KEY: 'test-rawg-api-key',
        ITAD_API_KEY: 'test-itad-api-key',
      };

      const result = validateRequiredEnvVars();
      expect(result).toBe(false);
    });
  });

  describe('validateOptionalEnvVars', () => {
    test('オプション環境変数が設定されていない場合、デフォルト値を設定する', () => {
      process.env = {};

      validateOptionalEnvVars();

      expect(process.env.LOG_LEVEL).toBe('info');
      expect(process.env.CACHE_UPDATE_INTERVAL).toBe('86400000');
      expect(process.env.API_TIMEOUT).toBe('5000');
    });

    test('LOG_LEVELに無効な値が設定されている場合、デフォルト値を使用する', () => {
      process.env = {
        LOG_LEVEL: 'invalid-level',
      };

      validateOptionalEnvVars();

      expect(process.env.LOG_LEVEL).toBe('info');
    });

    test('API_TIMEOUTに無効な値が設定されている場合、デフォルト値を使用する', () => {
      process.env = {
        API_TIMEOUT: 'not-a-number',
      };

      validateOptionalEnvVars();

      expect(process.env.API_TIMEOUT).toBe('5000');
    });

    test('有効な値が設定されている場合、その値を保持する', () => {
      process.env = {
        LOG_LEVEL: 'debug',
        CACHE_UPDATE_INTERVAL: '3600000',
        API_TIMEOUT: '10000',
      };

      validateOptionalEnvVars();

      expect(process.env.LOG_LEVEL).toBe('debug');
      expect(process.env.CACHE_UPDATE_INTERVAL).toBe('3600000');
      expect(process.env.API_TIMEOUT).toBe('10000');
    });
  });
});
