/**
 * Tests for TemplateSelector component
 * Story 6.4 - Task 9
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TemplateSelector } from "./TemplateSelector";
import type { Template } from "@/lib/tauri";

const createMockTemplate = (overrides?: Partial<Template>): Template => ({
  id: "template-1",
  name: "Test Template",
  pattern: "{date}_{name}.{ext}",
  isDefault: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const mockTemplates: Template[] = [
  createMockTemplate({ id: "1", name: "Date Prefix", isDefault: true }),
  createMockTemplate({ id: "2", name: "Year Folder" }),
  createMockTemplate({ id: "3", name: "Custom Format" }),
];

describe("TemplateSelector", () => {
  describe("rendering", () => {
    it("renders with data-testid", () => {
      render(
        <TemplateSelector
          templates={mockTemplates}
          selectedId="1"
          onSelect={() => {}}
        />
      );

      expect(screen.getByTestId("template-selector")).toBeInTheDocument();
    });

    it("displays Template label", () => {
      render(
        <TemplateSelector
          templates={mockTemplates}
          selectedId="1"
          onSelect={() => {}}
        />
      );

      expect(screen.getByText("Template:")).toBeInTheDocument();
    });

    it("displays selected template name in trigger", () => {
      render(
        <TemplateSelector
          templates={mockTemplates}
          selectedId="1"
          onSelect={() => {}}
        />
      );

      expect(screen.getByText("Date Prefix")).toBeInTheDocument();
    });

    it("displays placeholder when no selection", () => {
      render(
        <TemplateSelector
          templates={mockTemplates}
          selectedId={null}
          onSelect={() => {}}
        />
      );

      expect(screen.getByText("Select template")).toBeInTheDocument();
    });
  });

  describe("selection", () => {
    it("updates displayed selection after change", async () => {
      const onSelect = vi.fn();

      const { rerender } = render(
        <TemplateSelector
          templates={mockTemplates}
          selectedId="1"
          onSelect={onSelect}
        />
      );

      expect(screen.getByText("Date Prefix")).toBeInTheDocument();

      // Simulate selection change via props
      rerender(
        <TemplateSelector
          templates={mockTemplates}
          selectedId="2"
          onSelect={onSelect}
        />
      );

      expect(screen.getByText("Year Folder")).toBeInTheDocument();
    });

    it("renders trigger with combobox role for accessibility", () => {
      render(
        <TemplateSelector
          templates={mockTemplates}
          selectedId="1"
          onSelect={() => {}}
        />
      );

      const trigger = screen.getByTestId("template-selector-trigger");
      expect(trigger).toHaveAttribute("role", "combobox");
    });

    it("has aria-expanded attribute on trigger", () => {
      render(
        <TemplateSelector
          templates={mockTemplates}
          selectedId="1"
          onSelect={() => {}}
        />
      );

      const trigger = screen.getByTestId("template-selector-trigger");
      expect(trigger).toHaveAttribute("aria-expanded");
    });
  });

  describe("disabled state", () => {
    it("disables selector when disabled prop is true", () => {
      render(
        <TemplateSelector
          templates={mockTemplates}
          selectedId="1"
          onSelect={() => {}}
          disabled={true}
        />
      );

      expect(screen.getByTestId("template-selector-trigger")).toBeDisabled();
    });

    it("disables selector when no templates available", () => {
      render(
        <TemplateSelector
          templates={[]}
          selectedId={null}
          onSelect={() => {}}
        />
      );

      expect(screen.getByTestId("template-selector-trigger")).toBeDisabled();
    });
  });

  describe("styling", () => {
    it("applies custom className", () => {
      render(
        <TemplateSelector
          templates={mockTemplates}
          selectedId="1"
          onSelect={() => {}}
          className="custom-class"
        />
      );

      expect(screen.getByTestId("template-selector")).toHaveClass("custom-class");
    });
  });
});
