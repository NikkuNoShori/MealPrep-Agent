# MOP-0027: ToS-Compliant URL Scraping

| Field | Value |
|-------|-------|
| **MOP** | MOP-0027 |
| **Title** | ToS-Compliant URL Scraping — robots.txt check + domain blocklist |
| **Date Submitted** | 2026-09-07 |
| **Date Updated** | 2026-09-07 |
| **Date Completed** | — |
| **Submitted By** | Nick Neal |
| **Status** | draft |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md). Valid values: `draft` / `evaluation` / `approved` / `planned` / `in_progress` / `verifying` / `complete` / `blocked` / `cancelled` / `deferred`.

---

## Summary

MealPrep Agent is planned for public launch with an ad-supported model, which makes URL scraping a commercial activity. This MOP adds two complementary ToS-compliance layers to the URL adapter: (1) a `robots.txt` check that declines extraction when the target path is disallowed, and (2) a curated domain blocklist for sites that explicitly prohibit scraping in their ToS regardless of `robots.txt`. When either check blocks a URL, the user receives a clear message directing them to the text-paste fallback, which is always available and does not involve server-side fetching.

---

## Scope Map

```
supabase/functions/recipe-pipeline/adapters/url-adapter.ts
supabase/functions/recipe-pipeline/_shared/tos-check.ts    (new)
supabase/functions/recipe-pipeline/_shared/blocked-domains.json  (new)
supabase/functions/_shared/                                (shared utilities if needed)
docs/RUNBOOK.md
docs/ARCHITECTURE.md
```

---

## Scope of Work

### Phase 1: `robots.txt` checker utility
**Files affected:** `supabase/functions/recipe-pipeline/_shared/tos-check.ts` (new)

Create a `checkRobotsTxt(url: string): Promise<{ allowed: boolean; reason?: string }>` utility that:
- Fetches `https://<domain>/robots.txt` with a short timeout (3s) and a descriptive User-Agent
- Parses the response for `User-agent: *` and `User-agent: Googlebot` (common proxy for "all bots") rules
- Checks whether the target path is covered by a `Disallow:` directive
- Returns `{ allowed: true }` on fetch error or parse failure — fail open so a network hiccup doesn't block a legitimate recipe
- Caches the result in-memory per domain for the lifetime of the edge function invocation (avoids repeat fetches for batch imports of the same domain)

### Phase 2: Domain blocklist
**Files affected:** `supabase/functions/recipe-pipeline/_shared/blocked-domains.json` (new)

A JSON array of domains known to prohibit scraping in their ToS regardless of `robots.txt`:

Initial list (to be expanded during implementation after reviewing each site's ToS):
- `cooking.nytimes.com` — NYT Cooking, explicit prohibition
- `www.nytimes.com` — NYT main
- `app.ckbk.com` — Ckbk, subscription cookbook service
- `www.epicurious.com` — Condé Nast, ToS prohibits scraping
- `www.bonappetit.com` — Condé Nast
- `www.saveur.com` — Bonnier, ToS prohibits scraping

Each entry should include a comment field for the reason (JSON with `domain` + `reason` objects).

### Phase 3: Wire checks into URL adapter
**Files affected:** `supabase/functions/recipe-pipeline/adapters/url-adapter.ts`

Before fetching the target URL:
1. Check domain against blocklist → if hit, return structured error immediately (no fetch)
2. Check `robots.txt` for the target path → if disallowed, return structured error (no fetch)

Error shape returned to the pipeline:
```typescript
{
  success: false,
  errors: [{
    stage: "fetch",
    code: "TOS_BLOCKED",
    message: "This site doesn't allow automated imports. Copy the recipe text and paste it instead — it works just as well."
  }],
  stage_failed: "fetch"
}
```

This surfaces cleanly through the existing pipeline error path to the frontend (api.ts already extracts `errors[0].message`).

### Phase 4: User-facing message polish
**Files affected:** `supabase/functions/recipe-pipeline/adapters/url-adapter.ts`

Distinguish the two block reasons in the user message:
- Blocklist hit: "This site prohibits recipe imports. Paste the recipe text instead."
- robots.txt disallowed: "This site's robots.txt doesn't allow automated access. Paste the recipe text instead."

Both messages should appear cleanly in the single-URL import card and batch import error cards (no raw JSON).

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | Phase 1 — robots.txt checker | Small | High — standard industry practice, favorable in legal disputes |
| P0 | Phase 2 — domain blocklist | Small | High — covers highest-risk sites before launch |
| P0 | Phase 3 — wire into URL adapter | Small | High — makes checks actually run |
| P1 | Phase 4 — message polish | Tiny | Medium — UX clarity |

---

## Verification

```yaml
verification:
  - id: tos-check-utility-exists
    type: file-exists
    path: supabase/functions/recipe-pipeline/_shared/tos-check.ts

  - id: blocked-domains-exists
    type: file-exists
    path: supabase/functions/recipe-pipeline/_shared/blocked-domains.json

  - id: url-adapter-imports-tos-check
    type: grep
    path: supabase/functions/recipe-pipeline/adapters/url-adapter.ts
    pattern: 'tos-check|checkRobotsTxt|blocked-domains'
    expect: present

  - id: url-adapter-has-tos-blocked-code
    type: grep
    path: supabase/functions/recipe-pipeline/adapters/url-adapter.ts
    pattern: 'TOS_BLOCKED'
    expect: present

  - id: blocked-domains-has-nyt
    type: grep
    path: supabase/functions/recipe-pipeline/_shared/blocked-domains.json
    pattern: 'nytimes'
    expect: present

  - id: robots-txt-fail-open
    type: grep
    path: supabase/functions/recipe-pipeline/_shared/tos-check.ts
    pattern: 'allowed.*true|fail.open|catch'
    expect: present

  - id: lint-clean
    type: command
    run: npm run lint
    expect_exit: 0

  - id: build-clean
    type: command
    run: npm run build
    expect_exit: 0
```

## Manual Follow-up (non-blocking)

- [ ] Spot-test a blocked domain (e.g. NYT Cooking URL) returns the friendly error message in both single-URL and batch import flows
- [ ] Spot-test a legitimate recipe site (e.g. allrecipes.com) still imports successfully
- [ ] Review and expand the blocked-domains list before public launch — check ToS for top 20 recipe sites

---

## Acceptance Criteria

- [ ] All `verification` block items pass (`/verify-mop`)
- [ ] URL adapter checks blocklist before fetching — no HTTP request made to blocked domains
- [ ] URL adapter checks `robots.txt` for non-blocked domains before fetching page content
- [ ] `robots.txt` fetch failure → fail open (allow extraction to proceed)
- [ ] Blocked URLs surface a clean, actionable user message (no raw JSON, no HTTP status codes)
- [ ] Text-paste adapter is unaffected — no ToS check applied there
- [ ] CHANGELOG entry added
- [ ] `docs/ARCHITECTURE.md` updated to note the ToS compliance layer in the URL adapter description

---

## Related

- **MOPs:** MOP-0016 (Short-Form Video Intake — has its own ToS section for video platforms; pattern reference), MOP-0019 (Batch Recipe Import — error messages from this MOP must surface cleanly through SSE error cards)
- **ADRs:** none required — extends an existing pattern (URL adapter fetch gate)

---

## Notes

- **Fail open on robots.txt errors**: a network timeout or malformed robots.txt should never block a legitimate extraction. The check is a good-faith effort, not a hard gate.
- **Text adapter is exempt**: the text-paste path involves the user copying content — that's the user's action, not ours. No ToS check needed.
- **Blocklist is a living document**: add an entry any time a site sends a C&D or is reported as prohibiting scraping. The JSON format makes this a one-line change.
- **User-Agent discipline**: the robots.txt fetch should use a descriptive User-Agent (e.g. `MealPrepAgent/1.0 (+https://yourapp.com/bot)`) so sites can identify and allowlist the bot if they choose.
- **No LLM call in this MOP**: all checks are pure string matching — fast, deterministic, zero API cost.
