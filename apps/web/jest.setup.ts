import '@testing-library/jest-dom';

// next-auth v5 is ESM-only and cannot be required by Jest's CJS runtime.
// UI component tests don't exercise auth — mock the whole module to keep
// the import chain from exploding at load time.
jest.mock('@/auth', () => ({
  auth: jest.fn().mockResolvedValue(null),
  signIn: jest.fn(),
  signOut: jest.fn(),
  handlers: {},
  unstable_update: jest.fn(),
  AUTH_ERRORS: {},
}));
