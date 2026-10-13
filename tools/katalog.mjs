// Lädt den öffentlichen TUMonline-Studienplan neu und ersetzt data/modules.json + data/modules.js
// (nur wenn das Ergebnis plausibel ist). Aufruf: node tools/katalog.mjs [data-Ordner]
import { katalogLaden } from './katalog-lib.mjs';
const DIR = process.argv[2] || 'data';
let schritt = '';
const { diff } = await katalogLaden({ dir: DIR, status: (s, i) => { if (s) { schritt = s; console.error(s); } } });
console.error(`Katalog: ${diff.anzahl} Module (vorher ${diff.anzahlVorher}), ${diff.neu.length} neu, ${diff.weg.length} entfernt, ${diff.geaendert.length} geändert`);
for (const m of diff.neu) console.error('  neu:', m.kennung, m.titel);
for (const m of diff.weg) console.error('  entfernt:', m.kennung, m.titel);
