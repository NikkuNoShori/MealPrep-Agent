# Lessons Learned

> Accumulated learning from cooking-bot-architect tasks. Grows by user-approved additions only.

## How to add an entry

After completing a non-trivial task, the architect agent proposes an entry. The user reviews, accepts or rejects, and the entry is appended here.

Each entry has this shape:

```markdown
## YYYY-MM-DD — [Short title]

**Task:** What was being designed or built.
**Pattern chosen:** Which architecture pattern.
**What worked:** Specific observation, with file/code reference where relevant.
**What surprised me:** The thing that wasn't in the KB before this task.
**What I'd do differently:** Concrete next-time guidance.
**Open question:** Anything that needs human input before becoming committed knowledge.
**KB sections to update:** Which other KB files should be revised based on this.
```

Entries are immutable once committed — they're a log, not a wiki. If a lesson is later contradicted, add a new entry that supersedes the old one (and note "supersedes 2026-XX-XX entry").

---

## Entries

## 2026-06-01 — Chat tool-use migration design (MOP-0008 Phase 1)

**Task:** Design the replacement of `chat-api`'s single-shot intent router with a tool-using single agent.

**Pattern chosen:** Agent (autonomous tool use) — single agent, 11-tool catalog.

**What worked:**
- Schema-driven tool catalog with `destructive` flag and conditional-destructive ("overwrite-only") variant keeps confirmation logic in one place (the dispatcher), not scattered across handlers.
- Confirmation resumption via `context.confirmAction` bypassing the model entirely is simpler and safer than asking the model to re-emit the same call after "yes" — the model can't drift the args between turns.
- Cutting starter-list tools that imply tables that don't exist (`create_meal_plan_entry` → `assign_recipe_to_meal_plan_slot`; `add_to_grocery_cart` → `add_to_grocery_list`) surfaced that the audit's tool sketch hadn't been schema-checked.

**What surprised me:**
- `meal_plans` stores `meals` + `grocery_list` as JSONB on a single row keyed by date range. Tool catalogs that assume normalized `meal_plan_entries` / `grocery_cart_items` tables will fail. Future audits should validate catalog assumptions against actual migrations before publishing. (Captured as anti-pattern in `architecture-patterns.md`; deferred normalization tracked in MOP-0011.)
- The OpenRouter client had no tool-calling method. The audit identifying tool-use migration as a recommendation didn't catch the gap.
- The KB referenced `_shared/schemas/recipe.ts` but the actual path is `_shared/recipe-schema.ts`. Drift between KB and code. (Fixed in `mealprep-context.md` line 23.)

**What I'd do differently:**
- For Phase 2 design, generate the tool catalog directly from `apiClient` method signatures + DB schema introspection — guarantees catalog reflects reality.
- Add a dispatcher-level invariant: any tool args containing the literal key `user_id` get rejected with a logged warning. Defense-in-depth beyond schema validation.

**Open questions:**
- Is Qwen 2.5 7b reliable enough for multi-tool sequences? Need to run the 30-prompt golden set before declaring the model fixed.
- Should `pendingConfirmation` envelopes persist across sessions (user closes app, reopens, the confirmation is still pending) or expire fast (5 min as designed)? Fast expiry chosen by default; revisit after user testing.

**KB sections updated as part of this entry:**
- `mealprep-context.md` — fixed schema path; added `meal_plans` JSONB shape note with MOP-0011 reference.
- `architecture-patterns.md` — added "tool catalogs based on assumed schema" anti-pattern.
- `safety-and-guardrails.md` — added `<tool_result>` wrapping recommendation.

---

*(Future entries are appended above this line, newest first. Format: see `architect.md` workflow §7.)*
