let currentTeacher = null;
let staffMember = null;
let selectedMode = 'translate';
let lastPublishedCode = '';
let lastPublishedTitle = '';
let lastPublishedGroup = 'Все ученики';
let cachedLessons = [];
let cachedStudents = [];
let cachedResults = [];
let topMistakesList = [];
let awardTarget = null;
let editingLessonId = null;

function copyText(text, msg) {
  navigator.clipboard.writeText(text);
  alert(msg || 'Скопировано!');
}

function hasActivePlus(t) {
  if (!t) return false;
  if (t.plus_until) return new Date(t.plus_until) > new Date();
  return t.is_plus === true;
}

async function registerTeacher() {
  const role = document.getElementById('regRole').value;
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const city_format = document.getElementById('regCity').value.trim();
  const level = document.getElementById('regLevel').value.trim();
  const proof_url = document.getElementById('regProof').value.trim();
  const telegram = document.getElementById('regTelegram').value.trim();
  const bio = document.getElementById('regBio').value.trim();

  if (!name || !email || !telegram || !proof_url) {
    return alert('Пожалуйста, заполните имя/название, Email, документы и контакт!');
  }

  const btn = document.getElementById('regTeacherBtn');
  btn.disabled = true; btn.textContent = '⏳ Отправка...';
  try {
    const code = generateShortCode(role === 'school' ? 'SCH' : 'WS');
    const data = await sbFetch('teachers', {
      method: 'POST',
      body: { code, name, email, city_format, level, proof_url, telegram, bio, verified: false, status: 'pending', is_plus: false }
    });
    const created = sbFirst(data);
    if (created && created.code) {
      localStorage.setItem('ws_teacher_code', code);
      setActiveTeacher(created, null);
    }
  } catch (e) {
    alert('Ошибка регистрации: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = '🚀 Отправить заявку';
  }
}

async function loginTeacher() {
  const rawCode = document.getElementById('loginTeacherCode').value.trim().toUpperCase();
  if (!rawCode) return alert('Введите код!');
  try {
    const parts = rawCode.split('-');
    const baseCode = parts.length >= 3 ? `${parts.at(0)}-${parts.at(1)}` : rawCode;
    const rows = await sbFetch('teachers', { query: `code=eq.${encodeURIComponent(baseCode)}` });
    const teacher = sbFirst(rows);
    if (!teacher || !teacher.code) return alert('Партнёр с таким кодом не найден.');

    let foundStaff = null;
    if (parts.length >= 3) {
      const staffList = Array.isArray(teacher.staff) ? teacher.staff : [];
      foundStaff = staffList.find(st => String(st.code || '').toUpperCase() === rawCode);
      if (!foundStaff) return alert('Преподаватель школы с таким персональным кодом не найден.');
    }

    localStorage.setItem('ws_teacher_code', rawCode);
    setActiveTeacher(teacher, foundStaff);
  } catch (e) {
    alert('Ошибка входа: ' + e.message);
  }
}

function logoutTeacher() {
  localStorage.removeItem('ws_teacher_code');
  currentTeacher = null;
  staffMember = null;
  document.getElementById('pageMainTitle').textContent = 'Кабинет преподавателя';
  document.getElementById('profileHeaderCard').classList.add('hidden');
  document.getElementById('verifiedWorkspace').classList.add('hidden');
  document.getElementById('bonusModalBtn').classList.add('hidden');
  document.getElementById('guestLoginBar').classList.remove('hidden');
  document.getElementById('guestRegisterCard').classList.remove('hidden');
}

function setActiveTeacher(t, staffObj) {
  currentTeacher = t;
  staffMember = staffObj;
  const isSchool = String(t.code || '').startsWith('SCH-');
  const plusActive = hasActivePlus(t);

  if (staffObj) {
    document.getElementById('pageMainTitle').textContent = `Кабинет учителя школы (${t.name})`;
    document.getElementById('profileRoleSubtitle').textContent = `Преподаватель школы • Группа: ${staffObj.group}`;
    document.getElementById('dashTeacherName').textContent = staffObj.name;
    document.getElementById('dashTeacherCode').textContent = staffObj.code;
  } else {
    document.getElementById('pageMainTitle').textContent = isSchool ? 'Кабинет школы' : 'Кабинет преподавателя';
    document.getElementById('profileRoleSubtitle').textContent = isSchool ? 'Кабинет директора школы' : 'Профиль репетитора';
    document.getElementById('dashTeacherName').textContent = t.name || '—';
    document.getElementById('dashTeacherCode').textContent = t.code || '—';
  }

  document.getElementById('guestLoginBar').classList.add('hidden');
  document.getElementById('guestRegisterCard').classList.add('hidden');
  document.getElementById('profileHeaderCard').classList.remove('hidden');

  const badge = document.getElementById('dashVerifyStatus');
  const notice = document.getElementById('pendingNoticeText');
  const workspace = document.getElementById('verifiedWorkspace');

  if (t.status === 'approved' || t.verified === true) {
    badge.className = 'tag-ok';
    badge.textContent = plusActive ? '✅ Подтверждён • ✨ Партнёр Плюс' : '✅ Подтверждён';
    notice.classList.add('hidden');
    workspace.classList.remove('hidden');
    document.getElementById('bonusModalBtn').classList.remove('hidden');

    if (isSchool && !staffObj) document.getElementById('tabBtnSchool').classList.remove('hidden');
    else document.getElementById('tabBtnSchool').classList.add('hidden');

    if (plusActive) {
      document.getElementById('customCodeWrap').classList.remove('hidden');
      document.getElementById('exportCsvBtn').classList.remove('hidden');
      const untilStr = t.plus_until ? new Date(t.plus_until).toLocaleDateString('ru-RU') : 'активна';
      document.getElementById('plusStatusBanner').innerHTML = `<span class="tag-ok">✨ Подписка «Партнёр Плюс» активна до ${untilStr}</span>`;
    } else {
      document.getElementById('customCodeWrap').classList.add('hidden');
      document.getElementById('exportCsvBtn').classList.add('hidden');
      document.getElementById('plusStatusBanner').textContent = 'Статус: Базовый (все основные функции бесплатны)';
    }

    document.getElementById('teacherCallLinkInput').value = t.call_link || '';
    document.getElementById('profileAnnouncement').value = t.announcement || '';
    document.getElementById('profileCity').value = t.city_format || '';
    document.getElementById('profileLevel').value = t.level || '';
    document.getElementById('profileTelegram').value = t.telegram || '';
    document.getElementById('profileBio').value = t.bio || '';

    renderGroupSelectors();
    renderScheduleList();
    renderSchoolStaff();
    restoreDraftOrInit();
    loadTeacherData();
  } else if (t.status === 'rejected') {
    badge.className = 'tag-rej';
    badge.textContent = '❌ Заявка не одобрена';
    notice.classList.remove('hidden');
    notice.style.color = 'var(--danger)';
    notice.textContent = 'Ваша заявка не одобрена. Причину отказа мы отправили вам на почту, указанную при регистрации.';
    workspace.classList.add('hidden');
  } else {
    badge.className = 'tag-wait';
    badge.textContent = '⏳ На проверке';
    notice.classList.remove('hidden');
    notice.style.color = 'var(--muted)';
    notice.textContent = 'Ваша анкета и документы проверяются модератором. После одобрения на почту придёт уведомление и здесь откроется рабочий кабинет.';
    workspace.classList.add('hidden');
  }
}

function switchWorkspaceTab(tab) {
  const map = {
    editor: ['tabBtnEditor', 'paneEditor'],
    lessons: ['tabBtnLessons', 'paneLessons'],
    students: ['tabBtnStudents', 'paneStudents'],
    journal: ['tabBtnJournal', 'paneJournal'],
    schedule: ['tabBtnSchedule', 'paneSchedule'],
    school: ['tabBtnSchool', 'paneSchool'],
    profile: ['tabBtnProfile', 'paneProfile']
  };
  Object.values(map).forEach(pair => {
    const b = document.getElementById(pair.at(0));
    const p = document.getElementById(pair.at(1));
    if (b) b.classList.remove('active');
    if (p) p.classList.add('hidden');
  });
  const target = map[tab];
  if (target) {
    document.getElementById(target.at(0)).classList.add('active');
    document.getElementById(target.at(1)).classList.remove('hidden');
  }
}
async function activatePlusKey() {
  const key = document.getElementById('plusKeyInput').value.trim().toUpperCase();
  if (!key) return alert('Введите ключ активации!');
  try {
    const rows = await sbFetch('plus_keys', { query: `key_code=eq.${encodeURIComponent(key)}` });
    const found = sbFirst(rows);
    if (!found) return alert('Ключ не найден. Проверьте правильность ввода.');
    if (found.used_by) return alert('Этот ключ уже был активирован ранее.');

    const baseDate = hasActivePlus(currentTeacher) && currentTeacher.plus_until ? new Date(currentTeacher.plus_until) : new Date();
    baseDate.setDate(baseDate.getDate() + (found.days || 30));
    const plus_until = baseDate.toISOString();

    await Promise.all([
      sbFetch('plus_keys', { method: 'PATCH', query: `key_code=eq.${encodeURIComponent(key)}`, body: { used_by: currentTeacher.code, used_at: new Date().toISOString() } }),
      sbFetch('teachers', { method: 'PATCH', query: `id=eq.${currentTeacher.id}`, body: { is_plus: true, plus_until } })
    ]);

    currentTeacher.is_plus = true;
    currentTeacher.plus_until = plus_until;
    document.getElementById('plusKeyInput').value = '';
    setActiveTeacher(currentTeacher, staffMember);
    alert(`Подписка «Партнёр Плюс» активирована до ${baseDate.toLocaleDateString('ru-RU')}!`);
  } catch (e) { alert('Ошибка активации: ' + e.message); }
}

function selectLessonMode(mode) {
  selectedMode = mode;
  document.querySelectorAll('.mode-card').forEach(c => c.classList.toggle('active', c.dataset.mode === mode));
  const hints = {
    translate: 'Ученик увидит английское слово и выберет 1 из 4 вариантов перевода.',
    listening: 'Слово будет скрыто — ученик прослушает озвучку и выберет перевод на слух.',
    spelling: 'Ученик увидит русский перевод и должен сам напечатать английское слово без ошибок.',
    mixed: 'Слова будут чередоваться: половина на выбор перевода, половина на письменный ввод.'
  };
  document.getElementById('modeDescriptionHint').textContent = hints[mode] || '';
  autoSaveDraft();
}

function updateEstimateLabel() {
  const count = document.querySelectorAll('#wordRowsContainer .word-row').length;
  const mins = Math.max(1, Math.round(count * 0.35));
  document.getElementById('lessonEstimateLabel').textContent = `Слов в списке: ${count} • ~${mins} мин на выполнение`;
}

function autoSaveDraft() {
  if (!currentTeacher || editingLessonId) return;
  localStorage.setItem(`ws_draft_${currentTeacher.code}`, JSON.stringify(collectEditorData()));
  updateEstimateLabel();
}

function restoreDraftOrInit() {
  const raw = localStorage.getItem(`ws_draft_${currentTeacher.code}`);
  if (raw) {
    try {
      const d = JSON.parse(raw);
      if (d.title || (d.words && d.words.length > 0)) {
        document.getElementById('lessonTitle').value = d.title || '';
        document.getElementById('lessonDeadline').value = d.deadline || '';
        document.getElementById('lessonMediaUrl').value = d.media_url || '';
        document.getElementById('lessonTheoryText').value = d.theory_text || '';
        document.getElementById('lessonInstruction').value = (d.settings && d.settings.instruction) || '';
        selectLessonMode(d.mode || 'translate');
        document.getElementById('wordRowsContainer').innerHTML = '';
        (d.words || []).forEach(w => addWordRow(w.en, w.ru, w.hint || '', w.img || ''));
        while (document.querySelectorAll('#wordRowsContainer .word-row').length < 4) addWordRow();
        updateEstimateLabel();
        return;
      }
    } catch (e) { console.error(e); }
  }
  initWordRows();
}

function initWordRows() {
  const box = document.getElementById('wordRowsContainer');
  box.innerHTML = '';
  for (let i = 0; i < 4; i++) addWordRow();
  updateEstimateLabel();
}

function speakPreviewWord(btn) {
  const word = btn.closest('.word-row').querySelector('.w-en').value.trim();
  if (!word) return;
  const u = new SpeechSynthesisUtterance(word);
  u.lang = 'en-US'; u.rate = 0.9;
  speechSynthesis.speak(u);
}

function addWordRow(en = '', ru = '', hint = '', img = '') {
  const box = document.getElementById('wordRowsContainer');
  const row = document.createElement('div');
  row.className = 'word-row';
  row.dataset.img = img || '';
  row.innerHTML = `
    <input type="text" class="w-en" placeholder="Английское слово" value="${en}">
    <input type="text" class="w-ru" placeholder="Перевод (Enter → след.)" value="${ru}">
    <input type="text" class="w-hint" placeholder="Пример предложения (Enter → след.)" value="${hint}">
    <div class="row-actions">
      <button type="button" class="btn btn-secondary btn-sm" onclick="speakPreviewWord(this)" title="Послушать">🔊</button>
      <button type="button" class="btn btn-secondary btn-sm" onclick="triggerWordImageUpload(this)" title="Загрузить фото к слову">${img ? '✅' : '🖼️'}</button>
      <input type="file" accept="image/*" class="hidden w-img-file" onchange="uploadWordImageFile(this)">
      <button type="button" class="btn btn-secondary btn-sm" onclick="saveWordToBank(this)" title="В мой словарь">★</button>
      <button type="button" class="btn btn-del btn-sm" onclick="this.closest('.word-row').remove(); autoSaveDraft();" title="Удалить">✕</button>
    </div>
  `;

  row.querySelectorAll('input[type="text"]').forEach(inp => {
    inp.addEventListener('input', autoSaveDraft);
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (inp.classList.contains('w-en')) {
          row.querySelector('.w-ru').focus();
        } else {
          const newRow = addWordRow();
          newRow.querySelector('.w-en').focus();
          autoSaveDraft();
        }
      }
    });
  });

  box.appendChild(row);
  updateEstimateLabel();
  return row;
}
function triggerWordImageUpload(btn) {
  const row = btn.closest('.word-row');
  if (row.dataset.img && confirm('Удалить картинку у этого слова? (Нажмите «Отмена», чтобы выбрать другую)')) {
    row.dataset.img = '';
    btn.textContent = '🖼️';
    autoSaveDraft();
    return;
  }
  row.querySelector('.w-img-file').click();
}

