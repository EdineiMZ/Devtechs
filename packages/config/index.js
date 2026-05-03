/**
 * @szdevs/config - shared config entrypoint.
 *
 * Importers should usually reference the individual files:
 *   - require('@szdevs/config/tsconfig.base.json')
 *   - require('@szdevs/config/.eslintrc.base.js')
 *   - require('@szdevs/config/prettier.config.js')
 */
module.exports = {
  eslint: require('./.eslintrc.base.js'),
  prettier: require('./prettier.config.js'),
};
