// @ts-nocheck
// ---------- Modo livre da carreira (andar pela casa, quintal, rua, arena e ir ao torneio) ----------
// O seu jogador anda (WASD/setas, Shift corre, E interage, Esc volta) por um pequeno bairro montado longe da quadra do jogo:
// a casa (vista em corte, sem teto), o quintal com a quadra própria (quando comprada em Negócios), a rua com a van para o
// torneio e a arena de treino no fim da rua. Os pontos de interação usam as mesmas ações da tela da carreira (treinar,
// desafio, dar aulas, descansar, ir ao torneio). A animação de andar é a da partida (com a captura de movimento).
import * as THREE from 'three';
import { $s } from '../state';
import { S } from './01-estado';
import { camera, canvasTex, mat, scene, sun, SUN_DIR } from './02-render';
import { cpuA, cpuB, human, partner } from './06-modelos';
import { crInv, crLife, crTrain, crRest, crRestUntil, crCoach, crDateTxt, crTourT, crMyMatch, saveCareer, crSyncChars, crPlayMatch, crPartnerAct, crIsSemiOrFinal, crIsCentral, crTourDay, crTeamName, crNRounds, crRoundNames, crAddFama } from './14-carreira';
import { say } from './26-historias';
import { assignCharacters, applyRackets, applyPlayerStyle } from './07-glb';
import { mergeStatic, sea as SEA } from './03-cenario';
import { arenaFor } from './09-interface';
import { nameOf } from './00-base';

const H0 = new THREE.Vector3(320, 0, 40); // origem do bairro no mundo (longe da quadra, fora do cenário da praia)
const LV = { zoom: 6.4, on: false, group: null, spots: [], boxes: [], yaw: 0, camYaw: Math.PI, camPitch: .5, vel: new THREE.Vector3(), near: null, msgT: 0, saved: null, actions: {}, drag: null, keys: {}, built: '' };
const P = (x, z) => new THREE.Vector3(H0.x + x, 0, H0.z + z);

// ---------- montagem ----------
function box(g, w, h, d, x, y, z, color, o) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, o)); m.position.set(x, y, z); m.castShadow = !(o && o.noShadow); m.receiveShadow = true; g.add(m); return m; }
function blocked(x, z, m = 0) { return LV.boxes.some(([x0, z0, x1, z1]) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m); }
function solid(x0, z0, x1, z1) { LV.boxes.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]); }
function label(text, sub) {
  const t = canvasTex(512, 128, (x, w, h) => { x.fillStyle = 'rgba(4,14,40,.82)'; x.beginPath(); x.roundRect(4, 4, w - 8, h - 8, 26); x.fill(); x.strokeStyle = '#33c3ff'; x.lineWidth = 4; x.stroke();
    x.fillStyle = '#fff'; x.font = '800 italic 46px Barlow Condensed, Arial Narrow, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text.toUpperCase(), w / 2, sub ? 48 : h / 2);
    if (sub) { x.fillStyle = '#9fe6ff'; x.font = '600 28px Arial'; x.fillText(sub, w / 2, 92); } }, true);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(2.4, .6, 1); s.renderOrder = 5; return s;
}
// ponto de interação: círculo no chão + placa flutuante
function spot(g, id, x, z, title, sub, r = 1.1) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * .78, r, 40), new THREE.MeshBasicMaterial({ color: 0x33c3ff, transparent: true, opacity: .55, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(x, .03, z); g.add(ring);
  const l = label(title, sub); l.position.set(x, 2.5, z); g.add(l);
  LV.spots.push({ id, x, z, r: r + .3, ring, label: l, title });
}
// ---------- peças de cenário ----------
const cyl = (g, rt, rb, h, x, y, z, color, o, seg = 14) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color, o)); m.position.set(x, y, z); m.castShadow = !(o && o.noShadow); m.receiveShadow = true; g.add(m); return m; };
const glow = (color, k = 1.6) => ({ emissive: color, emissiveIntensity: k });
// parede reta (eixo x ou z) com vãos (portas) e colisão; win: janelas de vidro no meio dos trechos
function wall(g, x0, z0, x1, z1, h, color, gaps = [], win = false) {
  const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0), a0 = alongX ? Math.min(x0, x1) : Math.min(z0, z1), a1 = alongX ? Math.max(x0, x1) : Math.max(z0, z1), c = alongX ? z0 : x0, t = .18;
  const segs = []; let s = a0; gaps.slice().sort((p, q) => p[0] - q[0]).forEach(([g0, g1]) => { if (g0 > s) segs.push([s, g0]); s = Math.max(s, g1); }); if (s < a1) segs.push([s, a1]);
  segs.forEach(([p, q]) => { const L = q - p, m = (p + q) / 2; if (L < .05) return;
    if (alongX) { box(g, L, h, t, m, h / 2, c, color); solid(p, c - t, q, c + t); } else { box(g, t, h, L, c, h / 2, m, color); solid(c - t, p, c + t, q); }
    if (win && L > 2.2) { const ww = Math.min(L - 1, 2.4); if (alongX) { box(g, ww, 1.1, .2, m, 1.55, c, '#9fd3f5', { transparent: true, opacity: .55, metalness: .3, roughness: .1, noShadow: true }); box(g, ww + .12, .08, .26, m, 1, c, '#ffffff', { noShadow: true }); }
      else { box(g, .2, 1.1, ww, c, 1.55, m, '#9fd3f5', { transparent: true, opacity: .55, metalness: .3, roughness: .1, noShadow: true }); box(g, .26, .08, ww + .12, c, 1, m, '#ffffff', { noShadow: true }); } } });
  gaps.forEach(([g0, g1]) => { const m = (g0 + g1) / 2, L = g1 - g0; if (alongX) box(g, L, .35, t, m, h - .175, c, color, { noShadow: true }); else box(g, t, .35, L, c, h - .175, m, color, { noShadow: true }); });
}
const rug = (g, w, d, x, z, color) => box(g, w, .02, d, x, .1, z, color, { noShadow: true });
function plant(g, x, z, s = 1) { cyl(g, .22 * s, .17 * s, .38 * s, x, .19 * s + .08, z, '#c97b4a'); for (let k = 0; k < 5; k++) { const l = new THREE.Mesh(new THREE.ConeGeometry(.12 * s, .8 * s, 5), mat('#3e8e4f')); l.position.set(x + Math.cos(k * 1.3) * .1 * s, .75 * s + .08, z + Math.sin(k * 1.3) * .1 * s); l.rotation.set(Math.sin(k) * .5, 0, Math.cos(k) * .5); l.castShadow = true; g.add(l); } solid(x - .25 * s, z - .25 * s, x + .25 * s, z + .25 * s); }
function lamp(g, x, z, on = true) { cyl(g, .03, .03, 1.5, x, .83, z, '#2b2b2b'); cyl(g, .18, .26, .3, x, 1.65, z, '#f6ead2', on ? glow('#ffd9a0', .9) : {}); }
function sofa(g, w, x, z, rot, color) { // rot: 0 = encosto atrás (−z), 1 = encosto na esquerda (−x)…
  const o = new THREE.Group(); o.position.set(x, 0, z); o.rotation.y = -rot * Math.PI / 2; g.add(o);
  box(o, w, .42, .9, 0, .29, 0, color); box(o, w, .55, .22, 0, .62, -.38, color); box(o, .2, .3, .9, -w / 2 + .1, .55, 0, color); box(o, .2, .3, .9, w / 2 - .1, .55, 0, color);
  for (let i = 0; i < Math.floor(w / .9); i++) box(o, .7, .14, .7, -w / 2 + .55 + i * .9, .57, .05, '#f3efe6');
  const ex = rot % 2 ? .5 : w / 2, ez = rot % 2 ? w / 2 : .5; solid(x - ex, z - ez, x + ex, z + ez);
}
function bed(g, w, x, z, rot, cover) {
  const o = new THREE.Group(); o.position.set(x, 0, z); o.rotation.y = -rot * Math.PI / 2; g.add(o);
  box(o, w + .1, .35, 2.2, 0, .25, 0, '#6b4f3a'); box(o, w, .25, 2, 0, .55, .05, '#f5f5f5'); box(o, w, .18, 1.3, 0, .7, .4, cover); box(o, w + .1, .9, .1, 0, .7, -1.1, '#6b4f3a');
  for (const s of w > 1.6 ? [-1, 1] : [0]) box(o, .6, .14, .38, s * w / 4, .74, -.75, '#ffffff');
  const ex = rot % 2 ? 1.15 : w / 2 + .05, ez = rot % 2 ? w / 2 + .05 : 1.15; solid(x - ex, z - ez, x + ex, z + ez);
}
function tvSet(g, w, x, z, rot, big) { // na parede (rot 0: parede de trás)
  const o = new THREE.Group(); o.position.set(x, 0, z); o.rotation.y = -rot * Math.PI / 2; g.add(o);
  box(o, w + .6, .5, .5, 0, .25, .1, '#3b2f28'); box(o, w, w * .56, .06, 0, 1.15 + w * .1, -.1, '#0b0c0f'); box(o, w * .96, w * .52, .02, 0, 1.15 + w * .1, -.06, '#1c3f7a', glow('#3b8cff', .5));
  if (big) [-1, 1].forEach(s => box(o, .3, 1.1, .3, s * (w / 2 + .5), .55, .1, '#1d1d20'));
  const ex = rot % 2 ? .35 : w / 2 + .3, ez = rot % 2 ? w / 2 + .3 : .35; solid(x - ex, z - ez, x + ex, z + ez);
}
function shelfTrophies(g, x, z, rot, n, wide) {
  const o = new THREE.Group(); o.position.set(x, 0, z); o.rotation.y = -rot * Math.PI / 2; g.add(o); const W = wide ? 3.4 : 2.2;
  box(o, W, 2.2, .45, 0, 1.1, 0, '#4a3628'); for (let k = 0; k < 4; k++) box(o, W - .1, .04, .4, 0, .3 + k * .55, .02, '#7a5a42');
  for (let i = 0; i < Math.min(n, wide ? 24 : 12); i++) { const per = wide ? 6 : 4, r = Math.floor(i / per), c = i % per, gold = i % 5 !== 3;
    const t = cyl(o, .07, .11, .28, -W / 2 + .35 + c * ((W - .5) / (per - 1)), .5 + r * .55, .05, gold ? '#e8b923' : '#c0c5cc', { metalness: .85, roughness: .25 }); cyl(o, .12, .12, .04, t.position.x, t.position.y + .17, .05, gold ? '#e8b923' : '#c0c5cc', { metalness: .85, roughness: .25 }); }
  const ex = rot % 2 ? .3 : W / 2, ez = rot % 2 ? W / 2 : .3; solid(x - ex, z - ez, x + ex, z + ez);
}
function desk(g, x, z, rot, gamer) {
  const o = new THREE.Group(); o.position.set(x, 0, z); o.rotation.y = -rot * Math.PI / 2; g.add(o);
  box(o, 1.6, .06, .75, 0, .75, 0, gamer ? '#121318' : '#6b4f3a'); [-1, 1].forEach(s => box(o, .06, .72, .7, s * .75, .37, 0, gamer ? '#121318' : '#5c4433'));
  box(o, .7, .42, .04, gamer ? -.38 : 0, 1.05, -.25, '#0b0c0f'); box(o, .66, .38, .01, gamer ? -.38 : 0, 1.05, -.23, '#22406e', glow('#3b8cff', .6));
  if (gamer) { box(o, .7, .42, .04, .38, 1.05, -.25, '#0b0c0f'); box(o, .66, .38, .01, .38, 1.05, -.23, '#6e2260', glow('#ff3bd1', .6)); box(o, 1.6, .03, .02, 0, .73, .37, '#ff3bd1', glow('#ff3bd1', 2.2)); box(o, .5, .5, .5, .55, .3, .05, '#111', glow('#00e1ff', .2)); }
  box(o, .55, .5, .55, 0, .28, .6, gamer ? '#d1213b' : '#2b2b2b'); box(o, .55, .7, .08, 0, .85, .85, gamer ? '#d1213b' : '#2b2b2b');
  const ex = rot % 2 ? .45 : .85, ez = rot % 2 ? .85 : .45; solid(x - ex, z - ez, x + ex, z + ez);
}
function kitchen(g, x0, z, len, level) { // bancada ao longo de x, de x0 até x0 + len, encostada em z (parede de trás)
  box(g, len, .9, .65, x0 + len / 2, .45, z + .33, level >= 2 ? '#f2f2f2' : '#d9cfc0'); box(g, len, .05, .7, x0 + len / 2, .92, z + .33, level >= 2 ? '#2b2d31' : '#8a7a68');
  box(g, len, .7, .38, x0 + len / 2, 1.85, z + .2, level >= 2 ? '#f2f2f2' : '#d9cfc0'); solid(x0, z, x0 + len, z + .7);
  box(g, .75, 1.95, .7, x0 + len + .4, .98, z + .36, '#cfd3d8', { metalness: .5, roughness: .3 }); solid(x0 + len, z, x0 + len + .8, z + .72);
  if (level >= 2) { box(g, 2.2, .92, .9, x0 + len / 2, .46, z + 2.1, '#2b2d31'); box(g, 2.3, .05, 1, x0 + len / 2, .94, z + 2.1, '#f2f2f2'); solid(x0 + len / 2 - 1.15, z + 1.6, x0 + len / 2 + 1.15, z + 2.6);
    [-1, 0, 1].forEach(i => cyl(g, .17, .17, .7, x0 + len / 2 + i * .7, .35, z + 2.85, '#c97b4a')); }
  cyl(g, .2, .14, .12, x0 + .6, .99, z + .35, '#ffffff'); [0, 1, 2].forEach(i => { const f = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), mat(['#ff6b3d', '#ffd23f', '#7cc95b'][i])); f.position.set(x0 + .55 + i * .06, 1.07, z + .35); g.add(f); });
}
function gym(g, x, z) { // esteira, banco e halteres
  box(g, .8, .12, 1.9, x, .1, z, '#1d1f24'); box(g, .7, .03, 1.6, x, .18, z, '#33363d'); [-1, 1].forEach(s => box(g, .05, 1.1, .05, x + s * .38, .65, z - .8, '#9aa0a8')); box(g, .85, .1, .3, x, 1.2, z - .8, '#1d1f24'); solid(x - .45, z - 1, x + .45, z + 1);
  box(g, .35, .45, 1.2, x + 1.5, .25, z, '#2b2b2b'); box(g, 1, .05, .4, x + 2.6, .4, z, '#9aa0a8'); for (let i = 0; i < 4; i++) cyl(g, .07, .07, .26, x + 2.25 + i * .24, .55, z, '#3a3a3a'); solid(x + 1.3, z - .65, x + 3.2, z + .65);
}
function iceBath(g, x, z) { box(g, 1.4, .6, .8, x, .3, z, '#e9edf2'); box(g, 1.25, .02, .65, x, .58, z, '#9fdcff', { transparent: true, opacity: .8, ...glow('#bfeaff', .3) }); solid(x - .7, z - .4, x + .7, z + .4); }
function podcast(g, x, z) { box(g, 1.2, .74, .7, x, .37, z, '#2b2b2b'); [-1, 1].forEach(s => { cyl(g, .015, .015, .4, x + s * .35, .95, z, '#111'); cyl(g, .04, .04, .14, x + s * .35, 1.18, z, '#555', { metalness: .6 }); });
  cyl(g, .02, .02, 1.7, x + 1.1, .85, z - .2, '#111'); const ring = new THREE.Mesh(new THREE.TorusGeometry(.28, .04, 8, 24), mat('#ffffff', glow('#ffffff', 1.8))); ring.position.set(x + 1.1, 1.75, z - .2); g.add(ring); solid(x - .6, z - .35, x + 1.2, z + .35); }
