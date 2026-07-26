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
export const SEED_VERSION = 5;

// Muskelgruppen UND Geräte-Arten sind beide selbst verwaltbar (siehe
// muscleGroups()/equipmentTypes() u.a. unten) - diese Listen sind nur der
// Startbestand für neue/bestehende Installationen.
const DEFAULT_MUSCLES = ['Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps', 'Unterarme', 'Quadrizeps', 'Beinbeuger', 'Gesäß', 'Waden', 'Bauch', 'Ganzkörper'];
const DEFAULT_EQUIPMENT = ['Langhantel', 'Kurzhantel', 'Maschine', 'Kabelzug', 'Körpergewicht', 'Kettlebell', 'Sonstiges'];

// ---------- Kardio: eigener Geräte-Bestand + Startplan ----------
// Kardio ist bewusst NICHT an einen Ort gebunden (anders als Krafttraining) -
// Laufen/Radfahren findet oft draußen statt, ist also nicht gym-spezifisch.
// Ebenso bewusst: "Aktivität" = "Gerät" (keine eigene Aktivitäten-Bibliothek) -
// ein Trainingstag wählt direkt ein Gerät, die Art des Trainings (Grundlagen-
// ausdauer, Intervalle, ...) steht im Namen des Trainingstags/Plans selbst.
// Deshalb kann der Startbestand hier - anders als bei Übungen/Plänen des
// Krafttrainings - direkt und ohne SEED_VERSION-Migration in DEFAULTS()
// vorbefüllt werden: die Felder existieren bei bestehenden Installationen noch
// gar nicht, db()'s Migrations-Backfill (unten) füllt sie beim nächsten Start
// einmalig automatisch nach, ohne echte Trainingsdaten anzurühren.
const DEFAULT_CARDIO_EQUIPMENT = ['Laufen (draußen)', 'Laufband', 'Radfahren (draußen)', 'Fahrrad-Ergometer', 'Rudergerät', 'Crosstrainer', 'Stairmaster', 'Schwimmen', 'Sonstiges'];
function buildCardioSeed() {
  const plan = { id: uid('cplan'), name: 'Ausdauer', emoji: '🏃', color: '#4cc9f0', createdAt: Date.now() };
  const mkDay = (name, emoji, color, items) => ({
    id: uid('cday'), planId: plan.id, name, emoji, color, order: 0,
    activities: items.map(([equipment, targetDurationMin, targetKm]) => ({ id: uid('cde'), equipment, targetDurationMin, targetKm: targetKm || '' })),
    createdAt: Date.now(),
  });
  const days = [
    mkDay('Grundlagenausdauer', '🏃', '#4cc9f0', [['Laufen (draußen)', 30, 5]]),
    mkDay('Intervalle', '⚡', '#ff6b6b', [['Laufband', 20, '']]),
    mkDay('Rudern & Rad', '🚣', '#46c98b', [['Rudergerät', 15, ''], ['Fahrrad-Ergometer', 20, '']]),
  ];
  days.forEach((d, i) => { d.order = i; });
  return { plan, days };
}

