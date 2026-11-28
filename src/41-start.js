  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  // The drawer closes on page change. The site navigates without reloading, so watch the address: each change redraws and
  // wakes the observer below, and back/forward fire popstate.
  let lastHref = location.href;
  function checkRoute() {
    if (location.href === lastHref) return;
    lastHref = location.href;
    closeDrawer();
  }

  // Split: going to or from the guide view the page switches between a two-column grid and a single column in one step, so
  // the stage jumped width in one frame while only its height eased. The stage's box is remembered (ResizeObserver) and on a
  // view change animated from the old box to the new (Web Animations: width, height, sideways shift; works with the video on
  // either side), above the guide while it moves. Skipped with reduced motion.
  let stageBox = null, stageEl = null, stageRO = null, flipAnim = null;
  const readBox = s => { const b = s.getBoundingClientRect(); return { l: b.left, w: b.width, h: b.height }; };
  // Checked as soon as the app's class changes (a microtask, before the frame is drawn); waiting for the next frame would
  // show one frame of the new layout without the animation.
  let appEl = null, appObs = null;
  function trackApp() {
    const a = document.querySelector('.app');
    if (a === appEl) return;
    if (appObs) appObs.disconnect();
    appEl = a;
    if (a) { appObs = new MutationObserver(() => { trackStage(); checkMode(); }); appObs.observe(a, { attributes: true, attributeFilter: ['class'] }); }
  }
  function trackStage() {
    const s = document.querySelector('.app .stage');
    if (s === stageEl) return;
    if (stageRO) stageRO.disconnect();
    stageEl = s; stageBox = s ? readBox(s) : null;
    if (!s || typeof ResizeObserver === 'undefined') return;
    stageRO = new ResizeObserver(() => { if (stageEl && !flipAnim) stageBox = readBox(stageEl); });
    stageRO.observe(s);
  }
  function flipStage() {
    const s = stageEl;
    if (!s || !stageBox || !s.isConnected || !s.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const F = stageBox, L = readBox(s);
    // Into the guide view the site holds the stage at its old height until its own move ends; its grid row is the final height.
    const rows = (getComputedStyle(appEl).gridTemplateRows || '').split(' ').map(parseFloat);
    const inGrid = appEl.classList.contains('app--guide') || (appEl.classList.contains('app--watch') && !appEl.classList.contains('app--channel'));
    if (inGrid) { if (rows.length === 3 && rows[1] > 0) L.h = rows[1]; }
    else L.h = window.innerHeight - 100;   // the height the Channel rule above gives the stage
    // Into channel mode the chat panel is still at zero width (it grows with the site's animation), so the stage measures
    // full width: subtract the panel's final width.
    if (appEl.classList.contains('app--channel')) {
      const crow = document.querySelector('.screen-row--channel');
      let pw = Math.min(480, Math.max(320, window.innerWidth * 0.34)) + 8;   // fallback: the site's --cv-w clamp(320px, 34vw, 480px) plus its 8px gap
      if (crow) {
        const p = document.createElement('div');
        p.style.cssText = 'position:absolute;visibility:hidden;width:calc(var(--cv-w) + var(--cv-gap))';
        crow.append(p); pw = p.getBoundingClientRect().width || pw; p.remove();
      }
      L.w = Math.max(0, L.w - pw);
    }
    if (Math.abs(F.w - L.w) < 2 && Math.abs(F.l - L.l) < 2) return;
    if (flipAnim) flipAnim.cancel();
    s.style.position = 'relative'; s.style.zIndex = '5';
    const done = () => { s.style.position = ''; s.style.zIndex = ''; flipAnim = null; stageBox = s.isConnected ? readBox(s) : null; };
    const k0 = { transform: 'translateX(' + (F.l - L.l) + 'px)', width: F.w + 'px', height: F.h + 'px' }, k1 = { transform: 'none', width: L.w + 'px', height: L.h + 'px' };
    if (appEl.classList.contains('app--channel')) {   // the stage is a flex item in a row there and would grow to fill it: pin its size to the animated width
      Object.assign(k0, { flexGrow: 0, flexShrink: 0, flexBasis: F.w + 'px' }); Object.assign(k1, { flexGrow: 0, flexShrink: 0, flexBasis: L.w + 'px' });
    }
    flipAnim = s.animate([k0, k1], { duration: 500, easing: 'cubic-bezier(.4, 0, .2, 1)' });
    flipAnim.onfinish = done; flipAnim.oncancel = done;
  }

  let lastMode = '';
  function checkMode() {   // hold the extended guide's build until a mode change finishes animating
    const app = document.querySelector('.app');
    const mode = !app ? '' : app.classList.contains('app--channel') ? 'channel' : app.classList.contains('app--watch') ? 'watch' : app.classList.contains('app--guide') ? 'guide' : 'other';
    if (mode === lastMode) return;
    if (lastMode && root.getAttribute('data-delve-layout') === 'split' && (lastMode === 'guide') !== (mode === 'guide')) flipStage();
    if (lastMode) { wideHoldUntil = Date.now() + 650; setTimeout(ensureGuide, 700); }
    lastMode = mode;
  }

  // 24-hour clock: the site's 12-hour times are rewritten in place. The original is kept on the element so switching off restores it.
  const TIME_12H = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)\b/gi;
  const to24h = text => text.replace(TIME_12H, (_, h, min, sec, ampm) => String(h % 12 + (/p/i.test(ampm) ? 12 : 0)).padStart(2, '0') + ':' + min + (sec ? ':' + sec : ''));
  const TIME_TEXT = '.prevue-header-clock, .grid-time-label, .guide-info-upcoming-time, .player-upcoming-time';
  const TIME_TIP = '.grid-program[title]';
  const timeOf = e => e.matches(TIME_TIP) ? e.title : e.textContent;
  // Edit the existing text node: replacing it (textContent) leaves the site updating a detached node, so the clock freezes.
  const setTimeOf = (e, value) => {
    if (e.matches(TIME_TIP)) e.title = value;
    else if (e.childNodes.length === 1 && e.firstChild.nodeType === Node.TEXT_NODE) e.firstChild.data = value;
    else e.textContent = value;
  };
  // The header clock changes every second; convert it as soon as the site writes it, not on the next timer tick.
  const clockWatcher = new MutationObserver(() => ensureClock24());
  function watchHeaderClock() {
    const clock = document.querySelector('.prevue-header-clock');
    if (!clock || clock.dataset.delveWatched) return;
    clock.dataset.delveWatched = '';
    clockWatcher.observe(clock, { characterData: true, childList: true, subtree: true });
  }
  function ensureClock24() {
    if (settings.clock24) {
      watchHeaderClock();
      document.querySelectorAll(TIME_TEXT + ', ' + TIME_TIP).forEach(e => {
        if (e.matches(TIME_TEXT) && e.children.length) return;
        const was = timeOf(e), shown = to24h(was);
        if (shown === was) return;
        e.dataset.delveWas = was; e.dataset.delveShown = shown;
        setTimeOf(e, shown);
      });
      return;
    }
    document.querySelectorAll('[data-delve-shown]').forEach(e => {
      if (timeOf(e) === e.dataset.delveShown) setTimeOf(e, e.dataset.delveWas);   // the site may have rewritten it since
      delete e.dataset.delveWas; delete e.dataset.delveShown;
    });
  }

  const REWIND_TIP = 'Rewind: original broadcasts, with commercials, variety programming and whole blocks.';
  function ensureTagTips() {
    document.querySelectorAll('.grid-channel-rewind').forEach(tag => {
      if (settings.tagTips) { if (!tag.title) { tag.title = REWIND_TIP; tag.dataset.delveTip = ''; } }
      else if ('delveTip' in tag.dataset) { tag.removeAttribute('title'); delete tag.dataset.delveTip; }
    });
  }

  // Watcher count. The number is copied from the site's own (hidden) header badge; the home page never loads it, so the
  // last copy is kept until reload.
  let siteWatchers = null;
  function ensureWatchers() {
    const siteBadge = document.querySelector('.header-viewers');
    const siteNumber = siteBadge && siteBadge.querySelector('.header-viewers-num');
    if (siteNumber && siteNumber.textContent) siteWatchers = { number: siteNumber.textContent, icon: (siteBadge.querySelector('svg') || { outerHTML: '' }).outerHTML };
    const clock = document.querySelector('.prevue-header-clock');
    const homeStats = document.querySelector('.hp-stats');
    let badge = document.getElementById('delve-watchers');
    let card = document.getElementById('delve-watchers-card');
    if (!settings.watchers || !siteWatchers) {
      if (badge) badge.remove();
      if (card) card.remove();
      return;
    }
    if (clock) {
      if (!badge) {
        badge = document.createElement('span');
        badge.id = 'delve-watchers'; badge.className = 'header-viewers';
        badge.title = 'Watching Spelunkr right now, on every channel';
      }
      const html = siteWatchers.icon + '<span class="header-viewers-num">' + siteWatchers.number + '</span>';
      if (badge.innerHTML !== html) badge.innerHTML = html;
      if (clock.nextElementSibling !== badge) clock.after(badge);
    } else if (badge) badge.remove();
    if (homeStats) {
      if (!card) {
        card = document.createElement('div');
        card.id = 'delve-watchers-card'; card.className = 'hp-stat';
        card.innerHTML = '<div class="hp-stat-val"></div><div class="hp-stat-label">Watching</div><div class="hp-stat-sub">Right Now</div>';
      }
      const valueEl = card.querySelector('.hp-stat-val');
      if (valueEl.textContent !== siteWatchers.number) valueEl.textContent = siteWatchers.number;
      if (card.parentElement !== homeStats) homeStats.append(card);
    } else if (card) card.remove();
  }

  let pending = false;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false; checkRoute(); trackApp(); trackStage(); checkMode(); ensureButtons();
      if (progState && lastInfo && panel && !panel.isConnected) render(lastInfo.info);   // the site redrew the column
      ensureNowLinks();
      ensureMute();
      ensureTheater();
      ensurePicture();
      ensureAudio();
      ensureHide();
      ensureAutoSpelunk();
      ensureWatermark();
      ensureClock24();
      ensureTagTips();
      ensureWatchers();
      ensureTapes();
      ensureGuide();
      ensureHiddenChannelGuard();
    });
  });

  applyLayout();
  applyPicture();
  applyHide();
  if (document.head) applyStyle();
  else new MutationObserver((_, obs) => { if (document.head) { obs.disconnect(); applyStyle(); } }).observe(root, { childList: true });
  // The site updates viewer counts in place (text node and title), which childList alone misses.
  observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title'] });
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    applyLayout(); ensureButtons(); placeWatermark();
    resizeQuietAt = Date.now() + 250;   // the extended guide is rebuilt once the window stops resizing
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { ensureWide(); updateWideBg(); }, 260);
  });
  window.addEventListener('popstate', checkRoute);
  window.addEventListener('hashchange', checkRoute);
  // Every second: move the Now line and re-measure the wider view (the guide's width changes without a page change while
  // the stage animates, and a view measured mid-animation would stay tiny).
  setInterval(() => { ensureWide(); updatePan(); ensureClock24(); }, 1000);
  ensureButtons();
  if (typeof GM_xmlhttpRequest === 'function' && VERSION_RE.test(installedVersion)) {
    checkForUpdate();
    setInterval(checkForUpdate, UPDATE_EVERY_MS);
  } else console.warn('[delve] GM_xmlhttpRequest or script version not available; update check unavailable');
