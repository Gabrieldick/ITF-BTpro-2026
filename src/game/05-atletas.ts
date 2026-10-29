// @ts-nocheck
// corpo dos atletas (pele contínua), raquetes e jogadores
import './04-poses';
import * as THREE from 'three';
import { V3, clamp, lerp, rand, smooth } from './00-base';
import { canvasTex, mat } from './02-render';
// ---------- Atletas ----------
const SHADOW_TEX = canvasTex(64, 64, (x) => { const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.65)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); }, false);
function capsuleGeo(rTop, rBot, len, seg) {
  const pts = []; const n = 6;
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * rBot, -len + Math.sin(a) * rBot)); }
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * rTop, Math.sin(a) * rTop)); }
  return new THREE.LatheGeometry(pts, seg || 14);
}
function latheGeo(profile, seg, zScale) {
  const g = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), seg || 20);
  g.scale(1, 1, zScale || 1); return g;
}
// raquete de beach tennis: face rígida com furos de verdade
// raquete de beach tennis: cabeça em gota que afina num pescoço vazado, face rígida com furos
function racketOutline() {
  // proporções medidas nas fotos: cabeça em ovo, mais larga no terço de cima, laterais afinando quase retas até um pescoço longo
  const R = [[.02, -.205], [.03, -.183], [.052, -.148], [.082, -.114], [.116, -.066], [.14, -.011], [.145, .044], [.137, .085], [.11, .126], [.06, .152], [0, .16]];
  const k = .82, sy = y => y > -.12 ? -.12 + (y + .12) * 1.1 : y; // mais estreita e com a cabeça mais comprida
  const right = R.map(([x, y]) => new THREE.Vector2(x * k, sy(y)));
  const left = R.slice(0, -1).reverse().map(([x, y]) => new THREE.Vector2(-x * k, sy(y)));
  const s = new THREE.Shape();
  s.moveTo(-.02 * k, -.205); s.lineTo(.02 * k, -.205);
  s.splineThru(right.slice(1).concat(left));
  return s;
}
const RACKET_EDGE_PTS = racketOutline().getPoints(6);
// padrão de furos e aberturas do pescoço de cada modelo
const RK_POLY = RACKET_EDGE_PTS;
function rkInside(x, y) { let c = false; for (let i = 0, j = RK_POLY.length - 1; i < RK_POLY.length; j = i++) { const a = RK_POLY[i], b = RK_POLY[j]; if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; }
function rkEdge(x, y) { let m = 9; for (let i = 0; i < RK_POLY.length - 1; i++) { const a = RK_POLY[i], b = RK_POLY[i + 1]; const dx = b.x - a.x, dy = b.y - a.y; const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1); m = Math.min(m, Math.hypot(x - a.x - dx * t, y - a.y - dy * t)); } return m; }
// pontos ao longo do contorno, deslocados para dentro
function rkRing(inset, step, yMin) {
  const out = []; let acc = 0;
  for (let i = 0; i < RK_POLY.length - 1; i++) {
    const a = RK_POLY[i], b = RK_POLY[i + 1]; const len = Math.hypot(b.x - a.x, b.y - a.y);
    for (let d = 0; d < len; d += .002) {
      acc += .002; if (acc < step) continue; acc = 0;
      const x = a.x + (b.x - a.x) * d / len, y = a.y + (b.y - a.y) * d / len;
      if (y < yMin) continue;
      const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len; // normal para dentro (contorno anti-horário)
      out.push([x + nx * inset, y + ny * inset]);
    }
  }
  return out.filter(([x, y]) => rkInside(x, y) && rkEdge(x, y) > inset * .8);
}
const inTri = (x, y, cx, cy, sz) => { const h = sz * 1.78; const top = cy + sz, bot = cy - sz * .78; if (y > top || y < bot) return false; const half = (top - y) / h * sz * 1.08 * 2; return Math.abs(x - cx) < half; };
const RACKET_HOLES = {
  supercarbon: { r: .0076, pts: (() => { const p = []; [-1, 1].forEach(sd => { for (let i = 0; i < 6; i++) p.push([sd * .093, .093 - i * .026]); for (let i = 0; i < 7; i++) p.push([sd * .067, .117 - i * .026]); }); return p; })(),
    throat: [[[-.05, -.112], [-.017, -.116], [-.033, -.15]], [[-.012, -.121], [.012, -.121], [0, -.158]], [[.05, -.112], [.017, -.116], [.033, -.15]]] },
  medusa: { r: .0074, pts: (() => { const p = []; let row = 0; for (let y = -.068; y < .15; y += .031, row++) for (let x = -.12 + (row % 2 ? .017 : 0); x < .12; x += .034) if (rkInside(x, y) && rkEdge(x, y) > .021) p.push([x, y]); return p; })(),
    throat: [[[-.02, -.142], [.02, -.142], [0, -.178]]] },
  proteo: { r: .006, pts: rkRing(.02, .027, -.085).concat(rkRing(.045, .03, -.06).filter(([x, y]) => !inTri(x, y, 0, .005, .08))),
    throat: [[[-.011, -.121], [-.05, -.112], [-.017, -.171]], [[.011, -.121], [.05, -.112], [.017, -.171]]] },
  kronos: { r: .006, pts: rkRing(.019, .025, -.085).concat(rkRing(.042, .027, -.07).filter(([x, y]) => !inTri(x, y, 0, .005, .085))),
    throat: [[[-.018, -.12], [.018, -.12], [0, -.15]]] },
};
const RACKET_GEOS = {};
function racketGeo(key) {
  if (RACKET_GEOS[key]) return RACKET_GEOS[key];
  const cfg = RACKET_HOLES[key] || RACKET_HOLES[(RACKETS[key] || {}).holes] || RACKET_HOLES.proteo;
  const s = racketOutline();
  cfg.pts.forEach(([x, y]) => { const h = new THREE.Path(); h.absarc(x, y, cfg.r, 0, Math.PI * 2, true); s.holes.push(h); });
  cfg.throat.forEach(tri => {
    const h = new THREE.Path(); const c = tri.reduce((a, p) => [a[0] + p[0] / 3, a[1] + p[1] / 3], [0, 0]);
    // cantos arredondados: cada vértice puxado um pouco para o centro
    const pt = i => { const p = tri[(i + 3) % 3]; return [p[0] + (c[0] - p[0]) * .12, p[1] + (c[1] - p[1]) * .12]; };
    const mid = (i, j) => { const a = pt(i), b = pt(j); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
    const m0 = mid(0, 1); h.moveTo(m0[0], m0[1]);
    for (let i = 1; i <= 3; i++) { const v = pt(i), m = mid(i, i + 1); h.quadraticCurveTo(v[0], v[1], m[0], m[1]); }
    s.holes.push(h);
  });
  const g = new THREE.ExtrudeGeometry(s, { depth: .016, bevelEnabled: true, bevelThickness: .0035, bevelSize: .003, bevelSegments: 3, curveSegments: 10 });
  g.translate(0, 0, -.008);
  return (RACKET_GEOS[key] = g);
}
// protetor de aro em volta da cabeça
const BUMPER_GEO = (() => {
  const pts = RACKET_EDGE_PTS.filter(p => p.y > -.07).map(p => new V3(p.x, p.y, 0));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, .0072, 8, false);
})();
const STRAP_GEO = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(0, .004, 0), new V3(.02, .034, .004), new V3(.009, .074, .009), new V3(-.012, .069, .006), new V3(-.021, .03, 0), new V3(0, .004, 0)]), 30, .0024, 6, false);
const GRIP_TEX = canvasTex(64, 256, (x, w, h) => {
  x.fillStyle = '#dcdcdc'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#8a8a8a'; x.lineWidth = 5;
  for (let i = -h; i < h * 2; i += 22) { x.beginPath(); x.moveTo(0, i); x.lineTo(w, i + 34); x.stroke(); }
  for (let i = 0; i < 900; i++) { x.fillStyle = 'rgba(0,0,0,' + rand(.03, .1) + ')'; x.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
});
GRIP_TEX.wrapS = GRIP_TEX.wrapT = THREE.RepeatWrapping; GRIP_TEX.repeat.set(1, 3);
function carbonBase(x, w, h, base, alpha) {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  x.globalAlpha = alpha;
  for (let i = 0; i < w; i += 6) for (let j = 0; j < h; j += 6) { x.fillStyle = ((i + j) / 6) % 2 ? '#000' : '#fff'; x.fillRect(i, j, 6, 3); }
  x.globalAlpha = 1;
}
function triPath(x, cx, cy, sz) { x.beginPath(); x.moveTo(cx, cy - sz); x.lineTo(cx + sz * 1.08, cy + sz * .78); x.lineTo(cx - sz * 1.08, cy + sz * .78); x.closePath(); }
function zigzag(x, y, w, amp, n, color, lw) {
  x.strokeStyle = color; x.lineWidth = lw; x.lineJoin = 'miter'; x.beginPath();
  for (let i = 0; i <= n; i++) { const px = i * w / n, py = y + (i % 2 ? amp : -amp) * .5; i ? x.lineTo(px, py) : x.moveTo(px, py); }
  x.stroke();
}
function hatch(x, color, step, lw) { x.save(); x.clip(); x.strokeStyle = color; x.lineWidth = lw; for (let i = -300; i < 300; i += step) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 256, 256); x.stroke(); x.beginPath(); x.moveTo(i + 256, 0); x.lineTo(i, 256); x.stroke(); } x.restore(); }
function modelName(x, text, y, color, size) { x.fillStyle = color; x.font = 'bold ' + size + 'px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, y); }
const RACKETS = {
  medusa: { edge: '#e7dcc6', grip: '#17181a', throat: '#e7dcc6', draw(x, w, h) {
    carbonBase(x, w, h, '#15110e', .07);
    const gr = x.createRadialGradient(w / 2, h * .42, 10, w / 2, h * .42, 150); gr.addColorStop(0, 'rgba(110,70,50,.14)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#caa56b'; x.lineWidth = 2.5; for (let k = 0; k < 6; k++) { triPath(x, w / 2, h * .44, 22 + k * 13); x.stroke(); }
    x.strokeStyle = 'rgba(202,165,107,.55)'; x.lineWidth = 1.5; for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; x.beginPath(); x.moveTo(w / 2 + Math.cos(t) * 100, h * .44 + Math.sin(t) * 100); x.lineTo(w / 2 + Math.cos(t) * 118, h * .44 + Math.sin(t) * 118); x.stroke(); }
    x.fillStyle = '#e9dfca'; x.fillRect(0, h * .73, w, h * .27);
    zigzag(x, h * .745, w, 16, 16, '#b8915a', 4);
    modelName(x, 'MEDUSA', h * .775, '#8a6a3c', 12);
  } },
  kronos: { edge: '#3a2a1f', grip: '#121314', throat: '#2a1d16', draw(x, w, h) {
    carbonBase(x, w, h, '#1c140f', .06);
    for (let i = 0; i < 260; i++) { x.fillStyle = 'rgba(226,131,46,' + rand(.15, .5) + ')'; x.fillRect(Math.random() * w, Math.random() * h * .7, 1.5, 1.5); }
    triPath(x, w / 2, h * .44, 78); x.fillStyle = '#6f6a65'; x.fill(); triPath(x, w / 2, h * .44, 78); hatch(x, 'rgba(30,30,30,.55)', 6, 1.2);
    triPath(x, w / 2, h * .48, 40); x.fillStyle = '#2a1d16'; x.fill();
    triPath(x, w / 2, h * .44, 78); x.strokeStyle = '#b9b3ac'; x.lineWidth = 3; x.stroke();
    x.fillStyle = '#1b130e'; x.fillRect(0, h * .72, w, h * .28);
    zigzag(x, h * .735, w, 18, 16, '#e2832e', 5);
    modelName(x, 'KRONOS', h * .795, '#d9d2c8', 12);
  } },
  proteo: { edge: '#0a1838', grip: '#121314', throat: '#0c1d45', draw(x, w, h) {
    const gr = x.createRadialGradient(w * .45, h * .35, 20, w / 2, h * .5, 190); gr.addColorStop(0, '#3c78e0'); gr.addColorStop(.6, '#1d4cb0'); gr.addColorStop(1, '#0b2462'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
    x.globalAlpha = .08; for (let i = 0; i < h; i += 3) { x.fillStyle = i % 6 ? '#fff' : '#000'; x.fillRect(0, i, w, 1); } x.globalAlpha = 1;
    triPath(x, w / 2, h * .42, 80); x.fillStyle = '#151a22'; x.fill(); triPath(x, w / 2, h * .42, 80); hatch(x, 'rgba(90,100,120,.5)', 7, 1);
    triPath(x, w / 2, h * .47, 40); x.fillStyle = '#1d4cb0'; x.fill();
    x.fillStyle = '#0d1a3c'; x.fillRect(0, h * .72, w, h * .28);
    zigzag(x, h * .735, w, 18, 14, '#f4f6f8', 4);
    modelName(x, 'PROTEO', h * .795, '#cfe0ff', 12);
  } },
  basica: { edge: '#6b5a44', grip: '#2a2420', throat: '#5a4a38', draw(x, w, h) {
    x.fillStyle = '#9a8a70'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { x.strokeStyle = 'rgba(70,50,30,' + rand(.08, .2) + ')'; x.lineWidth = rand(1, 3); x.beginPath(); x.moveTo(0, i * 10 + rand(-3, 3)); x.bezierCurveTo(w * .3, i * 10 + rand(-6, 6), w * .7, i * 10 + rand(-6, 6), w, i * 10); x.stroke(); }
    x.fillStyle = '#2f6f4f'; x.fillRect(0, h * .74, w, h * .1);
    modelName(x, 'AREIA', h * .79, '#f4ead2', 13);
  } },
  fibra: { edge: '#e9eef3', grip: '#1d2a3a', throat: '#d7e1ea', draw(x, w, h) {
    x.fillStyle = '#e8eef4'; x.fillRect(0, 0, w, h);
    x.globalAlpha = .18; for (let i = -h; i < w; i += 9) { x.strokeStyle = '#7a8ea4'; x.lineWidth = 1; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke(); } x.globalAlpha = 1;
    x.fillStyle = '#1f6fd1'; x.beginPath(); x.moveTo(0, h * .3); x.lineTo(w, h * .18); x.lineTo(w, h * .26); x.lineTo(0, h * .38); x.fill();
    x.fillStyle = '#ffb11f'; x.beginPath(); x.moveTo(0, h * .42); x.lineTo(w, h * .3); x.lineTo(w, h * .33); x.lineTo(0, h * .45); x.fill();
    modelName(x, 'SPEED', h * .79, '#1f6fd1', 14);
  } },
  supercarbon: { edge: '#f4f5f6', grip: '#f2f2ef', throat: '#e9ecee', draw(x, w, h) {
    const gr = x.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#e4e7ea'); gr.addColorStop(1, '#b9c0c6'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
    x.globalAlpha = .12; for (let i = -h; i < w; i += 7) { x.strokeStyle = '#ffffff'; x.lineWidth = 2; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke(); } x.globalAlpha = 1;
    carbonBase(x, 0, 0, '#000', 0);
    const cx = w / 2, cy = h * .48;
    for (let k = 0; k < 5; k++) {
      x.strokeStyle = k % 2 ? '#0f4fb0' : '#0f9fd6'; x.lineWidth = 10 - k;
      x.beginPath(); x.ellipse(cx, cy, 34 + k * 17, 22 + k * 11, -.35, Math.PI * (.9 + k * .1), Math.PI * (2.2 + k * .1)); x.stroke();
    }
    x.fillStyle = '#0f8fd0'; x.beginPath(); x.ellipse(cx, cy, 26, 17, -.35, 0, Math.PI * 2); x.fill();
    for (let i = 0; i < 160; i++) { x.fillStyle = 'rgba(255,255,255,' + rand(.3, .9) + ')'; const a = Math.random() * Math.PI * 2, r = Math.random(); x.fillRect(cx + Math.cos(a) * 24 * r, cy + Math.sin(a) * 15 * r, 1.5, 1.5); }
    modelName(x, 'SUPERCARBON', h * .2, '#163a7a', 12);
  } },
};
// visuais das outras raquetes: fundo, cores de destaque, padrão e nome
function mkRacketDraw(c) {
  return (x, w, h) => {
    if (c.carbon) carbonBase(x, w, h, c.bg, .08); else { x.fillStyle = c.bg; x.fillRect(0, 0, w, h); }
    x.lineWidth = 6;
    if (c.pattern === 'stripes') { x.fillStyle = c.a1; for (let i = 0; i < 4; i++) x.fillRect(0, h * (.16 + i * .12), w, h * .04); }
    else if (c.pattern === 'waves') { x.strokeStyle = c.a1; for (let k = 0; k < 5; k++) { x.lineWidth = 5 - k * .6; x.beginPath(); for (let i = 0; i <= w; i += 6) { const y = h * (.2 + k * .1) + Math.sin(i / 22 + k) * 9; i ? x.lineTo(i, y) : x.moveTo(i, y); } x.stroke(); } }
    else if (c.pattern === 'diag') { x.fillStyle = c.a1; x.beginPath(); x.moveTo(0, h * .55); x.lineTo(w, h * .12); x.lineTo(w, h * .28); x.lineTo(0, h * .7); x.fill(); if (c.a2) { x.fillStyle = c.a2; x.beginPath(); x.moveTo(0, h * .62); x.lineTo(w, h * .33); x.lineTo(w, h * .37); x.lineTo(0, h * .66); x.fill(); } }
    else if (c.pattern === 'chevron') { x.strokeStyle = c.a1; x.lineWidth = 9; for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(w * .12, h * (.2 + k * .12)); x.lineTo(w / 2, h * (.32 + k * .12)); x.lineTo(w * .88, h * (.2 + k * .12)); x.stroke(); } if (c.a2) { x.strokeStyle = c.a2; x.lineWidth = 3; x.beginPath(); x.moveTo(w * .12, h * .56); x.lineTo(w / 2, h * .66); x.lineTo(w * .88, h * .56); x.stroke(); } }
    else if (c.pattern === 'rings') { x.strokeStyle = c.a1; for (let k = 0; k < 5; k++) { x.lineWidth = 2 + (k % 2) * 2; x.beginPath(); x.arc(w / 2, h * .42, 18 + k * 18, 0, Math.PI * 2); x.stroke(); } }
    else if (c.pattern === 'tri') { x.strokeStyle = c.a1; x.lineWidth = 3; for (let k = 0; k < 5; k++) { triPath(x, w / 2, h * .42, 20 + k * 15); x.stroke(); } }
    x.fillStyle = c.band || c.a1; x.fillRect(0, h * .74, w, h * .1);
    modelName(x, c.label, h * .79, c.labelColor || c.bg, c.label.length > 9 ? 11 : 13);
  };
}
const RACKET_STYLES = {
  tropic: { bg: '#2fb6a7', a1: '#ffe14d', pattern: 'stripes', label: 'TROPIC', labelColor: '#1d4f49', edge: '#ffe14d', holes: 'proteo' },
  brisa: { bg: '#9fd8ff', a1: '#ffffff', pattern: 'waves', label: 'BRISA JR', labelColor: '#2457c5', edge: '#ffffff', holes: 'medusa' },
  mare: { bg: '#0e3b5c', a1: '#4fd1c5', pattern: 'waves', label: 'MARÉ', edge: '#4fd1c5', holes: 'medusa' },
  coral: { bg: '#ff6f61', a1: '#2b1d14', a2: '#fbf6ea', pattern: 'diag', label: 'CORAL', labelColor: '#fbf6ea', band: '#2b1d14', edge: '#2b1d14', holes: 'kronos' },
  duna: { bg: '#e8c48a', a1: '#8a5a2b', pattern: 'waves', label: 'DUNA', labelColor: '#fbf6ea', edge: '#8a5a2b', holes: 'medusa' },
  tufao: { bg: '#151515', a1: '#ff2d2d', a2: '#fbf6ea', pattern: 'chevron', label: 'TUFÃO', labelColor: '#151515', carbon: true, edge: '#ff2d2d', holes: 'kronos' },
  atol: { bg: '#0b7a83', a1: '#fbf6ea', pattern: 'rings', label: 'ATOL', edge: '#fbf6ea', holes: 'medusa' },
  ventosul: { bg: '#f4f1ea', a1: '#2457c5', a2: '#ffb11f', pattern: 'diag', label: 'VENTO SUL', labelColor: '#f4f1ea', edge: '#2457c5', holes: 'proteo' },
  recife: { bg: '#3b1f5c', a1: '#ffb11f', pattern: 'tri', label: 'RECIFE', edge: '#ffb11f', holes: 'proteo' },
  tsunami: { bg: '#06263f', a1: '#18a0fb', pattern: 'waves', label: 'TSUNAMI', carbon: true, edge: '#18a0fb', holes: 'kronos' },
  eclipse: { bg: '#101010', a1: '#c9a24a', pattern: 'rings', label: 'ECLIPSE 3K', labelColor: '#101010', carbon: true, edge: '#c9a24a', holes: 'supercarbon' },
  areia: { bg: '#f2e4c4', a1: '#c99a5b', pattern: 'waves', label: 'AREIA', labelColor: '#5a3f1e', edge: '#c99a5b', holes: 'proteo' },
  vela: { bg: '#fbf6ea', a1: '#ff5a1f', pattern: 'diag', label: 'VELA PRO', labelColor: '#fbf6ea', edge: '#ff5a1f', holes: 'proteo' },
  maresia: { bg: '#123c4a', a1: '#7fd6db', pattern: 'rings', label: 'MARESIA', edge: '#7fd6db', holes: 'medusa' },
  farol: { bg: '#b3121b', a1: '#fbf6ea', a2: '#151515', pattern: 'chevron', label: 'FAROL', labelColor: '#b3121b', band: '#151515', edge: '#fbf6ea', holes: 'kronos' },
  corsario: { bg: '#1b1b2f', a1: '#e94560', a2: '#fbf6ea', pattern: 'tri', label: 'CORSÁRIO', carbon: true, edge: '#e94560', holes: 'proteo' },
  abismo: { bg: '#04121f', a1: '#3fd17a', pattern: 'rings', label: 'ABISMO', carbon: true, edge: '#3fd17a', holes: 'medusa' },
  trovao: { bg: '#141414', a1: '#ffd23f', a2: '#9b5cff', pattern: 'chevron', label: 'TROVÃO X', labelColor: '#141414', carbon: true, band: '#9b5cff', edge: '#9b5cff', holes: 'kronos' },
  aurora: { bg: '#f4f1ff', a1: '#9b5cff', a2: '#18a0fb', pattern: 'waves', label: 'AURORA', labelColor: '#f4f1ff', carbon: true, edge: '#9b5cff', holes: 'supercarbon' },
  zenite: { bg: '#f7f7f7', a1: '#e8a317', a2: '#0f2436', pattern: 'chevron', label: 'ZÊNITE', labelColor: '#f7f7f7', band: '#0f2436', edge: '#e8a317', holes: 'supercarbon' },
  // raquete assinatura (marca pessoal do modo carreira)
  assinatura: { bg: '#0b0b0b', a1: '#ff6a00', a2: '#ffd23f', pattern: 'diag', label: 'SIGNATURE', labelColor: '#0b0b0b', carbon: true, band: '#ff6a00', edge: '#ffd23f', holes: 'supercarbon' },
};
Object.entries(RACKET_STYLES).forEach(([k, c]) => { RACKETS[k] = { edge: c.edge, grip: '#141516', throat: c.edge, holes: c.holes, draw: mkRacketDraw(c) }; });
// arte das raquetes de ponta: inspirada nos modelos mais usados do circuito 2025/2026 (cores, grafismos, posição dos
// elementos e marca escrita quase igual, uma letra trocada). Coordenadas: desenho 256×256, centro da cabeça ~(128, 105),
// pescoço ~(128, 200)
const ell = (x, cx, cy, rx, ry) => { x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); };
function bigX(x, w, cx = 128, cy = 104, sp = 92, arm = 26) { // X grande (dois braços)
  x.beginPath();
  for (const s of [1, -1]) { const ax = cx - sp * s, ay = cy - sp * .95, bx = cx + sp * .8 * s, by = cy + sp * .82, L = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / L * arm / 2, ny = (bx - ax) / L * arm / 2;
    x.moveTo(ax + nx, ay + ny); x.lineTo(bx + nx, by + ny); x.lineTo(bx - nx, by - ny); x.lineTo(ax - nx, ay - ny); x.closePath(); }
}
function wordmark(x, txt, y, col, size, italic, font) { x.save(); x.fillStyle = col; x.font = (italic ? 'italic ' : '') + '900 ' + size + 'px ' + (font || 'Arial Black, Arial, sans-serif'); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 128, y); x.restore(); }
function glitter(x, w, h, col, n, a = .6) { for (let i = 0; i < n; i++) { x.fillStyle = col; x.globalAlpha = Math.random() * a; x.fillRect(Math.random() * w, Math.random() * h, 1.3, 1.3); } x.globalAlpha = 1; }
function rimLine(x, col, lw, inset = 8) { x.strokeStyle = col; x.lineWidth = lw; ell(x, 128, 100, 126 - inset, 92 - inset); x.stroke(); }
function star4(x, cx, cy, r, ri) { x.beginPath(); for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4, rr = i % 2 ? ri : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); }
const RK_ART = {
  // NG17 (Nox, Gianotti): branca perolada, X em xadrez de carbono cinza com contorno dourado, filete dourado na borda
  zenite: { edge: '#f1eee8', grip: '#f4f2ee', throat: '#f1eee8', draw(x, w, h) {
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#fbfaf7'); g.addColorStop(1, '#e7e3dc'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.save(); bigX(x); x.clip(); for (let i = 0; i < w; i += 9) for (let j = 0; j < h; j += 9) { x.fillStyle = ['#5d6066', '#7c8087', '#9a9ea5', '#484a4f'][(i * 7 + j * 3) / 9 % 4 | 0]; x.fillRect(i, j, 9, 9); } x.restore();
    bigX(x); x.strokeStyle = '#c9a24a'; x.lineWidth = 2.2; x.stroke(); rimLine(x, '#c9a24a', 1.6);
    wordmark(x, 'NUX', 182, '#1b1b1d', 15); wordmark(x, 'NG17 LUXURY', 197, '#b38b36', 8);
  } },
  // V10 (Nox, Casadei): coral com brilho, X branco com contorno prata
  atol: { edge: '#e04a4c', grip: '#c8323a', throat: '#f4f0ee', gloss: true, draw(x, w, h) {
    x.fillStyle = '#e8534f'; x.fillRect(0, 0, w, h); glitter(x, w, h, '#ffd9d4', 900, .7);
    bigX(x); x.fillStyle = '#fbfbfb'; x.fill(); bigX(x); x.strokeStyle = '#c4c8cf'; x.lineWidth = 2; x.stroke(); rimLine(x, '#ffd3cf', 1.4);
    wordmark(x, 'NUX', 182, '#ffffff', 15); wordmark(x, 'V10', 197, '#ffffff', 10);
  } },
  // Nova 87 (Nox, Kudinova/Semenova): perolada, X mais claro com contorno rosa coral
  recife: { edge: '#f4f0ec', grip: '#f6f3f0', throat: '#f07f86', draw(x, w, h) {
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#f8f5f1'); g.addColorStop(1, '#e9e3dd'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    bigX(x); x.fillStyle = '#fefdfc'; x.fill(); bigX(x); x.strokeStyle = '#ef7f86'; x.lineWidth = 2.2; x.stroke(); rimLine(x, '#ef9aa0', 1.4);
    wordmark(x, 'NUX', 180, '#2a2a2c', 14); wordmark(x, 'NOVA 87', 195, '#e86e78', 9);
  } },
  // Rebel (Heroe's, Spoto): preta fosca, disco sol amarelo→laranja cruzado por um X preto, asa roxa embaixo
  aurora: { edge: '#d9d9de', grip: '#f2f2f2', throat: '#8a3fb8', rough: true, draw(x, w, h) {
    carbonBase(x, w, h, '#0e0e10', .05); glitter(x, w, h, '#555', 700, .5);
    const g = x.createRadialGradient(128, 98, 6, 128, 98, 64); g.addColorStop(0, '#fff3a0'); g.addColorStop(.45, '#ffc21a'); g.addColorStop(1, '#ff6a10'); ell(x, 128, 98, 64, 64); x.fillStyle = g; x.fill();
    x.strokeStyle = '#d4782a'; x.lineWidth = 1.2; for (const [a, b, c, d] of [[20, 10, 236, 190], [236, 10, 20, 190]]) { x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); }
    bigX(x, w, 128, 98, 58, 16); x.fillStyle = '#0e0e10'; x.fill();
    x.fillStyle = '#ff4b1f'; x.fillRect(40, 168, 176, 13); wordmark(x, "HERUE'S", 175, '#111', 10);
    x.fillStyle = '#9b3fd0'; x.beginPath(); x.moveTo(30, 186); x.lineTo(128, 214); x.lineTo(226, 186); x.lineTo(226, 198); x.lineTo(128, 232); x.lineTo(30, 198); x.closePath(); x.fill();
    x.strokeStyle = '#d58cff'; x.lineWidth = 1.5; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(70, 196 + i * 5); x.lineTo(128, 214 + i * 5); x.lineTo(186, 196 + i * 5); x.stroke(); }
  } },
  // Fierce (Heroe's, Cappelletti): preta, disco branco, X preto com pontas ciano, aro laranja-vermelho
  eclipse: { edge: '#ff4a1f', grip: '#131315', throat: '#7d8288', rough: true, draw(x, w, h) {
    carbonBase(x, w, h, '#101012', .05);
    ell(x, 128, 98, 62, 62); x.fillStyle = '#f7f7f5'; x.fill();
    bigX(x, w, 128, 98, 58, 16); x.fillStyle = '#101012'; x.fill();
    x.fillStyle = '#35c8f0'; for (const [cx, cy, a] of [[46, 22, .8], [210, 22, 2.35], [62, 176, -.8], [194, 176, -2.35]]) { x.save(); x.translate(cx, cy); x.rotate(a); x.beginPath(); x.moveTo(0, -5); x.lineTo(26, 0); x.lineTo(0, 5); x.closePath(); x.fill(); x.restore(); }
    wordmark(x, "HERUE'S", 186, '#c47a45', 12); wordmark(x, 'FIERCE', 199, '#c47a45', 8);
  } },
  // Starlight (Heroe's, Gasparri/Valentini): branca, disco azul-céu, estrela de 4 pontas fina com pontas furta-cor
  proteo: { edge: '#f4f6f8', grip: '#8fe0c8', throat: '#cfe9f7', draw(x, w, h) {
    x.fillStyle = '#f9fafb'; x.fillRect(0, 0, w, h);
    ell(x, 128, 98, 60, 60); x.fillStyle = '#7cc6ee'; x.fill();
    star4(x, 128, 98, 96, 9); x.fillStyle = '#1f3a5c'; x.fill();
    for (const [cx, cy] of [[128, 8], [128, 188], [36, 98], [220, 98]]) { const g = x.createLinearGradient(cx - 12, cy - 12, cx + 12, cy + 12); g.addColorStop(0, '#ff7ad9'); g.addColorStop(.33, '#7ae1ff'); g.addColorStop(.66, '#c8ff7a'); g.addColorStop(1, '#ffd97a'); ell(x, cx, cy, 7, 7); x.fillStyle = g; x.fill(); }
    x.strokeStyle = '#3d8fd8'; x.lineWidth = 2; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(84, 168 + i * 7); x.lineTo(128, 186 + i * 7); x.lineTo(172, 168 + i * 7); x.stroke(); }
    wordmark(x, "HERUE'S", 160, '#1f3a5c', 10);
  } },
  // Gladiator (Kona, Baran): preta fosca em carbono, grande "K" em chevron com degradê neon amarelo→laranja→magenta
  kronos: { edge: '#111214', grip: '#121314', throat: '#5ec8ff', rough: true, draw(x, w, h) {
    carbonBase(x, w, h, '#121214', .07);
    x.save(); x.beginPath(); x.rect(0, 0, 60, h); x.rect(196, 0, 60, h); x.clip(); x.strokeStyle = 'rgba(160,160,170,.18)'; x.lineWidth = 2; for (let i = -200; i < 300; i += 9) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 200, 200); x.stroke(); } x.restore();
    const g = x.createLinearGradient(70, 40, 190, 170); g.addColorStop(0, '#ffe23a'); g.addColorStop(.5, '#ff7a1a'); g.addColorStop(1, '#ff2fa0'); x.strokeStyle = g; x.lineWidth = 11; x.lineJoin = 'miter';
    x.beginPath(); x.moveTo(178, 34); x.lineTo(118, 100); x.lineTo(178, 166); x.stroke(); x.beginPath(); x.moveTo(92, 34); x.lineTo(92, 166); x.stroke();
    x.strokeStyle = '#121214'; x.lineWidth = 3.5; x.beginPath(); x.moveTo(178, 34); x.lineTo(118, 100); x.lineTo(178, 166); x.stroke(); x.beginPath(); x.moveTo(92, 34); x.lineTo(92, 166); x.stroke();
    wordmark(x, 'KUNA', 186, '#e8e8ea', 13); wordmark(x, 'GLADIATOR', 199, '#ff7a1a', 8);
  } },
  // Poison Bee (Ama Sport, Cariani): branca coberta de losangos cinza, abelha/ferrão estilizado no centro, faixa preta
  supercarbon: { edge: '#f4f5f6', grip: '#b08a5e', throat: '#f4f5f6', rough: true, draw(x, w, h) {
    x.fillStyle = '#f7f7f7'; x.fillRect(0, 0, w, h);
    for (let j = 0; j < 180; j += 11) for (let i = 0; i < w; i += 11) { const d = Math.hypot(i - 128, (j - 95) * 1.2); if (d > 120 + Math.random() * 20) continue; x.fillStyle = ['#c9cbcf', '#aeb1b6', '#d9dbde', '#93969c'][Math.random() * 4 | 0]; x.save(); x.translate(i + (j / 11 % 2) * 5.5, j); x.rotate(Math.PI / 4); x.fillRect(-4, -4, 8, 8); x.restore(); }
    x.fillStyle = '#111'; x.beginPath(); x.moveTo(128, 50); x.bezierCurveTo(176, 62, 182, 120, 128, 150); x.bezierCurveTo(150, 116, 146, 80, 128, 50); x.fill();
    x.beginPath(); x.moveTo(128, 50); x.bezierCurveTo(80, 62, 74, 120, 128, 150); x.bezierCurveTo(106, 116, 110, 80, 128, 50); x.fillStyle = '#fff'; x.fill(); x.strokeStyle = '#111'; x.lineWidth = 2; x.stroke();
    x.fillStyle = '#111'; x.beginPath(); x.moveTo(128, 150); x.lineTo(122, 166); x.lineTo(134, 166); x.closePath(); x.fill();
    x.fillStyle = '#121212'; x.save(); x.transform(1, 0, -.25, 1, 20, 0); x.fillRect(40, 174, 180, 16); x.restore(); wordmark(x, 'ANA SPORT', 182, '#fff', 10, true);
  } },
  // Medusa 6K (Ama Sport, Bazzi): preta em carbono 6K, ondas de pontinhos dourados, triângulo dourado, faixa champanhe
  medusa: { edge: '#d9c08a', grip: '#17181a', throat: '#d9c08a', draw(x, w, h) {
    carbonBase(x, w, h, '#121110', .08);
    x.fillStyle = '#d6b46c'; for (let r = 30; r < 140; r += 13) { const n = Math.floor(r * .6); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, wob = Math.sin(a * 6 + r * .1) * 3; ell(x, 128 + Math.cos(a) * (r + wob), 100 + Math.sin(a) * (r + wob) * .9, 1.3, 1.3); x.fill(); } }
    triPath(x, 128, 100, 30); x.strokeStyle = '#e2c27a'; x.lineWidth = 3; x.stroke();
    x.fillStyle = '#e6d3a6'; x.fillRect(0, 176, w, 80); zigzag(x, 176, w, 12, 20, '#b8915a', 3);
    wordmark(x, 'MEDUSA 6K', 194, '#6e5530', 11);
  } },
  // Bruxo (Zand, Antomi Ramos): branca com coroinhas bege, glifo em seta (bronze com brilho + carbono xadrez)
  ventosul: { edge: '#f6f4f0', grip: '#f4f2ee', throat: '#f6f4f0', rough: true, draw(x, w, h) {
    x.fillStyle = '#faf8f4'; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(190,170,130,.35)'; for (let j = 8; j < 200; j += 18) for (let i = 6; i < w; i += 20) { const ox = (j / 18 % 2) * 10; x.beginPath(); x.moveTo(i + ox, j + 6); x.lineTo(i + ox + 2, j); x.lineTo(i + ox + 5, j + 4); x.lineTo(i + ox + 8, j); x.lineTo(i + ox + 10, j + 6); x.closePath(); x.fill(); }
    x.save(); x.beginPath(); x.moveTo(128, 34); x.lineTo(70, 168); x.lineTo(96, 168); x.lineTo(128, 92); x.closePath(); x.clip(); const g = x.createLinearGradient(70, 34, 128, 168); g.addColorStop(0, '#a8682f'); g.addColorStop(1, '#d9a050'); x.fillStyle = g; x.fillRect(0, 0, w, h); glitter(x, w, h, '#ffe6a0', 500, .9); x.restore();
    x.save(); x.beginPath(); x.moveTo(128, 34); x.lineTo(186, 168); x.lineTo(160, 168); x.lineTo(128, 92); x.closePath(); x.clip(); for (let i = 0; i < w; i += 6) for (let j = 0; j < h; j += 6) { x.fillStyle = ((i + j) / 6) % 2 ? '#1a1a1a' : '#3a3a3a'; x.fillRect(i, j, 6, 6); } x.restore();
    x.fillStyle = '#b07a3e'; x.beginPath(); x.moveTo(80, 182); x.lineTo(128, 172); x.lineTo(176, 182); x.lineTo(128, 192); x.closePath(); x.fill();
    wordmark(x, 'ZANB', 202, '#1a1a1a', 11);
  } },
  // Vitória III (Mormaii, Marchezini): branca, onda roxo→magenta→vermelho à direita com malha fina, letreiro dourado vertical
  mare: { edge: '#f2e7c9', grip: '#f4f4f2', throat: '#e0303a', gloss: true, draw(x, w, h) {
    x.fillStyle = '#fbfbfa'; x.fillRect(0, 0, w, h);
    x.save(); x.beginPath(); x.moveTo(256, 0); x.lineTo(170, 0); x.bezierCurveTo(120, 60, 230, 120, 150, 210); x.lineTo(256, 230); x.closePath(); x.clip();
    const g = x.createLinearGradient(160, 0, 230, 220); g.addColorStop(0, '#6a2ccf'); g.addColorStop(.5, '#e0309a'); g.addColorStop(1, '#e8283a'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(255,255,255,.22)'; x.lineWidth = .8; for (let i = -10; i < 30; i++) { x.beginPath(); x.moveTo(140 + i * 6, 0); x.bezierCurveTo(100 + i * 6, 70, 210 + i * 6, 130, 130 + i * 6, 230); x.stroke(); } x.restore();
    x.save(); x.translate(110, 100); x.rotate(-Math.PI / 2); x.fillStyle = '#c9a24a'; x.font = '900 22px Arial Black, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('VITÓRIA', 0, 0); x.restore();
    wordmark(x, 'MORMAJI', 186, '#c9a24a', 11); rimLine(x, '#d6b45c', 1.2);
  } },
  // Prime Attack (Drop Shot): preta com favos escuros, estrela de 4 pontas verde-limão
  tufao: { edge: '#8a8d92', grip: '#141516', throat: '#b7f000', rough: true, draw(x, w, h) {
    x.fillStyle = '#121314'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(80,84,90,.45)'; x.lineWidth = 1; for (let j = 0; j < h; j += 13) for (let i = 0; i < w; i += 15) { const cx = i + (j / 13 % 2) * 7.5, cy = j; x.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; x.lineTo(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7); } x.closePath(); x.stroke(); }
    star4(x, 128, 100, 70, 20); x.fillStyle = '#b7f000'; x.fill(); star4(x, 128, 100, 42, 12); x.fillStyle = '#121314'; x.fill();
    wordmark(x, 'DROP SHUT', 184, '#b7f000', 11); wordmark(x, 'PRIME ATTACK', 198, '#cfd2d6', 7);
  } },
  // Predator (Shark): preta com estilhaços geométricos brancos hachurados, aro vermelho
  trovao: { edge: '#d8262c', grip: '#141516', throat: '#d8262c', draw(x, w, h) {
    carbonBase(x, w, h, '#101113', .06);
    x.save(); x.beginPath(); x.moveTo(60, 40); x.lineTo(176, 40); x.lineTo(200, 90); x.lineTo(120, 110); x.lineTo(150, 170); x.lineTo(96, 170); x.lineTo(70, 100); x.closePath(); x.clip(); x.strokeStyle = '#f2f2f2'; x.lineWidth = 2.2; for (let i = -200; i < 400; i += 7) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i - 160, 220); x.stroke(); } x.restore();
    x.fillStyle = '#d8262c'; x.fillRect(0, 178, w, 10); x.fillStyle = '#8a3fb8'; x.fillRect(0, 188, w, 3);
    wordmark(x, 'SHANK', 200, '#f2f2f2', 11);
  } },
  // Precision (Vision): preta com anéis orbitais brancos, furos com aro azul, aro branco
  abismo: { edge: '#f4f6f8', grip: '#f4f6f8', throat: '#f4f6f8', draw(x, w, h) {
    x.fillStyle = '#0d0e10'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#f2f4f6'; for (let k = 0; k < 4; k++) { x.lineWidth = 3 - k * .5; x.beginPath(); x.ellipse(128, 100, 70 - k * 8, 26 + k * 6, k * .7 - .5, 0, Math.PI * 2); x.stroke(); }
    ell(x, 128, 100, 10, 10); x.fillStyle = '#2f7fff'; x.fill();
    x.strokeStyle = '#2f7fff'; x.lineWidth = 2; rimLine(x, '#2f7fff', 1.5, 12);
    wordmark(x, 'VIZION', 186, '#f2f4f6', 12);
  } },
  // World Cup (Adidas): azul royal com linhas topográficas verdes, taça dourada no centro
  tsunami: { edge: '#1c3fae', grip: '#f4f4f4', throat: '#ffd23f', draw(x, w, h) {
    x.fillStyle = '#1c3fae'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(70,200,120,.55)'; x.lineWidth = 1.2; for (let k = 0; k < 16; k++) { x.beginPath(); for (let i = 0; i <= 64; i++) { const t = i / 64 * Math.PI * 2, r = 20 + k * 9 + Math.sin(t * 3 + k) * 6; x.lineTo(128 + Math.cos(t) * r, 100 + Math.sin(t) * r * .85); } x.stroke(); }
    x.fillStyle = '#ffcf33'; x.beginPath(); x.moveTo(104, 62); x.lineTo(152, 62); x.bezierCurveTo(152, 100, 140, 112, 132, 116); x.lineTo(134, 140); x.lineTo(146, 146); x.lineTo(110, 146); x.lineTo(122, 140); x.lineTo(124, 116); x.bezierCurveTo(116, 112, 104, 100, 104, 62); x.fill();
    wordmark(x, 'ADIBAS', 186, '#ffd23f', 12);
  } },
};
Object.assign(RACKETS, RK_ART);
const RACKET_MATS = {};
function racketMats(key) {
  if (RACKET_MATS[key]) return RACKET_MATS[key];
  const r = RACKETS[key];
  const t = canvasTex(512, 512, (x) => { x.scale(2, 2); r.draw(x, 256, 256); });
  // mapeia o contorno (x de -0,135 a 0,135; y de -0,21 a 0,16) no desenho inteiro
  t.repeat.set(1 / .24, 1 / .4); t.offset.set(.5, .21 / .4);
  return (RACKET_MATS[key] = {
    face: new THREE.MeshPhysicalMaterial({ color: 0xdedede, map: t, roughness: r.rough ? .82 : .5, metalness: r.gloss ? .18 : .05, clearcoat: r.rough ? .02 : .35, clearcoatRoughness: .3, envMapIntensity: .45 }), // fosca/áspera (rough) ou com brilho metálico (gloss)
    edge: mat(r.edge, { roughness: .35, metalness: .12 }),
    bumper: mat(r.edge, { roughness: .6 }),
    grip: mat(r.grip, { map: GRIP_TEX, roughness: .92 }),
    cap: mat(r.throat, { roughness: .35, metalness: .2 }),
  });
}
const STRAP_MAT = mat('#1b1e22', { roughness: .8 });
// raquete modelada no Blender (ferramentas/modelos-mh/raquete.py, medidas de mercado: 50 cm × 22,5 cm × 22 mm): chega
// depois do carregamento; até lá (ou sem o arquivo) fica a desenhada aqui. Cada modelo tem um padrão de furação.
const RK_GLB = { geo: null, all: [] };
// furação de cada modelo (padrões de antes; o contorno é o mesmo para todas)
const RK_PATTERN = { basica: 'band', tropic: 'side1', brisa: 'side1', fibra: 'side2', areia: 'side1', mare: 'side1', coral: 'side2', duna: 'side1', medusa: 'ring', proteo: 'arc', vela: 'arc', tufao: 'arc', atol: 'side2', kronos: 'full', ventosul: 'side2', maresia: 'band', recife: 'side2', farol: 'side1', supercarbon: 'arc', corsario: 'side2', tsunami: 'band', abismo: 'side1', eclipse: 'side1', trovao: 'side1', aurora: 'side1', zenite: 'side2', assinatura: 'side1' };
function setRacketModels(gltf) {
  const geo = {}; gltf.scene.traverse(o => { if (o.isMesh) geo[o.name] = o.geometry; });
  if (!geo.Grip || !geo.F_side1) return;
  if (!geo.Bumper && geo.Bumper_oval) geo.Bumper = geo.Bumper_oval;
  for (const k in geo) { const uv = geo[k].attributes.uv; if (!uv || !/^F_|^E_/.test(k)) continue; for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i)); } // UV do glTF vem invertido em v
  RK_GLB.geo = geo; RK_GLB.all.forEach(g => g.userData.setStyle(g.userData.key));
}
function makeRacket(key) {
  const g = new THREE.Group();
  const face = new THREE.Mesh(racketGeo(key), []); face.rotation.z = Math.PI; face.position.y = -.365; face.castShadow = true; g.add(face);
  const bumper = new THREE.Mesh(BUMPER_GEO); bumper.rotation.z = Math.PI; bumper.position.y = -.365; bumper.castShadow = true; g.add(bumper);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(.0165, .0185, .165, 8)); handle.position.y = -.0825; g.add(handle);
  const butt = new THREE.Mesh(new THREE.CylinderGeometry(.021, .019, .014, 16)); butt.position.y = .002; g.add(butt);
  const strap = new THREE.Mesh(STRAP_GEO, STRAP_MAT); g.add(strap);
  const old = [face, bumper, handle, butt, strap];
  const nm = ['face', 'edge', 'bumper', 'grip', 'cap', 'leash'].map(() => { const m = new THREE.Mesh(); m.castShadow = true; m.visible = false; g.add(m); return m; });
  g.userData.setStyle = k => {
    const kk = RACKETS[k] ? k : 'proteo', M = racketMats(kk); g.userData.key = kk;
    face.geometry = racketGeo(kk); face.material = [M.face, M.edge]; bumper.material = M.bumper; handle.material = M.grip; butt.material = M.cap;
    const G = RK_GLB.geo; old.forEach(o => { o.visible = !G; }); nm.forEach(o => { o.visible = !!G; });
    if (G) {
      const pt = RK_PATTERN[kk] || 'side1';
      [[G['F_' + pt] || G.F_side1, M.face], [G['E_' + pt] || G.E_side1, M.edge], [G.Bumper, M.bumper], [G.Grip, M.grip], [G.Cap, M.cap], [G.Leash, STRAP_MAT]].forEach(([geo, m], i) => { nm[i].geometry = geo; nm[i].material = m; });
    }
  };
  g.userData.setStyle(key); RK_GLB.all.push(g);
  return g;
}
function headGeo(fem) {
  const g = new THREE.SphereGeometry(.1, 28, 20); const pa = g.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    let x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
    const ny = y / .1;
    if (ny < 0) { const k = 1 + ny * (fem ? .2 : .27); x *= k; z *= z < 0 ? 1 - ny * .06 : 1 + ny * .3; }
    if (z > 0) z *= 1.07;
    pa.setXYZ(i, x * .93, y * 1.16, z * 1.04);
  }
  g.computeVertexNormals(); return g;
}
// estampa da camiseta do boneco desenhado (u = volta no tronco, frente no meio; v = de cima para baixo)
function drawPattern(x, w, h, pat, c2) {
  x.save(); x.fillStyle = c2; x.strokeStyle = c2;
  if (pat === 'listras') for (let y = 0; y < h; y += h / 10) x.fillRect(0, y, w, h / 20);
  else if (pat === 'faixas') for (let u = 0; u < w; u += w / 14) x.fillRect(u, 0, w / 50, h);
  else if (pat === 'diagonal') { x.beginPath(); x.moveTo(w * .3, 0); x.lineTo(w * .42, 0); x.lineTo(w * .72, h); x.lineTo(w * .6, h); x.fill(); }
  else if (pat === 'degrade') { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, c2); g.addColorStop(.7, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); }
  else if (pat === 'lateral') { x.fillRect(w * .18, 0, w * .12, h); x.fillRect(w * .7, 0, w * .12, h); }
  else if (pat === 'chevron') { x.lineWidth = h / 22; for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(w * .25, h * (.15 + k * .2)); x.lineTo(w * .5, h * (.27 + k * .2)); x.lineTo(w * .75, h * (.15 + k * .2)); x.stroke(); } }
  else if (pat === 'bolinhas') for (let y = h / 16; y < h; y += h / 8) for (let u = (y / (h / 8)) % 2 ? w / 24 : 0; u < w; u += w / 12) { x.beginPath(); x.arc(u, y, h / 40, 0, Math.PI * 2); x.fill(); }
  else if (pat === 'camuflado') { const r = mulberry(7); for (let i = 0; i < 60; i++) { x.beginPath(); x.ellipse(r() * w, r() * h, 6 + r() * 16, 4 + r() * 10, r() * 3, 0, Math.PI * 2); x.fill(); } }
  else if (pat === 'ombros') x.fillRect(0, 0, w, h * .2);
  else if (pat === 'ondas') { x.lineWidth = h / 30; for (let k = 0; k < 7; k++) { x.beginPath(); for (let u = 0; u <= w; u += 4) { const y = h * (.08 + k * .14) + Math.sin(u / w * Math.PI * 8) * h * .025; u ? x.lineTo(u, y) : x.moveTo(u, y); } x.stroke(); } }
  else if (pat === 'tresfaixas') { for (const cx of [w * .2, w * .8]) for (let k = -1; k <= 1; k++) x.fillRect(cx + k * w * .025 - w * .006, 0, w * .012, h * .32); }
  else if (pat === 'faixaslado') { for (const cx of [w * .25, w * .75]) for (let k = -1; k <= 1; k++) x.fillRect(cx + k * w * .025 - w * .006, h * .2, w * .012, h * .8); }
  else if (pat === 'gola') { x.fillRect(0, 0, w, h * .06); x.fillRect(w * .15, 0, w * .1, h * .1); x.fillRect(w * .75, 0, w * .1, h * .1); }
  else if (pat === 'respingos') { const r = mulberry(19); for (let i = 0; i < 26; i++) { const cx = r() * w, cy = r() * h, rr = 6 + r() * 14; x.beginPath(); x.arc(cx, cy, rr, 0, Math.PI * 2); x.fill(); for (let j = 0; j < 6; j++) { x.beginPath(); x.arc(cx + (r() - .5) * rr * 4, cy + (r() - .5) * rr * 4, 1 + r() * 3, 0, Math.PI * 2); x.fill(); } } }
  else if (pat === 'geodegrade') { x.lineWidth = 2; for (let k = -h; k < w + h; k += 14) { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, c2); g.addColorStop(.6, 'rgba(0,0,0,0)'); x.strokeStyle = g; x.beginPath(); x.moveTo(k, 0); x.lineTo(k + h, h); x.stroke(); x.beginPath(); x.moveTo(k, 0); x.lineTo(k - h, h); x.stroke(); } }
  else if (pat === 'peito') { x.fillRect(0, h * .22, w, h * .12); x.fillRect(0, h * .19, w, h * .015); x.fillRect(0, h * .355, w, h * .015); }
  else if (pat === 'ventilada') { for (const cx of [w * .25, w * .75]) for (let y = h * .2; y < h; y += 6) for (let u = -w * .05; u < w * .05; u += 6) { x.beginPath(); x.arc(cx + u, y, 1.4, 0, Math.PI * 2); x.fill(); } }
  else if (pat === 'pinceladas') { const r = mulberry(23); for (let i = 0; i < 40; i++) { const y = r() * h * .6; x.globalAlpha = .5 + r() * .5; x.fillRect(r() * w - 20, y, 30 + r() * 90, 3 + r() * 6); } x.globalAlpha = 1; }
  else if (pat === 'tropical') { const r = mulberry(11); for (let i = 0; i < 26; i++) { const cx = r() * w, cy = r() * h, a = r() * 6.3; x.beginPath(); x.ellipse(cx, cy, 16, 5, a, 0, Math.PI * 2); x.fill(); } }
  x.restore();
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shirtTex(o) {
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = o.shirt; x.fillRect(0, 0, w, h);
    if (o.pattern && o.pattern !== 'liso') drawPattern(x, w, h, o.pattern, o.shirt2 || o.trim);
    if (o.logo) { x.fillStyle = o.shirt2 || o.trim; x.font = 'bold ' + Math.round(h * .07) + 'px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(o.logo.toUpperCase().slice(0, 14), w * .5, h * .3); }
    for (let i = 0; i < 2600; i++) { x.fillStyle = Math.random() < .5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)'; x.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
    x.fillStyle = o.trim; x.fillRect(w * .2, 0, w * .06, h); x.fillRect(w * .74, 0, w * .06, h); x.fillRect(0, 0, w, h * .05);
    x.font = 'bold ' + Math.round(h * .24) + 'px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    [0, w].forEach(cx => x.fillText(o.num, cx, h * .4));
  });
}
function shortsTex(o) {
  return canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = o.shorts; x.fillRect(0, 0, w, h);
    x.fillStyle = o.trim; x.fillRect(w * .23, 0, w * .04, h); x.fillRect(w * .73, 0, w * .04, h); x.fillRect(0, h * .9, w, h * .1);
  });
}
const UP_ARM = [[0, .05], [.045, .03], [.05, -.02], [.052, -.08], [.048, -.14], [.042, -.2], [.037, -.26], [0, -.3]];
const FORE_ARM = [[0, .03], [.037, .01], [.04, -.04], [.036, -.12], [.029, -.21], [.025, -.25], [0, -.27]];
const scaleProf = (pr, k) => pr.map(([r, y]) => [r * k, y]);
// pé: calcanhar arredondado, arco, peito do pé alto perto do tornozelo e dedos achatados
const FOOT_GEO = [1, .9].map(k => {
  const g = new THREE.SphereGeometry(1, 22, 14), pa = g.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
    const t = (1 - z) / 2; // 0 calcanhar, 1 dedos
    const w = (.031 + .013 * smooth(0, .68, t) - .008 * smooth(.86, 1, t)) * k;
    const top = (.066 - .04 * smooth(.2, .95, t)) * k;
    const yy = y >= 0 ? y * top : y * .014;
    pa.setXYZ(i, x * w + .004 * smooth(.3, 1, t), -.028 + yy, lerp(.05, -.165, t) * k);
  }
  g.computeVertexNormals(); return g;
});
// mão fechada em volta do cabo (o cabo passa pelo eixo y do punho)
const HAND_GEO = [1, .9].map(k => {
  const g = new THREE.LatheGeometry([[0, -.094], [.026, -.088], [.03, -.07], [.031, -.04], [.03, -.012], [.024, .006], [0, .012]].map(([r, y]) => new THREE.Vector2(r * k, y * k)), 16);
  const pa = g.attributes.position;
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = pa.getZ(i); pa.setX(i, x * (x > 0 ? .78 : 1.05)); pa.setZ(i, z * (z < 0 ? 1.12 : .82) + (z < 0 ? -.004 : 0)); }
  g.computeVertexNormals(); return g;
});
const THUMB_GEO = (() => { const g = new THREE.CylinderGeometry(.011, .013, .05, 10); g.translate(0, -.025, 0); return g; })();
// tubos de pele presos a vários ossos: os anéis perto de cada junta misturam os dois ossos vizinhos,
// então cotovelo, joelho, ombro e cintura dobram sem emenda
function skinTubeGeo(parts, seg) {
  const pos = [], uv = [], si = [], sw = [], idx = [];
  const v = new V3(), a = new V3(), b = new V3(), n = new V3();
  const tri = (i0, i1, i2, dx, dy, dz) => {
    v.fromArray(pos, i0 * 3); a.fromArray(pos, i1 * 3).sub(v); b.fromArray(pos, i2 * 3).sub(v); n.crossVectors(a, b);
    if (n.x * dx + n.y * dy + n.z * dz < 0) idx.push(i0, i2, i1); else idx.push(i0, i1, i2);
  };
  const seams = [];
  for (const P of parts) {
    const R = P.rings, base = pos.length / 3, y0 = R[0].y, y1 = R[R.length - 1].y;
    R.forEach(r => {
      seams.push([pos.length / 3, pos.length / 3 + seg]);
      for (let j = 0; j <= seg; j++) {
        const an = j / seg * Math.PI * 2;
        pos.push(P.x + r.cx + Math.sin(an) * r.rx, r.y, P.z + r.cz + Math.cos(an) * r.rz);
        uv.push(j / seg, (r.y - Math.min(y0, y1)) / (Math.abs(y1 - y0) || 1));
        si.push(r.b0, r.b1, 0, 0); sw.push(1 - r.t, r.t, 0, 0);
      }
    });
    for (let i = 0; i < R.length - 1; i++) for (let j = 0; j < seg; j++) {
      const q = base + i * (seg + 1) + j, w = q + seg + 1;
      const r = R[i], cx = P.x + r.cx, cz = P.z + r.cz, an = (j + .5) / seg * Math.PI * 2;
      tri(q, w, q + 1, Math.sin(an), 0, Math.cos(an)); tri(w, w + 1, q + 1, Math.sin(an), 0, Math.cos(an));
    }
    [[0, y0 > y1 ? 1 : -1], [R.length - 1, y0 > y1 ? -1 : 1]].forEach(([ri, dir]) => {
      if (P.open && P.open.includes(ri)) return;
      const r = R[ri], c = pos.length / 3;
      pos.push(P.x + r.cx, r.y + dir * r.rx * .25, P.z + r.cz); uv.push(.5, ri ? 1 : 0); si.push(r.b0, r.b1, 0, 0); sw.push(1 - r.t, r.t, 0, 0);
      for (let j = 0; j < seg; j++) { const q = base + ri * (seg + 1) + j; tri(c, q, q + 1, 0, dir, 0); }
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx); g.computeVertexNormals();
  const nr = g.attributes.normal;
  for (const [i, k] of seams) { n.set(nr.getX(i) + nr.getX(k), nr.getY(i) + nr.getY(k), nr.getZ(i) + nr.getZ(k)).normalize(); nr.setXYZ(i, n.x, n.y, n.z); nr.setXYZ(k, n.x, n.y, n.z); }
  return g;
}
// anéis de um membro: [y, raio, deslocamento à frente/atrás, deslocamento lateral, peso forçado do osso de baixo]
// chain: ossos de cima para baixo com a altura da junta e a largura da mistura
function chainRings(list, chain, kx, kz) {
  return list.map(([y, r, cz, cx, force]) => {
    let best = 1, bd = 1e9;
    for (let k = 1; k < chain.length; k++) { const d = Math.abs(y - chain[k][1]); if (d < bd) { bd = d; best = k; } }
    const [, J, band] = chain[best];
    let t = force != null ? force : smooth(0, 1, (band - (y - J)) / (2 * band));
    const kxx = typeof kx === 'function' ? kx(y) : kx, kzz = typeof kz === 'function' ? kz(y) : kz;
    return { y, rx: r * kxx, rz: r * kzz, cx: cx || 0, cz: cz || 0, b0: chain[best - 1][0], b1: chain[best][0], t };
  });
}
const PELVIS_PROF = [[[0, -.03], [.085, -.045], [.14, -.04], [.168, .0], [.17, .08], [.152, .14], [0, .145]], [[0, -.03], [.09, -.045], [.15, -.04], [.18, .0], [.18, .07], [.15, .14], [0, .145]]];
// raio de um perfil [r, y] na altura y (pega o maior raio entre os trechos que cruzam y)
function profR(prof, y) {
  let best = 0;
  for (let i = 0; i < prof.length - 1; i++) {
    const [r0, y0] = prof[i], [r1, y1] = prof[i + 1];
    if ((y - y0) * (y - y1) <= 0 && y0 !== y1) best = Math.max(best, lerp(r0, r1, (y - y0) / (y1 - y0)));
  }
  if (!best) { const pts = prof.filter(([r]) => r > 0); best = y < pts[0][1] ? pts[0][0] : pts[pts.length - 1][0]; }
  return best;
}

export { drawPattern, setRacketModels, FOOT_GEO, HAND_GEO, PELVIS_PROF, RACKETS, SHADOW_TEX, THUMB_GEO, capsuleGeo, chainRings, headGeo, latheGeo, makeRacket, profR, shirtTex, shortsTex, skinTubeGeo };
