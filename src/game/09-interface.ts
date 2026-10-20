// @ts-nocheck
// elementos da interface e placar
import './08-audio';
import { $s } from '../state';
import { C, HALF_W, ZONE3, nameOf, shortOf } from './00-base';
import { flagSVG } from '../flags';
import { S } from './01-estado';
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
  const title = S.careerActive ? crBoardTitle() : S.champActive ? champBoardTitle() : '';
  $('sbTitle').textContent = title; $('sbTitle').hidden = !title;
  el.gP.textContent = sc.games[0]; el.gC.textContent = sc.games[1];
  el.pP.textContent = sc.tb ? sc.pts[0] : PT[Math.min(3, sc.pts[0])];
  el.pC.textContent = sc.tb ? sc.pts[1] : PT[Math.min(3, sc.pts[1])];
  el.rowP.classList.toggle('serving', S.server === 0);
  el.rowC.classList.toggle('serving', S.server === 1);
  el.golden.textContent = sc.tb ? 'TIE-BREAK' : 'PONTO DE OURO';
  el.golden.hidden = !(sc.tb || isGolden());
}
const isGolden = () => !S.score.tb && S.score.pts[0] === 3 && S.score.pts[1] === 3;
function rotateServe() { S.serverIdx[S.server]++; S.server = 1 - S.server; }
function awardPoint(w) {
  const sc = S.score, l = 1 - w; S.stats.pts[w]++;
  if (sc.tb) {
    sc.pts[w]++; S.tbPlayed++;
    if (sc.pts[w] >= 7 && sc.pts[w] - sc.pts[l] >= 2) { sc.games[w]++; S.matchWinner = w; return 'match'; }
    if (S.tbPlayed % 2 === 1) rotateServe();
    return 'point';
  }
  sc.pts[w]++;
  if (sc.pts[w] >= 4) { // sem vantagem: no 40-40 o próximo ponto decide
    sc.games[w]++; sc.pts = [0, 0];
    const N = S.settings.games;
    rotateServe();
    if (sc.games[w] >= N && sc.games[w] - sc.games[l] >= 2) { S.matchWinner = w; return 'match'; }
    if (sc.games[0] === N && sc.games[1] === N) { sc.tb = true; S.tbPlayed = 0; return 'tb'; }
    return 'game';
  }
  return 'point';
}
// ---------- estatísticas do jogo ----------
const CAT_NAME = { voleio: 'voleio', saque: 'saque', smash: 'smash', drive: 'drive', curta: 'curta', lob: 'lob', defesa: 'defesa' };
const CAT_WIN = { voleio: 'Voleio vencedor', smash: 'Smash vencedor', drive: 'Drive vencedor', curta: 'Curta vencedora', lob: 'Lob vencedor', defesa: 'Defesa vencedora' };
const FEM_CAT = { curta: 1, defesa: 1 };
// "de N. BURMAK" ou "seu"/"sua" quando é você
const deP = (p, fem) => p && p.isHuman ? (fem ? 'sua' : 'seu') : 'de ' + whoName(p);
// "Smash vencedor de N. BURMAK" / "Seu smash vencedor"
const phrase = (noun, p, fem, tail) => (p && p.isHuman ? (fem ? 'Sua ' : 'Seu ') + noun.toLowerCase() : noun + ' de ' + whoName(p)) + (tail || '');
function statOf(p) { const k = $s.players.indexOf(p); if (!S.pstats) S.pstats = []; if (!S.pstats[k]) S.pstats[k] = { voleio: 0, saque: 0, smash: 0, drive: 0, curta: 0, lob: 0, defesa: 0, fe: 0, ue: 0 }; return S.pstats[k]; }
function whoName(p) {
  if (!p) return '?';
  if (p.isHuman) return 'você';
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
  if (lh.cat === 'saque') { st.ue++; return lh.p.isHuman ? 'Seu saque ' + where : 'Saque ' + where + ' de ' + whoName(lh.p); }
  if (lh.hard) st.fe++; else st.ue++;
  return phrase(lh.hard ? 'Erro forçado' : 'Erro não forçado', lh.p, false, ' (' + CAT_NAME[lh.cat] + ' ' + where + ')');
}
function pointTo(w, reason, kind) {
  if (S.mode === 'dead') return;
  const credit = creditPoint(w, kind);
  if (credit) reason = credit[0].toUpperCase() + credit.slice(1) + '.';
  S.mode = 'dead'; S.deadT = 2.0;
  S.stats.maxRally = Math.max(S.stats.maxRally, S.rally);
  const ev = awardPoint(w);
  renderBoard();
  sndWhistle(w === 0); cheerArena(ev === 'match' ? 3 : ev === 'game' ? 2 : 1.2);
  landRing.visible = false;
  const g = S.score.games;
  const d = dupla();
  let title = w === 0 ? (d ? 'Ponto de vocês!' : 'Ponto seu!') : 'Ponto da CPU';
  let sub = reason;
  if (ev === 'game') { title = w === 0 ? (d ? 'Game de vocês!' : 'Game seu!') : 'Game da CPU'; sub = `${reason} · games ${g[0]}–${g[1]}`; }
  if (ev === 'tb') { title = 'Tie-break!'; sub = `${g[0]}–${g[1]} nos games. Primeiro a 7 pontos, com 2 de diferença.`; }
  if (ev === 'match') { title = w === 0 ? (d ? 'Set de vocês!' : 'Set seu!') : 'Set da CPU'; sub = reason; S.deadT = 2.4;
    // comemoração do time que venceu: toque de mão; no título, abraço, pulos e confete
    const isTitle = w === 0 && ((S.careerActive && crIsFinal()) || (S.champActive && champIsFinal()));
    S.celebrate = { team: w, t: 0, title: isTitle };
    S.deadT = isTitle ? 5 : d ? 2.8 : 2.4;
    if (isTitle) { title = d ? 'CAMPEÕES!' : 'CAMPEÃO!'; sub = (S.careerActive ? crBoardTitle().replace(/ – .*/, '') : 'Campeonato') + ' · ' + reason; confetti(); cheerArena(5); }
  }
  banner(title, sub, 0, ev === 'match' || ev === 'game');
}
function setupPoint() {
  S.celebrate = null;
  S.mode = 'serve'; S.lastTeam = -1; S.rally = 0; ball.state = 'held'; ball.vel.set(0, 0, 0);
  S.assign = [null, null]; S.assignId = [-1, -1];
  $s.players.forEach(p => { p.vel.set(0, 0, 0); p.swing.t = -1; p.swing.var = ''; p.swing.meter = null; p.jump = 0; p.pendingServe = null; p.serveJumped = false; p.charging = false; p.ai.planId = -1; p.ai.reactT = 0; p.ai.letGo = false; p.ai.swung = false; p.dive = null; });
  MTR.active = false; el.meter.hidden = true;
  humanPlan.id = -1;
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
  if (sp !== human) S.aiServeT = 1.5;
  placeHeldBall(); resetTrail(); renderBoard();
  const gold = isGolden();
  if (sp === human) {
    banner(gold ? 'Ponto de ouro' : 'Seu saque', isTouch() ? 'Segure um golpe para lançar a bola e solte na faixa verde.' : 'Segure J forte · K alto · L curto · Espaço seguro e solte na faixa verde.', 0, gold);
  } else if (sp === partner) {
    banner(gold ? 'Ponto de ouro' : (partner.char && !partner.char.fem ? 'Saque do seu parceiro' : 'Saque da sua parceira'), 'Fique pronto na sua metade da quadra.', 1500, gold);
  } else {
    banner(gold ? 'Ponto de ouro' : 'Saque da CPU', 'Prepare-se para devolver sem deixar cair.', 1500, gold);
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
function newMatch() {
  applyArena(arenaFor());
  assignCharacters();
  configureMode();
  S.score = { pts: [0, 0], games: [0, 0], tb: false };
  S.server = Math.random() < .5 ? 0 : 1; S.serverIdx = [0, 0]; S.tbPlayed = 0; S.matchWinner = null;
  S.stats = { pts: [0, 0], maxRally: 0, smashes: 0 }; S.pstats = []; S.lastHit = null; S.attempt = null;
  el.over.hidden = true; el.menu.hidden = true; el.pause.hidden = true; S.paused = false;
  document.body.classList.remove('in-menu');
  clearPrints();
  applyCam(); applyGfx(); applyRackets(); applyPlayerStyle();
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
  const head = teams.map((tm, ti) => tm.map(x => '<th class="t' + ti + '">' + flagSVG(x.p.char && x.p.char.pais) + ' ' + esc(x.p.isHuman ? 'VOCÊ' : x.p.char ? shortOf(x.p.char) : 'CPU') + '</th>').join('') + (tm.length > 1 ? '<th class="tt t' + ti + '">DUPLA</th>' : '')).join('');
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
  $('overTitle').textContent = w === 0 ? (dupla() ? 'VOCÊS VENCERAM' : 'VOCÊ VENCEU') : 'A CPU VENCEU';
  $('overScore').textContent = `${g[0]}–${g[1]}`;
  $('stPts').textContent = `${S.stats.pts[0]}–${S.stats.pts[1]}`;
  $('stRally').textContent = S.stats.maxRally;
  $('stSmash').textContent = S.stats.smashes;
  renderMatchStats();
  const inChamp = !!S.champActive, inCareer = !!S.careerActive;
  if (inChamp) champMatchEnded(w === 0);
  if (inCareer) careerMatchEnded(w === 0);
  $('btnOverChamp').hidden = !inChamp; $('btnOverCareer').hidden = !inCareer; $('btnAgain').hidden = inChamp || inCareer;
  el.over.hidden = false;
}

export { $, configureMode, dupla, el, feedback, hideBanner, isTouch, newMatch, placeHeldBall, pointTo, renderBoard, setupPoint, shotBtns, showOver };
