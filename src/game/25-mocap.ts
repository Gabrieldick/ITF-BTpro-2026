// @ts-nocheck
// ---------- Modo Ultrarrealista: movimento por captura real ----------
// O deslocamento (andar, trotar, correr, passo lateral, recuar) usa capturas de movimento de pessoas de verdade (banco da
// CMU, uso livre) convertidas por ferramentas/ultra/converte.py. A jogabilidade continua a mesma: a posição e a velocidade
// do jogador vêm do jogo; aqui só muda COMO o corpo se mexe para ir de um ponto a outro. Depois do driveSkin (que posa o
// esqueleto pelo boneco do jogo), esta camada troca quadril, coluna, pernas e pés pela pose da captura, na medida em que
// o jogador está se deslocando; golpes, mergulhos, saltos e saque continuam vindo do jogo.
// "The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217."
import * as THREE from 'three';
import { $s } from '../state';
import { V3, clamp, lerp } from './00-base';
import { S } from './01-estado';
import { jointPos, orientBone } from './07-glb';

const BASE = import.meta.env.BASE_URL + 'assets/ultra/';
const MC = { ok: false, loading: null, meta: null, data: null, clips: {}, bi: {} };
function mocapLoad() {
  if (MC.loading) return MC.loading;
  MC.loading = (async () => {
    try {
      const [meta, buf] = await Promise.all([fetch(BASE + 'mocap.json').then(r => r.json()), fetch(BASE + 'mocap.bin').then(r => r.arrayBuffer())]);
      MC.meta = meta; MC.data = new Int16Array(buf); MC.clips = meta.clips; meta.bones.forEach((n, i) => { MC.bi[n] = i; });
      MC.ok = true;
    } catch (e) { MC.ok = false; }
    return MC.ok;
  })();
  return MC.loading;
}
const mocapReady = () => MC.ok;

// ---------- pose amostrada ----------
const NB = 22, NP = 5;
const newPose = () => ({ q: new Float32Array(NB * 4), p: new Float32Array(NP * 3), c: [0, 0], w: 0 });
const POSE = newPose(), TMP = newPose();
// soma (com peso) um quadro do trecho em 'out'; fase 0..1 nos ciclos, tempo em s nos trechos de uma vez só
function sample(clip, t, w, out) {
  const R = MC.meta.rec, D = MC.data, n = clip.n;
  let f = clip.loop ? (((t % 1) + 1) % 1) * n : clamp(t * MC.meta.fps, 0, n - 1);
  const i0 = Math.floor(f) % n, i1 = clip.loop ? (i0 + 1) % n : Math.min(n - 1, i0 + 1), a = f - Math.floor(f);
  const o0 = (clip.off + i0) * R, o1 = (clip.off + i1) * R, q = out.q, first = out.w === 0;
  for (let b = 0; b < NB; b++) {
    const k = b * 4;
    let x0 = D[o0 + k], y0 = D[o0 + k + 1], z0 = D[o0 + k + 2], w0 = D[o0 + k + 3], x1 = D[o1 + k], y1 = D[o1 + k + 1], z1 = D[o1 + k + 2], w1 = D[o1 + k + 3];
    if (x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1 < 0) { x1 = -x1; y1 = -y1; z1 = -z1; w1 = -w1; }
    let x = x0 + (x1 - x0) * a, y = y0 + (y1 - y0) * a, z = z0 + (z1 - z0) * a, ww = w0 + (w1 - w0) * a;
    if (!first && x * q[k] + y * q[k + 1] + z * q[k + 2] + ww * q[k + 3] < 0) { x = -x; y = -y; z = -z; ww = -ww; }
    q[k] += x * w; q[k + 1] += y * w; q[k + 2] += z * w; q[k + 3] += ww * w;
  }
  const po = NB * 4;
  for (let k = 0; k < NP * 3; k++) out.p[k] += (D[o0 + po + k] + (D[o1 + po + k] - D[o0 + po + k]) * a) * .001 * w;
  const cb = D[(a < .5 ? o0 : o1) + R - 1];
  out.c[0] += (cb & 1) * w; out.c[1] += ((cb >> 1) & 1) * w;
  out.w += w;
}
function resetPose(o) { o.q.fill(0); o.p.fill(0); o.c[0] = o.c[1] = 0; o.w = 0; }
function finishPose(o) {
  const q = o.q, iw = o.w > 0 ? 1 / o.w : 1;
  for (let b = 0; b < NB; b++) { const k = b * 4, l = Math.hypot(q[k], q[k + 1], q[k + 2], q[k + 3]) || 1; q[k] /= l; q[k + 1] /= l; q[k + 2] /= l; q[k + 3] /= l; }
  for (let k = 0; k < NP * 3; k++) o.p[k] *= iw;
  o.c[0] *= iw; o.c[1] *= iw;
}

