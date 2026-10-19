const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };

// pulo genérico
rep("  if (key === 'smash' && ball.pos.y > 2.2) p.jump = .35;", "  if (key === 'smash' && ball.pos.y > 2.2) startJump(p, .38, .3);");
rep('function qualityWord(q) {', 'function startJump(p, dur, h) { if (p.jump > 0) return; p.jump = dur; p.jumpDur = dur; p.jumpH = h; }\nfunction qualityWord(q) {');
rep('  const jy = Math.sin(Math.min(1, p.jump / .35) * Math.PI) * .32 + (p.split > 0 ? Math.sin(Math.PI * (1 - p.split / .22)) * .06 : 0);',
    '  const jy = (p.jump > 0 ? Math.sin((1 - p.jump / (p.jumpDur || .35)) * Math.PI) * (p.jumpH || .3) : 0) + (p.split > 0 ? Math.sin(Math.PI * (1 - p.split / .22)) * .06 : 0);');

// raquete encosta de verdade na bola no smash
rep('    const w = clamp(1 - Math.abs(swingU - .45) / .18, 0, 1) * .75;', "    const w = clamp(1 - Math.abs(swingU - .45) / .18, 0, 1) * (p.swing.type === 'smash' ? 1 : .75);");
rep("    if (!sw.hit && S.mode === 'rally' && sw.t <= sw.dur * (sw.meter ? .9 : .8) && canHit(p, sw.type)) {",
`    const su = sw.t / sw.dur;
    const overhead = sw.type === 'smash' && ball.pos.y >= 1.9;
    const contact = overhead ? (su >= .3 && su <= .75 && racketNearBall(p, .42)) : (sw.t <= sw.dur * (sw.meter ? .9 : .8) && canHit(p, sw.type));
    if (p.pendingServe && su >= .45) {
      const ps = p.pendingServe; p.pendingServe = null;
      ball.state = 'live'; S.mode = 'rally';
      const r = doHit(p, ps.type, ps.q, true, ps.mod);
      feedback(r.label, r.mis ? 'ERROU' : RES_WORD[ps.res], null);
    } else if (!sw.hit && !p.pendingServe && S.mode === 'rally' && contact) {`);
rep('function canHit(p, type, scale) {', `const _rf = new V3();
// o centro da face da raquete precisa estar perto da bola
function racketNearBall(p, r) {
  if (ball.state !== 'live' || S.lastTeam === p.team) return false;
  if (p.team === 0 ? ball.pos.z < .05 : ball.pos.z > -.05) return false;
  p.model.racket.localToWorld(_rf.set(0, -.363, 0));
  return _rf.distanceTo(ball.pos) <= r;
}
function canHit(p, type, scale) {`);

// smash da CPU só de perto
rep("        if (canHit(p, shot === 'smash' && ball.pos.y >= 1.9 ? 'smash' : 'defesa', .9)) {", "        if (shot === 'smash' && ball.pos.y >= 1.9 ? canHit(p, 'smash', .66) : canHit(p, 'defesa', .9)) {");

// medidor do smash: tempo até a bola chegar na zona de contato
rep('    if ((p.team === 0 ? pos.z > .05 : pos.z < -.05) && pos.y >= .12 && pos.y <= 3.0 && Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z) <= 1.2) return t;',
    '    if ((p.team === 0 ? pos.z > .05 : pos.z < -.05) && pos.y >= .12 && pos.y <= 3.1 && Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z) <= .9) return t;');
rep("    const sw = human.swing; sw.t = sw.dur * .3; sw.type = 'smash'; sw.hit = false; sw.meter = { res, amt };",
    "    const sw = human.swing; sw.t = sw.dur * .3; sw.type = 'smash'; sw.hit = false; sw.meter = { res, amt };\n    if (ball.state === 'live' && ball.pos.y > 1.6) startJump(human, .42, .3);");

