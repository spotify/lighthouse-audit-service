module.exports = {
  ...require('@spotify/web-scripts/config/jest.config.js'),
  globalSetup: '<rootDir>/jest/global_setup.ts',
  globalTeardown: '<rootDir>/jest/global_teardown.ts',
  resetModules: true,
};
