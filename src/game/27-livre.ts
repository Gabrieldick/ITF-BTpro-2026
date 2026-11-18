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
import { crInv, crLife, crTrain, crRest, crRestUntil, crCoach, crDateTxt, crTourT, crMyMatch, saveCareer, crSyncChars, crPlayMatch, crPartnerAct, crIsSemiOrFinal, crIsCentral, crTourDay, crTeamName, crNRounds, crRoundNames, crAddFama, crWorld, crCharOvr, crChar, crMeOvr, crBagCols, TIERS } from './14-carreira';
import { say, hush, HIST } from './26-historias';
import { assignCharacters, applyRackets, applyPlayerStyle } from './07-glb';
import { mergeStatic, sea as SEA, ENV } from './03-cenario';
import { arenaFor } from './09-interface';
import { nameOf } from './00-base';

const H0 = new THREE.Vector3(320, 0, 40); // origem do bairro no mundo (longe da quadra, fora do cenário da praia)
const LV = { bagOff: .17, zoom: 6.4, on: false, group: null, spots: [], boxes: [], yaw: 0, camYaw: Math.PI, camPitch: .5, vel: new THREE.Vector3(), near: null, msgT: 0, saved: null, actions: {}, drag: null, keys: {}, built: '' };
const P = (x, z) => new THREE.Vector3(H0.x + x, 0, H0.z + z);

// esconde o cenário da quadra (prédios, arquibancadas, linhas…) sem mexer na visibilidade de cada peça: o grupo inteiro
// some e só o mar continua (é tirado do grupo enquanto isso). Assim a quadra volta exatamente como estava
let envHid = 0;
function envHide() { if (LV.group) LV.group.visible = true; if (envHid++) return; scene.attach(SEA); ENV.visible = false; }
function envShow() { if (!envHid || --envHid) return; ENV.attach(SEA); ENV.visible = true; if (LV.group) LV.group.visible = false; } // (o bairro some: o terreno dele passa por baixo da quadra da partida)
// ---------- montagem ----------
function box(g, w, h, d, x, y, z, color, o) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, o)); m.position.set(x, y, z); m.castShadow = !(o && o.noShadow); m.receiveShadow = true; g.add(m);
  if (g === LV.group && h <= .25 && y - h / 2 <= .03 && y + h / 2 > .02 && w * d >= .4 && !(o && o.transparent)) LV.gnd.push([x - w / 2, z - d / 2, x + w / 2, z + d / 2, y + h / 2]); // chão pisável (calçada, gramado…)
  if (g === LV.group && color === '#3a3f47' && h <= .07 && Math.max(w, d) >= 7 && Math.min(w, d) >= 6) LV.roadR.push([x - w / 2, z - d / 2, x + w / 2, z + d / 2]); // rua (o carro só anda nelas)
  return m; }
// altura do chão onde se pisa (as calçadas e os gramados têm alguns centímetros: os pés ficam em cima, não dentro)
function gndIndex() { const G = new Map(); LV.gnd.forEach((r, i) => { for (let a = Math.floor(r[0] / 10); a <= Math.floor(r[2] / 10); a++) for (let b = Math.floor(r[1] / 10); b <= Math.floor(r[3] / 10); b++) { const k = a * 1000 + b; if (!G.has(k)) G.set(k, []); G.get(k).push(r); } }); LV.gndG = G; }
function groundY(x, z) { const L = LV.gndG && LV.gndG.get(Math.floor(x / 10) * 1000 + Math.floor(z / 10)); let y = 0; if (L) for (const r of L) if (x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3] && r[4] > y) y = r[4]; return y; }
function roadDist(x, z) { let best = 1e9; for (const [x0, z0, x1, z1] of LV.roadR) { const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1), d = Math.hypot(dx, dz); if (d < best) best = d; } return best; }
// porta (folha presa na dobradiça): abre sozinha quando você chega perto. axis 'x': porta numa parede ao longo de x; dir: para que lado a folha vai
function door(sp, hx, hz, w, axis, dir, col = '#8a6a45', h = 2.15) {
  const piv = new THREE.Group(); piv.position.set(hx, 0, hz); piv.userData.dyn = true; sp.add(piv);
  const leaf = box(piv, axis === 'x' ? w : .06, h, axis === 'x' ? .06 : w, axis === 'x' ? dir * w / 2 : 0, h / 2, axis === 'x' ? 0 : dir * w / 2, col);
  box(piv, axis === 'x' ? .05 : .09, .05, axis === 'x' ? .09 : .05, axis === 'x' ? dir * (w - .12) : 0, 1.05, axis === 'x' ? 0 : dir * (w - .12), '#d9d9d9', { metalness: .7, roughness: .3 });
  LV.doors.push({ piv, cx: axis === 'x' ? hx + dir * w / 2 : hx, cz: axis === 'x' ? hz : hz + dir * w / 2, open: 0, sign: dir }); return piv;
}
// rede de verdade: postes, malha escura e faixa de cima com a marca (do seu patrocinador, se tiver)
function realNet(g, x, z, w, along, brand, bg = '#111214', fg = '#ffffff') {
  const rot = along === 'x' ? 0 : Math.PI / 2, o = new THREE.Group(); o.position.set(x, 0, z); o.rotation.y = rot; g.add(o);
  [-1, 1].forEach(sd => { cyl(o, .06, .06, 1.85, sd * (w / 2 + .3), .92, 0, '#2b2d31'); });
  const tex = canvasTex(256, 64, (c, W, H) => { c.strokeStyle = 'rgba(20,20,22,.9)'; c.lineWidth = 2; for (let i = 0; i <= W; i += 8) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, H); c.stroke(); } for (let j = 0; j <= H; j += 8) { c.beginPath(); c.moveTo(0, j); c.lineTo(W, j); c.stroke(); } });
  tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(w / 2, 1);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, .85), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: .3, side: THREE.DoubleSide })); mesh.position.y = 1.27; o.add(mesh);
  banner(o, brand || 'Beach Tennis', 0, 1.74, .005, w, .12, bg, fg); banner(o, brand || 'Beach Tennis', 0, 1.74, -.005, w, .12, bg, fg, Math.PI);
  box(o, w, .02, .02, 0, .85, 0, '#ffffff');
}
function dyn2(sp, o) { o.userData.dyn = true; sp.add(o); return o; }
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
// troféus com a cara de cada torneio: medalha (amador C), taças pequenas (B e A), cristal (BT10), prato (BT50), tigela (BT100),
// taça com tampa (BT200), taça grande com a bola no topo (BT400), raquete dourada (Sand Series) e globo (Mundial)
const TROPHY_LOOK = ['medalha', 'taça de prata', 'taça dourada', 'cristal', 'prato de prata', 'tigela de prata', 'taça com tampa', 'taça grande', 'raquete dourada', 'globo dourado'];
function cup(o, x, y, z, tier) {
  const GOLD = { metalness: .9, roughness: .2 }, g = new THREE.Group(); g.position.set(x, y, z); o.add(g);
  const base = (w, h, c) => box(g, w, h, w, 0, h / 2, 0, c);
  const C = (rt, rb, h, py, col, M = GOLD, seg = 16) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(col, M)); m.position.y = py; m.castShadow = true; g.add(m); return m; };
  const handles = (r, py, col) => [-1, 1].forEach(sd => { const h = new THREE.Mesh(new THREE.TorusGeometry(r, r * .22, 6, 12, Math.PI * 1.2), mat(col, GOLD)); h.position.set(sd * r * 1.9, py, 0); h.rotation.set(0, sd > 0 ? 0 : Math.PI, -Math.PI * .6); g.add(h); });
  if (tier <= 0) { base(.14, .05, '#6b4f3a'); const m = C(.07, .07, .015, .13, '#b8803f'); m.rotation.x = Math.PI / 2; C(.012, .012, .08, .07, '#c0392b', {}); }
  else if (tier <= 2) { const col = tier === 1 ? '#c0c5cc' : '#e8b923'; base(.14, .05, '#6b4f3a'); C(.02, .025, .08, .09, col); C(.07, .035, .12, .19, col); handles(.035, .2, col); }
  else if (tier === 3) { base(.12, .04, '#1d1d20'); const cr = new THREE.Mesh(new THREE.OctahedronGeometry(.09, 0), mat('#bfe6ff', { transparent: true, opacity: .55, metalness: .1, roughness: .05 })); cr.scale.y = 1.9; cr.position.y = .21; g.add(cr); }
  else if (tier === 4) { base(.14, .04, '#1d1d20'); C(.012, .012, .12, .1, '#9aa0a8'); const pl = C(.13, .13, .015, .26, '#d9dde2'); pl.rotation.x = Math.PI / 2; const in2 = C(.09, .09, .017, .26, '#b9c0c8'); in2.rotation.x = Math.PI / 2; }
  else if (tier === 5) { base(.16, .06, '#111214'); C(.03, .05, .06, .09, '#d9dde2'); C(.13, .06, .1, .17, '#d9dde2'); handles(.04, .18, '#d9dde2'); }
  else if (tier === 6) { base(.16, .07, '#111214'); C(.025, .03, .1, .12, '#e8b923'); C(.1, .045, .18, .26, '#e8b923'); C(.105, .105, .02, .36, '#e8b923'); C(.02, .04, .06, .4, '#e8b923'); handles(.045, .28, '#e8b923'); }
  else if (tier === 7) { base(.2, .09, '#111214'); box(g, .21, .02, .21, 0, .1, 0, '#e8b923', GOLD); C(.03, .04, .14, .17, '#e8b923'); C(.14, .055, .26, .37, '#e8b923'); C(.145, .145, .02, .51, '#e8b923');
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.05, 14, 12), mat('#ff7a1a', { roughness: .5 })); ball.position.y = .57; g.add(ball); handles(.06, .4, '#e8b923'); }
  else if (tier === 8) { base(.16, .07, '#111214'); const fr = new THREE.Mesh(new THREE.CylinderGeometry(.11, .11, .025, 24), mat('#e8b923', GOLD)); fr.rotation.x = Math.PI / 2; fr.position.y = .33; fr.scale.y = 1.15; g.add(fr); C(.018, .02, .18, .14, '#e8b923'); }
  else { base(.2, .08, '#111214'); C(.04, .07, .12, .14, '#e8b923'); const gl = new THREE.Mesh(new THREE.SphereGeometry(.12, 20, 16), mat('#e8b923', GOLD)); gl.position.y = .33; g.add(gl);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.15, .01, 6, 30), mat('#ffffff', GOLD)); ring.position.y = .33; ring.rotation.set(1.2, 0, .3); g.add(ring); }
}
// lista dos títulos (do maior nível para o menor), um troféu por título
function trophyList() { const T = $s.CR.titles || {}, L = []; Object.keys(T).map(Number).sort((a, b) => b - a).forEach(t => { for (let i = 0; i < T[t]; i++) L.push(t); }); return L; }
function shelfTrophies(g, x, z, rot, n, wide) {
  const o = new THREE.Group(); o.position.set(x, 0, z); o.rotation.y = -rot * Math.PI / 2; g.add(o); const W = wide ? 3.4 : 2.2;
  box(o, W, 2.2, .45, 0, 1.1, 0, '#4a3628'); for (let k = 0; k < 4; k++) box(o, W - .1, .04, .4, 0, .3 + k * .55, .02, '#7a5a42');
  const L = trophyList(), per = wide ? 6 : 4, cap = per * 4; // a estante vai enchendo conforme os títulos (os maiores em cima)
  L.slice(0, cap).forEach((t, i) => { const r = 3 - Math.floor(i / per), c = i % per; cup(o, -W / 2 + .35 + c * ((W - .5) / (per - 1)), .32 + r * .55, .05, t); });
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
  if (!sit && seed % 4 === 1) { const b = racketBag(BAG_COLS[seed % BAG_COLS.length]); b.position.set(0, 1.08 * h, .2); b.scale.setScalar(.85); o.add(b); } // raqueteira nas costas
  return o;
}
// cores da raqueteira pela marca da raquete (enquanto não compra outra na loja)
function bagOfRacket() { const r = String(S.settings.racket || ''); let h = 0; for (const ch of r) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return BAG_COLS[h % BAG_COLS.length]; }
// raqueteira (bolsa de raquetes): corpo comprido com faixa e alça, usada nas costas na diagonal
const BAG_COLS = [['#111214', '#e30613'], ['#1f4fb8', '#ffffff'], ['#ff6a00', '#111214'], ['#0a7d3c', '#ffd23f'], ['#e9e9e9', '#2457c5'], ['#6b2737', '#f2c14e']];
// adesivos ganhos na história: colados na raqueteira (frente da mochila), cada um com o seu desenho
const STICKERS = { adesivoBairro: ['#ff6a00', '#ffffff', 'CRIA DO', 'BAIRRO'], adesivoCoco: ['#2a9d8f', '#ffffff', '🥥', 'JORGE'], adesivoMare: ['#1d3557', '#a8dadc', '🌊', 'MARÉ'], adesivoPalmeiras: ['#0a7d3c', '#ffd23f', '🌴', 'PALMEIRAS'],
  adesivoTiaguinho: ['#ffffff', '#e63946', '☺', 'TIAGUINHO'], adesivoMatriz: ['#f1e3c6', '#6b4f3a', '⛪', 'MATRIZ'], adesivoCida: ['#ff8fab', '#ffffff', '🎉', 'D. CIDA'] };
function stickBag(o, keys) {
  const pos = [[-.085, .2, .09], [.085, .22, .09], [0, .05, .1], [-.09, -.29, .135], [.09, -.3, .135], [-.1, .33, .085], [.1, .33, .085]];
  keys.slice(0, pos.length).forEach((k, i) => { const [bg, fg, a, b] = STICKERS[k];
    const t = canvasTex(128, 128, (c, W, H) => { c.fillStyle = bg; c.beginPath(); c.arc(64, 64, 62, 0, Math.PI * 2); c.fill(); c.lineWidth = 6; c.strokeStyle = '#ffffff'; c.stroke(); c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = 'bold ' + (a.length > 3 ? 26 : 46) + 'px sans-serif'; c.fillText(a, 64, 50); c.font = 'bold ' + (b.length > 7 ? 17 : 22) + 'px sans-serif'; c.fillText(b, 64, 92); });
    const m = new THREE.Mesh(new THREE.CircleGeometry(.07, 24), new THREE.MeshStandardMaterial({ map: t, roughness: .5, polygonOffset: true, polygonOffsetFactor: -2 })); const [x, y, z] = pos[i]; m.position.set(x, y, z + .005); m.rotation.z = (i % 2 ? -1 : 1) * .2; o.add(m); });
}
function racketBag(c, brand?) {
  // mochila térmica de raquetes (como as de beach tennis): perfil com o topo arredondado (a cabeça da raquete), corpo
  // achatado com borda arredondada, faixa do zíper na cor da marca, bolso na frente, etiqueta da marca e alças
  const o = new THREE.Group(), [a, b] = c, W = .36, H = .74, R = .07;
  const shp = new THREE.Shape(); shp.moveTo(-W / 2 + R, -H / 2); shp.lineTo(W / 2 - R, -H / 2); shp.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + R); shp.lineTo(W / 2, H / 2 - W / 2);
  shp.absarc(0, H / 2 - W / 2, W / 2, 0, Math.PI, false); shp.lineTo(-W / 2, -H / 2 + R); shp.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + R, -H / 2);
  const body = new THREE.ExtrudeGeometry(shp, { depth: .1, bevelEnabled: true, bevelThickness: .03, bevelSize: .025, bevelSegments: 3, curveSegments: 18 }); body.translate(0, 0, -.05);
  o.add(new THREE.Mesh(body, mat(a, { roughness: .55 })));
  const band = new THREE.ExtrudeGeometry(shp, { depth: .022, bevelEnabled: false, curveSegments: 18 }); band.translate(0, 0, -.011); const bm = new THREE.Mesh(band, mat(b, { roughness: .5 })); bm.scale.set(1.075, 1.04, 1); o.add(bm); // faixa do zíper em volta
  const pk = new THREE.Shape(); const pw = .26, ph = .3, pr = .05; pk.moveTo(-pw / 2 + pr, -ph / 2); pk.lineTo(pw / 2 - pr, -ph / 2); pk.quadraticCurveTo(pw / 2, -ph / 2, pw / 2, -ph / 2 + pr); pk.lineTo(pw / 2, ph / 2 - pr); pk.quadraticCurveTo(pw / 2, ph / 2, pw / 2 - pr, ph / 2); pk.lineTo(-pw / 2 + pr, ph / 2); pk.quadraticCurveTo(-pw / 2, ph / 2, -pw / 2, ph / 2 - pr); pk.lineTo(-pw / 2, -ph / 2 + pr); pk.quadraticCurveTo(-pw / 2, -ph / 2, -pw / 2 + pr, -ph / 2);
  const pg = new THREE.ExtrudeGeometry(pk, { depth: .03, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 2 }); const pm = new THREE.Mesh(pg, mat(a, { roughness: .6 })); pm.position.set(0, -.13, .08); o.add(pm); // bolso da frente
  box(o, .2, .045, .01, 0, .07, .116, b); box(o, .012, .26, .012, 0, -.13, .13, '#d9d9d9', { metalness: .6, roughness: .3 }); // etiqueta da marca e zíper do bolso
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.03, .008, 6, 12), mat('#d9d9d9', { metalness: .7 })); ring.position.set(0, H / 2 + .015, 0); o.add(ring); // alça de mão no topo
  [-1, 1].forEach(sd => { box(o, .045, .5, .012, sd * .1, .02, -.088, '#1d1d20'); box(o, .045, .012, .1, sd * .1, .27, -.13, '#1d1d20'); }); // alças de mochila (do lado do corpo)
  if (brand) { const t = canvasTex(256, 64, (x2, W, H) => { x2.fillStyle = c[1]; x2.fillRect(0, 0, W, H); x2.fillStyle = c[0]; x2.font = 'bold 40px sans-serif'; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillText(String(brand).toUpperCase(), W / 2, H / 2 + 2); });
    const lb = new THREE.Mesh(new THREE.PlaneGeometry(.2, .05), new THREE.MeshStandardMaterial({ map: t, roughness: .5 })); lb.position.set(0, .07, .122); o.add(lb); } // etiqueta com o nome da marca
  o.traverse(m => { if (m.isMesh) m.castShadow = true; }); return o;
}
// faixa/placa com marca (painel com o nome, nas cores da marca)
function banner(g, text, x, y, z, w, h, bg, fg, rot = 0, sub) {
  const t = canvasTex(512, Math.round(512 * h / w), (c, W, H) => { c.fillStyle = bg; c.fillRect(0, 0, W, H); c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '900 italic ' + Math.round(H * (sub ? .46 : .62)) + 'px Barlow Condensed, Arial Narrow, Arial'; c.fillText(String(text).toUpperCase(), W / 2, H * (sub ? .4 : .52), W * .92);
    if (sub) { c.font = '700 ' + Math.round(H * .2) + 'px Arial'; c.globalAlpha = .85; c.fillText(sub, W / 2, H * .8, W * .9); } }, true);
  // frente e verso legíveis (uma face só ficava espelhada de um dos lados)
  const o = new THREE.Group(), M = new THREE.MeshStandardMaterial({ map: t, roughness: .7 }), geo = new THREE.PlaneGeometry(w, h);
  const f = new THREE.Mesh(geo, M), bk = new THREE.Mesh(geo, M); bk.rotation.y = Math.PI; bk.position.z = -.004; o.add(f, bk); o.position.set(x, y, z); o.rotation.y = rot; g.add(o); return o;
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
    if (n.kind === 'walk') { if (n.pause) { n.o.rotation.y = Math.atan2(px - n.o.position.x, pz - n.o.position.z); continue; } n.x += n.v * dt; if (n.x > n.x1 || n.x < n.x0) { n.v = -n.v; n.x = Math.max(n.x0, Math.min(n.x1, n.x)); }
      // desvia do jogador
      const dz = Math.abs(n.x - px) < 1.2 && Math.abs(n.z - pz) < 1.2 ? (n.z > pz ? .8 : -.8) : 0;
      n.o.position.set(n.x, Math.abs(Math.sin(t * 7 + n.z)) * .04 + groundY(n.x, n.z + dz), n.z + dz); n.o.rotation.y = n.v > 0 ? -Math.PI / 2 : Math.PI / 2; }
    else if (n.kind === 'duck') { const a = t * .3 + n.ph; n.o.position.x = n.cx + Math.cos(a) * 3; n.o.position.z = n.cz + Math.sin(a) * 1.8; n.o.rotation.y = -a; }
    else if (n.kind === 'kids') { const sw = Math.sin(t * 2.6 + n.ph); n.a.position.z = n.z0 + sw * .4; n.b.position.z = n.z1 + sw * .4; n.a.position.x += Math.cos(t * 1.3 + n.ph) * dt * .4; n.b.position.x -= Math.cos(t * 1.3 + n.ph) * dt * .4; }
    else if (n.kind === 'fresco') { const sw = Math.sin(t * 2.2 + n.ph); n.a.position.x = n.x - 3 + sw * .3; n.b.position.x = n.x + 3 + sw * .3; }
    else if (n.kind === 'car') { n.o.position.x += n.v * dt; if (n.o.position.x > 298) n.o.position.x = -98; if (n.o.position.x < -98) n.o.position.x = 298;
      // freia se o jogador está na frente, na rua
      if (Math.abs(n.o.position.z - pz) < 1.6 && (n.v > 0 ? px - n.o.position.x : n.o.position.x - px) > 0 && Math.abs(px - n.o.position.x) < 6) n.o.position.x -= n.v * dt; }
  }
}
// mais bairro: segunda rua com casas dos dois lados, ruas transversais, praça (chafariz, parquinho, bancos, quiosque) e,
// do lado da praia da rua principal, o calçadão com barracas, posto de salva-vidas, academia ao ar livre e bicicletário
const HOUSE_COLS = [['#f3d9b1', '#b4553c'], ['#cfe3e8', '#3d5a80'], ['#e8d1e3', '#6b4f7a'], ['#f6eac2', '#9a5b2c'], ['#d8efd2', '#2f6b3a'], ['#f2c6b4', '#7a3b2e'], ['#e3e6ea', '#2b2d42'], ['#fde2a7', '#c0392b']];
function city2(g, sp) {
  const R = mulberry(($s.CR.seed || 5) * 7 + 3), road = (w, d, x, z) => box(g, w, .06, d, x, .03, z, '#3a3f47', { noShadow: true }), walk = (w, d, x, z) => box(g, w, .14, d, x, .07, z, '#cfcac0', { noShadow: true });
  // segunda rua (z = 64), ligada à principal por ruas transversais
  road(340, 8, 115, 64); walk(340, 2.4, 115, 59.2); walk(340, 2.4, 115, 68.8); for (let i = -50; i < 285; i += 5) box(g, 2.2, .02, .18, i, .07, 64, '#f2f2f2', { noShadow: true });
  [-55, 25, 88].forEach(x => { road(8, 32, x, 44); walk(2.4, 32, x - 5.2, 44); walk(2.4, 32, x + 5.2, 44); for (let z = 30; z < 58; z += 5) box(g, .18, .02, 2.2, x, .07, z, '#f2f2f2', { noShadow: true }); });
  // casas: lado de baixo da segunda rua e lado de cima onde não tem nada
  let k = 0; for (let x = -46; x < 280; x += 14) { if ((x > 18 && x < 64) || Math.abs(x - 88) < 10 || Math.abs(x + 55) < 10) continue; const c = HOUSE_COLS[k++ % HOUSE_COLS.length], w = 9 + R() * 3; neighborHouse(g, x, 77, w, 8, c[0], c[1], -1); if (R() < .45) car(g, x + w / 2 + 2, 71.6, 0, FAN_COLS[k % FAN_COLS.length]); }
  for (let x = 100; x < 280; x += 16) { const c = HOUSE_COLS[k++ % HOUSE_COLS.length]; neighborHouse(g, x, 51, 10, 7, c[0], c[1], 1); }
  for (let x = -40; x < 15; x += 15) { const c = HOUSE_COLS[k++ % HOUSE_COLS.length]; neighborHouse(g, x, 51, 9, 7, c[0], c[1], 1); }
  // praça: chafariz, árvores, bancos, parquinho e quiosque de coco
  { const px0 = 42, pz0 = 90; box(g, 40, .08, 30, px0, .05, pz0, '#7fb069', { noShadow: true }); box(g, 40, .1, 3, px0, .06, pz0, '#d8cdb5', { noShadow: true }); box(g, 3, .1, 30, px0, .06, pz0, '#d8cdb5', { noShadow: true });
    cyl(g, 2.6, 2.8, .6, px0, .3, pz0, '#cfd3d8'); cyl(g, 2.3, 2.3, .05, px0, .58, pz0, '#3fb6e8', { metalness: .2, roughness: .1, ...glow('#54c8ff', .2) }); cyl(g, .25, .35, 1.6, px0, .8, pz0, '#cfd3d8'); solid(px0 - 2.8, pz0 - 2.8, px0 + 2.8, pz0 + 2.8);
    for (let i = 0; i < 10; i++) { const tx = px0 - 17 + (i % 5) * 8.5, tz = pz0 + (i < 5 ? -10 : 10); cyl(g, .18, .25, 2.6, tx, 1.3, tz, '#7a5a42'); const c = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), mat('#3f8f4a')); c.position.set(tx, 3.4, tz); c.castShadow = true; g.add(c); solid(tx - .3, tz - .3, tx + .3, tz + .3); }
    [[-8, -4], [8, -4], [-8, 4], [8, 4]].forEach(([a, b2]) => bench(g, px0 + a, pz0 + b2));
    { const qx = px0 + 13, qz = pz0 + 8; [-1, 1].forEach(sd => cyl(g, .06, .06, 2.4, qx + sd * 1.4, 1.2, qz, '#e63946')); box(g, 3, .08, .08, qx, 2.4, qz, '#e63946'); box(g, .5, .05, .3, qx - .5, .6, qz, '#ffd23f'); box(g, .5, .05, .3, qx + .5, .6, qz, '#2457c5');
      const sl = box(g, .7, .06, 3, qx - 4, 1, qz, '#33c3ff'); sl.rotation.x = .5; box(g, .8, 2, .8, qx - 4, 1, qz - 1.6, '#ffd23f'); solid(qx - 4.5, qz - 2, qx + 1.6, qz + .3);
      for (let i = 0; i < 3; i++) { const c = dyn2(sp, fan(new THREE.Group(), qx - 2 + i * 1.6, qz + 2, R() * 6, 500 + i, false)); c.scale.setScalar(.6); LV.npcs.push({ kind: 'walk', o: c, x: qx - 2 + i * 1.6, z: qz + 2 + i * .5, v: (i % 2 ? .6 : -.6), x0: qx - 6, x1: qx + 3 }); } }
    cyl(g, 1.2, 1.2, 1, px0 - 13, .5, pz0 + 8, '#8a6a45'); const rf = new THREE.Mesh(new THREE.ConeGeometry(2, 1, 8), mat('#2a9d8f')); rf.position.set(px0 - 13, 2.6, pz0 + 8); g.add(rf); cyl(g, .06, .06, 2.2, px0 - 13, 1.2, pz0 + 8, '#3a3f47'); solid(px0 - 14.3, pz0 + 6.7, px0 - 11.7, pz0 + 9.3);
    banner(g, 'Praça da Orla', px0, 2.6, pz0 - 15.2, 6, 1, '#2a9d8f', '#ffffff'); cyl(g, .06, .06, 2.6, px0 - 2.8, 1.3, pz0 - 15.2, '#3a3f47'); cyl(g, .06, .06, 2.6, px0 + 2.8, 1.3, pz0 - 15.2, '#3a3f47');
    spot(sp, 'coco', px0 - 13, pz0 + 10.6, 'Quiosque de coco', 'Água de coco (+2 energia)');
    for (let i = 0; i < 8; i++) { const o = dyn2(sp, fan(new THREE.Group(), px0 - 15 + R() * 30, pz0 - 12 + R() * 24, 0, 520 + i, false)); LV.npcs.push({ kind: 'walk', o, x: o.position.x, z: o.position.z, v: (i % 2 ? 1 : -1) * (.5 + R() * .4), x0: px0 - 18, x1: px0 + 18 }); } }
  for (let i = 0; i < 12; i++) { const z = i % 2 ? 59.2 : 68.8, x0 = -50 + R() * 320, o = dyn2(sp, fan(new THREE.Group(), x0, z, 0, 540 + i, false)); LV.npcs.push({ kind: 'walk', o, x: x0, z, v: (i % 2 ? 1 : -1) * (.9 + R() * .5), x0: -55, x1: 285 }); }
  for (let i = 0; i < 2; i++) { const tmp = new THREE.Group(); car(tmp, 0, 0, 0, ['#6b4f7a', '#2a9d8f'][i]); LV.boxes.pop(); const o = dyn2(sp, tmp); o.position.set(-40 + i * 150, 0, i ? 65.8 : 62.2); o.rotation.y = i ? Math.PI : 0; LV.npcs.push({ kind: 'car', o, v: i ? -8 : 8 }); }
  // lado da praia da rua principal: calçadão de pedras portuguesas com barracas, salva-vidas, academia ao ar livre e bicicletário
  box(g, 340, .08, 4, 115, .05, 14, '#e9d7b0', { noShadow: true }); for (let x = -50; x < 285; x += 2) box(g, .9, .02, 3.6, x, .1, 14, x % 4 ? '#f4f4f4' : '#2b2d31', { noShadow: true });
  const kio = (x, z, col, nm) => { box(g, 3.2, 2.4, 2.4, x, 1.2, z, '#f4f0e6'); const aw = new THREE.Mesh(new THREE.BoxGeometry(3.8, .1, 1.6), mat(col)); aw.position.set(x, 2.5, z + 1.6); aw.rotation.x = .2; g.add(aw); banner(g, nm, x, 2.85, z + 1.22, 3, .45, col, '#ffffff'); solid(x - 1.6, z - 1.2, x + 1.6, z + 1.2);
    for (let i = 0; i < 2; i++) { umbrella(g, x - 2.5 + i * 5, z + 4, col); chair(g, x - 2.5 + i * 5 + .6, z + 4.5, Math.PI, '#ffffff'); if (R() < .7) fan(g, x - 2.5 + i * 5 + .6, z + 4.5, Math.PI, 560 + i + Math.round(x), true).position.y = -.05; } };
  [[36, 8, '#e63946', ($s.CR.cosm || {}).barracaNova ? 'Barraca do Zé & ' + nameOf($s.CR.me).split(' ')[0] : 'Barraca do Zé'], [70, 8, '#ff6a00', 'Pastel & Caldo'], [104, 8, '#2457c5', 'Milho & Pipoca'], [132, 8, '#2a9d8f', 'Coco Gelado'], [268, 8, '#ffd23f', 'Picolé Praia']].forEach(([x, z, c, n]) => kio(x, z, c, n));
  spot(sp, 'barraca', 36, 12, 'Barraca do Zé', 'Petisco na praia (+3 energia)');
  { const lx = 88, lz = -30; [-1, 1].forEach(a => [-1, 1].forEach(b2 => cyl(g, .08, .08, 3, lx + a * .9, 1.5, lz + b2 * .9, '#f4f4f4'))); box(g, 2.4, 1.6, 2.4, lx, 3.8, lz, '#e63946'); box(g, 2.6, .2, 2.6, lx, 4.7, lz, '#ffffff'); solid(lx - 1, lz - 1, lx + 1, lz + 1); fan(g, lx, lz + 1.6, Math.PI, 600, false); }
  { const ox = 116, oz = 4; box(g, 10, .06, 6, ox, .04, oz, '#2b2d31', { noShadow: true }); for (let i = 0; i < 3; i++) { cyl(g, .05, .05, 2, ox - 3 + i * 3, 1, oz, '#ffd23f'); box(g, 1.4, .06, .06, ox - 3 + i * 3, 2, oz, '#ffd23f'); }
    for (let i = 0; i < 2; i++) fan(g, ox - 3 + i * 3, oz + 1, Math.PI, 610 + i, false);
    for (let i = 0; i < 6; i++) box(g, .06, .7, .06, ox + 7 + i * .7, .35, oz, '#9aa0a8'); }
}
// ---------- cidade norte: terceira rua, casas e as praças com quadra pública (jogar com a galera, nível do dia) ----------
const PLAZAS = [{ id: 'sol', name: 'Praça do Sol', x: 10, z: 160 }, { id: 'gaivotas', name: 'Praça das Gaivotas', x: 125, z: 160 }, { id: 'iemanja', name: 'Praça Iemanjá', x: 240, z: 160 }, { id: 'palmeiras', name: 'Praça das Palmeiras', x: 190, z: 230, extra: true }];
const PRACA_LV = [{ n: 'Iniciante', ovr: [45, 58], diff: 'facil', money: 150, fama: .3 }, { n: 'Médio', ovr: [58, 70], diff: 'medio', money: 400, fama: .6 }, { n: 'Forte', ovr: [70, 80], diff: 'dificil', money: 900, fama: 1 }, { n: 'Fera', ovr: [80, 88], diff: 'dificil', money: 1600, fama: 1.5 }];
const dayKey = () => { const C = $s.CR; return C.season + '-' + C.week + '-' + C.day; };
// nível da galera em cada praça hoje (muda todo dia, sempre o mesmo no mesmo dia)
function pracaLevel(pl, ci = 0) { const C = $s.CR; let h = (C.seed || 1) * 31 + C.season * 997 + C.week * 53 + C.day * 7; for (const ch of pl.id) h = (h * 33 + ch.charCodeAt(0)) >>> 0; const b = h % PRACA_LV.length;
  return ci ? (b + 1 + ((h >>> 5) % (PRACA_LV.length - 1))) % PRACA_LV.length : b; } // (quadras diferentes da mesma praça: níveis diferentes)
