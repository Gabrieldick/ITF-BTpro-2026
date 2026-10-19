const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };

// curta: toque suave, face bem aberta passando por baixo da bola, corpo indo para a frente
rep(`    P({ rh: [.34, .22, -.2], rp: [.9, -.4, .3], wx: .5, wr: .4, lh: [-.2, .3, -.2], lp: [-.9, -.5, 0], tw: -.3, lean: .4, crouch: .26, lunge: .5 }),
    P({ rh: [.3, .08, -.5], rp: [.9, -.5, .2], wx: 1.0, wr: .5, lh: [-.3, .28, -.05], lp: [-.9, -.5, 0], tw: -.05, lean: .5, crouch: .34, lunge: .9 }),
    P({ rh: [.26, .2, -.58], rp: [.9, -.5, .2], wx: 1.1, wr: .5, lh: [-.3, .3, -.05], lp: [-.9, -.5, 0], tw: .1, lean: .45, crouch: .3, lunge: .8 }),`,
`    P({ rh: [.3, .36, -.28], rp: [.9, -.5, .3], wx: 1.3, wr: .5, lh: [-.12, .32, -.3], lp: [-.9, -.5, 0], tw: -.25, lean: .35, crouch: .2, lunge: .3 }),
    P({ rh: [.26, .24, -.5], rp: [.9, -.6, .2], wx: 1.65, wr: .7, lh: [-.25, .3, -.15], lp: [-.9, -.5, 0], tw: -.05, lean: .48, crouch: .28, lunge: .65 }),
    P({ rh: [.22, .3, -.6], rp: [.9, -.6, .2], wx: 1.75, wr: .7, lh: [-.28, .32, -.1], lp: [-.9, -.5, 0], tw: .05, lean: .46, crouch: .26, lunge: .6 }),`);
// defesa: bloqueio compacto e firme na frente do corpo, passo baixo para o lado da bola
rep(`    P({ rh: [.46, .24, -.16], rp: [.6, -.8, .2], wx: 1.1, wr: .5, lh: [-.1, .3, -.3], lp: [-.9, -.5, 0], tw: -.35, lean: .42, bend: .2, crouch: .24, lunge: 1 }),
    P({ rh: [.56, .2, -.36], rp: [.6, -.8, .1], wx: 1.4, wr: .6, lh: [-.15, .3, -.25], lp: [-.9, -.5, 0], tw: -.1, lean: .46, bend: .25, crouch: .26, lunge: 1 }),
    P({ rh: [.48, .26, -.44], rp: [.6, -.8, .1], wx: 1.4, wr: .6, lh: [-.15, .3, -.25], lp: [-.9, -.5, 0], tw: .05, lean: .42, bend: .2, crouch: .24, lunge: 1 }),`,
`    P({ rh: [.3, .34, -.3], rp: [.8, -.7, .2], wx: 1.25, wr: .8, lh: [-.1, .32, -.3], lp: [-.9, -.5, 0], tw: -.2, lean: .38, bend: .12, crouch: .28, lunge: .7 }),
    P({ rh: [.34, .3, -.46], rp: [.8, -.7, .1], wx: 1.15, wr: .8, lh: [-.16, .32, -.24], lp: [-.9, -.5, 0], tw: -.05, lean: .42, bend: .15, crouch: .3, lunge: .75 }),
    P({ rh: [.32, .33, -.5], rp: [.8, -.7, .1], wx: 1.2, wr: .8, lh: [-.16, .32, -.24], lp: [-.9, -.5, 0], tw: .02, lean: .4, bend: .12, crouch: .28, lunge: .7 }),`);
// a raquete busca a bola com mais força na defesa (bloqueio vai até ela)
rep("    const w = clamp(1 - Math.abs(swingU - .45) / .18, 0, 1) * (p.swing.type === 'smash' ? 1 : .75);",
    "    const w = clamp(1 - Math.abs(swingU - .45) / .2, 0, 1) * (p.swing.type === 'smash' ? 1 : p.swing.type === 'defesa' ? .9 : .75);");
