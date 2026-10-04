# MOP-0029: Theme Token Layering & Surface-Aware Presets

| Field | Value |
|-------|-------|
| **MOP** | MOP-0029 |
| **Title** | Theme Token Layering & Surface-Aware Presets |
| **Date Submitted** | 2026-09-21 |
| **Date Updated** | 2026-09-22 (Phase 9 palette specs approved) |
| **Date Completed** | — |
| **Submitted By** | surface-reviewer |
| **Status** | deferred |

> Status vocabulary defined in [docs/prompts/MOP_STATUS_LIFECYCLE.md](../prompts/MOP_STATUS_LIFECYCLE.md). Valid values: `draft` / `evaluation` / `approved` / `planned` / `in_progress` / `verifying` / `complete` / `blocked` / `cancelled` / `deferred`.

> **Reason (deferred):** The **migration and preset-authoring phases (4–9)** are sequenced deliberately *after* the dashboard redesign ships on the current live palette. This is cross-cutting work touching 44+ files; running it concurrently with an in-design redesign would entangle two independent change sets. See §Trigger Conditions.
>
> **Phases 0–3 are NOT deferred** — they are the governance standard plus separable correctness fixes with no user-visible change and no dependency on preset design work. **Phases 0, 1, 2, 3, and 5 are implemented** (see commits `48d965f`, `aeb2457`). The only remaining deferral condition is the dashboard redesign shipping — the palette-design blocker on Phase 9 is cleared (see §Approved Phase 9 palette specs).

> **Scope expanded 2026-09-21.** This MOP originally covered page background + card surface only. A full audit of every color surface found the same root cause across thirteen categories. Phases 0, 3, 6, 7, 8 are new; Phase 5 (migration) and Phase 9 (preset) are widened. See ADR-0006 §Full-audit findings and [docs/COLOR_SCHEMA.md](../COLOR_SCHEMA.md).

---

## Summary

The color-preset system changes accents only. A full audit found **five** uncoordinated color systems and hardcoded color in thirteen distinct surface categories — not just backgrounds. This MOP implements the three-layer token model and thirteen-category taxonomy decided in **ADR-0006** and specified in **`docs/COLOR_SCHEMA.md`**: it publishes the governance standard, gives every dynamic CSS variable a static fallback, collapses duplicated apply logic into one path, adds `surface` / status / accent-category / gradient token families to `ColorScheme`, migrates hardcoded usage behind deprecated aliases, and enforces the standard in CI with a ratcheting baseline.

**The deliverable the user asked for is the standard plus N≥2 fully-specified professional presets** — the token wiring is the enabling work, not the payoff.

**Not in scope:** the dashboard redesign itself (KPI strip, Today, Grocery cart, Most-cooked, Top cuisines widgets, `get_dashboard_stats()` RPC). That is separate, still-in-design work. Also not in scope: a user-facing theme builder — presets stay a closed, curated set.

---

## Scope Map

```
docs/COLOR_SCHEMA.md                  # NEW — the governance standard
docs/DECISIONS/ADR-0006-theme-token-layering-and-preset-scope.md
tailwind.config.js
src/index.css
src/stores/themeStore.ts
src/providers/ThemeProvider.tsx
src/theme/accentCategories.ts         # NEW — single source for domain→accent maps
src/App.tsx                           # toast success must not use --primary
src/components/ui/alert.tsx           # success/info variants → status tokens
src/components/common/Header.tsx      # #1e1f26 literal → var(--rs-bg-elevated)
src/pages/**/*.tsx
src/components/**/*.tsx
```

---

## Current-state evidence (measured 2026-09-21)

| Signal | Count |
|---|---|
| Files containing `stone-*` classes | 44 |
| Total `stone-*` occurrences | 878 |
| `dark:*-stone-*` variants | 190 |
| `text-gray-*` usages | 284 |
| `bg-primary-*` / `text-primary-*` usages | 130 / 150 |
| `var(--rs-*)` usages | 80 |
| `:root` fallbacks for `--gray-*` / `--primary-*` / `--secondary-*` | **0** |

### Expanded audit signals (re-measured during triage 2026-09-21)

