const WS_CONFIG = {
  SUPABASE_URL: 'https://lbmyaivuprfdetdymioj.supabase.co/rest/v1/',
  SUPABASE_KEY: 'sb_publishable_bxVIJPkFbxF7cooVc6HxJQ_C3yTpetr',
  ADMIN_PASSWORD: 'wordsprint2026',
  SITE_URL: ' https://wordsprint.github.io/',
  BOOSTY_URL: 'https://boosty.to/wordsprint/donate',
  PRIVACY_URL: 'https://aesthetic-tiramisu-4416cd.netlify.app',
  EMAILJS_PUBLIC_KEY: 'YkfVn2Q1E2OpaTj_R',
  EMAILJS_SERVICE_ID: 'service_326zpuc',
  EMAILJS_TEMPLATE_ID: 'template_ofg2u88'
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

async function sendEmailAlert(toEmail, toName, subject, message, link = '') {
  if (!toEmail || !WS_CONFIG.EMAILJS_PUBLIC_KEY) return;
  const fullLink = link
    ? (link.startsWith('http') ? link : `${WS_CONFIG.SITE_URL.replace(/\/$/, '')}/${link.replace(/^\//, '')}`)
    : WS_CONFIG.SITE_URL;
  try {
    await fetch('https://emailjs.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: WS_CONFIG.EMAILJS_SERVICE_ID,
        template_id: WS_CONFIG.EMAILJS_TEMPLATE_ID,
        user_id: WS_CONFIG.EMAILJS_PUBLIC_KEY,
        template_params: { to_email: toEmail, to_name: toName || 'Участник', subject, message, link: fullLink }
      })
    });
  } catch (e) { console.error('Email error:', e); }
}

async function sendAppNotification(targetId, title, body, link = '') {
  if (!targetId) return;
  try {
    await sbFetch('notifications', {
      method: 'POST',
      body: { target_id: targetId, title, body, link }
    });

    if (targetId.startsWith('WSU-')) {
      const rows = await sbFetch('profiles', { query: `user_id=eq.${encodeURIComponent(targetId)}` });
      const u = sbFirst(rows);
      if (u && u.email) await sendEmailAlert(u.email, u.nickname, title, body, link);
    } else if (targetId.startsWith('WS-') || targetId.startsWith('TCH-') || targetId.startsWith('SCH-')) {
      const rows = await sbFetch('teachers', { query: `code=eq.${encodeURIComponent(targetId)}` });
      const t = sbFirst(rows);
      if (t && t.email) await sendEmailAlert(t.email, t.name, title, body, link);
    }
  } catch (e) { console.error(e); }
}

function getCurrentUserProfile() {
  try {
    return JSON.parse(localStorage.getItem('ws_user_profile') || 'null');
  } catch (e) { return null; }
}
