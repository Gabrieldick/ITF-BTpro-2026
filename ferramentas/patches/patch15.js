const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const W = { forca: .14, vel: .16, def: .16, curta: .12, lob: .12, smash: .16, saque: .14 };
const ovr = a => Math.round(Object.keys(W).reduce((t, k) => t + a[k] * W[k], 0));
const K = Object.keys(W);
// perfis: atributos fixos (assinatura) + o resto ajustado até bater o overall alvo
function build(target, sig, base) {
  const a = {}; K.forEach(k => { a[k] = sig[k] !== undefined ? sig[k] : base; });
  for (let it = 0; it < 80 && ovr(a) !== target; it++) {
    const d = Math.sign(target - ovr(a));
    K.forEach(k => { if (sig[k] === undefined) a[k] = Math.max(40, Math.min(99, a[k] + d)); });
  }
  return a;
}
const SKINS = ['#efc6a3', '#e2b48f', '#d8a47e', '#d2a07a', '#c68a5e', '#b07a52', '#a8704a', '#8d5a3b'];
const HAIRS = ['#2b1d14', '#6a3f1d', '#a8743a', '#1b120c', '#3a2615', '#5a3a1e', '#c99a5a', '#120c08'];
const RK = ['proteo', 'medusa', 'kronos', 'supercarbon'];
const STYLES = {
  potente: { forca: 1, smash: 1, saque: 0 }, defensora: { def: 1, vel: 1 }, toque: { curta: 1, lob: 1 }, completa: {}, saque: { saque: 1, forca: 1 }, rede: { curta: 1, vel: 0 },
};
function sigFor(style, t) {
  const up = Math.min(99, t + 4), sig = {};
  Object.keys(STYLES[style]).forEach(k => { sig[k] = up; });
  return sig;
}
const MEN = [
  ['spot', 'Matheus Spot', 'ITA', 'Corre muito e bate forte', 94, { vel: 97, forca: 96, smash: 94, saque: 91 }],
  ['gianote', 'Nicolas Gianote', 'ITA', 'Smash e saque de elite', 94, { smash: 98, saque: 97, forca: 93, vel: 89 }],
  ['barao', 'André Barão', 'BRA', 'Agressivo', 91, { smash: 94, forca: 93 }],
  ['capeletti', 'Miguel Capeletti', 'ITA', 'Tático', 90, { def: 94, lob: 94 }],
  ['gigio', 'Gigio Cariane', 'ITA', 'Muralha na defesa', 88, { def: 96, vel: 91 }],
  ['lock', 'Filipe Lock', 'BRA', 'Defesa e contra-ataque', 87, { def: 90, vel: 89 }],
  ['burmak', 'Nikolai Burmak', 'RUS', 'Força bruta', 86, { forca: 95, smash: 95, saque: 90 }],
  ['carlo', 'Lucas Carlo', 'ITA', 'Smash e saque', 85, { smash: 89, saque: 88 }],
  ['santana', 'Tales Santana', 'BRA', 'Defesa sólida', 84, { def: 88, vel: 87 }],
  ['ramires', 'Antonio Ramires', 'ESP', 'Variado', 83, { curta: 85 }],
  ['rodrigo', 'Gerardo Rodrigo', 'ESP', 'Consistente', 82, {}],
  ['fonte', 'Vinícius Fonte', 'BRA', 'Velocidade', 81, { vel: 88 }],
  ['toledo', 'Bruno Toledo', 'BRA', 'Promessa', 66, {}],
];
// ranking feminino enviado pelo usuário (nomes parecidos)
const WOMEN = [
  ['kudina', 'Elisa Kudina', '—', 'potente', 93],
  ['semena', 'Anastácia Semena', '—', 'completa', 93],
  ['marquezin', 'Vitória Marquezin', 'BRA', 'defensora', 92],
  ['chou', 'Sofia Chou', 'BRA', 'saque', 91],
  ['gaspar', 'Júlia Gaspar', 'ITA', 'completa', 90],
  ['valentim', 'Nina Valentim', 'ITA', 'defensora', 90],
  ['casadi', 'Verônica Casadi', 'ITA', 'potente', 88],
  ['grael', 'Ariadne Costa Grael', 'ESP', 'toque', 88],
  ['dias', 'Paty Dias', 'VEN', 'rede', 87],
  ['miler', 'Rafaela Miler', 'BRA', 'potente', 87],
  ['cimadi', 'Sofia Cimadi', 'ITA', 'defensora', 86],
  ['daino', 'Flávia Daino', 'ITA', 'completa', 85],
  ['tripa', 'Giulia Tripa', 'ITA', 'toque', 84],
  ['vida', 'Marcela Vida', 'BRA', 'saque', 84],
  ['justi', 'Greta Justi', 'ITA', 'defensora', 83],
  ['nobre', 'Nicole Nobre', 'ITA', 'toque', 82],
  ['nogueiro', 'Júlia Nogueiro', 'BRA', 'completa', 81],
  ['damata', 'Graziela da Mata', 'BRA', 'potente', 81],
  ['peracine', 'Mariana Peracine', 'BRA', 'rede', 80],
  ['pereira', 'Daniela Rodrigues Pereira', 'ESP', 'defensora', 80],
];
const STYLE_LABEL = { potente: 'Potente', defensora: 'Defensora', toque: 'Toque e lob', completa: 'Completa', saque: 'Saque forte', rede: 'Jogo de rede' };
// mantém o visual dos personagens que já existiam
const oldLook = {};
const re = /\{ id: '(\w+)',[^\n]*?look: (\{[^}]*\}) \}/g; let m;
while ((m = re.exec(s))) oldLook[m[1]] = m[2];
const line = (id, name, pais, estilo, a, fem, look) =>
  `  { id: '${id}', name: '${name}', pais: '${pais}', estilo: '${estilo}',${fem ? ' fem: true,' : ''} a: { ${K.map(k => k + ': ' + a[k]).join(', ')} }, look: ${look} },`;
