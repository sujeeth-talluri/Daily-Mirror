// Share Reflection bottom sheet — shared by both the SPA (index.html) and
// every static per-entry page (entry/<slug>/index.html), so the sheet, the
// platform logic, and the copy templates exist in exactly one place instead
// of being maintained twice. Callers just do:
//
//   DailyMirrorShare.open({ title, day, date, hook, url, storyImageUrl })
//
// All platform text is built here, deterministically, from that plain data —
// no network call, no AI, nothing that can be slow or fail at share time.
(() => {
  const STATE = { entry: null, previousFocus: null, mode: 'main' };
  let els = null; // lazily created DOM refs

  // ---------- Platform copy templates (QA brief: personal, reflective, no
  // hashtags, minimal emoji, varied phrasing per platform — not the same
  // formula everywhere). Deliberately day-agnostic ("the Daily Mirror", not
  // "today's") since the same Share button is used on old entries too. ----------
  function buildWhatsAppText({ hook, title, url }) {
    return `${hook}\n\n"${title}" — I wrote this for the Daily Mirror. Take a look?\n${url}`;
  }

  function buildFacebookText({ hook, title }) {
    return `${hook}\n\n"${title}" on the Daily Mirror — a short pause for whoever needs it today.`;
  }

  // X wraps any URL to a flat 23 characters of its own (t.co), regardless of
  // real length, so the real text budget is 280 - 23 - 1 (space) = 256.
  function buildTwitterText({ hook, title }) {
    const base = `${hook}\n\n"${title}" — the Daily Mirror.`;
    const BUDGET = 256;
    if (base.length <= BUDGET) return base;
    let cut = base.slice(0, BUDGET - 1);
    if (cut.includes(' ')) cut = cut.slice(0, cut.lastIndexOf(' '));
    return cut + '…';
  }

  function buildInstagramCaption({ hook, title }) {
    return `${hook}\n\n"${title}" — the Daily Mirror`;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      prompt('Copy this:', text);
      return false;
    }
  }

  // Rows have nested icon/label/desc/chevron spans now, not plain text — swap
  // the .share-row-label (or .share-row-desc, if present) text specifically
  // rather than clobbering the whole button with btn.textContent. Plain
  // buttons ("More sharing options", "Copy Caption") still have no children,
  // so the fallback below covers those unchanged.
  function flashLabel(btn, message, revertMs = 1800) {
    const target = btn.querySelector('.share-row-desc') || btn.querySelector('.share-row-label') || btn;
    const original = target.textContent;
    target.textContent = message;
    setTimeout(() => { target.textContent = original; }, revertMs);
  }

  // ---------- DOM ----------
  function build() {
    const backdrop = document.createElement('div');
    backdrop.className = 'share-backdrop';
    backdrop.hidden = true;

    const ICON_STROKE = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
    // Simple, single-color geometric marks — not brand logos in brand colors
    // (QA round-4 item 4: "no platform brand-color explosion"). Each is
    // paired with its text label, which does the real identification work.
    const ICONS = {
      whatsapp: `<svg viewBox="0 0 24 24" ${ICON_STROKE}><path d="M12 3.5c-4.7 0-8.5 3.6-8.5 8 0 1.5.4 2.9 1.2 4.1L3.5 20l4.6-1.2c1.2.6 2.5 1 3.9 1 4.7 0 8.5-3.6 8.5-8s-3.8-8-8.5-8z"/></svg>`,
      instagram: `<svg viewBox="0 0 24 24" ${ICON_STROKE}><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="0.75" fill="currentColor" stroke="none"/></svg>`,
      facebook: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.5 21v-7.5h2.5l.4-3h-2.9V8.5c0-.9.2-1.5 1.5-1.5h1.6V4.3C17.3 4.2 16.3 4 15.2 4c-2.4 0-4 1.5-4 4.1V10.5H8.7v3H11.2V21h3.3z"/></svg>`,
      x: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4l7 8.5L4.4 20h2.1l5.8-6.6 4.4 6.6H21l-7.3-8.9L20 4h-2.1l-5.3 6-4-6H4z"/></svg>`,
    };

    const PLATFORMS = [
      { id: 'whatsapp', label: 'WhatsApp', desc: 'Share teaser' },
      { id: 'instagram', label: 'Instagram', desc: 'Share Story card' },
      { id: 'facebook', label: 'Facebook', desc: 'Share reflection' },
      { id: 'x', label: 'X', desc: 'Post reflection' },
    ];

    const rowHtml = ({ id, label, desc }) => `
      <button type="button" class="share-row" data-platform="${id}" aria-label="Share via ${label} — ${desc}">
        <span class="share-row-icon" aria-hidden="true">${ICONS[id]}</span>
        <span class="share-row-text">
          <span class="share-row-label">${label}</span>
          <span class="share-row-desc">${desc}</span>
        </span>
        <span class="share-row-chevron" aria-hidden="true">›</span>
      </button>`;

    backdrop.innerHTML = `
      <div class="share-sheet" role="dialog" aria-modal="true" aria-labelledby="share-sheet-title">
        <button type="button" class="share-close" aria-label="Close">×</button>
        <div class="share-main">
          <p class="share-title" id="share-sheet-title">Share this reflection</p>
          <div class="share-platform-list">
            ${PLATFORMS.map(rowHtml).join('')}
          </div>
          <button type="button" class="share-more-link" data-platform="more">More sharing options</button>
        </div>
        <div class="share-instagram" hidden>
          <button type="button" class="share-back">← Back</button>
          <p class="share-title">Share Story Card</p>
          <p class="share-instagram-hint">Add the link sticker once you're in Instagram.</p>
          <div class="share-instagram-actions">
            <button type="button" class="share-row share-row-plain" data-ig-action="share-card" aria-label="Share Story card">
              <span class="share-row-text"><span class="share-row-label">Share Story card</span></span>
              <span class="share-row-chevron" aria-hidden="true">›</span>
            </button>
            <button type="button" class="share-row share-row-plain" data-ig-action="copy-link" aria-label="Copy link">
              <span class="share-row-text"><span class="share-row-label">Copy Link</span></span>
              <span class="share-row-chevron" aria-hidden="true">›</span>
            </button>
            <button type="button" class="share-more-link" data-ig-action="copy-caption">Copy Caption</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    els = {
      backdrop,
      sheet: backdrop.querySelector('.share-sheet'),
      closeBtn: backdrop.querySelector('.share-close'),
      main: backdrop.querySelector('.share-main'),
      instagram: backdrop.querySelector('.share-instagram'),
      backBtn: backdrop.querySelector('.share-back'),
      platformBtns: backdrop.querySelectorAll('.share-row[data-platform]'),
      moreBtn: backdrop.querySelector('.share-more-link[data-platform="more"]'),
      igShareCard: backdrop.querySelector('[data-ig-action="share-card"]'),
      igCopyLink: backdrop.querySelector('[data-ig-action="copy-link"]'),
      igCopyCaption: backdrop.querySelector('[data-ig-action="copy-caption"]'),
    };

    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    els.closeBtn.addEventListener('click', close);
    els.backBtn.addEventListener('click', showMain);
    document.addEventListener('keydown', onKeydown);

    els.platformBtns.forEach((btn) => {
      btn.addEventListener('click', () => handlePlatform(btn.dataset.platform, btn));
    });
    els.igShareCard.addEventListener('click', () => shareStoryCard(els.igShareCard));
    els.igCopyLink.addEventListener('click', () => copyLink(els.igCopyLink));
    els.igCopyCaption.addEventListener('click', () => copyCaption(els.igCopyCaption));
  }

  function onKeydown(e) {
    if (els.backdrop.hidden) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    // Simple focus trap: cycle within whichever sub-view is visible.
    const visible = STATE.mode === 'instagram' ? els.instagram : els.main;
    const focusable = [els.closeBtn, ...visible.querySelectorAll('button, a[href]')]
      .filter((el) => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function showMain() {
    STATE.mode = 'main';
    els.main.hidden = false;
    els.instagram.hidden = true;
    els.platformBtns[0] && els.platformBtns[0].focus();
  }

  function showInstagram() {
    STATE.mode = 'instagram';
    els.main.hidden = true;
    els.instagram.hidden = false;
    els.igShareCard.focus();
  }

  function open(entry) {
    if (!els) build();
    STATE.entry = entry;
    STATE.previousFocus = document.activeElement;
    els.backdrop.hidden = false;
    document.body.style.overflow = 'hidden';
    showMain();
  }

  function close() {
    if (!els || els.backdrop.hidden) return;
    els.backdrop.hidden = true;
    document.body.style.overflow = '';
    if (STATE.previousFocus && STATE.previousFocus.focus) STATE.previousFocus.focus();
  }

  // ---------- Platform actions ----------
  function handlePlatform(platform, btn) {
    const e = STATE.entry;
    if (!e) return;
    if (platform === 'whatsapp') {
      const text = buildWhatsAppText(e);
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    } else if (platform === 'facebook') {
      const text = buildFacebookText(e);
      copyText(text).then((copied) => {
        if (copied) flashLabel(btn, 'Copied — paste above the link', 2200);
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(e.url)}`, '_blank', 'noopener');
      });
    } else if (platform === 'x') {
      const text = buildTwitterText(e);
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(e.url)}`;
      window.open(url, '_blank', 'noopener');
    } else if (platform === 'instagram') {
      showInstagram();
    } else if (platform === 'more') {
      shareNativeOrCopy(btn);
    }
  }

  function shareNativeOrCopy(btn) {
    const e = STATE.entry;
    const shareData = { title: e.title, text: e.hook || '', url: e.url };
    if (navigator.share) {
      navigator.share(shareData).catch(() => { /* user cancelled */ });
    } else {
      copyText(e.url).then((copied) => { if (copied) flashLabel(btn, 'Link copied'); });
    }
  }

  async function shareStoryCard(btn) {
    const e = STATE.entry;
    if (!e.storyImageUrl) { copyLink(btn); return; }
    try {
      const response = await fetch(e.storyImageUrl);
      if (!response.ok) throw new Error('story image not available');
      const blob = await response.blob();
      const file = new File([blob], 'daily-mirror-story.png', { type: blob.type || 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
      throw new Error('file sharing not supported');
    } catch (err) {
      // Graceful fallback: download the image directly rather than a failed share.
      const a = document.createElement('a');
      a.href = e.storyImageUrl;
      a.download = 'daily-mirror-story.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      flashLabel(btn, 'Downloaded');
    }
  }

  function copyLink(btn) {
    copyText(STATE.entry.url).then((copied) => { if (copied) flashLabel(btn, 'Copied'); });
  }

  function copyCaption(btn) {
    copyText(buildInstagramCaption(STATE.entry)).then((copied) => { if (copied) flashLabel(btn, 'Copied'); });
  }

  window.DailyMirrorShare = { open };
})();
