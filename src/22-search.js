  // ---------------------------------------------------------------------------
  // Search: a popup over the page. It searches the channels the guide shows and the programs already loaded (the site's own
  // cells, or the whole wider view when that is on). The results are on the left; the chosen one's information is on the right.
  // ---------------------------------------------------------------------------
  const SEARCH_CSS = `
.delve-search-scrim { position: fixed; inset: 0; z-index: 2147483002; display: flex; align-items: flex-start; justify-content: center; padding: 6vh var(--space-4, 16px) 0; box-sizing: border-box; background: rgba(0, 0, 0, .6); }
.delve-search-scrim[hidden] { display: none; }
.delve-search { display: flex; flex-direction: column; width: min(980px, 100%); height: min(84vh, 680px); box-sizing: border-box; padding: var(--space-4, 16px); background: var(--bg-deep, #060b1e); color: var(--text, #e8eaf0); border: 1px solid var(--border-color, rgb(38, 82, 178)); font-family: var(--font-mono, "Courier New", monospace); font-size: 14px; line-height: 1.4; }
/* Same box as the site's popups (cc-panel). */
html.theme-8s .delve-search { background: var(--8s-box); border: 0; box-shadow: var(--8s-ring-thin), 0 0 0 1px #141414; }
.delve-search-input { box-sizing: border-box; width: 100%; margin-bottom: var(--space-2, 8px); padding: 6px 10px; color: inherit; background: var(--bg-deep, #060b1e); border: 1px solid var(--border-color, rgb(38, 82, 178)); font: inherit; line-height: 1.8; }
.delve-search-input::placeholder { overflow: visible; }   /* the placeholder clips the font's tall glyphs otherwise */
.delve-search-input:focus-visible, .delve-search-hit:focus-visible { outline: 2px solid var(--cyan, #00ccdd); outline-offset: 2px; }
.delve-search .delve-search-count { margin-bottom: var(--space-2, 8px); text-align: left; text-transform: uppercase; }
.delve-search-body { display: flex; gap: var(--space-4, 16px); flex: 1 1 0; min-height: 0; }
.delve-search-list { flex: 0 0 45%; min-width: 0; overflow-y: auto; }
.delve-search-info { flex: 1 1 0; min-width: 0; overflow-y: auto; padding-left: var(--space-4, 16px); border-left: 1px solid var(--border-color, rgb(38, 82, 178)); }
.delve-search-info .guide-info-now-title { white-space: normal; overflow: visible; }
.delve-search-info .guide-info-now-title-row { flex-wrap: wrap; }
.delve-search-info .guide-info-now-desc { display: block; -webkit-line-clamp: unset; overflow: visible; }
.delve-search-hit { display: block; width: 100%; box-sizing: border-box; padding: 6px 8px; text-align: left; color: inherit; background: transparent; border: 0; border-bottom: 1px solid var(--border-color, rgb(38, 82, 178)); font: inherit; cursor: pointer; }
.delve-search-hit:hover { background: rgba(255, 255, 255, .08); }
.delve-search-hit.sel { outline: 2px solid var(--gold, #ffd740); outline-offset: -2px; }
.delve-search-tune { display: block; margin: var(--space-2, 8px) 0 var(--space-3, 12px); text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
.delve-search-where { display: block; font-size: 12px; opacity: .75; }
@media (max-width: 640px) {
  .delve-search-body { flex-direction: column; }
  .delve-search-list { flex: 1 1 0; }
  .delve-search-info { padding: var(--space-2, 8px) 0 0; border-left: 0; border-top: 1px solid var(--border-color, rgb(38, 82, 178)); }
}
`;

  const SEARCH_MAX_HITS = 200;
  const SITE_ROWS = ':is(.app--guide, .app--watch:not(.app--channel)) .tv-grid > .tv-grid-body > .grid-row';
  let searchScrim = null, searchInput = null, searchList = null, searchCount = null, searchInfo = null, searchLastFocus = null, searchInfoToken = 0;

  function buildSearch() {
    searchScrim = el('div', 'delve-search-scrim');
    searchScrim.hidden = true;
    searchScrim.addEventListener('click', e => { if (e.target === searchScrim) closeSearch(); });
    const box = el('div', 'delve-search');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Search');
    const head = el('div', 'delve-head');
    const close = el('button', 'delve-close bbtn bbtn-outline', '✕');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close search');
    close.addEventListener('click', closeSearch);
    head.append(el('h2', 'delve-title', 'SEARCH'), close);
    searchInput = el('input', 'delve-search-input');
    searchInput.type = 'search';
    searchInput.placeholder = 'Channel or show';
    searchInput.setAttribute('aria-label', 'Search channels and shows');
    searchInput.addEventListener('input', renderSearch);
    ['keydown', 'keyup', 'keypress'].forEach(type => searchInput.addEventListener(type, e => e.stopPropagation()));   // the site's hotkeys must not fire while typing
    searchCount = el('div', 'delve-search-count cc-panel-head');
    searchCount.setAttribute('aria-live', 'polite');
    searchList = el('div', 'delve-search-list');
    searchInfo = el('div', 'delve-search-info');
    const body = el('div', 'delve-search-body');
    body.append(searchList, searchInfo);
    box.append(head, searchInput, searchCount, body);
    searchScrim.append(box);
    root.append(searchScrim);
  }

  function openSearch() {
    if (!searchScrim) buildSearch();
    searchLastFocus = document.activeElement;
    searchScrim.hidden = false;
    renderSearch();
    searchInput.focus({ preventScroll: true });
  }

  function closeSearch() {
    if (!searchScrim || searchScrim.hidden) return;
    searchScrim.hidden = true;
    searchInfoToken++;
    if (searchLastFocus && searchLastFocus.focus) { try { searchLastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

  function searchChannelRows() {
    return Array.from(document.querySelectorAll(SITE_ROWS)).filter(row => !row.hasAttribute('data-delve-hide')).map(row => {
      const nameEl = row.querySelector('.grid-channel-name-text'), numEl = row.querySelector('.grid-channel-num');
      return { row, id: row.dataset.channel, name: nameEl ? nameEl.textContent.trim() : row.dataset.channel, number: numEl ? numEl.textContent.trim() : '' };
    });
  }

  function findHits(query) {
    const channels = searchChannelRows();
    const hits = [];
    channels.forEach(ch => { if ((ch.number + ' ' + ch.name).toLowerCase().includes(query)) hits.push({ kind: 'channel', ch }); });
    const programs = [];
    if (settings.extended && wide.data && wideRoot && wideRoot.isConnected) {
      channels.forEach(ch => (wide.data[ch.id] || []).forEach(it => {
        if (it[2].toLowerCase().includes(query)) programs.push({ kind: 'program', ch, title: it[2], year: it[3], start: it[0], end: it[1], durSec: it[4] });
      }));
    } else {
      const map = makeTimeMapper();
      channels.forEach(ch => ch.row.querySelectorAll('.grid-program').forEach(cell => {
        const c = readCell(cell);
        if (!c.title.toLowerCase().includes(query)) return;
        const timed = map && !isNaN(c.left) && !isNaN(c.width);
        programs.push({ kind: 'program', ch, title: c.title, year: c.year, durSec: c.durSec, marathonTip: c.marathon ? c.tip : '',
          start: timed ? map(c.left).getTime() : null, end: timed ? map(c.left + c.width).getTime() : null });
      }));
    }
    programs.sort((a, b) => (a.start === null) - (b.start === null) || a.start - b.start);
    return hits.concat(programs);
  }

  function startLabel(ms) {
    const d = new Date(ms);
    return (d.toDateString() === new Date().toDateString() ? '' : dayLabel(d) + ' ') + fmtTime(d);
  }

  function renderSearch() {
    const query = searchInput.value.trim().toLowerCase();
    const hits = query ? findHits(query) : [];
    const shown = hits.slice(0, SEARCH_MAX_HITS);
    searchCount.textContent = !query ? '' : !hits.length ? 'No matches' : hits.length + (hits.length === 1 ? ' match' : ' matches') + (hits.length > shown.length ? ' (first ' + shown.length + ' shown)' : '');
    searchInfoToken++;
    searchInfo.replaceChildren();
    searchList.replaceChildren(...shown.map(hit => {
      const b = el('button', 'delve-search-hit');
      b.type = 'button';
      const channelText = 'CH ' + hit.ch.number + ' ' + hit.ch.name;
      if (hit.kind === 'channel') b.append(channelText);
      else {
        b.append(hit.title + (hit.year ? ' ' + hit.year : ''));
        b.append(el('span', 'delve-search-where', (hit.start === null ? '' : startLabel(hit.start) + ' · ') + channelText));
      }
      b.addEventListener('click', () => {
        searchList.querySelectorAll('.sel').forEach(n => n.classList.remove('sel'));
        b.classList.add('sel');
        showHitInfo(hit);
      });
      return b;
    }));
  }

  function tuneTo(ch) {
    const info = ch.row.isConnected && ch.row.querySelector('.grid-channel-info');
    if (!info) return warnMissing('.grid-channel-info', 'Search tune button');
    closeSearch();
    info.click();
  }

  function drawHitInfo(hit, found, state) {
    const ch = found && found.ch, item = found && found.item, detail = (found && found.detail) || {};
    const wrap = el('div');
    const chHead = buildChannelHead(hit.ch.id, ch);
    if (chHead) { wrap.append(chHead.head); if (chHead.desc) wrap.append(chHead.desc); }
    else wrap.append(el('div', 'guide-info-now-title', 'CH ' + hit.ch.number + ' ' + hit.ch.name));
    const tune = el('button', 'bbtn bbtn-gold delve-search-tune', 'Tune to channel');
    tune.type = 'button';
    tune.addEventListener('click', () => tuneTo(hit.ch));
    wrap.append(tune);
    if (hit.kind === 'program') {
      const box = el('div', 'delve-prog-now');
      box.append(el('div', 'guide-info-now-label', (hit.start !== null && hit.end !== null && statusText(hit.start, hit.end)) || 'Program'));
      const titleRow = el('div', 'guide-info-now-title-row');
      titleRow.append(el('div', 'guide-info-now-title', (item && item.title) || hit.title));
      const year = (item && item.year) || hit.year;
      if (year) titleRow.append(el('span', 'btag btag-ghost', year));
      if (detail.season != null && detail.episode != null) titleRow.append(el('span', 'btag btag-ghost', 'S' + detail.season + ' E' + detail.episode));
      box.append(titleRow);
      const bits = [];
      if (hit.start !== null && hit.end !== null) bits.push(fmtTime(new Date(hit.start)) + ' – ' + fmtTime(new Date(hit.end)));
      const secs = (item && item.duration) || hit.durSec;
      if (secs) bits.push(fmtDur(secs));
      if (bits.length) box.append(el('div', 'guide-info-now-desc', bits.join('  ·  ')));
      if (hit.marathonTip) {
        const mar = parseMarathon(hit.marathonTip);
        box.append(el('div', 'guide-info-now-desc', mar.shows.length ? (mar.head || 'Marathon block') + ':' : 'A back-to-back block of programs.'));
        mar.shows.forEach(show => box.append(el('div', 'guide-info-now-desc', show.time + '  ' + show.title)));
      } else {
        box.append(el('div', 'guide-info-now-desc', state === 'loading' ? 'Loading details…' : state === 'error' ? 'Could not load details.' : detail.description || 'No description available.'));
      }
      const links = makeLinks(detail, item);
      if (links) box.append(links);
      wrap.append(box);
    }
    searchInfo.replaceChildren(wrap);
  }

  async function showHitInfo(hit) {
    const token = ++searchInfoToken;
    drawHitInfo(hit, null, 'loading');
    let found = null, state = '';
    try {
      if (hit.kind === 'channel' || hit.marathonTip) {
        const lineup = await getLineup();
        found = { ch: (lineup.channels || []).find(c => c.id === hit.ch.id) || null, item: null, detail: null };
      } else found = await findProgram(hit.ch.id, hit.title, hit.durSec);
    } catch (e) { state = 'error'; }
    if (token === searchInfoToken) drawHitInfo(hit, found, state);
  }

