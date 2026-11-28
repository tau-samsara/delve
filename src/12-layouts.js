  // ---------------------------------------------------------------------------
  // Layouts
  //   default  - the site's own layout
  //   wide     - full width; the guide fills the window height
  //   split    - 50/50: video column (with stage info) on one side, guide on the other
  //   adaptive - picks by window width
  // ---------------------------------------------------------------------------
  const SPLIT_MIN = 1400;      // px; Split needs at least this width, otherwise Wide
  const ADAPTIVE_MIN = 700;    // px; below this Adaptive uses Default
  const SITE_NARROW_MAX = 768; // px; at or below this the site is single-column and every layout steps aside

  function effectiveLayout() {
    const w = window.innerWidth;
    if (w <= SITE_NARROW_MAX) return 'default';
    switch (settings.layout) {
      case 'wide': return 'wide';
      case 'split': return w >= SPLIT_MIN ? 'split' : 'wide';
      case 'adaptive': return w < ADAPTIVE_MIN ? 'default' : (w < SPLIT_MIN ? 'wide' : 'split');
      default: return 'default';
    }
  }

  function applyLayout() {
    const eff = effectiveLayout();
    if (eff === 'default') root.removeAttribute('data-delve-layout');
    else root.setAttribute('data-delve-layout', eff);
    root.setAttribute('data-delve-side', settings.splitSide);
    syncDrawer();
  }

  // Wide and Split share the base rules. Row height is left to the site.
  const L = 'html[data-delve-layout]';
  const LAYOUT_CSS = `
/* The site's theme centers content in a 1392px column using gutters that grow with the window. Wide and Split use the
   whole window, so use the narrow gutter the theme uses on small screens. */
${L} .app--guide { --8s-gutter: 24px; }
${L} .app--guide, ${L} .app--watch { border-left: 0; border-right: 0; }
/* (F28) Minimum layout height: below 760px the page scrolls instead of squeezing everything (the card, the video, the guide rows). */
${L} { --delve-h: max(100vh, 760px); }
${L} .app--guide { height: var(--delve-h); min-height: 0; overflow: hidden; }
${L} .stage--guide .stage-info-col { min-height: 0; overflow-y: auto; padding-top: 8px; padding-bottom: 0; }
${L} .stage--guide .guide-info-credits:empty { display: none; }
${L} .stage--guide .guide-info-description { margin-bottom: 6px; }
/* Keep WATCH / VIEW CHANNEL reachable in short windows. */
/* (F27) A footer bar: it takes the card's own background, so the text that scrolls under it does not show through the gaps
   between the buttons (it used to be drawn over "Up next" like a glitch). */
${L} .stage--guide .guide-actions { position: sticky; bottom: -9px; z-index: 2; margin: 0 -16px -9px; padding: 6px 16px 15px; background: inherit; }   /* the card has 9px of bottom padding: the bar covers it too */
${L} .tv-grid { min-height: 0; }
${L} .app--guide .grid-row.active .grid-channel-num::after { content: ' \\25B6'; color: var(--gold); font-size: .8em; }
${L} .app--guide .prevue-header-clock { white-space: nowrap; }
/* Only guide view, watch mode and channel mode (.app--watch.app--channel), not the other pages. */
${L} .app--guide *, ${L} .app--watch * { scrollbar-width: thin; }
/* Default layout: keep the page scrollbar's room so the width does not jump between Guide, Watch and Channel (T1). */
html:not([data-delve-layout]):has(.app--guide, .app--watch) { scrollbar-gutter: stable; }
${L} .app--guide ::-webkit-scrollbar, ${L} .app--watch ::-webkit-scrollbar { width: 10px; height: 10px; }
${L} .app--guide ::-webkit-scrollbar-track, ${L} .app--watch ::-webkit-scrollbar-track { background: transparent; }

/* Wide: video and info above the guide, capped at 44% of the window height. Spacing follows an 8px rule: the app's gap
   supplies 8px between header, stage, guide and footer; the guide's frame is drawn 8px outside its box, so its margins
   are 8px larger. The video column is the site's default size: 42% of the width, at most 600px. */
html[data-delve-layout="wide"] .app--guide { gap: 8px; }
/* .app--guide is needed for specificity: the theme's "html.theme-8s .stage" padding and ".tv-grid" margin load later
   with the same specificity. */
html[data-delve-layout="wide"] .app--guide .stage--guide { flex: 0 0 auto; max-height: max(calc(var(--delve-h) * .44), 390px); min-height: 0; overflow: hidden; padding: 0; margin: 0 8px; }
html[data-delve-layout="wide"] .stage--guide .stage-video-col { flex: 0 0 min(600px, 42%); min-height: 0; overflow: hidden; }
html[data-delve-layout="wide"] .app--guide .tv-grid { flex: 1 1 0; margin: 8px 16px; }
/* Same 8px frames as Split; the guide already draws its frame outward. */
html[data-delve-layout="wide"] .stage--guide .stage-video-col { padding: 8px; box-shadow: var(--8s-ring); }
/* (F27) The site keeps the video 16:9 with padding-top: 56.25%, which cannot shrink, so when the stage is capped (44vh, short windows) the
   video pushed its controls bar out of the panel (8 of 23 px left at 1280x700). A real 16:9 box instead: same size when there is room,
   and it shrinks (the video letterboxes) when there is not. */
html[data-delve-layout="wide"] .app--guide .stage--guide .stage-video-wrap { padding-top: 0; height: auto; aspect-ratio: 16 / 9; flex: 1 1 auto; min-height: 0; }
html[data-delve-layout="wide"] .stage--guide .stage-info-col { padding: 8px 18px 9px; }

/* Channel mode: player and channel panel side by side. Wide and Split behave the same: they fit the window without
   scrolling. The theme caps the player's width and centers it; let the player column fill the space instead (the video
   letterboxes). The channel panel supplies the 8px gap with its own left margin. */
html[data-delve-layout] .app--channel { height: var(--delve-h); min-height: 0; overflow: hidden; gap: 8px; }
html[data-delve-layout] .app--channel .screen-row--channel { flex: 1 1 0; min-height: 0; padding: 0 8px; }
html[data-delve-layout] .app--channel .stage--watch { min-width: 0; min-height: 0; height: calc(var(--delve-h) - 100px); }   /* header 48 + footer 36 + three 8px gaps; explicit so it can animate */
html[data-delve-layout] .app--channel .stage--watch .stage-video-col { flex: 1 1 100%; min-height: 0; padding: 8px; box-shadow: var(--8s-ring); }
html[data-delve-layout] .app--channel .stage--watch .stage-video-wrap { padding-top: 0; min-height: 0; }

/* Watch mode (channel mode is .app--watch.app--channel, handled above): the video stage fills the screen (window height
   minus header and two 8px gaps) and the whole guide is rendered below, so the page scrolls to it. Wide and Split are the
   same. The video keeps its shape with black bars inside its frame. Guide margins are 8px larger than the visible gap
   because its frame is drawn outside its box. */
html[data-delve-layout] .app--watch:not(.app--channel) { gap: 8px; }
html[data-delve-layout] .app--watch:not(.app--channel) .stage--watch { flex: 0 0 auto; height: calc(var(--delve-h) - 64px); min-height: 0; margin: 0 8px; padding: 0; }
html[data-delve-layout] .app--watch:not(.app--channel) .stage--watch .stage-video-col { flex: 1 1 100%; min-height: 0; padding: 8px; box-shadow: var(--8s-ring); }
html[data-delve-layout] .app--watch:not(.app--channel) .stage-video-wrap { padding-top: 0; min-height: 0; }
html[data-delve-layout] .app--watch:not(.app--channel) .tv-grid { margin: 8px 16px; }

/* Switching between watch and channel mode. The site grows the channel panel with its own animation and closes it with a
   negative margin, so with the player filling the width it snaps, lags, then snaps again. Instead the player's height
   eases between modes and the closing panel shrinks to nothing while the player widens. The site keeps the closing panel
   in the page for about half a second, so keep its row laid out as a row meanwhile. */
@keyframes delve-panel-out { from { flex-basis: calc(var(--cv-w) + var(--cv-gap)); opacity: 1; } to { flex-basis: 0; opacity: 0; } }
html[data-delve-layout] .app--watch .stage--watch { transition: height .5s cubic-bezier(.4, 0, .2, 1); }
/* Wide: going from watch/channel to guide used to snap the stage to the guide's capped height, because "auto, at most 44vh"
   cannot ease from a fixed height and the site's pull class (transition: none !important) holds transitions off. The stage
   now interpolates to and from auto, eases height and max-height together, and overrides the hold for the stage only
   (its children keep the site's animation). */
html[data-delve-layout="wide"] .stage > * { interpolate-size: numeric-only; }
html[data-delve-layout="wide"] .stage.stage--guide { interpolate-size: allow-keywords; transition: height .5s cubic-bezier(.4, 0, .2, 1), max-height .5s cubic-bezier(.4, 0, .2, 1) !important; }
/* Guide -> watch must NOT interpolate from auto: it stalls, then jumps. */
html[data-delve-layout="wide"] .stage.stage--watch { interpolate-size: numeric-only; transition: height .5s cubic-bezier(.4, 0, .2, 1) !important; }
html[data-delve-layout="wide"] .app--watch .stage--watch { max-height: var(--delve-h); }
@media (prefers-reduced-motion: reduce) { html[data-delve-layout="wide"] .stage.stage--guide, html[data-delve-layout="wide"] .stage.stage--watch { transition-duration: 1ms !important; } }
html[data-delve-layout] .app--watch:not(.app--channel) .screen-row:has(> .cv-panel) { padding: 0 8px; flex: 0 0 auto; }
html[data-delve-layout] .app--watch:not(.app--channel) .screen-row:has(> .cv-panel) > .stage--watch { margin: 0; flex: 1 1 0; min-width: 0; }
html[data-delve-layout] .app--watch:not(.app--channel) .cv-panel--closing { margin-left: 0; animation: delve-panel-out .5s cubic-bezier(.4, 0, .2, 1) both; }
@media (prefers-reduced-motion: reduce) {
  html[data-delve-layout] .app--watch .stage--watch { transition-duration: 1ms; }
  html[data-delve-layout] .app--watch:not(.app--channel) .cv-panel--closing { animation-duration: 1ms; }
}

/* Split: two equal columns under the header, status bar across the bottom. */
html[data-delve-layout="split"] .app--guide {
  display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 8px;
}
html[data-delve-layout="split"] .app--guide > .prevue-header-bar { grid-column: 1 / -1; grid-row: 1; }
html[data-delve-layout="split"] .app--guide > .statusbar { grid-column: 1 / -1; grid-row: 3; }
/* One 8px gap everywhere. The stage has no padding; its panels are 8px apart and 8px from the window edge. The guide's
   frame is drawn outside its box, so its margins are 8px larger: 16px at the window edge, 8px elsewhere. */
html[data-delve-layout="split"] .app--guide .stage--guide {
  grid-row: 2; grid-column: 1; display: flex; flex-direction: column; gap: 8px; padding: 0; margin: 0 0 0 8px;
  max-height: none; min-height: 0; overflow: hidden;
}
html[data-delve-layout="split"] .app--guide > .tv-grid { grid-row: 2; grid-column: 2; margin: 8px 16px 8px 8px; }
html[data-delve-side="right"][data-delve-layout="split"] .app--guide .stage--guide { grid-column: 2; margin: 0 8px 0 0; }
.stage-guide-controls:has(.guide-ctrl-mute) #delve-mute { display: none !important; }   /* the site drew its own mute button */
/* Video on the right (Default and Wide): reverse the row, also while the site changes view (stage--pull) so the info card
   doesn't jump sides. Not in the site's single-column mode. */
@media (min-width: 769px) { html[data-delve-side="right"]:not([data-delve-layout="split"]) :is(.app--guide .stage--guide, .stage.stage--pull) { flex-direction: row-reverse; } }
html[data-delve-side="right"][data-delve-layout="split"] .app--guide > .tv-grid { grid-column: 1; margin: 8px 8px 8px 16px; }
/* Video on the right, going to the guide view: the theme centers the video column with auto margins in watch mode and the
   guide rule drops them only at the end, so the info card slid in from the far left. No auto margins in the reversed row. */
@media (min-width: 769px) { html[data-delve-side="right"]:not([data-delve-layout="split"]) :is(.app--guide .stage--guide, .stage.stage--pull) .stage-video-col { margin: 0 !important; } }
/* Fit the video column to the column at 16:9 instead of sizing it from the video's pixel dimensions. */
/* (F26) The info card gets the height its content needs and the video column takes what is left, so "Up next" is not cut off
   (it used to be: the 16:9 video took about 705 px of the 900 px column). The video letterboxes inside its frame. */
html[data-delve-layout="split"] .app--guide .stage--guide .stage-video-col { flex: 1 1 0; width: 100%; max-width: 100%; min-width: 0; min-height: 0; box-sizing: border-box; }
html[data-delve-layout="split"] .app--guide .stage--guide .stage-video-wrap { flex: 1 1 0; width: 100%; height: auto; min-height: 0; aspect-ratio: auto; padding-top: 0; }   /* the site keeps 16:9 with padding-top: 56.25% */
html[data-delve-layout="split"] .app--guide .stage--guide .stage-video { width: 100%; height: 100%; }
/* Both stage panels get the info panel's 8px frame (the guide draws the same outward). The video panel's padding drops
   from 16px to 8px to match. */
html[data-delve-layout="split"] .app--guide .stage--guide .stage-video-col { padding: 8px; box-shadow: var(--8s-ring); }
html[data-delve-layout="split"] .app--guide .stage--guide .stage-info-col { flex: 0 1 auto; padding: 8px 18px 9px; }

/* Split, watch mode: the player on one half, the guide on the other, fitted to the window like the guide view. */
html[data-delve-layout="split"] .app--watch:not(.app--channel) {
  display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 8px; height: var(--delve-h); min-height: 0; overflow: hidden;
}
html[data-delve-layout="split"] .app--watch:not(.app--channel) > .prevue-header-bar { grid-column: 1 / -1; grid-row: 1; }
html[data-delve-layout="split"] .app--watch:not(.app--channel) > .statusbar { grid-column: 1 / -1; grid-row: 3; }
html[data-delve-layout="split"] .app--watch:not(.app--channel) > .screen-row { grid-row: 2; grid-column: 1; display: flex; min-width: 0; min-height: 0; padding: 0 0 0 8px; }
html[data-delve-layout="split"] .app--watch:not(.app--channel) > .screen-row > .stage--watch { flex: 1 1 0; height: auto; min-width: 0; margin: 0; }
html[data-delve-layout="split"] .app--watch:not(.app--channel) > .tv-grid { grid-row: 2; grid-column: 2; margin: 8px 16px 8px 8px; min-height: 0; overflow-y: auto; }
/* The site's info column is collapsed and inert in watch mode; Program information draws its own card above the guide. The
   guide's frame is drawn 8px outside its box, so the card's side margins line it up with the guide's visible edge. */
.delve-prog-close { position: absolute; top: 8px; right: 8px; z-index: 1; min-width: 0; padding: 2px 8px; font-weight: 700; cursor: pointer; }
html[data-delve-layout="split"] .app--watch:not(.app--channel) > .delve-prog { position: relative; grid-row: 2; grid-column: 2; margin: 0 8px 0 0; max-height: calc(var(--delve-h) * .4); padding: 8px 18px 9px; background: var(--8s-box); box-shadow: var(--8s-ring); }
html[data-delve-layout="split"][data-delve-prog] .app--watch:not(.app--channel) { grid-template-rows: auto auto minmax(0, 1fr) auto; }
html[data-delve-layout="split"][data-delve-prog] .app--watch:not(.app--channel) > .screen-row { grid-row: 2 / 4; }
html[data-delve-layout="split"][data-delve-prog] .app--watch:not(.app--channel) > .tv-grid { grid-row: 3; }
html[data-delve-layout="split"][data-delve-prog] .app--watch:not(.app--channel) > .statusbar { grid-row: 4; }
html[data-delve-side="right"][data-delve-layout="split"] .app--watch:not(.app--channel) > .screen-row { grid-column: 2; padding: 0 8px 0 0; }
html[data-delve-side="right"][data-delve-layout="split"] .app--watch:not(.app--channel) > .delve-prog { grid-column: 1; margin: 0 0 0 8px; }
html[data-delve-side="right"][data-delve-layout="split"] .app--watch:not(.app--channel) > .tv-grid { grid-column: 1; margin: 8px 8px 8px 16px; }
`;

