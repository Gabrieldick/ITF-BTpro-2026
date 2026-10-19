const fs = require('fs'); const f = process.argv[2]; let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 80)); s = s.replace(a, b); };
rep("function weights(p, kind) {", "function weights(p, kind, armSrc) {");
rep("    if (ARM.has(S.b) && (S.side !== side || Math.abs(X) < R.shX - .05)) continue;", "    if (ARM.has(S.b) && (!armSrc || S.side !== side)) continue;\n    if (armSrc && (LEG.has(S.b) || S.b === 0)) continue;");
rep("    const w = weights(p, kind); let tot = 0;", "    const armSrc = kind === 'wrist' || ((kind === 'body' || kind === 'shirt') && y > 1.22 && y < 1.5 && Math.abs(x) > .13);\n    const w = weights(p, kind, armSrc); let tot = 0;");
fs.writeFileSync(f, s); console.log('ok');
