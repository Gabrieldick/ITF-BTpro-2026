// @ts-nocheck
// constantes, elenco de atletas, raquetes, equipe técnica, estilos de jogo e utilitários
import * as THREE from 'three';
import { $s } from '../state';
import { ball } from './07-glb';
const V3 = THREE.Vector3;
const G = 9.8;
// efeito da bola: topspin mergulha (gk > 1), slice flutua (gk < 1)
// lançamento do saque: bola "mais pesada" (sobe a mesma altura em menos tempo, lançamento mais ágil)
const TOSS_G = 1.6;
const bG = () => ball.state === 'live' ? G * (ball.gk || 1) : ball.state === 'toss' ? G * TOSS_G : G;
const C = { halfL: 8, halfW: 2.25, netH: 1.7, ballR: .035, netHalf: 4.6 };
const HALF_W = { simples: 2.25, dupla: 4 };
const STEP = 1 / 120;
const P_SPEED = 4.8; // velocidade máxima base (m/s), multiplicada pelo atributo (velMul)
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
  smash:  { label: 'SAQUE FORTE',  speed: 22, depth: [4.5, 6.8], margin: .06, noise: .55 }, // saques mais rápidos: não dá tempo de chegar na rede enquanto a bola viaja
  lob:    { label: 'SAQUE ALTO',   T: 1.9,      depth: [5.5, 7.4], margin: .5,  noise: .4 },
  curta:  { label: 'SAQUE CURTO',  T: .85,      depth: [1.6, 3.0], margin: .2,  noise: .35 },
  defesa: { label: 'SAQUE SEGURO', T: 1.05,     depth: [4.0, 6.0], margin: .3,  noise: .25 },
};
const DIFF = {
  facil:   { speed: 3.4, react: .30, miss: .14, err: .10,  q: [.45, .75], smart: .3, letGo: .3 },
  medio:   { speed: 4.1, react: .18, miss: .07, err: .055, q: [.60, .90], smart: .6, letGo: .6 },
  dificil: { speed: 4.8, react: .10, miss: .03, err: .025, q: [.75, 1.0], smart: .9, letGo: .9 },
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// elenco com nomes que lembram jogadores do circuito; atributos são estimativas do jogo e os nomes podem ser trocados no menu
const ATTRS = [['forca', 'Força'], ['vel', 'Velocidade'], ['def', 'Defesa'], ['backhand', 'Backhand'], ['curta', 'Curta'], ['lob', 'Lob'], ['smash', 'Smash'], ['saque', 'Saque'], ['leitura', 'Noção de jogo'], ['voleio', 'Voleio']];
const ATTR_W0 = { forca: .13, vel: .15, def: .15, backhand: .08, curta: .11, lob: .11, smash: .15, saque: .12 };
// noção de jogo (leitura): pesa 8% no overall; quem não tem (jogadores antigos) fica com a média dos outros atributos
// voleio: bola no ar perto da rede (drive, voleio da barra, bloqueio) mais rápida e consistente, e o ventaglio; pesa 6%;
// quem não tem fica com uma mistura de defesa, velocidade, backhand e smash (os voleadores ganham um pouco mais, abaixo)
const ATTR_W = Object.assign(Object.fromEntries(Object.entries(ATTR_W0).map(([k, w]) => [k, w * .86])), { leitura: .08, voleio: .06 });
const leituraOf = a => Math.round(Object.keys(ATTR_W0).reduce((t, k) => t + (Number.isFinite(a[k]) ? a[k] : 50) * ATTR_W0[k], 0));
const fin = v => Number.isFinite(v) ? v : 50;
const voleioOf = a => Math.round(fin(a.def) * .3 + fin(a.vel) * .25 + fin(a.backhand) * .25 + fin(a.smash) * .2);
// valor inválido (NaN de save antigo) conta como ausente: nunca deixa a física/animação receber NaN
const attrOf = (a, k) => { const v = a[k]; return Number.isFinite(v) ? v : k === 'leitura' ? leituraOf(a) : k === 'voleio' ? voleioOf(a) : 50; };
// raquetes e equipamentos: alteram os atributos de quem usa (também fora da carreira)
// raquetes: a soma dos bônus cresce com o preço; as especializadas têm picos maiores com algum ponto fraco
const RACKET_STATS = {
  basica: { nome: 'Iniciante Areia', preco: 0, desc: 'Pesada e sem potência. É o que dá para ter no começo.', b: { forca: -4, smash: -4, saque: -3, curta: -2, lob: -1 } },
  tropic: { nome: 'Tropic Lite', preco: 300, desc: 'Alumínio leve: perde menos que a Iniciante, ainda sem potência.', b: { forca: -2, smash: -2, saque: -1, curta: -1 } },
  brisa: { nome: 'Brisa Junior', preco: 450, desc: 'Face macia: bom toque para quem está começando.', b: { curta: 1, def: 1, forca: -2, smash: -2, saque: -1 } },
  fibra: { nome: 'Fibra Speed', preco: 600, desc: 'Fibra de vidro, leve e confortável. Ainda falta potência.', b: { forca: -1, smash: -1, curta: 1, def: 1 } },
  areia: { nome: 'Areia Light', preco: 1000, desc: 'A primeira sem pontos fracos: leve e fácil de manejar.', b: { def: 1, curta: 1 } },
  mare: { nome: 'Mormaji Vitória III', preco: 1600, desc: 'Controle: bolas na mão para curtas e defesas.', b: { def: 2, curta: 2, lob: 1, forca: -1 } },
  coral: { nome: 'Coral Power', preco: 2200, desc: 'Primeira raquete de potência: smash mais pesado.', b: { forca: 2, smash: 2, saque: 1, curta: -1 } },
  duna: { nome: 'Duna Soft', preco: 2900, desc: 'Borracha macia: lobs altos e defesa segura.', b: { lob: 3, def: 1, backhand: 1 } },
  medusa: { nome: 'Ana Sport Medusa 6K', preco: 4000, desc: 'Controle: curtas, defesas e backhand mais precisos.', b: { def: 2, curta: 3, backhand: 2, forca: -1 } },
  proteo: { nome: 'Herue\'s Starlite', preco: 5500, desc: 'Equilíbrio entre controle e potência.', b: { lob: 1, def: 1, smash: 1, saque: 1, curta: 1, backhand: 1 } },
  vela: { nome: 'Vela Pro', preco: 7500, desc: 'Leve na cabeça: saque e smash rápidos sem perder o toque.', b: { smash: 2, saque: 2, forca: 1, lob: 1, curta: 1 } },
  tufao: { nome: 'Drop Shut Prime Attack', preco: 9500, desc: 'Ataque: smash e força, mas pouca sensibilidade.', b: { smash: 4, forca: 3, saque: 2, def: -1, curta: -1 } },
  atol: { nome: 'Nux V10', preco: 12000, desc: 'Defensiva: alcança mais e devolve tudo.', b: { def: 4, vel: 1, backhand: 2, lob: 2, smash: -1 } },
  kronos: { nome: 'Kuna Gladiator', preco: 14500, desc: 'Potência: smash e saque pesados, menos toque.', b: { forca: 5, smash: 4, saque: 2, curta: -2, def: -1 } },
  ventosul: { nome: 'Zanb Bruxo', preco: 18000, desc: 'Toque refinado: curtas e lobs milimétricos.', b: { curta: 5, lob: 4, backhand: 1, forca: -1 } },
  maresia: { nome: 'Maresia Control', preco: 22500, desc: 'Controle de alto nível: defesa e curta sem esforço.', b: { def: 3, curta: 3, lob: 2, backhand: 2 } },
  recife: { nome: 'Nux Nova 87', preco: 28000, desc: 'Híbrida: um pouco de tudo, sem pontos fracos.', b: { smash: 2, def: 2, saque: 1, lob: 2, curta: 2, backhand: 1 } },
  farol: { nome: 'Farol Power', preco: 35000, desc: 'Potência profissional: smash e saque que assustam.', b: { forca: 4, smash: 4, saque: 3 } },
  supercarbon: { nome: 'Ana Sport Poison Bee', preco: 46000, desc: 'Topo de linha em carbono: melhora tudo.', b: { forca: 3, smash: 3, saque: 2, def: 2, curta: 1, lob: 1, backhand: 1 } },
  corsario: { nome: 'Corsário Hybrid', preco: 62000, desc: 'Híbrida de circuito: completa e muito estável.', b: { smash: 2, def: 2, saque: 2, lob: 2, curta: 2, backhand: 2, forca: 1 } },
  tsunami: { nome: 'Adibas World Cup', preco: 82000, desc: 'A mais potente do circuito: pancada pura.', b: { forca: 6, smash: 5, saque: 3, def: 1, curta: -1 } },
  abismo: { nome: 'Vizion Precision', preco: 108000, desc: 'Defesa de elite: devolve até a finalização.', b: { def: 5, vel: 1, backhand: 4, lob: 3, curta: 2 } },
  zjump: { nome: 'Zanb Z Jump', preco: 120000, desc: 'Ataque explosivo: smash e saque de quem pula alto.', b: { forca: 4, smash: 5, saque: 3, vel: 1, curta: -1 } },
  eclipse: { nome: 'Herue\'s Fierce', preco: 145000, desc: 'Controle de elite: defesa, curta e lob de outro nível.', b: { def: 5, curta: 4, backhand: 3, lob: 3, vel: 1 } },
  trovao: { nome: 'Shank Predator', preco: 195000, desc: 'Potência máxima com um pouco de toque.', b: { forca: 6, smash: 6, saque: 4, curta: 1 } },
  aurora: { nome: 'Herue\'s Rebel', preco: 255000, desc: 'Quase perfeita: controle e ataque de campeão.', b: { def: 4, curta: 4, lob: 3, backhand: 3, smash: 2, saque: 1, vel: 1 } },
  zenite: { nome: 'Nux NG17 Luxury', preco: 330000, desc: 'A melhor raquete do mundo: tudo no máximo.', b: { forca: 4, smash: 4, saque: 3, def: 3, curta: 2, lob: 2, backhand: 1 } },
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
// roupas (loja da carreira): modelos de blusa, estampas e partes de baixo; as cores o jogador escolhe. id da estampa = o
// número usado no shader do modelo realista e no desenho da camiseta do boneco desenhado
// g: peça do modelo (default = a própria chave); f: tecido (dry: furadinho, satin: acetinado, gold: fio de ouro, black:
// black label, glitter: brilho, carbon: trama de carbono); ex: exclusiva, pede ranking (rank), título (title = nível) ou fama
const TOP_KINDS = {
  tee: { nome: 'Camiseta', preco: 0 }, tank: { nome: 'Regata', preco: 180 }, crop: { nome: 'Cropped', preco: 220, fem: true },
  cav: { nome: 'Camiseta cavada', preco: 300 }, sbra: { nome: 'Top esportivo', preco: 350, fem: true }, long: { nome: 'Manga longa UV', preco: 480 },
  teeDry: { nome: 'Camiseta dry-fit', preco: 650, g: 'tee', f: 'dry' }, tankDry: { nome: 'Regata dry-fit', preco: 600, g: 'tank', f: 'dry' },
  cavDry: { nome: 'Cavada dry-fit', preco: 700, g: 'cav', f: 'dry' }, cropDry: { nome: 'Cropped dry-fit', preco: 640, g: 'crop', f: 'dry', fem: true },
  teeSat: { nome: 'Camiseta de compressão acetinada', preco: 1100, g: 'tee', f: 'satin' }, sbraSat: { nome: 'Top acetinado', preco: 1200, g: 'sbra', f: 'satin', fem: true },
  longSat: { nome: 'Manga longa térmica Pro', preco: 1800, g: 'long', f: 'satin' }, tankCarb: { nome: 'Regata Carbono', preco: 9500, g: 'tank', f: 'carbon', ex: { rank: 100 } },
  cavCarb: { nome: 'Cavada Carbono', preco: 11000, g: 'cav', f: 'carbon', ex: { rank: 100 } }, teeBlack: { nome: 'Camiseta Black Label', preco: 18000, g: 'tee', f: 'black', ex: { rank: 30 } },
  tankBlack: { nome: 'Regata Black Label', preco: 16000, g: 'tank', f: 'black', ex: { rank: 30 } }, cropGlit: { nome: 'Cropped Diamante', preco: 35000, g: 'crop', f: 'glitter', fem: true, ex: { fama: 80 } },
  sbraGlit: { nome: 'Top Diamante', preco: 32000, g: 'sbra', f: 'glitter', fem: true, ex: { fama: 80 } }, teeGold: { nome: 'Camiseta Fio de Ouro', preco: 28000, g: 'tee', f: 'gold', ex: { rank: 10 } },
  cavGold: { nome: 'Cavada Fio de Ouro', preco: 30000, g: 'cav', f: 'gold', ex: { rank: 10 } }, longGold: { nome: 'Manga longa Edição Mundial', preco: 60000, g: 'long', f: 'gold', ex: { title: 9 } },
};
const BOT_KINDS = {
  short: { nome: 'Short', preco: 0 }, bermuda: { nome: 'Bermuda', preco: 200 }, saia: { nome: 'Saia pregueada', preco: 240, fem: true },
  shortinho: { nome: 'Short curto', preco: 220 }, saiaC: { nome: 'Saia curta', preco: 300, fem: true }, compress: { nome: 'Bermuda de compressão', preco: 380 },
  legging: { nome: 'Legging 3/4', preco: 420, fem: true }, shortDry: { nome: 'Short dry-fit', preco: 520, g: 'short', f: 'dry' },
  shortSat: { nome: 'Short acetinado', preco: 900, g: 'shortinho', f: 'satin' }, compCarb: { nome: 'Compressão Carbono', preco: 8000, g: 'compress', f: 'carbon', ex: { rank: 100 } },
  bermBlack: { nome: 'Bermuda Black Label', preco: 12000, g: 'bermuda', f: 'black', ex: { rank: 30 } }, leggBlack: { nome: 'Legging Black Label', preco: 13000, g: 'legging', f: 'black', fem: true, ex: { rank: 30 } },
  saiaGlit: { nome: 'Saia Diamante', preco: 20000, g: 'saiaC', f: 'glitter', fem: true, ex: { fama: 80 } }, shortGold: { nome: 'Short Fio de Ouro', preco: 15000, g: 'short', f: 'gold', ex: { rank: 10 } },
};
// acessórios (loja): slot = onde vai; cor escolhida no editor do jogador; lentes e peças de cabeça especiais mudam o material
const ACCESS = {
  munhe: { nome: 'Munhequeiras', preco: 150, slot: 'wrist', ic: '🩹' }, manguito: { nome: 'Manguito de compressão', preco: 260, slot: 'sleeve', ic: '💪' },
  meiao: { nome: 'Meião de compressão', preco: 240, slot: 'calf', ic: '🧦' }, lenteAzul: { nome: 'Lente espelhada azul', preco: 900, slot: 'lens', lens: '#2a6cff', ic: '🕶️' },
  lenteVerm: { nome: 'Lente espelhada vermelha', preco: 900, slot: 'lens', lens: '#ff3b2a', ic: '🕶️' }, lenteVerde: { nome: 'Lente espelhada verde', preco: 900, slot: 'lens', lens: '#2fd16a', ic: '🕶️' },
  lenteOuro: { nome: 'Lente espelhada dourada', preco: 7500, slot: 'lens', lens: '#ffc640', ic: '🕶️', ex: { rank: 30 } },
  cabBlack: { nome: 'Boné/viseira Black Label', preco: 6000, slot: 'headfab', fab: 'black', ic: '🧢', ex: { rank: 30 } },
  cabGold: { nome: 'Boné/viseira Fio de Ouro', preco: 9000, slot: 'headfab', fab: 'gold', ic: '👑', ex: { rank: 10 } },
  munheGold: { nome: 'Munhequeiras Fio de Ouro', preco: 5000, slot: 'wristfab', fab: 'gold', ic: '✨', ex: { rank: 10 } },
};
const FABRIC_NOME = { dry: 'dry-fit', satin: 'acetinado', carbon: 'trama de carbono', black: 'Black Label', glitter: 'brilho diamante', gold: 'fio de ouro' };
const PATTERNS = {
  liso: { nome: 'Lisa', preco: 0, id: 0 }, listras: { nome: 'Listras', preco: 150, id: 1 }, faixas: { nome: 'Faixas verticais', preco: 160, id: 2 },
  diagonal: { nome: 'Faixa diagonal', preco: 200, id: 3 }, degrade: { nome: 'Degradê', preco: 260, id: 4 }, lateral: { nome: 'Painéis laterais', preco: 220, id: 5 },
  chevron: { nome: 'Chevron', preco: 280, id: 6 }, bolinhas: { nome: 'Bolinhas', preco: 240, id: 7 }, camuflado: { nome: 'Camuflada', preco: 320, id: 8 },
  ombros: { nome: 'Ombros de outra cor', preco: 200, id: 9 }, ondas: { nome: 'Ondas', preco: 300, id: 10 }, tropical: { nome: 'Tropical (folhas)', preco: 360, id: 11 },
  // inspiradas nas camisas de beach tennis/tênis das marcas grandes (sem nome nem logo delas)
  tresfaixas: { nome: 'Três faixas no ombro', preco: 380, id: 12 }, faixaslado: { nome: 'Três faixas laterais', preco: 360, id: 13 },
  gola: { nome: 'Gola e punhos contrastantes', preco: 260, id: 14 }, respingos: { nome: 'Respingos de tinta', preco: 420, id: 15 },
  geodegrade: { nome: 'Geométrica em degradê', preco: 440, id: 16 }, peito: { nome: 'Faixa no peito', preco: 280, id: 17 },
  ventilada: { nome: 'Laterais ventiladas', preco: 320, id: 18 }, pinceladas: { nome: 'Pinceladas vibrantes', preco: 460, id: 19 },
  xadrez: { nome: 'Xadrez', preco: 380, id: 22 }, pixel: { nome: 'Camuflada pixel', preco: 520, id: 24 }, raios: { nome: 'Raios', preco: 640, id: 21 },
  onca: { nome: 'Onça-pintada', preco: 4500, id: 23, ex: { rank: 100 } }, marmore: { nome: 'Mármore', preco: 6000, id: 20, ex: { rank: 50 } },
};
const OUTFIT_COLORS = ['#ff5a1f', '#ffd23f', '#e2364a', '#ff86c0', '#9b5cff', '#1f6fd1', '#17324d', '#0b7a83', '#3fd17a', '#2e9e57', '#fbf6ea', '#ffffff', '#9aa3ad', '#141414'];
// equipamentos por categoria (como a raquete): você pode ter vários, mas usa um de cada categoria; quanto melhor, mais caro.
// Somados, no máximo +3 por atributo (GEAR_CAP) — e com a raquete ainda há retorno decrescente
const GEAR_CAP = 3;
const GEAR_SLOTS = [['cabeca', '🧢 Cabeça'], ['oculos', '🕶️ Óculos'], ['grip', '✋ Empunhadura'], ['pes', '🦶 Pés'], ['corpo', '👕 Corpo'], ['tec', '📊 Tecnologia'], ['fisico', '💪 Preparação física'], ['treino', '🎾 Treino']];
const GEAR = [
  { id: 'viseira', slot: 'cabeca', nome: 'Viseira pro', preco: 300, desc: 'Menos sol no rosto no saque.', b: { saque: 1 } },
  { id: 'faixa', slot: 'cabeca', nome: 'Faixa técnica de cabelo', preco: 1500, desc: 'Suor longe dos olhos no saque e no lob.', b: { saque: 1, lob: 1 } },
  { id: 'boneice', slot: 'cabeca', nome: 'Boné com resfriamento', preco: 18000, desc: 'Cabeça fresca no sol do meio-dia.', b: { saque: 2, lob: 1 } },
  { id: 'visorhud', slot: 'cabeca', nome: 'Viseira antirreflexo de competição', preco: 120000, desc: 'Enxerga o lançamento contra qualquer sol.', b: { saque: 2, lob: 2 } },
  { id: 'oculos', slot: 'oculos', nome: 'Óculos esportivos', preco: 700, desc: 'Enxerga a bola contra o sol.', b: { def: 1 } },
  { id: 'polarizado', slot: 'oculos', nome: 'Óculos polarizados de elite', preco: 6500, desc: 'Lê a bola contra o sol do meio-dia.', b: { def: 1, leitura: 1 } },
  { id: 'oculosfoto', slot: 'oculos', nome: 'Óculos fotocromáticos pro', preco: 30000, desc: 'A lente se ajusta à luz a cada ponto.', b: { def: 2, leitura: 1 } },
  { id: 'neuro', slot: 'oculos', nome: 'Óculos de treino de reação', preco: 200000, desc: 'Lê e reage antes do adversário bater.', b: { def: 2, leitura: 2 } },
  { id: 'overgrip', slot: 'grip', nome: 'Kit overgrip pro', preco: 400, desc: 'Raquete firme no smash.', b: { smash: 1 } },
  { id: 'munhequeira', slot: 'grip', nome: 'Munhequeira e grip premium', preco: 1800, desc: 'Empunhadura firme no smash e no backhand.', b: { smash: 1, backhand: 1 } },
  { id: 'gripcouro', slot: 'grip', nome: 'Grip de couro sob medida', preco: 14000, desc: 'Toque mais fino no backhand e na curta.', b: { backhand: 2, curta: 1 } },
  { id: 'cordas', slot: 'grip', nome: 'Raquete balanceada em fábrica', preco: 90000, desc: 'Peso e equilíbrio ajustados ao seu braço.', b: { smash: 2, backhand: 2 } },
  { id: 'meia', slot: 'pes', nome: 'Meia de areia', preco: 500, desc: 'Arranque melhor na areia quente.', b: { vel: 1 } },
  { id: 'tornozeleira', slot: 'pes', nome: 'Tornozeleira estabilizadora', preco: 3000, desc: 'Apoio firme nas mudanças de direção.', b: { vel: 1, def: 1 } },
  { id: 'palmilha', slot: 'pes', nome: 'Palmilhas sob medida', preco: 25000, desc: 'Pisada estável na areia fofa.', b: { vel: 2, def: 1 } },
  { id: 'meiagraf', slot: 'pes', nome: 'Meia de areia com sola de grafeno', preco: 150000, desc: 'Explosão em qualquer areia.', b: { vel: 2, def: 2 } },
  { id: 'camisauv', slot: 'corpo', nome: 'Camisa UV de competição', preco: 1000, desc: 'Leve e fresca nos ralis longos.', b: { def: 1 } },
  { id: 'joelheira', slot: 'corpo', nome: 'Joelheira de compressão', preco: 4000, desc: 'Mais firmeza nas bolas baixas.', b: { curta: 1, def: 1 } },
  { id: 'compressao', slot: 'corpo', nome: 'Kit de compressão de recuperação', preco: 28000, desc: 'Pernas inteiras no terceiro set.', b: { def: 2, vel: 1 } },
  { id: 'trajepro', slot: 'corpo', nome: 'Traje de compressão sob medida', preco: 140000, desc: 'Cada músculo no lugar certo.', b: { def: 2, curta: 2 } },
  { id: 'relogio', slot: 'tec', nome: 'Relógio com GPS e carga de treino', preco: 2500, desc: 'Controle de carga e de tempo de jogo.', b: { leitura: 1 } },
  { id: 'sensor', slot: 'tec', nome: 'Sensor de golpes com análise em vídeo', preco: 9000, desc: 'Corrige o toque: curtas e lobs mais precisos.', b: { curta: 1, lob: 1 } },
  { id: 'scout', slot: 'tec', nome: 'Software de scouting dos rivais', preco: 35000, desc: 'Você sabe para onde eles jogam.', b: { leitura: 2, curta: 1 } },
  { id: 'labvideo', slot: 'tec', nome: 'Laboratório de vídeo 3D', preco: 60000, desc: 'Cada golpe medido quadro a quadro.', b: { lob: 2, curta: 1 } },
  { id: 'olhodigital', slot: 'tec', nome: 'Câmeras de arbitragem no seu treino', preco: 400000, desc: 'Cada bola medida ao centímetro, todo dia.', b: { leitura: 2, lob: 2 } },
  { id: 'handgrip', slot: 'fisico', nome: 'Hand grip e elásticos', preco: 600, desc: 'Antebraço mais forte.', b: { forca: 1 } },
  { id: 'suplem', slot: 'fisico', nome: 'Plano de suplementação', preco: 8000, desc: 'Recuperação e explosão.', b: { forca: 1, smash: 1 } },
  { id: 'eletro', slot: 'fisico', nome: 'Eletroestimulação de recuperação', preco: 40000, desc: 'Músculos prontos todo dia.', b: { forca: 2, vel: 1 } },
  { id: 'equipe24', slot: 'fisico', nome: 'Equipe de performance 24 horas', preco: 120000, desc: 'Fisiologista, nutricionista e preparador viajando com você.', b: { forca: 2, vel: 2 } },
  { id: 'genetica', slot: 'fisico', nome: 'Análise genética e nutrição de precisão', preco: 250000, desc: 'Dieta e carga sob medida para o seu corpo.', b: { forca: 2, smash: 2 } },
  { id: 'cones', slot: 'treino', nome: 'Kit de cones e escada de agilidade', preco: 2200, desc: 'Passos curtos e rápidos perto da rede.', b: { voleio: 1 } },
  { id: 'maqvoleio', slot: 'treino', nome: 'Máquina lançadora de alta velocidade', preco: 18000, desc: 'Reflexo de rede no treino.', b: { voleio: 1, saque: 1 } },
  { id: 'biomec', slot: 'treino', nome: 'Avaliação biomecânica completa', preco: 45000, desc: 'Ajusta o movimento do saque e do voleio.', b: { saque: 2, voleio: 1 } },
  { id: 'raqia', slot: 'treino', nome: 'Raquete com sensor e IA de treino', preco: 90000, desc: 'O treino se ajusta ao seu golpe, dia a dia.', b: { voleio: 2, backhand: 1 } },
  { id: 'cttreino', slot: 'treino', nome: 'Centro de treino particular com areia oficial', preco: 180000, desc: 'A quadra do Mundial no seu quintal.', b: { voleio: 2, saque: 2 } },
  { id: 'arenaclima', slot: 'treino', nome: 'Arena coberta com clima controlado', preco: 500000, desc: 'Treina com vento, calor e chuva simulados.', b: { voleio: 2, lob: 2 } },
];
const gearSum = ids => { const b = {}; (ids || []).forEach(id => { const g = GEAR.find(x => x.id === id); if (g && g.b) for (const k in g.b) b[k] = Math.min(GEAR_CAP, (b[k] || 0) + g.b[k]); }); return b; };
// o que está em uso: um por categoria (save antigo sem escolha: o melhor que você tem de cada)
const gearOn = (owned, eq) => GEAR_SLOTS.map(([sl]) => { const id = eq && eq[sl]; if (id && (owned || []).includes(id)) return id; const best = GEAR.filter(g => g.slot === sl && (owned || []).includes(g.id)).sort((a, b) => b.preco - a.preco)[0]; return eq && sl in eq ? null : best ? best.id : null; }).filter(Boolean);
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
// resumo do efeito de uma raquete para listas: "+5 força, +4 smash, −2 curta"
const RK_ABBR = { forca: 'força', vel: 'velocidade', def: 'defesa', backhand: 'backhand', curta: 'curta', lob: 'lob', smash: 'smash', saque: 'saque', leitura: 'noção', voleio: 'voleio' };
const rkSummary = key => { const b = (RACKET_STATS[key] || {}).b || {}; const l = Object.entries(b).filter(([, v]) => v).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]) || y[1] - x[1]); return l.length ? l.map(([k, v]) => (v > 0 ? '+' : '−') + Math.abs(v) + ' ' + (RK_ABBR[k] || k)).join(', ') : 'sem bônus'; };
// atributos com bônus somados (limitados entre 30 e 99)
function effA(a, ...bonuses) {
  const out = {}; for (const [k] of ATTRS) { let v = attrOf(a, k); bonuses.forEach(b => { if (b && b[k]) v += b[k]; }); out[k] = clamp(Math.round(v), 30, 99); }
  return out;
}
const ROSTER = [
  { id: 'spot', name: 'Mattia Spotto', alt: 178, pais: 'ITA', estilo: 'Reflexos na rede', build: 'atletico', a: { forca: 94, vel: 98, def: 96, backhand: 92, curta: 92, lob: 92, smash: 93, saque: 90 }, look: { lens: '#1d4fd8', glassStyle: 'sport', headband: '', visor: '', beard: 'barba', hairStyle: 'curto', skin: '#e2b48f', hair: '#1b120c', cap: '#17324d', glasses: true, band: true, num: '1', racket: 'proteo' } },
  { id: 'gianote', name: 'Nicolas Gianotty', alt: 186, pais: 'FRA', estilo: 'Voleio agressivo e definição', build: 'esguio', a: { forca: 93, vel: 89, def: 93, backhand: 93, curta: 93, lob: 93, smash: 98, saque: 97 }, look: { glassStyle: 'sport', headband: '', visor: '', beard: '', hairStyle: 'coque', skin: '#efc6a3', hair: '#3a2615', cap: '', glasses: true, num: '5', racket: 'zenite' } },
  { id: 'barao', name: 'André Baram', alt: 193, pais: 'BRA', estilo: 'Canhoto, saque fortíssimo e jogo aéreo', build: 'atletico', canhoto: true, a: { forca: 94, vel: 88, def: 88, backhand: 88, curta: 88, lob: 88, smash: 95, saque: 97 }, look: { headband: '', visor: '', cap: '#fbf6ea', beard: '', hairStyle: 'curto', skin: '#efc6a3', hair: '#3a2615', glasses: false, band: true, num: '6', racket: 'proteo' } },
  { id: 'mola', name: 'Daniel Molla', alt: 183, pais: 'BRA', estilo: 'Explosão e smash acrobático', build: 'forte', a: { forca: 95, vel: 94, def: 87, backhand: 87, curta: 87, lob: 87, smash: 96, saque: 87 }, look: { hairStyle: 'curto', skin: '#efc6a3', hair: '#2b1d14', visor: '#fbf6ea', glasses: true, band: true, num: '50', racket: 'proteo' } },
  { id: 'gigio', jogo: 'paredao', name: 'Gigio Carianni', alt: 183, pais: 'BRA', estilo: 'Defesa sólida e tática', build: 'compacto', a: { forca: 86, vel: 86, def: 96, backhand: 93, curta: 86, lob: 92, smash: 86, saque: 86 }, look: { hairStyle: 'curto', skin: '#d2a07a', hair: '#2a1a0e', visor: '#17324d', glasses: true, band: true, num: '21', racket: 'medusa' } },
  { id: 'capeletti', name: 'Michele Capeletti', alt: 188, pais: 'ITA', estilo: 'Presença na rede e ataque por cima', build: 'atletico', a: { forca: 92, vel: 86, def: 93, backhand: 86, curta: 86, lob: 86, smash: 95, saque: 86 }, look: { lens: '#1d4fd8', glassStyle: 'sport', headband: '#ff5a1f', visor: '', beard: 'barba', hairStyle: 'cacheado', skin: '#efc6a3', hair: '#2b1d14', cap: '', glasses: true, num: '3', racket: 'medusa' } },
  { id: 'lock', name: 'Filipe Lock', alt: 195, pais: 'BRA', estilo: 'Saque angulado e estatura', build: 'esguio', a: { forca: 86, vel: 86, def: 86, backhand: 86, curta: 86, lob: 86, smash: 91, saque: 96 }, look: { headband: '', visor: '', beard: '', hairStyle: 'curto', skin: '#efc6a3', hair: '#a8743a', cap: '#fbf6ea', glasses: false, num: '22', racket: 'kronos' } },
  { id: 'ramires', name: 'Antomi Ramoz', alt: 180, pais: 'ESP', estilo: 'Voleios com efeito e criatividade', build: 'atletico', a: { forca: 85, vel: 85, def: 85, backhand: 92, curta: 93, lob: 90, smash: 85, saque: 85 }, look: { lens: '#c0392b', glassStyle: 'sport', headband: '', visor: '', beard: 'barba', hairStyle: 'cacheado', skin: '#d8a47e', hair: '#1b120c', cap: '#fbf6ea', glasses: true, num: '8', racket: 'supercarbon' } },
  { id: 'burmak', name: 'Nikita Burmakyn', alt: 196, pais: 'RUS', estilo: 'Bloqueio na rede e alcance aéreo', build: 'esguio', a: { forca: 90, vel: 82, def: 92, backhand: 82, curta: 82, lob: 82, smash: 92, saque: 82 }, look: { skin: '#efc6a3', hair: '#7a5a3a', visor: '#17324d', glasses: true, band: true, num: '2', racket: 'kronos' } },
  { id: 'grusso', name: 'Gustavo Russu', alt: 185, pais: 'BRA', estilo: 'Drive de direita violento', build: 'esguio', a: { forca: 93, vel: 83, def: 83, backhand: 83, curta: 83, lob: 83, smash: 88, saque: 83 }, look: { headband: '', visor: '', beard: '', hairStyle: 'curto', skin: '#e2b48f', hair: '#120c08', cap: '', glasses: false, band: true, num: '51', racket: 'medusa' } },
  { id: 'beccaccioli', name: 'Doriano Becaccioli', alt: 182, pais: 'ITA', estilo: 'Geometria e lob no fundo', build: 'atletico', a: { forca: 83, vel: 83, def: 83, backhand: 83, curta: 88, lob: 93, smash: 83, saque: 83 }, look: { skin: '#a8704a', hair: '#a8743a', cap: '#fbf6ea', glasses: true, band: true, num: '52', racket: 'kronos' } },
  { id: 'carlo', name: 'Luca Carlli', alt: 187, pais: 'ITA', estilo: 'Smash e saque', build: 'atletico', a: { forca: 83, vel: 83, def: 83, backhand: 83, curta: 83, lob: 83, smash: 89, saque: 88 }, look: { skin: '#e2b48f', hair: '#3a2615', glasses: true, band: true, num: '4', racket: 'supercarbon' } },
  { id: 'giovannini', name: 'Tommaso Giovanini', alt: 185, pais: 'ITA', estilo: 'Defende bolas impossíveis', build: 'esguio', a: { forca: 81, vel: 89, def: 91, backhand: 81, curta: 81, lob: 81, smash: 81, saque: 81 }, look: { headband: '', cap: '#1b1b1b', beard: 'barba', hairStyle: 'curto', skin: '#efc6a3', hair: '#120c08', visor: '', glasses: false, band: true, num: '53', racket: 'supercarbon' } },
  { id: 'allan', jogo: 'agressivo', name: 'Allan Oliveyra', alt: 176, pais: 'BRA', estilo: 'Impulsão e velocidade', build: 'atletico', canhoto: true, a: { forca: 81, vel: 92, def: 81, backhand: 81, curta: 81, lob: 81, smash: 88, saque: 81 }, look: { lens: '#1d4fd8', glassStyle: 'sport', headband: '', visor: '', beard: '', hairStyle: 'curto', skin: '#e2b48f', hair: '#2b1d14', cap: '', glasses: true, band: true, num: '54', racket: 'proteo' } },
  { id: 'santana', name: 'Thales Santus', alt: 182, pais: 'BRA', estilo: 'Defesa sólida', build: 'atletico', a: { forca: 82, vel: 87, def: 88, backhand: 82, curta: 82, lob: 82, smash: 82, saque: 82 }, look: { skin: '#8d5a3b', hair: '#120c08', visor: '#fbf6ea', glasses: false, num: '7', racket: 'medusa' } },
  { id: 'gramos', name: 'Gabriel Ramo', alt: 182, pais: 'ESP', estilo: 'Tático e consistente nos ralis', build: 'esguio', a: { forca: 81, vel: 81, def: 87, backhand: 89, curta: 81, lob: 86, smash: 81, saque: 81 }, look: { skin: '#8d5a3b', hair: '#6a3f1d', cap: '#fbf6ea', glasses: false, band: true, num: '55', racket: 'medusa' } },
  { id: 'guegano', name: 'Mathieu Guegany', alt: 180, pais: 'FRA', estilo: 'Toque refinado', build: 'atletico', a: { forca: 81, vel: 81, def: 81, backhand: 81, curta: 90, lob: 88, smash: 81, saque: 81 }, look: { lens: '#1d4fd8', glassStyle: 'sport', headband: '', cap: '#17324d', beard: 'barba', hairStyle: 'curto', skin: '#efc6a3', hair: '#3a2615', visor: '', glasses: true, band: true, num: '56', racket: 'kronos' } },
  { id: 'bollettinari', name: 'Diego Boletinari', alt: 180, pais: 'ITA', estilo: 'Voleio rápido e saque agressivo', build: 'compacto', a: { forca: 80, vel: 87, def: 80, backhand: 80, curta: 80, lob: 80, smash: 80, saque: 87 }, look: { skin: '#b07a52', hair: '#1b120c', cap: '#17324d', glasses: false, band: true, num: '57', racket: 'supercarbon' } },
  { id: 'branco', name: 'Leonardo Brancco', alt: 183, pais: 'BRA', estilo: 'Antecipação e contra-ataque', build: 'atletico', a: { forca: 80, vel: 80, def: 87, backhand: 87, curta: 80, lob: 80, smash: 80, saque: 80 }, look: { headband: '', visor: '', beard: 'barba', hairStyle: 'curto', skin: '#e2b48f', hair: '#2b1d14', cap: '', glasses: false, band: true, num: '58', racket: 'proteo' } },
  { id: 'rodrigo', name: 'Gerard Rodrigues', alt: 184, pais: 'ESP', estilo: 'Consistente', build: 'atletico', a: { forca: 82, vel: 82, def: 82, backhand: 80, curta: 82, lob: 82, smash: 82, saque: 82 }, look: { skin: '#d2a07a', hair: '#3a2615', glasses: false, band: true, num: '9', racket: 'kronos' } },
  { id: 'niklass', name: 'Maksim Niklas', alt: 187, pais: 'LAT', estilo: 'Alcance na rede e voleio curto', build: 'esguio', a: { forca: 79, vel: 79, def: 85, backhand: 79, curta: 87, lob: 79, smash: 79, saque: 79 }, look: { skin: '#d2a07a', hair: '#5a3a1e', visor: '#fbf6ea', glasses: false, band: true, num: '59', racket: 'medusa' } },
  { id: 'galeazzi', name: 'Federico Galeazi', alt: 181, pais: 'ITA', estilo: 'Solidez no fundo', build: 'forte', a: { forca: 79, vel: 79, def: 86, backhand: 86, curta: 79, lob: 79, smash: 79, saque: 79 }, look: { skin: '#a8704a', hair: '#a8743a', cap: '#17324d', glasses: true, band: true, num: '60', racket: 'kronos' } },
  { id: 'fonte', name: 'Vinícius Fonte', alt: 178, pais: 'BRA', estilo: 'Velocidade', build: 'atletico', a: { forca: 80, vel: 88, def: 80, backhand: 78, curta: 80, lob: 80, smash: 80, saque: 80 }, look: { skin: '#a8704a', hair: '#1b120c', cap: '#ff5a1f', glasses: true, num: '10', racket: 'proteo' } },
  { id: 'hrusso', name: 'Hugo Paronetto Russu', alt: 184, pais: 'BRA', estilo: 'Agressivo, define rápido', build: 'esguio', a: { forca: 85, vel: 78, def: 78, backhand: 78, curta: 78, lob: 78, smash: 86, saque: 78 }, look: { headband: '', visor: '', beard: 'barba', hairStyle: 'topete', skin: '#e2b48f', hair: '#120c08', cap: '', glasses: false, band: true, num: '61', racket: 'supercarbon' } },
  { id: 'toledo', name: 'Bruno Toledo', alt: 179, pais: 'BRA', estilo: 'Promessa', build: 'atletico', a: { forca: 70, vel: 74, def: 62, backhand: 60, curta: 60, lob: 64, smash: 66, saque: 64 }, look: { skin: '#b07a52', hair: '#2a1a0e', num: '18', racket: 'proteo' } },
  { id: 'irigarai', name: 'Theo Irigarai', alt: 183, pais: 'FRA', estilo: 'Smash potente e jogo de rede', build: 'atletico', a: { forca: 88, vel: 84, def: 82, backhand: 80, curta: 80, lob: 80, smash: 89, saque: 84 }, look: { skin: '#e2b48f', hair: '#3a2614', cap: '#17324d', glasses: true, num: '71', racket: 'tufao' } },
  { id: 'garavine', jogo: 'tatico', name: 'Marco Garavine', alt: 185, pais: 'ITA', estilo: 'Experiência e leitura de jogo', build: 'compacto', a: { forca: 80, vel: 78, def: 88, backhand: 86, curta: 87, lob: 86, smash: 80, saque: 80 }, look: { skin: '#d8a47e', hair: '#2b1d14', visor: '#fbf6ea', glasses: true, num: '72', racket: 'medusa' } },
  { id: 'calbuci', name: 'Alessandro Calbuci', alt: 188, pais: 'ITA', estilo: 'Saque pesado e ataque por cima', build: 'forte', a: { forca: 86, vel: 79, def: 80, backhand: 78, curta: 78, lob: 79, smash: 87, saque: 88 }, look: { skin: '#efc6a3', hair: '#1b120c', cap: '#fbf6ea', glasses: false, band: true, num: '73', racket: 'kronos' } },
  { id: 'mingoze', jogo: 'paredao', name: 'Alex Mingozi', alt: 181, pais: 'ITA', estilo: 'Defesa incansável', build: 'esguio', a: { forca: 78, vel: 84, def: 87, backhand: 84, curta: 80, lob: 84, smash: 78, saque: 78 }, look: { skin: '#d2a07a', hair: '#5a3a1e', cap: '#0b7a83', glasses: true, num: '74', racket: 'atol' } },
  { id: 'bonete', name: 'Ricardo Bonete', alt: 184, pais: 'ITA', estilo: 'Completo e regular', build: 'atletico', a: { forca: 81, vel: 80, def: 82, backhand: 81, curta: 81, lob: 81, smash: 82, saque: 81 }, look: { skin: '#e2b48f', hair: '#2a1a0e', visor: '#17324d', glasses: true, num: '75', racket: 'recife' } },
  { id: 'facani', jogo: 'rede', name: 'Marco Facani', alt: 186, pais: 'ITA', estilo: 'Reflexos e voleio', build: 'esguio', a: { forca: 79, vel: 83, def: 81, backhand: 79, curta: 82, lob: 77, smash: 82, saque: 79 }, look: { skin: '#c99068', hair: '#120c08', cap: '#fbf6ea', glasses: false, num: '76', racket: 'proteo' } },
  // mais do top 20 mundial (2026)
  { id: 'gine', jogo: 'agressivo', name: 'Gabriele Ginni', alt: 182, pais: 'ITA', estilo: 'Intenso, pressiona a dupla adversária', build: 'atletico', a: { forca: 86, vel: 87, def: 82, backhand: 82, curta: 82, lob: 82, smash: 87, saque: 84 }, look: { headband: '', visor: '', beard: '', skin: '#e2b48f', hair: '#2b1d14', hairStyle: 'longo', cap: '#17324d', glasses: false, num: '80', racket: 'kronos' } },
  { id: 'ngaspari', jogo: 'agressivo', name: 'Niccolò Gaspari', alt: 183, pais: 'ITA', estilo: 'Acelera as trocas e define na rede', build: 'atletico', a: { forca: 86, vel: 85, def: 82, backhand: 82, curta: 82, lob: 81, smash: 87, saque: 84 }, look: { lens: '#0b0d10', glassStyle: 'sport', headband: '', cap: '#1b1b1b', beard: '', skin: '#e2b48f', hair: '#1b120c', hairStyle: 'curto', visor: '', glasses: true, num: '81', racket: 'supercarbon' } },
  { id: 'neiss', jogo: 'tatico', name: 'Fabricio Neiss', alt: 183, pais: 'BRA', estilo: 'Experiência, posicionamento e escolha de golpes', build: 'atletico', a: { forca: 82, vel: 81, def: 86, backhand: 85, curta: 86, lob: 85, smash: 82, saque: 82 }, look: { headband: '', visor: '', beard: 'barba', skin: '#f1cfae', hair: '#5a3a1e', hairStyle: 'curto', cap: '', glasses: true, num: '82', racket: 'medusa' } },
  { id: 'testa', name: 'Renzo Testa Lutzemberger', alt: 183, pais: 'BRA', estilo: 'Agilidade e reflexos', build: 'atletico', a: { forca: 82, vel: 86, def: 83, backhand: 82, curta: 82, lob: 82, smash: 83, saque: 82 }, look: { skin: '#efc6a3', hair: '#3a2615', hairStyle: 'curto', cap: '#fbf6ea', glasses: true, num: '83', racket: 'proteo' } },
  { id: 'balerini', jogo: 'agressivo', name: 'Davi Balerini', alt: 179, pais: 'BRA', estilo: 'Acelerações e ataque junto à rede', build: 'esguio', a: { forca: 83, vel: 86, def: 80, backhand: 80, curta: 80, lob: 80, smash: 84, saque: 81 }, look: { skin: '#d2a07a', hair: '#1b120c', hairStyle: 'curto', visor: '#fbf6ea', glasses: true, num: '84', racket: 'tufao' } },
  { id: 'neive', jogo: 'agressivo', name: 'Leonardo Neiva Mariane', alt: 180, pais: 'BRA', estilo: 'Jovem, muita mobilidade e jogo ofensivo', build: 'esguio', a: { forca: 81, vel: 87, def: 80, backhand: 79, curta: 80, lob: 79, smash: 83, saque: 80 }, look: { skin: '#e2b48f', hair: '#2b1d14', hairStyle: 'curto', cap: '#17324d', glasses: true, num: '85', racket: 'proteo' } },
  { id: 'barro', name: 'Henrique Barros Medeiro', alt: 180, pais: 'BRA', estilo: 'Agilidade e reflexos', build: 'atletico', a: { forca: 80, vel: 85, def: 82, backhand: 80, curta: 80, lob: 80, smash: 81, saque: 80 }, look: { skin: '#d2a07a', hair: '#1b120c', hairStyle: 'curto', cap: '#fbf6ea', glasses: false, num: '86', racket: 'supercarbon' } },
  { id: 'amorin', jogo: 'tatico', name: 'Victor Amorin Gonzaga', alt: 190, pais: 'BRA', estilo: 'Posicionamento e consistência', build: 'forte', a: { forca: 80, vel: 80, def: 84, backhand: 83, curta: 83, lob: 83, smash: 80, saque: 80 }, look: { headband: '', cap: '#1b1b1b', beard: 'barba', skin: '#efc6a3', hair: '#a8743a', hairStyle: 'curto', visor: '', glasses: false, num: '87', racket: 'kronos' } },
  { id: 'reck', name: 'Marcelo Rek', alt: 180, pais: 'BRA', estilo: 'Experiência e saque firme', build: 'atletico', a: { forca: 81, vel: 79, def: 82, backhand: 80, curta: 80, lob: 80, smash: 82, saque: 83 }, look: { headband: '', visor: '', beard: '', skin: '#e2b48f', hair: '#120c08', hairStyle: 'curto', cap: '#fbf6ea', glasses: false, num: '88', racket: 'kronos' } },
  { id: 'ponti', name: 'Edoardo Ponte', alt: 184, pais: 'ITA', estilo: 'Jovem e incansável', build: 'atletico', a: { forca: 80, vel: 83, def: 81, backhand: 79, curta: 80, lob: 79, smash: 81, saque: 80 }, look: { skin: '#e2b48f', hair: '#3a2615', hairStyle: 'curto', glasses: true, num: '89', racket: 'proteo' } },
  { id: 'jublin', name: 'Dario Jublim', alt: 183, pais: 'ITA', estilo: 'Pressão na rede', build: 'atletico', a: { forca: 81, vel: 81, def: 79, backhand: 79, curta: 80, lob: 79, smash: 82, saque: 80 }, look: { skin: '#e2b48f', hair: '#1b120c', hairStyle: 'curto', cap: '#17324d', glasses: true, num: '90', racket: 'medusa' } },
  { id: 'buemo', name: 'Mateus Busnardo Buemmo', alt: 182, pais: 'BRA', estilo: 'Velocidade e contra-ataque', build: 'atletico', a: { forca: 79, vel: 83, def: 81, backhand: 79, curta: 79, lob: 79, smash: 80, saque: 79 }, look: { skin: '#efc6a3', hair: '#3a2615', hairStyle: 'curto', cap: '#fbf6ea', glasses: true, num: '91', racket: 'supercarbon' } },
  { id: 'psilva', name: 'Pedro Luca Sylva', alt: 181, pais: 'BRA', estilo: 'Consistente no fundo', build: 'atletico', a: { forca: 78, vel: 80, def: 81, backhand: 80, curta: 79, lob: 80, smash: 78, saque: 78 }, look: { skin: '#c68a5e', hair: '#120c08', hairStyle: 'curto', visor: '#fbf6ea', glasses: true, num: '92', racket: 'kronos' } },
  { id: 'boscolo', name: 'Filippo Boscolo Menegolo', alt: 185, pais: 'ITA', estilo: 'Campeão europeu: saque e smash', build: 'forte', a: { forca: 81, vel: 78, def: 78, backhand: 77, curta: 77, lob: 77, smash: 82, saque: 82 }, look: { skin: '#e2b48f', hair: '#2b1d14', hairStyle: 'curto', cap: '#1b1b1b', glasses: true, num: '93', racket: 'tufao' } },
  { id: 'bazzi', name: 'Mattia Bazi', alt: 182, pais: 'ITA', estilo: 'Toque e variação', build: 'esguio', a: { forca: 77, vel: 79, def: 79, backhand: 79, curta: 81, lob: 80, smash: 77, saque: 77 }, look: { skin: '#e2b48f', hair: '#3a2615', hairStyle: 'curto', glasses: false, num: '94', racket: 'medusa' } },
  { id: 'kudina', jogo: 'agressivo', name: 'Elizaveta Kudinuova', alt: 173, pais: 'RUS', estilo: 'Ataque do fundo e defesa rápida', build: 'esguio', fem: true, a: { forca: 97, vel: 90, def: 97, backhand: 90, curta: 90, lob: 90, smash: 97, saque: 90 }, look: { lens: '#e8700a', glassStyle: 'sport', headband: '', cap: '', hairStyle: 'tranca', skin: '#f1cfae', hair: '#d8b878', visor: '', glasses: true, tank: true, num: '40', racket: 'medusa' } },
  { id: 'semena', jogo: 'lobista', name: 'Anastasiia Semenowa', alt: 170, pais: 'RUS', estilo: 'Lobs precisos e tática na rede', build: 'compacto', fem: true, a: { forca: 92, vel: 92, def: 92, backhand: 92, curta: 97, lob: 98, smash: 92, saque: 92 }, look: { lens: '#d94f8a', glassStyle: 'sport', headband: '#fbf6ea', visor: '', hairStyle: 'coque', skin: '#efc6a3', hair: '#5a3a1e', cap: '', glasses: true, tank: true, num: '41', racket: 'kronos' } },
  { id: 'marquezin', name: 'Vitória Marquezini', alt: 168, pais: 'BRA', estilo: 'Reflexos e agressividade', build: 'atletico', fem: true, a: { forca: 89, vel: 97, def: 96, backhand: 89, curta: 89, lob: 89, smash: 95, saque: 89 }, look: { headband: '', cap: '', hairStyle: 'rabo', skin: '#efc6a3', hair: '#3a2615', visor: '', glasses: false, tank: true, num: '42', racket: 'supercarbon' } },
  { id: 'chou', name: 'Sophia Chou', alt: 170, pais: 'BRA', estilo: 'Defesa sólida e contra-ataque angulado', build: 'compacto', fem: true, a: { forca: 88, vel: 88, def: 96, backhand: 96, curta: 94, lob: 88, smash: 88, saque: 88 }, look: { headband: '', cap: '', hairStyle: 'rabo', skin: '#efc6a3', hair: '#2b1d14', visor: '', glasses: true, tank: true, num: '43', racket: 'proteo' } },
  { id: 'gaspar', name: 'Giulia Gaspari', alt: 165, pais: 'ITA', estilo: 'Consistência e controle mental', build: 'atletico', fem: true, a: { forca: 88, vel: 88, def: 93, backhand: 94, curta: 88, lob: 93, smash: 88, saque: 88 }, look: { headband: '#fbf6ea', cap: '', hairStyle: 'rabo', skin: '#e2b48f', hair: '#1b120c', visor: '', glasses: false, tank: true, num: '11', racket: 'medusa' } },
  { id: 'valentim', name: 'Ninny Valentinni', alt: 166, pais: 'ITA', estilo: 'Defensora', build: 'atletico', fem: true, a: { forca: 88, vel: 94, def: 94, backhand: 88, curta: 88, lob: 88, smash: 88, saque: 88 }, look: { headband: '', cap: '', hairStyle: 'rabo', skin: '#efc6a3', hair: '#d8b878', visor: '', glasses: false, tank: true, num: '14', racket: 'proteo' } },
  { id: 'miler', name: 'Rafaella Miller', alt: 176, pais: 'BRA', estilo: 'Envergadura, saque dominante e jogo aéreo', build: 'esguio', fem: true, a: { forca: 86, vel: 86, def: 86, backhand: 86, curta: 86, lob: 86, smash: 93, saque: 95 }, look: { headband: '', cap: '', hairStyle: 'cacheado', skin: '#e2b48f', hair: '#5a3a1e', visor: '', glasses: true, tank: true, num: '13', racket: 'kronos' } },
  { id: 'casadi', name: 'Veronica Casadey', alt: 176, pais: 'ITA', estilo: 'Potente', build: 'atletico', fem: true, a: { forca: 92, vel: 85, def: 85, backhand: 83, curta: 85, lob: 85, smash: 92, saque: 92 }, look: { hairStyle: 'coque', skin: '#e2b48f', hair: '#5a3a1e', visor: '#fbf6ea', glasses: true, tank: true, num: '46', racket: 'supercarbon' } },
  { id: 'grael', name: 'Ariadna Costa Grael', alt: 168, pais: 'ESP', estilo: 'Regularidade e variação de efeitos', build: 'atletico', fem: true, a: { forca: 86, vel: 86, def: 86, backhand: 93, curta: 92, lob: 92, smash: 86, saque: 86 }, look: { headband: '', visor: '', hairStyle: 'longo', skin: '#efc6a3', hair: '#a8743a', cap: '', glasses: true, tank: true, num: '47', racket: 'proteo' } },
  { id: 'nobre', name: 'Nicole Nobille', alt: 163, pais: 'ITA', estilo: 'Agilidade na rede e transição defensiva', build: 'esguio', fem: true, a: { forca: 84, vel: 93, def: 91, backhand: 84, curta: 90, lob: 84, smash: 84, saque: 84 }, look: { headband: '', visor: '', hairStyle: 'tranca', skin: '#e2b48f', hair: '#a8743a', cap: '', glasses: true, tank: true, num: '12', racket: 'supercarbon' } },
  { id: 'dias', name: 'Patty Dias', alt: 162, pais: 'VEN', estilo: 'Jogo de rede', build: 'compacto', fem: true, a: { forca: 85, vel: 91, def: 85, backhand: 85, curta: 91, lob: 85, smash: 85, saque: 85 }, look: { headband: '', cap: '', hairStyle: 'longo', skin: '#d8a47e', hair: '#a8743a', visor: '', glasses: true, tank: true, num: '16', racket: 'supercarbon' } },
  { id: 'cimadi', name: 'Sofia Cimati', alt: 174, pais: 'ITA', estilo: 'Smash pesado e pressão no saque', build: 'forte', fem: true, a: { forca: 90, vel: 83, def: 83, backhand: 83, curta: 83, lob: 83, smash: 92, saque: 91 }, look: { headband: '', visor: '', hairStyle: 'coque', skin: '#e2b48f', hair: '#1b120c', cap: '', glasses: false, tank: true, num: '15', racket: 'medusa' } },
  { id: 'daino', name: 'Flaminia Dayna', alt: 168, pais: 'ITA', estilo: 'Toque, curtinhas e defesa inteligente', build: 'esguio', fem: true, a: { forca: 82, vel: 82, def: 89, backhand: 82, curta: 93, lob: 88, smash: 82, saque: 82 }, look: { hairStyle: 'coque', skin: '#efc6a3', hair: '#6a3f1d', cap: '#0b7a83', glasses: false, tank: true, num: '17', racket: 'kronos' } },
  { id: 'franceschini', name: 'Elena Francesconni', alt: 170, pais: 'ITA', estilo: 'Intensidade e golpes profundos', build: 'atletico', fem: true, a: { forca: 90, vel: 90, def: 83, backhand: 83, curta: 83, lob: 83, smash: 83, saque: 83 }, look: { headband: '', cap: '', hairStyle: 'longo', skin: '#efc6a3', hair: '#5a3a1e', visor: '', glasses: false, tank: true, num: '62', racket: 'proteo' } },
  { id: 'tripa', name: 'Giulia Tripa', alt: 169, pais: 'ITA', estilo: 'Toque e lob', build: 'atletico', fem: true, a: { forca: 83, vel: 83, def: 83, backhand: 84, curta: 88, lob: 88, smash: 83, saque: 83 }, look: { lens: '#e8700a', glassStyle: 'sport', headband: '', cap: '', hairStyle: 'rabo', skin: '#efc6a3', hair: '#a8743a', visor: '', glasses: true, tank: true, num: '52', racket: 'medusa' } },
  { id: 'vida', name: 'Marcela Vitta', alt: 171, pais: 'BRA', estilo: 'Saque forte', build: 'atletico', fem: true, a: { forca: 88, vel: 82, def: 82, backhand: 82, curta: 82, lob: 82, smash: 82, saque: 88 }, look: { lens: '#0b0d10', glassStyle: 'sport', headband: '', visor: '', hairStyle: 'coque', skin: '#c68a5e', hair: '#1b120c', cap: '', glasses: true, tank: true, num: '53', racket: 'kronos' } },
  { id: 'palos', name: 'Eva Fernandes Palos', alt: 171, pais: 'ESP', estilo: 'Cobertura de quadra e cruzadas', build: 'atletico', fem: true, a: { forca: 81, vel: 88, def: 88, backhand: 88, curta: 81, lob: 81, smash: 81, saque: 81 }, look: { headband: '', visor: '', hairStyle: 'curto', skin: '#efc6a3', hair: '#2b1d14', cap: '', glasses: true, tank: true, num: '63', racket: 'medusa' } },
  { id: 'podlubna', name: 'Verônica Podlubna', alt: 175, pais: 'RUS', estilo: 'Braços longos e voleio agressivo', build: 'esguio', fem: true, a: { forca: 81, vel: 81, def: 87, backhand: 81, curta: 81, lob: 81, smash: 88, saque: 81 }, look: { skin: '#d8a47e', hair: '#c99a5a', visor: '#ff5a1f', glasses: true, tank: true, num: '64', racket: 'kronos' } },
  { id: 'justi', name: 'Greta Giusty', alt: 170, pais: 'ITA', estilo: 'Defensora', build: 'esguio', fem: true, a: { forca: 81, vel: 87, def: 87, backhand: 81, curta: 81, lob: 81, smash: 81, saque: 81 }, look: { headband: '', cap: '', hairStyle: 'rabo', skin: '#efc6a3', hair: '#c99a5a', visor: '', glasses: false, tank: true, num: '54', racket: 'supercarbon' } },
  { id: 'magalhaes', name: 'Marta Magalhãs', alt: 168, pais: 'POR', estilo: 'Técnica clássica e contra-ataque', build: 'atletico', fem: true, a: { forca: 81, vel: 81, def: 81, backhand: 87, curta: 86, lob: 81, smash: 81, saque: 81 }, look: { lens: '#1d4fd8', glassStyle: 'sport', headband: '', cap: '', hairStyle: 'tranca', skin: '#c68a5e', hair: '#2b1d14', visor: '', glasses: true, tank: true, num: '65', racket: 'supercarbon' } },
  { id: 'cortes', name: 'Joana Cortês', alt: 165, pais: 'BRA', estilo: 'Experiência e precisão', build: 'atletico', fem: true, a: { forca: 80, vel: 80, def: 80, backhand: 86, curta: 87, lob: 86, smash: 80, saque: 80 }, look: { skin: '#efc6a3', hair: '#2b1d14', cap: '#17324d', glasses: true, tank: true, num: '66', racket: 'proteo' } },
  { id: 'nogueiro', name: 'Julia Nogueyra', alt: 172, pais: 'BRA', estilo: 'Força bruta e saque pesado', build: 'forte', fem: true, a: { forca: 88, vel: 79, def: 79, backhand: 79, curta: 79, lob: 79, smash: 79, saque: 87 }, look: { hairStyle: 'coque', skin: '#efc6a3', hair: '#2b1d14', cap: '#17324d', glasses: true, tank: true, num: '56', racket: 'medusa' } },
  { id: 'damata', name: 'Graziele da Matta', alt: 170, pais: 'BRA', estilo: 'Potência física e ataque veloz', build: 'forte', fem: true, a: { forca: 87, vel: 79, def: 79, backhand: 79, curta: 79, lob: 79, smash: 86, saque: 79 }, look: { hairStyle: 'rabo', skin: '#a8704a', hair: '#1b120c', visor: '#ff5a1f', glasses: false, tank: true, num: '57', racket: 'kronos' } },
  { id: 'pansani', name: 'Isadora Pansani Simois', alt: 166, pais: 'BRA', estilo: 'Ritmo elétrico e reflexos', build: 'compacto', fem: true, a: { forca: 79, vel: 87, def: 85, backhand: 79, curta: 79, lob: 79, smash: 79, saque: 79 }, look: { skin: '#d2a07a', hair: '#5a3a1e', visor: '#ff5a1f', glasses: false, tank: true, num: '67', racket: 'medusa' } },
  { id: 'abreu', name: 'Daniela Abreus', alt: 168, pais: 'BRA', estilo: 'Paciência, lob defensivo e poucos erros', build: 'atletico', fem: true, a: { forca: 78, vel: 78, def: 85, backhand: 84, curta: 78, lob: 87, smash: 78, saque: 78 }, look: { skin: '#a8704a', hair: '#a8743a', visor: '#fbf6ea', glasses: true, tank: true, num: '68', racket: 'kronos' } },
  { id: 'leite', name: 'Marceli Leite', alt: 167, pais: 'BRA', estilo: 'Defesas impossíveis em bola baixa', build: 'esguio', fem: true, a: { forca: 77, vel: 84, def: 87, backhand: 77, curta: 77, lob: 77, smash: 77, saque: 77 }, look: { skin: '#e2b48f', hair: '#120c08', cap: '#17324d', glasses: false, tank: true, num: '69', racket: 'supercarbon' } },
  { id: 'peracine', name: 'Mariana Peracine', alt: 166, pais: 'BRA', estilo: 'Jogo de rede', build: 'atletico', fem: true, a: { forca: 78, vel: 84, def: 78, backhand: 78, curta: 84, lob: 78, smash: 78, saque: 78 }, look: { hairStyle: 'rabo', skin: '#a8704a', hair: '#5a3a1e', visor: '#fbf6ea', glasses: true, tank: true, num: '58', racket: 'supercarbon' } },
  { id: 'pereira', name: 'Daniela Rodrigues Perera', alt: 165, pais: 'ESP', estilo: 'Defensora', build: 'esguio', fem: true, a: { forca: 78, vel: 84, def: 84, backhand: 78, curta: 78, lob: 78, smash: 78, saque: 78 }, look: { headband: '', visor: '', hairStyle: 'rabo', skin: '#e2b48f', hair: '#1b120c', cap: '', glasses: true, tank: true, num: '59', racket: 'proteo' } },
  { id: 'alves', name: 'Bia Alves', alt: 164, pais: 'BRA', estilo: 'Iniciante', build: 'atletico', fem: true, a: { forca: 58, vel: 66, def: 60, backhand: 58, curta: 58, lob: 62, smash: 56, saque: 58 }, look: { skin: '#8d5a3b', hair: '#120c08', visor: '#fbf6ea', tank: true, num: '20', racket: 'supercarbon' } },
  { id: 'churak', name: 'Daria Churakowa', alt: 174, pais: 'RUS', estilo: 'Potência do fundo', build: 'atletico', fem: true, a: { forca: 90, vel: 85, def: 86, backhand: 84, curta: 83, lob: 84, smash: 90, saque: 86 }, look: { headband: '', cap: '', hairStyle: 'curto', skin: '#f1cfae', hair: '#c99a5a', visor: '', glasses: false, tank: true, num: '77', racket: 'tufao' } },
  { id: 'glimak', jogo: 'tatico', name: 'Irina Glimakowa', alt: 171, pais: 'RUS', estilo: 'Toque e variação', build: 'esguio', fem: true, a: { forca: 82, vel: 86, def: 87, backhand: 86, curta: 89, lob: 87, smash: 82, saque: 82 }, look: { headband: '', visor: '', hairStyle: 'rabo', skin: '#f1cfae', hair: '#c99a5a', cap: '', glasses: false, tank: true, num: '78', racket: 'ventosul' } },
  { id: 'nikoian', name: 'Liudmila Nikoian', alt: 172, pais: 'RUS', estilo: 'Regularidade e defesa', build: 'compacto', fem: true, a: { forca: 81, vel: 83, def: 87, backhand: 84, curta: 82, lob: 84, smash: 81, saque: 81 }, look: { skin: '#e2b48f', hair: '#3a2614', visor: '#0b7a83', glasses: false, tank: true, num: '79', racket: 'medusa' } },
  { id: 'lmelo', name: 'Lorena Mello', alt: 167, pais: 'BRA', estilo: 'Reflexos e agilidade', build: 'atletico', fem: true, a: { forca: 79, vel: 84, def: 82, backhand: 79, curta: 80, lob: 79, smash: 79, saque: 79 }, look: { skin: '#d8a47e', hair: '#1b120c', hairStyle: 'rabo', visor: '#fbf6ea', glasses: true, tank: true, num: '70', racket: 'supercarbon' } },
  { id: 'bray', name: 'Maire Brai', alt: 168, pais: 'FRA', estilo: 'Ataque do fundo', build: 'atletico', fem: true, a: { forca: 81, vel: 80, def: 78, backhand: 78, curta: 78, lob: 78, smash: 81, saque: 80 }, look: { lens: '#1d4fd8', glassStyle: 'sport', headband: '', visor: '', cap: '', skin: '#e2b48f', hair: '#5a3a1e', hairStyle: 'coque', glasses: true, tank: true, num: '71', racket: 'kronos' } },
  { id: 'preisner', name: 'Ana Carolina Costa Preisnner', alt: 168, pais: 'BRA', estilo: 'Muito jogo nas pernas', build: 'atletico', fem: true, a: { forca: 77, vel: 82, def: 80, backhand: 78, curta: 78, lob: 78, smash: 77, saque: 77 }, look: { skin: '#efc6a3', hair: '#5a3a1e', hairStyle: 'rabo', cap: '#17324d', glasses: true, tank: true, num: '72', racket: 'proteo' } },
  { id: 'druteik', name: 'Gabija Druteikaitte', alt: 176, pais: 'LTU', estilo: 'Alcance e saque', build: 'esguio', fem: true, a: { forca: 80, vel: 76, def: 77, backhand: 76, curta: 76, lob: 76, smash: 80, saque: 81 }, look: { skin: '#efc6a3', hair: '#d8b878', hairStyle: 'rabo', glasses: true, tank: true, num: '73', racket: 'medusa' } },
  { id: 'massai', name: 'Matilde Masai', alt: 168, pais: 'ITA', estilo: 'Jovem e técnica', build: 'atletico', fem: true, a: { forca: 76, vel: 79, def: 78, backhand: 78, curta: 79, lob: 79, smash: 76, saque: 76 }, look: { lens: '#1d4fd8', glassStyle: 'sport', headband: '', visor: '', cap: '', skin: '#f1cfae', hair: '#2b1d14', hairStyle: 'rabo', glasses: true, tank: true, num: '74', racket: 'supercarbon' } },
  { id: 'iotte', name: 'Raquel Iote', alt: 166, pais: 'BRA', estilo: 'Experiência e precisão', build: 'atletico', fem: true, a: { forca: 75, vel: 76, def: 79, backhand: 79, curta: 80, lob: 79, smash: 75, saque: 76 }, look: { skin: '#d8a47e', hair: '#2b1d14', hairStyle: 'coque', visor: '#17324d', glasses: true, tank: true, num: '75', racket: 'kronos' } },
  { id: 'seron', name: 'Maria Martines Seron', alt: 178, pais: 'ESP', estilo: 'Consistência', build: 'esguio', fem: true, a: { forca: 75, vel: 78, def: 78, backhand: 77, curta: 77, lob: 77, smash: 75, saque: 75 }, look: { lens: '#e8700a', glassStyle: 'sport', headband: '', visor: '', cap: '', skin: '#e2b48f', hair: '#2b1d14', hairStyle: 'tranca', glasses: true, tank: true, num: '76', racket: 'proteo' } },
];
// patrocínios reais (marcas com uma letra trocada): uniforme e raquete da marca de cada atleta
const SPONSOR_KITS = {
  nux: { logo: 'NUX', c1: '#111214', c2: '#d8ff3a', bc: '#111214', pat: 'lateral' },
  herues: { logo: "HERUE'S", c1: '#0e0e10', c2: '#ff5a1f', bc: '#0e0e10', pat: 'diagonal' },
  altojiro: { logo: 'ALTO JIRO', c1: '#0b3d5c', c2: '#f2c230', bc: '#0b3d5c', pat: 'faixas' },
  zanb: { logo: 'ZANB', c1: '#f6f4f0', c2: '#b0895a', bc: '#1b1b1d', pat: 'chevron' },
  anasport: { logo: 'ANA SPORT', c1: '#f4f5f6', c2: '#141414', bc: '#141414', pat: 'lateral' },
  lacosta: { logo: 'LACOSTA', c1: '#fbf6ea', c2: '#0f6b3a', bc: '#fbf6ea', pat: 'liso' },
  mormaji: { logo: 'MORMAJI', c1: '#7a1fa2', c2: '#e2364a', bc: '#1b1b1d', pat: 'degrade' },
};
// id: [marca da roupa, raquete (vazio = mantém), modelo de cima]
const SPONSORED = {
  gianote: ['nux', 'zenite', 'teeDry'], spot: ['herues', 'aurora', 'tankDry'], capeletti: ['herues', 'eclipse', 'teeDry'], barao: ['altojiro', 'kronos', 'teeDry'],
  mola: ['zanb', 'zjump', 'tankDry'], ramires: ['zanb', 'ventosul', 'teeDry'], gigio: ['anasport', 'supercarbon', 'teeDry'], bazzi: ['anasport', 'medusa', 'teeDry'],
  gaspar: ['herues', 'proteo', 'tank'], valentim: ['herues', 'proteo', 'tank'], casadi: ['nux', 'atol', 'tank'], kudina: ['nux', 'recife', 'tank'], semena: ['nux', 'recife', 'tank'],
  marquezin: ['mormaji', 'mare', 'tank'], chou: ['lacosta', '', 'tank'],
};
ROSTER.forEach(c => { const sp = SPONSORED[c.id]; if (!sp) return; const K = SPONSOR_KITS[sp[0]];
  c.look.outfit = { top: sp[2], pat: K.pat, c1: K.c1, c2: K.c2, bot: c.fem ? 'shortinho' : 'shortDry', bc: K.bc, logo: K.logo };
  if (sp[1]) c.look.racket = sp[1]; });
