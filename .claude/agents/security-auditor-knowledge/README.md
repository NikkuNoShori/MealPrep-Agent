# Security Auditor Knowledge Base

This directory is read by the `security-auditor` agent on every run.

## Files

| File | Purpose |
|------|---------|
| `pending-risks.md` | Candidate accepted risks awaiting human sign-off. Agent reports these as `⚠ PENDING APPROVAL` — they are **not** suppressed. |
| `accepted-risks.md` | Risks that have been reviewed and explicitly approved by a human. Agent suppresses matching findings on audit runs. |
| `fixed-findings.md` | Confirmed bugs that have been fixed. Agent skips re-reporting these. |

## Promotion workflow

1. Agent identifies a potential accepted-risk candidate → appends it to `pending-risks.md` (agent may write here)
2. Human reviews the entry — either fixes the issue or approves acceptance
3. If approved: human fills in `Approved by` + `Approval date` and moves the entry to `accepted-risks.md`
4. If fixed instead: human moves the entry to `fixed-findings.md` with `Fixed in` + `Date fixed`

**No risk may be suppressed without a human-filled `Approved by` field.**

## Risk ID scheme

Risk IDs are assigned sequentially: `RISK-0001`, `RISK-0002`, etc. The agent assigns the next available ID when nominating a new candidate.
