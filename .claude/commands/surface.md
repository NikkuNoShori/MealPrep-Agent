Invoke the `surface-reviewer` subagent to classify findings, draft any warranted MOP/ADR, and present a priority recommendation.

## When to use

This skill is the user-facing path for surface review. Invoke when:
- The assistant has surfaced findings during a session (bugs, drift, decisions, audit warnings) and you want them classified + recorded
- An auditor run (`qa-auditor`, `doc-adherence`, `security-auditor`, `data-integrity`) returned findings that need disposition
- You want a fresh review of "what should I do with all these things I noticed?"

The assistant should also invoke the surface-reviewer **automatically** when its own output uses phrases like "worth surfacing", "worth recording", "should flag", "deserves attention" — per the rule in `CLAUDE.md`.

## Workflow

1. Gather the findings to review — either from this session's chat or from a specific source (audit report, recent commit, etc.).
2. Invoke the `surface-reviewer` subagent via the Agent tool with `subagent_type: "surface-reviewer"` (after session restart registers it) or via `general-purpose` with role-load instructions referencing `.claude/agents/surface-reviewer.md` (pre-restart fallback).
3. Pass the findings as context. Include any session-specific signal: current MOP being worked on, deadline, recent changes.
4. The agent will:
   - Inventory existing MOPs + ADRs to avoid duplication
   - Classify each finding (trivial-fix / ADR / MOP / MOP+ADR / already-covered / defer-with-trigger)
   - Assign priority (P0–P3 or defer) with specific rationale
   - Draft any warranted MOP/ADR files
   - Present a priority-ranked recommendation
5. Review the agent's output. Accept drafts, request revisions, or override classifications.
6. The agent does NOT auto-commit. Working tree stays dirty so you can review.

## Key rules

- The agent draft is a starting point. You hold final say on priority and scope.
- The agent will not push migrations or modify the remote database (HARD RULE).
- The agent respects existing MOP backlog priorities — it does not insert ahead of existing P0 without justification.
- For security findings, the agent defaults to P0/P1 with specific risk language. Be skeptical of any security finding marked P2+ without strong rationale.
- The agent appends a run-log entry to `.claude/agents/agents-log.md` after every invocation.
