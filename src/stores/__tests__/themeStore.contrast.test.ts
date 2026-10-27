import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  useThemeStore,
  applyColorSchemeToCSS,
  contrastRatio,
  onColor,
  onColorForFills,
  shiftLightness,
  type ColorScheme,
} from '@/stores/themeStore';

/**
 * Contrast contract (docs/COLOR_SCHEMA.md §4a).
 *
 * Every preset, in BOTH modes, must keep its sanctioned text tiers and brand
 * colors above WCAG 2.x AA against the worst-case backgrounds that text
 * actually sits on. This is the regression guard for the class of bug where a
 * background-depth token (surface-300, gray-500, ...) gets used as text and is
 * unreadable in one mode/preset. If this test fails, fix the PALETTE — never
 * loosen the thresholds.
 *
 * Worst-case backgrounds come from measuring the rendered app (see
 * scripts/contrast-audit): in dark mode the lightest neutral surfaces text
 * sits on are chips / elevated panels (~#2b2c30); in light mode they are the
 * tinted page and chip surfaces (surface-100) plus pure white cards.
 */

const PRESETS = ['Evergreen', 'Forest', 'Ocean', 'Sunset', 'Botanical'] as const;
const DARK_BGS = ['#0e0f13', '#16171a', '#1e1f26', '#2b2c30'];

function preset(name: string): ColorScheme {
  const s = useThemeStore.getState().availableColorSchemes[name];
  if (!s) throw new Error(`preset ${name} missing`);
  return s;
}
const worst = (fg: string, bgs: string[]) => Math.min(...bgs.map((b) => contrastRatio(fg, b)));

