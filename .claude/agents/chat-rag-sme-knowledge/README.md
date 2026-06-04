# Chat + RAG SME Knowledge Base

> Persistent reference for the `chat-rag-sme` subagent. Read before answering any non-trivial diagnostic or explanation query.

## Navigation

| File | What's in it | Read when |
|---|---|---|
| [rag-pipeline.md](rag-pipeline.md) | Embedding lifecycle (generation, storage, invalidation), the critical no-backfill issue, embedding content (which fields go into the vector), table shapes | Any question about "why are embeddings wrong / stale / missing", or about how embeddings are built |
| [chat-agent-architecture.md](chat-agent-architecture.md) | Agent loop, 12-tool catalog, confirmation flow, capability gates, `<tool_result>` wrapping, `user_id` rejection, MAX_ITERS | Any question about chat agent behavior, tool dispatch, confirmation prompts, web search availability |
| [search-mechanism-decision.md](search-mechanism-decision.md) | RAG vs full-text vs filter chips — when each is correct. Per-surface mechanism map from `docs/RAG_AUDIT.md` | Any question about "should this use RAG", or about why a specific surface uses what it uses |
| [troubleshooting-playbook.md](troubleshooting-playbook.md) | Symptom → diagnosis flowcharts for the six common failure modes (empty/few results, irrelevant results, hallucinated recipe, refused capability, slow search, wrong similar rail) | Any diagnostic query — start here |
| [configuration-reference.md](configuration-reference.md) | Every tunable knob (thresholds, weights, models, temperatures, token budgets, capability gates) with file:line citations | Any question about a specific value, or any tuning recommendation |
| [lessons-learned.md](lessons-learned.md) | Append-only log of observed patterns. Empty until first non-trivial run | Read before answering; propose additions when something new surfaces |

## Reading order for first-time invocations

1. `chat-agent-architecture.md` — know the playing field
2. `rag-pipeline.md` — know what could go wrong with embeddings (the no-backfill issue is the most common cause of weirdness)
3. The topic-specific file for the question at hand
4. `lessons-learned.md` — check for prior similar diagnoses

## Sources

Citations follow this format: `<file>:<line>` or `<file>:<line-range>`. Common reference roots:

- `supabase/functions/chat-api/` — agent loop, tools, dispatch (MOP-0008)
- `supabase/functions/_shared/` — openrouter-client, embedding-utils, recipe-prompts
- `supabase/migrations/20251201000003_004_search_and_embeddings.sql` — the embedding table + RPC source-of-truth
- `src/services/api.ts` — frontend RAG surface (much is dead per ADR-0004)
- `docs/RAG_AUDIT.md` — per-surface mechanism decisions
- `docs/MOPs/MOP-0008.md` — chat tool-use migration source-of-truth
- `docs/MOPs/MOP-0007.md` — smart-discovery scope-of-work

If a section needs a citation it doesn't have, mark `[verify]` and ask the user. **Never invent values.**

## Updating the KB

The `chat-rag-sme` proposes updates after non-trivial diagnoses. Updates are accepted by the user and applied as separate edits. Direct writes from the agent are not allowed — the KB is human-curated.
