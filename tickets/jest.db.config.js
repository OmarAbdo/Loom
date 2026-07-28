/**
 * Jest config for the Postgres DATA-LAYER tests (repositories against a real
 * Testcontainers Postgres).
 *
 * Kept separate from the default jest config (in package.json) because the
 * default one runs src/test/setup.ts, which boots mongodb-memory-server and
 * imports the Express app + old NATS/common stack. The data-layer tests need
 * none of that — they only touch db/ and repositories/. Once Phase 5 rewires
 * the service (routes -> repos, Kafka, Express 5) the two configs converge.
 *
 * Run with:  npx jest -c jest.db.config.js
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/repositories/**/__test__/**/*.test.ts'],
};
