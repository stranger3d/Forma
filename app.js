'use strict';
// Forma: calories, meals, weight and gym. Everything stays on the phone (localStorage),
// works offline, and can be saved/restored as a JSON backup from Profilo.

// ---------- helpers ----------
const KEY = 'forma:v1';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = (n) => String(n).padStart(2, '0');
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dkey(d); };
const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
const fmt = (n, d = 0) => (Number.isFinite(n) ? n : 0).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmt2 = (n) => (Number.isFinite(n) ? n : 0).toLocaleString('it-IT', { maximumFractionDigits: 2 });
const fmt1 = (n) => (Number.isFinite(n) ? n : 0).toLocaleString('it-IT', { maximumFractionDigits: 1 });
const signed = (n, d = 1) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n), d);
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
const WDAYS = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const shortDate = (k) => { const d = parseKey(k); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const dayLabel = (k) => {
  const t = dkey();
  if (k === t) return 'Oggi';
  if (k === addDays(t, -1)) return 'Ieri';
  if (k === addDays(t, 1)) return 'Domani';
  const d = parseKey(k);
  return `${WDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

const SLOTS = [
  { id: 'pranzo', name: 'Pranzo' },
  { id: 'merenda', name: 'Merenda' },
  { id: 'cena', name: 'Cena' },
  { id: 'prenanna', name: 'Pre nanna' },
];
const GOALS = {
  cut: { name: 'Dimagrire', short: 'Dimagrimento' },
  keep: { name: 'Mantenere', short: 'Mantenimento' },
  bulk: { name: 'Massa', short: 'Massa' },
};
const ACTIVITY = [
  [1.2, 'Sedentario', 'Lavoro seduto, poco movimento'],
  [1.375, 'Leggero', '1–3 allenamenti a settimana'],
  [1.55, 'Moderato', '3–5 allenamenti a settimana'],
  [1.725, 'Intenso', '6–7 allenamenti a settimana'],
  [1.9, 'Molto intenso', 'Lavoro fisico e allenamenti ogni giorno'],
];

// built-in foods, keyed g:<slug>
const BUILTIN = {};
(window.FORMA_FOODS || []).forEach(([name, kcal, p, c, f, x]) => {
  const id = 'g:' + slug(name);
  BUILTIN[id] = { id, name, brand: '', n: { kcal, p, c, f }, serving: x.s || null, piece: x.pc || null, source: 'base' };
});

// ---------- state ----------
function defaults() {
  return {
    v: 1,
    profile: { sex: 'm', age: 30, height: 175, weight: 80, activity: 1.375, goal: 'cut', pace: 0.5, target: null, custom: { kcal: null, p: null, f: null }, done: false },
    foods: {},      // my foods and foods found online, by id (b:<barcode> or f:<id>); also edited built-ins
    recent: [],     // food ids, most recent first
    meals: [],      // saved meals {id, name, items:[{food, name, brand, n, g}]}
    diary: {},      // 'YYYY-MM-DD' -> [{id, slot, food, name, brand, n, g}]
    weights: [],    // [{d, kg}] sorted by date
    gym: { workouts: [], active: null, rest: 90, custom: [], cfg: gymDefaults() }, // cfg: split, templates, times (gym.js)
    timer: null,    // {end, dur}
    plan: planDefaults(), // meal plan, see plan.js
    water: {},      // 'YYYY-MM-DD' -> ml
    settings: { theme: 'dark', online: true, haptics: true },
  };
}

function load() {
  const base = defaults();
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    if (!raw || typeof raw !== 'object') return base;
    return merge(base, raw);
  } catch (e) { return base; }
}
function merge(base, raw) {
  const out = Object.assign({}, base, raw);
  out.profile = Object.assign({}, base.profile, raw.profile || {});
  out.profile.custom = Object.assign({}, base.profile.custom, (raw.profile || {}).custom || {});
  out.gym = Object.assign({}, base.gym, raw.gym || {});
  out.settings = Object.assign({}, base.settings, raw.settings || {});
  out.plan = mergePlan(raw.plan);
  // no breakfast any more, snacks split into merenda and pre nanna: move old diary lines
  const OLD_SLOT = { colazione: 'pranzo', spuntini: 'merenda' };
  Object.values(out.diary || {}).forEach((list) => { if (Array.isArray(list)) list.forEach((e) => { if (OLD_SLOT[e.slot]) e.slot = OLD_SLOT[e.slot]; }); });
  ['foods', 'diary', 'water'].forEach((k) => { if (!out[k] || typeof out[k] !== 'object' || Array.isArray(out[k])) out[k] = {}; });
  ['recent', 'meals', 'weights'].forEach((k) => { if (!Array.isArray(out[k])) out[k] = []; });
  if (!Array.isArray(out.gym.workouts)) out.gym.workouts = [];
  if (!Array.isArray(out.gym.custom)) out.gym.custom = [];
  out.gym.cfg = mergeGym((raw.gym || {}).cfg);
  return out;
}

let state = load();
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast('Memoria piena: fai un backup da Profilo'); }
}
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); }
window.addEventListener('pagehide', () => { if (saveTimer) save(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && saveTimer) save(); });

// ---------- numbers: weight, BMR, targets ----------
function currentWeight() {
  const w = state.weights;
  return w.length ? w[w.length - 1].kg : state.profile.weight;
}
function calc() {
  const p = state.profile;
  const w = currentWeight();
  const bmr = 10 * w + 6.25 * p.height - 5 * p.age + (p.sex === 'f' ? -161 : 5);
  const tdee = bmr * p.activity;
  const daily = Math.round((p.pace * 7700) / 7);
  const delta = p.goal === 'cut' ? -daily : p.goal === 'bulk' ? Math.round(daily * 0.6) : 0;
  const floor = p.sex === 'f' ? 1200 : 1500;
  let kcal = Math.round((tdee + delta) / 10) * 10;
  let floored = false;
  if (kcal < floor) { kcal = floor; floored = true; }
  const gkg = p.goal === 'cut' ? 2 : p.goal === 'bulk' ? 1.8 : 1.6;
  let prot = Math.round(w * gkg);
  let fat = Math.round(Math.max(0.8 * w, (kcal * 0.25) / 9));
  const c = p.custom || {};
  const auto = { kcal, p: prot, f: fat };
  if (c.kcal > 0) kcal = Math.round(c.kcal);
  if (c.p > 0) prot = Math.round(c.p);
  if (c.f > 0) fat = Math.round(c.f);
  const carbs = Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4));
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), delta, kcal, p: prot, f: fat, c: carbs, floored, auto, w, custom: c.kcal > 0 || c.p > 0 || c.f > 0 };
}

// ---------- foods ----------
function getFood(id) { return state.foods[id] || BUILTIN[id] || null; }
function allFoods() {
  const out = Object.assign({}, BUILTIN);
  Object.values(state.foods).forEach((f) => { out[f.id] = f; });
  return Object.values(out);
}
function entryVals(e) {
  const k = (e.g || 0) / 100;
  return { kcal: e.n.kcal * k, p: e.n.p * k, c: e.n.c * k, f: e.n.f * k };
}
function sumVals(list) {
  return list.reduce((a, e) => { const v = entryVals(e); a.kcal += v.kcal; a.p += v.p; a.c += v.c; a.f += v.f; return a; }, { kcal: 0, p: 0, c: 0, f: 0 });
}
function touchRecent(id) {
  state.recent = [id].concat(state.recent.filter((x) => x !== id)).slice(0, 40);
}
function foodLabel(f) { return f.brand ? `${f.name} · ${f.brand}` : f.name; }

// ---------- Open Food Facts (free, no key) ----------
const OFF_FIELDS = 'code,product_name,product_name_it,generic_name_it,brands,quantity,serving_quantity,nutriments,image_front_small_url';
function fromOff(p) {
  if (!p) return null;
  const n = p.nutriments || {};
  let kcal = num(n['energy-kcal_100g']);
  if (!Number.isFinite(kcal)) { const kj = num(n['energy-kj_100g'] != null ? n['energy-kj_100g'] : n.energy_100g); if (Number.isFinite(kj)) kcal = kj / 4.184; }
  const name = (p.product_name_it || p.product_name || p.generic_name_it || '').trim();
  if (!name || !Number.isFinite(kcal)) return null;
  const r = (v) => { const x = num(v); return Number.isFinite(x) ? Math.round(x * 10) / 10 : 0; };
  const code = String(p.code || '').trim();
  const serving = num(p.serving_quantity);
  let img = String(p.image_front_small_url || '');
  if (!/^https:\/\/[a-z0-9.-]*openfoodfacts\.org\//i.test(img)) img = '';
  return {
    id: code ? 'b:' + code : 'f:' + uid(), barcode: code || null, name, brand: (p.brands || '').split(',')[0].trim(),
    quantity: (p.quantity || '').trim(), n: { kcal: Math.round(kcal), p: r(n.proteins_100g), c: r(n.carbohydrates_100g), f: r(n.fat_100g) },
    serving: Number.isFinite(serving) && serving > 0 && serving < 2000 ? Math.round(serving) : null, image: img, source: 'off',
  };
}
async function offFetch(url, ms = 9000) {
  if (!state.settings.online || navigator.onLine === false) throw new Error('offline');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error('http ' + res.status);
    return await res.json();
  } finally { clearTimeout(timer); }
}
async function offByBarcode(code) {
  const data = await offFetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`);
  if (!data || data.status !== 1 || !data.product) return null;
  const f = fromOff(Object.assign({ code }, data.product));
  if (f) { f.id = 'b:' + code; f.barcode = code; }
  return f;
}
async function offSearch(q) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=24&sort_by=unique_scans_n&lc=it&fields=${OFF_FIELDS}`;
  const data = await offFetch(url, 12000);
  return ((data && data.products) || []).map(fromOff).filter(Boolean);
}

// ---------- UI basics: toast, sheets, haptics ----------
let toastTimer = null;
function toast(msg, action, label = 'Annulla') {
  const t = $('toast');
  $('toast-txt').textContent = msg;
  const b = $('toast-btn');
  b.hidden = !action;
  b.textContent = label;
  b.onclick = action ? () => { t.hidden = true; action(); } : null;
  t.hidden = false;
  t.classList.remove('show', 'rec'); void t.offsetWidth; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, action ? 5000 : 2600);
}

const sheets = [];
function openSheet({ title, body, cls = '', onMount, onClose }) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-scrim"></div><div class="sheet ${cls}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sheet-grip" aria-hidden="true"></div>
    <div class="sheet-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Chiudi"><svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z" transform="translate(1.4 0)"/></svg></button></div>
    <div class="sheet-body">${body}</div></div>`;
  document.body.appendChild(wrap);
  const el = wrap.querySelector('.sheet');
  const api = {
    el, wrap, closed: false,
    close() {
      if (api.closed) return;
      api.closed = true;
      const i = sheets.indexOf(api); if (i >= 0) sheets.splice(i, 1);
      wrap.classList.remove('open');
      setTimeout(() => wrap.remove(), 320);
      if (onClose) onClose();
    },
    setBody(html) { el.querySelector('.sheet-body').innerHTML = html; },
  };
  sheets.push(api);
  wrap.querySelector('.sheet-scrim').addEventListener('click', api.close);
  el.querySelector('[data-close]').addEventListener('click', api.close);
  // drag the top of the sheet down to close it
  let y0 = null, dy = 0;
  const head = [el.querySelector('.sheet-grip'), el.querySelector('.sheet-head')];
  head.forEach((h) => {
    h.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; dy = 0; el.style.transition = 'none'; }, { passive: true });
    h.addEventListener('touchmove', (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); el.style.transform = `translate3d(0,${dy}px,0)`; }, { passive: true });
    h.addEventListener('touchend', () => { if (y0 == null) return; el.style.transition = ''; el.style.transform = ''; y0 = null; if (dy > 90) api.close(); });
  });
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  if (onMount) onMount(el, api);
  return api;
}
function closeAllSheets() { sheets.slice().forEach((s) => s.close()); }

