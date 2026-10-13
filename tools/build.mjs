// Baut data/modules.json + data/modules.js aus Baum + Moduldetails
import fs from 'node:fs';
import path from 'node:path';
const [, , TREE, DETAILS, OUTDIR] = process.argv;
const tree = JSON.parse(fs.readFileSync(TREE, 'utf8'));
const det = JSON.parse(fs.readFileSync(DETAILS, 'utf8'));

// Planungsbereiche laut Studiengangsdokumentation M.Sc. MW (Stand 23.10.2025), Kap. 6
const BEREICHE = [
  { id: 'MM_G', name: 'Ingenieurwissenschaftliche Grundlagen', gruppe: 'Mastermodule', min: 20, match: /Ingenieurwissenschaftliche Grundlagen$/ },
  { id: 'MM_K', name: 'Kernfächer des Maschinenwesens', gruppe: 'Mastermodule', max: 40, match: /Kernfächer des Maschinenwesens$/ },
  { id: 'MM_A', name: 'Angrenzende Fachgebiete', gruppe: 'Mastermodule', max: 15, match: /Angrenzende Fachgebiete/ },
  { id: 'MM_F', name: 'Ingenieurwiss. Flexibilisierung', gruppe: 'Mastermodule', max: 15, match: /Flexibilisierung/ },
  { id: 'HP', name: 'Hochschulpraktika', soll: 8, match: /^Hochschulpraktika/ },
  { id: 'IE', name: 'International Experience / Ergänzungsfächer', soll: 6, match: /^International Experience/ },
  { id: 'FP', name: 'Forschungspraxis', soll: 11, match: /^Forschungspraxis/ },
  { id: 'UE_E', name: 'Ethik des menschzentrierten Ingenieurwesens', gruppe: 'Überfachliche Ergänzung', min: 3, match: /Ethik des menschzentrierten/ },
  { id: 'UE', name: 'Überfachliche Ergänzung (sonstige)', gruppe: 'Überfachliche Ergänzung', match: /^Überfachliche Ergänzung/ },
  { id: 'MT', name: 'Master’s Thesis', soll: 30, match: /^Master.s Thesis/ },
  { id: 'AUF', name: 'Auflagen', ausserhalb: true, match: /^Auflagen/ },
];
const GRUPPEN = [
  { id: 'Mastermodule', soll: 60 },
  { id: 'Überfachliche Ergänzung', soll: 5 },
];

