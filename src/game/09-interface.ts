// @ts-nocheck
// elementos da interface e placar
import './08-audio';
import { $s } from '../state';
import { C, HALF_W, ZONE3, nameOf, shortOf } from './00-base';
import { flagSVG } from '../flags';
import { S, NET } from './01-estado';
import { applyArena, cheerArena, confetti, linesGroup } from './03-cenario';
import { cpuA, cpuB, human, partner } from './06-modelos';
import { applyPlayerStyle, applyRackets, assignCharacters, ball, clearPrints, landRing, resetTrail } from './07-glb';
import { applyGfx, sndWhistle } from './08-audio';
import { handPos } from './11-mira';
import { MTR, applyCam } from './12-controles';
import { champBoardTitle, champIsFinal, champMatchEnded } from './13-campeonato';
import { crBoardTitle, crIsFinal, careerMatchEnded } from './14-carreira';
import { humanPlan, receiveX } from './16-ia';
// ---------- DOM ----------
const $ = id => document.getElementById(id);
const el = {
  menu: $('menu'), pause: $('pause'), over: $('over'), banner: $('banner'), bTitle: $('bTitle'), bSub: $('bSub'),
  fb: $('fb'), reach: $('reach'), btnCam: $('btnCam'), btnSnd: $('btnSnd'), golden: $('golden'),
  meter: $('meter'), mFill: document.querySelector('#meter .fill'), mZone: document.querySelector('#meter .zone'), mRes: document.querySelector('#meter .res'), mLbl: document.querySelector('#meter .lbl'),
  rowP: $('rowP'), rowC: $('rowC'), gP: $('gP'), gC: $('gC'), pP: $('pP'), pC: $('pC'), stick: $('stick'), knob: $('knob'),
};
const shotBtns = {};
document.querySelectorAll('.shot').forEach(b => { shotBtns[b.dataset.shot] = b; });
const isTouch = () => document.body.classList.contains('touch');
const dupla = () => S.settings.mode === 'dupla';
let bannerTimer = 0;
function banner(title, sub, ms, gold) {
  el.bTitle.textContent = title; el.bSub.textContent = sub || '';
  el.bTitle.classList.toggle('gold', !!gold);
  el.banner.classList.remove('hide');
  clearTimeout(bannerTimer);
  if (ms) bannerTimer = setTimeout(() => el.banner.classList.add('hide'), ms);
}
function hideBanner() { clearTimeout(bannerTimer); el.banner.classList.add('hide'); }
let fbTimer = 0;
function feedback(main, small, kind) {
  el.fb.innerHTML = ''; el.fb.append(main);
  if (small) { const s = document.createElement('small'); s.textContent = small; el.fb.append(s); }
  el.fb.classList.toggle('cpu', kind === 'cpu'); el.fb.classList.toggle('mate', kind === 'mate'); el.fb.classList.add('show');
  clearTimeout(fbTimer); fbTimer = setTimeout(() => el.fb.classList.remove('show'), 900);
}
// ---------- Placar ----------
const PT = ['0', '15', '30', '40'];
function renderBoard() {
  const sc = S.score;
  // "🏳 M. SPOTO / 🏳 N. GIANOTTI", como nas transmissões
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const pn = p => {
    if (!p.char) return 'CPU';
    const w = nameOf(p.char).trim().split(/\s+/), sur = shortOf(p.char);
    return '<span class="pl">' + flagSVG(p.char.pais) + (w.length > 1 ? '<span class="ini">' + esc(w[0][0].toUpperCase()) + '. </span>' : '') + esc(sur) + '</span>';
  };
  const tn = t => $s.teams[t].map(pn).join('<span class="sep"> / </span>');
  const key = tn(0) + '|' + tn(1);
  if (el.nmKey !== key) { el.nmKey = key; $('nmP').innerHTML = tn(0); $('nmC').innerHTML = tn(1); }
  const title = S.drill ? DRILLS[S.drill.kind].nome.toUpperCase() + ' · ' + S.drill.ok + '/' + DRILLS[S.drill.kind].goal + ' · BOLA ' + Math.min(S.drill.n + 1, DRILLS[S.drill.kind].max) + '/' + DRILLS[S.drill.kind].max : S.careerActive ? crBoardTitle() : S.champActive ? champBoardTitle() : '';
  $('sbTitle').textContent = title; $('sbTitle').hidden = !title;
  el.gP.textContent = sc.games[0]; el.gC.textContent = sc.games[1];
  el.pP.textContent = sc.tb ? sc.pts[0] : PT[Math.min(3, sc.pts[0])];
  el.pC.textContent = sc.tb ? sc.pts[1] : PT[Math.min(3, sc.pts[1])];
  el.rowP.classList.toggle('serving', S.server === 0);
  el.rowC.classList.toggle('serving', S.server === 1);
  el.golden.textContent = sc.stb ? 'SUPER TIE-BREAK' : sc.tb ? 'TIE-BREAK' : 'PONTO DE OURO';
  // sets já jogados (formato pro)
  const hs = sc.hist || [], pro = S.settings.format === 'pro';
  $('sP').innerHTML = hs.filter(h => h[2] !== 'stb').map(h => '<i class="' + (h[0] > h[1] ? 'w' : '') + '">' + h[0] + '</i>').join('');
  $('sC').innerHTML = hs.filter(h => h[2] !== 'stb').map(h => '<i class="' + (h[1] > h[0] ? 'w' : '') + '">' + h[1] + '</i>').join('');
  $('hSets').textContent = pro && hs.length ? 'SETS' : ''; $('hGames').textContent = sc.stb ? 'S.TIE' : pro ? hs.length + 1 + 'º SET' : 'GAMES';
  const dz = decisive();
  if (dz && !sc.tb) el.golden.textContent = dz;
  el.golden.hidden = !(sc.tb || isGolden() || dz);
  el.rowP.classList.toggle('hot', momentum(0) >= .66); el.rowC.classList.toggle('hot', momentum(1) >= .66);
  const wt = weatherText(); $('sbWeather').textContent = wt; $('sbWeather').hidden = !wt;
}
const isGolden = () => !S.score.tb && S.score.pts[0] === 3 && S.score.pts[1] === 3;
function rotateServe() { S.serverIdx[S.server]++; S.server = 1 - S.server; }
function awardPoint(w) {
  const sc = S.score, l = 1 - w; S.stats.pts[w]++;
  if (sc.tb) {
    sc.pts[w]++; S.tbPlayed++;
    const tgt = sc.stb ? 10 : 7; // super tie-break vai a 10
    if (sc.pts[w] >= tgt && sc.pts[w] - sc.pts[l] >= 2) {
      if (sc.stb) { sc.hist.push([sc.pts[0], sc.pts[1], 'stb']); sc.stbDone = true; S.matchWinner = w; return 'match'; }
      sc.games[w]++; return endSet(w);
    }
    if (S.tbPlayed % 2 === 1) rotateServe();
    return 'point';
  }
  sc.pts[w]++;
  if (sc.pts[w] >= 4) { // sem vantagem: no 40-40 o próximo ponto decide
    sc.games[w]++; sc.pts = [0, 0];
    const N = S.settings.games;
    rotateServe();
    if (sc.games[w] >= N && sc.games[w] - sc.games[l] >= 2) return endSet(w);
    if (sc.games[0] === N && sc.games[1] === N) { sc.tb = true; S.tbPlayed = 0; return 'tb'; }
    return 'game';
  }
  return 'point';
}
// fim de set: no formato "pro" (finais profissionais) são 2 sets a 6; 1 a 1 vai para o super tie-break
function endSet(w) {
  const sc = S.score;
  if (S.settings.format !== 'pro') { S.matchWinner = w; return 'match'; }
  sc.sets[w]++; sc.hist.push([sc.games[0], sc.games[1]]);
  if (sc.sets[w] >= 2) { S.matchWinner = w; return 'match'; }
  sc.games = [0, 0]; sc.pts = [0, 0]; sc.tb = false;
  if (sc.sets[0] === 1 && sc.sets[1] === 1) { sc.tb = true; sc.stb = true; S.tbPlayed = 0; return 'stb'; }
  return 'set';
}
// placar final em texto: "6–4 3–6 [10–8]" ou "4–2"
function scoreText() {
  const sc = S.score;
  if (sc.hist && sc.hist.length) return sc.hist.map(([a, b, k]) => k === 'stb' ? '[' + a + '–' + b + ']' : a + '–' + b).join(' ');
  return sc.games[0] + '–' + sc.games[1];
}
// ---------- estatísticas do jogo ----------
const CAT_NAME = { voleio: 'voleio', saque: 'saque', smash: 'smash', drive: 'drive', curta: 'curta', lob: 'lob', defesa: 'defesa' };
const CAT_WIN = { voleio: 'Voleio vencedor', smash: 'Smash vencedor', drive: 'Drive vencedor', curta: 'Curta vencedora', lob: 'Lob vencedor', defesa: 'Defesa vencedora' };
const FEM_CAT = { curta: 1, defesa: 1 };
// "de N. BURMAK" ou "seu"/"sua" quando é você
// "você" nos textos só fora do online (lá o texto do anfitrião também aparece para o convidado)
const isMe = p => !!p && p.isHuman && !p.netHuman && !NET.role;
// o time de cima: "da CPU" ou, no online 1×1, "de N. FULANO"
const oppHuman = () => ($s.teams[1] || []).find(p => p.netHuman);
const oppOf = () => { const o = oppHuman(); return o ? 'de ' + whoName(o) : 'da CPU'; };
const deP = (p, fem) => isMe(p) ? (fem ? 'sua' : 'seu') : 'de ' + whoName(p);
// "Smash vencedor de N. BURMAK" / "Seu smash vencedor"
const phrase = (noun, p, fem, tail) => (isMe(p) ? (fem ? 'Sua ' : 'Seu ') + noun.toLowerCase() : noun + ' de ' + whoName(p)) + (tail || '');
function statOf(p) { const k = $s.players.indexOf(p); if (!S.pstats) S.pstats = []; if (!S.pstats[k]) S.pstats[k] = { voleio: 0, saque: 0, smash: 0, drive: 0, curta: 0, lob: 0, defesa: 0, fe: 0, ue: 0 }; return S.pstats[k]; }
function whoName(p) {
  if (!p) return '?';
  if (isMe(p)) return 'você';
  if (!p.char) return 'CPU';
  const w = nameOf(p.char).trim().split(/\s+/);
  return (w.length > 1 ? w[0][0].toUpperCase() + '. ' : '') + shortOf(p.char);
}
// de quem foi o ponto: vencedor de quem bateu por último, ou erro (forçado / não forçado) de quem errou
function creditPoint(w, kind) {
  const lh = S.lastHit, at = S.attempt;
  if (kind === 'in') {
    if (at && at.hitId === S.hitId && at.p.team !== w) { const st = statOf(at.p); if (at.hard) st.fe++; else st.ue++; return phrase(at.hard ? 'Erro forçado' : 'Erro não forçado', at.p); }
    if (lh && lh.p.team === w) { statOf(lh.p)[lh.cat]++; return lh.cat === 'saque' ? phrase('Ace', lh.p) : phrase(CAT_WIN[lh.cat], lh.p, FEM_CAT[lh.cat]); }
    return '';
  }
  if (!lh || lh.p.team === w) return '';
  const st = statOf(lh.p), where = kind === 'net' ? 'na rede' : 'fora';
  if (lh.cat === 'saque') { st.ue++; return isMe(lh.p) ? 'Seu saque ' + where : 'Saque ' + where + ' de ' + whoName(lh.p); }
  if (lh.hard) st.fe++; else st.ue++;
  return phrase(lh.hard ? 'Erro forçado' : 'Erro não forçado', lh.p, false, ' (' + CAT_NAME[lh.cat] + ' ' + where + ')');
}
// momento: 0 a 1 para o time numa sequência de pontos (a partir do 2º seguido)
const momentum = t => S.streak && S.streak.team === t ? Math.min(1, (S.streak.n - 1) / 3) : 0;
// ponto decisivo: ponto de ouro, fim de tie-break, set point ou match point
function decisive() {
  const sc = S.score, N = S.settings.games;
  if (!sc) return '';
  if (sc.tb) { const tg = sc.stb ? 10 : 7; return Math.max(sc.pts[0], sc.pts[1]) >= tg - 1 ? (sc.stb ? 'MATCH POINT' : 'SET POINT') : ''; }
  const golden = sc.pts[0] === 3 && sc.pts[1] === 3;
  for (const t of [0, 1]) {
    const gp = sc.pts[t] === 3; // próximo ponto fecha o game deste time
    if ((gp || golden) && sc.games[t] >= N - 1 && sc.games[t] >= sc.games[1 - t]) {
      const last = S.settings.format !== 'pro' || (sc.sets && sc.sets[t] === 1);
      return last ? 'MATCH POINT' : 'SET POINT';
    }
  }
  return golden ? 'PONTO DE OURO' : '';
}
// clima da partida: vento (m/s, em x/z) e calor
function setWeather() {
  let max = 3.5, heat = false;
  if (S.careerActive && $s.CR && $s.CR.tour) { const t = $s.CR.tour; if (t.wind === undefined) { t.wind = Math.random() * 7; t.windA = Math.random() * Math.PI * 2; t.heat = Math.random() < .3; } S.wind = { x: Math.cos(t.windA) * t.wind, z: Math.sin(t.windA) * t.wind }; S.heat = t.heat; return; }
  const v = Math.random() * max, a = Math.random() * Math.PI * 2; S.wind = { x: Math.cos(a) * v, z: Math.sin(a) * v }; S.heat = heat;
}
function weatherText() {
  const w = S.wind || { x: 0, z: 0 }, v = Math.hypot(w.x, w.z), kmh = Math.round(v * 3.6);
  if (kmh < 3 && !S.heat) return '';
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖']; // ↑ = na direção do adversário
  const ang = Math.atan2(w.x, -w.z), idx = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
  return (kmh >= 3 ? 'Vento ' + kmh + ' km/h ' + arrows[idx] : '') + (S.heat ? (kmh >= 3 ? ' · ' : '') + 'Calor forte' : '');
}
// ---------- treino com desafios ----------
// curtas: 15 bolas, meta 10 curtas boas (anel verde) · defesa: 10 smashes, meta 5 devolvidos · smash: 10 lobs, meta 5 smashes perfeitos
const DRILLS = {
  curtas: { nome: 'Curtas no verde', max: 15, goal: 10, txt: 'curtas boas' },
  defesa: { nome: 'Defenda os smashes', max: 10, goal: 5, txt: 'defesas' },
  smash: { nome: 'Smash perfeito', max: 10, goal: 5, txt: 'smashes perfeitos' },
};
function startDrill(kind, onEnd) {
  S.settings.mode = 'simples'; S.settings.format = 'set';
  newMatch();
  S.drill = { kind, n: 0, ok: 0, onEnd, lastR: null };
  drillNext();
}
function drillNext() {
  const d = S.drill, D = DRILLS[d.kind];
  if (d.n >= D.max) return drillEnd();
  S.mode = 'rally'; S.lastTeam = 1; S.hitId++; S.rally = 1; ball.state = 'live'; ball.gk = 1; ball.oppMiss = 0; ball.finisher = false; d.lastR = null;
  human.swing.t = -1; human.charging = false; human.dive = null;
  const hx = human.pos.x + (Math.random() - .5) * 2.2, hz = human.pos.z + (Math.random() - .5) * 1.2;
  const g = 9.8;
  if (d.kind === 'curtas') { const T = 1.05; ball.pos.set((Math.random() - .5) * 3, 1.2, -4.5); ball.vel.set((hx - ball.pos.x) / T, (1.0 - 1.2 + .5 * g * T * T) / T, (hz - .3 - ball.pos.z) / T); }
  if (d.kind === 'defesa') { const T = .55; ball.pos.set((Math.random() - .5) * 2, 2.6, -1.6); ball.vel.set((hx - ball.pos.x) / T, (1.0 - 2.6 + .5 * g * 1.35 * T * T) / T, (hz - ball.pos.z) / T); ball.gk = 1.35; ball.finisher = true; }
  if (d.kind === 'smash') { const T = 2.1; ball.pos.set((Math.random() - .5) * 3, 1.2, -5); ball.vel.set((hx - ball.pos.x) / T, (2.4 - 1.2 + .5 * g * T * T) / T, (hz - .4 - ball.pos.z) / T); ball.apex = 6; }
  ball.prev = null; resetTrail(); renderBoard();
}
function drillResult(w, kind) {
  const d = S.drill, r = d.lastR; d.n++;
  let ok = false;
  if (w === 0 && kind === 'in' && r) {
    if (d.kind === 'curtas') ok = r.key === 'curta' && !r.pop && r.grade >= .7;
    if (d.kind === 'defesa') ok = !r.pop;
    if (d.kind === 'smash') ok = r.key === 'smash' && r.meterRes === 'perfeito';
  }
  if (ok) d.ok++;
  sndWhistle(ok);
  S.mode = 'dead'; S.deadT = 1.3;
  banner(ok ? 'Boa!' : 'Não valeu', DRILLS[d.kind].txt + ': ' + d.ok + '/' + DRILLS[d.kind].goal + ' · bola ' + d.n + '/' + DRILLS[d.kind].max, 0, false);
  renderBoard();
}
function drillEnd() {
  const d = S.drill, D = DRILLS[d.kind]; S.drill = null;
  S.mode = 'over'; hideBanner();
  const pass = d.ok >= D.goal;
  $('overEyebrow').textContent = 'Treino · ' + D.nome; $('overTitle').textContent = pass ? 'DESAFIO CUMPRIDO' : 'QUASE LÁ';
  $('overScore').textContent = d.ok + '/' + D.goal; $('stTable').innerHTML = '<p class="cr-note">' + d.ok + ' ' + D.txt + ' em ' + D.max + ' bolas.</p>';
  $('btnOverChamp').hidden = true; $('btnOverCareer').hidden = !d.onEnd; $('btnAgain').hidden = !!d.onEnd;
  if (d.onEnd) d.onEnd(d.ok, pass);
  S.lastDrill = d.kind;
  el.over.hidden = false;
}
function pointTo(w, reason, kind) {
  if (S.mode === 'dead') return;
  if (S.drill) { drillResult(w, kind); return; }
  S.streak = S.streak && S.streak.team === w ? { team: w, n: S.streak.n + 1 } : { team: w, n: 1 };
  const credit = creditPoint(w, kind);
  if (credit) reason = credit[0].toUpperCase() + credit.slice(1) + '.';
  S.lastPoint = { w, kind, text: reason, cat: S.lastHit && S.lastHit.cat, rally: S.rally, dive: !!S.hadDive };
  S.mode = 'dead'; S.deadT = 2.0;
  S.stats.maxRally = Math.max(S.stats.maxRally, S.rally);
  const ev = awardPoint(w);
  let isTitle = false;
  if (ev === 'set' || ev === 'stb') S.deadT = 2.6;
  if (ev === 'match') {
    // comemoração do time que venceu: toque de mão; no título, abraço, pulos e confete
    isTitle = w === 0 && ((S.careerActive && crIsFinal()) || (S.champActive && champIsFinal()));
    S.celebrate = { team: w, t: 0, title: isTitle };
    S.deadT = isTitle ? 5 : dupla() ? 2.8 : 2.4;
  }
  pointShow(w, ev, reason, isTitle);
  if (NET.onPoint) NET.onPoint(w, ev, reason);
}
// placar, apito e aviso do ponto, do ponto de vista de quem está na tela (time 0 = você);
// o convidado do online chama direto com o vencedor já convertido para o lado dele
function pointShow(w, ev, reason, isTitle) {
  renderBoard();
  sndWhistle(w === 0); cheerArena(ev === 'match' ? 3 : ev === 'game' ? 2 : 1.2);
  landRing.visible = false;
  const g = S.score.games;
  const d = dupla(), of = oppOf();
  let title = w === 0 ? (d ? 'Ponto de vocês!' : 'Ponto seu!') : 'Ponto ' + of;
  let sub = reason;
  if (ev === 'game') { title = w === 0 ? (d ? 'Game de vocês!' : 'Game seu!') : 'Game ' + of; sub = `${reason} · games ${g[0]}–${g[1]}`; }
  if (ev === 'tb') { title = 'Tie-break!'; sub = `${g[0]}–${g[1]} nos games. Primeiro a 7 pontos, com 2 de diferença.`; }
  if (ev === 'set') { const st = S.score.sets; title = w === 0 ? (d ? 'Set de vocês!' : 'Set seu!') : 'Set ' + of; sub = `Sets ${st[0]}–${st[1]} · ${scoreText()}`; }
  if (ev === 'stb') { title = 'Super tie-break!'; sub = 'Um set para cada lado. Primeiro a 10 pontos, com 2 de diferença.'; }
  if (ev === 'match') { const pro = S.settings.format === 'pro'; title = w === 0 ? (pro ? (d ? 'Vitória de vocês!' : 'Vitória!') : d ? 'Set de vocês!' : 'Set seu!') : pro ? 'Vitória ' + of : 'Set ' + of; sub = pro ? scoreText() + ' · ' + reason : reason;
    if (isTitle) { title = d ? 'CAMPEÕES!' : 'CAMPEÃO!'; sub = (S.careerActive ? crBoardTitle().replace(/ – .*/, '') : 'Campeonato') + ' · ' + reason; confetti(); cheerArena(5); }
  }
  banner(title, sub, 0, ev === 'match' || ev === 'game');
}
function setupPoint() {
  S.celebrate = null; S.pressure = decisive(); S.hadDive = false;
  S.mode = 'serve'; S.lastTeam = -1; S.rally = 0; ball.state = 'held'; ball.vel.set(0, 0, 0);
  S.assign = [null, null]; S.assignId = [-1, -1];
  $s.players.forEach(p => { p.vel.set(0, 0, 0); p.swing.t = -1; p.swing.var = ''; p.swing.meter = null; p.jump = 0; p.pendingServe = null; p.serveJumped = false; p.charging = false; p.ai.planId = -1; p.ai.reactT = 0; p.ai.letGo = false; p.ai.swung = false; p.dive = null; });
  MTR.active = false; el.meter.hidden = true;
  humanPlan.id = -1;
  for (const c of NET.remote) { c.plan.id = -1; if (c.m.active) { c.m.active = false; c.out.push(['mh']); } }
  const st = $s.teams[S.server];
  S.serverPlayer = st[S.serverIdx[S.server] % st.length];
  const sp = S.serverPlayer;
  const sgn = t => t === 0 ? 1 : -1;
  if (!dupla()) {
    sp.pos.set(.7 * sgn(sp.team), 0, 8.6 * sgn(sp.team));
    const r = $s.teams[1 - S.server][0]; r.pos.set(0, 0, (ZONE3 + .3) * sgn(r.team));
  } else {
    sp.pos.set(sp.slot * 1.4, 0, 8.6 * sgn(sp.team)); // sacador primeiro: a recepção se ajeita pela posição dele
    $s.players.forEach(p => {
      const s = sgn(p.team);
      if (p === sp) p.pos.set(p.slot * 1.4, 0, 8.6 * s);
      else if (p.team === S.server) p.pos.set(p.slot * 1.9, 0, 4.4 * s);
      else p.pos.set(receiveX(p), 0, (ZONE3 + .3) * s);
    });
  }
  if (!sp.isHuman) S.aiServeT = 1.5;
  placeHeldBall(); resetTrail(); renderBoard();
  serveBanner(sp);
  if (NET.onSetupPoint) NET.onSetupPoint();
}
// aviso de quem saca (o convidado do online chama com o sacador do lado dele)
function serveBanner(sp) {
  const gold = isGolden();
  if (sp === human) {
    banner(gold ? 'Ponto de ouro' : 'Seu saque', isTouch() ? 'Segure um golpe para lançar a bola e solte na faixa verde.' : 'Segure J forte · K alto · L curto · Espaço seguro e solte na faixa verde.', 0, gold);
  } else if (sp.team === 0) {
    banner(gold ? 'Ponto de ouro' : (sp.char && !sp.char.fem ? 'Saque do seu parceiro' : 'Saque da sua parceira'), 'Fique pronto na sua metade da quadra.', 1500, gold);
  } else {
    banner(gold ? 'Ponto de ouro' : sp.netHuman ? 'Saque de ' + whoName(sp) : 'Saque da CPU', 'Prepare-se para devolver sem deixar cair.', 1500, gold);
  }
}
function placeHeldBall() { handPos(S.serverPlayer || human, ball.pos); }
function configureMode() {
  const d = dupla();
  C.halfW = HALF_W[S.settings.mode];
  linesGroup.simples.visible = !d; linesGroup.dupla.visible = d;
  $s.players = d ? [human, partner, cpuA, cpuB] : [human, cpuA];
  $s.teams = d ? [[human, partner], [cpuA, cpuB]] : [[human], [cpuA]];
  partner.model.group.visible = d; cpuB.model.group.visible = d;
  const mySide = S.settings.side === 'esquerda' ? -1 : 1;
  human.slot = d ? mySide : 0; partner.slot = -mySide; cpuA.slot = d ? 1 : 0; cpuB.slot = -1;
}
// arena de cada partida: na carreira depende do nível do torneio e do local; no campeonato, arena média
const ARENA_PAL = {
  BRA: { line: '#1f4fb8', trim: '#ffd23f', sand: '#ffffff', seat: '#0a7d3c', board: ['#0a7d3c', '#ffd23f'] },
  ITA: { line: '#d6332f', trim: '#0b7a3c', sand: '#f7ecd6', seat: '#d6332f', board: ['#0b7a3c', '#ffffff'] },
  ESP: { line: '#e8a317', trim: '#c8102e', sand: '#f6e6c6', seat: '#c8102e', board: ['#c8102e', '#ffd23f'] },
  FRA: { line: '#2457c5', trim: '#ef4135', sand: '#f8eedc', seat: '#2457c5', board: ['#2457c5', '#ffffff'] },
  POR: { line: '#046a38', trim: '#da291c', sand: '#f6ead2', seat: '#da291c', board: ['#046a38', '#ffe900'] },
  ARU: { line: '#ff5a1f', trim: '#418fde', sand: '#fffdf8', seat: '#418fde', board: ['#418fde', '#fbe122'] },
  MUN: { line: '#111111', trim: '#e8a317', sand: '#fffaf0', seat: '#17324d', board: ['#111111', '#e8a317'] },
};
function arenaFor() {
  if (S.careerActive && $s.CR && $s.CR.tour) {
    const t = $s.CR.tour, n = (t.name || '').toLowerCase();
    const loc = t.tier >= 8 ? 'MUN' : /aruba/.test(n) ? 'ARU' : /cervia|ravenna|lignano|riccione|terracina/.test(n) ? 'ITA' : /barcelona|valência|valencia|canaria/.test(n) ? 'ESP' : /montpellier/.test(n) ? 'FRA' : /cascais/.test(n) ? 'POR' : 'BRA';
    const size = t.tier <= 2 ? 0 : t.tier <= 4 ? 1 : t.tier <= 6 ? 2 : 3;
    return Object.assign({ size, text: (t.name || '').toUpperCase().slice(0, 22) }, ARENA_PAL[loc]);
  }
  if (S.champActive) return Object.assign({ size: 2, text: 'CAMPEONATO' }, ARENA_PAL.BRA);
  return { size: 0 };
}
// guest: convidado do online (o estado vem do anfitrião: sem sorteio de saque/clima e sem montar o ponto)
function newMatch(guest) {
  S.drill = null;
  applyArena(arenaFor());
  assignCharacters();
  configureMode();
  S.score = { pts: [0, 0], games: [0, 0], tb: false, sets: [0, 0], hist: [], stb: false };
  S.server = Math.random() < .5 ? 0 : 1; S.serverIdx = [0, 0]; S.tbPlayed = 0; S.matchWinner = null;
  S.highlights = [];
  S.stats = { pts: [0, 0], maxRally: 0, smashes: 0 }; S.pstats = []; S.lastHit = null; S.attempt = null; S.streak = null;
  if (!guest) setWeather();
  el.over.hidden = true; el.menu.hidden = true; el.pause.hidden = true; S.paused = false;
  document.body.classList.remove('in-menu');
  clearPrints();
  applyCam(); applyGfx(); applyRackets(); applyPlayerStyle();
  if (guest) { S.mode = 'serve'; ball.state = 'held'; renderBoard(); return; }
  if (NET.onNewMatch) NET.onNewMatch();
  setupPoint();
}
// tabela do fim do jogo: pontos por golpe, erros forçados e não forçados de cada jogador e da dupla
function renderMatchStats() {
  const rows = [['Aces', 'saque'], ['Smash', 'smash'], ['Voleio', 'voleio'], ['Drive', 'drive'], ['Curta', 'curta'], ['Lob', 'lob'], ['Defesa', 'defesa']];
  const teams = $s.teams.map(tm => tm.map(p => ({ p, s: statOf(p) })));
  const win = s => rows.reduce((t, r) => t + s[r[1]], 0);
  const val = (s, k) => typeof k === 'function' ? k(s) : s[k];
  const sum = (tm, k) => tm.reduce((t, x) => t + val(x.s, k), 0);
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const head = teams.map((tm, ti) => tm.map(x => '<th class="t' + ti + '">' + flagSVG(x.p.char && x.p.char.pais) + ' ' + esc(x.p === human ? 'VOCÊ' : x.p.char ? shortOf(x.p.char) : 'CPU') + '</th>').join('') + (tm.length > 1 ? '<th class="tt t' + ti + '">DUPLA</th>' : '')).join('');
  const line = (lbl, k, cls) => '<tr class="' + (cls || '') + '"><td>' + lbl + '</td>' + teams.map(tm => tm.map(x => '<td>' + val(x.s, k) + '</td>').join('') + (tm.length > 1 ? '<td class="tt">' + sum(tm, k) + '</td>' : '')).join('') + '</tr>';
  $('stTable').innerHTML = '<table class="mstats"><thead><tr><th></th>' + head + '</tr></thead><tbody>'
    + rows.map(r => line(r[0], r[1])).join('') + line('Pontos vencedores', win, 'sum')
    + line('Erros forçados', 'fe', 'err') + line('Erros não forçados', 'ue', 'err') + '</tbody></table>';
}
function showOver() {
  S.mode = 'over'; hideBanner();
  const w = S.matchWinner, g = S.score.games;
  const dn = { facil: 'fácil', medio: 'médio', dificil: 'difícil' }[S.settings.diff];
  $('overEyebrow').textContent = `Fim de set · ${dupla() ? 'dupla' : 'simples'} · ${dn}`;
  $('overTitle').textContent = w === 0 ? (dupla() ? 'VOCÊS VENCERAM' : 'VOCÊ VENCEU') : oppHuman() ? whoName(oppHuman()).toUpperCase() + ' VENCEU' : 'A CPU VENCEU';
  $('overScore').textContent = scoreText();
  $('stPts').textContent = `${S.stats.pts[0]}–${S.stats.pts[1]}`;
  $('stRally').textContent = S.stats.maxRally;
  $('stSmash').textContent = S.stats.smashes;
  renderMatchStats();
  const inChamp = !!S.champActive, inCareer = !!S.careerActive;
  if (inChamp) champMatchEnded(w === 0);
  if (inCareer) careerMatchEnded(w === 0);
  $('btnOverChamp').hidden = !inChamp; $('btnOverCareer').hidden = !inCareer; $('btnAgain').hidden = inChamp || inCareer;
  $('btnReplay').hidden = !(S.highlights && S.highlights.length);
  el.over.hidden = false;
}

export { pointShow, serveBanner, renderMatchStats, banner, DRILLS, startDrill, drillNext, momentum, decisive, scoreText, $, configureMode, dupla, el, feedback, hideBanner, isTouch, newMatch, placeHeldBall, pointTo, renderBoard, setupPoint, shotBtns, showOver };
