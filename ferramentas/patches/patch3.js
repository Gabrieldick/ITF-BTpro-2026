const fs = require('fs');
const file = process.argv[2];
let s = fs.readFileSync(file, 'utf8');
function between(startMark, endMark, repl) {
  const a = s.indexOf(startMark); if (a < 0) throw new Error('start not found: ' + startMark);
  const b = s.indexOf(endMark, a + startMark.length); if (b < 0) throw new Error('end not found: ' + endMark);
  s = s.slice(0, a) + repl + s.slice(b);
}
function rep(a, b) { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 80)); s = s.replace(a, b); }

// ---------- CSS ----------
rep('#loading {', `#meter {
  position: fixed; z-index: 7; width: 22px; height: 136px; transform: translate(-50%, -100%); pointer-events: none;
}
#meter .track { position: absolute; inset: 0; border-radius: 11px; background: rgba(15,36,54,.78); border: 2px solid rgba(251,246,234,.7); overflow: hidden; }
#meter .zone { position: absolute; left: 0; right: 0; background: #4FD18B; }
#meter .fill { position: absolute; left: 3px; right: 3px; bottom: 3px; height: 0; border-radius: 7px; background: linear-gradient(0deg, #FFB11F, #fff3c4); }
#meter.in .fill { background: #ffffff; box-shadow: 0 0 12px #4FD18B; }
#meter .res { position: absolute; left: 32px; bottom: 50%; font-family: var(--f-display); font-size: 20px; letter-spacing: .03em; white-space: nowrap; text-shadow: 0 2px 0 var(--ink); }
#meter.perfeito .track { border-color: #4FD18B; box-shadow: 0 0 14px #4FD18B; }
#meter.perfeito .res { color: #7CF0AE; }
#meter.cedo .res { color: #FFD23F; }
#meter.tarde .res { color: #FF7A5C; }
#meter .lbl { position: absolute; left: 50%; top: calc(100% + 6px); transform: translateX(-50%); font-size: 10px; font-weight: 800; letter-spacing: .14em; white-space: nowrap; color: var(--foam); text-shadow: 0 1px 0 var(--ink); }

#loading {`);

// ---------- HTML ----------
rep('<div id="reach">NO ALCANCE</div>', `<div id="reach">NO ALCANCE</div>
<div id="meter" hidden><div class="track"><div class="zone"></div><div class="fill"></div></div><div class="res"></div><div class="lbl">FORÇA</div></div>`);
rep('<li>No 40–40 vale o ponto de ouro: quem fizer leva o game.</li>', '<li>No 40–40 vale o ponto de ouro: quem fizer leva o game.</li>\n      <li>Smash e saque têm barra de força: segure o botão e solte na faixa verde.</li>');
rep('<p>Bola acima da cabeça, golpe forte para baixo. Em bola baixa vira um drive arriscado.</p>', '<p>Segure para armar e solte na faixa verde. Bola alta vira pancada para baixo; bola baixa vira um drive arriscado.</p>');
rep('<p class="keys"><kbd>WASD</kbd>/setas correr', '<p class="keys">Saque: segure qualquer golpe para jogar a bola para cima e solte na faixa verde. <kbd>WASD</kbd>/setas correr');

// ---------- constantes ----------
rep('const SWING_DUR = 0.4;', 'const SWING_DUR = 0.4;\nconst TOSS_T = 0.72;      // tempo do lançamento até o ponto ideal de contato no saque');

