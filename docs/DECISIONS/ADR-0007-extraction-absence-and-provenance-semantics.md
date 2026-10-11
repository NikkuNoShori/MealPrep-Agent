# ADR-0007: Recipe Extraction — Absent Means Null, Uncertainty Goes in `warnings`

**Status:** proposed
**Created:** 2026-10-04
**Author:** Nick Neal
**Last reviewed:** 2026-10-04
**Related MOP:** MOP-0034 (screenshot extraction accuracy), MOP-0035 (per-modality extraction requirements spec)

## Context

A user report that screenshot extraction is inaccurate led to a `recipe-pipeline-sme` audit (2026-10-04). Four of its findings are not separate bugs. They come from one missing decision: **what should the pipeline do when a field is not in the source, or when the model is unsure of a value?** Today each layer answers differently, and the answers contradict each other.

| Layer | Current behavior | Evidence |
|---|---|---|
| Text prompt | Omit or null missing info | `_shared/recipe-prompts.ts:63` |
| Image prompt, Rule 5 | "**Infer** missing metadata — estimate prep/cook time and difficulty if not stated" | `recipe-prompts.ts:137` |
| Image prompt, Critical Rule 1 | "Never hallucinate — only extract what is clearly visible" | `recipe-prompts.ts:147` |
| Image prompt example | Concrete values (`prepTime:15, cookTime:30, totalTime:45, servings:4, difficulty:"easy"`) that an 8B VL model is likely to copy | `recipe-prompts.ts:141` |
| Image prompt, Critical Rule 2 | "note uncertainty", but the schema has no place to put it | `recipe-prompts.ts:148`; `_shared/recipe-schema.ts:39-53` |
| Transform stage | Silent defaults: `servings || 4`, `difficulty → "medium"`, `category → "pantry"` | `recipe-pipeline/stages/transform.ts:34,40,47` |
| DB | `servings INTEGER DEFAULT 4`, `difficulty VARCHAR(20) DEFAULT 'medium'`. Both are **nullable**. | `migrations/20251201000000_001_core_schema.sql:102-103` |

The result: a saved recipe cannot show whether "serves 4, medium, 45 min" came from the source, from the model's guess, or from a transform default. Users cannot tell real data from filler, and wrong values look as trustworthy as correct ones. Screenshots are hit hardest because the vision prompt actively invites inference.

This decision applies to all modalities (URL, text, image, video), not just screenshots. That is why it is an ADR and not a line item in MOP-0034.

## Decision

### 1. Absent means null, end to end
If a scalar field (`prepTime`, `cookTime`, `totalTime`, `servings`, `difficulty`, `cuisine`, `description`) is not stated in the source, the pipeline carries `null` through extract → transform → load.
- Remove "Infer missing metadata" (image Rule 5). All prompts use the text prompt's omit/null rule.
- `totalTime` may still be **computed** as `prepTime + cookTime` when both were extracted. This is arithmetic on extracted values, not inference.
- Transform must not substitute `servings: 4` or `difficulty: "medium"`. Load writes explicit `null`. No migration is needed because both columns are already nullable. The column DEFAULTs remain for non-pipeline inserts.

### 2. Few-shot examples use placeholders, not plausible values
Example JSON in prompts uses `null` for optional scalars, or obviously placeholder tokens. It must never contain realistic numbers a model could copy.

### 3. Ingredient `category` is a classification, not extracted data
`category` is always assigned by the model or by post-processing. It is never "in the source". A fallback is allowed, but the fallback value is `"other"` rather than `"pantry"`, so the fallback is distinguishable from a real classification. *(Open question for the user: confirm `"other"` is a valid grocery category in the UI grouping.)*

### 4. Uncertainty goes in a top-level `warnings: string[]`
- Add optional `warnings: string[]` to the extracted-recipe schema (`recipe-schema.ts`).
- Prompts tell the model to put illegible, partial, or ambiguous reads here (e.g., `"Ingredient 4 amount partially cut off"`). Never fold them into ingredient names or notes as if they were fact.
- Pipeline stages may also add warnings (e.g., "2 of 3 images failed to upload", "Dropped 1 instruction step as noise").
- `warnings` is **pipeline response metadata**. It is shown on the pre-save recipe card and is not persisted to `recipes` in v1, so it needs no schema migration.

### 5. Inferred values, if ever reintroduced, must be labeled
If a future feature wants estimated times (e.g., "about 30 min"), it must use a separate field or a provenance marker (`{ value, source: "estimated" }`). It must never be written into the extracted field without a label.

## Consequences

### Positive
- Saved recipes are trustworthy: a value present means a value read from the source.
- Removes the prompt self-contradiction behind screenshot fabrication (audit findings #7, #8).
- Gives uncertainty a place to go (audit #11), so the user can fix it in the pre-save card instead of discovering it while cooking.
- One rule for all modalities, which MOP-0035 can then write into the spec.

### Negative
- More recipes will show blank servings, difficulty, and times. Recipe cards, filters, and the dashboard must render null cleanly.
- **Downstream null-safety risk:** meal planner servings scaling, grocery quantity aggregation, and difficulty filters/badges may assume non-null. MOP-0034 must audit these before the transform change ships.
- Existing recipes keep their fabricated defaults. Fixing them retroactively is not possible because provenance was never recorded.
- Recommendation and RAG ranking that use `difficulty` (`preference_difficulty`, migration 035) will match fewer rows. This is acceptable because those matches were spurious.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Keep defaults, add a `defaulted_fields text[]` column | Needs a migration and every reader to check it. Null already carries the meaning. |
| Keep inference, label it in the UI only | The label is lost once the data reaches the DB. Fabricated values then feed ranking and planning. |
| Per-field confidence scores | An 8B VL model cannot produce calibrated confidence, and free-text warnings are more actionable. Revisit if a larger model becomes the default. |
| Image-only fix (leave transform defaults) | Fixes one symptom. URL and text paths still get masked data, and modalities stay inconsistent. |

## Trigger for revisit

- User feedback shows blank servings or difficulty is worse UX than an accurate-but-labeled estimate. If so, reintroduce estimation under §5 (labeled field), not by reverting §1.
- A persisted provenance model is needed (e.g., for an edit-history or "verify recipe" feature). If so, promote `warnings` to a stored column.

## Related

- **MOP:** MOP-0034 (implements §1–§4 for the vision path + transform), MOP-0035 (writes this rule into the per-modality spec)
- **MOP:** MOP-0032 Phase 1 (unit/instruction normalization; amended by MOP-0034 for the ≤3-word filter)
- **Files impacted:** `supabase/functions/_shared/recipe-prompts.ts`, `supabase/functions/_shared/recipe-schema.ts`, `supabase/functions/recipe-pipeline/stages/{extract,transform,load}.ts`, `src/components/chat/StructuredRecipeDisplay.tsx` (warnings display), recipe card/detail components (null rendering)
