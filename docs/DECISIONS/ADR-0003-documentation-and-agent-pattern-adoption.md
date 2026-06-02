# ADR-0003: Adopt Documentation + Agent Pattern Set from External Reference

**Status:** accepted
**Created:** 2026-06-01
**Author:** Nick Neal
**Last reviewed:** 2026-06-01
**Related MOP:** MOP-0009 (Phases 6-7), MOP-0010 (lockticket system enforces the new conventions)

## Context

Before 2026-06-01, MealPrep Agent's documentation infrastructure consisted of:

- A flat `docs/` directory with `ARCHITECTURE.md`, `DATA_MODEL.md`, `API.md`, `RUNBOOK.md`, `CHANGELOG.md`, `README.md`
- A `docs/MOPs/` directory with a `REGISTRY.md`, `MOP_TEMPLATE.md`, and 6 MOPs (MOP-0001 to MOP-0006)
- A single `docs/prompts/DOCUMENTATION_UPDATE_PROCEDURE.md` covering doc update steps (no ADR or MOP-lifecycle docs)
- A 4-status MOP lifecycle (`draft` / `planned` / `completed` / `cancelled`) defined only inline in `REGISTRY.md`
- A `.claude/agents/` directory with 5 subagents (`doc-keeper`, `qa-auditor`, `data-integrity`, `ui-designer`, `cooking-bot-architect`)
- No `.claude/commands/` directory
- No `docs/DECISIONS/` directory
- No mechanism for recording architectural decisions outside MOPs

A review of an external reference project's documentation pattern surfaced several capabilities MealPrep lacked but would benefit from. This ADR captures which patterns were adopted, which were deferred, and which were rejected.

## Decision

**Adopt the following patterns** from the external reference, adapted to MealPrep's stack and conventions:

### Documentation structure

1. **`docs/DECISIONS/` directory** for ADRs (Architecture Decision Records).
   - Naming: `ADR-NNNN-short-kebab-description.md`, sequential
   - No registry — directory IS the index
   - Template + lifecycle defined in `docs/prompts/ADR_AUTHORING_GUIDE.md`

2. **`docs/prompts/ADR_AUTHORING_GUIDE.md`** — authoritative guide on when to write an ADR, the template, the lifecycle (proposed → accepted → superseded → deprecated), and the relationship to MOPs.

3. **`docs/prompts/MOP_STATUS_LIFECYCLE.md`** — formal 10-status lifecycle (`draft` / `evaluation` / `approved` / `planned` / `in_progress` / `verifying` / `complete` / `blocked` / `cancelled` / `deferred`) with a backwards-compatibility policy for the legacy 4-status vocabulary.

4. **Updated `docs/MOPs/MOP_TEMPLATE.md`** — adds `## Scope Map` (file globs) and `## Verification` (lockticket YAML block) sections.

5. **Updated `docs/prompts/DOCUMENTATION_UPDATE_PROCEDURE.md`** — preserved existing 6-entry update log; added references to MOP_STATUS_LIFECYCLE, ADR_AUTHORING_GUIDE, DECISIONS directory, and the `verifying → complete` flow.

### Agent infrastructure

6. **`doc-adherence` subagent** (`.claude/agents/doc-adherence.md`) — supersedes `doc-keeper`. Comprehensive documentation compliance auditor with explicit source-of-truth read list, structured Critical/Warning/Suggestion report format, audit-first interaction protocol, and run-log requirement. Opus model.

7. **`.claude/agents/agents-log.md`** — append-only log of every subagent invocation. All 5 audit/build subagents instructed to append on each run.

8. **Run-log appendix on every subagent** — `cooking-bot-architect`, `qa-auditor`, `data-integrity`, `ui-designer` each updated with explicit run-log format strings.

9. **Standardize all subagents on opus model** — sonnet variants bumped per project preference (no model downgrade for subtasks).

### Slash commands

10. **`.claude/commands/`** directory with four user-invocable skills:
    - `/update-docs` — runs the documentation update procedure after a MOP completes
    - `/new-mop` — scaffolds the next sequential MOP from template, appends registry entry
    - `/new-adr` — scaffolds the next sequential ADR from template
    - `/update-registry` — reconciles `REGISTRY.md` against on-disk MOP headers

### Lifecycle enforcement

11. **Lockticket Verification block** as part of MOP_TEMPLATE.md, formalized in MOP-0010. Existing MOP-0008 already ships with the new format; MOP-0011 was authored with it. Lockticket enforcement (`/verify-mop`) is the gating mechanism for `verifying → complete` transitions.

## Decisions to defer or reject

These external-reference patterns were **explicitly deferred**:

| Pattern | Status | Reason |
|---|---|---|
| `ui-enforcer` agent (design-token compliance) | Deferred | MealPrep has no design-token system to enforce against. Revisit if/when a brand-token pipeline is built |
| `document-refactor-guide.md` | Deferred | No doc restructuring imminent. Revisit when a structure refactor is planned |
| `/create-architecture-domain` skill | Deferred | MealPrep does not yet use `docs/architecture/<domain>/` subfolders. Revisit when domain split is needed |
| `/section-divider`, `/text-hover`, `/trace-brand`, `/trace-pipeline` skills | Rejected | Domain-specific to the reference project's design system / data pipeline. No MealPrep analog |
| `SINGLE_CONTEXT_RPC_HYGIENE_CHECK.md` | Rejected | Reference-project-specific RPC pattern. MealPrep's "edge functions only" rule (CLAUDE.md) covers the equivalent concern |
| Pre-commit hook for HARD RULE | Adopted, not in this ADR | Already in scope under MOP-0009 Phase 2 |
| `security-auditor` agent | Adopted, not in this ADR | Added to MOP-0009 Phase 6 |
| `architecture-guard.md` prompt doc | Adopted, not in this ADR | Added to MOP-0009 Phase 7 |

## Consequences

### Positive

- **Decisions become recordable.** Before this, architectural choices either lived inline in MOP `Notes` sections (rare) or in commit messages (transient). ADRs give them a permanent home.
- **MOP status semantics are precise.** The 10-status lifecycle distinguishes `evaluation` (investigating) from `approved` (green-lit but unscheduled) from `planned` (sprint-assigned) from `verifying` (lockticket gate). Reduces ambiguity in status checks.
- **Drift detection has a home.** `doc-adherence` runs a structured audit; `/update-registry` and `/verify-mop` enforce specific drift classes mechanically.
- **Slash commands lower the cost of doing the right thing.** `/new-mop` and `/new-adr` make scaffolding cheap; `/update-docs` codifies the post-MOP-completion flow.
- **Run log creates institutional memory.** Every agent invocation is logged, surfacing patterns over time.

### Negative

- **More docs to maintain.** Three new prompt docs (`ADR_AUTHORING_GUIDE`, `MOP_STATUS_LIFECYCLE`, plus the refined `DOCUMENTATION_UPDATE_PROCEDURE`) must stay current as conventions evolve.
- **Backwards-compatibility burden.** Existing MOPs (0001-0011 as of adoption) use the legacy 4-status vocabulary. They migrate on next touch — a low-effort but multi-touchpoint cleanup.
- **Lockticket Verification blocks add authoring friction.** Every new MOP must include a machine-checkable verification block. Higher up-front cost than markdown checkboxes, justified by MOP-0010's enforcement value.
- **Adoption is not zero-cost for the user.** Slash commands require user habituation. `/new-mop` vs. "copy the template by hand" is a small but real workflow change.
- **Session restart needed** to register new subagents (one-time friction).

## Alternatives considered

1. **Adopt nothing — leave docs as-is.** Rejected. The doc-keeper agent's drift detection was working but the lack of ADRs meant decisions like ADR-0001 (`meal_plans` JSONB) and ADR-0002 (`server.js` retention) had no home. MOP-only documentation is wrong for capturing rationale.
2. **Adopt the full external pattern verbatim.** Rejected. Several patterns (ui-enforcer, document-refactor-guide, RPC hygiene check) are not applicable to MealPrep. Adopting them would have meant maintaining empty or misleading scaffolding.
3. **Build a custom convention from scratch.** Rejected. The external reference is mature, battle-tested, and structurally similar to what MealPrep needed. Adapting it was significantly faster than starting fresh, and the conventions are recognizable to anyone with prior exposure to the reference project.

## Trigger for revisit

- **`ui-enforcer` is needed** if/when a design-token system is introduced (e.g., a `--brand-*` CSS variable set).
- **`/create-architecture-domain`** is needed if/when `docs/architecture/<domain>/` subfolders become a convention (likely tied to MealPrep growing past ~6 major subsystems).
- **`document-refactor-guide.md`** is needed before any large doc restructure.
- If the slash commands and `doc-adherence` agent prove too heavyweight in practice (e.g., friction outweighs drift-prevention value), revisit the simpler "doc-keeper + flat MOP statuses" pattern.

## Related

- **MOPs:** MOP-0009 (Phases 6-7 adopt security-auditor + architecture-guard), MOP-0010 (lockticket Verification mechanism that enforces this ADR's new template)
- **ADRs:** ADR-0001 (meal_plans JSONB — first ADR authored under the new convention), ADR-0002 (server.js retention — second)
- **Key files created/modified during adoption (2026-06-01):**
  - Created: `.claude/agents/doc-adherence.md`, `.claude/agents/agents-log.md`, `.claude/commands/{update-docs,new-mop,new-adr,update-registry}.md`, `docs/prompts/{ADR_AUTHORING_GUIDE,MOP_STATUS_LIFECYCLE}.md`, `docs/DECISIONS/README.md`, `docs/DECISIONS/ADR-0001-meal-plans-jsonb-shape.md`, `docs/DECISIONS/ADR-0002-legacy-express-dev-server.md`
  - Deleted: `.claude/agents/doc-keeper.md` (superseded)
  - Modified: `docs/MOPs/MOP_TEMPLATE.md`, `docs/MOPs/REGISTRY.md`, `docs/prompts/DOCUMENTATION_UPDATE_PROCEDURE.md`, `.claude/agents/{cooking-bot-architect,qa-auditor,data-integrity,ui-designer}.md` (opus model + run-log)