function car(g, x, z, rot, color, van) {
  const o = new THREE.Group(); o.position.set(x, 0, z); o.rotation.y = rot; g.add(o); const L = van ? 4.6 : 4, H = van ? 1.9 : 1.35;
  box(o, L, H * .55, 1.8, 0, .25 + H * .27, 0, color); box(o, van ? L * .8 : L * .55, H * .45, 1.7, van ? -.3 : -.15, .25 + H * .55 + H * .22, 0, color); box(o, van ? .05 : L * .5, H * .38, 1.72, van ? L * .5 - .75 : -.15, .25 + H * .77, 0, '#25313f', { metalness: .4, roughness: .2 });
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([a, b]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .24, 14), mat('#151515')); w.rotation.x = Math.PI / 2; w.position.set(a * (L / 2 - .7), .34, b * .82); o.add(w); });
  const c = Math.cos(rot), s = Math.sin(rot), ex = Math.abs(c) * L / 2 + Math.abs(s) * .95, ez = Math.abs(s) * L / 2 + Math.abs(c) * .95; solid(x - ex, z - ez, x + ex, z + ez);
}
function palm(g, x, z, h = 5) { const tr = cyl(g, .13, .22, h, x, h / 2, z, '#8a6a45'); tr.rotation.z = .06; for (let k = 0; k < 7; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(.3, 2.6, 4), mat('#3f8f4a')); f.position.set(x + Math.cos(k * .9) * .95, h - .1, z + Math.sin(k * .9) * .95); f.rotation.set(Math.sin(k * .9) * 1.25, 0, -Math.cos(k * .9) * 1.25); f.castShadow = true; g.add(f); } solid(x - .25, z - .25, x + .25, z + .25); }
function streetLamp(g, x, z) { cyl(g, .07, .09, 4.4, x, 2.2, z, '#3a3f47'); box(g, .9, .08, .14, x - .35, 4.35, z, '#3a3f47'); box(g, .4, .1, .3, x - .7, 4.28, z, '#fff6d8', glow('#ffe7a8', 1.2)); solid(x - .12, z - .12, x + .12, z + .12); }
function bench(g, x, z) { box(g, 1.8, .08, .5, x, .48, z, '#8a6a45'); box(g, 1.8, .45, .08, x, .72, z + .24, '#8a6a45'); [-1, 1].forEach(s => box(g, .08, .45, .5, x + s * .8, .23, z, '#3a3f47')); solid(x - .9, z - .3, x + .9, z + .3); }
function umbrella(g, x, z, color) { cyl(g, .03, .03, 2.3, x, 1.15, z, '#e9e9e9'); const c = new THREE.Mesh(new THREE.ConeGeometry(1.25, .45, 10), mat(color)); c.position.set(x, 2.35, z); c.castShadow = true; g.add(c); }
function lounger(g, x, z, rot, color) { const o = new THREE.Group(); o.position.set(x, 0, z); o.rotation.y = rot; g.add(o); box(o, .65, .1, 1.5, 0, .3, .2, color); box(o, .65, .08, .6, 0, .48, -.7, color); o.children[1].rotation.x = -.7; [-1, 1].forEach(s => box(o, .05, .26, 1.5, s * .3, .14, 0, '#e9e9e9')); }
function neighborHouse(g, x, z, w, d, wall0, roof, face) { // casa do vizinho (com telhado; face: 1 frente para +z, −1 para −z)
  box(g, w, 3, d, x, 1.5, z, wall0); solid(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
  const r = new THREE.Mesh(new THREE.CylinderGeometry(.01, Math.hypot(w, d) * .62, 1.6, 4), mat(roof)); r.rotation.y = Math.PI / 4; r.scale.set(w / Math.hypot(w, d) * 1.45, 1, d / Math.hypot(w, d) * 1.45); r.position.set(x, 3.8, z); r.castShadow = true; g.add(r);
  box(g, 1, 2, .1, x, 1, z + face * (d / 2 + .02), '#6b4f3a'); [-1, 1].forEach(s => box(g, 1.2, .9, .1, x + s * w * .28, 1.6, z + face * (d / 2 + .03), '#9fd3f5', { metalness: .3, roughness: .15 }));
  for (let i = -2; i <= 2; i++) box(g, .5, .7, .5, x + i * (w / 5), .35, z + face * (d / 2 + 1.4), '#4f9a52');
}
function sign(g, text, sub, x, y, z, sx = 3.6) { const s = label(text, sub); s.position.set(x, y, z); s.scale.set(sx, sx / 4, 1); g.add(s); return s; }

// ---------- local do torneio (andar por ele; a sua quadra abre a partida) ----------
const VX = 200, VZ = -30; // na orla, ligado à rua do bairro (dá para ir andando)
const mulberry = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; // posição do local do torneio dentro do bairro (longe da casa)
const FAN_COLS = ['#ff6a00', '#2457c5', '#e63946', '#2a9d8f', '#ffd23f', '#f4f4f4', '#6b4f7a', '#1d1d20', '#7fb069', '#ff8fab'];
const SKINS = ['#f1c9a5', '#d9a982', '#b07a52', '#7a4e32', '#e8b48f'];
function fan(g, x, z, rot, seed, sit) { // pessoa simples (corpo, cabeça, braços); sit: sentada na arquibancada
  const o = new THREE.Group(); o.position.set(x, 0, z); o.rotation.y = rot; g.add(o);
  const c = FAN_COLS[seed % FAN_COLS.length], s = SKINS[(seed * 7) % SKINS.length], h = .9 + (seed % 5) * .04;
  if (!sit) { box(o, .14, .8 * h, .14, -.1, .4 * h, 0, '#2b3445'); box(o, .14, .8 * h, .14, .1, .4 * h, 0, '#2b3445'); }
  box(o, .44, .6 * h, .26, 0, (sit ? .55 : .8 * h + .3 * h), 0, c); const hd = new THREE.Mesh(new THREE.SphereGeometry(.15, 10, 8), mat(s)); hd.position.set(0, (sit ? .55 : 1.1 * h) + .5 * h, 0); hd.castShadow = true; o.add(hd);
  if (seed % 3 === 0) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .08, 10), mat(FAN_COLS[(seed + 3) % FAN_COLS.length])); cap.position.set(0, hd.position.y + .12, 0); o.add(cap); }
  [-1, 1].forEach(a => box(o, .1, .55 * h, .1, a * .28, (sit ? .55 : 1.1 * h) - .05, 0, s));
  if (!sit && seed % 4 === 1) { const b = racketBag(BAG_COLS[seed % BAG_COLS.length]); b.position.set(0, 1.05 * h, .2); b.scale.setScalar(.85); o.add(b); } // raqueteira nas costas
  return o;
}
// cores da raqueteira pela marca da raquete (enquanto não compra outra na loja)
function bagOfRacket() { const r = String(S.settings.racket || ''); let h = 0; for (const ch of r) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return BAG_COLS[h % BAG_COLS.length]; }
// raqueteira (bolsa de raquetes): corpo comprido com faixa e alça, usada nas costas na diagonal
const BAG_COLS = [['#111214', '#e30613'], ['#1f4fb8', '#ffffff'], ['#ff6a00', '#111214'], ['#0a7d3c', '#ffd23f'], ['#e9e9e9', '#2457c5'], ['#6b2737', '#f2c14e']];
function racketBag(c) {
  const o = new THREE.Group(), [a, b] = c;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.13, .62, 4, 10), mat(a, { roughness: .6 })); body.scale.z = .55; o.add(body);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(.132, .132, .1, 12), mat(b)); st.scale.z = .56; st.position.y = .14; o.add(st);
  const zip = new THREE.Mesh(new THREE.BoxGeometry(.02, .7, .02), mat('#d9d9d9', { metalness: .6, roughness: .3 })); zip.position.z = .075; o.add(zip);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(.32, .018, 6, 18, Math.PI * .9), mat('#1d1d20')); strap.rotation.set(0, Math.PI / 2, -.2); strap.position.set(0, .05, -.12); o.add(strap);
  o.rotation.z = .55; o.traverse(m => { if (m.isMesh) m.castShadow = true; }); return o;
}
// faixa/placa com marca (painel com o nome, nas cores da marca)
function banner(g, text, x, y, z, w, h, bg, fg, rot = 0, sub) {
  const t = canvasTex(512, Math.round(512 * h / w), (c, W, H) => { c.fillStyle = bg; c.fillRect(0, 0, W, H); c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '900 italic ' + Math.round(H * (sub ? .46 : .62)) + 'px Barlow Condensed, Arial Narrow, Arial'; c.fillText(String(text).toUpperCase(), W / 2, H * (sub ? .4 : .52), W * .92);
    if (sub) { c.font = '700 ' + Math.round(H * .2) + 'px Arial'; c.globalAlpha = .85; c.fillText(sub, W / 2, H * .8, W * .9); } }, true);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: .7, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.y = rot; g.add(m); return m;
}
// cadeira de plástico (de frente para rot)
function chair(g, x, z, rot, col = '#f4f4f4') { const o = new THREE.Group(); o.position.set(x, 0, z); o.rotation.y = rot; g.add(o); box(o, .46, .05, .44, 0, .44, 0, col); box(o, .46, .46, .05, 0, .68, -.2, col); [-1, 1].forEach(a => [-1, 1].forEach(b => box(o, .04, .44, .04, a * .2, .22, b * .18, col))); return o; }
// pessoa deitada (tomando sol na toalha)
function sunbather(g, x, z, rot, seed) { const o = new THREE.Group(); o.position.set(x, 0, z); o.rotation.y = rot; g.add(o);
  box(o, .75, .02, 1.9, 0, .02, 0, FAN_COLS[(seed + 2) % FAN_COLS.length]); const s = SKINS[(seed * 7) % SKINS.length];
  box(o, .4, .2, .62, 0, .14, -.1, FAN_COLS[seed % FAN_COLS.length]); box(o, .32, .16, .8, 0, .1, .58, s); const hd = new THREE.Mesh(new THREE.SphereGeometry(.14, 10, 8), mat(s)); hd.position.set(0, .15, -.58); o.add(hd); return o; }
