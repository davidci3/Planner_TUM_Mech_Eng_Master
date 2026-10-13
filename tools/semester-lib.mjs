// Gemeinsame Logik für tools/semester.mjs (Kommandozeile) und tools/server.mjs (Hilfsdienst):
// Lehrveranstaltungen mit Terminen und Prüfungstermine eines Semesters aus den öffentlichen TUMonline-Schnittstellen
import fs from 'node:fs';
import path from 'node:path';
export const R = 'https://campus.tum.de/tumonline/ee/rest';

const de = x => { if (!x) return ''; const t = x.translations?.translation || []; return t.find(y => y.lang === 'de')?.value || x.value || ''; };
const flat = o => typeof o === 'string' ? o : o && typeof o === 'object' ? (o.translations ? de(o) : Object.values(o).map(flat).join(' ')) : '';
export async function pool(items, n, fn) {
  const q = [...items]; const out = [];
  await Promise.all(Array.from({ length: n }, async () => { while (q.length) { const x = q.shift(); out.push(await fn(x)); } }));
  return out;
}

// ---------- Anwesenheitspflicht (Heuristik) ----------
const PFLICHT_TYP = { PR: 'Praktikum', SE: 'Seminar', PS: 'Proseminar', HS: 'Hauptseminar', EX: 'Exkursion', PJ: 'Projekt', PT: 'Projekt', WS: 'Workshop', KO: 'Kolloquium', SP: 'Sprachkurs', KS: 'Kurs' };
const UNKLAR_TYP = { UE: 'Übung', VI: 'Vorlesung mit integrierter Übung', TT: 'Tutorium', VU: 'Vorlesung mit Übung', LA: 'Laborübung' };
const NEG = /keine (anwesenheitspflicht|präsenzpflicht)|anwesenheit (ist )?nicht (verpflichtend|erforderlich|notwendig|pflicht)|no (mandatory|compulsory) (attendance|presence)|attendance is (not|no) (mandatory|compulsory|required)|attendance (is )?optional|teilnahme (ist )?freiwillig/i;
const POS = /anwesenheitspflicht|präsenzpflicht|anwesenheit (ist |besteht )?(verpflichtend|pflicht|erforderlich|notwendig|vorausgesetzt)|(regelmäßige |aktive )?teilnahme (an [^.]{0,40})?(ist )?(verpflichtend|pflicht|obligatorisch)|verpflichtende (teilnahme|anwesenheit)|pflichttermin|mandatory attendance|attendance (is |at [^.]{0,40})?(mandatory|compulsory|required|obligatory)|compulsory attendance|presence (is )?(mandatory|required|compulsory)|participation (is |in [^.]{0,40})?(mandatory|compulsory|obligatory)|mandatory participation/i;
// Pflicht nur beim ersten Termin / der Vorbesprechung
const ERSTER = /(erste[nm]? (termin|veranstaltung|vorlesung|sitzung|vl-termin|treffen)|vorbesprechung|einführungsveranstaltung|einführung|kick-?off|first (session|meeting|lecture|class|appointment)|introductory (session|meeting)|introduction)/i;
const ANDERE = /übung|tutor|praktik|exercise|lab\b|labor|projekt/i;
function praesenz(typ, text) {
  const neg = text.match(NEG), pos = text.match(POS);
  const ctx = m => text.slice(Math.max(0, m.index - 90), m.index + m[0].length + 90);
  const snip = m => '…' + ctx(m).replace(/\s+/g, ' ').trim() + '…';
  if (neg) return ['nein', 'Beschreibung: ' + snip(neg)];
  if (pos) {
    const c = ctx(pos);
    if (ERSTER.test(c)) return ['erster', 'Pflicht nur beim ersten Termin bzw. der Vorbesprechung. Beschreibung: ' + snip(pos)];
    // Vorlesung: Der Pflicht-Hinweis bezieht sich oft auf die zugehörige Übung oder das Praktikum
    if (typ === 'VO' && ANDERE.test(c)) return ['nein', 'Pflicht laut Beschreibung nur für Übung/Praktikum: ' + snip(pos)];
    return ['ja', 'Beschreibung: ' + snip(pos)];
  }
  if (PFLICHT_TYP[typ]) return ['ja', `Kurstyp ${PFLICHT_TYP[typ]}: in der Regel Anwesenheitspflicht`];
  if (UNKLAR_TYP[typ]) return ['unklar', `Kurstyp ${UNKLAR_TYP[typ]}: Anwesenheitspflicht möglich, bitte beim Lehrstuhl prüfen`];
  if (typ === 'VO') return ['nein', 'Vorlesung: in der Regel keine Anwesenheitspflicht'];
  return ['unklar', 'Keine Angabe gefunden'];
}

