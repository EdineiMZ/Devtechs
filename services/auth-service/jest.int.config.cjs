/**
 * Integration test config â€” separate from any unit-jest config so it
 * can pick a different rootDir, longer timeouts, and a global setup
 * that lifts the Nest app once.
 *
 * Run: pnpm --filter @szdevs/auth-service test:int
 *
 * Pre-reqs:
 *   - Postgres + Redis up (docker-compose up postgres redis).
 *   - DATABASE_URL pointing at a DB that has the migrations applied
 *     and the admin seed loaded.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/test'],
  testRegex: '.*\\.int\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  // Integration tests boot the real Nest app + Prisma; 30s gives
  // the bcrypt + DB round-trips room.
  testTimeout: 30_000,
  // Sequential â€” we share a single test database and rate-limit
  // counters; running specs in parallel would create cross-talk.
  maxWorkers: 1,
  setupFilesAfterEnv: ['<rootDir>/test/setup-after-env.ts'],
};
