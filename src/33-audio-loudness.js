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

