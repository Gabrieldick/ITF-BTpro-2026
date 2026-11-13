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
  const fwd = C.back ? wF : wF + wB, lat = C.sideR && C.sideL;
  W.walk = fwd * ww; W.jog = fwd * wj; W.run = fwd * wr;
  if (C.back) W.back = wB;
  if (lat) { W.sideR = wR; W.sideL = wL; } else { W.walk += (wR + wL) * (ww + wj * .5); W.jog += (wR + wL) * (wj * .5 + wr); }
  return locoStats(W);
}
const LS = { T: 1, v: 1 };
function locoStats(W) {
  const C = MC.clips; let T = 0, v = 0, tot = 0;
  for (const n in W) { const w = W[n]; if (!(w > 0)) continue; const c = C[n]; T += w * c.dur; v += w * Math.hypot(c.vel[0], c.vel[1]); tot += w; }
  if (!(tot > 1e-4)) { for (const n in W) W[n] = 0; W.walk = 1; T = C.walk.dur; v = Math.abs(C.walk.vel[1]); tot = 1; }
  LS.T = T / tot; LS.v = v / tot; return LS;
}

// ---------- corpo dos golpes ----------
// cada golpe do jogo usa o corpo de um gesto real parecido: arremesso por cima (smash, saque), arremesso por baixo (lob,
// defesa e curta de forehand) e lançamento de disco (backhand). Devolve [trecho, peso] ou null (bloqueios e voleios curtos)
function coreFor(p) {
  if (!p.animK) return null;
  const ak = p.animAk || '';
  if (/reflexo|bloqueio|vfh|vbh|spinto/.test(ak)) return null;
  // peso moderado: o gesto real soma articulação de tronco e transferência de peso; a explosão do golpe continua a do jogo
  if (/ventaglio|veronica/.test(ak)) return ['disc', .4];
  if (ak === 'smash_saquebaixo') return ['toss', .55];
  if (ak.startsWith('smash')) return ['throw', ak === 'smash_bandeja' ? .35 : .45];
  if (p.animMir) return ['disc', ak.startsWith('lob') ? .55 : .5];
  return ['toss', ak.startsWith('lob') ? .6 : ak.startsWith('curta') ? .4 : .5];
}
// fase do golpe do jogo (0 → .3 armado → .45 contato → 1) → tempo no gesto (0 → fim da preparação → soltura → fim)
function coreTime(p, clip) {
  const tA = clip.keys[0], tH = clip.keys[1], tE = clip.keys[2], u = p.animU || 0;
  if (p.animK === 'toss' || p.animK === 'charge') return tA * u;            // lançamento do saque / barra carregando = preparação
  if (p.animAk === 'smash_saque') return u <= .45 ? tA + (tH - tA) * (u / .45) : tH + (tE - tH) * ((u - .45) / .55); // a batida do saque já começa armada
  return u <= .3 ? tA * (u / .3) : u <= .45 ? tA + (tH - tA) * ((u - .3) / .15) : tH + (tE - tH) * ((u - .45) / .55);
}
// espelha a pose (canhoto): troca os lados e reflete as rotações
const PAIRS = [[6, 10], [7, 11], [8, 12], [9, 13], [14, 18], [15, 19], [16, 20], [17, 21]];
function mirrorPose(o) {
  const q = o.q, p = o.p;
  for (let b = 0; b < NB; b++) { q[b * 4 + 1] = -q[b * 4 + 1]; q[b * 4 + 2] = -q[b * 4 + 2]; }
  for (const [a, b] of PAIRS) for (let k = 0; k < 4; k++) { const t = q[a * 4 + k]; q[a * 4 + k] = q[b * 4 + k]; q[b * 4 + k] = t; }
  for (let k = 0; k < NP; k++) p[k * 3] = -p[k * 3];
  for (const [a, b] of [[1, 3], [2, 4]]) for (let k = 0; k < 3; k++) { const t = p[a * 3 + k]; p[a * 3 + k] = p[b * 3 + k]; p[b * 3 + k] = t; }
}
const CORE = newPose(), CORE0 = {};
function core0(name) { // posição do quadril no começo do gesto (o deslocamento do peso é medido a partir dela)
  if (!CORE0[name]) { resetPose(TMP); sample(MC.clips[name], 0, 1, TMP); finishPose(TMP); CORE0[name] = [TMP.p[0], TMP.p[1], TMP.p[2]]; }
  return CORE0[name];
}

