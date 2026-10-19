const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };
const W = { forca: .13, vel: .15, def: .15, backhand: .08, curta: .11, lob: .11, smash: .15, saque: .12 };
const K = Object.keys(W);
const ovr = a => Math.round(K.reduce((t, k) => t + a[k] * W[k], 0));
// assinatura (atributos de destaque) + o resto ajustado até bater o overall
function build(target, sig) {
  const a = {}; K.forEach(k => { a[k] = sig[k] !== undefined ? sig[k] : target - 3; });
  for (let it = 0; it < 120 && ovr(a) !== target; it++) {
    const d = Math.sign(target - ovr(a));
    K.forEach(k => { if (sig[k] === undefined) a[k] = Math.max(40, Math.min(99, a[k] + d)); });
  }
  return a;
}
const up = (t, n) => Math.min(99, t + n);
// estilos: quais atributos se destacam
const S_ = (t, ...ks) => { const o = {}; ks.forEach(([k, n]) => { o[k] = up(t, n); }); return o; };

// elenco existente (para manter visual e atributos de quem não teve descrição)
const old = {};
const re = /\{ id: '(\w+)', name: '([^']+)', alt: (\d+), pais: '([^']+)', estilo: '([^']+)',( fem: true,)? a: \{ ([^}]*) \}, look: (\{[^}]*\}) \},/g;
let m;
while ((m = re.exec(s))) { const a = {}; m[7].split(',').forEach(p => { const [k, v] = p.split(':').map(x => x.trim()); a[k] = +v; }); old[m[1]] = { id: m[1], name: m[2], alt: +m[3], pais: m[4], estilo: m[5], fem: !!m[6], a, look: m[8] }; }
if (Object.keys(old).length < 30) throw new Error('roster parse failed: ' + Object.keys(old).length);

const SK = ['#efc6a3', '#e2b48f', '#d8a47e', '#d2a07a', '#c68a5e', '#b07a52', '#a8704a', '#8d5a3b'];
const HR = ['#2b1d14', '#6a3f1d', '#a8743a', '#1b120c', '#3a2615', '#5a3a1e', '#c99a5a', '#120c08'];
const RK = ['proteo', 'medusa', 'kronos', 'supercarbon'];
let n = 0;
const newLook = (fem) => { const i = n++; const head = i % 3 === 0 ? "visor: '#fbf6ea'" : i % 3 === 1 ? "cap: '#17324d'" : (fem ? "visor: '#ff5a1f'" : "cap: '#fbf6ea'"); return `{ skin: '${SK[(i * 3) % 8]}', hair: '${HR[(i * 5) % 8]}', ${head}, glasses: ${i % 2 === 0},${fem ? ' tank: true,' : ' band: true,'} num: '${50 + i}', racket: '${RK[i % 4]}' }`; };