function city3(g, sp) {
  const R = mulberry(($s.CR.seed || 9) * 13 + 5), road = (w, d, x, z) => box(g, w, .06, d, x, .03, z, '#3a3f47', { noShadow: true }), walk = (w, d, x, z) => box(g, w, .14, d, x, .07, z, '#cfcac0', { noShadow: true });
  road(340, 8, 115, 124); walk(340, 2.4, 115, 119.2); walk(340, 2.4, 115, 128.8); for (let i = -50; i < 285; i += 5) box(g, 2.2, .02, .18, i, .07, 124, '#f2f2f2', { noShadow: true });
  [-55, 88].forEach(x => { road(8, 52, x, 94); walk(2.4, 52, x - 5.2, 94); walk(2.4, 52, x + 5.2, 94); });
  for (let x = -40; x <= 280; x += 12) { if (Math.abs(x + 55) < 8 || Math.abs(x - 88) < 8) continue; palm(g, x, 117.6, 4.4 + (Math.abs(x) % 3)); }
  // casas entre a segunda e a terceira rua (de frente para a terceira)
  let k = 0; for (let x = -44; x < 280; x += 15) { if ((x > 18 && x < 66) || Math.abs(x - 88) < 10 || Math.abs(x + 55) < 10) continue; const c = HOUSE_COLS[(k++ + 3) % HOUSE_COLS.length]; neighborHouse(g, x, 108, 10, 7, c[0], c[1], 1); if (R() < .35) car(g, x + 7, 115.6, 0, FAN_COLS[k % FAN_COLS.length]); }
  // praças ao norte da terceira rua: grama, caminhos, árvores, bancos e a quadra pública com rede de verdade
  LV.plazas = [{ id: 'orla', name: 'Praça da Orla', x: 42, z: 90, w: 40, d: 30 }];
  PLAZAS.filter(q => !q.extra).forEach((pl, i) => {
    const { x, z } = pl, lv = PRACA_LV[pracaLevel(pl)]; LV.plazas.push(Object.assign({ w: 46, d: 36 }, pl));
    box(g, 46, .08, 36, x, .05, z, '#7fb069', { noShadow: true }); box(g, 46, .1, 2.6, x, .06, z - 16, '#d8cdb5', { noShadow: true });
    box(g, 14, .02, 22, x, .09, z + 2, '#f1e2b8', { noShadow: true }); [[8, .06, x, z - 6], [8, .06, x, z + 10], [.06, 16, x - 4, z + 2], [.06, 16, x + 4, z + 2]].forEach(([w, d, a, b]) => box(g, w, .02, d, a, .12, b, '#1f4fb8', { noShadow: true }));
    realNet(g, x, z + 2, 8, 'x', pl.id === 'iemanja' && ($s.CR.cosm || {}).redeNome ? 'Quadra ' + nameOf($s.CR.me) : pl.name, ['#e63946', '#2457c5', '#2a9d8f'][i]);
    if (pl.id === 'sol' && ($s.CR.cosm || {}).estatuaOuro) { const rk = new THREE.Mesh(new THREE.TorusGeometry(.25, .05, 8, 16), mat('#ffd23f', { metalness: .9, roughness: .2 })); rk.position.set(x + 12.4, 4.1, z - 13); g.add(rk); }
    if (pl.id === 'sol' && ($s.CR.cosm || {}).estatua) { box(g, 2, 1.2, 2, x + 12, .6, z - 13, '#d9d4c7'); const st = fan(g, x + 12, z - 13, 0, 17, false); st.position.y = 1.2; st.scale.setScalar(1.25); st.traverse(o => { if (o.isMesh) o.material = mat('#c9a227', { metalness: .8, roughness: .3 }); }); banner(g, 'Lenda do Bairro', x + 12, .7, z - 11.98, 1.8, .5, '#1d1d20', '#e8b923', 0, nameOf($s.CR.me)); solid(x + 11, z - 14, x + 13, z - 12); } solid(x - 4.4, z + 1.9, x + 4.4, z + 2.1);
    for (let t = 0; t < 8; t++) { const tx = x - 20 + (t % 4) * 13.3, tz = z + (t < 4 ? -12 : 15); cyl(g, .18, .25, 2.6, tx, 1.3, tz, '#7a5a42'); const c = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), mat(['#3f8f4a', '#4f9a52', '#2f7a3f'][t % 3])); c.position.set(tx, 3.3, tz); c.castShadow = true; g.add(c); solid(tx - .3, tz - .3, tx + .3, tz + .3); }
    [[-14, -4], [-14, 8], [14, -4], [14, 8]].forEach(([a, b]) => bench(g, x + a, z + b));
    for (let s2 = 0; s2 < 5; s2++) { const cx = x - 6.5, cz = z - 4 + s2 * 2.4; chair(g, cx, cz, Math.PI / 2, '#f4f4f4'); if (R() < .6) fan(g, cx, cz, Math.PI / 2, 700 + i * 9 + s2, true).position.y = -.05; }
    banner(g, pl.name, x, 2.6, z - 17.2, 7, 1.1, ['#e63946', '#2457c5', '#2a9d8f'][i], '#ffffff', 0, 'quadra pública · beach tennis'); cyl(g, .06, .06, 2.6, x - 3.2, 1.3, z - 17.2, '#3a3f47'); cyl(g, .06, .06, 2.6, x + 3.2, 1.3, z - 17.2, '#3a3f47');
    // a galera aquecendo na quadra (quanto mais forte o nível, mais gente assistindo)
    [-1, 1].forEach(sd => [-1, 1].forEach(q => fan(g, x + q * 1.8, z + 2 + sd * 5, sd > 0 ? Math.PI : 0, 720 + i * 4 + q + sd, false)));
    for (let w2 = 0; w2 < 3 + pracaLevel(pl) * 2; w2++) { const o = dyn2(sp, fan(new THREE.Group(), x - 18 + R() * 36, z - 13 + R() * 4, 0, 740 + i * 11 + w2, false)); LV.npcs.push({ kind: 'walk', o, x: o.position.x, z: o.position.z, v: (w2 % 2 ? 1 : -1) * (.5 + R() * .5), x0: x - 21, x1: x + 21 }); }
    spot(sp, 'praca', x, z - 8.6, pl.name, 'Galera nível ' + lv.n + ' hoje'); LV.spots[LV.spots.length - 1].plaza = pl;
    plazaTheme(g, sp, pl, x, z);
  });
  // gente andando na terceira rua
  for (let i = 0; i < 10; i++) { const z = i % 2 ? 119.2 : 128.8, x0 = -50 + R() * 320, o = dyn2(sp, fan(new THREE.Group(), x0, z, 0, 760 + i, false)); LV.npcs.push({ kind: 'walk', o, x: x0, z, v: (i % 2 ? 1 : -1) * (.9 + R() * .5), x0: -55, x1: 285 }); }
  givers(g, sp);
}
// jogar na praça: a galera do nível do dia (você escolhe só se topa); vale dinheiro e fama vencendo, uma vez por praça por dia
function pracaPlay(pl, ci = 0) {
  const C = $s.CR; C.pracaDay = C.pracaDay || {}; const dk = pl.id + (ci ? ':' + ci : '');
  if (C.pracaDay[dk] === dayKey()) { LV.msg('🎾 Você já jogou na ' + pl.name + ' hoje. A galera pede revanche amanhã!'); return; }
  const L = PRACA_LV[pracaLevel(pl, ci)], fem = !!C.me.fem, pool = crWorld().filter(c => c.id !== 'crme' && c.id !== C.partner && !!c.fem === fem).map(c => ({ c, o: crCharOvr(c) })).filter(x => x.o >= L.ovr[0] && x.o <= L.ovr[1]);
  if (pool.length < 3) { LV.msg('A quadra está vazia agora. Volte mais tarde.'); return; }
  const pick3 = []; while (pick3.length < 3) { const x = pool[Math.floor(Math.random() * pool.length)]; if (!pick3.includes(x)) pick3.push(x); }
  const weakPool = crWorld().filter(c => c.id !== 'crme' && !!c.fem === fem).map(c => ({ c, o: crCharOvr(c) })).filter(x => x.o <= 55), weak = weakPool.length ? weakPool[Math.floor(Math.random() * weakPool.length)] : null;
  const ovrAvg = Math.round((pick3[1].o + pick3[2].o) / 2), ch = (C.missions || []).filter(m => /^ch/.test(m.type));
  const el = talkBox();
  el.innerHTML = '<div class="card lv-fr"><div class="eyebrow">' + pl.name + (LV.near && LV.near.multi ? ' · quadra ' + (ci + 1) : ' · quadra pública') + '</div><h3>Galera nível ' + L.n + '</h3>'
    + '<p>' + pick(['"Tá faltando um pra fechar a dupla, entra aí!"', '"Ó quem chegou! Bora um jogo?"', '"Aqui a regra é: quem perde paga o coco."', '"Joga com a gente? Só não vale smash na cabeça."', '"Simples ou dupla? Aqui a gente topa tudo."']) + '</p>'
    + '<p class="cr-note">Dupla: você e <b>' + esc2(nameOf(pick3[0].c)) + '</b> (OVR ' + pick3[0].o + ') contra <b>' + esc2(nameOf(pick3[1].c)) + '</b> e <b>' + esc2(nameOf(pick3[2].c)) + '</b> (OVR ~' + ovrAvg + ').<br>Simples: você contra <b>' + esc2(nameOf(pick3[1].c)) + '</b> (OVR ' + pick3[1].o + ').'
    + (weak ? '<br>Com um iniciante: você e <b>' + esc2(nameOf(weak.c)) + '</b> (OVR ' + weak.o + ') contra a dupla deles (prêmio +50%).' : '') + '</p>'
    + (ch.length ? '<p class="cr-note">📋 Desafios ativos: ' + ch.map(m => m.text).join(' · ') + '</p>' : '')
    + '<p class="cr-note">Vencendo: +$' + L.money + ' e +' + String(L.fama).replace('.', ',') + ' de fama. Conta como o treino do dia.</p>'
    + '<div class="cta-row"><button type="button" class="cta" data-go="dupla">Jogar em dupla</button><button type="button" class="ghost" data-go="simples">Jogar simples</button>' + (weak ? '<button type="button" class="ghost" data-go="fraco">Dupla com o iniciante</button>' : '') + '<button type="button" class="ghost" data-x>Agora não</button></div></div>';
  el.hidden = false; LV.modal = true;
  el.querySelector('[data-x]').onclick = () => { el.hidden = true; LV.modal = false; };
  el.querySelectorAll('[data-go]').forEach(bt => bt.onclick = () => { const md = bt.dataset.go; el.hidden = true; LV.modal = false; C.pracaDay[dk] = dayKey(); saveCareer();
    if (LV.actions.friendly) LV.actions.friendly({ mate: md === 'fraco' ? weak.c.id : pick3[0].c.id, o1: pick3[1].c.id, o2: pick3[2].c.id, kind: 'praca', level: pracaLevel(pl, ci), diff: L.diff, place: pl.id, mode: md === 'simples' ? 'simples' : 'dupla', weak: md === 'fraco', venue: pl.kind === 'arena' || pl.kind === 'coberta' ? { indoor: true, hall: 'small', text: pl.name.toUpperCase() } : { urban: true, text: pl.name.toUpperCase() } }); });
}
const pick = a => a[Math.floor(Math.random() * a.length)];
const esc2 = t => String(t).replace(/[<>&]/g, '');
LV.onFriendlyEnd = r => {
  const C = $s.CR; if (!r || !r.played) return;
  if (r.kind === 'praca') { const L = PRACA_LV[r.level || 0];
    if (r.won) { const k = r.weak ? 1.5 : 1, mo = Math.round(L.money * k); C.money += mo; crAddFama(L.fama * k); LV.msg('🏆 Vitória na praça' + (r.mode === 'simples' ? ' (simples)' : r.weak ? ' com o iniciante' : '') + '! +$' + mo + ' e +' + String(Math.round(L.fama * k * 10) / 10).replace('.', ',') + ' de fama.'); missionEvent('praca', { level: r.level, weak: !!r.weak }); }
    else LV.msg('😅 A galera da praça venceu dessa vez. Amanhã tem mais!');
    missionEvent('match', r);
    saveCareer(); setTimeout(() => hud(true), 0); }
};

// ---------- materiais (ganhos em missões): vende na Pro Shop ou doa no projeto social ----------
const MATS = { overgrip: ['Overgrip', 40, '🩹'], bolas: ['Tubo de bolas', 60, '🎾'], munhequeira: ['Munhequeira', 50, '🧣'], protetor: ['Protetor solar', 30, '🧴'], viseira: ['Viseira autografada', 150, '🧢'], garrafa: ['Garrafa térmica', 80, '🥤'] };
function matsHTML() { const M = $s.CR.mats || {}, ks = Object.keys(M).filter(k => M[k] > 0); return ks.length ? ks.map(k => MATS[k][2] + ' ' + MATS[k][0] + ' ×' + M[k]).join(' · ') : 'nenhum ainda'; }
function matsSell() { const C = $s.CR, M = C.mats || {}; let tot = 0; for (const k in M) { tot += (MATS[k] ? MATS[k][1] : 0) * M[k]; } if (!tot) { LV.msg('Você não tem materiais para vender. Complete missões pela cidade.'); return; } C.mats = {}; C.money += tot; saveCareer(); LV.msg('🛒 A Bia comprou os seus materiais: +$' + tot + '.'); }
function matsDonate() { const C = $s.CR, M = C.mats || {}; let n = 0; for (const k in M) n += M[k]; if (!n) { LV.msg('Sem materiais para doar agora. As missões dão materiais.'); return; } C.mats = {}; crAddFama(Math.min(4, n * .35)); saveCareer(); LV.msg('🤝 Você doou ' + n + ' materiais para a escolinha: a garotada fez festa (+' + String(Math.round(Math.min(4, n * .35) * 10) / 10).replace('.', ',') + ' de fama).'); }

// ---------- história do bairro: missões principais em cadeia (cada uma libera as próximas) ----------
// "A Copa do Bairro": a volta do atleta famoso ao bairro, a quadra abandonada, o quiosque em crise, o festival e a copa.
// Recompensas principais são estéticas (mural, bandeira, rede com o seu nome, raqueteira dourada, estátua, título)
const STORY = [
  { id: 's1', req: [], giver: 'cida', title: 'Volta ao bairro', m: { type: 'talk', need: 3, text: 'Reencontrar o pessoal: conversar com 3 pessoas' },
    ask: 'Você sumiu, menino! O bairro sente sua falta. Dá uma volta, conversa com o pessoal, mostra que continua o mesmo.', end: 'Viu? Todo mundo ainda te ama. Mas tem coisa errada por aqui… fala com o Léo e com o Jorge.', rw: { fama: .5, cosm: 'adesivoBairro' } },
  { id: 's2a', req: ['s1'], giver: 'leo', title: 'A quadra esquecida', m: { type: 'visit1', place: 'iemanja', text: 'Ver como está a quadra da Praça Iemanjá' },
    ask: 'A quadra da Praça Iemanjá tá caindo aos pedaços. Era lá que você aprendeu a jogar, lembra? Vai lá ver.', end: 'Triste, né? Rede rasgada, linha apagada… Mas eu tenho uma ideia.', rw: { pe: 1 } },
  { id: 's2b', req: ['s1'], giver: 'jorge', title: 'O quiosque em crise', m: { type: 'deliver', target: { spot: 'barraca' }, text: 'Levar os últimos cocos do Seu Jorge para a Barraca do Zé' },
    ask: 'O movimento caiu muito, meu filho. Se o Zé vender meus cocos lá no calçadão, eu respiro. Leva pra ele?', end: 'O Zé disse que vendeu tudo! E ainda falou de um tal festival…', rw: { money: 300, cosm: 'adesivoCoco' } },
  { id: 's3a', req: ['s2a'], giver: 'leo', title: 'Reforma da quadra', m: { type: 'pay', cost: 2000, text: 'Bancar a reforma da quadra da Praça Iemanjá ($2.000)' },
    ask: 'A prefeitura não ajuda. Se você bancar a reforma, a quadra fica nova e com o seu nome na rede. Topa?', end: 'Ficou linda! A molecada já tá jogando lá. Seu nome tá na rede, viu?', rw: { fama: 2, cosm: 'redeNome' } },
  { id: 's3b', req: ['s2b'], giver: 'ze', title: 'Festival de verão', m: { type: 'chSmash', need: 1, n: 3, text: 'Abrir o festival com um show: vencer na praça com 3 smashes vencedores' },
    ask: 'Vou fazer um festival pra salvar o quiosque do Jorge, mas preciso de atração. Abre o festival ganhando um jogo na praça!', end: 'Que abertura! O calçadão lotou. O Jorge até chorou.', rw: { money: 600, cosm: 'mural' } },
  { id: 's4', req: ['s3a', 's3b'], giver: 'bia', title: 'Copa do Bairro: inscrições', m: { type: 'talk', need: 5, text: 'Divulgar a Copa do Bairro: conversar com 5 pessoas' },
    ask: 'Com a quadra nova e o festival, todo mundo tá falando em fazer uma Copa do Bairro! Me ajuda a divulgar?', end: 'Chave fechada! 16 duplas inscritas. Você é o cabeça de chave, claro.', rw: { fama: 1, mat: 'viseira' } },
  { id: 's5a', req: ['s4'], giver: 'leo', title: 'Preparação', m: { type: 'train', need: 1, text: 'Fazer um treino de verdade antes da Copa' },
    ask: 'Ser favorito é perigoso. Treina sério, que o bairro inteiro vai estar olhando.', end: 'Tá voando! Toma essa bandeira pra pendurar em casa: é do bairro.', rw: { pe: 2, cosm: 'bandeira' } },
  { id: 's5b', req: ['s4'], giver: 'bia', title: 'Patrocinador da Copa', m: { type: 'deliver', target: { spot: 'restaurante' }, text: 'Convencer o Restaurante Maré a patrocinar a Copa (ir até lá)' },
    ask: 'Falta o prêmio da Copa. O Restaurante Maré pode bancar. Vai lá conversar com eles?', end: 'Eles toparam! Jantar para a dupla campeã e camisetas para todo mundo.', rw: { money: 500, cosm: 'adesivoMare' } },
  { id: 's6', req: ['s5a', 's5b'], giver: 'kai', title: 'Semifinal', m: { type: 'pracaLvl', need: 1, minLv: 2, text: 'Semifinal da Copa: vencer na praça com a galera Forte ou Fera' },
    ask: 'Irmão, a semifinal é contra a galera brava das praças. Nível Forte pra cima. Vai com tudo!', end: 'Que jogo! Tô arrepiado. Toma, a raqueteira dourada da Copa é sua.', rw: { fama: 1.5, cosm: 'bagOuro' } },
  { id: 's7', req: ['s6'], giver: 'cida', title: 'A grande final', m: { type: 'pracaLvl', need: 1, minLv: 3, text: 'Final da Copa do Bairro: vencer a galera Fera numa praça' },
    ask: 'A final é contra a galera Fera. O bairro inteiro vai estar lá, até eu, com meu joelho. Vai lá e ganha pra gente!', end: 'CAMPEÃO DO BAIRRO! Fizemos uma estátua sua na Praça do Sol. Você é lenda aqui, pra sempre.', rw: { fama: 4, money: 2000, cosm: 'estatua' } },
  // ----- Parte 2: O Centro Comunitário (capítulos 11–16) -----
  { id: 's8', req: ['s7'], giver: 'leo', title: 'Um sonho maior', m: { type: 'visit1', place: 'palmeiras', text: 'Conhecer a Praça das Palmeiras, onde o Léo quer o centro de treinamento comunitário' },
    ask: 'Depois da Copa, a molecada não para de chegar. Tenho um sonho: um centro de treinamento na Praça das Palmeiras. Vai lá ver o espaço comigo?', end: 'Imagina isso cheio de criança jogando… Vamos precisar de ajuda pra tirar do papel.', rw: { pe: 1, cosm: 'adesivoPalmeiras' } },
  { id: 's9', req: ['s8'], giver: 'bia', title: 'Patrocínio de verdade', m: { type: 'talk', need: 4, text: 'Conversar com 4 pessoas para juntar apoio ao centro' },
    ask: 'Uma marca grande topa bancar o centro, mas quer ver o bairro engajado. Conversa com o pessoal, mostra que todo mundo quer isso!', end: 'A marca topou! Mas impôs uma condição… o Kai explica.', rw: { money: 800 } },
  { id: 's10', req: ['s8'], giver: 'cida', title: 'O neto da Dona Cida', m: { type: 'deliver', target: { spot: 'sorvete' }, text: 'Levar o Tiaguinho (neto da Dona Cida) para tomar sorvete na Praça do Sol' },
    ask: 'Meu neto, o Tiaguinho, tá tristinho porque não entrou no time da escola. Leva ele pra tomar um sorvete na Praça do Sol e conversa com ele?', end: 'Ele voltou sorrindo e disse que vai ser atleta igual você! Obrigada, meu filho.', rw: { fama: 1, cosm: 'adesivoTiaguinho' } },
  { id: 's11', req: ['s9'], giver: 'kai', title: 'A condição da marca', m: { type: 'pracaLvl', need: 1, minLv: 3, text: 'Vencer a galera Fera para provar que o bairro forma campeões' },
    ask: 'A marca quer um jogo-exibição: você contra a galera mais brava das praças. Nível Fera. Se ganhar, o centro sai!', end: 'GANHOU! O contrato tá assinado, irmão. O centro vai sair!', rw: { fama: 2, money: 1500 } },
  { id: 's12', req: ['s10', 's11'], giver: 'leo', title: 'Primeira pedra', m: { type: 'pay', cost: 5000, text: 'Completar o dinheiro da obra do centro ($5.000)' },
    ask: 'Falta pouco pra fechar a obra. Se você completar com $5.000, a gente começa amanhã. O centro vai ter seu nome.', end: 'Tá pronto! Centro Comunitário com o seu nome na entrada. Olha a placa!', rw: { fama: 3, cosm: 'centro' } },
  { id: 's13', req: ['s12'], giver: 'ze', title: 'Inauguração', m: { type: 'talk', need: 5, text: 'Convidar 5 pessoas para a inauguração do centro' },
    ask: 'Inauguração tem que ter gente! Chama o povo, que eu levo o pastel e o caldo de cana.', end: 'Que festa! Até a TV veio. O bairro nunca esteve tão bonito.', rw: { money: 600, mat: 'garrafa' } },
  // ----- Parte 3: A tempestade (capítulos 17–22) -----
  { id: 's14', req: ['s13'], giver: 'kai', title: 'O mar avisou', m: { type: 'swim', need: 20, text: 'Ajudar o Kai a recolher as boias antes da tempestade (nadar 20 s)' },
    ask: 'O mar tá estranho, irmão. Vem tempestade. Me ajuda a tirar as boias da água antes que leve tudo?', end: 'Bem a tempo! Mas a ressaca vai pegar o calçadão… se prepara.', rw: { pe: 1, cosm: 'prancha' } },
  { id: 's15', req: ['s14'], giver: 'ze', title: 'Depois da ressaca', m: { type: 'deliver', target: { spot: 'barraca' }, text: 'Ver o estrago na Barraca do Zé depois da tempestade' },
    ask: 'A ressaca destruiu metade do calçadão… e minha barraca. Passa lá comigo? Não tenho coragem de ver sozinho.', end: 'Sobrou pouco… Mas o bairro já tá se mexendo. A Bia teve uma ideia.', rw: { fama: .5 } },
  { id: 's16', req: ['s15'], giver: 'bia', title: 'Mutirão', m: { type: 'talk', need: 6, text: 'Chamar 6 pessoas para o mutirão do calçadão' },
    ask: 'Vamos fazer um mutirão pra reconstruir o calçadão. Você chamando, todo mundo vem. Bora?', end: 'Mais de cem pessoas apareceram! Tô sem palavras.', rw: { fama: 1.5, mat: 'protetor' } },
  { id: 's17', req: ['s15'], giver: 'jorge', title: 'Torneio beneficente', m: { type: 'chSimples', need: 1, text: 'Torneio beneficente de simples: vencer uma simples numa praça' },
    ask: 'Pra reconstruir a barraca do Zé, vamos fazer um torneio beneficente nas praças. Cada vitória sua vale doação dobrada!', end: 'Arrecadamos tudo! A barraca do Zé volta maior.', rw: { money: 1000 } },
  { id: 's18', req: ['s16', 's17'], giver: 'ze', title: 'Barraca nova', m: { type: 'pay', cost: 3000, text: 'Ajudar a comprar o toldo e o freezer da barraca nova ($3.000)' },
    ask: 'Falta o toldo e o freezer. Se você ajudar, a barraca nova vai ter o seu nome. Fechado?', end: 'Barraca do Zé & ' + 'amigos, reaberta! O calçadão tá mais bonito que antes.', rw: { fama: 2, cosm: 'barracaNova' } },
  { id: 's19', req: ['s18'], giver: 'cida', title: 'Missa de agradecimento', m: { type: 'visit1', place: 'matriz', text: 'Ir à missa de agradecimento na Praça da Matriz' },
    ask: 'O padre vai fazer uma missa de agradecimento pela reconstrução. Ele pediu pra você estar lá. Vai?', end: 'O padre agradeceu você no altar. Eu chorei de novo, viu?', rw: { fama: 1, cosm: 'adesivoMatriz' } },
  // ----- Parte 4: Legado (capítulos 23–30) -----
  { id: 's20', req: ['s19'], giver: 'leo', title: 'Aula na escola', m: { type: 'train', need: 2, text: 'Preparar a aula da escola municipal: treinar 2 vezes' },
    ask: 'A Escola Municipal quer beach tennis na educação física. Me ajuda a montar a aula? Treina comigo pra gente acertar o método.', end: 'Aprovado! Toda segunda tem aula de beach tennis na escola agora.', rw: { pe: 2, cosm: 'grafite' } },
  { id: 's21', req: ['s19'], giver: 'kai', title: 'Campeonato de surfe', m: { type: 'swim', need: 40, text: 'Treinar com o Kai para o campeonato de surfe (nadar 40 s)' },
    ask: 'Vai ter campeonato de surfe e eu quero você na minha equipe de apoio. Treina na água comigo!', end: 'Fiquei em segundo! Você deu sorte, irmão. Volta sempre.', rw: { fama: 1, mat: 'garrafa' } },
  { id: 's22', req: ['s20', 's21'], giver: 'bia', title: 'O documentário', m: { type: 'talk', need: 5, text: 'Dar depoimentos com 5 pessoas do bairro para o documentário' },
    ask: 'Uma produtora quer fazer um documentário sobre você e o bairro! Precisam de depoimentos. Conversa com o pessoal?', end: 'O trailer saiu e já tem um milhão de visualizações!', rw: { fama: 3 } },
  { id: 's23', req: ['s22'], giver: 'cida', title: 'A festa da Matriz', m: { type: 'deliver', target: { spot: 'coreto' }, text: 'Pedir à banda do coreto para tocar na festa da Dona Cida' },
    ask: 'Vou fazer 80 anos e queria a banda do coreto na minha festa. Pede pra eles? Por você eles tocam.', end: 'Que festa linda! A banda tocou a música do meu casamento. Obrigada por tudo.', rw: { fama: 1, cosm: 'adesivoCida' } },
  { id: 's24', req: ['s22'], giver: 'jorge', title: 'Feira do bairro', m: { type: 'deliver', target: { spot: 'feira' }, text: 'Divulgar o coco do Jorge na feira livre' },
    ask: 'A feira cresceu tanto que quero uma barraca lá. Passa na feira e conversa com o pessoal pra mim?', end: 'Consegui a barraca! O coco do Jorge agora tem filial.', rw: { money: 700 } },
  { id: 's25', req: ['s23', 's24'], giver: 'leo', title: 'Copa Internacional do Bairro', m: { type: 'praca', need: 3, text: 'Vencer 3 jogos nas praças na Copa Internacional do Bairro' },
    ask: 'A Copa do Bairro virou internacional! Vem gente da Argentina, da Itália… Ganha três jogos e você é o anfitrião campeão.', end: 'Tricampeão em casa! A imprensa do mundo inteiro falou do nosso bairro.', rw: { fama: 3, money: 2000 } },
  { id: 's26', req: ['s25'], giver: 'ze', title: 'A grande final internacional', m: { type: 'pracaLvl', need: 1, minLv: 3, text: 'Final internacional: vencer a galera Fera' },
    ask: 'Final contra uma dupla italiana fortíssima. Galera Fera. O calçadão inteiro vai estar lá!', end: 'CAMPEÃO INTERNACIONAL! O calçadão ficou em festa até de madrugada.', rw: { fama: 3, cosm: 'estatuaOuro' } },
  { id: 's27', req: ['s26'], giver: 'bia', title: 'Coleção do bairro', m: { type: 'pay', cost: 4000, text: 'Bancar a coleção de camisetas "Cria do Bairro" para a escolinha ($4.000)' },
    ask: 'Quero lançar uma coleção de camisetas com a sua história e doar a renda pra escolinha. Topa investir?', end: 'Esgotou em um dia! Toda criança da escolinha ganhou uma.', rw: { fama: 2, mat: 'viseira' } },
  { id: 's28', req: ['s26'], giver: 'kai', title: 'Pôr do sol na praia', m: { type: 'talk', need: 3, text: 'Juntar 3 amigos para o luau de comemoração' },
    ask: 'Depois de tudo isso, a gente merece um luau. Chama três pessoas e vem ver o pôr do sol comigo.', end: 'Melhor luau da história. Valeu por tudo, irmão.', rw: { fama: 1, cosm: 'fogueira' } },
  { id: 's29', req: ['s27', 's28'], giver: 'cida', title: 'Embaixador da cidade', m: { type: 'visit', need: 5, text: 'Percorrer as cinco praças da cidade na cerimônia de embaixador' },
    ask: 'A prefeitura quer te nomear embaixador da cidade! A cerimônia passa pelas cinco praças. Faz o percurso?', end: 'Agora é oficial: embaixador da cidade! Mas o Léo tem uma última surpresa.', rw: { fama: 3, money: 3000 } },
  { id: 's30', req: ['s29'], giver: 'leo', title: 'A próxima geração', m: { type: 'chFraco', need: 1, text: 'A última partida: vencer em dupla com um iniciante da escolinha (Dupla com o iniciante) contra a galera Médio ou mais' },
    ask: 'Lembra do menino que aprendeu na quadra da Iemanjá? Hoje é você que inspira. Joga uma última com a galera forte e mostra pra molecada como se faz.', end: 'Fim da história… ou só o começo. O bairro tem um campeão, e agora muitos outros vão vir. Obrigado.', rw: { fama: 5, cosm: 'legado' } },
];
const COSM = { adesivoBairro: '🏷️ Adesivo "Cria do bairro"', adesivoCoco: '🏷️ Adesivo do Quiosque do Jorge', adesivoMare: '🏷️ Adesivo do Restaurante Maré', redeNome: '🎾 Rede com o seu nome na Praça Iemanjá', mural: '🎨 Mural com o seu nome na frente de casa',
  bandeira: '🚩 Bandeira do bairro no quintal', adesivoPalmeiras: '🏷️ Adesivo da Praça das Palmeiras', adesivoTiaguinho: '🏷️ Desenho do Tiaguinho', centro: '🏟️ Centro Comunitário com o seu nome (Praça das Palmeiras)',
  prancha: '🏄 Prancha do Kai encostada na sua casa', barracaNova: '⛱️ Barraca do Zé reconstruída com o seu nome', adesivoMatriz: '🏷️ Santinho da Matriz', grafite: '🎨 Grafite seu no muro da escola', adesivoCida: '🏷️ Foto da festa da Dona Cida',
  estatuaOuro: '🏆 Estátua ganha a raquete dourada da Copa Internacional', fogueira: '🔥 Fogueira de luau na praia de casa', legado: '🌟 Título "Embaixador do bairro" e placa no Centro', bagOuro: '🎒 Raqueteira dourada da Copa (liga e desliga aqui em Missões)', estatua: '🗿 Estátua na Praça do Sol + título "Lenda do Bairro"' };
const storyDone = id => !!(($s.CR.story || {})[id]);
const storyOpen = () => STORY.filter(n => !storyDone(n.id) && n.req.every(storyDone));
// ---------- moradores que dão missões (com "!" em cima) ----------
const GIVERS = [{ id: 'cida', name: 'Dona Cida', role: 'aposentada que caminha na praça', x: 44, z: 97, f: true }, { id: 'jorge', name: 'Seu Jorge', role: 'dono do quiosque de coco', x: 31.5, z: 100.5 },
  { id: 'leo', name: 'Professor Léo', role: 'treinador da escolinha', x: 131, z: 153 }, { id: 'bia', name: 'Bia', role: 'gerente da Pro Shop', x: 136, z: 30.6, f: true },
  { id: 'ze', name: 'Zé', role: 'dono da barraca da praia', x: 39, z: 11.6 }, { id: 'kai', name: 'Kai', role: 'surfista', x: 66, z: -78 }];
