import { test, expect } from "@playwright/test";

/**
 * E2E smoke tests for tidy-app GUI
 *
 * These tests verify that the application launches and renders correctly.
 * They run against the Vite preview server, testing the web portion of the
 * Tauri application.
 */

test.describe("App Launch", () => {
  test("should display the app title", async ({ page }) => {
    await page.goto("/");

    // Check that the main heading is visible
    const heading = page.getByRole("heading", { name: /tidy-app/i });
    await expect(heading).toBeVisible();
  });

  test("should display welcome message", async ({ page }) => {
    await page.goto("/");

    // Check for welcome card
    await expect(page.getByText("Welcome to tidy-app")).toBeVisible();
  });

  test("should display footer with version info", async ({ page }) => {
    await page.goto("/");

    // Check for footer text (use exact match to avoid ambiguity with card description)
    await expect(page.getByText("Intelligent file organization", { exact: true })).toBeVisible();
  });
});

test.describe("DropZone Component", () => {
  test("should display drop zone with default state", async ({ page }) => {
    await page.goto("/");

    // Check for drop zone element
    const dropZone = page.getByTestId("drop-zone");
    await expect(dropZone).toBeVisible();

    // Check for default text
    await expect(page.getByText("Drop a folder here")).toBeVisible();
  });

  test("should display browse button", async ({ page }) => {
    await page.goto("/");

    // Check for browse button in drop zone
    const browseButton = page.getByRole("button", { name: /browse/i });
    await expect(browseButton).toBeVisible();
  });

  test("should display privacy message", async ({ page }) => {
    await page.goto("/");

    // Check for privacy message
    await expect(page.getByText(/your files never leave your computer/i)).toBeVisible();
  });

  test("should have dashed border in default state", async ({ page }) => {
    await page.goto("/");

    const dropZone = page.getByTestId("drop-zone");
    await expect(dropZone).toHaveClass(/border-dashed/);
  });

  test("should change appearance on drag over", async ({ page }) => {
    await page.goto("/");

    const dropZone = page.getByTestId("drop-zone");

    // Use evaluate to trigger the drag event with proper DataTransfer
    await dropZone.evaluate((element) => {
      const event = new DragEvent("dragenter", {
        bubbles: true,
        cancelable: true,
      });
      // Override dataTransfer getter to return mock object
      Object.defineProperty(event, "dataTransfer", {
        value: { types: ["Files"] },
      });
      element.dispatchEvent(event);
    });

    // Check that text changes to indicate drop is possible
    await expect(page.getByText(/drop to scan/i)).toBeVisible();
  });
});

test.describe("Status Display", () => {
  test("should display status section when no folder selected", async ({ page }) => {
    await page.goto("/");

    // Check for status label
    await expect(page.getByText("Status:")).toBeVisible();
  });

  test("should have a refresh button when no folder selected", async ({ page }) => {
    await page.goto("/");

    // Check for refresh button
    const refreshButton = page.getByRole("button", { name: /refresh version/i });
    await expect(refreshButton).toBeVisible();
  });
});

/**
 * Story 6.5 - CLI Feature Parity E2E Tests
 *
 * These tests verify that GUI features that should match CLI capabilities
 * are present and functional. Full parity verification requires the CLI
 * implementation (planned for later stories).
 */
