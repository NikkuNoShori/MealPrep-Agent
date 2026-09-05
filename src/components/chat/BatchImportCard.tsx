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
  Clock,
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

export function BatchImportCard({ entry, onSave, onRetry, isSaving }: BatchImportCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { url, status, recipe, error } = entry;

  const displayUrl = (() => {
    try { return new URL(url).hostname; } catch { return url.slice(0, 40); }
  })();

  // ── Extracting ──────────────────────────────────────────────────────────────
  if (status === "extracting") {
    return (
      <div
        data-testid={`batch-card-${entry.index}`}
        className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3 animate-pulse"
      >
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-muted-foreground">{displayUrl}</p>
          <div className="mt-1 h-3 w-32 rounded bg-muted" />
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div
        data-testid={`batch-card-${entry.index}`}
        className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3"
      >
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-destructive">{displayUrl}</p>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{error}</p>
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

  // ── Shared: expandable recipe details (done + saved) ────────────────────────
  const ingredients: any[] = recipe?.ingredients ?? [];
  const instructions: string[] = recipe?.instructions ?? [];
  const totalTime = recipe?.totalTime ?? recipe?.total_time;
  const prepTime = recipe?.prepTime ?? recipe?.prep_time;
  const cookTime = recipe?.cookTime ?? recipe?.cook_time;
  const ingredientCount = ingredients.length;
  const hasDetails = ingredientCount > 0 || instructions.length > 0;

  const timeLabel = (() => {
    if (totalTime) return `${totalTime} min`;
    const parts = [];
    if (prepTime) parts.push(`${prepTime}m prep`);
    if (cookTime) parts.push(`${cookTime}m cook`);
    return parts.join(" · ") || null;
  })();

  // ── Saved ───────────────────────────────────────────────────────────────────
  if (status === "saved") {
    return (
      <div
        data-testid={`batch-card-${entry.index}`}
        className="rounded-lg border border-green-500/30 bg-green-500/5 overflow-hidden"
      >
        <div className="flex items-center gap-3 p-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{recipe?.title ?? displayUrl}</p>
            <p className="text-xs text-muted-foreground">
              Saved to library
              {ingredientCount > 0 && ` · ${ingredientCount} ingredients`}
              {timeLabel && ` · ${timeLabel}`}
            </p>
          </div>
          {hasDetails && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={expanded ? "Collapse" : "Expand recipe details"}
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
      className="rounded-lg border border-border bg-card overflow-hidden"
    >
      {/* Header row */}
      <div className="flex items-start gap-3 p-3">
        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{recipe?.title ?? displayUrl}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {ingredientCount > 0 && `${ingredientCount} ingredients`}
            {ingredientCount > 0 && timeLabel && " · "}
            {timeLabel}
            {!ingredientCount && !timeLabel && displayUrl}
          </p>
        </div>

        {/* Expand toggle */}
        {hasDetails && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5"
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
// RecipeDetails — shared expandable section
// ─────────────────────────────────────────────────────────────────────────────

function RecipeDetails({
  ingredients,
  instructions,
}: {
  ingredients: any[];
  instructions: string[];
}) {
  return (
    <div className="border-t border-border bg-muted/20 px-3 pb-3 pt-2 space-y-3">
      {/* Ingredients */}
      {ingredients.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            <BookOpen className="h-3 w-3" />
            Ingredients
          </p>
          <ul className="space-y-0.5">
            {ingredients.map((ing, i) => {
              const name = typeof ing === "string" ? ing : (ing.name ?? "");
              const amount = ing.amount ?? ing.quantity ?? "";
              const unit = ing.unit ?? "";
              const label = [amount, unit].filter(Boolean).join(" ");
              return (
                <li key={i} className="text-xs text-foreground flex gap-2">
                  {label && (
                    <span className="shrink-0 text-muted-foreground tabular-nums w-16 text-right">
                      {label}
                    </span>
                  )}
                  <span className="min-w-0">{name}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Instructions */}
      {instructions.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            <ListOrdered className="h-3 w-3" />
            Instructions
          </p>
          <ol className="space-y-1 list-none">
            {instructions.map((step, i) => (
              <li key={i} className="text-xs text-foreground flex gap-2">
                <span className="shrink-0 text-muted-foreground tabular-nums font-medium w-4 text-right">
                  {i + 1}.
                </span>
                <span className="min-w-0">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