let _mkTex = null;
const MARK_TEX = () => _mkTex || (_mkTex = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(64, 64, 56, 0, Math.PI * 2); x.fill(); x.lineWidth = 8; x.strokeStyle = '#04122e'; x.stroke(); x.fillStyle = '#04122e'; x.font = '900 86px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('!', 64, 70); }, true));
function givers(g, sp) {
  LV.givers = [];
  GIVERS.forEach((G, i) => { const o = dyn2(sp, fan(new THREE.Group(), G.x, G.z, Math.PI, 800 + i * 3, false));
    const mk = new THREE.Sprite(new THREE.SpriteMaterial({ map: MARK_TEX(), depthTest: false, transparent: true })); mk.scale.setScalar(.5); mk.position.set(0, 2.5, 0); mk.renderOrder = 6; o.add(mk);
    LV.givers.push(Object.assign({ o, mk }, G)); });
}
// tipos de missão: o que fazer, quanto, e o texto de quem pede
const MS_TEMPL = {
  cida: [...(['chFraco']).map(k => () => { const m = CH[k](); m.ask = 'O filho da vizinha tá começando no beach tennis. ' + m.text + ', pra ele ganhar confiança?'; return m; }), () => ({ type: 'visit1', place: 'sol', text: 'Levar o tricô da Dona Cida para a Praça do Sol', ask: 'Esqueci meu tricô no banco da Praça do Sol! Passa lá e dá uma olhada pra mim?' }),
    () => ({ type: 'deliver', target: { spot: 'acai' }, text: 'Comprar um açaí para a neta da Dona Cida', ask: 'Minha neta só fala em açaí. Passa no Açaí da Praia e pega um pra ela? Eu pago.' }),
    () => ({ type: 'deliver', target: { giver: 'jorge' }, text: 'Levar o bolo de fubá da Dona Cida para o Seu Jorge (quiosque de coco)', ask: 'Meu filho, fiz um bolo de fubá pro Jorge do quiosque, mas o joelho não ajuda. Leva pra mim?' }),
    () => ({ type: 'talk', need: 4, text: 'Conversar com 4 pessoas do bairro', ask: 'O bairro anda tão calado… Puxa conversa com o pessoal, vai. Quatro pessoas já me deixam feliz.' })],
  jorge: [...(['chFraco', 'chCurta']).map(k => () => { const m = CH[k](); m.ask = 'A molecada do quiosque duvida de você: ' + m.text.charAt(0).toLowerCase() + m.text.slice(1) + '.'; return m; }), () => ({ type: 'talk', need: 2, text: 'Recomendar o quiosque para 2 pessoas', ask: 'Fala bem do meu coco pro pessoal? Duas pessoas já ajudam.' }),
    () => ({ type: 'deliver', target: { giver: 'kai' }, text: 'Levar coco gelado para o Kai na praia', ask: 'O Kai tá lá na praia faz horas. Leva um coco pra ele não desmaiar?' }),
    () => ({ type: 'deliver', target: { spot: 'barraca' }, text: 'Levar 10 cocos para a Barraca do Zé (calçadão)', ask: 'O Zé ficou sem coco lá na barraca. Leva esse saco pra ele? Te pago bem.' }),
    () => ({ type: 'swim', need: 15, text: 'Nadar 15 segundos no mar', ask: 'Atleta de areia não sabe nadar, é o que dizem por aí. Prova o contrário: 15 segundos no mar!' })],
  leo: [...(['chSmash', 'chCurta', 'chVoleio', 'chLimpo']).map(k => () => { const m = CH[k](); m.ask = 'Hoje o treino é na praça. Te dou um desafio: ' + m.text.charAt(0).toLowerCase() + m.text.slice(1) + '.'; return m; }), () => ({ type: 'talk', need: 3, text: 'Convidar 3 crianças para a escolinha', ask: 'Tem muita criança na rua sem fazer nada. Convida três pra escolinha?' }),
    () => ({ type: 'praca', need: 1, text: 'Vencer um jogo em qualquer praça', ask: 'A molecada da escolinha quer te ver jogando na praça. Ganha um jogo lá que eu trago todo mundo pra assistir.' }),
    () => ({ type: 'pracaLvl', need: 1, minLv: 2, text: 'Vencer na praça com a galera Forte ou Fera', ask: 'Desafio de treinador: vence a galera forte de alguma praça. Nível Forte ou Fera, hein!' }),
    () => ({ type: 'train', need: 1, text: 'Fazer um treino (arena, CT ou sua quadra)', ask: 'Ninguém chega lá sem treino. Faz uma sessão hoje e me conta como foi.' })],
  bia: [...(['chForte', 'chSmash']).map(k => () => { const m = CH[k](); m.ask = 'Pra foto da campanha da loja: ' + m.text.charAt(0).toLowerCase() + m.text.slice(1) + '.'; return m; }), () => ({ type: 'train', need: 1, text: 'Testar a raquete nova da loja num treino', ask: 'Chegou um modelo novo. Testa num treino e me diz o que achou?' }),
    () => ({ type: 'praca', need: 1, text: 'Vencer na praça usando o grip novo da loja', ask: 'Quero uma foto sua ganhando na praça com o grip da loja. Marketing, né!' }),
    () => ({ type: 'deliver', target: { giver: 'leo' }, text: 'Levar a caixa de overgrips da Bia para o Professor Léo (Praça das Gaivotas)', ask: 'Chegou a encomenda de overgrips da escolinha do Léo. Leva pra ele na Praça das Gaivotas?' }),
    () => ({ type: 'visit', need: 3, text: 'Conhecer as três praças da cidade', ask: 'Tô montando um mapa das quadras públicas pra loja. Passa nas três praças e me diz como estão?' })],
  ze: [...(['chPneu', 'chSimples']).map(k => () => { const m = CH[k](); m.ask = 'Aposta comigo? ' + m.text + '. Se conseguir, o petisco é por minha conta.'; return m; }), () => ({ type: 'swim', need: 20, text: 'Buscar a boia que voou para o mar (nadar 20 s)', ask: 'O vento levou a boia da barraca pro mar! Nada lá e traz pra mim?' }),
    () => ({ type: 'visit1', place: 'gaivotas', text: 'Levar o cardápio da barraca para a Praça das Gaivotas', ask: 'Quero fixar meu cardápio na Praça das Gaivotas. Leva lá?' }),
    () => ({ type: 'deliver', target: { spot: 'restaurante' }, text: 'Levar o peixe fresco do Zé para o Restaurante Maré', ask: 'Pesquei demais hoje! Leva esse peixe pro Restaurante Maré antes que estrague?' }),
    () => ({ type: 'praca', need: 2, text: 'Vencer dois jogos em praças', ask: 'Apostei com o pessoal que você ganha dois jogos seguidos na praça. Não me deixa na mão!' })],
  kai: [...(['chAce', 'chSimples']).map(k => () => { const m = CH[k](); m.ask = 'Desafio da galera, irmão: ' + m.text.charAt(0).toLowerCase() + m.text.slice(1) + '.'; return m; }), () => ({ type: 'visit', need: 3, text: 'Dar um rolê pelas três praças', ask: 'Bora conhecer a cidade inteira? Passa nas três praças, cada uma tem uma vibe.' }),
    () => ({ type: 'deliver', target: { spot: 'coco' }, text: 'Buscar água de coco para a galera do surf (quiosque da praça)', ask: 'A galera do surf tá desidratada. Passa no quiosque de coco da praça pra gente?' }),
    () => ({ type: 'swim', need: 30, text: 'Nadar 30 segundos no mar', ask: 'Mar tá liso hoje, irmão! Cai na água comigo: 30 segundos e você entende a vibe.' }),
    () => ({ type: 'talk', need: 3, text: 'Conversar com 3 pessoas na praia ou na cidade', ask: 'Tô juntando gente pro luau. Chama três pessoas pra mim? É só puxar papo.' })],
};
// desafios de jogo (vencer na praça de um jeito específico): conferidos com as estatísticas da partida
const CH = {
  chSimples: n => ({ type: 'chSimples', need: 1, text: 'Vencer uma partida de simples numa praça' }),
  chFraco: () => ({ type: 'chFraco', need: 1, text: 'Vencer em dupla com um iniciante (OVR até 55) contra a galera Médio ou mais' }),
  chSmash: () => { const n = 3 + Math.floor(Math.random() * 3); return { type: 'chSmash', need: 1, n, text: 'Vencer na praça com ' + n + ' smashes vencedores' }; },
  chCurta: () => { const n = 2 + Math.floor(Math.random() * 2); return { type: 'chCurta', need: 1, n, text: 'Vencer na praça com ' + n + ' curtas vencedoras' }; },
  chAce: () => ({ type: 'chAce', need: 1, n: 2, text: 'Vencer na praça com 2 aces' }),
  chVoleio: () => ({ type: 'chVoleio', need: 1, n: 4, text: 'Vencer na praça com 4 voleios vencedores' }),
  chLimpo: () => ({ type: 'chLimpo', need: 1, n: 4, text: 'Vencer na praça com no máximo 4 erros não forçados' }),
  chPneu: () => ({ type: 'chPneu', need: 1, text: 'Vencer um set na praça sem perder nenhum game' }),
  chForte: () => ({ type: 'chForte', need: 1, text: 'Vencer a galera Forte ou Fera em simples' }),
};
// quanto mais adiante na história, mais difícil: mais caro, mais conversas/treinos, galera mais forte, menos smashes de graça, e no fim até com a dupla iniciante
function storyHard(n, m) {
  const k = STORY.indexOf(n), t = Math.max(0, k) / (STORY.length - 1), LVN = ['Iniciante', 'Médio', 'Forte', 'Fera'];
  if (m.type === 'pay') { m.cost = Math.round(m.cost * (1 + t * 2.5) / 500) * 500; m.text = m.text.replace(/\(\$[\d.]+\)/, '($' + m.cost.toLocaleString('pt-BR') + ')'); }
  if (m.type === 'talk' || m.type === 'train') { const add = Math.floor(t * (m.type === 'talk' ? 4 : 2)); if (add) { m.need += add; m.text = m.text.replace(/\d+/, String(m.need)); } }
  if (m.type === 'swim') { m.need = Math.round(m.need * (1 + t)); m.text = m.text.replace(/\d+ s\)/, m.need + ' s)'); }
  if (m.type === 'praca') { m.need += Math.floor(t * 2); m.minLv = t > .5 ? (t > .8 ? 2 : 1) : 0; m.text = m.text.replace(/\d+/, String(m.need)) + (m.minLv ? ' (galera ' + LVN[m.minLv] + ' ou mais forte)' : ''); }
  if (/^ch/.test(m.type)) { if (m.n && m.type !== 'chLimpo') { m.n += Math.floor(t * 4); m.text = m.text.replace(/\d+/, String(m.n)); } const lv = t > .66 ? 2 : t > .33 ? 1 : 0; if (lv > (m.minLv || 0)) { m.minLv = lv; m.text += ' (galera ' + LVN[lv] + ' ou mais forte)'; } }
  if (m.type === 'pracaLvl' && t > .75) { m.weak = true; m.text += ' — jogando com a dupla iniciante'; }
  return m;
}
function chOk(m, r) {
  if (!r.won) return false; const st = r.st || {}; if (m.minLv && (r.level || 0) < m.minLv) return false;
  switch (m.type) { case 'chSimples': return r.mode === 'simples'; case 'chFraco': return !!r.weak && (r.level || 0) >= 1; case 'chSmash': return (st.smash || 0) >= m.n; case 'chCurta': return (st.curta || 0) >= m.n;
    case 'chAce': return (st.saque || 0) >= m.n; case 'chVoleio': return (st.voleio || 0) >= m.n; case 'chLimpo': return (st.ue || 0) <= m.n; case 'chPneu': return (r.games || [0, 1])[1] === 0; case 'chForte': return r.mode === 'simples' && (r.level || 0) >= 2; }
  return false;
}
function missionReward() { const r = { money: 150 + Math.floor(Math.random() * 6) * 75, fama: Math.random() < .6 ? .5 + Math.floor(Math.random() * 3) * .5 : 0, pe: Math.random() < .4 ? 1 + Math.floor(Math.random() * 2) : 0 };
  if (Math.random() < .7) { const ks = Object.keys(MATS); r.mat = ks[Math.floor(Math.random() * ks.length)]; } return r; }
const rwTxt = r => [r.cosm ? COSM[r.cosm] : '', r.money ? '$' + r.money : '', r.fama ? '+' + String(r.fama).replace('.', ',') + ' de fama' : '', r.pe ? '+' + r.pe + ' de evolução' : '', r.mat ? MATS[r.mat][2] + ' ' + MATS[r.mat][0] : ''].filter(Boolean).join(' · ');
function missionDone(m) {
  const C = $s.CR, r = m.reward; C.money += r.money || 0; if (r.cosm) { C.cosm = C.cosm || {}; C.cosm[r.cosm] = true; LV.cosmChanged = true; } if (r.fama) crAddFama(r.fama); if (r.pe) C.pe = (C.pe || 0) + r.pe; if (r.mat) { C.mats = C.mats || {}; C.mats[r.mat] = (C.mats[r.mat] || 0) + 1; }
  C.missions = C.missions.filter(x => x !== m); C.missionsDone = (C.missionsDone || 0) + 1; saveCareer();
  if (m.story) { C.story = C.story || {}; C.story[m.story] = true; const N = STORY.find(q => q.id === m.story), G = GIVERS.find(q => q.id === N.giver), nx = storyOpen();
    storyScene(G, N.end, 'Capítulo concluído: ' + N.title, 'Recompensa: ' + rwTxt(r) + (nx.length ? '<br>Novos capítulos: ' + nx.map(q => '<b>' + q.title + '</b> (' + GIVERS.find(g => g.id === q.giver).name + ')').join(', ') : ''));
    if (LV.cosmChanged) { LV.cosmChanged = false; LV.built = ''; setTimeout(() => { const p0 = human.pos.clone(); build(); human.pos.copy(p0); }, 0); } }
  else LV.msg('✅ Missão cumprida: ' + m.text + '. Recompensa: ' + rwTxt(r) + '.');
  refreshMarkers(); setTimeout(() => hud(true), 0);
}
// algo aconteceu na cidade: avança as missões que dependem disso
function missionEvent(type, data) {
  const C = $s.CR; if (!C || !C.missions) return;
  for (const m of C.missions.slice()) {
    if (m.type === 'deliver' && type === 'deliver' && ((m.target.giver && m.target.giver === data.giver) || (m.target.spot && m.target.spot === data.spot))) { missionDone(m); continue; }
    if (m.type === 'praca' && type === 'praca' && (data.level || 0) < (m.minLv || 0)) { LV.msg('📋 Para a missão, precisa ser contra a galera mais forte.'); continue; }
    if (m.type === type && ['talk', 'praca', 'train'].includes(type)) { m.have = (m.have || 0) + 1; if (m.have >= m.need) missionDone(m); else LV.msg('📋 ' + m.text + ': ' + m.have + '/' + m.need); }
    if (m.type === 'pracaLvl' && type === 'praca' && (data.level || 0) >= m.minLv) { if (m.weak && !data.weak) LV.msg('📋 ' + m.text + ': tem que ser com a dupla iniciante.'); else missionDone(m); }
    if (m.type === 'swim' && type === 'swim') { m.have = (m.have || 0) + data.dt; if (m.have >= m.need) missionDone(m); }
    if (/^ch/.test(m.type) && type === 'match') { if (data.kind === 'praca' && chOk(m, data)) missionDone(m); else if (data.won) LV.msg('📋 Faltou para o desafio: ' + m.text + '.'); continue; }
    if (m.type === 'visit1' && type === 'visit' && data.id === m.place) { missionDone(m); continue; }
    if (m.type === 'visit' && type === 'visit') { m.seen = m.seen || []; if (!m.seen.includes(data.id)) { m.seen.push(data.id); if (m.seen.length >= m.need) missionDone(m); else LV.msg('📋 ' + m.text + ': ' + m.seen.length + '/' + m.need); } }
  }
}
function talkBox() { let el = document.getElementById('livreFriendly'); if (!el) { el = document.createElement('div'); el.id = 'livreFriendly'; el.className = 'overlay'; document.body.appendChild(el); } return el; }
// cena de capítulo da história (fala de quem deu a missão + recompensa)
function storyScene(G, line, title, sub) {
  const el = talkBox(); el.innerHTML = '<div class="card lv-fr lv-talk lv-story"><div class="eyebrow">★ ' + title + '</div><p class="lv-line">' + (G ? '<b>' + G.name + ':</b> ' : '') + '"' + line + '"</p>' + (sub ? '<p class="cr-note">' + sub + '</p>' : '') + '<div class="cta-row"><button type="button" class="cta" data-x>Continuar</button></div></div>';
  el.hidden = false; LV.modal = true; if (G) say(line, G.f ? 'f' : 'm', 3); el.querySelector('[data-x]').onclick = () => { el.hidden = true; LV.modal = false; hush(); };
}
function giverTalk(G) {
  const C = $s.CR; C.missions = C.missions || []; C.giverDay = C.giverDay || {};
  const el = talkBox(), close = () => { el.hidden = true; LV.modal = false; hush(); };
  const hi = pick(['Ô, ' + nameOf(C.me).split(' ')[0] + '! ', 'Olha quem apareceu! ', 'E aí, ' + (C.me.fem ? 'campeã' : 'campeão') + '! ', 'Bom te ver por aqui. ']);
  // 1) história: capítulo ativo deste morador (pagar, lembrar) ou capítulo novo liberado
  const act = C.missions.find(m => m.story && m.giver === G.id), novo = !act && storyOpen().find(n => n.giver === G.id && !C.missions.some(m => m.story === n.id));
  if (act || novo) {
    const N = STORY.find(q => q.id === (act ? act.story : novo.id));
    if (act && act.type === 'pay') {
      el.innerHTML = '<div class="card lv-fr lv-talk lv-story"><div class="eyebrow">★ ' + N.title + ' · ' + G.name + '</div><p class="lv-line">"' + hi + 'E aí, vai bancar a reforma? São $' + act.cost.toLocaleString('pt-BR') + '."</p><div class="cta-row"><button type="button" class="cta" data-pay' + (C.money < act.cost ? ' disabled' : '') + '>Pagar $' + act.cost.toLocaleString('pt-BR') + '</button><button type="button" class="ghost" data-x>Depois</button></div></div>';
      el.hidden = false; LV.modal = true; el.querySelector('[data-x]').onclick = close;
      el.querySelector('[data-pay]').onclick = () => { close(); C.money -= act.cost; missionDone(act); }; return;
    }
    if (act) { el.innerHTML = '<div class="card lv-fr lv-talk lv-story"><div class="eyebrow">★ ' + N.title + ' · ' + G.name + '</div><p class="lv-line">"' + hi + 'Lembra: ' + act.text.charAt(0).toLowerCase() + act.text.slice(1) + '."</p><div class="cta-row"><button type="button" class="ghost" data-x>Tá bom!</button></div></div>'; el.hidden = false; LV.modal = true; el.querySelector('[data-x]').onclick = close; return; }
    el.innerHTML = '<div class="card lv-fr lv-talk lv-story"><div class="eyebrow">★ História do bairro · ' + novo.title + '</div><p class="lv-line"><b>' + G.name + ':</b> "' + hi + novo.ask + '"</p><p class="cr-note">Missão: ' + novo.m.text + '<br>Recompensa: ' + rwTxt(novo.rw) + '</p><div class="cta-row"><button type="button" class="cta" data-ok>Aceitar</button><button type="button" class="ghost" data-x>Agora não</button></div></div>';
    el.hidden = false; LV.modal = true; say(hi + novo.ask, G.f ? 'f' : 'm', 3); el.querySelector('[data-x]').onclick = close;
    el.querySelector('[data-ok]').onclick = () => { close(); C.missions.unshift(storyHard(novo, Object.assign({}, novo.m, { story: novo.id, giver: G.id, have: 0, reward: novo.rw }))); saveCareer(); refreshMarkers(); LV.msg('★ Capítulo novo: ' + novo.title + ' (M abre a lista).'); }; return;
  }
  // 2) missões do dia (até 3 ao mesmo tempo)
  const side = C.missions.filter(m => !m.story), mine = side.find(m => m.giver === G.id), canGive = !mine && side.length < 3 && C.giverDay[G.id] !== dayKey();
  const tmpl = MS_TEMPL[G.id], offer = canGive ? Object.assign(tmpl[Math.floor(Math.random() * tmpl.length)](), { giver: G.id, have: 0, reward: missionReward() }) : null;
  const body = mine ? (mine.type === 'deliver' || mine.type === 'visit1' ? 'Ainda tá com aquilo? ' + mine.text + '.' : 'E aquela história? ' + mine.text + (mine.need ? ' (' + (mine.seen ? mine.seen.length : Math.floor(mine.have || 0)) + '/' + mine.need + ')' : '') + '.')
    : offer ? offer.ask : side.length >= 3 ? 'Você já tá cheio de coisa pra fazer. Termina as outras e volta aqui!' : pick(['Hoje tá tranquilo, volta amanhã que eu sempre preciso de uma mão.', 'Nada pra hoje, obrigado por perguntar!', 'Por hoje é só papo mesmo. Amanhã tem novidade.']);
  el.innerHTML = '<div class="card lv-fr lv-talk"><div class="eyebrow">' + G.name + ' · ' + G.role + '</div><p class="lv-line">"' + hi + body + '"</p>'
    + (offer ? '<p class="cr-note">Recompensa: ' + rwTxt(offer.reward) + '</p><div class="cta-row"><button type="button" class="cta" data-ok>Aceitar</button><button type="button" class="ghost" data-x>Agora não</button></div>' : '<div class="cta-row"><button type="button" class="ghost" data-x>Tchau!</button></div>') + '</div>';
  el.hidden = false; LV.modal = true; say(hi + body, G.f ? 'f' : 'm', 3);
  el.querySelector('[data-x]').onclick = close;
  const ok = el.querySelector('[data-ok]'); if (ok) ok.onclick = () => { close(); C.missions.push(offer); C.giverDay[G.id] = dayKey(); saveCareer(); refreshMarkers(); LV.msg('📋 Nova missão: ' + offer.text + ' (M abre a lista).'); };
}
// marcadores: "!" amarelo em quem tem missão para dar; coluna de luz amarela onde entregar
function refreshMarkers() {
  const C = $s.CR; if (!C || !LV.givers) return; C.missions = C.missions || [];
  const side = C.missions.filter(m => !m.story), open = storyOpen();
  LV.givers.forEach(G => { const st = open.some(n => n.giver === G.id && !C.missions.some(m => m.story === n.id)) || C.missions.some(m => m.story && m.giver === G.id && m.type === 'pay');
    const sd = !side.some(m => m.giver === G.id) && side.length < 3 && (C.giverDay || {})[G.id] !== dayKey();
    G.mk.visible = st || sd; G.mk.material.color.set(st ? '#ffd23f' : '#ffffff'); G.mk.scale.setScalar(st ? .75 : .5); });
  if (LV.mkBeams) LV.mkBeams.forEach(b => b.parent && b.parent.remove(b)); LV.mkBeams = [];
  C.missions.forEach(m => { if (m.type !== 'deliver') return; let x, z; if (m.target.giver) { const G = LV.givers.find(q => q.id === m.target.giver); if (!G) return; x = G.x; z = G.z; } else { const S3 = LV.spots.find(q => q.id === m.target.spot); if (!S3) return; x = S3.x; z = S3.z; }
    const bm = new THREE.Mesh(new THREE.CylinderGeometry(.6, .6, 30, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#b44dff', transparent: true, opacity: .28, depthWrite: false })); bm.position.set(x, 15, z); LV.group.add(bm); LV.mkBeams.push(bm);
    const st = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex(), depthTest: false, transparent: true })); st.scale.set(2.4, 2.4, 1); st.position.set(x, 4.6, z); st.renderOrder = 9; LV.group.add(st); LV.mkBeams.push(st); });
}
const _bagV = new THREE.Vector3(), _bagP = new THREE.Vector3(), _bagS = new THREE.Vector3(), _bagQ = new THREE.Quaternion();
let STAR_T = null; // estrela roxa: onde entregar
function starTex() {
  if (STAR_T) return STAR_T; const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 26 : 58; x.lineTo(64 + Math.cos(a) * r, 68 + Math.sin(a) * r); } x.closePath();
  x.fillStyle = '#b44dff'; x.fill(); x.lineWidth = 7; x.strokeStyle = '#fff'; x.stroke();
  STAR_T = new THREE.CanvasTexture(c); STAR_T.colorSpace = THREE.SRGBColorSpace; return STAR_T;
}
// o que fazer, passo a passo, para cada tipo de missão (botão ⓘ na lista)
function howTo(m) {
  const LVN = ['Iniciante', 'Médio', 'Forte', 'Fera'], spotName = id => { const q = LV.spots.find(s2 => s2.id === id); return q ? q.title : id; }, gName = id => { const G = GIVERS.find(q => q.id === id); return G ? G.name : id; };
  const plName = id => { const q = (LV.plazas || []).find(p2 => p2.id === id); return q ? q.name : id; }, lv = m.minLv ? ' A galera da quadra tem que ser nível ' + LVN[m.minLv] + ' ou mais forte (o nível aparece na placa da quadra).' : '';
  const praca = 'Vá até uma praça com quadra (círculos verdes no mapa), chegue no círculo azul da quadra e aperte E para jogar com a galera. ';
  switch (m.type) {
    case 'talk': return 'Converse com pessoas andando pela rua: chegue perto de alguém e aperte E, escolha uma resposta e se despeça. Cada pessoa nova conta uma vez.';
    case 'deliver': return 'Vá até ' + (m.target.giver ? gName(m.target.giver) : spotName(m.target.spot)) + ' (estrela roxa no mapa e no mundo). Chegar no círculo do lugar' + (m.target.giver ? ' e falar com a pessoa (E)' : '') + ' já conclui.';
    case 'visit1': return 'Ande até ' + plName(m.place) + ' (ponto pulsando no mapa). Basta entrar na área da praça.';
    case 'visit': return 'Passe por dentro das praças, parques e arenas que ainda não visitou (pontos pulsando no mapa).';
    case 'pay': return 'Volte a falar com ' + gName(m.giver) + ' (E) e escolha pagar. Precisa ter $' + (m.cost || 0).toLocaleString('pt-BR') + ' em caixa.';
    case 'train': return 'Faça um treino no mundo aberto: na academia de casa, na sua quadra, no CT ou na arena (chegue no círculo "Treinar" e aperte E). Cada treino conta 1. Treinos feitos pelo menu da carreira não contam.';
    case 'swim': return 'Entre no mar (praia ao norte do bairro) e nade: o tempo dentro da água vai somando até ' + m.need + ' s.';
    case 'praca': return praca + 'Cada vitória conta 1.' + lv;
    case 'pracaLvl': return praca + 'Escolha uma quadra com galera ' + LVN[m.minLv] + ' ou mais forte e vença.' + (m.weak ? ' Tem que jogar com a opção "Dupla com o iniciante".' : '');
    case 'chSimples': return praca + 'Escolha "Jogar simples" e vença.' + lv;
    case 'chFraco': return praca + 'Escolha "Dupla com o iniciante" numa quadra nível Médio ou mais forte e vença.' + lv;
    case 'chSmash': return praca + 'Vença a partida fazendo pelo menos ' + m.n + ' smashes vencedores.' + lv;
    case 'chCurta': return praca + 'Vença fazendo pelo menos ' + m.n + ' pontos de curta.' + lv;
    case 'chAce': return praca + 'Vença fazendo pelo menos ' + m.n + ' pontos de saque.' + lv;
    case 'chVoleio': return praca + 'Vença fazendo pelo menos ' + m.n + ' pontos de voleio.' + lv;
    case 'chLimpo': return praca + 'Vença com no máximo ' + m.n + ' erros não forçados.' + lv;
    case 'chPneu': return praca + 'Vença sem perder nenhum game (6 a 0).' + lv;
    case 'chForte': return praca + 'Escolha "Jogar simples" numa quadra nível Forte ou Fera e vença.';
  }
  return 'Fale com quem deu a missão para mais detalhes.';
}
// lista das missões (tecla M ou o botão 📋)
function missionsPanel() {
  const C = $s.CR, L = C.missions || [], doneN = STORY.filter(n => storyDone(n.id)).length, open = storyOpen();
  const row = m => { const G = GIVERS.find(q => q.id === m.giver); return '<div class="lv-look' + (m.story ? ' st' : '') + '"><div><b>' + (m.story ? '★ ' + STORY.find(n => n.id === m.story).title + ': ' : '') + m.text + '</b><br><small>' + (G ? G.name : '') + (m.need ? ' · ' + (m.seen ? m.seen.length : Math.floor(m.have || 0)) + '/' + m.need : '') + ' · ' + rwTxt(m.reward) + '</small><div class="lv-how" hidden>' + esc2(howTo(m)) + '</div></div><button type="button" class="ghost lv-info" title="Como completar" data-how>ⓘ</button></div>'; };
  const ownC = Object.keys(C.cosm || {});
  const el = talkBox();
  el.innerHTML = '<div class="card lv-fr lv-mis"><div class="eyebrow">História do bairro · ' + doneN + '/' + STORY.length + ' capítulos · ' + (C.missionsDone || 0) + ' missões cumpridas</div><h3>Missões</h3>'
    + '<p class="section-label">★ História</p>' + (L.filter(m => m.story).map(row).join('') || '') + (open.filter(n => !L.some(m => m.story === n.id)).map(n => '<div class="lv-look st"><div><b>★ ' + n.title + '</b><br><small>Fale com ' + GIVERS.find(g => g.id === n.giver).name + ' (estrela amarela)</small></div></div>').join('')) + (doneN === STORY.length ? '<p class="cr-note">Você é a Lenda do Bairro. 🗿</p>' : '')
    + '<p class="section-label">📋 Do dia</p>' + (L.filter(m => !m.story).map(row).join('') || '<p class="cr-note">Quem tem um "!" branco em cima tem pedido pra você: Dona Cida e Seu Jorge na praça da orla, o Professor Léo na Praça das Gaivotas, a Bia na Pro Shop, o Zé na barraca e o Kai na praia.</p>')
    + '<p class="section-label">🎁 Conquistas</p><p class="cr-note">' + (ownC.length ? ownC.map(k => COSM[k]).join('<br>') : 'Nenhuma ainda: a história do bairro dá recompensas especiais.') + '</p>'
    + (C.cosm && C.cosm.bagOuro ? '<label class="cr-note"><input type="checkbox" data-gold' + (C.bagGold !== false ? ' checked' : '') + '> Usar a raqueteira dourada</label>' : '')
    + '<p class="cr-note">Materiais: ' + matsHTML() + ' (venda na Pro Shop ou doe no projeto social).</p><div class="cta-row"><button type="button" class="ghost" data-x>Fechar</button></div></div>';
  el.hidden = false; LV.modal = true; el.querySelector('[data-x]').onclick = () => { el.hidden = true; LV.modal = false; };
  el.querySelectorAll('[data-how]').forEach(b => b.onclick = () => { const h = b.parentElement.querySelector('.lv-how'); h.hidden = !h.hidden; b.classList.toggle('on', !h.hidden); });
  const gc = el.querySelector('[data-gold]'); if (gc) gc.onchange = () => { C.bagGold = gc.checked; saveCareer(); };
}

