import { describe, it, expect } from 'vitest';
import {
  toSnakeCase,
  toCamelCase,
  snakeToCamel,
  camelToSnake,
} from '../case';

describe('toSnakeCase (key-level)', () => {
  it('converts camelCase to snake_case via regex fallback', () => {
    expect(toSnakeCase('firstName')).toBe('first_name');
    expect(toSnakeCase('someLongerKey')).toBe('some_longer_key');
  });

  it('returns single-word keys unchanged', () => {
    expect(toSnakeCase('name')).toBe('name');
    expect(toSnakeCase('id')).toBe('id');
  });

  it('uses the recipe field map for known camelCase keys', () => {
    expect(toSnakeCase('prepTime')).toBe('prep_time');
    expect(toSnakeCase('imageUrl')).toBe('image_url');
    expect(toSnakeCase('createdAt')).toBe('created_at');
  });

  it('handles already-snake keys idempotently', () => {
    expect(toSnakeCase('first_name')).toBe('first_name');
    expect(toSnakeCase('user_id')).toBe('user_id');
  });

  it('handles empty string', () => {
    expect(toSnakeCase('')).toBe('');
  });
});

describe('toCamelCase (key-level)', () => {
  it('converts snake_case to camelCase via regex fallback', () => {
    expect(toCamelCase('first_name')).toBe('firstName');
    expect(toCamelCase('some_longer_key')).toBe('someLongerKey');
  });

  it('returns single-word keys unchanged', () => {
    expect(toCamelCase('name')).toBe('name');
    expect(toCamelCase('id')).toBe('id');
  });

  it('uses the recipe field map for known snake_case keys', () => {
    expect(toCamelCase('prep_time')).toBe('prepTime');
    expect(toCamelCase('image_url')).toBe('imageUrl');
    expect(toCamelCase('created_at')).toBe('createdAt');
  });

  it('handles already-camel keys idempotently', () => {
    expect(toCamelCase('firstName')).toBe('firstName');
  });

  it('handles empty string', () => {
    expect(toCamelCase('')).toBe('');
  });
});

