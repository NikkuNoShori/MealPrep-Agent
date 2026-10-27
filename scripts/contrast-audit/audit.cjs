const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { installMocks } = require('./mock.cjs');
const { auditInPage, focusInPage } = require('./measure.cjs');

const BASE = process.env.BASE || 'http://localhost:5173';
const OUT = process.env.OUT || path.join(__dirname, 'out', 'results.json');
const ALL_PRESETS = ['Evergreen', 'Forest', 'Ocean', 'Sunset', 'Botanical'];
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const PHASE = arg('phase', 'base');                    // base | explore
const PRESETS = arg('presets', ALL_PRESETS.join(',')).split(',');
const MODES = arg('modes', 'light,dark').split(',');
const VIEW = arg('view', 'desktop');                   // desktop | mobile
const CONC = +arg('conc', '3');
const MAXCLICK = +arg('maxclick', '45');

const PUBLIC_ROUTES = ['/', '/signin', '/signup', '/forgot-password', '/reset-password?code=abc', '/verify-email', '/no-such-page'];
const AUTH_ROUTES = ['/dashboard', '/chat', '/recipes', '/meal-planner', '/household', '/settings', '/admin'];

const HIDE_CSS = `*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important;transition:none!important}
svg,svg *{stroke:transparent!important;fill:transparent!important}::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important}`;

const results = new Map();
function record(meta, f) {
  const key = [f.kind, f.fg, f.bg, f.cls, f.tag].join('|');
  let r = results.get(key);
  if (!r) { r = { ...f, count: 0, where: [], minRatio: f.ratio, anyFail: false }; results.set(key, r); }
  r.count++; r.minRatio = Math.min(r.minRatio, f.ratio); r.anyFail = r.anyFail || f.fail;
  const w = `${meta.view}/${meta.preset}/${meta.mode}${meta.route}${meta.state ? ' [' + meta.state + ']' : ''}`;
  if (r.where.length < 4 && !r.where.includes(w)) r.where.push(w);
}

async function setTheme(page, preset, mode) {
  await page.evaluate(async ([p, m]) => {
    const mod = await import('/src/stores/themeStore.ts');
    const s = mod.useThemeStore.getState();
    s.setColorScheme(p); s.setTheme(m);
  }, [preset, mode]);
  await page.waitForTimeout(300);
}

async function settle(page, ms = 700) {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page.waitForTimeout(ms);
}

async function snapViewport(page, meta) {
  // let finite CSS animations (staggered card fade-ins, modal enters) finish so we never measure a half-faded element
  await page.evaluate(() => Promise.race([
    Promise.all(document.getAnimations().filter((an) => { const t = an.effect && an.effect.getComputedTiming ? an.effect.getComputedTiming() : null; return !t || t.iterations !== Infinity; }).map((an) => an.finished.catch(() => {}))),
    new Promise((r) => setTimeout(r, 2500)),
  ])).catch(() => {});
  await page.evaluate((css) => { const s = document.createElement('style'); s.setAttribute('data-hide', '1'); s.textContent = css; document.head.appendChild(s); }, HIDE_CSS);
  const png = await page.screenshot({ type: 'png' });
  await page.evaluate(() => document.querySelectorAll('style[data-hide]').forEach((s) => s.remove()));
  const dataUrl = 'data:image/png;base64,' + png.toString('base64');
  const findings = await page.evaluate(([fnStr, a]) => eval('(' + fnStr + ')')(a), [auditInPage, { pngDataUrl: dataUrl, seenKey: '__seen_' + meta.state }]);
  for (const f of findings) record(meta, f);
  if (process.argv.includes('--focus')) {
    const ff = await page.evaluate(([fnStr, a2]) => eval('(' + fnStr + ')')(a2), [focusInPage, { seenKey: '__fseen_' + meta.state }]);
    for (const f of ff) record(meta, f);
  }
  return findings.length;
}

// Audit the viewport, then step every large scroll container through its content.
async function snap(page, meta, { scroll = true } = {}) {
  await snapViewport(page, meta);
  if (!scroll) return;
  const scrollers = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('*').forEach((el, i) => {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 24 && el.clientHeight > 120) { el.setAttribute('data-scr', String(i)); out.push({ id: String(i), sh: el.scrollHeight, ch: el.clientHeight }); }
    });
    return out;
  });
  for (const sc of scrollers.slice(0, 4)) {
    const steps = Math.min(8, Math.ceil(sc.sh / (sc.ch * 0.85)));
    for (let s = 1; s < steps; s++) {
      await page.evaluate(([id, top]) => { const el = document.querySelector(`[data-scr="${id}"]`); if (el) el.scrollTop = top; }, [sc.id, Math.round(s * sc.ch * 0.85)]);
      await page.waitForTimeout(150);
      await snapViewport(page, { ...meta, state: (meta.state || 'page') + `+scroll${s}` });
    }
    await page.evaluate((id) => { const el = document.querySelector(`[data-scr="${id}"]`); if (el) el.scrollTop = 0; }, sc.id);
  }
}

async function newCtx(browser, authed) {
  const vp = VIEW === 'mobile' ? { width: 390, height: 844 } : { width: 1280, height: 900 };
  const context = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, colorScheme: 'light', hasTouch: VIEW === 'mobile', isMobile: false });
  await installMocks(context, { authed });
  await context.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '*,*::before,*::after{transition:none!important}'; document.head.appendChild(st); }); });
  return context;
}

