const fs = require('fs'), path = require('path');
const f = process.argv[2], dir = __dirname;
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, () => b); };
const repAll = (a, b) => { if (!s.includes(a)) throw new Error('missing all ' + a.slice(0, 60)); s = s.split(a).join(b); };
const rd = n => fs.readFileSync(path.join(dir, n), 'utf8');

// ---------- efeito (spin): gravidade efetiva da bola ----------
rep('const G = 9.8;', 'const G = 9.8;\n// efeito da bola: topspin mergulha (gk > 1), slice flutua (gk < 1)\nconst bG = () => ball.state === \'live\' ? G * (ball.gk || 1) : G;');
repAll('vel.y -= G * dt; pos.addScaledVector(vel, dt);', 'vel.y -= bG() * dt; pos.addScaledVector(vel, dt);');
rep('  ball.vel.y -= G * dt;\n  ball.pos.addScaledVector(ball.vel, dt);', '  ball.vel.y -= bG() * dt;\n  ball.pos.addScaledVector(ball.vel, dt);');
rep("  const y = ball.pos.y - C.ballR, vy = ball.vel.y;\n  const t = (vy + Math.sqrt(Math.max(0, vy * vy + 2 * G * y))) / G;",
    "  const y = ball.pos.y - C.ballR, vy = ball.vel.y, g = bG();\n  const t = (vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * y))) / g;");
rep(`  let T = spec.T || Math.max(.28, d / spec.speed);
  const v = new V3();
  for (let i = 0; i < 45; i++) {
    v.set(dx / T, (tgt.y - p0.y + .5 * G * T * T) / T, dz / T);
    if (Math.sign(p0.z) === Math.sign(tgt.z) || Math.abs(v.z) < 1e-4) break;
    const tn = -p0.z / v.z; const yn = p0.y + v.y * tn - .5 * G * tn * tn;`, `  let T = spec.T || Math.max(.28, d / spec.speed);
  const v = new V3(), g = G * (spec.gk || 1);
  for (let i = 0; i < 45; i++) {
    v.set(dx / T, (tgt.y - p0.y + .5 * g * T * T) / T, dz / T);
    if (Math.sign(p0.z) === Math.sign(tgt.z) || Math.abs(v.z) < 1e-4) break;
    const tn = -p0.z / v.z; const yn = p0.y + v.y * tn - .5 * g * tn * tn;`);

