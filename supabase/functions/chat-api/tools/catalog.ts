/**
 * MOP-0008 — Tool catalog for the chat agent.
 *
 * Each entry is OpenAI-compatible tool spec. JSON Schemas use
 * `additionalProperties: false` and NEVER accept `user_id`. The user is
 * always resolved via auth.uid() inside the handler.
 *
 * The `destructive` flag is consumed by the dispatcher:
 *   - true        → short-circuit with a confirmation envelope
 *   - "conditional" → handler decides (e.g. occupied meal-plan slot)
 *   - false       → execute immediately
 */

import type { ToolSpec } from "../../_shared/openrouter-client.ts";
import { isConfigured as isWebSearchConfigured } from "../../_shared/web-search-client.ts";

export interface CatalogEntry {
  spec: ToolSpec;
  destructive: boolean | "conditional";
  /**
   * Optional gate evaluated at `getToolSpecs()` time. When this returns
   * `false`, the tool is omitted from the catalog presented to the model
   * (used by `web_search_recipe` when WEB_SEARCH_API_KEY is unset).
   */
  available?: () => boolean;
}

export const TOOL_CATALOG: CatalogEntry[] = [
  {
    destructive: false,
    spec: {
      type: "function",
      function: {
        name: "search_recipes",
        description:
          "Search the user's saved recipes by free-text query. Returns up to 5 matches via hybrid semantic + full-text search. Use this when the user asks 'find', 'search', 'show me', 'do I have', or refers to a recipe by description.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              minLength: 1,
              description:
                "Natural-language search query, e.g. 'spicy chicken' or 'dinner with rice'",
            },
            filters: {
              type: "object",
              properties: {
                cuisine: { type: "string" },
                max_total_time_minutes: { type: "integer", minimum: 0 },
                difficulty: {
                  type: "string",
                  enum: ["easy", "medium", "hard"],
                },
                tags_any: {
                  type: "array",
                  items: { type: "string" },
                  maxItems: 8,
                },
              },
              additionalProperties: false,
            },
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
    },
  },
  {
    destructive: false,
    spec: {
      type: "function",
      function: {
        name: "find_similar_recipes",
        description:
          "Given an existing recipe ID, find up to 5 saved recipes similar by ingredients and style (cosine similarity over recipe embedding). Use when the user says 'something like X', 'more like this', or 'similar to'.",
        parameters: {
          type: "object",
          properties: {
            recipe_id: { type: "string", format: "uuid" },
            limit: {
              type: "integer",
              minimum: 1,
              maximum: 5,
              default: 5,
            },
          },
          required: ["recipe_id"],
          additionalProperties: false,
        },
      },
    },
  },
  {
    destructive: false,
    spec: {
      type: "function",
      function: {
        name: "extract_recipe_from_source",
        description:
          "Extract a structured recipe from a URL, pasted text, attached images, or a short-form video (TikTok/YouTube/Reels) by invoking the recipe-pipeline edge function. Does NOT save — returns a preview the user must confirm via UI. For TikTok/YouTube URLs use source_type=url or video. For uploaded video files the client supplies frame_urls and media_url.",
        parameters: {
          type: "object",
          properties: {
            source_type: {
              type: "string",
              enum: ["url", "text", "images", "video"],
            },
            url: {
              type: "string",
              format: "uri",
              description:
                "Required when source_type=url. TikTok/YouTube/Reels URLs use oEmbed (caption + link mining), not HTML scrape.",
            },
            pinned_comment_text: {
              type: "string",
              description:
                "Optional creator pinned comment when source_type is url or video",
            },
            supplementary_text: {
              type: "string",
              description: "Optional extra caption/comment text from the creator",
            },
            text: {
              type: "string",
              minLength: 1,
              description: "Required when source_type=text",
            },
            video_url: {
              type: "string",
              format: "uri",
              description:
                "Short-form video URL when source_type=video (TikTok, YouTube, Instagram Reel)",
            },
            transcript: {
              type: "string",
              description:
                "Optional pre-computed transcript (usually supplied by client after upload)",
            },
            use_attached_images: {
              type: "boolean",
              default: false,
              description:
                "Use images attached to the current user message (the runtime injects them — do not pass image data)",
            },
          },
          required: ["source_type"],
          additionalProperties: false,
        },
      },
    },
  },
  {
    destructive: false,
    spec: {
      type: "function",
      function: {
        name: "get_household_recipes",
        description:
          "Return a paginated list of the user's saved recipes (no semantic ranking). Use when the user asks to browse, count, or filter by structural attribute (cuisine, tag).",
        parameters: {
          type: "object",
          properties: {
            filters: {
              type: "object",
              properties: {
                cuisine: { type: "string" },
                tags_any: {
                  type: "array",
                  items: { type: "string" },
                  maxItems: 8,
                },
                is_favorite: { type: "boolean" },
              },
              additionalProperties: false,
            },
            limit: {
              type: "integer",
              minimum: 1,
              maximum: 20,
              default: 10,
            },
          },
          additionalProperties: false,
        },
      },
    },
  },
  {
    destructive: false,
    spec: {
      type: "function",
      function: {
        name: "get_household_profile",
        description:
          "Return the user's household: name, members (with allergies and dietary restrictions), measurement system. Call when the user asks 'is this safe for the kids', mentions dietary needs, or you need to filter by allergen.",
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    },
  },
  {
    destructive: false,
    spec: {
      type: "function",
      function: {
        name: "get_meal_plan",
        description:
          "Return the user's meal plan(s) for a date range. Use when the user asks 'what am I making this week', 'what's on the plan', or to check slot availability before adding.",
        parameters: {
          type: "object",
          properties: {
            start_date: { type: "string", format: "date" },
            end_date: { type: "string", format: "date" },
            status: {
              type: "string",
              enum: ["draft", "active", "completed", "archived"],
            },
          },
          required: ["start_date", "end_date"],
          additionalProperties: false,
        },
      },
    },
  },
  {
    destructive: "conditional",
    spec: {
      type: "function",
      function: {
        name: "assign_recipe_to_meal_plan_slot",
        description:
          "Assign a recipe to a specific date + slot (breakfast/lunch/dinner/snack) on the user's active or specified meal plan. Creates the slot if empty; OVERWRITES if occupied. Overwriting an occupied slot triggers a confirmation.",
        parameters: {
          type: "object",
          properties: {
            meal_plan_id: { type: "string", format: "uuid" },
            date: { type: "string", format: "date" },
            slot: {
              type: "string",
              enum: ["breakfast", "lunch", "dinner", "snack"],
            },
            recipe_id: { type: "string", format: "uuid" },
          },
          required: ["date", "slot", "recipe_id"],
          additionalProperties: false,
        },
      },
    },
  },
  {
    destructive: false,
    spec: {
      type: "function",
      function: {
        name: "add_to_grocery_list",
        description:
          "Add a single item to the grocery_list JSONB of the active meal plan. Single-item adds do NOT require confirmation.",
        parameters: {
          type: "object",
          properties: {
            meal_plan_id: { type: "string", format: "uuid" },
            item: { type: "string", minLength: 1 },
            amount: { type: "number", minimum: 0 },
            unit: { type: "string" },
            category: {
              type: "string",
              description:
                "produce | protein | pantry | dairy | grains | condiments | other",
            },
          },
          required: ["item"],
          additionalProperties: false,
        },
      },
    },
  },
  {
    destructive: false,
    spec: {
      type: "function",
      function: {
        name: "propose_substitution",
        description:
          "Return 2-4 ranked ingredient substitutions for a given ingredient in the context of a specific recipe. Read-only.",
        parameters: {
          type: "object",
          properties: {
            recipe_id: { type: "string", format: "uuid" },
            ingredient: { type: "string", minLength: 1 },
            constraint: { type: "string" },
          },
          required: ["recipe_id", "ingredient"],
          additionalProperties: false,
        },
      },
    },
  },
  {
    destructive: true,
    spec: {
      type: "function",
      function: {
        name: "update_recipe",
        description:
          "Modify fields on an existing recipe. ALWAYS destructive — runtime returns a confirmation request.",
        parameters: {
          type: "object",
          properties: {
            recipe_id: { type: "string", format: "uuid" },
            changes: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                servings: { type: "integer", minimum: 1 },
                tags_add: { type: "array", items: { type: "string" } },
                tags_remove: { type: "array", items: { type: "string" } },
                is_favorite: { type: "boolean" },
              },
              additionalProperties: false,
              minProperties: 1,
            },
          },
          required: ["recipe_id", "changes"],
          additionalProperties: false,
        },
      },
    },
  },
  {
    destructive: true,
    spec: {
      type: "function",
      function: {
        name: "delete_recipe",
        description: "Delete a recipe. ALWAYS destructive.",
        parameters: {
          type: "object",
          properties: {
            recipe_id: { type: "string", format: "uuid" },
          },
          required: ["recipe_id"],
          additionalProperties: false,
        },
      },
    },
  },
  // ── MOP-0018 new tools ─────────────────────────────────────────────

  {
    destructive: false,
    spec: {
      type: "function",
      function: {
        name: "save_recipe",
        description:
          "Save a recipe to the user's library. Call ONLY after extract_recipe_from_source returns a recipe AND the user confirms they want to keep it. Runs a duplicate title check first — if a duplicate is found, returns status='duplicate' and the user must confirm before re-calling with override_duplicate:true.",
        parameters: {
          type: "object",
          properties: {
            recipe: {
              type: "object",
              description:
                "The recipe object from extract_recipe_from_source. Must include title and ingredients.",
              properties: {
                title: { type: "string", minLength: 1 },
                description: { type: "string" },
                ingredients: { type: "array", items: { type: "object" } },
                instructions: { type: "array", items: { type: "string" } },
                prepTime: { type: "number" },
                cookTime: { type: "number" },
                totalTime: { type: "number" },
                servings: { type: "number" },
                difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                tags: { type: "array", items: { type: "string" } },
                cuisine: { type: "string" },
                source_url: { type: "string" },
                source_name: { type: "string" },
                image_url: { type: "string" },
              },
              required: ["title", "ingredients"],
              additionalProperties: false,
            },
            override_duplicate: {
              type: "boolean",
              description:
                "Pass true only after the user explicitly confirms they want to save despite a detected duplicate.",
              default: false,
            },
          },
          required: ["recipe"],
          additionalProperties: false,
        },
      },
    },
  },
  {
    destructive: false,
    spec: {
      type: "function",
      function: {
        name: "check_recipe_safety",
        description:
          "Cross-reference a recipe's ingredients against every household member's allergen list. Returns warnings per affected member. Call automatically after extract_recipe_from_source returns a recipe — do NOT wait for the user to ask.",
        parameters: {
          type: "object",
          properties: {
            recipe: {
              type: "object",
              description: "The recipe object (from extraction or any source). Use this when you have the full recipe object.",
              properties: {
                title: { type: "string" },
                ingredients: { type: "array", items: { type: "object" } },
              },
              required: ["title", "ingredients"],
              additionalProperties: false,
            },
            recipe_id: {
              type: "string",
              format: "uuid",
              description: "Alternatively, look up a saved recipe by ID.",
            },
          },
          additionalProperties: false,
        },
      },
    },
  },
  {
    destructive: false,
    spec: {
      type: "function",
      function: {
        name: "get_grocery_list",
        description:
          "Read the current grocery list for the active (or specified) meal plan. Returns all items with name, amount, unit, category, and purchased status. Use when the user asks 'what's on my grocery list', 'what do I need to buy', or when managing shopping.",
        parameters: {
          type: "object",
          properties: {
            meal_plan_id: {
              type: "string",
              format: "uuid",
              description: "Specific meal plan ID. Omit to use the active plan.",
            },
          },
          additionalProperties: false,
        },
      },
    },
  },
  {
    destructive: false,
    spec: {
      type: "function",
      function: {
        name: "mark_grocery_item_purchased",
        description:
          "Toggle the purchased status of a grocery item. Use when the user says 'mark X as done/bought/purchased' or 'uncheck X'. Fuzzy-matches the item name.",
        parameters: {
          type: "object",
          properties: {
            item_name: {
              type: "string",
              minLength: 1,
              description: "Name of the item to update (fuzzy matched).",
            },
            purchased: {
              type: "boolean",
              default: true,
              description: "true = mark purchased, false = unmark.",
            },
            meal_plan_id: {
              type: "string",
              format: "uuid",
              description: "Specific plan. Omit to use the active plan.",
            },
          },
          required: ["item_name"],
          additionalProperties: false,
        },
      },
    },
  },

  {
    destructive: false,
    spec: {
      type: "function",
      function: {
        name: "remove_grocery_item",
        description:
          "Remove an item from the grocery list by name. Fuzzy-matches the item name. Use when the user says 'remove X', 'delete X from the list', or 'I don't need X anymore'.",
        parameters: {
          type: "object",
          properties: {
            item_name: {
              type: "string",
              minLength: 1,
              description: "Name of the item to remove (fuzzy matched).",
            },
            meal_plan_id: {
              type: "string",
              format: "uuid",
              description: "Specific plan. Omit to use the active plan.",
            },
          },
          required: ["item_name"],
          additionalProperties: false,
        },
      },
    },
  },
  {
    destructive: false,
    spec: {
      type: "function",
      function: {
        name: "create_meal_plan",
        description:
          "Create a new meal plan for a date range. Returns the new plan ID so you can immediately chain assign_recipe_to_meal_plan_slot calls. Use when the user asks to start a new plan or when no plan exists for the target week.",
        parameters: {
          type: "object",
          properties: {
            start_date: {
              type: "string",
              format: "date",
              description: "First day of the plan (YYYY-MM-DD).",
            },
            end_date: {
              type: "string",
              format: "date",
              description: "Last day of the plan (YYYY-MM-DD).",
            },
            title: {
              type: "string",
              description: "Optional plan name. Defaults to 'Meal Plan (start – end)'.",
            },
          },
          required: ["start_date", "end_date"],
          additionalProperties: false,
        },
      },
    },
  },
  {
    destructive: false,
    spec: {
      type: "function",
      function: {
        name: "clear_meal_plan_slot",
        description:
          "Remove the recipe from a specific date + slot (breakfast/lunch/dinner/snack) without deleting the whole plan. No confirmation required — the slot can be reassigned with assign_recipe_to_meal_plan_slot.",
        parameters: {
          type: "object",
          properties: {
            date: {
              type: "string",
              format: "date",
              description: "The date of the slot to clear (YYYY-MM-DD).",
            },
            slot: {
              type: "string",
              enum: ["breakfast", "lunch", "dinner", "snack"],
            },
            meal_plan_id: {
              type: "string",
              format: "uuid",
              description: "Specific plan. Omit to use the plan covering that date.",
            },
          },
          required: ["date", "slot"],
          additionalProperties: false,
        },
      },
    },
  },

  // ── MOP-0018 P2 tools ──────────────────────────────────────────────

  {
    destructive: false,
    spec: {
      type: "function",
      function: {
        name: "react_to_recipe",
        description:
          "Record a thumbs_up or thumbs_down reaction for a recipe, optionally on behalf of a named family member. Use when the user says 'mark this as liked for Alex', 'the kids love this', 'we didn't like that one', etc. Pass reaction='remove' to clear a previous reaction.",
        parameters: {
          type: "object",
          properties: {
            recipe_id: { type: "string", format: "uuid" },
            reaction: {
              type: "string",
              enum: ["thumbs_up", "thumbs_down", "remove"],
              description: "thumbs_up = liked, thumbs_down = disliked, remove = clear reaction.",
            },
            member_name: {
              type: "string",
              description:
                "Name of the family member reacting. Omit to record the reaction for the authenticated user.",
            },
          },
          required: ["recipe_id", "reaction"],
          additionalProperties: false,
        },
      },
    },
  },
  {
    destructive: false,
    spec: {
      type: "function",
      function: {
        name: "get_recommendations",
        description:
          "Return recipes the household or a specific family member has reacted positively (or negatively) to. Use for 'show me recipes the whole family likes', 'what does Alex enjoy', 'what do we always dislike'.",
        parameters: {
          type: "object",
          properties: {
            member_name: {
              type: "string",
              description:
                "Filter to a specific family member. Omit to scope to the authenticated user's own reactions.",
            },
            reaction: {
              type: "string",
              enum: ["thumbs_up", "thumbs_down"],
              default: "thumbs_up",
              description: "Which reaction type to query. Default: thumbs_up.",
            },
            limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
          },
          additionalProperties: false,
        },
      },
    },
  },
  {
    destructive: true,
    spec: {
      type: "function",
      function: {
        name: "update_member_allergens",
        description:
          "Add or remove allergens on a named family member's profile. ALWAYS requires confirmation — never run without the user explicitly requesting it. Use when the user says 'add peanuts to Alex's allergies' or 'remove shellfish from Sam's list'.",
        parameters: {
          type: "object",
          properties: {
            member_name: {
              type: "string",
              minLength: 1,
              description: "Name of the family member to update.",
            },
            add: {
              type: "array",
              items: { type: "string" },
              description: "Allergens to add (e.g. ['peanuts', 'shellfish']).",
            },
            remove: {
              type: "array",
              items: { type: "string" },
              description: "Allergens to remove.",
            },
          },
          required: ["member_name"],
          additionalProperties: false,
        },
      },
    },
  },
  {
    destructive: false,
    spec: {
      type: "function",
      function: {
        name: "scale_recipe",
        description:
          "Return a copy of a recipe with all ingredient quantities scaled to a target serving count. Read-only — does NOT overwrite the saved recipe. Use when the user says 'scale this to 2 servings', 'I'm cooking for 8', etc.",
        parameters: {
          type: "object",
          properties: {
            recipe_id: { type: "string", format: "uuid" },
            target_servings: {
              type: "number",
              minimum: 0.5,
              maximum: 100,
              description: "The serving count to scale to.",
            },
          },
          required: ["recipe_id", "target_servings"],
          additionalProperties: false,
        },
      },
    },
  },

  // ── MOP-0008 Addendum 1 — web search (keep last) ─────────────────

  {
    // Omitted from the catalog at startup when WEB_SEARCH_API_KEY is unset
    // (capability gating — agent simply lacks the tool).
    destructive: false,
    available: () => isWebSearchConfigured(),
    spec: {
      type: "function",
      function: {
        name: "web_search_recipe",
        description:
          "Search the public web for recipes matching a query. Returns up to 5 candidate results (title, URL, source domain, snippet) ranked by relevance. Does NOT extract or save. Use when the user asks to find a recipe online, asks for inspiration outside their saved collection, or when `search_recipes` returns no matches. The agent typically chains a follow-up `extract_recipe_from_source` call with one of the returned URLs (either auto-selected when the top result is clearly relevant, or after presenting candidates to the user). Read-only.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              minLength: 1,
              description:
                "Natural-language recipe search, e.g. 'devilled eggs', 'gluten-free chocolate chip cookies', 'one-pot weeknight pasta'.",
            },
            max_results: {
              type: "integer",
              minimum: 1,
              maximum: 5,
              default: 3,
            },
            site_filter: {
              type: "string",
              description:
                "Optional domain to restrict the search to (e.g. 'seriouseats.com'). Use only when the user explicitly names a source.",
            },
          },
          required: ["query"],
          additionalProperties: false,
        },
      },
    },
  },
];

/** Tools that are ALWAYS destructive — dispatcher short-circuits before execution. */
export const DESTRUCTIVE_TOOLS: ReadonlySet<string> = new Set([
  "update_recipe",
  "delete_recipe",
  "update_member_allergens",
]);

/**
 * Tools that MAY require confirmation depending on context.
 * The handler returns `requiresConfirmation: true` from its data path.
 */
export const CONDITIONALLY_DESTRUCTIVE: ReadonlySet<string> = new Set([
  "assign_recipe_to_meal_plan_slot",
]);

/**
 * OpenAI-format tool list to send to the model.
 * Honors per-entry `available()` gates (used to omit `web_search_recipe`
 * when WEB_SEARCH_API_KEY is unset at function init).
 */
export function getToolSpecs(): ToolSpec[] {
  return TOOL_CATALOG.filter((e) => (e.available ? e.available() : true)).map(
    (e) => e.spec
  );
}

/** Lookup by name (used by the dispatcher). */
export function findCatalogEntry(name: string): CatalogEntry | undefined {
  return TOOL_CATALOG.find((e) => e.spec.function.name === name);
}
