const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };

// textos do menu
rep('<li>Smash e saque têm barra de força: segure o botão e solte na faixa verde.</li>', '<li>Smash, lob e saque têm barra de força: segure o botão e solte na hora certa.</li>');
rep('<p>Balão alto até o fundo. Funciona quando o adversário está colado na rede.</p>', '<p>Segure para dar força. Fraco sai rápido e baixo (cuidado com o smash); forte sobe muito e dá tempo, mas não passe do vermelho.</p>');

// medidor do lob: força livre, vermelho = longo demais
rep(`  else { MTR.fill = .9; MTR.center = TOSS_T / .9; MTR.half = half * ({ defesa: 1.5, lob: 1.3, curta: 1.2, smash: 1 }[type] || 1); }
  el.meter.className = ''; el.meter.hidden = false; el.mRes.textContent = '';
  el.mLbl.textContent = kind === 'smash' ? 'SMASH' : 'SAQUE';
  el.mZone.style.bottom = ((MTR.center - MTR.half) * 100) + '%';
  el.mZone.style.height = (MTR.half * 200) + '%';`, `  else if (kind === 'lob') { MTR.fill = .8; MTR.center = -1; MTR.half = 0; human.charging = true; }
  else { MTR.fill = .9; MTR.center = TOSS_T / .9; MTR.half = half * ({ defesa: 1.5, lob: 1.3, curta: 1.2, smash: 1 }[type] || 1); }
  if (kind === 'smash') MTR.half *= smashZoneScale();
  el.meter.className = kind === 'lob' ? 'lobm' : ''; el.meter.hidden = false; el.mRes.textContent = '';
  el.mLbl.textContent = kind === 'smash' ? 'SMASH' : kind === 'lob' ? 'LOB' : 'SAQUE';
  if (kind === 'lob') { el.mZone.style.bottom = (100 / LOB_MAX) + '%'; el.mZone.style.height = (100 - 100 / LOB_MAX) + '%'; }
  else { el.mZone.style.bottom = ((MTR.center - MTR.half) * 100) + '%'; el.mZone.style.height = (MTR.half * 200) + '%'; }`);
rep('function startMeter(kind, type) {', `const LOB_MAX = 1.18;
// bola que vem de um lob alto cai mais rápido: a faixa perfeita do smash fica menor
function smashZoneScale() { return clamp(1.2 - ((ball.apex || 3.5) - 3.5) * .1, .5, 1.2); }
function startMeter(kind, type) {`);
rep(`  const v = MTR.t / MTR.fill, diff = v - MTR.center;
  const res = Math.abs(diff) <= MTR.half ? 'perfeito' : diff < 0 ? 'cedo' : 'tarde';`, `  const v = MTR.t / MTR.fill, diff = v - MTR.center;
  if (MTR.kind === 'lob') {
    const lv = Math.min(v, LOB_MAX);
    const word = lv < .35 ? 'BAIXO' : lv < .75 ? 'MÉDIO' : lv <= 1 ? 'ALTO' : 'LONGO';
    MTR.active = false; MTR.showT = .9;
    el.meter.className = 'lobm ' + (lv < .35 ? 'cedo' : lv <= 1 ? (lv >= .75 ? 'perfeito' : '') : 'tarde');
    el.mRes.textContent = word; el.mFill.style.height = (lv / LOB_MAX * 100) + '%';
    human.charging = false;
    const sw = human.swing; sw.t = sw.dur * .3; sw.type = 'lob'; sw.hit = false; sw.meter = null; sw.lob = { power: lv, word };
    return;
  }
  const res = Math.abs(diff) <= MTR.half ? 'perfeito' : diff < 0 ? 'cedo' : 'tarde';`);
rep("  else if (type === 'smash') releaseMeter();\n}", "  else if (type === MTR.type) releaseMeter();\n}");
rep(`    if (MTR.active && MTR.kind === 'smash') cancelMeter();
    const sw = human.swing;
    if (sw.t >= 0 && sw.t < sw.dur * .8) return;
    if (type === 'smash' && S.mode === 'rally') { sw.t = -1; startMeter('smash', 'smash'); return; }
    sw.t = 0; sw.type = type; sw.hit = false; sw.meter = null;`, `    if (MTR.active && (MTR.kind === 'smash' || MTR.kind === 'lob')) cancelMeter();
    const sw = human.swing;
    if (sw.t >= 0 && sw.t < sw.dur * .8) return;
    if ((type === 'smash' || type === 'lob') && S.mode === 'rally') { sw.t = -1; sw.lob = null; startMeter(type, type); return; }
    sw.t = 0; sw.type = type; sw.hit = false; sw.meter = null; sw.lob = null;`);
rep(`    if (MTR.kind === 'smash' && S.mode !== 'rally') cancelMeter();
    else if (MTR.kind === 'smash' && v >= 1.15) releaseMeter();`, `    if ((MTR.kind === 'smash' || MTR.kind === 'lob') && S.mode !== 'rally') cancelMeter();
    else if (MTR.kind === 'smash' && v >= 1.15) releaseMeter();
    else if (MTR.kind === 'lob' && v >= LOB_MAX) releaseMeter();`);
