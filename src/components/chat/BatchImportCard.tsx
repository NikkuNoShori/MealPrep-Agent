/**
 * MOP-0019 — Per-URL recipe card for the BatchImportPanel.
 *
 * extracting / error states render compact inline skeletons.
 * done state shows an editable pre-save surface (title, servings, difficulty,
 * prep/cook time, visibility) matching StructuredRecipeDisplay's inline editing.
 * saved state renders a read-only confirmed card.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  AlertCircle,
  BookOpen,
  ChefHat,
  Clock,
  ListOrdered,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VisibilityPicker, type RecipeVisibility } from "@/components/recipes/VisibilityPicker";

export interface BatchCardEntry {
  index: number;
  url: string;
  status: "extracting" | "done" | "error" | "saved";
  recipe?: any;
  error?: string;
  // Pre-save overrides set by the user before clicking Save
  editedTitle?: string;
  editedServings?: number;
  editedDifficulty?: "easy" | "medium" | "hard";
  editedPrepTime?: number;
  editedCookTime?: number;
  visibility?: RecipeVisibility;
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
  // Strip leading "HTTP NNN: " prefix that batch-extract prepends
  const stripped = raw.replace(/^HTTP \d+:\s*/, "");
  try {
    const parsed = JSON.parse(stripped);
    const firstMsg = parsed?.errors?.[0]?.message ?? parsed?.message ?? parsed?.error;
    if (firstMsg) return String(firstMsg);
  } catch { /* not JSON — use stripped text as-is */ }
  return stripped.slice(0, 200);
}

/**
 * Safely dig the recipe object out of whatever shape the pipeline returned.
 */
function getRecipeObj(raw: any): any {
  if (!raw) return null;
  if (raw.success !== undefined && raw.recipe) return raw.recipe;
  if (raw.recipes && Array.isArray(raw.recipes) && raw.recipes.length > 0) return raw.recipes[0];
  return raw;
}

function getDifficultyColor(difficulty?: string) {
  switch (difficulty) {
    case "easy":   return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "medium": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "hard":   return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    default:       return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
  }
}

