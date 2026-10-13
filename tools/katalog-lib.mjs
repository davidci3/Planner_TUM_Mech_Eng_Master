// Katalog (öffentlicher TUMonline-Studienplan) neu laden: crawl.mjs → details.mjs → build.mjs in einem Temp-Ordner,
// Abgleich mit dem alten Stand, Plausibilitätsprüfung und Austausch von data/modules.json + data/modules.js.
// Genutzt von tools/server.mjs (Knopf in der App) und tools/katalog.mjs (Kommandozeile, GitHub Actions).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));

function runScript(script, args, onLine) {
  return new Promise((ok, fail) => {
    const p = spawn(process.execPath, [path.join(TOOLS, script), ...args], { cwd: path.dirname(TOOLS) });
    let rest = '', err = '';
    p.stderr.on('data', d => { rest += d; const lines = rest.split('\n'); rest = lines.pop(); for (const l of lines) { err = (err + l + '\n').slice(-2000); onLine && onLine(l); } });
    p.on('error', fail);
    p.on('close', code => code === 0 ? ok() : fail(new Error(`${script} ist fehlgeschlagen (Code ${code}): ${err.trim().split('\n').pop() || ''}`)));
  });
}

const FELDER = { titel: 'Titel', ects: 'ECTS', turnus: 'Turnus', sprache: 'Sprache', lehrstuhl: 'Lehrstuhl', verantwortlich: 'Verantwortlich', bereiche: 'Wahlbereiche', voraussetzungen: 'Voraussetzungen', pruefung: 'Prüfung', inhalt: 'Inhalt' };
export function katalogDiff(alt, neu) {
  const A = new Map(alt.module.map(m => [m.id, m])), N = new Map(neu.module.map(m => [m.id, m]));
  const kurz = m => ({ id: m.id, titel: m.titel, kennung: m.kennung });
  const geaendert = [];
  for (const [id, m] of N) {
    const a = A.get(id); if (!a) continue;
    const f = Object.keys(FELDER).filter(k => JSON.stringify(a[k]) !== JSON.stringify(m[k]));
    if (f.length) geaendert.push({ ...kurz(m), felder: f.map(k => FELDER[k]), vorher: Object.fromEntries(f.filter(k => ['ects', 'turnus', 'sprache', 'titel'].includes(k)).map(k => [FELDER[k], a[k]])) });
  }
  return { neu: [...N.values()].filter(m => !A.has(m.id)).map(kurz), weg: [...A.values()].filter(m => !N.has(m.id)).map(kurz), geaendert, anzahl: neu.module.length, anzahlVorher: alt.module.length };
}

// status(schritt, info) meldet den Fortschritt; ersetzen(fn) führt den Dateiaustausch aus (z. B. in einer Sperre)
export async function katalogLaden({ dir, status = () => {}, ersetzen = fn => fn() }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'faecher-katalog-'));
  const tree = path.join(tmp, 'raw-tree.json'), det = path.join(tmp, 'raw-details.json'), out = path.join(tmp, 'data');
  try {
    let knoten = 0;
    status('Studienplan-Baum laden (1/3)', '');
    await runScript('crawl.mjs', [tree], () => status(null, `${++knoten} Knoten gelesen`));
    status('Modulbeschreibungen laden (2/3)', '');
    let gesamt = '';
    await runScript('details.mjs', [tree, det], l => { const m = l.match(/^(\d+) Module/); if (m) gesamt = m[1]; if (/^\d+$/.test(l.trim())) status(null, `${l.trim()}${gesamt ? ' von ' + gesamt : ''} Module`); });
    status('Katalog aufbauen (3/3)', '');
    fs.mkdirSync(out);
    await runScript('build.mjs', [tree, det, out]);
    const alt = JSON.parse(fs.readFileSync(path.join(dir, 'modules.json'), 'utf8'));
    const neu = JSON.parse(fs.readFileSync(path.join(out, 'modules.json'), 'utf8'));
    // Plausibilität: ein halb geladener Studienplan darf den alten nicht ersetzen
    if (neu.module.length < alt.module.length * 0.8) throw new Error(`Nur ${neu.module.length} statt ${alt.module.length} Module geladen. TUMonline war vermutlich nicht vollständig erreichbar, der alte Stand bleibt.`);
    const diff = katalogDiff(alt, neu);
    await ersetzen(() => {
      for (const f of ['modules.json', 'modules.js']) { fs.copyFileSync(path.join(out, f), path.join(dir, f + '.tmp')); fs.renameSync(path.join(dir, f + '.tmp'), path.join(dir, f)); }
    });
    return { diff, stand: neu.stand };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
