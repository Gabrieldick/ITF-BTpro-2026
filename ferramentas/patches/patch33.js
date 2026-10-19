const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };
// quadril do short arredondado embaixo (sem "fralda" entre as pernas)
rep("latheGeo(fem ? [[0, -.09], [.16, -.09], [.186, -.02], [.18, .07], [.15, .14], [0, .145]] : [[0, -.09], [.15, -.09], [.172, -.02], [.17, .08], [.152, .14], [0, .145]], 24, .74)",
    "latheGeo(fem ? [[0, -.03], [.09, -.045], [.15, -.04], [.18, .0], [.18, .07], [.15, .14], [0, .145]] : [[0, -.03], [.085, -.045], [.14, -.04], [.168, .0], [.17, .08], [.152, .14], [0, .145]], 24, .74)");
// pé mais curto, alto no peito do pé
rep("    const w = (.03 + .016 * smooth(0, .68, t) - .01 * smooth(.86, 1, t)) * k;\n    const top = (.056 - .036 * smooth(.25, .95, t)) * k;",
    "    const w = (.031 + .013 * smooth(0, .68, t) - .008 * smooth(.86, 1, t)) * k;\n    const top = (.066 - .04 * smooth(.2, .95, t)) * k;");
rep("lerp(.058, -.19, t) * k);", "lerp(.05, -.165, t) * k);");
rep("    const arch = y < 0 && x * (1) < 0 ? 0 : 0;\n", "");
// coxas e panturrilhas de atleta
rep("const thighK = fem ? 1.05 : 1, calfK = fem ? .9 : 1;", "const thighK = fem ? 1.14 : 1.1, calfK = fem ? .96 : 1.06;");
rep("[H, .091], [H - .07, .09 * thighK, -.004]", "[H, .093], [H - .07, .093 * thighK, -.004]");
// mangas mais justas
rep("[Y + .02, .066, 0, -s * .004, .72], [Y - .01, .068, 0, 0, .9], [Y - .06, .066], [Y - .1, .064], [Y - .11, .06]]",
    "[Y + .02, .064, 0, -s * .004, .72], [Y - .01, .065, 0, 0, .9], [Y - .06, .062], [Y - .1, .059], [Y - .11, .055]]");
fs.writeFileSync(f, s);
console.log('ok');
