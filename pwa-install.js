(() => {
  const DISMISS_KEY = 'daily-mirror-tips-dismissed';

  const banner = document.getElementById('tip-banner');
  const bannerClose = document.getElementById('tip-close');
  const tipInstallItem = document.getElementById('tip-install-item');
  const tipInstallBtn = document.getElementById('tip-install-btn');
  const headerInstallBtn = document.getElementById('header-install-btn');
  const headerInstallDot = document.getElementById('header-install-dot');
  const instructions = document.getElementById('install-instructions');
  const instructionsClose = document.getElementById('install-instructions-close');

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  let deferredPrompt = null;

  function showInstallAffordances() {
    if (isStandalone) return;
    tipInstallItem.hidden = false;
    headerInstallBtn.hidden = false;
    headerInstallDot.hidden = false;
  }

  function hideInstallAffordances() {
    tipInstallItem.hidden = true;
    headerInstallBtn.hidden = true;
    headerInstallDot.hidden = true;
  }

  function runInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(() => { deferredPrompt = null; });
    } else {
      instructions.hidden = false;
    }
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallAffordances();
  });

  window.addEventListener('appinstalled', hideInstallAffordances);

  // iOS Safari never fires beforeinstallprompt, so offer the manual steps directly.
  if (isIOS && !isStandalone) {
    showInstallAffordances();
  }

  tipInstallBtn.addEventListener('click', runInstall);
  headerInstallBtn.addEventListener('click', runInstall);
  instructionsClose.addEventListener('click', () => { instructions.hidden = true; });

  if (!isStandalone && localStorage.getItem(DISMISS_KEY) !== '1') {
    banner.hidden = false;
  }

  bannerClose.addEventListener('click', () => {
    localStorage.setItem(DISMISS_KEY, '1');
    banner.hidden = true;
  });
})();
