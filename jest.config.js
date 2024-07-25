/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: "node",
  preset: "ts-jest/presets/js-with-ts",
  setupFilesAfterEnv: ['./setup.js'],
  testPathIgnorePatterns: ["/node_modules/", "/__tests__/build/", "/build/"],
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageProvider: "v8",
};