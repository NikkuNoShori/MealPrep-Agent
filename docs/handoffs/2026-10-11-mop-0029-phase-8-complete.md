# MOP-0029 Phase 8 Complete — 2026-10-11

## Summary
Resolved the "MOP-0029 uncommitted work" open question from the same-day `2026-10-11-mop-0032-qol-batch-1-complete.md` entry. The flagged files were MOP-0029 Phase 8 (gradients, shadows, CI governance check) — work from a background agent dispatched in a prior session that got cut off mid-run when that session ended before it could report back or commit. This session independently re-verified the agent's actual output from scratch (not trusted on the agent's self-report), confirmed it was solid, and committed it.

## What changed (committed)

- `492f7c7` — `feat(MOP-0029)`: Phase 8 — gradients, shadows, CI governance. Tokenizes 4 genuinely decorative gradient sites (`GroceryCart.tsx`, `Admin.tsx`, `RecipeList.tsx`) onto `--gradient-warm`; adds `--gradient-warm-from-rgb`/`-to-rgb` triplet vars (same fix pattern as `--surface-*-rgb` from Phase 4/6, since Tailwind's arbitrary-value syntax can't derive an alpha channel from an opaque `var()` reference); adds a new `--shadow-accent` token (the one approved exception to the neutral-black shadow default) derived per-preset from `scheme.gradient.warm.from`; re-points `InviteAccept.tsx`'s success/error state icons onto existing `--status-success`/`--status-error` tokens instead of hardcoded rose/green; ships `scripts/check-color-governance.js` — a CI check for COLOR_SCHEMA.md rules G1/G2/G3/G5, allowlist-driven with a committed ratcheting baseline (`.color-baseline.json`: G1 427, G2 2, G3 327, G5 0), wired into `npm run lint`.

This closes out the file list the prior entry flagged as unexplained: `themeStore.ts`, `Admin.tsx`, `InviteAccept.tsx`, `GroceryCart.tsx`, `RecipeList.tsx`, `index.css` were all this work, now committed. `openrouter-client.ts`, `dispatch.ts`, `text-adapter.ts`, `extract.ts`, `extract_test.ts`, `ChatInterface.tsx` were **not** MOP-0029 — those remain uncommitted and are unrelated (see below).

One self-correction during this session: the first commit attempt (`3c689fd`, since reset and superseded by `492f7c7`) accidentally picked up an unrelated staged rename (`docs/SESSION_HANDOFF.md` → `docs/handoffs/2026-06-16-video-intake-chat-agent.md`) that was sitting in another session's staged index — not caught by `git status --short <pathspec>` on just the 9 intended files. Fixed via `git reset --soft HEAD~1` + `git restore --staged .` + re-adding exactly the 9 files, confirmed via an unfiltered `git diff --cached --stat` before recommitting. The rename itself is legitimate (pure move, zero content change, presumably from whatever session created `docs/handoffs/`) and is still sitting correctly staged for whoever owns that work to commit.

## Uncommitted / in-flight

Current `git status` (unrelated to this session, do not touch without understanding):

- `docs/SESSION_HANDOFF.md` (deleted) / `docs/handoffs/2026-06-16-video-intake-chat-agent.md`, `2026-10-11-mop-0032-qol-batch-1-complete.md`, `README.md` (untracked) — another session's handoff-system setup (the `/handoff` skill and `docs/handoffs/` directory). Not MOP-0029, not touched by this session beyond accidentally staging/unstaging the rename as described above.
- `src/components/chat/ChatInterface.tsx` — modified, NOT MOP-0029. Checked the diff: it's image-compression logic referencing MOP-0034 (screenshot extraction), capping the short image dimension instead of the long one to preserve legibility on tall phone screenshots. Belongs to the MOP-0034 work, not this session.
- `supabase/functions/_shared/openrouter-client.ts`, `recipe-prompts.ts`, `recipe-schema.ts`, `chat-api/__tests__/test-helpers.ts`, `chat-api/index.ts`, `chat-api/tools/dispatch.ts`, `recipe-pipeline/adapters/text-adapter.ts`, `recipe-pipeline/stages/extract.ts`, `extract_test.ts` — modified, NOT MOP-0029 or this session. Presumably MOP-0034/0035 extraction-accuracy work, consistent with the prior entry's note that `extract_test.ts` was already showing as modified before this session started.
- `docs/MOPs/MOP-0012.md`, `docs/MOPs/MOP-0032-qol-backlog-batch-1.md`, `docs/README.md`, `docs/prompts/DOCUMENTATION_UPDATE_PROCEDURE.md`, `.claude/agents/agents-log.md`, `.claude/settings.local.json` — modified, not this session, not investigated.
- `docs/DECISIONS/ADR-0007-extraction-absence-and-provenance-semantics.md`, `docs/MOPs/MOP-0034-screenshot-extraction-accuracy.md`, `docs/MOPs/MOP-0035-extraction-requirements-spec.md` — untracked, not this session (same as flagged in the prior entry, still unresolved).
- `.claude/commands/handoff.md` — untracked, part of the same handoff-system setup as above.

All MOP-0029-related files from the prior entry's "Modified but uncommitted" list are now resolved: `themeStore.ts`, `GroceryCart.tsx`, `RecipeList.tsx`, `index.css`, `Admin.tsx`, `InviteAccept.tsx`, `scripts/check-color-governance.js`, `.color-baseline.json` are all committed as of `492f7c7`.

