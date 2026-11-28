  // ---------------------------------------------------------------------------
  // Hide: Delve's popup on the site's HIDE button picks what to hide (comments, reactions, both or neither), all with CSS.
  // The site's own HIDE state is kept off: when on, it also removes the reaction strip, so the two could not be told apart.
  // ---------------------------------------------------------------------------
  const HIDE_CSS = `
html[data-delve-hide-comments] .comment-markers-sc, html[data-delve-hide-comments] .comment-seek-ticks, html[data-delve-hide-comments] .popup-comments { display: none; }
html[data-delve-hide-reactions] :is(.reaction-heat, .reaction-animator) { display: none; }
.delve-hide-panel[hidden] { display: none; }
.delve-hide-ctl .delve-hide-panel { width: 340px; max-width: calc(100vw - 40px); left: auto; right: 0; transform: none; }
@media (max-width: 480px) { :root .delve-hide-ctl .delve-hide-panel { position: fixed; left: 50%; right: auto; top: 50%; bottom: auto; transform: translate(-50%, -50%); } }
.delve-hide-panel .delve-seg { gap: 4px; }
:root .delve-hide-panel .delve-seg button { padding-left: 2px; padding-right: 2px; letter-spacing: 0; font-size: 16px; }
`;
  const HIDE_BUTTON_SELECTOR = ':scope > .popup-toggle-btn:has(+ .comment-btn-wrap, + .delve-hide-ctl)';
  const hidesComments = () => settings.hideMode === 'comments' || settings.hideMode === 'both';
  const hidesReactions = () => settings.hideMode === 'reactions' || settings.hideMode === 'both';
  let hidePanel = null;
  let hideClickPassesThrough = false;
  function applyHide() {
    root.toggleAttribute('data-delve-hide-comments', settings.hideOn && hidesComments());
    root.toggleAttribute('data-delve-hide-reactions', settings.hideOn && hidesReactions());
    syncHidePanel();
  }
  function syncHidePanel() {
    if (!hidePanel) return;
    hidePanel.querySelectorAll('[data-hide-choice]').forEach(button => {
      const on = button.dataset.hideChoice === settings.hideMode;
      button.setAttribute('aria-pressed', String(on));
      button.classList.toggle('popup-toggle-btn--on', on);
    });
  }
  function buildHidePanel() {
    hidePanel = document.createElement('div');
    hidePanel.className = 'cc-panel delve-hide-panel';
    hidePanel.hidden = true;
    const head = document.createElement('div');
    head.className = 'cc-panel-head';
    head.append('Hide');
    const choices = document.createElement('div');
    choices.className = 'delve-seg';
    HIDE_MODES.forEach(([key, name]) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'popup-toggle-btn'; button.dataset.hideChoice = key; button.textContent = name;
      button.addEventListener('click', () => { setSettings({ hideMode: key }); ensureHide(); });
      choices.append(button);
    });
    hidePanel.append(head, choices);
    syncHidePanel();
  }
  function setHidePanelOpen(open) {
    if (!hidePanel) return;
    hidePanel.hidden = !open;
    hidePanel.parentElement?.classList.toggle('subtitle-ctl--open', open);
  }
  const siteHideButton = () => document.querySelector('.app--watch .stage--watch .stage-volume-bar')?.querySelector(HIDE_BUTTON_SELECTOR);
  document.addEventListener('click', e => {
    const button = siteHideButton();
    if (!settings.hideOn || !hidePanel || hideClickPassesThrough || !button || !button.contains(e.target)) return;
    e.stopPropagation(); e.preventDefault();
    setHidePanelOpen(hidePanel.hidden);
  }, true);
  document.addEventListener('mousedown', e => {
    if (hidePanel && !hidePanel.hidden && !e.target.closest('.delve-hide-ctl') && !siteHideButton()?.contains(e.target)) setHidePanelOpen(false);
  }, true);
  function ensureHide() {
    const stage = document.querySelector('.app--watch .stage--watch');
    const bar = stage && stage.querySelector('.stage-volume-bar');
    const siteButton = bar && bar.querySelector(HIDE_BUTTON_SELECTOR);
    if (!settings.hideOn || !siteButton) {
      if (settings.hideOn && stage) warnMissing('.stage-volume-bar HIDE button', 'Hide options');
      setHidePanelOpen(false);
      document.querySelector('.delve-hide-ctl')?.remove();
      return;
    }
    if (!hidePanel) buildHidePanel();
    let ctl = document.querySelector('.delve-hide-ctl');
    if (!ctl) {
      ctl = document.createElement('span');
      ctl.className = 'subtitle-ctl delve-hide-ctl';
      ctl.append(hidePanel);
    }
    if (ctl.previousElementSibling !== siteButton) siteButton.after(ctl);
    if (siteButton.classList.contains('popup-toggle-btn--on')) {
      hideClickPassesThrough = true;
      siteButton.click();
      hideClickPassesThrough = false;
    }
  }