// navigator.vibrate where it exists. Safari on iPhone has none: from iOS 18 toggling an
// <input switch> gives a light system tap, but only while handling a touch.
const haptic = (() => {
  let label = null;
  const el = () => {
    if (label) return label;
    label = document.createElement('label');
    label.className = 'haptic';
    label.setAttribute('aria-hidden', 'true');
    const input = document.createElement('input');
    input.type = 'checkbox'; input.setAttribute('switch', ''); input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
    return label;
  };
  return (pulses = 1) => {
    if (state.settings.haptics === false) return;
    try {
      if (navigator.vibrate) { navigator.vibrate(pulses === 1 ? 35 : Array.from({ length: pulses * 2 - 1 }, (_, i) => (i % 2 ? 80 : 60))); return; }
      const l = el();
      l.click();
      for (let k = 1; k < pulses; k++) setTimeout(() => l.click(), k * 130);
    } catch (e) { /* no haptics */ }
  };
})();

// a short beep at the end of the rest timer; iPhone only allows sound after a first touch
let audioCtx = null;
document.addEventListener('pointerdown', () => {
  if (audioCtx) { if (audioCtx.state === 'suspended') audioCtx.resume(); return; }
  try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
}, { passive: true });
function beep() {
  if (!audioCtx) return;
  try {
    const t = audioCtx.currentTime;
    [0, 0.22, 0.44].forEach((o, i) => {
      const osc = audioCtx.createOscillator(); const g = audioCtx.createGain();
      osc.frequency.value = i === 2 ? 1320 : 880; osc.type = 'sine';
      g.gain.setValueAtTime(0.0001, t + o); g.gain.exponentialRampToValueAtTime(0.35, t + o + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + o + 0.18);
      osc.connect(g).connect(audioCtx.destination); osc.start(t + o); osc.stop(t + o + 0.2);
    });
  } catch (e) { /* ignore */ }
}

// ---------- tabs ----------
let tab = 'oggi';
function showTab(name) {
  tab = name;
  document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'v-' + name));
  render();
  $('views').scrollTop = 0;
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => { if (b.dataset.tab !== tab) { haptic(1); showTab(b.dataset.tab); } }));

function render() {
  if (tab === 'oggi') renderOggi();
  else if (tab === 'peso') renderPeso();
  else if (tab === 'palestra') renderPalestra();
  else renderProfilo();
}

