# Contrast audit

Drives the **real app** in headless Chromium against a **mocked Supabase backend** and measures the WCAG contrast of every
visible text node, icon and form field against the pixels actually rendered behind it (text is hidden, the viewport is
screenshotted, and the backdrop is sampled — so images, gradients, overlays and translucent layers are measured correctly).

It exists because grep-based contrast "sweeps" kept missing real failures (wrong token, stale persisted palette, text over
gradients). See `docs/COLOR_SCHEMA.md` §4a.

## Run

```bash
npm run dev                                   # terminal 1 (default http://localhost:5173)
npm run audit:contrast                        # terminal 2 — every route, 5 presets x light/dark (~8 min)
npm run audit:contrast -- --presets=Evergreen --modes=dark          # one combo
npm run audit:contrast -- --phase=explore --presets=Evergreen       # click every control; audit menus/modals/popovers
npm run audit:contrast -- --view=mobile                            # 390x844 viewport
node scripts/contrast-audit/report.cjs scripts/contrast-audit/out/results.json anc 40   # grouped report
```

Flags: `--phase=base|explore`, `--presets=A,B`, `--modes=light,dark`, `--view=desktop|mobile`, `--conc=N`, `--maxclick=N`.
Env: `BASE=http://localhost:5173`, `OUT=path/to/results.json`.

## Reading the report

Findings are grouped by the element's class string (what a developer edits). Each shows the worst contrast (5th percentile
of sampled pixels), the required ratio (4.5:1 text, 3:1 large text / icons), the composited foreground/background and where it
was seen (`view/preset/mode/route [state]`). **Zero failing groups is the bar** — the exemptions are: disabled controls
(skipped automatically), multi-colour brand marks (skipped), and logotypes.

## Notes

- The mock backend (`mock.cjs`) must mirror the shapes in `src/types/database.ts` and `api.ts`. When a new screen or table
  is added and shows up empty in the audit, extend the mock — an empty state hides contrast bugs.
- The audit is read-only against your machine: no real credentials, no real network calls to Supabase.
- Native browser validation bubbles are disabled for the "submit empty form" state (they overlay the page and are not app UI).
