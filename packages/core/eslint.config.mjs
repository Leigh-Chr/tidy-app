import baseConfig from '../config/eslint.config.mjs';

export default [
  ...baseConfig,
  {
    ignores: ['dist/**', 'coverage/**'],
  },
];
