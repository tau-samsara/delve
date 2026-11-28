  // ---------------------------------------------------------------------------
  // Drawer. Colors, fonts and borders come from the site's CSS variables.
  // ---------------------------------------------------------------------------
  const DRAWER_CSS = `
.delve-scrim { position: fixed; inset: 0; z-index: 2147483000; background: transparent; display: none; }
.delve-scrim.open { display: block; }
.delve-drawer {
  position: fixed; top: 0; right: 0; bottom: 0; z-index: 2147483001; box-sizing: border-box;
  width: min(340px, 100vw); display: flex; flex-direction: column;
  background: var(--bg-deep, #060b1e); color: var(--text, #e8eaf0);
  border-left: 1px solid var(--border-color, rgb(38, 82, 178));
  font-family: var(--font-mono, "Courier New", monospace); font-size: 14px; line-height: 1.4;
  transform: translateX(100%); visibility: hidden; transition: transform .2s ease, visibility 0s linear .2s;
}
/* Only the left edge shows the ring: the other three are pushed 5 px past the window (ring 4 px + outline 1 px). */
html.theme-8s .delve-drawer { top: -5px; right: -5px; bottom: -5px; width: min(345px, calc(100vw + 5px)); padding: 5px 5px 5px 0; background: var(--8s-box); border: 0; box-shadow: var(--8s-ring-thin), 0 0 0 1px #141414; }
.delve-drawer.open { transform: none; visibility: visible; transition: transform .2s ease; }
.delve-head { display: flex; align-items: center; justify-content: space-between; padding: var(--space-4, 16px); }
.delve-title { margin: 0; font-size: 20px; letter-spacing: .08em; color: var(--gold, #ffd740); }
.delve-scroll { flex: 1 1 auto; overflow-y: auto; padding: 0 var(--space-4, 16px); }
.delve-group-head { display: flex; align-items: center; justify-content: space-between; width: 100%; margin: var(--space-3, 12px) 0 var(--space-2, 8px); padding: 0 0 4px; background: none; border: 0; border-bottom: 1px solid var(--border-color, rgb(38, 82, 178)); color: var(--gold, #ffd740); font: inherit; font-size: 13px; letter-spacing: .08em; text-transform: uppercase; cursor: pointer; }
.delve-group-head .desc-toggle-arrow { color: #fff; }
.delve-group-head[aria-expanded="true"] .desc-toggle-arrow { color: var(--8s-yellow, #ffd740); }
.delve-group-head[aria-expanded="true"] .desc-toggle-arrow svg { transform: rotate(180deg); }
.delve-group-head:focus-visible { outline: 2px solid var(--cyan, #00ccdd); outline-offset: 2px; }
.delve-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3, 12px); margin: 0 0 var(--space-2, 8px); }
.delve-label { flex: 1 1 auto; color: var(--cyan, #00ccdd); letter-spacing: .06em; text-transform: uppercase; font-size: 12px; }
/* Buttons and the drop-down reuse the site's button classes (bbtn bbtn-outline / bbtn-gold). */
.delve-close { min-height: 30px; padding: 0 10px; }
.delve-select { display: block; box-sizing: border-box; height: 36px; min-height: 36px; padding: 0 10px; line-height: normal; text-align: left; color-scheme: dark; }
.delve-drawer .delve-select { flex: 0 0 200px; width: 200px; }
.delve-select option { color: #fff; background: var(--bg-deep, #060b1e); }
.delve-seg { display: flex; gap: var(--space-2, 8px); }
.delve-drawer .delve-seg { flex: 0 0 200px; }
/* Left/Right use the site's toggle buttons: grey when off, blue with gold text when on (popup-toggle-btn--on). */
.delve-seg button, .delve-toggle { flex: 1 1 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; cursor: pointer; }
.delve-toggle { display: block; flex: 0 0 96px; width: 96px; }
.delve-select:focus-visible, .delve-seg button:focus-visible, .delve-toggle:focus-visible, .delve-close:focus-visible { outline: 2px solid var(--cyan, #00ccdd); outline-offset: 2px; }
.header-nav-delve { cursor: pointer; }
/* A newer version is published: the DELVE button pulses with a gold glow. */
@keyframes delve-update-glow {
  0%, 100% { box-shadow: 0 0 3px 0 var(--gold, #ffd740), 0 0 6px 1px rgba(255, 215, 64, .35); }
  50% { box-shadow: 0 0 8px 2px var(--gold, #ffd740), 0 0 16px 4px rgba(255, 215, 64, .55); }
}
html[data-delve-update] [data-delve-btn] { border-color: var(--gold, #ffd740); animation: delve-update-glow 2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  html[data-delve-update] [data-delve-btn] { animation: none; box-shadow: 0 0 8px 2px var(--gold, #ffd740); }
}
.delve-footer { padding: var(--space-4, 16px); border-top: 1px solid var(--border-color, rgb(38, 82, 178)); }
.delve-update-status { display: block; margin-bottom: var(--space-3, 12px); font-size: 12px; }
.delve-update-btn { display: block; box-sizing: border-box; width: 100%; text-align: center; text-decoration: none; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
.delve-news-btn { display: block; box-sizing: border-box; width: 100%; margin-top: var(--space-3, 12px); text-transform: uppercase; letter-spacing: 1px; font-weight: 700; cursor: pointer; }
.delve-news-btn:focus-visible { outline: 2px solid var(--cyan, #00ccdd); outline-offset: 2px; }
.delve-reset-btn { display: block; box-sizing: border-box; width: 100%; margin-top: var(--space-3, 12px); text-transform: uppercase; letter-spacing: 1px; font-weight: 700; cursor: pointer; }
.delve-reset-btn:focus-visible, .delve-update-btn:focus-visible { outline: 2px solid var(--cyan, #00ccdd); outline-offset: 2px; }
/* The site orders header items with flex "order" (clock last), so give the button the highest. */
html .prevue-header-bar > .header-nav-item.header-nav-delve { order: 99; margin-left: var(--space-2, 8px); }
/* Phone: DELVE sits by the menu button; tighten the header so the clock stays on screen (B2). */
@media (max-width: 480px) {
  html .prevue-header-bar:has(.header-nav-delve) { gap: 3px !important; }
  html .prevue-header-bar:has(.header-nav-delve):not(:has(> .prevue-header-clock)) { justify-content: flex-end; }   /* info pages: a wrapped second row stays right-aligned (B6) */
  html .prevue-header-bar:has(.header-nav-delve) .header-nav-delve, html .prevue-header-bar:has(.header-nav-delve) .header-signin { padding-left: 4px !important; padding-right: 4px !important; min-width: 0 !important; }
}
`;

  const PANEL_CSS = `
html[data-delve-prog] .stage-info-col > .guide-info-description,
html[data-delve-prog] .stage-info-col > .guide-info-now,
html[data-delve-prog] .stage-info-col > .guide-upcoming-divider,
html[data-delve-prog] .stage-info-col > .guide-info-upcoming,
html[data-delve-hdr] .stage-info-col > .guide-info-channel-header { display: none !important; }
.grid-program[data-delve-sel] { outline: 2px solid var(--gold, #ffd740); outline-offset: -2px; }
/* The panel reuses the site's "now playing" / "up next" classes for matching fonts and colors. */
/* While a clicked program's data loads, the current content stays under a dark layer. */
html[data-delve-loading] .app--guide .stage-info-col { position: relative; }
html[data-delve-loading] .app--guide .stage-info-col::after { content: ''; position: absolute; inset: 0; z-index: 5; background: rgba(0, 0, 0, .55); pointer-events: none; }
.delve-prog { flex: 0 0 auto; min-height: 0; overflow-y: auto; box-sizing: border-box; }
.delve-prog-now { margin-bottom: 2px; padding-top: 8px; border-top: 1px solid var(--border-color, rgb(38, 82, 178)); }   /* Classic #2652B2; the palette's frame color in Flat */
.delve-prog-labelrow { display: flex; align-items: center; gap: 12px; }
.delve-prog .guide-info-now-title { white-space: normal; overflow: visible; }
.delve-prog .guide-info-now-title-row { flex-wrap: wrap; }
.delve-prog .guide-info-now-desc { display: block; -webkit-line-clamp: unset; overflow: visible; }
.delve-prog .guide-info-upcoming-item { display: flex; }
.delve-prog .guide-info-upcoming-title { white-space: normal; }
html .delve-prog-links { -webkit-line-clamp: unset; overflow: visible; }
.delve-prog-backrow { margin-bottom: 8px; }
.delve-prog-links a { color: var(--8s-yellow, var(--gold, #ffd740)); text-decoration: underline; }
.delve-prog-links > a { margin-right: 18px; }
.delve-link { display: inline-flex; align-items: center; gap: 4px; margin-right: 18px; white-space: nowrap; }
.delve-link a { display: inline-flex; align-items: center; gap: 5px; }
.delve-copy { display: inline-flex; align-items: center; padding: 2px; margin: 0; border: 0; background: none; color: var(--8s-yellow, var(--gold, #ffd740)); opacity: .75; cursor: pointer; }
.delve-copy:hover, .delve-copy:focus-visible { opacity: 1; }
.delve-icon { flex: 0 0 auto; }
`;

  const LAYOUT_NAMES = { default: 'Default', wide: 'Wide', split: 'Split', adaptive: 'Adaptive' };
  const SIDE_NAMES = { left: 'Left', right: 'Right' };

  const STYLE_ID = 'delve-style';
  function applyStyle() {
    let s = document.getElementById(STYLE_ID);
    if (!s) {
      s = document.createElement('style');
      s.id = STYLE_ID;
      s.textContent = LAYOUT_CSS + DRAWER_CSS + PANEL_CSS + BAR_CSS + SEARCH_CSS + CHANGELOG_CSS + NOW_CSS + WIDE_CSS + THEATER_CSS + WATCHERS_CSS + PICTURE_CSS + AUDIO_CSS + HIDE_CSS + AUTO_SPELUNK_CSS + WATERMARK_CSS + VOLUME_POPUP_CSS + TAPES_CSS;
      (document.head || root).appendChild(s);
    }
  }

  let drawer = null, scrim = null, lastFocus = null;
  const RESET_LABEL = 'Reset all settings';
  // The site's expander chevron (as on the program description toggle), wrapped in its arrow button class.
  const GROUP_ARROW = '<span class="desc-toggle-arrow" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12.53 16.28a.75.75 0 0 1-1.06 0l-7.5-7.5a.75.75 0 0 1 1.06-1.06L12 14.69l6.97-6.97a.75.75 0 1 1 1.06 1.06l-7.5 7.5Z" fill-rule="evenodd" clip-rule="evenodd"/></svg></span>';

  function buildDrawer() {
    scrim = document.createElement('div');
    scrim.className = 'delve-scrim';
    scrim.addEventListener('click', closeDrawer);

    drawer = document.createElement('aside');
    drawer.className = 'delve-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-label', 'Delve');

    const head = document.createElement('div');
    head.className = 'delve-head';
    const title = document.createElement('h2');
    title.className = 'delve-title';
    title.textContent = 'DELVE';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'delve-close bbtn bbtn-outline';
    close.setAttribute('aria-label', 'Close Delve');
    close.textContent = '✕';
    close.addEventListener('click', closeDrawer);
    head.append(title, close);

    // View type: a drop-down.
    const viewRow = document.createElement('div');
    viewRow.className = 'delve-row';
    const viewLabel = document.createElement('label');
    viewLabel.className = 'delve-label';
    viewLabel.htmlFor = 'delve-view';
    viewLabel.textContent = 'View type';
    const select = document.createElement('select');
    select.id = 'delve-view';
    select.className = 'delve-select bbtn bbtn-outline';
    LAYOUTS.forEach(v => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = LAYOUT_NAMES[v];
      select.append(o);
    });
    select.addEventListener('change', () => setSettings({ layout: select.value }));
    viewRow.append(viewLabel, select);

    // Video side: left/right buttons.
    const sideRow = document.createElement('div');
    sideRow.className = 'delve-row';
    const sideLabel = document.createElement('span');
    sideLabel.className = 'delve-label';
    sideLabel.id = 'delve-side-label';
    sideLabel.textContent = 'Video side';
    const seg = document.createElement('div');
    seg.className = 'delve-seg';
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-labelledby', 'delve-side-label');
    SIDES.forEach(v => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'popup-toggle-btn';
      b.dataset.side = v;
      b.textContent = SIDE_NAMES[v];
      b.addEventListener('click', () => setSettings({ splitSide: v }));
      seg.append(b);
    });
    sideRow.append(sideLabel, seg);

    // Feature switches: one toggle each
    const featRows = FEATURES.map(([key, name, group]) => {
      const row = document.createElement('div');
      row.className = 'delve-row';
      const label = document.createElement('span');
      label.className = 'delve-label';
      label.id = 'delve-feat-' + key;
      label.textContent = name;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'popup-toggle-btn delve-toggle';
      b.dataset.feature = key;
      b.setAttribute('aria-labelledby', label.id);
      b.addEventListener('click', () => {
        setSettings({ [key]: !settings[key] });
        if (!settings.programInfo && progState) closePanel();
        ensureGuide();
        ensureTheater();
        ensurePicture();
        ensureAudio();
        ensureClock24();
        ensureTagTips();
        ensureWatchers();
        ensureTapes();
      });
      row.append(label, b);
      row.dataset.group = group;
      return row;
    });
    viewRow.dataset.group = sideRow.dataset.group = 'layout';

    const scroll = document.createElement('div');
    scroll.className = 'delve-scroll';
    DRAWER_GROUPS.forEach(([key, name]) => {
      const heading = document.createElement('button');
      heading.type = 'button';
      heading.className = 'delve-group-head';
      heading.dataset.group = key;
      heading.textContent = name;
      heading.insertAdjacentHTML('beforeend', GROUP_ARROW);
      heading.addEventListener('click', () => {
        const closed = settings.drawerClosed.includes(key);
        setSettings({ drawerClosed: closed ? settings.drawerClosed.filter(k => k !== key) : settings.drawerClosed.concat(key) });
      });
      const body = document.createElement('div');
      body.className = 'delve-group-body';
      body.dataset.group = key;
      body.append(...[viewRow, sideRow, ...featRows].filter(row => row.dataset.group === key));
      scroll.append(heading, body);
    });

    const footer = document.createElement('div');
    footer.className = 'delve-footer';
    const updateStatus = document.createElement('span');
    updateStatus.className = 'delve-update-status';
    const updateBtn = document.createElement('a');
    updateBtn.className = 'delve-update-btn bbtn bbtn-outline';
    updateBtn.href = SCRIPT_URL;
    updateBtn.addEventListener('click', e => {
      if (updateAvailable()) return;   // the link installs
      e.preventDefault();
      checkForUpdate(true);
    });
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'delve-reset-btn bbtn bbtn-outline';
    resetBtn.textContent = RESET_LABEL;
    let resetTimer = 0;
    resetBtn.addEventListener('click', () => {
      clearTimeout(resetTimer);
      if (resetBtn.textContent === RESET_LABEL) {
        resetBtn.textContent = 'Click again to confirm';
        resetTimer = setTimeout(() => { resetBtn.textContent = RESET_LABEL; }, 4000);
        return;
      }
      resetBtn.textContent = RESET_LABEL;
      setSettings(JSON.parse(JSON.stringify(DEFAULTS)));
      if (progState) closePanel();
      ensureGuide();
      ensureTheater();
      ensurePicture();
      ensureAudio();
      ensureClock24();
      ensureWatchers();
      ensureTapes();
    });
    const newsBtn = document.createElement('button');
    newsBtn.type = 'button';
    newsBtn.className = 'delve-news-btn bbtn bbtn-outline';
    newsBtn.textContent = "What's new";
    newsBtn.addEventListener('click', openChangelog);
    footer.append(updateStatus, updateBtn, newsBtn, resetBtn);

    drawer.append(head, scroll, footer);
    root.append(scrim, drawer);
  }

  function syncDrawer() {
    if (!drawer) return;
    drawer.querySelector('#delve-view').value = settings.layout;
    drawer.querySelectorAll('.delve-group-head').forEach(h => {
      const open = !settings.drawerClosed.includes(h.dataset.group);
      h.setAttribute('aria-expanded', String(open));
      drawer.querySelector('.delve-group-body[data-group="' + h.dataset.group + '"]').hidden = !open;
    });
    drawer.querySelectorAll('.delve-seg button').forEach(b => {
      const on = b.dataset.side === settings.splitSide;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('popup-toggle-btn--on', on);   // the site's "on" look: blue with gold text
    });
    drawer.querySelectorAll('.delve-toggle').forEach(b => {
      const on = !!settings[b.dataset.feature];
      b.textContent = on ? 'On' : 'Off';
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('popup-toggle-btn--on', on);
    });
    const available = updateAvailable();
    drawer.querySelector('.delve-update-status').textContent = available
      ? updateState.latest + ' available (installed ' + installedVersion + ')'
      : installedVersion + (updateState.latest ? ' (up to date)' : '');
    const updateBtn = drawer.querySelector('.delve-update-btn');
    updateBtn.textContent = available ? 'Update Available' : 'Check for Updates';
    updateBtn.classList.toggle('bbtn-gold', available);
    updateBtn.classList.toggle('bbtn-outline', !available);
  }

  function isOpen() { return !!drawer && drawer.classList.contains('open'); }

  function openDrawer() {
    if (!drawer) buildDrawer();
    syncDrawer();
    lastFocus = document.activeElement;
    scrim.classList.add('open');
    drawer.classList.add('open');
    const first = drawer.querySelector('.delve-select');
    if (first) first.focus({ preventScroll: true });
    setExpanded(true);
  }

  function closeDrawer() {
    if (!isOpen()) return;
    scrim.classList.remove('open');
    drawer.classList.remove('open');
    setExpanded(false);
    // preventScroll: the DELVE button is at the top; focusing it must not scroll the page up
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

  function setExpanded(v) {
    document.querySelectorAll('[data-delve-btn]').forEach(b => b.setAttribute('aria-expanded', String(v)));
  }

