(() => {
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
    headerInstallBtn.hidden = false;
    headerInstallDot.hidden = false;
  }

  function hideInstallAffordances() {
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

  headerInstallBtn.addEventListener('click', runInstall);
  instructionsClose.addEventListener('click', () => { instructions.hidden = true; });
})();
