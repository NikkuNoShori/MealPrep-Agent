# MOP-0015: Embedding Refresh Lifecycle

| Field | Value |
|-------|-------|
| **MOP** | MOP-0015 |
| **Title** | Embedding Refresh Lifecycle — fix stale embeddings from edited recipes |
| **Date Submitted** | 2026-06-04 |
| **Date Updated** | 2026-06-04 |
| **Date Completed** | — |
| **Submitted By** | Nick Neal (via `chat-rag-sme` audit surfacing during KB build) |
| **Status** | draft |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md).

---

## Summary

The `update_recipe_embedding` trigger (migration 004:68-85) sets `recipes.embedding_vector := NULL` whenever title, description, ingredients, instructions, or tags change. **Nothing in the repo regenerates the embedding after that NULL.** Result: every recipe a user has ever edited currently has a null embedding vector and is **invisible to semantic search** (the `WHERE r.embedding_vector IS NOT NULL` filter in the wired RPCs excludes it).

This silently degrades every RAG surface — chat agent search, save-time duplicate check, and the proposed similar-recipes rail (MOP-0007 Phase 2). The longer a user uses the app, the worse it gets. The pathology was surfaced during the chat-rag-sme KB build pass (2026-06-04) and is documented in [docs/RAG_AUDIT.md](../RAG_AUDIT.md) §Critical Finding.

This MOP fixes it with a trigger change + an async re-embed job.

---

## Architectural Background

- **Source:** [docs/RAG_AUDIT.md](../RAG_AUDIT.md) §Critical Finding, [.claude/agents/chat-rag-sme-knowledge/rag-pipeline.md](../../.claude/agents/chat-rag-sme-knowledge/rag-pipeline.md)
- **Affected RPCs:** `search_recipes_semantic`, `find_similar_recipes` (both filter on `embedding_vector IS NOT NULL`)
- **Affected surfaces:** chat agent's `search_recipes` tool (live), recipe save flow `checkSimilarRecipes` (live), MOP-0007 Phase 2 similar-recipes rail (proposed)
- **Not affected:** `search_recipes_text`, `search_recipes_by_ingredients`, `get_recipe_recommendations` — these are text/scoring RPCs that don't read `embedding_vector`
- **`[verify]` external workers:** the audit found no in-repo backfill. Confirm with Nick whether a Supabase Dashboard scheduled function, n8n workflow, or external cron handles regeneration outside the repo. If yes, this MOP is `cancelled` — pipeline is healthy. If no, proceed.

---

## Scope Map

```
supabase/migrations/<NNN>_embedding_refresh_lifecycle.sql   (new, local-only)
supabase/functions/embedding-refresh/                       (new edge function, scheduled)
supabase/functions/_shared/embedding-utils.ts               (already has generateRecipeEmbedding — reused)
src/services/api.ts                                          (no change expected)
docs/CHANGELOG.md
docs/RUNBOOK.md                                              (new troubleshooting entry)
docs/ARCHITECTURE.md                                         (note the refresh job in the AI pipeline section)
```

> **HARD RULE reminder:** no `supabase db push`, no `--linked` write commands. Migration is authored locally; Nick deploys.

---

## Scope of Work

### Phase 1: Trigger change — flag instead of null

**Files affected:** `supabase/migrations/<NNN>_embedding_refresh_lifecycle.sql` (new)

Replace the existing `update_recipe_embedding` trigger so it does NOT null the vector. Instead, set a `needs_reembed BOOLEAN` flag on the row. The stale vector remains queryable while the flag indicates regeneration is needed.

```sql
-- Add the flag column
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS needs_reembed BOOLEAN NOT NULL DEFAULT false;

-- Replace the existing trigger function
CREATE OR REPLACE FUNCTION update_recipe_embedding()
RETURNS TRIGGER AS $$
BEGIN
    NEW.needs_reembed := true;
    -- DO NOT null embedding_vector — keep the stale vector available for queries
    -- until the async refresh job replaces it.
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Trigger definition unchanged from migration 004:76-85 (column list, BEFORE UPDATE, etc.)
-- This is a function-body-only change.

-- Index for the refresh job to scan quickly
CREATE INDEX IF NOT EXISTS idx_recipes_needs_reembed
    ON recipes (needs_reembed)
    WHERE needs_reembed = true;
```

**Why "stale vector + flag" instead of "null":** users see SOMETHING in semantic results during the refresh window (minutes to hours) instead of NOTHING. The stale match might be imperfect but it's strictly better than nothing.

### Phase 2: Async re-embed job

**Files affected:** `supabase/functions/embedding-refresh/index.ts` (new), `supabase/functions/embedding-refresh/deno.json` (new)

A Supabase Edge Function that:
- Queries `SELECT id, title, description, cuisine, difficulty, tags, ingredients, instructions FROM recipes WHERE needs_reembed = true LIMIT 50`
- For each row, calls `generateRecipeEmbedding(openRouter, row)` (reuses existing `_shared/embedding-utils.ts`)
- Updates the row with the new embedding + `needs_reembed = false`
- Idempotent (if the trigger fires again mid-batch, the row stays flagged — picked up next run)
- Logs per-batch: rows processed, rows succeeded, rows failed, mean duration

