# MOP-0042: Guided Onboarding Tour

| Field | Value |
|-------|-------|
| **MOP** | MOP-0042 |
| **Title** | Guided Onboarding Tour |
| **Date Submitted** | 2026-10-30 |
| **Date Updated** | 2026-10-30 (revised after `qa-auditor` plan review — 3 blocking gaps resolved; Phase 6 scoped to Household + Sharing/Visibility + Chat tours per user decision; 2 bugs found during Phase 6 scoping triaged to MOP-0044/ADR-0010 and MOP-0045) |
| **Date Completed** | — |
| **Submitted By** | Nick Neal |
| **Status** | draft |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md). Valid values: `draft` / `evaluation` / `approved` / `planned` / `in_progress` / `verifying` / `complete` / `blocked` / `cancelled` / `deferred`.

---

## Summary

A step-by-step guided product tour that spotlights key UI elements across the Recipes and Meal Planner pages (and possibly others), dimming everything except the highlighted element at each step. Shows automatically on a user's first login, and is re-launchable on demand via a persistent bottom-right "?" button that can be collapsed into a slim re-expand tab when not needed. No onboarding/tour infrastructure exists anywhere in the codebase today — this is a net-new, greenfield feature (confirmed via codebase survey 2026-10-30).

---

## Scope Map

> File globs that identify the territory this MOP touches. Used by `/post-change-check` (MOP-0010) to route post-merge verification.

```
src/components/tour/**
src/pages/Recipes.tsx
src/components/recipes/RecipeList.tsx
src/components/recipes/CollectionsSidebar.tsx
src/components/recipes/RecipeDetail.tsx
src/pages/MealPlanner.tsx
src/pages/Household.tsx
src/pages/Settings.tsx
src/pages/CompleteSetup.tsx
src/components/chat/ChatInterface.tsx
src/components/common/Layout.tsx
src/stores/authStore.ts
e2e/onboarding-tour.spec.ts
```