rep("    el.meter.classList.toggle('in', Math.abs(v - MTR.center) <= MTR.half);", "    if (MTR.kind === 'lob') { el.mFill.style.height = (clamp(v / LOB_MAX, 0, 1) * 100) + '%'; el.meter.classList.toggle('over', v > 1); }\n    else el.meter.classList.toggle('in', Math.abs(v - MTR.center) <= MTR.half);");
rep("#meter.in .fill { background: #ffffff; box-shadow: 0 0 12px #4FD18B; }", "#meter.in .fill { background: #ffffff; box-shadow: 0 0 12px #4FD18B; }\n#meter.lobm .zone { background: #E5484D; }\n#meter.lobm .fill { background: linear-gradient(0deg, #FFD23F, #5FB8FF); }\n#meter.over .fill { background: #E5484D; }");

// pose de carregar: lob arma por baixo
rep("  else if (p.charging) poseAt(ACT.smash, KU, .3 * clamp(MTR.t / .18, 0, 1), pose);", "  else if (p.charging) poseAt(ACT[MTR.type === 'lob' ? 'lob' : 'smash'], KU, .3 * clamp(MTR.t / .18, 0, 1), pose);");
rep("  if (p.charging) { const c = clamp(MTR.t / .18, 0, 1); th = lerp(1.2, 3.0, c); fw = lerp(FP_UP, .2, c); }", "  if (p.charging) { const c = clamp(MTR.t / .18, 0, 1); th = lerp(1.2, MTR.type === 'lob' ? -.4 : 3.0, c); fw = lerp(FP_UP, MTR.type === 'lob' ? -.2 : .2, c); }");

// golpe do jogador passa a força do lob
rep("      if (!sw.meter) mod.timing = 1 - clamp(Math.abs(su - .4) / .4, 0, 1);", "      if (!sw.meter) mod.timing = 1 - clamp(Math.abs(su - .4) / .4, 0, 1);\n      if (sw.lob) mod.lobPower = sw.lob.power;");
rep("      feedback(r.label, r.mis ? 'ERROU A MÃO' : r.pop ? 'LEVANTOU' : r.wild ? 'DESCONTROLOU' : sw.meter ? RES_WORD[sw.meter.res] : qualityWord(q), null);",
    "      feedback(r.label, r.mis ? 'ERROU A MÃO' : r.pop ? 'LEVANTOU' : r.wild ? 'DESCONTROLOU' : sw.meter ? RES_WORD[sw.meter.res] : sw.lob ? sw.lob.word : qualityWord(q), null);");
rep("    const contact = overhead ? (su >= .3 && su <= .75 && racketNearBall(p, .42)) : (sw.t <= sw.dur * (sw.meter ? .9 : .8) && canHit(p, sw.type));",
    "    const contact = overhead ? (su >= .3 && su <= .75 && racketNearBall(p, .42)) : (sw.t <= sw.dur * (sw.meter || sw.lob ? .9 : .8) && canHit(p, sw.type));");

// trajetória do lob conforme a força
rep("  if (pop) spec = { label: spec.label, T: rand(1.5, 1.9), depth: [2.2, 4.2], margin: .4, noise: .4 };", `  if (pop) spec = { label: spec.label, T: rand(1.5, 1.9), depth: [2.2, 4.2], margin: .4, noise: .4 };
  let lobLong = 0;
  if (!pop && key === 'lob' && mod.lobPower !== undefined) {
    const lp = clamp(mod.lobPower, 0, 1);
    spec.T = lerp(1.25, 2.6, lp); spec.depth = [lerp(5.4, 6.4, lp), lerp(7.0, 7.6, lp)];
    spec.label = lp < .35 ? 'LOB BAIXO' : lp < .75 ? 'LOB' : 'LOB ALTO';
    lobLong = Math.max(0, mod.lobPower - 1);
  }`);
rep("  if (wild) { tgt.x += (Math.random() < .5 ? -1 : 1) * rand(.8, 2.2); tgt.z += dir * rand(1.2, 3.2); }", "  if (wild) { tgt.x += (Math.random() < .5 ? -1 : 1) * rand(.8, 2.2); tgt.z += dir * rand(1.2, 3.2); }\n  if (lobLong > 0) tgt.z += dir * (1 + lobLong * 14);");
rep("  ball.vel.copy(v); ball.state = 'live'; ball.oppMiss = mod.oppMissBoost || 0;", "  ball.vel.copy(v); ball.state = 'live'; ball.oppMiss = mod.oppMissBoost || 0;\n  ball.apex = ball.pos.y + Math.max(0, v.y) * Math.max(0, v.y) / (2 * G);");

// CPU: escolhe a força do lob e erra mais smashes de lob muito alto
rep("        p.ai.willMiss = Math.random() < D.miss * (fast ? 2 : 1) + (ball.oppMiss || 0);", "        p.ai.willMiss = Math.random() < D.miss * (fast ? 2 : 1) + (ball.oppMiss || 0) + (p.ai.shot === 'smash' || (p.ai.plan && p.ai.plan.pt.y >= 2.1) ? clamp(((ball.apex || 0) - 5.5) / 4, 0, 1) * .12 : 0);");
rep("            const r = doHit(p, shot, rand(D.q[0], D.q[1]), false);", "            const r = doHit(p, shot, rand(D.q[0], D.q[1]), false, shot === 'lob' ? { lobPower: oppNearNet(p.team) ? rand(.65, .98) : rand(.3, .95) } : {});");
fs.writeFileSync(f, s);
console.log('ok');
