# Cooking Bot Knowledge Base

> Persistent knowledge for the `cooking-bot-architect` subagent. Read before designing or implementing any AI capability in MealPrep Agent.

## Navigation

| File | What's in it | Read when |
|---|---|---|
| [architecture-patterns.md](architecture-patterns.md) | Agentic patterns: routing, tool use, orchestrator-workers, evaluator-optimizer, supervisor + specialists. When to use each. | Choosing the shape of a new AI capability. |
| [cooking-domain-ux.md](cooking-domain-ux.md) | UX patterns for cooking bots: confirmation flows, source attribution, progressive disclosure, allergen surfacing, conversation memory. | Designing how the bot speaks and behaves toward the user. |
| [recipe-extraction.md](recipe-extraction.md) | Extraction best practices: schema.org/Recipe, multi-recipe pages, unit normalization, vision/OCR, retry loops. | Working on `recipe-pipeline` or extraction prompts. |
| [safety-and-guardrails.md](safety-and-guardrails.md) | FDA Big 9 allergens, prompt injection categories, output validation, rate limiting, PII, RLS enforcement. | Any change that touches user safety, cost, or auth. |
| [mealprep-context.md](mealprep-context.md) | Current MealPrep architecture: edge functions, RPCs, prompt registry, models, costs. | Always read first to know what already exists. |
| [lessons-learned.md](lessons-learned.md) | Accumulated learning from past tasks. Grows over time. | Read before starting; propose additions after finishing. |

## Reading order for first-time invocations

1. `mealprep-context.md` — know the playing field
2. `architecture-patterns.md` — know the moves
3. The topic-specific file for the task at hand (extraction, UX, safety)
4. `lessons-learned.md` — check for prior relevant decisions

## Sources

The KB cites only real published sources. Citations follow this format: `[Source: Author/Organization, Title, Year]`. Common references:

- **Anthropic, "Building effective agents", 2024** — agentic pattern taxonomy
- **schema.org/Recipe** — structured recipe markup standard
- **FDA, Food Allergen Labeling and Consumer Protection Act (FALCPA)** — the "Big 9" major allergens
- **Nielsen Norman Group** — UX research on confirmation flows, progressive disclosure
- **OWASP LLM Top 10** — prompt injection, output handling, supply chain risks

If a section needs a source it doesn't have, mark it `[citation needed]` and ask the user — do not invent sources.

## Updating the KB

The `cooking-bot-architect` subagent proposes updates after non-trivial tasks. Updates are accepted by the user and applied as separate edits. Direct writes from the agent are not allowed — the KB is human-curated.
