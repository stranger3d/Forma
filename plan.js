// Meal plan: training (ON) and rest (OFF) days, refeed days, food swaps with grams
// recalculated from the nutrition values, water, and advice from the weight trend.
// Loaded before app.js: only declarations here, nothing runs at load time.
// Not medical advice: a personal tool built on Luca's own plan.

const DAY_TYPES = {
  on: { name: 'Allenamento', short: 'ON' },
  off: { name: 'Riposo', short: 'OFF' },
  refeed: { name: 'Ricarica', short: 'Ricarica' },
};

// starting plan, from the PDF "Programma Alimentazione – Definizione"
// items: [food name in foods.js, grams]
const PLAN_START = {
  targets: {
    on: { kcal: 2420, p: 180, c: 255, f: 70 },
    off: { kcal: 2220, p: 180, c: 205, f: 70 },
  },
  // Luca almost never has breakfast: it is optional (not counted, not filled) and the
  // other meals carry more carbs and protein so the day still hits the targets.
  // ON ≈ 2.410 kcal · P 178 · C 268 · G 71 — OFF ≈ 2.200 kcal · P 184 · C 219 · G 69
  meals: {
    on: [
      ['Pranzo post-allenamento', 'pranzo', [['Riso jasmine (crudo)', 140], ['Petto di pollo', 230], ['Zucchine', 150], ['Olio extravergine', 15]]],
      ['Merenda', 'merenda', [['Pane integrale', 80], ['Uovo intero', 165], ['Mela', 180]]],
      ['Cena', 'cena', [['Patate dolci', 200], ['Merluzzo', 220], ['Verdure miste', 150], ['Olio extravergine', 15]]],
      ['Pre nanna', 'prenanna', [['Yogurt greco 0%', 300], ["Fiocchi d'avena", 40], ['Miele', 10], ['Mandorle', 30]]],
    ],
    off: [
      ['Pranzo', 'pranzo', [['Farro (crudo)', 110], ['Petto di pollo', 230], ['Verdure miste', 150], ['Olio extravergine', 15]]],
      ['Merenda', 'merenda', [['Pane integrale', 80], ['Uovo intero', 165], ['Mela', 180]]],
      ['Cena', 'cena', [['Patate dolci', 150], ['Merluzzo', 220], ['Verdure miste', 150], ['Olio extravergine', 15]]],
      ['Pre nanna', 'prenanna', [['Yogurt greco 0%', 300], ["Fiocchi d'avena", 35], ['Miele', 10], ['Mandorle', 25]]],
    ],
  },
};

// Swaps from the PDF. Each group lists foods that replace each other; an entry can be a
// combination (several foods together, kept in the same proportions).
// Grams are always recalculated from the nutrition values, so kcal and macros stay close.
const PLAN_EQUIV = [
  ['Riso jasmine (crudo)', 'Riso basmati (crudo)', 'Riso (crudo)', 'Cous cous (crudo)', 'Orzo perlato (crudo)', 'Farro (crudo)', 'Quinoa (cruda)', 'Pasta di semola (cruda)', 'Pasta integrale (cruda)', 'Pane integrale'],
  ['Patate dolci', 'Patate', 'Gnocchi di patate', 'Pane integrale', 'Piadina integrale', 'Riso basmati (crudo)'],
  ['Petto di pollo', 'Petto di tacchino', 'Manzo magro', 'Carne macinata di manzo 5%', [['Uovo intero', 110], ['Albume', 80]]],
  ['Merluzzo', 'Branzino', 'Orata', 'Tonno al naturale (sgocciolato)', 'Salmone affumicato', 'Gamberi'],
  ['Yogurt greco 0%', 'Skyr', 'Fiocchi di latte', [['Proteine whey', 30], ['Mela', 180]], [['Proteine whey', 30], ['Banana', 120]]],
  ['Gallette di segale', "Fiocchi d'avena", 'Pane integrale', 'Fette biscottate', 'Gallette di riso'],
  ['Mandorle', 'Noci', 'Burro di arachidi', 'Cioccolato fondente 70%'],
  ['Olio extravergine', 'Avocado', 'Burro'],
  ['Mela', 'Banana', 'Arancia', 'Kiwi', 'Fragole', 'Mirtilli'],
  ['Miele', 'Zucchero', 'Banana'],
];

const pfid = (name) => 'g:' + slug(name);

