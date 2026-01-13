import { defineConfig, mergeConfig } from 'vitest/config';
import { sharedVitestConfig } from '../config/vitest.shared';

export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      include: ['src/**/*.test.ts'],
      coverage: {
        include: ['src/**/*.ts'],
        exclude: [
          'src/**/*.test.ts',
          'src/**/index.ts',
          // Interactive prompts and signal handlers are inherently hard to test
          // without complex system-level mocking
          'src/utils/prompts.ts',
          'src/utils/signals.ts',
        ],
        thresholds: {
          // Current coverage levels - increase as tests are added
          lines: 55,
          functions: 55,
          branches: 45,
          statements: 55,
        },
      },
    },
  })
);
