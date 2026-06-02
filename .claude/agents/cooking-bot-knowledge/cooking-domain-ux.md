# Cooking Bot UX Patterns

> Interaction patterns specific to cooking/recipe chatbots. Sources cited inline.

## The cooking-bot conversation model

A cooking bot is **task-oriented** with **safety-critical** branches. The user is usually trying to accomplish one of:

1. **Find** a recipe (search, suggest, similar)
2. **Capture** a recipe (extract from URL/text/image/video)
3. **Plan** (week, meal, grocery)
4. **Cook** (step-by-step, substitution, timing)
5. **Curate** (edit, delete, rate, collection)
6. **Ask** (general cooking Q&A, technique, nutrition)

Most messages map cleanly to one of these. Multi-intent messages ("find chicken recipes and plan two for next week") need a tool-using agent, not a router.

## Persona

MealPrep uses "Chef Marcus" as the conversational persona. Persona rules:

- **Warm, encouraging, non-condescending.** Cooking is intimidating for many users. Don't moralize.
- **Concise by default.** Default response length is short. Expand on request. (No 800-word essays on the origins of risotto unless asked.)
- **No emojis unless the user uses them first.** Matches the project's CLAUDE.md policy.
- **Source attribution always.** If the bot returns a recipe, it cites where the data came from (URL, "your saved recipe", "extracted from text you pasted").
- **Confidence is honest.** "I think this is gluten-free but check the soy sauce label" beats "This is gluten-free" when there's ambiguity.

## Confirmation flows

Destructive or write actions require an explicit confirmation turn. Pattern:

```
User: "Delete the carbonara recipe"
Bot:  "Found 'Classic Carbonara' from yourcookbook.com (saved Mar 11). Delete it? Reply 'yes' to confirm."
User: "yes"
Bot:  [executes delete via tool, confirms result]
```

Tools that need confirmation:
- `delete_recipe`
- `update_recipe` (anything modifying ingredients/instructions/visibility)
- `remove_meal_plan_entry`
- `clear_grocery_cart`
- Bulk operations of any kind

Tools that **do not** need confirmation (low blast radius, easily reversible):
- `add_to_meal_plan` (single slot)
- `add_to_grocery_cart` (single item)
- `toggle_reaction`
- All read operations

Rationale: confirmation friction is a tax. Charge it only when the cost of accidental execution is high. Cathy Pearl's *Designing Voice User Interfaces* (O'Reilly, 2016) frames this as the asymmetry between "annoyance of an extra turn" and "cost of an undo".

## Progressive disclosure

Don't dump full recipe content in chat. Pattern:

1. **Summary card** — title, source, prep+cook time, key tags, ingredient count. Optional thumbnail.
2. **Expand on click** — full ingredients, instructions, notes.
3. **Cook mode** — step-by-step with timers, one screen per step.

Same for search results: top 3-5 summaries, "show more" expands. Long lists fatigue the user and obscure the top result. Source: Nielsen Norman Group, "Progressive Disclosure" (Nielsen, 2006).

## Source attribution

Every extracted recipe shows:
- The source URL (clickable)
- The extraction confidence (if low, surface it)
- The original author/site name
- Date extracted

Why: cooking is high-trust. Users want to verify a recipe came from a source they trust (a chef they follow, a tested-recipe site). Anonymous recipes erode trust.

## Allergen and dietary surfacing

Critical: **allergen warnings appear before the recipe content**, not buried in a tags list.

Pattern for a recipe containing a household allergen:
```
⚠ Contains peanuts — flagged for [child name]'s allergy

[Recipe summary card]
```

Pattern for ambiguous content (uncertain whether an ingredient is an allergen):
```
⚠ May contain shellfish (uncertain — verify "fish sauce" ingredient)
```

The dietary tags (vegan, gluten-free, etc.) appear in the card but **are not** safety claims. A "gluten-free" tag does not absolve the user from checking. State this when the user asks.

Sources:
- FDA, Food Allergen Labeling and Consumer Protection Act (FALCPA), 2004 — defines the major allergens.
- FDA, FASTER Act, 2021 — added sesame to the major allergens (now the "Big 9").

## Substitution suggestions

When a user asks "what can I sub for X?":
1. Return 2–4 substitutions, ranked by closeness to the original.
2. For each, note what it changes (flavor, texture, structural role in the recipe).
3. If the user has dietary restrictions, prefer subs that fit them.
4. If the recipe context is provided, mention if the sub affects another step (e.g., "Greek yogurt instead of sour cream — won't curdle in baking applications").

Don't return one substitution without options. Cooking subs are contextual; the user picks.

## Memory and context

A cooking bot needs three layers of memory:

| Layer | Lifetime | What's in it | Storage |
|---|---|---|---|
| Turn context | Current message | What the user just said | LLM input |
| Conversation context | Current session | Recent messages, recipes referenced, current goal | `conversation_messages` table |
| Long-term preferences | Permanent | Dietary restrictions, allergies, household, reactions history, "I don't like cilantro" | `profiles`, `family_members`, `recipe_reactions` |

The bot should reference long-term preferences without being asked ("I noticed you don't usually save fish recipes — want to filter those out?"). But it should not surface them performatively every turn — that's creepy. Reference them when relevant to the current task.

## Error recovery

When something fails:
- **Extraction failed:** offer alternatives ("That URL didn't have structured recipe data. Want me to try OCR on a screenshot, or paste the recipe text?")
- **Search returned nothing:** suggest broader search ("No matches for 'Korean kimchi tacos'. Want to search for 'Korean tacos' or 'kimchi' separately?")
- **Tool errored:** apologize briefly, offer next action. Do not retry silently — the user needs to know.

Never just say "An error occurred." Say what happened and what the user can do.

## Voice and tone examples

| User says | Bot replies (good) | Bot replies (bad) |
|---|---|---|
| "Add chicken parm to Tuesday" | "Added 'Chicken Parmesan' to Tuesday dinner. Want me to add ingredients to the cart?" | "Successfully added recipe with ID a8f3-… to meal plan." |
| "What's in the carbonara?" | "Spaghetti carbonara from yourcookbook.com (saved Mar 11). Want the full ingredient list?" | "Here are all 17 ingredients: …" *(dumps full list)* |
| "Delete the lasagna" | "Found 'Vegetable Lasagna' — delete it? Reply yes." | *(deletes immediately)* |
| "Can I make this dairy-free?" | "Yes, swap the ricotta for cashew cream (1:1) and the mozzarella for a dairy-free mozz. The texture will be a bit looser — increase baking time by ~5 minutes." | "Here are 12 dairy-free substitutions…" |

## Anti-patterns

- **Anthropomorphizing the bot too far.** "I love a good carbonara!" is uncanny. The bot is a tool, not a person.
- **Hedging on safety.** "Some people are allergic to peanuts" is wrong. Either the household has the allergy logged or not.
- **Dumping data.** Long lists, long recipes, long search results — without progressive disclosure — exhaust the user.
- **Silent retries.** If extraction failed twice, tell the user. Don't pretend it succeeded after a partial.
- **Confirmation fatigue.** Every read-only action does not need a confirmation. Asymmetric friction.

## References

- Cathy Pearl, *Designing Voice User Interfaces*, O'Reilly, 2016 — confirmation flow asymmetry, persona design
- Nielsen, J., *Progressive Disclosure*, Nielsen Norman Group, 2006
- FDA, FALCPA (2004) + FASTER Act (2021) — Big 9 allergens
- schema.org/Recipe — source attribution fields
