const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };
rep("      kx = (rx + m) / b.w; kz = (rz + m) / b.d; X = x * kx; Z = (z - b.cz) * kz + cz;",
`      kx = (rx + m) / b.w; kz = (rz + m) / b.d; X = x * kx; Z = (z - b.cz) * kz + cz;
      // fatias com poucos vértices (barra, gola) podem esticar demais: nada sai mais de 18% da elipse do corpo
      const e = Math.hypot(X / (rx + m), (Z - cz) / (rz + m));
      if (e > 1.18) { X *= 1.18 / e; Z = cz + (Z - cz) * 1.18 / e; }`);
rep("        X = lerp(lx, px, t); Z = lerp(lz, pz, t); kx = lerp(rl / lo.w, pkx, t); kz = lerp(rl * 1.04 / lo.d, pkz, t);",
`        X = lerp(lx, px, t); Z = lerp(lz, pz, t); kx = lerp(rl / lo.w, pkx, t); kz = lerp(rl * 1.04 / lo.d, pkz, t);
        const e = Math.hypot(px / prx, pz / prz) * t;
        if (e > 1.2) { X *= 1.2 / e; Z *= 1.2 / e; }`);
fs.writeFileSync(f, s); console.log('ok');