function courtAt(g, x, z, n, center, A) {
  const cw = 8, cl = 16, rows = center ? A.rows : 0, lc = A.line || '#1f4fb8', seat = A.seat || '#2457c5';
  box(g, cw + 6, .06, cl + 8, x, .05, z, '#f1e2b8', { noShadow: true }); (LV.noSpawn || (LV.noSpawn = [])).push([x - cw / 2 - 3.5, z - cl / 2 - 4, x + cw / 2 + 3.5, z + cl / 2 + 4]);
  const line = (w, d, lx, lz) => box(g, w, .02, d, x + lx, .09, z + lz, lc, { noShadow: true });
  line(cw, .06, 0, -cl / 2); line(cw, .06, 0, cl / 2); line(.06, cl, -cw / 2, 0); line(.06, cl, cw / 2, 0);
  box(g, cw + .6, .9, .03, x, 1.25, z, '#ffffff', { transparent: true, opacity: .45 }); box(g, cw + .6, .07, .05, x, 1.72, z, lc); [-1, 1].forEach(s => box(g, .1, 1.75, .1, x + s * (cw / 2 + .3), .88, z, lc));
  solid(x - cw / 2 - .4, z - .1, x + cw / 2 + .4, z + .1);
  if (center && rows > 0) { // arquibancadas dos dois lados (e no fundo nos grandes), cheias; placa grande
    [-1, 1].forEach(s => { for (let k = 0; k < rows; k++) { box(g, 1, .5, cl + 6, x + s * (cw / 2 + 4 + k), .25 + k * .5, z, seat); }
      solid(x + s * (cw / 2 + 3.5) - (s < 0 ? rows : 0), z - cl / 2 - 3, x + s * (cw / 2 + 3.5) + (s > 0 ? rows : 0), z + cl / 2 + 3);
      for (let k = 0; k < rows; k++) for (let i = 0; i < 14; i++) if ((i * 7 + k * 3) % (A.full ? 7 : 4)) fan(g, x + s * (cw / 2 + 4 + k), z - cl / 2 - 1.5 + i * 1.35, -s * Math.PI / 2, i * 3 + k * 5, true).position.y = .5 + k * .5; });
    if (A.back) { for (let k = 0; k < 5; k++) box(g, cw + 21, .5, 1, x, .25 + k * .5, z - cl / 2 - 4.5 - k, seat);
      solid(x - cw / 2 - 10, z - cl / 2 - 10, x + cw / 2 + 10, z - cl / 2 - 4);
      for (let k = 0; k < 5; k++) for (let i = 0; i < 16; i++) if ((i * 5 + k) % 4) fan(g, x - 10 + i * 1.35, z - cl / 2 - 4.5 - k, 0, i + k * 9, true).position.y = .5 + k * .5; }
    // faixas da marca do torneio em volta da quadra
    if (A.master) [-1, 1].forEach(s => banner(g, A.master, x + s * (cw / 2 + 3.2), .45, z, cl, .7, A.mbg, A.mfg, s * Math.PI / 2));
    if (A.screen) { box(g, 9, 5, .4, x, 7.2, z - cl / 2 - (A.back ? 11.5 : 5), '#111214'); banner(g, A.name, x, 7.2, z - cl / 2 - (A.back ? 11.3 : 4.78), 8.4, 4.4, '#0b1a3a', '#ffffff', 0, 'AO VIVO · QUADRA CENTRAL'); }
    sign(g, 'Quadra Central', '', x, 6.2, z - cl / 2 - (A.back ? 9.6 : 3.5), 7);
  } else {
    // cadeiras dos dois lados da quadra, com gente sentada assistindo (mais gente nos torneios maiores)
    [-1, 1].forEach(s => { for (let r = 0; r < (center ? 2 : 1); r++) for (let i = 0; i < 7; i++) { const cx2 = x + s * (cw / 2 + 2 + r * .8), cz2 = z - 5.4 + i * 1.8;
        chair(g, cx2, cz2, -s * Math.PI / 2, A.chair); if ((i * 3 + r + n) % 10 < A.sitK) fan(g, cx2, cz2, -s * Math.PI / 2, i * 5 + n * 3 + r, true).position.y = -.05; }
      solid(x + s * (cw / 2 + 2) - .3, z - 6, x + s * (cw / 2 + 2 + (center ? 1.1 : .3)), z + 6.6); });
    sign(g, center ? 'Quadra Central' : 'Quadra ' + n, '', x - cw / 2 - 2.5, 2.4, z - cl / 2 - 1, 2.6);
  }
}
// cara do evento: nível (tamanho, público), marca master e cores do local
function venueLook(t) {
  let ar = {}; try { ar = arenaFor(true) || {}; } catch (e) {}
  const size = ar.size == null ? 2 : ar.size, mcol = { NUX: ['#111214', '#ffffff'], "HERUE'S": ['#e30613', '#ffffff'], KUNA: ['#ffd23f', '#111214'], 'ANA SPORT': ['#1f4fb8', '#ffffff'], MORMAJI: ['#0b0b0b', '#f2c14e'], 'DROP SHUT': ['#ff6a00', '#111214'], ZANB: ['#2a9d8f', '#ffffff'], VIZION: ['#6b2fb8', '#ffffff'] }[ar.master] || ['#ff6a00', '#ffffff'];
  return { size, rows: [0, 3, 6, 8][size], back: size >= 2, screen: size >= 2, full: size >= 3, sitK: [2, 4, 6, 8][size], nFans: [18, 32, 50, 75][size], nCourts: size === 0 ? 2 : 4,
    line: ar.line, seat: ar.seat, trim: ar.trim || '#1d2a4a', chair: size >= 2 ? '#f4f4f4' : '#e8e2d2', master: ar.master || '', mbg: mcol[0], mfg: mcol[1], name: String(t.name || '').replace(/ · .*$/, '') };
}
function buildVenue(g, sp) {
  const t = $s.CR.tour; if (!t) return;
  const S2 = (id, x, z, ti, su, r) => spot(sp, id, x, z, ti, su, r), A = venueLook(t);
  const name = A.name || 'Torneio', FZ = VZ + 44; // FZ: cerca da frente (a rua fica logo depois)
  box(g, 106, .1, 94, VX, -.03, VZ - 3, '#efe0b9', { noShadow: true });
  // cerca de evento com faixas (marca master, patrocinadores e o nome do torneio); entrada larga na frente
  const fence = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), r = Math.atan2(-(z1 - z0), x1 - x0); box(g, L, 1.1, .08, (x0 + x1) / 2, .55, (z0 + z1) / 2, A.trim).rotation.y = r; solid(x0, z0 - .1, x1, z1 + .1); };
  fence(VX - 52, VZ - 50, VX + 52, VZ - 50); fence(VX - 52, FZ, VX - 7, FZ); fence(VX + 7, FZ, VX + 52, FZ);
  box(g, .08, 1.1, FZ - VZ + 50, VX - 52, .55, (FZ + VZ - 50) / 2, A.trim); solid(VX - 52.1, VZ - 50, VX - 51.9, FZ); box(g, .08, 1.1, FZ - VZ + 50, VX + 52, .55, (FZ + VZ - 50) / 2, A.trim); solid(VX + 51.9, VZ - 50, VX + 52.1, FZ);
  const BR = [A.master, ...(($s.CR.sponsors || []).map(x => x.brand)), $s.CR.master && $s.CR.master.brand, 'Coco Gelado', 'Solar Max', 'Ondas Telecom'].filter(Boolean);
  for (let i = 0; i < 10; i++) { const br = BR[i % BR.length], c = i % 2 ? [A.mbg, A.mfg] : ['#ffffff', '#1d2a4a'];
    banner(g, br, VX - 46 + i * 10.2, .6, FZ + .06, 8, .9, c[0], c[1]); banner(g, br, VX - 46 + i * 10.2, .6, VZ - 49.94, 8, .9, c[0], c[1]); }
  box(g, 4, .05, 30, VX, .04, VZ + 26, '#d8cdb5', { noShadow: true }); box(g, 70, .05, 4, VX, .04, VZ - 2, '#d8cdb5', { noShadow: true });
  // quadras: central no fundo, laterais (duas no amador)
  courtAt(g, VX, VZ - 22, 0, true, A);
  const SIDE = [[VX - 24, VZ - 18], [VX + 24, VZ - 18], [VX - 24, VZ + 14], [VX + 24, VZ + 14]].slice(0, A.nCourts);
  SIDE.forEach(([x, z], i) => courtAt(g, x, z, i + 1, false, A));
  // jogadores aquecendo nas quadras laterais (com as raqueteiras no banco)
  SIDE.forEach(([x, z], i) => { if (i === 3) return; [-1, 1].forEach(s => fan(g, x + s * 1.5, z + s * 5, s > 0 ? Math.PI : 0, 40 + i * 2 + s, false)); const bg = racketBag(BAG_COLS[i % BAG_COLS.length]); bg.rotation.set(Math.PI / 2, 0, .2); bg.position.set(x + 6.2, .14, z + 7.2); g.add(bg); });
  // entrada com o pórtico e o nome do torneio; bandeiras de marca dos dois lados do caminho
  [-1, 1].forEach(s => { box(g, .6, 5, .6, VX + s * 5, 2.5, VZ + 38, '#1d2a4a'); solid(VX + s * 5 - .3, VZ + 37.7, VX + s * 5 + .3, VZ + 38.3); });
  box(g, 11, 1.4, .3, VX, 5.2, VZ + 38, A.mbg); sign(g, name, crTourT(t).nome || '', VX, 5.2, VZ + 37.6, 8.5);
  for (let i = 0; i < 4; i++) [-1, 1].forEach(s => { const fx = VX + s * 3.2, fz = VZ + 33 - i * 6; cyl(g, .03, .03, 3.4, fx, 1.7, fz, '#cfd3d8'); banner(g, BR[(i + (s > 0 ? 1 : 0)) % BR.length], fx + s * .35, 2.3, fz, .7, 2.2, i % 2 ? A.mbg : '#ffffff', i % 2 ? A.mfg : '#1d2a4a', Math.PI / 2); });
  S2('casaVolta', VX - 10, VZ + 40, 'Táxi', 'Voltar para casa');
  // tendas: patrocinador, comida, área dos atletas e marcas (mais tendas nos torneios maiores)
  const brand = ($s.CR.master && $s.CR.master.brand) || A.master || 'Herue\'s';
  const tent = (x, z, col, title, sub) => { box(g, 6, .12, 5, x, 2.9, z, col); [-1, 1].forEach(a => [-1, 1].forEach(b => { cyl(g, .06, .06, 2.9, x + a * 2.8, 1.45, z + b * 2.3, '#e9e9e9'); })); box(g, 5, .9, 1, x, .45, z - 1.5, '#f4f4f4'); solid(x - 2.6, z - 2.1, x + 2.6, z - .9);
    banner(g, title, x, 3.25, z + 2.52, 6, .6, col, '#ffffff', 0, sub); banner(g, title, x, 3.25, z - 2.52, 6, .6, col, '#ffffff', Math.PI, sub); };
  tent(VX - 12, VZ + 26, '#e30613', 'Estande ' + brand); S2('estande', VX - 12, VZ + 24, 'Estande ' + brand, 'Ação com fãs e brindes', .9);
  tent(VX + 12, VZ + 26, '#2a9d8f', 'Comida'); S2('comida', VX + 12, VZ + 24, 'Comida', 'Lanche e água', .9);
  tent(VX + 12, VZ + 4, '#1d2a4a', 'Área dos atletas'); S2('atletas', VX + 12, VZ + 6.2, 'Área dos atletas', t.mate || $s.CR.partner ? 'Conversar com a dupla' : 'Descansar', .9);
  const extra = [['#111214', 'NUX'], ['#ffd23f', 'KUNA'], ['#1f4fb8', 'ANA SPORT'], ['#6b2fb8', 'VIZION'], ['#2a9d8f', 'ZANB'], ['#ff6a00', 'DROP SHUT']].filter(e => e[1] !== A.master).slice(0, [0, 2, 4, 6][A.size]);
  const ET = [[VX - 40, VZ + 30], [VX + 40, VZ + 30], [VX - 40, VZ + 2], [VX + 40, VZ + 2], [VX - 26, VZ + 34], [VX + 26, VZ + 34]];
  extra.forEach(([c, b], i) => tent(ET[i][0], ET[i][1], c, b, 'Raquetes e acessórios'));
  if (A.size >= 3) { tent(VX - 12, VZ - 2 - 6, '#0b1a3a', 'Área VIP'); }
  if (t.mate || $s.CR.partner) fan(g, VX + 13.5, VZ + 4.5, Math.PI, 77, false);
  // painel com a chave
  box(g, 5, 3, .2, VX - 12, 1.9, VZ + 4, '#0d1b3a'); banner(g, name, VX - 12, 1.9, VZ + 4.12, 4.6, 2.6, '#183a7a', '#ffffff', 0, 'CHAVE · RESULTADOS'); solid(VX - 14.5, VZ + 3.8, VX - 9.5, VZ + 4.2);
  S2('chave', VX - 12, VZ + 6, 'Chave do torneio', 'Ver jogos e resultados', .9);
  // a sua partida: na central nas semifinais e finais, no Mundial e nas seleções, e quando joga uma dupla cabeça de chave; senão numa quadra lateral
  const mm = crMyMatch();
  if (mm) { const opp = t.teams[mm.a === t.me ? mm.b : mm.a], imp = crIsCentral();
    const i = t.rounds[t.round].indexOf(mm), [mx, mz] = imp ? [VX, VZ - 22] : SIDE[i % SIDE.length];
    LV.myCourt = { x: mx, z: mz + (imp ? 10.5 : 10), vs: crTeamName(opp).replace(/^.* · /, ''), name: imp ? 'Quadra Central' : 'Quadra ' + (i % SIDE.length + 1), round: crRoundNames(crNRounds())[t.round] };
    S2('partida', LV.myCourt.x, LV.myCourt.z, 'Sua partida · ' + LV.myCourt.round, 'vs ' + LV.myCourt.vs, 1.3);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(.5, 1.1, 4), mat('#b6ff3c', glow('#b6ff3c', 1.4))); arrow.rotation.x = Math.PI; arrow.position.set(mx, 4.2, LV.myCourt.z); arrow.userData.spin = true; sp.add(arrow); LV.arrow = arrow;
    // coluna de luz sobre a sua quadra: dá para ver de qualquer ponto do evento
    { const bm = new THREE.MeshBasicMaterial({ color: '#b6ff3c', transparent: true, opacity: .22, depthWrite: false }); const beam = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, 40, 16, 1, true), bm); beam.position.set(mx, 20, LV.myCourt.z); beam.userData.dyn = true; sp.add(beam); }
  } else LV.myCourt = null;
  // fãs pelo local: parados (dá para tirar foto e dar autógrafo) e alguns andando
  LV.fans = [];
  const R = mulberry(($s.CR.seed || 1) + (t.round || 0) * 17 + (t.day || 0));
  for (let k = 0; k < A.nFans; k++) { let x, z, n = 0; do { x = VX - 48 + R() * 96; z = VZ - 4 + R() * 46; n++; } while (n < 30 && (Math.abs(x - VX) < 2.5 || blocked(x, z, 1.2) || (LV.noSpawn || []).some(([x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1)));
    const f = fan(g, x, z, R() * 6.28, k + 3, false); f.userData.dyn = true; LV.fans.push({ o: f, x, z, walk: k % 5 === 0, a: R() * 6.28, done: false }); }
}
const FAN_LINES = ['Posso tirar uma foto com você? Minha filha joga beach tennis por sua causa!', 'Assina a minha viseira? Vou guardar pra sempre!', 'Vim de longe só para te ver jogar. Boa sorte hoje!', 'Aquele smash na semana passada foi absurdo!', 'Você é meu jogador favorito do circuito!', 'Me dá uma dica de saque? Eu travo sempre no lançamento.', 'Uma selfie rapidinha? Prometo que é só uma!', 'Autografa a minha bola? É a do meu primeiro torneio!', 'Te vi crescer desde o amador. Que orgulho!', 'Vai ganhar hoje, hein? Tô confiante!'];

// ---------- a cidade em volta: lojas e restaurante na rua, gente na calçada e na praia, carros passando ----------
const SHOPS = [['Café Maré', '#7a4e32', '#f2c14e', 'cafe'], ['Açaí da Praia', '#6b2fb8', '#b6ff3c', 'acai'], ['Pro Shop', '#111214', '#ff6a00', 'loja'], ['Restaurante Maré', '#1d3b5a', '#e9c46a', 'rest'],
  ['Surf & Beach', '#2a9d8f', '#ffffff', ''], ['Mercado Sol', '#c0392b', '#ffd23f', ''], ['Sorveteria Onda', '#ff8fab', '#ffffff', 'sorvete'], ['Farmácia', '#0a7d3c', '#ffffff', ''], ['Academia Fit', '#2457c5', '#b6ff3c', '']];
function city(g, sp) {
  const R = mulberry(($s.CR.seed || 7) * 3 + 11), dyn = o => { o.userData.dyn = true; sp.add(o); return o; };
  const pro = ($s.CR.master && $s.CR.master.brand) || 'Pro Shop';
  // lojas do outro lado da rua (depois da arena e do CT), cada uma com fachada, toldo e letreiro próprios
  let x = 94;
  SHOPS.forEach(([nm0, wallC, awn, kind], i) => {
    const nm = kind === 'loja' ? pro + ' Store' : nm0, w = kind === 'rest' ? 18 : 12, cx = x + w / 2, z0 = 33, d = 9; x += w + 4;
    box(g, w, 4.2, d, cx, 2.1, z0 + d / 2, wallC); solid(cx - w / 2, z0, cx + w / 2, z0 + d);
    box(g, w * .8, 2.4, .06, cx, 1.5, z0 - .02, '#9fd3ea', { transparent: true, opacity: .55, roughness: .1, metalness: .3 });
    const aw = new THREE.Mesh(new THREE.BoxGeometry(w + .4, .1, 2), mat(awn)); aw.position.set(cx, 3.1, z0 - .9); aw.rotation.x = -.25; aw.castShadow = true; g.add(aw);
    banner(g, nm, cx, 3.75, z0 - .06, w * .8, .9, wallC, awn, Math.PI);
    if (kind === 'rest' || kind === 'cafe' || kind === 'acai' || kind === 'sorvete') { // mesas na calçada com gente
      const nT = kind === 'rest' ? 4 : 2;
      for (let k = 0; k < nT; k++) { const tx = cx - (nT - 1) * 2 + k * 4, tz = z0 - 2.6; cyl(g, .45, .45, .05, tx, .74, tz, '#f4f4f4'); cyl(g, .05, .05, .74, tx, .37, tz, '#3a3f47'); solid(tx - .5, tz - .5, tx + .5, tz + .5);
        if (kind === 'rest') umbrella(g, tx, tz, k % 2 ? awn : '#ffffff');
        [-1, 1].forEach(sd => { chair(g, tx + sd * .85, tz, sd * Math.PI / 2 * -1 + (sd > 0 ? 0 : 0), '#f4f4f4'); if (R() < .7) fan(g, tx + sd * .85, tz, -sd * Math.PI / 2, 60 + i * 7 + k * 3 + (sd > 0 ? 1 : 0), true).position.y = -.05; }); }
    }
    if (kind === 'rest') spot(sp, 'restaurante', cx, z0 - 4.6, nm, 'Almoçar fora (+6 energia)');
    if (kind === 'acai') spot(sp, 'acai', cx, z0 - 4.4, nm, 'Açaí pós-treino');
    if (kind === 'loja') spot(sp, 'loja', cx, z0 - 2, nm, 'Raquetes, roupas e raqueteiras');
  });
  // vôlei de praia e quiosque entre o bairro e o local do torneio
  { const vx = 118, vz = -40; box(g, 9, .9, .03, vx, 1.9, vz, '#ffffff', { transparent: true, opacity: .5 }); [-1, 1].forEach(s => cyl(g, .05, .05, 2.4, vx + s * 4.6, 1.2, vz, '#3a3f47')); solid(vx - 4.6, vz - .1, vx + 4.6, vz + .1);
    [[-2, -3], [2, -3.4], [-2.2, 3], [2.4, 3.3]].forEach(([a, b], k) => fan(g, vx + a, vz + b, b > 0 ? Math.PI : 0, 90 + k, false)); }
  // sem torneio na semana: quadras públicas na orla, com a galera jogando
  if (!($s.CR.tour && !$s.CR.tour.pending && !$s.CR.tour.done)) {
    const A = { rows: 0, sitK: 3, chair: '#e8e2d2', line: '#1f4fb8' };
    [[VX - 16, VZ - 10], [VX + 16, VZ - 10], [VX, VZ + 16]].forEach(([cx, cz], i) => { courtAt(g, cx, cz, i + 1, false, A); [-1, 1].forEach(s => [-1, 1].forEach(q => fan(g, cx + q * 1.8, cz + s * 5.2, s > 0 ? Math.PI : 0, 30 + i * 4 + q + s * 2, false))); });
    banner(g, 'Quadras da Orla', VX, 2.8, VZ + 30, 8, 1.2, '#1f4fb8', '#ffffff', 0, 'beach tennis público'); cyl(g, .06, .06, 2.8, VX - 3.6, 1.4, VZ + 30, '#3a3f47'); cyl(g, .06, .06, 2.8, VX + 3.6, 1.4, VZ + 30, '#3a3f47');
    spot(sp, 'orla', VX, VZ + 6, 'Quadras da Orla', 'Jogar com a galera (desafio)');
  }
  // praia: guarda-sóis com gente tomando sol, gente na água, frescobol
  for (let k = 0; k < 34; k++) { const bx = -50 + R() * 330, bz = -48 - R() * 34; if (bx > VX - 56 && bx < VX + 56 && bz > VZ - 52) continue; if (blocked(bx, bz, 2)) continue;
    if (k % 3 === 0) umbrella(g, bx, bz, FAN_COLS[k % FAN_COLS.length]); sunbather(g, bx + 1.2, bz + .6, R() * .6 - .3, k); }
  for (let k = 0; k < 16; k++) { const f = fan(g, -50 + R() * 330, -89.5 - R() * 5, R() * 6.28, 120 + k, false); f.position.y = -.55 - R() * .3; } // na água
  for (let k = 0; k < 5; k++) { const fx = -40 + k * 60 + R() * 20, fz = -70 + R() * 10; if (fx > VX - 56 && fx < VX + 56) continue;
    const a = dyn(fan(new THREE.Group(), fx - 3, fz, -Math.PI / 2, 140 + k, false)), b = dyn(fan(new THREE.Group(), fx + 3, fz, Math.PI / 2, 150 + k, false));
    LV.npcs.push({ kind: 'fresco', a, b, x: fx, ph: R() * 6 }); }
  // calçadas: gente caminhando (algumas com raqueteira), carros passando na rua
  for (let k = 0; k < 22; k++) { const z = (k % 2 ? 19.2 : 28.8) + (R() - .5) * .8, x0 = -50 + R() * 320, o = dyn(fan(new THREE.Group(), x0, z, 0, 200 + k, false));
    LV.npcs.push({ kind: 'walk', o, x: x0, z, v: (k % 2 ? 1 : -1) * (.9 + R() * .6), x0: -55, x1: 285 }); }
  for (let k = 0; k < 4; k++) { const tmp = new THREE.Group(), east = k % 2 === 0; car(tmp, 0, 0, 0, ['#e63946', '#f4f4f4', '#2457c5', '#ffd23f'][k], k === 3); LV.boxes.pop(); const o = dyn(tmp); o.position.set(-90 + k * 95, 0, east ? 22.6 : 25.4); o.rotation.y = east ? 0 : Math.PI;
    LV.npcs.push({ kind: 'car', o, v: east ? 9 : -9 }); }
}
// a cada quadro: gente andando, frescobol, carros
function npcTick(dt, px, pz) {
  const t = performance.now() / 1000;
  for (const n of LV.npcs || []) {
    if (n.kind === 'walk') { n.x += n.v * dt; if (n.x > n.x1 || n.x < n.x0) { n.v = -n.v; n.x = Math.max(n.x0, Math.min(n.x1, n.x)); }
      // desvia do jogador
      const dz = Math.abs(n.x - px) < 1.2 && Math.abs(n.z - pz) < 1.2 ? (n.z > pz ? .8 : -.8) : 0;
      n.o.position.set(n.x, Math.abs(Math.sin(t * 7 + n.z)) * .04, n.z + dz); n.o.rotation.y = n.v > 0 ? -Math.PI / 2 : Math.PI / 2; }
    else if (n.kind === 'fresco') { const sw = Math.sin(t * 2.2 + n.ph); n.a.position.x = n.x - 3 + sw * .3; n.b.position.x = n.x + 3 + sw * .3; }
    else if (n.kind === 'car') { n.o.position.x += n.v * dt; if (n.o.position.x > 298) n.o.position.x = -98; if (n.o.position.x < -98) n.o.position.x = 298;
      // freia se o jogador está na frente, na rua
      if (Math.abs(n.o.position.z - pz) < 1.6 && (n.v > 0 ? px - n.o.position.x : n.o.position.x - px) > 0 && Math.abs(px - n.o.position.x) < 6) n.o.position.x -= n.v * dt; }
  }
}
function build() {
  const lvl = crInv('moradia'), key = ['quadra', 'ct', 'moradia', 'gastro', 'esports', 'midia', 'saude', 'jato', 'eventos'].map(crInv).join('') + ['carro', 'casa', 'crio', 'nutri', 'social'].map(k => crLife(k) ? 1 : 0).join('') + '|' + Object.values($s.CR.titles || {}).reduce((a, b) => a + b, 0) + '|' + (($s.CR.tour && !$s.CR.tour.pending && !$s.CR.tour.done) ? $s.CR.tour.name + $s.CR.tour.round + $s.CR.tour.day + (crMyMatch() ? 1 : 0) : '');
  if (LV.group && LV.built === key) return;
  if (LV.group) { scene.remove(LV.group); LV.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  LV.built = key; LV.spots = []; LV.boxes = []; LV.noSpawn = []; LV.npcs = [];
  const g = new THREE.Group(); g.position.copy(H0); LV.group = g; scene.add(g);
  const sp = new THREE.Group(); g.add(sp); sp.userData.dyn = true; // pontos de interação (fora da junção)
  const S2 = (id, x, z, t, s, r) => spot(sp, id, x, z, t, s, r);
  const court = crInv('quadra') >= 1 || lvl >= 3, lights = crInv('quadra') >= 2 || lvl >= 3;
  // ---- chão: areia da praia ao norte, terrenos com grama, calçadas e a rua ----
  box(g, 400, .2, 213, 100, -.12, 18.5, '#e8d7ae', { noShadow: true }); // (a areia vai até o mar da cena, em z −88)
  solid(-60, -87, 290, -86); // beira do mar (o mar é o da cena, o mesmo da quadra: some a emenda com o local do torneio)
  const lotW = [14, 17, 22, 30][lvl], lotD = [12, 14, 18, 24][lvl];
  box(g, lotW + 18, .05, lotD + 6, court ? 6 : 0, .02, 1, lvl >= 2 ? '#6aa65a' : '#7fb069', { noShadow: true });
  box(g, 400, .06, 8, 100, .03, 24, '#3a3f47', { noShadow: true }); for (let i = -98; i < 300; i += 5) box(g, 2.2, .02, .18, i, .07, 24, '#f2f2f2', { noShadow: true });
  [19.2, 28.8].forEach(z => { box(g, 400, .14, 2.4, 100, .07, z, '#cfcac0', { noShadow: true }); box(g, 400, .16, .12, 100, .08, z + (z < 24 ? 1.2 : -1.2), '#9e9a92', { noShadow: true }); });
  box(g, 2.2, .05, 13, 0, .05, 12.5, '#cfcac0', { noShadow: true }); // caminho até a porta
  // ---- casa ----
  const W = [12, 14, 18, 24][lvl], D = [10, 11, 13, 16][lvl], hW = W / 2, hD = D / 2; LV.house = [hW, hD]; const WH = [2.6, 2.8, 3, 3.3][lvl];
  const wc = ['#e9e2d4', '#f1ece2', '#f6f3ee', '#fbfaf7'][lvl], floor = ['#a77d55', '#b98b5e', '#c49a6c', '#d6cdbf'][lvl];
  box(g, W, .08, D, 0, .04, 0, floor, { noShadow: true, roughness: lvl >= 3 ? .3 : .8 });
  if (lvl >= 1) box(g, W + .6, .3, D + .6, 0, -.05, 0, '#d8d2c6', { noShadow: true });
  wall(g, -hW, -hD, hW, -hD, WH, wc, lvl >= 2 ? [[-1.4, 1.4]] : [], true);           // fundo (na mansão e na casa com piscina: porta para a área da piscina)
  wall(g, -hW, -hD, -hW, hD, WH, wc, [], true); wall(g, hW, -hD, hW, hD, WH, wc, [], true);
  wall(g, -hW, hD, hW, hD, WH, wc, [[-1.2, 1.2]], true);
  if (lvl >= 2) [-1, 1].forEach(s => box(g, .25, WH + .1, .25, s * 1.5, (WH + .1) / 2, hD + .12, '#c9a97c')); // batentes da porta grandes
  // quarto (fundo à direita)
  const bx = hW - 4.6;
  wall(g, bx, -hD, bx, -hD + 4.4, WH, wc, [[-hD + 3.2, -hD + 4.4]]);
  bed(g, lvl >= 2 ? 1.9 : 1.4, hW - 2.2, -hD + 1.4, 0, ['#3d5a80', '#4a6fa5', '#7a5c8e', '#2b2d42'][lvl]);
  box(g, .5, .5, .45, hW - .5, .25, -hD + .5, '#6b4f3a'); lamp(g, bx + .6, -hD + .6, true);
  S2('cama', hW - 2.2, -hD + 3.2, 'Cama', 'Descansar', .9);
  // sala: sofá e TV na parede do fundo, tapete
  const tvx = -hW + (lvl >= 2 ? 6.5 : 3.6);
  tvSet(g, [1.6, 2, 2.4, 3][lvl], tvx, -hD + .4, 0, lvl >= 3);
  sofa(g, [2.4, 2.8, 3.4, 4.2][lvl], tvx, -hD + 3.5, 0, ['#e07a5f', '#4a7c8c', '#c9a97c', '#2f3e46'][lvl]);
  if (lvl >= 2) sofa(g, 2, tvx - 2.6, -hD + 2.2, 1, ['#e07a5f', '#4a7c8c', '#c9a97c', '#2f3e46'][lvl]);
  rug(g, 3.4 + lvl * .4, 2.2 + lvl * .2, tvx, -hD + 2.4, ['#c9b79c', '#8fb3c4', '#e9dcc6', '#6b2737'][lvl]);
  S2('tv', tvx + 1.6, -hD + 2.2, 'TV', 'Notícias e entrevistas', .8);
  // troféus (na mansão, parede inteira)
  const nT = Object.values($s.CR.titles || {}).reduce((a, b) => a + b, 0);
  shelfTrophies(g, -hW + .35, hD - 2.4, 1, nT, lvl >= 3);
  S2('trofeus', -hW + 1.6, hD - 2.4, 'Troféus', nT + ' títulos', .8);
  // cozinha (a partir do apartamento)
  if (lvl >= 1) kitchen(g, lvl >= 2 ? -hW + .4 : -hW + .3, -hD + .02, lvl >= 3 ? 4 : lvl >= 2 ? 3.2 : 2.4, lvl);
  else { box(g, 1.6, .9, .6, -hW + 1, .45, -hD + .35, '#d9cfc0'); box(g, .7, 1.7, .6, -hW + 2.3, .85, -hD + .35, '#cfd3d8'); solid(-hW, -hD, -hW + 2.7, -hD + .7); }
  S2('cozinha', -hW + 2, -hD + (lvl >= 2 ? 3.7 : 1.6), 'Cozinha', crLife('nutri') ? 'Cardápio do nutricionista' : 'Fazer um lanche', .8);
  // canto do computador: comum, gamer (time de eSports) ou estúdio de podcast (mídia)
  const pcx = hW - 1.6, pcz = hD - 1.6;
  desk(g, pcx, pcz, 2, crInv('esports') >= 1);
  S2('pc', pcx - 1.6, pcz, crInv('esports') >= 1 ? 'Setup gamer' : 'Computador', 'Agenda da carreira', .8);
  if (crInv('midia') >= 1) { podcast(g, hW - 2.8, hD - 4.2); S2('podcast', hW - 3, hD - 3, 'Estúdio', crInv('midia') >= 2 ? 'Gravar o podcast' : 'Gravar vídeo', .7); }
  // academia em casa (mansão ou CT) e banheira de gelo (crioterapia ou clínica)
  if (lvl >= 3 || crInv('ct') >= 1) { gym(g, -hW + 2, 0); S2('academia', -hW + 3.5, 1.8, 'Academia', 'Treino físico', .8); }
  if (crLife('crio') || crInv('saude') >= 1) { iceBath(g, hW - 1.2, -.6); S2('gelo', hW - 2.5, -.6, 'Banheira de gelo', 'Recuperar', .7); }
  // mesa de jantar (a partir do apartamento): na frente, à esquerda
  if (lvl >= 1) { const tx = -hW + (lvl >= 3 ? 6 : 4.2), tz = hD - (lvl >= 3 ? 5.2 : 3.6), n = lvl >= 3 ? 3 : 2;
    box(g, n * 1 + .4, .06, 1.1, tx, .78, tz, lvl >= 3 ? '#2b2d31' : '#8a6a45'); [-1, 1].forEach(a => [-1, 1].forEach(b => box(g, .07, .75, .07, tx + a * (n * .5), .38, tz + b * .45, '#3a2d22')));
    for (let i = 0; i < n; i++) [-1, 1].forEach(b => { const cx2 = tx - (n - 1) * .5 + i; box(g, .45, .45, .45, cx2, .23, tz + b * .85, lvl >= 3 ? '#f2f2f2' : '#c9a97c'); box(g, .45, .55, .06, cx2, .7, tz + b * 1.05, lvl >= 3 ? '#f2f2f2' : '#c9a97c'); });
    cyl(g, .35, .25, .05, tx, .9, tz, '#ffffff'); solid(tx - n * .5 - .3, tz - 1.2, tx + n * .5 + .3, tz + 1.2);
    if (lvl >= 2) { const c = new THREE.Mesh(new THREE.SphereGeometry(.35, 12, 10), mat('#fff3d6', glow('#ffe1a8', 1))); c.position.set(tx, WH - .5, tz); g.add(c); } }
  // casa com piscina e mansão: estante de livros, aparador e mesa de centro; mansão: piano, bar e colunas
  if (lvl >= 2) { box(g, .45, 2, 2.4, hW - .35 - (lvl >= 3 ? 0 : 0), 1, 2.2, '#4a3628'); for (let k = 0; k < 4; k++) for (let i = 0; i < 6; i++) box(g, .3, .36, .12, hW - .38, .35 + k * .5, 1.2 + i * .38, ['#c0392b', '#2457c5', '#f2c14e', '#2a9d8f', '#6b4f7a'][(i + k) % 5], { noShadow: true }); solid(hW - .6, 1, hW, 3.4);
    box(g, 1.2, .38, .7, tvx, .2, -hD + 2.3, '#3a2d22'); solid(tvx - .6, -hD + 1.95, tvx + .6, -hD + 2.65); }
  if (lvl >= 3) { box(g, 1.8, 1, 1.5, 4, .5, hD - 3.2, '#0d0d10', { roughness: .2, metalness: .2 }); box(g, 1.8, .06, 1.6, 4, 1.02, hD - 3.1, '#1a1a1e'); box(g, .6, .4, .4, 4, .2, hD - 1.9, '#0d0d10'); solid(3.1, hD - 4, 4.9, hD - 2.4);
    box(g, 3.2, 1.1, .6, -1.5, .55, -1.2, '#2b2d31'); box(g, 3.3, .06, .7, -1.5, 1.12, -1.2, '#e9e4dc'); for (let i = 0; i < 3; i++) cyl(g, .17, .17, .75, -2.5 + i, .38, -.6, '#c9a97c'); solid(-3.1, -1.5, .1, -.9);
    [[-4.5, 2.2], [1.5, 2.2]].forEach(([x, z]) => { cyl(g, .25, .25, WH, x, WH / 2, z, '#f3efe6'); solid(x - .25, z - .25, x + .25, z + .25); }); rug(g, 4, 3, 4, hD - 3, '#8b1e3f'); }
  // plantas, luminárias e quadros
  [[-hW + .5, -hD + .5 + (lvl >= 1 ? 4 : 1.5)], [hW - .5, hD - .5 - 3.5], [bx - .5, -hD + .5]].forEach(([x, z], i) => { if (i < 1 + lvl) plant(g, x, z, .9 + lvl * .1); });
  if (lvl >= 1) lamp(g, tvx - 2.3, -hD + 4.4); if (lvl >= 2) lamp(g, tvx + 2.3, -hD + 4.4);
  for (let i = 0; i < 1 + lvl; i++) box(g, 1, .7, .04, -hW + 3 + i * 2.6, 1.7, hD - .12, ['#ff6a00', '#33c3ff', '#b6ff3c', '#f2c14e'][i % 4], { noShadow: true });
  // fora: jardim, cerca/muro, caixa de correio
  [-1, 1].forEach(s => { for (let i = 0; i < 2 + lvl; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.45, 10, 8), mat('#4f9a52')); b.position.set(s * (2 + i * 1.3), .35, hD + 1.4); b.scale.y = .8; b.castShadow = true; g.add(b); } });
  const fx = (lotW + 18) / 2 + (court ? 6 : 0), fx0 = (court ? 6 : 0) - (lotW + 18) / 2;
  if (lvl >= 2) { box(g, fx - fx0, 1.2, .25, (fx + fx0) / 2, .6, -hD - 9.6, '#f0ebe1'); } // muro do fundo (para a praia, com portão)
  box(g, .3, 1, .3, 1.6, .5, hD + 6.2, '#3a3f47'); box(g, .5, .35, .3, 1.6, 1.15, hD + 6.2, '#c0392b');
  // ---- garagem: carro, van (transporte) ----
  if (crLife('carro')) car(g, -hW - 3, hD + 3, Math.PI / 2, lvl >= 3 ? '#111214' : '#2457c5');
  if (crInv('jato') >= 1) car(g, -8, 22.2, 0, '#f2f2f2', true); else { box(g, .1, 2.4, .1, -8, 1.2, 20.2, '#3a3f47'); box(g, 1.2, .5, .06, -8, 2.4, 20.2, '#2457c5'); }
  S2('torneio', -8, 19.6, crInv('jato') >= 1 ? 'Van da equipe' : 'Ponto de táxi', 'Ir ao torneio');
  // ---- piscina (casa com piscina e mansão), atrás da casa ----
  if (lvl >= 2) {
    const pw = lvl >= 3 ? 10 : 7, pd = lvl >= 3 ? 4.5 : 3.6, pz = -hD - 4.6;
    box(g, pw + 2.4, .06, pd + 2.4, 0, .05, pz, '#e9e2d4', { noShadow: true });
    box(g, pw, .05, pd, 0, .07, pz, '#3fb6e8', { roughness: .1, metalness: .2, ...glow('#54c8ff', .25) }); solid(-pw / 2, pz - pd / 2, pw / 2, pz + pd / 2);
    for (let i = 0; i < (lvl >= 3 ? 4 : 2); i++) { lounger(g, -pw / 2 + 1 + i * 2, pz + pd / 2 + 1.4, Math.PI, '#ffffff'); }
    umbrella(g, pw / 2 + .2, pz + pd / 2 + 1.6, '#ff6a00');
    S2('piscina', 0, pz + pd / 2 + .9, 'Piscina', 'Relaxar', 1);
  }
  // ---- quadra no quintal (comprada ou na mansão) ----
  const cx = hW + 9, cz = 0;
  if (court) {
    const cw = 8, cl = 16;
    box(g, cw + 5, .06, cl + 5, cx, .04, cz, '#f1e2b8', { noShadow: true });
    const line = (w, d, x, z) => box(g, w, .02, d, x, .08, z, '#1f4fb8', { noShadow: true });
    line(cw, .06, cx, cz - cl / 2); line(cw, .06, cx, cz + cl / 2); line(.06, cl, cx - cw / 2, cz); line(.06, cl, cx + cw / 2, cz);
    box(g, cw + .6, .9, .03, cx, 1.25, cz, '#ffffff', { transparent: true, opacity: .45 }); box(g, cw + .6, .06, .05, cx, 1.72, cz, '#1f4fb8'); [-1, 1].forEach(s => box(g, .1, 1.75, .1, cx + s * (cw / 2 + .3), .88, cz, '#1f4fb8'));
    solid(cx - cw / 2 - .4, cz - .1, cx + cw / 2 + .4, cz + .1);
    if (lights) [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { const x = cx + a * (cw / 2 + 2), z = cz + b * (cl / 2 + 1.5); cyl(g, .08, .1, 6, x, 3, z, '#9aa0a8'); box(g, .9, .35, .25, x - a * .3, 6, z, '#f4f4f4', glow('#ffffff', 1.6)); solid(x - .15, z - .15, x + .15, z + .15); });
    if (lights) { box(g, .6, 1.2, 6, cx + cw / 2 + 2.3, .6, cz, '#2457c5'); solid(cx + cw / 2 + 2, cz - 3, cx + cw / 2 + 2.6, cz + 3); }
    S2('quadraDesafio', cx, cz + 5, lvl >= 3 && crInv('quadra') < 1 ? 'Quadra da mansão' : 'Sua quadra', 'Treino com desafio');
    S2('quadraTreino', cx, cz - 5, lvl >= 3 && crInv('quadra') < 1 ? 'Quadra da mansão' : 'Sua quadra', 'Treino físico e técnico');
  } else { sign(g, 'Quadra própria', 'Compre em Negócios', cx, 1.8, cz, 3.4); cyl(g, .05, .05, 1.4, cx, .7, cz, '#6b4f3a'); }
  // ---- vizinhança ----
  neighborHouse(g, -32, 4, 9, 8, '#f3d9b1', '#b4553c', 1); neighborHouse(g, -46, 4, 8, 8, '#cfe3e8', '#3d5a80', 1);
  neighborHouse(g, -20, 36, 9, 8, '#e8d1e3', '#6b4f7a', -1); neighborHouse(g, -4, 36, 8, 7, '#f6eac2', '#9a5b2c', -1);
  if (crInv('gastro') >= 2) { box(g, 12, 3.4, 8, 14, 1.7, 36, '#2b3445'); solid(8, 32, 20, 40); box(g, 12.4, .3, 1.6, 14, 3.4, 31.2, '#ff6a00'); sign(g, crInv('gastro') >= 3 ? 'Beach Club' : 'Restaurante', 'do ' + nameOf($s.CR.me).split(' ')[0], 14, 4.4, 31.6, 4.4); for (let i = 0; i < 3; i++) { cyl(g, .45, .45, .05, 10 + i * 4, .75, 30.6, '#f4f4f4'); cyl(g, .05, .05, .75, 10 + i * 4, .38, 30.6, '#3a3f47'); umbrella(g, 10 + i * 4, 30.6, '#ffd23f'); } }
  else neighborHouse(g, 14, 36, 9, 8, '#d8efd2', '#2f6b3a', -1);
  // CT ao lado da arena
  if (crInv('ct') >= 1) { const tx = 70, tz = 36; box(g, 16, 5 + crInv('ct'), 12, tx, (5 + crInv('ct')) / 2, tz, '#1d2a4a'); solid(tx - 8, tz - 6, tx + 8, tz + 6); box(g, 16.2, .5, 12.2, tx, 5 + crInv('ct'), tz, '#33c3ff', glow('#33c3ff', .5));
    sign(g, ['', 'CT', 'CT de alto rendimento', 'Academia de base'][crInv('ct')], nameOf($s.CR.me).split(' ')[0], tx, 7.6 + crInv('ct'), tz - 6.2, 5.6); S2('ct', tx, tz - 8, 'Centro de treinamento', 'Treino físico e técnico'); }
  // quiosque na praia (gastronomia 1) e projeto social
  if (crInv('gastro') >= 1) { const kx = 12, kz = -26; cyl(g, 1.8, 1.8, .9, kx, .45, kz, '#a77d55'); const r = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.4, 8), mat('#e9c46a')); r.position.set(kx, 3.2, kz); r.castShadow = true; g.add(r); [0, 1, 2, 3].forEach(i => cyl(g, .07, .07, 2.4, kx + Math.cos(i * 1.57 + .78) * 1.6, 1.6, kz + Math.sin(i * 1.57 + .78) * 1.6, '#8a6a45')); solid(kx - 1.8, kz - 1.8, kx + 1.8, kz + 1.8); sign(g, 'Quiosque', nameOf($s.CR.me).split(' ')[0], kx, 4.6, kz, 3.2); }
  if (crLife('social')) { box(g, 8, .05, 16, -20, .05, -22, '#f1e2b8', { noShadow: true }); box(g, 8.4, .8, .03, -20, 1.1, -22, '#ffffff', { transparent: true, opacity: .45 }); sign(g, 'Projeto social', 'Escolinha de beach tennis', -20, 2.6, -31, 4); }
  // praia: guarda-sóis e cadeiras, palmeiras na orla
  [[-30, -28, '#ff6a00'], [-14, -30, '#33c3ff'], [30, -27, '#ffd23f'], [44, -29, '#e63946'], [58, -26, '#2a9d8f']].forEach(([x, z, c]) => { umbrella(g, x, z, c); lounger(g, x + 1, z + .8, .3, '#ffffff'); });
  // rua: palmeiras, postes, bancos, carros estacionados
  for (let x = -40; x <= 280; x += 12) { palm(g, x, 17.4, 4.8 + (Math.abs(x) % 3)); streetLamp(g, x + 6, 18.3); }
  [[-26, 30.4], [6, 30.4], [32, 30.4]].forEach(([x, z]) => bench(g, x, z));
  [[-30, 26.4, '#e63946'], [20, 21.6, '#f4f4f4'], [62, 26.4, '#2a9d8f'], [-46, 21.6, '#ffd23f']].forEach(([x, z, c]) => car(g, x, z, 0, c));
  // ---- arena de treino no fim da rua ----
  const ax = 46, az = 38;
  box(g, 24, .06, 16, ax, .04, az, '#f1e2b8', { noShadow: true });
  box(g, 24, 4, .3, ax, 2, az + 8, '#2457c5'); solid(ax - 12, az + 7.8, ax + 12, az + 8.2);
  box(g, 8, 4, .3, ax - 8, 2, az - 8, '#2457c5'); box(g, 8, 4, .3, ax + 8, 2, az - 8, '#2457c5'); solid(ax - 12, az - 8.2, ax - 4, az - 7.8); solid(ax + 4, az - 8.2, ax + 12, az - 7.8);
  box(g, .3, 4, 16, ax - 12, 2, az, '#2457c5'); solid(ax - 12.2, az - 8, ax - 11.8, az + 8); box(g, .3, 4, 16, ax + 12, 2, az, '#2457c5'); solid(ax + 11.8, az - 8, ax + 12.2, az + 8);
  sign(g, crInv('eventos') >= 1 ? 'Arena ' + nameOf($s.CR.me).split(' ')[0] : 'Arena de treino', crInv('eventos') >= 2 ? 'Sede da sua etapa ITF' : 'Beach tennis', ax, 5.3, az - 8.4, 5.6);
  box(g, 8, .02, 16, ax, .08, az, '#ffffff', { noShadow: true, transparent: true, opacity: .2 });
  box(g, 8.6, .9, .03, ax, 1.25, az, '#ffffff', { transparent: true, opacity: .45 }); solid(ax - 4.4, az - .1, ax + 4.4, az + .1);
  S2('arenaTreino', ax - 7, az - 4, 'Treinar', 'Físico e técnico'); S2('arenaDesafio', ax + 7, az - 4, 'Desafio', 'Curta, defesa, smash…'); S2('aulas', ax, az + 5.5, 'Dar aulas', 'Renda extra');
  // limites do bairro
  solid(-60, -87, -59, 60); solid(289, -87, 290, 60); solid(-60, 59, 290, 60);
  city(g, sp);
  LV.fans = []; LV.myCourt = null; LV.arrow = null;
  if ($s.CR.tour && !$s.CR.tour.pending && !$s.CR.tour.done) buildVenue(g, sp);
  // junta o cenário parado em poucos desenhos (os pontos de interação e os fãs ficam de fora)
  mergeStatic(g);
}