async function uploadWordImageFile(input) {
  const file = input.files && input.files.item(0);
  if (!file) return;
  if (file.size > 15 * 1024 * 1024) return alert('Картинка не должна превышать 15 МБ.');

  const row = input.closest('.word-row');
  const btn = row.querySelector('button[title="Загрузить фото к слову"]');
  btn.textContent = '⏳';

  try {
    const ext = file.name.split('.').pop();
    const fileName = `word_${currentTeacher.code}_${Date.now()}.${ext}`;
    const storageRoot = WS_CONFIG.SUPABASE_URL.replace('/rest/v1/', '/storage/v1');
    const res = await fetch(`${storageRoot}/object/lesson-media/${fileName}`, {
      method: 'POST',
      headers: { 'apikey': WS_CONFIG.SUPABASE_KEY, 'Authorization': `Bearer ${WS_CONFIG.SUPABASE_KEY}`, 'Content-Type': file.type || 'image/jpeg' },
      body: file
    });
    if (!res.ok) throw new Error(await res.text());
    row.dataset.img = `${storageRoot}/object/public/lesson-media/${fileName}`;
    btn.textContent = '✅';
    autoSaveDraft();
  } catch (e) {
    btn.textContent = '🖼️';
    alert('Ошибка загрузки картинки: ' + e.message);
  }
}

