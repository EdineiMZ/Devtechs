/** Jest config for apps/web. Uses ts-jest with the JSX-aware
 *  transform; resolves the `@/*` alias the same way Next does. */
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/__tests__/**/*.test.ts?(x)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@devtechs/ui$': '<rootDir>/../../packages/ui/src/index.ts',
    '^@devtechs/ui/(.*)$': '<rootDir>/../../packages/ui/src/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          target: 'ES2020',
          module: 'CommonJS',
          moduleResolution: 'Node',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          skipLibCheck: true,
          baseUrl: '.',
          paths: {
            '@/*': ['./src/*'],
            '@devtechs/ui': ['../../packages/ui/src'],
            '@devtechs/ui/*': ['../../packages/ui/src/*'],
          },
        },
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!(class-variance-authority)/)'],
};
