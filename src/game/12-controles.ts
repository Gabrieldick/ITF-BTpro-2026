// @ts-nocheck
// teclado, toque, barras de força e menus
import './11-mira';
import { canHit } from './10-fisica';
import { ATTRS, C, HEIGHTS, NAMES, PLAY_STYLES, RACKET_STATS, ROSTER, SWING_DUR, TOSS_T, V3, bG, charById, clamp, hScale, heightOf, lerp, nameOf, overall, attrN, attrK, attrOf } from './00-base';
import { S, isMobile, NET } from './01-estado';
import { camera } from './02-render';
import { swingVar } from './04-poses';
import { human } from './06-modelos';
import { ball, BALL_STYLES, setBallStyle, drawBall } from './07-glb';
import { ac, surf } from './08-audio';
import { $, dupla, el, feedback, isTouch, shotBtns, shotFeedback, COURTS } from './09-interface';
import { startJump, startToss } from './11-mira';
import { adjustFov, rkInfo, startFromMenu, syncAssistButtons, toggleAssist } from './15-carreira-telas';
import { humanPlan, playStyleOf } from './16-ia';
import { CAM3, sideOf } from './18-animacao';
// ---------- Controles ----------
const keys = {};
const touch = { x: 0, z: 0, id: null };
const PAD = { x: 0, z: 0 }; // controle (Xbox/PS): analógico esquerdo e direcional
const newMeter = () => ({ active: false, kind: null, type: null, t: 0, v: 0, rate: 0, fill: .75, center: .78, half: .068, armedTap: false, showT: 0 });
const MTR = newMeter();
human.mtr = MTR;
// controle de um jogador humano: o local (teclado/toque, barra na tela) ou um remoto do modo online
// (entradas chegam pela rede; barra e mensagens vão para a fila "out" e são enviadas ao convidado)
let LOCAL = null;
const localCtl = () => LOCAL || (LOCAL = { p: human, m: MTR, plan: humanPlan, remote: false });
function makeRemoteCtl(p) { const m = newMeter(); p.mtr = m; return { p, m, plan: { id: -1, plan: null }, remote: true, ix: 0, iz: 0, assistMove: false, lag: 0, out: [] }; }
function ctlFeedback(c, main, small, kind) { if (c && c.remote) c.out.push(['fb', main, small || null, kind || null]); else shotFeedback(main, small, kind); }
const ZONE = { facil: .095, medio: .068, dificil: .048 };
// dificuldade de timing de quem joga (1 a 6 estrelas): janela do perfeito maior com menos estrelas, menor com mais.
// Carreira: as estrelas da carreira; fora dela: a configuração de cada um (no online, a de cada jogador)
const TIMING_K = [1.45, 1.2, 1, .87, .75, .66];
function timingLv(c) { const v = c && c.remote ? c.pd : S.careerActive ? S.careerStars : S.settings.playerDiff; return clamp(Math.round(+v || 3), 1, 6); }
const timingK = c => TIMING_K[timingLv(c) - 1];
const RES_WORD = { perfeito: 'PERFEITO', cedo: 'CEDO', tarde: 'TARDE', voleio: 'VOLEIO' };
const LOB_MAX = 1.25;
const KICK = [.15, .32]; // faixa do lob chutado perfeito, no começo da barra (~75 ms)
// bola que vem de um lob alto cai mais rápido: a faixa perfeita do smash fica menor
function smashZoneScale() { return clamp(1.2 - ((ball.apex || 3.5) - 3.5) * .12, .45, 1.2); }
function smashIdealPoint() {
  if (ball.state !== 'live') return null;
  const pos = ball.pos.clone(), vel = ball.vel.clone(); const dt = .01;
  for (let t = 0; t < 3; t += dt) {
    vel.y -= bG() * dt; pos.addScaledVector(vel, dt);
    if (vel.y < 0 && pos.y <= 2.45) return pos;
    if (pos.y < C.ballR) return pos;
  }
  return null;
}
function startMeter(kind, type, c = localCtl()) {
  const M = c.m, p = c.p;
  Object.assign(M, { active: true, kind, type, t: 0, v: 0, rate: 0, tr: null, seen: false, armedTap: false, showT: 0 });
  // carreira: dificuldade em estrelas (3 = padrão) deixa a faixa verde maior ou menor
  M.tk = timingK(c); const half = ZONE[S.settings.diff] * M.tk; // janela do perfeito pela dificuldade de timing de quem joga
  if (kind === 'smash') {
    // a faixa verde fica parada; a velocidade da barra se ajusta para o verde coincidir com a chegada da bola
    // a faixa verde muda de lugar a cada smash (a velocidade da barra se ajusta para ela coincidir com a chegada da bola)
    M.fill = .75; M.half = half * .8; M.center = c.smC || (.5 + Math.random() * .42); p.charging = true; M.ideal = smashIdealPoint();
  }
  // lob: a barra sobe um pouco mais rápido que antes (.45 s até o fim da faixa normal) e a zona de erro lá em cima (LONGO) é menor para quem tem lob bom
  // dificuldade de timing: com menos estrelas, faixas do chutado e do alto maiores e a do lob longo (ruim) menor
  else if (kind === 'lob') { M.fill = .45; M.center = -1; M.half = 0; M.lmax = 1 + lerp(.25, .1, Math.min(1, attrK(p, 'lob'))) / M.tk; M.altoLo = clamp(.75 - (M.tk - 1) * .4, .55, .86); p.charging = true; }
  else { M.fill = .9; M.center = (p.tossDur || TOSS_T) / .9; M.half = half * ({ defesa: 1.5, lob: 1.3, curta: 1.2, smash: 1 }[type] || 1); }
  // faixa verde: menor com atributo baixo e, no smash, longe da rede
  if (kind === 'smash') M.half *= smashZoneScale() * clamp(Math.pow(attrN(p.char.a.smash), 1.5), .12, 1.1) * (1 - .5 * clamp((Math.abs(p.pos.z) - 3.5) / 3.5, 0, 1)); // do fundo a faixa encolhe bem
  if (kind === 'serve') M.half *= clamp(Math.pow(attrN(p.char.a.saque), 1.5), .12, 1.15) * (type === 'smash' ? .6 : 1); // saque por cima: perfeito bem mais difícil (e mais forte)
  // tolerância em volta do verde (amarelo/laranja): com atributo baixo fica estreita, errar por pouco já custa caro
  M.pw = .2 * lerp(.45, 1.1, Math.pow(attrN(kind === 'smash' ? p.char.a.smash : p.char.a.saque), 1.5));
  { const exp = clamp((overall(p.char.a) - 60) / 35, 0, 1); M.half *= (S.pressure ? lerp(.78, .97, exp) : 1) * (1 + (S.streak && S.streak.team === p.team ? Math.min(1, (S.streak.n - 1) / 3) : 0) * .12); }
  if (c.remote) c.out.push(['ms', M.kind, M.type, M.center, M.half, M.pw, M.lmax, M.tk, M.altoLo]); else meterDom(M);
}
// desenha a barra recém-armada (local, ou do convidado com os dados vindos do anfitrião)
function meterDom(M) {
  const kind = M.kind;
  el.meter.className = kind === 'lob' ? 'lobm' : ''; el.meter.hidden = false; el.mRes.textContent = '';
  // barra invisível (opção): continua valendo igual, só não aparece — você se guia pela altura da bola
  el.meter.style.visibility = (kind === 'smash' && S.settings.barSmash === 'off') || (kind === 'lob' && S.settings.barLob === 'off') ? 'hidden' : '';
  el.mLbl.textContent = kind === 'smash' ? 'SMASH' : kind === 'lob' ? 'LOB' : 'SAQUE';
  if (kind === 'lob') {
    const LM = M.lmax || LOB_MAX;
    el.mZone.style.bottom = (100 / LM) + '%'; el.mZone.style.height = (100 - 100 / LM) + '%'; el.mZone.style.background = '';
    const az = el.meter.querySelector('.az'); if (az) { const lo = M.altoLo || .75; az.style.bottom = (lo / LM * 100) + '%'; az.style.height = ((1 - lo) / LM * 100) + '%'; }
    const kz = el.meter.querySelector('.kz'); if (kz) { const kc = (KICK[0] + KICK[1]) / 2, kh = (KICK[1] - KICK[0]) / 2 * (M.tk || 1); kz.style.bottom = ((kc - kh) / LM * 100) + '%'; kz.style.height = (kh * 2 / LM * 100) + '%'; }
  }
  else {
    // faixa inteira em degradê: verde no ponto certo, amarelo e laranja perto, vermelho longe (a penalidade cresce junto)
    const c = M.center, h = M.half, w = M.pw || .2, P = v => (clamp(v, -.2, 1.2) * 100).toFixed(1) + '%';
    el.mZone.style.bottom = '0'; el.mZone.style.height = '100%';
    el.mZone.style.background = 'linear-gradient(0deg, #e5484d 0%, #e5484d ' + P(c - h - w) + ', #ff8a1f ' + P(c - h - w / 2) + ', #ffd23f ' + P(c - h - w * .175) + ', #4fd18b ' + P(c - h) + ', #4fd18b ' + P(c + h) + ', #ffd23f ' + P(c + h + w * .175) + ', #ff8a1f ' + P(c + h + w / 2) + ', #e5484d ' + P(c + h + w) + ', #e5484d 100%)';
  }
  el.mFill.style.height = '0%';
}
// resultado da barra (palavra e cor); no remoto vai para o convidado
function meterResult(c, cls, word, fillPct) {
  if (c.remote) { c.out.push(['mr', cls, word, fillPct]); return; }
  el.meter.className = cls; el.mRes.textContent = word; el.mFill.style.height = fillPct + '%';
}
const _ts = new V3();
function timeToSmash(p) {
  if (ball.state !== 'live' || S.lastTeam === p.team) return null;
  p.model.armR.sh.getWorldPosition(_ts); _ts.y += Math.max(0, .25 - p.model.group.position.y);
  const pos = ball.pos.clone(), vel = ball.vel.clone(); const dt = .01;
  for (let t = 0; t < 2.5; t += dt) {
    const side = p.team === 0 ? pos.z > .05 : pos.z < -.05;
    if (side && pos.y >= 1.75 && pos.distanceTo(_ts) <= .95 * hScale(p)) return t;
    if (side && pos.y < 1.75 && pos.y >= .12 && Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z) <= 1.2) return t;
    vel.y -= bG() * dt; pos.addScaledVector(vel, dt);
    if (pos.y < C.ballR) return null;
  }
  return null;
}
// segundos até a bola entrar no alcance do jogador (null se não entra)
function timeToReach(p) {
  if (ball.state !== 'live' || S.lastTeam === p.team) return null;
  const pos = ball.pos.clone(), vel = ball.vel.clone(); const dt = .01;
  for (let t = 0; t < 2.5; t += dt) {
    const f0 = p.team === 0 ? 1 : -1;
    if ((p.team === 0 ? pos.z > .05 : pos.z < -.05) && pos.y >= 1.75 && Math.hypot(pos.x - (p.pos.x + .2 * f0), pos.y - 1.75, pos.z - p.pos.z) <= 1.0) return t;
    if ((p.team === 0 ? pos.z > .05 : pos.z < -.05) && pos.y < 1.75 && pos.y >= .12 && Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z) <= 1.2) return t;
    vel.y -= bG() * dt; pos.addScaledVector(vel, dt);
    if (pos.y < C.ballR) return null;
  }
  return null;
}
// mergulho: bola baixa que vai cair um pouco além do alcance → o jogador se joga nela
function tryDive(type, p = human) {
  if (ball.state !== 'live' || S.lastTeam === p.team || canHit(p, type)) return;
  // se a bola vai passar ao alcance normal em algum momento, não precisa mergulhar
  { const q = ball.pos.clone(), w = ball.vel.clone();
    for (let t = 0; t < 1.2; t += .01) { w.y -= bG() * .01; q.addScaledVector(w, .01); if (q.y < C.ballR) break;
      if ((p.team === 0 ? q.z > .05 : q.z < -.05) && q.y >= .12 && q.y <= 2.4 && Math.hypot(q.x - p.pos.x, q.z - p.pos.z) <= 1.3) return; } }
  const pos = ball.pos.clone(), vel = ball.vel.clone(), dt = .01;
  for (let t = 0; t < .7; t += dt) {
    vel.y -= bG() * dt; pos.addScaledVector(vel, dt);
    if (pos.y < C.ballR) break;
    if ((p.team === 0 ? pos.z > .05 : pos.z < -.05) && pos.y < 1.1) {
      const dx = pos.x - p.pos.x, dz = pos.z - p.pos.z, d = Math.hypot(dx, dz), r = 1.35;
      if (d > r * .95 && d < r + 1.25 && t > .12) { S.hadDive = true; p.dive = { t: 0, dur: .9, dx: dx / d, dz: dz / d, spd: Math.min(7, (d - r * .7) / .28) }; return; }
    }
  }
}
// altura em que a bola vai chegar ao jogador (quando ela entrar a ~1 m dele)
function contactY(p) {
  if (ball.state !== 'live') return ball.pos.y;
  const pos = ball.pos.clone(), vel = ball.vel.clone(), dt = .01;
  for (let t = 0; t < 2.5; t += dt) {
    if ((p.team === 0 ? pos.z > .05 : pos.z < -.05) && Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z) <= 1.0) return pos.y;
    vel.y -= bG() * dt; pos.addScaledVector(vel, dt);
    if (pos.y < C.ballR) return 0;
  }
  return ball.pos.y;
}
function cancelMeter(c = localCtl()) {
  c.m.active = false; c.p.charging = false;
  if (c.remote) c.out.push(['mh']); else el.meter.hidden = true;
}
function releaseMeter(c = localCtl()) {
  const M = c.m, p = c.p;
  if (!M.active) return;
  // online: a barra do smash depende da bola, que o convidado vê atrasada; desconta esse atraso.
  // (lob e saque só dependem do tempo: o convidado desenha a barra pelo relógio dele e o tempo entre apertar e soltar chega igual)
  if (c.remote && c.lag > 0 && M.kind === 'smash') M.v = Math.max(0, M.v - M.rate * c.lag);
  const v = M.v, diff = v - M.center;
  if (M.kind === 'lob') {
    const LM = M.lmax || LOB_MAX, lv = Math.min(v, LM);
    // começo da barra: lob chutado (perfeito só na faixa verde de baixo); meio: médio; fim: alto; passou: longo
    const kc = (KICK[0] + KICK[1]) / 2, kh = (KICK[1] - KICK[0]) / 2 * (M.tk || 1), kick = lv >= kc - kh && lv <= kc + kh; // lob chutado: faixa pela dificuldade de timing
    const aLo = M.altoLo || .75, kHi = kc + kh;
    const word = kick ? 'CHUTADO PERFEITO' : lv < kc - kh ? 'CHUTADO FRACO' : lv < aLo ? 'MÉDIO' : lv <= 1 ? 'ALTO' : 'LONGO';
    // força do lob: a faixa do alto (maior com menos estrelas) sempre vira um lob alto de verdade
    const power = kick || lv > 1 || lv <= kHi ? lv : lv >= aLo ? .75 + (lv - aLo) / Math.max(.01, 1 - aLo) * .25 : kHi + (lv - kHi) / Math.max(.01, aLo - kHi) * (.75 - kHi);
    M.active = false; M.showT = .9;
    meterResult(c, 'lobm ' + (kick ? 'perfeito' : lv < kc - kh ? 'cedo' : lv <= 1 ? (lv >= aLo ? 'perfeito' : '') : 'tarde'), word, lv / LM * 100);
    p.charging = false;
    const sw = p.swing; sw.dur = SWING_DUR; sw.t = sw.dur * .3; sw.type = 'lob'; sw.hit = false; sw.meter = null; sw.lob = { power, word, kick }; sw.side = sideOf(p); sw.var = '';
    return;
  }
  let res = Math.abs(diff) <= M.half ? 'perfeito' : diff < 0 ? 'cedo' : 'tarde';
  // amt: 0 na borda do verde (amarelo) até 1 no começo do vermelho; a penalidade segue as cores da faixa
  const amt = clamp((Math.abs(diff) - M.half) / (M.pw || .2), 0, 1);
  // smash pouco carregado numa bola a meia altura é um voleio (golpe curto e rápido), não um smash ruim
  if (M.kind === 'smash' && res === 'cedo' && contactY(p) < 2.05) res = 'voleio';
  const word = res === 'perfeito' || res === 'voleio' ? RES_WORD[res] : (amt < .2 ? 'UM POUCO ' : amt > .85 ? 'MUITO ' : '') + RES_WORD[res];
  M.active = false; M.showT = .9;
  meterResult(c, res + (res !== 'perfeito' && amt < .2 ? ' quase' : ''), word, clamp(v, 0, 1) * 100);
  if (M.kind === 'smash') {
    p.charging = false;
    const sw = p.swing; sw.dur = SWING_DUR; sw.t = sw.dur * .3; sw.type = 'smash'; sw.hit = false; sw.meter = { res, amt, word, ideal: M.ideal }; sw.hold = 0; sw.var = swingVar('smash', ball.pos.y, p);
    if (res !== 'voleio' && ball.state === 'live' && ball.pos.y > 1.6) startJump(p, .42, .3);
  } else serveRelease(res, amt, word, p);
}
function serveRelease(res, amt, word, human) {
  if (S.mode !== 'toss' || S.serverPlayer !== human) return;
  const type = S.serveType; let q, mod;
  const svN = Math.min(1, attrN(human.char.a.saque)); // atributo de saque
  // perfeito: bem mais força e precisão (no saque por cima a faixa é menor)
  if (res === 'perfeito') { q = lerp(.88, 1, svN); mod = { speedMul: type === 'smash' ? lerp(1.02, 1.2, svN) : 1, noiseMul: lerp(.85, .55, svN), oppMissBoost: (type === 'smash' ? .1 : .03) * svN, misBoost: type === 'smash' ? lerp(.06, .035, svN) : .02, perfect: true }; } // perfeito por cima ainda erra de vez em quando (~1 em 17–28)
  // fora do perfeito o saque perde bastante: cedo sai fraco, tarde sai impreciso e erra mais
  else if (res === 'cedo') { q = lerp(.8, .45, amt); mod = { speedMul: amt < .6 ? lerp(.97, .9, amt / .6) : lerp(.9, .62, (amt - .6) / .4), noiseMul: lerp(1.1, 1.4, amt), misBoost: amt * .1 }; } // só o muito cedo sai fraco e alto
  else { q = lerp(.72, .32, amt); mod = { speedMul: amt < .6 ? lerp(.97, .9, amt / .6) : lerp(.9, .8, (amt - .6) / .4), noiseMul: lerp(1.25, 1.8, amt), misBoost: lerp(.06, .5, amt) * (type === 'smash' ? 1 : .5) }; }
  // a batida acontece quando a raquete chega na bola (meio do movimento)
  human.pendingServe = { type, q, mod, res, word };
  const sw = human.swing; sw.t = sw.dur * .3; sw.type = 'smash'; sw.hit = false; sw.meter = null;
}
function pressShot(type, c) {
  if (!c) {
    ac();
    const b = shotBtns[type]; if (b) b.classList.add('press');
    if (NET.role === 'guest') { if (NET.shot) NET.shot(type, true); return; } // convidado: o anfitrião é quem bate
    if (S.paused || S.spectate) return;
    c = localCtl();
  }
  const M = c.m, p = c.p, plan = c.plan;
  if (M.active && M.kind === 'serve' && M.armedTap) { releaseMeter(c); return; }
  if (S.mode === 'serve' && S.serverPlayer === p) { startToss(p, type, c.tossF); startMeter('serve', type, c); return; }
  if (S.mode === 'rally' || S.mode === 'toss') {
    if (M.active && (M.kind === 'smash' || M.kind === 'lob')) cancelMeter(c);
    const sw = p.swing;
    if (sw.t >= 0 && sw.t < sw.dur * .8) return;
    // lob numa bola baixa (uma curta, bola no pé ou longe): sai direto, sem barra, e pode dar o pulo/abaixada como a curta e a defesa
    const lowLob = type === 'lob' && S.mode === 'rally' && ball.state === 'live' && S.lastTeam !== p.team && contactY(p) < .9;
    if ((type === 'smash' || type === 'lob') && S.mode === 'rally' && !lowLob) { sw.t = -1; sw.lob = null; startMeter(type, type, c); return; }
    if ((type === 'curta' || type === 'defesa' || lowLob) && S.mode === 'rally' && !p.dive) tryDive(type, p);
    sw.t = 0; sw.type = type; sw.dur = type === 'curta' ? .5 : SWING_DUR; sw.hit = false; sw.meter = null; sw.lob = null;
    if (lowLob) sw.lob = { power: .85, word: 'LOB DE RECUPERAÇÃO', kick: false };
    sw.pressT = S.mode === 'rally' && ball.state === 'live' && S.lastTeam !== p.team ? timeToReach(p) : null; // para o timing: quanto faltava a bola chegar
    if (sw.pressT !== null && c.remote) sw.pressT += c.lag; // o convidado apertou vendo a bola um pouco atrasada
    sw.side = sideOf(p, plan.id === S.hitId && plan.plan ? plan.plan.pt : null);
    sw.var = swingVar(type, plan.id === S.hitId && plan.plan ? plan.plan.pt.y : ball.pos.y, p);
  }
}
function releaseShot(type, c) {
  if (!c) {
    const b = shotBtns[type]; if (b) b.classList.remove('press');
    if (NET.role === 'guest') { if (NET.shot) NET.shot(type, false); return; }
    if (S.spectate) return;
    c = localCtl();
  }
  const M = c.m;
  if (!M.active) return;
  if (M.kind === 'serve') { if (M.t < .15) { M.armedTap = true; return; } releaseMeter(c); }
  else if (type === M.type) releaseMeter(c);
}
// barra de força andando a cada passo da simulação (de cada jogador humano)
function meterStep(c, dt) {
  const M = c.m;
  if (M.active) {
    M.t += dt;
    if (M.kind === 'smash') {
      // a barra chega no verde quando a bola chega no ponto de smash; bola alta = barra lenta
      let tr = timeToSmash(c.p);
      if (tr === null && M.tr != null && M.tr > dt) tr = M.tr - dt; // alcance some por um instante (correndo): mantém a estimativa
      M.tr = tr;
      if (tr !== null) { M.seen = true; if (M.v < M.center) M.rate = clamp((M.center - M.v) / Math.max(tr - .03, .04), .06, 1 / .25); }
      else if (M.seen) M.rate = Math.max(M.rate, 1);
      else M.rate = Math.max(0, M.center * .55 - M.v) * 1.4; // bola ainda fora de alcance: a barra sobe devagar e espera (se a bola já passou, segue até estourar)
      M.v += M.rate * dt;
    } else M.v = M.t / M.fill;
    const v = M.v;
    if ((M.kind === 'smash' || M.kind === 'lob') && S.mode !== 'rally') cancelMeter(c);
    else if (M.kind === 'smash' && v >= 1.15) releaseMeter(c);
    else if (M.kind === 'lob' && v >= (M.lmax || LOB_MAX)) releaseMeter(c);
    else if (M.kind === 'serve' && S.mode !== 'toss') cancelMeter(c);
    else if (M.kind === 'serve' && ball.vel.y < 0 && ball.pos.y < 1.75) releaseMeter(c);
  } else if (!c.remote && M.showT > 0) { M.showT -= dt; if (M.showT <= 0) el.meter.hidden = true; }
}
const SHOT_KEYS = { j: 'smash', '1': 'smash', k: 'lob', '2': 'lob', l: 'curta', '3': 'curta', ' ': 'defesa', '4': 'defesa' };
// teclas configuráveis: cada ação tem a sua tecla padrão; a tecla escolhida é traduzida para a padrão antes de tudo,
// então o resto do jogo continua lendo w/a/s/d, j/k/l, espaço etc. Setas, 1–4 e Esc valem sempre.
const BIND_ACTIONS = [['up', 'Mover para frente / mira funda', 'w'], ['down', 'Mover para trás / mira curta', 's'], ['left', 'Mover para a esquerda', 'a'], ['right', 'Mover para a direita', 'd'],
  ['smash', 'Smash', 'j'], ['lob', 'Lob', 'k'], ['curta', 'Curta', 'l'], ['defesa', 'Defesa', ' '], ['cam', 'Trocar câmera', 'c'], ['pause', 'Pausa', 'p'], ['sound', 'Som', 'm'], ['aim', 'Flecha de mira', 'v']];