async function clickables(page) {
  return page.evaluate(() => {
    const sel = 'button, [role=button], [role=tab], [role=menuitem], [role=combobox], summary, [role=switch], a[href^="/"]';
    const els = [...document.querySelectorAll(sel)].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 4 && r.height > 4 && r.bottom > 0 && r.right > 0 && !e.disabled && e.getAttribute('aria-disabled') !== 'true' && getComputedStyle(e).visibility !== 'hidden';
    });
    return els.map((e, i) => ({ i, label: ((e.getAttribute('aria-label') || e.textContent || e.getAttribute('title') || e.tagName) + '').trim().replace(/\s+/g, ' ').slice(0, 40) }));
  });
}

async function runCombo(browser, preset, mode) {
  const meta0 = { view: VIEW, preset, mode };
  // public pages
  if (PHASE === 'base') {
    const ctx = await newCtx(browser, false);
    const page = await ctx.newPage();
    await page.goto(BASE + '/signin', { waitUntil: 'domcontentloaded' });
    await settle(page, 300);
    await setTheme(page, preset, mode);
    for (const route of PUBLIC_ROUTES) {
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded' }); await settle(page);
      await snap(page, { ...meta0, route, state: 'page' });
      if (route === '/signin' || route === '/signup' || route === '/forgot-password') {
        await page.evaluate(() => document.querySelectorAll('form').forEach((f) => { f.noValidate = true; }));
        await page.locator('button[type=submit]').first().click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(500);
        await snap(page, { ...meta0, route, state: 'after-submit-empty' }, { scroll: false });
      }
    }
    await ctx.close();
  }
  // authed pages
  const ctx = await newCtx(browser, true);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { if (process.env.VERBOSE) console.log('pageerror', e.message.slice(0, 120)); });
  await page.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' }); await settle(page, 300);
  await setTheme(page, preset, mode);
  for (const route of AUTH_ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' }); await settle(page, 900);
    if (route === '/chat') {
      await page.getByText('Weeknight chicken ideas').first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(800);
    }
    const url0 = page.url();
    if (PHASE === 'base') {
      await snap(page, { ...meta0, route, state: 'page' });
      continue;
    }
    // explorer: click each interactive element on a fresh load and audit what appears
    const items = await clickables(page);
    const labels = items.slice(0, MAXCLICK);
    for (const it of labels) {
      if (/sign ?out|log ?out/i.test(it.label)) continue;
      await page.goto(BASE + route, { waitUntil: 'domcontentloaded' }); await settle(page, 700);
      if (route === '/chat') { await page.getByText('Weeknight chicken ideas').first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(500); }
      const handle = await page.evaluateHandle((idx) => {
        const sel = 'button, [role=button], [role=tab], [role=menuitem], [role=combobox], summary, [role=switch], a[href^="/"]';
        const els = [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.bottom > 0 && r.right > 0 && !e.disabled && e.getAttribute('aria-disabled') !== 'true' && getComputedStyle(e).visibility !== 'hidden'; });
        return els[idx] || null;
      }, it.i);
      const el = handle.asElement();
      if (!el) continue;
      try { await el.click({ timeout: 2500, force: true }); } catch (e) { continue; }
      await page.waitForTimeout(650);
      const state = `click:${it.label}`;
      if (page.url() !== url0 && !/^https?:\/\/[^/]+\/(recipes|meal-planner|dashboard|chat|household|settings|admin)/.test(page.url())) continue;
      await snap(page, { ...meta0, route: page.url().replace(BASE, '') || route, state }, { scroll: false });
      // second level: if a dialog/menu opened, click its buttons too (one level deep)
      const inner = await page.evaluate(() => {
        const root = document.querySelector('[role=dialog], [aria-modal=true], [role=menu], [data-radix-popper-content-wrapper], .fixed.inset-0');
        if (!root) return [];
        return [...root.querySelectorAll('button, [role=tab], [role=menuitem], [role=option]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && !e.disabled; }).slice(0, 8).map((e, i) => ({ i, label: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30) }));
      });
      for (const sub of inner) {
        if (/close|cancel|delete|remove|sign ?out|×|^$/i.test(sub.label)) continue;
        const ok = await page.evaluate((i) => {
          const root = document.querySelector('[role=dialog], [aria-modal=true], [role=menu], [data-radix-popper-content-wrapper], .fixed.inset-0');
          if (!root) return false;
          const els = [...root.querySelectorAll('button, [role=tab], [role=menuitem], [role=option]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && !e.disabled; });
          const t = els[i]; if (!t) return false; t.click(); return true;
        }, sub.i);
        if (!ok) continue;
        await page.waitForTimeout(500);
        await snap(page, { ...meta0, route, state: `${state} > ${sub.label}` }, { scroll: false });
      }
    }
  }
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  const combos = [];
  for (const p of PRESETS) for (const m of MODES) combos.push([p, m]);
  let idx = 0;
  const t0 = Date.now();
  async function worker() {
    while (idx < combos.length) {
      const [p, m] = combos[idx++];
      try { await runCombo(browser, p, m); } catch (e) { console.log('combo failed', p, m, e.message.slice(0, 200)); }
      console.log(`done ${VIEW}/${p}/${m} (${Math.round((Date.now() - t0) / 1000)}s) unique=${results.size}`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, worker));
  await browser.close();
  const arr = [...results.values()].sort((a, b) => a.minRatio - b.minRatio);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(arr, null, 1));
  const fails = arr.filter((r) => r.anyFail);
  console.log(`unique findings=${arr.length} failing=${fails.length}`);
})();
