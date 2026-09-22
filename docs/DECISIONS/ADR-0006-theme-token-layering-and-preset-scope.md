# ADR-0006: Theme Token Layering and the Scope of Color Presets

**Status:** proposed
**Created:** 2026-09-21
**Author:** Nick Neal
**Last reviewed:** 2026-09-21
**Related MOP:** MOP-0029
**Standard:** [docs/COLOR_SCHEMA.md](../COLOR_SCHEMA.md)

> **Revision 2026-09-21 — scope expanded.** This ADR originally framed the gap as "page background / card surface." A full audit of every color surface showed the same root cause extends across thirteen categories (status colors, accent categories, gradients, shadows, overlays, interactive states, chrome, data-viz). The decision below now covers the full taxonomy, and the normative rules are extracted into `docs/COLOR_SCHEMA.md`. No prior decision is reversed — the scope is widened.

## Context

The app has a color-preset system (`src/stores/themeStore.ts`) exposing a `ColorScheme` type with `primary`, `secondary`, `neutral`, and `semantic` scales, and four presets: Evergreen (default), Forest, Ocean, Sunset. `applyColorSchemeToCSS()` writes these to `:root` as CSS custom properties, and `tailwind.config.js` maps `primary-*`, `secondary-*`, and `gray-*` utilities onto those variables.

The intent reads as "switching a preset re-skins the app." It does not. **Switching a preset today changes accents only — page backgrounds and card surfaces are unaffected.**

This was discovered while mocking up dashboard redesign concepts (a botanical terracotta/olive palette) in an HTML artifact and finding the result was not reproducible through the existing preset system.

### Root cause: four uncoordinated color systems

| # | System | Defined in | Driven by `ColorScheme`? | Usage count |
|---|--------|-----------|--------------------------|-------------|
| 1 | `stone-*` palette | `tailwind.config.js` (hardcoded hex) | **No** | 878 occurrences / 44 files |
| 2 | `--rs-*` design tokens | `src/index.css` `:root` + `.dark` (hex) | **No** | 80 `var(--rs-*)` usages |
| 3 | shadcn HSL tokens (`--background`, `--card`, `--muted`, `--border`) | `src/index.css` `:root` + `.dark` | **Partially** — only `--primary` / `--ring`, and only from `ThemeProvider` | — |
| 4 | Numeric scales (`--primary-*`, `--secondary-*`, `--gray-*`) | **Nowhere in CSS** — JS-only | **Yes** | 603+ class usages |

Page backgrounds and card surfaces are drawn from systems 1, 2, and 3 — none of which the preset system controls. `ColorScheme.neutral` feeds only `--gray-*` (system 4), which is used for text far more than for surfaces.

### Secondary defects found in the same code path

These are consequences of the same unlayered design and should be resolved by the same work:

1. **No CSS fallbacks for system 4.** There is no `:root` definition of `--gray-*`, `--primary-*`, or `--secondary-*` anywhere in CSS or `index.html`. They are set exclusively by JS at runtime (`ThemeProvider` effect / `initializeTheme`). Until that JS executes, 603+ utility classes resolve against undefined variables. This is a latent FOUC / unstyled-text risk on first paint and a hard failure mode if the provider ever fails to mount.

2. **Duplicated, divergent apply logic.** `applyColorSchemeToCSS()` (`themeStore.ts:409-435`) and the `useEffect` in `ThemeProvider.tsx:39-69` do nearly the same job, but only the provider converts `primary[500]` to HSL and sets `--primary` / `--ring`. The store's copy is effectively dead-but-divergent — it works only because the provider effect re-fires on `colorScheme` change. A future caller invoking `setColorScheme()` outside the provider would get a partially applied theme.

3. **`--secondary` (HSL) is never derived from the preset.** `bg-secondary` / `text-secondary-foreground` stay pinned to the static `index.css` value for every preset.

4. **`hexToHSL` has no dark-mode pairing.** Preset application overwrites `--primary` identically in light and dark, ignoring the `.dark` block's intentionally lightened `--primary: 160 67% 52%`.

### Full-audit findings (2026-09-21) — the gap is broader than backgrounds

A comprehensive audit of every color surface confirmed the same root cause in ten further categories. Counts re-measured during triage; two materially exceed the original audit.

