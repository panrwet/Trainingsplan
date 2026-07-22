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

// ---------- Design/Anzeige-Einstellungen anwenden (Theme, Akzentfarbe, Schriftgröße, Bewegungsreduzierung) ----------
const THEMES = [
  { id: 'system', emoji: '🌓', label: 'System' },
  { id: 'dark', emoji: '🌙', label: 'Dunkel' },
  { id: 'light', emoji: '☀️', label: 'Hell' },
  { id: 'oled', emoji: '⬛', label: 'OLED Schwarz' },
  { id: 'midnight', emoji: '🌌', label: 'Mitternachtsblau' },
  { id: 'forest', emoji: '🌲', label: 'Wald' },
  { id: 'contrast', emoji: '🔲', label: 'Kontrast' },
];
const BG_BY_THEME = { dark: '#0f1220', light: '#f4f5f9', oled: '#000000', midnight: '#0a0e27', forest: '#0f1912', contrast: '#000000' };
function resolveTheme(theme) {
  if (theme === 'system') {
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
  }
  return theme || 'dark';
}
// Akzentfarbe (Hex) um `percent` (-1..1) auf-/abdunkeln, für die zweite Akzentschattierung.
function shade(hex, percent) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  const clamp = v => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + Math.round(255 * percent));
  const g = clamp(((n >> 8) & 0xff) + Math.round(255 * percent));
  const b = clamp((n & 0xff) + Math.round(255 * percent));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
// Hex-Farbe in rgba() mit gegebener Deckkraft umwandeln (für die Label-Hintergründe).
function withAlpha(hex, alpha) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, ${alpha})`;
}
const CORNER_RADII = { sharp: ['4px', '3px'], normal: ['12px', '9px'], round: ['20px', '16px'] };
function applyDisplaySettings() {
  const s = DB.db().settings;
  const theme = resolveTheme(s.theme);
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.fontsize = s.fontSize || 'medium';
  document.documentElement.dataset.reducedMotion = s.reducedMotion ? '1' : '0';
  document.documentElement.dataset.density = s.density || 'normal';
  const [radius, radiusSm] = CORNER_RADII[s.cornerStyle] || CORNER_RADII.normal;
  document.documentElement.style.setProperty('--radius', radius);
  document.documentElement.style.setProperty('--radius-sm', radiusSm);
  const accent = s.accentColor || '#6c8cff';
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--accent-2', shade(accent, -0.22));
  const muscleColor = s.muscleColor || '#7dd3fc';
  const equipColor = s.equipColor || '#86efac';
  document.documentElement.style.setProperty('--muscle-color', muscleColor);
  document.documentElement.style.setProperty('--muscle-bg', withAlpha(muscleColor, 0.16));
  document.documentElement.style.setProperty('--equip-color', equipColor);
  document.documentElement.style.setProperty('--equip-bg', withAlpha(equipColor, 0.16));
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.content = BG_BY_THEME[theme] || '#0f1220';
}
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (DB.db().settings.theme === 'system') applyDisplaySettings();
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

// ---------- Orts-Reiter (oben) & Orts-Kürzel ----------
// Die Daten (Statistik, "letztes Mal", Verlauf) sind je Ort getrennt,
// weil Geräte zwischen Gyms nicht vergleichbar sind.
function locationBarHTML() {
  const locs = DB.locations();
  const active = DB.getActiveLocationId();
  if (!locs.length) return '';
  return `<div class="loc-bar">
    ${locs.map(l => `<button class="loc-chip ${l.id === active ? 'sel' : ''}" data-loc-sel="${l.id}" title="${l.id === active ? 'Tippen zum Bearbeiten' : ''}">
        <span>${esc(l.emoji)}</span><span>${esc(l.name)}</span>${l.id === active ? '<span class="loc-chip-edit">✏️</span>' : ''}</button>`).join('')}
    <button class="loc-chip add" data-loc-add title="Ort hinzufügen">＋</button>
  </div>`;
}
// Orte werden über die Reiter selbst bearbeitet: Tippen auf den bereits
// aktiven Reiter öffnet den Bearbeiten-Dialog, sonst wechselt es den Ort.
function wireLocationBar(root) {
  $$('[data-loc-sel]', root).forEach(b => b.onclick = () => {
    const clickedId = b.dataset.locSel;
    if (clickedId === DB.getActiveLocationId()) { editLocationModal(clickedId); return; }
    DB.setActiveLocation(clickedId); render();
  });
  const add = $('[data-loc-add]', root); if (add) add.onclick = () => editLocationModal(null);
}
// kleines Orts-Kürzel-Badge (Emoji/Kürzel des Ortes)
function locBadge(loc) {
  if (!loc) return '';
  return `<span class="loc-badge" title="${esc(loc.name)}">${esc(loc.emoji)}</span>`;
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

// Pläne ist die neue Startseite (Start-Tab entfällt - hatte keine eigene
// Funktion mehr, nachdem "Laufendes Training" nach Pläne gewandert und
// "Zuletzt" entfernt wurde, da der Kalender diese Übersicht bereits bietet).
function render() {
  const hash = location.hash.replace(/^#/, '') || '/plans';
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
  navigate('/plans');
}
function updateTabs(hash) {
  let active = 'plans';
  if (hash.startsWith('/plans') || hash.startsWith('/plan') || hash.startsWith('/day') || hash.startsWith('/train')) active = 'plans';
  else if (hash.startsWith('/calendar')) active = 'calendar';
  else if (hash.startsWith('/stats')) active = 'stats';
  else if (hash.startsWith('/library') || hash.startsWith('/exercise')) active = 'library';
  else if (hash.startsWith('/settings')) active = 'settings';
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === active));
}
window.addEventListener('hashchange', render);

// Läuft für diesen Trainingstag schon eine unbeendete Einheit (z.B. nach App-Neustart
// oder versehentlichem Doppel-Tippen auf "Training starten"), wird diese fortgesetzt
// statt eine weitere parallele Einheit anzulegen - sonst würden mehrere unbeendete
// Einheiten gleichzeitig unter "Laufendes Training" auftauchen.
function startTraining(dayId) {
  const existing = DB.sessions().find(x => x.dayId === dayId && !x.finishedAt);
  const s = existing || DB.startSession(dayId);
  if (s) navigate('/train/' + s.id);
}

// ---------- Globale Suche über Pläne/Trainingstage/Übungen/Trainings hinweg ----------
function globalSearchModal() {
  openModal({
    title: 'Suche',
    body: `<input id="f-gsearch" placeholder="Plan, Trainingstag, Übung oder Training suchen …" />
      <div id="gsearchResults" style="margin-top:12px"></div>`,
    onMount: (m, close) => {
      const input = $('#f-gsearch', m);
      const results = $('#gsearchResults', m);
      const section = (title, rows) => rows.length ? `<div class="tiny muted" style="margin:10px 0 4px;text-transform:uppercase;font-size:.7rem;letter-spacing:.04em">${title}</div>${rows.join('')}` : '';
      const row = (emoji, name, sub, kind, id) => `<div class="list-row" data-goto2="${kind}:${id}">
        <div class="chip">${esc(emoji)}</div>
        <div class="grow"><div class="r-title">${esc(name)}</div>${sub ? `<div class="r-sub">${esc(sub)}</div>` : ''}</div>
        <span class="arrow">›</span></div>`;
      const draw = q => {
        if (!q.trim()) { results.innerHTML = `<div class="tiny muted center" style="padding:12px">Suchbegriff eingeben …</div>`; return; }
        const r = DB.globalSearch(q);
        const total = r.plans.length + r.days.length + r.exercises.length + r.sessions.length;
        if (!total) { results.innerHTML = `<div class="tiny muted center" style="padding:12px">Keine Treffer.</div>`; return; }
        results.innerHTML =
          section('Pläne', r.plans.map(p => row(p.emoji, p.name, '', 'plan', p.id))) +
          section('Trainingstage', r.days.map(d => row(d.emoji, d.name, '', 'day', d.id))) +
          section('Übungen', r.exercises.map(e => row('📚', e.name, '', 'ex', e.id))) +
          section('Trainings', r.sessions.map(s => row(s.emoji || '💪', s.dayName || 'Training', fmtDate(s.date), 'ses', s.id)));
        $$('[data-goto2]', results).forEach(n => n.onclick = () => {
          close();
          const [kind, id] = n.dataset.goto2.split(':');
          if (kind === 'plan') navigate('/plan/' + id);
          else if (kind === 'day') navigate('/day/' + id);
          else if (kind === 'ex') navigate('/stats/' + id);
          else if (kind === 'ses') navigate('/train/' + id);
        });
      };
      draw('');
      input.oninput = e => draw(e.target.value);
      setTimeout(() => input.focus(), 50);
    },
  });
}

// ============================================================
//  Ansicht: Pläne (Orte-Übersicht)
// ============================================================
route('/plans', () => {
  setChrome({ title: 'Pläne', back: false, actions: [actionBtn('🔍', () => globalSearchModal())] });
  const locs = DB.locations();
  let html = locationBarHTML();

  if (!locs.length) {
    html += `<div class="empty"><div class="big">📍</div><div>Noch keine Trainingsorte.</div>
      <div class="tiny" style="margin:8px 0 12px">Ein Ort ist z.B. „Fitnessstudio" oder „Zuhause".</div>
      <button class="btn primary" data-add-loc>+ Ort anlegen</button></div>`;
    appEl.innerHTML = html;
    const a = $('[data-add-loc]', appEl); if (a) a.onclick = () => editLocationModal(null);
    return;
  }

  const active = DB.getActiveLocation();
  const plans = DB.plansByLocation(active.id);
  const unfinished = DB.sessions().filter(s => !s.finishedAt && s.locationId === active.id);

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

  html += `<div class="section-title">Pläne · ${esc(active.emoji)} ${esc(active.name)}</div>`;

  // Dauerhaft verfügbar (nicht nur direkt nach dem Anlegen eines Ortes): Plan-Struktur
  // von einem anderen, bereits bestehenden Ort übernehmen - egal wann dessen Pläne entstanden sind.
  const otherLocsHavePlans = DB.locations().some(l => l.id !== active.id && DB.plansByLocation(l.id).length);
  if (otherLocsHavePlans) {
    html += `<button class="btn ghost block" id="importPlanBtn" style="margin-bottom:12px">📥 Plan von anderem Ort übernehmen</button>`;
  }

  if (!plans.length) {
    html += `<div class="empty"><div class="big">📋</div><div>Noch keine Pläne an diesem Ort.</div>
      <div class="tiny" style="margin:8px 0 0">Tippe unten auf „＋".</div></div>`;
  } else {
    plans.forEach(p => {
      const days = DB.daysByPlan(p.id);
      html += `<details class="plan-acc">
        <summary>
          <div class="chip" style="background:${esc(p.color)}22;color:${esc(p.color)}">${esc(p.emoji)}</div>
          <div class="grow"><div class="r-title">${esc(p.name)}</div>
            <div class="r-sub">${days.length} Trainingstage</div></div>
          <button class="btn ghost sm" data-edit-plan="${p.id}" title="Plan verwalten">✏️</button>
          <span class="acc-chevron">⌄</span>
        </summary>
        <div class="plan-acc-body">
          ${days.length ? days.map(day => `<div class="list-row" data-start="${day.id}">
              <div class="chip" style="background:${esc(day.color)}22;color:${esc(day.color)}">${esc(day.emoji)}</div>
              <div class="grow"><div class="r-title">${esc(day.name)}</div>
                <div class="r-sub">${day.exercises.length} Übungen</div></div>
              <span class="btn good sm">Start ▶</span>
            </div>`).join('') : `<div class="tiny muted center" style="padding:8px 4px">Noch keine Trainingstage – tippe auf ✏️ zum Einrichten.</div>`}
        </div>
      </details>`;
    });
  }

  appEl.innerHTML = html;
  wireLocationBar(appEl);
  $$('[data-goto]', appEl).forEach(n => n.onclick = () => navigate(n.dataset.goto));
  $$('[data-edit-plan]', appEl).forEach(b => b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); navigate('/plan/' + b.dataset.editPlan); });
  $$('[data-start]', appEl).forEach(n => n.onclick = (e) => { e.stopPropagation(); startTraining(n.dataset.start); });
  const importPlanBtn = $('#importPlanBtn', appEl);
  if (importPlanBtn) importPlanBtn.onclick = () => offerPlanImportModal(active.id, { closeLabel: 'Schließen' });
  appEl.append(el('button', { class: 'fab', onclick: () => editPlanModal(null, active.id) }, '+'));
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
        if (id) {
          DB.updateLocation(id, data); close(); render();
        } else {
          const newLoc = DB.addLocation(data);
          close();
          render(); // Pläne für den neuen (bereits aktiven) Ort sofort anzeigen
          const hasOtherPlans = DB.locations().some(l => l.id !== newLoc.id && DB.plansByLocation(l.id).length);
          if (hasOtherPlans) offerPlanImportModal(newLoc.id);
        }
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

// Nach dem Anlegen eines neuen Orts anbieten, einen bestehenden Plan von
// einem anderen Ort zu übernehmen (nur die Struktur - Übungen, Sätze/Wdh./
// Pause -, keine Gewichts-/Wiederholungsdaten, die sind ja ortsabhängig).
function offerPlanImportModal(newLocationId, { closeLabel = 'Ohne Plan starten' } = {}) {
  const otherLocs = DB.locations().filter(l => l.id !== newLocationId);
  const rows = [];
  otherLocs.forEach(loc => {
    DB.plansByLocation(loc.id).forEach(p => rows.push({ plan: p, loc }));
  });
  openModal({
    title: 'Plan übernehmen?',
    body: `<p class="tiny muted" style="margin-top:0">Übernimm einen bestehenden Plan von einem anderen Ort als Kopie - nur die Struktur (Übungen, Sätze/Wdh./Pause), keine Gewichte oder Trainingsverlauf. Du kannst mehrere übernehmen.</p>
      <div id="planImportList">${rows.map(r => `<div class="list-row" data-import-plan="${r.plan.id}">
        <div class="chip" style="background:${esc(r.plan.color)}22;color:${esc(r.plan.color)}">${esc(r.plan.emoji)}</div>
        <div class="grow"><div class="r-title">${esc(r.plan.name)}</div>
          <div class="r-sub">von ${esc(r.loc.emoji)} ${esc(r.loc.name)}</div></div>
        <span class="arrow">＋</span></div>`).join('') || '<div class="tiny muted center" style="padding:10px">Keine Pläne vorhanden.</div>'}</div>`,
    footer: `<button class="btn ghost" data-x>${esc(closeLabel)}</button>`,
    onMount: (m, close) => {
      $('[data-x]', m).onclick = close;
      $$('[data-import-plan]', m).forEach(row => row.onclick = () => {
        const planId = row.dataset.importPlan;
        DB.copyPlanToLocation(planId, newLocationId);
        row.querySelector('.arrow').textContent = '✓';
        row.style.opacity = '.6'; row.style.pointerEvents = 'none';
        toast('Plan übernommen');
        render(); // Pläne-Liste im Hintergrund aktualisieren, egal wie das Modal geschlossen wird
      });
    },
  });
}

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
          DB.deletePlan(id); close(); navigate('/plans');
        }
      };
    },
  });
}

// Plan (inkl. aller Trainingstage) als unabhängige Kopie an einen anderen Ort
// übernehmen. Übungen werden nicht dupliziert (gemeinsame Bibliothek) –
// nur Statistik/"letztes Mal" bleiben je Ort weiterhin getrennt.
function copyPlanToLocationModal(planId) {
  const p = DB.getPlan(planId);
  const targets = DB.locations().filter(l => l.id !== p.locationId);
  if (!targets.length) return toast('Kein weiterer Ort vorhanden – lege zuerst einen zweiten Ort an.');
  openModal({
    title: 'Plan kopieren nach …',
    body: `<p class="tiny muted" style="margin-top:0">„${esc(p.name)}" wird inkl. aller Trainingstage als unabhängige Kopie angelegt – Änderungen an der Kopie wirken sich nicht auf das Original aus.</p>
      <div>${targets.map(l => `<div class="list-row" data-target="${l.id}">
        <div class="chip" style="background:${esc(l.color)}22;color:${esc(l.color)}">${esc(l.emoji)}</div>
        <div class="grow"><div class="r-title">${esc(l.name)}</div></div><span class="arrow">›</span></div>`).join('')}</div>`,
    footer: `<button class="btn ghost" data-x>Abbrechen</button>`,
    onMount: (m, close) => {
      $('[data-x]', m).onclick = close;
      $$('[data-target]', m).forEach(n => n.onclick = () => {
        const targetId = n.dataset.target;
        const newPlan = DB.copyPlanToLocation(planId, targetId);
        close();
        DB.setActiveLocation(targetId);
        toast(`Kopiert nach ${DB.getLocation(targetId).name}`);
        navigate('/plan/' + newPlan.id);
      });
    },
  });
}

