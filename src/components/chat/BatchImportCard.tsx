/**
 * MOP-0019 — Per-URL recipe card for the BatchImportPanel.
 *
 * States:
 *   extracting — pulsing skeleton with URL label
 *   done       — recipe title, metadata, Save/Edit actions
 *   error      — URL + error message + Retry button
 *   saved      — success confirmation
 */

import React from "react";
import { CheckCircle2, AlertCircle, Loader2, BookOpen } from "lucide-react";
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
  const { url, status, recipe, error } = entry;
  const displayUrl = (() => {
    try { return new URL(url).hostname; } catch { return url.slice(0, 40); }
  })();

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

  if (status === "saved") {
    return (
      <div
        data-testid={`batch-card-${entry.index}`}
        className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/5 p-3"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{recipe?.title ?? displayUrl}</p>
          <p className="text-xs text-muted-foreground">Saved to library</p>
        </div>
      </div>
    );
  }

  // done
  const ingredientCount = recipe?.ingredients?.length ?? 0;
  const totalTime = recipe?.totalTime ?? (recipe?.total_time);

  return (
    <div
      data-testid={`batch-card-${entry.index}`}
      className="rounded-lg border border-border bg-card p-3 flex items-start gap-3"
    >
      <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{recipe?.title ?? displayUrl}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {ingredientCount > 0 && `${ingredientCount} ingredients`}
          {ingredientCount > 0 && totalTime && " · "}
          {totalTime && `${totalTime} min`}
          {!ingredientCount && !totalTime && displayUrl}
        </p>
      </div>
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
  );
}
