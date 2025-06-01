const logger = require('./logger');

/**
 * 必須の環境変数を検証
 * @returns {boolean} 全ての環境変数が設定されているかどうか
 */
function validateRequiredEnvVars() {
  const requiredVars = [
    'DISCORD_BOT_TOKEN',
    'DISCORD_CLIENT_ID',
    'STEAM_API_KEY',
    'RAWG_API_KEY',
    'ITAD_API_KEY',
  ];

  const missingVars = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }

  if (missingVars.length > 0) {
    logger.error(`必須の環境変数が設定されていません: ${missingVars.join(', ')}`);
    logger.info('以下の環境変数を.envファイルまたはシステム環境変数に設定してください:');

    missingVars.forEach(varName => {
      logger.info(`  ${varName}=<your-value>`);
    });

    return false;
  }

  // 環境変数の形式を検証
  const validations = [
    {
      name: 'DISCORD_BOT_TOKEN',
      pattern: /^[\w-]{24,26}\.[\w-]{6}\.[\w-]{27,}$/,
      message: 'Discord Bot Tokenの形式が正しくありません',
    },
    {
      name: 'DISCORD_CLIENT_ID',
      pattern: /^\d{17,19}$/,
      message: 'Discord Client IDは17-19桁の数字である必要があります',
    },
    {
      name: 'STEAM_API_KEY',
      pattern: /^[A-F0-9]{32}$/i,
      message: 'Steam API Keyは32文字の16進数である必要があります',
    },
  ];

  let hasErrors = false;

  for (const { name, pattern, message } of validations) {
    const value = process.env[name];
    if (value && !pattern.test(value)) {
      logger.error(`${name}: ${message}`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    return false;
  }

  logger.info('全ての必須環境変数が正しく設定されています');
  return true;
}

/**
 * オプションの環境変数を検証し、デフォルト値を設定
 */
function validateOptionalEnvVars() {
  const optionalVars = [
    {
      name: 'LOG_LEVEL',
      defaultValue: 'info',
      validValues: ['error', 'warn', 'info', 'debug'],
    },
    {
      name: 'CACHE_UPDATE_INTERVAL',
      defaultValue: '86400000', // 24時間（ミリ秒）
      validator: (value) => !isNaN(parseInt(value, 10)),
    },
    {
      name: 'API_TIMEOUT',
      defaultValue: '5000', // 5秒
      validator: (value) => !isNaN(parseInt(value, 10)) && parseInt(value, 10) > 0,
    },
  ];

  for (const { name, defaultValue, validValues, validator } of optionalVars) {
    const value = process.env[name];

    if (!value) {
      process.env[name] = defaultValue;
      logger.debug(`${name}が設定されていないため、デフォルト値を使用: ${defaultValue}`);
    } else if (validValues && !validValues.includes(value)) {
      logger.warn(`${name}の値が無効です: ${value}。有効な値: ${validValues.join(', ')}`);
      process.env[name] = defaultValue;
    } else if (validator && !validator(value)) {
      logger.warn(`${name}の値が無効です: ${value}。デフォルト値を使用: ${defaultValue}`);
      process.env[name] = defaultValue;
    }
  }
}

/**
 * 全ての環境変数を検証
 * @returns {boolean} 検証が成功したかどうか
 */
function validateEnvironment() {
  logger.info('環境変数の検証を開始します...');

  // 必須環境変数の検証
  if (!validateRequiredEnvVars()) {
    return false;
  }

  // オプション環境変数の検証とデフォルト値設定
  validateOptionalEnvVars();

  return true;
}

module.exports = {
  validateEnvironment,
  validateRequiredEnvVars,
  validateOptionalEnvVars,
};
