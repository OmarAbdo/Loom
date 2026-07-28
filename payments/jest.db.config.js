/**
 * Jest config for the Postgres DATA-LAYER tests (repositories against a real
 * Testcontainers Postgres). Separate from the default config so these tests do
 * not boot mongodb-memory-server or the Express app. See the tickets service's
 * jest.db.config.js for the full rationale.
 *
 * Run with:  npx jest -c jest.db.config.js
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/repositories/**/__test__/**/*.test.ts'],
};
