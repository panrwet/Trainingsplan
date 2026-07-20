# 🏋️ Trainingsplan – Krafttraining Tracker

Eine kleine, **im Browser lauffähige** App zum Aufzeichnen von Krafttraining.
Läuft komplett **lokal & offline** (PWA), ohne Server und ohne Login – installierbar aufs Handy.

## Funktionen

- **Übungsbibliothek** – ~48 vorbefüllte Übungen (Name, Muskelgruppen, Gerät, Notiz), **filterbar nach Muskelgruppe und Gerät** (kombinierbar mit Suche). Ortübergreifend gemeinsam nutzbar – jedes Gym hat z. B. eine Brustpresse, die Übung muss nicht pro Ort neu angelegt werden.
- **Geräte-Arten selbst verwalten** – über „⚙️ Geräte" in der Bibliothek eigene Geräte-Arten anlegen/umbenennen/löschen (z. B. „Kettlebell", „Widerstandsband"). Umbenennen aktualisiert alle betroffenen Übungen automatisch, Löschen entfernt nur das Tag (Übung bleibt erhalten). Beim Taggen einer Übung geht's auch direkt per „+ Neu"-Chip.
- **Hierarchie:** **Ort** (z. B. Sports Club Kiel, Zuhause) → **Trainingsplan** → **Trainingstag** → **Übungen**
- **Orte oben als Reiter** – der aktive Ort filtert die ganze App. **Statistik, „letztes Mal" und Verlauf sind je Ort getrennt**, weil Geräte zwischen Gyms nicht vergleichbar sind (z. B. Brustpresse 80 kg in Gym A ≙ 50 kg in Gym B). Das Orts-Kürzel steht klein neben Plan/Trainingstag/Übung.
- **Plan in ein anderes Gym übernehmen** – ein Trainingsplan (inkl. aller Trainingstage & Zielwerte) lässt sich per Knopfdruck als unabhängige Kopie an einen anderen Ort kopieren, da das Kerntraining ja gleich bleibt. Original und Kopie sind danach getrennt frei änderbar.
- **Training aufzeichnen** – Gewicht & Wiederholungen je Satz eingeben, als Platzhalter direkt der letzte Wert (je Ort).
- **Sätze, Pausen & Übungen anpassbar** – beim Erstellen des Plans **und** während des Trainings. Nach dem Training wird **je Änderung einzeln gefragt**, ob sie in den Trainingsplan übernommen werden soll (z. B. neue Pausenzeit, mehr/weniger Sätze, hinzugefügte/entfernte Übung) – oder nur für diese eine Einheit gilt.
- **Pausen-Timer** – Countdown nach jedem abgehakten Satz (mit Ton/Vibration).
- **Notizen** je Trainingseinheit.
- **Statistiken je Übung** – geschätztes 1RM (Epley), max. Gewicht, Volumen, persönliche Rekorde und ein Verlaufs-Chart, je Ort getrennt.
- **Kalender / Habit-Tracker** – jeder Trainingstag & Plan bekommt ein **Kürzel oder Emoji**, das im Monatskalender erscheint. Plus Wochen-Streak.
- **Backup** – Export/Import als JSON-Datei.

## Warum diese Statistiken?

Für Krafttraining sind das die aussagekräftigsten Kennzahlen:

- **Geschätztes 1RM (Epley: `Gewicht × (1 + Wdh/30)`)** – der beste Einzelindikator für Kraftfortschritt, unabhängig vom Wiederholungsbereich.
- **Max. Gewicht** – klassischer Fortschrittsmarker.
- **Volumen (Sätze × Wdh × Gewicht)** – Indikator für Trainingsreiz/Arbeitsumfang.
- **Persönliche Rekorde & Häufigkeit** – Motivation und Übersicht.

## Wie & wo werden die Daten gespeichert?

- Alles wird **lokal im Browser** gespeichert (`localStorage`). **Kein Server, keine Cloud, kein Konto.**
- Vorteil: funktioniert **offline** (wichtig im Gym), Daten bleiben privat auf dem Gerät.
- Nachteil: Daten hängen an **diesem Browser/Gerät**. Deshalb gibt es **Export/Import** unter *Einstellungen → Daten & Backup*. Mach regelmäßig ein Backup.
- Ein späterer optionaler Cloud-Sync wäre möglich, ist aber bewusst nicht eingebaut (Aufwand/Datenschutz).

## Sofort testen – ohne Server (einfachster Weg)

Die Datei **`standalone.html`** enthält die komplette App in einer einzigen Datei.

1. In GitHub auf `standalone.html` klicken → **„Download raw file"** (Download-Symbol).
2. Die heruntergeladene Datei per **Doppelklick** im Browser öffnen.

