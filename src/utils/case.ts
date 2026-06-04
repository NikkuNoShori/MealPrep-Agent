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

/**
 * Recursive snake → camel key conversion. The runtime drops nothing —
 * only the keys are renamed; values pass through unchanged (including
 * nested objects + arrays).
 *
 * Type parameter `T` is the **caller-asserted** output shape. The
 * transformation cannot be expressed at the type level without a
 * template-literal mapped type that also accounts for `RECIPE_FIELD_MAP`
 * special-cases — so we let the call site declare what it expects to
 * receive. Default `T = unknown` forces explicit narrowing; pass a known
 * shape (e.g. `snakeToCamel<RecipeRow>(row)`) for type-safe access.
 *
 * Existing call sites that pre-date this generic continue to work
 * because TypeScript will infer `T = unknown` and the caller will
 * either narrow at access or use `as` casts (same as before).
 */
export const snakeToCamel = <T = any>(obj: unknown): T => {
  if (obj === null || obj === undefined) return obj as T;
  if (Array.isArray(obj)) return obj.map((item) => snakeToCamel<unknown>(item)) as T;
  if (typeof obj !== 'object') return obj as T;

  const camelObj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const camelKey = toCamelCase(key);
    camelObj[camelKey] = snakeToCamel<unknown>(value);
  }
  return camelObj as T;
};

/**
 * Recursive camel → snake key conversion.
 *
 * **Runtime asymmetry:** the `userId` key is intentionally dropped at
 * every nesting level. The API client sets `user_id` separately (e.g.
 * in `createRecipe`) so frontend code can pass `{ userId, ... }`
 * without the round-trip re-introducing a stale id. Tests document this
 * behavior — round-trips should NOT expect `userId` to come back.
 *
 * Type parameter `T` is the caller-asserted output shape — see the
 * docstring on `snakeToCamel` for the rationale.
 */
export const camelToSnake = <T = any>(obj: unknown): T => {
  if (obj === null || obj === undefined) return obj as T;
  if (Array.isArray(obj)) return obj.map((item) => camelToSnake<unknown>(item)) as T;
  if (typeof obj !== 'object') return obj as T;

  const snakeObj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (key === 'userId') continue;
    const snakeKey = toSnakeCase(key);
    snakeObj[snakeKey] = camelToSnake<unknown>(value);
  }
  return snakeObj as T;
};
