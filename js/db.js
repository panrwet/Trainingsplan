// ============================================================
//  db.js – lokale Datenhaltung (localStorage) + CRUD + Statistik
//  Hierarchie:  Ort -> Trainingsplan -> Trainingstag -> Übungen
//  Übungen stammen aus der wiederverwendbaren Übungsbibliothek.
// ============================================================

const KEY = 'trainingsplan.v1';

// Einmalige Content-Migration: wenn settings.seedVersion < SEED_VERSION, wird der
// Store beim Start geleert und mit dem kuratierten Startinhalt (Sports Club Kiel +
// Push/Pull/Legs + Übungsbibliothek) neu befüllt. wipeAll() setzt seedVersion
// direkt auf SEED_VERSION, damit ein manuelles "Alle Daten löschen" NICHT erneut
// automatisch befüllt wird (nur diese eine automatische Migration tut das).
export const SEED_VERSION = 3;

// Muskelgruppen UND Geräte-Arten sind beide selbst verwaltbar (siehe
// muscleGroups()/equipmentTypes() u.a. unten) - diese Listen sind nur der
// Startbestand für neue/bestehende Installationen.
const DEFAULT_MUSCLES = ['Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps', 'Unterarme', 'Quadrizeps', 'Beinbeuger', 'Gesäß', 'Waden', 'Bauch', 'Ganzkörper'];
const DEFAULT_EQUIPMENT = ['Langhantel', 'Kurzhantel', 'Maschine', 'Kabelzug', 'Körpergewicht', 'Kettlebell', 'Sonstiges'];

