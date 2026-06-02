Recompute `docs/MOPs/REGISTRY.md` from the filesystem to catch manual drift.

## Instructions

This skill reconciles the MOP registry against the actual MOP files. It does **not** check Verification blocks — that is `/verify-mop`'s job (MOP-0010). This skill only syncs status, dates, titles, and submitter metadata.

## Workflow

1. Glob `docs/MOPs/MOP-*.md`, excluding `REGISTRY.md` and `MOP_TEMPLATE.md`.
2. For each file, parse the header table to extract:
   - MOP number
   - Title
   - Status
   - Date Submitted, Date Updated, Date Completed
   - Submitted By
3. Read the current `docs/MOPs/REGISTRY.md` table.
4. Compare the parsed values against the registry. Report:
   - MOPs present on disk but missing from the registry
   - MOPs in the registry that have no file on disk
   - Status, date, or title mismatches between the file header and the registry row
5. Propose a unified diff to the user showing the proposed registry updates.
6. Apply the diff **only after the user approves**. Bump `Last updated` on the registry to today.

## ADR registry

ADRs do **not** have a registry — they are enumerated by directory listing (`docs/DECISIONS/ADR-*.md`). Skip any ADR-registry rebuild. If the user asks why, point them at this note.

## Relationship to `/verify-mop`

`/verify-mop` (MOP-0010, Phase 2) handles the lockticket `## Verification` block — running assertions and gating status transitions to `complete`. `/update-registry` is the lighter-weight precursor: it only mirrors what the MOP files already claim. If a MOP file says `status: complete` but its Verification block has not been run, `/update-registry` will still sync the row — use `/verify-mop` first when promoting to `complete`.

## Do NOT

- Do **not** edit the MOP files themselves to match the registry — the file headers are the source of truth.
- Do **not** auto-apply the diff. Always require explicit user approval.
- Do **not** push migrations or modify the remote database (HARD RULE).
- Do **not** auto-commit the registry update.
