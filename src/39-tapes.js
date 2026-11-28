  // ---------------------------------------------------------------------------
  // Tape stack. A tape is a program saved from its info card: the playlist item the site plays from, plus your note and a
  // flag. The stack is a mode of the guide panel (a TAPES tab beside GUIDE) and plays as a TAPES channel: the page's fetch is wrapped
  // so the site's lineup holds one more channel, which the site loads, tunes and plays like any other. Stored apart from the
  // settings, so "Reset all settings" keeps the tapes.
  // ---------------------------------------------------------------------------
  const TAPES_KEY = 'tapes';
  const TAPES_CHANNEL_ID = 'delve-tapes';
  const TAPES_START_KEY = 'delve-tapes-start';   // sessionStorage: the tape the next page load starts the channel on
  const TAPES_MODE_KEY = 'delve-tapes-mode';     // sessionStorage: '1' while the TAPES tab is the one showing
  const TAPE_FLAGS = [['', 'Normal'], ['broken', 'Broken'], ['quiet', 'Quiet']];

  const TAPES_CSS = `
.delve-modebar { position: sticky; top: 0; left: 0; z-index: 9; flex: 0 0 auto; box-sizing: border-box; height: 52px; padding: 8px; display: flex; gap: var(--space-2, 8px); background: inherit; }
.delve-modebar .view-switch-key { flex: 1 1 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; cursor: pointer; }
/* The tab bar takes the top 52px; the toolbar and the time header sit below it. */
html[data-delve-modes] :is(.app--guide, .app--watch:not(.app--channel)) .tv-grid .delve-bar { top: 52px; }
html[data-delve-modes] :is(.app--guide, .app--watch:not(.app--channel)) .tv-grid .grid-time-header { top: 52px; }
html[data-delve-modes][data-delve-bar] :is(.app--guide, .app--watch:not(.app--channel)) .tv-grid .grid-time-header { top: 104px; }
html[data-delve-tapes-mode] :is(.app--guide, .app--watch:not(.app--channel)) .tv-grid > :not(.delve-modebar):not(.delve-tapes-view) { display: none !important; }
.delve-tapes-view { position: sticky; left: 0; flex: 1 1 auto; box-sizing: border-box; padding: 0 8px 8px; }
.delve-tapes-empty { margin: 0; padding: 8px; }
.delve-tape-head, .delve-tape-row { display: grid; grid-template-columns: 72px minmax(0, 1.2fr) 84px 130px minmax(120px, 1fr) 40px; align-items: center; gap: var(--space-2, 8px); padding: 6px 8px; }
.delve-tape-head { color: var(--cyan, #00ccdd); font-size: 12px; letter-spacing: 1px; text-transform: uppercase; border-bottom: 1px solid var(--border-color, rgb(38, 82, 178)); }
.delve-tape-row { border-bottom: 1px solid var(--border-color, rgb(38, 82, 178)); }
.delve-tape-row[data-flag="broken"] .delve-tape-name { text-decoration: line-through; opacity: .6; }
.delve-tape-title { display: flex; align-items: baseline; gap: var(--space-2, 8px); min-width: 0; }
.delve-tape-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.delve-tape-play, .delve-tape-remove { min-height: 30px; padding: 0 8px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; cursor: pointer; }
.delve-tape-play:disabled { opacity: .4; cursor: default; }
.delve-tape-flag { width: 100%; min-height: 30px; height: 30px; }
.delve-tape-note { box-sizing: border-box; width: 100%; height: 30px; padding: 0 8px; background: var(--bg-deep, #060b1e); color: inherit; border: 1px solid var(--border-color, rgb(38, 82, 178)); font: inherit; }
.guide-actions .delve-tape-save { margin-left: auto; }
.delve-prog-labelrow .delve-tape-save { margin-left: auto; min-height: 24px; padding: 0 8px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; cursor: pointer; }
`;

  // Many programs share one Archive item and differ by file (episodes of a series): the file is part of what a tape is.
  const tapeKey = item => item.id + '|' + (item.file || item.mp4 || '');   // an Archive id never holds a "|"

  function validTape(tape) {
    const item = tape && tape.item;
    return !!item && typeof item === 'object' && typeof item.id === 'string' && item.id !== '' && typeof item.title === 'string' &&
      Number.isInteger(item.duration) && item.duration > 0;
  }
  function loadTapes() {
    try {
      const raw = GM_getValue(TAPES_KEY, null);
      const list = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!Array.isArray(list)) return [];
      const seen = new Set();
      return list.filter(validTape).filter(t => !seen.has(tapeKey(t.item)) && seen.add(tapeKey(t.item))).map(t => ({
        item: t.item,
        note: typeof t.note === 'string' ? t.note : '',
        flag: TAPE_FLAGS.some(([key]) => key === t.flag) ? t.flag : '',
      }));
    } catch (e) { return []; }
  }
  let tapes = loadTapes();
  function saveTapes() {
    try { GM_setValue(TAPES_KEY, tapes); }
    catch (e) { console.warn('[delve] could not save tapes', e); }
  }
  const isSaved = item => tapes.some(t => tapeKey(t.item) === tapeKey(item));
  function toggleTape(item) {
    if (isSaved(item)) tapes = tapes.filter(t => tapeKey(t.item) !== tapeKey(item));
    else tapes.push({ item: JSON.parse(JSON.stringify(item)), note: '', flag: '' });
    saveTapes();
    renderTapes();
  }

  // Runs in the page (see addTapesChannel); self-contained because it is serialized to text. The channel is added to every
  // lineup the site loads, and its manifest and details are answered from the saved items. Everything else is untouched.
  function tapesPageHelper(channelId, items, startIndex) {
    const realFetch = window.fetch.bind(window);
    const json = body => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
    let built = null;
    async function addChannel(response, url) {
      const lineup = await response.clone().json();
      const template = lineup.channels.find(c => c && !c.comingSoon && c.versions && c.versions.length);
      if (!template) return response;
      if (!built) {
        const templateManifest = await realFetch(url.replace(/lineup\.json.*$/, '') + template.versions[0].manifest).then(r => r.json());
        const epochMs = Date.now();
        built = {
          epochMs,
          manifest: { engine: templateManifest.engine, channel: channelId, version: 1, items, bumps: [], audio: [], platform: templateManifest.platform, ads: null, build: templateManifest.build },
          details: { channel: channelId, version: 1, items: items.map(() => ({})), build: templateManifest.build },
        };
      }
      const usedDials = lineup.channels.map(c => c && c.dial);
      let dial = 99;
      while (usedDials.includes(dial)) dial++;
      lineup.channels.push({
        id: channelId, name: 'TAPES', emoji: '📼', color: '#ffd740', description: 'Your saved tapes, one after another.', family: null, logomark: null, dial,
        stats: { items: items.length, videoSeconds: items.reduce((sum, item) => sum + item.duration, 0) },
        versions: [{ v: 1, manifest: 'manifests/' + channelId + '/v1.json', details: 'details/' + channelId + '/v1.json', epochMs: built.epochMs, effectiveAtMs: built.epochMs, startIndex }],
      });
      return json(lineup);
    }
    window.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : (input && input.url) || String(input);
      if (/\/lineup\.json(\?|$)/.test(url)) {
        return realFetch(input, init).then(response => (response.ok ? addChannel(response, url).catch(() => response) : response));
      }
      if (built && url.indexOf('/manifests/' + channelId + '/') >= 0) return Promise.resolve(json(built.manifest));
      if (built && url.indexOf('/details/' + channelId + '/') >= 0) return Promise.resolve(json(built.details));
      return realFetch(input, init);
    };
  }
  function addTapesChannel() {
    const playable = tapes.filter(t => t.flag !== 'broken').map(t => t.item);
    if (!playable.length) return;
    let startId = '';
    try { startId = sessionStorage.getItem(TAPES_START_KEY) || ''; sessionStorage.removeItem(TAPES_START_KEY); } catch (e) { /* start at the first tape */ }
    const startIndex = Math.max(0, playable.findIndex(item => tapeKey(item) === startId));
    try {
      const s = document.createElement('script');
      s.textContent = '(' + tapesPageHelper.toString() + ')(' + JSON.stringify(TAPES_CHANNEL_ID) + ',' + JSON.stringify(playable) + ',' + startIndex + ');';
      (document.head || root).appendChild(s);
      s.remove();
    } catch (e) { console.warn('[delve] could not add the TAPES channel; playing the stack is unavailable'); }
  }
  if (settings.tapesOn) addTapesChannel();

  // The save button on a program's info card.
  function makeTapeButton(item, inActionRow) {
    if (!settings.tapesOn || !item || typeof item.id !== 'string' || !item.id || !Number.isInteger(item.duration) || item.duration <= 0) return null;
    const btn = el('button', 'bbtn bbtn-outline delve-tape-save' + (inActionRow ? ' guide-channel-btn' : ''));   // the row's styling hangs on the site's class
    btn.type = 'button';
    const paint = () => {
      const saved = isSaved(item);
      btn.textContent = saved ? '★ Saved' : '☆ Save tape';
      btn.setAttribute('aria-pressed', String(saved));
    };
    btn.addEventListener('click', () => { toggleTape(item); paint(); });
    btn.repaint = paint;
    paint();
    return btn;
  }
  // In the guide the button lives in the site's action row (WATCH, VIEW CHANNEL): for the card now shown, otherwise for the
  // program the site's "Now playing" block shows (found by the same lookup that adds its IMDb / Archive links).
  let tapeCardItem = null, tapeSaveButton = null;
  function removeSaveButton() {
    if (tapeSaveButton) tapeSaveButton.remove();
    tapeSaveButton = null;
  }
  function nowPlayingItem() {
    const { block, title } = NOW_BLOCKS[0];
    const titleElement = document.querySelector(block + ' ' + title);
    const channelId = highlightedChannel();
    const found = titleElement && channelId && nowCache.get(channelId + '|' + titleElement.textContent.trim());
    return (found && found.item) || null;
  }
  function ensureSaveButton(col) {
    const actions = col.querySelector(':scope > .guide-actions');
    const item = tapeCardItem || nowPlayingItem();
    if (!actions || !item) { removeSaveButton(); return; }
    if (!tapeSaveButton || tapeSaveButton.dataset.itemId !== tapeKey(item)) {
      removeSaveButton();
      tapeSaveButton = makeTapeButton(item, true);
      if (tapeSaveButton) tapeSaveButton.dataset.itemId = tapeKey(item);
    }
    if (tapeSaveButton && tapeSaveButton.parentNode !== actions) actions.append(tapeSaveButton);
  }

  // The guide panel gets two tabs, GUIDE and TAPES. TAPES hides the guide and shows the tape stack as a table in its place.
  const readTapesMode = () => { try { return sessionStorage.getItem(TAPES_MODE_KEY) === '1'; } catch (e) { return false; } };   // kept across the reload Play causes
  function setTapesMode(on) {
    tapesMode = on;
    try { sessionStorage.setItem(TAPES_MODE_KEY, on ? '1' : '0'); } catch (e) { /* the mode is not kept */ }
  }
  let modeTabs = null, tapeTable = null, tapesMode = readTapesMode();
  const guidePanel = () => document.querySelector(':is(.app--guide, .app--watch:not(.app--channel)) .tv-grid');
  const infoColumn = () => document.querySelector('.app--guide .stage-info-col');
  function paintTabs() {
    if (!modeTabs) return;
    modeTabs.querySelectorAll('button').forEach(b => {
      const on = (b.dataset.view === 'tapes') === tapesMode;
      b.classList.toggle('view-switch-key--on', on);
      b.setAttribute('aria-selected', String(on));
    });
    modeTabs.querySelector('[data-view="tapes"]').textContent = 'Tapes (' + tapes.length + ')';
  }
  // Reload onto the guide with the TAPES channel tuned: the site opens on the channel in localStorage "spelunkr-last-channel".
  function playFrom(tape) {
    try {
      sessionStorage.setItem(TAPES_START_KEY, tapeKey(tape.item));
      localStorage.setItem('spelunkr-last-channel', TAPES_CHANNEL_ID);
    } catch (e) { console.warn('[delve] could not tune the TAPES channel; Play from here is unavailable'); return; }
    location.assign('/');
  }
  function tapeRow(tape) {
    const row = el('div', 'delve-tape-row');
    row.dataset.flag = tape.flag;
    const play = el('button', 'bbtn bbtn-gold delve-tape-play', 'Play');
    play.type = 'button';
    play.disabled = tape.flag === 'broken';
    play.setAttribute('aria-label', 'Play from ' + tape.item.title);
    play.addEventListener('click', () => playFrom(tape));
    const title = el('div', 'delve-tape-title');
    title.append(el('span', 'delve-tape-name', tape.item.title));
    if (tape.item.year) title.append(el('span', 'btag btag-ghost', tape.item.year));
    const flag = el('select', 'delve-select bbtn bbtn-outline delve-tape-flag');
    flag.setAttribute('aria-label', 'Flag for ' + tape.item.title);
    TAPE_FLAGS.forEach(([key, name]) => { const o = el('option', null, name); o.value = key; flag.append(o); });
    flag.value = tape.flag;
    flag.addEventListener('change', () => { tape.flag = flag.value; saveTapes(); renderTapes(); });
    const note = el('input', 'delve-tape-note');
    note.type = 'text';
    note.value = tape.note;
    note.placeholder = 'Note';
    note.setAttribute('aria-label', 'Note for ' + tape.item.title);
    note.addEventListener('input', () => { tape.note = note.value; saveTapes(); });
    const remove = el('button', 'bbtn bbtn-outline delve-tape-remove', '✕');
    remove.type = 'button';
    remove.title = 'Remove';
    remove.setAttribute('aria-label', 'Remove ' + tape.item.title);
    remove.addEventListener('click', () => { tapes = tapes.filter(t => t !== tape); saveTapes(); renderTapes(); });
    row.append(play, title, el('div', 'delve-tape-length', fmtDur(tape.item.duration)), flag, note, remove);
    return row;
  }
  function renderTapes() {
    paintTabs();
    if (tapeSaveButton) tapeSaveButton.repaint();
    if (!tapeTable) return;
    tapeTable.textContent = '';
    if (!tapes.length) {
      tapeTable.append(el('p', 'delve-tapes-empty', 'No tapes yet. Open a program in the guide and press Save tape.'));
      return;
    }
    const head = el('div', 'delve-tape-head');
    ['', 'Tape', 'Length', 'Flag', 'Note', ''].forEach(name => head.append(el('div', null, name)));
    tapeTable.append(head);
    tapes.forEach(tape => tapeTable.append(tapeRow(tape)));
  }
  function removeTapesUi() {
    if (modeTabs) modeTabs.remove();
    if (tapeTable) tapeTable.remove();
    removeSaveButton();
    root.removeAttribute('data-delve-modes');
    root.removeAttribute('data-delve-tapes-mode');
  }
  function ensureTapes() {
    const grid = settings.tapesOn ? guidePanel() : null;
    const col = settings.tapesOn ? infoColumn() : null;
    if (col) ensureSaveButton(col); else removeSaveButton();
    if (!grid) { removeTapesUi(); return; }
    if (!modeTabs) {
      modeTabs = el('div', 'delve-modebar cv-tabs view-switch');
      modeTabs.setAttribute('role', 'tablist');
      [['guide', 'Guide'], ['tapes', 'Tapes']].forEach(([view, name]) => {
        const b = el('button', 'view-switch-key bbtn bbtn-outline', name);
        b.type = 'button';
        b.setAttribute('role', 'tab');
        b.dataset.view = view;
        b.addEventListener('click', () => { setTapesMode(view === 'tapes'); ensureTapes(); });
        modeTabs.append(b);
      });
    }
    if (grid.firstElementChild !== modeTabs) grid.prepend(modeTabs);
    if (!root.hasAttribute('data-delve-modes')) root.setAttribute('data-delve-modes', '1');
    if (root.hasAttribute('data-delve-tapes-mode') !== tapesMode) root.toggleAttribute('data-delve-tapes-mode', tapesMode);
    if (!tapesMode) { if (tapeTable) tapeTable.remove(); paintTabs(); return; }
    if (!tapeTable) tapeTable = el('div', 'delve-tapes-view');
    if (tapeTable.parentNode !== grid) { grid.append(tapeTable); renderTapes(); }
    paintTabs();
  }
