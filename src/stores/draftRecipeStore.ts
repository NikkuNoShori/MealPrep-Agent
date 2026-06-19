import { create } from "zustand";
import type { StructuredRecipe } from "@/types";

const STORAGE_KEY = "mealprep:draft-recipes-v1";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export interface DraftRecipeEntry {
  conversationId: string;
  messageId: string;
  recipeIndex: number;
  recipe: StructuredRecipe;
  /** In-memory only — never persisted (base64 inflates storage). */
  previewImageDataUrl?: string;
  thumbnailUrl?: string;
  editedAt: number;
}

interface DraftRecipeState {
  drafts: Record<string, DraftRecipeEntry>;
  upsertDraft: (
    key: string,
    entry: Omit<DraftRecipeEntry, "editedAt"> & { editedAt?: number }
  ) => void;
  patchDraft: (key: string, patch: Partial<DraftRecipeEntry>) => void;
  getDraft: (key: string) => DraftRecipeEntry | undefined;
  clearDraft: (key: string) => void;
  clearConversationDrafts: (conversationId: string) => void;
  /** Re-key drafts after chat_messages ids change (e.g. post-persist refresh). */
  remapConversationDrafts: (
    conversationId: string,
    slots: Array<{ messageId: string; recipeIndex: number }>
  ) => void;
}

export function buildDraftRecipeKey(
  conversationId: string,
  messageId: string,
  recipeIndex = 0
): string {
  return `${conversationId}:${messageId}:${recipeIndex}`;
}

function loadDraftsFromSession(): Record<string, DraftRecipeEntry> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, DraftRecipeEntry>;
    const now = Date.now();
    return Object.fromEntries(
      Object.entries(parsed).filter(([, entry]) => now - entry.editedAt < DRAFT_TTL_MS)
    );
  } catch {
    return {};
  }
}

function persistDraftsToSession(drafts: Record<string, DraftRecipeEntry>) {
  try {
    const serializable = Object.fromEntries(
      Object.entries(drafts).map(([key, entry]) => [
        key,
        {
          ...entry,
          previewImageDataUrl: undefined,
        },
      ])
    );
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    // sessionStorage full or unavailable — in-memory drafts still work
  }
}

export const useDraftRecipeStore = create<DraftRecipeState>((set, get) => ({
  drafts: loadDraftsFromSession(),

  upsertDraft: (key, entry) => {
    const next: DraftRecipeEntry = {
      ...entry,
      editedAt: entry.editedAt ?? Date.now(),
    };
    set((state) => {
      const drafts = { ...state.drafts, [key]: next };
      persistDraftsToSession(drafts);
      return { drafts };
    });
  },

  patchDraft: (key, patch) => {
    const existing = get().drafts[key];
    if (!existing) return;
    const next: DraftRecipeEntry = {
      ...existing,
      ...patch,
      recipe: patch.recipe ? { ...existing.recipe, ...patch.recipe } : existing.recipe,
      editedAt: Date.now(),
    };
    set((state) => {
      const drafts = { ...state.drafts, [key]: next };
      persistDraftsToSession(drafts);
      return { drafts };
    });
  },

  getDraft: (key) => get().drafts[key],

  clearDraft: (key) => {
    set((state) => {
      if (!state.drafts[key]) return state;
      const drafts = { ...state.drafts };
      delete drafts[key];
      persistDraftsToSession(drafts);
      return { drafts };
    });
  },

  clearConversationDrafts: (conversationId) => {
    set((state) => {
      const drafts = { ...state.drafts };
      let changed = false;
      for (const key of Object.keys(drafts)) {
        if (drafts[key].conversationId === conversationId) {
          delete drafts[key];
          changed = true;
        }
      }
      if (!changed) return state;
      persistDraftsToSession(drafts);
      return { drafts };
    });
  },

  remapConversationDrafts: (conversationId, slots) => {
    set((state) => {
      const drafts = { ...state.drafts };
      const conversationDrafts = Object.entries(drafts).filter(
        ([, entry]) => entry.conversationId === conversationId
      );
      if (!conversationDrafts.length || !slots.length) return state;

      let changed = false;
      for (const [oldKey, entry] of conversationDrafts) {
        const slot = slots[entry.recipeIndex];
        if (!slot) continue;
        const newKey = buildDraftRecipeKey(
          conversationId,
          slot.messageId,
          entry.recipeIndex
        );
        if (newKey === oldKey) {
          if (entry.messageId !== slot.messageId) {
            drafts[newKey] = { ...entry, messageId: slot.messageId };
            changed = true;
          }
          continue;
        }
        drafts[newKey] = {
          ...entry,
          messageId: slot.messageId,
          previewImageDataUrl: entry.previewImageDataUrl,
        };
        delete drafts[oldKey];
        changed = true;
      }

      if (!changed) return state;
      persistDraftsToSession(drafts);
      return { drafts };
    });
  },
}));