async function saveWordToBank(btn) {
  const row = btn.closest('.word-row');
  const en = row.querySelector('.w-en').value.trim();
  const ru = row.querySelector('.w-ru').value.trim();
  const hint = row.querySelector('.w-hint').value.trim();
  if (!en || !ru) return alert('Сначала заполните слово и перевод!');

  const saved = Array.isArray(currentTeacher.saved_words) ? [...currentTeacher.saved_words] : [];
  if (saved.some(w => w.en.toLowerCase() === en.toLowerCase())) return alert('Это слово уже есть в вашем словаре!');
  saved.push({ en, ru, hint });
  await sbFetch('teachers', { method: 'PATCH', query: `id=eq.${currentTeacher.id}`, body: { saved_words: saved } });
  currentTeacher.saved_words = saved;
  btn.textContent = '⭐';
  alert(`Слово «${en}» сохранено в Мой словарь!`);
}

function openSavedWordsModal() {
  const list = Array.isArray(currentTeacher.saved_words) ? currentTeacher.saved_words : [];
  const box = document.getElementById('savedWordsList');
  box.innerHTML = list.length ? list.map((w, idx) => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border);">
      <div><b>${w.en}</b> — ${w.ru}</div>
      <button class="btn btn-sm" onclick="insertSavedWord(${idx})">+ В урок</button>
    </div>
  `).join('') : '<p style="color:var(--muted); font-size:0.9rem;">Ваш словарь пока пуст.</p>';
  document.getElementById('savedWordsModal').style.display = 'flex';
}

function insertSavedWord(idx) {
  const w = currentTeacher.saved_words.at(idx);
  if (w) { addWordRow(w.en, w.ru, w.hint || ''); autoSaveDraft(); }
}

function toggleBulkImport() { document.getElementById('bulkImportBox').classList.toggle('hidden'); }

function parseBulkLines(text) {
  return text.split('\n').map(l => l.replace(/^\d+[\.\)\-\s]+/, '').trim()).filter(Boolean).map(line => {
    const parts = line.split(/\t|[-—–:=]/);
    if (parts.length >= 2) {
      const en = parts.at(0).trim();
      const ru = parts.slice(1).join('-').trim();
      if (en && ru) return { en, ru };
    }
    return null;
  }).filter(Boolean);
}

function previewBulkCount() {
  const parsed = parseBulkLines(document.getElementById('bulkWordsText').value);
  document.getElementById('bulkCountLabel').textContent = `Распознано слов: ${parsed.length}`;
}

function applyBulkImport() {
  const parsed = parseBulkLines(document.getElementById('bulkWordsText').value);
  if (!parsed.length) return alert('Не удалось распознать слова. Формат: слово - перевод');
  document.getElementById('wordRowsContainer').innerHTML = '';
  parsed.forEach(w => addWordRow(w.en, w.ru, ''));
  document.getElementById('bulkWordsText').value = '';
  document.getElementById('bulkImportBox').classList.add('hidden');
  autoSaveDraft();
}

async function uploadLessonMedia(input) {
  const file = input.files && input.files.item(0);
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) return alert('Файл превышает лимит 50 МБ.');
  const statusEl = document.getElementById('uploadStatusText');
  statusEl.textContent = '⏳ Загружаем файл...';
  try {
    const ext = file.name.split('.').pop();
    const fileName = `${currentTeacher.code}_${Date.now()}.${ext}`;
    const storageRoot = WS_CONFIG.SUPABASE_URL.replace('/rest/v1/', '/storage/v1');
    const res = await fetch(`${storageRoot}/object/lesson-media/${fileName}`, {
      method: 'POST',
      headers: { 'apikey': WS_CONFIG.SUPABASE_KEY, 'Authorization': `Bearer ${WS_CONFIG.SUPABASE_KEY}`, 'Content-Type': file.type || 'application/octet-stream' },
      body: file
    });
    if (!res.ok) throw new Error(await res.text());
    document.getElementById('lessonMediaUrl').value = `${storageRoot}/object/public/lesson-media/${fileName}`;
    statusEl.textContent = `✅ Загружен: ${file.name}`;
    autoSaveDraft();
  } catch (e) { statusEl.textContent = ''; alert('Ошибка загрузки: ' + e.message); }
}

function addMediaQuestionRow(qText = '', opts = ['', '', ''], correctIdx = 0) {
  const box = document.getElementById('mediaQuestionsEditor');
  const div = document.createElement('div');
  div.className = 'mq-edit-item';
  div.style.cssText = 'background:var(--card); border:1px solid var(--border); border-radius:10px; padding:10px; margin-bottom:8px;';
  const radioName = 'mq_corr_' + Math.random().toString(36).slice(2, 7);
  const optionsHtml = Array.from({ length: 3 }, (_, i) => `
    <div style="display:flex; align-items:center; gap:6px; margin-top:4px;">
      <input type="radio" name="${radioName}" value="${i}" ${correctIdx === i ? 'checked' : ''} style="width:auto;">
      <input type="text" class="mq-opt" placeholder="Вариант ${i + 1}" value="${opts.at(i) || ''}" style="padding:7px 10px; font-size:0.86rem;">
    </div>
  `).join('');
  div.innerHTML = `<div style="display:flex; gap:6px; margin-bottom:6px;"><input type="text" class="mq-q" placeholder="Вопрос по материалу" value="${qText}"><button type="button" class="btn btn-del btn-sm" onclick="this.closest('.mq-edit-item').remove()">✕</button></div>${optionsHtml}`;
  box.appendChild(div);
}

function collectEditorData() {
  const title = document.getElementById('lessonTitle').value.trim();
  const target_group = document.getElementById('lessonTargetGroup').value;
  const deadline = document.getElementById('lessonDeadline').value.trim();
  const media_url = document.getElementById('lessonMediaUrl').value.trim();
  const theory_text = document.getElementById('lessonTheoryText').value.trim();
  const instruction = document.getElementById('lessonInstruction').value.trim();
  const repeatErrors = document.getElementById('optRepeatErrors').checked;
  const shuffle = document.getElementById('optShuffle').checked;

  const words = [];
  document.querySelectorAll('#wordRowsContainer .word-row').forEach(r => {
    const en = r.querySelector('.w-en').value.trim();
    const ru = r.querySelector('.w-ru').value.trim();
    const hint = r.querySelector('.w-hint').value.trim();
    const img = r.dataset.img || '';
    if (en && ru) words.push({ en, ru, hint, img });
  });

  const media_questions = [];
  document.querySelectorAll('#mediaQuestionsEditor .mq-edit-item').forEach(item => {
    const question = item.querySelector('.mq-q').value.trim();
    const options = Array.from(item.querySelectorAll('.mq-opt')).map(i => i.value.trim()).filter(Boolean);
    const checkedRadio = item.querySelector('input[type="radio"]:checked');
    const correctIndex = checkedRadio ? parseInt(checkedRadio.value, 10) : 0;
    if (question && options.length >= 2) media_questions.push({ question, options, correctIndex });
  });

  return {
    title, target_group, deadline, media_url, theory_text, media_questions,
    author_name: staffMember ? staffMember.name : currentTeacher.name,
    mode: selectedMode, words,
    settings: { repeatErrors, shuffle, instruction }
  };
}
async function saveLesson(status) {
  const data = collectEditorData();
  if (!data.title) return alert('Введите название урока!');
  if (data.words.length < 4) return alert('Добавьте минимум 4 слова с переводом!');

  let code = generateShortCode('LESSON');
  const custom = document.getElementById('customLessonCode').value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (hasActivePlus(currentTeacher) && custom.length >= 3) code = custom;

  try {
    if (editingLessonId) {
      await sbFetch('lessons', { method: 'PATCH', query: `id=eq.${editingLessonId}`, body: { ...data, lesson_status: status } });
      code = lastPublishedCode;
      editingLessonId = null;
      document.getElementById('editorHeading').textContent = 'Конструктор урока';
    } else {
      await sbFetch('lessons', { method: 'POST', body: { ...data, code, teacher_code: currentTeacher.code, lesson_status: status } });
    }

    localStorage.removeItem(`ws_draft_${currentTeacher.code}`);
    lastPublishedCode = code;
    lastPublishedTitle = data.title;
    lastPublishedGroup = data.target_group;

    if (status === 'active') {
      const base = WS_CONFIG.SITE_URL.replace(/\/$/, '');
      const dl = data.deadline ? `\n⏰ Срок сдачи: ${data.deadline}` : '';
      const defaultMsg = `📚 Новое домашнее задание в WordSprint от ${data.author_name}!\n📝 Тема: «${data.title}»\n🔑 Код урока: ${code}${dl}\n🔗 Пройти урок: ${base}/lesson.html?code=${code}`;
      document.getElementById('publishedLessonCode').textContent = code;
      document.getElementById('publishedCustomMessage').value = defaultMsg;
      document.getElementById('lessonPublishedBox').classList.remove('hidden');

      const recipients = cachedStudents.filter(s => !s.is_archived && s.user_id && (data.target_group === 'Все ученики' || s.group_name === data.target_group));
      for (const st of recipients) {
        await sendAppNotification(st.user_id, `📚 Новое ДЗ: ${data.title}`, `Код урока: ${code}${data.deadline ? ' • Срок: ' + data.deadline : ''}`, `lesson.html?code=${code}`);
      }
    } else {
      alert('Урок сохранён в черновики!');
    }

    resetEditorForm();
    await loadTeacherData();
  } catch (e) { alert('Ошибка сохранения урока: ' + e.message); }
}

function resetEditorForm() {
  document.getElementById('lessonTitle').value = '';
  document.getElementById('lessonDeadline').value = '';
  document.getElementById('customLessonCode').value = '';
  document.getElementById('lessonTheoryText').value = '';
  document.getElementById('lessonInstruction').value = '';
  document.getElementById('lessonMediaUrl').value = '';
  document.getElementById('uploadStatusText').textContent = '';
  document.getElementById('mediaQuestionsEditor').innerHTML = '';
  initWordRows();
}

async function previewLessonAsStudent() {
  const data = collectEditorData();
  if (!data.title || data.words.length < 4) return alert('Заполните название и минимум 4 слова для предпросмотра!');
  const code = 'PREVIEW-' + Math.floor(100 + Math.random() * 900);
  await sbFetch('lessons', { method: 'POST', body: { ...data, code, teacher_code: currentTeacher.code, lesson_status: 'draft' } });
  window.open(`lesson.html?code=${code}&sname=Предпросмотр`, '_blank');
}

function copyPublishedMessage() {
  copyText(document.getElementById('publishedCustomMessage').value.trim(), 'Текст сообщения скопирован!');
}

function emailLessonToStudents() {
  const target = cachedStudents.filter(s => !s.is_archived && s.student_email && (lastPublishedGroup === 'Все ученики' || s.group_name === lastPublishedGroup));
  const emails = target.map(s => s.student_email).join(',');
  const msg = document.getElementById('publishedCustomMessage').value.trim();
  window.open(`mailto:${emails}?subject=${encodeURIComponent(`WordSprint: Задание «${lastPublishedTitle}» (${lastPublishedCode})`)}&body=${encodeURIComponent(msg)}`, '_blank');
}

function renderLessonsList() {
  const filter = document.getElementById('filterLessonsStatus').value;
  const list = cachedLessons.filter(l => filter === 'all' || (l.lesson_status || 'active') === filter);
  const box = document.getElementById('myLessonsList');
  if (!list.length) {
    box.innerHTML = '<p style="color:var(--muted); font-size:0.9rem;">Уроков в этой категории пока нет.</p>';
    return;
  }
  box.innerHTML = list.map(l => {
    const stBadge = l.lesson_status === 'draft' ? '<span class="tag-wait">Черновик</span>' : '<span class="tag-ok">Активен</span>';
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; padding:12px 14px; background:var(--input-bg); border:1px solid var(--border); border-radius:12px; margin-bottom:10px;">
        <div>
          <b>${l.title}</b> <span class="code-pill" style="font-size:0.82rem; margin:0 6px;">${l.code}</span> ${stBadge}
          <div style="font-size:0.82rem; color:var(--muted); margin-top:3px;">Слов: ${l.words ? l.words.length : 0} • Группа: ${l.target_group || 'Все ученики'}${l.author_name ? ' • Автор: ' + l.author_name : ''}</div>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button class="btn btn-secondary btn-sm" onclick="copyText('${l.code}', 'Код ${l.code} скопирован!')">📋 Код</button>
          <button class="btn btn-secondary btn-sm" onclick="editLesson('${l.id}')">✏️ Изменить</button>
          <button class="btn btn-secondary btn-sm" onclick="duplicateLesson('${l.id}')">📑 Дубль</button>
          <button class="btn btn-del btn-sm" onclick="deleteLesson('${l.id}')">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

function editLesson(id) {
  const l = cachedLessons.find(x => x.id === id);
  if (!l) return;
  editingLessonId = l.id;
  lastPublishedCode = l.code;
  document.getElementById('editorHeading').textContent = `Редактирование урока (${l.code})`;
  document.getElementById('lessonTitle').value = l.title;
  document.getElementById('lessonTargetGroup').value = l.target_group || 'Все ученики';
  document.getElementById('lessonDeadline').value = l.deadline || '';
  document.getElementById('lessonMediaUrl').value = l.media_url || '';
  document.getElementById('lessonTheoryText').value = l.theory_text || '';
  document.getElementById('lessonInstruction').value = (l.settings && l.settings.instruction) || '';
  selectLessonMode(l.mode || 'translate');
  document.getElementById('wordRowsContainer').innerHTML = '';
  (l.words || []).forEach(w => addWordRow(w.en, w.ru, w.hint || '', w.img || ''));
  switchWorkspaceTab('editor');
}

async function duplicateLesson(id) {
  const l = cachedLessons.find(x => x.id === id);
  if (!l) return;
  const newCode = generateShortCode('LESSON');
  await sbFetch('lessons', { method: 'POST', body: { code: newCode, teacher_code: currentTeacher.code, author_name: l.author_name, title: `${l.title} (копия)`, mode: l.mode, words: l.words, target_group: l.target_group, lesson_status: 'active', settings: l.settings } });
  loadTeacherData();
  alert(`Создана копия урока с кодом ${newCode}!`);
}

async function deleteLesson(id) {
  if (!confirm('Удалить этот урок?')) return;
  await sbFetch('lessons', { method: 'DELETE', query: `id=eq.${id}` });
  loadTeacherData();
}
function renderGroupSelectors() {
  const allGroups = Array.isArray(currentTeacher.groups_list) && currentTeacher.groups_list.length ? currentTeacher.groups_list : ['Общая группа'];
  const groups = staffMember ? [staffMember.group] : allGroups;
  const optionsHtml = groups.map(g => `<option value="${g}">${g}</option>`).join('');

  document.getElementById('lessonTargetGroup').innerHTML = (staffMember ? '' : '<option value="Все ученики">Все ученики</option>') + optionsHtml;
  const schedSel = document.getElementById('schedGroupSelect');
  if (schedSel) schedSel.innerHTML = '<option value="Все ученики">Все ученики</option>' + optionsHtml;
  const mailSel = document.getElementById('mailTargetSelect');
  if (mailSel) mailSel.innerHTML = '<option value="Все ученики">Всем ученикам</option>' + optionsHtml;
  const staffSel = document.getElementById('staffGroupSelect');
  if (staffSel) staffSel.innerHTML = allGroups.map(g => `<option value="${g}">${g}</option>`).join('');

  document.getElementById('groupFoldersBadges').innerHTML = groups.map(g => `<span style="background:var(--input-bg); border:1px solid var(--border); padding:4px 10px; border-radius:8px; font-size:0.84rem;">📁 ${g}</span>`).join('');
}

async function addGroupFolder() {
  const name = document.getElementById('newGroupFolderInput').value.trim();
  if (!name) return;
  const groups = Array.isArray(currentTeacher.groups_list) ? [...currentTeacher.groups_list] : ['Общая группа'];
  if (!groups.includes(name)) groups.push(name);
  await sbFetch('teachers', { method: 'PATCH', query: `id=eq.${currentTeacher.id}`, body: { groups_list: groups } });
  currentTeacher.groups_list = groups;
  document.getElementById('newGroupFolderInput').value = '';
  renderGroupSelectors();
  renderStudentsTable();
}

async function createChallengeGroup() {
  const title = prompt('Название командного челленджа (по недельному XP):', `Команда ${currentTeacher.name}`);
  if (!title) return;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars.at(Math.floor(Math.random() * chars.length));
  await sbFetch('groups', { method: 'POST', body: { code, title, weekly_goal: 350, teacher_code: currentTeacher.code, members: [{ name: currentTeacher.name, xp: 0 }] } });
  const base = WS_CONFIG.SITE_URL.replace(/\/$/, '');
  copyText(`${base}/groups.html?code=${code}`, `Челлендж-группа создана! Код: ${code}. Ссылка скопирована в буфер!`);
}

function renderStudentsTable() {
  const tbody = document.getElementById('studentsTableBody');
  const groups = Array.isArray(currentTeacher.groups_list) && currentTeacher.groups_list.length ? currentTeacher.groups_list : ['Общая группа'];
  const visible = cachedStudents.filter(s => !staffMember || s.group_name === staffMember.group);
  const active = visible.filter(s => !s.is_archived);
  const archived = visible.filter(s => s.is_archived);

  document.getElementById('archivedCount').textContent = archived.length;
  document.getElementById('archivedStudentsList').innerHTML = archived.length ? archived.map(s => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:var(--input-bg); border-radius:8px; margin-bottom:6px; font-size:0.86rem;">
      <span>🎓 <b>${s.student_name}</b> (${s.group_name || 'Общая группа'})</span>
      <button class="btn btn-secondary btn-sm" onclick="toggleArchiveStudent('${s.id}', false)">Вернуть в активные</button>
    </div>
  `).join('') : '<p style="color:var(--muted); font-size:0.86rem;">Архив выпускников пока пуст.</p>';

  if (!active.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--muted); text-align:center;">Пока нет активных учеников</td></tr>';
    return;
  }

  tbody.innerHTML = active.map(s => `
    <tr>
      <td><b>${s.student_name}</b><br><span class="code-pill" style="font-size:0.78rem;">${s.student_code || '—'}</span></td>
      <td><small>${s.student_email || '—'}</small></td>
      <td><select style="padding:6px 8px; font-size:0.84rem;" onchange="updateStudentGroup('${s.id}', this.value)">${groups.map(g => `<option value="${g}" ${(s.group_name || 'Общая группа') === g ? 'selected' : ''}>${g}</option>`).join('')}</select></td>
      <td><input type="text" value="${(s.teacher_note || '').replace(/"/g, '&quot;')}" placeholder="Заметка..." style="padding:6px 8px; font-size:0.84rem;" onchange="updateStudentNote('${s.id}', this.value)"></td>
      <td style="display:flex; gap:5px; flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" onclick="openAwardModal('${s.student_code}', '${s.student_name.replace(/'/g, "\\'")}', '${s.user_id || ''}')">🏅 Грамота</button>
        <button class="btn btn-secondary btn-sm" onclick="toggleArchiveStudent('${s.id}', true)" title="В архив выпускников">🎓</button>
        <button class="btn btn-del btn-sm" onclick="detachStudent('${s.id}')">✕</button>
      </td>
    </tr>
  `).join('');
}

