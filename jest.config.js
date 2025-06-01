module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'services/**/*.js',
    'utils/**/*.js',
    'commands/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**'
  ],
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  verbose: true,
  testTimeout: 10000
};