test.describe("Scan Options (Story 6.5 - AC1, AC2)", () => {
  test("should display scan options with recursive toggle", async ({ page }) => {
    await page.goto("/");

    // Check for scan options container
    const scanOptions = page.getByTestId("scan-options");
    await expect(scanOptions).toBeVisible();

    // Check for recursive toggle
    const recursiveToggle = page.getByTestId("recursive-toggle");
    await expect(recursiveToggle).toBeVisible();

    // Check label text
    await expect(page.getByText("Include subfolders")).toBeVisible();
    await expect(page.getByText("Scan all nested directories")).toBeVisible();
  });

  test("should display file type filter controls", async ({ page }) => {
    await page.goto("/");

    // Check for filter section
    await expect(page.getByText("Filter by type")).toBeVisible();

    // Check for file type checkboxes
    await expect(page.getByTestId("filter-image")).toBeVisible();
    await expect(page.getByTestId("filter-document")).toBeVisible();
    await expect(page.getByTestId("filter-video")).toBeVisible();
    await expect(page.getByTestId("filter-audio")).toBeVisible();
    await expect(page.getByTestId("filter-other")).toBeVisible();
  });

  test("should toggle recursive scanning option", async ({ page }) => {
    await page.goto("/");

    const recursiveToggle = page.getByTestId("recursive-toggle");

    // Initially should be unchecked (default)
    await expect(recursiveToggle).toHaveAttribute("data-state", "unchecked");

    // Click to toggle
    await recursiveToggle.click();
    await expect(recursiveToggle).toHaveAttribute("data-state", "checked");

    // Click again to toggle off
    await recursiveToggle.click();
    await expect(recursiveToggle).toHaveAttribute("data-state", "unchecked");
  });

  test("should toggle file type filters", async ({ page }) => {
    await page.goto("/");

    const imageFilter = page.getByTestId("filter-image");

    // Initially unchecked
    await expect(imageFilter).toHaveAttribute("data-state", "unchecked");

    // Click to check
    await imageFilter.click();
    await expect(imageFilter).toHaveAttribute("data-state", "checked");

    // Should show "Showing 1 type"
    await expect(page.getByText("Showing 1 type")).toBeVisible();

    // Add another filter
    await page.getByTestId("filter-document").click();
    await expect(page.getByText("Showing 2 types")).toBeVisible();
  });

  test("should clear all filters", async ({ page }) => {
    await page.goto("/");

    // Select some filters
    await page.getByTestId("filter-image").click();
    await page.getByTestId("filter-document").click();
    await expect(page.getByText("Showing 2 types")).toBeVisible();

    // Click clear filters
    const clearButton = page.getByTestId("clear-filters");
    await expect(clearButton).toBeVisible();
    await clearButton.click();

    // Should show "Showing all files"
    await expect(page.getByText("Showing all files")).toBeVisible();
  });
});

test.describe("Help Dialog (Story 6.5 - AC4)", () => {
  test("should display help button in header", async ({ page }) => {
    await page.goto("/");

    // Check for help dialog trigger in header
    const helpTrigger = page.getByTestId("help-dialog-trigger");
    await expect(helpTrigger).toBeVisible();
  });

  test("should open help dialog when clicked", async ({ page }) => {
    await page.goto("/");

    // Click help button
    await page.getByTestId("help-dialog-trigger").click();

    // Dialog should open
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Help & About" })).toBeVisible();
  });

  test("should display version info in help dialog", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("help-dialog-trigger").click();

    // Should show version section
    await expect(page.getByRole("heading", { name: "Version Information" })).toBeVisible();
  });

  test("should display keyboard shortcuts in help dialog", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("help-dialog-trigger").click();

    // Should show keyboard shortcuts section
    await expect(page.getByText("Keyboard Shortcuts")).toBeVisible();
  });

  test("should display quick start guide", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("help-dialog-trigger").click();

    // Should show quick start section
    await expect(page.getByText("Quick Start")).toBeVisible();
  });

  test("should close help dialog", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("help-dialog-trigger").click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Close dialog using the close button
    await page.getByRole("button", { name: /close/i }).click();

    // Dialog should be closed
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});

test.describe("Settings Modal", () => {
  test("should display settings button in header", async ({ page }) => {
    await page.goto("/");

    const settingsTrigger = page.getByTestId("settings-trigger");
    await expect(settingsTrigger).toBeVisible();
  });

  test("should open settings modal when clicked", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("settings-trigger").click();

    // Settings dialog should open
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });
});
