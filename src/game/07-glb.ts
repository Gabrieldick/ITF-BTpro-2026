// @ts-nocheck
// modelos GLB (Michelle/Soldier) e escalação dos personagens
import './06-modelos';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { assetBuf } from '../assets';
import { G, KITS, V3, charById, clamp, effA, hScale, heightOf, nameOf, racketBonus, rand , lookExtras } from './00-base';
import { S } from './01-estado';
import { camera, canvasTex, col, mat, scene } from './02-render';
import { RACKETS, SHADOW_TEX, capsuleGeo, makeRacket } from './05-atletas';
import { ALL, cpuA, cpuB, human, makeAthlete, partner } from './06-modelos';
import { charSkill, playStyleOf } from './16-ia';
// ---------- Jogadores com modelo 3D (GLB) dirigidos pelo rig de animação ----------
const GLB = { male: null, female: null };
function b64Buf(id) { return assetBuf(id); }
function loadModels() {
  return new Promise(resolve => {
    const loader = new GLTFLoader();
    const jobs = [['male', 'glb-male'], ['female', 'glb-female']].map(([k, id]) => new Promise(r => {
      let buf = null; try { buf = b64Buf(id); } catch (e) { buf = null; }
      if (!buf) return r();
      try { loader.parse(buf, '', g => { GLB[k] = g; r(); }, () => r()); } catch (e) { r(); }
    }));
    Promise.all(jobs).then(() => resolve(!!(GLB.male && GLB.female)));
    setTimeout(() => resolve(!!(GLB.male && GLB.female)), 15000);
  });
}
const ROT_BONES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'RightShoulder'];
const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];
const CURL = { axis: new V3(1, 0, 0), angle: 1.1, q: new THREE.Quaternion() };
function attachSkin(p, gltf) {
  const root = SkeletonUtils.clone(gltf.scene);
  const holder = new THREE.Group(); holder.add(root); scene.add(holder);
  const B = {}, all = [];
  root.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (o.material) { o.material = o.material.clone(); o.material.envMapIntensity = .6; } }
    if (o.isBone) { const k = o.name.replace(/^mixamorig[:_]?/, ''); B[k] = o; o.userData.rq = o.quaternion.clone(); o.userData.rp = o.position.clone(); all.push(o); }
  });
  if (!B.Hips || !B.RightHand || !B.LeftFoot) { scene.remove(holder); return; }
  holder.updateMatrixWorld(true);
  const wp = b => b.getWorldPosition(new V3());
  const d = (a, b) => wp(B[a]).distanceTo(wp(B[b]));
  const k = {
    holder, B, all, restW: {},
    faceFix: wp(B.LeftUpLeg).x > wp(B.RightUpLeg).x ? Math.PI : 0,
    footH: wp(B.LeftFoot).y,
    arm: [d('RightArm', 'RightForeArm'), d('RightForeArm', 'RightHand')],
    armL: [d('LeftArm', 'LeftForeArm'), d('LeftForeArm', 'LeftHand')],
    leg: [d('LeftUpLeg', 'LeftLeg'), d('LeftLeg', 'LeftFoot')],
    toe: { L: wp(B.LeftToeBase).sub(wp(B.LeftFoot)), R: wp(B.RightToeBase).sub(wp(B.RightFoot)) },
    racket: makeRacket(p.look.racket),
  };
  ROT_BONES.forEach(n => { k.restW[n] = new THREE.Quaternion(); });
  k.racket.traverse(m => { if (m.isMesh) m.castShadow = true; }); scene.add(k.racket);
  p.skin = k;
  p.model.group.traverse(o => { if (o.isMesh && o !== p.model.blob) o.visible = false; });
}
const _k1 = new V3(), _k2 = new V3(), _k3 = new V3(), _kS = new V3(), _kM = new V3(), _kE = new V3(), _kU = new V3(), _kT = new V3(), _kP = new V3(), _kJ = new V3();
const _ka = new V3(), _kb = new V3(), _kc = new V3(), _ke1 = new V3(), _ke2 = new V3(), _ke3 = new V3();
const _kq = new THREE.Quaternion(), _kq2 = new THREE.Quaternion(), _kq3 = new THREE.Quaternion(), _kD = new THREE.Quaternion(), _kH = new THREE.Quaternion(), _kN = new THREE.Quaternion();
const _kR = new THREE.Quaternion(), _kRi = new THREE.Quaternion(), _kI = new THREE.Quaternion();
function setDelta(bone, restW, D) {
  _kq.copy(_kR).multiply(D).multiply(_kRi).multiply(restW);
  bone.parent.getWorldQuaternion(_kq2); _kq2.invert().multiply(_kq);
  bone.quaternion.copy(_kq2); bone.updateMatrixWorld(true);
}
function aimBone(bone, child, target) {
  const bp = bone.getWorldPosition(_ka);
  const cd = child.getWorldPosition(_kb).sub(bp);
  if (cd.lengthSq() < 1e-10) return;
  cd.normalize();
  _kc.subVectors(target, bp); if (_kc.lengthSq() < 1e-10) return; _kc.normalize();
  _kq.setFromUnitVectors(cd, _kc);
  bone.getWorldQuaternion(_kq2); _kq.multiply(_kq2);
  bone.parent.getWorldQuaternion(_kq3); _kq3.invert().multiply(_kq);
  bone.quaternion.copy(_kq3); bone.updateMatrixWorld(true);
}
function jointPos(S, T, pole, L1, L2, out) {
  _ke1.subVectors(T, S); const dist = clamp(_ke1.length(), .05, L1 + L2 - .002); _ke1.normalize();
  const a1 = Math.acos(clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1));
  _ke2.crossVectors(_ke1, pole); if (_ke2.lengthSq() < 1e-8) _ke2.set(1, 0, 0); _ke2.normalize();
  _ke3.crossVectors(_ke2, _ke1).normalize();
  return out.copy(S).addScaledVector(_ke1, Math.cos(a1) * L1).addScaledVector(_ke3, Math.sin(a1) * L1);
}
function limbIK(upper, lower, end, rS, rM, rE, L1, L2, rigLen, scaleTarget, yOff) {
  rS.getWorldPosition(_kS); rM.getWorldPosition(_kM); rE.getWorldPosition(_kE);
  upper.getWorldPosition(_kU);
  if (scaleTarget) _kT.subVectors(_kE, _kS).multiplyScalar((L1 + L2) / rigLen).add(_kU); else _kT.copy(_kE);
  _kT.y += yOff || 0;
  _kP.addVectors(_kS, _kE).multiplyScalar(.5); _kP.subVectors(_kM, _kP);
  jointPos(_kU, _kT, _kP, L1, L2, _kJ);
  aimBone(upper, lower, _kJ);
  aimBone(lower, end, _kT);
}
function driveSkin(p) {
  const k = p.skin, m = p.model, B = k.B;
  const vis = m.group.visible; k.holder.visible = vis; k.racket.visible = vis;
  if (!vis) return;
  k.holder.position.copy(m.group.position); k.holder.rotation.y = m.group.rotation.y + k.faceFix;
  for (const b of k.all) b.quaternion.copy(b.userData.rq);
  B.Hips.position.copy(B.Hips.userData.rp);
  k.holder.updateMatrixWorld(true);
  for (const n of ROT_BONES) if (B[n]) B[n].getWorldQuaternion(k.restW[n]);
  _kR.copy(m.group.quaternion); _kRi.copy(_kR).invert();
  // quadril desce e desloca como no rig
  _k1.set(m.hips.position.x, m.hips.position.y - .92, m.hips.position.z).applyQuaternion(_kR);
  B.Hips.getWorldPosition(_k2).add(_k1); B.Hips.parent.worldToLocal(_k2); B.Hips.position.copy(_k2); B.Hips.updateMatrixWorld(true);
  const sq = m.spine.quaternion;
  const D = t => _kD.copy(_kI).slerp(sq, t);
  setDelta(B.Hips, k.restW.Hips, D(.25));
  setDelta(B.Spine, k.restW.Spine, D(.5));
  setDelta(B.Spine1, k.restW.Spine1, D(.78));
  setDelta(B.Spine2, k.restW.Spine2, D(1));
  setDelta(B.LeftShoulder, k.restW.LeftShoulder, D(1));
  setDelta(B.RightShoulder, k.restW.RightShoulder, D(1));
  _kH.copy(sq).multiply(m.headG.quaternion); _kN.copy(sq).slerp(_kH, .5);
  setDelta(B.Neck, k.restW.Neck, _kN); setDelta(B.Head, k.restW.Head, _kH);
  limbIK(B.RightArm, B.RightForeArm, B.RightHand, m.armR.sh, m.armR.el, m.armR.wrist, k.arm[0], k.arm[1], .555, true, 0);
  limbIK(B.LeftArm, B.LeftForeArm, B.LeftHand, m.armL.sh, m.armL.el, m.armL.wrist, k.armL[0], k.armL[1], .555, true, 0);
  limbIK(B.LeftUpLeg, B.LeftLeg, B.LeftFoot, m.legs[0].thigh, m.legs[0].knee, m.legs[0].ankle, k.leg[0], k.leg[1], .85, false, k.footH - .07);
  limbIK(B.RightUpLeg, B.RightLeg, B.RightFoot, m.legs[1].thigh, m.legs[1].knee, m.legs[1].ankle, k.leg[0], k.leg[1], .85, false, k.footH - .07);
  // pés planos na areia
  [['LeftFoot', 'LeftToeBase', k.toe.L], ['RightFoot', 'RightToeBase', k.toe.R]].forEach(([f, t, v]) => {
    if (!B[f] || !B[t]) return;
    B[f].getWorldPosition(_k3); _k1.copy(v).applyQuaternion(k.holder.quaternion).add(_k3); aimBone(B[f], B[t], _k1);
  });
  // mão direita segue o cabo da raquete e fecha os dedos
  m.racket.getWorldPosition(_k3); m.armR.wrist.getWorldPosition(_k2);
  m.racket.localToWorld(_k1.set(0, -.36, 0)).sub(_k3);
  if (B.RightHandMiddle1) { B.RightHand.getWorldPosition(_kU).addScaledVector(_k1, .3); aimBone(B.RightHand, B.RightHandMiddle1, _kU); }
  CURL.q.setFromAxisAngle(CURL.axis, CURL.angle);
  for (const f of FINGERS) for (let j = 1; j <= 3; j++) { const b = B['RightHand' + f + j]; if (b) b.quaternion.multiply(CURL.q); }
  B.RightHand.updateMatrixWorld(true);
  // raquete visível presa na mão do modelo
  m.racket.getWorldQuaternion(k.racket.quaternion);
  B.RightHand.getWorldPosition(_kU);
  k.racket.position.copy(_k3).add(_kU).sub(_k2);
}
// canhoto = modelo desenhado espelhado (o modelo 3D baixado só existe destro)
function applyLefty(p) {
  p.lefty = !!(p.char && p.char.canhoto) && S.settings.players !== '3d';
  p.model.group.scale.set(hScale(p) * (p.lefty ? -1 : 1), hScale(p), hScale(p));
}
function applyPlayerStyle() {
  const on = S.settings.players === '3d';
  for (const p of ALL) {
    if (!p.skin) continue;
    p.skinOn = on;
    p.model.group.traverse(o => { if (o.isMesh && o !== p.model.blob) o.visible = !on && !o.userData.off; });
    if (!on) { p.skin.holder.visible = false; p.skin.racket.visible = false; }
  }
  for (const p of ALL) if (p.char) applyLefty(p);
}
function rebuildModel(p, look) {
  const vis = p.model.group.visible;
  scene.remove(p.model.group);
  p.look = look; p.model = makeAthlete(look); p.model.group.visible = vis;
  if (p.skin) { scene.remove(p.skin.holder); scene.remove(p.skin.racket); p.skin = null; }
  if (GLB.male && GLB.female) { try { attachSkin(p, look.fem ? GLB.female : GLB.male); } catch (e) { p.skin = null; } }
}
function assignCharacters() {
  const pk = S.settings.pick;
  [[human, pk.me, 0, 0], [partner, pk.mate, 0, 1], [cpuA, pk.o1, 1, 0], [cpuB, pk.o2, 1, 1]].forEach(([p, id, team, idx]) => {
    const c = charById(id);
    // atributos em jogo: base + raquete (a sua vem do menu/carreira; a dos outros, do equipamento de cada um)
    p.char = Object.assign({}, c, { a: effA(c.a, racketBonus(p === human ? S.settings.racket : c.look && c.look.racket)) });
    const look = Object.assign({}, lookExtras(c), c.look, KITS[team][idx], { fem: !!c.fem, build: c.build });
    const lk = c.id + c.build + (S.settings.uniforms || '') + (S.settings.players === 'carol' ? 'C' : '') + (look.shirt || '') + (look.skin || '') + [look.hair, look.hairStyle, look.beard, look.headband, look.glasses, look.glassStyle, look.lens, look.cap, look.visor].join('|');
    if (p.lookKey !== lk) { rebuildModel(p, look); p.lookKey = lk; }
    p.playStyle = playStyleOf(c);
    p.skill = p.isHuman ? null : charSkill(p);
    p.name = nameOf(c);
    p.height = heightOf(c); applyLefty(p); if (p.skin) p.skin.holder.scale.setScalar(hScale(p));
  });
  if (fpSkin) fpSkin.color.copy(col(human.look.skin));
}
function applyRackets() {
  const mine = RACKETS[S.settings.racket] ? S.settings.racket : 'proteo';
  [[human, mine], [partner, partner.char ? partner.char.look.racket : 'medusa'], [cpuA, cpuA.char ? cpuA.char.look.racket : 'kronos'], [cpuB, cpuB.char ? cpuB.char.look.racket : 'supercarbon']].forEach(([p, key]) => {
    p.look.racket = key; p.model.racket.userData.setStyle(key); if (p.skin) p.skin.racket.userData.setStyle(key);
  });
  if (fpRacket) fpRacket.userData.setStyle(mine);
}
// braço em primeira pessoa (preso à câmera)
let fpRacket = null;
let fpWrist = null, fpSkin = null;
// o braço fica dentro de um grupo espelhável (canhoto em primeira pessoa)
const fpMirror = new THREE.Group(); camera.add(fpMirror);
const fpArm = new THREE.Group(); fpArm.position.set(.24, -.34, -.34); fpArm.rotation.order = 'YXZ'; fpMirror.add(fpArm);
{
  const skin = mat('#c68a5e', { roughness: .55 }); fpSkin = skin;
  fpArm.add(new THREE.Mesh(capsuleGeo(.04, .03, .4), skin));
  const hand = new THREE.Mesh(new THREE.SphereGeometry(.038, 10, 8), skin); hand.scale.set(.8, 1.2, .65); hand.position.y = -.44; fpArm.add(hand);
  const wband = new THREE.Mesh(new THREE.CylinderGeometry(.036, .036, .04, 12), mat('#ff5a1f')); wband.position.y = -.36; fpArm.add(wband);
  fpWrist = new THREE.Group(); fpWrist.position.y = -.44; fpArm.add(fpWrist);
  fpRacket = makeRacket('proteo'); fpRacket.position.y = .03; fpWrist.add(fpRacket);
}
fpArm.visible = false;
// Bola
const ballTex = canvasTex(256, 128, (x, w, h) => {
  const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ff7a12'); gr.addColorStop(1, '#ff5a00'); // laranja de bola de beach tennis x.fillStyle = gr; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 1800; i++) { x.fillStyle = `rgba(255,${rand(110, 170) | 0},${rand(20, 70) | 0},${rand(.1, .3)})`; x.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
  x.strokeStyle = 'rgba(255,236,170,.98)'; x.lineWidth = 6; x.beginPath();
  for (let i = 0; i <= w; i++) { const y = h / 2 + Math.sin(i / w * Math.PI * 4) * h * .28; i ? x.lineTo(i, y) : x.moveTo(i, y); }
  x.stroke();
});
const ball = { pos: new V3(0, 1, 0), vel: new V3(), state: 'held' };
const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(.055, 24, 16), mat('#ffffff', { map: ballTex, roughness: .8, emissive: col('#ff4d00'), emissiveIntensity: .32 }));
scene.add(ballMesh);
const ballShadow = new THREE.Mesh(new THREE.PlaneGeometry(.3, .3), new THREE.MeshBasicMaterial({ map: SHADOW_TEX, transparent: true, depthWrite: false }));
ballShadow.rotation.x = -Math.PI / 2; scene.add(ballShadow);
const TRAIL_N = 14;
const trailPos = new Float32Array(TRAIL_N * 3);
const trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: col('#ffb070'), transparent: true, opacity: .4 }));
trail.frustumCulled = false; scene.add(trail);
function resetTrail() { for (let i = 0; i < TRAIL_N; i++) { trailPos[i * 3] = ball.pos.x; trailPos[i * 3 + 1] = ball.pos.y; trailPos[i * 3 + 2] = ball.pos.z; } trailGeo.attributes.position.needsUpdate = true; }
const RING_MINE = col('#ff5a1f'), RING_MATE = col('#ffc7a8');
const landRing = new THREE.Mesh(new THREE.RingGeometry(.16, .22, 40), new THREE.MeshBasicMaterial({ color: RING_MINE.clone(), transparent: true, opacity: .8, depthWrite: false }));
landRing.rotation.x = -Math.PI / 2; landRing.visible = false; scene.add(landRing);
const reachRing = new THREE.Mesh(new THREE.RingGeometry(1.32, 1.35, 72), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .18, depthWrite: false }));
reachRing.rotation.x = -Math.PI / 2; scene.add(reachRing);
// Pegadas na areia
const FP_N = 260;
const footTex = canvasTex(32, 64, (x) => { const gr = x.createRadialGradient(16, 16, 2, 16, 16, 15); gr.addColorStop(0, 'rgba(0,0,0,.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.save(); x.scale(1, 2); x.fillStyle = gr; x.beginPath(); x.arc(16, 16, 15, 0, Math.PI * 2); x.fill(); x.restore(); }, false);
const prints = new THREE.InstancedMesh(new THREE.PlaneGeometry(.1, .24), new THREE.MeshBasicMaterial({ map: footTex, transparent: true, depthWrite: false, color: col('#6b5233'), opacity: .3 }), FP_N);
prints.frustumCulled = false; scene.add(prints);
let fpIdx = 0;
const dummyObj = new THREE.Object3D();
function clearPrints() { for (let i = 0; i < FP_N; i++) { dummyObj.position.set(0, -10, 0); dummyObj.rotation.set(0, 0, 0); dummyObj.updateMatrix(); prints.setMatrixAt(i, dummyObj.matrix); } prints.instanceMatrix.needsUpdate = true; }
clearPrints();
function stamp(x, z, ang) {
  dummyObj.position.set(x, .011, z); dummyObj.rotation.set(-Math.PI / 2, 0, ang); dummyObj.updateMatrix();
  prints.setMatrixAt(fpIdx, dummyObj.matrix); prints.instanceMatrix.needsUpdate = true; fpIdx = (fpIdx + 1) % FP_N;
}
// Grãos de areia levantados
const PN = 120;
const pPos = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN);
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: col('#d9bf8c'), size: .045, transparent: true, opacity: .9, depthWrite: false }));
particles.frustumCulled = false; scene.add(particles);
for (let i = 0; i < PN; i++) pPos[i * 3 + 1] = -10;
let pIdx = 0;
function puff(x, z, n, power) {
  for (let k = 0; k < n; k++) {
    const i = pIdx; pIdx = (pIdx + 1) % PN;
    pPos[i * 3] = x + rand(-.05, .05); pPos[i * 3 + 1] = .03; pPos[i * 3 + 2] = z + rand(-.05, .05);
    const a = Math.random() * Math.PI * 2, s = rand(.3, 1.4) * power;
    pVel[i * 3] = Math.cos(a) * s; pVel[i * 3 + 1] = rand(1, 2.6) * power; pVel[i * 3 + 2] = Math.sin(a) * s; pLife[i] = rand(.5, .9);
  }
}
function updateParticles(dt) {
  for (let i = 0; i < PN; i++) {
    if (pLife[i] <= 0) continue;
    pLife[i] -= dt; pVel[i * 3 + 1] -= G * dt;
    pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
    if (pPos[i * 3 + 1] < .01 || pLife[i] <= 0) { pPos[i * 3 + 1] = -10; pLife[i] = 0; }
  }
  pGeo.attributes.position.needsUpdate = true;
}

export { CURL, GLB, RING_MATE, RING_MINE, TRAIL_N, applyPlayerStyle, applyRackets, assignCharacters, b64Buf, ball, ballMesh, ballShadow, clearPrints, driveSkin, fpArm, fpWrist, landRing, loadModels, particles, puff, reachRing, resetTrail, stamp, trail, trailGeo, trailPos, updateParticles };