function planDefaults() {
  const meals = {};
  Object.entries(PLAN_START.meals).forEach(([type, list]) => {
    meals[type] = list.map(([name, slot, items, opt], i) => ({ id: type + i, name, slot, opt: !!opt, items: items.map(([f, g]) => ({ food: pfid(f), g })) }));
  });
  return {
    ver: 3,
    on: true,
    start: null,             // first day the plan was used, for the refeed count
    days: {},                // 'YYYY-MM-DD' -> 'on' | 'off' | 'refeed' (chosen by hand)
    targets: JSON.parse(JSON.stringify(PLAN_START.targets)),
    meals,
    refeed: { every: 14, extra: 400, fat: 55, balance: true },
    water: 2500,             // ml a day
  };
}
function mergePlan(raw) {
  const base = planDefaults();
  if (!raw || typeof raw !== 'object') return base;
  const out = Object.assign({}, base, raw);
  out.targets = { on: Object.assign({}, base.targets.on, (raw.targets || {}).on || {}), off: Object.assign({}, base.targets.off, (raw.targets || {}).off || {}) };
  out.meals = Object.assign({}, base.meals, raw.meals || {});
  // version 1 had breakfast every day: move to the no-breakfast plan
  // version 3: no breakfast, snacks renamed Merenda and Pre nanna (same foods)
  if (raw.ver !== 3) {
    if (raw.ver === 2) {
      ['on', 'off'].forEach((t) => {
        const list = (out.meals[t] || []).filter((m) => m.slot !== 'colazione');
        let n = 0;
        list.forEach((m) => { if (m.slot === 'spuntini') { m.slot = n ? 'prenanna' : 'merenda'; m.name = n ? 'Pre nanna' : 'Merenda'; n++; } delete m.opt; });
        out.meals[t] = list;
      });
    } else out.meals = base.meals;
    out.ver = 3;
  }
  ['on', 'off'].forEach((k) => { if (!Array.isArray(out.meals[k])) out.meals[k] = base.meals[k]; });
  out.refeed = Object.assign({}, base.refeed, raw.refeed || {});
  if (!out.days || typeof out.days !== 'object' || Array.isArray(out.days)) out.days = {};
  return out;
}

// ---------- day type and targets ----------
function trainedOn(k) { return state.gym.workouts.some((w) => w.date === k && (w.end || w.id === state.gym.active)); }
function dayType(k) { return state.plan.days[k] || (trainedOn(k) ? 'on' : 'off'); }
function setDayType(k, type) {
  if (!state.plan.start) state.plan.start = k;
  if (type) state.plan.days[k] = type; else delete state.plan.days[k];
  save();
}
// Monday of the week of k
function weekStart(k) { const d = parseKey(k); const dow = (d.getDay() + 6) % 7; return addDays(k, -dow); }
function refeedKcal() { return Math.max(0, Math.round(state.plan.refeed.extra)); }
// kcal taken from the other days of the week to pay for its refeed days
function refeedCut(k) {
  const P = state.plan;
  if (!P.refeed.balance || dayType(k) === 'refeed') return 0;
  const w0 = weekStart(k);
  let n = 0;
  for (let i = 0; i < 7; i++) if (P.days[addDays(w0, i)] === 'refeed') n++;
  if (!n) return 0;
  return Math.round((refeedKcal() * n) / (7 - n) / 5) * 5;
}
function targetsFor(k) {
  if (!state.plan.on) return Object.assign({ type: null, cut: 0 }, calc());
  const P = state.plan;
  const type = dayType(k);
  const base = P.targets[type === 'off' ? 'off' : 'on'];
  const t = { kcal: base.kcal, p: base.p, c: base.c, f: base.f, type, cut: 0, auto: !P.days[k] };
  if (type === 'refeed') {
    t.kcal += refeedKcal();
    const f = Math.min(base.f, P.refeed.fat);
    t.c = Math.round(base.c + (refeedKcal() + (base.f - f) * 9) / 4);
    t.f = f;
  } else {
    const cut = refeedCut(k);
    if (cut) { t.cut = cut; t.kcal -= cut; t.c = Math.max(0, Math.round(t.c - cut / 4)); }
  }
  return t;
}
function lastRefeed(before) {
  const ks = Object.keys(state.plan.days).filter((k) => state.plan.days[k] === 'refeed' && k <= before).sort();
  return ks.length ? ks[ks.length - 1] : null;
}
function daysBetween(a, b) { return Math.round((parseKey(b) - parseKey(a)) / 864e5); }
// {due, since, from}: days since the last refeed (or since the plan started)
function refeedStatus(k) {
  const last = lastRefeed(k);
  const from = last || state.plan.start;
  if (!from) return { due: false, since: 0, last };
  const since = daysBetween(from, k);
  // a deload week in the gym is the natural place for the refeed
  const deload = typeof weekInfo === 'function' && state.gym.cfg && state.gym.cfg.cycle.start && weekInfo(k).deload;
  const thisWeek = Object.keys(state.plan.days).some((d) => state.plan.days[d] === 'refeed' && weekStart(d) === weekStart(k));
  return { due: state.plan.days[k] !== 'refeed' && (since >= state.plan.refeed.every || (deload && since >= 10 && !thisWeek)), since, last, deload };
}