// ---------- ações ----------
const ACT = {
  cama: { txt: () => (($s.CR.tour && $s.CR.tour.pending) ? 'Descansar até o torneio' : 'Descansar hoje (+14 energia)'), run: () => { if ($s.CR.tour && $s.CR.tour.pending) crRestUntil(); else crRest(); } },
  tv: { txt: () => (($s.CR.talks || []).length ? 'Ver a entrevista pendente' : 'Ver o noticiário'), run: () => { if (($s.CR.talks || []).length) LV.actions.openCareer(); else LV.msg('📺 ' + ((($s.CR.feed || [])[0] || {}).t || 'Nada de novo no circuito hoje.')); } },
  trofeus: { txt: () => 'Ver troféus', run: () => { const t = $s.CR.titles || {}, n = Object.values(t).reduce((a, b) => a + b, 0); LV.msg(n ? '🏆 ' + n + ' títulos na estante.' : 'A estante está esperando o primeiro troféu.'); } },
  pc: { txt: () => 'Abrir a agenda da carreira', run: () => LV.actions.openCareer() },
  quadraTreino: { txt: () => 'Treinar na sua quadra (sem custo)', run: () => crTrain() },
  quadraDesafio: { txt: () => 'Treino com desafio na sua quadra', run: () => LV.actions.drill() },
  arenaTreino: { txt: () => 'Treinar na arena', run: () => crTrain() },
  arenaDesafio: { txt: () => 'Treino com desafio', run: () => LV.actions.drill() },
  aulas: { txt: () => 'Dar aulas hoje', run: () => crCoach() },
  cozinha: { txt: () => 'Fazer um lanche (+3 energia)', run: () => { const C = $s.CR; if ((C.snackDay || '') === C.season + '-' + C.week + '-' + C.day) { LV.msg('Você já comeu hoje. Guarde a fome para o jantar.'); return; } C.snackDay = C.season + '-' + C.week + '-' + C.day; C.energy = Math.min(100, C.energy + (crLife('nutri') ? 6 : 3)); LV.msg(crLife('nutri') ? '🥗 Refeição do cardápio do nutricionista: +6 de energia.' : '🥪 Um lanche rápido: +3 de energia.'); } },
  piscina: { txt: () => 'Relaxar na piscina (descansa o dia)', run: () => crRest() },
  gelo: { txt: () => 'Banho de gelo (descansa o dia)', run: () => crRest() },
  academia: { txt: () => 'Treinar na academia de casa', run: () => crTrain() },
  ct: { txt: () => 'Treinar no seu CT', run: () => crTrain() },
  podcast: { txt: () => 'Gravar conteúdo', run: () => { const C = $s.CR, k = C.season + '-' + C.week; if (C.podW === k) { LV.msg('Você já gravou esta semana.'); return; } C.podW = k; C.fama = Math.min(100, (C.fama || 0) + 1); C.energy = Math.max(0, C.energy - 3); LV.msg('🎙️ Episódio gravado: +1 de fama, −3 de energia.'); } },
  torneio: { txt: () => { const t = $s.CR.tour; return !t ? 'Ver os torneios da semana' : t.pending ? 'Ir ao torneio (descansa até sábado)' : t.done ? 'Ver o resultado do torneio' : 'Ir ao local do torneio'; },
    run: () => { const t = $s.CR.tour; if (t && t.pending) crRestUntil(); const u = $s.CR.tour; if (u && !u.pending && !u.done) goVenue(); else LV.actions.openCareer(); } },
  restaurante: { txt: () => 'Almoçar fora (+6 energia · $40)', run: () => { const C = $s.CR, k = C.season + '-' + C.week + '-' + C.day; if (C.lunchDay === k) { LV.msg('Você já almoçou hoje.'); return; } C.lunchDay = k; C.money -= 40; C.energy = Math.min(100, C.energy + 6); LV.msg('🍽️ Peixe grelhado, salada e suco: +6 de energia.'); } },
  acai: { txt: () => 'Tomar um açaí ($15)', run: () => { const C = $s.CR, k = C.season + '-' + C.week + '-' + C.day; if (C.acaiDay === k) { LV.msg('Um por dia já está bom.'); return; } C.acaiDay = k; C.money -= 15; C.energy = Math.min(100, C.energy + 2); LV.msg('🍧 Açaí com banana e granola: +2 de energia.'); } },
  loja: { txt: () => 'Entrar na loja', run: () => LV.actions.openCareer() },
  orla: { txt: () => 'Jogar com a galera (desafio)', run: () => LV.actions.drill() },
  casaVolta: { txt: () => 'Voltar para casa', run: () => goHome() },
  partida: { txt: () => LV.myCourt ? 'Entrar na ' + LV.myCourt.name + ' (vs ' + LV.myCourt.vs + ')' : 'Sem jogo agora', run: () => { if (crMyMatch()) LV.actions.play(); } },
  chave: { txt: () => 'Ver a chave do torneio', run: () => LV.actions.openCareer() },
  estande: { txt: () => 'Ação no estande (fotos e brindes)', run: () => { const t = $s.CR.tour; if (t.standDone) { LV.msg('Você já fez a ação no estande neste torneio.'); return; } t.standDone = true; crAddFama(1); $s.CR.energy = Math.max(0, $s.CR.energy - 2); LV.msg('📸 Fila de fãs no estande: +1 de fama.'); } },
  comida: { txt: () => 'Comer e se hidratar (+5 energia)', run: () => { const t = $s.CR.tour, k = 'd' + (t.day || 1); if (t.food === k) { LV.msg('Você já comeu hoje.'); return; } t.food = k; $s.CR.energy = Math.min(100, $s.CR.energy + 5); LV.msg('🥤 Água de coco e um açaí: +5 de energia.'); } },
  atletas: { txt: () => ($s.CR.tour.mate || $s.CR.partner) ? 'Conversar com a dupla' : 'Descansar na área dos atletas', run: () => { const t = $s.CR.tour, k = 'd' + (t.day || 1); if (t.lounge === k) { LV.msg('Vocês já conversaram hoje.'); return; } t.lounge = k; if ($s.CR.partner && !t.mate) { crPartnerAct('conversa'); } else $s.CR.energy = Math.min(100, $s.CR.energy + 3); LV.msg($s.CR.lastMsg || 'Um tempo na sombra: +3 de energia.'); } },
  fa: { txt: () => 'Tirar foto e dar autógrafo', run: () => { const f = LV.nearFan, t = $s.CR.tour; if (!f || f.done) return; f.done = true; t.fanN = (t.fanN || 0) + 1; const line = FAN_LINES[Math.floor(Math.random() * FAN_LINES.length)]; say(line, Math.random() < .5 ? 'f' : 'm', t.fanN, [line], 'r');
    if (t.fanN <= 8) { crAddFama(.4); LV.msg('🙋 "' + line + '" (+0,4 de fama)'); } else LV.msg('🙋 "' + line + '"'); } },
};

