/**
 * MOP-0008 Step 8 — Inline confirmation prompt for destructive chat tool calls.
 *
 * When the chat agent emits a destructive tool call (delete_recipe,
 * update_recipe, overwrite of an occupied meal-plan slot, etc.), the
 * backend short-circuits before executing and returns a
 * `pendingConfirmation` envelope. This component renders the user-facing
 * Confirm / Cancel surface for that envelope.
 *
 * - On Confirm: the parent dispatches `apiClient.sendMessage` with
 *   `context.confirmAction = { tool, args, idempotencyKey }`, which the
 *   edge function executes without re-consulting the model.
 * - On Cancel: the parent clears the pendingConfirmation locally; no
 *   backend call is required since nothing was executed.
 *
 * The summary text is authored server-side by the agent for the
 * specific tool call (e.g. "Delete 'Classic Carbonara' from your saved
 * recipes?"). The tool name is shown as a small monospace label so the
 * user can see exactly which action is pending.
 */

import React from "react";
import { Check, X, AlertTriangle, Loader2 } from "lucide-react";
import type { PendingConfirmation } from "../../services/api";

interface ConfirmationPromptProps {
  pendingConfirmation: PendingConfirmation;
  isConfirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationPrompt: React.FC<ConfirmationPromptProps> = ({
  pendingConfirmation,
  isConfirming,
  onConfirm,
  onCancel,
}) => {
  return (
    <div
      role="alertdialog"
      aria-label="Confirm destructive action"
      className="mt-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3"
    >
      <div className="flex items-start gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Confirm action
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-200 mt-1 break-words">
            {pendingConfirmation.summary}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
            Tool:{" "}
            <span className="font-mono font-semibold">
              {pendingConfirmation.tool}
            </span>
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isConfirming}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 disabled:cursor-not-allowed text-white transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 dark:focus:ring-offset-amber-900"
          aria-label={`Confirm ${pendingConfirmation.tool}`}
        >
          {isConfirming ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Confirming…
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5" />
              Confirm
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isConfirming}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 dark:text-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 dark:focus:ring-offset-gray-900"
          aria-label="Cancel pending action"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
};