// ---------- aplica no esqueleto ----------
const FEET = [['LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 1, 2], ['RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase', 3, 4]];
const KEEPQ = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase'];
const _wr = new V3(), _el = new V3(), _hgq = new THREE.Quaternion(), _s1 = new V3(), _s2 = new V3();
function mocapDrive(p, dt) {
  if (!MC.ok || !p.skin || !p.model.group.visible) return;
  const k = p.skin, B = k.B, m = p.model;
  if (!k.mc) { setup(p); return; }
  const mc = k.mc, dbg = S.mcDebug;
  // quanto a captura de deslocamento manda: pela velocidade; fora em mergulho, salto, lançamento do saque e cerimônia
  const sp = Math.hypot(p.vel.x, p.vel.z);
  const sw = p.swing, acting = sw.t >= 0 || p.charging || (p.tail ? 1 : 0);
  const blocked = !!p.dive || p.jump > 0 || (S.mode === 'toss' && S.serverPlayer === p) || S.mode === 'ceremony' || (p.split > 0) || (!!p.forceYaw && S.mode !== 'livre'); // (no modo livre o corpo segue a direção do passo, com a caminhada capturada)
  let Wt = blocked ? 0 : smooth(.35, 1.1, sp);
  if (dbg) Wt = dbg.core ? 0 : 1;
  mc.W += (Wt - mc.W) * Math.min(1, dt * (Wt > mc.W ? 9 : 7));
  mc.act += ((acting ? 1 : 0) - mc.act) * Math.min(1, dt * 12);
  const W = mc.W;
  // corpo do golpe: entra junto com o golpe e sai aos poucos depois dele
  const cf = p.dive ? null : coreFor(p), cT = cf ? cf[1] : 0;
  if (cf) mc.coreClip = cf[0];
  mc.wC = (mc.wC || 0) + (cT - (mc.wC || 0)) * Math.min(1, dt * (cT > (mc.wC || 0) ? 14 : 5));
  const wC = MC.clips[mc.coreClip] ? mc.wC : 0;
  if (W < .004 && wC < .004) { // parado e sem golpe: só o ritmo dos ombros
    mc.lock[0].on = mc.lock[1].on = 0;
    const Hh = B[(p.lefty ? 'Left' : 'Right') + 'Hand']; Hh.getWorldPosition(_wr); mc.rk = (mc.rk || new V3()).copy(k.racket.position).sub(_wr);
    shoulders(p, k, B, mc, dt); Hh.getWorldPosition(_e); k.racket.position.copy(_e).add(mc.rk); return;
  }
  m.group.getWorldQuaternion(_qg); m.group.getWorldPosition(_gp);
  const r = (k.leg[0] + k.leg[1]) / MC.meta.leg; // escala da captura para as pernas deste jogador
  let latW = 0, spd = sp;
  if (W >= .004) {
    // velocidade no referencial do corpo → mistura dos ciclos e ritmo da passada
    _a.set(p.vel.x, 0, p.vel.z).applyQuaternion(_q.copy(_qg).invert());
    let vx = _a.x, vf = -_a.z;
    if (dbg) { vx = dbg.vx || 0; vf = dbg.vf == null ? 1.3 : dbg.vf; spd = Math.hypot(vx, vf); }
    const WS = mc.ws || (mc.ws = {});
    const lw = locoWeights(vx, vf, Math.max(spd, .2), WS);
    latW = (WS.sideR || 0) + (WS.sideL || 0);
    const rate = clamp(spd / (lw.v || 1), .6, 1.45 + .5 * latW); // (o passo lateral da captura é lento: no jogo ele acelera mais)
    mc.phase = (mc.phase + dt * rate / Math.max(.2, lw.T)) % 1; if (!(mc.phase >= 0)) mc.phase = 0;
    resetPose(POSE);
    for (const n in WS) if (WS[n] > .004) sample(MC.clips[n], mc.phase, WS[n], POSE);
    if (dbg && dbg.clip && MC.clips[dbg.clip]) { resetPose(POSE); sample(MC.clips[dbg.clip], dbg.t != null ? dbg.t : mc.phase, 1, POSE); }
    finishPose(POSE);
  }
  if (wC >= .004) {
    const clip = MC.clips[mc.coreClip];
    mc.coreT = cf ? coreTime(p, clip) : Math.min(clip.keys[2], (mc.coreT || 0) + dt * .6); // depois do golpe: termina o gesto devagar enquanto sai
    resetPose(CORE); sample(clip, mc.coreT, 1, CORE); finishPose(CORE);
    if (p.lefty) mirrorPose(CORE);
  }
  // poses do jogo (driveSkin) que entram na mistura
  const hip = B.Hips, wq = mc.wq;
  for (const n of KEEPQ) (wq[n] || (wq[n] = new THREE.Quaternion())), B[n].getWorldQuaternion(wq[n]);
  const gA = [B.LeftFoot.getWorldPosition(mc.gA0 || (mc.gA0 = new V3())), B.RightFoot.getWorldPosition(mc.gA1 || (mc.gA1 = new V3()))];
  const gK = [B.LeftLeg.getWorldPosition(mc.gK0 || (mc.gK0 = new V3())), B.RightLeg.getWorldPosition(mc.gK1 || (mc.gK1 = new V3()))];
  const Rn = p.lefty ? 'Left' : 'Right', On = p.lefty ? 'Right' : 'Left', H = B[Rn + 'Hand'];
  H.getWorldPosition(_wr); B[Rn + 'ForeArm'].getWorldPosition(_el); H.getWorldQuaternion(_hgq); // punho, cotovelo e mão da raquete como o jogo pediu
  mc.rk = (mc.rk || new V3()).copy(k.racket.position).sub(_wr);                                 // raquete em relação à mão
  // quadril: rotação (deslocamento e/ou golpe) e posição
  _q.copy(wq.Hips);
  if (W >= .004) _q.slerp(mcWorld(mc, POSE, 0, _q2), W);
  if (wC >= .004) _q.slerp(mcWorld(mc, CORE, 0, _q2), wC);
  setWorldQ(hip, _q.normalize());
  _b.set(0, 0, 0);
  if (W >= .004) {
    _a.copy(mc.hipOff); hip.localToWorld(_a);                                           // onde o meio do quadril está agora
    // base atlética: no rali o quadril vai um pouco mais baixo que na captura (gente andando em pé), mais ainda de lado
    const low = (S.mode === 'rally' ? .035 : 0) + .075 * latW * clamp(spd / 1.5, 0, 1);
    _b.set(POSE.p[0] * r, (POSE.p[1] - low) * r, POSE.p[2] * r).applyQuaternion(_qg).add(_gp).sub(_a).multiplyScalar(W);
  }
  if (wC >= .004) { // transferência de peso do gesto: o quadril avança/abaixa como na captura (as pernas acompanham pelos pés plantados)
    const c0 = core0(mc.coreClip), sx = p.lefty ? -1 : 1;
    _c.set((CORE.p[0] - c0[0] * sx) * r, (CORE.p[1] - c0[1]) * r, (CORE.p[2] - c0[2]) * r).applyQuaternion(_qg).multiplyScalar(wC * .8);
    _b.add(_c);
  }
  hip.getWorldPosition(_c).add(_b); hip.parent.worldToLocal(_c); hip.position.copy(_c); hip.updateMatrixWorld(true);
  // coluna: do deslocamento enquanto só corre; no golpe, do gesto real
  const wT = W * (1 - mc.act);
  [['Spine', 1], ['Spine1', 2], ['Spine2', 3]].forEach(([n, i]) => {
    _q.copy(wq[n]);
    if (wT >= .004) _q.slerp(mcWorld(mc, POSE, i, _q2), wT);
    if (wC >= .004) _q.slerp(mcWorld(mc, CORE, i, _q2), wC);
    setWorldQ(B[n], _q.normalize());
  });
  setWorldQ(B.Neck, wq.Neck); setWorldQ(B.Head, wq.Head); // cabeça e pescoço continuam olhando para onde o jogo mandou
  // pernas: tornozelo e joelho (do jogo ou da captura de deslocamento), com o pé de apoio preso no chão
  FEET.forEach(([up, lo, ft, toe, ik, ia], s) => {
    const U = B[up], Lw = B[lo], Ft = B[ft], T = B[toe], L = mc.lock[s];
    if (W >= .004) {
      // de lado, a base abre (deslocamento de defesa: pés mais afastados que no andar de lado da captura)
      const wide = (ft.startsWith('Left') ? -1 : 1) * .1 * latW * clamp(spd / 1.5, 0, 1);
      _a.set((POSE.p[ia * 3] + wide) * r, POSE.p[ia * 3 + 1] * r, POSE.p[ia * 3 + 2] * r).applyQuaternion(_qg).add(_gp); // tornozelo
      _b.set((POSE.p[ik * 3] + wide * .6) * r, POSE.p[ik * 3 + 1] * r, POSE.p[ik * 3 + 2] * r).applyQuaternion(_qg).add(_gp); // joelho
      const ct = POSE.c[s] > .5 && !dbg;
      if (ct && !L.on) { L.on = 1; L.x = _a.x; L.z = _a.z; }
      if (!ct) L.on = 0;
      L.w += ((L.on ? 1 : 0) - L.w) * Math.min(1, dt * (L.on ? 30 : 14));
      if (L.w > .01) { // pé de apoio: fica onde encostou (sem deslizar), enquanto a perna alcança
        const dx = L.x - _a.x, dz = L.z - _a.z, dd = Math.hypot(dx, dz), mx = .22 * r;
        if (dd > mx) { L.x = _a.x + dx / dd * mx; L.z = _a.z + dz / dd * mx; } // longe demais: a trava cede
        _b.x += (L.x - _a.x) * L.w * .5; _b.z += (L.z - _a.z) * L.w * .5;
        _a.x += (L.x - _a.x) * L.w; _a.z += (L.z - _a.z) * L.w;
      }
      _a.lerpVectors(gA[s], _a, W); _b.lerpVectors(gK[s], _b, W);
    } else { L.on = 0; L.w = 0; _a.copy(gA[s]); _b.copy(gK[s]); }
    U.getWorldPosition(_c);
    _d.subVectors(_b, _c).addScaledVector(_e.subVectors(_a, _c), -.5); // lado para onde o joelho aponta
    jointPos(_c, _a, _d, k.leg[0], k.leg[1], _e);
    _u.subVectors(_e, _c).normalize(); _l.subVectors(_a, _e).normalize(); _h.crossVectors(_u, _l);
    if (_h.lengthSq() < 1e-6 && k.lim[up].h) _h.copy(k.lim[up].h); _h.addScaledVector(_u, -_h.dot(_u)).normalize();
    orientBone(U, k.lim[up], _u, _h); _h.addScaledVector(_l, -_h.dot(_l)).normalize(); orientBone(Lw, k.lim[lo], _l, _h);
    // pé e dedos: do jogo, ou a rolagem da captura (calcanhar → planta → ponta)
    _q.copy(wq[ft]); if (W >= .004) _q.slerp(mcWorld(mc, POSE, MC.bi[ft], _q2), W); setWorldQ(Ft, _q.normalize());
    _q.copy(wq[toe]); if (W >= .004) _q.slerp(mcWorld(mc, POSE, MC.bi[toe], _q2), W); setWorldQ(T, _q.normalize());
  });
  // ombros e braço livre: no golpe, do gesto real (menos enquanto a mão livre aponta a bola no smash)
  if (wC >= .004) {
    const wF = wC * (1 - Math.min(1, (p.prep || 0) * 1.5)) * (1 - Math.min(1, (p.twoH || 0) * 1.5)); // (no backhand de duas mãos a mão livre fica na raquete)
    for (const n of [Rn + 'Shoulder']) { const bn = B[n]; bn.getWorldQuaternion(_q); setWorldQ(bn, _q.slerp(mcWorld(mc, CORE, MC.bi[n], _q2), wC * .8).normalize()); }
    if (wF > .004) for (const n of [On + 'Shoulder', On + 'Arm', On + 'ForeArm', On + 'Hand']) { const bn = B[n]; bn.getWorldQuaternion(_q); setWorldQ(bn, _q.slerp(mcWorld(mc, CORE, MC.bi[n], _q2), wF).normalize()); }
  }
  // braço da raquete: volta para o punho que o jogo pediu (o contato com a bola fica no mesmo lugar e tempo). Só correndo,
  // sem golpe, o braço acompanha o tronco
  const aW = Math.max(mc.act, Math.min(1, wC * 2.5));
  if (aW > .01) {
    H.getWorldPosition(_s1); B[Rn + 'ForeArm'].getWorldPosition(_s2);
    _wr.lerpVectors(_s1, _wr, aW); _el.lerpVectors(_s2, _el, aW); H.getWorldQuaternion(_q); _hgq.copy(_q.slerp(_hgq, aW).normalize());
    armIK(k, B, Rn, p.lefty ? k.armL : k.arm, _wr, _el, _hgq);
  }
  shoulders(p, k, B, mc, dt);
  H.getWorldPosition(_e); k.racket.position.copy(_e).add(mc.rk);
}
// braço (dois ossos) até o punho e o cotovelo pedidos, com a mão na rotação pedida
function armIK(k, B, side, aL, wrist, elbow, handQ) {
  const Ua = B[side + 'Arm'], Fa = B[side + 'ForeArm'], Hd = B[side + 'Hand'], lim = k.lim[side + 'Arm'];
  Ua.getWorldPosition(_c);
  _d.subVectors(elbow, _c).addScaledVector(_e.subVectors(wrist, _c), -.5);
  jointPos(_c, wrist, _d, aL[0], aL[1], _e);
  _u.subVectors(_e, _c).normalize(); _l.subVectors(wrist, _e).normalize(); _h.crossVectors(_u, _l);
  if (lim.h && (_h.lengthSq() < .02 || _h.dot(lim.h) < .2 * _h.length())) _h.copy(lim.h); // braço quase esticado: o eixo do cotovelo vem do jogo (sem girar de um quadro para o outro)
  if (_h.lengthSq() > 1e-8) { _h.addScaledVector(_u, -_h.dot(_u)).normalize(); orientBone(Ua, lim, _u, _h); _h.addScaledVector(_l, -_h.dot(_l)).normalize(); orientBone(Fa, k.lim[side + 'ForeArm'], _l, _h); }
  setWorldQ(Hd, handQ);
}
// ritmo dos ombros: a clavícula sobe quando o braço sobe e vai para a frente/trás com ele (num smash o ombro chega perto da
// orelha); depois o braço é refeito até o mesmo punho, então a mão (e a raquete) não saem do lugar
const _right = new V3(), _up = new V3(), _fw = new V3(), _w2 = new V3(), _e2 = new V3(), _hq2 = new THREE.Quaternion(), _qe = new THREE.Quaternion(), _qp = new THREE.Quaternion();
function shoulders(p, k, B, mc, dt) {
  B.RightArm.getWorldPosition(_a); B.LeftArm.getWorldPosition(_b); _right.subVectors(_a, _b).normalize();
  B.Neck.getWorldPosition(_a); B.Spine2.getWorldPosition(_b); _up.subVectors(_a, _b).normalize();
  _fw.crossVectors(_up, _right).normalize(); _up.crossVectors(_right, _fw).normalize();
  const st = mc.sh || (mc.sh = { Left: [0, 0], Right: [0, 0] });
  for (const side of ['Left', 'Right']) {
    const C = B[side + 'Shoulder'], Ua = B[side + 'Arm'], Fa = B[side + 'ForeArm'], Hd = B[side + 'Hand'], sg = side === 'Right' ? 1 : -1;
    Ua.getWorldPosition(_a); Fa.getWorldPosition(_e2); Hd.getWorldPosition(_w2); Hd.getWorldQuaternion(_hq2);
    _d.subVectors(_e2, _a).normalize();
    const el = Math.asin(clamp(_d.dot(_up), -1, 1)), fwd = _d.dot(_fw);
    // elevação: nada com o braço caído, ~10° na horizontal, ~26° acima da cabeça; avanço/recuo: até ±13°
    const tE = clamp((el + .55) * .32, 0, .46), tP = clamp(fwd * .23, -.2, .23) * (1 - Math.max(0, _d.dot(_up)) * .5);
    const S = st[side], kk = Math.min(1, dt * 18); S[0] += (tE - S[0]) * kk; S[1] += (tP - S[1]) * kk;
    if (S[0] < .01 && Math.abs(S[1]) < .01) continue;
    _qe.setFromAxisAngle(_fw, -sg * S[0]); _qp.setFromAxisAngle(_up, sg * S[1]);
    C.getWorldQuaternion(_q); setWorldQ(C, _qp.multiply(_qe).multiply(_q).normalize());
    armIK(k, B, side, side === 'Left' ? k.armL : k.arm, _w2, _e2, _hq2);
  }
}
if (typeof window !== 'undefined') window.__pdoMC = { MC, mocapLoad };
export { mocapLoad, mocapReady, mocapDrive };
