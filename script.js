(() => {
  const REPLY_EMAIL = 'suji056@gmail.com';

  // Where the "Subscribe" links point — a follow.it (or similar) page that
  // emails people when feed.xml gets a new entry. Set this once you've
  // created that page; every element with class="subscribe-link" picks it up.
  const SUBSCRIBE_URL = 'https://follow.it/the-daily-mirror?leanpub';

  let entries = [];
  let activeTheme = null;

  const listView = document.getElementById('list-view');
  const entryView = document.getElementById('entry-view');
  const featured = document.getElementById('featured');
  const listLabel = document.getElementById('list-label');
  const entriesList = document.getElementById('entries-list');
  const emptyState = document.getElementById('empty-state');
  const searchInput = document.getElementById('search');
  const chipsWrap = document.getElementById('theme-chips');
  const entryCount = document.getElementById('entry-count');
  const latestDay = document.getElementById('latest-day');
  const backBtn = document.getElementById('back-btn');
  const dayNav = document.getElementById('day-nav');
  const shareBtn = document.getElementById('share-btn');
  const replyBtn = document.getElementById('reply-btn');

  // Point every subscribe link at SUBSCRIBE_URL, or hide them (and their
  // surrounding UI) if it hasn't been set yet — a dead link is worse than no link.
  if (SUBSCRIBE_URL) {
    document.querySelectorAll('.subscribe-link').forEach((el) => { el.href = SUBSCRIBE_URL; });
  } else {
    document.getElementById('subscribe-dot').hidden = true;
    document.getElementById('header-subscribe-link').hidden = true;
    document.getElementById('footer-subscribe-cta').hidden = true;
  }

  fetch('entries.json')
    .then(r => r.json())
    .then(data => {
      entries = data;
      init();
    })
    .catch(() => {
      entriesList.innerHTML = '<p class="empty-state">Could not load entries.json — make sure the build script has been run.</p>';
    });

  function init() {
    entryCount.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
    if (entries.length) latestDay.textContent = `Day ${entries[0].day}`;

    renderFeatured();
    renderThemeChips();
    renderList();
    backBtn.addEventListener('click', () => { location.hash = ''; });
    searchInput.addEventListener('input', renderList);
    window.addEventListener('hashchange', route);
    route();
  }

  // Reads the GoatCounter site code straight from the tracking script tag,
  // so there's only one place (that script tag) to configure it.
  function getGoatCounterCode() {
    const gcScript = document.querySelector('script[data-goatcounter]');
    if (!gcScript) return null;
    const match = gcScript.getAttribute('data-goatcounter').match(/https:\/\/([^.]+)\.goatcounter\.com/);
    return match ? match[1] : null;
  }

  // Records a view for a specific entry (or the homepage) as its own tracked path —
  // needed because this is a single HTML page; without this, GoatCounter would lump
  // every entry together as one pageview instead of counting each day separately.
  // GoatCounter's script loads with `async`, so it may not be ready yet the first
  // time we try to track a view (e.g. the featured entry on initial page load).
  // Queue the call and flush it once the script actually finishes loading, instead
  // of silently dropping that view.
  let pendingTracks = [];
  let goatcounterReady = false;

  function trackView(path, title) {
    if (window.goatcounter && window.goatcounter.count) {
      window.goatcounter.count({ path, title, event: false });
    } else if (!goatcounterReady) {
      pendingTracks.push({ path, title });
    }
  }

  function flushPendingTracks() {
    goatcounterReady = true;
    pendingTracks.forEach(({ path, title }) => {
      if (window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path, title, event: false });
      }
    });
    pendingTracks = [];
  }

  window.addEventListener('load', () => {
    // By the window 'load' event, GoatCounter's async script has had every
    // chance to finish; flush anything we couldn't send immediately.
    setTimeout(flushPendingTracks, 300);
  });

  // Fetches and displays the public view count for one specific path,
  // into the given element id. Fails silently if GoatCounter isn't set up yet.
  function showViewCount(path, elementId) {
    const code = getGoatCounterCode();
    const el = document.getElementById(elementId);
    if (!code || !el) return;

    fetch(`https://${code}.goatcounter.com/counter/${encodeURIComponent(path)}.json`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        const count = data.count_unique || data.count;
        if (count) {
          el.innerHTML += `<span class="dot">·</span>${count} ${count === 1 ? 'reader' : 'readers'}`;
        }
      })
      .catch(() => { /* counter not enabled yet, or blocked by an ad-blocker */ });
  }

  // Optional per-entry header image (entries/*.md `image:` field). Most entries
  // won't have one — created/shown only when present, hidden otherwise, so the
  // layout doesn't leave a gap for entries without an image.
  function setHeaderImage(e, metaLineId, imageId) {
    const metaLine = document.getElementById(metaLineId);
    let img = document.getElementById(imageId);
    if (e.image) {
      if (!img) {
        img = document.createElement('img');
        img.id = imageId;
        img.className = 'entry-header-image';
        img.alt = '';
        img.loading = 'eager';
        metaLine.parentNode.insertBefore(img, metaLine);
      }
      img.src = e.image;
      img.hidden = false;
    } else if (img) {
      img.hidden = true;
    }
  }

  function renderFeatured() {
    if (!entries.length) { featured.hidden = true; return; }
    const e = entries[0];
    const meta = metaLine([`Day ${e.day}`, e.date ? formatDate(e.date) : '', e.passage || '']);
    setHeaderImage(e, 'featured-meta-line', 'featured-header-image');
    document.getElementById('featured-meta-line').textContent = meta;
    document.getElementById('featured-title').textContent = e.title;
    document.getElementById('featured-themes').innerHTML =
      (e.themes || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
    document.getElementById('featured-body').innerHTML = renderBody(e.body, e.closing_question);
    document.getElementById('featured-question').textContent = e.closing_question || '';
    wireShare(e, document.getElementById('featured-share-btn'));
    wireReply(e, document.getElementById('featured-reply-btn'));
    showViewCount(`/entry/${e.slug}`, 'featured-meta-line');
  }

  function allThemes() {
    const set = new Set();
    entries.forEach(e => (e.themes || []).forEach(t => set.add(t)));
    return [...set].sort();
  }

  function renderThemeChips() {
    chipsWrap.innerHTML = '';
    allThemes().forEach(theme => {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = theme;
      chip.addEventListener('click', () => {
        activeTheme = activeTheme === theme ? null : theme;
        renderThemeChips();
        renderList();
      });
      if (theme === activeTheme) chip.classList.add('active');
      chipsWrap.appendChild(chip);
    });
  }

  function metaLine(parts) {
    return parts.filter(Boolean).join(' · ');
  }

  function renderList() {
    const q = searchInput.value.trim().toLowerCase();
    const isFiltering = !!q || !!activeTheme;
    const pool = isFiltering ? entries : entries.slice(1); // exclude featured entry when idle

    const filtered = pool.filter(e => {
      const matchesTheme = !activeTheme || (e.themes || []).includes(activeTheme);
      const haystack = [e.title, e.body, e.closing_question, (e.themes || []).join(' ')].join(' ').toLowerCase();
      const matchesSearch = !q || haystack.includes(q);
      return matchesTheme && matchesSearch;
    });

    featured.hidden = isFiltering || entryView.hidden === false;
    listLabel.textContent = isFiltering ? 'Results' : 'Past Reflections';

    entriesList.innerHTML = '';
    emptyState.hidden = filtered.length > 0;

    filtered.forEach(e => {
      const li = document.createElement('li');
      const meta = metaLine([`Day ${e.day}`, e.date ? formatDate(e.date) : '', e.passage || '']);
      const thumbnail = e.image ? `<img class="card-image" src="${e.image}" alt="" loading="lazy">` : '';
      li.innerHTML = `
        <a class="entry-card" href="#/entry/${e.slug}">
          ${thumbnail}
          <div class="card-meta">${meta}</div>
          <h2>${escapeHtml(e.title)}</h2>
          <p class="card-question">${escapeHtml(e.closing_question || '')}</p>
          <div class="card-chips">${(e.themes || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
        </a>
      `;
      entriesList.appendChild(li);
    });
  }

  function route() {
    const hash = location.hash;
    const match = hash.match(/^#\/entry\/(.+)$/);
    if (match) {
      const entry = entries.find(e => e.slug === match[1]);
      if (entry) { showEntry(entry); return; }
    }
    showList();
  }

  function showList() {
    document.title = 'The Daily Mirror';
    entryView.hidden = true;
    dayNav.hidden = true;
    listView.hidden = false;
    renderList(); // recompute featured visibility now that entryView is hidden again
    if (entries.length && !searchInput.value.trim() && !activeTheme) {
      trackView(`/entry/${entries[0].slug}`, entries[0].title); // featured entry is what's actually shown here
    }
    window.scrollTo(0, 0);
  }

  function showEntry(e) {
    document.title = `${e.title} — The Daily Mirror`;
    listView.hidden = true;
    entryView.hidden = false;
    featured.hidden = true;

    const meta = metaLine([`Day ${e.day}`, e.date ? formatDate(e.date) : '', e.passage || '']);
    setHeaderImage(e, 'entry-meta-line', 'entry-header-image');
    document.getElementById('entry-meta-line').textContent = meta;
    document.getElementById('entry-title').textContent = e.title;
    document.getElementById('entry-themes').innerHTML =
      (e.themes || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
    document.getElementById('entry-body').innerHTML = renderBody(e.body, e.closing_question);
    document.getElementById('entry-question').textContent = e.closing_question || '';

    renderRelated(e);
    renderDayNav(e);
    wireShare(e, shareBtn);
    wireReply(e, replyBtn);
    trackView(`/entry/${e.slug}`, e.title);
    showViewCount(`/entry/${e.slug}`, 'entry-meta-line');
    window.scrollTo(0, 0);
  }

  function renderDayNav(current) {
    const idx = entries.findIndex(e => e.slug === current.slug);
    const older = entries[idx + 1]; // next in array = smaller day number = older
    const newer = idx > 0 ? entries[idx - 1] : null; // previous in array = larger day number = newer

    if (!older && !newer) { dayNav.hidden = true; return; }
    dayNav.hidden = false;

    const prevLink = document.getElementById('nav-prev');
    const nextLink = document.getElementById('nav-next');

    if (older) {
      prevLink.href = `#/entry/${older.slug}`;
      document.getElementById('nav-prev-label').textContent = `Day ${older.day}`;
      prevLink.style.visibility = 'visible';
    } else {
      prevLink.style.visibility = 'hidden';
    }

    if (newer) {
      nextLink.href = `#/entry/${newer.slug}`;
      document.getElementById('nav-next-label').textContent = `Day ${newer.day}`;
      nextLink.style.visibility = 'visible';
    } else {
      nextLink.style.visibility = 'hidden';
    }
  }

  // The SPA itself is browsed via #/entry/<slug> hash routes, but those are never
  // sent to the server or reliably indexed/previewed by crawlers and social bots.
  // Sharing should point at the real static per-entry page instead (see
  // scripts/build_pages.py) so link previews show that day's actual title/text.
  function canonicalEntryUrl(slug) {
    const baseDir = location.pathname.replace(/[^/]*$/, ''); // strip trailing index.html, if present
    return `${location.origin}${baseDir}entry/${slug}/`;
  }

  function wireShare(e, btn) {
    btn.onclick = async () => {
      const url = canonicalEntryUrl(e.slug);
      const shareData = { title: e.title, text: e.closing_question || '', url };
      if (navigator.share) {
        try { await navigator.share(shareData); } catch (err) { /* user cancelled */ }
      } else {
        try {
          await navigator.clipboard.writeText(url);
          const original = btn.textContent;
          btn.textContent = 'Link copied';
          setTimeout(() => { btn.textContent = original; }, 1800);
        } catch (err) {
          prompt('Copy this link:', url);
        }
      }
    };
  }

  function wireReply(e, link) {
    const subject = encodeURIComponent(`Re: "${e.title}" — The Daily Mirror`);
    const body = encodeURIComponent(`I read Day ${e.day}, "${e.title}", and wanted to share a thought:\n\n`);
    link.href = `mailto:${REPLY_EMAIL}?subject=${subject}&body=${body}`;
  }

  function renderBody(body, closingQuestion) {
    const paragraphs = body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    // Drop the trailing paragraph if it duplicates the closing question —
    // that line gets its own styled treatment below, so showing it twice reads as a mistake.
    if (closingQuestion && paragraphs.length) {
      const last = paragraphs[paragraphs.length - 1].trim();
      if (last === closingQuestion.trim()) paragraphs.pop();
    }
    return paragraphs.map(p => {
      if (/^🪞/.test(p)) {
        return `<div class="mirror-marker">${escapeHtml(p)}</div>`;
      }
      return `<p>${escapeHtml(p)}</p>`;
    }).join('');
  }

  function renderRelated(current) {
    const wrap = document.getElementById('related-wrap');
    const list = document.getElementById('related-list');
    const themes = current.themes || [];
    const related = entries
      .filter(e => e.slug !== current.slug && (e.themes || []).some(t => themes.includes(t)))
      .slice(0, 5);

    if (!related.length) { wrap.hidden = true; return; }

    wrap.hidden = false;
    list.innerHTML = related.map(e =>
      `<li><a href="#/entry/${e.slug}">${escapeHtml(e.title)}</a></li>`
    ).join('');
  }

  function formatDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, (m || 1) - 1, d || 1);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
})();
