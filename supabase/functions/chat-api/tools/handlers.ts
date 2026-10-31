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
import { UTILITY_TEXT_MODEL } from "../../_shared/models.ts";

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
  const sourceType = args.source_type as "url" | "text" | "images" | "video";

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
    if (args.pinned_comment_text) {
      body.pinned_comment_text = args.pinned_comment_text;
    }
    if (args.supplementary_text) {
      body.supplementary_text = args.supplementary_text;
    }
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
    // Pass the user's own typed caption through — it may carry servings,
    // page order ("page 2 of 2"), or corrections the model can't see in the
    // image. This is the user's own input, not third-party content.
    body.text = ctx.attachedImagesCaption || "";
    body.images = ctx.attachedImages;
  } else if (sourceType === "video") {
    body.source_type = "video";
    if (args.video_url) body.video_url = args.video_url;
    if (args.url) body.video_url = args.url;
    if (args.pinned_comment_text) {
      body.pinned_comment_text = args.pinned_comment_text;
    }
    if (args.supplementary_text) {
      body.supplementary_text = args.supplementary_text;
    }
    if (args.transcript) body.transcript = args.transcript;
    if (ctx.attachedVideoMediaUrl) {
      body.media_url = ctx.attachedVideoMediaUrl;
    }
    if (ctx.attachedVideoFrameUrls?.length) {
      body.frame_urls = ctx.attachedVideoFrameUrls;
    }
    if (
      !body.video_url &&
      !body.media_url &&
      !body.frame_urls &&
      !body.transcript
    ) {
      return {
        ok: false,
        error:
          "video source requires video_url, media_url, frame_urls, or transcript",
        retryable: false,
      };
    }
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
      recipe: enrichExtractedRecipe(result.recipe, result.source_metadata),
      recipes:
        result.recipes && result.recipes.length > 1
          ? result.recipes.map((r: Record<string, unknown>) =>
              enrichExtractedRecipe(r, result.source_metadata)
            )
          : undefined,
      source_metadata: result.source_metadata ?? null,
    },
  };
}

