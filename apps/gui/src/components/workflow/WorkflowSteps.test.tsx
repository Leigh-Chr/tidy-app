/**
 * Tests for WorkflowSteps and WorkflowDots components (TEST-002)
 *
 * Tests the workflow step indicators that show progress through the wizard.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkflowSteps, WorkflowDots } from "./WorkflowSteps";

describe("WorkflowSteps", () => {
  describe("rendering", () => {
    it("should render all three steps", () => {
      render(<WorkflowSteps currentStep="select" />);

      expect(screen.getByRole("navigation")).toBeInTheDocument();
      // All steps render as buttons
      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(3);
    });

    it("should apply custom className", () => {
      render(<WorkflowSteps currentStep="select" className="custom-class" />);

      expect(screen.getByRole("navigation")).toHaveClass("custom-class");
    });

    it("should have proper accessibility labels", () => {
      render(<WorkflowSteps currentStep="configure" />);

      const nav = screen.getByRole("navigation");
      expect(nav).toHaveAttribute("aria-label", "Workflow progress");
    });
  });

  describe("step states", () => {
    it("should mark first step as current when on select", () => {
      render(<WorkflowSteps currentStep="select" />);

      const selectStep = screen.getByLabelText(/Step 1: Select.*current/);
      expect(selectStep).toHaveAttribute("aria-current", "step");
    });

    it("should mark second step as current when on configure", () => {
      render(<WorkflowSteps currentStep="configure" />);

      const configureStep = screen.getByLabelText(/Step 2: Configure.*current/);
      expect(configureStep).toHaveAttribute("aria-current", "step");

      // First step should be completed
      const selectStep = screen.getByLabelText(/Step 1: Select.*completed/);
      expect(selectStep).not.toHaveAttribute("aria-current", "step");
    });

    it("should mark third step as current when on preview", () => {
      render(<WorkflowSteps currentStep="preview" />);

      const previewStep = screen.getByLabelText(/Step 3: Preview.*current/);
      expect(previewStep).toHaveAttribute("aria-current", "step");

      // First two steps should be completed
      expect(screen.getByLabelText(/Step 1: Select.*completed/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Step 2: Configure.*completed/)).toBeInTheDocument();
    });

    it("should disable future steps", () => {
      render(<WorkflowSteps currentStep="select" />);

      // Future steps are disabled
      const buttons = screen.getAllByRole("button");
      expect(buttons[1]).toBeDisabled(); // Configure
      expect(buttons[2]).toBeDisabled(); // Preview
    });
  });

  describe("navigation", () => {
    it("should call onStepClick when clicking completed step", async () => {
      const user = userEvent.setup();
      const handleStepClick = vi.fn();

      render(
        <WorkflowSteps currentStep="configure" onStepClick={handleStepClick} />
      );

      const selectStep = screen.getByLabelText(/Step 1: Select.*completed/);
      await user.click(selectStep);

      expect(handleStepClick).toHaveBeenCalledWith("select");
    });

    it("should not call onStepClick when clicking current step", async () => {
      const user = userEvent.setup();
      const handleStepClick = vi.fn();

      render(
        <WorkflowSteps currentStep="configure" onStepClick={handleStepClick} />
      );

      const configureStep = screen.getByLabelText(/Step 2: Configure.*current/);
      await user.click(configureStep);

      expect(handleStepClick).not.toHaveBeenCalled();
    });

    it("should not call onStepClick when clicking future step", async () => {
      const user = userEvent.setup();
      const handleStepClick = vi.fn();

      render(
        <WorkflowSteps currentStep="select" onStepClick={handleStepClick} />
      );

      const previewStep = screen.getByLabelText(/Step 3: Preview/);
      await user.click(previewStep);

      expect(handleStepClick).not.toHaveBeenCalled();
    });

    it("should enable clicking completed steps only when onStepClick is provided", () => {
      const { rerender } = render(<WorkflowSteps currentStep="preview" />);

      // Without onStepClick, completed steps should be disabled
      const selectStepWithoutHandler = screen.getByLabelText(/Step 1: Select.*completed/);
      expect(selectStepWithoutHandler).toBeDisabled();

      // With onStepClick, completed steps should be enabled
      rerender(<WorkflowSteps currentStep="preview" onStepClick={vi.fn()} />);
      const selectStepWithHandler = screen.getByLabelText(/Step 1: Select.*completed/);
      expect(selectStepWithHandler).not.toBeDisabled();
    });

    it("should allow navigating back through all completed steps", async () => {
      const user = userEvent.setup();
      const handleStepClick = vi.fn();

      render(
        <WorkflowSteps currentStep="preview" onStepClick={handleStepClick} />
      );

      // Can click Select
      await user.click(screen.getByLabelText(/Step 1: Select.*completed/));
      expect(handleStepClick).toHaveBeenCalledWith("select");

      // Can click Configure
      await user.click(screen.getByLabelText(/Step 2: Configure.*completed/));
      expect(handleStepClick).toHaveBeenCalledWith("configure");
    });
  });
});

describe("WorkflowDots", () => {
  describe("rendering", () => {
    it("should render three dots", () => {
      render(<WorkflowDots currentStep="select" />);

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(3);
    });

    it("should apply custom className", () => {
      render(<WorkflowDots currentStep="select" className="custom-dots" />);

      expect(screen.getByRole("navigation")).toHaveClass("custom-dots");
    });

    it("should have proper accessibility attributes", () => {
      render(<WorkflowDots currentStep="configure" />);

      const nav = screen.getByRole("navigation");
      expect(nav).toHaveAttribute("aria-label", "Workflow progress");

      // Current step should have aria-current
      const dots = screen.getAllByRole("button");
      expect(dots[1]).toHaveAttribute("aria-current", "step");
    });
  });

  describe("step states", () => {
    it("should mark correct step as current", () => {
      render(<WorkflowDots currentStep="configure" />);

      const dots = screen.getAllByRole("button");
      expect(dots[1]).toHaveAttribute("aria-current", "step");
    });

    it("should show all previous steps as completed when on preview", () => {
      render(<WorkflowDots currentStep="preview" />);

      const dots = screen.getAllByRole("button");
      // Without onStepClick, completed dots should still be disabled
      expect(dots[0]).toBeDisabled(); // Select
      expect(dots[1]).toBeDisabled(); // Configure
      expect(dots[2]).toHaveAttribute("aria-current", "step"); // Preview (current)
    });
  });

  describe("navigation", () => {
    it("should call onStepClick when clicking completed dots", async () => {
      const user = userEvent.setup();
      const handleStepClick = vi.fn();

      render(<WorkflowDots currentStep="preview" onStepClick={handleStepClick} />);

      const selectDot = screen.getByLabelText("Step 1: Select");
      await user.click(selectDot);

      expect(handleStepClick).toHaveBeenCalledWith("select");
    });

    it("should not trigger navigation when clicking future dots", async () => {
      const user = userEvent.setup();
      const handleStepClick = vi.fn();

      render(<WorkflowDots currentStep="select" onStepClick={handleStepClick} />);

      const previewDot = screen.getByLabelText("Step 3: Preview");
      await user.click(previewDot);

      expect(handleStepClick).not.toHaveBeenCalled();
    });
  });
});
