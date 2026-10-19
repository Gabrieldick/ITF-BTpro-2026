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
  zenite: { bg: '#f7f7f7', a1: '#e8a317', a2: '#0f2436', pattern: 'chevron', label: 'ZÊNITE', labelColor: '#f7f7f7', band: '#0f2436', edge: '#e8a317', holes: 'supercarbon' },
  // raquete assinatura (marca pessoal do modo carreira)
  assinatura: { bg: '#0b0b0b', a1: '#ff6a00', a2: '#ffd23f', pattern: 'diag', label: 'SIGNATURE', labelColor: '#0b0b0b', carbon: true, band: '#ff6a00', edge: '#ffd23f', holes: 'supercarbon' },
};
Object.entries(RACKET_STYLES).forEach(([k, c]) => { RACKETS[k] = { edge: c.edge, grip: '#141516', throat: c.edge, holes: c.holes, draw: mkRacketDraw(c) }; });
const RACKET_MATS = {};
function racketMats(key) {
  if (RACKET_MATS[key]) return RACKET_MATS[key];
  const r = RACKETS[key];
  const t = canvasTex(512, 512, (x) => { x.scale(2, 2); r.draw(x, 256, 256); });
  // mapeia o contorno (x de -0,135 a 0,135; y de -0,21 a 0,16) no desenho inteiro
  t.repeat.set(1 / .24, 1 / .4); t.offset.set(.5, .21 / .4);
  return (RACKET_MATS[key] = {
    face: new THREE.MeshPhysicalMaterial({ color: 0xdedede, map: t, roughness: .5, metalness: .05, clearcoat: .35, clearcoatRoughness: .3, envMapIntensity: .45 }),
    edge: mat(r.edge, { roughness: .35, metalness: .12 }),
    bumper: mat(r.edge, { roughness: .6 }),
    grip: mat(r.grip, { map: GRIP_TEX, roughness: .92 }),
    cap: mat(r.throat, { roughness: .35, metalness: .2 }),
  });
}
const STRAP_MAT = mat('#1b1e22', { roughness: .8 });
function makeRacket(key) {
  const g = new THREE.Group();
  const face = new THREE.Mesh(racketGeo(key), []); face.rotation.z = Math.PI; face.position.y = -.365; face.castShadow = true; g.add(face);
  const bumper = new THREE.Mesh(BUMPER_GEO); bumper.rotation.z = Math.PI; bumper.position.y = -.365; bumper.castShadow = true; g.add(bumper);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(.0165, .0185, .165, 8)); handle.position.y = -.0825; g.add(handle);
  const butt = new THREE.Mesh(new THREE.CylinderGeometry(.021, .019, .014, 16)); butt.position.y = .002; g.add(butt);
  const strap = new THREE.Mesh(STRAP_GEO, STRAP_MAT); g.add(strap);
  g.userData.setStyle = k => {
    const M = racketMats(RACKETS[k] ? k : 'proteo');
    face.geometry = racketGeo(RACKETS[k] ? k : 'proteo'); face.material = [M.face, M.edge]; bumper.material = M.bumper; handle.material = M.grip; butt.material = M.cap;
  };
  g.userData.setStyle(key);
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
function shirtTex(o) {
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = o.shirt; x.fillRect(0, 0, w, h);
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

export { FOOT_GEO, HAND_GEO, PELVIS_PROF, RACKETS, SHADOW_TEX, THUMB_GEO, capsuleGeo, chainRings, headGeo, latheGeo, makeRacket, profR, shirtTex, shortsTex, skinTubeGeo };