// ---------- atletas ----------
between('function makeAthlete(o) {', 'function makePlayer(', `function headGeo(fem) {
  const g = new THREE.SphereGeometry(.1, 28, 20); const pa = g.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    let x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
    const ny = y / .1;
    if (ny < 0) { const k = 1 + ny * (fem ? .2 : .27); x *= k; z *= z < 0 ? 1 - ny * .06 : 1 + ny * .3; }
    if (z > 0) z *= 1.07;
    pa.setXYZ(i, x * .93, y * 1.16, z * 1.04);
  }
  g.computeVertexNormals(); return g;
}
function shirtTex(o) {
  return canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = o.shirt; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { x.fillStyle = Math.random() < .5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)'; x.fillRect(Math.random() * w, Math.random() * h, 2, 1); }
    x.fillStyle = o.trim; x.fillRect(w * .2, 0, w * .06, h); x.fillRect(w * .74, 0, w * .06, h); x.fillRect(0, 0, w, h * .05);
    x.font = 'bold ' + Math.round(h * .24) + 'px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    [0, w].forEach(cx => x.fillText(o.num, cx, h * .4));
  });
}
function shortsTex(o) {
  return canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = o.shorts; x.fillRect(0, 0, w, h);
    x.fillStyle = o.trim; x.fillRect(w * .23, 0, w * .04, h); x.fillRect(w * .73, 0, w * .04, h); x.fillRect(0, h * .9, w, h * .1);
  });
}
const UP_ARM = [[0, .05], [.045, .03], [.05, -.02], [.052, -.08], [.048, -.14], [.042, -.2], [.037, -.26], [0, -.3]];
const FORE_ARM = [[0, .03], [.037, .01], [.04, -.04], [.036, -.12], [.029, -.21], [.025, -.25], [0, -.27]];
const scaleProf = (pr, k) => pr.map(([r, y]) => [r * k, y]);
function makeAthlete(o) {
  const fem = !!o.fem;
  const skinM = mat(o.skin, { roughness: .5, envMapIntensity: .45 });
  const shirtM = mat('#ffffff', { map: shirtTex(o), roughness: .88 });
  const shortM = mat('#ffffff', { map: shortsTex(o), roughness: .9 });
  const hairM = mat(o.hair, { roughness: .65 });
  const trimM = mat(o.trim, { roughness: .8 });
  const root = new THREE.Group();
  const mesh = (g, m, parent, x, y, z) => { const ms = new THREE.Mesh(g, m); ms.castShadow = true; ms.receiveShadow = true; ms.position.set(x || 0, y || 0, z || 0); parent.add(ms); return ms; };
  const hips = new THREE.Group(); hips.position.y = .92; root.add(hips);
  mesh(latheGeo(fem ? [[0, -.09], [.16, -.09], [.186, -.02], [.18, .07], [.15, .14], [0, .145]] : [[0, -.09], [.15, -.09], [.172, -.02], [.17, .08], [.152, .14], [0, .145]], 24, .74), shortM, hips);
  const hipX = fem ? .1 : .092;
  const thighG = latheGeo(fem ? [[0, .06], [.088, .02], [.088, -.06], [.078, -.18], [.064, -.3], [.052, -.4], [0, -.45]] : [[0, .06], [.08, .02], [.083, -.06], [.077, -.18], [.066, -.3], [.054, -.4], [0, -.45]], 16, .95);
  const shinG = latheGeo([[0, .04], [.05, 0], [.056, -.08], [.054, -.15], [.044, -.25], [.033, -.36], [.029, -.42], [0, -.45]], 14, 1);
  shinG.translate(0, 0, .008); if (fem) shinG.scale(.92, 1, .92);
  const legShortG = latheGeo([[0, .03], [.093, .03], [.097, -.07], [.1, -.16], [0, -.16]], 16, 1);
  const legs = [];
  [-1, 1].forEach(s => {
    const thigh = new THREE.Group(); thigh.position.set(s * hipX, -.03, 0); hips.add(thigh);
    mesh(thighG, skinM, thigh); mesh(legShortG, shortM, thigh);
    const knee = new THREE.Group(); knee.position.y = -.42; thigh.add(knee);
    mesh(shinG, skinM, knee);
    const ankle = new THREE.Group(); ankle.position.y = -.43; knee.add(ankle);
    mesh(new THREE.SphereGeometry(.04, 12, 8), skinM, ankle, 0, -.035, .02).scale.set(1, .8, 1.1);
    mesh(new THREE.SphereGeometry(.045, 14, 8), skinM, ankle, 0, -.045, -.07).scale.set(.95, .55, 2.0);
    mesh(new THREE.SphereGeometry(.034, 10, 6), skinM, ankle, 0, -.052, -.16).scale.set(1.15, .5, .8);
    legs.push({ thigh, knee, ankle });
  });
  const spine = new THREE.Group(); spine.position.y = .12; hips.add(spine);
  const torsoProf = fem
    ? [[0, 0], [.14, 0], [.135, .07], [.126, .16], [.136, .25], [.158, .32], [.168, .38], [.17, .43], [.16, .47], [.12, .51], [.07, .54], [.04, .55], [0, .555]]
    : [[0, 0], [.145, 0], [.15, .07], [.152, .16], [.168, .27], [.19, .37], [.2, .43], [.19, .48], [.15, .52], [.09, .55], [.05, .565], [0, .57]];
  mesh(latheGeo(torsoProf, 28, .62), shirtM, spine);
  const shX = fem ? .182 : .205;
  mesh(new THREE.SphereGeometry(1, 18, 10), shirtM, spine, 0, .5, .01).scale.set(shX * .85, .055, .095);
  [-1, 1].forEach(s => mesh(new THREE.SphereGeometry(fem ? .054 : .064, 14, 10), o.tank ? skinM : shirtM, spine, s * shX, .47, 0).scale.set(1, 1.05, .95));
  mesh(new THREE.CylinderGeometry(fem ? .042 : .048, fem ? .05 : .058, .12, 12), skinM, spine, 0, .58, 0);
  const headG = new THREE.Group(); headG.position.y = .62; headG.rotation.order = 'YXZ'; spine.add(headG);
  const hd = new THREE.Group(); hd.scale.setScalar(fem ? .95 : 1); headG.add(hd);
  mesh(headGeo(fem), skinM, hd, 0, .1, 0);
  mesh(new THREE.SphereGeometry(.017, 8, 6), skinM, hd, 0, .092, -.105).scale.set(.8, 1.1, 1.2);
  [-1, 1].forEach(s => mesh(new THREE.SphereGeometry(.022, 8, 6), skinM, hd, s * .092, .1, .005).scale.set(.45, 1, .8));
  if (!o.glasses) {
    const white = mat('#f4f1ea', { roughness: .3 }), iris = mat('#2a1c12', { roughness: .2 }), brow = mat(o.hair, { roughness: .8 });
    [-1, 1].forEach(s => {
      mesh(new THREE.SphereGeometry(.013, 10, 8), white, hd, s * .035, .116, -.083);
      mesh(new THREE.SphereGeometry(.0075, 8, 6), iris, hd, s * .035, .116, -.095);
      mesh(new THREE.BoxGeometry(.032, .006, .01), brow, hd, s * .036, .136, -.092).rotation.z = s * -.12;
    });
  }
  mesh(new THREE.BoxGeometry(.032, .006, .008), mat('#8a4b3c', { roughness: .6 }), hd, 0, .058, -.096);
  const hair = mesh(new THREE.SphereGeometry(.108, 22, 12, 0, Math.PI * 2, 0, Math.PI * (fem ? .62 : .54)), hairM, hd, 0, .118, .01);
  hair.scale.set(1, 1.12, 1.1); hair.rotation.x = .28;
  let tail = null;
  if (fem) {
    tail = new THREE.Group(); tail.position.set(0, .15, .1); hd.add(tail);
    mesh(new THREE.CylinderGeometry(.018, .018, .02, 10), trimM, tail, 0, -.005, 0);
    [[.034, -.045, .02], [.03, -.1, .035], [.024, -.155, .04], [.017, -.2, .04]].forEach(([r, y, z]) => mesh(new THREE.SphereGeometry(r, 10, 8), hairM, tail, 0, y, z).scale.set(1, 1.4, 1));
  }
  if (o.cap) {
    const capM = mat(o.cap, { roughness: .8 });
    mesh(new THREE.SphereGeometry(.112, 20, 10, 0, Math.PI * 2, 0, Math.PI * .45), capM, hd, 0, .13, 0).scale.set(1, 1.05, 1.1);
    mesh(new THREE.CylinderGeometry(.11, .11, .008, 18, 1, false, Math.PI * .5, Math.PI), capM, hd, 0, .165, -.06).scale.set(1, 1, 1.15);
  }
  if (o.visor) {
    const vm = mat(o.visor, { roughness: .7 });
    mesh(new THREE.CylinderGeometry(.106, .106, .035, 20, 1, true), vm, hd, 0, .16, 0).scale.set(.95, 1, 1.12);
    mesh(new THREE.CylinderGeometry(.11, .11, .007, 18, 1, false, Math.PI * .5, Math.PI), vm, hd, 0, .15, -.07).scale.set(1, 1, 1.2);
  }
  if (o.glasses) {
    const gGeo = new THREE.TorusGeometry(.1, .014, 6, 24, Math.PI * .9); gGeo.rotateZ(Math.PI * .05); gGeo.rotateX(-Math.PI / 2);
    const gl = mesh(gGeo, mat('#0b0d10', { roughness: .06, metalness: .7, envMapIntensity: 1.6 }), hd, 0, .118, 0); gl.scale.set(.96, 1.3, 1.08);
  }
  const arms = {};
  const upG = latheGeo(fem ? scaleProf(UP_ARM, .86) : UP_ARM, 14, .92), foreG = latheGeo(fem ? scaleProf(FORE_ARM, .88) : FORE_ARM, 14, .9);
  const sleeveG = latheGeo([[0, .07], [.064, .05], [.066, -.03], [.062, -.11], [0, -.11]], 14, 1);
  [-1, 1].forEach(s => {
    const sh = new THREE.Group(); sh.position.set(s * shX, .47, 0); spine.add(sh);
    mesh(upG, skinM, sh); if (!o.tank) mesh(sleeveG, shirtM, sh);
    const el = new THREE.Group(); el.position.y = -.285; sh.add(el);
    mesh(foreG, skinM, el);
    if (o.band && s > 0) mesh(new THREE.CylinderGeometry(.032, .032, .045, 12), trimM, el, 0, -.23, 0);
    const wrist = new THREE.Group(); wrist.position.y = -.27; el.add(wrist);
    mesh(new THREE.SphereGeometry(.042, 12, 8), skinM, wrist, 0, -.03, 0).scale.set(.72, 1.05, .62);
    arms[s] = { sh, el, wrist };
  });
  const racket = makeRacket(o.racket, o.trim); racket.position.y = .03; arms[1].wrist.add(racket);
  racket.traverse(m => { if (m.isMesh) m.castShadow = true; });
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(.9, .9), new THREE.MeshBasicMaterial({ map: SHADOW_TEX, transparent: true, depthWrite: false, opacity: .45 }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = .012; root.add(blob);
  scene.add(root);
  return { group: root, hips, spine, headG, legs, armR: arms[1], armL: arms[-1], blob, tail };
}

`);

