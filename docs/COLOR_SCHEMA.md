# Color Schema Standard

> **Authoritative standard** for every color surface in MealPrep Agent. This document defines the coverage-surface taxonomy, the token layering model, and the rules that must be adhered to during **audit**, **implementation**, and **future builds**.

**Publisher:** Nick Neal
**Created:** 2026-09-21
**Last updated:** 2026-10-20
**Status:** normative — ADR-0006 accepted, MOP-0029 complete
**Governing ADR:** [ADR-0006](DECISIONS/ADR-0006-theme-token-layering-and-preset-scope.md)
**Implementing MOP:** [MOP-0029](MOPs/MOP-0029-theme-token-layering-surface-presets.md)

---

## 1. Purpose and status

This is the single source of truth for how color is expressed in this codebase. It exists because a full audit (2026-09-21) found **four uncoordinated color systems** and hardcoded color in every category below.

Until MOP-0029 completes, this document describes the **target state**. Sections marked `TARGET` are not yet true of the codebase. Sections marked `NORMATIVE NOW` are rules that apply to **all new code immediately**, regardless of migration progress.

**The prime directive:** every color rendered by this app resolves, transitively, to a value owned by the active `ColorScheme` preset. A color literal in a component is a defect.

---

## 2. Token layering model

Three layers. Each layer may only reference the layer above it.

| Layer | What it is | Where it lives | Who writes it |
|---|---|---|---|
| **L1 — Primitive scales** | Raw color ramps (50–900). The only place a hex value is legal. | `src/stores/themeStore.ts` → `ColorScheme` | Preset authors |
| **L2 — Semantic aliases** | Named, role-based tokens defined in terms of L1. Carries static fallbacks. | `src/index.css` `:root` / `.dark` | This standard |
| **L3 — Utilities** | Tailwind classes mapped onto L2 variables. | `tailwind.config.js` | This standard |

### Rules

1. **L1 is the only layer that may contain a hex literal.** `NORMATIVE NOW`
2. **No JS writes an L2 token directly.** JS sets L1 primitives; L2 follows via `var()`. `TARGET`
3. **Every L2 token has a static `:root` fallback** matching the default (Evergreen) preset, so first paint is correct before JS runs. `TARGET`
4. **Components consume L3 utilities only.** A component referencing `var(--...)` inline, or a raw hex in `className`/`style`, is a defect. `NORMATIVE NOW`
5. **Dark mode is a property of L1/L2, not of components.** Prefer tokens that swap automatically over paired `dark:` variants. `TARGET`

---

## 3. Coverage-surface taxonomy

Thirteen categories. **Every color decision in this app belongs to exactly one.** When adding a new UI surface, identify its category first, then use that category's token. If no token fits, that is a gap to surface — not a license to hardcode.

| # | Category | Owning token family | Status | Notes |
|---|---|---|---|---|
| 1 | **Page / layout background** | `--surface-50` | `TARGET` | Body, page roots, app shell |
| 2 | **Card / widget surface** | `--surface-100` / `--surface-200` | `TARGET` | Raised content containers |
| 3 | **Header / chrome surface** | `--chrome-bg` | `TARGET` | Nav, header, footer, sidebar — **structurally distinct from cards**; currently undifferentiated |
| 4 | **Widget / section headers** | `--surface-header-bg`, `--surface-header-border` | `TARGET` | Requires a shared `SectionHeader` primitive; ~58 ad hoc instances today |
| 5 | **Borders / dividers / rings** | `--surface-300` / `--surface-400` | `TARGET` | Includes focus rings |
| 6 | **Text** | `--fg-*-rgb` / `--brand-rgb` (`text-fg`, `text-fg-secondary`, `text-fg-muted`, `text-fg-faint`, `text-brand`) | `NORMATIVE NOW` | Contrast-guaranteed per preset and mode — see §4a. `surface-*` / `gray-*` are **never** text colors |
| 7 | **Brand accents** | `--primary-*`, `--secondary-*` | done | Already preset-driven |
| 8 | **Status / semantic** | `status.{success,error,warning,info}` | `TARGET` | Single source of truth; see §5 |
| 9 | **Accent categories** | `--accent-cat-*` | `TARGET` | Meal slots, status icons; see §6 |
| 10 | **Interactive states** | derived — see §7 | `TARGET` | hover / focus / active / disabled / selected |
| 11 | **Shadows** | `--shadow-*` | `TARGET` | Neutral-black default; see §8 |
| 12 | **Gradients / decorative** | `--gradient-*` | `TARGET` | 2–3 named gradients from active preset; see §9 |
| 13 | **Overlays / scrims** | `--rs-overlay` | exists, underused | 18 raw `bg-black/NN` vs 3 token usages |
| 14 | **Data-viz / charts** | `--viz-1..8` | reserved | No chart library yet; reserve before first chart ships. See §10 |