// ---------- entrar e sair ----------
function enter() {
  if (!$s.CR || LV.on) return;
  build();
  LV.on = true; LV.saved = { mode: S.mode, pos: human.pos.clone(), sea: SEA.visible }; SEA.visible = true; // o mar da cena é o da praia do bairro
  S.mode = 'livre';
  document.body.classList.remove('in-menu'); document.body.classList.add('livre');
  document.getElementById('career').hidden = true;
  [partner, cpuA, cpuB].forEach(p => { if (p) p.livreHide = true; });
  // quem anda é o seu jogador da carreira (com a roupa, o rosto e a raquete dele), não o último boneco da partida rápida
  LV.savedPick = Object.assign({}, S.settings.pick); LV.savedRacket = S.settings.racket;
  crSyncChars(); S.settings.pick = Object.assign({}, S.settings.pick, { me: 'crme' }); S.settings.racket = $s.CR.racket; assignCharacters(); applyRackets(); applyPlayerStyle(); // (sem reaplicar o estilo, o boneco novo ficava invisível)
  human.pos.copy(P(0, 1.5)); human.vel.set(0, 0, 0); human.feet = null; LV.camYaw = 0; LV.camPitch = .9; LV.zoom = 9;
  LV.snap = true; hud(true); LV.msg('Bem-vindo em casa. WASD para andar, Shift corre, E interage, Esc volta.');
  const t = $s.CR.tour; if (t && !t.pending && !t.done) goVenue(); // torneio em andamento: começa no local do torneio
}
function goVenue() { build(); LV.snap = true; human.pos.copy(P(VX, VZ + 34)); human.vel.set(0, 0, 0); human.feet = null; LV.yaw = 0; LV.camYaw = 0; LV.camPitch = .7; LV.zoom = 11; LV.where = '';
  LV.msg(LV.myCourt ? 'Você chegou ao ' + String($s.CR.tour.name).replace(/ · .*$/, '') + '. Sua partida (' + LV.myCourt.round + ') é na ' + LV.myCourt.name + ': siga a seta verde.' : 'Você chegou ao local do torneio.'); }
