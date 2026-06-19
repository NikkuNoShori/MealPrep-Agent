# MOP Verification Compliance Audit

**Date:** 2026-06-15  
**Policy:** [MOP_VERIFICATION_POLICY.md](MOP_VERIFICATION_POLICY.md)  
**Matrix:** [DOMAIN_TEST_MATRIX.md](DOMAIN_TEST_MATRIX.md)

---

## Summary

| Category | Count |
|----------|-------|
| `complete` MOPs | 7 (0001, 0002, 0004, 0005, 0006, **0008**) |
| `complete` with verification block | 7 |
| `complete` missing verification block | 0 |
| `in_progress` | 1 (0016 — blocked on operator deploy/smoke) |
| `draft` with human gates | 5+ (0007, 0011, 0012, 0014, 0015) |

**Policy enacted:** `type: human` assertions **cannot gate `complete`**. Manual steps must live outside the verification YAML or be automated.

---

## Per-MOP status

| MOP | Status | Verification block | Human gates | Completable? | Action |
|-----|--------|-------------------|-------------|--------------|--------|
| 0001 | complete | ✅ Added | 0 | ✅ Run `/verify-mop MOP-0001` | One-time verify |
| 0002 | complete | ✅ Added | 0 | ✅ Run `/verify-mop MOP-0002` | One-time verify |
| 0004 | complete | ✅ Added | 0 | ✅ Run `/verify-mop MOP-0004` | One-time verify |
| 0005 | complete | ✅ Added | 0 | ✅ Run `/verify-mop MOP-0005` | One-time verify |
| 0006 | complete | ✅ Added | 0 | ✅ Verified | — |
| 0008 | complete | ✅ Present | 0 | ✅ Verified 2026-06-15 | Live eval in Manual Follow-up |
| 0016 | in_progress | ✅ Present | 0 | ⏳ Operator | OpenRouter + deploy + smoke |
| 0007 | draft | ✅ Present | 3 | N/A (draft) | Remove human before verifying |
| 0011–0015 | draft | ✅ Present | varies | N/A | Author automated checks early |

---

## MOP-0008 status (2026-06-15)

Tier 1 `golden-routing.test.ts` shipped and verified. Deno tests run via `supabase/functions/deno.json` (`nodeModulesDir: none`). MOP status: **`complete`**. Live model eval remains Manual Follow-up.

## MOP-0016 status (2026-06-15)

Code + static verification ready. Blocked on operator: `OPENROUTER_API_KEY`, edge deploy, live smoke. Mechanical checks (lint/tsc/vitest/unit deno) pass locally.

---

## Agent + skill wiring (2026-06-14)

| Tool | Role |
|------|------|
| `integrity-orchestrator` | Routes tests by domain from DOMAIN_TEST_MATRIX |
| `/integrity-check` | User-invoked orchestrator |
| `/verify-mop` | Parses MOP verification YAML; rejects human gates |
| `meal-planning-sme` | Domain expert — meal planner + grocery |
| `household-sme` | Domain expert — sharing + invites + RLS |
| `platform-auth-sme` | Domain expert — auth, session, profiles |
| `recipe-pipeline-sme` | Domain expert — extraction + recipes library |
| `chat-rag-sme` | Domain expert — chat + search (existing) |
| `data-integrity` | Deep numeric/RLS analysis after orchestrator |

---

## Recommended next steps

1. **Nick (when ready):** MOP-0016 operator steps — OpenRouter secret, deploy `recipe-pipeline` + `chat-api`, smoke TikTok URL + video upload.
2. Run `/verify-mop` on MOP-0001, 0002, 0004, 0005, 0006 if not done locally (one-time).
3. Optional: MOP-0016 Phase 5 UX (`RecipeIntake.tsx` modal, pinned-comment field) — needs explicit UI consent.