const FIXED_KEYS = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', '1', '2', '3', '4', 'escape', 'enter', 'tab']);
function bindKey(k) {
  const b = S.settings.binds; if (!b || FIXED_KEYS.has(k)) return k;
  for (const [id, , def] of BIND_ACTIONS) if (b[id] && b[id] === k) return def; // tecla escolhida → a padrão da ação
  for (const [id, , def] of BIND_ACTIONS) if (def === k && b[id] && b[id] !== def) return '§' + k; // a padrão foi trocada: não vale mais
  return k;
}
const keyName = k => k === ' ' ? 'Espaço' : k.length === 1 ? k.toUpperCase() : k.replace(/^arrow/, 'seta ').replace(/^./, c => c.toUpperCase());
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT' && (e.target.type === 'text' || e.target.type === 'number')) return;
  if (BINDCAP.on) return;
  const k = bindKey(e.key.toLowerCase());
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  // alguns teclados/programas mandam a repetição automática como aperto novo (sem e.repeat): tecla já segurada não conta de novo
  const held = keys[k];
  keys[k] = true;
  if (e.repeat || held) return;
  if (!el.menu.hidden || !el.over.hidden) { if (k === 'enter' && !el.menu.hidden && el.menu.dataset.step === 'q3' && !(document.activeElement && document.activeElement.tagName === 'BUTTON')) startFromMenu(); return; }
  if (SHOT_KEYS[k]) pressShot(SHOT_KEYS[k]);
  else if (k === 'c') toggleCam();
  else if (k === 'p' || k === 'escape') togglePause();
  else if (k === 'm') toggleSound();
  else if (k === '[' || k === ']') adjustCamHeight(k === '[' ? -10 : 10);
  else if (k === '-' || k === '=' || k === '+') { if (S.settings.cam === '1p') adjustFov(k === '-' ? -5 : 5); else adjustCamDist(k === '-' ? -10 : 10); }
  else if (k === 'b') toggleAssist('assistMove');
  else if (k === 'n') toggleAssist('assistMark');
  else if (k === 'v') { S.settings.aimArrow = S.settings.aimArrow === false; saveSettings(); feedback('MIRA', S.settings.aimArrow ? 'LIGADA' : 'DESLIGADA', null); }
});
addEventListener('keyup', e => { const k = bindKey(e.key.toLowerCase()); keys[k] = false; if (SHOT_KEYS[k]) releaseShot(SHOT_KEYS[k]); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (inPlay() && !NET.role) setPaused(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && inPlay() && !NET.role) setPaused(true); });
const inPlay = () => ['serve', 'toss', 'rally', 'dead'].includes(S.mode);
// ---------- controle de Xbox / PS4 (Gamepad API, mapeamento padrão) ----------
// jogo: analógico/direcional movem; A/✕ defesa, B/○ curta, X/□ lob, Y/△ smash (RT/R2 smash, LT/L2 lob);
// Start/Options pausa, Back/Share câmera, RB/R1 flecha de mira. Menus: direcional/analógico escolhem, A/✕ confirma, B/○ volta
const PADB = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, back: 8, start: 9, up: 12, down: 13, left: 14, right: 15 };
// ações do controle e o botão padrão de cada uma (trocáveis em Teclas/Controle: S.settings.padBinds)
const PAD_ACTIONS = [['defesa', 'Defesa', PADB.a], ['curta', 'Curta', PADB.b], ['lob', 'Lob', PADB.x], ['smash', 'Smash', PADB.y], ['smash2', 'Smash (2º botão)', PADB.rt], ['lob2', 'Lob (2º botão)', PADB.lt],
  ['pause', 'Pausa', PADB.start], ['cam', 'Trocar câmera', PADB.back], ['aim', 'Flecha de mira', PADB.rb]];