// small svg ring used for kcal
function ring(frac, size, stroke, cls) {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r;
  const f = clamp(frac, 0, 1);
  return `<svg class="ring ${cls || ''}" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-width="${stroke}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - f)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
}
// status colour: green in target, orange a little over, red clearly over
function kcalState(v, t) { const f = t > 0 ? v / t : 0; return f > 1.03 ? 'over' : f > 1 ? 'near' : f >= 0.95 ? 'hit' : ''; }
function macroBar(label, val, target, cls) {
  const frac = target > 0 ? val / target : 0;
  const st = frac > 1.12 ? ' over' : frac > 1.05 ? ' near' : frac >= 0.92 ? ' hit' : '';
  return `<div class="macro ${cls}${st}"><div class="macro-top"><span>${label}</span><b>${fmt(val)}<small> / ${fmt(target)} g</small></b></div>
    <div class="mbar"><i style="transform:scaleX(${clamp(frac, 0, 1)})"></i></div></div>`;
}
const I = {
  plus: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
  more: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>',
  left: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>',
  right: '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M8.6 5.4 10 4l8 8-8 8-1.4-1.4 6.6-6.6z"/></svg>',
  scan: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M8 8v8M11 8v8M14 8v8M17 8v8"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.1 8.4 18.7 7z"/></svg>',
  chev: '<i class="chev" aria-hidden="true">›</i>',
  timer: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M9 1h6v2H9zm3 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm1 2v4.4l3 1.8-1 1.7-4-2.4V9z"/></svg>',
};

// numbers that change roll: the old digits go up and fade, the new ones come from below
// (only the digits that changed move)
const rollLast = {};
function rollNum(key, txt) {
  const prev = rollLast[key];
  rollLast[key] = txt;
  if (prev == null || prev === txt || matchMedia('(prefers-reduced-motion: reduce)').matches) return esc(txt);
  const a = String(prev), b = String(txt);
  const pa = a.padStart(b.length, ' '), pb = b.padStart(a.length, ' ');
  let out = '';
  for (let i = 0; i < pb.length; i++) {
    const n = pb[i], o = pa[i] != null ? pa[i] : ' ';
    if (n === o || !/\d/.test(n + o)) { if (n !== ' ') out += esc(n); continue; }
    out += `<span class="roll"><span class="roll-in">${esc(n.trim())}</span>${o.trim() ? `<span class="roll-out" aria-hidden="true">${esc(o)}</span>` : ''}</span>`;
  }
  return out;
}

// ================= OGGI: daily diary =================
let day = dkey();
function dayEntries(k = day) { return state.diary[k] || []; }

function renderOggi() {
  const t = targetsFor(day);
  const list = dayEntries();
  const tot = sumVals(list);
  const left = t.kcal - tot.kcal;
  const over = left < 0;
  const g = GOALS[state.profile.goal];
  const paceTxt = state.profile.goal === 'keep' ? '' : ` · ${state.profile.goal === 'cut' ? '−' : '+'}${fmt2(state.profile.pace * (state.profile.goal === 'bulk' ? 0.6 : 1))} kg/sett`;
  const yesterday = dayEntries(addDays(day, -1));
  let html = `<header class="top">
      <button type="button" class="icon-btn" data-act="day-prev" aria-label="Giorno prima">${I.left}</button>
      <button type="button" class="day-title" data-act="day-today"><span>${esc(dayLabel(day))}</span>${day !== dkey() ? '<small>torna a oggi</small>' : `<small>${esc(shortDate(day))}</small>`}</button>
      <button type="button" class="icon-btn" data-act="day-next" aria-label="Giorno dopo">${I.right}</button>
    </header>`;
  if (!state.profile.done) {
    html += `<button type="button" class="card setup-card" data-act="setup"><b>Imposta il tuo profilo</b><span>Sesso, età, altezza, peso e obiettivo: calcolo io calorie e macro.</span>${I.chev}</button>`;
  }
  html += `<section class="card sum-card">
      <div class="sum-main">
        <div class="ring-box ${kcalState(tot.kcal, t.kcal)}">${ring(t.kcal ? tot.kcal / t.kcal : 0, 152, 14, 'kcal-ring')}
          <div class="ring-center"><b class="big">${rollNum('kcal-' + day, fmt(Math.abs(left)))}</b><span>${over ? 'kcal oltre' : 'kcal rimaste'}</span></div></div>
        <div class="sum-side">
          <div><span>Obiettivo</span><b>${fmt(t.kcal)}</b></div>
          <div><span>Mangiate</span><b>${fmt(tot.kcal)}</b></div>
          ${t.type ? `<button type="button" class="goal-chip dt-${t.type}" data-act="plan-open">Piano · ${esc(DAY_TYPES[t.type].name)}</button>` : `<button type="button" class="goal-chip" data-act="tab-profilo">${esc(g.name)}${esc(paceTxt)}</button>`}
        </div>
      </div>
      <div class="macros">${macroBar('Proteine', tot.p, t.p, 'p')}${macroBar('Carboidrati', tot.c, t.c, 'c')}${macroBar('Grassi', tot.f, t.f, 'f')}</div>
    </section>`;
  html += planCard(day);
  SLOTS.forEach((s) => {
    const items = list.filter((e) => e.slot === s.id);
    const st = sumVals(items);
    const yItems = yesterday.filter((e) => e.slot === s.id);
    html += `<section class="card slot" data-slot="${s.id}">
      <div class="slot-head"><h3>${s.name}</h3><span class="slot-kcal">${items.length ? fmt(st.kcal) + ' kcal' : ''}</span>
        <button type="button" class="icon-btn sm" data-act="slot-menu" data-slot="${s.id}" aria-label="Altre azioni ${s.name}">${I.more}</button></div>`;
    if (items.length) {
      html += '<ul class="entries">' + items.map((e) => {
        const v = entryVals(e);
        return `<li><button type="button" class="entry" data-act="entry" data-id="${e.id}">
          <span class="e-name">${esc(e.name)}${e.brand ? `<small>${esc(e.brand)}</small>` : ''}</span>
          <span class="e-meta">${fmt(e.g)} g · P ${fmt(v.p)} · C ${fmt(v.c)} · G ${fmt(v.f)}</span>
          <b class="e-kcal">${fmt(v.kcal)}</b></button></li>`;
      }).join('') + '</ul>';
    }
    html += `<div class="slot-actions"><button type="button" class="add-btn" data-act="add" data-slot="${s.id}">${I.plus}<span>Aggiungi</span></button>
      <button type="button" class="add-btn scan-btn" data-act="scan" data-slot="${s.id}">${I.scan}<span>Scansiona</span></button>
      ${!items.length && t.type && planSlotKcal(day, s.id) > 0 ? `<button type="button" class="ghost-btn" data-act="slot-plan" data-slot="${s.id}">Dal piano · ${fmt(planSlotKcal(day, s.id))} kcal</button>` : ''}
      ${!items.length && yItems.length ? `<button type="button" class="ghost-btn" data-act="copy-yday" data-slot="${s.id}">Come ieri · ${fmt(sumVals(yItems).kcal)} kcal</button>` : ''}</div>
      </section>`;
  });
  $('v-oggi').innerHTML = html;
}

$('v-oggi').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'day-prev') { day = addDays(day, -1); renderOggi(); }
  else if (act === 'day-next') { day = addDays(day, 1); renderOggi(); }
  else if (act === 'day-today') { day = dkey(); renderOggi(); }
  else if (act === 'setup') openProfileSheet(true);
  else if (act === 'tab-profilo') showTab('profilo');
  else if (act === 'add') openAddSheet(b.dataset.slot);
  else if (act === 'scan') { const slot = b.dataset.slot; openScanner((code) => onScan(code, slot, null)); }
  else if (act === 'entry') { const e = dayEntries().find((x) => x.id === b.dataset.id); if (e) openQtySheet({ entry: e }); }
  else if (act === 'copy-yday') copySlot(addDays(day, -1), b.dataset.slot);
  else if (act === 'slot-menu') openSlotMenu(b.dataset.slot);
  else if (act === 'plan-open') openPlanSheet();
  else if (act === 'plan-fill' || act === 'slot-plan') {
    const added = fillFromPlan(day, act === 'slot-plan' ? b.dataset.slot : null);
    if (!added.length) return;
    haptic(1); renderOggi();
    toast(`Dal piano: ${fmt(sumVals(added).kcal)} kcal aggiunte`, () => { removeEntries(added.map((a) => a.id)); renderOggi(); });
  } else if (act === 'water+' || act === 'water-') { addWater(day, act === 'water+' ? 250 : -250); haptic(1); renderOggi(); }
  else if (act === 'refeed-today') { setDayType(day, 'refeed'); haptic(1); renderOggi(); toast('Oggi ricarica: più carboidrati'); }
});
$('v-oggi').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-daytype]'); if (!b) return;
  const cur = dayType(day);
  setDayType(day, b.dataset.daytype === cur && state.plan.days[day] ? null : b.dataset.daytype);
  haptic(1); renderOggi();
});
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-advice]'); if (!b) return;
  applyAdvice(+b.dataset.advice);
});

function addEntries(items, slot, k = day) {
  if (!state.diary[k]) state.diary[k] = [];
  const added = items.map((it) => ({ id: uid(), slot, food: it.food, name: it.name, brand: it.brand || '', n: Object.assign({}, it.n), g: it.g }));
  state.diary[k].push(...added);
  items.forEach((it) => { if (it.food) touchRecent(it.food); });
  save();
  return added;
}
function removeEntries(ids, k = day) {
  const set = new Set(ids);
  state.diary[k] = dayEntries(k).filter((e) => !set.has(e.id));
  if (!state.diary[k].length) delete state.diary[k];
  save();
}
function copySlot(fromKey, slot) {
  const items = dayEntries(fromKey).filter((e) => e.slot === slot);
  if (!items.length) return;
  const added = addEntries(items, slot);
  haptic(1);
  renderOggi();
  toast(`${SLOTS.find((s) => s.id === slot).name} come ieri: ${fmt(sumVals(items).kcal)} kcal`, () => { removeEntries(added.map((a) => a.id)); renderOggi(); });
}
function openSlotMenu(slot) {
  const s = SLOTS.find((x) => x.id === slot);
  const items = dayEntries().filter((e) => e.slot === slot);
  const yItems = dayEntries(addDays(day, -1)).filter((e) => e.slot === slot);
  const sh = openSheet({
    title: s.name,
    body: `<div class="menu-list">
      <button type="button" data-m="save" ${items.length ? '' : 'disabled'}>Salva come pasto</button>
      <button type="button" data-m="yday" ${yItems.length ? '' : 'disabled'}>Aggiungi come ieri${yItems.length ? ` (${fmt(sumVals(yItems).kcal)} kcal)` : ''}</button>
      <button type="button" data-m="clear" class="danger" ${items.length ? '' : 'disabled'}>Svuota ${s.name.toLowerCase()}</button></div>`,
    onMount(el) {
      el.addEventListener('click', (ev) => {
        const m = ev.target.closest('[data-m]'); if (!m) return;
        sh.close();
        if (m.dataset.m === 'save') saveAsMeal(items, s.name);
        else if (m.dataset.m === 'yday') copySlot(addDays(day, -1), slot);
        else if (m.dataset.m === 'clear') {
          const backup = items.map((e) => Object.assign({}, e));
          removeEntries(items.map((e) => e.id)); renderOggi();
          toast(`${s.name} svuotata`, () => { state.diary[day] = dayEntries().concat(backup); save(); renderOggi(); });
        }
      });
    },
  });
}

// ---------- add food sheet: search, scan, my foods, saved meals ----------
function openAddSheet(slot) {
  let mode = 'recenti';
  let q = '';
  let online = { q: '', list: [], status: '' };
  let searchTimer = null;
  let sh = null;
  sh = openSheet({
    title: 'Aggiungi a ' + SLOTS.find((s) => s.id === slot).name.toLowerCase(),
    cls: 'tall',
    body: `<div class="search-row"><input type="search" id="add-q" placeholder="Cerca un alimento" autocomplete="off" enterkeyhint="search"></div>
      <button type="button" class="scan-wide" id="add-scan2">${I.scan}<span>Scansiona il codice a barre</span></button>
      <div class="seg" id="add-seg"><button type="button" data-mode="recenti" class="on">Recenti</button><button type="button" data-mode="miei">Alimenti</button><button type="button" data-mode="pasti">Pasti</button></div>
      <div id="add-list" class="pick-list"></div>
      <button type="button" class="ghost-btn wide" id="add-new">${I.plus}<span>Nuovo alimento a mano</span></button>`,
    onMount(el, api) {
      sh = api;
      const input = el.querySelector('#add-q');
      input.addEventListener('input', () => {
        q = input.value.trim();
        draw();
        clearTimeout(searchTimer);
        if (q.length >= 3 && state.settings.online) searchTimer = setTimeout(() => runOnline(q), 800);
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); if (q.length >= 2) { clearTimeout(searchTimer); runOnline(q); } } });
      el.querySelector('#add-seg').addEventListener('click', (e) => {
        const b = e.target.closest('[data-mode]'); if (!b) return;
        mode = b.dataset.mode;
        el.querySelectorAll('#add-seg button').forEach((x) => x.classList.toggle('on', x === b));
        draw();
      });
      el.querySelector('#add-scan2').addEventListener('click', () => openScanner((code) => onScan(code, slot, sh)));
      el.querySelector('#add-new').addEventListener('click', () => openFoodEditor(null, (f) => openQtySheet({ food: f, slot, after: () => sh.close() }), q));
      el.querySelector('#add-list').addEventListener('click', (e) => {
        const b = e.target.closest('[data-pick]'); if (!b) return;
        const kind = b.dataset.kind, id = b.dataset.pick;
        if (kind === 'meal') {
          const meal = state.meals.find((m) => m.id === id); if (!meal) return;
          if (e.target.closest('[data-edit]')) { openMealEditor(meal, () => draw()); return; }
          const added = addEntries(meal.items, slot);
          haptic(1); sh.close(); renderOggi();
          toast(`${meal.name}: ${fmt(sumVals(meal.items).kcal)} kcal aggiunte`, () => { removeEntries(added.map((a) => a.id)); renderOggi(); });
          return;
        }
        if (kind === 'online') {
          const f = online.list.find((x) => x.id === id); if (!f) return;
          openQtySheet({ food: f, slot, isNew: true, after: () => sh.close() });
          return;
        }
        const f = getFood(id); if (f) openQtySheet({ food: f, slot, after: () => sh.close() });
      });
      draw();
    },
  });
  function runOnline(term) {
    if (!state.settings.online) return;
    online = { q: term, list: [], status: 'loading' };
    draw();
    offSearch(term).then((list) => { if (online.q !== term) return; online = { q: term, list, status: list.length ? 'ok' : 'none' }; draw(); })
      .catch(() => { if (online.q !== term) return; online = { q: term, list: [], status: 'err' }; draw(); });
  }
  function foodRow(f, kind = 'food') {
    const sub = [f.brand, f.quantity].filter(Boolean).join(' · ');
    return `<button type="button" class="pick" data-pick="${esc(f.id)}" data-kind="${kind}">
      <span class="pk-name">${esc(f.name)}${sub ? `<small>${esc(sub)}</small>` : ''}</span>
      <span class="pk-meta">${fmt(f.n.kcal)} kcal<small>per 100 g</small></span></button>`;
  }
  function draw() {
    if (sh.closed) return;
    const box = sh.el.querySelector('#add-list');
    sh.el.querySelector('#add-seg').hidden = !!q;
    let html = '';
    if (q) {
      const words = norm(q).split(/\s+/).filter(Boolean);
      const local = allFoods().filter((f) => { const h = norm(f.name + ' ' + (f.brand || '')); return words.every((w) => h.includes(w)); })
        .sort((a, b) => (state.recent.indexOf(a.id) + 1 || 999) - (state.recent.indexOf(b.id) + 1 || 999)).slice(0, 30);
      const meals = state.meals.filter((m) => words.every((w) => norm(m.name).includes(w)));
      if (meals.length) html += '<p class="list-label">Pasti salvati</p>' + meals.map(mealRow).join('');
      if (local.length) html += '<p class="list-label">Nei tuoi alimenti</p>' + local.map((f) => foodRow(f)).join('');
      if (state.settings.online) {
        html += '<p class="list-label">Open Food Facts</p>';
        if (online.q === q && online.status === 'loading') html += '<p class="empty">Cerco…</p>';
        else if (online.q === q && online.status === 'err') html += `<p class="empty">Ricerca non riuscita (connessione o troppe ricerche di fila). <button type="button" class="link" id="retry-off">Riprova</button></p>`;
        else if (online.q === q && online.status === 'none') html += '<p class="empty">Nessun risultato online. Prova con meno parole o scansiona il codice.</p>';
        else if (online.q === q) html += online.list.filter((f) => !state.foods[f.id]).map((f) => foodRow(f, 'online')).join('') || '<p class="empty">Già tutti nei tuoi alimenti.</p>';
        else html += `<p class="empty">${q.length < 3 ? 'Scrivi almeno 3 lettere per cercare online.' : 'Cerco tra poco…'}</p>`;
      } else if (!local.length && !meals.length) html += '<p class="empty">Nessun alimento trovato. Aggiungilo a mano.</p>';
    } else if (mode === 'recenti') {
      const rec = state.recent.map(getFood).filter(Boolean);
      html = rec.length ? rec.map((f) => foodRow(f)).join('') : '<p class="empty">Gli alimenti che usi compaiono qui. Cerca o scansiona per iniziare.</p>';
    } else if (mode === 'miei') {
      const mine = Object.values(state.foods).sort((a, b) => a.name.localeCompare(b.name, 'it'));
      if (mine.length) html += '<p class="list-label">Salvati da te</p>' + mine.map((f) => foodRow(f)).join('');
      html += '<p class="list-label">Alimenti base (valori medi)</p>' + Object.values(BUILTIN).filter((f) => !state.foods[f.id]).map((f) => foodRow(f)).join('');
    } else {
      html = state.meals.length ? state.meals.map(mealRow).join('') : '<p class="empty">Nessun pasto salvato. Riempi un pasto nel diario, poi dal menu ⋯ scegli “Salva come pasto”.</p>';
    }
    box.innerHTML = html;
    const r = box.querySelector('#retry-off'); if (r) r.addEventListener('click', () => runOnline(q));
  }
  function mealRow(m) {
    const v = sumVals(m.items);
    return `<div class="pick meal-pick" data-pick="${esc(m.id)}" data-kind="meal" role="button" tabindex="0">
      <span class="pk-name">${esc(m.name)}<small>${m.items.length} alimenti · P ${fmt(v.p)} · C ${fmt(v.c)} · G ${fmt(v.f)}</small></span>
      <span class="pk-meta">${fmt(v.kcal)} kcal</span>
      <button type="button" class="icon-btn sm" data-edit aria-label="Modifica pasto">${I.more}</button></div>`;
  }
}

function onScan(code, slot, addSheet) {
  const known = state.foods['b:' + code];
  if (known) { openQtySheet({ food: known, slot, after: () => addSheet && addSheet.close() }); return; }
  toast(`Codice ${code}: cerco il prodotto…`);
  offByBarcode(code).then((f) => {
    if (f) { openQtySheet({ food: f, slot, isNew: true, after: () => addSheet && addSheet.close() }); return; }
    toast('Prodotto non trovato: inserisci i valori dall\'etichetta');
    openFoodEditor({ id: 'b:' + code, barcode: code, name: '', brand: '', n: { kcal: '', p: '', c: '', f: '' } }, (nf) => openQtySheet({ food: nf, slot, after: () => addSheet && addSheet.close() }));
  }).catch(() => {
    toast('Sei offline: inserisci i valori dall\'etichetta');
    openFoodEditor({ id: 'b:' + code, barcode: code, name: '', brand: '', n: { kcal: '', p: '', c: '', f: '' } }, (nf) => openQtySheet({ food: nf, slot, after: () => addSheet && addSheet.close() }));
  });
}

// ---------- quantity sheet: grams, slot, live totals ----------
// opts: {food, slot, isNew, after} to add, or {entry} to change/delete a diary line
function openQtySheet(opts) {
  const entry = opts.entry || null;
  let food = entry ? (getFood(entry.food) || { id: entry.food, name: entry.name, brand: entry.brand, n: entry.n }) : opts.food;
  const n = entry ? entry.n : food.n;
  let slot = entry ? entry.slot : opts.slot;
  const startG = entry ? entry.g : (food.serving || (food.piece ? food.piece : 100));
  const chips = [];
  if (food.piece) [1, 2, 3].forEach((k) => chips.push([`${k} ${k === 1 ? 'pezzo' : 'pezzi'}`, food.piece * k]));
  if (food.serving) chips.push([`Porzione ${fmt(food.serving)} g`, food.serving]);
  [50, 100, 150, 200].forEach((g) => { if (!chips.some((c) => c[1] === g)) chips.push([`${g} g`, g]); });
  const sh = openSheet({
    title: entry ? 'Modifica' : 'Quantità',
    body: `<div class="qty-food">${food.image ? `<img src="${esc(food.image)}" alt="" loading="lazy">` : ''}<div><b>${esc(food.name)}</b><small>${esc([food.brand, food.quantity].filter(Boolean).join(' · '))}</small>
        <small class="per100">Per 100 g: ${fmt(n.kcal)} kcal · P ${fmt1(n.p)} · C ${fmt1(n.c)} · G ${fmt1(n.f)}${food.source === 'base' ? ' · valori medi' : ''}</small></div></div>
      <label class="qty-input"><input type="text" inputmode="decimal" id="qty-g" value="${fmt1(startG)}" aria-label="Grammi"><span>g</span></label>
      <div class="chips">${chips.map(([l, g]) => `<button type="button" data-g="${g}">${esc(l)}</button>`).join('')}</div>
      <div class="seg slot-seg">${SLOTS.map((s) => `<button type="button" data-slot="${s.id}" class="${s.id === slot ? 'on' : ''}">${s.name}</button>`).join('')}</div>
      <div class="qty-tot" id="qty-tot"></div>
      <div class="sheet-actions">
        ${entry ? '<button type="button" class="btn danger-ghost" id="qty-del">Elimina</button>' : ''}
        <button type="button" class="btn primary" id="qty-ok">${entry ? 'Salva' : 'Aggiungi'}</button></div>
      ${entry ? '<button type="button" class="btn wide" id="qty-swap">⇄ Sostituisci con un\'alternativa</button>' : ''}
      <button type="button" class="link center" id="qty-edit-food">Modifica i valori di questo alimento</button>`,
    onMount(el) {
      const inp = el.querySelector('#qty-g');
      const upd = () => {
        const g = num(inp.value) || 0;
        const v = entryVals({ n, g });
        el.querySelector('#qty-tot').innerHTML = `<div><b>${fmt(v.kcal)}</b><span>kcal</span></div><div class="p"><b>${fmt1(v.p)}</b><span>proteine</span></div><div class="c"><b>${fmt1(v.c)}</b><span>carboidrati</span></div><div class="f"><b>${fmt1(v.f)}</b><span>grassi</span></div>`;
      };
      inp.addEventListener('input', upd);
      inp.addEventListener('focus', () => inp.select());
      el.querySelector('.chips').addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (!b) return; inp.value = fmt1(+b.dataset.g); upd(); haptic(1); });
      el.querySelector('.slot-seg').addEventListener('click', (e) => {
        const b = e.target.closest('[data-slot]'); if (!b) return;
        slot = b.dataset.slot; el.querySelectorAll('.slot-seg button').forEach((x) => x.classList.toggle('on', x === b));
      });
      el.querySelector('#qty-ok').addEventListener('click', () => {
        const g = num(inp.value);
        if (!(g > 0)) { inp.focus(); toast('Scrivi i grammi'); return; }
        if (entry) {
          entry.g = Math.round(g * 10) / 10; entry.slot = slot; save();
        } else {
          if (opts.isNew || food.source !== 'base') { state.foods[food.id] = Object.assign({}, state.foods[food.id] || {}, food); }
          addEntries([{ food: food.id, name: food.name, brand: food.brand, n: food.n, g: Math.round(g * 10) / 10 }], slot);
          toast(`${food.name}: ${fmt(entryVals({ n: food.n, g }).kcal)} kcal`);
        }
        haptic(1); sh.close(); if (opts.after) opts.after(); renderOggi();
      });
      const swap = el.querySelector('#qty-swap');
      if (swap) swap.addEventListener('click', () => {
        const g = num(inp.value) > 0 ? num(inp.value) : entry.g;
        sh.close();
        openSwapSheet({ food: entry.food, name: entry.name, n: entry.n, g }, (items) => {
          const k = Object.keys(state.diary).find((d) => state.diary[d].includes(entry)) || day;
          const list = state.diary[k];
          const at = list.indexOf(entry);
          const backup = list.slice();
          const fresh = items.map((it) => ({ id: uid(), slot: entry.slot, food: it.food, name: it.name, brand: it.brand || '', n: Object.assign({}, it.n), g: it.g }));
          list.splice(at, 1, ...fresh);
          items.forEach((it) => touchRecent(it.food));
          save(); renderOggi();
          toast(`Sostituito con ${items.map((x) => x.name.toLowerCase()).join(' + ')}`, () => { state.diary[k] = backup; save(); renderOggi(); });
        });
      });
      const del = el.querySelector('#qty-del');
      if (del) del.addEventListener('click', () => {
        const backup = Object.assign({}, entry);
        removeEntries([entry.id]); sh.close(); renderOggi();
        toast(`${entry.name} eliminato`, () => { if (!state.diary[day]) state.diary[day] = []; state.diary[day].push(backup); save(); renderOggi(); });
      });
      el.querySelector('#qty-edit-food').addEventListener('click', () => {
        openFoodEditor(Object.assign({}, food, { n: Object.assign({}, n) }), (nf) => {
          if (entry) { entry.n = Object.assign({}, nf.n); entry.name = nf.name; entry.brand = nf.brand; save(); }
          sh.close(); if (!entry) openQtySheet(Object.assign({}, opts, { food: nf, isNew: false })); else renderOggi();
        });
      });
      upd();
      if (!entry) setTimeout(() => { inp.focus(); inp.select(); }, 350);
    },
  });
}

// ---------- food editor: manual foods and fixes ----------
function openFoodEditor(food, done, nameHint) {
  const f = food ? Object.assign({}, food, { n: Object.assign({}, food.n) }) : { id: 'f:' + uid(), name: nameHint || '', brand: '', n: { kcal: '', p: '', c: '', f: '' }, serving: null };
  const isBuiltin = !!BUILTIN[f.id];
  const v = (x) => (x === '' || x == null ? '' : fmt1(x));
  const sh = openSheet({
    title: food && food.name ? 'Modifica alimento' : 'Nuovo alimento',
    body: `<form class="form" id="food-form" novalidate>
      <label class="field"><span>Nome</span><input name="name" value="${esc(f.name)}" required autocomplete="off"></label>
      <label class="field"><span>Marca (facoltativa)</span><input name="brand" value="${esc(f.brand || '')}" autocomplete="off"></label>
      <p class="list-label">Valori per 100 g, come in etichetta</p>
      <div class="grid2">
        <label class="field"><span>Calorie (kcal)</span><input name="kcal" inputmode="decimal" value="${v(f.n.kcal)}"></label>
        <label class="field"><span>Proteine (g)</span><input name="p" inputmode="decimal" value="${v(f.n.p)}"></label>
        <label class="field"><span>Carboidrati (g)</span><input name="c" inputmode="decimal" value="${v(f.n.c)}"></label>
        <label class="field"><span>Grassi (g)</span><input name="f" inputmode="decimal" value="${v(f.n.f)}"></label>
      </div>
      <label class="field"><span>Porzione abituale in grammi (facoltativa)</span><input name="serving" inputmode="decimal" value="${v(f.serving)}"></label>
      ${f.barcode ? `<p class="hint">Codice a barre ${esc(f.barcode)}</p>` : ''}
      <p class="hint" id="kcal-check"></p>
      <div class="sheet-actions">${state.foods[f.id] ? `<button type="button" class="btn danger-ghost" id="food-del">${isBuiltin ? 'Valori originali' : 'Elimina'}</button>` : ''}<button type="submit" class="btn primary">Salva</button></div>
    </form>`,
    onMount(el) {
      const form = el.querySelector('#food-form');
      const check = () => {
        const k = num(form.kcal.value), p = num(form.p.value) || 0, c = num(form.c.value) || 0, g = num(form.f.value) || 0;
        const est = p * 4 + c * 4 + g * 9;
        el.querySelector('#kcal-check').textContent = Number.isFinite(k) && est > 0 && Math.abs(est - k) > Math.max(40, k * 0.2)
          ? `Controlla i valori: dai macro risultano circa ${fmt(est)} kcal.` : '';
      };
      form.addEventListener('input', check);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = form.name.value.trim();
        let kcal = num(form.kcal.value);
        const p = num(form.p.value) || 0, c = num(form.c.value) || 0, g = num(form.f.value) || 0;
        if (!name) { form.name.focus(); toast('Scrivi il nome'); return; }
        if (!Number.isFinite(kcal)) kcal = p * 4 + c * 4 + g * 9;
        if (!(kcal >= 0)) { form.kcal.focus(); return; }
        const serving = num(form.serving.value);
        const out = Object.assign({}, f, { name, brand: form.brand.value.trim(), n: { kcal: Math.round(kcal), p, c, f: g }, serving: serving > 0 ? Math.round(serving) : null, source: f.source === 'off' ? 'off' : (isBuiltin ? 'base' : 'mio'), edited: Date.now() });
        state.foods[out.id] = out;
        save();
        sh.close();
        toast('Alimento salvato');
        if (done) done(out);
      });
      const del = el.querySelector('#food-del');
      if (del) del.addEventListener('click', () => {
        delete state.foods[f.id]; state.recent = state.recent.filter((x) => isBuiltin || x !== f.id); save(); sh.close();
        toast(isBuiltin ? 'Valori originali ripristinati' : 'Alimento eliminato');
        if (done && isBuiltin) done(BUILTIN[f.id]);
        else render();
      });
      check();
      if (!f.name) setTimeout(() => form.name.focus(), 350);
    },
  });
}

// ---------- saved meals ----------
function saveAsMeal(items, hint) {
  const sh = openSheet({
    title: 'Salva come pasto',
    body: `<form class="form" id="meal-form"><label class="field"><span>Nome del pasto</span><input name="name" value="${esc(hint)}" autocomplete="off" required></label>
      <p class="hint">${items.length} alimenti · ${fmt(sumVals(items).kcal)} kcal. Lo ritrovi in Aggiungi › Pasti.</p>
      <div class="sheet-actions"><button type="submit" class="btn primary">Salva</button></div></form>`,
    onMount(el) {
      const form = el.querySelector('#meal-form');
      setTimeout(() => { form.name.focus(); form.name.select(); }, 350);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = form.name.value.trim(); if (!name) return;
        state.meals.unshift({ id: uid(), name, items: items.map((it) => ({ food: it.food, name: it.name, brand: it.brand || '', n: Object.assign({}, it.n), g: it.g })) });
        save(); sh.close(); haptic(1); toast(`Pasto “${name}” salvato`);
      });
    },
  });
}
function openMealEditor(meal, done) {
  const copy = { name: meal.name, items: meal.items.map((x) => Object.assign({}, x)) };
  const sh = openSheet({
    title: 'Modifica pasto',
    body: `<form class="form" id="me-form"><label class="field"><span>Nome</span><input name="name" value="${esc(meal.name)}" autocomplete="off"></label>
      <div id="me-items"></div><p class="hint" id="me-tot"></p>
      <div class="sheet-actions"><button type="button" class="btn danger-ghost" id="me-del">Elimina pasto</button><button type="submit" class="btn primary">Salva</button></div></form>`,
    onMount(el) {
      const box = el.querySelector('#me-items');
      const tot = () => { el.querySelector('#me-tot').textContent = `Totale ${fmt(sumVals(copy.items).kcal)} kcal`; };
      const draw = () => {
        box.innerHTML = copy.items.map((it, i) => `<div class="me-row"><span>${esc(it.name)}</span><label class="mini-in"><input inputmode="decimal" data-i="${i}" value="${fmt1(it.g)}" aria-label="Grammi di ${esc(it.name)}"><small>g</small></label>
          <button type="button" class="icon-btn sm" data-rm="${i}" aria-label="Togli ${esc(it.name)}">✕</button></div>`).join('') || '<p class="empty">Nessun alimento.</p>';
        tot();
      };
      box.addEventListener('input', (e) => { const i = e.target.dataset.i; if (i == null) return; copy.items[i].g = num(e.target.value) || 0; tot(); });
      box.addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (!b) return; copy.items.splice(+b.dataset.rm, 1); draw(); });
      el.querySelector('#me-form').addEventListener('submit', (e) => {
        e.preventDefault();
        meal.name = e.target.name.value.trim() || meal.name;
        meal.items = copy.items.filter((x) => x.g > 0);
        save(); sh.close(); toast('Pasto salvato'); if (done) done();
      });
      el.querySelector('#me-del').addEventListener('click', () => {
        if (!confirm(`Eliminare il pasto “${meal.name}”?`)) return;
        state.meals = state.meals.filter((m) => m !== meal); save(); sh.close(); toast('Pasto eliminato'); if (done) done();
      });
      draw();
    },
  });
}

// ---------- barcode scanner (camera) ----------
let scanStop = null, scanCb = null;
function loadZxing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  return new Promise((resolve, reject) => {
    const sc = document.createElement('script');
    sc.src = 'vendor/zxing.min.js'; sc.onload = () => resolve(window.ZXing); sc.onerror = reject;
    document.head.appendChild(sc);
  });
}
async function openScanner(cb) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast('Fotocamera non disponibile: cerca per nome'); return; }
  scanCb = cb;
  const video = $('scan-video');
  $('scanner').hidden = false;
  const constraints = { video: { facingMode: { ideal: 'environment' } }, audio: false };
  try {
    if ('BarcodeDetector' in window) {
      const wanted = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];
      let formats = wanted;
      try { const sup = await BarcodeDetector.getSupportedFormats(); formats = wanted.filter((f) => sup.includes(f)); } catch (e) { /* all */ }
      const detector = new BarcodeDetector({ formats });
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = stream; await video.play();
      let alive = true;
      scanStop = () => { alive = false; stream.getTracks().forEach((t) => t.stop()); };
      const tick = async () => {
        if (!alive) return;
        try { const codes = await detector.detect(video); if (codes.length) return onBarcode(codes[0].rawValue); } catch (e) { /* retry */ }
        setTimeout(tick, 150);
      };
      tick();
    } else {
      const ZX = await loadZxing();
      const hints = new Map();
      hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'CODE_128'].map((n) => ZX.BarcodeFormat[n]).filter((v) => v !== undefined));
      const reader = new ZX.BrowserMultiFormatReader(hints, 200);
      scanStop = () => reader.reset();
      await reader.decodeFromConstraints(constraints, video, (result) => { if (result) onBarcode(result.getText()); });
    }
  } catch (err) {
    closeScanner();
    toast('Non riesco ad aprire la fotocamera: controlla i permessi di Safari');
  }
}
function closeScanner() {
  if (scanStop) { try { scanStop(); } catch (e) { /* ignore */ } }
  scanStop = null;
  const video = $('scan-video');
  if (video.srcObject) { video.srcObject.getTracks().forEach((t) => t.stop()); video.srcObject = null; }
  $('scanner').hidden = true;
}
function onBarcode(code) {
  if (!scanStop) return;
  haptic(1);
  closeScanner();
  const cb = scanCb; scanCb = null;
  if (cb && /^\d{6,14}$/.test(code)) cb(code);
  else toast('Codice non valido, riprova');
}
$('scan-close').addEventListener('click', closeScanner);

// ================= PESO =================
let wRange = 90;
function trend(points, days = 21) {
  // kg per week from a least-squares line over the last `days` days
  if (points.length < 2) return null;
  const lastT = parseKey(points[points.length - 1].d).getTime();
  const pts = points.filter((p) => lastT - parseKey(p.d).getTime() <= days * 864e5);
  if (pts.length < 2) return null;
  const xs = pts.map((p) => (parseKey(p.d).getTime() - lastT) / 864e5), ys = pts.map((p) => p.kg);
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  let sxy = 0, sxx = 0;
  xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
  if (sxx < 1) return null;
  return (sxy / sxx) * 7;
}
function renderPeso() {
  const W = state.weights;
  const p = state.profile;
  const cur = currentWeight();
  const first = W.length ? W[0] : null;
  const tr = trend(W);
  let html = '<header class="top"><h1>Peso</h1><button type="button" class="pill-btn" data-act="w-add">' + I.plus + '<span>Registra</span></button></header>';
  html += `<section class="card w-card"><div class="w-now"><span>Adesso</span><b class="big">${fmt1(cur)}<small> kg</small></b>
    ${W.length ? `<span class="muted">${esc(dayLabel(W[W.length - 1].d))}</span>` : '<span class="muted">dal profilo</span>'}</div>
    <div class="w-stats">
      <div><span>Da inizio</span><b class="${first && cur - first.kg < 0 ? 'down' : ''}">${first ? signed(cur - first.kg) + ' kg' : '–'}</b></div>
      <div><span>A settimana</span><b>${tr == null ? '–' : signed(tr, 1) + ' kg'}</b></div>
      <div><span>Obiettivo</span><b>${p.target ? fmt1(p.target) + ' kg' : '<button type="button" class="link" data-act="w-target">Imposta</button>'}</b></div>
    </div>`;
  if (p.target) {
    const diff = cur - p.target;
    let eta = '';
    if (tr && Math.abs(diff) > 0.2 && Math.sign(tr) === -Math.sign(diff)) {
      const weeks = Math.abs(diff / tr);
      if (weeks < 260) { const d = new Date(Date.now() + weeks * 7 * 864e5); eta = ` · a questo ritmo verso ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; }
    }
    html += `<button type="button" class="w-goal" data-act="w-target">${Math.abs(diff) <= 0.2 ? 'Obiettivo raggiunto' : `Mancano ${fmt1(Math.abs(diff))} kg a ${fmt1(p.target)}`}${esc(eta)}</button>`;
  }
  html += '</section>';
  html += `<section class="card chart-card"><div class="seg sm" id="w-range">${[[30, '1M'], [90, '3M'], [180, '6M'], [0, 'Tutto']].map(([d, l]) => `<button type="button" data-range="${d}" class="${d === wRange ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${W.length >= 2 ? chartSvg(W, wRange, p.target) : '<p class="empty">Registra il peso almeno due volte per vedere il grafico. Pesati al mattino, stessa bilancia: conta l\'andamento, non il singolo giorno.</p>'}
    ${W.length >= 2 ? '<p class="legend"><i class="lg-dot"></i>pesate <i class="lg-line"></i>media 7 giorni' + (p.target ? ' <i class="lg-target"></i>obiettivo' : '') + '</p>' : ''}</section>`;
  html += adviceCard('peso');
  if (W.length) {
    html += '<section class="card list-card"><h3>Storico</h3><ul class="w-list">' + W.slice().reverse().slice(0, 60).map((w, i, arr) => {
      const prev = arr[i + 1];
      const d = prev ? w.kg - prev.kg : null;
      return `<li><button type="button" data-act="w-edit" data-d="${w.d}"><span>${esc(dayLabel(w.d))}${w.d !== dkey() && w.d !== addDays(dkey(), -1) ? '' : ` <small>${esc(shortDate(w.d))}</small>`}</span><b>${fmt1(w.kg)} kg</b><small class="${d == null ? '' : d < 0 ? 'down' : d > 0 ? 'up' : ''}">${d == null ? '' : signed(d)}</small></button></li>`;
    }).join('') + '</ul></section>';
  }
  $('v-peso').innerHTML = html;
}
function chartSvg(all, rangeDays, target) {
  const lastT = parseKey(all[all.length - 1].d).getTime();
  let pts = rangeDays ? all.filter((p) => lastT - parseKey(p.d).getTime() <= rangeDays * 864e5) : all.slice();
  if (pts.length < 2) pts = all.slice(-2);
  const Wd = 340, H = 190, L = 34, R = 8, T = 12, B = 24;
  const t0 = parseKey(pts[0].d).getTime(), t1 = Math.max(t0 + 864e5, parseKey(pts[pts.length - 1].d).getTime());
  // 7-day moving average (by date, not by count)
  const avg = pts.map((p) => { const t = parseKey(p.d).getTime(); const win = all.filter((q) => { const u = parseKey(q.d).getTime(); return u <= t && t - u < 7 * 864e5; }); return { t, kg: win.reduce((a, q) => a + q.kg, 0) / win.length }; });
  let lo = Math.min(...pts.map((p) => p.kg)), hi = Math.max(...pts.map((p) => p.kg));
  if (target && target >= lo - 3 && target <= hi + 3) { lo = Math.min(lo, target); hi = Math.max(hi, target); }
  const padY = Math.max(0.5, (hi - lo) * 0.15); lo -= padY; hi += padY;
  const x = (t) => L + ((t - t0) / (t1 - t0)) * (Wd - L - R);
  const y = (kg) => T + (1 - (kg - lo) / (hi - lo)) * (H - T - B);
  const step = [0.5, 1, 2, 5, 10].find((s) => (hi - lo) / s <= 5) || 10;
  let grid = '';
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) grid += `<line x1="${L}" x2="${Wd - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" class="ax" text-anchor="end">${fmt1(v)}</text>`;
  const days = (t1 - t0) / 864e5;
  const labels = [0, 0.5, 1].map((f) => { const d = new Date(t0 + f * (t1 - t0)); return `<text x="${x(d.getTime())}" y="${H - 6}" class="ax" text-anchor="${f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}">${d.getDate()} ${MONTHS[d.getMonth()]}${days > 300 && f !== 0.5 ? ' ' + String(d.getFullYear()).slice(2) : ''}</text>`; }).join('');
  const line = avg.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.kg).toFixed(1)}`).join(' ');
  const area = `${line} L${x(avg[avg.length - 1].t).toFixed(1)} ${H - B} L${x(avg[0].t).toFixed(1)} ${H - B} Z`;
  const dots = pts.map((p) => `<circle cx="${x(parseKey(p.d).getTime()).toFixed(1)}" cy="${y(p.kg).toFixed(1)}" r="${pts.length > 60 ? 1.8 : 3}" class="dot"/>`).join('');
  const tg = target && target >= lo && target <= hi ? `<line x1="${L}" x2="${Wd - R}" y1="${y(target)}" y2="${y(target)}" class="target"/>` : '';
  return `<svg class="chart" viewBox="0 0 ${Wd} ${H}" role="img" aria-label="Andamento del peso">
    <defs><linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="gf0"/><stop offset="1" class="gf1"/></linearGradient></defs>
    ${grid}${tg}<path d="${area}" fill="url(#wfill)"/><path d="${line}" class="avg"/>${dots}${labels}</svg>`;
}
$('v-peso').addEventListener('click', (ev) => {
  const r = ev.target.closest('[data-range]');
  if (r) { wRange = +r.dataset.range; renderPeso(); return; }
  const b = ev.target.closest('[data-act]'); if (!b) return;
  if (b.dataset.act === 'w-add') openWeightSheet();
  else if (b.dataset.act === 'w-edit') openWeightSheet(b.dataset.d);
  else if (b.dataset.act === 'w-target') openTargetSheet();
});
function setWeight(d, kg) {
  state.weights = state.weights.filter((w) => w.d !== d);
  if (kg > 0) state.weights.push({ d, kg: Math.round(kg * 10) / 10 });
  state.weights.sort((a, b) => (a.d < b.d ? -1 : 1));
  if (state.weights.length) state.profile.weight = currentWeight();
  save();
}
function openWeightSheet(d) {
  const ex = d ? state.weights.find((w) => w.d === d) : state.weights.find((w) => w.d === dkey());
  const date = ex ? ex.d : dkey();
  const sh = openSheet({
    title: ex ? 'Peso del ' + shortDate(date) : 'Registra il peso',
    body: `<form class="form" id="w-form">
      <label class="qty-input"><input type="text" inputmode="decimal" name="kg" value="${fmt1(ex ? ex.kg : currentWeight())}" aria-label="Peso in kg"><span>kg</span></label>
      <label class="field"><span>Giorno</span><input type="date" name="d" value="${date}" max="${dkey()}"></label>
      <div class="sheet-actions">${ex ? '<button type="button" class="btn danger-ghost" id="w-del">Elimina</button>' : ''}<button type="submit" class="btn primary">Salva</button></div></form>`,
    onMount(el) {
      const form = el.querySelector('#w-form');
      setTimeout(() => { form.kg.focus(); form.kg.select(); }, 350);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const kg = num(form.kg.value);
        if (!(kg > 20 && kg < 400)) { toast('Peso non valido'); return; }
        const nd = form.d.value || date;
        if (ex && nd !== ex.d) setWeight(ex.d, 0);
        setWeight(nd, kg);
        sh.close(); haptic(1); render();
        const tr = trend(state.weights);
        toast(`${fmt1(kg)} kg salvato${tr != null ? ` · ritmo ${signed(tr, 2)} kg/sett` : ''}`);
      });
      const del = el.querySelector('#w-del');
      if (del) del.addEventListener('click', () => { const k = ex.kg; setWeight(ex.d, 0); sh.close(); render(); toast('Pesata eliminata', () => { setWeight(ex.d, k); render(); }); });
    },
  });
}
function openTargetSheet() {
  const sh = openSheet({
    title: 'Peso obiettivo',
    body: `<form class="form" id="t-form"><label class="qty-input"><input type="text" inputmode="decimal" name="kg" value="${state.profile.target ? fmt1(state.profile.target) : ''}" placeholder="${fmt1(Math.round(currentWeight() - 5))}" aria-label="Peso obiettivo in kg"><span>kg</span></label>
      <p class="hint">Serve per il grafico e per la stima dei tempi. Lascia vuoto per toglierlo.</p>
      <div class="sheet-actions"><button type="submit" class="btn primary">Salva</button></div></form>`,
    onMount(el) {
      const form = el.querySelector('#t-form');
      setTimeout(() => form.kg.focus(), 350);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const kg = num(form.kg.value);
        state.profile.target = kg > 20 && kg < 400 ? Math.round(kg * 10) / 10 : null;
        save(); sh.close(); render();
      });
    },
  });
}