// mais jogadores para a partida rápida, do nível amador ao circuito (overall ~52 a 80); fictícios
{
  const SK = ['#f1cfae', '#e2b48f', '#d2a07a', '#c68a5e', '#a8704a', '#8d5a3b', '#6b4229'], HR = ['#120c08', '#2b1d14', '#3a2615', '#5a3a1e', '#6a3f1d', '#a8743a', '#c99a5a'];
  const ST = { ataque: { forca: 5, smash: 6, saque: 4, def: -4, curta: -4, lob: -3, backhand: -2 }, defesa: { def: 6, vel: 5, backhand: 3, smash: -4, forca: -4, saque: -3 }, toque: { curta: 6, lob: 6, backhand: 3, forca: -5, smash: -4, saque: -2, vel: -1 }, completo: {} };
  const EST = { ataque: 'Atacante: smash e saque fortes', defesa: 'Defensor: alcança tudo no fundo', toque: 'Tático: curtas e lobs', completo: 'Completo, sem pontos fracos' };
  const JOGO = { ataque: 'agressivo', defesa: 'paredao', toque: 'tatico', completo: 'completo' };
  const Q = [ // nome, país, mulher, overall, estilo, canhoto
    ['Rafael Teixeira', 'BRA', 0, 80, 'ataque', 0], ['Giulia Marchetti', 'ITA', 1, 80, 'completo', 0], ['Bruno Salgado', 'BRA', 0, 78, 'defesa', 1], ['Larissa Fontes', 'BRA', 1, 78, 'toque', 0],
    ['Pablo Herrera', 'ESP', 0, 76, 'completo', 0], ['Chloé Martin', 'FRA', 1, 76, 'ataque', 1], ['Thiago Moura', 'BRA', 0, 75, 'toque', 0], ['Inês Carvalho', 'POR', 1, 75, 'defesa', 0],
    ['Matteo Ferri', 'ITA', 0, 74, 'ataque', 0], ['Camila Duarte', 'BRA', 1, 73, 'completo', 0], ['Diego Paredes', 'ARG', 0, 72, 'defesa', 0], ['Valentina Rossi', 'ITA', 1, 72, 'toque', 1],
    ['Lucas Bittencourt', 'BRA', 0, 71, 'completo', 1], ['Manon Girard', 'FRA', 1, 70, 'ataque', 0], ['Hugo Navas', 'ESP', 0, 69, 'toque', 0], ['Beatriz Lacerda', 'BRA', 1, 69, 'defesa', 0],
    ['Enzo Batista', 'BRA', 0, 68, 'ataque', 0], ['Martina Gallo', 'ITA', 1, 67, 'completo', 0], ['Tiago Neves', 'POR', 0, 66, 'defesa', 1], ['Luana Prado', 'BRA', 1, 66, 'ataque', 0],
    ['Felipe Rangel', 'BRA', 0, 65, 'completo', 0], ['Sofía Medina', 'ARG', 1, 64, 'toque', 0], ['Antoine Roux', 'FRA', 0, 63, 'completo', 0], ['Natália Siqueira', 'BRA', 1, 63, 'completo', 1],
    ['Caio Almeida', 'BRA', 0, 62, 'toque', 0], ['Lucía Ortega', 'ESP', 1, 61, 'defesa', 0], ['Igor Vasconcelos', 'BRA', 0, 60, 'ataque', 1], ['Mariana Couto', 'BRA', 1, 60, 'completo', 0],
    ['Marco Bellini', 'ITA', 0, 58, 'defesa', 0], ['Bianca Moraes', 'BRA', 1, 58, 'toque', 0], ['Renan Pires', 'BRA', 0, 57, 'completo', 0], ['Alessia Conti', 'ITA', 1, 56, 'ataque', 0],
    ['Davi Monteiro', 'BRA', 0, 55, 'completo', 0], ['Paula Ribas', 'BRA', 1, 54, 'defesa', 1], ['Otávio Lins', 'BRA', 0, 53, 'toque', 0], ['Helena Farias', 'BRA', 1, 52, 'completo', 0],
  ];
  const W0 = { forca: .13, vel: .15, def: .15, backhand: .08, curta: .11, lob: .11, smash: .15, saque: .12 };
  Q.forEach(([name, pais, fem, ovr, st, lefty], i) => {
    const d = ST[st], a = {}; let h = 7; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const r = () => { h = (h * 1103515245 + 12345) >>> 0; return (h >>> 8) / 16777216; };
    for (const k in W0) a[k] = ovr + (d[k] || 0) + Math.round((r() - .5) * 4);
    const cur = Object.keys(W0).reduce((t, k) => t + a[k] * W0[k], 0); for (const k in W0) a[k] = Math.max(30, Math.min(99, Math.round(a[k] + ovr - cur)));
    a.leitura = Math.max(30, Math.min(99, ovr + Math.round((r() - .5) * 6)));
    const look = { skin: SK[Math.floor(r() * SK.length)], hair: HR[Math.floor(r() * HR.length)], glasses: r() < .4, band: r() < .5, num: String(10 + Math.floor(r() * 89)), racket: ovr >= 76 ? 'supercarbon' : ovr >= 70 ? 'tufao' : ovr >= 64 ? 'proteo' : ovr >= 58 ? 'mare' : 'fibra' };
    if (r() < .35) look.cap = '#fbf6ea'; else if (r() < .5) look.visor = '#17324d';
    ROSTER.push({ id: 'q' + i, jogo: JOGO[st], name, alt: fem ? 160 + Math.round(r() * 18) : 174 + Math.round(r() * 20), pais, estilo: EST[st], build: ['atletico', 'esguio', 'compacto', 'forte'][Math.floor(r() * 4)], fem: !!fem, canhoto: !!lefty || undefined, a, look, extra: true });
  });
}
// voleio de quem ainda não tem: voleadores (jogo de rede) +6, táticos +2, paredões −3
ROSTER.forEach(c => { if (c.a.voleio !== undefined) return; const e = (c.estilo || '').toLowerCase(), rede = c.jogo === 'rede' || /rede|voleio|bloqueio|reflexo/.test(e);
  c.a.voleio = Math.max(30, Math.min(99, voleioOf(c.a) + (rede ? 6 : c.jogo === 'tatico' ? 2 : c.jogo === 'paredao' ? -3 : 0))); });
