// ============================================================
//  db.js – lokale Datenhaltung (localStorage) + CRUD + Statistik
//  Hierarchie:  Ort -> Trainingsplan -> Trainingstag -> Übungen
//  Übungen stammen aus der wiederverwendbaren Übungsbibliothek.
// ============================================================

const KEY = 'trainingsplan.v1';

const DEFAULTS = () => ({
  version: 1,
  settings: { defaultRestSec: 90, soundOnRestEnd: true },
  exercises: [],   // Bibliothek: {id,name,category,muscles[],notes,unit,createdAt}
  locations: [],   // Orte:        {id,name,emoji,color,createdAt}
  plans: [],       // Pläne:       {id,locationId,name,emoji,color,createdAt}
  days: [],        // Trainingstage:{id,planId,name,emoji,color,order,exercises:[{id,exerciseId,sets,reps,restSec}],createdAt}
  sessions: [],    // Einheiten:   {id,locationId,planId,dayId,dayName,date,startedAt,finishedAt,emoji,color,note,entries:[...]}
});

let store = null;

// ---------- Basis ----------
export function db() {
  if (store) return store;
  try {
    const raw = localStorage.getItem(KEY);
    store = raw ? JSON.parse(raw) : DEFAULTS();
  } catch (e) {
    console.error('Konnte Daten nicht laden, starte leer', e);
    store = DEFAULTS();
  }
  // Felder absichern (Migration/Robustheit)
  const d = DEFAULTS();
  for (const k of Object.keys(d)) if (store[k] === undefined) store[k] = d[k];
  store.settings = Object.assign(d.settings, store.settings || {});
  return store;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch (e) {
    console.error('Speichern fehlgeschlagen', e);
    alert('Speichern fehlgeschlagen – evtl. ist der Speicher voll.');
  }
}

