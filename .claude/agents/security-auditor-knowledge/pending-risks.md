# Pending Risks — Awaiting Human Sign-Off

Entries here are reported as `⚠ PENDING APPROVAL` on every audit run. They are NOT suppressed.
To suppress: review, fill in `Approved by` + `Approval date`, and move to `accepted-risks.md`.

---

<!-- No pending risks. All three initial candidates (RISK-0001, RISK-0002, RISK-0003)
     were reviewed and approved by Nick Neal on 2026-09-22. See accepted-risks.md. -->

---

## is_meal_plan_owner() Returns false Instead of Raising 42501

- **Risk ID:** RISK-0004
- **File:** supabase/migrations/20261001000000_044_meal_plan_child_tables.sql:77-91
- **Risk:** `is_meal_plan_owner(p_meal_plan_id)` is SECURITY DEFINER and does not raise `errcode = '42501'` for unauthenticated callers (dimension 6 rule). When `auth.uid()` is NULL, `user_id = auth.uid()` is never true, so it returns `false`.
- **Severity:** Suggestion
- **Impact if exploited:** None identified. It fails closed (returns false, so no rows match). EXECUTE is revoked from PUBLIC and granted only to `authenticated`, so anon callers get a permission error before the body runs. Called directly, it only tells the caller whether they own a given plan id.
- **Why acceptance is proposed:** This is a boolean predicate used inside RLS `USING`/`WITH CHECK` clauses, not a user-facing RPC. If it raised, every policy check by a session without a uid would throw instead of filtering. The 42501 rule is meant for action RPCs, not RLS helper predicates.
- **Revisit trigger:** If the function is granted to `anon`, or used anywhere other than RLS policies (e.g. called from an edge function as an authorization gate), re-evaluate.
- **Approved by:**
- **Approval date:**
- **First surfaced:** 2026-10-17
