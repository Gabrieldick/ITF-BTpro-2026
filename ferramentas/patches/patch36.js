const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };
rep("  const pelvis = Y => profR(PELVIS_PROF[fem ? 1 : 0], Y - ctx.hipsY);", "  const pelvis = Y => profR(PELVIS_PROF[fem ? 1 : 0], clamp(Y - ctx.hipsY, -.03, .12));\n  const legRef = !fem ? G.band(1, G.crotch - .08) : null; // perna do short: um só ajuste, sem degraus");
rep("        const lo = b.l[side], s = side ? 1 : -1, rl = thighR(Y) + .03;", "        const lo = legRef.l[side], s = side ? 1 : -1, rl = thighR(G.crotch - .08 > 0 ? mapY(G.crotch - .08) : Y) + .03;");
fs.writeFileSync(f, s); console.log('ok');