// ---------- variações de golpe pela altura/posição do contato ----------
rep("const uOf = t => t === 'smash' ? SMASH_U : KU;", "const uOf = t => t.startsWith('smash') ? SMASH_U : KU;");
rep("// saque: bola na mão, lançamento, posição de troféu", `// variações: curta/defesa alta (raquete em pé, bloqueio) e baixa (raquete por baixo, cavando); smash curto, angulado, de costas e em salto
Object.assign(ACT, {
  curta_alta: [READY,
    P({ rh: [.3, .72, -.28], rp: [.9, -.2, .3], wx: .55, wr: .4, lh: [-.12, .5, -.3], lp: [-.9, -.3, .1], tw: -.2, lean: .18, crouch: .1, lunge: .25 }),
    P({ rh: [.24, .66, -.52], rp: [.9, -.3, .2], wx: .75, wr: .5, lh: [-.2, .45, -.2], lp: [-.9, -.3, .1], tw: 0, lean: .26, crouch: .14, lunge: .45 }),
    P({ rh: [.2, .55, -.6], rp: [.9, -.4, .2], wx: .95, wr: .5, lh: [-.22, .4, -.15], lp: [-.9, -.4, 0], tw: .05, lean: .3, crouch: .16, lunge: .4 }),
    READY],
  curta_baixa: [READY,
    P({ rh: [.34, .08, -.25], rp: [.9, -.6, .4], wx: 1.95, wr: .6, lh: [-.15, .3, -.3], lp: [-.9, -.5, 0], tw: -.25, lean: .48, crouch: .32, lunge: .5 }),
    P({ rh: [.28, -.04, -.5], rp: [.9, -.6, .3], wx: 2.15, wr: .75, lh: [-.25, .28, -.12], lp: [-.9, -.5, 0], tw: -.05, lean: .58, crouch: .38, lunge: .85 }),
    P({ rh: [.22, .12, -.62], rp: [.9, -.6, .2], wx: 2.0, wr: .7, lh: [-.28, .3, -.1], lp: [-.9, -.5, 0], tw: .05, lean: .52, crouch: .34, lunge: .75 }),
    READY],
  defesa_alta: [READY,
    P({ rh: [.32, .7, -.3], rp: [.8, -.3, .2], wx: .6, wr: .8, lh: [-.1, .45, -.3], lp: [-.9, -.4, 0], tw: -.2, lean: .15, bend: .08, crouch: .14, lunge: .35 }),
    P({ rh: [.34, .74, -.48], rp: [.8, -.3, .1], wx: .5, wr: .8, lh: [-.16, .45, -.24], lp: [-.9, -.4, 0], tw: -.05, lean: .18, bend: .1, crouch: .16, lunge: .45 }),
    P({ rh: [.32, .7, -.5], rp: [.8, -.3, .1], wx: .55, wr: .8, lh: [-.16, .42, -.24], lp: [-.9, -.4, 0], tw: .02, lean: .18, bend: .08, crouch: .16, lunge: .4 }),
    READY],
  defesa_baixa: [READY,
    P({ rh: [.32, .0, -.3], rp: [.8, -.7, .3], wx: 1.85, wr: .8, lh: [-.1, .25, -.3], lp: [-.9, -.5, 0], tw: -.2, lean: .52, bend: .15, crouch: .4, lunge: .85 }),
    P({ rh: [.34, -.1, -.46], rp: [.8, -.7, .2], wx: 2.0, wr: .8, lh: [-.16, .22, -.24], lp: [-.9, -.5, 0], tw: -.05, lean: .58, bend: .18, crouch: .44, lunge: .95 }),
    P({ rh: [.32, -.02, -.5], rp: [.8, -.7, .2], wx: 1.95, wr: .8, lh: [-.16, .24, -.24], lp: [-.9, -.5, 0], tw: .02, lean: .55, bend: .15, crouch: .42, lunge: .9 }),
    READY],
  smash_curto: [READY,
    P({ rh: [.3, .62, .05], rp: [.8, .7, .1], wx: -.2, lh: [-.05, .9, -.35], lp: [-.6, 0, .6], tw: -.5, lean: -.12, bend: -.06, crouch: .14 }),
    P({ rh: [.2, .58, .05], rp: [.5, .8, .1], wx: 0, lh: [-.1, .8, -.32], lp: [-.6, 0, .6], tw: -.45, lean: -.12, crouch: .12 }),
    P({ rh: [.14, .95, -.42], rp: [.5, .3, .7], wx: .35, wr: .3, lh: [-.2, .45, -.2], lp: [-.8, -.3, .3], tw: .15, lean: .12, bend: -.03, crouch: .06 }),
    P({ rh: [-.05, .3, -.45], rp: [.7, .2, -.3], wx: .6, wr: .8, lh: [-.25, .3, -.05], lp: [-.8, -.5, 0], tw: .45, lean: .45, crouch: .2 }),
    READY],
  smash_lateral: [READY,
    P({ rh: [.34, .68, .16], rp: [.8, .9, .1], wx: -.5, lh: [-.05, 1.0, -.3], lp: [-.6, 0, .6], tw: -1.0, lean: -.25, bend: -.18, crouch: .2 }),
    P({ rh: [.14, .5, .2], rp: [.3, 1.0, .1], wx: .1, lh: [-.12, .85, -.3], lp: [-.6, 0, .6], tw: -.8, lean: -.28, bend: -.15, crouch: .1 }),
    P({ rh: [.42, .85, -.3], rp: [.7, .4, .6], wx: .3, wr: -.4, lh: [-.25, .45, -.1], lp: [-.8, -.3, .3], tw: .25, lean: .02, bend: -.22, crouch: .06 }),
    P({ rh: [-.3, .15, -.2], rp: [.7, .2, -.3], wx: .6, wr: 1.4, lh: [-.25, .25, .05], lp: [-.8, -.5, 0], tw: .9, lean: .5, bend: .1, crouch: .25 }),
    READY],
  smash_costas: [READY,
    P({ rh: [.3, .7, .25], rp: [.8, .9, .1], wx: -.6, lh: [-.05, 1.1, -.2], lp: [-.6, 0, .6], tw: -.8, lean: -.45, bend: -.12, crouch: .2 }),
    P({ rh: [.1, .55, .28], rp: [.3, 1.0, .1], wx: .1, lh: [-.12, .9, -.25], lp: [-.6, 0, .6], tw: -.65, lean: -.45, bend: -.1, crouch: .14 }),
    P({ rh: [.12, 1.05, -.05], rp: [.5, .5, .7], wx: .1, wr: .3, lh: [-.2, .5, -.1], lp: [-.8, -.3, .3], tw: .05, lean: -.25, bend: -.05, crouch: .08 }),
    P({ rh: [-.15, .3, -.25], rp: [.7, .2, -.3], wx: .5, wr: .9, lh: [-.25, .3, .05], lp: [-.8, -.5, 0], tw: .5, lean: .25, crouch: .2 }),
    READY],
});
ACT.smash_salto = ACT.smash;
// efeito de cada variação no golpe
const VAR_FX = {
  smash_curto: { label: 'SMASH CURTO', speed: 1.08, depth: [2.6, 4.8], gk: 1.4 },
  smash_lateral: { label: 'SMASH ANGULADO', speed: .95, depth: [3.0, 5.4], gk: 1.45, wide: true },
  smash_costas: { label: 'SMASH DE COSTAS', speed: .86, noise: 1.3, gk: 1.25 },
  smash_salto: { label: 'SMASH EM SALTO', speed: 1.05, gk: 1.4, jump: true },
  curta_alta: { label: 'CURTA DE VOLEIO', depth: [.9, 2.0], T: .75 },
  curta_baixa: { label: 'CURTA POR BAIXO', T: 1.05, gk: .7, noise: 1.1 },
  defesa_alta: { label: 'DEFESA ALTA', T: 1.1 },
  defesa_baixa: { label: 'DEFESA RASPANDO', T: 1.35, noise: 1.15 },
};
function swingVar(type, y, p, aimX) {
  if (type === 'curta' || type === 'defesa') return y >= 1.3 ? 'alta' : y < .62 ? 'baixa' : '';
  if (type !== 'smash' || y < 1.9) return '';
  const behind = (ball.pos.z - p.pos.z) * (p.team === 0 ? 1 : -1);
  if (behind > .3) return 'costas';
  if (Math.abs(p.pos.z) < 2.6 && y < 2.7) return 'curto';
  if (aimX !== undefined && Math.abs(aimX) > (C.halfW - .6) * .6) return 'lateral';
  if (y > 2.55) return 'salto';
  return '';
}
const swingKey = p => p.swing.var && ACT[p.swing.type + '_' + p.swing.var] ? p.swing.type + '_' + p.swing.var : p.swing.type;
// saque: bola na mão, lançamento, posição de troféu`);
rep("  else if (p.swing.t >= 0) { swingU = clamp(p.swing.t / p.swing.dur, 0, 1); poseAt(ACT[p.swing.type], uOf(p.swing.type), swingU, pose);",
    "  else if (p.swing.t >= 0) { swingU = clamp(p.swing.t / p.swing.dur, 0, 1); const ak = swingKey(p); poseAt(ACT[ak], uOf(ak), swingU, pose);");