// ============================================================
//  Ansicht: Plan-Detail (Trainingstage)
// ============================================================
route('/plan/:id', ({ id }) => {
  const p = DB.getPlan(id);
  if (!p) return navigate('/plans');
  setChrome({ title: `${p.emoji} ${p.name}`, back: true, actions: [
    actionBtn('📤', () => copyPlanToLocationModal(id), ''),
    actionBtn('✏️', () => editPlanModal(id, p.locationId)),
  ] });
  const loc = DB.getLocation(p.locationId);
  const days = DB.daysByPlan(id);
  let html = `${loc ? `<div class="tiny muted" style="margin:-2px 0 10px">${esc(loc.emoji)} ${esc(loc.name)}</div>` : ''}
    <div class="section-title">Trainingstage</div>`;
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

// Verschiebt das Element an Index `i` in einer Liste (Trainingstag-Übungen ODER
// Trainings-Entries) um eine Position nach oben/unten (dir=-1/+1) - eine zusammen-
// hängende Zirkel-Gruppe (gleiche groupId) wird dabei als EIN Block bewegt, sonst
// würde eine Gruppe auseinandergerissen (Superset-Rendering/Pausenlogik setzen
// lückenlos zusammenhängende groupId-Läufe voraus).
function reorderStep(list, i, dir) {
  const gid = list[i].groupId;
  let start = i, end = i;
  if (gid) {
    while (start > 0 && list[start - 1].groupId === gid) start--;
    while (end < list.length - 1 && list[end + 1].groupId === gid) end++;
  }
  if (dir < 0 && start > 0) {
    let ns = start - 1;
    const ngid = list[ns].groupId;
    if (ngid) { while (ns > 0 && list[ns - 1].groupId === ngid) ns--; }
    const block = list.splice(start, end - start + 1);
    list.splice(ns, 0, ...block);
  } else if (dir > 0 && end < list.length - 1) {
    let ne = end + 1;
    const ngid = list[ne].groupId;
    if (ngid) { while (ne < list.length - 1 && list[ne + 1].groupId === ngid) ne++; }
    const blockLen = end - start + 1;
    const block = list.splice(start, blockLen);
    list.splice(ne - blockLen + 1, 0, ...block);
  }
}

// Analog zu DB.groupExercises/regroupContiguous, aber index-basiert - Trainings-
// Entries haben (anders als Trainingstag-Übungen) keine eigene stabile id. Verschiebt
// die ausgewählten Indizes (in Auswahl-Reihenfolge) zu einem zusammenhängenden Block
// an der Position des ERSTEN ausgewählten Elements, sonst wäre die neue Zirkel-Gruppe
// nicht lückenlos (Superset-Rendering/Pausenlogik setzen das voraus).
function regroupByIndex(list, selectedIndices) {
  const idxSet = new Set(selectedIndices);
  const selected = selectedIndices.map(i => list[i]).filter(Boolean);
  if (selected.length < 2) return;
  const insertAt = list.findIndex((x, i) => idxSet.has(i));
  const others = list.filter((x, i) => !idxSet.has(i));
  const insertAtInOthers = list.slice(0, insertAt).filter((x, i) => !idxSet.has(i)).length;
  others.splice(insertAtInOthers, 0, ...selected);
  list.length = 0;
  list.push(...others);
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
  const plan = DB.getPlan(day.planId);
  const loc = plan ? DB.getLocation(plan.locationId) : null;
  let selectMode = false;
  let reorderMode = false;
  const selected = new Set();

  function draw() {
    const anyMode = selectMode || reorderMode;
    setChrome({ title: `${day.emoji} ${day.name}`, back: true, actions: anyMode ? [] : [actionBtn('✏️', () => editDayModal(id, day.planId))] });

    let html = `${loc ? `<div class="tiny muted" style="margin:-2px 0 10px">${esc(loc.emoji)} ${esc(loc.name)} · ${esc(plan.emoji)} ${esc(plan.name)}</div>` : ''}`;
    if (!anyMode) html += `<button class="btn good block" id="startBtn" style="margin-bottom:16px">▶ Training starten</button>`;
    html += `<div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
      <span>Übungen</span>
      ${selectMode ? `<span class="tiny muted">${selected.size} ausgewählt</span>`
        : reorderMode ? `<span class="tiny muted">Reihenfolge anpassen</span>`
        : (day.exercises.length > 1 ? `<div style="display:flex;gap:6px">
            <button class="btn ghost sm" id="startGroupBtn">🔗 Zirkel erstellen</button>
            <button class="btn ghost sm" id="startReorderBtn">↕ Reihenfolge</button>
          </div>` : '')}
    </div>`;

    if (!day.exercises.length) {
      html += `<div class="empty"><div class="big">📚</div><div>Noch keine Übungen.</div>
        <div class="tiny" style="margin:8px 0 0">Füge Übungen aus deiner Bibliothek hinzu.</div></div>`;
    } else if (selectMode) {
      html += `<p class="tiny muted" style="margin-top:0">Wähle 2 oder mehr Übungen, die als Zirkel ohne Pause dazwischen trainiert werden sollen.</p>`;
      day.exercises.forEach(item => { html += dayExerciseCardHTML(item, true, selected); });
    } else if (reorderMode) {
      html += `<p class="tiny muted" style="margin-top:0">Mit ▲/▼ die Reihenfolge der Übungen ändern. Zirkel-Übungen bewegen sich als Block.</p>`;
      day.exercises.forEach((item, idx) => {
        const ex = DB.getExercise(item.exerciseId);
        html += `<div class="card">
          <div style="display:flex;align-items:center;gap:8px">
            <div class="grow"><b>${item.groupId ? '🔗 ' : ''}${esc(ex ? ex.name : '(gelöscht)')}</b></div>
            <span class="mv" data-up="${item.id}" style="padding:4px 8px;color:${idx === 0 ? 'var(--border)' : 'var(--text-dim2)'};pointer-events:${idx === 0 ? 'none' : 'auto'}">▲</span>
            <span class="mv" data-down="${item.id}" style="padding:4px 8px;color:${idx === day.exercises.length - 1 ? 'var(--border)' : 'var(--text-dim2)'};pointer-events:${idx === day.exercises.length - 1 ? 'none' : 'auto'}">▼</span>
          </div>
        </div>`;
      });
    } else {
      let i = 0;
      while (i < day.exercises.length) {
        const gid = day.exercises[i].groupId;
        if (gid) {
          let j = i;
          while (j < day.exercises.length && day.exercises[j].groupId === gid) j++;
          html += `<div class="superset-wrap"><div class="superset-label" style="display:flex;justify-content:space-between;align-items:center">
            <span>🔗 Zirkel</span><button class="btn ghost sm" data-ungroup="${gid}">Auflösen</button></div>`;
          for (let k = i; k < j; k++) html += dayExerciseCardHTML(day.exercises[k], false, selected);
          html += `</div>`;
          i = j;
        } else {
          html += dayExerciseCardHTML(day.exercises[i], false, selected);
          i++;
        }
      }
    }
    appEl.innerHTML = html;

    if (selectMode) {
      $$('[data-select]', appEl).forEach(n => n.onclick = () => {
        const iid = n.dataset.select;
        selected.has(iid) ? selected.delete(iid) : selected.add(iid);
        draw();
      });
      const bar = el('div', { class: 'select-bar' });
      bar.innerHTML = `<button class="btn ghost" id="cancelGroupBtn">Abbrechen</button>
        <button class="btn primary" id="confirmGroupBtn" ${selected.size < 2 ? 'disabled' : ''}>🔗 Gruppieren (${selected.size})</button>`;
      appEl.append(bar);
      $('#cancelGroupBtn', bar).onclick = () => { selectMode = false; selected.clear(); draw(); };
      $('#confirmGroupBtn', bar).onclick = () => {
        if (selected.size < 2) return;
        DB.groupExercises(id, [...selected]);
        toast('Zirkel erstellt');
        selectMode = false; selected.clear();
        render();
      };
      return;
    }

    if (reorderMode) {
      $$('[data-up]', appEl).forEach(n => n.onclick = () => {
        const idx = day.exercises.findIndex(x => x.id === n.dataset.up);
        if (idx >= 0) reorderStep(day.exercises, idx, -1);
        DB.save(); draw();
      });
      $$('[data-down]', appEl).forEach(n => n.onclick = () => {
        const idx = day.exercises.findIndex(x => x.id === n.dataset.down);
        if (idx >= 0) reorderStep(day.exercises, idx, 1);
        DB.save(); draw();
      });
      const bar = el('div', { class: 'select-bar' });
      bar.innerHTML = `<button class="btn primary block" id="doneReorderBtn">Fertig</button>`;
      appEl.append(bar);
      $('#doneReorderBtn', bar).onclick = () => { reorderMode = false; render(); };
      return;
    }

    const startBtn = $('#startBtn', appEl);
    if (startBtn) startBtn.onclick = () => { if (!day.exercises.length) return toast('Erst Übungen hinzufügen'); startTraining(id); };
    const startGroupBtn = $('#startGroupBtn', appEl);
    if (startGroupBtn) startGroupBtn.onclick = () => { selectMode = true; selected.clear(); draw(); };
    const startReorderBtn = $('#startReorderBtn', appEl);
    if (startReorderBtn) startReorderBtn.onclick = () => { reorderMode = true; draw(); };
    $$('[data-edit]', appEl).forEach(n => n.onclick = () => editDayExerciseModal(id, n.dataset.edit));
    $$('[data-rm]', appEl).forEach(n => n.onclick = async () => {
      if (await confirmDialog('Übung aus diesem Trainingstag entfernen?', { danger: true, okText: 'Entfernen' })) { DB.removeDayExercise(id, n.dataset.rm); render(); }
    });
    $$('[data-ungroup]', appEl).forEach(n => n.onclick = async () => {
      if (await confirmDialog('Zirkel auflösen?', { okText: 'Auflösen' })) { DB.ungroupExercises(id, n.dataset.ungroup); render(); }
    });
    appEl.append(el('button', { class: 'fab', onclick: () => pickExerciseModal(exId => {
      DB.addExerciseToDay(id, exId); render();
    }, day.exercises.map(x => x.exerciseId)) }, '+'));
  }
  draw();
});

function dayExerciseCardHTML(item, selectMode, selected) {
  const ex = DB.getExercise(item.exerciseId);
  if (selectMode) {
    const isSel = selected.has(item.id);
    return `<div class="card tap select-card ${isSel ? 'sel' : ''}" data-select="${item.id}">
      <div style="display:flex;align-items:center;gap:10px">
        <div class="select-check ${isSel ? 'on' : ''}">${isSel ? '✓' : ''}</div>
        <div class="grow"><b>${esc(ex ? ex.name : '(gelöscht)')}</b>
          <div class="tiny muted" style="margin-top:2px">${item.sets} Sätze × ${item.reps} Wdh</div></div>
      </div>
    </div>`;
  }
  return `<div class="card" data-item="${item.id}">
    <div style="display:flex;align-items:center;gap:8px">
      <div class="grow" style="flex:1"><b>${esc(ex ? ex.name : '(gelöscht)')}</b>
        ${ex ? tagBadgesHTML(ex) : ''}
        <div class="tiny muted" style="margin-top:2px">${item.sets} Sätze × ${item.reps} Wdh · Pause ${item.restSec}s</div></div>
      <button class="btn ghost sm" data-edit="${item.id}">✏️</button>
      <button class="btn ghost sm" data-rm="${item.id}">🗑️</button>
    </div>
  </div>`;
}

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
function pickExerciseModal(onPick, excludeIds = []) {
  const list = DB.exercises();
  const excludeSet = new Set(excludeIds);
  const body = `
    <input id="f-search" placeholder="Übung suchen …" style="margin-bottom:10px" />
    ${exerciseFilterHTML()}
    <button class="btn primary block" id="newEx" style="margin:12px 0">+ Neue Übung anlegen</button>
    <div id="exList"></div>`;
  openModal({
    title: 'Übung wählen',
    body,
    onMount: (m, close) => {
      const listEl = $('#exList', m);
      const draw = (q = '') => {
        const items = applyExerciseFilter(list).filter(e => !q || e.name.toLowerCase().includes(q.toLowerCase()));
        listEl.innerHTML = items.length ? items.map(e => {
          const dup = excludeSet.has(e.id);
          return `<div class="list-row ${dup ? 'disabled' : ''}" ${dup ? '' : `data-pick="${e.id}"`}>
            <div class="grow"><div class="r-title">${esc(e.name)}</div>
              ${tagBadgesHTML(e)}
              ${dup ? '<div class="tiny muted">Bereits in diesem Trainingstag</div>' : ''}</div>
            <span class="arrow">${dup ? '' : '＋'}</span></div>`;
        }).join('') : `<div class="tiny muted center" style="padding:12px">Keine Übung passt zum Filter.</div>`;
        $$('[data-pick]', listEl).forEach(n => n.onclick = () => { close(); onPick(n.dataset.pick); });
      };
      draw();
      wireExerciseFilter(m, () => draw($('#f-search', m).value));
      $('#f-search', m).oninput = e => draw(e.target.value);
      $('#newEx', m).onclick = () => { close(); editExerciseModal(null, newId => onPick(newId)); };
    },
  });
}

// Farbige Muskel-/Geräte-Labels wie in der Bibliothek (auch im Training genutzt).
// Farbigkeit ist über Einstellungen -> "Farbige Muskel-/Geräte-Labels" abschaltbar.
function tagBadgesHTML(ex) {
  if (!ex) return '';
  const colored = DB.db().settings.tagColors;
  const mCls = colored ? 'tag-badge muscle' : 'tag-badge neutral';
  const eCls = colored ? 'tag-badge equip' : 'tag-badge neutral';
  const parts = [];
  if (ex.equipment) parts.push(`<span class="${eCls}">${esc(ex.equipment)}</span>`);
  (ex.muscles || []).forEach(m => parts.push(`<span class="${mCls}">${esc(m)}</span>`));
  return parts.length ? `<div class="tag-badges">${parts.join('')}</div>` : '';
}

// Muskel-/Geräte-Filter: geteilter Zustand, damit dieselbe Filterung sowohl in der
// Bibliothek als auch überall dort verfügbar ist, wo eine Übung ausgewählt wird
// (Trainingstag bearbeiten, Übung während des Trainings hinzufügen - siehe
// pickExerciseModal). matchMode steuert nur die Muskelgruppen-Auswahl (UND = alle
// gewählten Muskeln müssen zutreffen, ODER = mindestens eine) - bei Geräten ist nur
// ODER sinnvoll, da eine Übung immer genau ein Gerät hat.
let exFilter = { muscles: new Set(), equipment: new Set(), matchMode: 'or' };

// Gemeinsame Filter-UI (Muskelgruppe/Gerät-Chips + UND/ODER-Umschalter), wird sowohl
// in /library als auch in pickExerciseModal eingebettet.
function exerciseFilterHTML() {
  const muscleList = DB.muscleGroups();
  const equipList = DB.equipmentTypes();
  return `
    <details class="filter-acc"${exFilter.muscles.size ? ' open' : ''}>
      <summary>Muskelgruppe${exFilter.muscles.size ? `<span class="acc-badge">${exFilter.muscles.size}</span>` : ''}</summary>
      <div class="filter-row" id="filterMuscles">${muscleList.map(m => `<button type="button" class="filter-chip ${exFilter.muscles.has(m.name) ? 'sel' : ''}" data-fm="${esc(m.name)}">${esc(m.name)}</button>`).join('')}
        <button type="button" class="filter-chip add" id="manageMgChip">⚙️ Verwalten</button></div>
      <div class="filter-row" style="margin-top:6px">
        <span class="tiny muted" style="align-self:center">Bei mehreren Muskeln:</span>
        <button type="button" class="filter-chip ${exFilter.matchMode === 'and' ? 'sel' : ''}" id="matchModeChip">${exFilter.matchMode === 'and' ? 'UND (alle)' : 'ODER (mind. eine)'}</button>
      </div>
    </details>
    <details class="filter-acc"${exFilter.equipment.size ? ' open' : ''}>
      <summary>Gerät${exFilter.equipment.size ? `<span class="acc-badge">${exFilter.equipment.size}</span>` : ''}</summary>
      <div class="filter-row" id="filterEquip">${equipList.map(eq => `<button type="button" class="filter-chip ${exFilter.equipment.has(eq.name) ? 'sel' : ''}" data-fe="${esc(eq.name)}">${esc(eq.name)}</button>`).join('')}
        <button type="button" class="filter-chip add" id="manageEqChip">⚙️ Verwalten</button></div>
    </details>`;
}

// Wire-Handler für exerciseFilterHTML() - redraw ist nur die Liste, nicht die
// Filter-Chips selbst (die togglen ihren Zustand direkt per classList, ohne
// Neu-Rendern - vermeidet Flackern/Fokusverlust in der Suche).
function wireExerciseFilter(root, redraw) {
  const mgChip = $('#manageMgChip', root); if (mgChip) mgChip.onclick = () => manageMuscleGroupsModal();
  const eqChip = $('#manageEqChip', root); if (eqChip) eqChip.onclick = () => manageEquipmentModal();
  $$('[data-fm]', root).forEach(b => b.onclick = () => {
    const m = b.dataset.fm;
    exFilter.muscles.has(m) ? exFilter.muscles.delete(m) : exFilter.muscles.add(m);
    b.classList.toggle('sel');
    redraw();
  });
  $$('[data-fe]', root).forEach(b => b.onclick = () => {
    const eq = b.dataset.fe;
    exFilter.equipment.has(eq) ? exFilter.equipment.delete(eq) : exFilter.equipment.add(eq);
    b.classList.toggle('sel');
    redraw();
  });
  const modeChip = $('#matchModeChip', root);
  if (modeChip) modeChip.onclick = () => {
    exFilter.matchMode = exFilter.matchMode === 'and' ? 'or' : 'and';
    modeChip.textContent = exFilter.matchMode === 'and' ? 'UND (alle)' : 'ODER (mind. eine)';
    modeChip.classList.toggle('sel', exFilter.matchMode === 'and');
    redraw();
  };
}

// Wendet den aktuellen Muskel-/Geräte-Filter auf eine Übungsliste an (Suchtext wird
// separat je Aufrufer gefiltert, da der Suchbegriff nicht geteilt werden soll).
function applyExerciseFilter(list) {
  return list.filter(e => {
    if (exFilter.muscles.size) {
      const sel = [...exFilter.muscles];
      const has = m => (e.muscles || []).includes(m);
      const ok = exFilter.matchMode === 'and' ? sel.every(has) : sel.some(has);
      if (!ok) return false;
    }
    if (exFilter.equipment.size && !exFilter.equipment.has(e.equipment)) return false;
    return true;
  });
}

route('/library', () => {
  setChrome({ title: 'Übungsbibliothek', back: false });
  const list = DB.exercises();
  if (!list.length) {
    appEl.innerHTML = `<div class="empty"><div class="big">📚</div><div>Deine Bibliothek ist leer.</div>
      <div class="tiny" style="margin:8px 0 0">Lege deine Übungen selbst an – sie sind ortübergreifend in allen Plänen nutzbar.</div></div>`;
    appEl.append(el('button', { class: 'fab', onclick: () => editExerciseModal(null) }, '+'));
    return;
  }

  let html = `<input id="libSearch" placeholder="Suchen …" style="margin-bottom:10px" />
    ${exerciseFilterHTML()}
    <div id="libCount" class="tiny muted" style="margin:10px 0 8px">${list.length} von ${list.length} Übungen</div>
    <div id="libList"></div>`;
  appEl.innerHTML = html;
  wireExerciseFilter(appEl, () => draw($('#libSearch', appEl).value));

  function draw(q = '') {
    const listEl = $('#libList', appEl);
    if (!listEl) return;
    const items = applyExerciseFilter(list).filter(e => !q || e.name.toLowerCase().includes(q.toLowerCase()));
    $('#libCount', appEl).textContent = `${items.length} von ${list.length} Übungen`;
    listEl.innerHTML = items.length ? items.map(e => {
      const uses = DB.exerciseUsage(e.id);
      const lastDate = DB.lastTrainedDate(e.id);
      const usesLine = uses ? `${uses}× trainiert${lastDate ? ' · zuletzt am ' + fmtDate(lastDate) : ''}` : '';
      return `<div class="list-row" data-ex="${e.id}">
        <div class="grow"><div class="r-title">${esc(e.name)}</div>
          ${tagBadgesHTML(e)}
          ${usesLine ? `<div class="r-sub">${usesLine}</div>` : ''}</div>
        <button class="btn ghost sm" data-edit="${e.id}">✏️</button>
        <span class="arrow" data-stats="${e.id}">📈</span></div>`;
    }).join('') : `<div class="empty"><div>Keine Übung passt zum Filter.</div></div>`;
    $$('[data-ex]', listEl).forEach(n => n.onclick = (ev) => {
      if (ev.target.closest('[data-edit]')) return editExerciseModal(n.dataset.ex);
      navigate('/stats/' + n.dataset.ex);
    });
  }
  draw();
  const search = $('#libSearch', appEl);
  if (search) search.oninput = e => draw(e.target.value);
  appEl.append(el('button', { class: 'fab', onclick: () => editExerciseModal(null) }, '+'));
});

function editExerciseModal(id, onSaved) {
  const ex = id ? DB.getExercise(id) : { name: '', muscles: [], equipment: '', notes: '', unit: 'kg' };
  const usage = id ? DB.exerciseUsage(id) : 0;
  const muscles = new Set(ex.muscles || []);
  let equipment = ex.equipment || '';
  const activeLoc = id ? DB.getActiveLocation() : null;
  const locNote = activeLoc ? DB.getExerciseNote(id, activeLoc.id) : null;
  openModal({
    title: id ? 'Übung bearbeiten' : 'Neue Übung',
    body: `
      <label class="field"><span>Name</span><input id="f-name" value="${esc(ex.name)}" placeholder="z.B. Bankdrücken" /></label>
      <label class="field"><span>Muskelgruppen</span></label>
      <div class="filter-row" id="f-muscles" style="margin:-4px 0 12px"></div>
      <label class="field"><span>Gerät</span></label>
      <div class="filter-row" id="f-equip" style="margin:-4px 0 12px"></div>
      <label class="field"><span>Einheit</span>
        <select id="f-unit"><option value="kg"${ex.unit === 'kg' ? ' selected' : ''}>kg</option><option value="lb"${ex.unit === 'lb' ? ' selected' : ''}>lb</option></select></label>
      <label class="field"><span>Technik-Hinweis (optional, ortsunabhängig)</span><textarea id="f-notes" placeholder="z.B. Griff schulterbreit, Ellbogen anlegen …">${esc(ex.notes)}</textarea></label>
      ${activeLoc ? `<label class="field"><span>Geräte-Notiz für ${esc(activeLoc.name)} (dauerhaft, nur an diesem Ort)</span>
        <textarea id="f-locnote" placeholder="z.B. Sitzhöhe 4, Griffbreite außen …">${esc(locNote?.text || '')}</textarea></label>` : ''}`,
    footer: `${id ? '<button class="btn danger" data-del>Löschen</button>' : ''}<button class="btn ghost" data-x>Abbrechen</button><button class="btn primary" data-ok>Speichern</button>`,
    onMount: (m, close) => {
      function redrawMuscles() {
        const muscleList = DB.muscleGroups();
        $('#f-muscles', m).innerHTML = muscleList.map(mg => `<button type="button" class="filter-chip ${muscles.has(mg.name) ? 'sel' : ''}" data-mu="${esc(mg.name)}">${esc(mg.name)}</button>`).join('')
          + `<button type="button" class="filter-chip add" data-add-mu>+ Neu</button>`;
        $$('[data-mu]', m).forEach(b => b.onclick = () => {
          muscles.has(b.dataset.mu) ? muscles.delete(b.dataset.mu) : muscles.add(b.dataset.mu);
          redrawMuscles();
        });
        $('[data-add-mu]', m).onclick = () => quickAddMuscleGroup(name => { muscles.add(name); redrawMuscles(); });
      }
      redrawMuscles();
      function redrawEquip() {
        const equipList = DB.equipmentTypes();
        $('#f-equip', m).innerHTML = equipList.map(eq => `<button type="button" class="filter-chip ${equipment === eq.name ? 'sel' : ''}" data-e="${esc(eq.name)}">${esc(eq.name)}</button>`).join('')
          + `<button type="button" class="filter-chip add" data-add-eq>+ Neu</button>`;
        $$('[data-e]', m).forEach(b => b.onclick = () => {
          equipment = equipment === b.dataset.e ? '' : b.dataset.e;
          redrawEquip();
        });
        $('[data-add-eq]', m).onclick = () => quickAddEquipment(name => { equipment = name; redrawEquip(); });
      }
      redrawEquip();
      $('[data-x]', m).onclick = close;
      $('[data-ok]', m).onclick = async () => {
        const name = $('#f-name', m).value.trim();
        if (!name) return toast('Bitte einen Namen eingeben');
        const data = {
          name,
          muscles: [...muscles],
          equipment,
          unit: $('#f-unit', m).value,
          notes: $('#f-notes', m).value.trim(),
        };
        const dup = DB.findDuplicateExercise(data, id);
        if (dup) {
          const ok = await confirmDialog(`Es gibt bereits eine Übung „${dup.name}" mit denselben Muskelgruppen und demselben Gerät. Trotzdem als weitere Übung anlegen?`, { okText: 'Trotzdem anlegen' });
          if (!ok) return;
        }
        let savedId = id;
        if (id) DB.updateExercise(id, data); else savedId = DB.addExercise(data).id;
        if (activeLoc) DB.setExerciseNote(savedId, activeLoc.id, $('#f-locnote', m).value);
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

// Kleiner, gestapelter Dialog um schnell eine neue Geräte-Art anzulegen (z.B.
// direkt beim Taggen einer Übung, ohne den aktuellen Dialog zu verlassen).
function quickAddEquipment(onAdded) {
  openModal({
    title: 'Neue Geräte-Art',
    body: `<label class="field"><span>Name</span><input id="f-eqname" placeholder="z.B. Widerstandsband" /></label>`,
    footer: `<button class="btn ghost" data-x>Abbrechen</button><button class="btn primary" data-ok>Anlegen</button>`,
    onMount: (m, close) => {
      $('[data-x]', m).onclick = close;
      $('[data-ok]', m).onclick = () => {
        const name = $('#f-eqname', m).value.trim();
        if (!name) return toast('Bitte einen Namen eingeben');
        const eq = DB.addEquipmentType(name);
        close();
        onAdded(eq.name);
      };
      $('#f-eqname', m).focus();
    },
  });
}

// Geräte-Arten verwalten: anlegen, umbenennen (mit Übernahme bei allen
// betroffenen Übungen) und löschen (entfernt das Tag bei betroffenen Übungen,
// die Übung selbst bleibt erhalten).
function manageEquipmentModal() {
  let editingId = null;
  function draw(m) {
    const list = DB.equipmentTypes();
    const listEl = $('#eqList', m);
    listEl.innerHTML = list.length ? list.map(e => {
      const uses = DB.equipmentUsage(e.id);
      if (editingId === e.id) {
        return `<div class="list-row" data-eq="${e.id}">
          <input id="f-rename-${e.id}" value="${esc(e.name)}" style="flex:1" />
          <button class="btn ghost sm" data-save="${e.id}">✓</button>
          <button class="btn ghost sm" data-cancel="${e.id}">✕</button>
        </div>`;
      }
      return `<div class="list-row" data-eq="${e.id}">
        <div class="grow"><div class="r-title">${esc(e.name)}</div><div class="r-sub">${uses ? uses + '× verwendet' : 'unbenutzt'}</div></div>
        <button class="btn ghost sm" data-rename="${e.id}">✏️</button>
        <button class="btn ghost sm" data-del="${e.id}">🗑️</button>
      </div>`;
    }).join('') : `<div class="tiny muted center" style="padding:10px">Noch keine Geräte-Arten.</div>`;

    $$('[data-rename]', listEl).forEach(b => b.onclick = () => { editingId = b.dataset.rename; draw(m); });
    $$('[data-cancel]', listEl).forEach(b => b.onclick = () => { editingId = null; draw(m); });
    $$('[data-save]', listEl).forEach(b => b.onclick = () => {
      const rid = b.dataset.save;
      const val = $(`#f-rename-${rid}`, listEl).value.trim();
      if (val) DB.renameEquipmentType(rid, val);
      editingId = null; draw(m);
      cleanupAndRefresh();
    });
    $$('[data-del]', listEl).forEach(b => b.onclick = async () => {
      const rid = b.dataset.del; const eq = DB.getEquipmentType(rid); const uses = DB.equipmentUsage(rid);
      const warn = uses ? `„${eq.name}" wird bei ${uses} Übung(en) verwendet. Beim Löschen wird das Gerät dort entfernt (Übung bleibt erhalten). Trotzdem löschen?` : `„${eq.name}" löschen?`;
      if (await confirmDialog(warn, { danger: true, okText: 'Löschen' })) { DB.deleteEquipmentType(rid); draw(m); cleanupAndRefresh(); }
    });
  }
  // Veraltete Filterauswahl bereinigen (falls ein gefilterter Name umbenannt/gelöscht
  // wurde) und die Bibliothek dahinter aktualisieren - direkt nach jeder Änderung,
  // nicht erst beim Schließen (das Modal kann auch per Klick auf den Hintergrund
  // geschlossen werden, was den "Fertig"-Button-Handler umgeht).
  function cleanupAndRefresh() {
    const validNames = new Set(DB.equipmentTypes().map(e => e.name));
    [...exFilter.equipment].forEach(n => { if (!validNames.has(n)) exFilter.equipment.delete(n); });
    render();
  }
  openModal({
    title: 'Geräte-Arten verwalten',
    body: `<div class="btn-row" style="margin-bottom:12px">
        <input id="f-newEq" placeholder="Neue Geräte-Art, z.B. Kettlebell" style="flex:1" />
        <button class="btn primary" id="addEqBtn">+ Anlegen</button>
      </div>
      <div id="eqList"></div>`,
    footer: `<button class="btn ghost" data-x>Fertig</button>`,
    onMount: (m, close) => {
      $('[data-x]', m).onclick = close;
      $('#addEqBtn', m).onclick = () => {
        const name = $('#f-newEq', m).value.trim();
        if (!name) return toast('Bitte einen Namen eingeben');
        DB.addEquipmentType(name);
        $('#f-newEq', m).value = '';
        draw(m);
        cleanupAndRefresh();
      };
      draw(m);
    },
  });
}

// Kleiner, gestapelter Dialog um schnell eine neue Muskelgruppe anzulegen
// (z.B. direkt beim Taggen einer Übung, ohne den aktuellen Dialog zu verlassen).
function quickAddMuscleGroup(onAdded) {
  openModal({
    title: 'Neue Muskelgruppe',
    body: `<label class="field"><span>Name</span><input id="f-mgname" placeholder="z.B. Nacken" /></label>`,
    footer: `<button class="btn ghost" data-x>Abbrechen</button><button class="btn primary" data-ok>Anlegen</button>`,
    onMount: (m, close) => {
      $('[data-x]', m).onclick = close;
      $('[data-ok]', m).onclick = () => {
        const name = $('#f-mgname', m).value.trim();
        if (!name) return toast('Bitte einen Namen eingeben');
        const mg = DB.addMuscleGroup(name);
        close();
        onAdded(mg.name);
      };
      $('#f-mgname', m).focus();
    },
  });
}

// Muskelgruppen verwalten: anlegen, umbenennen (mit Übernahme bei allen
// betroffenen Übungen) und löschen (entfernt das Tag bei betroffenen Übungen,
// die Übung selbst bleibt erhalten).
function manageMuscleGroupsModal() {
  let editingId = null;
  function draw(m) {
    const list = DB.muscleGroups();
    const listEl = $('#mgList', m);
    listEl.innerHTML = list.length ? list.map(mg => {
      const uses = DB.muscleGroupUsage(mg.id);
      if (editingId === mg.id) {
        return `<div class="list-row" data-mg="${mg.id}">
          <input id="f-mgrename-${mg.id}" value="${esc(mg.name)}" style="flex:1" />
          <button class="btn ghost sm" data-save="${mg.id}">✓</button>
          <button class="btn ghost sm" data-cancel="${mg.id}">✕</button>
        </div>`;
      }
      return `<div class="list-row" data-mg="${mg.id}">
        <div class="grow"><div class="r-title">${esc(mg.name)}</div><div class="r-sub">${uses ? uses + '× verwendet' : 'unbenutzt'}</div></div>
        <button class="btn ghost sm" data-rename="${mg.id}">✏️</button>
        <button class="btn ghost sm" data-del="${mg.id}">🗑️</button>
      </div>`;
    }).join('') : `<div class="tiny muted center" style="padding:10px">Noch keine Muskelgruppen.</div>`;

    $$('[data-rename]', listEl).forEach(b => b.onclick = () => { editingId = b.dataset.rename; draw(m); });
    $$('[data-cancel]', listEl).forEach(b => b.onclick = () => { editingId = null; draw(m); });
    $$('[data-save]', listEl).forEach(b => b.onclick = () => {
      const rid = b.dataset.save;
      const val = $(`#f-mgrename-${rid}`, listEl).value.trim();
      if (val) DB.renameMuscleGroup(rid, val);
      editingId = null; draw(m);
      cleanupAndRefresh();
    });
    $$('[data-del]', listEl).forEach(b => b.onclick = async () => {
      const rid = b.dataset.del; const mg = DB.getMuscleGroup(rid); const uses = DB.muscleGroupUsage(rid);
      const warn = uses ? `„${mg.name}" wird bei ${uses} Übung(en) verwendet. Beim Löschen wird das Tag dort entfernt (Übung bleibt erhalten). Trotzdem löschen?` : `„${mg.name}" löschen?`;
      if (await confirmDialog(warn, { danger: true, okText: 'Löschen' })) { DB.deleteMuscleGroup(rid); draw(m); cleanupAndRefresh(); }
    });
  }
  // Siehe manageEquipmentModal: direkt nach jeder Änderung aktualisieren, nicht erst
  // beim Schließen (Backdrop-Klick würde den "Fertig"-Button-Handler sonst umgehen).
  function cleanupAndRefresh() {
    const validNames = new Set(DB.muscleGroups().map(mg => mg.name));
    [...exFilter.muscles].forEach(n => { if (!validNames.has(n)) exFilter.muscles.delete(n); });
    render();
  }
  openModal({
    title: 'Muskelgruppen verwalten',
    body: `<div class="btn-row" style="margin-bottom:12px">
        <input id="f-newMg" placeholder="Neue Muskelgruppe, z.B. Nacken" style="flex:1" />
        <button class="btn primary" id="addMgBtn">+ Anlegen</button>
      </div>
      <div id="mgList"></div>`,
    footer: `<button class="btn ghost" data-x>Fertig</button>`,
    onMount: (m, close) => {
      $('[data-x]', m).onclick = close;
      $('#addMgBtn', m).onclick = () => {
        const name = $('#f-newMg', m).value.trim();
        if (!name) return toast('Bitte einen Namen eingeben');
        DB.addMuscleGroup(name);
        $('#f-newMg', m).value = '';
        draw(m);
        cleanupAndRefresh();
      };
      draw(m);
    },
  });
}

// ============================================================
//  Ansicht: Aktives Training
// ============================================================
let restTimer = null;

// Zirkel-/Reihenfolge-Modus im laufenden Training (analog zu /day/:id) - modulglobal
// wie calState/exFilter, da renderTrain/renderEntries als eigenständige Funktionen
// (nicht als Route-Closure) von mehreren Stellen aus erneut aufgerufen werden.
let trainMode = null; // null | 'select' | 'reorder'
const trainSelected = new Set(); // Entry-Indizes während der Zirkel-Auswahl

route('/train/:id', ({ id }) => {
  const s = DB.getSession(id);
  if (!s) return navigate('/plans');
  trainMode = null; trainSelected.clear();

  const container = el('div');
  renderTrain(container, id);
  appEl.innerHTML = '';
  appEl.append(container);
});

// Alles rund um Training-Struktur (Zirkel, Reihenfolge, Übung hinzufügen, Farbe,
// Trainingstag/Plan bearbeiten) gebündelt hinter einem "⚙️"-Button - hält die
// eigentliche Trainingsansicht schlank (nur Name/Datum/Notiz + Übungen + Beenden).
function trainSettingsModal(s, container, id) {
  const day = DB.getDay(s.dayId);
  const plan = DB.getPlan(s.planId);
  openModal({
    title: 'Training – Einstellungen',
    body: `<div class="sheet">
      ${s.entries.length > 1 ? `<button class="sheet-btn" data-act="group">🔗 Zirkel erstellen</button>
      <button class="sheet-btn" data-act="reorder">↕ Reihenfolge anpassen</button>` : ''}
      <button class="sheet-btn" data-act="addex">➕ Übung hinzufügen</button>
      <button class="sheet-btn" data-act="color">🎨 Farbe ändern</button>
      ${day ? '<button class="sheet-btn" data-act="editday">✏️ Trainingstag bearbeiten</button>' : ''}
      ${plan ? '<button class="sheet-btn" data-act="editplan">📋 Plan bearbeiten</button>' : ''}
    </div>`,
    footer: `<button class="btn ghost block" data-x>Schließen</button>`,
    onMount: (m, close) => {
      $('[data-x]', m).onclick = close;
      const group = $('[data-act="group"]', m);
      if (group) group.onclick = () => { close(); trainMode = 'select'; trainSelected.clear(); renderTrain(container, id); };
      const reorder = $('[data-act="reorder"]', m);
      if (reorder) reorder.onclick = () => { close(); trainMode = 'reorder'; renderTrain(container, id); };
      $('[data-act="addex"]', m).onclick = () => {
        close();
        pickExerciseModal(exId => {
          const ex = DB.getExercise(exId);
          const s2 = DB.getSession(id);
          const cfg = DB.db().settings;
          const sets = [];
          for (let i = 0; i < cfg.defaultSets; i++) sets.push({ weight: '', reps: '', done: false });
          s2.entries.push({ exerciseId: exId, name: ex ? ex.name : 'Übung', unit: ex?.unit || 'kg', targetReps: cfg.defaultReps, targetSets: cfg.defaultSets, restSec: cfg.defaultRestSec, groupId: null, sets });
          DB.save(); renderTrain(container, id);
        }, s.entries.map(e => e.exerciseId));
      };
      $('[data-act="color"]', m).onclick = () => { close(); trainColorModal(s, container, id); };
      const editday = $('[data-act="editday"]', m);
      if (editday) editday.onclick = () => { close(); navigate('/day/' + s.dayId); };
      const editplan = $('[data-act="editplan"]', m);
      if (editplan) editplan.onclick = () => { close(); navigate('/plan/' + s.planId); };
    },
  });
}

function trainColorModal(s, container, id) {
  openModal({
    title: 'Farbe',
    body: `<div class="color-pick" id="t-color-modal">${COLORS.map(c => `<button type="button" data-c="${c}" style="background:${c}" class="${c === s.color ? 'sel' : ''}"></button>`).join('')}</div>`,
    onMount: (m, close) => {
      $$('#t-color-modal button', m).forEach(b => b.onclick = () => {
        DB.updateSession(id, { color: b.dataset.c });
        close();
        renderTrain(container, id);
      });
    },
  });
}

function renderTrain(container, id) {
  const s = DB.getSession(id);
  if (!s) return;
  const finished = !!s.finishedAt;
  setChrome({
    title: s.dayName || 'Training', back: true,
    actions: trainMode ? [] : [actionBtn('⚙️', () => trainSettingsModal(s, container, id)), actionBtn('🗑️', () => discardSession(id))],
  });

  let html = `
    <div class="card">
      <div class="train-head">
        <div class="chip" id="t-chip" style="background:${esc(s.color)}22;color:${esc(s.color)}">${esc(s.emoji || '💪')}</div>
        <div style="flex:1">
          <div style="font-weight:700">${esc(s.dayName || 'Training')}</div>
          <input id="t-date" type="date" value="${esc(s.date)}" style="margin-top:6px;width:auto" />
        </div>
      </div>
      <label class="field" style="margin:12px 0 0"><span>Notiz</span><textarea id="t-note" placeholder="z.B. gut drauf, Schulter zwickt …">${esc(s.note || '')}</textarea></label>
    </div>
    <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
      <span>Übungen</span>
      ${trainMode === 'select' ? `<span class="tiny muted">${trainSelected.size} ausgewählt</span>`
        : trainMode === 'reorder' ? `<span class="tiny muted">Reihenfolge anpassen</span>` : ''}
    </div>
    <div id="entries"></div>
    ${trainMode ? '' : `<hr class="sep" />
    ${finished
      ? `<button class="btn primary block" id="reopenBtn">Als „laufend" markieren</button>`
      : `<button class="btn good block" id="finishBtn">✓ Training beenden</button>`}`}
    <div style="height:${trainMode ? '70px' : '20px'}"></div>
  `;
  container.innerHTML = html;

  // Kopf-Felder
  $('#t-date', container).onchange = e => DB.updateSession(id, { date: e.target.value });
  $('#t-note', container).oninput = e => DB.updateSession(id, { note: e.target.value });

  renderEntries(container, id);

  const finishBtn = $('#finishBtn', container);
  if (finishBtn) finishBtn.onclick = async () => {
    const hasLoggedSet = s.entries.some(e => (e.sets || []).some(DB.isWorkingDone));
    if (!hasLoggedSet) {
      const action = await emptyTrainingFinishModal();
      if (action === 'discard') { DB.deleteSession(id); stopRest(); toast('Training verworfen'); navigate('/plans'); return; }
      if (action !== 'save') return;
    }
    if (DB.db().settings.askPlanDiff) {
      const diffs = DB.computeSessionPlanDiff(id);
      if (diffs.length) await planDiffModal(id, diffs);
    }
    DB.updateSession(id, { finishedAt: Date.now() });
    stopRest();
    toast('Training gespeichert 💪');
    navigate('/plans');
  };
  const reopenBtn = $('#reopenBtn', container);
  if (reopenBtn) reopenBtn.onclick = () => { DB.updateSession(id, { finishedAt: null }); renderTrain(container, id); };
}

// Nach dem Training: Änderungen (Pause/Sätze pro Übung, hinzugefügte/entfernte
// Übungen) einzeln auswählbar in den Trainingsplan übernehmen lassen.
function planDiffModal(sessionId, diffs) {
  return new Promise(resolve => {
    const s = DB.getSession(sessionId);
    const day = s ? DB.getDay(s.dayId) : null;
    const rows = diffs.map((d, i) => {
      let label = '';
      if (d.type === 'restChanged') label = `⏱ Pause bei <b>${esc(d.name)}</b>: ${d.oldVal}s → ${d.newVal}s`;
      else if (d.type === 'setsChanged') label = `🔢 Sätze bei <b>${esc(d.name)}</b>: ${d.oldVal} → ${d.newVal}`;
      else if (d.type === 'exerciseAdded') label = `➕ <b>${esc(d.name)}</b> zum Plan hinzufügen`;
      else if (d.type === 'exerciseRemoved') label = `➖ <b>${esc(d.name)}</b> aus dem Plan entfernen`;
      else if (d.type === 'orderChanged') label = `🔀 Reihenfolge der Übungen anpassen: ${d.names.map(n => esc(n)).join(' → ')}`;
      else if (d.type === 'groupingChanged') label = d.groupNames.length
        ? `🔗 Zirkel-Gruppierung anpassen: ${d.groupNames.map(g => g.map(esc).join(' + ')).join(', ')}`
        : `🔗 Zirkel-Gruppierung(en) auflösen`;
      return `<label class="diff-row"><input type="checkbox" data-diff="${i}" checked /><span>${label}</span></label>`;
    }).join('');
    const close = openModal({
      title: 'Anpassungen übernehmen?',
      body: `<p class="tiny muted" style="margin-top:0">Du hast während des Trainings Änderungen vorgenommen. Sollen diese auch für „${esc(day?.name || 'diesen Trainingstag')}" gelten?</p>
        <div class="diff-list">${rows}</div>`,
      footer: `<button class="btn ghost" data-skip>Nur diesmal</button><button class="btn primary" data-apply>Übernehmen</button>`,
      onMount: (m, c) => {
        $('[data-skip]', m).onclick = () => { c(); resolve(); };
        $('[data-apply]', m).onclick = () => {
          const selected = [];
          $$('[data-diff]', m).forEach(cb => { if (cb.checked) selected.push(diffs[parseInt(cb.dataset.diff)]); });
          if (selected.length) DB.applyPlanDiffs(sessionId, selected);
          c(); resolve();
        };
      },
    });
  });
}

// Ist der Eintrag an Index i der LETZTE einer zusammenhängenden Zirkel-Gruppe
// (oder gar nicht gruppiert)? Nur dann startet das Abhaken eines Satzes den
// Pausen-Timer - innerhalb eines Zirkels wird direkt zur nächsten Übung
// gewechselt, ohne Pause.
function isLastInGroup(entries, i) {
  const gid = entries[i].groupId;
  if (!gid) return true;
  const next = entries[i + 1];
  return !(next && next.groupId === gid);
}

function trainSelectCardHTML(entry, ei) {
  const isSel = trainSelected.has(ei);
  return `<div class="card tap select-card ${isSel ? 'sel' : ''}" data-tsel="${ei}">
    <div style="display:flex;align-items:center;gap:10px">
      <div class="select-check ${isSel ? 'on' : ''}">${isSel ? '✓' : ''}</div>
      <div class="grow"><b>${esc(entry.name)}</b></div>
    </div>
  </div>`;
}
function trainReorderCardHTML(entry, ei, total) {
  return `<div class="card">
    <div style="display:flex;align-items:center;gap:8px">
      <div class="grow"><b>${entry.groupId ? '🔗 ' : ''}${esc(entry.name)}</b></div>
      <span class="mv" data-tup="${ei}" style="padding:4px 8px;color:${ei === 0 ? 'var(--border)' : 'var(--text-dim2)'};pointer-events:${ei === 0 ? 'none' : 'auto'}">▲</span>
      <span class="mv" data-tdown="${ei}" style="padding:4px 8px;color:${ei === total - 1 ? 'var(--border)' : 'var(--text-dim2)'};pointer-events:${ei === total - 1 ? 'none' : 'auto'}">▼</span>
    </div>
  </div>`;
}

function renderEntries(container, id) {
  const s = DB.getSession(id);
  const wrap = $('#entries', container);
  wrap.innerHTML = '';
  // Zirkel-/Reihenfolge-Leiste liegt außerhalb von #entries (fixe Bottom-Bar) - bei
  // wiederholten renderEntries()-Aufrufen innerhalb desselben Modus (z.B. jeder
  // ▲/▼-Klick im Reihenfolge-Modus) sonst mehrfach angehängt statt ersetzt.
  $$('.select-bar', container).forEach(b => b.remove());

  if (trainMode === 'select') {
    s.entries.forEach((entry, ei) => { wrap.innerHTML += trainSelectCardHTML(entry, ei); });
    $$('[data-tsel]', wrap).forEach(n => n.onclick = () => {
      const idx = parseInt(n.dataset.tsel);
      trainSelected.has(idx) ? trainSelected.delete(idx) : trainSelected.add(idx);
      renderTrain(container, id);
    });
    const bar = el('div', { class: 'select-bar' });
    bar.innerHTML = `<button class="btn ghost" id="cancelTrainGroupBtn">Abbrechen</button>
      <button class="btn primary" id="confirmTrainGroupBtn" ${trainSelected.size < 2 ? 'disabled' : ''}>🔗 Gruppieren (${trainSelected.size})</button>`;
    container.append(bar);
    $('#cancelTrainGroupBtn', bar).onclick = () => { trainMode = null; trainSelected.clear(); renderTrain(container, id); };
    $('#confirmTrainGroupBtn', bar).onclick = () => {
      if (trainSelected.size < 2) return;
      const gid = DB.uid('grp');
      const orderedIdx = [...trainSelected];
      orderedIdx.forEach(idx => { if (s.entries[idx]) s.entries[idx].groupId = gid; });
      regroupByIndex(s.entries, orderedIdx);
      DB.save();
      toast('Zirkel erstellt');
      trainMode = null; trainSelected.clear();
      renderTrain(container, id);
    };
    return;
  }

  if (trainMode === 'reorder') {
    s.entries.forEach((entry, ei) => { wrap.innerHTML += trainReorderCardHTML(entry, ei, s.entries.length); });
    $$('[data-tup]', wrap).forEach(n => n.onclick = () => {
      reorderStep(s.entries, parseInt(n.dataset.tup), -1);
      DB.save(); renderEntries(container, id);
    });
    $$('[data-tdown]', wrap).forEach(n => n.onclick = () => {
      reorderStep(s.entries, parseInt(n.dataset.tdown), 1);
      DB.save(); renderEntries(container, id);
    });
    const bar = el('div', { class: 'select-bar' });
    bar.innerHTML = `<button class="btn primary block" id="doneTrainReorderBtn">Fertig</button>`;
    container.append(bar);
    $('#doneTrainReorderBtn', bar).onclick = () => { trainMode = null; renderTrain(container, id); };
    return;
  }

  let i = 0;
  while (i < s.entries.length) {
    const gid = s.entries[i].groupId;
    if (gid) {
      let j = i;
      while (j < s.entries.length && s.entries[j].groupId === gid) j++;
      const groupWrap = el('div', { class: 'superset-wrap' });
      const labelRow = el('div', { class: 'superset-label', style: 'display:flex;justify-content:space-between;align-items:center' });
      labelRow.innerHTML = `<span>🔗 Zirkel – keine Pause zwischen den Übungen</span><button class="btn ghost sm" data-tungroup="${gid}">Auflösen</button>`;
      groupWrap.append(labelRow);
      for (let k = i; k < j; k++) groupWrap.append(renderExerciseBlock(s, id, container, k));
      wrap.append(groupWrap);
      i = j;
    } else {
      wrap.append(renderExerciseBlock(s, id, container, i));
      i++;
    }
  }
  $$('[data-tungroup]', wrap).forEach(n => n.onclick = async () => {
    if (await confirmDialog('Zirkel auflösen?', { okText: 'Auflösen' })) {
      const gid = n.dataset.tungroup;
      s.entries.forEach(e => { if (e.groupId === gid) e.groupId = null; });
      DB.save(); renderEntries(container, id);
    }
  });
}

function renderExerciseBlock(s, id, container, ei) {
  const entry = s.entries[ei];
  // "letztes Mal" nur vom selben Ort (Geräte sind zwischen Gyms nicht vergleichbar).
  // Werte erscheinen als Platzhalter in den Feldern – daher keine separate Zeile mehr.
  const last = DB.lastEntryFor(entry.exerciseId, id, s.locationId);
  const ex = DB.getExercise(entry.exerciseId);
  const badges = tagBadgesHTML(ex);
  // Dauerhafte Geräte-/Einstellungs-Notiz, je Übung UND Ort (z.B. Sitzhöhe) -
  // nicht ans einzelne Training gebunden, bleibt für nächstes Mal erhalten.
  const noteRec = DB.getExerciseNote(entry.exerciseId, s.locationId);
  const noteHTML = noteRec ? `<div class="ex-note">📝 ${esc(noteRec.text)}</div>` : '';
  const block = el('div', { class: 'ex-block' });
  block.innerHTML = `
    <div class="ex-head">
      <div class="ex-name">${esc(entry.name)}</div>
      <button class="btn ghost sm" data-menu>⋮</button>
    </div>
    ${(badges || noteHTML) ? `<div class="ex-meta">${badges}${noteHTML}</div>` : ''}
    <div class="ex-body">
      <div class="set-head"><span>#</span><span>Gewicht</span><span>Wdh.</span><span>✓</span></div>
      <div class="sets"></div>
    </div>`;

  const setsEl = $('.sets', block);
  entry.sets.forEach((set, si) => {
    const row = el('div', { class: 'set-row' + (set.done ? ' done' : '') });
    row.innerHTML = `
      <div class="setno">${si + 1}</div>
      <input type="number" inputmode="decimal" step="0.5" placeholder="${last?.entry.sets[si] ? fmtWeight(DB.num(last.entry.sets[si].weight)) : (entry.unit || 'kg')}" value="${set.weight === '' ? '' : esc(set.weight)}" data-w />
      <input type="number" inputmode="numeric" placeholder="${last?.entry.sets[si] ? DB.num(last.entry.sets[si].reps) : (entry.targetReps || '')}" value="${set.reps === '' ? '' : esc(set.reps)}" data-r />
      <button class="set-check ${set.done ? 'on' : ''}" data-check>✓</button>`;
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
      if (set.done && isLastInGroup(s.entries, ei)) startRest(entry.restSec);
    };
    setsEl.append(row);
  });

  $('[data-menu]', block).onclick = () => exerciseMenuModal(entry, !!noteRec, {
    onAddSet: () => {
      const prev = entry.sets[entry.sets.length - 1];
      entry.sets.push({ weight: prev ? prev.weight : '', reps: prev ? prev.reps : '', done: false });
      DB.save(); renderEntries(container, id);
    },
    onRemoveSet: async () => {
      if (!entry.sets.length) return;
      const last = entry.sets[entry.sets.length - 1];
      if (DB.hasData(last) && !(await confirmDialog('Bereits eingetragenen Satz entfernen?', { danger: true, okText: 'Entfernen' }))) return;
      entry.sets.pop(); DB.save(); renderEntries(container, id);
    },
    onRest: () => editRestModal(entry, () => renderEntries(container, id)),
    onNote: () => editExerciseNoteModal(entry.exerciseId, s.locationId, () => renderEntries(container, id)),
    onReplace: () => pickExerciseModal(exId => {
      const newEx = DB.getExercise(exId);
      // Ziel-Satzanzahl beibehalten (nicht auf 1 zurücksetzen) - nur die eingetragenen
      // Gewichte/Wdh. sind bei einer anderen Übung ohnehin nicht mehr vergleichbar.
      const setCount = entry.sets.length || DB.db().settings.defaultSets;
      entry.exerciseId = exId;
      entry.name = newEx ? newEx.name : 'Übung';
      entry.unit = newEx?.unit || 'kg';
      entry.sets = Array.from({ length: setCount }, () => ({ weight: '', reps: '', done: false }));
      DB.save(); renderEntries(container, id);
    }, s.entries.filter((e2, i2) => i2 !== ei).map(e2 => e2.exerciseId)),
    onRemoveExercise: async () => {
      if (await confirmDialog('Übung aus diesem Training entfernen?', { danger: true, okText: 'Entfernen' })) {
        s.entries.splice(ei, 1); DB.save(); renderEntries(container, id);
      }
    },
  });
  return block;
}

// Kompaktes Aktions-Menü für eine Übung im laufenden Training (ersetzt die
// vorherigen Einzel-Buttons für Pause/Löschen -> schlankerer Übungskopf).
function exerciseMenuModal(entry, hasNote, actions) {
  openModal({
    title: entry.name,
    body: `<div class="sheet">
      <button class="sheet-btn" data-act="rest">⏱ Pause ändern <span class="tiny muted">(aktuell ${entry.restSec}s)</span></button>
      <div class="sheet-btn split">
        <button class="split-half" data-act="rmset" aria-label="Letzten Satz entfernen">−</button>
        <span class="split-label">Satz <span class="tiny muted">(${entry.sets.length})</span></span>
        <button class="split-half" data-act="addset" aria-label="Satz hinzufügen">＋</button>
      </div>
      <button class="sheet-btn" data-act="replace">🔄 Übung ersetzen</button>
      <button class="sheet-btn" data-act="note">📝 ${hasNote ? 'Notiz bearbeiten' : 'Notiz hinzufügen'}</button>
      <button class="sheet-btn danger" data-act="remove">🗑️ Übung aus Training entfernen</button>
    </div>`,
    footer: `<button class="btn ghost block" data-x>Abbrechen</button>`,
    onMount: (m, close) => {
      $('[data-x]', m).onclick = close;
      $('[data-act="rest"]', m).onclick = () => { close(); actions.onRest(); };
      $('[data-act="addset"]', m).onclick = () => { close(); actions.onAddSet(); };
      $('[data-act="rmset"]', m).onclick = () => { close(); actions.onRemoveSet(); };
      $('[data-act="replace"]', m).onclick = () => { close(); actions.onReplace(); };
      $('[data-act="note"]', m).onclick = () => { close(); actions.onNote(); };
      $('[data-act="remove"]', m).onclick = () => { close(); actions.onRemoveExercise(); };
    },
  });
}

// Dauerhafte Geräte-/Einstellungs-Notiz zu einer Übung an einem bestimmten Ort
// (z.B. Sitzhöhe, Widerstand) - bleibt für alle künftigen Trainings erhalten,
// getrennt je Ort (Geräte-Einstellungen sind zwischen Gyms nicht vergleichbar).
function editExerciseNoteModal(exerciseId, locationId, after) {
  const loc = DB.getLocation(locationId);
  const existing = DB.getExerciseNote(exerciseId, locationId);
  openModal({
    title: 'Geräte-Notiz',
    body: `<label class="field"><span>Notiz${loc ? ` für ${esc(loc.name)}` : ''} – bleibt dauerhaft gespeichert</span>
      <textarea id="f-exnote" placeholder="z.B. Sitzhöhe 4, Griffbreite außen …">${esc(existing?.text || '')}</textarea></label>`,
    footer: `${existing ? '<button class="btn danger" data-del>Entfernen</button>' : ''}<button class="btn ghost" data-x>Abbrechen</button><button class="btn primary" data-ok>Speichern</button>`,
    onMount: (m, close) => {
      $('[data-x]', m).onclick = close;
      $('[data-ok]', m).onclick = () => { DB.setExerciseNote(exerciseId, locationId, $('#f-exnote', m).value); close(); after && after(); };
      const del = $('[data-del]', m);
      if (del) del.onclick = () => { DB.setExerciseNote(exerciseId, locationId, ''); close(); after && after(); };
    },
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
  acquireWakeLock();
  restTimer.iv = setInterval(() => {
    restTimer.remaining--;
    if (restTimer.remaining <= 0) { beep(); notifyRestEnd(); stopRest(); toast('Pause vorbei ▶'); }
    else updateRestBar();
  }, 1000);
}

// Browser-Benachrichtigung am Pausenende (zusätzlich zu Ton/Vibration) - nur
// wenn eingeschaltet, Berechtigung erteilt ist und die App gerade NICHT im
// Vordergrund/Fokus ist (sonst reicht der Ton, eine Notification wäre doppelt).
function notifyRestEnd() {
  const s = DB.db().settings;
  if (!s.restNotifications) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible' && document.hasFocus()) return;
  const fire = reg => reg.showNotification('Pause vorbei ▶', { body: 'Weiter geht\'s mit dem nächsten Satz.', icon: './icons/icon-192.png', tag: 'rest-end' });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(fire).catch(() => { try { new Notification('Pause vorbei ▶'); } catch (e) { /* ignore */ } });
  } else {
    try { new Notification('Pause vorbei ▶'); } catch (e) { /* ignore */ }
  }
}
function stopRest() {
  if (restTimer?.iv) clearInterval(restTimer.iv);
  restTimer = null;
  const bar = document.getElementById('restBar');
  if (bar) bar.classList.add('hidden');
  releaseWakeLock();
}

// ---------- Wake Lock ----------
// Hält den Bildschirm während des Pausen-Timers wach (sonst schaltet sich das
// Handy mitten in der Pause ab). Nicht unterstützt: stiller Fallback, App
// funktioniert trotzdem normal weiter (nur der Screen schläft ggf. ein).
let wakeLock = null;
async function acquireWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (e) { /* z.B. Tab im Hintergrund oder vom Browser abgelehnt */ }
}
function releaseWakeLock() {
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}
// Wake Lock wird vom Browser automatisch freigegeben, wenn der Tab in den
// Hintergrund geht - beim Zurückkehren erneut anfordern, falls der Timer noch läuft.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && restTimer && !wakeLock) acquireWakeLock();
});
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
    if (ok) { DB.deleteSession(id); stopRest(); navigate('/plans'); }
  });
}

