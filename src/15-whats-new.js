  // ---------------------------------------------------------------------------
  // What's new. A popup with CHANGELOG.md, fetched from GitHub each time it opens until one fetch succeeds.
  // ---------------------------------------------------------------------------
  const CHANGELOG_URL = 'https://raw.githubusercontent.com/tau-samsara/delve/main/CHANGELOG.md';
  const CHANGELOG_CSS = `
.delve-changelog-scrim { position: fixed; inset: 0; z-index: 2147483002; display: flex; align-items: flex-start; justify-content: center; padding: 6vh var(--space-4, 16px) 0; box-sizing: border-box; background: rgba(0, 0, 0, .6); }
.delve-changelog-scrim[hidden] { display: none; }
.delve-changelog { display: flex; flex-direction: column; width: min(640px, 100%); height: min(84vh, 680px); box-sizing: border-box; padding: var(--space-4, 16px); background: var(--bg-deep, #060b1e); color: var(--text, #e8eaf0); border: 1px solid var(--border-color, rgb(38, 82, 178)); font-family: var(--font-mono, "Courier New", monospace); font-size: 14px; line-height: 1.4; }
html.theme-8s .delve-changelog { background: var(--8s-box); border: 0; box-shadow: var(--8s-ring-thin), 0 0 0 1px #141414; }
.delve-changelog-body { flex: 1 1 0; min-height: 0; overflow-y: auto; }
.delve-changelog-body h3 { margin: var(--space-4, 16px) 0 var(--space-2, 8px); font-size: 14px; letter-spacing: .08em; color: var(--gold, #ffd740); }
.delve-changelog-body h3:first-child { margin-top: 0; }
.delve-changelog-body ul { margin: 0; padding-left: 1.2em; }
.delve-changelog-body li { margin-bottom: var(--space-1, 4px); }
.delve-changelog-note { opacity: .75; }
`;
  let changelogScrim = null, changelogBody = null, changelogLoaded = false, changelogLastFocus = null;

  function fetchChangelog() {
    return new Promise((resolve, reject) => GM_xmlhttpRequest({
      method: 'GET', url: CHANGELOG_URL,
      onload: r => { if (r.status < 300) resolve(r.responseText); else reject(new Error('HTTP ' + r.status)); },
      onerror: reject,
    }));
  }

  function renderChangelog(markdown) {
    let list = null;
    const nodes = [];
    markdown.split(/\r?\n/).forEach(line => {
      if (line.startsWith('## ')) { nodes.push(el('h3', '', line.slice(3))); list = null; }
      else if (line.startsWith('- ') && nodes.length) {
        if (!list) { list = el('ul'); nodes.push(list); }
        list.append(el('li', '', line.slice(2)));
      }
    });
    changelogBody.replaceChildren(...nodes);
  }

  function buildChangelog() {
    changelogScrim = el('div', 'delve-changelog-scrim');
    changelogScrim.hidden = true;
    changelogScrim.addEventListener('click', e => { if (e.target === changelogScrim) closeChangelog(); });
    const box = el('div', 'delve-changelog');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', "What's new");
    const head = el('div', 'delve-head');
    const close = el('button', 'delve-close bbtn bbtn-outline', '✕');
    close.type = 'button';
    close.setAttribute('aria-label', "Close what's new");
    close.addEventListener('click', closeChangelog);
    head.append(el('h2', 'delve-title', "WHAT'S NEW"), close);
    changelogBody = el('div', 'delve-changelog-body');
    box.append(head, changelogBody);
    changelogScrim.append(box);
    root.append(changelogScrim);
  }

  function openChangelog() {
    if (!changelogScrim) buildChangelog();
    changelogLastFocus = document.activeElement;
    changelogScrim.hidden = false;
    changelogScrim.querySelector('.delve-close').focus({ preventScroll: true });
    if (changelogLoaded) return;
    changelogBody.replaceChildren(el('p', 'delve-changelog-note', 'Loading…'));
    fetchChangelog()
      .then(text => { renderChangelog(text); changelogLoaded = true; })
      .catch(e => {
        console.warn('[delve] could not load CHANGELOG.md; what\'s new unavailable', e);
        changelogBody.replaceChildren(el('p', 'delve-changelog-note', "Couldn't load the changelog. Check your connection and try again."));
      });
  }

  function closeChangelog() {
    if (!changelogScrim || changelogScrim.hidden) return;
    changelogScrim.hidden = true;
    if (changelogLastFocus && changelogLastFocus.focus) { try { changelogLastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

