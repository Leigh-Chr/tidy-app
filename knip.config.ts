import type { KnipConfig } from "knip";

const config: KnipConfig = {
  workspaces: {
    ".": {
      entry: ["scripts/*.ts"],
      project: ["scripts/**/*.ts"],
    },
    "packages/config": {
      // Let Knip auto-detect entry points
      project: ["**/*.{ts,mjs}"],
      // vitest.shared.ts exports both named and default for flexibility
      ignore: ["vitest.shared.ts"],
    },
    "packages/core": {
      // Let Knip auto-detect entry points from package.json
      project: ["src/**/*.ts"],
      // Public library API - ignore all source files since exports are intentional
      // This package exposes types and functions for external consumers
      ignore: [
        "**/*.test.ts",
        // All source files export public API for library consumers
        "src/**/*.ts",
      ],
      // Type definitions for dependencies
      ignoreDependencies: ["@types/pdf-parse"],
    },
    "packages/cli": {
      // Let Knip auto-detect entry points from package.json
      project: ["src/**/*.ts"],
      ignore: ["**/*.test.ts"],
    },
    "apps/gui": {
      entry: ["src/main.tsx"],
      project: ["src/**/*.{ts,tsx}"],
      ignore: [
        "**/*.test.{ts,tsx}",
        "e2e/**",
        // UI components - shadcn/ui pattern exports all variants for consistency
        "src/components/ui/*.tsx",
        // Barrel files for cleaner component imports
        "src/components/*/index.ts",
        // Tauri API exports - used dynamically
        "src/lib/tauri.ts",
        // Store hooks - exported for potential external use
        "src/stores/app-store.ts",
        // Utility libraries - exported for debugging/testing
        "src/lib/log-utils.ts",
        // Folder organization components - available for future UI enhancements
        "src/components/folder-structure-selector/*.tsx",
        "src/components/folder-tree-preview/*.tsx",
        // Security hook - rate limiting utility
        "src/hooks/useThrottle.ts",
      ],
      // Tauri plugins are used at runtime via Rust backend
      // @tidy/core is for future integration
      // CSS dependencies are imported in index.css (Knip doesn't parse CSS)
      ignoreDependencies: [
        "@tauri-apps/plugin-opener",
        "@tauri-apps/plugin-updater",
        "@tidy/core",
        "tailwindcss",
        "tw-animate-css",
      ],
    },
  },
  ignore: ["**/dist/**", "**/node_modules/**", "**/.turbo/**"],
  // UI components export all variants for API consistency
  ignoreExportsUsedInFile: true,
  // Binaries used in scripts and CI
  ignoreBinaries: ["tauri"],
};

export default config;
