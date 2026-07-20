// Baut aus den Einzeldateien eine in sich geschlossene HTML-Datei (standalone.html),
// die ohne Webserver direkt per Doppelklick (file://) im Browser läuft.
// Aufruf:  node build-standalone.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const css = readFileSync('styles.css', 'utf8');
let dbSrc = readFileSync('js/db.js', 'utf8');
let appSrc = readFileSync('js/app.js', 'utf8');
let html = readFileSync('index.html', 'utf8');

// Exportierte Namen aus db.js einsammeln
const names = new Set();
for (const m of dbSrc.matchAll(/export\s+function\s+(\w+)/g)) names.add(m[1]);
for (const m of dbSrc.matchAll(/export\s+(?:const|let|var)\s+(\w+)/g)) names.add(m[1]);

// db.js zu einem Modul-Objekt "DB" kapseln (export-Schlüsselwörter entfernen)
const dbBody = dbSrc.replace(/export\s+/g, '');
const dbWrapped = `const DB = (() => {\n${dbBody}\n  return { ${[...names].join(', ')} };\n})();`;

// app.js: Import-Zeile und Service-Worker-Block entfernen (SW geht auf file:// ohnehin nicht)
let appBody = appSrc
  .replace(/import \* as DB from '\.\/db\.js';\s*/, '')
  .replace(/\/\/ Service Worker[\s\S]*$/, '');

const script = `${dbWrapped}\n\n${appBody}`;

// HTML zusammenbauen: CSS inline, Modul-Script durch Inline-Script ersetzen, PWA-Links raus.
// Wichtig: Funktions-Ersetzungen benutzen, damit "$" / "$$" im Code NICHT als
// Sonderzeichen von String.replace interpretiert werden.
html = html
  .replace(/<link rel="stylesheet" href="\.\/styles\.css" \/>/, () => `<style>\n${css}\n</style>`)
  .replace(/\s*<link rel="manifest"[^>]*>/, '')
  .replace(/\s*<link rel="icon"[^>]*>/, '')
  .replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '')
  .replace(/<script type="module" src="\.\/js\/app\.js"><\/script>/, () => `<script>\n${script}\n</script>`);

writeFileSync('standalone.html', html);
console.log('standalone.html geschrieben (', html.length, 'Bytes )');
