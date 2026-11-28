  // ---------------------------------------------------------------------------
  // Guide toolbar: Favorites and Sort at the top of the guide, plus a star on every channel. Guide view only.
  // Channels are hidden / re-ordered with an attribute and CSS `order`, so the site's elements are never moved or rebuilt.
  // ---------------------------------------------------------------------------
  const BAR_CSS = `
.delve-bar { position: sticky; top: 0; z-index: 8; flex: 0 0 auto; box-sizing: border-box; height: 52px; padding: 8px; display: flex; align-items: center; gap: 8px; background: inherit; }
.delve-bar button { min-height: 36px; padding: 0 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; cursor: pointer; }
.delve-bar .delve-select { display: inline-block; width: auto; min-width: 190px; }
.delve-zoom { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; }
.delve-zoom-name { margin-right: 4px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
.delve-bar .delve-zoom-btn { width: 36px; padding: 0; font-size: 20px; line-height: 1; text-transform: none; }
.delve-zoom-label { display: inline-block; width: 56px; text-align: center; font-weight: 700; letter-spacing: 1px; color: var(--8s-yellow, #ffd740); }
.delve-bar button:disabled { opacity: .4; cursor: default; }
.delve-bar [hidden] { display: none !important; }
/* Phone: everything must fit in 355 px (B1). The sort box takes what is left; the "Window" caption goes. */
@media (max-width: 480px) {
  .delve-bar button { padding: 0 8px; letter-spacing: 0; }
  .delve-bar .delve-select { min-width: 0; flex: 1 1 0; width: 0; }
  .delve-bar .delve-zoom-name, .delve-bar .delve-fav-label, .delve-bar .delve-hidden-label { display: none; }
  .delve-zoom { gap: 4px; }
  .delve-zoom-label { width: 40px; }
}
html[data-delve-bar] :is(.app--guide, .app--watch:not(.app--channel)) .tv-grid .grid-time-header { top: 52px; }
:is(.app--guide, .app--watch:not(.app--channel)) .grid-time-header { order: -1; }
:is(.app--guide, .app--watch:not(.app--channel)) .grid-row[data-delve-hide] { display: none !important; }
:is(.app--guide, .app--watch:not(.app--channel)) .grid-row[data-delve-dim] { opacity: .45; }
.delve-chan-actions { grid-column: 1 / -1; display: flex; gap: 8px; }
.delve-chan-actions button { flex: 1 1 0; }
.delve-chan-actions [hidden] { display: none; }
.delve-star, .delve-hidebtn { flex: 0 0 auto; align-self: center; width: 16px; height: 28px; margin: 0 0 0 -2px; padding: 0; border: 0; background: transparent; cursor: pointer; font-size: 16px; line-height: 28px; color: inherit; opacity: .35; }
.delve-star:hover, .delve-hidebtn:hover { opacity: 1; }
.delve-star.on { opacity: 1; color: var(--8s-yellow, #ffd740); }
.delve-bar button:focus-visible, .delve-bar select:focus-visible, .delve-star:focus-visible, .delve-hidebtn:focus-visible { outline: 2px solid var(--cyan, #00ccdd); outline-offset: 2px; }
`;

  const guideRows = () => Array.from(document.querySelectorAll(':is(.app--guide, .app--watch:not(.app--channel)) .tv-grid .grid-row'));
  const isFav = id => settings.favorites.indexOf(id) !== -1;
  function toggleFav(id) {
    const f = settings.favorites.slice();
    const i = f.indexOf(id);
    if (i === -1) f.push(id); else f.splice(i, 1);
    setSettings({ favorites: f });
    ensureGuide();
  }

  const isHiddenChannel = id => settings.hiddenChannels.indexOf(id) !== -1;
  function toggleHiddenChannel(id) {
    const list = settings.hiddenChannels.slice();
    const i = list.indexOf(id);
    if (i === -1) list.push(id); else list.splice(i, 1);
    setSettings({ hiddenChannels: list });
    ensureGuide();
  }

  let bar = null, favBtn = null, hiddenBtn = null, sortSel = null, searchBtn = null, wideNote = null, zoomOut = null, zoomIn = null, zoomLbl = null, nowBtn = null, zoomBoxEl = null;
  function buildBar() {
    const b = el('div', 'delve-bar');
    favBtn = el('button', 'delve-favbtn popup-toggle-btn');
    favBtn.append('★', el('span', 'delve-fav-label', ' Favorites'));   // the label hides on phones (see BAR_CSS)
    favBtn.title = 'Favorites only';
    favBtn.type = 'button';
    favBtn.addEventListener('click', () => { setSettings({ favOnly: !settings.favOnly }); ensureGuide(); });
    hiddenBtn = el('button', 'delve-hiddenbtn popup-toggle-btn');
    hiddenBtn.append('⊘', el('span', 'delve-hidden-label', ' Hidden'));
    hiddenBtn.title = 'Show hidden channels';
    hiddenBtn.type = 'button';
    hiddenBtn.addEventListener('click', () => { setSettings({ showHidden: !settings.showHidden }); ensureGuide(); });
    sortSel = el('select', 'delve-select bbtn bbtn-outline');
    sortSel.setAttribute('aria-label', 'Sort channels');
    Object.keys(SORTS).forEach(k => { const o = el('option', null, (window.matchMedia('(max-width: 480px)').matches ? '' : 'Sort: ') + SORTS[k]); o.value = k; sortSel.append(o); });
    sortSel.addEventListener('change', () => { setSettings({ sort: sortSel.value }); ensureGuide(); });
    searchBtn = el('button', 'delve-searchbtn bbtn bbtn-outline', 'Search');
    searchBtn.type = 'button';
    searchBtn.addEventListener('click', openSearch);
    wideNote = el('span', 'delve-bar-note');
    // Time window: [-] 3h [+]. The label has a fixed width so the bar never shifts.
    const zoomBox = zoomBoxEl = el('span', 'delve-zoom');
    zoomOut = el('button', 'delve-zoom-btn bbtn bbtn-outline', '−');
    zoomOut.type = 'button'; zoomOut.setAttribute('aria-label', 'Show less time');
    zoomIn = el('button', 'delve-zoom-btn bbtn bbtn-outline', '+');
    zoomIn.type = 'button'; zoomIn.setAttribute('aria-label', 'Show more time');
    zoomLbl = el('span', 'delve-zoom-label');
    zoomLbl.setAttribute('aria-live', 'polite');
    const stepZoom = dir => {
      const i = ZOOMS.indexOf(settings.zoom) + dir;
      if (i < 0 || i >= ZOOMS.length) return;
      setSettings({ zoom: ZOOMS[i] });
      ensureGuide();
    };
    zoomOut.addEventListener('click', () => stepZoom(-1));
    zoomIn.addEventListener('click', () => stepZoom(1));
    zoomBox.append(el('span', 'delve-zoom-name', 'Window'), zoomOut, zoomLbl, zoomIn);
    // Now: only shown while the Now line is out of view
    nowBtn = el('button', 'delve-nowbtn bbtn bbtn-outline', 'Now');
    nowBtn.type = 'button'; nowBtn.hidden = true;
    nowBtn.addEventListener('click', () => scrollWideToNow(true));
    b.append(favBtn, hiddenBtn, sortSel, searchBtn, nowBtn, wideNote, zoomBox);
    return b;
  }
  // The sort in effect: Channel # when the Sort feature is off, or when "Favorites first" is chosen but Favorites is off.
  const effectiveSort = () => !settings.sortOn ? 'dial' : (settings.sort === 'favorites' && !settings.favoritesOn ? 'dial' : settings.sort);

  function ensureBar() {
    const grid = document.querySelector(':is(.app--guide, .app--watch:not(.app--channel)) .tv-grid');
    // With every tool switched off there is nothing to put on the bar, so there is no bar.
    if (!settings.searchOn) closeSearch();
    if (!grid || !(settings.favoritesOn || settings.hideChannelsOn || settings.sortOn || settings.searchOn || settings.extended)) {
      if (bar && bar.parentNode) bar.remove();
      root.removeAttribute('data-delve-bar');
      return;
    }
    if (!bar) bar = buildBar();
    if (grid.firstElementChild !== bar) grid.insertBefore(bar, grid.firstChild);
    root.setAttribute('data-delve-bar', '1');
    favBtn.hidden = !settings.favoritesOn;
    hiddenBtn.hidden = !settings.hideChannelsOn;
    hiddenBtn.classList.toggle('popup-toggle-btn--on', settings.showHidden);
    hiddenBtn.setAttribute('aria-pressed', String(settings.showHidden));
    sortSel.hidden = !settings.sortOn;
    searchBtn.hidden = !settings.searchOn;
    zoomBoxEl.hidden = !settings.extended;
    const favOpt = sortSel.querySelector('option[value="favorites"]');
    if (favOpt) { favOpt.disabled = !settings.favoritesOn; favOpt.hidden = !settings.favoritesOn; }
    favBtn.classList.toggle('popup-toggle-btn--on', settings.favOnly);
    favBtn.setAttribute('aria-pressed', String(settings.favOnly));
    if (sortSel.value !== effectiveSort()) sortSel.value = effectiveSort();
    const zi = ZOOMS.indexOf(settings.zoom);
    if (zoomLbl.textContent !== zoomText(settings.zoom)) zoomLbl.textContent = zoomText(settings.zoom);
    zoomOut.disabled = zi <= 0; zoomIn.disabled = zi >= ZOOMS.length - 1;
    const dayAndTime = ms => { const d = new Date(ms); return d.toLocaleDateString([], { weekday: 'short' }) + ' ' + fmtTime(d); };
    let note = '';
    if (settings.extended && wide.status === 'failed') note = 'Wider view is unavailable (the site changed or did not answer).';
    else if (settings.extended && wide.status === 'ready') note = dayAndTime(wide.from) + ' – ' + dayAndTime(wide.to);
    if (wideNote.textContent !== note) wideNote.textContent = note;
  }

  function ensureStars(rows) {
    if (!settings.favoritesOn) { document.querySelectorAll('.delve-star').forEach(n => n.remove()); return; }
    rows.forEach(row => {
      const info = row.querySelector('.grid-channel-info');
      if (!info) { warnMissing('.grid-channel-info', 'Favorites'); return; }
      let star = info.querySelector(':scope > .delve-star');
      if (!star) {
        star = el('button', 'delve-star');
        star.type = 'button';
        star.textContent = '★';
        info.prepend(star);   // left of the channel number
      }
      const on = isFav(row.dataset.channel);
      star.classList.toggle('on', on);
      star.setAttribute('aria-pressed', String(on));
      const label = on ? 'Remove from favorites' : 'Add to favorites';
      if (star.title !== label) { star.title = label; star.setAttribute('aria-label', label); }
    });
  }

  function ensureHideButtons(rows) {
    if (!settings.hideChannelsOn) { document.querySelectorAll('.delve-hidebtn').forEach(n => n.remove()); return; }
    rows.forEach(row => {
      const info = row.querySelector('.grid-channel-info');
      if (!info) { warnMissing('.grid-channel-info', 'Hide channels'); return; }
      let btn = info.querySelector(':scope > .delve-hidebtn');
      if (!btn) {
        btn = el('button', 'delve-hidebtn');
        btn.type = 'button';
        const star = info.querySelector(':scope > .delve-star');
        if (star) star.after(btn); else info.prepend(btn);
      }
      const hidden = isHiddenChannel(row.dataset.channel);
      const text = hidden ? '↺' : '✕';
      if (btn.textContent !== text) btn.textContent = text;
      const label = hidden ? 'Unhide channel' : 'Hide channel';
      if (btn.title !== label) { btn.title = label; btn.setAttribute('aria-label', label); }
    });
  }

  function applyFilter(rows) {
    rows.forEach(row => {
      const id = row.dataset.channel;
      const channelHidden = settings.hideChannelsOn && isHiddenChannel(id);
      const hide = (settings.favoritesOn && settings.favOnly && !isFav(id)) || (channelHidden && !settings.showHidden);
      if (hide !== row.hasAttribute('data-delve-hide')) row.toggleAttribute('data-delve-hide', hide);
      const dim = channelHidden && settings.showHidden;
      if (dim !== row.hasAttribute('data-delve-dim')) row.toggleAttribute('data-delve-dim', dim);
    });
  }

  let orderSig = '';
  const rowViewers = row => {
    const v = row.querySelector('.grid-channel-viewers');
    if (!v) return 0;
    return parseInt(((v.getAttribute('title') || v.textContent) + '').replace(/[^\d]/g, ''), 10) || 0;
  };
  const rowName = row => (((row.querySelector('.grid-channel-name-text') || {}).textContent) || row.dataset.channel || '').trim().toLowerCase();
  function applyOrder(rows) {
    const sortKey = effectiveSort();
    let style = document.getElementById('delve-order');
    if (sortKey === 'dial') {
      if (orderSig !== 'dial' && style) style.textContent = '';
      orderSig = 'dial';
      return;
    }
    const seen = new Set();   // the wider view repeats every channel: one order per channel
    const items = rows.filter(r => !seen.has(r.dataset.channel) && seen.add(r.dataset.channel))
      .map((row, i) => ({ id: row.dataset.channel, i, name: rowName(row), viewers: rowViewers(row), fav: isFav(row.dataset.channel) ? 0 : 1 }));
    // Names and viewer counts fill in after the rows appear, and change while watching: they belong in the signature.
    const sig = sortKey + '|' + items.map(it => [it.id, it.name, it.viewers, it.fav].join(':')).join(',');
    if (sig === orderSig && style && style.isConnected) return;
    orderSig = sig;
    if (!style) {
      style = document.createElement('style');
      style.id = 'delve-order';
    }
    if (!style.isConnected) (document.head || root).appendChild(style);
    const cmp = {
      name: (a, b) => a.name.localeCompare(b.name) || a.i - b.i,
      viewers: (a, b) => b.viewers - a.viewers || a.i - b.i,
      favorites: (a, b) => a.fav - b.fav || a.i - b.i,
    }[sortKey];
    items.sort(cmp);
    style.textContent = items.map((it, n) => ':is(.app--guide, .app--watch:not(.app--channel)) .grid-row[data-channel="' + CSS.escape(it.id) + '"]{order:' + (n + 1) + '}').join('\n');
  }