between('function makePlayer(', 'const human   =', `function makePlayer(team, slot, look, isHuman, name) {
  return {
    team, slot, isHuman, name, pos: new V3(), vel: new V3(), model: makeAthlete(look), gait: 0, footDown: [true, true],
    swing: { t: -1, type: 'defesa', hit: false, dur: SWING_DUR, side: 1, meter: null }, inputX: 0, jump: 0, yaw: 0, split: 0,
    charging: false, tossT: 0, headYaw: 0, headPitch: 0, debug: null, pose: newPose(),
    ai: { planId: -1, plan: null, reactT: 0, willMiss: false, letGo: false, shot: 'defesa', swung: false },
  };
}
`);
rep(`const human   = makePlayer(0, 1,  { skin: '#c68a5e', shirt: '#ff5a1f', trim: '#fbf6ea', shorts: '#17324d', hair: '#2b1d14', cap: '#fbf6ea', glasses: true, racket: '#ff5a1f' }, true, 'Você');
const partner = makePlayer(0, -1, { skin: '#e2b48f', shirt: '#ff7a3d', trim: '#17324d', shorts: '#17324d', hair: '#7a4a22', cap: null, glasses: false, racket: '#ffd23f' }, false, 'Parceiro');
const cpuA    = makePlayer(1, 1,  { skin: '#8d5a3b', shirt: '#0b7a83', trim: '#fbf6ea', shorts: '#f2efe6', hair: '#120c08', cap: '#17324d', glasses: true, racket: '#0b7a83' }, false, 'CPU');
const cpuB    = makePlayer(1, -1, { skin: '#b07a52', shirt: '#13939c', trim: '#ffd23f', shorts: '#f2efe6', hair: '#3a2615', cap: null, glasses: true, racket: '#1f4fb8' }, false, 'CPU 2');`,
`const human   = makePlayer(0, 1,  { skin: '#c68a5e', shirt: '#ff5a1f', trim: '#fbf6ea', shorts: '#17324d', hair: '#2b1d14', cap: '#fbf6ea', glasses: true, racket: '#ff5a1f', num: '7', band: true }, true, 'Você');
const partner = makePlayer(0, -1, { skin: '#e2b48f', shirt: '#ff7a3d', trim: '#17324d', shorts: '#17324d', hair: '#6a3f1d', visor: '#fbf6ea', glasses: false, racket: '#ffd23f', num: '11', fem: true, tank: true }, false, 'Parceira');
const cpuA    = makePlayer(1, 1,  { skin: '#8d5a3b', shirt: '#0b7a83', trim: '#fbf6ea', shorts: '#f2efe6', hair: '#120c08', cap: '#17324d', glasses: true, racket: '#0b7a83', num: '3', band: true }, false, 'CPU');
const cpuB    = makePlayer(1, -1, { skin: '#b07a52', shirt: '#13939c', trim: '#ffd23f', shorts: '#f2efe6', hair: '#2a1a0e', visor: '#17324d', glasses: false, racket: '#1f4fb8', num: '9', fem: true, tank: true }, false, 'CPU 2');`);
// pose helpers precisam existir antes dos jogadores
rep('// ---------- Atletas ----------', `// ---------- Poses ----------
const P = o => Object.assign({ rh: [.17, .36, -.36], rp: [.9, -.6, .3], wx: .35, wr: 0, lh: [-.03, .34, -.37], lp: [-.9, -.6, .2], tw: 0, lean: .22, bend: 0, crouch: .12, lunge: 0 }, o);
function newPose() { return P({}); }
const READY = P({});
// quadros-chave em u = 0, .3 (armado), .45 (contato), .75 (terminação), 1
const KU = [0, .3, .45, .75, 1];
const ACT = {
  smash: [READY,
    P({ rh: [.3, .66, .22], rp: [.7, .9, .2], wx: -1.0, lh: [-.08, 1.02, -.32], lp: [-.6, 0, .6], tw: -.75, lean: -.25, bend: -.1, crouch: .18 }),
    P({ rh: [.14, 1.0, -.26], rp: [.6, .2, .7], wx: .1, lh: [-.22, .32, -.18], lp: [-.8, -.3, .3], tw: .05, lean: -.05, bend: -.05, crouch: .05 }),
    P({ rh: [-.18, .12, -.32], rp: [.7, .3, -.2], wx: .45, lh: [-.26, .28, .02], lp: [-.8, -.5, 0], tw: .6, lean: .5, bend: .05, crouch: .2 }),
    READY],
  lob: [READY,
    P({ rh: [.42, .04, .14], rp: [.8, 0, .5], wx: .7, wr: .3, lh: [-.15, .3, -.3], lp: [-.9, -.4, 0], tw: -.55, lean: .4, crouch: .26 }),
    P({ rh: [.3, .2, -.46], rp: [.9, -.3, .2], wx: 1.0, wr: .3, lh: [-.2, .32, -.25], lp: [-.9, -.4, 0], tw: -.1, lean: .35, crouch: .24 }),
    P({ rh: [.14, .9, -.38], rp: [.8, -.2, .1], wx: .2, wr: .1, lh: [-.25, .4, -.1], lp: [-.9, -.4, 0], tw: .35, lean: .1, crouch: .1 }),
    READY],
  curta: [READY,
    P({ rh: [.32, .42, -.18], rp: [.9, -.4, .3], wx: -.1, wr: .2, lh: [-.1, .33, -.34], tw: -.3, lean: .3, crouch: .18 }),
    P({ rh: [.22, .36, -.52], rp: [.9, -.5, .2], wx: .6, wr: .4, lh: [-.12, .33, -.3], tw: -.05, lean: .32, crouch: .24 }),
    P({ rh: [.18, .34, -.56], rp: [.9, -.5, .2], wx: .75, wr: .4, lh: [-.15, .33, -.25], tw: .1, lean: .3, crouch: .22 }),
    READY],
  defesa: [READY,
    P({ rh: [.46, .24, -.16], rp: [.6, -.8, .2], wx: .2, wr: .5, lh: [-.1, .3, -.3], lp: [-.9, -.5, 0], tw: -.35, lean: .45, bend: .2, crouch: .3, lunge: 1 }),
    P({ rh: [.56, .2, -.36], rp: [.6, -.8, .1], wx: .4, wr: .6, lh: [-.15, .3, -.25], lp: [-.9, -.5, 0], tw: -.1, lean: .5, bend: .25, crouch: .32, lunge: 1 }),
    P({ rh: [.48, .26, -.44], rp: [.6, -.8, .1], wx: .45, wr: .6, lh: [-.15, .3, -.25], lp: [-.9, -.5, 0], tw: .05, lean: .45, bend: .2, crouch: .3, lunge: 1 }),
    READY],
};
// saque: bola na mão, lançamento, posição de troféu
const SERVE_U = [0, .35, .75, 1];
const SERVE_KEYS = [
  P({ rh: [.2, .3, -.28], rp: [.9, -.5, .3], wx: .3, lh: [.04, .34, -.36], tw: -.2, lean: .1, crouch: .06 }),
  P({ rh: [.32, .42, .12], rp: [.8, -.2, .5], wx: -.3, lh: [.12, .98, -.42], lp: [-.9, 0, .3], tw: -.5, lean: 0, crouch: .12 }),
  P({ rh: [.3, .66, .22], rp: [.7, .9, .2], wx: -1.0, lh: [.1, 1.02, -.38], lp: [-.9, 0, .3], tw: -.75, lean: -.25, bend: -.1, crouch: .26 }),
  P({ rh: [.28, .7, .18], rp: [.7, .9, .2], wx: -1.0, lh: [0, .8, -.38], lp: [-.9, 0, .3], tw: -.6, lean: -.2, bend: -.1, crouch: .18 }),
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

// ---------- Atletas ----------`);

