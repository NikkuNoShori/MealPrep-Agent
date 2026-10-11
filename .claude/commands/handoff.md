Write a handoff entry for this session to `docs/handoffs/`.

## When to use

- End of any session where meaningful work happened (code written, decisions made, investigations completed)
- When a session ends mid-task (context limit, user stopping early, work paused)
- When the user says "give me a handoff", "write a handoff", or similar

## Workflow

1. Run `git log --oneline -15` and `git status` to get the verified current state of the repo.
2. Read the most recent existing entry in `docs/handoffs/` (sorted by filename) to understand what was already recorded — so your entry doesn't duplicate it and correctly marks anything now resolved.
3. Determine the filename: `YYYY-MM-DD-short-slug.md` using today's date. If a file with that date already exists, append `-2`, `-3`, etc.
4. Write the entry following the template in `docs/handoffs/README.md`. Sections to always include:
   - **Summary** — one or two sentences on what the session was actually about
   - **What changed (committed)** — verified against `git log`, not from memory
   - **Uncommitted / in-flight** — verified against `git status`; annotate each file with whose work it is and whether it's known-good or unknown
   - **Decisions and reasoning** — non-obvious choices made, with rejected alternatives if relevant
   - **Suggested next steps** — what you'd do next if the session continued
5. Include **Open questions for the user** only if there are genuine blockers that need a human decision.
6. Include **Known issues** only if something is broken, confusing, or deliberately left as-is.
7. Write the file. Do not commit it — leave it in the working tree for the user to review.

## Key rules

- **Verify, don't assume.** Run `git log` and `git status` before writing. Describe what the repo actually shows, not what you intended.
- **Call out staleness.** If the prior entry's open questions are now resolved or its uncommitted work is now committed, say so explicitly.
- Omit sections that are genuinely empty rather than writing "N/A".
- Do not commit the handoff entry. The user commits it.
- Do not push to remote (HARD RULE).
