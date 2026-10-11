# MOP-0035: Per-Modality Recipe Extraction Requirements Spec

| Field | Value |
|-------|-------|
| **MOP** | MOP-0035 |
| **Title** | Per-Modality Recipe Extraction Requirements Spec |
| **Date Submitted** | 2026-10-04 |
| **Date Updated** | 2026-10-04 |
| **Date Completed** | — |
| **Submitted By** | surface-reviewer (from recipe-pipeline-sme audit, 2026-10-04) |
| **Status** | draft |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md). Valid values: `draft` / `evaluation` / `approved` / `planned` / `in_progress` / `verifying` / `complete` / `blocked` / `cancelled` / `deferred`.

---

## Summary

No intake modality has a written requirements spec covering required output fields, inference/accuracy rules, or acceptance criteria. Today the "contract" is spread across the TS schema (`_shared/recipe-schema.ts:39-53`), the prompt JSON shape (`_shared/recipe-prompts.ts:17-59`), and ad hoc required-field checks (`stages/extract.ts:218-226`, `stages/transform.ts:17-25`). The modalities have drifted as a result: the image prompt lacks rules the text prompt has, and the image prompt invites inference where the text prompt forbids it. "Accurate" also cannot be measured, because nothing defines it.

This MOP writes a normative spec, `docs/EXTRACTION_REQUIREMENTS.md`, in the same style as `docs/COLOR_SCHEMA.md`. It defines one shared output contract plus per-modality input handling and acceptance criteria, and it resolves the status of the audio and PDF modalities. It is documentation only. Code changes it implies are routed to MOP-0034 or new MOPs.

---

## Scope Map

```
docs/EXTRACTION_REQUIREMENTS.md
docs/API.md
docs/ARCHITECTURE.md
docs/README.md
CLAUDE.md
.claude/agents/recipe-pipeline-sme.md
supabase/functions/_shared/recipe-schema.ts
supabase/functions/_shared/recipe-prompts.ts
```

---

## Current state (from audit)

| Modality | Documented? | Where |
|---|---|---|
| Screenshot / image | Partial: input handling only, no output/accuracy spec | MOP-0001.md:35-69,241-245; API.md:371-388; recipe-prompts.ts:120-154 |
| Video | Partial (most complete) | MOP-0016; API.md:255-307; ARCHITECTURE.md:241-258 |
| Audio | Not a real modality: backend accepts it, UI picker excludes it, no `source_type` | passing mentions; `_shared/transcribe-media.ts` exists |
| URL | Partial | API.md:248-307; MOP-0027; MOP-0012.md:70-79 (deferred) |
| Text (pasted) | Partial, and the only one with testable criteria | MOP-0001.md:73-146,238-240,243-244 |
| PDF / other docs | No adapter, no docs | MOP-0012.md:84 (deferred fixture idea only) |

---

## Scope of Work

### Phase 1: Shared output contract
**Files affected:** `docs/EXTRACTION_REQUIREMENTS.md` (new)

One field table that applies to every modality:
- Each field: type, required/optional, allowed values, **absence rule** (per ADR-0007: absent = null, no inference), normalization owner (prompt vs post-process).
- Ingredient sub-schema: `name` (full canonical name), `amount` (representation per MOP-0032 Phase 1.7 outcome), `unit` (canonical list), `category` (list + `"other"` fallback), `notes`.
- Instruction rules: what counts as noise (whole-step social phrases only), ordering, section headers.
- `warnings[]` semantics (ADR-0007 §4).
- Multi-recipe rule: when to emit `recipes[]` vs. one recipe with sections.
- Governance rules (G1…Gn style, like COLOR_SCHEMA) — e.g., "all prompts interpolate the shared field-rules block", "no realistic values in few-shot examples", "every new modality needs a spec section before merge".

### Phase 2: Per-modality sections
**Files affected:** `docs/EXTRACTION_REQUIREMENTS.md`

For each of URL, text, screenshot/image, video: the input path (adapter → stage → model chain), input limits (size, count, resolution), modality-specific rules (e.g., JSON-LD first for URL; tiling/legibility target for screenshots; OCR-then-structure for video), known failure modes, and **testable acceptance criteria** (field-level accuracy expectations against fixtures).

> **Planning required:** set the accuracy bar per modality, e.g., "≥95% ingredient names exact-match on fixture set; 100% of steps preserved; 0 fabricated scalars". Choose numbers the MOP-0012 harness can measure.

### Phase 3: Resolve audio and PDF status
**Files affected:** `docs/EXTRACTION_REQUIREMENTS.md`, possibly `docs/API.md`