## Decisions and reasoning

**Gradient tokenization scope was narrowed from "all 16 `bg-gradient-to-*` usages" to 4.** A prior-session categorization pass (before dispatching the Phase 8 agent) found the 16 gradient sites split into genuinely different categories, not all suited to the `brand`/`warm`/`subtle` token family: 4 true decorative/brand accents (tokenized), 3 status-state illustrations in `BatchImportCard.tsx` (extracting=neutral, error=matches destructive, saved=matches success — left as literals, these are a different category), 2 neutral skeleton-loading gradients + 2 black image-scrim overlays in `RecipeCard.tsx`/`RecipeDetail.tsx` (structural, not brand color, left alone), 2 already correctly using tokens from earlier phases (`RecipeImage.tsx`'s `surface-*`, `MealPlanner.tsx`'s per-meal-slot `accentCategory` gradients), 2 semantic success/error icons in `InviteAccept.tsx` (re-pointed onto `--status-*` tokens, not `--gradient-*`, since they represent state not decoration), and 1 that doesn't match any existing token (`Admin.tsx:108`'s indigo/purple avatar fallback — left as a literal, flagged for a future token family if this pattern recurs).

**`--shadow-accent` is per-preset-reactive, derived from `gradient.warm.from`**, not a static hardcoded value — switching presets will shift the shadow tint along with the gradient it sits under. Scoped explicitly as the *one* named exception to COLOR_SCHEMA.md's neutral-black shadow default (confirmed by re-reading that guidance before implementing), not a precedent for adding more accent-tinted shadows elsewhere without a specific reason.

**CI governance script (G1 count) deliberately does NOT special-case `themeStore.ts`'s ~370 legitimate L1 hex literals.** A textual grep can't reliably distinguish "hex inside a `ColorScheme` ramp object" from "hex inside a `className`/`style` prop" without a full parser; rather than hand-wave a silent exclusion that could mask a real new violation elsewhere, the script counts all `.ts`/`.tsx` hex literals and relies on the ratcheting baseline to absorb the known-legitimate count. Documented inline in the script as a known limitation, not a bug, with a note that AST-based exclusion is a future refinement if the budget allows.

**Baseline counts are measured from the real current state, not the MOP's original audit figures** (which were already stale by the time Phase 7 landed — see the 2026-10-04 MOP-0029 doc update entry for that drift history). G1=427, G2=2 (both are documentary code comments, not live violations), G3=327, G5=0.

## Known issues / things that look wrong but aren't (or are)

**Orphaned commit `3c689fd` exists in reflog but not on any branch.** This was the first Phase 8 commit attempt before the stray-rename fix (see above). It's unreferenced and will be garbage-collected eventually; no action needed, just noting it in case `git log --all` or reflog inspection turns it up and looks confusing.

**MOP-0029's remaining scope is Phase 9 verification only.** Phase 9 ("author the professional presets") was already substantively completed back in Phase 4 — all five presets' full token data had to exist before Phase 4's Tailwind wiring could reference it. What's left under "Phase 9" is checking the MOP's acceptance criteria against the now-complete implementation, not new design or implementation work. The MOP doc itself (updated 2026-10-04) already reflects this.

**`docs/MOPs/MOP-0029-theme-token-layering-surface-presets.md`, `docs/MOPs/REGISTRY.md`, and `docs/CHANGELOG.md` were NOT updated this session** to reflect Phase 8's completion — only the code was committed. The doc update from the 2026-10-04 session covered Phases 0–7; Phase 8's status in those docs is still stale (shows as not-started). Checked `docs/CHANGELOG.md` directly — no entry exists for `492f7c7` or Phase 8 at all. MOP-0029's own acceptance criteria (line 470) explicitly require a CHANGELOG entry before the MOP can be marked complete, so this is a real gap, not just a nice-to-have. This should be fixed before/during Phase 9 verification.

## Open questions for the user

None blocking — Phase 8's own scope is complete and verified. The broader "what to do with all the other uncommitted/untracked files in this repo" question from the prior entry (ADR-0007, MOP-0034, MOP-0035, the chat-api/recipe-pipeline edge function changes) remains open and is not this session's to answer.

## Suggested next steps

1. Update `docs/MOPs/MOP-0029-theme-token-layering-surface-presets.md`, `docs/MOPs/REGISTRY.md`, and `docs/CHANGELOG.md` to mark Phase 8 complete (commit `492f7c7`), matching the style of the 2026-10-04 update that covered Phases 0–7. The CHANGELOG entry is a hard requirement per the MOP's own acceptance criteria, not optional polish.
2. Run Phase 9 verification: check the MOP's acceptance criteria against the current state (all five presets fully specified — confirm via `src/stores/themeStore.ts`), likely via `/verify-mop MOP-0029` once the Scope of Work / Verification block covers Phase 8/9.
3. Decide whether to flip MOP-0029's status to `complete` once Phase 9 verification passes, or whether any further phases are intended (the MOP as currently scoped ends at Phase 9).
4. Separately: the other session's open questions (migrations 047/048 deployed?, ADR-0007/MOP-0034/MOP-0035 disposition, MOP-0032 formal closure) remain unanswered and are unrelated to MOP-0029 — worth a human pass to avoid losing track of them across sessions.
