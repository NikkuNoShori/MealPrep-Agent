/**
 * Covers the silent auto-sync behavior added on top of the existing manual
 * "Generate" button: when the Grocery tab becomes the active one
 * (isActive=true), the list silently regenerates in the background if it's
 * stale relative to the current plan — but only then, not on every meals
 * change, and never when it's already in sync (checking items off must
 * never look like a "change" that needs re-saving).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import toast from "react-hot-toast";
import GroceryCart from "../GroceryCart";
import { renderWithProviders } from "@/test/render";

const mutate = vi.fn();

vi.mock("@/services/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api")>();
  return {
    ...actual,
    useRecipes: () => ({
      data: {
        recipes: [
          {
            id: "r-1",
            title: "Pasta",
            servings: 4,
            ingredients: [{ name: "Flour", amount: 2, unit: "cup", category: "pantry" }],
          },
        ],
      },
      isLoading: false,
    }),
    useUpdateMealPlan: () => ({ mutate, isPending: false }),
  };
});

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const planWithMeals = (groceryItems: unknown[] = []) => ({
  id: "plan-1",
  meals: {
    "2026-03-16": { dinner: [{ id: "m-1", recipeId: "r-1", recipeName: "Pasta", servings: 4 }] },
  },
  groceryList: { items: groceryItems, lastGenerated: null },
});

describe("GroceryCart auto-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when the tab isn't active, even though the list is stale (empty)", () => {
    renderWithProviders(<GroceryCart plan={planWithMeals([])} isActive={false} />);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("silently regenerates when the tab becomes active and the list is stale", () => {
    renderWithProviders(<GroceryCart plan={planWithMeals([])} isActive={true} />);

    expect(mutate).toHaveBeenCalledTimes(1);
    const call = mutate.mock.calls[0][0];
    expect(call.id).toBe("plan-1");
    expect(call.data.groceryList.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Flour", unit: "cup", amount: 2 })])
    );
    // Silent — no manual-generate toast for the background sync.
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("does not re-save when the stored list already matches what would be generated", () => {
    const alreadyCorrect = [
      {
        id: "existing-1",
        name: "Flour",
        amount: 2,
        unit: "cup",
        category: "pantry",
        sourceRecipes: ["Pasta"],
        isManual: false,
        isChecked: true, // shopping progress — must not count as "stale"
        isRemoved: false,
      },
    ];

    renderWithProviders(<GroceryCart plan={planWithMeals(alreadyCorrect)} isActive={true} />);

    expect(mutate).not.toHaveBeenCalled();
  });

  it("manual Generate button still saves and shows its own success toast", () => {
    renderWithProviders(<GroceryCart plan={planWithMeals([])} isActive={false} />);

    screen.getByRole("button", { name: /generate/i }).click();

    expect(mutate).toHaveBeenCalledTimes(1);
    const options = mutate.mock.calls[0][1];
    options.onSuccess?.();
    expect(toast.success).toHaveBeenCalled();
  });
});
