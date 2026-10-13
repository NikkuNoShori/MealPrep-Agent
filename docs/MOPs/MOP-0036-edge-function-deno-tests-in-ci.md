# MOP-0036: Edge-Function Deno Tests in CI + Local Toolchain

| Field | Value |
|-------|-------|
| **MOP** | MOP-0036 |
| **Title** | Edge-Function Deno Tests in CI + Local Toolchain |
| **Date Submitted** | 2026-10-12 |
| **Date Updated** | 2026-10-12 |
| **Date Completed** | — |
| **Submitted By** | surface-reviewer |
| **Status** | draft |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md). Valid values: `draft` / `evaluation` / `approved` / `planned` / `in_progress` / `verifying` / `complete` / `blocked` / `cancelled` / `deferred`.

---

## Summary

The repo has five Deno test files under `supabase/functions/`, but nothing runs them. `.github/workflows/ci.yml` has only Node jobs (tsc, ESLint, Vitest, Playwright), and Deno is not installed on the primary dev machine. A crash in `chat-api/agent-loop.ts` came in with commit `dc8bf5d` (2026-09-03) and sat on `main` for about 5 weeks. The bug was an unguarded `lastRecipes.length` on an `undefined` value, and it broke the confirmation response for every destructive tool call that wasn't preceded by a multi-recipe extraction in the same turn. The existing test `agent-loop.test.ts:160` ("destructive tool short-circuits with pendingConfirmation") covers exactly that path and would have failed on the first run. It was never run.

This MOP closes the gap. It adds a blocking Deno CI job and documents local Deno setup. It also re-checks the MOPs whose Verification blocks cite `deno test` commands, since those checks may have passed only on paper.

---

## Scope Map

```
.github/workflows/ci.yml
package.json
supabase/functions/deno.json
supabase/functions/**/__tests__/**
supabase/functions/**/*_test.ts
docs/RUNBOOK.md
docs/prompts/DOMAIN_TEST_MATRIX.md
```

---

## Scope of Work

### Phase 1: Baseline the existing Deno suite
**Files affected:** `supabase/functions/chat-api/__tests__/agent-loop.test.ts`, the other 4 test files (read-only unless fixes are needed)

- Install Deno locally (see Phase 3). Run every test file and record pass/fail:
  - `supabase/functions/chat-api/__tests__/agent-loop.test.ts`
  - `supabase/functions/chat-api/__tests__/golden-routing.test.ts`
  - `supabase/functions/chat-api/__tests__/conversation-context.test.ts`
  - `supabase/functions/_shared/link-extractor_test.ts`
  - `supabase/functions/recipe-pipeline/stages/extract_test.ts` (MOP-0034 Phases 1-3 changes are still unverified, per handoff 2026-10-11)
- Expect some bit-rot after weeks without runs (fake-client shape drift from the `models.ts` centralization, the `chatWithToolsResilient` wrapper, `tool_choice` changes). Fix the tests, not the production code, unless a test exposes a real bug. Surface any real bug via `surface-reviewer`.
- Make the agent-loop regression coverage explicit:
  - At `agent-loop.test.ts:160`, assert `reply.recipes === undefined` and `reply.recipe === undefined`, so the `lastRecipes?.length` guard is pinned in place.
  - Add a test: an extraction tool returns `{ data: { recipes: [...] } }`, then a destructive tool runs in the same turn. Assert `pendingConfirmation` is set **and** `reply.recipes` survives. This covers the dc8bf5d intent described in the comment at `agent-loop.ts:301-302`, which currently has no test.
  - Add a test: when `input.images` is non-empty, the first `chatWithTools` call gets `tool_choice: "required"` and later calls get `"auto"` (`agent-loop.ts:213-219`).
- Check that no test needs network access or a live `OPENROUTER_API_KEY`. The `--allow-net` flags in `DOMAIN_TEST_MATRIX.md` suggest some might. Any test that makes real network calls goes behind an opt-in env flag so CI stays hermetic.

### Phase 2: Blocking Deno CI job
**Files affected:** `.github/workflows/ci.yml`, `package.json`

- Add a `deno` job using `denoland/setup-deno` (pin the major version). It should run `deno test --config supabase/functions/deno.json --allow-env --allow-net=<none or explicit hosts> <files>` and be **blocking**. Do not copy the e2e job's `|| true` pattern.
- Add a `deno check` step (type-check) over the edge-function entrypoints. Root `tsc --noEmit` does not cover Deno code, so type errors in `supabase/functions/` currently reach deploy without any check.
- Add `npm run test:edge` to `package.json`, wrapping the full Deno test set. Keep `test:golden-routing` as-is.
- No secrets in the workflow. The tests use fakes. If a test needs an env var, set it to a dummy value in the job's `env:` block.

