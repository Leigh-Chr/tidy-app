import { defineConfig } from "@playwright/test";

/**
 * Playwright E2E configuration for tidy-app GUI
 *
 * For Tauri apps, E2E testing runs against the web preview (vite preview)
 * rather than the full native app. Full native app testing requires
 * WebDriver setup which is more complex.
 *
 * @see https://v2.tauri.app/develop/tests/webdriver/
 */
export default defineConfig({
  testDir: "./e2e",
  // Run tests in files in parallel
  fullyParallel: true,
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  // Reporter to use
  reporter: [["html", { outputFolder: "playwright-report" }], ["list"]],
  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: "http://localhost:4173",
    // Collect trace when retrying the failed test
    trace: "on-first-retry",
    // Take screenshot only on failure
    screenshot: "only-on-failure",
  },
  // Configure projects for major browsers
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
    // Firefox and WebKit can be added later for full browser coverage
    // {
    //   name: "firefox",
    //   use: { browserName: "firefox" },
    // },
    // {
    //   name: "webkit",
    //   use: { browserName: "webkit" },
    // },
  ],
  // Run local dev server before starting the tests
  webServer: {
    command: "pnpm preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  // Output folder for test artifacts
  outputDir: "e2e-results/test-results",
});
