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
(function initFavicon() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Синий фон со скруглёнными углами
    ctx.fillStyle = '#3b4cc0';
    ctx.beginPath();
    ctx.roundRect(0, 0, 64, 64, 14);
    ctx.fill();

    // Белая молния по центру (удали следующие 8 строк, если нужен просто сплошной синий квадрат)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(36, 10);
    ctx.lineTo(16, 36);
    ctx.lineTo(31, 36);
    ctx.lineTo(28, 54);
    ctx.lineTo(48, 28);
    ctx.lineTo(33, 28);
    ctx.closePath();
    ctx.fill();

    const pngUrl = canvas.toDataURL('image/png');
    document.querySelectorAll("link[rel*='icon']").forEach(el => el.remove());

    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.sizes = '64x64';
    link.href = pngUrl;
    document.head.appendChild(link);
  } catch (e) {}
})();


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

const WS_RANKS = [
  { min: 0, title: 'Новичок' },
  { min: 250, title: 'Ученик' },
  { min: 750, title: 'Спринтер' },
  { min: 1800, title: 'Знаток' },
  { min: 4000, title: 'Эксперт' },
  { min: 8000, title: 'Полиглот' },
  { min: 15000, title: 'Мастер слов' },
  { min: 25000, title: 'Легенда WordSprint' }
];

function getRankByXp(xp) {
  let current = WS_RANKS.at(0).title;
  for (const r of WS_RANKS) {
    if (xp >= r.min) current = r.title;
  }
  return current;
}

function getRankProgress(xp) {
  let curIdx = 0;
  for (let i = 0; i < WS_RANKS.length; i++) {
    if (xp >= WS_RANKS.at(i).min) curIdx = i;
  }
  const cur = WS_RANKS.at(curIdx);
  const next = WS_RANKS.at(curIdx + 1);
  if (!next) return { title: cur.title, nextTitle: null, pct: 100, label: `${xp} XP (Максимальный ранг!)` };
  const span = next.min - cur.min;
  const done = Math.max(0, xp - cur.min);
  const pct = Math.min(100, Math.round((done / span) * 100));
  return { title: cur.title, nextTitle: next.title, pct, label: `${xp} / ${next.min} XP до «${next.title}»` };
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
async function hashPassword(plain) {
  const salted = `WS_SALT_2026:${String(plain)}`;
  if (window.crypto && window.crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salted));
    const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `sha256:${hex}`;
  }
  // Резервный хеш, если страница открыта без HTTPS
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < salted.length; i++) {
    const ch = salted.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `sha256:${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}
