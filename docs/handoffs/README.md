# Handoffs

A running log of session-to-session context for this project. Each file in
this folder is one handoff: a snapshot of what changed, what's still
unresolved, and what the next session needs to know before touching the
code. Entries are read in order (oldest first) to reconstruct how the
project got to its current state — think of it as a changelog that also
captures *why*, what's still in flight, and what to watch out for, not just
what shipped.

## Why this exists

This project is sometimes worked on by multiple agent sessions in parallel
or in sequence, days or weeks apart. Git history records *what* changed;
it doesn't record *why a change was paused mid-way*, *what another
concurrent session was doing at the same time*, or *what's still sitting
uncommitted on disk*. A handoff entry fills that gap.

## For a new session starting here

1. Read this README.
2. List files in this folder (sorted by filename — they're dated, so
   sorted order is chronological) and read the **most recent 1–2 entries**
   in full. Older entries are historical record; skim them only if you
   need deeper context on a specific past decision.
3. Cross-check the latest entry's "Uncommitted / in-flight" and "Open
   questions" sections against the actual current state (`git status`,
   `git log`) before assuming anything in that entry is still accurate —
   time has passed and the repo may have moved on. If something in the
   entry is now stale (committed, resolved, reverted), say so when you
   write your own entry rather than silently inheriting it.
4. If you make a meaningful change, especially one left unresolved,
   ended by running out of context, or that the user explicitly asks you
   to hand off, add a new entry before ending the session. See the
   template below.

## For the user

- If you say "give me a handoff" or similar, that means: write a new
  entry in this folder summarizing the current session, following the
  template below.
- If you say "catch me up" or start a new session days/weeks later,
  that means: read the latest 1–2 entries here and report back a summary
  — don't just read git log, since the *why* lives here, not there.

## Keeping this canonical

This folder is a source of truth only as long as it stays accurate.
When writing an entry:

- **Verify, don't assume.** Run `git log`, `git status`, and read the
  actual files before describing their state. Don't describe what you
  *intended* to do — describe what the repo actually shows.
- **Call out staleness in prior entries.** If a past entry's "open
  question" was answered or its "uncommitted work" was committed (or
  lost, or superseded), say so explicitly in your new entry rather than
  leaving the record ambiguous about which parts are current.
- **Cross-reference the other docs.** If your session's work should have
  updated `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/API.md`,
  `docs/RUNBOOK.md`, or `CHANGELOG.md` per `CLAUDE.md`'s rules and
  didn't, say so in your entry (and do it, if you can) instead of letting
  the gap go unrecorded.
- **Prefer links over duplication.** If `docs/CHANGELOG.md` already
  documents a change in detail, link to that entry instead of
  re-describing it here — a handoff should add context the changelog
  doesn't have (session continuity, in-flight state, decisions and their
  reasoning), not duplicate it.

## Filename convention

`YYYY-MM-DD-short-slug.md`, e.g. `2026-10-11-mop-0032-complete.md`.
If multiple entries land on the same date, append `-2`, `-3`, etc. to the
slug.

## Entry template

Copy this into a new file. Omit a section if it's genuinely empty rather
than writing "N/A" — but check twice before omitting "Uncommitted /
in-flight" or "Open questions", since those are the sections most likely
to matter to whoever reads this next.

```markdown
# <Short title> — <YYYY-MM-DD>

## Summary
One or two sentences: what was this session actually about.

## What changed (committed)
Bullet list of commits/features landed, each with the commit hash short
form and a one-line description. Link to docs/CHANGELOG.md instead of
repeating detail that's already documented there.

## Uncommitted / in-flight
Exact current `git status` picture, annotated: which files are whose
work (if multiple sessions/agents were concurrent), whether each change
is verified-working or unknown, and why it wasn't committed yet.

## Decisions and reasoning
Anything non-obvious that was decided and why — especially choices a
future session might otherwise second-guess or redo. Include rejected
alternatives if the reasoning for rejecting them isn't obvious.

## Known issues / things that look wrong but aren't (or are)
Anything discovered that's broken, confusing, or deliberately left
as-is, with enough context that a future session doesn't waste time
re-diagnosing it from scratch.

## Open questions for the user
Anything that genuinely needs a human decision before the next session
can proceed confidently.

## Suggested next steps
What you'd do next if the session continued.
```
