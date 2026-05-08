// Case-conversion utilities used by the API client to translate between
// camelCase (frontend) and snake_case (Supabase / Postgres).
//
// Extracted into its own module so tests can exercise these in isolation
// without loading the full data layer (supabase client, react-query, etc.).

const RECIPE_FIELD_MAP: Record<string, string> = {
  prepTime: 'prep_time',
  cookTime: 'cook_time',
  totalTime: 'total_time',
  imageUrl: 'image_url',
  nutritionInfo: 'nutrition_info',
  sourceUrl: 'source_url',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  userId: 'user_id',
  prep_time: 'prepTime',
  cook_time: 'cookTime',
  total_time: 'totalTime',
  image_url: 'imageUrl',
  nutrition_info: 'nutritionInfo',
  source_url: 'sourceUrl',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  user_id: 'userId',
};

export const toSnakeCase = (key: string): string => {
  if (RECIPE_FIELD_MAP[key]) {
    const mapped = RECIPE_FIELD_MAP[key];
    if (mapped.includes('_')) return mapped;
  }
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
};

export const toCamelCase = (key: string): string => {
  if (RECIPE_FIELD_MAP[key]) {
    const mapped = RECIPE_FIELD_MAP[key];
    if (!mapped.includes('_')) return mapped;
  }
  return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

export const snakeToCamel = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (typeof obj !== 'object') return obj;

  const camelObj: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = toCamelCase(key);
    camelObj[camelKey] = snakeToCamel(value);
  }
  return camelObj;
};

// Note: `userId` is intentionally dropped during camelToSnake because
// the API client sets `user_id` separately (e.g. in createRecipe). This
// is documented behavior — round-trip tests should not expect it back.
export const camelToSnake = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(camelToSnake);
  if (typeof obj !== 'object') return obj;

  const snakeObj: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'userId') continue;
    const snakeKey = toSnakeCase(key);
    snakeObj[snakeKey] = camelToSnake(value);
  }
  return snakeObj;
};
