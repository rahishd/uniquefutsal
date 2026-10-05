/** Tests run against a LOCAL throw-away database (unique_test). The env guard refuses anything else. */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  globalSetup: "<rootDir>/tests/global-setup.js",
  setupFiles: ["<rootDir>/tests/env.js"],
  transform: { "^.+\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json", diagnostics: false }] },
  testTimeout: 30000,
  maxWorkers: 1,
};