Fertig – kein Server, keine Installation. Die Daten werden im Browser gespeichert.
Direkt beim ersten Start ist bereits **„Sports Club Kiel"** mit einem
Push/Pull/Legs-Plan und einer ausführlichen Übungsbibliothek angelegt (siehe unten).

> `standalone.html` wird aus den Quelldateien erzeugt: `node build-standalone.mjs`.
> Hinweis: Auf `file://` ist die App nicht „installierbar" und nicht offline-cachend
> (dafür die Server-/Pages-Variante unten nutzen).

## Als richtige App / mit Webserver

Für PWA-Installation (aufs Handy) und Offline-Cache über einen kleinen Webserver
starten (Service Worker & ES-Module brauchen `http://`, nicht `file://`):

```bash
# Variante 1: Python
python3 -m http.server 8000
# Variante 2: Node
npx serve .
```

Dann im Browser `http://localhost:8000` öffnen.

### Auf dem iPhone/Android installieren (GitHub Pages)

Ein GitHub-Actions-Workflow (`.github/workflows/deploy-pages.yml`) deployt die App
automatisch. **Voraussetzung: das Repository ist öffentlich** (Pages für private
Repos braucht einen kostenpflichtigen Plan).

1. Repo **öffentlich** schalten (Settings → General → Danger Zone → *Change visibility*).
2. Der Workflow läuft beim nächsten Push (oder unter *Actions → Deploy to GitHub Pages → Run workflow*).
3. Die Seite ist dann unter `https://panrwet.github.io/Trainingsplan/` erreichbar.
4. **iPhone (Safari):** Seite öffnen → Teilen-Symbol → **„Zum Home-Bildschirm"**.
   **Android (Chrome):** Menü → **„App installieren"** / „Zum Startbildschirm".

Danach läuft die App im Vollbild wie eine native App und funktioniert offline.

### Hinweise für iPhone (iOS/Safari)

- **Als Home-Bildschirm-App installieren** – nur dann speichert iOS die Daten dauerhaft.
  Im normalen Safari-Tab löscht iOS lokale Daten nach 7 Tagen ohne Nutzung.
- **Ton am Pausenende** funktioniert, sobald die App einmal angetippt wurde
  (iOS schaltet Audio erst nach einer Nutzer-Geste frei – ist eingebaut).
- **Vibration** unterstützt iOS-Safari generell nicht (nur Android). Der sichtbare
  Countdown läuft trotzdem.
- Mach in jedem Fall regelmäßig ein **Backup** (*Einstellungen → Export*).

## Erste Schritte

Direkt nach dem ersten Start ist bereits alles startklar:
**Sports Club Kiel** (Ort) → **Push Pull Legs** (Plan) → **Push / Pull / Legs** (Trainingstage),
je mit 6 Übungen und an Hypertrophie-/Kraft-Richtwerten orientierten Ziel-Sätzen/Wdh./Pausen
(Grundübungen 4-7 Wdh. mit langer Pause, Isolationsübungen 10-15 Wdh. kürzer). Passe die Zielwerte
gern an dein Niveau an.

1. Auf *Start* einen Trainingstag mit **▶ Start** beginnen, Gewichte & Wdh. eintragen, Sätze abhaken.
2. Trainierst du auch an einem zweiten Ort? Oben auf **＋** einen neuen Ort anlegen, dann den
   bestehenden Plan per **📤** (im Plan oben) dorthin kopieren – die Kopie ist danach unabhängig
   änderbar.
3. Fehlende Übungen unter *Übungen* selbst ergänzen (Muskelgruppe + Gerät angeben, damit die
   Filter greifen).
4. Fortschritt unter *Statistik* und *Kalender* verfolgen.

> Zum kompletten Zurücksetzen: *Einstellungen → Alle Daten löschen*.

## Projektstruktur

```
index.html              App-Shell (Topbar, Tabbar, Container)
styles.css              Mobile-first Dark-Theme
js/db.js                Datenhaltung (localStorage), CRUD, Statistik
js/app.js               Router, Ansichten, UI-Logik, Pausen-Timer, Charts
manifest.webmanifest    PWA-Manifest
sw.js                   Service Worker (Offline-Cache)
icons/                  App-Icons (SVG)
```

## Was fehlt / mögliche Erweiterungen

- Optionaler Cloud-Sync über mehrere Geräte
- Körpergewicht-/Fototracking, Aufwärmsätze, RPE/RIR
- Supersätze & Dropsätze, Plan-Vorlagen zum Teilen
- Icons als PNG (aktuell SVG – von Android/Chrome unterstützt; iOS bevorzugt PNG für den Homescreen)
