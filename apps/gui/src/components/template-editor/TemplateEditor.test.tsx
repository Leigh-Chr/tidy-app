/**
 * Tests for TemplateEditor component
 * Story 6.3 - AC3: Create New Template, AC4: Edit Existing Template
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { TemplateEditor } from "./TemplateEditor";
import { useAppStore, type Template } from "@/stores/app-store";
import type { AppConfig } from "@/lib/tauri";

vi.mock("@tauri-apps/api/core");

const createTemplate = (overrides: Partial<Template> = {}): Template => ({
  id: "template-1",
  name: "Test Template",
  pattern: "{name}.{ext}",
  fileTypes: ["jpg"],
  isDefault: false,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  ...overrides,
});

const mockConfig: AppConfig = {
  version: 1,
  templates: [],
  folderStructures: [],
  preferences: {
    defaultOutputFormat: "table",
    colorOutput: true,
    confirmBeforeApply: true,
    recursiveScan: false,
  },
  recentFolders: [],
  ollama: {
    enabled: false,
    provider: "ollama",
    baseUrl: "http://localhost:11434",
    timeout: 30000,
    models: {},
    fileTypes: {
      preset: "documents",
      includedExtensions: [],
      excludedExtensions: [],
      skipWithMetadata: true,
    },
    visionEnabled: false,
    skipImagesWithExif: true,
    maxImageSize: 20 * 1024 * 1024,
    offlineMode: "auto",
    healthCheckTimeout: 5000,
    openai: {
      apiKey: "",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      visionModel: "gpt-4o",
    },
  },
};

describe("TemplateEditor", () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.getState().reset();
    useAppStore.setState({ config: mockConfig, configStatus: "success" });
  });

  describe("create mode", () => {
    it("shows 'New Template' title when creating", () => {
      render(<TemplateEditor onClose={mockOnClose} />);

      expect(screen.getByText("New Template")).toBeInTheDocument();
    });

    it("shows 'Create Template' button when creating", () => {
      render(<TemplateEditor onClose={mockOnClose} />);

      expect(screen.getByTestId("save-button")).toHaveTextContent("Create Template");
    });

    it("has default pattern value", () => {
      render(<TemplateEditor onClose={mockOnClose} />);

      const patternInput = screen.getByTestId("template-pattern-input") as HTMLInputElement;
      expect(patternInput.value).toBe("{name}_{date:YYYY-MM-DD}.{ext}");
    });

    it("has empty name field", () => {
      render(<TemplateEditor onClose={mockOnClose} />);

      const nameInput = screen.getByTestId("template-name-input") as HTMLInputElement;
      expect(nameInput.value).toBe("");
    });
  });

  describe("edit mode", () => {
    it("shows 'Edit Template' title when editing", () => {
      render(<TemplateEditor template={createTemplate()} onClose={mockOnClose} />);

      expect(screen.getByText("Edit Template")).toBeInTheDocument();
    });

    it("shows 'Save Changes' button when editing", () => {
      render(<TemplateEditor template={createTemplate()} onClose={mockOnClose} />);

      expect(screen.getByTestId("save-button")).toHaveTextContent("Save Changes");
    });

    it("populates name from template", () => {
      render(
        <TemplateEditor
          template={createTemplate({ name: "My Template" })}
          onClose={mockOnClose}
        />
      );

      const nameInput = screen.getByTestId("template-name-input") as HTMLInputElement;
      expect(nameInput.value).toBe("My Template");
    });

    it("populates pattern from template", () => {
      render(
        <TemplateEditor
          template={createTemplate({ pattern: "{date}_{name}.{ext}" })}
          onClose={mockOnClose}
        />
      );

      const patternInput = screen.getByTestId("template-pattern-input") as HTMLInputElement;
      expect(patternInput.value).toBe("{date}_{name}.{ext}");
    });

    it("populates file types from template", () => {
      render(
        <TemplateEditor
          template={createTemplate({ fileTypes: ["jpg", "png"] })}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText(".jpg")).toBeInTheDocument();
      expect(screen.getByText(".png")).toBeInTheDocument();
    });
  });

  describe("form validation", () => {
    it("shows error when name is empty", async () => {
      render(<TemplateEditor onClose={mockOnClose} />);

      // Clear default pattern and add a valid one
      const patternInput = screen.getByTestId("template-pattern-input");
      fireEvent.change(patternInput, { target: { value: "{name}.{ext}" } });

      // Try to save without name
      fireEvent.click(screen.getByTestId("save-button"));

      await waitFor(() => {
        expect(screen.getByTestId("name-error")).toBeInTheDocument();
        expect(screen.getByText("Name is required")).toBeInTheDocument();
      });
    });

    it("shows error when pattern is empty", async () => {
      render(<TemplateEditor onClose={mockOnClose} />);

      // Fill name but clear pattern
      const nameInput = screen.getByTestId("template-name-input");
      const patternInput = screen.getByTestId("template-pattern-input");
      fireEvent.change(nameInput, { target: { value: "Test" } });
      fireEvent.change(patternInput, { target: { value: "" } });

      fireEvent.click(screen.getByTestId("save-button"));

      await waitFor(() => {
        expect(screen.getByTestId("pattern-error")).toBeInTheDocument();
        expect(screen.getByText("Pattern is required")).toBeInTheDocument();
      });
    });

    it("shows error when pattern has no placeholders", async () => {
      render(<TemplateEditor onClose={mockOnClose} />);

      const nameInput = screen.getByTestId("template-name-input");
      const patternInput = screen.getByTestId("template-pattern-input");
      fireEvent.change(nameInput, { target: { value: "Test" } });
      fireEvent.change(patternInput, { target: { value: "static_name.txt" } });

      fireEvent.click(screen.getByTestId("save-button"));

      await waitFor(() => {
        expect(screen.getByTestId("pattern-error")).toBeInTheDocument();
        expect(screen.getByText(/must contain at least one placeholder/i)).toBeInTheDocument();
      });
    });
  });

  describe("live preview", () => {
    it("shows pattern preview section", () => {
      render(<TemplateEditor onClose={mockOnClose} />);

      expect(screen.getByTestId("pattern-preview")).toBeInTheDocument();
    });

    it("shows example input file", () => {
      render(<TemplateEditor onClose={mockOnClose} />);

      expect(screen.getByText(/vacation_photo_2024\.jpg/i)).toBeInTheDocument();
    });

    it("updates preview when pattern changes", async () => {
      render(<TemplateEditor onClose={mockOnClose} />);

      const patternInput = screen.getByTestId("template-pattern-input");
      fireEvent.change(patternInput, { target: { value: "{name}_renamed.{ext}" } });

      await waitFor(() => {
        const preview = screen.getByTestId("preview-output");
        expect(preview).toHaveTextContent("vacation_photo_2024_renamed.jpg");
      });
    });

    it("shows date formatting in preview", async () => {
      render(<TemplateEditor onClose={mockOnClose} />);

      const patternInput = screen.getByTestId("template-pattern-input");
      fireEvent.change(patternInput, { target: { value: "{date:YYYY-MM-DD}_{name}.{ext}" } });

      await waitFor(() => {
        const preview = screen.getByTestId("preview-output");
        expect(preview).toHaveTextContent("2024-07-15_vacation_photo_2024.jpg");
      });
    });
  });

  describe("file types management", () => {
    it("adds file type when button is clicked", async () => {
      render(<TemplateEditor onClose={mockOnClose} />);

      const input = screen.getByTestId("file-type-input");
      fireEvent.change(input, { target: { value: "pdf" } });
      fireEvent.click(screen.getByTestId("add-file-type"));

      await waitFor(() => {
        expect(screen.getByText(".pdf")).toBeInTheDocument();
      });
    });

    it("adds file type on Enter key", async () => {
      render(<TemplateEditor onClose={mockOnClose} />);

      const input = screen.getByTestId("file-type-input");
      fireEvent.change(input, { target: { value: "doc" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(screen.getByText(".doc")).toBeInTheDocument();
      });
    });

    it("removes leading dot from file type", async () => {
      render(<TemplateEditor onClose={mockOnClose} />);

      const input = screen.getByTestId("file-type-input");
      fireEvent.change(input, { target: { value: ".png" } });
      fireEvent.click(screen.getByTestId("add-file-type"));

      await waitFor(() => {
        expect(screen.getByText(".png")).toBeInTheDocument();
      });
    });

    it("removes file type when x is clicked", async () => {
      render(
        <TemplateEditor
          template={createTemplate({ fileTypes: ["jpg", "png"] })}
          onClose={mockOnClose}
        />
      );

      fireEvent.click(screen.getByTestId("remove-file-type-jpg"));

      await waitFor(() => {
        expect(screen.queryByText(".jpg")).not.toBeInTheDocument();
        expect(screen.getByText(".png")).toBeInTheDocument();
      });
    });

    it("does not add duplicate file types", async () => {
      render(
        <TemplateEditor
          template={createTemplate({ fileTypes: ["jpg"] })}
          onClose={mockOnClose}
        />
      );

      const input = screen.getByTestId("file-type-input");
      fireEvent.change(input, { target: { value: "jpg" } });
      fireEvent.click(screen.getByTestId("add-file-type"));

      // Should still only have one .jpg
      const fileTypesList = screen.getByTestId("file-types-list");
      const jpgElements = fileTypesList.querySelectorAll("span");
      const jpgCount = Array.from(jpgElements).filter((el) =>
        el.textContent?.includes(".jpg")
      ).length;
      expect(jpgCount).toBe(1);
    });
  });

  describe("close behavior", () => {
    it("calls onClose when close button is clicked", () => {
      render(<TemplateEditor onClose={mockOnClose} />);

      fireEvent.click(screen.getByTestId("close-editor"));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when cancel button is clicked", () => {
      render(<TemplateEditor onClose={mockOnClose} />);

      fireEvent.click(screen.getByTestId("cancel-button"));

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("save behavior", () => {
    it("calls addTemplate when creating new template", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      render(<TemplateEditor onClose={mockOnClose} />);

      const nameInput = screen.getByTestId("template-name-input");
      fireEvent.change(nameInput, { target: { value: "New Template" } });

      fireEvent.click(screen.getByTestId("save-button"));

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith("save_config", expect.any(Object));
      });
    });

    it("calls updateTemplate when editing existing template", async () => {
      const template = createTemplate({ id: "existing-id" });
      const configWithTemplate = {
        ...mockConfig,
        templates: [template],
      };
      useAppStore.setState({ config: configWithTemplate });
      vi.mocked(invoke).mockResolvedValue(undefined);

      render(<TemplateEditor template={template} onClose={mockOnClose} />);

      const nameInput = screen.getByTestId("template-name-input");
      fireEvent.change(nameInput, { target: { value: "Updated Name" } });

      fireEvent.click(screen.getByTestId("save-button"));

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith("save_config", expect.any(Object));
      });
    });

    it("calls onClose after successful save", async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      render(<TemplateEditor onClose={mockOnClose} />);

      const nameInput = screen.getByTestId("template-name-input");
      fireEvent.change(nameInput, { target: { value: "New Template" } });

      fireEvent.click(screen.getByTestId("save-button"));

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it("disables buttons during save", async () => {
      // Make invoke hang to test saving state
      vi.mocked(invoke).mockImplementation(() => new Promise(() => {}));
      useAppStore.setState({ configStatus: "saving" });

      render(<TemplateEditor onClose={mockOnClose} />);

      expect(screen.getByTestId("save-button")).toBeDisabled();
      expect(screen.getByTestId("cancel-button")).toBeDisabled();
    });

    it("shows 'Saving...' text during save", async () => {
      useAppStore.setState({ configStatus: "saving" });

      render(<TemplateEditor onClose={mockOnClose} />);

      expect(screen.getByTestId("save-button")).toHaveTextContent("Saving...");
    });
  });

  describe("placeholder documentation", () => {
    it("shows available placeholders hint", () => {
      render(<TemplateEditor onClose={mockOnClose} />);

      expect(screen.getByText(/available placeholders/i)).toBeInTheDocument();
      expect(screen.getByText(/{name}/)).toBeInTheDocument();
      expect(screen.getByText(/{ext}/)).toBeInTheDocument();
      expect(screen.getByText(/{date}/)).toBeInTheDocument();
    });
  });
});
