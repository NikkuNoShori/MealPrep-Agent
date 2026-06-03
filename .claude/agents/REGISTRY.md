# Agent Registry

> **Discovery index** for the Claude Code agent system in this repo. If someone asks "what agents do we have?" or "is there a subagent for X?", this is the file to read first.

**Last reviewed:** 2026-06-03
**Last updated:** 2026-06-03 (initial registry — cataloging 6 subagents, 5 slash commands, 1 knowledge base, 1 run log)

---

## What this registry is

Everything under `.claude/` is part of the Claude Code harness for the MealPrep Agent project. There are four kinds of entries:

| Type | Lives in | Invocation |
|------|----------|------------|
| **Subagent** | `.claude/agents/<name>.md` | Via the Agent tool with `subagent_type: "<name>"`, or by user prompt referencing the role |
| **Slash command (skill)** | `.claude/commands/<name>.md` | Typed by the user as `/<name>` in chat |
| **Knowledge base** | `.claude/agents/<kb-name>/` | Read by a specific subagent; not user-invoked |
| **Run log** | `.claude/agents/agents-log.md` | Append-only; every subagent writes here per its run-log appendix |

This registry tracks all four. Per-agent details live in each agent's own `.md` file — this registry points at them, it does not duplicate them.

---

## Status

| Status | Meaning |
|--------|---------|
| `active` | Defined, ready to invoke, listed in the registry below |
| `proposed` | Drafted but not yet wired up |
| `deprecated` | Replaced by another agent or no longer relevant — kept for history |

---

## Registry

### Subagents (`.claude/agents/`)

| Name | Type | Purpose (one line) | Model | Status | Source |
|------|------|--------------------|-------|--------|--------|
| [cooking-bot-architect](cooking-bot-architect.md) | subagent | Designs and implements in-product AI capabilities (chat-api, recipe-pipeline, prompts, tool schemas) using vetted patterns | opus | active | `.claude/agents/cooking-bot-architect.md` |
| [data-integrity](data-integrity.md) | subagent | Verifies aggregations and RLS visibility against the local test harness; reports numeric divergence, never fixes | opus | active | `.claude/agents/data-integrity.md` |
| [doc-adherence](doc-adherence.md) | subagent | Audits docs/MOPs/ADRs against canonical structure and the documentation update procedure; report-only | opus | active | `.claude/agents/doc-adherence.md` |
| [qa-auditor](qa-auditor.md) | subagent | Audits code changes against architectural rules in `CLAUDE.md` (sealed height chain, api.ts routing, RLS, edge functions); report-only | opus | active | `.claude/agents/qa-auditor.md` |
| [surface-reviewer](surface-reviewer.md) | subagent | Classifies mid-session findings (trivial / ADR / MOP / defer), drafts the artifact, ranks by priority | opus | active | `.claude/agents/surface-reviewer.md` |
| [ui-designer](ui-designer.md) | subagent | Restyles components/pages to the "Warm Editorial" design language (Fraunces + DM Sans, `--rs-*` palette, lift-on-hover cards) | opus | active | `.claude/agents/ui-designer.md` |

### Slash commands (`.claude/commands/`)

| Name | Type | Purpose (one line) | Status | Source |
|------|------|--------------------|--------|--------|
| `/new-adr` | skill | Scaffolds the next-numbered ADR file in `docs/DECISIONS/`; defers content to author | active | `.claude/commands/new-adr.md` |
| `/new-mop` | skill | Scaffolds the next-numbered MOP from the template and appends a registry row | active | `.claude/commands/new-mop.md` |
| `/surface` | skill | Invokes the `surface-reviewer` subagent with current session findings | active | `.claude/commands/surface.md` |
| `/update-docs` | skill | Runs the full `DOCUMENTATION_UPDATE_PROCEDURE.md` after a MOP completes | active | `.claude/commands/update-docs.md` |
| `/update-registry` | skill | Recomputes `docs/MOPs/REGISTRY.md` from MOP file headers to catch drift | active | `.claude/commands/update-registry.md` |

### Knowledge bases (`.claude/agents/<name>/`)

| Name | Type | Purpose (one line) | Status | Source |
|------|------|--------------------|--------|--------|
| [cooking-bot-knowledge](cooking-bot-knowledge/README.md) | knowledge-base | Persistent reference library for `cooking-bot-architect` (patterns, UX, extraction, safety, lessons) | active | `.claude/agents/cooking-bot-knowledge/` |

### Logs (`.claude/agents/`)

| Name | Type | Purpose (one line) | Status | Source |
|------|------|--------------------|--------|--------|
| [agents-log.md](agents-log.md) | log | Append-only record of every subagent invocation (date, agent, scope, findings, changes, requester) | active | `.claude/agents/agents-log.md` |