async function updateStudentGroup(id, group_name) { await sbFetch('teacher_students', { method: 'PATCH', query: `id=eq.${id}`, body: { group_name } }); }
async function updateStudentNote(id, teacher_note) { await sbFetch('teacher_students', { method: 'PATCH', query: `id=eq.${id}`, body: { teacher_note } }); }
async function toggleArchiveStudent(id, is_archived) {
  await sbFetch('teacher_students', { method: 'PATCH', query: `id=eq.${id}`, body: { is_archived } });
  loadTeacherData();
}
async function detachStudent(id) {
  if (!confirm('Удалить ученика из списка?')) return;
  await sbFetch('teacher_students', { method: 'DELETE', query: `id=eq.${id}` });
  loadTeacherData();
}

function openAwardModal(studentCode, studentName, userId) {
  awardTarget = { studentCode, studentName, userId };
  document.getElementById('awardTargetStudentName').textContent = studentName;
  document.getElementById('awardTitleInput').value = '';
  document.getElementById('awardModal').style.display = 'flex';
}

async function confirmIssueAward() {
  const title = document.getElementById('awardTitleInput').value.trim();
  if (!title || !awardTarget) return alert('Введите текст достижения!');
  await sbFetch('student_awards', {
    method: 'POST',
    body: { teacher_code: currentTeacher.code, teacher_name: currentTeacher.name, student_code: awardTarget.studentCode, student_name: awardTarget.studentName, award_title: title }
  });
  if (awardTarget.userId) {
    await sendAppNotification(awardTarget.userId, '🏅 Новая именная грамота!', `${currentTeacher.name} наградил(а) вас: «${title}»`, 'profile.html');
  }
  document.getElementById('awardModal').style.display = 'none';
  alert(`Грамота выписана и уже доступна в профиле ученика (${awardTarget.studentName})!`);
}

