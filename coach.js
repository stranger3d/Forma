// Coach: the things a personal trainer tracks around the sessions.
// - mesocycle of 4-6 weeks with heavier and lighter weeks and a deload at the end,
//   lined up with the refeed day of the meal plan
// - target reps in reserve (RIR) and lifting tempo
// - warm-up sets for the first heavy exercise
// - personal records (estimated 1RM), load history and charts
// - weekly hard sets per muscle group, stalls and recovery warnings
// Loaded before app.js: declarations only.

// ---------- mesocycle ----------
const WEEK_PLANS = {
  4: [
    { name: 'Base', rir: 3, note: 'Carichi comodi, tecnica pulita' },
    { name: 'Carico', rir: 2, note: 'Sali di peso dove puoi' },
    { name: 'Intenso', rir: 1, note: 'Ultima serie vicino al cedimento' },
    { name: 'Scarico', rir: 4, deload: true, note: 'Metà serie, carichi −15%: recuperi e consolidi' },
  ],
  5: [
    { name: 'Base', rir: 3, note: 'Carichi comodi, tecnica pulita' },
    { name: 'Carico', rir: 2, note: 'Sali di peso dove puoi' },
    { name: 'Intenso', rir: 1, note: 'Ultima serie vicino al cedimento' },
    { name: 'Picco', rir: 0, peak: true, note: 'Ultima serie a cedimento tecnico sui principali' },
    { name: 'Scarico', rir: 4, deload: true, note: 'Metà serie, carichi −15%: recuperi e consolidi' },
  ],
  6: [
    { name: 'Base', rir: 3, note: 'Carichi comodi, tecnica pulita' },
    { name: 'Carico', rir: 2, note: 'Sali di peso dove puoi' },
    { name: 'Carico +', rir: 2, note: 'Una ripetizione in più della settimana scorsa' },
    { name: 'Intenso', rir: 1, note: 'Ultima serie vicino al cedimento' },
    { name: 'Picco', rir: 0, peak: true, note: 'Ultima serie a cedimento tecnico sui principali' },
    { name: 'Scarico', rir: 4, deload: true, note: 'Metà serie, carichi −15%: recuperi e consolidi' },
  ],
};
const TEMPO = { main: '2-0-1', acc: '2-1-1', iso: '3-1-1' };
const TEMPO_TXT = { main: '2 s in discesa, su esplosivo', acc: '2 s giù, 1 s di pausa, su', iso: '3 s giù, 1 s di contrazione' };

function cycleStart() {
  const c = state.gym.cfg.cycle;
  if (!c.start) { c.start = weekStart(dkey()); save(); }
  return c.start;
}
function weekInfo(k = dkey()) {
  const c = state.gym.cfg.cycle;
  const len = WEEK_PLANS[c.len] ? c.len : 5;
  const start = c.start || weekStart(k);
  const w = Math.floor(daysBetween(start, weekStart(k)) / 7);
  const i = ((w % len) + len) % len;
  return Object.assign({ i, len }, WEEK_PLANS[len][i]);
}
function deloadSets(n) { return Math.max(2, Math.ceil(n / 2)); }
const roundKg = (kg) => Math.round(kg / 2.5) * 2.5;

// ---------- records ----------
const e1rm = (kg, reps) => (kg > 0 && reps > 0 ? kg * (1 + Math.min(reps, 15) / 30) : 0);
function setE1rm(s) { return e1rm(num(s.kg), num(s.reps)); }
// per finished session of an exercise: {date, e1rm, top, sets}
function exHistory(name, exceptId) {
  const out = [];
  state.gym.workouts.forEach((w) => {
    if (w.id === exceptId || (!w.end && w.id !== state.gym.active)) return;
    const ex = w.ex.find((e) => e.name === name); if (!ex) return;
    const done = ex.sets.filter((s) => s.done);
    if (!done.length) return;
    out.push({ date: w.date, e1rm: Math.max(...done.map(setE1rm)), top: Math.max(...done.map((s) => num(s.kg) || 0)), sets: done, deload: !!(w.week && w.week.deload) });
  });
  return out;
}
function bestE1rm(name, exceptId) { return exHistory(name, exceptId).reduce((a, h) => Math.max(a, h.e1rm), 0); }
// a done set that beats the best estimated 1RM of every earlier session
function isRecord(name, s, w) {
  const v = setE1rm(s);
  if (!(v > 0)) return false;
  const before = bestE1rm(name, w.id);
  const here = w.ex.filter((e) => e.name === name).flatMap((e) => e.sets.filter((x) => x.done && x !== s)).reduce((a, x) => Math.max(a, setE1rm(x)), 0);
  return before > 0 && v > before + 0.01 && v > here;
}
// no progress on the estimated 1RM in the last 3 sessions (deload weeks left out)
function stalled(name) {
  const h = exHistory(name).filter((x) => !x.deload);
  if (h.length < 4) return false;
  const last3 = h.slice(-3), before = h.slice(0, -3);
  const best = Math.max(...before.map((x) => x.e1rm));
  return Math.max(...last3.map((x) => x.e1rm)) <= best * 1.005;
}

