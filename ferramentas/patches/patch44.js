const fs = require('fs'); const f = process.argv[2]; let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 80)); s = s.replace(a, b); };
// alcance real: braço + raquete (~1,2 m) e, na defesa, uma passada esticada
rep("function reachOf(type, p) { return type === 'defesa' ? 1.55 + (p ? attrK(p, 'def') : .65) * .32 : 1.35; }",
    "function reachOf(type, p) { return type === 'defesa' ? 1.15 + (p ? attrK(p, 'def') : .65) * .25 : 1.28; }");
// bola muito baixa ou muito alta fica mais longe da raquete
rep("  const dh = Math.hypot(ball.pos.x - p.pos.x, ball.pos.z - p.pos.z);\n  const maxY = (type === 'smash' ? 3.0 : 2.6) * hScale(p);",
    "  const dh = Math.hypot(ball.pos.x - p.pos.x, ball.pos.z - p.pos.z, type === 'smash' ? 0 : Math.max(0, Math.abs(ball.pos.y - 1.05 * hScale(p)) - .55) * .7);\n  const maxY = (type === 'smash' ? 3.0 : 2.6) * hScale(p);");
rep("  if (type === 'defesa') q = Math.max(q, .6);", "  if (type === 'defesa') q = Math.max(q, .45);");
fs.writeFileSync(f, s); console.log('ok');