---

## 4. Surface vs. text neutrals

`surface-*` and `gray-*` are **background / border / decoration ramps. They are not text colors.**

They were authored as depth steps (page → card → chip → border) and are only ever validated against each other, never against the text drawn on top of them. Using one as a text color is how a 1.9:1 "Sign in" button and 2.3:1 breadcrumbs shipped. Text color has its own sanctioned tokens (§4a).

The deprecated `stone` Tailwind key aliases `--surface-*` during migration. `stone-*` is **frozen**: existing usages keep working, new usages are rejected by CI.

---

## 4a. Contrast contract (text, brand, fills)

`NORMATIVE NOW`. Every preset, in **both** modes, must satisfy WCAG 2.x AA for the text that actually sits on its surfaces. This is enforced by a unit test, not by review.

### Sanctioned text tokens

| Utility | Role | Min contrast (worst-case bg) | Typical use |
|---|---|---|---|
| `text-fg` | Primary text | 11:1 light / 12:1 dark | Headings, body copy, values |
| `text-fg-secondary` | Secondary text | 6:1 / 8:1 | Labels, menu items, descriptions |
| `text-fg-muted` | Muted text | **4.5:1** / 5:1 | Captions, timestamps, helper text, placeholders |
| `text-fg-faint` | Decorative glyphs | 3:1 | Icons and affordances only — **never text** |
| `text-brand` | Brand text / links / active state | 4.5:1 | Links, active nav, emphasis |
| `border-input` (`--input`, from `ColorScheme.fg.*.control`) | Form-field border | **3:1** (WCAG 1.4.11) | Every `Input` / `Textarea` / `Select`. Never override it with a decorative `border-surface-*` / `border-white/*` on a field |

Each token is a CSS variable set per **preset and mode** by `applyColorSchemeToCSS()` from `ColorScheme.fg` / `ColorScheme.brand` (`src/stores/themeStore.ts`). Because the value swaps automatically, **do not add a `dark:` partner** to these utilities (rule G6).

### Reference backgrounds ("worst case")

Measured from the rendered app, not guessed: light mode = page tint (`surface-50`), chip (`surface-100`) and white cards; dark mode = `#0e0f13` page → `#16171a` card → `#1e1f26` elevated → `#2b2c30` chips/overlays. A tier must clear its minimum on **all** of them.

### Non-text contrast (WCAG 1.4.11)

- **Form fields** must be distinguishable from their surroundings at 3:1: use `border-input` (resolved per preset/mode from `ColorScheme.fg.*.control`). Decorative card/divider borders (`border-surface-*`) are exempt but must never be used on a field.
- **Keyboard focus** must be visible at 3:1 against the adjacent surface. `index.css` sets a global `:focus-visible { outline: 2px solid rgb(var(--brand-rgb)) }` (brand passes ≥4.5:1 on every surface in both modes). Components that replace it must use a **full-strength** ring (`focus-visible:ring-2 focus-visible:ring-ring`) — never `ring-ring/50`, never `focus:outline-none` without a ring replacement. (The UA default measured 1.01:1 on dark surfaces; `ring/50` measured ~2:1.)
- **Icons that carry meaning** need 3:1. Decorative `text-fg-faint` is for glyphs that sit beside a text label or are purely ornamental.

### Alpha-capable ramps

Tailwind **silently drops** any opacity-modified utility whose color is a plain `var(--x)` hex (`bg-primary-500/10`, `dark:bg-primary-900/30`, `ring-primary-500/30`, shadcn `bg-primary/10` …) — the class simply isn't emitted. For a long time ~80 such tints/rings/shadows never rendered, and `dark:` partners that didn't exist left light tiles in dark mode. `primary`, `secondary` and `gray` therefore also emit `--*-N-rgb` channel triplets (like `surface`) and the Tailwind color keys use `rgb(var(--x-N-rgb) / <alpha-value>)`; shadcn HSL tokens use `hsl(var(--x) / <alpha-value>)`. When adding a new ramp, give it the same twin or its opacity variants will vanish.

### Brand fills

