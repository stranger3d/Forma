// Minimal exercise animations: a line figure that moves between the start and the
// end position of each exercise. Everything is drawn here (no images), so it works
// offline. Two views: side ('s') and front ('f').
// Loaded before app.js: declarations only.

// angles in degrees: 0 points down, 90 forward (right), 180 up, -90 back (left)
const AL = { T: 42, N: 4, H: 8, U: 25, F: 23, TH: 36, SH: 35, FT: 11, HD: 7 };
const GROUND = 140;
const adir = (a) => { const r = (a * Math.PI) / 180; return [Math.sin(r), Math.cos(r)]; };
const ap = (p, a, l) => { const d = adir(a); return [p[0] + d[0] * l, p[1] + d[1] * l]; };

// side view: root is the ankle (fx, fy) for standing exercises, otherwise the hip (hx, hy)
function sideJoints(p) {
  let hip, knee, ankle;
  if (p.fx != null) {
    ankle = [p.fx, p.fy != null ? p.fy : GROUND - 4];
    knee = ap(ankle, p.sh + 180, AL.SH);
    hip = ap(knee, p.th + 180, AL.TH);
  } else {
    hip = [p.hx, p.hy];
    knee = ap(hip, p.th, AL.TH);
    ankle = ap(knee, p.sh, AL.SH);
  }
  const sh = ap(hip, p.t, AL.T);
  const head = ap(sh, p.t + (p.hd || 0), AL.N + AL.H);
  const elbow = ap(sh, p.ua, AL.U), hand = ap(elbow, p.la, AL.F);
  const j = { hip, knee, ankle, sh, head, elbow, hand, toe: ap(ankle, p.ft != null ? p.ft : 90, AL.FT) };
  if (p.wr != null) j.fist = ap(hand, p.wr, 7);
  if (p.ua2 != null) { j.elbow2 = ap(sh, p.ua2, AL.U); j.hand2 = ap(j.elbow2, p.la2, AL.F); }
  if (p.th2 != null) { j.knee2 = ap(hip, p.th2, AL.TH); j.ankle2 = ap(j.knee2, p.sh2, AL.SH); j.toe2 = ap(j.ankle2, p.ft2 != null ? p.ft2 : 90, AL.FT); }
  return j;
}
// front view: right limbs use the angles as given, left limbs mirrored (or uaL/laL)
function frontJoints(p) {
  const cx = 100, hy = p.hy != null ? p.hy : 70;
  const top = hy - AL.T;
  const j = { hipC: [cx, hy], neck: [cx, top], head: [cx, top - AL.N - AL.H] };
  const side = (s) => {
    const m = (a) => (s > 0 ? a : -a);
    const shp = [cx + s * 15, top + 3];
    const ua = s > 0 ? p.ua : (p.uaL != null ? p.uaL : p.ua);
    const la = s > 0 ? p.la : (p.laL != null ? p.laL : p.la);
    const fs = p.fs != null ? p.fs : 1; // arms pointing at the viewer look shorter
    const elbow = ap(shp, m(ua), AL.U * fs), hand = ap(elbow, m(la), AL.F * fs);
    const hp = [cx + s * 8, hy];
    const thl = p.sit ? 12 : AL.TH;
    const knee = ap(hp, m(p.th || 0), thl), ankle = ap(knee, m(p.sh || 0), AL.SH);
    return { sh: shp, elbow, hand, hip: hp, knee, ankle, toe: [ankle[0] + s * 8, ankle[1]] };
  };
  j.R = side(1); j.L = side(-1);
  return j;
}

const seg = (a, b, cls = 'fg') => `<line class="${cls}" x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}"/>`;
const poly = (pts, cls = 'fg') => `<polyline class="${cls}" points="${pts.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ')}"/>`;
const dot = (c, r, cls) => `<circle class="${cls}" cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${r}"/>`;
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];