function goHome() { LV.snap = true; human.pos.copy(P(0, 1.5)); human.vel.set(0, 0, 0); human.feet = null; LV.camYaw = 0; LV.camPitch = .9; LV.zoom = 9; LV.where = ''; LV.msg('De volta para casa.'); }
function exit(toCareer = true) {
  if (!LV.on) return;
  LV.on = false; LV.lastEn = LV.lastMo = null; if (LV.saved) SEA.visible = LV.saved.sea; if (LV.bag) LV.bag.visible = false; S.mode = 'menu'; document.body.classList.remove('livre');
  [partner, cpuA, cpuB].forEach(p => { if (p) { p.livreHide = false; if (p.model) p.model.group.visible = true; } });
  human.pos.set(.9, 0, 5.5); human.vel.set(0, 0, 0); human.feet = null; human.forceYaw = null;
  if (LV.savedPick) { S.settings.pick = LV.savedPick; S.settings.racket = LV.savedRacket; LV.savedPick = null; assignCharacters(); applyRackets(); applyPlayerStyle(); } // volta o boneco da partida rápida
  hud(false);
  if (toCareer) { document.body.classList.add('in-menu'); document.getElementById('career').hidden = false; if (LV.actions.render) LV.actions.render(); }
}

// ---------- a cada quadro ----------
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
function tick(dt) {
  if (!LV.on) return;
  // os outros jogadores somem
  [partner, cpuA, cpuB].forEach(p => { if (p && p.livreHide) { if (p.model) p.model.group.visible = false; if (p.skin) { p.skin.holder.visible = false; p.skin.racket.visible = false; } } });
  const k = LV.keys, run = k.shift;
  let ix = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0), iz = (k.s || k.arrowdown ? 1 : 0) - (k.w || k.arrowup ? 1 : 0);
  if (LV.joy) { ix += LV.joy.x; iz += LV.joy.y; }
  const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
  // direção relativa à câmera
  const cy = Math.cos(LV.camYaw), sy = Math.sin(LV.camYaw), tx = ix * cy + iz * sy, tz = -ix * sy + iz * cy;
  const vmax = run ? 5.2 : 1.9, acc = il > .05 ? 9 : 12;
  LV.vel.x += (tx * vmax - LV.vel.x) * Math.min(1, dt * acc); LV.vel.z += (tz * vmax - LV.vel.z) * Math.min(1, dt * acc);
  human.vel.set(LV.vel.x, 0, LV.vel.z);
  human.pos.x += LV.vel.x * dt; human.pos.z += LV.vel.z * dt;
  // colisão com as paredes e móveis (círculo contra caixas)
  const lx = human.pos.x - H0.x, lz = human.pos.z - H0.z, R = .32; let px = lx, pz = lz;
  for (const [x0, z0, x1, z1] of LV.boxes) { const cx = Math.max(x0, Math.min(px, x1)), cz = Math.max(z0, Math.min(pz, z1)), dx = px - cx, dz = pz - cz, d = Math.hypot(dx, dz);
    if (d < R) { if (d > 1e-4) { px = cx + dx / d * R; pz = cz + dz / d * R; } else { px += R; } } }
  human.pos.x = H0.x + px; human.pos.z = H0.z + pz;
  // para onde o corpo olha: para onde anda
  const sp = Math.hypot(LV.vel.x, LV.vel.z);
  if (sp > .3) { const want = Math.atan2(-LV.vel.x, -LV.vel.z); let d = want - LV.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); LV.yaw += d * Math.min(1, dt * 10); }
  human.forceYaw = LV.yaw;
  // ponto de interação mais perto
  let near = null, nd = 9;
  for (const s of LV.spots) { const d = Math.hypot(px - s.x, pz - s.z); s.ring.material.opacity = d < s.r ? .95 : .45; if (d < s.r && d < nd) { nd = d; near = s; } }
  // fãs: andando devagar, e o mais perto vira ponto de interação
  let nf = null, nfd = 1.6;
  (LV.fans || []).forEach(f => { if (f.walk) { f.a += dt * .25; f.o.position.x = f.x + Math.cos(f.a) * 3; f.o.position.z = f.z + Math.sin(f.a) * 3; f.o.rotation.y = -f.a; }
    const d = Math.hypot(px - f.o.position.x, pz - f.o.position.z); if (!f.done && d < nfd) { nfd = d; nf = f; }
    if (d < 4 && !f.walk) f.o.rotation.y += (Math.atan2(px - f.o.position.x, pz - f.o.position.z) - f.o.rotation.y) * Math.min(1, dt * 3); });
  LV.nearFan = nf; if (nf && !near) near = { id: 'fa' };
  npcTick(dt, px, pz);
  if (LV.arrow) { LV.arrow.rotation.y += dt * 2; LV.arrow.position.y = 4.2 + Math.sin(performance.now() / 300) * .25; }
  if ((near && near.id) !== (LV.near && LV.near.id)) { LV.near = near; prompt(); } else LV.near = near;
  LV.spots.forEach(s => { const d = Math.hypot(px - s.x, pz - s.z); s.label.visible = d < 16; });
  // nome do lugar onde está
  { const [hw, hd] = LV.house || [6, 5], where = px > -hw && px < hw && pz > -hd && pz < hd ? 'Casa de ' + nameOf($s.CR.me).split(' ')[0] : px > hw && px < hw + 16 && pz > -10 && pz < 12 ? 'Quintal' : pz < -hd && pz > -hd - 10 && px > -15 && px < 15 ? 'Área da piscina' : px > VX - 53 && px < VX + 53 && pz > VZ - 51 && pz < VZ + 45 ? ($s.CR.tour && !$s.CR.tour.pending && !$s.CR.tour.done ? String($s.CR.tour.name).replace(/ · .*$/, '') : 'Quadras da Orla') : pz < -12 ? 'Praia' : pz > 30 && px > 92 ? 'Comércio' : px > 33 && px < 59 && pz > 29 && pz < 47 ? 'Arena de treino' : px > 61 && px < 90 && pz > 29 ? 'Centro de treinamento' : pz > 17 && pz < 28 ? 'Rua da praia' : 'Bairro';
    if (where !== LV.where) { LV.where = where; const e = document.querySelector('#livreHud .lv-where'); if (e) e.textContent = where; } }
  // bússola para a sua quadra (no painel de cima): direção em relação à câmera e distância
  { const cp = document.getElementById('livreGo'); if (cp) { const mc = LV.myCourt && LV.nearVenue !== false ? LV.myCourt : null; cp.hidden = !mc;
    if (mc) { const dx = mc.x - px, dz = mc.z - pz, d = Math.hypot(dx, dz); camera.getWorldDirection(_v); const ang = Math.atan2(dx * _v.z - dz * _v.x, dx * _v.x + dz * _v.z);
      cp.querySelector('i').style.transform = 'rotate(' + (-ang * 180 / Math.PI - 90).toFixed(0) + 'deg)'; cp.querySelector('b').textContent = d < 4 ? 'Você chegou' : Math.round(d) + ' m'; } } }
  if (LV.msgT > 0 && (LV.msgT -= dt) <= 0) { const m = document.getElementById('livreMsg'); if (m) m.hidden = true; }
}
// câmera: atrás do jogador, girada pelo mouse (arrastando) ou Q/E… (E é interagir: gira com Q e R); dentro de casa sobe e olha de cima
function cam(dt) {
  if (!LV.on) return false;
  const k = LV.keys;
  if (k.z) LV.zoom = Math.max(2.2, LV.zoom * (1 - dt * 1.4)); if (k.x) LV.zoom = Math.min(22, LV.zoom * (1 + dt * 1.4)); if (k.t) LV.camPitch = Math.min(1.45, LV.camPitch + dt * .9); if (k.g) LV.camPitch = Math.max(.08, LV.camPitch - dt * .9);
  const [hw, hd] = LV.house || [6, 5], lx = human.pos.x - H0.x, lz = human.pos.z - H0.z, inside = lx > -hw && lx < hw && lz > -hd && lz < hd;
  // zoom e inclinação escolhidos pelo jogador; dentro de casa a câmera nunca fica mais baixa que as paredes (vista de cima)
  const dist = LV.zoom, pitch = inside ? Math.max(LV.camPitch, .78) : LV.camPitch, h = 1.2;
  _v.set(human.pos.x + Math.sin(LV.camYaw) * Math.cos(pitch) * dist, h + Math.sin(pitch) * dist, human.pos.z + Math.cos(LV.camYaw) * Math.cos(pitch) * dist);
  const kk = LV.snap ? 1 : 1 - Math.exp(-dt * 6); if (LV.snap) { LV.look = null; LV.snap = false; } // depois do táxi/van: a câmera já aparece no lugar
  camera.position.lerp(_v, kk); _w.set(human.pos.x, 1.1, human.pos.z);
  LV.look = (LV.look || _w.clone()).lerp(_w, kk); camera.lookAt(LV.look);
  if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }
  sun.target.position.set(human.pos.x, 0, human.pos.z); sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 40);
  // andando pelo mundo: raquete guardada na raqueteira, nas costas
  if (human.skin) human.skin.racket.visible = false; if (human.model && human.model.racket) human.model.racket.visible = false;
  { const bc = ($s.CR.bag && BAG_COLS[$s.CR.bag.c]) || bagOfRacket();
    if (!LV.bag || LV.bagKey !== bc.join()) { if (LV.bag) scene.remove(LV.bag); LV.bag = racketBag(bc); LV.bagKey = bc.join(); scene.add(LV.bag); }
    LV.bag.visible = true; const hk = ((human.char && human.char.alt) || 180) / 180;
    const fx = -Math.sin(LV.yaw), fz = -Math.cos(LV.yaw); LV.bag.position.set(human.pos.x - fx * .16, 1.3 * hk, human.pos.z - fz * .16); LV.bag.rotation.set(0, LV.yaw, 0); LV.bag.rotateZ(.6); LV.bag.scale.set(.72 * hk, .72 * hk, .6 * hk); }
  return true;
}

