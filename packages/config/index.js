/**
 * @devtechs/config - shared config entrypoint.
 *
 * Importers should usually reference the individual files:
 *   - require('@devtechs/config/tsconfig.base.json')
 *   - require('@devtechs/config/.eslintrc.base.js')
 *   - require('@devtechs/config/prettier.config.js')
 */
module.exports = {
  eslint: require('./.eslintrc.base.js'),
  prettier: require('./prettier.config.js'),
};
