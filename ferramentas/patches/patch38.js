const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b, all) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = all ? s.split(a).join(b) : s.replace(a, b); };
// largura do quadril vestido: na cintura só a bacia; perto da virilha inclui as coxas
rep("  const legRef = !fem ? G.band(1, G.crotch - .08) : null;", "  const hipW = Y => Math.max(pelvis(Y), lerp(pelvis(Y), hipX + thighR(Math.min(Y, H)), smooth(ctx.hipsY + .06, ctx.hipsY - .03, Y)));\n  const legRef = !fem ? G.band(1, G.crotch - .08) : null;");
rep("rx = lerp(rx, Math.max(rx, Math.max(pelvis(Y), hipX + thighR(Math.min(Y, H))) + .022 - m), over);", "rx = lerp(rx, Math.max(rx, hipW(Y) + .024 - m), over);");
rep("      const prx = Math.max(pelvis(Y), hipX + thighR(Math.min(Y, H))) + .016, prz = pelvis(Y) * .74 + .022;", "      const prx = hipW(Y) + .016, prz = pelvis(Y) * .74 + .022;");
// camisa um pouco mais curta: a barra termina logo abaixo do cós
rep("    const Y = mapY(gy), sy = slope(gy), side = x < 0 ? 0 : 1;", "    const shirtLift = L === 0 ? .055 * smooth(1.1, .92, gy) : 0;\n    const Y = mapY(gy) + shirtLift, sy = slope(gy), side = x < 0 ? 0 : 1;");
fs.writeFileSync(f, s); console.log('ok');
