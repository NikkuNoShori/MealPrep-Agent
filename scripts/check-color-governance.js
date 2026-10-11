#!/usr/bin/env node

/**
 * Color governance CI check (MOP-0029 Phase 8).
 *
 * Enforces docs/COLOR_SCHEMA.md §11 rules G1, G2, G3, G5 against src/.
 * Per ADR-0006 §Alternatives and COLOR_SCHEMA.md §11, this check MUST be
 * allowlist-driven with a committed, ratcheting baseline rather than a
 * strict zero-tolerance rule: hundreds of pre-existing violations cannot be
 * fixed in a single phase, and a check that fails outright on day one gets
 * disabled within a week, providing zero governance.
 *
 * Behavior:
 *   - Counts current violations per rule.
 *   - Compares each count against the committed `.color-baseline.json`.
 *   - Exits non-zero ONLY if a count increases beyond its baseline.
 *   - If a count decreases, that's reported as an FYI (a human may choose
 *     to ratchet the baseline down) — it never fails the build.
 *
 * Rules checked (docs/COLOR_SCHEMA.md §11):
 *   G1 — No raw hex literal (#rrggbb) in a .ts/.tsx file. Hex belongs only
 *        in src/stores/themeStore.ts's ColorScheme ramp definitions (L1),
 *        which this check does NOT special-case — see "Known baseline
 *        composition" below for why that's still correct.
 *   G2 — No `stone-N` Tailwind utility/class-name token outside the
 *        deprecated-alias definition itself (tailwind.config.js) or the two
 *        documentary code comments in themeStore.ts.
 *   G3 — No raw Tailwind accent-color utility (text|bg|border|ring +
 *        red/orange/amber/yellow/lime/green/emerald/teal/cyan/sky/blue/
 *        indigo/violet/purple/fuchsia/pink/rose + shade) outside the
 *        src/theme/** allowlist (COLOR_SCHEMA.md §11 "Allowlist (G3)").
 *   G5 — A single class-attribute string whose light-mode utility and its
 *        `dark:` counterpart are drawn from two different color *systems*
 *        (e.g. `text-stone-500 dark:text-gray-400`) rather than one.
 *
 * Known baseline composition (documented, not a bug):
 *   - G1's count includes the ~370 legitimate L1 hex literals inside
 *     themeStore.ts's ColorScheme preset definitions. COLOR_SCHEMA.md §2
 *     Rule 1 says L1 (themeStore.ts) is the ONLY layer allowed a hex
 *     literal — so those are compliant, not violations, but a textual grep
 *     cannot distinguish "hex inside an L1 ramp object" from "hex inside a
 *     className/style prop" without a full parser. Rather than hand-wave a
 *     silent exclusion that could mask a real new violation, this script
 *     counts all .ts/.tsx hex literals and relies on the ratcheting
 *     baseline to absorb the known-legitimate L1 count. A future revision
 *     could parse themeStore.ts's AST to subtract exactly the ColorScheme
 *     literal, but that is a bigger investment than this phase's budget —
 *     flagged here rather than silently built.
 *   - G2's count includes 2 hits that are historical documentation (code
 *     comments in themeStore.ts, lines ~862/948, explaining the var()-
 *     opacity limitation discovered during the Phase 7 migration) rather
 *     than live `stone-*` class usage. Per MOP-0029 Phase 7, these are
 *     deliberately left as-is. The baseline absorbs them for the same
 *     reason as G1: a textual grep cannot distinguish "stone-200 inside a
 *     comment" from "stone-200 inside a className" without false negatives
 *     on genuine new violations phrased unusually. Future refinement could
 *     strip comment bodies before matching.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(REPO_ROOT, 'src');
const BASELINE_PATH = path.join(REPO_ROOT, '.color-baseline.json');

const SCANNABLE_EXTENSIONS = new Set(['.ts', '.tsx']);

// G3 allowlist (COLOR_SCHEMA.md §11 "Allowlist (G3)"): raw accent utilities
// are permitted only in src/theme/** (token definitions) and third-party
// vendored components not yet migrated (none currently tracked by name —
// add explicit path fragments here if one is identified).
const G3_ALLOWLISTED_PATH_FRAGMENTS = [
  `${path.sep}theme${path.sep}`,
];

const ACCENT_HUES = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
];

const HEX_PATTERN = /#[0-9a-fA-F]{6}\b/g;
const STONE_PATTERN = /\bstone-[0-9]{2,3}\b/g;
const ACCENT_UTILITY_PATTERN = new RegExp(
  `\\b(?:text|bg|border|ring)-(?:${ACCENT_HUES.join('|')})-[0-9]{2,3}\\b`,
  'g'
);
// G5 heuristic: a light-mode utility drawn from the deprecated, hardcoded
// `stone` system paired in the same class-attribute string with a `dark:`
// utility from the var-driven `gray` system (or vice versa) — the exact
// "one element, two systems" defect COLOR_SCHEMA.md §4/§11 Rule G5 names
// (`text-stone-500 dark:text-gray-400`). Deliberately NOT included:
// `surface-*` paired with `dark:gray-*`. MOP-0029 Phase 7 confirmed that
// pairing is a widespread, pre-existing, INTENTIONAL pattern, not a
// violation — `surface` (background/border ramp) and `gray` (text ramp)
// are legitimately separate token families per ADR-0006 §Alternatives, and
// both are var-driven/preset-reactive, so there is no "two systems" defect
// there. This heuristic only flags the hardcoded-vs-var-driven mismatch.
const G5_SYSTEM_PAIRS = [
  { light: /\b(text|bg|border)-stone-[0-9]{2,3}\b/, darkOther: /\bdark:(text|bg|border)-gray-[0-9]{2,3}\b/ },
  { light: /\b(text|bg|border)-gray-[0-9]{2,3}\b/, darkOther: /\bdark:(text|bg|border)-stone-[0-9]{2,3}\b/ },
];

function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
    } else if (entry.isFile() && SCANNABLE_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(fullPath);
    }
  }
  return out;
}

function countMatches(content, pattern) {
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

function isG3Allowlisted(filePath) {
  return G3_ALLOWLISTED_PATH_FRAGMENTS.some((fragment) => filePath.includes(fragment));
}

function countG5InLine(line) {
  let count = 0;
  for (const pair of G5_SYSTEM_PAIRS) {
    if (pair.light.test(line) && pair.darkOther.test(line)) {
      count += 1;
    }
  }
  return count;
}

function scan() {
  const files = walk(SRC_DIR);
  const counts = { G1: 0, G2: 0, G3: 0, G5: 0 };

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');

    counts.G1 += countMatches(content, HEX_PATTERN);
    counts.G2 += countMatches(content, STONE_PATTERN);

    if (!isG3Allowlisted(filePath)) {
      counts.G3 += countMatches(content, ACCENT_UTILITY_PATTERN);
    }

    const lines = content.split('\n');
    for (const line of lines) {
      counts.G5 += countG5InLine(line);
    }
  }

  return counts;
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error(`[color-governance] Missing baseline file: ${BASELINE_PATH}`);
    console.error('[color-governance] Create one (see docs/COLOR_SCHEMA.md §11) before running this check.');
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  } catch (err) {
    console.error(`[color-governance] Failed to parse ${BASELINE_PATH}: ${err.message}`);
    process.exit(1);
  }
}

function main() {
  const baseline = loadBaseline();
  const current = scan();

  const rules = ['G1', 'G2', 'G3', 'G5'];
  let hasRegression = false;
  let hasImprovement = false;

  console.log('[color-governance] MOP-0029 Phase 8 — ratcheting baseline check');
  console.log('[color-governance] Rule   Baseline   Current   Delta');

  for (const rule of rules) {
    const baselineCount = baseline.counts?.[rule];
    const currentCount = current[rule];

    if (typeof baselineCount !== 'number') {
      console.error(`[color-governance] Baseline is missing a count for rule ${rule}.`);
      process.exit(1);
    }

    const delta = currentCount - baselineCount;
    const deltaLabel = delta === 0 ? '0' : delta > 0 ? `+${delta}` : `${delta}`;
    console.log(`[color-governance] ${rule}      ${String(baselineCount).padEnd(10)} ${String(currentCount).padEnd(9)} ${deltaLabel}`);

    if (delta > 0) {
      hasRegression = true;
    } else if (delta < 0) {
      hasImprovement = true;
    }
  }

  if (hasImprovement) {
    console.log('');
    console.log('[color-governance] FYI: one or more counts improved (decreased) versus the committed baseline.');
    console.log('[color-governance] This is not a failure. A human may choose to ratchet .color-baseline.json down to lock in the improvement.');
  }

  if (hasRegression) {
    console.error('');
    console.error('[color-governance] FAIL: one or more rule counts increased beyond the committed baseline.');
    console.error('[color-governance] See docs/COLOR_SCHEMA.md §11 (governance rules G1-G8) for what is required instead.');
    process.exit(1);
  }

  console.log('');
  console.log('[color-governance] PASS: no rule count exceeds its committed baseline.');
  process.exit(0);
}

main();
