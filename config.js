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

async function appSbFetch(table, opts = {}) {
  const { method = 'GET', query = '', body = null } = opts;
  const res = await fetch(`${SB_URL}${table}${query ? '?' + query : ''}`, {
    method,
    headers: {
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: body ? JSON.stringify(body) : null
  });
  if (!res.ok) throw new Error(await res.text());
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}


function sbFirst(data) {
  return Array.isArray(data) ? (data.at(0) || null) : data;
}

function generateShortCode(prefix) {
  return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function getRankByXp(xp) {
  if (xp >= 2500) return 'Мастер слов';
  if (xp >= 1200) return 'Эксперт';
  if (xp >= 500) return 'Знаток';
  if (xp >= 150) return 'Спринтер';
  return 'Новичок';
}

async function sendAppNotification(targetId, title, body, link = '') {
  if (!targetId) return;
  try {
    await sbFetch('notifications', {
      method: 'POST',
      body: { target_id: targetId, title, body, link }
    });
  } catch (e) { console.error(e); }
}

function getCurrentUserProfile() {
  try {
    return JSON.parse(localStorage.getItem('ws_user_profile') || 'null');
  } catch (e) { return null; }
}
