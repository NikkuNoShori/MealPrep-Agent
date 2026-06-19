import { describe, it, expect } from 'vitest';
import {
  aggregateIngredients,
  groupByCategory,
} from '@/utils/ingredientAggregator';
import type { GroceryItem, MealPlanMeals } from '@/types/mealPlan';

function makeRecipeMap() {
  return new Map([
    [
      'r-1',
      {
        id: 'r-1',
        title: 'Pasta',
        servings: 4,
        ingredients: [
          { name: 'Olive oil', amount: 2, unit: 'tbsp', category: 'pantry' },
          { name: 'Garlic', amount: 3, unit: 'cloves', category: 'produce' },
        ],
      },
    ],
    [
      'r-2',
      {
        id: 'r-2',
        title: 'Salad',
        servings: 2,
        ingredients: [
          { name: 'Olive Oil', amount: 1, unit: 'tablespoons', category: 'pantry' },
          { name: 'Salt', amount: null, unit: '', category: 'pantry' },
        ],
      },
    ],
  ]);
}

describe('aggregateIngredients', () => {
  it('combines duplicate ingredients with the same normalized unit', () => {
    const meals: MealPlanMeals = {
      '2026-03-16': {
        dinner: [
          { id: 'm-1', recipeId: 'r-1', recipeName: 'Pasta', servings: 4 },
          { id: 'm-2', recipeId: 'r-2', recipeName: 'Salad', servings: 2 },
        ],
      },
    };

    const items = aggregateIngredients(meals, makeRecipeMap());
    const oil = items.find((i) => i.name.toLowerCase().includes('olive'));
    expect(oil).toBeDefined();
    expect(oil!.amount).toBe(3);
    expect(oil!.unit).toBe('tbsp');
    expect(oil!.sourceRecipes).toEqual(expect.arrayContaining(['Pasta', 'Salad']));
  });

  it('scales ingredient amounts by serving override', () => {
    const meals: MealPlanMeals = {
      '2026-03-16': {
        dinner: [
          { id: 'm-1', recipeId: 'r-1', recipeName: 'Pasta', servings: 8 },
        ],
      },
    };

    const items = aggregateIngredients(meals, makeRecipeMap());
    const garlic = items.find((i) => i.name === 'Garlic');
    expect(garlic!.amount).toBe(6);
  });

  it('keeps null amounts as unquantified line items', () => {
    const meals: MealPlanMeals = {
      '2026-03-16': {
        lunch: [
          { id: 'm-1', recipeId: 'r-2', recipeName: 'Salad', servings: 2 },
        ],
      },
    };

    const items = aggregateIngredients(meals, makeRecipeMap());
    const salt = items.find((i) => i.name === 'Salt');
    expect(salt!.amount).toBeNull();
  });

  it('includes plan-level snack entries', () => {
    const meals: MealPlanMeals = {
      _snacks: [
        { id: 's-1', recipeId: 'r-1', recipeName: 'Pasta', servings: 4 },
      ],
    };

    const items = aggregateIngredients(meals, makeRecipeMap());
    expect(items.some((i) => i.name === 'Garlic')).toBe(true);
  });

  it('returns empty array when no recipe matches', () => {
    const meals: MealPlanMeals = {
      '2026-03-16': {
        dinner: [
          { id: 'm-1', recipeId: 'missing', recipeName: 'Ghost', servings: 4 },
        ],
      },
    };

    expect(aggregateIngredients(meals, makeRecipeMap())).toEqual([]);
  });
});

describe('groupByCategory', () => {
  it('excludes removed items and orders by CATEGORY_ORDER', () => {
    const items: GroceryItem[] = [
      {
        id: '1',
        name: 'Milk',
        amount: 1,
        unit: 'cup',
        category: 'dairy',
        sourceRecipes: [],
        isManual: false,
        isChecked: false,
        isRemoved: false,
      },
      {
        id: '2',
        name: 'Onion',
        amount: 1,
        unit: '',
        category: 'produce',
        sourceRecipes: [],
        isManual: false,
        isChecked: false,
        isRemoved: false,
      },
      {
        id: '3',
        name: 'Removed',
        amount: 1,
        unit: '',
        category: 'produce',
        sourceRecipes: [],
        isManual: false,
        isChecked: false,
        isRemoved: true,
      },
    ];

    const grouped = groupByCategory(items);
    expect(Array.from(grouped.keys())).toEqual(['produce', 'dairy']);
    expect(grouped.get('produce')).toHaveLength(1);
  });
});
