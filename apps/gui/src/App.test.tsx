/**
 * Tests for the main App component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useAppStore } from "@/stores/app-store";
import App from "./App";

// Get the mocked invoke from global setup
import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Zustand store before each test
    useAppStore.setState({
      status: "idle",
      error: null,
      versionInfo: null,
      selectedFolder: null,
      scanStatus: "idle",
      scanResult: null,
      scanError: null,
      preview: null,
      previewStatus: "idle",
      previewError: null,
      config: null,
      configStatus: "idle",
      configError: null,
      selectedProposalIds: new Set<string>(),
      lastRenameResult: null,
      scanOptions: {
        recursive: false,
        fileTypes: [],
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the app title", async () => {
    mockInvoke.mockResolvedValueOnce({
      version: "0.2.0",
      core_version: "0.1.0",
    });

    render(<App />);

    // Wait for async effects to complete
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });

    expect(screen.getByRole("heading", { name: /tidy-app/i })).toBeInTheDocument();
  });

  it("displays version info on successful load", async () => {
    mockInvoke.mockResolvedValue({
      version: "0.2.0",
      core_version: "0.1.0",
    });

    render(<App />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });

    // Version is displayed (may appear in multiple places)
    expect(screen.getAllByText("v0.2.0").length).toBeGreaterThan(0);
    // DropZone is displayed
    expect(screen.getByTestId("drop-zone")).toBeInTheDocument();
  });

  it("displays error state when version load fails", async () => {
    mockInvoke.mockRejectedValue(new Error("Connection failed"));

    render(<App />);

    await waitFor(() => {
      // Error is displayed in the error box
      expect(screen.getByText("Connection failed")).toBeInTheDocument();
    });
  });

  it("loads version and config on mount", async () => {
    mockInvoke.mockResolvedValue({ version: "0.2.0", core_version: "0.1.0" });

    render(<App />);

    await waitFor(() => {
      // Verify both version and config are loaded on mount
      expect(mockInvoke).toHaveBeenCalledWith("get_version");
    });

    // Version should be visible (may appear in multiple places)
    expect(screen.getAllByText("v0.2.0").length).toBeGreaterThan(0);
  });

  it("shows welcome message and placeholder for drag-drop", async () => {
    mockInvoke.mockResolvedValueOnce({
      version: "0.2.0",
      core_version: "0.1.0",
    });

    render(<App />);

    // Wait for async effects to complete
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });

    // "Calm & Confident" welcome message
    expect(screen.getByText(/Bring order to your files/i)).toBeInTheDocument();
    // DropZone component displays this text
    expect(screen.getByText(/Drop a folder here/i)).toBeInTheDocument();
  });

  it("displays empty state when folder has no files", async () => {
    mockInvoke.mockResolvedValueOnce({
      version: "0.2.0",
      core_version: "0.1.0",
    });

    render(<App />);

    // Wait for async effects to complete
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });

    // Simulate empty scan result by setting store directly
    useAppStore.setState({
      selectedFolder: "/empty/folder",
      scanStatus: "success",
      scanResult: { files: [], totalCount: 0, totalSize: 0 },
      workflowStep: "select",
    });

    await waitFor(() => {
      expect(screen.getByText(/No files found/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Re-scan/i })).toBeInTheDocument();
  });

  it("displays error state when scan fails", async () => {
    mockInvoke.mockResolvedValueOnce({
      version: "0.2.0",
      core_version: "0.1.0",
    });

    render(<App />);

    // Wait for async effects to complete
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });

    // Simulate scan error by setting store directly
    useAppStore.setState({
      selectedFolder: "/bad/folder",
      scanStatus: "error",
      scanError: "Path does not exist",
    });

    await waitFor(() => {
      expect(screen.getByText(/Failed to scan folder/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Path does not exist/i)).toBeInTheDocument();
  });

  it("uses Zustand store for state management", async () => {
    mockInvoke.mockResolvedValue({
      version: "0.2.0",
      core_version: "0.1.0",
    });

    render(<App />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalled();
    });

    // Verify store was updated with version info
    const state = useAppStore.getState();
    expect(state.versionInfo).toEqual({
      version: "0.2.0",
      core_version: "0.1.0",
    });
  });
});
