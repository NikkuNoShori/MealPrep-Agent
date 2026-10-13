# Vision/agent model deploy mismatch + Supabase MCP setup — 2026-10-12

## Summary
Investigated a live chat-with-images 404 ("Qwen3 8B was deprecated on Oct 9,
2026"). Root cause: the **deployed** `chat-api` edge function is running an
older build than what's committed on `main` — the error trace shows it still
trying `qwen/qwen3-8b`, a model/fallback string that was removed from
`agent-loop.ts` in an earlier, already-committed change (replaced with
`qwen/qwen3.7-plus`). The user redeployed "all functions" but the log capture
still showed the old model string, so either the deploy didn't actually
include `chat-api`, ran against stale cached code, or predated the log
capture. **Not resolved — needs re-verification after an explicit `chat-api`
redeploy.** Session ended with the user adding a Supabase MCP server so a
future session can check deploy state directly instead of relying on pasted
console/log output.

## What changed (committed)
Nothing from this session is committed. One unrelated hand-edit by the user
from a prior session (reverted, then left as a 1-line diff — see below) is
still uncommitted.

## Uncommitted / in-flight
Current `git status` (verified just now):
- `supabase/functions/chat-api/agent-loop.ts` — modified. Diff is exactly one
  line: removes `"qwen/qwen3-14b"` from `DEFAULT_AGENT_MODEL_FALLBACKS`. This
  is a leftover from the user's own hand-edit attempt (see Known Issues) —
  harmless, not yet decided whether to keep or revert, **not the cause of the
  live 404** (see below).
- `.claude/settings.local.json` — modified. Adds `"disabledMcpjsonServers":
  ["supabase"]`. **This disables the Supabase MCP server the user just added**
  (see next item) — see "Open questions" below, this likely needs to be
  removed, not just restarting the session.
- `.mcp.json` — untracked (new). Adds a `supabase` MCP server entry (HTTP,
  `https://mcp.supabase.com/mcp?project_ref=tiibvcgnxnpgvygmqzvu&...`). Added
  by the user this session, specifically so a future session can inspect
  Supabase deploy state/function logs/project config directly instead of the
  user manually pasting console logs and Supabase log-explorer JSON, which is
  how this session's diagnosis had to happen.

Two files that were modified earlier in this session (`openrouter-client.ts`,
`extract.ts` — vision model slug) are **no longer modified**; their working-tree
content now matches HEAD. See "Decisions and reasoning" for why.

## Decisions and reasoning

**Vision model slug (`qwen/qwen3-vl-8b-instruct`) is correct and should NOT be
changed.** The user hand-edited `openrouter-client.ts`'s `chatWithImages`
default and `extract.ts`'s `VISION_MODELS[0]` from `qwen/qwen3-vl-8b-instruct`
to `qwen/qwen3.7-plus` after a console error said "Qwen3 8B was deprecated...
migrate to Qwen3.7 Plus." This was a reasonable but incorrect fix:
`qwen/qwen3.7-plus` is **text-only** (confirmed via OpenRouter's live
`/api/v1/models`), it cannot process images, so swapping it into a
vision-only call site would have silently broken image extraction. Also
confirmed via OpenRouter's `/api/v1/models/qwen/qwen3-vl-8b-instruct/endpoints`
that the VL model has an active Parasail endpoint, status 0, 100% uptime
(30m/5m/1d) — it is not retired. Reverted both files back to
`qwen/qwen3-vl-8b-instruct`; working tree now matches HEAD exactly (no diff).

**The real deprecated model is `qwen/qwen3-8b` (bare, text-only, no "vl"),
used by the *agent loop's tool-calling path*, not the vision extraction
path.** Confirmed via Supabase function logs the user pasted: the failing
call was `chatWithTools` (agent loop deciding which tool to call), logged as
`"Agent loop trying model: qwen/qwen3-8b"` immediately before the 404. Git
history (`git log --all -p -- supabase/functions/chat-api/agent-loop.ts`)
shows `AGENT_MODEL` went `qwen-2.5-7b-instruct` → `qwen/qwen3-8b` (commit
`0386af7`) → `qwen/qwen3.7-plus` (merge commit `41ca287`, already on `main`/HEAD).
So OpenRouter's deprecation notice was accurate — `qwen3-8b` really was
retired Oct 9, 2026 — and the codebase already has the fix committed. The
problem is purely that the **deployed** function hasn't caught up to HEAD.

> **Correction (2026-10-12, surface-reviewer):** This entry originally said
> the switch landed in `b813d00`. That is wrong: `git show b813d00:supabase/functions/chat-api/agent-loop.ts`
> still has `qwen/qwen3-8b` at lines 26 and 33. The `qwen3.7-plus` string
> first appears in merge commit `41ca287` (2026-10-11), and **neither of its
> parents** (`286c34e`, `5225e04`) contains it. The change was made during
> merge conflict resolution (an "evil merge"), so it has no commit message of
> its own. A rebase, a re-done merge, or a cherry-pick of either parent would
> silently drop it and bring back the retired model. The fix: commit the
> current working tree's `_shared/models.ts` centralization as an ordinary
> commit. That puts the slug in a normal, attributable commit and ends the
> fragility.

**Did not attempt to redeploy anything.** Per [[feedback_no_migrations]] (hard
rule: never push/deploy; user handles all deployments), this session only
diagnosed and edited local files, never ran a deploy command. The user ran
their own redeploy mid-session and the symptom persisted — see Known Issues.

## Known issues / things that look wrong but aren't (or are)

**User redeployed "all functions" but the post-redeploy log still shows the
old `qwen/qwen3-8b` string, which doesn't exist anywhere in HEAD's
`agent-loop.ts`.** This is a genuine unresolved contradiction, not yet
explained. Possible causes, untested:
1. The deploy command didn't actually include `chat-api` (scoped to fewer
   functions than intended).
