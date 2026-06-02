Run the documentation update procedure after a MOP has been marked as completed.

## Instructions

Follow the full procedure defined in `docs/prompts/DOCUMENTATION_UPDATE_PROCEDURE.md`. That file is the single source of truth — read it and execute every step in order.

## When to use

This skill MUST be invoked any time a MOP's status is changed to `complete` (or `completed`). A MOP status change is the trigger — do not skip or defer the documentation update.

## Workflow

1. Read `docs/prompts/DOCUMENTATION_UPDATE_PROCEDURE.md` in its entirety.
2. Execute **Step 0** through **Step 7** exactly as written in that procedure.
3. The completed MOP is the primary scope — identify all code changes associated with it and update the canonical docs accordingly (`docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/API.md`, `docs/RUNBOOK.md`, the MOP itself, and the MOP registry).
4. If the MOP references a branch or PR, use that to determine the full diff of changes.

## Key rules

- The procedure file is authoritative. If these instructions conflict with the procedure, the procedure wins.
- Always ask for the requester identity (Step 0) before proceeding.
- `CHANGELOG.md` must always be updated, even if no other docs need changes.
- Commit documentation updates in a dedicated commit, separate from code changes.
- Never push migrations or modify the remote database (HARD RULE — see project memory).