// ---------- conversas com quem passa: personalidades diferentes e falas que dependem da sua carreira ----------
const PERSONAS = ['fa', 'tio', 'crianca', 'turista', 'amador', 'critico', 'vizinha', 'surfista', 'vendedor', 'blogueiro', 'idosa', 'mae'];
const PNAMES = { m: ['Carlinhos', 'Marcão', 'Juninho', 'Rafael', 'Seu Antônio', 'Thiago', 'Pedro', 'Diego', 'Lucas', 'Bruno', 'Gabriel', 'Fábio'], f: ['Ana', 'Dona Lurdes', 'Júlia', 'Camila', 'Fernanda', 'Bruna', 'Letícia', 'Carla', 'Paula', 'Marina', 'Sofia', 'Rita'] };
const P_ROLE_F = { fa: 'fã do circuito', tio: 'frequentador da praia', crianca: 'aluna da escolinha', turista: 'turista', amador: 'jogadora amadora', critico: 'torcedora exigente', vizinha: 'vizinha', surfista: 'surfista', vendedor: 'vendedora ambulante', blogueiro: 'blogueira de beach tennis', idosa: 'aposentada', mae: 'mãe de aluno' };
const P_ROLE = { fa: 'fã do circuito', tio: 'frequentador da praia', crianca: 'aluno da escolinha', turista: 'turista', amador: 'jogador amador', critico: 'torcedor exigente', vizinha: 'vizinha', surfista: 'surfista', vendedor: 'vendedor ambulante', blogueiro: 'blogueiro de beach tennis', idosa: 'aposentada', mae: 'mãe de aluno' };
function talkCtx() {
  const C = $s.CR, h = (C.history || [])[0], t = C.tour, p = C.partner ? crChar(C.partner) : null;
  return { me: nameOf(C.me).split(' ')[0], rank: crRankLocal(), ult: h ? String(h.name).replace(/ · .*$/, '') : '', pos: h ? h.place : '', won: h && /campe/i.test(h.place || ''), prox: t && t.pending ? String(t.name).replace(/ · .*$/, '') : '', em: t && !t.pending && !t.done ? String(t.name).replace(/ · .*$/, '') : '',
    dupla: p ? nameOf(p).split(' ')[0] : '', fama: C.fama || 0, titles: Object.values(C.titles || {}).reduce((a, b) => a + b, 0), pet: (C.pets || {}).cachorro || (C.pets || {}).gato || '', cansado: (C.energy || 0) < 35, rico: (C.money || 0) > 200000 };
}
function crRankLocal() { try { return (window.__pdoCR && window.__pdoCR.ranking ? window.__pdoCR.ranking().findIndex(x => x.id === 'crme') + 1 : 0) || 0; } catch (e) { return 0; } }
// cada fala: [texto, opções]; opção: [rótulo, resposta, efeito]
function talkLine(per, X) {
  const pk = a => a[Math.floor(Math.random() * a.length)], L = [];
  const add = (cond, txt, opts) => { if (cond) L.push([txt, opts]); };
  const foto = ['Claro, bora!', 'Valeu demais! Vou postar agora.', { fama: .15 }], depois = ['Agora não dá, foi mal', 'Tranquilo, fica pra próxima!', {}];
  if (per === 'fa') {
    add(X.won, 'Ei, ' + X.me + '! Vi você ser ' + (X.fem ? 'campeã' : 'campeão') + ' no ' + X.ult + '! Que final foi aquela! Tira uma foto comigo?', [foto, depois]);
    add(X.ult && !X.won, 'Acompanhei o ' + X.ult + '. ' + X.pos + ' ainda é muito bom, viu? Próxima é sua!', [['Valeu pela força!', 'Tô torcendo sempre!', { fama: .1 }], ['Doeu, mas faz parte', 'Cabeça erguida!', {}]]);
    add(X.prox, 'Vai jogar o ' + X.prox + ' no sábado? Já comprei ingresso!', [['Vou sim, aparece lá!', 'Vou levar faixa com seu nome!', { fama: .1 }], ['Tô me preparando', 'Arrebenta!', {}]]);
    add(X.rank && X.rank <= 20, 'Top ' + X.rank + ' do mundo andando no meu bairro… isso é real?', [foto, ['Sou gente como a gente', 'Haha, humilde ainda!', { fama: .05 }]]);
    add(true, 'Não acredito, é ' + X.me + '! Autografa minha viseira?', [['Com prazer!', 'Vou guardar pra sempre!', { fama: .1 }], depois]);
  } else if (per === 'tio') {
    add(X.cansado, 'Tá com uma cara de cansado, hein. Descansa, que corpo de atleta também quebra.', [['Verdade, vou pegar leve', 'Isso! Quem descansa joga mais.', {}], ['Cansado nada!', 'Juventude… daqui a uns anos você me conta.', {}]]);
    add(X.dupla, 'E o ' + X.dupla + '? Esse aí é bom de rede, hein. Segura ele!', [['É o melhor parceiro', 'Dupla boa vale mais que raquete cara.', {}], ['Tá jogando muito mesmo', 'Tô vendo tudo pela TV!', {}]]);
    add(true, 'No meu tempo a bola era mais pesada e a areia mais quente. Hoje é moleza!', [['Conta como era', 'A gente jogava de chinelo, acredita?', {}], ['Haha, imagino', 'Pode rir, mas era raiz!', {}]]);
    add(true, 'Joguei beach tennis uma vez. Uma! Nunca mais achei a bola.', [['Bora jogar na praça?', 'Só se você não mandar smash em mim!', {}], ['Acontece com todo mundo', 'Comigo aconteceu com estilo.', {}]]);
  } else if (per === 'crianca') {
    add(X.titles > 0, 'Você tem ' + X.titles + ' troféus?! Eu só tenho uma medalha de natação…', [['Medalha conta muito!', 'Sério? Vou mostrar pro meu pai!', { fama: .05 }], ['Treina que vem!', 'Vou treinar todo dia!', {}]]);
    add(true, 'Como faz aquele smash que a bola some?', [['Salta e bate lá no alto', 'Vou tentar pular mais alto!', {}], ['Treino, muito treino', 'Ah… achei que era mágica.', {}]]);
    add(true, 'Me ensina a sacar? Sempre vai na rede!', [['Joga a bola mais pra frente', 'Ahhh, por isso! Valeu!', { fama: .05 }], ['Vem na escolinha!', 'Eba! Vou pedir pra minha mãe!', { fama: .05 }]]);
  } else if (per === 'turista') {
    add(true, 'Com licença… onde é a praia boa pra foto?', [['No calçadão, perto do salva-vidas', 'Muito obrigado, vou lá!', {}], ['Na Praça Iemanjá tem vista linda', 'Anotado!', {}]]);
    add(true, 'Disseram que aqui mora um atleta famoso. Você conhece?', [['Sou eu mesmo!', 'Sério?! Foto, por favor!', { fama: .1 }], ['Nunca ouvi falar', 'Hmm… você parece com ele.', {}]]);
  } else if (per === 'amador') {
    add(true, 'Tô travando no backhand alto. Alguma dica?', [['Pega a bola mais na frente do corpo', 'Faz sentido! Vou tentar hoje.', {}], ['Usa mais o ombro', 'Vou treinar isso, valeu!', {}]]);
    add(true, 'Joguei na praça ontem e tomei pneu. Como melhora?', [['Começa com a galera iniciante', 'Boa, um degrau por vez!', {}], ['Joga comigo um dia', 'Sério? Seria uma honra!', { fama: .05 }]]);
    add(X.prox, 'Vai no ' + X.prox + '? Eu vou na chave amadora do mesmo evento!', [['Boa sorte!', 'Pra você também!', {}], ['Vou te assistir', 'Aí eu morro de nervoso, haha.', {}]]);
  } else if (per === 'critico') {
    add(X.ult && !X.won, X.pos + ' no ' + X.ult + '? Esperava mais, hein. Tá devendo!', [['Vou dar a volta por cima', 'Quero ver!', {}], ['Respeito sua opinião', 'Hmm… educado, pelo menos.', {}]]);
    add(X.won, 'Ganhou o ' + X.ult + ', tá. Agora quero ver ganhar dois seguidos.', [['Pode cobrar', 'Vou cobrar mesmo!', { fama: .05 }], ['Um de cada vez', 'Conversa de atleta…', {}]]);
    add(true, 'Esse smash cruzado tá muito previsível.', [['Vou variar mais', 'Assim que se fala.', {}], ['Mas tá entrando', 'Por enquanto…', {}]]);
    add(true, 'Tá jogando muito no fundo. Beach tennis se ganha na rede!', [['Vou subir mais', 'É isso! Rede!', {}], ['Depende do adversário', 'Desculpa de quem não sobe.', {}]]);
  } else if (per === 'vizinha') {
    add(X.pet, X.pet + ' passou aqui hoje de manhã todo feliz. Que bichinho educado!', [['Adora o bairro', 'Dá pra ver!', {}], ['Espero que não tenha aprontado', 'Que nada, um anjo!', {}]]);
    add(X.rico, 'Vi a reforma da sua casa… tá podendo, hein!', [['Fruto de muito treino', 'Merecido!', {}], ['Vem tomar um café lá', 'Vou sim, levo bolo!', {}]]);
    add(true, 'Vai ter festa junina na praça, viu? Aparece!', [['Vou aparecer!', 'Oba! Tem quentão!', {}], ['Se não tiver torneio…', 'Atleta não tem folga, né?', {}]]);
    add(true, 'Esse calor tá impossível. Tá se hidratando?', [['Sempre, garrafa na mão', 'Muito bem!', {}], ['Aceito uma água', 'Toma, geladinha!', { energy: 1 }]]);
  } else if (per === 'surfista') {
    add(true, 'Mar tá liso hoje, irmão. Bom pra nadar!', [['Vou cair na água', 'Boa! Água fria renova.', { energy: 1 }], ['Prefiro areia', 'Cada um com sua onda.', {}]]);
    add(true, 'Beach tennis e surf: os dois na areia, os dois na vibe.', [['E os dois exigem equilíbrio', 'Falou tudo, irmão!', {}], ['Mas o meu tem rede', 'Haha, e o meu tem tubarão.', {}]]);
    add(true, 'O vento virou. Vai atrapalhar teu lob hoje, hein.', [['Valeu, vou baixar a bola', 'Isso aí, lê o vento!', {}], ['Uso o vento a favor', 'Pensamento de surfista!', {}]]);
  } else if (per === 'vendedor') {
    add(true, 'Olha o picolé! Pra atleta faço desconto!', [['Me vê um de coco ($5)', 'Saindo! Bom proveito!', { money: -5, energy: 1 }], ['Hoje não, valeu', 'Tranquilo, tô por aqui!', {}]]);
    add(true, 'Queijo coalho na brasa, campeão?', [['Manda um ($8)', 'Com orégano, do jeito certo!', { money: -8, energy: 1 }], ['Depois do treino', 'Guardo um pra você!', {}]]);
  } else if (per === 'blogueiro') {
    add(true, 'Posso fazer uma pergunta rápida pro meu canal? Qual o segredo da sua evolução?', [['Treino e cabeça', 'Perfeito, vai bombar!', { fama: .2 }], ['Hoje não, foi mal', 'Sem problema, outra hora!', {}]]);
    add(X.prox, 'Tô fazendo a prévia do ' + X.prox + '. Quem é o favorito?', [['Respeito todos, mas vim pra ganhar', 'Isso é manchete!', { fama: .15 }], ['Prefiro não palpitar', 'Diplomático, gostei.', {}]]);
  } else if (per === 'idosa') {
    add(true, 'Ando aqui todo dia às sete. Você devia vir, faz bem pro joelho.', [['Vou seguir o conselho', 'Isso, criança esperta!', {}], ['De manhã eu treino', 'Então já faz o seu, né.', {}]]);
    add(true, 'Meu marido assistia todos os seus jogos. Ele ia adorar te conhecer.', [['Que bonito, obrigado', 'Ele tá vendo lá de cima, viu?', {}], ['Manda um abraço pra ele', 'Pode deixar, meu bem.', {}]]);
  } else {
    add(true, 'Meu filho treina na escolinha. Ele te imita até no jeito de andar!', [['Que honra!', 'Ele vai pirar quando eu contar!', { fama: .1 }], ['Manda um abraço pra ele', 'Pode deixar!', {}]]);
    add(true, 'Vocês atletas são exemplo pra molecada. Obrigada!', [['A gente tenta', 'E consegue!', {}], ['Exemplo é a senhora', 'Ai, que gentil!', {}]]);
  }
  return L.length ? L[Math.floor(Math.random() * L.length)] : ['Bom dia!', [['Bom dia!', 'Até mais!', {}]]];
}
function npcTalk(n) {
  const C = $s.CR, X = talkCtx(); X.fem = !!C.me.fem;
  if (!n.per) { n.per = PERSONAS[Math.floor(Math.random() * PERSONAS.length)]; n.g = { idosa: 'f', vizinha: 'f', mae: 'f', tio: 'm' }[n.per] || (Math.random() < .5 ? 'f' : 'm');
    const nm = n.per === 'crianca' ? { m: ['Joãozinho', 'Pedrinho', 'Davi', 'Enzo', 'Miguel'], f: ['Laurinha', 'Alice', 'Helena', 'Manu', 'Bia'] } : n.per === 'idosa' ? { f: ['Dona Lurdes', 'Dona Zezé', 'Dona Neide', 'Dona Teresa'] } : n.per === 'tio' ? { m: ['Seu Antônio', 'Seu Valdir', 'Tio Beto', 'Seu Osmar'] } : PNAMES;
    n.name = nm[n.g][Math.floor(Math.random() * nm[n.g].length)]; if (n.per === 'crianca') n.o.scale.setScalar(.66); }
  const [txt, opts] = talkLine(n.per, X); n.pause = true;
  let el = document.getElementById('livreFriendly'); if (!el) { el = document.createElement('div'); el.id = 'livreFriendly'; el.className = 'overlay'; document.body.appendChild(el); }
  el.innerHTML = '<div class="card lv-fr lv-talk"><div class="eyebrow">' + n.name + ' · ' + (n.g === 'f' ? P_ROLE_F[n.per] : P_ROLE[n.per]) + '</div><p class="lv-line">"' + esc2(txt) + '"</p><div class="lv-opts">' + opts.map((o, i) => '<button type="button" class="ghost" data-o="' + i + '">' + o[0] + '</button>').join('') + '</div></div>';
  el.hidden = false; LV.modal = true; say(txt, n.g, 2);
  const close = () => { el.hidden = true; LV.modal = false; n.pause = false; hush(); };
  el.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { const o = opts[+b.dataset.o], ef = o[2] || {};
    C.talkDay = C.talkDay === dayKey() ? C.talkDay : dayKey(); if (C.talkDayKey !== dayKey()) { C.talkDayKey = dayKey(); C.talkFame = 0; }
    if (ef.fama && (C.talkFame || 0) < 2) { crAddFama(ef.fama); C.talkFame = (C.talkFame || 0) + ef.fama; }
    if (ef.money) C.money += ef.money; if (ef.energy) C.energy = Math.min(100, C.energy + ef.energy);
    const first = !n.talked; n.talked = true;
    el.querySelector('.lv-opts').outerHTML = '<p class="lv-reply">' + n.name + ': "' + esc2(o[1]) + '"</p><div class="cta-row"><button type="button" class="ghost" data-x>Tchau!</button></div>';
    say(o[1], n.g, 2); el.querySelector('[data-x]').onclick = () => { close(); if (first) missionEvent('talk', {}); }; saveCareer(); }); // (a missão conta ao se despedir)
}
// ---------- cidade ainda maior: o que tem entre as praças, a quarta rua e mais duas praças (cada praça com cara própria) ----------
function aptBlock(g, x, z, w, d, h, col) { // prédio baixo com janelas e varandas
  box(g, w, h, d, x, h / 2, z, col); solid(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
  const fl = Math.floor(h / 3); for (let f = 0; f < fl; f++) for (let i = 0; i < Math.floor(w / 2.4); i++) { const wx = x - w / 2 + 1.4 + i * 2.4; box(g, 1.2, 1.1, .06, wx, 1.6 + f * 3, z - d / 2 - .03, '#9fd3ea', { metalness: .3, roughness: .2 }); box(g, 1.5, .1, .5, wx, 1, z - d / 2 - .25 + 0 * f, '#e9e9e9'); }
  box(g, w + .3, .3, d + .3, x, h + .15, z, '#cfcac0');
}
function stall(g, x, z, col, nm, R) { // barraca de feira com toldo, mercadoria e feirante
  box(g, 2.4, .9, 1.2, x, .45, z, '#8a6a45'); const aw = new THREE.Mesh(new THREE.BoxGeometry(2.8, .08, 1.8), mat(col)); aw.position.set(x, 2.3, z); aw.rotation.x = -.15; aw.castShadow = true; g.add(aw);
  [-1, 1].forEach(s2 => cyl(g, .04, .04, 2.3, x + s2 * 1.3, 1.15, z + .7, '#cfd3d8'));
  for (let i = 0; i < 5; i++) { const fr = new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 6), mat(['#e63946', '#ffd23f', '#7fb069', '#ff8c00', '#6b2fb8'][(i + Math.floor(R() * 5)) % 5])); fr.position.set(x - .8 + i * .4, .98, z - .1); g.add(fr); }
  banner(g, nm, x, 2.6, z + .92, 2.4, .35, col, '#ffffff'); fan(g, x, z - 1, 0, 900 + Math.floor(R() * 50), false); solid(x - 1.3, z - .7, x + 1.3, z + .7);
}
function cityExtras(g, sp) {
  const R = mulberry(($s.CR.seed || 3) * 17 + 21), road = (w, d, x, z) => box(g, w, .06, d, x, .03, z, '#3a3f47', { noShadow: true }), walk = (w, d, x, z) => box(g, w, .14, d, x, .07, z, '#cfcac0', { noShadow: true });
  // ---- entre a Praça do Sol e a das Gaivotas: escola, banca de jornal e ponto de ônibus ----
  { const ex = 58, ez = 160; box(g, 24, 6, 16, ex, 3, ez + 4, '#f2e6c9'); solid(ex - 12, ez - 4, ex + 12, ez + 12); box(g, 24.4, .4, 16.4, ex, 6.2, ez + 4, '#c0392b');
    for (let i = 0; i < 6; i++) box(g, 2, 1.4, .06, ex - 10 + i * 4, 3.6, ez - 4.03, '#9fd3ea', { metalness: .3 });
    if (($s.CR.cosm || {}).grafite) banner(g, nameOf($s.CR.me).split(' ')[0], ex + 12.03, 3, ez + 4, 14, 4.5, '#6b2fb8', '#b6ff3c', Math.PI / 2, 'beach tennis é pra todo mundo'); box(g, 3, 2.4, .1, ex, 1.2, ez - 4.05, '#5a3a28');
    banner(g, 'Escola Municipal', ex, 5.2, ez - 4.1, 9, 1, '#1f4fb8', '#ffffff', Math.PI, 'Prof.ª Maria do Carmo');
    box(g, 20, .06, 6, ex, .04, ez - 8, '#d98c4a', { noShadow: true }); // pátio
    for (let i = 0; i < 6; i++) { const c = dyn2(sp, fan(new THREE.Group(), ex - 8 + i * 3, ez - 8, R() * 6, 920 + i, false)); c.scale.setScalar(.62); LV.npcs.push({ kind: 'walk', o: c, x: ex - 8 + i * 3, z: ez - 8 + (i % 2), v: (i % 2 ? .7 : -.7), x0: ex - 10, x1: ex + 10 }); }
    // banca de jornal e ponto de ônibus na calçada da terceira rua
    box(g, 2.6, 2.4, 2, 78, 1.2, 134, '#2a9d8f'); box(g, 3, .12, 2.4, 78, 2.5, 134, '#1d6b62'); banner(g, 'Banca', 78, 2.1, 132.97, 2, .4, '#ffd23f', '#111214', Math.PI); solid(76.7, 133, 79.3, 135);
    box(g, 4, .1, 1.4, 40, 2.4, 131.6, '#cfd3d8'); [-1, 1].forEach(s2 => cyl(g, .05, .05, 2.4, 40 + s2 * 1.8, 1.2, 132.2, '#9aa0a8')); box(g, 3.6, .08, .5, 40, .5, 132, '#8a6a45'); banner(g, 'Ponto de ônibus', 40, 2.75, 131.5, 2.6, .35, '#1f4fb8', '#ffffff');
    for (let i = 0; i < 2; i++) fan(g, 39 + i * 1.4, 132, Math.PI, 960 + i, true).position.y = -.05; }
  // ---- entre as Gaivotas e a Iemanjá: feira livre com barracas e gente ----
  { const fx = 182, fz = 160; box(g, 54, .06, 26, fx, .04, fz, '#bfb6a5', { noShadow: true });
    const ST = [['#e63946', 'Frutas'], ['#ffd23f', 'Pastel'], ['#2a9d8f', 'Verduras'], ['#ff6a00', 'Caldo de cana'], ['#6b2fb8', 'Artesanato'], ['#1f4fb8', 'Peixe fresco'], ['#7fb069', 'Flores'], ['#c0392b', 'Queijos']];
    ST.forEach(([c, n], i) => stall(g, fx - 21 + (i % 4) * 14, fz + (i < 4 ? -6 : 6), c, n, R));
    for (let i = 0; i < 12; i++) { const o = dyn2(sp, fan(new THREE.Group(), fx - 24 + R() * 48, fz - 1 + R() * 2, 0, 980 + i, false)); LV.npcs.push({ kind: 'walk', o, x: o.position.x, z: o.position.z, v: (i % 2 ? 1 : -1) * (.4 + R() * .4), x0: fx - 26, x1: fx + 26 }); }
    spot(sp, 'feira', fx, fz + 1, 'Feira livre', 'Pastel e caldo de cana (+3 energia)'); }
  // ---- quarta rua (z 192) e as ruas que sobem até ela ----
  road(340, 8, 115, 192); walk(340, 2.4, 115, 187.2); walk(340, 2.4, 115, 196.8); for (let i = -50; i < 285; i += 5) box(g, 2.2, .02, .18, i, .07, 192, '#f2f2f2', { noShadow: true });
  [-55, 88, 290].forEach(x => { road(8, 60, x, 158); walk(2.4, 60, x - 5.2, 158); walk(2.4, 60, x + 5.2, 158); });
  for (let x = -40; x <= 280; x += 16) { if (Math.abs(x + 55) < 8 || Math.abs(x - 88) < 8) continue; streetLamp(g, x, 185.8); }
  for (let i = 0; i < 10; i++) { const z = i % 2 ? 187.2 : 196.8, x0 = -50 + R() * 320, o = dyn2(sp, fan(new THREE.Group(), x0, z, 0, 1000 + i, false)); LV.npcs.push({ kind: 'walk', o, x: x0, z, v: (i % 2 ? 1 : -1) * (.9 + R() * .5), x0: -55, x1: 285 }); }
  for (let k = 0; k < 3; k++) { const tmp = new THREE.Group(), east = k % 2 === 0; car(tmp, 0, 0, 0, ['#2457c5', '#ffd23f', '#e63946'][k]); LV.boxes.pop(); const o = dyn2(sp, tmp); o.position.set(-60 + k * 120, 0, east ? 190.6 : 193.4); o.rotation.y = east ? 0 : Math.PI; LV.npcs.push({ kind: 'car', o, v: east ? 8 : -8 }); }
  // ---- além da quarta rua: prédios, a Praça da Matriz (igreja, coreto) e a Praça das Palmeiras (complexo de quadras) ----
  aptBlock(g, -38, 214, 20, 12, 12, '#e3d5c1'); aptBlock(g, 120, 214, 18, 12, 15, '#cfe3e8'); aptBlock(g, 262, 214, 22, 12, 9, '#f2c6b4');
  { const mx = 40, mz = 228; box(g, 50, .08, 40, mx, .05, mz, '#7fb069', { noShadow: true }); box(g, 3, .1, 40, mx, .06, mz, '#d8cdb5', { noShadow: true });
    box(g, 14, 8, 18, mx, 4, mz + 12, '#f6f3ee'); solid(mx - 7, mz + 3, mx + 7, mz + 21); const rf = new THREE.Mesh(new THREE.CylinderGeometry(.01, 10, 4, 4), mat('#8a3b2e')); rf.rotation.y = Math.PI / 4; rf.scale.set(.75, 1, 1.3); rf.position.set(mx, 10, mz + 12); g.add(rf);
    box(g, 4, 16, 4, mx, 8, mz + 3, '#f6f3ee'); box(g, .3, 2.2, .3, mx, 17.1, mz + 3, '#c9a227'); box(g, 1.4, .3, .3, mx, 17.5, mz + 3, '#c9a227'); box(g, 2.4, 3.6, .1, mx, 1.8, mz + .97, '#5a3a28'); // torre, cruz e porta
    banner(g, 'Igreja Matriz', mx, 6, mz + .9, 6, .8, '#1d2a4a', '#e8b923', Math.PI);
    const cz = mz - 8; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; cyl(g, .1, .1, 3, mx + 15 + Math.cos(a) * 3, 1.5, cz + Math.sin(a) * 3, '#f4f4f4'); } cyl(g, 3.3, 3.3, .4, mx + 15, .2, cz, '#d8d2c6'); const ct = new THREE.Mesh(new THREE.ConeGeometry(4, 2, 8), mat('#2a9d8f')); ct.position.set(mx + 15, 4, cz); g.add(ct); // coreto
    for (let i = 0; i < 3; i++) fan(g, mx + 14 + i, cz, Math.PI, 1020 + i, false).position.y = .4; // banda no coreto
    for (let t = 0; t < 6; t++) { const tx = mx - 20 + (t % 3) * 6, tz = mz - 12 + Math.floor(t / 3) * 12; cyl(g, .18, .25, 2.6, tx, 1.3, tz, '#7a5a42'); const c = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), mat('#3f8f4a')); c.position.set(tx, 3.2, tz); g.add(c); solid(tx - .3, tz - .3, tx + .3, tz + .3); }
    [[-8, -2], [-8, 6], [8, -2]].forEach(([a, b]) => bench(g, mx + a, mz + b));
    LV.plazas.push({ id: 'matriz', name: 'Praça da Matriz', x: mx, z: mz, w: 50, d: 40 });
    spot(sp, 'coreto', mx + 15, cz - 4.2, 'Coreto', 'Ouvir a banda (+2 energia)'); }
  { const px = 190, pz = 230, pl = PLAZAS.find(q => q.id === 'palmeiras'); box(g, 60, .08, 40, px, .05, pz, '#7fb069', { noShadow: true });
    [-14, 14].forEach((dx, i) => { const cx = px + dx; box(g, 14, .02, 22, cx, .09, pz, '#f1e2b8', { noShadow: true }); [[8, .06, cx, pz - 8], [8, .06, cx, pz + 8], [.06, 16, cx - 4, pz], [.06, 16, cx + 4, pz]].forEach(([w, d, a, b]) => box(g, w, .02, d, a, .12, b, '#1f4fb8', { noShadow: true }));
      realNet(g, cx, pz, 8, 'x', i ? 'Palmeiras 2' : 'Palmeiras 1', '#0a7d3c'); solid(cx - 4.4, pz - .1, cx + 4.4, pz + .1);
      [-1, 1].forEach(sd => [-1, 1].forEach(q => fan(g, cx + q * 1.8, pz + sd * 5, sd > 0 ? Math.PI : 0, 1040 + i * 4 + q + sd, false))); });
    for (let k = 0; k < 4; k++) box(g, 2, .5, 22, px + (k < 2 ? -24 : 24) + (k % 2) * (k < 2 ? -1 : 1), .25 + (k % 2) * .5, pz, '#2457c5'); // arquibancadinhas
    for (let i = 0; i < 10; i++) { const sx = i < 5 ? -24 : 24, ff = fan(g, px + sx + (i % 2 ? (sx < 0 ? -1 : 1) : 0), pz - 8 + (i % 5) * 4, sx < 0 ? Math.PI / 2 : -Math.PI / 2, 1060 + i, true); ff.position.y = .5 + (i % 2) * .5; }
    for (let i = 0; i < 8; i++) palm(g, px - 28 + i * 8, pz + 18, 5);
    banner(g, ($s.CR.cosm || {}).centro ? 'Centro Comunitário ' + nameOf($s.CR.me) : pl.name, px, 2.6, pz - 20.5, 8, 1.1, '#0a7d3c', '#ffffff', 0, (($s.CR.cosm || {}).legado ? 'Embaixador do bairro · ' : '') + 'níveis ' + PRACA_LV[pracaLevel(pl, 0)].n + ' e ' + PRACA_LV[pracaLevel(pl, 1)].n);
    if (($s.CR.cosm || {}).centro) { box(g, 16, 4, 8, px, 2, pz + 26, '#f6f3ee'); solid(px - 8, pz + 22, px + 8, pz + 30); banner(g, 'Centro Comunitário', px, 3.2, pz + 21.95, 10, 1.2, '#0a7d3c', '#ffffff', 0, nameOf($s.CR.me)); } cyl(g, .06, .06, 2.6, px - 3.6, 1.3, pz - 20.5, '#3a3f47'); cyl(g, .06, .06, 2.6, px + 3.6, 1.3, pz - 20.5, '#3a3f47');
    LV.plazas.push(Object.assign({ w: 60, d: 40 }, pl));
    [-14, 14].forEach((dx, ci) => { spot(sp, 'praca', px + dx, pz - 10.5, 'Palmeiras · quadra ' + (ci + 1), 'Galera nível ' + PRACA_LV[pracaLevel(pl, ci)].n + ' hoje'); const q = LV.spots[LV.spots.length - 1]; q.plaza = pl; q.ci = ci; q.multi = true; }); }
  // casas e lojinhas na quarta rua, entre os prédios e as praças
  let k = 0; for (let x = -10; x < 280; x += 14) { if (x > 8 && x < 74) continue; if (x > 152 && x < 228) continue; if (Math.abs(x - 120) < 14 || Math.abs(x - 262) < 14 || Math.abs(x - 88) < 10) continue; const c = HOUSE_COLS[(k++ + 5) % HOUSE_COLS.length]; neighborHouse(g, x, 205, 10, 7, c[0], c[1], -1); }
}
// toques próprios de cada praça do norte (a do Sol tem sorveteria e parquinho, a das Gaivotas pista de skate, a Iemanjá lago com patos)
function plazaTheme(g, sp, pl, x, z) {
  if (pl.id === 'sol') { box(g, 1.6, 1, 1, x + 17, .5, z + 3, '#ff8fab'); const um = new THREE.Mesh(new THREE.ConeGeometry(1.1, .5, 10), mat('#ffffff')); um.position.set(x + 17, 2.2, z + 3); g.add(um); cyl(g, .03, .03, 1.8, x + 17, 1.3, z + 3, '#cfd3d8'); banner(g, 'Sorvete', x + 17, 1.15, z + 2.48, 1.2, .3, '#ff8fab', '#ffffff'); solid(x + 16.2, z + 2.5, x + 17.8, z + 3.5);
    spot(sp, 'sorvete', x + 17, z + 5, 'Carrinho de sorvete', 'Picolé ($6)'); for (let i = 0; i < 2; i++) { cyl(g, .05, .05, 2, x - 18 + i * 3, 1, z + 4, '#e63946'); } box(g, 3.2, .08, .08, x - 16.5, 2, z + 4, '#e63946'); }
  else if (pl.id === 'gaivotas') { const ramp = (rx, rz, rot) => { const r = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 4, 12, 1, true, 0, Math.PI / 2), mat('#9aa0a8', { side: THREE.DoubleSide })); r.rotation.set(0, rot, Math.PI / 2); r.position.set(rx, 2.2, rz); g.add(r); };
    box(g, 10, .1, 8, x - 17, .08, z + 3, '#b9bec6', { noShadow: true }); ramp(x - 21, z + 3, 0); ramp(x - 13, z + 3, Math.PI); box(g, 2, .5, .3, x - 17, .25, z + 3, '#ffd23f');
    for (let i = 0; i < 2; i++) { const sk = dyn2(sp, fan(new THREE.Group(), x - 17, z + 2 + i * 2, Math.PI / 2, 1080 + i, false)); LV.npcs.push({ kind: 'walk', o: sk, x: x - 17, z: z + 2 + i * 2, v: i ? 3 : -3, x0: x - 20.5, x1: x - 13.5 }); } banner(g, 'Pista de skate', x - 17, 2.6, z - 1.4, 3.6, .5, '#111214', '#ffd23f'); }
  else if (pl.id === 'iemanja') { const lk = new THREE.Mesh(new THREE.CircleGeometry(4.5, 28), mat('#3fb6e8', { roughness: .1, metalness: .2 })); lk.rotation.x = -Math.PI / 2; lk.scale.set(1, .7, 1); lk.position.set(x + 16, .1, z + 3); g.add(lk); solid(x + 11.5, z, x + 20.5, z + 6);
    for (let i = 0; i < 4; i++) { const d = dyn2(sp, new THREE.Group()); const b2 = new THREE.Mesh(new THREE.SphereGeometry(.18, 8, 6), mat('#ffffff')); b2.scale.set(1.3, .8, 1); d.add(b2); const hd = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), mat('#ffffff')); hd.position.set(.2, .15, 0); d.add(hd); d.position.set(x + 14 + i * 1.3, .2, z + 2 + (i % 2)); LV.npcs.push({ kind: 'duck', o: d, cx: x + 16, cz: z + 3, ph: i * 1.6 }); }
    box(g, 1, 1.2, 1, x + 16, .6, z - 2, '#f4f4f4'); const st = fan(g, x + 16, z - 2, 0, 1100, false); st.position.y = 1.2; st.traverse(o => { if (o.isMesh) o.material = mat('#cfe8f5', { metalness: .3, roughness: .3 }); }); spot(sp, 'lago', x + 16, z + 7.5, 'Lago dos patos', 'Dar pipoca aos patos'); }
}
// ---------- bairros oeste e leste: mais praças, arenas e parques (cada um com cara própria) ----------
const PLACES2 = [
  { id: 'vila', name: 'Arena da Vila', x: -125, z: 94, kind: 'arena', court: true, col: '#c0392b' },
  { id: 'clube', name: 'Clube Atlântico', x: -205, z: 94, kind: 'clube', court: true, col: '#1f4fb8' },
  { id: 'lagoa', name: 'Parque da Lagoa', x: -160, z: 160, kind: 'parque', court: true, col: '#2a9d8f' },
  { id: 'bosque', name: 'Bosque dos Ipês', x: -235, z: 165, kind: 'bosque' },
  { id: 'farol', name: 'Mirante do Farol', x: -205, z: -45, kind: 'mirante' },
  { id: 'mercado', name: 'Quadra do Mercado', x: 345, z: 94, kind: 'coberta', court: true, col: '#ff6a00' },
  { id: 'porsol', name: 'Arena Pôr do Sol', x: 425, z: 94, kind: 'arena', court: true, col: '#6b2fb8' },
  { id: 'esporte', name: 'Parque Esportivo', x: 385, z: 160, kind: 'esportivo', court: true, col: '#0a7d3c' },
  { id: 'jardim', name: 'Jardim Botânico', x: 455, z: 165, kind: 'jardim' },
];
function courtLines(g, cx, cz, col = '#1f4fb8', rot = 0) { box(g, rot ? 22 : 14, .02, rot ? 14 : 22, cx, .09, cz, '#f1e2b8', { noShadow: true });
  (rot ? [[.06, 8, cx - 8, cz], [.06, 8, cx + 8, cz], [16, .06, cx, cz - 4], [16, .06, cx, cz + 4]] : [[8, .06, cx, cz - 8], [8, .06, cx, cz + 8], [.06, 16, cx - 4, cz], [.06, 16, cx + 4, cz]]).forEach(([w, d, a, b]) => box(g, w, .02, d, a, .12, b, col, { noShadow: true })); }
