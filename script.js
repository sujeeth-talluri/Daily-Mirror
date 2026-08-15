(() => {
  const REPLY_EMAIL = 'suji056@gmail.com';

  // Where the "Subscribe" links point — a follow.it (or similar) page that
  // emails people when feed.xml gets a new entry. Set this once you've
  // created that page; every element with class="subscribe-link" picks it up.
  const SUBSCRIBE_URL = 'https://follow.it/the-daily-mirror?leanpub';

  let entries = [];
  let activeGroup = null;

  // Reader-facing theme taxonomy (brief §21): the 20 granular tags authored
  // per-entry stay exactly as-is in entries.json and on each entry's own
  // chips — they're useful, specific, and not going away. This is just what
  // the Archive page's filter row shows instead of all 20 at once. Every
  // existing tag maps to exactly one group here.
  const THEME_GROUPS = {
    'Self-Examination': ['self-examination', 'hidden-intentions'],
    'Fear & Security': ['fear', 'false-security', 'false-peace'],
    'Pride & Comparison': ['pride', 'comparison', 'love-of-approval'],
    'Postponement': ['postponement', 'complacency', 'urgency-vs-truth', 'ignoring-warning-signs', 'distraction'],
    'Refusal to Change': ['refusal-to-change', 'self-reliance', 'milestone-vs-journey'],
    'Identity': ['identity'],
    'Gratitude & Compassion': ['gratitude', 'compassion'],
    'Presence': ['presence'],
  };

  const archiveView = document.getElementById('archive-view');
  const entryView = document.getElementById('entry-view');
  const featured = document.getElementById('featured');
  const listLabel = document.getElementById('list-label');
  const entriesList = document.getElementById('entries-list');
  const emptyState = document.getElementById('empty-state');
  const searchInput = document.getElementById('search');
  const chipsWrap = document.getElementById('theme-chips');
  const backBtn = document.getElementById('back-btn');
  const dayNav = document.getElementById('day-nav');
  const shareBtn = document.getElementById('share-btn');
  const replyBtn = document.getElementById('reply-btn');

  // Point every subscribe link at SUBSCRIBE_URL, or hide them (and their
  // surrounding UI) if it hasn't been set yet — a dead link is worse than no link.
  if (SUBSCRIBE_URL) {
    document.querySelectorAll('.subscribe-link').forEach((el) => { el.href = SUBSCRIBE_URL; });
  } else {
    document.getElementById('header-subscribe-link').hidden = true;
    document.getElementById('footer-subscribe-cta').hidden = true;
  }

  function toggleAbout() {
    const panel = document.getElementById('about-panel');
    panel.hidden = !panel.hidden;
    const expanded = String(!panel.hidden);
    document.getElementById('nav-about-btn').setAttribute('aria-expanded', expanded);
    document.getElementById('footer-about-btn').setAttribute('aria-expanded', expanded);
    if (!panel.hidden) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  document.getElementById('nav-about-btn').addEventListener('click', toggleAbout);
  document.getElementById('footer-about-btn').addEventListener('click', toggleAbout);

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
    renderFeatured();
    renderThemeChips();
    renderList();
    // Whoever's viewing a single entry almost certainly arrived via the
    // Archive list or a shared link, not the Today page — Archive is the
    // more useful "back" destination either way.
    backBtn.addEventListener('click', () => { location.hash = '#/archive'; });
    searchInput.addEventListener('input', renderList);
    window.addEventListener('hashchange', route);
    route();
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

  // Reader counts are recorded (trackView, above) but no longer shown on the
  // page (QA round-2 item 7) — this is a reflection archive, not a
  // popularity metric. The count still exists for you alone: check it in
  // the GoatCounter dashboard (https://dailymirror.goatcounter.com), which
  // only you can log into — that's the "visible only to me" version of this
  // feature, with no separate admin view to build or maintain on the site.

  // Optional per-entry header image (entries/*.md `image:` field). Most entries
  // won't have one — created/shown only when present, hidden otherwise, so the
  // layout doesn't leave a gap for entries without an image. Inserted right
  // before the body (after meta/title/tags), so a reader understands what
  // today's reflection is *about* before processing the visual — image
  // second, not first.
  function setHeaderImage(e, insertBeforeId, imageId) {
    const insertBefore = document.getElementById(insertBeforeId);
    let img = document.getElementById(imageId);
    if (e.image) {
      if (!img) {
        img = document.createElement('img');
        img.id = imageId;
        img.className = 'entry-header-image';
        img.alt = '';
        img.loading = 'eager';
        insertBefore.parentNode.insertBefore(img, insertBefore);
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
    setHeaderImage(e, 'featured-body', 'featured-header-image');
    document.getElementById('featured-meta-line').textContent = meta;
    document.getElementById('featured-title').textContent = e.title;
    document.getElementById('featured-themes').textContent = formatThemes(e.themes);
    document.getElementById('featured-body').innerHTML = renderBody(e.body, e.closing_question);
    document.getElementById('featured-question').textContent = e.closing_question || '';
    wireShare(e, document.getElementById('featured-share-btn'));
    wireReply(e, document.getElementById('featured-reply-btn'));
  }

  function renderThemeChips() {
    chipsWrap.innerHTML = '';
    Object.keys(THEME_GROUPS).forEach(group => {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.textContent = group;
      chip.addEventListener('click', () => {
        activeGroup = activeGroup === group ? null : group;
        renderThemeChips();
        renderList();
      });
      if (group === activeGroup) chip.classList.add('active');
      chipsWrap.appendChild(chip);
    });
  }

  function metaLine(parts) {
    return parts.filter(Boolean).join(' · ');
  }

  // Understated "SELF-EXAMINATION · REFUSAL TO CHANGE" presentation instead
  // of hashtags (QA item 9) — the underlying slugs (used for search/filter
  // matching) are untouched, this only changes how they're displayed.
  // "self-*" slugs (self-examination, self-reliance) are genuine hyphenated
  // compound nouns and keep their hyphen (QA round-2 item 6); every other
  // hyphen is just a slug word-separator ("refusal-to-change") and becomes
  // a space instead.
  function formatThemes(themes) {
    return (themes || []).map(t => {
      const upper = t.toUpperCase();
      return upper.startsWith('SELF-') ? 'SELF-' + upper.slice(5).replace(/-/g, ' ') : upper.replace(/-/g, ' ');
    }).join(' · ');
  }

  function renderList() {
    // Archive is the complete archive (brief §18/§19) — includes today's
    // entry too, unlike the old homepage list which excluded it because it
    // was already shown inline just above.
    const q = searchInput.value.trim().toLowerCase();
    const isFiltering = !!q || !!activeGroup;
    const groupTags = activeGroup ? THEME_GROUPS[activeGroup] : null;

    const filtered = entries.filter(e => {
      const matchesTheme = !groupTags || groupTags.some(t => (e.themes || []).includes(t));
      const haystack = [e.title, e.body, e.closing_question, (e.themes || []).join(' ')].join(' ').toLowerCase();
      const matchesSearch = !q || haystack.includes(q);
      return matchesTheme && matchesSearch;
    });

    listLabel.textContent = isFiltering
      ? 'Results'
      : `Past Reflections · ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;

    entriesList.innerHTML = '';
    emptyState.hidden = filtered.length > 0;
    emptyState.textContent = q
      ? `No reflections found for "${searchInput.value.trim()}".`
      : 'No reflections match yet. Try a different word or theme.';

    filtered.forEach(e => {
      const li = document.createElement('li');
      const meta = metaLine([`Day ${e.day}`, e.date ? formatDate(e.date) : '', e.passage || '']);
      // Entries before the Day-46 header-image policy have no thumbnail —
      // an empty same-size spacer (not just omitting the element) keeps
      // every row's title/text starting at the same left edge instead of
      // the list visibly jumping left wherever a thumbnail is missing.
      const thumbnail = e.image
        ? `<img class="row-image" src="${e.image}" alt="${escapeAttr(e.title)}" loading="lazy">`
        : '<span class="row-image" aria-hidden="true"></span>';
      li.innerHTML = `
        <a class="entry-row" href="#/entry/${e.slug}">
          ${thumbnail}
          <div class="entry-row-content">
            <div class="row-meta">${meta}</div>
            <h2>${escapeHtml(e.title)}</h2>
            <p class="row-question">${escapeHtml(e.closing_question || '')}</p>
            <div class="row-chips">${escapeHtml(formatThemes(e.themes))}</div>
          </div>
        </a>
      `;
      entriesList.appendChild(li);
    });
  }

  // Yesterday, one entry that shares a theme with today's, and one more for
  // variety — never a fabricated "most read" pick (brief §18: no reliable
  // analytics for that, so don't pretend to have one).
  //
  // The "similar theme" pick is deterministic: whichever remaining entry
  // shares the MOST tags with today's, not just the first one in array
  // order that happens to share any single tag (QA round-2 item 19). If
  // nothing genuinely overlaps, the slot is filled from the archive with an
  // honest label instead of implying a relationship that isn't there.
  function pickContinueReflecting() {
    if (entries.length < 2) return [];
    const today = entries[0];
    const used = new Set([today.slug]);
    const picks = [];

    const yesterday = entries[1];
    if (yesterday) { picks.push({ label: 'Yesterday', entry: yesterday }); used.add(yesterday.slug); }

    const todayThemes = today.themes || [];
    let bestMatch = null;
    let bestOverlap = 0;
    entries.forEach(e => {
      if (used.has(e.slug)) return;
      const overlap = (e.themes || []).filter(t => todayThemes.includes(t)).length;
      if (overlap > bestOverlap) { bestOverlap = overlap; bestMatch = e; }
    });
    if (bestMatch) { picks.push({ label: 'On a similar theme', entry: bestMatch }); used.add(bestMatch.slug); }

    const remaining = entries.filter(e => !used.has(e.slug));
    if (remaining.length) {
      const pick = remaining[Math.floor(Math.random() * remaining.length)];
      picks.push({ label: bestMatch ? 'Another reflection' : 'From the archive', entry: pick });
    }
    return picks;
  }

  function renderContinueReflecting() {
    const wrap = document.getElementById('continue-reflecting');
    const list = document.getElementById('continue-list');
    const picks = pickContinueReflecting();
    if (!picks.length) { wrap.hidden = true; return; }
    wrap.hidden = false;
    list.innerHTML = picks.map(p => `
      <li>
        <a href="#/entry/${p.entry.slug}">
          <span class="continue-label">${escapeHtml(p.label)}</span>
          <span class="continue-title">${escapeHtml(p.entry.title)}</span>
        </a>
      </li>
    `).join('');
  }

  function route() {
    const hash = location.hash;
    const match = hash.match(/^#\/entry\/(.+)$/);
    if (match) {
      const entry = entries.find(e => e.slug === match[1]);
      if (entry) { showEntry(entry); return; }
    }
    if (hash === '#/archive') { showArchive(); return; }
    showToday();
  }

  // Today: just today's reflection plus a small curated continuation — not
  // the whole archive scrolling on underneath it (brief §18).
  function showToday() {
    document.title = 'The Daily Mirror';
    entryView.hidden = true;
    dayNav.hidden = true;
    archiveView.hidden = true;
    featured.hidden = false;
    renderContinueReflecting();
    if (entries.length) {
      trackView(`/entry/${entries[0].slug}`, entries[0].title);
    }
    window.scrollTo(0, 0);
  }

  // Archive: search, theme filters, and the complete list — its own page,
  // not something you scroll past Today to reach.
  function showArchive() {
    document.title = 'Archive — The Daily Mirror';
    entryView.hidden = true;
    dayNav.hidden = true;
    featured.hidden = true;
    archiveView.hidden = false;
    renderList();
    window.scrollTo(0, 0);
  }

  function showEntry(e) {
    document.title = `${e.title} — The Daily Mirror`;
    archiveView.hidden = true;
    entryView.hidden = false;
    featured.hidden = true;

    const meta = metaLine([`Day ${e.day}`, e.date ? formatDate(e.date) : '', e.passage || '']);
    setHeaderImage(e, 'entry-body', 'entry-header-image');
    document.getElementById('entry-meta-line').textContent = meta;
    document.getElementById('entry-title').textContent = e.title;
    document.getElementById('entry-themes').textContent = formatThemes(e.themes);
    document.getElementById('entry-body').innerHTML = renderBody(e.body, e.closing_question);
    document.getElementById('entry-question').textContent = e.closing_question || '';

    renderRelated(e);
    renderDayNav(e);
    wireShare(e, shareBtn);
    wireReply(e, replyBtn);
    trackView(`/entry/${e.slug}`, e.title);
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

  function storyImageUrl(slug) {
    const baseDir = location.pathname.replace(/[^/]*$/, '');
    return `${location.origin}${baseDir}stories/${slug}.jpg`;
  }

  // Opens the shared Share Reflection bottom sheet (share.js) — same sheet,
  // same platform logic, the static per-entry pages use for this button.
  function wireShare(e, btn) {
    btn.onclick = () => {
      window.DailyMirrorShare.open({
        title: e.title,
        day: e.day,
        date: e.date,
        hook: e.hook,
        url: canonicalEntryUrl(e.slug),
        storyImageUrl: storyImageUrl(e.slug),
      });
    };
  }

  function wireReply(e, link) {
    const subject = encodeURIComponent(`Re: "${e.title}" — The Daily Mirror`);
    const body = encodeURIComponent(`I read Day ${e.day}, "${e.title}", and wanted to share a thought:\n\n`);
    link.href = `mailto:${REPLY_EMAIL}?subject=${subject}&body=${body}`;
  }

  // A paragraph stays on its own line rather than merging with its neighbors
  // when it's dialogue (quoted), trails off with an ellipsis, or is three
  // words or fewer on its own ("Think." "Change." "It looked easy.") — all
  // deliberate pacing choices in the writing, not just short sentences.
  function isIsolatedBeat(p) {
    return p.startsWith('"') || p.endsWith('"') || p.endsWith('...') || p.endsWith('…') || p.split(/\s+/).length <= 3;
  }

  // Only an ellipsis trail-off is an unambiguous "this deserves a real
  // pause" signal (QA 2026-08-13 round 3, item 1) — a matter-of-fact quote
  // ("Ignorance is not bliss.") groups with its intro line but reads at
  // normal weight, while "But as the wheel kept spinning…" gets the pause.
  function isDramaticBeat(p) {
    return p.endsWith('...') || p.endsWith('…');
  }

  // A line ending in "…" explicitly signals "more is coming." If the very
  // next line completes that as a question, it belongs in the same group
  // even though it's too long to be "isolated" on its own — e.g. "and
  // truly changed because of it?" completing "...a correction...", or
  // "yet still haven't started living?" completing "...for months...".
  // A declarative continuation ("the clay would sometimes lose its
  // shape.") is deliberately NOT pulled in — that's the next sentence of
  // ordinary prose, not part of the question.
  function continuesEllipsisQuestion(prevLine, line) {
    return !!prevLine && isDramaticBeat(prevLine) && line.trim().endsWith('?');
  }

  // Mid-sequence continuation that isn't independently "isolated" and
  // doesn't complete a question: when the open beat line trails off with
  // "…" (an explicit unfinished-thought signal) and the next line starts
  // lowercase, it's this writer's grammatical continuation of that same
  // sentence ("...different people... / until someone finally says," / a
  // dialogue tag; "...isn't clear... / but because I don't like the answer
  // I've already received."), not a new independent line or a fresh prose
  // sentence (those start uppercase by ordinary grammar). Deliberately
  // narrower than "any lowercase line while a group is open" — that also
  // swallowed short, independently-isolated lines that just happened to
  // follow another isolated line, merging otherwise-separate beats/lists
  // that had no unfinished-thought signal between them. Requiring the
  // ellipsis keeps this to true sentence-continuations.
  function continuesSequence(prevLine, line) {
    if (!prevLine || !line || !isDramaticBeat(prevLine)) return false;
    const ch = line[0];
    return ch === ch.toLowerCase() && ch !== ch.toUpperCase();
  }

  // Three rhythms (QA round-3 item 1-2): normal prose, an intentional
  // pause, and major transitions (Mirror/Think markers, below) — and
  // "grouped" is orthogonal to that: a run of isolated lines renders as
  // one tight block (soft line breaks, no per-line margin) whether the
  // group itself reads at normal or pause weight. A completed question
  // (ends in "?") always closes its group, so "Think about it" renders as
  // separate question-groups rather than one long run.
  function renderBody(body, closingQuestion) {
    const paragraphs = body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    // Drop the trailing paragraph if it duplicates the closing question —
    // that line gets its own styled treatment below, so showing it twice reads as a mistake.
    if (closingQuestion && paragraphs.length) {
      const last = paragraphs[paragraphs.length - 1].trim();
      if (last === closingQuestion.trim()) paragraphs.pop();
    }

    const blocks = [];
    let proseBuffer = [];
    let beatBuffer = [];
    let lastBeatLine = null;
    const flushProse = () => {
      if (proseBuffer.length) { blocks.push({ kind: 'text', pause: false, grouped: false, lines: [proseBuffer.join(' ')] }); proseBuffer = []; }
    };
    const flushBeats = () => {
      if (beatBuffer.length) {
        const pause = beatBuffer.some(isDramaticBeat);
        blocks.push({ kind: 'text', pause, grouped: beatBuffer.length > 1, lines: beatBuffer });
      }
      beatBuffer = [];
      lastBeatLine = null;
    };
    paragraphs.forEach(p => {
      if (/^🪞/.test(p)) { flushProse(); flushBeats(); blocks.push({ kind: 'mirror', lines: [p] }); return; }
      if (/^💭/.test(p)) { flushProse(); flushBeats(); blocks.push({ kind: 'think', lines: [p] }); return; }
      if (isIsolatedBeat(p) || continuesEllipsisQuestion(lastBeatLine, p) || continuesSequence(lastBeatLine, p)) {
        flushProse();
        beatBuffer.push(p);
        lastBeatLine = p;
        if (p.trim().endsWith('?')) flushBeats(); // a completed question always ends its group
      } else {
        flushBeats();
        proseBuffer.push(p);
      }
    });
    flushProse();
    flushBeats();

    return blocks.map(b => {
      if (b.kind === 'mirror') return `<div class="mirror-marker">${escapeHtml(b.lines[0])}</div>`;
      if (b.kind === 'think') return `<div class="think-marker">${escapeHtml(b.lines[0])}</div>`;
      const classes = [b.pause && 'pause', b.grouped && 'sequence'].filter(Boolean);
      const classAttr = classes.length ? ` class="${classes.join(' ')}"` : '';
      const html = b.grouped ? b.lines.map(l => escapeHtml(l)).join('<br>') : escapeHtml(b.lines[0]);
      return `<p${classAttr}>${html}</p>`;
    }).join('');
  }

  // Ranked by strongest tag overlap first, not array order (QA round-2
  // item 19), so "On a similar theme" leads with the most genuinely
  // related entries, not just whichever happen to share one tag and come
  // first chronologically.
  function renderRelated(current) {
    const wrap = document.getElementById('related-wrap');
    const list = document.getElementById('related-list');
    const themes = current.themes || [];
    const related = entries
      .map(e => ({ entry: e, overlap: (e.themes || []).filter(t => themes.includes(t)).length }))
      .filter(({ entry, overlap }) => entry.slug !== current.slug && overlap > 0)
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, 5)
      .map(({ entry }) => entry);

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

  // For text landing inside an HTML attribute (alt="...") rather than element
  // text — quotes must be entity-escaped there or a title containing a
  // literal " truncates the attribute. escapeHtml() deliberately leaves
  // quotes literal for element text; this is the attribute-safe twin (same
  // split as build_pages.py's escape_html/escape_attr).
  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  }
})();
