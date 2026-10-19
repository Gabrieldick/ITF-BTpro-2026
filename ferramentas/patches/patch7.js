const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };

// pressão do smash: defesa pode sair levantada ou descontrolada
rep(`  const spec = Object.assign({}, isServe ? SERVES[type] : SHOTS[key]);`, `  let spec = Object.assign({}, isServe ? SERVES[type] : SHOTS[key]);
  // quanto mais forte a bola que chega, maior a chance de a devolução sair levantada ou para fora
  let pop = false, wild = false;
  const inSpeed = Math.hypot(ball.vel.x, ball.vel.z);
  const pressure = isServe || key === 'smash' ? 0 : clamp((inSpeed - 12) / 9, 0, 1);
  if (pressure > 0) {
    const qq = mod.timing === undefined ? q : q * .6 + mod.timing * .4;
    const pOut = pressure * (1 - qq) * .45, pPop = pressure * (.12 + (1 - qq) * .9);
    const r0 = Math.random();
    if (r0 < pOut) wild = true; else if (r0 < pOut + pPop) pop = true;
  }
  if (pop) spec = { label: spec.label, T: rand(1.5, 1.9), depth: [2.2, 4.2], margin: .4, noise: .4 };`);
rep("  const aim = clamp(p.isHuman ? humanAim() : aiAim(p), -lim, lim);", "  const aim = pop ? rand(-1, 1) * (C.halfW - 1) : clamp(p.isHuman ? humanAim() : aiAim(p), -lim, lim);");
rep(`  if (dir < 0 && tgt.z > -.4) tgt.z = -.4;
  if (dir > 0 && tgt.z < .4) tgt.z = .4;`, `  if (wild) { tgt.x += (Math.random() < .5 ? -1 : 1) * rand(.8, 2.2); tgt.z += dir * rand(1.2, 3.2); }
  if (dir < 0 && tgt.z > -.4) tgt.z = -.4;
  if (dir > 0 && tgt.z < .4) tgt.z = .4;`);
rep("  return { key, label: spec.label, mis };", "  return { key, label: spec.label, mis, pop, wild };");

// tempo do clique do jogador: o ideal é a raquete chegar no meio do movimento
rep(`      const r = doHit(p, sw.type, q, false, mod);
      feedback(r.label, r.mis ? 'ERROU A MÃO' : sw.meter ? RES_WORD[sw.meter.res] : qualityWord(q), null);`, `      if (!sw.meter) mod.timing = 1 - clamp(Math.abs(su - .4) / .4, 0, 1);
      const r = doHit(p, sw.type, q, false, mod);
      feedback(r.label, r.mis ? 'ERROU A MÃO' : r.pop ? 'LEVANTOU' : r.wild ? 'DESCONTROLOU' : sw.meter ? RES_WORD[sw.meter.res] : qualityWord(q), null);`);
rep(`            const r = doHit(p, shot, rand(D.q[0], D.q[1]), false);
            feedback(whoTag(p) + r.label, null, whoKind(p));`, `            const r = doHit(p, shot, rand(D.q[0], D.q[1]), false);
            feedback(whoTag(p) + r.label, r.pop ? 'LEVANTOU' : r.wild ? 'DESCONTROLOU' : null, whoKind(p));`);
fs.writeFileSync(f, s);
console.log('ok');