function placeBuild(g, sp, pl, R) {
  const { x, z } = pl, lvT = pl.court && !['clube', 'esportivo'].includes(pl.kind) ? ' · galera ' + PRACA_LV[pracaLevel(pl)].n : pl.court ? ' · um nível em cada quadra' : '';
  const sign2 = (zz) => { banner(g, pl.name, x, 2.6, zz, 7.5, 1.1, pl.col || '#2a9d8f', '#ffffff', 0, ({ arena: 'arena de bairro', clube: 'clube de beach tennis', parque: 'parque com quadra', coberta: 'quadra coberta', esportivo: 'complexo esportivo', bosque: 'trilha e sombra', mirante: 'vista do mar', jardim: 'flores e estufa' })[pl.kind] + lvT); cyl(g, .06, .06, 2.6, x - 3.4, 1.3, zz, '#3a3f47'); cyl(g, .06, .06, 2.6, x + 3.4, 1.3, zz, '#3a3f47'); };
  const playSpot = (sx, sz, ci) => { const L2 = PRACA_LV[pracaLevel(pl, ci || 0)]; spot(sp, 'praca', sx, sz, ci != null ? pl.name.replace(/^(Clube|Parque) /, '') + ' · quadra ' + (ci + 1) : pl.name, 'Galera nível ' + L2.n + ' hoje'); const q = LV.spots[LV.spots.length - 1]; q.plaza = pl; q.ci = ci || 0; q.multi = ci != null; };
  const players = (cx, cz, seed) => [-1, 1].forEach(sd => [-1, 1].forEach(q => fan(g, cx + q * 1.8, cz + sd * 5, sd > 0 ? Math.PI : 0, seed + q + sd, false)));
  if (pl.kind === 'arena') { // arena de bairro: muro com faixas, arquibancada de um lado, refletores
    box(g, 30, .08, 26, x, .05, z, '#d9cfb8', { noShadow: true }); courtLines(g, x, z, pl.col); realNet(g, x, z, 8, 'x', pl.name, pl.col); solid(x - 4.4, z - .1, x + 4.4, z + .1);
    [[30, .3, x, z - 13], [30, .3, x, z + 13], [.3, 26, x - 15, z], [.3, 26, x + 15, z]].forEach(([w, d, a, b], i) => { const gap = i === 0; if (gap) { box(g, 12, 2.4, .3, x - 9, 1.2, z - 13, pl.col); box(g, 12, 2.4, .3, x + 9, 1.2, z - 13, pl.col); solid(x - 15, z - 13.2, x - 3, z - 12.8); solid(x + 3, z - 13.2, x + 15, z - 12.8); } else { box(g, w, 2.4, d, a, 1.2, b, pl.col); solid(a - w / 2, b - d / 2, a + w / 2, b + d / 2); } });
    for (let k = 0; k < 3; k++) box(g, 1, .5, 20, x + 10 + k, .25 + k * .5, z, '#2457c5'); for (let i = 0; i < 9; i++) fan(g, x + 10 + (i % 3), z - 8 + Math.floor(i / 3) * 6 + (i % 2), -Math.PI / 2, 1300 + i, true).position.y = .5 + (i % 3) * .5;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { cyl(g, .1, .12, 7, x + a * 14, 3.5, z + b * 12, '#9aa0a8'); box(g, 1.2, .5, .3, x + a * 13.6, 7, z + b * 12, '#f4f4f4', glow('#ffffff', 1.2)); });
    players(x, z, 1320); sign2(z - 15); playSpot(x, z - 10.5); }
  else if (pl.kind === 'clube') { // clube: cerca baixa, duas quadras, sede com varanda e piscina pequena
    box(g, 44, .08, 34, x, .05, z, '#6aa65a', { noShadow: true }); [-9, 9].forEach((dx, i) => { courtLines(g, x + dx, z + 2, pl.col); realNet(g, x + dx, z + 2, 8, 'x', 'Clube ' + (i + 1), pl.col); solid(x + dx - 4.4, z + 1.9, x + dx + 4.4, z + 2.1); players(x + dx, z + 2, 1340 + i * 5); });
    box(g, 14, 3.4, 6, x, 1.7, z - 13, '#f6f3ee'); box(g, 15, .3, 7.5, x, 3.5, z - 12.5, '#1f4fb8'); solid(x - 7, z - 16, x + 7, z - 10); for (let i = 0; i < 4; i++) { chair(g, x - 5 + i * 3.3, z - 8.8, Math.PI, '#ffffff'); fan(g, x - 5 + i * 3.3, z - 8.8, Math.PI, 1360 + i, true).position.y = -.05; }
    box(g, 6, .05, 3, x + 15, .07, z - 13, '#3fb6e8', { metalness: .2, roughness: .1 }); [[44, .5, x, z + 17], [.5, 34, x - 22, z], [.5, 34, x + 22, z]].forEach(([w, d, a, b]) => { box(g, w, .8, d, a, .4, b, '#ffffff'); solid(a - w / 2, b - d / 2, a + w / 2, b + d / 2); });
    sign2(z - 18.5); playSpot(x - 9, z - 7, 0); playSpot(x + 9, z - 7, 1); }
  else if (pl.kind === 'parque') { // parque: gramado grande, lagoa com pedalinhos, árvores e a quadra no meio
    box(g, 50, .08, 40, x, .05, z, '#7fb069', { noShadow: true }); const lk = new THREE.Mesh(new THREE.CircleGeometry(8, 30), mat('#3fb6e8', { roughness: .1, metalness: .2 })); lk.rotation.x = -Math.PI / 2; lk.scale.set(1.3, .8, 1); lk.position.set(x - 12, .1, z + 8); g.add(lk); solid(x - 22, z + 2, x - 2, z + 14);
    for (let i = 0; i < 3; i++) { const pd = dyn2(sp, new THREE.Group()); box(pd, 1, .4, .7, 0, .2, 0, ['#ffd23f', '#e63946', '#2a9d8f'][i]); const sw = new THREE.Mesh(new THREE.SphereGeometry(.3, 8, 6), mat('#ffffff')); sw.position.set(.35, .55, 0); pd.add(sw); LV.npcs.push({ kind: 'duck', o: pd, cx: x - 12, cz: z + 8, ph: i * 2.1 }); }
    courtLines(g, x + 12, z - 4, pl.col); realNet(g, x + 12, z - 4, 8, 'x', pl.name, pl.col); solid(x + 7.6, z - 4.1, x + 16.4, z - 3.9); players(x + 12, z - 4, 1380);
    for (let t = 0; t < 10; t++) { const tx = x - 23 + (t % 5) * 11.5, tz = z + (t < 5 ? -18 : 18); cyl(g, .18, .25, 2.6, tx, 1.3, tz, '#7a5a42'); const c = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), mat('#3f8f4a')); c.position.set(tx, 3.4, tz); g.add(c); solid(tx - .3, tz - .3, tx + .3, tz + .3); }
    sign2(z - 20.5); playSpot(x + 12, z - 14.5); }
  else if (pl.kind === 'coberta') { // quadra coberta ao lado do mercado: telhado em arco, bancos e o mercado municipal
    box(g, 28, .08, 30, x, .05, z, '#bfb6a5', { noShadow: true }); courtLines(g, x, z, pl.col); realNet(g, x, z, 8, 'x', pl.name, pl.col); solid(x - 4.4, z - .1, x + 4.4, z + .1);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { cyl(g, .2, .2, 6, x + a * 8, 3, z + b * 12, '#3a3f47'); solid(x + a * 8 - .2, z + b * 12 - .2, x + a * 8 + .2, z + b * 12 + .2); });
    box(g, 18, .15, 26, x, 6.1, z, '#e9e9e9', { transparent: true, opacity: .55 }); for (let i = -2; i <= 2; i++) box(g, 18.4, .25, .3, x, 6, z + i * 6, '#3a3f47'); [-1, 1].forEach(a => box(g, .3, .25, 26, x + a * 8, 6, z, '#3a3f47'));
    [-1, 1].forEach(sd => { for (let i = 0; i < 4; i++) { bench(g, x + sd * 10.5, z - 7 + i * 4.5); if (R() < .6) fan(g, x + sd * 10.5, z - 7 + i * 4.5, -sd * Math.PI / 2, 1400 + i + (sd > 0 ? 9 : 0), true).position.y = 0; } });
    box(g, 26, 5, 10, x, 2.5, z - 21, '#e9c46a'); solid(x - 13, z - 26, x + 13, z - 16); banner(g, 'Mercado Municipal', x, 4.2, z - 15.97, 10, 1, '#c0392b', '#ffffff');
    players(x, z, 1420); sign2(z + 16); playSpot(x, z + 12.5); }
  else if (pl.kind === 'esportivo') { // parque esportivo: duas quadras de areia, uma de vôlei e pista de corrida em volta
    box(g, 60, .08, 40, x, .05, z, '#c45a3a', { noShadow: true }); box(g, 54, .09, 34, x, .06, z, '#7fb069', { noShadow: true });
    [-14, 14].forEach((dx, i) => { courtLines(g, x + dx, z, pl.col); realNet(g, x + dx, z, 8, 'x', 'Esportivo ' + (i + 1), pl.col); solid(x + dx - 4.4, z - .1, x + dx + 4.4, z + .1); players(x + dx, z, 1440 + i * 5); });
    for (let i = 0; i < 6; i++) { const o = dyn2(sp, fan(new THREE.Group(), x - 28, z - 18 + i * 6, 0, 1460 + i, false)); LV.npcs.push({ kind: 'walk', o, x: x - 28 + i * 9, z: z + (i % 2 ? -18.5 : 18.5), v: (i % 2 ? 2.4 : -2.4), x0: x - 28, x1: x + 28 }); } // corredores na pista
    sign2(z - 21.5); playSpot(x - 14, z - 11.5, 0); playSpot(x + 14, z - 11.5, 1); }
  else if (pl.kind === 'bosque') { // bosque: muitos ipês (amarelos e roxos), trilha de terra e bancos
    box(g, 40, .08, 40, x, .05, z, '#5e8a5c', { noShadow: true }); box(g, 3, .09, 40, x, .06, z, '#b8996a', { noShadow: true });
    for (let t = 0; t < 26; t++) { const tx = x - 18 + R() * 36, tz = z - 18 + R() * 36; if (Math.abs(tx - x) < 2.5) continue; cyl(g, .16, .22, 3.2, tx, 1.6, tz, '#6b4f3a'); const c = new THREE.Mesh(new THREE.SphereGeometry(1.5 + R(), 10, 8), mat(R() < .5 ? '#f2c14e' : '#b07ac9')); c.position.set(tx, 4, tz); g.add(c); solid(tx - .3, tz - .3, tx + .3, tz + .3); }
    for (let i = 0; i < 4; i++) bench(g, x + 2.6, z - 12 + i * 8); sign2(z - 21); LV.plazas.push(Object.assign({ w: 40, d: 40 }, pl)); return; }
  else if (pl.kind === 'mirante') { // mirante do farol na ponta da praia
    cyl(g, 8, 9, .8, x, .4, z, '#9aa0a8'); solid(x - 1.6, z - 1.6, x + 1.6, z + 1.6);
    for (let k = 0; k < 6; k++) cyl(g, 1.5 - k * .12, 1.6 - k * .12, 2, x, 1.8 + k * 2, z, k % 2 ? '#ffffff' : '#c0392b'); const lt = new THREE.Mesh(new THREE.SphereGeometry(.9, 12, 10), mat('#fff3d6', glow('#ffe1a8', 2))); lt.position.set(x, 13.6, z); g.add(lt);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; cyl(g, .05, .05, 1, x + Math.cos(a) * 7.6, 1.3, z + Math.sin(a) * 7.6, '#3a3f47'); }
    for (let i = 0; i < 3; i++) fan(g, x - 4 + i * 2.5, z - 5, Math.PI, 1480 + i, false).position.y = .8;
    sign2(z + 10); spot(sp, 'farol', x, z + 7, 'Mirante do Farol', 'Ver o pôr do sol (+2 energia)'); LV.plazas.push(Object.assign({ w: 20, d: 20 }, pl)); return; }
  else if (pl.kind === 'jardim') { // jardim botânico: canteiros coloridos, estufa de vidro e fonte
    box(g, 40, .08, 40, x, .05, z, '#6aa65a', { noShadow: true });
    for (let i = 0; i < 12; i++) box(g, 4, .35, 2, x - 14 + (i % 4) * 9, .2, z - 12 + Math.floor(i / 4) * 6, ['#e63946', '#ffd23f', '#b07ac9', '#ff8fab'][i % 4]);
    box(g, 12, 4, 8, x, 2, z + 13, '#cfe8f5', { transparent: true, opacity: .5, metalness: .4, roughness: .1 }); solid(x - 6, z + 9, x + 6, z + 17);
    cyl(g, 2.2, 2.4, .5, x, .25, z + 3, '#cfd3d8'); cyl(g, 2, 2, .05, x, .5, z + 3, '#3fb6e8'); solid(x - 2.4, z + .6, x + 2.4, z + 5.4);
    sign2(z - 21); spot(sp, 'jardim', x, z - 2, 'Jardim Botânico', 'Passear entre as flores (+1 energia)'); LV.plazas.push(Object.assign({ w: 40, d: 40 }, pl)); return; }
  LV.plazas.push(Object.assign({ w: 44, d: 36 }, pl));
}
// ---------- loteamento: todo terreno vazio entre as ruas ganha casa, comércio ou prédio (sem buracos na cidade) ----------
const FILL_SHOPS = [['Padaria Pão Quente', '#c98b3a'], ['Farmácia Bem-Estar', '#2a9d8f'], ['Mercadinho da Esquina', '#e63946'], ['Barbearia do Tonho', '#264653'], ['Pet Shop Au-Au', '#f4a261'],
  ['Lanchonete X-Praia', '#ff8c00'], ['Papelaria Lápis', '#457b9d'], ['Salão Bela Onda', '#d16ba5'], ['Hortifrúti Verdinho', '#4f9a52'], ['Ótica Visão', '#3a3f47'], ['Lavanderia Bolha', '#5fa8d3'],
  ['Pizzaria Forno a Lenha', '#b5332e'], ['Loja de Surf Maral', '#1d7fa6'], ['Açougue Boi Bom', '#8b1e2d'], ['Academia Ferro', '#222831'], ['Floricultura Ipê', '#b07ac9'], ['Bicicletaria Pedal', '#2b9348'],
  ['Chaveiro 24h', '#e9c46a'], ['Livraria Maré', '#6d597a'], ['Brechó da Vó', '#a26769'], ['Sushi Onda', '#c1121f'], ['Café Grão', '#6f4e37'], ['Doceria Brigadeiro', '#d4a5a5'], ['Clínica do Pé', '#0081a7']];
