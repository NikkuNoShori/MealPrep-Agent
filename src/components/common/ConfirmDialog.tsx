import { useEffect, useRef } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Generic accessible confirmation modal for destructive actions (delete a
 * meal plan, delete a chat conversation, etc.) — a proper role="dialog"
 * implementation with a focus trap and Escape-to-close, unlike
 * DayAssignmentModal/ServingsModal which lack both. Modeled on
 * ConfirmationPrompt.tsx's inline pattern (role, labeled actions) but as
 * an overlay, since these actions are triggered from menu items rather
 * than inline in a message stream.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  isConfirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    // Default focus on the safe (Cancel) action, not the destructive one.
    cancelButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;

      // Minimal focus trap: cycle Tab/Shift+Tab within the dialog.
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="w-full max-w-sm rounded-2xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#1e1f26] p-5 shadow-2xl animate-scale-in"
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center">
            <AlertTriangle className="h-4.5 w-4.5 text-rose-500 dark:text-rose-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="confirm-dialog-title" className="text-sm font-semibold text-stone-900 dark:text-white">
              {title}
            </h2>
            <p id="confirm-dialog-description" className="text-sm text-stone-500 dark:text-gray-400 mt-1">
              {description}
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={isConfirming}
            className="flex-1 h-9 rounded-xl text-sm font-medium border border-stone-200 dark:border-white/[0.1] text-stone-700 dark:text-gray-300 hover:bg-stone-50 dark:hover:bg-white/[0.04] disabled:opacity-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className="flex-1 h-9 rounded-xl text-sm font-medium bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white transition-colors flex items-center justify-center gap-1.5"
          >
            {isConfirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
