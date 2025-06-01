const fs = require('fs');
const path = require('path');

class Logger {
  constructor() {
    this.logsDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  log(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...metadata
    };

    console.log(`[${timestamp}] [${level}] ${message}`, metadata);

    const logFile = path.join(this.logsDir, `${new Date().toISOString().split('T')[0]}.log`);
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  }

  info(message, metadata) {
    this.log('INFO', message, metadata);
  }

  error(message, error, metadata = {}) {
    this.log('ERROR', message, {
      ...metadata,
      error: error?.message || error,
      stack: error?.stack
    });
  }

  warn(message, metadata) {
    this.log('WARN', message, metadata);
  }

  debug(message, metadata) {
    if (process.env.NODE_ENV === 'development') {
      this.log('DEBUG', message, metadata);
    }
  }
}

module.exports = new Logger();