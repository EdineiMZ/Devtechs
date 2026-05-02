/**
 * Per-test setup hook for integration tests. Currently just clears
 * the rate-limit counters between tests so flaky cross-spec coupling
 * doesn't sneak in. Add seed re-applies here when needed.
 */
import 'reflect-metadata';

beforeEach(() => {
  // Bump as cleanup needs grow. Keep `setupFilesAfterEnv` instead of
  // `globalSetup` so jest-circus globals (beforeEach) are available.
});
