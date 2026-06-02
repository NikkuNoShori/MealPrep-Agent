Scaffold a new MOP (Method of Procedure) from the template and register it.

## Instructions

Single-shot procedure. Do not split into multiple commands.

## Workflow

1. Read `docs/MOPs/REGISTRY.md` and determine the next sequential MOP number (highest existing + 1, zero-padded to 4 digits, e.g. `MOP-0012`).
2. Read `docs/MOPs/MOP_TEMPLATE.md` — this is the structural source of truth, including the `## Verification` and `## Scope Map` blocks.
3. Read `docs/prompts/MOP_STATUS_LIFECYCLE.md` for the valid status vocabulary. Use only statuses defined there.
4. Prompt the user for:
   - **Title** (short descriptive phrase)
   - **Summary** (1-3 sentences — goes in the `## Summary` section)
   - **Submitter name** (default: `Nick Neal`)
   - **Initial status** (default: `draft`)
5. Create `docs/MOPs/MOP-NNNN-<kebab-title>.md` from the template with:
   - Header table filled in (MOP number, title, dates = today, submitter, status)
   - `## Summary` populated with the provided summary
   - All other sections left as template placeholders
6. Append an entry to the registry table in `docs/MOPs/REGISTRY.md` with `Date Submitted = today`, `Date Updated = today`, `Date Completed = —`.
7. Report back: the new file path, the registry entry line, and the next suggested action ("plan the scope of work").

## Do NOT

- Do **not** fill in the `## Scope of Work`, `## Priority`, `## Acceptance Criteria`, or `## Verification` sections — that is the planning step and happens separately.
- Do **not** push migrations or modify the remote database (HARD RULE).
- Do **not** auto-commit unless the user explicitly asks. Leave the working tree dirty so the user can review.
- Do **not** invent a status outside `MOP_STATUS_LIFECYCLE.md`.
