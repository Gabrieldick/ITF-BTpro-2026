const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };

// linha dos 3 metros (zona proibida de saque) nos dois lados
rep("  tape(g, .05, C.halfL * 2 + .05, hw, 0); tape(g, .05, C.halfL * 2 + .05, -hw, 0);",
    "  tape(g, .05, C.halfL * 2 + .05, hw, 0); tape(g, .05, C.halfL * 2 + .05, -hw, 0);\n  tape(g, hw * 2 + .05, .05, 0, ZONE3); tape(g, hw * 2 + .05, .05, 0, -ZONE3);");
rep("const SHORE_Z = -52;", "const ZONE3 = 3;          // zona proibida de saque: quem recebe fica atrás dos 3 m até devolver\nconst SHORE_Z = -52;");
rep("<li>No 40–40 vale o ponto de ouro: quem fizer leva o game.</li>", "<li>No 40–40 vale o ponto de ouro: quem fizer leva o game.</li>\n      <li>No saque, quem recebe fica atrás da linha dos 3 m até devolver a bola.</li>");
rep(`function clampPos(p) {
  const lim = C.halfW + 3;
  p.pos.x = clamp(p.pos.x, -lim, lim);
  if (p.team === 0) p.pos.z = clamp(p.pos.z, .4, 11.5); else p.pos.z = clamp(p.pos.z, -11.5, -.4);`, `function receiving(p) {
  return p.team !== S.server && (S.mode === 'serve' || S.mode === 'toss' || (S.mode === 'rally' && S.rally < 2));
}
function clampPos(p) {
  const lim = C.halfW + 3;
  p.pos.x = clamp(p.pos.x, -lim, lim);
  const minZ = receiving(p) ? ZONE3 + .05 : .4;
  if (p.team === 0) p.pos.z = clamp(p.pos.z, minZ, 11.5); else p.pos.z = clamp(p.pos.z, -11.5, -minZ);`);

// smash de finalização: bola alta batida perto da rede
rep("  let lobLong = 0;", `  let lobLong = 0, finisher = false;
  if (!isServe && key === 'smash' && Math.abs(p.pos.z) < 2.2 && ball.pos.y > 2.0) {
    finisher = true;
    spec.speed *= 1.25; spec.depth = [3.0, 5.6]; spec.noise *= .8; spec.label = 'FINALIZAÇÃO';
  }`);
rep("  const pressure = isServe || key === 'smash' ? 0 : clamp((inSpeed - 12) / 9, 0, 1);", "  const pressure = isServe || key === 'smash' ? 0 : clamp((inSpeed - 12) / 9 + (ball.finisher ? .35 : 0), 0, 1.3);");
rep("  ball.vel.copy(v); ball.state = 'live'; ball.oppMiss = mod.oppMissBoost || 0;", "  ball.vel.copy(v); ball.state = 'live'; ball.oppMiss = (mod.oppMissBoost || 0) + (finisher ? .22 : 0); ball.finisher = finisher;");
fs.writeFileSync(f, s);
console.log('ok');
