// @ts-nocheck
// inteligência artificial: planejamento, estilos, escolha de golpes
import './15-carreira-telas';
import { $s } from '../state';
import { C, DIFF, PLAY_STYLES, P_SPEED, SWING_DUR, TOSS_T, ZONE3, attrK, bG, clamp, hScale, lerp, overall, rand, shortK, styleOf, weakK } from './00-base';
import { NET, S } from './01-estado';
import { swingVar } from './04-poses';
import { human } from './06-modelos';
import { ball, sparkle, greenWave } from './07-glb';
import { decisive, dupla, feedback, momentum, perfShot, shotFeedback } from './09-interface';
import { canHit, doHit, hitQuality, predictLanding, racketNearBall, smashReach } from './10-fisica';
import { TAC, defenseFeedback, qualityWord, skillOf, startJump, whoKind, whoTag } from './11-mira';
import { RES_WORD, ctlFeedback, keys, localCtl, touch, PAD } from './12-controles';
import { puff } from './07-glb';
import { sideOf } from './18-animacao';
// estilo de cada personagem: pela descrição real, pelo estilo da carreira ou pelos atributos
function playStyleOf(c) {
  if (!c) return 'completo';
  if (c.jogo && PLAY_STYLES[c.jogo]) return c.jogo;
  const e = (c.estilo || '').toLowerCase();
  if (/rede|voleio|bloqueio|reflexo/.test(e)) return 'rede';
  if (/lob/.test(e) && !/curta|toque/.test(e)) return 'lobista';
  if (/toque|curta|tátic|tatic|geometria|técnica|criativ|efeito|precis/.test(e)) return 'tatico';
  if (/defes|defend|defensor|paciência|solidez|consist|regular/.test(e)) return 'paredao';
  if (/smash|ataque|atacante|potente|potência|agress|força|drive|explos|saque|intensidade|define/.test(e)) return 'agressivo';
  const a = c.a, atk = (a.smash + a.forca + a.saque) / 3, def = (a.def + a.vel) / 2, toq = (a.curta + a.lob) / 2, m = (atk + def + toq) / 3;
  if (atk > m + 1.5) return 'agressivo'; if (def > m + 1.5) return 'paredao'; if (toq > m + 1.5) return 'tatico';
  // equilibrados fictícios ganham variedade pelo id
  if (c.fict) { const h = [...c.id].reduce((t, ch) => t + ch.charCodeAt(0), 0) % 5; return h === 0 ? 'rede' : h === 1 ? 'lobista' : 'completo'; }
  return 'completo';
}
// x do lado adversário com mais espaço livre entre os jogadores
function gapX(team, jitter) {
  const opp = $s.teams[1 - team]; const lim = C.halfW - .55;
  let best = 0, bs = -1;
  for (let i = 0; i <= 10; i++) {
    const x = -lim + 2 * lim * i / 10;
    let m = Infinity; for (const o of opp) m = Math.min(m, Math.abs(o.pos.x - x));
    m += Math.random() * jitter;
    if (m > bs) { bs = m; best = x; }
  }
  return best;
}
// o "cérebro" de cada robô vem do próprio overall (reação, erros, qualidade, leitura de jogo);
// a dificuldade só ajusta os adversários na partida rápida/campeonato (na carreira o nível vem do overall de cada um)
if (typeof window !== 'undefined') window.__pdoAI = { charSkill: p => charSkill(p), homeOf: p => homeOf(p), expectK: (o, k) => expectK(o, k) };
function charSkill(p) {
  if (!p.char) return p.team === 0 ? DIFF.medio : DIFF[S.settings.diff];
  const a = p.char.a, tech = (a.curta + a.lob + a.smash + a.def) / 400;
  // carreira: as estrelas mudam o nível dos adversários e do seu parceiro (todos jogam no nível escolhido)
  // estrelas: carreira (as da carreira) e online (o nível que o anfitrião escolheu para a CPU)
  const stars = S.careerActive ? (S.careerStars || 3) : NET.role ? (S.cpuLv || 3) : 0;
  const adj = stars ? [-.04, -.03, 0, .16, .32, .5][stars - 1] : p.team === 1 ? { facil: -.18, medio: 0, dificil: .1 }[S.settings.diff] || 0 : 0;
  // nível em curva, de ~35 a ~95: 50 → .10, 60 → .24, 73 → .58, 80 → .75, 90 → .90
  const kb = clamp(1 / (1 + Math.exp(-(overall(a) - 70) / 9)), 0, 1);
  // estrelas: mudam a leitura de jogo (reação, posicionamento, escolha do golpe, não furar a bola);
  // a técnica (qualidade, força, erro do golpe) continua sendo a do atributo: um 60 no Lendário ainda erra smash do fundo
  const k = clamp(kb + adj, 0, 1.35), kt = clamp(kb + Math.min(adj, 0) + Math.max(0, adj) * .8, 0, 1.2);
  const dm = p.team === 1 && !stars ? { facil: .92, medio: 1, dificil: 1.04 }[S.settings.diff] || 1 : 1;
  return {
    speed: (2.9 + a.vel * .022) * dm, react: Math.max(.05, lerp(.3, .09, k)) * styleOf(p).react, smart: Math.min(.98, lerp(.3, .92, k)), letGo: Math.min(.97, lerp(.3, .9, k)),
    miss: Math.max(.008, lerp(.15, .018, k)) * lerp(1.3, .7, a.def / 100), err: Math.max(.006, lerp(.2, .015, Math.pow(kt, .8))) * lerp(1.25, .8, tech) * styleOf(p).err, // níveis baixos erram bem mais na rede/fora
    q: [clamp(lerp(.42, .78, kt), .3, .9), clamp(lerp(.72, 1, kt), .5, 1)],
    pw: lerp(.84, 1, Math.min(1, kt)), // nível baixo: golpes mais fracos (não mais bolas furadas)
    netK: lerp(.8, .45, Math.min(1, kt)), // erro de nível baixo vai mais na rede que para fora
    // estrelas baixas (carreira): a CPU troca bola sem pancada — golpes mais lentos, quase sem smash forte, lob baixo e saque sem força
    k, up: Math.max(0, adj), // up: quanto as estrelas sobem acima do padrão (0 no padrão: nada muda)
    soft: stars ? [.7, .84, 1, 1, 1, 1][stars - 1] : 1,
  };
}
// tática da sua dupla: 'fraco' = mirar no adversário mais fraco, 'meio' = entre os dois, 'lobs' = mais lobs no fundo
function tacticAim(team) {
  const tac = team === 0 ? S.settings.tactic : null, lim = C.halfW - .6;
  if (!tac || tac === 'normal' || tac === 'lobs') return null;
  const opp = $s.teams[1 - team]; if (!opp || !opp.length) return null;
  if (tac === 'meio' && opp.length > 1) return clamp((opp[0].pos.x + opp[1].pos.x) / 2 + rand(-.25, .25), -lim, lim);
  if (tac === 'fraco') { const w = opp.slice().sort((a, b) => overall(a.char ? a.char.a : {}) - overall(b.char ? b.char.a : {}))[0]; return clamp(w.pos.x + rand(-.4, .4), -lim, lim); }
  return null;
}
TAC.aim = tacticAim;
// mira de quem lê bem o jogo (estrelas acima do padrão): espaço aberto grande → ponto direto; lob → por cima de quem está na rede;
// senão no backhand do adversário mais fraco (defesa + backhand), levando em conta canhoto/destro
function smartAim(p) {
  const opp = $s.teams[1 - p.team], lim = C.halfW - .6; if (!opp.length) return 0;
  if (p.ai && p.ai.shot === 'lob') { const net = opp.filter(o => Math.abs(o.pos.z) < 3.6).sort((a, b) => Math.abs(a.pos.z) - Math.abs(b.pos.z))[0]; if (net) return clamp(net.pos.x + rand(-.3, .3), -lim, lim); }
  const g = gapX(p.team, .15); let gm = Infinity; for (const o of opp) gm = Math.min(gm, Math.abs(o.pos.x - g));
  if (gm > 2.1) return g;
  // alvo por peso: o mais fraco só vira foco com diferença grande de habilidade e/ou se estiver errando mais na partida
  const sk = o => (attrK(o, 'backhand') + attrK(o, 'def')) / 2, best = Math.max(...opp.map(sk)), errMin = Math.min(...opp.map(o => o.mErr || 0));
  const w = opp.map(o => 1 + Math.max(0, best - sk(o) - .1) * 8 + Math.min(3, ((o.mErr || 0) - errMin) * .35));
  let r = Math.random() * w.reduce((t, v) => t + v, 0), tgt = opp[0]; for (let i = 0; i < opp.length; i++) { if ((r -= w[i]) <= 0) { tgt = opp[i]; break; } }
  const dir = (tgt.team === 0 ? 1 : -1) * (tgt.lefty ? -1 : 1); // lado do forehand dele no eixo x
  // nem sempre o backhand: às vezes no corpo ou abrindo o forehand para variar
  const bh = Math.random() < .7 ? -1 : Math.random() < .5 ? 0 : 1;
  return clamp(tgt.pos.x + bh * dir * rand(.6, 1.05), -lim, lim);
}
function aiAim(p) {
  const st = styleOf(p), lim = C.halfW - .6;
  { const up = skillOf(p).up || 0; if (up > 0 && Math.random() < Math.min(.85, up * 2)) return smartAim(p); }
  { const ta = tacticAim(p.team); if (ta !== null && Math.random() < .7) return ta; }
  if (st.aimBody && Math.random() < st.aimBody) { const opp = $s.teams[1 - p.team].slice().sort((a, b) => Math.abs(a.pos.z) - Math.abs(b.pos.z))[0]; if (opp) return clamp(opp.pos.x + rand(-.35, .35), -lim, lim); }
  if (st.corners && Math.random() < .8) { const g = gapX(p.team, .2); return Math.sign(g || rand(-1, 1)) * Math.max(Math.abs(g), lim * .75); }
  if (Math.random() < skillOf(p).smart) return gapX(p.team, .5);
  return rand(-1, 1) * (C.halfW - 1);
}
// ---------- Planejamento (CPU, parceiro e assistência) ----------
function planIntercept(p, speed, react) {
  const pos = ball.pos.clone(), vel = ball.vel.clone(); const dt = .02; let t = 0; let lastP = null, best = null;
  const sgn = p.team === 0 ? 1 : -1;
  for (let i = 0; i < 260; i++) {
    vel.y -= bG() * dt; pos.addScaledVector(vel, dt); t += dt;
    if (pos.y < C.ballR) break;
    if (pos.z * sgn < .3 || pos.y < .5 - .12 * shortK(p) || pos.y > 2.6 * hScale(p)) continue;
    const d = Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z);
    lastP = { pt: pos.clone(), t, ok: false };
    if (Math.max(0, d - .9) / speed + react <= t) {
      // devolução de saque: entre os pontos que dá para alcançar, fica com o mais perto; no resto do jogo, o primeiro
      if (S.rally !== 1) { lastP.ok = true; return lastP; }
      const sc = d + Math.max(0, .9 - pos.y) * .8; if (!best || sc < best.sc) best = { pt: pos.clone(), t, ok: true, sc };
    }
  }
  return best || lastP;
}
const humanPlan = { id: -1, plan: null };
// qual dos dois do time vai na bola
function assignee(team) {
  // você armando o smash perto da bola: a parceira deixa (mesmo que a bola fosse dela, ex.: no meio)
  const tmH = $s.teams[team];
  if (tmH && tmH.length > 1 && ball.state === 'live' && S.lastTeam !== team) {
    const h = tmH.find(o => o.isHuman && !o.netHuman);
    if (h && (h.charging || (h.swing.t >= 0 && h.swing.type === 'smash' && !h.swing.hit)) && Math.hypot(ball.pos.x - h.pos.x, ball.pos.z - h.pos.z) < 3.5) return h;
  }
  if (S.assignId[team] === S.hitId) return S.assign[team];
  const tm = $s.teams[team]; let who = tm[0];
  if (tm.length > 1) {
    const [a, b] = tm;
    if (a.isHuman || b.isHuman) {
      const h = a.isHuman ? a : b, m = a.isHuman ? b : a;
      // decide pelo x da bola quando ela chega na linha da dupla (ou onde cai, se cair antes),
      // não pelo primeiro ponto de interceptação: a bola cruzada passa pelo meio perto da rede e ia para você
      const split = (h.pos.x + m.pos.x) / 2, zLine = (h.pos.z + m.pos.z) / 2;
      const land = predictLanding();
      let bx = land.x;
      if (Math.abs(ball.vel.z) > .5) { const t = (zLine - ball.pos.z) / ball.vel.z; if (t > 0) { const lx = ball.pos.x + ball.vel.x * t, lt = Math.abs((land.z - ball.pos.z) / ball.vel.z); if (t < lt) bx = lx; } }
      if (Math.abs(bx - split) < .3) who = Math.abs(bx - m.pos.x) < Math.abs(bx - h.pos.x) ? m : h;
      else who = Math.sign(bx - split) === Math.sign(m.pos.x - split) ? m : h;
    } else {
      // dupla da IA: vai quem está do lado onde a bola chega (na linha da dupla, ou onde cai se cair antes);
      // o outro só assume se o primeiro não alcança e ele sim (antes a curta cruzada ia para quem estava reto)
      const pa = planIntercept(a, skillOf(a).speed, 0), pb = planIntercept(b, skillOf(b).speed, 0);
      const split = (a.pos.x + b.pos.x) / 2, zLine = (a.pos.z + b.pos.z) / 2, land = predictLanding();
      let bx = land.x;
      if (Math.abs(ball.vel.z) > .5) { const t = (zLine - ball.pos.z) / ball.vel.z, lt = Math.abs((land.z - ball.pos.z) / ball.vel.z); if (t > 0 && t < lt) bx = ball.pos.x + ball.vel.x * t; }
      const side = Math.abs(bx - split) < .25 ? (Math.abs(bx - a.pos.x) < Math.abs(bx - b.pos.x) ? a : b) : (Math.sign(bx - split) === Math.sign(a.pos.x - split) ? a : b);
      const other = side === a ? b : a, ps = side === a ? pa : pb, po = side === a ? pb : pa;
      who = (!ps || !ps.ok) && po && po.ok ? other : side;
    }
  }
  S.assign[team] = who; S.assignId[team] = S.hitId;
  return who;
}
function moveToward(p, tx, tz, maxSpeed, dt) {
  const dx = tx - p.pos.x, dz = tz - p.pos.z; const d = Math.hypot(dx, dz);
  let vx = 0, vz = 0;
  if (d > .05) { const s = Math.min(maxSpeed, d * 5); vx = dx / d * s; vz = dz / d * s; }
  const k = Math.min(1, dt * 7 * (p.burst > 0 ? 1.7 : 1)); // logo depois do split step a primeira passada é mais explosiva
  p.vel.x += (vx - p.vel.x) * k; p.vel.z += (vz - p.vel.z) * k;
}
function receiving(p) {
  // até o saque ser batido ninguém passa da linha dos 3 m, só o sacador: a dupla que recebe e também o parceiro de quem saca.
  // Depois do saque todos podem avançar (senão a curta de saque seria impossível)
  return p !== S.serverPlayer && (S.mode === 'serve' || S.mode === 'toss');
}
function clampPos(p) {
  const lim = C.halfW + 3;
  p.pos.x = clamp(p.pos.x, -lim, lim);
  const minZ = receiving(p) ? ZONE3 + .05 : .4;
  if (p.team === 0) p.pos.z = clamp(p.pos.z, minZ, 11.5); else p.pos.z = clamp(p.pos.z, -11.5, -minZ);
  if (dupla()) { // companheiros não atravessam um ao outro
    for (const o of $s.teams[p.team]) if (o !== p) {
      const dx = p.pos.x - o.pos.x, dz = p.pos.z - o.pos.z, d = Math.hypot(dx, dz);
      if (d < .55 && d > 1e-4) { p.pos.x += dx / d * (.55 - d) * .5; p.pos.z += dz / d * (.55 - d) * .5; }
    }
  }
}
// janela ideal do aperto: 0,05 a 0,30 s antes da bola entrar no alcance (sinal verde)
// janela boa do aperto (curta/defesa sem barra): .05–.3 s antes da bola chegar no padrão; maior/menor pela dificuldade de timing
const TIMING_K = [1.45, 1.2, 1, .87, .75, .66];
const pressTiming = (t, tk = 1) => { const c = .175, h = .125 * tk, lo = c - h, hi = c + h; return t < lo ? lerp(.45, 1, clamp((t - (lo - .05)) / .05, 0, 1)) : t <= hi ? 1 : lerp(1, .4, clamp((t - hi) / (.3 * Math.min(1.3, tk)), 0, 1)); };
// a raquete espera a bola chegar mais perto do corpo, em vez de bater na ponta do alcance
function waitCloser(p, su, dt) {
  if (su > .7) return false;
  const d = Math.hypot(ball.pos.x - p.pos.x, ball.pos.z - p.pos.z), dn = Math.hypot(ball.pos.x + ball.vel.x * dt - p.pos.x, ball.pos.z + ball.vel.z * dt - p.pos.z);
  return d > .78 && dn < d - .002 && ball.pos.y > .2; // ainda vindo e longe: espera
}
// profissional masculino (rede 1,80) em dupla: o parceiro de quem saca só pode passar da linha dos 5 m depois do saque
const proMascHold = p => dupla() && C.netH >= 1.79 && (S.mode === 'serve' || S.mode === 'toss') && p.team === S.server && p !== S.serverPlayer;
// direção do teclado/joystick local (-1..1), no referencial de quem olha do próprio fundo de quadra
function localInput() {
  let ix = 0, iz = 0;
  if (keys.a || keys.arrowleft) ix -= 1; if (keys.d || keys.arrowright) ix += 1;
  if (keys.w || keys.arrowup) iz -= 1; if (keys.s || keys.arrowdown) iz += 1;
  ix += touch.x + PAD.x; iz += touch.z + PAD.z; // toque e controle (Xbox/PS)
  const len = Math.hypot(ix, iz); if (len > 1) { ix /= len; iz /= len; }
  return [ix, iz];
}
// c: controle do jogador (o local por padrão; no online, também o do convidado, que pode estar no time de cima)
function updateHuman(dt, c = localCtl()) {
  const p = c.p, humanPlan = c.plan, s = p.team === 0 ? 1 : -1, opp = 1 - p.team;
  const [ix, iz] = c.remote ? [c.ix, c.iz] : localInput();
  const len = Math.hypot(ix, iz);
  p.inputX = ix; p.inputZ = iz;
  const lowBall = ball.state === 'live' && S.lastTeam === opp && humanPlan.plan && humanPlan.id === S.hitId && humanPlan.plan.pt.y < 1;
  const spd = P_SPEED * lerp(.82, 1.12, attrK(p, 'vel')) * (1 + shortK(p) * (lowBall ? .1 : .03)) * (p.charging ? .75 : 1);
  let tvx = ix * spd, tvz = iz * spd;
  if (p.dive) {
    p.dive.t += dt;
    if (p.dive.t < .28) { tvx = p.dive.dx * p.dive.spd; tvz = p.dive.dz * p.dive.spd; p.vel.x = tvx; p.vel.z = tvz; }
    else { tvx = 0; tvz = 0; p.vel.x *= .6; p.vel.z *= .6; if (!p.dive.landed) { p.dive.landed = true; puff(p.pos.x, p.pos.z, 14, .9); } }
    if (p.dive.t >= p.dive.dur) p.dive = null;
  }
  const serving = S.serverPlayer === p && (S.mode === 'serve' || S.mode === 'toss');
  if (serving) {
    tvz = 0; if (S.mode === 'toss') tvx = 0;
    if (S.mode === 'toss' && p.tossT > (p.tossDur || TOSS_T) * .74) { tvz = -2.6 * s; if (!p.serveJumped) { p.serveJumped = true; startJump(p, .55, .34); } }
  }
  if (p.pendingServe) { tvx = 0; tvz = -2.6 * s; }
  if ((c.remote ? c.assistMove : S.settings.assistMove) && len < .1 && S.mode === 'rally' && ball.state === 'live' && S.lastTeam === opp && assignee(p.team) === p) {
    if (humanPlan.id !== S.hitId) { humanPlan.plan = planIntercept(p, P_SPEED * .6, 0); humanPlan.id = S.hitId; }
    if (humanPlan.plan) {
      const tx = humanPlan.plan.pt.x - .35 * s, tz = humanPlan.plan.pt.z;
      const dx = tx - p.pos.x, dz = tz - p.pos.z, d = Math.hypot(dx, dz);
      if (d > .12) { const v = Math.min(P_SPEED * .6, d * 4); tvx = dx / d * v; tvz = dz / d * v; }
    }
  }
  // passo até o ponto de contato enquanto arma o golpe (encaixe, estilo FIFA/2K)
  const sw0 = p.swing;
  if (sw0.t >= 0 && !sw0.hit && S.mode === 'rally' && ball.state === 'live' && S.lastTeam === opp) {
    if (humanPlan.id !== S.hitId) { humanPlan.plan = planIntercept(p, P_SPEED * .6, 0); humanPlan.id = S.hitId; }
    const pl = humanPlan.plan;
    if (pl) {
      const rightS = (p.lefty ? -1 : 1) * s, over = sw0.type === 'smash' && pl.pt.y >= 1.9, back = !over && sw0.side < -.15;
      const ix2 = pl.pt.x - rightS * (over ? .25 : back ? -.6 : .7), iz2 = pl.pt.z + (over ? .15 : .25) * s;
      const dx = ix2 - p.pos.x, dz = iz2 - p.pos.z, dd = Math.hypot(dx, dz);
      if (dd > .05 && dd < .8) { const a = Math.min(1.8, dd * 5); tvx += dx / dd * a; tvz += dz / dd * a; }
    }
  }
  // inércia: trocar de direção custa uma passada; parar é rápido
  const rev = tvx * p.vel.x + tvz * p.vel.z < 0;
  const k = Math.min(1, dt * (rev ? 5 : len < .1 ? 9 : 7.5) * (p.burst > 0 && len > .1 ? 1.7 : 1));
  p.vel.x += (tvx - p.vel.x) * k; p.vel.z += (tvz - p.vel.z) * k;
  p.pos.addScaledVector(p.vel, dt);
  clampPos(p);
  if (serving && S.mode === 'serve') { p.pos.z = 8.6 * s; p.pos.x = clamp(p.pos.x, -C.halfW + .1, C.halfW - .1); }
  if (proMascHold(p)) p.pos.z = s * Math.max(Math.abs(p.pos.z), 5.05); // parceiro do sacador atrás dos 5 m até o saque
  const sw = p.swing;
  if (sw.t >= 0) {
    const su = sw.t / sw.dur;
    const overhead = sw.type === 'smash' && ball.pos.y >= 1.9;
    let fire = false;
    if (sw.meter && sw.hold > 0 && !sw.hit) {
      if (overhead ? smashReach(p) : canHit(p, 'smash')) { sw.hold = 0; fire = true; if (overhead) startJump(p, .38, .28); }
      else {
        sw.hold -= dt; sw.t = sw.dur * .3 - dt;
        const passed = ball.state !== 'live' || (p.team === 0 ? ball.pos.z > p.pos.z + .8 : ball.pos.z < p.pos.z - .8);
        if (passed) sw.hold = 0;
        if (sw.hold <= 0) { sw.hold = 0; sw.hit = true; ctlFeedback(c, 'SMASH', 'FORA DO ALCANCE', null); }
      }
    }
    const contact = fire || (overhead
      ? (su >= .29 && su <= .75 && (sw.meter ? smashReach(p) : racketNearBall(p, .42)))
      : (sw.t <= sw.dur * (sw.meter || sw.lob ? .9 : .8) && canHit(p, sw.type) && !(p.isHuman && waitCloser(p, su, dt))));
    if (p.pendingServe && su >= .45) {
      const ps = p.pendingServe; p.pendingServe = null;
      ball.state = 'live'; S.mode = 'rally';
      const sp = ball.pos.clone();
      const r = doHit(p, ps.type, ps.q, true, ps.mod);
      if (S.drill) S.drill.lastR = Object.assign({}, r, { serveRes: ps.res });
      if (ps.res === 'perfeito' && !r.mis) { sparkle(sp); if (NET.ev) NET.ev('spark', sp); if (p.isHuman) { const wp = { x: p.pos.x, z: p.pos.z }; greenWave(wp); if (NET.ev) NET.ev('wave', wp); } } // saque perfeito: estrelinhas no contato (e a ondinha para quem joga)
      ctlFeedback(c, r.label, r.mis ? 'ERROU' : ps.word || RES_WORD[ps.res], null);
    } else if (!sw.hit && !p.pendingServe && S.mode === 'rally' && contact) {
      let q = hitQuality(p, sw.type), mod = {};
      if (sw.meter) {
        const { res, amt } = sw.meter;
        // atributo: com smash baixo, mesmo o perfeito sai mais fraco e às vezes erra
        const skN = Math.min(1, attrK(p, 'smash'));
        if (res === 'voleio') { q = Math.max(q, lerp(.66, .86, skN)); mod = { speedMul: lerp(1, 1.12, skN), noiseMul: lerp(1.15, .85, skN), volley: true }; }
        else if (res === 'perfeito') { q = Math.max(q, lerp(.72, .92, skN)); mod = { speedMul: lerp(1.02, 1.22, skN), noiseMul: lerp(1.05, .6, skN), oppMissBoost: lerp(.06, .28, skN), misBoost: (1 - skN) * .1, perfect: true }; }
        // fora do verde: amarelo perde pouco, laranja bastante, vermelho erra muito (cedo = fraco, tarde = erra mais)
        else if (res === 'cedo') mod = { speedMul: lerp(.97, .6, amt), noiseMul: lerp(1.05, 1.8, amt), misBoost: (1 - skN) * .08 + amt * .2 };
        else mod = { speedMul: 1.04, noiseMul: lerp(1.15, 2, amt), misBoost: lerp(.05, .55, amt) };
        // distância da rede: do fundo o smash chega mais lento, menos preciso e erra mais
        const far = res === 'voleio' ? 0 : clamp((Math.abs(p.pos.z) - 3.5) / 3.5, 0, 1);
        if (far > .5) sw.meter.pos = 'DO FUNDO'; // a perda do smash do fundo é aplicada no golpe, igual para você e para a IA
        // posicionamento: parado embaixo da bola (com ela sobre o ombro direito) rende mais; longe dela, menos
        const ip = sw.meter.ideal;
        if (overhead && ip) {
          const fx = p.team === 0 ? 1 : -1;
          const dpos = Math.hypot(p.pos.x + .25 * fx - ip.x, p.pos.z - ip.z);
          if (dpos < .4) { q = Math.min(1, q + .1); mod.speedMul = (mod.speedMul || 1) * 1.06; mod.noiseMul = (mod.noiseMul || 1) * .8; sw.meter.pos = 'BEM POSICIONADO'; }
          else if (dpos > .9) {
            const e = Math.min(1.5, dpos - .9);
            q = Math.max(.1, q - e * .5); mod.noiseMul = (mod.noiseMul || 1) * (1 + e * 1.5); mod.speedMul = (mod.speedMul || 1) * (1 - e * .15);
            mod.misBoost = (mod.misBoost || 0) + e * .4; sw.meter.pos = 'MAL POSICIONADO';
          }
        }
      }
      // timing: o miolo do movimento (15%–60%) é perfeito; cedo/tarde demais perde, mas não zera
      // timing: o seu aperto comparado com a chegada da bola (o mesmo que o anel/sinal verde mostra)
      if (sw.meter && !mod.volley) mod.meterSmash = true;
      if (!sw.meter) mod.timing = p.isHuman && sw.pressT != null ? pressTiming(sw.pressT, TIMING_K[clamp((p.netHuman ? p.pdRemote : S.careerActive ? S.careerStars : S.settings.playerDiff) || 3, 1, 6) - 1]) : su < .15 ? lerp(.4, 1, su / .15) : su > .6 ? lerp(1, .4, clamp((su - .6) / .2, 0, 1)) : 1;
      if (sw.lob) { mod.lobPower = sw.lob.power; if (sw.lob.kick) mod.lobKick = true; }
      const r = doHit(p, sw.type, q, false, mod);
      if (!r.mis) noteTend(p, sw.type);
      perfShot(p, sw, r);
      // perfeito (mesmo com a barra invisível): ondinha verde no chão de quem bateu
      if (p.isHuman && !r.mis && ((sw.meter && sw.meter.res === 'perfeito' && !mod.volley) || (sw.lob && sw.lob.kick))) { const wp = { x: p.pos.x, z: p.pos.z }; greenWave(wp); if (NET.ev) NET.ev('wave', wp); }
      if (S.drill) S.drill.lastR = Object.assign({}, r, { meterRes: sw.meter ? sw.meter.res : null });
      if (sw.type === 'defesa' || sw.type === 'curta' || r.pressure > .2) defenseFeedback(r, c);
      // curta: diz se saiu boa e se o toque foi cedo ou tarde (o miolo do movimento é o ideal)
      const cw = sw.type === 'curta' && !r.mis && !r.pop && !r.wild ? (r.curtaK > .86 ? 'MATADORA' : r.curtaK >= .5 ? 'BOA' : 'LENTA') + (mod.timing < .9 ? (su < .15 ? ' · CEDO' : ' · TARDE') : '') + (p.dive ? ' · NO MERGULHO' : '') : '';
      ctlFeedback(c, r.label, cw || (r.mis ? 'ERROU A MÃO' : r.pop ? 'LEVANTOU' : r.wild ? 'DESCONTROLOU' : sw.meter ? (sw.meter.word || RES_WORD[sw.meter.res]) + (sw.meter.pos ? ' · ' + sw.meter.pos : '') : sw.lob ? sw.lob.word : qualityWord(q) + (r.backhand ? ' · BACKHAND' : '') + (r.contact ? ' · ' + r.contact : '') + (p.dive ? ' · NO MERGULHO' : '')), null);
    }
    if (p.isHuman && !sw.hit && !sw.meter && sw.t > sw.dur * .55 && sw.t < sw.dur * .8 && canHit(p, sw.type) && waitCloser(p, su, dt)) sw.t -= dt * .8; // segura a raquete armada
    sw.t += dt; if (sw.t >= sw.dur) { if (sw.meter && !sw.hit && S.mode === 'rally') { ctlFeedback(c, 'SMASH', 'FUROU', null); S.attempt = { p, hitId: S.hitId, hard: (ball.threat || 0) >= .4 }; } sw.t = -1; sw.meter = null; }
  }
}
function oppNearNet(team) { return $s.teams[1 - team].some(o => Math.abs(o.pos.z) < 3.2); }
function oppAllDeep(team) { return $s.teams[1 - team].every(o => Math.abs(o.pos.z) > 6.2); }
// jogada mais eficaz para a situação (posição, altura da bola, onde estão os adversários e os seus atributos)
function bestPlay(p, y) {
  const netD = Math.abs(p.pos.z), opp = $s.teams[1 - p.team], near = opp.filter(o => Math.abs(o.pos.z) < 3.4).length, deep = opp.filter(o => Math.abs(o.pos.z) > 5.4).length;
  if (y >= 2.1) return netD < 4 || attrK(p, 'smash') > .62 ? 'smash' : near && attrK(p, 'lob') > .6 ? 'lob' : 'defesa';
  if (y >= 1.45 && netD < 3.2) return 'smash';
  if (deep === opp.length && attrK(p, 'curta') > .5) return 'curta';
  if (near === opp.length && attrK(p, 'lob') > .6) return 'lob'; // lob só com lob bom (lob curto vira smash do outro lado)
  if (deep && near && attrK(p, 'curta') > .55 && netD < 4.5) return 'curta';
  return 'defesa';
}
function chooseAIShot(p, y) {
  const st = styleOf(p), r = Math.random();
  // quanto melhor a leitura de jogo (estrelas altas), mais vezes escolhe a jogada certa em vez do estilo/sorteio
  { const sp = clamp(((p.skill && p.skill.up) || 0) * 2.2, 0, .92); if (sp > 0 && Math.random() < sp) return bestPlay(p, y); } // só acima do padrão
  // estrelas baixas: bola alta vira devolução controlada na maioria das vezes (pouco smash)
  if (p.skill && p.skill.soft < 1 && y >= 1.45 && Math.random() < (1 - p.skill.soft) * 2.6) return Math.random() < .7 ? 'defesa' : 'lob';
  // decisão: quem lê bem o jogo não arrisca smash do fundo sem ter smash para isso (devolve e espera a bola certa)
  if (y >= 1.45 && p.skill && p.skill.up > 0 && Math.abs(p.pos.z) > 4.6 && Math.random() < p.skill.up * 2 * (1.3 - attrK(p, 'smash'))) return Math.random() < .6 ? 'lob' : 'defesa';
  if (y >= 2.1 && r < st.high) return 'smash';
  if (y >= 1.45 && y < 2.1 && Math.random() < st.mid) return 'smash'; // drive na meia altura
  if (p.team === 0 && S.settings.tactic === 'lobs' && y < 2.1 && Math.random() < .45) return 'lob';
  if (oppNearNet(p.team) && Math.random() < clamp(.4 * st.w.lob, .1, .85)) return 'lob';
  if (oppAllDeep(p.team) && Math.random() < clamp(.4 * st.w.curta, .1, .85)) return 'curta';
  // dupla: basta um adversário no fundo para a curta valer (mais ainda batendo perto da rede e com a bola baixa)
  if (dupla() && y < 1.7) {
    const deep = $s.teams[1 - p.team].filter(o => Math.abs(o.pos.z) > 5.4).length;
    if (deep && Math.random() < clamp((deep === 2 ? .34 : .18) * st.w.curta * (Math.abs(p.pos.z) < 4.5 ? 1.3 : .8), .05, .7)) return 'curta';
  }
  if (Math.hypot(ball.vel.x, ball.vel.z) > 14) return Math.random() < st.mid * .5 ? 'smash' : 'defesa';
  // bola baixa e lenta: a defesa (bola rasante) pesa mais
  const w = Object.assign({}, st.w, { defesa: st.w.defesa * (y < 1.45 ? 1.8 : 1.2) }), tot = w.smash + w.lob + w.curta + w.defesa; let r2 = Math.random() * tot;
  for (const k of ['defesa', 'lob', 'curta', 'smash']) { if ((r2 -= w[k]) <= 0) return k; }
  return 'defesa';
}
function chooseAIServe(p) {
  if (p.skill && p.skill.soft < 1 && Math.random() < .6) return 'defesa'; // estrelas baixas: saque por baixo, para começar o rali
  const lvl = p.team === 0 ? 'medio' : S.settings.diff;
  // no beach tennis quase todo saque é por cima (smash); lob e curto são raros
  const w = { facil: [.62, .05, .05, .28], medio: [.8, .04, .04, .12], dificil: [.88, .03, .03, .06] }[lvl];
  const types = ['smash', 'lob', 'curta', 'defesa']; let r = Math.random();
  const sw = styleOf(p).serve; const ww = sw ? w.map((v, i) => (v + sw[i]) / 2) : w;
  for (let i = 0; i < 4; i++) { if ((r -= ww[i]) <= 0) return types[i]; }
  return 'defesa';
}
// leitura do adversário: média móvel de quanto cada humano usa curta e lob na partida (zerada a cada partida)
function noteTend(p, type) {
  const t = p.mTend || (p.mTend = { c: .18, l: .22, n: 0 }), a = .14;
  t.c += ((type === 'curta' ? 1 : 0) - t.c) * a; t.l += ((type === 'lob' ? 1 : 0) - t.l) * a; t.n++;
}
// quanto a dupla adversária está abusando (0..1) de curta e de lob; só conta depois de alguns golpes
function oppTend(team) {
  let c = 0, l = 0;
  ($s.teams[1 - team] || []).forEach(o => { const t = o.mTend; if (!t || t.n < 5) return; c = Math.max(c, clamp((t.c - .22) / .3, 0, 1)); l = Math.max(l, clamp((t.l - .28) / .32, 0, 1)); });
  return { c, l };
}
// CPU acima do padrão que já leu o vício do adversário sai mais rápido para a curta/o lob que ele esperava
function expectK(o, key) {
  const up = (o.skill && o.skill.up) || 0; if (up <= 0 || (key !== 'curta' && key !== 'lob')) return 1;
  const t = oppTend(o.team); return 1 - (key === 'curta' ? t.c : t.l) * clamp(up * 3, 0, 1) * .45;
}
function homeOf(p) {
  const s = p.team === 0 ? 1 : -1;
  const hz = styleOf(p).home;
  // estrelas altas: quem lê o jogo não fica plantado no fundo (onde a curta mata); no Lendário fica perto dos 4,4 m
  // cada estilo mantém o seu jeito (paredão mais atrás, voleador na rede), só que sem exagero; e, quando o adversário vai bater
  // perto da rede ou numa bola baixa (cheiro de curta), dá um passo à frente
  const up = (p.skill && p.skill.up) || 0, deepMax = lerp(6.3, 5.05, clamp(up * 2.5, 0, 1));
  let ahead = 0;
  // dificuldades acima do padrão se adaptam: muita curta → joga mais à frente; muito lob → recua para cobrir o fundo
  const ad = up > 0 ? oppTend(p.team) : { c: 0, l: 0 }, adK = clamp(up * 3, 0, 1), adZ = (ad.l * .75 - ad.c * .9) * adK;
  if (up > 0 && ball.state === 'live' && S.lastTeam === p.team) { const opp = $s.teams[1 - p.team] || [], l = predictLanding(); if (opp.some(o => Math.abs(o.pos.z) < 3.6) || Math.abs(l.z) < 3.4) ahead = clamp(up * 2.4, 0, 1) * (.7 + ad.c * adK * .35) * (1 - ad.l * adK * .5); }
  if (!dupla()) return [clamp(ball.pos.x * .35, -1.5, 1.5), s * (clamp(Math.min(deepMax + .2, clamp((S.settings.diff === 'dificil' && p.team === 1 ? 4.6 : 5.2) + hz * (1 - clamp(up, 0, .4)), 3.4, 6.4)) + adZ, 3.3, 6.6) - ahead)];
  // dupla como elástico: os dois deslizam para o lado de onde a próxima bola vai sair e ficam mais juntos;
  // o parceiro também acompanha a posição real do companheiro
  const fx = ball.state === 'live' ? clamp(predictLanding().x, -C.halfW, C.halfW) : ball.pos.x;
  const center = clamp(fx * .5, -1.7, 1.7), hw = 1.8 - Math.abs(center) * .18;
  let x = center + p.slot * hw;
  const mate = $s.teams[p.team].find(o => o !== p);
  if (mate) { const want = mate.pos.x + Math.sign(p.slot - mate.slot || p.slot) * hw * 2; x = lerp(x, want, mate.isHuman ? .55 : .35); }
  return [clamp(x, -C.halfW + .3, C.halfW - .3), s * (clamp(Math.min(deepMax, clamp(4.6 + hz * (1 - clamp(up, 0, .4)), 3.3, 6.2)) + adZ, 3.2, 6.5) - ahead)];
}
// recepção em dupla: a dupla se ajeita conforme o sacador; quem está na diagonal fecha o meio
function receiveX(p) {
  const sp = S.serverPlayer; if (!sp || !dupla()) return p.slot * 1.9;
  const center = clamp(sp.pos.x * .4, -1.2, 1.2), hw = 1.6;
  return clamp(center + p.slot * hw, -C.halfW + .4, C.halfW - .4);
}
function updateAI(p, dt) {
  if (S.drill && p.team === 1) { // no treino o professor só lança: faz o golpe e solta a bola no contato, não rebate
    p.vel.set(0, 0, 0);
    if (p.swing.t >= 0) {
      p.swing.t += dt;
      if (p.feed && p.swing.t >= p.swing.dur * .45) {
        const f = p.feed; p.feed = null; p.swing.hit = true;
        ball.pos.copy(f.pos); ball.vel.copy(f.vel); ball.gk = f.gk; ball.finisher = f.finisher; ball.threat = f.finisher ? 1 : 0; ball.kick = false; ball.apex = f.apex; ball.prev = null; ball.state = 'live';
        p.contact = { x: f.pos.x, y: f.pos.y, z: f.pos.z, u: .45, hitId: S.hitId };
      }
      if (p.swing.t >= p.swing.dur) p.swing.t = -1;
    }
    return;
  }
  const D = skillOf(p);
  let [tx, tz] = homeOf(p);
  if (S.mode === 'serve' || S.mode === 'toss') {
    tx = p.team !== S.server && dupla() ? receiveX(p) : p.pos.x; tz = p.pos.z;
    // quem recebe espera na linha dos 3 m e, no lançamento do saque, recua um passo para cobrir o saque fundo
    if (S.mode === 'toss' && p.team !== S.server) tz = (p.team === 0 ? 1 : -1) * (ZONE3 + 1.1);
    if (proMascHold(p)) { tz = (p.team === 0 ? 1 : -1) * Math.max(Math.abs(tz), 5.3); if (Math.abs(p.pos.z) < 5.05) p.pos.z = (p.team === 0 ? 1 : -1) * 5.05; }
  }
  if (S.serverPlayer === p && ((S.mode === 'toss' && p.tossT > (p.tossDur || TOSS_T) * .74) || p.pendingServe)) {
    tz = p.pos.z + (p.team === 0 ? -1 : 1) * .8;
    if (!p.serveJumped) { p.serveJumped = true; startJump(p, .55, .34); }
  }
  if (S.mode === 'rally' && ball.state === 'live' && S.lastTeam === 1 - p.team) {
    if (p.ai.reactT > 0) { p.ai.reactT -= dt; tx = p.pos.x; tz = p.pos.z; }
    else if (assignee(p.team) === p) {
      if (p.ai.planId !== S.hitId) {
        p.ai.planId = S.hitId;
        p.ai.plan = planIntercept(p, D.speed, 0);
        const fast = Math.hypot(ball.vel.x, ball.vel.z) > 15;
        // bola difícil de verdade: muito rápida (pesa a defesa de cada um) ou que obriga a esticar / correr no limite
        let hardK = 0;
        { const sp = Math.hypot(ball.vel.x, ball.vel.z), pl = p.ai.plan;
          hardK += clamp((sp - 16) / 8, 0, 1) * lerp(.22, .06, attrK(p, 'def'));
          if (pl) { const dd = Math.hypot(pl.pt.x - p.pos.x, pl.pt.z - p.pos.z), need = Math.max(0, dd - .9) / (D.speed * Math.max(.05, pl.t - D.react)); hardK += clamp((need - .8) / .4, 0, 1) * .15; if (!pl.ok) hardK += .3; p.ai.stretch = !pl.ok || need > .95; } else p.ai.stretch = true;
          // defesa fraca sofre com bola rápida/finalização; backhand fraco sofre quando a bola vem do lado dele
          hardK += weakK(p, 'def') * (sp > 15 || ball.finisher ? .16 : .05);
          if (pl && pl.pt.y < 2 && sideOf(p, pl.pt) < -.15) hardK += weakK(p, 'backhand') * .16 + (1 - attrK(p, 'backhand')) * .06; // bola no backhand: erra mais quanto pior o backhand
          // lob chutado perfeito por cima de quem estava na frente dos 3 m: corre para trás e chega mal
          p.ai.kickBeat = !!ball.kick && Math.abs(p.pos.z) < 3.6;
          if (p.ai.kickBeat) hardK += lerp(.38, .22, attrK(p, 'vel'));
          if (S.rally === 1) hardK *= .5; }
        // pressão do ponto decisivo pesa mais em quem tem menos nível; time embalado erra menos
        const expK = clamp((overall(p.char ? p.char.a : { forca: 70, vel: 70, def: 70, backhand: 70, curta: 70, lob: 70, smash: 70, saque: 70 }) - 60) / 35, 0, 1);
        hardK += (S.pressure ? (1 - expK) * .06 : 0) - momentum(p.team) * .03;
        p.ai.willMiss = Math.random() < hardK + D.miss * (fast ? (S.rally === 1 ? .9 : 1.6) : 1) + (ball.oppMiss || 0) * (S.rally === 1 ? .5 : 1) + (p.ai.shot === 'smash' ? (1 - attrK(p, 'smash')) * .12 : 0) + (p.ai.shot === 'smash' || (p.ai.plan && p.ai.plan.pt.y >= 2.1) ? clamp(((ball.apex || 0) - 5.5) / 4, 0, 1) * .12 : 0);
        p.ai.shot = chooseAIShot(p, p.ai.plan ? p.ai.plan.pt.y : ball.pos.y);
        if (p.ai.kickBeat && p.ai.shot === 'smash' && Math.random() < .7) p.ai.shot = Math.random() < .5 ? 'lob' : 'defesa'; // recuando, quase sempre só devolve
        p.ai.swung = false;
        const land = predictLanding();
        // deixar a bola que vai sair: leitura de jogo (estrelas) + noção de jogo; no topo, julga até bolas rente à linha e nunca pega bola fora
        const rd = clamp((D.up || 0) * 2.2, 0, 1) * lerp(.55, 1, attrK(p, 'leitura')), marg = lerp(.35, .05, rd);
        const out = Math.abs(land.x) > C.halfW + marg || Math.abs(land.z) > C.halfL + marg;
        p.ai.letGo = out && Math.random() < (rd >= .9 ? 1 : lerp(D.letGo, 1, rd));
      }
      if (p.ai.letGo) { tx = p.pos.x; tz = p.pos.z; }
      else {
        if (p.ai.plan) { tx = p.ai.plan.pt.x + .35 * (p.team === 1 ? 1 : -1); tz = p.ai.plan.pt.z; }
        const shot = p.ai.shot;
        // arma o golpe quando a bola se aproxima
        if (!p.ai.swung && p.swing.t < 0 && Math.hypot(ball.pos.x - p.pos.x, ball.pos.z - p.pos.z) < 2.6 && ball.pos.y < 3.4) {
          p.ai.swung = true; p.swing.dur = shot === 'curta' ? .5 : SWING_DUR; p.swing.t = 0; p.swing.type = shot; p.swing.hit = false; p.swing.side = sideOf(p, p.ai.plan ? p.ai.plan.pt : null); p.swing.var = swingVar(shot, p.ai.plan ? p.ai.plan.pt.y : ball.pos.y, p);
        }
        if ((shot === 'smash' && ball.pos.y >= 1.9 ? canHit(p, 'smash', .66) : canHit(p, 'defesa', .9)) && !(shot !== 'smash' && ball.pos.y > .6 && ball.vel.y > -4 && waitCloser(p, 0, dt) && p.swing.t >= 0 && p.swing.t < p.swing.dur * .7)) { // espera a bola chegar perto do corpo
          // erro: quase sempre a bola vai na rede/fora; furar (raquete passa e a bola segue) só chegando no limite
          // erro quase sempre é bola na rede/fora; furar (raquete passa e a bola segue) só esticando no limite numa bola difícil
          if (p.ai.willMiss && !(p.ai.stretch && Math.random() < .55)) { const st = styleOf(p); const r = doHit(p, shot, rand(D.q[0], D.q[1]) * .8, false, { speedMul: st.speed, noiseMul: st.noise * 1.4, misBoost: 1 }); shotFeedback(whoTag(p) + r.label, 'ERROU', whoKind(p)); }
          else if (p.ai.willMiss) { p.swing.hit = true; p.ai.letGo = true; S.attempt = { p, hitId: S.hitId, hard: (ball.threat || 0) >= .4 || Math.hypot(ball.vel.x, ball.vel.z) > 14 || !!ball.finisher || !!(S.lastHit && S.lastHit.cat === 'smash') }; }
          else {
            const st = styleOf(p);
            const sf = D.soft || 1, soft = sf < 1;
            const r = doHit(p, shot, clamp(rand(D.q[0], D.q[1]) + momentum(p.team) * .05, 0, 1), false, Object.assign({ speedMul: st.speed * (D.pw || 1) * sf, noiseMul: st.noise }, shot === 'lob' ? (!soft && oppNearNet(p.team) && Math.random() < attrK(p, 'lob') * .25 ? { lobPower: .25, lobKick: true } : { lobPower: soft ? rand(.35, .6) : st.lobHigh ? rand(.72, 1) : oppNearNet(p.team) ? rand(.65, .98) : rand(.3, .95) }) : {}));
            shotFeedback(whoTag(p) + r.label, r.pop ? 'LEVANTOU' : r.wild ? 'DESCONTROLOU' : null, whoKind(p));
          }
        }
      }
    }
  }
  const lowB = p.ai.plan && p.ai.planId === S.hitId && p.ai.plan.pt.y < 1;
  moveToward(p, tx, tz, D.speed * (1 + shortK(p) * (lowB ? .1 : .03)), dt);
  p.pos.addScaledVector(p.vel, dt);
  clampPos(p);
  if (p.swing.t >= 0) {
    p.swing.t += dt;
    if (p.pendingServe && p.swing.t >= p.swing.dur * .45) {
      const ps = p.pendingServe; p.pendingServe = null;
      ball.state = 'live'; S.mode = 'rally';
      // CPU/parceira: de vez em quando o saque sai perfeito (mais com atributo de saque alto): mais forte, preciso e com estrelinhas
      const sf = (p.skill && p.skill.soft) || 1, svN = attrK(p, 'saque'), perf = sf >= 1 && ps.type === 'smash' && Math.random() < .06 + .16 * svN, sp = ball.pos.clone();
      const r = doHit(p, ps.type, ps.q, true, perf ? { speedMul: lerp(1, 1.12, svN), noiseMul: lerp(.85, .6, svN), perfect: true } : sf < 1 ? { speedMul: sf * .9 } : undefined); // estrelas baixas: saque sem força
      if (perf && !r.mis) { sparkle(sp); if (NET.ev) NET.ev('spark', sp); }
      shotFeedback(whoTag(p) + r.label, perf ? 'PERFEITO' : null, whoKind(p));
    }
    if (!p.swing.hit && !p.pendingServe && p.swing.t > p.swing.dur * .3) p.swing.t = p.swing.dur * .3; // segura armado até a bola chegar
    if (p.swing.t >= p.swing.dur) p.swing.t = -1;
  }
}

export { expectK, localInput, tacticAim, receiveX, aiAim, assignee, charSkill, chooseAIServe, gapX, humanPlan, playStyleOf, updateAI, updateHuman };
