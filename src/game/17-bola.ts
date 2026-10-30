// @ts-nocheck
// atualização da bola e pontos
import './16-ia';
import { $s } from '../state';
import { bCurve, C, bG, clamp, rand, attrK, SWING_DUR, TOSS_T } from './00-base';
const BALL_VIS = .055; // raio da bola como ela aparece (07-glb)
const BALL_MARK = .032; // raio da marca que ela deixa na areia (afunda ~1 cm)
import { S, NET } from './01-estado';
import { human } from './06-modelos';
import { ball, ballMark, puff } from './07-glb';
import { sndHit, sndSand } from './08-audio';
import { sideWalkStep, drillNext, el, placeHeldBall, pointTo, setupPoint, showOver, showReview } from './09-interface';
import { skillOf, startJump, startToss, handPos, releaseToss } from './11-mira';
import { localCtl, meterStep } from './12-controles';
import { chooseAIServe, updateAI, updateHuman } from './16-ia';
import { startCeremony } from './22-cerimonia';
// stamina: gasta correndo no ponto (bem mais em arrancada), em cada golpe, salto e mergulho (quem tem mais velocidade/físico
// cansa menos). A recuperação é por ponto (não pelo tempo parado): +10% a cada ponto, +25% no fim do game e +30% na troca de lado, até o teto que cai com a duração da partida
function staminaStep(dt) {
  for (const p of $s.players) {
    if (p.sta === undefined) p.sta = 1;
    if (S.mode === 'rally') {
      // andar e trotar quase não gasta: o custo vem da arrancada (acima de ~2,5 m/s), dos golpes, dos saltos e dos mergulhos
      const sp = Math.hypot(p.vel.x, p.vel.z), k = 1.2 - .45 * Math.min(1, attrK(p, 'folego')); // fôlego alto cansa bem menos
      // (quem joga no teclado corre sempre no máximo, sem meio-termo como a CPU: a corrida dele pesa 30% menos)
      let d = dt * (.005 + .05 * Math.pow(clamp((sp - 2.5) / 2.8, 0, 1.2), 1.5) * (p.isHuman ? .7 : 1));
      if (p.jump > 0 && !p.staJ) { p.staJ = true; d += .2 * (p.jumpH || .3); } else if (!(p.jump > 0)) p.staJ = false;
      if (p.dive && !p.dive.staT) { p.dive.staT = true; d += .09; }
      if (p.swing.t >= 0 && !p.staS) { p.staS = true; d += p.swing.type === 'smash' ? .022 : .012; } else if (p.swing.t < 0) p.staS = false; // cada golpe também cansa (o smash mais)
      p.sta = Math.max(0, p.sta - d * k);
      p.staTired = (p.staTired || 0) + dt * .002 * k; // cansaço acumulado: ~3 min de bola em jogo (um set de 6 games) baixam o teto ~25%; até −45% (menos com fôlego)
    }
  }
}
// ---------- Bola ----------
function updateBall(dt) {
  if (ball.state === 'held') { placeHeldBall(); return; }
  // lançamento do saque: a bola acompanha a mão até a soltura
  if (ball.state === 'toss' && ball.inHand && S.serverPlayer) { const sp = S.serverPlayer; handPos(sp, ball.pos); ball.vel.set(0, 0, 0); if (sp.tossT >= (sp.tossRel || 0)) releaseToss(sp); else return; }
  const prev = ball.pos.clone();
  ball.vel.y -= bG() * dt; bCurve(ball.vel, dt);
  if (ball.state === 'live' && S.wind) { const ws = S.sideFlip ? -.07 : .07; ball.vel.x += S.wind.x * ws * dt; ball.vel.z += S.wind.z * ws * dt; } // vento: bolas lentas e altas desviam mais (na troca de lado ele passa a soprar ao contrário para cada time)
  ball.pos.addScaledVector(ball.vel, dt);
  if (ball.state === 'toss') {
    const sp = S.serverPlayer;
    // CPU: começa o golpe do troféu na hora certa para a raquete chegar na bola no fim do lançamento (o golpe bate a 45%)
    if (!sp.isHuman && !sp.pendingServe && sp.tossT >= (sp.tossDur || TOSS_T) - SWING_DUR * .45) {
      const D = skillOf(sp);
      sp.pendingServe = { type: S.serveType, q: S.serveType === 'smash' ? rand(D.q[0] - .15, D.q[1]) : rand(D.q[0], 1) };
      sp.swing.dur = SWING_DUR; sp.swing.t = 0; sp.swing.type = 'smash'; sp.swing.hit = false; sp.swing.var = S.serveType === 'lob' ? 'saquebaixo' : 'saque';
    }
    return;
  }
  if (ball.state === 'live') {
    if (prev.z !== 0 && Math.sign(prev.z) !== Math.sign(ball.pos.z)) {
      const f = prev.z / (prev.z - ball.pos.z);
      const yAt = prev.y + (ball.pos.y - prev.y) * f, xAt = prev.x + (ball.pos.x - prev.x) * f;
      if (yAt < C.netH + C.ballR && Math.abs(xAt) < C.netHalf) {
        ball.pos.set(xAt, yAt, prev.z > 0 ? .08 : -.08);
        ball.vel.set(0, -.5, prev.z > 0 ? 1.2 : -1.2);
        ball.state = 'dead';
        pointTo(1 - S.lastTeam, 'A bola ficou na rede.', 'net');
        return;
      }
    }
    if (ball.pos.y <= C.ballR) {
      // ponto exato do toque na areia (o passo da simulação pode ter passado um pouco dele numa bola rápida)
      const back = ball.vel.y < -.01 ? clamp((C.ballR - ball.pos.y) / -ball.vel.y, 0, .05) : 0;
      ball.pos.x -= ball.vel.x * back; ball.pos.z -= ball.vel.z * back; ball.pos.y = C.ballR;
      const x = ball.pos.x, z = ball.pos.z;
      // dentro se a MARCA da bola na areia encosta na fita (como no circuito): a fita tem 5 cm (metade para fora da linha) e a
      // marca ~3,2 cm de raio (a bola de 5,5 cm afunda ~1 cm). Antes contava o círculo inteiro da bola visto de cima, e uma
      // bola que só passava por cima da fita sem marcar nela era dada dentro
      const LINE = .025 + BALL_MARK;
      const mx = C.halfW + LINE - Math.abs(x), mz = C.halfL + LINE - Math.abs(z); // folga até deixar de tocar (negativa = fora)
      const inB = mx >= 0 && mz >= 0;
      // lance perto da linha (até 7 cm de um lado ou do outro da borda de fora da fita): telinha de revisão vista de cima
      const axis = (mx < 0) !== (mz < 0) ? (mx < 0 ? 'x' : 'z') : (Math.abs(mx) < Math.abs(mz) ? 'x' : 'z'), mg = axis === 'x' ? mx : mz;
      if (Math.abs(mg) < .07 && !S.drill) { const rv = { x, z, axis, inB, mg, vx: ball.vel.x, vy: ball.vel.y, vz: ball.vel.z }; try { showReview(rv); } catch (e) {} if (NET.ev) NET.ev('review', rv); }
      const owner = z > 0 ? 0 : 1;
      sndSand(); { const bv = Math.hypot(ball.vel.x, ball.vel.y, ball.vel.z); puff(x, z, 12 + Math.round(Math.min(24, bv * 1.2)), .7 + Math.min(.6, bv * .03), 0, 0, bv > 14 ? .5 : 0); } ballMark(x, z, ball.vel.x, ball.vel.z); if (NET.ev) NET.ev('sand', x, z);
      ball.state = 'dead'; ball.vel.multiplyScalar(.25); ball.vel.y = Math.abs(ball.vel.y) * .3;
      if (inB) pointTo(1 - owner, owner === 0 ? 'A bola tocou a areia do seu lado.' : 'A bola tocou a areia do lado da CPU.', 'in');
      else pointTo(1 - S.lastTeam, S.rally <= 1 ? 'Saque fora.' : 'Bola fora.', 'out');
    }
    return;
  }
  if (ball.state === 'dead') {
    if (ball.pos.y < C.ballR) { ball.pos.y = C.ballR; ball.vel.y = Math.abs(ball.vel.y) * .25; ball.vel.x *= .5; ball.vel.z *= .5; }
  }
}
function step(dt) {
  if (S.mode === 'toss' && S.serverPlayer) S.serverPlayer.tossT += dt;
  // jogadores humanos: o local e, no online, os do convidado (NET.remote)
  const localOn = human.isHuman && !human.netHuman; // online: o boneco "human" pode ser de um convidado ou da CPU
  if (localOn) meterStep(localCtl(), dt);
  for (const c of NET.remote) meterStep(c, dt);
  if (localOn) updateHuman(dt);
  for (const c of NET.remote) updateHuman(dt, c);
  for (const p of $s.players) if (!p.isHuman) updateAI(p, dt);
  if (S.mode === 'serve' && !S.serverPlayer.isHuman) {
    S.aiServeT -= dt;
    if (S.aiServeT <= 0) startToss(S.serverPlayer, chooseAIServe(S.serverPlayer));
  }
  updateBall(dt);
  if (S.mode === 'dead') S.ptT = (S.ptT || 0) + dt;
  staminaStep(dt);
  // mapa de calor: onde o seu jogador ficou durante os ralis (meia quadra 8 × 8 m, rede em cima)
  if (S.mode === 'rally' && S.posHeat && !S.spectate) { S.heatT = (S.heatT || 0) + dt; if (S.heatT > .2) { S.heatT = 0; const p = human, f = p.team === 0 ? 1 : -1, cx = Math.floor(clamp((p.pos.x * f + 4) / 8, 0, .999) * 8), cz = Math.floor(clamp(p.pos.z * f / 8, 0, .999) * 8); S.posHeat[cz * 8 + cx]++; } }
  if (S.mode === 'dead' && !sideWalkStep(dt) && S.celebrate) celebrateStep(dt); // troca de lado: caminhada até o poste
  else if (S.mode === 'dead' && S.ptCel && !S.sideWalk) ptCelStep(dt);
  if (S.mode === 'dead') {
    S.deadT -= dt;
    // título (carreira ou campeonato): cerimônia no pódio antes da tela do fim
    if (S.deadT <= 0) { if (S.drill) drillNext(); else if (S.matchWinner !== null) { if (S.celebrate && S.celebrate.title && !S.ceremonyDone && !NET.role) startCeremony(); else showOver(); } else setupPoint(); }
  }
}