// ---------- plan meals ----------
function planFood(id) { return getFood(id); }
function itemFull(it) {
  const f = planFood(it.food);
  if (!f) return null;
  return { food: f.id, name: f.name, brand: f.brand || '', n: Object.assign({}, f.n), g: it.g };
}
const isCarbFood = (n) => n.kcal > 0 && (n.c * 4) / n.kcal > 0.5;
// meals for a day type (k = the day, or null for the plain template), with real foods; a refeed day is a training day with the
// carbohydrate foods scaled up to reach the refeed carbs
function planMeals(type, k) {
  const P = state.plan;
  const src = P.meals[type === 'off' ? 'off' : 'on'] || [];
  const all = src.map((m) => ({ id: m.id, name: m.name, slot: m.slot, opt: !!m.opt, items: m.items.map(itemFull).filter(Boolean) }));
  if (!k) return all; // the template as written, for the editor
  const meals = all.filter((m) => !m.opt);
  const t = targetsFor(k);
  if (type === 'refeed') {
    const all = meals.flatMap((m) => m.items);
    const have = sumVals(all).c;
    const carbItems = all.filter((it) => isCarbFood(it.n));
    const carbC = sumVals(carbItems).c;
    const want = t.c - have;
    if (carbC > 0 && want > 0) {
      const fct = (carbC + want) / carbC;
      carbItems.forEach((it) => { it.g = roundG(it.g * fct, it); });
    }
  } else if (t.cut) {
    // take the weekly refeed cut from the biggest carbohydrate item of the day
    const all = meals.flatMap((m) => m.items).filter((it) => isCarbFood(it.n));
    const big = all.sort((a, b) => entryVals(b).c - entryVals(a).c)[0];
    if (big) big.g = Math.max(0, roundG(big.g - (t.cut / big.n.kcal) * 100, big));
  }
  return meals;
}
function roundG(g, it) {
  const f = it && it.food ? planFood(it.food) : null;
  if (f && f.piece && f.piece >= 30) return Math.max(f.piece, Math.round(g / f.piece) * f.piece);
  return g >= 40 ? Math.round(g / 5) * 5 : Math.max(1, Math.round(g));
}
function pieceText(it) {
  const f = planFood(it.food);
  if (!f || !f.piece || f.piece < 30) return '';
  const n = it.g / f.piece;
  return Math.abs(n - Math.round(n)) < 0.05 ? ` (${fmt(Math.round(n))} ${Math.round(n) === 1 ? 'pezzo' : 'pezzi'})` : ` (≈ ${fmt1(n)} pezzi)`;
}

