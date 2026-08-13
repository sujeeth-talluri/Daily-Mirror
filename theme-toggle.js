(() => {
  const STORAGE_KEY = 'daily-mirror-theme';

  function effectiveTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function apply(theme) {
    if (theme === 'light' || theme === 'dark') {
      document.documentElement.setAttribute('data-theme', theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    // Keeps the Android browser-chrome color matched to whatever theme is
    // actually showing, including a manual override that disagrees with
    // the OS preference (see the pre-paint script in <head> for the
    // pre-JS case).
    const meta = document.getElementById('theme-color-meta');
    if (meta) meta.setAttribute('content', effectiveTheme() === 'dark' ? '#1A1815' : '#F7F5F0');
  }

  function createToggle() {
    const btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Toggle dark mode');
    btn.textContent = effectiveTheme() === 'dark' ? '☀️' : '🌙';
    btn.addEventListener('click', () => {
      const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      localStorage.setItem(STORAGE_KEY, next);
      apply(next);
      btn.textContent = next === 'dark' ? '☀️' : '🌙';
    });
    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createToggle);
  } else {
    createToggle();
  }
})();
