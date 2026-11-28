  // ---------------------------------------------------------------------------
  // Theater mode. Watch and channel mode: the video fills the window with nothing else on the page. Not saved; stays on when
  // the channel changes; ends when the watch view is left or the feature is switched off.
  // ---------------------------------------------------------------------------
  const THEATER_CSS = `
html[data-delve-theater] { overflow: hidden !important; }
html[data-delve-theater] .app--watch .stage--watch { position: fixed !important; inset: 0 !important; z-index: 9000 !important; width: auto !important; height: auto !important; max-height: none !important; margin: 0 !important; padding: 0 !important; background: #000; transition: none !important; }
html[data-delve-theater] .app--watch .stage--watch .stage-video-col { position: relative; height: 100%; padding: 0 !important; box-shadow: none !important; }
html[data-delve-theater] .app--watch .stage--watch .stage-video-wrap { height: 100%; padding-top: 0 !important; }
html[data-delve-theater] .app--watch .stage--watch .stage-keys { display: block !important; height: auto !important; max-height: none !important; position: absolute; left: 0; right: 0; bottom: 0; z-index: 20; background: rgba(0, 0, 0, .6) !important; transition: transform .3s; }
html[data-delve-theater] .app--watch .stage--watch :is(.stage-player-header, .stage-player-info, .stage-visit-channel) { display: none !important; }
#delve-theater-exit { position: absolute; top: 8px; right: 8px; z-index: 30; opacity: .6; transition: opacity .3s; }
#delve-theater-exit:hover, #delve-theater-exit:focus-visible { opacity: 1; }
html[data-delve-theater-idle] .app--watch .stage--watch, html[data-delve-theater-idle] .app--watch .stage--watch * { cursor: none !important; }
html[data-delve-theater-idle] .app--watch .stage--watch .stage-keys { transform: translateY(100%); }
html[data-delve-theater-idle] #delve-theater-exit { opacity: 0; pointer-events: none; }
`;
  const PICTURE_CSS = `
html[data-delve-picture] video { filter: var(--delve-picture-filter); translate: var(--delve-picture-align); scale: calc(var(--delve-picture-scale-x) * var(--delve-picture-crop-scale, 1)) calc(var(--delve-picture-scale-y) * var(--delve-picture-crop-scale, 1)); clip-path: var(--delve-picture-crop-clip, none); }
html[data-delve-picture] :is(.app--watch .stage--watch, .app--guide .stage--guide) .stage-video-wrap { overflow: hidden; }
.delve-picture-panel[hidden] { display: none; }
/* Panel, heading and button come from the site's CRT/ZZZ popups (cc-panel); only the slider sizing is ours. */
.delve-picture-ctl .delve-picture-panel { width: 240px; max-width: calc(100vw - 40px); left: auto; right: 0; transform: none; }
@media (max-width: 480px) { :root .delve-picture-ctl .delve-picture-panel { position: fixed; left: 50%; right: auto; top: 50%; bottom: auto; transform: translate(-50%, -50%); max-height: calc(100vh - 40px); overflow-y: auto; } }
.delve-picture-panel .cc-panel-head { display: flex; justify-content: space-between; text-align: left; }
.delve-picture-panel .delve-seg { gap: 4px; margin-bottom: 8px; }
:root .delve-picture-panel .delve-seg button { padding-left: 2px; padding-right: 2px; letter-spacing: 0; }
:root .delve-picture-panel .delve-slider.player-volume-slider { display: block; flex: none; width: 100%; max-width: none; margin: 0 0 4px; box-sizing: border-box; }
`;
  let picturePanel = null;
  function syncPicturePanel() {
    if (!picturePanel) return;
    PICTURE_SLIDERS.forEach(([key, , range]) => {
      const slider = picturePanel.querySelector('input[data-picture="' + key + '"]');
      slider.value = settings[key];
      slider.style.setProperty('--volume-pct', (settings[key] - range.min) / (range.max - range.min) * 100 + '%');
      const sign = range.min < 0 && settings[key] > 0 ? '+' : '';
      picturePanel.querySelector('[data-picture-value="' + key + '"]').textContent = sign + settings[key] + '%';
    });
    picturePanel.querySelectorAll('[data-picture-choice]').forEach(button => {
      const on = settings[button.dataset.pictureChoice] === button.dataset.pictureKey;
      button.setAttribute('aria-pressed', String(on));
      button.classList.toggle('popup-toggle-btn--on', on);
    });
  }
  function buildPicturePanel() {
    picturePanel = document.createElement('div');
    picturePanel.className = 'cc-panel delve-picture-panel';
    picturePanel.hidden = true;
    PICTURE_SLIDERS.forEach(([key, name, range]) => {
      const label = document.createElement('label');
      label.className = 'cc-panel-head';
      const value = document.createElement('span');
      value.dataset.pictureValue = key;
      const slider = document.createElement('input');
      slider.type = 'range'; slider.className = 'player-volume-slider delve-slider'; slider.dataset.picture = key;
      slider.min = range.min; slider.max = range.max; slider.step = range.step;
      slider.addEventListener('input', () => setSettings({ [key]: Number(slider.value) }));
      label.append(name, value);
      picturePanel.append(label, slider);
    });
    [['pictureCrop', 'Crop', PICTURE_CROPS], ['pictureCropFit', 'Crop fit', PICTURE_CROP_FITS]].forEach(([setting, name, choices]) => {
      const head = document.createElement('div');
      head.className = 'cc-panel-head';
      head.append(name);
      const row = document.createElement('div');
      row.className = 'delve-seg';
      choices.forEach(([key, text]) => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'popup-toggle-btn'; button.textContent = text;
        button.dataset.pictureChoice = setting; button.dataset.pictureKey = key;
        button.addEventListener('click', () => setSettings({ [setting]: key }));
        row.append(button);
      });
      picturePanel.append(head, row);
    });
    syncPicturePanel();
  }
  // Right-aligned panels slide right just enough to stay inside the stage, which clips them.
  function keepPanelInWindow(panel) {
    panel.style.translate = '';
    panel.style.maxHeight = '';
    panel.style.overflowY = '';
    if (getComputedStyle(panel).position === 'fixed') return;
    const stage = panel.closest('.stage--watch');
    const leftLimit = Math.max(0, stage ? stage.getBoundingClientRect().left : 0) + 8;
    const rect = panel.getBoundingClientRect();
    const overflowLeft = leftLimit - rect.left;
    if (overflowLeft > 0) panel.style.translate = overflowLeft + 'px 0';
    const topLimit = (stage ? stage.getBoundingClientRect().top : 0) + 8;
    if (rect.top < topLimit) {
      panel.style.maxHeight = rect.height - (topLimit - rect.top) + 'px';
      panel.style.overflowY = 'auto';
      panel.scrollTop = 0;
    }
  }
  function setPicturePanelOpen(open) {
    if (!picturePanel) return;
    picturePanel.hidden = !open;
    if (open) keepPanelInWindow(picturePanel);
    picturePanel.parentElement.classList.toggle('subtitle-ctl--open', open);
    picturePanel.parentElement.querySelector('#delve-picture').setAttribute('aria-expanded', open);
  }
  document.addEventListener('mousedown', e => {
    if (picturePanel && !picturePanel.hidden && !e.target.closest('.delve-picture-ctl')) setPicturePanelOpen(false);
  }, true);
  const pictureWatchedVideos = new WeakSet();
  function ensurePicture() {
    const video = settings.pictureOn && document.querySelector('video');
    if (video && !pictureWatchedVideos.has(video)) {
      pictureWatchedVideos.add(video);
      ['loadedmetadata', 'resize'].forEach(type => video.addEventListener(type, updatePictureCrop));
      new ResizeObserver(updatePictureCrop).observe(video);
    }
    const stage = document.querySelector('.app--watch .stage--watch');
    const bar = stage && stage.querySelector('.stage-volume-bar');
    if (!settings.pictureOn || !stage || !bar) {
      if (settings.pictureOn && stage) warnMissing('.stage-volume-bar', 'Picture tweaks');
      setPicturePanelOpen(false);
      document.querySelector('.delve-picture-ctl')?.remove();
      return;
    }
    let ctl = document.querySelector('.delve-picture-ctl');
    if (!ctl) {
      ctl = document.createElement('span');
      ctl.className = 'subtitle-ctl delve-picture-ctl';
      const button = document.createElement('button');
      button.id = 'delve-picture'; button.type = 'button'; button.className = 'popup-toggle-btn'; button.textContent = 'PICTURE';
      button.title = 'Brightness, contrast, saturation, dim, zoom, alignment and crop';
      button.setAttribute('aria-expanded', 'false');
      if (!picturePanel) buildPicturePanel();
      button.addEventListener('click', () => setPicturePanelOpen(picturePanel.hidden));
      ctl.append(button, picturePanel);
    }
    if (ctl.parentElement !== bar) bar.append(ctl);
  }

