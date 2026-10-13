# Device Switch: Chat Fix Complete, Deno Now Runnable, 3 MOPs Need a Decision — 2026-10-13

## Summary
User is switching from this laptop to a desktop for a few days. This entry is written specifically so that handoff works cleanly — everything below is committed, pushed is NOT confirmed (user pushes manually), and Deno is now installed **on this laptop only** (desktop will need its own install — see Suggested next steps #1).

## What changed (committed)

All on `main`, local to this laptop as of this session (confirm with the desktop before assuming anything is pushed):

- `7ad00ee` — centralized OpenRouter model config (`_shared/models.ts`); fixed a live chat-with-images outage (deprecated model → `tool_choice:"required"` rejected in thinking mode → 400 error); fixed an unguarded `lastRecipes.length` crash on destructive-tool confirmations.
- `95a8491` — 3 more image-extraction accuracy fixes found via live retesting (dropped range quantities like "4-6 cups", unfolded garnish-line duplicates, container-count-vs-real-measurement bugs like "1 can" losing a stated "10 1/2 oz"); 2 dark-mode UI bugs (`primary-950`/`surface-950` don't exist in this project's custom color scale, capped at 900 — Tailwind silently drops the class).
- `ed96f22` — closed MOP-0032 (QoL Backlog Batch 1), which had been implemented for weeks but never formally verified. Found a genuinely **broken production build** (`RecipeList.tsx` missing imports) plus 3 more real UI bugs hiding behind it. Fixed a long-standing `WeekLabelDropdown` gap (users with only completed/archived plans saw an empty dropdown).
- `a8197b3` — closed out all 5 pre-existing handoff files in `docs/handoffs/` with verified resolution status.
- `d66a1b0` — **installed Deno locally for the first time** and ran all 5 edge-function test files that have never actually executed before (only manually traced). Found and fixed 2 real bugs this uncovered (a broken test import, a test fixture faking a DB shape that a migration removed months ago) plus one stale assertion. 44/44 Deno tests + 265/265 Vitest tests + lint + build all pass as of this commit.

Full detail on all of the above is in `docs/CHANGELOG.md` and the individual commit messages — this entry is deliberately higher-level.

## Uncommitted / in-flight

- `.claude/settings.local.json` — modified, not touched this session's content, just a local permission allowlist the harness appends to automatically (Supabase MCP query approvals). Machine-local, not meant to be committed or carried to the desktop.
- `.mcp.json` — untracked, the Supabase MCP server config added in an earlier session (see `docs/handoffs/2026-10-12-vision-model-deploy-mismatch.md`). **This will need to be re-added on the desktop** if the desktop session wants direct Supabase log/migration access the way this laptop session had it — it's not committed and won't transfer via git. Check that earlier handoff entry for what it contains if you need to recreate it.

Nothing else is uncommitted. `git status` is otherwise clean.

## Decisions and reasoning

See the individual commits and `docs/handoffs/2026-10-13-handoff-catchup-and-model-fixes.md` for the detailed reasoning behind each fix — not repeating it all here since that entry already exists and this one is meant to stay short for a quick device-switch pickup.

**Key thing to know across devices: Deno is now installed on this laptop (`winget install DenoLand.Deno`, confirmed working at `deno 2.9.7`), but almost certainly is NOT installed on the desktop yet.** Every "ran 20/20 Deno tests, all pass" claim in today's commits is only true where Deno exists. If the desktop session tries to verify any of today's work and Deno isn't there, don't trust a manual trace as equivalent — install it first (same command, or via desktop's own package manager).

## Known issues / things that look wrong but aren't (or are)

**Deployment status is genuinely unclear and this entry cannot resolve it — the desktop session needs to ask the user directly.** This laptop session fixed and committed code for `chat-api`, `recipe-pipeline`, and touched nothing else edge-function-side. Per this repo's hard rule, I never ran any `supabase functions deploy` command — the user did, mid-session, after the `7ad00ee` and `95a8491` commits (confirmed working live, pickle-soup extraction tested end-to-end with 18/18 correct ingredients by the end). **Whether `7ad00ee`'s and `95a8491`'s commits are the exact code currently live on Supabase, or whether something was redeployed after `95a8491` but before `ed96f22`/`d66a1b0` (which don't touch edge functions, so it wouldn't matter), is not verified by this entry.** The desktop session should ask: "did you deploy again after our last chat test, and if so, from which commit?"

**Chat and image extraction were both confirmed working live by the user during this session**, with accuracy visibly improving across three successive retests (1 ingredient → 20 ingredients with 2 bugs → 18 ingredients, fully correct). This is a real, user-verified state, not just "tests pass."

## Open questions for the user

These are carried over from `docs/handoffs/2026-10-13-handoff-catchup-and-model-fixes.md`, repeated here because they're the actual next decision points once device-switching is done:

1. **MOP-0036 (Deno tests in CI)** — now that Deno actually works locally and caught 2 real bugs on first use, is this worth prioritizing soon so it runs in CI too, not just ad hoc? This session's Deno install was manual and laptop-only.
2. **MOP-0034 Phase 4** (remove fabricated `servings||4`/`difficulty→"medium"` defaults, add `warnings[]`) — ready to start, or still blocked on the cross-domain null-safety audit its own sequencing rule requires first?
3. **MOP-0029 Phase 9 verification** — wants its own dedicated pass (18 acceptance criteria spanning the whole MOP), not a quick check.
4. **Four new MOPs are sitting at `draft`, no code written, awaiting a priority decision**: MOP-0036 (Deno CI), MOP-0037 (reasoning-panel redesign + recipe delivery ordering), MOP-0038 (recipe notes field + chat-driven draft editing), MOP-0039 (audio as first-class input). None of these have been started — they're scoped and ready whenever picked up.

## Suggested next steps

1. **On the desktop, before anything else:** `git pull` (confirm the laptop's commits actually reached the remote — check with the user whether they pushed), then install Deno (`winget install DenoLand.Deno` on Windows) if the desktop session needs to touch any edge-function code with real test confidence.
2. Ask the user directly which deployment state is actually live on Supabase right now (see "Known issues" above) before assuming anything about production behavior.
3. Pick up one of the 4 open MOPs per the user's priority call, or continue the MOP-0034 Phase 4 / MOP-0029 Phase 9 work once their blockers are resolved.