export function uid(p = 'id') {
  return p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------- Übungsbibliothek ----------
export function exercises() { return db().exercises.slice().sort((a, b) => a.name.localeCompare(b.name, 'de')); }
export function getExercise(id) { return db().exercises.find(e => e.id === id) || null; }
export function addExercise(data) {
  const ex = { id: uid('ex'), name: '', category: '', muscles: [], notes: '', unit: 'kg', createdAt: Date.now(), ...data };
  db().exercises.push(ex); save(); return ex;
}
export function updateExercise(id, patch) {
  const ex = getExercise(id); if (!ex) return; Object.assign(ex, patch); save(); return ex;
}
export function deleteExercise(id) {
  const d = db();
  d.exercises = d.exercises.filter(e => e.id !== id);
  // Aus Trainingstagen entfernen
  d.days.forEach(day => { day.exercises = day.exercises.filter(x => x.exerciseId !== id); });
  save();
}
// Wie oft wurde eine Übung in Einheiten genutzt (für Löschwarnung)
export function exerciseUsage(id) {
  return db().sessions.filter(s => (s.entries || []).some(e => e.exerciseId === id)).length;
}

// ---------- Orte ----------
export function locations() { return db().locations.slice(); }
export function getLocation(id) { return db().locations.find(l => l.id === id) || null; }
export function addLocation(data) {
  const l = { id: uid('loc'), name: '', emoji: '📍', color: '#6c8cff', createdAt: Date.now(), ...data };
  db().locations.push(l); save(); return l;
}
export function updateLocation(id, patch) { const l = getLocation(id); if (l) { Object.assign(l, patch); save(); } return l; }
export function deleteLocation(id) {
  const d = db();
  const planIds = d.plans.filter(p => p.locationId === id).map(p => p.id);
  d.plans = d.plans.filter(p => p.locationId !== id);
  d.days = d.days.filter(day => !planIds.includes(day.planId));
  d.locations = d.locations.filter(l => l.id !== id);
  save();
}

// ---------- Pläne ----------
export function plansByLocation(locId) { return db().plans.filter(p => p.locationId === locId); }
export function getPlan(id) { return db().plans.find(p => p.id === id) || null; }
export function addPlan(data) {
  const p = { id: uid('plan'), locationId: null, name: '', emoji: '🏋️', color: '#6c8cff', createdAt: Date.now(), ...data };
  db().plans.push(p); save(); return p;
}
export function updatePlan(id, patch) { const p = getPlan(id); if (p) { Object.assign(p, patch); save(); } return p; }
export function deletePlan(id) {
  const d = db();
  d.days = d.days.filter(day => day.planId !== id);
  d.plans = d.plans.filter(p => p.id !== id);
  save();
}

// ---------- Trainingstage ----------
export function daysByPlan(planId) {
  return db().days.filter(day => day.planId === planId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
export function getDay(id) { return db().days.find(day => day.id === id) || null; }
export function addDay(data) {
  const order = daysByPlan(data.planId).length;
  const day = { id: uid('day'), planId: null, name: '', emoji: '💪', color: '#46c98b', order, exercises: [], createdAt: Date.now(), ...data };
  db().days.push(day); save(); return day;
}
export function updateDay(id, patch) { const day = getDay(id); if (day) { Object.assign(day, patch); save(); } return day; }
export function deleteDay(id) { const d = db(); d.days = d.days.filter(day => day.id !== id); save(); }
export function reorderDays(planId, orderedIds) {
  orderedIds.forEach((id, i) => { const day = getDay(id); if (day) day.order = i; });
  save();
}

// Übung innerhalb eines Trainingstags
export function addExerciseToDay(dayId, exerciseId, opts = {}) {
  const day = getDay(dayId); if (!day) return;
  const item = { id: uid('de'), exerciseId, sets: opts.sets ?? 3, reps: opts.reps ?? 10, restSec: opts.restSec ?? db().settings.defaultRestSec };
  day.exercises.push(item); save(); return item;
}
export function updateDayExercise(dayId, itemId, patch) {
  const day = getDay(dayId); if (!day) return;
  const it = day.exercises.find(x => x.id === itemId); if (it) { Object.assign(it, patch); save(); }
  return it;
}
export function removeDayExercise(dayId, itemId) {
  const day = getDay(dayId); if (!day) return;
  day.exercises = day.exercises.filter(x => x.id !== itemId); save();
}
export function reorderDayExercises(dayId, orderedItemIds) {
  const day = getDay(dayId); if (!day) return;
  day.exercises.sort((a, b) => orderedItemIds.indexOf(a.id) - orderedItemIds.indexOf(b.id));
  save();
}

// ---------- Einheiten (Sessions / durchgeführtes Training) ----------
export function sessions() {
  return db().sessions.slice().sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
}
export function getSession(id) { return db().sessions.find(s => s.id === id) || null; }

// Neue Einheit aus einem Trainingstag erzeugen (mit Zielwerten vorbefüllt)
export function startSession(dayId) {
  const day = getDay(dayId); if (!day) return null;
  const plan = getPlan(day.planId);
  const loc = plan ? getLocation(plan.locationId) : null;
  const entries = day.exercises.map(item => {
    const ex = getExercise(item.exerciseId);
    const sets = [];
    for (let i = 0; i < (item.sets || 1); i++) sets.push({ weight: '', reps: '', done: false });
    return {
      exerciseId: item.exerciseId,
      name: ex ? ex.name : '(gelöschte Übung)',
      unit: ex ? (ex.unit || 'kg') : 'kg',
      targetReps: item.reps,
      targetSets: item.sets,
      restSec: item.restSec,
      sets,
    };
  });
  const now = Date.now();
  const s = {
    id: uid('ses'),
    locationId: loc ? loc.id : null,
    planId: plan ? plan.id : null,
    dayId: day.id,
    dayName: day.name,
    date: todayISO(),
    startedAt: now,
    finishedAt: null,
    emoji: day.emoji || plan?.emoji || '💪',
    color: day.color || plan?.color || '#46c98b',
    note: '',
    entries,
  };
  db().sessions.push(s); save(); return s;
}
export function updateSession(id, patch) { const s = getSession(id); if (s) { Object.assign(s, patch); save(); } return s; }
export function deleteSession(id) { const d = db(); d.sessions = d.sessions.filter(s => s.id !== id); save(); }

// Letzte abgeschlossene Sätze einer Übung VOR einer bestimmten Einheit (für "letztes Mal")
export function lastEntryFor(exerciseId, beforeSessionId = null) {
  const all = sessions(); // absteigend nach startedAt
  const current = beforeSessionId ? getSession(beforeSessionId) : null;
  const cutoff = current ? current.startedAt : Infinity;
  for (const s of all) {
    if (s.id === beforeSessionId) continue;
    if ((s.startedAt || 0) >= cutoff) continue;
    const e = (s.entries || []).find(en => en.exerciseId === exerciseId && (en.sets || []).some(hasData));
    if (e) return { session: s, entry: e };
  }
  return null;
}

// ---------- Hilfen für Sätze ----------
export function hasData(set) {
  return set && (num(set.weight) > 0 || num(set.reps) > 0);
}
export function isWorkingDone(set) {
  return set && set.done && num(set.reps) > 0;
}
export function num(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }

// Epley-Formel für geschätztes 1RM
export function epley1RM(weight, reps) {
  const w = num(weight), r = num(reps);
  if (w <= 0 || r <= 0) return 0;
  if (r === 1) return w;
  return w * (1 + r / 30);
}

// ---------- Statistik je Übung ----------
// Liefert je Einheit (chronologisch aufsteigend) aggregierte Kennzahlen.
export function exerciseHistory(exerciseId) {
  const rows = [];
  for (const s of db().sessions) {
    const entries = (s.entries || []).filter(e => e.exerciseId === exerciseId);
    if (!entries.length) continue;
    const workSets = [];
    entries.forEach(e => (e.sets || []).forEach(set => { if (isWorkingDone(set)) workSets.push(set); }));
    if (!workSets.length) continue;
    let volume = 0, maxWeight = 0, best1rm = 0, bestSet = null, totalReps = 0;
    workSets.forEach(set => {
      const w = num(set.weight), r = num(set.reps);
      volume += w * r;
      totalReps += r;
      if (w > maxWeight) maxWeight = w;
      const e1 = epley1RM(w, r);
      if (e1 > best1rm) { best1rm = e1; bestSet = { weight: w, reps: r }; }
    });
    rows.push({
      sessionId: s.id,
      date: s.date,
      startedAt: s.startedAt || 0,
      sets: workSets.map(x => ({ weight: num(x.weight), reps: num(x.reps) })),
      setCount: workSets.length,
      totalReps,
      volume: Math.round(volume),
      maxWeight,
      est1rm: Math.round(best1rm * 10) / 10,
      bestSet,
    });
  }
  rows.sort((a, b) => a.startedAt - b.startedAt);
  return rows;
}

// Persönliche Rekorde je Übung
export function exercisePRs(exerciseId) {
  const hist = exerciseHistory(exerciseId);
  const pr = { maxWeight: 0, best1rm: 0, maxVolume: 0, maxReps: 0, sessionsCount: hist.length, lastDate: null, firstDate: null };
  hist.forEach(r => {
    if (r.maxWeight > pr.maxWeight) pr.maxWeight = r.maxWeight;
    if (r.est1rm > pr.best1rm) pr.best1rm = r.est1rm;
    if (r.volume > pr.maxVolume) pr.maxVolume = r.volume;
    r.sets.forEach(s => { if (s.reps > pr.maxReps) pr.maxReps = s.reps; });
  });
  if (hist.length) { pr.firstDate = hist[0].date; pr.lastDate = hist[hist.length - 1].date; }
  return pr;
}

// ---------- Kalender ----------
// Map: 'YYYY-MM-DD' -> [ {emoji,color,name,sessionId} ... ]
export function sessionsByDate() {
  const map = {};
  for (const s of db().sessions) {
    const key = s.date;
    (map[key] ||= []).push({ emoji: s.emoji, color: s.color, name: s.dayName || 'Training', sessionId: s.id });
  }
  return map;
}

// ---------- Export / Import ----------
export function exportData() {
  return JSON.stringify(db(), null, 2);
}
export function importData(json, mode = 'replace') {
  const incoming = typeof json === 'string' ? JSON.parse(json) : json;
  if (!incoming || typeof incoming !== 'object') throw new Error('Ungültige Datei');
  if (mode === 'replace') {
    store = Object.assign(DEFAULTS(), incoming);
  } else { // merge
    const d = db();
    ['exercises', 'locations', 'plans', 'days', 'sessions'].forEach(k => {
      const existing = new Set(d[k].map(x => x.id));
      (incoming[k] || []).forEach(x => { if (!existing.has(x.id)) d[k].push(x); });
    });
  }
  save();
}
export function wipeAll() { store = DEFAULTS(); save(); }

// ---------- Datum ----------
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