- `ColorScheme.primary[500]` **is** the AA-safe solid fill (white text ≥ 4.5:1) and the light-mode brand text color. `bg-primary-500 text-white` is therefore always legal.
- `ColorScheme.primary[400]` is the dark-mode brand color. `bg-primary` / `text-primary` (shadcn tokens) resolve to the right one per mode.
- Text on a brand fill must be `text-primary-foreground` (or `text-white` on `bg-primary-500`). Foregrounds for `primary`, `secondary` and `destructive` fills are **computed from the actual fill** (`onColor()`), never a fixed light/dark constant.
- Never put `text-white` on a fill that changes per mode (`bg-primary-500 dark:bg-primary-400`): use `bg-primary text-primary-foreground`.

### Persistence

Only the user's **choices** (`theme`, preset **name**) are persisted. Palettes are resolved from code on load — presets are application data, not user data. (Before v3 the whole scheme object was persisted, which silently pinned every browser to the palette it had when it first saved settings and hid every later fix.)

### Enforcement

1. `src/stores/__tests__/themeStore.contrast.test.ts` — asserts every tier, brand, computed foreground, control border and error-on-tint for every preset in both modes. **If it fails, fix the palette; never loosen a threshold.**
2. `scripts/contrast-audit/` — drives the real app in a headless browser against a mocked backend, across every preset × mode, and measures the rendered contrast of every text node, icon, field **and keyboard-focus indicator** against the actual pixels behind it, and clicks through every control to reach menus, modals and popovers. Run before releasing palette or UI-wide changes (see RUNBOOK).
3. `npm run lint` — rule G9 (below) blocks new uses of `surface-*`/`gray-*`/`muted-foreground` as text color.

---

## 5. Status / semantic colors

**One source of truth.** The audit found three competing representations of "error":

| Representation | Usages | Disposition |
|---|---|---|
| shadcn `--destructive` HSL var | 19 | **Retained** as the L2 alias, but must derive from L1 `semantic.error` |
| `ColorScheme.semantic.error` → `--error-500/600` | set by JS | **Confirmed dead** — no `tailwind.config.js` key consumes `--error-*`, `--success-*`, or `--warning-*`. Must be either wired up or deleted, not left in place. |
| Raw `text-red-*` / `bg-red-*` | widespread | **Forbidden** — migrate to status tokens |

### Rules

1. The four status roles are `success`, `error`, `warning`, `info`. No others without amending this document. `NORMATIVE NOW`
2. Raw `red-*`, `green-*`, `yellow-*` utilities are **forbidden** for status meaning. `NORMATIVE NOW`
3. **Semantic color must not borrow the brand token.** `App.tsx` toast styling uses `hsl(var(--primary))` for the success icon — success is not brand. Use `--status-success`. `NORMATIVE NOW`
4. `alert.tsx` variants must map to status tokens, not hardcoded `green-*` / `primary-*`. `TARGET`

---

## 6. Accent-category tokens

Some UI needs a *set of visually distinct but coordinated* accents — meal slots, status icons, category chips. These are **not** brand colors and **not** status colors.

The audit found the breakfast/lunch/dinner/snacks color map **copy-pasted verbatim in three files** (`MealPlanner.tsx`, `DayAssignmentModal.tsx`, plus further one-off maps in `Dashboard.tsx`, `Admin.tsx`, `MealPlanHistory.tsx`).

### Rules

1. Define an ordered `--accent-cat-1..6` ramp per preset. `TARGET`
2. Domain→accent mappings live in **exactly one** module (e.g. `src/theme/accentCategories.ts`), imported everywhere. Duplicating a color map is a defect. `NORMATIVE NOW`
3. Accent-category tokens must be distinguishable from each other **and** from status colors, in both modes.

---

## 7. Interactive-state derivation rule

`NORMATIVE NOW`

> **A hover, focus, active, selected, or disabled color MUST be derived from its base token by a defined shade-step or alpha adjustment. It must never introduce a new color literal.**

Legal: `hover:bg-surface-200` when base is `bg-surface-100`; `focus:ring-primary-500`; alpha over the base token.

Illegal: `.btn-secondary:hover { background: rgba(255,255,255,1) }` (`index.css:177-179`) — a literal that cannot follow a preset.

Standard steps: hover `+100`, active `+200`, disabled `40%` alpha, focus ring `primary-500`.

---

## 8. Shadows

**Default standard: neutral black.** Tailwind's default shadow scale is correct and preset-independent. This is deliberate, not an oversight.

- `--rs-card-shadow` / `--rs-card-shadow-hover` remain hardcoded black rgba, defined separately per mode. **Accepted.**
- **Accent-tinted shadows require an approved exception.** `shadow-amber-500/20` and `shadow-amber-500/25` (`Admin.tsx`) are currently ungoverned. Either adopt them as a named `--shadow-accent` token or remove them. Do not add new tinted shadows ad hoc. `NORMATIVE NOW`