function renderSchoolStaff() {
  const staff = Array.isArray(currentTeacher.staff) ? currentTeacher.staff : [];
  const box = document.getElementById('schoolStaffList');
  if (!box) return;
  box.innerHTML = staff.length ? staff.map((st, idx) => `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; padding:12px 14px; background:var(--input-bg); border:1px solid var(--border); border-radius:10px; margin-bottom:8px;">
      <div>
        <b>${st.name}</b> <span class="code-pill" style="font-size:0.8rem; margin-left:6px;">${st.code}</span>
        <div style="color:var(--muted); font-size:0.84rem; margin-top:2px;">Направление: ${st.spec || 'Преподаватель'} • Группа: <b>${st.group || 'Общая группа'}</b></div>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="btn btn-secondary btn-sm" onclick="copyText('${st.code}', 'Персональный код учителя ${st.code} скопирован!')">📋 Код входа</button>
        <button class="btn btn-del btn-sm" onclick="removeSchoolStaff(${idx})">Удалить</button>
      </div>
    </div>
  `).join('') : '<p style="color:var(--muted); font-size:0.9rem;">Список преподавателей школы пока пуст.</p>';
}

async function addSchoolStaff() {
  const name = document.getElementById('staffNameInput').value.trim();
  const spec = document.getElementById('staffSpecInput').value.trim();
  const group = document.getElementById('staffGroupSelect').value;
  if (!name) return alert('Введите имя преподавателя!');
  const slug = name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '').slice(0, 6).toUpperCase() || Math.floor(10 + Math.random() * 90);
  const code = `${currentTeacher.code}-${slug}`;
  const staff = Array.isArray(currentTeacher.staff) ? [...currentTeacher.staff] : [];
  staff.push({ name, spec, group, code });
  await sbFetch('teachers', { method: 'PATCH', query: `id=eq.${currentTeacher.id}`, body: { staff } });
  currentTeacher.staff = staff;
  document.getElementById('staffNameInput').value = '';
  document.getElementById('staffSpecInput').value = '';
  renderSchoolStaff();
}

