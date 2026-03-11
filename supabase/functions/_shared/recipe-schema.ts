/**
 * Shared type definitions and validation for the recipe ETL pipeline.
 */

// ─── Intermediate format (output of all source adapters) ───

export interface SourceMetadata {
  source_type: "url" | "text" | "video" | "discord";
  source_url?: string;
  source_name?: string;
  extracted_at: string;
  adapter_version: string;
  extra?: Record<string, unknown>;
}

export interface IntermediateContent {
  raw_text: string;
  images: string[];
  source_metadata: SourceMetadata;
}

// ─── Extracted recipe (output of Extract stage) ───

export interface Ingredient {
  name: string;
  amount: number | null;
  unit: string;
  category: string;
  notes?: string;
}

export interface NutritionInfo {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface ExtractedRecipe {
  title: string;
  description: string | null;
  ingredients: Ingredient[];
  instructions: string[];
  prepTime: number | null;
  cookTime: number | null;
  totalTime: number | null;
  servings: number | null;
  difficulty: "easy" | "medium" | "hard" | null;
  tags: string[];
  cuisine: string | null;
  nutrition: NutritionInfo | null;
  imageUrl: string | null;
}

// ─── Validated recipe (output of Transform stage, ready for DB) ───

export interface ValidatedRecipe {
  title: string;
  description: string | null;
  ingredients: Ingredient[];
  instructions: string[];
  prep_time: number | null;
  cook_time: number | null;
  total_time: number | null;
  servings: number;
  difficulty: "easy" | "medium" | "hard";
  cuisine: string | null;
  tags: string[];
  image_url: string | null;
  nutrition_info: NutritionInfo | null;
  source_url: string | null;
  source_name: string | null;
  slug: string;
}

// ─── Pipeline result ───

export interface PipelineError {
  stage: "adapter" | "extract" | "transform" | "load";
  code: string;
  message: string;
  details?: unknown;
}

export interface PipelineResult {
  success: boolean;
  recipe_id?: string;
  recipe?: ValidatedRecipe | ExtractedRecipe;
  /** Multi-recipe support: IDs and recipes when multiple are extracted */
  recipe_ids?: string[];
  recipes?: (ValidatedRecipe | ExtractedRecipe)[];
  source_metadata?: SourceMetadata;
  errors?: PipelineError[];
  stage_failed?: PipelineError["stage"];
}

// ─── Pipeline request ───

export interface PipelineRequest {
  source_type: "url" | "text" | "video";
  url?: string;
  text?: string;
  images?: string[];
  video_url?: string;
  frame_urls?: string[];
  transcript?: string;
  auto_save?: boolean;
}

// ─── Validation helpers ───

export function createPipelineError(
  stage: PipelineError["stage"],
  code: string,
  message: string,
  details?: unknown
): PipelineError {
  return { stage, code, message, details };
}