const DEFAULTS = () => {
  const cardioSeed = buildCardioSeed();
  return {
    version: 1,
    settings: {
      // Training
      defaultRestSec: 90, soundOnRestEnd: true, defaultSets: 3, defaultReps: 10,
      weekStart: 'mon', askPlanDiff: true, restNotifications: false,
      // Anzeige/Design
      tagColors: true, theme: 'dark', accentColor: '#6c8cff', fontSize: 'medium', reducedMotion: false,
      muscleColor: '#7dd3fc', equipColor: '#86efac', density: 'normal', cornerStyle: 'normal',
      // Daten
      backupReminderWeeks: 0, lastBackupAt: null, demoDataEnabled: false,
      // intern
      seedVersion: 0,
    },
    exercises: [],   // Bibliothek: {id,name,muscles[],equipment,notes,unit,createdAt}
    muscleGroups: DEFAULT_MUSCLES.map(name => ({ id: uid('mg'), name, createdAt: Date.now() })),   // {id,name,createdAt}
    equipmentTypes: DEFAULT_EQUIPMENT.map(name => ({ id: uid('eq'), name, createdAt: Date.now() })), // {id,name,createdAt}
    exerciseNotes: [], // Dauerhafte Geräte-/Einstellungs-Notiz je Übung UND Ort: {id,exerciseId,locationId,text,updatedAt}
    locations: [],   // Orte:        {id,name,emoji,color,createdAt}
    plans: [],       // Pläne:       {id,locationId,name,emoji,color,createdAt}
    days: [],        // Trainingstage:{id,planId,name,emoji,color,order,exercises:[{id,exerciseId,sets,reps,restSec,groupId}],createdAt}
    sessions: [],    // Einheiten:   {id,locationId,planId,dayId,dayName,date,startedAt,finishedAt,emoji,color,note,entries:[...],planSnapshot:[...]}
    trashExercises: [], // Papierkorb: gelöschte Übungen, {..exercise, deletedAt}
    trashSessions: [],  // Papierkorb: gelöschte/verworfene Trainings, {..session, deletedAt}
    // ---------- Kardio (kein Ort-Bezug, siehe Kommentar oben) ----------
    cardioEquipment: DEFAULT_CARDIO_EQUIPMENT.map(name => ({ id: uid('ceq'), name, createdAt: Date.now() })),
    cardioPlans: [cardioSeed.plan],           // {id,name,emoji,color,createdAt}
    cardioDays: cardioSeed.days,              // {id,planId,name,emoji,color,order,activities:[{id,equipment,targetDurationMin,targetKm}]}
    cardioSessions: [],                       // {id,planId,dayId,dayName,date,startedAt,finishedAt,emoji,color,note,entries:[...]} - immer direkt komplett angelegt, kein "laufendes Training"
    trashCardioSessions: [],
  };
};

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
// Prüft, ob bereits eine Übung mit identischem Name+Muskelgruppen+Gerät existiert
// (Notiz/Einheit zählen bewusst nicht mit) - für die Warnung beim Anlegen einer
// möglichen Doppel-Übung. excludeId beim Bearbeiten, damit sich eine Übung beim
// Speichern nicht selbst als Duplikat meldet.
export function findDuplicateExercise({ name, muscles, equipment }, excludeId = null) {
  const nameNorm = (name || '').trim().toLowerCase();
  const muscleSet = new Set(muscles || []);
  return db().exercises.find(e => {
    if (e.id === excludeId) return false;
    if (e.name.trim().toLowerCase() !== nameNorm) return false;
    if ((e.equipment || '') !== (equipment || '')) return false;
    const eMuscles = e.muscles || [];
    if (eMuscles.length !== muscleSet.size) return false;
    return eMuscles.every(mu => muscleSet.has(mu));
  }) || null;
}
// Verschiebt die Übung in den Papierkorb (Wiederherstellbar), statt sie
// endgültig zu löschen. Wird trotzdem aus allen Trainingstagen entfernt -
// eine Wiederherstellung bringt die Übung nur in die Bibliothek zurück,
// nicht automatisch in die Trainingstage, aus denen sie entfernt wurde.
export function deleteExercise(id) {
  const d = db();
  const ex = d.exercises.find(e => e.id === id);
  if (!ex) return;
  d.exercises = d.exercises.filter(e => e.id !== id);
  d.days.forEach(day => { day.exercises = day.exercises.filter(x => x.exerciseId !== id); });
  d.exerciseNotes = d.exerciseNotes.filter(n => n.exerciseId !== id);
  d.trashExercises.push({ ...ex, deletedAt: Date.now() });
  save();
}
export function trashedExercises() { return db().trashExercises.slice().sort((a, b) => b.deletedAt - a.deletedAt); }
export function restoreExercise(id) {
  const d = db();
  const ex = d.trashExercises.find(e => e.id === id);
  if (!ex) return null;
  d.trashExercises = d.trashExercises.filter(e => e.id !== id);
  const { deletedAt, ...restored } = ex;
  d.exercises.push(restored);
  save();
  return restored;
}
export function purgeTrashedExercise(id) {
  const d = db(); d.trashExercises = d.trashExercises.filter(e => e.id !== id); save();
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
    save();
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
    day.exercises.forEach(item => addExerciseToDay(newDay.id, item.exerciseId, { sets: item.sets, reps: item.reps, restSec: item.restSec, groupId: item.groupId || null }));
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
  const s = db().settings;
  const item = { id: uid('de'), exerciseId, sets: opts.sets ?? s.defaultSets, reps: opts.reps ?? s.defaultReps, restSec: opts.restSec ?? s.defaultRestSec, groupId: opts.groupId ?? null };
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

// ---------- Supersätze/Zirkel (mehrere Übungen zu einer Gruppe verbinden) ----------
// Gruppierte Übungen werden zu einem zusammenhängenden Block verschoben
// (in der ursprünglichen relativen Reihenfolge der Auswahl) - ein Zirkel
// muss lückenlos hintereinander stehen, sonst ergibt "keine Pause dazwischen"
// keinen Sinn.
// Kernlogik ohne save() (wird auch beim Übernehmen von Trainings-Diffs wiederverwendet).
function regroupContiguous(day, itemIds) {
  if (itemIds.length < 2) return null;
  const groupId = uid('grp');
  const idSet = new Set(itemIds);
  // Reihenfolge der Auswahl beibehalten (nicht die alte Listenreihenfolge)
  const selected = itemIds.map(id => day.exercises.find(x => x.id === id)).filter(Boolean);
  if (selected.length < 2) return null;
  selected.forEach(item => { item.groupId = groupId; });
  // Block an die Position des ersten ausgewählten Elements verschieben,
  // alle anderen Elemente behalten ihre relative Reihenfolge.
  const insertAt = day.exercises.findIndex(x => idSet.has(x.id));
  const others = day.exercises.filter(x => !idSet.has(x.id));
  const insertAtInOthers = day.exercises.slice(0, insertAt).filter(x => !idSet.has(x.id)).length;
  others.splice(insertAtInOthers, 0, ...selected);
  day.exercises = others;
  return groupId;
}
export function groupExercises(dayId, itemIds) {
  const day = getDay(dayId); if (!day) return;
  const groupId = regroupContiguous(day, itemIds);
  if (groupId) save();
  return groupId;
}
export function ungroupExercises(dayId, groupId) {
  const day = getDay(dayId); if (!day) return;
  day.exercises.forEach(x => { if (x.groupId === groupId) x.groupId = null; });
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
      groupId: item.groupId || null,
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
    planSnapshot: day.exercises.map(item => ({ exerciseId: item.exerciseId, sets: item.sets, reps: item.reps, restSec: item.restSec, groupId: item.groupId || null })),
  };
  db().sessions.push(s); save(); return s;
}
export function updateSession(id, patch) { const s = getSession(id); if (s) { Object.assign(s, patch); save(); } return s; }
// Verschiebt das Training in den Papierkorb, statt es endgültig zu löschen.
export function deleteSession(id) {
  const d = db();
  const s = d.sessions.find(x => x.id === id);
  if (!s) return;
  d.sessions = d.sessions.filter(x => x.id !== id);
  d.trashSessions.push({ ...s, deletedAt: Date.now() });
  save();
}
export function trashedSessions() { return db().trashSessions.slice().sort((a, b) => b.deletedAt - a.deletedAt); }
export function restoreSession(id) {
  const d = db();
  const s = d.trashSessions.find(x => x.id === id);
  if (!s) return null;
  d.trashSessions = d.trashSessions.filter(x => x.id !== id);
  const { deletedAt, ...restored } = s;
  d.sessions.push(restored);
  save();
  return restored;
}
export function purgeTrashedSession(id) {
  const d = db(); d.trashSessions = d.trashSessions.filter(x => x.id !== id); save();
}
export function emptyTrash() {
  const d = db();
  d.trashExercises = []; d.trashSessions = [];
  d.trashCardioSessions = [];
  save();
}

