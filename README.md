# 🏋️ Trainingsplan – Krafttraining Tracker

Eine kleine, **im Browser lauffähige** App zum Aufzeichnen von Krafttraining.
Läuft komplett **lokal & offline** (PWA), ohne Server und ohne Login – installierbar aufs Handy.

## Funktionen

- **Übungsbibliothek** – ~72 vorbefüllte Übungen (Name, Muskelgruppen, Gerät, Notiz), **Filter in Ausklappmenüs** für Muskelgruppe und Gerät (kombinierbar mit Suche). Ortübergreifend gemeinsam nutzbar – jedes Gym hat z. B. eine Brustpresse, die Übung muss nicht pro Ort neu angelegt werden.
- **Muskelgruppen und Geräte-Arten selbst verwalten** – über „⚙️ Verwalten" in den jeweiligen Filtern eigene Einträge anlegen/umbenennen/löschen (z. B. „Nacken", „Kettlebell"). Umbenennen aktualisiert alle betroffenen Übungen automatisch, Löschen entfernt nur das Tag (Übung bleibt erhalten). Beim Taggen einer Übung geht's auch direkt per „+ Neu"-Chip.
- **Farbige Labels** – Muskelgruppen und Geräte-Arten werden als farbige Badges angezeigt, in der Bibliothek, im Trainingstag und während des Trainings. Farben frei wählbar, abschaltbar unter *Einstellungen → Übungs-Labels*.
- **Hierarchie:** **Ort** (z. B. Sports Club Kiel, Zuhause) → **Trainingsplan** → **Trainingstag** → **Übungen**
- **Orte oben als Reiter** – der aktive Ort filtert die ganze App. Tippen auf den **bereits aktiven** Reiter öffnet dessen Bearbeiten-Dialog (Name/Emoji/Farbe/Löschen); Tippen auf einen anderen Reiter wechselt dorthin. **Statistik, „letztes Mal" und Verlauf sind je Ort getrennt**, weil Geräte zwischen Gyms nicht vergleichbar sind (z. B. Brustpresse 80 kg in Gym A ≙ 50 kg in Gym B). Das Orts-Kürzel steht klein neben Plan/Trainingstag/Übung.
- **Pläne ist die Startseite** – der separate *Start*-Tab wurde entfernt (hatte keine eigene Funktion mehr). *Pläne* zeigt oben ein laufendes Training zum Fortsetzen, darunter jeder Plan aufklappbar: antippen zeigt direkt die Trainingstage mit „Start ▶"-Button, ganz ohne Seitenwechsel. Das „✏️" öffnet die volle Plan-Verwaltung (Name/Emoji/Farbe, Trainingstage hinzufügen/entfernen/umsortieren).
- **Plan in ein anderes Gym übernehmen** – ein Trainingsplan (inkl. aller Trainingstage & Zielwerte) lässt sich jederzeit als unabhängige Kopie an einen anderen Ort kopieren, da das Kerntraining ja gleich bleibt (nur Struktur – Übungen/Sätze/Wdh./Pause –, keine Gewichts-/Trainingsdaten, die sind ja ortsabhängig). Original und Kopie sind danach getrennt frei änderbar. Geht dauerhaft über zwei Wege: **📥 „Plan von anderem Ort übernehmen"** auf der Pläne-Seite (zieht einen Plan zum aktiven Ort) oder **📤** in der Plan-Detailansicht (schickt den Plan zu einem anderen Ort) – funktioniert jederzeit, nicht nur direkt nach dem Anlegen eines Ortes.
- **Training aufzeichnen** – Gewicht & Wiederholungen je Satz eingeben, als Platzhalter direkt der letzte Wert (je Ort). Neu während des Trainings hinzugefügte Übungen übernehmen automatisch die in den Einstellungen hinterlegten Standard-Sätze/-Wdh./-Pause.
- **Supersätze/Zirkel & Reihenfolge** – sowohl im Trainingstag als auch im laufenden Training gibt es dieselben zwei eigenen Buttons über der Übungsliste: „🔗 Zirkel erstellen" (Mehrfachauswahl, mind. 2 Übungen wählen) und „↕ Reihenfolge" (eigene Ansicht nur mit ▲/▼, ein bestehender Zirkel bewegt sich dabei als ein Block, statt auseinandergerissen zu werden). Gruppierte Übungen werden sichtbar zusammengefasst („Auflösen" direkt am Zirkel-Block); der Pausen-Timer startet erst nach der letzten Übung der Gruppe.
- **Schlanker Übungskopf im Training** – nur Name + „⋮"-Menü. Darin: Pause ändern, Satz hinzufügen/entfernen (eine Zeile, links −/rechts +), Notiz, **Übung ersetzen**, Übung entfernen. Alles Strukturelle (Zirkel, Reihenfolge, Übung hinzufügen, Farbe, Trainingstag/Plan bearbeiten) liegt gebündelt hinter dem **⚙️**-Button oben – die Trainingsansicht selbst zeigt nur Name/Datum/Notiz + Übungen + Beenden.
- **Dauerhafte Geräte-Notiz je Übung + Ort** – z. B. „Sitzhöhe 4, Griff außen". Bleibt für alle künftigen Trainings erhalten (kein Session-Zettel), getrennt je Ort (Geräte-Einstellungen sind zwischen Gyms nicht vergleichbar). Nur sichtbar, wenn eine gesetzt ist; editierbar über das „⋮"-Menü im Training **oder** direkt in der Bibliothek. Davon getrennt: ein allgemeiner, ortsunabhängiger „Technik-Hinweis" je Übung in der Bibliothek (z. B. „Griff schulterbreit").
- **Sätze, Pausen, Reihenfolge, Zirkel & Übungen anpassbar** – beim Erstellen des Plans **und** während des Trainings. Nach dem Training wird, sofern in den Einstellungen aktiviert, **je Änderung einzeln gefragt**, ob sie in den Trainingsplan übernommen werden soll (neue Pausenzeit, mehr/weniger Sätze, hinzugefügte/entfernte Übung, geänderte Reihenfolge, angepasste Zirkel-Gruppierung) – oder nur für diese eine Einheit gilt.
- **Pausen-Timer** – Countdown nach jedem abgehakten Satz (mit Ton/Vibration und optionaler Browser-Benachrichtigung, wenn die App gerade im Hintergrund ist), hält währenddessen den **Bildschirm wach** (Wake Lock, wo vom Browser unterstützt).
- **Notizen** je Trainingseinheit (gesamtes Training) zusätzlich zu den Geräte-Notizen je Übung.
- **Statistiken je Übung** – geschätztes 1RM (Epley), max. Gewicht, Volumen, persönliche Rekorde und ein Verlaufs-Chart, je Ort getrennt. Zusätzlich eine **Gesamt-Übersicht** (Trainings gesamt, Einheiten im Zeitraum, Trainingsvolumen-Trend über alle Übungen, meisttrainierte Übungen) sowie **Muskelgruppen-Sätze** (abgehakte Sätze je Muskelgruppe – Sätze statt Gewicht, weil das aussagekräftiger für den Trainingsreiz ist), beide über einen gemeinsamen Zeitraum-Umschalter (7/30 Tage/Alle) – alle drei Abschnitte auf-/zuklappbar.
- **Beispieldaten** – über *Einstellungen → Daten & Backup* an-/abschaltbar: erzeugt bzw. entfernt ca. 2 Monate plausibler Testtrainings am aktiven Ort, um Statistik & Kalender direkt auszuprobieren, ohne echte Daten zu verändern.
- **Kalender / Habit-Tracker** – jeder Trainingstag & Plan bekommt ein **Kürzel oder Emoji**, das im Monatskalender erscheint. Plus Wochen-Streak und eine Liste der **letzten Trainings** darunter.
- **Globale Suche** – über das 🔍-Symbol auf der Pläne-Seite, findet Pläne, Trainingstage, Übungen und vergangene Trainings.
- **Papierkorb** – gelöschte Übungen und Trainings landen im Papierkorb (*Einstellungen → Papierkorb*) und lassen sich wiederherstellen oder endgültig entfernen.
- **Einstellungen** – eigener Reiter unten mit Design (mehrere **Themes**: Dunkel, Hell, OLED Schwarz, Mitternachtsblau, Wald, Kontrast, oder „System"; Akzentfarbe, Schriftgröße, Animationen reduzieren), Trainings-Standardwerten, Backup-Erinnerung und Papierkorb/Gefahrenzone.
- **Backup** – Export/Import als JSON-Datei.

## Warum diese Statistiken?

Für Krafttraining sind das die aussagekräftigsten Kennzahlen:

- **Geschätztes 1RM (Epley: `Gewicht × (1 + Wdh/30)`)** – der beste Einzelindikator für Kraftfortschritt, unabhängig vom Wiederholungsbereich.
- **Max. Gewicht** – klassischer Fortschrittsmarker.
- **Volumen (Sätze × Wdh × Gewicht)** – je Übung ein guter Fortschritts-Indikator, da hier immer dieselbe Übung mit sich selbst verglichen wird.
- **Muskelgruppen-Sätze (Anzahl statt Gewicht)** – *über Übungen hinweg* ist Gewicht × Wdh. dagegen nicht vergleichbar (ein Satz Kniebeuge wiegt naturgemäß mehr als ein Satz Bizepscurls, sagt aber nichts über den Trainingsreiz je Muskel aus). Trainingswissenschaftlich üblich ist daher „Sätze pro Muskel" (u. a. Schoenfeld-Metaanalysen), das zählt die App entsprechend.
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
- **Wake Lock (Bildschirm bleibt an)** funktioniert ab iOS 16.4. Auf älteren
  Versionen: stiller Fallback, der Timer läuft trotzdem normal weiter.
- Mach in jedem Fall regelmäßig ein **Backup** (*Einstellungen → Export*).

## Erste Schritte

Direkt nach dem ersten Start ist bereits alles startklar: **Sports Club Kiel** (Ort) mit drei Plänen –

- **Push Pull Legs** – klassischer 3-Tage-Split, 6 Übungen je Tag
- **Push Pull Legs (A/B)** – 6-Tage-Variante mit unterschiedlicher Übungsauswahl pro A-/B-Tag für mehr Abwechslung
- **Beedle** – 1:1 übernommener eigener Plan (Push/Pull/Beine)

alle mit an Hypertrophie-/Kraft-Richtwerten orientierten Ziel-Sätzen/Wdh./Pausen
(Grundübungen 4-7 Wdh. mit langer Pause, Isolationsübungen 10-15 Wdh. kürzer). Passe die Zielwerte
gern an dein Niveau an – und lösch/deaktiviere, welche Pläne du nicht brauchst.

1. Auf *Pläne* einen Plan antippen (klappt die Trainingstage auf) und mit **Start ▶** beginnen, Gewichte & Wdh. eintragen, Sätze abhaken.
2. Trainierst du auch an einem zweiten Ort? Oben auf **＋** einen neuen Ort anlegen, dann den
   bestehenden Plan per **📤** (im Plan oben) dorthin kopieren – die Kopie ist danach unabhängig
   änderbar.
3. Fehlende Übungen unter *Übungen* selbst ergänzen (Muskelgruppe + Gerät angeben, damit die
   Filter greifen).
4. Fortschritt unter *Statistik* und *Kalender* verfolgen.

> Nur die aufgezeichneten Trainings löschen (Orte/Pläne bleiben): *Einstellungen → Gefahrenzone → Nur Trainingseinheiten löschen*.
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
- Körpergewicht-/Fototracking
- RPE/RIR, Aufwärmsätze (getrennt von Arbeitssätzen), Dropsätze
- Progressive-Overload-Vorschläge ("+2,5 kg oder +1 Wdh. probieren"), PR-Hinweis live im Training
- Plattenrechner
- Import aus anderen Apps (Strong, Hevy, JEFIT)
- Icons als PNG (aktuell SVG – von Android/Chrome unterstützt; iOS bevorzugt PNG für den Homescreen)
