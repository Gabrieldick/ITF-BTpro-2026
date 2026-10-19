const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };

rep("const MTR = { active: false, kind: null, type: null, t: 0, fill: .75, center: .78, half: .068, armedTap: false, showT: 0 };",
    "const MTR = { active: false, kind: null, type: null, t: 0, v: 0, rate: 0, fill: .75, center: .78, half: .068, armedTap: false, showT: 0 };");
rep("  Object.assign(MTR, { active: true, kind, type, t: 0, armedTap: false, showT: 0 });", "  Object.assign(MTR, { active: true, kind, type, t: 0, v: 0, rate: 0, armedTap: false, showT: 0 });");
rep(`    MTR.fill = .75; MTR.half = half; human.charging = true;
    // a faixa verde acompanha o tempo até a bola chegar: bola baixa ou rápida pede soltar mais cedo
    const tc = timeToReach(human);
    MTR.center = tc === null ? .78 : clamp((tc - .05) / MTR.fill, .3 + half, .78);`,
`    // a faixa verde fica parada; a velocidade da barra se ajusta para o verde coincidir com a chegada da bola
    MTR.fill = .75; MTR.half = half; MTR.center = .78; human.charging = true;`);
rep("function smashZoneScale() { return clamp(1.2 - ((ball.apex || 3.5) - 3.5) * .1, .5, 1.2); }",
    "function smashZoneScale() { return clamp(1.2 - ((ball.apex || 3.5) - 3.5) * .12, .45, 1.2); }");
// tempo até a bola entrar no alcance do smash, a partir do ombro real do jogador
rep("// segundos até a bola entrar no alcance do jogador (null se não entra)\nfunction timeToReach(p) {", `const _ts = new V3();
function timeToSmash(p) {
  if (ball.state !== 'live' || S.lastTeam === p.team) return null;
  p.model.armR.sh.getWorldPosition(_ts); if (p.jump <= 0) _ts.y += .25;
  const pos = ball.pos.clone(), vel = ball.vel.clone(); const dt = .01;
  for (let t = 0; t < 2.5; t += dt) {
    const side = p.team === 0 ? pos.z > .05 : pos.z < -.05;
    if (side && pos.y >= 1.75 && pos.distanceTo(_ts) <= .95) return t;
    if (side && pos.y < 1.75 && pos.y >= .12 && Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z) <= 1.2) return t;
    vel.y -= G * dt; pos.addScaledVector(vel, dt);
    if (pos.y < C.ballR) return null;
  }
  return null;
}
// segundos até a bola entrar no alcance do jogador (null se não entra)
function timeToReach(p) {`);
rep("  const v = MTR.t / MTR.fill, diff = v - MTR.center;", "  const v = MTR.v, diff = v - MTR.center;");
rep("    MTR.t += dt; const v = MTR.t / MTR.fill;", `    MTR.t += dt;
    if (MTR.kind === 'smash') {
      const tr = timeToSmash(human);
      if (tr !== null && MTR.v < MTR.center) MTR.rate = clamp((MTR.center - MTR.v) / Math.max(tr - .03, .04), 1 / 2.2, 1 / .25);
      else if (!MTR.rate) MTR.rate = 1 / MTR.fill;
      MTR.v += MTR.rate * dt;
    } else MTR.v = MTR.t / MTR.fill;
    const v = MTR.v;`);
rep("    const v = MTR.t / MTR.fill;\n", "    const v = MTR.v;\n");
// sem espera automática: o timing é seu
rep("sw.meter = { res, amt }; sw.hold = 1.3;", "sw.meter = { res, amt }; sw.hold = 0;\n    if (ball.state === 'live' && ball.pos.y > 1.6) startJump(human, .42, .3);");
rep("    sw.t += dt; if (sw.t >= sw.dur) { sw.t = -1; sw.meter = null; }", "    sw.t += dt; if (sw.t >= sw.dur) { if (sw.meter && !sw.hit && S.mode === 'rally') feedback('SMASH', 'FUROU', null); sw.t = -1; sw.meter = null; }");
fs.writeFileSync(f, s);
console.log('ok');
