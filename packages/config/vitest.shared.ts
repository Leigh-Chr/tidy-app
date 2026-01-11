import { defineConfig } from 'vitest/config';

/**
 * Shared Vitest configuration for all packages
 * Import and merge with package-specific config
 */
export const sharedVitestConfig = defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.test.ts'],
    },
  },
});

export default sharedVitestConfig;