2. The deploy ran from a different working directory / stale local checkout
   that didn't have the `qwen3.7-plus` commit.
3. The pasted log predates the redeploy (timestamp ordering wasn't checked
   against the deploy's own completion time).
4. Supabase-side caching/slow propagation (considered unlikely for Edge
   Functions, not ruled out).
This was the open question blocking progress when the user decided to add
Supabase MCP access instead of continuing to diagnose via pasted logs.

**The Supabase MCP server was just added but is explicitly disabled in
`.claude/settings.local.json`** (`disabledMcpjsonServers: ["supabase"]`).
Restarting the session alone will NOT give the next session Supabase tool
access unless this disabled-list entry is also removed. This is the single
most important thing for the next session to check first.

**`.env` / `.env.local` contain plaintext OpenRouter API keys**
(`OPENROUTER_API_KEY_QWEN2.5_VL_8b`, `OPENROUTER_API_KEY_QWEN2.5_instruct_8b`).
Surfaced incidentally while grepping for env model overrides — these files
are (presumably) gitignored and were not committed or modified this session,
just noting their presence was confirmed on disk in case it's relevant to
[[feedback_no_secrets_in_migrations]]-adjacent hygiene. Not investigated
further; no action taken.

## Open questions for the user

1. **Was `chat-api` actually included in the redeploy, and did it complete
   successfully?** This is the blocking question — needs either a fresh
   Supabase-MCP-backed check of the function's last-deployed timestamp/build
   log, or the user re-running `supabase functions deploy chat-api`
   explicitly (not a bundled "deploy all") and retesting immediately after.
2. **Should `.claude/settings.local.json`'s `disabledMcpjsonServers` entry for
   `supabase` be removed?** It was added in this session's working-tree diff
   but not explained — possibly a leftover from an earlier, cautious default
   before the user decided to actually use it. Needs the user's confirmation
   before removing, per this repo's "confirm before touching other sessions'
   /unexplained state" norm.
3. **Keep or revert the one-line `agent-loop.ts` diff** (removing
   `qwen/qwen3-14b` from the fallback list)? Harmless either way, not yet
   decided, not related to the active bug.

## Suggested next steps

1. **For the very next session, before anything else:** open
   `.claude/settings.local.json`, remove `"supabase"` from
   `disabledMcpjsonServers` (or remove the key entirely if it's the only
   entry) — otherwise the newly-added `.mcp.json` Supabase server will stay
   dark even after restart.
2. Restart Claude Code (`claude --resume` / `claude -c` from this project
   directory) so the Supabase MCP server actually loads.
3. Once Supabase tools are available, check `chat-api`'s last-deployed
   timestamp/build status directly — confirm whether it's actually running
   the `qwen3.7-plus` build (merge commit `41ca287` or later; see the correction note above) or still stale.
4. If still stale, have the user run `supabase functions deploy chat-api`
   explicitly (scoped, not "all") and verify via the MCP tools that the new
   deployment registers, then retest the chat-with-2-images flow and confirm
   no more `qwen/qwen3-8b` references appear in the logs.
5. Resolve the two small open items above (`agent-loop.ts` 1-line diff,
   `disabledMcpjsonServers` entry) once their origin/intent is confirmed with
   the user.