// ================= PALESTRA: see gym.js =================

// ---------- rest timer (keeps the end time, so it survives the app going to background) ----------
let timerTick = null, timerEndedAt = 0;
function startTimer(sec) {
  state.timer = { end: Date.now() + sec * 1000, dur: sec };
  timerEndedAt = 0;
  save();
  runTimer();
}
function stopTimer() { state.timer = null; save(); runTimer(); }
function runTimer() {
  clearInterval(timerTick);
  const el = $('timer');
  if (!state.timer) { el.hidden = true; el.classList.remove('ended'); document.body.classList.remove('has-timer'); return; }
  el.hidden = false;
  document.body.classList.add('has-timer');
  const C = 2 * Math.PI * 19;
  const arc = $('timer-arc');
  arc.style.strokeDasharray = `${C}px`;
  const step = () => {
    if (!state.timer) return runTimer();
    const left = (state.timer.end - Date.now()) / 1000;
    if (left <= 0) {
      if (!timerEndedAt) {
        timerEndedAt = Date.now();
        el.classList.add('ended');
        $('timer-label').textContent = 'Recupero finito';
        $('timer-val').textContent = 'Vai!'; $('timer-val').dataset.v = '';
        arc.style.strokeDashoffset = '0px';
        if (Date.now() - state.timer.end < 5000) { haptic(3); beep(); }
      }
      if (Date.now() - timerEndedAt > 6000) stopTimer();
      return;
    }
    el.classList.remove('ended');
    $('timer-label').textContent = 'Recupero';
    const tv = clock(Math.ceil(left));
    if ($('timer-val').dataset.v !== tv) { $('timer-val').dataset.v = tv; $('timer-val').innerHTML = rollNum('timer', tv); }
    arc.style.strokeDashoffset = `${C * (1 - left / state.timer.dur)}px`;
  };
  step();
  timerTick = setInterval(step, 250);
}
$('timer').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-timer]'); if (!b || !state.timer) return;
  const v = b.dataset.timer;
  if (v === 'stop') { stopTimer(); return; }
  const left = Math.max(0, state.timer.end - Date.now());
  const nl = Math.max(0, left + (+v) * 1000);
  if (nl <= 0) { stopTimer(); return; }
  state.timer.end = Date.now() + nl;
  state.timer.dur = Math.max(state.timer.dur, Math.ceil(nl / 1000));
  timerEndedAt = 0;
  save(); haptic(1); runTimer();
});

