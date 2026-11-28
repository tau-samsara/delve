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