// ---------- preparo por esqueleto ----------
// K[i] = C · F · (rotação de repouso do osso no espaço do modelo): com isso, rotação de mundo = grupo · Δ(captura) · K
const CHILD = { LeftShoulder: 'LeftArm', LeftArm: 'LeftForeArm', LeftForeArm: 'LeftHand', LeftHand: 'LeftHandMiddle1', RightShoulder: 'RightArm', RightArm: 'RightForeArm', RightForeArm: 'RightHand', RightHand: 'RightHandMiddle1',
  LeftUpLeg: 'LeftLeg', LeftLeg: 'LeftFoot', LeftFoot: 'LeftToeBase', RightUpLeg: 'RightLeg', RightLeg: 'RightFoot', RightFoot: 'RightToeBase' };
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _qg = new THREE.Quaternion(), _qd = new THREE.Quaternion(), _hq = new THREE.Quaternion(), _hqi = new THREE.Quaternion();
const _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3(), _e = new V3(), _u = new V3(), _l = new V3(), _h = new V3(), _gp = new V3();
function setup(p) {
  const k = p.skin, B = k.B, names = MC.meta.bones;
  // pose de repouso (o driveSkin refaz a pose no próximo quadro)
  for (const b of k.all) b.quaternion.copy(b.userData.rq);
  B.Hips.position.copy(B.Hips.userData.rp);
  k.holder.updateMatrixWorld(true);
  k.holder.getWorldQuaternion(_hq); _hqi.copy(_hq).invert();
  const F = new THREE.Quaternion().setFromAxisAngle(new V3(0, 1, 0), k.faceFix); // modelo → boneco do jogo (o modelo pode estar de costas)
  const mc = { K: [], bones: [], lock: [{ on: 0, x: 0, z: 0, w: 0 }, { on: 0, x: 0, z: 0, w: 0 }], W: 0, act: 0, phase: Math.random(), wq: {}, t: 0 };
  names.forEach((n, i) => {
    const bn = B[n]; mc.bones.push(bn || null); if (!bn) { mc.K.push(null); return; }
    const rl = bn.getWorldQuaternion(new THREE.Quaternion()).premultiply(_hqi); // repouso no espaço do modelo
    const K = F.clone().multiply(rl);
    const ch = CHILD[n] && B[CHILD[n]];
    if (ch) { // C: leva a direção de repouso do nosso osso para a direção de repouso do osso da captura
      const d = ch.getWorldPosition(new V3()).sub(bn.getWorldPosition(new V3())).applyQuaternion(_hqi).normalize().applyQuaternion(F);
      const m = new V3(...MC.meta.rest[n]).normalize();
      K.premultiply(new THREE.Quaternion().setFromUnitVectors(d, m));
    }
    mc.K.push(K);
  });
  // meio das articulações do quadril em relação ao osso do quadril (espaço do osso) e comprimento da perna
  const mid = B.LeftUpLeg.getWorldPosition(new V3()).add(B.RightUpLeg.getWorldPosition(new V3())).multiplyScalar(.5);
  mc.hipOff = B.Hips.worldToLocal(mid.clone());
  k.mc = mc;
}
// rotação de mundo do osso i pela captura
function mcWorld(mc, pose, i, out) {
  const k = i * 4; _qd.set(pose.q[k], pose.q[k + 1], pose.q[k + 2], pose.q[k + 3]);
  return out.copy(_qg).multiply(_qd).multiply(mc.K[i]);
}
function setWorldQ(bone, wq) { bone.parent.getWorldQuaternion(_q3); bone.quaternion.copy(_q3.invert().multiply(wq)); bone.updateMatrixWorld(true); }
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------- escolha e mistura dos ciclos ----------
// velocidade local (x para a direita, f para a frente) → pesos de cada ciclo e ritmo da passada
function locoWeights(vx, vf, sp, W) {
  const C = MC.clips;
  // quase parado (freando): mantém a mistura que vinha, só o peso geral cai — sem velocidade não há direção para escolher
  if (Math.hypot(vx, vf) < .15 && W.walk !== undefined) return locoStats(W);
  for (const n in W) W[n] = 0;
  const s2 = sp * sp || 1, wF = Math.max(0, vf) ** 2 / s2, wB = Math.max(0, -vf) ** 2 / s2, wR = Math.max(0, vx) ** 2 / s2, wL = Math.max(0, -vx) ** 2 / s2;
  // família "para a frente": caminhada → trote → corrida pela velocidade
  const sw = Math.abs(C.walk.vel[1]), sj = Math.abs(C.jog.vel[1]), sr = Math.abs(C.run.vel[1]);
  let ww = 0, wj = 0, wr = 0;
  if (sp <= sw) ww = 1; else if (sp < sj) { wj = (sp - sw) / (sj - sw); ww = 1 - wj; } else if (sp < sr) { wr = (sp - sj) / (sr - sj); wj = 1 - wr; } else wr = 1;
  const fwd = C.back ? wF : wF + wB, lat = C.shufR && C.shufL;
  W.walk = fwd * ww; W.jog = fwd * wj; W.run = fwd * wr;
  if (C.back) W.back = wB;
  if (lat) { W.shufR = wR; W.shufL = wL; } else { W.walk += (wR + wL) * (ww + wj * .5); W.jog += (wR + wL) * (wj * .5 + wr); }
  return locoStats(W);
}
const LS = { T: 1, v: 1 };
function locoStats(W) {
  const C = MC.clips; let T = 0, v = 0, tot = 0;
  for (const n in W) { const w = W[n]; if (!(w > 0)) continue; const c = C[n]; T += w * c.dur; v += w * Math.hypot(c.vel[0], c.vel[1]); tot += w; }
  if (!(tot > 1e-4)) { for (const n in W) W[n] = 0; W.walk = 1; T = C.walk.dur; v = Math.abs(C.walk.vel[1]); tot = 1; }
  LS.T = T / tot; LS.v = v / tot; return LS;
}

