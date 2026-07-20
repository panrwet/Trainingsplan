// ============================================================
//  app.js – UI, Router und alle Ansichten
// ============================================================
import * as DB from './db.js';

// ---------- DOM-Kurzformen ----------
const appEl = document.getElementById('app');
const titleEl = document.getElementById('title');
const backBtn = document.getElementById('backBtn');
const topActions = document.getElementById('topActions');
const modalRoot = document.getElementById('modalRoot');
const toastRoot = document.getElementById('toastRoot');

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function el(tag, props = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach(c => { if (c != null) n.append(c.nodeType ? c : document.createTextNode(c)); });
  return n;
}

function toast(msg) {
  const t = el('div', { class: 'toast' }, msg);
  toastRoot.append(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 250); }, 1900);
}

// ---------- Datum ----------
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
function parseISO(iso) { const [y, m, d] = String(iso).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); }
function fmtDate(iso) { const d = parseISO(iso); return `${WD[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`; }
function fmtShort(iso) { const d = parseISO(iso); return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`; }
function fmtWeight(n) { const v = Math.round(n * 100) / 100; return (Number.isInteger(v) ? v : v.toFixed(1)).toString(); }
function setSummary(sets) {
  return sets.filter(DB.hasData).map(s => `${fmtWeight(DB.num(s.weight))}×${DB.num(s.reps)}`).join(' · ');
}

// ---------- Symbol- / Farb-Picker ----------
const EMOJI_SETS = {
  location: ['📍', '🏋️', '🏠', '🏢', '🌳', '🏟️', '🧗', '🚴', '🏊', '⛰️'],
  plan: ['🏋️', '💪', '🔥', '⚡', '🎯', '🦵', '🫀', '🅿️', '🅾️', '🔄'],
  day: ['💪', '🦵', '🫁', '🔙', '🔛', '🅰️', '🅱️', '🔴', '🟢', '🔵', '🟡', '🟣', '❤️', '🖤'],
};
const COLORS = ['#6c8cff', '#46c98b', '#ffb454', '#ff6b6b', '#c77dff', '#4cc9f0', '#f72585', '#adb5bd'];

function symbolField(current, kind) {
  const set = EMOJI_SETS[kind] || EMOJI_SETS.day;
  return `
    <label class="field"><span>Kürzel oder Emoji (für Kalender)</span>
      <input id="f-emoji" maxlength="4" value="${esc(current || '')}" placeholder="z.B. 💪 oder PU" />
    </label>
    <div class="emoji-pick" id="f-emoji-pick">
      ${set.map(e => `<button type="button" data-e="${e}" class="${e === current ? 'sel' : ''}">${e}</button>`).join('')}
    </div>`;
}
function colorField(current) {
  return `<label class="field"><span>Farbe</span></label>
    <div class="color-pick" id="f-color-pick">
      ${COLORS.map(c => `<button type="button" data-c="${c}" style="background:${c}" class="${c === current ? 'sel' : ''}"></button>`).join('')}
    </div>`;
}
function wireSymbolColor(root) {
  const emojiInput = $('#f-emoji', root);
  $$('#f-emoji-pick button', root).forEach(b => b.addEventListener('click', () => {
    if (emojiInput) emojiInput.value = b.dataset.e;
    $$('#f-emoji-pick button', root).forEach(x => x.classList.remove('sel'));
    b.classList.add('sel');
  }));
  let color = ($('#f-color-pick .sel', root)?.dataset.c) || COLORS[0];
  $$('#f-color-pick button', root).forEach(b => b.addEventListener('click', () => {
    color = b.dataset.c;
    $$('#f-color-pick button', root).forEach(x => x.classList.remove('sel'));
    b.classList.add('sel');
  }));
  return { getEmoji: () => (emojiInput?.value.trim() || ''), getColor: () => color };
}

// ---------- Modal ----------
function openModal({ title, body, onMount, footer }) {
  const back = el('div', { class: 'modal-back' });
  const modal = el('div', { class: 'modal' });
  modal.innerHTML = `<h2>${esc(title)}</h2><div class="modal-body">${body}</div>`;
  if (footer) { const f = el('div', { class: 'btn-row', style: 'margin-top:16px' }); f.innerHTML = footer; modal.append(f); }
  back.append(modal);
  back.addEventListener('click', e => { if (e.target === back) close(); });
  modalRoot.append(back);
  function close() { back.remove(); }
  if (onMount) onMount(modal, close);
  return close;
}

function confirmDialog(msg, { danger = false, okText = 'OK' } = {}) {
  return new Promise(resolve => {
    const close = openModal({
      title: 'Bestätigen',
      body: `<p style="margin:0 0 4px">${esc(msg)}</p>`,
      footer: `<button class="btn ghost" data-x>Abbrechen</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(okText)}</button>`,
      onMount: (m, c) => {
        $('[data-x]', m).onclick = () => { c(); resolve(false); };
        $('[data-ok]', m).onclick = () => { c(); resolve(true); };
      },
    });
  });
}

// ---------- Chrome (Topbar) ----------
function setChrome({ title, back = false, actions = [] }) {
  titleEl.textContent = title;
  backBtn.hidden = !back;
  topActions.innerHTML = '';
  actions.forEach(a => topActions.append(a));
}
backBtn.addEventListener('click', () => history.back());

function actionBtn(label, onClick, cls = '') {
  return el('button', { class: 'icon-btn ' + cls, onclick: onClick, 'aria-label': label }, label);
}

// ============================================================
//  Router
// ============================================================
const routes = [];
function route(pattern, handler) {
  const keys = [];
  const rx = new RegExp('^' + pattern.replace(/:[^/]+/g, m => { keys.push(m.slice(1)); return '([^/]+)'; }) + '$');
  routes.push({ rx, keys, handler });
}

function navigate(hash) { location.hash = hash; }

function render() {
  const hash = location.hash.replace(/^#/, '') || '/';
  for (const r of routes) {
    const m = hash.match(r.rx);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i + 1]));
      window.scrollTo(0, 0);
      try { r.handler(params); } catch (e) { console.error(e); appEl.innerHTML = `<div class="empty">Fehler: ${esc(e.message)}</div>`; }
      updateTabs(hash);
      return;
    }
  }
  navigate('/');
}
function updateTabs(hash) {
  const map = { '/': 'home', '/plans': 'plans', '/calendar': 'calendar', '/stats': 'stats', '/library': 'library' };
  let active = 'home';
  if (hash.startsWith('/plans') || hash.startsWith('/location') || hash.startsWith('/plan') || hash.startsWith('/day')) active = 'plans';
  else if (hash.startsWith('/calendar')) active = 'calendar';
  else if (hash.startsWith('/stats')) active = 'stats';
  else if (hash.startsWith('/library') || hash.startsWith('/exercise')) active = 'library';
  else if (hash.startsWith('/train') || hash === '/' || hash.startsWith('/history')) active = 'home';
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === active));
}
window.addEventListener('hashchange', render);

// ============================================================
//  Ansicht: Start / Home
// ============================================================
route('/', () => {
  setChrome({ title: 'Training', back: false });
  const unfinished = DB.sessions().filter(s => !s.finishedAt);
  const locs = DB.locations();
  const recent = DB.sessions().filter(s => s.finishedAt).slice(0, 3);
  const totalDays = DB.db().days.length;

  let html = '';

  if (unfinished.length) {
    html += `<div class="section-title">Laufendes Training</div>`;
    unfinished.forEach(s => {
      const doneSets = s.entries.reduce((a, e) => a + e.sets.filter(DB.isWorkingDone).length, 0);
      html += `<div class="card tap" data-goto="/train/${s.id}">
        <div class="train-head">
          <div class="chip" style="background:${esc(s.color)}22;color:${esc(s.color)}">${esc(s.emoji || '💪')}</div>
          <div style="flex:1">
            <div style="font-weight:700">${esc(s.dayName || 'Training')}</div>
            <div class="tiny muted">${fmtDate(s.date)} · ${doneSets} Sätze erledigt</div>
          </div>
          <span class="btn primary sm">Weiter ›</span>
        </div>
      </div>`;
    });
  }

  html += `<div class="section-title">Schnellstart</div>`;
  if (!totalDays) {
    html += `<div class="empty">
      <div class="big">🏋️</div>
      <div>Noch keine Trainingstage angelegt.</div>
      <div class="tiny" style="margin:8px 0 14px">Lege zuerst einen Ort, einen Plan und Trainingstage an.</div>
      <a class="btn primary" href="#/plans">Jetzt einrichten</a>
    </div>`;
  } else {
    locs.forEach(loc => {
      const plans = DB.plansByLocation(loc.id);
      const daysInLoc = plans.flatMap(p => DB.daysByPlan(p.id));
      if (!daysInLoc.length) return;
      html += `<div class="card">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="font-size:1.2rem">${esc(loc.emoji)}</span><b>${esc(loc.name)}</b>
        </div>`;
      plans.forEach(p => {
        const days = DB.daysByPlan(p.id);
        if (!days.length) return;
        html += `<div class="tiny muted" style="margin:6px 0 4px">${esc(p.emoji)} ${esc(p.name)}</div>`;
        days.forEach(day => {
          html += `<div class="list-row" data-start="${day.id}" style="margin-bottom:8px">
            <div class="chip" style="background:${esc(day.color)}22;color:${esc(day.color)}">${esc(day.emoji)}</div>
            <div class="grow"><div class="r-title">${esc(day.name)}</div>
              <div class="r-sub">${day.exercises.length} Übungen</div></div>
            <span class="btn good sm">Start ▶</span>
          </div>`;
        });
      });
      html += `</div>`;
    });
  }

  if (recent.length) {
    html += `<div class="section-title" style="display:flex;justify-content:space-between">
      <span>Zuletzt</span><a href="#/history" class="tiny">alle ›</a></div>`;
    recent.forEach(s => { html += sessionRow(s); });
  }

  appEl.innerHTML = html;

  $$('[data-goto]', appEl).forEach(n => n.onclick = () => navigate(n.dataset.goto));
  $$('[data-start]', appEl).forEach(n => n.onclick = (e) => { e.stopPropagation(); startTraining(n.dataset.start); });
  $$('[data-session]', appEl).forEach(n => n.onclick = () => navigate('/train/' + n.dataset.session));
});

function sessionRow(s) {
  const totalSets = s.entries.reduce((a, e) => a + e.sets.filter(DB.isWorkingDone).length, 0);
  const vol = s.entries.reduce((a, e) => a + e.sets.filter(DB.isWorkingDone).reduce((x, st) => x + DB.num(st.weight) * DB.num(st.reps), 0), 0);
  return `<div class="list-row" data-session="${s.id}">
    <div class="chip" style="background:${esc(s.color)}22;color:${esc(s.color)}">${esc(s.emoji || '💪')}</div>
    <div class="grow"><div class="r-title">${esc(s.dayName || 'Training')}</div>
      <div class="r-sub">${fmtDate(s.date)} · ${totalSets} Sätze · ${fmtWeight(vol)} kg Vol.</div></div>
    <span class="arrow">›</span></div>`;
}

function startTraining(dayId) {
  const s = DB.startSession(dayId);
  if (s) navigate('/train/' + s.id);
}

// ============================================================
//  Ansicht: Pläne (Orte-Übersicht)
// ============================================================
route('/plans', () => {
  setChrome({ title: 'Orte & Pläne', back: false, actions: [actionBtn('⚙️', () => navigate('/settings'))] });
  const locs = DB.locations();
  let html = '';
  if (!locs.length) {
    html += `<div class="empty"><div class="big">📍</div><div>Noch keine Trainingsorte.</div>
      <div class="tiny" style="margin:8px 0 0">Ein Ort ist z.B. „Fitnessstudio" oder „Zuhause".</div></div>`;
  } else {
    locs.forEach(loc => {
      const plans = DB.plansByLocation(loc.id);
      html += `<div class="list-row" data-loc="${loc.id}">
        <div class="chip" style="background:${esc(loc.color)}22;color:${esc(loc.color)}">${esc(loc.emoji)}</div>
        <div class="grow"><div class="r-title">${esc(loc.name)}</div>
          <div class="r-sub">${plans.length} ${plans.length === 1 ? 'Plan' : 'Pläne'}</div></div>
        <span class="arrow">›</span></div>`;
    });
  }
  appEl.innerHTML = html;
  $$('[data-loc]', appEl).forEach(n => n.onclick = () => navigate('/location/' + n.dataset.loc));

  const fab = el('button', { class: 'fab', onclick: () => editLocationModal(null) }, '+');
  appEl.append(fab);
});

function editLocationModal(id) {
  const loc = id ? DB.getLocation(id) : { name: '', emoji: '📍', color: COLORS[0] };
  openModal({
    title: id ? 'Ort bearbeiten' : 'Neuer Ort',
    body: `
      <label class="field"><span>Name</span><input id="f-name" value="${esc(loc.name)}" placeholder="z.B. Fitnessstudio" /></label>
      ${symbolField(loc.emoji, 'location')}
      ${colorField(loc.color)}`,
    footer: `${id ? '<button class="btn danger" data-del>Löschen</button>' : ''}<button class="btn ghost" data-x>Abbrechen</button><button class="btn primary" data-ok>Speichern</button>`,
    onMount: (m, close) => {
      const sc = wireSymbolColor(m);
      $('[data-x]', m).onclick = close;
      $('[data-ok]', m).onclick = () => {
        const name = $('#f-name', m).value.trim();
        if (!name) return toast('Bitte einen Namen eingeben');
        const data = { name, emoji: sc.getEmoji() || '📍', color: sc.getColor() };
        if (id) DB.updateLocation(id, data); else DB.addLocation(data);
        close(); render();
      };
      const del = $('[data-del]', m);
      if (del) del.onclick = async () => {
        if (await confirmDialog('Ort inkl. aller Pläne und Trainingstage löschen? (Aufgezeichnete Einheiten bleiben erhalten)', { danger: true, okText: 'Löschen' })) {
          DB.deleteLocation(id); close(); navigate('/plans');
        }
      };
    },
  });
}

// ============================================================
//  Ansicht: Ort-Detail (Pläne des Orts)
// ============================================================
route('/location/:id', ({ id }) => {
  const loc = DB.getLocation(id);
  if (!loc) return navigate('/plans');
  setChrome({ title: `${loc.emoji} ${loc.name}`, back: true, actions: [actionBtn('✏️', () => editLocationModal(id))] });
  const plans = DB.plansByLocation(id);
  let html = `<div class="section-title">Trainingspläne</div>`;
  if (!plans.length) {
    html += `<div class="empty"><div class="big">📋</div><div>Noch keine Pläne an diesem Ort.</div></div>`;
  } else {
    plans.forEach(p => {
      const days = DB.daysByPlan(p.id);
      html += `<div class="list-row" data-plan="${p.id}">
        <div class="chip" style="background:${esc(p.color)}22;color:${esc(p.color)}">${esc(p.emoji)}</div>
        <div class="grow"><div class="r-title">${esc(p.name)}</div>
          <div class="r-sub">${days.length} Trainingstage</div></div>
        <span class="arrow">›</span></div>`;
    });
  }
  appEl.innerHTML = html;
  $$('[data-plan]', appEl).forEach(n => n.onclick = () => navigate('/plan/' + n.dataset.plan));
  appEl.append(el('button', { class: 'fab', onclick: () => editPlanModal(null, id) }, '+'));
});

function editPlanModal(id, locationId) {
  const p = id ? DB.getPlan(id) : { name: '', emoji: '🏋️', color: COLORS[0], locationId };
  openModal({
    title: id ? 'Plan bearbeiten' : 'Neuer Plan',
    body: `
      <label class="field"><span>Name</span><input id="f-name" value="${esc(p.name)}" placeholder="z.B. Push / Pull / Legs" /></label>
      ${symbolField(p.emoji, 'plan')}
      ${colorField(p.color)}`,
    footer: `${id ? '<button class="btn danger" data-del>Löschen</button>' : ''}<button class="btn ghost" data-x>Abbrechen</button><button class="btn primary" data-ok>Speichern</button>`,
    onMount: (m, close) => {
      const sc = wireSymbolColor(m);
      $('[data-x]', m).onclick = close;
      $('[data-ok]', m).onclick = () => {
        const name = $('#f-name', m).value.trim();
        if (!name) return toast('Bitte einen Namen eingeben');
        const data = { name, emoji: sc.getEmoji() || '🏋️', color: sc.getColor() };
        if (id) DB.updatePlan(id, data); else DB.addPlan({ ...data, locationId: p.locationId });
        close(); render();
      };
      const del = $('[data-del]', m);
      if (del) del.onclick = async () => {
        if (await confirmDialog('Plan inkl. Trainingstage löschen?', { danger: true, okText: 'Löschen' })) {
          const lid = p.locationId; DB.deletePlan(id); close(); navigate('/location/' + lid);
        }
      };
    },
  });
}

// ============================================================
//  Ansicht: Plan-Detail (Trainingstage)
// ============================================================
route('/plan/:id', ({ id }) => {
  const p = DB.getPlan(id);
  if (!p) return navigate('/plans');
  setChrome({ title: `${p.emoji} ${p.name}`, back: true, actions: [actionBtn('✏️', () => editPlanModal(id, p.locationId))] });
  const days = DB.daysByPlan(id);
  let html = `<div class="section-title">Trainingstage</div>`;
  if (!days.length) {
    html += `<div class="empty"><div class="big">💪</div><div>Noch keine Trainingstage.</div>
      <div class="tiny" style="margin:8px 0 0">Ein Trainingstag ist z.B. „Push A" oder „Beine".</div></div>`;
  } else {
    days.forEach((day, i) => {
      html += `<div class="list-row" data-day="${day.id}">
        <div class="chip" style="background:${esc(day.color)}22;color:${esc(day.color)}">${esc(day.emoji)}</div>
        <div class="grow"><div class="r-title">${esc(day.name)}</div>
          <div class="r-sub">${day.exercises.length} Übungen</div></div>
        <span class="mv" data-up="${day.id}" style="padding:4px 8px;color:var(--text-dim2)">▲</span>
        <span class="mv" data-down="${day.id}" style="padding:4px 8px;color:var(--text-dim2)">▼</span>
        <span class="arrow">›</span></div>`;
    });
  }
  appEl.innerHTML = html;
  $$('[data-day]', appEl).forEach(n => n.onclick = (e) => { if (e.target.closest('.mv')) return; navigate('/day/' + n.dataset.day); });
  const ids = days.map(d => d.id);
  $$('[data-up]', appEl).forEach(n => n.onclick = (e) => { e.stopPropagation(); moveInArray(ids, n.dataset.up, -1); DB.reorderDays(id, ids); render(); });
  $$('[data-down]', appEl).forEach(n => n.onclick = (e) => { e.stopPropagation(); moveInArray(ids, n.dataset.down, +1); DB.reorderDays(id, ids); render(); });
  appEl.append(el('button', { class: 'fab', onclick: () => editDayModal(null, id) }, '+'));
});

function moveInArray(arr, id, dir) {
  const i = arr.indexOf(id); const j = i + dir;
  if (i < 0 || j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
}

function editDayModal(id, planId) {
  const day = id ? DB.getDay(id) : { name: '', emoji: '💪', color: COLORS[1], planId };
  openModal({
    title: id ? 'Trainingstag bearbeiten' : 'Neuer Trainingstag',
    body: `
      <label class="field"><span>Name</span><input id="f-name" value="${esc(day.name)}" placeholder="z.B. Push A / Beine" /></label>
      ${symbolField(day.emoji, 'day')}
      ${colorField(day.color)}`,
    footer: `${id ? '<button class="btn danger" data-del>Löschen</button>' : ''}<button class="btn ghost" data-x>Abbrechen</button><button class="btn primary" data-ok>Speichern</button>`,
    onMount: (m, close) => {
      const sc = wireSymbolColor(m);
      $('[data-x]', m).onclick = close;
      $('[data-ok]', m).onclick = () => {
        const name = $('#f-name', m).value.trim();
        if (!name) return toast('Bitte einen Namen eingeben');
        const data = { name, emoji: sc.getEmoji() || '💪', color: sc.getColor() };
        if (id) { DB.updateDay(id, data); close(); render(); }
        else { const nd = DB.addDay({ ...data, planId: day.planId }); close(); navigate('/day/' + nd.id); }
      };
      const del = $('[data-del]', m);
      if (del) del.onclick = async () => {
        if (await confirmDialog('Trainingstag löschen?', { danger: true, okText: 'Löschen' })) {
          const pid = day.planId; DB.deleteDay(id); close(); navigate('/plan/' + pid);
        }
      };
    },
  });
}

// ============================================================
//  Ansicht: Trainingstag-Detail (Übungen mit Zielwerten)
// ============================================================
route('/day/:id', ({ id }) => {
  const day = DB.getDay(id);
  if (!day) return navigate('/plans');
  setChrome({ title: `${day.emoji} ${day.name}`, back: true, actions: [actionBtn('✏️', () => editDayModal(id, day.planId))] });

  let html = `<button class="btn good block" id="startBtn" style="margin-bottom:16px">▶ Training starten</button>
    <div class="section-title">Übungen</div>`;
  if (!day.exercises.length) {
    html += `<div class="empty"><div class="big">📚</div><div>Noch keine Übungen.</div>
      <div class="tiny" style="margin:8px 0 0">Füge Übungen aus deiner Bibliothek hinzu.</div></div>`;
  } else {
    day.exercises.forEach((item, i) => {
      const ex = DB.getExercise(item.exerciseId);
      html += `<div class="card" data-item="${item.id}">
        <div style="display:flex;align-items:center;gap:8px">
          <div class="grow" style="flex:1"><b>${esc(ex ? ex.name : '(gelöscht)')}</b>
            <div class="tiny muted" style="margin-top:2px">${item.sets} Sätze × ${item.reps} Wdh · Pause ${item.restSec}s</div></div>
          <span class="mv" data-up="${item.id}" style="padding:4px 6px;color:var(--text-dim2)">▲</span>
          <span class="mv" data-down="${item.id}" style="padding:4px 6px;color:var(--text-dim2)">▼</span>
          <button class="btn ghost sm" data-edit="${item.id}">✏️</button>
          <button class="btn ghost sm" data-rm="${item.id}">🗑️</button>
        </div>
      </div>`;
    });
  }
  appEl.innerHTML = html;

  $('#startBtn', appEl).onclick = () => {
    if (!day.exercises.length) return toast('Erst Übungen hinzufügen');
    startTraining(id);
  };
  const ids = day.exercises.map(x => x.id);
  $$('[data-up]', appEl).forEach(n => n.onclick = () => { moveInArray(ids, n.dataset.up, -1); DB.reorderDayExercises(id, ids); render(); });
  $$('[data-down]', appEl).forEach(n => n.onclick = () => { moveInArray(ids, n.dataset.down, +1); DB.reorderDayExercises(id, ids); render(); });
  $$('[data-edit]', appEl).forEach(n => n.onclick = () => editDayExerciseModal(id, n.dataset.edit));
  $$('[data-rm]', appEl).forEach(n => n.onclick = async () => {
    if (await confirmDialog('Übung aus diesem Trainingstag entfernen?', { danger: true, okText: 'Entfernen' })) { DB.removeDayExercise(id, n.dataset.rm); render(); }
  });

  appEl.append(el('button', { class: 'fab', onclick: () => pickExerciseModal(exId => {
    DB.addExerciseToDay(id, exId); render();
  }) }, '+'));
});

function editDayExerciseModal(dayId, itemId) {
  const day = DB.getDay(dayId);
  const item = day.exercises.find(x => x.id === itemId);
  if (!item) return;
  const ex = DB.getExercise(item.exerciseId);
  openModal({
    title: ex ? ex.name : 'Übung',
    body: `
      <div class="row3">
        <label class="field"><span>Sätze</span><input id="f-sets" type="number" inputmode="numeric" min="1" value="${item.sets}" /></label>
        <label class="field"><span>Wdh.</span><input id="f-reps" type="number" inputmode="numeric" min="1" value="${item.reps}" /></label>
        <label class="field"><span>Pause (s)</span><input id="f-rest" type="number" inputmode="numeric" min="0" step="5" value="${item.restSec}" /></label>
      </div>`,
    footer: `<button class="btn ghost" data-x>Abbrechen</button><button class="btn primary" data-ok>Speichern</button>`,
    onMount: (m, close) => {
      $('[data-x]', m).onclick = close;
      $('[data-ok]', m).onclick = () => {
        DB.updateDayExercise(dayId, itemId, {
          sets: Math.max(1, parseInt($('#f-sets', m).value) || 1),
          reps: Math.max(1, parseInt($('#f-reps', m).value) || 1),
          restSec: Math.max(0, parseInt($('#f-rest', m).value) || 0),
        });
        close(); render();
      };
    },
  });
}

// ============================================================
//  Übungs-Auswahl / Bibliothek
// ============================================================
function pickExerciseModal(onPick) {
  const list = DB.exercises();
  const body = `
    <input id="f-search" placeholder="Übung suchen …" style="margin-bottom:10px" />
    <button class="btn primary block" id="newEx" style="margin-bottom:12px">+ Neue Übung anlegen</button>
    <div id="exList"></div>`;
  openModal({
    title: 'Übung wählen',
    body,
    onMount: (m, close) => {
      const listEl = $('#exList', m);
      const draw = (q = '') => {
        const items = list.filter(e => e.name.toLowerCase().includes(q.toLowerCase()));
        listEl.innerHTML = items.length ? items.map(e =>
          `<div class="list-row" data-pick="${e.id}"><div class="grow"><div class="r-title">${esc(e.name)}</div>
            ${e.category ? `<div class="r-sub">${esc(e.category)}</div>` : ''}</div><span class="arrow">＋</span></div>`
        ).join('') : `<div class="tiny muted center" style="padding:12px">Keine Übung gefunden.</div>`;
        $$('[data-pick]', listEl).forEach(n => n.onclick = () => { close(); onPick(n.dataset.pick); });
      };
      draw();
      $('#f-search', m).oninput = e => draw(e.target.value);
      $('#newEx', m).onclick = () => { close(); editExerciseModal(null, newId => onPick(newId)); };
    },
  });
}

route('/library', () => {
  setChrome({ title: 'Übungsbibliothek', back: false });
  const list = DB.exercises();
  let html = `<input id="libSearch" placeholder="Suchen …" style="margin-bottom:12px" />`;
  if (!list.length) {
    html += `<div class="empty"><div class="big">📚</div><div>Deine Bibliothek ist leer.</div>
      <div class="tiny" style="margin:8px 0 0">Lege deine Übungen selbst an – sie sind in allen Plänen nutzbar.</div></div>`;
  } else {
    html += `<div id="libList"></div>`;
  }
  appEl.innerHTML = html;
  const draw = (q = '') => {
    const listEl = $('#libList', appEl);
    if (!listEl) return;
    const items = list.filter(e => e.name.toLowerCase().includes(q.toLowerCase()));
    listEl.innerHTML = items.map(e => {
      const uses = DB.exerciseUsage(e.id);
      return `<div class="list-row" data-ex="${e.id}">
        <div class="grow"><div class="r-title">${esc(e.name)}</div>
          <div class="r-sub">${[e.category, e.muscles?.join(', ')].filter(Boolean).join(' · ') || 'keine Kategorie'} ${uses ? '· ' + uses + '× trainiert' : ''}</div></div>
        <button class="btn ghost sm" data-edit="${e.id}">✏️</button>
        <span class="arrow" data-stats="${e.id}">📈</span></div>`;
    }).join('');
    $$('[data-ex]', listEl).forEach(n => n.onclick = (ev) => {
      if (ev.target.closest('[data-edit]')) return editExerciseModal(n.dataset.ex);
      navigate('/stats/' + n.dataset.ex);
    });
  };
  draw();
  const search = $('#libSearch', appEl);
  if (search) search.oninput = e => draw(e.target.value);
  appEl.append(el('button', { class: 'fab', onclick: () => editExerciseModal(null) }, '+'));
});

function editExerciseModal(id, onSaved) {
  const ex = id ? DB.getExercise(id) : { name: '', category: '', muscles: [], notes: '', unit: 'kg' };
  const usage = id ? DB.exerciseUsage(id) : 0;
  openModal({
    title: id ? 'Übung bearbeiten' : 'Neue Übung',
    body: `
      <label class="field"><span>Name</span><input id="f-name" value="${esc(ex.name)}" placeholder="z.B. Bankdrücken" /></label>
      <label class="field"><span>Kategorie (optional)</span><input id="f-cat" value="${esc(ex.category)}" placeholder="z.B. Brust, Langhantel" /></label>
      <label class="field"><span>Muskelgruppen (Komma-getrennt, optional)</span><input id="f-mus" value="${esc((ex.muscles || []).join(', '))}" placeholder="Brust, Trizeps" /></label>
      <label class="field"><span>Einheit</span>
        <select id="f-unit"><option value="kg"${ex.unit === 'kg' ? ' selected' : ''}>kg</option><option value="lb"${ex.unit === 'lb' ? ' selected' : ''}>lb</option></select></label>
      <label class="field"><span>Notiz (optional)</span><textarea id="f-notes" placeholder="Technik-Hinweise, Einstellung am Gerät …">${esc(ex.notes)}</textarea></label>`,
    footer: `${id ? '<button class="btn danger" data-del>Löschen</button>' : ''}<button class="btn ghost" data-x>Abbrechen</button><button class="btn primary" data-ok>Speichern</button>`,
    onMount: (m, close) => {
      $('[data-x]', m).onclick = close;
      $('[data-ok]', m).onclick = () => {
        const name = $('#f-name', m).value.trim();
        if (!name) return toast('Bitte einen Namen eingeben');
        const data = {
          name,
          category: $('#f-cat', m).value.trim(),
          muscles: $('#f-mus', m).value.split(',').map(s => s.trim()).filter(Boolean),
          unit: $('#f-unit', m).value,
          notes: $('#f-notes', m).value.trim(),
        };
        let savedId = id;
        if (id) DB.updateExercise(id, data); else savedId = DB.addExercise(data).id;
        close();
        if (onSaved) onSaved(savedId); else render();
      };
      const del = $('[data-del]', m);
      if (del) del.onclick = async () => {
        const warn = usage ? `Diese Übung wurde ${usage}× trainiert. Beim Löschen bleiben die Einheiten erhalten, aber die Statistik ist nicht mehr erreichbar. Trotzdem löschen?` : 'Übung löschen?';
        if (await confirmDialog(warn, { danger: true, okText: 'Löschen' })) { DB.deleteExercise(id); close(); render(); }
      };
    },
  });
}

// ============================================================
//  Ansicht: Aktives Training
// ============================================================
let restTimer = null;

route('/train/:id', ({ id }) => {
  const s = DB.getSession(id);
  if (!s) return navigate('/');
  const finished = !!s.finishedAt;
  setChrome({ title: s.dayName || 'Training', back: true, actions: [actionBtn('🗑️', () => discardSession(id))] });

  const container = el('div');
  renderTrain(container, id);
  appEl.innerHTML = '';
  appEl.append(container);
});

function renderTrain(container, id) {
  const s = DB.getSession(id);
  if (!s) return;
  const finished = !!s.finishedAt;

  let html = `
    <div class="card">
      <div class="train-head">
        <div class="chip" id="t-chip" style="background:${esc(s.color)}22;color:${esc(s.color)}">${esc(s.emoji || '💪')}</div>
        <div style="flex:1">
          <div style="font-weight:700">${esc(s.dayName || 'Training')}</div>
          <input id="t-date" type="date" value="${esc(s.date)}" style="margin-top:6px;width:auto" />
        </div>
      </div>
      <div class="row2" style="margin-top:10px">
        <label class="field" style="margin:0"><span>Kürzel/Emoji (Kalender)</span><input id="t-emoji" maxlength="4" value="${esc(s.emoji || '')}" /></label>
        <div>
          <label class="field" style="margin:0"><span>Farbe</span></label>
          <div class="color-pick" id="t-color">${COLORS.map(c => `<button type="button" data-c="${c}" style="background:${c};width:24px;height:24px" class="${c === s.color ? 'sel' : ''}"></button>`).join('')}</div>
        </div>
      </div>
      <label class="field" style="margin:12px 0 0"><span>Notiz</span><textarea id="t-note" placeholder="z.B. gut drauf, Schulter zwickt …">${esc(s.note || '')}</textarea></label>
    </div>
    <div id="entries"></div>
    <button class="btn block" id="addEx" style="margin-top:6px">+ Übung hinzufügen</button>
    <hr class="sep" />
    ${finished
      ? `<button class="btn primary block" id="reopenBtn">Als „laufend" markieren</button>`
      : `<button class="btn good block" id="finishBtn">✓ Training beenden</button>`}
    <div style="height:20px"></div>
  `;
  container.innerHTML = html;

  // Kopf-Felder
  $('#t-date', container).onchange = e => DB.updateSession(id, { date: e.target.value });
  $('#t-emoji', container).oninput = e => { DB.updateSession(id, { emoji: e.target.value.trim() }); $('#t-chip', container).textContent = e.target.value.trim() || '💪'; };
  $('#t-note', container).oninput = e => DB.updateSession(id, { note: e.target.value });
  $$('#t-color button', container).forEach(b => b.onclick = () => {
    DB.updateSession(id, { color: b.dataset.c });
    $$('#t-color button', container).forEach(x => x.classList.remove('sel')); b.classList.add('sel');
    const chip = $('#t-chip', container); chip.style.background = b.dataset.c + '22'; chip.style.color = b.dataset.c;
  });

  renderEntries(container, id);

  $('#addEx', container).onclick = () => pickExerciseModal(exId => {
    const ex = DB.getExercise(exId);
    const s2 = DB.getSession(id);
    s2.entries.push({ exerciseId: exId, name: ex ? ex.name : 'Übung', unit: ex?.unit || 'kg', targetReps: 10, targetSets: 3, restSec: DB.db().settings.defaultRestSec, sets: [{ weight: '', reps: '', done: false }] });
    DB.save(); renderTrain(container, id);
  });

  const finishBtn = $('#finishBtn', container);
  if (finishBtn) finishBtn.onclick = async () => {
    DB.updateSession(id, { finishedAt: Date.now() });
    stopRest();
    toast('Training gespeichert 💪');
    navigate('/');
  };
  const reopenBtn = $('#reopenBtn', container);
  if (reopenBtn) reopenBtn.onclick = () => { DB.updateSession(id, { finishedAt: null }); renderTrain(container, id); };
}

function renderEntries(container, id) {
  const s = DB.getSession(id);
  const wrap = $('#entries', container);
  wrap.innerHTML = '';
  s.entries.forEach((entry, ei) => {
    const last = DB.lastEntryFor(entry.exerciseId, id);
    const lastTxt = last ? setSummary(last.entry.sets) : '';
    const block = el('div', { class: 'ex-block' });
    block.innerHTML = `
      <div class="ex-head">
        <div class="ex-name">${esc(entry.name)}</div>
        <button class="btn ghost sm" data-rest>⏱ ${entry.restSec}s</button>
        <button class="btn ghost sm" data-rmex>🗑️</button>
      </div>
      ${lastTxt ? `<div class="ex-last">Letztes Mal (${fmtShort(last.session.date)}): <b>${esc(lastTxt)}</b></div>` : `<div class="ex-last">Erstes Mal – noch keine Vergleichsdaten</div>`}
      <div class="ex-body">
        <div class="set-head"><span>#</span><span>Gewicht</span><span>Wdh.</span><span>✓</span><span></span></div>
        <div class="sets"></div>
        <div class="ex-actions">
          <button class="btn sm" data-addset>+ Satz</button>
        </div>
      </div>`;

    const setsEl = $('.sets', block);
    entry.sets.forEach((set, si) => {
      const row = el('div', { class: 'set-row' + (set.done ? ' done' : '') });
      row.innerHTML = `
        <div class="setno">${si + 1}</div>
        <input type="number" inputmode="decimal" step="0.5" placeholder="${last?.entry.sets[si] ? fmtWeight(DB.num(last.entry.sets[si].weight)) : (entry.unit || 'kg')}" value="${set.weight === '' ? '' : esc(set.weight)}" data-w />
        <input type="number" inputmode="numeric" placeholder="${last?.entry.sets[si] ? DB.num(last.entry.sets[si].reps) : (entry.targetReps || '')}" value="${set.reps === '' ? '' : esc(set.reps)}" data-r />
        <button class="set-check ${set.done ? 'on' : ''}" data-check>✓</button>
        <button class="set-del" data-delset>✕</button>`;
      $('[data-w]', row).oninput = e => { set.weight = e.target.value; DB.save(); };
      $('[data-r]', row).oninput = e => { set.reps = e.target.value; DB.save(); };
      $('[data-check]', row).onclick = () => {
        set.done = !set.done;
        if (set.done && (set.weight === '' || set.reps === '')) {
          // Platzhalter (letztes Mal) übernehmen, falls leer
          if (set.weight === '' && last?.entry.sets[si]) set.weight = DB.num(last.entry.sets[si].weight);
          if (set.reps === '' && last?.entry.sets[si]) set.reps = DB.num(last.entry.sets[si].reps);
        }
        DB.save();
        row.classList.toggle('done', set.done);
        $('[data-check]', row).classList.toggle('on', set.done);
        $('[data-w]', row).value = set.weight === '' ? '' : set.weight;
        $('[data-r]', row).value = set.reps === '' ? '' : set.reps;
        if (set.done) startRest(entry.restSec);
      };
      $('[data-delset]', row).onclick = () => { entry.sets.splice(si, 1); DB.save(); renderEntries(container, id); };
      setsEl.append(row);
    });

    $('[data-addset]', block).onclick = () => {
      const prev = entry.sets[entry.sets.length - 1];
      entry.sets.push({ weight: prev ? prev.weight : '', reps: prev ? prev.reps : '', done: false });
      DB.save(); renderEntries(container, id);
    };
    $('[data-rest]', block).onclick = () => editRestModal(entry, () => renderEntries(container, id));
    $('[data-rmex]', block).onclick = async () => {
      if (await confirmDialog('Übung aus diesem Training entfernen?', { danger: true, okText: 'Entfernen' })) {
        s.entries.splice(ei, 1); DB.save(); renderEntries(container, id);
      }
    };
    wrap.append(block);
  });
}

function editRestModal(entry, after) {
  openModal({
    title: 'Pausenzeit',
    body: `<label class="field"><span>Pause zwischen den Sätzen (Sekunden)</span>
      <input id="f-rest" type="number" inputmode="numeric" min="0" step="5" value="${entry.restSec}" /></label>
      <div class="btn-row">
        <button class="btn sm" data-preset="60">60s</button>
        <button class="btn sm" data-preset="90">90s</button>
        <button class="btn sm" data-preset="120">120s</button>
        <button class="btn sm" data-preset="180">180s</button>
      </div>`,
    footer: `<button class="btn ghost" data-x>Abbrechen</button><button class="btn primary" data-ok>Speichern</button>`,
    onMount: (m, close) => {
      $$('[data-preset]', m).forEach(b => b.onclick = () => { $('#f-rest', m).value = b.dataset.preset; });
      $('[data-x]', m).onclick = close;
      $('[data-ok]', m).onclick = () => { entry.restSec = Math.max(0, parseInt($('#f-rest', m).value) || 0); DB.save(); close(); after && after(); };
    },
  });
}

// ---------- Pausen-Timer ----------
function ensureRestBar() {
  let bar = document.getElementById('restBar');
  if (!bar) {
    bar = el('div', { class: 'restbar hidden', id: 'restBar' });
    bar.innerHTML = `<span>⏱</span><span class="rt-time">0:00</span><button data-add>+30</button><button data-stop>Stop</button>`;
    document.body.append(bar);
    $('[data-add]', bar).onclick = () => { if (restTimer) { restTimer.remaining += 30; updateRestBar(); } };
    $('[data-stop]', bar).onclick = stopRest;
  }
  return bar;
}
function fmtTimer(sec) { const m = Math.floor(sec / 60), s = Math.max(0, sec % 60); return `${m}:${String(s).padStart(2, '0')}`; }
function updateRestBar() {
  const bar = ensureRestBar();
  if (!restTimer) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  $('.rt-time', bar).textContent = fmtTimer(restTimer.remaining);
}
function startRest(sec) {
  if (!sec || sec <= 0) return;
  stopRest();
  restTimer = { remaining: sec, iv: null };
  updateRestBar();
  restTimer.iv = setInterval(() => {
    restTimer.remaining--;
    if (restTimer.remaining <= 0) { beep(); stopRest(); toast('Pause vorbei ▶'); }
    else updateRestBar();
  }, 1000);
}
function stopRest() {
  if (restTimer?.iv) clearInterval(restTimer.iv);
  restTimer = null;
  const bar = document.getElementById('restBar');
  if (bar) bar.classList.add('hidden');
}
// Gemeinsamer AudioContext + Freischaltung.
// iOS/Safari erlaubt Ton nur, wenn der AudioContext einmal per Nutzer-Geste
// gestartet wurde. Deshalb beim ersten Antippen freischalten – danach kann
// auch der Timer (ohne direkte Geste) piepen.
let audioCtx = null;
let audioUnlocked = false;
function getAudioCtx() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { return null; }
  }
  return audioCtx;
}
function unlockAudio() {
  const ctx = getAudioCtx(); if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  if (!audioUnlocked) {
    try {
      const b = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = b; src.connect(ctx.destination); src.start(0);
    } catch (e) { /* ignore */ }
    audioUnlocked = true;
  }
}
document.addEventListener('pointerdown', unlockAudio);
document.addEventListener('touchstart', unlockAudio, { passive: true });

function beep() {
  if (!DB.db().settings.soundOnRestEnd) return;
  try {
    const ctx = getAudioCtx(); if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.12;
    const t = ctx.currentTime;
    o.start(t);
    o.frequency.setValueAtTime(660, t + 0.15);
    o.stop(t + 0.4); // Kontext offen lassen (Wiederverwendung)
  } catch (e) { /* Audio evtl. blockiert */ }
  // Vibration wird von iOS-Safari nicht unterstützt – auf Android o.k.
  if (navigator.vibrate) { try { navigator.vibrate([200, 80, 200]); } catch (e) { /* ignore */ } }
}

function discardSession(id) {
  confirmDialog('Dieses Training verwerfen und löschen?', { danger: true, okText: 'Verwerfen' }).then(ok => {
    if (ok) { DB.deleteSession(id); stopRest(); navigate('/'); }
  });
}

// ============================================================
//  Ansicht: Verlauf
// ============================================================
route('/history', () => {
  setChrome({ title: 'Verlauf', back: true });
  const list = DB.sessions();
  let html = '';
  if (!list.length) html = `<div class="empty"><div class="big">📖</div><div>Noch keine Trainings aufgezeichnet.</div></div>`;
  else {
    let curMonth = '';
    list.forEach(s => {
      const d = parseISO(s.date); const mk = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      if (mk !== curMonth) { curMonth = mk; html += `<div class="section-title">${mk}</div>`; }
      html += sessionRow(s) + (s.finishedAt ? '' : ' ');
    });
  }
  appEl.innerHTML = html;
  $$('[data-session]', appEl).forEach(n => n.onclick = () => navigate('/train/' + n.dataset.session));
});

// ============================================================
//  Ansicht: Kalender (Habit-Tracker)
// ============================================================
let calState = null;
route('/calendar', () => {
  setChrome({ title: 'Kalender', back: false });
  const now = new Date();
  if (!calState) calState = { y: now.getFullYear(), m: now.getMonth() };
  drawCalendar();
});

function drawCalendar() {
  const { y, m } = calState;
  const byDate = DB.sessionsByDate();
  const first = new Date(y, m, 1);
  const startDow = (first.getDay() + 6) % 7; // Mo=0
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayKey = DB.todayISO();

  // Kennzahlen
  const monthCount = Object.keys(byDate).filter(k => { const d = parseISO(k); return d.getFullYear() === y && d.getMonth() === m; }).reduce((a, k) => a + byDate[k].length, 0);
  const streak = currentStreak(byDate);
  const totalSessions = DB.sessions().filter(s => s.finishedAt).length;

  let cells = '';
  const dows = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  dows.forEach(d => cells += `<div class="cal-dow">${d}</div>`);
  for (let i = 0; i < startDow; i++) cells += `<div class="cal-cell empty-cell"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const evs = byDate[key] || [];
    const isToday = key === todayKey;
    const emojis = evs.slice(0, 3).map(e => e.emoji || '•').join('');
    cells += `<div class="cal-cell ${isToday ? 'today' : ''}" data-date="${key}" ${evs.length ? '' : 'style="cursor:default"'}>
      <span class="cal-day">${d}</span>
      ${evs.length ? `<span class="cal-emojis">${esc(emojis)}</span>` : ''}
    </div>`;
  }

  appEl.innerHTML = `
    <div class="streak-row">
      <div class="stat-tile"><div class="v">🔥 ${streak}</div><div class="l">Streak (Wochen)</div></div>
      <div class="stat-tile"><div class="v">${monthCount}</div><div class="l">diesen Monat</div></div>
      <div class="stat-tile"><div class="v">${totalSessions}</div><div class="l">gesamt</div></div>
    </div>
    <div class="card">
      <div class="cal-head">
        <button class="icon-btn" data-prev>‹</button>
        <h2>${MONTHS[m]} ${y}</h2>
        <button class="icon-btn" data-next>›</button>
      </div>
      <div class="cal-grid">${cells}</div>
    </div>
    <p class="tiny muted center">Jeder Trainingstag erscheint mit seinem Kürzel/Emoji – wie ein Habit-Tracker. Tippe auf einen Tag mit Eintrag.</p>
  `;
  $('[data-prev]', appEl).onclick = () => { calState.m--; if (calState.m < 0) { calState.m = 11; calState.y--; } drawCalendar(); };
  $('[data-next]', appEl).onclick = () => { calState.m++; if (calState.m > 11) { calState.m = 0; calState.y++; } drawCalendar(); };
  $$('[data-date]', appEl).forEach(n => n.onclick = () => {
    const evs = byDate[n.dataset.date]; if (!evs || !evs.length) return;
    dayDetailModal(n.dataset.date, evs);
  });
}

