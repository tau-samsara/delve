  // ---------------------------------------------------------------------------
  // Wider view. The guide shows 12 hours before and after now, scrolling sideways, opening 30 minutes before now. Programs
  // come from the site's own scheduling code: a helper runs in the page's world, imports the site's main script, and
  // answers with every channel's rows as JSON. The view is drawn with the site's row and cell classes.
  // ---------------------------------------------------------------------------
  const HOUR = 3600000;
  const WIDE_BACK_H = 12, WIDE_AHEAD_H = 12;
  const WIDE_STEP_H = 24, WIDE_MAX_H = 48, WIDE_STALE_MS = 2 * HOUR;   // grow 24 h at a time, up to 2 days each way
  // from / to: range the loaded rows cover (ms); base: when the view was first loaded (the limit counts from it)
  const wide = { status: 'idle', data: null, base: 0, from: 0, to: 0, extending: false, extFailUntil: 0, t0: 0, pxh: 0, infoW: 0, sig: '' };
  const wideCellData = new WeakMap();   // program cell -> { id, s, e, title, year, dur, aid }
  let wideRoot = null;

  // Runs in the page (see injectSiteHelper); self-contained because it is serialized to text.
  function siteHelper() {
    if (window.__delveSite) return;
    window.__delveSite = true;
    var api = null;
    function reply(payload) {
      var box = document.getElementById('delve-site-data');
      if (!box) { box = document.createElement('script'); box.type = 'application/json'; box.id = 'delve-site-data'; document.documentElement.appendChild(box); }
      box.textContent = JSON.stringify(payload);
      document.dispatchEvent(new CustomEvent('delve-site-res', { detail: String(payload.id) }));
    }
    async function find() {
      if (api) return api;
      var tag = Array.prototype.find.call(document.querySelectorAll('script[src]'), function (s) { return /\/assets\/index-[^/]+\.js/.test(s.src); });
      var url = tag ? tag.src : performance.getEntriesByType('resource').map(function (e) { return e.name; }).find(function (n) { return /\/assets\/index-[^/?]+\.js/.test(n); });
      if (!url) throw new Error('site script not found');
      var m = await import(url);
      var vals = Object.keys(m).map(function (k) { return m[k]; });
      var sched = vals.find(function (v) { return typeof v === 'function' && /nowSeconds/.test(v) && /maxRows/.test(v) && /hours/.test(v); });
      var chans = vals.find(function (v) { return Array.isArray(v) && v.length > 3 && v[0] && typeof v[0] === 'object' && 'id' in v[0] && 'playlist' in v[0]; });
      var load = vals.find(function (v) { return typeof v === 'function' && /\.playlist\?Promise\.resolve\(/.test(v); });
      if (!sched || !chans || !load) throw new Error('site functions not found');
      api = { sched: sched, chans: chans, load: load };
      return api;
    }
    document.addEventListener('delve-site-req', async function (e) {
      var req;
      try { req = JSON.parse(e.detail); } catch (x) { return; }
      try {
        var a = await find();
        var list = a.chans.filter(function (c) { return c && !c.comingSoon; });
        await Promise.allSettled(list.map(function (c) { return a.load(c); }));
        var out = {};
        list.forEach(function (c) {
          if (!c.playlist) return;
          try {
            var r = a.sched(c.playlist, { nowSeconds: req.from / 1000, hours: req.hours, maxRows: 600 });
            out[c.id] = r.rows.map(function (x) { return [x.startTime.getTime(), x.endTime.getTime(), x.item.title, x.item.year || '', Math.round(x.item.duration || 0), x.item.id || '']; });
          } catch (x) { /* this channel is left out */ }
        });
        reply({ id: req.id, ok: Object.keys(out).length > 0, channels: out, err: Object.keys(out).length ? '' : 'no channels' });
      } catch (x) { reply({ id: req.id, ok: false, err: String((x && x.message) || x) }); }
    });
  }
  function injectSiteHelper() {
    if (root.hasAttribute('data-delve-helper')) return;
    root.setAttribute('data-delve-helper', '1');
    try {
      const s = document.createElement('script');
      s.textContent = '(' + siteHelper.toString() + ')();';
      (document.head || root).appendChild(s);
      s.remove();
    } catch (e) { /* blocked: the view reports itself unavailable */ }
  }
  let siteReq = 0;
  function siteRequest(from, hours) {
    injectSiteHelper();
    return new Promise((resolve, reject) => {
      const id = String(++siteReq);
      const done = fn => { clearTimeout(timer); document.removeEventListener('delve-site-res', on); fn(); };
      const on = e => {
        if (e.detail !== id) return;
        const box = document.getElementById('delve-site-data');
        let res = null;
        try { res = JSON.parse(box.textContent); } catch (x) { /* bad reply */ }
        done(() => res && res.id === id ? resolve(res) : reject(new Error('bad reply')));
      };
      const timer = setTimeout(() => done(() => reject(new Error('timeout'))), 20000);
      document.addEventListener('delve-site-res', on);
      document.dispatchEvent(new CustomEvent('delve-site-req', { detail: JSON.stringify({ id, from, hours }) }));
    });
  }

  const WIDE_CSS = `
html[data-delve-wide] :is(.app--guide, .app--watch:not(.app--channel)) .tv-grid { position: relative; overflow-x: auto; }
html[data-delve-wide] :is(.app--guide, .app--watch:not(.app--channel)) .tv-grid > .tv-grid-body { position: absolute; left: 0; right: 0; top: 0; height: 0; overflow: hidden; visibility: hidden; pointer-events: none; }
/* In watch mode the page scrolls and the guide is as tall as its content. Wide gives every guide "flex: 1 1 0", which
   shrinks it to nothing with the site's rows out of flow, so size it by content. */
html[data-delve-wide] .app--watch:not(.app--channel) .tv-grid { flex: 0 0 auto; }
/* Guide text is not selectable (as on the site). */
.delve-wide-body, .delve-wide-body *, .delve-bar { -webkit-user-select: none; user-select: none; }
.delve-dragging, .delve-dragging * { cursor: grabbing !important; }
.delve-bar { left: 0; }
.delve-bar-note { margin-left: 8px; opacity: .85; font-size: 12px; }
.delve-wide-body { position: relative; display: flex; flex-direction: column; flex: 0 0 auto; width: var(--dw-w); }
.delve-wide-body > .grid-time-header { display: flex; position: sticky; z-index: 6 !important; }   /* the theme sets z-index 3 with a more specific rule, below the channel cells (4) */
.delve-wide-body > .grid-time-header > .grid-time-label-cell { position: sticky; left: 0; z-index: 6; flex: 0 0 var(--dw-info); width: var(--dw-info); box-sizing: border-box; }
.delve-wide-body > .grid-time-header > .grid-time-axis { flex: 0 0 var(--dw-track); width: var(--dw-track); position: relative; }
.delve-wide-body .grid-time-axis .grid-time-label { position: absolute; }
.delve-wide-row.grid-row { display: flex; }
/* Layout containment: while the page animates a mode change the site resizes the guide every frame, and without this the
   browser re-lays-out every cell (and sticky title) each frame. Measured: guide -> watch dropped from ~27 ms to 8 ms per frame. */
/* Layout containment makes each row its own stacking layer, so a line drawn once across the guide (Now line, day lines)
   would paint over the channel cells. Style containment alone doubles the mode-change cost (frame gaps 94-146 ms vs 48-83 ms),
   so those lines are drawn per row inside the track: above programs, below the channel cell. */
.delve-wide-row { contain: layout style; }
.delve-wide-row .grid-program { contain: layout style paint; }
/* Each row's track is 20,000+ px wide with hundreds of cells; the browser skips cells far outside the scroll view.
   Measured: building the guide dropped from ~110 ms to 38 ms. The intrinsic size keeps the scroll width unchanged. */
.delve-wide-row .grid-programs { content-visibility: auto; contain-intrinsic-size: auto var(--dw-track) 44px; }
.delve-wide-row > .grid-channel-info { position: sticky; left: 0; z-index: 4; flex: 0 0 var(--dw-info); width: var(--dw-info); box-sizing: border-box; }
/* Sticky channel cells and the hour row's corner must be solid, or scrolling programs show through. The guide's background
   is a fixed vertical gradient, so a solid layer under each channel cell repeats it pinned to the guide's box (under the
   cell, so the site's hover and highlight colors still paint over it). The layer is one pixel taller than the cell and ends
   in the row separator so nothing shows through between cells. */
.delve-wide-body > .grid-time-header > .grid-time-label-cell { background: var(--dw-head-bg, #200057); }
.delve-wide-under { position: sticky; left: 0; z-index: 3; flex: 0 0 var(--dw-info); width: var(--dw-info); margin-right: calc(var(--dw-info) * -1); margin-bottom: -1px; align-self: stretch; box-sizing: border-box; border-bottom: 1px solid var(--dw-line, #000a30);
  background-color: #001040; background-image: var(--dw-grid-bg, none); background-attachment: fixed; background-size: var(--dw-gw) var(--dw-gh); background-position: var(--dw-gleft) var(--dw-gtop); }
.delve-wide-row > .grid-programs { flex: 0 0 var(--dw-track); width: var(--dw-track); position: relative; align-self: stretch; }
.delve-wide-row .grid-program.delve-past { opacity: .5; }
/* The playing program stands out: yellow fill and title. */
.delve-wide-row .grid-program.current { background: rgba(255, 230, 0, .16) !important; }   /* !important: the theme colours the playing cell with a more specific rule */
.delve-wide-row .grid-program.current .grid-program-title { color: var(--8s-yellow, #ffd740) !important; }
/* Titles stay in view: the text block is sticky just right of the channel column. Cells and tracks use "overflow: clip"
   so they are not scroll containers and sticky still follows the guide's scroll. */
.delve-wide-row > .grid-programs, .delve-wide-row .grid-program { overflow: clip; }
.delve-cell-text { position: sticky; left: calc(var(--dw-info) + 10px); align-self: flex-start; max-width: 100%; width: max-content; min-width: 0; display: flex; flex-direction: column; }
.delve-cell-text > * { min-width: 0; }
.delve-wide-day { position: absolute; top: 0; bottom: 0; width: 1px; z-index: 1; pointer-events: none; background: rgba(255, 255, 255, .35); }
`;

  const clockText = sec => {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
    return h ? h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') : m + ':' + String(s).padStart(2, '0');
  };
  const hourLabel = d => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const dayLabel = d => d.toLocaleDateString([], { weekday: 'short', month: 'numeric', day: 'numeric' }).replace(',', '').toUpperCase();

  function loadWide() {
    if (wide.status === 'loading') return;
    wide.status = 'loading';
    const base = Date.now();
    siteRequest(base - WIDE_BACK_H * HOUR, WIDE_BACK_H + WIDE_AHEAD_H).then(res => {
      if (!res.ok) throw new Error(res.err || 'no data');
      wide.data = {}; mergeWide(res.channels);
      wide.base = base; wide.from = base - WIDE_BACK_H * HOUR; wide.to = base + WIDE_AHEAD_H * HOUR;
      wide.status = 'ready'; wide.sig = '';
    }).catch(err => {
      console.warn('[delve] wider view unavailable:', err && err.message);
      wide.status = 'failed'; wide.failedAt = Date.now();
    }).then(() => ensureGuide());
  }

  // Add rows to what is held, one row per start time per channel.
  function mergeWide(chs) {
    Object.keys(chs).forEach(id => {
      const have = wide.data[id] || [];
      const seen = new Set(have.map(r => r[0]));
      chs[id].forEach(r => { if (!seen.has(r[0])) { have.push(r); seen.add(r[0]); } });
      have.sort((a, b) => a[0] - b[0]);
      wide.data[id] = have;
    });
  }

  // Scrolling near an end asks for another 24 hours in that direction (up to 2 days each way from `base`).
  function extendWide(dir) {
    if (wide.status !== 'ready' || wide.extending || Date.now() < wide.extFailUntil) return;
    let from, hours, nf = wide.from, nt = wide.to;
    if (dir < 0) {
      if (wide.from <= wide.base - WIDE_MAX_H * HOUR) return;
      nf = Math.max(wide.base - WIDE_MAX_H * HOUR, wide.from - WIDE_STEP_H * HOUR);
      from = nf; hours = (wide.from - nf) / HOUR + 1;          // one hour of overlap
    } else {
      if (wide.to >= wide.base + WIDE_MAX_H * HOUR) return;
      nt = Math.min(wide.base + WIDE_MAX_H * HOUR, wide.to + WIDE_STEP_H * HOUR);
      from = wide.to - HOUR; hours = (nt - wide.to) / HOUR + 1;
    }
    wide.extending = true;
    siteRequest(from, hours).then(res => {
      if (!res.ok) throw new Error(res.err || 'no data');
      mergeWide(res.channels);
      wide.from = nf; wide.to = nt; wide.sig = '';
    }).catch(err => {
      console.warn('[delve] could not load more of the wider view:', err && err.message);
      wide.extFailUntil = Date.now() + 60000;
    }).then(() => { wide.extending = false; ensureGuide(); });
  }
  // Click and drag scrolls the guide: moving the mouse with the button held moves the guide (sideways, and vertically where
  // the guide scrolls). A drag does not count as a click on what is under the mouse.
  let dragClickPending = false;
  (function installDrag() {
    let st = null;
    document.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || !wideRoot) return;
      const t = e.target;
      if (!t.closest || !t.closest('.delve-wide-body') || t.closest('a, button, input, select, textarea, .delve-star')) return;
      const grid = wideRoot.parentNode;
      st = { x: e.clientX, y: e.clientY, l: grid.scrollLeft, t: grid.scrollTop, moved: false, grid };
    }, true);
    document.addEventListener('pointermove', e => {
      if (!st) return;
      const dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (!st.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      st.moved = true;
      root.classList.add('delve-dragging');
      if (nowLocked && Math.abs(dx) >= 5) unlockNow();   // sideways drag breaks the lock
      if (!nowLocked) st.grid.scrollLeft = st.l - dx;
      st.grid.scrollTop = st.t - dy;
    }, true);
    const end = () => {
      if (!st) return;
      const moved = st.moved;
      st = null;
      root.classList.remove('delve-dragging');
      if (moved) { dragClickPending = true; setTimeout(() => { dragClickPending = false; }, 80); }   // swallow the click that follows the release
    };
    document.addEventListener('pointerup', end, true);
    document.addEventListener('pointercancel', end, true);
    window.addEventListener('blur', end);
  })();

  // Now lock: the view follows the Now line until the user scrolls sideways.
  let nowLocked = true, lockAnimUntil = 0;
  function unlockNow() { if (nowLocked) { nowLocked = false; updateNowBtn(); } }
  document.addEventListener('wheel', e => {   // slow sideways wheel / trackpad moves are too small to notice from the position alone
    if (!nowLocked || !wideRoot || !e.target.closest || !e.target.closest('.delve-wide-body')) return;
    if (e.deltaX !== 0 && Math.abs(e.deltaX) >= Math.abs(e.deltaY) || e.shiftKey) unlockNow();
  }, { capture: true, passive: true });

  let wideScrollGrid = null;
  function onWideScroll() {
    const g = wideScrollGrid;
    if (!wideRoot || !g) return;
    if (nowLocked && performance.now() > lockAnimUntil && Math.abs(g.scrollLeft - wideNowLeft()) > 2) nowLocked = false;
    ensureCells(g, false);
    updateNowBtn();
    const thr = g.clientWidth;                                  // within one screen of an end
    if (g.scrollLeft < thr) extendWide(-1);
    else if (g.scrollWidth - g.clientWidth - g.scrollLeft < thr) extendWide(1);
  }

  function removeWide() {
    if (wideRoot) { wideRoot.remove(); wideRoot = null; }
    root.removeAttribute('data-delve-wide');
    wide.sig = ''; wideUnders = []; wideBgKey = ''; wideTracks = []; wideWin = null;
  }

  // The site draws each channel logo as an SVG of up to 136 <rect>s; copied into every row that was ~4,300 elements to style
  // and lay out on every mode change. The copy shows the logo as one rasterized <img>, serialized once per distinct logo.
  const logoUrls = new Map();
  function lightInfo(info) {
    const c = info.cloneNode(true);
    c.querySelectorAll(':scope > svg').forEach(s => {
      let url = null;
      try {
        const key = s.outerHTML;
        url = logoUrls.get(key);
        if (!url) { url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(s)); logoUrls.set(key, url); }
      } catch (e) { return; }   // keep the SVG copy if it cannot be serialized
      const img = el('img', s.getAttribute('class') || '');
      img.alt = ''; img.setAttribute('aria-hidden', 'true'); img.draggable = false;
      img.width = parseFloat(s.getAttribute('width')) || 32; img.height = parseFloat(s.getAttribute('height')) || 32;
      img.style.cssText = s.getAttribute('style') || '';
      img.src = url;
      s.replaceWith(img);
    });
    return c;
  }

  function buildWide(grid, sbody) {
    const srows = Array.from(sbody.querySelectorAll(':scope > .grid-row'));
    // measure a row that is shown: rows hidden by the Favorites filter have no size
    const mrow = srows.find(r => !r.hasAttribute('data-delve-hide')) || srows[0];
    const info0 = mrow && mrow.querySelector('.grid-channel-info'), progs0 = mrow && mrow.querySelector('.grid-programs');
    if (!info0 || !progs0) {
      if (mrow) warnMissing(!info0 ? '.grid-channel-info' : '.grid-programs', 'Extended guide');
      return;
    }
    const infoW = Math.round(info0.getBoundingClientRect().width), progW = progs0.getBoundingClientRect().width;
    if (!infoW || progW < 80) return;   // not laid out yet (or caught mid-animation): try again on the next pass
    const pxh = progW / settings.zoom;           // pixels per hour
    const sig = [wide.base, wide.from, wide.to, Math.round(pxh), infoW, srows.map(r => r.dataset.channel).join(',')].join('|');
    if (sig === wide.sig && wideRoot && wideRoot.isConnected) return;
    wide.sig = sig;
    wideTracks = []; wideWin = null;

    const t0 = Math.floor(wide.from / HOUR) * HOUR;
    const t1 = Math.ceil(wide.to / HOUR) * HOUR;
    const trackW = (t1 - t0) / HOUR * pxh;
    // the time in the middle of the screen stays put when the view is rebuilt (more hours added, or a new zoom)
    const prevCenterT = wide.t0 && wideRoot ? wide.t0 + (grid.scrollLeft + wide.visW / 2) / wide.pxh * HOUR : null;

    const body = el('div', 'delve-wide-body');
    body.style.setProperty('--dw-info', infoW + 'px');
    body.style.setProperty('--dw-track', trackW + 'px');
    body.style.setProperty('--dw-w', (infoW + trackW) + 'px');
    try {   // the site's own backgrounds, copied so the sticky cells can be solid
      body.style.setProperty('--dw-head-bg', getComputedStyle(sbody.querySelector('.grid-time-header')).backgroundColor);
      body.style.setProperty('--dw-grid-bg', getComputedStyle(grid).backgroundImage);
      body.style.setProperty('--dw-line', getComputedStyle(srows[0]).borderBottomColor);
    } catch (e) { warnMissing('.grid-time-header', 'Extended guide site colors'); }

    // hour row
    const head = el('div', 'grid-time-header');
    const siteLabelCell = sbody.querySelector('.grid-time-header .grid-time-label-cell');
    head.append(siteLabelCell ? siteLabelCell.cloneNode(true) : el('div', 'grid-time-label-cell', 'CHANNEL'));
    const axis = el('div', 'grid-time-axis');
    const dayXs = [];   // day line positions (drawn in every row's track)
    // label spacing follows the zoom: the smallest step that keeps labels about 200 px apart (hourly at the site's 3 hours)
    const stepMin = [15, 30, 60, 120, 180, 360].find(m => m / 60 * pxh >= 200) || 360;
    const stepMs = stepMin * 60000;
    const dayStart = new Date(t0); dayStart.setHours(0, 0, 0, 0);
    for (let t = dayStart.getTime(); t < t1; t += stepMs) {
      if (t < t0) continue;
      const d = new Date(t), x = (t - t0) / HOUR * pxh;
      const midnight = d.getHours() === 0 && d.getMinutes() === 0;
      const lab = el('span', 'grid-time-label', midnight ? dayLabel(d) : hourLabel(d));
      lab.style.left = x + 'px';
      axis.append(lab);
      if (midnight) dayXs.push(x);
    }
    head.append(axis);
    body.append(head);

    // one row per channel, in the site's own order
    srows.forEach(srow => {
      const id = srow.dataset.channel;
      const rowEl = el('div', 'grid-row delve-wide-row');
      rowEl.dataset.channel = id;
      rowEl.append(el('div', 'delve-wide-under'));
      const info = srow.querySelector('.grid-channel-info');
      if (info) rowEl.append(lightInfo(info));
      const track = el('div', 'grid-programs');
      // cells are made on demand (ensureCells); the row keeps its programs here
      wideTracks.push({ id, track, items: (wide.data[id] || []).filter(it => it[1] > t0 && it[0] < t1), cells: new Map(), seg: null });
      dayXs.forEach(x => { const line = el('div', 'delve-wide-day'); line.style.left = x + 'px'; track.append(line); });
      rowEl.append(track);
      body.append(rowEl);
    });

    if (wideRoot) wideRoot.remove();
    grid.append(body);
    wideRoot = body;
    const visW = Math.max(1, grid.clientWidth - infoW);
    wide.t0 = t0; wide.pxh = pxh; wide.infoW = infoW; wide.visW = visW; wide.t1 = t1;
    root.setAttribute('data-delve-wide', '1');
    wideUnders = Array.from(body.querySelectorAll('.delve-wide-under')); wideBgKey = '';
    updateWideBg();
    // first time: open a little before now; after a rebuild keep the time that was in the middle of the screen
    if (prevCenterT === null) nowLocked = true;   // a fresh view starts locked to Now
    grid.scrollLeft = prevCenterT !== null && !nowLocked
      ? Math.max(0, (prevCenterT - t0) / HOUR * pxh - visW / 2)
      : wideNowLeft();
    ensureCells(grid, true);
    syncWide(true);
  }

  // Cells are made only for programs within a window around the scroll view and swapped as the view moves: the extended
  // guide holds thousands of programs, and every cell costs style and layout on each mode change. Tracks keep their full
  // width, so scroll width and cell positions don't change.
  const WIDE_BUF = 1, WIDE_EDGE = 0.35;   // screens of cells kept each side of the view; the window moves when under 0.35 screen is left
  let wideTracks = [], wideWin = null, wideSel = null;   // wideSel: { id, s } of the cell shown in the info card, kept when its cell is made again
  function makeCell(rt, it, now) {
    const s = it[0], e = it[1], id = rt.id;
    const ls = Math.max(s, wide.t0), le = Math.min(e, wide.t1);
    const c = el('div', 'grid-program');
    c.style.left = ((ls - wide.t0) / HOUR * wide.pxh) + 'px';
    c.style.width = Math.max(2, (le - ls) / HOUR * wide.pxh - 3) + 'px';
    c.title = it[2] + ' (' + clockText(it[4]) + ')';
    const ti = el('span', 'grid-program-title', it[2]);
    if (it[3]) ti.append(el('span', 'grid-program-year', it[3]));
    const txt = el('div', 'delve-cell-text');   // title and length stick to the left while the cell scrolls past
    txt.append(ti, el('span', 'grid-program-duration', clockText(it[4])));
    c.append(txt);
    c.dataset.s = s; c.dataset.e = e;
    if (e <= now) c.classList.add('delve-past');
    else if (s <= now) c.classList.add('current');
    if (wideSel && wideSel.id === id && wideSel.s === s) c.setAttribute('data-delve-sel', '1');
    wideCellData.set(c, { id, s, e, title: it[2], year: it[3], dur: it[4], aid: it[5] });
    return c;
  }
  function ensureCells(grid, force) {
    if (!wideRoot || !wideTracks.length || !grid) return;
    const vw = Math.max(1, grid.clientWidth);
    const x0 = grid.scrollLeft - wide.infoW, x1 = x0 + vw;   // the view, in the track's own pixels
    if (!force && wideWin && x0 >= wideWin.a + vw * WIDE_EDGE && x1 <= wideWin.b - vw * WIDE_EDGE) return;
    const a = x0 - vw * WIDE_BUF, b = x1 + vw * WIDE_BUF;
    wideWin = { a, b };
    const ta = wide.t0 + a / wide.pxh * HOUR, tb = wide.t0 + b / wide.pxh * HOUR, now = Date.now();
    wideTracks.forEach(rt => {
      const keep = new Set(), add = document.createDocumentFragment();
      rt.items.forEach(it => {
        if (it[1] <= ta || it[0] >= tb) return;
        keep.add(it[0]);
        if (!rt.cells.has(it[0])) { const c = makeCell(rt, it, now); rt.cells.set(it[0], c); add.append(c); }
      });
      rt.cells.forEach((c, k) => { if (!keep.has(k)) { c.remove(); rt.cells.delete(k); } });
      rt.track.append(add);
    });
  }

  // Scroll position that puts the left edge a sixth of the window before now (30 minutes at the default 3 hours).
  function wideNowLeft() {
    return Math.max(0, (Date.now() - settings.zoom * HOUR / 6 - wide.t0) / HOUR * wide.pxh);
  }
  function scrollWideToNow(smooth) {
    const grid = document.querySelector(':is(.app--guide, .app--watch:not(.app--channel)) .tv-grid');
    if (!grid || !wideRoot) return;
    nowLocked = true;
    lockAnimUntil = performance.now() + 1200;   // the scroll itself must not count as the user breaking the lock
    grid.scrollTo({ left: wideNowLeft(), behavior: smooth ? 'smooth' : 'auto' });
    updateNowBtn();
  }
  // The Now button shows while the view is not locked to the Now line.
  function updateNowBtn() {
    if (!nowBtn) return;
    if (!settings.extended) { if (!nowBtn.hidden) nowBtn.hidden = true; return; }
    const off = !!wideRoot && !nowLocked;
    if (nowBtn.hidden !== !off) nowBtn.hidden = !off;
  }
  // While locked, keep the view on the Now line as time passes (called every frame).
  function followNow() {
    if (!nowLocked || !wideRoot || !wideRoot.isConnected) return;
    const g = wideRoot.parentNode, want = wideNowLeft();
    if (performance.now() < lockAnimUntil) {
      if (Math.abs(g.scrollLeft - want) < 2) lockAnimUntil = 0;   // arrived
      return;
    }
    if (Math.abs(g.scrollLeft - want) >= 0.5) g.scrollLeft = want;
  }

  // Where the guide's box is on screen (the channel cells' background is pinned to it); changes on page scroll or resize.
  // The four numbers are set only on the per-row background layers, not the guide root: a custom property there is inherited
  // by thousands of elements (~8 ms per update vs 0.3 ms). Nothing is written when unchanged; scroll / resize events are
  // handled once per frame.
  let wideUnders = [], wideBgKey = '', wideBgQueued = false;
  function updateWideBg() {
    const grid = document.querySelector(':is(.app--guide, .app--watch:not(.app--channel)) .tv-grid');
    if (!wideRoot || !grid) return;
    const r = grid.getBoundingClientRect();
    const v = [grid.clientWidth, grid.clientHeight, r.left + grid.clientLeft, r.top + grid.clientTop];
    const key = v.join(',');
    if (key === wideBgKey) return;
    wideBgKey = key;
    wideUnders.forEach(u => {
      const st = u.style;
      st.setProperty('--dw-gw', v[0] + 'px');
      st.setProperty('--dw-gh', v[1] + 'px');
      st.setProperty('--dw-gleft', v[2] + 'px');
      st.setProperty('--dw-gtop', v[3] + 'px');
    });
  }
  const queueWideBg = () => {
    if (wideBgQueued) return;
    wideBgQueued = true;
    requestAnimationFrame(() => { wideBgQueued = false; updateWideBg(); });
  };
  window.addEventListener('scroll', queueWideBg, { passive: true });
  window.addEventListener('resize', queueWideBg);

  // Playing / finished styling, and the site's highlighted / tuned row, mirrored onto our rows.
  // Cells (thousands) are checked once a second; rows (one per channel) every time.
  let lastCellSync = 0;
  function syncWide(force) {
    if (!wideRoot) return;
    const now = Date.now();
    if (force || now - lastCellSync >= 1000) {
      lastCellSync = now;
      wideRoot.querySelectorAll('.grid-program').forEach(c => {
        const past = +c.dataset.e <= now, cur = +c.dataset.s <= now && now < +c.dataset.e;
        if (c.classList.contains('delve-past') !== past) c.classList.toggle('delve-past', past);
        if (c.classList.contains('current') !== cur) c.classList.toggle('current', cur);
      });
    }
    const site = new Map();
    document.querySelectorAll(':is(.app--guide, .app--watch:not(.app--channel)) .tv-grid > .tv-grid-body > .grid-row').forEach(r => site.set(r.dataset.channel, r));
    wideRoot.querySelectorAll(':scope > .grid-row').forEach(r => {
      const s = site.get(r.dataset.channel);
      ['highlighted', 'active'].forEach(k => { const on = !!s && s.classList.contains(k); if (r.classList.contains(k) !== on) r.classList.toggle(k, on); });
      if (s) mirrorChild(s.querySelector('.grid-channel-name-wrap'), r.querySelector('.grid-channel-name-wrap'), '.grid-channel-tags');
    });
    const siteHeadCell = document.querySelector(':is(.app--guide, .app--watch:not(.app--channel)) .tv-grid > .tv-grid-body > .grid-time-header .grid-time-label-cell');
    mirrorChild(siteHeadCell, wideRoot.querySelector(':scope > .grid-time-header .grid-time-label-cell'), '.grid-time-viewers');
  }

  // The watch counts reach the site's rows after the wider view was copied from them, and change while it is open.
  function mirrorChild(siteParent, wideParent, selector) {
    if (!siteParent || !wideParent) return;
    const from = siteParent.querySelector(selector), to = wideParent.querySelector(selector);
    if (!from) { if (to) to.remove(); }
    else if (!to) wideParent.append(from.cloneNode(true));
    else if (to.outerHTML !== from.outerHTML) to.replaceWith(from.cloneNode(true));
  }

  let resizeQuietAt = 0, wideHoldUntil = 0;
  function ensureWide() {
    if (Date.now() < wideHoldUntil) return;   // a mode change is animating: touch nothing until it finishes, then build once at the final size
    if (wideRoot && Date.now() < resizeQuietAt) return;   // the window is being resized: keep what is there until it stops
    const grid = document.querySelector(':is(.app--guide, .app--watch:not(.app--channel)) .tv-grid');
    const sbody = grid && grid.querySelector(':scope > .tv-grid-body');
    if (!sbody || !settings.extended) {   // not on the guide view, or the extended guide is switched off
      if (wideRoot || root.hasAttribute('data-delve-wide')) removeWide();
      return;
    }
    if (wide.status === 'failed' && Date.now() - (wide.failedAt || 0) > 60000) wide.status = 'idle';   // try again after a minute
    // Turned on again after a long time away: what was held is out of date, start again.
    if (wide.status === 'ready' && !wideRoot && Date.now() - wide.base > WIDE_STALE_MS) { wide.status = 'idle'; wide.data = null; }
    if (wide.status === 'idle') { loadWide(); return; }
    if (wide.status === 'failed') return;
    if (wide.data) buildWide(grid, sbody);
    // the clock is nearing the end of the loaded range: extend
    if (wideRoot && Date.now() > wide.to - 2 * HOUR) extendWide(1);
    if (wideRoot && wideScrollGrid !== grid) {
      if (wideScrollGrid) wideScrollGrid.removeEventListener('scroll', onWideScroll);
      wideScrollGrid = grid;
      grid.addEventListener('scroll', onWideScroll, { passive: true });
    }
  }