rep("    sw.side = sideOf(human, humanPlan.id === S.hitId && humanPlan.plan ? humanPlan.plan.pt : null);",
    "    sw.side = sideOf(human, humanPlan.id === S.hitId && humanPlan.plan ? humanPlan.plan.pt : null);\n    sw.var = swingVar(type, humanPlan.id === S.hitId && humanPlan.plan ? humanPlan.plan.pt.y : ball.pos.y, human);");
rep("sw.meter = { res, amt, ideal: MTR.ideal }; sw.hold = 0;", "sw.meter = { res, amt, ideal: MTR.ideal }; sw.hold = 0; sw.var = swingVar('smash', ball.pos.y, human);");
rep("sw.lob = { power: lv, word }; sw.side = sideOf(human);", "sw.lob = { power: lv, word }; sw.side = sideOf(human); sw.var = '';");
rep("      sp.swing.t = sp.swing.dur * .3; sp.swing.type = 'smash'; sp.swing.hit = false;", "      sp.swing.t = sp.swing.dur * .3; sp.swing.type = 'smash'; sp.swing.hit = false; sp.swing.var = '';");
rep("p.swing.hit = false; p.swing.side = sideOf(p, p.ai.plan ? p.ai.plan.pt : null);", "p.swing.hit = false; p.swing.side = sideOf(p, p.ai.plan ? p.ai.plan.pt : null); p.swing.var = swingVar(shot, p.ai.plan ? p.ai.plan.pt.y : ball.pos.y, p);");
rep("  players.forEach(p => { p.vel.set(0, 0, 0); p.swing.t = -1;", "  players.forEach(p => { p.vel.set(0, 0, 0); p.swing.t = -1; p.swing.var = '';");

