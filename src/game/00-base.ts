// @ts-nocheck
// constantes, elenco de atletas, raquetes, equipe técnica, estilos de jogo e utilitários
import * as THREE from 'three';
import { $s } from '../state';
import { ball } from './07-glb';
const V3 = THREE.Vector3;
const G = 9.8;
// efeito da bola: topspin mergulha (gk > 1), slice flutua (gk < 1)
const bG = () => ball.state === 'live' ? G * (ball.gk || 1) : G;
const C = { halfL: 8, halfW: 2.25, netH: 1.7, ballR: .035, netHalf: 4.6 };
const HALF_W = { simples: 2.25, dupla: 4 };
const STEP = 1 / 120;
const P_SPEED = 4.5;
const SWING_DUR = 0.4;
const TOSS_T = 0.72;      // tempo do lançamento até o ponto ideal de contato no saque
const ZONE3 = 3;          // zona de saque: quem recebe fica atrás dos 3 m até o saque ser batido
const SHORE_Z = -52;      // onde a areia afunda no mar
const WATERLINE = -49.5;  // onde a água encontra a areia

const SHOTS = {
  smash:  { label: 'SMASH',  speed: 19,   depth: [4.6, 7.0], margin: .08, noise: .35 },
  drive:  { label: 'DRIVE',  speed: 13.5, depth: [5.0, 7.2], margin: .12, noise: .45 },
  lob:    { label: 'LOB',    T: 2.05,     depth: [6.2, 7.5], margin: .4,  noise: .5 },
  curta:  { label: 'CURTA',  T: .9,       depth: [1.1, 2.5], margin: .07, noise: .35, lowArc: true },
  defesa: { label: 'DEFESA', T: 1.2,      depth: [4.3, 6.4], margin: .3,  noise: .3 },
};
const SERVES = {
  smash:  { label: 'SAQUE FORTE',  speed: 15, depth: [4.5, 6.8], margin: .06, noise: .55 },
  lob:    { label: 'SAQUE ALTO',   T: 1.9,      depth: [5.5, 7.4], margin: .5,  noise: .4 },
  curta:  { label: 'SAQUE CURTO',  T: 1.0,      depth: [1.6, 3.0], margin: .2,  noise: .35 },
  defesa: { label: 'SAQUE SEGURO', T: 1.3,      depth: [4.0, 6.0], margin: .3,  noise: .25 },
};
const DIFF = {
  facil:   { speed: 3.4, react: .30, miss: .14, err: .10,  q: [.45, .75], smart: .3, letGo: .3 },
  medio:   { speed: 4.1, react: .18, miss: .07, err: .055, q: [.60, .90], smart: .6, letGo: .6 },
  dificil: { speed: 4.8, react: .10, miss: .03, err: .025, q: [.75, 1.0], smart: .9, letGo: .9 },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// elenco com nomes que lembram jogadores do circuito; atributos são estimativas do jogo e os nomes podem ser trocados no menu
const ATTRS = [['forca', 'Força'], ['vel', 'Velocidade'], ['def', 'Defesa'], ['backhand', 'Backhand'], ['curta', 'Curta'], ['lob', 'Lob'], ['smash', 'Smash'], ['saque', 'Saque']];
const ATTR_W = { forca: .13, vel: .15, def: .15, backhand: .08, curta: .11, lob: .11, smash: .15, saque: .12 };
// raquetes e equipamentos: alteram os atributos de quem usa (também fora da carreira)
// raquetes: a soma dos bônus cresce com o preço; as especializadas têm picos maiores com algum ponto fraco
const RACKET_STATS = {
  basica: { nome: 'Iniciante Areia', preco: 0, desc: 'Pesada e sem potência. É o que dá para ter no começo.', b: { forca: -4, smash: -4, saque: -3, curta: -2, lob: -1 } },
  tropic: { nome: 'Tropic Lite', preco: 300, desc: 'Alumínio leve: perde menos que a Iniciante, ainda sem potência.', b: { forca: -2, smash: -2, saque: -1, curta: -1 } },
  brisa: { nome: 'Brisa Junior', preco: 450, desc: 'Face macia: bom toque para quem está começando.', b: { curta: 1, def: 1, forca: -2, smash: -2, saque: -1 } },
  fibra: { nome: 'Fibra Speed', preco: 600, desc: 'Fibra de vidro, leve e confortável. Ainda falta potência.', b: { forca: -1, smash: -1, curta: 1, def: 1 } },
  mare: { nome: 'Maré Control', preco: 1500, desc: 'Controle: bolas na mão para curtas e defesas.', b: { def: 2, curta: 2, lob: 1, forca: -1 } },
  coral: { nome: 'Coral Power', preco: 1800, desc: 'Primeira raquete de potência: smash mais pesado.', b: { forca: 2, smash: 2, saque: 1, curta: -1 } },
  duna: { nome: 'Duna Soft', preco: 2200, desc: 'Borracha macia: lobs altos e defesa segura.', b: { lob: 3, def: 1, backhand: 1 } },
  medusa: { nome: 'Medusa', preco: 2800, desc: 'Controle: curtas, defesas e backhand mais precisos.', b: { def: 2, curta: 3, backhand: 2, forca: -1 } },
  proteo: { nome: 'Proteo', preco: 3200, desc: 'Equilíbrio entre controle e potência.', b: { lob: 1, def: 1, smash: 1, saque: 1, curta: 1, backhand: 1 } },
  tufao: { nome: 'Tufão Attack', preco: 3900, desc: 'Ataque: smash e força, mas pouca sensibilidade.', b: { smash: 4, forca: 3, saque: 2, def: -1, curta: -1 } },
  atol: { nome: 'Atol Defense', preco: 4200, desc: 'Defensiva: alcança mais e devolve tudo.', b: { def: 4, vel: 1, backhand: 2, lob: 2, smash: -1 } },
  kronos: { nome: 'Kronos', preco: 4500, desc: 'Potência: smash e saque pesados, menos toque.', b: { forca: 5, smash: 4, saque: 2, curta: -2, def: -1 } },
  ventosul: { nome: 'Vento Sul Touch', preco: 5200, desc: 'Toque refinado: curtas e lobs milimétricos.', b: { curta: 5, lob: 4, backhand: 1, forca: -1 } },
  recife: { nome: 'Recife Hybrid', preco: 6000, desc: 'Híbrida: um pouco de tudo, sem pontos fracos.', b: { smash: 2, def: 2, saque: 1, lob: 2, curta: 2, backhand: 1 } },
  supercarbon: { nome: 'Supercarbon', preco: 9000, desc: 'Topo de linha em carbono: melhora tudo.', b: { forca: 3, smash: 3, saque: 2, def: 2, curta: 1, lob: 1, backhand: 1 } },
  tsunami: { nome: 'Tsunami Pro', preco: 11000, desc: 'A mais potente do circuito: pancada pura.', b: { forca: 6, smash: 5, saque: 3, def: 1, curta: -1 } },
  eclipse: { nome: 'Eclipse Carbon 3K', preco: 14000, desc: 'Controle de elite: defesa, curta e lob de outro nível.', b: { def: 5, curta: 4, backhand: 3, lob: 3, vel: 1 } },
  zenite: { nome: 'Zênite Elite', preco: 20000, desc: 'A melhor raquete do mundo: tudo no máximo.', b: { forca: 4, smash: 4, saque: 3, def: 3, curta: 2, lob: 2, backhand: 1 } },
};
// visual de cada jogador (penteado, barba, faixa, óculos): derivado do id, sempre o mesmo para a mesma pessoa
const HAIR_M = ['curto', 'curto', 'raspado', 'careca', 'cacheado', 'topete', 'longo', 'moicano'];
const HAIR_F = ['rabo', 'rabo', 'coque', 'longo', 'curto', 'tranca', 'cacheado'];
const LENS = ['#0b0d10', '#0b0d10', '#1d4fd8', '#e8700a', '#7a1fa2', '#0f8a5f'];
function lookExtras(c) {
  let h = 2166136261; for (const ch of String(c.id || c.name || '')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const r = k => ((h >>> (k * 3)) % 997) / 997;
  const fem = !!c.fem, L = c.look || {};
  const x = { hairStyle: fem ? HAIR_F[Math.floor(r(1) * HAIR_F.length)] : HAIR_M[Math.floor(r(1) * HAIR_M.length)] };
  if (!fem) x.beard = r(2) < .45 ? ['barba', 'cavanhaque', 'bigode', 'barba'][Math.floor(r(3) * 4)] : '';
  if (!L.cap && !L.visor && r(4) < .35) x.headband = ['#ff5a1f', '#fbf6ea', '#17324d', '#e2364a', '#0b7a83'][Math.floor(r(5) * 5)];
  if (L.glasses) { x.glassStyle = r(6) < .3 ? 'redondo' : 'sport'; x.lens = LENS[Math.floor(r(7) * LENS.length)]; }
  return x;
}
const GEAR = [
  { id: 'viseira', nome: 'Viseira pro', preco: 150, desc: 'Menos sol no rosto no saque e no smash.', b: { saque: 1, smash: 1 } },
  { id: 'munhequeira', nome: 'Munhequeira e grip premium', preco: 250, desc: 'Empunhadura firme no backhand.', b: { backhand: 2, curta: 1 } },
  { id: 'meia', nome: 'Meia de areia', preco: 300, desc: 'Arranque melhor na areia quente.', b: { vel: 2 } },
  { id: 'oculos', nome: 'Óculos esportivos', preco: 350, desc: 'Enxerga a bola contra o sol.', b: { def: 2, lob: 1 } },
  { id: 'joelheira', nome: 'Joelheira de compressão', preco: 600, desc: 'Mais firmeza nas bolas baixas.', b: { def: 1, vel: 1 } },
  { id: 'overgrip', nome: 'Kit overgrip pro', preco: 800, desc: 'Raquete firme no smash.', b: { smash: 1, forca: 1 } },
  { id: 'faixa', nome: 'Faixa de cabelo pro', preco: 500, desc: 'Suor longe dos olhos no lançamento do saque.', b: { saque: 1 } },
  { id: 'camisauv', nome: 'Camisa UV de competição', preco: 1200, desc: 'Leve e fresca: menos cansaço nos ralis longos.', b: { vel: 1, def: 1 } },
  { id: 'tornozeleira', nome: 'Tornozeleira estabilizadora', preco: 2000, desc: 'Apoio firme nas mudanças de direção.', b: { def: 2, vel: 1 } },
  { id: 'gripcouro', nome: 'Grip de couro sob medida', preco: 2500, desc: 'Toque mais fino nas bolas curtas e no backhand.', b: { backhand: 2, curta: 1 } },
  { id: 'relogio', nome: 'Relógio com GPS e carga de treino', preco: 3500, desc: 'Controle de carga: pernas mais rápidas.', b: { vel: 2, def: 1 } },
  { id: 'polarizado', nome: 'Óculos polarizados de elite', preco: 4500, desc: 'Lê a bola contra o sol do meio-dia.', b: { lob: 2, def: 1, smash: 1 } },
  { id: 'cordas', nome: 'Raquete balanceada em fábrica', preco: 7000, desc: 'Peso e equilíbrio ajustados ao seu braço.', b: { forca: 2, smash: 1, saque: 1 } },
  { id: 'suplem', nome: 'Plano de suplementação', preco: 9000, desc: 'Recuperação e explosão: um pouco de tudo.', b: { forca: 1, vel: 1, def: 1 } },
  { id: 'sensor', nome: 'Sensor de golpes com análise em vídeo', preco: 14000, desc: 'Corrige o toque: curtas e lobs mais precisos.', b: { curta: 2, lob: 2, backhand: 1 } },
  { id: 'biomec', nome: 'Avaliação biomecânica completa', preco: 22000, desc: 'Ajusta o movimento do smash e do saque.', b: { smash: 2, saque: 2, forca: 1 } },
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
// estilo de jogo: que golpes prefere, onde se posiciona, quanto arrisca e como saca
// w: peso de cada golpe em bola comum · high: chance de smash em bola alta · home: metros mais perto (−) ou mais longe (+) da rede
// speed/noise: força e precisão dos golpes · err: erros não forçados · react: tempo de reação · serve: pesos [smash, lob, curta, seguro]
const PLAY_STYLES = {
  agressivo: { nome: 'Agressivo', desc: 'Ataca tudo: smash e drive fortes, joga mais à frente e erra mais.', w: { smash: 3, lob: .5, curta: .5, defesa: 1 }, high: .93, mid: .5, home: -.7, speed: 1.08, noise: 1.15, err: 1.3, react: 1, serve: [.97, 0, .01, .02], aimBody: .45 },
  paredao: { nome: 'Paredão', desc: 'Fica no fundo e devolve tudo: erra pouco e ataca pouco.', w: { smash: .6, lob: 1.3, curta: .4, defesa: 3 }, high: .62, mid: 0, home: .8, speed: .93, noise: .85, err: .7, react: .95, serve: [.7, .05, .02, .23] },
  tatico: { nome: 'Tático', desc: 'Curtas, lobs e bolas nos espaços vazios e nos cantos.', w: { smash: .8, lob: 1.6, curta: 1.8, defesa: 1.2 }, high: .75, mid: .1, home: 0, speed: .97, noise: .9, err: .9, react: 1, serve: [.74, .1, .11, .05], corners: true },
  rede: { nome: 'Voleador', desc: 'Joga colado na rede: reflexo rápido e bola no chão.', w: { smash: 2, lob: .4, curta: 1.5, defesa: 1.2 }, high: .88, mid: .35, home: -1.3, speed: 1.03, noise: 1, err: 1.1, react: .78, serve: [.95, 0, .03, .02] },
  lobista: { nome: 'Lobista', desc: 'Empurra o adversário para trás com lobs altos e pacientes.', w: { smash: .7, lob: 3, curta: .6, defesa: 1.4 }, high: .7, mid: 0, home: 1, speed: .95, noise: .9, err: .85, react: 1, serve: [.8, .12, .02, .06], lobHigh: true },
  completo: { nome: 'Equilibrado', desc: 'Faz de tudo um pouco.', w: { smash: 1, lob: 1, curta: 1, defesa: 2.2 }, high: .8, mid: 0, home: 0, speed: 1, noise: 1, err: 1, react: 1, serve: null },
};
const styleOf = p => PLAY_STYLES[p.playStyle] || PLAY_STYLES.completo;
const racketBonus = key => (RACKET_STATS[key] || RACKET_STATS.proteo).b;
// atributos com bônus somados (limitados entre 30 e 99)
function effA(a, ...bonuses) {
  const out = {}; for (const [k] of ATTRS) { let v = a[k]; bonuses.forEach(b => { if (b && b[k]) v += b[k]; }); out[k] = clamp(Math.round(v), 30, 99); }
  return out;
}
const ROSTER = [
  { id: 'spot', name: 'Matheus Spot', alt: 178, pais: 'ITA', estilo: 'Reflexos na rede', build: 'compacto', a: { forca: 94, vel: 98, def: 96, backhand: 92, curta: 92, lob: 92, smash: 93, saque: 90 }, look: { skin: '#d6a47c', hair: '#2b1d14', cap: '#fbf6ea', glasses: true, band: true, num: '1', racket: 'proteo' } },
  { id: 'gianote', name: 'Nicolas Gianote', alt: 186, pais: 'FRA', estilo: 'Voleio agressivo e definição', build: 'esguio', a: { forca: 93, vel: 89, def: 93, backhand: 93, curta: 93, lob: 93, smash: 98, saque: 97 }, look: { skin: '#c99068', hair: '#2a1a0e', cap: '#fbf6ea', glasses: false, num: '5', racket: 'kronos' } },
  { id: 'barao', name: 'André Barão', alt: 194, pais: 'BRA', estilo: 'Canhoto, saque fortíssimo e jogo aéreo', build: 'forte', canhoto: true, a: { forca: 94, vel: 88, def: 88, backhand: 88, curta: 88, lob: 88, smash: 95, saque: 97 }, look: { skin: '#b07a52', hair: '#120c08', glasses: true, band: true, num: '6', racket: 'proteo' } },
  { id: 'mola', name: 'Daniel Molla', alt: 183, pais: 'BRA', estilo: 'Explosão e smash acrobático', build: 'forte', a: { forca: 95, vel: 94, def: 87, backhand: 87, curta: 87, lob: 87, smash: 96, saque: 87 }, look: { skin: '#efc6a3', hair: '#2b1d14', visor: '#fbf6ea', glasses: true, band: true, num: '50', racket: 'proteo' } },
  { id: 'gigio', jogo: 'paredao', name: 'Gigio Cariane', alt: 183, pais: 'BRA', estilo: 'Defesa sólida e tática', build: 'compacto', a: { forca: 86, vel: 86, def: 96, backhand: 93, curta: 86, lob: 92, smash: 86, saque: 86 }, look: { skin: '#d2a07a', hair: '#2a1a0e', visor: '#17324d', glasses: true, band: true, num: '21', racket: 'medusa' } },
  { id: 'capeletti', name: 'Miguel Capeletti', alt: 188, pais: 'ITA', estilo: 'Presença na rede e ataque por cima', build: 'forte', a: { forca: 92, vel: 86, def: 93, backhand: 86, curta: 86, lob: 86, smash: 95, saque: 86 }, look: { skin: '#d8a47e', hair: '#1b120c', cap: '#17324d', glasses: true, num: '3', racket: 'medusa' } },
  { id: 'lock', name: 'Filipe Lock', alt: 195, pais: 'BRA', estilo: 'Saque angulado e estatura', build: 'atletico', a: { forca: 86, vel: 86, def: 86, backhand: 86, curta: 86, lob: 86, smash: 91, saque: 96 }, look: { skin: '#c68a5e', hair: '#1b120c', cap: '#fbf6ea', glasses: true, num: '22', racket: 'kronos' } },
  { id: 'ramires', name: 'Antonio Ramires', alt: 180, pais: 'ESP', estilo: 'Voleios com efeito e criatividade', build: 'esguio', a: { forca: 85, vel: 85, def: 85, backhand: 92, curta: 93, lob: 90, smash: 85, saque: 85 }, look: { skin: '#c68a5e', hair: '#1b120c', cap: '#0b7a83', glasses: true, num: '8', racket: 'supercarbon' } },
  { id: 'burmak', name: 'Nikolai Burmak', alt: 196, pais: 'RUS', estilo: 'Bloqueio na rede e alcance aéreo', build: 'esguio', a: { forca: 90, vel: 82, def: 92, backhand: 82, curta: 82, lob: 82, smash: 92, saque: 82 }, look: { skin: '#efc6a3', hair: '#7a5a3a', visor: '#17324d', glasses: true, band: true, num: '2', racket: 'kronos' } },
  { id: 'grusso', name: 'Gustavo Rosso', alt: 185, pais: 'BRA', estilo: 'Drive de direita violento', build: 'forte', a: { forca: 93, vel: 83, def: 83, backhand: 83, curta: 83, lob: 83, smash: 88, saque: 83 }, look: { skin: '#d2a07a', hair: '#5a3a1e', cap: '#17324d', glasses: false, band: true, num: '51', racket: 'medusa' } },
  { id: 'beccaccioli', name: 'Doriano Becaccioli', alt: 182, pais: 'ITA', estilo: 'Geometria e lob no fundo', build: 'atletico', a: { forca: 83, vel: 83, def: 83, backhand: 83, curta: 88, lob: 93, smash: 83, saque: 83 }, look: { skin: '#a8704a', hair: '#a8743a', cap: '#fbf6ea', glasses: true, band: true, num: '52', racket: 'kronos' } },
  { id: 'carlo', name: 'Lucas Carlo', alt: 187, pais: 'ITA', estilo: 'Smash e saque', build: 'atletico', a: { forca: 83, vel: 83, def: 83, backhand: 83, curta: 83, lob: 83, smash: 89, saque: 88 }, look: { skin: '#e2b48f', hair: '#3a2615', glasses: true, band: true, num: '4', racket: 'supercarbon' } },
  { id: 'giovannini', name: 'Tomás Giovanetti', alt: 185, pais: 'ITA', estilo: 'Defende bolas impossíveis', build: 'esguio', a: { forca: 81, vel: 89, def: 91, backhand: 81, curta: 81, lob: 81, smash: 81, saque: 81 }, look: { skin: '#e2b48f', hair: '#120c08', visor: '#fbf6ea', glasses: false, band: true, num: '53', racket: 'supercarbon' } },
  { id: 'allan', jogo: 'agressivo', name: 'Alan Oliveiras', alt: 176, pais: 'BRA', estilo: 'Impulsão e velocidade', build: 'compacto', canhoto: true, a: { forca: 81, vel: 92, def: 81, backhand: 81, curta: 81, lob: 81, smash: 88, saque: 81 }, look: { skin: '#c68a5e', hair: '#3a2615', cap: '#17324d', glasses: true, band: true, num: '54', racket: 'proteo' } },
  { id: 'santana', name: 'Tales Santana', alt: 182, pais: 'BRA', estilo: 'Defesa sólida', build: 'atletico', a: { forca: 82, vel: 87, def: 88, backhand: 82, curta: 82, lob: 82, smash: 82, saque: 82 }, look: { skin: '#8d5a3b', hair: '#120c08', visor: '#fbf6ea', glasses: false, num: '7', racket: 'medusa' } },
  { id: 'gramos', name: 'Gabriel Ramo', alt: 182, pais: 'ESP', estilo: 'Tático e consistente nos ralis', build: 'esguio', a: { forca: 81, vel: 81, def: 87, backhand: 89, curta: 81, lob: 86, smash: 81, saque: 81 }, look: { skin: '#8d5a3b', hair: '#6a3f1d', cap: '#fbf6ea', glasses: false, band: true, num: '55', racket: 'medusa' } },
  { id: 'guegano', name: 'Mathieu Guegan', alt: 184, pais: 'FRA', estilo: 'Toque refinado', build: 'esguio', a: { forca: 81, vel: 81, def: 81, backhand: 81, curta: 90, lob: 88, smash: 81, saque: 81 }, look: { skin: '#d8a47e', hair: '#c99a5a', visor: '#fbf6ea', glasses: true, band: true, num: '56', racket: 'kronos' } },
  { id: 'bollettinari', name: 'Diego Boletinari', alt: 180, pais: 'ITA', estilo: 'Voleio rápido e saque agressivo', build: 'compacto', a: { forca: 80, vel: 87, def: 80, backhand: 80, curta: 80, lob: 80, smash: 80, saque: 87 }, look: { skin: '#b07a52', hair: '#1b120c', cap: '#17324d', glasses: false, band: true, num: '57', racket: 'supercarbon' } },
  { id: 'branco', name: 'Leonardo Brancos', alt: 183, pais: 'BRA', estilo: 'Antecipação e contra-ataque', build: 'atletico', a: { forca: 80, vel: 80, def: 87, backhand: 87, curta: 80, lob: 80, smash: 80, saque: 80 }, look: { skin: '#efc6a3', hair: '#2b1d14', cap: '#fbf6ea', glasses: true, band: true, num: '58', racket: 'proteo' } },
  { id: 'rodrigo', name: 'Gerardo Rodrigo', alt: 184, pais: 'ESP', estilo: 'Consistente', build: 'atletico', a: { forca: 82, vel: 82, def: 82, backhand: 80, curta: 82, lob: 82, smash: 82, saque: 82 }, look: { skin: '#d2a07a', hair: '#3a2615', glasses: false, band: true, num: '9', racket: 'kronos' } },
  { id: 'niklass', name: 'Maksim Niklas', alt: 187, pais: 'LAT', estilo: 'Alcance na rede e voleio curto', build: 'esguio', a: { forca: 79, vel: 79, def: 85, backhand: 79, curta: 87, lob: 79, smash: 79, saque: 79 }, look: { skin: '#d2a07a', hair: '#5a3a1e', visor: '#fbf6ea', glasses: false, band: true, num: '59', racket: 'medusa' } },
  { id: 'galeazzi', name: 'Federico Galeazi', alt: 181, pais: 'ITA', estilo: 'Solidez no fundo', build: 'forte', a: { forca: 79, vel: 79, def: 86, backhand: 86, curta: 79, lob: 79, smash: 79, saque: 79 }, look: { skin: '#a8704a', hair: '#a8743a', cap: '#17324d', glasses: true, band: true, num: '60', racket: 'kronos' } },
  { id: 'fonte', name: 'Vinícius Fonte', alt: 178, pais: 'BRA', estilo: 'Velocidade', build: 'atletico', a: { forca: 80, vel: 88, def: 80, backhand: 78, curta: 80, lob: 80, smash: 80, saque: 80 }, look: { skin: '#a8704a', hair: '#1b120c', cap: '#ff5a1f', glasses: true, num: '10', racket: 'proteo' } },
  { id: 'hrusso', name: 'Hugo Rosso', alt: 184, pais: 'BRA', estilo: 'Agressivo, define rápido', build: 'atletico', a: { forca: 85, vel: 78, def: 78, backhand: 78, curta: 78, lob: 78, smash: 86, saque: 78 }, look: { skin: '#e2b48f', hair: '#120c08', cap: '#fbf6ea', glasses: false, band: true, num: '61', racket: 'supercarbon' } },
  { id: 'toledo', name: 'Bruno Toledo', alt: 179, pais: 'BRA', estilo: 'Promessa', build: 'atletico', a: { forca: 70, vel: 74, def: 62, backhand: 60, curta: 60, lob: 64, smash: 66, saque: 64 }, look: { skin: '#b07a52', hair: '#2a1a0e', num: '18', racket: 'proteo' } },
  { id: 'irigarai', name: 'Téo Irigarai', alt: 183, pais: 'FRA', estilo: 'Smash potente e jogo de rede', build: 'atletico', a: { forca: 88, vel: 84, def: 82, backhand: 80, curta: 80, lob: 80, smash: 89, saque: 84 }, look: { skin: '#e2b48f', hair: '#3a2614', cap: '#17324d', glasses: true, num: '71', racket: 'tufao' } },
  { id: 'garavine', jogo: 'tatico', name: 'Marco Garavine', alt: 185, pais: 'ITA', estilo: 'Experiência e leitura de jogo', build: 'compacto', a: { forca: 80, vel: 78, def: 88, backhand: 86, curta: 87, lob: 86, smash: 80, saque: 80 }, look: { skin: '#d8a47e', hair: '#2b1d14', visor: '#fbf6ea', glasses: true, num: '72', racket: 'medusa' } },
  { id: 'calbuci', name: 'Alessandro Calbuci', alt: 188, pais: 'ITA', estilo: 'Saque pesado e ataque por cima', build: 'forte', a: { forca: 86, vel: 79, def: 80, backhand: 78, curta: 78, lob: 79, smash: 87, saque: 88 }, look: { skin: '#efc6a3', hair: '#1b120c', cap: '#fbf6ea', glasses: false, band: true, num: '73', racket: 'kronos' } },
  { id: 'mingoze', jogo: 'paredao', name: 'Alex Mingoze', alt: 181, pais: 'ITA', estilo: 'Defesa incansável', build: 'esguio', a: { forca: 78, vel: 84, def: 87, backhand: 84, curta: 80, lob: 84, smash: 78, saque: 78 }, look: { skin: '#d2a07a', hair: '#5a3a1e', cap: '#0b7a83', glasses: true, num: '74', racket: 'atol' } },
  { id: 'bonete', name: 'Ricardo Bonete', alt: 184, pais: 'ITA', estilo: 'Completo e regular', build: 'atletico', a: { forca: 81, vel: 80, def: 82, backhand: 81, curta: 81, lob: 81, smash: 82, saque: 81 }, look: { skin: '#e2b48f', hair: '#2a1a0e', visor: '#17324d', glasses: true, num: '75', racket: 'recife' } },
  { id: 'facani', jogo: 'rede', name: 'Marco Facani', alt: 186, pais: 'ITA', estilo: 'Reflexos e voleio', build: 'esguio', a: { forca: 79, vel: 83, def: 81, backhand: 79, curta: 82, lob: 77, smash: 82, saque: 79 }, look: { skin: '#c99068', hair: '#120c08', cap: '#fbf6ea', glasses: false, num: '76', racket: 'proteo' } },
  { id: 'kudina', jogo: 'agressivo', name: 'Elisa Kudina', alt: 173, pais: 'RUS', estilo: 'Ataque do fundo e defesa rápida', build: 'atletico', fem: true, a: { forca: 97, vel: 90, def: 97, backhand: 90, curta: 90, lob: 90, smash: 97, saque: 90 }, look: { skin: '#efc6a3', hair: '#2b1d14', visor: '#fbf6ea', glasses: true, tank: true, num: '40', racket: 'medusa' } },
  { id: 'semena', jogo: 'lobista', name: 'Anastácia Semena', alt: 170, pais: 'RUS', estilo: 'Lobs precisos e tática na rede', build: 'esguio', fem: true, a: { forca: 92, vel: 92, def: 92, backhand: 92, curta: 97, lob: 98, smash: 92, saque: 92 }, look: { skin: '#d2a07a', hair: '#5a3a1e', cap: '#17324d', glasses: false, tank: true, num: '41', racket: 'kronos' } },
  { id: 'marquezin', name: 'Vitória Marquezin', alt: 168, pais: 'BRA', estilo: 'Reflexos e agressividade', build: 'compacto', fem: true, a: { forca: 89, vel: 97, def: 96, backhand: 89, curta: 89, lob: 89, smash: 95, saque: 89 }, look: { skin: '#a8704a', hair: '#a8743a', visor: '#ff5a1f', glasses: true, tank: true, num: '42', racket: 'supercarbon' } },
  { id: 'chou', name: 'Sofia Chou', alt: 170, pais: 'BRA', estilo: 'Defesa sólida e contra-ataque angulado', build: 'compacto', fem: true, a: { forca: 88, vel: 88, def: 96, backhand: 96, curta: 94, lob: 88, smash: 88, saque: 88 }, look: { skin: '#e2b48f', hair: '#120c08', visor: '#fbf6ea', glasses: false, tank: true, num: '43', racket: 'proteo' } },
  { id: 'gaspar', name: 'Júlia Gaspar', alt: 165, pais: 'ITA', estilo: 'Consistência e controle mental', build: 'compacto', fem: true, a: { forca: 88, vel: 88, def: 93, backhand: 94, curta: 88, lob: 93, smash: 88, saque: 88 }, look: { skin: '#e2b48f', hair: '#6a3f1d', visor: '#fbf6ea', glasses: true, tank: true, num: '11', racket: 'medusa' } },
  { id: 'valentim', name: 'Nina Valentim', alt: 166, pais: 'ITA', estilo: 'Defensora', build: 'atletico', fem: true, a: { forca: 88, vel: 94, def: 94, backhand: 88, curta: 88, lob: 88, smash: 88, saque: 88 }, look: { skin: '#e2b48f', hair: '#3a2615', visor: '#ff5a1f', glasses: false, tank: true, num: '14', racket: 'proteo' } },
  { id: 'miler', name: 'Rafaela Miler', alt: 176, pais: 'BRA', estilo: 'Envergadura, saque dominante e jogo aéreo', build: 'esguio', fem: true, a: { forca: 86, vel: 86, def: 86, backhand: 86, curta: 86, lob: 86, smash: 93, saque: 95 }, look: { skin: '#d8a47e', hair: '#2b1d14', visor: '#17324d', glasses: true, tank: true, num: '13', racket: 'kronos' } },
  { id: 'casadi', name: 'Verônica Casadi', alt: 176, pais: 'ITA', estilo: 'Potente', build: 'atletico', fem: true, a: { forca: 92, vel: 85, def: 85, backhand: 83, curta: 85, lob: 85, smash: 92, saque: 92 }, look: { skin: '#d8a47e', hair: '#c99a5a', visor: '#fbf6ea', glasses: true, tank: true, num: '46', racket: 'supercarbon' } },
  { id: 'grael', name: 'Ariadne Costa Grael', alt: 168, pais: 'ESP', estilo: 'Regularidade e variação de efeitos', build: 'esguio', fem: true, a: { forca: 86, vel: 86, def: 86, backhand: 93, curta: 92, lob: 92, smash: 86, saque: 86 }, look: { skin: '#b07a52', hair: '#1b120c', cap: '#17324d', glasses: false, tank: true, num: '47', racket: 'proteo' } },
  { id: 'nobre', name: 'Nicole Nobre', alt: 163, pais: 'ITA', estilo: 'Agilidade na rede e transição defensiva', build: 'esguio', fem: true, a: { forca: 84, vel: 93, def: 91, backhand: 84, curta: 90, lob: 84, smash: 84, saque: 84 }, look: { skin: '#efc6a3', hair: '#a8743a', cap: '#fbf6ea', glasses: false, tank: true, num: '12', racket: 'supercarbon' } },
  { id: 'dias', name: 'Paty Dias', alt: 162, pais: 'VEN', estilo: 'Jogo de rede', build: 'atletico', fem: true, a: { forca: 85, vel: 91, def: 85, backhand: 85, curta: 91, lob: 85, smash: 85, saque: 85 }, look: { skin: '#b07a52', hair: '#1b120c', visor: '#fbf6ea', glasses: true, tank: true, num: '16', racket: 'supercarbon' } },
  { id: 'cimadi', name: 'Sofia Cimadi', alt: 174, pais: 'ITA', estilo: 'Smash pesado e pressão no saque', build: 'forte', fem: true, a: { forca: 90, vel: 83, def: 83, backhand: 83, curta: 83, lob: 83, smash: 92, saque: 91 }, look: { skin: '#d6a47c', hair: '#5a3a1e', cap: '#17324d', glasses: true, tank: true, num: '15', racket: 'medusa' } },
  { id: 'daino', name: 'Flávia Daino', alt: 168, pais: 'ITA', estilo: 'Toque, curtinhas e defesa inteligente', build: 'esguio', fem: true, a: { forca: 82, vel: 82, def: 89, backhand: 82, curta: 93, lob: 88, smash: 82, saque: 82 }, look: { skin: '#efc6a3', hair: '#6a3f1d', cap: '#0b7a83', glasses: false, tank: true, num: '17', racket: 'kronos' } },
  { id: 'franceschini', name: 'Elena Franceschini', alt: 172, pais: 'ITA', estilo: 'Intensidade e golpes profundos', build: 'atletico', fem: true, a: { forca: 90, vel: 90, def: 83, backhand: 83, curta: 83, lob: 83, smash: 83, saque: 83 }, look: { skin: '#c68a5e', hair: '#3a2615', visor: '#fbf6ea', glasses: true, tank: true, num: '62', racket: 'proteo' } },
  { id: 'tripa', name: 'Giulia Tripa', alt: 169, pais: 'ITA', estilo: 'Toque e lob', build: 'atletico', fem: true, a: { forca: 83, vel: 83, def: 83, backhand: 84, curta: 88, lob: 88, smash: 83, saque: 83 }, look: { skin: '#c68a5e', hair: '#3a2615', visor: '#fbf6ea', glasses: true, tank: true, num: '52', racket: 'medusa' } },
  { id: 'vida', name: 'Marcela Vida', alt: 171, pais: 'BRA', estilo: 'Saque forte', build: 'atletico', fem: true, a: { forca: 88, vel: 82, def: 82, backhand: 82, curta: 82, lob: 82, smash: 82, saque: 88 }, look: { skin: '#8d5a3b', hair: '#6a3f1d', cap: '#17324d', glasses: false, tank: true, num: '53', racket: 'kronos' } },
  { id: 'palos', name: 'Eva Fernandes Palos', alt: 171, pais: 'ESP', estilo: 'Cobertura de quadra e cruzadas', build: 'atletico', fem: true, a: { forca: 81, vel: 88, def: 88, backhand: 88, curta: 81, lob: 81, smash: 81, saque: 81 }, look: { skin: '#8d5a3b', hair: '#6a3f1d', cap: '#17324d', glasses: false, tank: true, num: '63', racket: 'medusa' } },
  { id: 'podlubna', name: 'Verônica Podlubna', alt: 175, pais: 'RUS', estilo: 'Braços longos e voleio agressivo', build: 'esguio', fem: true, a: { forca: 81, vel: 81, def: 87, backhand: 81, curta: 81, lob: 81, smash: 88, saque: 81 }, look: { skin: '#d8a47e', hair: '#c99a5a', visor: '#ff5a1f', glasses: true, tank: true, num: '64', racket: 'kronos' } },
  { id: 'justi', name: 'Greta Justi', alt: 170, pais: 'ITA', estilo: 'Defensora', build: 'atletico', fem: true, a: { forca: 81, vel: 87, def: 87, backhand: 81, curta: 81, lob: 81, smash: 81, saque: 81 }, look: { skin: '#d8a47e', hair: '#c99a5a', visor: '#ff5a1f', glasses: true, tank: true, num: '54', racket: 'supercarbon' } },
  { id: 'magalhaes', name: 'Marta Magalhãs', alt: 170, pais: 'POR', estilo: 'Técnica clássica e contra-ataque', build: 'esguio', fem: true, a: { forca: 81, vel: 81, def: 81, backhand: 87, curta: 86, lob: 81, smash: 81, saque: 81 }, look: { skin: '#b07a52', hair: '#1b120c', visor: '#fbf6ea', glasses: false, tank: true, num: '65', racket: 'supercarbon' } },
  { id: 'cortes', name: 'Joana Cortês', alt: 165, pais: 'BRA', estilo: 'Experiência e precisão', build: 'atletico', fem: true, a: { forca: 80, vel: 80, def: 80, backhand: 86, curta: 87, lob: 86, smash: 80, saque: 80 }, look: { skin: '#efc6a3', hair: '#2b1d14', cap: '#17324d', glasses: true, tank: true, num: '66', racket: 'proteo' } },
  { id: 'nogueiro', name: 'Júlia Nogueiro', alt: 172, pais: 'BRA', estilo: 'Força bruta e saque pesado', build: 'forte', fem: true, a: { forca: 88, vel: 79, def: 79, backhand: 79, curta: 79, lob: 79, smash: 79, saque: 87 }, look: { skin: '#efc6a3', hair: '#2b1d14', cap: '#17324d', glasses: true, tank: true, num: '56', racket: 'medusa' } },
  { id: 'damata', name: 'Graziela da Mata', alt: 170, pais: 'BRA', estilo: 'Potência física e ataque veloz', build: 'forte', fem: true, a: { forca: 87, vel: 79, def: 79, backhand: 79, curta: 79, lob: 79, smash: 86, saque: 79 }, look: { skin: '#d2a07a', hair: '#5a3a1e', visor: '#ff5a1f', glasses: false, tank: true, num: '57', racket: 'kronos' } },
  { id: 'pansani', name: 'Isadora Pansane', alt: 166, pais: 'BRA', estilo: 'Ritmo elétrico e reflexos', build: 'compacto', fem: true, a: { forca: 79, vel: 87, def: 85, backhand: 79, curta: 79, lob: 79, smash: 79, saque: 79 }, look: { skin: '#d2a07a', hair: '#5a3a1e', visor: '#ff5a1f', glasses: false, tank: true, num: '67', racket: 'medusa' } },
  { id: 'abreu', name: 'Daniela Abreus', alt: 168, pais: 'BRA', estilo: 'Paciência, lob defensivo e poucos erros', build: 'atletico', fem: true, a: { forca: 78, vel: 78, def: 85, backhand: 84, curta: 78, lob: 87, smash: 78, saque: 78 }, look: { skin: '#a8704a', hair: '#a8743a', visor: '#fbf6ea', glasses: true, tank: true, num: '68', racket: 'kronos' } },
  { id: 'leite', name: 'Marceli Leite', alt: 167, pais: 'BRA', estilo: 'Defesas impossíveis em bola baixa', build: 'esguio', fem: true, a: { forca: 77, vel: 84, def: 87, backhand: 77, curta: 77, lob: 77, smash: 77, saque: 77 }, look: { skin: '#e2b48f', hair: '#120c08', cap: '#17324d', glasses: false, tank: true, num: '69', racket: 'supercarbon' } },
  { id: 'peracine', name: 'Mariana Peracine', alt: 166, pais: 'BRA', estilo: 'Jogo de rede', build: 'atletico', fem: true, a: { forca: 78, vel: 84, def: 78, backhand: 78, curta: 84, lob: 78, smash: 78, saque: 78 }, look: { skin: '#a8704a', hair: '#a8743a', visor: '#fbf6ea', glasses: true, tank: true, num: '58', racket: 'supercarbon' } },
  { id: 'pereira', name: 'Daniela Rodrigues Pereira', alt: 165, pais: 'ESP', estilo: 'Defensora', build: 'atletico', fem: true, a: { forca: 78, vel: 84, def: 84, backhand: 78, curta: 78, lob: 78, smash: 78, saque: 78 }, look: { skin: '#e2b48f', hair: '#120c08', cap: '#17324d', glasses: false, tank: true, num: '59', racket: 'proteo' } },
  { id: 'alves', name: 'Bia Alves', alt: 164, pais: 'BRA', estilo: 'Iniciante', build: 'atletico', fem: true, a: { forca: 58, vel: 66, def: 60, backhand: 58, curta: 58, lob: 62, smash: 56, saque: 58 }, look: { skin: '#8d5a3b', hair: '#120c08', visor: '#fbf6ea', tank: true, num: '20', racket: 'supercarbon' } },
  { id: 'churak', name: 'Daria Churak', alt: 174, pais: 'RUS', estilo: 'Potência do fundo', build: 'atletico', fem: true, a: { forca: 90, vel: 85, def: 86, backhand: 84, curta: 83, lob: 84, smash: 90, saque: 86 }, look: { skin: '#efc6a3', hair: '#7a5a3a', visor: '#fbf6ea', glasses: true, tank: true, num: '77', racket: 'tufao' } },
  { id: 'glimak', jogo: 'tatico', name: 'Irina Glimak', alt: 171, pais: 'RUS', estilo: 'Toque e variação', build: 'esguio', fem: true, a: { forca: 82, vel: 86, def: 87, backhand: 86, curta: 89, lob: 87, smash: 82, saque: 82 }, look: { skin: '#f1cfae', hair: '#2b1d14', cap: '#17324d', glasses: true, tank: true, num: '78', racket: 'ventosul' } },
  { id: 'nikoian', name: 'Liudmila Nikoian', alt: 172, pais: 'RUS', estilo: 'Regularidade e defesa', build: 'compacto', fem: true, a: { forca: 81, vel: 83, def: 87, backhand: 84, curta: 82, lob: 84, smash: 81, saque: 81 }, look: { skin: '#e2b48f', hair: '#3a2614', visor: '#0b7a83', glasses: false, tank: true, num: '79', racket: 'medusa' } },
];
const overall = a => Math.round(Object.keys(ATTR_W).reduce((t, k) => t + a[k] * ATTR_W[k], 0));
let NAMES = {};
try { NAMES = JSON.parse(localStorage.getItem('pdo-names') || '{}') || {}; } catch (e) { NAMES = {}; }
$s.CAREER_CHARS = []; // jogador da carreira e personagens fictícios
// na carreira vale a versão da carreira (com fase e evolução); fora dela, a base
const charById = id => ($s.CAREER_CHARS && $s.CAREER_CHARS.find(c => c.id === id)) || ROSTER.find(c => c.id === id) || ROSTER[0];
let HEIGHTS = {};
try { HEIGHTS = JSON.parse(localStorage.getItem('pdo-heights') || '{}') || {}; } catch (e) { HEIGHTS = {}; }
const heightOf = c => clamp(+(HEIGHTS[c.id] || c.alt || (c.fem ? 170 : 183)), 150, 215) / 100;
// fator de altura: >0 baixo (mais ágil em bola baixa), <0 alto (alcança mais em cima)
const shortK = p => clamp((1.82 - (p.height || 1.85)) / .2, -1, 1);
const hScale = p => (p.height || 1.87) / 1.87;
const nameOf = c => (NAMES[c.id] && NAMES[c.id].trim()) || c.name;
const shortOf = c => { const w = nameOf(c).trim().split(/\s+/); return w[w.length - 1].toUpperCase(); };
const KITS = [
  [{ shirt: '#ff5a1f', trim: '#fbf6ea', shorts: '#17324d' }, { shirt: '#ff7a3d', trim: '#17324d', shorts: '#17324d' }],
  [{ shirt: '#0b7a83', trim: '#fbf6ea', shorts: '#f2efe6' }, { shirt: '#13939c', trim: '#ffd23f', shorts: '#f2efe6' }],
];
const ATTR_OF = { smash: 'smash', drive: 'smash', lob: 'lob', curta: 'curta', defesa: 'def' };
// atributo na escala do jogo: 35 → 0, 65 → .5, 95 → 1 (os atributos vão de ~35 nos amadores a ~95 no topo)
const attrN = v => clamp((v - 35) / 60, 0, 1.07);
const attrK = (p, k) => attrN(p.char ? p.char.a[k] : 70);
// fraqueza: 0 com o atributo em 72 ou mais, 1 em 40 — atributo fraco pesa bem mais que a escala linear
const weakK = (p, k) => clamp((72 - (p.char ? p.char.a[k] : 70)) / 32, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
// ruído de valor que fecha nas bordas (textura repetível)
function hash2(i, j, seed) { const s = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, y, P, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const w = i => ((i % P) + P) % P;
  const a = hash2(w(xi), w(yi), seed), b = hash2(w(xi + 1), w(yi), seed), c = hash2(w(xi), w(yi + 1), seed), d = hash2(w(xi + 1), w(yi + 1), seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, y, P, oct, seed) { let a = .5, f = 1, s = 0, n = 0; for (let o = 0; o < oct; o++) { s += a * vnoise(x * f, y * f, P * f, seed + o); n += a; a *= .5; f *= 2; } return s / n; }

export { attrN, weakK, lookExtras, ATTRS, ATTR_OF, C, DIFF, G, GEAR, HALF_W, HEIGHTS, KITS, NAMES, PLAY_STYLES, P_SPEED, RACKET_STATS, ROSTER, SERVES, SHORE_Z, SHOTS, STAFF, STEP, SWING_DUR, TOSS_T, V3, WATERLINE, ZONE3, attrK, bG, charById, clamp, effA, fbm, gauss, hScale, heightOf, lerp, nameOf, overall, racketBonus, rand, shortK, shortOf, smooth, styleOf };
