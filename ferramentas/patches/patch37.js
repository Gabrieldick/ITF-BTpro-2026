const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };
rep("      const b = G.band(0, gy) || { w: .15, cz: 0, d: .12 }, [rx, rz, cz] = torso(Y), m = fem ? .014 : .016;",
`      const b = G.band(0, gy) || { w: .15, cz: 0, d: .12 }, m = fem ? .014 : .016;
      let [rx, rz, cz] = torso(Y);
      // barra da camisa por fora do short/saia (como no modelo original)
      const over = smooth(ctx.hipsY + .2, ctx.hipsY + .1, Y);
      if (over > 0) { rx = lerp(rx, Math.max(rx, Math.max(pelvis(Y), hipX + thighR(Math.min(Y, H))) + .022 - m), over); rz = lerp(rz, Math.max(rz, pelvis(Y) * .74 + .03 - m), over); }`);
fs.writeFileSync(f, s); console.log('ok');