// ---------- Anpassungen während des Trainings zurück in den Plan übernehmen ----------
// Vergleicht den aktuellen Stand der Einheit mit dem Schnappschuss bei Trainingsstart
// und liefert einzeln auswählbare Änderungen (Pause/Sätze pro Übung, hinzugefügte/
// entfernte Übungen, Reihenfolge). Ohne planSnapshot oder gelöschten Trainingstag: keine Diffs.
// Wichtig: "hinzugefügt"/"Sätze geändert" hängen NICHT davon ab, ob im Training
// tatsächlich ein Satz abgehakt wurde - das Hinzufügen/Entfernen einer Übung oder
// eines Satzes über das "⋮"-Menü ist bereits eine explizite Handlung des Nutzers.
export function computeSessionPlanDiff(sessionId) {
  const s = getSession(sessionId);
  if (!s || !s.planSnapshot) return [];
  const day = getDay(s.dayId);
  if (!day) return [];
  const settings = db().settings;
  const snapMap = new Map(s.planSnapshot.map(x => [x.exerciseId, x]));
  const entryMap = new Map(s.entries.map(x => [x.exerciseId, x]));
  const diffs = [];
  for (const entry of s.entries) {
    const snap = snapMap.get(entry.exerciseId);
    if (!snap) {
      diffs.push({
        type: 'exerciseAdded', exerciseId: entry.exerciseId, name: entry.name,
        sets: (entry.sets || []).length || settings.defaultSets,
        reps: entry.targetReps || settings.defaultReps,
        restSec: entry.restSec ?? settings.defaultRestSec,
      });
      continue;
    }
    if (entry.restSec !== snap.restSec) {
      diffs.push({ type: 'restChanged', exerciseId: entry.exerciseId, name: entry.name, oldVal: snap.restSec, newVal: entry.restSec });
    }
    const setCount = (entry.sets || []).length;
    if (setCount !== snap.sets) {
      diffs.push({ type: 'setsChanged', exerciseId: entry.exerciseId, name: entry.name, oldVal: snap.sets, newVal: setCount });
    }
  }
  for (const snap of s.planSnapshot) {
    if (!entryMap.has(snap.exerciseId)) {
      const ex = getExercise(snap.exerciseId);
      diffs.push({ type: 'exerciseRemoved', exerciseId: snap.exerciseId, name: ex ? ex.name : '(Übung)' });
    }
  }
  // Reihenfolge: Vergleich der relativen Reihenfolge der Übungen, die in Plan UND
  // Training vorkommen (neu hinzugefügte/entfernte Übungen zählen dafür nicht extra,
  // die werden über die obigen Diffs abgedeckt).
  const commonInSnapOrder = s.planSnapshot.map(x => x.exerciseId).filter(id => entryMap.has(id));
  const commonSet = new Set(commonInSnapOrder);
  const commonInEntryOrder = s.entries.map(e => e.exerciseId).filter(id => commonSet.has(id));
  if (commonInSnapOrder.length > 1 && commonInSnapOrder.join('|') !== commonInEntryOrder.join('|')) {
    diffs.push({
      type: 'orderChanged',
      orderExerciseIds: s.entries.map(e => e.exerciseId),
      names: s.entries.map(e => e.name),
    });
  }
  // Zirkel/Supersätze: Gruppierungs-Struktur (welche Übungen ohne Pause zusammengehören)
  // zwischen Plan-Schnappschuss und aktuellem Trainingsstand vergleichen. Reine
  // Gruppen-Zusammensetzung zählt, nicht die konkrete groupId (die ist bei einer
  // neu erstellten Gruppe im Training ohnehin immer neu). Erkennung nur anhand der
  // Übungen, die es in BEIDEN Ständen gibt (fairer Vergleich) - zum Übernehmen wird
  // aber die volle aktuelle Gruppierung gespeichert, damit z.B. eine neu hinzugefügte
  // Übung, die direkt mit in den Zirkel aufgenommen wurde, nicht verloren geht.
  const groupsOf = (list, eligible) => {
    const map = new Map();
    list.forEach(x => {
      if (!eligible.has(x.exerciseId) || !x.groupId) return;
      if (!map.has(x.groupId)) map.set(x.groupId, []);
      map.get(x.groupId).push(x.exerciseId);
    });
    return Array.from(map.values()).filter(g => g.length > 1);
  };
  const normalize = groups => groups.map(g => g.slice().sort().join(',')).sort();
  const snapGroupsForCompare = groupsOf(s.planSnapshot, commonSet);
  const entryGroupsForCompare = groupsOf(s.entries, commonSet);
  if (JSON.stringify(normalize(snapGroupsForCompare)) !== JSON.stringify(normalize(entryGroupsForCompare))) {
    const allEntryIds = new Set(s.entries.map(e => e.exerciseId));
    const entryGroupsForApply = groupsOf(s.entries, allEntryIds);
    diffs.push({
      type: 'groupingChanged',
      groups: entryGroupsForApply,
      // Übungen, die VORHER gruppiert waren (auch wenn sie jetzt in keiner Gruppe
      // mehr sind) - werden beim Übernehmen mit gelöst, sonst bliebe eine im
      // Training komplett aufgelöste Gruppe im Plan unverändert bestehen.
      previousGroupedIds: snapGroupsForCompare.flat(),
      groupNames: entryGroupsForApply.map(g => g.map(exId => (entryMap.get(exId) || {}).name || '?')),
    });
  }
  return diffs;
}

