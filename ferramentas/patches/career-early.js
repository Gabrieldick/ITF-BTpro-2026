// raquetes e equipamentos: alteram os atributos de quem usa (também fora da carreira)
const RACKET_STATS = {
  basica: { nome: 'Iniciante Areia', preco: 0, desc: 'Pesada e sem potência. É o que dá para ter no começo.', b: { forca: -4, smash: -4, saque: -3, curta: -2, lob: -1 } },
  fibra: { nome: 'Fibra Speed', preco: 600, desc: 'Fibra de vidro, leve e confortável. Ainda falta potência.', b: { forca: -2, smash: -2, saque: -1, curta: 1, def: 1 } },
  medusa: { nome: 'Medusa', preco: 2800, desc: 'Controle: curtas, defesas e backhand mais precisos.', b: { def: 3, curta: 4, backhand: 3, lob: 1, forca: -1 } },
  proteo: { nome: 'Proteo', preco: 3200, desc: 'Equilíbrio entre controle e potência.', b: { lob: 2, def: 2, smash: 2, saque: 2, curta: 1, backhand: 1 } },
  kronos: { nome: 'Kronos', preco: 4500, desc: 'Potência: smash e saque pesados, menos toque.', b: { forca: 5, smash: 4, saque: 3, curta: -2, def: -1 } },
  supercarbon: { nome: 'Supercarbon', preco: 9000, desc: 'Topo de linha em carbono: melhora tudo.', b: { forca: 4, smash: 4, saque: 3, def: 3, curta: 2, lob: 2, backhand: 2 } },
};
const GEAR = [
  { id: 'viseira', nome: 'Viseira pro', preco: 150, desc: 'Menos sol no rosto no saque e no smash.', b: { saque: 1, smash: 1 } },
  { id: 'munhequeira', nome: 'Munhequeira e grip premium', preco: 250, desc: 'Empunhadura firme no backhand.', b: { backhand: 2, curta: 1 } },
  { id: 'meia', nome: 'Meia de areia', preco: 300, desc: 'Arranque melhor na areia quente.', b: { vel: 2 } },
  { id: 'oculos', nome: 'Óculos esportivos', preco: 350, desc: 'Enxerga a bola contra o sol.', b: { def: 2, lob: 1 } },
  { id: 'preparador', nome: 'Preparador físico', preco: 4000, desc: 'Até o fim da temporada: +30% de evolução e mais energia por semana.', staff: true },
  { id: 'tecnico', nome: 'Técnico particular', preco: 9000, desc: 'Até o fim da temporada: +50% de pontos de evolução.', staff: true },
];
const racketBonus = key => (RACKET_STATS[key] || RACKET_STATS.proteo).b;
// atributos com bônus somados (limitados entre 30 e 99)
function effA(a, ...bonuses) {
  const out = {}; for (const [k] of ATTRS) { let v = a[k]; bonuses.forEach(b => { if (b && b[k]) v += b[k]; }); out[k] = clamp(Math.round(v), 30, 99); }
  return out;
}

