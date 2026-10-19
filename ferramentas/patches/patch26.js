const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };

// ---------- HTML ----------
rep('      <button class="cta" id="btnPlay">Jogar</button>', '      <button class="cta" id="btnPlay">Jogar</button>\n      <button class="ghost" id="btnChamp">Campeonato</button>');
rep('<!-- Pausa -->', `<!-- Campeonato -->
<div id="champ" class="overlay" hidden>
  <div class="card" style="width:min(100%,800px)">
    <div><div class="eyebrow" id="champEyebrow">Modo campeonato · chave de 8 duplas</div><h2 class="title" style="font-size:clamp(34px,7vw,52px)">CAMPEONATO</h2></div>
    <div id="champSetup" style="display:grid;gap:14px">
      <fieldset class="seg"><legend>Categoria</legend><div class="pills">
        <input type="radio" name="champCat" id="ccM" value="masc" checked><label for="ccM">Masculino</label>
        <input type="radio" name="champCat" id="ccF" value="fem"><label for="ccF">Feminino</label>
        <input type="radio" name="champCat" id="ccX" value="misto"><label for="ccX">Misto</label>
      </div></fieldset>
      <div><p class="section-label">Escolha sua dupla</p><div id="champTeams" class="teamlist"></div></div>
      <fieldset class="seg"><legend>Você joga com</legend><div class="pills" id="champCtrl"></div></fieldset>
      <div class="cta-row"><button class="cta" id="btnChampStart">Começar campeonato</button><button class="ghost" id="btnChampBack">Voltar</button></div>
    </div>
    <div id="champBracket" hidden style="display:grid;gap:14px">
      <div class="bracket-wrap"><div id="bracket" class="bracket"></div></div>
      <p id="champMsg" class="lede"></p>
      <div class="cta-row"><button class="cta" id="btnChampPlay">Jogar próxima partida</button><button class="ghost" id="btnChampNew">Novo campeonato</button><button class="ghost" id="btnChampMenu">Menu</button></div>
    </div>
  </div>
</div>

<!-- Pausa -->`);
rep('      <button class="cta" id="btnAgain">Jogar de novo</button>', '      <button class="cta" id="btnOverChamp" hidden>Ver a chave</button>\n      <button class="cta" id="btnAgain">Jogar de novo</button>');
rep(".toggles { display: grid; gap: 8px; }", `.toggles { display: grid; gap: 8px; }
.teamlist { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 6px; max-height: 300px; overflow-y: auto; padding: 2px; }
.teamlist button { text-align: left; border: 2px solid #e3d9c4; background: #fff; border-radius: 10px; padding: 7px 10px; font: 600 13px var(--f-body); color: var(--ink); display: grid; gap: 2px; }
.teamlist button.sel { border-color: var(--buoy); box-shadow: 0 0 0 3px rgba(255, 90, 31, .18); }
.teamlist button small { font-weight: 600; font-size: 11px; color: #5b6b78; }
.teamlist .real { font-size: 10px; font-weight: 800; letter-spacing: .08em; color: #2e9e63; text-transform: uppercase; }
.bracket-wrap { overflow-x: auto; }
.bracket { display: grid; grid-template-columns: repeat(3, minmax(170px, 1fr)); gap: 12px; align-items: center; min-width: 540px; }
.bracket .rd { display: grid; gap: 10px; }
.bracket h4 { margin: 0; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.bracket .m { border: 1.5px solid #e3d9c4; border-radius: 10px; background: #fff; padding: 6px 8px; display: grid; gap: 3px; font-size: 12px; }
.bracket .m.mine { border-color: var(--buoy); }
.bracket .tm { display: flex; justify-content: space-between; gap: 8px; }
.bracket .tm b { font-family: var(--f-num); font-size: 11px; color: var(--muted); }
.bracket .tm.w { font-weight: 800; }
.bracket .tm.l { opacity: .5; text-decoration: line-through; }
.bracket .tm.me { color: #c2410c; }
.champion { font-family: var(--f-display); font-size: 22px; color: var(--ink); }`);

// ---------- JS ----------
rep("function startFromMenu() {", `// ---------- Campeonato ----------
// duplas que jogam juntas no circuito (ids do elenco); quem não tiver par conhecido é pareado pelo ranking
const REAL_PAIRS = {
  masc: [['capeletti', 'barao']],
  fem: [],
  misto: [],
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
let champPick = { cat: 'masc', team: 0, ctrl: 0 };
function renderChampSetup() {
  const list = champTeams(champPick.cat);
  champPick.team = clamp(champPick.team, 0, list.length - 1);
  $('champTeams').innerHTML = list.map((t, i) => '<button type="button" data-i="' + i + '" class="' + (i === champPick.team ? 'sel' : '') + '">' + teamName(t) + ' <small>OVR ' + teamOvr(t) + ' · ' + nameOf(charById(t.a)) + ' e ' + nameOf(charById(t.b)) + '</small>' + (t.real ? '<span class="real">dupla real</span>' : '') + '</button>').join('');
  $('champTeams').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { champPick.team = +b.dataset.i; champPick.ctrl = 0; renderChampSetup(); }));
  const t = list[champPick.team];
  $('champCtrl').innerHTML = [t.a, t.b].map((id, i) => '<input type="radio" name="champCtrlR" id="cc' + i + '" value="' + i + '"' + (i === champPick.ctrl ? ' checked' : '') + '><label for="cc' + i + '">' + nameOf(charById(id)) + '</label>').join('');
  $('champCtrl').querySelectorAll('input').forEach(r => r.addEventListener('change', () => { champPick.ctrl = +r.value; }));
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
$('btnChampBack').addEventListener('click', () => { $('champ').hidden = true; el.menu.hidden = false; });
$('btnChampPlay').addEventListener('click', playChampMatch);
$('btnChampNew').addEventListener('click', () => { CH = null; saveChamp(); $('champSetup').hidden = false; $('champBracket').hidden = true; renderChampSetup(); });
$('btnChampMenu').addEventListener('click', () => { $('champ').hidden = true; toMenu(); });
$('btnOverChamp').addEventListener('click', () => { el.over.hidden = true; showBracket(); });
function startFromMenu() {`);
rep("  el.over.hidden = false;", "  const inChamp = !!S.champActive;\n  if (inChamp) champMatchEnded(w === 0);\n  $('btnOverChamp').hidden = !inChamp; $('btnAgain').hidden = inChamp;\n  el.over.hidden = false;");
fs.writeFileSync(f, s);
console.log('ok');