function cityFill(g, sp) {
  const R = mulberry(($s.CR.seed || 4) * 41 + 13), occ = [], bb = new THREE.Box3();
  g.updateMatrixWorld(true);
  g.traverse(o => { if (!o.isMesh || o.parent === sp) return; bb.setFromObject(o, true); if (bb.isEmpty()) return; const h = bb.max.y - Math.max(0, bb.min.y), w = bb.max.x - bb.min.x, d = bb.max.z - bb.min.z;
    if (h < .35 || (w > 120 && d > 120)) return; occ.push([bb.min.x - H0.x, bb.min.z - H0.z, bb.max.x - H0.x, bb.max.z - H0.z]); });
  LV.boxes.forEach(b => occ.push(b.slice())); (LV.plazas || []).forEach(q => occ.push([q.x - q.w / 2 - 3, q.z - q.d / 2 - 3, q.x + q.w / 2 + 3, q.z + q.d / 2 + 3]));
  LV.spots.forEach(q => occ.push([q.x - 5, q.z - 5, q.x + 5, q.z + 5]));
  occ.push([22, 75, 62, 105], [46, 152, 70, 172], [155, 147, 209, 173], [32, 28, 82, 48]); // gramado, lagoinha, mercado, quadras de casa
  const VR = [[-55, 24, 192], [25, 24, 64], [88, 24, 192], [290, 128, 188], [-165, 24, 192], [385, 24, 192]];
  const free = (x0, z0, x1, z1) => !occ.some(([a, b, c, d]) => x0 < c && x1 > a && z0 < d && z1 > b) && !VR.some(([vx, a, b]) => x0 < vx + 7.5 && x1 > vx - 7.5 && z0 < b + 7 && z1 > a - 7);
  // ruas novas ligando as ruas grandes (onde o quarteirão está livre): mais caminhos para o carro
  [[24, 64], [64, 124], [124, 192], [192, 246]].forEach(([za, zb], bi) => { const z0 = za + 4, z1 = bi === 3 ? 240 : zb - 4;
    for (const x of [-235, -205, -130, -95, 0, 55, 125, 165, 235, 260, 330, 355, 420, 450]) { if (VR.some(([vx, a, b]) => Math.abs(vx - x) < 30 && a < z1 && b > z0)) continue;
      if (!free(x - 6.5, z0 + 1, x + 6.5, z1 - 1)) continue;
      box(g, 8, .06, z1 - z0, x, .03, (z0 + z1) / 2, '#3a3f47', { noShadow: true }); [-1, 1].forEach(sd => box(g, 2.4, .14, z1 - z0 - 8, x + sd * 5.2, .07, (z0 + z1) / 2 - (bi === 3 ? 0 : 0), '#cfcac0', { noShadow: true }));
      for (let zz = z0 + 6; zz < z1 - 6; zz += 5) box(g, .18, .02, 2.2, x, .07, zz, '#f2f2f2', { noShadow: true });
      if (bi === 3) box(g, 14, .06, 8, x, .03, z1 - 4, '#3a3f47', { noShadow: true }); // retorno no fim da rua
      VR.push([x, z0, z1]); LV.xRoads.push([x, z0, z1]); } });
  const ROADS = [24, 64, 124, 192, 246], cols = ['#f1e3c6', '#e8c9a0', '#cfe0e8', '#f6d6d6', '#dfe8cf', '#f3efe6', '#e9d8f0', '#fbe7b5', '#d9cbb5'], roofs = ['#b5523b', '#8a4a32', '#5d4037', '#7a7f87', '#a0522d'];
  let LOT_SIDE = 0, LOT_I = 0; LV.lots = []; let si = Math.floor(R() * FILL_SHOPS.length);
  for (let i = 0; i < 4; i++) { const zA = ROADS[i] + 6.5, zB = ROADS[i + 1] - (i === 3 ? 2 : 6.5);
    for (const side of [0, 1]) { LOT_SIDE = side; LOT_I = i; // uma fileira de frente para cada rua do quarteirão
      if (zB - zA < 14 && side) continue; const face = side ? 1 : -1, dep = Math.min(26, (zB - zA) / (side ? 2 : 1) - .5); let bd = 0;
      for (let x = -258; x < 480; ) { const w = 9 + Math.floor(R() * 5), z0 = side ? zB - dep : zA, z1 = side ? zB : zA + dep, cx = x + w / 2;
        if (!free(x - .8, z0 - .8, x + w + .8, z1 + .8)) { const d2 = Math.min(dep, 11.5), za2 = side ? zB - d2 : zA, zb2 = side ? zB : zA + d2; // terreno raso, se o fundo não estiver livre
          if (dep > 12 && free(x - .8, za2 - .8, x + w + .8, zb2 + .8)) { lot(x, w, za2, zb2, d2); x += w + 1.2; } else x += 3; continue; }
        lot(x, w, z0, z1, dep); x += w + 1.2; } } }
  function lot(x, w, z0, z1, dep) { const cx = x + w / 2, side = LOT_SIDE, i = LOT_I; let bd = 0;
        const r = R(), cz = (z0 + z1) / 2, near = (side ? 1 : -1), shop = r < .38 && i < 3, apt = !shop && r < .55 && i !== 3, fz = side ? z1 : z0; // fachada virada para a rua
        if (shop) { const [nm, c] = FILL_SHOPS[si++ % FILL_SHOPS.length], h = 4 + Math.floor(R() * 2) * 3, d = Math.min(dep, 9);
          const zc = side ? z1 - d / 2 : z0 + d / 2; box(g, w - .6, h, d, cx, h / 2, zc, cols[Math.floor(R() * cols.length)]); solid(cx - w / 2 + .3, zc - d / 2, cx + w / 2 - .3, zc + d / 2);
          const fr = side ? zc + d / 2 : zc - d / 2, o = side ? .06 : -.06; box(g, w - 2.4, 2.2, .08, cx, 1.4, fr + o, '#9fd3ea', { metalness: .35, roughness: .15 }); box(g, 1.3, 2.3, .1, cx + w / 2 - 2, 1.15, fr + o * 1.5, '#5b4636');
          const aw = new THREE.Mesh(new THREE.BoxGeometry(w - .8, .08, 1.6), mat(c)); aw.position.set(cx, 2.85, fr + (side ? .8 : -.8)); aw.rotation.x = side ? .18 : -.18; aw.castShadow = true; g.add(aw);
          banner(g, nm, cx, 3.6, fr + o * 2, Math.min(w - 1.5, 7.5), .7, c, '#ffffff', side ? 0 : Math.PI); box(g, w - .4, .25, d + .2, cx, h + .12, zc, '#cfcac0');
          if (R() < .5) { bench(g, cx - w / 2 + 2, fr + (side ? 2.4 : -2.4)); } LV.lots.push([cx, zc, w, d, 's']); bd = d; }
        else if (apt) { const h = 6 + Math.floor(R() * 4) * 3, d = Math.min(dep, 10), zc = side ? z1 - d / 2 : z0 + d / 2; aptBlock(g, cx, zc, w - .6, d, h, cols[Math.floor(R() * cols.length)]);
          if (side) for (let f = 0; f * 3 + 1.6 < h; f++) for (let k = 0; k < Math.floor((w - .6) / 2.4); k++) box(g, 1.2, 1.1, .06, cx - (w - .6) / 2 + 1.4 + k * 2.4, 1.6 + f * 3, zc + d / 2 + .03, '#9fd3ea', { metalness: .3, roughness: .2 });
          LV.lots.push([cx, zc, w, d, 'a']); bd = d; }
        else { const hw = w - 3, hd = Math.min(dep - 3.5, 8), zc = side ? z1 - 3 - hd / 2 : z0 + 3 + hd / 2; neighborHouse(g, cx, zc, hw, hd, cols[Math.floor(R() * cols.length)], roofs[Math.floor(R() * roofs.length)], side ? 1 : -1);
          const fy = side ? z1 - .1 : z0 + .1; for (let k = 0; k < w - 1; k += 1.2) box(g, .9, .8, .06, x + .6 + k, .4, fy, '#f4f4f4'); // cerquinha
          if (R() < .35) car(g, cx + hw / 2 - 1, side ? z1 - 2 : z0 + 2, Math.PI / 2, ['#e63946', '#f4f4f4', '#264653', '#ffd23f'][Math.floor(R() * 4)]);
          LV.lots.push([cx, zc, w, hd, 'h']); bd = hd + 3; }
        if (dep - bd > 4) { const ya = side ? z0 : z0 + bd + .5, yb = side ? z1 - bd - .5 : z1, ym = (ya + yb) / 2; // quintal / fundos do terreno
          box(g, w - .4, .05, yb - ya, cx, .025, ym, R() < .5 ? '#7fb069' : '#8cbf6a', { noShadow: true });
          const fzB = side ? ya + .05 : yb - .05; box(g, w, 1.7, .15, cx, .85, fzB, '#d9d2c3'); solid(x, fzB - .1, x + w, fzB + .1);
          const r2 = R(); if (r2 < .3 && yb - ya > 7) { box(g, 4, .1, 2.6, cx, .06, ym, '#3fb6e8', { transparent: true, opacity: .8 }); box(g, 4.6, .12, 3.2, cx, .04, ym, '#e9e9e9'); }
          else if (r2 < .55) { cyl(g, .15, .2, 2.4, cx - w / 4, 1.2, ym, '#8a6a45'); const tc = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), mat(['#4f9a52', '#5e8a5c', '#6aa65a'][Math.floor(R() * 3)])); tc.position.set(cx - w / 4, 3, ym); tc.castShadow = true; g.add(tc); solid(cx - w / 4 - .25, ym - .25, cx - w / 4 + .25, ym + .25); }
          else if (r2 < .75) { box(g, 3, 2.2, 2.4, cx + w / 4, 1.1, ym, '#b9a58a'); solid(cx + w / 4 - 1.5, ym - 1.2, cx + w / 4 + 1.5, ym + 1.2); } // edícula
          else { for (let k = 0; k < 3; k++) box(g, 1.6, .35, .8, cx - 2 + k * 2, .18, ym, ['#e63946', '#ffd23f', '#b07ac9'][k]); } } // horta / canteiros
        occ.push([x, z0, x + w, z1]); }

}
function cityWide(g, sp) {
  const R = mulberry(($s.CR.seed || 4) * 19 + 7), road = (w, d, x, z) => box(g, w, .06, d, x, .03, z, '#3a3f47', { noShadow: true }), walk = (w, d, x, z) => box(g, w, .14, d, x, .07, z, '#cfcac0', { noShadow: true });
  // as ruas seguem para oeste e leste
  [24, 64, 124, 192].forEach(z => { road(205, 8, -157, z); walk(205, 2.4, -157, z - 4.8); walk(205, 2.4, -157, z + 4.8); road(190, 8, 390, z); walk(190, 2.4, 390, z - 4.8); walk(190, 2.4, 390, z + 4.8);
    for (let i = -258; i < -55; i += 5) box(g, 2.2, .02, .18, i, .07, z, '#f2f2f2', { noShadow: true }); for (let i = 297; i < 483; i += 5) box(g, 2.2, .02, .18, i, .07, z, '#f2f2f2', { noShadow: true }); });
  [-165, 385].forEach(x => { road(8, 168, x, 108); walk(2.4, 168, x - 5.2, 108); walk(2.4, 168, x + 5.2, 108); });
  for (let x = -250; x <= 475; x += 14) { if (x > -58 && x < 298) continue; if (Math.abs(x + 165) < 8 || Math.abs(x - 385) < 8) continue; palm(g, x, 17.4, 4.6); streetLamp(g, x + 7, 18.3); }
  // casas e prédios entre as praças novas
  let k = 0; for (let x = -250; x < 480; x += 15) { if (x > -60 && x < 300) continue; if (Math.abs(x + 165) < 10 || Math.abs(x - 385) < 10) continue; const c = HOUSE_COLS[(k++ + 2) % HOUSE_COLS.length]; neighborHouse(g, x, 38, 10, 7, c[0], c[1], 1); if (R() < .5) neighborHouse(g, x + 2, 206, 9, 7, c[0], c[1], -1); }
  aptBlock(g, -95, 50, 16, 12, 12, '#e3d5c1'); aptBlock(g, 455, 50, 16, 12, 15, '#cfe3e8');
  for (let i = 0; i < 16; i++) { const z = [19.2, 28.8, 59.2, 68.8][i % 4], left = i < 8, x0 = left ? -250 + R() * 190 : 300 + R() * 180, o = dyn2(sp, fan(new THREE.Group(), x0, z, 0, 1500 + i, false)); LV.npcs.push({ kind: 'walk', o, x: x0, z, v: (i % 2 ? 1 : -1) * (.9 + R() * .5), x0: left ? -255 : 298, x1: left ? -60 : 480 }); }
  PLACES2.forEach(pl => placeBuild(g, sp, pl, R));
}
function build() {
  const lvl = crInv('moradia'), key = Object.keys($s.CR.cosm || {}).join() + ['quadra', 'ct', 'moradia', 'gastro', 'esports', 'midia', 'saude', 'jato', 'eventos'].map(crInv).join('') + ['carro', 'casa', 'crio', 'nutri', 'social', 'skate', 'bike', 'cachorro', 'gato', 'trofeus'].map(k => crLife(k) ? 1 : 0).join('') + '|' + Object.values($s.CR.titles || {}).reduce((a, b) => a + b, 0) + '|' + (($s.CR.tour && !$s.CR.tour.pending && !$s.CR.tour.done) ? $s.CR.tour.name + $s.CR.tour.round + $s.CR.tour.day + (crMyMatch() ? 1 : 0) : '');
  if (LV.group && LV.built === key) return;
  if (LV.group) { scene.remove(LV.group); LV.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  LV.built = key; LV.doors = []; LV.spots = []; LV.boxes = []; LV.gnd = []; LV.roadR = []; LV.xRoads = []; LV.noSpawn = []; LV.npcs = []; LV.pool = null;
  const g = new THREE.Group(); g.position.copy(H0); LV.group = g; scene.add(g);
  const sp = new THREE.Group(); g.add(sp); sp.userData.dyn = true; // pontos de interação (fora da junção)
  const S2 = (id, x, z, t, s, r) => spot(sp, id, x, z, t, s, r);
  const court = crInv('quadra') >= 1 || lvl >= 3, lights = crInv('quadra') >= 2 || lvl >= 3;
  // ---- chão: areia da praia ao norte, terrenos com grama, calçadas e a rua ----
  box(g, 400, .2, 213, 100, -.12, 18.5, '#e8d7ae', { noShadow: true }); // (a areia vai até o mar da cena, em z −88)
  // horizonte: areia e terreno até longe (sem emenda com o cenário da quadra), a rua principal segue até sumir, morros ao fundo
  box(g, 2400, .2, 896, 100, -.085, 362, '#dccb9f', { noShadow: true }); // (acima do nível do mar da cena: senão a água aparecia por cima do terreno longe da praia) box(g, 2400, .06, 8, 100, .02, 24, '#3a3f47', { noShadow: true }); box(g, 2400, .06, 8, 100, .015, 64, '#3a3f47', { noShadow: true });
  for (let i = 0; i < 9; i++) { const h = new THREE.Mesh(new THREE.ConeGeometry(70 + (i % 3) * 25, 40 + (i % 4) * 14, 7), mat(['#6f9b6a', '#5e8a5c', '#7aa673'][i % 3])); h.position.set(-600 + i * 170, 10, 420 + (i % 2) * 60); g.add(h); }
  solid(-60, -97, 290, -96); // dá para entrar no mar (até onde dá pé)
  // beira do mar (o mar é o da cena, o mesmo da quadra: some a emenda com o local do torneio)
  const lotW = [14, 17, 22, 46][lvl], lotD = [12, 14, 18, 30][lvl];
  box(g, lotW + 18, .05, lotD + 6, court ? 6 : 0, .02, 1, lvl >= 2 ? '#6aa65a' : '#7fb069', { noShadow: true });
  box(g, 400, .06, 8, 100, .03, 24, '#3a3f47', { noShadow: true }); for (let i = -98; i < 300; i += 5) box(g, 2.2, .02, .18, i, .07, 24, '#f2f2f2', { noShadow: true });
  [19.2, 28.8].forEach(z => { box(g, 400, .14, 2.4, 100, .07, z, '#cfcac0', { noShadow: true }); box(g, 400, .16, .12, 100, .08, z + (z < 24 ? 1.2 : -1.2), '#9e9a92', { noShadow: true }); });
  box(g, 2.2, .05, 13, 0, .05, 12.5, '#cfcac0', { noShadow: true }); // caminho até a porta
  // ---- casa ----
  const W = [12, 14, 18, 34][lvl], D = [10, 11, 13, 22][lvl], hW = W / 2, hD = D / 2; LV.house = [hW, hD]; const WH = [2.6, 2.8, 3, 3.6][lvl]; // (a mansão é bem maior: suíte, sala de cinema, escritório)
  const wc = ['#e9e2d4', '#f1ece2', '#f6f3ee', '#fbfaf7'][lvl], floor = ['#a77d55', '#b98b5e', '#c49a6c', '#d6cdbf'][lvl];
  box(g, W, .08, D, 0, .04, 0, floor, { noShadow: true, roughness: lvl >= 3 ? .3 : .8 });
  if (lvl >= 1) box(g, W + .6, .3, D + .6, 0, -.05, 0, '#d8d2c6', { noShadow: true });
  wall(g, -hW, -hD, hW, -hD, WH, wc, lvl >= 2 ? [[-1.4, 1.4]] : [], true);           // fundo (na mansão e na casa com piscina: porta para a área da piscina)
  const tcz = -hD + 3.7; // sala de troféus (comprada): passagem direto da sala de estar
  wall(g, -hW, -hD, -hW, hD, WH, wc, crLife('trofeus') ? [[tcz - 1, tcz + 1]] : [], true); wall(g, hW, -hD, hW, hD, WH, wc, [], true);
  wall(g, -hW, hD, hW, hD, WH, wc, [[-1.2, 1.2]], true);
  if (lvl >= 2) [-1, 1].forEach(s => box(g, .25, WH + .1, .25, s * 1.5, (WH + .1) / 2, hD + .12, '#c9a97c')); // batentes da porta grandes
  // quarto (fundo à direita)
  // quarto fechado (duas paredes e a porta); na mansão, uma suíte bem maior
  const bd = lvl >= 3 ? 7 : 4.4, bx = hW - (lvl >= 3 ? 8 : 4.6);
  wall(g, bx, -hD, bx, -hD + bd, WH, wc, [[-hD + bd - 1.2, -hD + bd]]); wall(g, bx, -hD + bd, hW, -hD + bd, WH, wc);
  // portas: entrada (dupla), fundos para a piscina (dupla) e quarto
  const dc = ['#8a6a45', '#7a5a42', '#5a3a28', '#2b2d31'][lvl];
  door(sp, -1.2, hD, 1.2, 'x', 1, dc); door(sp, 1.2, hD, 1.2, 'x', -1, dc);
  if (lvl >= 2) { door(sp, -1.4, -hD, 1.4, 'x', 1, '#cfe8f5'); door(sp, 1.4, -hD, 1.4, 'x', -1, '#cfe8f5'); }
  door(sp, bx, -hD + bd - 1.2, 1.2, 'z', 1, dc);
  if (lvl >= 3) { // sala de cinema (frente à direita): telão, poltronas em dois degraus, luz baixa
    const c0 = hW - 9, z0 = hD - 8; wall(g, c0, z0, hW, z0, WH, '#2b2d31'); wall(g, c0, z0, c0, hD, WH, '#2b2d31', [[hD - 2.8, hD - 1.4]]); door(sp, c0, hD - 2.8, 1.4, 'z', 1, '#2b2d31');
    box(g, 9, .06, 8, hW - 4.5, .09, hD - 4, '#3a1d2a', { noShadow: true });
    box(g, 7, 3, .1, hW - 4.5, 2, z0 + .1, '#0a0a0c'); banner(g, nameOf($s.CR.me).split(' ')[0] + ' Cine', hW - 4.5, 2, z0 + .17, 6.6, 2.7, '#0b1a3a', '#e8b923', 0, 'sessão: melhores pontos da carreira');
    for (let r = 0; r < 2; r++) { box(g, 8, .25 * r, 1.6, hW - 4.5, .12 * r, z0 + 3.4 + r * 2.1, '#2b1620'); for (let i = 0; i < 4; i++) { const sx = hW - 7.5 + i * 2, sz2 = z0 + 3.4 + r * 2.1, y0 = .25 * r; box(g, 1.1, .45, .9, sx, y0 + .25, sz2, '#7a1f2b'); box(g, 1.1, .8, .2, sx, y0 + .7, sz2 + .45, '#7a1f2b'); } solid(hW - 8.6, z0 + 2.6 + r * 2.1, hW - .4, z0 + 4.2 + r * 2.1); }
    for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), mat('#ffe7b0', glow('#ffcf7a', 1.6))); l.position.set(c0 + .2, .4, z0 + 1 + i * 1.8); g.add(l); }
    S2('cinema', hW - 4.5, hD - 1.1, 'Sala de cinema', 'Ver um filme ou seus jogos', .9);
  }
  bed(g, lvl >= 2 ? 1.9 : 1.4, hW - 2.2, -hD + 1.4, 0, ['#3d5a80', '#4a6fa5', '#7a5c8e', '#2b2d42'][lvl]);
  box(g, .5, .5, .45, hW - .5, .25, -hD + .5, '#6b4f3a'); lamp(g, bx + .6, -hD + .6, true);
  S2('cama', hW - 2.2, -hD + 3.2, 'Cama', 'Descansar', .9);
  // guarda-roupa no quarto (closet na mansão): edita o visual e guarda até 5 looks
  { const wx = bx + .36, wz = -hD + 1.7, L = lvl >= 3 ? 2.6 : 1.7, wcol = ['#8a6a45', '#a77d55', '#f2efe9', '#2b2d31'][lvl];
    box(g, .62, 2.2, L, wx, 1.1, wz, wcol); box(g, .02, 2, .02, wx + .32, 1.1, wz, '#c9a97c'); [-1, 1].forEach(sd => box(g, .03, .25, .03, wx + .33, 1.15, wz + sd * .12, '#d9d9d9', { metalness: .7 })); solid(wx - .31, wz - L / 2, wx + .31, wz + L / 2);
    if (lvl >= 3) box(g, .03, 1.6, .7, wx + .33, 1.2, wz - L / 2 + .45, '#cfe8f5', { metalness: .9, roughness: .05 }); // espelho do closet
    S2('armario', wx + 1.1, wz, lvl >= 3 ? 'Closet' : 'Guarda-roupa', 'Looks salvos e visual', .8); }
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
  const pcx = lvl >= 3 ? hW - 12 : hW - 1.6, pcz = hD - 1.6; // (na mansão o canto da direita é a sala de cinema)
  desk(g, pcx, pcz, 2, crInv('esports') >= 1);
  S2('pc', pcx - 1.6, pcz, crInv('esports') >= 1 ? 'Setup gamer' : 'Computador', 'Agenda da carreira', .8);
  if (crInv('midia') >= 1) { const qx2 = lvl >= 3 ? hW - 12 : hW - 2.8, qz2 = lvl >= 3 ? hD - 5.5 : hD - 4.2; podcast(g, qx2, qz2); S2('podcast', qx2 - .2, qz2 + 1.2, 'Estúdio', crInv('midia') >= 2 ? 'Gravar o podcast' : 'Gravar vídeo', .7); }
  // academia em casa (mansão ou CT) e banheira de gelo (crioterapia ou clínica)
  if (lvl >= 3 || crInv('ct') >= 1) { gym(g, -hW + 2, 0); S2('academia', -hW + 3.5, 1.8, 'Academia', 'Treino físico', .8); }
  if (crLife('crio') || crInv('saude') >= 1) { iceBath(g, bx - 1.1, -hD + .8); S2('gelo', bx - 1.1, -hD + 2.1, 'Banheira de gelo', 'Recuperar', .7); }
  // mesa de jantar (a partir do apartamento): na frente, à esquerda
  if (lvl >= 1) { const tx = -hW + (lvl >= 3 ? 6 : 4.2), tz = hD - (lvl >= 3 ? 5.2 : 3.6), n = lvl >= 3 ? 3 : 2;
    box(g, n * 1 + .4, .06, 1.1, tx, .78, tz, lvl >= 3 ? '#2b2d31' : '#8a6a45'); [-1, 1].forEach(a => [-1, 1].forEach(b => box(g, .07, .75, .07, tx + a * (n * .5), .38, tz + b * .45, '#3a2d22')));
    for (let i = 0; i < n; i++) [-1, 1].forEach(b => { const cx2 = tx - (n - 1) * .5 + i; box(g, .45, .45, .45, cx2, .23, tz + b * .85, lvl >= 3 ? '#f2f2f2' : '#c9a97c'); box(g, .45, .55, .06, cx2, .7, tz + b * 1.05, lvl >= 3 ? '#f2f2f2' : '#c9a97c'); });
    cyl(g, .35, .25, .05, tx, .9, tz, '#ffffff'); solid(tx - n * .5 - .3, tz - 1.2, tx + n * .5 + .3, tz + 1.2);
    if (lvl >= 2) { const c = new THREE.Mesh(new THREE.SphereGeometry(.35, 12, 10), mat('#fff3d6', glow('#ffe1a8', 1))); c.position.set(tx, WH - .5, tz); g.add(c); } }
  // casa com piscina e mansão: estante de livros, aparador e mesa de centro; mansão: piano, bar e colunas
  const sz = lvl >= 3 ? -4.4 : 0;
  if (lvl >= 2) { box(g, .45, 2, 2.4, hW - .35, 1, 2.2 + sz, '#4a3628'); for (let k = 0; k < 4; k++) for (let i = 0; i < 6; i++) box(g, .3, .36, .12, hW - .38, .35 + k * .5, 1.2 + sz + i * .38, ['#c0392b', '#2457c5', '#f2c14e', '#2a9d8f', '#6b4f7a'][(i + k) % 5], { noShadow: true }); solid(hW - .6, 1 + sz, hW, 3.4 + sz);
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
  const wallZ = lvl >= 3 ? -hD - 15 : -hD - 9.6; LV.backWall = lvl >= 2 ? wallZ : null;
  if (lvl >= 2) { box(g, fx - fx0, 1.2, .25, (fx + fx0) / 2, .6, wallZ, '#f0ebe1'); box(g, fx - fx0, .05, -hD - wallZ, (fx + fx0) / 2, .03, (wallZ - hD) / 2, lvl >= 3 ? '#5f9e52' : '#6aa65a', { noShadow: true }); } // muro do fundo (para a praia) e o gramado do quintal
  box(g, .3, 1, .3, 1.6, .5, hD + 6.2, '#3a3f47'); box(g, .5, .35, .3, 1.6, 1.15, hD + 6.2, '#c0392b');
  // conquistas da história do bairro
  { const CS = $s.CR.cosm || {};
    if (CS.prancha) { const pr = new THREE.Mesh(new THREE.CapsuleGeometry(.28, 1.7, 4, 10), mat('#ff6a00')); pr.scale.z = .18; pr.position.set(hW + .35, 1.1, hD - 1.2); pr.rotation.z = .12; pr.castShadow = true; g.add(pr); }
    if (CS.fogueira) { const fx = 6, fz = -60; for (let i = 0; i < 5; i++) { const l = cyl(g, .08, .08, 1.2, fx, .15, fz, '#6b4f3a'); l.rotation.set(Math.PI / 2, i * 1.2, 0); } const fl = new THREE.Mesh(new THREE.ConeGeometry(.5, 1.2, 8), new THREE.MeshBasicMaterial({ color: '#ffb02e' })); fl.position.set(fx, .7, fz); g.add(fl); for (let i = 0; i < 4; i++) { const a = i * 1.57; fan(g, fx + Math.cos(a) * 2, fz + Math.sin(a) * 2, -a - Math.PI / 2, 1200 + i, true).position.y = -.05; } } }
  if (($s.CR.cosm || {}).mural) banner(g, nameOf($s.CR.me).split(' ')[0], -hW / 2, WH * .55, hD + .03, W * .4, WH * .7, '#ff6a00', '#ffffff', 0, 'cria do bairro · campeão do festival');
  if (($s.CR.cosm || {}).bandeira) { const bx = hW - 1.5, bz = hD + 4.2; cyl(g, .08, .1, 8, bx, 4, bz, '#cfd3d8'); cyl(g, .14, .14, .14, bx, 8.05, bz, '#ffd23f'); const fl = banner(g, 'BAIRRO', bx + 2.05, 6.8, bz, 4, 2.4, '#2a9d8f', '#ffd23f', 0, 'Copa do Bairro'); fl.userData.dyn = true; LV.flag = fl; solid(bx - .15, bz - .15, bx + .15, bz + .15); } // bandeira grande na frente, do lado da entrada
  // ---- garagem: carro, van (transporte) ----
  if (crLife('carro')) car(g, -hW - 3, hD + 3, Math.PI / 2, lvl >= 3 ? '#111214' : '#2457c5');
  if (crInv('jato') >= 1) car(g, -8, 22.2, 0, '#f2f2f2', true); else { box(g, .1, 2.4, .1, -8, 1.2, 20.2, '#3a3f47'); box(g, 1.2, .5, .06, -8, 2.4, 20.2, '#2457c5'); }
  S2('torneio', -8, 19.6, crInv('jato') >= 1 ? 'Van da equipe' : 'Ponto de táxi', 'Ir ao torneio');
  // ---- piscina (casa com piscina e mansão), atrás da casa ----
  if (lvl >= 2) {
    const pw = lvl >= 3 ? 18 : 8, pd = lvl >= 3 ? 6.5 : 4, pz = lvl >= 3 ? -hD - 7 : -hD - 4.6;
    box(g, pw + 2.4, .06, pd + 2.4, 0, .05, pz, '#e9e2d4', { noShadow: true });
    box(g, pw, .05, pd, 0, .07, pz, '#3fb6e8', { roughness: .1, metalness: .2, transparent: true, opacity: .8, ...glow('#54c8ff', .25) }); LV.pool = [-pw / 2, pz - pd / 2, pw / 2, pz + pd / 2]; // dá para entrar e nadar
    for (let i = 0; i < (lvl >= 3 ? 8 : 2); i++) { lounger(g, -pw / 2 + 1 + i * 2, pz + pd / 2 + 1.4, Math.PI, '#ffffff'); }
    umbrella(g, pw / 2 + .2, pz + pd / 2 + 1.6, '#ff6a00');
    if (lvl >= 3) { // mansão: deque grande, espreguiçadeiras dos dois lados, área gourmet, coqueiros e hidromassagem
      for (let i = 0; i < 6; i++) lounger(g, -pw / 2 + 2 + i * 2.6, pz - pd / 2 - 1.4, 0, '#f4f4f4'); umbrella(g, -pw / 2 - .4, pz + pd / 2 + 1.6, '#2457c5'); umbrella(g, 0, pz - pd / 2 - 1.8, '#ff6a00');
      cyl(g, 1.4, 1.4, .5, pw / 2 + 3.2, .25, pz - 1.5, '#e9e2d4'); cyl(g, 1.2, 1.2, .05, pw / 2 + 3.2, .5, pz - 1.5, '#7fd8ff', { transparent: true, opacity: .85 }); solid(pw / 2 + 1.8, pz - 2.9, pw / 2 + 4.6, pz - .1);
      const gx = -pw / 2 - 6.5; box(g, 7, .12, 6, gx, .06, pz, '#c9b79c'); box(g, 5, 1, .8, gx, .5, pz - 2.2, '#3a3f47'); box(g, 5.2, .08, 1, gx, 1.04, pz - 2.2, '#e9e9e9'); box(g, 7.4, .2, 6.4, gx, 3, pz, '#8a6a45'); [-1, 1].forEach(a => [-1, 1].forEach(b => cyl(g, .1, .1, 3, gx + a * 3.4, 1.5, pz + b * 3, '#8a6a45')));
      solid(gx - 2.5, pz - 2.6, gx + 2.5, pz - 1.8); for (let i = 0; i < 3; i++) chair(g, gx - 1.5 + i * 1.5, pz + 1, Math.PI); banner(g, 'Área gourmet', gx, 2.6, pz - 2.65, 3, .5, '#8a6a45', '#ffffff');
      [[-pw / 2 - 2, wallZ + 1.5], [pw / 2 + 2, wallZ + 1.5], [pw / 2 + 6, pz + 3], [-pw / 2 - 11, wallZ + 1.5]].forEach(([x, z]) => palm(g, x, z, 6)); }
    S2('piscina', pw / 2 + 1.4, pz, 'Piscina', 'Relaxar (ou entre e nade)', 1);
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
  if (crInv('ct') >= 1) { // CT: prédio com porta; dentro, quadra coberta, academia e vestiário
    const lv = crInv('ct'), tx = 70, tz = 38, W2 = 22, D2 = 14, H2 = 4.6 + lv * .5, x0 = tx - W2 / 2, x1 = tx + W2 / 2, z0 = tz - D2 / 2, z1 = tz + D2 / 2, wc2 = '#1d2a4a';
    box(g, W2, .08, D2, tx, .05, tz, '#cdb27a', { noShadow: true });
    wall(g, x0, z0, x1, z0, H2, wc2, [[tx - 1.6, tx + 1.6]], true); wall(g, x0, z1, x1, z1, H2, wc2, [], true); wall(g, x0, z0, x0, z1, H2, wc2, [], true); wall(g, x1, z0, x1, z1, H2, wc2, [], true);
    door(sp, tx - 1.6, z0, 1.6, 'x', 1, '#cfe8f5'); door(sp, tx + 1.6, z0, 1.6, 'x', -1, '#cfe8f5');
    box(g, W2 + .2, .4, .3, tx, H2, z0, '#33c3ff', glow('#33c3ff', .5));
    sign(g, ['', 'CT', 'CT de alto rendimento', 'Academia de base'][lv], nameOf($s.CR.me).split(' ')[0], tx, H2 + 1.4, z0 - .3, 5.6);
    // quadra coberta (ao longo de x) com rede de verdade
    const cxx = tx - 2.5, lc = '#ffffff'; box(g, 16, .02, 8, cxx, .1, tz, '#e6cf98', { noShadow: true }); [[16, .06, cxx, tz - 4], [16, .06, cxx, tz + 4], [.06, 8, cxx - 8, tz], [.06, 8, cxx + 8, tz]].forEach(([w, d, x, z]) => box(g, w, .02, d, x, .12, z, lc, { noShadow: true }));
    realNet(g, cxx, tz, 8, 'z', ($s.CR.master && $s.CR.master.brand) || 'CT ' + nameOf($s.CR.me).split(' ')[0], '#0b1a3a'); solid(cxx - .1, tz - 4.4, cxx + .1, tz + 4.4);
    if (lv >= 3) for (let k = 0; k < 4; k++) { const a = dyn2(sp, fan(new THREE.Group(), cxx - 5 + (k % 2) * 2, tz - 2 + Math.floor(k / 2) * 4, -Math.PI / 2, 400 + k, false)), b2 = dyn2(sp, fan(new THREE.Group(), cxx + 5 - (k % 2) * 2, tz - 2 + Math.floor(k / 2) * 4, Math.PI / 2, 410 + k, false)); a.scale.setScalar(.7); b2.scale.setScalar(.7); LV.npcs.push({ kind: 'fresco', a, b: b2, x: cxx, ph: k }); a.position.x = cxx - 4; b2.position.x = cxx + 4; } // academia de base: a garotada treinando
    gym(g, x1 - 2.2, tz - 3.5); gym(g, x1 - 2.2, tz + 1); box(g, .1, 2, 3.5, x1 - .2, 1, tz + 4.5, '#cfe8f5', { metalness: .9, roughness: .05 });
    S2('ct', x1 - 3.5, tz - 1.2, 'Centro de treinamento', 'Treino físico e técnico'); S2('ctJogo', cxx, tz + 5.2, 'Jogo-treino', 'Escolha dupla e adversários'); }
  // quiosque na praia (gastronomia 1) e projeto social
  if (crInv('gastro') >= 1) { const kx = 12, kz = lvl >= 2 ? Math.min(-26, wallZ - 5) : -26; cyl(g, 1.8, 1.8, .9, kx, .45, kz, '#a77d55'); const r = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.4, 8), mat('#e9c46a')); r.position.set(kx, 3.2, kz); r.castShadow = true; g.add(r); [0, 1, 2, 3].forEach(i => cyl(g, .07, .07, 2.4, kx + Math.cos(i * 1.57 + .78) * 1.6, 1.6, kz + Math.sin(i * 1.57 + .78) * 1.6, '#8a6a45')); solid(kx - 1.8, kz - 1.8, kx + 1.8, kz + 1.8); sign(g, 'Quiosque', nameOf($s.CR.me).split(' ')[0], kx, 4.6, kz, 3.2); }
  const sdz = lvl >= 2 ? Math.min(0, wallZ - 10 + 22) : 0; // (o projeto social fica fora do muro da casa, na areia)
  if (crLife('social')) { box(g, 8, .05, 16, -20, .05, (-22 + sdz), '#f1e2b8', { noShadow: true }); realNet(g, -20, (-22 + sdz), 8.4, 'x', 'PROJETO ' + nameOf($s.CR.me).split(' ')[0].toUpperCase(), '#2a9d8f', '#ffffff'); sign(g, 'Projeto social', 'Escolinha de beach tennis', -20, 2.6, (-31 + sdz), 4);
    banner(g, 'Projeto ' + nameOf($s.CR.me).split(' ')[0], -20, 1.2, (-30.3 + sdz), 6, 1, '#2a9d8f', '#ffffff', 0, 'beach tennis para todos'); solid(-24.2, (-22.1 + sdz), -15.8, (-21.9 + sdz));
    // crianças treinando (trocam bola dos dois lados da rede) e o professor
    for (let k = 0; k < 4; k++) { const a = dyn2(sp, fan(new THREE.Group(), -22 + (k % 2) * 4, (-25.5 + sdz), 0, 300 + k, false)), b = dyn2(sp, fan(new THREE.Group(), -22 + (k % 2) * 4, (-18.5 + sdz), Math.PI, 310 + k, false)); a.scale.setScalar(.66); b.scale.setScalar(.66); LV.npcs.push({ kind: 'kids', a, b, z0: (-25.5 + sdz), z1: (-18.5 + sdz), ph: k * 1.3 }); }
    fan(g, -15.2, (-22 + sdz), -Math.PI / 2, 333, false);
    S2('social', -14.5, (-17.5 + sdz), 'Projeto social', 'Dar aula e jogar com a garotada'); }
  if (crLife('trofeus')) { // sala de troféus ao lado da casa: um pedestal por título (os maiores no centro), luz de vitrine
    const x0 = -hW - 8.6, x1 = -hW - .2, z0 = -hD, z1 = -hD + 7.4, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    box(g, x1 - x0, .08, z1 - z0, cx, .04, cz, '#3a2a20', { noShadow: true });
    wall(g, x0, z0, x1, z0, WH, '#1d2a4a'); wall(g, x0, z0, x0, z1, WH, '#1d2a4a'); wall(g, x0, z1, x1, z1, WH, '#1d2a4a', [[cx - 1.1, cx + 1.1]]); door(sp, cx - 1.1, z1, 1.1, 'x', 1, '#5a3a28'); door(sp, cx + 1.1, z1, 1.1, 'x', -1, '#5a3a28'); wall(g, x1, z0, x1, z1, WH, '#1d2a4a', [[cz - 1, cz + 1]]); door(sp, x1, cz - 1, 2, 'z', 1, '#5a3a28');
    banner(g, 'Sala de Troféus', cx, WH - .45, z0 + .2, 5, .7, '#0b1a3a', '#e8b923');
    const L = trophyList(); L.slice(0, 18).forEach((t, i) => { const r = Math.floor(i / 6), c = i % 6, px2 = x0 + 1 + c * ((x1 - x0 - 2) / 5), pz2 = z0 + 1.6 + r * 2;
      box(g, .5, .9, .5, px2, .45, pz2, '#f2efe9'); cup(g, px2, .9, pz2, t); solid(px2 - .3, pz2 - .3, px2 + .3, pz2 + .3);
      banner(g, (TIERS[t] && TIERS[t].curto) || 'Título', px2, .55, pz2 + .26, .46, .16, '#0b1a3a', '#e8b923'); });
    for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), mat('#fff3d6', glow('#ffe1a8', 1.4))); c.position.set(x0 + 1.5 + i * (x1 - x0 - 3) / 2, WH - .2, cz); g.add(c); }
    S2('salaTrofeus', cx, z1 - 1.2, 'Sala de troféus', L.length + ' títulos', .9); }
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
  // as marcas dos seus patrocinadores nas paredes da arena (e o master em destaque na entrada)
  { const sps = (($s.CR.sponsors || []).map(x => x.brand)).concat($s.CR.master ? [$s.CR.master.brand] : []), mine = sps.length ? sps : ['Seu patrocinador aqui'];
    const cols = [['#e30613', '#ffffff'], ['#111214', '#ffd23f'], ['#1f4fb8', '#ffffff'], ['#2a9d8f', '#ffffff'], ['#ff6a00', '#111214']];
    for (let i = 0; i < 4; i++) { const b = mine[i % mine.length], c = cols[i % cols.length]; banner(g, b, ax - 9 + i * 6, 1.1, az + 7.82, 5.2, 1, c[0], c[1], Math.PI); banner(g, b, ax - 9 + i * 6, 3.2, az + 8.18, 5.2, 1, c[0], c[1]); }
    [-1, 1].forEach(sd => { const b = mine[(sd > 0 ? 1 : 0) % mine.length]; banner(g, b, ax + sd * 11.82, 1.1, az, 6, 1, '#ffffff', '#1d2a4a', -sd * Math.PI / 2); banner(g, b, ax + sd * 12.18, 2.4, az, 10, 1.6, cols[2][0], '#ffffff', sd * Math.PI / 2); });
    if ($s.CR.master) banner(g, $s.CR.master.brand, ax, 3.4, az - 8.6, 7, 1.1, '#111214', '#ffffff', Math.PI, 'patrocinador master'); }
  box(g, 8, .02, 16, ax, .08, az, '#ffffff', { noShadow: true, transparent: true, opacity: .2 });
  { const own = crInv('eventos') >= 1, nb = ($s.CR.master && $s.CR.master.brand) || (($s.CR.sponsors || [])[0] || {}).brand || (own ? 'Arena ' + nameOf($s.CR.me).split(' ')[0] : 'Arena de treino'); realNet(g, ax, az, 8, 'x', nb, own ? '#e30613' : '#1f4fb8'); } solid(ax - 4.4, az - .1, ax + 4.4, az + .1);
  { const lc = '#1f4fb8'; [[8, .06, ax, az - 8], [8, .06, ax, az + 8], [.06, 16, ax - 4, az], [.06, 16, ax + 4, az]].forEach(([w, d, x, z]) => box(g, w, .02, d, x, .09, z, lc, { noShadow: true })); }
  S2('arenaTreino', ax - 7, az - 4, 'Treinar', 'Físico e técnico'); S2('arenaDesafio', ax + 7, az - 4, 'Desafio', 'Curta, defesa, smash…'); S2('aulas', ax, az + 5.5, 'Dar aulas', 'Renda extra'); S2('arenaJogo', ax, az - 6, 'Jogo-treino', crInv('eventos') >= 1 ? 'Na sua arena, de graça' : 'Alugar a quadra e chamar quem quiser');
  // limites do bairro
  solid(-262, -97, -261, 252); solid(484, -97, 485, 252); solid(-262, 251, 485, 252);
  city(g, sp); city2(g, sp); city3(g, sp); cityExtras(g, sp); cityWide(g, sp); cityFill(g, sp);
  // pet (o cachorro passeia com você; o gato fica por perto da casa)
  // pets: o cachorro passeia com você (ou fica, se você mandar); o gato fica pela casa, andando à toa
  LV.pets = []; ['cachorro', 'gato'].forEach((kind, i) => { if (!crLife(kind)) return; const o = dyn2(sp, petMesh(kind)), x = i ? -2 : 1.5, z = i ? -1 : 3; o.position.set(x, 0, z);
    LV.pets.push({ o, kind, name: (($s.CR.pets || {})[kind]) || '', x, z, jump: 0, follow: kind === 'cachorro' && !($s.CR.petStay || {})[kind], tx: x, tz: z, wt: 0 }); });
  if ($s.CR.tour && !$s.CR.tour.pending && !$s.CR.tour.done) buildVenue(g, sp);
  // junta o cenário parado em poucos desenhos (os pontos de interação e os fãs ficam de fora)
  gndIndex(); mergeStatic(g);
  refreshMarkers();
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
  loja: { txt: () => 'Entrar na loja (Bia compra materiais)', run: () => { const M = $s.CR.mats || {}; if (Object.values(M).some(v => v > 0)) matsSell(); else LV.actions.openCareer(); } },
  praca: { txt: () => { const S3 = LV.near && LV.near.plaza, L = S3 && PRACA_LV[pracaLevel(S3, LV.near.ci || 0)]; return L ? 'Jogar com a galera' + (LV.near.multi ? ' da quadra ' + ((LV.near.ci || 0) + 1) : '') + ' (nível ' + L.n + ')' : 'Jogar'; }, run: () => { if (LV.near && LV.near.plaza) pracaPlay(LV.near.plaza, LV.near.ci || 0); } },
  npc: { txt: () => 'Conversar' + (LV.nearNpc && LV.nearNpc.name ? ' com ' + LV.nearNpc.name : ''), run: () => { if (LV.nearNpc) npcTalk(LV.nearNpc); } },
  giver: { txt: () => (LV.nearGiver ? 'Falar com ' + LV.nearGiver.name : 'Falar'), run: () => { if (!LV.nearGiver) return; missionEvent('deliver', { giver: LV.nearGiver.id }); if (!LV.modal) giverTalk(LV.nearGiver); } },
  cinema: { txt: () => 'Ver um filme no cinema de casa (+2 energia)', run: () => { const C = $s.CR, k = C.season + '-' + C.week + '-' + C.day; if (C.cineDay === k) { LV.msg('Uma sessão por dia: já assistiu hoje.'); return; } C.cineDay = k; C.energy = Math.min(100, C.energy + 2); LV.msg('🍿 ' + ['Filme de ação com pipoca', 'Revendo a sua última final', 'Documentário do circuito', 'Comédia com a família'][Math.floor(Math.random() * 4)] + ': +2 de energia.'); } },
  armario: { txt: () => 'Abrir o ' + (crInv('moradia') >= 3 ? 'closet' : 'guarda-roupa'), run: () => wardrobe() },
  social: { txt: () => (Object.values($s.CR.mats || {}).some(v => v > 0) ? 'Doar materiais para a escolinha' : 'Dar aula e jogar com a garotada'), run: () => { if (Object.values($s.CR.mats || {}).some(v => v > 0)) { matsDonate(); return; } const C = $s.CR, k = C.season + '-' + C.week; if (C.socialW === k) { LV.msg('Você já foi ao projeto esta semana. A garotada manda um abraço!'); return; } C.socialW = k; crAddFama(.8); C.energy = Math.max(0, C.energy - 3); LV.msg('🤝 Aula no projeto: as crianças jogaram com você e postaram tudo (+0,8 de fama).'); } },
  salaTrofeus: { txt: () => 'Ver a sala de troféus', run: () => { const L = trophyList(); LV.msg(L.length ? '🏆 ' + L.length + ' títulos. O maior: ' + ((TIERS[L[0]] && TIERS[L[0]].nome) || '') + ' (' + TROPHY_LOOK[L[0]] + '). Cada torneio tem o seu troféu: ' + [...new Set(L)].map(t => TIERS[t].curto + ' = ' + TROPHY_LOOK[t]).join(', ') + '.' : 'Os pedestais estão esperando o primeiro título.'); } },
  pet: { txt: () => { const P2 = LV.nearPet; if (!P2) return ''; return !P2.name ? 'Dar um nome ao ' + P2.kind : (P2.kind === 'cachorro' ? (P2.follow ? 'Brincar com ' + P2.name + ' · mandar ficar' : 'Brincar com ' + P2.name + ' · chamar') : 'Fazer carinho em ' + P2.name); }, run: () => petInteract() },
  ctJogo: { txt: () => 'Marcar um jogo-treino', run: () => friendlyPicker() },
  arenaJogo: { txt: () => crInv('eventos') >= 1 ? 'Marcar um jogo-treino na sua arena' : 'Marcar um jogo-treino ($80 a quadra)', run: () => friendlyPicker(crInv('eventos') >= 1 ? 0 : 80) },
  feira: { txt: () => 'Pastel e caldo de cana ($12)', run: () => { const C = $s.CR, k = dayKey(); if (C.feiraDay === k) { LV.msg('Já comeu na feira hoje. Volta amanhã!'); return; } C.feiraDay = k; C.money -= 12; C.energy = Math.min(100, C.energy + 3); LV.msg('🥟 Pastel de queijo e caldo de cana gelado: +3 de energia.'); } },
  coreto: { txt: () => 'Ouvir a banda no coreto', run: () => { const C = $s.CR, k = dayKey(); if (C.coretoDay === k) { LV.msg('🎺 A banda tá repetindo o repertório. Volta amanhã!'); return; } C.coretoDay = k; C.energy = Math.min(100, C.energy + 2); LV.msg('🎺 A banda tocou um chorinho e dedicou a última música a você: +2 de energia.'); } },
  sorvete: { txt: () => 'Comprar um picolé ($6)', run: () => { const C = $s.CR, k = dayKey(); if (C.sorvDay === k) { LV.msg('Um picolé por dia, atleta!'); return; } C.sorvDay = k; C.money -= 6; C.energy = Math.min(100, C.energy + 1); LV.msg('🍦 Picolé de limão: +1 de energia.'); } },
  farol: { txt: () => 'Ver o pôr do sol do mirante', run: () => { const C = $s.CR, k = dayKey(); if (C.farolDay === k) { LV.msg('🌅 O sol já se pôs por hoje.'); return; } C.farolDay = k; C.energy = Math.min(100, C.energy + 2); LV.msg('🌅 Que pôr do sol! O mar todo laranja: +2 de energia.'); } },
  jardim: { txt: () => 'Passear entre as flores', run: () => { const C = $s.CR, k = dayKey(); if (C.jardimDay === k) { LV.msg('🌺 As flores continuam lindas. Volte amanhã.'); return; } C.jardimDay = k; C.energy = Math.min(100, C.energy + 1); LV.msg('🌺 Cheiro de jasmim e silêncio: +1 de energia.'); } },
  lago: { txt: () => 'Dar pipoca aos patos', run: () => { LV.msg(pick(['🦆 Os patos fizeram fila. Um deles tentou levar o saco inteiro.', '🦆 Quá! Um pato te seguiu até a borda do lago.', '🦆 Os patos adoraram. Uma criança aplaudiu.'])); } },
  coco: { txt: () => 'Tomar água de coco ($8)', run: () => { const C = $s.CR, k = C.season + '-' + C.week + '-' + C.day; if (C.cocoDay === k) { LV.msg('Já tomou o seu coco hoje.'); return; } C.cocoDay = k; C.money -= 8; C.energy = Math.min(100, C.energy + 2); LV.msg('🥥 Água de coco geladinha: +2 de energia.'); } },
  barraca: { txt: () => 'Petisco na barraca ($25)', run: () => { const C = $s.CR, k = C.season + '-' + C.week + '-' + C.day; if (C.barDay === k) { LV.msg('O Zé já te serviu hoje.'); return; } C.barDay = k; C.money -= 25; C.energy = Math.min(100, C.energy + 3); LV.msg('🍤 Isca de peixe e suco na barraca do Zé: +3 de energia.'); } },
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
  hubOff(); LV.spots.forEach(q => { q.ring.visible = true; });
  build();
  LV.on = true; LV.saved = { mode: S.mode, pos: human.pos.clone(), sea: SEA.visible }; SEA.visible = true; // o mar da cena é o da praia do bairro
  // o resto do cenário da quadra (prédios da orla, arquibancadas, ilha) some: o bairro tem o próprio horizonte
  envHide();
  S.mode = 'livre';
  document.body.classList.remove('in-menu'); document.body.classList.add('livre');
  document.getElementById('career').hidden = true;
  [partner, cpuA, cpuB].forEach(p => { if (p) p.livreHide = true; });
  // quem anda é o seu jogador da carreira (com a roupa, o rosto e a raquete dele), não o último boneco da partida rápida
  LV.savedPick = Object.assign({}, S.settings.pick); LV.savedRacket = S.settings.racket;
  crSyncChars(); S.settings.pick = Object.assign({}, S.settings.pick, { me: 'crme' }); S.settings.racket = $s.CR.racket; assignCharacters(); applyRackets(); applyPlayerStyle(); // (sem reaplicar o estilo, o boneco novo ficava invisível)
  human.pos.copy(P(0, 1.5)); human.vel.set(0, 0, 0); human.feet = null; LV.camYaw = 0; LV.camPitch = .9; LV.zoom = 9;
  // volta para onde você estava (sair e entrar no mundo aberto não te leva de volta para casa)
  const sv = $s.CR.livrePos, t = $s.CR.tour, tourOn = t && !t.pending && !t.done, tKey = tourOn ? String(t.name) : '';
  const slept = sv && sv.day && sv.day !== dayKey() && !LV.keepPos; LV.keepPos = false;
  const back = sv && !slept && (sv.tour || '') === tKey && !blocked(sv.x, sv.z, .2) && sv.x > -258 && sv.x < 482 && sv.z > -95 && sv.z < 248;
  LV.snap = true; hud(true);
  if (back) { human.pos.copy(P(sv.x, sv.z)); LV.yaw = sv.yaw || 0; LV.camYaw = sv.camYaw || 0; LV.camPitch = sv.camPitch || .9; LV.zoom = sv.zoom || 9;
    if (sv.ride && sv.ride !== 'pe' && rides().includes(sv.ride)) { LV.ride = sv.ride; LV.rideMesh = rideMesh(LV.ride); scene.add(LV.rideMesh); human.model.group.visible = LV.ride !== 'carro'; }
    LV.msg('De volta ao bairro. WASD anda, Shift corre, E interage, Esc volta.'); }
  else if (slept && !tourOn) { const bd = LV.spots.find(q => q.id === 'cama'); if (bd) human.pos.copy(P(bd.x + .9, bd.z + .9)); LV.camPitch = 1.1; LV.zoom = 7; LV.msg('☀️ Bom dia! Um novo dia começou: você acordou em casa.'); }
  else { LV.msg('Bem-vindo em casa. WASD para andar, Shift corre, E interage, Esc volta.'); if (tourOn) goVenue(); } // torneio novo em andamento: começa no local do torneio
}
function goVenue() { build(); LV.snap = true; human.pos.copy(P(VX, VZ + 34)); human.vel.set(0, 0, 0); human.feet = null; LV.yaw = 0; LV.camYaw = 0; LV.camPitch = .7; LV.zoom = 11; LV.where = '';
  LV.msg(LV.myCourt ? 'Você chegou ao ' + String($s.CR.tour.name).replace(/ · .*$/, '') + '. Sua partida (' + LV.myCourt.round + ') é na ' + LV.myCourt.name + ': siga a seta verde.' : 'Você chegou ao local do torneio.'); }