// ---------- swaps ----------
// vector in kcal: [kcal, protein kcal, carb kcal, fat kcal]
const vec = (n, g) => { const k = g / 100; return [n.kcal * k, n.p * 4 * k, n.c * 4 * k, n.f * 9 * k]; };
function swapWeights(v) {
  // the macro that gives most of the calories counts more
  const m = [v[1], v[2], v[3]];
  const top = m.indexOf(Math.max(...m));
  return [1, ...m.map((_, i) => (i === top ? 1.6 : 0.6))];
}
// best scale for a set of base items so that it matches the target vector
function fitCombo(base, target) {
  const w = swapWeights(target);
  const a = base.reduce((acc, it) => vec(it.n, it.g).map((x, i) => acc[i] + x), [0, 0, 0, 0]);
  let num_ = 0, den = 0;
  a.forEach((x, i) => { num_ += w[i] * x * target[i]; den += w[i] * x * x; });
  if (!(den > 0)) return null;
  const s = num_ / den;
  const items = base.map((it) => Object.assign({}, it, { g: roundG(it.g * s, it) }));
  const got = items.reduce((acc, it) => vec(it.n, it.g).map((x, i) => acc[i] + x), [0, 0, 0, 0]);
  let err = 0, ref = 0;
  got.forEach((x, i) => { err += w[i] * (x - target[i]) ** 2; ref += w[i] * target[i] ** 2; });
  const score = ref > 0 ? Math.max(0, 1 - Math.sqrt(err / ref)) : 0;
  return { items, score, got };
}
function foodCat(n) {
  if (!n || !(n.kcal > 0)) return 'x';
  if (n.kcal < 45 && n.p < 5) return 'veg';
  const m = [n.p * 4, n.c * 4, n.f * 9];
  return ['p', 'c', 'f'][m.indexOf(Math.max(...m))];
}
function asItem(f, g) { return { food: f.id, name: f.name, brand: f.brand || '', n: Object.assign({}, f.n), g }; }
// alternatives for one item {food, n, g}: plan swaps first, then similar foods
function swapOptions(item, q) {
  const target = vec(item.n, item.g);
  const out = [];
  const seen = new Set([item.food]);
  const push = (base, fromPlan) => {
    const r = fitCombo(base, target);
    if (!r || !r.items.every((x) => x.g > 0)) return;
    const key = r.items.map((x) => x.food).join('+');
    if (seen.has(key)) return;
    seen.add(key);
    out.push(Object.assign(r, { fromPlan }));
  };
  const words = q ? norm(q).split(/\s+/).filter(Boolean) : null;
  const matchQ = (f) => !words || words.every((w) => norm(f.name + ' ' + (f.brand || '')).includes(w));
  if (!words) {
    const mine = PLAN_EQUIV.filter((g) => g.some((e) => typeof e === 'string' && pfid(e) === item.food));
    mine.forEach((group) => group.forEach((e) => {
      if (typeof e === 'string') { const f = planFood(pfid(e)); if (f) push([asItem(f, 100)], true); }
      else {
        const base = e.map(([nm, g]) => { const f = planFood(pfid(nm)); return f ? asItem(f, g) : null; });
        if (base.every(Boolean)) push(base, true);
      }
    }));
  }
  const cat = foodCat(item.n);
  const pool = allFoods().filter((f) => !seen.has(f.id) && f.n && f.n.kcal > 0 && matchQ(f) && (words || foodCat(f.n) === cat));
  const rest = [];
  pool.forEach((f) => { const r = fitCombo([asItem(f, 100)], target); if (r && r.items[0].g > 0 && r.items[0].g < 2000) rest.push(Object.assign(r, { fromPlan: false })); });
  rest.sort((a, b) => b.score - a.score);
  const planned = out.sort((a, b) => b.score - a.score);
  return planned.concat(rest.filter((r) => words || r.score >= 0.6).slice(0, words ? 25 : 12));
}
function diffText(got, target) {
  const d = (i, l, k) => { const x = (got[i] - target[i]) / k; return Math.abs(x) < (i ? 1 : 5) ? '' : `${l} ${x > 0 ? '+' : '−'}${fmt(Math.abs(x))}`; };
  const parts = [d(0, 'kcal', 1), d(1, 'P', 4), d(2, 'C', 4), d(3, 'G', 9)].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'praticamente uguale';
}
// sheet: pick an alternative, then onPick(items) with full items {food,name,brand,n,g}
function openSwapSheet(item, onPick) {
  const target = vec(item.n, item.g);
  const sh = openSheet({
    title: 'Sostituisci ' + item.name.toLowerCase(),
    cls: 'tall',
    body: `<p class="hint">${fmt(item.g)} g · ${fmt(target[0])} kcal · P ${fmt(target[1] / 4)} · C ${fmt(target[2] / 4)} · G ${fmt(target[3] / 9)}. I grammi delle alternative sono ricalcolati per avere calorie e macro il più possibile uguali.</p>
      <div class="search-row"><input type="search" id="sw-q" placeholder="Cerca un altro alimento" autocomplete="off"></div>
      <div id="sw-list" class="pick-list"></div>`,
    onMount(el) {
      const inp = el.querySelector('#sw-q');
      let opts = [];
      const draw = () => {
        opts = swapOptions(item, inp.value.trim());
        let lastPlan = null;
        el.querySelector('#sw-list').innerHTML = opts.map((o, i) => {
          let lbl = '';
          if (o.fromPlan !== lastPlan && !inp.value.trim()) { lbl = `<p class="list-label">${o.fromPlan ? 'Dal tuo piano' : 'Simili per valori'}</p>`; lastPlan = o.fromPlan; }
          const name = o.items.map((x) => `${fmt(x.g)} g ${x.name.toLowerCase()}${pieceText(x)}`).join(' + ');
          return `${lbl}<button type="button" class="pick swap-pick" data-i="${i}"><span class="pk-name">${esc(name.charAt(0).toUpperCase() + name.slice(1))}<small>${esc(diffText(o.got, target))}</small></span>
            <span class="pk-meta">${fmt(o.got[0])} kcal<small class="match ${o.score >= 0.9 ? 'hi' : o.score >= 0.75 ? 'mid' : ''}">${fmt(o.score * 100)}% simile</small></span></button>`;
        }).join('') || '<p class="empty">Nessuna alternativa trovata. Prova a cercare per nome.</p>';
      };
      inp.addEventListener('input', draw);
      el.querySelector('#sw-list').addEventListener('click', (e) => {
        const b = e.target.closest('[data-i]'); if (!b) return;
        const o = opts[+b.dataset.i]; if (!o) return;
        haptic(1); sh.close(); onPick(o.items.map((x) => Object.assign({}, x)));
      });
      draw();
    },
  });
}

