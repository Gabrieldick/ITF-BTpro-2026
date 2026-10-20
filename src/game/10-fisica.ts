// @ts-nocheck
// física da bola, trajetórias e o golpe (doHit)
import './09-interface';
import { $s } from '../state';
import { ATTR_OF, C, G, SERVES, SHOTS, V3, attrK, bG, clamp, gauss, hScale, lerp, rand, shortK } from './00-base';
import { S } from './01-estado';
import { VAR_FX, swingVar } from './04-poses';
import { ball } from './07-glb';
import { sndHit } from './08-audio';
import { humanAim, humanDepthT, skillOf, startJump } from './11-mira';
import { aiAim } from './16-ia';
import { sideOf } from './18-animacao';
// ---------- Física ----------
function solveShot(p0, tgt, spec) {
  const dx = tgt.x - p0.x, dz = tgt.z - p0.z; const d = Math.hypot(dx, dz);
  let T = spec.lowArc ? Math.max(.3, d / 14) : (spec.T || Math.max(.28, d / spec.speed));
  const v = new V3(), g = G * (spec.gk || 1);
  for (let i = 0; i < 45; i++) {
    v.set(dx / T, (tgt.y - p0.y + .5 * g * T * T) / T, dz / T);
    if (Math.sign(p0.z) === Math.sign(tgt.z) || Math.abs(v.z) < 1e-4) break;
    const tn = -p0.z / v.z; const yn = p0.y + v.y * tn - .5 * g * tn * tn;
    if (yn >= C.netH + C.ballR + spec.margin) break;
    T *= 1.06;
  }
  return v;
}
function predictLanding() {
  const y = ball.pos.y - C.ballR, vy = ball.vel.y, g = bG();
  const t = (vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * y))) / g;
  return new V3(ball.pos.x + ball.vel.x * t, 0, ball.pos.z + ball.vel.z * t);
}
function reachOf(type, p) { return type === 'defesa' ? 1.24 + (p ? attrK(p, 'def') : .65) * .28 : 1.28; }
const _rf = new V3();
// o centro da face da raquete precisa estar perto da bola
const _sh = new V3();
function smashReach(p) {
  if (ball.state !== 'live' || S.lastTeam === p.team) return false;
  if (p.team === 0 ? ball.pos.z < .05 : ball.pos.z > -.05) return false;
  if (ball.pos.y < 1.75) return false;
  p.model.armR.sh.getWorldPosition(_sh);
  _sh.y += Math.max(0, .25 - p.model.group.position.y);
  return _sh.distanceTo(ball.pos) <= 1.08 * hScale(p);
}
function racketNearBall(p, r) {
  if (ball.state !== 'live' || S.lastTeam === p.team) return false;
  if (p.team === 0 ? ball.pos.z < .05 : ball.pos.z > -.05) return false;
  p.model.racket.localToWorld(_rf.set(0, -.363, 0));
  return _rf.distanceTo(ball.pos) <= r;
}
function canHit(p, type, scale) {
  if (ball.state !== 'live' || S.lastTeam === p.team) return false;
  if (p.team === 0 ? ball.pos.z < .05 : ball.pos.z > -.05) return false;
  const dh = Math.hypot(ball.pos.x - p.pos.x, ball.pos.z - p.pos.z, type === 'smash' ? 0 : Math.max(0, Math.abs(ball.pos.y - 1.05 * hScale(p)) - .55) * .7);
  const maxY = (type === 'smash' ? 3.0 : 2.6) * hScale(p);
  if (ball.pos.y < .8) scale = (scale || 1) * (1 + .14 * shortK(p));
  if (p.dive && p.dive.t < .5 && ball.pos.y < 1.3) scale = (scale || 1) * 1.3; // no mergulho o braço vai até o fim
  return dh <= reachOf(type, p) * (scale || 1) && ball.pos.y >= .12 && ball.pos.y <= maxY;
}
function hitQuality(p, type) {
  const dh = Math.hypot(ball.pos.x - p.pos.x, ball.pos.z - p.pos.z);
  const reach = reachOf(type, p);
  const idealY = (type === 'smash' && ball.pos.y >= 1.9) ? 2.4 : 1.15;
  let q = 1 - .55 * Math.max(0, dh - .55) / (reach - .55) - .45 * Math.min(1, Math.abs(ball.pos.y - idealY) / 1.4);
  const inSpeed = Math.hypot(ball.vel.x, ball.vel.z);
  if (inSpeed > 14 && type !== 'defesa') q *= .72;
  if (type === 'defesa') q = Math.max(q, .45);
  q *= lerp(.86, 1.06, attrK(p, ATTR_OF[type] || 'def'));
  if (type === 'curta' || ball.pos.y < .8) q *= 1 + .07 * shortK(p);
  if (p.dive) q *= .82; // golpe de mergulho: salva a bola, mas sai pior
  return clamp(q, .1, 1);
}
function doHit(p, type, q, isServe, mod) {
  mod = mod || {};
  let key = type;
  if (!isServe && type === 'smash' && (ball.pos.y < 1.9 || mod.volley)) key = 'drive';
  let spec = Object.assign({}, isServe ? SERVES[type] : SHOTS[key]);
  if (mod.volley) spec.label = 'VOLEIO';
  // quanto mais forte a bola que chega, maior a chance de a devolução sair levantada ou para fora
  let pop = false, wild = false, grade = q;
  // bola do lado esquerdo do jogador (fora o smash por cima): backhand
  const bhSide = !isServe && key !== 'smash' && sideOf(p) < -.15;
  if (bhSide) {
    const bh = attrK(p, 'backhand');
    spec.noise *= lerp(1.6, 1.05, bh);
    q *= lerp(.72, .98, bh);
    mod.misBoost = (mod.misBoost || 0) + (1 - bh) * .18;
  }
  let contactWord = '';
  if (!isServe) {
    // posição da bola em relação ao corpo: lateral (lado da raquete +) e à frente (+)
    const fwdS = p.team === 0 ? -1 : 1, rightS = (p.team === 0 ? 1 : -1) * (p.lefty ? -1 : 1);
    const lat = (ball.pos.x - p.pos.x) * rightS, fwd = (ball.pos.z - p.pos.z) * fwdS;
    const over = key === 'smash', iLat = over ? .25 : bhSide ? -.6 : .7, iFwd = over ? .15 : .25;
    const off = Math.hypot(over ? lat - iLat : Math.abs(lat) - Math.abs(iLat), fwd - iFwd);
    const sweet = 1 - clamp((off - .2) / .75, 0, 1);
    q *= key === 'defesa' ? lerp(.88, 1.03, sweet) : lerp(.8, 1.03, sweet); // na defesa (reflexo) a posição pesa menos
    mod.speedMul = (mod.speedMul || 1) * lerp(.88, 1.04, sweet); mod.noiseMul = (mod.noiseMul || 1) * lerp(1.45, .95, sweet);
    if (sweet < .3) contactWord = 'NO ARO'; else if (sweet > .9) contactWord = 'NO MEIO';
    // bater adiantado puxa a bola para a diagonal; atrasado, para a paralela
    const early = fwd - iFwd;
    if (!over && Math.abs(early) > .3) { const ms = key === 'curta' ? .4 : 1.2; mod.aimShift = clamp(-early * 1.3 * (bhSide ? -1 : 1), -ms, ms) * rightS; contactWord = contactWord || (early > 0 ? 'ADIANTADO' : 'ATRASADO'); }
  }
  const inSpeed = Math.hypot(ball.vel.x, ball.vel.z);
  // devolução de saque pesa menos (o recebedor já está esperando a bola)
  const pressure = isServe || key === 'smash' ? 0 : clamp((inSpeed - 12) / 9 + (ball.finisher ? .35 : 0), 0, 1.3) * (S.rally === 1 ? .5 : 1);
  if (pressure > 0) {
    // contra bola forte, o golpe de defesa é o mais seguro; a curta (toque) é uma aposta: levanta ou sai mais
    const risk = key === 'defesa' ? .6 : key === 'curta' ? 1.45 : 1;
    const qq = clamp((mod.timing === undefined ? q : q * .6 + mod.timing * .4) + (attrK(p, 'def') - .7) * .5 + (key === 'defesa' ? .06 : 0), 0, 1);
    grade = qq;
    const pOut = pressure * (1 - qq) * .45 * risk, pPop = pressure * (.12 + (1 - qq) * .9) * risk;
    const r0 = Math.random();
    if (r0 < pOut) wild = true; else if (r0 < pOut + pPop) pop = true;
  }
  if (pop) spec = { label: spec.label, T: rand(1.5, 1.9), depth: [2.2, 4.2], margin: .4, noise: .4 };
  // defesa: quanto melhor o golpe (timing/posição) e o atributo, mais baixa e rápida ela volta; só a ruim flutua
  if (!pop && key === 'defesa') {
    const dq = mod.timing === undefined ? grade : grade * .6 + mod.timing * .4;
    const dk = clamp((dq - .4) / .45, 0, 1);
    // contra pancada, a defesa boa (e às vezes a amarela) pode virar um lob alto para o fundo
    if (S.rally !== 1 && (pressure > .3 || inSpeed > 14) && dq >= .5 && Math.random() < lerp(.3, .55, dk)) { // na devolução de saque, não
      spec.T = rand(1.75, 2.15); spec.depth = [6.3, 7.4]; spec.margin = .5; spec.label = 'DEFESA ALTA';
    } else {
      spec.T = lerp(1.25, .78, dk) * lerp(1.06, .94, attrK(p, 'def'));
      spec.margin = lerp(.3, .07, dk); // bem batida passa rente à rede (abaixo da altura de finalização do jogador da rede)
    }
  }
  let lobLong = 0, finisher = false;
  if (!isServe && key === 'smash' && Math.abs(p.pos.z) < 2.2 && ball.pos.y > 2.0) {
    finisher = true;
    spec.speed *= 1.25; spec.depth = [3.0, 5.6]; spec.noise *= .8; spec.label = 'FINALIZAÇÃO';
  }
  // smash do fundo (além de 3,5 m da rede): chega mais lento e menos preciso, para todos
  if (!isServe && key === 'smash' && !finisher && !mod.volley) {
    const far = clamp((Math.abs(p.pos.z) - 3.5) / 3.5, 0, 1);
    if (far > 0) { spec.speed *= 1 - far * .18; spec.noise *= 1 + far * .8; mod.misBoost = (mod.misBoost || 0) + far * (.03 + (1 - attrK(p, 'smash')) * .2); mod.oppMissBoost = (mod.oppMissBoost || 0) * (1 - far * .7); }
  }
  if (!pop && key === 'lob' && mod.lobPower !== undefined) {
    const lp = clamp(mod.lobPower, 0, 1);
    spec.T = lerp(1.25, 2.6, lp); spec.depth = [lerp(5.4, 6.4, lp), lerp(7.0, 7.6, lp)];
    spec.label = lp < .35 ? 'LOB BAIXO' : lp < .75 ? 'LOB' : 'LOB ALTO';
    lobLong = Math.max(0, mod.lobPower - 1);
  }
  if (spec.speed) spec.speed *= mod.speedMul || 1;
  if (spec.T) spec.T /= mod.speedMul || 1;
  spec.noise *= mod.noiseMul || 1;
  if (p.char) {
    const A = p.char.a;
    spec.noise *= lerp(1.6, .65, (isServe ? A.saque : A[ATTR_OF[key]] || A.def) / 100);
    if (!isServe && (key === 'smash' || key === 'drive')) spec.speed *= lerp(.82, 1.12, A.forca / 100);
    if (isServe && spec.speed) spec.speed *= lerp(.88, 1.1, (A.forca + A.saque) / 200);
    if (isServe) mod.oppMissBoost = (mod.oppMissBoost || 0) + Math.max(0, (A.saque - 60) / 100) * .07;
  }
  const dir = p.team === 0 ? -1 : 1;
  const lim = C.halfW - (key === 'curta' ? .8 : .35); // curta mira mais para dentro (é toque, não precisa da linha)
  let aim = pop ? rand(-1, 1) * (C.halfW - 1) : clamp(p.isHuman ? humanAim() : aiAim(p), -lim, lim);
  if (mod.aimShift) aim = clamp(aim + mod.aimShift, -lim - .45, lim + .45);
  // variação do golpe conforme o contato
  const vr = isServe || pop ? '' : swingVar(type, ball.pos.y, p, aim);
  const vfx = vr && key !== 'drive' ? VAR_FX[type + '_' + vr] : null;
  if (vfx) {
    if (!finisher) spec.label = vfx.label;
    if (vfx.speed && spec.speed) spec.speed *= vfx.speed; if (vfx.depth) spec.depth = vfx.depth; if (vfx.T && spec.T) spec.T = vfx.T;
    if (vfx.noise) spec.noise *= vfx.noise; if (vfx.gk) spec.gk = vfx.gk;
    if (vfx.wide) aim = Math.sign(aim || rand(-1, 1)) * lim * .92;
    if (vfx.jump) startJump(p, .5, .42);
  }
  if (!isServe) p.swing.var = vr;
  if (!spec.gk) spec.gk = pop ? 1 : isServe ? (type === 'smash' ? 1.12 : 1) : ({ smash: 1.35, drive: 1.18, lob: 1.1, curta: 1, defesa: 1 }[key] || 1);
  // curta: só sai rápida e rente à rede com bom timing/qualidade e atributo de curta alto; as comuns são mais lentas e alcançáveis
  let curtaK = 0;
  if (key === 'curta' && !pop && !isServe) {
    const tq = mod.timing === undefined ? q : q * .4 + mod.timing * .6; // o toque na hora certa (anel verde) é o que mais conta
    curtaK = clamp((tq - .45) / .4, 0, 1) * lerp(.65, 1, clamp((attrK(p, 'curta') - .55) / .4, 0, 1));
    spec.gk = lerp(.95, 1.6, curtaK) * (vr === 'baixa' ? .93 : 1);
    spec.margin = lerp(.14, .07, curtaK);
    if (curtaK > .86 && !finisher) spec.label = 'CURTA MATADORA';
  }
  const err = 1.15 - q;
  const depth = p.isHuman && !pop && !isServe ? lerp(spec.depth[0], spec.depth[1], humanDepthT()) + rand(-.2, .2) : rand(spec.depth[0], spec.depth[1]);
  const tgt = new V3(aim + gauss() * spec.noise * err, C.ballR, dir * (depth + gauss() * spec.noise * err * 1.2));
  if (wild) { tgt.x += (Math.random() < .5 ? -1 : 1) * rand(.8, 2.2); tgt.z += dir * rand(1.2, 3.2); }
  if (lobLong > 0) tgt.z += dir * (1 + lobLong * 14);
  if (dir < 0 && tgt.z > -.4) tgt.z = -.4;
  if (dir > 0 && tgt.z < .4) tgt.z = .4;
  const v = solveShot(ball.pos, tgt, spec);
  let mis = false;
  const unforced = !p.isHuman && !isServe && Math.random() < skillOf(p).err;
  if (unforced || (mod.misBoost && Math.random() < mod.misBoost) || (q < .4 && Math.random() < (.4 - q) * 2.2)) {
    mis = true;
    if (Math.random() < .5) v.y -= 1.2 + Math.random() * 1.6; else v.multiplyScalar(1.12 + Math.random() * .14);
  }
  // para as estatísticas: quem bateu, que golpe, e se a bola que chegou era difícil (erro forçado)
  S.lastHit = { p, cat: isServe ? 'saque' : mod.volley ? 'voleio' : key, hard: !isServe && (inSpeed > 14 || !!ball.finisher || pressure > .35 || q < .45), hitId: S.hitId + 1 };
  ball.vel.copy(v); ball.gk = spec.gk || 1; ball.state = 'live'; ball.oppMiss = (mod.oppMissBoost || 0) + (finisher ? .22 : 0); ball.finisher = finisher;
  ball.apex = ball.pos.y + Math.max(0, v.y) * Math.max(0, v.y) / (2 * G);
  S.lastTeam = p.team; S.hitId++; S.rally++;
  const power = key === 'smash' ? 1 : key === 'drive' ? .7 : key === 'curta' ? .1 : .4;
  sndHit(power);
  if (key === 'smash') { S.shake = p.isHuman ? .25 : .1; if (p.isHuman) S.stats.smashes++; }
  $s.teams[1 - p.team].forEach(o => { o.ai.reactT = skillOf(o).react; o.split = .26; });
  p.swing.type = isServe ? 'smash' : type; p.swing.hit = true;
  const hitAt = isServe ? .3 : .45;
  if (p.swing.t < 0 || p.swing.t < p.swing.dur * hitAt) p.swing.t = p.swing.dur * hitAt;
  if (key === 'smash' && ball.pos.y > 2.2) startJump(p, .38, .3);
  if (pressure <= 0 && mod.timing !== undefined) grade = q * .6 + mod.timing * .4;
  if (key === 'curta' && !pop) grade = clamp(.7 + (curtaK - .5) * .6, .05, 1); // cor do anel da curta: verde a partir de uma curta BOA
  return { key, label: spec.label, mis, pop, wild, grade, pressure, backhand: bhSide, contact: contactWord, curtaK };
}

export { reachOf, canHit, doHit, hitQuality, predictLanding, racketNearBall, smashReach, solveShot };