| Signal | Count |
|---|---|
| Raw accent-color literals (`{text,bg,border}-{red,green,amber,indigo,…}-NNN`) | **328 / 35 files** |
| Files with hardcoded dark-surface hex (`#0e0f13`, `#16171c`, `#1e1f26`) | **20** |
| `bg-gradient-to-*` (100% hardcoded pairs, zero preset awareness) | 16 |
| Raw `bg-black/NN` overlays vs `var(--rs-overlay)` usages | 18 vs **3** |
| Verbatim copies of the meal-slot color map | **3** |
| Ad hoc section-header stylings (no shared primitive) | ~58 |
| `hover:` / `focus:` occurrences | 405 / 43 |
| Dead `--error-*` / `--success-*` / `--warning-*` vars (JS-set, consumed by nothing) | 7 |
| `stone-*` lines with **no** `dark:` variant | 28 |
| `gray-*` lines lacking a `dark:` companion (var-driven, for comparison) | 17 / 228 |

> **Two figures materially exceed the original audit report:** raw accent literals are 328 across 35 files (the audit sampled 5), and hardcoded dark hex spans 20 files (reported as 3). **Size Phases 5 and 7 against these numbers, not the originals.**

Highest-density files: `src/pages/MealPlanner.tsx` (60), `src/components/meal-planning/MealPlanHistory.tsx` (40), `src/components/recipes/RecipeCard.tsx` (34), `src/pages/Settings.tsx` (32), `src/components/recipes/RecipeDetail.tsx` (29), `src/components/meal-planning/GroceryCart.tsx` (29).

---

## Scope of Work

> **Phase dependency order.** 0 → (1, 2, 3 parallel) → 4 → (5, 6, 7 parallel) → 8 → 9.
> Phases 0–3 are unblocked today. Phases 4–9 wait on the §Trigger Conditions.

### Phase 0: Publish the governance standard (unblocked — do first)
**Files affected:** `docs/COLOR_SCHEMA.md` (created), `docs/DECISIONS/ADR-0006-*.md`, `docs/README.md`, `CLAUDE.md`

- `docs/COLOR_SCHEMA.md` defines the three-layer model, the thirteen-category taxonomy, and governance rules G1–G8. **Created 2026-09-21.**
- Register it in `docs/README.md` and the `CLAUDE.md` Documentation list so it is discoverable.
- Add it to the `/update-docs` procedure scope and the `doc-adherence` audit scope, so it cannot silently drift from the code it governs.

> **This phase is pure documentation, zero code risk, and must land first.** Every file written before the standard exists adds to the violation count the standard exists to reduce. It is also the deliverable the user explicitly asked for ("a standard adhered to during audit, implementation, and future builds").

### Phase 1: Static fallbacks (independently shippable)
**Files affected:** `src/index.css`

Add `:root` (and `.dark`) definitions for every variable currently set only by JS: `--primary-50..900`, `--secondary-50..900`, `--gray-50..900`, `--success-*`, `--error-*`, `--warning-*`. Seed values from `defaultColorScheme` (Evergreen) in `themeStore.ts`.

> **This phase is separable from the rest of the MOP** and resolves the first-paint FOUC risk on its own. It can be pulled forward without waiting on the deferral trigger.

### Phase 2: Consolidate the apply path
**Files affected:** `src/stores/themeStore.ts`, `src/providers/ThemeProvider.tsx`

- Move `hexToHSL` into `themeStore.ts`.
- Make `applyColorSchemeToCSS()` the single apply path: it sets the numeric ramps **and** the HSL-derived `--primary` / `--ring` / `--secondary`.
- Delete the duplicate `useEffect` body in `ThemeProvider.tsx:39-69`; the provider calls the store function instead.
- Add light/dark-aware derivation so applying a preset does not flatten the `.dark` block's lightened `--primary`.

### Phase 3: Reconcile semantic/status colors (unblocked — separable)
**Files affected:** `src/stores/themeStore.ts`, `src/providers/ThemeProvider.tsx`, `tailwind.config.js`, `src/App.tsx`, `src/components/ui/alert.tsx`

