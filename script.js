(() => {
  // TODO: replace with your real email before publishing — used by the "Reply to me" link.
  const REPLY_EMAIL = 'suji056@gmail.com';

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

  function renderFeatured() {
    if (!entries.length) { featured.hidden = true; return; }
    const e = entries[0];
    const meta = metaLine([`Day ${e.day}`, e.date ? formatDate(e.date) : '', e.passage || '']);
    document.getElementById('featured-meta-line').textContent = meta;
    document.getElementById('featured-title').textContent = e.title;
    document.getElementById('featured-themes').innerHTML =
      (e.themes || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
    document.getElementById('featured-body').innerHTML = renderBody(e.body, e.closing_question);
    document.getElementById('featured-question').textContent = e.closing_question || '';
    wireShare(e, document.getElementById('featured-share-btn'));
    wireReply(e, document.getElementById('featured-reply-btn'));
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
      li.className = 'entry-card';
      const meta = metaLine([`Day ${e.day}`, e.date ? formatDate(e.date) : '', e.passage || '']);
      li.innerHTML = `
        <div class="card-meta">${meta}</div>
        <h2>${escapeHtml(e.title)}</h2>
        <p class="card-question">${escapeHtml(e.closing_question || '')}</p>
        <div class="card-chips">${(e.themes || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
      `;
      li.addEventListener('click', () => { location.hash = `#/entry/${e.slug}`; });
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
    entryView.hidden = true;
    dayNav.hidden = true;
    listView.hidden = false;
    renderList(); // recompute featured visibility now that entryView is hidden again
    window.scrollTo(0, 0);
  }

  function showEntry(e) {
    listView.hidden = true;
    entryView.hidden = false;
    featured.hidden = true;

    const meta = metaLine([`Day ${e.day}`, e.date ? formatDate(e.date) : '', e.passage || '']);
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

  function wireShare(e, btn) {
    btn.onclick = async () => {
      const url = `${location.origin}${location.pathname}#/entry/${e.slug}`;
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