const out = [];
MEN.forEach(([id, name, pais, estilo, t, sig], i) => {
  const a = id === 'toledo' ? { forca: 70, vel: 74, def: 62, curta: 60, lob: 64, smash: 66, saque: 64 } : build(t, sig, t - 2);
  const look = oldLook[id] || oldLook.giovanetti && id === 'gianote' && oldLook.giovanetti || `{ skin: '${SKINS[i % 8]}', hair: '${HAIRS[i % 8]}', glasses: true, band: true, num: '${30 + i}', racket: '${RK[i % 4]}' }`;
  out.push(line(id, name, pais, estilo, a, false, look));
});
WOMEN.forEach(([id, name, pais, st, t], i) => {
  const a = build(t, sigFor(st, t), t - 2);
  const head = i % 3 === 0 ? `visor: '#fbf6ea'` : i % 3 === 1 ? `cap: '#17324d'` : `visor: '#ff5a1f'`;
  const look = oldLook[id] || `{ skin: '${SKINS[(i * 3) % 8]}', hair: '${HAIRS[(i * 5) % 8]}', ${head}, glasses: ${i % 2 === 0}, tank: true, num: '${40 + i}', racket: '${RK[(i + 1) % 4]}' }`;
  out.push(line(id, name, pais, STYLE_LABEL[st], a, true, look));
});
out.push(`  { id: 'alves', name: 'Bia Alves', pais: 'BRA', estilo: 'Iniciante', fem: true, a: { forca: 58, vel: 66, def: 60, curta: 58, lob: 62, smash: 56, saque: 58 }, look: ${oldLook.alves || "{ skin: '#8d5a3b', hair: '#120c08', visor: '#fbf6ea', tank: true, num: '20', racket: 'supercarbon' }"} },`);
const a0 = s.indexOf('const ROSTER = ['), b0 = s.indexOf('];\nconst overall', a0);
if (a0 < 0 || b0 < 0) throw new Error('roster');
s = s.slice(0, a0) + 'const ROSTER = [\n' + out.join('\n') + '\n' + s.slice(b0);
fs.writeFileSync(f, s);
const chk = out.map(l => { const n = l.match(/name: '([^']+)'/)[1]; const am = l.match(/a: \{ ([^}]*) \}/)[1]; const a = {}; am.split(',').forEach(p => { const [k, v] = p.split(':').map(x => x.trim()); a[k] = +v; }); return ovr(a) + ' ' + n + ' ' + am; });
console.log(chk.join('\n'));