// [id, nome, país, altura, estilo, overall, assinatura, feminino, canhoto]
const MEN = [
  ['spot', 'Matheus Spot', 'ITA', 178, 'Reflexos na rede', 94, t => ({ vel: 98, def: 96, forca: 94, smash: 93, saque: 90 })],
  ['gianote', 'Nicolas Gianote', 'FRA', 186, 'Voleio agressivo e definição', 94, t => ({ smash: 98, saque: 97, forca: 93, vel: 89 })],
  ['barao', 'André Barão', 'BRA', 194, 'Canhoto, saque fortíssimo e jogo aéreo', 91, t => S_(t, ['saque', 6], ['smash', 4], ['forca', 3]), false, true],
  ['mola', 'Daniel Molla', 'BRA', 183, 'Explosão e smash acrobático', 90, t => S_(t, ['smash', 6], ['forca', 5], ['vel', 4])],
  ['gigio', 'Gigio Cariane', 'BRA', 183, 'Defesa sólida e tática', 89, t => S_(t, ['def', 7], ['backhand', 4], ['lob', 3])],
  ['capeletti', 'Miguel Capeletti', 'ITA', 188, 'Presença na rede e ataque por cima', 89, t => S_(t, ['smash', 6], ['def', 4], ['forca', 3])],
  ['lock', 'Filipe Lock', 'BRA', 195, 'Saque angulado e estatura', 88, t => S_(t, ['saque', 8], ['smash', 3])],
  ['ramires', 'Antonio Ramires', 'ESP', 180, 'Voleios com efeito e criatividade', 87, t => S_(t, ['curta', 6], ['backhand', 5], ['lob', 3])],
  ['burmak', 'Nikolai Burmak', 'RUS', 196, 'Bloqueio na rede e alcance aéreo', 86, t => S_(t, ['def', 6], ['smash', 6], ['forca', 4])],
  ['grusso', 'Gustavo Rosso', 'BRA', 185, 'Drive de direita violento', 85, t => S_(t, ['forca', 8], ['smash', 3])],
  ['beccaccioli', 'Doriano Becaccioli', 'ITA', 182, 'Geometria e lob no fundo', 85, t => S_(t, ['lob', 8], ['curta', 3])],
  ['carlo', 'Lucas Carlo', 'ITA', 187, 'Smash e saque', 85, null],
  ['giovannini', 'Tomás Giovanetti', 'ITA', 185, 'Defende bolas impossíveis', 84, t => S_(t, ['def', 7], ['vel', 5])],
  ['allan', 'Alan Oliveiras', 'BRA', 176, 'Impulsão e velocidade', 84, t => S_(t, ['vel', 8], ['smash', 4])],
  ['santana', 'Tales Santana', 'BRA', 182, 'Defesa sólida', 84, null],
  ['gramos', 'Gabriel Ramo', 'ESP', 182, 'Tático e consistente nos ralis', 83, t => S_(t, ['backhand', 6], ['def', 4], ['lob', 3])],
  ['guegano', 'Mathieu Guegan', 'FRA', 184, 'Toque refinado', 83, t => S_(t, ['curta', 7], ['lob', 5])],
  ['bollettinari', 'Diego Boletinari', 'ITA', 180, 'Voleio rápido e saque agressivo', 82, t => S_(t, ['vel', 5], ['saque', 5])],
  ['branco', 'Leonardo Brancos', 'BRA', 183, 'Antecipação e contra-ataque', 82, t => S_(t, ['def', 5], ['backhand', 5])],
  ['rodrigo', 'Gerardo Rodrigo', 'ESP', 184, 'Consistente', 82, null],
  ['niklass', 'Maksim Niklas', 'LAT', 187, 'Alcance na rede e voleio curto', 81, t => S_(t, ['curta', 6], ['def', 4])],
  ['galeazzi', 'Federico Galeazi', 'ITA', 181, 'Solidez no fundo', 81, t => S_(t, ['def', 5], ['backhand', 5])],
  ['fonte', 'Vinícius Fonte', 'BRA', 178, 'Velocidade', 81, null],
  ['hrusso', 'Hugo Rosso', 'BRA', 184, 'Agressivo, define rápido', 80, t => S_(t, ['smash', 6], ['forca', 5])],
  ['toledo', 'Bruno Toledo', 'BRA', 179, 'Promessa', 66, null],
];
const WOMEN = [
  ['kudina', 'Elisa Kudina', 'RUS', 173, 'Ataque do fundo e defesa rápida', 93, t => S_(t, ['forca', 4], ['smash', 4], ['def', 4])],
  ['semena', 'Anastácia Semena', 'RUS', 170, 'Lobs precisos e tática na rede', 93, t => S_(t, ['lob', 5], ['curta', 4])],
  ['marquezin', 'Vitória Marquezin', 'BRA', 168, 'Reflexos e agressividade', 92, t => S_(t, ['vel', 5], ['def', 4], ['smash', 3])],
  ['chou', 'Sofia Chou', 'BRA', 170, 'Defesa sólida e contra-ataque angulado', 91, t => S_(t, ['def', 5], ['backhand', 5], ['curta', 3])],
  ['gaspar', 'Júlia Gaspar', 'ITA', 165, 'Consistência e controle mental', 90, t => S_(t, ['backhand', 4], ['def', 3], ['lob', 3])],
  ['valentim', 'Nina Valentim', 'ITA', 166, 'Defensora', 90, null],
  ['miler', 'Rafaela Miler', 'BRA', 176, 'Envergadura, saque dominante e jogo aéreo', 88, t => S_(t, ['saque', 7], ['smash', 5])],
  ['casadi', 'Verônica Casadi', 'ITA', 176, 'Potente', 88, null],
  ['grael', 'Ariadne Costa Grael', 'ESP', 168, 'Regularidade e variação de efeitos', 88, t => S_(t, ['backhand', 5], ['lob', 4], ['curta', 4])],
  ['nobre', 'Nicole Nobre', 'ITA', 163, 'Agilidade na rede e transição defensiva', 87, t => S_(t, ['vel', 6], ['def', 4], ['curta', 3])],
  ['dias', 'Paty Dias', 'VEN', 162, 'Jogo de rede', 87, null],
  ['cimadi', 'Sofia Cimadi', 'ITA', 174, 'Smash pesado e pressão no saque', 86, t => S_(t, ['smash', 6], ['saque', 5], ['forca', 4])],
  ['daino', 'Flávia Daino', 'ITA', 168, 'Toque, curtinhas e defesa inteligente', 85, t => S_(t, ['curta', 8], ['def', 4], ['lob', 3])],
  ['franceschini', 'Elena Franceschini', 'ITA', 172, 'Intensidade e golpes profundos', 85, t => S_(t, ['vel', 5], ['forca', 5])],
  ['tripa', 'Giulia Tripa', 'ITA', 169, 'Toque e lob', 84, null],
  ['vida', 'Marcela Vida', 'BRA', 171, 'Saque forte', 84, null],
  ['palos', 'Eva Fernandes Palos', 'ESP', 171, 'Cobertura de quadra e cruzadas', 84, t => S_(t, ['vel', 4], ['def', 4], ['backhand', 4])],
  ['podlubna', 'Verônica Podlubna', 'RUS', 175, 'Braços longos e voleio agressivo', 83, t => S_(t, ['smash', 5], ['def', 4])],
  ['justi', 'Greta Justi', 'ITA', 170, 'Defensora', 83, null],
  ['magalhaes', 'Marta Magalhãs', 'POR', 170, 'Técnica clássica e contra-ataque', 82, t => S_(t, ['backhand', 5], ['curta', 4])],
  ['cortes', 'Joana Cortês', 'BRA', 165, 'Experiência e precisão', 82, t => S_(t, ['curta', 5], ['backhand', 4], ['lob', 4])],
  ['nogueiro', 'Júlia Nogueiro', 'BRA', 172, 'Força bruta e saque pesado', 81, t => S_(t, ['forca', 7], ['saque', 6])],
  ['damata', 'Graziela da Mata', 'BRA', 170, 'Potência física e ataque veloz', 81, t => S_(t, ['forca', 6], ['smash', 5])],
  ['pansani', 'Isadora Pansane', 'BRA', 166, 'Ritmo elétrico e reflexos', 81, t => S_(t, ['vel', 6], ['def', 4])],
  ['abreu', 'Daniela Abreus', 'BRA', 168, 'Paciência, lob defensivo e poucos erros', 81, t => S_(t, ['lob', 6], ['def', 4], ['backhand', 3])],
  ['leite', 'Marceli Leite', 'BRA', 167, 'Defesas impossíveis em bola baixa', 80, t => S_(t, ['def', 7], ['vel', 4])],
  ['peracine', 'Mariana Peracine', 'BRA', 166, 'Jogo de rede', 80, null],
  ['pereira', 'Daniela Rodrigues Pereira', 'ESP', 165, 'Defensora', 80, null],
  ['alves', 'Bia Alves', 'BRA', 164, 'Iniciante', 60, null],
];
const out = [];
const emit = (row, fem) => {
  const [id, name, pais, alt, estilo, t, sigf, , lefty] = row;
  const o = old[id];
  let a;
  if (sigf) a = build(t, sigf(t));
  else if (o) { a = Object.assign({}, o.a); if (a.backhand === undefined) a.backhand = t - 3; if (ovr(a) !== t) a = build(t, Object.fromEntries(Object.entries(a).filter(([k, v]) => v >= t + 2))); }
  else a = build(t, {});
  const look = o ? o.look : newLook(fem);
  out.push(`  { id: '${id}', name: '${name}', alt: ${alt}, pais: '${pais}', estilo: '${estilo}',${fem ? ' fem: true,' : ''}${lefty ? ' canhoto: true,' : ''} a: { ${K.map(k => k + ': ' + a[k]).join(', ')} }, look: ${look} },`);
  return id + ' ' + ovr(a);
};
const log = MEN.map(r => emit(r, false)).concat(WOMEN.map(r => emit(r, true)));
const a0 = s.indexOf('const ROSTER = ['), b0 = s.indexOf('];\nconst overall', a0);
s = s.slice(0, a0) + 'const ROSTER = [\n' + out.join('\n') + '\n' + s.slice(b0);

// canhoto: boneco espelhado e lado do backhand invertido
rep("function sideOf(p, pt) { const q = pt || ball.pos; return (q.x - p.pos.x) * (p.team === 0 ? 1 : -1); }",
    "function sideOf(p, pt) { const q = pt || ball.pos; return (q.x - p.pos.x) * (p.team === 0 ? 1 : -1) * (p.lefty ? -1 : 1); }");
rep("    p.height = heightOf(c); p.model.group.scale.setScalar(hScale(p)); if (p.skin) p.skin.holder.scale.setScalar(hScale(p));",
    "    p.height = heightOf(c); p.lefty = !!c.canhoto && !p.skin; p.model.group.scale.set(hScale(p) * (p.lefty ? -1 : 1), hScale(p), hScale(p)); if (p.skin) p.skin.holder.scale.setScalar(hScale(p));");
fs.writeFileSync(f, s);
console.log(log.join(', '));
