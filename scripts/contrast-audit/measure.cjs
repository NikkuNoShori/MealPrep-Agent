// Runs INSIDE the page. Given a screenshot of the viewport taken with all text/icons hidden,
// it measures the real contrast of every visible text node / icon / input against the pixels
// actually rendered behind it.
async function auditInPage(arg) {
  const { pngDataUrl, seenKey } = arg;
  const img = new Image();
  img.src = pngDataUrl;
  await img.decode();
  const cv = document.createElement('canvas');
  cv.width = img.width; cv.height = img.height;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, 0, 0);
  const VW = window.innerWidth, VH = window.innerHeight;

  const seen = (window[seenKey] = window[seenKey] || new WeakSet());

  const cvs = document.createElement('canvas'); cvs.width = cvs.height = 1;
  const cctx = cvs.getContext('2d', { willReadFrequently: true });
  const pc = new Map();
  function parseColor(c) {
    if (pc.has(c)) return pc.get(c);
    let out = null;
    let m = c.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
    if (m) {
      let a = m[4] === undefined ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
      out = [+m[1], +m[2], +m[3], a];
    } else {
      m = c.match(/^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.]+%?))?\)$/);
      if (m) {
        let a = m[4] === undefined ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
        out = [parseFloat(m[1]) * 255, parseFloat(m[2]) * 255, parseFloat(m[3]) * 255, a];
      } else {
        cctx.clearRect(0, 0, 1, 1); cctx.fillStyle = '#000'; cctx.fillStyle = c; cctx.fillRect(0, 0, 1, 1);
        const d = cctx.getImageData(0, 0, 1, 1).data; out = [d[0], d[1], d[2], d[3] / 255];
      }
    }
    pc.set(c, out); return out;
  }
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const ratio = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  const hex = (r, g, b) => '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');

  function sample(rects) {
    // returns array of [r,g,b] samples from hidden-text screenshot inside rects
    const out = [];
    for (const rc of rects) {
      const x0 = Math.max(0, Math.floor(rc.left)), y0 = Math.max(0, Math.floor(rc.top));
      const x1 = Math.min(VW, Math.ceil(rc.right)), y1 = Math.min(VH, Math.ceil(rc.bottom));
      const w = x1 - x0, h = y1 - y0;
      if (w < 1 || h < 1) continue;
      const data = cx.getImageData(x0, y0, w, h).data;
      const stepX = Math.max(1, Math.floor(w / 24)), stepY = Math.max(1, Math.floor(h / 6));
      for (let y = 0; y < h; y += stepY) for (let x = 0; x < w; x += stepX) {
        const i = (y * w + x) * 4; out.push([data[i], data[i + 1], data[i + 2]]);
      }
    }
    return out;
  }
  function opacityChain(el) {
    let o = 1;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity || '1');
    return o;
  }
  // Active-layer logic: when a full-viewport scrim (modal/drawer backdrop) is open, content that precedes it in
  // DOM order is inert background — WCAG does not require contrast for inactive UI behind a modal.
  const scrims = [...document.querySelectorAll('*')].filter((e) => {
    const cs = getComputedStyle(e); if (cs.position !== 'fixed' && cs.position !== 'absolute') return false;
    const r = e.getBoundingClientRect(); if (r.width < VW * 0.95 || r.height < VH * 0.95) return false;
    const bg = parseColor(cs.backgroundColor); return (bg[3] > 0.15 && bg[3] < 0.97) || cs.backdropFilter !== 'none'; // translucent dimmer, not an opaque page layer
  });
  const topScrim = scrims.length ? scrims[scrims.length - 1] : null;
  function zOf(el) {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.position !== 'static' && cs.zIndex !== 'auto') return parseInt(cs.zIndex, 10) || 0;
    }
    return 0;
  }
  function inertBehindScrim(el) {
    if (!topScrim) return false;
    if (topScrim === el || topScrim.contains(el)) return false;
    const zs = zOf(topScrim); // effective stacking level (the scrim itself is often z-auto inside a z-50 wrapper)
    const ze = zOf(el);
    if (ze > zs) return false;                                                                   // lives above the scrim (the dialog panel)
    if (ze === zs && (topScrim.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) return false; // same layer, painted after the scrim
    return true;                                                                                 // underneath it: inert page content
  }
  const EMOJI_ONLY = /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\u200d\ufe0f\s]+$/u;
  function srOnly(el) {
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return (r.width <= 2 && r.height <= 2) || (cs.clip && cs.clip !== 'auto' && /rect\(0/.test(cs.clip)) || /\bsr-only\b/.test(el.className || '');
  }
  function describe(el) {
    const cls = (e) => (typeof e.className === 'string' ? e.className : (e.className && e.className.baseVal) || '').replace(/\s+/g, ' ').trim();
    const anc = [];
    for (let n = el.parentElement, i = 0; n && i < 6; n = n.parentElement, i++) anc.push(n.tagName.toLowerCase() + '|' + cls(n).slice(0, 160));
    return { tag: el.tagName.toLowerCase(), cls: cls(el), anc };
  }
  function visible(el) {
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    return true;
  }
  function notOccluded(el, rect) {
    const pts = [[0.5, 0.5], [0.15, 0.5], [0.85, 0.5], [0.5, 0.2], [0.5, 0.8]];
    for (const [fx, fy] of pts) {
      const x = Math.min(VW - 1, Math.max(0, rect.left + rect.width * fx)), y = Math.min(VH - 1, Math.max(0, rect.top + rect.height * fy));
      const top = document.elementFromPoint(x, y);
      if (!top) return false;
      if (top === el || el.contains(top) || top.contains(el)) continue;
      if (getComputedStyle(el).pointerEvents !== 'none') return false;
    }
    return true;
  }

  const findings = [];
  function report(kind, el, rects, fgRGBA, sizeInfo, textSample) {
    const samples = sample(rects);
    if (!samples.length) return;
    const oc = opacityChain(el);
    if (oc < 0.1) return; // mid-fade / effectively invisible
    const alpha = fgRGBA[3] * (kind === 'icon' ? 1 : 1) * oc;
    const ratios = [];
    const rs = [], gs = [], bs = [];
    for (const [r, g, b] of samples) {
      const R = fgRGBA[0] * alpha + r * (1 - alpha), G = fgRGBA[1] * alpha + g * (1 - alpha), B = fgRGBA[2] * alpha + b * (1 - alpha);
      ratios.push(ratio(L(R, G, B), L(r, g, b)));
      rs.push(r); gs.push(g); bs.push(b);
    }
    ratios.sort((a, b) => a - b);
    const worst = ratios[Math.floor(ratios.length * 0.05)];
    const med = (arr) => { arr = arr.slice().sort((a, b) => a - b); return arr[Math.floor(arr.length / 2)]; };
    const bgR = med(rs), bgG = med(gs), bgB = med(bs);
    const fR = fgRGBA[0] * alpha + bgR * (1 - alpha), fG = fgRGBA[1] * alpha + bgG * (1 - alpha), fB = fgRGBA[2] * alpha + bgB * (1 - alpha);
    const { size, weight } = sizeInfo;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const required = kind === 'icon' ? 3 : (large ? 3 : 4.5);
    const r0 = rects[0];
    findings.push({
      kind, ratio: +worst.toFixed(2), required, fg: hex(fR, fG, fB), bg: hex(bgR, bgG, bgB), size: +size.toFixed(1), weight, text: (textSample || '').slice(0, 50),
      ...describe(el), rect: [Math.round(r0.left), Math.round(r0.top), Math.round(r0.width), Math.round(r0.height)], fail: worst < required,
    });
  }

  // ── text nodes ──
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const byParent = new Map();
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (!n.data || !n.data.trim()) continue;
    const p = n.parentElement;
    if (!p || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|OPTION)$/.test(p.tagName)) continue;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(n);
  }
  for (const [p, nodes] of byParent) {
    if (seen.has(p)) continue;
    if (!visible(p)) continue;
    if (p.closest(':disabled, [aria-disabled="true"]')) continue;
    if (srOnly(p) || inertBehindScrim(p)) continue;
    const joined = nodes.map((n) => n.data).join('').trim();
    if (EMOJI_ONLY.test(joined)) continue;
    const cs = getComputedStyle(p);
    const rects = [];
    for (const n of nodes) {
      const rg = document.createRange(); rg.selectNodeContents(n);
      for (const rc of rg.getClientRects()) if (rc.width > 1 && rc.height > 1 && rc.bottom > 0 && rc.top < VH && rc.right > 0 && rc.left < VW) rects.push(rc);
    }
    if (!rects.length) continue;
    if (!notOccluded(p, rects[0])) continue;
    const fill = cs.webkitTextFillColor && cs.webkitTextFillColor !== '' ? cs.webkitTextFillColor : cs.color;
    const fg = parseColor(fill);
    if (fg[3] === 0) continue; // gradient/clip text or invisible
    seen.add(p);
    report('text', p, rects, fg, { size: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight, 10) || 400 }, nodes.map((n) => n.data.trim()).join(' '));
  }

  // ── form fields: value text + placeholder ──
  for (const f of document.querySelectorAll('input, textarea, select')) {
    if (seen.has(f) || !visible(f) || f.disabled || inertBehindScrim(f)) continue;
    const t = (f.getAttribute('type') || 'text').toLowerCase();
    if (['hidden', 'checkbox', 'radio', 'file', 'range', 'color'].includes(t)) continue;
    const rc = f.getBoundingClientRect();
    if (rc.width < 4 || rc.height < 4 || rc.bottom < 0 || rc.top > VH || rc.right < 0 || rc.left > VW) continue;
    if (!notOccluded(f, rc)) continue;
    const cs = getComputedStyle(f);
    const fs0 = parseFloat(cs.fontSize) || 14; const textLen = (f.value || f.getAttribute('placeholder') || '').length;
    const wEst = Math.max(12, Math.min(rc.width - 16, textLen * fs0 * 0.58));
    const inner = { left: rc.left + 12, top: rc.top + 6, right: rc.left + 12 + wEst, bottom: rc.bottom - 6, width: wEst, height: rc.height - 12 };
    seen.add(f);
    if (f.value) report('field-text', f, [inner], parseColor(cs.color), { size: parseFloat(cs.fontSize), weight: 400 }, f.value);
    const ph = f.getAttribute('placeholder');
    if (ph && !f.value) {
      const pcs = getComputedStyle(f, '::placeholder');
      report('placeholder', f, [inner], parseColor(pcs.color), { size: parseFloat(cs.fontSize), weight: 400 }, ph);
    }
  }

  // ── form-field boundaries (WCAG 1.4.11): the control must be distinguishable from what surrounds it ──
  for (const f of document.querySelectorAll('input, textarea, select, [role=combobox]')) {
    if (!visible(f) || f.disabled || inertBehindScrim(f)) continue;
    const t = (f.getAttribute('type') || 'text').toLowerCase();
    if (['hidden', 'checkbox', 'radio', 'file', 'range', 'color', 'submit', 'button'].includes(t)) continue;
    const rc = f.getBoundingClientRect();
    if (rc.width < 40 || rc.height < 20 || rc.bottom < 0 || rc.top > VH || rc.right < 0 || rc.left > VW) continue;
    const cs = getComputedStyle(f);
    let bw = parseFloat(cs.borderTopWidth) || 0; let bc = parseColor(cs.borderTopColor); let bel = f; let brc = rc;
    if (bw === 0) { // borderless <input> inside a bordered wrapper (search bars etc.): measure the wrapper's boundary
      let w = f.parentElement;
      for (let i = 0; i < 3 && w; i++, w = w.parentElement) {
        const wcs = getComputedStyle(w); const wr = w.getBoundingClientRect();
        if ((parseFloat(wcs.borderTopWidth) || 0) > 0 && wr.width <= rc.width + 80 && wr.height <= rc.height + 40) { bw = parseFloat(wcs.borderTopWidth); bc = parseColor(wcs.borderTopColor); bel = w; brc = wr; break; }
      }
    }
    const ring = [
      { left: brc.left - 9, top: brc.top + brc.height / 2 - 2, right: brc.left - 5, bottom: brc.top + brc.height / 2 + 2 },
      { left: brc.right + 5, top: brc.top + brc.height / 2 - 2, right: brc.right + 9, bottom: brc.top + brc.height / 2 + 2 },
      { left: brc.left + brc.width / 2 - 4, top: brc.top - 9, right: brc.left + brc.width / 2 + 4, bottom: brc.top - 5 },
    ].filter((r) => r.left >= 0 && r.right <= VW && r.top >= 0 && r.bottom <= VH);
    const so = sample(ring); const fi = sample([{ left: rc.left + 6, top: rc.top + 5, right: rc.right - 6, bottom: rc.top + 9 }]);
    if (!so.length || !fi.length) continue;
    const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
    const S = [med(so.map((p) => p[0])), med(so.map((p) => p[1])), med(so.map((p) => p[2]))];
    const F = [med(fi.map((p) => p[0])), med(fi.map((p) => p[1])), med(fi.map((p) => p[2]))];
    const bAlpha = bw > 0 ? bc[3] : 0;
    const B = [bc[0] * bAlpha + S[0] * (1 - bAlpha), bc[1] * bAlpha + S[1] * (1 - bAlpha), bc[2] * bAlpha + S[2] * (1 - bAlpha)];
    const borderRatio = bw > 0 ? ratio(L(B[0], B[1], B[2]), L(S[0], S[1], S[2])) : 0;
    const fillRatio = ratio(L(F[0], F[1], F[2]), L(S[0], S[1], S[2]));
    const best = Math.max(borderRatio, fillRatio);
    findings.push({ kind: 'field-boundary', ratio: +best.toFixed(2), required: 3, fg: hex(B[0], B[1], B[2]), bg: hex(S[0], S[1], S[2]), size: 0, weight: 0, text: (f.getAttribute('placeholder') || f.getAttribute('aria-label') || t).slice(0, 40), ...describe(f), rect: [Math.round(rc.left), Math.round(rc.top), Math.round(rc.width), Math.round(rc.height)], fail: best < 3 });
  }

  // ── icons ──
  for (const s of document.querySelectorAll('svg')) {
    if (seen.has(s) || !visible(s)) continue;
    if (s.closest(':disabled, [aria-disabled="true"]')) continue;
    if (inertBehindScrim(s)) continue;
    if (s.querySelector('[fill]:not([fill="none"]):not([fill="currentColor"])')) continue; // multi-colour brand mark
    const rc = s.getBoundingClientRect();
    if (rc.width < 6 || rc.height < 6 || rc.bottom < 0 || rc.top > VH || rc.right < 0 || rc.left > VW) continue;
    if (s.closest('[aria-hidden="true"]') && !s.closest('button, a, [role=button]')) continue;
    if (!notOccluded(s, rc)) continue;
    const cs = getComputedStyle(s);
    // Icons often set stroke/fill=currentColor on child paths only; the root then reports default black.
    const geo = s.querySelector('path, circle, rect, line, polyline, polygon, ellipse');
    const gcs = geo ? getComputedStyle(geo) : null;
    const pick = (c) => (c && c.stroke && c.stroke !== 'none' ? c.stroke : (c && c.fill && c.fill !== 'none' ? c.fill : null));
    let paint = pick(gcs) || pick(cs);
    if (!paint) continue;
    const fg = parseColor(paint);
    if (fg[3] === 0) continue;
    seen.add(s);
    const lbl = (s.parentElement && s.parentElement.textContent || '').trim();
    report('icon', s, [rc], fg, { size: 24, weight: 400 }, 'icon' + (lbl ? ' beside "' + lbl.slice(0, 20) + '"' : ' (icon-only)'));
  }
  return findings;
}
module.exports = { auditInPage: auditInPage.toString(), focusInPage: focusInPage.toString() };

