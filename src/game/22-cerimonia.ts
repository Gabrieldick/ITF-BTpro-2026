// @ts-nocheck
// cerimônia de título: pódio, troféu, foto, cheque e entrevista — mais elementos quanto maior o título; qualquer tecla,
// clique ou toque pula. Roda entre o último ponto e a tela do fim (S.mode 'ceremony')
import * as THREE from 'three';
import { $s } from '../state';
import { clamp, lerp, nameOf, shortOf } from './00-base';
import { S } from './01-estado';
import { camera, mat, scene } from './02-render';
import { cheerArena, confetti } from './03-cenario';
import { ball } from './07-glb';
import { sndHit } from './08-audio';
import { showOver } from './09-interface';
import { TIERS, crTourT } from './14-carreira';
import { money } from './15-carreira-telas';

const CER = { on: false, t: 0, imp: 0, end: 6, g: null, cup: null, ui: null, stages: {}, info: null, flashT: -1, camPos: new THREE.Vector3(), camLook: new THREE.Vector3() };
const POD = { x: 0, z: 2.6, h1: .55, h2: .35 }; // pódio no seu lado da quadra, de frente para a câmera
function cupMesh() {
  const g = new THREE.Group(), gold = mat('#e8b84a', { metalness: .85, roughness: .25, emissive: new THREE.Color('#5a4010'), emissiveIntensity: .35 });
  const prof = [[.0, 0], [.11, 0], [.11, .03], [.05, .05], [.035, .16], [.04, .2], [.11, .26], [.15, .38], [.16, .5], [.0, .5]].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), gold); g.add(body);
  [-1, 1].forEach(s => { const h = new THREE.Mesh(new THREE.TorusGeometry(.07, .012, 8, 16, Math.PI * 1.2), gold); h.position.set(s * .16, .38, 0); h.rotation.z = s > 0 ? -Math.PI * .6 : Math.PI * 1.6; g.add(h); });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.12, .14, .08, 20), mat('#2b1d14', { roughness: .5 })); base.position.y = -.04; g.add(base);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); g.scale.setScalar(1.35);
  return g;
}
function podium() {
  const g = new THREE.Group();
  const blk = (w, h, x, c, label) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, .9), mat(c, { roughness: .6 })); m.position.set(x, h / 2, 0); m.castShadow = m.receiveShadow = true; g.add(m);
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const x2 = cv.getContext('2d'); x2.fillStyle = '#ffffff'; x2.font = '900 46px Arial Black, Arial'; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillText(label, 64, 34);
    const t = new THREE.CanvasTexture(cv); const lb = new THREE.Mesh(new THREE.PlaneGeometry(.5, .25), new THREE.MeshBasicMaterial({ map: t, transparent: true })); lb.position.set(x, h * .55, .456); g.add(lb); };
  blk(1.5, POD.h1, 0, '#f4f1ea', '1');
  blk(1.4, POD.h2, 1.6, '#cfd4da', '2');
  g.position.set(POD.x, 0, POD.z); // a frente do pódio (com os números) fica virada para a câmera, atrás do seu fundo
  return g;
}
// importância: amador 1–2, estaduais 3, BT10–BT100 3–5, BT200/BT400 6–7, Sand Series 8, Mundial 9; campeonato local 5
function importance() {
  if (S.careerActive && $s.CR && $s.CR.tour) { const t = $s.CR.tour; return t.special === 'estadual' ? 3 : clamp(t.tier, 0, 9); }
  return 5;
}
const QUOTES = [
  'Foi uma semana muito dura, mas a gente acreditou até o último ponto.',
  'Quero agradecer a minha dupla, a equipe e todo mundo que veio torcer.',
  'Esse título é para a minha família. Trabalhamos muito para chegar aqui.',
  'A defesa fez a diferença hoje. Quando apertou, a gente não deu ponto de graça.',
  'Ainda tem muita temporada pela frente, mas hoje é dia de comemorar.',
];
function ui() {
  let u = document.getElementById('ceremony');
  if (!u) { u = document.createElement('div'); u.id = 'ceremony'; u.innerHTML = '<div class="cer-top"><span class="cer-eb"></span><b class="cer-title"></b></div><div class="cer-check" hidden></div><div class="cer-int" hidden><span class="cer-mic">🎙️</span><div><small class="cer-q"></small><b class="cer-a"></b></div></div><div class="cer-flash"></div><div class="cer-skip">Pressione qualquer tecla para pular</div>'; document.body.appendChild(u); }
  return u;
}
function startCeremony() {
  const imp = importance(), team = $s.teams[0], opp = $s.teams[1];
  CER.on = true; CER.t = 0; CER.imp = imp; CER.stages = {}; CER.flashT = -1;
  // duração: título pequeno ~6 s; com cheque ~8; com entrevista ~11,5; Sand Series / Mundial ~13 com fogos
  CER.end = imp >= 8 ? 13 : imp >= 6 ? 11.5 : imp >= 3 ? 8.2 : 6.2;
  let name = 'Campeonato', prize = 0;
  if (S.careerActive && $s.CR && $s.CR.tour) { const t = $s.CR.tour, T = crTourT(t); name = (t.special ? T.nome : t.name) || T.nome; prize = (T.prize && T.prize[0]) || 0; }
  CER.info = { name, prize, team: team.map(p => shortOf(p.char || {})), partner: team[1] && team[1].char ? nameOf(team[1].char) : '' };
  CER.g = podium(); scene.add(CER.g); CER.cup = cupMesh(); CER.cup.visible = false; scene.add(CER.cup);
  // vencedores no 1º lugar, vice no 2º; todos virados para a câmera
  team.forEach((p, i) => { p.pos.set(POD.x + (team.length > 1 ? (i ? .35 : -.35) : 0), 0, POD.z); p.liftY = POD.h1; p.forceYaw = 0; p.vel.set(0, 0, 0); });
  opp.forEach((p, i) => { p.pos.set(POD.x + 1.6 + (opp.length > 1 ? (i ? .33 : -.33) : 0), 0, POD.z); p.liftY = POD.h2; p.forceYaw = 0; p.vel.set(0, 0, 0); });
  S.celebrate = { team: 0, t: .2, title: true, hold: true };
  ball.state = 'dead'; ball.pos.set(0, -5, 0); ball.vel.set(0, 0, 0);
  S.mode = 'ceremony';
  document.body.classList.add('cer');
  const u = ui(); u.classList.add('show'); u.querySelector('.cer-eb').textContent = (imp >= 9 ? 'CAMPEÕES DO MUNDO' : 'CAMPEÕES') + ' · ' + name.toUpperCase();
  u.querySelector('.cer-title').textContent = CER.info.team.join(' / ').toUpperCase();
  u.querySelector('.cer-check').hidden = true; u.querySelector('.cer-int').hidden = true;
  confetti(); cheerArena(4);
  addEventListener('keydown', skipKey, true); u.addEventListener('pointerdown', endCeremony);
}
function skipKey(e) { e.preventDefault(); e.stopPropagation(); endCeremony(); }
function endCeremony() {
  if (!CER.on) return; CER.on = false;
  removeEventListener('keydown', skipKey, true);
  document.body.classList.remove('cer');
  const u = ui(); u.classList.remove('show'); u.removeEventListener('pointerdown', endCeremony);
  if (CER.g) { scene.remove(CER.g); CER.g = null; } if (CER.cup) { scene.remove(CER.cup); CER.cup = null; }
  $s.players.forEach(p => { p.liftY = 0; p.forceYaw = null; });
  S.celebrate = null; S.ceremonyDone = true; S.mode = 'dead';
  showOver();
}
function stage(k, at, fn) { if (!CER.stages[k] && CER.t >= at) { CER.stages[k] = true; fn(); } }
// a cada quadro (depois da física): segura todo mundo no pódio e avança o roteiro
function ceremonyTick(dt) {
  if (!CER.on) return;
  CER.t += dt; const t = CER.t, imp = CER.imp, team = $s.teams[0], u = ui();
  $s.players.forEach(p => { p.vel.set(0, 0, 0); p.swing.t = -1; p.charging = false; });
  team.forEach((p, i) => p.pos.set(POD.x + (team.length > 1 ? (i ? .35 : -.35) : 0), 0, POD.z));
  $s.teams[1].forEach((p, i) => p.pos.set(POD.x + 1.6 + ($s.teams[1].length > 1 ? (i ? .33 : -.33) : 0), 0, POD.z));
  // troféu: aparece na frente da dupla, sobe para as mãos e é erguido (braços para cima)
  stage('cup', 1.2, () => { CER.cup.visible = true; sndHit(.2); });
  if (CER.cup && CER.cup.visible) { const k = clamp((t - 1.2) / 1.3, 0, 1), y = lerp(POD.h1 + 1.0, POD.h1 + 1.95, k * k * (3 - 2 * k)) + Math.sin(t * 6) * .02 * k;
    CER.cup.position.set(POD.x, y, POD.z + .05); CER.cup.rotation.y = t * .6; }
  S.celebrate.t = t < 1.2 ? .2 : 3.6; // pose: parado → braços para cima com o troféu
  // foto oficial: três flashes com a câmera de frente
  [3.2, 3.6, 4.1].forEach((at, i) => stage('fl' + i, at, () => { CER.flashT = 0; sndHit(.05); }));
  if (CER.flashT >= 0) { CER.flashT += dt; u.querySelector('.cer-flash').style.opacity = String(Math.max(0, 1 - CER.flashT / .25)); if (CER.flashT > .3) CER.flashT = -1; }
  // cheque do prêmio
  if (imp >= 3 && CER.info.prize) stage('check', 5, () => { const c = u.querySelector('.cer-check'); c.innerHTML = '<small>PRÊMIO</small><b>' + money(CER.info.prize) + '</b><span>' + CER.info.name + '</span>'; c.hidden = false; sndHit(.12); });
  if (imp >= 3 && t > (imp >= 6 ? 7.3 : 7.8)) u.querySelector('.cer-check').hidden = true;
  // entrevista na beira da quadra
  if (imp >= 6) stage('int', 7.5, () => { const q = u.querySelector('.cer-int'); u.querySelector('.cer-q').textContent = 'Repórter: o que esse título significa para vocês?';
    u.querySelector('.cer-a').textContent = '"' + QUOTES[Math.floor(Math.random() * QUOTES.length)] + (CER.info.partner ? ' ' + shortOf({ name: CER.info.partner }) + ' jogou demais.' : '') + '"'; q.hidden = false; });
  // títulos grandes: mais confete e torcida em vários momentos
  if (imp >= 8) { stage('c2', 4.4, () => { confetti(); cheerArena(3); }); stage('c3', 9.5, () => { confetti(); cheerArena(3); }); }
  else if (imp >= 5) stage('c2', 4.6, () => confetti());
  if (t >= CER.end) endCeremony();
}
// câmera: abre aberta, vai fechando no pódio; na foto fica de frente e mais perto; na entrevista um pouco de lado
function ceremonyCam(dt) {
  if (!CER.on) return;
  const t = CER.t, look = CER.camLook, pos = CER.camPos;
  const tgt = t < 3 ? [POD.x + 1.2 - t * .25, 2.6 - t * .2, POD.z + 7.5 - t * 1.1] : t < 4.6 ? [POD.x + .4, 1.9, POD.z + 3.6] : t < 7.4 ? [POD.x + 2.2, 2.1, POD.z + 4.6] : [POD.x - 1.6, 1.8, POD.z + 3.4];
  const lk = t < 4.6 ? [POD.x + .5, POD.h1 + 1.3, POD.z] : [POD.x + .2, POD.h1 + 1.4, POD.z];
  const k = 1 - Math.exp(-dt * 2.5);
  if (t < .05) { pos.set(...tgt); look.set(...lk); }
  pos.x += (tgt[0] - pos.x) * k; pos.y += (tgt[1] - pos.y) * k; pos.z += (tgt[2] - pos.z) * k;
  look.x += (lk[0] - look.x) * k; look.y += (lk[1] - look.y) * k; look.z += (lk[2] - look.z) * k;
  camera.fov = 42; camera.updateProjectionMatrix(); camera.position.copy(pos); camera.lookAt(look);
}
if (typeof window !== 'undefined') window.__pdoCER = CER;
export { startCeremony, ceremonyTick, ceremonyCam, CER };
