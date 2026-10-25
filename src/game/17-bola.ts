// @ts-nocheck
// atualização da bola e pontos
import './16-ia';
import { $s } from '../state';
import { C, bG, clamp, rand } from './00-base';
const BALL_VIS = .055; // raio da bola como ela aparece (07-glb)
import { S, NET } from './01-estado';
import { human } from './06-modelos';
import { ball, puff } from './07-glb';
import { sndHit, sndSand } from './08-audio';
import { drillNext, el, placeHeldBall, pointTo, setupPoint, showOver, showReview } from './09-interface';
import { skillOf, startJump, startToss } from './11-mira';
import { localCtl, meterStep } from './12-controles';
import { chooseAIServe, updateAI, updateHuman } from './16-ia';
// ---------- Bola ----------
function updateBall(dt) {
  if (ball.state === 'held') { placeHeldBall(); return; }
  const prev = ball.pos.clone();
  ball.vel.y -= bG() * dt;
  if (ball.state === 'live' && S.wind) { const ws = S.sideFlip ? -.07 : .07; ball.vel.x += S.wind.x * ws * dt; ball.vel.z += S.wind.z * ws * dt; } // vento: bolas lentas e altas desviam mais (na troca de lado ele passa a soprar ao contrário para cada time)
  ball.pos.addScaledVector(ball.vel, dt);
  if (ball.state === 'toss') {
    const sp = S.serverPlayer;
    if (!sp.isHuman && !sp.pendingServe && ball.vel.y < 0 && ball.pos.y <= 2.7) {
      const D = skillOf(sp);
      sp.pendingServe = { type: S.serveType, q: S.serveType === 'smash' ? rand(D.q[0] - .15, D.q[1]) : rand(D.q[0], 1) };
      sp.swing.t = sp.swing.dur * .3; sp.swing.type = 'smash'; sp.swing.hit = false; sp.swing.var = 'saque';
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
      // qualquer toque na fita é dentro: a fita tem 5 cm (metade para fora da linha) + o raio da bola desenhada (5,5 cm)
      const LINE = .025 + BALL_VIS;
      const mx = C.halfW + LINE - Math.abs(x), mz = C.halfL + LINE - Math.abs(z); // folga até deixar de tocar (negativa = fora)
      const inB = mx >= 0 && mz >= 0;
      // lance muito ajustado (até 6 cm de um lado ou do outro): telinha de revisão vista de cima
      const axis = (mx < 0) !== (mz < 0) ? (mx < 0 ? 'x' : 'z') : (Math.abs(mx) < Math.abs(mz) ? 'x' : 'z'), mg = axis === 'x' ? mx : mz;
      if (Math.abs(mg) < .06 && !S.drill) { const rv = { x, z, axis, inB, mg }; try { showReview(rv); } catch (e) {} if (NET.ev) NET.ev('review', rv); }
      const owner = z > 0 ? 0 : 1;
      sndSand(); puff(x, z, 16, 1); if (NET.ev) NET.ev('sand', x, z);
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
  if (S.mode === 'dead' && S.celebrate) celebrateStep(dt);
  if (S.mode === 'dead') {
    S.deadT -= dt;
    if (S.deadT <= 0) { if (S.drill) drillNext(); else if (S.matchWinner !== null) showOver(); else setupPoint(); }
  }
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
