// @ts-nocheck
// inteligência artificial: planejamento, estilos, escolha de golpes
import './15-carreira-telas';
import { $s } from '../state';
import { staMul, bCurve, C, DIFF, PLAY_STYLES, P_SPEED, SWING_DUR, TOSS_T, ZONE3, attrK, attrN, attrOf, velMul, accOf, accelStep, runTime, backZ, backAcc, runDist, BACK_ACC, gauss, bG, clamp, hScale, lerp, overall, rand, shortK, styleOf, weakK } from './00-base';
import { NET, S } from './01-estado';
import { swingVar } from './04-poses';
import { human } from './06-modelos';
import { ball, sparkle, greenWave } from './07-glb';
import { decisive, dupla, feedback, momentum, perfShot, shotFeedback } from './09-interface';
import { canHit, doHit, hitQuality, predictLanding, racketNearBall, smashReach } from './10-fisica';
import { TAC, defenseFeedback, qualityWord, skillOf, startJump, whoKind, whoTag } from './11-mira';
import { RES_WORD, ctlFeedback, keys, localCtl, touch, PAD } from './12-controles';
import { diveMark, puff } from './07-glb';
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
// ---------- parâmetros de decisão da CPU ----------
// AIP_BASE é o comportamento de sempre; AIP_TUNED vem do treino no simulador (ferramentas/treino/treinar.js), que
// faz a CPU jogar contra ela mesma milhares de pontos e guarda o conjunto que mais vence (IA Treinada do jogo rápido)
const AIP_BASE = { bestP: 2.2, smartAim: 2, gapDirect: 2.1, weakW: 8, errW: .35, bhAim: .7, lobNet: .55, lobAttr: .6, curtaBase: .5, curtaAttr: .6, curtaMid: .2,
  smashW: 1, defBase: .33, tie: .12, fav: .7, deepSmashAvoid: 2, deepMin: 5.05, ahead: .7, letGoMin: .05, serveSmash: .88, serveLob: .03, serveCurta: .03 };
