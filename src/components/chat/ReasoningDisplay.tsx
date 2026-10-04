/**
 * MOP-0020 — Realtime Reasoning Display
 *
 * Shows tool-step progress during AI responses. While streaming: expands
 * automatically to reveal live steps. After the first delta arrives (or on a
 * finished message): collapses to a one-line "Ran N steps" summary, which the
 * user can expand to inspect the full step list.
 */

import React, { useEffect, useRef, useState } from "react";
import { CheckCircle, XCircle, ChevronDown, ChevronUp, Loader2, Wrench } from "lucide-react";
import type { ToolStep } from "./ChatInterface";

export interface ReasoningDisplayProps {
  steps: ToolStep[];
  /** True while SSE stream is still open and deltas are arriving. */
  isStreaming: boolean;
}

export function ReasoningDisplay({ steps, isStreaming }: ReasoningDisplayProps) {
  // Start expanded during active tool use; collapse once streaming finishes.
  const [expanded, setExpanded] = useState(true);
  const hasCollapsed = useRef(false);

  // Auto-collapse when streaming ends (i.e., isStreaming flips from true → false).
  useEffect(() => {
    if (!isStreaming && !hasCollapsed.current && steps.length > 0) {
      hasCollapsed.current = true;
      setExpanded(false);
    }
  }, [isStreaming, steps.length]);

  if (steps.length === 0) return null;

  const allDone = steps.every((s) => s.done);
  const anyFailed = steps.some((s) => s.done && s.ok === false);
  const lastStep = steps[steps.length - 1];

  const headerLabel = allDone
    ? `Ran ${steps.length} step${steps.length === 1 ? "" : "s"}`
    : lastStep?.label ?? "Thinking…";

  return (
    <div
      className="reasoning-panel my-1.5 rounded-lg border border-border/50 bg-muted/30 text-xs overflow-hidden"
      data-testid="reasoning-panel"
    >
      {/* ── Header / toggle ─────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
        aria-expanded={expanded}
        data-testid="reasoning-toggle"
      >
        {/* Status icon */}
        {!allDone ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary flex-shrink-0" />
        ) : anyFailed ? (
          <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
        ) : (
          <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
        )}

        <span className="flex-1 font-medium text-muted-foreground truncate">
          {headerLabel}
        </span>

        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        )}
      </button>

      {/* ── Step list (expandable) ───────────────────────────────── */}
      {expanded && (
        <ol
          className="border-t border-border/40 divide-y divide-border/30 max-h-48 overflow-y-auto"
          data-testid="reasoning-steps"
        >
          {steps.map((step, i) => (
            <li key={i} className="flex items-center gap-2 px-3 py-1.5">
              {/* Step icon */}
              {!step.done ? (
                <Loader2 className="h-3 w-3 animate-spin text-primary flex-shrink-0" />
              ) : step.ok === false ? (
                <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />
              ) : (
                <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
              )}

              {/* Tool icon + label */}
              <Wrench className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
              <span className="flex-1 text-muted-foreground truncate">
                {step.label}
              </span>

              {/* Duration badge */}
              {step.done && step.durationMs !== undefined && (
                <span className="ml-auto pl-2 text-muted-foreground/50 tabular-nums flex-shrink-0">
                  {step.durationMs < 1000
                    ? `${step.durationMs}ms`
                    : `${(step.durationMs / 1000).toFixed(1)}s`}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
