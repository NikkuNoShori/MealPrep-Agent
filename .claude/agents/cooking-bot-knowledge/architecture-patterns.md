# Architecture Patterns for AI Agents

> Patterns the cooking-bot-architect chooses between. Source taxonomy: Anthropic, "Building effective agents" (Schluntz & Zhang, 2024).

## The taxonomy

Six patterns, ordered roughly by complexity. Pick the simplest one that solves the problem.

### 1. Prompt chaining
One LLM call's output feeds the next. Each step is deterministic. No branching.

**Use when:** the task decomposes into a fixed sequence (extract → transform → validate → load).
**MealPrep example:** the existing `recipe-pipeline` is prompt chaining — extract.ts → transform.ts → load.ts.
**Don't use when:** the path depends on input content. That's routing.

### 2. Routing
One LLM call classifies the input, then dispatches to a specialized downstream handler.

**Use when:** distinct input types need distinct prompts (extraction prompt ≠ chat prompt) and the right handler can be picked from input alone.
**MealPrep example:** the current `chat-api` intent detection. Today it routes to one of three handlers (recipe_extraction, rag_search, general_chat).
**Don't use when:** the user's intent shifts mid-message ("find me X and also add Y to the cart") — routing forces you to pick one, which loses the second half.

### 3. Parallelization
Run multiple LLM calls concurrently and aggregate.

**Sub-patterns:** sectioning (split a task into independent pieces) and voting (run the same task N times and vote).
**Use when:** subtasks are independent, or quality benefits from majority vote.
**MealPrep example (potential):** multi-recipe extraction from a page where each recipe extract is independent.
**Don't use when:** the subtasks depend on each other. That's orchestrator-workers.

### 4. Orchestrator-workers
A central LLM dynamically decomposes a task into subtasks, dispatches them to worker LLM calls, and synthesizes the results. Unlike parallelization, the orchestrator decides what the subtasks are at runtime.

**Use when:** the task can't be decomposed in advance — the decomposition depends on the input. Meal planning is the canonical MealPrep example: "plan my week" decomposes differently based on number of household members, dietary restrictions, recipes available, etc.
**MealPrep example (proposed):** Phase 2's planning specialist.
**Don't use when:** the decomposition is known upfront. That's prompt chaining.

### 5. Evaluator-optimizer
One LLM produces output; another evaluates against criteria and feeds back. Loop until criteria met or iteration cap reached.

**Use when:** quality criteria are clear but not always achieved on the first try. Recipe extraction is the canonical case: extract → validate against schema → if invalid, refine with error context.
**MealPrep example (proposed):** Phase 3's extraction retry loop.
**Don't use when:** there are no clear acceptance criteria. The evaluator needs something to evaluate against.

### 6. Agent (autonomous tool use)
A single LLM in a loop, calling tools and receiving results until it decides the task is done.

**Use when:** the task requires multi-step reasoning, tool use, and the steps aren't knowable in advance. This is the "modern agent" pattern.
**MealPrep example (proposed):** Phase 1's tool-using `chat-api`. Tools include search, extract, planner-update, cart-add, etc. Model decides what to call.
**Constraint:** every tool the model can call is a failure surface. Keep the tool catalog tight.

## Decision tree for new MealPrep capabilities

```
Does the task have a fixed sequence?
├─ Yes → prompt chaining
└─ No
   │
   Does input type alone determine the handler?
   ├─ Yes (and no mid-message intent drift) → routing
   └─ No
      │
      Are there clear acceptance criteria the output must meet?
      ├─ Yes, with retries → evaluator-optimizer
      └─ No
         │
         Does the task require multiple tool calls in unknown order?
         ├─ Yes → agent (single agent with tools)
         └─ No
            │
            Can the task be decomposed into independent subtasks?
            ├─ Statically known subtasks → parallelization
            └─ Subtasks discovered at runtime → orchestrator-workers
```

## Supervisor + specialists (composite pattern)

A composite of routing + agent. A supervisor LLM picks which specialist agent to invoke; the specialist runs its own agent loop with a domain-specific tool catalog. Useful when:

- The conversation requires personality (chat) but other capabilities need determinism (extraction).
- Tool catalogs are large enough that splitting them improves model focus.
- Different capabilities use different models (vision for extraction, text-only for chat).

**Cost:** an extra LLM hop per turn (the supervisor). Justify by measurement, not assumption.

## Anti-patterns

| Anti-pattern | Why it's bad |
|---|---|
| One giant system prompt for all capabilities | Prompt rot, tone bleed-through, exceeds reasonable context for complex tasks |
| Tool catalog with 30+ tools | Models hallucinate calls, latency suffers |
| No schema on tool outputs | Downstream parsing errors masquerade as model errors |
| Free-form LLM "delete" with no confirmation | Inevitable disaster |
| Re-implementing patterns library-style instead of just calling LLMs | Adds complexity without value at MealPrep's scale |
| **Tool catalogs based on assumed schema** | Validate tool catalogs against actual DB schema (migrations, not just KB notes) before publishing. Schema-shape mismatches surface as runtime bugs, not design-time errors. *(Source: MOP-0008 design, 2026-06-01 — `meals` was assumed normalized but is JSONB.)* |

## When to use a framework (e.g., LangChain, LlamaIndex)

For MealPrep's scale: don't. Direct LLM calls with explicit prompt strings and explicit tool schemas (the current approach) are simpler, easier to debug, and let you control cost precisely. Frameworks make sense when you have many models, many providers, and many pipelines — none of which MealPrep has.

## References

- Anthropic, "Building effective agents," 2024 — primary taxonomy source
- OpenAI tool calling docs — schema conventions
- Anthropic tool use docs — Claude-specific tool patterns
