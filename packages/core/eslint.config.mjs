import baseConfig from '../config/eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    rules: {
      // Allow unsafe operations for JSON parsing and API responses
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      // Allow async functions that might not have await (for interface consistency)
      '@typescript-eslint/require-await': 'off',
      // Allow unnecessary type assertions (common in schema-based code)
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      // Control regex are used intentionally for sanitization
      'no-control-regex': 'off',
      // Allow lexical declarations in case blocks
      'no-case-declarations': 'off',
      // Allow base-to-string for logging
      '@typescript-eslint/no-base-to-string': 'off',
      // Allow nullish values in template expressions
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true, allowNullish: true },
      ],
    },
  },
  // Test files - very lenient
  {
    files: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/require-await': 'off',
      'no-regex-spaces': 'off',
      'prefer-const': 'off',
    },
  },
  {
    ignores: ['dist/**', 'coverage/**'],
  },
];
