// @ts-nocheck
// poses-chave dos golpes e variações
import './03-cenario';
import { C, clamp, lerp, attrK, bG, bCurve } from './00-base';
import { ball } from './07-glb';
import { S } from './01-estado';
// ---------- Poses ----------
// stag: pé de trás recuado (0 a 1) · feet: abertura das pernas (1 = normal, menos = pernas juntas)
const P = o => Object.assign({ rh: [.2, .42, -.42], rp: [.9, -.6, .3], wx: 1.15, wr: 1.2, lh: [-.03, .34, -.37], lp: [-.9, -.6, .2], tw: 0, lean: .22, bend: 0, crouch: .12, lunge: 0, stag: 0, feet: 1, yw: 0, hp: 0 }, o);
// yw: giro do corpo inteiro (pés e quadril) além do normal — negativo = ombro da mão livre para a rede (de lado, como no
// smash), positivo = ombro da raquete para a rede (de costas, como na verônica) · hp: giro do quadril sob o tronco (o quadril
// abre antes do tronco nos golpes grandes: cadeia cinética pés → quadril → tronco → braço)
function newPose() { return P({}); }
const READY = P({ rh: [.22, .36, -.38], lh: [-.02, .29, -.34], wx: 1.05 }); // prontidão: raquete na frente, mas mãos mais baixas e cotovelos soltos (nada de "V" duro)
// quadros-chave em u = 0, .3 (armado), .45 (contato), .75 (terminação), 1
const KU = [0, .3, .45, .75, 1];
const SMASH_U = [0, .3, .37, .45, .72, 1]; // o smash tem uma fase extra: a raquete cai atrás das costas
const SERVE_HIT_U = [0, .16, .33, .45, .72, 1]; // saque: mais tempo para a raquete cair atrás das costas (contato no mesmo .45)
const uOf = t => t === 'smash_saque' ? SERVE_HIT_U : ACT[t] && ACT[t].length === 6 ? SMASH_U : KU; // 6 chaves: golpe por cima (com a fase da raquete caindo atrás)
const ACT = {
  // smash: corpo de lado e a mão livre apontando a bola (smashPrep), raquete atrás da cabeça e caindo nas costas; o quadril
  // abre primeiro (hp) e o tronco vem depois; contato com o braço esticado na frente, terminação cruzando o corpo até o
  // lado esquerdo e aterrissagem equilibrada (joelhos cedem)
  smash: [READY,
    P({ wr: -.8, rh: [.32, .68, .18], rp: [.8, .9, .1], wx: -.5, lh: [-.05, 1.05, -.32], lp: [-.6, 0, .6], tw: -.55, hp: -.38, lean: -.28, bend: -.12, crouch: .2, stag: .25 }),
    P({ wr: -1, rh: [.1, .5, .2], rp: [.3, 1.0, .1], wx: .1, lh: [-.12, .85, -.3], lp: [-.6, 0, .6], tw: -.72, hp: -.02, lean: -.3, bend: -.1, crouch: .1, stag: .2 }),
    P({ rh: [.16, 1.02, -.28], rp: [.5, .3, .1], wx: .2, wr: -1.6, lh: [-.24, .38, -.1], lp: [-.8, -.3, .3], tw: -.12, hp: .24, lean: -.02, bend: -.05, crouch: .04 }),
    P({ rh: [-.22, .05, -.28], rp: [.7, .2, -.3], wx: .5, wr: -1.4, lh: [-.25, .22, .08], lp: [-.8, -.5, 0], tw: .3, hp: .42, lean: .5, bend: .05, crouch: .26 }),
    READY],
  // lob: por baixo, face aberta; as pernas flexionadas empurram e o corpo sobe junto com a raquete (terminação alta)
  lob: [READY,
    P({ rh: [.42, .02, .14], rp: [.8, 0, .5], wx: -.9, wr: 1.25, lh: [-.18, .32, -.32], lp: [-.9, -.4, 0], tw: -.6, hp: -.22, lean: .4, crouch: .3 }),
    P({ rh: [.3, .14, -.46], rp: [.9, .3, .2], wx: -.7, wr: 1.55, lh: [-.3, .34, -.18], lp: [-.9, -.4, 0], tw: -.12, hp: .1, lean: .34, crouch: .27 }),
    P({ rh: [.14, .92, -.38], rp: [.8, -.2, -.5], wx: .3, wr: 1.2, lh: [-.32, .4, -.04], lp: [-.9, -.4, 0], tw: .35, hp: .2, lean: .04, crouch: .0 }),
    READY],
  // curta: curta, macia, face aberta e quase sem terminação; a mão livre fica perto do tronco
  curta: [READY,
    P({ rh: [.3, .36, -.28], rp: [.3, -.5, .3], wx: -.1, wr: 1.55, lh: [-.1, .3, -.27], lp: [-.9, -.5, 0], tw: -.22, lean: .35, crouch: .2, lunge: .3 }),
    P({ rh: [.26, .24, -.48], rp: [.9, 0, .2], wx: -.8, wr: 1.55, lh: [-.14, .28, -.23], lp: [-.9, -.5, 0], tw: -.05, lean: .46, crouch: .27, lunge: .62 }),
    P({ rh: [.24, .27, -.54], rp: [.9, 0, .2], wx: -.8, wr: 1.55, lh: [-.15, .29, -.21], lp: [-.9, -.5, 0], tw: 0, lean: .45, crouch: .26, lunge: .58 }),
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
    P({ rh: [.34, .08, -.25], rp: [.9, -.6, .4], wx: 1.5, wr: .7, lh: [-.15, .3, -.3], lp: [-.9, -.5, 0], tw: -.25, lean: .48, crouch: .32, lunge: .5 }),
    P({ rh: [.28, -.04, -.5], rp: [.9, -.6, .3], wx: 1.2, wr: .9, lh: [-.25, .28, -.12], lp: [-.9, -.5, 0], tw: -.05, lean: .58, crouch: .38, lunge: .85 }),
    P({ rh: [.22, .12, -.62], rp: [.9, -.6, .2], wx: 1.25, wr: .9, lh: [-.28, .3, -.1], lp: [-.9, -.5, 0], tw: .05, lean: .52, crouch: .34, lunge: .75 }),
    READY],
  defesa_alta: [READY,
    P({ rh: [.32, .7, -.3], rp: [.8, -.3, .2], wx: .6, wr: .8, lh: [-.1, .45, -.3], lp: [-.9, -.4, 0], tw: -.2, lean: .15, bend: .08, crouch: .14, lunge: .35 }),
    P({ rh: [.34, .74, -.48], rp: [.8, -.3, .1], wx: .5, wr: .8, lh: [-.16, .45, -.24], lp: [-.9, -.4, 0], tw: -.05, lean: .18, bend: .1, crouch: .16, lunge: .45 }),
    P({ rh: [.32, .7, -.5], rp: [.8, -.3, .1], wx: .55, wr: .8, lh: [-.16, .42, -.24], lp: [-.9, -.4, 0], tw: .02, lean: .18, bend: .08, crouch: .16, lunge: .4 }),
    READY],
  // defesa baixa: joelhos bem dobrados (afundo), raquete perto dos joelhos com a face aberta e o golpe subindo; a mão
  // livre abre longe do corpo para equilibrar
  defesa_baixa: [READY,
    P({ rh: [.36, .02, -.2], rp: [.8, -.7, -.3], wx: -.9, wr: 1.55, lh: [-.4, .22, -.14], lp: [-.9, -.5, 0], tw: -.25, hp: -.1, lean: .5, bend: .15, crouch: .4, lunge: .82 }),
    P({ rh: [.33, -.07, -.46], rp: [.8, -.1, .2], wx: -1.1, wr: 1.55, lh: [-.48, .2, -.06], lp: [-.9, -.5, 0], tw: -.05, lean: .56, bend: .18, crouch: .42, lunge: .92 }),
    P({ rh: [.24, .3, -.56], rp: [.2, -.6, .2], wx: .9, wr: 1.4, lh: [-.46, .24, -.05], lp: [-.9, -.5, 0], tw: .08, hp: .08, lean: .46, bend: .12, crouch: .33, lunge: .8 }),
    READY],
  smash_lateral: [READY,
    P({ rh: [.34, .68, .16], rp: [.8, .9, .1], wx: -.5, lh: [-.05, 1.0, -.3], lp: [-.6, 0, .6], tw: -1.0, lean: -.25, bend: -.18, crouch: .2 }),
    P({ rh: [.14, .5, .2], rp: [.3, 1.0, .1], wx: .1, lh: [-.12, .85, -.3], lp: [-.6, 0, .6], tw: -.8, lean: -.28, bend: -.15, crouch: .1 }),
    P({ rh: [.42, .85, -.3], rp: [.7, .4, .6], wx: .3, wr: -.4, lh: [-.25, .45, -.1], lp: [-.8, -.3, .3], tw: .25, lean: .02, bend: -.22, crouch: .06 }),
    P({ rh: [-.3, .15, -.2], rp: [.7, .2, -.3], wx: .6, wr: 1.4, lh: [-.25, .25, .05], lp: [-.8, -.5, 0], tw: .9, lean: .5, bend: .1, crouch: .25 }),
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
  smash_saque: [P({ rh: [.3, .7, .2], rp: [.7, .9, .2], wx: -1.0, lh: [.05, 1.0, -.34], lp: [-.9, 0, .3], tw: -.85, lean: -.26, bend: -.12, crouch: .2, stag: .1, feet: .5 }),
    P({ rh: [.26, .6, .27], rp: [.5, 1.0, .0], wx: -.55, wr: .25, lh: [-.02, .8, -.3], lp: [-.85, -.1, .3], tw: -.78, lean: -.3, bend: -.12, crouch: .18, stag: .1, feet: .52 }),
    P({ rh: [.15, .42, .28], rp: [.3, 1.0, -.1], wx: 0, wr: .3, lh: [-.08, .6, -.24], lp: [-.8, -.25, .3], tw: -.55, lean: -.32, bend: -.1, crouch: .14, feet: .55 }),
    P({ rh: [.16, 1.12, -.24], rp: [.5, .3, .7], wx: .25, wr: .25, lh: [-.24, .38, -.06], lp: [-.8, -.4, .2], tw: .22, lean: .04, bend: -.02, crouch: 0 }),
    P({ rh: [-.3, .12, -.26], rp: [.7, .2, -.3], wx: .6, wr: 1.2, lh: [-.2, .26, .14], lp: [-.8, -.5, 0], tw: .85, lean: .55, bend: .1, crouch: .24, lunge: .3 }),
    READY],
});
// smash em salto (bola bem alta): tronco bem arqueado na preparação e contato mais alto
ACT.smash_salto = ACT.smash.map((k, i) => i === 1 ? P(Object.assign({}, k, { lean: -.46, bend: -.16, lh: [-.05, 1.12, -.3], rh: [.34, .74, .24] })) : i === 3 ? P(Object.assign({}, k, { rh: [.16, 1.14, -.3], lean: .02 })) : k);
// golpe do saque por baixo: a raquete vem de trás, por baixo, bate na altura da cintura com a face aberta e termina alta na frente
ACT.smash_saquebaixo = [READY,
  P({ rh: [.36, .0, .26], rp: [.8, -.7, .5], wx: 1.8, wr: .5, lh: [-.02, .6, -.4], lp: [-.9, -.3, .2], tw: -.6, lean: .25, crouch: .25, stag: .55 }),
  P({ rh: [.32, .08, -.08], rp: [.8, -.7, .4], wx: 1.65, wr: .4, lh: [-.1, .5, -.3], lp: [-.9, -.4, .1], tw: -.3, lean: .24, crouch: .22, stag: .4 }),
  P({ rh: [.22, .36, -.5], rp: [.9, -.5, .3], wx: 1.2, wr: .3, lh: [-.2, .4, -.2], lp: [-.9, -.5, 0], tw: 0, lean: .2, crouch: .15, stag: .2 }),
  P({ rh: [.15, .95, -.45], rp: [.8, -.2, .2], wx: .4, wr: .2, lh: [-.25, .35, -.05], lp: [-.9, -.5, 0], tw: .3, lean: .05, crouch: .05, lunge: .15 }),
  READY];
