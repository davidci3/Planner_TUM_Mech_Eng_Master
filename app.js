(function () {
  'use strict';
  const D = window.DATA;
  if (!D) { document.body.innerHTML = '<p style="padding:20px">Die Datei data/modules.js fehlt. Bitte den ganzen Ordner (inkl. data/) behalten.</p>'; return; }

  const B = Object.fromEntries(D.bereiche.map(b => [b.id, b]));
  const F = Object.fromEntries(D.fokus.map(f => [f.id, f]));
  const M = Object.fromEntries(D.module.map(m => [m.id, m]));
  const PAGE = 60;
  const MM = ['MM_G', 'MM_K', 'MM_A', 'MM_F'];
  const BEREICH_ORDER = ['MM_G', 'MM_K', 'MM_A', 'MM_F', 'HP', 'IE', 'FP', 'UE_E', 'UE', 'MT', 'AUF'];
  const SHORT = { MM_G: 'Grundlagen', MM_K: 'Kernfach', MM_A: 'Angrenzend', MM_F: 'Flexi', HP: 'Praktikum', IE: 'Int. Exp.', FP: 'Forschungspraxis', UE_E: 'Ethik', UE: 'Überfachlich', MT: 'Thesis', AUF: 'Auflage' };
  const ST = { geplant: 'geplant', belegt: 'belegt', bestanden: 'bestanden' };
  const tkey = s => (s || '').toLowerCase().replace(/[^a-z0-9äöüß]+/g, '');
  const TK = Object.fromEntries(D.module.map(m => [m.id, tkey(m.titel)]));
  const FP_MODS = D.module.filter(m => m.bereiche.includes('FP'));
  const MT_MOD = D.module.find(m => m.bereiche.includes('MT'));

  // ---------- Zustand ----------
  const KEY = 'mw-faecheruebersicht-v1';
  const defCfg = () => ({
    startTyp: 'W', startJahr: new Date().getFullYear(), aktSem: 1, semester: 4, cpZiel: {},
    ausland: { an: false, sem: 3, ects: 30, anr: { MM_G: 0, MM_K: 0, MM_A: 0, MM_F: 15, HP: 0, IE: 6, UE: 0 } },
    sprache: 'beide', ziel: { MM_G: 20, MM_K: 25, MM_A: 0, MM_F: 15 },
    fpArt: (FP_MODS.find(m => /Semesterarbeit/.test(m.titel)) || FP_MODS[0] || {}).id || null,
    fpSem: 3, thesisSem: 4, hpSem: [2, 3], maxModule: 7, vorausStreng: true, auflagen: false, ausschluss: [],
  });
  const defaults = () => ({
    fokus: [], fokus2: [], profil: null, plan: {},
    filter: { q: '', bereiche: [...MM], fokusMode: 'alle', sprache: 'alle', turnus: 'alle', ects: 'alle', nurPlan: false, nurReco: false, ohneVor: false, grundlage: false, imSem: false },
    sort: 'relevanz', tab: 'katalog', cfg: defCfg(), wizStep: 0, wizDone: false,
    // aktuelles Semester: Auswahl { modulId: {} }, Gruppenwahl { kursId: index }, nicht besuchte Kurse, eigene Präsenz-Einstufung
    semAuswahl: {}, semAusgeblendet: {}, semSnap: {}, kursWahl: {}, kursAus: {}, praesenz: {}, semView: 'auswahl', semWoche: null, nurPflicht: false, semAlle: false,
  });
  let S = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      S = { ...S, ...s, filter: { ...S.filter, ...(s.filter || {}) }, cfg: { ...defCfg(), ...(s.cfg || {}) } };
      S.cfg.ausland = { ...defCfg().ausland, ...(S.cfg.ausland || {}) };
      S.cfg.ausland.anr = { ...defCfg().ausland.anr, ...(S.cfg.ausland.anr || {}) };
      S.cfg.ziel = { ...defCfg().ziel, ...(S.cfg.ziel || {}) };
    }
  } catch (e) {}
  // Migration altes Format { id: bereich }
  const planEntfernt = [], planErsetzt = []; // Module, die es im (neu geladenen) Studienplan nicht mehr gibt
  // Nach einer Katalog-Aktualisierung: Module mit neuer Kennung, aber gleichem Titel auf das neue Modul umziehen
  const katDiff = (() => { try { return JSON.parse(localStorage.getItem('mw-faecheruebersicht-katalog-diff') || 'null'); } catch (e) { return null; } })();
  const nachfolger = id => {
    const alt = katDiff && katDiff.weg.find(x => x.id === id);
    const n = alt && katDiff.neu.find(x => x.titel.toLowerCase() === alt.titel.toLowerCase() && M[x.id]);
    return n ? n.id : null;
  };
  for (const [id, v] of Object.entries(S.plan)) {
    if (!M[id]) {
      const n = nachfolger(id);
      if (n && !S.plan[n] && typeof v === 'object') { S.plan[n] = { ...v, b: M[n].bereiche.includes(v.b) ? v.b : M[n].bereiche[0] }; planErsetzt.push([id, n]); }
      else planEntfernt.push(id);
      delete S.plan[id]; continue;
    }
    if (typeof v === 'string') S.plan[id] = { b: v, sem: null, st: 'geplant', lock: false };
  }
  if (!Array.isArray(S.fokus2)) S.fokus2 = [];
  for (const k of ['semAuswahl', 'semAusgeblendet', 'semSnap', 'kursWahl', 'kursAus', 'praesenz']) if (!S[k] || typeof S[k] !== 'object') S[k] = {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  if (planErsetzt.length || planEntfernt.length) save(); // Umstellung sofort sichern
  const C = () => S.cfg;

  let shown = PAGE;
  const open = new Set();
  const altSkip = new Set();
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const recoSet = () => new Set(S.profil != null && D.profile[S.profil] ? D.profile[S.profil].module : []);
  const tumUrl = id => `https://campus.tum.de/tumonline/ee/ui/ca2/app/desktop/#/slc.cm.reg/student/modules/detail/light/${id}/study-year/1623`;

  $('sub').textContent = `${D.spo} · ${D.module.length} Module · Datenstand ${new Date(D.stand).toLocaleDateString('de-DE')} (öffentlicher TUMonline-Studienplan)`;
  $('footer').innerHTML = 'Quellen: ' + D.quellen.map(q => `<a href="${esc(q.url)}" target="_blank" rel="noopener">${esc(q.name)}</a>`).join(' · ') +
    '. Voraussetzungen wurden automatisch aus den Modulbeschreibungen erkannt. Ohne Gewähr: Verbindlich sind TUMonline und die FPSO.' +
    '<br>Dein Plan wird nur in diesem Browser gespeichert. Niemand sonst sieht oder verändert ihn. Zum Sichern oder für ein anderes Gerät: „Mein Plan“ → Export/Import.';

  // ---------- Semester ----------
  function semInfo(i) {
    const c = C(), h = c.startJahr * 2 + (c.startTyp === 'S' ? 0 : 1) + (i - 1);
    const typ = h % 2 === 0 ? 'S' : 'W', y = Math.floor(h / 2), yy = n => String(n).slice(-2);
    return { typ, label: typ === 'S' ? `SoSe ${y}` : `WiSe ${yy(y)}/${yy(y + 1)}` };
  }
  const semList = () => Array.from({ length: C().semester }, (_, i) => i + 1);
  const turnusKnown = m => /WiSe|SoSe/.test(m.turnus);
  const turnusOk = (m, s) => !turnusKnown(m) || m.turnus.includes(semInfo(s).typ === 'W' ? 'WiSe' : 'SoSe');
  const isAbroad = s => C().ausland.an && Number(C().ausland.sem) === s;
  const auslandCP = () => C().ausland.an ? Number(C().ausland.ects) || 0 : 0;
  const anr = b => C().ausland.an ? Number(C().ausland.anr[b]) || 0 : 0;

  // ---------- Aktuelles Semester: Daten (Kurse, Termine, Präsenzpflicht, Prüfungen) ----------
  const SEMD = window.SEMESTER || null;
  const SM = SEMD ? SEMD.module : {};
  const termLabel = SEMD ? (y => SEMD.typ === 'W' ? `WiSe ${String(y).slice(-2)}/${String(y + 1).slice(-2)}` : `SoSe ${y}`)(Number(SEMD.start.slice(0, 4))) : '';
  const DAY0 = SEMD ? new Date(SEMD.start + 'T00:00:00') : new Date();
  const dateOf = d => new Date(DAY0.getFullYear(), DAY0.getMonth(), DAY0.getDate() + d);
  const dayOfDate = dt => Math.round((Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()) - Date.UTC(DAY0.getFullYear(), DAY0.getMonth(), DAY0.getDate())) / 864e5);
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const hm = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const ddmm = dt => dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  const isoDate = s => new Date(s + 'T00:00:00');
  const fmtIso = (s, long) => isoDate(s).toLocaleDateString('de-DE', long ? { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' } : { day: '2-digit', month: '2-digit', year: 'numeric' });
  const roomName = i => (SEMD && i >= 0 ? SEMD.raeume[i] : '');
  const offered = id => !!(SM[id] && SM[id].kurse.length);
  const exams = id => (SM[id] && SM[id].pruefungen) || [];
  const mainExam = id => { const p = exams(id).filter(x => x.datum); return p.find(x => x.eigenes) || p[0] || null; };
  const curPlanSem = () => SEMD ? semList().find(s => semInfo(s).label === termLabel) ?? null : null;
  const PZ_LABEL = { ja: 'Präsenzpflicht', erster: 'Pflicht: 1. Termin', unklar: 'Präsenz unklar', nein: 'keine Pflicht' };
  const PZ_ORDER = ['ja', 'erster', 'unklar', 'nein'];
  const pflicht = k => S.praesenz[k.id] || k.praesenz;
  const kursTitel = k => k.titel.replace(/\s*\([A-Z]{2,}[0-9A-Z]*\)\s*$/, '');
  const kursTermine = (k, g) => [...(k.gemeinsam || []), ...((k.gruppen[g] || {}).t || [])].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const kursTypen = id => [...new Set((SM[id] ? SM[id].kurse : []).map(k => k.typ))].join('·');
  const hatPflicht = id => (SM[id] ? SM[id].kurse : []).some(k => pflicht(k) === 'ja');
  // regelmäßige Termine zusammenfassen: „Mo 15:30–18:00 (15×) · 12.10.–01.02.“
  function serieText(t, kurz) {
    if (!t.length) return 'keine Termine eingetragen';
    const pat = new Map();
    for (const [d, s, e] of t) { const k = `${WD[dateOf(d).getDay()]} ${hm(s)}–${hm(e)}`; pat.set(k, (pat.get(k) || 0) + 1); }
    const reg = [...pat].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
    if (kurz) return reg.length ? reg.map(([k]) => k).join(', ') : `${t.length} Termin${t.length > 1 ? 'e' : ''} ab ${ddmm(dateOf(t[0][0]))}`;
    const einzel = t.length - reg.reduce((x, [, n]) => x + n, 0);
    const first = dateOf(t[0][0]), last = dateOf(t[t.length - 1][0]);
    let s = reg.map(([k, n]) => `${k} (${n}×)`).join(', ');
    if (einzel) s += (s ? ' + ' : '') + (reg.length ? `${einzel} weitere${einzel === 1 ? 'r Termin' : ' Termine'}` : einzel === 1 ? `${WD[first.getDay()]} ${ddmm(first)} ${hm(t[0][1])}–${hm(t[0][2])}` : `${einzel} Einzel-/Blocktermine`);
    return s + (t.length > 1 ? ` · ${ddmm(first)}–${ddmm(last)}` : '');
  }

  function capacities() {
    const c = C(), cap = {}, sems = semList();
    const fixedPast = Object.entries(S.plan).filter(([, e]) => e.sem && e.sem < c.aktSem).reduce((t, [id]) => t + M[id].ects, 0);
    const plan = sems.filter(s => s >= c.aktSem);
    let rest = 120 - fixedPast, others = [];
    for (const s of plan) {
      if (isAbroad(s)) { cap[s] = auslandCP(); rest -= cap[s]; }
      else if (s === Number(c.thesisSem)) { cap[s] = 30; rest -= 30; }
      else others.push(s);
    }
    const share = others.length ? Math.max(0, rest) / others.length : 0;
    for (const s of others) cap[s] = Math.round(share);
    for (const s of sems) if (s < c.aktSem) cap[s] = null;
    for (const [s, v] of Object.entries(c.cpZiel)) if (v !== '' && v != null && cap[s] !== undefined && cap[s] !== null) cap[s] = Number(v);
    return cap;
  }

  // ---------- Plan-Helfer ----------
  const entries = () => Object.entries(S.plan).filter(([id]) => M[id]);
  const fixed = e => e.st !== 'geplant' || e.lock;
  function semLoad() {
    const l = {};
    for (const [id, e] of entries()) if (e.sem) l[e.sem] = (l[e.sem] || 0) + M[id].ects;
    if (C().ausland.an) l[C().ausland.sem] = (l[C().ausland.sem] || 0) + auslandCP();
    return l;
  }
  function bucketSums() {
    const s = {};
    for (const [id, e] of entries()) s[e.b] = (s[e.b] || 0) + M[id].ects;
    if (C().ausland.an) for (const [b, v] of Object.entries(C().ausland.anr)) if (Number(v)) s[b] = (s[b] || 0) + Number(v);
    return s;
  }
  const plannedByKey = () => { const m = new Map(); for (const [id, e] of entries()) m.set(TK[id], e); return m; };
  const sprOk = m => C().sprache === 'beide' || m.sprache === '?' || m.sprache.includes(C().sprache);
  function score(m, b) {
    let s = 0;
    for (const f of m.fokus) { if (S.fokus.includes(f)) s += 3; else if (S.fokus2.includes(f)) s += 1.5; }
    if (recoSet().has(m.id)) s += 4;
    const pk = plannedByKey();
    for (const d of m.grundlageFuer) if (pk.has(TK[d])) s += 0.8;
    if (m.bautAuf.length) {
      const ok = m.bautAuf.some(p => pk.has(TK[p]));
      if (ok) s += 0.5; else if (C().vorausStreng) s -= m.vorausWeich ? 1 : 2.5;
    }
    if (!m.inhalt) s -= 0.5;
    if (m.pfade.some(p => /Sprachenzentrum/.test(p))) s -= 0.5;
    if (b && b.startsWith('MM') && m.ects >= 5) s += 0.2;
    return s;
  }
  // bestes Semester für Modul finden
  function bestSem(m, opts = {}) {
    const c = C(), cap = capacities(), load = semLoad(), cnt = {};
    for (const [, e] of entries()) if (e.sem) cnt[e.sem] = (cnt[e.sem] || 0) + 1;
    const pk = plannedByKey();
    let lo = c.aktSem, hi = c.semester;
    for (const p of m.bautAuf) { const e = pk.get(TK[p]); if (e && e.sem && e.st === 'geplant') lo = Math.max(lo, e.sem + 1); }
    for (const d of m.grundlageFuer) { const e = pk.get(TK[d]); if (e && e.sem && e.st === 'geplant') hi = Math.min(hi, e.sem - 1); }
    let best = null, bestFree = -Infinity;
    const pref = opts.prefer || [];
    for (let s = lo; s <= hi; s++) {
      if (s === 1 && m.bereiche.includes('HP')) continue; // keine Praktika im 1. Semester
      if (isAbroad(s)) continue;
      if (!turnusOk(m, s)) continue;
      const free = (cap[s] ?? 0) - (load[s] || 0);
      if (!opts.loose) {
        if (free + 2 < m.ects) continue; // kleine Toleranz über dem Semesterziel
        if ((cnt[s] || 0) >= c.maxModule) continue;
      }
      const f = free + (pref.includes(s) ? 100 : 0) - s * 0.01;
      if (f > bestFree) { bestFree = f; best = s; }
    }
    return best;
  }
  function add(id, b, sem, st = 'geplant') { S.plan[id] = { b, sem, st, lock: false }; }

  // ---------- Generator ----------
  function generate() {
    const c = C();
    altSkip.clear();
    for (const [id, e] of entries()) if (!fixed(e)) delete S.plan[id];
    const used = () => new Set(entries().map(([id]) => TK[id]));
    const excluded = new Set(c.ausschluss);
    const missing = [];

    if (MT_MOD && !entries().some(([, e]) => e.b === 'MT')) add(MT_MOD.id, 'MT', Number(c.thesisSem));
    if (c.fpArt && M[c.fpArt] && !entries().some(([, e]) => e.b === 'FP')) add(c.fpArt, 'FP', Number(c.fpSem));

    function fill(b, target, opts = {}) {
      const all = D.module.filter(m => m.bereiche.includes(b) && m.ects > 0);
      const minE = all.length ? Math.min(...all.map(m => m.ects)) : 1;
      let guard = 0;
      while (guard++ < 40) {
        const have = bucketSums()[b] || 0, need = target - have;
        if (need <= 0) return;
        const u = used();
        const cands = all.filter(m => !u.has(TK[m.id]) && !excluded.has(m.id) && sprOk(m));
        let fit = cands.filter(m => m.ects <= need);
        if (!fit.length && opts.allowOver) fit = cands.filter(m => m.ects <= need + opts.allowOver);
        // Restmenge soll mit weiteren Modulen füllbar bleiben
        const fitBonus = m => { const rest = need - m.ects; return rest <= 0 ? 1.5 : rest < minE ? -2 : 0; };
        const ranked = fit.map(m => ({ m, s: score(m, b) + fitBonus(m) - (turnusKnown(m) ? 0 : 0.5) }))
          .sort((a, x) => x.s - a.s || a.m.titel.localeCompare(x.m.titel, 'de'));
        const pref = opts.prefer ? [opts.prefer()] : [];
        let placed = false;
        // 1. Durchgang: Kapazität und max. Module je Semester einhalten; 2. Durchgang: notfalls überbuchen
        const top = ranked.length ? ranked[0].s : 0;
        // Durchgänge: gut bewertete Kandidaten → alle ohne unfüllbaren Rest → notfalls Semester überbuchen
        const passes = [
          [ranked.filter(r => r.s >= top - 2), false],
          [ranked.filter(r => fitBonus(r.m) >= 0), false],
          [ranked.slice(0, 15), true],
        ];
        for (const [list, loose] of passes) {
          for (const { m } of list) {
            const s = bestSem(m, { prefer: pref, loose });
            if (s == null) continue;
            add(m.id, b, s); placed = true; break;
          }
          if (placed) break;
        }
        if (!placed) { missing.push(`${B[b].name}: noch ${need} CP offen – kein passendes Modul gefunden (Turnus/Semester prüfen).`); return; }
      }
    }
    let hpI = 0;
    fill('HP', 8, { prefer: () => Number(c.hpSem[hpI++ % c.hpSem.length]) });
    for (const b of ['MM_G', 'MM_A', 'MM_F']) fill(b, Number(c.ziel[b]) || 0, { allowOver: b === 'MM_G' ? 3 : 0 });
    // Kernfächer zuletzt: gleichen Über-/Unterdeckung der anderen Bereiche aus
    const other = ['MM_G', 'MM_A', 'MM_F'].reduce((t, b) => t + (bucketSums()[b] || 0), 0);
    fill('MM_K', Math.min(40, 60 - other), { allowOver: 4 });
    fill('IE', 6);
    fill('UE_E', 3);
    fill('UE', Math.max(0, 5 - (bucketSums().UE_E || 0)));
    save();
    return missing;
  }

  function alternative(id, ban) {
    const e = S.plan[id]; if (!e) return 'Modul ist nicht im Plan.';
    const m = M[id];
    altSkip.add(id);
    const sums = bucketSums();
    const tgt = { MM_G: 999, MM_K: Number(C().ziel.MM_K), MM_A: Number(C().ziel.MM_A), MM_F: Number(C().ziel.MM_F), HP: 8, IE: 6, UE_E: 99, UE: 5, FP: 11, MT: 30 }[e.b] ?? 99;
    const slack = Math.max(0, tgt - (sums[e.b] || 0)) + m.ects;
    const u = new Set(entries().filter(([x]) => x !== id).map(([x]) => TK[x]));
    const excluded = new Set(C().ausschluss);
    const cands = D.module.filter(x => x.id !== id && x.bereiche.includes(e.b) && !u.has(TK[x.id]) && !excluded.has(x.id) && !altSkip.has(x.id) && sprOk(x) &&
      x.ects > 0 && x.ects <= slack && (!e.sem || turnusOk(x, e.sem)))
      .map(x => ({ x, s: score(x, e.b) + (x.ects === m.ects ? 1 : 0) }))
      .sort((a, b) => b.s - a.s || a.x.titel.localeCompare(b.x.titel, 'de'));
    if (ban && !C().ausschluss.includes(id)) C().ausschluss.push(id);
    if (!cands.length) { if (ban) delete S.plan[id]; save(); return 'Keine weitere passende Alternative gefunden.'; }
    const n = cands[0].x;
    delete S.plan[id];
    S.plan[n.id] = { b: e.b, sem: e.sem, st: 'geplant', lock: false };
    save();
    return null;
  }

  // ---------- Warnungen ----------
  function analyse() {
    const c = C(), per = {}, glob = [], pk = plannedByKey(), load = semLoad(), cap = capacities();
    for (const [id, e] of entries()) {
      const m = M[id], w = [];
      if (e.st === 'geplant') {
        if (!e.sem) w.push({ t: 'Noch keinem Semester zugeordnet', lvl: 'warn' });
        else if (!turnusOk(m, e.sem)) w.push({ t: `Wird laut TUMonline nur im ${m.turnus} angeboten, nicht im ${semInfo(e.sem).label}`, lvl: 'bad' });
        if (e.sem && isAbroad(e.sem)) w.push({ t: 'Liegt im Auslandssemester', lvl: 'warn' });
        if (e.sem === 1 && e.b === 'HP') w.push({ t: 'Praktikum im 1. Semester – laut deinen Vorgaben erst ab dem 2. Semester', lvl: 'warn' });
      }
      for (const p of m.bautAuf) {
        const pe = pk.get(TK[p]);
        const art = m.vorausWeich ? 'empfohlen' : 'vorausgesetzt';
        if (!pe) w.push({ t: `Baut auf „${M[p].titel}“ (${art}), das nicht im Plan ist`, lvl: m.vorausWeich ? 'info' : 'warn', pre: p });
        else if (e.st === 'geplant' && pe.st !== 'bestanden' && pe.sem && e.sem && pe.sem >= e.sem) w.push({ t: `„${M[p].titel}“ sollte vorher liegen (aktuell ${pe.sem}. Semester)`, lvl: m.vorausWeich ? 'info' : 'warn', pre: p });
      }
      per[id] = w;
    }
    for (const s of semList()) {
      if (s < c.aktSem) continue;
      if ((load[s] || 0) > 35) glob.push({ t: `${s}. Semester: ${load[s]} CP sind sehr viel (mehr als 35).`, lvl: 'warn' });
      else if (cap[s] != null && (load[s] || 0) > cap[s] + 3) glob.push({ t: `${s}. Semester: ${load[s]} CP liegen über deinem Ziel von ${cap[s]} CP.`, lvl: 'info' });
    }
    const sums = bucketSums(), mm = MM.reduce((t, b) => t + (sums[b] || 0), 0);
    if (mm > 60) glob.push({ t: `Mastermodule: ${mm} CP geplant, angerechnet werden 60.`, lvl: 'warn' });
    if ((sums.MM_G || 0) < 20) glob.push({ t: `Ingenieurwiss. Grundlagen: ${sums.MM_G || 0} von mind. 20 CP.`, lvl: 'warn' });
    for (const [b, mx] of [['MM_K', 40], ['MM_A', 15], ['MM_F', 15]]) if ((sums[b] || 0) > mx) glob.push({ t: `${B[b].name}: ${sums[b]} CP, erlaubt sind max. ${mx}.`, lvl: 'bad' });
    if ((sums.UE_E || 0) < 3) glob.push({ t: 'Überfachliche Ergänzung: mind. 3 CP müssen aus „Ethik des menschzentrierten Ingenieurwesens“ kommen.', lvl: 'warn' });
    // Thesis-Zulassung
    const th = entries().find(([, e]) => e.b === 'MT');
    if (th && th[1].sem) {
      let before = 0;
      for (const [id, e] of entries()) if (e.sem && e.sem < th[1].sem && e.b !== 'AUF') before += M[id].ects;
      if (c.ausland.an && c.ausland.sem < th[1].sem) before += auslandCP();
      if (before < 80) glob.push({ t: `Master’s Thesis im ${th[1].sem}. Semester: davor sind erst ${before} CP geplant, die Zulassung braucht mind. 80 CP.`, lvl: 'bad' });
    }
    // APSO-Fortschrittskontrolle
    const cum = s => { let t = 0; for (const [id, e] of entries()) if (e.sem && e.sem <= s && e.b !== 'AUF') t += M[id].ects; if (c.ausland.an && c.ausland.sem <= s) t += auslandCP(); return t; };
    const mm2 = entries().some(([id, e]) => e.sem && e.sem <= 2 && ['MM_G', 'MM_K', 'MM_A'].includes(e.b));
    if (c.semester >= 2 && !mm2) glob.push({ t: 'APSO: Bis Ende des 2. Semesters muss ein Mastermodul (nicht aus der Flexibilisierung) bestanden sein, im Plan liegt keines davor.', lvl: 'info' });
    for (const [s, need] of [[3, 30], [4, 60], [5, 90], [6, 120]]) if (s <= c.semester && cum(s) < need) glob.push({ t: `APSO: Bis Ende des ${s}. Semesters werden ${need} CP verlangt, geplant sind ${cum(s)}.`, lvl: 'info' });
    if (c.ausland.an) {
      const sumA = Object.values(c.ausland.anr).reduce((t, v) => t + (Number(v) || 0), 0);
      if (sumA !== auslandCP()) glob.push({ t: `Auslandssemester: ${auslandCP()} ECTS geplant, davon ${sumA} angerechnet.`, lvl: 'info' });
    }
    return { per, glob };
  }

  // ---------- Fokus ----------
  const FC = {};
  for (const m of D.module) if (m.bereiche.some(b => b.startsWith('MM'))) for (const f of m.fokus) FC[f] = (FC[f] || 0) + 1;
  function fokusChips() {
    return D.fokus.map(f => {
      const st = S.fokus.includes(f.id) ? 'on' : S.fokus2.includes(f.id) ? 'on2' : '';
      return `<button class="chip ${f.offiziell ? '' : 'extra'} ${st}" data-f="${f.id}" title="${st === 'on' ? 'Hauptfokus' : st === 'on2' ? 'Nebenfokus' : 'nicht gewählt'} · ${FC[f.id] || 0} Mastermodule">${st === 'on2' ? '◐ ' : ''}${esc(f.name)}<span class="cnt">${FC[f.id] || 0}</span></button>`;
    }).join('');
  }
  function profileChips() {
    return 'Beispielprofile der TUM: ' + D.profile.map((p, i) => `<button class="chip ${S.profil === i ? 'on' : ''}" data-p="${i}">${esc(p.name)}</button>`).join('') +
      (S.profil != null ? ' <span>★ = empfohlen</span>' : '');
  }
  function cycleFokus(id) {
    if (S.fokus.includes(id)) { S.fokus = S.fokus.filter(x => x !== id); S.fokus2.push(id); }
    else if (S.fokus2.includes(id)) S.fokus2 = S.fokus2.filter(x => x !== id);
    else S.fokus.push(id);
    S.profil = null;
  }
  function pickProfile(i) {
    if (S.profil === i) S.profil = null; else { S.profil = i; S.fokus = [...D.profile[i].fokus]; S.fokus2 = S.fokus2.filter(x => !S.fokus.includes(x)); }
  }
  function onFokusClick(e) {
    const f = e.target.closest('[data-f]'), p = e.target.closest('[data-p]');
    if (f) cycleFokus(f.dataset.f); else if (p) pickProfile(Number(p.dataset.p)); else return;
    shown = PAGE; save(); renderAll();
  }
  function renderFokus() { $('fokus-chips').innerHTML = fokusChips(); $('profiles').innerHTML = profileChips(); }
  $('fokus-chips').addEventListener('click', onFokusClick);
  $('profiles').addEventListener('click', onFokusClick);

  // ---------- Filter ----------
  function renderFilters() {
    const cnt = {};
    for (const m of D.module) for (const b of m.bereiche) cnt[b] = (cnt[b] || 0) + 1;
    $('f-bereich').innerHTML = BEREICH_ORDER.filter(id => B[id]).map(id =>
      `<label><input type="checkbox" value="${id}" ${S.filter.bereiche.includes(id) ? 'checked' : ''}> ${esc(B[id].name)}<span class="n">${cnt[id] || 0}</span></label>`).join('') +
      '<button class="link-btn" data-all="1">alle</button> · <button class="link-btn" data-all="mm">nur Mastermodule</button>';
    const seg = (el, key, opts) => { $(el).innerHTML = opts.map(([v, l]) => `<button data-v="${v}" class="${S.filter[key] === v ? 'on' : ''}">${l}</button>`).join(''); };
    seg('f-sprache', 'sprache', [['alle', 'Alle'], ['de', 'Deutsch'], ['en', 'Englisch']]);
    seg('f-turnus', 'turnus', [['alle', 'Alle'], ['WiSe', 'WiSe'], ['SoSe', 'SoSe']]);
    seg('f-ects', 'ects', [['alle', 'Alle'], ['lt5', '< 5'], ['5', '5'], ['6', '6'], ['gt6', '> 6']]);
    for (const b of $('f-fokusmode').children) b.classList.toggle('on', b.dataset.v === S.filter.fokusMode);
    $('q').value = S.filter.q;
    $('f-nurplan').checked = S.filter.nurPlan; $('f-nurreco').checked = S.filter.nurReco;
    $('f-ohnevor').checked = S.filter.ohneVor; $('f-grundlage').checked = S.filter.grundlage;
    $('f-imsem').checked = S.filter.imSem; $('f-imsem-wrap').hidden = !SEMD;
    if (SEMD) $('f-imsem-label').textContent = `nur im ${termLabel} angeboten`;
    $('sort').value = S.sort;
  }
  $('f-bereich').addEventListener('change', () => { S.filter.bereiche = [...$('f-bereich').querySelectorAll('input:checked')].map(i => i.value); shown = PAGE; save(); renderList(); });
  $('f-bereich').addEventListener('click', e => {
    const a = e.target.dataset.all; if (!a) return;
    S.filter.bereiche = a === '1' ? [...BEREICH_ORDER] : [...MM]; shown = PAGE; save(); renderFilters(); renderList();
  });
  for (const [el, key] of [['f-sprache', 'sprache'], ['f-turnus', 'turnus'], ['f-ects', 'ects'], ['f-fokusmode', 'fokusMode']]) {
    $(el).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.filter[key] = b.dataset.v; shown = PAGE; save(); renderFilters(); renderList(); });
  }
  let qTimer;
  $('q').addEventListener('input', e => { clearTimeout(qTimer); qTimer = setTimeout(() => { S.filter.q = e.target.value; shown = PAGE; save(); renderList(); }, 150); });
  for (const [el, key] of [['f-nurplan', 'nurPlan'], ['f-nurreco', 'nurReco'], ['f-ohnevor', 'ohneVor'], ['f-grundlage', 'grundlage'], ['f-imsem', 'imSem']]) {
    $(el).addEventListener('change', e => { S.filter[key] = e.target.checked; shown = PAGE; save(); renderList(); });
  }
  $('sort').addEventListener('change', e => { S.sort = e.target.value; save(); renderList(); });
  $('reset').addEventListener('click', () => { S.filter = defaults().filter; shown = PAGE; save(); renderFilters(); renderList(); });
  $('toggle-filters').addEventListener('click', () => $('filters').classList.toggle('open'));

  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const searchIdx = new Map(D.module.map(m => [m.id, norm([m.titel, m.titelEn, m.kennung, m.lehrstuhl, m.verantwortlich, m.inhalt].join(' '))]));
  function filtered() {
    const f = S.filter, reco = recoSet();
    const terms = norm(f.q).split(/\s+/).filter(Boolean);
    const list = D.module.filter(m => {
      if (!m.bereiche.some(b => f.bereiche.includes(b))) return false;
      if (f.sprache !== 'alle' && !m.sprache.includes(f.sprache)) return false;
      if (f.turnus !== 'alle' && !m.turnus.includes(f.turnus)) return false;
      if (f.ects === 'lt5' && !(m.ects < 5)) return false;
      if (f.ects === '5' && m.ects !== 5) return false;
      if (f.ects === '6' && m.ects !== 6) return false;
      if (f.ects === 'gt6' && !(m.ects > 6)) return false;
      if (f.nurPlan && !S.plan[m.id]) return false;
      if (f.nurReco && !reco.has(m.id)) return false;
      if (f.ohneVor && m.bautAuf.length) return false;
      if (f.grundlage && !m.grundlageFuer.length) return false;
      if (f.imSem && SEMD && !offered(m.id)) return false;
      if (f.fokusMode === 'fokus' && (S.fokus.length || S.fokus2.length) && !m.fokus.some(x => S.fokus.includes(x) || S.fokus2.includes(x))) return false;
      if (terms.length) { const s = searchIdx.get(m.id); if (!terms.every(t => s.includes(t))) return false; }
      return true;
    });
    const sc = m => (reco.has(m.id) ? 100 : 0) + m.fokus.filter(x => S.fokus.includes(x)).length * 2 + m.fokus.filter(x => S.fokus2.includes(x)).length;
    const bOrd = m => Math.min(...m.bereiche.map(b => BEREICH_ORDER.indexOf(b)));
    const byT = (a, b) => a.titel.localeCompare(b.titel, 'de');
    const cmp = {
      relevanz: (a, b) => sc(b) - sc(a) || bOrd(a) - bOrd(b) || byT(a, b),
      grundlagen: (a, b) => b.grundlageFuer.length - a.grundlageFuer.length || a.bautAuf.length - b.bautAuf.length || byT(a, b),
      titel: byT,
      ects: (a, b) => b.ects - a.ects || byT(a, b),
      lehrstuhl: (a, b) => a.lehrstuhl.localeCompare(b.lehrstuhl, 'de') || byT(a, b),
    }[S.sort] || byT;
    return list.sort(cmp);
  }

  // ---------- Karten ----------
  const semOptions = cur => `<option value="">– Semester –</option>` + semList().map(s => `<option value="${s}" ${Number(cur) === s ? 'selected' : ''}>${s}. ${semInfo(s).label}</option>`).join('');
  const bOptions = (m, cur) => m.bereiche.map(b => `<option value="${b}" ${b === cur ? 'selected' : ''}>${esc(B[b].name)}</option>`).join('');
  function preStatus(id) {
    const e = plannedByKey().get(TK[id]);
    if (!e) return '';
    return e.st === 'bestanden' ? ' <span class="tag okt">bestanden</span>' : ` <span class="tag okt">im Plan${e.sem ? ' · ' + e.sem + '. Sem.' : ''}</span>`;
  }
  function card(m, reco, warns) {
    const e = S.plan[m.id];
    const sem = turnusKnown(m) ? `<span class="tag">${esc(m.turnus)}</span>` : '';
    const lang = m.sprache === '?' ? '' : `<span class="tag">${esc(m.sprache)}</span>`;
    const pre = (m.bautAuf.length ? `<span class="tag pre" title="Baut auf anderen Modulen aus dem Katalog auf">⬑ baut auf ${m.bautAuf.length}</span>` : '') +
      (m.grundlageFuer.length ? `<span class="tag pre" title="Ist Grundlage für andere Module">⇢ Grundlage für ${m.grundlageFuer.length}</span>` : '');
    const w = (warns && warns[m.id]) || [];
    const wTags = w.filter(x => x.lvl !== 'info').map(x => `<span class="tag ${x.lvl === 'bad' ? 'bad' : 'warn'}" title="${esc(x.t)}">⚠ ${esc(x.pre ? 'Voraussetzung' : 'Hinweis')}</span>`).join('');
    const ex = mainExam(m.id);
    const semTags = (offered(m.id) ? `<span class="tag semt" title="Lehrveranstaltungen im ${esc(SEMD.label)}">📅 ${termLabel}: ${esc(kursTypen(m.id))}</span>` : '') +
      (hatPflicht(m.id) ? '<span class="tag bad" title="Mindestens eine Lehrveranstaltung mit Anwesenheitspflicht">Präsenzpflicht</span>' : '') +
      (ex ? `<span class="tag ex" title="${esc(ex.art)} ${esc(ex.sem)}${ex.info ? ' · ' + esc(ex.info) : ''}">✎ Prüfung ${fmtIso(ex.datum)}${ex.eigenes ? '' : ' (Wdh.)'}</span>` : '');
    let ctrl;
    // Semester-Steuerung (aktuelles Semester): bei Modulen mit Terminen oder bereits ausgewählten Modulen
    const inSem = S.semAuswahl[m.id], ausPlan = e && e.sem === curPlanSem() && e.st !== 'bestanden' && !S.semAusgeblendet[m.id];
    const semCtrl = !SEMD || !(offered(m.id) || inSem) ? ''
      : inSem ? `<div class="row"><span class="tag okt">✓ im ${termLabel}</span><button class="icon-btn" data-semrm="${m.id}" title="Aus der Semester-Auswahl entfernen">×</button></div>`
      : ausPlan ? `<div class="row"><span class="tag okt" title="Steht in Mein Plan in diesem Semester">✓ im ${termLabel}</span><button class="icon-btn" data-semrm="${m.id}" title="Aus der Semesterplanung entfernen (bleibt in Mein Plan)">×</button></div>`
      : `<button class="btn small" data-semadd="${m.id}" title="Zur Semesterplanung ${termLabel} hinzufügen (Stundenplan, Prüfungen)">+ ${termLabel}</button>`;
    if (!e) {
      ctrl = `<div class="row"><button class="btn primary" data-add="${m.id}">+ Plan</button><button class="btn small" data-done="${m.id}" title="Als bestanden markieren">✓ bestanden</button></div>`;
    } else {
      ctrl = `<div class="row"><select data-st="${m.id}">${Object.keys(ST).map(s => `<option value="${s}" ${e.st === s ? 'selected' : ''}>${ST[s]}</option>`).join('')}</select>
        <button class="icon-btn" data-rm="${m.id}" title="Aus Plan entfernen">×</button></div>
        <select data-sem="${m.id}">${semOptions(e.sem)}</select>
        ${m.bereiche.length > 1 ? `<select data-assign="${m.id}" title="Anrechnen in">${bOptions(m, e.b)}</select>` : ''}`;
    }
    ctrl += semCtrl;
    const preList = (ids) => `<ul>${ids.map(id => `<li><button class="link-btn" data-jump="${id}">${esc(M[id].titel)}</button> <span class="hint">${esc(M[id].kennung)} · ${M[id].ects} CP · ${esc(M[id].turnus)}</span>${preStatus(id)}</li>`).join('')}</ul>`;
    const det = open.has(m.id) ? `<div class="details">
        ${m.bautAuf.length ? `<div><h4>Baut auf (aus dem Katalog) · ${m.vorausWeich ? 'empfohlen' : 'vorausgesetzt'}</h4>${preList(m.bautAuf)}</div>` : ''}
        ${m.grundlageFuer.length ? `<div><h4>Ist Grundlage für</h4>${preList(m.grundlageFuer)}</div>` : ''}
        ${m.voraussetzungen && m.voraussetzungen !== '-' ? `<div><h4>Voraussetzungen laut Modulbeschreibung</h4><p>${esc(m.voraussetzungen)}</p></div>` : ''}
        ${w.length ? `<div><h4>Hinweise zu deinem Plan</h4><ul>${w.map(x => `<li>${esc(x.t)}</li>`).join('')}</ul></div>` : ''}
        ${offered(m.id) || exams(m.id).length ? `<div><h4>${esc(SEMD.label)}</h4><ul>${SM[m.id].kurse.map(k => `<li><b>${esc(k.typ)}</b> ${esc(kursTitel(k))} · <span class="hint">${k.gruppen.length > 1 ? `${k.gruppen.length} Gruppen, z. B. ${esc(serieText(kursTermine(k, 0), true))}` : esc(serieText(kursTermine(k, 0)))}</span> <span class="tag pz ${pflicht(k)}" title="${esc(k.praesenzGrund)}">${PZ_LABEL[pflicht(k)]}</span></li>`).join('')}
          ${exams(m.id).map(p => `<li>✎ ${esc(p.art)} ${p.datum ? fmtIso(p.datum, true) : 'Datum offen'}${p.von ? ` ${p.von}${p.bis ? '–' + p.bis : ''}` : ''} <span class="hint">(${esc(p.sem)}${p.eigenes ? '' : ', Wiederholung'}${p.anmeldung[1] ? `, Anmeldung bis ${fmtIso(p.anmeldung[1])}` : ''})${p.info ? ' · ' + esc(p.info) : ''}</span></li>`).join('')}</ul></div>` : ''}
        ${m.inhalt ? `<div><h4>Inhalt</h4><p>${esc(m.inhalt)}</p></div>` : ''}
        ${m.lernziele ? `<div><h4>Lernergebnisse</h4><p>${esc(m.lernziele)}</p></div>` : ''}
        ${m.pruefung ? `<div><h4>Prüfung</h4><p>${esc(m.pruefung)}</p></div>` : ''}
        <div><h4>Lehrstuhl · Verantwortlich</h4><p>${esc(m.lehrstuhl || '–')}${m.verantwortlich ? ' · ' + esc(m.verantwortlich) : ''}</p></div>
        <div><h4>Im Studienplan unter</h4><p>${m.pfade.map(esc).join('\n')}</p></div>
        <div><a href="${tumUrl(m.id)}" target="_blank" rel="noopener">Modulbeschreibung in TUMonline öffnen ↗</a></div>
      </div>` : '';
    return `<div class="card ${e ? 'inplan' : ''} ${reco.has(m.id) ? 'reco' : ''}" id="card-${m.id}">
      <div class="card-top">
        <div class="card-main" data-toggle="${m.id}">
          <div class="card-title">${reco.has(m.id) ? '<span title="Empfehlung im Beispielprofil" style="color:var(--star)">★ </span>' : ''}${esc(m.titel)}<span class="k">${esc(m.kennung)}</span>
            ${m.titelEn ? `<span class="en">${esc(m.titelEn)}</span>` : ''}</div>
          <div class="meta">
            <span class="tag ects">${m.ects} ECTS</span>${sem}${lang}${semTags}${pre}${wTags}
            ${e && e.st !== 'geplant' ? `<span class="tag okt">${ST[e.st]}</span>` : ''}
            ${m.bereiche.map(b => `<span class="tag b">${esc(B[b].name)}</span>`).join('')}
            ${m.fokus.map(f => `<span class="tag f ${S.fokus.includes(f) || S.fokus2.includes(f) ? 'sel' : ''}">${esc(F[f].name)}</span>`).join('')}
          </div>
        </div>
        <div class="plan-ctrl">${ctrl}</div>
      </div>${det}</div>`;
  }
  function renderList() {
    const list = filtered(), reco = recoSet(), { per } = analyse();
    $('result-count').textContent = `${list.length} Module`;
    $('cards').innerHTML = list.length ? list.slice(0, shown).map(m => card(m, reco, per)).join('') : '<div class="empty">Keine Module für diese Filter.</div>';
    $('more').innerHTML = list.length > shown ? `<button class="btn" id="more-btn">Weitere ${Math.min(PAGE, list.length - shown)} von ${list.length - shown} anzeigen</button>` : '';
  }
  $('more').addEventListener('click', e => { if (e.target.id === 'more-btn') { shown += PAGE; renderList(); } });

  // ---------- Verlauf (Zurück/Vor) für Sprünge zwischen Modulen ----------
  // Vor jedem Sprung wird die aktuelle Ansicht gemerkt; zusätzlich ein Eintrag im Browser-Verlauf,
  // damit auch Maus-Zurücktaste und Alt+← funktionieren
  const navBack = [], navFwd = [];
  let navN = 0, navHist = true;
  try { history.replaceState({ fu: 0 }, ''); } catch (e) { navHist = false; }
  const navSnap = () => ({ tab: S.tab, semView: S.semView, filter: JSON.parse(JSON.stringify(S.filter)), sort: S.sort, open: [...open], shown, scroll: window.scrollY });
  function navRestore(s) {
    S.filter = s.filter; S.sort = s.sort; S.semView = s.semView; shown = s.shown;
    open.clear(); s.open.forEach(id => open.add(id));
    save(); renderFilters(); setTab(s.tab);
    requestAnimationFrame(() => window.scrollTo(0, s.scroll));
  }
  function navPush() {
    navBack.push(navSnap()); navFwd.length = 0;
    if (navHist) try { history.pushState({ fu: ++navN }, ''); } catch (e) { navHist = false; }
    navButtons();
  }
  function navGo(dir) {
    const [from, to] = dir < 0 ? [navBack, navFwd] : [navFwd, navBack];
    if (!from.length) return;
    to.push(navSnap()); navRestore(from.pop()); navButtons();
  }
  function navButtons() {
    $('nav-back').disabled = !navBack.length; $('nav-fwd').disabled = !navFwd.length;
    $('nav-back').title = navBack.length ? `Zurück (${navBack.length})` : 'Zurück';
    $('nav-fwd').title = navFwd.length ? `Vor (${navFwd.length})` : 'Vor';
  }
  // Knöpfe gehen über den Browser-Verlauf, damit beide Wege dieselben Schritte zählen
  $('nav-back').addEventListener('click', () => { if (navHist && navBack.length) history.back(); else navGo(-1); });
  $('nav-fwd').addEventListener('click', () => { if (navHist && navFwd.length) history.forward(); else navGo(1); });
  window.addEventListener('popstate', e => {
    const n = e.state && typeof e.state.fu === 'number' ? e.state.fu : 0;
    navGo(n < navN ? -1 : 1); navN = n;
  });

  function jump(id) {
    navPush();
    S.filter = { ...defaults().filter, bereiche: [...BEREICH_ORDER], q: M[id].kennung || M[id].titel };
    open.add(id); shown = PAGE; save();
    setTab('katalog'); renderFilters(); renderList();
    const el = document.getElementById('card-' + id);
    if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1500); }
  }
  function addToPlan(id, st = 'geplant') {
    const m = M[id];
    const b = m.bereiche.find(x => x !== 'AUF') || m.bereiche[0];
    let sem = null;
    if (st === 'geplant') sem = bestSem(m) ?? bestSem(m, { loose: true });
    else sem = st === 'bestanden' ? Math.max(1, C().aktSem - 1) : C().aktSem;
    S.plan[id] = { b, sem, st, lock: false };
  }
  // gemeinsame Handler für Steuerelemente (Katalog, Semesterplan, Assistent)
  function onCtrlClick(e) {
    const t = e.target.closest('[data-add],[data-done],[data-rm],[data-jump],[data-lock],[data-alt],[data-ban],[data-toggle],[data-semadd],[data-semrm],[data-semshow],[data-semplan],[data-pz]');
    if (!t || e.target.closest('select')) return false;
    const d = t.dataset;
    if (d.semadd) { S.semAuswahl[d.semadd] = { seit: new Date().toISOString().slice(0, 10) }; delete S.semAusgeblendet[d.semadd]; }
    else if (d.semrm) {
      delete S.semAuswahl[d.semrm];
      // vom Studienplaner zugewiesene Module nur aus der Semesterplanung ausblenden, „Mein Plan“ bleibt unverändert
      const pe = S.plan[d.semrm];
      if (pe && pe.sem === curPlanSem() && pe.st !== 'bestanden') S.semAusgeblendet[d.semrm] = true;
    }
    else if (d.semshow) delete S.semAusgeblendet[d.semshow];
    else if (d.semplan) { const m = M[d.semplan]; S.plan[d.semplan] = { b: m.bereiche.find(x => x !== 'AUF') || m.bereiche[0], sem: curPlanSem(), st: 'geplant', lock: true }; }
    else if (d.pz) cyclePraesenz(Number(d.pz));
    else if (d.add) addToPlan(d.add);
    else if (d.done) addToPlan(d.done, 'bestanden');
    else if (d.rm) delete S.plan[d.rm];
    else if (d.jump) { jump(d.jump); return true; }
    else if (d.lock) S.plan[d.lock].lock = !S.plan[d.lock].lock;
    else if (d.alt || d.ban) { const msg = alternative(d.alt || d.ban, !!d.ban); if (msg) flashMsg(msg); }
    else if (d.toggle) { if (e.target.closest('a')) return false; open.has(d.toggle) ? open.delete(d.toggle) : open.add(d.toggle); }
    save(); renderCurrent(); renderPlanCount();
    return true;
  }
  function onCtrlChange(e) {
    const t = e.target, d = t.dataset;
    if (d.st) { const x = S.plan[d.st]; x.st = t.value; if (x.st === 'bestanden' && !x.sem) x.sem = Math.max(1, C().aktSem - 1); }
    else if (d.sem) S.plan[d.sem].sem = t.value ? Number(t.value) : null;
    else if (d.assign) S.plan[d.assign].b = t.value;
    else return;
    save(); renderCurrent(); renderPlanCount();
  }
  for (const el of ['cards', 'sems', 'reqs', 'wiz-body', 'view-semester']) {
    $(el).addEventListener('click', onCtrlClick);
    $(el).addEventListener('change', onCtrlChange);
  }
  let msgTimer;
  function flashMsg(t) {
    const box = $('plan-warn');
    box.insertAdjacentHTML('afterbegin', `<div class="infobox" id="flashmsg">${esc(t)}</div>`);
    clearTimeout(msgTimer); msgTimer = setTimeout(() => { const x = $('flashmsg'); if (x) x.remove(); }, 3500);
  }
  function renderPlanCount() {
    $('plan-count').textContent = entries().reduce((s, [id]) => s + M[id].ects, 0) + auslandCP();
    $('sem-count').textContent = [...semMods().keys()].reduce((s, id) => s + M[id].ects, 0);
  }

  // ---------- Semesteransicht ----------
  function itemHtml(id, e, warns) {
    const m = M[id], w = warns[id] || [];
    return `<div class="item ${e.st !== 'geplant' ? 'fixed' : ''}">
      <div class="it-top"><span class="it-title" data-jump="${id}" title="Im Katalog öffnen">${esc(m.titel)}</span><span class="it-cp">${m.ects} CP</span></div>
      <div class="it-meta">
        <span class="tag b">${SHORT[e.b] || e.b}</span>
        ${turnusKnown(m) ? `<span class="tag">${esc(m.turnus)}</span>` : ''}
        ${e.sem && e.sem === curPlanSem() && mainExam(id) ? (x => `<span class="tag ex" title="${esc(x.art)}${x.von ? ' ' + x.von : ''}${x.info ? ' · ' + esc(x.info) : ''}">✎ ${fmtIso(x.datum)}</span>`)(mainExam(id)) : ''}
        <select data-sem="${id}" title="Semester">${semOptions(e.sem)}</select>
        <select data-st="${id}" title="Status">${Object.keys(ST).map(s => `<option value="${s}" ${e.st === s ? 'selected' : ''}>${ST[s]}</option>`).join('')}</select>
        ${e.st === 'geplant' ? `<button class="icon-btn ${e.lock ? 'on' : ''}" data-lock="${id}" title="${e.lock ? 'Entsperren' : 'Sperren: bleibt beim Neu-Erzeugen'}">${e.lock ? '🔒' : '🔓'}</button>
        <button class="icon-btn" data-alt="${id}" title="Alternative vorschlagen">↻</button>
        <button class="icon-btn" data-ban="${id}" title="Nie wieder vorschlagen und ersetzen">⛔</button>` : ''}
        <button class="icon-btn" data-rm="${id}" title="Entfernen">×</button>
      </div>
      ${w.filter(x => x.lvl !== 'info' || x.pre).map(x => `<div class="it-warn" style="${x.lvl === 'bad' ? 'color:var(--bad)' : x.lvl === 'info' ? 'color:var(--muted)' : ''}">⚠ ${esc(x.t)}</div>`).join('')}
    </div>`;
  }
  function renderSems(an) {
    const c = C(), cap = capacities(), load = semLoad();
    const bySem = {};
    for (const [id, e] of entries()) (bySem[e.sem || 0] = bySem[e.sem || 0] || []).push([id, e]);
    const ord = arr => (arr || []).sort((a, b) => BEREICH_ORDER.indexOf(a[1].b) - BEREICH_ORDER.indexOf(b[1].b) || M[a[0]].titel.localeCompare(M[b[0]].titel, 'de'));
    let h = '';
    for (const s of semList()) {
      const info = semInfo(s), past = s < c.aktSem, l = load[s] || 0, cp = cap[s];
      const pct = cp ? Math.min(100, l / cp * 100) : 0;
      h += `<div class="sem ${past ? 'past' : ''} ${isAbroad(s) ? 'abroad' : ''}">
        <h3><span>${s}. Semester</span><span class="cp">${l}${cp != null ? ' / ' + cp : ''} CP</span></h3>
        <div class="semsub">${info.label}${past ? ' · abgeschlossen' : ''}${isAbroad(s) ? ' · Auslandssemester' : ''}${s === Number(c.thesisSem) ? ' · Thesis' : ''}</div>
        ${cp ? `<div class="bar ${l > cp + 3 ? 'bad' : Math.abs(l - cp) <= 3 ? 'ok' : ''}"><i style="width:${pct}%"></i></div>` : ''}
        ${isAbroad(s) ? `<div class="item"><div class="it-top"><span class="it-title" style="cursor:default">🌍 Auslandssemester</span><span class="it-cp">${auslandCP()} CP</span></div>
          <div class="it-meta">${Object.entries(c.ausland.anr).filter(([, v]) => Number(v)).map(([b, v]) => `<span class="tag b">${SHORT[b]}: ${v}</span>`).join('') || '<span class="hint">keine Anrechnung festgelegt</span>'}</div></div>` : ''}
        ${ord(bySem[s]).map(([id, e]) => itemHtml(id, e, an.per)).join('') || (isAbroad(s) ? '' : '<p class="hint">Noch leer.</p>')}
      </div>`;
    }
    if (bySem[0] && bySem[0].length) h += `<div class="sem"><h3><span>Ohne Semester</span></h3><div class="semsub">Bitte einem Semester zuordnen</div>${ord(bySem[0]).map(([id, e]) => itemHtml(id, e, an.per)).join('')}</div>`;
    $('sems').innerHTML = h;
  }

  function req(label, have, { min, max, soll }, sub) {
    let target = soll ?? min ?? max ?? 0, status = '', cls = '';
    if (soll != null) {
      if (have === soll) { status = 'erfüllt'; cls = 'ok'; }
      else if (have < soll) { status = `noch ${soll - have} CP offen`; cls = 'warn'; }
      else { status = `${have - soll} CP über Soll`; cls = 'bad'; }
    } else if (min != null) {
      if (have >= min) { status = 'Minimum erreicht'; cls = 'ok'; } else { status = `noch mind. ${min - have} CP`; cls = 'warn'; }
    } else if (max != null) {
      if (have > max) { status = `${have - max} CP über Maximum`; cls = 'bad'; } else { status = have ? `noch bis zu ${max - have} CP möglich` : `bis zu ${max} CP möglich`; }
    }
    const rule = soll != null ? ` / ${soll} CP` : min != null ? ` / mind. ${min}` : max != null ? ` / max. ${max}` : ' CP';
    const pct = target ? Math.min(100, have / target * 100) : 0;
    return `<div class="req ${sub ? 'sub' : ''}"><div class="req-head"><span><b>${esc(label)}</b></span><span class="r">${have}${rule}</span></div>
      <div class="bar ${cls === 'ok' ? 'ok' : cls === 'bad' ? 'bad' : ''}"><i style="width:${pct}%"></i></div><div class="status ${cls}">${status}</div></div>`;
  }
  function renderPlan() {
    const an = analyse(), s = bucketSums();
    const mm = MM.reduce((t, b) => t + (s[b] || 0), 0), ue = (s.UE || 0) + (s.UE_E || 0);
    const total = Object.entries(s).filter(([b]) => b !== 'AUF').reduce((t, [, v]) => t + v, 0);
    const c = C();
    $('plan-sub').textContent = `${c.semester} Semester ab ${semInfo(1).label}${c.ausland.an ? ` · Ausland im ${c.ausland.sem}. Semester` : ''} · ${entries().length} Module`;
    $('total').textContent = `${total} / 120 CP`;
    $('total-sub').textContent = c.ausland.an ? `inkl. ${auslandCP()} CP Ausland` : '';
    const order = { bad: 0, warn: 1, info: 2 };
    const g = [...an.glob].sort((a, b) => order[a.lvl] - order[b.lvl]);
    const nPre = Object.values(an.per).flat().filter(x => x.pre && x.lvl !== 'info').length;
    if (nPre) g.push({ t: `${nPre} Voraussetzungs-Hinweise bei einzelnen Modulen (siehe ⚠ in den Semestern).`, lvl: 'warn' });
    $('plan-warn').innerHTML = (!entries().length ? '<div class="infobox">Noch leer. Starte den <button class="link-btn" data-goto="wizard">Planer-Assistenten</button> oder füge im Katalog Module hinzu.</div>' : '') +
      g.map(w => `<div class="${w.lvl === 'info' ? 'infobox' : 'warnbox ' + (w.lvl === 'bad' ? 'bad' : '')}">${esc(w.t)}</div>`).join('') +
      (total >= 120 && !g.some(w => w.lvl !== 'info') ? '<div class="okbox">Alle Regeln erfüllt, 120 CP sind verplant.</div>' : '');
    renderSems(an);
    let h = req('Mastermodule', mm, { soll: 60 });
    h += req(B.MM_G.name, s.MM_G || 0, { min: 20 }, true);
    h += req(B.MM_K.name, s.MM_K || 0, { max: 40 }, true);
    h += req(B.MM_A.name, s.MM_A || 0, { max: 15 }, true);
    h += req(B.MM_F.name, s.MM_F || 0, { max: 15 }, true);
    h += req(B.HP.name, s.HP || 0, { soll: 8 });
    h += req(B.IE.name, s.IE || 0, { soll: 6 });
    h += req(B.FP.name, s.FP || 0, { soll: 11 });
    h += req('Überfachliche Ergänzung', ue, { soll: 5 });
    h += req(B.UE_E.name, s.UE_E || 0, { min: 3 }, true);
    h += req(B.MT.name, s.MT || 0, { soll: 30 });
    if (s.AUF) h += req('Auflagen (nicht in den 120 CP)', s.AUF, {});
    $('reqs').innerHTML = h;
    const fd = {};
    for (const [id] of entries()) for (const f of M[id].fokus) fd[f] = (fd[f] || 0) + M[id].ects;
    const maxV = Math.max(1, ...Object.values(fd));
    const rank = f => S.fokus.includes(f) ? 2 : S.fokus2.includes(f) ? 1 : 0;
    const ord = [...D.fokus].sort((a, b) => rank(b.id) - rank(a.id) || (fd[b.id] || 0) - (fd[a.id] || 0));
    $('fokus-dist').innerHTML = ord.map(f => `<div class="fbar"><span>${rank(f.id) === 2 ? '<b>' + esc(f.name) + '</b>' : rank(f.id) === 1 ? '◐ ' + esc(f.name) : esc(f.name)}</span>
      <div class="bar"><i style="width:${(fd[f.id] || 0) / maxV * 100}%;${rank(f.id) ? '' : 'opacity:.45'}"></i></div><span class="v">${fd[f.id] || 0}</span></div>`).join('');
  }
  $('plan-warn').addEventListener('click', e => { const g = e.target.closest('[data-goto]'); if (g) setTab(g.dataset.goto); });
  $('regen').addEventListener('click', () => { const miss = generate(); renderPlan(); renderPlanCount(); miss.forEach(flashMsg); });
  $('to-wizard').addEventListener('click', () => setTab('wizard'));
  $('export').addEventListener('click', () => {
    const out = { exportiert: new Date().toISOString(), fokus: S.fokus, fokus2: S.fokus2, cfg: S.cfg,
      semester: { auswahl: Object.keys(S.semAuswahl), ausgeblendet: Object.keys(S.semAusgeblendet), kursWahl: S.kursWahl, kursAus: S.kursAus, praesenz: S.praesenz },
      plan: entries().map(([id, e]) => ({ id, kennung: M[id].kennung, titel: M[id].titel, ects: M[id].ects, bereich: e.b, semester: e.sem, status: e.st, gesperrt: e.lock })) };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
    a.download = 'mw-masterplan.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('import').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const j = JSON.parse(await file.text()), plan = {};
      for (const p of j.plan || []) if (M[p.id] && M[p.id].bereiche.includes(p.bereich))
        plan[p.id] = { b: p.bereich, sem: p.semester ?? null, st: ST[p.status] ? p.status : 'geplant', lock: !!p.gesperrt };
      S.plan = plan;
      if (Array.isArray(j.fokus)) S.fokus = j.fokus.filter(f => F[f]);
      if (Array.isArray(j.fokus2)) S.fokus2 = j.fokus2.filter(f => F[f]);
      if (j.cfg) S.cfg = { ...defCfg(), ...j.cfg };
      if (j.semester) {
        S.semAuswahl = Object.fromEntries((j.semester.auswahl || []).filter(id => M[id]).map(id => [id, {}]));
        S.semAusgeblendet = Object.fromEntries((j.semester.ausgeblendet || []).filter(id => M[id]).map(id => [id, true]));
        for (const k of ['kursWahl', 'kursAus', 'praesenz']) S[k] = j.semester[k] && typeof j.semester[k] === 'object' ? j.semester[k] : {};
      }
      save(); renderAll();
    } catch (err) { flashMsg('Datei konnte nicht gelesen werden.'); }
    e.target.value = '';
  });
  $('clear').addEventListener('click', () => { for (const [id, e] of entries()) if (e.st === 'geplant') delete S.plan[id]; save(); renderAll(); });

  // ---------- Assistent ----------
  const STEPS = ['Start & Dauer', 'Bisheriges', 'Auslandssemester', 'Fokus & Sprache', 'Wahlbereiche', 'Forschung & Thesis', 'Weitere Wünsche'];
  let pickQ = '';
  const num = (path, v, min, max) => `<input type="number" data-cfg="${path}" value="${esc(v)}" min="${min}" max="${max}" style="width:80px">`;
  const semSel = (path, cur, from = 1) => `<select data-cfg="${path}">${semList().filter(s => s >= from).map(s => `<option value="${s}" ${Number(cur) === s ? 'selected' : ''}>${s}. Semester · ${semInfo(s).label}</option>`).join('')}</select>`;
  function zielSum() { return MM.reduce((t, b) => t + (Number(C().ziel[b]) || 0), 0); }

  function wizStep(i) {
    const c = C(), cap = capacities();
    if (i === 0) return `
      <div class="grid2">
        <div class="q"><label>Wann hast du den Master begonnen (bzw. beginnst du)?</label>
          <div class="row"><select data-cfg="startTyp"><option value="W" ${c.startTyp === 'W' ? 'selected' : ''}>Wintersemester</option><option value="S" ${c.startTyp === 'S' ? 'selected' : ''}>Sommersemester</option></select>
          ${num('startJahr', c.startJahr, 2015, 2035)}</div>
          <p class="hint">Beim Wintersemester das Jahr des Beginns angeben (WiSe 26/27 = 2026).</p></div>
        <div class="q"><label>In wie vielen Semestern willst du fertig werden?</label>
          <div class="seg" data-seg="semester">${[3, 4, 5, 6].map(n => `<button data-v="${n}" class="${c.semester === n ? 'on' : ''}">${n}</button>`).join('')}</div>
          <p class="hint">Regelstudienzeit sind 4 Semester. Mit Auslandssemester oder Werkstudentenjob sind 5 üblich.</p></div>
        <div class="q"><label>In welchem Fachsemester bist du gerade?</label>${num('aktSem', c.aktSem, 1, c.semester)}
          <p class="hint">Frühere Semester gelten als abgeschlossen, dort werden keine neuen Module eingeplant.</p></div>
      </div>
      <div class="q"><span class="ql">Wie viele CP willst du pro Semester machen?</span>
        <p class="hint">Leer lassen = automatisch (gleichmäßig verteilt; das Thesis-Semester bekommt 30, das Auslandssemester die Auslands-ECTS).</p>
        <div class="grid2">${semList().map(s => `<div class="row"><span style="min-width:150px">${s}. ${semInfo(s).label}</span>
          ${s < c.aktSem ? '<span class="hint">abgeschlossen</span>' : `<input type="number" min="0" max="45" style="width:80px" data-cpziel="${s}" placeholder="${cap[s] ?? ''}" value="${c.cpZiel[s] ?? ''}"> CP`}</div>`).join('')}</div></div>`;
    if (i === 1) {
      const fx = entries().filter(([, e]) => e.st !== 'geplant');
      const terms = norm(pickQ).split(/\s+/).filter(Boolean);
      const hits = terms.length ? D.module.filter(m => terms.every(t => searchIdx.get(m.id).includes(t))).slice(0, 12) : [];
      return `
      <div class="q"><label>Hast du schon Module bestanden oder belegst sie gerade?</label>
        <p class="hint">Diese werden fest eingeplant, zählen zu deinen CP und bleiben beim Neu-Erzeugen erhalten. Du kannst sie auch im Katalog mit „✓ bestanden“ markieren.</p>
        <input class="search" id="wiz-pick" type="search" placeholder="Modul suchen (Titel oder Kennung) …" value="${esc(pickQ)}">
        ${hits.length ? `<div class="pick">${hits.map(m => `<div><span>${esc(m.titel)} <span class="hint">${esc(m.kennung)} · ${m.ects} CP</span></span>
          ${S.plan[m.id] ? `<span class="tag okt">${ST[S.plan[m.id].st]}</span>` : `<span class="row"><button class="btn small" data-done="${m.id}">bestanden</button><button class="btn small" data-wizbelegt="${m.id}">belegt</button></span>`}</div>`).join('')}</div>` : ''}
      </div>
      <div class="q"><span class="ql">Bereits erfasst (${fx.length})</span>
        ${fx.length ? `<div class="pick">${fx.map(([id, e]) => `<div><span>${esc(M[id].titel)} <span class="hint">${M[id].ects} CP · ${SHORT[e.b]}</span></span>
          <span class="row"><select data-st="${id}">${Object.keys(ST).map(s => `<option value="${s}" ${e.st === s ? 'selected' : ''}>${ST[s]}</option>`).join('')}</select>
          <select data-sem="${id}">${semOptions(e.sem)}</select><button class="icon-btn" data-rm="${id}">×</button></span></div>`).join('')}</div>` : '<p class="hint">Noch keine.</p>'}
      </div>
      <div class="q"><label><input type="checkbox" data-cfg="auflagen" ${c.auflagen ? 'checked' : ''}> Ich habe Auflagen aus der Zulassung</label>
        <p class="hint">Auflagen zählen nicht zu den 120 CP. Du findest sie im Katalog unter dem Wahlbereich „Auflagen“ und kannst sie dort in den Plan aufnehmen.</p></div>`;
    }
    if (i === 2) {
      const sumA = Object.values(c.ausland.anr).reduce((t, v) => t + (Number(v) || 0), 0);
      return `
      <div class="q"><label><input type="checkbox" data-cfg="ausland.an" ${c.ausland.an ? 'checked' : ''}> Ich plane ein Auslandssemester</label></div>
      ${c.ausland.an ? `<div class="grid2">
        <div class="q"><label>In welchem Semester?</label>${semSel('ausland.sem', c.ausland.sem, c.aktSem)}</div>
        <div class="q"><label>Wie viele ECTS willst du dort machen?</label>${num('ausland.ects', c.ausland.ects, 0, 45)} ECTS</div>
      </div>
      <div class="q"><span class="ql">Worauf sollen die Auslands-ECTS angerechnet werden?</span>
        <p class="hint">Typisch ist die Flexibilisierung (bis 15 CP, auch für Mastermodule ohne Gegenstück an der TUM) und International Experience (6 CP, jedes Modul kann durch ein Auslandsmodul ersetzt werden). Für Kernfächer oder Grundlagen braucht es ein inhaltlich gleichwertiges Modul, das klärst du vorab mit dem Learning Agreement.</p>
        <div class="grid2">${['MM_F', 'IE', 'MM_K', 'MM_G', 'MM_A', 'HP', 'UE'].map(b => `<div><div class="hint" style="margin:0 0 3px">${esc(B[b].name)}</div>${num('ausland.anr.' + b, c.ausland.anr[b] ?? 0, 0, 30)} CP</div>`).join('')}</div>
        <div class="${sumA === Number(c.ausland.ects) ? 'okbox' : 'warnbox'}" style="margin-top:8px">Angerechnet: ${sumA} von ${c.ausland.ects} ECTS${sumA < c.ausland.ects ? ` – ${c.ausland.ects - sumA} ECTS würden nicht angerechnet` : sumA > c.ausland.ects ? ' – mehr angerechnet als geplant' : ''}</div>
        ${Number(c.ausland.anr.MM_F) > 15 ? '<div class="warnbox bad">Flexibilisierung: max. 15 CP.</div>' : ''}
        ${Number(c.ausland.anr.IE) > 6 ? '<div class="warnbox bad">International Experience: genau 6 CP.</div>' : ''}
      </div>` : '<p class="hint">Kein Auslandssemester geplant. Du kannst das jederzeit hier ändern.</p>'}`;
    }
    if (i === 3) return `
      <div class="q"><label>In welche Richtungen willst du gehen?</label>
        <p class="hint">1× klicken = Hauptfokus (stark bevorzugt), 2× = Nebenfokus (leicht bevorzugt), 3× = aus. Oder ein Beispielprofil der TUM wählen, dann werden dessen Empfehlungen bevorzugt.</p>
        <div class="chips" id="wiz-fokus">${fokusChips()}</div>
        <div class="profiles" id="wiz-profiles">${profileChips()}</div></div>
      <div class="q"><label>In welcher Sprache sollen die Module sein?</label>
        <div class="seg" data-seg="sprache">${[['beide', 'Deutsch & Englisch'], ['de', 'nur Deutsch'], ['en', 'nur Englisch']].map(([v, l]) => `<button data-v="${v}" class="${c.sprache === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>`;
    if (i === 4) {
      const sum = zielSum();
      const sl = (b, min, max, hint) => `<div class="q"><label>${esc(B[b].name)}</label><p class="hint">${hint}${anr(b) ? ` · davon ${anr(b)} CP aus dem Ausland` : ''}</p>
        <div class="slider"><input type="range" min="${min}" max="${max}" step="1" data-cfg="ziel.${b}" value="${c.ziel[b]}"><span><b>${c.ziel[b]}</b> CP</span></div>
        ${Number(c.ziel[b]) < anr(b) ? '<div class="warnbox bad">Weniger als die Auslands-Anrechnung.</div>' : ''}</div>`;
      return `<p class="hint">Die 60 CP Mastermodule verteilst du auf vier Wahlbereiche. Einen Bereich lässt du leer, indem du ihn auf 0 stellst (geht nur bei Angrenzenden Fachgebieten und Flexibilisierung).</p>
        ${sl('MM_G', 20, 60, 'Pflicht: mindestens 20 CP. Breite Grundlagen (z. B. FEM, Gasdynamik, Regelungstechnik).')}
        ${sl('MM_K', 0, 40, 'Höchstens 40 CP. Hier liegt der größte Teil der Fokus-Module.')}
        ${sl('MM_A', 0, 15, 'Höchstens 15 CP aus anderen Departments (Informatik, E-Technik, Physik, Wirtschaft).')}
        ${sl('MM_F', 0, 15, 'Höchstens 15 CP aus dem gesamten Mastermodulangebot der ED oder extern/Ausland.')}
        <div class="${sum === 60 ? 'okbox' : 'warnbox bad'}">Summe: ${sum} von 60 CP ${sum === 60 ? '✓' : `– ${sum < 60 ? 'es fehlen ' + (60 - sum) : (sum - 60) + ' zu viel'}`}</div>
        ${sum !== 60 ? '<button class="btn" id="wiz-balance">Differenz mit Kernfächern ausgleichen</button>' : ''}`;
    }
    if (i === 5) return `
      <div class="grid2">
        <div class="q"><label>Welche Form der Forschungspraxis (11 CP)?</label>
          <select data-cfg="fpArt">${FP_MODS.map(m => `<option value="${m.id}" ${c.fpArt === m.id ? 'selected' : ''}>${esc(m.titel)}</option>`).join('')}</select>
          <p class="hint">Semesterarbeit (einzeln), Teamprojekt (im Team) oder Forschungspraktikum (mehr Begleitveranstaltungen).</p></div>
        <div class="q"><label>In welchem Semester die Forschungspraxis?</label>${semSel('fpSem', c.fpSem, c.aktSem)}</div>
        <div class="q"><label>In welchem Semester die Master’s Thesis?</label>${semSel('thesisSem', c.thesisSem, c.aktSem)}
          <p class="hint">Für die Zulassung braucht man mindestens 80 CP. Meist ist es das letzte Semester.</p></div>
        <div class="q"><label>In welchen Semestern die zwei Hochschulpraktika (je ~4 CP)?</label>
          <div class="row">${[0, 1].map(k => `<select data-hpsem="${k}">${semList().filter(s => s >= Math.max(2, c.aktSem)).map(s => `<option value="${s}" ${Number(c.hpSem[k]) === s ? 'selected' : ''}>${s}. Sem.</option>`).join('')}</select>`).join('')}</div>
          <p class="hint">Die Plätze werden zentral über TUMonline vergeben. Im 1. Semester plant der Assistent keine Praktika ein.</p></div>
      </div>`;
    if (i === 6) return `
      <div class="grid2">
        <div class="q"><label>Höchstens wie viele Module pro Semester?</label>${num('maxModule', c.maxModule, 3, 12)}</div>
        <div class="q"><label><input type="checkbox" data-cfg="vorausStreng" ${c.vorausStreng ? 'checked' : ''}> Module meiden, deren Voraussetzungen nicht im Plan sind</label>
          <p class="hint">Bevorzugt Module, deren Grundlagen du schon hast oder die mit eingeplant sind. Vorausgesetzte Module kommen dann in ein früheres Semester.</p></div>
      </div>
      <div class="q"><span class="ql">Ausgeschlossene Module (${c.ausschluss.length})</span>
        <p class="hint">Im Semesterplan mit ⛔ markierte Module schlägt der Assistent nicht mehr vor.</p>
        ${c.ausschluss.length ? `<div class="pick">${c.ausschluss.filter(id => M[id]).map(id => `<div><span>${esc(M[id].titel)}</span><button class="btn small" data-unban="${id}">wieder erlauben</button></div>`).join('')}</div>` : ''}</div>
      <div class="q"><span class="ql">Zusammenfassung</span><ul class="hint" style="margin:4px 0 0;padding-left:18px">
        <li>${c.semester} Semester ab ${semInfo(1).label}, aktuell im ${c.aktSem}. Semester</li>
        <li>Fokus: ${[...S.fokus.map(f => F[f].name), ...S.fokus2.map(f => '◐ ' + F[f].name)].join(', ') || 'keiner gewählt'}${S.profil != null ? ` · Profil „${esc(D.profile[S.profil].name)}“` : ''}</li>
        <li>Mastermodule: Grundlagen ${c.ziel.MM_G} · Kernfächer ${c.ziel.MM_K} · Angrenzend ${c.ziel.MM_A} · Flexi ${c.ziel.MM_F} (Summe ${zielSum()})</li>
        <li>${c.ausland.an ? `Ausland im ${c.ausland.sem}. Semester mit ${c.ausland.ects} ECTS` : 'Kein Auslandssemester'} · Forschungspraxis im ${c.fpSem}. · Thesis im ${c.thesisSem}. Semester</li>
        <li>${entries().filter(([, e]) => e.st !== 'geplant').length} bestandene/belegte und ${entries().filter(([, e]) => e.lock).length} gesperrte Module bleiben erhalten</li>
      </ul></div>`;
    return '';
  }
  function validateCfg() {
    const c = C(), errs = [];
    c.semester = Math.min(6, Math.max(3, Number(c.semester) || 4));
    c.aktSem = Math.min(c.semester, Math.max(1, Number(c.aktSem) || 1));
    for (const k of ['fpSem', 'thesisSem']) c[k] = Math.min(c.semester, Math.max(c.aktSem, Number(c[k]) || c.semester));
    c.ausland.sem = Math.min(c.semester, Math.max(c.aktSem, Number(c.ausland.sem) || c.aktSem));
    c.hpSem = (c.hpSem || []).map(s => Math.min(c.semester, Math.max(2, c.aktSem, Number(s) || 2)));
    if (zielSum() !== 60) errs.push(`Die Wahlbereiche ergeben ${zielSum()} statt 60 CP (Schritt „Wahlbereiche“).`);
    if (Number(c.ziel.MM_G) < 20) errs.push('Ingenieurwiss. Grundlagen brauchen mind. 20 CP.');
    if (c.ausland.an && Number(c.ausland.sem) === Number(c.thesisSem)) errs.push('Auslandssemester und Thesis liegen im selben Semester.');
    for (const b of MM) if (Number(c.ziel[b]) < anr(b)) errs.push(`${B[b].name}: Ziel ist kleiner als die Auslands-Anrechnung.`);
    return errs;
  }
  function renderWizard() {
    validateCfg();
    const i = S.wizStep;
    $('wiz-steps').innerHTML = STEPS.map((t, k) => `<button data-step="${k}" class="${k === i ? 'on' : k < i ? 'done' : ''}">${k + 1}. ${t}</button>`).join('');
    $('wiz-body').innerHTML = wizStep(i);
    $('wiz-prev').disabled = i === 0;
    $('wiz-next').hidden = i === STEPS.length - 1;
    const p = $('wiz-pick');
    if (p) { p.addEventListener('input', e => { pickQ = e.target.value; const pos = e.target.selectionStart; renderWizard(); const n = $('wiz-pick'); n.focus(); n.setSelectionRange(pos, pos); }); }
  }
  function setCfg(path, val) {
    const parts = path.split('.'); let o = S.cfg;
    for (let k = 0; k < parts.length - 1; k++) o = o[parts[k]];
    o[parts[parts.length - 1]] = val;
  }
  $('wiz-steps').addEventListener('click', e => { const b = e.target.closest('[data-step]'); if (b) { S.wizStep = Number(b.dataset.step); save(); renderWizard(); } });
  $('wiz-prev').addEventListener('click', () => { S.wizStep = Math.max(0, S.wizStep - 1); save(); renderWizard(); });
  $('wiz-next').addEventListener('click', () => { S.wizStep = Math.min(STEPS.length - 1, S.wizStep + 1); save(); renderWizard(); window.scrollTo(0, 0); });
  $('wiz-gen').addEventListener('click', () => {
    const errs = validateCfg();
    if (errs.length) { $('wiz-body').insertAdjacentHTML('afterbegin', errs.map(t => `<div class="warnbox bad">${esc(t)}</div>`).join('')); window.scrollTo(0, 0); return; }
    const miss = generate(); S.wizDone = true; save();
    setTab('plan'); renderPlanCount(); miss.forEach(flashMsg);
  });
  $('wiz-body').addEventListener('input', e => {
    const t = e.target;
    if (t.type === 'range' && t.dataset.cfg) { setCfg(t.dataset.cfg, Number(t.value)); save(); const sp = t.parentElement.querySelector('b'); if (sp) sp.textContent = t.value; }
  });
  $('wiz-body').addEventListener('change', e => {
    const t = e.target, d = t.dataset;
    if (d.cfg) { setCfg(d.cfg, t.type === 'checkbox' ? t.checked : (t.type === 'number' || t.type === 'range' || /Sem$|sem$|fpArt/.test(d.cfg) && d.cfg !== 'fpArt') ? Number(t.value) : t.value); }
    else if (d.cpziel) { if (t.value === '') delete C().cpZiel[d.cpziel]; else C().cpZiel[d.cpziel] = Number(t.value); }
    else if (d.hpsem) C().hpSem[Number(d.hpsem)] = Number(t.value);
    else return;
    save(); renderWizard();
  });
  $('wiz-body').addEventListener('click', e => {
    const seg = e.target.closest('[data-seg] button');
    if (seg) { const k = seg.parentElement.dataset.seg; C()[k] = k === 'semester' ? Number(seg.dataset.v) : seg.dataset.v; save(); renderWizard(); return; }
    const f = e.target.closest('[data-f]'), p = e.target.closest('[data-p]');
    if (f) { cycleFokus(f.dataset.f); save(); renderWizard(); renderFokus(); return; }
    if (p) { pickProfile(Number(p.dataset.p)); save(); renderWizard(); renderFokus(); return; }
    const ub = e.target.closest('[data-unban]');
    if (ub) { C().ausschluss = C().ausschluss.filter(x => x !== ub.dataset.unban); save(); renderWizard(); return; }
    const bl = e.target.closest('[data-wizbelegt]');
    if (bl) { addToPlan(bl.dataset.wizbelegt, 'belegt'); save(); renderWizard(); renderPlanCount(); return; }
    if (e.target.id === 'wiz-balance') { const c = C(); c.ziel.MM_K = Math.min(40, Math.max(0, Number(c.ziel.MM_K) + 60 - zielSum())); save(); renderWizard(); }
  });

  // ---------- Aktuelles Semester: Auswahl, Stundenplan, Prüfungen ----------
  // Module des aktuellen Semesters: Semester-Auswahl + Module aus „Mein Plan“, die in diesem Semester liegen
  function semMods() {
    const res = new Map(), cs = curPlanSem();
    if (cs != null) for (const [id, e] of entries()) if (e.sem === cs && e.st !== 'bestanden' && !S.semAusgeblendet[id]) res.set(id, { plan: e });
    for (const id of Object.keys(S.semAuswahl)) if (M[id]) res.set(id, { ...(res.get(id) || {}), auswahl: true });
    return res;
  }
  function cyclePraesenz(kid) {
    const k = Object.values(SM).flatMap(v => v.kurse).find(x => x.id === kid); if (!k) return;
    const next = PZ_ORDER[(PZ_ORDER.indexOf(pflicht(k)) + 1) % PZ_ORDER.length];
    if (next === k.praesenz) delete S.praesenz[kid]; else S.praesenz[kid] = next;
  }
  // Termine aufbauen, Gruppen automatisch wählen, Überschneidungen finden
  function semAnalyse() {
    const mods = [...semMods().keys()];
    const hue = Object.fromEntries(mods.map((id, i) => [id, Math.round(i * 137.5 + 200) % 360]));
    const kurse = [];
    for (const id of mods) if (SM[id]) for (const k of SM[id].kurse) if (!S.kursAus[k.id] && (k.gruppen.length || k.gemeinsam)) kurse.push({ id, k });
    const ev = [], byDay = new Map(), chosen = {};
    const weight = k => ({ ja: 3, erster: 1.5, unklar: 1.5 }[pflicht(k)] || 1);
    const cost = (t, w) => { let o = 0; for (const [d, s, e] of t) for (const x of byDay.get(d) || []) if (x.s < e && s < x.e) o += (Math.min(x.e, e) - Math.max(x.s, s)) * w * x.w; return o; };
    // Kurse mit fester Gruppe zuerst, dann Kurse mit Gruppenwahl (Pflichtkurse vorneweg)
    const ord = [...kurse].sort((a, b) => (a.k.gruppen.length > 1 && S.kursWahl[a.k.id] == null) - (b.k.gruppen.length > 1 && S.kursWahl[b.k.id] == null) || weight(b.k) - weight(a.k));
    for (const { id, k } of ord) {
      let g = S.kursWahl[k.id], auto = false;
      if (g == null || !k.gruppen[g]) {
        auto = true; g = 0;
        if (k.gruppen.length > 1) { let best = Infinity; k.gruppen.forEach((gr, i) => { const c = cost(gr.t, weight(k)); if (c < best) { best = c; g = i; } }); }
      }
      chosen[k.id] = { g, auto };
      const p = pflicht(k);
      kursTermine(k, g).forEach((x, i) => {
        const o = { id, k, g, d: x[0], s: x[1], e: x[2], r: x[3], h: hue[id], pf: p === 'ja' || (p === 'erster' && i === 0), un: p === 'unklar', w: weight(k) };
        ev.push(o); (byDay.get(o.d) || byDay.set(o.d, []).get(o.d)).push(o);
      });
    }
    const LV = { bad: 3, warn: 2, pv: 1, info: 0 };
    const pairs = new Map();
    for (const arr of byDay.values()) {
      arr.sort((a, b) => a.s - b.s);
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length && arr[j].s < arr[i].e; j++) {
        const a = arr[i], b = arr[j];
        if (a.id === b.id) continue; // Kurse desselben Moduls (z. B. VO und UE) nicht gegeneinander prüfen
        const lvl = a.pf && b.pf ? 'bad' : (a.pf && b.un) || (b.pf && a.un) ? 'warn' : a.pf || b.pf ? 'pv' : 'info';
        for (const x of [a, b]) if (x.konf == null || LV[lvl] > LV[x.konf]) x.konf = lvl;
        const [p, q] = a.k.id < b.k.id ? [a, b] : [b, a];
        const key = p.k.id + '|' + q.k.id;
        const c = pairs.get(key) || pairs.set(key, { a: p, b: q, lvl, cnt: {}, first: {} }).get(key);
        c.cnt[lvl] = (c.cnt[lvl] || 0) + 1;
        if (!c.first[lvl] || a.d < c.first[lvl].d) c.first[lvl] = { d: a.d, s: Math.max(a.s, b.s), e: Math.min(a.e, b.e) };
        if (LV[lvl] > LV[c.lvl]) c.lvl = lvl;
      }
    }
    // Prüfungen: gleicher Tag bzw. zeitliche Überschneidung
    const exs = [];
    for (const id of mods) for (const p of exams(id)) if (p.datum) exs.push({ id, p, h: hue[id] });
    const byDate = new Map();
    for (const x of exs) if (x.p.eigenes) (byDate.get(x.p.datum) || byDate.set(x.p.datum, []).get(x.p.datum)).push(x);
    const exWarn = [];
    for (const [d, arr] of byDate) {
      if (new Set(arr.map(x => x.id)).size < 2) continue;
      const ov = arr.some((a, i) => arr.some((b, j) => j > i && a.id !== b.id && a.p.von && b.p.von && a.p.von < (b.p.bis || '24:00') && b.p.von < (a.p.bis || '24:00')));
      exWarn.push({ lvl: ov ? 'bad' : 'warn', d, arr });
    }
    return { mods, hue, ev, chosen, pairs: [...pairs.values()], exs, exWarn, byDate };
  }

  const kursName = (x, chosen) => `${x.k.typ} „${M[x.id].titel}“${x.k.gruppen.length > 1 ? ` (${x.k.gruppen[chosen[x.k.id].g].n})` : ''}`;
  const termin = f => `${WD[dateOf(f.d).getDay()]} ${ddmm(dateOf(f.d))} ${hm(f.s)}–${hm(f.e)}`;
  function semWarnings(an) {
    const out = [], LV = { bad: 0, warn: 1, pv: 2 };
    const cp = an.mods.reduce((s, id) => s + M[id].ects, 0);
    for (const c of an.pairs.filter(c => c.lvl === 'bad' || c.lvl === 'warn').sort((a, b) => LV[a.lvl] - LV[b.lvl])) {
      const n = c.cnt[c.lvl], f = c.first[c.lvl];
      out.push({ lvl: c.lvl, t: c.lvl === 'bad'
        ? `Präsenzpflicht überschneidet sich: ${kursName(c.a, an.chosen)} und ${kursName(c.b, an.chosen)}, ${n}× (erstmals ${termin(f)}).`
        : `Möglicher Konflikt: ${kursName(c.a, an.chosen)} und ${kursName(c.b, an.chosen)} überschneiden sich ${n}× (erstmals ${termin(f)}). Bei einem der beiden ist die Anwesenheitspflicht unklar.` });
    }
    const pv = an.pairs.filter(c => c.cnt.pv);
    if (pv.length) out.push({ lvl: 'info', t: `${pv.length} Pflichtveranstaltung${pv.length > 1 ? 'en überschneiden' : ' überschneidet'} sich mit Terminen ohne Anwesenheitspflicht (z. B. Vorlesungen). Im Stundenplan sind sie markiert.` });
    for (const w of an.exWarn) out.push({ lvl: w.lvl, t: `${w.lvl === 'bad' ? 'Prüfungen überschneiden sich' : 'Mehrere Prüfungen am selben Tag'} am ${fmtIso(w.d, true)}: ${w.arr.map(x => `${M[x.id].titel}${x.p.von ? ` (${x.p.von}${x.p.bis ? '–' + x.p.bis : ''})` : ''}`).join(', ')}.` });
    const auto = Object.entries(an.chosen).filter(([kid, c]) => c.auto && an.ev.some(x => x.k.id === Number(kid) && x.k.gruppen.length > 1)).length;
    if (auto) out.push({ lvl: 'info', t: `Bei ${auto} Kurs${auto > 1 ? 'en' : ''} mit mehreren Gruppen wurde die Gruppe automatisch so gewählt, dass möglichst wenig kollidiert. In der Auswahl kannst du sie ändern.` });
    const ohne = an.mods.filter(id => !offered(id));
    if (ohne.length) out.push({ lvl: 'info', t: `Ohne Lehrveranstaltungen im ${SEMD.label}: ${ohne.map(id => M[id].titel).join(', ')}.` });
    if (cp > 30) out.unshift({ lvl: 'ok', t: `${cp} CP ausgewählt. Mehr als die üblichen 30 CP sind in dieser Phase normal: Du meldest dich zu mehr an und entscheidest in den ersten Wochen, was du behältst.` });
    return out;
  }
  const boxCls = l => ({ bad: 'warnbox bad', warn: 'warnbox', ok: 'okbox' }[l] || 'infobox');

  // ---------- Änderungen seit dem zuletzt gesehenen Stand ----------
  // S.semSnap[modulId] = { p: [Prüfungs-Signaturen], k: { kursId: [Termin-Signatur, Anzahl Termine] } }
  const exSig = p => `${p.datum || '-'}|${p.von || ''}|${p.bis || ''}|${p.art}|${p.sem}`;
  const termSig = t => t.map(x => x.slice(0, 3).join(',')).join(';');
  const kursSig = k => k.gruppen.map(g => g.n + ':' + termSig(g.t)).join('/') + '#' + termSig(k.gemeinsam || []);
  const nTermine = k => k.gruppen.reduce((s, g) => s + g.t.length, 0) + (k.gemeinsam || []).length;
  const modSnap = id => ({ p: exams(id).map(exSig), k: Object.fromEntries((SM[id] ? SM[id].kurse : []).map(k => [k.id, [kursSig(k), nTermine(k)]])) });
  const fmtStand = s => s ? new Date(s).toLocaleString('de-DE', s.length > 10 ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', year: 'numeric' }) : '?';
  function modDiff(id, alt) {
    alt = alt || S.semSnap[id]; if (!alt) return null;
    const neu = modSnap(id), altP = new Set(alt.p), neuP = new Set(neu.p);
    const d = { exNeu: exams(id).filter(p => !altP.has(exSig(p))), exWeg: alt.p.filter(s => !neuP.has(s)), kurse: {}, kurseWeg: Object.keys(alt.k).filter(kid => !neu.k[kid]).length };
    for (const [kid, [sig, n]] of Object.entries(neu.k)) { const a = alt.k[kid]; if (!a) d.kurse[kid] = { art: 'neu', n }; else if (a[0] !== sig) d.kurse[kid] = { art: 'geändert', n, vorher: a[1] }; }
    d.leer = !d.exNeu.length && !d.exWeg.length && !Object.keys(d.kurse).length && !d.kurseWeg;
    return d;
  }
  function describeDiff(id, d) {
    const t = M[id].titel, out = [], alteDaten = d.exWeg.map(s => s.split('|')[0]).filter(x => x !== '-');
    for (const p of d.exNeu) out.push(!p.datum ? `${t}: Prüfung angelegt, Datum noch offen` : `${t}: Prüfung ${alteDaten.length ? `verschoben (vorher ${alteDaten.map(x => fmtIso(x)).join(', ')}) auf` : 'neu am'} ${fmtIso(p.datum, true)}${p.von ? ' ' + p.von : ''}`);
    if (d.exWeg.length && !d.exNeu.length) out.push(`${t}: Prüfungstermin entfernt`);
    for (const [kid, c] of Object.entries(d.kurse)) {
      const k = SM[id].kurse.find(x => String(x.id) === kid);
      out.push(`${t}: ${k.typ} ${kursTitel(k)} ${c.art === 'neu' ? `neu eingetragen (${c.n} Termine)` : `Termine geändert (vorher ${c.vorher}, jetzt ${c.n})`}`);
    }
    if (d.kurseWeg) out.push(`${t}: ${d.kurseWeg} Lehrveranstaltung${d.kurseWeg > 1 ? 'en' : ''} entfernt`);
    return out;
  }

  // ---------- Aktualisieren über den lokalen Hilfsdienst (tools/server.mjs) ----------
  const API = 'http://127.0.0.1:8765/api/';
  // lokal geöffnet (Datei oder localhost): Aktualisieren-Knöpfe über den Hilfsdienst;
  // online (z. B. GitHub Pages): Daten kommen täglich per GitHub Actions, die Knöpfe entfallen
  const LOKAL = location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  let semMsg = null, semBusy = null;
  async function apiCall(pfad, body) {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 180000);
    try {
      const r = await fetch(API + pfad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}), signal: ctl.signal });
      const j = await r.json();
      if (!r.ok) throw new Error(j.fehler || 'HTTP ' + r.status);
      return j;
    } finally { clearTimeout(to); }
  }
  async function refresh(art) {
    if (semBusy) return;
    const mods = [...semMods().keys()], view = art === 'pruef' ? 'pruef' : 'stunden';
    const vorher = Object.fromEntries(mods.map(id => [id, modSnap(id)]));
    semBusy = art; semMsg = null; renderSemester();
    try {
      if (art === 'pruef') {
        const j = await apiCall('pruefungen');
        for (const v of Object.values(SM)) delete v.pruefungen;
        for (const [id, p] of Object.entries(j.pruefungen)) (SM[id] = SM[id] || { kurse: [] }).pruefungen = p;
        SEMD.stand = j.stand; SEMD.standPruefungen = j.standPruefungen;
      } else {
        if (!mods.length) throw new Error('Keine Module ausgewählt.');
        const j = await apiCall('termine', { module: mods });
        for (const [id, v] of Object.entries(j.module)) SM[id] = v;
        SEMD.raeume = j.raeume; Object.assign(SEMD.typen, j.typen); SEMD.stand = j.stand; SEMD.standTermine = j.standTermine;
      }
      const lines = mods.flatMap(id => { const d = modDiff(id, vorher[id]); return d && !d.leer ? describeDiff(id, d) : []; });
      semMsg = { view, lvl: lines.length ? 'ok' : 'info', html: lines.length
        ? `<b>${lines.length} Änderung${lines.length > 1 ? 'en' : ''} gefunden:</b><ul class="chg">${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>`
        : `Keine Änderungen für deine Module. Abgerufen: ${fmtStand(SEMD.stand)}.` };
    } catch (e) {
      semMsg = { view, lvl: 'warn', html: e.name === 'TypeError' || e.name === 'AbortError'
        ? 'Der lokale Hilfsdienst ist nicht erreichbar. Starte ihn mit <code>node tools/server.mjs</code> im Projektordner oder richte den Autostart ein (Doppelklick auf <code>tools\\autostart-einrichten.bat</code>).'
        : 'Aktualisierung fehlgeschlagen: ' + esc(e.message) };
    }
    semBusy = null; renderSemester(); renderPlanCount();
  }
  const refreshBar = (art, label, stand) => !LOKAL ? `<div class="refresh-bar"><span class="hint">Stand: ${fmtStand(stand || SEMD.stand)} · wird täglich automatisch aus TUMonline aktualisiert</span></div>` : `<div class="refresh-bar">
      <button class="btn" data-refresh="${art}" ${semBusy ? 'disabled' : ''}>${semBusy === art ? '⏳ wird abgerufen …' : '↻ ' + label}</button>
      <span class="hint">Stand: ${fmtStand(stand || SEMD.stand)}</span></div>
    ${semMsg && semMsg.view === (art === 'pruef' ? 'pruef' : 'stunden') ? `<div class="${boxCls(semMsg.lvl)}">${semMsg.html}</div>` : ''}`;

  // Stundenplan: Module/Kurse, deren Termine noch fehlen oder unvollständig sind
  function offeneTermine(an) {
    const items = [], li = (t, s) => items.push(`<li><b>${esc(t)}</b> · ${s}</li>`);
    for (const id of an.mods) {
      const t = M[id].titel;
      if (!offered(id)) { li(t, `noch keine Lehrveranstaltungen für das ${esc(SEMD.label)} in TUMonline eingetragen.`); continue; }
      const kurse = SM[id].kurse.filter(k => !S.kursAus[k.id]);
      for (const k of kurse) {
        const n = nTermine(k), name = `${esc(k.typ)} ${esc(kursTitel(k))}`;
        if (!n) li(t, `${name}: Termine noch nicht bekannt.`);
        else if (n <= 2 && ['VO', 'UE', 'VI', 'TT', 'RE'].includes(k.typ)) li(t, `${name}: bisher nur ${n} Termin${n > 1 ? 'e' : ''} bekannt (${esc(serieText(kursTermine(k, 0)))}), weitere folgen vermutlich.`);
        if (k.gruppenOhneTermine) li(t, `${name}: ${k.gruppenOhneTermine} Gruppe${k.gruppenOhneTermine > 1 ? 'n' : ''} noch ohne Termine.`);
      }
      // nur eine Vorlesung eingetragen, die Modulbeschreibung erwähnt aber Übungen
      if (kurse.length && kurse.every(k => k.typ === 'VO') && /übung|exercise|tutori/i.test((M[id].pruefung || '') + ' ' + (M[id].inhalt || '')))
        li(t, 'bisher nur die Vorlesung eingetragen. Laut Modulbeschreibung gibt es vermutlich auch Übungen, deren Termine noch fehlen.');
    }
    return `<div class="panel" style="margin-top:12px"><h2>Noch nicht bekannte Termine <small>Stand ${fmtStand(SEMD.standTermine || SEMD.stand)}</small></h2>
      ${items.length ? `<ul class="offen">${items.join('')}</ul>` : '<p class="hint">Für alle ausgewählten Module sind Termine eingetragen.</p>'}
      <p class="hint">Übungs- und Tutoriumstermine tragen die Lehrstühle oft erst in den ersten Semesterwochen ein. Mit „↻ Termine aktualisieren“ holst du den neuesten Stand.</p></div>`;
  }

  function renderSemester() {
    if (!SEMD) {
      $('sem-title').textContent = 'Aktuelles Semester';
      $('sem-sub').textContent = '';
      $('sem-warn').innerHTML = '<div class="warnbox">Keine Semesterdaten gefunden. Lade sie mit <code>node tools/semester.mjs 207 data</code> (siehe README).</div>';
      $('sem-body').innerHTML = ''; return;
    }
    const an = semAnalyse(), cp = an.mods.reduce((s, id) => s + M[id].ects, 0);
    // Ausgangsstand für neu hinzugekommene Module merken, dann Änderungen dagegen bestimmen
    let snapNeu = false;
    for (const id of an.mods) if (!S.semSnap[id]) { S.semSnap[id] = modSnap(id); snapNeu = true; }
    if (snapNeu) save();
    an.chg = Object.fromEntries(an.mods.map(id => [id, modDiff(id)]).filter(([, d]) => d && !d.leer));
    const chgLines = Object.entries(an.chg).flatMap(([id, d]) => describeDiff(id, d));
    $('sem-title').textContent = SEMD.label;
    $('sem-sub').textContent = `${an.mods.length} Module · ${cp} CP · Termine & Prüfungen aus TUMonline, Stand ${fmtStand(SEMD.stand)}`;
    const ws = semWarnings(an), box = w => `<div class="${boxCls(w.lvl)}">${esc(w.t)}</div>`;
    // lange Konfliktlisten einklappen: die ersten 4 zeigen, Rest aufklappbar
    const head = ws.slice(0, 4), rest = ws.slice(4);
    $('sem-warn').innerHTML =
      (chgLines.length ? `<div class="neu-box"><b>✦ Neu seit deinem letzten Stand (${chgLines.length}):</b><ul class="chg">${chgLines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
        <button class="btn small" data-gesehen="1">Als gesehen markieren</button> <span class="hint">Die Änderungen sind in Auswahl, Stundenplan und Prüfungen mit ✦ markiert.</span></div>` : '') +
      head.map(box).join('') +
      (rest.length ? `<details class="more-warn"><summary>${rest.length} weitere Hinweise anzeigen</summary>${rest.map(box).join('')}</details>` : '') +
      (hidden => hidden.length ? `<div class="infobox">Aus der Semesterplanung entfernt (bleiben in Mein Plan): ${hidden.map(id => `${esc(M[id].titel)} <button class="link-btn" data-semshow="${id}">wieder aufnehmen</button>`).join(' · ')}</div>` : '')(
        Object.keys(S.semAusgeblendet).filter(id => M[id] && S.plan[id] && S.plan[id].sem === curPlanSem() && S.plan[id].st !== 'bestanden')) +
      (!an.mods.length ? `<div class="infobox">Noch keine Module für das ${esc(SEMD.label)}. Suche unten nach Fächern oder füge sie im Katalog mit „+ Semester“ hinzu${curPlanSem() != null ? '. Module, die in „Mein Plan“ in diesem Semester liegen, erscheinen automatisch' : ''}.</div>` : '');
    $('sem-alle').checked = !!S.semAlle;
    for (const b of $('sem-tabs').children) b.classList.toggle('on', b.dataset.v === S.semView);
    $('sem-body').innerHTML = S.semView === 'stunden' ? semWeek(an) : S.semView === 'pruef' ? semExams(an) : semList_(an);
    renderSemHits();
  }

  function renderSemHits() {
    if (!SEMD) return;
    const terms = norm($('sem-q').value).split(/\s+/).filter(Boolean);
    if (!terms.length) { $('sem-hits').innerHTML = ''; return; }
    const sel = semMods();
    const sc = m => m.fokus.filter(x => S.fokus.includes(x)).length * 2 + m.fokus.filter(x => S.fokus2.includes(x)).length;
    const hits = D.module.filter(m => (S.semAlle || offered(m.id)) && terms.every(t => searchIdx.get(m.id).includes(t)))
      .sort((a, b) => offered(b.id) - offered(a.id) || sc(b) - sc(a) || a.titel.localeCompare(b.titel, 'de')).slice(0, 20);
    $('sem-hits').innerHTML = hits.length ? `<div class="pick">${hits.map(m => {
      const ex = mainExam(m.id), s = sel.get(m.id);
      return `<div><span><span class="link-btn" data-jump="${m.id}">${esc(m.titel)}</span> <span class="hint">${esc(m.kennung)} · ${m.ects} CP${offered(m.id) ? ' · ' + esc(kursTypen(m.id)) : ' · keine Termine'}</span>
        ${hatPflicht(m.id) ? '<span class="tag bad">Präsenzpflicht</span>' : ''}${ex ? ` <span class="tag ex">✎ ${fmtIso(ex.datum)}</span>` : ''}</span>
        ${s ? (s.auswahl ? `<button class="btn small" data-semrm="${m.id}" title="Wieder entfernen">✓ ausgewählt</button>` : `<button class="btn small" data-semrm="${m.id}" title="Aus der Semesterplanung entfernen (bleibt in Mein Plan)">✓ aus Mein Plan</button>`) : `<button class="btn small primary" data-semadd="${m.id}">+ hinzufügen</button>`}</div>`;
    }).join('')}</div>` : '<p class="hint">Keine Treffer' + (S.semAlle ? '' : ' unter den Modulen mit Terminen in diesem Semester') + '.</p>';
  }

  // Auswahl-Liste mit Kursen, Gruppenwahl und Präsenz-Einstufung
  function semList_(an) {
    if (!an.mods.length) return '';
    const sm = semMods(), cs = curPlanSem();
    return `<div class="smods">${an.mods.map(id => {
      const m = M[id], src = sm.get(id), ex = mainExam(id);
      const kurse = SM[id] ? SM[id].kurse : [];
      return `<div class="smod" style="--h:${an.hue[id]}">
        <div class="smod-head"><span class="t" data-jump="${id}" title="Im Katalog öffnen">${esc(m.titel)}</span>
          <span class="tag ects">${m.ects} CP</span>
          ${src.plan ? `<span class="tag okt" title="Steht in Mein Plan in diesem Semester">Mein Plan · ${SHORT[src.plan.b] || ''}</span>` : ''}
          ${ex ? `<span class="tag ex" title="${esc(ex.art)} ${esc(ex.sem)}${ex.info ? ' · ' + esc(ex.info) : ''}">✎ Prüfung ${fmtIso(ex.datum, true)}${ex.von ? ' ' + ex.von : ''}${ex.eigenes ? '' : ' (Wdh.)'}</span>` : '<span class="tag" title="In TUMonline ist noch kein Prüfungstermin eingetragen">Prüfung: noch kein Termin</span>'}
          ${an.chg[id] && (an.chg[id].exNeu.length || an.chg[id].exWeg.length) ? '<span class="tag neu">✦ Prüfung neu/geändert</span>' : ''}
          ${!offered(id) ? '<span class="tag warn">keine Termine in diesem Semester</span>' : ''}
          <span class="row">${!S.plan[id] && cs != null ? `<button class="btn small" data-semplan="${id}" title="Im ${cs}. Semester in Mein Plan eintragen">→ Mein Plan</button>` : ''}
          <button class="icon-btn" data-semrm="${id}" title="${src.plan ? 'Aus der Semesterplanung entfernen (bleibt in Mein Plan)' : 'Aus der Semester-Auswahl entfernen'}">×</button></span></div>
        ${kurse.map(k => {
          const c = an.chosen[k.id], aus = !!S.kursAus[k.id], p = pflicht(k), g = c ? c.g : 0;
          const grp = k.gruppen.length > 1 ? `<select data-kwahl="${k.id}" title="Gruppe"><option value="">auto${c ? ': ' + esc(k.gruppen[c.g].n) : ''}</option>${k.gruppen.map((gr, i) => `<option value="${i}" ${S.kursWahl[k.id] === i ? 'selected' : ''}>${esc(gr.n)} · ${esc(serieText(gr.t, true))}</option>`).join('')}</select>` : '';
          return `<div class="kurs ${aus ? 'off' : ''}">
            <span class="ktyp" title="${esc(SEMD.typen[k.typ] || k.typ)}">${esc(k.typ)}</span>
            <span>${esc(kursTitel(k))}${k.sws ? ` <span class="hint">· ${k.sws} SWS</span>` : ''}${(c2 => c2 ? ` <span class="tag neu">✦ ${c2.art === 'neu' ? 'neu' : 'Termine geändert'}</span>` : '')(an.chg[id] && an.chg[id].kurse[k.id])}<br><span class="kzeit">${esc(serieText(kursTermine(k, g)))}</span></span>
            <span class="kctl">${grp}
              <button class="tag pz ${p}" data-pz="${k.id}" title="${esc(k.praesenzGrund)}${S.praesenz[k.id] ? '\n(von dir geändert)' : ''}\nKlicken zum Ändern">${PZ_LABEL[p]}${S.praesenz[k.id] ? ' ✎' : ''}</button>
              <label class="hint" title="Im Stundenplan und bei Überschneidungen berücksichtigen"><input type="checkbox" data-kursan="${k.id}" ${aus ? '' : 'checked'}> besuchen</label></span>
          </div>`;
        }).join('')}
      </div>`;
    }).join('')}</div>
    <p class="hint">Präsenz-Einstufung: Praktika, Seminare, Workshops und Exkursionen gelten als Pflicht, Vorlesungen nicht. Bei Übungen ist es meist unklar, außer die Beschreibung sagt es ausdrücklich. Mit Klick auf das Etikett stellst du es selbst ein (Pflicht → 1. Termin → unklar → keine).</p>`;
  }

  // Wochenansicht
  function semWeek(an) {
    const bar = refreshBar('termine', 'Termine aktualisieren', SEMD.standTermine);
    if (!an.ev.length) return bar + '<div class="panel"><p class="hint">Keine Termine. Füge Module mit Lehrveranstaltungen in diesem Semester hinzu.</p></div>' + (an.mods.length ? offeneTermine(an) : '');
    const mon0 = -((DAY0.getDay() + 6) % 7); // Montag der Woche des Semesterbeginns
    const weekOf = d => Math.floor((d - mon0) / 7);
    const dMin = Math.min(...an.ev.map(x => x.d)), dMax = Math.max(...an.ev.map(x => x.d));
    const today = dayOfDate(new Date());
    // Standard: aktuelle Woche, sonst die erste Woche mit vielen Terminen
    let def = today >= dMin && today <= dMax ? weekOf(today) : weekOf(dMin);
    if (!(today >= dMin && today <= dMax)) { const cnt = {}; for (const x of an.ev) cnt[weekOf(x.d)] = (cnt[weekOf(x.d)] || 0) + 1; const mx = Math.max(...Object.values(cnt)); def = Number(Object.keys(cnt).find(w => cnt[w] >= mx * 0.6)); }
    let w = S.semWoche == null ? def : S.semWoche;
    w = Math.max(weekOf(dMin), Math.min(weekOf(dMax), w));
    const d0 = mon0 + w * 7;
    const evW = an.ev.filter(x => x.d >= d0 && x.d < d0 + 7 && (!S.nurPflicht || x.pf || x.un));
    const days = [0, 1, 2, 3, 4].concat([5, 6].filter(i => evW.some(x => x.d === d0 + i)));
    const H0 = Math.min(8, Math.floor(Math.min(...an.ev.map(x => x.s)) / 60)), H1 = Math.max(19, Math.ceil(Math.max(...an.ev.map(x => x.e)) / 60));
    const HP = 46, px = m => (m - H0 * 60) * HP / 60;
    const kw = (dt => { const t = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate())); const dn = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dn); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 864e5 + 1) / 7); })(dateOf(d0));
    // Spalten-Layout für überlappende Termine
    const cols = di => {
      const arr = evW.filter(x => x.d === d0 + di).sort((a, b) => a.s - b.s || b.e - a.e);
      const out = []; let cluster = [], end = -1;
      const flush = () => { const lanes = []; for (const x of cluster) { let l = lanes.findIndex(e => e <= x.s); if (l < 0) { l = lanes.length; lanes.push(0); } lanes[l] = x.e; x.lane = l; } for (const x of cluster) x.lanes = lanes.length; out.push(...cluster); cluster = []; };
      for (const x of arr) { if (x.s >= end && cluster.length) flush(); cluster.push(x); end = Math.max(end, x.e); }
      if (cluster.length) flush();
      return out;
    };
    const evHtml = x => {
      const room = roomName(x.r), top = px(x.s), h = Math.max(18, px(x.e) - top);
      const tip = `${M[x.id].titel}\n${x.k.typ} ${kursTitel(x.k)}${x.k.gruppen.length > 1 ? ' · ' + x.k.gruppen[x.g].n : ''}\n${hm(x.s)}–${hm(x.e)}${room ? ' · ' + room : ''}\n${x.pf ? 'Präsenzpflicht' : x.un ? 'Präsenzpflicht unklar' : 'keine Präsenzpflicht'}${x.konf === 'bad' ? '\n⚠ Überschneidung zweier Pflichttermine' : x.konf === 'warn' ? '\n⚠ möglicher Konflikt' : x.konf ? '\nÜberschneidung' : ''}`;
      const neu = !!(an.chg[x.id] && an.chg[x.id].kurse[x.k.id]);
      return `<div class="ev ${x.pf ? '' : 'optional'} ${x.konf === 'bad' || x.konf === 'warn' ? 'k-' + x.konf : ''} ${neu ? 'neu' : ''}" style="--h:${x.h};top:${top}px;height:${h}px;left:calc(${x.lane / x.lanes * 100}% + 1px);width:calc(${100 / x.lanes}% - 2px)" title="${esc(tip)}${neu ? '\n✦ neu bzw. geändert' : ''}">
        <b>${neu ? '✦ ' : ''}${x.pf ? '<span class="pf">●</span> ' : x.un ? '? ' : ''}${esc(x.k.typ)} ${esc(M[x.id].titel)}</b>${hm(x.s)}–${hm(x.e)}${room ? `<br>${esc(room)}` : ''}</div>`;
    };
    const confW = an.pairs.filter(c => c.lvl === 'bad' || c.lvl === 'warn').length;
    return `${bar}<div class="week-nav">
        <button class="btn" data-wk="${w - 1}" ${w <= weekOf(dMin) ? 'disabled' : ''}>◀</button>
        <span class="wk">KW ${kw} · ${ddmm(dateOf(d0))}–${dateOf(d0 + 6).toLocaleDateString('de-DE')}</span>
        <button class="btn" data-wk="${w + 1}" ${w >= weekOf(dMax) ? 'disabled' : ''}>▶</button>
        <button class="btn small" data-wk="heute">${today >= dMin && today <= dMax ? 'Diese Woche' : 'Standardwoche'}</button>
        <label class="hint"><input type="checkbox" id="sem-nurpf" ${S.nurPflicht ? 'checked' : ''}> nur Präsenzpflicht &amp; unklare</label>
        <span class="hint">${evW.length} Termine${confW ? ` · <span style="color:var(--bad)">${confW} Konflikt${confW > 1 ? 'e' : ''} im Semester</span>` : ''}</span>
      </div>
      <div class="week-wrap"><div class="week" style="grid-template-columns:44px repeat(${days.length}, minmax(110px, 1fr));--hour:${HP}px">
        <div class="dh" style="border-left:0"></div>
        ${days.map(i => { const dt = dateOf(d0 + i); return `<div class="dh ${d0 + i === today ? 'today' : ''}">${WD[dt.getDay()]}<small>${ddmm(dt)}</small></div>`; }).join('')}
        <div class="tcol" style="height:${(H1 - H0) * HP}px">${Array.from({ length: H1 - H0 }, (_, i) => i ? `<span style="top:${i * HP}px">${H0 + i}:00</span>` : '').join('')}</div>
        ${days.map(i => `<div class="dcol" style="height:${(H1 - H0) * HP}px">${cols(i).map(evHtml).join('')}</div>`).join('')}
      </div></div>
      <div class="legend"><span><i style="background:hsl(210 80% 85%);border-left:3px solid hsl(210 60% 45%)"></i>● Präsenzpflicht</span><span><i style="background:hsl(210 60% 94%);border-left:3px dotted hsl(210 60% 45%)"></i>keine Pflicht</span><span>? = Pflicht unklar</span><span><i style="outline:2px solid var(--bad)"></i>Pflichttermine überschneiden sich</span><span><i style="outline:2px dashed var(--warn)"></i>möglicher Konflikt</span><span>✦ = neu/geändert</span></div>
      ${offeneTermine(an)}`;
  }

  // Prüfungskalender
  function semExams(an) {
    const own = an.exs, ohne = an.mods.filter(id => !exams(id).some(p => p.datum));
    const bar = refreshBar('pruef', 'Prüfungstermine aktualisieren', SEMD.standPruefungen);
    if (!an.mods.length) return bar;
    const isNeu = x => !!(an.chg[x.id] && an.chg[x.id].exNeu.some(p => exSig(p) === exSig(x.p)));
    const verschoben = x => isNeu(x) && an.chg[x.id].exWeg.some(s => s.split('|')[0] !== '-');
    // Zeilen für Module ohne veröffentlichten Termin
    const ohneRows = ohne.map(id => {
      const offen = exams(id)[0]; // Prüfung angelegt, aber ohne Datum
      return `<tr class="ohne"><td colspan="2"><span class="tag">kein Termin bekannt</span></td>
        <td><span class="link-btn" data-jump="${id}" style="border-left:3px solid hsl(${an.hue[id]} 60% 50%);padding-left:5px">${esc(M[id].titel)}</span></td>
        <td>${offen ? esc(offen.art) + '<br><span class="hint">angelegt, Datum offen</span>' : '–'}</td>
        <td class="hint" style="white-space:nowrap">${offen && offen.anmeldung[1] ? `${offen.anmeldung[0] ? fmtIso(offen.anmeldung[0]) : '?'} –<br>${fmtIso(offen.anmeldung[1])}` : '–'}</td>
        <td class="hint">${offen && offen.info ? esc(offen.info) : 'Noch nicht in TUMonline veröffentlicht.'}</td></tr>`;
    }).join('');
    const table = rows => `<div class="panel"><h2>Prüfungstermine deiner Module <small>✦ = neu/geändert · helle Einträge = Wiederholungsprüfung eines früheren Semesters</small></h2>
      <div class="tbl-wrap"><table class="list"><tr><th>Datum</th><th>Zeit</th><th>Modul</th><th>Art</th><th>Anmeldung</th><th>Hinweis</th></tr>${rows}${ohneRows}</table></div>
      ${ohne.length ? `<p class="hint">${ohne.length} Modul${ohne.length > 1 ? 'e haben' : ' hat'} noch keinen veröffentlichten Termin. Mit „↻ Prüfungstermine aktualisieren“ prüfst du, ob inzwischen einer eingetragen ist.</p>` : ''}</div>`;
    if (!own.length) return bar + table('');
    const months = [...new Set(own.map(x => x.p.datum.slice(0, 7)))].sort();
    const clash = new Map(an.exWarn.map(w => [w.d, w.lvl]));
    const monthHtml = ym => {
      const [y, mo] = ym.split('-').map(Number), first = new Date(y, mo - 1, 1), nd = new Date(y, mo, 0).getDate(), off = (first.getDay() + 6) % 7;
      let h = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(x => `<div class="wd">${x}</div>`).join('') + '<div class="d out"></div>'.repeat(off);
      for (let d = 1; d <= nd; d++) {
        const iso = `${ym}-${String(d).padStart(2, '0')}`, xs = own.filter(x => x.p.datum === iso), wd = (off + d - 1) % 7;
        h += `<div class="d ${wd >= 5 ? 'we' : ''} ${clash.get(iso) === 'bad' ? 'clash' : xs.length ? 'has' : ''}"><span class="n">${d}</span>${xs.map(x => `<span class="x ${x.p.eigenes ? '' : 'wdh'} ${isNeu(x) ? 'neu' : ''}" style="--h:${x.h}" title="${isNeu(x) ? '✦ neu/geändert\n' : ''}${esc(M[x.id].titel)}\n${esc(x.p.art)} · ${esc(x.p.sem)}${x.p.eigenes ? '' : ' (Wiederholung)'}${x.p.von ? '\n' + x.p.von + (x.p.bis ? '–' + x.p.bis : '') : ''}${x.p.info ? '\n' + esc(x.p.info) : ''}">${esc(M[x.id].titel)}</span>`).join('')}</div>`;
      }
      return `<div class="month"><h3>${first.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</h3><div class="mgrid">${h}</div></div>`;
    };
    const rows = [...own].sort((a, b) => a.p.datum.localeCompare(b.p.datum) || (a.p.von || '').localeCompare(b.p.von || ''));
    return bar + `<div class="months">${months.map(monthHtml).join('')}</div>` + table(
      rows.map(x => `<tr class="${isNeu(x) ? 'neu' : ''}"${clash.has(x.p.datum) && x.p.eigenes ? ` style="background:var(--${clash.get(x.p.datum) === 'bad' ? 'bad' : 'warn'}-soft)"` : ''}><td style="white-space:nowrap">${isNeu(x) ? `<span class="tag neu">✦ ${verschoben(x) ? 'verschoben' : 'neu'}</span><br>` : ''}${fmtIso(x.p.datum, true)}</td><td style="white-space:nowrap">${x.p.von ? x.p.von + (x.p.bis ? '–' + x.p.bis : '') : '–'}</td>
        <td><span class="link-btn" data-jump="${x.id}" style="border-left:3px solid hsl(${x.h} 60% 50%);padding-left:5px">${esc(M[x.id].titel)}</span></td>
        <td>${esc(x.p.art)}<br><span class="hint">${esc(x.p.sem)}${x.p.eigenes ? '' : ', Wiederholung'}</span></td>
        <td class="hint" style="white-space:nowrap">${x.p.anmeldung[0] ? fmtIso(x.p.anmeldung[0]) : '?'} –<br>${x.p.anmeldung[1] ? fmtIso(x.p.anmeldung[1]) : '?'}</td>
        <td class="hint">${esc(x.p.info)}${x.p.pruefer ? `${x.p.info ? '<br>' : ''}Prüfer: ${esc(x.p.pruefer)}` : ''}</td></tr>`).join(''));
  }

  $('sem-tabs').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; S.semView = b.dataset.v; save(); renderSemester(); });
  let semQTimer;
  $('sem-q').addEventListener('input', () => { clearTimeout(semQTimer); semQTimer = setTimeout(renderSemHits, 120); });
  $('sem-alle').addEventListener('change', e => { S.semAlle = e.target.checked; save(); renderSemHits(); });
  $('view-semester').addEventListener('click', e => {
    const wk = e.target.closest('[data-wk]'), rf = e.target.closest('[data-refresh]'), gs = e.target.closest('[data-gesehen]');
    if (wk) { S.semWoche = wk.dataset.wk === 'heute' ? null : Number(wk.dataset.wk); save(); renderSemester(); }
    else if (rf) refresh(rf.dataset.refresh);
    else if (gs) { for (const id of semMods().keys()) S.semSnap[id] = modSnap(id); semMsg = null; save(); renderSemester(); }
  });
  $('view-semester').addEventListener('change', e => {
    const t = e.target, d = t.dataset;
    if (d.kwahl) { if (t.value === '') delete S.kursWahl[d.kwahl]; else S.kursWahl[d.kwahl] = Number(t.value); }
    else if (d.kursan) { if (t.checked) delete S.kursAus[d.kursan]; else S.kursAus[d.kursan] = true; }
    else if (t.id === 'sem-nurpf') S.nurPflicht = t.checked;
    else return;
    save(); renderSemester();
  });

  $('tab-semester-label').textContent = SEMD ? termLabel : 'Semester';

  // ---------- Katalog (öffentlicher Studienplan) über den Hilfsdienst neu laden ----------
  const KAT_DIFF = 'mw-faecheruebersicht-katalog-diff';
  const DIENST_FEHLT = 'Der lokale Hilfsdienst ist nicht erreichbar. Starte ihn mit <code>node tools/server.mjs</code> im Projektordner oder richte den Autostart ein (Doppelklick auf <code>tools\\autostart-einrichten.bat</code>).';
  let katTimer = null;
  function katStatus(j) {
    const laeuft = !!(j && j.status === 'laeuft');
    $('kat-refresh').disabled = laeuft;
    $('kat-refresh').textContent = laeuft ? '⏳ Studienplan wird geladen …' : '↻ Studienplan aktualisieren';
    $('kat-status').textContent = laeuft ? [j.schritt, j.info].filter(Boolean).join(' · ') : '';
  }
  // start = true: Auftrag starten; danach alle 2 s den Fortschritt abfragen
  async function katPoll(start) {
    clearTimeout(katTimer);
    let j;
    try { j = await (await fetch(API + 'katalog', start ? { method: 'POST' } : {})).json(); }
    catch (e) { katStatus(null); $('kat-msg').innerHTML = `<div class="warnbox">${DIENST_FEHLT}</div>`; return; }
    katStatus(j);
    if (j.status === 'laeuft') { katTimer = setTimeout(() => katPoll(false), 2000); return; }
    if (start) return; // ein alter, schon beendeter Auftrag
    if (j.status === 'fehler') $('kat-msg').innerHTML = `<div class="warnbox bad">Der Studienplan konnte nicht aktualisiert werden: ${esc(j.fehler)}</div>`;
    if (j.status === 'fertig') {
      // neu laden, damit data/modules.js gilt; die Zusammenfassung überlebt das Neuladen
      try { localStorage.setItem(KAT_DIFF, JSON.stringify({ ...j.diff, stand: j.stand })); } catch (e) {}
      location.reload();
    }
  }
  $('kat-refresh').addEventListener('click', () => { $('kat-msg').innerHTML = ''; katPoll(true); });
  // läuft beim Öffnen schon ein Auftrag (z. B. aus einem anderen Fenster), Fortschritt weiter anzeigen
  if (!LOKAL) { $('kat-refresh').hidden = true; $('kat-status').textContent = ''; }
  else fetch(API + 'katalog').then(r => r.json()).then(j => { if (j.status === 'laeuft') { katStatus(j); katTimer = setTimeout(() => katPoll(false), 2000); } }).catch(() => {});
  function renderKatDiff() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KAT_DIFF) || 'null'); } catch (e) {}
    if (!d) return;
    const name = x => M[x.id] ? `<button class="link-btn" data-jump="${x.id}">${esc(x.titel)}</button>` : esc(x.titel);
    const liste = (arr, f) => arr.length > 12 ? `<details><summary>${arr.length} anzeigen</summary><ul class="chg">${arr.map(f).join('')}</ul></details>` : `<ul class="chg">${arr.map(f).join('')}</ul>`;
    const vorher = x => Object.keys(x.vorher).length ? ' (vorher ' + Object.entries(x.vorher).map(([k, v]) => `${esc(k)} ${esc(Array.isArray(v) ? v.join(', ') : v)}`).join(', ') + ')' : '';
    const wegPlan = d.weg.filter(x => planEntfernt.includes(x.id));
    const ersetzt = planErsetzt.map(([a, n]) => `${esc(d.weg.find(x => x.id === a).titel)} (${esc(d.weg.find(x => x.id === a).kennung)} → ${esc(M[n].kennung)})`);
    const n = d.neu.length + d.weg.length + d.geaendert.length;
    $('kat-msg').innerHTML = `<div class="${n ? 'neu-box' : 'okbox'}">
      <b>Studienplan aktualisiert</b> (Datenstand ${new Date(d.stand).toLocaleDateString('de-DE')}, ${d.anzahl} Module${d.anzahl !== d.anzahlVorher ? `, vorher ${d.anzahlVorher}` : ''}).${n ? '' : ' Keine Änderungen gegenüber dem bisherigen Stand.'}
      ${wegPlan.length ? `<div class="warnbox bad" style="margin-top:6px">Aus deinem Plan entfernt, weil es diese Module im Studienplan nicht mehr gibt: ${wegPlan.map(x => esc(x.titel)).join(', ')}.</div>` : ''}
      ${ersetzt.length ? `<div class="okbox" style="margin-top:6px">In deinem Plan auf die neue Kennung umgestellt: ${ersetzt.join(', ')}.</div>` : ''}
      ${d.neu.length ? `<div style="margin-top:6px"><b>✦ ${d.neu.length} neue Module:</b>${liste(d.neu, x => `<li>${name(x)} <span class="hint">${esc(x.kennung)}</span></li>`)}</div>` : ''}
      ${d.geaendert.length ? `<div><b>${d.geaendert.length} geänderte Module:</b>${liste(d.geaendert, x => `<li>${name(x)}: <span class="hint">${x.felder.map(esc).join(', ')}${vorher(x)}</span></li>`)}</div>` : ''}
      ${d.weg.length ? `<div><b>${d.weg.length} entfernte Module:</b>${liste(d.weg, x => `<li>${esc(x.titel)} <span class="hint">${esc(x.kennung)}</span></li>`)}</div>` : ''}
      <button class="btn small" data-katok="1" style="margin-top:6px">Schließen</button></div>`;
  }
  $('kat-msg').addEventListener('click', e => {
    const j = e.target.closest('[data-jump]'), ok = e.target.closest('[data-katok]');
    if (j) jump(j.dataset.jump);
    else if (ok) { try { localStorage.removeItem(KAT_DIFF); } catch (e2) {} $('kat-msg').innerHTML = ''; }
  });

  // ---------- Tabs ----------
  const TABS = ['katalog', 'wizard', 'plan', 'semester'];
  function renderCurrent() { if (S.tab === 'plan') renderPlan(); else if (S.tab === 'wizard') renderWizard(); else if (S.tab === 'semester') renderSemester(); else renderList(); }
  function setTab(t) {
    if (!TABS.includes(t)) t = 'katalog';
    S.tab = t; save();
    for (const v of TABS) { $('view-' + v).hidden = v !== t; $('tab-' + v).classList.toggle('active', v === t); }
    renderCurrent();
  }
  for (const v of TABS) $('tab-' + v).addEventListener('click', () => setTab(v));
  function renderAll() { renderFokus(); renderFilters(); renderPlanCount(); renderCurrent(); }
  delete S.semModus; // früherer Semester-Modus-Schalter
  renderAll(); renderKatDiff(); setTab(S.tab || 'katalog');
})();