// Fokusbereiche: die 8 Forschungsbereiche aus Abb. 2 der Studiengangsdokumentation + 4 ergänzende.
// Zuordnung automatisch über Lehrstuhl und Modultitel (Heuristik, in der App änderbar).
const FOKUS = [
  { id: 'luft', name: 'Luft- und Raumfahrt', offiziell: true,
    chair: /Flugsystem|Hubschrauber|Turbomaschinen und Flug|Raumfahrt|Spaceflight|Lunare|Astrodynamik|Spacecraft|Luft- und Raumfahrt|eAviation|Aerial|Satelliten/,
    title: /Flug|Aircraft|Aero(?!sol)|Raumfahrt|Space|Satellit|Helicopter|Hubschrauber|Rocket|Rakete|Orbit|Luftfahrt|Turbomach|Flight|Aviation|Avionik|Drohne|Drone|Planet|Lunar/i },
  { id: 'prozess', name: 'Anlagen- und Prozesstechnik', offiziell: true,
    chair: /Anlagen- und Prozess|Bioseparation|Systembiotechnologie|Bioprozess|Chemie|Thermofluid/,
    title: /Verfahrens|Prozesstechnik|Anlagentechnik|Reaktor|Bioprozess|Bioseparation|Chemisch|Chemical|Verbrennung|Combustion|Partikel|Particle|Mehrphasen|Multiphase|Trenn|Process Engineering|Kristallis|Destillation|Bioverfahren/i },
  { id: 'energie', name: 'Energiesysteme', offiziell: true,
    chair: /Energiesysteme|Energiespeicher|Nukleartechnik|Windenergie|Energiewandlung|Energiemanagement|Energieversorgung|Thermodynamik|Umrichter/,
    title: /Energie|Energy|Solar|Wind|Kraftwerk|Batterie|Battery|Nuklear|Nuclear|Kerntechnik|Wasserstoff|Hydrogen|Brennstoffzelle|Fuel Cell|Wärme|Heat|Dampf|Turbine|Speicher|Kernfusion|Fusion|Fuels|Elektrochem|Photovolta|Reaktorphysik|Strahlung/i },
  { id: 'produktion', name: 'Produktion und Logistik', offiziell: true,
    chair: /Werkzeugmaschinen|Umformtechnik|Additive|Fördertechnik|Produktions|Supply Chain|Operations Management|Logistik|Production Engineering|Digital Fabrication|Laser-based/,
    title: /Produktion|Fertigung|Fabrik|Logisti|Materialfluss|Fördertechnik|Montage|Additive|Fügetechn|Füge|Umform|Gieß|Werkzeugmaschin|Manufactur|Production|Supply Chain|Qualitätsmanagement|Lean|Scheduling|Intralogistik|Zerspan|Laser|Kreislauf|Circular/i },
  { id: 'medizin', name: 'Medizintechnik', offiziell: true,
    chair: /Medizinger|Medizintechnische|Medizinische Informatik|Biomechanical|Bildgebung|Orthopädie|Chirurgie|Nuklearmedizin|Biomedizin/,
    title: /Medizin|Medical|Biomed|Biomech|Bioengineering|Implantat|Klinik|Chirurg|Prothes|Orthop|Health|Gesundheit|Epidem|BioMEMS|Mikrofluid|Microfluid|Biorobot|Biomateri|Tissue|Gewebe|Rehabil/i },
  { id: 'material', name: 'Materialwissenschaften', offiziell: true,
    chair: /Werkstoff|Carbon Composites|Biopolymer|Materials Engineering|Zerstörungsfreie|Materials Model/,
    title: /Werkstoff|Material|Composite|Verbundwerk|Faser|Fiber|Polymer|Kunststoff|Metall|Metal|Keramik|Ceramic|Zerstörungsfrei|Korrosion|Leichtbau|Lightweight|Legierung|Alloy/i },
  { id: 'robotik', name: 'Robotik', offiziell: true,
    chair: /Regelungstechnik|Automatisierung|Kognitive Systeme|Agrarmechatronik|Autonomous|Robot/,
    title: /Robot|Regelung|Control|Mechatron|Autonom|Automatisierung|Automation|Sensor|Vision|Reinforcement|Bewegungstechnik|Motion|Kinemat|Manipulat|Human-Robot|Cognitive/i },
  { id: 'fahrzeug', name: 'Fahrzeugtechnik', offiziell: true,
    chair: /Fahrzeugtechnik|Nachhaltige Mobile Antriebs|Akustik mobiler|Autonome Fahrzeug|Vernetzte Verkehr|Future Mobility|Agrarsystemtechnik|Verkehrstechnik|Hyperloop/,
    title: /Fahrzeug|Vehicle|Automobil|Automotive|Antriebsstrang|Powertrain|Mobilit|Verkehr|Traffic|Traktor|Tractor|Verbrennungsmotor|Motoren|Straßen|Off-road|Kraftfahr|Elektromobil|Rennwagen|Landmaschin|Agrar|Bahn|Schienen/i },
  { id: 'mechanik', name: 'Mechanik, Strömung & Simulation', offiziell: false,
    chair: /Angewandte Mechanik|Numerische Mechanik|Computational Mechanics|Höchstleistungsrechnern|Aerodynamik und Strömung|Thermofluid|Strömungsbeeinflussung|Multiscale|Simulation of Additive|Risikoanalyse|Statik und Dynamik|Baumechanik/,
    title: /Mechanik|Mechanics|Finite|FEM|CFD|Strömung|Fluid|Flow|Turbul|Simulation|Numeri|Dynamik|Dynamics|Schwingung|Vibration|Akustik|Acoustic|Kontinuum|Continuum|Optimi|Uncertainty|Gasdynamik|Tribolog/i },
  { id: 'entwicklung', name: 'Produktentwicklung & Ergonomie', offiziell: false,
    chair: /Produktentwicklung|Ergonomie|Maschinenelemente|Integrated Product Design/,
    title: /Produktentwicklung|Product Development|Konstruktion|Design(?! of Experiments)|Ergonom|Human Factors|Maschinenelement|Getriebe|Zahnr|Zuverlässig|Reliability|Systems Engineering|Menschmodell|Usability/i },
  { id: 'informatik', name: 'Informatik, E-Technik & KI', offiziell: false,
    chair: /Department of Computer|Department of Electrical|Informatik|Informationstechnik|Messsystem|Geospatial|Biomedizinische Elektronik/,
    title: /Software|Informatik|Comput|Daten|Data|Machine Learning|Deep|\bKI\b|Künstliche|Artificial|Intelligen|Echtzeit|Real-Time|Elektron|Electr|Programm|Algorithm|Netzwerk|Network|Cyber|Digital|Python|Embedded/i },
  { id: 'wirtschaft', name: 'Wirtschaft & Management', offiziell: false,
    chair: /Economics|Business|Finanz|Finance|Controlling|Accounting|Entrepreneur|Innovation|Governance|Wirtschaftsrecht|Immobilien|Unternehmensführung|Operations Management/,
    title: /Management|Economics|Finance|Wirtschaft|Controlling|Entrepreneur|Innovation|Patent|Recht|Law|Business|Marketing|Kosten|Unternehm|Startup|Projektmanagement/i },
];