// entre pontos: a dupla se aproxima (fica a ~1,3 m, cada um estica o braço) e faz o gesto (S.ptCel[time]); só quem é da CPU anda até o outro (você não é puxado).
// c.met: momento em que ficaram perto (o braço faz o gesto por ~0,55 s a partir daí)
function ptCelStep(dt) {
  for (const k in S.ptCel) {
    const c = S.ptCel[k], tm = $s.teams[k]; c.t += dt; if (!tm || tm.length < 2 || c.t > 1.9) continue;
    const [a, b] = tm, d0 = Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z);
    // com você na dupla: só acontece se você estiver parado quando o parceiro chega; se sair andando, o gesto acaba
    const humMove = [a, b].some(p => p.isHuman && Math.hypot(p.vel.x, p.vel.z) > .5);
    if (c.met == null && d0 < 1.45 && c.t > .3 && !humMove) { c.met = c.t; c.hold = [a, b].map(p => [p.pos.x, p.pos.z]); }
    if (c.met != null && (d0 > 1.75 || (humMove && c.t - c.met < .6))) { c.t = 9; continue; }
    // durante o gesto ficam parados juntos (a IA não puxa de volta para a posição antes da hora)
    if (c.met != null && c.t - c.met < .8) { [a, b].forEach((p, i) => { if (!p.isHuman) { p.pos.x = c.hold[i][0]; p.pos.z = c.hold[i][1]; p.vel.set(0, 0, 0); } }); continue; }
    if (c.t < .3 || c.met != null || d0 > 5) continue;
    if (humMove) { if (c.t > .8) c.t = 9; continue; } // você saiu andando: o parceiro não fica correndo atrás
    const movers = [a, b].filter(p => !p.isHuman), mx = (a.pos.x + b.pos.x) / 2, mz = (a.pos.z + b.pos.z) / 2;
    movers.forEach(p => { const o = p === a ? b : a, both = movers.length === 2;
      const tx = both ? mx + (p.pos.x - mx) / Math.max(.01, d0 / 2) * .62 : o.pos.x + (p.pos.x - o.pos.x) / Math.max(.01, d0) * 1.25;
      const tz = both ? mz + (p.pos.z - mz) / Math.max(.01, d0 / 2) * .62 : o.pos.z + (p.pos.z - o.pos.z) / Math.max(.01, d0) * 1.25;
      const dx = tx - p.pos.x, dz = tz - p.pos.z, d = Math.hypot(dx, dz), sp = Math.min(3.2, d * 4);
      p.vel.set(d > .02 ? dx / d * sp : 0, 0, d > .02 ? dz / d * sp : 0); p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt; p.swing.t = -1; p.charging = false; });
  }
  if (!S.ptCelSnd) for (const k in S.ptCel) { const c = S.ptCel[k]; if (c.met != null && c.t - c.met > .22 && !c.snd) { c.snd = true; sndHit(c.kind === 'rk' ? .1 : .08); } }
}
// comemoração: a dupla vencedora se junta, bate a mão e (no título) se abraça e pula
function celebrateStep(dt) {
  const c = S.celebrate; c.t += dt;
  const tm = $s.teams[c.team]; if (!tm) return;
  const s = c.team === 0 ? 1 : -1;
  if (tm.length < 2) { const p = tm[0]; p.vel.set(0, 0, 0); if (c.title && !c.j1 && c.t > .6) { c.j1 = true; startJump(p, .45, .5); } if (c.title && !c.j2 && c.t > 1.6) { c.j2 = true; startJump(p, .45, .5); } return; }
  const [a, b] = tm, mx = (a.pos.x + b.pos.x) / 2, mz = s * 3.2;
  if (c.mx === undefined) { c.mx = clamp(mx, -2, 2); }
  // distância entre os dois: chegando → toque de mão (.75 m) → abraço (.42 m) → separam um pouco e pulam
  const gap = c.t < 1.1 ? 1.1 : !c.title ? .75 : c.t < 1.7 ? .75 : c.t < 3.4 ? .42 : .9;
  [a, b].forEach((p, i) => {
    const side = i === 0 ? -1 : 1, tx = c.mx + side * gap / 2, tz = mz;
    const dx = tx - p.pos.x, dz = tz - p.pos.z, d = Math.hypot(dx, dz), sp = Math.min(3.2, d * 4);
    p.vel.set(d > .02 ? dx / d * sp : 0, 0, d > .02 ? dz / d * sp : 0);
    p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt;
    p.swing.t = -1; p.charging = false;
  });
  if (!c.h5 && c.t > 1.1) { c.h5 = true; startJump(a, .25, .18); startJump(b, .25, .18); sndHit(.15); }
  if (c.title && !c.j1 && c.t > 3.5) { c.j1 = true; startJump(a, .45, .45); startJump(b, .45, .45); }
  if (c.title && !c.j2 && c.t > 4.2) { c.j2 = true; startJump(a, .45, .45); startJump(b, .45, .45); }
}

export { step };
