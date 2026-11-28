  // ---------------------------------------------------------------------------
  // Program info on click. Guide view only. The first click on a card shows its info under the video and leaves the
  // preview alone; a second click on the same card lets the site tune.
  // ---------------------------------------------------------------------------
  const DATA_BASE = 'https://data.spelunkr.tv/';
  function getJSON(url) {
    return fetch(url)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(err => {
        if (typeof GM_xmlhttpRequest !== 'function') throw err;
        return new Promise((resolve, reject) => GM_xmlhttpRequest({
          method: 'GET', url, responseType: 'json',
          onload: r => {
            if (r.status >= 300) return reject(new Error('HTTP ' + r.status));
            try { resolve(typeof r.response === 'string' ? JSON.parse(r.response) : r.response); }
            catch (e) { reject(e); }
          },
          onerror: reject,
        }));
      });
  }
  const dataCache = { lineup: null, lineupAt: 0, versions: new Map() };
  function getLineup() {
    if (dataCache.lineup && Date.now() - dataCache.lineupAt < 10 * 60 * 1000) return dataCache.lineup;
    dataCache.lineupAt = Date.now();
    dataCache.lineup = getJSON(DATA_BASE + 'lineup.json').catch(e => { dataCache.lineup = null; throw e; });
    return dataCache.lineup;
  }
  function getVersion(v) {
    const key = v.manifest;
    if (!dataCache.versions.has(key)) {
      dataCache.versions.set(key, Promise.all([getJSON(DATA_BASE + v.manifest), getJSON(DATA_BASE + v.details)])
        .then(([m, d]) => ({ m, d }))
        .catch(e => { dataCache.versions.delete(key); throw e; }));
    }
    return dataCache.versions.get(key);
  }
  function orderedVersions(ch) {
    const now = Date.now();
    const eff = v => (v.effectiveAtMs <= now ? 0 : 1);
    return (ch.versions || []).slice().sort((a, b) => eff(a) - eff(b) || b.v - a.v);
  }
  // Find the playlist item behind a guide cell. Returns { ch, item, detail }.
  async function findProgram(channelId, title, durSec) {
    const lineup = await getLineup();
    const ch = (lineup.channels || []).find(c => c.id === channelId);
    if (!ch) return { ch: null, item: null, detail: null };
    for (const v of orderedVersions(ch)) {
      const { m, d } = await getVersion(v);
      const hits = [];
      m.items.forEach((it, i) => { if (it.title === title) hits.push(i); });
      if (hits.length) {
        let idx = hits.find(i => Math.abs(m.items[i].duration - durSec) <= 1);
        if (idx === undefined) idx = hits[0];
        return { ch, item: m.items[idx], detail: (d.items || [])[idx] || {} };
      }
    }
    return { ch, item: null, detail: null };
  }

  function parseClock(str, ref) {
    const m = /(\d{1,2}):(\d{2})\s*([AP]M)?/i.exec(str || '');
    if (!m) return null;
    let h = +m[1];
    if (m[3]) { h = h % 12; if (/p/i.test(m[3])) h += 12; }
    let best = null;
    for (const dd of [-1, 0, 1]) {
      const d = new Date(ref);
      d.setDate(d.getDate() + dd);
      d.setHours(h, +m[2], 0, 0);
      if (!best || Math.abs(d - ref) < Math.abs(best - ref)) best = d;
    }
    return best;
  }
  // pct -> Date from the guide's own hourly axis labels, or null.
  function makeTimeMapper() {
    const labels = Array.from(document.querySelectorAll(':is(.app--guide, .app--watch:not(.app--channel)) .tv-grid-body .grid-time-label'))
      .map(e => ({ txt: e.textContent, pct: parseFloat(e.style.left) }))
      .filter(l => !isNaN(l.pct));
    if (labels.length < 2 || labels[1].pct === labels[0].pct) return null;
    const now = new Date();
    const t0 = parseClock(labels[0].txt, now);
    let t1 = parseClock(labels[1].txt, now);
    if (!t0 || !t1) return null;
    if (t1 <= t0) t1 = new Date(t1.getTime() + 86400000);
    const msPerPct = (t1 - t0) / (labels[1].pct - labels[0].pct);
    const map = pct => new Date(t0.getTime() + (pct - labels[0].pct) * msPerPct);
    map.msPerPct = msPerPct;                                          // ms per 1% of the window
    map.pctOf = d => labels[0].pct + (d.getTime() - t0.getTime()) / msPerPct;   // Date -> pct
    return map;
  }
  function readCell(cell) {
    const titleEl = cell.querySelector('.grid-program-title');
    const first = titleEl && titleEl.firstChild;
    const title = (first ? first.textContent : (cell.textContent || '')).trim();
    const yearEl = cell.querySelector('.grid-program-year');
    const durEl = cell.querySelector('.grid-program-duration');
    const parts = ((durEl && durEl.textContent) || '').trim().split(':').map(Number);
    const durSec = !parts.length || parts.some(isNaN) ? 0 : parts.reduce((a, p) => a * 60 + p, 0);
    return {
      title, year: yearEl ? yearEl.textContent.trim() : '', durSec,
      left: parseFloat(cell.style.left), width: parseFloat(cell.style.width),
      marathon: cell.classList.contains('marathon'), tip: cell.getAttribute('title') || '',
    };
  }
  // Marathon cells carry their show list in the tooltip: "NAME · 5 shows · 1h 20m\n2:03 PM  Title\n..."
  function parseMarathon(tip) {
    const lines = String(tip || '').split('\n').map(l => l.trim()).filter(Boolean);
    const shows = [];
    for (const l of lines.slice(1)) {
      const m = /^(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s+(.+)$/i.exec(l);
      if (m) shows.push({ time: m[1], title: m[2] });
    }
    return { head: lines[0] || '', shows };
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const warnedMissing = new Set();
  function warnMissing(selector, unavailableFeature) {
    const message = selector + ' not found; ' + unavailableFeature + ' unavailable';
    if (warnedMissing.has(message)) return;
    warnedMissing.add(message);
    console.warn('[delve] ' + message);
  }
  const fmtTime = d => d.toLocaleTimeString([], settings.clock24 ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : { hour: 'numeric', minute: '2-digit' });
  const fmtDur = sec => {
    const m = Math.round(sec / 60);
    return m >= 60 ? Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm' : m + ' min';
  };
  const highlightedChannel = () => {
    const hl = document.querySelector(':is(.app--guide, .app--watch:not(.app--channel)) .grid-row.highlighted');
    return hl ? hl.dataset.channel : null;
  };
  function statusText(start, end) {
    if (!start || !end) return '';
    const now = Date.now();
    if (now >= start && now < end) return 'On now';
    if (now < start) return 'Starts in ' + fmtDur((start - now) / 1000);
    return 'Aired earlier';
  }

  let panel = null;
  let progState = null;   // { channelId, baseline } while a program is shown
  let openToken = 0, lastHeight = 0, pollTimer = null;
  let lastInfo = null;    // { cell, info } of the card now shown, so a second click needs no new lookup

  // Split in watch mode: the guide sits beside the player, so program information works there too.
  const inSplitWatch = () => root.getAttribute('data-delve-layout') === 'split' && !!document.querySelector('.app--watch:not(.app--channel)');
  const hasProgramInfo = () => !!document.querySelector('.app--guide') || inSplitWatch();

  // Where the card lives: the guide's info column, or above the guide in Split's watch mode.
  function panelHost() {
    return document.querySelector('.app--guide .stage-info-col') || (inSplitWatch() ? document.querySelector('.app--watch') : null);
  }

  function ensurePanel() {
    const col = panelHost();
    if (!col) {
      if (document.querySelector('.app--guide')) warnMissing('.stage-info-col', 'Program information');
      return null;
    }
    if (!panel) panel = el('div', 'delve-prog');
    if (panel.parentNode !== col) {
      const anchor = col.querySelector(':scope > .guide-actions-divider') || col.querySelector(':scope > .guide-actions');
      col.insertBefore(panel, anchor || null);
    }
    return panel;
  }

  // The site's channel header shows the tuned channel; copy it for the clicked program's channel.
  function buildChannelHead(channelId, ch) {
    const siteHead = document.querySelector('.stage-info-col > .guide-info-channel-header');
    const row = channelId && document.querySelector('.tv-grid .grid-row[data-channel="' + CSS.escape(channelId) + '"]');
    const name = row && row.querySelector('.grid-channel-name-text');
    const num = row && row.querySelector('.grid-channel-num');
    if (!siteHead || !name || !num) {
      if (row) warnMissing(!siteHead ? '.guide-info-channel-header' : !name ? '.grid-channel-name-text' : '.grid-channel-num', 'Program information');
      return null;
    }
    const head = siteHead.cloneNode(true);
    const setText = (sel, txt) => { const n = head.querySelector(sel); if (n) n.textContent = txt; };
    setText('.guide-info-channel-name', name.textContent);
    setText('.guide-info-channel-num', 'CH ' + num.textContent.trim());
    const status = head.querySelector('.guide-info-status'); if (status) status.remove();
    const hIcon = head.querySelector(':scope > svg'), rIcon = row.querySelector('.grid-channel-info > svg');
    if (hIcon && rIcon) { const icon = rIcon.cloneNode(true); icon.setAttribute('class', hIcon.getAttribute('class') || ''); hIcon.replaceWith(icon); }
    const text = (ch && ch.description) || '';
    const desc = text ? el('div', 'guide-info-description', text) : null;
    return { head, desc };
  }

  // Small pixel icons in the site's crisp style: external-link arrow, copy, and copy check.
  const ICONS = {
    external: '<path d="M0 2h5v1H1v8h8V7h1v5H0zM7 0h5v5h-1V1H7zM5 6h1v1H5zM6 5h1v1H6zM7 4h1v1H7zM8 3h1v1H8zM9 2h1v1H9z"/>',
    copy: '<path d="M4 4h8v8H4z"/><path d="M0 0h8v2H2v6H0z"/>',
    check: '<path d="M1 6h2v2H1zM3 8h2v2H3zM5 6h2v2H5zM7 4h2v2H7zM9 2h2v2H9z"/>',
  };
  function icon(name) {
    const t = document.createElement('template');
    t.innerHTML = '<svg class="delve-icon" width="12" height="12" viewBox="0 0 12 12" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">' + ICONS[name] + '</svg>';
    return t.content.firstChild;
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.append(ta); ta.select();
      try { document.execCommand('copy') ? resolve() : reject(new Error('copy failed')); } catch (e) { reject(e); }
      ta.remove();
    });
  }
  // One link: label + "opens in a new tab" arrow, then a button that copies the address.
  function linkItem(label, href) {
    const box = el('span', 'delve-link');
    const a = el('a', null);
    a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.append(document.createTextNode(label), icon('external'));
    const btn = el('button', 'delve-copy');
    btn.type = 'button';
    btn.title = 'Copy link'; btn.setAttribute('aria-label', 'Copy ' + label + ' link');
    btn.append(icon('copy'));
    btn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      copyText(href).then(() => {
        btn.textContent = ''; btn.append(icon('check'));
        setTimeout(() => { btn.textContent = ''; btn.append(icon('copy')); }, 1200);
      }).catch(() => {});
    });
    box.append(a, btn);
    return box;
  }

  // IMDb / Internet Archive links, or null when the program has neither.
  // `block`: a site block that may already show a link (the watch page has its own "via archive.org" tag); that link is skipped.
  function makeLinks(detail, item, cls, block) {
    const links = el('div', (cls || 'guide-info-now-desc') + ' delve-prog-links');
    const siteHas = sel => !!block && !!block.querySelector(sel + ':not(.delve-link a)');
    if (detail && detail.imdbId && /^tt\d+$/.test(detail.imdbId) && !siteHas('a[href*="imdb.com/title"]')) {
      links.append(linkItem('IMDb', 'https://www.imdb.com/title/' + detail.imdbId + '/'));
    }
    if (item && item.id && !siteHas('a[href*="archive.org/details"]')) {
      links.append(linkItem('Internet Archive', 'https://archive.org/details/' + encodeURIComponent(item.id)));
    }
    return links.childNodes.length ? links : null;
  }

  // The same links in the site's "now playing" block (the tuned channel's current program).
  const nowCache = new Map();   // channel|title -> { detail, item }
  let nowPending = '';
  const clockSecs = s => {
    const p = String(s || '').replace(/[^\d:]/g, '').split(':').map(Number);
    return !p.length || p.some(isNaN) ? 0 : p.reduce((a, v) => a * 60 + v, 0);
  };
  function putNowLinks(block, key, cls) {
    const old = block.querySelector('.delve-now-links');
    if (old && old.dataset.key === key) return;
    if (old) old.remove();
    const hit = nowCache.get(key);
    const links = hit && makeLinks(hit.detail, hit.item, cls, block);
    if (!links) return;
    links.classList.add('delve-now-links');
    links.dataset.key = key;
    const anchor = block.querySelector('.vcr-progress');
    block.insertBefore(links, anchor || null);
  }
  // Where the site shows the playing program: the guide's info column, and the info under the player in watch and channel
  // mode. Each has its own title element and text class; the channel comes from the guide's highlighted row, or from the
  // address in watch/channel mode.
  const NOW_BLOCKS = [
    { block: '.app--guide .stage-info-col > .guide-info-now', title: '.guide-info-now-title', cls: 'guide-info-now-desc' },
    { block: '.app--watch .stage-player-info > .player-info-current', title: '.player-info-title', cls: 'player-info-desc' },
  ];
  function ensureNowLinks() {
    if (!settings.programInfo) { document.querySelectorAll('.delve-now-links').forEach(n => n.remove()); return; }
    NOW_BLOCKS.forEach(t => {
      const block = document.querySelector(t.block);
      if (!block) return;
      const chId = block.closest('.app--guide') ? highlightedChannel() : decodeURIComponent(location.pathname.split('/')[1] || '');
      const titleEl = block.querySelector(t.title);
      const title = titleEl && titleEl.textContent.trim();
      if (!chId || !title) return;
      const key = chId + '|' + title;
      if (nowCache.has(key)) return putNowLinks(block, key, t.cls);
      if (nowPending === key) return;
      nowPending = key;
      const el1 = block.querySelector('.vcr-elapsed'), el2 = block.querySelector('.vcr-remaining');
      const durSec = clockSecs(el1 && el1.textContent) + clockSecs(el2 && el2.textContent);
      findProgram(chId, title, durSec).then(found => {
        nowCache.set(key, { detail: found.detail, item: found.item });
      }).catch(() => {}).then(() => { nowPending = ''; ensureNowLinks(); });
    });
  }

  function render(info) {
    const p = ensurePanel();
    if (!p) return;
    p.textContent = '';
    p.style.height = lastHeight && p.parentNode.matches('.stage-info-col') ? lastHeight + 'px' : '';
    root.setAttribute('data-delve-prog', '1');
    root.removeAttribute('data-delve-loading');
    const { c, start, end, found } = info;
    const ch = found && found.ch, item = found && found.item, detail = (found && found.detail) || {};

    const now = el('div', 'delve-prog-now');
    const top = el('div', 'delve-prog-labelrow');
    // A program actually playing in the preview is labelled like the site's block.
    const siteTitle = (document.querySelector('.app--guide .stage-info-col > .guide-info-now .guide-info-now-title') || {}).textContent;
    const playing = statusText(start, end) === 'On now' && progState && progState.channelId === highlightedChannel() &&
      !!siteTitle && [c.title, item && item.title].some(t => t && t.trim() === siteTitle.trim());
    top.append(el('div', 'guide-info-now-label', playing ? 'Now playing' : (statusText(start, end) || 'Program')));

    const titleRow = el('div', 'guide-info-now-title-row');
    titleRow.append(el('div', 'guide-info-now-title', (item && item.title) || c.title));
    const year = (item && item.year) || c.year;
    if (year) titleRow.append(el('span', 'btag btag-ghost', year));
    if (detail.season != null && detail.episode != null) titleRow.append(el('span', 'btag btag-ghost', 'S' + detail.season + ' E' + detail.episode));

    const bits = [];
    if (start && end) bits.push(fmtTime(start) + ' – ' + fmtTime(end));
    const secs = (item && item.duration) || c.durSec || (start && end ? (end - start) / 1000 : 0);
    if (secs) bits.push(fmtDur(secs));
    if (ch && ch.name) bits.push(ch.name);
    const meta = el('div', 'guide-info-now-desc', bits.join('  ·  '));
    const chHead = buildChannelHead(progState && progState.channelId, ch);
    if (chHead) { p.append(chHead.head); if (chHead.desc) p.append(chHead.desc); }
    root.toggleAttribute('data-delve-hdr', !!chHead);
    now.append(top, titleRow, meta);
    p.append(now);

    if (c.marathon) {
      const mar = parseMarathon(c.tip);
      if (mar.shows.length) {
        now.append(el('div', 'guide-info-now-desc', (mar.head || 'Marathon block') + ':'));
        const list = el('div', 'guide-info-upcoming');
        mar.shows.forEach(s => {
          const row = el('div', 'guide-info-upcoming-item');
          const det = el('div', 'guide-info-upcoming-details');
          det.append(el('span', 'guide-info-upcoming-title', s.title));
          row.append(el('span', 'guide-info-upcoming-time', s.time), det);
          list.append(row);
        });
        p.append(list);
      } else {
        now.append(el('div', 'guide-info-now-desc', ((ch && ch.description) ? ch.description + ' ' : '') + 'A back-to-back block of programs.'));
      }
    } else {
      let descText;
      if (info.loading) descText = 'Loading details…';
      else if (info.error) descText = 'Could not load details for this program.';
      else if (detail.description) descText = detail.description;
      else descText = (ch && ch.description) || 'No description available.';
      now.append(el('div', 'guide-info-now-desc', descText));
    }

    const links = makeLinks(detail, item);
    if (links) now.append(links);
    tapeCardItem = item;
    const tapeButton = p.parentNode.matches('.app') ? makeTapeButton(item) : null;   // the guide's own action row gets it in ensureTapes
    if (tapeButton) top.append(tapeButton);
    if (p.parentNode.matches('.app')) {   // above the guide in Split's watch mode: a close button instead of the link
      const close = el('button', 'bbtn bbtn-outline delve-prog-close', 'X');
      close.type = 'button';
      close.title = 'Close';
      close.addEventListener('click', closePanel);
      p.append(close);
      return;
    }
    // "Back to now playing" link on its own line above the status label.
    const backRow = el('div', 'guide-info-now-desc delve-prog-links delve-prog-backrow');
    const back = el('a', null, '<< Now Playing');
    back.href = '#';
    back.addEventListener('click', e => { e.preventDefault(); closePanel(); });
    backRow.append(back);
    now.prepend(backRow);
  }

  function markCell(cell) {
    document.querySelectorAll('[data-delve-sel]').forEach(n => n.removeAttribute('data-delve-sel'));
    if (cell) cell.setAttribute('data-delve-sel', '1');
    const wd = cell && wideCellData.get(cell);
    wideSel = wd ? { id: wd.id, s: wd.s } : null;
  }

  function closePanel() {
    openToken++;
    progState = null;
    lastInfo = null;
    tapeCardItem = null;
    root.removeAttribute('data-delve-loading');
    root.removeAttribute('data-delve-prog');
    root.removeAttribute('data-delve-hdr');
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
    const heldCol = document.querySelector('.app--guide .stage-info-col');
    if (heldCol) heldCol.style.flexBasis = '';   // F26: release the Split hold (see reserveStageHeight)
    markCell(null);   // also clears wideSel
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  // Close when the tuned channel changes some other way, or when the guide view is left.
  // Moving to the clicked program's own channel (the second click) is fine.
  function pollSelection() {
    if (!progState) return;
    if (!document.querySelector(':is(.app--guide, .app--watch:not(.app--channel)) .tv-grid')) return closePanel();
    if (panel && panel.isConnected && panel.parentNode !== panelHost()) return closePanel();   // the view changed under the card
    const cur = highlightedChannel();
    if (cur === progState.baseline) return;
    if (cur === progState.channelId) { progState.baseline = cur; return; }
    closePanel();
  }

  // Keep the stage the same height: measure what is about to be hidden.
  function reserveStageHeight() {
    const col = document.querySelector('.app--guide .stage-info-col');
    if (!col || progState) return;
    let h = 0;
    ['.guide-info-channel-header', '.guide-info-description', '.guide-info-now', '.guide-upcoming-divider', '.guide-info-upcoming']
      .forEach(sel => { const n = col.querySelector(':scope > ' + sel); if (n) h += n.offsetHeight; });
    if (h > 60) lastHeight = h;
    // (F26) Split sizes the info column from its content, so a shorter program card would resize the column and make the video jump:
    // hold the column at its current height while a card is open (it can still shrink in a short window).
    if (root.getAttribute('data-delve-layout') === 'split') col.style.flexBasis = col.offsetHeight + 'px';
  }

  async function openFor(cell, tuned) {
    const row = cell.closest('.grid-row');
    const channelId = row && row.dataset.channel;
    if (!channelId) return;
    reserveStageHeight();
    let c, start = null, end = null;
    const wd = wideCellData.get(cell);
    if (wd) {   // a cell of the wider view: everything about it is already known
      c = { title: wd.title, year: wd.year, durSec: wd.dur, left: NaN, width: NaN, marathon: false, tip: '' };
      start = new Date(wd.s); end = new Date(wd.e);
    } else {
      c = readCell(cell);
      const map = makeTimeMapper();
      if (map && !isNaN(c.left) && !isNaN(c.width)) {
        end = map(c.left + c.width);
        start = (c.left > 0.05 || c.marathon || !c.durSec) ? map(c.left) : new Date(end.getTime() - c.durSec * 1000);
      }
    }
    // Second click on the card already shown: nothing to load, just drop the hint.
    if (tuned && lastInfo && lastInfo.cell === cell && !root.hasAttribute('data-delve-loading')) {
      progState = { channelId, baseline: highlightedChannel() };
      lastInfo.info = Object.assign({}, lastInfo.info, { tuned: true });
      // After the site has handled this same click (it redraws the info column when it tunes).
      setTimeout(() => { if (progState) render(lastInfo.info); }, 0);
      return;
    }
    const token = ++openToken;
    progState = { channelId, baseline: highlightedChannel() };
    markCell(cell);
    // Whatever is on show (the site's block or the previous card) stays, under a dark layer, until the data arrives.
    root.setAttribute('data-delve-loading', '1');
    if (!pollTimer) pollTimer = setInterval(pollSelection, 400);
    const show = info => {
      if (token !== openToken) return;
      lastInfo = { cell, info };
      render(info);
    };
    try {
      if (c.marathon) {
        const l = await getLineup();
        const ch = (l.channels || []).find(x => x.id === channelId) || null;
        show({ c, start, end, found: { ch, item: null, detail: null }, tuned });
      } else {
        const found = await findProgram(channelId, c.title, c.durSec);
        show({ c, start, end, found, tuned });
      }
    } catch (e) {
      show({ c, start, end, error: !c.marathon, found: c.marathon ? { ch: null, item: null, detail: null } : null, tuned });
    }
  }

  // Capture phase: the first click never reaches the site, so the preview does not change.
  document.addEventListener('click', e => {
    if (dragClickPending) { dragClickPending = false; e.stopPropagation(); e.preventDefault(); return; }   // the end of a drag, not a click
    const t = e.target;
    if (!t || !t.closest || t.closest('.delve-star, .delve-hidebtn')) return;
    if (t.closest('.grid-row[data-delve-dim]')) { e.stopPropagation(); e.preventDefault(); return; }   // a hidden channel can't be tuned
    const siteRowInfo = id => document.querySelector(':is(.app--guide, .app--watch:not(.app--channel)) .tv-grid > .tv-grid-body > .grid-row[data-channel="' + CSS.escape(id) + '"] .grid-channel-info');
    // Wider view: a click on a channel selects it on the site, as a click on the site's own row does.
    const wInfo = t.closest('.delve-wide-row > .grid-channel-info');
    if (wInfo) {
      e.stopPropagation(); e.preventDefault();
      const si = siteRowInfo(wInfo.parentNode.dataset.channel);
      if (progState) closePanel();
      if (si) si.click();
      return;
    }
    // Wider view in watch mode: no info card there (as on the site), a click on a program tunes its channel.
    const wcell = t.closest('.delve-wide-row .grid-program');
    if (wcell && (!hasProgramInfo() || !settings.programInfo)) {   // (also in the guide view when Program information is off)
      e.stopPropagation(); e.preventDefault();
      const si = siteRowInfo(wcell.closest('.grid-row').dataset.channel);
      if (si) si.click();
      return;
    }
    const cell = hasProgramInfo() ? t.closest('.grid-program') : null;
    if (cell && cell.closest('.delve-wide-row')) {   // Wider view with a card: first click info only, second click tunes
      e.stopPropagation(); e.preventDefault();
      const second = cell.hasAttribute('data-delve-sel');
      openFor(cell, second);
      if (second) { const si = siteRowInfo(cell.closest('.grid-row').dataset.channel); if (si) si.click(); }
      return;
    }
    if (cell && settings.programInfo) {
      if (!cell.hasAttribute('data-delve-sel')) {
        e.stopPropagation(); e.preventDefault();
        openFor(cell, false);
        return;
      }
      openFor(cell, true);   // second click on the same card: the site tunes
      return;
    }
    if (progState && hasProgramInfo() && t.closest('.tv-grid .grid-row')) closePanel();
  }, true);

