const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };
rep("p.height = heightOf(c); p.lefty = !!c.canhoto && !p.skin; p.model.group.scale.set(hScale(p) * (p.lefty ? -1 : 1), hScale(p), hScale(p)); if (p.skin) p.skin.holder.scale.setScalar(hScale(p));",
    "p.height = heightOf(c); applyLefty(p); if (p.skin) p.skin.holder.scale.setScalar(hScale(p));");
rep("function applyPlayerStyle() {", `// canhoto = modelo desenhado espelhado (o modelo 3D baixado só existe destro)
function applyLefty(p) {
  p.lefty = !!(p.char && p.char.canhoto) && S.settings.players === 'desenhado';
  p.model.group.scale.set(hScale(p) * (p.lefty ? -1 : 1), hScale(p), hScale(p));
}
function applyPlayerStyle() {`);
rep("    if (!on) { p.skin.holder.visible = false; p.skin.racket.visible = false; }\n  }\n}",
    "    if (!on) { p.skin.holder.visible = false; p.skin.racket.visible = false; }\n  }\n  for (const p of ALL) if (p.char) applyLefty(p);\n}");
fs.writeFileSync(f, s);
console.log('ok');