async function focusInPage(arg) {
  const { seenKey } = arg;
  const parse = (c) => { const mm = c.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/); if (!mm) return null; let a = mm[4] === undefined ? 1 : (mm[4].endsWith('%') ? parseFloat(mm[4]) / 100 : parseFloat(mm[4])); return [+mm[1], +mm[2], +mm[3], a]; };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const Lm = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const hex = (r, g, b) => '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
  const VW = window.innerWidth, VH = window.innerHeight;
  function surround(el) { let n = el.parentElement; let acc = null; const layers = []; while (n) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c[3] > 0) { layers.push(c); if (c[3] >= 0.99) break; } n = n.parentElement; } let base = [255, 255, 255]; for (let i = layers.length - 1; i >= 0; i--) { const c = layers[i]; base = [c[0] * c[3] + base[0] * (1 - c[3]), c[1] * c[3] + base[1] * (1 - c[3]), c[2] * c[3] + base[2] * (1 - c[3])]; } return base; }
  const seen = (window[seenKey] = window[seenKey] || new WeakSet());
  const els = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=tab], [role=menuitem], [role=switch], [tabindex]:not([tabindex="-1"])')]
    .filter((e) => { const r = e.getBoundingClientRect(); return r.width > 8 && r.height > 8 && r.bottom > 0 && r.top < VH && r.right > 0 && r.left < VW && !e.disabled && getComputedStyle(e).visibility !== 'hidden'; }).slice(0, 40);
  const out = [];
  for (const el of els) {
    if (seen.has(el)) continue; seen.add(el);
    try { el.focus({ focusVisible: true }); } catch (e) { el.focus(); }
    if (document.activeElement !== el) continue;
    const cs = getComputedStyle(el);
    let ind = null, how = '';
    if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) { ind = parse(cs.outlineColor); how = 'outline'; }
    if (!ind || ind[3] < 0.1) {
      const sh = cs.boxShadow || '';
      const mm = [...sh.matchAll(/(rgba?\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px\s+([\d.]+)px/g)].filter((x) => parseFloat(x[5]) >= 1 && parseFloat(x[4]) <= 1);
      if (mm.length) { ind = parse(mm[mm.length - 1][1]); how = 'ring'; }
    }
    const bg = surround(el); const bgL = Lm(bg[0], bg[1], bg[2]);
    let r = 0, fg = '#000000';
    if (ind && ind[3] > 0.1) { const c = [ind[0] * ind[3] + bg[0] * (1 - ind[3]), ind[1] * ind[3] + bg[1] * (1 - ind[3]), ind[2] * ind[3] + bg[2] * (1 - ind[3])]; r = ratio(Lm(c[0], c[1], c[2]), bgL); fg = hex(c[0], c[1], c[2]); }
    const cls = (typeof el.className === 'string' ? el.className : '').replace(/\s+/g, ' ').trim();
    const rc = el.getBoundingClientRect();
    out.push({ kind: ind ? 'focus-ring' : 'focus-none', ratio: +r.toFixed(2), required: 3, fg, bg: hex(bg[0], bg[1], bg[2]), size: 0, weight: 0, text: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40) + ' [' + how + ']', tag: el.tagName.toLowerCase(), cls, anc: [], rect: [Math.round(rc.left), Math.round(rc.top), Math.round(rc.width), Math.round(rc.height)], fail: r < 3 });
    el.blur();
  }
  return out;
}