### Phase 3: Local toolchain + docs
**Files affected:** `docs/RUNBOOK.md`, `docs/prompts/DOMAIN_TEST_MATRIX.md`

- RUNBOOK: Windows/macOS install commands for Deno (`winget install DenoLand.Deno` / `irm https://deno.land/install.ps1 | iex`; `brew install deno`), the version to match CI, and `npm run test:edge`.
- DOMAIN_TEST_MATRIX: remove the "(when Deno available)" hedges and point the chat/recipe-pipeline integrity commands at `npm run test:edge` or the per-file equivalents.

### Phase 4: Retroactive verification audit
**Files affected:** MOP files listed below (notes only)

- Re-run the `deno test` assertions in the Verification blocks of MOPs already marked `complete` or `verifying`. At minimum: MOP-0008 (golden routing, agent-loop) and MOP-0016 (link-extractor). Also MOP-0034's `extract_test.ts`, which is still `draft` but has code shipped. If `/verify-mop` previously recorded a pass without Deno available, add a `> Note:` to the affected MOP with the real result.

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P1 | Phase 1 baseline + agent-loop regression tests | Small | High |
| P1 | Phase 2 blocking CI job | Small | High |
| P2 | Phase 3 docs | Small | Medium |
| P2 | Phase 4 retroactive audit | Small | Medium |

---

## Verification

> **Lockticket acceptance criteria.** See [MOP_VERIFICATION_POLICY.md](../prompts/MOP_VERIFICATION_POLICY.md). `type: human` is forbidden. **This MOP's own Deno assertions must actually run.** `/verify-mop` should report FAIL, not skip, when `deno` is not on PATH.

```yaml
verification:
  - id: lint-clean
    type: command
    run: npm run lint
    expect_exit: 0

  - id: build-clean
    type: command
    run: npm run build
    expect_exit: 0

  - id: unit-tests
    type: command
    run: npm run test:run
    expect_exit: 0

  - id: deno-available
    type: command
    run: deno --version
    expect_exit: 0

  - id: edge-tests
    type: command
    run: npm run test:edge
    expect_exit: 0

  - id: ci-has-deno-job
    type: grep
    file: .github/workflows/ci.yml
    pattern: "denoland/setup-deno"

  - id: ci-deno-job-blocking
    type: command
    run: "! grep -n 'test:edge.*|| true' .github/workflows/ci.yml"
    expect_exit: 0

  - id: agent-loop-recipes-guard-pinned
    type: grep
    file: supabase/functions/chat-api/__tests__/agent-loop.test.ts
    pattern: "reply\\.recipes"
```

## Manual Follow-up (non-blocking)

- [ ] Confirm the first CI run on a PR shows the `deno` job green and required in branch protection.

---

## Acceptance Criteria

- [ ] All `verification` block items pass (`/verify-mop`)
- [ ] All 5 existing Deno test files pass locally and in CI
- [ ] Deno CI job is blocking (no `|| true`)
- [ ] `deno check` covers `chat-api`, `recipe-pipeline`, and `_shared`
- [ ] Agent-loop tests cover: destructive-without-extraction (recipes undefined), extraction-then-destructive (recipes preserved), images force `tool_choice: "required"` on turn 1
- [ ] RUNBOOK documents local Deno install
- [ ] Retroactive notes added to any MOP whose Deno verification never actually ran
- [ ] Documentation updated per `/update-docs` procedure

---

## Related

- **ADRs:** none
- **MOPs:** MOP-0005 (test infrastructure; §Notes flagged edge-function testing as a follow-on that never happened), MOP-0008 + MOP-0008-ADVISEMENT (golden-routing Deno tests; Part D lists Deno as required tooling), MOP-0012 (deferred recipe-pipeline fixture library; would plug into this CI job), MOP-0034 (`extract_test.ts` unverified)
- **Audit / source:** surface-reviewer 2026-10-12, from the chat-with-images 404 → 400 → recipe-card debugging session (chat-rag-sme diagnosis)

---

## Notes

- **Origin bug:** `agent-loop.ts:304` `lastRecipes.length` → `lastRecipes?.length`. Fixed inline 2026-10-12 (uncommitted at time of drafting). A grep of `chat-api/` confirms this was the only unguarded dereference of `lastRecipes`. The other uses (lines 239, 365, 374) pass the value through, where `undefined` is fine. Line 303 (`lastRecipe || undefined`) was always safe.
- **Affected tools:** every tool that returns `requiresConfirmation`, per `catalog.ts` `DESTRUCTIVE_TOOLS` / `CONDITIONALLY_DESTRUCTIVE`: `update_recipe`, `delete_recipe`, `update_member_allergens`, `assign_recipe_to_meal_plan_slot` (when overwriting).
- The fix is not live until `chat-api` is redeployed. The user handles deploys.
- No DB or migration work. No HARD RULE conflict.