// ---------- golpes por situação (escolhidos pela posição e pelo tempo da bola, sem botões novos: swingVar) ----------
// smash avançando (bola na frente, vindo para a rede): peso indo para a frente, contato bem à frente do corpo e o pé de
// trás passando na terminação. O smash curto (perto da rede) usa o mesmo movimento
ACT.smash_avanco = [READY,
  P({ wr: -.8, rh: [.32, .68, .16], rp: [.8, .9, .1], wx: -.45, lh: [-.05, 1.0, -.36], lp: [-.6, 0, .6], tw: -.5, hp: -.35, lean: -.2, bend: -.1, crouch: .2, stag: .3 }),
  P({ wr: -1, rh: [.12, .52, .18], rp: [.3, 1.0, .1], wx: .1, lh: [-.12, .82, -.34], lp: [-.6, 0, .6], tw: -.66, hp: 0, lean: -.22, bend: -.08, crouch: .1, stag: .25 }),
  P({ rh: [.17, .97, -.44], rp: [.5, .3, .1], wx: .2, wr: -1.6, lh: [-.24, .4, -.16], lp: [-.8, -.3, .3], tw: -.05, hp: .28, lean: .16, bend: -.03, crouch: .04 }),
  P({ rh: [-.2, .06, -.42], rp: [.7, .2, -.3], wx: .55, wr: -1.4, lh: [-.25, .22, .06], lp: [-.8, -.5, 0], tw: .3, hp: .45, lean: .62, bend: .05, crouch: .26, lunge: .3 }),
  READY];
