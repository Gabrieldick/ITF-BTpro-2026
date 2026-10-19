const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };

// duplas reais da temporada 2026 (Mundial de Matosinhos, Pan-Americano de Cuiabá, Sand Series Cesenatico, BT400 Feira de Santana)
rep(`const REAL_PAIRS = {
  masc: [['capeletti', 'barao']],
  fem: [],
  misto: [],
};`, `const REAL_PAIRS = {
  masc: [['spot', 'gianote'], ['barao', 'capeletti'], ['gigio', 'mola'], ['lock', 'branco'], ['ramires', 'allan']],
  fem: [['kudina', 'semena'], ['chou', 'marquezin'], ['gaspar', 'valentim'], ['casadi', 'grael'], ['cimadi', 'daino'], ['tripa', 'vida'], ['dias', 'miler'], ['justi', 'nobre']],
  misto: [['barao', 'valentim'], ['gigio', 'marquezin'], ['lock', 'chou'], ['mola', 'nogueiro'], ['ramires', 'grael'], ['burmak', 'daino']],
};`);
// dupla montada pelo jogador entra primeiro; quem ficou sem par é repareado pelo ranking
rep(`  const used = new Set(), out = [];
  (REAL_PAIRS[cat] || []).forEach(`, `  const used = new Set(), out = [];
  const cu = champPick.custom && champPick.custom[cat];
  if (cu && charById(cu.a).id === cu.a && charById(cu.b).id === cu.b && cu.a !== cu.b) { out.push({ a: cu.a, b: cu.b, custom: true }); used.add(cu.a); used.add(cu.b); }
  (REAL_PAIRS[cat] || []).forEach(`);
rep("  return out.sort((x, y) => teamOvr(y) - teamOvr(x));\n}\nlet champPick = { cat: 'masc', team: 0, ctrl: 0 };", "  return out.sort((x, y) => teamOvr(y) - teamOvr(x));\n}\nlet champPick = { cat: 'masc', team: 0, ctrl: 0, custom: {} };");
rep("(t.real ? '<span class=\"real\">dupla real</span>' : '') + '</button>').join('');", "(t.custom ? '<span class=\"real\" style=\"color:#c2410c\">sua dupla</span>' : t.real ? '<span class=\"real\">dupla real</span>' : '') + '</button>').join('');");
rep("  $('champCtrl').querySelectorAll('input').forEach(r => r.addEventListener('change', () => { champPick.ctrl = +r.value; }));\n}", `  $('champCtrl').querySelectorAll('input').forEach(r => r.addEventListener('change', () => { champPick.ctrl = +r.value; }));
  // montar a própria dupla
  const byOvr = (x, y) => overall(y.a) - overall(x.a);
  const poolA = ROSTER.filter(c => champPick.cat === 'fem' ? c.fem : !c.fem).sort(byOvr);
  const poolB = ROSTER.filter(c => champPick.cat === 'masc' ? !c.fem : c.fem).sort(byOvr);
  const cu = champPick.custom[champPick.cat] || { a: t.a, b: t.b };
  const opt = (pool, sel) => pool.map(c => '<option value="' + c.id + '"' + (c.id === sel ? ' selected' : '') + '>' + overall(c.a) + ' · ' + nameOf(c) + '</option>').join('');
  $('cpA').innerHTML = opt(poolA, cu.a); $('cpB').innerHTML = opt(poolB, cu.b);
}`);
rep(`      <fieldset class="seg"><legend>Você joga com</legend><div class="pills" id="champCtrl"></div></fieldset>`, `      <div><p class="section-label">Ou monte a sua dupla</p>
        <div class="cta-row"><select class="psel" id="cpA" style="flex:1;min-width:180px" aria-label="Jogador 1"></select><select class="psel" id="cpB" style="flex:1;min-width:180px" aria-label="Jogador 2"></select><button class="ghost" id="btnCustom" type="button">Usar esta dupla</button></div>
      </div>
      <fieldset class="seg"><legend>Você joga com</legend><div class="pills" id="champCtrl"></div></fieldset>`);
rep("$('btnChampStart').addEventListener('click', startChampionship);", `$('btnChampStart').addEventListener('click', startChampionship);
$('btnCustom').addEventListener('click', () => {
  const a = $('cpA').value, b = $('cpB').value;
  if (!a || !b || a === b) return;
  champPick.custom[champPick.cat] = { a, b };
  const list = champTeams(champPick.cat);
  champPick.team = Math.max(0, list.findIndex(t => t.custom)); champPick.ctrl = 0;
  renderChampSetup();
});`);
fs.writeFileSync(f, s);
console.log('ok');
