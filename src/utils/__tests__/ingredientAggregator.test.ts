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

  it('rounds up discrete/countable ingredients so a fractional need is always covered', () => {
    // 1 apple at 4 servings, planned at 6 -> scale 1.5 -> needs 1.5 apples.
    // You can't buy half an apple, and 1 wouldn't cover the recipe, so this
    // must round UP to 2, not round-to-nearest (which would wrongly give 2
    // here too, but round(1.5)=2 by luck — the real test is 1.1 below,
    // where round-to-nearest would wrongly give 1).
    const recipeMap = new Map([
      [
        'a-1',
        {
          id: 'a-1',
          title: 'Apple Snack',
          servings: 4,
          ingredients: [{ name: 'Apple', amount: 1, unit: 'whole', category: 'produce' }],
        },
      ],
    ]);
    const meals: MealPlanMeals = {
      '2026-03-16': {
        lunch: [{ id: 'm-1', recipeId: 'a-1', recipeName: 'Apple Snack', servings: 6 }],
      },
    };

    const items = aggregateIngredients(meals, recipeMap);
    const apple = items.find((i) => i.name === 'Apple');
    expect(apple!.amount).toBe(2);
    // The exact math (1.5) is preserved for display alongside the rounded
    // buy-quantity — not hidden behind a settings toggle.
    expect(apple!.rawAmount).toBe(1.5);
  });

  it('rounds up on the smallest possible overage, not just clean halves', () => {
    // 1 egg at 4 servings, planned at 5 -> scale 1.25 -> needs 1.25 eggs.
    // Math.round would give 1 (wrong — 1 egg doesn't meet a 1.25-egg need).
    // Ceiling correctly gives 2.
    const recipeMap = new Map([
      [
        'e-1',
        {
          id: 'e-1',
          title: 'Omelette',
          servings: 4,
          ingredients: [{ name: 'Egg', amount: 1, unit: 'piece', category: 'dairy' }],
        },
      ],
    ]);
    const meals: MealPlanMeals = {
      '2026-03-16': {
        breakfast: [{ id: 'm-1', recipeId: 'e-1', recipeName: 'Omelette', servings: 5 }],
      },
    };

    const items = aggregateIngredients(meals, recipeMap);
    const egg = items.find((i) => i.name === 'Egg');
    expect(egg!.amount).toBe(2);
    expect(egg!.rawAmount).toBe(1.25);
  });

  it('does not over-round an exact whole-number total from floating point noise', () => {
    // Three recipes each needing 2 cloves at the same servings ratio should
    // sum to exactly 6, not tip over to 7 from float accumulation error.
    const recipeMap = new Map([
      ['g-1', { id: 'g-1', title: 'Sauce A', servings: 4, ingredients: [{ name: 'Garlic', amount: 2, unit: 'clove', category: 'produce' }] }],
      ['g-2', { id: 'g-2', title: 'Sauce B', servings: 4, ingredients: [{ name: 'Garlic', amount: 2, unit: 'clove', category: 'produce' }] }],
      ['g-3', { id: 'g-3', title: 'Sauce C', servings: 4, ingredients: [{ name: 'Garlic', amount: 2, unit: 'clove', category: 'produce' }] }],
    ]);
    const meals: MealPlanMeals = {
      '2026-03-16': {
        dinner: [
          { id: 'm-1', recipeId: 'g-1', recipeName: 'Sauce A', servings: 4 },
          { id: 'm-2', recipeId: 'g-2', recipeName: 'Sauce B', servings: 4 },
          { id: 'm-3', recipeId: 'g-3', recipeName: 'Sauce C', servings: 4 },
        ],
      },
    };

    const items = aggregateIngredients(meals, recipeMap);
    const garlic = items.find((i) => i.name === 'Garlic');
    expect(garlic!.amount).toBe(6);
    // Already a whole number — nothing extra to show, so rawAmount stays unset.
    expect(garlic!.rawAmount).toBeUndefined();
  });

  it('does not round up weight/volume amounts — fractions are normal to buy', () => {
    const recipeMap = new Map([
      [
        'w-1',
        {
          id: 'w-1',
          title: 'Stew',
          servings: 4,
          ingredients: [{ name: 'Beef', amount: 1, unit: 'lb', category: 'protein' }],
        },
      ],
    ]);
    const meals: MealPlanMeals = {
      '2026-03-16': {
        dinner: [{ id: 'm-1', recipeId: 'w-1', recipeName: 'Stew', servings: 6 }],
      },
    };

    const items = aggregateIngredients(meals, recipeMap);
    const beef = items.find((i) => i.name === 'Beef');
    // 1lb at 4 servings, scaled to 6 -> 1.5lb exactly, not rounded up to 2.
    expect(beef!.amount).toBe(1.5);
    expect(beef!.rawAmount).toBeUndefined();
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
