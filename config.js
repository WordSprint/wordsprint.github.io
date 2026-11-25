const WS_CONFIG = {
  SUPABASE_URL: 'https://lbmyaivuprfdetdymioj.supabase.co/rest/v1/',
  SUPABASE_KEY: 'sb_publishable_bxVIJPkFbxF7cooVc6HxJQ_C3yTpetr',
  ADMIN_PASSWORD: 'wordsprint2026',
  SITE_URL: 'https://wordsprint.github.io/',
  BOOSTY_URL: 'https://boosty.to/wordsprint/donate',
  PRIVACY_URL: 'https://aesthetic-tiramisu-4416cd.netlify.app'
};

(function initTheme() {
  const saved = localStorage.getItem('ws_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('ws_theme', next);
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = next === 'dark' ? '☀️' : '🌙';
}

window.addEventListener('DOMContentLoaded', () => {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  const btn = document.getElementById('themeToggleBtn');
  if (btn) btn.textContent = cur === 'dark' ? '☀️' : '🌙';
});

async function sbFetch(table, options = {}) {
  const { method = 'GET', query = '', body = null, prefer = 'return=representation' } = options;
  const base = WS_CONFIG.SUPABASE_URL.endsWith('/') ? WS_CONFIG.SUPABASE_URL : WS_CONFIG.SUPABASE_URL + '/';
  const url = `${base}${table}${query ? '?' + query : ''}`;

  const res = await fetch(url, {
    method,
    headers: {
      'apikey': WS_CONFIG.SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': prefer
    },
    body: body ? JSON.stringify(body) : null
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function generateShortCode(prefix, customBase = '') {
  if (customBase) {
    const clean = customBase.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const num = Math.floor(10 + Math.random() * 89);
    return `${prefix}-${clean || 'PRO'}${num}`;
  }
  return `${prefix}-${Math.floor(100 + Math.random() * 900)}`;
}
