/**
 * Utility functions for parsing recipes from chat responses
 */

export interface ParsedRecipe {
  title: string;
  description?: string;
  ingredients: Array<{
    item: string;
    amount?: string;
    unit?: string;
    notes?: string;
  }>;
  instructions: string[];
  prep_time?: string;
  cook_time?: string;
  servings?: string;
  difficulty?: string;
  cuisine?: string;
  dietary_tags?: string[];
  source_url?: string;
  source_name?: string;
  notes?: string;
}

/**
 * Attempts to extract recipe JSON from text response
 * Handles cases where JSON might be embedded in markdown code blocks or plain text
 */
export function parseRecipeFromText(text: string): ParsedRecipe | null {
  try {
    // Try to find JSON in markdown code blocks first
    const codeBlockMatch = text.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
    if (codeBlockMatch) {
      const jsonText = codeBlockMatch[1];
      const parsed = JSON.parse(jsonText);
      
      // Check if it has the recipe structure
      if (parsed.recipe) {
        return parsed.recipe as ParsedRecipe;
      }
      // Sometimes the recipe might be at root level
      if (parsed.title || parsed.ingredients) {
        return parsed as ParsedRecipe;
      }
    }

    // Try to find JSON object in plain text (look for { ... } pattern)
    const jsonMatch = text.match(/\{[\s\S]*"recipe"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.recipe) {
        return parsed.recipe as ParsedRecipe;
      }
    }

    // Try to find standalone recipe object
    const recipeMatch = text.match(/\{[\s\S]*"title"[\s\S]*"ingredients"[\s\S]*\}/);
    if (recipeMatch) {
      const parsed = JSON.parse(recipeMatch[0]);
      if (parsed.title && parsed.ingredients) {
        return parsed as ParsedRecipe;
      }
    }

    return null;
  } catch (error) {
    // If parsing fails, return null
    return null;
  }
}

/**
 * Converts parsed recipe to format expected by the API
 */
export function formatRecipeForStorage(recipe: ParsedRecipe): any {
  // Parse time strings to numbers if possible
  const parseTime = (timeStr?: string): number | null => {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  };

  const parseServings = (servingsStr?: string): number | null => {
    if (!servingsStr) return 4; // default
    const match = servingsStr.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 4;
  };

  return {
    title: recipe.title,
    description: recipe.description || null,
    ingredients: recipe.ingredients || [],
    instructions: recipe.instructions || [],
    prep_time: parseTime(recipe.prep_time),
    cook_time: parseTime(recipe.cook_time),
    servings: parseServings(recipe.servings),
    difficulty: recipe.difficulty || 'medium',
    cuisine: recipe.cuisine || null,
    dietary_tags: recipe.dietary_tags || [],
    source_url: recipe.source_url || null,
    source_name: recipe.source_name || null,
    rating: null,
    is_favorite: false,
  };
}