// Wendet ausgewählte Diffs (aus computeSessionPlanDiff) auf den zugehörigen
// Trainingstag an (Plan-Vorlage). Nicht ausgewählte Änderungen gelten nur für
// diese eine Einheit. Reihenfolge unabhängig von der Auswahl-Reihenfolge der
// Checkboxen verarbeiten: erst hinzufügen/entfernen/anpassen, Reihenfolge zuletzt
// (sonst würde eine neu hinzugefügte Übung beim Sortieren evtl. noch fehlen).
const DIFF_PRIORITY = { exerciseRemoved: 0, exerciseAdded: 1, restChanged: 2, setsChanged: 2, orderChanged: 3, groupingChanged: 4 };
export function applyPlanDiffs(sessionId, changes) {
  const s = getSession(sessionId); if (!s) return { applied: 0 };
  const day = getDay(s.dayId); if (!day) return { applied: 0 };
  let applied = 0;
  const ordered = changes.slice().sort((a, b) => (DIFF_PRIORITY[a.type] ?? 9) - (DIFF_PRIORITY[b.type] ?? 9));
  ordered.forEach(ch => {
    if (ch.type === 'restChanged' || ch.type === 'setsChanged') {
      const item = day.exercises.find(x => x.exerciseId === ch.exerciseId);
      if (!item) return;
      if (ch.type === 'restChanged') item.restSec = ch.newVal;
      if (ch.type === 'setsChanged') item.sets = ch.newVal;
      applied++;
    } else if (ch.type === 'exerciseAdded') {
      if (!day.exercises.some(x => x.exerciseId === ch.exerciseId)) {
        day.exercises.push({ id: uid('de'), exerciseId: ch.exerciseId, sets: ch.sets, reps: ch.reps, restSec: ch.restSec, groupId: null });
        applied++;
      }
    } else if (ch.type === 'exerciseRemoved') {
      const before = day.exercises.length;
      day.exercises = day.exercises.filter(x => x.exerciseId !== ch.exerciseId);
      if (day.exercises.length !== before) applied++;
    } else if (ch.type === 'orderChanged') {
      const orderIds = ch.orderExerciseIds;
      day.exercises.sort((a, b) => {
        const ia = orderIds.indexOf(a.exerciseId), ib = orderIds.indexOf(b.exerciseId);
        if (ia === -1 && ib === -1) return 0;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
      applied++;
    } else if (ch.type === 'groupingChanged') {
      // Erst alle betroffenen Übungen aus ihrer bisherigen Gruppe lösen (auch die,
      // die jetzt in gar keiner Gruppe mehr sind), dann die neuen Gruppen (aus dem
      // Training) als zusammenhängende Blöcke neu bilden.
      const touchedExIds = new Set([...ch.groups.flat(), ...(ch.previousGroupedIds || [])]);
      day.exercises.forEach(it => { if (touchedExIds.has(it.exerciseId)) it.groupId = null; });
      ch.groups.forEach(exIds => {
        const itemIds = exIds.map(exId => day.exercises.find(it => it.exerciseId === exId)?.id).filter(Boolean);
        if (itemIds.length >= 2) regroupContiguous(day, itemIds);
      });
      applied++;
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
    if (!s.finishedAt) continue; // abgebrochene/laufende Einheiten liefern kein verlässliches "letztes Mal"
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
// Liefert je ABGESCHLOSSENER Einheit (chronologisch aufsteigend) aggregierte
// Kennzahlen. Optional auf einen Ort beschränkt -> getrennte Statistik je Gym.
// Läuft eine Einheit noch (nicht "beendet"), zählt sie hier noch nicht mit -
// konsistent mit den Gesamt-Statistiken, die dasselbe verlangen.
export function exerciseHistory(exerciseId, locationId = null) {
  const rows = [];
  for (const s of db().sessions) {
    if (!s.finishedAt) continue;
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

// Übungen, die an einem Ort tatsächlich trainiert wurden (abgehakte Sätze in
// ABGESCHLOSSENEN Einheiten - konsistent mit den anderen Statistik-Funktionen,
// ein laufendes/nicht beendetes Training zählt hier bewusst noch nicht mit).
export function exercisesTrainedAtLocation(locationId) {
  const ids = new Set();
  for (const s of db().sessions) {
    if (!s.finishedAt) continue;
    if (locationId && s.locationId !== locationId) continue;
    (s.entries || []).forEach(e => { if ((e.sets || []).some(isWorkingDone)) ids.add(e.exerciseId); });
  }
  return exercises().filter(e => ids.has(e.id));
}

// Gemeinsamer Zeitraum-Filter für die Gesamt-Übersicht + Muskelgruppen-Volumen auf
// der Statistik-Seite - EIN Umschalter (7/30 Tage/Alle) statt mehrerer unabhängiger,
// damit die Zahlen dort konsistent zum selben Zeitraum gehören. `periodDays` null
// bzw. 0 bedeutet "alle Zeit" (kein unterer Cutoff).
function periodCutoff(periodDays) {
  return periodDays ? Date.now() - periodDays * 86400000 : -Infinity;
}

// Trainingsvolumen je Muskelgruppe über den gewählten Zeitraum, optional auf einen
// Ort beschränkt. Zählt ABGEHAKTE SÄTZE (nicht Gewicht × Wdh.) je Muskelgruppe, die
// die jeweilige Übung als Tag trägt (eine Übung kann in mehrere einzahlen) - "Sätze
// pro Muskel pro Woche" ist die in der Trainingswissenschaft übliche Volumen-Einheit
// (Schoenfeld u.a.), weil Gewicht×Wdh. je nach Übung/Hebelverhältnis nicht vergleichbar
// ist (ein Satz Bizepscurls wiegt naturgemäß viel weniger als ein Satz Kniebeuge,
// sagt aber nichts darüber aus, welcher Muskel mehr Trainingsreiz bekommen hat).
export function muscleVolumeStats(locationId = null, periodDays = 7) {
  const cutoff = periodCutoff(periodDays);
  const totals = {};
  for (const s of db().sessions) {
    if (locationId && s.locationId !== locationId) continue;
    if (!s.finishedAt || s.finishedAt < cutoff) continue;
    for (const entry of s.entries || []) {
      const ex = getExercise(entry.exerciseId);
      if (!ex || !ex.muscles || !ex.muscles.length) continue;
      const doneSets = (entry.sets || []).filter(isWorkingDone).length;
      if (!doneSets) continue;
      ex.muscles.forEach(m => { totals[m] = (totals[m] || 0) + doneSets; });
    }
  }
  return Object.entries(totals).map(([muscle, sets]) => ({ muscle, sets })).sort((a, b) => b.sets - a.sets);
}

// ---------- Gesamt-Statistik (übungsübergreifend, je Ort) ----------
// Gesamt-Trainingsvolumen je abgeschlossener Einheit (alle Übungen zusammen),
// chronologisch aufsteigend - für den Gesamt-Trend-Chart auf der Statistik-Seite.
// Bewusst NICHT auf den Zeitraum-Filter beschränkt (zeigt den Trend über die
// letzten `limit` Einheiten, unabhängig vom 7/30-Tage/Alle-Umschalter).
export function overallVolumeHistory(locationId = null, limit = 26) {
  const rows = [];
  for (const s of db().sessions) {
    if (locationId && s.locationId !== locationId) continue;
    if (!s.finishedAt) continue;
    let volume = 0, setCount = 0;
    (s.entries || []).forEach(e => (e.sets || []).forEach(set => {
      if (isWorkingDone(set)) { volume += num(set.weight) * num(set.reps); setCount++; }
    }));
    if (!setCount) continue;
    rows.push({ sessionId: s.id, date: s.date, startedAt: s.startedAt || 0, volume: Math.round(volume), setCount });
  }
  rows.sort((a, b) => a.startedAt - b.startedAt);
  return rows.slice(-limit);
}

// Anzahl abgeschlossener Einheiten im gewählten Zeitraum (Gegenstück zur
// All-Time-Zahl "Trainings gesamt" auf der Statistik-Seite).
export function sessionCountInPeriod(locationId = null, periodDays = null) {
  const cutoff = periodCutoff(periodDays);
  return db().sessions.filter(s => s.finishedAt && s.finishedAt >= cutoff && (!locationId || s.locationId === locationId)).length;
}

// Meisttrainierte Übungen nach Häufigkeit (Anzahl Einheiten mit abgehaktem Satz)
// im gewählten Zeitraum.
export function topExercisesByFrequency(locationId = null, periodDays = null, limit = 5) {
  const cutoff = periodCutoff(periodDays);
  const counts = new Map();
  for (const s of db().sessions) {
    if (locationId && s.locationId !== locationId) continue;
    if (!s.finishedAt || s.finishedAt < cutoff) continue;
    (s.entries || []).forEach(e => {
      if ((e.sets || []).some(isWorkingDone)) counts.set(e.exerciseId, (counts.get(e.exerciseId) || 0) + 1);
    });
  }
  return Array.from(counts.entries())
    .map(([exerciseId, count]) => ({ exerciseId, name: (getExercise(exerciseId) || {}).name || '(gelöscht)', count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// Trend der Muskelgruppen-Sätze über die Zeit (alle Muskelgruppen zusammen, je Woche) -
// ergänzt die Momentaufnahme aus muscleVolumeStats() um eine Entwicklung über mehrere
// Wochen (nimmt/steigt das Trainingsvolumen zu oder ab).
export function weeklySetsTrend(locationId = null, weeks = 10) {
  const now = Date.now();
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = now - (i + 1) * 7 * 86400000;
    const end = now - i * 7 * 86400000;
    let sets = 0;
    for (const s of db().sessions) {
      if (locationId && s.locationId !== locationId) continue;
      if (!s.finishedAt || s.finishedAt < start || s.finishedAt >= end) continue;
      (s.entries || []).forEach(e => { sets += (e.sets || []).filter(isWorkingDone).length; });
    }
    buckets.push({ weekEndTs: end, sets });
  }
  return buckets;
}

// Datum des letzten ABGESCHLOSSENEN Trainings mit dieser Übung (für die "Zuletzt
// trainiert"-Anzeige in der Übungsbibliothek) - ortübergreifend, da die Bibliothek
// selbst ortübergreifend ist (nur ein Datum, keine ortsabhängigen Gewichtswerte).
export function lastTrainedDate(exerciseId) {
  let latest = null;
  for (const s of db().sessions) {
    if (!s.finishedAt) continue;
    const hit = (s.entries || []).some(e => e.exerciseId === exerciseId && (e.sets || []).some(isWorkingDone));
    if (hit && (!latest || s.finishedAt > latest.finishedAt)) latest = s;
  }
  return latest ? latest.date : null;
}

// ---------- Beispieldaten (Testdaten für die Statistik, in Einstellungen an/abschaltbar) ----------
// Erzeugt ca. 2 Monate plausibler, abgeschlossener Trainingseinheiten am angegebenen Ort,
// basierend auf dessen TATSÄCHLICHEN Plänen/Trainingstagen (damit Übungs-/Muskelgruppen-
// Statistik realistisch befüllt wird). Leicht ansteigende Gewichte simulieren Fortschritt,
// vereinzelt ausgelassene Termine wirken weniger künstlich. Klar als `demo: true` markiert,
// damit sie jederzeit sauber wieder entfernbar sind, ohne echte Trainingsdaten anzurühren.
export function generateDemoSessions(locationId) {
  const loc = getLocation(locationId); if (!loc) return 0;
  const days = plansByLocation(locationId).flatMap(p => daysByPlan(p.id)).filter(d => d.exercises.length);
  if (!days.length) return 0;
  const now = Date.now();
  const totalDays = 60;
  let dayIdx = 0, count = 0;
  for (let daysAgo = totalDays; daysAgo >= 0; daysAgo -= 2) {
    if (Math.random() < 0.15) continue; // vereinzelt ausgelassene Einheiten
    const day = days[dayIdx % days.length];
    dayIdx++;
    const ts = now - daysAgo * 86400000;
    const d = new Date(ts);
    const dateISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const progress = (totalDays - daysAgo) / totalDays; // 0..1 über den Zeitraum
    const entries = day.exercises.map(item => {
      const ex = getExercise(item.exerciseId);
      const isBodyweight = ex?.equipment === 'Körpergewicht';
      const baseWeight = 20 + Math.random() * 40;
      const sets = [];
      for (let i = 0; i < item.sets; i++) {
        // Körpergewichtsübungen realistisch ohne Zusatzgewicht abbilden (kein
        // erfundenes Gewicht) - Fortschritt zeigt sich hier stattdessen über
        // mehr Wiederholungen im Zeitverlauf.
        const r = isBodyweight
          ? Math.max(1, Math.round(item.reps * (1 + progress * 0.25) + (Math.random() * 4 - 2)))
          : Math.max(1, Math.round(item.reps + (Math.random() * 4 - 2)));
        if (isBodyweight) { sets.push({ weight: '', reps: r, done: true }); continue; }
        const w = Math.round((baseWeight * (1 + progress * 0.15) + (Math.random() * 4 - 2)) * 2) / 2;
        sets.push({ weight: Math.max(2.5, w), reps: r, done: true });
      }
      return {
        exerciseId: item.exerciseId, name: ex ? ex.name : 'Übung', unit: ex?.unit || 'kg',
        targetReps: item.reps, targetSets: item.sets, restSec: item.restSec, groupId: item.groupId || null, sets,
      };
    });
    db().sessions.push({
      id: uid('ses'), locationId, planId: day.planId, dayId: day.id, dayName: day.name,
      date: dateISO, startedAt: ts, finishedAt: ts + 45 * 60000,
      emoji: day.emoji, color: day.color, note: '', entries,
      planSnapshot: day.exercises.map(item => ({ exerciseId: item.exerciseId, sets: item.sets, reps: item.reps, restSec: item.restSec, groupId: item.groupId || null })),
      demo: true,
    });
    count++;
  }
  save();
  return count;
}
export function removeDemoSessions(locationId = null) {
  const d = db();
  d.sessions = d.sessions.filter(s => !(s.demo && (!locationId || s.locationId === locationId)));
  save();
}
export function hasDemoSessions(locationId = null) {
  return db().sessions.some(s => s.demo && (!locationId || s.locationId === locationId));
}

// Entfernt NUR die aufgezeichneten Trainingseinheiten (Kraft UND Kardio, inkl.
// Papierkorb-Einheiten und Beispieldaten) - Orte/Pläne/Trainingstage/
// Übungsbibliothek/Kardio-Aktivitäten bleiben unangetastet.
export function wipeSessions() {
  const d = db();
  d.sessions = [];
  d.trashSessions = [];
  d.cardioSessions = [];
  d.trashCardioSessions = [];
  d.settings.demoDataEnabled = false;
  save();
}

// Einfache Suche über Pläne, Trainingstage, Übungen und vergangene Trainings hinweg.
export function globalSearch(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return { plans: [], days: [], exercises: [], sessions: [] };
  const d = db();
  return {
    plans: d.plans.filter(p => p.name.toLowerCase().includes(q)),
    days: d.days.filter(day => day.name.toLowerCase().includes(q)),
    exercises: d.exercises.filter(e => e.name.toLowerCase().includes(q)),
    sessions: d.sessions.filter(s => (s.dayName || '').toLowerCase().includes(q)).slice(0, 20),
  };
}

// ---------- Kalender ----------
// Map: 'YYYY-MM-DD' -> [ {emoji,color,name,sessionId} ... ]
// Nur ABGESCHLOSSENE Einheiten (konsistent mit allen anderen Statistik-Funktionen
// hier - ein laufendes/nicht beendetes Training soll weder den Kalender-Punkt noch
// Streak/Monatszahl beeinflussen, sonst könnte man beides durch bloßes Starten
// ohne Beenden künstlich aufblähen).
export function sessionsByDate() {
  const map = {};
  for (const s of db().sessions) {
    if (!s.finishedAt) continue;
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
    const d = DEFAULTS();
    store = Object.assign(d, incoming);
    // Settings einzeln zusammenführen (nicht komplett ersetzen) - ein älteres
    // Backup ohne neuere Einstellungs-Felder soll dafür sinnvolle Defaults
    // bekommen statt überall undefined (gleiche Logik wie in db()).
    store.settings = Object.assign(d.settings, incoming.settings || {});
  } else { // merge
    const d = db();
    ['exercises', 'locations', 'plans', 'days', 'sessions', 'trashExercises', 'trashSessions',
      'cardioPlans', 'cardioDays', 'cardioSessions', 'trashCardioSessions'].forEach(k => {
      const existing = new Set(d[k].map(x => x.id));
      (incoming[k] || []).forEach(x => { if (!existing.has(x.id)) d[k].push(x); });
    });
    // Muskelgruppen/Geräte-Arten (Kraft + Kardio) nach Name deduplizieren (nicht
    // nach id) - sonst könnten z.B. zwei "Brust"-Einträge mit unterschiedlicher
    // id entstehen.
    ['muscleGroups', 'equipmentTypes', 'cardioEquipment'].forEach(k => {
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

// ============================================================
//  Kardio-Modul - separates System, KEIN Ort-Bezug (siehe Kommentar bei
//  DEFAULT_CARDIO_EQUIPMENT oben). "Aktivität" = "Gerät" (keine eigene
//  Aktivitäten-Bibliothek): ein Trainingstag wählt Geräte direkt, die Art des
//  Trainings (Grundlagenausdauer, Intervalle, ...) steht im Namen des
//  Trainingstags/Plans. Keine "laufende Trainingsfunktion" wie beim
//  Krafttraining: Werte werden in einem Formular eingetragen und mit einem
//  Speichern-Schritt direkt als abgeschlossene Einheit angelegt - es gibt
//  keinen "unfertigen"/pausierten Zwischenzustand, der irgendwo hängen bleiben
//  könnte. Kennzahlen je Eintrag: Herzfrequenz, Zone, Dauer, Distanz (daraus
//  Pace/Geschwindigkeit berechnet), Stufe, Kalorien, Watt, Höhenmeter - alle
//  optional, werden aber immer alle angezeigt.
// ============================================================

// ---------- Kardio-Geräte-Arten (zugleich die "Aktivitäten") ----------
export function cardioEquipmentTypes() { return db().cardioEquipment.slice().sort((a, b) => a.name.localeCompare(b.name, 'de')); }
export function getCardioEquipmentType(id) { return db().cardioEquipment.find(e => e.id === id) || null; }
export function addCardioEquipment(name) {
  const eq = { id: uid('ceq'), name, createdAt: Date.now() };
  db().cardioEquipment.push(eq); save(); return eq;
}
export function renameCardioEquipment(id, newName) {
  const d = db();
  const eq = d.cardioEquipment.find(e => e.id === id); if (!eq) return;
  const oldName = eq.name; eq.name = newName;
  d.cardioDays.forEach(day => day.activities.forEach(a => { if (a.equipment === oldName) a.equipment = newName; }));
  d.cardioSessions.forEach(s => (s.entries || []).forEach(e => { if (e.equipment === oldName) e.equipment = newName; }));
  save();
}
export function deleteCardioEquipment(id) {
  const d = db();
  const eq = d.cardioEquipment.find(e => e.id === id); if (!eq) return;
  d.cardioEquipment = d.cardioEquipment.filter(e => e.id !== id);
  d.cardioDays.forEach(day => { day.activities = day.activities.filter(a => a.equipment !== eq.name); });
  save();
}
// Zählt, wie oft ein Gerät tatsächlich trainiert wurde (für die Löschwarnung) -
// nicht nur strukturell in Trainingstagen verplant.
export function cardioEquipmentUsage(id) {
  const eq = getCardioEquipmentType(id); if (!eq) return 0;
  return db().cardioSessions.filter(s => (s.entries || []).some(e => e.equipment === eq.name)).length;
}

// ---------- Kardio-Pläne / -Trainingstage ----------
export function cardioPlans() { return db().cardioPlans.slice(); }
export function getCardioPlan(id) { return db().cardioPlans.find(p => p.id === id) || null; }
export function addCardioPlan(data) {
  const p = { id: uid('cplan'), name: '', emoji: '🏃', color: '#4cc9f0', createdAt: Date.now(), ...data };
  db().cardioPlans.push(p); save(); return p;
}
export function updateCardioPlan(id, patch) { const p = getCardioPlan(id); if (p) { Object.assign(p, patch); save(); } return p; }
export function deleteCardioPlan(id) {
  const d = db();
  d.cardioDays = d.cardioDays.filter(day => day.planId !== id);
  d.cardioPlans = d.cardioPlans.filter(p => p.id !== id);
  save();
}

export function cardioDaysByPlan(planId) {
  return db().cardioDays.filter(day => day.planId === planId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
export function getCardioDay(id) { return db().cardioDays.find(day => day.id === id) || null; }
export function addCardioDay(data) {
  const order = cardioDaysByPlan(data.planId).length;
  const day = { id: uid('cday'), planId: null, name: '', emoji: '🏃', color: '#4cc9f0', order, activities: [], createdAt: Date.now(), ...data };
  db().cardioDays.push(day); save(); return day;
}
export function updateCardioDay(id, patch) { const day = getCardioDay(id); if (day) { Object.assign(day, patch); save(); } return day; }
export function deleteCardioDay(id) { const d = db(); d.cardioDays = d.cardioDays.filter(day => day.id !== id); save(); }
export function reorderCardioDays(planId, orderedIds) {
  orderedIds.forEach((id, i) => { const day = getCardioDay(id); if (day) day.order = i; });
  save();
}

// item.equipment ist der Gerätename (Klartext-String, wie equipment bei
// Kraftübungen) - kein id-Zwischenschritt nötig, da Aktivität = Gerät.
export function addEquipmentToCardioDay(dayId, equipment, opts = {}) {
  const day = getCardioDay(dayId); if (!day) return;
  const item = { id: uid('cde'), equipment, targetDurationMin: opts.targetDurationMin ?? '', targetKm: opts.targetKm ?? '' };
  day.activities.push(item); save(); return item;
}
export function updateCardioDayActivity(dayId, itemId, patch) {
  const day = getCardioDay(dayId); if (!day) return;
  const it = day.activities.find(x => x.id === itemId); if (it) { Object.assign(it, patch); save(); }
  return it;
}
export function removeCardioDayActivity(dayId, itemId) {
  const day = getCardioDay(dayId); if (!day) return;
  day.activities = day.activities.filter(x => x.id !== itemId); save();
}
// Einfaches Verschieben (rauf/runter) statt der komplexeren Zirkel-Mehrfachauswahl
// beim Krafttraining - Kardio-Tage kombinieren i.d.R. nur 1-2 Geräte.
export function moveCardioDayActivity(dayId, itemId, dir) {
  const day = getCardioDay(dayId); if (!day) return;
  const i = day.activities.findIndex(x => x.id === itemId); if (i < 0) return;
  const j = i + dir; if (j < 0 || j >= day.activities.length) return;
  [day.activities[i], day.activities[j]] = [day.activities[j], day.activities[i]];
  save();
}

// ---------- Kardio-Einheiten (Sessions) ----------
// Kein Start/Beenden-Lebenszyklus: logCardioSession() legt eine bereits
// VOLLSTÄNDIGE, abgeschlossene Einheit an (finishedAt wird sofort gesetzt) -
// es gibt keinen Zwischenzustand, der als "läuft noch" irgendwo hängen bleiben
// könnte. Werte werden vorher nur im Formular (nicht in der DB) gehalten.
export function cardioSessions() {
  return db().cardioSessions.slice().sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
}
export function getCardioSession(id) { return db().cardioSessions.find(s => s.id === id) || null; }
// Baut ein leeres Eintragsformular-Grundgerüst aus den Geräten/Zielwerten eines
// Trainingstags - wird NICHT gespeichert, nur als Vorlage für die Eingabemaske
// verwendet (siehe Kommentar oben: kein "laufendes Training" in der DB).
export function cardioEntryTemplate(dayId) {
  const day = getCardioDay(dayId); if (!day) return null;
  return day.activities.map(item => ({
    equipment: item.equipment, targetDurationMin: item.targetDurationMin, targetKm: item.targetKm,
    heartRate: '', zone: '', durationMin: '', km: '', level: '', calories: '', watt: '', elevationM: '',
  }));
}
export function logCardioSession(dayId, { date, note, entries }) {
  const day = getCardioDay(dayId); if (!day) return null;
  const plan = getCardioPlan(day.planId);
  const now = Date.now();
  const s = {
    id: uid('cses'),
    planId: plan ? plan.id : null,
    dayId: day.id,
    dayName: day.name,
    date: date || todayISO(),
    startedAt: now,
    finishedAt: now,
    emoji: day.emoji || plan?.emoji || '🏃',
    color: day.color || plan?.color || '#4cc9f0',
    note: note || '',
    entries,
  };
  db().cardioSessions.push(s); save(); return s;
}
export function updateCardioSession(id, patch) { const s = getCardioSession(id); if (s) { Object.assign(s, patch); save(); } return s; }
export function deleteCardioSession(id) {
  const d = db();
  const s = d.cardioSessions.find(x => x.id === id); if (!s) return;
  d.cardioSessions = d.cardioSessions.filter(x => x.id !== id);
  d.trashCardioSessions.push({ ...s, deletedAt: Date.now() });
  save();
}
export function cardioSessionsByDay(dayId) { return cardioSessions().filter(s => s.dayId === dayId); }
export function cardioSessionsByPlan(planId) { return cardioSessions().filter(s => s.planId === planId); }
export function trashedCardioSessions() { return db().trashCardioSessions.slice().sort((a, b) => b.deletedAt - a.deletedAt); }
export function restoreCardioSession(id) {
  const d = db();
  const s = d.trashCardioSessions.find(x => x.id === id); if (!s) return null;
  d.trashCardioSessions = d.trashCardioSessions.filter(x => x.id !== id);
  const { deletedAt, ...restored } = s;
  d.cardioSessions.push(restored); save(); return restored;
}
export function purgeTrashedCardioSession(id) {
  const d = db(); d.trashCardioSessions = d.trashCardioSessions.filter(x => x.id !== id); save();
}

// Ein Eintrag zählt als "erledigt", wenn Dauer oder Distanz eingetragen wurde -
// Kardio hat kein Abhak-Konzept wie einzelne Kraft-Sätze, sondern wird als eine
// zusammenhängende Einheit erfasst.
export function isCardioEntryDone(entry) {
  return num(entry.durationMin) > 0 || num(entry.km) > 0;
}

// ---------- Kardio-Statistik ----------
// Pace (Minuten/km) und Geschwindigkeit (km/h) werden aus Dauer+Distanz berechnet,
// nicht gespeichert - analog zu e1RM beim Krafttraining (aus Gewicht+Wdh. berechnet).
function cardioRowsFromSessions(sessionList, entryFilter = () => true) {
  const rows = [];
  for (const s of sessionList) {
    if (!s.finishedAt) continue;
    (s.entries || []).filter(e => entryFilter(e) && isCardioEntryDone(e)).forEach(e => {
      const durationMin = num(e.durationMin), km = num(e.km);
      rows.push({
        sessionId: s.id, date: s.date, startedAt: s.startedAt || 0, equipment: e.equipment,
        heartRate: num(e.heartRate), zone: num(e.zone), durationMin, km,
        paceMinPerKm: (durationMin > 0 && km > 0) ? durationMin / km : 0,
        speedKmh: (durationMin > 0 && km > 0) ? km / (durationMin / 60) : 0,
        level: num(e.level), calories: num(e.calories), watt: num(e.watt), elevationM: num(e.elevationM),
      });
    });
  }
  rows.sort((a, b) => a.startedAt - b.startedAt);
  return rows;
}
function cardioStatsFromRows(rows) {
  const stat = { sessionsCount: rows.length, totalMinutes: 0, maxKm: 0, longestMin: 0, bestPace: 0, maxWatt: 0 };
  rows.forEach(r => {
    stat.totalMinutes += r.durationMin;
    if (r.km > stat.maxKm) stat.maxKm = r.km;
    if (r.durationMin > stat.longestMin) stat.longestMin = r.durationMin;
    if (r.paceMinPerKm > 0 && (stat.bestPace === 0 || r.paceMinPerKm < stat.bestPace)) stat.bestPace = r.paceMinPerKm;
    if (r.watt > stat.maxWatt) stat.maxWatt = r.watt;
  });
  stat.totalMinutes = Math.round(stat.totalMinutes);
  return stat;
}
// Verlauf/Statistik je GERÄT, über alle Pläne/Tage hinweg (z.B. "wie hat sich
// meine Pace auf dem Laufband insgesamt entwickelt").
export function cardioHistoryByEquipment(equipment, limit = 200) {
  return cardioRowsFromSessions(db().cardioSessions, e => e.equipment === equipment).slice(-limit);
}
export function cardioEquipmentStats(equipment) { return cardioStatsFromRows(cardioHistoryByEquipment(equipment)); }
// Verlauf/Statistik je TRAININGSTAG (zusätzlich zur Geräte-Sicht) - alle
// Einheiten, die je an diesem Tag geloggt wurden.
export function cardioHistoryByDay(dayId, limit = 200) {
  return cardioRowsFromSessions(cardioSessionsByDay(dayId)).slice(-limit);
}
export function cardioDayStats(dayId) { return cardioStatsFromRows(cardioHistoryByDay(dayId)); }
// Verlauf/Statistik je PLAN (zusätzlich zur Geräte-/Tag-Sicht) - alle
// Einheiten aus allen Trainingstagen dieses Plans zusammen.
export function cardioHistoryByPlan(planId, limit = 200) {
  return cardioRowsFromSessions(cardioSessionsByPlan(planId)).slice(-limit);
}
export function cardioPlanStats(planId) { return cardioStatsFromRows(cardioHistoryByPlan(planId)); }

export function cardioSessionCountInPeriod(periodDays = null) {
  const cutoff = periodCutoff(periodDays);
  return db().cardioSessions.filter(s => s.finishedAt && s.finishedAt >= cutoff).length;
}
export function weeklyCardioMinutesTrend(weeks = 10) {
  const now = Date.now();
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = now - (i + 1) * 7 * 86400000;
    const end = now - i * 7 * 86400000;
    let minutes = 0;
    for (const s of db().cardioSessions) {
      if (!s.finishedAt || s.finishedAt < start || s.finishedAt >= end) continue;
      (s.entries || []).forEach(e => { if (isCardioEntryDone(e)) minutes += num(e.durationMin); });
    }
    buckets.push({ weekEndTs: end, minutes: Math.round(minutes) });
  }
  return buckets;
}
export function topCardioEquipmentByFrequency(periodDays = null, limit = 5) {
  const cutoff = periodCutoff(periodDays);
  const counts = new Map();
  for (const s of db().cardioSessions) {
    if (!s.finishedAt || s.finishedAt < cutoff) continue;
    (s.entries || []).forEach(e => { if (isCardioEntryDone(e)) counts.set(e.equipment, (counts.get(e.equipment) || 0) + 1); });
  }
  return Array.from(counts.entries())
    .map(([equipment, count]) => ({ equipment, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ---------- Kardio-Beispieldaten (analog generateDemoSessions, ortsunabhängig) ----------
export function generateCardioDemoSessions() {
  const days = cardioPlans().flatMap(p => cardioDaysByPlan(p.id)).filter(d => d.activities.length);
  if (!days.length) return 0;
  const now = Date.now();
  const totalDays = 60;
  let dayIdx = 0, count = 0;
  for (let daysAgo = totalDays; daysAgo >= 0; daysAgo -= 3) {
    if (Math.random() < 0.15) continue; // vereinzelt ausgelassene Einheiten
    const day = days[dayIdx % days.length];
    dayIdx++;
    const ts = now - daysAgo * 86400000;
    const d = new Date(ts);
    const dateISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const progress = (totalDays - daysAgo) / totalDays;
    const entries = day.activities.map(item => {
      const equip = item.equipment;
      const targetMin = num(item.targetDurationMin) || 25;
      const durationMin = Math.max(5, Math.round(targetMin * (1 + progress * 0.1) + (Math.random() * 6 - 3)));
      const isDistanceBased = /Laufen|Laufband|Rad/.test(equip);
      const km = isDistanceBased ? Math.round(durationMin / (6.2 - progress * 0.8) * 10) / 10 : '';
      const isPowerBased = /Ergometer|Rudergerät/.test(equip);
      return {
        equipment: equip, targetDurationMin: item.targetDurationMin, targetKm: item.targetKm,
        heartRate: 118 + Math.round(Math.random() * 42), zone: 2 + Math.round(Math.random() * 2),
        durationMin, km,
        level: equip === 'Fahrrad-Ergometer' ? 8 + Math.round(Math.random() * 6) : '',
        calories: Math.round(durationMin * 9), watt: isPowerBased ? 100 + Math.round(Math.random() * 80) : '',
        elevationM: '',
      };
    });
    db().cardioSessions.push({
      id: uid('cses'), planId: day.planId, dayId: day.id, dayName: day.name,
      date: dateISO, startedAt: ts, finishedAt: ts + ((entries[0]?.durationMin || 30) + 5) * 60000,
      emoji: day.emoji, color: day.color, note: '', entries, demo: true,
    });
    count++;
  }
  save();
  return count;
}
export function removeCardioDemoSessions() {
  const d = db(); d.cardioSessions = d.cardioSessions.filter(s => !s.demo); save();
}
export function hasCardioDemoSessions() { return db().cardioSessions.some(s => s.demo); }

// ---------- Datum ----------
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
