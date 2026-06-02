# Architecture Decision Records

This directory contains ADRs (Architecture Decision Records) — short documents capturing the reasoning behind significant architectural or design decisions in MealPrep Agent.

## How to write one

See [docs/prompts/ADR_AUTHORING_GUIDE.md](../prompts/ADR_AUTHORING_GUIDE.md) for the full guide, including:
- When to write an ADR (vs. when not to)
- File naming convention (`ADR-NNNN-short-kebab-description.md`)
- Template
- Lifecycle (proposed → accepted → superseded / deprecated)
- Relationship to MOPs

## How to create one quickly

Use the `/new-adr` slash command. It scaffolds the next sequential file with header fields pre-populated.

## Convention

- Sequential numbering — increment from the highest existing `ADR-NNNN` file. No gaps.
- ADRs are enumerated by directory listing — there is **no** registry file (intentional; the directory IS the registry).
- ADRs are immutable once `accepted` — to revise a decision, write a new ADR that supersedes it.

## Current ADRs

(See the directory listing. This README does not maintain a manual list — `git ls-files docs/DECISIONS/ADR-*.md | sort` is the source of truth.)