// ---------- warm-up ----------
function warmupText(name, kg) {
  if (exInfo(name).kind !== 'main' || !(kg > 0)) return '';
  const r = (p) => fmt1(Math.max(2.5, roundKg(kg * p)));
  return `Riscaldamento: 10 rip. a ${r(0.5)} kg · 5 a ${r(0.7)} kg · 2 a ${r(0.85)} kg, poi le serie vere.`;
}

// ---------- weekly volume ----------
const VOL_RANGE = [10, 20]; // hard sets a week per muscle group
function weeklyVolume(k = dkey()) {
  const from = addDays(k, -6);
  const out = {}; GROUPS.forEach((g) => { out[g.id] = 0; });
  state.gym.workouts.forEach((w) => {
    if (!w.end || w.date < from || w.date > k) return;
    w.ex.forEach((e) => { const g = exInfo(e.name).group; if (out[g] != null) out[g] += e.sets.filter((s) => s.done).length; });
  });
  return out;
}

// ---------- warnings ----------
// muscles that a session also tires: training these the day after is not ideal
const SECONDARY = { petto: ['spalle', 'braccia'], schiena: ['braccia'], spalle: ['petto', 'braccia'], gambe: [], braccia: [] };
function coachAlerts(sel) {
  const out = [];
  const wk = weekInfo();
  const yest = state.gym.workouts.filter((w) => w.end && w.group && w.date === addDays(dkey(), -1)).map((w) => w.group);
  yest.forEach((g) => {
    if ((SECONDARY[g] || []).includes(sel)) out.push({ tone: 'warn', text: `Ieri hai fatto ${GROUPS.find((x) => x.id === g).name.toLowerCase()}: anche ${GROUPS.find((x) => x.id === sel).name.toLowerCase()} ha lavorato. Se ti senti stanco, scegli un altro gruppo.` });
  });
  if (wk.deload) out.push({ tone: 'info', text: 'Settimana di scarico: metà serie e carichi −15%. È anche la settimana giusta per la ricarica alimentare.' });
  const names = new Set();
  (state.gym.cfg.templates[sel] || []).forEach((b) => b.ex.forEach((e) => { names.add(e.name); if (e.alt) names.add(e.alt); }));
  Array.from(names).filter((n) => exInfo(n).kind === 'main' && stalled(n)).forEach((n) => {
    out.push({ tone: 'warn', text: `${n}: fermo da 3 sedute. Scendi del 10% e risali con +1 ripetizione a settimana, oppure passa alla variante.` });
  });
  return out;
}

