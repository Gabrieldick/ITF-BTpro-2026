// @ts-nocheck
// poses-chave dos golpes e variações
import './03-cenario';
import { C, clamp, lerp, attrK } from './00-base';
import { ball } from './07-glb';
import { S } from './01-estado';
// ---------- Poses ----------
// stag: pé de trás recuado (0 a 1) · feet: abertura das pernas (1 = normal, menos = pernas juntas)
const P = o => Object.assign({ rh: [.2, .42, -.42], rp: [.9, -.6, .3], wx: 1.15, wr: 1.2, lh: [-.03, .34, -.37], lp: [-.9, -.6, .2], tw: 0, lean: .22, bend: 0, crouch: .12, lunge: 0, stag: 0, feet: 1 }, o);
function newPose() { return P({}); }
const READY = P({});
// quadros-chave em u = 0, .3 (armado), .45 (contato), .75 (terminação), 1
const KU = [0, .3, .45, .75, 1];
const SMASH_U = [0, .3, .37, .45, .72, 1]; // o smash tem uma fase extra: a raquete cai atrás das costas
const SERVE_HIT_U = [0, .16, .33, .45, .72, 1]; // saque: mais tempo para a raquete cair atrás das costas (contato no mesmo .45)
const uOf = t => t === 'smash_saque' ? SERVE_HIT_U : t.startsWith('smash') ? SMASH_U : KU;
const ACT = {
  smash: [READY,
    P({ rh: [.32, .68, .18], rp: [.8, .9, .1], wx: -.5, lh: [-.05, 1.05, -.32], lp: [-.6, 0, .6], tw: -.85, lean: -.28, bend: -.12, crouch: .2 }),
    P({ rh: [.1, .5, .2], rp: [.3, 1.0, .1], wx: .1, lh: [-.12, .85, -.3], lp: [-.6, 0, .6], tw: -.7, lean: -.3, bend: -.1, crouch: .1 }),
    P({ rh: [.16, 1.02, -.28], rp: [.5, .3, .7], wx: .25, wr: .3, lh: [-.2, .4, -.15], lp: [-.8, -.3, .3], tw: .1, lean: -.02, bend: -.05, crouch: .04 }),
    P({ rh: [-.22, .05, -.28], rp: [.7, .2, -.3], wx: .5, wr: .9, lh: [-.25, .25, .05], lp: [-.8, -.5, 0], tw: .7, lean: .55, bend: .05, crouch: .25 }),
    READY],
  lob: [READY,
    P({ rh: [.42, .04, .14], rp: [.8, 0, .5], wx: .7, wr: .3, lh: [-.15, .3, -.3], lp: [-.9, -.4, 0], tw: -.55, lean: .4, crouch: .26 }),
    P({ rh: [.3, .2, -.46], rp: [.9, -.3, .2], wx: 1.0, wr: .3, lh: [-.2, .32, -.25], lp: [-.9, -.4, 0], tw: -.1, lean: .35, crouch: .24 }),
    P({ rh: [.14, .9, -.38], rp: [.8, -.2, .1], wx: .2, wr: .1, lh: [-.25, .4, -.1], lp: [-.9, -.4, 0], tw: .35, lean: .1, crouch: .1 }),
    READY],
  curta: [READY,
    P({ rh: [.3, .36, -.28], rp: [.9, -.5, .3], wx: 1.3, wr: .5, lh: [-.12, .32, -.3], lp: [-.9, -.5, 0], tw: -.25, lean: .35, crouch: .2, lunge: .3 }),
    P({ rh: [.26, .24, -.5], rp: [.9, -.6, .2], wx: 1.65, wr: .7, lh: [-.25, .3, -.15], lp: [-.9, -.5, 0], tw: -.05, lean: .48, crouch: .28, lunge: .65 }),
    P({ rh: [.22, .3, -.6], rp: [.9, -.6, .2], wx: 1.75, wr: .7, lh: [-.28, .32, -.1], lp: [-.9, -.5, 0], tw: .05, lean: .46, crouch: .26, lunge: .6 }),
    READY],
  defesa: [READY,
    P({ rh: [.3, .34, -.3], rp: [.8, -.7, .2], wx: 1.25, wr: .8, lh: [-.1, .32, -.3], lp: [-.9, -.5, 0], tw: -.2, lean: .38, bend: .12, crouch: .28, lunge: .7 }),
    P({ rh: [.34, .3, -.46], rp: [.8, -.7, .1], wx: 1.15, wr: .8, lh: [-.16, .32, -.24], lp: [-.9, -.5, 0], tw: -.05, lean: .42, bend: .15, crouch: .3, lunge: .75 }),
    P({ rh: [.32, .33, -.5], rp: [.8, -.7, .1], wx: 1.2, wr: .8, lh: [-.16, .32, -.24], lp: [-.9, -.5, 0], tw: .02, lean: .4, bend: .12, crouch: .28, lunge: .7 }),
    READY],
};
// variações: curta/defesa alta (raquete em pé, bloqueio) e baixa (raquete por baixo, cavando); smash curto, angulado, de costas e em salto
Object.assign(ACT, {
  curta_alta: [READY,
    P({ rh: [.3, .72, -.28], rp: [.9, -.2, .3], wx: .55, wr: .4, lh: [-.12, .5, -.3], lp: [-.9, -.3, .1], tw: -.2, lean: .18, crouch: .1, lunge: .25 }),
    P({ rh: [.24, .66, -.52], rp: [.9, -.3, .2], wx: .75, wr: .5, lh: [-.2, .45, -.2], lp: [-.9, -.3, .1], tw: 0, lean: .26, crouch: .14, lunge: .45 }),
    P({ rh: [.2, .55, -.6], rp: [.9, -.4, .2], wx: .95, wr: .5, lh: [-.22, .4, -.15], lp: [-.9, -.4, 0], tw: .05, lean: .3, crouch: .16, lunge: .4 }),
    READY],
  // curta alta de forehand: raquete alta e em pé, cotovelo para baixo e a face virada para a rede (para onde vai a curta);
  // a de backhand continua sendo a curta_alta espelhada
  curta_alta_fh: [READY,
    P({ rh: [.3, .72, -.3], rp: [0, -1, 0], wx: 1.0, wr: .15, lh: [-.12, .5, -.3], lp: [-.9, -.3, .1], tw: -.2, lean: .18, crouch: .1, lunge: .25 }),
    P({ rh: [.24, .68, -.5], rp: [0, -1, 0], wx: 1.2, wr: 0, lh: [-.2, .45, -.2], lp: [-.9, -.3, .1], tw: 0, lean: .26, crouch: .14, lunge: .45 }),
    P({ rh: [.2, .6, -.6], rp: [0, -1, 0], wx: 1.25, wr: 0, lh: [-.22, .4, -.15], lp: [-.9, -.4, 0], tw: .05, lean: .3, crouch: .16, lunge: .4 }),
    READY],
  curta_baixa: [READY,
    P({ rh: [.34, .08, -.25], rp: [.9, -.6, .4], wx: 1.95, wr: .6, lh: [-.15, .3, -.3], lp: [-.9, -.5, 0], tw: -.25, lean: .48, crouch: .32, lunge: .5 }),
    P({ rh: [.28, -.04, -.5], rp: [.9, -.6, .3], wx: 2.15, wr: .75, lh: [-.25, .28, -.12], lp: [-.9, -.5, 0], tw: -.05, lean: .58, crouch: .38, lunge: .85 }),
    P({ rh: [.22, .12, -.62], rp: [.9, -.6, .2], wx: 2.0, wr: .7, lh: [-.28, .3, -.1], lp: [-.9, -.5, 0], tw: .05, lean: .52, crouch: .34, lunge: .75 }),
    READY],
  defesa_alta: [READY,
    P({ rh: [.32, .7, -.3], rp: [.8, -.3, .2], wx: .6, wr: .8, lh: [-.1, .45, -.3], lp: [-.9, -.4, 0], tw: -.2, lean: .15, bend: .08, crouch: .14, lunge: .35 }),
    P({ rh: [.34, .74, -.48], rp: [.8, -.3, .1], wx: .5, wr: .8, lh: [-.16, .45, -.24], lp: [-.9, -.4, 0], tw: -.05, lean: .18, bend: .1, crouch: .16, lunge: .45 }),
    P({ rh: [.32, .7, -.5], rp: [.8, -.3, .1], wx: .55, wr: .8, lh: [-.16, .42, -.24], lp: [-.9, -.4, 0], tw: .02, lean: .18, bend: .08, crouch: .16, lunge: .4 }),
    READY],
  defesa_baixa: [READY,
    P({ rh: [.32, .0, -.3], rp: [.8, -.7, .3], wx: 1.85, wr: .8, lh: [-.1, .25, -.3], lp: [-.9, -.5, 0], tw: -.2, lean: .52, bend: .15, crouch: .4, lunge: .85 }),
    P({ rh: [.34, -.1, -.46], rp: [.8, -.7, .2], wx: 2.0, wr: .8, lh: [-.16, .22, -.24], lp: [-.9, -.5, 0], tw: -.05, lean: .58, bend: .18, crouch: .44, lunge: .95 }),
    P({ rh: [.32, -.02, -.5], rp: [.8, -.7, .2], wx: 1.95, wr: .8, lh: [-.16, .24, -.24], lp: [-.9, -.5, 0], tw: .02, lean: .55, bend: .15, crouch: .42, lunge: .9 }),
    READY],
  smash_curto: [READY,
    P({ rh: [.3, .62, .05], rp: [.8, .7, .1], wx: -.2, lh: [-.05, .9, -.35], lp: [-.6, 0, .6], tw: -.5, lean: -.12, bend: -.06, crouch: .14 }),
    P({ rh: [.2, .58, .05], rp: [.5, .8, .1], wx: 0, lh: [-.1, .8, -.32], lp: [-.6, 0, .6], tw: -.45, lean: -.12, crouch: .12 }),
    P({ rh: [.14, .95, -.42], rp: [.5, .3, .7], wx: .35, wr: .3, lh: [-.2, .45, -.2], lp: [-.8, -.3, .3], tw: .15, lean: .12, bend: -.03, crouch: .06 }),
    P({ rh: [-.05, .3, -.45], rp: [.7, .2, -.3], wx: .6, wr: .8, lh: [-.25, .3, -.05], lp: [-.8, -.5, 0], tw: .45, lean: .45, crouch: .2 }),
    READY],
  smash_lateral: [READY,
    P({ rh: [.34, .68, .16], rp: [.8, .9, .1], wx: -.5, lh: [-.05, 1.0, -.3], lp: [-.6, 0, .6], tw: -1.0, lean: -.25, bend: -.18, crouch: .2 }),
    P({ rh: [.14, .5, .2], rp: [.3, 1.0, .1], wx: .1, lh: [-.12, .85, -.3], lp: [-.6, 0, .6], tw: -.8, lean: -.28, bend: -.15, crouch: .1 }),
    P({ rh: [.42, .85, -.3], rp: [.7, .4, .6], wx: .3, wr: -.4, lh: [-.25, .45, -.1], lp: [-.8, -.3, .3], tw: .25, lean: .02, bend: -.22, crouch: .06 }),
    P({ rh: [-.3, .15, -.2], rp: [.7, .2, -.3], wx: .6, wr: 1.4, lh: [-.25, .25, .05], lp: [-.8, -.5, 0], tw: .9, lean: .5, bend: .1, crouch: .25 }),
    READY],
  smash_costas: [READY,
    P({ rh: [.3, .7, .25], rp: [.8, .9, .1], wx: -.6, lh: [-.05, 1.1, -.2], lp: [-.6, 0, .6], tw: -.8, lean: -.45, bend: -.12, crouch: .2 }),
    P({ rh: [.1, .55, .28], rp: [.3, 1.0, .1], wx: .1, lh: [-.12, .9, -.25], lp: [-.6, 0, .6], tw: -.65, lean: -.45, bend: -.1, crouch: .14 }),
    P({ rh: [.12, 1.05, -.05], rp: [.5, .5, .7], wx: .1, wr: .3, lh: [-.2, .5, -.1], lp: [-.8, -.3, .3], tw: .05, lean: -.25, bend: -.05, crouch: .08 }),
    P({ rh: [-.15, .3, -.25], rp: [.7, .2, -.3], wx: .5, wr: .9, lh: [-.25, .3, .05], lp: [-.8, -.5, 0], tw: .5, lean: .25, crouch: .2 }),
    READY],
  // ventaglio (leque / rainbow): bola alta flutuando no lado do backhand batida forte — uma varrida do backhand de baixo até
  // apontar para a frente: começa com o braço cruzado na altura do peito e a raquete baixa (como se fosse de backhand),
  // encontra a bola na altura da cabeça e termina com a mão na frente do corpo e a raquete apontando para a rede;
  // quem gira é o punho (troca o lado da face e escova a bola em topspin), o braço quase não sai do lugar
  smash_ventaglio: [READY,
    P({ rh: [-.28, .48, -.3], rp: [-.32, -.3, -.5], wx: -.8, wr: -3.1, lh: [.12, .42, -.3], lp: [-.9, -.4, 0], tw: .5, lean: .18, bend: -.06, crouch: .2, lunge: -.25 }),
    P({ rh: [-.32, .6, -.45], rp: [-.5, .2, -.2], wx: -.2, wr: -3.1, lh: [.05, .42, -.3], lp: [-.9, -.4, 0], tw: .42, lean: .14, bend: -.03, crouch: .16, lunge: -.2 }),
    P({ rh: [-.25, .72, -.55], rp: [-.4, .5, .1], wx: -1, wr: -2.5, lh: [-.1, .4, -.25], lp: [-.9, -.3, .1], tw: .25, lean: .1, crouch: .1, lunge: -.1 }),
    P({ rh: [0, .58, -.62], rp: [.2, .3, .2], wx: -.4, wr: .3, lh: [-.22, .35, -.1], lp: [-.8, -.5, 0], tw: -.1, lean: .22, crouch: .14 }),
    READY],
  // golpe do saque: da posição de troféu a raquete cai atrás das costas, as pernas empurram (corpo sobe), o tronco gira,
  // o contato sai com o braço todo esticado e a terminação cruza o corpo até o lado esquerdo, com o peso indo para a frente
  // saque: a batida começa do troféu (sem voltar para a pose de espera); o cotovelo sobe e a raquete cai atrás das costas
  // (cabeça da raquete apontando para baixo), faz a laçada subindo até o contato no alto e termina cruzando o corpo
  smash_saque: [P({ rh: [.3, .7, .2], rp: [.7, .9, .2], wx: -1.0, lh: [.05, 1.0, -.34], lp: [-.9, 0, .3], tw: -.85, lean: -.26, bend: -.12, crouch: .34, stag: .1, feet: .5 }),
    P({ rh: [.26, .6, .27], rp: [.5, 1.0, .0], wx: -.55, wr: .25, lh: [-.02, .8, -.3], lp: [-.85, -.1, .3], tw: -.78, lean: -.3, bend: -.12, crouch: .3, stag: .1, feet: .52 }),
    P({ rh: [.15, .42, .28], rp: [.3, 1.0, -.1], wx: 0, wr: .3, lh: [-.08, .6, -.24], lp: [-.8, -.25, .3], tw: -.55, lean: -.32, bend: -.1, crouch: .14, feet: .55 }),
    P({ rh: [.16, 1.12, -.24], rp: [.5, .3, .7], wx: .25, wr: .25, lh: [-.24, .38, -.06], lp: [-.8, -.4, .2], tw: .22, lean: .04, bend: -.02, crouch: 0 }),
    P({ rh: [-.3, .12, -.26], rp: [.7, .2, -.3], wx: .6, wr: 1.2, lh: [-.2, .26, .14], lp: [-.8, -.5, 0], tw: .85, lean: .55, bend: .1, crouch: .24, lunge: .3 }),
    READY],
});
ACT.smash_salto = ACT.smash;
// golpe do saque por baixo: a raquete vem de trás, por baixo, bate na altura da cintura com a face aberta e termina alta na frente
ACT.smash_saquebaixo = [READY,
  P({ rh: [.36, .0, .26], rp: [.8, -.7, .5], wx: 1.8, wr: .5, lh: [-.02, .6, -.4], lp: [-.9, -.3, .2], tw: -.6, lean: .25, crouch: .25, stag: .55 }),
  P({ rh: [.32, .08, -.08], rp: [.8, -.7, .4], wx: 1.65, wr: .4, lh: [-.1, .5, -.3], lp: [-.9, -.4, .1], tw: -.3, lean: .24, crouch: .22, stag: .4 }),
  P({ rh: [.22, .36, -.5], rp: [.9, -.5, .3], wx: 1.2, wr: .3, lh: [-.2, .4, -.2], lp: [-.9, -.5, 0], tw: 0, lean: .2, crouch: .15, stag: .2 }),
  P({ rh: [.15, .95, -.45], rp: [.8, -.2, .2], wx: .4, wr: .2, lh: [-.25, .35, -.05], lp: [-.9, -.5, 0], tw: .3, lean: .05, crouch: .05, lunge: .15 }),
  READY];
