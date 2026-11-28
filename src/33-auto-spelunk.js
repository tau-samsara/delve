  // ---------------------------------------------------------------------------
  // Auto spelunk: an AUTO button beside the site's SPELUNK button; its popup picks an interval, and the site's button is clicked on that timer.
  // ---------------------------------------------------------------------------
  const AUTO_SPELUNK_CSS = `
.stage-dvr-bar:has(.delve-auto-ctl.subtitle-ctl--open) { overflow: visible; }
.delve-auto-panel[hidden], .delve-auto-favorites[hidden] { display: none; }
.delve-auto-favorites { display: contents; }
.delve-auto-ctl .delve-auto-panel { width: 300px; max-width: calc(100vw - 40px); left: auto; right: 0; transform: none; }
@media (max-width: 480px) { :root .delve-auto-ctl .delve-auto-panel { position: fixed; left: 50%; right: auto; top: 50%; bottom: auto; transform: translate(-50%, -50%); } }
.delve-auto-panel .delve-seg { gap: 4px; }
:root .delve-auto-panel .delve-seg button { padding-left: 2px; padding-right: 2px; letter-spacing: 0; font-size: 16px; }
`;
  const SPELUNK_BUTTON_SELECTOR = '.app--watch .player-spelunk-btn';
  let autoSpelunkPanel = null;
  let autoSpelunkSecondsLeft = 0;
  function syncAutoSpelunk() {
    const button = document.getElementById('delve-auto');
    if (button) {
      const left = autoSpelunkSecondsLeft;
      button.textContent = settings.autoSpelunkSeconds ? 'AUTO ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') : 'AUTO';
      button.classList.toggle('popup-toggle-btn--on', settings.autoSpelunkSeconds > 0);
    }
    autoSpelunkPanel?.querySelectorAll('[data-auto-choice]').forEach(choice => {
      const on = Number(choice.dataset.autoChoice) === settings.autoSpelunkSeconds;
      choice.setAttribute('aria-pressed', String(on));
      choice.classList.toggle('popup-toggle-btn--on', on);
    });
    const favoritesRow = autoSpelunkPanel?.querySelector('.delve-auto-favorites');
    if (favoritesRow) favoritesRow.hidden = !settings.favoritesOn;
    autoSpelunkPanel?.querySelectorAll('[data-spelunk-favorites]').forEach(choice => {
      const on = (choice.dataset.spelunkFavorites === 'true') === settings.spelunkFavoritesOnly;
      choice.setAttribute('aria-pressed', String(on));
      choice.classList.toggle('popup-toggle-btn--on', on);
    });
  }
  function buildAutoSpelunkPanel() {
    autoSpelunkPanel = document.createElement('div');
    autoSpelunkPanel.className = 'cc-panel delve-auto-panel';
    autoSpelunkPanel.hidden = true;
    const head = document.createElement('div');
    head.className = 'cc-panel-head';
    head.append('Auto spelunk: new channel every');
    const choices = document.createElement('div');
    choices.className = 'delve-seg';
    AUTO_SPELUNK_INTERVALS.forEach(([seconds, name]) => {
      const choice = document.createElement('button');
      choice.type = 'button'; choice.className = 'popup-toggle-btn'; choice.dataset.autoChoice = seconds; choice.textContent = name;
      choice.addEventListener('click', () => { autoSpelunkSecondsLeft = seconds; setSettings({ autoSpelunkSeconds: seconds }); syncAutoSpelunk(); });
      choices.append(choice);
    });
    const channelsHead = document.createElement('div');
    channelsHead.className = 'cc-panel-head';
    channelsHead.append('Spelunk among');
    const channelChoices = document.createElement('div');
    channelChoices.className = 'delve-seg';
    [[false, 'All channels'], [true, '★ Favorites']].forEach(([favoritesOnly, name]) => {
      const choice = document.createElement('button');
      choice.type = 'button'; choice.className = 'popup-toggle-btn'; choice.dataset.spelunkFavorites = favoritesOnly; choice.textContent = name;
      choice.addEventListener('click', () => { setSettings({ spelunkFavoritesOnly: favoritesOnly }); syncAutoSpelunk(); });
      channelChoices.append(choice);
    });
    const favoritesRow = document.createElement('div');
    favoritesRow.className = 'delve-auto-favorites';
    favoritesRow.append(channelsHead, channelChoices);
    autoSpelunkPanel.append(head, choices, favoritesRow);
  }
  function setAutoSpelunkPanelOpen(open) {
    if (!autoSpelunkPanel) return;
    autoSpelunkPanel.hidden = !open;
    autoSpelunkPanel.parentElement?.classList.toggle('subtitle-ctl--open', open);
  }
  document.addEventListener('mousedown', e => {
    if (autoSpelunkPanel && !autoSpelunkPanel.hidden && !e.target.closest('.delve-auto-ctl')) setAutoSpelunkPanelOpen(false);
  }, true);
  const currentChannelId = () => location.pathname.split('/')[1];
  // On the guide the address has no channel; the preview's channel is the highlighted row.
  const playingChannelId = () => currentChannelId() || document.querySelector('.tv-grid > .tv-grid-body > .grid-row.highlighted')?.dataset.channel || '';
  const hiddenChannelIds = () => settings.hideChannelsOn ? settings.hiddenChannels : [];
  function randomSpelunkChannel() {
    const favoritesOnly = settings.autoSpelunkOn && settings.favoritesOn && settings.spelunkFavoritesOnly;
    const hidden = hiddenChannelIds();
    const pool = favoritesOnly ? settings.favorites : hidden.length ? knownChannelIds : [];
    const others = pool.filter(channel => channel !== playingChannelId() && hidden.indexOf(channel) === -1);
    return others[Math.floor(Math.random() * others.length)];
  }
  const tuneChannel = channel => {
    history.pushState(null, '', '/' + channel);
    window.dispatchEvent(new PopStateEvent('popstate'));   // the site's router follows popstate
  };
  document.addEventListener('click', e => {
    if (!e.target.closest(SPELUNK_BUTTON_SELECTOR)) return;
    autoSpelunkSecondsLeft = settings.autoSpelunkSeconds;   // a manual jump restarts the countdown
    const channel = randomSpelunkChannel();
    if (!channel) return;   // with no other channel to pick, the site's own random jump runs
    e.stopPropagation(); e.preventDefault();
    tuneChannel(channel);
  }, true);
  setInterval(() => {
    const spelunkButton = settings.autoSpelunkOn && settings.autoSpelunkSeconds && document.querySelector(SPELUNK_BUTTON_SELECTOR);
    if (!spelunkButton) return;
    autoSpelunkSecondsLeft--;
    if (autoSpelunkSecondsLeft <= 0) spelunkButton.click();   // the click handler above restarts the countdown
    syncAutoSpelunk();
  }, 1000);
  function ensureAutoSpelunk() {
    const spelunkButton = settings.autoSpelunkOn && document.querySelector(SPELUNK_BUTTON_SELECTOR);
    if (!spelunkButton) {
      if (settings.autoSpelunkOn && document.querySelector('.app--watch')) warnMissing('.player-spelunk-btn', 'Auto spelunk');
      setAutoSpelunkPanelOpen(false);
      document.querySelector('.delve-auto-ctl')?.remove();
      return;
    }
    let ctl = document.querySelector('.delve-auto-ctl');
    if (!ctl) {
      ctl = document.createElement('span');
      ctl.className = 'subtitle-ctl delve-auto-ctl';
      const button = document.createElement('button');
      button.id = 'delve-auto'; button.type = 'button'; button.className = 'popup-toggle-btn';
      button.title = 'Tune a random channel on a timer';
      if (!autoSpelunkPanel) buildAutoSpelunkPanel();
      button.addEventListener('click', () => setAutoSpelunkPanelOpen(autoSpelunkPanel.hidden));
      ctl.append(button, autoSpelunkPanel);
    }
    if (ctl.previousElementSibling !== spelunkButton) spelunkButton.after(ctl);
    if (!autoSpelunkSecondsLeft) autoSpelunkSecondsLeft = settings.autoSpelunkSeconds;
    syncAutoSpelunk();
  }
