/**
 * MOP-0015 Phase 2 — Embedding Refresh Lifecycle
 *
 * Scheduled edge function that consumes the `needs_reembed` flag written by
 * the `update_recipe_embedding` trigger (migration 029). For each flagged row
 * it generates a fresh embedding via OpenRouter and writes it back, then clears
 * the flag.
 *
 * Invocation: Supabase Cron / pg_cron — every 5 minutes.
 * Auth: service-role client (crosses user boundaries — never expose publicly).
 *
 * Hard limits:
 *   BATCH_SIZE   — rows per invocation (avoid hitting edge-function timeout)
 *   MAX_DURATION — bail out of the per-row loop before the function timeout
 */

import { createServiceClient } from "../_shared/supabase-client.ts";
import { createOpenRouterClient } from "../_shared/openrouter-client.ts";
import { generateRecipeEmbedding } from "../_shared/embedding-utils.ts";
import type { ValidatedRecipe } from "../_shared/recipe-schema.ts";

const BATCH_SIZE = 50;
const MAX_DURATION_MS = 25_000; // leave 5s headroom before the 30s edge timeout

Deno.serve(async (_req: Request) => {
  const startedAt = Date.now();

  const supabase = createServiceClient();
  const openRouter = createOpenRouterClient();

  // ── Fetch the next batch of stale rows ───────────────────────────────────────
  const { data: rows, error: fetchError } = await supabase
    .from("recipes")
    .select("id, title, description, cuisine, difficulty, tags, ingredients, instructions")
    .eq("needs_reembed", true)
    .limit(BATCH_SIZE);

  if (fetchError) {
    console.error("[embedding-refresh] Failed to fetch rows:", fetchError.message);
    return new Response(
      JSON.stringify({ error: fetchError.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const results = { processed: 0, succeeded: 0, failed: 0, skipped: 0, durationMs: 0 };

  for (const row of rows ?? []) {
    // Bail before edge-function timeout so partial progress is still committed.
    if (Date.now() - startedAt > MAX_DURATION_MS) {
      console.warn(`[embedding-refresh] Approaching timeout — stopping after ${results.processed} rows`);
      break;
    }

    results.processed++;

    // generateRecipeEmbedding expects a ValidatedRecipe-shaped object.
    // The DB row has exactly the fields createRecipeText uses.
    const recipeForEmbed = row as unknown as ValidatedRecipe;

    const embedding = await generateRecipeEmbedding(openRouter, recipeForEmbed);

    if (!embedding) {
      // generateRecipeEmbedding already logged the error (non-fatal). Leave
      // needs_reembed = true so the next cron run retries.
      console.warn(`[embedding-refresh] Skipping row ${row.id} — embedding generation returned null`);
      results.failed++;
      continue;
    }

    // Write the new vector and clear the flag atomically on the same row.
    const { error: updateError } = await supabase
      .from("recipes")
      .update({
        embedding_vector: JSON.stringify(embedding),
        needs_reembed: false,
      })
      .eq("id", row.id)
      // Safety: only update the row if it is still flagged (re-edit mid-batch
      // would have re-set the flag; in that case skip and let the next run pick
      // it up with the freshest content).
      .eq("needs_reembed", true);

    if (updateError) {
      console.error(`[embedding-refresh] Update failed for row ${row.id}:`, updateError.message);
      results.failed++;
    } else {
      results.succeeded++;
    }
  }

  results.durationMs = Date.now() - startedAt;

  console.log(
    `[embedding-refresh] done — processed=${results.processed} succeeded=${results.succeeded} ` +
    `failed=${results.failed} durationMs=${results.durationMs}`
  );

  // Return only aggregate counts — no user data in the response.
  return new Response(JSON.stringify(results), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