// ---------- interface ----------
function hud(on) {
  let el = document.getElementById('livreHud');
  if (!el) {
    el = document.createElement('div'); el.id = 'livreHud';
    el.innerHTML = '<div class="lv-top"><div class="lv-stat"><div class="lv-cal"><small></small><b></b><span></span></div><div class="lv-info"><b class="lv-where"></b><div class="lv-week"></div><div class="lv-next"></div></div><div id="livreGo" class="lv-go" hidden title="Direção da sua quadra"><i>➤</i><small>sua quadra</small><b></b></div></div>'
      + '<div class="lv-res"><div class="lv-k lv-en" title="Energia"><span class="lv-ico">⚡</span><span class="lv-bar"><i></i></span><b></b><em class="lv-dl"></em></div><div class="lv-k lv-mo" title="Dinheiro"><span class="lv-ico">💰</span><b></b><em class="lv-dl"></em></div></div>'
      + '<div class="lv-btns"><button type="button" class="ghost sm" id="livreCfg" title="Configurações">⚙️</button><button type="button" class="ghost sm" id="livreExit">Voltar à carreira (Esc)</button></div></div>'
      + '<div id="livrePrompt" class="lv-prompt" hidden><kbd>E</kbd><span></span></div><div id="livreMsg" class="lv-msg" hidden></div>'
      + '<div class="lv-help">WASD: andar · Shift: correr · E: interagir · arrastar: girar · rodinha: zoom · clique da rodinha arrastando: girar e inclinar · Z/X: zoom · T/G: inclinação</div>'
      + '<div class="lv-joy" id="livreJoy"><i></i></div><button type="button" class="lv-act" id="livreAct">E</button>';
    document.body.appendChild(el);
    el.querySelector('#livreExit').addEventListener('click', () => exit(true));
    el.querySelector('#livreCfg').addEventListener('click', () => { if (LV.actions.cfg) LV.actions.cfg(); });
    el.querySelector('#livreAct').addEventListener('click', interact);
    // joystick de toque
    const J = el.querySelector('#livreJoy'), knob = J.querySelector('i');
    const mv = e => { const r = J.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, x = (t.clientX - r.left - r.width / 2) / (r.width / 2), y = (t.clientY - r.top - r.height / 2) / (r.height / 2), l = Math.max(1, Math.hypot(x, y)); LV.joy = { x: x / l, y: y / l }; knob.style.transform = 'translate(' + (x / l * 30) + 'px,' + (y / l * 30) + 'px)'; };
    J.addEventListener('pointerdown', e => { J.setPointerCapture(e.pointerId); mv(e); }); J.addEventListener('pointermove', e => { if (LV.joy) mv(e); });
    J.addEventListener('pointerup', () => { LV.joy = null; knob.style.transform = ''; });
  }
  el.hidden = !on;
  if (on) { hudStats(el); LV.where = ''; }
}
// painel de cima: folha de calendário, a semana (hoje em destaque, fim de semana de torneio marcado), o que vem a seguir, energia e dinheiro
const WD = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
function hudStats(el) {
  const C = $s.CR; if (!C) return;
  const [wd, dm] = crDateTxt(C.season, C.week, C.day).split(', '), [dd, mm] = (dm || '').split(' ');
  el.querySelector('.lv-cal small').textContent = wd; el.querySelector('.lv-cal b').textContent = dd; el.querySelector('.lv-cal span').textContent = mm;
  const t = C.tour, tourOn = t && !t.done;
  el.querySelector('.lv-week').innerHTML = WD.map((d, i) => '<i class="' + (i + 1 < C.day ? 'past' : i + 1 === C.day ? 'now' : '') + (tourOn && i >= 5 ? ' tour' : '') + '" title="' + (tourOn && i >= 5 ? 'Torneio' : '') + '">' + d + '</i>').join('') + '<small>sem ' + C.week + ' · T' + C.season + '</small>';
  const nm = t ? String(t.name).replace(/ · .*$/, '') : '';
  el.querySelector('.lv-next').innerHTML = !t ? 'Sem torneio nesta semana' : t.done ? '🏁 ' + nm + ' encerrado' : t.pending ? '🏆 ' + nm + ' · começa no sábado' : LV.myCourt ? '🎾 ' + LV.myCourt.round + ' · ' + LV.myCourt.name : '🏆 ' + nm + ' em andamento';
  const en = Math.round(C.energy), bar = el.querySelector('.lv-en .lv-bar i');
  bar.style.width = clampN(en, 0, 100) + '%'; bar.className = en < 35 ? 'lo' : en < 65 ? 'mid' : 'hi';
  el.querySelector('.lv-en b').textContent = en; el.querySelector('.lv-mo b').textContent = money2(C.money);
  // variação desde a última vez (sobe um +/− e some)
  const dl = (sel, d, fmt) => { if (!d) return; const e = el.querySelector(sel + ' .lv-dl'); e.textContent = (d > 0 ? '+' : '−') + fmt(Math.abs(d)); e.className = 'lv-dl ' + (d > 0 ? 'up' : 'dn'); void e.offsetWidth; e.classList.add('go'); };
  if (LV.lastEn != null) dl('.lv-en', en - LV.lastEn, v => String(v));
  if (LV.lastMo != null) dl('.lv-mo', Math.round(C.money - LV.lastMo), money2);
  LV.lastEn = en; LV.lastMo = C.money;
}
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
const money2 = v => '$' + Math.round(v).toLocaleString('pt-BR');
function prompt() {
  const el = document.getElementById('livrePrompt'); if (!el) return;
  const s = LV.near, a = s && ACT[s.id]; el.hidden = !a; if (a) el.querySelector('span').textContent = a.txt();
  const b = document.getElementById('livreAct'); if (b) b.classList.toggle('on', !!a);
}
LV.msg = t => { const m = document.getElementById('livreMsg'); if (!m) return; m.textContent = t; m.hidden = !t; LV.msgT = 5; };
const DAY_ACTS = new Set(['orla', 'cama', 'piscina', 'gelo', 'quadraTreino', 'quadraDesafio', 'arenaTreino', 'arenaDesafio', 'aulas', 'academia', 'ct', 'podcast']);
function interact() {
  const s = LV.near, a = s && ACT[s.id]; if (!a || !$s.CR) return;
  if (DAY_ACTS.has(s.id) && crTourDay()) { LV.msg('🏆 Hoje é dia de torneio: treino, aulas e descanso ficam para depois. Vá ao local do torneio (táxi/van na rua).'); return; }
  const before = $s.CR.lastMsg; a.run(); saveCareer();
  if (!LV.on) return; // a ação saiu do modo livre (carreira, desafio)
  if ($s.CR.lastMsg && $s.CR.lastMsg !== before) LV.msg($s.CR.lastMsg);
  hud(true); prompt();
  if (($s.CR.talks || []).length && LV.actions.talk) LV.actions.talk();
}

