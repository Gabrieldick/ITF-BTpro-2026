const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };
rep("const LEG = [[H + .1, .06], [H + .06, .084], [H, .093], [H - .07, .093 * thighK, -.004],", "const LEG = [[H + .08, .05], [H + .05, .07], [H, .082], [H - .07, .088 * thighK, -.004],");
rep("const SH = [[H + .11, .095], [H + .06, .1], [H, .103], [H - .08, .106], [H - (fem ? .1 : .145), .107], [H - (fem ? .11 : .155), .104]];",
    "const SH = [[H + .12, .07], [H + .08, .1], [H + .03, .114], [H - .04, .118], [H - (fem ? .1 : .15), .119], [H - (fem ? .11 : .16), .113]];");
fs.writeFileSync(f, s);
console.log('ok');