ACT.smash_curto = ACT.smash_avanco;
// smash recuando (passos rápidos para trás; bola um pouco atrás): tronco levemente para trás, contato menos à frente,
// terminação mais curta (o peso não vai todo para a frente). O smash de costas usa o mesmo movimento
ACT.smash_recuo = [READY,
  P({ wr: -.8, rh: [.3, .72, .26], rp: [.8, .9, .1], wx: -.55, lh: [-.05, 1.08, -.24], lp: [-.6, 0, .6], tw: -.6, hp: -.35, lean: -.4, bend: -.12, crouch: .2, stag: .5 }),
  P({ wr: -1, rh: [.1, .56, .28], rp: [.3, 1.0, .1], wx: .1, lh: [-.12, .9, -.25], lp: [-.6, 0, .6], tw: -.62, hp: -.08, lean: -.42, bend: -.1, crouch: .14, stag: .45 }),
  P({ rh: [.14, 1.04, -.08], rp: [.5, .5, .1], wx: -.2, wr: -1.6, lh: [-.22, .46, -.1], lp: [-.8, -.3, .3], tw: -.12, hp: .2, lean: -.2, bend: -.05, crouch: .08, stag: .4 }),
  P({ rh: [-.16, .28, -.26], rp: [.7, .2, -.3], wx: .5, wr: -1.4, lh: [-.25, .28, .06], lp: [-.8, -.5, 0], tw: .3, hp: .32, lean: .22, crouch: .22, stag: .3 }),
  READY];
