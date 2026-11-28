  // ---------------------------------------------------------------------------
  // Audio: volume boost. The streams come from archive.org without CORS headers, so Web Audio would play silence from them.
  // With the feature on, each stream is fetched through GM_xmlhttpRequest, cut into fragments by MP4Box and fed to the
  // video through MediaSource (a blob: source Web Audio may read). A video's Web Audio source can't be undone, so once the
  // first stream has been swapped every later one is too, until the page reloads.
  // ---------------------------------------------------------------------------
  const AUDIO_CSS = `
.delve-audio-panel[hidden] { display: none; }
.delve-audio-ctl .delve-audio-panel { width: 300px; max-width: calc(100vw - 40px); left: 0; right: auto; transform: none; }
@media (max-width: 480px) { :root .delve-audio-ctl .delve-audio-panel { position: fixed; left: 50%; right: auto; top: 50%; bottom: auto; transform: translate(-50%, -50%); max-height: calc(100vh - 40px); overflow-y: auto; } }
.delve-audio-panel .delve-seg { gap: 4px; }
:root .delve-audio-panel .delve-seg button { padding-left: 2px; padding-right: 2px; letter-spacing: 0; font-size: 16px; }
.delve-audio-panel .cc-panel-head { display: flex; justify-content: space-between; text-align: left; }
:root .delve-audio-panel .delve-slider.player-volume-slider { display: block; flex: none; width: 100%; max-width: none; margin: 0 0 4px; box-sizing: border-box; }
`;
  const STREAM_CHUNK_BYTES = 2 * 1024 * 1024;
  const STREAM_BUFFER_AHEAD_SEC = 15;
  const STREAM_RETRIES = 2;            // failed range requests retried before the site's own stream takes over
  const STREAM_RETRY_DELAY_MS = 800;
  const STREAM_SWAP_RETRIES = 3, STREAM_SWAP_RETRY_DELAY_MS = 3000;   // whole swap tried again after the requests kept failing, once the audio graph exists
  const STREAM_FULL_RETRY_MS = 1000;   // wait before appending again to a full buffer
  let audioGraph = null;          // { context, gain }
  let audioStreamUrl = '';        // the archive.org URL being fed through MediaSource, '' when none
  let audioSkippedUrl = '';       // a stream that failed to swap; the site's own playback is restored for it
  let swapRetries = { url: '', count: 0 };
  let stopAudioStream = () => {};
  let resyncAudioStream = () => {};   // re-applies the audio sync setting to the running stream
  const audioWatchedVideos = new WeakSet();

  const HISS_SHELF_HZ = 6000, HISS_CUT_DB = -6;

