  // ---------------------------------------------------------------------------
  // Watermark: the channel's logo, copied from the player header, drawn over a corner of the visible picture (the video
  // element also covers the black bars, so the box is worked out from the stream's size, Picture's crop, zoom and shift).
  // ---------------------------------------------------------------------------
  const WATERMARK_CSS = `
.delve-wm-picture { position: absolute; display: flex; box-sizing: border-box; padding: calc(var(--delve-wm-size) * .3); pointer-events: none; }
.delve-wm-picture[hidden] { display: none; }
.delve-wm-picture[data-corner^="bottom"] { align-items: flex-end; }
.delve-wm-picture[data-corner$="right"] { justify-content: flex-end; }
.delve-wm-mark { flex: none; width: var(--delve-wm-size); height: var(--delve-wm-size); opacity: var(--delve-wm-opacity); overflow: hidden; }
.delve-wm-mark svg { display: block; width: 100%; height: 100%; }
.delve-watermark-panel[hidden] { display: none; }
.delve-watermark-ctl .delve-watermark-panel { width: 300px; max-width: calc(100vw - 40px); left: auto; right: 0; transform: none; }
@media (max-width: 480px) { :root .delve-watermark-ctl .delve-watermark-panel { position: fixed; left: 50%; right: auto; top: 50%; bottom: auto; transform: translate(-50%, -50%); } }
.delve-watermark-panel .cc-panel-head { display: flex; justify-content: space-between; text-align: left; }
.delve-watermark-panel .delve-seg { gap: 4px; }
:root .delve-watermark-panel .delve-seg button { padding-left: 2px; padding-right: 2px; letter-spacing: 0; font-size: 16px; }
:root .delve-watermark-panel .delve-slider.player-volume-slider { display: block; flex: none; width: 100%; max-width: none; margin: 0 0 4px; box-sizing: border-box; }
`;
  const WATERMARK_LOGO_SELECTOR = '.stage--watch .player-channel-logo svg';
  const watermarkWatchedVideos = new WeakSet();
  let watermarkLogoMarkup = '';
  let watermarkPanel = null;
  function placeWatermark() {
    const box = document.querySelector('.delve-wm-picture');
    const video = box && box.parentElement.querySelector('video');
    if (!video) return;
    const { videoWidth, videoHeight, offsetLeft, offsetTop, clientWidth, clientHeight } = video;
    if (!videoWidth || !videoHeight || !clientWidth || !clientHeight) { box.hidden = true; return; }
    const fit = Math.min(clientWidth / videoWidth, clientHeight / videoHeight);
    let scaleX = 1, scaleY = 1, shiftX = 0, shiftY = 0, crop = NO_CROP;
    if (settings.pictureOn) {
      crop = pictureCropGeometry(video);
      scaleX = settings.pictureZoom * settings.pictureWidth / 10000 * crop.cropScale;
      scaleY = settings.pictureZoom * settings.pictureHeight / 10000 * crop.cropScale;
      shiftX = settings.alignX / 100 * clientWidth;
      shiftY = settings.alignY / 100 * clientHeight;
    }
    // Visible part: the picture overlapping the crop box, mirrored by Picture's scale and shift, kept inside the frame.
    const width = Math.min(videoWidth * fit, clientWidth - 2 * crop.insetX) * scaleX;
    const height = Math.min(videoHeight * fit, clientHeight - 2 * crop.insetY) * scaleY;
    const left = Math.max(clientWidth / 2 + shiftX - width / 2, 0), right = Math.min(clientWidth / 2 + shiftX + width / 2, clientWidth);
    const top = Math.max(clientHeight / 2 + shiftY - height / 2, 0), bottom = Math.min(clientHeight / 2 + shiftY + height / 2, clientHeight);
    if (right <= left || bottom <= top) { box.hidden = true; return; }
    box.hidden = false;
    Object.assign(box.style, { left: offsetLeft + left + 'px', top: offsetTop + top + 'px', width: right - left + 'px', height: bottom - top + 'px' });
    box.style.setProperty('--delve-wm-size', Math.round((bottom - top) * settings.watermarkSize / 100) + 'px');
    box.style.setProperty('--delve-wm-opacity', settings.watermarkOpacity / 100);
  }
  // B&W: the logo's second fill is its background and is removed (a blend or filter over the video changes its picture).
  // The other fills become grays, the brightest white and each next one a step darker.
  const BACKGROUND_MIN_RECTS = 8;   // a smaller second fill is an accent (channel 201); its background is the third
  const GRAY_STEP = 30;
  const brightnessOf = part => {
    const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(part.getAttribute('fill'));
    if (!hex) return 0;
    const [red, green, blue] = hex.slice(1).map(channel => parseInt(channel, 16));
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  function blackAndWhite(svg) {
    const fills = Array.from(svg.querySelectorAll(':scope > g[fill]'));
    const background = fills[1] && fills[1].children.length < BACKGROUND_MIN_RECTS ? fills[2] : fills[1];
    background?.remove();
    fills.filter(part => part !== background).sort((a, b) => brightnessOf(b) - brightnessOf(a)).forEach((part, step) => {
      const gray = Math.max(255 - step * GRAY_STEP, 0).toString(16).padStart(2, '0');
      part.setAttribute('fill', '#' + gray + gray + gray);
    });
    return svg;
  }
  function ensureWatermarkMark() {
    const wrap = document.querySelector('.app--watch .stage--watch .stage-video-wrap');
    const video = wrap && wrap.querySelector('video');
    const logo = document.querySelector(WATERMARK_LOGO_SELECTOR);
    let box = document.querySelector('.delve-wm-picture');
    if (!settings.watermarkOn || !settings.watermarkShow || !video || !logo) {
      if (settings.watermarkOn && settings.watermarkShow && wrap) warnMissing(WATERMARK_LOGO_SELECTOR, 'Watermark');
      box?.remove();
      watermarkLogoMarkup = '';
      return;
    }
    if (!box) {
      box = document.createElement('div');
      box.className = 'delve-wm-picture';
      box.append(document.createElement('div'));
      box.firstChild.className = 'delve-wm-mark';
      watermarkLogoMarkup = '';
    }
    if (box.parentElement !== wrap) wrap.append(box);
    box.dataset.corner = settings.watermarkCorner;
    box.dataset.logo = settings.watermarkLogo;
    const logoKey = settings.watermarkLogo + logo.outerHTML;
    if (logoKey !== watermarkLogoMarkup) {
      watermarkLogoMarkup = logoKey;
      const copy = logo.cloneNode(true);
      box.firstChild.replaceChildren(settings.watermarkLogo === 'contrast' ? blackAndWhite(copy) : copy);
    }
    if (!watermarkWatchedVideos.has(video)) {
      watermarkWatchedVideos.add(video);
      ['loadedmetadata', 'resize'].forEach(type => video.addEventListener(type, placeWatermark));
      new ResizeObserver(placeWatermark).observe(video);
    }
    placeWatermark();
  }
  function applyWatermark() {
    syncWatermarkPanel();
    ensureWatermarkMark();
  }
  function syncWatermarkPanel() {
    if (!watermarkPanel) return;
    const showToggle = watermarkPanel.querySelector('[data-watermark-show]');
    showToggle.textContent = settings.watermarkShow ? 'On' : 'Off';
    showToggle.setAttribute('aria-pressed', String(settings.watermarkShow));
    showToggle.classList.toggle('popup-toggle-btn--on', settings.watermarkShow);
    WATERMARK_SLIDERS.forEach(([key, , range]) => {
      const slider = watermarkPanel.querySelector('input[data-watermark="' + key + '"]');
      slider.value = settings[key];
      slider.style.setProperty('--volume-pct', (settings[key] - range.min) / (range.max - range.min) * 100 + '%');
      watermarkPanel.querySelector('[data-watermark-value="' + key + '"]').textContent = settings[key] + '%';
    });
    watermarkPanel.querySelectorAll('[data-watermark-choice]').forEach(button => {
      const on = settings[button.dataset.watermarkChoice] === button.dataset.watermarkKey;
      button.setAttribute('aria-pressed', String(on));
      button.classList.toggle('popup-toggle-btn--on', on);
    });
  }
  function buildWatermarkPanel() {
    watermarkPanel = document.createElement('div');
    watermarkPanel.className = 'cc-panel delve-watermark-panel';
    watermarkPanel.hidden = true;
    const showHead = document.createElement('div');
    showHead.className = 'cc-panel-head';
    const showToggle = document.createElement('button');
    showToggle.type = 'button'; showToggle.className = 'popup-toggle-btn'; showToggle.dataset.watermarkShow = '';
    showToggle.addEventListener('click', () => setSettings({ watermarkShow: !settings.watermarkShow }));
    showHead.append('Watermark', showToggle);
    watermarkPanel.append(showHead);
    WATERMARK_SLIDERS.forEach(([key, name, range]) => {
      const label = document.createElement('label');
      label.className = 'cc-panel-head';
      const value = document.createElement('span');
      value.dataset.watermarkValue = key;
      const slider = document.createElement('input');
      slider.type = 'range'; slider.className = 'player-volume-slider delve-slider'; slider.dataset.watermark = key;
      slider.min = range.min; slider.max = range.max; slider.step = range.step;
      slider.addEventListener('input', () => setSettings({ [key]: Number(slider.value) }));
      label.append(name, value);
      watermarkPanel.append(label, slider);
    });
    [['watermarkCorner', 'Corner', WATERMARK_CORNERS], ['watermarkLogo', 'Logo', WATERMARK_LOGOS]].forEach(([setting, name, choices]) => {
      const head = document.createElement('div');
      head.className = 'cc-panel-head';
      head.append(name);
      const row = document.createElement('div');
      row.className = 'delve-seg';
      choices.forEach(([key, text, title]) => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'popup-toggle-btn'; button.textContent = text;
        button.dataset.watermarkChoice = setting; button.dataset.watermarkKey = key;
        if (title) button.title = title;
        button.addEventListener('click', () => setSettings({ [setting]: key }));
        row.append(button);
      });
      watermarkPanel.append(head, row);
    });
    syncWatermarkPanel();
  }
  function setWatermarkPanelOpen(open) {
    if (!watermarkPanel) return;
    watermarkPanel.hidden = !open;
    if (open) keepPanelInWindow(watermarkPanel);
    watermarkPanel.parentElement.classList.toggle('subtitle-ctl--open', open);
    watermarkPanel.parentElement.querySelector('#delve-watermark').setAttribute('aria-expanded', open);
  }
  document.addEventListener('mousedown', e => {
    if (watermarkPanel && !watermarkPanel.hidden && !e.target.closest('.delve-watermark-ctl')) setWatermarkPanelOpen(false);
  }, true);
  function ensureWatermark() {
    const stage = document.querySelector('.app--watch .stage--watch');
    const bar = stage && stage.querySelector('.stage-volume-bar');
    if (!settings.watermarkOn || !stage || !bar) {
      if (settings.watermarkOn && stage) warnMissing('.stage-volume-bar', 'Watermark');
      setWatermarkPanelOpen(false);
      document.querySelector('.delve-watermark-ctl')?.remove();
      ensureWatermarkMark();
      return;
    }
    let ctl = document.querySelector('.delve-watermark-ctl');
    if (!ctl) {
      ctl = document.createElement('span');
      ctl.className = 'subtitle-ctl delve-watermark-ctl';
      const button = document.createElement('button');
      button.id = 'delve-watermark'; button.type = 'button'; button.className = 'popup-toggle-btn'; button.textContent = 'WATERMARK';
      button.title = 'Channel logo over the picture';
      button.setAttribute('aria-expanded', 'false');
      if (!watermarkPanel) buildWatermarkPanel();
      button.addEventListener('click', () => setWatermarkPanelOpen(watermarkPanel.hidden));
      ctl.append(button, watermarkPanel);
    }
    if (ctl.parentElement !== bar) bar.append(ctl);
    ensureWatermarkMark();
  }
  const THEATER_IDLE_MS = 3000;
  let theaterIdleTimer = 0;
  const inTheater = () => root.hasAttribute('data-delve-theater');
  const theaterVideoShowing = () => { const video = document.querySelector('.app--watch .stage--watch video'); return !!video && video.readyState >= 2; };
  function wakeTheater() {
    clearTimeout(theaterIdleTimer);
    root.removeAttribute('data-delve-theater-idle');
    if (!inTheater()) return;
    theaterIdleTimer = setTimeout(() => {
      if (theaterVideoShowing()) root.setAttribute('data-delve-theater-idle', '');
      else wakeTheater();   // keep the exit button while no picture is up
    }, THEATER_IDLE_MS);
  }
  ['mousemove', 'mousedown', 'touchstart'].forEach(type => document.addEventListener(type, wakeTheater, true));
  const setTheater = on => { if (on) root.setAttribute('data-delve-theater', ''); else root.removeAttribute('data-delve-theater'); wakeTheater(); ensureTheater(); };
  function ensureTheater() {
    const stage = document.querySelector('.app--watch .stage--watch');
    if (!settings.theater || !stage) {
      if (inTheater()) { root.removeAttribute('data-delve-theater'); wakeTheater(); }
      document.querySelectorAll('#delve-theater, #delve-theater-exit').forEach(b => b.remove());
      return;
    }
    const bar = stage.querySelector('.stage-volume-bar');
    if (bar) {
      let enter = document.getElementById('delve-theater');
      if (!enter) {
        enter = document.createElement('button');
        enter.id = 'delve-theater'; enter.type = 'button'; enter.className = 'popup-toggle-btn'; enter.textContent = 'THEATER';
        enter.title = 'Theater mode: the video fills the window';
        enter.addEventListener('click', () => setTheater(true));
      }
      if (enter.parentElement !== bar) bar.append(enter);
    } else if (!inTheater()) { warnMissing('.stage-volume-bar', 'Theater mode'); return; }
    let exit = document.getElementById('delve-theater-exit');
    if (!inTheater()) { if (exit) exit.remove(); return; }
    if (!exit) {
      exit = document.createElement('button');
      exit.id = 'delve-theater-exit'; exit.type = 'button'; exit.className = 'bbtn bbtn-outline'; exit.textContent = 'EXIT THEATER';
      exit.addEventListener('click', () => setTheater(false));
    }
    if (exit.parentElement !== stage) stage.append(exit);
  }

