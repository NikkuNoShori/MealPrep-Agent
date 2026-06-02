/**
 * MOP-0008 — Tool handlers (11 tools).
 *
 * Every handler:
 *  - Receives validated args (the dispatcher already checked the schema).
 *  - Uses `ctx.supabase` (user-scoped) — RLS enforces visibility.
 *  - NEVER reads `user_id` from args. The user is `ctx.user.id`.
 *  - Returns `{ ok: true, data: ... }` on success or
 *    `{ ok: false, error: ..., retryable?: boolean }` on failure.
 *
 * The dispatcher wraps "always destructive" tools (update/delete) before
 * we ever reach this file. Conditionally destructive tools surface
 * `{ requiresConfirmation: true, summary, args }` from inside the handler.
 */

import type { ToolContext } from "./dispatch.ts";
import { SUBSTITUTION_PROMPT } from "../../_shared/recipe-prompts.ts";
import { webSearch } from "../../_shared/web-search-client.ts";

export type ToolHandlerResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string; retryable?: boolean }
  | {
      requiresConfirmation: true;
      summary: string;
      args: Record<string, unknown>;
    };

export type ToolHandler = (
  args: Record<string, unknown>,
  ctx: ToolContext
) => Promise<ToolHandlerResult | unknown>;

// ─────────────────────────────────────────────────────────────────────
// search_recipes
// ─────────────────────────────────────────────────────────────────────

