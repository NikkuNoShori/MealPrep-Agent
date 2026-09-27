# MOP Registry

> **Method of Procedure** — Tracks planned, in-progress, and completed improvement initiatives for the MealPrep Agent project.

**Last reviewed:** 2026-09-27
**Last updated:** 2026-09-27 (MOP-0011 verifying — all 5 phases complete; migration 046 awaiting deploy)

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
| [MOP-0011](MOP-0011.md) | Normalize `meal_plans` JSONB → Child Tables | verifying | 2026-06-01 | 2026-09-27 | — | Nick Neal |
| [MOP-0012](MOP-0012.md) | Recipe-Pipeline Test Fixture Library | deferred | 2026-06-01 | 2026-09-07 | — | Nick Neal |
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
| [MOP-0029](MOP-0029-theme-token-layering-surface-presets.md) | Theme Token Layering & Surface-Aware Presets | deferred | 2026-09-21 | 2026-09-22 | — | surface-reviewer |
| [MOP-0030](MOP-0030-dashboard-redesign-real-data-widgets.md) | Dashboard Redesign — Real-Data Widgets | complete | 2026-09-22 | 2026-09-25 | 2026-09-25 | Nick Neal |
| [MOP-0031](MOP-0031-direct-recipe-sharing.md) | Direct Recipe Sharing | complete | 2026-09-22 | 2026-09-25 | 2026-09-25 | Nick Neal |

> **MOP-0030 complete 2026-09-25.** `/verify-mop` passed all 12 assertions (lint, build, 240/240 tests, RPC structural checks). A `data-integrity` review of the new `get_dashboard_stats()` RPC found and this MOP fixed two real bugs before completion: (1) recipe-count/top-cuisines queries referenced a superseded RLS policy (migration 009) and silently missed recipes visible only via collection-sharing (migration 012's 4th OR-branch) — added a `collection_shared_count` bucket; (2) the most-cooked-this-month query's `::UUID` cast had no value-shape guard, so one malformed `recipeId` could abort the entire RPC payload — added a regex guard. **Note on history:** these two fixes are committed but bundled without their own commit message inside `54ad8f8` (a separate session's MOP-0031 commit) — the fixes are verified correct and present, left as-is rather than rewriting shared history.
>
> **MOP-0029 (scope expanded 2026-09-21):** Now covers all thirteen color-surface categories, not just backgrounds. Grew from 6 to 10 phases. **Phases 0, 1, 2, 3, and 5 are implemented** (commits `48d965f`, `aeb2457`). Phase 9's palette-design blocker cleared 2026-09-22 — full hex specs for all five presets approved. **MOP-0030 has now shipped, clearing the deferral trigger for Phases 4, 6, 7, 8, 9** — see MOP-0029 §Trigger Conditions for remaining scheduling.

> **MOP-0016:** Phases 1–3b shipped 2026-06-16 (`chat-api` deployed). **Outstanding:** deploy `recipe-pipeline`, run §Operator smoke tests, then promote to `verifying`. MOP-0004 and MOP-0005 promoted from legacy `draft` → `in_progress` after status audit. Each MOP now carries a "Shipped as of" callout with explicit outstanding items. Promotion to `verifying`/`complete` is gated by the lockticket Verification block (MOP-0010).

> **MOP-0017:** Phase 1 shipped 2026-09-03. Phases 2–5 (SSE edge function, agent-loop onDelta, frontend reader, verification) implemented 2026-09-04. Status `verifying` — pending `/verify-mop` and `chat-api` deploy.

> **MOP-0011 (2026-09-27):** All 5 phases implemented. Migration 046 authored locally — user deploys. After deploy: run `npm run types:supabase` to regenerate `database.ts` and remove `(supabase as any)` casts; then run `/verify-mop MOP-0011` to close.
>
> **Deferred-with-trigger MOPs:** MOP-0011 trigger fired (2026-09-27) — now `verifying`. MOP-0029 follows the same pattern (see MOP-0029 §Trigger Conditions), with the nuance that its Phases 1–2 are separable correctness fixes that may land ahead of the trigger. This pattern now has multiple instances; codify it in MOP_TEMPLATE.md.

---

## How to Create a New MOP

1. Copy [MOP_TEMPLATE.md](MOP_TEMPLATE.md) to `MOP-XXXX.md` (next sequential number)
2. Fill in all header fields and scope of work
3. Add an entry to the registry table above
4. Set status to `draft` or `planned`

## How MOPs Get Updated

- MOPs are reviewed during every [Documentation Update Procedure](../prompts/DOCUMENTATION_UPDATE_PROCEDURE.md) execution
- When work is completed on a MOP phase, update the MOP and bump the registry `Updated` date
- When all phases are done, set status to `completed` and fill in the `Completed` date
