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

  it('merges the same weight ingredient across g and lb into one line', () => {
    const recipeMap = new Map([
      [
        'w-1',
        {
          id: 'w-1',
          title: 'Roast Chicken',
          servings: 4,
          ingredients: [{ name: 'Chicken breast', amount: 200, unit: 'g', category: 'protein' }],
        },
      ],
      [
        'w-2',
        {
          id: 'w-2',
          title: 'Chicken Salad',
          servings: 4,
          ingredients: [{ name: 'Chicken breast', amount: 0.5, unit: 'lb', category: 'protein' }],
        },
      ],
    ]);
    const meals: MealPlanMeals = {
      '2026-03-16': {
        dinner: [
          { id: 'm-1', recipeId: 'w-1', recipeName: 'Roast Chicken', servings: 4 },
          { id: 'm-2', recipeId: 'w-2', recipeName: 'Chicken Salad', servings: 4 },
        ],
      },
    };

    const items = aggregateIngredients(meals, recipeMap);
    const chicken = items.filter((i) => i.name.toLowerCase() === 'chicken breast');
    // Previously this produced two separate, unsummed line items (one "g",
    // one "lb"); it must now be a single merged line — 200g + 0.5lb
    // (~226.8g) = ~426.8g, displayed under 1000g so it stays in grams.
    expect(chicken).toHaveLength(1);
    expect(chicken[0].unit).toBe('g');
    expect(chicken[0].amount).toBeCloseTo(426.8, 0);
    expect(chicken[0].sourceRecipes).toEqual(
      expect.arrayContaining(['Roast Chicken', 'Chicken Salad'])
    );
  });

  it('merges the same volume ingredient across cup and tbsp, optimizing the display unit', () => {
    const recipeMap = new Map([
      [
        'v-1',
        {
          id: 'v-1',
          title: 'Bread',
          servings: 1,
          ingredients: [{ name: 'Water', amount: 4, unit: 'cup', category: 'pantry' }],
        },
      ],
      [
        'v-2',
        {
          id: 'v-2',
          title: 'Soup',
          servings: 1,
          ingredients: [{ name: 'Water', amount: 2, unit: 'tbsp', category: 'pantry' }],
        },
      ],
    ]);
    const meals: MealPlanMeals = {
      '2026-03-16': {
        dinner: [
          { id: 'm-1', recipeId: 'v-1', recipeName: 'Bread', servings: 1 },
          { id: 'm-2', recipeId: 'v-2', recipeName: 'Soup', servings: 1 },
        ],
      },
    };

    const items = aggregateIngredients(meals, recipeMap);
    const water = items.filter((i) => i.name.toLowerCase() === 'water');
    // 4 cups (~946.4ml) + 2 tbsp (~29.6ml) = ~976ml, still under 1000 so it
    // stays in ml rather than jumping to liters.
    expect(water).toHaveLength(1);
    expect(water[0].unit).toBe('ml');
    expect(water[0].amount).toBeCloseTo(976, 0);
  });

  it('does not merge weight and volume units of the same ingredient (no density data)', () => {
    const recipeMap = new Map([
      [
        'f-1',
        {
          id: 'f-1',
          title: 'Cake',
          servings: 1,
          ingredients: [{ name: 'Flour', amount: 200, unit: 'g', category: 'pantry' }],
        },
      ],
      [
        'f-2',
        {
          id: 'f-2',
          title: 'Bread',
          servings: 1,
          ingredients: [{ name: 'Flour', amount: 1, unit: 'cup', category: 'pantry' }],
        },
      ],
    ]);
    const meals: MealPlanMeals = {
      '2026-03-16': {
        dinner: [
          { id: 'm-1', recipeId: 'f-1', recipeName: 'Cake', servings: 1 },
          { id: 'm-2', recipeId: 'f-2', recipeName: 'Bread', servings: 1 },
        ],
      },
    };

    const items = aggregateIngredients(meals, recipeMap);
    const flour = items.filter((i) => i.name.toLowerCase() === 'flour');
    // Mass and volume are different physical quantities without a
    // per-ingredient density — these must stay as two separate lines.
    expect(flour).toHaveLength(2);
    expect(flour.map((i) => i.unit).sort()).toEqual(['cup', 'g']);
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