async function removeSchoolStaff(idx) {
  const staff = [...currentTeacher.staff];
  staff.splice(idx, 1);
  await sbFetch('teachers', { method: 'PATCH', query: `id=eq.${currentTeacher.id}`, body: { staff } });
  currentTeacher.staff = staff;
  renderSchoolStaff();
}
function generateJitsiCall() {
  const room = `https://jit.si{currentTeacher.code}-${Math.floor(100 + Math.random() * 900)}`;
  document.getElementById('teacherCallLinkInput').value = room;
}

async function saveCallLink() {
  const call_link = document.getElementById('teacherCallLinkInput').value.trim();
  await sbFetch('teachers', { method: 'PATCH', query: `id=eq.${currentTeacher.id}`, body: { call_link } });
  currentTeacher.call_link = call_link;
  alert('Ссылка на онлайн-созвон сохранена и отображается у учеников!');
}

function renderScheduleList() {
  const sched = Array.isArray(currentTeacher.schedule) ? currentTeacher.schedule : [];
  const box = document.getElementById('teacherScheduleList');
  if (!box) return;
  box.innerHTML = sched.length ? sched.map((s, idx) => `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; padding:10px 14px; background:var(--input-bg); border:1px solid var(--border); border-radius:10px; margin-bottom:8px;">
      <div><b>${s.day}</b> • <span style="color:var(--primary);">${s.group}</span> — ${s.topic || 'Занятие'}</div>
      <div style="display:flex; gap:6px;">
        <button class="btn btn-secondary btn-sm" onclick="remindScheduleEmail(${idx})">✉️ Напомнить на Email</button>
        <button class="btn btn-del btn-sm" onclick="removeScheduleSlot(${idx})">✕</button>
      </div>
    </div>
  `).join('') : '<p style="color:var(--muted); font-size:0.88rem;">Расписание пока не заполнено.</p>';
}