| # | Category | Evidence |
|---|---|---|
| 5 | **A fifth hardcoded system** | `.dark body { background-color: #0e0f13 }` (`index.css:108-111`) does not match `--rs-bg` dark (`#16171c`). These literals plus `#1e1f26` are repeated across **20 files**, not the 3 first reported. |
| 6 | **Cards bypass shadcn** | shadcn primitives are correctly HSL-var driven, but most real cards use a hardcoded `.card` class (`index.css:192-201`, `bg-white`/`border-stone-200/80`) or raw `stone-*`. `Header.tsx:151` uses `dark:bg-[#1e1f26]/95` when `var(--rs-bg-elevated)` **already holds that exact value** — a have-a-token-didn't-use-it defect. |
| 7 | **No header primitive** | `CardHeader` is padding only. ~58 ad hoc per-instance header stylings, no central theming point. |
| 8 | **Duplicated accent maps** | The breakfast/lunch/dinner/snacks color map is copy-pasted **verbatim three times** (`MealPlanner.tsx:60-68`, `DayAssignmentModal.tsx:42-45`, plus one-off maps in `Dashboard.tsx:38-41`, `Admin.tsx:194-197`, `MealPlanHistory.tsx:28-31`). Systemic, not isolated. |
| 9 | **Mixed border/ring systems** | `border-stone-*` (hardcoded) and `border-gray-*` (var-driven) on sibling elements. `ring-*` mixes `ring-primary-500` with `ring-stone-950`/`ring-stone-300`. |
| 10 | **Light/dark asymmetry** | `Dashboard.tsx:52` — `text-stone-500 dark:text-gray-400`. One element, two systems: light mode cannot preset-swap, dark mode already does. |
| 11 | **Three competing "error" colors** | (a) shadcn `--destructive` (19 usages); (b) `ColorScheme.semantic.error` → `--error-500/600`, **confirmed dead** — no `tailwind.config.js` key consumes `--error-*`/`--success-*`/`--warning-*`; (c) raw `red-*` literals. Plus `App.tsx:143-164` styles the toast *success* icon with `hsl(var(--primary))` — semantic leaking into brand — and `alert.tsx` hardcodes success/info to `green-*`/`primary-*`. |
| 12 | **Ungoverned hover literals** | 405 `hover:` / 43 `focus:` occurrences. shadcn derives correctly; hardcoded components hardcode hover too (`.btn-secondary:hover`, `index.css:177-179`, literal `rgba`). No rule requiring derivation from a base token. |
| 13 | **Gradients: zero preset awareness** | All 16 `bg-gradient-to-*` use hardcoded Tailwind pairs. **The category most likely to clash** when a new preset ships. |
| 14 | **Overlays underused** | 18 raw `bg-black/NN` backdrops vs **3** usages of the existing `--rs-overlay`. |
| 15 | **Hardcoded systems are structurally worse for dark mode** | 28 `stone-*` lines have **no** `dark:` variant at all. By contrast only 17/228 `gray-*` lines lack one, because var-driven color gets dark mode for free. This is a correctness argument, not a style preference. |

Additionally, **328 raw accent-color literals across 35 files** were measured (the audit sampled 5 files). Shadows are mostly neutral-black Tailwind defaults — acceptable — with ungoverned accent-tinted exceptions (`shadow-amber-500/20`, `Admin.tsx:34`). Charts/data-viz is currently an empty category, flagged forward-looking because the dashboard redesign is where it will first appear.

### Product constraint

The user has explicitly scoped the desired outcome: **expand preset coverage to include background/surface colors — not full custom theming of the whole app.** Presets remain a closed, curated set. This ADR must not open the door to arbitrary user-defined themes.

**Revised 2026-09-21.** The user subsequently asked for a *professional palette system* governed by a written standard adhered to during audit, implementation, and future builds, with full color-schema documentation. That does not relax the closed-preset boundary — presets stay curated — but it does widen coverage from "backgrounds/surfaces" to **every color surface**, and adds a governance deliverable.

## Decision

Adopt a **three-layer token model**, define preset scope against it, and govern both with a written standard.

### 0 — A written standard is the primary deliverable

`docs/COLOR_SCHEMA.md` is created as the normative color standard. It defines the three-layer model, a **thirteen-category coverage-surface taxonomy**, and eight governance rules (G1–G8). It is binding on new code **immediately**, independent of MOP-0029's migration progress, and is in scope for `doc-adherence` and `qa-auditor`.

This ordering is deliberate: the standard must exist *before* implementation, or implementation re-invents conventions per file — which is exactly how four color systems arose.

### 0b — Coverage is the full taxonomy, not just surfaces

Preset-owned coverage extends to all thirteen categories in `COLOR_SCHEMA.md` §3: page background, card surface, **chrome/header surface**, section headers, borders/rings, text, brand accents, **status colors**, **accent categories**, **interactive states**, shadows, **gradients**, **overlays**, and a **reserved data-viz ramp**.

Three sub-decisions resolve specific contradictions the audit found:

1. **Status colors have exactly one source of truth.** Roles are `success` / `error` / `warning` / `info`, owned by `ColorScheme.semantic`. shadcn's `--destructive` is retained as an L2 alias but must *derive* from it. The dead `--error-*` / `--success-*` / `--warning-*` variables are either wired to Tailwind keys or deleted — **not left in place**. Raw `red-*`/`green-*` for status meaning is forbidden. Semantic color must never borrow the brand token (fixes the `App.tsx` success-toast-uses-`--primary` defect).

2. **Interactive states are derived, never authored.** hover/focus/active/disabled/selected must be a defined shade-step or alpha adjustment of the base token. A new literal in a hover rule is a defect by definition. This is the rule that prevents the four-systems problem from silently regrowing.

3. **Shadows stay neutral black by default.** Tailwind's neutral shadow scale is correct and preset-independent; this is an affirmative decision, not an oversight. Accent-tinted shadows require an explicit named token, not ad hoc tinting.

### 0c — "Professional palettes" means N≥2 fully-specified presets

A preset is not complete until it specifies **every** L1 ramp in the taxonomy — including surface, accent-category, gradient, and status ramps — for **both** light and dark. The four existing presets share an identical neutral ramp and specify none of the new ramps; they are accent-only skins today. Authoring these is **design work with a real cost**, and it is the gating constraint on the visible payoff, not the wiring.

### Layer 1 — Primitive scales (preset-owned)

`ColorScheme` remains the source of truth for raw ramps. Extend it with a `surface` scale alongside the existing `primary` / `secondary` / `neutral` / `semantic`:

```ts
surface: {
  50: string   // page background
  100: string  // subtle raised
  200: string  // card surface
  300: string  // border subtle
  400: string  // border
  // ...through 900 for text-on-surface
}
```

`surface` supersedes the hardcoded `stone` palette as the semantic owner of page background, card surface, and border colors.

### Layer 2 — Semantic aliases (CSS, not JS)

`src/index.css` defines *every* token in terms of Layer 1 primitives, with **static fallback values** so first paint is always correct:

```css
:root {
  --surface-50: #fafaf9;   /* fallback == current stone-50 */
  /* ...full ramp... */
  --rs-bg: var(--surface-50);
  --rs-border: var(--surface-200);
}
```

Presets override Layer 1 at runtime; Layer 2 aliases follow automatically. **No JS writes a Layer 2 token directly.**

### Layer 3 — Tailwind utilities

`tailwind.config.js` maps `surface-*` to `var(--surface-*)`. The `stone` key is retained as a deprecated alias pointing at the same variables, so the 878 existing `stone-*` usages keep working during migration rather than requiring an atomic 44-file rewrite.

### Consolidation rules

- `applyColorSchemeToCSS()` in `themeStore.ts` becomes the **single** apply path. `ThemeProvider`'s duplicate effect is deleted and calls the store function.
- HSL-derived tokens (`--primary`, `--ring`, `--secondary`) are computed in that single path, with separate light/dark derivations.
- Every JS-set variable gains a matching `:root` fallback in `index.css`.

### Preset scope (product boundary)

Presets may change: primary, secondary, neutral, **surface**, semantic. Presets may **not** be user-authored — `addColorScheme` / `removeColorScheme` stay internal API for shipping curated presets, not a user-facing theme builder.

## Consequences

### Positive

- Preset switching becomes meaningful: backgrounds and surfaces change, so palettes like the botanical terracotta/olive concept become expressible.
- Eliminates the FOUC/unstyled-first-paint risk by giving every dynamic variable a CSS fallback.
- Collapses four color systems into one layered model with a single apply path.
- The deprecated-`stone`-alias strategy makes migration incremental and low-risk; no big-bang 44-file change.
- A written standard (`COLOR_SCHEMA.md`) constrains **future** builds, not just this migration — the recurrence-prevention mechanism the four-systems problem lacked.
- Deduplicating the three verbatim meal-slot color maps removes a live divergence risk (three copies drift independently).
- Deleting or wiring the dead `--error-*`/`--success-*`/`--warning-*` variables removes misleading code that implies semantic theming already works.
- Reserving the data-viz ramp before the first chart ships avoids retrofitting a palette into shipped charts.

### Negative