// TUMonline liefert manche Texte doppelt (zwei identische Hälften) → eine Hälfte behalten
const dedupe = s => {
  s = (s || '').trim(); const h = Math.floor(s.length / 2);
  for (let i = h - 3; i <= h + 3; i++) if (i > 10 && s.slice(0, i).trim() === s.slice(i).trim()) return s.slice(0, i).trim();
  return s;
};
const cut = (s, n) => { s = dedupe(s).replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(); return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + ' …' : s; };
const sprache = s => /englisch|english/i.test(s) && /deutsch|german/i.test(s) ? 'de/en' : /englisch|english/i.test(s) ? 'en' : /deutsch|german/i.test(s) ? 'de' : (s || '?');
const turnus = s => /winter/i.test(s) && /sommer/i.test(s) ? 'WiSe+SoSe' : /winter/i.test(s) ? 'WiSe' : /sommer/i.test(s) ? 'SoSe' : /jedes|both|semester/i.test(s) ? 'WiSe+SoSe' : (s || '?');

const module = new Map();
function addModule(n, bereichId, pfad) {
  const d = det[n.modulNr] || {};
  const name = n.name.replace(/^\[[^\]]*\]\s*/, '');
  const kennung = (n.name.match(/^\[([^\]]*)\]/) || [])[1] || d.kennung || '';
  let m = module.get(n.modulNr);
  if (!m) {
    m = {
      id: n.modulNr, kennung, titel: d.titel || name, titelEn: d.titelEn && d.titelEn !== d.titel ? d.titelEn : '',
      ects: Number(n.ects || d.ects || 0), turnus: turnus(d.turnus), sprache: sprache(d.sprache), spracheRaw: d.sprache || '',
      lehrstuhl: d.lehrstuhl || '', verantwortlich: d.verantwortlich || '', praesenz: d.praesenz || '',
      inhalt: cut(d.inhalt, 900), lernziele: cut(d.lernergebnisse, 600), voraussetzungen: cut(d.voraussetzungen, 700), _vFull: d.voraussetzungen || '',
      pruefung: cut(d.pruefung, 500), bereiche: [], pfade: [], fokus: [],
    };
    module.set(n.modulNr, m);
  }
  if (!m.bereiche.includes(bereichId)) m.bereiche.push(bereichId);
  if (!m.pfade.includes(pfad)) m.pfade.push(pfad);
}

function walk(n, bereich, pfad) {
  for (const c of n.children || []) {
    const b = bereich || BEREICHE.find(b => b.match.test(c.name))?.id || null;
    // Ethik-Unterknoten überschreibt den allgemeinen Bereich UE
    const b2 = /Ethik des menschzentrierten/.test(c.name) ? 'UE_E' : b;
    if (c.modulNr) { if (b2) addModule(c, b2, pfad); }
    else walk(c, b2, pfad ? pfad + ' › ' + c.name : c.name);
  }
}
for (const top of tree.children) {
  const b = BEREICHE.find(b => b.match.test(top.name));
  if (top.modulNr) { if (b) addModule(top, b.id, ''); continue; }
  walk(top, b?.id === 'UE' ? 'UE' : b?.id, top.name);
}
// Unterbereiche der Mastermodule erkennen (Baum: Mastermodule › X)
for (const m of module.values()) {
  const neu = [];
  for (const p of m.pfade) {
    const b = BEREICHE.find(b => b.gruppe === 'Mastermodule' && b.match.test(p.split(' › ')[1] || ''));
    if (b) neu.push(b.id);
  }
  if (neu.length) m.bereiche = [...new Set([...neu, ...m.bereiche.filter(x => !x.startsWith('MM') && x !== undefined)])];
  m.bereiche = m.bereiche.filter(Boolean);
}