Resolve the three competing "error" representations into one (ADR-0006 Decision §0b.1):

- **Decide the fate of the dead vars.** `--error-*`, `--success-*`, `--warning-*` are set by JS but consumed by **no** `tailwind.config.js` key. Either map Tailwind `status-*` utilities onto them, or delete them. **Leaving them is not an option** — they imply semantic theming works when it does not.
- Derive shadcn `--destructive` from `ColorScheme.semantic.error` so the 19 existing usages become preset-aware for free.
- Fix `src/App.tsx:143-164`: the toast **success** icon uses `hsl(var(--primary))`. Success is not brand. Point it at the success token.
- Fix `src/components/ui/alert.tsx`: success/info variants hardcode `green-*` / `primary-*` → status tokens.

> Separable from the surface work and independently shippable. Fixes a real semantic bug (success styled as brand) that is visible today.

### Phase 4: Token families in `ColorScheme` + Tailwind wiring
**Files affected:** `src/stores/themeStore.ts`, `tailwind.config.js`, `src/index.css`

- Add required ramps to the `ColorScheme` interface: `surface` (50–900), `accentCategory` (1–6), `gradient` (brand/warm/subtle), plus the reconciled `status` roles from Phase 3. Reserve `viz` (1–8) — declared, not yet consumed.
- Author these ramps for each of the four existing presets. **Evergreen's `surface` must equal today's `stone` hex values exactly**, so the live palette is pixel-identical after migration.
- Bump the `persist` config `version` and add a `migrate` function backfilling every new ramp for hydrated state. **Required** — without it, existing localStorage yields `undefined` ramps.
- Map `surface-*`, `status-*`, `accent-cat-*` utilities to their `var(--*)`.
- Retain `stone` as a **deprecated alias** resolving to `--surface-*` (keeps all 878 usages working — no big-bang rewrite).
- Redefine `--rs-bg`, `--rs-bg-elevated`, `--rs-border`, `--rs-border-subtle`, `--rs-search-bg` in terms of `var(--surface-*)`.
- Add a `--chrome-bg` token — header/nav/footer is structurally distinct from card surface (taxonomy §3 category 3).
- Evaluate which shadcn HSL tokens (`--background`, `--card`, `--muted`, `--border`) should derive from `surface`; some may intentionally stay static.

> **Do not merge the `gray-*` text ramp into `surface-*`.** They are deliberately separate (ADR-0006 §Alternatives).

### Phase 5: Deduplicate accent-category maps
**Files affected:** `src/theme/accentCategories.ts` (new), `src/pages/MealPlanner.tsx`, `src/components/meal-planning/DayAssignmentModal.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Admin.tsx`, `src/components/meal-planning/MealPlanHistory.tsx`

- Create one module owning every domain→accent mapping (meal slots, dashboard stats, status icons).
- Replace the **three verbatim copies** of the breakfast/lunch/dinner/snacks map and the further one-off maps with imports.
- Point the mappings at `--accent-cat-*` tokens.

> Small, high-leverage, low-risk. Removes a live divergence risk — three independent copies of the same map. **Could be pulled forward**; deduplication is valuable even before the tokens exist (import the literals first, tokenize in place later).

### Phase 6: Shared surface primitives
**Files affected:** `src/components/ui/`, `src/index.css`

- Build a `SectionHeader` primitive with real background/border differentiation (replaces ~58 ad hoc header stylings; `CardHeader` is padding-only today).
- Rewrite the `.card` class (`index.css:192-201`) in terms of `--surface-*` instead of `bg-white` / `border-stone-200/80`.
- Rewrite `.btn-secondary` hover (`index.css:177-179`) to derive from its base token per governance rule G4 — no literal `rgba`.
- Consolidate the 18 raw `bg-black/NN` modal backdrops onto the existing `--rs-overlay`.

> **This is component work, not find-and-replace.** Size it accordingly.

### Phase 7: Incremental hardcoded-color migration
**Files affected:** the 44 `stone-*` files + 35 raw-accent-literal files + 20 hardcoded-hex files (overlapping sets)

Mechanical migration in batches, highest-density files first:

- `stone-*` → `surface-*`
- Raw accent literals (**328 occurrences**) → brand / status / accent-category tokens
- Hardcoded dark hex (`#0e0f13`, `#16171c`, `#1e1f26` across 20 files) → tokens. **Includes `Header.tsx:151`, which uses `dark:bg-[#1e1f26]/95` when `var(--rs-bg-elevated)` already holds that exact value.**
- Resolve the light/dark asymmetries (e.g. `Dashboard.tsx:52` `text-stone-500 dark:text-gray-400` — one element, two systems) per rule G5.
- Add `dark:` coverage to the 28 `stone-*` lines that have none, or (preferred) move them to auto-swapping tokens.

> The Phase 4 aliases mean partial completion is always shippable. **Expect multiple sessions** — this is the largest phase by a wide margin.

### Phase 8: Gradients, shadows, and CI enforcement
**Files affected:** `src/index.css`, `tailwind.config.js`, ESLint config / CI script, 16 gradient sites

- Replace all 16 hardcoded `bg-gradient-to-*` pairs with `--gradient-*` tokens. **Highest visual-clash risk when a new preset ships** — must land before Phase 9.
- Resolve the accent-tinted shadow exceptions (`shadow-amber-500/20|25`, `Admin.tsx`): adopt a named `--shadow-accent` token or remove them. Neutral-black defaults stay.
- Ship the governance CI check covering G1 (no raw hex in `className`/`style`), G2 (no new `stone-*`), G3 (no raw accent utilities outside the allowlist), G5 (no mixed light/dark systems).

> **The CI check MUST ship allowlist-driven with a ratcheting baseline** (recorded count may only decrease). A strict rule would fail against 328 existing violations on day one and be disabled within a week — providing zero governance. See ADR-0006 §Alternatives.

### Phase 9: Author the professional presets (the actual feature request)
**Files affected:** `src/stores/themeStore.ts`

Author the terracotta/olive botanical preset as a fifth curated preset, and backfill the four existing presets — which today share an identical neutral ramp and specify none of the new families — into fully-specified palettes.

**A preset is complete only when it specifies every L1 ramp** (surface, accent-category, gradient, status) for **both** light and dark.

> **Planning gap cleared 2026-09-22.** Full hex ramps for all five presets (Evergreen, Forest, Ocean, Sunset, Botanical) × 4 ramp families × 2 modes were drafted, reviewed as a swatch mockup, and approved by the user. See **§Approved Phase 9 palette specs** below. Phase 9 is unblocked; it still requires this exact review-before-implement workflow for any *future* preset added after this MOP, since preset authoring is design-bound, not engineering-bound (ADR-0006).

### Approved Phase 9 palette specs (2026-09-22)

Source of truth for the `surface`, `accentCategory`, `gradient`, and `status` ramps to encode in `src/stores/themeStore.ts`. Status intentionally stays near-identical across all five presets (semantic color does not reskin — "red = error" must hold regardless of active preset).

**Evergreen** — live default. `surface` is an unchanged transcription of today's `stone-*` Tailwind values (pixel-identical requirement, both modes) — do not alter. `accentCategory`/`gradient` shift earthier (ochre/rust/sage/clay) so the preset reads warmer via icons, badges, and decorative fills without touching page backgrounds or card surfaces.

| Family | Light | Dark |
|---|---|---|
| `surface` 50→900 | `#fafaf9 #f5f5f4 #e7e5e4 #d6d3d1 #a8a29e #78716c #57534e #44403c #292524 #1c1917` (= current `stone-*`) | `#1c1917 #292524 #3a352e #44403c #57534e #78716c #a8a29e #d6d3d1 #e7e5e4 #f5f5f4` |
| `accentCategory` | Ochre `#b8860b` · Rust `#a44a2e` · Sage `#6c8560` · Clay `#c2703f` · Teal `#0d9488` · Plum `#7a4a6b` | same |
| `gradient` | Brand `#1D9E75→#34d399` · Warm `#b8860b→#c2703f` · Subtle `#e7e5e4→#f5f5f4` | same |
| `status` | Success `#178c66` · Warning `#b45309` · Error `#dc2626` · Info `#2563eb` | same |