- `ColorScheme` gains a required `surface` field — a breaking change to any persisted `availableColorSchemes` in localStorage. Requires a migration/version bump in the `persist` config, or hydration will yield presets with `surface: undefined`.
- Existing presets (Forest/Ocean/Sunset) all currently share an identical neutral ramp; they will each need a deliberate surface ramp authored, which is design work, not just wiring.
- Two ways to express the same color (`stone-*` alias and `surface-*`) coexist until migration finishes — a lint rule is needed to stop new `stone-*` usage.
- Dark mode surface handling needs explicit design; a light-mode surface ramp cannot be naively reused.
- **The expanded scope is materially larger than first estimated.** 328 raw accent literals across 35 files and hardcoded dark hex in 20 files are added to the 878 `stone-*` occurrences. The migration is now multi-session by necessity.
- **Preset authoring cost scales with taxonomy width.** Each new category multiplies per-preset design work: 4 presets × (surface + accent-category + gradient + status) ramps × 2 modes. Under-resourcing this yields presets that switch mechanically but look unprofessional — the opposite of the goal.
- A CI rule covering G1–G3 and G5 would fail against 328 existing violations on day one. It must ship **allowlist-driven with a ratcheting baseline** (count may only decrease), or it will be disabled within a week and provide no governance.
- `COLOR_SCHEMA.md` is a normative doc that can drift from the code it governs. It must be pulled into the `/update-docs` procedure and the `doc-adherence` audit scope, or it becomes stale documentation asserting false rules.
- Some categories (chrome surface, section headers) require **new shared primitives**, not just token swaps — this is component work, not find-and-replace.

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| Point `stone` at `--gray-*` and call it done | One-line change, but conflates neutral *text* ramp with *surface* ramp. `gray-*` is used for text 284 times; surfaces and body text would be forced to share a ramp, so any warm surface tint would drag text color with it. |
| Full runtime CSS-in-JS theming | Contradicts the explicit product constraint (no full custom theming) and adds a rendering dependency for no stated benefit. |
| Atomic rewrite of all 878 `stone-*` usages | Unbounded regression surface across 44 files, including every meal-planning and recipe component, for zero incremental user value. The alias approach gets the same endpoint safely. |
| Ship the terracotta palette by hardcoding new `stone` hex values | Fastest path to the visual goal, but permanently forecloses preset switching of surfaces and leaves the four-system problem untouched. |
| Create sibling ADRs/MOPs per color category (status, gradients, accents, …) | Rejected. All thirteen categories share **one** root cause and **one** fix (the layer model). Splitting them would duplicate context across ~6 docs, fragment the governance standard, and invite the categories to be solved with divergent conventions — recreating the exact problem. One ADR + one standard + one phased MOP keeps the model coherent. |
| Put the governance rules inside ADR-0006 itself rather than a separate standard | Rejected. An ADR records a point-in-time decision and should not churn; a standard is a living reference consulted during every build and audit. Different lifecycles, different documents. The ADR decides *that* the standard governs; `COLOR_SCHEMA.md` carries the rules. |
| Enforce the CI rule strictly from day one (zero violations) | Rejected. 328 existing violations would block all work immediately, guaranteeing the rule gets disabled. A ratcheting baseline achieves the same endpoint without halting delivery. |

## Trigger for revisit

This ADR is `proposed`. **The deferral applies to the migration and preset-authoring phases only.** Two parts are *not* deferred:

- **The governance standard (`COLOR_SCHEMA.md`) is binding on new code now.** Deferring it is self-defeating: every file written while it waits adds to the violation count it exists to reduce.
- **The separable correctness fixes** (static CSS fallbacks, single apply path, the dead semantic vars, the `Header.tsx` have-a-token-didn't-use-it defect) carry no user-visible risk and no dependency on preset design work.

Revisit the **deferred** phases when:

- The dashboard redesign has shipped on the current live palette, **and**
- A second fully-specified preset (e.g. the botanical terracotta/olive concept) is actually wanted in product, **with its ramps authored** — see Consequences: preset authoring is the gating constraint, not the wiring.

Revisit **earlier, independently of preset work**, if any of these fire:

- The first-paint FOUC risk (defect #1) is observed in practice.
- A new preset is shipped **without** addressing gradients — per the audit, the category most likely to clash visibly.
- The first chart/data-viz component is scheduled, which forces the reserved `--viz-*` ramp decision.

## Related

- **Standard:** [docs/COLOR_SCHEMA.md](../COLOR_SCHEMA.md) — normative taxonomy + governance rules G1–G8
- **MOP:** MOP-0029 — Theme Token Layering & Surface-Aware Presets (deferred; Phases 0–2 separable)
- **Files impacted:** `tailwind.config.js`, `src/index.css`, `src/stores/themeStore.ts`, `src/providers/ThemeProvider.tsx`, `src/App.tsx` (toast semantics), `src/components/ui/alert.tsx`, plus 44 files using `stone-*` and 35 files using raw accent literals
- **Not in scope:** the dashboard redesign itself (new widgets, `get_dashboard_stats()` RPC) is separate, still-in-design work and must not be conflated with this theming gap.
