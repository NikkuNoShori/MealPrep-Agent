import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  useThemeStore,
  applyColorSchemeToCSS,
  migrateThemeStoreState,
  type ColorScheme,
} from '@/stores/themeStore';

// Persistence contract (v3): only the user's CHOICES (theme mode + preset name)
// are stored. The palette is always resolved from the code-defined presets, so
// shipping a palette/contrast fix reaches every existing user on their next
// visit. (v0-v2 persisted the whole ColorScheme object, which silently pinned
// each browser to whatever palette it had when it first saved settings.)

const RAMP_KEYS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

function getPreset(name: string): ColorScheme {
  const scheme = useThemeStore.getState().availableColorSchemes[name];
  if (!scheme) throw new Error(`Test setup error: preset "${name}" not found`);
  return scheme;
}

describe('migrateThemeStoreState', () => {
  it('keeps only the user choices from a current-shape payload', () => {
    expect(migrateThemeStoreState({ theme: 'dark', colorSchemeName: 'Forest' }, 3)).toEqual({
      theme: 'dark',
      colorSchemeName: 'Forest',
    });
  });

  it('extracts just the preset NAME from a legacy payload that stored the whole scheme', () => {
    const legacy = {
      theme: 'light',
      colorScheme: getPreset('Ocean'),
      availableColorSchemes: { Ocean: getPreset('Ocean') },
    };
    // Result must not carry the stale palette snapshot forward.
    expect(migrateThemeStoreState(legacy, 2)).toEqual({ theme: 'light', colorSchemeName: 'Ocean' });
  });

  it('handles a completely empty or missing payload without throwing', () => {
    expect(() => migrateThemeStoreState({}, 0)).not.toThrow();
    expect(() => migrateThemeStoreState(undefined, 0)).not.toThrow();
    expect(migrateThemeStoreState({}, 0)).toEqual({ theme: undefined, colorSchemeName: undefined });
  });
});

describe('persisted state rehydration', () => {
  it('resolves the palette from code, ignoring any stale colour values in storage', async () => {
    // A browser that saved settings under the OLD schema, with an old/stale
    // Forest primary colour baked into the stored scheme object.
    const stale = { ...getPreset('Forest'), primary: { ...getPreset('Forest').primary, 500: '#ff00ff' } };
    localStorage.setItem(
      'theme-store',
      JSON.stringify({ state: { theme: 'dark', colorScheme: stale, availableColorSchemes: { Forest: stale } }, version: 2 })
    );

    await useThemeStore.persist.rehydrate();

    const state = useThemeStore.getState();
    expect(state.theme).toBe('dark');
    expect(state.colorScheme.name).toBe('Forest');
    expect(state.colorScheme.primary[500]).toBe(getPreset('Forest').primary[500]);
    expect(state.colorScheme.primary[500]).not.toBe('#ff00ff');
    localStorage.removeItem('theme-store');
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

  it('Botanical is the only preset with a distinct primary/secondary brand pair (olive/tomato-red)', () => {
    const botanical = getPreset('Botanical');
    const evergreen = getPreset('Evergreen');

    // 2026-10-20 "Herb garden" palette swap replaced the original
    // terracotta/olive pair with olive/tomato-red.
    // primary[500] is the contrast-contract brand fill (solved, so asserted structurally, not by hex).
    expect(botanical.primary[500]).toBe(botanical.brand.light);
    expect(botanical.secondary[500]).toBe('#B5482F');
    expect(botanical.primary[500]).not.toBe(evergreen.primary[500]);
  });
});
