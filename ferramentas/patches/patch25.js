const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
// alturas informadas pelo usuário (média quando havia duas fontes)
const H = { spot: 180, gianote: 188, barao: 194, capeletti: 193, ramires: 180, chou: 170 };
for (const [id, h] of Object.entries(H)) {
  const re = new RegExp("(\\{ id: '" + id + "', name: '[^']+', alt: )\\d+");
  if (!re.test(s)) throw new Error('missing ' + id);
  s = s.replace(re, '$1' + h);
}
fs.writeFileSync(f, s);
console.log((s.match(/id: '(spot|gianote|barao|capeletti|ramires|chou)', name: '[^']+', alt: \d+/g) || []).join('\n'));