// efeito de cada variação no golpe
const VAR_FX = {
  smash_curto: { label: 'SMASH CURTO', speed: 1.08, depth: [2.6, 4.8], gk: 1.4 },
  smash_lateral: { label: 'SMASH ANGULADO', speed: .95, depth: [3.0, 5.4], gk: 1.45, wide: true },
  smash_costas: { label: 'SMASH DE COSTAS', speed: .86, noise: 1.3, gk: 1.25 },
  smash_salto: { label: 'SMASH EM SALTO', speed: 1.05, gk: 1.4, jump: true },
  smash_ventaglio: { label: 'VENTAGLIO', speed: .97, noise: 1.12, gk: 1.35 },
  curta_alta: { label: 'CURTA DE VOLEIO', depth: [.9, 2.0], T: .75 },
  curta_baixa: { label: 'CURTA POR BAIXO', T: 1.05, gk: 1.4, noise: 1.1 },
  defesa_alta: { label: 'DEFESA ALTA', T: 1.1 },
  defesa_baixa: { label: 'DEFESA RASPANDO', T: 1.35, noise: 1.15 },
};
function swingVar(type, y, p, aimX) {
  if (type === 'curta' || type === 'defesa') return y >= 1.3 ? 'alta' : y < .62 ? 'baixa' : '';
  // bola flutuando no lado do backhand e batida forte (smash/voleio): ventaglio; fraca (defesa/curta) segue o backhand normal
  // golpe difícil e pouco comum: quanto maior o voleio, mais vezes sai (sorteio fixo por bola, para a animação e o efeito
  // do golpe baterem); no resto vira o smash/drive normal
  // bola que passa não tão rápida, no lado do backhand, um pouco acima da cabeça (bola mais alta vira smash)
  if (type === 'smash' && y >= 1.55 && y < 2.15 && p && Math.hypot(ball.vel.x, ball.vel.z) < 15 && (ball.pos.x - p.pos.x) * (p.team === 0 ? 1 : -1) * (p.lefty ? -1 : 1) < -.45 && (ball.pos.z - p.pos.z) * (p.team === 0 ? 1 : -1) <= .3
    && ((S.hitId * 37 + p.team * 11 + (p.slot > 0 ? 5 : 0)) % 100) < 100 * clamp(.04 + (attrK(p, 'voleio') - .3) * .7, .04, .6)) return 'ventaglio';
  if (type !== 'smash' || y < 1.9) return '';
  const behind = (ball.pos.z - p.pos.z) * (p.team === 0 ? 1 : -1);
  if (behind > .3) return 'costas';
  if (Math.abs(p.pos.z) < 2.6 && y < 2.7) return 'curto';
  if (aimX !== undefined && Math.abs(aimX) > (C.halfW - .6) * .6) return 'lateral';
  if (y > 2.55) return 'salto';
  return '';
}
if (typeof window !== 'undefined') window.__pdoACT = ACT;
const swingKey = p => p.swing.var && ACT[p.swing.type + '_' + p.swing.var] ? p.swing.type + '_' + p.swing.var : p.swing.type;
// saque: bola na mão, lançamento, posição de troféu
const SERVE_U = [0, .15, .32, 1]; // pêndulo rápido, braço esticado em cima aos 30% (a bola sai da mão) e o resto até o troféu
// lançamento do saque, mais solto: os braços descem juntos (pêndulo), sobem — a bola sai da mão e a raquete vai para trás
// da cabeça — e termina na posição de troféu (joelhos flexionados, tronco de lado, costas arqueadas), igual ao 1º quadro do golpe
const SERVE_KEYS = [
  P({ rh: [.2, .32, -.3], rp: [.9, -.5, .3], wx: .4, lh: [.04, .36, -.38], tw: -.3, lean: .12, crouch: .08, stag: .85, feet: 1.05 }),
  P({ rh: [.36, .14, .12], rp: [.8, -.6, .5], wx: .9, wr: .6, lh: [.08, .44, -.44], lp: [-.9, -.3, .2], tw: -.55, lean: .16, crouch: .12, stag: .7, feet: .9 }),
  P({ rh: [.33, .6, .2], rp: [.7, .8, .2], wx: -.8, lh: [.1, 1.08, -.36], lp: [-.9, 0, .3], tw: -.85, lean: -.18, bend: -.08, crouch: .1, stag: .15, feet: .42 }),
  P({ rh: [.3, .7, .2], rp: [.7, .9, .2], wx: -1.0, lh: [.05, 1.0, -.34], lp: [-.9, 0, .3], tw: -.85, lean: -.26, bend: -.12, crouch: .34, stag: .1, feet: .5 }),
];
// saque por baixo (lob): bola na frente, raquete vai para trás por baixo e a bola sobe só um pouco
const SERVE_KEYS_LOW = [
  P({ rh: [.2, .32, -.3], rp: [.9, -.5, .3], wx: .4, lh: [.04, .36, -.38], tw: -.25, lean: .15, crouch: .1, stag: .6 }),
  P({ rh: [.36, .1, .14], rp: [.8, -.6, .5], wx: 1.5, wr: .6, lh: [.02, .5, -.44], lp: [-.9, -.3, .2], tw: -.45, lean: .22, crouch: .18, stag: .65 }),
  P({ rh: [.38, .02, .28], rp: [.8, -.7, .5], wx: 1.8, wr: .5, lh: [.0, .72, -.42], lp: [-.9, -.2, .2], tw: -.6, lean: .24, crouch: .24, stag: .6 }),
  P({ rh: [.36, .0, .26], rp: [.8, -.7, .5], wx: 1.8, wr: .5, lh: [-.02, .6, -.4], lp: [-.9, -.3, .2], tw: -.6, lean: .25, crouch: .25, stag: .55 }),
];
// curva contínua pelas poses-chave (Catmull-Rom não uniforme): o golpe flui sem parar em cada chave; só freia no começo e no fim
function poseAt(keys, us, u, out) {
  let i = 0; while (i < us.length - 2 && u > us[i + 1]) i++;
  const du = us[i + 1] - us[i], t = clamp((u - us[i]) / du, 0, 1);
  const a = keys[i], b = keys[i + 1], a0 = keys[i - 1], b1 = keys[i + 2];
  const ka = a0 ? du / (us[i + 1] - us[i - 1]) : 0, kb = b1 ? du / (us[i + 2] - us[i]) : 0;
  const t2 = t * t, t3 = t2 * t, h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
  const f = (x0, x1, x2, x3) => h00 * x1 + h01 * x2 + h10 * (x2 - x0) * ka + h11 * (x3 - x1) * kb;
  for (const k in a) {
    if (Array.isArray(a[k])) { for (let j = 0; j < 3; j++) out[k][j] = f(a0 ? a0[k][j] : a[k][j], a[k][j], b[k][j], b1 ? b1[k][j] : b[k][j]); }
    else out[k] = f(a0 ? a0[k] : a[k], a[k], b[k], b1 ? b1[k] : b[k]);
  }
  return out;
}
function mirrorPose(o) { // defesa de backhand
  o.rh[0] = -o.rh[0] * .8; o.rp[0] = -o.rp[0] * .4; o.rp[2] = -Math.abs(o.rp[2]) - .3;
  o.tw = -o.tw; o.bend = -o.bend; o.wr = -o.wr; o.lh[0] = .12; o.lunge = -o.lunge;
}

export { ACT, KU, P, READY, SERVE_KEYS, SERVE_KEYS_LOW, SERVE_U, VAR_FX, mirrorPose, newPose, poseAt, swingKey, swingVar, uOf };
