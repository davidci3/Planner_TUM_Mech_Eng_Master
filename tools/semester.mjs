// Lädt für ein Semester alle Lehrveranstaltungen (mit Terminen) und Prüfungstermine der Katalogmodule
// Aufruf: node tools/semester.mjs [semesterId|auto] [data-Ordner] [--nur-pruefungen] [--cache datei.json]
//   semesterId: 207 = WiSe 2026/27, 208 = SoSe 2027 (siehe .../slc.lib.tm/semesters/student);
//   auto (Standard): laufendes Semester, ab 6 Wochen vor Beginn das nächste
//   --nur-pruefungen: nur die Prüfungstermine neu holen (eine Anfrage, wenige Sekunden)
//   --cache: Anfragen zwischenspeichern, um einen abgebrochenen Lauf fortzusetzen (liefert sonst alte Daten!)
import { semesterAuto, createSemester, readSemesterFile, writeSemesterFile, mergeExams, mergeKurse, pool } from './semester-lib.mjs';
const args = process.argv.slice(2);
const flag = n => args.includes(n);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const pos = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--cache');
const [SEM_ARG = 'auto', DIR = 'data'] = pos;
const SEM = SEM_ARG === 'auto' ? String((await semesterAuto()).id) : SEM_ARG;
const log = s => console.error(s);

const alt = readSemesterFile(DIR);
// nur Prüfungen geht nur, wenn semester.js schon für dieses Semester existiert (sonst Gesamtlauf, z. B. beim Semesterwechsel)
if (flag('--nur-pruefungen') && alt && String(alt.semesterId) === String(SEM)) {
  const sem = await createSemester({ sem: SEM, dir: DIR, raeume: alt.raeume, log });
  const ex = await sem.fetchExams();
  writeSemesterFile(DIR, mergeExams(alt, ex));
  log(`${alt.label}: Prüfungstermine für ${Object.keys(ex).length} Module aktualisiert.`);
} else {
  const sem = await createSemester({ sem: SEM, dir: DIR, cachePath: opt('--cache'), log });
  const kurse = {};
  let n = 0;
  await pool(sem.kandidaten, 6, async id => { kurse[id] = await sem.crawlModule(id); if (++n % 100 === 0) log(`${n} / ${sem.kandidaten.length} Module`); });
  sem.saveCache();
  const res = { ...sem.meta, typen: {}, raeume: [], module: {} };
  mergeKurse(res, kurse, sem, true);
  mergeExams(res, await sem.fetchExams());
  writeSemesterFile(DIR, res);
  const v = Object.values(res.module);
  log(`${res.label}: ${v.filter(x => x.kurse.length).length} Module mit Kursen, ${v.filter(x => x.pruefungen).length} Module mit Prüfungsterminen.`);
  const pz = {}; for (const x of v) for (const k of x.kurse) pz[k.typ + ':' + k.praesenz] = (pz[k.typ + ':' + k.praesenz] || 0) + 1;
  log('Präsenz: ' + JSON.stringify(pz));
}
