// Crawlt den öffentlichen TUMonline-SPO-Baum (M.Sc. Maschinenwesen, pStpStpNr=5343)
import fs from 'node:fs';
import { studienjahr } from './semester-lib.mjs';
const OUT = process.argv[2];
const STP = 5343, SJ = await studienjahr(); // Studienjahr: automatisch, oder per Umgebungsvariable SJ
const base = `https://campus.tum.de/tumonline/wbStpCs.cbSpoTree?pStStudiumNr=&pStpStpNr=${STP}&pStPersonNr=&pSJNr=${SJ}&pIsStudSicht=FALSE&pShowErg=J&pHideInactive=TRUE&pCaller=`;
const dec = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').trim();

function parseRows(html) {
  const rows = [];
  const parts = html.split(/<tr class="coRow[^"]*coTableR[^"]*" id="kn(\d+)">/);
  for (let i = 1; i < parts.length; i += 2) {
    const id = parts[i], body = parts[i + 1].split('</tr>')[0];
    const m = body.match(/<span class="KnotenText[^"]*" title="([^"]*)">([^<]*)<\/span>/);
    if (!m) continue;
    const cells = [...body.matchAll(/<td class=" [LCR]">([\s\S]*?)<\/td>/g)].map(c => c[1]);
    const txt = c => dec((c || '').replace(/<[^>]*>/g, ''));
    const mod = body.match(/modules\/detail\/light\/(\d+)/);
    rows.push({ knoten: id, typ: dec(m[1]), name: dec(m[2]), sem: txt(cells[2]), ects: txt(cells[3]), modulNr: mod ? mod[1] : null });
  }
  return rows;
}

async function get(url) {
  for (let t = 0; t < 4; t++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }); if (r.ok) return await r.text(); } catch {}
    await new Promise(r => setTimeout(r, 1000 * (t + 1)));
  }
  throw new Error('fetch failed ' + url);
}

async function children(k) {
  const html = await get(`${base}&pStpKnotenNr=${k}&pId=kn${k}&pAction=0&pStpSTypNr=&pStartSemester=`);
  return parseRows(html);
}

const root = { knoten: '3908241', typ: 'SPO-Version', name: '[20241] Maschinenwesen', ects: '120', children: [] };
async function walk(node, depth) {
  if (/Modulknoten/.test(node.typ)) return; // Module nicht weiter aufklappen (darunter: Lehrveranstaltungen)
  const kids = await children(node.knoten);
  node.children = kids;
  console.error('  '.repeat(depth) + node.name + ' -> ' + kids.length);
  for (const c of kids) await walk(c, depth + 1);
}
await walk(root, 0);
fs.writeFileSync(OUT, JSON.stringify(root, null, 1));
