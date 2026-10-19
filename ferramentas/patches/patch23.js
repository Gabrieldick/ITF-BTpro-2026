const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };

rep("const ATTRS = [['forca', 'Força'], ['vel', 'Velocidade'], ['def', 'Defesa'], ['curta', 'Curta'], ['lob', 'Lob'], ['smash', 'Smash'], ['saque', 'Saque']];",
    "const ATTRS = [['forca', 'Força'], ['vel', 'Velocidade'], ['def', 'Defesa'], ['backhand', 'Backhand'], ['curta', 'Curta'], ['lob', 'Lob'], ['smash', 'Smash'], ['saque', 'Saque']];");
rep("const ATTR_W = { forca: .14, vel: .16, def: .16, curta: .12, lob: .12, smash: .16, saque: .14 };",
    "const ATTR_W = { forca: .13, vel: .15, def: .15, backhand: .08, curta: .11, lob: .11, smash: .15, saque: .12 };");

// backhand de cada personagem: perto da média de defesa, curta e lob; defensores e jogadores de toque um pouco melhores
const OLDW = { forca: .14, vel: .16, def: .16, curta: .12, lob: .12, smash: .16, saque: .14 };
const NEWW = { forca: .13, vel: .15, def: .15, backhand: .08, curta: .11, lob: .11, smash: .15, saque: .12 };
const ovr = (a, W) => Math.round(Object.keys(W).reduce((t, k) => t + a[k] * W[k], 0));
const report = [];
s = s.replace(/\{ id: '(\w+)', name: '([^']+)',(.*?)a: \{ ([^}]*) \}/g, (m, id, name, mid, attrs) => {
  const a = {}; attrs.split(',').forEach(p => { const [k, v] = p.split(':').map(x => x.trim()); a[k] = +v; });
  if (a.backhand !== undefined) return m;
  const before = ovr(a, OLDW);
  a.backhand = Math.round((a.def + a.curta + a.lob) / 3) - 2;
  // ajusta o backhand para o overall continuar o mesmo
  for (let i = 0; i < 40 && ovr(a, NEWW) !== before; i++) a.backhand = Math.max(40, Math.min(99, a.backhand + Math.sign(before - ovr(a, NEWW))));
  report.push(name + ': ' + before + ' -> ' + ovr(a, NEWW) + ' (backhand ' + a.backhand + ')');
  const order = ['forca', 'vel', 'def', 'backhand', 'curta', 'lob', 'smash', 'saque'];
  return "{ id: '" + id + "', name: '" + name + "'," + mid + 'a: { ' + order.map(k => k + ': ' + a[k]).join(', ') + ' }';
});

// bola no backhand: menos precisão e mais erro, conforme o atributo
rep("  let pop = false, wild = false, grade = q;", `  let pop = false, wild = false, grade = q;
  // bola do lado esquerdo do jogador (fora o smash por cima): backhand
  const bhSide = !isServe && key !== 'smash' && sideOf(p) < -.15;
  if (bhSide) {
    const bh = attrK(p, 'backhand');
    spec.noise *= lerp(1.6, 1.05, bh);
    q *= lerp(.72, .98, bh);
    mod.misBoost = (mod.misBoost || 0) + (1 - bh) * .18;
  }`);
rep("  return { key, label: spec.label, mis, pop, wild, grade, pressure };", "  return { key, label: spec.label, mis, pop, wild, grade, pressure, backhand: bhSide };");
rep("sw.lob ? sw.lob.word : qualityWord(q), null);", "sw.lob ? sw.lob.word : qualityWord(q) + (r.backhand ? ' · BACKHAND' : ''), null);");
// lob e curta também espelham no backhand
rep("mirror = p.swing.type === 'defesa' && p.swing.side < -.15; }", "mirror = (p.swing.type === 'defesa' || p.swing.type === 'curta' || p.swing.type === 'lob') && p.swing.side < -.15; }");
rep("sw.lob = { power: lv, word };", "sw.lob = { power: lv, word }; sw.side = sideOf(human);");
fs.writeFileSync(f, s);
console.log(report.join('\n'));
