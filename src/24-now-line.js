  // ---------------------------------------------------------------------------
  // Now line and playhead. Guide view only. The line marks the current time down through every row; the playhead (an
  // upside-down pentagon) sits at the bottom of the hour row. Both use the hour labels' scale, so they stay right between
  // the site's redraws.
  // ---------------------------------------------------------------------------
  const NOW_CSS = `
html[data-delve-pan] :is(.app--guide, .app--watch:not(.app--channel)) .tv-grid .tv-grid-body { position: relative; }
.delve-now { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; z-index: 2; pointer-events: none; background: var(--8s-yellow, #ffd740); box-shadow: 0 0 0 1px rgba(0, 0, 0, .45); }
/* The line "breathes": a faint glow that swells and settles, never fully off; the playhead stays still. It always plays,
   even with reduced motion (the user's choice). */
@keyframes delve-now-glow {
  0%, 100% { box-shadow: 0 0 0 1px rgba(0, 0, 0, .45), 0 0 5px 0 rgba(255, 230, 0, .35); }
  50% { box-shadow: 0 0 0 1px rgba(0, 0, 0, .45), 0 0 9px 1px rgba(255, 230, 0, .6); }
}
.delve-now { animation: delve-now-glow 2.4s ease-in-out infinite; }
/* The playhead: an upside-down pentagon in the hour row, its point touching the line below. */
.delve-now-tag { position: absolute; bottom: 0; width: 16px; height: 16px; margin-left: -8px; z-index: 4; pointer-events: none; background: var(--8s-yellow, #ffd740); clip-path: polygon(0 0, 100% 0, 100% 55%, 50% 100%, 0 55%); }
/* Hour labels stay readable when the playhead passes over them (M1). */
.delve-wide-body .grid-time-axis .grid-time-label { z-index: 5; text-shadow: -1px 0 #000, 1px 0 #000, 0 -1px #000, 0 1px #000, 0 0 3px #000; }
`;
  let nowEl = null, nowTag = null;

  // The Now line and playhead move smoothly with the clock: set every frame as a transform (no layout work) from the time
  // since the view's first hour.
  function moveNow() {
    if (!wideRoot || !wideRoot.isConnected || !nowTag || !wideTracks.length) return;
    const x = (Date.now() - wide.t0) / HOUR * wide.pxh;
    nowTag.style.transform = 'translateX(' + x + 'px)';
    const t = 'translateX(' + x + 'px)';
    wideTracks.forEach(rt => { if (rt.seg) rt.seg.style.transform = t; });   // one piece of the line per row
  }
  (function frame() { moveNow(); followNow(); requestAnimationFrame(frame); })();

  function removeNow() {
    document.querySelectorAll('.delve-now, .delve-now-tag').forEach(n => n.remove());
  }

  function updatePan() {
    if (!settings.extended) {   // the Now line and playhead belong to the extended guide
      if (nowEl || root.hasAttribute('data-delve-pan')) { root.removeAttribute('data-delve-pan'); removeNow(); }
      return;
    }
    const grid = document.querySelector(':is(.app--guide, .app--watch:not(.app--channel)) .tv-grid');
    if (grid && wideRoot && wideRoot.isConnected) {   // the wider view has its own scale: pixels from its start time
      const axisW = wideRoot.querySelector('.grid-time-axis');
      if (!nowTag) nowTag = el('span', 'delve-now-tag');
      if (nowEl && nowEl.isConnected) nowEl.remove();   // the single line of the site's own scale (below) is not used in the wider view
      wideTracks.forEach(rt => { if (!rt.seg || !rt.seg.isConnected) { rt.seg = el('div', 'delve-now'); rt.seg.style.left = '0'; rt.track.append(rt.seg); } });
      if (axisW && nowTag.parentNode !== axisW) axisW.append(nowTag);
      nowTag.style.left = '0';   // the position itself is set every frame (moveNow)
      moveNow();
      updateWideBg();
      updateNowBtn();
      syncWide();
      return;
    }
    if (nowBtn && !nowBtn.hidden) nowBtn.hidden = true;
    const map = grid && makeTimeMapper();
    if (!map) { root.removeAttribute('data-delve-pan'); removeNow(); return; }
    root.setAttribute('data-delve-pan', '1');
    const body = grid.querySelector('.tv-grid-body'), axis = grid.querySelector('.grid-time-axis');
    const progs = grid.querySelector('.grid-row .grid-programs');
    if (!body || !axis || !progs) return;
    if (!nowEl) { nowEl = el('div', 'delve-now'); nowTag = el('span', 'delve-now-tag'); }
    if (nowEl.parentNode !== body) body.append(nowEl);
    if (nowTag.parentNode !== axis) axis.append(nowTag);
    const pct = map.pctOf(new Date());
    nowEl.style.transform = ''; nowTag.style.transform = '';   // positions here are plain left values
    nowTag.style.left = pct + '%';
    const br = body.getBoundingClientRect(), pr = progs.getBoundingClientRect();
    nowEl.style.left = (pr.left + pr.width * pct / 100 - br.left) + 'px';
  }

  // Mute button in the guide. The site draws its mute button in the guide controls only after audio is unlocked by a click; on
  // a fresh load the browser mutes the video and there is no button. Add one in the same place, with the same look and icon.
  // Its click sets the video's muted flag itself (the browser only allows unmuting from a click), then clicks the site's
  // hidden button if the site's muted state no longer matches. Hidden by CSS (and removed) whenever the site's own button is there.
  const MUTE_SVG = d => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true">' + d + '</svg>';
  const MUTE_ICON_ON = MUTE_SVG('<path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM17.78 9.22a.75.75 0 1 0-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06l1.72-1.72 1.72 1.72a.75.75 0 1 0 1.06-1.06L20.56 12l1.72-1.72a.75.75 0 1 0-1.06-1.06l-1.72 1.72-1.72-1.72Z"></path>');   // the site's own "muted" speaker
  const MUTE_ICON_OFF = MUTE_SVG('<path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z"></path><path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06Z"></path>');   // the site's own "sound on" speaker
  function setMuted(toMuted) {
    const v = document.querySelector('video'), s = document.querySelector('.stage-volume-bar .player-mute-btn');
    if (!v) { if (s) s.click(); return; }
    v.muted = toMuted;
    if (!toMuted) {   // the video starts at full volume and the site's slider only applies after a mute toggle: apply it now
      const sl = document.querySelector('.player-volume-slider'), want = sl ? parseFloat(sl.value) : NaN;
      if (want >= 0 && want <= 1 && v.volume !== want) v.volume = want;
    }
    if (s) setTimeout(() => { if (/^Unmute/.test(s.title) !== toMuted) s.click(); }, 0);
  }
  function muteClick() {
    const v = document.querySelector('video');
    if (!v) { const s = document.querySelector('.stage-volume-bar .player-mute-btn'); if (s) s.click(); return; }
    setMuted(!v.muted);
  }
  // Volume memory. The site keeps no volume between loads. Delve saves the volume when it changes while unmuted, and applies
  // it to the site's slider once per page load.
  let volRestored = false;
  function restoreVolume() {
    if (volRestored) return;
    const sl = document.querySelector('.player-volume-slider');
    if (!sl) return;
    volRestored = true;
    if (parseFloat(sl.value) === settings.volume) return;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(sl, String(settings.volume));
    sl.dispatchEvent(new Event('input', { bubbles: true }));
  }
  // Mute memory: saved when you change it (a click or key just before), not on page load (the browser starts the video muted).
  // If you left it unmuted, the first click or key unmutes it (the browser requires a gesture), unless that click is on a mute
  // button or the key is M.
  let lastGesture = 0, autoUnmuteDone = false;
  const gesture = () => { lastGesture = Date.now(); };
  document.addEventListener('pointerdown', gesture, true);
  document.addEventListener('keydown', gesture, true);
  document.addEventListener('volumechange', e => {
    const v = e.target;
    if (!volRestored || !v || v.tagName !== 'VIDEO') return;
    if (!v.muted) {
      const vol = Math.round(v.volume * 100) / 100;
      if (vol !== settings.volume) { settings.volume = vol; save(settings); }
    }
    if (Date.now() - lastGesture < 1500 && v.muted !== settings.muted) { settings.muted = v.muted; save(settings); }
  }, true);
  function autoUnmute(e) {
    if (autoUnmuteDone) return;
    const v = document.querySelector('video');
    if (!v || !volRestored) return;
    autoUnmuteDone = true;
    if (settings.muted !== false || !v.muted) return;
    if (e.type === 'keydown' ? (e.key === 'm' || e.key === 'M') : (e.target && e.target.closest && e.target.closest('.player-mute-btn, .guide-ctrl-mute, #delve-mute'))) return;
    setMuted(false);
  }
  document.addEventListener('click', autoUnmute, true);
  document.addEventListener('keydown', autoUnmute, true);
  function ensureMute() {
    restoreVolume();
    const all = document.querySelectorAll('#delve-mute');
    for (let i = 1; i < all.length; i++) all[i].remove();
    let mine = all[0];
    const ctl = document.querySelector('.app--guide .stage-guide-controls');
    const src = document.querySelector('.stage-volume-bar .player-mute-btn');
    if (!ctl || !src || document.querySelector('.guide-ctrl-mute')) { if (mine) mine.remove(); return; }
    if (!mine) {
      mine = document.createElement('button');
      mine.id = 'delve-mute'; mine.type = 'button'; mine.className = 'guide-ctrl-btn';
      mine.addEventListener('click', muteClick);
    }
    if (mine.parentElement !== ctl) ctl.append(mine);
    const v = document.querySelector('video');
    const muted = v ? v.muted : /^Unmute/.test(src.title);   // the video's real state (on a fresh load the site says "unmuted" while the browser keeps the video muted)
    const title = muted ? 'Unmute (M)' : 'Mute (M)', icon = muted ? MUTE_ICON_ON : MUTE_ICON_OFF;
    if (mine.title !== title) mine.title = title;
    if (mine.dataset.state !== (muted ? 'muted' : 'on')) { mine.dataset.state = muted ? 'muted' : 'on'; mine.innerHTML = icon; }
  }
  document.addEventListener('volumechange', () => { if (document.getElementById('delve-mute')) ensureMute(); }, true);   // media events do not bubble: capture

  // Volume slider in the guide: the site's slider is clipped away in the compact player, so hovering a mute button shows one.
  const MUTE_BUTTON_SELECTOR = '#delve-mute, .guide-ctrl-mute';
  const VOLUME_POPUP_CSS = `
:root #delve-volume-popup { position: fixed; z-index: 1000; bottom: auto; transform: none; width: 180px; box-sizing: border-box; }
:root #delve-volume-popup[hidden] { display: none; }
#delve-volume-popup .cc-panel-head { display: flex; justify-content: space-between; text-align: left; }
:root #delve-volume-popup .delve-slider.player-volume-slider { display: block; flex: none; width: 100%; max-width: none; margin: 0 0 4px; box-sizing: border-box; }
`;
  let volumePopup = null, volumePopupSlider = null, volumePopupValue = null, volumePopupHideTimer = 0;
  function showVolumeInPopup(volume) {
    volumePopupSlider.value = volume;
    volumePopupSlider.style.setProperty('--volume-pct', volume * 100 + '%');
    volumePopupValue.textContent = Math.round(volume * 100) + '%';
  }
  function setVolumeFromPopup() {
    const video = document.querySelector('video'), siteSlider = document.querySelector('.player-volume-slider:not(.delve-slider)');
    const volume = Number(volumePopupSlider.value);
    showVolumeInPopup(volume);
    if (video) video.volume = volume;
    if (!siteSlider) return;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(siteSlider, String(volume));
    siteSlider.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function showVolumePopup(button) {
    const video = document.querySelector('video');
    if (!video) return;
    clearTimeout(volumePopupHideTimer);
    if (!volumePopup) {
      volumePopup = document.createElement('div');
      volumePopup.id = 'delve-volume-popup'; volumePopup.className = 'cc-panel'; volumePopup.hidden = true;
      volumePopupSlider = document.createElement('input');
      volumePopupSlider.type = 'range'; volumePopupSlider.className = 'player-volume-slider delve-slider';
      volumePopupSlider.min = 0; volumePopupSlider.max = 1; volumePopupSlider.step = 0.01;
      volumePopupSlider.addEventListener('input', setVolumeFromPopup);
      volumePopupValue = document.createElement('span');
      const head = document.createElement('label');
      head.className = 'cc-panel-head';
      head.append('Volume', volumePopupValue);
      volumePopup.append(head, volumePopupSlider);
      document.body.append(volumePopup);
    }
    showVolumeInPopup(video.volume);
    volumePopup.hidden = false;
    const buttonBox = button.getBoundingClientRect(), popupBox = volumePopup.getBoundingClientRect();
    const left = Math.min(Math.max(4, buttonBox.left + buttonBox.width / 2 - popupBox.width / 2), innerWidth - popupBox.width - 4);
    const above = buttonBox.top - popupBox.height - 2;
    volumePopup.style.left = left + 'px';
    volumePopup.style.top = (above >= 4 ? above : buttonBox.bottom + 2) + 'px';
  }
  document.addEventListener('mouseover', e => {
    if (!volumePopup && !settings.volumePopup) return;
    const over = e.target.closest ? e.target : e.target.parentElement;
    const button = over && over.closest(MUTE_BUTTON_SELECTOR);
    if (button && settings.volumePopup) { showVolumePopup(button); return; }
    if (!volumePopup || volumePopup.hidden || e.buttons || (over && over.closest('#delve-volume-popup'))) return;
    clearTimeout(volumePopupHideTimer);
    volumePopupHideTimer = setTimeout(() => { volumePopup.hidden = true; }, 250);
  });

  // The site hides its own watcher badge in this theme; Delve's copy uses the same class and shows itself.
  const WATCHERS_CSS = `
#delve-watchers { display: inline-flex !important; order: 7; margin-left: var(--space-2); }
`;