// ---------- contato: centro x aro, adiantado x atrasado ----------
rep("  const inSpeed = Math.hypot(ball.vel.x, ball.vel.z);\n  const pressure = isServe || key === 'smash' ? 0",
`  let contactWord = '';
  if (!isServe) {
    // posição da bola em relação ao corpo: lateral (lado da raquete +) e à frente (+)
    const fwdS = p.team === 0 ? -1 : 1, rightS = (p.team === 0 ? 1 : -1) * (p.lefty ? -1 : 1);
    const lat = (ball.pos.x - p.pos.x) * rightS, fwd = (ball.pos.z - p.pos.z) * fwdS;
    const over = key === 'smash', iLat = over ? .25 : bhSide ? -.6 : .7, iFwd = over ? .15 : .25;
    const off = Math.hypot(over ? lat - iLat : Math.abs(lat) - Math.abs(iLat), fwd - iFwd);
    const sweet = 1 - clamp((off - .2) / .75, 0, 1);
    q *= lerp(.8, 1.03, sweet);
    mod.speedMul = (mod.speedMul || 1) * lerp(.88, 1.04, sweet); mod.noiseMul = (mod.noiseMul || 1) * lerp(1.45, .95, sweet);
    if (sweet < .3) contactWord = 'NO ARO'; else if (sweet > .9) contactWord = 'NO MEIO';
    // bater adiantado puxa a bola para a diagonal; atrasado, para a paralela
    const early = fwd - iFwd;
    if (!over && Math.abs(early) > .3) { mod.aimShift = clamp(-early * 1.3 * (bhSide ? -1 : 1), -1.2, 1.2) * rightS; contactWord = contactWord || (early > 0 ? 'ADIANTADO' : 'ATRASADO'); }
  }
  const inSpeed = Math.hypot(ball.vel.x, ball.vel.z);
  const pressure = isServe || key === 'smash' ? 0`);
rep("  const aim = pop ? rand(-1, 1) * (C.halfW - 1) : clamp(p.isHuman ? humanAim() : aiAim(p), -lim, lim);",
`  let aim = pop ? rand(-1, 1) * (C.halfW - 1) : clamp(p.isHuman ? humanAim() : aiAim(p), -lim, lim);
  if (mod.aimShift) aim = clamp(aim + mod.aimShift, -lim - .45, lim + .45);
  // variação do golpe conforme o contato
  const vr = isServe || pop ? '' : swingVar(type, ball.pos.y, p, aim);
  const vfx = vr && key !== 'drive' ? VAR_FX[type + '_' + vr] : null;
  if (vfx) {
    if (!finisher) spec.label = vfx.label;
    if (vfx.speed && spec.speed) spec.speed *= vfx.speed; if (vfx.depth) spec.depth = vfx.depth; if (vfx.T && spec.T) spec.T = vfx.T;
    if (vfx.noise) spec.noise *= vfx.noise; if (vfx.gk) spec.gk = vfx.gk;
    if (vfx.wide) aim = Math.sign(aim || rand(-1, 1)) * lim * .92;
    if (vfx.jump) startJump(p, .5, .42);
  }
  if (!isServe) p.swing.var = vr;
  if (!spec.gk) spec.gk = pop ? 1 : isServe ? (type === 'smash' ? 1.25 : 1) : ({ smash: 1.35, drive: 1.18, lob: 1.1, curta: .8, defesa: 1 }[key] || 1);`);
