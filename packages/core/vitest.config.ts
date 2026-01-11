import { defineConfig, mergeConfig } from 'vitest/config';
import { sharedVitestConfig } from '../config/vitest.shared';

export default mergeConfig(
  sharedVitestConfig,
  defineConfig({
    test: {
      include: ['src/**/*.test.ts'],
      coverage: {
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.test.ts', 'src/**/index.ts'],
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 80,
          statements: 80,
        },
      },
    },
  })
);