// ---------- water ----------
function waterOf(k) { return (state.water && state.water[k]) || 0; }
function addWater(k, ml) {
  if (!state.water) state.water = {};
  const v = Math.max(0, waterOf(k) + ml);
  if (v) state.water[k] = v; else delete state.water[k];
  save();
}

// ---------- weight trend and adherence ----------
function eatenAvg(days, until) {
  let tot = 0, n = 0, tgt = 0;
  for (let i = 1; i <= days; i++) {
    const k = addDays(until, -i);
    const list = state.diary[k];
    if (!list || !list.length) continue;
    tot += sumVals(list).kcal; tgt += targetsFor(k).kcal; n++;
  }
  return n ? { kcal: tot / n, target: tgt / n, n } : null;
}
// advice from the weight trend: {tone, text, delta}; delta = kcal to change on both day types
function planAdvice() {
  const W = state.weights;
  if (W.length < 4) return { tone: '', text: 'Pesati almeno 3-4 volte a settimana, al mattino: dopo 2 settimane ti dico se il piano va adattato.', delta: 0 };
  const span = daysBetween(W[0].d, W[W.length - 1].d);
  const tr = trend(W, 21);
  if (span < 12 || tr == null) return { tone: '', text: 'Servono almeno 2 settimane di pesate per giudicare il ritmo.', delta: 0 };
  const cur = currentWeight();
  const pct = (tr / cur) * 100;
  const goal = state.profile.goal;
  const ad = eatenAvg(7, dkey());
  const adh = ad && ad.n >= 4 ? ad.kcal - ad.target : 0;
  const rs = refeedStatus(dkey());
  if (goal === 'cut') {
    if (pct < -1) return { tone: 'warn', text: `Stai calando ${fmt1(Math.abs(tr))} kg a settimana, più dell'1% del peso: rischi di perdere forza. Aggiungi 100 kcal (carboidrati) al giorno.`, delta: 100 };
    if (tr > -0.2) {
      if (adh > 150) return { tone: 'warn', text: `Calo fermo, ma negli ultimi giorni hai mangiato in media ${fmt(adh)} kcal sopra il piano: prima prova a rientrare nei numeri.`, delta: 0 };
      if (rs.since >= 10 && !rs.last) return { tone: 'warn', text: 'Calo fermo da 2-3 settimane: fai prima una ricarica, poi se resta fermo togli 100 kcal.', delta: 0 };
      return { tone: 'warn', text: `Calo fermo (${signed(tr, 2)} kg a settimana nelle ultime 3). Togli 100 kcal al giorno dai carboidrati.`, delta: -100 };
    }
    return { tone: 'ok', text: `Ritmo buono: ${signed(tr, 2)} kg a settimana. Continua così.`, delta: 0 };
  }
  if (goal === 'bulk') {
    if (tr < 0.1) return { tone: 'warn', text: `Peso fermo (${signed(tr, 2)} kg a settimana): aggiungi 100-150 kcal.`, delta: 100 };
    if (pct > 0.5) return { tone: 'warn', text: `Stai salendo ${fmt1(tr)} kg a settimana: rallenta di 100 kcal per mettere meno grasso.`, delta: -100 };
    return { tone: 'ok', text: `Ritmo buono: ${signed(tr, 2)} kg a settimana.`, delta: 0 };
  }
  if (Math.abs(tr) > 0.25) return { tone: 'warn', text: `Il peso si muove (${signed(tr, 2)} kg a settimana): ${tr > 0 ? 'togli' : 'aggiungi'} 100 kcal.`, delta: tr > 0 ? -100 : 100 };
  return { tone: 'ok', text: 'Peso stabile: il piano è in pari.', delta: 0 };
}
function shiftPlanKcal(delta) {
  ['on', 'off'].forEach((k) => {
    const t = state.plan.targets[k];
    t.kcal = Math.max(1200, t.kcal + delta);
    t.c = Math.max(0, Math.round(t.c + delta / 4));
  });
  save();
}
function adviceCard(where) {
  if (!state.plan.on) return '';
  const a = planAdvice();
  const ad = eatenAvg(7, dkey());
  return `<section class="card advice ${a.tone}"><h3>Andamento e piano</h3><p>${esc(a.text)}</p>
    ${ad && ad.n >= 3 ? `<p class="hint">Ultimi ${ad.n} giorni segnati: media ${fmt(ad.kcal)} kcal su ${fmt(ad.target)} previste.</p>` : ''}
    ${a.delta ? `<button type="button" class="btn primary sm" data-advice="${a.delta}" data-where="${where}">${a.delta > 0 ? 'Aggiungi' : 'Togli'} ${fmt(Math.abs(a.delta))} kcal al piano</button>` : ''}</section>`;
}
function applyAdvice(delta) {
  shiftPlanKcal(delta);
  haptic(1);
  render();
  toast(`Piano aggiornato: ${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta))} kcal al giorno`, () => { shiftPlanKcal(-delta); render(); });
}