rep("  const depth = rand(spec.depth[0], spec.depth[1]);", "  const depth = p.isHuman && !pop && !isServe ? lerp(spec.depth[0], spec.depth[1], humanDepthT()) + rand(-.2, .2) : rand(spec.depth[0], spec.depth[1]);");
rep("  ball.vel.copy(v); ball.state = 'live';", "  ball.vel.copy(v); ball.gk = spec.gk || 1; ball.state = 'live';");
rep("  return { key, label: spec.label, mis, pop, wild, grade, pressure, backhand: bhSide };", "  return { key, label: spec.label, mis, pop, wild, grade, pressure, backhand: bhSide, contact: contactWord };");
rep("qualityWord(q) + (r.backhand ? ' · BACKHAND' : ''), null);", "qualityWord(q) + (r.backhand ? ' · BACKHAND' : '') + (r.contact ? ' · ' + r.contact : ''), null);");

// ---------- mira ----------
rep(`function humanAim() {
  const ix = human.inputX; const lim = C.halfW - .6;
  if (Math.abs(ix) > .25) return clamp(ix, -1, 1) * lim;
  return gapX(0, .3) * .8;
}`, `function humanAim() {
  const ix = human.inputX; const lim = C.halfW - .6;
  if (Math.abs(ix) > .25) return clamp(ix, -1, 1) * lim;
  return aimAutoX(); // sem direção: o maior espaço vazio (fixo por bola, para a mira não tremer)
}
` + rd('aim.js'));
rep("function updateVisuals(dt) {", "function updateVisuals(dt) {\n  updateAimMarker();");
rep(`        <label class="chk"><input type="checkbox" id="assistMark" checked> Mostrar onde a bola cai e o seu alcance <kbd>N</kbd></label>`,
    `        <label class="chk"><input type="checkbox" id="assistMark" checked> Mostrar onde a bola cai e o seu alcance <kbd>N</kbd></label>
        <label class="chk"><input type="checkbox" id="aimArrow" checked> Mostrar a mira: seta, alvo e trajetória (A/D lado, W/S profundidade) <kbd>V</kbd></label>`);
rep("S.settings.assistMove = $('assistMove').checked; S.settings.assistMark = $('assistMark').checked;", "S.settings.assistMove = $('assistMove').checked; S.settings.assistMark = $('assistMark').checked; S.settings.aimArrow = $('aimArrow').checked;");
rep("  $('assistMove').checked = !!S.settings.assistMove; $('assistMark').checked = !!S.settings.assistMark;", "  $('assistMove').checked = !!S.settings.assistMove; $('assistMark').checked = !!S.settings.assistMark; $('aimArrow').checked = S.settings.aimArrow !== false;");
rep("  else if (k === 'n') toggleAssist('assistMark');", "  else if (k === 'n') toggleAssist('assistMark');\n  else if (k === 'v') { S.settings.aimArrow = S.settings.aimArrow === false; saveSettings(); feedback('MIRA', S.settings.aimArrow ? 'LIGADA' : 'DESLIGADA', null); }");
rep(" ou setas para correr. A direção que você segura na hora do golpe define a mira.", " ou setas para correr. Na hora do golpe, A/D escolhem o lado e W/S a profundidade (curta ou funda).");

