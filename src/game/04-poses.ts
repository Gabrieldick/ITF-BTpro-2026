// @ts-nocheck
// poses-chave dos golpes e variações
import './03-cenario';
import { C, clamp, lerp } from './00-base';
import { ball } from './07-glb';
// ---------- Poses ----------
const P = o => Object.assign({ rh: [.2, .42, -.42], rp: [.9, -.6, .3], wx: 1.15, wr: 1.2, lh: [-.03, .34, -.37], lp: [-.9, -.6, .2], tw: 0, lean: .22, bend: 0, crouch: .12, lunge: 0 }, o);
function newPose() { return P({}); }
const READY = P({});
// quadros-chave em u = 0, .3 (armado), .45 (contato), .75 (terminação), 1
const KU = [0, .3, .45, .75, 1];
const SMASH_U = [0, .3, .37, .45, .72, 1]; // o smash tem uma fase extra: a raquete cai atrás das costas
const uOf = t => t.startsWith('smash') ? SMASH_U : KU;
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
});
ACT.smash_salto = ACT.smash;
// efeito de cada variação no golpe
const VAR_FX = {
  smash_curto: { label: 'SMASH CURTO', speed: 1.08, depth: [2.6, 4.8], gk: 1.4 },
  smash_lateral: { label: 'SMASH ANGULADO', speed: .95, depth: [3.0, 5.4], gk: 1.45, wide: true },
  smash_costas: { label: 'SMASH DE COSTAS', speed: .86, noise: 1.3, gk: 1.25 },
  smash_salto: { label: 'SMASH EM SALTO', speed: 1.05, gk: 1.4, jump: true },
  curta_alta: { label: 'CURTA DE VOLEIO', depth: [.9, 2.0], T: .75 },
  curta_baixa: { label: 'CURTA POR BAIXO', T: 1.05, gk: 1.05, noise: 1.1 },
  defesa_alta: { label: 'DEFESA ALTA', T: 1.1 },
  defesa_baixa: { label: 'DEFESA RASPANDO', T: 1.35, noise: 1.15 },
};
function swingVar(type, y, p, aimX) {
  if (type === 'curta' || type === 'defesa') return y >= 1.3 ? 'alta' : y < .62 ? 'baixa' : '';
  if (type !== 'smash' || y < 1.9) return '';
  const behind = (ball.pos.z - p.pos.z) * (p.team === 0 ? 1 : -1);
  if (behind > .3) return 'costas';
  if (Math.abs(p.pos.z) < 2.6 && y < 2.7) return 'curto';
  if (aimX !== undefined && Math.abs(aimX) > (C.halfW - .6) * .6) return 'lateral';
  if (y > 2.55) return 'salto';
  return '';
}
const swingKey = p => p.swing.var && ACT[p.swing.type + '_' + p.swing.var] ? p.swing.type + '_' + p.swing.var : p.swing.type;
// saque: bola na mão, lançamento, posição de troféu
const SERVE_U = [0, .35, .75, 1];
const SERVE_KEYS = [
  P({ rh: [.2, .3, -.28], rp: [.9, -.5, .3], wx: .3, lh: [.04, .34, -.36], tw: -.2, lean: .1, crouch: .06 }),
  P({ rh: [.32, .42, .12], rp: [.8, -.2, .5], wx: -.3, lh: [.12, .98, -.42], lp: [-.9, 0, .3], tw: -.5, lean: 0, crouch: .12 }),
  P({ rh: [.3, .66, .22], rp: [.7, .9, .2], wx: -1.0, lh: [.1, 1.02, -.38], lp: [-.9, 0, .3], tw: -.75, lean: -.25, bend: -.1, crouch: .24 }),
  P({ rh: [.28, .72, .16], rp: [.7, .9, .2], wx: -1.0, lh: [0, .8, -.38], lp: [-.9, 0, .3], tw: -.55, lean: -.15, bend: -.1, crouch: .02 }),
];
function poseAt(keys, us, u, out) {
  let i = 0; while (i < us.length - 2 && u > us[i + 1]) i++;
  let t = clamp((u - us[i]) / (us[i + 1] - us[i]), 0, 1); t = t * t * (3 - 2 * t);
  const a = keys[i], b = keys[i + 1];
  for (const k in a) { if (Array.isArray(a[k])) { for (let j = 0; j < 3; j++) out[k][j] = lerp(a[k][j], b[k][j], t); } else out[k] = lerp(a[k], b[k], t); }
  return out;
}
function mirrorPose(o) { // defesa de backhand
  o.rh[0] = -o.rh[0] * .8; o.rp[0] = -o.rp[0] * .4; o.rp[2] = -Math.abs(o.rp[2]) - .3;
  o.tw = -o.tw; o.bend = -o.bend; o.wr = -o.wr; o.lh[0] = .12; o.lunge = -o.lunge;
}

export { ACT, KU, P, READY, SERVE_KEYS, SERVE_U, VAR_FX, mirrorPose, newPose, poseAt, swingKey, swingVar, uOf };
