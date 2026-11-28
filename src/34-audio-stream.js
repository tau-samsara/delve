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