// ---------- barra de força ----------
between('function pressShot(type) {', 'const SHOT_KEYS', `const MTR = { active: false, kind: null, type: null, t: 0, fill: .75, center: .78, half: .068, armedTap: false, showT: 0 };
const ZONE = { facil: .095, medio: .068, dificil: .048 };
const RES_WORD = { perfeito: 'PERFEITO', cedo: 'CEDO', tarde: 'TARDE' };
function startMeter(kind, type) {
  Object.assign(MTR, { active: true, kind, type, t: 0, armedTap: false, showT: 0 });
  const half = ZONE[S.settings.diff];
  if (kind === 'smash') { MTR.fill = .75; MTR.center = .78; MTR.half = half; human.charging = true; }
  else { MTR.fill = .9; MTR.center = TOSS_T / .9; MTR.half = half * ({ defesa: 1.5, lob: 1.3, curta: 1.2, smash: 1 }[type] || 1); }
  el.meter.className = ''; el.meter.hidden = false; el.mRes.textContent = '';
  el.mLbl.textContent = kind === 'smash' ? 'SMASH' : 'SAQUE';
  el.mZone.style.bottom = ((MTR.center - MTR.half) * 100) + '%';
  el.mZone.style.height = (MTR.half * 200) + '%';
  el.mFill.style.height = '0%';
}
function cancelMeter() { MTR.active = false; human.charging = false; el.meter.hidden = true; }
function releaseMeter() {
  if (!MTR.active) return;
  const v = MTR.t / MTR.fill, diff = v - MTR.center;
  const res = Math.abs(diff) <= MTR.half ? 'perfeito' : diff < 0 ? 'cedo' : 'tarde';
  const amt = clamp((Math.abs(diff) - MTR.half) / .3, 0, 1);
  MTR.active = false; MTR.showT = .9;
  el.meter.className = res; el.mRes.textContent = RES_WORD[res];
  el.mFill.style.height = (clamp(v, 0, 1) * 100) + '%';
  if (MTR.kind === 'smash') {
    human.charging = false;
    const sw = human.swing; sw.t = sw.dur * .3; sw.type = 'smash'; sw.hit = false; sw.meter = { res, amt };
  } else serveRelease(res, amt);
}
function serveRelease(res, amt) {
  if (S.mode !== 'toss' || S.serverPlayer !== human) return;
  const type = S.serveType; let q, mod;
  if (res === 'perfeito') { q = 1; mod = { speedMul: type === 'smash' ? 1.15 : 1, oppMissBoost: type === 'smash' ? .12 : .04 }; }
  else if (res === 'cedo') { q = .7 - .25 * amt; mod = { speedMul: .88 - .1 * amt }; }
  else { q = .5 - .25 * amt; mod = { misBoost: (type === 'smash' ? .3 : .12) + .3 * amt }; }
  ball.state = 'live'; S.mode = 'rally';
  const r = doHit(human, type, q, true, mod);
  feedback(r.label, r.mis ? 'ERROU' : RES_WORD[res], null);
}
function pressShot(type) {
  ac();
  const b = shotBtns[type]; if (b) b.classList.add('press');
  if (S.paused) return;
  if (MTR.active && MTR.kind === 'serve' && MTR.armedTap) { releaseMeter(); return; }
  if (S.mode === 'serve' && S.serverPlayer === human) { startToss(human, type); startMeter('serve', type); return; }
  if (S.mode === 'rally' || S.mode === 'toss') {
    if (MTR.active && MTR.kind === 'smash') cancelMeter();
    const sw = human.swing;
    if (sw.t >= 0 && sw.t < sw.dur * .8) return;
    if (type === 'smash' && S.mode === 'rally') { sw.t = -1; startMeter('smash', 'smash'); return; }
    sw.t = 0; sw.type = type; sw.hit = false; sw.meter = null;
    sw.side = sideOf(human, humanPlan.id === S.hitId && humanPlan.plan ? humanPlan.plan.pt : null);
  }
}
function releaseShot(type) {
  const b = shotBtns[type]; if (b) b.classList.remove('press');
  if (!MTR.active) return;
  if (MTR.kind === 'serve') { if (MTR.t < .15) { MTR.armedTap = true; return; } releaseMeter(); }
  else if (type === 'smash') releaseMeter();
}
`);
rep("addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });", "addEventListener('keyup', e => { const k = e.key.toLowerCase(); keys[k] = false; if (SHOT_KEYS[k]) releaseShot(SHOT_KEYS[k]); });");
rep("  b.addEventListener('pointerdown', e => { e.preventDefault(); pressShot(type); });", "  b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (er) {} pressShot(type); });\n  ['pointerup', 'pointercancel'].forEach(ev => b.addEventListener(ev, e => { e.preventDefault(); releaseShot(type); }));");
rep("  rowP: $('rowP'),", "  meter: $('meter'), mFill: document.querySelector('#meter .fill'), mZone: document.querySelector('#meter .zone'), mRes: document.querySelector('#meter .res'), mLbl: document.querySelector('#meter .lbl'),\n  rowP: $('rowP'),");

