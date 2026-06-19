Run domain-routed integrity checks via the `integrity-orchestrator` agent.

## Instructions

Single-shot procedure. Invoke the **`integrity-orchestrator`** subagent (do not improvise test commands).

## Inputs (ask if not provided)

1. **Scope** — one of:
   - `MOP-NNNN` (reads Scope Map + DOMAIN_TEST_MATRIX)
   - Explicit domain list (e.g. `meal-planning, chat-rag`)
   - `branch` (default: diff against `main`)
2. **Include integration?** (default: no) — if yes, requires `supabase start` + `RUN_INTEGRATION_TESTS=1`
3. **Include e2e?** (default: no) — requires dev server + Playwright

## Workflow

1. Read `docs/prompts/DOMAIN_TEST_MATRIX.md` and `docs/prompts/MOP_VERIFICATION_POLICY.md`.
2. Launch `integrity-orchestrator` with scope + options.
3. Return the orchestrator report verbatim.
4. If FAIL → list which **domain SME** to invoke next (from matrix).

## Do NOT

- Mark any MOP `complete` from this command alone — use `/verify-mop` after integrity passes.
- Skip failing tests or fake pass on integration when Supabase is down.