// ---------- plan in the diary ----------
function fillFromPlan(k, onlySlot) {
  const type = dayType(k);
  if (!state.plan.days[k]) setDayType(k, type);
  const have = new Set(dayEntries(k).map((e) => e.slot));
  const meals = planMeals(type, k).filter((m) => (onlySlot ? m.slot === onlySlot : !have.has(m.slot)));
  const items = [];
  meals.forEach((m) => m.items.forEach((it) => items.push(Object.assign({ slot: m.slot }, it))));
  if (!items.length) return [];
  const added = [];
  SLOTS.forEach((s) => { const its = items.filter((x) => x.slot === s.id); if (its.length) added.push(...addEntries(its, s.id, k)); });
  return added;
}
function planSlotKcal(k, slot) {
  return sumVals(planMeals(dayType(k), k).filter((m) => m.slot === slot).flatMap((m) => m.items)).kcal;
}
function planCard(k) {
  if (!state.plan.on) return '';
  const t = targetsFor(k);
  const type = t.type;
  const isToday = k === dkey();
  const rs = refeedStatus(k);
  const have = new Set(dayEntries(k).map((e) => e.slot));
  const missing = planMeals(type, k).filter((m) => !have.has(m.slot));
  const water = waterOf(k), wT = state.plan.water;
  let html = `<section class="card plan-card dt-${type}">
    <div class="seg day-seg" id="day-seg">${Object.entries(DAY_TYPES).map(([id, d]) => `<button type="button" data-daytype="${id}" class="dt-${id} ${type === id ? 'on' : ''}">${d.name}</button>`).join('')}</div>
    <p class="hint">${t.auto ? (type === 'on' ? 'Scelto in automatico: oggi hai un allenamento. ' : 'Scelto in automatico. Tocca per cambiare. ') : ''}${type === 'refeed' ? `Ricarica: +${fmt(refeedKcal())} kcal da carboidrati, grassi un po' più bassi.` : ''}${t.cut ? `Questa settimana c'è una ricarica: −${fmt(t.cut)} kcal oggi per tenere in pari la media.` : ''}</p>`;
  if (isToday && rs.due) html += `<button type="button" class="refeed-due" data-act="refeed-today"><b>Ricarica consigliata</b><span>${rs.deload ? 'Settimana di scarico in palestra: è il momento giusto. ' : ''}${rs.last ? `Sono passati ${rs.since} giorni dall'ultima.` : `Piano iniziato da ${rs.since} giorni.`} Tocca per fare oggi la ricarica.</span></button>`;
  html += `<div class="plan-actions">${missing.length ? `<button type="button" class="btn primary sm" data-act="plan-fill">Riempi dal piano · ${fmt(sumVals(missing.flatMap((m) => m.items)).kcal)} kcal</button>` : '<span class="muted small">Pasti del piano già nel diario</span>'}
      <button type="button" class="pill-btn" data-act="plan-open">Piano</button></div>
    <div class="water"><span>Acqua <b>${fmt1(water / 1000)}</b> / ${fmt1(wT / 1000)} L</span>
      <div class="wbar"><i style="width:${clamp(water / wT, 0, 1) * 100}%"><svg class="wave" viewBox="0 0 40 10" preserveAspectRatio="none" aria-hidden="true"><path d="M0 5 Q5 1 10 5 T20 5 T30 5 T40 5 V10 H0 Z"/></svg></i></div>
      <button type="button" class="icon-btn sm" data-act="water-" aria-label="Togli un bicchiere">−</button>
      <button type="button" class="icon-btn sm plus" data-act="water+" aria-label="Aggiungi un bicchiere">+</button></div>
  </section>`;
  return html;
}