const PAD_NAMES = { 0: 'A / ✕', 1: 'B / ○', 2: 'X / □', 3: 'Y / △', 4: 'LB / L1', 5: 'RB / R1', 6: 'LT / L2', 7: 'RT / R2', 8: 'Back / Share', 9: 'Start / Options', 10: 'L3', 11: 'R3', 12: '↑', 13: '↓', 14: '←', 15: '→', 16: 'Xbox / PS' };
const padBtn = id => { const b = S.settings.padBinds || {}, a = PAD_ACTIONS.find(x => x[0] === id); return b[id] !== undefined ? +b[id] : a ? a[2] : -1; };
const PADCAP = { on: null };
const padPrev = {}; let padOn = false, padNavT = 0, padName = '';
const padDown = (gp, i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > .5));
function padFirst() { const l = navigator.getGamepads ? navigator.getGamepads() : []; for (const g of l) if (g && g.connected) return g; return null; }
function topOverlay() { const l = [...document.querySelectorAll('.overlay')].filter(o => !o.hidden && getComputedStyle(o).display !== 'none'); return l.length ? l[l.length - 1] : null; }
function padFocusables(root) { return [...root.querySelectorAll('button, select, input, label.cr-file, [data-goto]')].filter(e => !e.disabled && e.offsetParent !== null && !(e.tagName === 'INPUT' && e.type === 'file')); }
// navegação espacial: o mais próximo na direção apertada
function padMove(dx, dy) {
  const root = topOverlay(); if (!root) return; const list = padFocusables(root); if (!list.length) return;
  const cur = list.includes(document.activeElement) ? document.activeElement : null;
  if (!cur) { list[0].focus(); list[0].classList.add('pad-focus'); return; }
  const r0 = cur.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
  let best = null, bs = Infinity;
  for (const e of list) { if (e === cur) continue; const r = e.getBoundingClientRect(), ex = r.left + r.width / 2 - cx, ey = r.top + r.height / 2 - cy;
    const along = ex * dx + ey * dy, side = Math.abs(ex * dy - ey * dx); if (along <= 4) continue;
    const sc = along + side * 2.2; if (sc < bs) { bs = sc; best = e; } }
  if (best) { cur.classList.remove('pad-focus'); best.focus(); best.classList.add('pad-focus'); best.scrollIntoView({ block: 'nearest' }); }
}
function padConfirm() {
  const e = document.activeElement; if (!e || e === document.body) { padMove(0, 1); return; }
  if (e.tagName === 'SELECT') { e.selectedIndex = (e.selectedIndex + 1) % e.options.length; e.dispatchEvent(new Event('change', { bubbles: true })); }
  else e.click();
}
function padBack() {
  if (!el.pause.hidden) { setPaused(false); return; }
  const root = topOverlay(); if (!root) return;
  const b = [...root.querySelectorAll('button')].filter(x => x.offsetParent !== null && !x.disabled).find(x => /^(voltar|fechar|continuar|menu|sair)/i.test(x.textContent.trim()));
  if (b) b.click();
}
function padLoop() { try { padStep(); } catch (e) { console.warn('controle', e); } requestAnimationFrame(padLoop); }
function padStep() {
  const gp = padFirst();
  if (!gp) { PAD.x = PAD.z = 0; padOn = false; return; }
  if (!padOn) { padOn = true; padName = /dualshock|playstation|054c|wireless controller/i.test(gp.id) ? 'PlayStation' : /xbox|xinput|045e/i.test(gp.id) ? 'Xbox' : 'controle'; feedback('CONTROLE', padName.toUpperCase() + ' CONECTADO', null); }
  // trocando um botão (tela de teclas): o próximo botão apertado vira o dessa ação
  if (PADCAP.on) { for (let i = 0; i < gp.buttons.length; i++) { const d = padDown(gp, i); if (d && !padPrev[i]) { const id = PADCAP.on, old = padBtn(id), nb = Object.assign({}, S.settings.padBinds, { [id]: i }); const other = PAD_ACTIONS.find(x => x[0] !== id && padBtn(x[0]) === i); if (other) nb[other[0]] = old; S.settings.padBinds = nb; PADCAP.on = null; // botão já usado: as duas ações trocam saveSettings(); padPrev[i] = true; renderBinds(); return; } padPrev[i] = d; } return; }
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, dz = .22;
  let x = Math.abs(ax) > dz ? (ax - Math.sign(ax) * dz) / (1 - dz) : 0, z = Math.abs(ay) > dz ? (ay - Math.sign(ay) * dz) / (1 - dz) : 0;
  if (padDown(gp, PADB.left)) x = -1; if (padDown(gp, PADB.right)) x = 1; if (padDown(gp, PADB.up)) z = -1; if (padDown(gp, PADB.down)) z = 1;
  const playing = inPlay() && el.pause.hidden && S.mode !== 'replay';
  const edge = i => { const d = padDown(gp, i), was = !!padPrev[i]; padPrev[i] = d; return d && !was ? 1 : !d && was ? -1 : 0; };
  if (playing) {
    PAD.x = x; PAD.z = z;
    for (const id of ['defesa', 'curta', 'lob', 'smash', 'smash2', 'lob2']) { const e = edge(padBtn(id)), t = id.replace('2', ''); if (e === 1) pressShot(t); else if (e === -1) releaseShot(t); }
    if (edge(padBtn('pause')) === 1) togglePause();
    if (edge(padBtn('cam')) === 1) toggleCam();
    if (edge(padBtn('aim')) === 1) { S.settings.aimArrow = S.settings.aimArrow === false; saveSettings(); feedback('MIRA', S.settings.aimArrow ? 'LIGADA' : 'DESLIGADA', null); }
    for (let i = 0; i < 17; i++) edge(i); // atualiza o resto (sem ação)
  } else {
    PAD.x = PAD.z = 0;
    ['defesa', 'curta', 'lob', 'smash', 'smash2', 'lob2'].forEach(id => { const i = padBtn(id); if (padPrev[i] && !padDown(gp, i) && MTR.active) releaseShot(id.replace('2', '')); });
    const now = performance.now(), dir = Math.abs(x) > .5 || Math.abs(z) > .5;
    if (dir && now > padNavT) { if (Math.abs(x) > Math.abs(z)) padMove(Math.sign(x), 0); else padMove(0, Math.sign(z)); padNavT = now + 190; }
    if (!dir) padNavT = 0;
    if (edge(PADB.a) === 1) padConfirm();
    if (edge(PADB.b) === 1) padBack();
    if (edge(PADB.start) === 1) { if (inPlay()) togglePause(); else padConfirm(); }
    [PADB.x, PADB.y, PADB.lb, PADB.rb, PADB.lt, PADB.rt, PADB.back, PADB.up, PADB.down, PADB.left, PADB.right].forEach(edge);
  }
}
if (typeof window !== 'undefined' && navigator.getGamepads) { requestAnimationFrame(padLoop); window.__padStep = () => padStep(); }

// modelos de quadra (partida rápida/online) e de bolinha (todos os modos)
function fillLooks() {
  const opt = (obj, cur) => Object.entries(obj).map(([k, v]) => '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + v.nome + '</option>').join('');
  renderCourtPickers();
  renderBallPickers();
}
// bolinhas desenhadas para escolher (configurações, partida rápida e online)
const BALL_PREV = {};
function ballPreview(k) {
  if (BALL_PREV[k]) return BALL_PREV[k];
  const tex = document.createElement('canvas'); tex.width = 128; tex.height = 64; drawBall(tex.getContext('2d'), 128, 64, BALL_STYLES[k]);
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.save(); x.beginPath(); x.arc(32, 32, 28, 0, Math.PI * 2); x.clip(); x.drawImage(tex, 0, 0, 128, 64, -32, 4, 128, 56);
  const sh = x.createRadialGradient(22, 20, 4, 32, 32, 30); sh.addColorStop(0, 'rgba(255,255,255,.45)'); sh.addColorStop(.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.35)');
  x.fillStyle = sh; x.fillRect(0, 0, 64, 64); x.restore();
  return (BALL_PREV[k] = c.toDataURL());
}
// aparência da barra de força (tamanho e opacidade), escolhida nas configurações
function applyMeterLook() {
  const st = document.documentElement.style;
  st.setProperty('--msc', String({ pequena: .72, normal: 1, grande: 1.25 }[S.settings.meterSize || 'normal'] || 1));
  st.setProperty('--mop', String((+(S.settings.meterOp || 100)) / 100));
  // nomes sobre os jogadores: tamanho/estilo e opacidade
  st.setProperty('--tagop', String((+(S.settings.tagOp || 100)) / 100)); document.body.dataset.tags = S.settings.tagStyle || 'normal'; { const bt = document.getElementById('btnTags'); if (bt) bt.textContent = 'Nomes: ' + ({ normal: 'normal', pequena: 'pequenos', simples: 'simples', off: 'escondidos' }[S.settings.tagStyle || 'normal']); }
  document.querySelectorAll('select[data-setting]').forEach(e => { e.value = String(S.settings[e.dataset.setting] ?? ({ meterOp: '100', barSmash: 'on', barLob: 'on', landArrow: 'on', lineWarn: 'on', tagStyle: 'normal', tagOp: '100', playerDiff: '3' }[e.dataset.setting] || 'normal')); });
}
document.querySelectorAll('select[data-setting]').forEach(e => e.addEventListener('change', () => { S.settings[e.dataset.setting] = e.value; saveSettings(); applyMeterLook(); if (e.dataset.setting === 'playerDiff' && S.onPd) S.onPd(e.value); }));
applyMeterLook();
function renderBallPickers() {
  const cur = S.settings.ballStyle || 'laranja';
  document.querySelectorAll('[data-ballpick]').forEach(box => {
    box.innerHTML = Object.entries(BALL_STYLES).map(([k, v]) => '<button type="button" class="bp' + (k === cur ? ' sel' : '') + '" data-ball="' + k + '" title="' + v.nome + '"><img alt="" src="' + ballPreview(k) + '"><small>' + v.nome.replace(' (padrão)', '').replace(' (costura azul)', '') + '</small></button>').join('');
    box.querySelectorAll('[data-ball]').forEach(b => b.addEventListener('click', () => { S.settings.ballStyle = b.dataset.ball; saveSettings(); setBallStyle(b.dataset.ball); renderBallPickers(); }));
  });
}
// miniaturas das quadras vistas de cima (partida rápida e sala online)
const COURT_PREV = {};
function courtPreview(k) {
  if (COURT_PREV[k]) return COURT_PREV[k];
  const a = COURTS[k].a, c = document.createElement('canvas'); c.width = 120; c.height = 80; const x = c.getContext('2d');
  x.fillStyle = a.size ? (a.sand || '#f3e7cf') : '#ead8b4'; x.fillRect(0, 0, 120, 80);
  if (!a.size) { x.fillStyle = '#5fb3d9'; x.fillRect(0, 0, 120, 10); }
  const seat = a.seat || '#2457c5', ppl = n => { for (let i = 0; i < n; i++) { x.fillStyle = ['#ff5a1f', '#fbf6ea', '#17324d', '#ffd23f', '#e2364a'][i % 5]; x.fillRect(Math.random() * 120, Math.random() * 80, 2, 2); } };
  if (a.size >= 1) { x.fillStyle = seat; x.fillRect(4, 14, 16, 56); }
  if (a.size >= 2) { x.fillRect(100, 14, 16, 56); x.fillStyle = (a.board || ['#111'])[0]; x.fillRect(22, 14, 3, 56); x.fillRect(95, 14, 3, 56); }
  if (a.size >= 3) { x.fillStyle = seat; x.fillRect(24, 2, 72, 9); }
  if (a.amateur) { x.strokeStyle = '#1f4fb8'; x.lineWidth = 1; x.strokeRect(2, 22, 14, 46); x.strokeRect(104, 22, 14, 46); for (let i = 0; i < 26; i++) { x.fillStyle = ['#ff5a1f', '#fbf6ea', '#17324d', '#ffd23f'][i % 4]; x.fillRect(i % 2 ? 22 + Math.random() * 6 : 92 + Math.random() * 6, 22 + Math.random() * 40, 2, 2); } }
  x.strokeStyle = a.line || '#1f4fb8'; x.lineWidth = 2; x.strokeRect(36, 18, 48, 54); x.beginPath(); x.moveTo(36, 45); x.lineTo(84, 45); x.strokeStyle = a.trim || '#ffffff'; x.lineWidth = 2.5; x.stroke();
  return (COURT_PREV[k] = c.toDataURL());
}
function renderCourtPickers(onlineCur, canPick) {
  document.querySelectorAll('[data-courtpick]').forEach(box => {
    const online = box.dataset.courtpick === 'online', cur = online ? (onlineCur || S.settings.court || 'praia') : S.settings.court || 'praia', can = online ? canPick !== false : true;
    box.innerHTML = Object.entries(COURTS).map(([k, v]) => '<button type="button" class="cp' + (k === cur ? ' sel' : '') + '" data-court="' + k + '"' + (can ? '' : ' disabled') + '><img alt="" src="' + courtPreview(k) + '"><small>' + v.nome.replace(' (padrão)', '').replace(' (público e quadras ao lado)', '') + '</small></button>').join('');
    box.querySelectorAll('[data-court]').forEach(b => b.addEventListener('click', () => { S.settings.court = b.dataset.court; saveSettings(); renderCourtPickers(onlineCur && b.dataset.court, canPick); if (online && NET.onCourt) NET.onCourt(); }));
  });
}
// tela de teclas: clicar numa ação e apertar a nova tecla (se já for de outra ação, as duas trocam)
const BINDCAP = { on: null };
function renderBinds() {
  const boxes = document.querySelectorAll('.bind-list'); if (!boxes.length) return;
  const b = S.settings.binds || {};
  const row = ([id, nm, def]) => '<div class="bind-row"><span>' + nm + '</span><button type="button" class="kcap' + (BINDCAP.on === id ? ' wait' : '') + ((b[id] && b[id] !== def) ? ' changed' : '') + '" data-bind="' + id + '">' + (BINDCAP.on === id ? 'aperte uma tecla…' : keyName(b[id] || def)) + '</button></div>';
  const grp = (t, ids) => '<div class="bind-grp"><p class="section-label">' + t + '</p>' + BIND_ACTIONS.filter(a => ids.includes(a[0])).map(row).join('') + '</div>';
  boxes.forEach(box => {
    box.innerHTML = grp('Movimento e mira', ['up', 'down', 'left', 'right']) + grp('Golpes', ['smash', 'lob', 'curta', 'defesa']) + grp('Outros', ['cam', 'pause', 'sound', 'aim']);
    box.querySelectorAll('[data-bind]').forEach(x => x.addEventListener('click', () => { BINDCAP.on = x.dataset.bind; renderBinds(); }));
    // controle (Xbox/PS): clique e aperte o botão no controle
    const pb = S.settings.padBinds || {};
    box.insertAdjacentHTML('beforeend', '<div class="bind-grp"><p class="section-label">🎮 Controle (Xbox / PS)</p>' + PAD_ACTIONS.map(([id, nm, def]) => '<div class="bind-row"><span>' + nm + '</span><button type="button" class="kcap' + (PADCAP.on === id ? ' wait' : '') + (pb[id] !== undefined && +pb[id] !== def ? ' changed' : '') + '" data-padbind="' + id + '">' + (PADCAP.on === id ? 'aperte no controle…' : PAD_NAMES[padBtn(id)] || 'botão ' + padBtn(id)) + '</button></div>').join('') + '<div class="cta-row"><button type="button" class="ghost sm" data-padreset>Botões padrão do controle</button></div></div>');
    box.querySelectorAll('[data-padbind]').forEach(x => x.addEventListener('click', () => { PADCAP.on = PADCAP.on === x.dataset.padbind ? null : x.dataset.padbind; renderBinds(); }));
    box.querySelectorAll('[data-padreset]').forEach(x => x.addEventListener('click', () => { S.settings.padBinds = {}; PADCAP.on = null; saveSettings(); renderBinds(); }));
  });
}
addEventListener('keydown', e => {
  if (!BINDCAP.on) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const k = e.key.toLowerCase(), id = BINDCAP.on; BINDCAP.on = null;
  if (k !== 'escape' && !FIXED_KEYS.has(k)) {
    const b = S.settings.binds = Object.assign({}, S.settings.binds), cur = id2 => b[id2] || BIND_ACTIONS.find(a => a[0] === id2)[2];
    const other = BIND_ACTIONS.find(([id2]) => id2 !== id && cur(id2) === k);
    if (other) b[other[0]] = cur(id);
    b[id] = k; saveSettings();
  }
  renderBinds();
}, true);
{ const rb = document.getElementById('bindReset'); if (rb) rb.addEventListener('click', () => { S.settings.binds = null; BINDCAP.on = null; saveSettings(); renderBinds(); }); }
renderBinds();
Object.entries(shotBtns).forEach(([type, b]) => {
  b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (er) {} pressShot(type); });
  ['pointerup', 'pointercancel'].forEach(ev => b.addEventListener(ev, e => { e.preventDefault(); releaseShot(type); }));
});
function stickMove(e) {
  const r = el.stick.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let dx = e.clientX - cx, dy = e.clientY - cy; const R = r.width / 2 - 10; const d = Math.hypot(dx, dy);
  if (d > R) { dx *= R / d; dy *= R / d; }
  el.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  touch.x = dx / R; touch.z = dy / R;
}
el.stick.addEventListener('pointerdown', e => { e.preventDefault(); touch.id = e.pointerId; el.stick.setPointerCapture(e.pointerId); stickMove(e); });
el.stick.addEventListener('pointermove', e => { if (e.pointerId === touch.id) stickMove(e); });
const stickEnd = e => { if (e.pointerId !== touch.id) return; touch.id = null; touch.x = touch.z = 0; el.knob.style.transform = ''; };
el.stick.addEventListener('pointerup', stickEnd); el.stick.addEventListener('pointercancel', stickEnd);
function enableTouch() { document.body.classList.add('touch'); el.stick.hidden = false; }
if (isMobile) enableTouch();
addEventListener('touchstart', () => { if (!isTouch()) enableTouch(); }, { passive: true, once: true });
function applyCam() {
  const fp = S.settings.cam === '1p';
  el.btnCam.firstChild.textContent = fp ? '1ª pessoa' : '3ª · ' + (CAM3[S.settings.cam3] || CAM3.padrao).nome;
  camera.fov = fp ? (S.settings.fovFp || 72) : (dupla() ? 58 : 55); camera.updateProjectionMatrix();
  const r = $('fovFp'); if (r) { r.value = S.settings.fovFp || 72; $('fovFpV').textContent = r.value + '°'; }
  // os controles de distância/altura existem no menu e na pausa; todos mostram o mesmo valor
  [['camDist', 'camDist'], ['pCamDist', 'camDist'], ['camHeight', 'camHeight'], ['pCamHeight', 'camHeight']].forEach(([id, k]) => { const e = $(id); if (e) { e.value = S.settings[k] || 100; $(id + 'V').textContent = e.value + '%'; } });
}
// C (e o botão) passa por: 3ª padrão → 3ª alta → 3ª perto → 1ª pessoa → ...
const CAM_ORDER = ['padrao', 'alta', 'perto', '1p'];
function toggleCam() {
  const cur = S.settings.cam === '1p' ? '1p' : (CAM3[S.settings.cam3] ? S.settings.cam3 : 'padrao');
  const nx = CAM_ORDER[(CAM_ORDER.indexOf(cur) + 1) % CAM_ORDER.length];
  if (nx === '1p') S.settings.cam = '1p'; else { S.settings.cam = '3p'; S.settings.cam3 = nx; }
  applyCam(); saveSettings(); syncCamMenu();
  feedback('CÂMERA', nx === '1p' ? '1ª PESSOA' : '3ª PESSOA · ' + CAM3[nx].nome.toUpperCase(), null);
}
function adjustCamDist(d) {
  S.settings.camDist = clamp((S.settings.camDist || 100) + d, 60, 170); saveSettings(); applyCam();
  feedback('DISTÂNCIA ' + S.settings.camDist + '%', '3ª PESSOA', null);
}
function adjustCamHeight(d) {
  S.settings.camHeight = clamp((S.settings.camHeight || 100) + d, 40, 250); saveSettings(); applyCam();
  feedback('ALTURA ' + S.settings.camHeight + '%', '3ª PESSOA', null);
}
// sliders de distância e altura (menu e pausa)
[['camDist', 'camDist'], ['pCamDist', 'camDist'], ['camHeight', 'camHeight'], ['pCamHeight', 'camHeight']].forEach(([id, k]) => {
  const e = $(id); if (e) e.addEventListener('input', () => { S.settings[k] = +e.value; saveSettings(); applyCam(); });
});
function syncCamMenu() {
  const a = document.querySelector('input[name=cam][value="' + S.settings.cam + '"]'); if (a) a.checked = true;
  const b = document.querySelector('input[name=cam3][value="' + (S.settings.cam3 || 'padrao') + '"]'); if (b) b.checked = true;
}
function toggleSound() {
  S.muted = !S.muted; el.btnSnd.firstChild.textContent = S.muted ? 'Som desligado' : 'Som ligado';
  if (surf) surf.g.gain.value = 0;
}
// online: a partida não para (o outro jogador continua); a pausa só abre o menu por cima
function setPaused(v) { if (!inPlay() && v) return; if (NET.role) { S.paused = false; el.pause.hidden = !v; if (v) { syncAssistButtons(); $('btnResume').focus(); } return; } S.paused = v; el.pause.hidden = !v; if (v) { syncAssistButtons(); $('btnResume').focus(); } }
function togglePause() { if (!inPlay()) return; setPaused(NET.role ? el.pause.hidden : !S.paused); }
function saveSettings() { if (NET.role) return; // online: as escolhas da sala não sobrescrevem as suas
  // só marca como alterado (e sobe para a conta) quando algo mudou de verdade
  let changed = false;
  try { const js = JSON.stringify(S.settings), old = localStorage.getItem('pdo-settings'); changed = js !== old; if (changed) { localStorage.setItem('pdo-settings', js); if (old !== null) localStorage.setItem('pdo-prefs-at', String(Date.now())); else changed = false; } } catch (e) {} // a 1ª gravação (aparelho novo) não conta como mudança
  if (changed && S.onPrefsSaved) S.onPrefsSaved(); } // conta na nuvem: as configurações sobem junto
function readMenu() {
  const v = n => document.querySelector(`input[name=${n}]:checked`).value;
  S.settings.mode = v('mode'); S.settings.cam = v('cam'); S.settings.cam3 = v('cam3') || 'padrao'; S.settings.diff = v('diff'); S.settings.games = +v('len'); S.settings.gfx = v('gfx'); S.settings.racket = $('rkSel').value || 'proteo'; S.settings.players = v('players'); S.settings.side = v('side') || 'direita'; S.settings.uniforms = v('uniforms') || 'uniforme';
  S.settings.assistMove = $('assistMove').checked; S.settings.assistMark = $('assistMark').checked; S.settings.aimArrow = $('aimArrow').checked; S.settings.shotText = $('shotTextSel').value || 'completo'; S.settings.tactic = $('tacticSel').value || 'normal';
  saveSettings();
}
function syncMenu() {
  const set = (name, v) => { const i = document.querySelector(`input[name=${name}][value="${v}"]`); if (i) i.checked = true; };
  set('mode', S.settings.mode); set('cam', S.settings.cam); set('cam3', S.settings.cam3 || 'padrao'); set('diff', S.settings.diff); set('len', S.settings.games); set('gfx', S.settings.gfx); $('rkSel').value = RACKET_STATS[S.settings.racket] ? S.settings.racket : 'proteo'; rkInfo(); set('players', S.settings.players); set('side', S.settings.side || 'direita'); set('uniforms', S.settings.uniforms || 'uniforme'); set('gender', S.settings.gender);
  $('assistMove').checked = !!S.settings.assistMove; $('assistMark').checked = !!S.settings.assistMark; $('aimArrow').checked = S.settings.aimArrow !== false; $('shotTextSel').value = S.settings.shotText || 'discreto'; fillLooks(); $('tacticSel').value = S.settings.tactic || 'normal';
  renderRoster();
}
const SLOT_LABEL = { me: 'Você', mate: 'Sua dupla', o1: 'Adversário', o2: 'Adversário 2' };
const activeSlots = () => dupla() ? ['me', 'mate', 'o1', 'o2'] : ['me', 'o1'];
// personagens disponíveis no filtro, do maior overall para o menor
function pool() {
  const g = S.settings.gender;
  return ROSTER.filter(c => g === 'mista' || (g === 'fem' ? c.fem : !c.fem)).sort((x, y) => overall(y.a) - overall(x.a));
}
function fixPicks() {
  const pl = pool(), used = new Set();
  activeSlots().forEach(k => {
    const id = S.settings.pick[k];
    if (pl.some(c => c.id === id) && !used.has(id)) { used.add(id); return; }
    const free = pl.find(c => !used.has(c.id)); if (free) { S.settings.pick[k] = free.id; used.add(free.id); }
  });
}
function renderPick(slot) {
  const box = document.querySelector('.pick[data-slot="' + slot + '"]'); if (!box) return;
  const c = charById(S.settings.pick[slot]);
  box.hidden = !activeSlots().includes(slot);
  const others = new Set(activeSlots().filter(k => k !== slot).map(k => S.settings.pick[k]));
  const opts = pool().map(o => '<option value="' + o.id + '"' + (o.id === c.id ? ' selected' : '') + (others.has(o.id) ? ' disabled' : '') + '>' + overall(o.a) + ' · ' + nameOf(o).replace(/</g, '') + ' (' + o.pais + ') · ' + (o.canhoto ? 'canhoto' : 'destro') + (others.has(o.id) ? ' · em uso' : '') + '</option>').join('');
  const bars = ATTRS.map(([k, lbl]) => { const v = attrOf(c.a, k); return '<span>' + lbl + '</span><span class="bar"><i class="' + (v >= 85 ? 'hi' : v <= 65 ? 'lo' : '') + '" style="width:' + v + '%"></i></span><b>' + v + '</b>'; }).join('');
  box.innerHTML = '<div class="pick-h"><span class="who">' + SLOT_LABEL[slot] + '</span><button type="button" class="arw" data-d="-1" aria-label="Anterior">‹</button><button type="button" class="arw" data-d="1" aria-label="Próximo">›</button></div>'
    + '<select class="psel" id="sel-' + slot + '" aria-label="Escolher jogador da lista">' + opts + '</select>'
    + '<div class="pick-top"><div style="min-width:0"><input class="pnm" type="text" id="nm-' + slot + '" maxlength="28" aria-label="Nome do jogador"><div class="meta"><span>' + c.pais + ' · ' + c.estilo + ' · joga ' + PLAY_STYLES[playStyleOf(c)].nome.toLowerCase() + ' · ' + ({ compacto: 'compacto', forte: 'forte', esguio: 'esguio', atletico: 'atlético' }[c.build] || 'atlético') + (c.canhoto ? ' · canhoto' : ' · destro') + (c.fem ? ' · feminino' : ' · masculino') + '</span><label>Altura <input class="palt" type="number" min="150" max="215" id="alt-' + slot + '" value="' + Math.round(heightOf(c) * 100) + '"> cm</label></div></div>'
    + '<div class="ovr">' + overall(c.a) + '<small>OVR</small></div></div><div class="bars">' + bars + '</div>';
  const inp = box.querySelector('.pnm'); inp.value = nameOf(c);
  inp.addEventListener('input', () => { NAMES[c.id] = inp.value; try { localStorage.setItem('pdo-names', JSON.stringify(NAMES)); localStorage.setItem('pdo-prefs-at', String(Date.now())); if (S.onPrefsSaved) S.onPrefsSaved(); } catch (e) {} });
  inp.addEventListener('change', renderRoster);
  const ai = box.querySelector('.palt');
  ai.addEventListener('change', () => { const v = clamp(Math.round(+ai.value || 0), 150, 215); ai.value = v; HEIGHTS[c.id] = v; try { localStorage.setItem('pdo-prefs-at', String(Date.now())); if (S.onPrefsSaved) S.onPrefsSaved(); } catch (e) {} try { localStorage.setItem('pdo-heights', JSON.stringify(HEIGHTS)); } catch (e) {} });
  box.querySelector('.psel').addEventListener('change', e => { S.settings.pick[slot] = e.target.value; saveSettings(); renderRoster(); });
  box.querySelectorAll('.arw').forEach(b => b.addEventListener('click', () => cyclePick(slot, +b.dataset.d)));
}
function renderRoster() { fixPicks(); ['me', 'mate', 'o1', 'o2'].forEach(renderPick); }
function cyclePick(slot, d) {
  const pl = pool(); if (!pl.length) return;
  const used = new Set(activeSlots().filter(k => k !== slot).map(k => S.settings.pick[k]));
  let i = pl.findIndex(c => c.id === S.settings.pick[slot]);
  for (let n = 0; n < pl.length; n++) { i = (i + d + pl.length) % pl.length; if (!used.has(pl[i].id)) break; }
  S.settings.pick[slot] = pl[i].id; saveSettings(); renderRoster();
}
document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', () => { S.settings.mode = r.value; renderRoster(); }));
document.querySelectorAll('input[name=gender]').forEach(r => r.addEventListener('change', () => { S.settings.gender = r.value; saveSettings(); renderRoster(); }));

export { PAD, timingK, timingLv, applyMeterLook, renderCourtPickers, renderBallPickers, renderBinds, ctlFeedback, localCtl, makeRemoteCtl, meterDom, meterStep, pressShot, releaseShot, timeToReach, LOB_MAX, MTR, RES_WORD, applyCam, cancelMeter, inPlay, keys, readMenu, releaseMeter, saveSettings, setPaused, syncMenu, timeToSmash, toggleCam, togglePause, toggleSound, touch };