for (const m of module.values()) {
  if (m.bereiche.includes('AUF') && m.bereiche.length === 1) continue;
  for (const f of FOKUS) if (f.chair.test(m.lehrstuhl) || f.title.test(m.titel) || f.title.test(m.titelEn)) m.fokus.push(f.id);
}

// Beispielprofile aus Studiengangsdokumentation (Kap. 2 + 6) – empfohlene Module per Titel
// Voraussetzungs-Graph: Verweise im Voraussetzungstext auf andere Katalogmodule erkennen
const PRE_TARGET = new Set(['MM_G', 'MM_K', 'MM_A', 'MM_F', 'HP', 'IE']);
const GENERIC = new Set(['regelungstechnik', 'thermodynamik', 'technische mechanik', 'fluidmechanik', 'werkstoffkunde', 'maschinenelemente', 'grundlagen der informatik', 'introduction to', 'technische dynamik', 'process engineering', 'kinematics', 'derivatives', 'renewable energy', 'erneuerbare energien', 'industrial management', 'tech challenge', 'parallel programming', 'robotics', 'assembly technologies', 'medizin 1']);
const pn = s => ' ' + (s || '').toLowerCase().normalize('NFC').replace(/[^a-z0-9äöüß]+/g, ' ').trim() + ' ';
const keys = []; // { key, ids }
{
  const byKey = new Map();
  for (const m of module.values()) {
    if (!m.bereiche.some(b => PRE_TARGET.has(b))) continue;
    for (const k of [pn(m.titel), pn(m.titelEn), m.kennung && m.kennung.length >= 5 ? pn(m.kennung) : null]) {
      if (!k) continue;
      const t = k.trim();
      if (t.length < 10 && !/^[a-z]{2,3}\d{3,}/.test(t)) continue;
      if (GENERIC.has(t)) continue;
      if (!byKey.has(k)) byKey.set(k, new Set());
      byKey.get(k).add(m.id);
    }
  }
  for (const [key, ids] of byKey) keys.push({ key, ids: [...ids] });
  keys.sort((a, b) => b.key.length - a.key.length);
}
const prefer = ids => [...ids].sort((a, b) => {
  const s = id => (module.get(id).bereiche.some(x => x.startsWith('MM')) ? 0 : 1);
  return s(a) - s(b);
})[0];
let kanten = 0;
for (const m of module.values()) {
  m.bautAuf = []; m.grundlageFuer = m.grundlageFuer || [];
  const v = pn(m._vFull);
  delete m._vFull;
  if (v.trim().length < 5) continue;
  m.vorausWeich = /empfohlen|empfehlenswert|wünschenswert|von vorteil|hilfreich|recommended|helpful|advantage|desirable|nicht (zwingend|erforderlich|notwendig)|not (required|mandatory)/i.test(m.voraussetzungen);
  const covered = [];
  const own = pn(m.titel).trim();
  for (const { key, ids } of keys) {
    let pos = v.indexOf(key), hit = false;
    while (pos !== -1) {
      const a0 = pos + 1, end = pos + key.length - 1; // ohne Rand-Leerzeichen
      if (!covered.some(([a, b]) => a0 < b && end > a)) { covered.push([a0, end]); hit = true; }
      pos = v.indexOf(key, pos + 1);
    }
    if (!hit) continue;
    const cand = ids.filter(id => {
      if (id === m.id) return false;
      const t = pn(module.get(id).titel).trim();
      return !(t.startsWith(own) || own.startsWith(t)); // Varianten desselben Moduls
    });
    if (!cand.length) continue;
    const id = prefer(cand);
    if (!m.bautAuf.includes(id)) { m.bautAuf.push(id); kanten++; }
  }
}
for (const m of module.values()) for (const id of m.bautAuf) {
  const o = module.get(id); o.grundlageFuer = o.grundlageFuer || [];
  if (!o.grundlageFuer.includes(m.id)) o.grundlageFuer.push(m.id);
}
console.error('Voraussetzungs-Kanten:', kanten, '| Module mit bautAuf:', [...module.values()].filter(m => m.bautAuf.length).length);

