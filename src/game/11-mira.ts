// @ts-nocheck
// mira do jogador: seta, alvo e arco
import './10-fisica';
import * as THREE from 'three';
import { $s } from '../state';
import { ATTR_OF, C, DIFF, G, SHOTS, TOSS_T, V3, clamp, lerp, shortOf } from './00-base';
import { S } from './01-estado';
import { scene } from './02-render';
import { human } from './06-modelos';
import { ball } from './07-glb';
import { $, hideBanner } from './09-interface';
import { solveShot } from './10-fisica';
import { MTR } from './12-controles';
import { assignee, gapX, humanPlan } from './16-ia';
function humanAim(p = human) {
  const ix = p.inputX; const lim = C.halfW - .6;
  if (Math.abs(ix) > .25) return clamp(ix, -1, 1) * lim;
  return aimAutoX(p.team); // sem direção: o maior espaço vazio (fixo por bola, para a mira não tremer)
}
// ---------- mira: seta no chão, alvo e arco da trajetória ----------
const AIM = { ring: null, dot: null, arrow: null, head: null, shaft: null, arc: null, cache: [] };
const AIM_COL = { smash: 0xff5a1f, drive: 0xff5a1f, lob: 0x2f9bff, curta: 0xffc21a, defesa: 0x22c76f, preview: 0xffe14d };
function aimAutoX(team = 0) { const ch = AIM.cache[team] || (AIM.cache[team] = { id: -1, x: 0 }); if (ch.id !== S.hitId) { ch.id = S.hitId; const ta = TAC.aim ? TAC.aim(team) : null; ch.x = ta !== null ? ta : gapX(team, .3) * .8; } return ch.x; }
// a tática é registrada depois (o módulo da IA vem mais tarde na cadeia)
const TAC = { aim: null };
// W = mais curto (perto da rede), S = mais fundo; sem segurar, meio da faixa
// (no time de cima o W também é "para a rede": o z do mundo vem invertido)
// profundidade da mira: W (para frente) manda funda, S (para trás) manda curta, nada = meio
function humanDepthT(p = human) { const iz = (p.inputZ || 0) * (p.team === 0 ? 1 : -1); return iz < -.25 ? .92 : iz > .25 ? .08 : .5; }
function buildAim() {
  const mk = (geo, op) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); m.renderOrder = 5; scene.add(m); return m; };
  const og = new THREE.RingGeometry(.62, 1.1, 48); og.rotateX(-Math.PI / 2); AIM.outline = mk(og, .35); AIM.outline.material.color.setHex(0x0f2436);
  const rg = new THREE.RingGeometry(.58, 1, 48); rg.rotateX(-Math.PI / 2); AIM.ring = mk(rg, .95);
  const dg = new THREE.CircleGeometry(.13, 24); dg.rotateX(-Math.PI / 2); AIM.dot = mk(dg, .9);
  AIM.arrow = new THREE.Group(); scene.add(AIM.arrow);
  const sg = new THREE.PlaneGeometry(1, 1); sg.rotateX(-Math.PI / 2); sg.translate(0, 0, .5);
  AIM.shaft = new THREE.Mesh(sg, AIM.ring.material.clone()); AIM.shaft.material.opacity = .85; AIM.shaft.material.depthTest = false; AIM.arrow.add(AIM.shaft);
  const sh = new THREE.Shape(); sh.moveTo(-.36, 0); sh.lineTo(.36, 0); sh.lineTo(0, .55); sh.lineTo(-.36, 0);
  const hg = new THREE.ShapeGeometry(sh); hg.rotateX(Math.PI / 2);
  AIM.head = new THREE.Mesh(hg, AIM.shaft.material); AIM.arrow.add(AIM.head);
  AIM.arrow.children.forEach(o => { o.renderOrder = 20; });
  AIM.arc = new THREE.InstancedMesh(new THREE.SphereGeometry(.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .95, toneMapped: false }), 22); AIM.arc.frustumCulled = false; scene.add(AIM.arc);
}
const _aimTgt = new V3(), _aimSt = new V3(), _aimM = new THREE.Matrix4();
function updateAimMarker() {
  if (!AIM.ring) buildAim();
  const sw = human.swing, active = human.charging || (sw.t >= 0 && !sw.hit);
  const show = !S.spectate && S.settings.aimArrow !== false && S.mode === 'rally' && ball.state === 'live' && S.lastTeam === 1 && (active || assignee(0) === human);
  // só a flecha no chão, saindo dos pés do jogador (alvo, anel e arco ficavam poluídos demais)
  [AIM.ring, AIM.outline, AIM.dot, AIM.arc].forEach(o => { o.visible = false; });
  AIM.arrow.visible = show;
  if (!show) return;
  const type = human.charging ? (MTR.type === 'lob' ? 'lob' : 'smash') : active ? sw.type : 'preview';
  const contactY = humanPlan.id === S.hitId && humanPlan.plan ? humanPlan.plan.pt.y : ball.pos.y;
  const key = type === 'preview' ? 'defesa' : type === 'smash' && contactY < 1.9 ? 'drive' : type;
  const spec = SHOTS[key];
  let d0 = spec.depth[0], d1 = spec.depth[1];
  if (key === 'lob') { const lp = clamp(human.charging ? MTR.v : sw.lob ? sw.lob.power : .6, 0, 1); d0 = lerp(5.4, 6.4, lp); d1 = lerp(7.0, 7.6, lp); }
  const lim = C.halfW - .35;
  const x = clamp(humanAim(), -lim, lim), z = -lerp(d0, d1, humanDepthT());
  AIM.shaft.material.color.setHex(AIM_COL[type] || 0xffffff);
  // flecha curta embaixo do jogador apontando para onde a bola vai; mais longa quanto mais funda a bola
  const hx = human.pos.x, hz = human.pos.z, dx = x - hx, dz = z - hz;
  AIM.arrow.position.set(hx, .03, hz); AIM.arrow.rotation.y = Math.atan2(dx, dz);
  const L = lerp(.7, 1.4, clamp(-z / 7.6, 0, 1));
  AIM.shaft.position.set(0, 0, .45); AIM.shaft.scale.set(.2, 1, L); AIM.head.scale.setScalar(.7); AIM.head.position.set(0, .002, .45 + L);
}
const skillOf = p => p.skill || (p.team === 0 ? DIFF.medio : DIFF[S.settings.diff]);
function startJump(p, dur, h) { if (p.jump > 0) return; p.jump = dur; p.jumpDur = dur; p.jumpH = h; }
// cor da defesa: verde boa, amarelo ok, laranja levantou, vermelho descontrolou ou errou
const DEF_COLORS = { verde: '#4FD18B', amarelo: '#FFD23F', laranja: '#FF8A2A', vermelho: '#E5484D' };
const defRing = new THREE.Mesh(new THREE.RingGeometry(.35, .5, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
defRing.rotation.x = -Math.PI / 2; defRing.visible = false; scene.add(defRing);
$s.defRingT = 0; let defFlashTimer = 0;
function defenseFeedback(r, ctl) {
  const g = r.mis || r.wild ? 'vermelho' : r.pop ? 'laranja' : r.grade < .7 ? 'amarelo' : 'verde';
  if (ctl && ctl.remote) { ctl.out.push(['def', g]); return; } // online: o anel aparece na tela do convidado
  defenseFlash(g);
}
function defenseFlash(g) {
  const c = DEF_COLORS[g];
  defRing.material.color.set(c); defRing.position.set(human.pos.x, .025, human.pos.z); defRing.visible = true; $s.defRingT = .5;
  const fl = $('defFlash'); fl.style.setProperty('--dfc', c); fl.classList.add('on');
  clearTimeout(defFlashTimer); defFlashTimer = setTimeout(() => fl.classList.remove('on'), 60);
}
function qualityWord(q) { return q > .82 ? 'PERFEITO' : q > .55 ? 'BOM' : 'NO LIMITE'; }
const whoTag = p => p.isHuman ? '' : (p.char ? shortOf(p.char) : p.team === 0 ? 'PARCEIRA' : 'CPU') + ' · ';
const whoKind = p => p.isHuman ? null : p.team === 0 ? 'mate' : 'cpu';
function handPos(p, out) {
  p.model.armL.wrist.getWorldPosition(out);
  const f = p.team === 0 ? 1 : -1;
  if (!isFinite(out.x) || out.y < .3) out.set(p.pos.x + .05 * f, 1.25, p.pos.z - .35 * f);
  return out;
}
// duração do lançamento (a mesma conta no anfitrião e no convidado do online, para a barra bater igual):
// a variação entre lançamentos é metade da sorteada (o verde do saque varia menos que o do smash) e o saque forte
// tem lançamento bem mais alto (o contato continua na mesma altura; a barra anda na mesma proporção)
function tossDurOf(type, tf) { const mul = type === 'smash' ? 2 : 1; return { dur: TOSS_T * (1 + ((tf || (.82 + Math.random() * .38)) - 1.01) * .5) * mul, mul }; } // tf: sorteado pelo convidado no online
function startToss(p, type, tf) {
  S.mode = 'toss'; S.serveType = type; ball.state = 'toss'; p.tossT = 0;
  // cada lançamento é um pouco diferente (mais alto = mais tempo até o contato): o ponto perfeito da barra muda junto
  const td = tossDurOf(type, tf); p.tossDur = td.dur; p.tossMul = td.mul;
  const f = p.team === 0 ? 1 : -1;
  handPos(p, ball.pos);
  // a bola fica na mão enquanto o braço sobe e só sai quando ele está esticado (30% do tempo); a velocidade é calculada na soltura
  const low = type === 'lob';
  p.tossTgt = { x: p.pos.x + (low ? .32 : .22) * f, y: low ? 1.05 : 2.62, z: p.pos.z - (low ? .45 : .62) * f }; // por baixo (lob): bola sobe pouco e é batida na cintura
  p.tossRel = p.tossDur * .3; ball.inHand = true; ball.vel.set(0, 0, 0);
  p.serveJumped = false; p.pendingServe = null;
  hideBanner();
}
// solta a bola da mão em direção ao ponto de contato, chegando lá no fim do lançamento
function releaseToss(p) {
  const T = Math.max(.15, p.tossDur - p.tossT), t = p.tossTgt;
  ball.vel.set((t.x - ball.pos.x) / T, (t.y - ball.pos.y + .5 * G * T * T) / T, (t.z - ball.pos.z) / T);
  ball.inHand = false;
}

export { tossDurOf, releaseToss, TAC, defRing, defenseFeedback, defenseFlash, handPos, humanAim, humanDepthT, qualityWord, skillOf, startJump, startToss, updateAimMarker, whoKind, whoTag };
