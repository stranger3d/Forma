// Gym: one muscle group per session, timed sessions that fit a fixed window
// (Luca trains 4:50 to 5:45), supersets, rest per exercise, last-time loads and
// a hint on when to add weight. Loaded before app.js: declarations only, and
// gymInit() (called by app.js) wires the events.

// ---------- exercise library ----------
// kind: main (heavy compound), acc (secondary), iso (isolation). Used for the
// default rest, the time estimate and the weight step.
// [name, group, kind, muscles, how to do it]
const EXLIB_RAW = [
  // petto
  ['Panca inclinata bilanciere', 'petto', 'main', 'Petto alto, deltoide anteriore, tricipiti', 'Panca a 30-35°, scapole strette e petto alto. Scendi controllato fino a sfiorare la parte alta del petto, spingi senza bloccare i gomiti.'],
  ['Croci su panca inclinata', 'petto', 'iso', 'Petto alto', 'Stessa inclinazione della spinta (circa 32°). Gomiti leggermente piegati e fermi, apri finché senti l\'allungamento, chiudi stringendo il petto.'],
  ['Chest press', 'petto', 'main', 'Petto, deltoide anteriore, tricipiti', 'Maniglie all\'altezza del petto, schiena appoggiata e scapole indietro. Spingi in avanti, torna lento fino a sentire l\'allungamento.'],
  ['Panca piana manubri', 'petto', 'main', 'Petto, deltoide anteriore, tricipiti', 'Manubri sopra il petto, scendi con i gomiti a circa 45° dal busto. Spingi in alto avvicinando i manubri senza farli sbattere.'],
  ['Croci su panca piana', 'petto', 'iso', 'Petto', 'Manubri sopra il petto, gomiti morbidi e fermi. Apri ad arco fino all\'allungamento, risali come ad abbracciare un albero.'],
  ['Croci ai cavi', 'petto', 'iso', 'Petto', 'Cavi alti o a metà, un passo avanti. Parti con le braccia aperte e il petto allungato, chiudi davanti a te e tieni un secondo.'],
  ['Croci ai cavi dal basso', 'petto', 'iso', 'Petto alto', 'Cavi in basso, porta le mani in alto davanti al viso con un arco. Ottimo per finire la parte alta del petto.'],
  ['Pectoral machine', 'petto', 'iso', 'Petto', 'Schiena appoggiata, gomiti all\'altezza delle spalle. Chiudi lento, tieni un secondo al centro, riapri fino all\'allungamento.'],
  ['Dip alle parallele', 'petto', 'acc', 'Petto basso, tricipiti, deltoide anteriore', 'Busto inclinato in avanti per il petto, dritto per i tricipiti. Scendi finché le spalle sono all\'altezza dei gomiti.'],
  // spalle
  ['Shoulder press', 'spalle', 'main', 'Deltoide anteriore e laterale, tricipiti', 'Spinta verticale pesante. Schiena appoggiata, maniglie all\'altezza del mento, spingi in alto senza inarcare la schiena.'],
  ['Lento avanti manubri', 'spalle', 'main', 'Deltoide anteriore e laterale, tricipiti', 'Seduto con schienale quasi dritto. Manubri all\'altezza delle orecchie, spingi in alto e un po\' verso il centro.'],
  ['Alzate laterali stripping', 'spalle', 'iso', 'Deltoide laterale', 'Braccia leggermente piegate, sali fino all\'altezza delle spalle guidando con i gomiti. Nell\'ultima serie a cedimento scala il peso 2 volte senza pausa.'],
  ['Alzate laterali ai cavi', 'spalle', 'iso', 'Deltoide laterale', 'Cavo basso dal lato opposto, un braccio alla volta. Sali con il gomito fino alla spalla, scendi lento: tensione continua.'],
  ['Reverse pec deck', 'spalle', 'iso', 'Deltoide posteriore, romboidi', 'Petto contro lo schienale, braccia quasi tese. Apri all\'indietro guidando con i gomiti, senza stringere troppo le scapole.'],
  ['Face pull', 'spalle', 'iso', 'Deltoide posteriore, cuffia dei rotatori, trapezio', 'Cavo alto con la corda. Tira verso il viso aprendo le mani ai lati delle orecchie, gomiti alti.'],
  ['Croci inverse ai cavi alti', 'spalle', 'iso', 'Deltoide posteriore', 'Cavi alti incrociati, prendi il cavo opposto. Apri le braccia all\'indietro all\'altezza delle spalle, gomiti morbidi.'],
  // braccia
  ['Curl bilanciere EZ', 'braccia', 'main', 'Bicipiti, brachiale', 'Gomiti fermi ai fianchi, sali senza dondolare il busto. Scendi lento fino a braccia quasi tese.'],
  ['Curl su panca inclinata', 'braccia', 'acc', 'Bicipiti (capo lungo)', 'Panca a 45-60°, braccia lasciate cadere dietro il busto. Sali ruotando il palmo verso l\'alto, gomiti fermi.'],
  ['Curl concentrato', 'braccia', 'iso', 'Bicipiti', 'Seduto, gomito appoggiato all\'interno della coscia. Sali stringendo in alto, scendi fino quasi a tendere il braccio.'],
  ['Curl a martello', 'braccia', 'iso', 'Brachiale, brachioradiale', 'Palmi che si guardano, gomiti fermi. Sali fino alla spalla senza ruotare il polso.'],
  ['Dip tricipiti', 'braccia', 'main', 'Tricipiti, petto basso', 'Busto dritto, gomiti stretti che puntano indietro. Scendi fino a 90° ai gomiti e spingi fino a braccia tese.'],
  ['Estensioni sopra la testa al cavo', 'braccia', 'acc', 'Tricipiti (capo lungo)', 'Di schiena al cavo con la corda, gomiti vicino alla testa. Distendi le braccia in avanti e in alto, torna fino all\'allungamento.'],
  ['Pushdown ai cavi', 'braccia', 'iso', 'Tricipiti', 'Gomiti incollati ai fianchi, spingi giù fino a braccia tese. Risali lento fino a 90°.'],
  ['French press', 'braccia', 'acc', 'Tricipiti', 'Sdraiato, bilanciere EZ sopra la fronte. Piega solo i gomiti, che restano fermi e stretti.'],
  ['Curl polsi', 'braccia', 'iso', 'Avambracci (flessori)', 'Avambracci appoggiati sulle cosce, palmi in alto. Muovi solo i polsi, ampiezza completa.'],
  ['Curl inverso', 'braccia', 'iso', 'Avambracci (estensori), brachioradiale', 'Presa prona (palmi in basso) con EZ o cavo. Sali tenendo i polsi dritti, gomiti fermi.'],
  // schiena
  ['Lat machine', 'schiena', 'main', 'Gran dorsale, bicipiti, romboidi', 'Presa poco più larga delle spalle, petto alto. Tira la barra al petto portando i gomiti giù e indietro.'],
  ['Pulley basso', 'schiena', 'main', 'Gran dorsale, romboidi, trapezio medio', 'Schiena dritta, tira il triangolo all\'ombelico stringendo le scapole. Torna allungando senza curvare la schiena.'],
  ['Rematore manubrio', 'schiena', 'acc', 'Gran dorsale, romboidi', 'Ginocchio e mano sulla panca, schiena piatta. Tira il manubrio verso l\'anca, gomito vicino al busto.'],
  ['Trazioni', 'schiena', 'main', 'Gran dorsale, bicipiti', 'Presa poco più larga delle spalle. Sali con il petto verso la sbarra, scendi fino a braccia tese.'],
  ['Pulldown braccia tese', 'schiena', 'iso', 'Gran dorsale', 'Cavo alto con barra o corda, braccia quasi tese. Porta le mani alle cosce con un arco, solo con le spalle.'],
  ['Hyperextension', 'schiena', 'acc', 'Lombari, glutei, femorali', 'Bacino sul cuscino, scendi con la schiena dritta. Risali fino a busto in linea con le gambe, senza iperestendere.'],
  // gambe
  ['Squat', 'gambe', 'main', 'Quadricipiti, glutei, adduttori', 'Piedi larghezza spalle, punte un po\' aperte. Scendi con il busto fermo finché le cosce sono parallele, spingi dai talloni.'],
  ['Stacco rumeno', 'gambe', 'main', 'Femorali, glutei, lombari', 'Ginocchia appena piegate e ferme. Porta le anche indietro con la schiena piatta, scendi finché senti i femorali, risali spingendo le anche avanti.'],
  ['Affondi bulgari', 'gambe', 'acc', 'Quadricipiti, glutei', 'Piede dietro sulla panca, manubri in mano. Scendi dritto finché il ginocchio dietro sfiora terra. Serie per gamba.'],
  ['Affondi', 'gambe', 'acc', 'Quadricipiti, glutei', 'Passo lungo, scendi finché entrambe le ginocchia sono a 90°. Spingi con il tallone davanti.'],
  ['Leg press', 'gambe', 'main', 'Quadricipiti, glutei', 'Piedi a metà pedana, larghezza spalle. Scendi finché il bacino resta appoggiato, spingi senza bloccare le ginocchia.'],
  ['Leg extension', 'gambe', 'iso', 'Quadricipiti', 'Schiena appoggiata, distendi le gambe e tieni un secondo in alto. Scendi lento.'],
  ['Leg curl', 'gambe', 'iso', 'Femorali', 'Rullo sopra i talloni, piega le ginocchia fino in fondo. Torna lento senza far sbattere i pesi.'],
  ['Hip thrust', 'gambe', 'acc', 'Glutei', 'Schiena alta sulla panca, bilanciere sulle anche. Spingi le anche in alto fino a busto e cosce in linea, mento basso.'],
  ['Calf raise', 'gambe', 'iso', 'Polpacci', 'Punte sul gradino, talloni giù fino all\'allungamento. Sali in punta e tieni un secondo.'],
  // altro
  ['Plank', 'altro', 'iso', 'Addome, core', 'Avambracci a terra, corpo in linea dalla testa ai talloni. Stringi addome e glutei.'],
  ['Crunch ai cavi', 'altro', 'iso', 'Addome', 'In ginocchio, corda ai lati della testa. Arrotola il busto verso le ginocchia, non tirare con le braccia.'],
];
const EXLIB = {};
EXLIB_RAW.forEach(([name, group, kind, muscles, how]) => { EXLIB[name] = { name, group, kind, muscles, how }; });
// old names from the first version
['Panca piana', 'Panca inclinata manubri', 'Rematore bilanciere', 'Military press', 'Alzate laterali', 'Curl bilanciere', 'Curl manubri', 'Pushdown ai cavi', 'Dip', 'Stacco da terra', 'Crunch', 'Tapis roulant', 'Cyclette']
  .forEach((n) => { if (!EXLIB[n]) EXLIB[n] = { name: n, group: 'altro', kind: /Panca|Rematore|Military|Stacco|Dip/.test(n) ? 'main' : 'iso', muscles: '', how: '' }; });

