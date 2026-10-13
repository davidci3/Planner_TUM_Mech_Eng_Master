// Kleiner lokaler Hilfsdienst für die Fächerübersicht (nur 127.0.0.1)
// - Knöpfe „Aktualisieren“ in der App: holt Prüfungstermine bzw. Termine einzelner Module frisch aus TUMonline
//   (die App selbst darf TUMonline wegen CORS nicht direkt abfragen)
// - Katalog-Knopf: lädt den öffentlichen Studienplan neu (katalog-lib.mjs)
// - Automatik: aktualisiert data/semester.js beim Start (wenn älter als 20 h) und danach alle 24 h,
//   wechselt dabei selbst ins nächste Semester (ab 6 Wochen vor Beginn)
// Aufruf: node tools/server.mjs   (Port über PORT=… änderbar, Standard 8765)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { katalogLaden } from './katalog-lib.mjs';
import { semesterAuto, createSemester, readSemesterFile, writeSemesterFile, mergeExams, mergeKurse, pool } from './semester-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'data');
const PORT = Number(process.env.PORT) || 8765;
const LOGFILE = path.join(ROOT, 'server.log');
const TAG = 24 * 3600e3;

function log(s) {
  const line = `[${new Date().toLocaleString('de-DE')}] ${s}\n`;
  process.stderr.write(line);
  try { if (fs.existsSync(LOGFILE) && fs.statSync(LOGFILE).size > 500e3) fs.renameSync(LOGFILE, LOGFILE + '.alt'); fs.appendFileSync(LOGFILE, line); } catch {}
}

// Schreibzugriffe nacheinander ausführen, damit sich Knopf und Automatik nicht überschreiben
let queue = Promise.resolve();
const exclusive = fn => { const p = queue.then(fn, fn); queue = p.catch(() => {}); return p; };

function aktuell() {
  const res = readSemesterFile(DIR);
  if (!res) throw new Error('data/semester.js fehlt. Einmal „node tools/semester.mjs“ ausführen.');
  res.typen = res.typen || {}; res.raeume = res.raeume || [];
  return res;
}

async function updatePruefungen() {
  return exclusive(async () => {
    const res = aktuell();
    const sem = await createSemester({ sem: res.semesterId, dir: DIR, raeume: res.raeume });
    mergeExams(res, await sem.fetchExams());
    writeSemesterFile(DIR, res);
    log(`Prüfungstermine aktualisiert (${Object.values(res.module).filter(v => v.pruefungen).length} Module mit Terminen)`);
    return res;
  });
}

async function updateTermine(ids) {
  return exclusive(async () => {
    const res = aktuell();
    const sem = await createSemester({ sem: res.semesterId, dir: DIR, raeume: res.raeume });
    const list = ids || sem.kandidaten;
    const kurse = {};
    await pool(list, 6, async id => { kurse[id] = await sem.crawlModule(id); });
    mergeKurse(res, kurse, sem, !ids);
    writeSemesterFile(DIR, res);
    log(`Termine aktualisiert für ${ids ? ids.length + ' Module' : 'alle Module'}`);
    return res;
  });
}

// ---------- Katalog (öffentlicher TUMonline-Studienplan) neu laden ----------
// Hintergrundauftrag (ca. 1 Minute), Logik in katalog-lib.mjs
let katalogJob = null;
async function updateKatalog() {
  const job = katalogJob = { status: 'laeuft', schritt: '', info: '', start: new Date().toISOString() };
  try {
    const { diff, stand } = await katalogLaden({ dir: DIR, ersetzen: exclusive, status: (schritt, info) => { if (schritt != null) job.schritt = schritt; job.info = info; } });
    log(`Katalog aktualisiert: ${diff.anzahl} Module, ${diff.neu.length} neu, ${diff.weg.length} entfernt, ${diff.geaendert.length} geändert`);
    // Termine und Prüfungen für neue Module gleich mitholen
    if (diff.neu.length) { job.schritt = 'Termine der neuen Module laden'; job.info = ''; try { await updateTermine(diff.neu.map(m => m.id)); await updatePruefungen(); } catch (e) { log('Termine für neue Module: ' + e.message); } }
    Object.assign(job, { status: 'fertig', schritt: '', info: '', ende: new Date().toISOString(), stand, diff });
  } catch (e) {
    log('Katalog-Aktualisierung fehlgeschlagen: ' + e.message);
    Object.assign(job, { status: 'fehler', fehler: e.message, ende: new Date().toISOString() });
  }
}

