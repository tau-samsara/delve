  // ---------------------------------------------------------------------------
  // Tape stack. A tape is a program saved from its info card: the playlist item the site plays from, plus your note and a
  // flag. The stack shows as a TAPES tab in the guide's info column and plays as a TAPES channel: the page's fetch is wrapped
  // so the site's lineup holds one more channel, which the site loads, tunes and plays like any other. Stored apart from the
  // settings, so "Reset all settings" keeps the tapes.
  // ---------------------------------------------------------------------------
  const TAPES_KEY = 'tapes';
  const TAPES_CHANNEL_ID = 'delve-tapes';
const TAPES_START_KEY = 'delve-tapes-start';   // sessionStorage: the tape the next page load starts the channel on
  const TAPE_FLAGS = [['', 'Normal'], ['broken', 'Broken'], ['quiet', 'Quiet']];

  const TAPES_CSS = `
html[data-delve-tapes-view] .app--guide .stage-info-col > :not(.delve-tabs):not(.delve-tapes) { display: none !important; }
.delve-tabs { display: flex; gap: var(--space-2, 8px); margin-bottom: var(--space-2, 8px); }
.delve-tabs .view-switch-key { flex: 0 0 auto; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; cursor: pointer; }
.delve-tapes { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
.delve-tapes-empty { margin: 0; }
.delve-tape { padding: 6px 0; border-top: 1px solid var(--border-color, rgb(38, 82, 178)); }
.delve-tape-head { display: flex; align-items: baseline; gap: var(--space-2, 8px); width: 100%; padding: 0; background: none; border: 0; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.delve-tape-head:focus-visible { outline: 2px solid var(--cyan, #00ccdd); outline-offset: 2px; }
.delve-tape-title { flex: 1 1 auto; min-width: 0; }
.delve-tape-body { display: flex; flex-direction: column; gap: var(--space-2, 8px); margin-top: var(--space-2, 8px); }
.delve-tape-note { box-sizing: border-box; width: 100%; min-height: 60px; resize: vertical; padding: 6px 8px; background: var(--bg-deep, #060b1e); color: inherit; border: 1px solid var(--border-color, rgb(38, 82, 178)); font: inherit; }
.delve-tape-flags { display: flex; gap: var(--space-2, 8px); }
.delve-tape-flags button { flex: 1 1 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; cursor: pointer; }
.delve-tape-action { text-transform: uppercase; letter-spacing: 1px; font-weight: 700; cursor: pointer; }
.guide-actions .delve-tape-save { margin-left: auto; }
.delve-prog-labelrow .delve-tape-save { margin-left: auto; min-height: 24px; padding: 0 8px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; cursor: pointer; }
`;

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
      return list.filter(validTape).filter(t => !seen.has(t.item.id) && seen.add(t.item.id)).map(t => ({
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
  const isSaved = id => tapes.some(t => t.item.id === id);
  function toggleTape(item) {
    if (isSaved(item.id)) tapes = tapes.filter(t => t.item.id !== item.id);
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
    const startIndex = Math.max(0, playable.findIndex(item => item.id === startId));
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
      const saved = isSaved(item.id);
      btn.textContent = saved ? '★ Saved' : '☆ Save tape';
      btn.setAttribute('aria-pressed', String(saved));
    };
    btn.addEventListener('click', () => { toggleTape(item); paint(); });
    btn.repaint = paint;
    paint();
    return btn;
  }
  // In the guide the button lives in the site's action row (WATCH, VIEW CHANNEL), for the card now shown.
  let tapeCardItem = null, tapeSaveButton = null;
  function removeSaveButton() {
    if (tapeSaveButton) tapeSaveButton.remove();
    tapeSaveButton = null;
  }
  function ensureSaveButton(col) {
    const actions = col.querySelector(':scope > .guide-actions');
    if (!actions || !tapeCardItem) { removeSaveButton(); return; }
    if (!tapeSaveButton || tapeSaveButton.dataset.itemId !== tapeCardItem.id) {
      removeSaveButton();
      tapeSaveButton = makeTapeButton(tapeCardItem, true);
      if (tapeSaveButton) tapeSaveButton.dataset.itemId = tapeCardItem.id;
    }
    if (tapeSaveButton && tapeSaveButton.parentNode !== actions) actions.append(tapeSaveButton);
  }

  // The TAPES tab beside INFO in the guide's info column.
  let tapesTabs = null, tapesPanel = null, tapesView = 'info', openTapeId = '';
  const infoColumn = () => document.querySelector('.app--guide .stage-info-col');
  function showInfoTab() {
    if (tapesView === 'info') return;
    tapesView = 'info';
    ensureTapes();
  }
  function paintTabs() {
    if (!tapesTabs) return;
    tapesTabs.querySelectorAll('button').forEach(b => {
      const on = b.dataset.view === tapesView;
      b.classList.toggle('view-switch-key--on', on);
      b.setAttribute('aria-selected', String(on));
    });
    tapesTabs.querySelector('[data-view="tapes"]').textContent = 'Tapes (' + tapes.length + ')';
  }
  function tapeRow(tape) {
    const open = openTapeId === tape.item.id;
    const row = el('div', 'delve-tape');
    const head = el('button', 'delve-tape-head');
    head.type = 'button';
    head.setAttribute('aria-expanded', String(open));
    head.append(el('span', 'guide-info-now-title delve-tape-title', tape.item.title));
    if (tape.item.year) head.append(el('span', 'btag btag-ghost', tape.item.year));
    if (tape.flag) head.append(el('span', 'btag btag-ghost', tape.flag.toUpperCase()));
    head.append(el('span', 'guide-info-now-desc', fmtDur(tape.item.duration)));
    head.addEventListener('click', () => { openTapeId = open ? '' : tape.item.id; renderTapes(); });
    row.append(head);
    if (!open) return row;

    const body = el('div', 'delve-tape-body');
    const note = el('textarea', 'delve-tape-note');
    note.value = tape.note;
    note.placeholder = 'Note';
    note.setAttribute('aria-label', 'Note for ' + tape.item.title);
    note.addEventListener('input', () => { tape.note = note.value; saveTapes(); });
    const flags = el('div', 'delve-tape-flags');
    TAPE_FLAGS.forEach(([key, name]) => {
      const b = el('button', 'popup-toggle-btn' + (tape.flag === key ? ' popup-toggle-btn--on' : ''), name);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(tape.flag === key));
      b.addEventListener('click', () => { tape.flag = key; saveTapes(); renderTapes(); });
      flags.append(b);
    });
    const remove = el('button', 'bbtn bbtn-outline delve-tape-action delve-tape-remove', 'Remove');
    remove.type = 'button';
    remove.addEventListener('click', () => { tapes = tapes.filter(t => t !== tape); openTapeId = ''; saveTapes(); renderTapes(); });
    body.append(note, flags);
    if (tape.flag !== 'broken') {
      const play = el('button', 'bbtn bbtn-gold delve-tape-action', 'Play from here');
      play.type = 'button';
      play.addEventListener('click', () => {
        try { sessionStorage.setItem(TAPES_START_KEY, tape.item.id); } catch (e) { /* the channel starts at the first tape */ }
        location.assign('/' + TAPES_CHANNEL_ID);
      });
      body.append(play);
    }
    body.append(remove);
    row.append(body);
    return row;
  }
  function renderTapes() {
    paintTabs();
    if (tapeSaveButton) tapeSaveButton.repaint();
    if (!tapesPanel) return;
    tapesPanel.textContent = '';
    if (!tapes.length) {
      tapesPanel.append(el('p', 'guide-info-now-desc delve-tapes-empty', 'No tapes yet. Open a program in the guide and press Save tape.'));
      return;
    }
    tapes.forEach(tape => tapesPanel.append(tapeRow(tape)));
  }
  function removeTapesUi() {
    if (tapesTabs) tapesTabs.remove();
    if (tapesPanel) tapesPanel.remove();
    removeSaveButton();
    root.removeAttribute('data-delve-tapes-view');
  }
  function ensureTapes() {
    const col = settings.tapesOn ? infoColumn() : null;
    if (!col) { removeTapesUi(); return; }
    if (!tapesTabs) {
      tapesTabs = el('div', 'delve-tabs cv-tabs view-switch');
      tapesTabs.setAttribute('role', 'tablist');
      [['info', 'Info'], ['tapes', 'Tapes']].forEach(([view, name]) => {
        const b = el('button', 'view-switch-key bbtn bbtn-outline', name);
        b.type = 'button';
        b.setAttribute('role', 'tab');
        b.dataset.view = view;
        b.addEventListener('click', () => { tapesView = view; ensureTapes(); });
        tapesTabs.append(b);
      });
    }
    if (tapesTabs.parentNode !== col || col.firstElementChild !== tapesTabs) col.prepend(tapesTabs);
    ensureSaveButton(col);
    const showTapes = tapesView === 'tapes';
    if (root.hasAttribute('data-delve-tapes-view') !== showTapes) root.toggleAttribute('data-delve-tapes-view', showTapes);
    if (!showTapes) { if (tapesPanel) tapesPanel.remove(); paintTabs(); return; }
    if (!tapesPanel) tapesPanel = el('div', 'delve-tapes');
    if (tapesPanel.parentNode !== col) { col.append(tapesPanel); renderTapes(); }
    paintTabs();
  }