// saque: contato à frente e mais alto, com pulo para dentro da quadra
rep('  const cx = p.pos.x + .22 * f, cz = p.pos.z - .38 * f, cy = 2.45;', '  const cx = p.pos.x + .22 * f, cz = p.pos.z - .62 * f, cy = 2.62;\n  p.serveJumped = false; p.pendingServe = null;');
rep(`  ball.state = 'live'; S.mode = 'rally';
  const r = doHit(human, type, q, true, mod);
  feedback(r.label, r.mis ? 'ERROU' : RES_WORD[res], null);
}`, `  // a batida acontece quando a raquete chega na bola (meio do movimento)
  human.pendingServe = { type, q, mod, res };
  const sw = human.swing; sw.t = sw.dur * .3; sw.type = 'smash'; sw.hit = false; sw.meter = null;
}`);
rep(`    if (!S.serverPlayer.isHuman && ball.vel.y < 0 && ball.pos.y <= 2.45) {
      const p = S.serverPlayer; const D = skillOf(p);
      const q = S.serveType === 'smash' ? rand(D.q[0] - .15, D.q[1]) : rand(D.q[0], 1);
      ball.state = 'live';
      S.mode = 'rally';
      const r = doHit(p, S.serveType, q, true);
      feedback(whoTag(p) + r.label, null, whoKind(p));
    }`, `    const sp = S.serverPlayer;
    if (!sp.isHuman && !sp.pendingServe && ball.vel.y < 0 && ball.pos.y <= 2.7) {
      const D = skillOf(sp);
      sp.pendingServe = { type: S.serveType, q: S.serveType === 'smash' ? rand(D.q[0] - .15, D.q[1]) : rand(D.q[0], 1) };
      sp.swing.t = sp.swing.dur * .3; sp.swing.type = 'smash'; sp.swing.hit = false;
    }`);
// CPU executa o saque quando a raquete chega
rep('    if (!p.swing.hit && p.swing.t > p.swing.dur * .3) p.swing.t = p.swing.dur * .3; // segura armado até a bola chegar',
`    if (p.pendingServe && p.swing.t >= p.swing.dur * .45) {
      const ps = p.pendingServe; p.pendingServe = null;
      ball.state = 'live'; S.mode = 'rally';
      const r = doHit(p, ps.type, ps.q, true);
      feedback(whoTag(p) + r.label, null, whoKind(p));
    }
    if (!p.swing.hit && !p.pendingServe && p.swing.t > p.swing.dur * .3) p.swing.t = p.swing.dur * .3; // segura armado até a bola chegar`);
// impulso e pulo do saque (jogador)
rep("  if (serving) { tvz = 0; if (S.mode === 'toss') tvx = 0; }", `  if (serving) {
    tvz = 0; if (S.mode === 'toss') tvx = 0;
    if (S.mode === 'toss' && p.tossT > TOSS_T * .74) { tvz = -2.6; if (!p.serveJumped) { p.serveJumped = true; startJump(p, .55, .34); } }
  }
  if (p.pendingServe) { tvx = 0; tvz = -2.6; }`);
rep('  if (serving) { p.pos.z = 8.6; p.pos.x = clamp(p.pos.x, -C.halfW + .1, C.halfW - .1); }', "  if (serving && S.mode === 'serve') { p.pos.z = 8.6; p.pos.x = clamp(p.pos.x, -C.halfW + .1, C.halfW - .1); }");
// impulso e pulo do saque (CPU e parceira)
rep("  if (S.mode === 'serve' || S.mode === 'toss') { tx = p.pos.x; tz = p.pos.z; }", `  if (S.mode === 'serve' || S.mode === 'toss') { tx = p.pos.x; tz = p.pos.z; }
  if (S.serverPlayer === p && ((S.mode === 'toss' && p.tossT > TOSS_T * .74) || p.pendingServe)) {
    tz = p.pos.z + (p.team === 0 ? -1 : 1) * .8;
    if (!p.serveJumped) { p.serveJumped = true; startJump(p, .55, .34); }
  }`);
rep('  players.forEach(p => { p.vel.set(0, 0, 0); p.swing.t = -1; p.swing.meter = null; p.jump = 0;', '  players.forEach(p => { p.vel.set(0, 0, 0); p.swing.t = -1; p.swing.meter = null; p.jump = 0; p.pendingServe = null; p.serveJumped = false;');
// pose do saque: joelhos mais dobrados no troféu, extensão total no fim
rep('P({ rh: [.3, .66, .22], rp: [.7, .9, .2], wx: -1.0, lh: [.1, 1.02, -.38], lp: [-.9, 0, .3], tw: -.75, lean: -.25, bend: -.1, crouch: .17 }),', 'P({ rh: [.3, .66, .22], rp: [.7, .9, .2], wx: -1.0, lh: [.1, 1.02, -.38], lp: [-.9, 0, .3], tw: -.75, lean: -.25, bend: -.1, crouch: .24 }),');
rep('P({ rh: [.28, .7, .18], rp: [.7, .9, .2], wx: -1.0, lh: [0, .8, -.38], lp: [-.9, 0, .3], tw: -.6, lean: -.2, bend: -.1, crouch: .12 }),', 'P({ rh: [.28, .72, .16], rp: [.7, .9, .2], wx: -1.0, lh: [0, .8, -.38], lp: [-.9, 0, .3], tw: -.55, lean: -.15, bend: -.1, crouch: .02 }),');
fs.writeFileSync(f, s);
console.log('ok');
