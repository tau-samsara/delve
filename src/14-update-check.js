  // ---------------------------------------------------------------------------
  // Update check. About once an hour (shared across tabs) the published @version is read from GitHub. A newer one makes
  // the DELVE button glow and the drawer's Update button gold; Update opens the script URL, which Tampermonkey installs.
  // ---------------------------------------------------------------------------
  const SCRIPT_URL = 'https://raw.githubusercontent.com/tau-samsara/delve/main/delve.user.js';
  const UPDATE_KEY = 'updateCheck';
  const UPDATE_EVERY_MS = 60 * 60 * 1000;
  const VERSION_RE = /^\d+(\.\d+){0,2}$/;
  const installedVersion = (typeof GM_info === 'object' && GM_info.script && GM_info.script.version) || '';

  function loadUpdateState() {
    const out = { checkedAt: 0, latest: '' };
    try {
      const raw = GM_getValue(UPDATE_KEY, null);
      if (raw && typeof raw === 'object') {
        if (Number.isFinite(raw.checkedAt)) out.checkedAt = raw.checkedAt;
        if (typeof raw.latest === 'string' && VERSION_RE.test(raw.latest)) out.latest = raw.latest;
      }
    } catch (e) { /* none yet */ }
    return out;
  }

  let updateState = loadUpdateState();

  function saveUpdateState() {
    try { GM_setValue(UPDATE_KEY, updateState); }
    catch (e) { console.warn('[delve] could not save update check', e); }
  }

  function isNewerVersion(a, b) {
    const x = a.split('.').map(Number), y = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const d = (x[i] || 0) - (y[i] || 0);
      if (d) return d > 0;
    }
    return false;
  }

  function updateAvailable() {
    return !!updateState.latest && VERSION_RE.test(installedVersion) && isNewerVersion(updateState.latest, installedVersion);
  }

  function syncUpdate() {
    if (updateAvailable()) root.setAttribute('data-delve-update', '');
    else root.removeAttribute('data-delve-update');
    syncDrawer();
  }

  function fetchPublishedVersion() {
    return new Promise((resolve, reject) => GM_xmlhttpRequest({
      method: 'GET', url: SCRIPT_URL,
      onload: r => {
        const m = r.status < 300 && /^\/\/ @version\s+(\S+)/m.exec(r.responseText);
        if (m && VERSION_RE.test(m[1])) resolve(m[1]); else reject(new Error('no @version in response (HTTP ' + r.status + ')'));
      },
      onerror: reject,
    }));
  }

  function checkForUpdate(force) {
    updateState = loadUpdateState();   // another tab may have checked already
    if (force !== true && Date.now() - updateState.checkedAt < UPDATE_EVERY_MS - 60 * 1000) { syncUpdate(); return; }
    updateState.checkedAt = Date.now();   // a failed check also waits an hour
    saveUpdateState();
    fetchPublishedVersion()
      .then(v => { updateState.latest = v; saveUpdateState(); })
      .catch(e => console.warn('[delve] could not read the published version; update check unavailable', e))
      .then(syncUpdate);
  }

