// Vorabprüfung für die GitHub Action: Ist TUMonline erreichbar? Schreibt erreichbar=true/false nach $GITHUB_OUTPUT.
// Wartung oder Ausfall sind kein Fehler (die Action überspringt dann TUMonline), außer der Daten-Stand ist zu alt.
// Exit-Code 1 (also eine Fehler-Mail) gibt es nur, wenn jemand handeln muss: Stand zu alt oder Schnittstelle verändert.
// Aufruf: node tools/tumonline-check.mjs [data-Ordner]
import fs from 'node:fs';
import { R, istWartungsseite, readSemesterFile } from './semester-lib.mjs';
const DIR = process.argv[2] || 'data';
const MAX_TAGE = 7;

// Liefert den Grund, warum TUMonline gerade nicht verfügbar ist, oder null, wenn alles in Ordnung ist
async function stoerung() {
  let grund = '';
  for (let t = 0; t < 3; t++) {
    if (t) await new Promise(r => setTimeout(r, 20000));
    let r, text;
    try {
      r = await fetch(`${R}/slc.lib.tm/semesters/student`, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
      text = await r.text();
    } catch (e) { grund = 'keine Verbindung: ' + e.message; continue; }
    if (istWartungsseite(text)) return 'Wartungsseite';
    if (r.status >= 500) { grund = 'HTTP ' + r.status; continue; }
    let semester;
    try { semester = JSON.parse(text).semesters; } catch {}
    if (r.ok && semester?.length) return null;
    throw new Error(`Unerwartete Antwort von TUMonline (HTTP ${r.status}), hat sich die Schnittstelle geändert? ${text.slice(0, 200)}`);
  }
  return grund;
}

const grund = await stoerung();
if (grund) {
  const stand = readSemesterFile(DIR)?.standAlle;
  const tage = (Date.now() - Date.parse(stand)) / 864e5;
  if (tage > MAX_TAGE) throw new Error(`TUMonline nicht verfügbar (${grund}) und die Daten sind seit ${stand} nicht aktualisiert worden.`);
  console.log(`::notice::TUMonline nicht verfügbar (${grund}), Schritte werden übersprungen. Stand: ${stand}, siehe https://status.it.tum.de`);
} else console.log('TUMonline ist erreichbar.');
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `erreichbar=${!grund}\n`);