// curta um pouco mais lenta, as outras com a duração normal
rep("    sw.t = 0; sw.type = type; sw.hit = false; sw.meter = null; sw.lob = null;", "    sw.t = 0; sw.type = type; sw.dur = type === 'curta' ? .5 : SWING_DUR; sw.hit = false; sw.meter = null; sw.lob = null;");
rep("p.ai.swung = true; p.swing.t = 0; p.swing.type = shot;", "p.ai.swung = true; p.swing.dur = shot === 'curta' ? .5 : SWING_DUR; p.swing.t = 0; p.swing.type = shot;");
rep("    const sw = human.swing; sw.t = sw.dur * .3; sw.type = 'smash';", "    const sw = human.swing; sw.dur = SWING_DUR; sw.t = sw.dur * .3; sw.type = 'smash';");
rep("    const sw = human.swing; sw.t = sw.dur * .3; sw.type = 'lob';", "    const sw = human.swing; sw.dur = SWING_DUR; sw.t = sw.dur * .3; sw.type = 'lob';");

// nota da defesa: qualidade combinada com o resultado
rep("  let pop = false, wild = false;\n  const inSpeed = Math.hypot(ball.vel.x, ball.vel.z);", "  let pop = false, wild = false, grade = q;\n  const inSpeed = Math.hypot(ball.vel.x, ball.vel.z);");
rep("    const qq = clamp((mod.timing === undefined ? q : q * .6 + mod.timing * .4) + (attrK(p, 'def') - .7) * .5, 0, 1);",
    "    const qq = clamp((mod.timing === undefined ? q : q * .6 + mod.timing * .4) + (attrK(p, 'def') - .7) * .5, 0, 1);\n    grade = qq;");
rep("  return { key, label: spec.label, mis, pop, wild };", "  if (pressure <= 0 && mod.timing !== undefined) grade = q * .6 + mod.timing * .4;\n  return { key, label: spec.label, mis, pop, wild, grade, pressure };");

// feedback colorido da defesa
rep('<div id="vignette"></div>', '<div id="vignette"></div>\n<div id="defFlash"></div>');
rep('#loading {', `#defFlash { position: fixed; inset: 0; z-index: 2; pointer-events: none; opacity: 0; transition: opacity .55s ease-out; box-shadow: inset 0 0 140px 26px var(--dfc, #4FD18B); }
#defFlash.on { opacity: .75; transition: none; }

#loading {`);
rep("      feedback(r.label, r.mis ? 'ERROU A MÃO'", "      if (sw.type === 'defesa' || r.pressure > .2) defenseFeedback(r);\n      feedback(r.label, r.mis ? 'ERROU A MÃO'");
rep("function qualityWord(q) {", `// cor da defesa: verde boa, amarelo ok, laranja levantou, vermelho descontrolou ou errou
const DEF_COLORS = { verde: '#4FD18B', amarelo: '#FFD23F', laranja: '#FF8A2A', vermelho: '#E5484D' };
const defRing = new THREE.Mesh(new THREE.RingGeometry(.35, .5, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
defRing.rotation.x = -Math.PI / 2; defRing.visible = false; scene.add(defRing);
let defRingT = 0, defFlashTimer = 0;
function defenseFeedback(r) {
  const g = r.mis || r.wild ? 'vermelho' : r.pop ? 'laranja' : r.grade < .7 ? 'amarelo' : 'verde';
  const c = DEF_COLORS[g];
  defRing.material.color.set(c); defRing.position.set(human.pos.x, .025, human.pos.z); defRing.visible = true; defRingT = .5;
  const fl = $('defFlash'); fl.style.setProperty('--dfc', c); fl.classList.add('on');
  clearTimeout(defFlashTimer); defFlashTimer = setTimeout(() => fl.classList.remove('on'), 60);
}
function qualityWord(q) {`);
rep("function updateVisuals(dt) {", "function updateVisuals(dt) {\n  if (defRingT > 0) { defRingT = Math.max(0, defRingT - dt); const k = 1 - defRingT / .5; defRing.scale.setScalar(1 + k * 1.6); defRing.material.opacity = .7 * (1 - k); if (defRingT === 0) defRing.visible = false; }");
fs.writeFileSync(f, s);
console.log('ok');