describe('snakeToCamel (object transform)', () => {
  it('returns null and undefined unchanged', () => {
    expect(snakeToCamel(null)).toBeNull();
    expect(snakeToCamel(undefined)).toBeUndefined();
  });

  it('returns primitives unchanged', () => {
    expect(snakeToCamel(42)).toBe(42);
    expect(snakeToCamel('hello')).toBe('hello');
    expect(snakeToCamel(true)).toBe(true);
  });

  it('converts top-level snake_case keys to camelCase', () => {
    expect(snakeToCamel({ first_name: 'Alice', last_name: 'Smith' })).toEqual({
      firstName: 'Alice',
      lastName: 'Smith',
    });
  });

  it('recurses into nested objects', () => {
    const input = {
      user_id: 1,
      profile_data: {
        display_name: 'Alice',
        contact_info: { phone_number: '555-1234' },
      },
    };
    expect(snakeToCamel(input)).toEqual({
      userId: 1,
      profileData: {
        displayName: 'Alice',
        contactInfo: { phoneNumber: '555-1234' },
      },
    });
  });

  it('recurses into arrays of objects', () => {
    const input = [
      { recipe_id: 1, prep_time: 10 },
      { recipe_id: 2, prep_time: 20 },
    ];
    expect(snakeToCamel(input)).toEqual([
      { recipeId: 1, prepTime: 10 },
      { recipeId: 2, prepTime: 20 },
    ]);
  });

  it('handles arrays of primitives', () => {
    expect(snakeToCamel([1, 2, 3])).toEqual([1, 2, 3]);
    expect(snakeToCamel(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('preserves null values inside objects', () => {
    expect(snakeToCamel({ user_id: null, image_url: null })).toEqual({
      userId: null,
      imageUrl: null,
    });
  });

  it('passes already-camelCase input through (idempotent at the value level)', () => {
    const input = { firstName: 'Alice', lastName: 'Smith' };
    expect(snakeToCamel(input)).toEqual({ firstName: 'Alice', lastName: 'Smith' });
  });

  it('handles empty objects and arrays', () => {
    expect(snakeToCamel({})).toEqual({});
    expect(snakeToCamel([])).toEqual([]);
  });

  it('uses recipe field map keys (prep_time → prepTime)', () => {
    const input = {
      prep_time: 15,
      cook_time: 30,
      total_time: 45,
      image_url: 'https://example.com/x.jpg',
      nutrition_info: { calories: 500 },
      source_url: 'https://example.com/recipe',
    };
    expect(snakeToCamel(input)).toEqual({
      prepTime: 15,
      cookTime: 30,
      totalTime: 45,
      imageUrl: 'https://example.com/x.jpg',
      nutritionInfo: { calories: 500 },
      sourceUrl: 'https://example.com/recipe',
    });
  });
});

describe('camelToSnake (object transform)', () => {
  it('returns null and undefined unchanged', () => {
    expect(camelToSnake(null)).toBeNull();
    expect(camelToSnake(undefined)).toBeUndefined();
  });

  it('returns primitives unchanged', () => {
    expect(camelToSnake(42)).toBe(42);
    expect(camelToSnake('hello')).toBe('hello');
    expect(camelToSnake(false)).toBe(false);
  });

  it('converts top-level camelCase keys to snake_case', () => {
    expect(camelToSnake({ firstName: 'Alice', lastName: 'Smith' })).toEqual({
      first_name: 'Alice',
      last_name: 'Smith',
    });
  });

  it('recurses into nested objects', () => {
    const input = {
      profileData: {
        displayName: 'Alice',
        contactInfo: { phoneNumber: '555-1234' },
      },
    };
    expect(camelToSnake(input)).toEqual({
      profile_data: {
        display_name: 'Alice',
        contact_info: { phone_number: '555-1234' },
      },
    });
  });

  it('recurses into arrays of objects', () => {
    const input = [
      { recipeId: 1, prepTime: 10 },
      { recipeId: 2, prepTime: 20 },
    ];
    expect(camelToSnake(input)).toEqual([
      { recipe_id: 1, prep_time: 10 },
      { recipe_id: 2, prep_time: 20 },
    ]);
  });

  it('drops top-level userId by design (handled separately by API client)', () => {
    expect(camelToSnake({ userId: 'u-123', firstName: 'Alice' })).toEqual({
      first_name: 'Alice',
    });
  });

  it('drops nested userId at every level (current behavior)', () => {
    // The skip is implemented for any key named 'userId', not just top-level.
    // Pinning current behavior so a future change is a deliberate decision.
    const input = { meta: { userId: 'u-999', extra: 1 } };
    expect(camelToSnake(input)).toEqual({ meta: { extra: 1 } });
  });

  it('preserves null values inside objects', () => {
    expect(camelToSnake({ firstName: null, imageUrl: null })).toEqual({
      first_name: null,
      image_url: null,
    });
  });

  it('handles empty objects and arrays', () => {
    expect(camelToSnake({})).toEqual({});
    expect(camelToSnake([])).toEqual([]);
  });

  it('uses recipe field map keys (prepTime → prep_time)', () => {
    const input = {
      prepTime: 15,
      cookTime: 30,
      totalTime: 45,
      imageUrl: 'https://example.com/x.jpg',
      nutritionInfo: { calories: 500 },
      sourceUrl: 'https://example.com/recipe',
    };
    expect(camelToSnake(input)).toEqual({
      prep_time: 15,
      cook_time: 30,
      total_time: 45,
      image_url: 'https://example.com/x.jpg',
      nutrition_info: { calories: 500 },
      source_url: 'https://example.com/recipe',
    });
  });
});

describe('round-trip (snake → camel → snake)', () => {
  it('preserves data when no userId is involved', () => {
    const original = {
      recipe_id: 'r-1',
      prep_time: 10,
      cook_time: 20,
      ingredients: [
        { name: 'flour', amount: 200, unit: 'g' },
        { name: 'sugar', amount: 100, unit: 'g' },
      ],
      nutrition_info: { calories: 500, protein_g: 12 },
    };
    expect(camelToSnake(snakeToCamel(original))).toEqual(original);
  });

  it('strips user_id on the way back (documented asymmetry)', () => {
    const original = { user_id: 'u-1', name: 'recipe' };
    // snake → camel preserves it as userId, but camel → snake drops userId.
    expect(camelToSnake(snakeToCamel(original))).toEqual({ name: 'recipe' });
  });
});
