const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };

// alcance do smash: bola ao alcance do ombro direito (braço + raquete), contando o pulo
rep('function racketNearBall(p, r) {', `const _sh = new V3();
function smashReach(p) {
  if (ball.state !== 'live' || S.lastTeam === p.team) return false;
  if (p.team === 0 ? ball.pos.z < .05 : ball.pos.z > -.05) return false;
  if (ball.pos.y < 1.75) return false;
  p.model.armR.sh.getWorldPosition(_sh);
  if (p.jump <= 0) _sh.y += .25;
  return _sh.distanceTo(ball.pos) <= 1.08;
}
function racketNearBall(p, r) {`);

// ao soltar, o jogador fica armado esperando a bola entrar no alcance
rep("    const sw = human.swing; sw.t = sw.dur * .3; sw.type = 'smash'; sw.hit = false; sw.meter = { res, amt };\n    if (ball.state === 'live' && ball.pos.y > 1.6) startJump(human, .42, .3);",
    "    const sw = human.swing; sw.t = sw.dur * .3; sw.type = 'smash'; sw.hit = false; sw.meter = { res, amt }; sw.hold = .45;");
rep(`    const su = sw.t / sw.dur;
    const overhead = sw.type === 'smash' && ball.pos.y >= 1.9;
    const contact = overhead ? (su >= .3 && su <= .75 && racketNearBall(p, .42)) : (sw.t <= sw.dur * (sw.meter || sw.lob ? .9 : .8) && canHit(p, sw.type));`,
`    const su = sw.t / sw.dur;
    const overhead = sw.type === 'smash' && ball.pos.y >= 1.9;
    let fire = false;
    if (sw.meter && sw.hold > 0 && !sw.hit) {
      if (overhead ? smashReach(p) : canHit(p, 'smash')) { sw.hold = 0; fire = true; if (overhead) startJump(p, .38, .28); }
      else {
        sw.hold -= dt; sw.t = sw.dur * .3 - dt;
        if (sw.hold <= 0) { sw.hold = 0; sw.hit = true; feedback('SMASH', 'FORA DO ALCANCE', null); }
      }
    }
    const contact = fire || (overhead
      ? (su >= .29 && su <= .75 && (sw.meter ? smashReach(p) : racketNearBall(p, .42)))
      : (sw.t <= sw.dur * (sw.meter || sw.lob ? .9 : .8) && canHit(p, sw.type)));`);

// tempo até a bola entrar no alcance do smash (centro da faixa verde)
rep('    if ((p.team === 0 ? pos.z > .05 : pos.z < -.05) && pos.y >= .12 && pos.y <= 3.1 && Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z) <= .9) return t;',
`    const f0 = p.team === 0 ? 1 : -1;
    if ((p.team === 0 ? pos.z > .05 : pos.z < -.05) && pos.y >= 1.75 && Math.hypot(pos.x - (p.pos.x + .2 * f0), pos.y - 1.75, pos.z - p.pos.z) <= 1.0) return t;
    if ((p.team === 0 ? pos.z > .05 : pos.z < -.05) && pos.y < 1.75 && pos.y >= .12 && Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z) <= 1.2) return t;`);
fs.writeFileSync(f, s);
console.log('ok');
