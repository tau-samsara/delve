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

  function ensureAudioGraph(video) {
    if (audioGraph) return;
    const context = new AudioContext();
    const gain = context.createGain();
    const monoBus = context.createGain();   // one channel in, played in both ears
    monoBus.channelCount = 1; monoBus.channelCountMode = 'explicit';
    monoBus.connect(gain);
    // Leveling: the boost's output goes through levelGain, a limiter and a fade-in; a loudness meter listens to the source.
    const levelGain = context.createGain(), fade = context.createGain();
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.003; limiter.release.value = 0.12;
    levelGain.connect(limiter); limiter.connect(fade); fade.connect(context.destination);
    // Night mode: a compressor that pulls loud sounds down (the browser adds its own makeup gain).
    const nightCompressor = context.createDynamicsCompressor();
    nightCompressor.threshold.value = -30; nightCompressor.knee.value = 20; nightCompressor.ratio.value = 6;
    nightCompressor.attack.value = 0.01; nightCompressor.release.value = 0.25;
    const hissShelf = context.createBiquadFilter();   // 0 dB (transparent) until hiss reduction is on
    hissShelf.type = 'highshelf'; hissShelf.frequency.value = HISS_SHELF_HZ;
    gain.connect(hissShelf); hissShelf.connect(context.destination);
    const weightHighpass = context.createBiquadFilter(), weightShelf = context.createBiquadFilter();   // K-weighting for LUFS
    weightHighpass.type = 'highpass'; weightHighpass.frequency.value = 38.13; weightHighpass.Q.value = -6;
    weightShelf.type = 'highshelf'; weightShelf.frequency.value = 1681.97; weightShelf.gain.value = 4;
    const meterSplitter = context.createChannelSplitter(2), meterLeft = context.createAnalyser(), meterRight = context.createAnalyser();
    [meterLeft, meterRight].forEach(meter => { meter.fftSize = 4096; meter.smoothingTimeConstant = 0; });
    weightHighpass.connect(weightShelf); weightShelf.connect(meterSplitter);
    meterSplitter.connect(meterLeft, 0); meterSplitter.connect(meterRight, 1);
    const resume = () => { if (context.state === 'suspended') context.resume(); };
    ['pointerdown', 'keydown'].forEach(type => document.addEventListener(type, resume, true));
    video.addEventListener('play', resume);
    audioGraph = {
      context, video, gain, hissShelf, monoBus, levelGain, fade, nightCompressor, weightHighpass, meterLeft, meterRight,
      meterBufferLeft: new Float32Array(4096), meterBufferRight: new Float32Array(4096),
      source: context.createMediaElementSource(video), splitter: context.createChannelSplitter(2), route: '', leveling: false, night: false,
    };
    setInterval(() => { levelTick(); detectTick(); }, LEVEL_TICK_MS);
    applyAudio();
  }

  function routeAudio() {
    const graph = audioGraph;
    const route = settings.audioOn && settings.mono ? settings.monoSource : 'stereo';
    if (route === graph.route) return;
    graph.route = route;
    graph.source.disconnect(); graph.splitter.disconnect();
    graph.source.connect(graph.weightHighpass);
    if (route === 'stereo') graph.source.connect(graph.gain);
    else if (route === 'mix') graph.source.connect(graph.monoBus);
    else { graph.source.connect(graph.splitter); graph.splitter.connect(graph.monoBus, route === 'left' ? 0 : 1); }
  }

  // Boost gain -> hiss shelf -> night compressor (if on) -> leveling (if on) -> output.
  function routeOutput() {
    const graph = audioGraph;
    graph.hissShelf.gain.setTargetAtTime(settings.audioOn && settings.hiss ? HISS_CUT_DB : 0, graph.context.currentTime, 0.01);
    const leveling = settings.audioOn && settings.level, night = settings.audioOn && settings.night;
    if (leveling === graph.leveling && night === graph.night) return;
    const levelingChanged = leveling !== graph.leveling;
    graph.leveling = leveling; graph.night = night;
    graph.hissShelf.disconnect(); graph.nightCompressor.disconnect();
    const next = leveling ? graph.levelGain : graph.context.destination;
    if (night) { graph.hissShelf.connect(graph.nightCompressor); graph.nightCompressor.connect(next); }
    else graph.hissShelf.connect(next);
    if (levelingChanged) resetLeveler();
  }

  function applyAudio() {
    syncAudioPanel();
    if (!audioGraph) return;
    const factor = settings.audioOn ? settings.boost / 100 : 1;
    audioGraph.gain.gain.setTargetAtTime(factor, audioGraph.context.currentTime, 0.01);
    routeAudio();
    routeOutput();
  }

  // Loudness leveling, from the user's stream-swap script: measures the short-term loudness (LUFS) of the source and moves
  // levelGain toward the target, cutting fast and lifting slowly. Quiet passages hold the gain.
  const LEVEL_TICK_MS = 100, LEVEL_SHORT_TICKS = 30, LEVEL_SHORT_MIN_TICKS = 10, LEVEL_MOMENTARY_TICKS = 4;
  const LEVEL_GATE_LUFS = -70, LEVEL_HOLD_LUFS = -45, LEVEL_BOOST_MAX_DB = 15, LEVEL_CUT_MAX_DB = -12;
  const LEVEL_TAU_CUT = 0.8, LEVEL_TAU_LIFT = 4, LEVEL_TAU_SETTLE = 1, LEVEL_SETTLE_MS = 6000, LEVEL_MIN_VOLUME = 0.02, LEVEL_FADE_SEC = 1;
  const LUFS_OFFSET = -0.43;
  const lufsToPower = lufs => Math.pow(10, (lufs - LUFS_OFFSET) / 10);
  const leveler = { powers: [], gainDb: 0, settleUntil: 0, lastTickMs: 0, fadePending: false };
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const meanSquare = samples => samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length;
  const clampBetween = (value, low, high) => Math.min(high, Math.max(low, value));

  // New stream or leveling switched on: start from no gain and fade the sound in once it plays.
  function resetLeveler() {
    leveler.powers = []; leveler.gainDb = 0; leveler.lastTickMs = 0; leveler.settleUntil = performance.now() + LEVEL_SETTLE_MS;
    if (!audioGraph) return;
    const now = audioGraph.context.currentTime;
    audioGraph.levelGain.gain.cancelScheduledValues(now); audioGraph.levelGain.gain.setValueAtTime(1, now);
    audioGraph.fade.gain.cancelScheduledValues(now); audioGraph.fade.gain.setValueAtTime(audioGraph.leveling ? 0 : 1, now);
    leveler.fadePending = audioGraph.leveling;
  }

  function fadeInWhenPlaying() {
    const { video, context, fade } = audioGraph;
    if (!leveler.fadePending || video.paused || video.seeking || video.readyState < 3) return;
    fade.gain.cancelScheduledValues(context.currentTime);
    fade.gain.setValueAtTime(0, context.currentTime);
    fade.gain.linearRampToValueAtTime(1, context.currentTime + LEVEL_FADE_SEC);
    leveler.fadePending = false;
  }

  function stepLeveler(power, seconds, nowMs) {
    leveler.powers.push(power >= lufsToPower(LEVEL_GATE_LUFS) ? power : 0);
    if (leveler.powers.length > LEVEL_SHORT_TICKS) leveler.powers.shift();
    const audible = leveler.powers.filter(value => value > 0);
    const recent = leveler.powers.slice(-LEVEL_MOMENTARY_TICKS);
    const shortTerm = audible.length >= LEVEL_SHORT_MIN_TICKS ? mean(audible) : 0;
    const momentary = recent.length === LEVEL_MOMENTARY_TICKS && recent.every(value => value > 0) ? mean(recent) : 0;
    const measured = Math.max(shortTerm, momentary);
    if (measured <= 0) return;
    const loudness = LUFS_OFFSET + 10 * Math.log10(measured);
    if (loudness < LEVEL_HOLD_LUFS) return;
    const wantedDb = clampBetween(settings.levelTarget - loudness, LEVEL_CUT_MAX_DB, LEVEL_BOOST_MAX_DB);
    const tau = wantedDb < leveler.gainDb ? LEVEL_TAU_CUT : nowMs < leveler.settleUntil ? LEVEL_TAU_SETTLE : LEVEL_TAU_LIFT;
    leveler.gainDb += (wantedDb - leveler.gainDb) * (1 - Math.exp(-seconds / tau));
  }

  // Channel detection (the AUTO choice next to LEFT | MIX | RIGHT). Listens to the left and right meters; once it is confident
  // it turns Mono on with Left (right side dead), Right (left side dead) or Mix (sides uneven), then stops until the user
  // selects AUTO again. Evenly balanced sound changes nothing.
  const DETECT_MIN_SOUNDS = 100, DETECT_WINDOW_SOUNDS = 300;   // 10 s of sound before deciding, the last 30 s kept
  const DETECT_DEAD_DB = 30, DETECT_UNEVEN_DB = 1;               // left-right energy difference that counts as dead / uneven
  let monoDetection = null;   // { sounds: [[left power, right power], ...] } while listening, otherwise null

  function startMonoDetection() {
    monoDetection = { sounds: [] };
    syncAudioPanel();
  }

  function classifyChannels(sounds) {
    const left = sounds.reduce((sum, sound) => sum + sound[0], 0), right = sounds.reduce((sum, sound) => sum + sound[1], 0);
    const differenceDb = 10 * Math.log10((left + 1e-20) / (right + 1e-20));
    if (differenceDb >= DETECT_DEAD_DB) return 'left';
    if (differenceDb <= -DETECT_DEAD_DB) return 'right';
    return Math.abs(differenceDb) >= DETECT_UNEVEN_DB ? 'mix' : 'even';
  }

  function detectTick() {
    if (!monoDetection || !audioGraph || !settings.audioOn) return;
    const { video, context, meterLeft, meterRight, meterBufferLeft, meterBufferRight } = audioGraph;
    if (context.state !== 'running' || video.paused || video.muted || video.ended || !(video.volume >= LEVEL_MIN_VOLUME)) return;
    meterLeft.getFloatTimeDomainData(meterBufferLeft); meterRight.getFloatTimeDomainData(meterBufferRight);
    const left = meanSquare(meterBufferLeft) / (video.volume * video.volume), right = meanSquare(meterBufferRight) / (video.volume * video.volume);
    if (Math.max(left, right) < lufsToPower(LEVEL_GATE_LUFS)) return;   // silence says nothing about the channels
    const sounds = monoDetection.sounds;
    sounds.push([left, right]);
    if (sounds.length > DETECT_WINDOW_SOUNDS) sounds.shift();
    if (sounds.length < DETECT_MIN_SOUNDS) return;
    const half = Math.floor(sounds.length / 2);
    const verdict = classifyChannels(sounds);
    if (classifyChannels(sounds.slice(0, half)) !== verdict || classifyChannels(sounds.slice(half)) !== verdict) return;   // not steady yet
    monoDetection = null;
    if (verdict === 'even') syncAudioPanel();
    else setSettings({ mono: true, monoSource: verdict });
  }

  function levelTick() {
    if (!audioGraph || !audioGraph.leveling) return;
    const { video, context, levelGain, meterLeft, meterRight, meterBufferLeft, meterBufferRight } = audioGraph;
    fadeInWhenPlaying();
    const nowMs = performance.now();
    const seconds = clampBetween((nowMs - (leveler.lastTickMs || nowMs - LEVEL_TICK_MS)) / 1000, 0.01, 1);
    leveler.lastTickMs = nowMs;
    if (context.state !== 'running' || video.paused || video.muted || video.ended || !(video.volume >= LEVEL_MIN_VOLUME)) return;
    meterLeft.getFloatTimeDomainData(meterBufferLeft); meterRight.getFloatTimeDomainData(meterBufferRight);
    stepLeveler((meanSquare(meterBufferLeft) + meanSquare(meterBufferRight)) / (video.volume * video.volume), seconds, nowMs);
    levelGain.gain.setTargetAtTime(Math.pow(10, leveler.gainDb / 20), context.currentTime, 0.05);
  }

  // Where the file continues after a media-data box (mdat) that comes before the index (moov); 0 when the index is first.
  function offsetAfterLeadingMdat(data) {
    const view = new DataView(data);
    let position = 0;
    while (position + 16 <= data.byteLength) {
      const type = String.fromCharCode(...new Uint8Array(data, position + 4, 4));
      const size = view.getUint32(position) === 1 ? Number(view.getBigUint64(position + 8)) : view.getUint32(position);
      if (type === 'moov' || !size) return 0;
      if (type === 'mdat') return position + size;
      position += size;
    }
    return 0;
  }

  // The browser ignores edit lists. A track whose list starts with an empty edit begins late (its audio would run early
  // against the video), so the edit list is removed and the delay applied as a timestamp offset. Returns the delay in seconds.
  function takeStartDelaySec(mp4, track) {
    const trak = mp4.getTrackById(track.id);
    const edits = trak && trak.edts && trak.edts.elst ? trak.edts.elst.entries : null;
    if (!edits || edits.length < 2) return 0;
    const movieTimescale = (mp4.moov && mp4.moov.mvhd && mp4.moov.mvhd.timescale) || 1000;
    let emptySec = 0;
    for (const edit of edits) {
      if (edit.media_time === -1) { emptySec += edit.segment_duration / movieTimescale; continue; }
      const delaySec = emptySec - edit.media_time / track.timescale;
      if (!(delaySec > 0.001)) return 0;
      trak.boxes = trak.boxes.filter(box => box.type !== 'edts');
      return delaySec;
    }
    return 0;
  }

  // MP4Box writes a corrupt init segment when a video entry holds a uuid box, so those boxes are dropped first.
  function dropUuidBoxes(mp4, track) {
    const trak = mp4.getTrackById(track.id);
    const stsd = trak && trak.mdia && trak.mdia.minf && trak.mdia.minf.stbl && trak.mdia.minf.stbl.stsd;
    if (stsd && stsd.entries) stsd.entries.forEach(entry => { if (entry.boxes) entry.boxes = entry.boxes.filter(box => box.type !== 'uuid'); });
  }

  function startAudioStream(video, url) {
    stopAudioStream();
    resetLeveler();
    if (monoDetection) monoDetection.sounds = [];
    const mediaSource = new MediaSource();
    const objectUrl = URL.createObjectURL(mediaSource);
    const mp4 = MP4Box.createFile();
    const sourceBuffers = {}, queues = {}, trackStartDelaySec = {}, audioTrackIds = [];
    const trackIds = [], trackById = {}, cursor = {}, fedUntilSec = {};   // per track: MP4Box track, next sample to fetch, seconds fetched up to
    let fileSize = 0, nextOffset = 0, skippedMdat = 0, flushing = false, syncTimer = 0, ready = false, stopped = false, request = null, requestId = 0, finishTimer = 0, failedRequests = 0;

    const stop = () => {
      stopped = true;
      requestId++;
      if (request && request.abort) request.abort();
      request = null;
      clearInterval(bufferTimer); clearInterval(finishTimer); clearTimeout(syncTimer);
      video.removeEventListener('seeking', onSeeking);
      video.removeEventListener('loadeddata', onLoaded);
      video.removeEventListener('error', onVideoError);
      URL.revokeObjectURL(objectUrl);
      audioStreamUrl = '';
      stopAudioStream = () => {}; resyncAudioStream = () => {};
    };
    const fail = (reason, networkFailure) => {
      if (stopped) return;
      const staleObjectUrl = objectUrl;
      stop();
      if (networkFailure && audioGraph) {   // the graph would play the site's own stream as silence, so try the swap again first
        if (swapRetries.url !== url) swapRetries = { url, count: 0 };
        if (++swapRetries.count <= STREAM_SWAP_RETRIES) {
          console.warn('[delve] ' + reason + '; trying the stream again (' + swapRetries.count + ' of ' + STREAM_SWAP_RETRIES + ')');
          setTimeout(() => { if (video.src === staleObjectUrl && !audioStreamUrl) startAudioStream(video, url); }, STREAM_SWAP_RETRY_DELAY_MS);
          return;
        }
      }
      console.warn('[delve] ' + reason + '; Audio tweaks unavailable for this stream');
      audioSkippedUrl = url;
      video.src = url;
    };
    stopAudioStream = stop;
    audioStreamUrl = url;

    const appendNext = id => {
      const buffer = sourceBuffers[id], queue = queues[id];
      if (stopped || !buffer || buffer.updating || !queue.length) return;
      try { buffer.appendBuffer(queue[0]); queue.shift(); } catch (e) {
        if (mediaSource.readyState === 'closed') stop();   // the site replaced the source
        else if (e.name === 'QuotaExceededError') setTimeout(() => appendNext(id), STREAM_FULL_RETRY_MS);   // this track is full (its data runs far ahead of the other track's); playing frees room
        else fail('stream append failed (' + e.name + ')');
      }
    };

    const bufferedAheadSec = () => {
      for (let i = 0; i < video.buffered.length; i++) {
        if (video.currentTime >= video.buffered.start(i) && video.currentTime <= video.buffered.end(i)) return video.buffered.end(i) - video.currentTime;
      }
      return 0;
    };

    const finishWhenAppended = () => {
      if (mediaSource.readyState !== 'open' || finishTimer) return;
      finishTimer = setInterval(() => {
        const busy = Object.values(sourceBuffers).some(b => b.updating) || Object.values(queues).some(q => q.length);
        if (busy) return;
        clearInterval(finishTimer);
        if (mediaSource.readyState === 'open') mediaSource.endOfStream();
      }, 100);
    };

    const retryChunk = reason => {
      if (++failedRequests > STREAM_RETRIES) { fail(reason, true); return; }
      const timer = setTimeout(() => { request = null; fetchNextChunk(); }, STREAM_RETRY_DELAY_MS);
      request = { abort: () => clearTimeout(timer) };   // holds off new requests while waiting
    };

    const requestRange = (start, end, onData) => {
      const id = ++requestId;
      request = GM_xmlhttpRequest({
        method: 'GET', url, headers: { Range: 'bytes=' + start + '-' + end }, responseType: 'arraybuffer',
        onload: response => {
          if (id !== requestId) return;
          request = null;
          const total = /content-range:\s*bytes\s+\d+-\d+\/(\d+)/i.exec(response.responseHeaders);
          if (response.status !== 206 || !total) { retryChunk('stream request returned HTTP ' + response.status + ' instead of a byte range'); return; }
          fileSize = parseInt(total[1], 10);
          const data = response.response;
          if (!data || !data.byteLength) { retryChunk('stream returned no data'); return; }
          failedRequests = 0;
          data.fileStart = start;
          onData(data);
        },
        onerror: () => { if (id !== requestId) return; request = null; retryChunk('stream request failed'); },
      });
    };

    // Until MP4Box has the index, read the file from the front (or past a leading mdat box to an index at the end).
    const fetchIndexChunk = () => {
      if (fileSize && nextOffset >= fileSize) { fail('stream index not found'); return; }
      const start = nextOffset;
      requestRange(start, fileSize ? Math.min(start + STREAM_CHUNK_BYTES, fileSize) - 1 : start + STREAM_CHUNK_BYTES - 1, data => {
        if (start === 0) skippedMdat = offsetAfterLeadingMdat(data);
        nextOffset = start === 0 && skippedMdat ? skippedMdat : start + data.byteLength;
        mp4.appendBuffer(data);
        if (!ready) fetchNextChunk(); else setTimeout(fetchIfNeeded, 100);
      });
    };

    // MP4Box keeps every chunk it is given (bytes of the other track or skipped by a seek are never "used"), so memory
    // would grow with playing time and seeks. Chunks that end before every track's next unread sample are not needed.
    const dropConsumedChunks = () => {
      const chunks = mp4.stream && mp4.stream.buffers;
      if (!Array.isArray(chunks)) return;
      const unreadFrom = Math.min(...trackIds.map(id => { const sample = trackById[id].samples[trackById[id].nextSample]; return sample ? sample.offset : Infinity; }));
      for (let i = chunks.length - 1; i >= 0; i--) if (chunks[i].fileStart + chunks[i].byteLength <= unreadFrom) chunks.splice(i, 1);
    };

    // After that, each track is fetched from its own position: some files store the audio and video far apart.
    const hasSamplesLeft = id => cursor[id] < trackById[id].samples.length;
    const openTrackIds = () => trackIds.filter(id => hasSamplesLeft(id) && fedUntilSec[id] < video.currentTime + STREAM_BUFFER_AHEAD_SEC);
    const fetchTrackChunk = () => {
      const open = openTrackIds();
      if (!open.length) { if (!trackIds.some(hasSamplesLeft)) finishWhenAppended(); return; }
      const id = open.reduce((a, b) => fedUntilSec[a] <= fedUntilSec[b] ? a : b);
      const sample = trackById[id].samples[cursor[id]];
      const start = sample.offset, end = Math.min(fileSize - 1, Math.max(start + STREAM_CHUNK_BYTES, start + sample.size) - 1);
      requestRange(start, end, data => {
        mp4.appendBuffer(data);
        dropConsumedChunks();
        const before = cursor[id];
        trackIds.forEach(trackId => {
          const samples = trackById[trackId].samples;
          while (hasSamplesLeft(trackId) && samples[cursor[trackId]].offset >= start && samples[cursor[trackId]].offset + samples[cursor[trackId]].size <= end + 1) cursor[trackId]++;
          if (trackId === id && cursor[id] === before) cursor[id]++;   // never ask for the same bytes twice
          const last = samples[cursor[trackId] - 1];
          if (last) fedUntilSec[trackId] = Math.max(fedUntilSec[trackId], last.cts / last.timescale + trackOffsetSec(trackId));
        });
        setTimeout(fetchIfNeeded, 100);
      });
    };

    // Start each track's fetching at the sample for the playing position (after a seek, a sync change or the index).
    const restartAtPlayhead = () => {
      mp4.seek(Math.max(0, video.currentTime - seekLeadSec()), true);
      trackIds.forEach(id => { cursor[id] = trackById[id].nextSample; fedUntilSec[id] = video.currentTime; });
    };

    const fetchNextChunk = () => {
      if (request) return;
      if (ready) fetchTrackChunk(); else fetchIndexChunk();
    };
    const fetchIfNeeded = () => { if (ready && !flushing && openTrackIds().length) fetchNextChunk(); };
    const bufferTimer = setInterval(fetchIfNeeded, 500);

    // Where each track sits on the timeline: its own start delay, plus the sync setting for audio.
    const trackOffsetSec = id => (trackStartDelaySec[id] || 0) + (audioTrackIds.includes(id) ? settings.syncMs / 1000 : 0);
    const seekLeadSec = () => Math.max(0, ...Object.keys(sourceBuffers).map(trackOffsetSec));

    const onSeeking = () => {
      if (!ready || flushing || bufferedAheadSec() > 1) return;
      requestId++;
      if (request && request.abort) request.abort();
      request = null;
      Object.keys(queues).forEach(id => { queues[id] = []; });
      restartAtPlayhead();
      fetchNextChunk();
    };
    video.addEventListener('seeking', onSeeking);
    const onLoaded = () => { swapRetries = { url: '', count: 0 }; ensureAudioGraph(video); };   // graph not before: a swapped video that can't play must still fall back to the site's stream
    const onVideoError = () => fail('browser could not play the stream (' + (video.error && video.error.message) + ')');
    video.addEventListener('loadeddata', onLoaded, { once: true });
    video.addEventListener('error', onVideoError);

    mp4.onError = () => fail('stream is not a readable MP4');
    mp4.onSegment = (id, user, buffer, sampleNumber) => {
      queues[id].push(buffer);
      appendNext(id);
      mp4.releaseUsedSamples(id, sampleNumber);
    };
    mp4.onReady = info => {
      const tracks = info.tracks.filter(track => track.type === 'video' || track.type === 'audio');
      const mimeOf = track => (track.type === 'video' ? 'video/mp4' : 'audio/mp4') + '; codecs="' + track.codec + '"';
      const unsupported = tracks.find(track => !MediaSource.isTypeSupported(mimeOf(track)));
      if (unsupported) { fail('stream codec ' + unsupported.codec + ' is not supported'); return; }
      ready = true;
      mediaSource.duration = info.duration / info.timescale;
      tracks.forEach(track => {
        const buffer = mediaSource.addSourceBuffer(mimeOf(track));
        sourceBuffers[track.id] = buffer;
        queues[track.id] = [];
        buffer.addEventListener('updateend', () => appendNext(track.id));
        trackStartDelaySec[track.id] = takeStartDelaySec(mp4, track);
        if (track.type === 'audio') audioTrackIds.push(track.id);
        if (trackOffsetSec(track.id)) buffer.timestampOffset = trackOffsetSec(track.id);
        dropUuidBoxes(mp4, track);
        mp4.setSegmentOptions(track.id, buffer, { nbSamples: 60 });
      });
      mp4.initializeSegmentation().forEach(segment => { queues[segment.id].push(segment.buffer); appendNext(segment.id); });
      tracks.forEach(track => { trackIds.push(track.id); trackById[track.id] = mp4.getTrackById(track.id); });
      restartAtPlayhead();
      mp4.start();
      fetchNextChunk();
    };

    // Moving the audio needs everything buffered to be dropped and fetched again from the playing position.
    const clearBuffer = buffer => new Promise(resolve => {
      const clear = () => { buffer.addEventListener('updateend', resolve, { once: true }); try { buffer.remove(0, Infinity); } catch (e) { resolve(); } };
      if (buffer.updating) buffer.addEventListener('updateend', clear, { once: true }); else clear();
    });
    const refetchWithNewSync = async () => {
      flushing = true;
      requestId++;
      if (request && request.abort) request.abort();
      request = null;
      Object.keys(queues).forEach(id => { queues[id] = []; });
      await Promise.all(Object.values(sourceBuffers).map(clearBuffer));
      if (stopped) return;
      audioTrackIds.forEach(id => { sourceBuffers[id].timestampOffset = trackOffsetSec(id); });
      restartAtPlayhead();
      flushing = false;
      fetchNextChunk();
    };
    resyncAudioStream = delayMs => {
      clearTimeout(syncTimer);
      if (ready) syncTimer = setTimeout(refetchWithNewSync, delayMs);
    };

    mediaSource.addEventListener('sourceopen', fetchNextChunk, { once: true });
    video.src = objectUrl;
  }

  function swapStreamIfNeeded(video) {
    const url = video.src;
    if (!url) { stopAudioStream(); return; }
    if (url.startsWith('blob:') || url === audioSkippedUrl) return;
    if (!settings.audioOn && !audioGraph) return;
    startAudioStream(video, url);
  }

  function restoreSiteStream(video) {
    if (!audioStreamUrl || audioGraph) return;
    const url = audioStreamUrl;
    stopAudioStream();
    audioSkippedUrl = url;
    video.src = url;
  }

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
