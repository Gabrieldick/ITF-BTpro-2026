// raquetes e equipamentos: alteram os atributos de quem usa (também fora da carreira)
const RACKET_STATS = {
  basica: { nome: 'Iniciante Areia', preco: 0, desc: 'Pesada e sem potência. É o que dá para ter no começo.', b: { forca: -4, smash: -4, saque: -3, curta: -2, lob: -1 } },
  tropic: { nome: 'Tropic Lite', preco: 300, desc: 'Alumínio leve: um pouco menos dura que a Iniciante.', b: { forca: -3, smash: -3, saque: -2, curta: -1 } },
  brisa: { nome: 'Brisa Junior', preco: 450, desc: 'Face macia: bom toque para quem está começando.', b: { curta: 1, def: 1, forca: -3, smash: -3, saque: -2 } },
  fibra: { nome: 'Fibra Speed', preco: 600, desc: 'Fibra de vidro, leve e confortável. Ainda falta potência.', b: { forca: -2, smash: -2, saque: -1, curta: 1, def: 1 } },
  mare: { nome: 'Maré Control', preco: 1500, desc: 'Controle: bolas na mão para curtas e defesas.', b: { def: 2, curta: 2, lob: 1, forca: -1 } },
  coral: { nome: 'Coral Power', preco: 1800, desc: 'Primeira raquete de potência: smash mais pesado.', b: { forca: 2, smash: 2, saque: 1, curta: -1 } },
  duna: { nome: 'Duna Soft', preco: 2200, desc: 'Borracha macia: lobs altos e defesa segura.', b: { lob: 3, def: 1, backhand: 1 } },
  medusa: { nome: 'Medusa', preco: 2800, desc: 'Controle: curtas, defesas e backhand mais precisos.', b: { def: 3, curta: 4, backhand: 3, lob: 1, forca: -1 } },
  proteo: { nome: 'Proteo', preco: 3200, desc: 'Equilíbrio entre controle e potência.', b: { lob: 2, def: 2, smash: 2, saque: 2, curta: 1, backhand: 1 } },
  tufao: { nome: 'Tufão Attack', preco: 3900, desc: 'Ataque: smash e força, mas pouca sensibilidade.', b: { smash: 4, forca: 3, saque: 2, def: -1, curta: -1 } },
  atol: { nome: 'Atol Defense', preco: 4200, desc: 'Defensiva: alcança mais e devolve tudo.', b: { def: 4, vel: 1, backhand: 3, lob: 2, smash: -1 } },
  kronos: { nome: 'Kronos', preco: 4500, desc: 'Potência: smash e saque pesados, menos toque.', b: { forca: 5, smash: 4, saque: 3, curta: -2, def: -1 } },
  ventosul: { nome: 'Vento Sul Touch', preco: 5200, desc: 'Toque refinado: curtas e lobs milimétricos.', b: { curta: 5, lob: 4, backhand: 2, forca: -1 } },
  recife: { nome: 'Recife Hybrid', preco: 6000, desc: 'Híbrida: um pouco de tudo, sem pontos fracos.', b: { smash: 2, def: 2, saque: 2, lob: 2, curta: 2, backhand: 2, forca: 1 } },
  supercarbon: { nome: 'Supercarbon', preco: 9000, desc: 'Topo de linha em carbono: melhora tudo.', b: { forca: 4, smash: 4, saque: 3, def: 3, curta: 2, lob: 2, backhand: 2 } },
  tsunami: { nome: 'Tsunami Pro', preco: 11000, desc: 'A mais potente do circuito: pancada pura.', b: { forca: 6, smash: 6, saque: 4, def: 1, curta: -1 } },
  eclipse: { nome: 'Eclipse Carbon 3K', preco: 14000, desc: 'Controle de elite: defesa, curta e lob de outro nível.', b: { def: 5, curta: 5, backhand: 4, lob: 4, vel: 1, smash: 1 } },
  zenite: { nome: 'Zênite Elite', preco: 20000, desc: 'A melhor raquete do mundo: tudo no máximo.', b: { forca: 5, smash: 5, saque: 4, def: 4, curta: 3, lob: 3, backhand: 3, vel: 1 } },
};
const GEAR = [
  { id: 'viseira', nome: 'Viseira pro', preco: 150, desc: 'Menos sol no rosto no saque e no smash.', b: { saque: 1, smash: 1 } },
  { id: 'munhequeira', nome: 'Munhequeira e grip premium', preco: 250, desc: 'Empunhadura firme no backhand.', b: { backhand: 2, curta: 1 } },
  { id: 'meia', nome: 'Meia de areia', preco: 300, desc: 'Arranque melhor na areia quente.', b: { vel: 2 } },
  { id: 'oculos', nome: 'Óculos esportivos', preco: 350, desc: 'Enxerga a bola contra o sol.', b: { def: 2, lob: 1 } },
  { id: 'joelheira', nome: 'Joelheira de compressão', preco: 600, desc: 'Mais firmeza nas bolas baixas.', b: { def: 1, vel: 1 } },
  { id: 'overgrip', nome: 'Kit overgrip pro', preco: 800, desc: 'Raquete firme no smash.', b: { smash: 1, forca: 1 } },
];
// equipe técnica: contrato até o fim da temporada
const STAFF = [
  { id: 'tec1', nome: 'Técnico de clube', preco: 1200, desc: '+25% de pontos de evolução.', head: 1, xp: .25 },
  { id: 'tec2', nome: 'Técnico experiente', preco: 5000, desc: '+50% de pontos de evolução.', head: 2, xp: .5 },
  { id: 'tec3', nome: 'Técnico de seleção', preco: 18000, desc: '+90% de pontos de evolução.', head: 3, xp: .9 },
  { id: 'espAtk', nome: 'Especialista em ataque', preco: 2500, desc: 'Evoluir smash, saque e força custa 25% menos.', cheap: ['smash', 'saque', 'forca'] },
  { id: 'espDef', nome: 'Especialista em defesa', preco: 2500, desc: 'Evoluir defesa, velocidade e backhand custa 25% menos.', cheap: ['def', 'vel', 'backhand'] },
  { id: 'espToq', nome: 'Especialista em toque', preco: 2200, desc: 'Evoluir curta e lob custa 25% menos.', cheap: ['curta', 'lob'] },
  { id: 'prep', nome: 'Preparador físico', preco: 3000, desc: '+8 de energia por semana e +10% de evolução.', energy: 8, xp: .1 },
  { id: 'fisio', nome: 'Fisioterapeuta', preco: 2000, desc: '+5 de energia por semana; lesões pesam menos.', energy: 5 },
  { id: 'psico', nome: 'Psicólogo esportivo', preco: 3500, desc: '+1 em todos os atributos nas partidas.', mental: 1 },
];
const racketBonus = key => (RACKET_STATS[key] || RACKET_STATS.proteo).b;
