import type { KnipConfig } from "knip";

const config: KnipConfig = {
  workspaces: {
    ".": {
      entry: [],
      project: [],
      ignoreDependencies: [
        // Build tools
        "turbo",
        "husky",
        "lint-staged",
        // ESLint and TypeScript used via configs
        "@eslint/js",
        "typescript-eslint",
      ],
    },
    "packages/config": {
      entry: ["tsconfig.base.json", "eslint.config.mjs"],
      project: ["**/*.{ts,mjs}"],
    },
    "packages/core": {
      entry: ["src/index.ts"],
      project: ["src/**/*.ts"],
      ignore: ["**/*.test.ts"],
      // Public API - all exports are intentional
      includeEntryExports: true,
    },
    "packages/cli": {
      entry: ["src/index.ts"],
      project: ["src/**/*.ts"],
      ignore: ["**/*.test.ts"],
    },
    "apps/gui": {
      entry: ["src/main.tsx"],
      project: ["src/**/*.{ts,tsx}"],
      ignore: [
        "**/*.test.{ts,tsx}",
        "e2e/**",
        // UI component barrel files - exports kept for API consistency
        "src/components/**/index.ts",
        // Tauri API exports - used dynamically
        "src/lib/tauri.ts",
        // Custom hooks barrel
        "src/hooks/use-tauri.ts",
      ],
      ignoreDependencies: [
        // Tauri CLI used via scripts
        "@tauri-apps/cli",
        // Tailwind plugins
        "tailwindcss",
        "@tailwindcss/vite",
        // Test dependencies
        "@playwright/test",
        "@testing-library/react",
        "@testing-library/jest-dom",
        "jsdom",
        // UI dependencies used in components
        "@radix-ui/react-tooltip",
        "@tauri-apps/plugin-opener",
        "@tidy/core",
        "next-themes",
        "tw-animate-css",
      ],
    },
  },
  ignore: ["**/dist/**", "**/node_modules/**", "**/.turbo/**"],
  ignoreDependencies: [
    // Coverage tool
    "@vitest/coverage-v8",
  ],
  // UI components export all variants for API consistency
  ignoreExportsUsedInFile: true,
};

export default config;
