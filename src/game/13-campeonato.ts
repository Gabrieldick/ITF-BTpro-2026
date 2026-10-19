// @ts-nocheck
// modo campeonato
import './12-controles';
import { ROSTER, charById, clamp, nameOf, overall, shortOf } from './00-base';
import { S } from './01-estado';
import { ac } from './08-audio';
import { $, el, newMatch } from './09-interface';
import { readMenu } from './12-controles';
import { toMenu } from './15-carreira-telas';
// ---------- Campeonato ----------
// duplas que jogam juntas no circuito (ids do elenco); quem não tiver par conhecido é pareado pelo ranking
const REAL_PAIRS = {
  masc: [['spot', 'gianote'], ['barao', 'capeletti'], ['gigio', 'mola'], ['lock', 'branco'], ['ramires', 'allan']],
  fem: [['kudina', 'semena'], ['chou', 'marquezin'], ['gaspar', 'valentim'], ['casadi', 'grael'], ['cimadi', 'daino'], ['tripa', 'vida'], ['dias', 'miler'], ['justi', 'nobre']],
  misto: [['barao', 'valentim'], ['gigio', 'marquezin'], ['lock', 'chou'], ['mola', 'nogueiro'], ['ramires', 'grael'], ['burmak', 'daino']],
};
let CH = null;
try { CH = JSON.parse(localStorage.getItem('pdo-champ') || 'null'); } catch (e) { CH = null; }
const saveChamp = () => { try { localStorage.setItem('pdo-champ', JSON.stringify(CH)); } catch (e) {} };
const teamOvr = t => Math.round((overall(charById(t.a).a) + overall(charById(t.b).a)) / 2);
const teamName = t => shortOf(charById(t.a)) + ' / ' + shortOf(charById(t.b));
function champTeams(cat) {
  const byOvr = (x, y) => overall(y.a) - overall(x.a);
  const men = ROSTER.filter(c => !c.fem).sort(byOvr), women = ROSTER.filter(c => c.fem).sort(byOvr);
  const used = new Set(), out = [];
  const cu = champPick.custom && champPick.custom[cat];
  if (cu && charById(cu.a).id === cu.a && charById(cu.b).id === cu.b && cu.a !== cu.b) { out.push({ a: cu.a, b: cu.b, custom: true }); used.add(cu.a); used.add(cu.b); }
  (REAL_PAIRS[cat] || []).forEach(([a, b]) => { if (charById(a).id === a && charById(b).id === b && !used.has(a) && !used.has(b)) { out.push({ a, b, real: true }); used.add(a); used.add(b); } });
  if (cat === 'misto') {
    const m = men.filter(c => !used.has(c.id)), w = women.filter(c => !used.has(c.id));
    for (let i = 0; i < Math.min(m.length, w.length); i++) out.push({ a: m[i].id, b: w[i].id });
  } else {
    const pool = (cat === 'fem' ? women : men).filter(c => !used.has(c.id));
    for (let i = 0; i + 1 < pool.length; i += 2) out.push({ a: pool[i].id, b: pool[i + 1].id });
  }
  return out.sort((x, y) => teamOvr(y) - teamOvr(x));
}
let champPick = { cat: 'masc', team: 0, ctrl: 0, custom: {} };
function renderChampSetup() {
  const list = champTeams(champPick.cat);
  champPick.team = clamp(champPick.team, 0, list.length - 1);
  $('champTeams').innerHTML = list.map((t, i) => '<button type="button" data-i="' + i + '" class="' + (i === champPick.team ? 'sel' : '') + '">' + teamName(t) + ' <small>OVR ' + teamOvr(t) + ' · ' + nameOf(charById(t.a)) + ' e ' + nameOf(charById(t.b)) + '</small>' + (t.custom ? '<span class="real" style="color:#c2410c">sua dupla</span>' : t.real ? '<span class="real">dupla real</span>' : '') + '</button>').join('');
  $('champTeams').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { champPick.team = +b.dataset.i; champPick.ctrl = 0; renderChampSetup(); }));
  const t = list[champPick.team];
  $('champCtrl').innerHTML = [t.a, t.b].map((id, i) => '<input type="radio" name="champCtrlR" id="cc' + i + '" value="' + i + '"' + (i === champPick.ctrl ? ' checked' : '') + '><label for="cc' + i + '">' + nameOf(charById(id)) + '</label>').join('');
  $('champCtrl').querySelectorAll('input').forEach(r => r.addEventListener('change', () => { champPick.ctrl = +r.value; }));
  // montar a própria dupla
  const byOvr = (x, y) => overall(y.a) - overall(x.a);
  const poolA = ROSTER.filter(c => champPick.cat === 'fem' ? c.fem : !c.fem).sort(byOvr);
  const poolB = ROSTER.filter(c => champPick.cat === 'masc' ? !c.fem : c.fem).sort(byOvr);
  const cu = champPick.custom[champPick.cat] || { a: t.a, b: t.b };
  const opt = (pool, sel) => pool.map(c => '<option value="' + c.id + '"' + (c.id === sel ? ' selected' : '') + '>' + overall(c.a) + ' · ' + nameOf(c) + '</option>').join('');
  $('cpA').innerHTML = opt(poolA, cu.a); $('cpB').innerHTML = opt(poolB, cu.b);
}
const SEED_ORDER = [[0, 7], [3, 4], [2, 5], [1, 6]];
function startChampionship() {
  const list = champTeams(champPick.cat).slice(0, 8);
  const me = list[champPick.team] ? champPick.team : 0;
  const myTeam = champTeams(champPick.cat)[champPick.team];
  let teamsSel = list;
  if (!list.includes(list.find(t => t.a === myTeam.a && t.b === myTeam.b))) { teamsSel = list.slice(0, 7).concat([myTeam]); }
  const idx = teamsSel.findIndex(t => t.a === myTeam.a && t.b === myTeam.b);
  CH = { cat: champPick.cat, teams: teamsSel, me: idx, ctrl: champPick.ctrl, round: 0, alive: true, champion: null,
    rounds: [SEED_ORDER.map(([a, b]) => ({ a: a < teamsSel.length ? a : -1, b: b < teamsSel.length ? b : -1, w: null, score: '' })), [], []] };
  resolveByes(0); saveChamp(); showBracket();
}
function resolveByes(r) { CH.rounds[r].forEach(m => { if (m.w === null && (m.a < 0 || m.b < 0)) { m.w = m.a < 0 ? m.b : m.a; m.score = 'passa direto'; } }); }
function simMatch(m) {
  const A = CH.teams[m.a], B = CH.teams[m.b];
  const pA = 1 / (1 + Math.exp(-(teamOvr(A) - teamOvr(B)) / 2.5));
  m.w = Math.random() < pA ? m.a : m.b;
  const N = S.settings.games; m.score = N + '–' + Math.floor(Math.random() * (N - 1));
}
function advanceRound() {
  const r = CH.round, cur = CH.rounds[r];
  cur.forEach(m => { if (m.w === null) simMatch(m); });
  if (cur.length === 1) { CH.champion = cur[0].w; CH.round = 3; return; }
  CH.rounds[r + 1] = [];
  for (let k = 0; k < cur.length; k += 2) CH.rounds[r + 1].push({ a: cur[k].w, b: cur[k + 1].w, w: null, score: '' });
  CH.round = r + 1;
}
function myMatch() { if (!CH || CH.round > 2) return null; return CH.rounds[CH.round].find(m => m.w === null && (m.a === CH.me || m.b === CH.me)) || null; }
function showBracket() {
  $('champSetup').hidden = true; $('champBracket').hidden = false; el.menu.hidden = true; el.over.hidden = true; $('champ').hidden = false;
  document.body.classList.add('in-menu');
  const names = ['Quartas', 'Semifinal', 'Final'];
  const catName = { masc: 'masculino', fem: 'feminino', misto: 'misto' }[CH.cat];
  $('champEyebrow').textContent = 'Campeonato ' + catName + ' · ' + S.settings.games + ' games por partida';
  $('bracket').innerHTML = CH.rounds.map((rd, r) => '<div class="rd"><h4>' + names[r] + '</h4>' + (rd.length ? rd.map(m => {
    const row = i => { if (i < 0) return '<div class="tm l">—<b></b></div>'; const t = CH.teams[i]; const cls = (m.w === null ? '' : m.w === i ? 'w' : 'l') + (i === CH.me ? ' me' : ''); return '<div class="tm ' + cls + '">' + teamName(t) + '<b>' + teamOvr(t) + '</b></div>'; };
    return '<div class="m' + (m.a === CH.me || m.b === CH.me ? ' mine' : '') + '">' + row(m.a) + row(m.b) + (m.score ? '<div class="tm"><b>' + m.score + '</b></div>' : '') + '</div>';
  }).join('') : '<div class="m"><div class="tm l">a definir</div></div>') + '</div>').join('');
  const mm = myMatch();
  let msg = '';
  if (CH.champion !== null) msg = CH.champion === CH.me ? '<span class="champion">🏆 Vocês são campeões!</span>' : 'Campeões: <b>' + teamName(CH.teams[CH.champion]) + '</b>.' + (CH.alive ? '' : ' Vocês caíram antes, tente de novo.');
  else if (mm) { const opp = CH.teams[mm.a === CH.me ? mm.b : mm.a]; msg = 'Próximo jogo (' + names[CH.round] + '): contra <b>' + teamName(opp) + '</b> · OVR ' + teamOvr(opp) + '.'; }
  else if (!CH.alive) msg = 'Vocês foram eliminados.';
  $('champMsg').innerHTML = msg;
  $('btnChampPlay').hidden = !mm;
}
function champBoardTitle() { if (!CH) return ''; const n = ['QUARTAS', 'SEMIFINAL', 'FINAL'][CH.round] || ''; return 'CAMPEONATO' + (n ? ' – ' + n : ''); }
function playChampMatch() {
  const mm = myMatch(); if (!mm) return;
  const mine = CH.teams[CH.me], opp = CH.teams[mm.a === CH.me ? mm.b : mm.a];
  CH.prev = { pick: Object.assign({}, S.settings.pick), mode: S.settings.mode };
  S.settings.mode = 'dupla';
  S.settings.pick = { me: CH.ctrl ? mine.b : mine.a, mate: CH.ctrl ? mine.a : mine.b, o1: opp.a, o2: opp.b };
  S.champActive = true; saveChamp();
  $('champ').hidden = true; ac(); newMatch();
}
function champMatchEnded(won) {
  S.champActive = false;
  const mm = myMatch(); if (!mm) return;
  const N = S.settings.games, g = S.score.games;
  mm.w = won ? CH.me : (mm.a === CH.me ? mm.b : mm.a);
  mm.score = Math.max(g[0], g[1]) + '–' + Math.min(g[0], g[1]);
  if (!won) CH.alive = false;
  advanceRound();
  if (!CH.alive) while (CH.champion === null) advanceRound(); // simula o resto para mostrar o campeão
  if (CH.prev) { S.settings.pick = CH.prev.pick; S.settings.mode = CH.prev.mode; }
  saveChamp();
}
$('btnChamp').addEventListener('click', () => { readMenu(); el.menu.hidden = true; $('champ').hidden = false; if (CH && CH.champion === null && CH.alive) showBracket(); else { $('champSetup').hidden = false; $('champBracket').hidden = true; renderChampSetup(); } });
document.querySelectorAll('input[name=champCat]').forEach(r => r.addEventListener('change', () => { champPick.cat = r.value; champPick.team = 0; champPick.ctrl = 0; renderChampSetup(); }));
$('btnChampStart').addEventListener('click', startChampionship);
$('btnCustom').addEventListener('click', () => {
  const a = $('cpA').value, b = $('cpB').value;
  if (!a || !b || a === b) return;
  champPick.custom[champPick.cat] = { a, b };
  const list = champTeams(champPick.cat);
  champPick.team = Math.max(0, list.findIndex(t => t.custom)); champPick.ctrl = 0;
  renderChampSetup();
});
$('btnChampBack').addEventListener('click', () => { $('champ').hidden = true; el.menu.hidden = false; });
$('btnChampPlay').addEventListener('click', playChampMatch);
$('btnChampNew').addEventListener('click', () => { CH = null; saveChamp(); $('champSetup').hidden = false; $('champBracket').hidden = true; renderChampSetup(); });
$('btnChampMenu').addEventListener('click', () => { $('champ').hidden = true; toMenu(); });
$('btnOverChamp').addEventListener('click', () => { el.over.hidden = true; showBracket(); });

export { champBoardTitle, champMatchEnded };