---

## When to invoke a subagent vs. use a slash command

**Slash commands** are deterministic single-shot scaffolds or procedures. Use them when you know exactly what artifact you want produced (a new MOP file, a registry sync, a doc-update procedure run).

**Subagents** are reasoning workers. Invoke them when the task requires judgment — auditing a diff, designing an AI capability, classifying findings into the right destination. They produce reports + drafts, not just files.

Quick rule of thumb:

| You want… | Use |
|-----------|-----|
| A new MOP file scaffolded | `/new-mop` |
| Findings from a session sorted into MOPs/ADRs/inline fixes | `surface-reviewer` (or `/surface`) |
| To know whether the current branch violates project rules | `qa-auditor` |
| To know whether the docs are stale or contradict the code | `doc-adherence` |
| To verify numeric correctness of an aggregation or RLS isolation | `data-integrity` |
| To restyle a page to the design system | `ui-designer` |
| To add or refactor in-product AI behavior (chat, extraction, prompts) | `cooking-bot-architect` |
| To sync `docs/MOPs/REGISTRY.md` with the MOP files on disk | `/update-registry` |
| To run the doc-update procedure after a MOP completes | `/update-docs` |
| A new ADR scaffolded | `/new-adr` |

---

## Audience distinction: dev-side vs. in-product agents

Five of the six subagents (`data-integrity`, `doc-adherence`, `qa-auditor`, `surface-reviewer`, `ui-designer`) are **dev-side helpers** — they work *on* the MealPrep codebase. Their audience is the developer (Nick).

`cooking-bot-architect` is the **in-product AI designer** — it designs and implements the AI the *end user* talks to inside the shipped MealPrep app (the chat-api edge function, recipe-pipeline prompts, tool schemas the chat agent calls). Its audience is the end user of MealPrep, via the developer.

Both groups happen to run as Claude Code subagents on the same machine, but the artifacts they produce land in different layers of the system. **`cooking-bot-architect` is not a duplicate of any other agent** — it operates on a different layer with a different audience.

---

## Run log convention

Every subagent run — successful, failed, or audit-only — appends one row to [`agents-log.md`](agents-log.md):

```
| YYYY-MM-DD | <agent-name> | <scope> | <findings summary> | <changes: yes/no + files> | <requester> |
```

This is enforced in each subagent's system prompt under a `## Run Log` section. Slash commands do not log here (they are deterministic and short-lived).

---

## How to add a new entry

### New subagent
1. Create `.claude/agents/<name>.md` with the frontmatter block (`name`, `description`, `tools`, `model`) and a system prompt body.
2. Add a row to the **Subagents** table above with link, model, status, and one-line purpose.
3. Include a `## Run Log` section in the agent's prompt body so it writes to `agents-log.md`.
4. Bump `Last updated` on this registry.

### New slash command
1. Create `.claude/commands/<name>.md` with the workflow body (no frontmatter needed for commands).
2. Add a row to the **Slash commands** table above.
3. Bump `Last updated`.

### New knowledge base
1. Create `.claude/agents/<kb-name>/` with a `README.md` navigation map and topic files.
2. Add a row to the **Knowledge bases** table above.
3. Reference the KB from the subagent that reads it (in its system prompt).
4. Bump `Last updated`.

---

## Known gaps + drift (audit 2026-06-03)

- **`security-auditor` ghost references.** Three files reference a `security-auditor` agent that does not exist: `.claude/agents/doc-adherence.md`, `.claude/agents/surface-reviewer.md`, `.claude/commands/surface.md`. The agent is planned as **MOP-0009 Phase 6**. Until it's built, the references read as if it exists. Action: either build the agent or rewrite references to "planned (MOP-0009)".
- **`agents-log.md` has a duplicated header table** (cosmetic). The `## Format` section and `## Entries` section both render an identical header row. Drop one.
- **All six subagents use `model: opus`.** Worth a deliberate policy decision: structured-output agents like `qa-auditor` and the surface-review classifier could run on `sonnet` to save cost. Default opus today because user explicitly asked for it earlier; revisit when usage patterns are clearer.
- **`ui-designer.md` references `src/components/recipes/RecipeCard.tsx` as "needs restyling"** — verify currency periodically as that file evolves.

---

## Forward references

- Each subagent's full definition (description triggers, tools, system prompt, output format) is in its source `.md` file linked above. Do not duplicate that content here.
- The cooking-bot KB's per-file navigation is in [`cooking-bot-knowledge/README.md`](cooking-bot-knowledge/README.md).
- For comparison/style reference, the MOP registry pattern this file follows is [`docs/MOPs/REGISTRY.md`](../../docs/MOPs/REGISTRY.md).