// ---------- Welches Semester? ----------
// Das laufende Semester, ab 6 Wochen vor Vorlesungsbeginn schon das nächste (dann wird es geplant)
export async function semesterAuto() {
  const r = await fetch(`${R}/slc.lib.tm/semesters/student`, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
  const list = (await r.json()).semesters || [];
  const stichtag = new Date(Date.now() + 42 * 864e5).toISOString().slice(0, 10);
  const s = list.filter(x => x.startOfAcademicSemester.value <= stichtag).sort((a, b) => b.startOfAcademicSemester.value.localeCompare(a.startOfAcademicSemester.value))[0];
  if (!s) throw new Error('Kein passendes Semester in TUMonline gefunden');
  return { id: s.id, studienjahr: s.academicYearId };
}
// Studienjahr für crawl.mjs/details.mjs: Umgebungsvariable SJ oder automatisch
export const studienjahr = async () => process.env.SJ || (await semesterAuto()).studienjahr;

// ---------- Datei data/semester.js ----------
export function readSemesterFile(dir) {
  const f = path.join(dir, 'semester.js');
  if (!fs.existsSync(f)) return null;
  const s = fs.readFileSync(f, 'utf8');
  return JSON.parse(s.slice(s.indexOf('=') + 1).trim().replace(/;\s*$/, ''));
}
export function writeSemesterFile(dir, res) {
  // erst in eine temporäre Datei schreiben, damit die App nie eine halbe Datei liest
  const f = path.join(dir, 'semester.js');
  fs.writeFileSync(f + '.tmp', 'window.SEMESTER = ' + JSON.stringify(res) + ';\n');
  fs.renameSync(f + '.tmp', f);
}

// ---------- Crawler ----------
// sem: Semester-ID (207 = WiSe 2026/27), dir: data-Ordner, cachePath: optionaler Anfrage-Cache, raeume: vorhandene Raumliste (für Zusammenführung)
export async function createSemester({ sem, dir, cachePath = null, raeume = [], log = () => {} }) {
  const data = JSON.parse(fs.readFileSync(path.join(dir, 'modules.json'), 'utf8'));
  const M = new Map(data.module.map(m => [m.id, m]));
  const cache = cachePath && fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {};
  let fetched = 0;
  const saveCache = () => { if (cachePath) fs.writeFileSync(cachePath, JSON.stringify(cache)); };
  async function get(url, { noCache } = {}) {
    if (!noCache && cache[url]) return cache[url];
    for (let t = 0; t < 4; t++) {
      try {
        const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
        if (r.ok) { const j = await r.json(); if (cachePath) cache[url] = j; if (++fetched % 200 === 0) { log(fetched + ' Anfragen'); saveCache(); } return j; }
        if (r.status === 404) { if (cachePath) cache[url] = {}; return {}; }
      } catch {}
      await new Promise(r => setTimeout(r, 1500 * (t + 1)));
    }
    return {};
  }

  const semList = (await get(`${R}/slc.lib.tm/semesters/student`, { noCache: true })).semesters || [];
  const semDto = semList.find(s => String(s.id) === String(sem));
  if (!semDto) throw new Error('Semester ' + sem + ' nicht gefunden');
  const semStart = semDto.startOfAcademicSemester.value, semEnd = semDto.endOfAcademicSemester.value;
  const day0 = Date.parse(semStart + 'T00:00:00Z');
  const dayIdx = iso => Math.round((Date.parse(iso.slice(0, 10) + 'T00:00:00Z') - day0) / 864e5);
  const mins = iso => { const [h, m] = iso.slice(11, 16).split(':').map(Number); return h * 60 + m; };
  const rooms = [...raeume], roomIdx = new Map(rooms.map((r, i) => [r, i]));
  const room = n => { n = (n || '').trim(); if (!n) return -1; if (!roomIdx.has(n)) { roomIdx.set(n, rooms.length); rooms.push(n); } return roomIdx.get(n); };
  const typen = {};

  // Kurse eines Moduls inkl. aller Gruppen und Termine
  async function crawlModule(modId, { noCache = false } = {}) {
    const m = M.get(String(modId)); if (!m) return null;
    const base = `${R}/slc.cm.reg/student/modules/detail/${m.id}/${sem}/courseGroupings`;
    const nodes = (await get(`${base}/courses`, { noCache })).resource || [];
    const kurse = [];
    for (const n of nodes) {
      const nid = n.content?.cmNodeListItemDto?.id; if (!nid) continue;
      const det = (await get(`${base}/courses/${nid}`, { noCache })).resource || [];
      for (const x of det) {
        const cd = x.content?.coPersonalCourseDetailsDto; if (!cd || kurse.some(k => k.id === cd.id)) continue;
        const full = (await get(`${R}/slc.tm.cp/student/courses/${cd.id}`, { noCache })).resource?.[0]?.content?.cpCourseDetailDto || {};
        const cp = full.cpCourseDto || {}, desc = full.cpCourseDescriptionDto || {};
        const typ = cp.courseTypeDto?.key || de(cd.courseTypeShortName) || '?';
        typen[typ] = typen[typ] || de(cp.courseTypeDto?.courseTypeName) || de(cd.courseTypeName);
        const groups = [...((await get(`${R}/slc.tm.cp/student/courseGroups/firstGroups/${cd.id}`, { noCache })).courseGroupDtos || [])];
        // firstGroups liefert höchstens 5 Gruppen, den Rest gibt es über remainingGroups
        if (groups.length >= 5) groups.push(...((await get(`${R}/slc.tm.cp/student/courseGroups/remainingGroups/${cd.id}`, { noCache })).courseGroupDtos || []));
        groups.sort((a, b) => (b.standardgroupFlag === 'J') - (a.standardgroupFlag === 'J') || a.name.localeCompare(b.name, 'de', { numeric: true }));
        let gruppen = groups.map(g => ({
          n: g.name, std: g.standardgroupFlag === 'J',
          t: (g.appointmentDtos || []).filter(a => a.appointmentStatusType !== 'CANCELLED' && a.timestampFrom?.value)
            .map(a => [dayIdx(a.timestampFrom.value), mins(a.timestampFrom.value), mins(a.timestampTo?.value || a.timestampFrom.value), room(a.resourceName)])
            .sort((a, b) => a[0] - b[0] || a[1] - b[1]),
        }));
        // Gibt es neben der Standardgruppe weitere Gruppen, gelten deren Termine für alle (z. B. Vorbesprechung)
        let gemeinsam = [];
        if (gruppen.length > 1 && gruppen.some(g => g.std)) { gemeinsam = gruppen.filter(g => g.std).flatMap(g => g.t); gruppen = gruppen.filter(g => !g.std); }
        const gruppenOhneTermine = gruppen.filter(g => !g.t.length).length; // angelegte Gruppen, deren Termine noch fehlen
        gruppen = gruppen.filter(g => g.t.length).map(({ n, t }) => ({ n, t }));
        const text = [flat(desc.teachingMethod), flat(desc.courseRegistrationInfo), flat(desc.assessmentScheme), flat(desc.courseContent), flat(desc.additionalInformation), flat(desc.courseCategoryDto), flat(desc.previousKnowledge)].join('\n');
        const [p, grund] = praesenz(typ, text + '\n' + (m.pruefung || ''));
        const sws = (cp.courseNormConfigs || []).find(c => c.key === 'SST')?.value;
        kurse.push({
          id: cd.id, typ, titel: (cp.courseTitle && de(cp.courseTitle)) || de(cd.courseTitle), sws: sws ? Number(sws) : null,
          sprache: (cp.courseLanguageDtos || []).map(l => l.languageDto?.key).filter(Boolean).join('/'),
          praesenz: p, praesenzGrund: grund, gruppen, ...(gemeinsam.length ? { gemeinsam } : {}), ...(gruppenOhneTermine ? { gruppenOhneTermine } : {}),
        });
      }
    }
    return kurse;
  }

  // Öffentliche Prüfungsterminliste → { modulId: [Prüfungen] }
  async function fetchExams() {
    const ex = (await get(`${R}/slc.xm.exd/exExamOffer`, { noCache: true })).examOffers || [];
    if (!ex.length) throw new Error('Prüfungsliste leer oder nicht erreichbar');
    const byKennung = new Map();
    for (const m of data.module) if (m.kennung) (byKennung.get(m.kennung) || byKennung.set(m.kennung, []).get(m.kennung)).push(m.id);
    const examEnd = new Date(Date.parse(semEnd) + 45 * 864e5).toISOString().slice(0, 10); // inkl. Wiederholungstermine zu Beginn des Folgesemesters
    const out = {};
    for (const o of ex) {
      const ids = byKennung.get(o.displayCourseNumber); if (!ids) continue;
      const datum = o.examDate?.value;
      const eigenes = String(o.courseSemesterId) === String(sem);
      if (!eigenes && !(datum && datum >= semStart && datum <= examEnd)) continue;
      const p = {
        datum: datum || null, von: o.examStart?.value?.slice(0, 5) || null, bis: o.examEnd?.value?.slice(0, 5) || null,
        art: de(o.examType), sem: de(o.courseSemesterShortName), eigenes,
        info: (o.examDateInformation || '').replace(/^Import\s*/, '').trim(),
        anmeldung: [o.registrationDateStart?.value?.slice(0, 10) || null, o.registrationDateEnd?.value?.slice(0, 10) || null],
        pruefer: (o.examPersons || []).flatMap(p => (p.identities || []).map(i => `${i.firstName} ${i.lastName}`)).slice(0, 3).join(', '),
      };
      for (const id of ids) (out[id] = out[id] || []).push(p);
    }
    for (const v of Object.values(out)) v.sort((a, b) => (a.datum || '9').localeCompare(b.datum || '9'));
    return out;
  }

  const meta = { semesterId: Number(sem), key: semDto.key, label: de(semDto.semesterDesignation), typ: semDto.semesterType, start: semStart, ende: semEnd };
  return { meta, data, M, typen, rooms, crawlModule, fetchExams, saveCache, kandidaten: data.module.filter(m => m.ects > 0).map(m => m.id) };
}

// ---------- Zusammenführen ----------
const jetzt = () => new Date().toISOString();
// alle Prüfungen ersetzen
export function mergeExams(res, exams) {
  for (const [id, v] of Object.entries(res.module)) { delete v.pruefungen; if (!v.kurse.length) delete res.module[id]; }
  for (const [id, p] of Object.entries(exams)) { res.module[id] = res.module[id] || { kurse: [] }; res.module[id].pruefungen = p; }
  res.standPruefungen = res.stand = jetzt();
  return res;
}
// Kurse einzelner Module ersetzen
// alle = true: kompletter Lauf über alle Module (Zeitstempel für die tägliche Automatik)
export function mergeKurse(res, kurseById, sem, alle = false) {
  for (const [id, kurse] of Object.entries(kurseById)) {
    if (kurse == null) continue;
    const v = res.module[id] || { kurse: [] };
    v.kurse = kurse;
    if (kurse.length || v.pruefungen) res.module[id] = v; else delete res.module[id];
  }
  Object.assign(res.typen, sem.typen);
  res.raeume = sem.rooms;
  res.standTermine = res.stand = jetzt();
  if (alle) res.standAlle = res.standTermine;
  return res;
}