// ---------- saque: lançamento sai da mão esquerda ----------
between('function startToss(p, type) {', '// ---------- Controles ----------', `function handPos(p, out) {
  p.model.armL.wrist.getWorldPosition(out);
  const f = p.team === 0 ? 1 : -1;
  if (!isFinite(out.x) || out.y < .3) out.set(p.pos.x + .05 * f, 1.25, p.pos.z - .35 * f);
  return out;
}
function startToss(p, type) {
  S.mode = 'toss'; S.serveType = type; ball.state = 'toss'; p.tossT = 0;
  const f = p.team === 0 ? 1 : -1;
  handPos(p, ball.pos);
  const cx = p.pos.x + .22 * f, cz = p.pos.z - .38 * f, cy = 2.45;
  ball.vel.set((cx - ball.pos.x) / TOSS_T, (cy - ball.pos.y + .5 * G * TOSS_T * TOSS_T) / TOSS_T, (cz - ball.pos.z) / TOSS_T);
  hideBanner();
}

`);
rep(`function placeHeldBall() {
  const p = S.serverPlayer || human; const f = p.team === 0 ? 1 : -1;
  ball.pos.set(p.pos.x - .22 * f, 1.0, p.pos.z - .2 * f);
}`, `function placeHeldBall() { handPos(S.serverPlayer || human, ball.pos); }`);

// ---------- doHit com modificadores ----------
rep('function doHit(p, type, q, isServe) {', 'function doHit(p, type, q, isServe, mod) {\n  mod = mod || {};');
rep('  const spec = isServe ? SERVES[type] : SHOTS[key];\n  const dir = p.team === 0 ? -1 : 1;\n  const lim = C.halfW - .35;',
`  const spec = Object.assign({}, isServe ? SERVES[type] : SHOTS[key]);
  if (spec.speed) spec.speed *= mod.speedMul || 1;
  if (spec.T) spec.T /= mod.speedMul || 1;
  spec.noise *= mod.noiseMul || 1;
  const dir = p.team === 0 ? -1 : 1;
  const lim = C.halfW - .35;`);
rep('  if (unforced || (q < .4 && Math.random() < (.4 - q) * 2.2)) {', '  if (unforced || (mod.misBoost && Math.random() < mod.misBoost) || (q < .4 && Math.random() < (.4 - q) * 2.2)) {');
rep('  ball.vel.copy(v); ball.state = \'live\';\n  S.lastTeam = p.team;', '  ball.vel.copy(v); ball.state = \'live\'; ball.oppMiss = mod.oppMissBoost || 0;\n  S.lastTeam = p.team;');
rep('  teams[1 - p.team].forEach(o => { o.ai.reactT = skillOf(o).react; });\n  p.swing.type = type; p.swing.hit = true;\n  if (p.swing.t < 0 || p.swing.t < p.swing.dur * .45) p.swing.t = p.swing.dur * .45;',
`  teams[1 - p.team].forEach(o => { o.ai.reactT = skillOf(o).react; o.split = .22; });
  p.swing.type = isServe ? 'smash' : type; p.swing.hit = true;
  const hitAt = isServe ? .3 : .45;
  if (p.swing.t < 0 || p.swing.t < p.swing.dur * hitAt) p.swing.t = p.swing.dur * hitAt;`);

// ---------- golpe do jogador ----------
rep(`    if (!sw.hit && S.mode === 'rally' && sw.t <= sw.dur * .8 && canHit(p, sw.type)) {
      const q = hitQuality(p, sw.type);
      const r = doHit(p, sw.type, q, false);
      feedback(r.label, r.mis ? 'ERROU A MÃO' : qualityWord(q), null);
    }
    sw.t += dt; if (sw.t >= sw.dur) sw.t = -1;`,
`    if (!sw.hit && S.mode === 'rally' && sw.t <= sw.dur * (sw.meter ? .9 : .8) && canHit(p, sw.type)) {
      let q = hitQuality(p, sw.type), mod = {};
      if (sw.meter) {
        const { res, amt } = sw.meter;
        if (res === 'perfeito') { q = Math.max(q, .9); mod = { speedMul: 1.22, noiseMul: .6, oppMissBoost: .22 }; }
        else if (res === 'cedo') mod = { speedMul: .85 - .3 * amt };
        else mod = { speedMul: 1.08, noiseMul: 1.8, misBoost: .25 + .4 * amt };
      }
      const r = doHit(p, sw.type, q, false, mod);
      feedback(r.label, r.mis ? 'ERROU A MÃO' : sw.meter ? RES_WORD[sw.meter.res] : qualityWord(q), null);
    }
    sw.t += dt; if (sw.t >= sw.dur) { sw.t = -1; sw.meter = null; }`);
