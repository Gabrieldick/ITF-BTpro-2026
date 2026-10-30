// @ts-nocheck
// animação procedural com cinemática inversa e câmera
import './17-bola';
import * as THREE from 'three';
import { $s } from '../state';
import { C, HALF_W, TOSS_T, V3, clamp, hScale, lerp, smooth, nameOf, overall, rand, shortOf, attrOf } from './00-base';
import { NET, S } from './01-estado';
import { SUN_DIR, camera, sun } from './02-render';
import { sky } from './03-cenario';
import { pickStyle, styleSwing, ACT, KU, P, READY, SERVE_KEYS, SERVE_KEYS_LOW, SERVE_U, mirrorPose, newPose, poseAt, swingKey, uOf } from './04-poses';
import { ALL, human } from './06-modelos';
import { RING_MATE, RING_MINE, TRAIL_N, ball, ballMesh, ballShadow, driveSkin, fpArm, fpWrist, landRing, particles, puff, reachRing, scuffMark, stamp, trail, trailGeo, trailPos, updateParticles } from './07-glb';
import { $, dupla, el, placeHeldBall, shotBtns } from './09-interface';
import { canHit, predictLanding, reachOf } from './10-fisica';
import { defRing, updateAimMarker } from './11-mira';
import { LOB_MAX, MTR, timeToReach } from './12-controles';
import { assignee } from './16-ia';
// ---------- Animação: cinemática inversa em braços e pernas ----------
const _iE = new V3(), _iP = new V3(), _iM = new V3();
const _id = new V3(), _iu = new V3(), _iw = new V3(), _in = new V3(), _iX = new V3(), _iY = new V3(), _iZ = new V3(), _im = new THREE.Matrix4();
const _pv = new V3();
// flecha na borda da tela para onde a bola vai cair (quando o ponto está fora da vista) e aviso de linha no rali
function hudHints(incoming) {
  const la = $('landArrow'), lw = $('lineWarn');
  if (la) {
    let show = false;
    if (incoming && S.settings.assistMark && S.settings.landArrow !== 'off') {
      const l = predictLanding(); _pv.set(l.x, .05, l.z).project(camera);
      const behind = _pv.z > 1; let x = _pv.x, y = _pv.y; if (behind) { x = -x; y = -y; }
      if (behind || Math.abs(x) > .94 || Math.abs(y) > .9) {
        const ang = Math.atan2(y, x), r = Math.min(.9 / Math.max(1e-3, Math.abs(Math.cos(ang))), .82 / Math.max(1e-3, Math.abs(Math.sin(ang))));
        la.style.left = ((Math.cos(ang) * r + 1) / 2 * 100) + '%'; la.style.top = ((1 - Math.sin(ang) * r) / 2 * 100) + '%';
        la.style.transform = 'translate(-50%,-50%) rotate(' + (-ang).toFixed(3) + 'rad)'; show = true;
      }
    }
    if (la.hidden === show) la.hidden = !show;
  }
  if (lw) {
    const hw = dupla() ? HALF_W.dupla : HALF_W.simples, d = Math.min(hw - Math.abs(human.pos.x), C.halfL - human.pos.z);
    const st = S.mode === 'rally' && S.settings.lineWarn !== 'off' && !S.spectate ? (d < 0 ? 'out' : d < .45 ? 'near' : '') : '';
    if (lw.dataset.s !== st) { lw.dataset.s = st; lw.hidden = !st; lw.textContent = st === 'out' ? 'FORA DA QUADRA' : 'PERTO DA LINHA'; }
  }
}
const RING_ERR = { id: -1, x: 0, z: 0 }; // desvio do anel de queda (noção de jogo baixa)
function ik2(upper, lower, origin, target, pole, L1, L2) {
  _id.subVectors(target, origin);
  const dist = clamp(_id.length(), .05, L1 + L2 - .002);
  _id.normalize();
  const a1 = Math.acos(clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1));
  const bend = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - dist * dist) / (2 * L1 * L2), -1, 1));
  _in.crossVectors(_id, pole); if (_in.lengthSq() < 1e-8) _in.set(1, 0, 0); _in.normalize();
  _iw.crossVectors(_in, _id).normalize();
  _iu.copy(_id).multiplyScalar(Math.cos(a1)).addScaledVector(_iw, Math.sin(a1));
  _iZ.copy(_id).addScaledVector(_iu, -_id.dot(_iu));
  if (_iZ.lengthSq() < 1e-8) _iZ.copy(_iw).negate();
  _iZ.normalize().negate();
  _iY.copy(_iu).negate();
  _iX.crossVectors(_iY, _iZ).normalize();
  _iZ.crossVectors(_iX, _iY);
  _im.makeBasis(_iX, _iY, _iZ);
  upper.quaternion.setFromRotationMatrix(_im);
  lower.rotation.set(bend, 0, 0);
}
// tronco "sólido" (no espaço da coluna, frente em −z): mão e cotovelo não atravessam o corpo — na troca de forehand para
// backhand a mão contorna o tronco em vez de passar por dentro dele
const BODY_W = { compacto: [1.1, 1.18], forte: [1.1, 1.08], esguio: [.92, .88] };
function keepOut(v, p, rx0, rz0) {
  if (v.y < -.28 || v.y > .5) return false;
  const bw = BODY_W[p.look && p.look.build] || [1, 1], top = clamp((v.y - .3) / .2, 0, 1);
  const rx = rx0 * bw[0] * (1 - top * .25), rz = (v.z < 0 ? rz0 * bw[1] : rz0 * .9) * (1 - top * .3);
  const e = (v.x / rx) ** 2 + (v.z / rz) ** 2; if (e >= 1) return false;
  if (e < 1e-6) { v.z = -rz; return true; }
  const k = 1 / Math.sqrt(e); v.x *= k; v.z *= k; return true;
}
function armIK(p, arm, sh, target, pole) {
  keepOut(target, p, .21, .16);
  ik2(arm.sh, arm.el, sh, target, pole, .285, .27);
  _iE.copy(sh).addScaledVector(_iu, .285);
  // cotovelo (e o meio do braço) por fora do corpo: a dobra vai para o lado de fora
  _iM.addVectors(sh, _iE).multiplyScalar(.5);
  if (keepOut(_iE, p, .19, .14) || keepOut(_iM, p, .17, .13)) { _iP.set(_iE.x, -.15, _iE.z).normalize(); ik2(arm.sh, arm.el, sh, target, _iP, .285, .27); _iE.copy(sh).addScaledVector(_iu, .285); }
  // meio do antebraço dentro do tronco: a mão vai mais para fora/frente
  _iM.addVectors(_iE, target).multiplyScalar(.5); _iP.copy(_iM);
  if (keepOut(_iM, p, .19, .14)) { target.addScaledVector(_iM.sub(_iP), 2); ik2(arm.sh, arm.el, sh, target, pole, .285, .27); }
}
// passos por segundo (os dois pés somados) para a velocidade no chão
const RLX_WX = .55, RLX_WR = .9; // punho andando solto
const stepCad = sp => clamp(1.8 + .4 * sp, 1.8, 3.8);
function sideOf(p, pt) { const q = pt || ball.pos; return (q.x - p.pos.x) * (p.team === 0 ? 1 : -1) * (p.lefty ? -1 : 1); }
const _a = new V3(), _b = new V3(), _c = new V3(), _e = new V3(), _g = new V3(), _v2 = new V3(), _q1 = new THREE.Quaternion(), _hq = new THREE.Quaternion();
// mola amortecida (pouco abaixo do crítico): a postura chega com velocidade, passa um tico e assenta — o golpe tem
// continuação e as trocas de pose têm inércia, em vez do "deslizar liso" de um filtro simples
function springPose(dst, src, vel, w, z, dt) {
  const n = Math.max(1, Math.ceil(dt * w / .35)), h = dt / n, w2 = w * w, c = 2 * z * w;
  for (let it = 0; it < n; it++) for (const key in src) {
    if (Array.isArray(src[key])) { const V = vel[key] || (vel[key] = [0, 0, 0]); for (let j = 0; j < 3; j++) { V[j] += (w2 * (src[key][j] - dst[key][j]) - c * V[j]) * h; dst[key][j] += V[j] * h; } }
    else { vel[key] = (vel[key] || 0) + (w2 * (src[key] - dst[key]) - c * (vel[key] || 0)) * h; dst[key] += vel[key] * h; }
  }
}
function blendPose(dst, src, k) {
  for (const key in src) { if (Array.isArray(src[key])) { for (let j = 0; j < 3; j++) dst[key][j] += (src[key][j] - dst[key][j]) * k; } else dst[key] += (src[key] - dst[key]) * k; }
}
const READY_KEYS = [READY, READY], READY_U = [0, 1];
const READY_FP = P({ rh: [.26, .42, -.46], rp: [.9, -.6, .3], wx: 1.35, wr: 1.0, lh: [-.06, .3, -.4] });
const READY_FP_KEYS = [READY_FP, READY_FP];
// preparação do smash: corpo de lado (ombro da mão livre para a rede), mão livre apontando a bola
// 1 enquanto se prepara; no golpe o corpo desenrola até o contato
function smashPrep(p, swingU) {
  // lançamento do saque: vai ficando de lado como no smash (no saque por baixo, só meio de lado)
  // saque: quem saca já espera de lado para a quadra (~75°) e segue assim no lançamento (por baixo, só meio de lado)
  if ((S.mode === 'toss' || S.mode === 'serve') && S.serverPlayer === p && !p.pendingServe) return S.mode === 'toss' && S.serveType === 'lob' ? .6 : 1.35;
  if (p.charging && (p.mtr || MTR).type === 'smash') return clamp((p.mtr || MTR).t / .2, 0, 1);
  if (swingU >= 0 && p.swing.type === 'smash' && ball.pos.y >= 1.7) return clamp(1 - swingU / .45, 0, 1);
  if (!p.isHuman && S.mode === 'rally' && ball.state === 'live' && S.lastTeam !== p.team && p.swing.t < 0 && p.ai.planId === S.hitId && p.ai.shot === 'smash' && p.ai.plan && p.ai.plan.pt.y >= 1.9 && assignee(p.team) === p) return 1;
  return 0;
}
function animateAthlete(p, dt) {
  const m = p.model; let pose = p.poseT || (p.poseT = newPose());
  const sp = Math.hypot(p.vel.x, p.vel.z), run = clamp(sp / 4.2, 0, 1);
  let mirror = false, swingU = -1;
  if (p.debug) {
    if (p.debug.type === 'serve' || p.debug.type === 'servelow') poseAt(p.debug.type === 'servelow' ? SERVE_KEYS_LOW : SERVE_KEYS, SERVE_U, p.debug.u, pose);
    else { swingU = p.debug.u; poseAt(ACT[p.debug.type], uOf(p.debug.type), swingU, pose); styleSwing(pose, p.debug.type, swingU, p.debug.st); mirror = /^(defesa|curta|lob)/.test(p.debug.type) && p.debug.side < 0; }
  } else if (S.mode === 'toss' && S.serverPlayer === p) poseAt(S.serveType === 'lob' ? SERVE_KEYS_LOW : SERVE_KEYS, SERVE_U, clamp(p.tossT / (p.tossDur || TOSS_T), 0, 1), pose);
  else if (S.mode === 'replay' && p.rpToss >= 0) poseAt(SERVE_KEYS, SERVE_U, p.rpToss, pose); // replay: lançamento do saque
  else if (p.charging) { const M = p.mtr || MTR; poseAt(ACT[M.type === 'lob' ? 'lob' : 'smash'], uOf(M.type === 'lob' ? 'lob' : 'smash'), .3 * clamp(M.t / .18, 0, 1), pose); }
  else if (p.swing.t >= 0) { swingU = clamp(p.swing.t / p.swing.dur, 0, 1); mirror = (p.swing.type === 'defesa' || p.swing.type === 'curta' || p.swing.type === 'lob') && p.swing.side < -.15; let ak = swingKey(p); if (ak === 'curta_alta' && !mirror) ak = 'curta_alta_fh';
    // golpe pela situação (só a animação): bola rápida no peito perto da rede vira bloqueio
    if (swingU < (p.swU0 ?? 1) - .2 || p.swKey0 !== swingKey(p)) { p.swKey0 = swingKey(p); const bs = Math.hypot(ball.vel.x, ball.vel.z); p.swAlt = ak === 'defesa' && bs > 13 && ball.pos.y > .75 && ball.pos.y < 1.6 && Math.abs(p.pos.z) < 3.4 ? 'defesa_bloqueio' : ''; }
    if (p.swAlt && ak === 'defesa') ak = p.swAlt;
    poseAt(ACT[ak], uOf(ak), swingU, pose);
    if (!p.swSty || swingU < (p.swU0 ?? 1) - .2 || p.swSty.ak !== ak) { p.swSty = pickStyle(ak, p.char) || {}; p.swSty.ak = ak; } p.swU0 = swingU; styleSwing(pose, ak, swingU, p.swSty);
    // curta alta de forehand: depois do toque a face da raquete acompanha para onde a curta foi
    if (ak === 'curta_alta_fh' && p.swing.hit && ball.state === 'live' && S.lastTeam === p.team) { const f = p.team === 0 ? 1 : -1; pose.wr += clamp(Math.atan2(ball.vel.x * f * (p.lefty ? -1 : 1), -ball.vel.z * f), -.7, .7); } }
  else poseAt(p === human && fpBodyOn ? READY_FP_KEYS : READY_KEYS, READY_U, 0, pose);
  if (mirror) mirrorPose(pose);
  // backhand de verdade: na preparação os ombros giram bem (as costas meio viradas para a rede, o ombro da raquete na
  // frente), abrem até o contato e passam um pouco depois; o quadril acompanha menos
  const bhTw = mirror && swingU >= 0 ? (swingU < .25 ? .48 * swingU / .25 : swingU < .45 ? .48 - .33 * (swingU - .25) / .2 : swingU < .75 ? .15 - .22 * (swingU - .45) / .3 : -.07 * (1 - (swingU - .75) / .25)) : 0;
  p.bhTw = (p.bhTw || 0) + (bhTw - (p.bhTw || 0)) * Math.min(1, dt * 20);
  // backhand baixo com as duas mãos: a mão livre vai junto no cabo
  p.twoH = mirror && swingU >= 0 && pose.rh[1] < .38 ? Math.min(1, (.38 - pose.rh[1]) / .15) : 0;
  // a postura real persegue a postura-alvo: sem estalos ao começar, trocar de lado ou terminar um golpe
  const acting = swingU >= 0 || p.charging || (S.mode === 'toss' && S.serverPlayer === p) || (S.mode === 'replay' && p.rpToss >= 0);
  if (p.debug) blendPose(p.pose, pose, 1); else springPose(p.pose, pose, p.poseV || (p.poseV = {}), acting ? 38 : 15, acting ? .72 : .9, dt);
  pose = p.pose;
  p.breath = (p.breath || Math.random() * 6) + dt;
  // tronco e quadril
  const f = p.team === 0 ? 1 : -1;
  let yawT = clamp(-p.vel.x * f * .05, -.3, .3);
  // o giro do grupo é no mundo (não espelha): para o canhoto o lado da raquete precisa ser desfeito
  if (ball.state === 'live') yawT += clamp(Math.atan2(-sideOf(p) * (p.lefty ? -1 : 1), Math.abs(ball.pos.z - p.pos.z) + 1.2) * .45, -.45, .45);
  p.yaw += (yawT - p.yaw) * Math.min(1, dt * 6);
  const prepT = p.debug ? 0 : smashPrep(p, swingU);
  p.prep = (p.prep || 0) + (prepT - (p.prep || 0)) * Math.min(1, dt * (prepT > (p.prep || 0) ? 7 : 12));
  // recuar não é andar de costas: o corpo vira de lado e as pernas cruzam (idem numa corrida lateral longa)
  const fT = p.team === 0 ? 1 : -1, back = p.vel.z * fT, latV = p.vel.x * fT;
  const busy = swingU >= 0 || p.charging || (S.mode === 'toss' && S.serverPlayer === p) || (S.mode === 'replay' && p.rpToss >= 0) || !!p.dive;
  // um ou dois passos para trás: de costas mesmo; acelerando, vira de lado (corre cruzando as pernas)
  const backK = busy ? 0 : clamp((back - 1.2) / 1.4, 0, 1), latK = busy ? 0 : clamp((Math.abs(latV) - 2.6) / 1.6, 0, 1) * (1 - backK);
  const turnSign = Math.abs(latV) > .6 ? -Math.sign(latV) : (p.lefty ? 1 : -1);
  const mtT = (backK * 1.35 + latK * .55) * turnSign;
  p.moveTurn = (p.moveTurn || 0) + (mtT - (p.moveTurn || 0)) * Math.min(1, dt * 6);
  // base baixa: bola rápida vindo na direção do jogador → abaixa e abre as pernas (prontidão para defender)
  const bsp = Math.hypot(ball.vel.x, ball.vel.z);
  const lowT = !busy && ball.state === 'live' && S.lastTeam !== p.team && bsp > 10 && Math.hypot(ball.pos.x - p.pos.x, ball.pos.z - p.pos.z) < 8 ? clamp((bsp - 10) / 6, .5, 1) : 0;
  p.lowK = (p.lowK || 0) + (lowT - (p.lowK || 0)) * Math.min(1, dt * 10);
  // locomoção solta: entre pontos (ou com a bola longe, indo para o outro lado) o jogador anda/corre ereto, pés sob o
  // corpo, braços balançando e o corpo virado para onde vai — a base baixa de jogo fica para quando a bola vem
  const away = ball.state === 'live' && S.lastTeam === p.team && ball.vel.z * fT < -3;
  // troca de lado: anda de frente para onde vai (o corpo vira inteiro, até de costas para a rede) e só no fim se vira
  const swk = !!(S.sideWalk && S.mode === 'dead');
  const rlxT = busy || p.lowK > .2 ? 0 : swk && sp > .3 ? 1 : (ball.state !== 'live' || S.mode === 'dead' ? 1 : away ? .55 : 0) * clamp((sp - .4) / .8, 0, 1);
  p.rlx = (p.rlx || 0) + (rlxT - (p.rlx || 0)) * Math.min(1, dt * (rlxT > (p.rlx || 0) ? (swk ? 8 : 3) : 9));
  const hd = Math.atan2(latV, -back), r0 = p.rlxTurn || 0;
  const turnT = swk && sp > .5 ? r0 + Math.atan2(Math.sin(-hd - r0), Math.cos(-hd - r0)) : p.rlx > .3 && sp > 1 && Math.abs(hd) < 1.9 ? clamp(-hd, -1.5, 1.5) * p.rlx : 0;
  p.rlxTurn = r0 + (turnT - r0) * Math.min(1, dt * (swk ? 7 : 5));
  let yaw = (p.team === 0 ? 0 : Math.PI) + p.yaw * (1 - p.rlx) + p.prep * .95 * (p.lefty ? 1 : -1) + p.moveTurn * (1 - p.prep) * (1 - p.rlx) + p.rlxTurn * (1 - p.prep);
  const cel = (S.mode === 'dead' || S.mode === 'ceremony') && S.celebrate && S.celebrate.team === p.team ? S.celebrate : null;
  const mateC = cel && $s.teams[p.team].length > 1 ? $s.teams[p.team].find(o => o !== p) : null;
  // comemoração entre pontos (tapa de mão / toque baixo / raquete com raquete): vira para o parceiro quando ele chega perto
  const pc = !cel && S.mode === 'dead' && !S.sideWalk && S.ptCel && S.ptCel[p.team], pMate = pc && $s.teams[p.team].length > 1 ? $s.teams[p.team].find(o => o !== p) : null;
  const pDist = pMate ? Math.hypot(pMate.pos.x - p.pos.x, pMate.pos.z - p.pos.z) : 9;
  const pgW = pc && pc.met != null ? clamp((pc.t - pc.met) / .18, 0, 1) * clamp((pc.met + .75 - pc.t) / .22, 0, 1) : 0;
  // no título se viram de frente um para o outro; entre pontos só giram um pouco (pc.turn) e esticam a mão/raquete de lado
  const faceMate = (mateC && cel.t > .7) || (pMate && pc.t > .3 && pc.t < 1.6 && pDist < 2.2);
  if (faceMate) { const mt = mateC || pMate; let fy = Math.atan2(-(mt.pos.x - p.pos.x), -(mt.pos.z - p.pos.z));
    if (!mateC) { const base = p.team === 0 ? 0 : Math.PI; fy = base + Math.atan2(Math.sin(fy - base), Math.cos(fy - base)) * (pc.turn ?? .2); }
    p.celYaw = p.celYaw === undefined ? yaw : p.celYaw + Math.atan2(Math.sin(fy - p.celYaw), Math.cos(fy - p.celYaw)) * Math.min(1, dt * 8); yaw = p.celYaw; }
  else p.celYaw = undefined;
  if (p.forceYaw != null) yaw = p.forceYaw; // cerimônia: todos de frente para a câmera
  m.group.rotation.set(0, yaw, 0); // (inteira: o tombo do peixinho não pode acumular de um quadro para o outro)
  // peixinho de verdade: o corpo inteiro se lança na direção da bola, fica quase deitado na areia (de lado ou de peito) e
  // depois se levanta; a esticada curta (sev baixo) continua só o afundo. tiltK: 0 em pé → 1 deitado
  let tiltK = 0, tiltA = 0;
  if (p.dive && !p.debug) { const D = p.dive, sevF = clamp(((D.sev ?? 1) - .35) / .45, 0, 1), up = Math.min(.45, D.dur * .4);
    const tk = D.t < .26 ? smooth(0, .26, D.t) : D.t > D.dur - up ? smooth(0, up, D.dur - D.t) : 1;
    tiltK = tk * sevF; tiltA = tiltK * 1.38;
    if (tiltA > .01) { const ld = [Math.cos(yaw) * D.dx - Math.sin(yaw) * D.dz, Math.sin(yaw) * D.dx + Math.cos(yaw) * D.dz]; // direção do mergulho no espaço do jogador
      _e.set(ld[1], 0, -ld[0]).normalize(); _q1.setFromAxisAngle(_e, tiltA); m.group.quaternion.multiply(_q1); } }
  p.tiltK = tiltK;
  if (p.jump > 0) p.jump = Math.max(0, p.jump - dt);
  // mais split steps: (1) adversário armando o smash → pulinho antes do contato, para aterrissar pronto para defender;
  // (2) voltou correndo para a posição (ex.: depois de uma curta) e parou → pulinho de prontidão
  if (S.mode === 'rally' && ball.state === 'live' && !(p.split > 0) && !busy && p.jump <= 0) {
    const sm = ($s.teams[1 - p.team] || []).some(o => (o.charging && (o.mtr || MTR).type !== 'lob') || (o.swing.t >= 0 && o.swing.type === 'smash' && !o.swing.hit && ball.pos.y > 1.9 && o.swing.t > o.swing.dur * .12));
    if (sm && S.lastTeam === p.team && p.splitFor !== S.hitId) { p.splitFor = S.hitId; p.split = .26; }
    else if (sp < .5 && (p.prevSp || 0) > 2.2 && S.lastTeam === p.team && p.splitBack !== S.hitId) { p.splitBack = S.hitId; p.split = .22; }
  }
  p.prevSp = sp;
  if (p.split > 0) { p.split = Math.max(0, p.split - dt); if (p.split === 0) p.burst = .3; }
  if (p.burst > 0) p.burst = Math.max(0, p.burst - dt);
  // split step: pulinho com os dois pés quando o adversário bate, aterrissando abaixado e com as pernas abertas
  const spU = p.split > 0 ? 1 - p.split / .26 : -1;
  const jy = (p.jump > 0 ? Math.sin((1 - p.jump / (p.jumpDur || .35)) * Math.PI) * (p.jumpH || .3) : 0) + (spU >= 0 && spU < .6 ? Math.sin(Math.PI * spU / .6) * .1 : 0);
  m.group.position.set(p.pos.x, jy + (p.liftY || 0), p.pos.z); // liftY: em cima do pódio
  if (tiltK > 0) { const D = p.dive, la = D.t < .26 ? Math.sin(Math.PI * D.t / .26) * .14 : 0, sh = Math.sin(tiltA) * .5; m.group.position.x -= D.dx * sh; m.group.position.z -= D.dz * sh; m.group.position.y += la + Math.sin(tiltA) * .05; } // voo curto na saída; o corpo deitado fica centrado onde o jogador está
  // passada: cresce e some aos poucos (sem o pé estalar no chão ao parar); a fase continua girando enquanto ainda há passada
  p.strK = (p.strK || 0) + ((sp > .25 ? 1 : 0) - (p.strK || 0)) * Math.min(1, dt * (sp > .25 ? 10 : 6));
  const gF = stepCad(sp) / 2; // ciclos por segundo (por perna), igual à cadência dos pés
  if (p.strK > .01 && !p.feet) p.gait += dt * Math.PI * 2 * gF; // (com pés plantados a fase vem dos próprios passos, lá embaixo)
  const spLand = spU >= .45 ? Math.sin(Math.PI * (spU - .45) / .55) : 0;
  // mergulho: corpo vai baixo e para a frente, uma perna em afundo; depois no chão e levantando
  const dv = p.dive ? p.dive.t / p.dive.dur : -1, diveK = (dv < 0 ? 0 : dv < .3 ? dv / .3 : dv > .75 ? (1 - dv) / .25 : 1) * (p.dive ? .45 + .55 * (p.dive.sev ?? 1) : 1) * (1 - .85 * tiltK); // esticada curta: só abaixa (no peixinho deitado o tombo já faz isso)
  // bola longe do corpo no golpe: o jogador se estica (passo em afundo para o lado dela, tronco inclinado, mais baixo se a bola é baixa)
  let reachK = 0, reachS = 1, reachLow = 0;
  if (swingU >= 0 && swingU < .8 && ball.state === 'live' && p.swing.type !== 'smash') {
    const tgt = p.swing.hit && p.contact ? p.contact : ball.pos;
    _e.set(tgt.x, tgt.y, tgt.z); m.group.worldToLocal(_e);
    const lat = Math.hypot(_e.x, _e.z);
    reachK = clamp((lat - .5) / .5, 0, 1) * clamp(1 - Math.abs(swingU - .45) / .5, 0, 1);
    reachS = Math.sign(_e.x) || 1; reachLow = clamp((.9 - _e.y) / .6, 0, 1);
  }
  p.reachK = (p.reachK || 0) + (reachK - (p.reachK || 0)) * Math.min(1, dt * 14);
  const defLow = swingU >= 0 && p.swing.type === 'defesa' ? Math.sin(Math.PI * clamp(swingU, 0, 1)) * .09 : 0; // na defesa o corpo abaixa
  const srvAir = p.jumpMode && p.jumpMode.serve && jy > .03 ? clamp(jy / .12, 0, 1) : 0; // saque no ar: as pernas empurraram, o quadril estende
  const crouch = pose.crouch * (1 - run * .6) * (1 - .8 * (p.rlx || 0)) * (1 - .9 * srvAir) + spLand * .1 + p.prep * .05 + diveK * .42 + p.reachK * reachLow * .18 + p.lowK * .11 * (1 - run * .5) + defLow;
  const crouchD = crouch * (1 - .8 * tiltK); // deitado no peixinho: pernas esticadas
  const lungeA = Math.max(Math.abs(pose.lunge), diveK * .95, p.reachK * .85), lungeS = p.reachK * .85 > Math.abs(pose.lunge) ? reachS : Math.sign(pose.lunge) || 1;
  m.hips.position.set(lungeS * .2 * lungeA + reachS * p.reachK * .22 + (p.wsx || 0), Math.min(.92 - crouchD - .08 * lungeA, p.hipCap ?? 9) + (p.bobY || 0) - (p.dip || 0), -.05 * lungeA);
  const idle = (1 - run) * (acting ? 0 : 1);
  if (!p.prevVel) p.prevVel = new V3();
  const acx = dt > 0 ? (p.vel.x - p.prevVel.x) / dt : 0, acz = dt > 0 ? (p.vel.z - p.prevVel.z) / dt : 0; p.prevVel.copy(p.vel);
  const cya = Math.cos(yaw), sya = Math.sin(yaw);
  p.accF = (p.accF || 0) + (clamp(-(sya * acx + cya * acz), -14, 14) - (p.accF || 0)) * Math.min(1, dt * 8);
  p.accR = (p.accR || 0) + (clamp(cya * acx - sya * acz, -14, 14) - (p.accR || 0)) * Math.min(1, dt * 8);
  const accLean = clamp(p.accF * .018, -.18, .18), accRoll = clamp(p.accR * .009, -.08, .08); // na arrancada de lado o tronco tombava antes da perna sair
  m.hips.position.x += clamp(-p.accR * .006, -.05, .05);
  m.hips.rotation.set(0, Math.cos(p.gait) * .11 * Math.max(run, p.rlx * .6) + p.bhTw * .35, Math.sin(p.gait) * .035 * Math.max(run, p.rlx * .6));
  // com o corpo já de lado, o tronco torce menos (senão gira demais)
  m.spine.rotation.set(-(pose.lean * (1 - .6 * p.rlx) + run * .17 + diveK * .75 + p.reachK * (.15 + reachLow * .35)) - accLean + Math.sin(p.breath * 1.9) * .012 * idle, pose.tw + p.bhTw * .65 + p.prep * .45 - Math.cos(p.gait) * .16 * Math.max(run, p.rlx * .6) * (1 - p.prep * .6), -pose.bend - Math.cos(p.gait) * .03 * run - accRoll - reachS * p.reachK * .32);
  _hq.copy(m.hips.quaternion).invert();
  m.group.updateMatrixWorld(true);
  // pernas: cada pé fica plantado no mundo até ficar longe de onde deveria estar (posição da pose + um pouco à frente, onde o
  // corpo vai estar); aí dá um passo em arco até lá. Um pé de cada vez (correndo rápido os passos se sobrepõem: fase de voo).
  // Vale para qualquer direção, giro do corpo, golpe e afundo — o pé só se move dando passo, nunca desliza
  const cy = Math.cos(yaw), sy = Math.sin(yaw), mx = p.lefty ? -1 : 1, hs = Math.abs(m.group.scale.y) || 1;
  const lvx = cy * p.vel.x - sy * p.vel.z, lvz = sy * p.vel.x + cy * p.vel.z; // velocidade no espaço do jogador (m/s)
  const fwd = -lvz, lvu = Math.abs(lvz) / (Math.hypot(lvx, lvz) || 1); // para a frente (m/s) · fração do movimento que é frente/trás
  const toW = (lx, lz) => [p.pos.x + (cy * lx * mx + sy * lz) * hs, p.pos.z + (-sy * lx * mx + cy * lz) * hs];
  const toL = (w) => { const dx = (w[0] - p.pos.x) / hs, dz = (w[1] - p.pos.z) / hs; return [(cy * dx - sy * dz) * mx, sy * dx + cy * dz]; };
  const air = jy > .05;
  p.gT = (p.gT || 0) + dt;
  // suor: cresce com o tempo em quadra e com a corrida (~10 min de partida para ficar bem molhado)
  if (p.skinU) { p.sweat = Math.min(1, (p.sweat || 0) + dt * (.0006 + sp * .0004)); p.skinU.uSweat.value = .15 + .85 * p.sweat; }
  // recolocado (novo ponto, troca de lado): os pés nascem de novo embaixo do corpo, sem passo voando até lá
  if (p.lastPos && Math.hypot(p.pos.x - p.lastPos.x, p.pos.z - p.lastPos.z) > .45) p.feet = null;
  (p.lastPos || (p.lastPos = new V3())).copy(p.pos);
  if (!p.feet) p.feet = [{ w: null, st: null }, { w: null, st: null }];
  // salto: parado sai e cai com as duas pernas; correndo/de lado/para trás (smash de trás, saque) sai em uma perna, faz a
  // tesoura no ar e cai na outra (a segunda apoia logo depois)
  if (air && !p.wasAir) {
    const one = spU < 0 && (sp > 1.3 || (S.mode === 'toss' && S.serverPlayer === p) || (p.swing.t >= 0 && p.swing.type === 'smash' && lvz > .6));
    const tk = p.feet[0].st ? 1 : p.feet[1].st ? 0 : (lvz > .3 ? (p.lefty ? 1 : 0) : (p.lefty ? 0 : 1)); // perna de impulso: a que está apoiada
    // saque: do troféu as duas pernas empurram e saem quase retas, o corpo vai para cima e para a frente; a perna de trás
    // (lado da raquete) dá um coice para trás e a da frente estica para pousar primeiro dentro da quadra
    const srv = (S.mode === 'toss' && S.serverPlayer === p) || (p.swing.t >= 0 && p.swing.var === 'saque');
    p.jumpMode = srv ? { tk: 1, serve: true } : one ? { tk } : null;
  }
  p.wasAir = air;
  const jp = p.jumpDur ? clamp(1 - p.jump / p.jumpDur, 0, 1) : .5;
  // passada: cadência de gente (≈2 passos/s andando, ≈3,8 correndo) → cada pé fica no chão por uma distância thrW (pousa
  // metade à frente, sai metade atrás) e voa o resto do ciclo; de lado os passos são mais curtos; gente mais baixa, passada
  // um pouco menor. Tudo em metros no mundo; thr/limites no espaço do modelo (÷ hs)
  const cad = stepCad(sp), swF = .4 + .2 * clamp((sp - 2.6) / 2.4, 0, 1), dirK = .75 + .25 * lvu;
  // alcance da perna no chão: depende da altura do quadril (agachado alcança menos); o pé apoia de reach à frente até reach atrás
  const hipY = m.hips.position.y, reach = Math.sqrt(Math.max(.01, .83 * .83 - (hipY - .07) * (hipY - .07)));
  // passada que a velocidade pede → quanto o quadril precisa descer para a perna alcançar (gente de verdade abaixa uns
  // centímetros num passo longo); vale no quadro seguinte, suave
  { const need = Math.min(sp * (2 / cad) * (1 - swF) * dirK, .9) / hs * .4 + .03, hc = Math.max(.7, .07 + Math.sqrt(Math.max(0, .83 * .83 - need * need)));
    p.hipCap = sp > .4 ? (p.hipCap ?? hc) + (hc - (p.hipCap ?? hc)) * Math.min(1, dt * 8) : Math.min(9, (p.hipCap ?? 9) + dt * .6); }
  const T0 = 2 / cad, capW = Math.min(1.7 * reach, .9) * Math.sqrt(hs) * dirK; // (gente mais baixa: passada proporcionalmente maior, não passinhos) // ciclo de cada pé (s) · distância que o pé fica no chão (m)
  const thrW = clamp(Math.min(sp * T0 * (1 - swF) * dirK, capW), .14, .8);
  const Te = sp > .3 ? Math.min(T0, thrW / (sp * (1 - swF))) : T0; // perna curta para a velocidade: passos mais rápidos, não mais longos
  // o pé pousa à frente de onde o corpo está indo (de lado bem mais: no deslocamento lateral a perna da frente abre primeiro
  // e o corpo vem atrás, sem o tronco passar dos pés)
  const shufK = clamp(Math.abs(lvx) / 1.4, 0, 1) * (1 - lvu);
  const leadD = thrW * (.45 + .3 * shufK), thr = thrW / hs * (p.burst > 0 || (p.accF * p.accF + p.accR * p.accR > 30 && sp < 1.6) ? .6 : 1), stepDur = clamp(swF * Te, .12, .4), spn = Math.max(sp, .01);
  // corrida cruzada (de lado para trás ou lateral longa): pés perto da linha do corpo e o de trás cruza pela frente
  const crossK = clamp((Math.abs(lvx) - 1.8) / 1.5, 0, 1) * clamp(Math.abs(p.moveTurn || 0) / .6, 0, 1);
  // deslocamento lateral de jogo (sem cruzar): base mais aberta, os pés não se juntam
  const shuf = clamp(Math.abs(lvx) / 1.4, 0, 1) * (1 - lvu) * (1 - crossK) * (1 - (p.rlx || 0));
  const wants = [0, 0], loc = [];
  for (let i = 0; i < 2; i++) {
    const s = i ? 1 : -1;
    let fx = s * (1 - .7 * crossK) * (1 + .45 * shuf) * (.17 - .07 * p.rlx + spLand * .1 + (spU >= 0 && spU < .45 ? .05 : 0) + p.lowK * .07 * (1 - run)) * (pose.feet ?? 1), fz = (pose.stag || 0) * (s > 0 ? .36 : -.08); // stag: pé de trás (do lado da raquete) recuado
    if (lungeA > .01) { if (s === lungeS) { fx = s * (.19 + .55 * lungeA); fz = -.28 * lungeA; } else fz = .12 * lungeA; }
    loc.push([fx + lvx / spn * mx * leadD / hs, fz + lvz / spn * leadD / hs]); // onde o pé deveria estar (local)
  }
  for (let i = 0; i < 2; i++) {
    const F = p.feet[i], O = p.feet[1 - i], D = loc[i];
    if (!F.w && !F.st) F.w = toW(D[0], D[1]);
    if (F.w && !air && !p.dive) { const l = toL(F.w); wants[i] = Math.hypot(l[0] - D[0], l[1] - D[1]); }
  }
  for (let i = 0; i < 2; i++) {
    const s = i ? 1 : -1, L = m.legs[i], F = p.feet[i], O = p.feet[1 - i], D = loc[i];
    let fx, fz, fy = .07;
    if (air || p.dive) {
      // no ar / mergulho: o pé segue a pose (solto do chão)
      fx = D[0]; fz = D[1];
      if (air && p.jumpMode && spU < 0) {
        const tk = i === p.jumpMode.tk; // impulso: sai atrás, cruza para a frente no meio (tesoura) e volta atrás; a outra sobe o joelho e desce para pousar primeiro
        if (p.jumpMode.serve) { const e = Math.sin(Math.PI * Math.min(1, jp * 1.1));
          if (tk) { fz += .12 + .24 * e; fy += .04 + .15 * e; } else { fz += -.05 - .14 * jp; fy += .02 + .06 * Math.sin(Math.PI * jp); } }
        else if (tk) { fz += .26 - .5 * Math.sin(Math.PI * jp) + .02; fy += .1 + .2 * Math.sin(Math.PI * jp) + .1 * jp; }
        else { fz += -.22 * Math.sin(Math.PI * Math.min(1, jp * 1.25)); fy += .26 * Math.sin(Math.PI * Math.min(1, jp * 1.2)) * (1 - jp * .6); }
      } else if (air) { const sw = jp < .45 ? 1 : -1; fy += .1 + ((s > 0) === (sw > 0) ? .12 : .02); fz += (s > 0 ? .2 : -.12) * sw; }
      F.w = null;
      F.st = { from: toW(fx, fz), y0: fy - .07, t: 0, dur: air && p.jumpMode && i === p.jumpMode.tk ? .16 : .06, h: .02 };
    } else if (F.st) {
      // passo em andamento: arco até o alvo (que acompanha o corpo até o pé pousar)
      if (!F.st.y0) { F.st.dur = Math.min(F.st.dur, Math.max(stepDur, .14)); F.st.h = Math.min(F.st.h, .035 + Math.min(sp, 6) * .014); } // parou no meio do passo: o pé desce logo
      F.st.t += dt / F.st.dur; const t = Math.min(1, F.st.t), k = t * t * (3 - 2 * t), tg = toW(D[0], D[1]);
      const w = [F.st.from[0] + (tg[0] - F.st.from[0]) * k, F.st.from[1] + (tg[1] - F.st.from[1]) * k];
      [fx, fz] = toL(w); if (crossK > 0 && s * mx * Math.sign(lvx) < 0) fz -= Math.sin(Math.PI * t) * .16 * crossK; fy += (F.st.y0 || 0) * (1 - k) + Math.pow(Math.sin(Math.PI * t), .9 - .3 * run) * F.st.h; // andando: arco baixo e redondo; correndo: sai e chega rápido
      if (t >= 1) {
        const land = F.st.y0; F.w = tg; F.st = null; p.dip = Math.max(p.dip || 0, .008 + .022 * run + (land ? .03 : 0)); // o peso cai no pé: joelho cede um pouco
        // pisada que tumultua a areia: pouso de salto, arrancada/freada forte ou corrida rápida (de vez em quando) arrasta areia
        if (m.group.visible && (land || Math.abs(p.accF || 0) > 7 || Math.abs(p.accR || 0) > 7 || (sp > 3.2 && Math.random() < .3))) {
          const hard = clamp(Math.max(Math.abs(p.accF || 0), Math.abs(p.accR || 0)) / 14, 0, 1);
          if (land || hard > .5 || Math.random() < .55) scuffMark(tg[0], tg[1], p.vel.x || -Math.sin(yaw) * .1, p.vel.z || -Math.cos(yaw) * .1, .22 + .2 * hard + (land ? .12 : 0) + Math.random() * .08); }
        if ((sp > .5 || land) && m.group.visible) { stamp(tg[0], tg[1], yaw, s * mx, clamp((sp - 3) / 3, 0, 1)); if (particles.visible && (sp > 3.5 || land)) puff(tg[0], tg[1], land ? 8 : 3, land ? .55 : .38, p.vel.x * .1, p.vel.z * .1, land ? .35 : 0); }
      }
    } else {
      // plantado: fica onde está; passo quando se afastou do lugar certo (o mais longe vai primeiro; correndo, sobrepõe)
      [fx, fz] = toL(F.w);
      // andando: um pé de cada vez. Correndo: alternado por fase — este pé sai meio ciclo depois do outro ter saído (se
      // atrasado, sai mesmo assim um pouco depois do limite), senão os dois acabam pousando juntos (galope)
      let go;
      if (sp <= 2.6) go = wants[i] > thr * (O.st ? 1 : .999) && !O.st && (wants[i] >= wants[1 - i] || wants[1 - i] <= thr);
      else { const since = p.gT - (O.lt ?? -9); go = (wants[i] > thr * .8 && since >= .9 / cad) || (wants[i] > thr * 1.25 && since > .08); }
      if (go || wants[i] > Math.max(.75, thr * 1.6)) {
        F.lt = p.gT;
        const st = { from: F.w.slice(), y0: 0, t: 0, dur: stepDur, h: .025 + Math.min(sp, 6) * .014 };
        F.st = st; F.w = null;
      }
    }
    // rolagem do pé: no fim do apoio o calcanhar sobe (gira na ponta), na saída a ponta empurra para baixo, no ar os dedos
    // ficam esticados; o modelo 3D inclina o pé com isso (L.roll)
    let rollT = 0;
    if (air) rollT = .35;
    else if (F.st) { const t = Math.min(1, F.st.t); rollT = t < .4 ? .65 * (1 - t / .4) : 0; }
    else if (!p.dive && thr > 0) { const rr = wants[i] / thr; rollT = rr > .45 ? .75 * clamp((rr - .45) / .55, 0, 1) * Math.min(1, sp / 1.2) : 0; fy += Math.sin(L.roll || 0) * .14; } // saída: o calcanhar sobe e a ponta empurra (a perna de trás estica sem o quadril afundar)
    L.roll = (L.roll || 0) + (rollT - (L.roll || 0)) * Math.min(1, dt * 22);
    _a.set(fx - m.hips.position.x, fy - m.hips.position.y, fz - m.hips.position.z).applyQuaternion(_hq);
    _b.set(s * (.12 + .55 * clamp((Math.abs(fx) - .17) / .25, 0, 1)), 0, -1).applyQuaternion(_hq); // base aberta: joelho aponta para fora (sobre o pé), não para dentro
    ik2(L.thigh, L.knee, L.thigh.position, _a, _b, .42, .43);
    _q1.copy(m.hips.quaternion).multiply(L.thigh.quaternion).multiply(L.knee.quaternion).invert();
    L.ankle.quaternion.copy(_q1);
  }
  // ao pousar de um salto em uma perna: a de impulso apoia um pouco depois (o passo dela já está armado acima)
  if (!air && p.jumpMode) p.jumpMode = null;
  // ritmo do corpo a partir dos pés: fase do passo (braços e quadril balançam junto), sobe e desce (andando o corpo passa
  // por cima da perna de apoio e sobe; correndo afunda no apoio e sobe no voo) e o joelho que cede ao pisar
  { const F0 = p.feet[0].st, F1 = p.feet[1].st, sw = !air && !p.dive ? (F0 ? F0 : F1) : null;
    if (sw) { const ph = (F0 ? 0 : Math.PI) + Math.PI * Math.min(1, sw.t), d = Math.atan2(Math.sin(ph - p.gait), Math.cos(ph - p.gait)); p.gait += d; }
    const bobT = sw ? (lerp(.014, -.026, clamp((sp - 2.2) / 2, 0, 1)) * Math.sin(Math.PI * Math.min(1, sw.t)) * p.strK) : 0;
    p.bobY = (p.bobY || 0) + (bobT - (p.bobY || 0)) * Math.min(1, dt * 18);
    // peso sobre o pé de apoio: andando o quadril passa por cima da perna que está no chão (correndo quase não)
    const wsT = sw ? (F0 ? 1 : -1) * .032 * (1 - run * .7) * p.strK : 0; p.wsx = (p.wsx || 0) + (wsT - (p.wsx || 0)) * Math.min(1, dt * 10);
    p.dip = (p.dip || 0) * Math.exp(-dt * 11); }
  // roupa: mola frouxa puxada pela aceleração (arrancou → a barra fica para trás; freou → vai para a frente), pelo vento
  // da corrida e pelo pisão (espaço do modelo: +z frente, +x esquerda)
  if (p.skinU && p.skinU.uSway) { const c = p.cloth || (p.cloth = { x: 0, z: 0, vx: 0, vz: 0 }), W = 11, Z = .32;
    const tx = clamp((p.accR || 0) * .005, -.06, .06), tz = clamp(-(p.accF || 0) * .005 - fwd * .009, -.08, .06);
    const n = Math.max(1, Math.ceil(dt / .008)), h = dt / n;
    for (let k = 0; k < n; k++) { c.vx += (W * W * (tx - c.x) - 2 * Z * W * c.vx) * h; c.vz += (W * W * (tz - c.z) - 2 * Z * W * c.vz) * h; c.x += c.vx * h; c.z += c.vz * h; }
    p.skinU.uSway.value.set(c.x, (p.dip || 0) * .5, c.z); }
  // braços
  const shR = m.armR.sh.position, shL = m.armL.sh.position;
  _c.fromArray(pose.rh);
  if (swingU >= 0 && ball.state !== 'held') {
    // antes do contato a raquete vai buscando a bola; depois, fica no ponto onde bateu e acompanha o movimento
    const hitDone = p.swing.hit && p.contact && p.contact.hitId === S.hitId;
    const pre = !hitDone && S.mode === 'replay' && p.contact && p.contact.pre; // replay: já se sabe onde e quando vai bater
    const cu = hitDone || pre ? p.contact.u : .45;
    const w = hitDone ? clamp(1 - (swingU - cu) / .22, 0, 1) : clamp(1 - Math.abs(swingU - cu) / .3, 0, 1);
    if (w > 0) {
      if (hitDone || pre) _e.set(p.contact.x, p.contact.y, p.contact.z); else _e.copy(ball.pos);
      m.spine.worldToLocal(_e);
      // perto do limite a raquete solta a bola aos poucos (antes ligava/desligava de uma vez: tranco no smash)
      const dd = _e.distanceTo(shR), fade = clamp((2.6 - dd) / .5, 0, 1);
      if (fade > 0) { _g.copy(_e).sub(shR).normalize(); _e.addScaledVector(_g, -.34); _c.lerp(_e, Math.min(1, w * 1.1) * fade); }
    }
  }
  else if (!p.charging && run > .3) { _c.z += Math.cos(p.gait) * .13 * run * lvu; _c.y += Math.abs(Math.sin(p.gait)) * .03 * run; } // braço da raquete balança pouco na corrida
  // solto: raquete desce ao lado do corpo e o braço balança (ao contrário da perna do mesmo lado)
  if (swingU < 0 && !p.charging && p.rlx > .01) { const am = .03 + .07 * run; _e.set(.12, .02 + .08 * run + Math.sin(p.gait * 2) * .012, -.27 + Math.cos(p.gait) * am); _c.lerp(_e, p.rlx); }
  _b.fromArray(pose.rp);
  const celPh = cel ? (!mateC ? (cel.title ? 'up' : '') : cel.t < 1.0 ? '' : cel.t < 1.6 ? 'five' : cel.title && cel.t < 3.4 ? 'hug' : cel.title ? 'up' : '') : '';
  // quem perdeu o ponto reage (um jeito por ponto e por jogador): mão na cabeça, raquete batendo na areia, mãos na cintura
  // ou balança a cabeça; entra e sai suave
  // quem ganhou às vezes vibra (punho cerrado / raquete para cima); quem perdeu quase sempre reage
  const rk = ((S.ptN || 0) * 7 + p.team * 3 + (p.slot > 0 ? 5 : 0)) % 8, won = S.ptWin === p.team;
  const lose = !cel && !pc && !S.sideWalk && S.mode === 'dead' && S.ptWin !== undefined && (!won || rk < 3) ? { t: S.ptT || 0 } : null;
  const lsW = lose ? clamp((lose.t - .35) / .25, 0, 1) * clamp((1.9 - lose.t) / .35, 0, 1) : 0;
  const lsK = lose ? (won ? ['fist', 'rkup', 'fist'][rk % 3] : ['head', 'tap', 'hips', 'shake', 'tap', 'head', 'shake', 'hips'][rk]) : '';
  if (celPh === 'hug') { _c.set(.2, .5, -.32); _b.set(.9, -.3, .2); }
  else if (celPh === 'up') { _c.set(.18, 1.05, -.05); _b.set(.8, 0, .3); }
  // gesto com o parceiro: o braço estica na direção dele (de frente ou de lado, conforme o quanto viraram). Raquete com
  // raquete usa o braço da raquete; tapa/toque usa a mão do lado em que o parceiro está
  let pgDir = null, pgR = false;
  if (pgW > 0 && pMate) { pgDir = _v2.set(pMate.pos.x - p.pos.x, 0, pMate.pos.z - p.pos.z).normalize().applyQuaternion(m.spine.getWorldQuaternion(_q1).invert()); pgR = pc.kind === 'rk' || pgDir.x > .15; }
  if (pgDir && pgR) { _e.copy(shR).addScaledVector(pgDir, .6); _e.y += pc.kind === 'five' ? .45 : pc.kind === 'rk' ? .12 : -.25; _e.z -= .12; _c.lerp(_e, pgW); }
  if (lsW > 0) { if (lsK === 'rkup') _e.set(.2, .95, -.15); else if (lsK === 'fist') _e.set(.22, .3, -.28); else if (lsK === 'head') _e.set(.12, .8, .02); else if (lsK === 'tap') _e.set(.28, -.28 + .07 * Math.abs(Math.sin(lose.t * 13)), -.34); else if (lsK === 'hips') _e.set(.22, .02, .03); else _e.set(.2, .0, -.12); _c.lerp(_e, lsW); }
  // peixinho: o braço da raquete vai esticado para a frente do mergulho (para onde a bola está)
  if (tiltK > .05 && p.dive) { _g.set(p.dive.dx, 0, p.dive.dz).applyQuaternion(m.spine.getWorldQuaternion(_q1).invert()); _e.copy(shR).addScaledVector(_g, .62); _c.lerp(_e, tiltK * (swingU >= 0 && !p.swing.hit ? .45 : .85)); }
  armIK(p, m.armR, shR, _c, _b);
  { const rl = swingU < 0 && !p.charging ? (p.rlx || 0) : 0; m.armR.wrist.rotation.set(lerp(pose.wx, RLX_WX, rl), lerp(pose.wr, RLX_WR, rl), 0); } // andando solto: raquete inclinada para a frente, na cintura
  _c.fromArray(pose.lh); _b.fromArray(pose.lp);
  if (celPh === 'five') { _c.set(-.12, 1.0, -.4); _b.set(-.8, 0, .4); }
  else if (celPh === 'hug') { _c.set(-.2, .52, -.32); _b.set(-.9, -.3, .2); }
  else if (celPh === 'up') { _c.set(-.18, 1.05, -.05); _b.set(-.8, 0, .3); }
  if (pgDir && !pgR) { _e.copy(shL).addScaledVector(pgDir, .6); _e.y += pc.kind === 'five' ? .45 : -.25; _e.z -= .12; _c.lerp(_e, pgW); } // tapa de mão no alto ou toque baixo
  // braço livre balança ao contrário da perna do mesmo lado (mais na corrida para frente/trás que na lateral)
  if (swingU < 0 && !p.charging && run > .3 && !celPh) { _c.y += Math.sin(p.gait) * .04 * run; _c.z -= Math.cos(p.gait) * .17 * run * lvu; }
  // mão livre: na frente do corpo, apoiando a raquete pelo pescoço (pronta para o backhand); correndo solta um pouco e balança
  if (swingU < 0 && !p.charging && p.rlx > .01 && !celPh && p.prep < .05) { const am = .02 + .1 * run; _e.set(-.01 - .12 * run, .08 + .06 * run, -.3 + .1 * run - Math.cos(p.gait) * am); _c.lerp(_e, p.rlx); }
  if (p.prep > .05 && ball.state === 'live' && !celPh) { // mão livre aponta a bola
    _e.copy(ball.pos); m.spine.worldToLocal(_e); _g.copy(_e).sub(shL);
    if (_g.lengthSq() > 1e-4) { _g.normalize(); _e.copy(shL).addScaledVector(_g, .5); _c.lerp(_e, p.prep * .85); }
  }
  // mão livre: no peixinho vai à areia para apoiar; esticando para uma bola longe, abre para o outro lado (equilíbrio)
  if (p.twoH > 0 && !celPh) { _e.fromArray(pose.rh); _e.x += .07; _e.y += .03; _e.z += .04; _c.lerp(_e, p.twoH); }
  if (tiltK > .05) { _g.set(0, -1, 0).applyQuaternion(_q1.copy(m.spine.getWorldQuaternion(_q1)).invert()); _e.set(-.12, .35, -.25).addScaledVector(_g, .45); _c.lerp(_e, tiltK); } // peixinho: a mão livre vai à areia embaixo do peito
  else if (diveK > .05) { _e.set(-.3, -.6, -.4); _c.lerp(_e, clamp(diveK * 1.4, 0, 1)); }
  else if (swingU >= 0 && p.reachK > .15 && !celPh) { _e.set(-reachS * .48, .28, -.04); _c.lerp(_e, .7 * p.reachK); }
  if (lsW > 0) { if (lsK === 'fist') _e.set(-.2, .5 + .08 * Math.abs(Math.sin(lose.t * 10)), -.2); else if (lsK === 'head') _e.set(-.12, .8, .02); else if (lsK === 'hips') _e.set(-.22, .02, .03); else _e.set(-.2, .02, -.1); _c.lerp(_e, lsW); }
  armIK(p, m.armL, shL, _c, _b);
  m.armL.wrist.rotation.set(.2, 0, 0);
  // cabeça acompanha a bola
  if (ball.state !== 'held' || S.serverPlayer === p) {
    _e.copy(ball.pos); m.spine.worldToLocal(_e); _e.y -= .72;
    const hy = clamp(Math.atan2(-_e.x, -_e.z), -1.1, 1.1);
    const hp = clamp(Math.atan2(_e.y, Math.hypot(_e.x, _e.z)), -.5, .85);
    p.headYaw += (hy - p.headYaw) * Math.min(1, dt * 8); p.headPitch += (hp - p.headPitch) * Math.min(1, dt * 8);
  } else { p.headYaw *= .9; p.headPitch *= .9; }
  m.headG.rotation.set(p.headPitch + lsW * (lsK === 'head' ? -.15 : lsK === 'fist' || lsK === 'rkup' ? -.1 : .3), p.headYaw + (lsK === 'shake' ? Math.sin((lose ? lose.t : 0) * 9) * .35 * lsW : 0), -(m.spine.rotation.z + m.hips.rotation.z) * .7); // cabeça fica nivelada (olhos na horizontal) quando o tronco inclina
  if (m.tail) {
    m.tail.rotation.x += (-(.25 + clamp(fwd * .06, -.2, .5) + jy * 1.5) - m.tail.rotation.x) * Math.min(1, dt * 5);
    m.tail.rotation.z += (clamp(lvx * .05, -.4, .4) - m.tail.rotation.z) * Math.min(1, dt * 5);
  }
  m.blob.position.y = .012 - jy; const bs = 1 - jy; m.blob.scale.set(bs, bs, 1);
  m.group.updateMatrixWorld(true);
}
// braço em primeira pessoa usa rotações simples
// sh: braço, ph: abertura, tw: giro, fw: punho (1,57 = raquete em pé; 0 = raquete na linha do antebraço)
const FP_UP = Math.PI / 2;
const FPKF = {
  smash:  { sh: [.5, 3.0, 3.3, 1.0, .5],  ph: [.2, .35, .2, .1, .2],   tw: [0, -.6, -.4, .5, 0],   fw: [0, .2, 0, .3, 0] },
  lob:    { sh: [.5, -.5, -.4, 2.4, .5],  ph: [.2, .5, .5, .2, .2],    tw: [0, -.6, -.6, .4, 0],   fw: [0, -.3, 0, .5, 0] },
  curta:  { sh: [.5, .65, .75, 1.1, .5],  ph: [.2, .45, .45, .3, .2],  tw: [0, -.3, -.3, .15, 0],  fw: [0, .15, -.1, .2, 0] },
  defesa: { sh: [.5, 1.0, 1.1, 1.5, .5],  ph: [.2, 1.0, 1.0, .5, .2],  tw: [0, -.8, -.8, .2, 0],   fw: [0, 1.1, 1.2, 1.3, 0] },
  // curta alta de forehand: braço à frente e alto, raquete em pé com a face para a rede
  curta_alta_fh: { sh: [.5, 1.6, 1.75, 1.55, .5], ph: [.2, .25, .25, .2, .2], tw: [0, -.1, .1, .15, 0], fw: [0, 1.45, 1.57, 1.5, 0] },
  // ventaglio: começa cruzado do lado do backhand com a raquete baixa, sobe pela frente girando o punho e termina
  // com a mão na frente do corpo e a raquete apontando para a frente
  smash_ventaglio: { sh: [.5, 1.25, 1.85, 1.6, .5], ph: [.2, .3, .3, .15, .2], tw: [0, .75, .7, .35, 0], fw: [0, .1, 1.57, .2, 0] },
};
function kf(arr, u, rest) {
  for (let i = 0; i < 4; i++) {
    if (u <= KU[i + 1]) {
      let t = (u - KU[i]) / (KU[i + 1] - KU[i]); t = t * t * (3 - 2 * t);
      const a = i === 0 ? rest : arr[i];
      const b = i === 3 ? rest : arr[i + 1];
      return lerp(a, b, t);
    }
  }
  return rest;
}
// variação do golpe na 1ª pessoa (a mesma escolha da animação do corpo)
function fpKey(p) {
  const ak = swingKey(p), bh = (p.swing.type === 'defesa' || p.swing.type === 'curta' || p.swing.type === 'lob') && p.swing.side < -.15;
  return ak === 'curta_alta' && !bh ? 'curta_alta_fh' : ak;
}
function animateFP() {
  const p = human; let th = 1.2, ph = .12, ry = -.35, fw = FP_UP;
  if (p.charging) { const c = clamp(MTR.t / .18, 0, 1); th = lerp(1.2, MTR.type === 'lob' ? -.4 : 3.0, c); fw = lerp(FP_UP, MTR.type === 'lob' ? -.2 : .2, c); }
  else if (S.mode === 'toss' && S.serverPlayer === p) { const c = clamp(p.tossT / (p.tossDur || TOSS_T) / .75, 0, 1); th = lerp(1.2, 3.0, c); fw = lerp(FP_UP, .2, c); }
  else if (p.fpDebug) { const k = FPKF[p.fpDebug.key], u = p.fpDebug.u; th = kf(k.sh, u, 1.2); ph = kf(k.ph, u, .12) * .6; ry = -.35 + kf(k.tw, u, 0) * .5; fw = kf(k.fw, u, FP_UP); }
  else if (p.swing.t >= 0) {
    const u = clamp(p.swing.t / p.swing.dur, 0, 1), ak = fpKey(p), k = FPKF[ak] || FPKF[p.swing.type];
    th = kf(k.sh, u, 1.2); ph = kf(k.ph, u, .12) * .6; ry = -.35 + kf(k.tw, u, 0) * .5; fw = kf(k.fw, u, FP_UP);
  } else { th += Math.sin(p.gait) * .04 * Math.min(1, Math.hypot(p.vel.x, p.vel.z) / 4); }
  fpArm.rotation.set(th, ry, ph);
  if (fpArm.parent) fpArm.parent.scale.x = p.lefty ? -1 : 1; // canhoto: braço e raquete do lado esquerdo
  if (fpWrist) fpWrist.rotation.set(fw, 0, -.15);
}
const camPos = new V3(0, 6, 16), camLook = new V3(0, 1, 0), tmpA = new V3(), tmpB = new V3();
let fpBodyOn = false;
function setFpBody(on) {
  if (on === fpBodyOn && human.model.__fpModel === human.model) return;
  fpBodyOn = on; human.model.__fpModel = human.model;
  const m = human.model;
  const sk = !!(human.skin && human.skinOn); // modelo realista: o desenhado fica todo escondido (senão o boné/cabelo dele aparecia por cima)
  m.headG.traverse(o => { if (o.isMesh) o.visible = !on && !o.userData.off && !sk; });
  // tronco, pescoço e braço de cima somem (passariam colados no olho); antebraço, mão e raquete continuam
  (m.fpHide || []).forEach(o => { o.visible = !on && !sk; });
}
const _eye = new V3();
// ângulos da 3ª pessoa ([simples, dupla]): altura, recuo, quanto segue o jogador de lado, para onde olha.
// zf: quanto a câmera acompanha a profundidade do jogador (1 = colada nele; menos = mais fixa, como na TV)
const CAM3 = {
  padrao: { nome: 'Padrão', h: [3.4, 3.7], back: [5.8, 6.4], fx: [.75, .55], lx: [.35, .2], ly: 1.0, lz: -6.5, zf: 1 },
  alta: { nome: 'Alta (TV)', h: [6.4, 7.0], back: [7.6, 8.4], fx: [.4, .3], lx: [.15, .1], ly: .2, lz: -5.5, zf: .55 },
  perto: { nome: 'Perto', h: [2.6, 2.75], back: [3.9, 4.3], fx: [.9, .85], lx: [.5, .4], ly: .85, lz: -6, zf: 1 },
};
function updateCamera(dt) {
  const k = 1 - Math.exp(-dt * 7);
  const fp = S.settings.cam === '1p' && S.mode !== 'menu' && S.mode !== 'replay';
  const fpBody = fp && !(human.skin && human.skinOn);
  setFpBody(fpBody);
  // na espera mostra a raquete em pé no canto; armando ou batendo, entra o braço animado do jogador
  human.model.group.visible = !fp || fpBody;
  // 1ª pessoa: sempre o braço da câmera (com a sua raquete); os braços do corpo somem (não aparecem do nada nem trocam de raquete)
  human.model.armR.el.visible = !fpBody; human.model.armL.el.visible = !fpBody;
  fpArm.visible = fp;
  if (S.mode === 'menu') {
    S.orbit += dt * .06;
    tmpA.set(Math.sin(S.orbit) * 12, 3.2 + Math.sin(S.orbit * .7) * 1.2, Math.cos(S.orbit) * 12);
    camPos.lerp(tmpA, .04); tmpB.set(0, 1.2, 0); camLook.lerp(tmpB, .04);
  } else if (!fp) {
    const d = dupla() ? 1 : 0, V = CAM3[S.settings.cam3] || CAM3.padrao, dk = (S.settings.camDist || 100) / 100, hk = (S.settings.camHeight || 100) / 100;
    const bz = lerp(6, human.pos.z, V.zf); // profundidade que a câmera acompanha
    tmpA.set(human.pos.x * V.fx[d], V.ly + (V.h[d] - V.ly) * dk * hk, bz + V.back[d] * dk); camPos.lerp(tmpA, k);
    // bola muito alta (lob alto): a câmera olha um pouco para cima, para ela não sumir da tela e "reaparecer" já caindo
    const hb = ball.state === 'live' ? clamp((ball.pos.y - 4) * .45, 0, 2.6) : 0;
    tmpB.set(human.pos.x * V.lx[d], V.ly + hb, bz + V.lz); camLook.lerp(tmpB, k);
  } else {
    const bob = Math.abs(Math.sin(human.gait)) * .025 * Math.min(1, Math.hypot(human.vel.x, human.vel.z) / 4);
    if (fpBodyOn) { human.model.headG.localToWorld(_eye.set(-.04, .11, -.06)); camPos.copy(_eye); }
    else camPos.set(human.pos.x, (human.model.hips.position.y + .78) * hScale(human) + bob + human.model.group.position.y * .8, human.pos.z + .05);
    // direção base: quadra adversária; quando a bola vem para você, a cabeça segue a bola (até olhar para cima no smash)
    tmpB.set(human.pos.x * .6, 1.35, human.pos.z - 9).sub(camPos).normalize();
    let yaw = Math.atan2(tmpB.x, -tmpB.z), pitch = Math.asin(clamp(tmpB.y, -1, 1));
    const live = ball.state === 'live' || ball.state === 'toss' || ball.state === 'dead';
    const w = !live ? 0 : (ball.state === 'live' && S.lastTeam === 1) ? .92 : ball.state === 'toss' ? .6 : .45;
    if (w > 0) {
      tmpA.copy(ball.pos).sub(camPos);
      if (tmpA.lengthSq() > 1e-4) {
        tmpA.normalize();
        const by = clamp(Math.atan2(tmpA.x, -tmpA.z), -1.35, 1.35), bp = clamp(Math.asin(clamp(tmpA.y, -1, 1)), -.6, 1.25);
        yaw = lerp(yaw, by, w); pitch = lerp(pitch, bp, w);
      }
    }
    const kk = 1 - Math.exp(-dt * 9);
    S.fpYaw = (S.fpYaw === undefined || !isFinite(S.fpYaw)) ? yaw : S.fpYaw + (yaw - S.fpYaw) * kk;
    S.fpPitch = (S.fpPitch === undefined || !isFinite(S.fpPitch)) ? pitch : S.fpPitch + (pitch - S.fpPitch) * kk;
    const cp = Math.cos(S.fpPitch);
    camLook.set(camPos.x + Math.sin(S.fpYaw) * cp * 5, camPos.y + Math.sin(S.fpPitch) * 5, camPos.z - Math.cos(S.fpYaw) * cp * 5);
  }
  if (!isFinite(camPos.x + camPos.y + camPos.z)) camPos.set(0, 3.4, 12);
  if (!isFinite(camLook.x + camLook.y + camLook.z)) camLook.set(0, 1, 0);
  if (S.debugCam) { camPos.fromArray(S.debugCam.pos); camLook.fromArray(S.debugCam.look); }
  camera.position.copy(camPos);
  if (S.shake > 0) { S.shake = Math.max(0, S.shake - dt); const s = S.shake * .12; camera.position.x += rand(-s, s); camera.position.y += rand(-s, s); }
  camera.lookAt(camLook);
  sky.position.copy(camera.position);
  // a área de sombra acompanha a jogada
  sun.target.position.set(human.pos.x * .5, 0, human.pos.z * .3);
  sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 40);
}
const _mv = new V3();
function placeMeter(fp) {
  if (el.meter.hidden) return;
  let mx, my;
  if (fp) { mx = innerWidth * .63; my = innerHeight * .64; }
  else {
    _mv.set(human.pos.x, 1.75 + human.model.group.position.y, human.pos.z).project(camera);
    mx = (_mv.x * .5 + .5) * innerWidth + 60; my = (-_mv.y * .5 + .5) * innerHeight;
  }
  el.meter.style.left = clamp(mx, 30, innerWidth - 120) + 'px';
  el.meter.style.top = clamp(my, 150, innerHeight - 40) + 'px';
  if (MTR.active) {
    const v = MTR.v;
    el.mFill.style.height = (clamp(v, 0, 1) * 100) + '%';
    if (MTR.kind === 'lob') { el.mFill.style.height = (clamp(v / (MTR.lmax || LOB_MAX), 0, 1) * 100) + '%'; el.meter.classList.toggle('over', v > 1); }
    else el.meter.classList.toggle('in', Math.abs(v - MTR.center) <= MTR.half);
  }
}
// etiqueta com nome e overall acima de cada jogador
const _tv = new V3();
const TAGS = new Map();
function tagFor(p) {
  let t = TAGS.get(p);
  if (!t) { t = document.createElement('div'); t.className = 'tag'; $('tags').appendChild(t); TAGS.set(p, t); }
  return t;
}
function updateTags(fp) {
  for (const p of ALL) {
    const t = tagFor(p);
    const show = S.mode !== 'menu' && S.mode !== 'replay' && $s.players.includes(p) && !(fp && p === human);
    if (!show) { t.hidden = true; continue; }
    _tv.set(p.pos.x, 2.12 * hScale(p) + p.model.group.position.y, p.pos.z).project(camera);
    if (_tv.z > 1 || Math.abs(_tv.x) > 1.2 || Math.abs(_tv.y) > 1.2) { t.hidden = true; continue; }
    t.hidden = false;
    const me = p === human && !S.spectate;
    const nn = !me && NET.role && p.netName ? p.netName : ''; // online: nome de quem joga com o boneco
    const key = (p.char ? p.char.id + nameOf(p.char) : p.name) + me + nn;
    if (t.dataset.k !== key) {
      t.dataset.k = key;
      t.className = 'tag t' + p.team + (me ? ' me' : nn ? ' net' : '');
      t.innerHTML = '';
      if (me || nn) { const e = document.createElement('em'); e.textContent = me ? 'VOCÊ' : nn.toUpperCase(); t.append(e); }
      t.append(p.char ? shortOf(p.char) : p.name);
      if (p.char) { const b = document.createElement('b'); b.textContent = overall(p.char.a); t.append(b); }
    }
    t.style.left = ((_tv.x * .5 + .5) * innerWidth) + 'px';
    t.style.top = ((-_tv.y * .5 + .5) * innerHeight) + 'px';
  }
}
function updateVisuals(dt) {
  updateAimMarker();
  if ($s.defRingT > 0) { $s.defRingT = Math.max(0, $s.defRingT - dt); const k = 1 - $s.defRingT / .5; defRing.scale.setScalar(1 + k * 1.6); defRing.material.opacity = .7 * (1 - k); if ($s.defRingT === 0) defRing.visible = false; }
  for (const p of ALL) if (p.model.group.visible || p === human) animateAthlete(p, dt);
  for (const p of ALL) if (p.skin && p.skinOn) driveSkin(p);
  animateFP();
  updateParticles(dt);
  ballMesh.position.copy(ball.pos);
  ballMesh.rotation.x += dt * ball.vel.length() * 2; ballMesh.rotation.y += dt * 3;
  ballMesh.visible = S.mode !== 'menu';
  ballShadow.visible = ballMesh.visible;
  ballShadow.position.set(ball.pos.x, .014, ball.pos.z);
  const sh = clamp(1 - ball.pos.y / 8, .35, 1); ballShadow.scale.set(sh, sh, 1); ballShadow.material.opacity = sh * .8;
  if (ball.state === 'live' || ball.state === 'toss') {
    trailPos.copyWithin(3, 0, (TRAIL_N - 1) * 3);
    trailPos[0] = ball.pos.x; trailPos[1] = ball.pos.y; trailPos[2] = ball.pos.z;
    trailGeo.attributes.position.needsUpdate = true; trail.visible = true;
  } else trail.visible = false;
  const incoming = ball.state === 'live' && S.lastTeam === 1 && S.mode === 'rally';
  const mine = incoming && assignee(0) === human;
  if (incoming && S.settings.assistMark) {
    // noção de jogo de quem você controla: no 87 o anel é o normal; abaixo, maior e um pouco fora do lugar (no 40, ~2× o raio)
    const lv = human.char ? attrOf(human.char.a, 'leitura') : 87, rk = lv >= 87 ? lerp(1, .85, (lv - 87) / 12) : 1 + (87 - lv) / 47;
    // a bola cai em qualquer ponto dentro do anel (não só no meio): o anel é a área de incerteza; quanto maior, menos você sabe
    if (RING_ERR.id !== S.hitId) { const an = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * .2 * rk; RING_ERR.id = S.hitId; RING_ERR.x = Math.cos(an) * d; RING_ERR.z = Math.sin(an) * d; }
    const l = predictLanding(); landRing.position.set(l.x + RING_ERR.x, .02, l.z + RING_ERR.z); landRing.visible = true;
    landRing.material.color.copy(mine ? RING_MINE : RING_MATE); landRing.material.opacity = mine ? .8 : 1; // o do parceiro mais forte
    const pulse = (1 + Math.sin(performance.now() / 90) * .12) * rk * (mine ? 1 : 1.12); landRing.scale.set(pulse, pulse, 1);
  } else landRing.visible = false;
  hudHints(incoming);
  const fp = S.settings.cam === '1p' && S.mode !== 'replay';
  reachRing.visible = S.mode !== 'menu' && S.mode !== 'replay' && !fp && !S.spectate;
  reachRing.position.set(human.pos.x, .02, human.pos.z);
  { const rs = reachOf('defesa', human) / 1.335; reachRing.scale.set(rs, rs, 1); } // anel do tamanho real do alcance da defesa
  const ready = incoming && canHit(human, 'lob');
  const readyDef = incoming && canHit(human, 'defesa');
  const high = ball.pos.y >= 1.9;
  // dica de timing (curta/defesa): amarelo = vem aí, verde = aperte agora, laranja = já está no alcance (atrasado)
  const ttr = incoming && human.swing.t < 0 && !human.charging && ball.pos.y < 2.2 ? timeToReach(human) : null;
  const cue = readyDef ? 0xffb11f : ttr !== null && ttr >= .05 && ttr <= .28 ? 0x4fd18b : ttr !== null && ttr <= .5 ? 0xffd23f : 0xffffff;
  reachRing.material.color.setHex(cue);
  { const tc = document.getElementById('tcue'); if (tc) { const k = cue === 0x4fd18b ? 'now' : cue === 0xffd23f ? 'prep' : cue === 0xffb11f && ttr !== null ? 'late' : ''; tc.hidden = !k || ball.pos.y > 2.2 || !!S.spectate; if (k && tc.className !== k) { tc.className = 'hud ' + k; const sp = tc.querySelector && tc.querySelector('span'); if (sp) sp.textContent = k === 'now' ? 'AGORA' : k === 'prep' ? 'PREPARA' : 'ATRASADO'; } } }
  reachRing.material.opacity = cue === 0xffffff ? (S.settings.assistMark ? .18 : 0) : .65;
  placeMeter(fp);
  updateTags(fp);
  if (ball.state === 'held') placeHeldBall();
  const serveMine = S.mode === 'serve' && S.serverPlayer === human;
  shotBtns.smash.classList.toggle('ready', serveMine || (ready && high) || human.charging);
  shotBtns.lob.classList.toggle('ready', serveMine || ready);
  shotBtns.curta.classList.toggle('ready', serveMine || ready);
  shotBtns.defesa.classList.toggle('ready', serveMine || readyDef);
  const showMate = dupla() && incoming && !mine && !(ready || readyDef);
  el.reach.classList.toggle('on', S.mode !== 'menu' && !S.spectate && (ready || readyDef || showMate));
  el.reach.classList.toggle('mate', showMate);
  el.reach.textContent = showMate ? 'BOLA DA PARCEIRA' : ready && high ? 'BOLA ALTA · SMASH' : ready ? 'NO ALCANCE' : 'SÓ DEFESA ALCANÇA';
}

export { CAM3, READY_FP, sideOf, updateCamera, updateVisuals };
