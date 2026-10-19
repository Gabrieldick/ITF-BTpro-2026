const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };
const repAll = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.split(a).join(b); };

// smash: troféu de lado → raquete cai atrás das costas → extensão total na frente do ombro → pronação cruzando o corpo
rep(`  smash: [READY,
    P({ rh: [.3, .66, .22], rp: [.7, .9, .2], wx: -1.0, lh: [-.08, 1.02, -.32], lp: [-.6, 0, .6], tw: -.75, lean: -.25, bend: -.1, crouch: .18 }),
    P({ rh: [.14, 1.0, -.26], rp: [.6, .2, .7], wx: .1, lh: [-.22, .32, -.18], lp: [-.8, -.3, .3], tw: .05, lean: -.05, bend: -.05, crouch: .05 }),
    P({ rh: [-.18, .12, -.32], rp: [.7, .3, -.2], wx: .45, lh: [-.26, .28, .02], lp: [-.8, -.5, 0], tw: .6, lean: .5, bend: .05, crouch: .2 }),
    READY],`, `  smash: [READY,
    P({ rh: [.32, .68, .18], rp: [.8, .9, .1], wx: -.5, lh: [-.05, 1.05, -.32], lp: [-.6, 0, .6], tw: -.85, lean: -.28, bend: -.12, crouch: .2 }),
    P({ rh: [.3, .52, .26], rp: [.6, 1.0, .3], wx: -1.4, lh: [-.12, .85, -.3], lp: [-.6, 0, .6], tw: -.7, lean: -.3, bend: -.1, crouch: .1 }),
    P({ rh: [.16, 1.02, -.28], rp: [.5, .3, .7], wx: .25, wr: .3, lh: [-.2, .4, -.15], lp: [-.8, -.3, .3], tw: .1, lean: -.02, bend: -.05, crouch: .04 }),
    P({ rh: [-.22, .05, -.28], rp: [.7, .2, -.3], wx: .5, wr: .9, lh: [-.25, .25, .05], lp: [-.8, -.5, 0], tw: .7, lean: .55, bend: .05, crouch: .25 }),
    READY],`);
rep("const KU = [0, .3, .45, .75, 1];", "const KU = [0, .3, .45, .75, 1];\nconst SMASH_U = [0, .3, .37, .45, .72, 1]; // o smash tem uma fase extra: a raquete cai atrás das costas\nconst uOf = t => t === 'smash' ? SMASH_U : KU;");
rep("poseAt(ACT[p.debug.type], KU, swingU, pose)", "poseAt(ACT[p.debug.type], uOf(p.debug.type), swingU, pose)");
rep("poseAt(ACT[MTR.type === 'lob' ? 'lob' : 'smash'], KU, .3 * clamp(MTR.t / .18, 0, 1), pose)", "poseAt(ACT[MTR.type === 'lob' ? 'lob' : 'smash'], uOf(MTR.type === 'lob' ? 'lob' : 'smash'), .3 * clamp(MTR.t / .18, 0, 1), pose)");
rep("poseAt(ACT[p.swing.type], KU, swingU, pose)", "poseAt(ACT[p.swing.type], uOf(p.swing.type), swingU, pose)");
// pernas em tesoura: no começo do pulo a perna direita fica atrás; no contato ela vem para a frente
rep("    if (air) { fy += .1 + (s > 0 ? .12 : 0); fz += s > 0 ? .2 : -.12; }", `    if (air) {
      const jp = p.jumpDur ? 1 - p.jump / p.jumpDur : .5, sw = jp < .45 ? 1 : -1;
      fy += .1 + ((s > 0) === (sw > 0) ? .12 : .02); fz += (s > 0 ? .2 : -.12) * sw;
    }`);

// som: sem o barulho de ondas; batida curta e seca, como raquete de carbono numa bola despressurizada
rep(`function sndHit(power) {
  if (S.muted) return; const a = ac(); if (!a) return; const t = a.currentTime;
  const o = a.createOscillator(), g = a.createGain(); o.type = 'triangle';
  o.frequency.setValueAtTime(480 + power * 260, t); o.frequency.exponentialRampToValueAtTime(130, t + .08);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.35 + power * .25, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + .12);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + .14);
  noiseBurst(a, t, .05, 2200, .25 + power * .2);
}`, `function sndHit(power) {
  if (S.muted) return; const a = ac(); if (!a) return; const t = a.currentTime;
  const out = a.createGain(); out.gain.value = .55 + power * .45; out.connect(a.destination);
  // "pop" oco da bola contra a face rígida
  const len = Math.floor(a.sampleRate * .05), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (a.sampleRate * .007));
  const nz = a.createBufferSource(); nz.buffer = buf;
  const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1150 + power * 500; bp.Q.value = 1.6;
  nz.connect(bp).connect(out); nz.start(t);
  // corpo grave curto
  const o = a.createOscillator(), g = a.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(340 + power * 120, t); o.frequency.exponentialRampToValueAtTime(190, t + .045);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.5, t + .002); g.gain.exponentialRampToValueAtTime(.0001, t + .06);
  o.connect(g).connect(out); o.start(t); o.stop(t + .07);
  // estalo do carbono
  const ck = a.createBufferSource(); const cl = Math.floor(a.sampleRate * .008), cb = a.createBuffer(1, cl, a.sampleRate), cd = cb.getChannelData(0);
  for (let i = 0; i < cl; i++) cd[i] = (Math.random() * 2 - 1) * (1 - i / cl);
  ck.buffer = cb; const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500; const cg = a.createGain(); cg.gain.value = .25 + power * .3;
  ck.connect(hp).connect(cg).connect(out); ck.start(t);
}`);
rep("  applyCam(); applyGfx(); applyRackets(); applyPlayerStyle(); startSurf();", "  applyCam(); applyGfx(); applyRackets(); applyPlayerStyle();");
rep("  if (surf) surf.g.gain.value = S.muted ? 0 : .07; else if (!S.muted) startSurf();", "  if (surf) surf.g.gain.value = 0;");
// cor das faces um pouco menos estourada no sol
rep("face: new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: t,", "face: new THREE.MeshPhysicalMaterial({ color: 0xdedede, map: t,");
fs.writeFileSync(f, s);
console.log('ok');
