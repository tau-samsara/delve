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