function currentStreak(byDate) {
  // Wochen-Streak: aufeinanderfolgende Kalenderwochen mit >=1 Training, rückwärts ab dieser Woche
  const weeks = new Set();
  Object.keys(byDate).forEach(k => weeks.add(isoWeekKey(parseISO(k))));
  let streak = 0;
  let cur = new Date();
  // erlaube, dass diese Woche noch leer ist -> Streak zählt ab letzter trainierter Woche
  let wk = isoWeekKey(cur);
  if (!weeks.has(wk)) { cur.setDate(cur.getDate() - 7); wk = isoWeekKey(cur); if (!weeks.has(wk)) return 0; }
  while (weeks.has(isoWeekKey(cur))) { streak++; cur.setDate(cur.getDate() - 7); }
  return streak;
}
function isoWeekKey(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${week}`;
}

function dayDetailModal(dateKey, evs) {
  openModal({
    title: fmtDate(dateKey),
    body: evs.map(e => `<div class="list-row" data-open="${e.sessionId}">
      <div class="chip" style="background:${esc(e.color)}22;color:${esc(e.color)}">${esc(e.emoji || '💪')}</div>
      <div class="grow"><div class="r-title">${esc(e.name)}</div></div><span class="arrow">›</span></div>`).join(''),
    onMount: (m, close) => {
      $$('[data-open]', m).forEach(n => n.onclick = () => { close(); navigate('/train/' + n.dataset.open); });
    },
  });
}

// ============================================================
//  Ansicht: Statistik
// ============================================================
route('/stats', () => {
  setChrome({ title: 'Statistik', back: false });
  const list = DB.exercises().filter(e => DB.exerciseHistory(e.id).length > 0);
  let html = `<p class="tiny muted">Wähle eine Übung für Verlauf, Rekorde und Trends.</p>`;
  if (!list.length) {
    html += `<div class="empty"><div class="big">📈</div><div>Noch keine Trainingsdaten.</div>
      <div class="tiny" style="margin:8px 0 0">Zeichne ein paar Trainings auf – dann erscheinen hier Statistiken.</div></div>`;
  } else {
    list.forEach(e => {
      const pr = DB.exercisePRs(e.id);
      html += `<div class="list-row" data-ex="${e.id}">
        <div class="grow"><div class="r-title">${esc(e.name)}</div>
          <div class="r-sub">${pr.sessionsCount}× · Bestes 1RM ${fmtWeight(pr.best1rm)} kg · Max ${fmtWeight(pr.maxWeight)} kg</div></div>
        <span class="arrow">›</span></div>`;
    });
  }
  appEl.innerHTML = html;
  $$('[data-ex]', appEl).forEach(n => n.onclick = () => navigate('/stats/' + n.dataset.ex));
});

route('/stats/:id', ({ id }) => {
  const ex = DB.getExercise(id);
  if (!ex) return navigate('/stats');
  setChrome({ title: ex.name, back: true, actions: [actionBtn('✏️', () => editExerciseModal(id))] });
  const hist = DB.exerciseHistory(id);
  const pr = DB.exercisePRs(id);

  if (!hist.length) {
    appEl.innerHTML = `<div class="empty"><div class="big">📈</div><div>Noch keine aufgezeichneten Sätze für „${esc(ex.name)}".</div></div>`;
    return;
  }

  const tiles = `
    <div class="streak-row">
      <div class="stat-tile"><div class="v">${fmtWeight(pr.best1rm)}</div><div class="l">Bestes e1RM (kg)</div></div>
      <div class="stat-tile"><div class="v">${fmtWeight(pr.maxWeight)}</div><div class="l">Max Gewicht (kg)</div></div>
    </div>
    <div class="streak-row">
      <div class="stat-tile"><div class="v">${fmtWeight(pr.maxVolume)}</div><div class="l">Max Volumen</div></div>
      <div class="stat-tile"><div class="v">${pr.sessionsCount}</div><div class="l">Einheiten</div></div>
    </div>`;

  const e1rmChart = lineChart(hist.map(h => ({ y: h.est1rm, label: fmtShort(h.date) })), 'kg');
  const volChart = lineChart(hist.map(h => ({ y: h.volume, label: fmtShort(h.date) })), '');
  const wChart = lineChart(hist.map(h => ({ y: h.maxWeight, label: fmtShort(h.date) })), 'kg');

  const rows = hist.slice().reverse().map(h => `<tr>
    <td>${fmtShort(h.date)}</td>
    <td>${h.setCount}</td>
    <td class="num">${fmtWeight(h.maxWeight)}</td>
    <td class="num">${h.bestSet ? fmtWeight(h.bestSet.weight) + '×' + h.bestSet.reps : '–'}</td>
    <td class="num">${fmtWeight(h.est1rm)}</td>
    <td class="num">${fmtWeight(h.volume)}</td>
  </tr>`).join('');

  appEl.innerHTML = `
    ${tiles}
    <div class="chart-wrap"><div class="c-title"><span>Geschätztes 1RM (Epley)</span><span>${fmtWeight(pr.best1rm)} kg</span></div>${e1rmChart}</div>
    <div class="chart-wrap"><div class="c-title"><span>Max. Gewicht je Einheit</span><span>${fmtWeight(pr.maxWeight)} kg</span></div>${wChart}</div>
    <div class="chart-wrap"><div class="c-title"><span>Volumen (kg gesamt)</span><span>${fmtWeight(pr.maxVolume)}</span></div>${volChart}</div>
    <div class="section-title">Verlauf</div>
    <div class="card" style="overflow-x:auto;padding:6px 10px">
      <table class="hist">
        <thead><tr><th>Datum</th><th>Sätze</th><th>Max</th><th>Bester Satz</th><th>e1RM</th><th>Vol.</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="tiny muted">e1RM = geschätztes Einwiederholungsmaximum (Epley-Formel). Nur abgehakte Sätze fließen in die Statistik ein.</p>
  `;
});

