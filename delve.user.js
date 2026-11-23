// ==UserScript==
// @name         Delve
// @namespace    https://spelunkr.tv/
// @author       tau-samsara
// @version      0.30.14
// @description  Adds quality-of-life features to spelunkr.tv that are commonly requested in the official discord feature-requests channel
// @updateURL    https://raw.githubusercontent.com/tau-samsara/delve/main/delve.user.js
// @downloadURL  https://raw.githubusercontent.com/tau-samsara/delve/main/delve.user.js
// @match        https://spelunkr.tv/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      data.spelunkr.tv
// ==/UserScript==

// MIT License
//
// Copyright (c) 2026 tau-samsara
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

(function boot() {
  'use strict';

  // <html> may not exist yet at document-start; wait for it.
  if (!document.documentElement) { setTimeout(boot, 5); return; }
  const root = document.documentElement;

  // ---------------------------------------------------------------------------
  // Settings
  // One object under the single GM key 'settings'. Fields not in DEFAULTS are dropped on save.
  // ---------------------------------------------------------------------------
  const STORAGE_KEY = 'settings';
  const LAYOUTS = ['default', 'wide', 'split', 'adaptive'];
  const SIDES = ['left', 'right'];
  const DEFAULTS = {
    layout: 'default',   // guide arrangement
    splitSide: 'left',   // side the video takes in every layout
    favorites: [],       // starred channel ids
    favOnly: false,      // show only favorite channels
    sort: 'dial',        // 'dial' | 'name' | 'viewers' | 'favorites'
    zoom: 3,             // hours shown across the guide (one of ZOOMS)
    volume: 0.5,         // remembered between page loads
    muted: true,         // remembered between page loads
    // Feature switches in the drawer; all off by default
    programInfo: false,   // click-for-info card and IMDb / Archive links
    favoritesOn: false,   // stars and Favorites button
    sortOn: false,        // Sort drop-down
    extended: false,      // extended guide: wider view, zoom, Now button, Now line
  };
  const FEATURES = [['programInfo', 'Program information'], ['favoritesOn', 'Favorites'], ['sortOn', 'Sort'], ['extended', 'Extended guide']];
  const ZOOMS = [0.5, 1, 3, 6, 12];
  const zoomText = z => z < 1 ? Math.round(z * 60) + 'm' : z + 'h';
  const SORTS = { dial: 'Channel #', name: 'Name', viewers: 'Most watched', favorites: 'Favorites first' };

  function load() {
    const out = Object.assign({}, DEFAULTS);
    try {
      const raw = GM_getValue(STORAGE_KEY, null);
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (parsed && typeof parsed === 'object') {
        if (LAYOUTS.indexOf(parsed.layout) !== -1) out.layout = parsed.layout;
        if (SIDES.indexOf(parsed.splitSide) !== -1) out.splitSide = parsed.splitSide;
        if (Array.isArray(parsed.favorites)) out.favorites = parsed.favorites.filter(x => typeof x === 'string');
        if (typeof parsed.favOnly === 'boolean') out.favOnly = parsed.favOnly;
        if (ZOOMS.indexOf(parsed.zoom) !== -1) out.zoom = parsed.zoom;
        if (typeof parsed.volume === 'number' && parsed.volume >= 0 && parsed.volume <= 1) out.volume = parsed.volume;
        if (typeof parsed.muted === 'boolean') out.muted = parsed.muted;
        FEATURES.forEach(f => { if (typeof parsed[f[0]] === 'boolean') out[f[0]] = parsed[f[0]]; });        if (Object.prototype.hasOwnProperty.call(SORTS, parsed.sort)) out.sort = parsed.sort;
      }
    } catch (e) { /* use defaults */ }
    return out;
  }

  function save(s) {
    try { GM_setValue(STORAGE_KEY, s); }
    catch (e) { console.warn('[delve] could not save settings', e); }
  }

  let settings = load();
  function setSettings(patch) {
    settings = Object.assign({}, settings, patch);
    save(settings);
    applyLayout();
    syncDrawer();
  }

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
${L} .grid-row.active .grid-channel-num::after { content: ' \\25B6'; color: var(--gold); font-size: .8em; }
${L} .app--guide .prevue-header-clock { white-space: nowrap; }
/* Only guide view, watch mode and channel mode (.app--watch.app--channel), not the other pages. */
${L} .app--guide *, ${L} .app--watch * { scrollbar-width: thin; }
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
`;

  // ---------------------------------------------------------------------------
  // Drawer. Colors, fonts and borders come from the site's CSS variables.
  // ---------------------------------------------------------------------------
  const DRAWER_CSS = `
.delve-scrim { position: fixed; inset: 0; z-index: 2147483000; background: transparent; display: none; }
.delve-scrim.open { display: block; }
.delve-drawer {
  position: fixed; top: 0; right: 0; bottom: 0; z-index: 2147483001; box-sizing: border-box;
  width: min(340px, 100vw); overflow-y: auto; padding: var(--space-4, 16px);
  background: var(--bg-panel, #0d1238); color: var(--text, #e8eaf0);
  border-left: var(--border-width, 3px) solid var(--border-bold, #4a5aaa);
  font-family: var(--font-mono, "Courier New", monospace); font-size: 14px; line-height: 1.4;
  transform: translateX(100%); visibility: hidden; transition: transform .2s ease, visibility 0s linear .2s;
}
.delve-drawer.open { transform: none; visibility: visible; transition: transform .2s ease; }
.delve-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4, 16px); }
.delve-title { margin: 0; font-size: 20px; letter-spacing: .08em; color: var(--gold, #ffd740); }
.delve-row { margin: 0 0 var(--space-4, 16px); }
.delve-label { display: block; margin-bottom: var(--space-2, 8px); color: var(--cyan, #00ccdd); letter-spacing: .06em; text-transform: uppercase; font-size: 12px; }
/* Buttons and the drop-down reuse the site's button classes (bbtn bbtn-outline / bbtn-gold). */
.delve-close { min-height: 30px; padding: 0 10px; }
.delve-select { display: block; width: 100%; box-sizing: border-box; height: 36px; min-height: 36px; padding: 0 10px; line-height: normal; text-align: left; color-scheme: dark; }
.delve-select option { color: #fff; background: var(--bg-deep, #060b1e); }
.delve-seg { display: flex; gap: var(--space-2, 8px); }
/* Left/Right use the site's toggle buttons: grey when off, blue with gold text when on (popup-toggle-btn--on). */
.delve-seg button, .delve-toggle { flex: 1 1 0; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; cursor: pointer; }
.delve-toggle { display: block; width: 100%; }
.delve-select:focus-visible, .delve-seg button:focus-visible, .delve-toggle:focus-visible, .delve-close:focus-visible { outline: 2px solid var(--cyan, #00ccdd); outline-offset: 2px; }
.header-nav-delve { cursor: pointer; }
/* The site orders header items with flex "order" (clock last), so give the button the highest. */
html .prevue-header-bar > .header-nav-item.header-nav-delve { order: 99; margin-left: var(--space-2, 8px); }
/* Phone: DELVE sits by the menu button; tighten the header so the clock stays on screen (B2). */
@media (max-width: 480px) {
  html .prevue-header-bar:has(.header-nav-delve) { gap: 3px !important; }
  html .prevue-header-bar:has(.header-nav-delve) .header-nav-delve, html .prevue-header-bar:has(.header-nav-delve) .header-signin { padding-left: 4px !important; padding-right: 4px !important; min-width: 0 !important; }
}
`;

  const PANEL_CSS = `
html[data-delve-prog] .stage-info-col > .guide-info-description,
html[data-delve-prog] .stage-info-col > .guide-info-now,
html[data-delve-prog] .stage-info-col > .guide-upcoming-divider,
html[data-delve-prog] .stage-info-col > .guide-info-upcoming,
html[data-delve-hdr] .stage-info-col > .guide-info-channel-header { display: none !important; }
.app--guide .grid-program[data-delve-sel] { outline: 2px solid var(--gold, #ffd740); outline-offset: -2px; }
/* The panel reuses the site's "now playing" / "up next" classes for matching fonts and colors. */
/* While a clicked program's data loads, the current content stays under a dark layer. */
html[data-delve-loading] .app--guide .stage-info-col { position: relative; }
html[data-delve-loading] .app--guide .stage-info-col::after { content: ''; position: absolute; inset: 0; z-index: 5; background: rgba(0, 0, 0, .55); pointer-events: none; }
.delve-prog { flex: 0 0 auto; min-height: 0; overflow-y: auto; box-sizing: border-box; }
.delve-prog-now { margin-bottom: 2px; padding-top: 8px; border-top: 1px solid var(--border-color, rgb(38, 82, 178)); }   /* Classic #2652B2; the palette's frame color in Flat */
.delve-prog-labelrow { display: flex; align-items: center; gap: 12px; }
.delve-prog .guide-info-now-title { white-space: normal; overflow: visible; }
.delve-prog .guide-info-now-title-row { flex-wrap: wrap; }
.delve-prog .guide-info-now-desc { display: block; -webkit-line-clamp: unset; overflow: visible; }
.delve-prog .guide-info-upcoming-item { display: flex; }
.delve-prog .guide-info-upcoming-title { white-space: normal; }
html .delve-prog-links { -webkit-line-clamp: unset; overflow: visible; }
.delve-prog-backrow { margin-bottom: 8px; }
.delve-prog-links a { color: var(--8s-yellow, var(--gold, #ffd740)); text-decoration: underline; }
.delve-prog-links > a { margin-right: 18px; }
.delve-link { display: inline-flex; align-items: center; gap: 4px; margin-right: 18px; white-space: nowrap; }
.delve-link a { display: inline-flex; align-items: center; gap: 5px; }
.delve-copy { display: inline-flex; align-items: center; padding: 2px; margin: 0; border: 0; background: none; color: var(--8s-yellow, var(--gold, #ffd740)); opacity: .75; cursor: pointer; }
.delve-copy:hover, .delve-copy:focus-visible { opacity: 1; }
.delve-icon { flex: 0 0 auto; }
`;

  const LAYOUT_NAMES = { default: 'Default', wide: 'Wide', split: 'Split', adaptive: 'Adaptive' };
  const SIDE_NAMES = { left: 'Left', right: 'Right' };

  const STYLE_ID = 'delve-style';
  function applyStyle() {
    let s = document.getElementById(STYLE_ID);
    if (!s) {
      s = document.createElement('style');
      s.id = STYLE_ID;
      s.textContent = LAYOUT_CSS + DRAWER_CSS + PANEL_CSS + BAR_CSS + NOW_CSS + WIDE_CSS;
      (document.head || root).appendChild(s);
    }
  }

  let drawer = null, scrim = null, lastFocus = null;

  function buildDrawer() {
    scrim = document.createElement('div');
    scrim.className = 'delve-scrim';
    scrim.addEventListener('click', closeDrawer);

    drawer = document.createElement('aside');
    drawer.className = 'delve-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-label', 'Delve');

    const head = document.createElement('div');
    head.className = 'delve-head';
    const title = document.createElement('h2');
    title.className = 'delve-title';
    title.textContent = 'DELVE';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'delve-close bbtn bbtn-outline';
    close.setAttribute('aria-label', 'Close Delve');
    close.textContent = '✕';
    close.addEventListener('click', closeDrawer);
    head.append(title, close);

    // View type: a drop-down.
    const viewRow = document.createElement('div');
    viewRow.className = 'delve-row';
    const viewLabel = document.createElement('label');
    viewLabel.className = 'delve-label';
    viewLabel.htmlFor = 'delve-view';
    viewLabel.textContent = 'View type';
    const select = document.createElement('select');
    select.id = 'delve-view';
    select.className = 'delve-select bbtn bbtn-outline';
    LAYOUTS.forEach(v => {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = LAYOUT_NAMES[v];
      select.append(o);
    });
    select.addEventListener('change', () => setSettings({ layout: select.value }));
    viewRow.append(viewLabel, select);

    // Video side: left/right buttons.
    const sideRow = document.createElement('div');
    sideRow.className = 'delve-row';
    const sideLabel = document.createElement('span');
    sideLabel.className = 'delve-label';
    sideLabel.id = 'delve-side-label';
    sideLabel.textContent = 'Video side';
    const seg = document.createElement('div');
    seg.className = 'delve-seg';
    seg.setAttribute('role', 'group');
    seg.setAttribute('aria-labelledby', 'delve-side-label');
    SIDES.forEach(v => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'popup-toggle-btn';
      b.dataset.side = v;
      b.textContent = SIDE_NAMES[v];
      b.addEventListener('click', () => setSettings({ splitSide: v }));
      seg.append(b);
    });
    sideRow.append(sideLabel, seg);

    // Feature switches: one toggle each
    const featRows = FEATURES.map(([key, name]) => {
      const row = document.createElement('div');
      row.className = 'delve-row';
      const label = document.createElement('span');
      label.className = 'delve-label';
      label.id = 'delve-feat-' + key;
      label.textContent = name;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'popup-toggle-btn delve-toggle';
      b.dataset.feature = key;
      b.setAttribute('aria-labelledby', label.id);
      b.addEventListener('click', () => {
        setSettings({ [key]: !settings[key] });
        if (!settings.programInfo && progState) closePanel();
        ensureGuide();
      });
      row.append(label, b);
      return row;
    });

    drawer.append(head, viewRow, sideRow, ...featRows);
    root.append(scrim, drawer);
  }

  function syncDrawer() {
    if (!drawer) return;
    drawer.querySelector('#delve-view').value = settings.layout;
    drawer.querySelectorAll('.delve-seg button').forEach(b => {
      const on = b.dataset.side === settings.splitSide;
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('popup-toggle-btn--on', on);   // the site's "on" look: blue with gold text
    });
    drawer.querySelectorAll('.delve-toggle').forEach(b => {
      const on = !!settings[b.dataset.feature];
      b.textContent = on ? 'On' : 'Off';
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('popup-toggle-btn--on', on);
    });
  }

  function isOpen() { return !!drawer && drawer.classList.contains('open'); }

  function openDrawer() {
    if (!drawer) buildDrawer();
    syncDrawer();
    lastFocus = document.activeElement;
    scrim.classList.add('open');
    drawer.classList.add('open');
    const first = drawer.querySelector('.delve-select');
    if (first) first.focus({ preventScroll: true });
    setExpanded(true);
  }

  function closeDrawer() {
    if (!isOpen()) return;
    scrim.classList.remove('open');
    drawer.classList.remove('open');
    setExpanded(false);
    // preventScroll: the DELVE button is at the top; focusing it must not scroll the page up
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

  function setExpanded(v) {
    document.querySelectorAll('[data-delve-btn]').forEach(b => b.setAttribute('aria-expanded', String(v)));
  }

  // ---------------------------------------------------------------------------
  // DELVE button. At the right end of the site's top nav on every page; on the landing page it joins the corner links.
  // The site re-renders, so re-add it when missing.
  // ---------------------------------------------------------------------------
  function ensureButtons() {
    // Far right of the top bar: after the clock where there is one (guide view), else at the end of the nav links.
    // At phone width (the site's 480px breakpoint) the guide header is full, so it goes with the nav links by the menu button.
    const narrow = window.matchMedia('(max-width: 480px)').matches;
    document.querySelectorAll('.prevue-header-bar').forEach(bar => {
      const clock = bar.querySelector(':scope > .prevue-header-clock');
      const nav = bar.querySelector(':scope > .header-nav');
      if (!clock && !nav) return;
      let b = bar.querySelector('[data-delve-btn]');
      if (!b) {
        b = document.createElement('button');
        b.type = 'button';
        b.className = 'header-nav-item header-nav-delve bbtn bbtn-outline';
        b.textContent = 'DELVE';
        b.setAttribute('data-delve-btn', '');
        b.setAttribute('aria-haspopup', 'dialog');
        b.setAttribute('aria-expanded', String(isOpen()));
      }
      if (clock && !(narrow && nav)) {
        if (clock.nextElementSibling !== b) clock.after(b);
      } else {
        if (nav) {
          const menu = nav.querySelector(':scope > .page-menu');
          if (b.parentNode !== nav || b.nextElementSibling !== (menu || null)) nav.insertBefore(b, menu || null);
        }
      }
    });
    document.querySelectorAll('.hp-corner').forEach(corner => {
      if (corner.querySelector(':scope > [data-delve-btn]')) return;
      const a = document.createElement('a');
      a.href = '#';
      a.setAttribute('role', 'button');
      a.className = 'hp-about-link hp-delve-link';
      a.textContent = 'DELVE';
      a.setAttribute('data-delve-btn', '');
      a.setAttribute('aria-haspopup', 'dialog');
      a.setAttribute('aria-expanded', String(isOpen()));
      corner.append(a);
    });
  }

  document.addEventListener('click', e => {
    const t = e.target;
    if (!t || !t.closest || !t.closest('[data-delve-btn]')) return;
    e.preventDefault();
    e.stopPropagation();
    if (isOpen()) closeDrawer(); else openDrawer();
  }, true);

  // ---------------------------------------------------------------------------
  // Program info on click. Guide view only. The first click on a card shows its info under the video and leaves the
  // preview alone; a second click on the same card lets the site tune.
  // ---------------------------------------------------------------------------
  const DATA_BASE = 'https://data.spelunkr.tv/';
  function getJSON(url) {
    return fetch(url)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .catch(err => {
        if (typeof GM_xmlhttpRequest !== 'function') throw err;
        return new Promise((resolve, reject) => GM_xmlhttpRequest({
          method: 'GET', url, responseType: 'json',
          onload: r => {
            if (r.status >= 300) return reject(new Error('HTTP ' + r.status));
            try { resolve(typeof r.response === 'string' ? JSON.parse(r.response) : r.response); }
            catch (e) { reject(e); }
          },
          onerror: reject,
        }));
      });
  }
  const dataCache = { lineup: null, lineupAt: 0, versions: new Map() };
  function getLineup() {
    if (dataCache.lineup && Date.now() - dataCache.lineupAt < 10 * 60 * 1000) return dataCache.lineup;
    dataCache.lineupAt = Date.now();
    dataCache.lineup = getJSON(DATA_BASE + 'lineup.json').catch(e => { dataCache.lineup = null; throw e; });
    return dataCache.lineup;
  }
  function getVersion(v) {
    const key = v.manifest;
    if (!dataCache.versions.has(key)) {
      dataCache.versions.set(key, Promise.all([getJSON(DATA_BASE + v.manifest), getJSON(DATA_BASE + v.details)])
        .then(([m, d]) => ({ m, d }))
        .catch(e => { dataCache.versions.delete(key); throw e; }));
    }
    return dataCache.versions.get(key);
  }
  function orderedVersions(ch) {
    const now = Date.now();
    const eff = v => (v.effectiveAtMs <= now ? 0 : 1);
    return (ch.versions || []).slice().sort((a, b) => eff(a) - eff(b) || b.v - a.v);
  }
  // Find the playlist item behind a guide cell. Returns { ch, item, detail }.
  async function findProgram(channelId, title, durSec) {
    const lineup = await getLineup();
    const ch = (lineup.channels || []).find(c => c.id === channelId);
    if (!ch) return { ch: null, item: null, detail: null };
    for (const v of orderedVersions(ch)) {
      const { m, d } = await getVersion(v);
      const hits = [];
      m.items.forEach((it, i) => { if (it.title === title) hits.push(i); });
      if (hits.length) {
        let idx = hits.find(i => Math.abs(m.items[i].duration - durSec) <= 1);
        if (idx === undefined) idx = hits[0];
        return { ch, item: m.items[idx], detail: (d.items || [])[idx] || {} };
      }
    }
    return { ch, item: null, detail: null };
  }

  function parseClock(str, ref) {
    const m = /(\d{1,2}):(\d{2})\s*([AP]M)?/i.exec(str || '');
    if (!m) return null;
    let h = +m[1];
    if (m[3]) { h = h % 12; if (/p/i.test(m[3])) h += 12; }
    let best = null;
    for (const dd of [-1, 0, 1]) {
      const d = new Date(ref);
      d.setDate(d.getDate() + dd);
      d.setHours(h, +m[2], 0, 0);
      if (!best || Math.abs(d - ref) < Math.abs(best - ref)) best = d;
    }
    return best;
  }
  // pct -> Date from the guide's own hourly axis labels, or null.
  function makeTimeMapper() {
    const labels = Array.from(document.querySelectorAll(':is(.app--guide, .app--watch:not(.app--channel)) .tv-grid-body .grid-time-label'))
      .map(e => ({ txt: e.textContent, pct: parseFloat(e.style.left) }))
      .filter(l => !isNaN(l.pct));
    if (labels.length < 2 || labels[1].pct === labels[0].pct) return null;
    const now = new Date();
    const t0 = parseClock(labels[0].txt, now);
    let t1 = parseClock(labels[1].txt, now);
    if (!t0 || !t1) return null;
    if (t1 <= t0) t1 = new Date(t1.getTime() + 86400000);
    const msPerPct = (t1 - t0) / (labels[1].pct - labels[0].pct);
    const map = pct => new Date(t0.getTime() + (pct - labels[0].pct) * msPerPct);
    map.msPerPct = msPerPct;                                          // ms per 1% of the window
    map.pctOf = d => labels[0].pct + (d.getTime() - t0.getTime()) / msPerPct;   // Date -> pct
    return map;
  }
  function readCell(cell) {
    const titleEl = cell.querySelector('.grid-program-title');
    const first = titleEl && titleEl.firstChild;
    const title = (first ? first.textContent : (cell.textContent || '')).trim();
    const yearEl = cell.querySelector('.grid-program-year');
    const durEl = cell.querySelector('.grid-program-duration');
    const parts = ((durEl && durEl.textContent) || '').trim().split(':').map(Number);
    const durSec = !parts.length || parts.some(isNaN) ? 0 : parts.reduce((a, p) => a * 60 + p, 0);
    return {
      title, year: yearEl ? yearEl.textContent.trim() : '', durSec,
      left: parseFloat(cell.style.left), width: parseFloat(cell.style.width),
      marathon: cell.classList.contains('marathon'), tip: cell.getAttribute('title') || '',
    };
  }
  // Marathon cells carry their show list in the tooltip: "NAME · 5 shows · 1h 20m\n2:03 PM  Title\n..."
  function parseMarathon(tip) {
    const lines = String(tip || '').split('\n').map(l => l.trim()).filter(Boolean);
    const shows = [];
    for (const l of lines.slice(1)) {
      const m = /^(\d{1,2}:\d{2}\s*[AP]M)\s+(.+)$/i.exec(l);
      if (m) shows.push({ time: m[1], title: m[2] });
    }
    return { head: lines[0] || '', shows };
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const warnedMissing = new Set();
  function warnMissing(selector, unavailableFeature) {
    const message = selector + ' not found; ' + unavailableFeature + ' unavailable';
    if (warnedMissing.has(message)) return;
    warnedMissing.add(message);
    console.warn('[delve] ' + message);
  }
  const fmtTime = d => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const fmtDur = sec => {
    const m = Math.round(sec / 60);
    return m >= 60 ? Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm' : m + ' min';
  };
  const highlightedChannel = () => {
    const hl = document.querySelector(':is(.app--guide, .app--watch:not(.app--channel)) .grid-row.highlighted');
    return hl ? hl.dataset.channel : null;
  };
  function statusText(start, end) {
    if (!start || !end) return '';
    const now = Date.now();
    if (now >= start && now < end) return 'On now';
    if (now < start) return 'Starts in ' + fmtDur((start - now) / 1000);
    return 'Aired earlier';
  }

  let panel = null;
  let progState = null;   // { channelId, baseline } while a program is shown
  let openToken = 0, lastHeight = 0, pollTimer = null;
  let lastInfo = null;    // { cell, info } of the card now shown, so a second click needs no new lookup

  function ensurePanel() {
    const col = document.querySelector('.app--guide .stage-info-col');
    if (!col) {
      if (document.querySelector('.app--guide')) warnMissing('.stage-info-col', 'Program information');
      return null;
    }
    if (!panel) panel = el('div', 'delve-prog');
    if (panel.parentNode !== col) {
      const anchor = col.querySelector('.guide-actions-divider') || col.querySelector('.guide-actions');
      col.insertBefore(panel, anchor || null);
    }
    return panel;
  }

  // The site's channel header shows the tuned channel; copy it for the clicked program's channel.
  function buildChannelHead(channelId, ch) {
    const siteHead = document.querySelector('.app--guide .stage-info-col > .guide-info-channel-header');
    const row = channelId && document.querySelector('.app--guide .grid-row[data-channel="' + CSS.escape(channelId) + '"]');
    const name = row && row.querySelector('.grid-channel-name-text');
    const num = row && row.querySelector('.grid-channel-num');
    if (!siteHead || !name || !num) {
      if (row) warnMissing(!siteHead ? '.guide-info-channel-header' : !name ? '.grid-channel-name-text' : '.grid-channel-num', 'Program information');
      return null;
    }
    const head = siteHead.cloneNode(true);
    const setText = (sel, txt) => { const n = head.querySelector(sel); if (n) n.textContent = txt; };
    setText('.guide-info-channel-name', name.textContent);
    setText('.guide-info-channel-num', 'CH ' + num.textContent.trim());
    const status = head.querySelector('.guide-info-status'); if (status) status.remove();
    const hIcon = head.querySelector(':scope > svg'), rIcon = row.querySelector('.grid-channel-info > svg');
    if (hIcon && rIcon) { const icon = rIcon.cloneNode(true); icon.setAttribute('class', hIcon.getAttribute('class') || ''); hIcon.replaceWith(icon); }
    const text = (ch && ch.description) || '';
    const desc = text ? el('div', 'guide-info-description', text) : null;
    return { head, desc };
  }

  // Small pixel icons in the site's crisp style: external-link arrow, copy, and copy check.
  const ICONS = {
    external: '<path d="M0 2h5v1H1v8h8V7h1v5H0zM7 0h5v5h-1V1H7zM5 6h1v1H5zM6 5h1v1H6zM7 4h1v1H7zM8 3h1v1H8zM9 2h1v1H9z"/>',
    copy: '<path d="M4 4h8v8H4z"/><path d="M0 0h8v2H2v6H0z"/>',
    check: '<path d="M1 6h2v2H1zM3 8h2v2H3zM5 6h2v2H5zM7 4h2v2H7zM9 2h2v2H9z"/>',
  };
  function icon(name) {
    const t = document.createElement('template');
    t.innerHTML = '<svg class="delve-icon" width="12" height="12" viewBox="0 0 12 12" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">' + ICONS[name] + '</svg>';
    return t.content.firstChild;
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise((resolve, reject) => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.append(ta); ta.select();
      try { document.execCommand('copy') ? resolve() : reject(new Error('copy failed')); } catch (e) { reject(e); }
      ta.remove();
    });
  }
  // One link: label + "opens in a new tab" arrow, then a button that copies the address.
  function linkItem(label, href) {
    const box = el('span', 'delve-link');
    const a = el('a', null);
    a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.append(document.createTextNode(label), icon('external'));
    const btn = el('button', 'delve-copy');
    btn.type = 'button';
    btn.title = 'Copy link'; btn.setAttribute('aria-label', 'Copy ' + label + ' link');
    btn.append(icon('copy'));
    btn.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      copyText(href).then(() => {
        btn.textContent = ''; btn.append(icon('check'));
        setTimeout(() => { btn.textContent = ''; btn.append(icon('copy')); }, 1200);
      }).catch(() => {});
    });
    box.append(a, btn);
    return box;
  }

  // IMDb / Internet Archive links, or null when the program has neither.
  function makeLinks(detail, item, cls) {
    const links = el('div', (cls || 'guide-info-now-desc') + ' delve-prog-links');
    if (detail && detail.imdbId && /^tt\d+$/.test(detail.imdbId)) {
      links.append(linkItem('IMDb', 'https://www.imdb.com/title/' + detail.imdbId + '/'));
    }
    if (item && item.id) {
      links.append(linkItem('Internet Archive', 'https://archive.org/details/' + encodeURIComponent(item.id)));
    }
    return links.childNodes.length ? links : null;
  }

  // The same links in the site's "now playing" block (the tuned channel's current program).
  const nowCache = new Map();   // channel|title -> { detail, item }
  let nowPending = '';
  const clockSecs = s => {
    const p = String(s || '').replace(/[^\d:]/g, '').split(':').map(Number);
    return !p.length || p.some(isNaN) ? 0 : p.reduce((a, v) => a * 60 + v, 0);
  };
  function putNowLinks(block, key, cls) {
    const old = block.querySelector('.delve-now-links');
    if (old && old.dataset.key === key) return;
    if (old) old.remove();
    const hit = nowCache.get(key);
    const links = hit && makeLinks(hit.detail, hit.item, cls);
    if (!links) return;
    links.classList.add('delve-now-links');
    links.dataset.key = key;
    const anchor = block.querySelector('.vcr-progress');
    block.insertBefore(links, anchor || null);
  }
  // Where the site shows the playing program: the guide's info column, and the info under the player in watch and channel
  // mode. Each has its own title element and text class; the channel comes from the guide's highlighted row, or from the
  // address in watch/channel mode.
  const NOW_BLOCKS = [
    { block: '.app--guide .stage-info-col > .guide-info-now', title: '.guide-info-now-title', cls: 'guide-info-now-desc' },
    { block: '.app--watch .stage-player-info > .player-info-current', title: '.player-info-title', cls: 'player-info-desc' },
  ];
  function ensureNowLinks() {
    if (!settings.programInfo) { document.querySelectorAll('.delve-now-links').forEach(n => n.remove()); return; }
    NOW_BLOCKS.forEach(t => {
      const block = document.querySelector(t.block);
      if (!block) return;
      const chId = block.closest('.app--guide') ? highlightedChannel() : decodeURIComponent(location.pathname.split('/')[1] || '');
      const titleEl = block.querySelector(t.title);
      const title = titleEl && titleEl.textContent.trim();
      if (!chId || !title) return;
      const key = chId + '|' + title;
      if (nowCache.has(key)) return putNowLinks(block, key, t.cls);
      if (nowPending === key) return;
      nowPending = key;
      const el1 = block.querySelector('.vcr-elapsed'), el2 = block.querySelector('.vcr-remaining');
      const durSec = clockSecs(el1 && el1.textContent) + clockSecs(el2 && el2.textContent);
      findProgram(chId, title, durSec).then(found => {
        nowCache.set(key, { detail: found.detail, item: found.item });
      }).catch(() => {}).then(() => { nowPending = ''; ensureNowLinks(); });
    });
  }

  function render(info) {
    const p = ensurePanel();
    if (!p) return;
    p.textContent = '';
    if (lastHeight) p.style.height = lastHeight + 'px';
    root.setAttribute('data-delve-prog', '1');
    root.removeAttribute('data-delve-loading');
    const { c, start, end, found } = info;
    const ch = found && found.ch, item = found && found.item, detail = (found && found.detail) || {};

    const now = el('div', 'delve-prog-now');
    const top = el('div', 'delve-prog-labelrow');
    // A program actually playing in the preview is labelled like the site's block.
    const siteTitle = (document.querySelector('.app--guide .stage-info-col > .guide-info-now .guide-info-now-title') || {}).textContent;
    const playing = statusText(start, end) === 'On now' && progState && progState.channelId === highlightedChannel() &&
      !!siteTitle && [c.title, item && item.title].some(t => t && t.trim() === siteTitle.trim());
    top.append(el('div', 'guide-info-now-label', playing ? 'Now playing' : (statusText(start, end) || 'Program')));

    const titleRow = el('div', 'guide-info-now-title-row');
    titleRow.append(el('div', 'guide-info-now-title', (item && item.title) || c.title));
    const year = (item && item.year) || c.year;
    if (year) titleRow.append(el('span', 'btag btag-ghost', year));
    if (detail.season != null && detail.episode != null) titleRow.append(el('span', 'btag btag-ghost', 'S' + detail.season + ' E' + detail.episode));

    const bits = [];
    if (start && end) bits.push(fmtTime(start) + ' – ' + fmtTime(end));
    const secs = (item && item.duration) || c.durSec || (start && end ? (end - start) / 1000 : 0);
    if (secs) bits.push(fmtDur(secs));
    if (ch && ch.name) bits.push(ch.name);
    const meta = el('div', 'guide-info-now-desc', bits.join('  ·  '));
    const chHead = buildChannelHead(progState && progState.channelId, ch);
    if (chHead) { p.append(chHead.head); if (chHead.desc) p.append(chHead.desc); }
    root.toggleAttribute('data-delve-hdr', !!chHead);
    now.append(top, titleRow, meta);
    p.append(now);

    if (c.marathon) {
      const mar = parseMarathon(c.tip);
      if (mar.shows.length) {
        now.append(el('div', 'guide-info-now-desc', (mar.head || 'Marathon block') + ':'));
        const list = el('div', 'guide-info-upcoming');
        mar.shows.forEach(s => {
          const row = el('div', 'guide-info-upcoming-item');
          const det = el('div', 'guide-info-upcoming-details');
          det.append(el('span', 'guide-info-upcoming-title', s.title));
          row.append(el('span', 'guide-info-upcoming-time', s.time), det);
          list.append(row);
        });
        p.append(list);
      } else {
        now.append(el('div', 'guide-info-now-desc', ((ch && ch.description) ? ch.description + ' ' : '') + 'A back-to-back block of programs.'));
      }
    } else {
      let descText;
      if (info.loading) descText = 'Loading details…';
      else if (info.error) descText = 'Could not load details for this program.';
      else if (detail.description) descText = detail.description;
      else descText = (ch && ch.description) || 'No description available.';
      now.append(el('div', 'guide-info-now-desc', descText));
    }

    const links = makeLinks(detail, item);
    if (links) now.append(links);
    // "Back to now playing" link on its own line above the status label.
    const backRow = el('div', 'guide-info-now-desc delve-prog-links delve-prog-backrow');
    const back = el('a', null, '<< Now Playing');
    back.href = '#';
    back.addEventListener('click', e => { e.preventDefault(); closePanel(); });
    backRow.append(back);
    now.prepend(backRow);
  }

  function markCell(cell) {
    document.querySelectorAll('[data-delve-sel]').forEach(n => n.removeAttribute('data-delve-sel'));
    if (cell) cell.setAttribute('data-delve-sel', '1');
    const wd = cell && wideCellData.get(cell);
    wideSel = wd ? { id: wd.id, s: wd.s } : null;
  }

  function closePanel() {
    openToken++;
    progState = null;
    lastInfo = null;
    root.removeAttribute('data-delve-loading');
    root.removeAttribute('data-delve-prog');
    root.removeAttribute('data-delve-hdr');
    if (panel && panel.parentNode) panel.parentNode.removeChild(panel);
    const heldCol = document.querySelector('.app--guide .stage-info-col');
    if (heldCol) heldCol.style.flexBasis = '';   // F26: release the Split hold (see reserveStageHeight)
    markCell(null);   // also clears wideSel
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  // Close when the tuned channel changes some other way, or when the guide view is left.
  // Moving to the clicked program's own channel (the second click) is fine.
  function pollSelection() {
    if (!progState) return;
    if (!document.querySelector('.app--guide .tv-grid')) return closePanel();
    const cur = highlightedChannel();
    if (cur === progState.baseline) return;
    if (cur === progState.channelId) { progState.baseline = cur; return; }
    closePanel();
  }

  // Keep the stage the same height: measure what is about to be hidden.
  function reserveStageHeight() {
    const col = document.querySelector('.app--guide .stage-info-col');
    if (!col || progState) return;
    let h = 0;
    ['.guide-info-channel-header', '.guide-info-description', '.guide-info-now', '.guide-upcoming-divider', '.guide-info-upcoming']
      .forEach(sel => { const n = col.querySelector(':scope > ' + sel); if (n) h += n.offsetHeight; });
    if (h > 60) lastHeight = h;
    // (F26) Split sizes the info column from its content, so a shorter program card would resize the column and make the video jump:
    // hold the column at its current height while a card is open (it can still shrink in a short window).
    if (root.getAttribute('data-delve-layout') === 'split') col.style.flexBasis = col.offsetHeight + 'px';
  }

  async function openFor(cell, tuned) {
    const row = cell.closest('.grid-row');
    const channelId = row && row.dataset.channel;
    if (!channelId) return;
    reserveStageHeight();
    let c, start = null, end = null;
    const wd = wideCellData.get(cell);
    if (wd) {   // a cell of the wider view: everything about it is already known
      c = { title: wd.title, year: wd.year, durSec: wd.dur, left: NaN, width: NaN, marathon: false, tip: '' };
      start = new Date(wd.s); end = new Date(wd.e);
    } else {
      c = readCell(cell);
      const map = makeTimeMapper();
      if (map && !isNaN(c.left) && !isNaN(c.width)) {
        end = map(c.left + c.width);
        start = (c.left > 0.05 || c.marathon || !c.durSec) ? map(c.left) : new Date(end.getTime() - c.durSec * 1000);
      }
    }
    // Second click on the card already shown: nothing to load, just drop the hint.
    if (tuned && lastInfo && lastInfo.cell === cell && !root.hasAttribute('data-delve-loading')) {
      progState = { channelId, baseline: highlightedChannel() };
      lastInfo.info = Object.assign({}, lastInfo.info, { tuned: true });
      // After the site has handled this same click (it redraws the info column when it tunes).
      setTimeout(() => { if (progState) render(lastInfo.info); }, 0);
      return;
    }
    const token = ++openToken;
    progState = { channelId, baseline: highlightedChannel() };
    markCell(cell);
    // Whatever is on show (the site's block or the previous card) stays, under a dark layer, until the data arrives.
    root.setAttribute('data-delve-loading', '1');
    if (!pollTimer) pollTimer = setInterval(pollSelection, 400);
    const show = info => {
      if (token !== openToken) return;
      lastInfo = { cell, info };
      render(info);
    };
    try {
      if (c.marathon) {
        const l = await getLineup();
        const ch = (l.channels || []).find(x => x.id === channelId) || null;
        show({ c, start, end, found: { ch, item: null, detail: null }, tuned });
      } else {
        const found = await findProgram(channelId, c.title, c.durSec);
        show({ c, start, end, found, tuned });
      }
    } catch (e) {
      show({ c, start, end, error: !c.marathon, found: c.marathon ? { ch: null, item: null, detail: null } : null, tuned });
    }
  }

  // Capture phase: the first click never reaches the site, so the preview does not change.
  document.addEventListener('click', e => {
    if (dragClickPending) { dragClickPending = false; e.stopPropagation(); e.preventDefault(); return; }   // the end of a drag, not a click
    const t = e.target;
    if (!t || !t.closest || t.closest('.delve-star')) return;
    const siteRowInfo = id => document.querySelector(':is(.app--guide, .app--watch:not(.app--channel)) .tv-grid > .tv-grid-body > .grid-row[data-channel="' + CSS.escape(id) + '"] .grid-channel-info');
    // Wider view: a click on a channel selects it on the site, as a click on the site's own row does.
    const wInfo = t.closest('.delve-wide-row > .grid-channel-info');
    if (wInfo) {
      e.stopPropagation(); e.preventDefault();
      const si = siteRowInfo(wInfo.parentNode.dataset.channel);
      if (progState) closePanel();
      if (si) si.click();
      return;
    }
    // Wider view in watch mode: no info card there (as on the site), a click on a program tunes its channel.
    const wcell = t.closest('.delve-wide-row .grid-program');
    if (wcell && (!wcell.closest('.app--guide') || !settings.programInfo)) {   // (also in the guide view when Program information is off)
      e.stopPropagation(); e.preventDefault();
      const si = siteRowInfo(wcell.closest('.grid-row').dataset.channel);
      if (si) si.click();
      return;
    }
    const cell = t.closest('.app--guide .grid-program');
    if (cell && cell.closest('.delve-wide-row')) {   // Wider view in the guide view: first click info only, second click tunes
      e.stopPropagation(); e.preventDefault();
      const second = cell.hasAttribute('data-delve-sel');
      openFor(cell, second);
      if (second) { const si = siteRowInfo(cell.closest('.grid-row').dataset.channel); if (si) si.click(); }
      return;
    }
    if (cell && settings.programInfo) {
      if (!cell.hasAttribute('data-delve-sel')) {
        e.stopPropagation(); e.preventDefault();
        openFor(cell, false);
        return;
      }
      openFor(cell, true);   // second click on the same card: the site tunes
      return;
    }
    if (progState && t.closest('.app--guide .grid-row')) closePanel();
  }, true);

  // ---------------------------------------------------------------------------
  // Guide toolbar: Favorites and Sort at the top of the guide, plus a star on every channel. Guide view only.
  // Channels are hidden / re-ordered with an attribute and CSS `order`, so the site's elements are never moved or rebuilt.
  // ---------------------------------------------------------------------------
  const BAR_CSS = `
.delve-bar { position: sticky; top: 0; z-index: 8; flex: 0 0 auto; box-sizing: border-box; height: 52px; padding: 8px; display: flex; align-items: center; gap: 8px; background: inherit; }
.delve-bar button { min-height: 36px; padding: 0 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; cursor: pointer; }
.delve-bar .delve-select { display: inline-block; width: auto; min-width: 190px; }
.delve-zoom { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; }
.delve-zoom-name { margin-right: 4px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
.delve-bar .delve-zoom-btn { width: 36px; padding: 0; font-size: 20px; line-height: 1; text-transform: none; }
.delve-zoom-label { display: inline-block; width: 56px; text-align: center; font-weight: 700; letter-spacing: 1px; color: var(--8s-yellow, #ffd740); }
.delve-bar button:disabled { opacity: .4; cursor: default; }
.delve-bar [hidden] { display: none !important; }
/* Phone: everything must fit in 355 px (B1). The sort box takes what is left; the "Window" caption goes. */
@media (max-width: 480px) {
  .delve-bar button { padding: 0 8px; letter-spacing: 0; }
  .delve-bar .delve-select { min-width: 0; flex: 1 1 0; width: 0; }
  .delve-bar .delve-zoom-name, .delve-bar .delve-fav-label { display: none; }
  .delve-zoom { gap: 4px; }
  .delve-zoom-label { width: 40px; }
}
html[data-delve-bar] :is(.app--guide, .app--watch:not(.app--channel)) .tv-grid .grid-time-header { top: 52px; }
:is(.app--guide, .app--watch:not(.app--channel)) .grid-time-header { order: -1; }
:is(.app--guide, .app--watch:not(.app--channel)) .grid-row[data-delve-hide] { display: none !important; }
.delve-star { flex: 0 0 auto; align-self: center; width: 16px; height: 28px; margin: 0 0 0 -2px; padding: 0; border: 0; background: transparent; cursor: pointer; font-size: 16px; line-height: 28px; color: inherit; opacity: .35; }
.delve-star:hover { opacity: 1; }
.delve-star.on { opacity: 1; color: var(--8s-yellow, #ffd740); }
.delve-bar button:focus-visible, .delve-bar select:focus-visible, .delve-star:focus-visible { outline: 2px solid var(--cyan, #00ccdd); outline-offset: 2px; }
`;

  const guideRows = () => Array.from(document.querySelectorAll(':is(.app--guide, .app--watch:not(.app--channel)) .tv-grid .grid-row'));
  const isFav = id => settings.favorites.indexOf(id) !== -1;
  function toggleFav(id) {
    const f = settings.favorites.slice();
    const i = f.indexOf(id);
    if (i === -1) f.push(id); else f.splice(i, 1);
    setSettings({ favorites: f });
    ensureGuide();
  }

  let bar = null, favBtn = null, sortSel = null, wideNote = null, zoomOut = null, zoomIn = null, zoomLbl = null, nowBtn = null, zoomBoxEl = null;
  function buildBar() {
    const b = el('div', 'delve-bar');
    favBtn = el('button', 'delve-favbtn popup-toggle-btn');
    favBtn.append('★', el('span', 'delve-fav-label', ' Favorites'));   // the label hides on phones (see BAR_CSS)
    favBtn.title = 'Favorites only';
    favBtn.type = 'button';
    favBtn.addEventListener('click', () => { setSettings({ favOnly: !settings.favOnly }); ensureGuide(); });
    sortSel = el('select', 'delve-select bbtn bbtn-outline');
    sortSel.setAttribute('aria-label', 'Sort channels');
    Object.keys(SORTS).forEach(k => { const o = el('option', null, (window.matchMedia('(max-width: 480px)').matches ? '' : 'Sort: ') + SORTS[k]); o.value = k; sortSel.append(o); });
    sortSel.addEventListener('change', () => { setSettings({ sort: sortSel.value }); ensureGuide(); });
    wideNote = el('span', 'delve-bar-note');
    // Time window: [-] 3h [+]. The label has a fixed width so the bar never shifts.
    const zoomBox = zoomBoxEl = el('span', 'delve-zoom');
    zoomOut = el('button', 'delve-zoom-btn bbtn bbtn-outline', '−');
    zoomOut.type = 'button'; zoomOut.setAttribute('aria-label', 'Show less time');
    zoomIn = el('button', 'delve-zoom-btn bbtn bbtn-outline', '+');
    zoomIn.type = 'button'; zoomIn.setAttribute('aria-label', 'Show more time');
    zoomLbl = el('span', 'delve-zoom-label');
    zoomLbl.setAttribute('aria-live', 'polite');
    const stepZoom = dir => {
      const i = ZOOMS.indexOf(settings.zoom) + dir;
      if (i < 0 || i >= ZOOMS.length) return;
      setSettings({ zoom: ZOOMS[i] });
      ensureGuide();
    };
    zoomOut.addEventListener('click', () => stepZoom(-1));
    zoomIn.addEventListener('click', () => stepZoom(1));
    zoomBox.append(el('span', 'delve-zoom-name', 'Window'), zoomOut, zoomLbl, zoomIn);
    // Now: only shown while the Now line is out of view
    nowBtn = el('button', 'delve-nowbtn bbtn bbtn-outline', 'Now');
    nowBtn.type = 'button'; nowBtn.hidden = true;
    nowBtn.addEventListener('click', () => scrollWideToNow(true));
    b.append(favBtn, sortSel, nowBtn, wideNote, zoomBox);
    return b;
  }
  // The sort in effect: Channel # when the Sort feature is off, or when "Favorites first" is chosen but Favorites is off.
  const effectiveSort = () => !settings.sortOn ? 'dial' : (settings.sort === 'favorites' && !settings.favoritesOn ? 'dial' : settings.sort);

  function ensureBar() {
    const grid = document.querySelector(':is(.app--guide, .app--watch:not(.app--channel)) .tv-grid');
    // With every tool switched off there is nothing to put on the bar, so there is no bar.
    if (!grid || !(settings.favoritesOn || settings.sortOn || settings.extended)) {
      if (bar && bar.parentNode) bar.remove();
      root.removeAttribute('data-delve-bar');
      return;
    }
    if (!bar) bar = buildBar();
    if (grid.firstElementChild !== bar) grid.insertBefore(bar, grid.firstChild);
    root.setAttribute('data-delve-bar', '1');
    favBtn.hidden = !settings.favoritesOn;
    sortSel.hidden = !settings.sortOn;
    zoomBoxEl.hidden = !settings.extended;
    const favOpt = sortSel.querySelector('option[value="favorites"]');
    if (favOpt) { favOpt.disabled = !settings.favoritesOn; favOpt.hidden = !settings.favoritesOn; }
    favBtn.classList.toggle('popup-toggle-btn--on', settings.favOnly);
    favBtn.setAttribute('aria-pressed', String(settings.favOnly));
    if (sortSel.value !== effectiveSort()) sortSel.value = effectiveSort();
    const zi = ZOOMS.indexOf(settings.zoom);
    if (zoomLbl.textContent !== zoomText(settings.zoom)) zoomLbl.textContent = zoomText(settings.zoom);
    zoomOut.disabled = zi <= 0; zoomIn.disabled = zi >= ZOOMS.length - 1;
    const note = settings.extended && wide.status === 'failed' ? 'Wider view is unavailable (the site changed or did not answer).' : '';
    if (wideNote.textContent !== note) wideNote.textContent = note;
  }

  function ensureStars(rows) {
    if (!settings.favoritesOn) { document.querySelectorAll('.delve-star').forEach(n => n.remove()); return; }
    rows.forEach(row => {
      const info = row.querySelector('.grid-channel-info');
      if (!info) { warnMissing('.grid-channel-info', 'Favorites'); return; }
      let star = info.querySelector(':scope > .delve-star');
      if (!star) {
        star = el('button', 'delve-star');
        star.type = 'button';
        star.textContent = '★';
        info.prepend(star);   // left of the channel number
      }
      const on = isFav(row.dataset.channel);
      star.classList.toggle('on', on);
      star.setAttribute('aria-pressed', String(on));
      const label = on ? 'Remove from favorites' : 'Add to favorites';
      if (star.title !== label) { star.title = label; star.setAttribute('aria-label', label); }
    });
  }

  function applyFilter(rows) {
    rows.forEach(row => {
      const hide = settings.favoritesOn && settings.favOnly && !isFav(row.dataset.channel);
      if (hide !== row.hasAttribute('data-delve-hide')) row.toggleAttribute('data-delve-hide', hide);
    });
  }

  let orderSig = '';
  const rowViewers = row => {
    const v = row.querySelector('.grid-channel-viewers');
    if (!v) return 0;
    return parseInt(((v.getAttribute('title') || v.textContent) + '').replace(/[^\d]/g, ''), 10) || 0;
  };
  const rowName = row => (((row.querySelector('.grid-channel-name-text') || {}).textContent) || row.dataset.channel || '').trim().toLowerCase();
  function applyOrder(rows) {
    const sortKey = effectiveSort();
    const sig = [sortKey, settings.favorites.join(','), rows.map(r => r.dataset.channel).join(',')].join('|');
    if (sig === orderSig) return;
    orderSig = sig;
    let style = document.getElementById('delve-order');
    if (sortKey === 'dial') { if (style) style.textContent = ''; return; }
    if (!style) {
      style = document.createElement('style');
      style.id = 'delve-order';
      (document.head || root).appendChild(style);
    }
    const seen = new Set();   // the wider view repeats every channel: one order per channel
    const items = rows.filter(r => !seen.has(r.dataset.channel) && seen.add(r.dataset.channel))
      .map((row, i) => ({ id: row.dataset.channel, i, name: rowName(row), viewers: rowViewers(row), fav: isFav(row.dataset.channel) ? 0 : 1 }));
    const cmp = {
      name: (a, b) => a.name.localeCompare(b.name) || a.i - b.i,
      viewers: (a, b) => b.viewers - a.viewers || a.i - b.i,
      favorites: (a, b) => a.fav - b.fav || a.i - b.i,
    }[sortKey];
    items.sort(cmp);
    style.textContent = items.map((it, n) => ':is(.app--guide, .app--watch:not(.app--channel)) .grid-row[data-channel="' + CSS.escape(it.id) + '"]{order:' + (n + 1) + '}').join('\n');
  }

  // ---------------------------------------------------------------------------
  // Wider view. The guide shows 12 hours before and after now, scrolling sideways, opening 30 minutes before now. Programs
  // come from the site's own scheduling code: a helper runs in the page's world, imports the site's main script, and
  // answers with every channel's rows as JSON. The view is drawn with the site's row and cell classes.
  // ---------------------------------------------------------------------------
  const HOUR = 3600000;
  const WIDE_BACK_H = 12, WIDE_AHEAD_H = 12;
  const WIDE_STEP_H = 24, WIDE_MAX_H = 48, WIDE_STALE_MS = 2 * HOUR;   // grow 24 h at a time, up to 2 days each way
  // from / to: range the loaded rows cover (ms); base: when the view was first loaded (the limit counts from it)
  const wide = { status: 'idle', data: null, base: 0, from: 0, to: 0, extending: false, extFailUntil: 0, t0: 0, pxh: 0, infoW: 0, sig: '' };
  const wideCellData = new WeakMap();   // program cell -> { id, s, e, title, year, dur, aid }
  let wideRoot = null;

  // Runs in the page (see injectSiteHelper); self-contained because it is serialized to text.
  function siteHelper() {
    if (window.__delveSite) return;
    window.__delveSite = true;
    var api = null;
    function reply(payload) {
      var box = document.getElementById('delve-site-data');
      if (!box) { box = document.createElement('script'); box.type = 'application/json'; box.id = 'delve-site-data'; document.documentElement.appendChild(box); }
      box.textContent = JSON.stringify(payload);
      document.dispatchEvent(new CustomEvent('delve-site-res', { detail: String(payload.id) }));
    }
    async function find() {
      if (api) return api;
      var tag = Array.prototype.find.call(document.querySelectorAll('script[src]'), function (s) { return /\/assets\/index-[^/]+\.js/.test(s.src); });
      var url = tag ? tag.src : performance.getEntriesByType('resource').map(function (e) { return e.name; }).find(function (n) { return /\/assets\/index-[^/?]+\.js/.test(n); });
      if (!url) throw new Error('site script not found');
      var m = await import(url);
      var vals = Object.keys(m).map(function (k) { return m[k]; });
      var sched = vals.find(function (v) { return typeof v === 'function' && /nowSeconds/.test(v) && /maxRows/.test(v) && /hours/.test(v); });
      var chans = vals.find(function (v) { return Array.isArray(v) && v.length > 3 && v[0] && typeof v[0] === 'object' && 'id' in v[0] && 'playlist' in v[0]; });
      var load = vals.find(function (v) { return typeof v === 'function' && /\.playlist\?Promise\.resolve\(/.test(v); });
      if (!sched || !chans || !load) throw new Error('site functions not found');
      api = { sched: sched, chans: chans, load: load };
      return api;
    }
    document.addEventListener('delve-site-req', async function (e) {
      var req;
      try { req = JSON.parse(e.detail); } catch (x) { return; }
      try {
        var a = await find();
        var list = a.chans.filter(function (c) { return c && !c.comingSoon; });
        await Promise.allSettled(list.map(function (c) { return a.load(c); }));
        var out = {};
        list.forEach(function (c) {
          if (!c.playlist) return;
          try {
            var r = a.sched(c.playlist, { nowSeconds: req.from / 1000, hours: req.hours, maxRows: 600 });
            out[c.id] = r.rows.map(function (x) { return [x.startTime.getTime(), x.endTime.getTime(), x.item.title, x.item.year || '', Math.round(x.item.duration || 0), x.item.id || '']; });
          } catch (x) { /* this channel is left out */ }
        });
        reply({ id: req.id, ok: Object.keys(out).length > 0, channels: out, err: Object.keys(out).length ? '' : 'no channels' });
      } catch (x) { reply({ id: req.id, ok: false, err: String((x && x.message) || x) }); }
    });
  }
  function injectSiteHelper() {
    if (root.hasAttribute('data-delve-helper')) return;
    root.setAttribute('data-delve-helper', '1');
    try {
      const s = document.createElement('script');
      s.textContent = '(' + siteHelper.toString() + ')();';
      (document.head || root).appendChild(s);
      s.remove();
    } catch (e) { /* blocked: the view reports itself unavailable */ }
  }
  let siteReq = 0;
  function siteRequest(from, hours) {
    injectSiteHelper();
    return new Promise((resolve, reject) => {
      const id = String(++siteReq);
      const done = fn => { clearTimeout(timer); document.removeEventListener('delve-site-res', on); fn(); };
      const on = e => {
        if (e.detail !== id) return;
        const box = document.getElementById('delve-site-data');
        let res = null;
        try { res = JSON.parse(box.textContent); } catch (x) { /* bad reply */ }
        done(() => res && res.id === id ? resolve(res) : reject(new Error('bad reply')));
      };
      const timer = setTimeout(() => done(() => reject(new Error('timeout'))), 20000);
      document.addEventListener('delve-site-res', on);
      document.dispatchEvent(new CustomEvent('delve-site-req', { detail: JSON.stringify({ id, from, hours }) }));
    });
  }

  const WIDE_CSS = `
html[data-delve-wide] :is(.app--guide, .app--watch:not(.app--channel)) .tv-grid { position: relative; overflow-x: auto; }
html[data-delve-wide] :is(.app--guide, .app--watch:not(.app--channel)) .tv-grid > .tv-grid-body { position: absolute; left: 0; right: 0; top: 0; height: 0; overflow: hidden; visibility: hidden; pointer-events: none; }
/* In watch mode the page scrolls and the guide is as tall as its content. Wide gives every guide "flex: 1 1 0", which
   shrinks it to nothing with the site's rows out of flow, so size it by content. */
html[data-delve-wide] .app--watch:not(.app--channel) .tv-grid { flex: 0 0 auto; }
/* Guide text is not selectable (as on the site). */
.delve-wide-body, .delve-wide-body *, .delve-bar { -webkit-user-select: none; user-select: none; }
.delve-dragging, .delve-dragging * { cursor: grabbing !important; }
.delve-bar { left: 0; }
.delve-bar-note { margin-left: 8px; opacity: .85; font-size: 12px; }
.delve-wide-body { position: relative; display: flex; flex-direction: column; flex: 0 0 auto; width: var(--dw-w); }
.delve-wide-body > .grid-time-header { display: flex; position: sticky; z-index: 6 !important; }   /* the theme sets z-index 3 with a more specific rule, below the channel cells (4) */
.delve-wide-body > .grid-time-header > .grid-time-label-cell { position: sticky; left: 0; z-index: 6; flex: 0 0 var(--dw-info); width: var(--dw-info); box-sizing: border-box; }
.delve-wide-body > .grid-time-header > .grid-time-axis { flex: 0 0 var(--dw-track); width: var(--dw-track); position: relative; }
.delve-wide-body .grid-time-axis .grid-time-label { position: absolute; }
.delve-wide-row.grid-row { display: flex; }
/* Layout containment: while the page animates a mode change the site resizes the guide every frame, and without this the
   browser re-lays-out every cell (and sticky title) each frame. Measured: guide -> watch dropped from ~27 ms to 8 ms per frame. */
/* Layout containment makes each row its own stacking layer, so a line drawn once across the guide (Now line, day lines)
   would paint over the channel cells. Style containment alone doubles the mode-change cost (frame gaps 94-146 ms vs 48-83 ms),
   so those lines are drawn per row inside the track: above programs, below the channel cell. */
.delve-wide-row { contain: layout style; }
.delve-wide-row .grid-program { contain: layout style paint; }
/* Each row's track is 20,000+ px wide with hundreds of cells; the browser skips cells far outside the scroll view.
   Measured: building the guide dropped from ~110 ms to 38 ms. The intrinsic size keeps the scroll width unchanged. */
.delve-wide-row .grid-programs { content-visibility: auto; contain-intrinsic-size: auto var(--dw-track) 44px; }
.delve-wide-row > .grid-channel-info { position: sticky; left: 0; z-index: 4; flex: 0 0 var(--dw-info); width: var(--dw-info); box-sizing: border-box; }
/* Sticky channel cells and the hour row's corner must be solid, or scrolling programs show through. The guide's background
   is a fixed vertical gradient, so a solid layer under each channel cell repeats it pinned to the guide's box (under the
   cell, so the site's hover and highlight colors still paint over it). The layer is one pixel taller than the cell and ends
   in the row separator so nothing shows through between cells. */
.delve-wide-body > .grid-time-header > .grid-time-label-cell { background: var(--dw-head-bg, #200057); }
.delve-wide-under { position: sticky; left: 0; z-index: 3; flex: 0 0 var(--dw-info); width: var(--dw-info); margin-right: calc(var(--dw-info) * -1); margin-bottom: -1px; align-self: stretch; box-sizing: border-box; border-bottom: 1px solid var(--dw-line, #000a30);
  background-color: #001040; background-image: var(--dw-grid-bg, none); background-attachment: fixed; background-size: var(--dw-gw) var(--dw-gh); background-position: var(--dw-gleft) var(--dw-gtop); }
.delve-wide-row > .grid-programs { flex: 0 0 var(--dw-track); width: var(--dw-track); position: relative; align-self: stretch; }
.delve-wide-row .grid-program.delve-past { opacity: .5; }
/* The playing program stands out: yellow fill and title. */
.delve-wide-row .grid-program.current { background: rgba(255, 230, 0, .16) !important; }   /* !important: the theme colours the playing cell with a more specific rule */
.delve-wide-row .grid-program.current .grid-program-title { color: var(--8s-yellow, #ffd740) !important; }
/* Titles stay in view: the text block is sticky just right of the channel column. Cells and tracks use "overflow: clip"
   so they are not scroll containers and sticky still follows the guide's scroll. */
.delve-wide-row > .grid-programs, .delve-wide-row .grid-program { overflow: clip; }
.delve-cell-text { position: sticky; left: calc(var(--dw-info) + 10px); align-self: flex-start; max-width: 100%; width: max-content; min-width: 0; display: flex; flex-direction: column; }
.delve-cell-text > * { min-width: 0; }
.delve-wide-day { position: absolute; top: 0; bottom: 0; width: 1px; z-index: 1; pointer-events: none; background: rgba(255, 255, 255, .35); }
`;

  const clockText = sec => {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60;
    return h ? h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') : m + ':' + String(s).padStart(2, '0');
  };
  const hourLabel = d => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const dayLabel = d => d.toLocaleDateString([], { weekday: 'short', month: 'numeric', day: 'numeric' }).replace(',', '').toUpperCase();

  function loadWide() {
    if (wide.status === 'loading') return;
    wide.status = 'loading';
    const base = Date.now();
    siteRequest(base - WIDE_BACK_H * HOUR, WIDE_BACK_H + WIDE_AHEAD_H).then(res => {
      if (!res.ok) throw new Error(res.err || 'no data');
      wide.data = {}; mergeWide(res.channels);
      wide.base = base; wide.from = base - WIDE_BACK_H * HOUR; wide.to = base + WIDE_AHEAD_H * HOUR;
      wide.status = 'ready'; wide.sig = '';
    }).catch(err => {
      console.warn('[delve] wider view unavailable:', err && err.message);
      wide.status = 'failed'; wide.failedAt = Date.now();
    }).then(() => ensureGuide());
  }

  // Add rows to what is held, one row per start time per channel.
  function mergeWide(chs) {
    Object.keys(chs).forEach(id => {
      const have = wide.data[id] || [];
      const seen = new Set(have.map(r => r[0]));
      chs[id].forEach(r => { if (!seen.has(r[0])) { have.push(r); seen.add(r[0]); } });
      have.sort((a, b) => a[0] - b[0]);
      wide.data[id] = have;
    });
  }

  // Scrolling near an end asks for another 24 hours in that direction (up to 2 days each way from `base`).
  function extendWide(dir) {
    if (wide.status !== 'ready' || wide.extending || Date.now() < wide.extFailUntil) return;
    let from, hours, nf = wide.from, nt = wide.to;
    if (dir < 0) {
      if (wide.from <= wide.base - WIDE_MAX_H * HOUR) return;
      nf = Math.max(wide.base - WIDE_MAX_H * HOUR, wide.from - WIDE_STEP_H * HOUR);
      from = nf; hours = (wide.from - nf) / HOUR + 1;          // one hour of overlap
    } else {
      if (wide.to >= wide.base + WIDE_MAX_H * HOUR) return;
      nt = Math.min(wide.base + WIDE_MAX_H * HOUR, wide.to + WIDE_STEP_H * HOUR);
      from = wide.to - HOUR; hours = (nt - wide.to) / HOUR + 1;
    }
    wide.extending = true;
    siteRequest(from, hours).then(res => {
      if (!res.ok) throw new Error(res.err || 'no data');
      mergeWide(res.channels);
      wide.from = nf; wide.to = nt; wide.sig = '';
    }).catch(err => {
      console.warn('[delve] could not load more of the wider view:', err && err.message);
      wide.extFailUntil = Date.now() + 60000;
    }).then(() => { wide.extending = false; ensureGuide(); });
  }
  // Click and drag scrolls the guide: moving the mouse with the button held moves the guide (sideways, and vertically where
  // the guide scrolls). A drag does not count as a click on what is under the mouse.
  let dragClickPending = false;
  (function installDrag() {
    let st = null;
    document.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || !wideRoot) return;
      const t = e.target;
      if (!t.closest || !t.closest('.delve-wide-body') || t.closest('a, button, input, select, textarea, .delve-star')) return;
      const grid = wideRoot.parentNode;
      st = { x: e.clientX, y: e.clientY, l: grid.scrollLeft, t: grid.scrollTop, moved: false, grid };
    }, true);
    document.addEventListener('pointermove', e => {
      if (!st) return;
      const dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (!st.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      st.moved = true;
      root.classList.add('delve-dragging');
      if (nowLocked && Math.abs(dx) >= 5) unlockNow();   // sideways drag breaks the lock
      if (!nowLocked) st.grid.scrollLeft = st.l - dx;
      st.grid.scrollTop = st.t - dy;
    }, true);
    const end = () => {
      if (!st) return;
      const moved = st.moved;
      st = null;
      root.classList.remove('delve-dragging');
      if (moved) { dragClickPending = true; setTimeout(() => { dragClickPending = false; }, 80); }   // swallow the click that follows the release
    };
    document.addEventListener('pointerup', end, true);
    document.addEventListener('pointercancel', end, true);
    window.addEventListener('blur', end);
  })();

  // Now lock: the view follows the Now line until the user scrolls sideways.
  let nowLocked = true, lockAnimUntil = 0;
  function unlockNow() { if (nowLocked) { nowLocked = false; updateNowBtn(); } }
  document.addEventListener('wheel', e => {   // slow sideways wheel / trackpad moves are too small to notice from the position alone
    if (!nowLocked || !wideRoot || !e.target.closest || !e.target.closest('.delve-wide-body')) return;
    if (e.deltaX !== 0 && Math.abs(e.deltaX) >= Math.abs(e.deltaY) || e.shiftKey) unlockNow();
  }, { capture: true, passive: true });

  let wideScrollGrid = null;
  function onWideScroll() {
    const g = wideScrollGrid;
    if (!wideRoot || !g) return;
    if (nowLocked && performance.now() > lockAnimUntil && Math.abs(g.scrollLeft - wideNowLeft()) > 2) nowLocked = false;
    ensureCells(g, false);
    updateNowBtn();
    const thr = g.clientWidth;                                  // within one screen of an end
    if (g.scrollLeft < thr) extendWide(-1);
    else if (g.scrollWidth - g.clientWidth - g.scrollLeft < thr) extendWide(1);
  }

  function removeWide() {
    if (wideRoot) { wideRoot.remove(); wideRoot = null; }
    root.removeAttribute('data-delve-wide');
    wide.sig = ''; wideUnders = []; wideBgKey = ''; wideTracks = []; wideWin = null;
  }

  // The site draws each channel logo as an SVG of up to 136 <rect>s; copied into every row that was ~4,300 elements to style
  // and lay out on every mode change. The copy shows the logo as one rasterized <img>, serialized once per distinct logo.
  const logoUrls = new Map();
  function lightInfo(info) {
    const c = info.cloneNode(true);
    c.querySelectorAll(':scope > svg').forEach(s => {
      let url = null;
      try {
        const key = s.outerHTML;
        url = logoUrls.get(key);
        if (!url) { url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(s)); logoUrls.set(key, url); }
      } catch (e) { return; }   // keep the SVG copy if it cannot be serialized
      const img = el('img', s.getAttribute('class') || '');
      img.alt = ''; img.setAttribute('aria-hidden', 'true'); img.draggable = false;
      img.width = parseFloat(s.getAttribute('width')) || 32; img.height = parseFloat(s.getAttribute('height')) || 32;
      img.style.cssText = s.getAttribute('style') || '';
      img.src = url;
      s.replaceWith(img);
    });
    return c;
  }

  function buildWide(grid, sbody) {
    const srows = Array.from(sbody.querySelectorAll(':scope > .grid-row'));
    // measure a row that is shown: rows hidden by the Favorites filter have no size
    const mrow = srows.find(r => !r.hasAttribute('data-delve-hide')) || srows[0];
    const info0 = mrow && mrow.querySelector('.grid-channel-info'), progs0 = mrow && mrow.querySelector('.grid-programs');
    if (!info0 || !progs0) {
      if (mrow) warnMissing(!info0 ? '.grid-channel-info' : '.grid-programs', 'Extended guide');
      return;
    }
    const infoW = Math.round(info0.getBoundingClientRect().width), progW = progs0.getBoundingClientRect().width;
    if (!infoW || progW < 80) return;   // not laid out yet (or caught mid-animation): try again on the next pass
    const pxh = progW / settings.zoom;           // pixels per hour
    const sig = [wide.base, wide.from, wide.to, Math.round(pxh), infoW, srows.map(r => r.dataset.channel).join(',')].join('|');
    if (sig === wide.sig && wideRoot && wideRoot.isConnected) return;
    wide.sig = sig;
    wideTracks = []; wideWin = null;

    const t0 = Math.floor(wide.from / HOUR) * HOUR;
    const t1 = Math.ceil(wide.to / HOUR) * HOUR;
    const trackW = (t1 - t0) / HOUR * pxh;
    // the time in the middle of the screen stays put when the view is rebuilt (more hours added, or a new zoom)
    const prevCenterT = wide.t0 && wideRoot ? wide.t0 + (grid.scrollLeft + wide.visW / 2) / wide.pxh * HOUR : null;

    const body = el('div', 'delve-wide-body');
    body.style.setProperty('--dw-info', infoW + 'px');
    body.style.setProperty('--dw-track', trackW + 'px');
    body.style.setProperty('--dw-w', (infoW + trackW) + 'px');
    try {   // the site's own backgrounds, copied so the sticky cells can be solid
      body.style.setProperty('--dw-head-bg', getComputedStyle(sbody.querySelector('.grid-time-header')).backgroundColor);
      body.style.setProperty('--dw-grid-bg', getComputedStyle(grid).backgroundImage);
      body.style.setProperty('--dw-line', getComputedStyle(srows[0]).borderBottomColor);
    } catch (e) { warnMissing('.grid-time-header', 'Extended guide site colors'); }

    // hour row
    const head = el('div', 'grid-time-header');
    const siteLabelCell = sbody.querySelector('.grid-time-header .grid-time-label-cell');
    head.append(siteLabelCell ? siteLabelCell.cloneNode(true) : el('div', 'grid-time-label-cell', 'CHANNEL'));
    const axis = el('div', 'grid-time-axis');
    const dayXs = [];   // day line positions (drawn in every row's track)
    // label spacing follows the zoom: the smallest step that keeps labels about 200 px apart (hourly at the site's 3 hours)
    const stepMin = [15, 30, 60, 120, 180, 360].find(m => m / 60 * pxh >= 200) || 360;
    const stepMs = stepMin * 60000;
    const dayStart = new Date(t0); dayStart.setHours(0, 0, 0, 0);
    for (let t = dayStart.getTime(); t < t1; t += stepMs) {
      if (t < t0) continue;
      const d = new Date(t), x = (t - t0) / HOUR * pxh;
      const midnight = d.getHours() === 0 && d.getMinutes() === 0;
      const lab = el('span', 'grid-time-label', midnight ? dayLabel(d) : hourLabel(d));
      lab.style.left = x + 'px';
      axis.append(lab);
      if (midnight) dayXs.push(x);
    }
    head.append(axis);
    body.append(head);

    // one row per channel, in the site's own order
    srows.forEach(srow => {
      const id = srow.dataset.channel;
      const rowEl = el('div', 'grid-row delve-wide-row');
      rowEl.dataset.channel = id;
      rowEl.append(el('div', 'delve-wide-under'));
      const info = srow.querySelector('.grid-channel-info');
      if (info) rowEl.append(lightInfo(info));
      const track = el('div', 'grid-programs');
      // cells are made on demand (ensureCells); the row keeps its programs here
      wideTracks.push({ id, track, items: (wide.data[id] || []).filter(it => it[1] > t0 && it[0] < t1), cells: new Map(), seg: null });
      dayXs.forEach(x => { const line = el('div', 'delve-wide-day'); line.style.left = x + 'px'; track.append(line); });
      rowEl.append(track);
      body.append(rowEl);
    });

    if (wideRoot) wideRoot.remove();
    grid.append(body);
    wideRoot = body;
    const visW = Math.max(1, grid.clientWidth - infoW);
    wide.t0 = t0; wide.pxh = pxh; wide.infoW = infoW; wide.visW = visW; wide.t1 = t1;
    root.setAttribute('data-delve-wide', '1');
    wideUnders = Array.from(body.querySelectorAll('.delve-wide-under')); wideBgKey = '';
    updateWideBg();
    // first time: open a little before now; after a rebuild keep the time that was in the middle of the screen
    if (prevCenterT === null) nowLocked = true;   // a fresh view starts locked to Now
    grid.scrollLeft = prevCenterT !== null && !nowLocked
      ? Math.max(0, (prevCenterT - t0) / HOUR * pxh - visW / 2)
      : wideNowLeft();
    ensureCells(grid, true);
    syncWide(true);
  }

  // Cells are made only for programs within a window around the scroll view and swapped as the view moves: the extended
  // guide holds thousands of programs, and every cell costs style and layout on each mode change. Tracks keep their full
  // width, so scroll width and cell positions don't change.
  const WIDE_BUF = 1, WIDE_EDGE = 0.35;   // screens of cells kept each side of the view; the window moves when under 0.35 screen is left
  let wideTracks = [], wideWin = null, wideSel = null;   // wideSel: { id, s } of the cell shown in the info card, kept when its cell is made again
  function makeCell(rt, it, now) {
    const s = it[0], e = it[1], id = rt.id;
    const ls = Math.max(s, wide.t0), le = Math.min(e, wide.t1);
    const c = el('div', 'grid-program');
    c.style.left = ((ls - wide.t0) / HOUR * wide.pxh) + 'px';
    c.style.width = Math.max(2, (le - ls) / HOUR * wide.pxh - 3) + 'px';
    c.title = it[2] + ' (' + clockText(it[4]) + ')';
    const ti = el('span', 'grid-program-title', it[2]);
    if (it[3]) ti.append(el('span', 'grid-program-year', it[3]));
    const txt = el('div', 'delve-cell-text');   // title and length stick to the left while the cell scrolls past
    txt.append(ti, el('span', 'grid-program-duration', clockText(it[4])));
    c.append(txt);
    c.dataset.s = s; c.dataset.e = e;
    if (e <= now) c.classList.add('delve-past');
    else if (s <= now) c.classList.add('current');
    if (wideSel && wideSel.id === id && wideSel.s === s) c.setAttribute('data-delve-sel', '1');
    wideCellData.set(c, { id, s, e, title: it[2], year: it[3], dur: it[4], aid: it[5] });
    return c;
  }
  function ensureCells(grid, force) {
    if (!wideRoot || !wideTracks.length || !grid) return;
    const vw = Math.max(1, grid.clientWidth);
    const x0 = grid.scrollLeft - wide.infoW, x1 = x0 + vw;   // the view, in the track's own pixels
    if (!force && wideWin && x0 >= wideWin.a + vw * WIDE_EDGE && x1 <= wideWin.b - vw * WIDE_EDGE) return;
    const a = x0 - vw * WIDE_BUF, b = x1 + vw * WIDE_BUF;
    wideWin = { a, b };
    const ta = wide.t0 + a / wide.pxh * HOUR, tb = wide.t0 + b / wide.pxh * HOUR, now = Date.now();
    wideTracks.forEach(rt => {
      const keep = new Set(), add = document.createDocumentFragment();
      rt.items.forEach(it => {
        if (it[1] <= ta || it[0] >= tb) return;
        keep.add(it[0]);
        if (!rt.cells.has(it[0])) { const c = makeCell(rt, it, now); rt.cells.set(it[0], c); add.append(c); }
      });
      rt.cells.forEach((c, k) => { if (!keep.has(k)) { c.remove(); rt.cells.delete(k); } });
      rt.track.append(add);
    });
  }

  // Scroll position that puts the left edge a sixth of the window before now (30 minutes at the default 3 hours).
  function wideNowLeft() {
    return Math.max(0, (Date.now() - settings.zoom * HOUR / 6 - wide.t0) / HOUR * wide.pxh);
  }
  function scrollWideToNow(smooth) {
    const grid = document.querySelector(':is(.app--guide, .app--watch:not(.app--channel)) .tv-grid');
    if (!grid || !wideRoot) return;
    nowLocked = true;
    lockAnimUntil = performance.now() + 1200;   // the scroll itself must not count as the user breaking the lock
    grid.scrollTo({ left: wideNowLeft(), behavior: smooth ? 'smooth' : 'auto' });
    updateNowBtn();
  }
  // The Now button shows while the view is not locked to the Now line.
  function updateNowBtn() {
    if (!nowBtn) return;
    if (!settings.extended) { if (!nowBtn.hidden) nowBtn.hidden = true; return; }
    const off = !!wideRoot && !nowLocked;
    if (nowBtn.hidden !== !off) nowBtn.hidden = !off;
  }
  // While locked, keep the view on the Now line as time passes (called every frame).
  function followNow() {
    if (!nowLocked || !wideRoot || !wideRoot.isConnected) return;
    const g = wideRoot.parentNode, want = wideNowLeft();
    if (performance.now() < lockAnimUntil) {
      if (Math.abs(g.scrollLeft - want) < 2) lockAnimUntil = 0;   // arrived
      return;
    }
    if (Math.abs(g.scrollLeft - want) >= 0.5) g.scrollLeft = want;
  }

  // Where the guide's box is on screen (the channel cells' background is pinned to it); changes on page scroll or resize.
  // The four numbers are set only on the per-row background layers, not the guide root: a custom property there is inherited
  // by thousands of elements (~8 ms per update vs 0.3 ms). Nothing is written when unchanged; scroll / resize events are
  // handled once per frame.
  let wideUnders = [], wideBgKey = '', wideBgQueued = false;
  function updateWideBg() {
    const grid = document.querySelector(':is(.app--guide, .app--watch:not(.app--channel)) .tv-grid');
    if (!wideRoot || !grid) return;
    const r = grid.getBoundingClientRect();
    const v = [grid.clientWidth, grid.clientHeight, r.left + grid.clientLeft, r.top + grid.clientTop];
    const key = v.join(',');
    if (key === wideBgKey) return;
    wideBgKey = key;
    wideUnders.forEach(u => {
      const st = u.style;
      st.setProperty('--dw-gw', v[0] + 'px');
      st.setProperty('--dw-gh', v[1] + 'px');
      st.setProperty('--dw-gleft', v[2] + 'px');
      st.setProperty('--dw-gtop', v[3] + 'px');
    });
  }
  const queueWideBg = () => {
    if (wideBgQueued) return;
    wideBgQueued = true;
    requestAnimationFrame(() => { wideBgQueued = false; updateWideBg(); });
  };
  window.addEventListener('scroll', queueWideBg, { passive: true });
  window.addEventListener('resize', queueWideBg);

  // Playing / finished styling, and the site's highlighted / tuned row, mirrored onto our rows.
  // Cells (thousands) are checked once a second; rows (one per channel) every time.
  let lastCellSync = 0;
  function syncWide(force) {
    if (!wideRoot) return;
    const now = Date.now();
    if (force || now - lastCellSync >= 1000) {
      lastCellSync = now;
      wideRoot.querySelectorAll('.grid-program').forEach(c => {
        const past = +c.dataset.e <= now, cur = +c.dataset.s <= now && now < +c.dataset.e;
        if (c.classList.contains('delve-past') !== past) c.classList.toggle('delve-past', past);
        if (c.classList.contains('current') !== cur) c.classList.toggle('current', cur);
      });
    }
    const site = new Map();
    document.querySelectorAll(':is(.app--guide, .app--watch:not(.app--channel)) .tv-grid > .tv-grid-body > .grid-row').forEach(r => site.set(r.dataset.channel, r));
    wideRoot.querySelectorAll(':scope > .grid-row').forEach(r => {
      const s = site.get(r.dataset.channel);
      ['highlighted', 'active'].forEach(k => { const on = !!s && s.classList.contains(k); if (r.classList.contains(k) !== on) r.classList.toggle(k, on); });
    });
  }

  let resizeQuietAt = 0, wideHoldUntil = 0;
  function ensureWide() {
    if (Date.now() < wideHoldUntil) return;   // a mode change is animating: touch nothing until it finishes, then build once at the final size
    if (wideRoot && Date.now() < resizeQuietAt) return;   // the window is being resized: keep what is there until it stops
    const grid = document.querySelector(':is(.app--guide, .app--watch:not(.app--channel)) .tv-grid');
    const sbody = grid && grid.querySelector(':scope > .tv-grid-body');
    if (!sbody || !settings.extended) {   // not on the guide view, or the extended guide is switched off
      if (wideRoot || root.hasAttribute('data-delve-wide')) removeWide();
      return;
    }
    if (wide.status === 'failed' && Date.now() - (wide.failedAt || 0) > 60000) wide.status = 'idle';   // try again after a minute
    // Turned on again after a long time away: what was held is out of date, start again.
    if (wide.status === 'ready' && !wideRoot && Date.now() - wide.base > WIDE_STALE_MS) { wide.status = 'idle'; wide.data = null; }
    if (wide.status === 'idle') { loadWide(); return; }
    if (wide.status === 'failed') return;
    if (wide.data) buildWide(grid, sbody);
    // the clock is nearing the end of the loaded range: extend
    if (wideRoot && Date.now() > wide.to - 2 * HOUR) extendWide(1);
    if (wideRoot && wideScrollGrid !== grid) {
      if (wideScrollGrid) wideScrollGrid.removeEventListener('scroll', onWideScroll);
      wideScrollGrid = grid;
      grid.addEventListener('scroll', onWideScroll, { passive: true });
    }
  }

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

  function ensureGuide() {
    ensureBar();
    ensureWide();
    updatePan();
    const rows = guideRows();
    if (!rows.length) return;
    ensureStars(rows);
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
    if (appEl.classList.contains('app--guide')) { if (rows.length === 3 && rows[1] > 0) L.h = rows[1]; }
    else L.h = window.innerHeight - (appEl.classList.contains('app--channel') ? 100 : 64);   // the heights the Watch and Channel rules above give the stage
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

  let pending = false;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false; checkRoute(); trackApp(); trackStage(); checkMode(); ensureButtons();
      if (progState && lastInfo && panel && !panel.isConnected) render(lastInfo.info);   // the site redrew the column
      ensureNowLinks();
      ensureMute();
      ensureGuide();
    });
  });

  applyLayout();
  if (document.head) applyStyle();
  else new MutationObserver((_, obs) => { if (document.head) { obs.disconnect(); applyStyle(); } }).observe(root, { childList: true });
  observer.observe(root, { childList: true, subtree: true });
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    applyLayout(); ensureButtons();
    resizeQuietAt = Date.now() + 250;   // the extended guide is rebuilt once the window stops resizing
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { ensureWide(); updateWideBg(); }, 260);
  });
  window.addEventListener('popstate', checkRoute);
  window.addEventListener('hashchange', checkRoute);
  // Every second: move the Now line and re-measure the wider view (the guide's width changes without a page change while
  // the stage animates, and a view measured mid-animation would stay tiny).
  setInterval(() => { ensureWide(); updatePan(); }, 1000);
  ensureButtons();
})();
