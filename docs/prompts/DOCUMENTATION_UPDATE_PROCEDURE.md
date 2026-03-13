# Documentation Update Procedure

**Purpose:** Self-contained instructions for performing a canonical documentation update after code changes are merged. This document contains all context needed — point an AI assistant here and say "follow these instructions" to execute a full documentation audit and update.

**Last updated:** 2026-03-10

### Key references
- **Architecture docs:** `docs/Architecture/` — detailed design documents (PRD, SDD, RAG design)
- **Development docs:** `docs/Development/` — setup guides, edge function docs, local dev
- **Feature docs:** `docs/Features/` — feature-specific implementation details

---

## Step 0: Identify the requester

Before starting any documentation work, ask the user:

> "Who is requesting this documentation update? Please provide your name or identifier so I can record it in the update log."

Record the response. You will use this identity in:
- The `Updated by` field in the update log entry (Step 7)
- Commit messages (if committing)

---

## Step 1: Determine scope

Ask the user or determine from context:

1. **Which branches/PRs were merged since the last doc update?**
   - Run: `git log main --merges --oneline -10` to see recent merges
   - Compare the most recent merge date against the `Last reviewed` dates in the canonical docs
   - Any merge newer than the oldest `Last reviewed` date is in scope

2. **What changed in each branch?**
   - For each in-scope branch: `git diff main~N..BRANCH_NAME --stat` (where N is the merge position)
   - **If the branch was deleted or squash-merged**, use the merge commit instead:
     - `git log --oneline main~N..main` to identify merge commits
     - `git diff <merge-commit>^...<merge-commit> --stat` to see what changed in that merge
   - Pay special attention to changes in:
     - `supabase/migrations/` (new tables, columns, RPCs, triggers)
     - `supabase/functions/` (new or modified edge functions)
     - `src/services/` (new or modified service modules)
     - `src/lib/` (OpenRouter client, utilities)
     - `src/components/` (new UI components or major changes)
     - `src/contexts/`, `src/stores/` (state management changes)
     - `src/prompts/` (AI prompt changes)
     - `src/pages/` (new pages or route changes)
     - `docs/` (new or updated documentation)

3. **What features were added or changed?**
   - Check `docs/Features/` for new or modified feature docs
   - Check git commit messages for feature descriptions

---

## Step 2: Canonical document inventory

These are the documents that must be checked and potentially updated. Each has a specific responsibility:

| Document | Path | Responsibility | Update when... |
|----------|------|----------------|----------------|
| **ARCHITECTURE.md** | `docs/ARCHITECTURE.md` | System boundaries, data flow, auth, AI pipeline, patterns | New subsystems, auth changes, data flow changes, new architectural patterns, AI model changes |
| **DATA_MODEL.md** | `docs/DATA_MODEL.md` | Tables, columns, invariants, relationships, RLS policies | New tables, new columns, new constraints, RLS changes, new triggers |
| **API.md** | `docs/API.md` | Edge functions, RPC contracts, OpenRouter endpoints, request/response shapes | New RPCs, new edge function endpoints, modified auth, new API parameters |
| **RUNBOOK.md** | `docs/RUNBOOK.md` | Operational debugging checklists | New failure modes, new troubleshooting scenarios, new verification SQL queries |
| **CHANGELOG.md** | `docs/CHANGELOG.md` | User-visible changes by date | Every merge to main (always) |
| **Docs README** | `docs/README.md` | Doc index + navigation | New canonical docs added, structural changes |

### MOP Registry (always review):

| Document | Path | Update when... |
|----------|------|----------------|
| **MOP Registry** | `docs/MOPs/REGISTRY.md` | Any code change completes or advances a MOP phase |

Review all `planned` MOPs in the registry. If the merged code completes any phase or acceptance criterion, update that MOP's status, `Date Updated`, and check off the relevant criteria. If a MOP is fully complete, set status to `completed` and fill in `Date Completed`.

### Secondary documents (update if directly impacted):

| Document | Path | Update when... |
|----------|------|----------------|
| **PRD** | `docs/Architecture/PRD.md` | Major product requirement changes |
| **SDD** | `docs/Architecture/SDD.md` | System design changes |
| **RAG Architecture** | `docs/Architecture/RAG_ARCHITECTURE_DESIGN.md` | Changes to RAG pipeline, embedding models, search strategy |
| **Chat Workflow** | `docs/Architecture/CHAT_WORKFLOW_ANALYSIS.md` | Changes to chat flow, intent routing |
| **Chat DB Schema** | `docs/Architecture/CHAT_DATABASE_SCHEMA.md` | Chat table changes |
| **Local Development** | `docs/Development/LOCAL_DEVELOPMENT.md` | New prerequisites, setup steps, env vars |
| **Edge Function README** | `docs/Development/EDGE_FUNCTION_README.md` | New or modified edge functions |
| **Feature docs** | `docs/Features/` | Changes to specific features |

---

## Step 3: Read each canonical doc

For every document in the inventory:

1. Read the file
2. Note the `Last reviewed` and `Last updated` dates
3. Compare against the changes identified in Step 1
4. Flag sections that are:
   - **Missing**: The change introduced something not mentioned at all
   - **Stale**: The doc describes behavior that was changed
   - **Incomplete**: The doc mentions the area but doesn't cover the new aspects

---

## Step 4: Apply updates

For each flagged document, make targeted edits:

### Header updates (always):
- Update `Last reviewed` to today's date
- Update `Version` to the current year-month (e.g., `2026-03`). If the doc doesn't have a `Version` header, skip this — don't add one.
- Update `Last updated` with a brief parenthetical describing what changed