**Forest** — sage-tinted surface (green undertone vs. Evergreen's warm stone).

| Family | Light | Dark |
|---|---|---|
| `surface` 50→900 | `#f7f9f4 #eef2e7 #dfe6d2 #c7d1b3 #9fab84 #767f5c #5a6146 #434833 #2b2e20 #1a1c14` | `#14150f #1e2116 #282c1d #363b27 #4a5136 #6b734f #8f9871 #b6bd9d #d5dac0 #eef1e3` |
| `accentCategory` | Gold `#ca8a04` · Amber `#d97706` · Teal `#0f766e` · Plum `#7e22ce` · Clay `#c2410c` · Sky `#0284c7` | same |
| `gradient` | Brand `#22c55e→#86efac` · Warm `#ca8a04→#facc15` · Subtle `#dfe6d2→#eef2e7` | same |
| `status` | Success `#178c66` · Warning `#b45309` · Error `#dc2626` · Info `#2563eb` | same |

**Ocean** — cool slate-blue surface.

| Family | Light | Dark |
|---|---|---|
| `surface` 50→900 | `#f6f8fb #eaeef5 #d7deea #b9c5da #8b9bbb #647391 #4c5975 #38435a #242b3b #161a24` | `#0e1016 #161a24 #1e2330 #2a3142 #3c465c #576382 #7d89a8 #a9b2c9 #ced4e2 #e9ecf2` |
| `accentCategory` | Teal `#0d9488` · Violet `#7c3aed` · Amber `#d97706` · Rose `#e11d48` · Cyan `#0891b2` · Slate `#475569` | same |
| `gradient` | Brand `#3b82f6→#5eead4` · Warm `#0d9488→#2dd4bf` · Subtle `#d7deea→#eaeef5` | same |
| `status` | Success `#178c66` · Warning `#b45309` · Error `#dc2626` · Info `#2563eb` | same |

**Sunset** — warm peachy surface (close in temperature to Evergreen's stone, shifted enough to read distinct side-by-side).

| Family | Light | Dark |
|---|---|---|
| `surface` 50→900 | `#fdf8f5 #faeee6 #f3d9c8 #e7bc9e #d29a6f #b3774c #8f5c39 #6d452c #492e1d #2c1c12` | `#1a120c #291d13 #382719 #4f3722 #6f4c2d #96683c #c08a55 #d9ab7c #eaccae #f7e6d6` |
| `accentCategory` | Pink `#db2777` · Purple `#9333ea` · Teal `#0d9488` · Gold `#ca8a04` · Rose `#e11d48` · Indigo `#4f46e5` | same |
| `gradient` | Brand `#f97316→#ec4899` · Warm `#fb923c→#f472b6` · Subtle `#f3d9c8→#faeee6` | same |
| `status` | Success `#178c66` · Warning `#b45309` · Error `#dc2626` · Info `#2563eb` | same |

**Botanical** — new 5th preset. The only preset introducing new `primary`/`secondary` brand ramps (terracotta / olive) — Evergreen/Forest/Ocean/Sunset keep their existing brand colors and only gain the four new L1 families.

| Family | Light | Dark |
|---|---|---|
| `primary` 50→900 (terracotta) | `#fdf1ec #fbe0d3 #f4bda2 #e89a6e #d67744 #b5542f #963f22 #77301a #582212 #3a160b` | same |
| `secondary` 50→900 (olive) | `#f3f5ee #e4e9d8 #c9d3ae #aabb85 #8a9c66 #5b6b3f #485631 #374225 #262f19 #161c0e` | same |
| `surface` 50→900 | `#faf6ee #f4ecdd #e8dcc5 #d9cbb0 #c2b092 #a3936f #7d7053 #5c5340 #3a352a #241f18` | `#161310 #1d1811 #241d15 #332a1e #453a29 #6c5c45 #a8987e #c9bda6 #e1d7c5 #f4ecdd` |
| `accentCategory` | Ochre `#b8860b` · Rust `#a44a2e` · Sage `#6c8560` · Plum `#7a4a6b` · Teal `#3d7a6e` · Clay `#c2703f` | same |
| `gradient` | Brand `#b5542f→#d67744` · Warm `#5b6b3f→#8a9c66` · Subtle `#e8dcc5→#f4ecdd` | same |
| `status` | Success `#178c66` · Warning `#b45309` · Error `#dc2626` · Info `#2563eb` | same |

> Reference mockup: [Preset Palette Specs artifact](https://claude.ai/artifact/CyznK8Y8xVNW2VCcGV6UeG), approved 2026-09-22. Values above are the durable record — the artifact is a working reference, not the source of truth.

---

## Priority

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| **P1** | **Phase 0 — publish `COLOR_SCHEMA.md` + register in doc procedures** | Small | **High** (every day without it grows the violation count) |
| P2 | Phase 1 — static CSS fallbacks (separable; fixes latent FOUC) | Small | Medium |
| P2 | Phase 3 — reconcile status colors (fixes live success-as-brand bug; removes dead vars) | Small | Medium |
| P3 | Phase 2 — consolidate apply path | Small | Low (correctness/maintainability) |
| P3 | Phase 5 — deduplicate accent maps (pullable forward; kills 3-way copy-paste divergence) | Small | Medium |
| defer | Phase 4 — token families + Tailwind wiring | Medium | Medium (enabling) |
| defer | Phase 6 — shared surface primitives (component work) | Medium | Medium |
| defer | Phase 7 — 44+35+20-file migration | **Large** | Low (enabling) |
| defer | Phase 8 — gradients, shadows, CI enforcement | Medium | Medium (guards Phase 9) |
| defer | Phase 9 — author professional presets | **Medium–Large** (design-bound) | **High** (the actual user-visible payoff) |

> **Note the effort shift.** Phase 9 was originally sized "Small." It is not — authoring 5 fully-specified presets across 4 ramp families × 2 modes is the gating design cost, and it is what the user actually wants. The token plumbing exists to make it possible.

---

## Trigger Conditions

### Not deferred — execute independent of any trigger

- **Phase 0** (standard) — deferring it is self-defeating; it governs code written *while the rest waits*.
- **Phases 1, 2, 3, 5** — separable correctness fixes and deduplication. No user-visible change, no dependency on preset design work.

### Deferred — execute Phases 4, 6, 7, 8, 9 when this holds

1. The dashboard redesign has shipped on the current live palette (avoids entangling two cross-cutting change sets).

~~2. A surface-differentiated preset is still wanted in product...~~ — **Satisfied 2026-09-22.** All five presets have approved hex ramps across all four L1 families in both modes (see §Approved Phase 9 palette specs). The remaining trigger is condition 1 only.

### Pull forward early if any of these fire

- Any unstyled-first-paint or color-flash behavior is observed in dev or production → **Phase 1**.
- A new preset is scheduled to ship → **Phase 8 gradients first**. Shipping a preset while all 16 gradients are hardcoded is the highest-probability visible clash.
- The first chart / data-viz component is scheduled → forces the reserved `--viz-*` decision (Phase 4).
- The raw-accent-literal count rises materially above the 328 baseline → the standard is not being adhered to; bring Phase 8's CI check forward.

---

## Verification

> **Lockticket acceptance criteria.** See [MOP_VERIFICATION_POLICY.md](../prompts/MOP_VERIFICATION_POLICY.md) — **`type: human` is forbidden** (blocks `complete`). Route domain tests via [DOMAIN_TEST_MATRIX.md](../prompts/DOMAIN_TEST_MATRIX.md). Run `/integrity-check` then `/verify-mop MOP-0029`.

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

  # Phase 1 — every JS-set variable has a CSS fallback
  - id: gray-fallbacks-present
    type: grep
    file: src/index.css
    pattern: '--gray-500\s*:'
    expect: present

  - id: primary-fallbacks-present
    type: grep
    file: src/index.css
    pattern: '--primary-500\s*:'
    expect: present

  # Phase 2 — single apply path; provider no longer writes vars directly
  - id: provider-no-duplicate-apply
    type: grep
    file: src/providers/ThemeProvider.tsx
    pattern: "setProperty\\('--gray-"
    expect: absent

  # Phase 0 — the governance standard exists and is registered
  - id: color-schema-standard-exists
    type: grep
    file: docs/COLOR_SCHEMA.md
    pattern: 'Coverage-surface taxonomy'
    expect: present

  - id: color-schema-registered-in-docs-index
    type: grep
    file: docs/README.md
    pattern: 'COLOR_SCHEMA'
    expect: present

  # Phase 3 — status colors reconciled; dead vars resolved
  - id: toast-success-not-brand-token
    type: grep
    file: src/App.tsx
    pattern: "iconTheme[\\s\\S]{0,200}hsl\\(var\\(--primary\\)\\)"
    expect: absent

  - id: alert-no-hardcoded-green
    type: grep
    file: src/components/ui/alert.tsx
    pattern: '(text|bg|border)-green-[0-9]'
    expect: absent

  # Phase 4 — token families exist and are persisted-migration safe
  - id: surface-scale-in-colorscheme
    type: grep
    file: src/stores/themeStore.ts
    pattern: 'surface:'
    expect: present

  - id: accent-category-scale-in-colorscheme
    type: grep
    file: src/stores/themeStore.ts
    pattern: 'accentCategory'
    expect: present

  - id: persist-version-bumped
    type: grep
    file: src/stores/themeStore.ts
    pattern: 'version:'
    expect: present

  - id: tailwind-surface-mapped
    type: grep
    file: tailwind.config.js
    pattern: 'var\(--surface-'
    expect: present

  - id: chrome-surface-token-defined
    type: grep
    file: src/index.css
    pattern: '--chrome-bg\s*:'
    expect: present

  # Phase 5 — accent maps deduplicated into one module
  - id: accent-map-single-source
    type: grep
    file: src/components/meal-planning/DayAssignmentModal.tsx
    pattern: "text-amber-500"
    expect: absent

  # Phase 6 — card class tokenized
  - id: card-class-not-bg-white
    type: grep
    file: src/index.css
    pattern: '\.card \{[\s\S]{0,120}bg-white'
    expect: absent

  # Phase 7 — hardcoded dark hex eliminated
  - id: dark-body-hex-removed
    type: grep
    file: src/index.css
    pattern: '#0e0f13'
    expect: absent

  - id: header-uses-elevated-token
    type: grep
    file: src/components/common/Header.tsx
    pattern: '#1e1f26'
    expect: absent

  # Phase 7 — no hardcoded stone hex remains in tailwind config
  - id: stone-hex-removed
    type: grep
    file: tailwind.config.js
    pattern: "'#fafaf9'"
    expect: absent

  # Phase 8 — gradients tokenized; CI governance check wired into lint
  - id: gradient-tokens-defined
    type: grep
    file: src/index.css
    pattern: '--gradient-brand\s*:'
    expect: present

  - id: governance-check-in-package-scripts
    type: grep
    file: package.json
    pattern: 'color-governance|lint:color'
    expect: present
```

> **Baseline-ratchet assertions (Phase 8).** The raw-accent-literal and `stone-*` counts cannot be expressed as present/absent while migration is partial. The CI governance script must emit a machine-readable count checked against a committed baseline file (`.color-baseline.json`), failing if any count **increases**. Promote that script into this block as a `command` assertion with `expect_exit: 0` once Phase 8 lands.

> **Note:** a theme-store unit test asserting that `applyColorSchemeToCSS` sets `--surface-*`, `--gray-*`, and `--primary` in one call should be added in Phase 2 and promoted into this block as a `test-passes` assertion.

## Manual Follow-up (non-blocking)

> Optional human review **after** `complete`. Never gates status.

- [ ] Visual regression pass: Dashboard, MealPlanner, Recipes, Settings in light **and** dark mode, across all presets
- [ ] Confirm Evergreen renders pixel-identically to pre-migration (no unintended palette shift for existing users)
- [ ] Verify preset switch with a pre-existing localStorage `theme-store` payload (migration path)
- [ ] Design review: each preset judged "professional" as a complete palette, not just mechanically distinct
- [ ] Contrast check — text on every surface token meets WCAG AA in both modes, for every preset
- [ ] Accent-category ramp colors are distinguishable from each other **and** from status colors, in both modes
- [ ] Gradient surfaces reviewed under every preset (highest visual-clash risk)

---

## Acceptance Criteria

- [ ] All `verification` block items pass (`/verify-mop`)
- [ ] `/integrity-check` passes for this MOP's domains
- [ ] `docs/COLOR_SCHEMA.md` exists, is registered in `docs/README.md` + `CLAUDE.md`, and is in `/update-docs` + `doc-adherence` scope
- [ ] Switching any preset visibly changes page background, card surface, chrome, accent-category, **and** gradient colors
- [ ] Evergreen preset is pixel-identical to the pre-migration live palette
- [ ] No CSS variable consumed by a Tailwind utility lacks a `:root` fallback
- [ ] Exactly one code path applies a `ColorScheme` to the DOM
- [ ] Exactly one source of truth per status role; no dead `--error-*`/`--success-*`/`--warning-*` vars remain
- [ ] Domain→accent color maps are defined once and imported (zero duplicated copies)
- [ ] Zero raw hex color literals in `className` / `style` props across `src/`
- [ ] Zero raw Tailwind accent-color utilities outside the `COLOR_SCHEMA.md` §11 allowlist
- [ ] No element mixes hardcoded and var-driven systems across its light/dark pair (rule G5)
- [ ] CI governance check runs in `npm run lint` with a committed ratcheting baseline
- [ ] Every preset specifies all four ramp families in both light and dark modes
- [ ] Persisted `theme-store` state from before this change hydrates without `undefined` ramps
- [ ] Documentation updated per `/update-docs` procedure
- [ ] CHANGELOG entry added
- [ ] ADR-0006 updated to `accepted`; `COLOR_SCHEMA.md` status → normative

---

## Related

- **ADRs:** ADR-0006 — Theme Token Layering and the Scope of Color Presets
- **Standard:** [docs/COLOR_SCHEMA.md](../COLOR_SCHEMA.md) — taxonomy + governance rules G1–G8
- **MOPs:** none blocking. Sequenced *after* the (not-yet-numbered) dashboard redesign MOP.
- **Audit / source:** dashboard-redesign design session, 2026-09-21; full color-surface audit 2026-09-21; surfaced via `surface-reviewer`

---

## Notes

- **Product boundary (explicit user constraint):** expand preset coverage to backgrounds/surfaces only. This is **not** full custom theming of the whole app. `addColorScheme` / `removeColorScheme` stay internal API for shipping curated presets — do not expose a user-facing theme builder under this MOP.
- The four existing presets currently share an identical `neutral` ramp; authoring distinct `surface` ramps is design work, not just wiring.
- Dark mode needs its own surface treatment — 190 `dark:*-stone-*` variants exist and a light ramp cannot be naively reused.
- Phases 1, 2, 3 and 5 are pure correctness/dedup fixes with no user-visible change and no dependency on the deferral trigger. **If this MOP stalls, they should still land.**
- **Phase 0 must not wait.** The standard governs code written while the rest of the MOP is deferred. Publishing it late is the single highest-regret option here.
- **The user's actual ask is Phase 9** (professional palettes) plus Phase 0 (the written standard). Phases 1–8 are enabling work. Do not let the plumbing consume the budget for the palettes.
- **Preset authoring is design-bound, not engineering-bound.** No hex ramps exist for any new family in any preset. This is the critical-path unknown; capture it before scheduling Phase 9.
- Two findings are **bugs visible today**, independent of theming: the toast success icon styled with the brand token (`App.tsx`), and `Header.tsx:151` hardcoding a hex that an existing token already holds.
- The audit confirmed hardcoded systems are **structurally** worse for dark mode (28 `stone-*` lines with no `dark:` variant vs 17/228 for var-driven `gray-*`) — a correctness argument for tokens, not a style preference.
- Data-viz is an empty category today. It is reserved deliberately: the dashboard redesign is where it will first appear, and those widgets already show the duplicated-accent pattern.
