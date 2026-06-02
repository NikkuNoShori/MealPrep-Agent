Scaffold a new ADR (Architecture Decision Record).

## Instructions

Single-shot procedure. Defer to `docs/prompts/ADR_AUTHORING_GUIDE.md` for what each section means and how to write it well — this skill only handles scaffolding.

## Workflow

1. List `docs/DECISIONS/` and determine the next sequential ADR number (highest existing `ADR-NNNN-*.md` + 1, zero-padded to 4 digits, e.g. `ADR-0003`). If the directory is empty, start at `ADR-0001`.
2. Read `docs/prompts/ADR_AUTHORING_GUIDE.md` — it contains the canonical ADR template and section guidance.
3. Prompt the user for:
   - **Title** (short kebab description, e.g. `use-pgvector-for-rag`)
   - **Status** (default: `proposed`)
   - **Related MOP** (optional, e.g. `MOP-0008` — leave blank if none)
4. Create `docs/DECISIONS/ADR-NNNN-<kebab-title>.md` from the template defined in the authoring guide, with:
   - **Created** = today
   - **Last reviewed** = today
   - **Author** = `Nick Neal`
   - **Status** = provided value
   - **Related MOP** = provided value or `—`
5. Report back the new file path and a one-line reminder to fill in Context / Decision / Consequences.

## Do NOT

- Do **not** invent content for Context, Decision, or Consequences — those are the author's job.
- Do **not** add an ADR registry entry. ADRs are listed by directory glob, not a registry. See `/update-registry` for why.
- Do **not** auto-commit. Leave the file uncommitted so the user can iterate.
- Do **not** push migrations or modify the remote database (HARD RULE).