### Content rules:
- **Match the existing style** of each document. Don't introduce new formatting patterns.
- **Be concise**. The canonical docs are meant to be scannable reference material, not tutorials.
- **Link to secondary docs** (Architecture/, Development/, Features/) for detailed rationale rather than duplicating it.
- **Include implementation references** (file paths, migration names) so developers can find the code.
- **Include SQL verification queries** in RUNBOOK entries so operators can diagnose issues.
- **Don't remove or rewrite existing content** unless it's factually wrong. Add new sections instead.

### When to create new docs:
If a change introduces an entirely new subsystem that doesn't fit cleanly into an existing canonical doc, create a new document:
- Place it under the appropriate `docs/Architecture/` or `docs/Features/` directory
- Add it to the inventory table in Step 2 of this procedure
- Add it to `docs/README.md` so it's discoverable
- Follow the same header format (`Last reviewed`, `Last updated`) as existing canonical docs

### CHANGELOG rules:
- Group by date and PR/branch name
- Format: `## YYYY-MM-DD (Short description) — PR #N \`branch-name\``
- Use bullet points for individual changes
- Keep entries concise (1-2 sentences per bullet)
- Place newest entries at the top (below the header)

### RUNBOOK rules:
- Each entry follows the template:
  ```
  ## Problem title

  ### Symptom
  - What the user/operator observes

  ### Likely causes
  - Bullet list of probable root causes

  ### Verification steps
  - SQL queries or commands to diagnose

  ### Fix steps
  - How to resolve

  **Added:** YYYY-MM-DD
  ```

---

## Step 5: Verify consistency

After all edits, verify:

1. **Cross-references are valid**: If ARCHITECTURE.md references a section in DATA_MODEL.md, confirm the section exists
2. **No contradictions**: If a behavior is described in multiple docs, ensure they agree
3. **Migration names are correct**: Any referenced migration file name should match an actual file in `supabase/migrations/`
4. **Component paths are correct**: Any referenced source file should exist at the stated path
5. **Edge function paths are correct**: Any referenced function should exist in `supabase/functions/`

### Commit strategy:
- Commit documentation updates in a **dedicated commit** (separate from code changes) so they can be reverted independently if an error is found.
- If a doc update introduces an incorrect cross-reference or factual error, revert the doc commit rather than patching forward.

---

## Step 6: Summary diff

Before finishing, provide the user with a summary of all changes made:

```
## Documentation Update Summary

**Requested by:** [requester identity from Step 0]
**Date:** YYYY-MM-DD
**Scope:** [branches/PRs covered]

### Documents updated:
- `docs/ARCHITECTURE.md` — [what was added/changed]
- `docs/DATA_MODEL.md` — [what was added/changed]
- ... (for each modified file)

### Documents reviewed (no changes needed):
- `docs/Architecture/PRD.md` — [reason no change needed]
- ... (for each reviewed-but-unchanged file)

### New entries:
- CHANGELOG: [N] new entries added
- RUNBOOK: [N] new troubleshooting entries added
```

---

## Step 7: Update the update log

Append to the update log at the bottom of this document:

```
| Date | Requester | Branches covered | Docs modified |
|------|-----------|------------------|---------------|
| YYYY-MM-DD | [name] | branch1, branch2 | ARCHITECTURE, DATA_MODEL, ... |
```

---

## Checklist (quick reference)

- [ ] Identified requester
- [ ] Identified in-scope branches/PRs
- [ ] Read each canonical doc, noted `Last reviewed` dates
- [ ] Flagged missing/stale/incomplete sections
- [ ] Updated ARCHITECTURE.md (if applicable)
- [ ] Updated DATA_MODEL.md (if applicable)
- [ ] Updated API.md (if applicable)
- [ ] Updated RUNBOOK.md (if applicable)
- [ ] Updated CHANGELOG.md (always)
- [ ] Reviewed MOP Registry — updated any MOPs advanced by this change
- [ ] Updated secondary docs (if applicable)
- [ ] Verified cross-references and file paths
- [ ] Provided summary to user
- [ ] Appended to update log

---

## Update Log

> **Note:** If this log grows beyond ~20 entries, consider migrating it to a separate `docs/prompts/update_log.md` file and linking to it from here, to keep this procedure doc focused on instructions.

| Date | Requester | Branches covered | Docs modified |
|------|-----------|------------------|---------------|
| 2026-03-10 | Nick Neal | (initial creation — retroactive audit of all branches through feature/next-improvements) | ARCHITECTURE, DATA_MODEL, API, RUNBOOK, CHANGELOG, docs/README |
| 2026-03-11 | Nick Neal | feature/next-improvements (UI overhaul, layout fixes, recipe service migration) | ARCHITECTURE, API, RUNBOOK, CHANGELOG |
| 2026-03-12 | Nick Neal | enhancement/chat (MOP-0002 P0: households, visibility, RLS) | ARCHITECTURE, DATA_MODEL, API, RUNBOOK, CHANGELOG, docs/README |
| 2026-03-12 | Nick Neal | enhancement/chat (MOP-0002 P1/P2: collections, invite UI, recipe page) | DATA_MODEL, API, CHANGELOG, docs/README, MOP-0002, REGISTRY |
| 2026-03-12 | Nick Neal | enhancement/chat (migration 013: deprecation cleanup, collections UI polish) | ARCHITECTURE, DATA_MODEL, API, RUNBOOK, CHANGELOG, MOP-0002, REGISTRY |