async function addScheduleSlot() {
  const day = document.getElementById('schedDayInput').value.trim();
  const group = document.getElementById('schedGroupSelect').value;
  const topic = document.getElementById('schedTopicInput').value.trim();
  if (!day) return alert('Укажите день и время занятия!');
  const sched = Array.isArray(currentTeacher.schedule) ? [...currentTeacher.schedule] : [];
  sched.push({ day, group, topic, link: currentTeacher.call_link || '' });
  await sbFetch('teachers', { method: 'PATCH', query: `id=eq.${currentTeacher.id}`, body: { schedule: sched } });
  currentTeacher.schedule = sched;
  document.getElementById('schedDayInput').value = '';
  document.getElementById('schedTopicInput').value = '';
  renderScheduleList();
}

async function removeScheduleSlot(idx) {
  const sched = [...currentTeacher.schedule];
  sched.splice(idx, 1);
  await sbFetch('teachers', { method: 'PATCH', query: `id=eq.${currentTeacher.id}`, body: { schedule: sched } });
  currentTeacher.schedule = sched;
  renderScheduleList();
}

function remindScheduleEmail(idx) {
  const s = currentTeacher.schedule.at(idx);
  if (!s) return;
  const target = cachedStudents.filter(st => !st.is_archived && st.student_email && (s.group === 'Все ученики' || st.group_name === s.group));
  const emails = target.map(st => st.student_email).join(',');
  const subj = encodeURIComponent(`WordSprint: Напоминание о занятии (${s.day})`);
  const body = encodeURIComponent(`Здравствуйте!\n\nНапоминаю о предстоящем занятии:\n📅 Когда: ${s.day}\n📝 Тема: ${s.topic || 'Английский язык'}\n${currentTeacher.call_link ? '📹 Ссылка на созвон: ' + currentTeacher.call_link : ''}`);
  window.open(`mailto:${emails}?subject=${subj}&body=${body}`, '_blank');
}

