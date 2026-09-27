import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  useThemeStore,
  applyColorSchemeToCSS,
  migrateThemeStoreState,
  type ColorScheme,
} from '@/stores/themeStore';

// MOP-0029 Phase 4 coverage: the persisted-state migration (the riskiest
// path here — it runs against every existing user's real localStorage on
// their next visit) and applyColorSchemeToCSS's new surface/accentCategory/
// gradient wiring. themeStore had zero test coverage before this file.

const RAMP_KEYS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

function getPreset(name: string): ColorScheme {
  const scheme = useThemeStore.getState().availableColorSchemes[name];
  if (!scheme) throw new Error(`Test setup error: preset "${name}" not found`);
  return scheme;
}

describe('migrateThemeStoreState', () => {
  it('passes through unchanged when version is already current (>= 1)', () => {
    const currentState = {
      theme: 'dark',
      colorScheme: getPreset('Forest'),
      availableColorSchemes: { Forest: getPreset('Forest') },
    };

    const result = migrateThemeStoreState(currentState, 1);

    expect(result).toEqual(currentState);
  });

  it('backfills a v0 persisted scheme with its own preset ramps by name match', () => {
    // Simulate pre-Phase-4 localStorage: a persisted "Forest" colorScheme
    // that predates surface/accentCategory/gradient/viz entirely.
    const v0Forest = getPreset('Forest');
    const { surface, accentCategory, gradient, viz, ...v0ForestWithoutNewFields } = v0Forest;
    void surface; void accentCategory; void gradient; void viz;

    const persistedV0 = {
      theme: 'light',
      colorScheme: v0ForestWithoutNewFields,
      availableColorSchemes: { Forest: v0ForestWithoutNewFields },
    };

    const result = migrateThemeStoreState(persistedV0, 0);

    // Backfilled from FOREST's own new ramps, not Evergreen's — this is the
    // behavior that most needs a regression guard, since a naive migration
    // could easily default everyone to Evergreen's ramps regardless of
    // their actual selected preset.
    expect(result.colorScheme.surface).toEqual(getPreset('Forest').surface);
    expect(result.colorScheme.accentCategory).toEqual(getPreset('Forest').accentCategory);
    expect(result.colorScheme.gradient).toEqual(getPreset('Forest').gradient);
    expect(result.colorScheme.viz).toEqual(getPreset('Forest').viz);
    // Pre-existing fields must survive the migration untouched.
    expect(result.colorScheme.name).toBe('Forest');
    expect(result.colorScheme.primary).toEqual(v0Forest.primary);
  });

  it('falls back to Evergreen ramps for an unrecognized custom preset name', () => {
    const customV0Scheme = {
      ...getPreset('Ocean'),
      name: 'MyCustomTheme',
    };
    const { surface, accentCategory, gradient, viz, ...customWithoutNewFields } = customV0Scheme;
    void surface; void accentCategory; void gradient; void viz;

    const result = migrateThemeStoreState(
      { theme: 'system', colorScheme: customWithoutNewFields, availableColorSchemes: {} },
      0
    );

    // Not Ocean's ramps (name doesn't match any built-in preset) — must not
    // silently crash or leave the new fields `undefined`.
    expect(result.colorScheme.surface).toEqual(getPreset('Evergreen').surface);
    expect(result.colorScheme.name).toBe('MyCustomTheme');
    expect(result.colorScheme.surface).not.toBeUndefined();
    expect(result.colorScheme.accentCategory).not.toBeUndefined();
  });

  it('migrates every entry in availableColorSchemes, not just the active colorScheme', () => {
    const v0Sunset = getPreset('Sunset');
    const { surface: _s, accentCategory: _a, gradient: _g, viz: _v, ...v0SunsetStripped } = v0Sunset;
    void _s; void _a; void _g; void _v;

    const result = migrateThemeStoreState(
      {
        theme: 'light',
        colorScheme: v0SunsetStripped,
        availableColorSchemes: { Sunset: v0SunsetStripped },
      },
      0
    );

    expect(result.availableColorSchemes.Sunset.surface).toEqual(getPreset('Sunset').surface);
  });

  it('falls back to the full built-in preset set when availableColorSchemes is empty', () => {
    const result = migrateThemeStoreState(
      { theme: 'light', colorScheme: undefined, availableColorSchemes: {} },
      0
    );

    expect(Object.keys(result.availableColorSchemes)).toEqual(
      expect.arrayContaining(['Evergreen', 'Forest', 'Ocean', 'Sunset', 'Botanical'])
    );
    expect(result.colorScheme).toEqual(getPreset('Evergreen'));
  });

  it('handles a completely empty persisted payload without throwing', () => {
    expect(() => migrateThemeStoreState({}, 0)).not.toThrow();
    const result = migrateThemeStoreState({}, 0);
    expect(result.colorScheme).toEqual(getPreset('Evergreen'));
  });
});

