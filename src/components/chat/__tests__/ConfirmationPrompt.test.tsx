/**
 * MOP-0008 Step 8 — Component tests for the destructive-tool confirmation
 * prompt. Validates the visual contract (summary + tool name rendered,
 * confirm/cancel callbacks fire, in-flight state disables both buttons +
 * swaps the confirm label to "Confirming…").
 *
 * NOTE: This is the first component test in the repo. Test infra is
 * already wired (`@testing-library/react` + `jsdom` from MOP-0005 Phase 0).
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmationPrompt } from "../ConfirmationPrompt";
import type { PendingConfirmation } from "../../../services/api";

const samplePending: PendingConfirmation = {
  tool: "delete_recipe",
  args: { recipe_id: "r-1" },
  summary: 'Delete "Classic Carbonara" from your saved recipes?',
  idempotencyKey: "idem-abc-123",
};

describe("ConfirmationPrompt", () => {
  it("renders the summary and the tool name", () => {
    render(
      <ConfirmationPrompt
        pendingConfirmation={samplePending}
        isConfirming={false}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByText(samplePending.summary)).toBeInTheDocument();
    expect(screen.getByText(samplePending.tool)).toBeInTheDocument();
    expect(screen.getByText(/confirm action/i)).toBeInTheDocument();
  });

  it("invokes onConfirm when the Confirm button is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmationPrompt
        pendingConfirmation={samplePending}
        isConfirming={false}
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: `Confirm ${samplePending.tool}` }),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("invokes onCancel when the Cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmationPrompt
        pendingConfirmation={samplePending}
        isConfirming={false}
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /cancel pending action/i }),
    );
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows 'Confirming…' and disables both buttons when isConfirming=true", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmationPrompt
        pendingConfirmation={samplePending}
        isConfirming={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText(/confirming/i)).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", {
      name: `Confirm ${samplePending.tool}`,
    });
    const cancelBtn = screen.getByRole("button", {
      name: /cancel pending action/i,
    });
    expect(confirmBtn).toBeDisabled();
    expect(cancelBtn).toBeDisabled();

    // Disabled buttons should not fire handlers in jsdom.
    fireEvent.click(confirmBtn);
    fireEvent.click(cancelBtn);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("exposes accessible alertdialog role for assistive tech", () => {
    render(
      <ConfirmationPrompt
        pendingConfirmation={samplePending}
        isConfirming={false}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole("alertdialog")).toHaveAccessibleName(
      /confirm destructive action/i,
    );
  });
});
