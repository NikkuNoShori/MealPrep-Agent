/**
 * MOP-0019 — Batch Recipe Import Panel
 *
 * Renders as a drawer-style overlay above the chat input. Lets the user paste
 * up to 50 URLs, start extraction (SSE-streamed), view per-URL progress cards,
 * save individual recipes or all at once, retry failed URLs, and abort the run.
 *
 * Lifecycle:
 *   idle       — URL textarea + "Import N recipes" button
 *   running    — cards appearing live, Abort button, Save All (disabled until done)
 *   done       — all cards resolved, Save All enabled, Dismiss
 *   saving     — "Save All" spinner; per-card Save spinners
 */

import React, { useState, useRef, useCallback, useId } from "react";
import {
  X,
  PackagePlus,
  Loader2,
  CheckCheck,
  XCircle,
  DownloadCloud,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiClient, parseImportUrls } from "@/services/api";
import type { BatchSSEEvent } from "@/services/api";
import { BatchImportCard } from "./BatchImportCard";
import type { BatchCardEntry } from "./BatchImportCard";

// ─────────────────────────────────────────────────────────────────────────────
// Social media URL detection (mirrors video-url-utils.ts patterns)
// ─────────────────────────────────────────────────────────────────────────────

const SOCIAL_RE =
  /^https?:\/\/(?:(?:www|vm|vt)\.)?tiktok\.com|^https?:\/\/(?:www\.)?instagram\.com\/(?:reel|p)\//i;