describe('applyColorSchemeToCSS', () => {
  const root = document.documentElement;

  beforeEach(() => {
    root.classList.remove('dark');
    // Clear any inline custom properties a prior test left behind.
    root.removeAttribute('style');
  });

  afterEach(() => {
    root.classList.remove('dark');
    root.removeAttribute('style');
  });

  it('sets every surface shade as both a plain hex var and an "-rgb" triplet var', () => {
    applyColorSchemeToCSS(getPreset('Evergreen'));

    for (const shade of RAMP_KEYS) {
      const hexVar = root.style.getPropertyValue(`--surface-${shade}`).trim();
      const rgbVar = root.style.getPropertyValue(`--surface-${shade}-rgb`).trim();
      expect(hexVar).toBe(getPreset('Evergreen').surface[shade]);
      // "-rgb" must be a bare space-separated triplet (no "rgb(...)" wrapper,
      // no commas) — that's the exact form Tailwind's rgb(var(...) / <alpha>)
      // function requires.
      expect(rgbVar).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
    }
  });

  it('hex-to-RGB conversion is numerically correct (spot check against known values)', () => {
    applyColorSchemeToCSS(getPreset('Evergreen'));

    // #e7e5e4 -> 231 229 228 (decimal), verified by hand against the
    // approved Phase 9 spec's surface-200 value.
    expect(root.style.getPropertyValue('--surface-200-rgb').trim()).toBe('231 229 228');
    // #fafaf9 -> 250 250 249
    expect(root.style.getPropertyValue('--surface-50-rgb').trim()).toBe('250 250 249');
  });

  it('uses the light surface ramp when .dark is not set', () => {
    applyColorSchemeToCSS(getPreset('Forest'));

    expect(root.style.getPropertyValue('--surface-50').trim()).toBe(
      getPreset('Forest').surface[50]
    );
  });

  it('uses the dark surface ramp (a genuinely distinct curated ramp, not a formula) when .dark is set', () => {
    root.classList.add('dark');
    applyColorSchemeToCSS(getPreset('Forest'));

    expect(root.style.getPropertyValue('--surface-50').trim()).toBe(
      getPreset('Forest').surface.dark[50]
    );
    // The light and dark ramps must actually differ — guards against a
    // regression that silently ignores .dark and always applies the light
    // ramp (which would pass a weaker "some value is set" assertion).
    expect(getPreset('Forest').surface.dark[50]).not.toBe(getPreset('Forest').surface[50]);
  });

  it('sets accentCategory identically regardless of light/dark mode (spec: "same" in every row)', () => {
    applyColorSchemeToCSS(getPreset('Ocean'));
    const lightAccent1 = root.style.getPropertyValue('--accent-cat-1').trim();

    root.classList.add('dark');
    applyColorSchemeToCSS(getPreset('Ocean'));
    const darkAccent1 = root.style.getPropertyValue('--accent-cat-1').trim();

    expect(lightAccent1).toBe(darkAccent1);
    expect(lightAccent1).toBe(getPreset('Ocean').accentCategory[1]);
  });

  it('sets all three named gradient pairs (brand/warm/subtle)', () => {
    applyColorSchemeToCSS(getPreset('Botanical'));
    const scheme = getPreset('Botanical');

    expect(root.style.getPropertyValue('--gradient-brand-from').trim()).toBe(scheme.gradient.brand.from);
    expect(root.style.getPropertyValue('--gradient-brand-to').trim()).toBe(scheme.gradient.brand.to);
    expect(root.style.getPropertyValue('--gradient-warm-from').trim()).toBe(scheme.gradient.warm.from);
    expect(root.style.getPropertyValue('--gradient-warm-to').trim()).toBe(scheme.gradient.warm.to);
    expect(root.style.getPropertyValue('--gradient-subtle-from').trim()).toBe(scheme.gradient.subtle.from);
    expect(root.style.getPropertyValue('--gradient-subtle-to').trim()).toBe(scheme.gradient.subtle.to);
  });

  it("Evergreen's surface ramp is byte-identical to the current live stone-* palette (pixel-identical requirement)", () => {
    applyColorSchemeToCSS(getPreset('Evergreen'));

    // Mirrors tailwind.config.js's stone-* hex values pre-Phase-4 — this is
    // the hard constraint the whole MOP is built around: switching to /
    // staying on Evergreen must never visibly change page background or
    // card surface colors for existing users.
    const expectedLiveStone: Record<number, string> = {
      50: '#fafaf9', 100: '#f5f5f4', 200: '#e7e5e4', 300: '#d6d3d1', 400: '#a8a29e',
      500: '#78716c', 600: '#57534e', 700: '#44403c', 800: '#292524', 900: '#1c1917',
    };
    for (const shade of RAMP_KEYS) {
      expect(root.style.getPropertyValue(`--surface-${shade}`).trim()).toBe(expectedLiveStone[shade]);
    }
  });
});

describe('preset catalog shape (all five presets satisfy the Phase 4 schema)', () => {
  it.each(['Evergreen', 'Forest', 'Ocean', 'Sunset', 'Botanical'])(
    '%s has fully-specified surface/accentCategory/gradient/viz families',
    (name) => {
      const scheme = getPreset(name);

      for (const shade of RAMP_KEYS) {
        expect(scheme.surface[shade]).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(scheme.surface.dark[shade]).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
      for (const slot of [1, 2, 3, 4, 5, 6] as const) {
        expect(scheme.accentCategory[slot]).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
      for (const key of ['brand', 'warm', 'subtle'] as const) {
        expect(scheme.gradient[key].from).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(scheme.gradient[key].to).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  );

  it('Botanical is the only preset with a distinct primary/secondary brand pair (terracotta/olive)', () => {
    const botanical = getPreset('Botanical');
    const evergreen = getPreset('Evergreen');

    expect(botanical.primary[500]).toBe('#b5542f');
    expect(botanical.secondary[500]).toBe('#5b6b3f');
    expect(botanical.primary[500]).not.toBe(evergreen.primary[500]);
  });
});
