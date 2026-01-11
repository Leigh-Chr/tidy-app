/**
 * Tests for the main App component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    // Core version is displayed (unique - only in the status section)
    expect(screen.getByText("0.1.0")).toBeInTheDocument();
    expect(screen.getByText("Core version:")).toBeInTheDocument();
  });

  it("displays error state when version load fails", async () => {
    mockInvoke.mockRejectedValue(new Error("Connection failed"));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Error")).toBeInTheDocument();
    });

    expect(screen.getByText("Connection failed")).toBeInTheDocument();
  });

  it("calls loadVersion on refresh button click", async () => {
    const user = userEvent.setup();
    let callCount = 0;
    mockInvoke.mockImplementation(() => {
      callCount++;
      return Promise.resolve({ version: "0.2.0", core_version: "0.1.0" });
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    const initialCalls = callCount;
    const refreshButton = screen.getByRole("button", { name: /refresh version/i });
    await user.click(refreshButton);

    await waitFor(() => {
      expect(callCount).toBe(initialCalls + 1);
    });
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

    expect(screen.getByText(/Welcome to tidy-app/i)).toBeInTheDocument();
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
    });

    await waitFor(() => {
      expect(screen.getByText(/No files found/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Try Another Folder/i })).toBeInTheDocument();
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
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    // Verify store was updated
    const state = useAppStore.getState();
    expect(state.status).toBe("success");
    expect(state.versionInfo).toEqual({
      version: "0.2.0",
      core_version: "0.1.0",
    });
  });
});