// ---------- movimento: inércia, troca de direção e passo até o contato ----------
rep("  p.inputX = ix;\n", "  p.inputX = ix; p.inputZ = iz;\n");
rep("  const k = Math.min(1, dt * 7);\n  p.vel.x += (tvx - p.vel.x) * k; p.vel.z += (tvz - p.vel.z) * k;\n  p.pos.addScaledVector(p.vel, dt);\n  clampPos(p);\n  if (serving && S.mode === 'serve')",
`  // passo até o ponto de contato enquanto arma o golpe (encaixe, estilo FIFA/2K)
  const sw0 = p.swing;
  if (sw0.t >= 0 && !sw0.hit && S.mode === 'rally' && ball.state === 'live' && S.lastTeam === 1) {
    if (humanPlan.id !== S.hitId) { humanPlan.plan = planIntercept(p, P_SPEED * .6, 0); humanPlan.id = S.hitId; }
    const pl = humanPlan.plan;
    if (pl) {
      const rightS = p.lefty ? -1 : 1, over = sw0.type === 'smash' && pl.pt.y >= 1.9, back = !over && sw0.side < -.15;
      const ix2 = pl.pt.x - rightS * (over ? .25 : back ? -.6 : .7), iz2 = pl.pt.z + (over ? .15 : .25);
      const dx = ix2 - p.pos.x, dz = iz2 - p.pos.z, dd = Math.hypot(dx, dz);
      if (dd > .05 && dd < .8) { const a = Math.min(1.8, dd * 5); tvx += dx / dd * a; tvz += dz / dd * a; }
    }
  }
  // inércia: trocar de direção custa uma passada; parar é rápido
  const rev = tvx * p.vel.x + tvz * p.vel.z < 0;
  const k = Math.min(1, dt * (rev ? 5 : len < .1 ? 9 : 7.5));
  p.vel.x += (tvx - p.vel.x) * k; p.vel.z += (tvz - p.vel.z) * k;
  p.pos.addScaledVector(p.vel, dt);
  clampPos(p);
  if (serving && S.mode === 'serve')`);
// corpo: inclina com aceleração/freada; passo lateral sem cruzar as pernas
rep("  const idle = (1 - run) * (acting ? 0 : 1);",
`  const idle = (1 - run) * (acting ? 0 : 1);
  if (!p.prevVel) p.prevVel = new V3();
  const acx = dt > 0 ? (p.vel.x - p.prevVel.x) / dt : 0, acz = dt > 0 ? (p.vel.z - p.prevVel.z) / dt : 0; p.prevVel.copy(p.vel);
  const cya = Math.cos(yaw), sya = Math.sin(yaw);
  p.accF = (p.accF || 0) + (clamp(-(sya * acx + cya * acz), -14, 14) - (p.accF || 0)) * Math.min(1, dt * 8);
  p.accR = (p.accR || 0) + (clamp(cya * acx - sya * acz, -14, 14) - (p.accR || 0)) * Math.min(1, dt * 8);
  const accLean = clamp(p.accF * .022, -.22, .22), accRoll = clamp(p.accR * .018, -.16, .16);
  m.hips.position.x += clamp(-p.accR * .006, -.05, .05);`);
rep("  m.spine.rotation.set(-(pose.lean + run * .1) + Math.sin(p.breath * 1.9) * .012 * idle, pose.tw - Math.sin(p.gait) * .16 * run, -pose.bend - Math.cos(p.gait) * .03 * run);",
    "  m.spine.rotation.set(-(pose.lean + run * .1) - accLean + Math.sin(p.breath * 1.9) * .012 * idle, pose.tw - Math.sin(p.gait) * .16 * run, -pose.bend - Math.cos(p.gait) * .03 * run - accRoll);");
rep("    const ph = p.gait + (i ? Math.PI : 0);", "    const shuffle = sp > .25 && sp < 4.2 ? Math.abs(lvx) : 0; // deslocamento lateral: passo cruzado vira passo lateral\n    const ph = p.gait + (i ? Math.PI * (1 - .45 * shuffle) : 0);");
rep("    if (sp > .25) { fx += lvx * stride * Math.cos(ph); fz += lvz * stride * Math.cos(ph);", "    if (sp > .25) { fx += lvx * stride * (1 - .4 * shuffle) * Math.cos(ph); fz += lvz * stride * Math.cos(ph);");
fs.writeFileSync(f, s); console.log('ok');
