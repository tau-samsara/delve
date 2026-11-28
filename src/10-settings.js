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
    drawerClosed: [],    // drawer groups folded shut, DRAWER_GROUPS keys
    favorites: [],       // starred channel ids
    favOnly: false,      // show only favorite channels
    hiddenChannels: [],  // channel ids hidden from the guide
    showHidden: false,   // the Hidden button: hidden channels are shown, dimmed
    sort: 'dial',        // 'dial' | 'name' | 'viewers' | 'favorites'
    zoom: 3,             // hours shown across the guide (one of ZOOMS)
    volume: 0.5,         // remembered between page loads
    muted: true,         // remembered between page loads
    // Feature switches in the drawer; all off by default
    programInfo: false,   // click-for-info card and IMDb / Archive links
    favoritesOn: false,   // stars and Favorites button
    hideChannelsOn: false,   // hide button on every channel and the Hidden button
    sortOn: false,        // Sort drop-down
    extended: false,      // extended guide: wider view, zoom, Now button, Now line
    theater: false,       // THEATER button on the player
    clock24: false,       // times shown as 13:00 instead of 1:00 PM
    tagTips: false,       // hover text on the guide's REWIND tag
    watchers: false,      // total watcher count beside the nav bar clock and as a card on the home page
    searchOn: false,      // SEARCH button and popup
    pictureOn: false,     // brightness and contrast sliders for the video
    brightness: 100,      // percent, PICTURE_SLIDERS
    contrast: 100,        // percent, PICTURE_SLIDERS
    saturation: 100,      // percent, PICTURE_SLIDERS
    dim: 0,               // percent toward black, PICTURE_SLIDERS
    pictureZoom: 100,     // percent, PICTURE_SLIDERS
    pictureWidth: 100,    // percent, stretches the picture sideways only, PICTURE_SLIDERS
    pictureHeight: 100,   // percent, stretches the picture up and down only, PICTURE_SLIDERS
    alignX: 0,            // percent of the width the picture is moved right (overscan), PICTURE_SLIDERS
    alignY: 0,            // percent of the height the picture is moved down, PICTURE_SLIDERS
    pictureCrop: 'off',   // PICTURE_CROPS
    pictureCropFit: 'fill',   // PICTURE_CROP_FITS: the picture fills the crop box or fits inside it
    audioOn: false,       // AUDIO button: volume boost above 100%
    boost: 100,           // percent, BOOST_RANGE
    mono: false,          // play one channel, or both mixed, in both ears
    monoSource: 'mix',    // MONO_SOURCES
    syncMs: 0,            // audio earlier (-) or later (+) than the video, SYNC_RANGE
    night: false,         // night mode: loud sounds pulled down toward quiet ones
    hiss: false,          // hiss reduction: highs above 6 kHz turned down
    level: false,         // loudness leveling: quiet channels lifted, loud ones trimmed
    levelTarget: -23,     // LUFS, LEVEL_RANGE
    hideOn: false,        // HIDE button opens a popup: off, comments, reactions or both
    hideMode: 'off',      // HIDE_MODES
    watermarkOn: false,   // WATERMARK button: the channel logo shown over a corner of the picture
    watermarkShow: false, // the popup's On / Off
    watermarkSize: 8,     // percent of the picture height, WATERMARK_SLIDERS
    watermarkOpacity: 10, // percent, WATERMARK_SLIDERS
    watermarkCorner: 'bottom-right',   // WATERMARK_CORNERS
    watermarkLogo: 'original',         // WATERMARK_LOGOS
    volumePopup: false,   // volume slider popup on the guide's mute button
    autoSpelunkOn: false, // AUTO button beside SPELUNK: tunes a random channel on a timer
    autoSpelunkSeconds: 0,   // AUTO_SPELUNK_INTERVALS; 0 is off
    spelunkFavoritesOnly: false,   // in the AUTO popup: SPELUNK and the timer pick only starred channels
  };
  const DRAWER_GROUPS = [['layout', 'Layout'], ['guide', 'Guide'], ['player', 'Player']];
  const FEATURES = [['programInfo', 'Program information', 'guide'], ['favoritesOn', 'Favorites', 'guide'], ['hideChannelsOn', 'Hide channels', 'guide'],['sortOn', 'Sort', 'guide'], ['searchOn', 'Search', 'guide'], ['extended', 'Extended guide', 'guide'], ['clock24', '24-hour clock', 'guide'], ['tagTips', 'Tag tooltips', 'guide'], ['watchers', 'Watcher count', 'guide'], ['theater', 'Theater mode', 'player'], ['pictureOn', 'Picture tweaks', 'player'], ['audioOn', 'Audio tweaks', 'player'], ['hideOn', 'Hide options', 'player'], ['watermarkOn', 'Watermark', 'player'], ['volumePopup', 'Volume slider', 'player'], ['autoSpelunkOn', 'Auto spelunk', 'player']];
  const AUTO_SPELUNK_INTERVALS = [[0, 'Off'], [15, '15 s'], [30, '30 s'], [60, '1 min'], [300, '5 min']];
  const WATERMARK_SLIDERS = [['watermarkSize', 'Size', { min: 4, max: 20, step: 1 }], ['watermarkOpacity', 'Opacity', { min: 1, max: 20, step: 1 }]];
  const WATERMARK_CORNERS = [['top-left', '↖', 'Top left'], ['top-right', '↗', 'Top right'], ['bottom-left', '↙', 'Bottom left'], ['bottom-right', '↘', 'Bottom right']];
  const WATERMARK_LOGOS = [['original', 'Original'], ['contrast', 'B&W']];
  const HIDE_MODES = [['off', 'Off'], ['both', 'Both'], ['comments', 'Comments'], ['reactions', 'Reactions']];
  const BOOST_RANGE = { min: 100, max: 300, step: 5 };
  const SYNC_RANGE = { min: -1000, max: 1000, step: 10 };   // ms
  const SYNC_IDLE_MS = 1500;   // pause in slider input after which the stream is refetched
  const LEVEL_RANGE = { min: -30, max: -16, step: 1 };
  const MONO_SOURCES = [['left', 'Left'], ['mix', 'Mix'], ['right', 'Right']];
  const PICTURE_SLIDERS = [
    ['brightness', 'Brightness', { min: 50, max: 150, step: 5 }],
    ['contrast', 'Contrast', { min: 50, max: 150, step: 5 }],
    ['saturation', 'Saturation', { min: 0, max: 200, step: 5 }],
    ['dim', 'Dim', { min: 0, max: 90, step: 5 }],
    ['pictureZoom', 'Zoom', { min: 50, max: 150, step: 1 }],
    ['pictureWidth', 'Width', { min: 50, max: 150, step: 1 }],
    ['pictureHeight', 'Height', { min: 50, max: 150, step: 1 }],
    ['alignX', 'Left / right', { min: -25, max: 25, step: 1 }],
    ['alignY', 'Up / down', { min: -25, max: 25, step: 1 }],
  ];
  const PICTURE_CROP_FITS = [['fill', 'Fill'], ['fit', 'Fit']];
  const PICTURE_CROPS = [['off', 'Off', 0], ['4:3', '4:3', 4 / 3], ['16:9', '16:9', 16 / 9], ['21:9', '21:9', 21 / 9]];
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
        if (Array.isArray(parsed.drawerClosed)) out.drawerClosed = DRAWER_GROUPS.map(g => g[0]).filter(key => parsed.drawerClosed.includes(key));
        if (Array.isArray(parsed.favorites)) out.favorites = parsed.favorites.filter(x => typeof x === 'string');
        if (typeof parsed.favOnly === 'boolean') out.favOnly = parsed.favOnly;
        if (Array.isArray(parsed.hiddenChannels)) out.hiddenChannels = parsed.hiddenChannels.filter(x => typeof x === 'string');
        if (typeof parsed.showHidden === 'boolean') out.showHidden = parsed.showHidden;
        if (ZOOMS.indexOf(parsed.zoom) !== -1) out.zoom = parsed.zoom;
        if (typeof parsed.volume === 'number' && parsed.volume >= 0 && parsed.volume <= 1) out.volume = parsed.volume;
        if (typeof parsed.muted === 'boolean') out.muted = parsed.muted;
        FEATURES.forEach(f => { if (typeof parsed[f[0]] === 'boolean') out[f[0]] = parsed[f[0]]; });
        PICTURE_SLIDERS.forEach(([key, , range]) => {
          const v = parsed[key];
          if (Number.isFinite(v) && v >= range.min && v <= range.max) out[key] = v;
        });
        if (PICTURE_CROPS.some(([key]) => key === parsed.pictureCrop)) out.pictureCrop = parsed.pictureCrop;
        if (PICTURE_CROP_FITS.some(([key]) => key === parsed.pictureCropFit)) out.pictureCropFit = parsed.pictureCropFit;
        if (Number.isFinite(parsed.boost) && parsed.boost >= BOOST_RANGE.min && parsed.boost <= BOOST_RANGE.max) out.boost = parsed.boost;
        if (Number.isInteger(parsed.syncMs) && parsed.syncMs >= SYNC_RANGE.min && parsed.syncMs <= SYNC_RANGE.max) out.syncMs = parsed.syncMs;
        if (typeof parsed.night === 'boolean') out.night = parsed.night;
        if (typeof parsed.hiss === 'boolean') out.hiss = parsed.hiss;
        if (typeof parsed.level === 'boolean') out.level = parsed.level;
        if (Number.isInteger(parsed.levelTarget) && parsed.levelTarget >= LEVEL_RANGE.min && parsed.levelTarget <= LEVEL_RANGE.max) out.levelTarget = parsed.levelTarget;
        if (typeof parsed.mono === 'boolean') out.mono = parsed.mono;
        if (MONO_SOURCES.some(([key]) => key === parsed.monoSource)) out.monoSource = parsed.monoSource;
        if (HIDE_MODES.some(([key]) => key === parsed.hideMode)) out.hideMode = parsed.hideMode;
        if (typeof parsed.spelunkFavoritesOnly === 'boolean') out.spelunkFavoritesOnly = parsed.spelunkFavoritesOnly;
        if (AUTO_SPELUNK_INTERVALS.some(([seconds]) => seconds === parsed.autoSpelunkSeconds)) out.autoSpelunkSeconds = parsed.autoSpelunkSeconds;
        if (typeof parsed.watermarkShow === 'boolean') out.watermarkShow = parsed.watermarkShow;
        // 0.34.0 and 0.34.1 allowed 10-100; a saved value above the new maximum becomes the maximum
        if (Number.isInteger(parsed.watermarkOpacity) && parsed.watermarkOpacity > 20 && parsed.watermarkOpacity <= 100) parsed.watermarkOpacity = 20;
        WATERMARK_SLIDERS.forEach(([key, , range]) => {
          if (Number.isInteger(parsed[key]) && parsed[key] >= range.min && parsed[key] <= range.max) out[key] = parsed[key];
        });
        if (WATERMARK_CORNERS.some(([key]) => key === parsed.watermarkCorner)) out.watermarkCorner = parsed.watermarkCorner;
        if (WATERMARK_LOGOS.some(([key]) => key === parsed.watermarkLogo)) out.watermarkLogo = parsed.watermarkLogo;
        if (Object.prototype.hasOwnProperty.call(SORTS, parsed.sort)) out.sort = parsed.sort;
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
    applyPicture();
    applyAudio();
    applyHide();
    applyWatermark();
    syncDrawer();
  }