Invocation: scheduled via Supabase Cron (`pg_cron` extension or Dashboard scheduled function) every 5 minutes. Bound by ada-002 API rate limit and OpenRouter cost.

Function shape:
```ts
// Pseudocode — implementation will follow recipe-pipeline patterns
import { createClient } from "@supabase/supabase-js";
import { createOpenRouterClient } from "../_shared/openrouter-client.ts";
import { generateRecipeEmbedding } from "../_shared/embedding-utils.ts";

const BATCH_SIZE = 50;
const MAX_DURATION_MS = 25000; // edge function timeout buffer

Deno.serve(async (req) => {
  const supabase = createClient(/* service role */);
  const openRouter = createOpenRouterClient();
  const startedAt = Date.now();

  const { data: rows } = await supabase
    .from("recipes")
    .select("id, title, description, cuisine, difficulty, tags, ingredients, instructions")
    .eq("needs_reembed", true)
    .limit(BATCH_SIZE);

  const results = { processed: 0, succeeded: 0, failed: 0, durationMs: 0 };
  for (const row of rows ?? []) {
    if (Date.now() - startedAt > MAX_DURATION_MS) break;
    try {
      const embedding = await generateRecipeEmbedding(openRouter, row);
      if (embedding) {
        await supabase
          .from("recipes")
          .update({
            embedding_vector: JSON.stringify(embedding),
            needs_reembed: false,
          })
          .eq("id", row.id);
        results.succeeded++;
      }
    } catch (err) {
      console.error("[embedding-refresh] row failed", row.id, err);
      results.failed++;
    }
    results.processed++;
  }
  results.durationMs = Date.now() - startedAt;
  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" },
  });
});
```

Notes:
- **Uses service-role key** because the function operates across users. Standard Supabase Edge Function pattern; gate access via the Cron invocation only, never expose publicly.
- **Cost:** ~$0.0001 per embedding × ~50 per 5min = ~$0.001 / 5min = ~$0.012 / hour = ~$0.29 / day worst case if the user constantly edits. Negligible in absolute terms; predictable.
- **`[verify]` Supabase Cron setup:** Nick verifies whether `pg_cron` is enabled on the project or if the Dashboard scheduled-function path is the intended invocation. Both are acceptable; pick one and document.

### Phase 3: Backfill existing null vectors

**Files affected:** included in same migration as Phase 1 OR run as a one-time manual invocation after deploy

After Phase 1 ships, mark all existing null-embedding rows as `needs_reembed = true` so the Phase 2 job picks them up:

```sql
UPDATE recipes SET needs_reembed = true WHERE embedding_vector IS NULL;
```

This is a one-time backfill. Idempotent (running twice is harmless).

### Phase 4: Documentation + runbook

**Files affected:** `docs/CHANGELOG.md`, `docs/RUNBOOK.md`, `docs/ARCHITECTURE.md`, `.claude/agents/chat-rag-sme-knowledge/rag-pipeline.md`

- CHANGELOG entry for the lifecycle fix
- RUNBOOK entry: "Embeddings aren't refreshing" → check `needs_reembed` count, check edge function logs, check cron schedule
- ARCHITECTURE update: note the refresh job in the AI pipeline section
- KB update: replace the "🚨 CRITICAL ISSUE — No embedding backfill" section in `rag-pipeline.md` with the new flow (`needs_reembed` flag, scheduled refresh, recovery semantics)

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P1 | Phase 1 — trigger change + flag column | S | High (fixes the silent degradation) |
| P1 | Phase 2 — async re-embed job | M | High (closes the loop) |
| P1 | Phase 3 — one-time backfill | S | High (unblocks existing-user RAG surfaces) |
| P2 | Phase 4 — docs + runbook + KB | S | Medium (closes the paper trail) |

This is **P1 because it blocks MOP-0007 Phase 2 (similar rail)** — without this fix, the rail will show nothing for edited recipes. Land MOP-0015 before promoting MOP-0007 to `verifying`.

---

## Verification