const DEFAULTS = () => ({
  version: 1,
  settings: { defaultRestSec: 90, soundOnRestEnd: true, seedVersion: 0, tagColors: true },
  exercises: [],   // Bibliothek: {id,name,muscles[],equipment,notes,unit,createdAt}
  muscleGroups: DEFAULT_MUSCLES.map(name => ({ id: uid('mg'), name, createdAt: Date.now() })),   // {id,name,createdAt}
  equipmentTypes: DEFAULT_EQUIPMENT.map(name => ({ id: uid('eq'), name, createdAt: Date.now() })), // {id,name,createdAt}
  exerciseNotes: [], // Dauerhafte Geräte-/Einstellungs-Notiz je Übung UND Ort: {id,exerciseId,locationId,text,updatedAt}
  locations: [],   // Orte:        {id,name,emoji,color,createdAt}
  plans: [],       // Pläne:       {id,locationId,name,emoji,color,createdAt}
  days: [],        // Trainingstage:{id,planId,name,emoji,color,order,exercises:[{id,exerciseId,sets,reps,restSec}],createdAt}
  sessions: [],    // Einheiten:   {id,locationId,planId,dayId,dayName,date,startedAt,finishedAt,emoji,color,note,entries:[...],planSnapshot:[...]}
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
  const ex = { id: uid('ex'), name: '', muscles: [], equipment: '', notes: '', unit: 'kg', createdAt: Date.now(), ...data };
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
  d.exerciseNotes = d.exerciseNotes.filter(n => n.exerciseId !== id);
  save();
}
// Wie oft wurde eine Übung in Einheiten genutzt (für Löschwarnung)
export function exerciseUsage(id) {
  return db().sessions.filter(s => (s.entries || []).some(e => e.exerciseId === id)).length;
}

// ---------- Dauerhafte Geräte-/Einstellungs-Notiz je Übung + Ort ----------
// Getrennt vom allgemeinen Übungs-"notes"-Feld (Technik-Hinweise, ortsunabhängig):
// Geräte-Einstellungen (z.B. Sitzhöhe) sind zwischen Gyms nicht vergleichbar,
// deshalb eine eigene Notiz je (Übung, Ort)-Kombination.
export function getExerciseNote(exerciseId, locationId) {
  if (!exerciseId || !locationId) return null;
  return db().exerciseNotes.find(n => n.exerciseId === exerciseId && n.locationId === locationId) || null;
}
export function setExerciseNote(exerciseId, locationId, text) {
  if (!exerciseId || !locationId) return null;
  text = String(text || '').trim();
  const d = db();
  let n = d.exerciseNotes.find(x => x.exerciseId === exerciseId && x.locationId === locationId);
  if (!text) {
    if (n) d.exerciseNotes = d.exerciseNotes.filter(x => x !== n);
    save();
    return null;
  }
  if (n) { n.text = text; n.updatedAt = Date.now(); }
  else { n = { id: uid('exn'), exerciseId, locationId, text, updatedAt: Date.now() }; d.exerciseNotes.push(n); }
  save();
  return n;
}

// ---------- Muskelgruppen (selbst verwaltbar, für Filter + Übungs-Tagging) ----------
export function muscleGroups() { return db().muscleGroups.slice().sort((a, b) => a.name.localeCompare(b.name, 'de')); }
export function getMuscleGroup(id) { return db().muscleGroups.find(m => m.id === id) || null; }
export function addMuscleGroup(name) {
  name = String(name || '').trim(); if (!name) return null;
  const existing = db().muscleGroups.find(m => m.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const m = { id: uid('mg'), name, createdAt: Date.now() };
  db().muscleGroups.push(m); save(); return m;
}
export function renameMuscleGroup(id, newName) {
  newName = String(newName || '').trim(); if (!newName) return;
  const m = getMuscleGroup(id); if (!m) return;
  const oldName = m.name;
  m.name = newName;
  if (oldName !== newName) {
    db().exercises.forEach(ex => {
      if ((ex.muscles || []).includes(oldName)) ex.muscles = ex.muscles.map(x => x === oldName ? newName : x);
    });
  }
  save();
}
export function deleteMuscleGroup(id) {
  const m = getMuscleGroup(id); if (!m) return;
  db().exercises.forEach(ex => { ex.muscles = (ex.muscles || []).filter(x => x !== m.name); });
  db().muscleGroups = db().muscleGroups.filter(x => x.id !== id);
  save();
}
export function muscleGroupUsage(id) {
  const m = getMuscleGroup(id); if (!m) return 0;
  return db().exercises.filter(ex => (ex.muscles || []).includes(m.name)).length;
}

// ---------- Geräte-Arten (selbst verwaltbar, für Filter + Übungs-Tagging) ----------
export function equipmentTypes() { return db().equipmentTypes.slice().sort((a, b) => a.name.localeCompare(b.name, 'de')); }
export function getEquipmentType(id) { return db().equipmentTypes.find(e => e.id === id) || null; }
export function addEquipmentType(name) {
  name = String(name || '').trim(); if (!name) return null;
  const existing = db().equipmentTypes.find(e => e.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const e = { id: uid('eq'), name, createdAt: Date.now() };
  db().equipmentTypes.push(e); save(); return e;
}
export function renameEquipmentType(id, newName) {
  newName = String(newName || '').trim(); if (!newName) return;
  const e = getEquipmentType(id); if (!e) return;
  const oldName = e.name;
  e.name = newName;
  if (oldName !== newName) {
    db().exercises.forEach(ex => { if (ex.equipment === oldName) ex.equipment = newName; });
  }
  save();
}
export function deleteEquipmentType(id) {
  const e = getEquipmentType(id); if (!e) return;
  db().exercises.forEach(ex => { if (ex.equipment === e.name) ex.equipment = ''; });
  db().equipmentTypes = db().equipmentTypes.filter(x => x.id !== id);
  save();
}
export function equipmentUsage(id) {
  const e = getEquipmentType(id); if (!e) return 0;
  return db().exercises.filter(ex => ex.equipment === e.name).length;
}

// ---------- Orte ----------
export function locations() { return db().locations.slice(); }
export function getLocation(id) { return db().locations.find(l => l.id === id) || null; }

// Aktiver Ort (globaler Filter / oberer Reiter). Fällt auf den ersten Ort zurück.
export function getActiveLocationId() {
  const d = db();
  let id = d.settings.activeLocationId;
  if (!id || !d.locations.some(l => l.id === id)) {
    id = d.locations.length ? d.locations[0].id : null;
    d.settings.activeLocationId = id;
  }
  return id;
}
export function getActiveLocation() { const id = getActiveLocationId(); return id ? getLocation(id) : null; }
export function setActiveLocation(id) { db().settings.activeLocationId = id; save(); }
export function addLocation(data) {
  const l = { id: uid('loc'), name: '', emoji: '📍', color: '#6c8cff', createdAt: Date.now(), ...data };
  db().locations.push(l);
  db().settings.activeLocationId = l.id; // neuen Ort direkt aktiv setzen
  save(); return l;
}
export function updateLocation(id, patch) { const l = getLocation(id); if (l) { Object.assign(l, patch); save(); } return l; }
export function deleteLocation(id) {
  const d = db();
  const planIds = d.plans.filter(p => p.locationId === id).map(p => p.id);
  d.plans = d.plans.filter(p => p.locationId !== id);
  d.days = d.days.filter(day => !planIds.includes(day.planId));
  d.locations = d.locations.filter(l => l.id !== id);
  d.exerciseNotes = d.exerciseNotes.filter(n => n.locationId !== id);
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

// Kopiert einen Plan (mit allen Trainingstagen & Zielwerten) als unabhängige
// Kopie an einen anderen Ort. Übungen werden dabei NICHT dupliziert -
// die Bibliothek ist ortübergreifend gemeinsam (jedes Gym hat z.B. eine
// Brustpresse), nur die Statistik/das "letztes Mal" bleibt je Ort getrennt.
// Die Kopie ist danach vollständig unabhängig vom Original editierbar.
export function copyPlanToLocation(planId, targetLocationId) {
  const p = getPlan(planId); if (!p) return null;
  const newPlan = addPlan({ name: p.name, emoji: p.emoji, color: p.color, locationId: targetLocationId });
  daysByPlan(planId).forEach(day => {
    const newDay = addDay({ name: day.name, emoji: day.emoji, color: day.color, planId: newPlan.id });
    day.exercises.forEach(item => addExerciseToDay(newDay.id, item.exerciseId, { sets: item.sets, reps: item.reps, restSec: item.restSec }));
  });
  return newPlan;
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
    // Schnappschuss des Plans zum Trainingsstart -> Basis für den Diff beim Beenden
    // (Trainingstag könnte sich zwischenzeitlich ändern oder gelöscht werden).
    planSnapshot: day.exercises.map(item => ({ exerciseId: item.exerciseId, sets: item.sets, reps: item.reps, restSec: item.restSec })),
  };
  db().sessions.push(s); save(); return s;
}
export function updateSession(id, patch) { const s = getSession(id); if (s) { Object.assign(s, patch); save(); } return s; }
export function deleteSession(id) { const d = db(); d.sessions = d.sessions.filter(s => s.id !== id); save(); }

// ---------- Anpassungen während des Trainings zurück in den Plan übernehmen ----------
// Vergleicht den aktuellen Stand der Einheit mit dem Schnappschuss bei Trainingsstart
// und liefert einzeln auswählbare Änderungen (Pause/Sätze pro Übung, hinzugefügte/
// entfernte Übungen). Ohne planSnapshot oder gelöschten Trainingstag: keine Diffs.
export function computeSessionPlanDiff(sessionId) {
  const s = getSession(sessionId);
  if (!s || !s.planSnapshot) return [];
  const day = getDay(s.dayId);
  if (!day) return [];
  const snapMap = new Map(s.planSnapshot.map(x => [x.exerciseId, x]));
  const entryMap = new Map(s.entries.map(x => [x.exerciseId, x]));
  const diffs = [];
  for (const entry of s.entries) {
    const snap = snapMap.get(entry.exerciseId);
    const doneCount = (entry.sets || []).filter(isWorkingDone).length;
    if (!snap) {
      if (doneCount > 0) {
        diffs.push({
          type: 'exerciseAdded', exerciseId: entry.exerciseId, name: entry.name,
          sets: Math.max(doneCount, 1), reps: entry.targetReps || num(entry.sets[0]?.reps) || 10, restSec: entry.restSec,
        });
      }
      continue;
    }
    if (entry.restSec !== snap.restSec) {
      diffs.push({ type: 'restChanged', exerciseId: entry.exerciseId, name: entry.name, oldVal: snap.restSec, newVal: entry.restSec });
    }
    if (doneCount > 0 && doneCount !== snap.sets) {
      diffs.push({ type: 'setsChanged', exerciseId: entry.exerciseId, name: entry.name, oldVal: snap.sets, newVal: doneCount });
    }
  }
  for (const snap of s.planSnapshot) {
    if (!entryMap.has(snap.exerciseId)) {
      const ex = getExercise(snap.exerciseId);
      diffs.push({ type: 'exerciseRemoved', exerciseId: snap.exerciseId, name: ex ? ex.name : '(Übung)' });
    }
  }
  return diffs;
}

// Wendet ausgewählte Diffs (aus computeSessionPlanDiff) auf den zugehörigen
// Trainingstag an (Plan-Vorlage). Nicht ausgewählte Änderungen gelten nur für
// diese eine Einheit.
export function applyPlanDiffs(sessionId, changes) {
  const s = getSession(sessionId); if (!s) return { applied: 0 };
  const day = getDay(s.dayId); if (!day) return { applied: 0 };
  let applied = 0;
  changes.forEach(ch => {
    if (ch.type === 'restChanged' || ch.type === 'setsChanged') {
      const item = day.exercises.find(x => x.exerciseId === ch.exerciseId);
      if (!item) return;
      if (ch.type === 'restChanged') item.restSec = ch.newVal;
      if (ch.type === 'setsChanged') item.sets = ch.newVal;
      applied++;
    } else if (ch.type === 'exerciseAdded') {
      if (!day.exercises.some(x => x.exerciseId === ch.exerciseId)) {
        day.exercises.push({ id: uid('de'), exerciseId: ch.exerciseId, sets: ch.sets, reps: ch.reps, restSec: ch.restSec });
        applied++;
      }
    } else if (ch.type === 'exerciseRemoved') {
      const before = day.exercises.length;
      day.exercises = day.exercises.filter(x => x.exerciseId !== ch.exerciseId);
      if (day.exercises.length !== before) applied++;
    }
  });
  save();
  return { applied };
}

// Letzte abgeschlossene Sätze einer Übung VOR einer bestimmten Einheit (für "letztes Mal").
// Optional auf einen Ort beschränkt (Geräte sind zwischen Gyms nicht vergleichbar).
export function lastEntryFor(exerciseId, beforeSessionId = null, locationId = null) {
  const all = sessions(); // absteigend nach startedAt
  const current = beforeSessionId ? getSession(beforeSessionId) : null;
  const cutoff = current ? current.startedAt : Infinity;
  for (const s of all) {
    if (s.id === beforeSessionId) continue;
    if ((s.startedAt || 0) >= cutoff) continue;
    if (locationId && s.locationId !== locationId) continue;
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
// Optional auf einen Ort beschränkt -> getrennte Statistik je Gym.
export function exerciseHistory(exerciseId, locationId = null) {
  const rows = [];
  for (const s of db().sessions) {
    if (locationId && s.locationId !== locationId) continue;
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

// Persönliche Rekorde je Übung (optional je Ort)
export function exercisePRs(exerciseId, locationId = null) {
  const hist = exerciseHistory(exerciseId, locationId);
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

// Übungen, die an einem Ort tatsächlich trainiert wurden (mit abgehakten Sätzen)
export function exercisesTrainedAtLocation(locationId) {
  const ids = new Set();
  for (const s of db().sessions) {
    if (locationId && s.locationId !== locationId) continue;
    (s.entries || []).forEach(e => { if ((e.sets || []).some(isWorkingDone)) ids.add(e.exerciseId); });
  }
  return exercises().filter(e => ids.has(e.id));
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
    // Muskelgruppen/Geräte-Arten nach Name deduplizieren (nicht nach id) - sonst
    // könnten z.B. zwei "Brust"-Einträge mit unterschiedlicher id entstehen.
    ['muscleGroups', 'equipmentTypes'].forEach(k => {
      const existingNames = new Set(d[k].map(x => x.name.toLowerCase()));
      (incoming[k] || []).forEach(x => {
        if (x.name && !existingNames.has(x.name.toLowerCase())) { d[k].push(x); existingNames.add(x.name.toLowerCase()); }
      });
    });
    // Geräte-Notizen sind pro (Übung, Ort) eindeutig - nach diesem Schlüssel
    // deduplizieren, nicht nach id.
    const existingNoteKeys = new Set(d.exerciseNotes.map(n => n.exerciseId + '|' + n.locationId));
    (incoming.exerciseNotes || []).forEach(n => {
      const key = n.exerciseId + '|' + n.locationId;
      if (!existingNoteKeys.has(key)) { d.exerciseNotes.push(n); existingNoteKeys.add(key); }
    });
  }
  save();
}
// Setzt alles komplett zurück. seedVersion wird auf den aktuellen Stand gesetzt,
// damit ein manuelles Löschen wirklich leer bleibt (kein automatisches Reseeden).
export function wipeAll() { store = DEFAULTS(); store.settings.seedVersion = SEED_VERSION; save(); }

// ---------- Datum ----------
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
