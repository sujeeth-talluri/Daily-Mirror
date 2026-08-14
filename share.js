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

  function flashLabel(btn, message, revertMs = 1800) {
    const original = btn.textContent;
    btn.textContent = message;
    setTimeout(() => { btn.textContent = original; }, revertMs);
  }

  // ---------- DOM ----------
  function build() {
    const backdrop = document.createElement('div');
    backdrop.className = 'share-backdrop';
    backdrop.hidden = true;

    backdrop.innerHTML = `
      <div class="share-sheet" role="dialog" aria-modal="true" aria-labelledby="share-sheet-title">
        <button type="button" class="share-close" aria-label="Close">×</button>
        <div class="share-main">
          <p class="share-title" id="share-sheet-title">Share this reflection</p>
          <div class="share-platform-list">
            <button type="button" class="share-platform-btn" data-platform="whatsapp">WhatsApp</button>
            <button type="button" class="share-platform-btn" data-platform="instagram">Instagram</button>
            <button type="button" class="share-platform-btn" data-platform="facebook">Facebook</button>
            <button type="button" class="share-platform-btn" data-platform="x">X</button>
          </div>
          <button type="button" class="share-more-link" data-platform="more">More sharing options</button>
        </div>
        <div class="share-instagram" hidden>
          <button type="button" class="share-back">← Back</button>
          <p class="share-title">Share Story Card</p>
          <p class="share-instagram-hint">Add the link sticker once you're in Instagram.</p>
          <div class="share-instagram-actions">
            <button type="button" class="share-platform-btn" data-ig-action="share-card">Share Story Card</button>
            <button type="button" class="share-platform-btn" data-ig-action="copy-link">Copy Link</button>
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
      platformBtns: backdrop.querySelectorAll('.share-platform-btn[data-platform]'),
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