// SVG-Liniendiagramm (ohne externe Bibliotheken)
function lineChart(points, unit = '') {
  const W = 320, H = 140, pad = { l: 30, r: 10, t: 12, b: 20 };
  const pts = points.filter(p => p.y > 0);
  if (pts.length < 2) return `<div class="tiny muted center" style="padding:24px">Noch zu wenig Daten für einen Trend (mind. 2 Einheiten).</div>`;
  const ys = pts.map(p => p.y);
  let min = Math.min(...ys), max = Math.max(...ys);
  if (min === max) { min = min * 0.9; max = max * 1.1 || 1; }
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const X = i => pad.l + (pts.length === 1 ? iw / 2 : (i / (pts.length - 1)) * iw);
  const Y = v => pad.t + ih - ((v - min) / (max - min)) * ih;
  const line = pts.map((p, i) => `${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
  const area = `${pad.l},${pad.t + ih} ${line} ${(pad.l + iw).toFixed(1)},${pad.t + ih}`;
  const dots = pts.map((p, i) => `<circle class="chart-dot" cx="${X(i).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="2.5" />`).join('');
  const gridY = [min, (min + max) / 2, max].map(v =>
    `<line class="chart-grid" x1="${pad.l}" y1="${Y(v).toFixed(1)}" x2="${W - pad.r}" y2="${Y(v).toFixed(1)}" />
     <text class="chart-lbl" x="2" y="${(Y(v) + 3).toFixed(1)}">${fmtWeight(v)}</text>`).join('');
  const first = pts[0].label, lastl = pts[pts.length - 1].label;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <defs><linearGradient id="grad" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity="0.5"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    ${gridY}
    <polygon class="chart-area" points="${area}" />
    <polyline class="chart-line" points="${line}" />
    ${dots}
    <text class="chart-lbl" x="${pad.l}" y="${H - 5}">${esc(first)}</text>
    <text class="chart-lbl" x="${W - pad.r}" y="${H - 5}" text-anchor="end">${esc(lastl)}</text>
  </svg>`;
}

// ============================================================
//  Ansicht: Einstellungen / Backup
// ============================================================
route('/settings', () => {
  setChrome({ title: 'Einstellungen', back: true });
  const s = DB.db().settings;
  const stats = { ex: DB.exercises().length, loc: DB.locations().length, plans: DB.db().plans.length, days: DB.db().days.length, ses: DB.sessions().length };
  appEl.innerHTML = `
    <div class="section-title">Standardwerte</div>
    <div class="card">
      <label class="field" style="margin:0"><span>Standard-Pausenzeit (s)</span>
        <input id="s-rest" type="number" min="0" step="5" value="${s.defaultRestSec}" /></label>
      <label class="field" style="margin:12px 0 0;display:flex;align-items:center;gap:10px">
        <input id="s-sound" type="checkbox" ${s.soundOnRestEnd ? 'checked' : ''} style="width:auto" />
        <span style="margin:0">Ton/Vibration am Pausenende</span></label>
    </div>

    <div class="section-title">Daten & Backup</div>
    <div class="card">
      <p class="tiny muted" style="margin-top:0">Alle Daten liegen <b>lokal auf diesem Gerät</b> (im Browser). Es gibt keinen Server. Erstelle regelmäßig ein Backup!</p>
      <div class="tiny muted">${stats.loc} Orte · ${stats.plans} Pläne · ${stats.days} Trainingstage · ${stats.ex} Übungen · ${stats.ses} Einheiten</div>
      <div class="btn-row" style="margin-top:12px">
        <button class="btn primary" id="expBtn">⬇ Backup exportieren</button>
        <button class="btn" id="impBtn">⬆ Importieren</button>
      </div>
      <input type="file" id="impFile" accept="application/json,.json" hidden />
    </div>

    <div class="section-title">Beispieldaten</div>
    <div class="card">
      <p class="tiny muted" style="margin-top:0">Zum Ausprobieren einen Beispiel-Ort mit Plan, Übungen und Verlauf anlegen.</p>
      <button class="btn" id="seedBtn">Beispieldaten laden</button>
    </div>

    <div class="section-title">Gefahrenzone</div>
    <div class="card">
      <button class="btn danger block" id="wipeBtn">Alle Daten löschen</button>
    </div>
    <p class="tiny muted center" style="margin-top:14px">Trainingsplan · lokale PWA · v1</p>
  `;

  $('#s-rest', appEl).onchange = e => { s.defaultRestSec = Math.max(0, parseInt(e.target.value) || 0); DB.save(); };
  $('#s-sound', appEl).onchange = e => { s.soundOnRestEnd = e.target.checked; DB.save(); };

  $('#expBtn', appEl).onclick = () => {
    const blob = new Blob([DB.exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: `trainingsplan-backup-${DB.todayISO()}.json` });
    document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast('Backup exportiert');
  };
  const impFile = $('#impFile', appEl);
  $('#impBtn', appEl).onclick = () => impFile.click();
  impFile.onchange = async () => {
    const file = impFile.files[0]; if (!file) return;
    const text = await file.text();
    const mode = await confirmDialog('Backup importieren: Bestehende Daten ERSETZEN? (Abbrechen = zusammenführen)', { okText: 'Ersetzen' });
    try { DB.importData(text, mode ? 'replace' : 'merge'); toast('Import erfolgreich'); render(); }
    catch (e) { toast('Import fehlgeschlagen: ' + e.message); }
    impFile.value = '';
  };
  $('#seedBtn', appEl).onclick = async () => {
    if (await confirmDialog('Beispieldaten hinzufügen?')) { seedDemo(); toast('Beispieldaten geladen'); navigate('/plans'); }
  };
  $('#wipeBtn', appEl).onclick = async () => {
    if (await confirmDialog('Wirklich ALLE Daten unwiderruflich löschen?', { danger: true, okText: 'Alles löschen' })) {
      DB.wipeAll(); toast('Alle Daten gelöscht'); navigate('/');
    }
  };
});

// ---------- Beispieldaten ----------
function seedDemo() {
  const bank = DB.addExercise({ name: 'Bankdrücken', category: 'Brust', muscles: ['Brust', 'Trizeps'] });
  const squat = DB.addExercise({ name: 'Kniebeuge', category: 'Beine', muscles: ['Quadrizeps', 'Gesäß'] });
  const row = DB.addExercise({ name: 'Rudern', category: 'Rücken', muscles: ['Latissimus', 'Bizeps'] });
  const ohp = DB.addExercise({ name: 'Schulterdrücken', category: 'Schulter', muscles: ['Schulter'] });

  const loc = DB.addLocation({ name: 'Fitnessstudio', emoji: '🏋️', color: COLORS[0] });
  const plan = DB.addPlan({ locationId: loc.id, name: 'Oberkörper / Unterkörper', emoji: '🔄', color: COLORS[0] });
  const upper = DB.addDay({ planId: plan.id, name: 'Oberkörper', emoji: 'OK', color: COLORS[3] });
  const lower = DB.addDay({ planId: plan.id, name: 'Unterkörper', emoji: '🦵', color: COLORS[1] });
  DB.addExerciseToDay(upper.id, bank.id, { sets: 3, reps: 8, restSec: 120 });
  DB.addExerciseToDay(upper.id, row.id, { sets: 3, reps: 10, restSec: 90 });
  DB.addExerciseToDay(upper.id, ohp.id, { sets: 3, reps: 10, restSec: 90 });
  DB.addExerciseToDay(lower.id, squat.id, { sets: 4, reps: 6, restSec: 150 });

  // Ein paar vergangene Einheiten für Statistik
  const d = DB.db();
  const mk = (dayId, daysAgo, entriesData) => {
    const base = new Date(); base.setDate(base.getDate() - daysAgo);
    const iso = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
    const day = DB.getDay(dayId);
    const s = {
      id: DB.uid('ses'), locationId: loc.id, planId: plan.id, dayId, dayName: day.name,
      date: iso, startedAt: base.getTime(), finishedAt: base.getTime() + 3600000,
      emoji: day.emoji, color: day.color, note: '',
      entries: entriesData,
    };
    d.sessions.push(s);
  };
  const setsOf = (exId, name, arr) => ({ exerciseId: exId, name, unit: 'kg', targetReps: arr[0][1], targetSets: arr.length, restSec: 120, sets: arr.map(([w, r]) => ({ weight: w, reps: r, done: true })) });
  mk(upper.id, 21, [setsOf(bank.id, 'Bankdrücken', [[60, 8], [60, 8], [55, 9]]), setsOf(row.id, 'Rudern', [[50, 10], [50, 10], [50, 9]])]);
  mk(upper.id, 14, [setsOf(bank.id, 'Bankdrücken', [[62.5, 8], [62.5, 7], [60, 8]]), setsOf(row.id, 'Rudern', [[52.5, 10], [52.5, 10], [50, 10]])]);
  mk(upper.id, 7, [setsOf(bank.id, 'Bankdrücken', [[65, 8], [65, 7], [62.5, 8]]), setsOf(row.id, 'Rudern', [[55, 10], [55, 9], [52.5, 10]])]);
  mk(lower.id, 18, [setsOf(squat.id, 'Kniebeuge', [[80, 6], [80, 6], [80, 5], [75, 6]])]);
  mk(lower.id, 11, [setsOf(squat.id, 'Kniebeuge', [[85, 6], [85, 5], [82.5, 6], [80, 6]])]);
  mk(lower.id, 4, [setsOf(squat.id, 'Kniebeuge', [[87.5, 6], [87.5, 6], [85, 6], [82.5, 6]])]);
  DB.save();
}

// ============================================================
//  Start
// ============================================================
DB.db();
render();

// Service Worker (Offline / installierbar)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW-Registrierung fehlgeschlagen', err));
  });
}
