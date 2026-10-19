// @ts-nocheck
// inteligência artificial: planejamento, estilos, escolha de golpes
import './15-carreira-telas';
import { $s } from '../state';
import { C, DIFF, PLAY_STYLES, P_SPEED, SWING_DUR, TOSS_T, ZONE3, attrK, bG, clamp, hScale, lerp, overall, rand, shortK, styleOf } from './00-base';
import { S } from './01-estado';
import { swingVar } from './04-poses';
import { human } from './06-modelos';
import { ball } from './07-glb';
import { dupla, feedback } from './09-interface';
import { canHit, doHit, hitQuality, predictLanding, racketNearBall, smashReach } from './10-fisica';
import { defenseFeedback, qualityWord, skillOf, startJump, whoKind, whoTag } from './11-mira';
import { RES_WORD, keys, touch } from './12-controles';
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
function charSkill(p) {
  if (!p.char) return p.team === 0 ? DIFF.medio : DIFF[S.settings.diff];
  const a = p.char.a, tech = (a.curta + a.lob + a.smash + a.def) / 400;
  const adj = p.team === 1 && !S.careerActive ? { facil: -.18, medio: 0, dificil: .1 }[S.settings.diff] || 0 : 0;
  const k = clamp((overall(a) - 50) / 45 + adj, 0, 1.1); // 50 → 0, 95 → 1
  const dm = p.team === 1 && !S.careerActive ? { facil: .92, medio: 1, dificil: 1.04 }[S.settings.diff] || 1 : 1;
  return {
    speed: (2.9 + a.vel * .022) * dm, react: lerp(.3, .09, k) * styleOf(p).react, smart: lerp(.3, .92, k), letGo: lerp(.3, .9, k),
    miss: lerp(.15, .025, k) * lerp(1.3, .7, a.def / 100), err: lerp(.11, .02, k) * lerp(1.3, .75, tech) * styleOf(p).err,
    q: [clamp(lerp(.42, .78, k), .3, .9), clamp(lerp(.72, 1, k), .5, 1)],
  };
}
function aiAim(p) {
  const st = styleOf(p), lim = C.halfW - .6;
  if (st.aimBody && Math.random() < st.aimBody) { const opp = $s.teams[1 - p.team].slice().sort((a, b) => Math.abs(a.pos.z) - Math.abs(b.pos.z))[0]; if (opp) return clamp(opp.pos.x + rand(-.35, .35), -lim, lim); }
  if (st.corners && Math.random() < .8) { const g = gapX(p.team, .2); return Math.sign(g || rand(-1, 1)) * Math.max(Math.abs(g), lim * .75); }
  if (Math.random() < skillOf(p).smart) return gapX(p.team, .5);
  return rand(-1, 1) * (C.halfW - 1);
}
// ---------- Planejamento (CPU, parceiro e assistência) ----------
function planIntercept(p, speed, react) {
  const pos = ball.pos.clone(), vel = ball.vel.clone(); const dt = .02; let t = 0; let lastP = null;
  const sgn = p.team === 0 ? 1 : -1;
  for (let i = 0; i < 260; i++) {
    vel.y -= bG() * dt; pos.addScaledVector(vel, dt); t += dt;
    if (pos.y < C.ballR) break;
    if (pos.z * sgn < .3 || pos.y < .5 - .12 * shortK(p) || pos.y > 2.6 * hScale(p)) continue;
    const d = Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z);
    lastP = { pt: pos.clone(), t, ok: false };
    if (Math.max(0, d - .9) / speed + react <= t) { lastP.ok = true; return lastP; }
  }
  return lastP;
}
const humanPlan = { id: -1, plan: null };
// qual dos dois do time vai na bola
function assignee(team) {
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
      const pa = planIntercept(a, skillOf(a).speed, 0), pb = planIntercept(b, skillOf(b).speed, 0);
      const score = pl => !pl ? 99 : pl.t + (pl.ok ? 0 : 5);
      const sa = score(pa), sb = score(pb);
      who = Math.abs(sa - sb) < .08 ? (Math.sign(ball.pos.x) === Math.sign(a.pos.x) ? a : b) : (sa < sb ? a : b);
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
  // só até o saque ser batido: depois quem recebe pode avançar (senão a curta de saque é impossível)
  return p.team !== S.server && (S.mode === 'serve' || S.mode === 'toss');
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
function updateHuman(dt) {
  const p = human; let ix = 0, iz = 0;
  if (keys.a || keys.arrowleft) ix -= 1; if (keys.d || keys.arrowright) ix += 1;
  if (keys.w || keys.arrowup) iz -= 1; if (keys.s || keys.arrowdown) iz += 1;
  ix += touch.x; iz += touch.z;
  const len = Math.hypot(ix, iz); if (len > 1) { ix /= len; iz /= len; }
  p.inputX = ix; p.inputZ = iz;
  const lowBall = ball.state === 'live' && S.lastTeam === 1 && humanPlan.plan && humanPlan.id === S.hitId && humanPlan.plan.pt.y < 1;
  const spd = P_SPEED * lerp(.82, 1.12, attrK(p, 'vel')) * (1 + shortK(p) * (lowBall ? .1 : .03)) * (p.charging ? .75 : 1);
  let tvx = ix * spd, tvz = iz * spd;
  if (p.dive) {
    p.dive.t += dt;
    if (p.dive.t < .28) { tvx = p.dive.dx * p.dive.spd; tvz = p.dive.dz * p.dive.spd; p.vel.x = tvx; p.vel.z = tvz; }
    else { tvx = 0; tvz = 0; p.vel.x *= .6; p.vel.z *= .6; if (!p.dive.landed) { p.dive.landed = true; puff(p.pos.x, p.pos.z, 14, .9); } }
    if (p.dive.t >= p.dive.dur) p.dive = null;
  }
  const serving = S.serverPlayer === human && (S.mode === 'serve' || S.mode === 'toss');
  if (serving) {
    tvz = 0; if (S.mode === 'toss') tvx = 0;
    if (S.mode === 'toss' && p.tossT > TOSS_T * .74) { tvz = -2.6; if (!p.serveJumped) { p.serveJumped = true; startJump(p, .55, .34); } }
  }
  if (p.pendingServe) { tvx = 0; tvz = -2.6; }
  if (S.settings.assistMove && len < .1 && S.mode === 'rally' && ball.state === 'live' && S.lastTeam === 1 && assignee(0) === human) {
    if (humanPlan.id !== S.hitId) { humanPlan.plan = planIntercept(p, P_SPEED * .6, 0); humanPlan.id = S.hitId; }
    if (humanPlan.plan) {
      const tx = humanPlan.plan.pt.x - .35, tz = humanPlan.plan.pt.z;
      const dx = tx - p.pos.x, dz = tz - p.pos.z, d = Math.hypot(dx, dz);
      if (d > .12) { const s = Math.min(P_SPEED * .6, d * 4); tvx = dx / d * s; tvz = dz / d * s; }
    }
  }
  // passo até o ponto de contato enquanto arma o golpe (encaixe, estilo FIFA/2K)
  const sw0 = p.swing;
  if (sw0.t >= 0 && !sw0.hit && S.mode === 'rally' && ball.state === 'live' && S.lastTeam === 1) {
    if (humanPlan.id !== S.hitId) { humanPlan.plan = planIntercept(p, P_SPEED * .6, 0); humanPlan.id = S.hitId; }
    const pl = humanPlan.plan;
    if (pl) {
      const rightS = p.lefty ? -1 : 1, over = sw0.type === 'smash' && pl.pt.y >= 1.9, back = !over && sw0.side < -.15;
      const ix2 = pl.pt.x - rightS * (over ? .25 : back ? -.6 : .7), iz2 = pl.pt.z + (over ? .15 : .25);
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
  if (serving && S.mode === 'serve') { p.pos.z = 8.6; p.pos.x = clamp(p.pos.x, -C.halfW + .1, C.halfW - .1); }
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
        if (sw.hold <= 0) { sw.hold = 0; sw.hit = true; feedback('SMASH', 'FORA DO ALCANCE', null); }
      }
    }
    const contact = fire || (overhead
      ? (su >= .29 && su <= .75 && (sw.meter ? smashReach(p) : racketNearBall(p, .42)))
      : (sw.t <= sw.dur * (sw.meter || sw.lob ? .9 : .8) && canHit(p, sw.type)));
    if (p.pendingServe && su >= .45) {
      const ps = p.pendingServe; p.pendingServe = null;
      ball.state = 'live'; S.mode = 'rally';
      const r = doHit(p, ps.type, ps.q, true, ps.mod);
      feedback(r.label, r.mis ? 'ERROU' : ps.word || RES_WORD[ps.res], null);
    } else if (!sw.hit && !p.pendingServe && S.mode === 'rally' && contact) {
      let q = hitQuality(p, sw.type), mod = {};
      if (sw.meter) {
        const { res, amt } = sw.meter;
        // atributo: com smash baixo, mesmo o perfeito sai mais fraco e às vezes erra
        const skN = clamp((p.char ? p.char.a.smash : 70) - 50, 0, 45) / 45;
        if (res === 'voleio') { q = Math.max(q, lerp(.66, .86, skN)); mod = { speedMul: lerp(1, 1.12, skN), noiseMul: lerp(1.15, .85, skN), volley: true }; }
        else if (res === 'perfeito') { q = Math.max(q, lerp(.72, .92, skN)); mod = { speedMul: lerp(1.02, 1.22, skN), noiseMul: lerp(1.05, .6, skN), oppMissBoost: lerp(.04, .22, skN), misBoost: (1 - skN) * .1 }; }
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
      if (!sw.meter) mod.timing = su < .15 ? lerp(.4, 1, su / .15) : su > .6 ? lerp(1, .4, clamp((su - .6) / .2, 0, 1)) : 1;
      if (sw.lob) mod.lobPower = sw.lob.power;
      const r = doHit(p, sw.type, q, false, mod);
      if (sw.type === 'defesa' || sw.type === 'curta' || r.pressure > .2) defenseFeedback(r);
      // curta: diz se saiu boa e se o toque foi cedo ou tarde (o miolo do movimento é o ideal)
      const cw = sw.type === 'curta' && !r.mis && !r.pop && !r.wild ? (r.curtaK > .8 ? 'MATADORA' : r.curtaK > .45 ? 'BOA' : 'LENTA') + (mod.timing < .9 ? (su < .15 ? ' · CEDO' : ' · TARDE') : '') + (p.dive ? ' · NO MERGULHO' : '') : '';
      feedback(r.label, cw || (r.mis ? 'ERROU A MÃO' : r.pop ? 'LEVANTOU' : r.wild ? 'DESCONTROLOU' : sw.meter ? (sw.meter.word || RES_WORD[sw.meter.res]) + (sw.meter.pos ? ' · ' + sw.meter.pos : '') : sw.lob ? sw.lob.word : qualityWord(q) + (r.backhand ? ' · BACKHAND' : '') + (r.contact ? ' · ' + r.contact : '') + (p.dive ? ' · NO MERGULHO' : '')), null);
    }
    sw.t += dt; if (sw.t >= sw.dur) { if (sw.meter && !sw.hit && S.mode === 'rally') { feedback('SMASH', 'FUROU', null); S.attempt = { p, hitId: S.hitId, hard: false }; } sw.t = -1; sw.meter = null; }
  }
}
function oppNearNet(team) { return $s.teams[1 - team].some(o => Math.abs(o.pos.z) < 3.2); }
function oppAllDeep(team) { return $s.teams[1 - team].every(o => Math.abs(o.pos.z) > 6.2); }
function chooseAIShot(p, y) {
  const st = styleOf(p), r = Math.random();
  if (y >= 2.1 && r < st.high) return 'smash';
  if (y >= 1.45 && y < 2.1 && Math.random() < st.mid) return 'smash'; // drive na meia altura
  if (oppNearNet(p.team) && Math.random() < clamp(.55 * st.w.lob, .12, .9)) return 'lob';
  if (oppAllDeep(p.team) && Math.random() < clamp(.4 * st.w.curta, .1, .85)) return 'curta';
  if (Math.hypot(ball.vel.x, ball.vel.z) > 14) return Math.random() < st.mid * .5 ? 'smash' : 'defesa';
  const w = st.w, tot = w.smash + w.lob + w.curta + w.defesa; let r2 = Math.random() * tot;
  for (const k of ['defesa', 'lob', 'curta', 'smash']) { if ((r2 -= w[k]) <= 0) return k; }
  return 'defesa';
}
function chooseAIServe(p) {
  const lvl = p.team === 0 ? 'medio' : S.settings.diff;
  // no beach tennis quase todo saque é por cima (smash); lob e curto são raros
  const w = { facil: [.62, .05, .05, .28], medio: [.8, .04, .04, .12], dificil: [.88, .03, .03, .06] }[lvl];
  const types = ['smash', 'lob', 'curta', 'defesa']; let r = Math.random();
  const sw = styleOf(p).serve; const ww = sw ? w.map((v, i) => (v + sw[i]) / 2) : w;
  for (let i = 0; i < 4; i++) { if ((r -= ww[i]) <= 0) return types[i]; }
  return 'defesa';
}
function homeOf(p) {
  const s = p.team === 0 ? 1 : -1;
  const hz = styleOf(p).home;
  if (!dupla()) return [clamp(ball.pos.x * .35, -1.5, 1.5), s * clamp((S.settings.diff === 'dificil' && p.team === 1 ? 4.6 : 5.2) + hz, 3.4, 6.4)];
  // dupla como elástico: os dois deslizam para o lado de onde a próxima bola vai sair e ficam mais juntos;
  // o parceiro também acompanha a posição real do companheiro
  const fx = ball.state === 'live' ? clamp(predictLanding().x, -C.halfW, C.halfW) : ball.pos.x;
  const center = clamp(fx * .5, -1.7, 1.7), hw = 1.8 - Math.abs(center) * .18;
  let x = center + p.slot * hw;
  const mate = $s.teams[p.team].find(o => o !== p);
  if (mate) { const want = mate.pos.x + Math.sign(p.slot - mate.slot || p.slot) * hw * 2; x = lerp(x, want, mate.isHuman ? .55 : .35); }
  return [clamp(x, -C.halfW + .3, C.halfW - .3), s * clamp(4.6 + hz, 3.3, 6.2)];
}
// recepção em dupla: a dupla se ajeita conforme o sacador; quem está na diagonal fecha o meio
function receiveX(p) {
  const sp = S.serverPlayer; if (!sp || !dupla()) return p.slot * 1.9;
  const center = clamp(sp.pos.x * .4, -1.2, 1.2), hw = 1.6;
  return clamp(center + p.slot * hw, -C.halfW + .4, C.halfW - .4);
}
function updateAI(p, dt) {
  const D = skillOf(p);
  let [tx, tz] = homeOf(p);
  if (S.mode === 'serve' || S.mode === 'toss') {
    tx = p.team !== S.server && dupla() ? receiveX(p) : p.pos.x; tz = p.pos.z;
    // quem recebe espera na linha dos 3 m e, no lançamento do saque, recua um passo para cobrir o saque fundo
    if (S.mode === 'toss' && p.team !== S.server) tz = (p.team === 0 ? 1 : -1) * (ZONE3 + 1.1);
  }
  if (S.serverPlayer === p && ((S.mode === 'toss' && p.tossT > TOSS_T * .74) || p.pendingServe)) {
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
          if (pl) { const dd = Math.hypot(pl.pt.x - p.pos.x, pl.pt.z - p.pos.z), need = Math.max(0, dd - .9) / (D.speed * Math.max(.05, pl.t - D.react)); hardK += clamp((need - .8) / .4, 0, 1) * .15; if (!pl.ok) hardK += .3; }
          if (S.rally === 1) hardK *= .5; }
        p.ai.willMiss = Math.random() < hardK + D.miss * (fast ? (S.rally === 1 ? .9 : 1.6) : 1) + (ball.oppMiss || 0) * (S.rally === 1 ? .5 : 1) + (p.ai.shot === 'smash' ? (1 - attrK(p, 'smash')) * .12 : 0) + (p.ai.shot === 'smash' || (p.ai.plan && p.ai.plan.pt.y >= 2.1) ? clamp(((ball.apex || 0) - 5.5) / 4, 0, 1) * .12 : 0);
        p.ai.shot = chooseAIShot(p, p.ai.plan ? p.ai.plan.pt.y : ball.pos.y);
        p.ai.swung = false;
        const land = predictLanding();
        const out = Math.abs(land.x) > C.halfW + .35 || Math.abs(land.z) > C.halfL + .35;
        p.ai.letGo = out && Math.random() < D.letGo;
      }
      if (p.ai.letGo) { tx = p.pos.x; tz = p.pos.z; }
      else {
        if (p.ai.plan) { tx = p.ai.plan.pt.x + .35 * (p.team === 1 ? 1 : -1); tz = p.ai.plan.pt.z; }
        const shot = p.ai.shot;
        // arma o golpe quando a bola se aproxima
        if (!p.ai.swung && p.swing.t < 0 && Math.hypot(ball.pos.x - p.pos.x, ball.pos.z - p.pos.z) < 2.6 && ball.pos.y < 3.4) {
          p.ai.swung = true; p.swing.dur = shot === 'curta' ? .5 : SWING_DUR; p.swing.t = 0; p.swing.type = shot; p.swing.hit = false; p.swing.side = sideOf(p, p.ai.plan ? p.ai.plan.pt : null); p.swing.var = swingVar(shot, p.ai.plan ? p.ai.plan.pt.y : ball.pos.y, p);
        }
        if (shot === 'smash' && ball.pos.y >= 1.9 ? canHit(p, 'smash', .66) : canHit(p, 'defesa', .9)) {
          if (p.ai.willMiss) { p.swing.hit = true; p.ai.letGo = true; S.attempt = { p, hitId: S.hitId, hard: Math.hypot(ball.vel.x, ball.vel.z) > 14 || !!ball.finisher || !!(S.lastHit && S.lastHit.cat === 'smash') }; }
          else {
            const st = styleOf(p);
            const r = doHit(p, shot, rand(D.q[0], D.q[1]), false, Object.assign({ speedMul: st.speed, noiseMul: st.noise }, shot === 'lob' ? { lobPower: st.lobHigh ? rand(.72, 1) : oppNearNet(p.team) ? rand(.65, .98) : rand(.3, .95) } : {}));
            feedback(whoTag(p) + r.label, r.pop ? 'LEVANTOU' : r.wild ? 'DESCONTROLOU' : null, whoKind(p));
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
      const r = doHit(p, ps.type, ps.q, true);
      feedback(whoTag(p) + r.label, null, whoKind(p));
    }
    if (!p.swing.hit && !p.pendingServe && p.swing.t > p.swing.dur * .3) p.swing.t = p.swing.dur * .3; // segura armado até a bola chegar
    if (p.swing.t >= p.swing.dur) p.swing.t = -1;
  }
}

export { receiveX, aiAim, assignee, charSkill, chooseAIServe, gapX, humanPlan, playStyleOf, updateAI, updateHuman };