const overall = a => Math.round(Object.keys(ATTR_W).reduce((t, k) => t + attrOf(a, k) * ATTR_W[k], 0));
// overall pelo ranking ITF (26/10/2026): a ordem do top 30 manda; quem saiu do top 30 fica no máximo em 78.
// Todos os atributos sobem/descem juntos (o estilo de cada um continua)
const RANK_OVR = {
  gianote: 95, spot: 95, barao: 93, capeletti: 92, mola: 91, lock: 91, gigio: 90, ramires: 89, gine: 89, ngaspari: 88, allan: 86, branco: 86, grusso: 85,
  barro: 84, neiss: 84, testa: 84, guegano: 83, balerini: 83, amorin: 82, reck: 82, ponti: 81, hrusso: 81, jublin: 81, galeazzi: 80, buemo: 80, burmak: 80,
  bollettinari: 79, psilva: 79, boscolo: 79, bazzi: 78,
  gaspar: 95, valentim: 95, kudina: 94, semena: 94, marquezin: 93, chou: 93, casadi: 90, grael: 90, dias: 89, miler: 89, cimadi: 87, daino: 86, tripa: 85,
  vida: 85, justi: 85, nobre: 84, nogueiro: 83, damata: 82, lmelo: 81, pansani: 81, peracine: 81, pereira: 80, magalhaes: 79, bray: 79, preisner: 78,
  druteik: 78, massai: 77, iotte: 77, franceschini: 77, seron: 76,
};
ROSTER.forEach(c => {
  if (c.extra) return;
  const t = RANK_OVR[c.id] ?? Math.min(78, overall(c.a));
  for (let it = 0; it < 6; it++) { const d = t - overall(c.a); if (!d) break; for (const k in c.a) c.a[k] = clamp(c.a[k] + d, 30, 99); }
});
let NAMES = {};
try { NAMES = JSON.parse(localStorage.getItem('pdo-names') || '{}') || {}; } catch (e) { NAMES = {}; }
$s.CAREER_CHARS = []; // jogador da carreira e personagens fictícios
// na carreira vale a versão da carreira (com fase e evolução); fora dela, a base
// online: personagens da carreira trazidos por quem está na sala
const charById = id => ($s.ONLINE_CHARS && $s.ONLINE_CHARS.find(c => c.id === id)) || ($s.CAREER_CHARS && $s.CAREER_CHARS.find(c => c.id === id)) || ROSTER.find(c => c.id === id) || ROSTER[0];
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
const attrK = (p, k) => attrN(p.char ? attrOf(p.char.a, k) : 70);
// fraqueza: 0 com o atributo em 72 ou mais, 1 em 40 — atributo fraco pesa bem mais que a escala linear
const weakK = (p, k) => clamp((72 - (p.char ? attrOf(p.char.a, k) : 70)) / 32, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
// multiplicador da velocidade em quadra pelo atributo: 0,84–1,05, com um empurrão nas notas baixas (para quem é lento ainda
// buscar uma curta boa): 50 → 0,99 · 65 → 1,01 · 80 → 1,02 · 95 → 1,05 (a diferença maior entre rápidos e lentos fica na
// arrancada, que vai de 12 a 18 m/s²)
const velMul = v => { const k = attrN(v); return lerp(.84, 1.05, k) + .14 * Math.pow(1 - Math.min(1, k), 1.2); };
// aceleração: a arrancada sai mais lenta e vai ganhando velocidade (explosão de 12 a 18 m/s² pelo atributo de velocidade);
// frear, parar e virar forte usam a frenagem (24 m/s²): parar continua rápido e trocar de direção custa uma passada
const ACC_STOP = 24;
const accOf = v => lerp(12, 18, Math.min(1, attrN(v)));
function accelStep(vx, vz, tvx, tvz, dt, acc) {
  const dvx = tvx - vx, dvz = tvz - vz, dv = Math.hypot(dvx, dvz); if (dv < 1e-6) return [tvx, tvz];
  const ts = Math.hypot(tvx, tvz), sp = Math.hypot(vx, vz), brake = ts < sp - .1 || tvx * vx + tvz * vz < .5 * ts * sp;
  const m = Math.min(dv, (brake ? ACC_STOP : acc) * dt); return [vx + dvx / dv * m, vz + dvz / dv * m];
}
// correr para trás (de costas para a rede, atrás de um lob) é mais lento: a parte do movimento que se afasta da rede vale 80%
// e a arrancada para trás é bem mais fraca (precisa virar o corpo): quem está colado na rede não busca um lob bom no fundo
const BACK_K = .8, BACK_ACC = .5;
const backZ = (team, vz) => (team === 0 ? vz > 0 : vz < 0) ? vz * BACK_K : vz;
const backAcc = (team, vz, acc) => (team === 0 ? vz > .3 : vz < -.3) ? acc * BACK_ACC : acc;
// distância "de corrida" até um ponto: o trecho para trás conta como mais longo
const runDist = (team, dx, dz) => Math.hypot(dx, (team === 0 ? dz > 0 : dz < 0) ? dz / BACK_K : dz);
// tempo para correr x metros saindo parado (acelerando até a velocidade máxima v)
const runTime = (x, v, a) => x <= 0 ? 0 : x < v * v / (2 * a) ? Math.sqrt(2 * x / a) : x / v + v / (2 * a);
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

export { GEAR_SLOTS, gearOn, GEAR_CAP, gearSum, ACCESS, FABRIC_NOME, TOP_KINDS, BOT_KINDS, PATTERNS, OUTFIT_COLORS, TOSS_G, voleioOf, attrN, velMul, accOf, accelStep, runTime, backZ, backAcc, runDist, BACK_ACC, weakK, lookExtras, ATTRS, ATTR_OF, C, DIFF, G, GEAR, HALF_W, HEIGHTS, KITS, NAMES, PLAY_STYLES, P_SPEED, RACKET_STATS, ROSTER, SERVES, SHORE_Z, SHOTS, STAFF, STEP, SWING_DUR, TOSS_T, V3, WATERLINE, ZONE3, attrK, bG, charById, clamp, effA, fbm, gauss, hScale, heightOf, lerp, nameOf, overall, racketBonus, rand, shortK, shortOf, smooth, styleOf , attrOf, leituraOf , rkSummary };