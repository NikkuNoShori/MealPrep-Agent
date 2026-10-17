# MOP Registry

> **Method of Procedure** — Tracks planned, in-progress, and completed improvement initiatives for the MealPrep Agent project.

**Last reviewed:** 2026-10-16
**Last updated:** 2026-10-16 (MOP-0011 `/verify-mop` run — 13/13 verification assertions pass, 10/11 acceptance criteria checked off; held at `verifying` pending Supabase MCP auth to run the one remaining criterion, read-parity sampling, for real). Previous: 2026-10-16 (`/update-registry` sync — MOP-0034's row date corrected 2026-10-13→2026-10-16 to match its file header after today's Phase 5c work). Previous: 2026-10-16 (MOP-0041 drafted — optional ingredient indicator; MOP-0034 Phase 5c added — container-size loss; quick fix shipped outside any MOP — per-ingredient `notes` now renders in the UI, was saved but never shown). Previous: 2026-10-16 (MOP-0036 closed complete — Deno CI job + local toolchain wired; found and fixed 10 real bugs along the way: 2 type-narrowing bugs, 1 deprecated-syntax runtime risk, 7 untyped-catch issues including a genuine operator-precedence logic bug in chat-api/index.ts; 2 new agent-loop regression tests added, 44→46 Deno tests). Previous: 2026-10-16 (MOP-0040 drafted — recipe grid ad placement/monetization, found as an untracked empty spacer div during a breakpoint-regression fix; no prior ADR/MOP covered ads). Previous: 2026-10-16 (MOP-0029 closed complete — `/verify-mop` found and fixed 2 real hardcoded-hex bugs in Phase 9's verification pass; `.color-baseline.json` ratcheted down 427→416; ADR-0006 → `accepted`, `COLOR_SCHEMA.md` → normative). Previous: 2026-10-13 (MOP-0039 drafted — audio as a first-class recipe input, resolving the ambiguous "audio input status" open item from handoff catch-up; confirmed via code that no audio source_type exists anywhere today, only nested inside video processing). Previous: 2026-10-13 (MOP-0032 closed complete — real build-break + 3 UI bugs found and fixed during /verify-mop; all 5 qa-auditor critical findings from 2026-10-11 re-checked and confirmed resolved; 2 wrong assertions in its own Verification block corrected. MOP-0012 promoted deferred → planned, trigger fired per confirmed 2026-10-11 decision. MOP-0029/MOP-0016 stale registry notes corrected — both were actually further along than the notes said). Previous: 2026-10-13 (MOP-0038 drafted — recipe notes field + chat-driven draft recipe editing; investigation found "new recipe in same session" and direct card editing both already work, narrowing scope to one new tool + one new field). Previous: 2026-10-13 (MOP-0037 drafted — reasoning panel redesign + recipe/delta delivery ordering, bundled per user request, no code written; MOP-0034 gained two more Phase 5a checks for dropped range quantities and unfolded garnish duplicates, found during live retest). Previous: 2026-10-13 (MOP-0034 items 1f–1h and 5a implemented; status moved draft → in_progress; 3e deferred after root-cause confirmed model-side). Previous: 2026-10-12 (MOP-0034 addendum: 1-ingredient screenshot collapse, items 1f–1h + 3e added, Phase 5 validation spec revised; MOP-0036 drafted by surface-reviewer — Deno edge-function tests in CI). Previous: 2026-10-04 (MOP-0029 Phase 7 complete — stone-* migration finished; MOP-0034 + MOP-0035 drafted by surface-reviewer from screenshot-extraction audit; MOP-0033 number reserved by MOP-0032 for nutrition/frequency/family-requests)

---

## Statuses

> Source of truth: [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md). The table below is a quick-reference summary.

| Status | Meaning |
|--------|---------|
| `draft` | MOP written, not yet reviewed for feasibility |
| `evaluation` | Actively investigating feasibility, cost, or approach |
| `approved` | Evaluation passed — feasible and green-lit, not yet scheduled |
| `planned` | Scheduled for upcoming work (sprint/milestone assignment) |
| `in_progress` | Actively being built |
| `verifying` | Implementation done; `/verify-mop` running the Verification block |
| `complete` | Code shipped, merged, and verified. Triggers `/update-docs` |
| `blocked` | Verification failed; back to `in_progress` after fix |
| `cancelled` | Will not be done (must include `> Reason:`) |
| `deferred` | Feasible but deprioritized (must include `> Reason:`; may include trigger conditions for revisit) |

> **Backwards compatibility:** Existing MOPs (MOP-0001 through MOP-0011 as of 2026-06-01) were authored under a simpler 4-status vocabulary (`draft` / `planned` / `completed` / `cancelled`). They keep their legacy strings until the next status change, at which point they migrate to the lifecycle vocabulary above. `/update-registry` reports drift but does not auto-migrate. The `completed` → `complete` mapping is the only string change.

---

## Registry

| MOP | Title | Status | Submitted | Updated | Completed | Submitted By |
|-----|-------|--------|-----------|---------|-----------|--------------|
| [MOP-0001](MOP-0001.md) | Recipe Pipeline Improvements (Images, Multi-Recipe, Quantities) | complete | 2026-03-11 | 2026-03-11 | 2026-03-11 | Nick Neal |
| [MOP-0002](MOP-0002.md) | Family Sharing, Recipe Permissions & Collections | complete | 2026-03-11 | 2026-03-14 | 2026-03-14 | Nick Neal |
| [MOP-0003](MOP-0003.md) | Dietary Profiles & Allergen Detection | cancelled | 2026-03-12 | 2026-09-06 | — | Nick Neal |
| [MOP-0004](MOP-0004.md) | Meal Planner & Grocery Cart | complete | 2026-03-12 | 2026-06-14 | 2026-06-14 | Nick Neal |
| [MOP-0005](MOP-0005.md) | Test Coverage & Testing Infrastructure | complete | 2026-03-14 | 2026-06-14 | 2026-06-14 | Nick Neal |
| [MOP-0006](MOP-0006.md) | Generated Supabase Types & API Typing | complete | 2026-05-08 | 2026-06-03 | 2026-06-03 | Nick Neal |
| [MOP-0007](MOP-0007.md) | Wire RAG into Recipes Page, Meal Planner Suggestions, Reactions as Ranking Signal | complete | 2026-06-01 | 2026-09-16 | 2026-09-16 | Nick Neal |
| [MOP-0008](MOP-0008.md) | Chat: Intent Router → Tool-Using Single Agent | complete | 2026-06-01 | 2026-06-15 | 2026-06-15 | Nick Neal |
| [MOP-0009](MOP-0009.md) | Dev Automation Expansion (migration-rls-checker, scaffolders, runbook-recorder) | deferred | 2026-06-01 | 2026-09-07 | — | Nick Neal |
| [MOP-0010](MOP-0010.md) | Lockticket MOP System (machine-verifiable acceptance criteria) | complete | 2026-06-01 | 2026-09-07 | 2026-09-07 | Nick Neal |
| [MOP-0011](MOP-0011.md) | Normalize `meal_plans` JSONB → Child Tables | verifying | 2026-06-01 | 2026-10-16 | — | Nick Neal |
| [MOP-0012](MOP-0012.md) | Recipe-Pipeline Test Fixture Library | planned | 2026-06-01 | 2026-10-13 | — | Nick Neal |
| [MOP-0013](MOP-0013.md) | Playwright E2E Test Setup | complete | 2026-06-01 | 2026-09-04 | 2026-09-04 | Nick Neal |
| [MOP-0014](MOP-0014-household-write-atomicity-rpcs.md) | Household Write Atomicity — `transferOwnership` & `respondToInvite` RPCs | complete | 2026-06-01 | 2026-09-21 | 2026-09-16 | surface-reviewer |
| [MOP-0015](MOP-0015-embedding-refresh-lifecycle.md) | Embedding Refresh Lifecycle — fix stale embeddings from edited recipes | complete | 2026-06-04 | 2026-09-06 | 2026-09-06 | chat-rag-sme audit |
| [MOP-0016](MOP-0016-short-form-video-intake.md) | Short-Form Video Recipe Intake (ToS-Compliant) | complete | 2026-06-15 | 2026-09-05 | 2026-09-05 | Nick Neal |
| [MOP-0017](MOP-0017-streaming-chat-responses.md) | Streaming Chat Responses | complete | 2026-09-03 | 2026-09-04 | 2026-09-04 | Nick Neal |
| [MOP-0018](MOP-0018-ai-tool-expansion.md) | AI Tool Catalog Expansion — Save, Grocery, Household, Reactions | complete | 2026-09-04 | 2026-09-05 | 2026-09-05 | Nick Neal |
| [MOP-0019](MOP-0019-batch-recipe-import.md) | Batch Recipe Import — SSE-Streamed Multi-URL Extraction | complete | 2026-09-05 | 2026-09-05 | 2026-09-05 | Nick Neal |
| [MOP-0020](MOP-0020-realtime-reasoning-display.md) | Realtime Reasoning Display — Tool Step Visibility in Chat | complete | 2026-09-05 | 2026-09-06 | 2026-09-06 | Nick Neal |
| [MOP-0021](MOP-0021-multi-week-meal-planner-view.md) | Multi-Week Meal Planner View | complete | 2026-09-05 | 2026-09-06 | 2026-09-06 | Nick Neal |
| [MOP-0022](MOP-0022-configurable-plan-period.md) | Configurable Default Meal Plan Period | complete | 2026-09-05 | 2026-09-06 | 2026-09-06 | Nick Neal |
| [MOP-0023](MOP-0023-meal-randomizer.md) | "I Don't Know" Meal Randomizer | complete | 2026-09-05 | 2026-09-06 | 2026-09-06 | Nick Neal |
| [MOP-0024](MOP-0024-allergy-tagging.md) | Automatic Allergy Tagging on Recipe Import | complete | 2026-09-05 | 2026-09-06 | 2026-09-06 | Nick Neal |
| [MOP-0025](MOP-0025-dietary-allergy-profiles.md) | Household Dietary & Allergy Profiles UI | complete | 2026-09-05 | 2026-09-06 | 2026-09-06 | Nick Neal |
| [MOP-0026](MOP-0026-security-auditor-agent.md) | Security Auditor Agent | complete | 2026-09-07 | 2026-09-22 | 2026-09-22 | Nick Neal |
| [MOP-0027](MOP-0027-tos-compliant-url-scraping.md) | ToS-Compliant URL Scraping — robots.txt check + domain blocklist | complete | 2026-09-07 | 2026-09-07 | 2026-09-07 | Nick Neal |
| [MOP-0028](MOP-0028-bulk-recipe-actions.md) | Bulk Recipe Actions — Multi-Select Visibility, Folder Assignment, Delete, and Sharing | complete | 2026-09-21 | 2026-09-21 | 2026-09-21 | Nick Neal |
| [MOP-0029](MOP-0029-theme-token-layering-surface-presets.md) | Theme Token Layering & Surface-Aware Presets | complete | 2026-09-21 | 2026-10-16 | 2026-10-16 | surface-reviewer |
| [MOP-0030](MOP-0030-dashboard-redesign-real-data-widgets.md) | Dashboard Redesign — Real-Data Widgets | complete | 2026-09-22 | 2026-09-25 | 2026-09-25 | Nick Neal |
| [MOP-0031](MOP-0031-direct-recipe-sharing.md) | Direct Recipe Sharing | complete | 2026-09-22 | 2026-09-25 | 2026-09-25 | Nick Neal |
| [MOP-0032](MOP-0032-qol-backlog-batch-1.md) | QoL Backlog Batch 1 — Extraction, Chat, Recipes, Planner, Grocery | complete | 2026-09-28 | 2026-10-13 | 2026-10-13 | Nick Neal |
| [MOP-0034](MOP-0034-screenshot-extraction-accuracy.md) | Screenshot / Image Recipe Extraction Accuracy | in_progress | 2026-10-04 | 2026-10-16 | — | surface-reviewer |
| [MOP-0035](MOP-0035-extraction-requirements-spec.md) | Per-Modality Recipe Extraction Requirements Spec | draft | 2026-10-04 | 2026-10-04 | — | surface-reviewer |
| [MOP-0036](MOP-0036-edge-function-deno-tests-in-ci.md) | Edge-Function Deno Tests in CI + Local Toolchain | complete | 2026-10-12 | 2026-10-16 | 2026-10-16 | surface-reviewer |
| [MOP-0037](MOP-0037-reasoning-panel-redesign-and-recipe-delivery-ordering.md) | Reasoning Panel Redesign + Recipe/Delta Delivery Ordering | draft | 2026-10-13 | 2026-10-13 | — | Nick Neal |
| [MOP-0038](MOP-0038-recipe-notes-and-chat-driven-draft-editing.md) | Recipe Notes Field + Chat-Driven Draft Recipe Editing | draft | 2026-10-13 | 2026-10-13 | — | Nick Neal |
| [MOP-0039](MOP-0039-audio-first-class-input.md) | Audio as a First-Class Recipe Input | draft | 2026-10-13 | 2026-10-13 | — | Nick Neal |
| [MOP-0040](MOP-0040-recipe-grid-ad-placement.md) | Recipe Grid Ad Placement & Monetization | draft | 2026-10-16 | 2026-10-16 | — | surface-reviewer |
| [MOP-0041](MOP-0041-optional-ingredient-indicator.md) | Optional Ingredient Indicator | draft | 2026-10-16 | 2026-10-16 | — | surface-reviewer |

> **MOP-0041 (2026-10-16):** Drafted after a user-reported screenshot showed "freshly chopped parsley, if desired" with no optional indicator anywhere in the UI. recipe-pipeline-sme diagnosis found two display conventions had drifted apart (manual-entry qualifier-in-unit vs. LLM-extraction qualifier-in-notes) and recommended a dedicated `optional?: boolean` field over a text-prefix convention — a prefix would corrupt duplicate-detection, grocery aggregation, allergy-checker matching, and embeddings/RAG, all of which match on exact ingredient name. Same diagnosis session also surfaced the container-size-loss bug, routed to MOP-0034 Phase 5c instead (closer fit, already-active MOP), and a frontier display bug (per-ingredient `notes` never rendered anywhere), fixed same-day outside any MOP.

> **MOP-0040 (2026-10-16):** Drafted after a `ui-designer` subagent, fixing a recipe-card breakpoint regression, found the "ad rail" referenced in code comments is an empty 300px reserved spacer with no provider, component, or consent handling behind it. No ADR or MOP previously tracked ad monetization anywhere in the repo.

> **MOP-0036 (2026-10-12):** Drafted after an `agent-loop.ts` crash (`lastRecipes.length` on undefined, from dc8bf5d) sat on `main` for about 5 weeks. The existing Deno test that covers that path was never run, because CI has no Deno job and Deno isn't installed locally. Recommended P1. Phase 4 re-checks MOPs whose `deno test` verification assertions may never have actually executed (MOP-0008, MOP-0016, MOP-0034).

> **MOP-0034 addendum (2026-10-12):** A 17-ingredient Instagram screenshot was extracted as 1 ingredient. Added 1f (example ingredient array has only 1 item), 1g (rule for inline alternative quantities), 1h (`c` → `cup`), and 3e (`recipes[]` unwrap lets the item win over a fuller top-level list; confirm via raw log first). Revised Phase 5: its original "≥1 ingredient" check would have passed this output. Split into 5a plausibility gate (P1) and 5b JSON mode (P2). **Status drift note resolved (2026-10-16):** this note originally flagged status still reading `draft` despite Phases 1–3 being committed — status has since moved to `in_progress` (2026-10-13) and the MOP has continued through Phase 5c (2026-10-16). Kept for historical context only.
>
> **MOP-0034 / MOP-0035 (2026-10-04):** Drafted from the recipe-pipeline-sme screenshot-extraction audit. Backed by ADR-0007 (absent = null, uncertainty → `warnings[]`). MOP-0034 Phase 1c supersedes MOP-0032 Phase 1 item 6's ≤3-word instruction filter. MOP-0012's deferral trigger has likely fired (second image-path extraction bug) and awaits a user decision on promotion. MOP-0033 is intentionally unassigned: MOP-0032 reserves it for nutrition / meal frequency / family meal requests.

> **MOP-0030 complete 2026-09-25.** `/verify-mop` passed all 12 assertions (lint, build, 240/240 tests, RPC structural checks). A `data-integrity` review of the new `get_dashboard_stats()` RPC found and this MOP fixed two real bugs before completion: (1) recipe-count/top-cuisines queries referenced a superseded RLS policy (migration 009) and silently missed recipes visible only via collection-sharing (migration 012's 4th OR-branch) — added a `collection_shared_count` bucket; (2) the most-cooked-this-month query's `::UUID` cast had no value-shape guard, so one malformed `recipeId` could abort the entire RPC payload — added a regex guard. **Note on history:** these two fixes are committed but bundled without their own commit message inside `54ad8f8` (a separate session's MOP-0031 commit) — the fixes are verified correct and present, left as-is rather than rewriting shared history.
>
> **MOP-0029 (2026-10-13, corrected):** Phases 0–8 of 10 now shipped. Both deferral trigger conditions (MOP-0030 shipped; palette specs approved) cleared 2026-09-25/22. Phase 7 (the `stone-*` → `surface-*` migration) completed across 4 batches, 51 files, 900 occurrences, zero visual change — commits `d05e455`, `8b9bcfb`, `b5c6eb1`, `83c8b40`. 6 real bugs/gaps found and fixed along the way (raw hex literals duplicating existing tokens). **Phase 8 (gradients/shadows/CI enforcement) shipped 2026-10-11 (`492f7c7`)** — this line previously said Phase 8 was unstarted; that was stale and is corrected here per the 2026-10-11-mop-0029-phase-8-complete handoff. Only Phase 9 remains, and only as acceptance-criteria verification (its design work was already completed inside Phase 4).

> **MOP-0016 (2026-10-13, corrected):** Formally closed out — commits `95fcd6c`, `fe3beb6`, `7eea367` marked Phases 1–3b complete and ran `/update-docs`. This line previously said deploy/smoke-test work was still outstanding; that was stale (the entry dated from 2026-06-16, before closure). MOP-0004 and MOP-0005 promoted from legacy `draft` → `in_progress` after status audit. Each MOP now carries a "Shipped as of" callout with explicit outstanding items. Promotion to `verifying`/`complete` is gated by the lockticket Verification block (MOP-0010).

> **MOP-0017:** Phase 1 shipped 2026-09-03. Phases 2–5 (SSE edge function, agent-loop onDelta, frontend reader, verification) implemented 2026-09-04. **Resolved (2026-10-16):** this note originally said status was `verifying`, pending `/verify-mop` and deploy — status has since moved to `complete` (2026-09-04, per the registry table above). Kept for historical context only.

> **MOP-0011 (2026-10-16):** `/verify-mop` run — all 13 verification-block assertions pass (a stale one, filtering on a filename that never existed, was corrected). 10 of 11 acceptance criteria now checked off. Held at `verifying`, not `complete`: "Read parity verified on production-shape sample (≥100 plans)" needs the Supabase MCP connection, which requires an interactive OAuth sign-in this non-interactive session can't perform. User explicitly wants this run for real once authorized, not worked around — do not close this MOP without it. Previous (2026-09-27): All 5 phases implemented. Migration 046 authored locally — user deploys. After deploy: run `npm run types:supabase` to regenerate `database.ts` and remove `(supabase as any)` casts.
>
> **Deferred-with-trigger MOPs:** MOP-0011 trigger fired (2026-09-27) — now `verifying`. MOP-0029 follows the same pattern (see MOP-0029 §Trigger Conditions), with the nuance that its Phases 1–2 are separable correctness fixes that may land ahead of the trigger. This pattern now has multiple instances; codify it in MOP_TEMPLATE.md.

---

## How to Create a New MOP

1. Use the `/new-mop` skill, or copy [MOP_TEMPLATE.md](MOP_TEMPLATE.md) to `MOP-NNNN-short-kebab-title.md` (next sequential number — current MOPs use a descriptive kebab-case suffix, not a bare `MOP-NNNN.md`)
2. Fill in all header fields and scope of work
3. Add an entry to the registry table above
4. Set status to `draft`

## How MOPs Get Updated

- MOPs are reviewed during every [Documentation Update Procedure](../prompts/DOCUMENTATION_UPDATE_PROCEDURE.md) execution
- When work is completed on a MOP phase, update the MOP and bump the registry `Updated` date
- When all phases are done and `/verify-mop` passes, set status to `complete` and fill in the `Completed` date — see [MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md) for the full status vocabulary (MOPs predating 2026-06-01 may still carry the legacy `completed` string per the backwards-compatibility note above)