// ================= PROFILO =================
function renderProfilo() {
  const p = state.profile;
  const t = calc();
  const act = ACTIVITY.find((a) => a[0] === p.activity) || ACTIVITY[1];
  const paces = p.goal === 'cut' ? [0.25, 0.5, 0.75, 1] : p.goal === 'bulk' ? [0.25, 0.5] : [];
  const paceLbl = (v) => p.goal === 'cut' ? `−${fmt2(v)} kg` : `+${fmt2(v * 0.6)} kg`;
  let html = '<header class="top"><h1>Profilo</h1></header>';
  html += `<section class="card"><p class="list-label first">Obiettivo di questo periodo</p>
    <div class="seg goal-seg" id="goal-seg">${Object.entries(GOALS).map(([k, g]) => `<button type="button" data-goal="${k}" class="${p.goal === k ? 'on' : ''}">${g.name}</button>`).join('')}</div>
    ${paces.length ? `<p class="list-label">Ritmo a settimana</p><div class="seg sm" id="pace-seg">${paces.map((v) => `<button type="button" data-pace="${v}" class="${p.pace === v ? 'on' : ''}">${paceLbl(v)}</button>`).join('')}</div>` : ''}
    <p class="hint">${p.goal === 'cut' ? `Deficit di ${fmt(-t.delta)} kcal al giorno sul tuo consumo stimato. Proteine alte (2 g per kg) per non perdere muscolo.` : p.goal === 'bulk' ? `Surplus di ${fmt(t.delta)} kcal al giorno: crescita lenta per mettere più muscolo e meno grasso.` : 'Calorie pari al consumo stimato: il peso resta stabile.'}${t.floored ? ' Ho tenuto le calorie al minimo consigliato: meglio un ritmo più lento.' : ''}</p></section>`;
  if (state.plan.on) {
    const T = state.plan.targets;
    html += `<button type="button" class="card plan-row" data-p="plan"><b>Piano alimentare attivo</b><span>Allenamento ${fmt(T.on.kcal)} kcal · Riposo ${fmt(T.off.kcal)} kcal · ricarica ogni ${state.plan.refeed.every / 7} settimane. Nel diario valgono questi obiettivi.</span>${I.chev}</button>`;
  }
  html += `<section class="card targets"><div class="tg-head"><div><span class="muted">${state.plan.on ? 'Calcolo automatico (senza piano)' : 'Ogni giorno'}</span><b class="big">${fmt(t.kcal)}<small> kcal</small></b></div>
      <button type="button" class="pill-btn" data-p="custom">${t.custom ? 'Personalizzati' : 'Personalizza'}</button></div>
    <div class="tg-macros"><div class="p"><b>${fmt(t.p)} g</b><span>proteine</span></div><div class="c"><b>${fmt(t.c)} g</b><span>carboidrati</span></div><div class="f"><b>${fmt(t.f)} g</b><span>grassi</span></div></div>
    <p class="hint">Metabolismo basale ${fmt(t.bmr)} kcal · consumo stimato ${fmt(t.tdee)} kcal (formula Mifflin-St Jeor, attività “${esc(act[1].toLowerCase())}”). Calcolato sul peso attuale: si aggiorna quando registri il peso.</p></section>`;
  html += `<section class="card rows">
    <button type="button" class="row" data-p="profile"><span>I tuoi dati<small>${p.sex === 'f' ? 'Donna' : 'Uomo'}, ${p.age} anni, ${p.height} cm, ${fmt1(currentWeight())} kg · ${esc(act[1])}</small></span>${I.chev}</button>
    <button type="button" class="row" data-p="foods"><span>I miei alimenti<small>${Object.keys(state.foods).length} salvati · ${Object.keys(BUILTIN).length} di base</small></span>${I.chev}</button>
    ${state.plan.on ? '' : '<button type="button" class="row" data-p="plan"><span>Piano alimentare<small>Spento: giorni di allenamento e riposo, ricarica, sostituzioni</small></span>' + I.chev + '</button>'}
    <button type="button" class="row" data-p="meals"><span>Pasti salvati<small>${state.meals.length ? state.meals.length + (state.meals.length === 1 ? ' pasto' : ' pasti') : 'Nessuno'}</small></span>${I.chev}</button>
  </section>
  <section class="card rows">
    <div class="row static"><span>Tema</span><div class="seg sm" id="theme-seg">${[['dark', 'Scuro'], ['light', 'Chiaro'], ['auto', 'Auto']].map(([k, l]) => `<button type="button" data-theme="${k}" class="${state.settings.theme === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <label class="row static"><span>Cerca online<small>Open Food Facts per ricerca e codici a barre</small></span><input type="checkbox" class="switch" id="s-online" ${state.settings.online ? 'checked' : ''}></label>
    <label class="row static"><span>Vibrazione</span><input type="checkbox" class="switch" id="s-haptics" ${state.settings.haptics ? 'checked' : ''}></label>
  </section>
  <section class="card rows">
    <button type="button" class="row" data-p="export"><span>Salva backup<small>Un file con tutti i tuoi dati</small></span>${I.chev}</button>
    <button type="button" class="row" data-p="import"><span>Ripristina backup<small>Sostituisce i dati di questo telefono</small></span>${I.chev}</button>
  </section>
  <p class="foot">Forma tiene tutto su questo telefono. I dati degli alimenti confezionati vengono da Open Food Facts; quelli di base sono valori medi. I calcoli sono stime: per esigenze mediche chiedi a un professionista.</p>`;
  $('v-profilo').innerHTML = html;
}
$('v-profilo').addEventListener('click', (ev) => {
  const g = ev.target.closest('[data-goal]');
  if (g) {
    state.profile.goal = g.dataset.goal;
    if (g.dataset.goal === 'bulk' && state.profile.pace > 0.5) state.profile.pace = 0.5;
    save(); haptic(1); renderProfilo(); return;
  }
  const pc = ev.target.closest('[data-pace]');
  if (pc) { state.profile.pace = +pc.dataset.pace; save(); haptic(1); renderProfilo(); return; }
  const th = ev.target.closest('[data-theme]');
  if (th) { state.settings.theme = th.dataset.theme; save(); applyTheme(); renderProfilo(); return; }
  const b = ev.target.closest('[data-p]'); if (!b) return;
  const a = b.dataset.p;
  if (a === 'profile') openProfileSheet(false);
  else if (a === 'custom') openCustomSheet();
  else if (a === 'foods') openFoodsList();
  else if (a === 'meals') openMealsList();
  else if (a === 'plan') openPlanSheet();
  else if (a === 'export') exportBackup();
  else if (a === 'import') $('import-file').click();
});
$('v-profilo').addEventListener('change', (ev) => {
  if (ev.target.id === 's-online') { state.settings.online = ev.target.checked; save(); }
  if (ev.target.id === 's-haptics') { state.settings.haptics = ev.target.checked; save(); if (ev.target.checked) haptic(1); }
});

function openProfileSheet(first) {
  const p = state.profile;
  const sh = openSheet({
    title: first ? 'Benvenuto in Forma' : 'I tuoi dati', cls: 'tall',
    body: `<form class="form" id="pf-form" novalidate>
      ${first ? '<p class="hint">Con questi dati calcolo quante calorie ti servono e come dividerle tra proteine, carboidrati e grassi. Puoi cambiare tutto quando vuoi.</p>' : ''}
      <div class="seg" id="pf-sex"><button type="button" data-sex="m" class="${p.sex !== 'f' ? 'on' : ''}">Uomo</button><button type="button" data-sex="f" class="${p.sex === 'f' ? 'on' : ''}">Donna</button></div>
      <div class="grid3">
        <label class="field"><span>Età</span><input name="age" inputmode="numeric" value="${p.age}"></label>
        <label class="field"><span>Altezza (cm)</span><input name="height" inputmode="numeric" value="${p.height}"></label>
        <label class="field"><span>Peso (kg)</span><input name="weight" inputmode="decimal" value="${fmt1(currentWeight())}"></label>
      </div>
      <p class="list-label">Quanto ti muovi</p>
      <div class="radio-list">${ACTIVITY.map(([v, n, d]) => `<label class="radio"><input type="radio" name="act" value="${v}" ${p.activity === v ? 'checked' : ''}><span><b>${n}</b><small>${d}</small></span></label>`).join('')}</div>
      <p class="list-label">Obiettivo</p>
      <div class="seg" id="pf-goal">${Object.entries(GOALS).map(([k, g]) => `<button type="button" data-goal="${k}" class="${p.goal === k ? 'on' : ''}">${g.name}</button>`).join('')}</div>
      <label class="field"><span>Peso obiettivo in kg (facoltativo)</span><input name="target" inputmode="decimal" value="${p.target ? fmt1(p.target) : ''}"></label>
      <div class="sheet-actions"><button type="submit" class="btn primary">${first ? 'Calcola' : 'Salva'}</button></div></form>`,
    onMount(el) {
      const form = el.querySelector('#pf-form');
      let sex = p.sex, goal = p.goal;
      el.querySelector('#pf-sex').addEventListener('click', (e) => { const b = e.target.closest('[data-sex]'); if (!b) return; sex = b.dataset.sex; el.querySelectorAll('#pf-sex button').forEach((x) => x.classList.toggle('on', x === b)); });
      el.querySelector('#pf-goal').addEventListener('click', (e) => { const b = e.target.closest('[data-goal]'); if (!b) return; goal = b.dataset.goal; el.querySelectorAll('#pf-goal button').forEach((x) => x.classList.toggle('on', x === b)); });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const age = num(form.age.value), height = num(form.height.value), weight = num(form.weight.value);
        if (!(age >= 14 && age <= 100)) { form.age.focus(); toast('Età tra 14 e 100'); return; }
        if (!(height >= 120 && height <= 230)) { form.height.focus(); toast('Altezza in centimetri'); return; }
        if (!(weight >= 30 && weight <= 300)) { form.weight.focus(); toast('Peso in kg'); return; }
        const tgt = num(form.target.value);
        Object.assign(p, { sex, goal, age: Math.round(age), height: Math.round(height), activity: +form.act.value || p.activity, target: tgt > 20 && tgt < 400 ? Math.round(tgt * 10) / 10 : null, done: true });
        if (goal === 'bulk' && p.pace > 0.5) p.pace = 0.5;
        if (Math.abs(weight - currentWeight()) >= 0.05 || !state.weights.length) setWeight(dkey(), weight);
        p.weight = currentWeight();
        save(); sh.close(); haptic(1); render();
        const t = calc();
        toast(`Il tuo obiettivo: ${fmt(t.kcal)} kcal al giorno`);
      });
    },
  });
}
function openCustomSheet() {
  const t = calc();
  const c = state.profile.custom;
  const sh = openSheet({
    title: 'Personalizza obiettivi',
    body: `<form class="form" id="cu-form"><p class="hint">Lascia vuoto per usare il calcolo automatico. I carboidrati sono quello che resta delle calorie.</p>
      <div class="grid3">
        <label class="field"><span>Calorie</span><input name="kcal" inputmode="numeric" value="${c.kcal || ''}" placeholder="${t.auto.kcal}"></label>
        <label class="field"><span>Proteine g</span><input name="p" inputmode="numeric" value="${c.p || ''}" placeholder="${t.auto.p}"></label>
        <label class="field"><span>Grassi g</span><input name="f" inputmode="numeric" value="${c.f || ''}" placeholder="${t.auto.f}"></label>
      </div><p class="hint" id="cu-carbs"></p>
      <div class="sheet-actions"><button type="button" class="btn danger-ghost" id="cu-reset">Automatico</button><button type="submit" class="btn primary">Salva</button></div></form>`,
    onMount(el) {
      const form = el.querySelector('#cu-form');
      const val = (name) => { const v = num(form[name].value); return v > 0 ? v : t.auto[name]; };
      const upd = () => { const carbs = Math.round((val('kcal') - val('p') * 4 - val('f') * 9) / 4); el.querySelector('#cu-carbs').textContent = carbs < 0 ? 'Proteine e grassi superano le calorie: abbassali.' : `Carboidrati: ${fmt(carbs)} g`; };
      form.addEventListener('input', upd); upd();
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const g = (n) => { const v = num(form[n].value); return v > 0 ? Math.round(v) : null; };
        state.profile.custom = { kcal: g('kcal'), p: g('p'), f: g('f') };
        save(); sh.close(); render();
      });
      el.querySelector('#cu-reset').addEventListener('click', () => { state.profile.custom = { kcal: null, p: null, f: null }; save(); sh.close(); render(); });
    },
  });
}
function openFoodsList() {
  const sh = openSheet({
    title: 'I miei alimenti', cls: 'tall',
    body: `<div class="search-row"><input type="search" id="fl-q" placeholder="Cerca" autocomplete="off"><button type="button" class="square-btn" id="fl-new" aria-label="Nuovo alimento">${I.plus}</button></div><div id="fl-list" class="pick-list"></div>`,
    onMount(el) {
      const inp = el.querySelector('#fl-q');
      const draw = () => {
        const words = norm(inp.value).split(/\s+/).filter(Boolean);
        const match = (f) => words.every((w) => norm(f.name + ' ' + (f.brand || '')).includes(w));
        const mine = Object.values(state.foods).filter(match).sort((a, b) => a.name.localeCompare(b.name, 'it'));
        const base = Object.values(BUILTIN).filter((f) => !state.foods[f.id] && match(f));
        const row = (f) => `<button type="button" class="pick" data-id="${esc(f.id)}"><span class="pk-name">${esc(f.name)}<small>${esc([f.brand, `P ${fmt1(f.n.p)} · C ${fmt1(f.n.c)} · G ${fmt1(f.n.f)}`].filter(Boolean).join(' · '))}</small></span><span class="pk-meta">${fmt(f.n.kcal)} kcal<small>per 100 g</small></span></button>`;
        el.querySelector('#fl-list').innerHTML = (mine.length ? '<p class="list-label">Salvati da te</p>' + mine.map(row).join('') : '') + (base.length ? '<p class="list-label">Di base (valori medi)</p>' + base.map(row).join('') : '');
      };
      inp.addEventListener('input', draw);
      el.querySelector('#fl-new').addEventListener('click', () => openFoodEditor(null, draw, inp.value.trim()));
      el.querySelector('#fl-list').addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (!b) return; const f = getFood(b.dataset.id); if (f) openFoodEditor(f, () => { draw(); }); });
      draw();
    },
    onClose: () => renderProfilo(),
  });
}
function openMealsList() {
  const sh = openSheet({
    title: 'Pasti salvati', cls: 'tall',
    body: '<div id="ml-list" class="pick-list"></div>',
    onMount(el) {
      const draw = () => {
        el.querySelector('#ml-list').innerHTML = state.meals.length ? state.meals.map((m) => { const v = sumVals(m.items); return `<button type="button" class="pick" data-id="${m.id}"><span class="pk-name">${esc(m.name)}<small>${esc(m.items.map((i) => i.name).join(', '))}</small></span><span class="pk-meta">${fmt(v.kcal)} kcal</span></button>`; }).join('')
          : '<p class="empty">Nessun pasto salvato. Nel diario apri il menu ⋯ di un pasto e scegli “Salva come pasto”.</p>';
      };
      el.querySelector('#ml-list').addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (!b) return; const m = state.meals.find((x) => x.id === b.dataset.id); if (m) openMealEditor(m, draw); });
      draw();
    },
    onClose: () => renderProfilo(),
  });
}

// ---------- backup ----------
async function exportBackup() {
  const data = JSON.stringify({ app: 'forma', version: 1, exported: new Date().toISOString(), data: state }, null, 1);
  const name = `forma-backup-${dkey()}.json`;
  const blob = new Blob([data], { type: 'application/json' });
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Backup Forma' }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Backup salvato');
}
$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const raw = JSON.parse(await file.text());
    const data = raw && raw.app === 'forma' ? raw.data : null;
    if (!data || typeof data !== 'object') { toast('Questo file non è un backup di Forma'); return; }
    const days = Object.keys(data.diary || {}).length, ws = (data.weights || []).length;
    if (!confirm(`Ripristinare il backup? Contiene ${days} giorni di diario e ${ws} pesate. I dati attuali di questo telefono verranno sostituiti.`)) return;
    state = merge(defaults(), data);
    save(); applyTheme(); runTimer(); render();
    toast('Backup ripristinato');
  } catch (err) { toast('File non leggibile'); }
});

// ---------- theme ----------
function applyTheme() {
  const t = state.settings.theme;
  const light = t === 'light' || (t === 'auto' && matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = light ? '#f3f5f1' : '#0e1012';
}
matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (state.settings.theme === 'auto') applyTheme(); });

// a new day while the app stays open: follow it if you were on "today"
let lastToday = dkey();
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  const t = dkey();
  if (t !== lastToday) { if (day === lastToday) day = t; lastToday = t; render(); }
  runTimer();
});

gymInit();
applyTheme();
render();
runTimer();
if (!state.profile.done) setTimeout(() => openProfileSheet(true), 400);

// ---------- offline + updates ----------
// The service worker keeps a copy of the app so it opens without signal. When a new
// version is published it downloads in the background and the app reloads onto it
// (never while you are typing in a field).
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const sw = navigator.serviceWorker;
  const hadController = !!sw.controller;
  let reloading = false;
  sw.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    const go = () => { if (reloading) return; reloading = true; save(); location.reload(); };
    const busy = () => document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if (!busy() && !sheets.length) go();
    else document.addEventListener('visibilitychange', () => { if (document.hidden) go(); }, { once: true });
  });
  window.addEventListener('load', () => {
    sw.register('sw.js').then((reg) => {
      document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
    }).catch(() => {});
  });
}
