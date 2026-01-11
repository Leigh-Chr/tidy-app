/**
 * Tests for formatting utilities
 */

import { describe, it, expect } from "vitest";
import { formatBytes } from "./format";

describe("formatBytes", () => {
  describe("zero and edge cases", () => {
    it("returns '0 B' for zero bytes", () => {
      expect(formatBytes(0)).toBe("0 B");
    });

    it("returns '0 B' for negative values", () => {
      expect(formatBytes(-100)).toBe("0 B");
      expect(formatBytes(-1024)).toBe("0 B");
    });
  });

  describe("bytes (B)", () => {
    it("formats single byte", () => {
      expect(formatBytes(1)).toBe("1 B");
    });

    it("formats bytes under 1KB", () => {
      expect(formatBytes(500)).toBe("500 B");
      expect(formatBytes(1023)).toBe("1023 B");
    });
  });

  describe("kilobytes (KB)", () => {
    it("formats exactly 1 KB", () => {
      expect(formatBytes(1024)).toBe("1 KB");
    });

    it("formats KB with decimal", () => {
      expect(formatBytes(1536)).toBe("1.5 KB");
    });

    it("formats KB without unnecessary decimal", () => {
      expect(formatBytes(2048)).toBe("2 KB");
    });

    it("formats KB close to 1 MB", () => {
      expect(formatBytes(1024 * 1023)).toBe("1023 KB");
    });
  });

  describe("megabytes (MB)", () => {
    it("formats exactly 1 MB", () => {
      expect(formatBytes(1024 * 1024)).toBe("1 MB");
    });

    it("formats MB with decimal", () => {
      expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
    });

    it("formats larger MB values", () => {
      expect(formatBytes(500 * 1024 * 1024)).toBe("500 MB");
    });
  });

  describe("gigabytes (GB)", () => {
    it("formats exactly 1 GB", () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe("1 GB");
    });

    it("formats GB with decimal", () => {
      expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe("2.5 GB");
    });
  });

  describe("terabytes (TB)", () => {
    it("formats exactly 1 TB", () => {
      expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe("1 TB");
    });

    it("formats large TB values", () => {
      expect(formatBytes(5 * 1024 * 1024 * 1024 * 1024)).toBe("5 TB");
    });

    it("caps at TB for extremely large values", () => {
      // 1 PB would be 1024 TB, but we cap at TB
      expect(formatBytes(1024 * 1024 * 1024 * 1024 * 1024)).toBe("1024 TB");
    });
  });
});
