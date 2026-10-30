// @ts-nocheck
// elementos da interface e placar
import './08-audio';
import { $s } from '../state';
import { C, HALF_W, ZONE3, clamp, nameOf, rand, shortOf, overall } from './00-base';
import { flagSVG } from '../flags';
import { S, NET } from './01-estado';
import { applyArena, cheerArena, confetti, linesGroup, setNetHeight, setSide, setZoneLine } from './03-cenario';
import { cpuA, cpuB, human, partner } from './06-modelos';
import { applyPlayerStyle, applyRackets, assignCharacters, ball, clearPrints, landRing, resetTrail, setBallStyle } from './07-glb';
import { swingVar } from './04-poses';
import { applyGfx, sndWhistle } from './08-audio';
import { handPos } from './11-mira';
import { MTR, applyCam } from './12-controles';
import { champBoardTitle, champIsFinal, champMatchEnded } from './13-campeonato';
import { STATE_INFO, crBoardTitle, crIsFinal, careerMatchEnded, crPotBarHTML } from './14-carreira';
import { humanPlan, receiveX } from './16-ia';
import { sideOf } from './18-animacao';
import { warmShaders } from './02-render';
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
// revisão de lance ajustado: vista de cima da marca da bola na linha, com dentro/fora e a distância
let reviewT = 0;
function showReview(r) {
  let box = document.getElementById('review');
  if (!box) { box = document.createElement('div'); box.id = 'review'; box.innerHTML = '<canvas width="260" height="150"></canvas><b></b>'; document.body.appendChild(box); }
  const cv = box.querySelector('canvas'), x = cv.getContext('2d'), W = cv.width, H = cv.height, PX = 470; // 1 m = 470 px (de mais longe: dá para ver a bola chegando sem ela tomar a tela)
  const ax = r.axis === 'x', lineC = ax ? C.halfW : C.halfL, sg = Math.sign(ax ? r.x : r.z) || 1, pos = Math.abs(ax ? r.x : r.z);
  // velocidade no plano da telinha: "pe" para fora da quadra, "al" ao longo da linha; vy para baixo
  const pe = ((ax ? r.vx : r.vz) || 0) * sg, al = (ax ? r.vz : r.vx) || 0, vy = Math.min(-2, r.vy || -6), MARK = .032, RB = .055;
  const grains = Array.from({ length: 260 }, () => [Math.random() * W, Math.random() * H, Math.random() * .12]);
  const cx = W / 2, tapeW = .05 * PX, bx0 = cx + (pos - lineC) * PX, by0 = H / 2;
  // mini replay em câmera lenta (como o olho eletrônico): a bola chega por cima, a sombra encosta, marca a areia e sai;
  // ~0,08 s de jogo esticados em 1,7 s; depois para na marca com o veredito
  const T0 = -.05, T1 = .03, DUR = 1700;
  let st = performance.now();
  const draw = now => {
    const u = Math.min(1, (now - st) / DUR), tau = T0 + (T1 - T0) * u;
    x.fillStyle = '#ead8b4'; x.fillRect(0, 0, W, H);
    grains.forEach(([gx, gy, a]) => { x.fillStyle = 'rgba(120,90,50,' + a + ')'; x.fillRect(gx, gy, 2, 2); });
    x.fillStyle = '#1f4fb8'; x.fillRect(cx - tapeW / 2, 0, tapeW, H);
    // marca na areia (aparece no toque e cresce um pouco no arrasto)
    if (tau >= 0) { const sk = 1 + Math.min(.6, Math.hypot(pe, al) * .02) * Math.min(1, tau / .01);
      x.save(); x.translate(bx0, by0); x.rotate(Math.atan2(al, pe)); x.beginPath(); x.ellipse(MARK * PX * (sk - 1) * .5, 0, MARK * PX * sk, MARK * PX * .9, 0, 0, Math.PI * 2);
      x.fillStyle = 'rgba(90,60,30,.5)'; x.fill(); x.strokeStyle = u >= 1 ? (r.inB ? '#4fd18b' : '#e5484d') : 'rgba(60,40,20,.6)'; x.lineWidth = u >= 1 ? 3 : 1.5; x.stroke(); x.restore(); }
    // bola: posição no plano e altura (antes do toque descendo, depois subindo mais devagar)
    const h = tau < 0 ? -vy * -tau : Math.abs(vy) * .3 * tau, bx = bx0 + pe * tau * PX * (tau < 0 ? 1 : .25), by = by0 + al * tau * PX * (tau < 0 ? 1 : .25);
    if (u < 1) x.beginPath(), x.ellipse(bx + h * PX * .35, by + h * PX * .2, RB * PX * .95, RB * PX * .8, 0, 0, Math.PI * 2), x.fillStyle = 'rgba(40,30,15,' + (.35 - Math.min(.25, h * 2)) + ')', x.fill(); // sombra (some no quadro final)
    if (u < 1) { const rs = RB * PX * (1 + Math.min(.5, h * 1.1)); const g = x.createRadialGradient(bx - rs * .35, by - rs * .35, rs * .1, bx, by, rs); g.addColorStop(0, '#fff3c4'); g.addColorStop(.6, '#ffb11f'); g.addColorStop(1, '#d9780a');
      x.globalAlpha = .92; x.beginPath(); x.arc(bx, by, rs, 0, Math.PI * 2); x.fillStyle = g; x.fill(); x.globalAlpha = 1; }
    x.fillStyle = 'rgba(255,255,255,.85)'; x.font = 'bold 11px sans-serif'; x.fillText('QUADRA', 8, 16); x.fillText('FORA', W - 40, 16);
    if (u < 1) { x.fillText('REPLAY', 8, H - 8); requestAnimationFrame(draw); }
  };
  const cm = Math.abs(r.mg * 100).toFixed(1).replace('.', ',');
  const t = box.querySelector('b'); t.textContent = 'REVISÃO · ' + (r.inB ? 'DENTRO (a marca tocou a linha · ' + cm + ' cm)' : 'FORA por ' + cm + ' cm'); t.className = r.inB ? 'in' : 'out';
  t.style.visibility = 'hidden'; setTimeout(() => { t.style.visibility = ''; }, DUR); // o veredito aparece depois do replay
  requestAnimationFrame(draw);
  box.classList.add('show'); clearTimeout(reviewT); reviewT = setTimeout(() => box.classList.remove('show'), 5500 + DUR);
}
// texto dos golpes (o seu e os da CPU): pode ser completo, discreto ou desligado nas configurações
function shotFeedback(main, small, kind) {
  const m = S.settings.shotText || 'discreto';
  if (m === 'off') return;
  feedback(main, small, kind, m === 'discreto');
}
function feedback(main, small, kind, soft) {
  el.fb.innerHTML = ''; el.fb.append(main);
  if (small) { const s = document.createElement('small'); s.textContent = small; el.fb.append(s); }
  // lances especiais (finalização, smash bomba, curta matadora, lob chutado) aparecem maiores e em dourado
  const star = !soft && /FINALIZA|BOMBA|MATADORA|CHUTADO PERFEITO|LOB CHUTADO/.test(String(main) + ' ' + (small || ''));
  el.fb.classList.toggle('soft', !!soft);
  el.fb.classList.toggle('cpu', kind === 'cpu'); el.fb.classList.toggle('mate', kind === 'mate'); el.fb.classList.toggle('star', star); el.fb.classList.add('show');
  clearTimeout(fbTimer); fbTimer = setTimeout(() => el.fb.classList.remove('show'), soft ? 900 : star ? 1800 : 1400);
}
// ---------- Placar ----------
const PT = ['0', '15', '30', '40'];
// troca de lado: depois dos games 1, 3, 5…; no tie-break a cada 4 pontos (depois do 1º, 5º, 9º…)
function sidesFlipped(sc) {
  if (!sc || !sc.games) return false;
  let n = Math.floor((sc.games[0] + sc.games[1] + 1) / 2);
  if (sc.tb) { const p = sc.pts[0] + sc.pts[1]; if (p >= 1) n += Math.floor((p - 1) / 4) + 1; }
  return n % 2 === 1;
}
if (typeof window !== 'undefined') window.__pdoSide = { sidesFlipped: sc => sidesFlipped(sc), update: () => updateSides() };
function updateSides() {
  if (S.matchWinner != null) return; // ponto final: só comemora, ninguém troca de lado
  const f = !S.drill && sidesFlipped(S.score);
  if (f === !!S.sideFlip) return;
  S.sideFlip = f;
  const mid = S.score && (S.score.games[0] + S.score.games[1] + S.score.pts[0] + S.score.pts[1]) > 0;
  if (mid) S.sideNote = true; // avisa no próximo saque
  // logo depois do ponto (partida seguindo): faixa "troca de lado" atravessa a tela e o ambiente troca no meio dela
  if (mid && S.mode === 'dead') sideWipe(f); else setSide(f);
}
let wipeT = 0;
// troca de lado andando: depois de 1 s de comemoração, os dois times vão até o mesmo poste da rede e cruzam por ele (em
// duas filas); a faixa "troca de lado" cobre a tela e, no meio dela, o cenário e os jogadores giram juntos (para a câmera
// eles terminam do outro lado) e voltam às posições. Tudo no tempo do jogo (pausa e câmera lenta valem)
function sideWipe(f) {
  S.deadT = Math.max(S.deadT || 0, 0) + 4.2; // a pausa antes do próximo saque cresce para caber a caminhada
  S.sideWalk = { t: 0, f, flipped: false, banner: false, plan: null };
  clearTimeout(wipeT);
}
const SW_START = 1.0, SW_FLIP = 3.3, SW_END = 5.3;
function sideWalkStep(dt) {
  const W = S.sideWalk; if (!W) return false;
  W.t += dt;
  const ps = $s.players;
  // a IA/controle ficam parados na troca de lado: quem estava no chão (peixinho) ou no meio de um golpe termina a animação
  // aqui (senão ficava congelado deitado e era arrastado até o outro lado)
  for (const p of ps) {
    if (p.dive) { p.dive.t += dt; if (p.dive.t >= p.dive.dur) { p.dive = null; p.diveRec = 0; } }
    if (p.swing.t >= 0) { p.swing.t += dt; if (p.swing.t >= p.swing.dur) p.swing.t = -1; }
    p.charging = false;
  }
  if (W.t < SW_START) return false; // comemoração continua
  if (!W.plan) {
    const px = C.netHalf + .55, sx = (human.pos.x || 0) >= 0 ? 1 : -1; // poste do lado onde o jogador está
    W.plan = ps.map(p => {
      const s = p.team === 0 ? 1 : -1, lane = sx * (px + (p.team === 0 ? 0 : .6)), idx = $s.teams[p.team].indexOf(p);
      return { p, delay: idx * .35, pts: [[lane, s * 1.1], [lane, -s * .9]], back: [dupla() ? (p.slot || (idx ? 1 : -1)) * 1.4 : 0, s * 5] };
    });
    S.celebrate = null;
  }
  const t = W.t - SW_START;
  // faixa: começa um pouco antes do giro (o giro acontece no meio da animação dela)
  if (!W.banner && W.t >= SW_FLIP - .8) {
    W.banner = true; let w = document.getElementById('sideWipe');
    if (!w) { w = document.createElement('div'); w.id = 'sideWipe'; w.className = 'side-wipe'; w.innerHTML = '<b><i>↔</i> TROCA DE LADO</b>'; document.body.append(w); }
    w.classList.remove('go'); void w.offsetWidth; w.classList.add('go');
  }
  if (!W.flipped && W.t >= SW_FLIP) {
    W.flipped = true; setSide(W.f);
    for (const p of ps) { p.pos.x = -p.pos.x; p.pos.z = -p.pos.z; } // giram junto com o cenário
    for (const P of W.plan) P.pts = [P.back];
  }
  const left = (W.flipped ? SW_END : SW_FLIP) - W.t;
  for (const P of W.plan) {
    const p = P.p;
    if (t < P.delay || !P.pts.length || p.dive || p.swing.t >= 0) { p.vel.set(0, 0, 0); continue; } // levantando/terminando o golpe: espera
    const [tx, tz] = P.pts[0], dx = tx - p.pos.x, dz = tz - p.pos.z, d = Math.hypot(dx, dz);
    const rest = P.pts.length > 1 ? Math.hypot(P.pts[1][0] - tx, P.pts[1][1] - tz) : 0;
    const v = clamp((d + rest) / Math.max(.3, left - .15), 2.2, 5.5);
    if (d < .12) { P.pts.shift(); p.vel.set(0, 0, 0); continue; }
    const k = Math.min(1, v * dt / d); p.vel.set(dx / d * v, 0, dz / d * v);
    p.pos.x += dx * k; p.pos.z += dz * k;
  }
  if (W.t >= SW_END) { for (const p of ps) p.vel.set(0, 0, 0); S.sideWalk = null; }
  return true;
}
function renderBoard() {
  const sc = S.score;
  updateSides();
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
  const title = S.drill ? DRILLS[S.drill.kind].nome.toUpperCase() + ' · ' + S.drill.L.nome.toUpperCase() + ' · ' + S.drill.ok + '/' + S.drill.goal + ' · BOLA ' + Math.min(S.drill.n + 1, S.drill.max) + '/' + S.drill.max : S.careerActive ? crBoardTitle() : S.champActive ? champBoardTitle() : '';
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
// fim de set: no formato "pro" (finais profissionais) são 2 sets (de N games); 1 a 1 vai para o super tie-break
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
// nomes do time ("N. BURMAK e J. GASPAR"); no online, time com gente de verdade aparece pelo nome, não "CPU"
const teamNames = t => ($s.teams[t] || []).map(whoName).join(' e ');
const teamHuman = t => ($s.teams[t] || []).some(p => p.netHuman);
const oppOf = () => teamHuman(1) ? 'de ' + teamNames(1) : 'da CPU';
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
// nota da partida: o que o SEU jogador fez de bom (defesas, smashes, curtas certos, winners) e de ruim (erros por golpe)
const PERF_TXT = { defBoa: 'defesas boas', defLevantou: 'defesas que levantaram', curtaTop: 'curtas matadoras', curtaBoa: 'curtas boas', curtaLenta: 'curtas lentas',
  smashPerf: 'smashes perfeitos', smashRuim: 'smashes fora do tempo', defDescontrolou: 'defesas descontroladas', curtaRuim: 'curtas descontroladas', lobChutado: 'lobs chutados perfeitos', finaliz: 'finalizações', winner: 'pontos vencedores', ptBola: 'pontos com a sua bola',
  furou: 'bolas furadas', erroF: 'erros forçados', e_curta: 'erros de curta', e_lob: 'erros de lob', e_smash: 'erros de smash', e_defesa: 'erros de defesa',
  e_drive: 'erros de drive', e_voleio: 'erros de voleio', e_saque: 'saques errados', defIn: 'defesas que passaram', lobIn: 'lobs que passaram' };
const WIN_V = { smash: .42, curta: .7, lob: .6, defesa: .5, voleio: .5, drive: .5, saque: .5 };
const ERR_V = { curta: -.9, lob: -.78, smash: -.8, defesa: -.7, drive: -.65, voleio: -.65, saque: -.6 }; // erros (vermelho) pesam bem mais que acertos
// (smash é o golpe mais comum de quem ataca: o ponto vencedor de smash vale menos que o de curta/lob)
const perfOn = p => !!p && p === human && !p.netHuman && !S.spectate && !NET.role && !S.drill && !!S.perf;
function perfAdd(p, v, key) { if (!perfOn(p)) return; S.perf.sum += v; S.perf.ev[key] = (S.perf.ev[key] || 0) + 1; if (S.careerActive && S.mode === 'rally') updateLiveRating(); }
// sua defesa e seu lob contam no painel (DEF / LOB) quando passam e ficam dentro: o adversário rebate ou a bola cai do lado dele
function perfHitHook(p) { const d = S.defPend; if (!d) return; S.defPend = null; if (p.team !== d.team) perfAdd(d.p, 0, d.key); }
// golpe dado pelo seu jogador (chamado na hora da batida)
function perfShot(p, sw, r) {
  if (!perfOn(p) || r.mis) return; // erro conta no fim do ponto
  S.perf.myHit = S.hitId; // a sua última bola (para o ponto que ela ganhar mesmo sem ser vencedora)
  if (sw.type === 'defesa' || sw.type === 'lob') S.defPend = { p, team: p.team, key: sw.type === 'lob' ? 'lobIn' : 'defIn' };
  // defesa: verde soma bem, amarelo soma um pouco; levantou ou descontrolou não tira na hora (se der erro, o erro do ponto já conta)
  if (sw.type === 'defesa' && r.pressure > .25 && !r.wild && !r.pop) perfAdd(p, r.grade < .7 ? .15 : .35, 'defBoa');
  // curta: verde soma, amarela (lenta) não tira; descontrolada também não tira na hora (só se virar erro)
  if (sw.type === 'curta' && !r.pop && !r.wild) { if (r.curtaK > .86) perfAdd(p, .28, 'curtaTop'); else if (r.curtaK >= .5) perfAdd(p, .12, 'curtaBoa'); }
  if (sw.meter && sw.meter.res === 'perfeito') perfAdd(p, .06, 'smashPerf'); // smash fora do verde que entra não tira nada
  if (sw.lob && sw.lob.kick) perfAdd(p, .25, 'lobChutado');
  if (r.label === 'FINALIZAÇÃO') perfAdd(p, .05, 'finaliz');
}
// conta da nota (a mesma ao vivo e no fim): jogadas pesam menos que antes e, acima de 7,5, a nota sobe devagar
// (10 só numa partida excepcional)
function rateFrom(wonB) {
  // pontos perdidos por erro do seu parceiro não entram no saldo (só os seus e os do adversário)
  const pp = S.stats.pts, lost = Math.max(0, pp[1] - (S.perf.mateErr || 0)), bal = (pp[0] - lost) / Math.max(8, pp[0] + lost);
  // começo de jogo pesa menos (divide por pelo menos √20): poucos pontos bons não disparam a nota; passando de 45 pontos vale
  // a média por ponto (divide por n): numa partida muito longa a soma das jogadas não infla a nota sozinha
  const n = S.perf.n, fk = n <= 45 ? 1.85 / Math.sqrt(Math.max(20, n)) : 1.85 * Math.sqrt(45) / n;
  let r = 6 + S.perf.sum * fk + wonB + bal * (dupla() ? .55 : 1.2);
  // jogo limpo: muitas jogadas boas e (quase) nenhum erro seu ganha um bônus (até +1,2); cada erro seu tira 1/4 dele (forçado, 1/8)
  { const ev = S.perf.ev, cnt = re => Object.entries(ev).reduce((t, [k, n]) => t + (re.test(k) ? n : 0), 0);
    const errs = cnt(/^(e_|furou)/) + cnt(/^erroF$/) * .5, good = cnt(/^(w_|finaliz|ptBola|smashPerf|defBoa|curtaTop|curtaBoa|lobChutado)/);
    r += Math.max(0, 1 - errs * .25) * clamp(good / 8, 0, 1) * 1.2 * clamp(S.perf.n / 24, 0, 1); } // o bônus só vale de verdade com a partida andando (poucos pontos não dão nota alta)
  if (r > 7.5) r = 7.5 + (r - 7.5) * .55; // acima de 7,5 sobe devagar: 10 só numa partida quase perfeita
  return Math.round(clamp(r, 1, 10) * 10) / 10;
}
function matchRating(won) {
  if (!S.perf || S.spectate || NET.role) return null;
  // saldo de pontos pesa também (sozinho na simples mais que na dupla): perder de lavada não dá nota média
  return rateFrom(won ? .35 : -.4);
}
// nota ao vivo (canto de cima à direita) nas partidas da carreira: a mesma conta da nota final, sem o bônus de vitória
function updateLiveRating() {
  const e = $('liveNota'); if (!e) return;
  const on = !!(S.careerActive && S.perf && !S.spectate && !NET.role && !S.drill);
  e.hidden = !on; if (!on) { delete e.dataset.r; e.querySelectorAll('[data-v]').forEach(c => { delete c.dataset.v; }); return; }
  const r = rateFrom(0);
  // estilo NBA 2K: a nota no hexágono (cor pela nota, com a subida/descida embaixo) e os números do seu jogo ao lado
  const ev = S.perf.ev, sum = re => Object.entries(ev).reduce((t, [k, n]) => t + (re.test(k) ? n : 0), 0);
  // PTS: pontos vencedores · SMASH: smashes perfeitos · CURTA: curtas boas e matadoras · DEF: defesas que passaram e ficaram dentro · LOB: lobs que passaram e ficaram dentro · ERR: erros
  const vals = { nota: r, pts: sum(/^w_/), smash: ev.smashPerf || 0, curta: (ev.curtaBoa || 0) + (ev.curtaTop || 0), def: ev.defIn || 0, lob: ev.lobIn || 0, err: sum(/^(e_|furou|erroF)/) };
  e.style.setProperty('--nh', String(Math.round(clamp((r - 4) / 4.5, 0, 1) * 125)));
  for (const [k, v] of Object.entries(vals)) {
    const c = e.querySelector('[data-k="' + k + '"]'); if (!c) continue;
    const b = c.querySelector('b'), prev = +(c.dataset.v ?? v), txt = k === 'nota' ? v.toFixed(1).replace('.', ',') : String(v);
    if (b.textContent === txt) continue;
    b.textContent = txt;
    if (e.dataset.r && Math.abs(v - prev) > .049) { // variação sobe e some: "+1" / "+0,2" verde ou "−0,3" vermelho
      // mudanças seguidas (o mesmo lance recalcula a nota várias vezes) somam no mesmo indicador
      const now = performance.now(), live = c._nd && c._nd.isConnected && now - c._ndT < 1100;
      const sum = (live ? c._ndSum : 0) + (v - prev), up = sum > 0, good = k === 'err' ? !up : up;
      const d = live ? c._nd : document.createElement('i');
      c._nd = d; c._ndSum = sum; c._ndT = now;
      d.className = 'nd ' + (good ? 'up' : 'dn'); d.textContent = Math.abs(sum) < .049 ? '' : (up ? '+' : '−') + (k === 'nota' ? Math.abs(sum).toFixed(1).replace('.', ',') : Math.round(Math.abs(sum)));
      if (!live) c.appendChild(d); clearTimeout(c._ndTo); c._ndTo = setTimeout(() => d.remove(), 1300);
      c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse');
    }
    c.dataset.v = String(v);
  }
  e.dataset.r = String(r);
}
function prependStats(html) { const st = $('stTable'); st.innerHTML = html + (st.innerHTML || ''); }
function perfSummary() {
  const ev = S.perf.ev, good = [], bad = [];
  for (const [k, n] of Object.entries(ev)) { const key = k.startsWith('w_') ? 'winner' : k; (/^(e_|furou|erroF|defLevantou|defDescontrolou|curtaLenta|curtaRuim|smashRuim)/.test(k) ? bad : good).push([key, n]); }
  const merge = l => { const m = {}; l.forEach(([k, n]) => { m[k] = (m[k] || 0) + n; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => n + ' ' + PERF_TXT[k]); };
  return { good: merge(good), bad: merge(bad) };
}
// de quem foi o ponto: vencedor de quem bateu por último, ou erro (forçado / não forçado) de quem errou.
// Erro forçado por um golpe do adversário (smash, curta boa, lob chutado, bola forte) conta também como ponto vencedor dele
function creditForcer(by) {
  if (!by) return '';
  statOf(by.p)[by.cat]++; perfAdd(by.p, WIN_V[by.cat] || .5, 'w_' + by.cat);
  return by.cat === 'saque' ? phrase('Saque vencedor', by.p) : phrase(CAT_WIN[by.cat], by.p, FEM_CAT[by.cat]);
}
const forcedTxt = (win, p, tail) => win + ' — erro forçado ' + (isMe(p) ? 'seu' : 'de ' + whoName(p)) + (tail || '');
function creditPoint(w, kind) {
  const lh = S.lastHit, at = S.attempt;
  if (kind === 'in') {
    if (at && at.hitId === S.hitId && at.p.team !== w) {
      const st = statOf(at.p); if (at.hard) st.fe++; else st.ue++; at.p.mErr = (at.p.mErr || 0) + 1; // erros na partida (a CPU esperta foca em quem erra mais)
      if (S.perf && at.p !== human && at.p.team === human.team) S.perf.mateErr = (S.perf.mateErr || 0) + 1;
      perfAdd(at.p, at.hard ? -.38 : -.65, at.hard ? 'erroF' : 'furou');
      if (at.hard && lh && lh.p.team === w) return forcedTxt(creditForcer({ p: lh.p, cat: lh.cat }), at.p);
      return phrase(at.hard ? 'Erro forçado' : 'Erro não forçado', at.p);
    }
    if (lh && lh.p.team === w) { statOf(lh.p)[lh.cat]++; perfAdd(lh.p, WIN_V[lh.cat] || .5, 'w_' + lh.cat); return lh.cat === 'saque' ? phrase('Ace', lh.p) : phrase(CAT_WIN[lh.cat], lh.p, FEM_CAT[lh.cat]); }
    return '';
  }
  if (!lh || lh.p.team === w) return '';
  const st = statOf(lh.p), where = kind === 'net' ? 'na rede' : 'fora';
  if (S.perf && lh.p !== human && lh.p.team === human.team) S.perf.mateErr = (S.perf.mateErr || 0) + 1; // erro do parceiro: não pesa no seu saldo
  if (lh.cat === 'saque') { st.ue++; lh.p.mErr = (lh.p.mErr || 0) + 1; perfAdd(lh.p, ERR_V.saque, 'e_saque'); return isMe(lh.p) ? 'Seu saque ' + where : 'Saque ' + where + ' de ' + whoName(lh.p); }
  if (lh.hard) st.fe++; else st.ue++; lh.p.mErr = (lh.p.mErr || 0) + 1;
  if (lh.hard) perfAdd(lh.p, -.38, 'erroF'); else perfAdd(lh.p, ERR_V[lh.cat] || -.5, 'e_' + lh.cat);
  const tail = ' (' + CAT_NAME[lh.cat] + ' ' + where + ')';
  if (lh.forcedBy && lh.forcedBy.p.team === w) return forcedTxt(creditForcer(lh.forcedBy), lh.p, tail);
  return phrase(lh.hard ? 'Erro forçado' : 'Erro não forçado', lh.p, false, tail);
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
  if (S.indoor) { S.wind = { x: 0, z: 0 }; S.heat = false; return; } // ambiente fechado: sem vento nem sol
  if (S.careerActive && $s.CR && $s.CR.tour) { const t = $s.CR.tour; if (t.wind === undefined) { t.wind = Math.random() * 7; t.windA = Math.random() * Math.PI * 2; t.heat = Math.random() < .3; } S.wind = { x: Math.cos(t.windA) * t.wind, z: Math.sin(t.windA) * t.wind }; S.heat = t.heat; return; }
  const v = Math.random() * max, a = Math.random() * Math.PI * 2; S.wind = { x: Math.cos(a) * v, z: Math.sin(a) * v }; S.heat = heat;
}
function weatherText() {
  const w0 = S.wind || { x: 0, z: 0 }, ws = S.sideFlip ? -1 : 1, w = { x: w0.x * ws, z: w0.z * ws }, v = Math.hypot(w.x, w.z), kmh = Math.round(v * 3.6);
  if (kmh < 3 && !S.heat) return '';
  const arrows = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖']; // ↑ = na direção do adversário
  const ang = Math.atan2(w.x, -w.z), idx = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
  return (kmh >= 3 ? 'Vento ' + kmh + ' km/h ' + arrows[idx] : '') + (S.heat ? (kmh >= 3 ? ' · ' : '') + 'Calor forte' : '');
}
// ---------- treino com desafios ----------
// curtas: 15 bolas, meta 10 curtas boas (anel verde) · defesa: 10 smashes, meta 5 devolvidos · smash: 10 lobs, meta 5 smashes perfeitos
const DRILLS = {
  curtas: { nome: 'Curtas no verde', max: 15, txt: 'curtas boas', seq: ['curtas'] },
  defesa: { nome: 'Defenda os smashes', max: 10, txt: 'defesas', seq: ['defesa'] },
  smash: { nome: 'Smash perfeito', max: 10, txt: 'smashes perfeitos', seq: ['smash'] },
  saque: { nome: 'Saque no alvo', max: 12, txt: 'saques bons', seq: ['saque'] },
  // combinados: duas bolas seguidas; a sequência só conta se as duas saírem certas
  ataque: { nome: 'Ataque: curta e smash', max: 8, txt: 'sequências completas', seq: ['curtas', 'smash'] },
  defcurta: { nome: 'Defesa e buscar a curta', max: 8, txt: 'sequências completas', seq: ['defesa', 'buscar'] },
  contra: { nome: 'Defesa e contra-ataque', max: 8, txt: 'sequências completas', seq: ['defesa', 'smash'] },
};
// níveis do treino: meta maior, bolas mais rápidas e mais abertas; na carreira, mais recompensa
// saque: fácil vale qualquer saque dentro; médio, dentro no alvo; difícil, perfeito; profissional, perfeito e no alvo
const DRILL_LVL = [
  { nome: 'Fácil', goal: { curtas: 7, defesa: 4, smash: 4, saque: 8, ataque: 3, defcurta: 3, contra: 3 }, spd: 1.28, wide: .45, rew: .6 },
  { nome: 'Médio', goal: { curtas: 10, defesa: 5, smash: 5, saque: 7, ataque: 4, defcurta: 4, contra: 4 }, spd: 1, wide: 1, rew: 1 },
  { nome: 'Difícil', goal: { curtas: 11, defesa: 7, smash: 7, saque: 7, ataque: 5, defcurta: 5, contra: 5 }, spd: .88, wide: 1.25, rew: 1.7 },
  { nome: 'Profissional', goal: { curtas: 13, defesa: 8, smash: 8, saque: 7, ataque: 6, defcurta: 6, contra: 6 }, spd: .78, wide: 1.45, rew: 2.6 },
];
const STEP_TXT = { curtas: 'CURTA', defesa: 'DEFESA', smash: 'SMASH', buscar: 'BUSQUE A CURTA', saque: 'SAQUE' };
const SERVE_TGT = { aberto: 'ALVO: SAQUE ABERTO', meio: 'ALVO: SAQUE NO MEIO', fundo: 'ALVO: SAQUE FUNDO' };
function startDrill(kind, onEnd, lvl) {
  S.settings.mode = 'simples'; S.settings.format = 'set';
  newMatch();
  const L = DRILL_LVL[lvl === undefined ? 1 : lvl] || DRILL_LVL[1];
  S.drill = { kind, n: 0, ok: 0, step: 0, onEnd, lastR: null, lvl: lvl === undefined ? 1 : lvl, goal: L.goal[kind], max: DRILLS[kind].max, L };
  drillNext();
}
function drillNext() {
  const d = S.drill, D = DRILLS[d.kind];
  if (d.n >= d.max) return drillEnd();
  const st = D.seq[d.step || 0];
  if (st === 'saque') return drillServe();
  S.mode = 'rally'; S.lastTeam = 1; S.hitId++; S.rally = 1; ball.gk = 1; ball.cx = ball.cz = 0; ball.oppMiss = 0; ball.finisher = false; ball.threat = 0; d.lastR = null;
  human.swing.t = -1; human.charging = false; human.dive = null; human.diveRec = 0;
  // cada treino tem sua faixa da quadra (z mín, z máx, onde começa); a bola sempre vem para dentro dela
  const zone = { curtas: [3.5, 6.5, 5], defesa: [4, 6.5, 5.8], smash: [2.4, 5.2, 3.2], buscar: [1, 2.6, 2] }[st];
  const z0 = { curtas: [3.5, 6.5, 5], defesa: [4, 6.5, 5.8], smash: [2.4, 5.2, 3.2] }[D.seq[0]];
  if (D.seq.length > 1 && !d.step) { human.pos.set(0, 0, z0[2]); human.vel.set(0, 0, 0); } // combinado: cada sequência começa do lugar do 1º golpe
  else if (d.n === 0 || Math.abs(human.pos.x) > C.halfW + .3 || human.pos.z > C.halfL + .3 || human.pos.z < 1) { human.pos.set(0, 0, zone[2]); human.vel.set(0, 0, 0); }
  const hw = C.halfW - .45, g = 9.8, pick = l => l[Math.floor(Math.random() * l.length)];
  const LV = d.L || DRILL_LVL[1];
  let hx = clamp(human.pos.x + (Math.random() - .5) * 2.2 * LV.wide, -hw, hw), hz = clamp(human.pos.z + (Math.random() - .5) * 1.2, zone[0], zone[1]);
  // bolas variadas: cada treino sorteia um tipo de bola (o nome aparece na hora do lançamento)
  let vName = '';
  if (st === 'curtas') {
    const v = pick([['media', 'media', 'alta'], ['media', 'media', 'funda', 'baixa', 'alta'], ['media', 'funda', 'baixa', 'baixa', 'alta'], ['funda', 'baixa', 'baixa', 'alta', 'media']][d.lvl ?? 1]);
    if (v === 'funda') hz = clamp(rand(5.6, 6.6), zone[0], zone[1] + .2);
    const T = { media: 1.05, funda: 1.15, baixa: .8, alta: 1.45 }[v] * LV.spd, y1 = v === 'baixa' ? .75 : 1.0;
    ball.pos.set((Math.random() - .5) * 3, 1.2, -4.5); ball.vel.set((hx - ball.pos.x) / T, (y1 - 1.2 + .5 * g * T * T) / T, (hz - .3 - ball.pos.z) / T);
    vName = { media: '', funda: 'BOLA FUNDA', baixa: 'BOLA BAIXA E RÁPIDA', alta: 'BOLA ALTA' }[v];
  }
  if (st === 'defesa') {
    const v = pick([['fundo', 'fundo', 'perto'], ['perto', 'perto', 'fundo', 'angulado', 'corpo'], ['perto', 'angulado', 'angulado', 'corpo', 'fundo'], ['perto', 'angulado', 'angulado', 'corpo', 'corpo']][d.lvl ?? 1]);
    if (v === 'angulado') hx = Math.sign(human.pos.x || rand(-1, 1)) * -1 * rand(hw * .7, hw) || hw;
    if (v === 'corpo') hx = clamp(human.pos.x + rand(-.2, .2), -hw, hw);
    hz = clamp(v === 'fundo' ? rand(5.2, 6.6) : hz, 3.4, 6.8);
    const from = v === 'fundo' ? [-4.6, 2.5, .78, 1.15] : [-1.6, 2.6, .55, 1.35]; // z de quem bate, altura, tempo, gravidade
    const T = from[2] * LV.spd, gk = from[3];
    ball.pos.set((Math.random() - .5) * 2, from[1], from[0]); ball.vel.set((hx - ball.pos.x) / T, (.75 - from[1] + .5 * g * gk * T * T) / T, (hz - ball.pos.z) / T); ball.gk = gk; ball.cx = ball.cz = 0; ball.finisher = v !== 'fundo'; ball.threat = v === 'fundo' ? .6 : 1;
    vName = { perto: 'SMASH PERTO DA REDE', fundo: 'SMASH DO FUNDO', angulado: 'SMASH ANGULADO', corpo: 'SMASH NO CORPO' }[v];
  }
  if (st === 'smash') {
    const v = pick([['normal', 'normal', 'alto'], ['normal', 'normal', 'curto', 'fundo', 'alto', 'lateral'], ['normal', 'curto', 'fundo', 'alto', 'lateral', 'lateral'], ['curto', 'fundo', 'fundo', 'lateral', 'lateral', 'alto']][d.lvl ?? 1]);
    if (v === 'curto') hz = rand(2.3, 3.0); if (v === 'fundo') hz = rand(4.6, 5.6);
    if (v === 'lateral') hx = Math.sign(-human.pos.x || rand(-1, 1)) * rand(hw * .6, hw);
    const T = { normal: 2.1, curto: 1.7, fundo: 2.3, alto: 2.7, lateral: 2.1 }[v];
    ball.pos.set((Math.random() - .5) * 3, 1.2, -5); ball.vel.set((hx - ball.pos.x) / T, (2.4 - 1.2 + .5 * g * T * T) / T, (hz - .4 - ball.pos.z) / T); ball.apex = v === 'alto' ? 7.5 : 6;
    vName = { normal: '', curto: 'LOB CURTO', fundo: 'LOB NO FUNDO', alto: 'LOB ALTO', lateral: 'LOB NA LATERAL' }[v];
  }
  if (st === 'buscar') { // curtinha do professor junto da rede: corra e devolva antes de ela cair
    hz = rand(...[[1.8, 2.6], [1.3, 2.4], [1.1, 2.1], [1, 1.8]][d.lvl ?? 1]);
    const T = 1.3 * LV.spd;
    ball.pos.set((Math.random() - .5) * 2, .9, -1.6); ball.vel.set((hx - ball.pos.x) / T, (.35 - .9 + .5 * g * T * T) / T, (hz - ball.pos.z) / T);
    vName = 'CURTA DO PROFESSOR';
  }
  if (D.seq.length > 1) vName = (d.step ? 'AGORA: ' : '') + STEP_TXT[st] + (vName ? ' · ' + vName : '');
  if (vName) feedback('PROFESSOR', vName, null);
  // quem lança é o professor: ele fica atrás do ponto de saída, faz o movimento e a bola só sai na hora do contato (16-ia)
  const coach = $s.teams[1][0], type = { curtas: 'defesa', defesa: 'smash', smash: 'lob', buscar: 'curta' }[st];
  coach.feed = { pos: ball.pos.clone(), vel: ball.vel.clone(), gk: ball.gk, finisher: ball.finisher, apex: ball.apex };
  coach.pos.set(ball.pos.x + .5 * (coach.lefty ? -1 : 1), 0, ball.pos.z - .35); coach.vel.set(0, 0, 0);
  coach.swing.type = type; coach.swing.dur = .7; coach.swing.t = 0; coach.swing.hit = false;
  coach.swing.side = sideOf(coach, ball.pos); coach.swing.var = swingVar(type, ball.pos.y, coach);
  S.serverPlayer = coach; ball.state = 'held'; ball.vel.set(0, 0, 0);
  ball.prev = null; resetTrail(); renderBoard();
}
// treino de saque: você saca e o professor só olha (não devolve); nos níveis com alvo, ele diz onde mirar
function drillServe() {
  const d = S.drill;
  d.tgt = d.lvl === 1 || d.lvl === 3 ? ['aberto', 'meio', 'fundo'][Math.floor(Math.random() * 3)] : null;
  S.server = 0; S.mode = 'serve'; S.lastTeam = -1; S.rally = 0; S.hitId++; ball.state = 'held'; ball.vel.set(0, 0, 0); ball.gk = 1; ball.cx = ball.cz = 0; ball.finisher = false; d.lastR = null;
  $s.players.forEach(p => { p.vel.set(0, 0, 0); p.swing.t = -1; p.swing.meter = null; p.jump = 0; p.pendingServe = null; p.serveJumped = false; p.charging = false; p.dive = null; p.diveRec = 0; p.feed = null; });
  MTR.active = false; el.meter.hidden = true;
  S.serverPlayer = human; human.pos.set((d.n % 2 ? -.7 : .7), 0, 8.6);
  const coach = $s.teams[1][0]; coach.pos.set(0, 0, -(ZONE3 + .3));
  placeHeldBall(); resetTrail(); renderBoard();
  feedback('PROFESSOR', d.tgt ? SERVE_TGT[d.tgt] : d.lvl >= 2 ? 'SAQUE PERFEITO E DENTRO' : 'SAQUE DENTRO', null);
}
// onde o saque caiu (lado do professor): aberto = perto da lateral, meio = no centro, fundo = perto da linha de fundo
const serveOnTgt = (t, x, z) => t === 'aberto' ? Math.abs(x) > C.halfW * .55 : t === 'meio' ? Math.abs(x) < C.halfW * .35 : Math.abs(z) > C.halfL - 2.2;
// cada golpe do treino: certo ou não, e por quê
function drillStepOk(st, w, kind, r, d) {
  if (st === 'saque') {
    if (w !== 0 || kind !== 'in' || !r) return [false, !r ? 'não sacou' : kind === 'net' ? 'saque na rede' : 'saque fora'];
    if (d.lvl >= 2 && r.serveRes !== 'perfeito') return [false, 'saque não foi perfeito'];
    if (d.tgt && !serveOnTgt(d.tgt, ball.pos.x, ball.pos.z)) return [false, 'fora do alvo (' + SERVE_TGT[d.tgt].slice(6).toLowerCase() + ')'];
    return [true, ''];
  }
  let ok = false;
  if (w === 0 && kind === 'in' && r) {
    if (st === 'curtas') ok = r.key === 'curta' && !r.pop && r.grade >= .7;
    if (st === 'defesa' || st === 'buscar') ok = !r.pop;
    // smash perfeito que caiu dentro conta (mesmo se pegou a bola mais baixa); nos combinados fáceis basta o smash entrar
    if (st === 'smash') ok = r.meterRes === 'perfeito' || (d.kind !== 'smash' && (d.lvl ?? 1) <= 1 && !!r.meterRes && r.meterRes !== 'voleio');
  }
  if (ok) return [true, ''];
  let why = '';
  if (!r) why = 'não chegou na bola';
  else if (st === 'smash' && r.meterRes && r.meterRes !== 'perfeito') why = 'barra ' + (r.meterRes === 'voleio' ? 'curta demais (virou voleio)' : r.meterRes.toUpperCase());
  else if (st === 'smash' && !r.meterRes) why = 'use J segurando (barra do smash)';
  else if (st === 'curtas' && r.key !== 'curta') why = 'não foi curta (use L)';
  else if (st === 'curtas' && r.grade < .7) why = 'curta LENTA (aperte no sinal verde)';
  else if (r.pop) why = 'a bola levantou';
  else why = kind === 'net' ? 'foi na rede' : kind === 'out' ? 'foi fora' : 'não passou';
  return [false, why];
}
function drillResult(w, kind) {
  const d = S.drill, r = d.lastR, D = DRILLS[d.kind], st = D.seq[d.step || 0];
  const [ok, why] = drillStepOk(st, w, kind, r, d);
  // combinado: acertou e ainda tem golpe na sequência → a próxima bola vem logo
  if (ok && d.step < D.seq.length - 1) { d.step++; S.mode = 'dead'; S.deadT = .45; banner('Boa! Agora: ' + STEP_TXT[D.seq[d.step]].toLowerCase(), '', 0, false); renderBoard(); return; }
  d.n++; d.step = 0;
  if (ok) d.ok++;
  sndWhistle(ok);
  S.mode = 'dead'; S.deadT = 1.3;
  banner(ok ? 'Boa!' : 'Não valeu: ' + why, D.txt + ': ' + d.ok + '/' + d.goal + ' · bola ' + d.n + '/' + d.max, 0, false);
  renderBoard();
}
function drillEnd() {
  const d = S.drill, D = DRILLS[d.kind]; S.drill = null;
  S.mode = 'over'; hideBanner();
  const pass = d.ok >= d.goal;
  $('overEyebrow').textContent = 'Treino · ' + D.nome; $('overTitle').textContent = pass ? 'DESAFIO CUMPRIDO' : 'QUASE LÁ';
  $('overScore').textContent = d.ok + '/' + d.goal; $('stTable').innerHTML = '<p class="cr-note">' + d.ok + ' ' + D.txt + ' em ' + d.max + ' bolas · nível ' + d.L.nome.toLowerCase() + '.</p>';
  $('btnOverChamp').hidden = true; $('btnOverCareer').hidden = !d.onEnd; $('btnAgain').hidden = !!d.onEnd;
  if (d.onEnd) d.onEnd(d.ok, pass);
  S.lastDrill = d.kind; S.lastDrillLvl = d.lvl;
  el.over.hidden = false;
}
function pointTo(w, reason, kind) {
  if (S.mode === 'dead') return;
  if (S.drill) { drillResult(w, kind); return; }
  if (S.defPend) { const d = S.defPend; S.defPend = null; if (kind === 'in' && w === d.team) { perfAdd(d.p, 0, d.key); updateLiveRating(); } }
  if (S.perf) S.perf.n++;
  S.streak = S.streak && S.streak.team === w ? { team: w, n: S.streak.n + 1 } : { team: w, n: 1 };
  const sum0 = S.perf ? S.perf.sum : 0;
  const credit = creditPoint(w, kind);
  // ponto da sua dupla que nasceu da SUA bola (o adversário errou nela ou logo depois dela), mesmo amarela/vermelha:
  // nunca tira nota (antes o ponto só entrava na média e baixava a nota)
  if (S.perf && w === human.team && S.perf.sum === sum0 && S.perf.myHit && S.hitId - S.perf.myHit <= 1) perfAdd(human, .25, 'ptBola');
  if (S.perf) S.perf.myHit = 0;
  if (credit) reason = credit[0].toUpperCase() + credit.slice(1) + '.';
  S.lastPoint = { w, kind, text: reason, cat: S.lastHit && S.lastHit.cat, rally: S.rally, dive: !!S.hadDive };
  S.mode = 'dead'; S.deadT = 2.0;
  S.stats.maxRally = Math.max(S.stats.maxRally, S.rally);
  S.ptWin = w; S.ptT = 0; S.ptN = (S.ptN || 0) + 1; // reações entre pontos (18-animacao)
  if (S.rallyLog) S.rallyLog.push(S.rally);
  const ev = awardPoint(w);
  updateLiveRating();
  let isTitle = false;
  if (ev === 'set' || ev === 'stb') S.deadT = 2.6;
  if (ev === 'match') {
    // comemoração do time que venceu: toque de mão; no título, abraço, pulos e confete
    isTitle = w === 0 && ((S.careerActive && crIsFinal()) || (S.champActive && champIsFinal()));
    S.celebrate = { team: w, t: 0, title: isTitle };
    S.deadT = isTitle ? 5 : dupla() ? 2.8 : 2.4;
  } else if (dupla()) {
    // entre os pontos a dupla às vezes se encontra (tapa de mão no alto, toque baixo ou raquete com raquete): mais depois
    // de um rali longo ou de um ponto vencedor, quase nunca dois pontos seguidos; quem perdeu raramente, para se animar
    const pk = a => a[Math.floor(Math.random() * a.length)];
    // cada dupla no seu tempo (t negativo = começa depois) e do seu jeito; quem perdeu bem menos e só um toque discreto
    // turn: quanto viram um para o outro (0 = seguem de frente para a rede e esticam o braço de lado)
    const last = S.ptCelLast || (S.ptCelLast = {}), n = S.ptN || 0, big = S.rally >= 6 || kind === 'in'; // 'in': a bola quicou do lado de lá (ponto ganho no golpe)
    const okW = last[w] !== n - 1 && Math.random() < (big ? .55 : .3), okL = last[1 - w] !== n - 1 && Math.random() < .1;
    S.ptCel = {}; if (okW) last[w] = n; if (okL) last[1 - w] = n;
    if (okW) S.ptCel[w] = { t: -rand(0, .45), kind: pk(['five', 'five', 'low', 'rk', 'low']), turn: pk([0, .2, .45]) }; if (okL) S.ptCel[1 - w] = { t: -rand(.3, .8), kind: pk(['low', 'low', 'rk']), turn: pk([0, .2]) };
  }
  pointShow(w, ev, reason, isTitle);
  if (NET.onPoint) NET.onPoint(w, ev, reason);
}
// placar, apito e aviso do ponto, do ponto de vista de quem está na tela (time 0 = você);
// o convidado do online chama direto com o vencedor já convertido para o lado dele
function pointShow(w, ev, reason, isTitle) {
  renderBoard();
  // quem só assiste (online) vê o nome de quem fez o ponto, nunca "seu"
  const mine = w === 0 && !S.spectate;
  sndWhistle(mine); cheerArena(ev === 'match' ? 3 : ev === 'game' ? 2 : 1.2);
  landRing.visible = false;
  const g = S.score.games;
  const d = dupla(), of = S.spectate ? 'de ' + teamNames(w) : oppOf();
  let title = mine ? (d ? 'Ponto de vocês!' : 'Ponto seu!') : 'Ponto ' + of;
  let sub = reason;
  if (ev === 'game') { title = mine ? (d ? 'Game de vocês!' : 'Game seu!') : 'Game ' + of; sub = `${reason} · games ${g[0]}–${g[1]}`; }
  if (ev === 'tb') { title = 'Tie-break!'; sub = `${g[0]}–${g[1]} nos games. Primeiro a 7 pontos, com 2 de diferença.`; }
  if (ev === 'set') { const st = S.score.sets; title = mine ? (d ? 'Set de vocês!' : 'Set seu!') : 'Set ' + of; sub = `Sets ${st[0]}–${st[1]} · ${scoreText()}`; }
  if (ev === 'stb') { title = 'Super tie-break!'; sub = 'Um set para cada lado. Primeiro a 10 pontos, com 2 de diferença.'; }
  if (ev === 'match') { const pro = S.settings.format === 'pro'; title = mine ? (pro ? (d ? 'Vitória de vocês!' : 'Vitória!') : d ? 'Set de vocês!' : 'Set seu!') : pro ? 'Vitória ' + of : 'Set ' + of; sub = pro ? scoreText() + ' · ' + reason : reason;
    if (isTitle) { title = d ? 'CAMPEÕES!' : 'CAMPEÃO!'; sub = (S.careerActive ? crBoardTitle().replace(/ – .*/, '') : 'Campeonato') + ' · ' + reason; confetti(); cheerArena(5); }
  }
  banner(title, sub, 0, ev === 'match' || ev === 'game');
}
function setupPoint() {
  S.defPend = null;
  S.celebrate = null; S.ptCel = null; S.pressure = decisive(); S.hadDive = false;
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
      else if (p.team === S.server) p.pos.set(p.slot * 1.9, 0, Math.max(C.netH >= 1.79 ? 5.3 : 4.4, (S.zoneR || ZONE3) + .3) * s); // parceiro atrás da linha até o saque
      else p.pos.set(receiveX(p), 0, (ZONE3 + .3) * s);
    });
  }
  if (!sp.isHuman) S.aiServeT = 1.5;
  placeHeldBall(); resetTrail(); renderBoard();
  serveBanner(sp);
  if (NET.onSetupPoint) NET.onSetupPoint();
}
// aviso de quem saca (o convidado do online chama com o sacador do lado dele)
// na troca de lado o banner do saque avisa
function serveBanner(sp) {
  const note = S.sideNote; S.sideNote = false;
  serveBanner0(sp);
  if (note) el.bSub.textContent = '↔ Troca de lado: vento e sol agora do outro lado' + (el.bSub.textContent ? ' · ' + el.bSub.textContent : '');
}
function serveBanner0(sp) {
  const gold = isGolden();
  if (S.spectate) { banner(gold ? 'Ponto de ouro' : 'Saque de ' + whoName(sp), '', 1500, gold); return; }
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
  ESP: { line: '#c8102e', trim: '#c8102e', sand: '#f6e6c6', seat: '#c8102e', board: ['#c8102e', '#ffd23f'] },
  FRA: { line: '#2457c5', trim: '#ef4135', sand: '#f8eedc', seat: '#2457c5', board: ['#2457c5', '#ffffff'] },
  POR: { line: '#046a38', trim: '#da291c', sand: '#f6ead2', seat: '#da291c', board: ['#046a38', '#ffe900'] },
  ARU: { line: '#1f4fb8', trim: '#418fde', sand: '#fffdf8', seat: '#418fde', board: ['#418fde', '#fbe122'] },
  MUN: { line: '#111111', trim: '#e8a317', sand: '#fffaf0', seat: '#17324d', board: ['#111111', '#e8a317'] },
};
const TOUR_MASTERS = ['NUX', "HERUE'S", 'KUNA', 'ANA SPORT', 'MORMAJI', 'DROP SHUT', 'ZANB', 'VIZION'];
function arenaFor() {
  if (S.careerActive && $s.CR && $s.CR.tour) {
    const t = $s.CR.tour, n = (t.name || '').toLowerCase();
    const loc = t.tier >= 8 ? 'MUN' : /aruba/.test(n) ? 'ARU' : /cervia|ravenna|lignano|riccione|terracina/.test(n) ? 'ITA' : /barcelona|valência|valencia|canaria/.test(n) ? 'ESP' : /montpellier|saint-georges/.test(n) ? 'FRA' : /cascais/.test(n) ? 'POR' : 'BRA';
    const size = t.special === 'estadual' ? 1 : t.tier <= 2 ? 0 : t.tier <= 4 ? 1 : t.tier <= 6 ? 2 : 3;
    const stPal = t.uf && STATE_INFO[t.uf] ? STATE_INFO[t.uf].pal : null; // amadores e estaduais: cores do estado
    const indoor = (t.tier <= 2 || t.special === 'estadual') && /\b(arena|point)\b/i.test(t.name || ''); // points e arenas: ambiente fechado
    // patrocinador master do torneio (marcas de raquete): BT200 para cima sempre tem um, BT50/BT100 quase sempre; sempre o mesmo para o mesmo torneio na temporada
    let master = '';
    if (t.tier >= 4 && !t.special) { let h = 7; for (const ch of (t.name || '') + ($s.CR.season || 1)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      if (t.tier >= 6 || h % 100 < (t.tier >= 5 ? 85 : 65)) master = TOUR_MASTERS[(h >>> 8) % TOUR_MASTERS.length]; }
    return Object.assign({ size, indoor, master, amateur: t.tier <= 2 && !t.mixed, text: (t.name || '').replace(/ · (AMADOR [ABC]|BT\d+)$/, '').toUpperCase().slice(0, 26) }, stPal || ARENA_PAL[loc]);
  }
  if (S.champActive) return Object.assign({ size: 2, text: 'CAMPEONATO', master: TOUR_MASTERS[(S.champSeed || 0) % TOUR_MASTERS.length] }, ARENA_PAL.BRA);
  // partida rápida e online: modelo de quadra escolhido (no online vale o de quem criou a sala)
  const ct = COURTS[NET.role === 'guest' ? S.netCourt : S.settings.court] || COURTS.praia;
  return Object.assign({}, ct.a);
}
const COURTS = {
  praia: { nome: 'Praia (padrão)', a: { size: 0 } },
  amador: { nome: 'Torneio amador (público e quadras ao lado)', a: Object.assign({ size: 0, amateur: true, text: 'TORNEIO DA PRAIA' }, { line: '#1f4fb8', trim: '#ffd23f', sand: '#ffffff', board: ['#0a7d3c', '#ffd23f'] }) },
  brasil: { nome: 'Arena Brasil', a: Object.assign({ size: 2, text: 'BEACH TENNIS BRASIL' }, ARENA_PAL.BRA) },
  italia: { nome: 'Arena Itália', a: Object.assign({ size: 2, text: 'BEACH TENNIS ITALIA' }, ARENA_PAL.ITA) },
  espanha: { nome: 'Arena Espanha', a: Object.assign({ size: 2, text: 'BEACH TENIS ESPAÑA' }, ARENA_PAL.ESP) },
  franca: { nome: 'Arena França', a: Object.assign({ size: 2, text: 'BEACH TENNIS FRANCE' }, ARENA_PAL.FRA) },
  portugal: { nome: 'Arena Portugal', a: Object.assign({ size: 2, text: 'BEACH TÉNIS PORTUGAL' }, ARENA_PAL.POR) },
  aruba: { nome: 'Arena Aruba', a: Object.assign({ size: 2, text: 'ARUBA BEACH TENNIS' }, ARENA_PAL.ARU) },
  coberta: { nome: 'Arena coberta (sem vento)', a: Object.assign({ size: 0, amateur: true, indoor: true, text: 'ARENA COBERTA' }, ARENA_PAL.BRA) },
  estadio: { nome: 'Estádio do Mundial', a: Object.assign({ size: 3, text: 'CAMPEONATO MUNDIAL' }, ARENA_PAL.MUN) },
};
// guest: convidado do online (o estado vem do anfitrião: sem sorteio de saque/clima e sem montar o ponto)
function newMatch(guest) {
  S.drill = null; $s.players.forEach(q => { q.mErr = 0; q.mTend = null; });
  S.tutorial = !!S.tutPending; S.tutPending = false; S.ceremonyDone = false; // lição do tutorial: tudo em 1 estrela (só nesta partida)
  { const ar = arenaFor(); S.indoor = !!ar.indoor; applyArena(ar); } setBallStyle(S.settings.ballStyle || 'laranja');
  assignCharacters();
  configureMode();
  warmShaders();
  { // rede: 1,80 m só no profissional masculino (carreira: BT10 para cima); feminino, misto e amador: 1,70 m
    const allMale = $s.players.every(p => !p.char || !p.char.fem);
    const pro = S.careerActive && $s.CR && $s.CR.tour ? $s.CR.tour.tier >= 3 && !($s.CR.tour.special === 'estadual' && $s.CR.tour.tier < 3) : true;
    setNetHeight(allMale && pro ? 1.8 : 1.7);
    // linha do parceiro de quem saca (não passa dela até o saque ser batido): 6 m no profissional, como no circuito; 3 m no
    // amador. Quem recebe fica sempre atrás dos 3 m
    S.zoneR = pro ? 6 : ZONE3; setZoneLine(S.zoneR);
  }
  S.score = { pts: [0, 0], games: [0, 0], tb: false, sets: [0, 0], hist: [], stb: false };
  S.server = Math.random() < .5 ? 0 : 1; S.serverIdx = [0, 0]; S.tbPlayed = 0; S.matchWinner = null;
  S.highlights = []; S.clips = [];
  S.stats = { pts: [0, 0], maxRally: 0, smashes: 0 }; S.pstats = []; S.posHeat = new Array(64).fill(0); S.rallyLog = []; S.perf = { sum: 0, n: 0, ev: {} }; S.lastHit = null; S.attempt = null; S.streak = null;
  updateLiveRating();
  if (!guest) setWeather();
  el.over.hidden = true; el.menu.hidden = true; el.pause.hidden = true; S.paused = false;
  document.body.classList.remove('in-menu');
  clearPrints(); [human, partner, cpuA, cpuB].forEach(q => { q.sweat = 0; });
  applyCam(); applyGfx(); applyRackets(); applyPlayerStyle();
  if (guest) { S.mode = 'serve'; ball.state = 'held'; renderBoard(); return; }
  if (NET.onNewMatch) NET.onNewMatch();
  setupPoint();
}
// tabela do fim do jogo: pontos por golpe, erros forçados e não forçados de cada jogador e da dupla
function renderMatchStats() {
  const rows = [['Saque', 'saque'], ['Smash', 'smash'], ['Voleio', 'voleio'], ['Drive', 'drive'], ['Curta', 'curta'], ['Lob', 'lob'], ['Defesa', 'defesa']];
  const teams = $s.teams.map(tm => tm.map(p => ({ p, s: statOf(p) })));
  const win = s => rows.reduce((t, r) => t + s[r[1]], 0);
  const val = (s, k) => typeof k === 'function' ? k(s) : s[k];
  const sum = (tm, k) => tm.reduce((t, x) => t + val(x.s, k), 0);
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const head = teams.map((tm, ti) => tm.map(x => '<th class="t' + ti + '">' + flagSVG(x.p.char && x.p.char.pais) + ' ' + esc(x.p === human && !S.spectate ? 'VOCÊ' : x.p.char ? shortOf(x.p.char) : 'CPU') + '</th>').join('') + (tm.length > 1 ? '<th class="tt t' + ti + '">DUPLA</th>' : '')).join('');
  const line = (lbl, k, cls) => '<tr class="' + (cls || '') + '"><td>' + lbl + '</td>' + teams.map(tm => tm.map(x => '<td>' + val(x.s, k) + '</td>').join('') + (tm.length > 1 ? '<td class="tt">' + sum(tm, k) + '</td>' : '')).join('') + '</tr>';
  $('stTable').innerHTML = '<table class="mstats"><thead><tr><th></th>' + head + '</tr></thead><tbody>'
    + rows.map(r => line(r[0], r[1])).join('') + line('Pontos vencedores', win, 'sum')
    + line('Erros forçados', 'fe', 'err') + line('Erros não forçados', 'ue', 'err') + '</tbody></table>' + matchExtras(teams, win);
}
// como cada dupla ganhou os pontos (vencedores x erros do adversário), tamanho dos ralis e mapa de calor da sua posição
function matchExtras(teams, win) {
  const W = teams.map(tm => tm.reduce((t, x) => t + win(x.s), 0)), E = teams.map(tm => tm.reduce((t, x) => t + x.s.fe + x.s.ue, 0));
  const bar = ti => { const a = W[ti], b = E[1 - ti], tot = Math.max(1, a + b); return '<div class="mx-bar"><span class="t' + ti + '">' + esc2(ti === 0 ? (S.spectate ? teamNames(0) : dupla() ? 'Vocês' : 'Você') : teamNames(1)) + '</span><div><i class="win" style="width:' + (a / tot * 100) + '%">' + (a || '') + '</i><i class="err" style="width:' + (b / tot * 100) + '%">' + (b || '') + '</i></div></div>'; };
  const R = S.rallyLog || [], B = [[1, 2], [3, 4], [5, 6], [7, 9], [10, 99]], cnt = B.map(([a, b]) => R.filter(r => r >= a && r <= b).length), mx = Math.max(1, ...cnt);
  const hist = '<div class="mx-hist">' + B.map(([a, b], i) => '<div><i style="height:' + (cnt[i] / mx * 100) + '%"></i><small>' + (b > 50 ? a + '+' : a + '–' + b) + '</small></div>').join('') + '</div>';
  let heat = '';
  if (S.posHeat && S.posHeat.some(v => v > 0) && !S.spectate) { const c = document.createElement('canvas'); c.width = 96; c.height = 96; const x = c.getContext('2d'), mxh = Math.max(...S.posHeat);
    x.fillStyle = '#d9c49a'; x.fillRect(0, 0, 96, 96);
    S.posHeat.forEach((v, i) => { if (!v) return; const col = i % 8, row = Math.floor(i / 8), k = v / mxh; x.fillStyle = 'rgba(' + Math.round(255) + ',' + Math.round(200 - 170 * k) + ',' + Math.round(40) + ',' + (.15 + .75 * k) + ')'; x.fillRect(col * 12, row * 12, 12, 12); });
    x.strokeStyle = '#fff'; x.lineWidth = 2; x.strokeRect(1, 1, 94, 94); x.fillStyle = '#fff'; x.fillRect(0, 0, 96, 3); // rede em cima
    heat = '<div class="mx-heat"><img src="' + c.toDataURL() + '" alt=""><small>Onde você jogou (rede em cima)</small></div>'; }
  return '<div class="mx"><div><p class="section-label">Como os pontos foram ganhos</p>' + bar(0) + bar(1) + '<small class="mx-leg"><i class="win"></i> golpes vencedores <i class="err"></i> erros do adversário</small></div>'
    + '<div><p class="section-label">Tamanho dos ralis (golpes)</p>' + hist + '</div>' + heat + '</div>';
}
const esc2 = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
// carreira: simula o resto da partida ponto a ponto, pela força das duplas (e as estrelas); a nota fica a do que já foi jogado
function simulateRest() {
  if (!S.careerActive || NET.role || S.mode === 'over') return;
  const str = t => { const l = $s.teams[t] || []; return l.reduce((x, p) => x + (p.char ? overall(p.char.a) : 70), 0) / Math.max(1, l.length); };
  const stars = S.careerStars || 3, pA = clamp(1 / (1 + Math.exp(-(str(0) - str(1)) / 10)) - (stars - 3) * .03, .08, .92);
  let r = null, n = 0;
  while (r !== 'match' && n++ < 2000) r = awardPoint(Math.random() < pA ? 0 : 1);
  if (S.matchWinner === null || S.matchWinner === undefined) return;
  landRing.visible = false; S.mode = 'dead'; hideBanner();
  showOver();
}
function showOver() {
  S.mode = 'over'; hideBanner();
  const w = S.matchWinner, g = S.score.games;
  const dn = !S.careerActive && !S.champActive && !NET.role && S.settings.aiMode ? { treinada: 'IA treinada', planejadora: 'IA planejadora' }[S.settings.aiMode] : { facil: 'fácil', medio: 'médio', dificil: 'difícil' }[S.settings.diff];
  $('overEyebrow').textContent = `Fim de set · ${dupla() ? 'dupla' : 'simples'} · ${dn}`;
  const wonBy = t => teamNames(t).toUpperCase() + ($s.teams[t].length > 1 ? ' VENCERAM' : ' VENCEU');
  $('overTitle').textContent = S.spectate ? wonBy(w) : w === 0 ? (dupla() ? 'VOCÊS VENCERAM' : 'VOCÊ VENCEU') : teamHuman(1) ? wonBy(1) : 'A CPU VENCEU';
  $('overScore').textContent = scoreText();
  $('stPts').textContent = `${S.stats.pts[0]}–${S.stats.pts[1]}`;
  $('stRally').textContent = S.stats.maxRally;
  $('stSmash').textContent = S.stats.smashes;
  try { renderMatchStats(); } catch (e) { console.error('estatísticas', e); } // nada aqui pode impedir o XP e o V–D do fim
  // nota do seu jogador
  const rating = (() => { try { return matchRating(w === 0); } catch (e) { return null; } })();
  if (rating !== null) {
    const sm = perfSummary(), esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    prependStats('<div class="perf-box"><div class="perf-n' + (rating >= 7.5 ? ' hi' : rating < 5.5 ? ' lo' : '') + '">' + rating.toFixed(1).replace('.', ',') + '<small>SUA NOTA</small></div><div><b>' + (sm.good.length ? esc(sm.good.join(' · ')) : 'Pouca participação nos pontos') + '</b>' + (sm.bad.length ? '<span>' + esc(sm.bad.join(' · ')) + '</span>' : '') + '</div></div>');
  }
  const inChamp = !!S.champActive, inCareer = !!S.careerActive;
  if (inChamp && !NET.role) champMatchEnded(w === 0); // (campeonato local: um aberto antes não conta numa partida online)
  if (inCareer) { // carreira: o que a partida rendeu (potencial e pontos de evolução) com a barrinha até o próximo número
    const pot0 = $s.CR ? $s.CR.potCur : 0, pe0 = $s.CR ? $s.CR.pe : 0;
    careerMatchEnded(w === 0, rating === null ? undefined : rating);
    if ($s.CR) try { const dp = ($s.CR.potCur || 0) - (pot0 || 0), de = Math.round(($s.CR.pe - pe0) * 10) / 10;
      prependStats('<div class="cr-note perf-pot">Carreira: ' + (de > 0 ? '+' + String(de).replace('.', ',') + ' pontos de evolução · ' : '') + (Math.abs(dp) > .004 ? 'potencial ' + (dp > 0 ? '+' : '−') + Math.abs(dp).toFixed(2).replace('.', ',') : 'potencial sem mudança' + (rating !== null && rating < 5.5 ? ' (nota abaixo de 5,5)' : '')) + crPotBarHTML(0) + '</div>'); } catch (e) { console.error('potencial', e); }
  }
  // nível da conta: XP por partida da carreira e do online (quem só assiste não ganha)
  if (S.onMatchEnd && !S.spectate && (inCareer || NET.role)) try { S.onMatchEnd({ won: w === 0, career: inCareer, online: !!NET.role, rating, pts: S.stats.pts, addLine: prependStats }); } catch (e) { console.error('xp', e); }
  $('btnOverChamp').hidden = !inChamp; $('btnOverCareer').hidden = !inCareer; $('btnAgain').hidden = inChamp || inCareer;
  $('btnReplay').hidden = !(S.highlights && S.highlights.length);
  el.over.hidden = false;
}

export { sideWalkStep, simulateRest, perfHitHook, DRILL_LVL, COURTS, showReview, shotFeedback, perfShot, matchRating, pointShow, serveBanner, renderMatchStats, banner, DRILLS, startDrill, drillNext, momentum, decisive, scoreText, $, configureMode, dupla, el, feedback, hideBanner, isTouch, newMatch, placeHeldBall, pointTo, renderBoard, setupPoint, shotBtns, showOver };