// ---------- progress sheet ----------
function sparkline(vals, w = 120, h = 34) {
  if (vals.length < 2) return '';
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const pts = vals.map((v, i) => `${((i / (vals.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 3 - ((v - lo) / span) * (h - 6)).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts}"/></svg>`;
}
function openProgress() {
  const names = Array.from(new Set(state.gym.workouts.filter((w) => w.end).flatMap((w) => w.ex.map((e) => e.name))));
  const rows = names.map((n) => ({ n, h: exHistory(n) })).filter((r) => r.h.length).sort((a, b) => (b.h[b.h.length - 1].date > a.h[a.h.length - 1].date ? 1 : -1));
  const vol = weeklyVolume();
  const sh = openSheet({
    title: 'Progressi', cls: 'tall',
    body: `<p class="list-label first">Serie allenanti negli ultimi 7 giorni</p>
      <div class="vol">${GROUPS.map((g) => { const v = vol[g.id]; const st = v < VOL_RANGE[0] ? 'low' : v > VOL_RANGE[1] ? 'high' : 'ok'; return `<div class="vol-row g-${g.id} ${st}"><span><i class="gdot"></i>${g.name}</span><div class="vbar"><i style="transform:scaleX(${clamp(v / 24, 0, 1)})"></i><em style="left:${(VOL_RANGE[0] / 24) * 100}%"></em><em style="left:${(VOL_RANGE[1] / 24) * 100}%"></em></div><b>${v}</b></div>`; }).join('')}</div>
      <p class="hint">Zona utile 10-20 serie a settimana per gruppo. Con un gruppo ogni 5 giorni sei nella parte bassa: va bene in definizione, conta di più la qualità delle serie.</p>
      <p class="list-label">Record (massimale stimato)</p>
      <div class="pick-list">${rows.map((r) => { const best = Math.max(...r.h.map((x) => x.e1rm)); const last = r.h[r.h.length - 1]; return `<button type="button" class="pick g-${exInfo(r.n).group}" data-ex="${esc(r.n)}"><span class="pk-name">${esc(r.n)}<small>ultima: ${esc(setsText(last.sets))}${stalled(r.n) ? ' · ferma' : ''}</small></span>${sparkline(r.h.map((x) => x.e1rm))}<span class="pk-meta rec-best">${best > 0 ? fmt1(best) + ' kg' : '–'}<small>1RM stimato</small></span></button>`; }).join('') || '<p class="empty">Allenati e segna le serie: qui vedi record e andamento dei carichi.</p>'}</div>`,
    onMount(el) {
      el.addEventListener('click', (e) => { const b = e.target.closest('[data-ex]'); if (b) openExerciseHistory(b.dataset.ex); });
    },
  });
  return sh;
}
function openExerciseHistory(name) {
  const h = exHistory(name);
  const best = Math.max(0, ...h.map((x) => x.e1rm));
  openSheet({
    title: name, cls: 'tall',
    body: `${h.length >= 2 ? `<div class="hist-chart g-${exInfo(name).group}">${sparkline(h.map((x) => x.e1rm), 330, 110)}</div><p class="hint">Massimale stimato (formula di Epley) seduta per seduta.</p>` : ''}
      <p class="list-label">Record: ${best > 0 ? fmt1(best) + ' kg stimati' : '–'}</p>
      <ul class="wo-list">${h.slice().reverse().map((x) => `<li><div class="hist-row"><span><b>${esc(dayLabel(x.date))}</b>${x.deload ? ' <small class="muted">scarico</small>' : ''}<small>${esc(setsText(x.sets))}</small></span><span class="wo-meta">${fmt1(x.e1rm)}<small>1RM stim.</small></span></div></li>`).join('')}</ul>`,
  });
}

// ---------- consistency: streak, heatmaps, coach analysis ----------
// a day is "in target" when something is logged and kcal are 85-103% of that day's target
function dayHit(k) {
  const list = state.diary[k];
  if (!list || !list.length) return null;
  const t = targetsFor(k).kcal;
  const f = t > 0 ? sumVals(list).kcal / t : 0;
  return f >= 0.85 && f <= 1.03;
}
function dietStreak() {
  const today = dkey();
  let k = dayHit(today) ? today : addDays(today, -1), cur = 0;
  while (dayHit(k)) { cur++; k = addDays(k, -1); }
  let best = 0, run = 0;
  for (let i = 365; i >= 0; i--) { if (dayHit(addDays(today, -i))) { run++; best = Math.max(best, run); } else run = 0; }
  return { cur, best: Math.max(best, cur) };
}
function trainedOn(k) { const w = state.gym.workouts.find((x) => x.end && x.date === k); return w ? (w.group || 'altro') : null; }
const FLAME = '<svg class="flame" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 2c1 3.2-1.6 4.9-3 7-1.2 1.8-2 3.4-2 5.4A5 5 0 0 0 12 22a5 5 0 0 0 5-5.3c0-2.5-1.4-4-2.3-5.3-.3 1.4-1 2.3-2 2.6.6-2.9.4-6.4-.7-12z"/></svg>';
const SPARK = '<svg class="sparkle" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M12 2.5c.6 4.9 2.6 6.9 7.5 7.5-4.9.6-6.9 2.6-7.5 7.5-.6-4.9-2.6-6.9-7.5-7.5 4.9-.6 6.9-2.6 7.5-7.5z"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.1 8.4 18.7 7z"/></svg>';
// Oggi: flame + this week's days (check when in target, dot when trained)
function streakCard() {
  const s = dietStreak();
  const today = dkey(), ws = weekStart(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const circles = days.map((k, i) => {
    const h = dayHit(k), g = trainedOn(k);
    const st = h ? 'hit' : k === today ? 'today' : k > today ? 'future' : h === false ? 'miss' : 'blank';
    return `<span class="sd ${st}"><i>${h ? CHECK : ''}</i><small>${'LMMGVSD'[i]}</small>${g ? `<b class="g-${g}"></b>` : '<b class="none"></b>'}</span>`;
  }).join('');
  return `<section class="card streak-card ${s.cur ? 'on' : ''}">
    <div class="sk-top">${FLAME}<div><span class="sk-label">Serie in target</span><b>${s.cur}<small> ${s.cur === 1 ? 'giorno' : 'giorni'}</small></b></div>
      <span class="sk-best">record<br><b>${s.best}</b></span></div>
    <div class="sk-week">${circles}</div></section>`;
}
// Peso: last 12 weeks, one square per day, columns are weeks
function heatGrid(cell, cls = 'heat') {
  const today = dkey(), start = addDays(weekStart(today), -77);
  let html = '';
  for (let w = 0; w < 12; w++) for (let d = 0; d < 7; d++) {
    const k = addDays(start, w * 7 + d);
    html += k > today ? '<i class="fut"></i>' : cell(k);
  }
  return `<div class="${cls}">${html}</div>`;
}
function consistencyCard() {
  const today = dkey();
  let logged = 0, hits = 0, sessions = 0;
  for (let i = 0; i < 84; i++) { const k = addDays(today, -i); const h = dayHit(k); if (h != null) { logged++; if (h) hits++; } if (trainedOn(k)) sessions++; }
  const pct = logged ? Math.round((hits / logged) * 100) : 0;
  return `<section class="card cons-card"><h3>Costanza <small class="muted">· ultime 12 settimane</small></h3>
    <div class="cons-row"><span>Dieta in target</span><b>${pct}<small>%</small></b></div>
    ${heatGrid((k) => { const h = dayHit(k); return `<i class="${h ? 'hit' : h === false ? 'miss' : ''}"></i>`; })}
    <div class="cons-row"><span>Allenamenti</span><b>${sessions}</b></div>
    ${heatGrid((k) => { const g = trainedOn(k); if (!g) return '<i></i>'; const n = state.gym.workouts.filter((w) => w.end && w.date === k).reduce((a, w) => a + w.ex.reduce((b, e) => b + e.sets.filter((s) => s.done).length, 0), 0); return `<i class="gym g-${g}" style="--s:${(0.45 + 0.55 * clamp(n / 20, 0, 1)).toFixed(2)}"></i>`; }, 'bub')}
    <p class="hint">Più grande il cerchio, più serie quel giorno.</p>
    <p class="legend">${GROUPS.map((g) => `<span><i class="gdot g-${g.id}"></i>${g.name}</span>`).join(' ')}</p></section>`;
}
// short notes for the coach analysis card
function coachNotes() {
  const out = [];
  const today = dkey();
  let logged = 0, hits = 0;
  for (let i = 1; i <= 14; i++) { const h = dayHit(addDays(today, -i)); if (h != null) { logged++; if (h) hits++; } }
  if (logged >= 3) out.push(`Negli ultimi 14 giorni sei stato in target <b>${hits} giorni su ${logged}</b> segnati.`);
  const s = dietStreak();
  if (s.cur >= 3) out.push(`Serie di <b>${s.cur} giorni</b> in target${s.cur >= s.best ? ': è il tuo record' : ''}.`);
  if (state.plan.on && refeedStatus(today).due) out.push('È il momento di una <b>ricarica</b>: segnala oggi o domani in Oggi.');
  const stuck = Array.from(new Set(state.gym.workouts.filter((w) => w.end).flatMap((w) => w.ex.map((e) => e.name)))).filter((n) => exInfo(n).kind === 'main' && stalled(n));
  if (stuck.length) out.push(`Fermi da 3 sedute: <b>${stuck.map(esc).join(', ')}</b>. Scendi del 10% e risali, o passa alla variante.`);
  const done = state.gym.workouts.filter((w) => w.end && w.date >= addDays(today, -6)).length;
  if (state.gym.workouts.some((w) => w.end)) out.push(`Questa settimana: <b>${done} ${done === 1 ? 'allenamento' : 'allenamenti'}</b>.`);
  return out;
}