describe.each(PRESETS)('contrast contract — %s', (name) => {
  const lightBgs = (s: ColorScheme) => [s.surface[50], s.surface[100], '#ffffff'];

  it('light mode text tiers meet their targets on page, chip and card backgrounds', () => {
    const s = preset(name);
    const bgs = lightBgs(s);
    expect(worst(s.fg.light.primary, bgs)).toBeGreaterThanOrEqual(11);
    expect(worst(s.fg.light.secondary, bgs)).toBeGreaterThanOrEqual(6);
    expect(worst(s.fg.light.muted, bgs)).toBeGreaterThanOrEqual(4.5);
    expect(worst(s.fg.light.faint, bgs)).toBeGreaterThanOrEqual(3);
  });

  it('dark mode text tiers meet their targets on every dark surface', () => {
    const s = preset(name);
    expect(worst(s.fg.dark.primary, DARK_BGS)).toBeGreaterThanOrEqual(12);
    expect(worst(s.fg.dark.secondary, DARK_BGS)).toBeGreaterThanOrEqual(8);
    expect(worst(s.fg.dark.muted, DARK_BGS)).toBeGreaterThanOrEqual(5);
    expect(worst(s.fg.dark.faint, DARK_BGS)).toBeGreaterThanOrEqual(3);
  });

  it('tiers keep a visible hierarchy in both modes (primary > secondary > muted > faint)', () => {
    const s = preset(name);
    for (const mode of ['light', 'dark'] as const) {
      const bg = mode === 'light' ? '#ffffff' : '#16171a';
      const t = s.fg[mode];
      const r = [t.primary, t.secondary, t.muted, t.faint].map((c) => contrastRatio(c, bg));
      expect(r[0]).toBeGreaterThan(r[1]);
      expect(r[1]).toBeGreaterThan(r[2]);
      expect(r[2]).toBeGreaterThan(r[3]);
    }
  });

  it('light brand is readable as text on every light surface AND carries white text as a fill', () => {
    const s = preset(name);
    expect(worst(s.brand.light, lightBgs(s))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#ffffff', s.brand.light)).toBeGreaterThanOrEqual(4.5);
    expect(s.primary[500]).toBe(s.brand.light); // bg-primary-500 + text-white is the app's most common pairing
  });

  it('dark brand is readable as text on every dark surface AND carries computed text as a fill', () => {
    const s = preset(name);
    expect(worst(s.brand.dark, DARK_BGS)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(onColor(s.brand.dark), s.brand.dark)).toBeGreaterThanOrEqual(4.5);
    expect(s.primary[400]).toBe(s.brand.dark); // dark:text-primary-400 is the app's dark-mode brand text
  });

  it('computed foregrounds for primary / secondary / destructive fills pass AA in both modes', () => {
    const s = preset(name);
    const fills = [
      s.brand.light,
      s.brand.dark,
      s.secondary[500],
      shiftLightness(s.secondary[500], 15),
      s.semantic.error[600],
      s.semantic.error[500],
    ];
    for (const fill of fills) {
      expect(contrastRatio(onColor(fill), fill)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('applyColorSchemeToCSS wires the contract into CSS variables', () => {
  const root = document.documentElement;
  beforeEach(() => { root.classList.remove('dark'); root.removeAttribute('style'); });
  afterEach(() => { root.classList.remove('dark'); root.removeAttribute('style'); });

  const triplet = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');

  it.each(PRESETS)('%s: sets mode-correct fg tiers and brand', (name) => {
    const s = preset(name);
    applyColorSchemeToCSS(s);
    expect(root.style.getPropertyValue('--fg-muted-rgb')).toBe(triplet(s.fg.light.muted));
    expect(root.style.getPropertyValue('--brand-rgb')).toBe(triplet(s.brand.light));

    root.classList.add('dark');
    applyColorSchemeToCSS(s);
    expect(root.style.getPropertyValue('--fg-muted-rgb')).toBe(triplet(s.fg.dark.muted));
    expect(root.style.getPropertyValue('--brand-rgb')).toBe(triplet(s.brand.dark));
  });

  it('--rs-accent follows the active preset instead of staying Evergreen green', () => {
    applyColorSchemeToCSS(preset('Sunset'));
    expect(root.style.getPropertyValue('--rs-accent')).toBe(preset('Sunset').brand.light);
    expect(root.style.getPropertyValue('--rs-accent')).not.toBe(preset('Evergreen').brand.light);
  });
});

describe('contrast helpers', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });
  it('onColor picks the readable side', () => {
    expect(onColor('#ffffff')).toBe('#0b0d10');
    expect(onColor('#0b0d10')).toBe('#ffffff');
    expect(onColor('#34d399')).toBe('#0b0d10'); // bright mint needs dark text
  });
});

describe.each(PRESETS)('decorative gradient glyphs — %s', (name) => {
  it('on-warm glyph colour reads (>= 3:1, WCAG non-text) on BOTH warm-gradient stops', () => {
    const s = preset(name);
    const fg = onColorForFills([s.gradient.warm.from, s.gradient.warm.to]);
    expect(contrastRatio(fg, s.gradient.warm.from)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(fg, s.gradient.warm.to)).toBeGreaterThanOrEqual(3);
  });
});

describe('status tokens are mode-aware', () => {
  const root = document.documentElement;
  beforeEach(() => { root.classList.remove('dark'); root.removeAttribute('style'); });
  afterEach(() => { root.classList.remove('dark'); root.removeAttribute('style'); });

  it('light mode sets the dark 800-shade status colors inline', () => {
    applyColorSchemeToCSS(preset('Evergreen'));
    expect(root.style.getPropertyValue('--status-success')).not.toBe('');
    expect(root.style.getPropertyValue('--status-warning')).not.toBe('');
  });

  it('dark mode must NOT keep the light-mode inline override (it measured ~1:1 dark-green-on-near-black)', () => {
    applyColorSchemeToCSS(preset('Evergreen')); // light first: leaves inline values behind
    root.classList.add('dark');
    applyColorSchemeToCSS(preset('Evergreen'));
    expect(root.style.getPropertyValue('--status-success')).toBe('');
    expect(root.style.getPropertyValue('--status-warning')).toBe('');
  });
});

describe('alpha-capable ramps', () => {
  const root = document.documentElement;
  afterEach(() => { root.removeAttribute('style'); });
  it('emits -rgb channel twins for primary, secondary and gray so opacity modifiers compile', () => {
    applyColorSchemeToCSS(preset('Forest'));
    for (const ramp of ['primary', 'secondary', 'gray']) {
      for (const shade of [50, 500, 900]) {
        expect(root.style.getPropertyValue(`--${ramp}-${shade}-rgb`)).toMatch(/^\d+ \d+ \d+$/);
      }
    }
  });
});

describe.each(PRESETS)('non-text contrast (WCAG 1.4.11) — %s', (name) => {
  it('form-control border meets 3:1 against every surface a field sits on, in both modes', () => {
    const s = preset(name);
    expect(worst(s.fg.light.control, [s.surface[50], s.surface[100], '#ffffff'])).toBeGreaterThanOrEqual(3);
    expect(worst(s.fg.dark.control, ['#0e0f13', '#16171a', '#1e1f26'])).toBeGreaterThanOrEqual(3);
  });

  it('error text stays AA on its own 10% tint (bg-status-error/10) in both modes', () => {
    const s = preset(name);
    const mix = (fg: string, bg: string, a: number) => {
      const c = (i: number) => Math.round(parseInt(fg.slice(i, i + 2), 16) * a + parseInt(bg.slice(i, i + 2), 16) * (1 - a));
      return '#' + [1, 3, 5].map((i) => c(i).toString(16).padStart(2, '0')).join('');
    };
    for (const bg of [s.surface[50], '#ffffff']) {
      expect(contrastRatio(s.semantic.error[600], mix(s.semantic.error[600], bg, 0.1))).toBeGreaterThanOrEqual(4.5);
    }
    for (const bg of ['#0e0f13', '#16171a', '#1e1f26']) {
      expect(contrastRatio(s.semantic.error[500], mix(s.semantic.error[500], bg, 0.1))).toBeGreaterThanOrEqual(4.5);
    }
  });
});
