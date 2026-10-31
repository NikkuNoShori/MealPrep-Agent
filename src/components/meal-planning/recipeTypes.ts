export interface SelectedRecipeInfo {
  recipeId: string;
  recipeName: string;
  recipeImage?: string;
  /** Current/chosen serving count — may be overwritten by ServingsModal. */
  servings: number;
  /** The recipe's catalog yield at selection time, before any user
   * adjustment. Snapshotted onto the meal-plan entry (ADR-0009) so the
   * grocery-cart scale doesn't drift if the recipe's yield is edited later.
   * Falls back to `servings` if unset (e.g. older callers). */
  baseServings?: number;
  prepTime?: number;
  cookTime?: number;
}