const GROUPS = [
  { id: 'petto', name: 'Petto' },
  { id: 'schiena', name: 'Schiena' },
  { id: 'gambe', name: 'Gambe' },
  { id: 'spalle', name: 'Spalle' },
  { id: 'braccia', name: 'Braccia' },
];
const KIND = {
  main: { name: 'Principale', rest: 150, work: 50, step: 2.5 },
  acc: { name: 'Secondario', rest: 120, work: 45, step: 2 },
  iso: { name: 'Isolamento', rest: 90, work: 40, step: 1 },
};
const REST_MIN = 90, REST_MAX = 150;   // Luca: rest between sets from 1:30 to 2:30
const SWITCH_SEC = 15;                 // moving from one exercise to the next in a superset
const BLOCK_GAP = 60;                  // setting up the next block

const exInfo = (name) => EXLIB[name] || { name, group: 'altro', kind: 'acc', muscles: '', how: '' };
const E = (name, sets, reps) => ({ name, sets, reps });
// blocks: one exercise, or a superset (exercises done one after the other, rest after the round)
function gymTemplatesDefault() {
  return {
    petto: [
      { ex: [E('Panca inclinata bilanciere', 4, '8-12'), E('Croci su panca inclinata', 3, '10')], rest: 150 },
      { ex: [E('Chest press', 4, '8-12'), E('Croci su panca piana', 3, '10')], rest: 150 },
      { ex: [E('Croci ai cavi', 3, '12-15')], rest: 90 },
    ],
    spalle: [
      { ex: [E('Shoulder press', 4, '8-12')], rest: 150 },
      { ex: [E('Alzate laterali stripping', 3, '10')], rest: 90 },
      { ex: [E('Alzate laterali ai cavi', 3, '12-15')], rest: 90 },
      { ex: [E('Reverse pec deck', 3, '12-15'), E('Croci inverse ai cavi alti', 3, '12-15')], rest: 90 },
    ],
    braccia: [
      { ex: [E('Curl bilanciere EZ', 4, '8-12'), E('Dip tricipiti', 4, '8-12')], rest: 120 },
      { ex: [E('Curl su panca inclinata', 3, '10'), E('Estensioni sopra la testa al cavo', 3, '10-12')], rest: 90 },
      { ex: [E('Curl concentrato', 3, '10-12'), E('Pushdown ai cavi', 3, '10-12')], rest: 90 },
      { ex: [E('Curl polsi', 3, '15'), E('Curl inverso', 3, '12-15')], rest: 90 },
    ],
    schiena: [
      { ex: [E('Lat machine', 4, '8-12')], rest: 150 },
      { ex: [E('Pulley basso', 4, '8-12')], rest: 150 },
      { ex: [E('Rematore manubrio', 3, '10')], rest: 120 },
      { ex: [E('Pulldown braccia tese', 3, '12'), E('Hyperextension', 3, '12')], rest: 90 },
    ],
    gambe: [
      { ex: [E('Squat', 4, '6-10')], rest: 150 },
      { ex: [E('Stacco rumeno', 3, '8-10')], rest: 150 },
      { ex: [E('Affondi bulgari', 3, '10')], rest: 120 },
      { ex: [E('Leg extension', 3, '12'), E('Leg curl', 3, '12')], rest: 90 },
      { ex: [E('Calf raise', 3, '12-15')], rest: 90 },
    ],
  };
}
function gymDefaults() {
  return {
    templates: gymTemplatesDefault(),
    order: GROUPS.map((g) => g.id),
    recovery: { petto: 3, schiena: 3, gambe: 3, spalle: 2, braccia: 2 }, // days before training the same group again
    end: '05:45',      // must be done by this time (when the session starts within 2 hours of it)
    budget: 55,        // otherwise: minutes available
    warmup: 4,         // minutes of warm-up sets before the first exercise
  };
}
function mergeGym(raw) {
  const d = gymDefaults();
  const out = Object.assign({}, d, raw || {});
  out.templates = Object.assign({}, d.templates, (raw && raw.templates) || {});
  out.recovery = Object.assign({}, d.recovery, (raw && raw.recovery) || {});
  if (!Array.isArray(out.order)) out.order = d.order;
  return out;
}

