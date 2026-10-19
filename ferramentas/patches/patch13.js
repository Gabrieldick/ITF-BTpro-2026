const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };

// ponto ideal do smash: onde a bola passa descendo na altura de batida (um pouco antes de onde cairia)
rep("function startMeter(kind, type) {", `function smashIdealPoint() {
  if (ball.state !== 'live') return null;
  const pos = ball.pos.clone(), vel = ball.vel.clone(); const dt = .01;
  for (let t = 0; t < 3; t += dt) {
    vel.y -= G * dt; pos.addScaledVector(vel, dt);
    if (vel.y < 0 && pos.y <= 2.45) return pos;
    if (pos.y < C.ballR) return pos;
  }
  return null;
}
function startMeter(kind, type) {`);
rep("    MTR.fill = .75; MTR.half = half; MTR.center = .78; human.charging = true;", "    MTR.fill = .75; MTR.half = half; MTR.center = .78; human.charging = true; MTR.ideal = smashIdealPoint();");
rep("    const sw = human.swing; sw.t = sw.dur * .3; sw.type = 'smash'; sw.hit = false; sw.meter = { res, amt }; sw.hold = 0;",
    "    const sw = human.swing; sw.t = sw.dur * .3; sw.type = 'smash'; sw.hit = false; sw.meter = { res, amt, ideal: MTR.ideal }; sw.hold = 0;");
rep(`        else mod = { speedMul: 1.08, noiseMul: 1.8, misBoost: .25 + .4 * amt };
      }`, `        else mod = { speedMul: 1.08, noiseMul: 1.8, misBoost: .25 + .4 * amt };
        // posicionamento: parado embaixo da bola (com ela sobre o ombro direito) rende mais; longe dela, menos
        const ip = sw.meter.ideal;
        if (overhead && ip) {
          const fx = p.team === 0 ? 1 : -1;
          const dpos = Math.hypot(p.pos.x + .25 * fx - ip.x, p.pos.z - ip.z);
          if (dpos < .4) { q = Math.min(1, q + .1); mod.speedMul = (mod.speedMul || 1) * 1.06; mod.noiseMul = (mod.noiseMul || 1) * .8; sw.meter.pos = 'BEM POSICIONADO'; }
          else if (dpos > .9) {
            const e = Math.min(1.5, dpos - .9);
            q = Math.max(.1, q - e * .5); mod.noiseMul = (mod.noiseMul || 1) * (1 + e * 1.5); mod.speedMul = (mod.speedMul || 1) * (1 - e * .15);
            mod.misBoost = (mod.misBoost || 0) + e * .4; sw.meter.pos = 'MAL POSICIONADO';
          }
        }
      }`);
rep("      feedback(r.label, r.mis ? 'ERROU A MÃO' : r.pop ? 'LEVANTOU' : r.wild ? 'DESCONTROLOU' : sw.meter ? RES_WORD[sw.meter.res] : sw.lob ? sw.lob.word : qualityWord(q), null);",
    "      feedback(r.label, r.mis ? 'ERROU A MÃO' : r.pop ? 'LEVANTOU' : r.wild ? 'DESCONTROLOU' : sw.meter ? RES_WORD[sw.meter.res] + (sw.meter.pos ? ' · ' + sw.meter.pos : '') : sw.lob ? sw.lob.word : qualityWord(q), null);");
fs.writeFileSync(f, s);
console.log('ok');