```yaml
verification:
  # Phase 1: trigger + column
  - id: migration-file-exists
    type: file-exists
    path: supabase/migrations/*embedding_refresh_lifecycle*.sql

  - id: needs-reembed-column-defined
    type: grep
    path: supabase/migrations/*embedding_refresh_lifecycle*.sql
    pattern: 'needs_reembed BOOLEAN'
    expect: present

  - id: trigger-no-longer-nulls
    type: grep
    path: supabase/migrations/*embedding_refresh_lifecycle*.sql
    pattern: 'embedding_vector := NULL'
    expect: absent

  - id: trigger-sets-flag
    type: grep
    path: supabase/migrations/*embedding_refresh_lifecycle*.sql
    pattern: 'NEW.needs_reembed := true'
    expect: present

  # Phase 2: edge function
  - id: refresh-function-exists
    type: file-exists
    path: supabase/functions/embedding-refresh/index.ts

  - id: refresh-function-uses-service-role
    type: human
    description: Edge function uses service-role client (since it crosses user boundaries via cron). Verify auth posture.
    hard_gate: true

  - id: refresh-function-batch-bounded
    type: grep
    path: supabase/functions/embedding-refresh/index.ts
    pattern: 'BATCH_SIZE|limit\('
    expect: present

  # Phase 3: backfill
  - id: backfill-statement-present
    type: grep
    path: supabase/migrations/*embedding_refresh_lifecycle*.sql
    pattern: 'UPDATE recipes SET needs_reembed = true WHERE embedding_vector IS NULL'
    expect: present

  # Phase 4: docs
  - id: changelog-entry
    type: grep
    path: docs/CHANGELOG.md
    pattern: 'MOP-0015|embedding refresh'
    expect: present

  - id: runbook-entry
    type: grep
    path: docs/RUNBOOK.md
    pattern: 'needs_reembed|Embedding refresh'
    expect: present

  - id: kb-updated
    type: grep
    path: .claude/agents/chat-rag-sme-knowledge/rag-pipeline.md
    pattern: 'needs_reembed'
    expect: present

  # Sanity gates
  - id: lint-clean
    type: command
    run: npm run lint
    expect_exit: 0

  - id: build-clean
    type: command
    run: npm run build
    expect_exit: 0

  - id: tests-pass
    type: command
    run: npm run test:run
    expect_exit: 0

  # Post-deploy human checks (after Nick deploys)
  - id: zero-stale-after-refresh-window
    type: human
    description: After deploy + 24h of cron runs, `SELECT COUNT(*) FROM recipes WHERE embedding_vector IS NULL OR needs_reembed = true` should be 0 for active users. Some non-zero is fine for recently-edited rows (within the 5-min window).
    hard_gate: true

  - id: semantic-search-returns-edited-recipes
    type: human
    description: After backfill, a user with edited recipes can find them via the chat agent's `search_recipes` tool (which uses semantic + text hybrid).
    hard_gate: true
```

---

## Acceptance Criteria

- [ ] All `verification` block items pass
- [ ] Trigger no longer nulls `embedding_vector`; sets `needs_reembed = true` instead
- [ ] `recipes.needs_reembed` column exists with default false, indexed for the refresh job's WHERE clause
- [ ] `embedding-refresh` edge function deployed and scheduled (every 5 minutes)
- [ ] One-time backfill SQL ran; existing null-embedding rows now have `needs_reembed = true`
- [ ] After 24h post-deploy, zero recipes have null embeddings (for active users; recently-edited rows within the 5-min window are fine)
- [ ] Chat agent's `search_recipes` returns edited recipes (validated end-to-end)
- [ ] CHANGELOG entry added
- [ ] RUNBOOK entry added
- [ ] `chat-rag-sme-knowledge/rag-pipeline.md` updated to reflect new lifecycle
- [ ] No `supabase db push` performed by Claude

---

## Related

- **Audit:** [docs/RAG_AUDIT.md](../RAG_AUDIT.md) (source for this finding)
- **KB:** [.claude/agents/chat-rag-sme-knowledge/rag-pipeline.md](../../.claude/agents/chat-rag-sme-knowledge/rag-pipeline.md) (will be updated post-fix)
- **MOPs:**
  - MOP-0007 (Smart Discovery) — Phase 2 similar rail is **blocked on this MOP**. Ship MOP-0015 first.
  - MOP-0008 (Chat Tool-Use) — already shipped; its `search_recipes` tool degrades silently when embeddings are stale. This MOP fixes that.
- **ADRs:** none (extends an existing pipeline; no new architectural decision worth recording separately)

---

## Notes

- **Why "flag instead of null" rather than "regenerate inline at edit":** inline regen would add 200-400ms to recipe save latency (currently <100ms for the simple UPDATE path). Async with stale-vector-bridge is the right tradeoff: search degrades gracefully during refresh; save stays snappy.
- **Why service-role for the refresh function:** the function operates across all users to process their edits. The standard Supabase pattern is service-role with cron-only invocation. Make sure the function does NOT expose any user data in responses (return only counts).
- **Cost projection:** at 1000 active users averaging 10 recipe edits/day each = 10,000 reembeds/day × $0.0001 = $1/day. Predictable, bounded, cheap.
- **Failure modes the refresh job needs to handle:**
  - OpenRouter API rate limit → exponential backoff, retry on next cron run
  - Recipe deleted mid-batch → SELECT before UPDATE catches the gap; if not, the UPDATE silently affects 0 rows
  - Embedding generation throws → log + leave `needs_reembed = true` (picked up next run)
  - Function timeout (Supabase Edge Functions have a max duration) → BATCH_SIZE bounded; the job processes what it can per invocation
- **Monitoring (post-deploy, not in this MOP):** add a Supabase Dashboard alert when `SELECT COUNT(*) FROM recipes WHERE needs_reembed = true` exceeds N for more than M minutes. Probably P3 follow-up.
- **External-worker check (`[verify]`):** Nick verifies whether a worker outside the repo already does this. If yes, this MOP is `cancelled` with a reason pointing at the worker; no work needed.