// neues Semester komplett laden (Semesterwechsel)
async function neuesSemester(id) {
  return exclusive(async () => {
    const sem = await createSemester({ sem: id, dir: DIR });
    const kurse = {};
    await pool(sem.kandidaten, 6, async m => { kurse[m] = await sem.crawlModule(m); });
    const res = { ...sem.meta, typen: {}, raeume: [], module: {} };
    mergeKurse(res, kurse, sem, true);
    mergeExams(res, await sem.fetchExams());
    writeSemesterFile(DIR, res);
    log(`Neues Semester geladen: ${res.label}`);
  });
}

// ---------- Automatik ----------
let autoLaeuft = false;
async function auto() {
  if (autoLaeuft) return;
  autoLaeuft = true;
  try {
    const ziel = (await semesterAuto()).id, r = readSemesterFile(DIR);
    if (!r || r.semesterId !== ziel) await neuesSemester(ziel);
    else { await updatePruefungen(); await updateTermine(null); }
  } catch (e) { log('Automatische Aktualisierung fehlgeschlagen: ' + e.message); }
  autoLaeuft = false;
}
function autoStart() {
  let alt = Infinity;
  try { const r = readSemesterFile(DIR); alt = Date.now() - Date.parse(r.standAlle || 0); } catch {}
  if (!(alt < 20 * 3600e3)) auto();
  setInterval(auto, TAG);
}

// ---------- HTTP ----------
const erlaubt = o => !o || o === 'null' || o.startsWith('file://') || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
function send(req, res, code, body) {
  const o = req.headers.origin;
  const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (o && erlaubt(o)) Object.assign(h, { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Private-Network': 'true', Vary: 'Origin' });
  res.writeHead(code, h);
  res.end(body == null ? '' : JSON.stringify(body));
}
const lesen = req => new Promise((ok, fail) => { let s = ''; req.on('data', d => { s += d; if (s.length > 1e5) req.destroy(); }); req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { fail(e); } }); });
// nur die Daten der angefragten Module zurückgeben (klein halten)
const auszug = (res, ids) => ({ stand: res.stand, standPruefungen: res.standPruefungen, standTermine: res.standTermine, typen: res.typen, raeume: res.raeume,
  module: Object.fromEntries((ids || Object.keys(res.module)).map(id => [id, res.module[id] || { kurse: [] }])) });

const server = http.createServer(async (req, res) => {
  // Schutz gegen DNS-Rebinding: nur Anfragen an localhost/127.0.0.1
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '') || !erlaubt(req.headers.origin)) return send(req, res, 403, { fehler: 'nicht erlaubt' });
  if (req.method === 'OPTIONS') return send(req, res, 204);
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/api/status') {
      const r = readSemesterFile(DIR);
      return send(req, res, 200, { ok: true, semesterId: r?.semesterId, stand: r?.stand, standPruefungen: r?.standPruefungen, standTermine: r?.standTermine, autoLaeuft });
    }
    if (req.method === 'POST' && url.pathname === '/api/pruefungen') {
      const r = await updatePruefungen();
      // Prüfungen aller Module (nur dieser Teil wird zurückgegeben)
      return send(req, res, 200, { stand: r.stand, standPruefungen: r.standPruefungen, pruefungen: Object.fromEntries(Object.entries(r.module).filter(([, v]) => v.pruefungen).map(([id, v]) => [id, v.pruefungen])) });
    }
    if (url.pathname === '/api/katalog') {
      // POST startet den Auftrag (falls nicht schon einer läuft), GET liefert den Fortschritt
      if (req.method === 'POST' && !(katalogJob && katalogJob.status === 'laeuft')) updateKatalog();
      if (req.method === 'POST' || req.method === 'GET') return send(req, res, 200, katalogJob || { status: 'keiner' });
    }
    if (req.method === 'POST' && url.pathname === '/api/termine') {
      const body = await lesen(req);
      const ids = [...new Set((body.module || []).map(String).filter(id => /^\d{1,10}$/.test(id)))].slice(0, 200);
      if (!ids.length) return send(req, res, 400, { fehler: 'keine Module angegeben' });
      const r = await updateTermine(ids);
      return send(req, res, 200, auszug(r, ids));
    }
    send(req, res, 404, { fehler: 'unbekannt' });
  } catch (e) {
    log('Fehler: ' + e.message);
    send(req, res, 500, { fehler: e.message });
  }
});
server.on('error', e => { log(e.code === 'EADDRINUSE' ? `Port ${PORT} ist belegt – läuft der Dienst schon?` : 'Serverfehler: ' + e.message); process.exit(1); });
server.listen(PORT, '127.0.0.1', () => { log(`Hilfsdienst läuft auf http://127.0.0.1:${PORT}`); autoStart(); });
