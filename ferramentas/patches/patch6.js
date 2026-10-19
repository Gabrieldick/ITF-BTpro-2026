const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };

// 1ª pessoa: braço mais baixo e à direita, raquete presa num punho que deixa ela em pé
rep("const fpArm = new THREE.Group(); fpArm.position.set(.24, -.08, -.12);", "let fpWrist = null;\nconst fpArm = new THREE.Group(); fpArm.position.set(.3, -.3, -.16);");
rep("  fpRacket = makeRacket('proteo'); fpRacket.position.y = -.45; fpArm.add(fpRacket);",
    "  fpWrist = new THREE.Group(); fpWrist.position.y = -.44; fpArm.add(fpWrist);\n  fpRacket = makeRacket('proteo'); fpRacket.position.y = .03; fpWrist.add(fpRacket);");
rep(`const FPKF = {
  smash:  { sh: [.5, 3.0, 3.3, 1.0, .5],  ph: [.2, .35, .2, .1, .2],   tw: [0, -.6, -.4, .5, 0] },
  lob:    { sh: [.5, -.5, -.4, 2.4, .5],  ph: [.2, .5, .5, .2, .2],    tw: [0, -.6, -.6, .4, 0] },
  curta:  { sh: [.5, .2, .3, 1.2, .5],    ph: [.2, .5, .5, .3, .2],    tw: [0, -.3, -.3, .15, 0] },
  defesa: { sh: [.5, 1.0, 1.1, 1.5, .5],  ph: [.2, 1.0, 1.0, .5, .2],  tw: [0, -.8, -.8, .2, 0] },
};`, `// sh: braço, ph: abertura, tw: giro, fw: punho (1,57 = raquete em pé; 0 = raquete na linha do antebraço)
const FP_UP = Math.PI / 2;
const FPKF = {
  smash:  { sh: [.5, 3.0, 3.3, 1.0, .5],  ph: [.2, .35, .2, .1, .2],   tw: [0, -.6, -.4, .5, 0],   fw: [0, .2, 0, .3, 0] },
  lob:    { sh: [.5, -.5, -.4, 2.4, .5],  ph: [.2, .5, .5, .2, .2],    tw: [0, -.6, -.6, .4, 0],   fw: [0, -.3, 0, .5, 0] },
  curta:  { sh: [.5, .65, .75, 1.1, .5],  ph: [.2, .45, .45, .3, .2],  tw: [0, -.3, -.3, .15, 0],  fw: [0, .15, -.1, .2, 0] },
  defesa: { sh: [.5, 1.0, 1.1, 1.5, .5],  ph: [.2, 1.0, 1.0, .5, .2],  tw: [0, -.8, -.8, .2, 0],   fw: [0, 1.1, 1.2, 1.3, 0] },
};`);
rep(`  const p = human; let th = 1.4, ph = .1, ry = -.3;
  if (p.charging) th = lerp(1.4, 3.0, clamp(MTR.t / .18, 0, 1));
  else if (S.mode === 'toss' && S.serverPlayer === p) th = lerp(1.4, 3.0, clamp(p.tossT / TOSS_T / .75, 0, 1));
  else if (p.swing.t >= 0) { const u = clamp(p.swing.t / p.swing.dur, 0, 1); const k = FPKF[p.swing.type]; th = kf(k.sh, u, 1.4); ph = kf(k.ph, u, .1) * .6; ry = -.3 + kf(k.tw, u, 0) * .5; }
  fpArm.rotation.set(th, ry, ph);`, `  const p = human; let th = 1.2, ph = .12, ry = -.35, fw = FP_UP;
  if (p.charging) { const c = clamp(MTR.t / .18, 0, 1); th = lerp(1.2, 3.0, c); fw = lerp(FP_UP, .2, c); }
  else if (S.mode === 'toss' && S.serverPlayer === p) { const c = clamp(p.tossT / TOSS_T / .75, 0, 1); th = lerp(1.2, 3.0, c); fw = lerp(FP_UP, .2, c); }
  else if (p.swing.t >= 0) {
    const u = clamp(p.swing.t / p.swing.dur, 0, 1); const k = FPKF[p.swing.type];
    th = kf(k.sh, u, 1.2); ph = kf(k.ph, u, .12) * .6; ry = -.35 + kf(k.tw, u, 0) * .5; fw = kf(k.fw, u, FP_UP);
  } else { th += Math.sin(p.gait) * .04 * Math.min(1, Math.hypot(p.vel.x, p.vel.z) / 4); }
  fpArm.rotation.set(th, ry, ph);
  if (fpWrist) fpWrist.rotation.set(fw, 0, -.15);`);
fs.writeFileSync(f, s);
console.log('ok');
