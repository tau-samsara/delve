  // ---------------------------------------------------------------------------
  // Hidden channels are skipped. A flip or spelunk that lands on one is repeated; any other way of arriving (a click, the
  // address) takes the stream off the video. The site's keys are W, S and R (shown in its button titles).
  // ---------------------------------------------------------------------------
  const FLIP_KEYS = ['w', 's', 'r'];
  const FLIP_BUTTONS = '.player-ch-btn, .guide-ctrl-btn:not(.guide-ctrl-mute), .player-spelunk-btn';
  const FLIP_REPEAT_LIMIT = 50;   // all channels hidden: stop after one lap
  const FLIP_FRESH_MS = 10000;
  let lastFlip = null, flipRepeatsLeft = 0, repeatedOn = '', repeatingFlip = false;
  const startFlip = repeat => { lastFlip = { repeat, at: Date.now() }; flipRepeatsLeft = FLIP_REPEAT_LIMIT; };
  document.addEventListener('click', e => {
    if (repeatingFlip) return;
    const button = e.target.closest && e.target.closest(FLIP_BUTTONS);
    if (button) startFlip(() => { if (button.isConnected) button.click(); });
    else if (e.isTrusted) lastFlip = null;
  }, true);
  document.addEventListener('keydown', e => {
    if (repeatingFlip || !e.isTrusted) return;
    const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (FLIP_KEYS.indexOf(e.key.toLowerCase()) === -1) { lastFlip = null; return; }
    startFlip(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: e.key, code: e.code, bubbles: true })));
  }, true);

  const guardedVideos = new WeakSet();
  function ensureHiddenChannelGuard() {
    const video = document.querySelector('video');
    if (video && !guardedVideos.has(video)) {
      guardedVideos.add(video);
      new MutationObserver(ensureHiddenChannelGuard).observe(video, { attributes: true, attributeFilter: ['src'] });
    }
    const channel = playingChannelId();
    if (!settings.hideChannelsOn || hiddenChannelIds().indexOf(channel) === -1) { repeatedOn = ''; return; }
    if (video && video.getAttribute('src')) { video.pause(); video.removeAttribute('src'); video.load(); }
    if (!lastFlip || flipRepeatsLeft <= 0 || Date.now() - lastFlip.at > FLIP_FRESH_MS || repeatedOn === channel) return;
    repeatedOn = channel;
    flipRepeatsLeft--;
    repeatingFlip = true;
    try { lastFlip.repeat(); } finally { repeatingFlip = false; }
    setTimeout(() => { if (playingChannelId() === channel) lastFlip = null; }, 1500);   // the repeat did not move: stop trying
  }

  // Channel page: a Favorite and a Hide button in their own row above the site's WATCH / GUIDE row.
  function ensureChannelActions() {
    const wanted = settings.favoritesOn || settings.hideChannelsOn;
    const siteKeys = document.querySelector('.app--channel .cv-hero > .cv-keys');
    let actions = document.querySelector('.delve-chan-actions');
    if (!wanted || !siteKeys) {
      if (wanted && document.querySelector('.app--channel')) warnMissing('.cv-hero > .cv-keys', 'Favorites and Hide channels on the channel page');
      if (actions) actions.remove();
      return;
    }
    if (!actions) {
      actions = el('div', 'delve-chan-actions');
      const favorite = el('button', 'bbtn');
      favorite.type = 'button';
      favorite.addEventListener('click', () => toggleFav(currentChannelId()));
      const hide = el('button', 'bbtn bbtn-outline');
      hide.type = 'button';
      hide.addEventListener('click', () => toggleHiddenChannel(currentChannelId()));
      actions.append(favorite, hide);
    }
    if (siteKeys.previousElementSibling !== actions) siteKeys.before(actions);
    const channel = currentChannelId();
    const [favorite, hide] = actions.children;
    favorite.hidden = !settings.favoritesOn;
    hide.hidden = !settings.hideChannelsOn;
    const fav = isFav(channel), hidden = isHiddenChannel(channel);
    favorite.className = fav ? 'bbtn bbtn-gold' : 'bbtn bbtn-outline';
    favorite.setAttribute('aria-pressed', String(fav));
    if (favorite.textContent !== 'FAVORITE') favorite.textContent = 'FAVORITE';
    const hideText = hidden ? 'UNHIDE CHANNEL' : 'HIDE CHANNEL';
    if (hide.textContent !== hideText) hide.textContent = hideText;
  }

  let knownChannelIds = [];
  function ensureGuide() {
    ensureChannelActions();
    const siteChannels = Array.from(document.querySelectorAll('.tv-grid > .tv-grid-body > .grid-row'), row => row.dataset.channel).filter(Boolean);
    if (siteChannels.length) knownChannelIds = siteChannels;
    ensureBar();
    ensureWide();
    updatePan();
    const rows = guideRows();
    if (!rows.length) return;
    ensureStars(rows);
    ensureHideButtons(rows);
    applyFilter(rows);
    applyOrder(rows);
  }

  // The star marks or unmarks the channel; it must never tune it (capture phase, before the site sees the click).
  document.addEventListener('click', e => {
    const star = e.target && e.target.closest && e.target.closest('.delve-star');
    if (!star) return;
    if (dragClickPending) return;
    e.stopPropagation(); e.preventDefault();
    const row = star.closest('.grid-row');
    if (row && row.dataset.channel) toggleFav(row.dataset.channel);
  }, true);

  document.addEventListener('click', e => {
    const btn = e.target && e.target.closest && e.target.closest('.delve-hidebtn');
    if (!btn) return;
    if (dragClickPending) return;
    e.stopPropagation(); e.preventDefault();
    const row = btn.closest('.grid-row');
    if (row && row.dataset.channel) toggleHiddenChannel(row.dataset.channel);
  }, true);