function drawSide(p, j) {
  let s = '';
  if (j.knee2) s += poly([j.hip, j.knee2, j.ankle2, j.toe2], 'fg far');
  if (j.elbow2) s += poly([j.sh, j.elbow2, j.hand2], 'fg far');
  s += poly([j.hip, j.knee, j.ankle, j.toe]);
  s += seg(j.hip, j.sh);
  s += dot(j.head, AL.H, 'head');
  s += poly(j.fist ? [j.sh, j.elbow, j.hand, j.fist] : [j.sh, j.elbow, j.hand]);
  return s;
}
function drawFront(p, j) {
  let s = '';
  [j.L, j.R].forEach((q) => { s += poly([q.hip, q.knee, q.ankle, q.toe]); });
  s += poly([j.L.hip, j.L.sh, j.R.sh, j.R.hip], 'fg torso');
  s += seg(j.neck, add(j.neck, [0, -AL.N]));
  s += dot(j.head, AL.H, 'head');
  [j.L, j.R].forEach((q) => { s += poly([q.sh, q.elbow, q.hand]); });
  return s;
}

// props: static ones use the start pose, moving ones follow the hands or feet
function drawProps(spec, j0, j, v) {
  let s = '';
  const hands = v === 'f' ? [j.L.hand, j.R.hand] : [j.hand].concat(j.hand2 ? [j.hand2] : []);
  (spec.props || []).forEach((pr) => {
    const [k, a, b] = Array.isArray(pr) ? pr : [pr];
    if (k === 'bar') hands.slice(0, 1).forEach((h) => { s += dot(h, v === 'f' ? 3 : 8, 'eq'); });
    if (k === 'hbar' && v === 'f') s += seg(add(j.L.hand, [-12, 0]), add(j.R.hand, [12, 0]), 'eq bar');
    if (k === 'db') hands.forEach((h) => { s += seg(add(h, [-6, 0]), add(h, [6, 0]), 'eq db'); });
    if (k === 'handle') hands.forEach((h) => { s += dot(h, 3.5, 'eq'); });
    if (k === 'cable') {
      const anchors = v === 'f' ? [[100 - a, b], [100 + a, b]] : [[a, b]];
      anchors.forEach((an, i) => { const h = v === 'f' ? (i ? j.R.hand : j.L.hand) : j.hand; s += seg(an, h, 'cable') + dot(an, 3.5, 'pulley'); });
    }
    if (k === 'cable1') s += seg([100 + a, b], j.R.hand, 'cable') + dot([100 + a, b], 3.5, 'pulley') + dot(j.R.hand, 3.5, 'eq');
    if (k === 'latbar') { const m = [(j.L.hand[0] + j.R.hand[0]) / 2, (j.L.hand[1] + j.R.hand[1]) / 2]; s += seg([100, 6], m, 'cable') + seg(add(j.L.hand, [-10, 0]), add(j.R.hand, [10, 0]), 'eq bar'); }
    if (k === 'pullup') s += seg([100 - 45, a], [100 + 45, a], 'prop thick');
    if (k === 'back') { // pad under the back, from hip to past the shoulders
      const d = [j0.sh[0] - j0.hip[0], j0.sh[1] - j0.hip[1]]; const L = Math.hypot(d[0], d[1]); const n = [d[0] / L, d[1] / L];
      const off = a != null ? a : 7; const nn = [-n[1] * off * (n[0] < 0 ? -1 : 1), Math.abs(n[0]) * off];
      const p1 = add(j0.hip, nn), p2 = add(add(j0.sh, nn), [n[0] * 12, n[1] * 12]);
      s += seg(p1, p2, 'prop thick') + seg([(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2 + 4], [(p1[0] + p2[0]) / 2, GROUND], 'prop');
    }
    if (k === 'backrest') s += seg(add(j0.hip, [-7, 4]), add(j0.sh, [-7, -6]), 'prop thick');
    if (k === 'seat') s += seg(add(j0.hip, [-10, 7]), add(j0.hip, [18, 7]), 'prop thick') + seg(add(j0.hip, [4, 8]), [j0.hip[0] + 4, GROUND], 'prop');
    if (k === 'benchF') s += `<rect class="prop-fill" x="86" y="${(j0.neck[1] - 16).toFixed(1)}" width="28" height="${(j0.hipC[1] - j0.neck[1] + 26).toFixed(1)}" rx="8"/>`;
    if (k === 'seatF') s += seg([80, j0.hipC[1] + 6], [120, j0.hipC[1] + 6], 'prop thick');
    if (k === 'bench') s += seg([a, b], [a + 50, b], 'prop thick') + seg([a + 8, b], [a + 8, GROUND], 'prop') + seg([a + 42, b], [a + 42, GROUND], 'prop');
    if (k === 'dipbar') s += seg(add(j0.hand, [-12, 1]), add(j0.hand, [10, 1]), 'prop thick') + seg(add(j0.hand, [0, 1]), [j0.hand[0], GROUND], 'prop');
    if (k === 'roller') s += dot(add(j.ankle, [a || 0, b || 0]), 5, 'eq');
    if (k === 'plate') { const t = adir((spec.b.th + spec.b.sh) / 2); s += seg(add(j.toe, [-t[1] * 14, t[0] * 14]), add(j.ankle, [t[1] * 14, -t[0] * 14]), 'eq bar'); }
    if (k === 'step') s += `<rect class="prop-fill" x="${j0.ankle[0] - 4}" y="${GROUND - 10}" width="26" height="10" rx="2"/>`;
    if (k === 'hipbar') s += dot(add(j.hip, [0, -9]), 7, 'eq');
    if (k === 'pad') s += dot(add(j0.hip, [6, 8]), 8, 'prop-fill');
  });
  return s;
}

// base poses
const STAND = { fx: 100, fy: GROUND - 4, th: 0, sh: 0, t: 180, ua: 4, la: 2 };
const FSTAND = { hy: 74, ua: 8, la: 4, th: 6, sh: 0 };
const FSIT = { hy: 88, ua: 8, la: 4, th: 20, sh: 0, sit: true };
const LIE_INC = { hx: 122, hy: 96, t: -122, th: 72, sh: 4, ua: 170, la: 172 };
const LIE_FLAT = { hx: 124, hy: 92, t: -90, th: 62, sh: 0, ua: 180, la: 180, hd: 0 };
const SIT = { hx: 96, hy: 98, t: 185, th: 90, sh: 0, ua: 0, la: 0 };
const X = (base, o) => Object.assign({}, base, o);

const ANIMS = {
  'Panca inclinata bilanciere': { v: 's', a: X(LIE_INC, { ua: 168, la: 170 }), b: X(LIE_INC, { ua: 30, la: 168 }), props: ['back', 'bar'] },
  'Panca inclinata manubri': { v: 's', a: X(LIE_INC, { ua: 168, la: 170 }), b: X(LIE_INC, { ua: 30, la: 168 }), props: ['back', 'db'] },
  'Croci su panca inclinata': { v: 'f', a: X(FSTAND, { ua: -35, la: -35, fs: 0.55 }), b: X(FSTAND, { ua: 92, la: 98 }), props: ['benchF', 'db'] },
  'Chest press': { v: 's', a: X(SIT, { ua: -45, la: 88 }), b: X(SIT, { ua: 88, la: 90 }), props: ['seat', 'backrest', 'handle'] },
  'Panca piana manubri': { v: 's', a: X(LIE_FLAT, {}), b: X(LIE_FLAT, { ua: 8, la: 178 }), props: ['back', 'db'] },
  'Panca piana': { v: 's', a: X(LIE_FLAT, {}), b: X(LIE_FLAT, { ua: 8, la: 178 }), props: ['back', 'bar'] },
  'Croci su panca piana': { v: 'f', a: X(FSTAND, { ua: -35, la: -35, fs: 0.55 }), b: X(FSTAND, { ua: 92, la: 96 }), props: ['benchF', 'db'] },
  'Croci ai cavi': { v: 'f', a: X(FSTAND, { ua: 105, la: 112 }), b: X(FSTAND, { ua: -35, la: -35, fs: 0.6 }), props: [['cable', 82, 22], 'handle'] },
  'Croci ai cavi dal basso': { v: 'f', a: X(FSTAND, { ua: 38, la: 42 }), b: X(FSTAND, { ua: -165, la: -172 }), props: [['cable', 82, 132], 'handle'] },
  'Pectoral machine': { v: 'f', a: X(FSIT, { ua: 92, la: 178 }), b: X(FSIT, { ua: -30, la: 180, fs: 0.6 }), props: ['seatF', 'handle'] },
  'Dip alle parallele': { v: 's', a: { hx: 100, hy: 66, t: 165, th: 12, sh: -75, ua: 2, la: 0 }, b: { hx: 96, hy: 82, t: 155, th: 12, sh: -75, ua: -58, la: 16 }, props: ['dipbar'] },
  'Shoulder press': { v: 'f', a: X(FSIT, { ua: 95, la: 178 }), b: X(FSIT, { ua: 165, la: 176 }), props: ['seatF', 'handle'] },
  'Lento avanti manubri': { v: 'f', a: X(FSIT, { ua: 95, la: 178 }), b: X(FSIT, { ua: 165, la: 176 }), props: ['seatF', 'db'] },
  'Military press': { v: 'f', a: X(FSTAND, { ua: 95, la: 178 }), b: X(FSTAND, { ua: 165, la: 176 }), props: ['hbar'] },
  'Alzate laterali stripping': { v: 'f', a: X(FSTAND, { ua: 12, la: 10 }), b: X(FSTAND, { ua: 88, la: 84 }), props: ['db'] },
  'Alzate laterali': { v: 'f', a: X(FSTAND, { ua: 12, la: 10 }), b: X(FSTAND, { ua: 88, la: 84 }), props: ['db'] },
  'Alzate laterali ai cavi': { v: 'f', a: X(FSTAND, { ua: -12, la: -14, uaL: 10, laL: 6 }), b: X(FSTAND, { ua: 88, la: 84, uaL: 10, laL: 6 }), props: [['cable1', -60, 132]] },
  'Reverse pec deck': { v: 'f', a: X(FSIT, { ua: -35, la: -35, fs: 0.55 }), b: X(FSIT, { ua: 92, la: 92 }), props: ['seatF', 'handle'] },
  'Croci inverse ai cavi alti': { v: 'f', a: X(FSTAND, { ua: -35, la: -35, fs: 0.6 }), b: X(FSTAND, { ua: 100, la: 100 }), props: [['cable', 70, 26], 'handle'] },
  'Face pull': { v: 's', a: X(STAND, { ua: 105, la: 105 }), b: X(STAND, { ua: -100, la: 150 }), props: [['cable', 182, 44], 'handle'] },
  'Curl bilanciere EZ': { v: 's', a: X(STAND, { ua: 6, la: 6 }), b: X(STAND, { ua: 12, la: 162 }), props: ['bar'] },
  'Curl bilanciere': { v: 's', a: X(STAND, { ua: 6, la: 6 }), b: X(STAND, { ua: 12, la: 162 }), props: ['bar'] },
  'Curl manubri': { v: 's', a: X(STAND, { ua: 6, la: 6 }), b: X(STAND, { ua: 12, la: 162 }), props: ['db'] },
  'Curl a martello': { v: 's', a: X(STAND, { ua: 6, la: 6 }), b: X(STAND, { ua: 12, la: 162 }), props: ['db'] },
  'Curl inverso': { v: 's', a: X(STAND, { ua: 6, la: 6 }), b: X(STAND, { ua: 12, la: 158 }), props: ['bar'] },
  'Curl su panca inclinata': { v: 's', a: { hx: 112, hy: 98, t: -148, th: 82, sh: 0, ua: -8, la: -6 }, b: { hx: 112, hy: 98, t: -148, th: 82, sh: 0, ua: -8, la: 150 }, props: ['back', 'db'] },
  'Curl concentrato': { v: 's', a: { hx: 88, hy: 98, t: 142, th: 90, sh: 0, ua: 12, la: 12 }, b: { hx: 88, hy: 98, t: 142, th: 90, sh: 0, ua: 12, la: 168 }, props: ['seat', 'db'] },
  'Dip tricipiti': { v: 's', a: { hx: 100, hy: 66, t: 178, th: 12, sh: -75, ua: 2, la: 0 }, b: { hx: 100, hy: 82, t: 178, th: 12, sh: -75, ua: -72, la: 8 }, props: ['dipbar'] },
  'Dip': { v: 's', a: { hx: 100, hy: 66, t: 172, th: 12, sh: -75, ua: 2, la: 0 }, b: { hx: 100, hy: 82, t: 168, th: 12, sh: -75, ua: -66, la: 10 }, props: ['dipbar'] },
  'Estensioni sopra la testa al cavo': { v: 's', a: { fx: 118, fy: GROUND - 4, th: 8, sh: 0, th2: -28, sh2: -28, t: 168, ua: 158, la: -30 }, b: { fx: 118, fy: GROUND - 4, th: 8, sh: 0, th2: -28, sh2: -28, t: 168, ua: 150, la: 140 }, props: [['cable', 22, 118], 'handle'] },
  'Pushdown ai cavi': { v: 's', a: X(STAND, { t: 172, ua: 6, la: 125 }), b: X(STAND, { t: 172, ua: 6, la: 4 }), props: [['cable', 128, 8], 'handle'] },
  'French press': { v: 's', a: X(LIE_FLAT, { ua: -165, la: -95 }), b: X(LIE_FLAT, { ua: -168, la: -172 }), props: ['back', 'bar'] },
  'Curl polsi': { v: 's', a: { hx: 92, hy: 98, t: 160, th: 90, sh: 0, ua: 40, la: 92, wr: 40 }, b: { hx: 92, hy: 98, t: 160, th: 90, sh: 0, ua: 40, la: 92, wr: 150 }, props: ['seat'] },
  'Lat machine': { v: 'f', a: X(FSIT, { ua: 158, la: 168 }), b: X(FSIT, { ua: 42, la: 150 }), props: ['seatF', 'latbar'] },
  'Pulley basso': { v: 's', a: { hx: 78, hy: 112, t: 162, th: 88, sh: 92, ua: 92, la: 92 }, b: { hx: 78, hy: 112, t: 184, th: 88, sh: 92, ua: -62, la: 92 }, props: [['cable', 192, 118], 'handle'] },
  'Rematore manubrio': { v: 's', a: { fx: 70, fy: GROUND - 4, th: 6, sh: 0, t: 100, ua: 2, la: 0, ua2: 12, la2: 6 }, b: { fx: 70, fy: GROUND - 4, th: 6, sh: 0, t: 100, ua: -72, la: 6, ua2: 12, la2: 6 }, props: ['db', ['bench', 104, 116]] },
  'Rematore bilanciere': { v: 's', a: { fx: 100, fy: GROUND - 4, th: 18, sh: -12, t: 115, ua: 2, la: 0 }, b: { fx: 100, fy: GROUND - 4, th: 18, sh: -12, t: 115, ua: -70, la: 6 }, props: ['bar'] },
  'Trazioni': { v: 'f', a: X(FSTAND, { hy: 92, ua: 162, la: 172, th: 4, sh: -2 }), b: X(FSTAND, { hy: 66, ua: 48, la: 158, th: 4, sh: -2 }), props: [['pullup', 10]] },
  'Pulldown braccia tese': { v: 's', a: X(STAND, { t: 165, ua: 140, la: 142 }), b: X(STAND, { t: 165, ua: 8, la: 8 }), props: [['cable', 172, 10], 'handle'] },
  'Hyperextension': { v: 's', a: { hx: 104, hy: 84, t: 28, th: -58, sh: -58, ua: 70, la: -150, ft: -150 }, b: { hx: 104, hy: 84, t: 118, th: -58, sh: -58, ua: 150, la: -60, ft: -150 }, props: ['pad', ['roller', -4, -5]] },
  'Squat': { v: 's', a: X(STAND, { ua: -40, la: 150 }), b: X(STAND, { th: 82, sh: -28, t: 142, ua: -75, la: 115 }), props: ['bar'] },
  'Stacco rumeno': { v: 's', a: X(STAND, {}), b: X(STAND, { th: 14, sh: -6, t: 98, ua: 0, la: 0 }), props: ['bar'] },
  'Stacco da terra': { v: 's', a: X(STAND, { th: 62, sh: -22, t: 120, ua: 0, la: 0 }), b: X(STAND, {}), props: ['bar'] },
  'Affondi bulgari': { v: 's', a: { fx: 122, fy: GROUND - 4, th: 8, sh: 0, th2: -22, sh2: -118, ft2: -170, t: 180, ua: 2, la: 0 }, b: { fx: 122, fy: GROUND - 4, th: 76, sh: -10, th2: -2, sh2: -98, ft2: -170, t: 176, ua: 2, la: 0 }, props: ['db', ['bench', 18, 102]] },
  'Affondi': { v: 's', a: { fx: 124, fy: GROUND - 4, th: 16, sh: 0, th2: -22, sh2: -22, ft2: 90, t: 180, ua: 2, la: 0 }, b: { fx: 124, fy: GROUND - 4, th: 80, sh: -8, th2: -4, sh2: -86, ft2: 150, t: 178, ua: 2, la: 0 }, props: ['db'] },
  'Leg press': { v: 's', a: { hx: 64, hy: 104, t: -128, th: 142, sh: 66, ua: 40, la: 40 }, b: { hx: 64, hy: 104, t: -128, th: 112, sh: 112, ua: 40, la: 40 }, props: ['back', 'plate'] },
  'Leg extension': { v: 's', a: X(SIT, { ua: 10, la: 10 }), b: X(SIT, { sh: 88, ua: 10, la: 10 }), props: ['seat', 'backrest', ['roller', 4, -4]] },
  'Leg curl': { v: 's', a: { hx: 104, hy: 96, t: -92, th: 92, sh: 92, ua: -150, la: -100, ft: 180 }, b: { hx: 104, hy: 96, t: -92, th: 92, sh: -178, ua: -150, la: -100, ft: -90 }, props: [['back', -8], ['roller', 0, -6]] },
  'Hip thrust': { v: 's', a: { fx: 152, fy: GROUND - 4, th: 132, sh: -6, t: -118, ua: 60, la: 120 }, b: { fx: 152, fy: GROUND - 4, th: 96, sh: -2, t: -96, ua: 70, la: 120 }, props: ['hipbar', ['bench', 34, 104]] },
  'Calf raise': { v: 's', a: X(STAND, { fy: GROUND - 14, ft: 76 }), b: X(STAND, { fy: GROUND - 24, ft: 140 }), props: ['step'] },
  'Plank': { v: 's', a: { hx: 104, hy: 116, t: -84, th: 96, sh: 96, ua: 0, la: -90, ft: 10 }, b: { hx: 104, hy: 112, t: -86, th: 98, sh: 98, ua: 0, la: -90, ft: 10 }, props: [] },
  'Crunch ai cavi': { v: 's', a: { hx: 112, hy: 98, t: 172, th: 2, sh: -92, ft: -90, ua: 150, la: -168 }, b: { hx: 112, hy: 98, t: 62, th: 2, sh: -92, ft: -90, ua: 30, la: 150 }, props: [['cable', 88, 8]] },
  'Crunch': { v: 's', a: { hx: 112, hy: 128, t: -90, th: 135, sh: 30, ua: -120, la: -170 }, b: { hx: 112, hy: 128, t: -140, th: 135, sh: 30, ua: -160, la: 160 }, props: [] },
};

function hasAnim(name) { return !!ANIMS[name]; }
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
function lerpPose(a, b, k) {
  const out = {};
  const keys = new Set(Object.keys(a).concat(Object.keys(b)));
  keys.forEach((key) => {
    const x = a[key] != null ? a[key] : (key === 'fs' ? 1 : b[key]);
    const y = b[key] != null ? b[key] : (key === 'fs' ? 1 : a[key]);
    out[key] = typeof x === 'number' && typeof y === 'number' ? x + (y - x) * k : x;
  });
  return out;
}
function frameSvg(spec, k) {
  const p = lerpPose(spec.a, spec.b, k);
  if (spec.v === 'f') {
    const j0 = frontJoints(spec.a), j = frontJoints(p);
    return drawProps(spec, j0, j, 'f') + drawFront(p, j);
  }
  const j0 = sideJoints(spec.a), j = sideJoints(p);
  return drawProps(spec, j0, j, 's') + drawSide(p, j);
}
// markup for an exercise animation (empty when there is none)
function exerciseAnim(name, cls = '') {
  const spec = ANIMS[name];
  if (!spec) return '';
  return `<div class="ex-anim g-${exInfo(name).group} ${cls}" data-anim="${esc(name)}"><svg viewBox="0 -24 200 174" role="img" aria-label="Animazione: ${esc(name)}">
    <line class="ground" x1="10" y1="${GROUND}" x2="190" y2="${GROUND}"/><g class="fig">${frameSvg(spec, 0)}</g></svg></div>`;
}
// Loop at the real rhythm of the lift: concentric (effort) fast, hold at contraction,
// eccentric (lowering) slow, short pause in stretch. Seconds per kind:
// main 2-0-1, secondary 2-1-1, isolation 3-1-1 (lowering - hold - lifting).
const RHYTHM = {
  main: { con: 1, top: 0.4, ecc: 2, bottom: 0.3 },
  acc: { con: 1, top: 1, ecc: 2, bottom: 0.3 },
  iso: { con: 1, top: 1, ecc: 3, bottom: 0.3 },
};
// exercises drawn from the top (A) to the bottom (B): there A→B is the lowering
const ECC_AB = new Set(['Panca inclinata bilanciere', 'Panca inclinata manubri', 'Panca piana manubri', 'Panca piana', 'Dip alle parallele', 'Dip tricipiti', 'Dip',
  'Squat', 'Stacco rumeno', 'Affondi bulgari', 'Affondi']);
function animK(t, name) {
  const kind = typeof exInfo === 'function' ? exInfo(name).kind : 'acc';
  const r = RHYTHM[kind] || RHYTHM.acc;
  const tot = r.con + r.top + r.ecc + r.bottom;
  let x = (t / 1000) % tot;
  // c = 0 stretched, 1 contracted
  let c;
  if (x < r.con) c = ease(x / r.con);
  else if ((x -= r.con) < r.top) c = 1;
  else if ((x -= r.top) < r.ecc) c = 1 - ease(x / r.ecc);
  else c = 0;
  return ECC_AB.has(name) ? 1 - c : c;
}
function startAnims(root) {
  const boxes = Array.from(root.querySelectorAll('[data-anim]'));
  if (!boxes.length) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t0 = performance.now();
  const step = (now) => {
    if (!boxes.some((b) => b.isConnected)) return;
    boxes.forEach((b) => {
      const spec = ANIMS[b.dataset.anim]; if (!spec) return;
      const g = b.querySelector('.fig');
      g.innerHTML = frameSvg(spec, still ? 1 : animK(now - t0, b.dataset.anim));
    });
    if (!still) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
