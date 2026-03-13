/**
 * Recipe Pipeline Edge Function
 *
 * Endpoints:
 *   POST /ingest        — full pipeline: adapter → extract → transform → load
 *   POST /extract-only  — extract + transform, no save (for chat preview)
 *   POST /check-similar — find similar existing recipes by embedding
 *   GET  /health        — health check
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, corsResponse, corsError } from "../_shared/cors.ts";
import { getUserFromToken } from "../_shared/supabase-client.ts";
import { createOpenRouterClient } from "../_shared/openrouter-client.ts";
import type { PipelineRequest } from "../_shared/recipe-schema.ts";
import { createRecipeText } from "../_shared/embedding-utils.ts";
import { runPipeline } from "./pipeline.ts";

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;

    // ── Health check (no auth) ──
    if (req.method === "GET" && path.includes("/health")) {
      return corsResponse({
        status: "OK",
        service: "recipe-pipeline",
        timestamp: new Date().toISOString(),
      });
    }

    // ── Require auth for all other endpoints ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return corsError("Authentication required", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const auth = await getUserFromToken(token);
    if (!auth) {
      return corsError("Invalid or expired token", 401);
    }

    const { user, supabase } = auth;

    // ── Create OpenRouter client ──
    let openRouter;
    try {
      openRouter = createOpenRouterClient();
    } catch {
      return corsError("OpenRouter API key not configured", 500);
    }

    // ── Route to handler ──
    if (req.method !== "POST") {
      return corsError("Method not allowed", 405);
    }

    // ── Check-similar endpoint ──
    if (path.includes("/check-similar")) {
      const { title, description, ingredients, instructions, tags, cuisine, difficulty } =
        await req.json();

      if (!title) {
        return corsError("title is required", 400);
      }

      // Build a recipe-like object compatible with createRecipeText
      const recipeText = createRecipeText({
        title,
        description: description ?? "",
        ingredients: ingredients ?? [],
        instructions: instructions ?? [],
        tags: tags ?? [],
        cuisine: cuisine ?? "",
        difficulty: difficulty ?? "",
      } as any);

      const embedding = await openRouter.generateEmbedding(recipeText);

      const { data, error } = await supabase.rpc("search_recipes_semantic", {
        query_embedding: JSON.stringify(embedding),
        user_id: user.id,
        match_threshold: 0.7,
        match_count: 5,
      });

      if (error) {
        console.error("search_recipes_semantic error:", error);
        return corsError("Failed to search for similar recipes", 500);
      }

      const similar = (data ?? []).map((r: any) => ({
        id: r.id,
        title: r.title,
        similarity: r.similarity,
      }));

      return corsResponse({ similar });
    }

    const body: PipelineRequest = await req.json();

    if (path.includes("/extract-only")) {
      // Extract + Transform only (no save)
      body.auto_save = false;
    }

    // Validate source_type
    if (!["url", "text", "video"].includes(body.source_type)) {
      return corsError(
        `Invalid source_type: "${body.source_type}". Must be "url", "text", or "video".`,
        400
      );
    }

    // Run pipeline
    const result = await runPipeline(body, user.id, supabase, openRouter);

    return corsResponse(result, result.success ? 200 : 422);
  } catch (error) {
    console.error("Pipeline error:", error);
    return corsError(error.message || "Internal server error", 500);
  }
});