> `src/pages/Dashboard.tsx` was in an earlier draft of this map (when Phase 5's first-login design was still a per-signup Dashboard moment) and is removed — the resolved design (Design decisions above) never auto-launches anything on Dashboard, and the confirmed Phase 6 scope explicitly excludes a Dashboard tour. `src/pages/Settings.tsx` is referenced only by Phase 6's "Sharing & visibility" tour as a text-only, non-spotlighted step — no Settings tour exists.

> `src/hooks/useLocalToggle.ts` is referenced for its sync-mechanism pattern (Design decisions above) but not modified — `useTourState` is a new, separate hook, not an extension of it. Not listed as a scope-map target since nothing in this MOP edits that file.

---

## Scope of Work

**Design decisions (reviewed by `qa-auditor` 2026-10-30 against the real codebase — see Notes §Review findings for the full critique this section resolves):**
- **Multiple short, section-scoped tours, not one long cross-page tour.** A "Recipes tour" and a "Meal Planner tour" (and optionally a "Chat tour"), each self-contained to its own route. The "?" launcher is context-aware: it offers whichever tour matches the current page, plus a way to see/replay any tour. This avoids a tour "waiting" across a route navigation, lets a user finish one page's tour and bail without losing a 20-step thread, and keeps each tour short enough to not feel like a chore. State becomes one "seen" flag per tour (e.g. `recipes`, `mealPlanner`), not one global flag.
- **First-login behavior (resolved by user 2026-10-30): no separate Dashboard welcome tour.** Each page's tour auto-launches the first time that user visits that page (per-tour "seen" flag, checked on mount) — not a single "first login" moment tied to signup. This is simpler to implement, naturally covers existing users who signed up before this feature shipped (no backfill needed), and avoids needing a Dashboard-specific tour just to have *something* fire at the literal first-login moment.
- **State storage: localStorage via a new `useTourState` hook, user-scoped.** Not a server-persisted `profiles` column — a tour re-showing after a user switches devices is low-stakes (worst case: they see a tour again and dismiss it), whereas a DB column requires a migration only the user can deploy (HARD RULE). **Not a direct reuse of `useLocalToggle`** (see T1 in Notes — its `toggle()`-only API isn't idempotent, its `defaultOn=true` model is backwards for "seen" state, and it's one-hook-per-key, which doesn't fit a data-driven list of tours). `useTourState` reuses only `useLocalToggle`'s *sync mechanism* (custom window event + native `storage` event) but stores a single JSON map under one user-scoped key (e.g. `mealprep:tours:${userId}` → `{ recipes: true, mealPlanner: false }`), exposing `isSeen(id)`, `markSeen(id)` (idempotent), `resetSeen(id)`. Side effects (localStorage write + event dispatch) run outside any state updater, not inside one (avoids a real `React.StrictMode` double-invoke bug `useLocalToggle` itself has — not to be copied).
- **Spotlight mechanism: the cutout IS the dimming layer — no separate full scrim.** A `box-shadow: 0 0 0 9999px var(--rs-overlay)` ring positioned over the live target via `getBoundingClientRect()` dims everything outside the target by itself; layering a second full-viewport `.modal-backdrop` underneath it would double-dim and adds nothing. No `backdrop-blur` on this layer (every existing `.modal-backdrop` use pairs it with blur, but a blur can't have a hole in it — reuse only the `--rs-overlay` color token, not the usual class combination). A separate, invisible full-viewport click-shield (`pointer-events: auto`) sits below the ring and blocks interaction with the live page outside the spotlighted element; clicking inside the cutout area advances to the next step (does not forward the click to the real underlying element — clicking the real "New Plan" button mid-tour must not open the create form underneath the overlay).
- **Targeting mechanism: `data-tour-id="<id>"` attributes on real DOM elements, resolved by the engine at each step to the first matching element with a non-zero rendered rect that also overlaps the viewport** (via `checkVisibility()`/`getClientRects().length` **plus** an explicit intersection check against `window.innerWidth`/`innerHeight`), not a bare `document.querySelector` and not `checkVisibility()` alone. `checkVisibility()`/a non-zero rect is not sufficient on its own: a collapsed mobile drawer in this app (confirmed on the Chat page's own conversation sidebar, `ChatInterface.tsx` — collapsed state is `-translate-x-full`, not `display:none` or `width:0`) still has a full-size bounding box, just transformed off-screen, so a naive visibility check would spotlight empty space. Multiple elements can share the same `data-tour-id` (e.g. a desktop-pinned instance and a mobile-drawer instance of the same conceptual control) — the engine picks whichever one is actually visible **and on-screen** at the current viewport, and a step may declare fallback ids for cases where the "main" instance isn't in the DOM at all on mobile (e.g. the Collections sidebar step falls back to the mobile "Collections & Filters" toggle button when the drawer itself isn't open). Chosen over a ref-registry (no context/provider wiring into every target component) and over coordinates-by-component-name (too brittle to refactors).
- **Step preconditions and empty-state handling are part of the core engine (Phase 1), not bolted on per-page.** A brand-new user has no recipes, no meal plan, and conditionally-rendered tab content — most Meal Planner targets (view switcher, randomizer, plan-switching) literally don't exist in the DOM until a plan exists. Every step declares what it needs (e.g. `requiresActivePlan`, `requiresTab: 'calendar'`) and the engine can run a `prepare` step (switch the active tab, wait for loading to finish) before measuring the target. When a precondition genuinely can't be met (no active plan to show the randomizer on), the step falls back to an "explainer" variant anchored to the empty-state CTA or the New Plan button, describing the feature in text rather than silently skipping it — a silently-skipped step would cut the Meal Planner tour down to just New Plan + Grocery + History for every brand-new user, which is most of the audience this feature exists for.

### Phase 1: Core tour engine (no page wiring yet)
**Files affected:** `src/hooks/useTourState.ts` (new), `src/components/tour/TourOverlay.tsx` (new), `src/components/tour/TourSpotlight.tsx` (new), `src/components/tour/TourTooltip.tsx` (new), `src/components/tour/tourClamp.ts` (new), `src/components/tour/types.ts` (new), `src/components/tour/tourDefinitions.ts` (new, empty/stub tours only), `src/components/tour/__tests__/**` (new)

Build the reusable engine with no real content yet, so it can be tested in isolation before any page integration:
- `useTourState`: see the state-storage design decision above (user-scoped JSON map, `isSeen`/`markSeen`/`resetSeen`, idempotent, side effects outside the updater).
- `TourOverlay`: rendered via `createPortal(document.body)` as a sibling of `<main>`, **not** nested inside page content — `Layout.tsx`'s `<main>` is `relative z-10`, its own stacking context, so anything inside it is capped below the Header (`relative z-20`) regardless of its own z-index number. A portal is required for "renders above everything" to actually mean that. Owns current-step state, "Next"/"Back"/"Skip"/"Close" controls.
  - Marks the tour seen (`markSeen`) on Finish, Skip, **and** Escape — all three are equivalent "I'm done with this" signals. Only the "?" launcher replays an already-seen tour.
  - Closes (without crashing, decide whether to also `markSeen`) on any route change — subscribe to the router's location so a back-button press, a nav-link click, or opening the mobile menu mid-tour doesn't leave a dangling overlay pointed at a now-unmounted target.
  - Accessibility, modeled on `ConfirmDialog.tsx`'s existing pattern (`role="alertdialog"`, focus trap, Escape-to-close) rather than inventing a separate standard: tooltip is `role="dialog" aria-modal="true"` with `aria-labelledby`/`aria-describedby`; focus moves to the tooltip's primary button on each step and is trapped within it (Tab/Shift+Tab); a visually-hidden `aria-live="polite"` "Step N of M" announcement; focus returns to the previously-focused element (or the launcher) on close; the spotlight ring itself is `aria-hidden`; honor `prefers-reduced-motion` for any `scrollIntoView`/transition; the Escape handler must not also close an underlying dialog if one happens to be open (single active keydown handler, not a cascade).
- `TourSpotlight`: the click-shield + box-shadow cutout ring described in the spotlight design decision above. Before measuring each step's target: resolve to the first visible instance per the targeting design decision (including fallback ids), call `target.scrollIntoView({ block: 'center' })`, then measure after scroll settles. Re-measure on: `ResizeObserver` on the target element itself, a `scroll` listener on `document` with `{capture: true}` (needed because `window` never scrolls in this app — `html`/`body`/`#root` are `overflow:hidden` at a fixed viewport height per the sealed-height-chain pattern, so `<main>` and any nested scroller are what actually move), `window` `resize`, and `visualViewport` `resize`/`scroll` (covers mobile address-bar show/hide, on-screen keyboard, and rotation — all three have been live, confirmed bugs on this project this session). If a step's target still can't be resolved after precondition handling (see the design decision above), fall back to the explainer variant rather than crashing on a null measurement.
- `TourTooltip`: the step's text/title/"Next" button, positioned adjacent to the spotlighted element. Edge-clamping (keep the tooltip on-screen when the target is near a viewport edge, flip above/below/left/right based on available space) is **net-new work** — no existing component in this app does real viewport-aware popover placement to reuse (the app's existing "popovers" are plain `absolute` positioning with no clamp math). Implemented as a small dedicated `tourClamp.ts` helper with its own unit tests, not copied from an existing pattern that doesn't actually exist.
- `tourDefinitions.ts`: a typed array-of-steps format (`{ id, targetSelector, fallbackSelectors?, title, body, tour, requiresActivePlan?, requiresTab? }[]` grouped by tour id) that Phase 3/4 will populate with real content — kept data-only so content edits never require touching the engine.
- Unit tests (jsdom has no real layout engine — `getBoundingClientRect`/`ResizeObserver` must be mocked, so these test *logic*, not real geometry; real geometry is covered by the Phase 1 E2E spec below): `useTourState.markSeen` is idempotent and user-scoped; multiple mounted instances stay in sync; step-resolution picks the visible instance among duplicates and falls back correctly; step-resolution **rejects an off-screen-but-sized element** (e.g. a mocked rect with `left: -9999` or a transform placing it outside `innerWidth`/`innerHeight`) and falls back correctly — found 2026-10-30 against the Chat page's collapsed mobile sidebar, which is `-translate-x-full` rather than `display:none`; Next/Back/Skip/Escape transitions; last-step shows a "Done" state instead of advancing past the end; `tourClamp` flips/clamps correctly at each viewport edge.
- Z-index: engine components reserve `z-[300]`+ — necessary but not sufficient on its own (see the portal requirement above; a number alone doesn't escape a parent stacking context).

### Phase 2: Launcher widget — "?" button + collapse/reopen tab
**Files affected:** `src/components/tour/TourLauncher.tsx` (new), `src/components/common/Layout.tsx`, `src/components/chat/ChatInterface.tsx`

> Finalize this phase's menu-vs-direct-start UX after Phase 3/4 produce a real tour list — a single-tour-per-page app needs no menu, a multi-tour page does. Build the collapse/expand mechanics (second bullet below) first since those don't depend on that count.

- Fixed bottom-right "?" button, rendered inside `Layout.tsx` (confirmed clear screen real estate for every page **except** Chat — see the Chat-specific bullet below) so it's present on every authenticated page without per-page wiring.
- Click opens a small menu/picker if more than one tour is available for the current route (or starts the current page's tour directly if there's exactly one).
- "Close" collapses the full button down to a slim vertical tab fixed to the right edge of the viewport with a single arrow icon; clicking the tab re-expands the full "?" button. Both the collapsed and expanded states persist via the same `useTourState` localStorage mechanism (a third, UI-chrome-only flag, separate from "has seen tour X" content state) so a user's collapse choice survives a page reload. Offset by `env(safe-area-inset-bottom)` (this project already added `viewport-fit=cover` to the viewport meta tag for the chat composer fix, so the inset is live) so it doesn't sit under a phone's home-indicator gesture area.
- **Chat page is a special case.** `ChatInterface.tsx` already fights for every pixel of vertical space at the bottom of the viewport (this session fixed multiple real bugs where the composer/send button were clipped or invisible on mobile) — a bottom-right "?" button there risks covering the composer or send button. Either hide the launcher on `/chat` specifically, or raise it above the composer's top edge on that route only. Verify no overlap with the send button and, on mobile, with the chat sidebar drawer at a 375px viewport width before shipping.
- Does not render on unauthenticated routes (`/`, `/signin`, etc.) — gated the same way other authenticated-only chrome is gated (`ProtectedRoute`/`Layout` placement already achieves this by construction, since it's not rendered on the public landing page per `CLAUDE.md`'s note that `LandingPage` renders outside `Layout`).

### Phase 3: Recipes page tour content
**Files affected:** `src/components/tour/tourDefinitions.ts`, `src/pages/Recipes.tsx`, `src/components/recipes/RecipeList.tsx`, `src/components/recipes/CollectionsSidebar.tsx`

Add `data-tour-id` attributes (same id value on both desktop and mobile variants of the same conceptual control, per the targeting design decision above — the engine resolves to whichever is actually visible) to the confirmed anchor points (survey 2026-10-30, re-verify line numbers at implementation time — code moves) and author the step content:
1. Add Recipe button (`RecipeList.tsx` toolbar instance — the empty-state instance doesn't need its own tour step, same element conceptually). Also handles the "no recipes yet" case naturally, since the empty state already shows an Add Recipe CTA.
2. Collections sidebar panel (`CollectionsSidebar.tsx`, desktop-pinned instance) — **with a fallback id pointing at the mobile "Collections & Filters" toggle button** (`Recipes.tsx`, below the `lg` breakpoint), since the mobile drawer itself is conditionally rendered and isn't in the DOM at all until a user opens it. On mobile the step spotlights the toggle button that opens the drawer, not the drawer's contents.
3. Search/filter controls + view-mode toggle + card-display-options (`RecipeSearch` + adjacent toolbar controls in `RecipeList.tsx`)
4. Also handle: `RecipeList.tsx` returns a loading skeleton or an error state *instead of* the toolbar while recipes are loading/failed — the tour must wait for a settled, non-loading, non-error state before it can target anything on this page, same precondition mechanism as Phase 4's `requiresActivePlan`.

Auto-launches the first time this account visits `/recipes` (per the first-login design decision above) — not tied to signup specifically.

### Phase 4: Meal Planner page tour content
**Files affected:** `src/components/tour/tourDefinitions.ts`, `src/pages/MealPlanner.tsx`

**This is the highest-risk phase — a brand-new user (the primary audience for this feature) has no meal plan at all, and most of the requested anchors live inside conditionally-rendered tab/plan content that doesn't exist in the DOM until a plan exists.** Specifically (confirmed 2026-10-30 review): the whole toolbar — `WeekLabelDropdown`, the Suggest button, the view-switcher — only renders when there's an active plan or one is loading; a zero-plan account gets the empty state instead. The randomizer buttons live inside the calendar tab's content, which the project's `Tabs` implementation unmounts entirely (returns `null`) when a different tab is active. The per-slot randomizer buttons are additionally `md:opacity-0` (hover-reveal) on desktop, meaning even when they exist in the DOM, the engine would be spotlighting an invisible 10px icon by default.

Add `data-tour-id` attributes and author steps for, each with an explicit precondition per the Phase 1 design:
1. New Plan button — works for every account state, including zero-plan (it's the empty state's own CTA). No precondition needed.
2. View switcher (the 3 calendar-view icon buttons) — **one step per view (days/meals/titles)**, switching `calendarView` as part of each step via the `prepare` hook, rather than one step covering all three silently. Requires an active plan and the calendar tab active (`prepare`: switch to the calendar tab if not already there).
3. Randomizer — requires an active plan + calendar tab active. Add a tour-active CSS state (e.g. a `[data-tour-active]` class on the engine root that the per-slot randomizer's existing hover-reveal selector also matches) so the normally-hover-only button is visible while spotlighted, instead of highlighting something the user can't see. Covers the per-slot button, the per-day button, and the "Suggest"/Sparkles button opening `SuggestWeekModal` — as one combined step or a short sub-sequence, content decision made during authoring.
4. Plan-switching (`WeekLabelDropdown`) — requires an active plan.
5. Grocery tab — works regardless of plan state (the tab trigger itself always renders); `prepare` switches to it so its content is actually mounted before the next step measures anything there.
6. History tab — same as Grocery.

**Zero-plan fallback:** for any step above that requires an active plan and none exists, fall back to an explainer step anchored to the New Plan button (or the empty state generally) describing what that feature does in text, rather than silently skipping the step — silently skipping would reduce a brand-new user's Meal Planner tour to just "New Plan + Grocery + History," missing most of what was actually requested.

`GroceryCart.tsx` and `MealPlanHistory.tsx` internals were not read during the original survey (MealPlanner.tsx is 1716 lines; tab content renders past the surveyed range) — confirm whether the tour step for Grocery/History just points at the tab trigger (simplest, matches the user's literal request) or needs a deeper anchor inside the tab content itself before finalizing step content.

Auto-launches the first time this account visits `/meal-planner` (per the first-login design decision above). Author and manually verify this tour against **both** a zero-data test account and a populated one — the zero-data path is not an edge case for this feature, it's the primary path for the audience it's built for.

### Phase 5: User-scoped state verification + household/multi-account check
**Files affected:** `src/hooks/useTourState.ts`, `src/components/tour/__tests__/useTourState.test.ts`

The per-page-first-visit auto-launch itself is built into Phases 3/4 (each tour checks its own `isSeen` flag on mount and `markSeen`s on Finish/Skip/Escape/route-change — see Phase 1's `TourOverlay` and the design decision above), so this phase is narrowly about getting the storage key right rather than new UI:
- Confirm `useTourState`'s storage key includes the authenticated user's id (from `authStore`), not just a bare key like `tour-recipes-seen` — a bare key is per-*browser*, not per-*account*, so a second household member signing into the same shared device would never see their own first-visit tour (their partner already marked it seen). This matters concretely for this project: it's actively used by a two-person household on shared devices (confirmed this session).
- Unit test: two different `user.id` values produce independent seen-state for the same tour id on the same `localStorage` instance.

### Phase 6: Household, Sharing & Visibility, and Chat tours
**Files affected:** `src/components/tour/tourDefinitions.ts`, `src/pages/Household.tsx`, `src/pages/Recipes.tsx`, `src/components/recipes/CollectionsSidebar.tsx`, `src/components/chat/ChatInterface.tsx`

User confirmed 2026-10-30: Household + sharing/visibility **yes**, Chat **yes**, Dashboard **no** (not necessary), Settings **no**. Scoped via `household-sme` survey, same date, against the real codebase — see Notes §Phase 6 scoping findings for full detail. Three tours, not two:

**6a. Household tour, on `/household` (new tour id: `household`).** Auto-launches on first visit to `/household`, same mechanism as Phases 3/4.

> **Blocked on MOP-0044 Phase 1 (migration giving `get_my_household`/`get_household_recipes`/`get_dashboard_stats` a deterministic order), per `surface-reviewer` triage 2026-10-30.** Do not ship step 2's "visible to everyone listed here" copy before that migration deploys — it is currently false for any user with more than one household membership (confirmed live for this project's own second household member). Either sequence Phase 6a after MOP-0044 Phase 1 ships, or ship with the softened "people in your household" wording from the start regardless of MOP-0044's status (safe either way, just less precise pre-fix).

1. Page header — always rendered, no precondition. Orientation: what a household is.
2. Members card — always rendered (every account auto-gets a one-person household at minimum). Copy must say "people in your household" rather than an absolute claim like "everyone listed here" until MOP-0044 ships — see the blocking note above.
3. Invite field — only rendered for the owner/admin role (`canInvite`). Non-owners get an explainer fallback anchored to the Members card instead of a dead spotlight.
4. Pending invites — outgoing invites are part of the Members card (point at the card, not individual rows); incoming invites render as a conditional banner only when one exists — this step is skipped entirely, not shown as a dead/empty spotlight, when there are none.
5. Closing step: points the user toward `/recipes` (for per-recipe visibility, covered next) and Settings (for the default-visibility preference) rather than trying to explain everything on this one page.

Precondition risk here is low (every account has at least a solo household by construction) — the risk in this tour is **copy accuracy**, not missing anchors (see MOP-0044 above).

**6b. "Sharing & visibility" tour, on `/recipes` (new tour id: `recipesSharing`), a *second* tour on a page that already has the Phase 3 Recipes tour.** Started from the "?" launcher's tour picker once both exist (confirms Phase 2's "menu when more than one tour is available for the current route" branch is actually needed, not hypothetical) — or auto-launches on first visit only after the Phase 3 Recipes tour has already been seen, so a brand-new user isn't shown two competing auto-popups on the same page load. Decide the exact trigger ordering during implementation; either is consistent with the engine as designed.
1. Browse feeds (All / My Recipes / Household / Shared with me / Public, `CollectionsSidebar.tsx`) — one tour id for the button group, with the mobile "Collections & Filters" toggle fallback, same pattern as Phase 3 step 2.
2. **Text-only explainer** of what each visibility level means (reuse `VisibilityPicker.tsx`'s own copy: "Only you" / "your household members" / "everyone"), anchored to the sidebar or the recipe grid generally. **Do not spotlight the per-recipe visibility picker itself** — it's rendered for non-owners too and a known UI bug (tracked in the enhancement-backlog memory file, not yet promoted to its own MOP) shows a false "success" toast if a non-owner's change silently no-ops; a tour spotlighting it risks demonstrating the bug rather than the feature. Mention in the copy that the picker lives on each recipe's detail page, without spotlighting it directly.
3. "Shared with me" — explains direct recipe-to-person sharing as a distinct mechanism from visibility levels.
4. Default visibility in Settings — cross-route, so text-only (no spotlight possible without navigating away mid-tour). **Word as "recipes saved through the recipe pipeline" rather than "all newly saved recipes" until MOP-0045 ships** (per `surface-reviewer` triage 2026-10-30: the setting is currently honored only by the two server-side pipeline save paths, not the chat-save card, batch import, or manual entry — MOP-0045 fixes this). Not a hard blocker on this phase the way MOP-0044 blocks 6a's wording — the softened phrasing is accurate either way and doesn't need to wait.

**6c. Chat tour, on `/chat` (new tour id: `chat`), 4-5 steps.** Auto-launches on first visit to `/chat`.
1. The two starter buttons ("Add new recipe" / "Questions about recipes") — these demonstrate the extract-vs-ask distinction better than any copy could, and only exist pre-first-message (see precondition note below).
2. The composer textarea — paste a URL, paste recipe text, paste an image (clipboard paste attaches it), or ask a cooking question directly; Shift+Enter for a new line.
3. The image/video upload button — photos of a recipe or a saved recipe video.
4. The batch-import button — importing several recipe URLs in one pass.
5. New Chat / conversation history — desktop targets the New Chat button directly; mobile falls back to the sidebar-toggle button (same fallback-id pattern used elsewhere). Closing step is text-only: an extracted recipe appears as an editable card with its own Save button and visibility picker (same caveats as 6b step 2/4 apply to this card too — don't spotlight it, describe it).

**Chat-specific precondition risks (distinct from Phases 3/4's empty-state problem — this one is *easier*, not harder):** every chat load starts a fresh, empty conversation by default, so the starter buttons (step 1) are a reliable anchor on a true first visit — the opposite of Meal Planner's problem. But a **replay** from the "?" launcher mid-conversation unmounts the starter buttons entirely; step 1 needs a fallback anchored to the composer with the same explanation in text instead of a dead spotlight. Also: the batch-import panel stays mounted (`display:none`) rather than unmounting when closed — if any future step needs to target something inside it, it needs an explicit `prepare` to open it first; this phase's own steps only ever target the toolbar button, so it doesn't hit that case, but it's a trap for anyone extending this tour later.

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | Phase 1 — core tour engine | Large | High (blocks every other phase) |
| P0 | Phase 2 — launcher widget (?/collapse tab) | Medium | High (the only way to re-trigger a tour on demand; user explicitly specified this UX) |
| P1 | Phase 3 — Recipes tour content | Small | High (user explicitly requested this page first) |
| P1 | Phase 4 — Meal Planner tour content | Large (empty-state/precondition handling for nearly every step, not just content authoring — see Phase 4 detail) | High (user explicitly requested this page; this is where most first-time users will actually see the tour, since it's the zero-data default state) |
| P1 | Phase 5 — user-scoped state verification | Small | High (without it, a second household member on a shared device never gets their own first-visit tour — concretely relevant, this project has an active two-person household on shared devices) |
| P2 | Phase 6 — Household, Sharing & Visibility, and Chat tours | Large (3 tours, one of them a second tour on an already-tour'd page which exercises Phase 2's picker-menu branch; Household tour step 2's wording is gated on MOP-0044, see below) | Medium-High (user confirmed scope 2026-10-30; the sharing/visibility tour directly targets the exact confusion that produced a real user-reported bug earlier this session, raising its value above a typical "nice to have") |

**Sequencing note:** Phase 2's menu-vs-direct-start launcher UX can't be finalized until Phase 3/4 settle the real tour count, so build Phase 2's collapse/expand mechanics first and its menu logic last. Phase 1 must include the step-precondition/`prepare`/fallback-id mechanism described in its own section below — Phases 3 and 4 depend on it existing, it is not separable "polish" added after the fact. **Phase 6a (Household tour) should sequence after MOP-0044 Phase 1 ships**, or ship with the softened "people in your household" copy from the start regardless (per `surface-reviewer` triage 2026-10-30) — see Phase 6a's own blocking note.

---

## Verification

> **Lockticket acceptance criteria.** See [MOP_VERIFICATION_POLICY.md](../prompts/MOP_VERIFICATION_POLICY.md) — **`type: human` is forbidden** (blocks `complete`). Route domain tests via [DOMAIN_TEST_MATRIX.md](../prompts/DOMAIN_TEST_MATRIX.md). Run `/integrity-check` then `/verify-mop MOP-0042`.

```yaml
verification:
  - id: lint-clean
    type: command
    run: npm run lint
    expect_exit: 0

  - id: build-clean
    type: command
    run: npm run build
    expect_exit: 0

  - id: unit-tests
    type: command
    run: npm run test:run
    expect_exit: 0

  - id: tour-hook-exists
    type: file-exists
    path: src/hooks/useTourState.ts

  - id: tour-engine-exists
    type: file-exists
    path: src/components/tour/TourOverlay.tsx

  - id: tour-launcher-exists
    type: file-exists
    path: src/components/tour/TourLauncher.tsx

  - id: tour-definitions-exist
    type: file-exists
    path: src/components/tour/tourDefinitions.ts

  - id: no-tour-zindex-conflict
    type: command
    # Point-in-time grep: confirms no non-tour file claims z-[300]+,
    # consistent with the 2026-10-30 survey baseline (highest prior
    # usage: z-[200]). A number alone doesn't prove top-layer rendering
    # (the tour overlay is portaled specifically to escape a parent
    # stacking context -- see Phase 1) -- the real "renders above
    # everything" guarantee is asserted by e2e-onboarding-tour below,
    # this check only catches an accidental regression in the number.
    run: "! grep -rE \"z-\\[(3[0-9]{2}|[4-9][0-9]{2}|[0-9]{4,})\\]\" src --include='*.tsx' --include='*.ts' -l | grep -v '^src/components/tour/'"
    expect_exit: 0

  - id: tour-engine-unit-tests
    type: command
    # Includes tourTargets.test.ts, which replaces what would otherwise be
    # a bare grep (passes with one stray attribute anywhere in the file,
    # proves nothing about correctness): it imports tourDefinitions, reads
    # the actual target files, and asserts every step's targetSelector
    # (and each fallbackSelector) literally appears as a
    # data-tour-id="<id>" in the source -- catches drift when a future
    # refactor renames or removes an anchor element. Also includes
    # useTourState's idempotency/user-scoping tests and tourClamp's
    # edge-clamping tests.
    run: npm run test:run -- src/components/tour/__tests__/
    expect_exit: 0

  - id: e2e-onboarding-tour
    type: command
    # Covers what a unit test can't: jsdom has no real layout engine
    # (no getBoundingClientRect geometry, no ResizeObserver), so spotlight
    # positioning, the click-shield actually blocking the underlying page,
    # and "renders above every other UI layer" can only be verified against
    # a real rendered page. Playwright is already set up in this project
    # (e2e/*.spec.ts, npm run test:e2e).
    run: npx playwright test e2e/onboarding-tour.spec.ts
    expect_exit: 0

  - id: recipes-domain-suite
    type: command
    run: npm run test:run -- src/components/recipes/__tests__
    expect_exit: 0

  - id: api-domain-suite
    type: command
    run: npm run test:run -- src/services/__tests__/api.test.ts
    expect_exit: 0
```

The E2E spec (`e2e/onboarding-tour.spec.ts`, written during Phase 1/3/4, **extended during Phase 6**) must cover, at both a desktop (1280px) and mobile (375px) viewport: clearing localStorage then auto-launch on first visit to `/recipes`, `/meal-planner`, `/household`, and `/chat`; the spotlighted element's bounding box sits inside the visible cutout and an element outside it cannot be clicked (click-shield assertion); Next advances through every step to a final "Done" state; a page reload after Finish does not re-launch the tour; the "?" launcher replays a finished tour on demand; launcher collapse/expand persists across a reload; opening an existing modal (e.g. `SuggestWeekModal`) then launching the tour asserts the tour's tooltip is on top via `elementFromPoint`; **Phase 6 additions:** the "?" launcher shows a tour picker specifically on `/recipes` (the only two-tour route) rather than direct-starting; on mobile, the Chat tour's step targeting the collapsed sidebar resolves to the visible fallback, not an off-screen element (regression test for the finding that drove the Phase 1 targeting fix above); replaying the Chat tour mid-conversation (starter buttons unmounted) falls back correctly instead of erroring.

Allowed assertion types: `file-exists`, `grep`, `command`, `test-passes`. **Not allowed:** `human`.

## Manual Follow-up (non-blocking)

> Optional human review **after** `complete`. Never gates status.

- [ ] Walk through both tours on a real physical phone (iOS Safari and Android Chrome specifically — this project has repeatedly found viewport/layout bugs this session that only reproduced on real hardware, never in desktop device emulation), not just the Playwright 375px viewport simulation
- [ ] Spot-check tour copy for tone/clarity against the rest of the app's voice
- [ ] Confirm the collapse-to-tab arrow is discoverable — a first-time user who closes the launcher should still be able to find it again without being told where to look
- [ ] Screen-reader pass (VoiceOver or NVDA) on at least one full tour run — the automated accessibility attributes (Phase 1) establish the structure, but actual screen-reader usability is a human judgment call

---

## Acceptance Criteria

- [ ] All `verification` block items pass (`/verify-mop`)
- [ ] `/integrity-check` passes for this MOP's domains
- [ ] "?" launcher renders fixed bottom-right on every authenticated page and is absent from unauthenticated/public routes
- [ ] Clicking "Close" on the launcher collapses it to a slim right-edge arrow tab; clicking the tab re-expands it; both states persist across a page reload
- [ ] A user's first visit to `/recipes` automatically opens the Recipes tour with no manual trigger required; same for the first visit to `/meal-planner` and the Meal Planner tour (resolved 2026-10-30: per-page first-visit, not a single Dashboard-moment popup — see Design decisions)
- [ ] The Meal Planner tour completes meaningfully on a zero-plan account (every step either targets a real, visible element or falls back to its explainer variant) — verified against a test account with no meal plans, not only a populated one
- [ ] A second account on the same browser/device gets its own independent first-visit tour, unaffected by another account having already seen it (user-scoped state)
- [ ] Each tour step dims the full viewport except the targeted element, which remains visibly highlighted and unobscured
- [ ] "Next" advances through every step of a tour in order; the final step provides a way to end the tour (not just advance forever)
- [ ] Recipes tour covers: Add Recipe button, Collections sidebar panel, search/filter controls (minimum set the user explicitly requested)
- [ ] Meal Planner tour covers: New Plan button, view switcher, randomizer, plan-switching, Grocery tab, History tab (minimum set the user explicitly requested)
- [ ] Household tour (on `/household`) covers: page orientation, members, invites (gated to owner/admin, with a non-owner fallback), pending invites (conditionally shown)
- [ ] Sharing & visibility tour (on `/recipes`, a second tour on that page) covers: browse feeds, a text-only visibility-levels explainer, "Shared with me," and the Settings default-visibility pointer — none of its steps spotlight the per-recipe visibility picker directly (H1 risk)
- [ ] Chat tour covers: the two starter buttons (with a mid-conversation-replay fallback), the composer, image/video upload, batch import, and New Chat/history
- [ ] The "?" launcher offers a tour picker on `/recipes` specifically (the only route with two tours) and direct-starts elsewhere
- [ ] A tour already marked "seen" does not auto-launch again on subsequent logins, but remains launchable on demand via the "?" button
- [ ] Tour overlay renders above every other UI layer in the app (z-index audit — no existing modal/dropdown/popover can appear above or bleed through the tour scrim)
- [ ] No tour step's target-resolution spotlights an off-screen-but-rendered element (e.g. a collapsed drawer transformed outside the viewport) — verified specifically against the Chat page's mobile sidebar
- [ ] Documentation updated per `/update-docs` procedure
- [ ] CHANGELOG entry added
- [ ] Related ADRs (if any) updated to `accepted`

---

## Related

- **ADRs:** None of this MOP's own — the localStorage-vs-server-persisted-state and spotlight-mechanism decisions are resolved in Scope of Work §Design decisions, with rationale recorded there and in Notes. **ADR-0010** (proposed, `docs/DECISIONS/ADR-0010-one-household-per-user-invariant.md`) is related but belongs to MOP-0044, not this one — it backs the "one household per user" invariant that Phase 6a's copy accuracy depends on.
- **MOPs:** None blocking Phases 1-5. **Phase 6a (Household tour) soft-depends on MOP-0044** (Single Household Membership, P1) for its step 2 copy to be unconditionally accurate — see that phase's blocking note; shippable before MOP-0044 with softened wording. **Phase 6b (Sharing & visibility tour) references MOP-0045** (Honor Default Recipe Visibility, P2) for its step 4 copy, same soft-dependency shape. Neither MOP blocks Phases 1-5 or Phase 3/4.
- **Audit / source:** User request 2026-10-30 (chat session); codebase survey by Explore subagent, same date — confirmed no existing onboarding/tour/FAB infrastructure, documented z-index stacking conventions, and located concrete anchor points on the Recipes and Meal Planner pages. Phase 6 scoped via `household-sme` survey, same date. That survey's two new findings (H2, H4) triaged by `surface-reviewer`, same date, producing MOP-0044 + ADR-0010 and MOP-0045.

---

## Notes

**User's original request (2026-10-30), verbatim intent:**
- Pop up automatically on first login.
- Also launchable on-demand via a "?" button, fixed bottom-right corner.
- The "?" button must be closeable/collapsible — when closed, a slim arrow tab on the right edge of the page remains to reopen it (not fully gone).
- Guided-steps format: "Next" button per step, screen dims except the currently-highlighted element. Step count is open-ended ("as many steps as we need").
- Recipes page steps: Add Recipe button, recipe collections panel, filter/configuration controls.
- Meal Planner page steps: New Plan button, the different calendar views, the randomizer button(s), switching between plans, the grocery tab, the history tab.
- User explicitly asked for suggestions on what else to include; Chat (AI chat) was floated as one candidate during discussion, not yet confirmed.

**Codebase survey findings (2026-10-30, full detail in session transcript — re-verify before implementation, as this is a point-in-time read):**
- No onboarding/tour/tutorial infrastructure exists anywhere in `src/` today (confirmed via grep across the whole tree).
- No `has_completed_onboarding`-style column exists on `profiles`; `setup_completed` exists but is a distinct one-time profile-completion gate (`CompleteSetup.tsx`), not a tour-seen flag.
- `useLocalToggle` (`src/hooks/useLocalToggle.ts`) is the established pattern for a localStorage-persisted boolean synced across simultaneously-mounted consumers via a custom window event — likely template for "has seen tour" / "is tour open" state, unless a server-persisted flag is chosen instead (would need a new migration + `profiles` column).
- Z-index stacking observed app-wide: base content `z-10`, standard modals `z-[60]`, header/drawer dropdowns `z-50`, nested context menus `z-[100]`, highest existing popover `z-[200]` (RecipeList.tsx card-options). A tour overlay must sit above all of these — likely `z-[300]`+.
- `.modal-backdrop` utility (`src/index.css`, backed by `--rs-overlay` CSS var, themed light/dark) is the existing dimming convention; a heavier `.modal-backdrop-heavy` variant exists for fullscreen lightboxes only, explicitly documented as not for general reuse.
- No existing fixed bottom-right UI element — the corner is unoccupied. `Toaster` sits top-right (`react-hot-toast`, `App.tsx`), no conflict expected with a bottom-right launcher.
- ~~A tour spanning Recipes + Meal Planner (+ possibly Chat) crosses full route navigations... tour step/open state must survive a real page navigation~~ — **stale as of the 2026-10-30 review**: this described the single-cross-page-tour design that was rejected in favor of independent per-page tours (Design decisions above). Each tour is now self-contained to one route and does not need to survive a navigation mid-tour; it closes on navigation instead (Phase 1). "Seen" state (not "open" state) is still localStorage-backed and does need to persist across sessions, which is unaffected by this correction.
- `Layout.tsx`'s `<main>` is `relative z-10` — its own stacking context. A z-index number on an element *inside* `<main>` cannot escape above the Header (`relative z-20`) regardless of its value. This means the earlier "highest existing z-index is `z-[200]`, so `z-[300]`+ is safe" reasoning was necessary but not sufficient — the tour overlay must also be portaled outside `<main>` (`createPortal(document.body)`), not just given a high z-index number while nested inside page content (found during 2026-10-30 `qa-auditor` review; folded into Phase 1 above).
- `window` never receives scroll events in this app: `html`/`body`/`#root` are fixed at `100svh` with `overflow:hidden` (the sealed-height-chain pattern, and the specific unit this session's mobile-composer bug hunt landed on) — `<main>` and Chat's own scroll region are what actually scroll. A spotlight reposition listener on `window`'s `scroll` event would simply never fire; it needs to listen on `document` with `{capture: true}` instead (folded into Phase 1 above).
- Concrete anchor points located (file:line citations as of 2026-10-30 — re-verify line numbers before implementation, code moves):
  - Recipes: Add Recipe button (`RecipeList.tsx`, two instances — toolbar + empty state), Collections sidebar (`CollectionsSidebar.tsx`, desktop-pinned + mobile drawer variants in `Recipes.tsx`), filter/search controls (`RecipeSearch` + view-mode toggle + card-display-options popover, all in `RecipeList.tsx`'s toolbar row).
  - Meal Planner (`MealPlanner.tsx`, 1716 lines): New Plan button, view-switcher (3 icon buttons: days/meals/titles — not literally "week" views), per-slot + per-day randomizer buttons, a separate "Suggest" (Sparkles) button opening `SuggestWeekModal`, `WeekLabelDropdown` for plan-switching, Grocery tab (`Tabs value="grocery"` → `GroceryCart.tsx`, internal structure not yet read), History tab (`Tabs value="history"` → `MealPlanHistory.tsx`, internal structure not yet read).
  - No `data-tour-id` or similar targeting attributes exist anywhere yet — a targeting mechanism (ref-based, `data-*` attribute, or portal-based spotlight cutout) is net-new design work for Phase 1.

**Open design questions — resolved (2026-10-30):**
1. ~~Tour-seen/tour-open state: localStorage vs. server-persisted~~ — **Resolved: localStorage**, user-scoped. See Design decisions above.
2. ~~Spotlight/cutout mechanism~~ — **Resolved: `box-shadow` cutout ring IS the dimming layer**, no separate scrim, plus a distinct click-shield. See Design decisions above (this supersedes the originally-listed alternatives; none of clip-path, four divs, or a third-party library were chosen).
4. ~~Whether "first login" means first-session-post-signup vs. any un-seen-tour session~~ — **Resolved: neither, exactly** — each tour auto-launches on that account's first visit to its own page, decoupled from signup timing entirely. See Design decisions above and the B2 finding below.

3. ~~Final step list and step count beyond what the user explicitly specified~~ — **Resolved 2026-10-30: Household + sharing/visibility yes, Chat yes, Dashboard no, Settings no, "Grocery depth" was never a real open question (see below).** Phase 6 above now has concrete step lists for all three confirmed tours.

**"Grocery depth" clarified:** this phrase in the original Open Design Questions list referred to an unresolved detail already living inside Phase 4 (whether the Grocery/History tour steps just point at the tab trigger or need a deeper anchor inside `GroceryCart.tsx`/`MealPlanHistory.tsx`'s own content) — not a candidate for a separate Phase 6 tour. No action needed here; it resolves during Phase 4 implementation as already noted in that phase's text.

**Phase 6 scoping findings (`household-sme` survey, 2026-10-30) — full detail behind the Phase 6 content above:**

The most significant finding: **`/household` has no visibility controls at all.** `Household.tsx` (971 lines) covers household info, invites, members, and dietary profiles — the words "private," "household," and "public," and any picker or badge for them, appear nowhere on that page. Every actual visibility control lives elsewhere: the browse-feed buttons and a per-recipe `VisibilityPicker.tsx` component on `/recipes` (used from `RecipeDetail.tsx`, the chat save card, and batch-import cards), a bulk "Visibility" action in select mode, a hover-revealed cycling control on collections, and a default-visibility preference in `Settings.tsx`. This is why Phase 6 above is three tours, not the single "household/sharing-visibility explainer" originally imagined as one unit — the actual UI doesn't group that way, and a tour that pretended it did would point at a page with nothing to show.

**Two new bugs found during this survey, both relevant to what Phase 6's tour copy can honestly claim — triaged by `surface-reviewer` 2026-10-30, now tracked as their own MOPs:**
- **H2 — invited users may belong to two households, with nondeterministic household-recipe visibility → MOP-0044 + ADR-0010.** Accepting an invite adds a household membership but never removes the auto-created solo household (`supabase/migrations/20261004000000_050_fix_respond_to_household_invite_ambiguity.sql:70-72`, and a second accept path in the `household-invite` edge function has the same gap); `get_my_household`, `get_household_recipes`, **and `get_dashboard_stats`** (a third affected RPC, found during triage) all pick a household via `LIMIT 1` with no `ORDER BY`, while the recipes RLS policy itself accepts membership in *any* of the user's households. Triage confirmed this is a reliability/visibility bug, not a security leak — RLS is the more permissive layer, so this only ever hides data the user is allowed to see, never exposes extra data. P1 (Phases 0-2 of MOP-0044). Not entirely new: a prior session on 2026-10-19 had already noted the `get_household_recipes` half of this in the enhancement-backlog memory file, but it was never promoted to a MOP until this triage. Directly affects Phase 6a step 2's copy — see that step's blocking note.
- **H4 — Settings' "default recipe visibility" is silently ignored by 3 of the app's 4 save paths → MOP-0045.** `Settings.tsx:459` promises it applies to "newly saved recipes," but the chat-save card (`StructuredRecipeDisplay.tsx:332`), batch import (`BatchImportCard.tsx:107`, `BatchImportPanel.tsx:208`), **and manual entry** (`RecipeForm.tsx`, found during triage — has no visibility field at all) all bypass it; only the two server-side pipeline paths (`recipe-pipeline/stages/load.ts:106-112`, `chat-api/tools/handlers.ts:856-862`) actually read it. Fails closed (every broken path saves more private than requested, never less). P2. Directly affects Phase 6b step 4's copy — see that step's wording note.

**Two already-tracked risks this survey re-confirmed matter for tour copy specifically (not new findings — already in the enhancement-backlog memory file from this session's earlier household-sme investigation):**
- **H1** — the per-recipe visibility picker renders for non-owners too, and a non-owner's change silently no-ops with a false success toast. Phase 6b step 2 is explicitly text-only and does not spotlight this control, to avoid risking a demonstration of the bug instead of the feature.
- **H3** — a recipe added to someone else's public/household collection can remain exposed even after the owner sets it back to private. Phase 6b's copy must not claim "setting a recipe to private hides it from everyone" as an unconditional guarantee.

**Engine-level finding (not Phase-6-specific, already folded into Phase 1 above):** a collapsed mobile drawer in this app (confirmed via the Chat page's own conversation sidebar) is positioned off-screen with `-translate-x-full`, not `display:none` or zero size — so a target-visibility check based only on `checkVisibility()`/non-zero rect would still spotlight it, pointing at empty space off the edge of the screen. The targeting design decision and Phase 1's unit-test list were both updated to require an explicit on-screen/viewport-overlap check, not just a rendered-and-visible check.

**`qa-auditor` review findings (2026-10-30) — summary of what this plan was revised to address:**

A review pass against the real codebase (not just this doc) found 3 blocking gaps and a number of smaller ones before this plan was usable. In brief, each is now folded into the sections above rather than left as a separate to-do:
- **B1 (blocking):** a brand-new user has no meal plan, so most Meal Planner anchors (view switcher, randomizer, plan-switching) don't exist in the DOM at all on first visit — the exact moment this feature is meant to matter most. Resolved via Phase 1's precondition/`prepare`/explainer-fallback mechanism and Phase 4's explicit per-step precondition list.
- **B2 (blocking):** every login lands on `/dashboard`, but tours are page-scoped (Recipes/Meal Planner) with no Dashboard tour, so "pop up on first login" had nothing to show. Resolved by user decision 2026-10-30: each tour auto-launches on first visit to its own page instead of tying anything to the literal login/signup moment.
- **B3 (blocking):** the original spotlight description combined a full scrim and a cutout ring, which would double-dim the target and (being `box-shadow`-only) let clicks pass straight through to the live page underneath. Resolved: the ring is the only dimming layer, plus a separate click-shield.
- Technical-feasibility findings (T1–T6) on `useLocalToggle`'s fit, user-scoping, portal/stacking-context placement, the `window`-never-scrolls fact specific to this app's layout, duplicate-DOM-element targeting on mobile, and the absence of any existing tooltip-clamping code to reuse — all folded into Phase 1/3/4 and the Design decisions above.
- Missing-behavior findings (this review's own H1–H5, mid-tour navigation / when "seen" gets set / accessibility depth / the Chat page's bottom-right space conflict / one-step-per-calendar-view — **not the same H1–H4 labels used in the Phase 6 scoping findings above**, which are a separate `household-sme` survey's numbering; both happen to start over at H1) — folded into Phase 1, Phase 2, and Phase 4.
- Verification-quality findings (V1–V4) on hollow `grep`/`file-exists` checks, a test command pointed at tests no phase created, and missing domain-suite commands — the Verification block above was rewritten to a real `tourTargets.test.ts` check plus a Playwright E2E spec, per `MOP_VERIFICATION_POLICY.md`.
- Sequencing findings (S1, S2) — folded into the Priority table's sequencing note and the resolution of the open design questions above.

**`surface-reviewer` triage of the Phase 6 scoping findings (2026-10-30):**

H2 and H4 (above) were routed through `surface-reviewer` per the project's standard process rather than left as inline notes. Outcome: **MOP-0044** (Single Household Membership, P1, backed by **ADR-0010**, proposed) and **MOP-0045** (Honor Default Recipe Visibility, P2, no ADR needed — the underlying decision was already made in migration 048). The triage's own code check found additional scope beyond the original report: a third affected RPC for H2 (`get_dashboard_stats`), a second broken invite-accept path (the `household-invite` edge function), a note that a naive fix would cascade-delete dependents/dietary profiles via `family_members`' `ON DELETE CASCADE` on household deletion, and confirmation H2 is reliability-only (RLS is the more permissive layer, so this can only hide data, never leak it) — not the security finding it might have sounded like at first. For H4: a third broken save path (`RecipeForm.tsx`, manual entry, no visibility field at all) and confirmation every broken path fails closed. Both MOPs and ADR-0010 are registered in `docs/MOPs/REGISTRY.md`; four open questions in ADR-0010/MOP-0044 (one-household-per-user as the permanent model, where a solo household's dependents go on join, whether to block-or-transfer an accept when the current household has other members, and whether MOP-0045 should add a visibility field to the manual entry form or rely on a silent default) await the user's decision before those MOPs move past `draft`.
