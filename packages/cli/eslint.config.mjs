import baseConfig from '../config/eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    rules: {
      // CLI uses readline and process which have loose types
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      // CLI formatting often uses nullable strings
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true, allowNullish: true },
      ],
    },
  },
  // Test files - allow mock variables and async test patterns
  {
    files: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/require-await': 'off',
      // Allow control characters in regex (for testing ANSI escape codes)
      'no-control-regex': 'off',
    },
  },
  {
    ignores: ['dist/**', 'coverage/**'],
  },
];