function enrichExtractedRecipe(
  recipe: Record<string, unknown> | undefined,
  sourceMetadata?: {
    source_url?: string;
    source_name?: string;
    extra?: { thumbnail_url?: string | null };
  }
): Record<string, unknown> | undefined {
  if (!recipe) return undefined;

  const thumbnailUrl =
    sourceMetadata?.extra?.thumbnail_url &&
    typeof sourceMetadata.extra.thumbnail_url === "string"
      ? sourceMetadata.extra.thumbnail_url
      : undefined;

  return {
    ...recipe,
    source_url: recipe.source_url ?? sourceMetadata?.source_url ?? null,
    source_name: recipe.source_name ?? sourceMetadata?.source_name ?? null,
    image_url: recipe.image_url ?? thumbnailUrl ?? null,
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
    .select("id, title, start_date, end_date, status")
    .eq("user_id", ctx.user.id)
    .gte("end_date", startDate)
    .lte("start_date", endDate)
    .order("start_date", { ascending: true });

  if (status) {
    query = (query as any).eq("status", status);
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message, retryable: true };

  const plans = data || [];

  // Enrich each plan with child-table entry counts.
  const enriched = await Promise.all(plans.map(async (p: any) => {
    const { data: entries } = await ctx.supabase
      .from("meal_plan_entries" as any)
      .select("id, date, slot, recipe_name, list_key")
      .eq("meal_plan_id", p.id);
    const { data: groceries } = await ctx.supabase
      .from("grocery_list_items" as any)
      .select("id, name, is_checked, is_removed")
      .eq("meal_plan_id", p.id)
      .eq("is_removed", false);
    return {
      ...p,
      meal_count: (entries || []).length,
      grocery_count: (groceries || []).length,
      meals_summary: (entries || []).map((e: any) =>
        e.date ? `${e.date} ${e.slot}: ${e.recipe_name}` : `${e.list_key}: ${e.recipe_name}`
      ),
    };
  }));

  return {
    ok: true,
    data: { count: enriched.length, meal_plans: enriched },
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
  let plan: { id: string } | null = null;

  if (mealPlanId) {
    const { data, error } = await ctx.supabase
      .from("meal_plans")
      .select("id")
      .eq("id", mealPlanId)
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    if (error) return { ok: false, error: error.message, retryable: true };
    if (!data) return { ok: false, error: "Meal plan not found", retryable: false };
    plan = data as { id: string };
  } else {
    const { data, error } = await ctx.supabase
      .from("meal_plans")
      .select("id")
      .eq("user_id", ctx.user.id)
      .lte("start_date", date)
      .gte("end_date", date)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { ok: false, error: error.message, retryable: true };
    plan = (data as { id: string } | null) || null;
  }

  // Verify recipe belongs to user.
  const { data: recipe, error: recErr } = await ctx.supabase
    .from("recipes")
    .select("id, title, servings")
    .eq("id", recipeId)
    .maybeSingle();
  if (recErr || !recipe) {
    return { ok: false, error: "Recipe not found or you don't have access to it.", retryable: false };
  }
  const recipeTitle = (recipe as { title: string }).title;
  const recipeServings = (recipe as { servings?: number }).servings ?? 1;

  // No plan covering the date — create one (7-day window starting on date).
  if (!plan) {
    const planStart = date;
    const endDateObj = new Date(date);
    endDateObj.setDate(endDateObj.getDate() + 6);
    const planEnd = endDateObj.toISOString().split("T")[0];

    const { data: created, error: createErr } = await ctx.supabase
      .from("meal_plans")
      .insert({
        user_id: ctx.user.id,
        created_by: ctx.user.id,
        last_edited_by: ctx.user.id,
        start_date: planStart,
        end_date: planEnd,
        status: "draft",
      })
      .select("id")
      .single();
    if (createErr) return { ok: false, error: createErr.message, retryable: true };

    const newPlanId = (created as { id: string }).id;
    const { error: entryErr } = await ctx.supabase
      .from("meal_plan_entries" as any)
      .insert({
        meal_plan_id: newPlanId,
        date,
        slot,
        recipe_id: recipeId,
        recipe_name: recipeTitle,
        servings: recipeServings,
        base_servings: recipeServings,
        position: 0,
      });
    if (entryErr) return { ok: false, error: entryErr.message, retryable: true };

    return {
      ok: true,
      data: { meal_plan_id: newPlanId, date, slot, recipe_id: recipeId, recipe_title: recipeTitle, created_plan: true },
    };
  }

  // Plan exists — check if slot already has a different recipe.
  const { data: existingEntry } = await ctx.supabase
    .from("meal_plan_entries" as any)
    .select("id, recipe_id, recipe_name")
    .eq("meal_plan_id", plan.id)
    .eq("date", date)
    .eq("slot", slot)
    .limit(1)
    .maybeSingle();

  if (existingEntry && (existingEntry as any).recipe_id !== recipeId) {
    return {
      requiresConfirmation: true,
      summary: `That ${slot} slot on ${date} already has "${(existingEntry as any).recipe_name}". Overwrite it with "${recipeTitle}"?`,
      args: { meal_plan_id: plan.id, date, slot, recipe_id: recipeId, confirmed_overwrite: true },
    };
  }

  // Insert or update the entry.
  if (existingEntry) {
    // Same recipe already in slot — idempotent, no write needed.
  } else {
    const { error: entryErr } = await ctx.supabase
      .from("meal_plan_entries" as any)
      .insert({
        meal_plan_id: plan.id,
        date,
        slot,
        recipe_id: recipeId,
        recipe_name: recipeTitle,
        servings: recipeServings,
        base_servings: recipeServings,
        position: 0,
      });
    if (entryErr) return { ok: false, error: entryErr.message, retryable: true };
  }

  await ctx.supabase
    .from("meal_plans")
    .update({ last_edited_by: ctx.user.id })
    .eq("id", plan.id);

  return {
    ok: true,
    data: { meal_plan_id: plan.id, date, slot, recipe_id: recipeId, recipe_title: recipeTitle, created_plan: false },
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
  let planId: string | null = null;
  if (mealPlanId) {
    const { data, error } = await ctx.supabase
      .from("meal_plans")
      .select("id")
      .eq("id", mealPlanId)
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    if (error) return { ok: false, error: error.message, retryable: true };
    planId = (data as { id: string } | null)?.id || null;
  } else {
    const { data, error } = await ctx.supabase
      .from("meal_plans")
      .select("id")
      .eq("user_id", ctx.user.id)
      .eq("status", "active")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { ok: false, error: error.message, retryable: true };
    planId = (data as { id: string } | null)?.id || null;
  }

  if (!planId) {
    return { ok: false, error: "No active meal plan found to add the item to.", retryable: false };
  }

  // Get current count for position ordering.
  const { count: currentCount } = await ctx.supabase
    .from("grocery_list_items" as any)
    .select("id", { count: "exact", head: true })
    .eq("meal_plan_id", planId)
    .eq("is_removed", false);

  const amount = args.amount != null ? Number(args.amount) : null;
  const { data: newRow, error: insErr } = await ctx.supabase
    .from("grocery_list_items" as any)
    .insert({
      meal_plan_id: planId,
      name:         item,
      amount:       amount && !isNaN(amount) ? amount : null,
      unit:         (args.unit as string) || "",
      category:     (args.category as string) || "other",
      is_manual:    true,
      position:     currentCount ?? 0,
    })
    .select()
    .single();
  if (insErr) return { ok: false, error: insErr.message, retryable: true };

  return {
    ok: true,
    data: { meal_plan_id: planId, item: (newRow as any), total_items: (currentCount ?? 0) + 1 },
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
      UTILITY_TEXT_MODEL,
      {
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: "json_object" },
        billing: "chat",
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
// save_recipe — MOP-0018 P0
// Saves the extracted recipe to the library after a duplicate check.
// ─────────────────────────────────────────────────────────────────────

async function saveRecipe(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolHandlerResult> {
  const recipeArg = args.recipe as Record<string, unknown>;
  const overrideDuplicate = (args.override_duplicate as boolean | undefined) ?? false;

  if (!recipeArg || typeof recipeArg !== "object") {
    return { ok: false, error: "recipe argument is required and must be an object.", retryable: false };
  }

  const title = (recipeArg.title as string | undefined)?.trim();
  if (!title) {
    return { ok: false, error: "Recipe must have a title.", retryable: false };
  }

  // 1. Exact title duplicate check (case-insensitive).
  if (!overrideDuplicate) {
    const { data: exactMatch } = await ctx.supabase
      .from("recipes")
      .select("id, title")
      .eq("user_id", ctx.user.id)
      .ilike("title", title)
      .limit(1)
      .maybeSingle();

    if (exactMatch) {
      return {
        ok: true,
        data: {
          status: "duplicate",
          existing_recipe_id: (exactMatch as { id: string }).id,
          existing_title: (exactMatch as { title: string }).title,
          message: `You already have a recipe titled "${(exactMatch as { title: string }).title}". Pass override_duplicate: true to save a second copy, or update the existing recipe instead.`,
        },
      };
    }
  }

  // 2. Read user's default visibility preference.
  const { data: profileData } = await ctx.supabase
    .from("profiles")
    .select("default_recipe_visibility")
    .eq("id", ctx.user.id)
    .maybeSingle();
  const defaultVisibility = (profileData as { default_recipe_visibility?: string } | null)
    ?.default_recipe_visibility ?? "private";

  // 3. Build the insert row — map camelCase → snake_case for the DB.
  // Note: recipes has no household_id column — household-level sharing is
  // controlled entirely by the `visibility` field below (private/household/public).
  const insertRow: Record<string, unknown> = {
    user_id: ctx.user.id,
    title,
    description: recipeArg.description ?? null,
    ingredients: recipeArg.ingredients ?? [],
    instructions: recipeArg.instructions ?? [],
    prep_time: recipeArg.prepTime ?? recipeArg.prep_time ?? null,
    cook_time: recipeArg.cookTime ?? recipeArg.cook_time ?? null,
    total_time: recipeArg.totalTime ?? recipeArg.total_time ?? null,
    servings: recipeArg.servings ?? null,
    difficulty: recipeArg.difficulty ?? null,
    cuisine: recipeArg.cuisine ?? null,
    tags: recipeArg.tags ?? [],
    source_url: recipeArg.source_url ?? null,
    source_name: recipeArg.source_name ?? null,
    image_url: recipeArg.image_url ?? null,
    is_favorite: false,
    visibility: defaultVisibility,
    needs_reembed: true, // triggers async embedding refresh (MOP-0015)
  };

  const { data: saved, error: insertErr } = await ctx.supabase
    .from("recipes")
    .insert(insertRow)
    .select("id, title, created_at")
    .single();

  if (insertErr) {
    return { ok: false, error: `Failed to save recipe: ${insertErr.message}`, retryable: true };
  }

  const savedId = (saved as { id: string }).id;
  const savedTitle = (saved as { title: string }).title;
  return {
    ok: true,
    data: {
      status: "saved",
      recipe_id: savedId,
      title: savedTitle,
      message: `"${savedTitle}" has been saved to your recipe library. [View recipe →](/recipes/${savedId})`,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// check_recipe_safety — MOP-0018 P0
// Cross-references recipe ingredients against household allergen lists.
// Called proactively by the agent after every extraction.
// ─────────────────────────────────────────────────────────────────────

interface FamilyMember {
  name: string;
  allergens?: string[];
  dietary_restrictions?: string[];
}

async function checkRecipeSafety(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolHandlerResult> {
  const recipeArg = args.recipe as Record<string, unknown> | undefined;
  const recipeId = args.recipe_id as string | undefined;

  // 1. Get recipe data — either from passed object or by id.
  let ingredientNames: string[] = [];
  let recipeTitle = "this recipe";

  if (recipeArg && typeof recipeArg === "object") {
    recipeTitle = (recipeArg.title as string) || recipeTitle;
    const rawIngredients = recipeArg.ingredients;
    if (Array.isArray(rawIngredients)) {
      ingredientNames = rawIngredients.map((ing) => {
        if (typeof ing === "string") return ing.toLowerCase();
        if (ing && typeof ing === "object") {
          const i = ing as { name?: string };
          return (i.name || "").toLowerCase();
        }
        return "";
      }).filter(Boolean);
    }
  } else if (recipeId) {
    const { data: recipe, error } = await ctx.supabase
      .from("recipes")
      .select("title, ingredients")
      .eq("id", recipeId)
      .maybeSingle();
    if (error || !recipe) {
      return { ok: false, error: "Recipe not found.", retryable: false };
    }
    recipeTitle = (recipe as { title?: string }).title || recipeTitle;
    const rawIngredients = (recipe as { ingredients?: unknown[] }).ingredients || [];
    ingredientNames = rawIngredients.map((ing) => {
      if (typeof ing === "string") return ing.toLowerCase();
      if (ing && typeof ing === "object") {
        const i = ing as { name?: string };
        return (i.name || "").toLowerCase();
      }
      return "";
    }).filter(Boolean);
  } else {
    return { ok: false, error: "Provide either recipe or recipe_id.", retryable: false };
  }

  // 2. Get household profile.
  const { data: hhData, error: hhErr } = await ctx.supabase.rpc("get_my_household");
  if (hhErr) {
    return { ok: false, error: hhErr.message, retryable: true };
  }

  const members: FamilyMember[] = [];
  if (hhData && typeof hhData === "object") {
    const hh = hhData as { family_members?: FamilyMember[] };
    if (Array.isArray(hh.family_members)) {
      members.push(...hh.family_members);
    }
  }

  if (members.length === 0) {
    return {
      ok: true,
      data: {
        safe: true,
        warnings: [],
        message: "No household members with allergen profiles found.",
      },
    };
  }

  // 3. Cross-reference: for each member, check if any allergen appears in any ingredient name.
  const warnings: Array<{
    member: string;
    allergens: string[];
    matched_ingredients: string[];
  }> = [];

  for (const member of members) {
    const allergens = (member.allergens || []).map((a) => a.toLowerCase());
    if (allergens.length === 0) continue;

    const matchedIngredients: string[] = [];
    const matchedAllergens: string[] = [];

    for (const allergen of allergens) {
      for (const ingredient of ingredientNames) {
        if (ingredient.includes(allergen)) {
          if (!matchedIngredients.includes(ingredient)) matchedIngredients.push(ingredient);
          if (!matchedAllergens.includes(allergen)) matchedAllergens.push(allergen);
        }
      }
    }

    if (matchedIngredients.length > 0) {
      warnings.push({
        member: member.name,
        allergens: matchedAllergens,
        matched_ingredients: matchedIngredients,
      });
    }
  }

  const safe = warnings.length === 0;
  return {
    ok: true,
    data: {
      safe,
      recipe_title: recipeTitle,
      warnings,
      message: safe
        ? `${recipeTitle} appears safe for all household members. Always verify labels for packaged ingredients.`
        : warnings
            .map(
              (w) =>
                `⚠️ ${w.member} is allergic to ${w.allergens.join(", ")} — found in: ${w.matched_ingredients.join(", ")}.`
            )
            .join(" ") + " Always verify labels before serving.",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// get_grocery_list — MOP-0018 P1 (read-only)
// ─────────────────────────────────────────────────────────────────────

async function getGroceryList(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolHandlerResult> {
  const mealPlanId = args.meal_plan_id as string | undefined;

  type PlanRow = { id: string; title: string };
  let planRow: PlanRow | null = null;

  if (mealPlanId) {
    const { data, error } = await ctx.supabase
      .from("meal_plans")
      .select("id, title")
      .eq("id", mealPlanId)
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    if (error) return { ok: false, error: error.message, retryable: true };
    planRow = data as unknown as PlanRow | null;
  } else {
    const { data: activePlan } = await ctx.supabase
      .from("meal_plans")
      .select("id, title")
      .eq("user_id", ctx.user.id)
      .eq("status", "active")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activePlan) {
      planRow = activePlan as unknown as PlanRow;
    } else {
      const { data: draftPlan, error } = await ctx.supabase
        .from("meal_plans")
        .select("id, title")
        .eq("user_id", ctx.user.id)
        .eq("status", "draft")
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return { ok: false, error: error.message, retryable: true };
      planRow = draftPlan as unknown as PlanRow | null;
    }
  }

  if (!planRow) {
    return { ok: true, data: { items: [], count: 0, message: "No meal plan found with a grocery list." } };
  }

  const { data: items, error: itemsErr } = await ctx.supabase
    .from("grocery_list_items" as any)
    .select("id, name, amount, unit, category, is_checked, is_removed, is_manual, notes")
    .eq("meal_plan_id", planRow.id)
    .eq("is_removed", false)
    .order("position", { ascending: true });
  if (itemsErr) return { ok: false, error: itemsErr.message, retryable: true };

  return {
    ok: true,
    data: { meal_plan_id: planRow.id, meal_plan_title: planRow.title, count: (items || []).length, items: items || [] },
  };
}

// ─────────────────────────────────────────────────────────────────────
// mark_grocery_item_purchased — MOP-0018 P2
// ─────────────────────────────────────────────────────────────────────

async function markGroceryItemPurchased(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolHandlerResult> {
  const itemName = (args.item_name as string).toLowerCase();
  const purchased = (args.purchased as boolean | undefined) ?? true;
  const mealPlanId = args.meal_plan_id as string | undefined;

  // Resolve the target plan id.
  let resolvedPlanId: string | null = null;
  if (mealPlanId) {
    const { data, error } = await ctx.supabase
      .from("meal_plans")
      .select("id")
      .eq("id", mealPlanId)
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    if (error) return { ok: false, error: error.message, retryable: true };
    resolvedPlanId = (data as { id: string } | null)?.id || null;
  } else {
    const { data, error } = await ctx.supabase
      .from("meal_plans")
      .select("id")
      .eq("user_id", ctx.user.id)
      .eq("status", "active")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { ok: false, error: error.message, retryable: true };
    resolvedPlanId = (data as { id: string } | null)?.id || null;
  }

  if (!resolvedPlanId) {
    return { ok: false, error: "No active meal plan found.", retryable: false };
  }

  // Find matching items by name (case-insensitive contains).
  const { data: items, error: fetchErr } = await ctx.supabase
    .from("grocery_list_items" as any)
    .select("id, name")
    .eq("meal_plan_id", resolvedPlanId)
    .eq("is_removed", false);
  if (fetchErr) return { ok: false, error: fetchErr.message, retryable: true };

  const matched = ((items || []) as { id: string; name: string }[]).filter((i) => {
    const n = i.name.toLowerCase();
    return n.includes(itemName) || itemName.includes(n);
  });

  if (matched.length === 0) {
    return { ok: false, error: `No item matching "${itemName}" found in the grocery list.`, retryable: false };
  }

  const matchedIds = matched.map((i) => i.id);
  const { error: updErr } = await ctx.supabase
    .from("grocery_list_items" as any)
    .update({ is_checked: purchased })
    .in("id", matchedIds);
  if (updErr) return { ok: false, error: updErr.message, retryable: true };

  return {
    ok: true,
    data: { updated: true, item_name: itemName, purchased, matched_items: matched.map((i) => i.name), meal_plan_id: resolvedPlanId },
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
// remove_grocery_item — MOP-0018 P1
// ─────────────────────────────────────────────────────────────────────

async function removeGroceryItem(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolHandlerResult> {
  const itemName = (args.item_name as string).toLowerCase();
  const mealPlanId = args.meal_plan_id as string | undefined;

  let resolvedPlanId: string | null = null;
  if (mealPlanId) {
    const { data, error } = await ctx.supabase
      .from("meal_plans")
      .select("id")
      .eq("id", mealPlanId)
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    if (error) return { ok: false, error: error.message, retryable: true };
    resolvedPlanId = (data as { id: string } | null)?.id || null;
  } else {
    const { data, error } = await ctx.supabase
      .from("meal_plans")
      .select("id")
      .eq("user_id", ctx.user.id)
      .eq("status", "active")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { ok: false, error: error.message, retryable: true };
    resolvedPlanId = (data as { id: string } | null)?.id || null;
  }

  if (!resolvedPlanId) {
    return { ok: false, error: "No active meal plan found.", retryable: false };
  }

  const { data: items, error: fetchErr } = await ctx.supabase
    .from("grocery_list_items" as any)
    .select("id, name")
    .eq("meal_plan_id", resolvedPlanId)
    .eq("is_removed", false);
  if (fetchErr) return { ok: false, error: fetchErr.message, retryable: true };

  const matched = ((items || []) as { id: string; name: string }[]).filter((i) => {
    const n = i.name.toLowerCase();
    return n.includes(itemName) || itemName.includes(n);
  });

  if (matched.length === 0) {
    return { ok: false, error: `No item matching "${itemName}" found in the grocery list.`, retryable: false };
  }

  const matchedIds = matched.map((i) => i.id);
  const { error: updErr } = await ctx.supabase
    .from("grocery_list_items" as any)
    .update({ is_removed: true })
    .in("id", matchedIds);
  if (updErr) return { ok: false, error: updErr.message, retryable: true };

  const remaining = ((items || []) as { id: string }[]).length - matched.length;
  return {
    ok: true,
    data: { removed_count: matched.length, item_name: itemName, remaining, meal_plan_id: resolvedPlanId },
  };
}

// ─────────────────────────────────────────────────────────────────────
// create_meal_plan — MOP-0018 P1
// ─────────────────────────────────────────────────────────────────────

async function createMealPlan(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolHandlerResult> {
  const startDate = args.start_date as string;
  const endDate = args.end_date as string;
  const title =
    (args.title as string | undefined) ||
    `Meal Plan (${startDate} – ${endDate})`;

  const { data: created, error } = await ctx.supabase
    .from("meal_plans")
    .insert({
      user_id: ctx.user.id,
      created_by: ctx.user.id,
      last_edited_by: ctx.user.id,
      title,
      start_date: startDate,
      end_date: endDate,
      status: "draft",
    })
    .select("id, title, start_date, end_date, status")
    .single();

  if (error) return { ok: false, error: error.message, retryable: true };

  return {
    ok: true,
    data: {
      meal_plan_id: (created as { id: string }).id,
      title: (created as { title: string }).title,
      start_date: startDate,
      end_date: endDate,
      status: "draft",
      message: `Created "${title}". You can now assign recipes to slots.`,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// clear_meal_plan_slot — MOP-0018 P1
// ─────────────────────────────────────────────────────────────────────

async function clearMealPlanSlot(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolHandlerResult> {
  const date = args.date as string;
  const slot = args.slot as string;
  const mealPlanId = args.meal_plan_id as string | undefined;

  let resolvedPlanId: string | null = null;
  if (mealPlanId) {
    const { data, error } = await ctx.supabase
      .from("meal_plans")
      .select("id")
      .eq("id", mealPlanId)
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    if (error) return { ok: false, error: error.message, retryable: true };
    resolvedPlanId = (data as { id: string } | null)?.id || null;
  } else {
    const { data, error } = await ctx.supabase
      .from("meal_plans")
      .select("id")
      .eq("user_id", ctx.user.id)
      .lte("start_date", date)
      .gte("end_date", date)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { ok: false, error: error.message, retryable: true };
    resolvedPlanId = (data as { id: string } | null)?.id || null;
  }

  if (!resolvedPlanId) {
    return { ok: false, error: `No meal plan found covering ${date}.`, retryable: false };
  }

  // Check if any entries exist in this slot.
  const { data: existing } = await ctx.supabase
    .from("meal_plan_entries" as any)
    .select("id")
    .eq("meal_plan_id", resolvedPlanId)
    .eq("date", date)
    .eq("slot", slot);

  if (!existing || (existing as any[]).length === 0) {
    return { ok: true, data: { message: `The ${slot} slot on ${date} was already empty.`, meal_plan_id: resolvedPlanId } };
  }

  const { error: delErr } = await ctx.supabase
    .from("meal_plan_entries" as any)
    .delete()
    .eq("meal_plan_id", resolvedPlanId)
    .eq("date", date)
    .eq("slot", slot);
  if (delErr) return { ok: false, error: delErr.message, retryable: true };

  await ctx.supabase
    .from("meal_plans")
    .update({ last_edited_by: ctx.user.id })
    .eq("id", resolvedPlanId);

  return { ok: true, data: { cleared: true, date, slot, meal_plan_id: resolvedPlanId } };
}

// ─────────────────────────────────────────────────────────────────────
// react_to_recipe — MOP-0018 P2
// Upserts a thumbs_up / thumbs_down / removes reaction for a family member.
// ─────────────────────────────────────────────────────────────────────

async function reactToRecipe(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolHandlerResult> {
  const recipeId = args.recipe_id as string;
  const reaction = args.reaction as "thumbs_up" | "thumbs_down" | "remove";
  const memberName = args.member_name as string | undefined;

  // Verify the recipe is accessible.
  const { data: recipe, error: recErr } = await ctx.supabase
    .from("recipes")
    .select("id, title")
    .eq("id", recipeId)
    .maybeSingle();
  if (recErr || !recipe) {
    return { ok: false, error: "Recipe not found or you don't have access to it.", retryable: false };
  }
  const recipeTitle = (recipe as { title: string }).title;

  // Determine reactor: family member by name, or the authenticated user.
  let familyMemberId: string | null = null;
  let reactorLabel = "you";

  if (memberName) {
    const { data: members } = await ctx.supabase
      .from("family_members")
      .select("id, name")
      .eq("managed_by", ctx.user.id)
      .eq("is_active", true)
      .ilike("name", memberName);

    if (!members || members.length === 0) {
      return {
        ok: false,
        error: `No family member named "${memberName}" found. Check the name and try again.`,
        retryable: false,
      };
    }
    familyMemberId = (members[0] as { id: string }).id;
    reactorLabel = (members[0] as { name: string }).name;
  }

  // Remove reaction.
  if (reaction === "remove") {
    const deleteQuery = ctx.supabase.from("recipe_reactions").delete();
    const filtered = familyMemberId
      ? (deleteQuery as any).eq("recipe_id", recipeId).eq("family_member_id", familyMemberId)
      : (deleteQuery as any).eq("recipe_id", recipeId).eq("user_id", ctx.user.id);
    const { error } = await filtered;
    if (error) return { ok: false, error: error.message, retryable: true };
    return {
      ok: true,
      data: { removed: true, recipe_title: recipeTitle, reactor: reactorLabel },
    };
  }

  // Upsert reaction.
  const row: { recipe_id: string; user_id: string | null; family_member_id: string | null; reaction: typeof reaction } = familyMemberId
    ? { recipe_id: recipeId, family_member_id: familyMemberId, user_id: null, reaction }
    : { recipe_id: recipeId, user_id: ctx.user.id, family_member_id: null, reaction };

  const conflictColumn = familyMemberId
    ? "recipe_id, family_member_id"
    : "recipe_id, user_id";

  const { error: upsertErr } = await ctx.supabase
    .from("recipe_reactions")
    .upsert(row, { onConflict: conflictColumn });

  if (upsertErr) return { ok: false, error: upsertErr.message, retryable: true };

  const emoji = reaction === "thumbs_up" ? "👍" : "👎";
  return {
    ok: true,
    data: {
      reaction,
      recipe_id: recipeId,
      recipe_title: recipeTitle,
      reactor: reactorLabel,
      message: `${emoji} Marked "${recipeTitle}" as ${reaction === "thumbs_up" ? "liked" : "disliked"} for ${reactorLabel}.`,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// get_recommendations — MOP-0018 P2
// Recipes the household or a named member tends to like.
// ─────────────────────────────────────────────────────────────────────

async function getRecommendations(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolHandlerResult> {
  const memberName = args.member_name as string | undefined;
  const reactionFilter = (args.reaction as string | undefined) ?? "thumbs_up";
  const limit = (args.limit as number | undefined) ?? 10;

  // Resolve family member ID if name given.
  let familyMemberId: string | null = null;
  let scopeLabel = "your household";

  if (memberName) {
    const { data: members } = await ctx.supabase
      .from("family_members")
      .select("id, name")
      .eq("managed_by", ctx.user.id)
      .eq("is_active", true)
      .ilike("name", memberName);

    if (!members || members.length === 0) {
      return {
        ok: false,
        error: `No family member named "${memberName}" found.`,
        retryable: false,
      };
    }
    familyMemberId = (members[0] as { id: string }).id;
    scopeLabel = (members[0] as { name: string }).name;
  }

  // Query reactions joined to recipes.
  // When a specific member is named, filter by family_member_id.
  // When no member is named, return recipes that have at least one thumbs_up
  // from anyone in the household (user_id = auth user OR family_member managed_by auth user).
  let query = ctx.supabase
    .from("recipe_reactions")
    .select(
      "recipe_id, reaction, recipes!inner(id, title, description, cuisine, difficulty, prep_time, cook_time, tags)"
    )
    .eq("reaction", reactionFilter);

  if (familyMemberId) {
    query = (query as any).eq("family_member_id", familyMemberId);
  } else {
    // Household scope: reactions by the user themselves.
    query = (query as any).eq("user_id", ctx.user.id);
  }

  const { data, error } = await (query as any).limit(limit);
  if (error) return { ok: false, error: error.message, retryable: true };

  const results = (data || []).map((row: any) => ({
    recipe_id: row.recipe_id,
    title: row.recipes?.title,
    description: row.recipes?.description,
    cuisine: row.recipes?.cuisine,
    difficulty: row.recipes?.difficulty,
    prep_time: row.recipes?.prep_time,
    cook_time: row.recipes?.cook_time,
    tags: row.recipes?.tags,
  }));

  return {
    ok: true,
    data: {
      scope: scopeLabel,
      reaction: reactionFilter,
      count: results.length,
      results,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// update_member_allergens — MOP-0018 P2 (always destructive — gated)
// ─────────────────────────────────────────────────────────────────────

async function updateMemberAllergens(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolHandlerResult> {
  const memberName = args.member_name as string;
  const add = (args.add as string[] | undefined) ?? [];
  const remove = (args.remove as string[] | undefined) ?? [];

  if (add.length === 0 && remove.length === 0) {
    return { ok: false, error: "Provide at least one allergen to add or remove.", retryable: false };
  }

  // Resolve member.
  const { data: members, error: memberErr } = await ctx.supabase
    .from("family_members")
    .select("id, name, allergies")
    .eq("managed_by", ctx.user.id)
    .eq("is_active", true)
    .ilike("name", memberName);

  if (memberErr) return { ok: false, error: memberErr.message, retryable: true };
  if (!members || members.length === 0) {
    return {
      ok: false,
      error: `No family member named "${memberName}" found.`,
      retryable: false,
    };
  }

  const member = members[0] as { id: string; name: string; allergies: string[] | null };
  const current = new Set<string>((member.allergies || []).map((a) => a.toLowerCase()));

  for (const a of add) current.add(a.toLowerCase());
  for (const r of remove) current.delete(r.toLowerCase());

  const updated = Array.from(current);

  const { error: updErr } = await ctx.supabase
    .from("family_members")
    .update({ allergies: updated })
    .eq("id", member.id)
    .eq("managed_by", ctx.user.id);

  if (updErr) return { ok: false, error: updErr.message, retryable: true };

  return {
    ok: true,
    data: {
      member_name: member.name,
      allergies: updated,
      added: add,
      removed: remove,
      message: `Updated ${member.name}'s allergen list. Current allergies: ${updated.length > 0 ? updated.join(", ") : "none"}.`,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// scale_recipe — MOP-0018 P2 (read-only)
// Returns ingredient quantities scaled to a target serving count.
// ─────────────────────────────────────────────────────────────────────

async function scaleRecipe(
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolHandlerResult> {
  const recipeId = args.recipe_id as string;
  const targetServings = args.target_servings as number;

  const { data: recipe, error } = await ctx.supabase
    .from("recipes")
    .select("id, title, servings, ingredients, instructions, prep_time, cook_time")
    .eq("id", recipeId)
    .maybeSingle();

  if (error || !recipe) {
    return { ok: false, error: "Recipe not found or you don't have access to it.", retryable: false };
  }

  const originalServings = (recipe as { servings?: number }).servings;
  if (!originalServings || originalServings <= 0) {
    return {
      ok: false,
      error: "This recipe doesn't have a serving count — can't scale it.",
      retryable: false,
    };
  }

  const factor = targetServings / originalServings;
  const rawIngredients = (recipe as { ingredients?: unknown[] }).ingredients || [];

  const scaled = rawIngredients.map((ing) => {
    if (!ing || typeof ing !== "object") return ing;
    const i = ing as { name?: string; amount?: number; unit?: string; category?: string; notes?: string };
    return {
      ...i,
      amount: i.amount != null ? Math.round(i.amount * factor * 100) / 100 : null,
    };
  });

  return {
    ok: true,
    data: {
      recipe_id: recipeId,
      title: (recipe as { title: string }).title,
      original_servings: originalServings,
      target_servings: targetServings,
      scale_factor: Math.round(factor * 100) / 100,
      ingredients: scaled,
      instructions: (recipe as { instructions?: string[] }).instructions || [],
      prep_time: (recipe as { prep_time?: number }).prep_time,
      cook_time: (recipe as { cook_time?: number }).cook_time,
      note: `Scaled from ${originalServings} to ${targetServings} servings. Times don't change — adjust based on batch size.`,
    },
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
  // MOP-0018: new tools (P0 + P1)
  save_recipe: saveRecipe as ToolHandler,
  check_recipe_safety: checkRecipeSafety as ToolHandler,
  get_grocery_list: getGroceryList as ToolHandler,
  mark_grocery_item_purchased: markGroceryItemPurchased as ToolHandler,
  remove_grocery_item: removeGroceryItem as ToolHandler,
  create_meal_plan: createMealPlan as ToolHandler,
  clear_meal_plan_slot: clearMealPlanSlot as ToolHandler,
  // MOP-0018: P2
  react_to_recipe: reactToRecipe as ToolHandler,
  get_recommendations: getRecommendations as ToolHandler,
  update_member_allergens: updateMemberAllergens as ToolHandler,
  scale_recipe: scaleRecipe as ToolHandler,
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
    // Re-run the handler with the confirmed_overwrite flag — the assign
    // handler itself doesn't gate on that flag; we overwrite the slot's
    // entry in meal_plan_entries directly here.
    const mealPlanId = args.meal_plan_id as string;
    const date = args.date as string;
    const slot = args.slot as string;
    const recipeId = args.recipe_id as string;

    const { data: plan, error: planErr } = await ctx.supabase
      .from("meal_plans")
      .select("id")
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

    const { data: recipe, error: recErr } = await ctx.supabase
      .from("recipes")
      .select("id, title, servings")
      .eq("id", recipeId)
      .maybeSingle();
    if (recErr || !recipe) {
      return { ok: false, error: "Recipe not found or you don't have access to it.", retryable: false };
    }
    const recipeTitle = (recipe as { title: string }).title;
    const recipeServings = (recipe as { servings?: number }).servings ?? 1;

    const { error: delErr } = await ctx.supabase
      .from("meal_plan_entries" as any)
      .delete()
      .eq("meal_plan_id", mealPlanId)
      .eq("date", date)
      .eq("slot", slot);
    if (delErr) return { ok: false, error: delErr.message, retryable: true };

    const { error: insErr } = await ctx.supabase
      .from("meal_plan_entries" as any)
      .insert({
        meal_plan_id: mealPlanId,
        date,
        slot,
        recipe_id: recipeId,
        recipe_name: recipeTitle,
        servings: recipeServings,
        base_servings: recipeServings,
        position: 0,
      });
    if (insErr) return { ok: false, error: insErr.message, retryable: true };

    await ctx.supabase
      .from("meal_plans")
      .update({ last_edited_by: ctx.user.id })
      .eq("id", mealPlanId);

    return {
      ok: true,
      data: { meal_plan_id: mealPlanId, date, slot, recipe_id: recipeId, recipe_title: recipeTitle },
    };
  }

  if (name === "update_member_allergens") {
    return updateMemberAllergens(args, ctx);
  }

  return { ok: false, error: `No confirmed-execution path for ${name}`, retryable: false };
}