rep('  let tvx = ix * P_SPEED, tvz = iz * P_SPEED;\n  const serving', '  const spd = P_SPEED * (p.charging ? .75 : 1);\n  let tvx = ix * spd, tvz = iz * spd;\n  const serving');

// ---------- CPU: escolhe o golpe cedo e arma o braço ----------
rep('function chooseAIShot(p) {\n  const y = ball.pos.y, r = Math.random();', 'function chooseAIShot(p, y) {\n  const r = Math.random();');
rep(`        p.ai.willMiss = Math.random() < D.miss * (fast ? 2 : 1);`, `        p.ai.willMiss = Math.random() < D.miss * (fast ? 2 : 1) + (ball.oppMiss || 0);
        p.ai.shot = chooseAIShot(p, p.ai.plan ? p.ai.plan.pt.y : ball.pos.y);
        p.ai.swung = false;`);
rep(`        const prev = ball.pos.y >= 2.1 ? 'smash' : 'defesa';
        if (canHit(p, prev, .9)) {
          if (p.ai.willMiss) { if (p.swing.t < 0) { p.swing.t = 0; p.swing.type = prev; p.swing.hit = true; } p.ai.letGo = true; }
          else {
            const shot = chooseAIShot(p);
            const r = doHit(p, shot, rand(D.q[0], D.q[1]), false);
            feedback(whoTag(p) + r.label, null, whoKind(p));
          }
        }`, `        const shot = p.ai.shot;
        // arma o golpe quando a bola se aproxima
        if (!p.ai.swung && p.swing.t < 0 && Math.hypot(ball.pos.x - p.pos.x, ball.pos.z - p.pos.z) < 2.6 && ball.pos.y < 3.4) {
          p.ai.swung = true; p.swing.t = 0; p.swing.type = shot; p.swing.hit = false; p.swing.side = sideOf(p, p.ai.plan ? p.ai.plan.pt : null);
        }
        if (canHit(p, shot === 'smash' && ball.pos.y >= 1.9 ? 'smash' : 'defesa', .9)) {
          if (p.ai.willMiss) { p.swing.hit = true; p.ai.letGo = true; }
          else {
            const r = doHit(p, shot, rand(D.q[0], D.q[1]), false);
            feedback(whoTag(p) + r.label, null, whoKind(p));
          }
        }`);
rep("  if (p.swing.t >= 0) { p.swing.t += dt; if (p.swing.t >= p.swing.dur) p.swing.t = -1; }\n}\n\n// ---------- Bola ----------",
"  if (p.swing.t >= 0) {\n    p.swing.t += dt;\n    if (!p.swing.hit && p.swing.t > p.swing.dur * .3) p.swing.t = p.swing.dur * .3; // segura armado até a bola chegar\n    if (p.swing.t >= p.swing.dur) p.swing.t = -1;\n  }\n}\n\n// ---------- Bola ----------");

// ---------- bola: só a CPU saca sozinha ----------
rep(`    if (ball.vel.y < 0 && ball.pos.y <= 2.2) {
      const p = S.serverPlayer; const D = skillOf(p);
      let q;
      if (p.isHuman) q = S.serveType === 'smash' ? rand(.35, 1) : rand(.72, 1);
      else q = S.serveType === 'smash' ? rand(D.q[0] - .15, D.q[1]) : rand(D.q[0], 1);`, `    if (!S.serverPlayer.isHuman && ball.vel.y < 0 && ball.pos.y <= 2.45) {
      const p = S.serverPlayer; const D = skillOf(p);
      const q = S.serveType === 'smash' ? rand(D.q[0] - .15, D.q[1]) : rand(D.q[0], 1);`);
rep('function step(dt) {\n  updateHuman(dt);', `function step(dt) {
  if (S.mode === 'toss' && S.serverPlayer) S.serverPlayer.tossT += dt;
  if (MTR.active) {
    MTR.t += dt; const v = MTR.t / MTR.fill;
    if (MTR.kind === 'smash' && S.mode !== 'rally') cancelMeter();
    else if (MTR.kind === 'smash' && v >= 1.15) releaseMeter();
    else if (MTR.kind === 'serve' && S.mode !== 'toss') cancelMeter();
    else if (MTR.kind === 'serve' && ball.vel.y < 0 && ball.pos.y < 1.75) releaseMeter();
  } else if (MTR.showT > 0) { MTR.showT -= dt; if (MTR.showT <= 0) el.meter.hidden = true; }
  updateHuman(dt);`);
rep("  players.forEach(p => { p.vel.set(0, 0, 0); p.swing.t = -1; p.jump = 0; p.ai.planId = -1; p.ai.reactT = 0; p.ai.letGo = false; });",
"  players.forEach(p => { p.vel.set(0, 0, 0); p.swing.t = -1; p.swing.meter = null; p.jump = 0; p.charging = false; p.ai.planId = -1; p.ai.reactT = 0; p.ai.letGo = false; p.ai.swung = false; });\n  MTR.active = false; el.meter.hidden = true;");
rep("banner(gold ? 'Ponto de ouro' : 'Seu saque', isTouch() ? 'Toque em um golpe para sacar. Um saque só.' : 'Escolha o golpe: J smash · K lob · L curta · Espaço defesa. Um saque só.', 0, gold);",
"banner(gold ? 'Ponto de ouro' : 'Seu saque', isTouch() ? 'Segure um golpe para lançar a bola e solte na faixa verde.' : 'Segure J forte · K alto · L curto · Espaço seguro e solte na faixa verde.', 0, gold);");
rep("banner(gold ? 'Ponto de ouro' : 'Saque do seu parceiro'", "banner(gold ? 'Ponto de ouro' : 'Saque da sua parceira'");
rep("const whoTag = p => p.isHuman ? '' : p.team === 0 ? 'PARCEIRO · ' : 'CPU · ';", "const whoTag = p => p.isHuman ? '' : p.team === 0 ? 'PARCEIRA · ' : 'CPU · ';");
rep("el.reach.textContent = showMate ? 'BOLA DO PARCEIRO'", "el.reach.textContent = showMate ? 'BOLA DA PARCEIRA'");
rep("Você cobre a metade direita e seu parceiro a esquerda.", "Você cobre a metade direita e sua parceira a esquerda.");
rep("dupla com um parceiro controlado pelo computador", "dupla mista com uma parceira controlada pelo computador");

