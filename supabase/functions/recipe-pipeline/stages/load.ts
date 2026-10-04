/**
 * Load stage — duplicate check, embedding generation, and database insert.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { OpenRouterClient } from "../../_shared/openrouter-client.ts";
import type { ValidatedRecipe } from "../../_shared/recipe-schema.ts";
import { createPipelineError } from "../../_shared/recipe-schema.ts";
import { generateRecipeEmbedding } from "../../_shared/embedding-utils.ts";
import { checkAllergies } from "../../_shared/allergy-checker.ts";
import type { AllergyProfile } from "../../_shared/allergy-checker.ts";

export async function load(
  recipe: ValidatedRecipe,
  userId: string,
  supabase: SupabaseClient,
  openRouter: OpenRouterClient
): Promise<{ recipe_id: string; record: any }> {
  // ── Duplicate check ──
  const { data: existing } = await supabase
    .from("recipes")
    .select("id, title")
    .eq("user_id", userId)
    .ilike("title", recipe.title.trim())
    .maybeSingle();

  if (existing) {
    throw createPipelineError(
      "load",
      "DUPLICATE_RECIPE",
      `A recipe named "${existing.title}" already exists`,
      { existing_id: existing.id }
    );
  }

  // ── Generate embedding (non-fatal) ──
  const embedding = await generateRecipeEmbedding(openRouter, recipe);

  // ── Allergy check (non-blocking) ──
  // Gather household member allergy profiles and the owner's own profile.
  // Any error here must not block the recipe save.
  const allergyTags: string[] = [];
  try {
    const profiles: AllergyProfile[] = [];

    // Household family members with allergies
    const { data: members, error: membersError } = await supabase
      .from("family_members")
      .select("name, allergies, household_id")
      .eq("is_active", true)
      .not("allergies", "is", null);

    if (membersError) {
      console.warn("[load] Could not fetch family members for allergy check:", membersError.message);
    } else if (members && members.length > 0) {
      // Filter to members in a household the owner belongs to
      const { data: hm } = await supabase
        .from("household_members")
        .select("household_id")
        .eq("user_id", userId);

      const ownedHouseholdIds = new Set((hm ?? []).map((r: { household_id: string }) => r.household_id));

      for (const m of members) {
        if (
          ownedHouseholdIds.has(m.household_id) &&
          Array.isArray(m.allergies) &&
          m.allergies.length > 0
        ) {
          profiles.push({ memberName: m.name, allergies: m.allergies });
        }
      }
    }

    // Owner's own allergies from profiles table
    const { data: ownerProfile, error: profileError } = await supabase
      .from("profiles")
      .select("allergies, display_name, username")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.warn("[load] Could not fetch owner profile for allergy check:", profileError.message);
    } else if (ownerProfile?.allergies && ownerProfile.allergies.length > 0) {
      const ownerName =
        ownerProfile.display_name || ownerProfile.username || "Owner";
      profiles.push({ memberName: ownerName, allergies: ownerProfile.allergies });
    }

    if (profiles.length > 0 && recipe.ingredients?.length > 0) {
      const result = checkAllergies(recipe.ingredients, profiles);
      allergyTags.push(...result.tags);
      if (result.matchedMembers.length > 0) {
        console.log(
          `[load] Allergy check flagged members: ${result.matchedMembers.join(", ")} — tags: ${result.tags.join(", ")}`
        );
      }
    }
  } catch (err) {
    console.warn("[load] Allergy check failed (non-blocking):", err);
  }

  // Merge allergy tags into recipe tags (deduplicated)
  const mergedTags = [...new Set([...(recipe.tags ?? []), ...allergyTags])];

  // ── Insert into database ──
  const { data, error } = await supabase
    .from("recipes")
    .insert({
      user_id: userId,
      title: recipe.title,
      description: recipe.description,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      prep_time: recipe.prep_time,
      cook_time: recipe.cook_time,
      total_time: recipe.total_time,
      servings: recipe.servings,
      difficulty: recipe.difficulty,
      cuisine: recipe.cuisine,
      tags: mergedTags,
      image_url: recipe.image_url,
      nutrition_info: recipe.nutrition_info,
      source_url: recipe.source_url,
      source_name: recipe.source_name,
      slug: recipe.slug,
      visibility: 'private',
      is_favorite: false,
      ...(embedding ? { embedding_vector: `[${embedding.join(",")}]` } : {}),
    })
    .select()
    .single();

  if (error) {
    throw createPipelineError("load", "DB_ERROR", `Database insert failed: ${error.message}`, {
      code: error.code,
      details: error.details,
    });
  }

  console.log(`Recipe loaded: ${data.id} — "${recipe.title}"`);
  return { recipe_id: data.id, record: data };
}