// Beim Beenden ohne einen einzigen abgehakten Satz: nachfragen statt stillschweigend
// ein leeres Training abzuspeichern (z.B. versehentlich gestartet und direkt beendet).
function emptyTrainingFinishModal() {
  return new Promise(resolve => {
    openModal({
      title: 'Keine Sätze abgehakt',
      body: `<p style="margin:0">Du hast in diesem Training noch keinen einzigen Satz abgehakt. Trotzdem als abgeschlossen speichern, oder das Training verwerfen?</p>`,
      footer: `<button class="btn danger" data-discard>Verwerfen</button><button class="btn primary" data-save>Speichern</button>`,
      onMount: (m, close) => {
        $('[data-discard]', m).onclick = () => { close(); resolve('discard'); };
        $('[data-save]', m).onclick = () => { close(); resolve('save'); };
      },
    });
  });
}

// ============================================================
//  Ansicht: Kalender (Habit-Tracker)
// ============================================================
let calState = null;
let calRecentExpanded = false;
route('/calendar', () => {
  setChrome({ title: 'Kalender', back: false });
  const now = new Date();
  if (!calState) calState = { y: now.getFullYear(), m: now.getMonth() };
  calRecentExpanded = false;
  drawCalendar();
});

function drawCalendar() {
  const { y, m } = calState;
  const byDate = DB.sessionsByDate();
  const first = new Date(y, m, 1);
  const sundayFirst = DB.db().settings.weekStart === 'sun';
  const startDow = sundayFirst ? first.getDay() : (first.getDay() + 6) % 7; // Mo=0 bzw. So=0, je nach Einstellung
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayKey = DB.todayISO();

  // Kennzahlen
  const monthCount = Object.keys(byDate).filter(k => { const d = parseISO(k); return d.getFullYear() === y && d.getMonth() === m; }).reduce((a, k) => a + byDate[k].length, 0);
  const streak = currentStreak(byDate);
  const totalSessions = DB.sessions().filter(s => s.finishedAt).length;

  let cells = '';
  const dows = sundayFirst ? ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] : ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
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
    <div class="section-title">Letzte Trainings</div>
    <div id="recentList"></div>
  `;
  $('[data-prev]', appEl).onclick = () => { calState.m--; if (calState.m < 0) { calState.m = 11; calState.y--; } drawCalendar(); };
  $('[data-next]', appEl).onclick = () => { calState.m++; if (calState.m > 11) { calState.m = 0; calState.y++; } drawCalendar(); };
  $$('[data-date]', appEl).forEach(n => n.onclick = () => {
    const evs = byDate[n.dataset.date]; if (!evs || !evs.length) return;
    dayDetailModal(n.dataset.date, evs);
  });

  const RECENT_COLLAPSED_COUNT = 3;
  const allFinished = DB.sessions().filter(s => s.finishedAt);
  const recent = calRecentExpanded ? allFinished : allFinished.slice(0, RECENT_COLLAPSED_COUNT);
  const recentList = $('#recentList', appEl);
  recentList.innerHTML = allFinished.length ? recent.map(s => sessionRow(s)).join('')
    : `<div class="tiny muted center" style="padding:8px">Noch keine abgeschlossenen Trainings.</div>`;
  $$('[data-session]', recentList).forEach(n => n.onclick = () => navigate('/train/' + n.dataset.session));
  if (allFinished.length > RECENT_COLLAPSED_COUNT) {
    const moreBtn = el('button', {
      class: 'btn ghost block', style: 'margin-top:2px',
      onclick: () => { calRecentExpanded = !calRecentExpanded; drawCalendar(); },
    }, calRecentExpanded ? '▲ Weniger anzeigen' : `▼ Mehr anzeigen (${allFinished.length - RECENT_COLLAPSED_COUNT})`);
    appEl.append(moreBtn);
  }
}

function sessionRow(s) {
  const totalSets = s.entries.reduce((a, e) => a + e.sets.filter(DB.isWorkingDone).length, 0);
  const vol = s.entries.reduce((a, e) => a + e.sets.filter(DB.isWorkingDone).reduce((x, st) => x + DB.num(st.weight) * DB.num(st.reps), 0), 0);
  const duration = s.startedAt && s.finishedAt ? fmtDuration(s.finishedAt - s.startedAt) : '';
  return `<div class="list-row" data-session="${s.id}">
    <div class="chip" style="background:${esc(s.color)}22;color:${esc(s.color)}">${esc(s.emoji || '💪')}</div>
    <div class="grow"><div class="r-title">${esc(s.dayName || 'Training')}</div>
      <div class="r-sub">${fmtDate(s.date)}${duration ? ' · ' + duration : ''} · ${totalSets} Sätze · ${fmtWeight(vol)} kg Vol.</div></div>
    <span class="arrow">›</span></div>`;
}

function fmtDuration(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} Min.`;
  const h = Math.floor(min / 60), m = min % 60;
  return `${h} Std. ${m} Min.`;
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
let statsPeriod = 7; // 7 | 30 | null (Alle) - EIN Umschalter für Gesamt-Übersicht + Muskelgruppen-Sätze
// Auf-/zugeklappt-Zustand der Statistik-Abschnitte - modulglobal, damit ein Klick auf
// den Zeitraum-Umschalter (voller render()) den Zustand nicht zurücksetzt.
let statsAccOpen = { overview: true, topExercises: true, volume: false, exercises: true };
route('/stats', () => {
  setChrome({ title: 'Statistik', back: false });
  const locs = DB.locations();
  let html = locationBarHTML();
  if (!locs.length) {
    html += `<div class="empty"><div class="big">📈</div><div>Noch keine Orte/Trainingsdaten.</div></div>`;
    appEl.innerHTML = html; return;
  }
  const active = DB.getActiveLocation();
  const list = DB.exercisesTrainedAtLocation(active.id);
  html += `<p class="tiny muted">Statistik für <b>${esc(active.emoji)} ${esc(active.name)}</b> – je Ort getrennt, da Geräte zwischen Gyms nicht vergleichbar sind.</p>`;

  if (!list.length) {
    // Statistik ist bewusst je Ort getrennt (Geräte zwischen Gyms nicht vergleichbar) - das
    // kann verwirren, wenn Trainings an einem ANDEREN Ort liegen als dem gerade aktiven.
    // Deshalb hier gezielt darauf hinweisen, statt nur "leer" zu zeigen.
    const otherLocsWithData = DB.locations().filter(l => l.id !== active.id && DB.exercisesTrainedAtLocation(l.id).length);
    html += `<div class="empty"><div class="big">📈</div><div>Noch keine Trainingsdaten für „${esc(active.name)}".</div>
      <div class="tiny" style="margin:8px 0 0">Zeichne an diesem Ort ein paar Trainings auf, oder aktiviere die Beispieldaten (Einstellungen → Daten &amp; Backup).</div>
      ${otherLocsWithData.length ? `<div class="tiny" style="margin:10px 0 0">Hinweis: An ${otherLocsWithData.map(l => `${esc(l.emoji)} ${esc(l.name)}`).join(', ')} liegen bereits aufgezeichnete Trainings – oben über die Orts-Reiter dorthin wechseln.</div>` : ''}
      </div>`;
    appEl.innerHTML = html;
    wireLocationBar(appEl);
    return;
  }

  // Ein gemeinsamer Zeitraum-Umschalter für Gesamt-Übersicht + Muskelgruppen-Sätze,
  // damit beide Sektionen konsistent zum selben Zeitraum gehören (statt zwei getrennte,
  // evtl. unterschiedlich eingestellte Filter zu haben).
  const periodBar = `<div class="btn-row" style="margin-bottom:12px">
    <button class="btn ${statsPeriod === 7 ? 'primary' : 'ghost'} sm" data-period="7">7 Tage</button>
    <button class="btn ${statsPeriod === 30 ? 'primary' : 'ghost'} sm" data-period="30">30 Tage</button>
    <button class="btn ${!statsPeriod ? 'primary' : 'ghost'} sm" data-period="0">Alle</button>
  </div>`;

  // ---------- Gesamt-Übersicht (übungsübergreifend) ----------
  const totalFinished = DB.sessions().filter(s => s.finishedAt && s.locationId === active.id).length;
  const periodCount = DB.sessionCountInPeriod(active.id, statsPeriod);
  const overallHist = DB.overallVolumeHistory(active.id, 26);
  const overallChart = lineChart(overallHist.map(h => ({ y: h.volume, label: fmtShort(h.date) })), '');
  const topEx = DB.topExercisesByFrequency(active.id, statsPeriod, 5);
  html += `<details class="stats-acc" data-acc="overview" ${statsAccOpen.overview ? 'open' : ''}><summary>Gesamt-Übersicht</summary>
    ${periodBar}
    <div class="streak-row">
      <div class="stat-tile"><div class="v">${totalFinished}</div><div class="l">Trainings gesamt</div></div>
      <div class="stat-tile"><div class="v">${periodCount}</div><div class="l">Einheiten (${statsPeriod ? statsPeriod + ' Tage' : 'alle'})</div></div>
    </div>
    <div class="chart-wrap"><div class="c-title"><span>Trainingsvolumen je Einheit (alle Übungen, letzte ${overallHist.length})</span></div>${overallChart}</div>
  </details>`;

  html += `<details class="stats-acc" data-acc="topExercises" ${statsAccOpen.topExercises ? 'open' : ''}><summary>Meisttrainierte Übungen</summary>
    <div class="card">
      <div class="tiny muted" style="margin-bottom:6px">${statsPeriod ? statsPeriod + ' Tage' : 'Alle Zeit'}</div>
      ${topEx.length ? topEx.map(t => {
          const stillExists = !!DB.getExercise(t.exerciseId);
          return `<div class="list-row ${stillExists ? '' : 'disabled'}" ${stillExists ? `data-ex="${t.exerciseId}"` : ''}>
          <div class="grow"><div class="r-title">${esc(t.name)}</div></div>
          <div class="tiny muted">${t.count}×</div></div>`;
        }).join('')
        : `<div class="tiny muted center" style="padding:8px">Keine Daten in diesem Zeitraum.</div>`}
    </div>
  </details>`;

  const volStats = DB.muscleVolumeStats(active.id, statsPeriod);
  const setsTrend = DB.weeklySetsTrend(active.id, 10);
  const setsTrendChart = lineChart(setsTrend.map(b => ({ y: b.sets, label: fmtTs(b.weekEndTs) })), '');
  html += `<details class="stats-acc" data-acc="volume" ${statsAccOpen.volume ? 'open' : ''}><summary>Muskelgruppen-Sätze</summary>
    <div class="card">
      <p class="tiny muted" style="margin-top:0">Zählt abgehakte Sätze je Muskelgruppe (nicht Gewicht) – aussagekräftiger für den Trainingsreiz.</p>
      ${volumeBarsHTML(volStats)}
    </div>
    <div class="chart-wrap"><div class="c-title"><span>Volumen-Trend (Sätze gesamt je Woche, letzte ${setsTrend.length})</span></div>${setsTrendChart}</div>
  </details>`;

  html += `<details class="stats-acc" data-acc="exercises" ${statsAccOpen.exercises ? 'open' : ''}><summary>Übungen</summary>`;
  list.forEach(e => {
    const pr = DB.exercisePRs(e.id, active.id);
    const unit = e.unit || 'kg';
    html += `<div class="list-row" data-ex="${e.id}">
      <div class="grow"><div class="r-title">${esc(e.name)} ${locBadge(active)}</div>
        <div class="r-sub">${pr.sessionsCount}× · Bestes 1RM ${fmtWeight(pr.best1rm)} ${esc(unit)} · Max ${fmtWeight(pr.maxWeight)} ${esc(unit)}</div></div>
      <span class="arrow">›</span></div>`;
  });
  html += `</details>`;

  appEl.innerHTML = html;
  wireLocationBar(appEl);
  $$('[data-ex]', appEl).forEach(n => n.onclick = () => navigate('/stats/' + n.dataset.ex));
  $$('[data-period]', appEl).forEach(n => n.onclick = () => { statsPeriod = parseInt(n.dataset.period) || null; render(); });
  $$('.stats-acc', appEl).forEach(d => d.addEventListener('toggle', () => { statsAccOpen[d.dataset.acc] = d.open; }));
});

