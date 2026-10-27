// @ts-nocheck
// física da bola, trajetórias e o golpe (doHit)
import './09-interface';
import { perfHitHook } from './09-interface';
import { $s } from '../state';
import { ATTR_OF, C, G, SERVES, SHOTS, V3, attrK, bG, clamp, gauss, hScale, lerp, rand, shortK , overall, weakK, attrN, attrOf } from './00-base';
import { S, NET } from './01-estado';
import { VAR_FX, swingVar } from './04-poses';
import { ball } from './07-glb';
import { sndHit } from './08-audio';
import { humanAim, humanDepthT, skillOf, startJump } from './11-mira';
import { aiAim, expectK } from './16-ia';
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
  perfHitHook(p);
  mod = mod || {};
  let key = type;
  // smash da barra (perfeito/cedo/tarde) continua smash até 1,5 m; o golpe rápido sem barra vira drive abaixo de 1,9 m
  if (!isServe && type === 'smash' && (ball.pos.y < (mod.meterSmash ? 1.5 : 1.9) || mod.volley)) key = 'drive';
  let spec = Object.assign({}, isServe ? SERVES[type] : SHOTS[key]);
  if (mod.volley) spec.label = 'VOLEIO';
  // quanto mais forte a bola que chega, maior a chance de a devolução sair levantada ou para fora
  let pop = false, wild = false, grade = q;
  // bola do lado esquerdo do jogador (fora o smash por cima): backhand
  const bhSide = !isServe && key !== 'smash' && sideOf(p) < -.15;
  if (bhSide) {
    const bh = attrK(p, 'backhand');
    spec.noise *= lerp(1.6, 1.05, bh);
    q *= lerp(.72, .98, bh) * (1 - weakK(p, 'backhand') * .15);
    mod.misBoost = (mod.misBoost || 0) + (1 - bh) * .25 + weakK(p, 'backhand') * .18; // backhand fraco: muito mais bola na rede/fora (pesa um pouco mais)
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
  const pressure = isServe || key === 'smash' ? 0 : clamp((inSpeed - 12) / 9 + (ball.finisher ? .55 : 0), 0, 1.5) * (S.rally === 1 ? .38 : 1); // devolução de saque: o saque ficou mais rápido, a pressão sobe bem menos
  if (pressure > 0) {
    // contra bola forte, o golpe de defesa é o mais seguro; a curta (toque) é uma aposta: levanta ou sai mais
    const risk = key === 'defesa' ? .6 : key === 'curta' ? 1.45 : 1;
    const qq = clamp((mod.timing === undefined ? q : q * .6 + mod.timing * .4) + (attrK(p, 'def') - .7) * .5 + (key === 'defesa' ? .06 : 0), 0, 1);
    grade = qq;
    const wDef = 1 + weakK(p, 'def') * .9; // defesa fraca: bem mais erro e bola levantada
    let pOut = pressure * (1 - qq) * .45 * risk * wDef, pPop = pressure * (.12 + (1 - qq) * .9) * risk * wDef;
    // bola de finalização: mesmo a defesa perfeita às vezes não segura (menos para quem defende muito bem)
    if (ball.finisher) { const dk = clamp((attrK(p, 'def') - .4) / .55, 0, 1); pPop += lerp(.24, .1, dk); pOut += lerp(.2, .1, dk); } // espirra para fora com frequência
    // smash potente (força e smash altos, mais ainda o perfeito): a defesa espirra mais (menos para quem defende bem)
    // (vale para qualquer golpe de devolução: com curta ou lob espirra ainda mais que com a defesa)
    if (ball.smashPow) { const dk = lerp(1, .6, Math.min(1, attrK(p, 'def'))) * (key === 'defesa' ? 1 : key === 'curta' ? 1.5 : 1.25); pOut += .2 * ball.smashPow * dk; pPop += .14 * ball.smashPow * dk; }
    const r0 = Math.random();
    if (r0 < pOut) wild = true; else if (r0 < pOut + pPop) pop = true;
  }
  // finalização: vale para qualquer devolução (defesa, curta, lob e até contra-smash, que antes escapava da pressão);
  // espirra para fora ou fica na rede, e cada finalização seguida que a mesma dupla segura deixa a próxima mais difícil
  // (desequilibrado, sem tempo de voltar à base): ninguém segura 5 seguidas
  let netFin = false;
  if (!isServe) {
    const fc = S.finChain || (S.finChain = { team: -1, n: 0 });
    if (S.rally <= 1 || !ball.finisher) { if (fc.team === p.team || S.rally <= 1) { fc.team = p.team; fc.n = 0; } }
    else {
      if (fc.team !== p.team) { fc.team = p.team; fc.n = 0; }
      const dk = clamp((attrK(p, 'def') - .4) / .55, 0, 1), kf = { defesa: 1, lob: 1.2, curta: 1.45, smash: 1.6, drive: 1.4 }[key] || 1.2;
      const pf = Math.min(.85, (lerp(.22, .11, dk) + fc.n * lerp(.1, .07, dk)) * kf), r1 = Math.random();
      if (!wild && !pop && r1 < pf) { if (r1 < pf * .45) wild = true; else netFin = true; }
      fc.n++;
    }
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
      spec.T = lerp(1.25, .78, dk) * lerp(1.06, .94, attrK(p, 'def')) * (1 + weakK(p, 'def') * .18); // defensor fraco devolve mais flutuada
      spec.margin = lerp(.3, .07, dk); // bem batida passa rente à rede (abaixo da altura de finalização do jogador da rede)
    }
  }
  let lobLong = 0, finisher = false, topK = 0; // topK: quanto efeito para baixo o golpe consegue (0 a 1)
  // finalização: smash por cima até a linha dos 3 m; o smash PERFEITO da barra vale até um pouco atrás dela (3,6 m) e com a bola mais baixa
  const netD = Math.abs(p.pos.z);
  if (!isServe && key === 'smash' && !mod.volley && ((netD < 3 && ball.pos.y > 1.9) || (mod.perfect && netD < 3.6 && ball.pos.y > 1.5))) {
    finisher = true;
    spec.speed *= 1.36; spec.depth = [3.0, 5.6]; spec.noise *= .8; spec.label = 'FINALIZAÇÃO';
    // finalização com a barra perfeita: um foguete para baixo, mesmo para quem ainda não tem tanta força
    if (mod.perfect) spec.speed *= 1.05;
  }
  // smash contra lob chutado perfeito: quem chega lá correu para trás e bate mal (fraco, impreciso, erra mais).
  // Se alcançou ainda na zona de finalização (o lob não passou), é finalização normal
  if (!isServe && key === 'smash' && ball.kick && !finisher) {
    finisher = false; spec.speed *= .72; spec.noise *= 1.8; spec.label = 'SMASH RECUANDO';
    mod.misBoost = (mod.misBoost || 0) + .18 * lerp(1.2, .7, attrK(p, 'smash')); mod.oppMissBoost = 0;
  }
  // smash na devolução de saque: contra saque rasante é difícil (bola baixa, pouco tempo para subir na rede) e sai ruim;
  // só contra saque que subiu muito (saque muito ruim) o smash sai normal. Vale para todos
  if (!isServe && S.rally === 1 && !S.drill && key === 'smash' && !mod.volley) {
    const low = clamp((3.6 - (ball.apex || 3.6)) / .8, 0, 1);
    if (low > 0) { finisher = false; spec.label = 'SMASH APRESSADO'; spec.speed *= 1 - .22 * low; spec.noise *= 1 + .9 * low; mod.misBoost = (mod.misBoost || 0) + .28 * low; mod.oppMissBoost = (mod.oppMissBoost || 0) * (1 - low); }
  }
  // smash do fundo (além de 3,5 m da rede): chega mais lento e menos preciso, para todos
  if (!isServe && key === 'smash' && !finisher && !mod.volley) {
    const far = clamp((Math.abs(p.pos.z) - 3.5) / 3.5, 0, 1);
    // quem tem força e smash bons perde bem menos do fundo
    const A = p.char && p.char.a, pk = A ? clamp(((A.forca + A.smash) / 2 - 72) / 18, 0, 1) : 0;
    if (far > 0) { spec.speed *= 1 - far * .18 * (1 - pk * .75); spec.noise *= 1 + far * .8 * (1 - pk * .5); mod.misBoost = (mod.misBoost || 0) + far * (.03 + (1 - attrK(p, 'smash')) * .2); mod.oppMissBoost = (mod.oppMissBoost || 0) * (1 - far * .7 * (1 - pk * .6)); }
    // smash do meio para o fundo (além dos 3 m) de quem tem força e smash altos: sai mais forte sempre;
    // com a barra perfeita (ou num golpe bem encaixado da CPU) vira SMASH BOMBA
    if (pk > 0 && Math.abs(p.pos.z) > 3 && ball.pos.y > 1.9) {
      const full = mod.perfect || (!p.isHuman && Math.random() < attrK(p, 'smash') * .3), k = pk * (full ? 1 : .45);
      topK = Math.max(topK, k);
      spec.speed *= 1 + .16 * k + far * .06 * k; spec.noise *= 1 - .3 * k; if (full) spec.depth = [4.2, 6.8];
      mod.oppMissBoost = (mod.oppMissBoost || 0) + .14 * k; if (full && pk > .35) spec.label = 'SMASH BOMBA';
    }
  }
  if (!pop && key === 'lob' && mod.lobPower !== undefined) {
    const lp = clamp(mod.lobPower, 0, 1);
    // lob com pouca força sai chutado: baixo, rápido e caindo forte; só o carregado sobe alto e devagar
    spec.T = lerp(.95, 2.6, Math.pow(lp, 2.2)); spec.depth = [lerp(5.8, 6.4, lp), lerp(7.1, 7.6, lp)];
    spec.margin = lerp(.25, .4, lp); spec.gk = lerp(1.6, 1.1, Math.sqrt(lp));
    spec.label = lp < .35 ? 'LOB CHUTADO' : lp < .75 ? 'LOB' : 'LOB ALTO';
    // chutado PERFEITO: sobe só o bastante para passar por cima do smash de quem está na rede e despenca no fundo
    if (mod.lobKick) { spec.T = 1.15; spec.depth = [6.5, 7.4]; spec.margin = .5; spec.kick = true; spec.label = 'LOB CHUTADO'; }
    lobLong = Math.max(0, mod.lobPower - 1);
  }
  if (spec.speed) spec.speed *= mod.speedMul || 1;
  if (spec.T) spec.T /= mod.speedMul || 1;
  spec.noise *= mod.noiseMul || 1;
  // saque lob PERFEITO: sobe mais que o lob mais alto do jogo normal, cai devagar e fundo (o recebedor erra mais)
  if (isServe && type === 'lob' && mod.perfect) {
    const lk = Math.min(1, (attrK(p, 'lob') + attrK(p, 'saque')) / 2);
    spec.T = lerp(2.55, 2.8, lk); spec.depth = [6.6, 7.5]; spec.gk = 1.05; spec.margin = .6; spec.label = 'SAQUE LOB PERFEITO';
    mod.oppMissBoost = (mod.oppMissBoost || 0) + .05 + .05 * lk;
  }
  // voleio: bola batida no ar perto da rede (drive, voleio da barra, bloqueio/curta/defesa a menos de 3,2 m da rede)
  const volleyish = !isServe && (key === 'drive' || !!mod.volley || (netD < 3.2 && key !== 'smash' && key !== 'lob'));
  const vlK = volleyish ? attrK(p, 'voleio') : 0;
  if (volleyish) { if (spec.speed) spec.speed *= lerp(.94, 1.08, vlK); if (spec.T) spec.T /= lerp(.97, 1.04, vlK); spec.noise *= lerp(1.2, .8, vlK); if (mod.misBoost) mod.misBoost *= lerp(1.3, .7, vlK); }
  if (p.char) {
    const A = p.char.a;
    // atributos pesam na faixa que existe no jogo (35 a 95): 50 → bem impreciso, 75 → normal, 95 → muito preciso
    spec.noise *= lerp(1.5, .55, attrN(isServe ? A.saque : A[ATTR_OF[key]] || A.def));
    const fk = attrN(A.forca);
    if (!isServe && (key === 'smash' || key === 'drive')) spec.speed *= finisher ? lerp(.92, 1.12, fk) : lerp(.8, 1.15, fk); // na finalização a força pesa menos
    // saque: um pouco mais forte para todos e bem mais forte para quem tem força e saque altos
    if (isServe && spec.speed) spec.speed *= lerp(.92, 1.22, Math.pow(Math.min(1, attrN((A.forca + A.saque) / 2)), 1.3));
    // saque bom faz o recebedor errar mais; fora do perfeito esse efeito é bem menor (devolver é mais fácil)
    if (isServe) mod.oppMissBoost = (mod.oppMissBoost || 0) + Math.max(0, (A.saque - 60) / 100) * .07 * (mod.perfect ? 1 : .3);
  }
  const dir = p.team === 0 ? -1 : 1;
  const lim = C.halfW - (key === 'curta' ? .8 : .35); // curta mira mais para dentro (é toque, não precisa da linha)
  let aim = pop ? rand(-1, 1) * (C.halfW - 1) : clamp(p.isHuman ? humanAim(p) : aiAim(p), -lim, lim);
  if (mod.aimShift) aim = clamp(aim + mod.aimShift, -lim - .45, lim + .45);
  // smash do fundo cruzado (na diagonal): mais difícil — menos preciso e erra um pouco mais
  if (!isServe && key === 'smash' && !finisher && !mod.volley) {
    const farX = clamp((Math.abs(p.pos.z) - 3.5) / 3.5, 0, 1), crossK = clamp((Math.abs(aim - p.pos.x) - 1.5) / 2.5, 0, 1);
    if (farX * crossK > 0) { spec.noise *= 1 + .5 * farX * crossK; mod.misBoost = (mod.misBoost || 0) + .12 * farX * crossK; }
  }
  // variação do golpe conforme o contato
  const vr = isServe || pop ? '' : swingVar(type, ball.pos.y, p, aim);
  const vfx = vr && key !== 'drive' ? VAR_FX[type + '_' + vr] : null;
  if (vfx) {
    if (!finisher) spec.label = vfx.label;
    if (vfx.speed && spec.speed) spec.speed *= vfx.speed; if (vfx.depth && !finisher) spec.depth = vfx.depth; if (vfx.T && spec.T) spec.T = vfx.T; // a finalização mantém a profundidade dela
    if (vfx.noise) spec.noise *= vfx.noise; if (vfx.gk && !finisher) spec.gk = vfx.gk;
    if (vfx.wide) aim = Math.sign(aim || rand(-1, 1)) * lim * .92;
    if (vfx.jump) startJump(p, .5, .42);
  }
  if (!isServe) p.swing.var = vr;
  if (!spec.gk) spec.gk = pop ? 1 : isServe ? (type === 'smash' ? 1.12 : 1) : ({ smash: 1.35, drive: 1.18, lob: 1.1, curta: 1, defesa: 1 }[key] || 1);
  // curta: só sai rápida e rente à rede com bom timing/qualidade e atributo de curta alto; as comuns são mais lentas e alcançáveis
  let curtaK = 0;
  if (key === 'curta' && !pop && !isServe) {
    const tq = mod.timing === undefined ? q : q * .4 + mod.timing * .6; // o toque na hora certa (anel verde) é o que mais conta
    curtaK = clamp((tq - .45) / .4, 0, 1) * lerp(.65, 1, clamp((attrK(p, 'curta') - .35) / .6, 0, 1));
    // curta boa (mais ainda a matadora) cai mais perto da rede e despenca mais rápido: difícil de buscar para qualquer um
    spec.gk = lerp(.95, 1.63, Math.pow(curtaK, 1.2)) * (vr === 'baixa' ? .93 : 1);
    spec.margin = lerp(.14, .09, curtaK);
    spec.depth = [lerp(1.1, 1.08, curtaK), lerp(2.5, 2.35, curtaK)];
    if (curtaK > .86 && !finisher) spec.label = 'CURTA MATADORA';
  }
  const err = 1.15 - q;
  // na finalização a mira curta (W) vai só até o meio: mais curta, a bola precisaria subir para passar a rede e perderia a velocidade
  const dT = p.isHuman ? (finisher ? .45 + humanDepthT(p) * .55 : humanDepthT(p)) : 0;
  const depth = p.isHuman && !pop && !isServe ? lerp(spec.depth[0], spec.depth[1], dT) + rand(-.2, .2) : rand(spec.depth[0], spec.depth[1]);
  const tgt = new V3(aim + gauss() * spec.noise * err, C.ballR, dir * (depth + gauss() * spec.noise * err * 1.2));
  if (wild) { tgt.x += (Math.random() < .5 ? -1 : 1) * rand(.8, 2.2); tgt.z += dir * rand(1.2, 3.2); }
  if (lobLong > 0) tgt.z += dir * (1 + lobLong * 14);
  if (dir < 0 && tgt.z > -.4) tgt.z = -.4;
  if (dir > 0 && tgt.z < .4) tgt.z = .4;
  let v;
  if (spec.kick && !pop) {
    // lob chutado perfeito: acima do alcance do smash de quem está na frente dos 3 m, inclusive se ele der um passo para trás;
    // depois do ponto mais alto despenca (gravidade maior = efeito de bola caindo forte)
    const np = $s.teams[1 - p.team].filter(o => Math.abs(o.pos.z) < 3.6).sort((a, b) => Math.abs(a.pos.z) - Math.abs(b.pos.z))[0];
    const zN = (np ? np.pos.z : dir * 2.2) + dir * .8, H = (np ? 3.0 * hScale(np) : 3.0) + .3;
    spec.gk = 1.3;
    for (let i = 0; i < 30; i++) {
      v = solveShot(ball.pos, tgt, spec);
      const t = (zN - ball.pos.z) / v.z, y = ball.pos.y + v.y * t - .5 * G * spec.gk * t * t;
      if (t <= 0 || y >= H || spec.gk >= 3.2) break;
      spec.gk *= 1.06;
    }
  } else if (!pop && !wild && spec.speed && (finisher || topK > 0 || (isServe && type === 'smash'))) {
    // em vez de subir a bola para passar a rede (e perder a velocidade), bate com efeito para baixo: a bola passa a rede e
    // despenca (gravidade maior), só quando a linha reta não passaria. Finalização até 2,8×; smash do meio/fundo de quem tem
    // força e smash bons até ~2,4× (mais com a barra perfeita); saque por cima perfeito conforme o atributo de saque
    // saque por cima: sempre com algum efeito (rasante); o perfeito com mais. Só o muito fraco (speedMul baixo) sobe
    const gkMax = finisher ? 2.8 : isServe ? (mod.perfect ? lerp(1.3, 2.1, attrK(p, 'saque')) : (mod.speedMul || 1) < .8 ? 1.15 : lerp(1.45, 1.95, attrK(p, 'saque'))) : lerp(1.5, 2.4, topK);
    const d = Math.hypot(tgt.x - ball.pos.x, tgt.z - ball.pos.z), T0 = Math.max(.28, d / spec.speed), tn = Math.abs(ball.pos.z) / (d / T0);
    if (isServe) spec.margin = Math.max(spec.margin || 0, mod.perfect ? .2 : .14); // saque rápido com efeito: folga sobre a rede (vento não derruba)
    let gk = spec.gk || 1.35;
    for (let i = 0; i < 24 && gk < gkMax; i++) {
      const vy = (tgt.y - ball.pos.y + .5 * G * gk * T0 * T0) / T0, yn = ball.pos.y + vy * tn - .5 * G * gk * tn * tn;
      if (yn >= C.netH + C.ballR + (spec.margin || .1)) break;
      gk *= 1.07;
    }
    spec.gk = Math.min(gk, gkMax); v = solveShot(ball.pos, tgt, spec);
  } else v = solveShot(ball.pos, tgt, spec);
  let mis = false;
  const prs = S.pressure && p.char ? (1 - clamp((overall(p.char.a) - 60) / 35, 0, 1)) * .05 : 0; // nervosismo no ponto decisivo
  const riskK = ({ smash: 1.25, drive: 1.1, curta: 1.35, lob: .8, defesa: .75 }[key] || 1) * (volleyish ? lerp(1.3, .7, vlK) : 1); // golpes arriscados erram mais
  const unforced = !p.isHuman && !isServe && Math.random() < skillOf(p).err * riskK + prs;
  // finalização de perto (menos de 2 m da rede) em cima de quem está colado na rede: com a barra perfeita, mesmo a defesa
  // perfeita volta para dentro no máximo 1 em 5; sem o perfeito, metade (o reflexo salva a bola, mas sem controle)
  const closeFin = !isServe && !!ball.finNear && Math.abs(p.pos.z) < 3.2 && Math.random() < ball.finNear;
  if (netFin || unforced || closeFin || (mod.misBoost && Math.random() < mod.misBoost) || (q < .4 && Math.random() < (.4 - q) * 2.2)) {
    mis = true;
    if (netFin || Math.random() < (p.isHuman ? .5 : skillOf(p).netK || .5)) v.y -= 1.2 + Math.random() * 1.6; else v.multiplyScalar(1.12 + Math.random() * .14);
  }
  // para as estatísticas: quem bateu, que golpe, e se a bola que chegou era difícil (erro forçado).
  // forcedBy: o golpe do adversário que forçou (smash, curta boa, lob chutado, bola rápida) — ele leva o crédito do ponto
  const prev = S.lastHit && S.lastHit.p.team !== p.team ? S.lastHit : null;
  const thrIn = ball.threat || 0, stretch = Math.hypot(ball.pos.x - p.pos.x, ball.pos.z - p.pos.z) / reachOf(type, p);
  const forced = !isServe && (thrIn >= .4 || inSpeed > 14 || !!ball.finisher || pressure > .35);
  const hard = forced || (!isServe && (!!p.dive || stretch > .8 || ball.pos.y < .35 || q < .45));
  S.lastHit = { p, cat: isServe ? 'saque' : mod.volley ? 'voleio' : key, hard, forcedBy: forced && prev ? { p: prev.p, cat: prev.cat } : null, hitId: S.hitId + 1 };
  // ameaça do golpe que sai (0 a 1): o quanto ele força o erro de quem vai receber
  let threat = 0;
  if (!pop && !wild && !mis) {
    threat = clamp((Math.hypot(v.x, v.z) - 12) / 8, 0, 1);
    if (key === 'smash') threat = Math.max(threat, .55);
    if (key === 'curta') threat = Math.max(threat, clamp((curtaK - .35) / .55, 0, 1));
    if (spec.kick) threat = Math.max(threat, .85);
    if (finisher) threat = 1;
    if (isServe) threat *= mod.perfect ? .6 : .4; // devolução: o recebedor já está esperando a bola (e o saque não perfeito é mais fácil)
  }
  ball.threat = threat;
  ball.vel.copy(v); ball.gk = spec.gk || 1; ball.state = 'live'; ball.oppMiss = (mod.oppMissBoost || 0) + (finisher ? .32 : 0); ball.finisher = finisher; ball.finNear = finisher && netD < 2 ? (mod.perfect || !p.isHuman ? .84 : .5) : 0;
  { const A2 = p.char && p.char.a; ball.smashPow = key === 'smash' && !isServe && !pop && !wild && !mis && A2 ? Math.pow(Math.min(1, attrN((A2.forca + A2.smash) / 2)), 1.2) * (mod.perfect || (!p.isHuman && Math.random() < attrK(p, 'smash') * .3) ? 1 : .55) : 0; } ball.kick = !!spec.kick && !pop;
  ball.apex = ball.pos.y + Math.max(0, v.y) * Math.max(0, v.y) / (2 * G);
  S.lastTeam = p.team; S.hitId++; S.rally++;
  const power = key === 'smash' ? 1 : key === 'drive' ? .7 : key === 'curta' ? .1 : .4;
  sndHit(power); if (NET.ev) NET.ev('hit', p, power);
  if (key === 'smash') { const mine = p.isHuman && !p.netHuman; S.shake = mine ? .25 : .1; if (mine) S.stats.smashes++; }
  $s.teams[1 - p.team].forEach(o => { o.ai.reactT = skillOf(o).react * expectK(o, key); if (o.splitFor !== S.hitId - 1) o.split = .26; }); // quem já deu o split no smash não repete
  p.swing.type = isServe ? 'smash' : type; p.swing.hit = true;
  const hitAt = isServe ? .3 : .45;
  if (p.swing.t < 0 || p.swing.t < p.swing.dur * hitAt) p.swing.t = p.swing.dur * hitAt;
  p.contact = { x: ball.pos.x, y: ball.pos.y, z: ball.pos.z, u: p.swing.t / p.swing.dur, hitId: S.hitId }; // a animação leva a raquete até aqui
  if (key === 'smash' && ball.pos.y > 2.2) startJump(p, .38, .3);
  if (pressure <= 0 && mod.timing !== undefined) grade = q * .6 + mod.timing * .4;
  if (key === 'curta' && !pop) grade = clamp(.7 + (curtaK - .5) * .6, .05, 1); // cor do anel da curta: verde a partir de uma curta BOA
  return { key, label: spec.label, mis, pop, wild, grade, pressure, backhand: bhSide, contact: contactWord, curtaK };
}

export { reachOf, canHit, doHit, hitQuality, predictLanding, racketNearBall, smashReach, solveShot };
