/**
 * Tests for TemplateList component
 * Story 6.3 - AC2: Template List Display, AC5: Delete Template
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { TemplateList } from "./TemplateList";
import { useAppStore, type Template } from "@/stores/app-store";
import type { AppConfig } from "@/lib/tauri";

vi.mock("@tauri-apps/api/core");

const createTemplate = (overrides: Partial<Template> = {}): Template => ({
  id: "template-1",
  name: "Test Template",
  pattern: "{name}.{ext}",
  fileTypes: [],
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

describe("TemplateList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.getState().reset();
    // Set up config state
    useAppStore.setState({ config: mockConfig, configStatus: "success" });
  });

  describe("empty state", () => {
    it("shows empty state when no templates", () => {
      render(<TemplateList templates={[]} />);

      expect(screen.getByText(/no templates yet/i)).toBeInTheDocument();
      expect(screen.getByText(/create your first template/i)).toBeInTheDocument();
    });

    it("shows add template button when empty", () => {
      render(<TemplateList templates={[]} />);

      expect(screen.getByTestId("add-template-button")).toBeInTheDocument();
    });
  });

  describe("template count", () => {
    it("shows singular text for one template", () => {
      render(<TemplateList templates={[createTemplate()]} />);

      expect(screen.getByText("1 template")).toBeInTheDocument();
    });

    it("shows plural text for multiple templates", () => {
      render(
        <TemplateList
          templates={[
            createTemplate({ id: "1" }),
            createTemplate({ id: "2" }),
            createTemplate({ id: "3" }),
          ]}
        />
      );

      expect(screen.getByText("3 templates")).toBeInTheDocument();
    });
  });

  describe("template cards", () => {
    it("displays template name", () => {
      render(<TemplateList templates={[createTemplate({ name: "My Template" })]} />);

      expect(screen.getByText("My Template")).toBeInTheDocument();
    });

    it("displays template pattern", () => {
      render(<TemplateList templates={[createTemplate({ pattern: "{date}_{name}.{ext}" })]} />);

      expect(screen.getByText("{date}_{name}.{ext}")).toBeInTheDocument();
    });

    it("shows default badge for default template", () => {
      render(<TemplateList templates={[createTemplate({ isDefault: true })]} />);

      expect(screen.getByTestId("default-badge")).toBeInTheDocument();
      expect(screen.getByText("Default")).toBeInTheDocument();
    });

    it("shows file types badges", () => {
      render(
        <TemplateList
          templates={[createTemplate({ fileTypes: ["jpg", "png", "gif"] })]}
        />
      );

      expect(screen.getByText(".jpg")).toBeInTheDocument();
      expect(screen.getByText(".png")).toBeInTheDocument();
      expect(screen.getByText(".gif")).toBeInTheDocument();
    });

    it("truncates file types when more than 5", () => {
      render(
        <TemplateList
          templates={[
            createTemplate({
              fileTypes: ["jpg", "png", "gif", "webp", "svg", "bmp", "tiff"],
            }),
          ]}
        />
      );

      expect(screen.getByText("+2 more")).toBeInTheDocument();
    });
  });

  describe("template actions", () => {
    it("renders edit button for each template", () => {
      render(<TemplateList templates={[createTemplate({ id: "test-id" })]} />);

      expect(screen.getByTestId("edit-template-test-id")).toBeInTheDocument();
    });

    it("renders delete button for each template", () => {
      render(<TemplateList templates={[createTemplate({ id: "test-id" })]} />);

      expect(screen.getByTestId("delete-template-test-id")).toBeInTheDocument();
    });

    it("renders set default button for non-default template", () => {
      render(
        <TemplateList templates={[createTemplate({ id: "test-id", isDefault: false })]} />
      );

      expect(screen.getByTestId("set-default-test-id")).toBeInTheDocument();
    });

    it("does not render set default button for default template", () => {
      render(
        <TemplateList templates={[createTemplate({ id: "test-id", isDefault: true })]} />
      );

      expect(screen.queryByTestId("set-default-test-id")).not.toBeInTheDocument();
    });
  });

  describe("delete confirmation", () => {
    it("shows confirmation dialog when delete is clicked", async () => {
      render(<TemplateList templates={[createTemplate({ id: "test-id" })]} />);

      fireEvent.click(screen.getByTestId("delete-template-test-id"));

      await waitFor(() => {
        expect(screen.getByTestId("delete-confirmation")).toBeInTheDocument();
      });
    });

    it("shows warning message in confirmation dialog", async () => {
      render(<TemplateList templates={[createTemplate({ id: "test-id" })]} />);

      fireEvent.click(screen.getByTestId("delete-template-test-id"));

      await waitFor(() => {
        expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
      });
    });

    it("closes dialog when cancel is clicked", async () => {
      render(<TemplateList templates={[createTemplate({ id: "test-id" })]} />);

      fireEvent.click(screen.getByTestId("delete-template-test-id"));

      await waitFor(() => {
        expect(screen.getByTestId("cancel-delete")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("cancel-delete"));

      await waitFor(() => {
        expect(screen.queryByTestId("delete-confirmation")).not.toBeInTheDocument();
      });
    });

    it("calls deleteTemplate when confirm is clicked", async () => {
      const template = createTemplate({ id: "test-id" });
      const configWithTemplate = {
        ...mockConfig,
        templates: [template],
      };
      useAppStore.setState({ config: configWithTemplate });
      vi.mocked(invoke).mockResolvedValue(undefined);

      render(<TemplateList templates={[template]} />);

      fireEvent.click(screen.getByTestId("delete-template-test-id"));

      await waitFor(() => {
        expect(screen.getByTestId("confirm-delete")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("confirm-delete"));

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith("save_config", expect.any(Object));
      });
    });
  });

  describe("set default", () => {
    it("calls setDefaultTemplate when set default is clicked", async () => {
      const template = createTemplate({ id: "test-id", isDefault: false });
      const configWithTemplate = {
        ...mockConfig,
        templates: [template],
      };
      useAppStore.setState({ config: configWithTemplate });
      vi.mocked(invoke).mockResolvedValue(undefined);

      render(<TemplateList templates={[template]} />);

      fireEvent.click(screen.getByTestId("set-default-test-id"));

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith("save_config", expect.any(Object));
      });
    });
  });

  describe("edit template", () => {
    it("shows template editor when edit is clicked", async () => {
      render(<TemplateList templates={[createTemplate({ id: "test-id" })]} />);

      fireEvent.click(screen.getByTestId("edit-template-test-id"));

      await waitFor(() => {
        expect(screen.getByTestId("template-editor")).toBeInTheDocument();
      });
    });
  });

  describe("add template", () => {
    it("shows template editor when add is clicked", async () => {
      render(<TemplateList templates={[]} />);

      fireEvent.click(screen.getByTestId("add-template-button"));

      await waitFor(() => {
        expect(screen.getByTestId("template-editor")).toBeInTheDocument();
      });
    });
  });
});