function goHome() { LV.snap = true; human.pos.copy(P(0, 1.5)); human.vel.set(0, 0, 0); human.feet = null; LV.camYaw = 0; LV.camPitch = .9; LV.zoom = 9; LV.where = ''; LV.msg('De volta para casa.'); }
function exit(toCareer = true) {
  if (!LV.on) return;
  { const t = $s.CR && $s.CR.tour; if ($s.CR) $s.CR.livrePos = { x: +(human.pos.x - H0.x).toFixed(2), z: +(human.pos.z - H0.z).toFixed(2), yaw: LV.yaw || 0, camYaw: LV.camYaw || 0, camPitch: LV.camPitch, zoom: LV.zoom, ride: LV.ride || 'pe', day: dayKey(), tour: t && !t.pending && !t.done ? String(t.name) : '' }; }
  LV.on = false; human.ride = null; LV.jy = 0; LV.jv = 0; LV.trick = null; LV.lastEn = LV.lastMo = null; if (LV.rideMesh) { scene.remove(LV.rideMesh); LV.rideMesh = null; } LV.ride = 'pe'; human.model.group.visible = true; human.liftY = 0; if (LV.saved) SEA.visible = LV.saved.sea; envShow(); if (LV.bag) LV.bag.visible = false; S.mode = 'menu'; document.body.classList.remove('livre');
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
  const RV = ({ pe: 1, skate: 1.45, bike: 2.1, carro: 3.4 }[LV.ride || 'pe'] || 1) * (LV.ride === 'skate' ? (LV.skK ?? 1) : 1), vmax = (run ? 5.2 : 1.9) * (LV.swim ? .5 : LV.ride && LV.ride !== 'pe' ? RV * (run ? 1 : 2) : 1), acc = il > .05 ? (LV.ride === 'carro' ? 4 : 9) : 12;
  LV.vel.x += (tx * vmax - LV.vel.x) * Math.min(1, dt * acc); LV.vel.z += (tz * vmax - LV.vel.z) * Math.min(1, dt * acc);
  human.vel.set(LV.vel.x, 0, LV.vel.z); if (LV.ride && LV.ride !== 'pe') human.vel.set(0, 0, 0); // em cima do skate/bike: o corpo não caminha
  human.pos.x += LV.vel.x * dt; human.pos.z += LV.vel.z * dt;
  // colisão com as paredes e móveis (círculo contra caixas)
  const lx = human.pos.x - H0.x, lz = human.pos.z - H0.z, R = .32; let px = lx, pz = lz;
  for (const [x0, z0, x1, z1] of LV.boxes) { const cx = Math.max(x0, Math.min(px, x1)), cz = Math.max(z0, Math.min(pz, z1)), dx = px - cx, dz = pz - cz, d = Math.hypot(dx, dz);
    if (d < R) { if (d > 1e-4) { px = cx + dx / d * R; pz = cz + dz / d * R; } else { px += R; } } }
  if (LV.ride === 'carro' && LV.roadR.length) { const d0 = roadDist(lx - LV.vel.x * dt, lz - LV.vel.z * dt), d1 = roadDist(px, pz); // o carro não sai da rua (fora dela, só volta para a rua)
    if (d1 > .6 && d1 > d0 - 1e-4) { px = lx - LV.vel.x * dt; pz = lz - LV.vel.z * dt; LV.vel.x *= -.2; LV.vel.z *= -.2; if (!LV.roadMsgT || LV.roadMsgT < performance.now()) { LV.roadMsgT = performance.now() + 4000; LV.msg('🚗 O carro só anda na rua.'); } } }
  if (LV.ride && LV.ride !== 'pe') { const wet = (x, z) => z < -86.5 || (LV.pool && x > LV.pool[0] - .3 && x < LV.pool[2] + .3 && z > LV.pool[1] - .3 && z < LV.pool[3] + .3);
    if (wet(px, pz) && !wet(lx - LV.vel.x * dt, lz - LV.vel.z * dt)) { px = lx - LV.vel.x * dt; pz = lz - LV.vel.z * dt; LV.vel.set(0, 0, 0); if (!LV.wetMsgT || LV.wetMsgT < performance.now()) { LV.wetMsgT = performance.now() + 4000; LV.msg('🌊 Desça do ' + ({ skate: 'skate', bike: 'bike', carro: 'carro' }[LV.ride]) + ' (V) para entrar na água.'); } } }
  human.pos.x = H0.x + px; human.pos.z = H0.z + pz; LV.gy = LV.swim ? 0 : groundY(px, pz);
  // para onde o corpo olha: para onde anda
  const sp = Math.hypot(LV.vel.x, LV.vel.z);
  if (sp > .3) { const want = Math.atan2(-LV.vel.x, -LV.vel.z); let d = want - LV.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); LV.yaw += d * Math.min(1, dt * 10); }
  human.forceYaw = LV.ride === 'skate' ? LV.yaw + Math.PI / 2 : LV.yaw; // skate: de lado na prancha
  // ponto de interação mais perto
  let near = null, nd = 9;
  for (const s of LV.spots) { const d = Math.hypot(px - s.x, pz - s.z); s.ring.material.opacity = d < s.r ? .95 : .45; if (d < s.r && d < nd) { nd = d; near = s; } }
  // fãs: andando devagar, e o mais perto vira ponto de interação
  let nf = null, nfd = 1.6;
  (LV.fans || []).forEach(f => { if (f.walk) { f.a += dt * .25; f.o.position.x = f.x + Math.cos(f.a) * 3; f.o.position.z = f.z + Math.sin(f.a) * 3; f.o.rotation.y = -f.a; }
    const d = Math.hypot(px - f.o.position.x, pz - f.o.position.z); if (!f.done && d < nfd) { nfd = d; nf = f; }
    if (d < 4 && !f.walk) f.o.rotation.y += (Math.atan2(px - f.o.position.x, pz - f.o.position.z) - f.o.rotation.y) * Math.min(1, dt * 3); });
  LV.nearFan = nf; if (nf && !near) near = { id: 'fa' };
  npcTick(dt, px, pz); if (LV.flag) LV.flag.rotation.y = Math.sin(performance.now() / 650) * .14; // a bandeira balança com o vento
  // gente com quem dá para conversar (quem passa) e os moradores que dão missões
  LV.nearNpc = null; LV.nearGiver = null;
  if (!near && !LV.modal) { let bd = 1.6; for (const G of LV.givers || []) { const d = Math.hypot(px - G.x, pz - G.z); if (d < bd) { bd = d; LV.nearGiver = G; } }
    if (LV.nearGiver) near = { id: 'giver' };
    else { let nd2 = 1.5; for (const n of LV.npcs || []) { if (n.kind !== 'walk') continue; const d = Math.hypot(px - n.o.position.x, pz - n.o.position.z); if (d < nd2) { nd2 = d; LV.nearNpc = n; } } if (LV.nearNpc) near = { id: 'npc' }; } }
  (LV.givers || []).forEach(G => { if (G.mk.visible) G.mk.position.y = 2.45 + Math.sin(performance.now() / 300) * .08; const d = Math.hypot(px - G.x, pz - G.z); if (d < 6) G.o.rotation.y = Math.atan2(px - G.x, pz - G.z); });
  if (LV.swim && pz < -87) missionEvent('swim', { dt });
  for (const pl of LV.plazas || []) if (Math.abs(px - pl.x) < pl.w / 2 && Math.abs(pz - pl.z) < pl.d / 2) { if (LV.inPlaza !== pl.id) { LV.inPlaza = pl.id; missionEvent('visit', { id: pl.id }); } break; } else if (LV.inPlaza === pl.id) LV.inPlaza = null;
  for (const D of LV.doors || []) { const want = Math.hypot(px - D.cx, pz - D.cz) < 2.3 || (LV.pets || []).some(q => Math.hypot(q.x - D.cx, q.z - D.cz) < 1.2) ? 1 : 0; D.open += (want - D.open) * Math.min(1, dt * 5); D.piv.rotation.y = -D.sign * D.open * 1.6; }
  // pets: o cachorro segue a uns 1,5 m (se não mandou ficar); o gato passeia pela casa e pelo quintal. Na água eles nadam
  LV.nearPet = null;
  for (const P2 of LV.pets || []) {
    let tx2, tz2;
    if (P2.follow) { tx2 = px; tz2 = pz; }
    else { P2.wt -= dt; if (P2.wt <= 0) { P2.wt = 3 + Math.random() * 5; const hm = P2.kind === 'gato'; P2.tx = (P2.home || 0) + (Math.random() - .5) * (hm ? 10 : 3); P2.tz = (Math.random() - .5) * (hm ? 8 : 3) + (P2.stayZ || 0); if (!hm && P2.stayX != null) P2.tx = P2.stayX + (Math.random() - .5) * 2; } tx2 = P2.tx; tz2 = P2.tz; }
    const d = Math.hypot(tx2 - P2.x, tz2 - P2.z), keep = P2.follow ? 1.6 : .2, moving = d > keep;
    if (moving) { const sp2 = Math.min(d - keep, (P2.follow ? (d > 8 ? 9 : 4.2) : 1.2) * dt); P2.x += (tx2 - P2.x) / d * sp2; P2.z += (tz2 - P2.z) / d * sp2; const want = Math.atan2(-(tx2 - P2.x), -(tz2 - P2.z)); let dy = want - P2.o.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); P2.o.rotation.y += dy * Math.min(1, dt * 8); }
    if (P2.follow && d > 40) { P2.x = px + 1; P2.z = pz + 1; }
    const pl = LV.pool, wet = (pl && P2.x > pl[0] && P2.x < pl[2] && P2.z > pl[1] && P2.z < pl[3]) || P2.z < -87, tt = performance.now() / 1000;
    P2.jump = Math.max(0, P2.jump - dt * 1.5);
    P2.o.position.set(P2.x, wet ? -.33 + Math.sin(tt * 3) * .02 : Math.abs(Math.sin(P2.jump * 9)) * .25 * P2.jump, P2.z); P2.o.rotation.x = wet ? -.25 : 0;
    P2.o.userData.legs.forEach((l, i) => { l.rotation.x = wet ? Math.sin(tt * 9 + i * 1.6) * .9 : moving ? Math.sin(tt * 12 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * .5 : 0; }); // nadando: patinha; andando: passos
    P2.o.userData.tail.rotation.z = Math.sin(tt * 11) * (P2.kind === 'gato' ? .25 : .6);
    if (!near && Math.hypot(px - P2.x, pz - P2.z) < 1.4) { near = { id: 'pet' }; LV.nearPet = P2; }
  }
  // nadar: na piscina ou no mar (onde não dá pé, o corpo afunda até o peito)
  { const pl = LV.pool, inPool = pl && px > pl[0] && px < pl[2] && pz > pl[1] && pz < pl[3], sea = Math.max(0, Math.min(1, (-86 - pz) / 6));
    const want = inPool || sea > .5 ? 0 : sea > 0 ? -.6 * sea : 0; human.liftY = (human.liftY || 0) + (want - (human.liftY || 0)) * Math.min(1, dt * 5); LV.swim = inPool || sea > .5; }
  if (LV.arrow) { LV.arrow.rotation.y += dt * 2; LV.arrow.position.y = 4.2 + Math.sin(performance.now() / 300) * .25; }
  if ((near && near.id) !== (LV.near && LV.near.id)) { LV.near = near; prompt(); } else LV.near = near;
  LV.spots.forEach(s => { const d = Math.hypot(px - s.x, pz - s.z); s.label.visible = d < 16; });
  // nome do lugar onde está
  { const [hw, hd] = LV.house || [6, 5], where = px > -hw && px < hw && pz > -hd && pz < hd ? 'Casa de ' + nameOf($s.CR.me).split(' ')[0] : crLife('trofeus') && px > -hw - 8.6 && px < -hw && pz > -hd && pz < -hd + 7.4 ? 'Sala de troféus' : LV.swim ? 'Nadando' : px > hw && px < hw + 16 && pz > -10 && pz < 12 ? 'Quintal' : pz < -hd && pz > -hd - 10 && px > -15 && px < 15 ? 'Área da piscina' : LV.inPlaza ? ((LV.plazas || []).find(q => q.id === LV.inPlaza) || {}).name : px > VX - 53 && px < VX + 53 && pz > VZ - 51 && pz < VZ + 45 ? ($s.CR.tour && !$s.CR.tour.pending && !$s.CR.tour.done ? String($s.CR.tour.name).replace(/ · .*$/, '') : 'Quadras da Orla') : pz < -12 ? 'Praia' : pz > 30 && px > 92 ? 'Comércio' : px > 33 && px < 59 && pz > 29 && pz < 47 ? 'Arena de treino' : px > 61 && px < 90 && pz > 29 ? 'Centro de treinamento' : pz > 17 && pz < 28 ? 'Rua da praia' : 'Bairro';
    if (where !== LV.where) { LV.where = where; const e = document.querySelector('#livreHud .lv-where'); if (e) e.textContent = where; } }
  // bússola para a sua quadra (no painel de cima): direção em relação à câmera e distância
  { const cp = document.getElementById('livreGo'); if (cp) { const mc = LV.myCourt && LV.nearVenue !== false ? LV.myCourt : null; cp.hidden = !mc;
    if (mc) { const dx = mc.x - px, dz = mc.z - pz, d = Math.hypot(dx, dz); camera.getWorldDirection(_v); const ang = Math.atan2(dx * _v.z - dz * _v.x, dx * _v.x + dz * _v.z);
      cp.querySelector('i').style.transform = 'rotate(' + (-ang * 180 / Math.PI - 90).toFixed(0) + 'deg)'; cp.querySelector('b').textContent = d < 4 ? 'Você chegou' : Math.round(d) + ' m'; } } }
  LV.mmT = (LV.mmT || 0) - dt; if (LV.mmT <= 0) { LV.mmT = .2; try { minimap(); } catch (e) {} }
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
  if (human.model) human.model.group.visible = LV.ride !== 'carro'; if (human.model && human.model.armR) { human.model.armR.el.visible = true; human.model.armL.el.visible = true; }
  if (human.skin) human.skin.racket.visible = false; if (human.model && human.model.racket) human.model.racket.visible = false;
  { const bc = ($s.CR.cosm && $s.CR.cosm.bagOuro && $s.CR.bagGold !== false) ? ['#c9a227', '#111214'] : crBagCols() || bagOfRacket();
    const stk = Object.keys($s.CR.cosm || {}).filter(k => STICKERS[k]); if (!LV.bag || LV.bagKey !== bc.join() + stk.join()) { if (LV.bag) scene.remove(LV.bag); LV.bag = racketBag(bc); stickBag(LV.bag, stk); LV.bagKey = bc.join() + stk.join(); scene.add(LV.bag); }
    LV.bag.visible = LV.ride !== 'carro'; const hk = ((human.char && human.char.alt) || 180) / 180;
    { const sp2 = human.model && human.model.spine; // presa na coluna: acompanha o corpo agachado no skate, inclinado na bike, pulando…
      if (sp2) { sp2.updateWorldMatrix(true, false); _bagV.set(0, .1, LV.bagOff + .02); sp2.localToWorld(_bagV); LV.bag.position.copy(_bagV); sp2.matrixWorld.decompose(_bagP, _bagQ, _bagS); LV.bag.quaternion.copy(_bagQ); if (_bagS.x < 0) LV.bag.rotateY(0); LV.bag.rotateX(-.06); }
      else { const fx = -Math.sin(LV.yaw), fz = -Math.cos(LV.yaw); LV.bag.position.set(human.pos.x - fx * LV.bagOff, 1.1 * hk, human.pos.z - fz * LV.bagOff); LV.bag.rotation.set(0, LV.yaw, 0); } }
    LV.bag.scale.setScalar(.72 * hk); } // em pé nas costas, encostada
  // pulo (Espaço): a pé, de skate (às vezes sai uma manobra) e de bike (bunny hop); de carro não
  const RK = LV.ride || 'pe', run = !!k.shift, sp = Math.hypot(LV.vel.x, LV.vel.z), il = (k.w || k.a || k.s || k.d || k.arrowup || k.arrowdown || k.arrowleft || k.arrowright || LV.joy) ? 1 : 0, vmax = (run ? 5.2 : 3.8) * ({ skate: 1.45, bike: 2.1 }[RK] || 1);
  LV.jy = LV.jy || 0; LV.jv = LV.jv || 0;
  if (k[' '] && !LV.jHeld && LV.jy <= 0 && RK !== 'carro' && !LV.swim) { LV.jHeld = true;
    if (RK === 'pe') { human.jump = .55; human.jumpDur = .55; human.jumpH = .42; }
    else { LV.jv = RK === 'skate' ? 4.6 : 4.1; LV.jy = .001; LV.trick = null;
      if (RK === 'skate' && sp > 1 && Math.random() < .6) { LV.trick = ['kickflip', 'shove-it', 'heelflip', '360 flip', 'pop shove-it'][Math.floor(Math.random() * 5)]; LV.msg('🛹 ' + LV.trick + '!'); }
      else if (RK === 'skate') LV.trick = 'ollie'; } }
  if (!k[' ']) LV.jHeld = false;
  if (LV.jy > 0) { LV.jv -= 13 * dt; LV.jy += LV.jv * dt; if (LV.jy <= 0) { LV.jy = 0; LV.jv = 0; LV.trick = null; } }
  const airT = LV.jy > 0 ? Math.min(1, LV.jy / .5) : 0, tAir = LV.jv ? 1 - (LV.jv + 4.6) / 9.2 : 0; // (0 → 1 do salto até o pouso)
  // veículos animados: rodas girando, pedalada no ritmo da velocidade, inclinação nas curvas, prancha girando nas manobras
  const yawRate = ((LV.yaw - (LV.lastYaw ?? LV.yaw) + Math.PI * 3) % (Math.PI * 2) - Math.PI) / Math.max(dt, 1e-3); LV.lastYaw = LV.yaw;
  LV.leanS = (LV.leanS || 0) + (Math.max(-1, Math.min(1, yawRate * sp * .08)) - (LV.leanS || 0)) * Math.min(1, dt * 6);
  if (RK === 'bike' || RK === 'skate') { const R2 = human.ride || (human.ride = { k: RK, ph: 0, t: 0, push: 0, air: 0, lean: 0 }); R2.k = RK; R2.t += dt;
    if (RK === 'skate') { // remada: um pé vai ao chão e empurra (1 a 2 vezes) para ganhar embalo; depois desliza perdendo velocidade aos poucos
      LV.skK = LV.skK ?? 1;
      const start = il > .05 && !R2.wasIn; R2.wasIn = il > .05;
      if (!R2.pushing && il > .05 && LV.jy <= 0 && (start || sp < 2 || LV.skK < .8)) { R2.pushing = true; R2.ph = 0; R2.strokes = start || sp < 2 ? 2 : 1; }
      if (R2.pushing) { R2.ph += dt * 7; LV.skK = Math.min(1, LV.skK + dt * .45); if (R2.ph >= Math.PI * 2 * R2.strokes || LV.jy > 0) { R2.pushing = false; R2.ph = 0; } }
      else LV.skK = Math.max(.62, LV.skK - dt * (il > .05 ? .12 : .25));
      R2.push += ((R2.pushing ? 1 : 0) - R2.push) * Math.min(1, dt * 9); }
    else R2.ph += dt * sp * 2.6; R2.air = airT; R2.lean = LV.leanS; R2.stand = RK === 'bike' && run && il > .05 ? 1 : 0; }
  else if (LV.swim) { const R2 = human.ride && human.ride.k === 'swim' ? human.ride : (human.ride = { k: 'swim', ph: 0, t: 0, push: 0, air: 0, lean: 0 }); R2.ph += dt * (1.6 + sp * 2.2); R2.t += dt; }
  else human.ride = null;
  if (LV.rideMesh) { const RM = LV.rideMesh; RM.position.set(human.pos.x, (LV.gy || 0) + LV.jy, human.pos.z); RM.rotation.set(0, LV.yaw, 0);
    (RM.userData.wheels || []).forEach(w => { w.rotation.x -= sp * dt / (w.userData.r || .3); }); if (RM.userData.crank && human.ride) RM.userData.crank.rotation.x = -human.ride.ph; // (pedivela no mesmo giro dos pés)
    if (RK === 'bike') { RM.rotateZ(-LV.leanS * .35); if (LV.jy > 0) RM.rotateX(Math.max(0, LV.jv) * .06); } // bunny hop: a frente sobe primeiro
    if (RK === 'skate') { RM.rotateZ(-LV.leanS * .12);
      if (LV.trick && LV.jy > 0) { const u = Math.max(0, Math.min(1, tAir)), T = LV.trick, e = u * u * (3 - 2 * u);
        if (T === 'ollie') RM.rotateX(Math.sin(u * Math.PI) * .35); else if (T === 'kickflip') RM.rotateZ(e * Math.PI * 2); else if (T === 'heelflip') RM.rotateZ(-e * Math.PI * 2);
        else if (T === 'shove-it') RM.rotateY(e * Math.PI); else if (T === 'pop shove-it') { RM.rotateY(e * Math.PI); RM.rotateX(Math.sin(u * Math.PI) * .3); } else { RM.rotateY(e * Math.PI * 2); RM.rotateZ(e * Math.PI * 2); }
        RM.position.y += Math.sin(u * Math.PI) * .12; } } }
  // nadando: o corpo deita na água (as pernas batem e os braços giram como no crawl) e a raqueteira fica guardada
  if (LV.swim) { LV.bag.visible = false; swimPose(); }
  human.liftY = (LV.gy || 0) + (LV.ride === 'skate' ? .1 : 0) + (LV.jy || 0);
  return true;
}

