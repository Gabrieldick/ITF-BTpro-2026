// @ts-nocheck
// animação procedural com cinemática inversa e câmera
import './17-bola';
import * as THREE from 'three';
import { $s } from '../state';
import { TOSS_T, V3, clamp, hScale, lerp, nameOf, overall, rand, shortOf } from './00-base';
import { S } from './01-estado';
import { SUN_DIR, camera, sun } from './02-render';
import { sky } from './03-cenario';
import { ACT, KU, P, READY, SERVE_KEYS, SERVE_U, mirrorPose, newPose, poseAt, swingKey, uOf } from './04-poses';
import { ALL, human } from './06-modelos';
import { RING_MATE, RING_MINE, TRAIL_N, ball, ballMesh, ballShadow, driveSkin, fpArm, fpWrist, landRing, particles, puff, reachRing, stamp, trail, trailGeo, trailPos, updateParticles } from './07-glb';
import { $, dupla, el, placeHeldBall, shotBtns } from './09-interface';
import { canHit, predictLanding, reachOf } from './10-fisica';
import { defRing, updateAimMarker } from './11-mira';
import { LOB_MAX, MTR, timeToReach } from './12-controles';
import { assignee } from './16-ia';
// ---------- Animação: cinemática inversa em braços e pernas ----------
const _id = new V3(), _iu = new V3(), _iw = new V3(), _in = new V3(), _iX = new V3(), _iY = new V3(), _iZ = new V3(), _im = new THREE.Matrix4();
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
function sideOf(p, pt) { const q = pt || ball.pos; return (q.x - p.pos.x) * (p.team === 0 ? 1 : -1) * (p.lefty ? -1 : 1); }
const _a = new V3(), _b = new V3(), _c = new V3(), _e = new V3(), _g = new V3(), _q1 = new THREE.Quaternion(), _hq = new THREE.Quaternion();
function blendPose(dst, src, k) {
  for (const key in src) { if (Array.isArray(src[key])) { for (let j = 0; j < 3; j++) dst[key][j] += (src[key][j] - dst[key][j]) * k; } else dst[key] += (src[key] - dst[key]) * k; }
}
const READY_KEYS = [READY, READY], READY_U = [0, 1];
const READY_FP = P({ rh: [.26, .42, -.46], rp: [.9, -.6, .3], wx: 1.35, wr: 1.0, lh: [-.06, .3, -.4] });
const READY_FP_KEYS = [READY_FP, READY_FP];
// preparação do smash: corpo de lado (ombro da mão livre para a rede), mão livre apontando a bola
// 1 enquanto se prepara; no golpe o corpo desenrola até o contato
function smashPrep(p, swingU) {
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
    if (p.debug.type === 'serve') poseAt(SERVE_KEYS, SERVE_U, p.debug.u, pose);
    else { swingU = p.debug.u; poseAt(ACT[p.debug.type], uOf(p.debug.type), swingU, pose); mirror = p.debug.type === 'defesa' && p.debug.side < 0; }
  } else if (S.mode === 'toss' && S.serverPlayer === p) poseAt(SERVE_KEYS, SERVE_U, clamp(p.tossT / TOSS_T, 0, 1), pose);
  else if (S.mode === 'replay' && p.rpToss >= 0) poseAt(SERVE_KEYS, SERVE_U, p.rpToss, pose); // replay: lançamento do saque
  else if (p.charging) { const M = p.mtr || MTR; poseAt(ACT[M.type === 'lob' ? 'lob' : 'smash'], uOf(M.type === 'lob' ? 'lob' : 'smash'), .3 * clamp(M.t / .18, 0, 1), pose); }
  else if (p.swing.t >= 0) { swingU = clamp(p.swing.t / p.swing.dur, 0, 1); const ak = swingKey(p); poseAt(ACT[ak], uOf(ak), swingU, pose); mirror = (p.swing.type === 'defesa' || p.swing.type === 'curta' || p.swing.type === 'lob') && p.swing.side < -.15; }
  else poseAt(p === human && fpBodyOn ? READY_FP_KEYS : READY_KEYS, READY_U, 0, pose);
  if (mirror) mirrorPose(pose);
  // a postura real persegue a postura-alvo: sem estalos ao começar, trocar de lado ou terminar um golpe
  const acting = swingU >= 0 || p.charging || (S.mode === 'toss' && S.serverPlayer === p) || (S.mode === 'replay' && p.rpToss >= 0);
  blendPose(p.pose, pose, p.debug ? 1 : 1 - Math.exp(-dt * (acting ? 30 : 10)));
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
  const backK = busy ? 0 : clamp((back - .9) / 2, 0, 1), latK = busy ? 0 : clamp((Math.abs(latV) - 2.6) / 1.6, 0, 1) * (1 - backK);
  const turnSign = Math.abs(latV) > .6 ? -Math.sign(latV) : (p.lefty ? 1 : -1);
  const mtT = (backK * .95 + latK * .55) * turnSign;
  p.moveTurn = (p.moveTurn || 0) + (mtT - (p.moveTurn || 0)) * Math.min(1, dt * 6);
  // base baixa: bola rápida vindo na direção do jogador → abaixa e abre as pernas (prontidão para defender)
  const bsp = Math.hypot(ball.vel.x, ball.vel.z);
  const lowT = !busy && ball.state === 'live' && S.lastTeam !== p.team && bsp > 10 && Math.hypot(ball.pos.x - p.pos.x, ball.pos.z - p.pos.z) < 8 ? clamp((bsp - 10) / 6, .5, 1) : 0;
  p.lowK = (p.lowK || 0) + (lowT - (p.lowK || 0)) * Math.min(1, dt * 10);
  let yaw = (p.team === 0 ? 0 : Math.PI) + p.yaw + p.prep * .95 * (p.lefty ? 1 : -1) + p.moveTurn * (1 - p.prep);
  const cel = S.mode === 'dead' && S.celebrate && S.celebrate.team === p.team ? S.celebrate : null;
  const mateC = cel && $s.teams[p.team].length > 1 ? $s.teams[p.team].find(o => o !== p) : null;
  if (mateC && cel.t > .7) { const fy = Math.atan2(-(mateC.pos.x - p.pos.x), -(mateC.pos.z - p.pos.z)); p.celYaw = p.celYaw === undefined ? yaw : p.celYaw + Math.atan2(Math.sin(fy - p.celYaw), Math.cos(fy - p.celYaw)) * Math.min(1, dt * 8); yaw = p.celYaw; }
  else p.celYaw = undefined;
  m.group.rotation.y = yaw;
  if (p.jump > 0) p.jump = Math.max(0, p.jump - dt);
  if (p.split > 0) { p.split = Math.max(0, p.split - dt); if (p.split === 0) p.burst = .3; }
  if (p.burst > 0) p.burst = Math.max(0, p.burst - dt);
  // split step: pulinho com os dois pés quando o adversário bate, aterrissando abaixado e com as pernas abertas
  const spU = p.split > 0 ? 1 - p.split / .26 : -1;
  const jy = (p.jump > 0 ? Math.sin((1 - p.jump / (p.jumpDur || .35)) * Math.PI) * (p.jumpH || .3) : 0) + (spU >= 0 && spU < .6 ? Math.sin(Math.PI * spU / .6) * .1 : 0);
  m.group.position.set(p.pos.x, jy, p.pos.z);
  if (sp > .25) p.gait += dt * Math.PI * 2 * (1.35 + sp * .3);
  const spLand = spU >= .45 ? Math.sin(Math.PI * (spU - .45) / .55) : 0;
  // mergulho: corpo vai baixo e para a frente, uma perna em afundo; depois no chão e levantando
  const dv = p.dive ? p.dive.t / p.dive.dur : -1, diveK = dv < 0 ? 0 : dv < .3 ? dv / .3 : dv > .75 ? (1 - dv) / .25 : 1;
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
  const crouch = pose.crouch * (1 - run * .35) + spLand * .1 + p.prep * .05 + diveK * .42 + p.reachK * reachLow * .18 + p.lowK * .11 * (1 - run * .5) + defLow;
  const lungeA = Math.max(Math.abs(pose.lunge), diveK * .95, p.reachK * .85), lungeS = p.reachK * .85 > Math.abs(pose.lunge) ? reachS : Math.sign(pose.lunge) || 1;
  m.hips.position.set(lungeS * .2 * lungeA + reachS * p.reachK * .22, .92 - crouch - .08 * lungeA + run * .025 * Math.cos(2 * p.gait), -.05 * lungeA);
  const idle = (1 - run) * (acting ? 0 : 1);
  if (!p.prevVel) p.prevVel = new V3();
  const acx = dt > 0 ? (p.vel.x - p.prevVel.x) / dt : 0, acz = dt > 0 ? (p.vel.z - p.prevVel.z) / dt : 0; p.prevVel.copy(p.vel);
  const cya = Math.cos(yaw), sya = Math.sin(yaw);
  p.accF = (p.accF || 0) + (clamp(-(sya * acx + cya * acz), -14, 14) - (p.accF || 0)) * Math.min(1, dt * 8);
  p.accR = (p.accR || 0) + (clamp(cya * acx - sya * acz, -14, 14) - (p.accR || 0)) * Math.min(1, dt * 8);
  const accLean = clamp(p.accF * .022, -.22, .22), accRoll = clamp(p.accR * .018, -.16, .16);
  m.hips.position.x += clamp(-p.accR * .006, -.05, .05);
  m.hips.rotation.set(0, Math.sin(p.gait) * .11 * run, Math.cos(p.gait) * .035 * run);
  // com o corpo já de lado, o tronco torce menos (senão gira demais)
  m.spine.rotation.set(-(pose.lean + run * .1 + diveK * .75 + p.reachK * (.15 + reachLow * .35)) - accLean + Math.sin(p.breath * 1.9) * .012 * idle, pose.tw + p.prep * .45 - Math.sin(p.gait) * .16 * run * (1 - p.prep * .6), -pose.bend - Math.cos(p.gait) * .03 * run - accRoll - reachS * p.reachK * .32);
  _hq.copy(m.hips.quaternion).invert();
  m.group.updateMatrixWorld(true);
  // pernas: pés presos na areia
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  let lvx = cy * p.vel.x - sy * p.vel.z, lvz = sy * p.vel.x + cy * p.vel.z;
  const fwd = -lvz;
  const lv = Math.hypot(lvx, lvz) || 1; lvx /= lv; lvz /= lv;
  const stride = clamp(sp * .1, 0, .5);
  const air = jy > .05;
  for (let i = 0; i < 2; i++) {
    const s = i ? 1 : -1, L = m.legs[i];
    let fx = s * (.17 + spLand * .1 + (spU >= 0 && spU < .45 ? .05 : 0) + p.lowK * .07 * (1 - run)), fz = 0;
    if (lungeA > .01) { if (s === lungeS) { fx = s * (.19 + .55 * lungeA); fz = -.28 * lungeA; } else fz = .12 * lungeA; }
    const shuffle = sp > .25 && sp < 4.2 ? Math.abs(lvx) : 0; // deslocamento lateral: passo cruzado vira passo lateral
    const ph = p.gait + (i ? Math.PI * (1 - .45 * shuffle) : 0);
    let lift = 0;
    if (sp > .25) { fx += lvx * stride * (1 - .4 * shuffle) * Math.cos(ph); fz += lvz * stride * Math.cos(ph); lift = Math.max(0, -Math.sin(ph)) * (.05 + sp * .02) * run; }
    let fy = .07 + lift;
    if (air) {
      const jp = p.jumpDur ? 1 - p.jump / p.jumpDur : .5, sw = jp < .45 ? 1 : -1;
      fy += .1 + ((s > 0) === (sw > 0) ? .12 : .02); fz += (s > 0 ? .2 : -.12) * sw;
    }
    const grounded = lift < .005 && !air;
    if (grounded && !p.footDown[i] && sp > 1.2 && m.group.visible) {
      const wx = p.pos.x + cy * fx + sy * fz, wz = p.pos.z - sy * fx + cy * fz;
      stamp(wx, wz, yaw);
      if (sp > 3.5 && particles.visible) puff(wx, wz, 2, .35);
    }
    p.footDown[i] = grounded;
    _a.set(fx - m.hips.position.x, fy - m.hips.position.y, fz - m.hips.position.z).applyQuaternion(_hq);
    _b.set(s * .12, 0, -1).applyQuaternion(_hq);
    ik2(L.thigh, L.knee, L.thigh.position, _a, _b, .42, .43);
    _q1.copy(m.hips.quaternion).multiply(L.thigh.quaternion).multiply(L.knee.quaternion).invert();
    L.ankle.quaternion.copy(_q1);
  }
  // braços
  const shR = m.armR.sh.position, shL = m.armL.sh.position;
  _c.fromArray(pose.rh);
  if (swingU >= 0 && ball.state !== 'held') {
    // antes do contato a raquete vai buscando a bola; depois, fica no ponto onde bateu e acompanha o movimento
    const hitDone = p.swing.hit && p.contact && p.contact.hitId === S.hitId;
    const cu = hitDone ? p.contact.u : .45;
    const w = hitDone ? clamp(1 - (swingU - cu) / .22, 0, 1) : clamp(1 - Math.abs(swingU - cu) / .3, 0, 1);
    if (w > 0) {
      if (hitDone) _e.set(p.contact.x, p.contact.y, p.contact.z); else _e.copy(ball.pos);
      m.spine.worldToLocal(_e);
      if (_e.distanceTo(shR) < 2.2) { _g.copy(_e).sub(shR).normalize(); _e.addScaledVector(_g, -.34); _c.lerp(_e, Math.min(1, w * 1.1)); }
    }
  }
  _b.fromArray(pose.rp);
  const celPh = cel ? (!mateC ? (cel.title ? 'up' : '') : cel.t < 1.0 ? '' : cel.t < 1.6 ? 'five' : cel.title && cel.t < 3.4 ? 'hug' : cel.title ? 'up' : '') : '';
  if (celPh === 'hug') { _c.set(.2, .5, -.32); _b.set(.9, -.3, .2); }
  else if (celPh === 'up') { _c.set(.18, 1.05, -.05); _b.set(.8, 0, .3); }
  ik2(m.armR.sh, m.armR.el, shR, _c, _b, .285, .27);
  m.armR.wrist.rotation.set(pose.wx, pose.wr, 0);
  _c.fromArray(pose.lh); _b.fromArray(pose.lp);
  if (celPh === 'five') { _c.set(-.12, 1.0, -.4); _b.set(-.8, 0, .4); }
  else if (celPh === 'hug') { _c.set(-.2, .52, -.32); _b.set(-.9, -.3, .2); }
  else if (celPh === 'up') { _c.set(-.18, 1.05, -.05); _b.set(-.8, 0, .3); }
  if (swingU < 0 && !p.charging && run > .3 && !celPh) _c.y += Math.sin(p.gait) * .04 * run;
  if (p.prep > .05 && ball.state === 'live' && !celPh) { // mão livre aponta a bola
    _e.copy(ball.pos); m.spine.worldToLocal(_e); _g.copy(_e).sub(shL);
    if (_g.lengthSq() > 1e-4) { _g.normalize(); _e.copy(shL).addScaledVector(_g, .5); _c.lerp(_e, p.prep * .85); }
  }
  ik2(m.armL.sh, m.armL.el, shL, _c, _b, .285, .27);
  m.armL.wrist.rotation.set(.2, 0, 0);
  // cabeça acompanha a bola
  if (ball.state !== 'held' || S.serverPlayer === p) {
    _e.copy(ball.pos); m.spine.worldToLocal(_e); _e.y -= .72;
    const hy = clamp(Math.atan2(-_e.x, -_e.z), -1.1, 1.1);
    const hp = clamp(Math.atan2(_e.y, Math.hypot(_e.x, _e.z)), -.5, .85);
    p.headYaw += (hy - p.headYaw) * Math.min(1, dt * 8); p.headPitch += (hp - p.headPitch) * Math.min(1, dt * 8);
  } else { p.headYaw *= .9; p.headPitch *= .9; }
  m.headG.rotation.set(p.headPitch, p.headYaw, 0);
  if (m.tail) {
    m.tail.rotation.x += (-(.25 + clamp(fwd * .06, -.2, .5) + jy * 1.5) - m.tail.rotation.x) * Math.min(1, dt * 5);
    m.tail.rotation.z += (clamp(lvx * sp * .05, -.4, .4) - m.tail.rotation.z) * Math.min(1, dt * 5);
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
function animateFP() {
  const p = human; let th = 1.2, ph = .12, ry = -.35, fw = FP_UP;
  if (p.charging) { const c = clamp(MTR.t / .18, 0, 1); th = lerp(1.2, MTR.type === 'lob' ? -.4 : 3.0, c); fw = lerp(FP_UP, MTR.type === 'lob' ? -.2 : .2, c); }
  else if (S.mode === 'toss' && S.serverPlayer === p) { const c = clamp(p.tossT / TOSS_T / .75, 0, 1); th = lerp(1.2, 3.0, c); fw = lerp(FP_UP, .2, c); }
  else if (p.swing.t >= 0) {
    const u = clamp(p.swing.t / p.swing.dur, 0, 1); const k = FPKF[p.swing.type];
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
  m.headG.traverse(o => { if (o.isMesh) o.visible = !on && !o.userData.off; });
  // tronco, pescoço e braço de cima somem (passariam colados no olho); antebraço, mão e raquete continuam
  (m.fpHide || []).forEach(o => { o.visible = !on; });
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
  const acting = human.swing.t >= 0 || human.charging || (S.mode === 'toss' && S.serverPlayer === human);
  human.model.group.visible = !fp || fpBody;
  human.model.armR.el.visible = !fpBody || acting;
  fpArm.visible = fp && (!fpBody || !acting);
  if (S.mode === 'menu') {
    S.orbit += dt * .06;
    tmpA.set(Math.sin(S.orbit) * 12, 3.2 + Math.sin(S.orbit * .7) * 1.2, Math.cos(S.orbit) * 12);
    camPos.lerp(tmpA, .04); tmpB.set(0, 1.2, 0); camLook.lerp(tmpB, .04);
  } else if (!fp) {
    const d = dupla() ? 1 : 0, V = CAM3[S.settings.cam3] || CAM3.padrao, dk = (S.settings.camDist || 100) / 100, hk = (S.settings.camHeight || 100) / 100;
    const bz = lerp(6, human.pos.z, V.zf); // profundidade que a câmera acompanha
    tmpA.set(human.pos.x * V.fx[d], V.ly + (V.h[d] - V.ly) * dk * hk, bz + V.back[d] * dk); camPos.lerp(tmpA, k);
    tmpB.set(human.pos.x * V.lx[d], V.ly, bz + V.lz); camLook.lerp(tmpB, k);
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
    if (MTR.kind === 'lob') { el.mFill.style.height = (clamp(v / LOB_MAX, 0, 1) * 100) + '%'; el.meter.classList.toggle('over', v > 1); }
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
    const key = (p.char ? p.char.id + nameOf(p.char) : p.name) + me;
    if (t.dataset.k !== key) {
      t.dataset.k = key;
      t.className = 'tag t' + p.team + (me ? ' me' : '');
      t.innerHTML = '';
      if (me) { const e = document.createElement('em'); e.textContent = 'VOCÊ'; t.append(e); }
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
    const l = predictLanding(); landRing.position.set(l.x, .02, l.z); landRing.visible = true;
    landRing.material.color.copy(mine ? RING_MINE : RING_MATE);
    const pulse = 1 + Math.sin(performance.now() / 90) * .12; landRing.scale.set(pulse, pulse, 1);
  } else landRing.visible = false;
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