const AIP_TUNED = Object.assign({}, AIP_BASE, { bestP: 2.407, smartAim: .651, gapDirect: 2.629, weakW: 4.919, errW: .147, bhAim: .763, lobNet: .377, lobAttr: .447, curtaBase: .243, curtaAttr: .363, curtaMid: .775, smashW: 1.262, defBase: .129, tie: .121, fav: .393, deepSmashAvoid: 0, deepMin: 4.63, ahead: .976, letGoMin: .237, serveSmash: .44, serveLob: .083, serveCurta: .002, aimMax: .535, bestMax: .905, homeShift: .122, homeHw: 1.713, homeZ: 4.427, rush: 1.432, recvHw: 1.537, recvZ: -.033, sideOff: .26, lobPow: .835, lobKickP: .317, d_smash: .149, d_defesa: .44, d_lob: .772, d_curta: .366, d_saque: .962, tLead: .219, tSmash: -.002, tServe: -.018 }); // treino: 66,2% contra a Lendária, 49,5% contra a versão anterior, 49,6% contra a Planejadora, 84,3% no verde
// pesos da busca da IA Planejadora (planShot): erro, saída pela linha, folga de chegada, contra-ataque, pressão, alcance e
// um bônus por golpe; thr: nota mínima para a busca assumir a jogada; PLN_TUNED também vem do treino
const PLN_BASE = { err: 2.2, out: 1.7, marg: .12, counter: 1, press: .16, reach: .85, bSmash: 0, bDef: 0, bCurta: 0, bLob: 0, bKick: 0, thr: .75 };
const PLN_TUNED = Object.assign({}, PLN_BASE, { thr: 1.079, err: .544, out: 1.602, marg: .211, counter: 2.042, press: .429, reach: .97, bSmash: .103, bDef: .189, bCurta: .094, bLob: -.14, bKick: -.049 }); // treino: 65,0% contra a Lendária, 48,7% contra a versão anterior, 49,7% contra a Treinada, 90,4% no verde
// modo de IA de cada jogador: só no jogo rápido (time adversário) ou no treino do simulador (S.simAI)
function aiModeOf(p) {
  if (S.simAI) return (S.simAI[p.team] || {}).mode || '';
  return p.team === 1 && !S.careerActive && !S.champActive && !NET.role ? S.settings.aiMode || '' : '';
}
const aiP = p => (S.simAI && (S.simAI[p.team] || {}).params) || (aiModeOf(p) ? AIP_TUNED : AIP_BASE);
// IA Treinada/Planejadora: o tempo do golpe é decisão dela (parâmetros tLead/tSmash/tServe do treino), com uma pequena
// imprecisão de execução; o resultado (verde, cedo, tarde) segue as mesmas faixas e efeitos do humano no nível médio
const timedAI = p => { const m = aiModeOf(p); return m === 'treinada' || m === 'planejadora'; };
const AI_MOTOR = .012, AI_ZONE = .068; // desvio do tempo de cada golpe (s); meia faixa verde do nível médio (como ZONE.medio)
function noteTiming(p, perfect) { const t = S.simStats; if (t) { t.n[p.team]++; if (perfect) t.perf[p.team]++; } }
function aiTiming(p, shot, q) {
  const A = aiP(p);
  if (shot === 'smash' && ball.pos.y >= 1.5) { // barra do smash
    const skN = Math.min(1, attrK(p, 'smash')), aN = Math.pow(attrN(p.char ? p.char.a.smash : 70), 1.5);
    const half = AI_ZONE * .8 * clamp(1.2 - ((ball.apex || 3.5) - 3.5) * .12, .45, 1.2) * clamp(aN, .12, 1.1) * (1 - .5 * clamp((Math.abs(p.pos.z) - 3.5) / 3.5, 0, 1));
    const diff = ((A.tSmash ?? 0) + gauss() * AI_MOTOR) / .75, amt = clamp((Math.abs(diff) - half) / (.2 * lerp(.45, 1.1, aN)), 0, 1);
    let res = Math.abs(diff) <= half ? 'perfeito' : diff < 0 ? 'cedo' : 'tarde';
    if (res === 'cedo' && ball.pos.y < 2.05) res = 'voleio';
    noteTiming(p, res === 'perfeito');
    if (res === 'voleio') return { q: Math.max(q, lerp(.66, .86, skN)), mod: { speedMul: lerp(1, 1.12, skN), noiseMul: lerp(1.15, .85, skN), volley: true } };
    if (res === 'perfeito') return { q: Math.max(q, lerp(.72, .92, skN)), mod: { speedMul: lerp(1.02, 1.22, skN), noiseMul: lerp(1.05, .6, skN), oppMissBoost: lerp(.06, .28, skN), misBoost: (1 - skN) * .1, perfect: true, meterSmash: true } };
    if (res === 'cedo') return { q, mod: { speedMul: lerp(.97, .6, amt), noiseMul: lerp(1.05, 1.8, amt), misBoost: (1 - skN) * .08 + amt * .2, meterSmash: true } };
    return { q, mod: { speedMul: 1.04, noiseMul: lerp(1.15, 2, amt), misBoost: lerp(.05, .55, amt), meterSmash: true } };
  }
  // demais golpes: o aperto antes da bola chegar (janela boa de 0,05 a 0,30 s, a mesma do humano)
  const timing = pressTiming((A.tLead ?? .175) + gauss() * AI_MOTOR);
  noteTiming(p, timing >= 1);
  return { q, mod: { timing } };
}
function aiServeTiming(p, type) {
  const A = aiP(p), a = p.char ? p.char.a : { saque: 70, lob: 70 }, svN = Math.min(1, attrN(a.saque)), sN = Math.pow(attrN(a.saque), 1.5);
  const half = AI_ZONE * ({ defesa: 1.5, lob: 1.3, curta: 1.2, smash: 1 }[type] || 1) * (type === 'lob' ? clamp(Math.pow(attrN((a.saque + attrOf(a, 'lob')) / 2), 1.9), .08, 1.1) * .7 : clamp(sN, .12, 1.15) * (type === 'smash' ? .45 : 1));
  const diff = ((A.tServe ?? 0) + gauss() * AI_MOTOR) / .9, amt = clamp((Math.abs(diff) - half) / (.2 * lerp(.45, 1.1, sN)), 0, 1);
  const res = Math.abs(diff) <= half ? 'perfeito' : diff < 0 ? 'cedo' : 'tarde';
  noteTiming(p, res === 'perfeito');
  if (res === 'perfeito') return { perfect: true, q: lerp(.88, 1, svN), mod: { speedMul: type === 'smash' ? lerp(1.1, 1.3, svN) : 1, noiseMul: lerp(.85, .55, svN), oppMissBoost: type === 'smash' ? .08 + .14 * svN : .03 * svN, misBoost: type === 'smash' ? lerp(.06, .035, svN) : .02, perfect: true } };
  if (res === 'cedo') return { q: lerp(.8, .45, amt), mod: { speedMul: amt < .6 ? lerp(.97, .9, amt / .6) : lerp(.9, .62, (amt - .6) / .4), noiseMul: lerp(1.1, 1.4, amt), misBoost: amt * .1 } };
  return { q: lerp(.72, .32, amt), mod: { speedMul: amt < .6 ? lerp(.97, .9, amt / .6) : lerp(.9, .8, (amt - .6) / .4), noiseMul: lerp(1.25, 1.8, amt), misBoost: lerp(.06, .5, amt) * (type === 'smash' ? 1 : .5) } };
}
const plnP = p => (S.simAI && (S.simAI[p.team] || {}).plan) || PLN_TUNED;
if (typeof window !== 'undefined') window.__pdoAI = { AIP_BASE, AIP_TUNED, PLN_BASE, PLN_TUNED, charSkill: p => charSkill(p), homeOf: p => homeOf(p), bestPlay: (p, y) => bestPlay(p, y), expectK: (o, k) => expectK(o, k) };
function charSkill(p) {
  if (!p.char) return p.team === 0 ? DIFF.medio : DIFF[S.settings.diff];
  const a = p.char.a, tech = (a.curta + a.lob + a.smash + a.def) / 400;
  // carreira: as estrelas mudam o nível dos adversários e do seu parceiro (todos jogam no nível escolhido)
  // estrelas: carreira (as da carreira) e online (o nível que o anfitrião escolheu para a CPU)
  const stars = S.tutorial ? 1 : S.careerActive ? (S.careerStars || 3) : NET.role ? (S.cpuLv || 3) : 0;
  let adj = stars ? [-.04, -.03, 0, .18, .38, .85][stars - 1] : p.team === 1 ? { facil: -.18, medio: 0, dificil: .1 }[S.settings.diff] || 0 : 0;
  if (aiModeOf(p)) adj = S.simAI && (S.simAI[p.team] || {}).adj != null ? S.simAI[p.team].adj : .5; // IA Treinada/Planejadora: leitura de jogo do Lendário
  else if (S.simAI) adj = 0;
  // o seu parceiro (CPU) acompanha as estrelas igual aos adversários (carreira e online)
  if (S.careerActive && S.careerRival && p.team === 1) adj += .06; // clássico contra rival: a CPU vem mais focada (reação e decisões)
  // nível em curva, de ~35 a ~95: 50 → .10, 60 → .24, 73 → .58, 80 → .75, 90 → .90
  const kb = clamp(1 / (1 + Math.exp(-(overall(a) - 70) / 9)), 0, 1);
  // estrelas: mudam a leitura de jogo (reação, posicionamento, escolha do golpe, não furar a bola);
  // a técnica (qualidade, força, erro do golpe) continua sendo a do atributo: um 60 no Lendário ainda erra smash do fundo
  const k = clamp(kb + adj, 0, 1.4), kt = clamp(kb + Math.min(adj, 0) + Math.max(0, adj) * (stars >= 5 ? .95 : .8), 0, 1.25);
  const dm = p.team === 1 && !stars && !S.simAI ? { facil: .92, medio: 1, dificil: 1.04 }[S.settings.diff] || 1 : 1;
  return {
    speed: P_SPEED * velMul(a.vel) * dm * (S.femPace ? .88 : 1), acc: accOf(a.vel) * dm * (S.femPace ? .85 : 1), react: Math.max(.04, lerp(.3, .09, k)) * styleOf(p).react * (S.careerActive && p.team === 0 && !p.isHuman ? 1 - .05 * (S.careerChem || 0) : 1), letGo: Math.min(.97, lerp(.3, .9, k)), // química: o parceiro reage mais rápido (a mira no buraco por nível, smart, fica desligada: o jogo e o treino são sem ela)
    miss: Math.max(.008, lerp(.15, .018, k)) * lerp(1.3, .7, a.def / 100), err: Math.max(.006, lerp(.2, .015, Math.pow(kt, .8))) * lerp(1.25, .8, tech) * styleOf(p).err, // níveis baixos erram bem mais na rede/fora
    q: [clamp(lerp(.42, .78, kt), .3, .9), clamp(lerp(.72, 1, kt), .5, 1)],
    pw: lerp(.84, 1, Math.min(1, kt)), // nível baixo: golpes mais fracos (não mais bolas furadas)
    netK: lerp(.8, .45, Math.min(1, kt)), // erro de nível baixo vai mais na rede que para fora
    // estrelas baixas (carreira): a CPU troca bola sem pancada — golpes mais lentos, quase sem smash forte, lob baixo e saque sem força
    k, up: Math.max(0, adj), // up: quanto as estrelas sobem acima do padrão (0 no padrão: nada muda)
    // tk: acerto do tempo (saque e smash no verde) pelas estrelas — 1 estrela erra muito, o Lendário quase não erra (o seu
    // parceiro da CPU acompanha)
    // sur: o susto com curta e lob (tempo a mais para reagir) pelas estrelas — até o Lendário leva um instante
    sur: stars ? [1.35, 1.2, 1.1, 1, .95, .9][stars - 1] : 1,
    tk: (() => { let t = stars ? [.35, .6, 1, 1.6, 2.3, 3.3][stars - 1] : p.team === 1 && !S.simAI ? { facil: .6, medio: 1, dificil: 1.4 }[S.settings.diff] || 1 : 1; return t; })(),
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
  const A = aiP(p);
  if (gm > A.gapDirect) return g;
  // alvo por peso: o mais fraco só vira foco com diferença grande de habilidade e/ou se estiver errando mais na partida
  const sk = o => (attrK(o, 'backhand') + attrK(o, 'def')) / 2, best = Math.max(...opp.map(sk)), errMin = Math.min(...opp.map(o => o.mErr || 0));
  const w = opp.map(o => 1 + Math.max(0, best - sk(o) - .1) * A.weakW + Math.min(3, ((o.mErr || 0) - errMin) * A.errW));
  let r = Math.random() * w.reduce((t, v) => t + v, 0), tgt = opp[0]; for (let i = 0; i < opp.length; i++) { if ((r -= w[i]) <= 0) { tgt = opp[i]; break; } }
  const dir = (tgt.team === 0 ? 1 : -1) * (tgt.lefty ? -1 : 1); // lado do forehand dele no eixo x
  // nem sempre o backhand: às vezes no corpo ou abrindo o forehand para variar
  const bh = Math.random() < A.bhAim ? -1 : Math.random() < .5 ? 0 : 1;
  return clamp(tgt.pos.x + bh * dir * rand(.6, 1.05), -lim, lim);
}
// profundidade treinada de cada golpe (0 = mais curto, 1 = mais fundo dentro do alcance do golpe); null = sorteio de sempre
function aiDepthK(p, shot) { const v = aiP(p)['d_' + shot]; return v == null ? null : v; }
function aiAim(p) {
  const st = styleOf(p), lim = C.halfW - .6;
  if (p.ai && p.ai.planAim != null) { const a = p.ai.planAim; p.ai.planAim = null; return clamp(a + rand(-.12, .12), -lim, lim); } // IA Planejadora: a mira escolhida na busca
  // curta cruzada: na diagonal de quem bate, bem aberta perto da lateral (a dupla do fundo corre na diagonal e chega tarde);
  // quanto mais estrelas, mais vezes
  { const up = skillOf(p).up || 0; if (p.ai && p.ai.shot === 'curta' && Math.random() < .25 + .45 * clamp(up * 2.5, 0, 1)) return clamp(-(Math.sign(p.pos.x) || (Math.random() < .5 ? 1 : -1)) * rand(.55, .95) * lim, -lim, lim); }
  { const up = skillOf(p).up || 0; if (up > 0 && Math.random() < Math.min(aiP(p).aimMax ?? .85, up * aiP(p).smartAim)) return smartAim(p); }
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
    vel.y -= bG() * dt; bCurve(vel, dt); pos.addScaledVector(vel, dt); t += dt;
    if (pos.y < C.ballR) break;
    if (pos.z * sgn < .3 || pos.y < .5 - .12 * shortK(p) || pos.y > 2.6 * hScale(p)) continue;
    const d = runDist(p.team, pos.x - p.pos.x, pos.z - p.pos.z); // para trás conta mais longe
    lastP = { pt: pos.clone(), t, ok: false };
    const back = (p.team === 0 ? pos.z > p.pos.z + .3 : pos.z < p.pos.z - .3), ac = (accOf(p.char ? attrOf(p.char.a, 'vel') : 70) * (S.femPace ? .85 : 1)) * (back ? BACK_ACC : 1);
    if (runTime(Math.max(0, d - .9), speed, ac) + react <= t) { // saindo parado: conta a arrancada
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
      // bola no meio: fica com quem pega de forehand (o combinado das duplas de beach tennis; ninguém fica esperando o outro)
      const fh = o => sideOf(o, { x: bx, z: zLine }) > 0, mid = Math.abs(bx - split) < .6;
      const side = mid && fh(a) !== fh(b) ? (fh(a) ? a : b) : Math.abs(bx - split) < .25 ? (Math.abs(bx - a.pos.x) < Math.abs(bx - b.pos.x) ? a : b) : (Math.sign(bx - split) === Math.sign(a.pos.x - split) ? a : b);
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
  if (d > .05) { const s = Math.min(maxSpeed, d * 5); vx = dx / d * s; vz = backZ(p.team, dz / d * s); }
  const acc = (skillOf(p).acc || (accOf(p.char ? attrOf(p.char.a, 'vel') : 70) * (S.femPace ? .85 : 1))) * (p.burst > 0 ? 1.6 : 1); // logo depois do split step a primeira passada é mais explosiva
  [p.vel.x, p.vel.z] = accelStep(p.vel.x, p.vel.z, vx, vz, dt, backAcc(p.team, vz, acc));
}
function receiving(p) {
  // até o saque ser batido ninguém passa da linha, só o sacador: quem recebe fica atrás dos 3 m; o parceiro do sacador atrás
  // dos 3 m no amador e dos 6 m no profissional.
  // Depois do saque todos podem avançar (senão a curta de saque seria impossível)
  return p !== S.serverPlayer && (S.mode === 'serve' || S.mode === 'toss');
}
function clampPos(p) {
  const lim = C.halfW + 3;
  p.pos.x = clamp(p.pos.x, -lim, lim);
  const minZ = receiving(p) ? (p.team === S.server ? S.zoneR || ZONE3 : ZONE3) + .05 : .4; // parceiro do sacador: linha dos 6 m no profissional
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
  if (S.sideWalk && S.mode === 'dead') return; // trocando de lado: a caminhada conduz
  const p = c.p, humanPlan = c.plan, s = p.team === 0 ? 1 : -1, opp = 1 - p.team;
  if (p.forceVel) { p.vel.copy(p.forceVel); p.pos.addScaledVector(p.vel, dt); return; } // (teste de animação: anda reto numa velocidade fixa)
  const [ix, iz] = c.remote ? [c.ix, c.iz] : localInput();
  const len = Math.hypot(ix, iz);
  p.inputX = ix; p.inputZ = iz;
  const lowBall = ball.state === 'live' && S.lastTeam === opp && humanPlan.plan && humanPlan.id === S.hitId && humanPlan.plan.pt.y < 1;
  if (p.diveRec > 0) p.diveRec = Math.max(0, p.diveRec - dt);
  const spd = P_SPEED * velMul(p.char ? attrOf(p.char.a, 'vel') : 70) * (S.femPace ? .88 : 1) * (1 + shortK(p) * (lowBall ? .1 : .03)) * (p.charging ? .75 : 1) * (1 - .45 * (p.diveRec || 0) / .8) * staMul(p); // depois do mergulho: começa a 55% e volta ao normal
  let tvx = ix * spd, tvz = iz * spd;
  if (p.dive) {
    p.dive.t += dt;
    if (p.dive.t < .28) { tvx = p.dive.dx * p.dive.spd; tvz = p.dive.dz * p.dive.spd; p.vel.x = tvx; p.vel.z = tvz; }
    else { tvx = 0; tvz = 0; p.vel.x *= .6; p.vel.z *= .6; if (!p.dive.landed) { p.dive.landed = true; puff(p.pos.x, p.pos.z, 26 + Math.round(18 * (p.dive.sev ?? 1)), .9, p.dive.dx, p.dive.dz, .6 + .4 * (p.dive.sev ?? 1)); if (p.dive.spd > 3) diveMark(p.pos.x, p.pos.z, p.dive.dx, p.dive.dz); } }
    if (p.dive.t >= p.dive.dur) { p.diveRec = p.dive.rec ?? .8; p.dive = null; } // levantou: ainda volta devagar (até ~0,8 s no peixinho)
  }
  const serving = S.serverPlayer === p && (S.mode === 'serve' || S.mode === 'toss');
  if (serving) {
    tvz = 0; if (S.mode === 'toss') tvx = 0;
    // pulo do saque: começa ~0,22 s antes do ponto ideal para o contato sair no alto do pulo (subindo em direção à bola)
    if (S.mode === 'toss' && p.tossT > (p.tossDur || TOSS_T) - .22 && S.serveType !== 'lob') { const st = p.srvSt || {}; tvz = -2.6 * s * (st.drive ?? 1); if (!p.serveJumped) { p.serveJumped = true; if ((st.jump ?? .34) > .02) startJump(p, .55, st.jump ?? .34); } } // saque por baixo: sem pulo; estilo: altura do pulo e avanço
  }
  if (p.pendingServe) { tvx = 0; tvz = -2.6 * s * ((p.srvSt && p.srvSt.drive) ?? 1); }
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
  // aceleração: arranca mais lento e vai ganhando velocidade; parar é rápido e trocar de direção custa uma passada
  // (logo depois do split step a primeira passada é mais explosiva)
  if (!p.dive) tvz = backZ(p.team, tvz); // para trás é mais lento
  [p.vel.x, p.vel.z] = accelStep(p.vel.x, p.vel.z, tvx, tvz, dt, backAcc(p.team, tvz, (accOf(p.char ? attrOf(p.char.a, 'vel') : 70) * (S.femPace ? .85 : 1)) * (p.burst > 0 && len > .1 ? 1.6 : 1)));
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
      if (!sw.meter) mod.timing = p.isHuman && sw.pressT != null ? pressTiming(sw.pressT, TIMING_K[clamp((p.netHuman ? p.pdRemote : S.tutorial ? 1 : S.careerActive ? S.careerStars : S.settings.playerDiff) || 3, 1, 6) - 1]) : su < .15 ? lerp(.4, 1, su / .15) : su > .6 ? lerp(1, .4, clamp((su - .6) / .2, 0, 1)) : 1;
      if (sw.lob) { mod.lobPower = sw.lob.power; if (sw.lob.kick) mod.lobKick = true; }
      const r = doHit(p, sw.type, q, false, mod);
      if (!r.mis) noteTend(p, sw.type);
      perfShot(p, sw, r);
      if (p.isHuman && !r.mis && sw.var === 'ventaglio' && S.perf) S.perf.ev.ventaglio = (S.perf.ev.ventaglio || 0) + 1; // conta para as conquistas
      // perfeito (mesmo com a barra invisível): ondinha verde no chão de quem bateu
      if (p.isHuman && !r.mis && ((sw.meter && sw.meter.res === 'perfeito' && !mod.volley) || (sw.lob && sw.lob.kick))) { const wp = { x: p.pos.x, z: p.pos.z }; greenWave(wp); if (NET.ev) NET.ev('wave', wp); }
      if (S.drill) S.drill.lastR = Object.assign({}, r, { meterRes: sw.meter ? sw.meter.res : null });
      if (sw.type === 'defesa' || sw.type === 'curta' || r.pressure > .2) defenseFeedback(r, c);
      // curta: diz se saiu boa e se o toque foi cedo ou tarde (o miolo do movimento é o ideal)
      const cw = sw.type === 'curta' && !r.mis && !r.pop && !r.wild ? (r.curtaK > .86 ? 'MATADORA' : r.curtaK >= .5 ? 'BOA' : 'LENTA') + (mod.timing < .9 ? (su < .15 ? ' · CEDO' : ' · TARDE') : '') + (p.dive ? ' · NO MERGULHO' : '') : '';
      ctlFeedback(c, r.label, cw || (r.whiff ? 'FUROU' : r.mis ? 'ERROU A MÃO' : r.pop ? 'LEVANTOU' : r.wild ? 'DESCONTROLOU' : sw.meter ? (sw.meter.word || RES_WORD[sw.meter.res]) + (sw.meter.pos ? ' · ' + sw.meter.pos : '') : sw.lob ? sw.lob.word : qualityWord(q) + (r.backhand ? ' · BACKHAND' : '') + (r.contact ? ' · ' + r.contact : '') + (p.dive ? ' · NO MERGULHO' : '')), null);
    }
    if (p.isHuman && !sw.hit && !sw.meter && sw.t > sw.dur * .55 && sw.t < sw.dur * .8 && canHit(p, sw.type) && waitCloser(p, su, dt)) sw.t -= dt * .8; // segura a raquete armada
    sw.t += dt; if (sw.t >= sw.dur) { if (sw.meter && !sw.hit && S.mode === 'rally') { ctlFeedback(c, 'SMASH', 'FUROU', null); S.attempt = { p, hitId: S.hitId, hard: (ball.threat || 0) >= .4 }; } sw.t = -1; sw.meter = null; }
  }
}
function oppNearNet(team) { return $s.teams[1 - team].some(o => Math.abs(o.pos.z) < 3.2); }
// colado na rede de verdade (quem está nos 3 m ainda chega no lob: contra ele vale mais acelerar, volear ou dar curta)
function oppGlued(team) { return $s.teams[1 - team].some(o => Math.abs(o.pos.z) < 2.6); }
// em apuros (0..1): bola baixa, esticado, lá no fundo, sob pancada/finalização ou encoberto por um lob — é quando o lob
// alto (bola de recuperação) faz sentido
function aiTrouble(p, y) {
  const sp = Math.hypot(ball.vel.x, ball.vel.z), ai = p.ai || {};
  return clamp(Math.max(y < .55 ? (.55 - y) / .35 : 0, ai.stretch ? .8 : 0, (Math.abs(p.pos.z) - 5.8) / 1.2, (sp - 15) / 6, ball.finisher ? .9 : 0, ai.kickBeat ? 1 : 0), 0, 1);
}
function oppAllDeep(team) { return $s.teams[1 - team].every(o => Math.abs(o.pos.z) > 6.2); }
// ---------- IA Planejadora: busca a melhor jogada ----------
// para cada golpe (smash, defesa, curta, lob alto, lob chutado) × mira (7 posições) × profundidade (2), estima:
// se algum adversário chega na bola a tempo (no caminho ou onde ela cai, pela posição, reação e velocidade de cada um),
// a chance de errar (golpe, atributos, distância da linha) e se a devolução fica fácil de atacar; fica com a de maior valor
function planShot(p, y) {
  const opp = $s.teams[1 - p.team]; if (!opp.length) return null;
  const dz = p.team === 0 ? -1 : 1, lim = C.halfW - .45, D = skillOf(p), st = styleOf(p);
  const from = p.ai && p.ai.plan ? p.ai.plan.pt : ball.pos, netD = Math.abs(p.pos.z);
  const at = k => attrK(p, k), q = (D.q[0] + D.q[1]) / 2, W = plnP(p);
  const cand = [];
  if (y >= 1.45) cand.push({ k: 'smash', b: W.bSmash, speed: 19 * lerp(.85, 1.1, at('forca')) * (D.pw || 1) * st.speed, depth: [4.6, 7.0], noise: .35, attr: 'smash', risk: 1.25 * (netD > 4.6 ? 1.6 : 1) * (y < 1.9 ? 1.1 : 1) });
  cand.push({ k: 'defesa', b: W.bDef, T: 1.2, depth: [4.3, 6.4], noise: .3, attr: 'def', risk: .75, float: true });
  cand.push({ k: 'curta', b: W.bCurta, T: .9, depth: [1.1, 2.5], noise: .35, attr: 'curta', risk: 1.35 * (netD > 6 ? 1.5 : 1) });
  cand.push({ k: 'lob', b: W.bLob, T: 2.4, depth: [6.4, 7.5], noise: .5, attr: 'lob', risk: .8, lob: .95, high: true });
  if (at('lob') > .55) cand.push({ k: 'lob', b: W.bKick, T: 1.15, depth: [6.5, 7.4], noise: .5, attr: 'lob', risk: 1.1, lob: .25, kick: true });
  const reachT = (o, x, z) => { const so = skillOf(o); return (so.react || .2) + runTime(Math.max(0, runDist(o.team, x - o.pos.x, z - o.pos.z) - W.reach), so.speed || P_SPEED, (so.acc || 12) * ((o.team === 0 ? z > o.pos.z + .3 : z < o.pos.z - .3) ? BACK_ACC : 1)); };
  let best = null;
  for (const c of cand) for (let i = 0; i < 7; i++) for (let j = 0; j < 2; j++) {
    const x = -lim + i * lim / 3, depth = c.depth[0] + (c.depth[1] - c.depth[0]) * (j ? .78 : .22), z = dz * depth;
    const T = c.T || Math.hypot(x - from.x, z - from.z) / c.speed;
    // quem chega: no ponto onde cai e (golpes baixos) no caminho, onde dá para voleiar
    let marg = -9;
    for (const o of opp) {
      marg = Math.max(marg, T - reachT(o, x, z));
      if (!c.high && !c.kick) for (const f of [.55, .75]) { const px = from.x + (x - from.x) * f, pz = from.z + (z - from.z) * f; if (Math.sign(pz) === dz) marg = Math.max(marg, T * f - reachT(o, px, pz) - .05); }
    }
    const pWin = 1 / (1 + Math.exp(marg / W.marg));
    // erro: base do golpe pelo nível + saída pela linha (mira perto da lateral ou do fundo, conforme a imprecisão)
    const sig = c.noise * (1.15 - q) * lerp(1.5, .55, at(c.attr)) + .05, mLine = Math.min(C.halfW - Math.abs(x), C.halfL - depth + .1);
    const pOut = 1 / (1 + Math.exp(W.out * mLine / sig)), pErr = Math.min(.9, (D.err || .03) * c.risk * W.err + pOut);
    // quando ele chega com folga numa bola que flutua (defesa) ou num lob curto, a devolução vem atacando
    const comfy = clamp(marg / .6, 0, 1), counter = W.counter * (c.float ? .18 : c.kick ? .05 : c.k === 'curta' ? .08 : .04) * comfy * (opp.some(o => Math.abs(o.pos.z) < 3.4) ? 1.4 : 1);
    const press = (1 - pWin) * W.press * (1 - comfy);
    const v = (1 - pErr) * (pWin + press - counter) - pErr + c.b + rand(0, .03);
    if (!best || v > best.v) best = { v, c, x, depth };
  }
  if (!best) return null;
  p.ai.planV = best.v; p.ai.planAim = best.x; p.ai.planDepth = best.depth; p.ai.planLob = best.c.lob != null ? best.c.lob : null; p.ai.planKick = !!best.c.kick;
  return best.c.k;
}
// jogada mais eficaz para a situação: dá nota a cada golpe olhando onde os adversários estão e para onde estão indo
// (quem vem subindo para a rede conta como já na rede), a altura da bola, a própria distância da rede e os atributos de quem bate
// e de quem recebe; grudou na rede → lob por cima; ficou no fundo → curta; bola alta perto da rede → smash
function bestPlay(p, y) {
  const netD = Math.abs(p.pos.z), opp = $s.teams[1 - p.team]; if (!opp.length) return 'defesa';
  const dPred = o => clamp(Math.abs(o.pos.z) + (o.vel ? -Math.sign(o.pos.z || 1) * o.vel.z : 0) * -.45, 0, 9); // indo para a rede encurta
  const ds = opp.map(dPred), dMin = Math.min(...ds), dMax = Math.max(...ds);
  const atNet = ds.map(d => clamp((3.3 - d) / 1.5, 0, 1)), tr = aiTrouble(p, y), dMid = clamp((dMin - 2.2) / 1.5, 0, 1) * clamp((5 - dMin) / 1.2, 0, 1), allNet = Math.min(...atNet), anyNet = Math.max(...atNet);
  const cover = clamp((dMax - 5.2) / 1.2, 0, 1) * (opp.length > 1 ? 1 : 0); // o parceiro do fundo cobre o lob
  const lobK = attrK(p, 'lob'), curK = attrK(p, 'curta'), smK = attrK(p, 'smash'), defK = attrK(p, 'def');
  const weakOH = Math.min(...opp.map(o => (attrK(o, 'smash') + attrK(o, 'vel')) / 2)); // lob contra quem não volta bem
  const A = aiP(p);
  const sc = {
    // chegando inteiro (sem apuro) e com só um adversário na rede, o lob perde para a bola neutra/acelerada
    lob: (opp.length > 1 ? Math.max(allNet, anyNet * (1 - cover * .8)) : anyNet) * (A.lobNet + lobK * A.lobAttr) * (1.15 - weakOH * .3) * (tr < .3 && allNet < .6 ? .5 : tr < .3 ? .8 : 1) - (y >= 2.1 && netD < 3.2 ? .5 : 0) + tr * .45, // (+ recuperação em apuros)
    // curta: boa contra quem está no fundo e ainda viável contra quem parou no meio (~3–4,5 m)
    curta: (clamp((dMin - 2.4) / 2.6, 0, 1) + A.curtaMid * clamp(1 - Math.abs(dMin - 3.6) / 1.2, 0, 1)) * (A.curtaBase + curK * A.curtaAttr) * clamp((7.2 - netD) / 3, .25, 1) * (y < 1.8 ? 1 : .6),
    smash: A.smashW * (y >= 2.1 ? 1 : y >= 1.45 ? .55 : .1) * clamp((7 - netD) / 3.5 + smK * .35, .15, 1.1) * (anyNet > .6 && y < 2.1 ? .75 : 1),
    defesa: A.defBase + defK * .1
  };
  // adversário nos 3 m, bola na meia altura e você bem posicionado: acelerada no pé (o drive) vale mais que o lob
  if (y >= .85 && y < 1.45 && tr < .4) sc.smash += .38 * dMid * (1 - tr);
  if (tr < .3 && y < 1.8) sc.curta *= 1.2; // confortável e bola baixa/média: curta (cruzada) é opção forte
  // bola confortável na meia altura: acelera ou joga neutro (defesa firme) em vez de levantar
  if (y >= .7 && y < 1.45 && tr < .3) { sc.smash += .2 * (1 - tr); sc.defesa += .12; }
  if (y >= 1.45 && netD > 4.6 && smK < .62) sc.smash *= .6;
  if (netD > 4.6 && allNet > .6 && lobK > .45) sc.smash *= .55; // do fundo contra quem está grudado na rede o smash volta no voleio: lob por cima // smash do fundo sem smash para isso: melhor devolver
  // duas (ou mais) jogadas quase igualmente boas (ex.: você nos 3 m — curta, lob ou bola no pé): decide o estilo de quem bate
  const top = Math.max(...Object.values(sc)), opts = Object.keys(sc).filter(k => sc[k] >= top - A.tie);
  if (opts.length === 1) return opts[0];
  // na maioria das vezes (~70%) o golpe preferido do estilo; no resto varia entre as outras boas opções
  const w = styleOf(p).w, fav = opts.reduce((a, k) => (w[k] || 0) > (w[a] || 0) ? k : a, opts[0]);
  if (Math.random() < A.fav) return fav;
  const rest = opts.filter(k => k !== fav); return rest[Math.floor(Math.random() * rest.length)];
}
function chooseAIShot(p, y) {
  if (aiModeOf(p) !== 'planejadora') return chooseShotRule(p, y);
  // IA Planejadora: a busca só assume quando enxerga uma bola quase vencedora; no resto, as regras treinadas
  // (no simulador, a busca sozinha perdia para as regras treinadas; só nas bolas decisivas ela soma)
  const pl = planShot(p, y); if (pl && p.ai.planV > plnP(p).thr) return pl;
  p.ai.planAim = p.ai.planDepth = p.ai.planLob = null; p.ai.planKick = false;
  return chooseShotRule(p, y);
}
function chooseShotRule(p, y) {
  const st = styleOf(p), r = Math.random();
  // quanto melhor a leitura de jogo (estrelas altas), mais vezes escolhe a jogada certa em vez do estilo/sorteio
  { const sp = clamp(((p.skill && p.skill.up) || 0) * aiP(p).bestP, 0, aiP(p).bestMax ?? .92); if (sp > 0 && Math.random() < sp) return bestPlay(p, y); } // só acima do padrão
  // estrelas baixas: bola alta vira devolução controlada na maioria das vezes (pouco smash)
  if (p.skill && p.skill.soft < 1 && y >= 1.45 && Math.random() < (1 - p.skill.soft) * 2.6) return Math.random() < .7 ? 'defesa' : 'lob';
  // decisão: quem lê bem o jogo não arrisca smash do fundo sem ter smash para isso (devolve e espera a bola certa)
  if (y >= 1.45 && p.skill && p.skill.up > 0 && Math.abs(p.pos.z) > 4.6 && Math.random() < p.skill.up * aiP(p).deepSmashAvoid * (1.3 - attrK(p, 'smash'))) return Math.random() < .6 ? 'lob' : 'defesa';
  if (y >= 2.1 && r < st.high) return 'smash';
  if (y >= 1.45 && y < 2.1 && Math.random() < st.mid) return 'smash'; // drive na meia altura
  if (p.team === 0 && S.settings.tactic === 'lobs' && y < 2.1 && Math.random() < .45) return 'lob';
  if ((oppGlued(p.team) || aiTrouble(p, y) > .6) && Math.random() < clamp(.4 * st.w.lob, .1, .85)) return 'lob'; // lob: por cima de quem colou na rede ou para se recuperar
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
  const A = aiP(p), w = aiModeOf(p) ? [A.serveSmash, A.serveLob, A.serveCurta, Math.max(.01, 1 - A.serveSmash - A.serveLob - A.serveCurta)] : ({ facil: [.62, .05, .05, .28], medio: [.8, .04, .04, .12], dificil: [.88, .03, .03, .06] }[lvl] || [.88, .03, .03, .06]);
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
// o companheiro vai bater smash nesta bola: você armando o smash, ou a CPU que escolheu smash, ou a bola chega alta nele
function mateSmash(m) {
  if (m.isHuman) return !!(m.charging && m.mtr ? m.mtr.type === 'smash' : m.charging) || (m.swing.t >= 0 && m.swing.type === 'smash') || (ball.apex || 0) > 3 && contactHigh(m);
  return (m.ai && m.ai.planId === S.hitId && m.ai.shot === 'smash') || (m.swing.t >= 0 && m.swing.type === 'smash');
}
function contactHigh(m) { const pl = m.ai && m.ai.planId === S.hitId ? m.ai.plan : planIntercept(m, skillOf(m).speed, 0); return !!pl && pl.pt.y >= 2.1; }
function homeOf(p) {
  const s = p.team === 0 ? 1 : -1;
  const hz = styleOf(p).home;
  // estrelas altas: quem lê o jogo não fica plantado no fundo (onde a curta mata); no Lendário fica perto dos 4,4 m
  // cada estilo mantém o seu jeito (paredão mais atrás, voleador na rede), só que sem exagero; e, quando o adversário vai bater
  // perto da rede ou numa bola baixa (cheiro de curta), dá um passo à frente
  const up = (p.skill && p.skill.up) || 0, deepMax = lerp(6.3, aiP(p).deepMin, clamp(up * 2.5, 0, 1));
  let ahead = 0;
  // dificuldades acima do padrão se adaptam: muita curta → joga mais à frente; muito lob → recua para cobrir o fundo
  const ad = up > 0 ? oppTend(p.team) : { c: 0, l: 0 }, adK = clamp(up * 3, 0, 1), adZ = (ad.l * .75 - ad.c * .9) * adK;
  if (up > 0 && ball.state === 'live' && S.lastTeam === p.team) { const opp = $s.teams[1 - p.team] || [], l = predictLanding(); if (opp.some(o => Math.abs(o.pos.z) < 3.6) || Math.abs(l.z) < 3.4) ahead = clamp(up * 2.4, 0, 1) * (aiP(p).ahead + ad.c * adK * .35) * (1 - ad.l * adK * .5); }
  if (!dupla()) return [clamp(ball.pos.x * .35, -1.5, 1.5), s * (clamp(Math.min(deepMax + .2, clamp((S.settings.diff === 'dificil' && p.team === 1 ? 4.6 : 5.2) + hz * (1 - clamp(up, 0, .4)), 3.4, 6.4)) + adZ, 3.3, 6.6) - ahead)];
  // dupla como elástico: os dois deslizam para o lado de onde a próxima bola vai sair e ficam mais juntos;
  // o parceiro também acompanha a posição real do companheiro
  const A = aiP(p), fx = ball.state === 'live' ? clamp(predictLanding().x, -C.halfW, C.halfW) : ball.pos.x;
  // fase do ponto (a dupla anda junta, como amarrada por uma corda):
  // · nosso lob fundo: o adversário vai bater lá do fundo, na defensiva → os dois sobem para fechar a rede
  // · nossa bola sobrou alta perto da rede deles (vai vir smash) → os dois recuam e abrem para defender
  // · bola nossa baixa/rápida no pé de quem está na rede → seguram a posição e fecham um pouco
  let ph = 0, wideK = 0;
  if (ball.state === 'live' && S.lastTeam === p.team && S.mode === 'rally') {
    const l = predictLanding(), lz = Math.abs(l.z), apex = ball.apex || 0;
    if (apex > 3.4 && lz > 5.2) ph = -clamp((lz - 5.2) / 1.6, 0, 1) * 1.25; // lob fundo: sobe
    else if (apex > 2.6 && lz < 4.2) { ph = clamp((apex - 2.6) / 1.2, 0, 1) * 1.05; wideK = .2; } // bola de smash para eles: recua e abre um pouco
    else if (apex < 2.2) ph = -.25; // pancada baixa: aperta
  }
  const center = clamp(fx * (A.homeShift ?? .5), -1.7, 1.7), hw = (A.homeHw ?? 1.8) - Math.abs(center) * .18 + wideK;
  let x = center + p.slot * hw;
  const mate = $s.teams[p.team].find(o => o !== p);
  if (mate) { const want = mate.pos.x + Math.sign(p.slot - mate.slot || p.slot) * hw * 2; x = lerp(x, want, mate.isHuman ? .55 : .35); }
  // o adversário vai bater: quem está na diagonal de quem bate fecha o meio (a paralela fica com quem está na frente dele);
  // quanto mais estrelas, mais fechado (o meio é o alvo preferido de quem ataca)
  if (ball.state === 'live' && S.lastTeam === p.team && S.mode === 'rally' && Math.abs(fx) > .5 && Math.sign(p.slot) !== Math.sign(fx)) x -= Math.sign(p.slot) * (.3 + .3 * clamp(up * 2.5, 0, 1));
  // o companheiro vai smashar: adianta um pouco e fecha o meio para pegar a sobra (a devolução de defesa curta/no meio)
  if (mate && ball.state === 'live' && S.lastTeam === 1 - p.team && S.mode === 'rally' && assignee(p.team) === mate && mateSmash(mate)) { ahead += .9 + .5 * clamp(up * 2.5, 0, 1); x = lerp(x, mate.pos.x + Math.sign(p.slot - mate.slot || p.slot) * 1.7, .5); }
  if (A.rush && ball.state === 'live' && S.lastTeam === p.team) ahead += A.rush; // depois do próprio golpe: sobe para a rede
  // formação escolhida para a sua dupla: o parceiro (CPU) fica colado na rede ou no fundo
  const fm = p.team === 0 && !p.isHuman ? S.settings.formation : '';
  if (fm === 'rede' || fm === 'fundo') return [clamp(x, -C.halfW + .3, C.halfW - .3), s * clamp((fm === 'rede' ? 2.6 : 6.0) + ph * .6, 2.3, 6.6)];
  return [clamp(x, -C.halfW + .3, C.halfW - .3), s * clamp(clamp(Math.min(deepMax, clamp((A.homeZ ?? 4.6) + hz * (1 - clamp(up, 0, .4)), 3.3, 6.2)) + adZ, 3.2, 6.5) - ahead + ph, 2.4, 6.6)];
}
// recepção em dupla: a dupla se ajeita conforme o sacador; quem está na diagonal fecha o meio
function receiveX(p) {
  const sp = S.serverPlayer; if (!sp || !dupla()) return p.slot * 1.9;
  const center = clamp(sp.pos.x * .4, -1.2, 1.2), hw = aiP(p).recvHw ?? 1.6;
  return clamp(center + p.slot * hw, -C.halfW + .4, C.halfW - .4);
}
function updateAI(p, dt) {
  if (S.sideWalk && S.mode === 'dead') return; // trocando de lado: a caminhada conduz
  if (p.forceVel) { p.vel.copy(p.forceVel); p.pos.addScaledVector(p.vel, dt); return; } // (teste de animação: anda reto numa velocidade fixa)
  if (S.drill && p.team === 1) { // no treino o professor só lança: faz o golpe e solta a bola no contato, não rebate
    p.vel.set(0, 0, 0);
    if (p.swing.t >= 0) {
      p.swing.t += dt;
      if (p.feed && p.swing.t >= p.swing.dur * .45) {
        const f = p.feed; p.feed = null; p.swing.hit = true;
        ball.pos.copy(f.pos); ball.vel.copy(f.vel); ball.gk = f.gk; ball.cx = ball.cz = 0; ball.finisher = f.finisher; ball.threat = f.finisher ? 1 : 0; ball.kick = false; ball.apex = f.apex; ball.prev = null; ball.state = 'live';
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
    if (S.mode === 'toss' && p.team !== S.server) tz = (p.team === 0 ? 1 : -1) * (ZONE3 + (aiP(p).recvZ ?? 1.1));
    if (proMascHold(p)) { tz = (p.team === 0 ? 1 : -1) * Math.max(Math.abs(tz), 5.3); if (Math.abs(p.pos.z) < 5.05) p.pos.z = (p.team === 0 ? 1 : -1) * 5.05; }
  }
  if (S.serverPlayer === p && S.serveType !== 'lob' && ((S.mode === 'toss' && p.tossT > (p.tossDur || TOSS_T) - .22) || p.pendingServe)) {
    const st = p.srvSt || {}; tz = p.pos.z + (p.team === 0 ? -1 : 1) * .8 * (st.drive ?? 1);
    if (!p.serveJumped) { p.serveJumped = true; if ((st.jump ?? .34) > .02) startJump(p, .55, st.jump ?? .34); }
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
          if (pl) { const dd = Math.hypot(pl.pt.x - p.pos.x, pl.pt.z - p.pos.z), need = runTime(Math.max(0, dd - .9), D.speed, D.acc || 15) / Math.max(.05, pl.t - D.react); hardK += clamp((need - .8) / .4, 0, 1) * .15; if (!pl.ok) hardK += .3; p.ai.stretch = !pl.ok || need > .95; } else p.ai.stretch = true;
          // defesa fraca sofre com bola rápida/finalização; backhand fraco sofre quando a bola vem do lado dele
          hardK += weakK(p, 'def') * (sp > 15 || ball.finisher ? .16 : .05);
          if (pl && pl.pt.y < 2 && sideOf(p, pl.pt) < -.15) hardK += weakK(p, 'backhand') * .16 + (1 - attrK(p, 'backhand')) * .06; // bola no backhand: erra mais quanto pior o backhand
          // lob por cima de quem estava colado na rede (chutado perfeito pesa mais): corre para trás e chega mal
          p.ai.kickBeat = !!ball.lobSev && !!ball.kickBeat && ball.kickBeat.includes(p);
          if (p.ai.kickBeat) hardK += lerp(.5, .32, Math.min(1, attrK(p, 'vel'))) * ball.lobSev;
          // defesa perfeita chegando em quem está perto da rede: bola tensa no corpo, voleio difícil
          if (ball.defPerf && Math.abs(p.pos.z) < 4) hardK += ball.defPerf * lerp(.42, .24, Math.min(1, (attrK(p, 'voleio') + attrK(p, 'def')) / 2));
          if (S.rally === 1) hardK *= .5; }
        // pressão do ponto decisivo pesa mais em quem tem menos nível; time embalado erra menos
        const expK = clamp((overall(p.char ? p.char.a : { forca: 70, vel: 70, def: 70, backhand: 70, curta: 70, lob: 70, smash: 70, saque: 70 }) - 60) / 35, 0, 1);
        hardK += (S.pressure ? (1 - expK) * .06 : 0) - momentum(p.team) * .03;
        p.ai.willMiss = Math.random() < hardK + D.miss * (fast ? (S.rally === 1 ? .9 : 1.6) : 1) + (ball.oppMiss || 0) * (S.rally === 1 ? .5 : 1) + (p.ai.shot === 'smash' ? (1 - attrK(p, 'smash')) * .12 : 0) + (p.ai.shot === 'smash' || (p.ai.plan && p.ai.plan.pt.y >= 2.1) ? clamp(((ball.apex || 0) - 5.5) / 4, 0, 1) * .12 : 0);
        p.ai.shot = chooseAIShot(p, p.ai.plan ? p.ai.plan.pt.y : ball.pos.y);
        if (p.ai.kickBeat && p.ai.shot === 'smash' && Math.random() < .7 * ball.lobSev) p.ai.shot = Math.random() < .5 ? 'lob' : 'defesa'; // recuando, quase sempre só devolve
        p.ai.swung = false;
        const land = predictLanding();
        // deixar a bola que vai sair: leitura de jogo (estrelas) + noção de jogo; no topo, julga até bolas rente à linha e nunca pega bola fora
        // a leitura tem erro (bem menor no topo) e uma folga pequena a favor de jogar; bola claramente fora quase nunca é buscada
        const rd = clamp((D.up || 0) * 2.2, 0, 1) * lerp(.55, 1, attrK(p, 'leitura')), lv = clamp(.5 * rd + .5 * clamp(D.k, 0, 1), 0, 1);
        const sig = lerp(.3, .04, lv), marg = lerp(.1, Math.min(.05, aiP(p).letGoMin), rd);
        const ex = Math.abs(land.x + gauss() * sig), ez = Math.abs(land.z + gauss() * sig);
        const out = ex > C.halfW + marg || ez > C.halfL + marg;
        p.ai.letGo = out && Math.random() > lerp(.2, 0, lv); // nível baixo às vezes vai na bola fora por instinto
      }
      if (p.ai.letGo) { tx = p.pos.x; tz = p.pos.z; }
      else {
        if (p.ai.plan) { tx = p.ai.plan.pt.x + (aiP(p).sideOff ?? .35) * (p.team === 1 ? 1 : -1); tz = p.ai.plan.pt.z; }
        const shot = p.ai.shot;
        // arma o golpe quando a bola se aproxima
        if (!p.ai.swung && p.swing.t < 0 && Math.hypot(ball.pos.x - p.pos.x, ball.pos.z - p.pos.z) < 2.6 && ball.pos.y < 3.4) {
          p.ai.swung = true; p.swing.dur = shot === 'curta' ? .5 : SWING_DUR; p.swing.t = 0; p.swing.type = shot; p.swing.hit = false; p.swing.side = sideOf(p, p.ai.plan ? p.ai.plan.pt : null); p.swing.var = swingVar(shot, p.ai.plan ? p.ai.plan.pt.y : ball.pos.y, p);
        }
        if ((shot === 'smash' && ball.pos.y >= 1.9 ? canHit(p, 'smash', .66) : canHit(p, 'defesa', .9)) && !(shot !== 'smash' && ball.pos.y > .6 && ball.vel.y > -4 && waitCloser(p, 0, dt) && p.swing.t >= 0 && p.swing.t < p.swing.dur * .7)) { // espera a bola chegar perto do corpo
          // erro: quase sempre a bola vai na rede/fora; furar (raquete passa e a bola segue) só chegando no limite
          // erro quase sempre é bola na rede/fora; furar (raquete passa e a bola segue) só esticando no limite numa bola difícil
          if (p.ai.willMiss && !(p.ai.stretch && Math.random() < .55)) { const st = styleOf(p); const r = doHit(p, shot, rand(D.q[0], D.q[1]) * .8, false, { speedMul: st.speed, noiseMul: st.noise * 1.4, misBoost: 1 }); shotFeedback(whoTag(p) + r.label, 'ERROU', whoKind(p)); }
          else if (p.ai.willMiss) { p.swing.hit = true; p.ai.letGo = true; S.attempt = { p, hitId: S.hitId, hard: (ball.threat || 0) >= .4 || (ball.defPerf || 0) > .5 || Math.hypot(ball.vel.x, ball.vel.z) > 14 || !!ball.finisher || !!(S.lastHit && S.lastHit.cat === 'smash') }; }
          else {
            const st = styleOf(p);
            const sf = D.soft || 1, soft = sf < 1, A = aiP(p);
            p.ai.depthK = aiDepthK(p, shot);
            // IA Treinada/Planejadora: escolhe o momento do golpe como o humano (barra do smash / aperto) e leva o mesmo resultado
            let q = clamp(rand(D.q[0], D.q[1]) + momentum(p.team) * .05, 0, 1), pm = null;
            if (timedAI(p)) { const tm = aiTiming(p, shot, q); q = tm.q; pm = tm.mod; pm.speedMul = (pm.speedMul || 1) * st.speed * (D.pw || 1) * sf; pm.noiseMul = (pm.noiseMul || 1) * st.noise; }
            // CPU padrão: smash no verde pela técnica (atributo de smash) e pelas estrelas; do fundo cai, mas pouco para os
            // grandes smashadores (tk: estrelas). 98 de smash: 1 estrela ~1 em 10, padrão ~3,5, Lendário ~9 (também do fundo);
            // um 85: 1 estrela ~0,6, padrão ~2, Lendário ~6
            else if (shot === 'smash' && ball.pos.y >= 1.5 && p.char) {
              const s01 = clamp(((p.char.a.smash || 70) - 70) / 28, 0, 1), back = clamp((Math.abs(p.pos.z) - 3.5) / 3.5, 0, 1), skN = Math.min(1, attrK(p, 'smash'));
              // Lendário: do fundo quase não perde o tempo (quem lê bem o jogo se ajeita antes de saltar)
              const tk = D.tk || 1, pg = Math.min(.9, (.05 + .3 * Math.pow(s01, 1.3)) * tk * (1 - .35 * back * (1 - .6 * s01) * (1 - .6 * clamp((tk - 1) / 2.3, 0, 1))));
              if (Math.random() < pg) { q = Math.max(q, lerp(.72, .92, skN)); noteTiming(p, true);
                pm = { speedMul: lerp(1.02, 1.22, skN) * st.speed * (D.pw || 1) * sf, noiseMul: lerp(1.05, .6, skN) * st.noise, oppMissBoost: lerp(.06, .28, skN), misBoost: (1 - skN) * .1, perfect: true, meterSmash: true }; }
            }
            // CPU padrão: tempo da defesa, curta e lob (o "anel verde" do humano) pelas estrelas e pelo atributo do golpe —
            // padrão ~3 em 10 na hora certa, 1 estrela ~1, Lendário ~9; fora do verde, perto dele (o nível já pesa na qualidade)
            else if (shot === 'defesa' || shot === 'curta' || shot === 'lob') {
              const aK = attrK(p, shot === 'defesa' ? 'def' : shot), pt = Math.min(.88, .3 * (D.tk || 1) * lerp(.7, 1.15, aK)), ok = Math.random() < pt;
              pm = { timing: ok ? 1 : rand(.6, .95) }; if (ok) noteTiming(p, true);
            }
            // altura do lob pela situação: em apuros, o alto (recuperação); contra quem colou na rede, chutado ou médio por cima;
            // no resto, médio
            // estrelas altas: o lob alto fica só para o apuro de verdade; confortável, lob baixo e rápido (chutado) ou médio-baixo
            const upL = clamp(((p.skill && p.skill.up) || 0) * 2.5, 0, 1);
            const trb = aiTrouble(p, ball.pos.y), lobSit = soft ? { lobPower: rand(.35, .6) } : trb > lerp(.5, .82, upL) ? { lobPower: rand(.8, 1) } : trb > .5 ? { lobPower: rand(.5, .72) } : trb < .3 ? { lobPower: rand(.22, .5) - .08 * upL, lobKick: Math.random() < .3 + attrK(p, 'lob') * .3 + .2 * upL }
              : oppGlued(p.team) ? (Math.random() < .25 + attrK(p, 'lob') * .45 + .15 * upL ? { lobPower: .25, lobKick: true } : { lobPower: rand(.3, .55) }) : { lobPower: rand(lerp(.45, .26, upL), lerp(.75, .55, upL)) };
            const r = doHit(p, shot, q, false, Object.assign({ speedMul: st.speed * (D.pw || 1) * sf, noiseMul: st.noise }, pm, shot === 'lob' ? (p.ai.planLob != null ? { lobPower: p.ai.planLob, lobKick: !!p.ai.planKick && Math.random() < .35 + attrK(p, 'lob') * .4 } : lobSit) : {}));
            p.ai.planLob = null; p.ai.planKick = false;
            shotFeedback(whoTag(p) + r.label, r.pop ? 'LEVANTOU' : r.wild ? 'DESCONTROLOU' : null, whoKind(p));
          }
        }
      }
    }
  }
  const lowB = p.ai.plan && p.ai.planId === S.hitId && p.ai.plan.pt.y < 1;
  moveToward(p, tx, tz, D.speed * (1 + shortK(p) * (lowB ? .1 : .03)) * staMul(p), dt); // cansado (stamina baixa): mais lento
  p.pos.addScaledVector(p.vel, dt);
  clampPos(p);
  if (p.swing.t >= 0) {
    p.swing.t += dt;
    if (p.pendingServe && p.swing.t >= p.swing.dur * .45) {
      const ps = p.pendingServe; p.pendingServe = null;
      ball.state = 'live'; S.mode = 'rally';
      // CPU/parceira: de vez em quando o saque sai perfeito (mais com atributo de saque alto): mais forte, preciso e com estrelinhas
      // tempo do saque pelas estrelas (tk): saque 97 → 1 estrela ~1 em 10 no verde, padrão ~2, Lendário ~7
      const sf = (p.skill && p.skill.soft) || 1, svN = attrK(p, 'saque'), upK = (p.skill && p.skill.tk) || 1, perf = ps.type === 'smash' ? Math.random() < Math.min(.85, (.06 + .16 * svN) * upK) : ps.type === 'lob' && Math.random() < Math.min(.8, (.03 + .14 * Math.pow((svN + attrK(p, 'lob')) / 2, 2)) * upK), sp = ball.pos.clone();
      p.ai.depthK = aiDepthK(p, 'saque');
      // IA Treinada/Planejadora: para a barra do saque como o humano (o verde vem do treino, não é garantido)
      const ts = timedAI(p) ? aiServeTiming(p, ps.type) : null;
      const r = ts ? doHit(p, ps.type, ts.q, true, ts.mod)
        : doHit(p, ps.type, ps.q, true, perf ? { speedMul: ps.type === 'smash' ? lerp(1.08, 1.26, svN) : 1, noiseMul: lerp(.85, .6, svN), oppMissBoost: ps.type === 'smash' ? .06 + .12 * svN : 0, perfect: true } : sf < 1 ? { speedMul: sf * .9 } : undefined); // estrelas baixas: saque sem força
      if ((ts ? ts.perfect : perf) && !r.mis) { sparkle(sp); if (NET.ev) NET.ev('spark', sp); }
      shotFeedback(whoTag(p) + r.label, (ts ? ts.perfect : perf) ? 'PERFEITO' : null, whoKind(p));
    }
    if (!p.swing.hit && !p.pendingServe && p.swing.t > p.swing.dur * .3) p.swing.t = p.swing.dur * .3; // segura armado até a bola chegar
    if (p.swing.t >= p.swing.dur) p.swing.t = -1;
  }
}

// lob: quem está do outro lado quase sempre é pego de surpresa e leva um instante para ler a bola subindo (mais no lob
// chutado); às vezes antecipa e já sai correndo — mais quem lê bem o jogo e quando o adversário vem abusando do lob
// a curta também: quem está no fundo leva um instante para perceber a bola morrendo (menos se você abusa dela); tudo
// escalado pelas estrelas (skill.sur), sem zerar no Lendário
function lobSurprise(o, kick, key) {
  const rd = attrK(o, 'leitura'), cu = key === 'curta', tl = cu ? oppTend(o.team).c : oppTend(o.team).l;
  if (Math.random() < clamp(.08 + .15 * rd + .35 * tl, 0, .5)) return 0; // antecipou
  return (cu ? .15 : .21 + (kick ? .11 : 0)) * (1 - .3 * rd) * ((o.skill && o.skill.sur) || 1) * rand(.8, 1.2);
}
export { lobSurprise, expectK, localInput, tacticAim, receiveX, aiAim, assignee, charSkill, chooseAIServe, gapX, humanPlan, playStyleOf, updateAI, updateHuman };