export function BatchImportCard({ entry, onSave, onRetry, isSaving }: BatchImportCardProps) {
  const { url, status, error } = entry;

  const recipe = getRecipeObj(entry.recipe);

  const displayUrl = (() => {
    try { return new URL(url).hostname; } catch { return url.slice(0, 40); }
  })();

  // ── Editable local state (pre-save overrides) ───────────────────────────────
  const rawPrepTime  = recipe?.prep_time  ?? recipe?.prepTime  ?? 0;
  const rawCookTime  = recipe?.cook_time  ?? recipe?.cookTime  ?? 0;
  const rawTotalTime = recipe?.total_time ?? recipe?.totalTime ?? 0;
  // If only totalTime is set, put it all in cookTime so the sum equals totalTime
  const derivedCookTime = rawCookTime === 0 && rawPrepTime === 0 && rawTotalTime > 0
    ? rawTotalTime
    : rawCookTime;

  const [editingField, setEditingField] = useState<
    "title" | "servings" | "difficulty" | "prepTime" | "cookTime" | null
  >(null);
  const [editedTitle, setEditedTitle]           = useState<string>(recipe?.title ?? displayUrl);
  const [editedServings, setEditedServings]     = useState<number>(recipe?.servings ?? 4);
  const [editedDifficulty, setEditedDifficulty] = useState<"easy" | "medium" | "hard">(
    recipe?.difficulty === "easy" || recipe?.difficulty === "medium" || recipe?.difficulty === "hard"
      ? recipe.difficulty
      : "medium"
  );
  const [editedPrepTime, setEditedPrepTime]   = useState<number>(rawPrepTime);
  const [editedCookTime, setEditedCookTime]   = useState<number>(derivedCookTime);
  const [visibility, setVisibility]           = useState<RecipeVisibility>("private");
  const [expanded, setExpanded]               = useState(false);

  // The card instance persists across extracting→done (same React key), so the
  // useState initializers above ran while recipe was still null. Resync editable
  // fields once the real recipe data arrives — but only once, not on every re-render.
  const syncedRef = useRef(false);
  useEffect(() => {
    if (!recipe || syncedRef.current) return;
    syncedRef.current = true;
    setEditedTitle(recipe.title ?? displayUrl);
    setEditedServings(recipe.servings ?? 4);
    if (recipe.difficulty === "easy" || recipe.difficulty === "medium" || recipe.difficulty === "hard") {
      setEditedDifficulty(recipe.difficulty);
    }
    const rPrep  = recipe.prep_time  ?? recipe.prepTime  ?? 0;
    const rCook  = recipe.cook_time  ?? recipe.cookTime  ?? 0;
    const rTotal = recipe.total_time ?? recipe.totalTime ?? 0;
    setEditedPrepTime(rPrep);
    setEditedCookTime(rCook === 0 && rPrep === 0 && rTotal > 0 ? rTotal : rCook);
  }, [recipe, displayUrl]);

  const totalTime = editedPrepTime + editedCookTime;

  const ingredients: any[] = Array.isArray(recipe?.ingredients) ? recipe.ingredients : [];
  const instructions: string[] = Array.isArray(recipe?.instructions) ? recipe.instructions : [];
  const hasDetails = ingredients.length > 0 || instructions.length > 0;
  const imageUrl: string | undefined = recipe?.image_url ?? recipe?.imageUrl ?? undefined;
  const tags: string[] = Array.isArray(recipe?.tags) ? recipe.tags : [];

  // Build the overridden entry to pass back to onSave
  const buildSaveEntry = (): BatchCardEntry => ({
    ...entry,
    editedTitle,
    editedServings,
    editedDifficulty,
    editedPrepTime,
    editedCookTime,
    visibility,
  });

  // ── Extracting ──────────────────────────────────────────────────────────────
  if (status === "extracting") {
    return (
      <div data-testid={`batch-card-${entry.index}`} className="min-w-0">
        <div className="flex items-stretch gap-4 p-3 rounded-2xl bg-white/60 dark:bg-white/[0.03] border border-stone-200/60 dark:border-white/[0.06] animate-pulse">
          <div className="relative w-28 h-28 rounded-xl flex-shrink-0 bg-gradient-to-br from-gray-100 to-gray-200/80 dark:from-gray-800 dark:to-gray-700" />
          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
            <div>
              <div className="h-4 w-48 rounded bg-stone-200 dark:bg-white/10" />
              <div className="h-3 w-32 rounded bg-stone-100 dark:bg-white/[0.06] mt-2" />
              <div className="h-3 w-40 rounded bg-stone-100 dark:bg-white/[0.06] mt-1.5" />
            </div>
            <div className="flex gap-2 mt-auto">
              <div className="h-3 w-10 rounded bg-stone-100 dark:bg-white/[0.06]" />
              <div className="h-3 w-12 rounded bg-stone-100 dark:bg-white/[0.06]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div data-testid={`batch-card-${entry.index}`} className="min-w-0">
        <div className="flex items-stretch gap-4 p-3 rounded-2xl border border-destructive/40 bg-destructive/[0.06]">
          <div className="relative w-28 h-28 rounded-xl flex-shrink-0 bg-gradient-to-br from-rose-100/60 to-rose-200/40 dark:from-rose-900/20 dark:to-rose-800/20 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-destructive/60" />
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
            <div>
              <h3 className="font-semibold text-[15px] text-destructive leading-snug truncate">
                {displayUrl}
              </h3>
              <p className="text-[13px] text-stone-500 dark:text-stone-400 line-clamp-2 mt-1 leading-relaxed">
                {cleanError(error)}
              </p>
            </div>
            <div className="mt-auto">
              <Button variant="ghost" size="sm" className="text-xs px-2 h-7" onClick={() => onRetry(entry)}>
                Retry
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Saved — compact confirmed state ─────────────────────────────────────────
  if (status === "saved") {
    return (
      <div data-testid={`batch-card-${entry.index}`} className="min-w-0">
        <div className="flex items-stretch gap-4 p-3 rounded-2xl bg-green-50/60 dark:bg-green-900/10 border border-green-200/60 dark:border-green-800/30">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={editedTitle}
              className="w-28 h-28 rounded-xl flex-shrink-0 object-cover"
            />
          ) : (
            <div className="w-28 h-28 rounded-xl flex-shrink-0 bg-gradient-to-br from-green-100 to-green-200/60 dark:from-green-900/30 dark:to-green-800/20 flex items-center justify-center">
              <BookOpen className="h-8 w-8 text-green-600/50 dark:text-green-400/40" />
            </div>
          )}
          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
            <div>
              <h3 className="font-semibold text-[15px] leading-snug truncate">{editedTitle}</h3>
              <p className="text-[13px] text-stone-500 dark:text-stone-400 mt-0.5">{displayUrl}</p>
            </div>
            <p className="text-[12px] text-green-600 dark:text-green-400 font-medium mt-auto">Saved to library</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Done — editable pre-save surface ────────────────────────────────────────
  // NOTE: overflow-hidden must NOT be on this element — it triggers CSS flexbox
  // min-height:auto collapse inside a bounded scroll container, collapsing the
  // card to a thin line. Corner clipping is handled per-element instead.
  return (
    <div data-testid={`batch-card-${entry.index}`} className="min-w-0 rounded-2xl border border-stone-200/60 dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.03]">

      {/* Image — rounded top corners to match card border-radius */}
      {imageUrl && (
        <img src={imageUrl} alt={editedTitle} className="w-full h-40 object-cover rounded-t-2xl" />
      )}

      <div className="p-3 space-y-2.5">

        {/* Editable title */}
        {editingField === "title" ? (
          <input
            autoFocus
            className="text-[15px] font-semibold w-full bg-transparent border-b border-primary outline-none pb-0.5"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={() => setEditingField(null)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingField(null); }}
          />
        ) : (
          <button
            className="text-[15px] font-semibold text-left w-full truncate hover:text-primary/80 transition-colors cursor-pointer"
            title="Click to edit title"
            onClick={() => setEditingField("title")}
          >
            {editedTitle}
          </button>
        )}

        <p className="text-[12px] text-stone-400 dark:text-stone-500 -mt-1">{displayUrl}</p>

        {/* Metadata badges — editable */}
        <div className="flex flex-wrap gap-1.5 items-center">

          {/* Prep time */}
          {editingField === "prepTime" ? (
            <div className="flex items-center gap-1 border rounded-full px-2 py-0.5 text-xs bg-background">
              <Clock className="h-3 w-3" />
              <span>Prep:</span>
              <input
                type="number" min={0} autoFocus
                className="w-10 bg-transparent outline-none text-center"
                value={editedPrepTime}
                onChange={(e) => setEditedPrepTime(Math.max(0, parseInt(e.target.value) || 0))}
                onBlur={() => setEditingField(null)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingField(null); }}
              />
              <span>m</span>
            </div>
          ) : editedPrepTime > 0 ? (
            <Badge
              variant="outline"
              className="gap-1 cursor-pointer hover:bg-muted transition-colors text-xs"
              title="Click to edit"
              onClick={() => setEditingField("prepTime")}
            >
              <Clock className="h-3 w-3" />
              Prep: {editedPrepTime}m
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 cursor-pointer hover:bg-muted transition-colors text-xs text-muted-foreground"
              title="Click to set prep time"
              onClick={() => setEditingField("prepTime")}
            >
              <Clock className="h-3 w-3" />
              + Prep
            </Badge>
          )}

          {/* Cook time */}
          {editingField === "cookTime" ? (
            <div className="flex items-center gap-1 border rounded-full px-2 py-0.5 text-xs bg-background">
              <Clock className="h-3 w-3" />
              <span>Cook:</span>
              <input
                type="number" min={0} autoFocus
                className="w-10 bg-transparent outline-none text-center"
                value={editedCookTime}
                onChange={(e) => setEditedCookTime(Math.max(0, parseInt(e.target.value) || 0))}
                onBlur={() => setEditingField(null)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingField(null); }}
              />
              <span>m</span>
            </div>
          ) : editedCookTime > 0 ? (
            <Badge
              variant="outline"
              className="gap-1 cursor-pointer hover:bg-muted transition-colors text-xs"
              title="Click to edit"
              onClick={() => setEditingField("cookTime")}
            >
              <Clock className="h-3 w-3" />
              Cook: {editedCookTime}m
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 cursor-pointer hover:bg-muted transition-colors text-xs text-muted-foreground"
              title="Click to set cook time"
              onClick={() => setEditingField("cookTime")}
            >
              <Clock className="h-3 w-3" />
              + Cook
            </Badge>
          )}

          {/* Total — derived, read-only */}
          {totalTime > 0 && (
            <Badge variant="outline" className="gap-1 text-xs">
              Total: {totalTime}m
            </Badge>
          )}

          {/* Servings */}
          {editingField === "servings" ? (
            <div className="flex items-center gap-1 border rounded-full px-2 py-0.5 text-xs bg-background">
              <Users className="h-3 w-3" />
              <input
                type="number" min={1} autoFocus
                className="w-8 bg-transparent outline-none text-center"
                value={editedServings}
                onChange={(e) => setEditedServings(Math.max(1, parseInt(e.target.value) || 1))}
                onBlur={() => setEditingField(null)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingField(null); }}
              />
              <span>servings</span>
            </div>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 cursor-pointer hover:bg-muted transition-colors text-xs"
              title="Click to edit"
              onClick={() => setEditingField("servings")}
            >
              <Users className="h-3 w-3" />
              {editedServings} servings
            </Badge>
          )}

          {/* Difficulty */}
          {editingField === "difficulty" ? (
            <div className="flex gap-1">
              {(["easy", "medium", "hard"] as const).map((d) => (
                <button
                  key={d}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                    editedDifficulty === d
                      ? getDifficultyColor(d) + " border-transparent"
                      : "border-border hover:bg-muted"
                  }`}
                  onClick={() => { setEditedDifficulty(d); setEditingField(null); }}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
          ) : (
            <Badge
              className={getDifficultyColor(editedDifficulty) + " cursor-pointer text-xs"}
              title="Click to change difficulty"
              onClick={() => setEditingField("difficulty")}
            >
              <ChefHat className="h-3 w-3 mr-1" />
              {editedDifficulty.charAt(0).toUpperCase() + editedDifficulty.slice(1)}
            </Badge>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </div>
        )}

        {/* Expandable ingredients + instructions */}
        {hasDetails && (
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Hide details" : "Show ingredients & steps"}
          </button>
        )}
        {expanded && hasDetails && (
          <div className="rounded-xl border border-stone-200/60 dark:border-white/[0.06] overflow-hidden">
            <RecipeDetails ingredients={ingredients} instructions={instructions} />
          </div>
        )}

        {/* Visibility + Save */}
        <div className="flex items-center justify-between pt-1 border-t border-stone-100 dark:border-white/[0.04]">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Visibility:</span>
            <VisibilityPicker value={visibility} onChange={setVisibility} size="sm" />
          </div>
          <Button
            size="sm"
            className="h-7 text-xs px-3"
            disabled={isSaving}
            onClick={() => onSave(buildSaveEntry())}
          >
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>

      </div>
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
    <div className="px-3 pb-3 pt-2.5 space-y-3 bg-stone-50 dark:bg-white/[0.02]">
      {ingredients.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500 mb-1.5">
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
                <li key={i} className="text-[13px] flex gap-2 text-stone-700 dark:text-stone-300">
                  {label && (
                    <span className="shrink-0 text-stone-400 dark:text-stone-500 tabular-nums w-16 text-right">{label}</span>
                  )}
                  <span className="min-w-0">{name}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {instructions.length > 0 && (
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500 mb-1.5">
            <ListOrdered className="h-3 w-3" />
            Instructions
          </p>
          <ol className="space-y-1.5">
            {instructions.map((step, i) => (
              <li key={i} className="text-[13px] flex gap-2 text-stone-700 dark:text-stone-300">
                <span className="shrink-0 text-stone-400 dark:text-stone-500 tabular-nums font-medium w-4 text-right">{i + 1}.</span>
                <span className="min-w-0 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
