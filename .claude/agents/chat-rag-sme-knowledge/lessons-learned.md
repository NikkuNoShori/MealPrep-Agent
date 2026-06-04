# Lessons Learned

> Accumulated learning from `chat-rag-sme` diagnoses. Append-only — user-approved additions only.

## How to add an entry

After a non-trivial diagnostic or explanation task, the agent proposes an entry. User reviews and accepts. Each entry should be short — name the pattern, name the evidence, name the takeaway.

Format:

```
## YYYY-MM-DD — [Short title]

**Symptom observed:** [what the user reported / what surfaced]
**Diagnosis:** [the root cause + file:line]
**Why it matters:** [generalize — what other queries / surfaces does this affect]
**Takeaway:** [what to check first next time the same shape of question comes up]
```

---

## Entries

*(No entries yet. The first entry will be added after the agent's first non-trivial diagnosis.)*

### Candidates for the first entries (surfaced during KB seeding, 2026-06-04)

These weren't full diagnoses — they were observations from reading the code while building the KB. Suggest adding them on first run that touches the same areas:

1. **Threshold drift between migration defaults and handler overrides.** Migrations define `search_recipes_semantic` default 0.7 and `find_similar_recipes` default 0.6; handlers override to 0.5 and 0.4 respectively. The migration defaults are dead code (nothing calls these RPCs with defaults in current production). Anyone tuning thresholds should target the override, not the default.

2. **`recipe_embeddings` table is orphan.** 384-dim, defined in migration 004, read by `search_similar_recipes` RPC, but **no current Deno edge-function code writes to it**. The live path is 1536-dim on `recipes.embedding_vector`. Candidate for ADR + drop migration once external usage is verified.

3. **Audit's `0.7/0.3` hybrid weighting claim is wrong.** That weighting was in retired `server.js` / `backend/rag-api.js`. Current `searchRecipes` handler dedupes by id with semantic-first ordering — no weighting. When users reference "the hybrid weight," correct gently.

4. **No-backfill issue is the most common cause of "search is broken" reports.** Trigger nulls vectors on edit; nothing re-embeds. Steady-state for an active user: most recipes have null vectors → semantic search effectively useless. **Check `embedding_vector IS NULL` count FIRST when diagnosing weird search behavior.**