// caixinha para digitar um nome (pet, look) na própria tela
function askName(title, def, cb) {
  let el = document.getElementById('livreFriendly'); if (!el) { el = document.createElement('div'); el.id = 'livreFriendly'; el.className = 'overlay'; document.body.appendChild(el); }
  el.innerHTML = '<div class="card lv-fr"><h3>' + title + '</h3><input type="text" maxlength="20" class="lv-name" value="' + String(def || '').replace(/"/g, '') + '"><div class="cta-row"><button type="button" class="cta" data-ok>OK</button><button type="button" class="ghost" data-x>Cancelar</button></div></div>';
  el.hidden = false; LV.modal = true; const inp = el.querySelector('input'); setTimeout(() => { inp.focus(); inp.select(); }, 30);
  const done = v => { el.hidden = true; LV.modal = false; if (v != null) cb(v.trim()); };
  el.querySelector('[data-ok]').onclick = () => done(inp.value); el.querySelector('[data-x]').onclick = () => done(null);
  inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') done(inp.value); if (e.key === 'Escape') done(null); };
}
// guarda-roupa / closet: até 5 looks salvos (roupa, acessórios, cabelo…) e atalho para editar o visual
function wardrobe() {
  const C = $s.CR; C.looks = C.looks || [];
  let el = document.getElementById('livreFriendly'); if (!el) { el = document.createElement('div'); el.id = 'livreFriendly'; el.className = 'overlay'; document.body.appendChild(el); }
  const slot = i => { const L = C.looks[i]; return '<div class="lv-look"><b>' + (L ? (L.name || 'Look ' + (i + 1)).replace(/</g, '') : 'Vazio') + '</b><span>' + (L ? '<button type="button" class="cta sm" data-wear="' + i + '">Vestir</button>' : '') + '<button type="button" class="ghost sm" data-save="' + i + '">' + (L ? 'Substituir' : 'Salvar o atual') + '</button>' + (L ? '<button type="button" class="ghost sm" data-del="' + i + '">Apagar</button>' : '') + '</span></div>'; };
  el.innerHTML = '<div class="card lv-fr"><div class="eyebrow">' + (crInv('moradia') >= 3 ? 'Closet' : 'Guarda-roupa') + '</div><h3>Seus looks</h3><p class="cr-note">Guarde até 5 combinações de roupa e visual para trocar quando quiser.</p>' + [0, 1, 2, 3, 4].map(slot).join('')
    + '<div class="cta-row"><button type="button" class="ghost" data-edit>Editar visual</button><button type="button" class="ghost" data-shop>Comprar roupas</button><button type="button" class="ghost" data-x>Fechar</button></div></div>';
  el.hidden = false; LV.modal = true;
  const close = () => { el.hidden = true; LV.modal = false; };
  el.querySelector('[data-x]').onclick = close;
  el.querySelector('[data-edit]').onclick = () => { close(); if (LV.actions.editLook) LV.actions.editLook(); };
  el.querySelector('[data-shop]').onclick = () => { close(); if (LV.actions.shopClothes) LV.actions.shopClothes(); };
  el.querySelectorAll('[data-save]').forEach(b => b.onclick = () => { const i = +b.dataset.save; askName('Nome do look', (C.looks[i] && C.looks[i].name) || 'Look ' + (i + 1), v => {
    const lk = JSON.parse(JSON.stringify(C.me.look || {})); delete lk.racket; C.looks[i] = { name: (v || 'Look ' + (i + 1)).slice(0, 20), look: lk }; saveCareer(); wardrobe(); }); });
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { C.looks[+b.dataset.del] = null; saveCareer(); wardrobe(); });
  el.querySelectorAll('[data-wear]').forEach(b => b.onclick = () => { const L = C.looks[+b.dataset.wear]; if (!L) return; C.me.look = Object.assign(JSON.parse(JSON.stringify(L.look)), { racket: C.racket });
    saveCareer(); crSyncChars(); assignCharacters(); applyRackets(); applyPlayerStyle(); close(); LV.msg('👕 Look "' + L.name + '" no corpo.'); });
}
// pet: cachorro ou gato (comprados em Negócios); segue você pelo bairro; o nome é você quem dá
function petMesh(kind) {
  const o = new THREE.Group(), cat = kind === 'gato', c = cat ? '#d9822b' : '#8a5a3c', k = cat ? .7 : 1;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.14 * k, .38 * k, 4, 10), mat(c)); body.rotation.x = Math.PI / 2; body.position.y = .32 * k; o.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.13 * k, 12, 10), mat(c)); head.position.set(0, .48 * k, -.3 * k); o.add(head);
  const snout = new THREE.Mesh(new THREE.SphereGeometry(.06 * k, 8, 8), mat(cat ? '#f2d2b0' : '#5a3a28')); snout.position.set(0, .45 * k, -.42 * k); o.add(snout);
  [-1, 1].forEach(sd => { const e = new THREE.Mesh(new THREE.ConeGeometry(.05 * k, .12 * k, 4), mat(cat ? c : '#5a3a28')); e.position.set(sd * .07 * k, .6 * k, -.28 * k); e.rotation.z = sd * (cat ? -.2 : .6); o.add(e); });
  o.userData.legs = []; [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(.035 * k, .035 * k, .26 * k, 6), mat(c)); l.geometry.translate(0, -.13 * k, 0); l.position.set(a * .08 * k, .26 * k, b * .17 * k); o.add(l); o.userData.legs.push(l); });
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(.02 * k, .03 * k, .3 * k, 6), mat(c)); tail.position.set(0, .45 * k, .3 * k); tail.rotation.x = -.8; o.add(tail); o.userData.tail = tail;
  o.traverse(m => { if (m.isMesh) m.castShadow = true; }); return o;
}
function petInteract() {
  const P2 = LV.nearPet; if (!P2) return; const C = $s.CR; C.pets = C.pets || {}; C.petStay = C.petStay || {};
  if (!P2.name) { askName('Nome do seu ' + P2.kind, '', nm => { if (!nm) return; nm = nm.slice(0, 16); C.pets[P2.kind] = nm; P2.name = nm; saveCareer(); LV.msg('🐾 Agora se chama ' + nm + '!'); }); return; }
  let el = document.getElementById('livreFriendly'); if (!el) { el = document.createElement('div'); el.id = 'livreFriendly'; el.className = 'overlay'; document.body.appendChild(el); }
  const dog = P2.kind === 'cachorro';
  el.innerHTML = '<div class="card lv-fr"><div class="eyebrow">' + (dog ? '🐕' : '🐈') + ' ' + P2.name.replace(/</g, '') + '</div><div class="cta-row"><button type="button" class="cta" data-a="play">' + (dog ? 'Brincar' : 'Fazer carinho') + '</button>'
    + (dog ? '<button type="button" class="ghost" data-a="stay">' + (P2.follow ? 'Fica aqui' : 'Vem comigo') + '</button>' : '') + '<button type="button" class="ghost" data-a="name">Trocar o nome</button><button type="button" class="ghost" data-a="x">Fechar</button></div></div>';
  el.hidden = false; LV.modal = true; const close = () => { el.hidden = true; LV.modal = false; };
  el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { const a = b.dataset.a; close();
    if (a === 'play') { const k = C.season + '-' + C.week + '-' + C.day + P2.kind; if (C.petDay === k) { LV.msg('🐾 ' + P2.name + ' já brincou bastante hoje e está cochilando.'); return; } C.petDay = k; C.energy = Math.min(100, C.energy + 1); P2.jump = 1; LV.msg('🐾 Você brincou com ' + P2.name + '. Que alegria! (+1 de energia)'); }
    else if (a === 'stay') { P2.follow = !P2.follow; C.petStay[P2.kind] = !P2.follow; if (!P2.follow) { P2.stayX = P2.x; P2.stayZ = P2.z; P2.home = P2.x; P2.wt = 0; } LV.msg(P2.follow ? '🐕 ' + P2.name + ' vem com você.' : '🐕 ' + P2.name + ' fica aqui esperando.'); saveCareer(); }
    else if (a === 'name') askName('Novo nome', P2.name, nm => { if (!nm) return; C.pets[P2.kind] = nm.slice(0, 16); P2.name = C.pets[P2.kind]; saveCareer(); }); });
}
// jogo-treino: escolhe a dupla e os dois adversários (gente perto do seu nível, a sua dupla e os seus rivais)
function friendlyPicker(fee = 0) {
  const C = $s.CR, me = crMeOvr(), fem = !!C.me.fem;
  const pool = crWorld().filter(c => c.id !== 'crme' && !!c.fem === fem).map(c => ({ c, o: crCharOvr(c) })).sort((a, b) => Math.abs(a.o - me) - Math.abs(b.o - me)).slice(0, 24).sort((a, b) => b.o - a.o);
  const top = []; const add = id => { const c = id && crChar(id); if (c && !top.some(x => x.c.id === c.id)) top.push({ c, o: crCharOvr(c), tag: id === C.partner ? 'sua dupla' : 'rival' }); };
  add(C.partner); Object.keys(C.rivals || {}).slice(0, 3).forEach(add);
  const L = top.concat(pool.filter(x => !top.some(t => t.c.id === x.c.id)));
  const opt = sel => L.map(x => '<option value="' + x.c.id + '"' + (x.c.id === sel ? ' selected' : '') + '>' + nameOf(x.c).replace(/</g, '') + ' · OVR ' + x.o + (x.tag ? ' (' + x.tag + ')' : '') + '</option>').join('');
  let el = document.getElementById('livreFriendly'); if (!el) { el = document.createElement('div'); el.id = 'livreFriendly'; el.className = 'overlay'; document.body.appendChild(el); }
  const d = [C.partner || (L[0] && L[0].c.id), L[1] && L[1].c.id, L[2] && L[2].c.id];
  el.innerHTML = '<div class="card lv-fr"><div class="eyebrow">Jogo-treino' + (fee ? ' · quadra $' + fee : '') + '</div><h3>Monte o jogo</h3><p class="cr-note">Não vale ranking. Conta como o treino do dia (evolução e cansaço de treino).</p>'
    + '<label>Sua dupla<select data-k="mate">' + opt(d[0]) + '</select></label><label>Adversário 1<select data-k="o1">' + opt(d[1]) + '</select></label><label>Adversário 2<select data-k="o2">' + opt(d[2]) + '</select></label>'
    + '<p class="lv-fr-err" hidden></p><div class="cta-row"><button type="button" class="cta" data-go>Jogar</button><button type="button" class="ghost" data-x>Cancelar</button></div></div>';
  el.hidden = false; LV.modal = true;
  el.querySelector('[data-x]').onclick = () => { el.hidden = true; LV.modal = false; };
  el.querySelector('[data-go]').onclick = () => { const v = {}; el.querySelectorAll('select').forEach(x => { v[x.dataset.k] = x.value; });
    if (new Set([v.mate, v.o1, v.o2]).size < 3) { const e = el.querySelector('.lv-fr-err'); e.hidden = false; e.textContent = 'Escolha três pessoas diferentes.'; return; }
    el.hidden = true; LV.modal = false; if (fee) C.money -= fee; if (LV.actions.friendly) LV.actions.friendly(v); };
}
const _qs = new THREE.Quaternion(), _qf = new THREE.Quaternion(), _ax = new THREE.Vector3(1, 0, 0), _ay = new THREE.Vector3(0, 1, 0);
function swimPose() {
  const m = human.model; if (!m) return; const t = performance.now() / 1000, fx = -Math.sin(LV.yaw), fz = -Math.cos(LV.yaw);
  _qs.setFromAxisAngle(_ax, -1.42 + Math.sin(t * 3) * .05); const roll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(t * 2.4) * .25);
  const y = .02 + Math.sin(t * 3) * .02, bx = human.pos.x - fx * .85, bz = human.pos.z - fz * .85;
  m.group.quaternion.setFromAxisAngle(_ay, LV.yaw).multiply(_qs).multiply(roll); m.group.position.set(bx, y, bz);
  const k = human.skin; if (k && human.skinOn) { _qf.setFromAxisAngle(_ay, k.faceFix || 0); k.holder.quaternion.copy(m.group.quaternion).multiply(_qf); k.holder.position.set(bx, y, bz); k.racket.visible = false; }
}
// jeito de andar: a pé, skate, bicicleta ou carro (os que você comprou em Negócios); tecla V troca
function rides() { return ['pe'].concat(crLife('skate') ? ['skate'] : [], crLife('bike') ? ['bike'] : [], crLife('carro') ? ['carro'] : []); }
function cycleRide() {
  const L = rides(); if (L.length < 2) { LV.msg('Compre skate, bicicleta ou carro em Negócios para andar mais rápido (tecla V troca).'); return; }
  const [hw, hd] = LV.house || [6, 5], lx = human.pos.x - H0.x, lz = human.pos.z - H0.z; if (lx > -hw && lx < hw && lz > -hd && lz < hd) { LV.msg('Dentro de casa, só a pé.'); return; } if (LV.swim || lz < -86.5) { LV.msg('Na água, só nadando.'); return; }
  LV.ride = L[(L.indexOf(LV.ride || 'pe') + 1) % L.length];
  if (LV.rideMesh) { scene.remove(LV.rideMesh); LV.rideMesh = null; }
  if (LV.ride !== 'pe') { LV.rideMesh = rideMesh(LV.ride); scene.add(LV.rideMesh); }
  human.model.group.visible = LV.ride !== 'carro';
  LV.msg({ pe: '🚶 A pé.', skate: '🛹 De skate.', bike: '🚲 De bicicleta.', carro: '🚗 De carro (Shift acelera).' }[LV.ride]);
}
function rideMesh(kind) {
  const o = new THREE.Group();
  o.userData.wheels = [];
  if (kind === 'skate') { box(o, .22, .03, .8, 0, .09, 0, '#1d1d20'); box(o, .2, .005, .74, 0, .107, 0, '#e63946'); [-1, 1].forEach(b => box(o, .17, .03, .05, 0, .06, b * .28, '#b8bec6'));
    [-1, 1].forEach(a => [-1, 1].forEach(b => { const w = new THREE.Group(); w.position.set(a * .08, .035, b * .28); const c = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .04, 10), mat('#f2c14e')); c.rotation.z = Math.PI / 2; w.add(c); w.userData.r = .035; o.add(w); o.userData.wheels.push(w); })); }
  else if (kind === 'bike') { [-1, 1].forEach(b => { const w = new THREE.Group(); w.position.set(0, .35, b * .55); const t2 = new THREE.Mesh(new THREE.TorusGeometry(.33, .025, 8, 22), mat('#151515')); t2.rotation.y = Math.PI / 2; w.add(t2);
      for (let i = 0; i < 6; i++) { const sk = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .64, 4), mat('#cfd3d8')); sk.rotation.x = i * Math.PI / 6; w.add(sk); } w.userData.r = .35; o.add(w); o.userData.wheels.push(w); });
    const cr = new THREE.Group(); cr.position.set(0, .35, -.04); [-1, 1].forEach(sd => { const arm = box(cr, .02, .17, .03, sd * .07, 0, 0, '#3a3f47'); arm.position.y = sd * .085; box(cr, .1, .02, .05, sd * .12, sd * .17, 0, '#1d1d20'); }); cr.userData.r = .35 / 2.6 * 1.0; o.add(cr); o.userData.crank = cr;
    const fr = (l, x, y, z, rx) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, l, 6), mat('#e30613', { metalness: .5 })); m.position.set(x, y, z); m.rotation.x = rx; o.add(m); };
    fr(.75, 0, .55, 0, Math.PI / 2); fr(.5, 0, .55, .3, .5); fr(.5, 0, .55, -.3, -.4); box(o, .16, .05, .26, 0, .85, .15, '#111'); box(o, .5, .03, .03, 0, 1, -.5, '#3a3f47'); }
  else { car(o, 0, 0, Math.PI / 2, ($s.CR && crInv('moradia') >= 3) ? '#111214' : '#2457c5'); LV.boxes.pop(); }
  o.traverse(m => { if (m.isMesh) m.castShadow = true; }); return o;
}

// ---------- cena da entrevista (coletiva) ----------
// montada dentro da quadra da arena (base), com a rede e a arquibancada em volta
// longe de tudo: painel com as marcas (patrocinadores, master e o torneio), repórter com microfone, cinegrafista e flashes;
// a câmera alterna entre quem pergunta e você respondendo
const PR = { on: false, g: null, base: new THREE.Vector3(2.6, 0, 6.2), shot: 'ask', t: 0, flash: null, saved: null };
function pressBuild(T) {
  if (PR.g) { scene.remove(PR.g); PR.g.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  const g = new THREE.Group(); g.position.copy(PR.base); scene.add(g); PR.g = g;
  const C = $s.CR, brands = [].concat(C.master ? [C.master.brand] : [], (C.sponsors || []).map(x => x.brand), C.tour ? [String(C.tour.name).replace(/ · .*$/, '')] : [], [T.outlet || 'Beach Tennis']).filter(Boolean);
  const tex = canvasTex(1024, 512, (x, W, H) => { x.fillStyle = '#f4f6fb'; x.fillRect(0, 0, W, H); x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { const b = brands[(r * 2 + c) % brands.length], cols = ['#0b1a3a', '#e30613', '#1f4fb8', '#ff6a00', '#0a7d3c'];
      x.fillStyle = cols[(r + c) % cols.length]; x.font = '900 italic 42px Barlow Condensed, Arial Narrow, Arial'; x.fillText(String(b).toUpperCase(), (c + .5 + (r % 2) * .5) * W / 5, (r + .5) * H / 5, W / 5.4); } }, true);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.2), new THREE.MeshStandardMaterial({ map: tex, roughness: .8 })); wall.position.set(0, 1.6, -1.3); g.add(wall);
  box(g, 6.6, .12, .12, 0, 3.22, -1.32, '#2b2d31'); box(g, 6, .02, 5, 0, .01, .8, '#1d2a4a', { noShadow: true });
  // repórter (com microfone) e cinegrafista
  const rep = fan(g, 1.05, 1.15, -2.4, 7, false); const mic = new THREE.Group(); cyl(mic, .018, .022, .26, 0, 0, 0, '#111'); const head = new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 8), mat('#2b2b2b', { roughness: .4 })); head.position.y = .15; mic.add(head);
  box(mic, .07, .05, .07, 0, .06, 0, ['#e30613', '#1f4fb8', '#ff6a00'][(T.rep || '').length % 3]); mic.position.set(.55, 1.32, .8); mic.rotation.set(.3, 0, .9); g.add(mic);
  const cam = fan(g, -1.9, 3.1, Math.PI * .85, 21, false); box(cam, .22, .2, .5, -.28, 1.55, -.15, '#1d1d20'); cyl(cam, .07, .07, .14, -.28, 1.55, -.45, '#111').rotation.x = Math.PI / 2;
  // luz de vídeo e flash dos fotógrafos
  const key = new THREE.PointLight(0xfff2dd, 1.4, 9); key.position.set(-.8, 2.2, 2.4); g.add(key);
  PR.flash = new THREE.PointLight(0xffffff, 0, 8); PR.flash.position.set(1.6, 2, 2.6); g.add(PR.flash);
}
function pressOn(T) {
  if (!$s.CR || LV.on) return;
  if (HB.on) { hubOff(); PR.backToHub = true; }
  if (!PR.on) {
    PR.saved = { mode: S.mode, pos: human.pos.clone(), pick: Object.assign({}, S.settings.pick), racket: S.settings.racket, menu: document.body.classList.contains('in-menu') };
    crSyncChars(); S.settings.pick = Object.assign({}, S.settings.pick, { me: 'crme' }); S.settings.racket = $s.CR.racket; assignCharacters(); applyRackets(); applyPlayerStyle();
    S.mode = 'press'; PR.on = true; document.body.classList.add('press'); document.body.classList.remove('in-menu'); document.getElementById('career').hidden = true;
    [partner, cpuA, cpuB].forEach(p => { if (p) p.livreHide = true; });
  }
  if (PR.T !== T) { PR.T = T; pressBuild(T); PR.shot = 'ask'; PR.t = 0; PR.cut = true; }
  human.pos.copy(PR.base); human.vel.set(0, 0, 0); human.feet = null; human.forceYaw = Math.PI; human.liftY = 0;
}
function pressOff() {
  if (!PR.on) return; PR.on = false; PR.T = null; const sv = PR.saved;
  document.body.classList.remove('press'); if (PR.g) PR.g.visible = false;
  [partner, cpuA, cpuB].forEach(p => { if (p) { p.livreHide = false; if (p.model) p.model.group.visible = true; } });
  human.forceYaw = null;
  if (sv) { S.settings.pick = sv.pick; S.settings.racket = sv.racket; assignCharacters(); applyRackets(); applyPlayerStyle(); human.pos.copy(sv.pos); S.mode = sv.mode === 'press' ? 'menu' : sv.mode; if (sv.menu) document.body.classList.add('in-menu'); }
  if ($s.CR) document.getElementById('career').hidden = false;
  if (PR.backToHub) { PR.backToHub = false; setTimeout(() => { if (LV.actions.render) LV.actions.render(); }, 0); }
}
function pressCam(dt) {
  if (S.mode !== 'press' || !PR.on) return false;
  if (PR.g) PR.g.visible = true;
  [partner, cpuA, cpuB].forEach(p => { if (p && p.model) { p.model.group.visible = false; if (p.skin) { p.skin.holder.visible = false; p.skin.racket.visible = false; } } });
  if (human.skin) human.skin.racket.visible = false; if (human.model && human.model.racket) human.model.racket.visible = false;
  human.pos.copy(PR.base); human.forceYaw = Math.PI;
  PR.t += dt; const b = PR.base, k = 1 - Math.exp(-dt * 2.2), drift = Math.sin(PR.t * .25) * .15;
  if (PR.shot === 'answer') { _v.set(b.x + .5 + drift, 1.62, b.z + 3.1); _w.set(b.x + .15, 1.5, b.z); } else { _v.set(b.x + 2.1 + drift, 1.7, b.z + 3.4); _w.set(b.x + .35, 1.45, b.z); }
  const cut = PR.cut; PR.cut = false; // troca de plano: corte seco, como na TV
  camera.position.lerp(_v, cut ? 1 : k); PR.look = cut || !PR.look ? _w.clone() : PR.look.lerp(_w, k); camera.lookAt(PR.look);
  if (camera.fov !== 40) { camera.fov = 40; camera.updateProjectionMatrix(); }
  if (PR.flash) PR.flash.intensity = Math.random() < dt * .9 ? 6 : Math.max(0, PR.flash.intensity - dt * 30);
  sun.target.position.copy(b); sun.position.copy(b).addScaledVector(SUN_DIR, 40);
  return true;
}
HIST.pressOn = pressOn; HIST.pressOff = pressOff; HIST.pressShot = s2 => { if (PR.shot !== s2) PR.cut = true; PR.shot = s2; };


// ---------- cena da tela de início da carreira (o seu jogador em casa, ao fundo da tela) ----------
const HB = { on: false, saved: null, t: 0 };
function hubOn() {
  if (!$s.CR || LV.on || PR.on || S.careerActive) return;
  if (!HB.on) {
    HB.saved = { mode: S.mode, pos: human.pos.clone(), pick: Object.assign({}, S.settings.pick), racket: S.settings.racket, sea: SEA.visible };
    build(); crSyncChars(); S.settings.pick = Object.assign({}, S.settings.pick, { me: 'crme' }); S.settings.racket = $s.CR.racket; assignCharacters(); applyRackets(); applyPlayerStyle();
    envHide(); SEA.visible = true;
    S.mode = 'hub'; HB.on = true; HB.t = 0; [partner, cpuA, cpuB].forEach(p => { if (p) p.livreHide = true; });
  }
  const [hw, hd] = LV.house || [6, 5]; human.pos.copy(P(-2.6, hd + 3.4)); human.vel.set(0, 0, 0); human.feet = null; human.forceYaw = Math.PI * .94; human.liftY = 0; // no jardim da frente, de frente para a câmera (a casa ao fundo)
}
function hubOff(keepPick) { // keepPick: a partida da carreira já escolheu os bonecos (não devolve os da partida rápida)
  if (!HB.on) return; HB.on = false; const sv = HB.saved;
  [partner, cpuA, cpuB].forEach(p => { if (p) { p.livreHide = false; if (p.model) p.model.group.visible = true; } });
  envShow(); human.forceYaw = null;
  // keepPick: depois da partida da carreira volta o boneco da partida rápida (guardado em CR.prev)
  if (sv) { SEA.visible = sv.sea; if (!keepPick) { S.settings.pick = sv.pick; S.settings.racket = sv.racket; assignCharacters(); applyRackets(); applyPlayerStyle(); } else if ($s.CR && $s.CR.prev) { $s.CR.prev.pick = sv.pick; $s.CR.prev.racket = sv.racket; } human.pos.copy(sv.pos); if (S.mode === 'hub') S.mode = sv.mode === 'hub' ? 'menu' : sv.mode; }
}
S.hubOff = hubOff;
function hubCam(dt) {
  if (S.mode !== 'hub' || !HB.on) return false;
  const cr = document.getElementById('career'); if (!cr || cr.hidden || S.careerActive) { hubOff(); return false; } // saiu da carreira: volta ao normal
  [partner, cpuA, cpuB].forEach(p => { if (p && p.model) { p.model.group.visible = false; if (p.skin) { p.skin.holder.visible = false; p.skin.racket.visible = false; } } });
  if (human.skin) human.skin.racket.visible = false; if (human.model && human.model.racket) human.model.racket.visible = false;
  HB.t += dt; const h = human.pos, sway = Math.sin(HB.t * .15) * .25, wide = innerWidth / Math.max(1, innerHeight) > 1.2;
  LV.spots.forEach(q => { q.label.visible = false; q.ring.visible = false; }); // sem as placas dos lugares
  // o jogador fica à direita da tela (o texto do início ocupa a esquerda); a câmera respira devagar
  _v.set(h.x - (wide ? 2 : .4) + sway, 1.45, h.z + 5.8); _w.set(h.x - (wide ? 2.3 : .2), 1.15, h.z);
  const k = HB.t < .1 ? 1 : 1 - Math.exp(-dt * 3); camera.position.lerp(_v, k); HB.look = HB.t < .1 || !HB.look ? _w.clone() : HB.look.lerp(_w, k); camera.lookAt(HB.look);
  if (camera.fov !== 42) { camera.fov = 42; camera.updateProjectionMatrix(); }
  sun.target.position.copy(h); sun.position.copy(h).addScaledVector(SUN_DIR, 40);
  if (LV.bag) LV.bag.visible = false;
  return true;
}

// ---------- minimapa (canto da tela): ruas, praças, você, quem tem missão (★ história, ! do dia) e onde levar cada coisa ----------
const MM = { x0: -62, x1: 300, z0: -100, z1: 255, big: false, t: 0 };
function missionTargets() {
  const C = $s.CR, out = []; if (!C) return out;
  const spotXY = id => { const q = LV.spots.find(s2 => s2.id === id); return q ? [q.x, q.z] : null; }, giverXY = id => { const G = GIVERS.find(q => q.id === id); return G ? [G.x, G.z] : null; }, plazaXY = id => { const q = (LV.plazas || []).find(p2 => p2.id === id); return q ? [q.x, q.z] : null; };
  for (const m of C.missions || []) { const st = !!m.story; let pts = [];
    if (m.type === 'deliver') pts = [m.target.giver ? giverXY(m.target.giver) : spotXY(m.target.spot)];
    else if (m.type === 'visit1') pts = [plazaXY(m.place)];
    else if (m.type === 'visit') pts = (LV.plazas || []).filter(q => !(m.seen || []).includes(q.id)).map(q => [q.x, q.z]);
    else if (m.type === 'praca' || m.type === 'pracaLvl' || /^ch/.test(m.type)) pts = LV.spots.filter(q => q.id === 'praca').map(q => [q.x, q.z]);
    else if (m.type === 'swim') pts = [[60, -92]];
    else if (m.type === 'train') pts = [[46, 34]];
    else if (m.type === 'pay') pts = [giverXY(m.giver)];
    pts.filter(Boolean).forEach(p2 => out.push({ x: p2[0], z: p2[1], st, dl: m.type === 'deliver' }));
  }
  return out;
}
function minimap() {
  // o mapa gira com a câmera: para cima é para onde a câmera olha, a direita da tela é a sua direita (pequeno: ~180 m em volta; grande: a cidade toda)
  let cv = document.getElementById('livreMap');
  if (!cv) { cv = document.createElement('canvas'); cv.id = 'livreMap'; cv.title = 'Clique para aumentar ou diminuir'; cv.addEventListener('click', () => { MM.big = !MM.big; cv.classList.toggle('big', MM.big); minimap(); }); document.getElementById('livreHud').appendChild(cv); }
  const W = MM.big ? 480 : 210, H = MM.big ? 480 : 210, dpr = Math.min(2, devicePixelRatio || 1);
  if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
  const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
  const px = human.pos.x - H0.x, pz = human.pos.z - H0.z, cy = LV.camYaw || 0, fx = -Math.sin(cy), fz = -Math.cos(cy), rx = Math.cos(cy), rz = -Math.sin(cy);
  const cxw = MM.big ? 112 : px, czw = MM.big ? 78 : pz, sc = MM.big ? W / 760 : W / 180; // grande: centrado na cidade
  const T = (wx, wz) => { const dx = wx - cxw, dz = wz - czw; return [W / 2 + (dx * rx + dz * rz) * sc, H / 2 - (dx * fx + dz * fz) * sc]; };
  const poly = (x0, z0, x1, z1, c) => { const a = [T(x0, z0), T(x1, z0), T(x1, z1), T(x0, z1)]; x.beginPath(); x.moveTo(a[0][0], a[0][1]); for (let i = 1; i < 4; i++) x.lineTo(a[i][0], a[i][1]); x.closePath(); x.fillStyle = c; x.fill(); };
  x.fillStyle = '#e8dcbc'; x.fillRect(0, 0, W, H);
  poly(-2000, -2000, 2000, -87, '#4aa8d8'); poly(-2000, -87, 2000, 12, '#f3ead2');
  [24, 64, 124, 192].forEach(z => poly(-260, z - 4, 482, z + 4, '#5b6170')); [-165, 385].forEach(vx => poly(vx - 4, 24, vx + 4, 192, '#5b6170'));
  (LV.xRoads || []).forEach(([vx, a, b]) => poly(vx - 4, a, vx + 4, b, '#5b6170'));
  [[-55, 24, 192], [25, 24, 64], [88, 24, 192], [290, 128, 188]].forEach(([vx, a, b]) => poly(vx - 4, a, vx + 4, b, '#5b6170'));
  (LV.plazas || []).forEach(q => poly(q.x - q.w / 2, q.z - q.d / 2, q.x + q.w / 2, q.z + q.d / 2, '#8cc47a'));
  poly(22, 75, 62, 105, '#8cc47a'); poly(VX - 52, VZ - 50, VX + 52, VZ + 44, $s.CR.tour && !$s.CR.tour.pending && !$s.CR.tour.done ? '#ffb02e' : '#d7c9a0');
  poly(46, 152, 70, 172, '#f2e6c9'); poly(155, 147, 209, 173, '#e9b872'); [[-38, 214, 20, 12], [120, 214, 18, 12], [262, 214, 22, 12]].forEach(([a, b, w, d]) => poly(a - w / 2, b - d / 2, a + w / 2, b + d / 2, '#b9bec6'));
  (LV.lots || []).forEach(([a, b, w, d, k]) => poly(a - w / 2, b - d / 2, a + w / 2, b + d / 2, k === 's' ? '#e3b5a0' : k === 'a' ? '#b9bec6' : '#d6c3a5'));
  const [hw, hd] = LV.house || [6, 5]; poly(-hw - 1, -hd - 1, hw + 1, hd + 1, '#c0392b'); poly(34, 30, 58, 46, '#2457c5'); if (crInv('ct') >= 1) poly(59, 31, 81, 45, '#1d2a4a');
  MM.t += .15; const pulse = 3 + Math.sin(MM.t) * 1.2;
  const edge = ([sx, sy]) => [Math.max(8, Math.min(W - 8, sx)), Math.max(8, Math.min(H - 8, sy))]; // fora do mapa pequeno: fica na borda, apontando o caminho
  const star = (sx, sy, r) => { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; x.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); } x.closePath(); x.fillStyle = '#b44dff'; x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.stroke(); };
  for (const t of missionTargets()) { const [sx, sy] = edge(T(t.x, t.z)); if (t.dl) { star(sx, sy, (MM.big ? 9 : 7) + pulse * .4); continue; } x.beginPath(); x.arc(sx, sy, pulse + (MM.big ? 3 : 1), 0, Math.PI * 2); x.fillStyle = t.st ? 'rgba(255,210,63,.9)' : 'rgba(255,255,255,.9)'; x.fill(); x.strokeStyle = '#04122e'; x.lineWidth = 1.5; x.stroke(); }
  const C = $s.CR, open = storyOpen(), side = (C.missions || []).filter(m => !m.story);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  for (const G of GIVERS) { const st = open.some(n => n.giver === G.id && !(C.missions || []).some(m => m.story === n.id)), sd = !side.some(m => m.giver === G.id) && side.length < 3 && (C.giverDay || {})[G.id] !== dayKey(); if (!st && !sd) continue;
    const [sx, sy] = T(G.x, G.z); if (!MM.big && (sx < 0 || sy < 0 || sx > W || sy > H)) continue;
    x.font = '900 ' + (MM.big ? 18 : 13) + 'px Arial'; x.lineWidth = 3; x.strokeStyle = '#04122e'; x.strokeText(st ? '★' : '!', sx, sy); x.fillStyle = st ? '#ffd23f' : '#ffffff'; x.fillText(st ? '★' : '!', sx, sy); }
  if (MM.big) { x.font = '700 11px Arial'; x.fillStyle = '#04122e'; const lbl = (t, wx, wz) => { const [sx, sy] = T(wx, wz); x.fillText(t, sx, sy); };
    (LV.plazas || []).forEach(q => lbl(q.name.replace('Praça ', ''), q.x, q.z)); lbl('Casa', 0, -8); lbl('Arena', 46, 48); lbl('Escola', 58, 162); lbl('Feira', 182, 160); lbl('Praia', 120, -40); }
  // você: seta para onde o corpo anda (relativa à câmera)
  const [mx, my] = T(px, pz), wf = [-Math.sin(LV.yaw), -Math.cos(LV.yaw)], ang = Math.atan2(wf[0] * rx + wf[1] * rz, wf[0] * fx + wf[1] * fz);
  x.save(); x.translate(mx, my); x.rotate(ang);
  x.beginPath(); x.moveTo(0, -7); x.lineTo(5, 6); x.lineTo(0, 3); x.lineTo(-5, 6); x.closePath(); x.fillStyle = '#33c3ff'; x.fill(); x.strokeStyle = '#04122e'; x.lineWidth = 1.5; x.stroke(); x.restore();
  // norte (o mar fica ao sul): uma letra N na borda indica para onde fica o lado da cidade
  { const nx = -fx * 0 + 0, ang2 = Math.atan2(rz, fz); const r2 = W / 2 - 10; x.font = '900 12px Arial'; x.fillStyle = '#c0392b'; x.fillText('N', W / 2 + Math.sin(-ang2) * r2 * 0 + (0 * rx + 1 * rz) * r2, H / 2 - (0 * fx + 1 * fz) * r2); }
}

// ---------- interface ----------
function hud(on) {
  let el = document.getElementById('livreHud');
  if (!el) {
    el = document.createElement('div'); el.id = 'livreHud';
    el.innerHTML = '<div class="lv-top"><div class="lv-stat"><div class="lv-cal"><small></small><b></b><span></span></div><div class="lv-info"><b class="lv-where"></b><div class="lv-week"></div><div class="lv-next"></div></div><div id="livreGo" class="lv-go" hidden title="Direção da sua quadra"><i>➤</i><small>sua quadra</small><b></b></div></div>'
      + '<div class="lv-res"><div class="lv-k lv-en" title="Energia"><span class="lv-ico">⚡</span><span class="lv-bar"><i></i></span><b></b><em class="lv-dl"></em></div><div class="lv-k lv-mo" title="Dinheiro"><span class="lv-ico">💰</span><b></b><em class="lv-dl"></em></div></div>'
      + '<div class="lv-btns"><button type="button" class="ghost sm" id="livreMis" title="Missões (M)">📋 <span></span></button><button type="button" class="ghost sm" id="livreCfg" title="Configurações">⚙️</button><button type="button" class="ghost sm" id="livreExit">Voltar à carreira (Esc)</button></div></div>'
      + '<div id="livrePrompt" class="lv-prompt" hidden><kbd>E</kbd><span></span></div><div id="livreMsg" class="lv-msg" hidden></div>'
      + '<div class="lv-help">WASD: andar · Shift: correr · E: interagir · V: skate/bike/carro · M: missões · arrastar: girar · rodinha: zoom · clique da rodinha arrastando: girar e inclinar · Z/X: zoom · T/G: inclinação</div>'
      + '<div class="lv-joy" id="livreJoy"><i></i></div><button type="button" class="lv-act" id="livreAct">E</button>';
    document.body.appendChild(el);
    el.querySelector('#livreExit').addEventListener('click', () => exit(true));
    el.querySelector('#livreMis').addEventListener('click', () => missionsPanel());
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
  { const b = el.querySelector('#livreMis span'); if (b) { const nM = (C.missions || []).length; b.textContent = nM === 1 ? '1 missão' : nM ? nM + ' missões' : 'Missões'; } }
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
const DAY_ACTS = new Set(['praca', 'social', 'ctJogo', 'arenaJogo', 'orla', 'cama', 'piscina', 'gelo', 'quadraTreino', 'quadraDesafio', 'arenaTreino', 'arenaDesafio', 'aulas', 'academia', 'ct', 'podcast']);
function interact() {
  const s = LV.near, a = s && ACT[s.id]; if (!a || !$s.CR) return;
  if (DAY_ACTS.has(s.id) && crTourDay()) { LV.msg('🏆 Hoje é dia de torneio: treino, aulas e descanso ficam para depois. Vá ao local do torneio (táxi/van na rua).'); return; }
  if (s.id !== 'giver') missionEvent('deliver', { spot: s.id }); // entregas: chegar no lugar já entrega
  const before = $s.CR.lastMsg; a.run(); saveCareer();
  if (['arenaTreino', 'ct', 'quadraTreino', 'academia'].includes(s.id) && $s.CR.lastMsg !== before && !/Lesionado|torneio|insuficiente/i.test($s.CR.lastMsg || '')) missionEvent('train', {});
  if (!LV.on) return; // a ação saiu do modo livre (carreira, desafio)
  if ($s.CR.lastMsg && $s.CR.lastMsg !== before) LV.msg($s.CR.lastMsg);
  hud(true); prompt();
  if (($s.CR.talks || []).length && LV.actions.talk) LV.actions.talk();
}

// teclado e mouse (só no modo livre)
addEventListener('keydown', e => {
  if (!LV.on) return; const k = e.key.toLowerCase();
  if (LV.modal) { if (k === 'escape') { const f = document.getElementById('livreFriendly'); if (f) f.hidden = true; LV.modal = false; } return; }
  const mo = document.getElementById('menu'); if (mo && !mo.hidden) { if (k === 'escape') { mo.hidden = true; e.preventDefault(); } return; } // configurações abertas por cima: teclas são do menu
  e.stopPropagation(); // as teclas do modo livre (V, E, Z/X, T/G…) não vão para os atalhos da partida (o V liga a mira lá)
  if (k === 'escape') { exit(true); return; }
  if (k === 'e' && !e.repeat) { interact(); e.preventDefault(); return; }
  if (k === 'v' && !e.repeat) { cycleRide(); e.preventDefault(); return; }
  if (k === 'm' && !e.repeat) { missionsPanel(); e.preventDefault(); return; }
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

if (typeof window !== 'undefined') window.__pdoLivre = { LV, enter, exit, tick, interact, P, H0, FAN_LINES, missionEvent };
export { racketBag, LV as LIVRE, enter as livreEnter, exit as livreExit, tick as livreTick, cam as livreCam, pressCam, hubCam, hubOn, hubOff };