ACT.smash_costas = ACT.smash_recuo;
// gancho: bola alta que passou por trás / para o lado do backhand. Não é um smash de braço dobrado: o corpo fica bem de
// lado, quase de costas para a rede, e o braço quase esticado faz um arco largo por fora — sai de baixo do lado da
// raquete, sobe por cima e em volta da cabeça e encontra a bola no alto, na linha (ou atrás) dos ombros, com o tronco
// tombando para o lado da mão livre; termina descendo pelo lado esquerdo. A mão livre só equilibra
ACT.smash_gancho = [READY,
  P({ rh: [.56, .42, .14], rp: [.9, -.3, .5], wx: -.5, wr: .6, lh: [-.3, .7, -.28], lp: [-.8, -.2, .3], tw: -.4, hp: -.25, yw: -1.0, lean: -.12, bend: .14, crouch: .22, stag: .3 }),
  P({ rh: [.5, .8, .18], rp: [.9, .2, .5], wx: -.4, wr: .8, lh: [-.36, .55, -.22], lp: [-.8, -.2, .3], tw: -.32, hp: -.1, yw: -1.1, lean: -.2, bend: .08, crouch: .16, stag: .25 }),
  P({ rh: [.02, 1.0, .1], rp: [-.3, .9, .5], wx: -.4, wr: .95, lh: [-.42, .42, -.04], lp: [-.8, -.3, .3], tw: -.06, hp: .12, yw: -1.1, lean: -.22, bend: -.26, crouch: .08 }),
  P({ rh: [-.46, .36, -.14], rp: [-.2, -.3, -.6], wx: -.4, wr: 1.2, lh: [-.3, .26, .1], lp: [-.8, -.5, 0], tw: .3, hp: .3, yw: -.6, lean: .2, bend: -.08, crouch: .22 }),
  READY];
// verônica: bola alta no lado do backhand — batida por cima com a face do backhand, meio de costas para a rede (o ombro
// da raquete aponta para a rede). Cotovelo alto, raquete pendurada atrás da cabeça; o braço estica para cima e o tronco
// gira de volta para a quadra na terminação. Não é um smash espelhado: o corpo vira para o outro lado e a face é a do
// backhand. A mão livre equilibra
ACT.smash_veronica = [READY,
  P({ rh: [-.24, .66, .12], rp: [-.3, .9, .3], wx: -1, wr: 1.3, lh: [-.4, .3, -.24], lp: [-.9, -.3, .2], tw: .32, hp: .15, yw: 1.15, lean: -.06, bend: .1, crouch: .2 }),
  P({ rh: [-.26, .66, .2], rp: [-.3, .9, -.3], wx: 1.4, wr: 1.3, lh: [-.42, .3, -.2], lp: [-.9, -.3, .2], tw: .38, hp: .1, yw: 1.2, lean: -.1, bend: .1, crouch: .17 }),
  P({ rh: [-.3, 1.0, -.02], rp: [-.5, 1.4, -.2], wx: -.9, wr: 1.55, lh: [-.44, .3, .04], lp: [-.9, -.4, .2], tw: .05, hp: .05, yw: 1.28, lean: -.1, bend: -.1, crouch: .08 }),
  P({ rh: [.14, .82, -.38], rp: [.3, 1.2, -.6], wx: -1.1, wr: 1.55, lh: [-.36, .3, .12], lp: [-.9, -.5, 0], tw: -.25, hp: -.1, yw: .7, lean: .1, crouch: .18 }),
  READY];
// verônica lob (botão do lob numa bola alta no backhand): mesmo começo, contato um pouco mais baixo com a face bem
// aberta e terminação subindo (a bola sobe alta)
ACT.lob_veronica = [READY, ACT.smash_veronica[1], ACT.smash_veronica[2],
  P({ rh: [-.34, .88, -.08], rp: [-.5, .7, .4], wx: -.9, wr: 1.4, lh: [-.44, .3, .04], lp: [-.9, -.4, .2], tw: .1, hp: .05, yw: 1.3, lean: -.08, bend: -.06, crouch: .1 }),
  P({ rh: [-.1, 1.0, -.26], rp: [-.8, .7, -.5], wx: .5, wr: 1.4, lh: [-.36, .32, .1], lp: [-.9, -.5, 0], tw: -.05, hp: 0, yw: .9, lean: -.04, crouch: .06 }),
  READY];
// bandeja: bola alta que não dá para finalizar (mal posicionado, atrasado, do fundo): de lado como no smash, mas a
// raquete quase não cai nas costas; contato ao lado da cabeça e mais baixo, face aberta, aceleração contida e a
// terminação vai para a frente e para baixo, sem cruzar todo o corpo
ACT.smash_bandeja = [READY,
  P({ rh: [.42, .72, .12], rp: [.9, .9, .35], wx: -.2, wr: -1.2, lh: [-.05, 1.0, -.32], lp: [-.6, 0, .6], tw: -.6, hp: -.25, lean: -.12, bend: -.05, crouch: .18, stag: .2 }),
  P({ rh: [.4, .68, .1], rp: [.8, .4, -.3], wx: -.3, wr: -1.4, lh: [-.1, .88, -.3], lp: [-.6, 0, .6], tw: -.56, hp: -.1, lean: -.12, bend: -.05, crouch: .15, stag: .2 }),
  P({ rh: [.42, .82, -.3], rp: [.8, .2, -.1], wx: .3, wr: -1.6, lh: [-.2, .48, -.2], lp: [-.8, -.3, .3], tw: -.08, hp: .12, lean: .02, bend: -.15, crouch: .1 }),
  P({ rh: [.04, .44, -.5], rp: [.7, .4, -.1], wx: .2, wr: -.6, lh: [-.25, .32, -.04], lp: [-.8, -.5, 0], tw: .28, hp: .24, lean: .2, crouch: .17 }),
  READY];