Record an explicit status for each: `supported` / `unsupported` / `planned`.
- **Audio:** the backend accepts it, but the UI and `source_type` do not. Either declare it unsupported and open a cleanup task to stop accepting it, or open a MOP to make it real. Leaving an undocumented half-path open is the one option ruled out.
- **PDF / other documents:** declare `unsupported` and add a trigger condition for revisit (e.g., N user requests).

### Phase 4: Cross-link and enforce
**Files affected:** `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/README.md`, `CLAUDE.md` (Documentation list), `.claude/agents/recipe-pipeline-sme.md`

- Link the spec from API/ARCHITECTURE pipeline sections. Remove duplicated, drifting contract text in favor of the link.
- Add to CLAUDE.md Documentation list as normative (like COLOR_SCHEMA).
- Tell `recipe-pipeline-sme` to audit changes against the spec.
- Add a comment header in `recipe-schema.ts` and `recipe-prompts.ts` pointing to the spec as source of truth.

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P2 | Phase 1 — shared output contract | Medium | High — ends cross-modality drift; defines "accurate" |
| P2 | Phase 2 — per-modality sections + acceptance criteria | Medium | High — gives MOP-0034 and MOP-0012 a measurable target |
| P2 | Phase 3 — audio/PDF status decision | Small | Medium — closes an undocumented half-path |
| P3 | Phase 4 — cross-links, governance hooks | Small | Medium |

---

## Verification

> **Lockticket acceptance criteria.** See [MOP_VERIFICATION_POLICY.md](../prompts/MOP_VERIFICATION_POLICY.md) — **`type: human` is forbidden** (blocks `complete`). Run `/verify-mop MOP-0035`.

```yaml
verification:
  - id: spec-exists
    type: file-exists
    path: docs/EXTRACTION_REQUIREMENTS.md

  - id: spec-covers-screenshot
    type: grep
    path: docs/EXTRACTION_REQUIREMENTS.md
    pattern: "## .*Screenshot"
    expect: present

  - id: spec-covers-video
    type: grep
    path: docs/EXTRACTION_REQUIREMENTS.md
    pattern: "## .*Video"
    expect: present

  - id: spec-covers-url
    type: grep
    path: docs/EXTRACTION_REQUIREMENTS.md
    pattern: "## .*URL"
    expect: present

  - id: spec-covers-text
    type: grep
    path: docs/EXTRACTION_REQUIREMENTS.md
    pattern: "## .*Text"
    expect: present

  - id: spec-declares-audio-status
    type: grep
    path: docs/EXTRACTION_REQUIREMENTS.md
    pattern: "Audio.*(supported|unsupported|planned)"
    expect: present

  - id: spec-declares-pdf-status
    type: grep
    path: docs/EXTRACTION_REQUIREMENTS.md
    pattern: "PDF.*(supported|unsupported|planned)"
    expect: present

  - id: spec-references-adr-0007
    type: grep
    path: docs/EXTRACTION_REQUIREMENTS.md
    pattern: "ADR-0007"
    expect: present

  - id: claude-md-links-spec
    type: grep
    path: CLAUDE.md
    pattern: "EXTRACTION_REQUIREMENTS.md"
    expect: present

  - id: lint-clean
    type: command
    run: npm run lint
    expect_exit: 0
```

Allowed assertion types: `file-exists`, `grep`, `command`, `test-passes`. **Not allowed:** `human`.

## Manual Follow-up (non-blocking)

- [ ] `recipe-pipeline-sme` review of the spec against current code; log divergences as MOP-0034 items or new MOPs

---

## Acceptance Criteria

- [ ] All `verification` block items pass (`/verify-mop`)
- [ ] Shared output contract with absence rule for every field
- [ ] URL, text, screenshot, video each have input limits + testable acceptance criteria
- [ ] Audio and PDF each have an explicit status
- [ ] Spec is linked from CLAUDE.md, API.md, ARCHITECTURE.md
- [ ] Documentation updated per `/update-docs` procedure
- [ ] CHANGELOG entry added

---

## Related

- **ADRs:** ADR-0007 (absence/provenance semantics — the spec's core rule)
- **MOPs:** MOP-0034 (screenshot fixes measured against §Screenshot), MOP-0012 (fixtures measure the spec's acceptance criteria), MOP-0032 Phase 1 (normalization rules to codify), MOP-0001, MOP-0016, MOP-0027
- **Audit / source:** recipe-pipeline-sme screenshot extraction audit, 2026-10-04 (documentation gap finding)

---

## Notes

- Can run in parallel with MOP-0034 Phase 1. Ideally Phase 2 §Screenshot lands before MOP-0034 Phases 3–5, so they have a target to verify against.
- Write the spec to describe the *intended* contract, not current behavior. Where code diverges, the spec wins and the gap becomes a work item.