// teclado e mouse (só no modo livre)
addEventListener('keydown', e => {
  if (!LV.on) return; const k = e.key.toLowerCase();
  const mo = document.getElementById('menu'); if (mo && !mo.hidden) { if (k === 'escape') { mo.hidden = true; e.preventDefault(); } return; } // configurações abertas por cima: teclas são do menu
  if (k === 'escape') { exit(true); return; }
  if (k === 'e' && !e.repeat) { interact(); e.preventDefault(); return; }
  LV.keys[k] = true; if (k === 'shift') LV.keys.shift = true;
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
}, true);
addEventListener('keyup', e => { const k = e.key.toLowerCase(); LV.keys[k] = false; if (k === 'shift') LV.keys.shift = false; }, true);
// mouse: arrastar com o botão esquerdo gira; com o botão do meio (clique da rodinha) ou o direito muda a inclinação; a rodinha
// dá e tira zoom. No toque: um dedo gira, dois dedos (pinça) dão zoom
addEventListener('pointerdown', e => { if (LV.on && e.target && e.target.tagName === 'CANVAS') { LV.drag = { x: e.clientX, y: e.clientY, b: e.button }; if (e.button === 1) e.preventDefault(); } });
addEventListener('pointermove', e => { if (!LV.on || !LV.drag) return; const dx = e.clientX - LV.drag.x, dy = e.clientY - LV.drag.y; LV.drag.x = e.clientX; LV.drag.y = e.clientY;
  if (LV.drag.b === 1 || LV.drag.b === 2 || e.shiftKey) { LV.camYaw -= dx * .006; LV.camPitch = Math.max(.08, Math.min(1.45, LV.camPitch + dy * .006)); } // clique da rodinha (ou direito): gira e inclina
  else { LV.camYaw -= dx * .006; LV.camPitch = Math.max(.08, Math.min(1.45, LV.camPitch + dy * .003)); } });
addEventListener('pointerup', () => { LV.drag = null; });
addEventListener('wheel', e => { if (!LV.on || !e.target || e.target.tagName !== 'CANVAS') return; e.preventDefault(); LV.zoom = Math.max(2.2, Math.min(22, LV.zoom * Math.exp(e.deltaY * .0012))); }, { passive: false });
addEventListener('contextmenu', e => { if (LV.on && e.target && e.target.tagName === 'CANVAS') e.preventDefault(); });
addEventListener('auxclick', e => { if (LV.on && e.button === 1) e.preventDefault(); });
{ let pin = 0; addEventListener('touchmove', e => { if (!LV.on || e.touches.length !== 2) { pin = 0; return; } const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (pin) LV.zoom = Math.max(2.2, Math.min(22, LV.zoom * pin / d)); pin = d; }, { passive: true }); addEventListener('touchend', () => { pin = 0; }); }

if (typeof window !== 'undefined') window.__pdoLivre = { LV, enter, exit, tick, interact, P, H0, FAN_LINES };
export { LV as LIVRE, enter as livreEnter, exit as livreExit, tick as livreTick, cam as livreCam };