async function sendCustomMessageToStudents() {
  const targetGroup = document.getElementById('mailTargetSelect').value;
  const subject = document.getElementById('mailSubjectInput').value.trim() || `Сообщение от ${currentTeacher.name}`;
  const text = document.getElementById('mailBodyInput').value.trim();
  if (!text) return alert('Напишите текст сообщения!');

  const recipients = cachedStudents.filter(s => !s.is_archived && (targetGroup === 'Все ученики' || s.group_name === targetGroup));
  for (const st of recipients) {
    if (st.user_id) await sendAppNotification(st.user_id, `✉️ ${subject}`, text, 'profile.html');
  }
  const emails = recipients.filter(s => s.student_email).map(s => s.student_email).join(',');
  window.open(`mailto:${emails}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`, '_blank');
  document.getElementById('mailBodyInput').value = '';
}
async function loadTeacherData() {
  if (!currentTeacher || (!currentTeacher.verified && currentTeacher.status !== 'approved')) return;
  try {
    const [lessons, students] = await Promise.all([
      sbFetch('lessons', { query: `teacher_code=eq.${encodeURIComponent(currentTeacher.code)}&order=created_at.desc` }),
      sbFetch('teacher_students', { query: `teacher_code=eq.${encodeURIComponent(currentTeacher.code)}&order=created_at.desc` })
    ]);

    cachedLessons = (lessons || []).filter(l => !staffMember || l.target_group === staffMember.group || l.target_group === 'Все ученики');
    cachedStudents = students || [];
    document.getElementById('statLessonsCount').textContent = cachedLessons.length;
    renderLessonsList();
    renderStudentsTable();

    let allResults = [];
    if (cachedLessons.length > 0) {
      const codes = cachedLessons.map(l => l.code).join(',');
      allResults = await sbFetch('lesson_results', { query: `lesson_code=in.(${codes})&order=created_at.desc` });
    }
    cachedResults = allResults || [];
    document.getElementById('statResultsCount').textContent = cachedResults.length;

    const count = cachedStudents.length;
    const ambBox = document.getElementById('ambassadorStatBox');
    if (count >= 10) {
      ambBox.classList.add('ambassador');
      document.getElementById('statAmbassadorVal').textContent = `🏅 ${count}`;
      document.getElementById('statAmbassadorLbl').textContent = 'Амбассадор WordSprint (учеников)';
    } else {
      ambBox.classList.remove('ambassador');
      document.getElementById('statAmbassadorVal').textContent = `${count} / 10`;
      document.getElementById('statAmbassadorLbl').textContent = 'До статуса «Амбассадор»';
    }

    const freq = {};
    cachedResults.forEach(r => (r.mistakes || []).forEach(w => { freq[w] = (freq[w] || 0) + 1; }));
    topMistakesList = Object.entries(freq).sort((a, b) => b.at(1) - a.at(1)).slice(0, 12).map(x => x.at(0));
    const chipsBox = document.getElementById('topMistakesChips');
    chipsBox.innerHTML = topMistakesList.length ? topMistakesList.map(w => `<span class="mistake-word">${w} (${freq[w]})</span>`).join('') : '<span style="color:var(--muted); font-size:0.88rem;">Ошибок пока не зафиксировано.</span>';

    const tbody = document.getElementById('resultsTableBody');
    tbody.innerHTML = cachedResults.length ? cachedResults.map(r => {
      const pct = Math.round((r.score / r.total) * 100);
      const mHtml = (r.mistakes && r.mistakes.length) ? r.mistakes.map(m => `<span class="mistake-word">${m}</span>`).join('') : '<span style="color:var(--accent);">Без ошибок</span>';
      const checkBtn = r.is_checked
        ? '<span class="tag-ok">✓ Проверено</span>'
        : `<button class="btn btn-sm" onclick="markResultChecked('${r.id}')">✓ Отметить</button>`;
      return `<tr><td><b>${r.lesson_code}</b></td><td>${r.student_name}</td><td><span class="tag-ok">${r.score}/${r.total} (${pct}%)</span></td><td>${mHtml}</td><td>${checkBtn}</td><td><button class="btn btn-secondary btn-sm" onclick="sendFeedbackEmail('${r.student_name.replace(/'/g, "\\'")}', '${r.lesson_code}', ${r.score}, ${r.total})">✉️ Разбор</button></td></tr>`;
    }).join('') : '<tr><td colspan="6" style="color:var(--muted); text-align:center;">Пока нет выполненных работ</td></tr>';
  } catch (e) { console.error(e); }
}

async function markResultChecked(id) {
  await sbFetch('lesson_results', { method: 'PATCH', query: `id=eq.${id}`, body: { is_checked: true } });
  loadTeacherData();
}

function createErrorReviewLesson() {
  if (topMistakesList.length < 4) return alert('Для работы над ошибками нужно минимум 4 проблемных слова в журнале.');
  const dict = {};
  cachedLessons.forEach(l => (l.words || []).forEach(w => { dict[w.en.toLowerCase()] = w; }));
  switchWorkspaceTab('editor');
  document.getElementById('lessonTitle').value = `Работа над ошибками (${new Date().toLocaleDateString('ru-RU')})`;
  document.getElementById('wordRowsContainer').innerHTML = '';
  topMistakesList.forEach(en => {
    const found = dict[en.toLowerCase()];
    addWordRow(en, found ? found.ru : '', found ? (found.hint || '') : '');
  });
  alert('Проблемные слова подставлены в конструктор!');
}

function sendFeedbackEmail(studentName, lessonCode, score, total) {
  const st = cachedStudents.find(s => s.student_name.toLowerCase() === studentName.toLowerCase());
  const email = st ? (st.student_email || '') : '';
  const subj = encodeURIComponent(`WordSprint: Проверка задания ${lessonCode}`);
  const body = encodeURIComponent(`Здравствуйте, ${studentName}!\n\nВы выполнили задание ${lessonCode} с результатом ${score} из ${total}.\nКомментарий преподавателя:\n`);
  window.open(`mailto:${email}?subject=${subj}&body=${body}`, '_blank');
}

function exportResultsCsv() {
  if (!cachedResults.length) return alert('Нет результатов для выгрузки.');
  const header = 'Код урока;Ученик;Баллы;Всего;Ошибки;Дата\n';
  const rows = cachedResults.map(r => `${r.lesson_code};${r.student_name};${r.score};${r.total};${(r.mistakes || []).join(', ')};${new Date(r.created_at).toLocaleDateString('ru-RU')}`).join('\n');
  const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `wordsprint-report-${currentTeacher.code}.csv`;
  a.click();
}

async function saveProfileUpdates() {
  const announcement = document.getElementById('profileAnnouncement').value.trim();
  const city_format = document.getElementById('profileCity').value.trim();
  const level = document.getElementById('profileLevel').value.trim();
  const telegram = document.getElementById('profileTelegram').value.trim();
  const bio = document.getElementById('profileBio').value.trim();
  await sbFetch('teachers', { method: 'PATCH', query: `id=eq.${currentTeacher.id}`, body: { announcement, city_format, level, telegram, bio } });
  Object.assign(currentTeacher, { announcement, city_format, level, telegram, bio });
  alert('Объявление и профиль в каталоге обновлены!');
}

window.addEventListener('DOMContentLoaded', async () => {
  ['lessonTitle', 'lessonDeadline', 'lessonTheoryText', 'lessonInstruction', 'lessonMediaUrl'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', autoSaveDraft);
  });
  const saved = localStorage.getItem('ws_teacher_code');
  if (saved) {
    document.getElementById('loginTeacherCode').value = saved;
    await loginTeacher();
  }
});