// lob numa bola alta no lado da raquete: o movimento da bandeja, terminando alto (empurra a bola para cima)
ACT.lob_alto = [READY, ACT.smash_bandeja[1], ACT.smash_bandeja[2], ACT.smash_bandeja[3],
  P({ rh: [.18, .96, -.42], rp: [.7, .1, .2], wx: .4, wr: 1.0, lh: [-.25, .36, -.06], lp: [-.8, -.5, 0], tw: .2, hp: .15, lean: .06, crouch: .08 }),
  READY];
// voleio de forehand (bola no peito, lado da raquete): curto e compacto, quase só braço e raquete; a raquete sobe um
// pouco atrás do ombro (sem girar o corpo), o contato é na frente com um passo de leve e a mão livre abre para equilibrar
ACT.smash_vfh = [READY,
  P({ rh: [.44, .48, -.12], rp: [.9, -.5, -.6], wx: .3, wr: -1, lh: [-.12, .46, -.42], lp: [-.9, -.3, .1], tw: -.32, hp: -.12, lean: .2, crouch: .16, lunge: .15 }),
  P({ rh: [.3, .5, -.5], rp: [.9, -.5, -.4], wx: -.5, wr: -1.15, lh: [-.3, .4, -.18], lp: [-.9, -.4, 0], tw: .02, hp: .08, lean: .27, crouch: .18, lunge: .42 }),
  P({ rh: [.2, .46, -.54], rp: [.3, -.5, -.4], wx: 1, wr: .2, lh: [-.3, .36, -.12], lp: [-.9, -.4, 0], tw: .1, hp: .1, lean: .26, crouch: .17, lunge: .35 }),
  READY];
// voleio de backhand: o braço cruza o corpo e os ombros giram (ombro da raquete para a frente); a mão livre acompanha a
// raquete na preparação e solta para trás no contato; contato na frente, terminação curta
ACT.smash_vbh = [READY,
  P({ rh: [-.2, .5, -.24], rp: [-.3, -.7, -.6], wx: 1.1, wr: -1.6, lh: [-.1, .48, -.34], lp: [-.9, -.4, 0], tw: .42, hp: .15, yw: .2, lean: .2, crouch: .16, lunge: -.2 }),
  P({ rh: [-.36, .5, -.48], rp: [-.4, -.7, -.5], wx: .1, wr: -1.6, lh: [-.36, .34, .06], lp: [-.9, -.5, .3], tw: .2, hp: .1, yw: .15, lean: .26, crouch: .18, lunge: -.45 }),
  P({ rh: [-.4, .48, -.5], rp: [-1, -.9, -.5], wx: 1, wr: -1.6, lh: [-.38, .32, .1], lp: [-.9, -.5, .3], tw: .1, hp: .05, yw: .1, lean: .25, crouch: .17, lunge: -.38 }),
  READY];
// contra-voleio / bloqueio reflexo (quase sem tempo): nenhuma preparação — a raquete só vai para a frente do corpo e
// bloqueia; recupera logo. Também na defesa (espelhado no backhand)
ACT.smash_reflexo = [READY,
  P({ rh: [.2, .5, -.46], rp: [.2, -.3, .3], wx: .7, wr: .05, lh: [-.06, .42, -.4], lp: [-.9, -.4, 0], tw: -.05, lean: .22, crouch: .17, lunge: .12 }),
  P({ rh: [.16, .52, -.56], rp: [.2, -.3, .25], wx: .8, wr: .1, lh: [-.12, .4, -.34], lp: [-.9, -.4, 0], tw: .02, lean: .25, crouch: .19, lunge: .22 }),
  P({ rh: [.17, .5, -.52], rp: [.2, -.3, .2], wx: .9, wr: .2, lh: [-.12, .4, -.34], lp: [-.9, -.4, 0], tw: .02, lean: .24, crouch: .18, lunge: .18 }),
  READY];