function volumeBarsHTML(stats) {
  if (!stats.length) return `<div class="tiny muted center" style="padding:12px">Keine Trainingsdaten in diesem Zeitraum.</div>`;
  const max = Math.max(...stats.map(s => s.sets));
  return stats.map(s => `<div class="vol-row">
    <div class="vol-label">${esc(s.muscle)}</div>
    <div class="vol-bar-track"><div class="vol-bar-fill" style="width:${max ? Math.round(s.sets / max * 100) : 0}%"></div></div>
    <div class="vol-val">${s.sets}×</div>
  </div>`).join('');
}

route('/stats/:id', ({ id }) => {
  const ex = DB.getExercise(id);
  if (!ex) return navigate('/stats');
  const active = DB.getActiveLocation();
  const locId = active ? active.id : null;
  setChrome({ title: ex.name, back: true, actions: [actionBtn('✏️', () => editExerciseModal(id))] });
  const hist = DB.exerciseHistory(id, locId);
  const pr = DB.exercisePRs(id, locId);
  const locLine = active ? `<div class="tiny muted" style="margin:-2px 0 12px">${esc(ex.name)} · ${esc(active.emoji)} ${esc(active.name)}</div>` : '';

  if (!hist.length) {
    appEl.innerHTML = `${locLine}<div class="empty"><div class="big">📈</div><div>Noch keine aufgezeichneten Sätze für „${esc(ex.name)}"${active ? ' an „' + esc(active.name) + '"' : ''}.</div></div>`;
    return;
  }

  const unit = ex.unit || 'kg';
  const tiles = `
    <div class="streak-row">
      <div class="stat-tile"><div class="v">${fmtWeight(pr.best1rm)}</div><div class="l">Bestes e1RM (${esc(unit)})</div></div>
      <div class="stat-tile"><div class="v">${fmtWeight(pr.maxWeight)}</div><div class="l">Max Gewicht (${esc(unit)})</div></div>
    </div>
    <div class="streak-row">
      <div class="stat-tile"><div class="v">${fmtWeight(pr.maxVolume)}</div><div class="l">Max Volumen</div></div>
      <div class="stat-tile"><div class="v">${pr.sessionsCount}</div><div class="l">Einheiten</div></div>
    </div>`;

  const e1rmChart = lineChart(hist.map(h => ({ y: h.est1rm, label: fmtShort(h.date) })), unit);
  const volChart = lineChart(hist.map(h => ({ y: h.volume, label: fmtShort(h.date) })), '');
  const wChart = lineChart(hist.map(h => ({ y: h.maxWeight, label: fmtShort(h.date) })), unit);

  const rows = hist.slice().reverse().map(h => `<tr>
    <td>${fmtShort(h.date)}</td>
    <td>${h.setCount}</td>
    <td class="num">${fmtWeight(h.maxWeight)}</td>
    <td class="num">${h.bestSet ? fmtWeight(h.bestSet.weight) + '×' + h.bestSet.reps : '–'}</td>
    <td class="num">${fmtWeight(h.est1rm)}</td>
    <td class="num">${fmtWeight(h.volume)}</td>
  </tr>`).join('');

  appEl.innerHTML = `
    ${locLine}
    ${tiles}
    <div class="chart-wrap"><div class="c-title"><span>Geschätztes 1RM (Epley)</span><span>${fmtWeight(pr.best1rm)} ${esc(unit)}</span></div>${e1rmChart}</div>
    <div class="chart-wrap"><div class="c-title"><span>Max. Gewicht je Einheit</span><span>${fmtWeight(pr.maxWeight)} ${esc(unit)}</span></div>${wChart}</div>
    <div class="chart-wrap"><div class="c-title"><span>Volumen (${esc(unit)} gesamt)</span><span>${fmtWeight(pr.maxVolume)}</span></div>${volChart}</div>
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
let chartIdCounter = 0;
function lineChart(points, unit = '') {
  const W = 320, H = 140, pad = { l: 30, r: 10, t: 12, b: 20 };
  const pts = points.filter(p => p.y > 0);
  if (pts.length < 2) return `<div class="tiny muted center" style="padding:24px">Noch zu wenig Daten für einen Trend (mind. 2 Einheiten).</div>`;
  const gradId = 'chart-grad-' + (chartIdCounter++); // eindeutig je Chart-Instanz - mehrere Charts auf einer Seite (z.B. /stats/:id) hätten sonst dieselbe SVG-id "grad"
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
    <defs><linearGradient id="${gradId}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity="0.5"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    ${gridY}
    <polygon class="chart-area" style="fill:url(#${gradId})" points="${area}" />
    <polyline class="chart-line" points="${line}" />
    ${dots}
    <text class="chart-lbl" x="${pad.l}" y="${H - 5}">${esc(first)}</text>
    <text class="chart-lbl" x="${W - pad.r}" y="${H - 5}" text-anchor="end">${esc(lastl)}</text>
  </svg>`;
}

function fmtTs(ms) {
  const d = new Date(ms);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

// ---------- Papierkorb (gelöschte Übungen/Trainings, wiederherstellbar) ----------
function openTrashModal() {
  let tab = 'ex';
  openModal({
    title: 'Papierkorb',
    body: `<div class="btn-row" id="trashTabs" style="margin-bottom:10px">
        <button class="btn sm" data-tab="ex">Übungen</button>
        <button class="btn sm" data-tab="ses">Trainings</button>
      </div>
      <div id="trashList"></div>`,
    footer: `<button class="btn danger" data-empty>Papierkorb leeren</button><button class="btn ghost" data-x>Schließen</button>`,
    onMount: (m, close) => {
      const listEl = $('#trashList', m);
      function draw() {
        $$('[data-tab]', m).forEach(b => b.classList.toggle('primary', b.dataset.tab === tab));
        if (tab === 'ex') {
          const items = DB.trashedExercises();
          listEl.innerHTML = items.length ? items.map(e => `<div class="list-row">
              <div class="grow"><div class="r-title">${esc(e.name)}</div><div class="r-sub">gelöscht am ${fmtTs(e.deletedAt)}</div></div>
              <button class="btn ghost sm" data-restore="${e.id}" title="Wiederherstellen">↩️</button>
              <button class="btn danger sm" data-purge="${e.id}" title="Endgültig löschen">🗑️</button>
            </div>`).join('') : `<div class="tiny muted center" style="padding:12px">Papierkorb leer.</div>`;
        } else {
          const items = DB.trashedSessions();
          listEl.innerHTML = items.length ? items.map(s => `<div class="list-row">
              <div class="grow"><div class="r-title">${esc(s.dayName || 'Training')}</div><div class="r-sub">${fmtDate(s.date)} · gelöscht am ${fmtTs(s.deletedAt)}</div></div>
              <button class="btn ghost sm" data-restoreses="${s.id}" title="Wiederherstellen">↩️</button>
              <button class="btn danger sm" data-purgeses="${s.id}" title="Endgültig löschen">🗑️</button>
            </div>`).join('') : `<div class="tiny muted center" style="padding:12px">Papierkorb leer.</div>`;
        }
        $$('[data-restore]', listEl).forEach(b => b.onclick = () => { DB.restoreExercise(b.dataset.restore); toast('Wiederhergestellt'); draw(); render(); });
        $$('[data-purge]', listEl).forEach(b => b.onclick = async () => {
          if (await confirmDialog('Endgültig löschen?', { danger: true, okText: 'Löschen' })) { DB.purgeTrashedExercise(b.dataset.purge); draw(); render(); }
        });
        $$('[data-restoreses]', listEl).forEach(b => b.onclick = () => { DB.restoreSession(b.dataset.restoreses); toast('Wiederhergestellt'); draw(); render(); });
        $$('[data-purgeses]', listEl).forEach(b => b.onclick = async () => {
          if (await confirmDialog('Endgültig löschen?', { danger: true, okText: 'Löschen' })) { DB.purgeTrashedSession(b.dataset.purgeses); draw(); render(); }
        });
      }
      $$('[data-tab]', m).forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
      $('[data-empty]', m).onclick = async () => {
        if (await confirmDialog('Papierkorb komplett leeren? Das kann nicht rückgängig gemacht werden.', { danger: true, okText: 'Leeren' })) { DB.emptyTrash(); draw(); render(); }
      };
      $('[data-x]', m).onclick = close;
      draw();
    },
  });
}

// Eigener 3-Wege-Dialog statt confirmDialog (dessen "Abbrechen" hier fälschlich
// "zusammenführen" bedeutet hätte) - "Abbrechen" bricht den Import jetzt wirklich
// ab (resolve null), statt implizit eine der beiden Import-Varianten auszulösen.
function pickImportModeModal() {
  return new Promise(resolve => {
    const close = openModal({
      title: 'Backup importieren',
      body: `<p class="tiny muted" style="margin-top:0">Wie soll das Backup übernommen werden?</p>`,
      footer: `<button class="btn ghost" data-x>Abbrechen</button><button class="btn" data-merge>Zusammenführen</button><button class="btn danger" data-replace>Ersetzen</button>`,
      onMount: (m, c) => {
        $('[data-x]', m).onclick = () => { c(); resolve(null); };
        $('[data-merge]', m).onclick = () => { c(); resolve('merge'); };
        $('[data-replace]', m).onclick = () => { c(); resolve('replace'); };
      },
    });
  });
}

// ============================================================
//  Ansicht: Einstellungen / Backup
// ============================================================
route('/settings', () => {
  setChrome({ title: 'Einstellungen', back: false });
  const s = DB.db().settings;
  const stats = { ex: DB.exercises().length, loc: DB.locations().length, plans: DB.db().plans.length, days: DB.db().days.length, ses: DB.sessions().length };
  const trashCount = DB.trashedExercises().length + DB.trashedSessions().length;
  const activeLoc = DB.getActiveLocation();

  appEl.innerHTML = `
    <div class="section-title">Erscheinungsbild</div>
    <div class="card">
      <label class="field" style="margin:0"><span>Theme</span></label>
      <div class="theme-pick" id="s-theme-pick">
        ${THEMES.map(t => `<button type="button" data-theme="${t.id}" class="${t.id === s.theme ? 'sel' : ''}">${t.emoji} ${t.label}</button>`).join('')}
      </div>
      <label class="field" style="margin:14px 0 0"><span>Akzentfarbe</span></label>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:4px">
        <div class="color-pick" id="s-accent-pick" style="margin:0">
          ${COLORS.map(c => `<button type="button" data-c="${c}" style="background:${c}" class="${c === s.accentColor ? 'sel' : ''}"></button>`).join('')}
        </div>
        <input id="s-accent-custom" type="color" value="${esc(s.accentColor)}" title="Eigene Farbe wählen" class="color-input" />
      </div>
      <div class="row2" style="margin-top:14px">
        <label class="field"><span>Schriftgröße</span>
          <select id="s-fontsize">
            <option value="small" ${s.fontSize === 'small' ? 'selected' : ''}>Klein</option>
            <option value="medium" ${s.fontSize === 'medium' ? 'selected' : ''}>Mittel</option>
            <option value="large" ${s.fontSize === 'large' ? 'selected' : ''}>Groß</option>
          </select></label>
        <label class="field"><span>Abstände</span>
          <select id="s-density">
            <option value="compact" ${s.density === 'compact' ? 'selected' : ''}>Kompakt</option>
            <option value="normal" ${s.density === 'normal' ? 'selected' : ''}>Normal</option>
            <option value="spacious" ${s.density === 'spacious' ? 'selected' : ''}>Geräumig</option>
          </select></label>
      </div>
      <div class="row2" style="margin-top:8px">
        <label class="field"><span>Eckenradius</span>
          <select id="s-corner">
            <option value="sharp" ${s.cornerStyle === 'sharp' ? 'selected' : ''}>Eckig</option>
            <option value="normal" ${s.cornerStyle === 'normal' ? 'selected' : ''}>Normal</option>
            <option value="round" ${s.cornerStyle === 'round' ? 'selected' : ''}>Rund</option>
          </select></label>
        <label class="field" style="display:flex;align-items:flex-end;gap:8px;padding-bottom:9px">
          <input id="s-reduced" type="checkbox" ${s.reducedMotion ? 'checked' : ''} style="width:auto" />
          <span style="margin:0">Animationen reduzieren</span></label>
      </div>
      <hr class="sep" />
      <label class="field" style="margin:0;display:flex;align-items:center;gap:10px">
        <input id="s-tagcolors" type="checkbox" ${s.tagColors ? 'checked' : ''} style="width:auto" />
        <span style="margin:0">Farbige Muskel-/Geräte-Labels</span></label>
      <p class="tiny muted" style="margin:8px 0 14px">In Bibliothek und Training. Ausgeschaltet erscheinen alle Labels neutral grau (die Farben unten wirken sich dann nicht aus).</p>
      <label class="field" style="margin:0"><span>Muskelgruppen-Farbe</span></label>
      <div class="color-pick" id="s-musclecolor-pick">${COLORS.map(c => `<button type="button" data-c="${c}" style="background:${c}" class="${c === s.muscleColor ? 'sel' : ''}"></button>`).join('')}</div>
      <label class="field" style="margin:14px 0 0"><span>Geräte-Farbe</span></label>
      <div class="color-pick" id="s-equipcolor-pick">${COLORS.map(c => `<button type="button" data-c="${c}" style="background:${c}" class="${c === s.equipColor ? 'sel' : ''}"></button>`).join('')}</div>
    </div>

    <div class="section-title">Training</div>
    <div class="card">
      <p class="tiny muted" style="margin-top:0">Standardwerte gelten für neu angelegte Übungen im Trainingstag und für während des Trainings hinzugefügte Übungen.</p>
      <div class="row3">
        <label class="field"><span>Standard-Sätze</span><input id="s-defsets" type="number" min="1" value="${s.defaultSets}" /></label>
        <label class="field"><span>Standard-Wdh.</span><input id="s-defreps" type="number" min="1" value="${s.defaultReps}" /></label>
        <label class="field"><span>Standard-Pause (s)</span><input id="s-rest" type="number" min="0" step="5" value="${s.defaultRestSec}" /></label>
      </div>
      <label class="field" style="margin:12px 0 0;display:flex;align-items:center;gap:10px">
        <input id="s-sound" type="checkbox" ${s.soundOnRestEnd ? 'checked' : ''} style="width:auto" />
        <span style="margin:0">Ton/Vibration am Pausenende</span></label>
      <label class="field" style="margin:12px 0 0;display:flex;align-items:center;gap:10px">
        <input id="s-notif" type="checkbox" ${s.restNotifications ? 'checked' : ''} style="width:auto" />
        <span style="margin:0">Browser-Benachrichtigung am Pausenende</span></label>
      <label class="field" style="margin:12px 0 0;display:flex;align-items:center;gap:10px">
        <input id="s-diff" type="checkbox" ${s.askPlanDiff ? 'checked' : ''} style="width:auto" />
        <span style="margin:0">Nach dem Training nach Planänderungen fragen</span></label>
    </div>

    <div class="section-title">Kalender & Verhalten</div>
    <div class="card">
      <label class="field" style="margin:0"><span>Wochenstart im Kalender</span>
        <select id="s-weekstart">
          <option value="mon" ${s.weekStart === 'mon' ? 'selected' : ''}>Montag</option>
          <option value="sun" ${s.weekStart === 'sun' ? 'selected' : ''}>Sonntag</option>
        </select></label>
    </div>

    <div class="section-title">Daten & Sicherung</div>
    <div class="card">
      <div class="tiny muted" style="font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Backup</div>
      <p class="tiny muted" style="margin-top:0">Alle Daten liegen <b>lokal auf diesem Gerät</b> (im Browser). Es gibt keinen Server. Erstelle regelmäßig ein Backup!</p>
      <div class="tiny muted">${stats.loc} Orte · ${stats.plans} Pläne · ${stats.days} Trainingstage · ${stats.ex} Übungen · ${stats.ses} Einheiten</div>
      <label class="field" style="margin:12px 0 0"><span>Backup-Erinnerung</span>
        <select id="s-backupremind">
          <option value="0" ${!s.backupReminderWeeks ? 'selected' : ''}>Aus</option>
          <option value="1" ${s.backupReminderWeeks === 1 ? 'selected' : ''}>Wöchentlich</option>
          <option value="2" ${s.backupReminderWeeks === 2 ? 'selected' : ''}>Alle 2 Wochen</option>
          <option value="4" ${s.backupReminderWeeks === 4 ? 'selected' : ''}>Monatlich</option>
        </select></label>
      ${s.lastBackupAt ? `<p class="tiny muted" style="margin:8px 0 0">Letztes Backup: ${fmtTs(s.lastBackupAt)}</p>` : ''}
      <div class="btn-row" style="margin-top:12px">
        <button class="btn primary" id="expBtn">⬇ Backup exportieren</button>
        <button class="btn" id="impBtn">⬆ Importieren</button>
      </div>
      <input type="file" id="impFile" accept="application/json,.json" hidden />

      <hr class="sep" />
      <div class="tiny muted" style="font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Übungsbibliothek</div>
      <p class="tiny muted" style="margin-top:0">Ergänzt neue Standard-Übungen aus der kuratierten Bibliothek, die noch fehlen. Eigene Übungen/Namen werden dabei nicht verändert oder gelöscht.</p>
      <button class="btn ghost block" id="addLibBtn">Fehlende Standard-Übungen ergänzen</button>

      <hr class="sep" />
      <div class="tiny muted" style="font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Beispieldaten</div>
      <label class="field" style="margin:0;display:flex;align-items:center;gap:10px">
        <input id="s-demo" type="checkbox" ${activeLoc && DB.hasDemoSessions(activeLoc.id) ? 'checked' : ''} style="width:auto" />
        <span style="margin:0">Beispieldaten (ca. 2 Monate Testtrainings)</span></label>
      <p class="tiny muted" style="margin:8px 0 0">Erzeugt bzw. entfernt plausible Testeinheiten für <b>${activeLoc ? esc(activeLoc.emoji) + ' ' + esc(activeLoc.name) : 'den aktiven Ort'}</b>, um Statistik &amp; Kalender auszuprobieren. Braucht mindestens einen Trainingstag mit Übungen an diesem Ort.</p>

      <hr class="sep" />
      <div class="tiny muted" style="font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Papierkorb</div>
      <p class="tiny muted" style="margin-top:0">Gelöschte Übungen und Trainings bleiben hier, bis du sie wiederherstellst oder endgültig entfernst.</p>
      <div class="tiny muted">${trashCount} Einträge im Papierkorb</div>
      <button class="btn ghost block" id="openTrashBtn" style="margin-top:10px">Papierkorb öffnen</button>
    </div>

    <div class="section-title">Gefahrenzone</div>
    <div class="card">
      <button class="btn danger block" id="wipeSessionsBtn">Nur Trainingseinheiten löschen (Pläne bleiben)</button>
      <p class="tiny muted" style="margin:8px 0 0">Löscht alle aufgezeichneten Trainings (inkl. Papierkorb &amp; Beispieldaten) - Orte, Pläne und Trainingstage bleiben erhalten.</p>
      <button class="btn danger block" id="wipeBtn" style="margin-top:14px">Alle Daten löschen</button>
    </div>
    <p class="tiny muted center" style="margin-top:14px">Trainingsplan · lokale PWA · v1</p>
  `;

  $$('#s-theme-pick button', appEl).forEach(b => b.onclick = () => {
    s.theme = b.dataset.theme; DB.save(); applyDisplaySettings();
    $$('#s-theme-pick button', appEl).forEach(x => x.classList.remove('sel')); b.classList.add('sel');
  });
  $$('#s-accent-pick button', appEl).forEach(b => b.onclick = () => {
    s.accentColor = b.dataset.c; DB.save(); applyDisplaySettings();
    $$('#s-accent-pick button', appEl).forEach(x => x.classList.remove('sel')); b.classList.add('sel');
    $('#s-accent-custom', appEl).value = b.dataset.c;
  });
  $('#s-accent-custom', appEl).oninput = e => {
    s.accentColor = e.target.value; DB.save(); applyDisplaySettings();
    $$('#s-accent-pick button', appEl).forEach(x => x.classList.remove('sel'));
  };
  $('#s-fontsize', appEl).onchange = e => { s.fontSize = e.target.value; DB.save(); applyDisplaySettings(); };
  $('#s-density', appEl).onchange = e => { s.density = e.target.value; DB.save(); applyDisplaySettings(); };
  $('#s-corner', appEl).onchange = e => { s.cornerStyle = e.target.value; DB.save(); applyDisplaySettings(); };
  $('#s-reduced', appEl).onchange = e => { s.reducedMotion = e.target.checked; DB.save(); applyDisplaySettings(); };
  $('#s-tagcolors', appEl).onchange = e => { s.tagColors = e.target.checked; DB.save(); };
  $$('#s-musclecolor-pick button', appEl).forEach(b => b.onclick = () => {
    s.muscleColor = b.dataset.c; DB.save(); applyDisplaySettings();
    $$('#s-musclecolor-pick button', appEl).forEach(x => x.classList.remove('sel')); b.classList.add('sel');
  });
  $$('#s-equipcolor-pick button', appEl).forEach(b => b.onclick = () => {
    s.equipColor = b.dataset.c; DB.save(); applyDisplaySettings();
    $$('#s-equipcolor-pick button', appEl).forEach(x => x.classList.remove('sel')); b.classList.add('sel');
  });

  $('#s-defsets', appEl).onchange = e => { s.defaultSets = Math.max(1, parseInt(e.target.value) || 1); DB.save(); };
  $('#s-defreps', appEl).onchange = e => { s.defaultReps = Math.max(1, parseInt(e.target.value) || 1); DB.save(); };
  $('#s-rest', appEl).onchange = e => { s.defaultRestSec = Math.max(0, parseInt(e.target.value) || 0); DB.save(); };
  $('#s-sound', appEl).onchange = e => { s.soundOnRestEnd = e.target.checked; DB.save(); };
  $('#s-diff', appEl).onchange = e => { s.askPlanDiff = e.target.checked; DB.save(); };
  $('#s-weekstart', appEl).onchange = e => { s.weekStart = e.target.value; DB.save(); };
  $('#s-notif', appEl).onchange = async e => {
    if (e.target.checked) {
      if (!('Notification' in window)) { toast('Benachrichtigungen werden von diesem Browser nicht unterstützt'); e.target.checked = false; return; }
      let perm = Notification.permission;
      if (perm === 'default') perm = await Notification.requestPermission();
      if (perm !== 'granted') { toast('Berechtigung nicht erteilt'); e.target.checked = false; return; }
    }
    s.restNotifications = e.target.checked; DB.save();
  };

  $('#s-backupremind', appEl).onchange = e => { s.backupReminderWeeks = parseInt(e.target.value) || 0; DB.save(); };
  $('#expBtn', appEl).onclick = () => {
    const blob = new Blob([DB.exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: `trainingsplan-backup-${DB.todayISO()}.json` });
    document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    s.lastBackupAt = Date.now(); DB.save();
    toast('Backup exportiert');
  };
  const impFile = $('#impFile', appEl);
  $('#impBtn', appEl).onclick = () => impFile.click();
  impFile.onchange = async () => {
    const file = impFile.files[0]; if (!file) return;
    const text = await file.text();
    const mode = await pickImportModeModal();
    if (mode) {
      try { DB.importData(text, mode); toast('Import erfolgreich'); applyDisplaySettings(); render(); }
      catch (e) { toast('Import fehlgeschlagen: ' + e.message); }
    }
    impFile.value = '';
  };

  $('#openTrashBtn', appEl).onclick = () => openTrashModal();

  $('#addLibBtn', appEl).onclick = () => {
    const added = addMissingLibraryExercises();
    toast(added ? `${added} neue Übung(en) ergänzt` : 'Du hast bereits alle Standard-Übungen');
    if (added) render();
  };

  $('#s-demo', appEl).onchange = e => {
    if (e.target.checked) {
      if (!activeLoc) { toast('Erst einen Ort anlegen'); e.target.checked = false; return; }
      const n = DB.generateDemoSessions(activeLoc.id);
      if (!n) { toast('Braucht mind. einen Trainingstag mit Übungen an diesem Ort'); e.target.checked = false; return; }
      toast(n + ' Beispiel-Trainings erzeugt');
    } else {
      DB.removeDemoSessions(activeLoc ? activeLoc.id : null);
      toast('Beispieldaten für diesen Ort entfernt');
    }
  };

  $('#wipeSessionsBtn', appEl).onclick = async () => {
    if (await confirmDialog('Alle aufgezeichneten Trainingseinheiten löschen? Orte, Pläne und Trainingstage bleiben erhalten.', { danger: true, okText: 'Trainingseinheiten löschen' })) {
      DB.wipeSessions(); toast('Trainingseinheiten gelöscht'); render();
    }
  };
  $('#wipeBtn', appEl).onclick = async () => {
    if (await confirmDialog('Wirklich ALLE Daten unwiderruflich löschen?', { danger: true, okText: 'Alles löschen' })) {
      DB.wipeAll(); applyDisplaySettings(); toast('Alle Daten gelöscht'); navigate('/plans');
    }
  };
});

// ---------- Startinhalt: Übungsbibliothek + Sports Club Kiel (3 Pläne) ----------
// Läuft einmalig (siehe SEED_VERSION-Migration unten) – reine Struktur, keine
// erfundene Trainingshistorie, damit sofort echt trainiert werden kann.
// Namen enthalten das Gerät NICHT mehr in Klammern (steht jetzt als eigenes,
// farbiges Label unter der Übung) - Klammer-Zusätze bleiben nur für echte
// Bewegungs-/Griff-Varianten (z.B. "(breiter Griff)", "(Brust-Fokus)") erhalten.
// Kuratierte Übungsbibliothek (Recherche gängiger Kraftsport-Grund- und
// Isolationsübungen, siehe README). Jeder Eintrag hat einen internen "key"
// (nur zum Verdrahten der Beispielpläne unten, wird NICHT mit angelegt) - nötig,
// weil derselbe Übungsname bewusst mehrfach vorkommen darf (z.B. "Bankdrücken"
// mit Langhantel/Kurzhantel/Maschine): das Gerät steht schon als Badge dabei,
// daher wird es NICHT zusätzlich redundant in den Namen geschrieben (z.B.
// "Bankdrücken" statt "Kurzhantel-Bankdrücken" bei Gerät "Kurzhantel"). Namens-
// Zusätze bleiben nur, wenn sie wirklich eine andere Bewegung/Variante
// beschreiben (Griff, Winkel, einarmig, Multipresse/Smith-Machine als
// spezifischerer Maschinentyp) statt nur das Gerät zu wiederholen.
const LIBRARY_EXERCISES = [
  // Brust
  { key: 'bankdruecken-lh', name: 'Bankdrücken', muscles: ['Brust', 'Trizeps', 'Schultern'], equipment: 'Langhantel' },
  { key: 'bankdruecken-kh', name: 'Bankdrücken', muscles: ['Brust', 'Trizeps'], equipment: 'Kurzhantel' },
  { key: 'bankdruecken-mp', name: 'Bankdrücken Multipresse', muscles: ['Brust', 'Trizeps', 'Schultern'], equipment: 'Maschine' },
  { key: 'schraegbankdruecken-lh', name: 'Schrägbankdrücken', muscles: ['Brust', 'Schultern', 'Trizeps'], equipment: 'Langhantel' },
  { key: 'schraegbankdruecken-kh', name: 'Schrägbankdrücken', muscles: ['Brust', 'Schultern', 'Trizeps'], equipment: 'Kurzhantel' },
  { key: 'schraegbankdruecken-mp', name: 'Schrägbankdrücken Multipresse', muscles: ['Brust', 'Schultern', 'Trizeps'], equipment: 'Maschine' },
  { key: 'negativ-bankdruecken', name: 'Negativ-Bankdrücken', muscles: ['Brust', 'Trizeps'], equipment: 'Langhantel' },
  { key: 'fliegende', name: 'Fliegende', muscles: ['Brust'], equipment: 'Kurzhantel' },
  { key: 'butterfly', name: 'Butterfly', muscles: ['Brust'], equipment: 'Maschine' },
  { key: 'kreuzzuege', name: 'Kreuzzüge', muscles: ['Brust'], equipment: 'Kabelzug' },
  { key: 'dips-brust', name: 'Dips (Brust-Fokus)', muscles: ['Brust', 'Trizeps'], equipment: 'Körpergewicht' },
  { key: 'liegestuetze', name: 'Liegestütze', muscles: ['Brust', 'Trizeps', 'Schultern'], equipment: 'Körpergewicht' },
  { key: 'diamond-liegestuetze', name: 'Diamond-Liegestütze', muscles: ['Trizeps', 'Brust'], equipment: 'Körpergewicht' },
  { key: 'ueberzuege', name: 'Überzüge (Pullover)', muscles: ['Brust', 'Rücken'], equipment: 'Kurzhantel' },
  // Rücken
  { key: 'kreuzheben', name: 'Kreuzheben', muscles: ['Rücken', 'Gesäß', 'Beinbeuger', 'Ganzkörper'], equipment: 'Langhantel' },
  { key: 'sumo-kreuzheben', name: 'Sumo-Kreuzheben', muscles: ['Gesäß', 'Beinbeuger', 'Rücken'], equipment: 'Langhantel' },
  { key: 'rumaenisches-kreuzheben', name: 'Rumänisches Kreuzheben', muscles: ['Beinbeuger', 'Gesäß', 'Rücken'], equipment: 'Langhantel' },
  { key: 'good-mornings', name: 'Good Mornings', muscles: ['Rücken', 'Gesäß', 'Beinbeuger'], equipment: 'Langhantel' },
  { key: 'klimmzuege', name: 'Klimmzüge', muscles: ['Rücken', 'Bizeps'], equipment: 'Körpergewicht' },
  { key: 'enge-klimmzuege', name: 'Enge Klimmzüge', muscles: ['Rücken', 'Bizeps'], equipment: 'Körpergewicht' },
  { key: 'klimmzuege-untergriff', name: 'Klimmzüge (Untergriff)', muscles: ['Rücken', 'Bizeps'], equipment: 'Körpergewicht' },
  { key: 'klimmzugmaschine', name: 'Klimmzüge (unterstützt)', muscles: ['Rücken', 'Bizeps'], equipment: 'Maschine' },
  { key: 'latzug-breit', name: 'Latzug (breiter Griff)', muscles: ['Rücken', 'Bizeps'], equipment: 'Kabelzug' },
  { key: 'latzug-eng', name: 'Latzug (enger Griff)', muscles: ['Rücken', 'Bizeps'], equipment: 'Kabelzug' },
  { key: 'latzug-neutral', name: 'Latzug (neutraler Griff)', muscles: ['Rücken', 'Bizeps'], equipment: 'Kabelzug' },
  { key: 'latzug-untergriff', name: 'Latzug (Untergriff)', muscles: ['Rücken', 'Bizeps'], equipment: 'Kabelzug' },
  { key: 'rudern-vorgebeugt', name: 'Rudern vorgebeugt', muscles: ['Rücken', 'Bizeps'], equipment: 'Langhantel' },
  { key: 'rudern-einarmig', name: 'Einarmiges Rudern', muscles: ['Rücken', 'Bizeps'], equipment: 'Kurzhantel' },
  { key: 't-bar-rudern', name: 'T-Bar Rudern', muscles: ['Rücken'], equipment: 'Maschine' },
  { key: 'rudern-sitzend-weit', name: 'Rudern sitzend (weiter Griff)', muscles: ['Rücken', 'Bizeps'], equipment: 'Kabelzug' },
  { key: 'rudern-sitzend-eng', name: 'Rudern sitzend (enger Griff)', muscles: ['Rücken', 'Bizeps'], equipment: 'Kabelzug' },
  { key: 'rudern-brust-gestuetzt', name: 'Rudern (Brust gestützt)', muscles: ['Rücken', 'Bizeps'], equipment: 'Maschine' },
  { key: 'rueckenstrecker', name: 'Rückenstrecker', muscles: ['Rücken', 'Gesäß'], equipment: 'Körpergewicht' },
  { key: 'reverse-hyperextension', name: 'Reverse Hyperextension', muscles: ['Gesäß', 'Rücken'], equipment: 'Maschine' },
  { key: 'facepulls', name: 'Facepulls', muscles: ['Schultern', 'Rücken'], equipment: 'Kabelzug' },
  { key: 'reverse-butterfly', name: 'Reverse Butterfly', muscles: ['Schultern', 'Rücken'], equipment: 'Maschine' },
  { key: 'shrugs-lh', name: 'Nackenheben (Shrugs)', muscles: ['Rücken', 'Schultern'], equipment: 'Langhantel' },
  { key: 'shrugs-kh', name: 'Nackenheben (Shrugs)', muscles: ['Rücken', 'Schultern'], equipment: 'Kurzhantel' },
  { key: 'latissimuszug-gestreckt', name: 'Latissimuszug gestreckt', muscles: ['Rücken'], equipment: 'Kabelzug' },
  // Schultern
  { key: 'schulterdruecken-lh', name: 'Schulterdrücken', muscles: ['Schultern', 'Trizeps'], equipment: 'Langhantel' },
  { key: 'schulterdruecken-kh', name: 'Schulterdrücken', muscles: ['Schultern', 'Trizeps'], equipment: 'Kurzhantel' },
  { key: 'schulterdruecken-mp', name: 'Schulterdrücken', muscles: ['Schultern', 'Trizeps'], equipment: 'Maschine' },
  { key: 'arnold-press', name: 'Arnold Press', muscles: ['Schultern', 'Trizeps'], equipment: 'Kurzhantel' },
  { key: 'seitheben-kh', name: 'Seitheben', muscles: ['Schultern'], equipment: 'Kurzhantel' },
  { key: 'seitheben-kabel', name: 'Seitheben', muscles: ['Schultern'], equipment: 'Kabelzug' },
  { key: 'seitheben-maschine', name: 'Seitheben', muscles: ['Schultern'], equipment: 'Maschine' },
  { key: 'frontheben-kh', name: 'Frontheben', muscles: ['Schultern'], equipment: 'Kurzhantel' },
  { key: 'frontheben-kabel', name: 'Frontheben', muscles: ['Schultern'], equipment: 'Kabelzug' },
  { key: 'aufrechtes-rudern-lh', name: 'Aufrechtes Rudern', muscles: ['Schultern', 'Rücken'], equipment: 'Langhantel' },
  { key: 'aufrechtes-rudern-kabel', name: 'Aufrechtes Rudern', muscles: ['Schultern', 'Rücken'], equipment: 'Kabelzug' },
  { key: 'y-raise', name: 'Y-Raise', muscles: ['Schultern', 'Rücken'], equipment: 'Kurzhantel' },
  // Arme (Bizeps)
  { key: 'bizepscurls-lh', name: 'Bizepscurls', muscles: ['Bizeps'], equipment: 'Langhantel' },
  { key: 'bizepscurls-kh', name: 'Bizepscurls', muscles: ['Bizeps'], equipment: 'Kurzhantel' },
  { key: 'bizepscurls-kabel', name: 'Bizepscurls', muscles: ['Bizeps'], equipment: 'Kabelzug' },
  { key: 'bizepscurls-maschine', name: 'Bizepscurls', muscles: ['Bizeps'], equipment: 'Maschine' },
  { key: 'hammercurls-kh', name: 'Hammercurls', muscles: ['Bizeps', 'Unterarme'], equipment: 'Kurzhantel' },
  { key: 'hammercurls-kabel', name: 'Hammercurls', muscles: ['Bizeps', 'Unterarme'], equipment: 'Kabelzug' },
  { key: 'konzentrationscurls', name: 'Konzentrationscurls', muscles: ['Bizeps'], equipment: 'Kurzhantel' },
  { key: 'scott-curls-lh', name: 'Scott-Curls', muscles: ['Bizeps'], equipment: 'Langhantel' },
  { key: 'scott-curls-kh', name: 'Scott-Curls', muscles: ['Bizeps'], equipment: 'Kurzhantel' },
  // Arme (Trizeps)
  { key: 'trizepsdruecken-kabel', name: 'Trizepsdrücken', muscles: ['Trizeps'], equipment: 'Kabelzug' },
  { key: 'trizepsdruecken-maschine', name: 'Trizepsdrücken', muscles: ['Trizeps'], equipment: 'Maschine' },
  { key: 'trizeps-ueberkopf-kh', name: 'Trizeps-Überkopfstrecken', muscles: ['Trizeps'], equipment: 'Kurzhantel' },
  { key: 'trizeps-ueberkopf-kabel', name: 'Trizeps-Überkopfstrecken', muscles: ['Trizeps'], equipment: 'Kabelzug' },
  { key: 'french-press-lh', name: 'French Press', muscles: ['Trizeps'], equipment: 'Langhantel' },
  { key: 'french-press-kh', name: 'French Press', muscles: ['Trizeps'], equipment: 'Kurzhantel' },
  { key: 'enges-bankdruecken', name: 'Enges Bankdrücken', muscles: ['Trizeps', 'Brust'], equipment: 'Langhantel' },
  { key: 'dips-trizeps', name: 'Dips (Trizeps-Fokus)', muscles: ['Trizeps'], equipment: 'Körpergewicht' },
  { key: 'trizeps-kickbacks', name: 'Trizeps-Kickbacks', muscles: ['Trizeps'], equipment: 'Kurzhantel' },
  // Arme (Unterarme)
  { key: 'unterarmcurls', name: 'Unterarmcurls', muscles: ['Unterarme'], equipment: 'Kurzhantel' },
  { key: 'unterarmcurls-rueckwaerts', name: 'Unterarmcurls rückwärts', muscles: ['Unterarme'], equipment: 'Kurzhantel' },
  { key: 'reverse-curls-lh', name: 'Reverse Curls', muscles: ['Unterarme', 'Bizeps'], equipment: 'Langhantel' },
  { key: 'reverse-curls-kh', name: 'Reverse Curls', muscles: ['Unterarme', 'Bizeps'], equipment: 'Kurzhantel' },
  // Beine
  { key: 'kniebeuge', name: 'Kniebeuge', muscles: ['Quadrizeps', 'Gesäß'], equipment: 'Langhantel' },
  { key: 'frontkniebeuge', name: 'Frontkniebeuge', muscles: ['Quadrizeps', 'Gesäß'], equipment: 'Langhantel' },
  { key: 'kniebeuge-mp', name: 'Kniebeuge Multipresse', muscles: ['Quadrizeps', 'Gesäß'], equipment: 'Maschine' },
  { key: 'beinpresse', name: 'Beinpresse', muscles: ['Quadrizeps', 'Gesäß'], equipment: 'Maschine' },
  { key: 'ausfallschritte-kh', name: 'Ausfallschritte', muscles: ['Quadrizeps', 'Gesäß'], equipment: 'Kurzhantel' },
  { key: 'ausfallschritte-kg', name: 'Ausfallschritte', muscles: ['Quadrizeps', 'Gesäß'], equipment: 'Körpergewicht' },
  { key: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', muscles: ['Quadrizeps', 'Gesäß'], equipment: 'Kurzhantel' },
  { key: 'beinstrecker', name: 'Beinstrecker', muscles: ['Quadrizeps'], equipment: 'Maschine' },
  { key: 'beinbeuger-liegend', name: 'Beinbeuger liegend', muscles: ['Beinbeuger'], equipment: 'Maschine' },
  { key: 'beinbeuger-sitzend', name: 'Beinbeuger sitzend', muscles: ['Beinbeuger'], equipment: 'Maschine' },
  { key: 'nordic-beinbeuger', name: 'Nordic Beinbeuger', muscles: ['Beinbeuger'], equipment: 'Körpergewicht' },
  { key: 'hip-thrust-lh', name: 'Hüftstoßen (Hip Thrust)', muscles: ['Gesäß'], equipment: 'Langhantel' },
  { key: 'hip-thrust-mp', name: 'Hüftstoßen (Hip Thrust)', muscles: ['Gesäß'], equipment: 'Maschine' },
  { key: 'abduktion', name: 'Abduktion (Hüfte)', muscles: ['Gesäß'], equipment: 'Maschine' },
  { key: 'adduktion', name: 'Adduktion (Hüfte)', muscles: ['Gesäß'], equipment: 'Maschine' },
  { key: 'wadenheben-stehend', name: 'Wadenheben stehend', muscles: ['Waden'], equipment: 'Maschine' },
  { key: 'wadenheben-sitzend', name: 'Wadenheben sitzend', muscles: ['Waden'], equipment: 'Maschine' },
  { key: 'wadenheben-kh', name: 'Wadenheben', muscles: ['Waden'], equipment: 'Kurzhantel' },
  { key: 'goblet-squat', name: 'Goblet Squat', muscles: ['Quadrizeps', 'Gesäß'], equipment: 'Kurzhantel' },
  { key: 'step-ups', name: 'Step-ups', muscles: ['Quadrizeps', 'Gesäß'], equipment: 'Kurzhantel' },
  // Bauch
  { key: 'crunches-kg', name: 'Crunches', muscles: ['Bauch'], equipment: 'Körpergewicht' },
  { key: 'crunches-kabel', name: 'Crunches', muscles: ['Bauch'], equipment: 'Kabelzug' },
  { key: 'plank', name: 'Plank', muscles: ['Bauch'], equipment: 'Körpergewicht' },
  { key: 'seitplank', name: 'Seitplank', muscles: ['Bauch'], equipment: 'Körpergewicht' },
  { key: 'beinheben-haengend', name: 'Beinheben hängend', muscles: ['Bauch'], equipment: 'Körpergewicht' },
  { key: 'russian-twist', name: 'Russian Twist', muscles: ['Bauch'], equipment: 'Körpergewicht' },
  { key: 'situps', name: 'Sit-ups', muscles: ['Bauch'], equipment: 'Körpergewicht' },
  { key: 'ab-wheel', name: 'Ab Wheel Rollout', muscles: ['Bauch', 'Ganzkörper'], equipment: 'Sonstiges' },
  { key: 'holzhacker', name: 'Holzhacker', muscles: ['Bauch'], equipment: 'Kabelzug' },
  // Ganzkörper
  { key: 'kb-swing', name: 'Kettlebell Swing', muscles: ['Gesäß', 'Beinbeuger', 'Ganzkörper'], equipment: 'Kettlebell' },
  { key: 'farmers-walk-kh', name: 'Farmers Walk', muscles: ['Ganzkörper', 'Unterarme'], equipment: 'Kurzhantel' },
  { key: 'farmers-walk-kb', name: 'Farmers Walk', muscles: ['Ganzkörper', 'Unterarme'], equipment: 'Kettlebell' },
  { key: 'turkish-getup', name: 'Turkish Get-up', muscles: ['Ganzkörper'], equipment: 'Kettlebell' },
  { key: 'umsetzen-druecken', name: 'Umsetzen und Drücken (Clean & Press)', muscles: ['Ganzkörper', 'Schultern'], equipment: 'Langhantel' },
];

// Push/Pull/Legs-Zielwerte (Sätze/Wdh./Pause), an Hypertrophie-/Kraft-Richtwerten
// orientiert: Grundübungen 4-6 Wdh. mit langer Pause, Isolation 10-15 Wdh. kürzer.
// Referenziert Übungen über den internen "key" (nicht den Namen), da derselbe
// Name jetzt mehrfach vorkommen darf (siehe LIBRARY_EXERCISES oben).
const PPL_PLAN = {
  Push: { emoji: '🔴', color: '#ff6b6b', exercises: [
    ['bankdruecken-lh', 4, 7, 150],
    ['schraegbankdruecken-kh', 3, 9, 120],
    ['schulterdruecken-lh', 3, 9, 120],
    ['seitheben-kh', 3, 14, 60],
    ['dips-brust', 3, 10, 90],
    ['trizepsdruecken-kabel', 3, 11, 60],
  ] },
  Pull: { emoji: '🔵', color: '#4cc9f0', exercises: [
    ['kreuzheben', 3, 5, 180],
    ['klimmzuege', 3, 8, 120],
    ['rudern-vorgebeugt', 3, 9, 120],
    ['rudern-sitzend-weit', 3, 11, 90],
    ['facepulls', 3, 17, 60],
    ['bizepscurls-lh', 3, 11, 60],
  ] },
  Legs: { emoji: '🟢', color: '#46c98b', exercises: [
    ['kniebeuge', 4, 7, 180],
    ['beinpresse', 3, 11, 120],
    ['rumaenisches-kreuzheben', 3, 9, 120],
    ['ausfallschritte-kh', 3, 11, 90],
    ['beinbeuger-liegend', 3, 11, 90],
    ['wadenheben-stehend', 4, 14, 60],
  ] },
};

// Push/Pull/Legs mit A/B-Tagen (6 Tage, zweimal pro Woche pro Kategorie mit
// unterschiedlicher Übungsauswahl für mehr Abwechslung/Übungsvielfalt).
const PPL_AB_PLAN = {
  'Push A': { emoji: '🔴A', color: '#ff6b6b', exercises: [
    ['bankdruecken-lh', 4, 7, 150],
    ['schulterdruecken-kh', 3, 9, 120],
    ['schraegbankdruecken-kh', 3, 11, 100],
    ['seitheben-kh', 3, 14, 60],
    ['trizepsdruecken-kabel', 3, 11, 60],
    ['dips-brust', 3, 10, 90],
  ] },
  'Push B': { emoji: '🔴B', color: '#ff6b6b', exercises: [
    ['schraegbankdruecken-lh', 4, 7, 150],
    ['schulterdruecken-lh', 3, 9, 120],
    ['bankdruecken-mp', 3, 11, 100],
    ['frontheben-kh', 3, 14, 60],
    ['enges-bankdruecken', 3, 8, 100],
    ['trizeps-ueberkopf-kh', 3, 11, 60],
  ] },
  'Pull A': { emoji: '🔵A', color: '#4cc9f0', exercises: [
    ['kreuzheben', 3, 5, 180],
    ['klimmzuege', 3, 8, 120],
    ['rudern-vorgebeugt', 3, 9, 120],
    ['rudern-sitzend-eng', 3, 11, 90],
    ['facepulls', 3, 17, 60],
    ['bizepscurls-lh', 3, 11, 60],
  ] },
  'Pull B': { emoji: '🔵B', color: '#4cc9f0', exercises: [
    ['rumaenisches-kreuzheben', 3, 9, 150],
    ['latzug-breit', 3, 9, 120],
    ['t-bar-rudern', 3, 9, 120],
    ['reverse-butterfly', 3, 14, 60],
    ['hammercurls-kh', 3, 11, 60],
    ['bizepscurls-kh', 3, 11, 60],
  ] },
  'Legs A': { emoji: '🟢A', color: '#46c98b', exercises: [
    ['kniebeuge', 4, 7, 180],
    ['beinpresse', 3, 11, 120],
    ['beinbeuger-liegend', 3, 11, 90],
    ['ausfallschritte-kh', 3, 11, 90],
    ['wadenheben-stehend', 4, 14, 60],
  ] },
  'Legs B': { emoji: '🟢B', color: '#46c98b', exercises: [
    ['kniebeuge-mp', 4, 9, 150],
    ['bulgarian-split-squat', 3, 11, 90],
    ['beinstrecker', 3, 14, 90],
    ['hip-thrust-lh', 3, 11, 120],
    ['wadenheben-sitzend', 4, 18, 60],
  ] },
};

// "Beedle"-Plan: 1:1 aus dem mitgebrachten eigenen Trainingsplan übernommen
// (Push/Pull/Beine), Übungen auf die Bibliothek gemappt.
const BEEDLE_PLAN = {
  Push: { emoji: '🥊', color: '#f72585', exercises: [
    ['bankdruecken-lh', 3, 8, 120],
    ['schraegbankdruecken-lh', 3, 10, 100],
    ['schraegbankdruecken-kh', 3, 10, 100],
    ['butterfly', 3, 12, 60],
    ['schulterdruecken-lh', 3, 10, 100],
    ['seitheben-kh', 3, 12, 60],
    ['trizepsdruecken-kabel', 3, 12, 60],
    ['trizeps-ueberkopf-kh', 3, 12, 60],
  ] },
  Pull: { emoji: '🪢', color: '#c77dff', exercises: [
    ['kreuzheben', 3, 6, 150],
    ['latzug-breit', 3, 10, 100],
    ['rudern-sitzend-weit', 3, 10, 100],
    ['reverse-butterfly', 3, 12, 60],
    ['t-bar-rudern', 3, 10, 100],
    ['bizepscurls-lh', 3, 10, 60],
    ['bizepscurls-kh', 3, 10, 60],
  ] },
  Beine: { emoji: '🦶', color: '#ffb454', exercises: [
    ['kniebeuge', 3, 8, 120],
    ['beinpresse', 3, 10, 100],
    ['beinbeuger-liegend', 3, 10, 90],
    ['beinstrecker', 3, 12, 90],
    ['abduktion', 3, 14, 60],
    ['wadenheben-stehend', 3, 14, 60],
  ] },
};

// Ergänzt Übungen aus der kuratierten LIBRARY_EXERCISES, die in der Bibliothek
// des Nutzers noch fehlen (Abgleich über findDuplicateExercise: Name+Muskeln+
// Gerät) - rein additiv, verändert/löscht nichts Bestehendes. So kommen
// Überarbeitungen der Standard-Bibliothek auch bei bereits eingerichteten
// Installationen an, ohne die reale Trainingshistorie zu berühren (die einmalige
// SEED_VERSION-Migration würde dafür alles löschen und neu aufsetzen).
function addMissingLibraryExercises() {
  let added = 0;
  LIBRARY_EXERCISES.forEach(({ key, ...data }) => {
    if (!DB.findDuplicateExercise(data)) { DB.addExercise(data); added++; }
  });
  return added;
}

function seedInitialContent() {
  const byKey = new Map();
  LIBRARY_EXERCISES.forEach(({ key, ...data }) => { byKey.set(key, DB.addExercise(data)); });

  const loc = DB.addLocation({ name: 'Sports Club Kiel', emoji: '🏋️', color: COLORS[0] });

  const buildPlan = (planName, planEmoji, dayConfig) => {
    const plan = DB.addPlan({ locationId: loc.id, name: planName, emoji: planEmoji, color: COLORS[0] });
    Object.entries(dayConfig).forEach(([dayName, cfg]) => {
      const day = DB.addDay({ planId: plan.id, name: dayName, emoji: cfg.emoji, color: cfg.color });
      cfg.exercises.forEach(([exKey, sets, reps, restSec]) => {
        const ex = byKey.get(exKey);
        if (ex) DB.addExerciseToDay(day.id, ex.id, { sets, reps, restSec });
      });
    });
    return plan;
  };

  buildPlan('Push Pull Legs', '🔄', PPL_PLAN);
  buildPlan('Push Pull Legs (A/B)', '🔁', PPL_AB_PLAN);
  buildPlan('Beedle', '📓', BEEDLE_PLAN);

  DB.setActiveLocation(loc.id);
  DB.generateDemoSessions(loc.id);
}

// Einmalige Migration: alte (Test-/Demo-)Daten löschen und den kuratierten
// Startinhalt anlegen. Läuft nur, solange settings.seedVersion < SEED_VERSION -
// ein manuelles "Alle Daten löschen" markiert die Version als aktuell, damit
// danach wirklich leer bleibt, was leer sein soll.
function ensureSeed() {
  if (DB.db().settings.seedVersion < DB.SEED_VERSION) {
    DB.wipeAll();
    seedInitialContent();
  }
}

// Erinnert einmalig pro Start an ein Backup, falls in den Einstellungen aktiviert
// und das letzte Backup lange genug her ist (oder noch nie gemacht wurde).
function checkBackupReminder() {
  const s = DB.db().settings;
  if (!s.backupReminderWeeks || !DB.db().plans.length) return;
  const dueMs = s.backupReminderWeeks * 7 * 86400000;
  if (Date.now() - (s.lastBackupAt || 0) > dueMs) toast('📦 Erinnerung: Zeit für ein Backup (Einstellungen → Daten)');
}

// ============================================================
//  Start
// ============================================================
DB.db();
ensureSeed();
applyDisplaySettings();
render();
checkBackupReminder();

// Service Worker (Offline / installierbar)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW-Registrierung fehlgeschlagen', err));
  });
}
