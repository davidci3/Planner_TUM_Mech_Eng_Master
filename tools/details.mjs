// Lädt Moduldetails (öffentliche TUMonline-REST-API) für alle Modulknoten im Baum
import fs from 'node:fs';
import { studienjahr } from './semester-lib.mjs';
const SJ = await studienjahr();
const [, , TREE, OUT] = process.argv;
const tree = JSON.parse(fs.readFileSync(TREE, 'utf8'));
const SKIP = /Sprachenzentrum|Kontextstudium|Hochschule für Philosophie|Schlüsselkompetenzen/;
const ids = new Set();
(function walk(n, path) {
  if (n.modulNr) { if (!SKIP.test(path)) ids.add(n.modulNr); return; }
  (n.children || []).forEach(c => walk(c, path + ' / ' + n.name));
})(tree, '');
const cache = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const todo = [...ids].filter(i => !cache[i]);
console.error(`${ids.size} Module, ${todo.length} zu laden`);

const val = x => (x && (x.value ?? '')) || '';
const de = x => { const t = x?.translations?.translation || []; return (t.find(y => y.lang === 'de')?.value) || val(x); };
const en = x => { const t = x?.translations?.translation || []; return (t.find(y => y.lang === 'en')?.value) || ''; };

async function load(id) {
  const url = `https://campus.tum.de/tumonline/ee/rest/slc.cm.reg/student/modules/detail/light/${id}/study-year/${SJ}`;
  for (let t = 0; t < 4; t++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' } });
      if (r.ok) {
        const d = (await r.json()).resource?.[0]?.content?.moduleTemplateDetailDto;
        if (!d) return { fehler: 'keine Daten' };
        const f = {};
        for (const g of d.nodeDescription?.nodeDescriptionGroupingDtos || [])
          for (const v of g.nodeDescriptionValueDtos || [])
            f[v.descriptionName.value] = { de: (v.descriptionValues || []).map(de).join('\n'), en: (v.descriptionValues || []).map(en).join('\n') };
        const g = k => f[k]?.de || '';
        return {
          kennung: d.identification, titel: de(d.name), titelEn: en(d.name), ects: d.credits?.value,
          turnus: g('Turnus'), sprache: g('Sprache'), dauer: g('Moduldauer'),
          praesenz: g('Präsenzstunden'), lehrstuhl: de(d.organisation?.name), orgId: d.organisation?.id,
          verantwortlich: d.nodeResponsiblePerson ? `${d.nodeResponsiblePerson.firstName} ${d.nodeResponsiblePerson.lastName}` : '',
          voraussetzungen: g('(Empfohlene) Voraussetzungen'), lernergebnisse: g('Angestrebte Lernergebnisse'),
          inhalt: g('Inhalt'), pruefung: g('Beschreibung der Studien-/Prüfungsleistungen'),
          wiederholung: g('Prüfungswiederholung im Folgesemester'),
        };
      }
      if (r.status === 404) return { fehler: '404' };
    } catch {}
    await new Promise(r => setTimeout(r, 1500 * (t + 1)));
  }
  return { fehler: 'fetch' };
}

let done = 0;
async function worker() {
  while (todo.length) {
    const id = todo.shift();
    cache[id] = await load(id);
    if (++done % 50 === 0) { console.error(done); fs.writeFileSync(OUT, JSON.stringify(cache)); }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
fs.writeFileSync(OUT, JSON.stringify(cache));
console.error('fertig', Object.values(cache).filter(x => x.fehler).length, 'Fehler');
