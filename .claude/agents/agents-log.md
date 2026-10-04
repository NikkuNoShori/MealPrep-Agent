# Agents Run Log

Append-only log of every agent invocation. Per the project's interaction protocol (see individual agent definitions), every agent run — whether or not changes were made — appends an entry here.

## Format

| Date | Agent | Scope | Findings | Changes Made | Requested By |
|------|-------|-------|----------|--------------|--------------|

## Entries

| Date | Agent | Scope | Findings | Changes Made | Requested By |
|------|-------|-------|----------|--------------|--------------|
| 2026-06-01 | doc-adherence | post-12-commit governance sweep (README/CHANGELOG/ARCHITECTURE/RUNBOOK/DOC_UPDATE_PROCEDURE) + new MOPs 0007-0011 + ADRs 0001-0004 + 4 slash commands | 0 critical, 5 warning, 6 suggestion | no — audit-only per user instruction | Nick Neal |
| 2026-06-01 | surface-reviewer | 3 findings from MOP-0005 Phase 1 round-1 agent (api.ts: transferOwnership non-atomic, respondToInvite non-atomic, getRecipeReactions type fallback) | 1 MOP + 0 ADR drafted; 1 trivial-fix; 0 already-covered | yes — MOP-0014-household-write-atomicity-rpcs.md, REGISTRY.md updated | Nick Neal (via MOP-0005 hand-off) |
| 2026-09-03 | chat-rag-sme | diagnosis — recipe cards not rendering + chat-extracted recipes not saved (full tool loop audit: catalog.ts / dispatch.ts / handlers.ts / agent-loop.ts / index.ts persist-extraction / StructuredRecipeDisplay.tsx / conversation-context.ts) | 20+ citations; P0 root cause: dispatch.ts:351 double-wraps handler envelope so agent-loop.ts:266 never reads data.recipe → recipe always null end-to-end. P0-b: no save/persist tool in TOOL_CATALOG — "save it" in chat is a no-op. Plus 6 secondary findings (persist-extraction writes chat_messages only, no embedding on frontend createRecipe, r.similarity vs similarity_score, buildRecipeData drops cuisine/nutrition/slug, last_message_at not updated on agent path, recipe dropped on confirmation short-circuit) | no (audit-only) | Nick Neal |
