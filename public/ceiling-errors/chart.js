// The ceiling-error charts (public/ceiling-errors/index.html). Kept apart
// from the page so the page's Content-Security-Policy can refuse inline
// script, as the dashboard's does. It draws; the figures, curves and
// percentiles come from ceiling-errors.json (scripts/ceilingChartData.ts),
// and it computes only its axes. docs/ceiling-heights.md, "The chart".
(() => {
  // The data file's layout this page reads (scripts/ceilingChartData.ts
  // writes it); a file of another version is refused.
  const DATA_VERSION = 2;
  const BAND_LABEL = {
    LIFR: 'Under 500 ft', IFR: '500 to 999 ft', MVFR: '1,000 to 3,000 ft', VFR: 'Over 3,000 ft', none: 'No ceiling',
  };
  const BIN_VARS = ['--lo-4', '--lo-3', '--lo-2', '--lo-1', '--mid', '--hi-1', '--hi-2', '--hi-3', '--hi-4'];
  const BAND_VARS = { LIFR: '--b-lifr', IFR: '--b-ifr', MVFR: '--b-mvfr', VFR: '--b-vfr', none: '--b-none' };
  const leadLabel = (r) => (r.minLeadH ? `${r.minLeadH} h or more ahead` : 'Latest');
  const state = { site: 'DZ', lead: 0, by: 'forecast', unit: 'ft' };
  try {
    const saved = JSON.parse(localStorage.getItem('ceiling-errors-view') || 'null');
    if (saved && typeof saved === 'object') Object.assign(state, saved);
  } catch (e) { /* storage unavailable: defaults stand */ }
  let data = null;
  let fileNote = '';

  const $ = (id) => document.getElementById(id);
  // Token values, read once per render: the charts draw with the theme's
  // colours, and a theme change re-renders.
  let tokens = new Map();
  const css = (v) => {
    if (!tokens.has(v)) tokens.set(v, getComputedStyle(document.documentElement).getPropertyValue(v).trim());
    return tokens.get(v);
  };
  const fmt = (n) => Math.abs(n).toLocaleString('en-US');
  const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(n);
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const el = (tag, attrs = {}, text) => {
    const ns = ['svg', 'g', 'rect', 'line', 'text', 'path', 'clipPath', 'defs', 'circle', 'title'].includes(tag);
    const n = ns ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    return n;
  };
  const luminance = (hex) => {
    const m = hex.replace('#', '').match(/../g);
    if (!m) return 1;
    const [r, g, b] = m.map((x) => { const c = parseInt(x, 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const inkOn = (hex) => (luminance(hex) > 0.28 ? '#0b0b0b' : '#ffffff');

  function save() { try { localStorage.setItem('ceiling-errors-view', JSON.stringify(state)); } catch (e) { /* ignore */ } }

  // Buttons are kept while their options stay the same, so a click does not
  // take keyboard focus away from the control it was made on.
  function seg(id, options, key) {
    const box = $(id);
    const sig = JSON.stringify(options);
    if (box.dataset.sig !== sig) {
      box.dataset.sig = sig;
      box.replaceChildren();
      for (const [value, label] of options) {
        const b = el('button', { type: 'button' }, label);
        b.addEventListener('click', () => { state[key] = value; save(); render(); });
        box.append(b);
      }
    }
    options.forEach(([value], i) => box.children[i].setAttribute('aria-pressed', String(state[key] === value)));
  }

  // One tooltip per chart, placed beside the pointer or the focused mark.
  function tipFor(chart) {
    let tip = chart.querySelector('.tip');
    if (!tip) { tip = el('div', { class: 'tip', role: 'status' }); tip.hidden = true; chart.append(tip); }
    return tip;
  }
  function bindTip(chart, mark, lines) {
    const tip = tipFor(chart);
    const show = (x, y) => {
      tip.replaceChildren();
      tip.append(el('strong', {}, lines[0]));
      for (const l of lines.slice(1)) tip.append(el('div', { class: 'k' }, l));
      tip.hidden = false;
      const box = chart.getBoundingClientRect();
      const w = tip.offsetWidth;
      let left = x - box.left + 12;
      if (left + w > box.width) left = Math.max(0, x - box.left - w - 12);
      tip.style.left = left + 'px';
      tip.style.top = Math.max(0, y - box.top - tip.offsetHeight - 10) + 'px';
    };
    mark.addEventListener('pointermove', (e) => show(e.clientX, e.clientY));
    mark.addEventListener('pointerleave', () => { tip.hidden = true; });
    mark.addEventListener('focus', () => { const r = mark.getBoundingClientRect(); show(r.left + r.width / 2, r.top); });
    mark.addEventListener('blur', () => { tip.hidden = true; });
  }

  // A saved or stale choice the data does not hold falls back to the first
  // option, and the controls show the fallback.
  function current() {
    let point = data.points.find((p) => p.site === state.site);
    if (!point) { point = data.points[0]; state.site = point.site; }
    if (!point.rows[state.lead]) state.lead = 0;
    if (state.by !== 'forecast' && state.by !== 'reported') state.by = 'forecast';
    if (state.unit !== 'ft' && state.unit !== 'ratio') state.unit = 'ft';
    return { point, row: point.rows[state.lead] };
  }

  function rowHead(svg, y, width, left, right) {
    svg.append(el('text', { x: 0, y, fill: css('--ink'), 'font-size': 13.5, 'font-weight': 600 }, left));
    svg.append(el('text', { x: width, y, fill: css('--muted'), 'font-size': 12.5, 'text-anchor': 'end' }, right));
  }

  // Chart 1: diverging stacked bars, centred on the middle of "within 100".
  function drawSize(row) {
    const chart = $('ch-size');
    chart.replaceChildren();
    const dist = state.by === 'forecast' ? row.byForecast : row.byReported;
    const width = Math.max(280, chart.clientWidth);
    const rowH = 54, barH = 20, top = 4, axisH = 26;
    const rows = data.bands.map((b) => ({ band: b, d: dist[b] })).filter((r) => r.d && r.d.n > 0);
    const shares = rows.map((r) => r.d.bins.map((c) => c / r.d.n));
    let ext = 0.1;
    for (const s of shares) {
      ext = Math.max(ext, s.slice(0, 4).reduce((a, b) => a + b, 0) + s[4] / 2, s.slice(5).reduce((a, b) => a + b, 0) + s[4] / 2);
    }
    ext = Math.ceil(ext * 10) / 10;
    const cx = width / 2;
    const x = (f) => cx + (f / ext) * (width / 2 - 2);
    const height = top + rows.length * rowH + axisH;
    const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Share of hours by size of the difference, per band' });
    const defs = el('defs');
    svg.append(defs);
    // As few labels as fit: a band of a few hours can stretch this axis to
    // 100% each side, and eleven labels ran together at phone width.
    const maxTicks = width < 420 ? 5 : 9;
    const step = [0.1, 0.2, 0.25, 0.5, 1].find((st) => 2 * Math.ceil(ext / st - 1e-9) + 1 <= maxTicks) || 1;
    // The axis runs to the next tick past the longest bar, so its end is labelled.
    ext = Math.ceil(ext / step - 1e-9) * step;
    const nTicks = Math.round(ext / step);
    for (let k = -nTicks; k <= nTicks; k++) {
      const t = k * step;
      const xx = x(t);
      svg.append(el('line', { x1: xx, x2: xx, y1: top + 16, y2: height - axisH + 4, stroke: Math.abs(t) < 1e-9 ? css('--axis') : css('--grid'), 'stroke-width': 1 }));
      svg.append(el('text', { x: xx, y: height - 8, fill: css('--muted'), 'font-size': 11.5, 'text-anchor': 'middle' }, `${Math.round(Math.abs(t) * 100)}%`));
    }
    rows.forEach((r, i) => {
      const y0 = top + i * rowH;
      rowHead(svg, y0 + 13, width, `${BAND_LABEL[r.band]} · ${r.band}`, `${r.d.n.toLocaleString('en-US')} h`);
      const by = y0 + 22;
      const s = shares[i];
      let start = -(s.slice(0, 4).reduce((a, b) => a + b, 0) + s[4] / 2);
      const left = x(start);
      const right = x(start + s.reduce((a, b) => a + b, 0));
      const clip = el('clipPath', { id: `clip-size-${i}` });
      clip.append(el('rect', { x: left, y: by, width: Math.max(0, right - left), height: barH, rx: 4 }));
      defs.append(clip);
      const g = el('g', { 'clip-path': `url(#clip-size-${i})` });
      svg.append(g);
      s.forEach((f, k) => {
        if (f <= 0) { return; }
        const x0 = x(start), x1 = x(start + f);
        start += f;
        const w = Math.max(0, x1 - x0 - 2);
        const fill = css(BIN_VARS[k]);
        const mark = el('rect', { x: x0 + 1, y: by, width: w, height: barH, fill, tabindex: 0, 'aria-label': `${data.bins[k]} ft: ${pct(r.d.bins[k], r.d.n)}%` });
        g.append(mark);
        const label = `${Math.round(f * 100)}%`;
        if (w >= label.length * 7 + 8 && f >= 0.06) {
          svg.append(el('text', { x: x0 + 1 + w / 2, y: by + 14.5, fill: inkOn(fill), 'font-size': 11.5, 'font-weight': 600, 'text-anchor': 'middle', 'pointer-events': 'none' }, label));
        }
        bindTip(chart, mark, [`${pct(r.d.bins[k], r.d.n)}% of hours`, `${data.bins[k]} ft`, `${r.d.bins[k]} of ${r.d.n} hours, ${BAND_LABEL[r.band].toLowerCase()}`]);
      });
    });
    chart.append(svg);
  }

  function binLegend() {
    const lg = $('lg-size');
    lg.replaceChildren();
    lg.append(el('span', { class: 'side' }, 'Forecast below:'));
    for (let k = 0; k < 4; k++) lg.append(swatch(BIN_VARS[k], data.bins[k].replace(' low', '')));
    lg.append(swatch('--mid', 'within 100 ft'));
    lg.append(el('span', { class: 'side' }, 'above:'));
    for (let k = 5; k < 9; k++) lg.append(swatch(BIN_VARS[k], data.bins[k].replace(' high', '')));
  }
  function swatch(v, text) {
    const s = el('span');
    const i = el('i');
    i.style.background = css(v);
    s.append(i, document.createTextNode(text));
    return s;
  }

  // Chart 2: a raincloud per band. The cloud is the density of the hours'
  // differences (each band scaled to its own peak, so shapes compare, not
  // heights); under it, the 10th to 90th percentile line, the middle half
  // and the median; under that, every hour as a dot. Curves and percentiles
  // come from the data file; the page only places them.
  function drawSpread(row) {
    const chart = $('ch-spread');
    chart.replaceChildren();
    const dist = state.by === 'forecast' ? row.byForecast : row.byReported;
    const ratio = state.unit === 'ratio';
    // Each band's points on the drawing's scale, lowest first as the file
    // gives them: ft, or log2 of forecast ÷ reported.
    const rows = data.bands.map((b) => ({ band: b, d: dist[b] })).filter((r) => r.d && r.d.n > 0)
      .map((r) => ({ ...r, v: ratio ? r.d.ratios.filter((x) => x > 0).map(Math.log2) : r.d.values }));
    const width = Math.max(280, chart.clientWidth);
    const narrow = width < 620;
    const head = narrow ? 38 : 22, cloudH = 34, gap = 6, rainH = 20, top = 4, axisH = 26;
    const rowH = head + cloudH + gap + rainH + 14;
    const height = top + rows.length * rowH + axisH;
    // The axis spans the 5th to the 95th percentile of all the points shown,
    // pooled, so a band of two hours cannot stretch it (wider, the long
    // tails above 3,000 ft squeezed the low bands to a sliver); points past
    // it sit at the edge, counted there.
    const pooled = rows.flatMap((r) => r.v).sort((a, b) => a - b);
    const nr = (p) => pooled[Math.min(pooled.length, Math.max(1, Math.ceil(p * pooled.length))) - 1];
    let lo = Math.min(0, pooled.length ? nr(0.05) : 0);
    let hi = Math.max(0, pooled.length ? nr(0.95) : 0);
    const maxTicks = narrow ? 5 : 9;
    let ticks;
    if (ratio) {
      // Whole doublings, every `step` of them, and always through ×1.
      lo = Math.floor(lo); hi = Math.ceil(hi);
      if (hi - lo < 2) { lo -= 1; hi += 1; }
      const step = Math.ceil((hi - lo) / (maxTicks - 1));
      lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
      ticks = []; for (let e = lo; e <= hi; e += step) ticks.push(e);
    } else {
      const step = [250, 500, 1000, 2000, 4000, 8000].find((st) => (Math.ceil(hi / st) - Math.floor(lo / st)) + 1 <= maxTicks) || 8000;
      lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
      if (hi === lo) hi = lo + step;
      ticks = []; for (let t = lo; t <= hi; t += step) ticks.push(t);
    }
    const x0 = 8, x1 = width - 8;
    // Unclamped for the cloud (clipped to the plot instead), clamped for dots
    // and marks, which sit at the edge when past it.
    const xu = (v) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
    const x = (v) => xu(Math.min(hi, Math.max(lo, v)));
    const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': ratio ? 'Forecast over reported, distribution per band' : 'Forecast minus reported in feet, distribution per band' });
    const defs = el('defs'); svg.append(defs);
    const clip = el('clipPath', { id: 'clip-spread' });
    clip.append(el('rect', { x: x0, y: 0, width: x1 - x0, height }));
    defs.append(clip);
    for (const t of ticks) {
      const xx = x(t);
      const isRef = t === 0;
      svg.append(el('line', { x1: xx, x2: xx, y1: top + 16, y2: height - axisH + 4, stroke: isRef ? css('--axis') : css('--grid'), 'stroke-width': 1 }));
      const label = ratio ? `×${2 ** t}` : t === 0 ? '0' : `${t > 0 ? '+' : '−'}${Math.abs(t) >= 1000 ? Math.abs(t) / 1000 + 'k' : Math.abs(t)}`;
      const anchor = t === ticks[0] ? 'start' : t === ticks[ticks.length - 1] ? 'end' : 'middle';
      svg.append(el('text', { x: anchor === 'start' ? xx - 4 : anchor === 'end' ? xx + 4 : xx, y: height - 8, fill: css('--muted'), 'font-size': 11.5, 'text-anchor': anchor }, label));
    }
    rows.forEach((r, i) => {
      const q = ratio ? r.d.ratio : r.d.diffFt;
      const qx = q && (ratio ? q.map((v) => x(Math.log2(v))) : q.map(x));
      const y0 = top + i * rowH;
      const base = y0 + head + cloudH;
      const desc = !q ? 'no ratio: every report at 0 ft'
        : ratio ? `median ×${q[2]} · middle half ×${q[1]} to ×${q[3]}`
        : `median ${signed(q[2])} ft · middle half ${signed(q[1])} to ${signed(q[3])}`;
      const title = `${BAND_LABEL[r.band]} · ${r.band}`;
      if (narrow) {
        svg.append(el('text', { x: 0, y: y0 + 13, fill: css('--ink'), 'font-size': 13.5, 'font-weight': 600 }, title));
        svg.append(el('text', { x: 0, y: y0 + 30, fill: css('--muted'), 'font-size': 12.5, 'data-fit': width }, desc));
      } else {
        rowHead(svg, y0 + 13, width, title, desc);
      }
      const g = el('g', { tabindex: 0, 'aria-label': `${title}: ${desc}, ${r.d.n} hours` });
      g.append(el('rect', { x: x0, y: y0 + head, width: x1 - x0, height: cloudH + gap + rainH + 6, fill: 'transparent' }));
      // The cloud, or a word where there are too few hours for one.
      const curve = r.d.density && (ratio ? r.d.density.log2Ratio : r.d.density.ft);
      if (curve && curve.length) {
        const peak = Math.max(...curve.map((c) => c[1])) || 1;
        let dpath = `M ${xu(curve[0][0]).toFixed(1)} ${base}`;
        for (const [cx, cy] of curve) dpath += ` L ${xu(cx).toFixed(1)} ${(base - (cy / peak) * cloudH).toFixed(1)}`;
        dpath += ` L ${xu(curve[curve.length - 1][0]).toFixed(1)} ${base} Z`;
        g.append(el('path', { d: dpath, fill: css('--accent-wash'), stroke: css('--accent'), 'stroke-width': 1.5, 'stroke-linejoin': 'round', 'clip-path': 'url(#clip-spread)' }));
      } else {
        g.append(el('text', { x: x0 + 2, y: base - 6, fill: css('--muted'), 'font-size': 11.5 }, `${r.d.n} hours: too few for a curve`));
      }
      // Percentiles on the cloud's base line.
      if (qx) {
        g.append(el('line', { x1: qx[0], x2: qx[4], y1: base, y2: base, stroke: css('--ink-2'), 'stroke-width': 1.5, 'stroke-linecap': 'round' }));
        g.append(el('rect', { x: qx[1], y: base - 4, width: Math.max(2, qx[3] - qx[1]), height: 8, rx: 2, fill: css('--surface'), stroke: css('--ink-2'), 'stroke-width': 1.2 }));
        g.append(el('line', { x1: qx[2], x2: qx[2], y1: base - 7, y2: base + 7, stroke: css('--ink'), 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
      }
      // The rain: every hour, spread down the band by a fixed sequence so
      // the dots sit still between redraws.
      const v = r.v;
      const rainTop = base + gap + 2;
      const opacity = v.length > 200 ? 0.35 : v.length > 50 ? 0.5 : 0.75;
      let under = 0, over = 0;
      v.forEach((p, k) => {
        if (p < lo) under++;
        if (p > hi) over++;
        g.append(el('circle', { cx: x(p).toFixed(1), cy: (rainTop + ((k * 0.6180339887) % 1) * rainH).toFixed(1), r: 1.9, fill: css('--accent'), 'fill-opacity': opacity }));
      });
      const edgeNote = (n, side) => g.append(el('text', { x: side === 'lo' ? x0 : x1, y: rainTop + rainH + 11, fill: css('--muted'), 'font-size': 11, 'text-anchor': side === 'lo' ? 'start' : 'end' }, side === 'lo' ? `‹ ${n} further left` : `${n} further right ›`));
      if (under) edgeNote(under, 'lo');
      if (over) edgeNote(over, 'hi');
      svg.append(g);
      const f = (val) => (ratio ? `×${val}` : `${signed(val)} ft`);
      bindTip(chart, g, q
        ? [`median ${f(q[2])}`, `middle half ${f(q[1])} to ${f(q[3])}`, `10th to 90th ${f(q[0])} to ${f(q[4])}`, `${r.d.n.toLocaleString('en-US')} hours`]
        : [desc, `${r.d.n} hours`]);
    });
    chart.append(svg);
    // A figures line wider than the chart shrinks to fit rather than run off it.
    for (const t of svg.querySelectorAll('[data-fit]')) {
      const room = Number(t.getAttribute('data-fit'));
      const len = t.getComputedTextLength();
      if (len > room) t.setAttribute('font-size', (12.5 * room / len).toFixed(2));
    }
    const lg = $('lg-spread');
    lg.replaceChildren();
    const key = (styler, text) => { const k = el('span'); const i = el('i'); styler(i.style); k.append(i, document.createTextNode(text)); lg.append(k); };
    key((st) => { st.background = css('--accent-wash'); st.boxShadow = `inset 0 0 0 1.5px ${css('--accent')}`; st.borderRadius = '6px 6px 0 0'; }, 'how the hours spread (each band to its own peak)');
    key((st) => { st.background = css('--accent'); st.width = '6px'; st.height = '6px'; st.borderRadius = '50%'; }, 'one hour');
    key((st) => { st.background = css('--surface'); st.boxShadow = `inset 0 0 0 1.2px ${css('--ink-2')}`; st.height = '8px'; }, 'middle half');
    key((st) => { st.background = css('--ink'); st.width = '3px'; }, 'median');
    key((st) => { st.background = css('--ink-2'); st.height = '2px'; st.width = '16px'; }, '10th to 90th percentile');
    $('h2-spread').textContent = ratio ? 'The spread, as forecast ÷ reported' : 'The spread, in feet';
    $('s2-spread').textContent = ratio
      ? 'The same hours on a doubling scale. ×1 is a forecast equal to the report; ×2 is twice its height.'
      : 'Forecast minus reported on the hours both had a ceiling. Negative: the forecast was lower.';
  }

  // Chart 3: for each band on the grouping side, the other side's bands.
  function drawBands(row) {
    const chart = $('ch-band');
    chart.replaceChildren();
    const cats = data.ceilingBands;
    const byForecast = state.by === 'forecast';
    $('h3-band').textContent = byForecast ? 'What KPMV reported, for each forecast band' : 'What was forecast, for each reported band';
    $('s3-band').textContent = byForecast
      ? 'Every hour with a forecast and a report, no ceiling on either side included.'
      : 'Every hour with a forecast and a report, no ceiling on either side included. Each row is what KPMV reported.';
    const rows = cats.map((c) => {
      const counts = cats.map((o) => (byForecast ? row.bands[o][c] : row.bands[c][o]));
      return { band: c, counts, n: counts.reduce((a, b) => a + b, 0) };
    }).filter((r) => r.n > 0);
    const width = Math.max(280, chart.clientWidth);
    const rowH = 54, barH = 20, top = 4, axisH = 26;
    const height = top + rows.length * rowH + axisH;
    const x = (f) => 1 + f * (width - 2);
    const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': $('h3-band').textContent });
    const defs = el('defs'); svg.append(defs);
    for (let t = 0; t <= 1.0001; t += 0.25) {
      svg.append(el('line', { x1: x(t), x2: x(t), y1: top + 16, y2: height - axisH + 4, stroke: css('--grid'), 'stroke-width': 1 }));
      svg.append(el('text', { x: x(t), y: height - 8, fill: css('--muted'), 'font-size': 11.5, 'text-anchor': t === 0 ? 'start' : t > 0.99 ? 'end' : 'middle' }, `${Math.round(t * 100)}%`));
    }
    rows.forEach((r, i) => {
      const y0 = top + i * rowH;
      rowHead(svg, y0 + 13, width, `${byForecast ? 'Forecast' : 'Reported'} ${BAND_LABEL[r.band].toLowerCase()}${r.band === 'none' ? '' : ' · ' + r.band}`, `${r.n.toLocaleString('en-US')} h`);
      const by = y0 + 22;
      const clip = el('clipPath', { id: `clip-band-${i}` });
      clip.append(el('rect', { x: x(0), y: by, width: x(1) - x(0), height: barH, rx: 4 }));
      defs.append(clip);
      const g = el('g', { 'clip-path': `url(#clip-band-${i})` });
      svg.append(g);
      let start = 0;
      r.counts.forEach((c, k) => {
        if (!c) return;
        const f = c / r.n;
        const x0 = x(start), x1 = x(start + f);
        start += f;
        const w = Math.max(0, x1 - x0 - 2);
        const fill = css(BAND_VARS[cats[k]]);
        const other = byForecast ? 'reported' : 'forecast';
        const mark = el('rect', { x: x0 + 1, y: by, width: w, height: barH, fill, tabindex: 0, 'aria-label': `${other} ${BAND_LABEL[cats[k]]}: ${pct(c, r.n)}%` });
        g.append(mark);
        const label = `${pct(c, r.n)}%`;
        if (w >= label.length * 7 + 8 && f >= 0.06) {
          svg.append(el('text', { x: x0 + 1 + w / 2, y: by + 14.5, fill: inkOn(fill), 'font-size': 11.5, 'font-weight': 600, 'text-anchor': 'middle', 'pointer-events': 'none' }, label));
        }
        bindTip(chart, mark, [`${pct(c, r.n)}% of hours`, `${other}: ${BAND_LABEL[cats[k]].toLowerCase()}`, `${c} of ${r.n} hours`]);
      });
    });
    chart.append(svg);
    const lg = $('lg-band');
    lg.replaceChildren();
    lg.append(el('span', { class: 'side' }, byForecast ? 'Reported:' : 'Forecast:'));
    for (const c of cats) lg.append(swatch(BAND_VARS[c], BAND_LABEL[c].toLowerCase()));
  }

  function table(caption, head, body) {
    const wrap = el('div', { class: 'scroll' });
    const t = el('table');
    t.append(el('caption', {}, caption));
    const thead = el('thead'); const tr = el('tr');
    for (const h of head) tr.append(el('th', { scope: 'col' }, h));
    thead.append(tr); t.append(thead);
    const tb = el('tbody');
    for (const r of body) { const row = el('tr'); r.forEach((c, i) => row.append(el(i ? 'td' : 'th', i ? {} : { scope: 'row' }, String(c)))); tb.append(row); }
    t.append(tb); wrap.append(t);
    return wrap;
  }

  function drawTables(row) {
    const box = $('tables');
    box.replaceChildren();
    const dist = state.by === 'forecast' ? row.byForecast : row.byReported;
    const side = state.by === 'forecast' ? "forecast's band" : 'reported band';
    const bands = data.bands.filter((b) => dist[b]);
    box.append(table(`Hours by size of the difference, ft, by the ${side}`, ['Band', 'Hours', ...data.bins],
      bands.map((b) => [b, dist[b].n, ...dist[b].bins.map((c) => `${c} (${pct(c, dist[b].n)}%)`)])));
    box.append(table(`Forecast − reported, ft, and forecast ÷ reported, by the ${side}`, ['Band', 'Hours', '10th', '25th', 'Median', '75th', '90th', '÷ 25th', '÷ median', '÷ 75th'],
      bands.map((b) => { const d = dist[b]; const q = d.diffFt || []; const r = d.ratio || []; return [b, d.n, ...[0, 1, 2, 3, 4].map((i) => (q[i] == null ? '–' : signed(q[i]))), ...[1, 2, 3].map((i) => (r[i] == null ? '–' : r[i]))]; })));
    const cats = data.ceilingBands;
    box.append(table('Hours by band (rows: reported; columns: forecast)', ['Reported \\ Forecast', ...cats, 'Total'],
      cats.map((rb) => { const cs = cats.map((fb) => row.bands[rb][fb]); return [rb, ...cs, cs.reduce((a, b) => a + b, 0)]; })));
  }

  function render() {
    if (!data) return;
    tokens = new Map();
    const { point, row } = current();
    seg('c-site', data.points.map((p) => [p.site, p.short]), 'site');
    seg('c-lead', point.rows.map((r, i) => [i, leadLabel(r)]), 'lead');
    seg('c-by', [['forecast', "Forecast's band"], ['reported', 'Reported band']], 'by');
    seg('c-unit', [['ft', 'Feet'], ['ratio', 'Ratio']], 'unit');
    const facts = $('facts');
    facts.replaceChildren();
    const fact = (b, t) => { const s = el('span'); s.append(el('b', {}, b), document.createTextNode(' ' + t)); facts.append(s); };
    fact(row.hours.toLocaleString('en-US'), 'hours compared');
    fact(row.call.both.toLocaleString('en-US'), 'with a ceiling on both sides');
    if (row.leadH) fact(`${row.leadH.min.toFixed(1)} to ${row.leadH.max.toFixed(1)} h`, 'ahead');
    if (point.issuances && point.issuances.span) {
      const day = (t) => t.slice(0, 10);
      fact(point.issuances.count.toLocaleString('en-US'), `forecasts issued ${day(point.issuances.span.from)} to ${day(point.issuances.span.to)}`);
    }
    if (point.gridKm != null) fact(`${point.gridKm} km`, `from ${point.place} to the grid point read`);
    binLegend();
    drawSize(row);
    drawSpread(row);
    drawBands(row);
    drawTables(row);
  }

  function describe() {
    const r = data.reports;
    const from = (s) => (s ? s.slice(0, 10) : '?');
    $('meta').textContent = `${r.count.toLocaleString('en-US')} KPMV reports, ${from(r.span && r.span.from)} to ${from(r.span && r.span.to)}. Data file made ${data.generatedAt.slice(0, 10)} from ${[...data.sources.ceiling, ...data.sources.cover].join(', ')}${data.sources.kept ? ` and ${data.sources.kept} kept forecast snapshots` : ''}.${fileNote}`;
  }

  const wellFormed = (d) =>
    d && d.version === DATA_VERSION && Array.isArray(d.bands) && Array.isArray(d.ceilingBands) && Array.isArray(d.bins) &&
    d.reports && d.sources && Array.isArray(d.points) && d.points.length > 0 &&
    d.points.every((p) => p.site && p.short && Array.isArray(p.rows) && p.rows.length > 0 &&
      p.rows.every((r) => r.call && r.bands && r.byForecast && r.byReported && typeof r.hours === 'number' &&
        [r.byForecast, r.byReported].every((by) => Object.values(by).every((b) => Array.isArray(b.values) && Array.isArray(b.ratios)))));

  // A file that does not draw leaves the page as it was.
  function accept(d, note) {
    if (!wellFormed(d)) throw new Error(`it is not a ceiling-errors data file of version ${DATA_VERSION}, the one with every hour in it`);
    const before = { data, fileNote };
    try {
      data = d; fileNote = note;
      describe();
      render();
    } catch (err) {
      data = before.data; fileNote = before.fileNote;
      if (data) { describe(); render(); }
      throw err;
    }
  }

  $('f-load').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      accept(JSON.parse(await f.text()), ` Showing ${f.name}, opened in this browser only.`);
      $('f-status').textContent = `Showing ${f.name}. Reload the page to go back to the published file.`;
    } catch (err) {
      $('f-status').textContent = `${f.name} was not shown: ${err.message}. The page still shows the data it had.`;
    }
  });

  // Redraw when the charts' column changes width (the window, or the notes
  // moving beside it); opening the table view only changes the height.
  let resizeTimer, lastWidth = 0;
  new ResizeObserver(([entry]) => {
    const w = Math.round(entry.contentRect.width);
    if (w === lastWidth) return;
    lastWidth = w;
    clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 80);
  }).observe(document.querySelector('.charts'));
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);

  fetch('ceiling-errors.json')
    .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then((d) => accept(d, ''))
    .catch((err) => {
      const m = $('meta');
      m.textContent = '';
      m.append(el('span', { class: 'error' }, `The data file ceiling-errors.json did not load (${err.message}). Open one with the file picker below.`));
    });
})();
