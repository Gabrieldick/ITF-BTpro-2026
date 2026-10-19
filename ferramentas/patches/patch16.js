const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };
function between(startMark, endMark, repl) {
  const a = s.indexOf(startMark); if (a < 0) throw new Error('start not found: ' + startMark);
  const b = s.indexOf(endMark, a + startMark.length); if (b < 0) throw new Error('end not found: ' + endMark);
  s = s.slice(0, a) + repl + s.slice(b);
}

rep(`      <p class="section-label">Jogadores · overall de 0 a 100</p>`, `      <p class="section-label">Jogadores · overall de 0 a 100</p>
      <fieldset class="seg" style="margin-bottom:10px"><legend>Elenco</legend><div class="pills">
        <input type="radio" name="gender" id="gMix" value="mista" checked><label for="gMix">Misto</label>
        <input type="radio" name="gender" id="gMasc" value="masc"><label for="gMasc">Masculino</label>
        <input type="radio" name="gender" id="gFem" value="fem"><label for="gFem">Feminino</label>
      </div></fieldset>`);
rep(".toggles { display: grid; gap: 8px; }", `.toggles { display: grid; gap: 8px; }
.psel { width: 100%; font: 600 13px var(--f-body); color: var(--ink); background: #f7f2e7; border: 2px solid #e3d9c4; border-radius: 8px; padding: 5px 6px; }`);
rep("settings: { pick: {", "settings: { gender: 'mista', pick: {");

between("const SLOT_LABEL = {", "function startFromMenu() {", `const SLOT_LABEL = { me: 'Você', mate: 'Sua dupla', o1: 'Adversário', o2: 'Adversário 2' };
const activeSlots = () => dupla() ? ['me', 'mate', 'o1', 'o2'] : ['me', 'o1'];
// personagens disponíveis no filtro, do maior overall para o menor
function pool() {
  const g = S.settings.gender;
  return ROSTER.filter(c => g === 'mista' || (g === 'fem' ? c.fem : !c.fem)).sort((x, y) => overall(y.a) - overall(x.a));
}
function fixPicks() {
  const pl = pool(), used = new Set();
  activeSlots().forEach(k => {
    const id = S.settings.pick[k];
    if (pl.some(c => c.id === id) && !used.has(id)) { used.add(id); return; }
    const free = pl.find(c => !used.has(c.id)); if (free) { S.settings.pick[k] = free.id; used.add(free.id); }
  });
}
function renderPick(slot) {
  const box = document.querySelector('.pick[data-slot="' + slot + '"]'); if (!box) return;
  const c = charById(S.settings.pick[slot]);
  box.hidden = !activeSlots().includes(slot);
  const others = new Set(activeSlots().filter(k => k !== slot).map(k => S.settings.pick[k]));
  const opts = pool().map(o => '<option value="' + o.id + '"' + (o.id === c.id ? ' selected' : '') + (others.has(o.id) ? ' disabled' : '') + '>' + overall(o.a) + ' · ' + nameOf(o).replace(/</g, '') + ' (' + o.pais + ')' + (others.has(o.id) ? ' · em uso' : '') + '</option>').join('');
  const bars = ATTRS.map(([k, lbl]) => { const v = c.a[k]; return '<span>' + lbl + '</span><span class="bar"><i class="' + (v >= 85 ? 'hi' : v <= 65 ? 'lo' : '') + '" style="width:' + v + '%"></i></span><b>' + v + '</b>'; }).join('');
  box.innerHTML = '<div class="pick-h"><span class="who">' + SLOT_LABEL[slot] + '</span><button type="button" class="arw" data-d="-1" aria-label="Anterior">‹</button><button type="button" class="arw" data-d="1" aria-label="Próximo">›</button></div>'
    + '<select class="psel" id="sel-' + slot + '" aria-label="Escolher jogador da lista">' + opts + '</select>'
    + '<div class="pick-top"><div style="min-width:0"><input class="pnm" type="text" id="nm-' + slot + '" maxlength="28" aria-label="Nome do jogador"><div class="meta">' + c.pais + ' · ' + c.estilo + (c.fem ? ' · feminino' : ' · masculino') + '</div></div>'
    + '<div class="ovr">' + overall(c.a) + '<small>OVR</small></div></div><div class="bars">' + bars + '</div>';
  const inp = box.querySelector('.pnm'); inp.value = nameOf(c);
  inp.addEventListener('input', () => { NAMES[c.id] = inp.value; try { localStorage.setItem('pdo-names', JSON.stringify(NAMES)); } catch (e) {} });
  inp.addEventListener('change', renderRoster);
  box.querySelector('.psel').addEventListener('change', e => { S.settings.pick[slot] = e.target.value; saveSettings(); renderRoster(); });
  box.querySelectorAll('.arw').forEach(b => b.addEventListener('click', () => cyclePick(slot, +b.dataset.d)));
}
function renderRoster() { fixPicks(); ['me', 'mate', 'o1', 'o2'].forEach(renderPick); }
function cyclePick(slot, d) {
  const pl = pool(); if (!pl.length) return;
  const used = new Set(activeSlots().filter(k => k !== slot).map(k => S.settings.pick[k]));
  let i = pl.findIndex(c => c.id === S.settings.pick[slot]);
  for (let n = 0; n < pl.length; n++) { i = (i + d + pl.length) % pl.length; if (!used.has(pl[i].id)) break; }
  S.settings.pick[slot] = pl[i].id; saveSettings(); renderRoster();
}
document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', () => { S.settings.mode = r.value; renderRoster(); }));
document.querySelectorAll('input[name=gender]').forEach(r => r.addEventListener('change', () => { S.settings.gender = r.value; saveSettings(); renderRoster(); }));
`);
rep("set('racket', S.settings.racket); set('players', S.settings.players);", "set('racket', S.settings.racket); set('players', S.settings.players); set('gender', S.settings.gender);");
fs.writeFileSync(f, s);
console.log('ok');
