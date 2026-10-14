// Lädt die Prüfungsstatistiken (Notenverteilungen) von https://examstats.de für alle Katalogmodule
// und schreibt data/examstats.js. Aufruf: node tools/examstats.mjs [data-Ordner]
// examstats.de sammelt von Studierenden eingesendete TUMonline-Statistiken; je Modul gibt es eine Seite
// mit einem Reiter pro Semester (?semester=25W).
import fs from 'node:fs';
import path from 'node:path';
import { pool } from './semester-lib.mjs';

const BASE = 'https://examstats.de';
const DIR = process.argv[2] || 'data';
const log = s => console.error(s);

const modules = JSON.parse(fs.readFileSync(path.join(DIR, 'modules.json'), 'utf8')).module;
const kennungen = new Set(modules.map(m => m.kennung));

async function get(url) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Fächerübersicht MW (github.com/davidci3)' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      if (i >= 2) throw new Error(`${url}: ${e.message}`);
      await new Promise(res => setTimeout(res, 2000 * (i + 1)));
    }
  }
}
const text = s => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const zahl = s => { const n = parseFloat(String(s).replace('%', '').replace(',', '.')); return Number.isFinite(n) ? n : null; };

// Kennung auf examstats.de → Kennung im Katalog (Varianten wie ED180034D/E, MW2411-1, IN8009_EI)
function katalogKennung(id) {
  for (const k of [id, id.replace(/[-_].*$/, ''), id.replace(/(\d)[A-Z]$/, '$1')]) if (kennungen.has(k)) return k;
  return null;
}

// Eine Semester-Ansicht: Kopfzahlen und Notenverteilung
function parseSemester(html) {
  const sum = {};
  for (const m of html.matchAll(/<div class="summary-label">([^<]+)<\/div>\s*<div>([^<]*)<\/div>/g)) sum[text(m[1]).replace(/:$/, '')] = text(m[2]);
  const noten = [];
  for (const m of html.matchAll(/<div class="chart-label">([\s\S]*?)<\/div>[\s\S]*?class="bar ([\w-]+)"[\s\S]*?([\d.]+)%\s*#(\d+)/g)) {
    const label = text(m[1]);
    const note = m[2].startsWith('grade-') ? label.match(/^\d,\d/)[0] : label[0]; // X, Q, U
    noten.push([note, Number(m[4])]);
  }
  if (!noten.length) return null;
  return {
    angemeldet: zahl(sum['Angemeldet']),
    angetreten: zahl(sum['Angetreten/Antritt zählt']),
    durchgefallen: zahl(sum['Anteil negative Beurteilungen']),
    schnitt: zahl(sum['Durchschnitt gesamt']),
    schnittBestanden: zahl(sum['Durchschnitt bestanden']),
    noten,
  };
}

async function ladeModul(id) {
  const url = `${BASE}/module/${encodeURIComponent(id)}/`;
  const html = await get(url);
  const tabs = [...html.matchAll(/href="\?semester=([^"]+)"\s*class="tab( active)?"/g)].map(m => ({ sem: m[1], aktiv: !!m[2] }));
  const titel = text((html.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1] || '').replace(new RegExp('^' + id + '\\s*'), '');
  const semester = [];
  for (const t of tabs.length ? tabs : [{ sem: '', aktiv: true }]) {
    const s = parseSemester(t.aktiv ? html : await get(`${url}?semester=${encodeURIComponent(t.sem)}`));
    if (s) semester.push({ sem: t.sem, ...s });
  }
  // neuestes Semester zuerst (25W vor 25S vor 24W)
  semester.sort((a, b) => b.sem.localeCompare(a.sem));
  return { id, titel, semester };
}

const index = await get(BASE + '/');
const ids = [...new Set([...index.matchAll(/href="\/module\/([^"\/]+)\/"/g)].map(m => decodeURIComponent(m[1])))];
const passend = ids.filter(katalogKennung);
log(`examstats.de: ${ids.length} Module, davon ${passend.length} im Katalog`);
if (ids.length < 10) throw new Error('Unplausible Modulliste – Seite verändert?');

const res = {};
let fehler = 0;
await pool(passend, 3, async id => {
  try {
    const m = await ladeModul(id);
    if (!m.semester.length) return;
    (res[katalogKennung(id)] ||= []).push(m);
  } catch (e) { fehler++; log('  Fehler: ' + e.message); }
});
if (fehler > passend.length / 4) throw new Error(`${fehler} Fehler – alte Daten bleiben erhalten`);

const sortiert = Object.fromEntries(Object.keys(res).sort().map(k => [k, res[k].sort((a, b) => a.id.localeCompare(b.id))]));
const out = { quelle: BASE, stand: new Date().toISOString().slice(0, 10), module: sortiert };
const f = path.join(DIR, 'examstats.js');
// Nur das Datum geändert? Dann Datei nicht anfassen (kein leerer Commit der Action)
if (fs.existsSync(f)) {
  const alt = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^[^=]*=/, '').trim().replace(/;\s*$/, ''));
  if (JSON.stringify(alt.module) === JSON.stringify(out.module)) { log('Keine Änderungen.'); process.exit(0); }
}
fs.writeFileSync(f, 'window.EXAMSTATS = ' + JSON.stringify(out) + ';\n');
log(`${Object.keys(sortiert).length} Katalogmodule mit Statistik, ${Object.values(sortiert).flat().reduce((n, m) => n + m.semester.length, 0)} Semester → ${f}`);