// ---------- aplica no esqueleto ----------
const FEET = [['LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 1, 2], ['RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase', 3, 4]];
function mocapDrive(p, dt) {
  if (!MC.ok || !p.skin || !p.model.group.visible) return;
  const k = p.skin, B = k.B, m = p.model;
  if (!k.mc) { setup(p); return; }
  const mc = k.mc, dbg = S.mcDebug;
  // quanto a captura manda: pela velocidade; fora em mergulho, salto, lançamento do saque, comemoração e cerimônia
  const sp = Math.hypot(p.vel.x, p.vel.z);
  const sw = p.swing, acting = sw.t >= 0 || p.charging || (p.tail ? 1 : 0);
  const blocked = !!p.dive || p.jump > 0 || (S.mode === 'toss' && S.serverPlayer === p) || S.mode === 'ceremony' || (p.split > 0) || !!p.forceYaw;
  let Wt = blocked ? 0 : smooth(.35, 1.1, sp);
  if (dbg) Wt = 1;
  mc.W += (Wt - mc.W) * Math.min(1, dt * (Wt > mc.W ? 9 : 7));
  mc.act += ((acting ? 1 : 0) - mc.act) * Math.min(1, dt * 12);
  const W = mc.W;
  if (W < .004) { mc.lock[0].on = mc.lock[1].on = 0; return; }
  // velocidade no referencial do corpo
  m.group.getWorldQuaternion(_qg); m.group.getWorldPosition(_gp);
  _a.set(p.vel.x, 0, p.vel.z).applyQuaternion(_q.copy(_qg).invert());
  let vx = _a.x * (p.lefty ? 1 : 1), vf = -_a.z;
  if (dbg) { vx = dbg.vx || 0; vf = dbg.vf == null ? 1.3 : dbg.vf; }
  const spd = dbg ? Math.hypot(vx, vf) : sp;
  const WS = mc.ws || (mc.ws = {});
  const lw = locoWeights(vx, vf, Math.max(spd, .2), WS);
  const rate = clamp(spd / (lw.v || 1), .6, 1.45);
  mc.phase = (mc.phase + dt * rate / Math.max(.2, lw.T)) % 1; if (!(mc.phase >= 0)) mc.phase = 0;
  resetPose(POSE);
  for (const n in WS) if (WS[n] > .004) sample(MC.clips[n], mc.phase, WS[n], POSE);
  if (dbg && dbg.clip && MC.clips[dbg.clip]) { resetPose(POSE); sample(MC.clips[dbg.clip], dbg.t != null ? dbg.t : mc.phase, 1, POSE); }
  finishPose(POSE);
  const r = (k.leg[0] + k.leg[1]) / MC.meta.leg; // escala da captura para as pernas deste jogador
  // poses do jogo (driveSkin) que serão misturadas
  const hip = B.Hips, wq = mc.wq, keep = ['Neck', 'Head'];
  for (const n of ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']) (wq[n] || (wq[n] = new THREE.Quaternion())), B[n].getWorldQuaternion(wq[n]);
  const gA = [B.LeftFoot.getWorldPosition(mc.gA0 || (mc.gA0 = new V3())), B.RightFoot.getWorldPosition(mc.gA1 || (mc.gA1 = new V3()))];
  const gK = [B.LeftLeg.getWorldPosition(mc.gK0 || (mc.gK0 = new V3())), B.RightLeg.getWorldPosition(mc.gK1 || (mc.gK1 = new V3()))];
  const H = B.RightHand && B.LeftHand ? (p.lefty ? B.LeftHand : B.RightHand) : null;
  if (H) { H.getWorldPosition(_e); _e.sub(k.racket.position).negate(); mc.rk = (mc.rk || new V3()).copy(_e); } // raquete em relação à mão
  // quadril: rotação e posição (o meio das articulações das pernas vai para o ponto da captura)
  setWorldQ(hip, mcWorld(mc, POSE, 0, _q).slerp(wq.Hips, 1 - W).normalize());
  _a.copy(mc.hipOff); hip.localToWorld(_a);                                            // onde o meio do quadril está agora
  _b.set(POSE.p[0] * r, POSE.p[1] * r, POSE.p[2] * r).applyQuaternion(_qg).add(_gp);   // onde a captura o quer
  _b.sub(_a).multiplyScalar(W); hip.getWorldPosition(_c).add(_b); hip.parent.worldToLocal(_c); hip.position.copy(_c); hip.updateMatrixWorld(true);
  // coluna: da captura enquanto só se desloca; durante o golpe fica a do jogo (o giro do golpe manda)
  const wT = W * (1 - mc.act);
  [['Spine', 1], ['Spine1', 2], ['Spine2', 3]].forEach(([n, i]) => setWorldQ(B[n], mcWorld(mc, POSE, i, _q).slerp(wq[n], 1 - wT).normalize()));
  for (const n of keep) setWorldQ(B[n], wq[n]); // cabeça e pescoço continuam olhando para onde o jogo mandou
  // pernas: tornozelo e joelho da captura (na escala do jogador), com o pé de apoio preso no chão
  FEET.forEach(([up, lo, ft, toe, ik, ia], s) => {
    const U = B[up], Lw = B[lo], Ft = B[ft], T = B[toe];
    _a.set(POSE.p[ia * 3] * r, POSE.p[ia * 3 + 1] * r, POSE.p[ia * 3 + 2] * r).applyQuaternion(_qg).add(_gp); // tornozelo
    _b.set(POSE.p[ik * 3] * r, POSE.p[ik * 3 + 1] * r, POSE.p[ik * 3 + 2] * r).applyQuaternion(_qg).add(_gp); // joelho
    // pé de apoio: fica onde encostou (sem deslizar), enquanto a perna alcança
    const L = mc.lock[s], ct = POSE.c[s] > .5 && !dbg;
    if (ct && !L.on) { L.on = 1; L.x = _a.x; L.z = _a.z; }
    if (!ct) L.on = 0;
    L.w += ((L.on ? 1 : 0) - L.w) * Math.min(1, dt * (L.on ? 30 : 14));
    if (L.w > .01) {
      const dx = L.x - _a.x, dz = L.z - _a.z, dd = Math.hypot(dx, dz), mx = .22 * r;
      if (dd > mx) { L.x = _a.x + dx / dd * mx; L.z = _a.z + dz / dd * mx; } // longe demais: a trava cede
      _b.x += (L.x - _a.x) * L.w * .5; _b.z += (L.z - _a.z) * L.w * .5;
      _a.x += (L.x - _a.x) * L.w; _a.z += (L.z - _a.z) * L.w;
    }
    _a.lerpVectors(gA[s], _a, W); _b.lerpVectors(gK[s], _b, W);
    U.getWorldPosition(_c);
    _d.subVectors(_b, _c).addScaledVector(_e.subVectors(_a, _c), -.5); // lado para onde o joelho aponta
    jointPos(_c, _a, _d, k.leg[0], k.leg[1], _e);
    _u.subVectors(_e, _c).normalize(); _l.subVectors(_a, _e).normalize(); _h.crossVectors(_u, _l);
    if (_h.lengthSq() < 1e-6 && k.lim[up].h) _h.copy(k.lim[up].h); _h.addScaledVector(_u, -_h.dot(_u)).normalize();
    orientBone(U, k.lim[up], _u, _h); _h.addScaledVector(_l, -_h.dot(_l)).normalize(); orientBone(Lw, k.lim[lo], _l, _h);
    // pé e dedos: rolagem da captura (calcanhar → planta → ponta)
    setWorldQ(Ft, mcWorld(mc, POSE, MC.bi[ft], _q).slerp(wq[ft], 1 - W).normalize());
    setWorldQ(T, mcWorld(mc, POSE, MC.bi[toe], _q).slerp(wq[toe], 1 - W).normalize());
  });
  if (H && mc.rk) { H.getWorldPosition(_e); k.racket.position.copy(_e).add(mc.rk); }
}
if (typeof window !== 'undefined') window.__pdoMC = { MC, mocapLoad };
export { mocapLoad, mocapReady, mocapDrive };