// ---------- small helpers ----------
function activeWorkout() { return state.gym.workouts.find((w) => w.id === state.gym.active) || null; }
function lastSets(name, exceptId) {
  for (let i = state.gym.workouts.length - 1; i >= 0; i--) {
    const w = state.gym.workouts[i];
    if (w.id === exceptId) continue;
    const ex = w.ex.find((e) => e.name === name);
    if (ex) { const sets = ex.sets.filter((s) => s.done); if (sets.length) return { sets, date: w.date }; }
  }
  return null;
}
function setsText(sets) { return sets.map((s) => `${s.kg !== '' && s.kg != null ? fmt1(num(s.kg)) : '–'}×${s.reps || '–'}`).join(', '); }
function volume(w) { return w.ex.reduce((a, e) => a + e.sets.reduce((b, s) => b + (s.done ? (num(s.kg) || 0) * (num(s.reps) || 0) : 0), 0), 0); }
function dur(ms) { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${pad(m % 60)}`; }
function clock(sec) { sec = Math.max(0, Math.round(sec)); return `${Math.floor(sec / 60)}:${pad(sec % 60)}`; }
const hhmm = (t) => { const d = new Date(t); return `${d.getHours()}:${pad(d.getMinutes())}`; };
function repRange(r) {
  const m = String(r || '').match(/(\d+)\s*(?:-|–|a)\s*(\d+)/);
  if (m) return [+m[1], +m[2]];
  const n = parseInt(r, 10);
  return Number.isFinite(n) ? [n, n] : [8, 12];
}
const clampRest = (s) => clamp(Math.round(s / 15) * 15, REST_MIN, REST_MAX);

// ---------- split: which group is next ----------
function lastTrained(group) {
  for (let i = state.gym.workouts.length - 1; i >= 0; i--) {
    const w = state.gym.workouts[i];
    if (w.end && w.group === group) return w.date;
  }
  return null;
}
function groupStatus(group, k = dkey()) {
  const last = lastTrained(group);
  const rec = state.gym.cfg.recovery[group] || 2;
  if (!last) return { last, days: null, ready: true, left: 0 };
  const days = daysBetween(last, k);
  return { last, days, ready: days >= rec, left: Math.max(0, rec - days) };
}
function nextGroup() {
  const order = state.gym.cfg.order.filter((g) => GROUPS.some((x) => x.id === g));
  const done = state.gym.workouts.filter((w) => w.end && w.group);
  const lastG = done.length ? done[done.length - 1].group : null;
  const start = lastG ? (order.indexOf(lastG) + 1) % order.length : 0;
  for (let i = 0; i < order.length; i++) {
    const g = order[(start + i) % order.length];
    if (groupStatus(g).ready) return g;
  }
  // nothing fully recovered: the one rested the longest
  return order.slice().sort((a, b) => (groupStatus(b).days || 99) - (groupStatus(a).days || 99))[0];
}

// ---------- time ----------
function workSec(name) { return KIND[exInfo(name).kind].work; }
// seconds for a block, from round `from` on; done(ei, si) tells which sets are already done
function blockSec(block, done) {
  const rounds = Math.max(...block.ex.map((e) => e.sets));
  let t = 0;
  for (let r = 0; r < rounds; r++) {
    const todo = block.ex.filter((e, i) => r < e.sets && !(done && done(i, r)));
    if (!todo.length) continue;
    t += todo.reduce((a, e) => a + workSec(e.name), 0) + SWITCH_SEC * (todo.length - 1);
    if (r < rounds - 1) t += block.rest;
  }
  return t;
}
function templateSec(blocks) {
  return state.gym.cfg.warmup * 60 + blocks.reduce((a, b) => a + blockSec(b), 0) + BLOCK_GAP * Math.max(0, blocks.length - 1);
}
// the time by which the session must end
function deadlineFor(start) {
  const cfg = state.gym.cfg;
  const [h, m] = String(cfg.end || '').split(':').map(Number);
  if (Number.isFinite(h) && Number.isFinite(m)) {
    const d = new Date(start); d.setHours(h, m, 0, 0);
    const diff = d.getTime() - start;
    if (diff > 10 * 60000 && diff <= 120 * 60000) return d.getTime();
  }
  return start + cfg.budget * 60000;
}
// remaining seconds of the active workout
function remainingSec(w) {
  let t = 0, blocksLeft = 0;
  (w.blocks || []).forEach((b) => {
    const ex = b.ex.map((i) => w.ex[i]);
    const tpl = { rest: b.rest, ex: ex.map((e) => ({ name: e.name, sets: e.sets.length })) };
    const sec = blockSec(tpl, (i, r) => ex[i].sets[r] && ex[i].sets[r].done);
    if (sec > 0) { t += sec; blocksLeft++; }
  });
  return t + BLOCK_GAP * Math.max(0, blocksLeft - 1);
}

// ---------- progression ----------
// double progression: when every set reaches the top of the range, add weight
function progression(name, target, exceptId) {
  const last = lastSets(name, exceptId);
  if (!last) return null;
  const [lo, hi] = repRange(target.reps);
  const kgs = last.sets.map((s) => num(s.kg)).filter((x) => x > 0);
  const kg = kgs.length ? Math.max(...kgs) : NaN;
  const reps = last.sets.map((s) => num(s.reps) || 0);
  const step = KIND[exInfo(name).kind].step;
  if (!Number.isFinite(kg)) return { kg: NaN, up: false, text: 'Ultima volta: ' + setsText(last.sets) };
  if (last.sets.length >= target.sets && reps.every((r) => r >= hi)) return { kg: kg + step, up: true, text: `Hai chiuso ${hi} rip. in tutte le serie: sali a ${fmt1(kg + step)} kg` };
  if (reps.some((r) => r < lo)) return { kg, up: false, text: `Resta a ${fmt1(kg)} kg e punta a ${lo}+ rip.` };
  return { kg, up: false, text: `Stesso peso, ${fmt1(kg)} kg: aggiungi una ripetizione dove puoi` };
}

// ---------- starting a workout ----------
function newExercise(name, w, target) {
  const last = lastSets(name, w && w.id);
  const n = target ? target.sets : last ? last.sets.length : 3;
  return { name, target: target || null, sets: Array.from({ length: n }, () => ({ kg: '', reps: '', done: false })) };
}
function startWorkout(names, group) {
  const start = Date.now();
  const w = { id: uid(), date: dkey(), start, end: null, ex: [], blocks: [], group: group || null, deadline: group ? deadlineFor(start) : null };
  state.gym.workouts.push(w);
  state.gym.active = w.id;
  if (group) {
    (state.gym.cfg.templates[group] || []).forEach((b) => {
      const idx = [];
      b.ex.forEach((e) => { idx.push(w.ex.length); w.ex.push(newExercise(e.name, w, { sets: e.sets, reps: e.reps })); });
      w.blocks.push({ ex: idx, rest: clampRest(b.rest) });
    });
  } else names.forEach((n) => addExerciseTo(w, n));
  save();
  if (tab !== 'palestra') showTab('palestra'); else renderPalestra();
  return w;
}
function addExerciseTo(w, name) {
  const ex = newExercise(name, w);
  w.ex.push(ex);
  if (!w.blocks) w.blocks = [];
  w.blocks.push({ ex: [w.ex.length - 1], rest: clampRest(KIND[exInfo(name).kind].rest) });
}
// blocks for workouts of the first version (no blocks saved)
function workoutBlocks(w) {
  if (w.blocks && w.blocks.length) return w.blocks;
  w.blocks = w.ex.map((e, i) => ({ ex: [i], rest: clampRest(state.gym.rest || KIND[exInfo(e.name).kind].rest) }));
  return w.blocks;
}
function finishWorkout() {
  const w = activeWorkout(); if (!w) return;
  const done = w.ex.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
  if (!done) {
    if (!confirm('Nessuna serie segnata come fatta. Annullare questo allenamento?')) return;
    state.gym.workouts = state.gym.workouts.filter((x) => x !== w);
  } else {
    if (!confirm('Terminare l\'allenamento?')) return;
    // keep only exercises with done sets, and fix block indexes
    const map = {};
    const kept = [];
    w.ex.forEach((e, i) => { const sets = e.sets.filter((s) => s.done); if (sets.length) { map[i] = kept.length; kept.push(Object.assign({}, e, { sets })); } });
    w.blocks = workoutBlocks(w).map((b) => Object.assign({}, b, { ex: b.ex.filter((i) => map[i] != null).map((i) => map[i]) })).filter((b) => b.ex.length);
    w.ex = kept;
    w.end = Date.now();
    const late = w.deadline && w.end > w.deadline ? ` · ${Math.round((w.end - w.deadline) / 60000)} min oltre` : '';
    toast(`Allenamento salvato: ${dur(w.end - w.start)}, ${fmt(volume(w))} kg${late}`);
  }
  state.gym.active = null;
  stopTimer();
  save(); renderPalestra();
}

// the next set to do: {bi, ei, si} following blocks and superset rounds
function nextSet(w) {
  const blocks = workoutBlocks(w);
  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi];
    const rounds = Math.max(...b.ex.map((i) => w.ex[i].sets.length));
    for (let r = 0; r < rounds; r++) {
      for (const ei of b.ex) { const s = w.ex[ei].sets[r]; if (s && !s.done) return { bi, ei, si: r }; }
    }
  }
  return null;
}

// ================= render =================
function renderPalestra() {
  const w = activeWorkout();
  if (w) { renderSession(w); return; }
  const cfg = state.gym.cfg;
  const sel = gymSel || nextGroup();
  const tpl = cfg.templates[sel] || [];
  const sec = templateSec(tpl);
  const st = groupStatus(sel);
  const endAt = deadlineFor(Date.now());
  const fits = Date.now() + sec * 1000 <= endAt;
  let html = `<header class="top"><h1>Palestra</h1><button type="button" class="pill-btn" data-g="timer">${I.timer}<span>Timer</span></button></header>`;
  html += `<section class="card split-card"><p class="list-label first">${sel === nextGroup() ? 'Prossimo allenamento' : 'Allenamento scelto'}</p>
    <div class="group-chips">${GROUPS.map((g) => { const s = groupStatus(g.id); return `<button type="button" data-group="${g.id}" class="${g.id === sel ? 'on' : ''} ${s.ready ? '' : 'resting'}"><b>${g.name}</b><small>${s.days == null ? 'mai fatto' : s.days === 0 ? 'oggi' : s.days === 1 ? 'ieri' : s.days + ' giorni fa'}</small></button>`; }).join('')}</div>
    ${st.ready ? '' : `<p class="hint warn-txt">${esc(GROUPS.find((g) => g.id === sel).name)} è ancora in recupero: ${st.left === 1 ? 'manca 1 giorno' : `mancano ${st.left} giorni`}.</p>`}
    <div class="tpl-list">${tpl.map((b, bi) => `<div class="tpl-block ${b.ex.length > 1 ? 'super' : ''}">${b.ex.length > 1 ? '<span class="tag">Superserie</span>' : ''}
      ${b.ex.map((e) => `<button type="button" class="tpl-ex" data-info="${esc(e.name)}"><span>${esc(e.name)}</span><small>${e.sets}×${esc(e.reps)}</small></button>`).join('')}
      <small class="muted tpl-rest">recupero ${clock(b.rest)}</small></div>`).join('') || '<p class="empty">Scheda vuota: aggiungi esercizi.</p>'}</div>
    <div class="tpl-time ${fits ? '' : 'over'}"><span>≈ ${Math.round(sec / 60)} min</span><span>${fits ? `finisci verso le ${hhmm(Date.now() + sec * 1000)}` : `sfori di ${Math.ceil((Date.now() + sec * 1000 - endAt) / 60000)} min rispetto alle ${hhmm(endAt)}`}</span></div>
    <div class="sheet-actions"><button type="button" class="btn" data-g="tpl-edit">Modifica scheda</button><button type="button" class="btn primary" data-g="start-group" ${tpl.length ? '' : 'disabled'}>Inizia ${esc(GROUPS.find((g) => g.id === sel).name.toLowerCase())}</button></div>
  </section>`;
  html += `<button type="button" class="card start-card free" data-g="start"><b>Allenamento libero</b><span>Senza scheda: aggiungi gli esercizi mentre ti alleni.</span>${I.chev}</button>`;
  const hist = state.gym.workouts.filter((x) => x.end).slice().reverse();
  if (hist.length) {
    const weekAgo = Date.now() - 7 * 864e5;
    const wk = hist.filter((x) => x.start >= weekAgo).length;
    html += `<section class="card list-card"><h3>Storico <small class="muted">· ${wk} questa settimana</small></h3><ul class="wo-list">` + hist.slice(0, 40).map((x) => `<li><button type="button" data-g="wo-open" data-id="${x.id}">
      <span><b>${esc(dayLabel(x.date))}${x.group ? ' · ' + esc((GROUPS.find((g) => g.id === x.group) || {}).name || '') : ''}</b><small>${esc(x.ex.map((e) => e.name).join(', '))}</small></span>
      <span class="wo-meta">${dur(x.end - x.start)}<small>${fmt(volume(x))} kg</small></span></button></li>`).join('') + '</ul></section>';
  }
  html += `<section class="card rows"><button type="button" class="row" data-g="gym-cfg"><span>Orari e recuperi<small>Fine entro le ${esc(state.gym.cfg.end)} · riscaldamento ${state.gym.cfg.warmup} min · giorni di riposo per gruppo</small></span>${I.chev}</button></section>`;
  $('v-palestra').innerHTML = html;
}
let gymSel = null;

function renderSession(w) {
  const blocks = workoutBlocks(w);
  const nx = nextSet(w);
  const doneSets = w.ex.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
  let html = `<header class="top"><h1>${w.group ? esc(GROUPS.find((g) => g.id === w.group).name) : 'Allenamento'}</h1><button type="button" class="btn primary sm" data-g="finish">Termina</button></header>`;
  html += `<section class="card wo-head time-card" id="time-card">${timeCardInner(w)}</section>`;
  blocks.forEach((b, bi) => {
    const sup = b.ex.length > 1;
    const bDone = b.ex.every((i) => w.ex[i].sets.every((s) => s.done));
    html += `<section class="card block ${sup ? 'super' : ''} ${bDone ? 'bdone' : ''} ${nx && nx.bi === bi ? 'current' : ''}" data-bi="${bi}">
      <div class="block-head"><span class="tag">${sup ? 'Superserie' : 'Esercizio'} ${bi + 1}</span>
        <button type="button" class="rest-chip" data-g="rest" data-bi="${bi}">${I.timer}<span>${clock(b.rest)}</span></button>
        <button type="button" class="icon-btn sm" data-g="block-menu" data-bi="${bi}" aria-label="Altre azioni">${I.more}</button></div>`;
    b.ex.forEach((ei, k) => {
      const e = w.ex[ei];
      const info = exInfo(e.name);
      const tg = e.target;
      const pr = progression(e.name, tg || { sets: e.sets.length, reps: '8-12' }, w.id);
      const last = lastSets(e.name, w.id);
      html += `<div class="ex" data-ei="${ei}"><div class="ex-head"><div><h3>${sup ? `<span class="ss-n">${String.fromCharCode(65 + bi)}${k + 1}</span> ` : ''}${esc(e.name)}</h3>
          <small class="muted">${tg ? `${tg.sets}×${esc(tg.reps)} · ` : ''}${last ? 'ultima: ' + esc(setsText(last.sets)) : 'prima volta'}</small>
          ${pr && pr.up ? `<small class="prog up">▲ ${esc(pr.text)}</small>` : pr && Number.isFinite(pr.kg) ? `<small class="prog">${esc(pr.text)}</small>` : ''}</div>
        <button type="button" class="icon-btn sm info-btn" data-info="${esc(e.name)}" aria-label="Come si fa ${esc(e.name)}">i</button></div>
        <div class="sets"><div class="set-row head"><span>Serie</span><span>kg</span><span>Rip.</span><span></span></div>
        ${e.sets.map((s, si) => {
          const prevHere = si ? e.sets[si - 1] : null;
          const lastS = last && last.sets[Math.min(si, last.sets.length - 1)];
          const phKg = pr && pr.up ? fmt1(pr.kg) : lastS && lastS.kg !== '' ? fmt1(num(lastS.kg)) : prevHere && prevHere.kg !== '' ? fmt1(num(prevHere.kg)) : '';
          const phReps = lastS ? lastS.reps : prevHere && prevHere.reps ? prevHere.reps : tg ? String(repRange(tg.reps)[1]) : '';
          const cur = nx && nx.ei === ei && nx.si === si;
          return `<div class="set-row ${s.done ? 'done' : ''} ${cur ? 'cur' : ''}" data-si="${si}"><button type="button" class="set-n" data-g="set-rm" data-ei="${ei}" data-si="${si}" aria-label="Togli serie ${si + 1}">${si + 1}</button>
            <input inputmode="decimal" data-f="kg" data-ei="${ei}" data-si="${si}" value="${esc(s.kg)}" placeholder="${esc(phKg)}" aria-label="Kg serie ${si + 1}">
            <input inputmode="numeric" data-f="reps" data-ei="${ei}" data-si="${si}" value="${esc(s.reps)}" placeholder="${esc(phReps)}" aria-label="Ripetizioni serie ${si + 1}">
            <button type="button" class="set-ok" data-g="set-ok" data-ei="${ei}" data-si="${si}" aria-label="Serie ${si + 1} fatta" aria-pressed="${s.done}">${I.check}</button></div>`;
        }).join('')}</div>
        <button type="button" class="ghost-btn" data-g="set-add" data-ei="${ei}">${I.plus}<span>Serie</span></button></div>`;
      if (!info.how) html += '';
    });
    html += '</section>';
  });
  html += `<button type="button" class="add-btn big-add" data-g="ex-add">${I.plus}<span>Aggiungi esercizio</span></button>`;
  html += `<p class="foot">${doneSets} serie fatte · ${fmt(volume(w))} kg di volume</p>`;
  $('v-palestra').innerHTML = html;
}
function timeCardInner(w) {
  const now = Date.now();
  const el = (now - w.start) / 1000;
  const rem = remainingSec(w) + (state.timer ? Math.max(0, (state.timer.end - now) / 1000) : 0);
  if (!w.deadline) {
    return `<div><span class="muted">In corso</span><b class="big" id="wo-clock">${clock(el)}</b></div><div class="wo-stats"><span>restano ≈ <b>${Math.round(rem / 60)}</b> min</span></div>`;
  }
  const total = (w.deadline - w.start) / 1000;
  const left = (w.deadline - now) / 1000;
  const finish = now + rem * 1000;
  const over = Math.ceil((finish - w.deadline) / 60000);
  const frac = clamp(el / total, 0, 1);
  return `<div class="tc-top"><div><span class="muted">Tempo rimasto</span><b class="big" id="wo-clock">${left >= 0 ? clock(left) : '−' + clock(-left)}</b></div>
      <div class="tc-side"><span>fine entro le <b>${hhmm(w.deadline)}</b></span><span>${rem > 0 ? `chiudi ≈ <b>${hhmm(finish)}</b>` : 'scheda finita'}</span></div></div>
    <div class="tbar ${over > 0 ? 'over' : ''}"><i style="transform:scaleX(${frac})"></i><em style="left:${clamp(((finish - w.start) / 1000) / total, 0, 1) * 100}%"></em></div>
    ${over > 0 ? `<p class="tc-warn">Sfori di ${over} min: ${over > 4 ? 'salta l\'ultimo blocco o togli una serie agli isolamenti' : 'accorcia di poco i recuperi'}.</p>` : `<p class="tc-ok">In tempo${rem > 0 ? `, ${Math.max(0, Math.floor((w.deadline - finish) / 60000))} min di margine` : ''}.</p>`}`;
}
// refresh only the time card every second
function gymTick() {
  if (tab !== 'palestra') return;
  const w = activeWorkout(); if (!w) return;
  const c = $('time-card'); if (c) c.innerHTML = timeCardInner(w);
}

// ---------- exercise info (how to, muscles; animation comes from anim.js when present) ----------
function openExerciseInfo(name) {
  const info = exInfo(name);
  const last = lastSets(name);
  openSheet({
    title: name,
    body: `${typeof exerciseAnim === 'function' ? exerciseAnim(name) : ''}
      ${info.muscles ? `<p class="list-label first">Muscoli</p><p class="ex-muscles">${esc(info.muscles)}</p>` : ''}
      ${info.how ? `<p class="list-label">Come si fa</p><p class="ex-how">${esc(info.how)}</p>` : '<p class="hint">Nessuna descrizione per questo esercizio.</p>'}
      ${last ? `<p class="hint">Ultima volta (${esc(dayLabel(last.date))}): ${esc(setsText(last.sets))}</p>` : ''}`,
    onMount(el) { if (typeof startAnims === 'function') startAnims(el); },
  });
}

// ---------- template editor ----------
function openTemplateEditor(group) {
  const gname = GROUPS.find((g) => g.id === group).name;
  const tpl = JSON.parse(JSON.stringify(state.gym.cfg.templates[group] || []));
  const sh = openSheet({
    title: 'Scheda ' + gname.toLowerCase(), cls: 'tall',
    body: '<div id="te-body"></div>',
    onMount(el) {
      const box = el.querySelector('#te-body');
      const draw = () => {
        const sec = templateSec(tpl);
        box.innerHTML = `<p class="hint">Durata stimata ≈ ${Math.round(sec / 60)} min con ${state.gym.cfg.warmup} min di riscaldamento. Collega due esercizi per farli in superserie: recuperi una volta sola per giro.</p>
          ${tpl.map((b, bi) => `<div class="te-block ${b.ex.length > 1 ? 'super' : ''}">
            <div class="te-head"><span class="tag">${b.ex.length > 1 ? 'Superserie' : 'Blocco'} ${bi + 1}</span>
              <div class="seg sm te-rest">${[90, 120, 150].map((r) => `<button type="button" data-rest="${r}" data-bi="${bi}" class="${b.rest === r ? 'on' : ''}">${clock(r)}</button>`).join('')}</div></div>
            ${b.ex.map((e, ei) => `<div class="te-ex"><button type="button" class="te-name" data-info="${esc(e.name)}">${esc(e.name)}</button>
              <label class="mini-in"><input inputmode="numeric" data-sets data-bi="${bi}" data-ei="${ei}" value="${e.sets}" aria-label="Serie"><small>serie</small></label>
              <label class="mini-in wide"><input data-reps data-bi="${bi}" data-ei="${ei}" value="${esc(e.reps)}" aria-label="Ripetizioni"><small>rip.</small></label>
              <button type="button" class="icon-btn sm" data-rm data-bi="${bi}" data-ei="${ei}" aria-label="Togli ${esc(e.name)}">✕</button></div>`).join('')}
            <div class="te-actions"><button type="button" class="link" data-up="${bi}" ${bi ? '' : 'disabled'}>Su</button><button type="button" class="link" data-down="${bi}" ${bi < tpl.length - 1 ? '' : 'disabled'}>Giù</button>
              ${bi < tpl.length - 1 ? `<button type="button" class="link" data-join="${bi}">Superserie con il prossimo</button>` : ''}${b.ex.length > 1 ? `<button type="button" class="link" data-split="${bi}">Separa</button>` : ''}</div>
          </div>`).join('')}
          <button type="button" class="ghost-btn wide" id="te-add">${I.plus}<span>Aggiungi esercizio</span></button>
          <div class="sheet-actions"><button type="button" class="btn danger-ghost" id="te-reset">Scheda iniziale</button><button type="button" class="btn primary" id="te-save">Salva</button></div>`;
      };
      box.addEventListener('change', (e) => {
        const t = e.target; const b = tpl[+t.dataset.bi]; if (!b) return;
        const ex = b.ex[+t.dataset.ei];
        if (t.hasAttribute('data-sets')) ex.sets = clamp(Math.round(num(t.value)) || 1, 1, 10);
        if (t.hasAttribute('data-reps')) ex.reps = t.value.trim() || ex.reps;
        draw();
      });
      box.addEventListener('click', (e) => {
        const g = (a) => e.target.closest(`[${a}]`);
        let b;
        if ((b = g('data-rest')) && b.dataset.bi != null) { tpl[+b.dataset.bi].rest = +b.dataset.rest; draw(); }
        else if ((b = g('data-rm'))) { const bl = tpl[+b.dataset.bi]; bl.ex.splice(+b.dataset.ei, 1); if (!bl.ex.length) tpl.splice(+b.dataset.bi, 1); draw(); }
        else if ((b = g('data-up'))) { const i = +b.dataset.up; tpl.splice(i - 1, 0, tpl.splice(i, 1)[0]); draw(); }
        else if ((b = g('data-down'))) { const i = +b.dataset.down; tpl.splice(i + 1, 0, tpl.splice(i, 1)[0]); draw(); }
        else if ((b = g('data-join'))) { const i = +b.dataset.join; tpl[i].ex.push(...tpl[i + 1].ex); tpl[i].rest = Math.max(tpl[i].rest, tpl[i + 1].rest); tpl.splice(i + 1, 1); draw(); }
        else if ((b = g('data-split'))) { const i = +b.dataset.split; const rest = tpl[i].ex.splice(1); tpl.splice(i + 1, 0, ...rest.map((x) => ({ ex: [x], rest: clampRest(KIND[exInfo(x.name).kind].rest) }))); draw(); }
        else if ((b = g('data-info'))) openExerciseInfo(b.dataset.info);
        else if (e.target.closest('#te-add')) openExercisePicker((name) => { const k = exInfo(name).kind; tpl.push({ ex: [E(name, k === 'main' ? 4 : 3, k === 'main' ? '8-12' : k === 'acc' ? '10' : '12-15')], rest: clampRest(KIND[k].rest) }); draw(); }, group);
        else if (e.target.closest('#te-reset')) { if (!confirm('Rimettere la scheda iniziale?')) return; tpl.splice(0, tpl.length, ...gymTemplatesDefault()[group]); draw(); }
        else if (e.target.closest('#te-save')) { state.gym.cfg.templates[group] = tpl; save(); sh.close(); renderPalestra(); toast('Scheda salvata'); }
      });
      draw();
    },
  });
}

// ---------- exercise picker ----------
// cb(name): pick for a template; without cb the exercise goes in the active workout
function openExercisePicker(cb, group) {
  const used = () => { const s = new Set(); state.gym.workouts.forEach((w) => w.ex.forEach((e) => s.add(e.name))); return s; };
  const sh = openSheet({
    title: 'Aggiungi esercizio', cls: 'tall',
    body: `<div class="search-row"><input type="search" id="ex-q" placeholder="Cerca o scrivi un esercizio nuovo" autocomplete="off" enterkeyhint="done"></div><div id="ex-list" class="pick-list"></div>`,
    onMount(el) {
      const inp = el.querySelector('#ex-q');
      const box = el.querySelector('#ex-list');
      const w0 = activeWorkout();
      const grp = group || (w0 && w0.group) || null;
      const draw = () => {
        const q = inp.value.trim();
        const u = used();
        const all = Array.from(new Set([...EXLIB_RAW.map((x) => x[0]), ...state.gym.custom, ...u]));
        const words = norm(q).split(/\s+/).filter(Boolean);
        const list = all.filter((n) => words.every((x) => norm(n + ' ' + exInfo(n).group).includes(x)));
        const exact = all.some((n) => norm(n) === norm(q));
        const row = (n) => { const l = lastSets(n); const inf = exInfo(n); return `<button type="button" class="pick" data-ex="${esc(n)}"><span class="pk-name">${esc(n)}<small>${esc(l ? `${dayLabel(l.date)}: ${setsText(l.sets)}` : inf.muscles || '')}</small></span></button>`; };
        let html = q && !exact ? `<button type="button" class="pick" data-ex="${esc(q)}" data-new="1"><span class="pk-name">Aggiungi “${esc(q)}”<small>nuovo esercizio</small></span>${I.plus}</button>` : '';
        if (!q && grp) {
          html += `<p class="list-label">${esc(GROUPS.find((g) => g.id === grp).name)}</p>` + list.filter((n) => exInfo(n).group === grp).map(row).join('');
          html += '<p class="list-label">Altri</p>' + list.filter((n) => exInfo(n).group !== grp).map(row).join('');
        } else html += list.map(row).join('');
        box.innerHTML = html;
      };
      inp.addEventListener('input', draw);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const f = box.querySelector('[data-ex]'); if (f) f.click(); } });
      box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-ex]'); if (!b) return;
        const name = b.dataset.ex;
        if (b.dataset.new && !state.gym.custom.includes(name)) state.gym.custom.push(name);
        haptic(1); sh.close();
        if (cb) { cb(name); return; }
        const w = activeWorkout() || startWorkout([]);
        addExerciseTo(w, name);
        save(); renderPalestra();
      });
      draw();
    },
  });
}
function openWorkoutDetail(id) {
  const w = state.gym.workouts.find((x) => x.id === id); if (!w) return;
  const sh = openSheet({
    title: `${dayLabel(w.date)} · ${dur(w.end - w.start)}`,
    body: `<div class="wo-detail">${w.ex.map((e) => `<div class="wd-ex"><b>${esc(e.name)}</b><span>${esc(setsText(e.sets))}</span></div>`).join('')}
      <p class="hint">Volume ${fmt(volume(w))} kg · ${w.ex.reduce((a, e) => a + e.sets.length, 0)} serie${w.deadline ? ` · ${w.end <= w.deadline ? 'finito in tempo' : `${Math.round((w.end - w.deadline) / 60000)} min oltre`}` : ''}</p></div>
      <div class="sheet-actions"><button type="button" class="btn danger-ghost" id="wd-del">Elimina</button><button type="button" class="btn primary" id="wd-again" ${state.gym.active ? 'disabled' : ''}>Rifai questo</button></div>`,
    onMount(el) {
      el.querySelector('#wd-again').addEventListener('click', () => { sh.close(); startWorkout(w.ex.map((e) => e.name)); });
      el.querySelector('#wd-del').addEventListener('click', () => {
        if (!confirm('Eliminare questo allenamento dallo storico?')) return;
        state.gym.workouts = state.gym.workouts.filter((x) => x !== w); save(); sh.close(); renderPalestra();
      });
    },
  });
}
function openGymSettings() {
  const cfg = state.gym.cfg;
  const sh = openSheet({
    title: 'Orari e recuperi',
    body: `<form class="form" id="gc-form">
      <div class="grid3"><label class="field"><span>Fine entro</span><input type="time" name="end" value="${esc(cfg.end)}"></label>
        <label class="field"><span>Altrimenti min</span><input name="budget" inputmode="numeric" value="${cfg.budget}"></label>
        <label class="field"><span>Riscaldamento</span><input name="warmup" inputmode="numeric" value="${cfg.warmup}"></label></div>
      <p class="hint">Se inizi entro 2 ore dall'orario di fine, la sessione deve chiudersi a quell'ora. Altrimenti hai i minuti indicati.</p>
      <p class="list-label">Giorni di riposo prima di rifare lo stesso gruppo</p>
      ${GROUPS.map((g) => `<div class="row static"><span>${g.name}</span><div class="seg sm">${[1, 2, 3, 4].map((d) => `<button type="button" data-rec="${g.id}" data-d="${d}" class="${cfg.recovery[g.id] === d ? 'on' : ''}">${d}</button>`).join('')}</div></div>`).join('')}
      <p class="list-label">Ordine della rotazione</p>
      <div id="gc-order">${cfg.order.map((g, i) => `<div class="row static"><span>${i + 1}. ${GROUPS.find((x) => x.id === g).name}</span><div><button type="button" class="link" data-oup="${i}" ${i ? '' : 'disabled'}>Su</button></div></div>`).join('')}</div>
      <div class="sheet-actions"><button type="submit" class="btn primary">Salva</button></div></form>`,
    onMount(el) {
      const form = el.querySelector('#gc-form');
      const rec = Object.assign({}, cfg.recovery);
      const order = cfg.order.slice();
      el.addEventListener('click', (e) => {
        const r = e.target.closest('[data-rec]');
        if (r) { rec[r.dataset.rec] = +r.dataset.d; r.parentNode.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === r)); return; }
        const o = e.target.closest('[data-oup]');
        if (o) {
          const i = +o.dataset.oup; order.splice(i - 1, 0, order.splice(i, 1)[0]);
          el.querySelector('#gc-order').innerHTML = order.map((g, k) => `<div class="row static"><span>${k + 1}. ${GROUPS.find((x) => x.id === g).name}</span><div><button type="button" class="link" data-oup="${k}" ${k ? '' : 'disabled'}>Su</button></div></div>`).join('');
        }
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (/^\d{1,2}:\d{2}$/.test(form.end.value)) cfg.end = form.end.value;
        const b = num(form.budget.value); if (b >= 15 && b <= 240) cfg.budget = Math.round(b);
        const wu = num(form.warmup.value); if (wu >= 0 && wu <= 30) cfg.warmup = Math.round(wu);
        cfg.recovery = rec; cfg.order = order;
        save(); sh.close(); renderPalestra();
      });
    },
  });
}

// ---------- events ----------
function gymInit() {
  const view = $('v-palestra');
  view.addEventListener('input', (ev) => {
    const t = ev.target; if (!t.dataset.f) return;
    const w = activeWorkout(); if (!w) return;
    const s = w.ex[+t.dataset.ei].sets[+t.dataset.si];
    s[t.dataset.f] = t.value.trim();
    saveSoon();
  });
  view.addEventListener('focusin', (ev) => { if (ev.target.dataset.f) ev.target.select(); });
  view.addEventListener('click', (ev) => {
    const gb = ev.target.closest('[data-group]');
    if (gb) { gymSel = gb.dataset.group; haptic(1); renderPalestra(); return; }
    const inf = ev.target.closest('[data-info]');
    if (inf) { openExerciseInfo(inf.dataset.info); return; }
    const b = ev.target.closest('[data-g]'); if (!b) return;
    const g = b.dataset.g;
    const w = activeWorkout();
    if (g === 'timer') startTimer(state.gym.rest || 90);
    else if (g === 'start') { startWorkout([]); openExercisePicker(); }
    else if (g === 'start-group') { const grp = gymSel || nextGroup(); gymSel = null; startWorkout([], grp); }
    else if (g === 'tpl-edit') openTemplateEditor(gymSel || nextGroup());
    else if (g === 'gym-cfg') openGymSettings();
    else if (g === 'ex-add') openExercisePicker();
    else if (g === 'finish') finishWorkout();
    else if (g === 'wo-open') openWorkoutDetail(b.dataset.id);
    else if (!w) return;
    else if (g === 'set-ok') onSetDone(w, +b.dataset.ei, +b.dataset.si, b);
    else if (g === 'set-add') {
      const sets = w.ex[+b.dataset.ei].sets;
      const prev = sets[sets.length - 1];
      sets.push({ kg: prev ? prev.kg : '', reps: prev ? prev.reps : '', done: false });
      save(); renderPalestra();
    } else if (g === 'set-rm') {
      const sets = w.ex[+b.dataset.ei].sets;
      if (sets.length <= 1) return;
      if (!confirm(`Togliere la serie ${+b.dataset.si + 1}?`)) return;
      sets.splice(+b.dataset.si, 1); save(); renderPalestra();
    } else if (g === 'rest') {
      const bl = workoutBlocks(w)[+b.dataset.bi];
      const opts = [90, 105, 120, 135, 150];
      bl.rest = opts[(opts.indexOf(bl.rest) + 1) % opts.length] || 90;
      haptic(1); save(); renderPalestra();
    } else if (g === 'block-menu') openBlockMenu(w, +b.dataset.bi);
  });
  setInterval(gymTick, 1000);
}
function onSetDone(w, ei, si, btn) {
  const s = w.ex[ei].sets[si];
  const row = btn.closest('.set-row');
  s.done = !s.done;
  if (s.done) {
    row.querySelectorAll('input').forEach((inp) => { if (!inp.value && inp.placeholder) { inp.value = inp.placeholder; s[inp.dataset.f] = inp.placeholder.replace(',', '.'); } });
    haptic(1);
    const blocks = workoutBlocks(w);
    const b = blocks.find((x) => x.ex.includes(ei));
    // superset: go straight to the next exercise of the round, rest only after the round
    const pos = b.ex.indexOf(ei);
    const nextInRound = b.ex.slice(pos + 1).find((j) => w.ex[j].sets[si] && !w.ex[j].sets[si].done);
    const roundLeft = b.ex.some((j) => w.ex[j].sets.some((x) => !x.done));
    if (nextInRound != null) { stopTimer(); toast(`Subito: ${w.ex[nextInRound].name}`); }
    else if (roundLeft) startTimer(b.rest);
    else { stopTimer(); const nx = nextSet(w); if (nx) toast(`Blocco finito. Prossimo: ${w.ex[nx.ei].name}`); else toast('Scheda finita: premi Termina'); }
  }
  save();
  renderPalestra();
  const cur = document.querySelector('.set-row.cur');
  if (s.done && cur) cur.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function openBlockMenu(w, bi) {
  const blocks = workoutBlocks(w);
  const sh = openSheet({
    title: 'Blocco ' + (bi + 1),
    body: `<div class="menu-list"><button type="button" data-m="up" ${bi ? '' : 'disabled'}>Sposta su</button><button type="button" data-m="down" ${bi < blocks.length - 1 ? '' : 'disabled'}>Sposta giù</button>
      <button type="button" data-m="cut">Togli l'ultima serie non fatta</button><button type="button" data-m="skip" class="danger">Salta questo blocco</button></div>`,
    onMount(el) {
      el.addEventListener('click', (x) => {
        const m = x.target.closest('[data-m]'); if (!m) return;
        const a = m.dataset.m;
        if (a === 'up') blocks.splice(bi - 1, 0, blocks.splice(bi, 1)[0]);
        else if (a === 'down') blocks.splice(bi + 1, 0, blocks.splice(bi, 1)[0]);
        else if (a === 'cut') blocks[bi].ex.forEach((i) => { const sets = w.ex[i].sets; const k = sets.map((s) => s.done).lastIndexOf(false); if (k >= 0 && sets.length > 1) sets.splice(k, 1); });
        else if (a === 'skip') blocks[bi].ex.forEach((i) => { w.ex[i].sets = w.ex[i].sets.filter((s) => s.done); if (!w.ex[i].sets.length) w.ex[i].sets = []; });
        save(); sh.close(); renderPalestra();
      });
    },
  });
}
