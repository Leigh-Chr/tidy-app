/**
 * Vitest setup file for React component tests
 */

import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Configure React 19 act() environment
// This suppresses the "current testing environment is not configured to support act(...)" warning
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Mock scrollIntoView for Radix UI components (not implemented in jsdom)
Element.prototype.scrollIntoView = vi.fn();

// Mock Tauri API for tests
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(() => false), // Default to false for browser environment in tests
}));

// Mock Tauri dialog plugin for tests
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

// Mock Tauri webview API for drag-drop events
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: vi.fn(() => ({
    onDragDropEvent: vi.fn(() => Promise.resolve(() => {})),
  })),
}));

// Mock @tanstack/react-virtual for testing
// In JSDOM, scroll containers have 0 dimensions so virtualization doesn't work
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: vi.fn(({ count, estimateSize }) => {
    // Return all items without actual virtualization for tests
    const items = Array.from({ length: count }, (_, index) => ({
      index,
      key: index,
      start: index * 56,
      size: estimateSize(index),
      end: (index + 1) * 56,
      lane: 0,
    }));
    return {
      getVirtualItems: () => items,
      getTotalSize: () => items.reduce((acc, item) => acc + item.size, 0),
      scrollToIndex: vi.fn(),
      scrollToOffset: vi.fn(),
      measureElement: vi.fn(),
    };
  }),
}));
