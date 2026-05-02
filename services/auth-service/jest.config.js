/** Unit test config — integration tests live in test/ and run via jest.int.config.cjs */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/test/'],
};