// ---------- plan editor ----------
function openPlanSheet() {
  let type = dayType(day) === 'off' ? 'off' : 'on';
  const sh = openSheet({
    title: 'Piano alimentare', cls: 'tall',
    body: '<div id="plan-body"></div>',
    onMount(el) {
      const box = el.querySelector('#plan-body');
      const draw = () => {
        const P = state.plan;
        const t = P.targets[type];
        const meals = planMeals(type, null);
        const tot = sumVals(meals.filter((m) => !m.opt).flatMap((m) => m.items));
        const macroK = t.p * 4 + t.c * 4 + t.f * 9;
        box.innerHTML = `<label class="row static"><span>Usa il piano<small>Obiettivi diversi per giorni di allenamento e di riposo</small></span><input type="checkbox" class="switch" id="pl-on" ${P.on ? 'checked' : ''}></label>
          <div class="seg" id="pl-type"><button type="button" data-t="on" class="${type === 'on' ? 'on' : ''}">Allenamento</button><button type="button" data-t="off" class="${type === 'off' ? 'on' : ''}">Riposo</button></div>
          <p class="list-label">Obiettivi ${type === 'on' ? 'giorno di allenamento' : 'giorno di riposo'}</p>
          <div class="grid4">${[['kcal', 'kcal'], ['p', 'Proteine'], ['c', 'Carbo'], ['f', 'Grassi']].map(([k, l]) => `<label class="field"><span>${l}</span><input inputmode="numeric" data-tg="${k}" value="${t[k]}"></label>`).join('')}</div>
          <p class="hint">${Math.abs(macroK - t.kcal) > 60 ? `Dai macro risultano ${fmt(macroK)} kcal. ` : ''}Pasti del piano: ${fmt(tot.kcal)} kcal · P ${fmt(tot.p)} · C ${fmt(tot.c)} · G ${fmt(tot.f)}.</p>
          ${meals.map((m, mi) => `<div class="pl-meal"><div class="pl-head"><b>${esc(m.name)}</b><span class="muted">${fmt(sumVals(m.items).kcal)} kcal${m.opt ? ' · non conteggiata' : ''}</span></div>
            ${m.items.map((it, ii) => `<button type="button" class="pl-item" data-mi="${mi}" data-ii="${ii}"><span>${esc(it.name)}<small>${fmt(it.g)} g${esc(pieceText(it))}</small></span><span class="muted">${fmt(entryVals(it).kcal)} kcal</span><span class="swap-ic" aria-hidden="true">⇄</span></button>`).join('')}
            <button type="button" class="ghost-btn" data-addto="${mi}">${I.plus}<span>Alimento</span></button></div>`).join('')}
          <p class="list-label">Ricarica</p>
          <div class="row static"><span>Ogni</span><div class="seg sm" id="pl-every">${[14, 21, 28].map((d) => `<button type="button" data-every="${d}" class="${P.refeed.every === d ? 'on' : ''}">${d / 7} sett</button>`).join('')}</div></div>
          <div class="row static"><span>Calorie in più</span><div class="seg sm" id="pl-extra">${[300, 400, 500, 600].map((d) => `<button type="button" data-extra="${d}" class="${P.refeed.extra === d ? 'on' : ''}">+${d}</button>`).join('')}</div></div>
          <label class="row static"><span>Compensa nella settimana<small>Toglie le kcal della ricarica dagli altri giorni: la media resta quella del piano</small></span><input type="checkbox" class="switch" id="pl-bal" ${P.refeed.balance ? 'checked' : ''}></label>
          <div class="notes"><p><b>Acqua</b> almeno ${fmt1(P.water / 1000)} litri al giorno.</p><p><b>Niente colazione</b>: il primo pasto è il pranzo, per questo pranzo, merenda e pre nanna sono più carichi.</p><p><b>Carboidrati</b>: puoi spostarli tra i pasti se serve.</p><p><b>Sale</b>: tienilo sotto controllo se tendi a trattenere liquidi.</p><p class="muted">È il tuo piano personale, non un parere medico.</p></div>
          <div class="sheet-actions"><button type="button" class="btn danger-ghost" id="pl-reset">Ripristina piano iniziale</button></div>`;
      };
      const meal = (mi) => state.plan.meals[type][mi];
      box.addEventListener('change', (e) => {
        const tg = e.target.dataset.tg;
        if (tg) { const v = num(e.target.value); if (v > 0) { state.plan.targets[type][tg] = Math.round(v); save(); } draw(); return; }
        if (e.target.id === 'pl-on') { state.plan.on = e.target.checked; save(); render(); }
        if (e.target.id === 'pl-bal') { state.plan.refeed.balance = e.target.checked; save(); render(); }
      });
      box.addEventListener('click', (e) => {
        const tb = e.target.closest('[data-t]'); if (tb) { type = tb.dataset.t; draw(); return; }
        const ev = e.target.closest('[data-every]'); if (ev) { state.plan.refeed.every = +ev.dataset.every; save(); draw(); return; }
        const ex = e.target.closest('[data-extra]'); if (ex) { state.plan.refeed.extra = +ex.dataset.extra; save(); draw(); return; }
        const it = e.target.closest('.pl-item');
        if (it) { openPlanItemSheet(type, +it.dataset.mi, +it.dataset.ii, draw); return; }
        const add = e.target.closest('[data-addto]');
        if (add) { openFoodPicker((f) => { meal(+add.dataset.addto).items.push({ food: f.id, g: f.serving || f.piece || 100 }); if (f.source !== 'base' && !state.foods[f.id]) state.foods[f.id] = f; save(); draw(); }); return; }
        if (e.target.closest('#pl-reset')) {
          if (!confirm('Rimettere obiettivi e pasti del piano iniziale? I giorni scelti e il diario restano.')) return;
          const d = planDefaults(); state.plan.targets = d.targets; state.plan.meals = d.meals; state.plan.refeed = d.refeed; save(); draw(); toast('Piano iniziale ripristinato');
        }
      });
      draw();
    },
    onClose: () => render(),
  });
}
function openPlanItemSheet(type, mi, ii, done) {
  const raw = state.plan.meals[type][mi].items[ii];
  const it = itemFull(raw); if (!it) return;
  const sh = openSheet({
    title: it.name,
    body: `<label class="qty-input"><input type="text" inputmode="decimal" id="pi-g" value="${fmt1(raw.g)}" aria-label="Grammi"><span>g</span></label>
      <p class="hint" id="pi-tot"></p>
      <div class="sheet-actions"><button type="button" class="btn danger-ghost" id="pi-rm">Togli</button><button type="button" class="btn" id="pi-swap">Sostituisci</button><button type="button" class="btn primary" id="pi-ok">Salva</button></div>`,
    onMount(el) {
      const inp = el.querySelector('#pi-g');
      const upd = () => { const v = entryVals({ n: it.n, g: num(inp.value) || 0 }); el.querySelector('#pi-tot').textContent = `${fmt(v.kcal)} kcal · P ${fmt1(v.p)} · C ${fmt1(v.c)} · G ${fmt1(v.f)}`; };
      inp.addEventListener('input', upd); upd();
      el.querySelector('#pi-ok').addEventListener('click', () => { const g = num(inp.value); if (g > 0) { raw.g = Math.round(g); save(); } sh.close(); done(); });
      el.querySelector('#pi-rm').addEventListener('click', () => { state.plan.meals[type][mi].items.splice(ii, 1); save(); sh.close(); done(); });
      el.querySelector('#pi-swap').addEventListener('click', () => {
        sh.close();
        openSwapSheet(Object.assign({}, it, { g: num(inp.value) || raw.g }), (items) => {
          state.plan.meals[type][mi].items.splice(ii, 1, ...items.map((x) => ({ food: x.food, g: x.g })));
          save(); done(); toast('Piano aggiornato');
        });
      });
    },
  });
}
// simple picker over local foods (built-in and saved)
function openFoodPicker(cb) {
  const sh = openSheet({
    title: 'Scegli un alimento', cls: 'tall',
    body: '<div class="search-row"><input type="search" id="fp-q" placeholder="Cerca" autocomplete="off"></div><div id="fp-list" class="pick-list"></div>',
    onMount(el) {
      const inp = el.querySelector('#fp-q');
      const draw = () => {
        const words = norm(inp.value).split(/\s+/).filter(Boolean);
        const list = allFoods().filter((f) => words.every((w) => norm(f.name + ' ' + (f.brand || '')).includes(w))).sort((a, b) => a.name.localeCompare(b.name, 'it')).slice(0, 80);
        el.querySelector('#fp-list').innerHTML = list.map((f) => `<button type="button" class="pick" data-id="${esc(f.id)}"><span class="pk-name">${esc(f.name)}${f.brand ? `<small>${esc(f.brand)}</small>` : ''}</span><span class="pk-meta">${fmt(f.n.kcal)} kcal<small>per 100 g</small></span></button>`).join('') || '<p class="empty">Nessun alimento.</p>';
      };
      inp.addEventListener('input', draw);
      el.querySelector('#fp-list').addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (!b) return; const f = getFood(b.dataset.id); if (f) { sh.close(); cb(f); } });
      draw();
    },
  });
}