function isSocialUrl(url: string): boolean {
  return SOCIAL_RE.test(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type PanelPhase = "idle" | "running" | "done";

interface BatchImportPanelProps {
  /** Called when the panel is dismissed (close button or after all saved). */
  onDismiss: () => void;
  /**
   * Optional callback fired when at least one recipe has been saved.
   * Receives a summary string the chat can echo as a system message.
   */
  onSaveComplete?: (summary: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function BatchImportPanel({ onDismiss, onSaveComplete }: BatchImportPanelProps) {
  const textareaId = useId();

  // ── state ──
  const [urlInput, setUrlInput] = useState("");
  const [phase, setPhase] = useState<PanelPhase>("idle");
  const [cards, setCards] = useState<BatchCardEntry[]>([]);
  const [savingIndices, setSavingIndices] = useState<Set<number>>(new Set());
  const [savingAll, setSavingAll] = useState(false);
  const [doneStats, setDoneStats] = useState<{ total: number; succeeded: number; failed: number } | null>(null);

  // Abort controller kept in a ref so it survives re-renders without triggering them.
  const abortRef = useRef<AbortController | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  // ── derived ──
  const parsedUrls = parseImportUrls(urlInput);
  const urlCount = parsedUrls.length;
  const canImport = urlCount > 0 && urlCount <= 50;
  const socialCount = parsedUrls.filter(isSocialUrl).length;

  const doneSaving = cards.every((c) => c.status === "saved");
  const saveableCount = cards.filter((c) => c.status === "done").length;

  // ── helpers ──

  function scrollToBottom() {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function updateCard(index: number, patch: Partial<BatchCardEntry>) {
    setCards((prev) =>
      prev.map((c) => (c.index === index ? { ...c, ...patch } : c)),
    );
  }

  // ── start import ──
  async function handleImport() {
    if (!canImport) return;

    const urls = parsedUrls;
    const initial: BatchCardEntry[] = urls.map((url, i) => ({
      index: i,
      url,
      status: "extracting",
    }));
    setCards(initial);
    setPhase("running");
    setDoneStats(null);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      await apiClient.batchImport(
        urls,
        {
          onEvent: (event: BatchSSEEvent) => {
            switch (event.type) {
              case "progress":
                // card already set to "extracting" — no-op unless re-running after abort
                updateCard(event.index, { status: "extracting", url: event.url });
                break;

              case "result":
                updateCard(event.index, { status: "done", recipe: event.recipe, url: event.url });
                scrollToBottom();
                break;

              case "error":
                updateCard(event.index, { status: "error", error: event.message, url: event.url });
                scrollToBottom();
                break;

              case "done":
                setDoneStats({ total: event.total, succeeded: event.succeeded, failed: event.failed });
                setPhase("done");
                break;
            }
          },
        },
        abort.signal,
      );
    } catch (err: unknown) {
      if ((err as { name?: string }).name === "AbortError") {
        // User aborted — cards are left in their current state.
        setPhase("done");
      } else {
        // Network / server error — show generic error on any still-extracting card.
        setCards((prev) =>
          prev.map((c) =>
            c.status === "extracting"
              ? { ...c, status: "error", error: "Connection error — please retry." }
              : c,
          ),
        );
        setPhase("done");
      }
    } finally {
      abortRef.current = null;
    }
  }

  // ── abort ──
  function handleAbort() {
    abortRef.current?.abort();
  }

  // ── save one ──
  const handleSave = useCallback(async (entry: BatchCardEntry) => {
    setSavingIndices((prev) => new Set(prev).add(entry.index));
    try {
      await apiClient.ingestRecipeFromUrl(entry.url, true);
      updateCard(entry.index, { status: "saved" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      updateCard(entry.index, { status: "error", error: msg });
    } finally {
      setSavingIndices((prev) => {
        const next = new Set(prev);
        next.delete(entry.index);
        return next;
      });
    }
  }, []);

  // ── save all done cards ──
  async function handleSaveAll() {
    setSavingAll(true);
    const doneCards = cards.filter((c) => c.status === "done");
    await Promise.allSettled(doneCards.map(handleSave));
    setSavingAll(false);

    const savedCount = cards.filter((c) => c.status === "saved").length + doneCards.length;
    const summary = `Saved ${savedCount} recipe${savedCount !== 1 ? "s" : ""} to your library.`;
    onSaveComplete?.(summary);
  }

  // ── retry ──
  const handleRetry = useCallback((entry: BatchCardEntry) => {
    updateCard(entry.index, { status: "extracting", error: undefined, recipe: undefined });
    // Re-run a single URL in isolation.
    const abort = new AbortController();
    apiClient.batchImport(
      [entry.url],
      {
        onEvent: (event: BatchSSEEvent) => {
          if (event.type === "result") {
            updateCard(entry.index, { status: "done", recipe: event.recipe });
          } else if (event.type === "error") {
            updateCard(entry.index, { status: "error", error: event.message });
          }
        },
      },
      abort.signal,
    ).catch((err: unknown) => {
      if ((err as { name?: string }).name !== "AbortError") {
        updateCard(entry.index, { status: "error", error: "Retry failed." });
      }
    });
  }, []);

  // ── dismiss ──
  function handleDismiss() {
    abortRef.current?.abort();
    onDismiss();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div
      data-testid="batch-import-panel"
      className="flex flex-col rounded-xl border border-border bg-background shadow-xl overflow-hidden"
      style={{ maxHeight: "70vh" }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <PackagePlus className="h-4 w-4 text-primary shrink-0" />
        <span className="flex-1 text-sm font-semibold">Batch Recipe Import</span>

        {/* Running stats */}
        {phase !== "idle" && doneStats && (
          <span className="text-xs text-muted-foreground mr-2">
            {doneStats.succeeded} saved · {doneStats.failed} failed
          </span>
        )}

        {/* Abort button (running only) */}
        {phase === "running" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive"
            onClick={handleAbort}
            data-testid="batch-abort-btn"
          >
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Abort
          </Button>
        )}

        {/* Save All (done phase, saveable cards exist) */}
        {phase === "done" && saveableCount > 0 && !doneSaving && (
          <Button
            variant="default"
            size="sm"
            className="h-7 text-xs"
            onClick={handleSaveAll}
            disabled={savingAll}
            data-testid="batch-save-all-btn"
          >
            {savingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
            )}
            Save all ({saveableCount})
          </Button>
        )}

        {/* Dismiss */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleDismiss}
          data-testid="batch-dismiss-btn"
          aria-label="Close batch import"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* ── URL input (idle only) ── */}
      {phase === "idle" && (
        <div className="flex flex-col gap-3 p-4 shrink-0">
          <label htmlFor={textareaId} className="text-xs text-muted-foreground">
            Paste recipe URLs — one per line, or comma-separated. Up to 50 at a time.
          </label>
          <Textarea
            id={textareaId}
            data-testid="batch-url-textarea"
            placeholder={"https://www.allrecipes.com/recipe/…\nhttps://www.seriouseats.com/…"}
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="resize-none text-sm font-mono min-h-[96px]"
            rows={4}
          />
          {/* Social media warning */}
          {socialCount > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>{socialCount} TikTok/Instagram URL{socialCount !== 1 ? "s" : ""} detected.</strong>{" "}
                These platforms block automated scraping — extraction will likely fail. For best results, use regular recipe website URLs (allrecipes.com, seriouseats.com, etc.).
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {urlCount > 0
                ? `${urlCount} URL${urlCount !== 1 ? "s" : ""} detected${urlCount > 50 ? " — capped at 50" : ""}`
                : "No valid URLs yet"}
            </span>
            <Button
              variant="default"
              size="sm"
              onClick={handleImport}
              disabled={!canImport}
              data-testid="batch-import-btn"
            >
              <DownloadCloud className="h-4 w-4 mr-2" />
              Import {urlCount > 0 ? `${Math.min(urlCount, 50)} recipe${Math.min(urlCount, 50) !== 1 ? "s" : ""}` : "recipes"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Progress header (running / done) ── */}
      {phase !== "idle" && (
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b border-border shrink-0">
          {phase === "running" ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">
                Extracting {cards.filter((c) => c.status === "extracting").length > 0
                  ? `${cards.filter((c) => c.status !== "extracting").length} / ${cards.length}`
                  : `${cards.length} / ${cards.length}`} recipes…
              </span>
            </>
          ) : (
            <>
              <CheckCheck className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs text-muted-foreground">
                Extraction complete —{" "}
                {doneStats
                  ? `${doneStats.succeeded} succeeded, ${doneStats.failed} failed`
                  : `${cards.length} processed`}
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Card list ── */}
      {cards.length > 0 && (
        <div
          data-testid="batch-card-list"
          className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 min-h-0"
        >
          {cards.map((entry) => (
            <BatchImportCard
              key={entry.index}
              entry={entry}
              onSave={handleSave}
              onRetry={handleRetry}
              isSaving={savingIndices.has(entry.index) || savingAll}
            />
          ))}
          <div ref={listEndRef} />
        </div>
      )}

      {/* ── All saved confirmation ── */}
      {phase === "done" && doneSaving && cards.length > 0 && (
        <div className="flex items-center justify-center gap-2 p-4 bg-green-500/5 border-t border-green-500/20 shrink-0">
          <CheckCheck className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium text-green-600 dark:text-green-400">
            All recipes saved to your library
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-2 text-xs"
            onClick={handleDismiss}
          >
            Done
          </Button>
        </div>
      )}
    </div>
  );
}
