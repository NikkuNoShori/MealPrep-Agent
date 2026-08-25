/**
 * Regression test for a state bug reported directly by the maintainer:
 * clicking a specific day's "+Add" button (e.g. Monday Breakfast) opens
 * this modal to assign the chosen recipe(s) to a plan — but the modal
 * never pre-selected the meal-type slot the user had already chosen via
 * that +Add click, forcing a redundant re-selection and showing a false
 * "unassigned" state on open. Root cause: `defaultSlot` was destructured
 * as `_defaultSlot` and discarded; the init effect hardcoded `slot: null`
 * for every recipe regardless of what was passed in.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DayAssignmentModal from "../DayAssignmentModal";
import type { SelectedRecipeInfo } from "../recipeTypes";

const recipe: SelectedRecipeInfo = {
  recipeId: "r-1",
  recipeName: "Easy Cheesy Bread",
  servings: 4,
};

const weekDates = [new Date("2026-03-16T00:00:00Z"), new Date("2026-03-17T00:00:00Z")];

describe("DayAssignmentModal", () => {
  it("pre-selects the slot the user already chose via the originating +Add click", () => {
    render(
      <DayAssignmentModal
        open={true}
        recipes={[recipe]}
        weekDates={weekDates}
        defaultDate="2026-03-16"
        defaultSlot="breakfast"
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );

    // No "unassigned" indicator — the slot was already implied by which
    // +Add button was clicked, so nothing should read as unassigned on open.
    expect(screen.queryByText(/unassigned/i)).not.toBeInTheDocument();

    const breakfastButton = screen.getByRole("button", { name: /breakfast/i });
    // "text-white" only appears in the active/selected style; inactive is
    // text-amber-500 on a bg-amber-500/10 tint, which would false-match a
    // plain "bg-amber-500" substring check.
    expect(breakfastButton.className).toMatch(/text-white/);

    // "Add to Plan" should already be enabled with 1 recipe assigned.
    expect(screen.getByRole("button", { name: /add 1 to plan/i })).toBeEnabled();
  });

  it("confirms with the pre-selected slot when the user hasn't touched anything", () => {
    const onConfirm = vi.fn();
    render(
      <DayAssignmentModal
        open={true}
        recipes={[recipe]}
        weekDates={weekDates}
        defaultDate="2026-03-16"
        defaultSlot="dinner"
        onConfirm={onConfirm}
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /add 1 to plan/i }));

    expect(onConfirm).toHaveBeenCalledWith([
      expect.objectContaining({ slot: "dinner", dates: ["2026-03-16"] }),
    ]);
  });

  it("clears dates when the default slot is snacks (plan-level, not day-specific)", () => {
    render(
      <DayAssignmentModal
        open={true}
        recipes={[recipe]}
        weekDates={weekDates}
        defaultDate="2026-03-16"
        defaultSlot="snacks"
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.queryByText(/unassigned/i)).not.toBeInTheDocument();
    const snacksButton = screen.getByRole("button", { name: /snacks/i });
    expect(snacksButton.className).toMatch(/text-white/);
  });

  it("still allows switching to a different slot after the default is applied", () => {
    render(
      <DayAssignmentModal
        open={true}
        recipes={[recipe]}
        weekDates={weekDates}
        defaultDate="2026-03-16"
        defaultSlot="breakfast"
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^lunch$/i }));

    const lunchButton = screen.getByRole("button", { name: /^lunch$/i });
    expect(lunchButton.className).toMatch(/text-white/);
  });
});
