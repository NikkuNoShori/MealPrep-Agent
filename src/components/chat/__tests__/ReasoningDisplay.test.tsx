/**
 * MOP-0020 Phase 4 — Unit tests for ReasoningDisplay
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReasoningDisplay } from "../ReasoningDisplay";
import type { ToolStep } from "../ChatInterface";

// ── Helpers ───────────────────────────────────────────────────────────────────

function step(overrides: Partial<ToolStep> = {}): ToolStep {
  return {
    name: "search_recipes",
    label: "Searching your recipes…",
    done: false,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ReasoningDisplay", () => {
  it("renders nothing when steps array is empty", () => {
    const { container } = render(<ReasoningDisplay steps={[]} isStreaming={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the panel when there is at least one step", () => {
    render(<ReasoningDisplay steps={[step()]} isStreaming={true} />);
    expect(screen.getByTestId("reasoning-panel")).toBeInTheDocument();
  });

  it("shows live step label in header while streaming and step is not done", () => {
    const steps = [step({ label: "Searching your recipes…", done: false })];
    render(<ReasoningDisplay steps={steps} isStreaming={true} />);
    expect(screen.getByTestId("reasoning-panel")).toHaveTextContent("Searching your recipes…");
  });

  it("shows 'Ran N steps' in header when all steps are done", () => {
    const steps = [
      step({ done: true, ok: true, durationMs: 120 }),
      step({ name: "get_meal_plan", label: "Checking your meal plan…", done: true, ok: true, durationMs: 80 }),
    ];
    render(<ReasoningDisplay steps={steps} isStreaming={false} />);
    expect(screen.getByTestId("reasoning-panel")).toHaveTextContent("Ran 2 steps");
  });

  it("starts expanded while streaming", () => {
    render(<ReasoningDisplay steps={[step()]} isStreaming={true} />);
    expect(screen.getByTestId("reasoning-steps")).toBeInTheDocument();
  });

  it("collapses when isStreaming transitions from true to false", () => {
    const { rerender } = render(<ReasoningDisplay steps={[step({ done: true, ok: true })]} isStreaming={true} />);
    expect(screen.getByTestId("reasoning-steps")).toBeInTheDocument();

    rerender(<ReasoningDisplay steps={[step({ done: true, ok: true })]} isStreaming={false} />);
    expect(screen.queryByTestId("reasoning-steps")).not.toBeInTheDocument();
  });

  it("expands again on toggle click after auto-collapse", () => {
    const { rerender } = render(<ReasoningDisplay steps={[step({ done: true, ok: true })]} isStreaming={true} />);
    rerender(<ReasoningDisplay steps={[step({ done: true, ok: true })]} isStreaming={false} />);
    // Collapsed — click toggle
    fireEvent.click(screen.getByTestId("reasoning-toggle"));
    expect(screen.getByTestId("reasoning-steps")).toBeInTheDocument();
  });

  it("collapses again on a second toggle click", () => {
    const steps = [step({ done: true, ok: true })];
    const { rerender } = render(<ReasoningDisplay steps={steps} isStreaming={true} />);
    rerender(<ReasoningDisplay steps={steps} isStreaming={false} />);
    fireEvent.click(screen.getByTestId("reasoning-toggle")); // expand
    fireEvent.click(screen.getByTestId("reasoning-toggle")); // collapse
    expect(screen.queryByTestId("reasoning-steps")).not.toBeInTheDocument();
  });

  it("shows duration badge for completed steps", () => {
    const steps = [step({ done: true, ok: true, durationMs: 350 })];
    render(<ReasoningDisplay steps={steps} isStreaming={false} />);
    // Panel is collapsed — expand it first
    fireEvent.click(screen.getByTestId("reasoning-toggle"));
    expect(screen.getByText("350ms")).toBeInTheDocument();
  });

  it("formats duration in seconds for long-running steps", () => {
    const steps = [step({ done: true, ok: true, durationMs: 2300 })];
    render(<ReasoningDisplay steps={steps} isStreaming={false} />);
    fireEvent.click(screen.getByTestId("reasoning-toggle"));
    expect(screen.getByText("2.3s")).toBeInTheDocument();
  });

  it("renders each step label in the list", () => {
    const steps = [
      step({ label: "Searching your recipes…", done: true, ok: true, durationMs: 100 }),
      step({ name: "get_grocery_list", label: "Loading grocery list…", done: true, ok: true, durationMs: 50 }),
    ];
    render(<ReasoningDisplay steps={steps} isStreaming={false} />);
    fireEvent.click(screen.getByTestId("reasoning-toggle")); // expand collapsed panel
    expect(screen.getByText("Searching your recipes…")).toBeInTheDocument();
    expect(screen.getByText("Loading grocery list…")).toBeInTheDocument();
  });

  it("starts already collapsed on a finished message (isStreaming=false from the start)", () => {
    const steps = [step({ done: true, ok: true, durationMs: 200 })];
    render(<ReasoningDisplay steps={steps} isStreaming={false} />);
    // Should be collapsed — steps list not visible
    expect(screen.queryByTestId("reasoning-steps")).not.toBeInTheDocument();
    // Header should still show "Ran 1 step"
    expect(screen.getByTestId("reasoning-panel")).toHaveTextContent("Ran 1 step");
  });

  it("toggle button has aria-expanded reflecting open state", () => {
    const steps = [step({ done: true, ok: true })];
    render(<ReasoningDisplay steps={steps} isStreaming={true} />);
    const toggle = screen.getByTestId("reasoning-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