ACT.defesa_reflexo = ACT.smash_reflexo;
ACT.defesa_bloqueio = ACT.smash_reflexo;
// direita impulsionada (diritto spinto): forehand agressivo de meia altura, do meio/fundo — o corpo gira bem mais na
// preparação (raquete atrás), o quadril abre primeiro e a terminação passa alta pelo outro lado
ACT.smash_spinto = [READY,
  P({ rh: [.5, .42, .28], rp: [.9, -.3, .6], wx: .2, wr: -.55, lh: [-.02, .48, -.44], lp: [-.9, -.3, .1], tw: -.62, hp: -.32, yw: -.22, lean: .2, crouch: .22, stag: .4 }),
  P({ rh: [.38, .44, -.46], rp: [.9, -1.1, .2], wx: -.7, wr: -1.6, lh: [-.34, .38, -.08], lp: [-.9, -.4, 0], tw: .05, hp: .25, yw: -.05, lean: .3, crouch: .2, lunge: .3 }),
  P({ rh: [-.22, .62, -.36], rp: [-.2, -.2, -.4], wx: 1.1, wr: .65, lh: [-.3, .3, .08], lp: [-.9, -.5, 0], tw: .75, hp: .4, lean: .28, crouch: .2, lunge: .2 }),
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
  // golpes por situação: efeitos pequenos. Bandeja: menos ritmo, mais segura (sem efeito de mergulho, menos ameaça) ·
  // gancho e verônica: menos força e mais erro perto das linhas · verônica lob: lob alto · contra-voleio: só o nome
  smash_bandeja: { label: 'BANDEJA', speed: .82, noise: .82, gk: 1.15, calm: true, risk: .9 },
  smash_gancho: { label: 'GANCHO', speed: .9, noise: 1.2, mis: .03, edge: 1.5 },
  smash_veronica: { label: 'VERÔNICA', speed: .8, noise: 1.3, mis: .05, gk: 1.25, edge: 1.7 },
  lob_veronica: { label: 'VERÔNICA LOB', minT: 1.85, noise: 1.1 },
  smash_spinto: { label: 'DIREITA IMPULSIONADA', speed: 1.04, noise: 1.06, drive: true },
  smash_reflexo: { label: 'CONTRA-VOLEIO', soft: true, drive: true },
  defesa_reflexo: { label: 'CONTRA-VOLEIO', soft: true },
};
// variações escolhidas na preparação (o jogador se compromete com o golpe): o contato mantém a escolha
const COMMIT = new Set(['gancho', 'veronica', 'bandeja', 'avanco', 'recuo', 'vfh', 'vbh', 'reflexo', 'spinto', 'alto']);
// ponto onde a bola vai chegar ao jogador (bola baixa: quando entra a ~0,85 m dele; bola alta: onde passa mais perto)
function predictPt(p) {
  if (ball.state !== 'live') return ball.pos;
  const q = { x: ball.pos.x, y: ball.pos.y, z: ball.pos.z }, v = ball.vel.clone(), dt = .01; let best = null, bd = 1e9;
  for (let t = 0; t < 1.4; t += dt) {
    const d = Math.hypot(q.x - p.pos.x, q.z - p.pos.z);
    if (d < bd) { bd = d; best = { x: q.x, y: q.y, z: q.z, t }; }
    else if (q.y > 1.7 && best && d > bd + .05) break; // bola alta: o contato é onde ela passa mais perto (por cima da cabeça)
    if (d < .85 && q.y <= 1.7) break; // bola baixa/média: onde ela entra no alcance
    v.y -= bG() * dt; bCurve(v, dt); q.x += v.x * dt; q.y += v.y * dt; q.z += v.z * dt;
    if (q.y < C.ballR) break;
  }
  return best || ball.pos;
}
// variação do golpe pela situação (posição da bola em relação ao corpo e o tempo até ela chegar) — vale igual para o
// humano (mesmos botões) e para a CPU. ctx: { pt: ponto de contato previsto, tt: segundos até a bola chegar, atHit: no
// contato (sem os critérios de tempo), late: atrasado (barra do smash tarde) }
function swingVar(type, y, p, aimX, ctx) {
  ctx = ctx || {};
  const lowHigh = y >= 1.3 ? 'alta' : y < .62 ? 'baixa' : '';
  if (!p) return type === 'curta' || type === 'defesa' ? lowHigh : '';
  const at = !!ctx.atHit, pt = ctx.pt || (at ? ball.pos : predictPt(p)), ref = ctx.ref || p.pos; // ref: onde o jogador vai estar no contato
  const f = p.team === 0 ? 1 : -1, hand = p.lefty ? -1 : 1;
  const lat = (pt.x - ref.x) * f * hand, fwd = -(pt.z - ref.z) * f; // lado da raquete + · à frente +
  const bs = Math.hypot(ball.vel.x, ball.vel.z);
  // tempo de reação de verdade: da batida do adversário até a bola chegar (bola rápida entre dois jogadores na rede), ou o
  // aperto muito em cima da hora (ctx.tt: segundos que faltavam quando o humano apertou)
  const hp = S.lastHit && S.lastHit.p && S.lastHit.p !== p ? S.lastHit.p.pos : null, flight = hp ? Math.hypot(hp.x - p.pos.x, hp.z - p.pos.z) / Math.max(1, bs) : 9;
  const quick = !at && !ctx.prepared && ball.state === 'live' && (flight < .42 || (ctx.tt != null && ctx.tt < .1)); // quase sem tempo: bloqueio reflexo
  if (type === 'curta') return lowHigh;
  if (type === 'defesa') return quick && y >= .62 && y < 1.3 ? 'reflexo' : lowHigh;
  // lob numa bola alta: por cima — no backhand a verônica lob, no lado da raquete o movimento da bandeja
  if (type === 'lob') return y >= 1.8 && !at ? (lat < -.3 ? 'veronica' : 'alto') : '';
  if (type !== 'smash') return '';
  // ventaglio (leque): bola que passa não tão rápida, no lado do backhand, um pouco acima da cabeça, batida forte; golpe
  // difícil e pouco comum — quanto maior o voleio, mais vezes sai (sorteio fixo por bola, para a animação e o efeito baterem)
  if (y >= 1.55 && y < 2.15 && bs < 15 && lat < -.45 && fwd >= -.3
    && ((S.hitId * 37 + p.team * 11 + (p.slot > 0 ? 5 : 0)) % 100) < 100 * clamp(.04 + (attrK(p, 'voleio') - .3) * .7, .04, .6)) return 'ventaglio';
  // meia altura (voleio/drive): sem tempo → contra-voleio; lado esquerdo → voleio de backhand; do meio/fundo, bola na
  // altura da cintura/peito no lado da raquete → direita impulsionada; senão voleio de forehand
  if (y < 1.9) {
    if (quick && y >= .5) return 'reflexo';
    if (lat < -.15) return 'vbh';
    if (Math.abs(p.pos.z) > 3.6 && y >= .8 && y < 1.6) return 'spinto';
    return 'vfh';
  }
  // por cima: bola atrás ou no lado do backhand → gancho (até ~0,55 m para a esquerda) ou verônica (mais longe, ainda no alcance)
  const netD = Math.abs(p.pos.z), back = p.vel.z * f, fin = netD < 3;
  // (gancho, verônica e bandeja só se escolhem na preparação — o corpo já vira para eles; no contato vale a escolha feita)
  if (at) { if (fwd < -.3) return 'costas'; }
  else {
  if (fwd < -.3) return lat < -.55 ? 'veronica' : lat < .15 ? 'gancho' : 'costas';
  if (lat < -.55) return 'veronica';
  if (lat < -.32) return 'gancho';
  // bandeja: bola alta que não dá para finalizar — longe do ponto ideal (muito para o lado ou muito à frente), atrasado,
  // ou do fundo numa bola não tão alta (fora da zona de finalização)
  if (!fin && (lat > .7 || fwd > .95 || ctx.late || (netD > 5 && y < 2.3))) return 'bandeja';
  }
  if (netD < 2.6 && y < 2.7) return 'curto';
  if (aimX !== undefined && Math.abs(aimX) > (C.halfW - .6) * .6) return 'lateral';
  if (y > 2.55) return 'salto';
  if (back > 1.2) return 'recuo';
  if (-back > 1.2 || netD < 3.4) return 'avanco';
  return '';
}
// no contato: a escolha da preparação vale, a não ser que ela seja só visual e o contato peça uma variação com efeito
function hitVar(type, vrHit, v0) {
  if (!COMMIT.has(v0) || !ACT[type + '_' + v0]) return vrHit;
  return VAR_FX[type + '_' + v0] || !VAR_FX[type + '_' + vrHit] ? v0 : vrHit;
}
// quanto a terminação dura em relação ao resto do golpe (< 1: mais lenta, continua depois do fim do golpe no jogo)
const TAIL_RATE = { smash_gancho: .6, smash_veronica: .6, lob_veronica: .65, smash_bandeja: .75, lob_alto: .75, smash_vfh: 1, smash_vbh: 1, smash_reflexo: 1.25, defesa_reflexo: 1.25, smash_spinto: .8, lob: .85, curta: 1, defesa: .9, smash_saque: 1, smash_saquebaixo: 1, smash_ventaglio: .8 };
const tailRate = ak => TAIL_RATE[ak] ?? (ak.startsWith('smash') ? .65 : .9);
// golpes que espelham para o backhand (os golpes por situação têm o backhand próprio)
const mirrorKey = ak => /^(defesa|curta|lob)/.test(ak) && ak !== 'lob_veronica' && ak !== 'lob_alto' || ak === 'smash_reflexo';
if (typeof window !== 'undefined') { window.__pdoACT = ACT; window.__pdoP = P; window.__pdoVAR = VAR_FX; window.__pdoSV = swingVar; }
const swingKey = p => p.swing.var && ACT[p.swing.type + '_' + p.swing.var] ? p.swing.type + '_' + p.swing.var : p.swing.type;
// saque: bola na mão, lançamento, posição de troféu
const SERVE_U = [0, .15, .32, 1]; // pêndulo rápido, braço esticado em cima aos 30% (a bola sai da mão) e o resto até o troféu
// lançamento do saque, mais solto: os braços descem juntos (pêndulo), sobem — a bola sai da mão e a raquete vai para trás
// da cabeça — e termina na posição de troféu (joelhos flexionados, tronco de lado, costas arqueadas), igual ao 1º quadro do golpe
const SERVE_KEYS = [
  P({ rh: [.2, .32, -.3], rp: [.9, -.5, .3], wx: .4, lh: [.04, .36, -.38], tw: -.3, lean: .12, crouch: .08, stag: .85, feet: 1.05 }),
  P({ rh: [.36, .14, .12], rp: [.8, -.6, .5], wx: .9, wr: .6, lh: [.08, .44, -.44], lp: [-.9, -.3, .2], tw: -.55, lean: .16, crouch: .12, stag: .7, feet: .9 }),
  P({ rh: [.33, .6, .2], rp: [.7, .8, .2], wx: -.8, lh: [.1, 1.08, -.36], lp: [-.9, 0, .3], tw: -.85, lean: -.18, bend: -.08, crouch: .1, stag: .15, feet: .42 }),
  P({ rh: [.3, .7, .2], rp: [.7, .9, .2], wx: -1.0, lh: [.05, 1.0, -.34], lp: [-.9, 0, .3], tw: -.85, lean: -.26, bend: -.12, crouch: .2, stag: .1, feet: .5 }), // (joelhos levemente dobrados no troféu)
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
// variações de estilo (só visual, não muda o golpe): cada batida sorteia um jeito de preparar e de terminar — terminação
// cruzando o corpo, contida na frente, pronada para o lado da raquete, bloqueio, cortada… Somadas à pose em duas
// "corcovas": a preparação (pico ~.25) e a terminação (pico ~.72); no contato (.45) e nas pontas valem zero, então a
// raquete encontra a bola no mesmo lugar e volta para a espera sem estalo. Cada jogador tem um jeito preferido
const STY = {
  smash: [{}, { d2: { rh: [-.12, -.14, 0], tw: .25, lean: .08 } }, { d2: { rh: [.2, .32, -.08], tw: -.3, lean: -.15, crouch: -.08 } },
    { d2: { rh: [.36, .14, .05], tw: -.35, wr: -.8 } }, { d1: { lh: [0, .14, 0], tw: -.18, lean: -.06 } }, { d1: { lh: [.06, -.2, .1], tw: .1 }, d2: { rh: [-.06, -.05, 0], tw: .12 } }],
  saque: [{}, { d2: { rh: [-.1, -.1, 0], tw: .2, lean: .06 } }, { d2: { rh: [.3, .16, .04], tw: -.3, wr: -.7 } }, { d2: { rh: [.12, .25, -.06], tw: -.2, crouch: -.06 } }],
  lob: [{}, { d2: { rh: [-.05, .26, 0], tw: .15 } }, { d2: { rh: [.05, -.32, -.05], tw: -.2, lean: .05 } }, { d1: { rh: [.06, -.06, .08], tw: -.15 }, d2: { wx: -.4, rh: [0, .06, 0] } }],
  toque: [{}, { d1: { rh: [-.08, 0, -.1], tw: .15 }, d2: { rh: [.04, 0, .16] } }, { d2: { rh: [-.05, -.15, -.1], wx: .3, lean: .05 } },
    { d2: { rh: [0, .18, -.05], wx: -.25 } }, { d1: { crouch: .06, lean: .06 }, d2: { crouch: .05, rh: [.06, -.04, -.06] } }],
};
if (typeof window !== 'undefined') window.__pdoSTY = STY;
const NOSTY = new Set(['smash_ventaglio', 'smash_saquebaixo', 'smash_gancho', 'smash_veronica', 'smash_bandeja', 'lob_veronica', 'lob_alto', 'smash_reflexo', 'defesa_reflexo', 'smash_vbh']);
const styFam = ak => ak === 'smash_saque' ? 'saque' : NOSTY.has(ak) ? '' : ak === 'smash_vfh' || ak === 'smash_spinto' ? 'toque' : ak.startsWith('smash') ? 'smash' : ak === 'lob' ? 'lob' : 'toque';
// sorteio: metade das vezes o preferido do jogador (do id), senão qualquer um; intensidade também varia
function pickStyle(ak, c) {
  const fam = styFam(ak), L = STY[fam]; if (!L) return null;
  let h = 7; for (const ch of String((c && c.id) || '') + fam) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const v = Math.random() < .5 ? L[h % L.length] : L[Math.floor(Math.random() * L.length)];
  return { v, k: .75 + Math.random() * .5, k1: .7 + Math.random() * .6 };
}
const bump = (u, a, b) => u <= a || u >= b ? 0 : Math.sin(Math.PI * (u - a) / (b - a)) ** 2;
function styleSwing(pose, ak, u, st) {
  if (!st || !st.v) return;
  const add = (d, w) => { if (!d || w <= 0) return; for (const k in d) { if (Array.isArray(d[k])) for (let j = 0; j < 3; j++) pose[k][j] += d[k][j] * w; else pose[k] += d[k] * w; } };
  const sm = ak.startsWith('smash'), c = sm ? .45 : .45;
  add(st.v.d1, bump(u, .04, c) * st.k1); add(st.v.d2, bump(u, c, 1) * st.k);
}
function mirrorPose(o) { // defesa de backhand
  o.rh[0] = -o.rh[0] * .8; o.rp[0] = -o.rp[0] * .4; o.rp[2] = -Math.abs(o.rp[2]) - .3;
  o.tw = -o.tw; o.bend = -o.bend; o.wr = -o.wr; o.lh[0] = .12; o.lunge = -o.lunge; o.yw = -o.yw; o.hp = -o.hp;
}

export { COMMIT, hitVar, predictPt, tailRate, mirrorKey, STY, pickStyle, styleSwing, ACT, KU, P, READY, SERVE_KEYS, SERVE_KEYS_LOW, SERVE_U, VAR_FX, mirrorPose, newPose, poseAt, swingKey, swingVar, uOf };
