/**
 * MOP-0019 — Per-URL recipe card for the BatchImportPanel.
 *
 * States:
 *   extracting — pulsing skeleton with URL label
 *   done       — collapsible card: header (title, meta, Save) + expandable ingredients/instructions
 *   error      — URL + error message + Retry button
 *   saved      — success confirmation (also expandable to see what was saved)
 */

import React, { useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  ListOrdered,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface BatchCardEntry {
  index: number;
  url: string;
  status: "extracting" | "done" | "error" | "saved";
  recipe?: any;
  error?: string;
}

interface BatchImportCardProps {
  entry: BatchCardEntry;
  onSave: (entry: BatchCardEntry) => Promise<void>;
  onRetry: (entry: BatchCardEntry) => void;
  isSaving: boolean;
}

/** Pull a clean human-readable message from a raw error string (may be JSON). */
function cleanError(raw: string | undefined): string {
  if (!raw) return "Unknown error";
  try {
    const json = raw.replace(/^HTTP \d+:\s*/, "");
    const parsed = JSON.parse(json);
    const firstMsg = parsed?.errors?.[0]?.message ?? parsed?.message ?? parsed?.error;
    if (firstMsg) return String(firstMsg);
  } catch { /* not JSON */ }
  return raw.replace(/^HTTP \d+:\s*/, "").slice(0, 200);
}

/**
 * Safely dig the recipe title out of whatever shape the pipeline returned.
 * The SSE result event carries data?.recipe from the pipeline response, but
 * in some pipeline versions the whole PipelineResult object is forwarded
 * instead of just the inner recipe.
 */
function getRecipeObj(raw: any): any {
  if (!raw) return null;
  // If it looks like a PipelineResult ({ success, recipe }) unwrap it
  if (raw.success !== undefined && raw.recipe) return raw.recipe;
  // If it's a recipes array wrapper, take the first
  if (raw.recipes && Array.isArray(raw.recipes) && raw.recipes.length > 0) return raw.recipes[0];
  // Otherwise assume it IS the recipe object
  return raw;
}

export function BatchImportCard({ entry, onSave, onRetry, isSaving }: BatchImportCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { url, status, error } = entry;

  // Always unwrap to the actual recipe object
  const recipe = getRecipeObj(entry.recipe);

  const displayUrl = (() => {
    try { return new URL(url).hostname; } catch { return url.slice(0, 40); }
  })();

  // ── Extracting ──────────────────────────────────────────────────────────────
  if (status === "extracting") {
    return (
      <div
        data-testid={`batch-card-${entry.index}`}
        className="flex items-center gap-3 rounded-lg border border-border p-3 animate-pulse"
        style={{ backgroundColor: "hsl(var(--muted))" }}
      >
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-muted-foreground">{displayUrl}</p>
          <div className="mt-1 h-3 w-32 rounded bg-border" />
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div
        data-testid={`batch-card-${entry.index}`}
        className="flex items-start gap-3 rounded-lg border border-destructive/60 p-3"
        style={{ backgroundColor: "hsl(var(--destructive) / 0.08)" }}
      >
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-destructive">{displayUrl}</p>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{cleanError(error)}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-xs"
          onClick={() => onRetry(entry)}
        >
          Retry
        </Button>
      </div>
    );
  }

  // ── Shared derived values (done + saved) ────────────────────────────────────
  const title: string = recipe?.title ?? displayUrl;
  const ingredients: any[] = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  const instructions: string[] = Array.isArray(recipe?.instructions) ? recipe.instructions : [];
  const ingredientCount = ingredients.length;
  const hasDetails = ingredientCount > 0 || instructions.length > 0;

  const totalTime: number | null = recipe?.total_time ?? recipe?.totalTime ?? null;
  const prepTime: number | null = recipe?.prep_time ?? recipe?.prepTime ?? null;
  const cookTime: number | null = recipe?.cook_time ?? recipe?.cookTime ?? null;
  const timeLabel = totalTime
    ? `${totalTime} min`
    : [prepTime && `${prepTime}m prep`, cookTime && `${cookTime}m cook`].filter(Boolean).join(" · ") || null;

  // ── Saved ───────────────────────────────────────────────────────────────────
  if (status === "saved") {
    return (
      <div
        data-testid={`batch-card-${entry.index}`}
        className="rounded-lg border border-green-500/50 overflow-hidden"
        style={{ backgroundColor: "hsl(142 76% 36% / 0.15)" }}
      >
        <div className="flex items-center gap-3 p-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">
              Saved to library
              {ingredientCount > 0 && ` · ${ingredientCount} ingredients`}
              {timeLabel && ` · ${timeLabel}`}
            </p>
          </div>
          {hasDetails && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
        {expanded && hasDetails && (
          <RecipeDetails ingredients={ingredients} instructions={instructions} />
        )}
      </div>
    );
  }

  // ── Done ────────────────────────────────────────────────────────────────────
  return (
    <div
      data-testid={`batch-card-${entry.index}`}
      className="rounded-lg border border-border overflow-hidden"
      style={{ backgroundColor: "hsl(var(--card))", boxShadow: "0 1px 3px rgba(0,0,0,0.35)" }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 p-3">
        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: "hsl(var(--foreground))" }}>
            {title}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {ingredientCount > 0 ? `${ingredientCount} ingredients` : ""}
            {ingredientCount > 0 && timeLabel ? " · " : ""}
            {timeLabel ?? ""}
            {!ingredientCount && !timeLabel ? displayUrl : ""}
          </p>
        </div>

        {/* Expand / collapse */}
        {hasDetails && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground transition-colors mt-0.5"
            aria-label={expanded ? "Collapse recipe details" : "Expand recipe details"}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}

        <Button
          variant="default"
          size="sm"
          className="shrink-0 text-xs"
          onClick={() => onSave(entry)}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
        </Button>
      </div>

      {/* Expandable details */}
      {expanded && hasDetails && (
        <RecipeDetails ingredients={ingredients} instructions={instructions} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RecipeDetails sub-component
// ─────────────────────────────────────────────────────────────────────────────

function RecipeDetails({
  ingredients,
  instructions,
}: {
  ingredients: any[];
  instructions: string[];
}) {
  return (
    <div
      className="border-t border-border px-3 pb-3 pt-2 space-y-3"
      style={{ backgroundColor: "hsl(var(--muted) / 0.4)" }}
    >
      {ingredients.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            <BookOpen className="h-3 w-3" />
            Ingredients
          </p>
          <ul className="space-y-0.5">
            {ingredients.map((ing, i) => {
              const name = typeof ing === "string" ? ing : (ing.name ?? ing.ingredient ?? "");
              const amount = ing.amount ?? ing.quantity ?? "";
              const unit = ing.unit ?? "";
              const label = [amount, unit].filter(Boolean).join(" ");
              return (
                <li key={i} className="text-xs flex gap-2">
                  {label ? (
                    <span className="shrink-0 text-muted-foreground tabular-nums w-16 text-right">{label}</span>
                  ) : null}
                  <span className="min-w-0" style={{ color: "hsl(var(--foreground))" }}>{name}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {instructions.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
            <ListOrdered className="h-3 w-3" />
            Instructions
          </p>
          <ol className="space-y-1">
            {instructions.map((step, i) => (
              <li key={i} className="text-xs flex gap-2">
                <span className="shrink-0 text-muted-foreground tabular-nums font-medium w-4 text-right">{i + 1}.</span>
                <span className="min-w-0" style={{ color: "hsl(var(--foreground))" }}>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