---

## 9. Gradients and decorative fills

All 16 `bg-gradient-to-*` occurrences use hardcoded Tailwind color pairs with zero preset awareness. **This is the category most likely to visually clash when a new preset ships.**

### Rules

1. Define 2–3 named gradients per preset: `--gradient-brand`, `--gradient-warm`, `--gradient-subtle`. `TARGET`
2. Ad hoc gradient color pairs in `className` are forbidden. `NORMATIVE NOW`
3. Avatar/identity gradients derived from a user hash must draw from the accent-category ramp (§6), not fixed literals.

---

## 10. Data-viz palette (reserved)

No chart library exists today. This category is reserved **before** the first chart ships, because the dashboard redesign (KPI strip, grocery progress bars) is where it will first appear — and those widgets already exhibit the §6 duplication pattern.

Requirements when the first chart lands: an ordered `--viz-1..8` categorical ramp from the active preset, a defined sequential ramp for magnitude, colorblind-safe ordering, and no reuse of status colors for non-status series.

---

## 11. Governance and enforcement

### Rules normative for all new code, now

| # | Rule |
|---|---|
| G1 | No raw hex in `className` or `style` props. Hex belongs in L1 only. |
| G2 | No new `stone-*` utilities. Use `surface-*`. |
| G3 | No raw Tailwind accent-color utilities (`red-*`, `amber-*`, `indigo-*`, …) outside the approved allowlist. Use brand / status / accent-category tokens. |
| G4 | Interactive states derive from the base token (§7). |
| G5 | A light/dark pair on one element must draw from **one** system. `text-stone-500 dark:text-gray-400` is a defect. |
| G6 | Any element with a color utility that can differ by mode has a `dark:` counterpart, **or** uses a token that swaps automatically (preferred). |
| G7 | Color maps are defined once and imported, never copy-pasted. |
| G8 | New UI surfaces declare their §3 taxonomy category. No category fit → surface the gap. |
| G9 | Text color uses only `text-fg*` / `text-brand` / `text-primary*` / `text-primary-foreground` / status tokens. **No `text-surface-*`, `text-gray-*`, `text-stone-*` or `text-muted-foreground`** — those ramps are not contrast-validated (§4, §4a). |
| G10 | A solid color fill that carries text must pass 4.5:1 for that text in every preset and mode. Prefer `bg-primary text-primary-foreground`. |

### Allowlist (G3)

Raw accent utilities are permitted only in: `src/theme/**` (token definitions), and third-party vendored components not yet migrated. Every other occurrence is a violation.

### CI enforcement `TARGET`

MOP-0029 Phase 5 proposes a `stone-*` CI grep. This standard extends it to a single governance check covering G1, G2, G3, and G5. The check must run in `npm run lint` with the project's zero-warning policy, and be **allowlist-driven with a documented baseline count** so the 328 existing violations do not block CI on day one — the baseline may only decrease.

### Audit cadence

This document is reviewed during every `/update-docs` run and is in scope for `doc-adherence` and `qa-auditor`.

---

## 12. Current-state baseline (measured 2026-09-21)

| Signal | Count |
|---|---|
| `stone-*` occurrences / files | 878 / 44 |
| Raw accent-color literals (`text\|bg\|border-{red,green,amber,…}-NNN`) | **328 / 35 files** |
| Hardcoded dark-surface hex literals (`#0e0f13`, `#16171c`, `#1e1f26`) | **20 files** |
| `bg-gradient-to-*` (100% hardcoded pairs) | 16 |
| Raw `bg-black/NN` overlays vs `--rs-overlay` usages | 18 vs 3 |
| Duplicated meal-slot color maps | 3 verbatim copies |
| `dark:` usages across 56/80 tsx files | 1,104 |
| `stone-*` lines lacking a `dark:` variant | 28 |
| `:root` fallbacks for `--gray-*` / `--primary-*` / `--secondary-*` | **0** |
| Dead `--error-*` / `--success-*` / `--warning-*` vars (set by JS, consumed by nothing) | 7 |

> Two figures materially exceed the original audit: raw accent literals are **328 across 35 files** (audit sampled 5), and hardcoded dark hex appears in **20 files** (audit reported 3). Scope Phase sizing against these numbers.

---

## 13. Related

- **ADR-0006** — Theme Token Layering and the Scope of Color Presets (the *why*)
- **MOP-0029** — Theme Token Layering & Surface-Aware Presets (the *how*)
- **Product boundary:** presets are a **closed, curated set**. This standard does not authorize a user-facing theme builder.
