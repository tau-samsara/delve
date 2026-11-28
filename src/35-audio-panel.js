  let audioPanel = null;
  function syncAudioPanel() {
    if (!audioPanel) return;
    const slider = audioPanel.querySelector('input');
    slider.value = settings.boost;
    slider.style.setProperty('--volume-pct', (settings.boost - BOOST_RANGE.min) / (BOOST_RANGE.max - BOOST_RANGE.min) * 100 + '%');
    audioPanel.querySelector('[data-audio-value]').textContent = settings.boost + '%';
    const nightToggle = audioPanel.querySelector('[data-audio-night]');
    nightToggle.textContent = settings.night ? 'On' : 'Off';
    nightToggle.setAttribute('aria-pressed', String(settings.night));
    nightToggle.classList.toggle('popup-toggle-btn--on', settings.night);
    const hissToggle = audioPanel.querySelector('[data-audio-hiss]');
    hissToggle.textContent = settings.hiss ? 'On' : 'Off';
    hissToggle.setAttribute('aria-pressed', String(settings.hiss));
    hissToggle.classList.toggle('popup-toggle-btn--on', settings.hiss);
    const syncSlider = audioPanel.querySelector('input[data-sync]');
    syncSlider.value = settings.syncMs;
    syncSlider.style.setProperty('--volume-pct', (settings.syncMs - SYNC_RANGE.min) / (SYNC_RANGE.max - SYNC_RANGE.min) * 100 + '%');
    audioPanel.querySelector('[data-sync-value]').textContent = (settings.syncMs > 0 ? '+' : '') + settings.syncMs + ' ms';
    const levelToggle = audioPanel.querySelector('[data-audio-level]');
    levelToggle.textContent = settings.level ? 'On' : 'Off';
    levelToggle.setAttribute('aria-pressed', String(settings.level));
    levelToggle.classList.toggle('popup-toggle-btn--on', settings.level);
    const levelSlider = audioPanel.querySelector('input[data-level-target]');
    levelSlider.value = settings.levelTarget;
    levelSlider.style.setProperty('--volume-pct', (settings.levelTarget - LEVEL_RANGE.min) / (LEVEL_RANGE.max - LEVEL_RANGE.min) * 100 + '%');
    audioPanel.querySelector('[data-level-value]').textContent = settings.levelTarget + ' LUFS';
    audioPanel.querySelectorAll('[data-mono-choice]').forEach(button => {
      const choice = button.dataset.monoChoice;
      const on = choice === 'auto' ? !!monoDetection : !monoDetection && (choice === 'off' ? !settings.mono : settings.mono && settings.monoSource === choice);
      button.setAttribute('aria-pressed', String(on));
      button.classList.toggle('popup-toggle-btn--on', on);
    });
  }
  function buildAudioPanel() {
    audioPanel = document.createElement('div');
    audioPanel.className = 'cc-panel delve-audio-panel';
    audioPanel.hidden = true;
    const label = document.createElement('label');
    label.className = 'cc-panel-head';
    const value = document.createElement('span');
    value.dataset.audioValue = '';
    const slider = document.createElement('input');
    slider.type = 'range'; slider.className = 'player-volume-slider delve-slider';
    slider.min = BOOST_RANGE.min; slider.max = BOOST_RANGE.max; slider.step = BOOST_RANGE.step;
    slider.addEventListener('input', () => setSettings({ boost: Number(slider.value) }));
    label.append('Volume boost', value);
    const monoHead = document.createElement('div');
    monoHead.className = 'cc-panel-head';
    monoHead.append('Mono');
    const monoChoices = document.createElement('div');
    monoChoices.className = 'delve-seg';
    [['off', 'Off'], ['auto', 'Auto'], ...MONO_SOURCES].forEach(([key, name]) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'popup-toggle-btn'; button.dataset.monoChoice = key; button.textContent = name;
      if (key === 'auto') button.title = 'Listen for a silent or weak side, then turn Mono on with Left, Right or Mix';
      button.addEventListener('click', () => {
        if (key === 'auto') { startMonoDetection(); return; }
        monoDetection = null;
        setSettings(key === 'off' ? { mono: false } : { mono: true, monoSource: key });
      });
      monoChoices.append(button);
    });
    const levelHead = document.createElement('div');
    levelHead.className = 'cc-panel-head';
    const levelToggle = document.createElement('button');
    levelToggle.type = 'button'; levelToggle.className = 'popup-toggle-btn'; levelToggle.dataset.audioLevel = '';
    levelToggle.addEventListener('click', () => setSettings({ level: !settings.level }));
    levelHead.append('Leveling', levelToggle);
    const targetLabel = document.createElement('label');
    targetLabel.className = 'cc-panel-head';
    const targetValue = document.createElement('span');
    targetValue.dataset.levelValue = '';
    const targetSlider = document.createElement('input');
    targetSlider.type = 'range'; targetSlider.className = 'player-volume-slider delve-slider'; targetSlider.dataset.levelTarget = '';
    targetSlider.min = LEVEL_RANGE.min; targetSlider.max = LEVEL_RANGE.max; targetSlider.step = LEVEL_RANGE.step;
    targetSlider.addEventListener('input', () => setSettings({ levelTarget: Number(targetSlider.value) }));
    targetLabel.append('Target loudness', targetValue);
    const syncLabel = document.createElement('label');
    syncLabel.className = 'cc-panel-head';
    const syncValue = document.createElement('span');
    syncValue.dataset.syncValue = '';
    const syncSlider = document.createElement('input');
    syncSlider.type = 'range'; syncSlider.className = 'player-volume-slider delve-slider'; syncSlider.dataset.sync = '';
    syncSlider.min = SYNC_RANGE.min; syncSlider.max = SYNC_RANGE.max; syncSlider.step = SYNC_RANGE.step;
    // Each refetch stalls the picture, so wait for the release (change) or a pause in the dragging.
    syncSlider.addEventListener('input', () => { setSettings({ syncMs: Number(syncSlider.value) }); resyncAudioStream(SYNC_IDLE_MS); });
    syncSlider.addEventListener('change', () => resyncAudioStream(0));
    syncLabel.append('Audio sync', syncValue);
    const nightHead = document.createElement('div');
    nightHead.className = 'cc-panel-head';
    const nightToggle = document.createElement('button');
    nightToggle.type = 'button'; nightToggle.className = 'popup-toggle-btn'; nightToggle.dataset.audioNight = '';
    nightToggle.addEventListener('click', () => setSettings({ night: !settings.night }));
    nightHead.append('Night mode', nightToggle);
    const hissHead = document.createElement('div');
    hissHead.className = 'cc-panel-head';
    const hissToggle = document.createElement('button');
    hissToggle.type = 'button'; hissToggle.className = 'popup-toggle-btn'; hissToggle.dataset.audioHiss = '';
    hissToggle.addEventListener('click', () => setSettings({ hiss: !settings.hiss }));
    hissHead.append('Hiss reduction', hissToggle);
    audioPanel.append(label, slider, levelHead, targetLabel, targetSlider, nightHead, hissHead, monoHead, monoChoices, syncLabel, syncSlider);
    syncAudioPanel();
  }
  function setAudioPanelOpen(open) {
    if (!audioPanel) return;
    audioPanel.hidden = !open;
    audioPanel.parentElement.classList.toggle('subtitle-ctl--open', open);
    audioPanel.parentElement.querySelector('#delve-audio').setAttribute('aria-expanded', open);
  }
  document.addEventListener('mousedown', e => {
    if (audioPanel && !audioPanel.hidden && !e.target.closest('.delve-audio-ctl')) setAudioPanelOpen(false);
  }, true);
  function ensureAudioButton() {
    const stage = document.querySelector('.app--watch .stage--watch');
    const bar = stage && stage.querySelector('.stage-volume-bar');
    if (!settings.audioOn || !stage || !bar) {
      if (settings.audioOn && stage) warnMissing('.stage-volume-bar', 'Audio tweaks');
      setAudioPanelOpen(false);
      document.querySelector('.delve-audio-ctl')?.remove();
      return;
    }
    let ctl = document.querySelector('.delve-audio-ctl');
    if (!ctl) {
      ctl = document.createElement('span');
      ctl.className = 'subtitle-ctl delve-audio-ctl';
      const button = document.createElement('button');
      button.id = 'delve-audio'; button.type = 'button'; button.className = 'popup-toggle-btn'; button.textContent = 'AUDIO';
      button.title = 'Audio tweaks';
      button.setAttribute('aria-expanded', 'false');
      if (!audioPanel) buildAudioPanel();
      button.addEventListener('click', () => setAudioPanelOpen(audioPanel.hidden));
      ctl.append(button, audioPanel);
    }
    const muteButton = bar.querySelector(':scope > .player-mute-btn');
    if (ctl.parentElement !== bar || ctl.nextElementSibling !== muteButton) bar.insertBefore(ctl, muteButton);
  }
  function ensureAudio() {
    ensureAudioButton();
    const video = document.querySelector('video');
    if (!video) return;
    if (!settings.audioOn) { restoreSiteStream(video); return; }
    if (typeof MP4Box === 'undefined') { warnMissing('MP4Box', 'Audio tweaks'); return; }
    if (!audioWatchedVideos.has(video)) {
      audioWatchedVideos.add(video);
      new MutationObserver(() => { if (settings.audioOn || audioGraph) swapStreamIfNeeded(video); }).observe(video, { attributes: true, attributeFilter: ['src'] });
    }
    swapStreamIfNeeded(video);
  }