async function searchRecipes(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolHandlerResult> {
  const query = args.query as string;
  const filters = (args.filters || {}) as Record<string, unknown>;

  let embedding: number[] | null = null;
  try {
    embedding = await ctx.openRouter.generateEmbedding(query);
  } catch (e) {
    console.warn("[searchRecipes] embedding failed:", (e as Error).message);
  }

  // Run both searches in parallel; tolerate individual failures.
  const [semanticRes, textRes] = await Promise.allSettled([
    embedding
      ? ctx.supabase.rpc("search_recipes_semantic", {
          query_embedding: JSON.stringify(embedding),
          user_id: ctx.user.id,
          match_threshold: 0.5,
          match_count: 5,
        })
      : Promise.resolve({ data: [], error: null }),
    ctx.supabase.rpc("search_recipes_text", {
      search_query: query,
      user_uuid: ctx.user.id,
      max_results: 5,
    }),
  ]);

  const semantic =
    semanticRes.status === "fulfilled" && !semanticRes.value.error
      ? (semanticRes.value.data as Record<string, unknown>[]) || []
      : [];
  const text =
    textRes.status === "fulfilled" && !textRes.value.error
      ? (textRes.value.data as Record<string, unknown>[]) || []
      : [];

  // Dedupe by id (semantic first — higher quality ranking).
  const seen = new Set<string>();
  const combined: Record<string, unknown>[] = [];
  for (const row of [...semantic, ...text]) {
    const id = (row as { id?: string; recipe_id?: string }).id ||
      (row as { recipe_id?: string }).recipe_id;
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    combined.push(row);
  }

  // Apply simple post-filters (the model can refine further).
  let filtered = combined;
  if (filters.cuisine) {
    filtered = filtered.filter(
      (r) =>
        (r as { cuisine?: string }).cuisine?.toLowerCase() ===
        (filters.cuisine as string).toLowerCase()
    );
  }
  if (filters.difficulty) {
    filtered = filtered.filter(
      (r) => (r as { difficulty?: string }).difficulty === filters.difficulty
    );
  }
  if (filters.max_total_time_minutes !== undefined) {
    const cap = filters.max_total_time_minutes as number;
    filtered = filtered.filter((r) => {
      const t =
        ((r as { prep_time?: number }).prep_time || 0) +
        ((r as { cook_time?: number }).cook_time || 0);
      return t === 0 || t <= cap;
    });
  }

  return {
    ok: true,
    data: {
      count: filtered.length,
      results: filtered.slice(0, 5).map((r) => ({
        id: (r as { id?: string }).id,
        title: (r as { title?: string }).title,
        description: (r as { description?: string }).description,
        cuisine: (r as { cuisine?: string }).cuisine,
        difficulty: (r as { difficulty?: string }).difficulty,
        prep_time: (r as { prep_time?: number }).prep_time,
        cook_time: (r as { cook_time?: number }).cook_time,
        tags: (r as { tags?: string[] }).tags,
        similarity_score: (r as { similarity_score?: number }).similarity_score,
      })),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// find_similar_recipes
// ─────────────────────────────────────────────────────────────────────

async function findSimilarRecipes(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolHandlerResult> {
  const recipeId = args.recipe_id as string;
  const limit = (args.limit as number | undefined) ?? 5;

  // Fetch source recipe's searchable_text and embed it.
  const { data: source, error: srcErr } = await ctx.supabase
    .from("recipes")
    .select("id, title, searchable_text")
    .eq("id", recipeId)
    .maybeSingle();

  if (srcErr || !source) {
    return {
      ok: false,
      error: "Source recipe not found or you don't have access to it.",
      retryable: false,
    };
  }

  const text =
    ((source as { searchable_text?: string }).searchable_text || "") +
    " " +
    ((source as { title?: string }).title || "");

  let embedding: number[];
  try {
    embedding = await ctx.openRouter.generateEmbedding(text);
  } catch (e) {
    return {
      ok: false,
      error: `Could not embed source recipe: ${(e as Error).message}`,
      retryable: true,
    };
  }

  const { data, error } = await ctx.supabase.rpc("search_recipes_semantic", {
    query_embedding: JSON.stringify(embedding),
    user_id: ctx.user.id,
    match_threshold: 0.4,
    match_count: limit + 1, // overfetch so we can drop the source itself
  });

  if (error) {
    return { ok: false, error: error.message, retryable: true };
  }

  const results = (data as Record<string, unknown>[] | null) || [];
  return {
    ok: true,
    data: {
      results: results
        .filter((r) => (r as { id?: string }).id !== recipeId)
        .slice(0, limit)
        .map((r) => ({
          id: (r as { id?: string }).id,
          title: (r as { title?: string }).title,
          similarity_score: (r as { similarity_score?: number })
            .similarity_score,
        })),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// extract_recipe_from_source — delegates to recipe-pipeline/extract-only
// ─────────────────────────────────────────────────────────────────────

async function extractRecipeFromSource(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolHandlerResult> {
  const sourceType = args.source_type as "url" | "text" | "images";

  const body: Record<string, unknown> = { auto_save: false };

  if (sourceType === "url") {
    if (!args.url) {
      return {
        ok: false,
        error: "url is required when source_type=url",
        retryable: false,
      };
    }
    body.source_type = "url";
    body.url = args.url;
  } else if (sourceType === "text") {
    if (!args.text) {
      return {
        ok: false,
        error: "text is required when source_type=text",
        retryable: false,
      };
    }
    body.source_type = "text";
    body.text = args.text;
  } else if (sourceType === "images") {
    if (!ctx.attachedImages || ctx.attachedImages.length === 0) {
      return {
        ok: false,
        error: "No images attached to this message.",
        retryable: false,
      };
    }
    body.source_type = "text";
    body.text = "";
    body.images = ctx.attachedImages;
  } else {
    return {
      ok: false,
      error: `Unsupported source_type: ${sourceType}`,
      retryable: false,
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseKey) {
    return {
      ok: false,
      error: "Supabase environment not configured for extraction",
      retryable: false,
    };
  }

  let response: Response;
  try {
    response = await fetch(
      `${supabaseUrl}/functions/v1/recipe-pipeline/extract-only`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ctx.userToken}`,
          apikey: supabaseKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(50_000),
      }
    );
  } catch (e) {
    return {
      ok: false,
      error: `Extraction request failed: ${(e as Error).message}`,
      retryable: true,
    };
  }

  let result: any;
  try {
    result = await response.json();
  } catch {
    return {
      ok: false,
      error: `Extraction returned non-JSON response (${response.status})`,
      retryable: true,
    };
  }

  if (!result?.success || (!result.recipe && !result.recipes)) {
    return {
      ok: false,
      error: result?.errors?.[0]?.message || "Recipe extraction failed",
      retryable: true,
    };
  }

  return {
    ok: true,
    data: {
      saved: false,
      recipe: result.recipe,
      recipes:
        result.recipes && result.recipes.length > 1 ? result.recipes : undefined,
      source_url: sourceType === "url" ? (args.url as string) : undefined,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// get_household_recipes
// ─────────────────────────────────────────────────────────────────────

async function getHouseholdRecipes(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolHandlerResult> {
  const filters = (args.filters || {}) as Record<string, unknown>;
  const limit = (args.limit as number | undefined) ?? 10;

  let query = ctx.supabase
    .from("recipes")
    .select(
      "id, title, description, cuisine, difficulty, prep_time, cook_time, tags, is_favorite"
    )
    .eq("user_id", ctx.user.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filters.cuisine) {
    query = (query as any).eq("cuisine", filters.cuisine);
  }
  if (filters.is_favorite !== undefined) {
    query = (query as any).eq("is_favorite", filters.is_favorite);
  }
  if (filters.tags_any && Array.isArray(filters.tags_any)) {
    query = (query as any).overlaps("tags", filters.tags_any);
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message, retryable: true };

  return {
    ok: true,
    data: {
      count: (data || []).length,
      results: data || [],
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// get_household_profile
// ─────────────────────────────────────────────────────────────────────

async function getHouseholdProfile(
  _args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolHandlerResult> {
  const { data: household, error: hhErr } = await ctx.supabase.rpc(
    "get_my_household"
  );
  if (hhErr) {
    return { ok: false, error: hhErr.message, retryable: true };
  }

  // user_preferences may carry measurement_system.
  const { data: prefs } = await ctx.supabase
    .from("user_preferences")
    .select("measurement_system")
    .eq("user_id", ctx.user.id)
    .maybeSingle();

  return {
    ok: true,
    data: {
      household: household || null,
      measurement_system:
        (prefs as { measurement_system?: string } | null)?.measurement_system ||
        null,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// get_meal_plan
// ─────────────────────────────────────────────────────────────────────

async function getMealPlan(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolHandlerResult> {
  const startDate = args.start_date as string;
  const endDate = args.end_date as string;
  const status = args.status as string | undefined;

  let query = ctx.supabase
    .from("meal_plans")
    .select("id, title, start_date, end_date, meals, grocery_list, status")
    .eq("user_id", ctx.user.id)
    .gte("end_date", startDate)
    .lte("start_date", endDate)
    .order("start_date", { ascending: true });

  if (status) {
    query = (query as any).eq("status", status);
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message, retryable: true };

  return {
    ok: true,
    data: { count: (data || []).length, meal_plans: data || [] },
  };
}

// ─────────────────────────────────────────────────────────────────────
// assign_recipe_to_meal_plan_slot (conditionally destructive)
// ─────────────────────────────────────────────────────────────────────

async function assignRecipeToMealPlanSlot(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolHandlerResult> {
  const date = args.date as string;
  const slot = args.slot as string;
  const recipeId = args.recipe_id as string;
  const mealPlanId = args.meal_plan_id as string | undefined;

  // 1. Resolve target meal plan: explicit id, else the active plan that
  //    covers this date, else create a new draft.
  let plan: { id: string; meals: any } | null = null;

  if (mealPlanId) {
    const { data, error } = await ctx.supabase
      .from("meal_plans")
      .select("id, meals")
      .eq("id", mealPlanId)
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    if (error) return { ok: false, error: error.message, retryable: true };
    if (!data) {
      return {
        ok: false,
        error: "Meal plan not found",
        retryable: false,
      };
    }
    plan = data as { id: string; meals: any };
  } else {
    const { data, error } = await ctx.supabase
      .from("meal_plans")
      .select("id, meals")
      .eq("user_id", ctx.user.id)
      .lte("start_date", date)
      .gte("end_date", date)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { ok: false, error: error.message, retryable: true };
    plan = (data as { id: string; meals: any } | null) || null;
  }

  // Verify recipe belongs to user.
  const { data: recipe, error: recErr } = await ctx.supabase
    .from("recipes")
    .select("id, title")
    .eq("id", recipeId)
    .maybeSingle();
  if (recErr || !recipe) {
    return {
      ok: false,
      error: "Recipe not found or you don't have access to it.",
      retryable: false,
    };
  }

  // No plan covering the date — create one (7-day window centered on date).
  if (!plan) {
    const startDate = date;
    const endDateObj = new Date(date);
    endDateObj.setDate(endDateObj.getDate() + 6);
    const endDate = endDateObj.toISOString().split("T")[0];

    const meals: Record<string, Record<string, string>> = {};
    meals[date] = { [slot]: recipeId };

    const { data: created, error: createErr } = await ctx.supabase
      .from("meal_plans")
      .insert({
        user_id: ctx.user.id,
        created_by: ctx.user.id,
        last_edited_by: ctx.user.id,
        start_date: startDate,
        end_date: endDate,
        meals,
        status: "draft",
      })
      .select("id")
      .single();
    if (createErr) {
      return { ok: false, error: createErr.message, retryable: true };
    }
    return {
      ok: true,
      data: {
        meal_plan_id: (created as { id: string }).id,
        date,
        slot,
        recipe_id: recipeId,
        recipe_title: (recipe as { title: string }).title,
        created_plan: true,
      },
    };
  }

  // Plan exists — check if slot occupied.
  const currentMeals = (plan.meals && typeof plan.meals === "object"
    ? { ...(plan.meals as Record<string, unknown>) }
    : {}) as Record<string, Record<string, string>>;

  const daySlots: Record<string, string> = currentMeals[date]
    ? { ...currentMeals[date] }
    : {};
  const existing = daySlots[slot];

  if (existing && existing !== recipeId) {
    // Conditionally destructive — surface confirmation.
    return {
      requiresConfirmation: true,
      summary: `That ${slot} slot on ${date} already has a recipe. Overwrite it with "${
        (recipe as { title: string }).title
      }"?`,
      args: {
        meal_plan_id: plan.id,
        date,
        slot,
        recipe_id: recipeId,
        confirmed_overwrite: true,
      },
    };
  }

  // Write.
  daySlots[slot] = recipeId;
  currentMeals[date] = daySlots;

  const { error: updErr } = await ctx.supabase
    .from("meal_plans")
    .update({ meals: currentMeals, last_edited_by: ctx.user.id })
    .eq("id", plan.id);
  if (updErr) {
    return { ok: false, error: updErr.message, retryable: true };
  }

  return {
    ok: true,
    data: {
      meal_plan_id: plan.id,
      date,
      slot,
      recipe_id: recipeId,
      recipe_title: (recipe as { title: string }).title,
      created_plan: false,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// add_to_grocery_list
// ─────────────────────────────────────────────────────────────────────

async function addToGroceryList(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolHandlerResult> {
  const item = args.item as string;
  const mealPlanId = args.meal_plan_id as string | undefined;

  // Find target plan.
  let plan: { id: string; grocery_list: any } | null;
  if (mealPlanId) {
    const { data, error } = await ctx.supabase
      .from("meal_plans")
      .select("id, grocery_list")
      .eq("id", mealPlanId)
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    if (error) return { ok: false, error: error.message, retryable: true };
    plan = (data as { id: string; grocery_list: any } | null) || null;
  } else {
    const { data, error } = await ctx.supabase
      .from("meal_plans")
      .select("id, grocery_list")
      .eq("user_id", ctx.user.id)
      .eq("status", "active")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { ok: false, error: error.message, retryable: true };
    plan = (data as { id: string; grocery_list: any } | null) || null;
  }

  if (!plan) {
    return {
      ok: false,
      error: "No active meal plan found to add the item to.",
      retryable: false,
    };
  }

  const newItem = {
    item,
    amount: args.amount,
    unit: args.unit,
    category: args.category || "other",
    added_at: new Date().toISOString(),
  };

  const currentList = Array.isArray(plan.grocery_list)
    ? [...(plan.grocery_list as unknown[])]
    : [];
  currentList.push(newItem);

  const { error: updErr } = await ctx.supabase
    .from("meal_plans")
    .update({ grocery_list: currentList, last_edited_by: ctx.user.id })
    .eq("id", plan.id);
  if (updErr) return { ok: false, error: updErr.message, retryable: true };

  return {
    ok: true,
    data: { meal_plan_id: plan.id, item: newItem, total_items: currentList.length },
  };
}

// ─────────────────────────────────────────────────────────────────────
// propose_substitution
// ─────────────────────────────────────────────────────────────────────

async function proposeSubstitution(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolHandlerResult> {
  const recipeId = args.recipe_id as string;
  const ingredient = args.ingredient as string;
  const constraint = args.constraint as string | undefined;

  const { data: recipe, error: recErr } = await ctx.supabase
    .from("recipes")
    .select("title, description, ingredients, cuisine")
    .eq("id", recipeId)
    .maybeSingle();
  if (recErr || !recipe) {
    return {
      ok: false,
      error: "Recipe not found or you don't have access to it.",
      retryable: false,
    };
  }

  const userMessage = JSON.stringify({
    recipe: {
      title: (recipe as { title?: string }).title,
      cuisine: (recipe as { cuisine?: string }).cuisine,
      ingredients: (recipe as { ingredients?: unknown[] }).ingredients,
    },
    target_ingredient: ingredient,
    constraint: constraint || null,
  });

  let raw: string;
  try {
    raw = await ctx.openRouter.chat(
      SUBSTITUTION_PROMPT,
      userMessage,
      "qwen/qwen-2.5-7b-instruct",
      {
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" },
      }
    );
  } catch (e) {
    return {
      ok: false,
      error: `Substitution generation failed: ${(e as Error).message}`,
      retryable: true,
    };
  }

  let parsed: { substitutions?: unknown[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error: "Substitution model returned invalid JSON",
      retryable: true,
    };
  }

  if (!Array.isArray(parsed.substitutions)) {
    return {
      ok: false,
      error: "Substitution model returned no substitutions array",
      retryable: true,
    };
  }

  return {
    ok: true,
    data: {
      ingredient,
      constraint: constraint || null,
      substitutions: parsed.substitutions.slice(0, 4),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// web_search_recipe (MOP-0008 Addendum 1) — read-only, no DB surface.
// Delegates to the shared web-search-client; provider credentials are
// read only inside that shared module (never from this file).
// ─────────────────────────────────────────────────────────────────────

async function webSearchRecipe(
  args: Record<string, unknown>,
  _ctx: ToolContext
): Promise<ToolHandlerResult> {
  const query = args.query as string;
  const maxResults = args.max_results as number | undefined;
  const siteFilter = args.site_filter as string | undefined;

  const outcome = await webSearch.query({
    query,
    maxResults,
    siteFilter,
  });

  if (!outcome.ok) {
    // Map provider-level error codes to retryability the agent can reason
    // about. NO_RESULTS is non-retryable so the agent falls back to an
    // explanation instead of looping.
    return {
      ok: false,
      error: outcome.error,
      retryable: outcome.retryable,
    };
  }

  return { ok: true, data: outcome.data };
}

// ─────────────────────────────────────────────────────────────────────
// update_recipe / delete_recipe — safety net (dispatcher short-circuits)
// ─────────────────────────────────────────────────────────────────────

async function updateRecipe(
  args: Record<string, unknown>,
  _ctx: ToolContext
): Promise<ToolHandlerResult> {
  return {
    requiresConfirmation: true,
    summary: `Update recipe ${args.recipe_id}?`,
    args,
  };
}

async function deleteRecipe(
  args: Record<string, unknown>,
  _ctx: ToolContext
): Promise<ToolHandlerResult> {
  return {
    requiresConfirmation: true,
    summary: `Delete recipe ${args.recipe_id}?`,
    args,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────

export const HANDLERS: Record<string, ToolHandler> = {
  search_recipes: searchRecipes as ToolHandler,
  find_similar_recipes: findSimilarRecipes as ToolHandler,
  extract_recipe_from_source: extractRecipeFromSource as ToolHandler,
  get_household_recipes: getHouseholdRecipes as ToolHandler,
  get_household_profile: getHouseholdProfile as ToolHandler,
  get_meal_plan: getMealPlan as ToolHandler,
  assign_recipe_to_meal_plan_slot: assignRecipeToMealPlanSlot as ToolHandler,
  add_to_grocery_list: addToGroceryList as ToolHandler,
  propose_substitution: proposeSubstitution as ToolHandler,
  update_recipe: updateRecipe as ToolHandler,
  delete_recipe: deleteRecipe as ToolHandler,
  web_search_recipe: webSearchRecipe as ToolHandler,
};

/**
 * Direct execution path for the post-confirmation short-circuit (Step 7).
 * Used when the frontend sends `metadata.confirmAction` — we skip the model
 * loop and run the handler with the previously validated args.
 */
export async function executeConfirmedTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolHandlerResult | unknown> {
  // Real implementations for the destructive tools live here so confirm
  // actually applies the change.
  if (name === "delete_recipe") {
    const recipeId = args.recipe_id as string;
    const { error } = await ctx.supabase
      .from("recipes")
      .delete()
      .eq("id", recipeId)
      .eq("user_id", ctx.user.id);
    if (error) return { ok: false, error: error.message, retryable: true };
    return { ok: true, data: { deleted: recipeId } };
  }

  if (name === "update_recipe") {
    const recipeId = args.recipe_id as string;
    const changes = (args.changes || {}) as Record<string, unknown>;

    // Tag add/remove become a fetch-merge-write because we don't want to
    // clobber existing tags.
    if (changes.tags_add || changes.tags_remove) {
      const { data: current } = await ctx.supabase
        .from("recipes")
        .select("tags")
        .eq("id", recipeId)
        .maybeSingle();
      const existing = new Set<string>(
        ((current as { tags?: string[] } | null)?.tags || []) as string[]
      );
      for (const t of (changes.tags_add as string[] | undefined) || []) existing.add(t);
      for (const t of (changes.tags_remove as string[] | undefined) || [])
        existing.delete(t);
      changes.tags = Array.from(existing);
      delete changes.tags_add;
      delete changes.tags_remove;
    }

    const { data, error } = await ctx.supabase
      .from("recipes")
      .update(changes)
      .eq("id", recipeId)
      .eq("user_id", ctx.user.id)
      .select()
      .maybeSingle();
    if (error) return { ok: false, error: error.message, retryable: true };
    return { ok: true, data: { updated: recipeId, recipe: data } };
  }

  if (name === "assign_recipe_to_meal_plan_slot") {
    // Re-run the handler with the confirmed_overwrite flag — but the assign
    // handler itself doesn't gate on that flag; we set the slot via the JSONB
    // read-modify-write here.
    const mealPlanId = args.meal_plan_id as string;
    const date = args.date as string;
    const slot = args.slot as string;
    const recipeId = args.recipe_id as string;

    const { data: plan, error: planErr } = await ctx.supabase
      .from("meal_plans")
      .select("id, meals")
      .eq("id", mealPlanId)
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    if (planErr || !plan) {
      return {
        ok: false,
        error: planErr?.message || "Meal plan not found",
        retryable: false,
      };
    }
    const currentMeals = (((plan as { meals?: any }).meals as
      | Record<string, Record<string, string>>
      | undefined) || {}) as Record<string, Record<string, string>>;
    const daySlots = { ...(currentMeals[date] || {}) };
    daySlots[slot] = recipeId;
    currentMeals[date] = daySlots;
    const { error: updErr } = await ctx.supabase
      .from("meal_plans")
      .update({ meals: currentMeals, last_edited_by: ctx.user.id })
      .eq("id", mealPlanId);
    if (updErr) return { ok: false, error: updErr.message, retryable: true };
    return {
      ok: true,
      data: { meal_plan_id: mealPlanId, date, slot, recipe_id: recipeId },
    };
  }

  return { ok: false, error: `No confirmed-execution path for ${name}`, retryable: false };
}