// ---------- animação ----------
between('// ---------- Animação ----------', 'const camPos = new V3(', `// ---------- Animação: cinemática inversa em braços e pernas ----------
const _id = new V3(), _iu = new V3(), _iw = new V3(), _in = new V3(), _iX = new V3(), _iY = new V3(), _iZ = new V3(), _im = new THREE.Matrix4();
function ik2(upper, lower, origin, target, pole, L1, L2) {
  _id.subVectors(target, origin);
  const dist = clamp(_id.length(), .05, L1 + L2 - .002);
  _id.normalize();
  const a1 = Math.acos(clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1));
  const bend = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - dist * dist) / (2 * L1 * L2), -1, 1));
  _in.crossVectors(_id, pole); if (_in.lengthSq() < 1e-8) _in.set(1, 0, 0); _in.normalize();
  _iw.crossVectors(_in, _id).normalize();
  _iu.copy(_id).multiplyScalar(Math.cos(a1)).addScaledVector(_iw, Math.sin(a1));
  _iZ.copy(_id).addScaledVector(_iu, -_id.dot(_iu));
  if (_iZ.lengthSq() < 1e-8) _iZ.copy(_iw).negate();
  _iZ.normalize().negate();
  _iY.copy(_iu).negate();
  _iX.crossVectors(_iY, _iZ).normalize();
  _iZ.crossVectors(_iX, _iY);
  _im.makeBasis(_iX, _iY, _iZ);
  upper.quaternion.setFromRotationMatrix(_im);
  lower.rotation.set(bend, 0, 0);
}
function sideOf(p, pt) { const q = pt || ball.pos; return (q.x - p.pos.x) * (p.team === 0 ? 1 : -1); }
const _a = new V3(), _b = new V3(), _c = new V3(), _e = new V3(), _g = new V3(), _q1 = new THREE.Quaternion();
const READY_KEYS = [READY, READY], READY_U = [0, 1];
function animateAthlete(p, dt) {
  const m = p.model, pose = p.pose;
  const sp = Math.hypot(p.vel.x, p.vel.z), run = clamp(sp / 5, 0, 1);
  let mirror = false, swingU = -1;
  if (p.debug) {
    if (p.debug.type === 'serve') poseAt(SERVE_KEYS, SERVE_U, p.debug.u, pose);
    else { swingU = p.debug.u; poseAt(ACT[p.debug.type], KU, swingU, pose); mirror = p.debug.type === 'defesa' && p.debug.side < 0; }
  } else if (S.mode === 'toss' && S.serverPlayer === p) poseAt(SERVE_KEYS, SERVE_U, clamp(p.tossT / TOSS_T, 0, 1), pose);
  else if (p.charging) poseAt(ACT.smash, KU, .3 * clamp(MTR.t / .18, 0, 1), pose);
  else if (p.swing.t >= 0) { swingU = clamp(p.swing.t / p.swing.dur, 0, 1); poseAt(ACT[p.swing.type], KU, swingU, pose); mirror = p.swing.type === 'defesa' && p.swing.side < -.15; }
  else poseAt(READY_KEYS, READY_U, 0, pose);
  if (mirror) mirrorPose(pose);
  // tronco e quadril
  const f = p.team === 0 ? 1 : -1;
  let yawT = clamp(-p.vel.x * f * .05, -.3, .3);
  if (ball.state === 'live') yawT += clamp(Math.atan2(-sideOf(p), Math.abs(ball.pos.z - p.pos.z) + 1.2) * .45, -.45, .45);
  p.yaw += (yawT - p.yaw) * Math.min(1, dt * 6);
  const yaw = (p.team === 0 ? 0 : Math.PI) + p.yaw;
  m.group.rotation.y = yaw;
  if (p.jump > 0) p.jump = Math.max(0, p.jump - dt);
  if (p.split > 0) p.split = Math.max(0, p.split - dt);
  const jy = Math.sin(Math.min(1, p.jump / .35) * Math.PI) * .32 + (p.split > 0 ? Math.sin(Math.PI * (1 - p.split / .22)) * .06 : 0);
  m.group.position.set(p.pos.x, jy, p.pos.z);
  if (sp > .25) p.gait += dt * Math.PI * 2 * (1.35 + sp * .3);
  const crouch = pose.crouch * (1 - run * .35) + (p.split > 0 ? .04 : 0);
  const lungeA = Math.abs(pose.lunge), lungeS = Math.sign(pose.lunge) || 1;
  m.hips.position.set(lungeS * .2 * lungeA, .92 - crouch - .08 * lungeA + run * .025 * Math.cos(2 * p.gait), -.05 * lungeA);
  m.spine.rotation.set(-(pose.lean + run * .1), pose.tw, -pose.bend);
  m.group.updateMatrixWorld(true);
  // pernas: pés presos na areia
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  let lvx = cy * p.vel.x - sy * p.vel.z, lvz = sy * p.vel.x + cy * p.vel.z;
  const fwd = -lvz;
  const lv = Math.hypot(lvx, lvz) || 1; lvx /= lv; lvz /= lv;
  const stride = clamp(sp * .1, 0, .5);
  const air = jy > .05;
  for (let i = 0; i < 2; i++) {
    const s = i ? 1 : -1, L = m.legs[i];
    let fx = s * .17, fz = 0;
    if (lungeA > .01) { if (s === lungeS) { fx = s * (.19 + .55 * lungeA); fz = -.28 * lungeA; } else fz = .12 * lungeA; }
    const ph = p.gait + (i ? Math.PI : 0);
    let lift = 0;
    if (sp > .25) { fx += lvx * stride * Math.cos(ph); fz += lvz * stride * Math.cos(ph); lift = Math.max(0, -Math.sin(ph)) * (.05 + sp * .02) * run; }
    let fy = .07 + lift;
    if (air) { fy += .1 + (s > 0 ? .12 : 0); fz += s > 0 ? .2 : -.12; }
    const grounded = lift < .005 && !air;
    if (grounded && !p.footDown[i] && sp > 1.2 && m.group.visible) {
      const wx = p.pos.x + cy * fx + sy * fz, wz = p.pos.z - sy * fx + cy * fz;
      stamp(wx, wz, yaw);
      if (sp > 3.5 && particles.visible) puff(wx, wz, 2, .35);
    }
    p.footDown[i] = grounded;
    _a.set(fx - m.hips.position.x, fy - m.hips.position.y, fz - m.hips.position.z);
    _b.set(s * .12, 0, -1);
    ik2(L.thigh, L.knee, L.thigh.position, _a, _b, .42, .43);
    _q1.copy(L.thigh.quaternion).multiply(L.knee.quaternion).invert();
    L.ankle.quaternion.copy(_q1);
  }
  // braços
  const shR = m.armR.sh.position, shL = m.armL.sh.position;
  _c.fromArray(pose.rh);
  if (swingU >= 0 && ball.state !== 'held') {
    const w = clamp(1 - Math.abs(swingU - .45) / .18, 0, 1) * .75;
    if (w > 0) {
      _e.copy(ball.pos); m.spine.worldToLocal(_e);
      if (_e.distanceTo(shR) < 1.5) { _g.copy(_e).sub(shR).normalize(); _e.addScaledVector(_g, -.34); _c.lerp(_e, w); }
    }
  }
  _b.fromArray(pose.rp);
  ik2(m.armR.sh, m.armR.el, shR, _c, _b, .285, .27);
  m.armR.wrist.rotation.set(pose.wx, pose.wr, 0);
  _c.fromArray(pose.lh); _b.fromArray(pose.lp);
  if (swingU < 0 && !p.charging && run > .3) _c.y += Math.sin(p.gait) * .04 * run;
  ik2(m.armL.sh, m.armL.el, shL, _c, _b, .285, .27);
  m.armL.wrist.rotation.set(.2, 0, 0);
  // cabeça acompanha a bola
  if (ball.state !== 'held' || S.serverPlayer === p) {
    _e.copy(ball.pos); m.spine.worldToLocal(_e); _e.y -= .72;
    const hy = clamp(Math.atan2(-_e.x, -_e.z), -1.1, 1.1);
    const hp = clamp(Math.atan2(_e.y, Math.hypot(_e.x, _e.z)), -.5, .85);
    p.headYaw += (hy - p.headYaw) * Math.min(1, dt * 8); p.headPitch += (hp - p.headPitch) * Math.min(1, dt * 8);
  } else { p.headYaw *= .9; p.headPitch *= .9; }
  m.headG.rotation.set(p.headPitch, p.headYaw, 0);
  if (m.tail) {
    m.tail.rotation.x += (-(.25 + clamp(fwd * .06, -.2, .5) + jy * 1.5) - m.tail.rotation.x) * Math.min(1, dt * 5);
    m.tail.rotation.z += (clamp(lvx * sp * .05, -.4, .4) - m.tail.rotation.z) * Math.min(1, dt * 5);
  }
  m.blob.position.y = .012 - jy; const bs = 1 - jy; m.blob.scale.set(bs, bs, 1);
}
// braço em primeira pessoa usa rotações simples
const FPKF = {
  smash:  { sh: [.5, 3.0, 3.3, 1.0, .5],  ph: [.2, .35, .2, .1, .2],   tw: [0, -.6, -.4, .5, 0] },
  lob:    { sh: [.5, -.5, -.4, 2.4, .5],  ph: [.2, .5, .5, .2, .2],    tw: [0, -.6, -.6, .4, 0] },
  curta:  { sh: [.5, .2, .3, 1.2, .5],    ph: [.2, .5, .5, .3, .2],    tw: [0, -.3, -.3, .15, 0] },
  defesa: { sh: [.5, 1.0, 1.1, 1.5, .5],  ph: [.2, 1.0, 1.0, .5, .2],  tw: [0, -.8, -.8, .2, 0] },
};
function kf(arr, u, rest) {
  for (let i = 0; i < 4; i++) {
    if (u <= KU[i + 1]) {
      let t = (u - KU[i]) / (KU[i + 1] - KU[i]); t = t * t * (3 - 2 * t);
      const a = i === 0 ? rest : arr[i];
      const b = i === 3 ? rest : arr[i + 1];
      return lerp(a, b, t);
    }
  }
  return rest;
}
function animateFP() {
  const p = human; let th = 1.4, ph = .1, ry = -.3;
  if (p.charging) th = lerp(1.4, 3.0, clamp(MTR.t / .18, 0, 1));
  else if (S.mode === 'toss' && S.serverPlayer === p) th = lerp(1.4, 3.0, clamp(p.tossT / TOSS_T / .75, 0, 1));
  else if (p.swing.t >= 0) { const u = clamp(p.swing.t / p.swing.dur, 0, 1); const k = FPKF[p.swing.type]; th = kf(k.sh, u, 1.4); ph = kf(k.ph, u, .1) * .6; ry = -.3 + kf(k.tw, u, 0) * .5; }
  fpArm.rotation.set(th, ry, ph);
}

`);
// medidor acompanha o jogador na tela
rep("function updateVisuals(dt) {", `const _mv = new V3();
function placeMeter(fp) {
  if (el.meter.hidden) return;
  let mx, my;
  if (fp) { mx = innerWidth * .63; my = innerHeight * .64; }
  else {
    _mv.set(human.pos.x, 2.25 + human.model.group.position.y, human.pos.z).project(camera);
    mx = (_mv.x * .5 + .5) * innerWidth + 48; my = (-_mv.y * .5 + .5) * innerHeight;
  }
  el.meter.style.left = clamp(mx, 30, innerWidth - 120) + 'px';
  el.meter.style.top = clamp(my, 150, innerHeight - 40) + 'px';
  if (MTR.active) {
    const v = MTR.t / MTR.fill;
    el.mFill.style.height = (clamp(v, 0, 1) * 100) + '%';
    el.meter.classList.toggle('in', Math.abs(v - MTR.center) <= MTR.half);
  }
}
function updateVisuals(dt) {`);
rep("  const serveMine = S.mode === 'serve' && S.serverPlayer === human;", "  placeMeter(fp);\n  if (ball.state === 'held') placeHeldBall();\n  const serveMine = S.mode === 'serve' && S.serverPlayer === human;");
rep("  shotBtns.smash.classList.toggle('ready', serveMine || (ready && high));", "  shotBtns.smash.classList.toggle('ready', serveMine || (ready && high) || human.charging);");

fs.writeFileSync(file, s);
console.log('ok');