const PROFILE = [
  { name: 'Logistik und Energie', fokus: ['produktion', 'energie'], titel: ['Planung Technischer Logistiksysteme', 'Elektrische Maschinen', 'Logistik in der Automobilindustrie', 'Energieträger für mobile Anwendungen', 'Energietechnisches Praktikum', 'Praktikum Simulation von Logistiksystemen'] },
  { name: 'Luft- und Raumfahrt und Medizintechnik', fokus: ['luft', 'medizin'], titel: [] },
  { name: 'Product Development for Aerospace Applications', fokus: ['luft', 'entwicklung'], titel: ['Additive Fertigung mit Metallen', 'Aerodynamic Design of Turbomachinery', 'Aircraft Systems', 'Patent-, Marken- und Musterrecht für Ingenieure', 'Finite Elemente Methode (FEM) mit Schwerpunkt Luft- und Raumfahrtstrukturen', 'Konstruktion für die Additive Fertigung'] },
  { name: 'Grundlagen- und Forschungsorientierung', fokus: ['mechanik', 'material'], titel: ['Strömungsphysik und Modellgesetze', 'Angewandte Mechanik Seminar', 'Praktikum Finite Elemente', 'Praktikum Simulationstechnik', 'Zerstörungsfreie Prüfung'] },
];
const norm = s => s.toLowerCase().replace(/[^a-zäöüß0-9]/g, '');
for (const p of PROFILE) {
  p.module = [];
  for (const t of p.titel) {
    const hit = [...module.values()].filter(m => norm(m.titel).startsWith(norm(t)) || norm(m.titelEn).startsWith(norm(t)));
    p.module.push(...hit.map(h => h.id));
    if (!hit.length) console.error('Profil-Modul nicht gefunden:', t);
  }
  delete p.titel;
}

const data = {
  studiengang: 'M.Sc. Maschinenwesen (TUM School of Engineering and Design)',
  spo: '[20241] Maschinenwesen', stand: new Date().toISOString().slice(0, 10), studienjahr: '2026/27',
  quellen: [
    { name: 'TUMonline Studienplan (öffentlich)', url: 'https://campus.tum.de/tumonline/wbstpcs.showSpoTree?pStpStpNr=5343&pFilterType=1&pStartSemester=W&pSjNr=1623' },
    { name: 'Studiengangsdokumentation M.Sc. MW (23.10.2025)', url: 'https://www.tum.de/fileadmin/w00bfo/www/Studium/Studienangebot/Lesbare_Fassung/Master/Maschinenwesen_MA_Studiengangsdokumentation_23102025.pdf' },
    { name: 'Studiengangsseite ED', url: 'https://www.ed.tum.de/en/ed/studies/degree-programs/mechanical-engineering-m-sc/' },
  ],
  bereiche: BEREICHE.map(({ match, ...b }) => b), gruppen: GRUPPEN,
  fokus: FOKUS.map(({ chair, title, ...f }) => f), profile: PROFILE,
  module: [...module.values()].sort((a, b) => a.titel.localeCompare(b.titel, 'de')),
};
fs.mkdirSync(OUTDIR, { recursive: true });
fs.writeFileSync(path.join(OUTDIR, 'modules.json'), JSON.stringify(data, null, 1));
fs.writeFileSync(path.join(OUTDIR, 'modules.js'), 'window.DATA = ' + JSON.stringify(data) + ';\n');
const cnt = {}; for (const m of data.module) for (const b of m.bereiche) cnt[b] = (cnt[b] || 0) + 1;
const fc = {}; for (const m of data.module) for (const f of m.fokus) fc[f] = (fc[f] || 0) + 1;
console.error(data.module.length, 'Module', cnt, fc, 'ohne Fokus (MM):', data.module.filter(m => !m.fokus.length && m.bereiche.some(b => b.startsWith('MM'))).map(m => m.titel + ' | ' + m.lehrstuhl));
