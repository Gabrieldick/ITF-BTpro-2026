const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };
const repAll = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.split(a).join(b); };

// ---------- CSS ----------
rep(".seg { border: 0; margin: 0; padding: 0;", `.roster { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 10px; }
.pick { border: 2px solid #e3d9c4; border-radius: 14px; padding: 10px 12px; background: #fff; display: grid; gap: 7px; min-width: 0; }
.pick-h { display: flex; align-items: center; gap: 6px; }
.pick-h .who { flex: 1; font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
.arw { width: 30px; height: 28px; border-radius: 8px; border: 2px solid #d9cfba; background: #fff; font-weight: 800; font-size: 16px; line-height: 1; color: var(--ink); }
.arw:hover { border-color: var(--ink); }
.pick-top { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
.pick .pnm { font: 800 16px var(--f-body); border: 0; border-bottom: 1px dashed #cbbfa6; background: transparent; width: 100%; color: var(--ink); padding: 2px 0; min-width: 0; }
.pick .meta { font-size: 12px; color: #5b6b78; margin-top: 2px; }
.ovr { font-family: var(--f-display); font-size: 24px; width: 52px; height: 52px; border-radius: 50%; display: grid; place-items: center; background: var(--ink); color: var(--gold); line-height: 1; }
.ovr small { display: block; font-family: var(--f-num); font-size: 8px; letter-spacing: .12em; color: #cfc5ae; }
.bars { display: grid; grid-template-columns: 64px 1fr 24px; gap: 3px 8px; font-size: 11px; align-items: center; font-variant-numeric: tabular-nums; color: #3c4d5c; }
.bar { height: 6px; background: #ece3d0; border-radius: 3px; overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--tape); border-radius: 3px; }
.bar i.hi { background: #2e9e63; } .bar i.lo { background: #e07b2a; }
.toggles { display: grid; gap: 8px; }
.seg { border: 0; margin: 0; padding: 0;`);

// ---------- HTML: personagens + assistência dividida ----------
rep(`    <div class="opts">
      <fieldset class="seg"><legend>Modalidade</legend>`, `    <div>
      <p class="section-label">Jogadores · overall de 0 a 100</p>
      <div class="roster" id="roster">
        <div class="pick" data-slot="me"></div>
        <div class="pick" data-slot="mate"></div>
        <div class="pick" data-slot="o1"></div>
        <div class="pick" data-slot="o2"></div>
      </div>
    </div>
    <div class="opts">
      <fieldset class="seg"><legend>Modalidade</legend>`);
rep(`      <label class="chk"><input type="checkbox" id="assist" checked> Assistência: marca onde a bola cai e ajuda a correr</label>`,
`      <div class="toggles">
        <label class="chk"><input type="checkbox" id="assistMove" checked> Seguir a bola: o jogador corre sozinho até ela <kbd>B</kbd></label>
        <label class="chk"><input type="checkbox" id="assistMark" checked> Mostrar onde a bola cai e o seu alcance <kbd>N</kbd></label>
      </div>`);
rep(`      <button class="ghost" id="btnPauseCam">Trocar câmera</button>`, `      <button class="ghost" id="btnPauseCam">Trocar câmera</button>
      <button class="ghost" id="btnAsMove">Seguir a bola</button>
      <button class="ghost" id="btnAsMark">Onde a bola cai</button>`);
rep("<kbd>C</kbd> troca a câmera · <kbd>Esc</kbd> pausa", "<kbd>C</kbd> troca a câmera · <kbd>B</kbd>/<kbd>N</kbd> assistências · <kbd>Esc</kbd> pausa");

// ---------- configurações ----------
rep("settings: { mode: 'simples', cam: '3p', diff: 'medio', games: 4, assist: true,", "settings: { pick: { me: 'luca', mate: 'giulia', o1: 'diego', o2: 'marina' }, assistMove: true, assistMark: true, mode: 'simples', cam: '3p', diff: 'medio', games: 4, assist: true,");
rep("if (savedSettings) Object.assign(S.settings, savedSettings);", `if (savedSettings) {
  Object.assign(S.settings, savedSettings);
  if (savedSettings.assistMove === undefined && savedSettings.assist !== undefined) { S.settings.assistMove = S.settings.assistMark = !!savedSettings.assist; }
  S.settings.pick = Object.assign({ me: 'luca', mate: 'giulia', o1: 'diego', o2: 'marina' }, savedSettings.pick || {});
}`);
rep("  S.settings.assist = $('assist').checked;\n  saveSettings();", "  S.settings.assistMove = $('assistMove').checked; S.settings.assistMark = $('assistMark').checked;\n  saveSettings();");
rep("  $('assist').checked = !!S.settings.assist;\n}", "  $('assistMove').checked = !!S.settings.assistMove; $('assistMark').checked = !!S.settings.assistMark;\n  renderRoster();\n}");
rep("  if (S.settings.assist && len < .1 && S.mode === 'rally'", "  if (S.settings.assistMove && len < .1 && S.mode === 'rally'");
rep("  if (incoming && S.settings.assist) {", "  if (incoming && S.settings.assistMark) {");
rep("  reachRing.visible = S.mode !== 'menu' && !fp && S.settings.assist;", "  reachRing.visible = S.mode !== 'menu' && !fp && S.settings.assistMark;");

// teclas: não atrapalhar quem digita nome; B e N ligam/desligam assistências
rep("addEventListener('keydown', e => {\n  const k = e.key.toLowerCase();", "addEventListener('keydown', e => {\n  if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'text') return;\n  const k = e.key.toLowerCase();");
rep("  else if (k === 'm') toggleSound();\n});", "  else if (k === 'm') toggleSound();\n  else if (k === 'b') toggleAssist('assistMove');\n  else if (k === 'n') toggleAssist('assistMark');\n});");
rep("$('btnPauseCam').addEventListener('click', () => { toggleCam(); setPaused(false); });", `$('btnPauseCam').addEventListener('click', () => { toggleCam(); setPaused(false); });
$('btnAsMove').addEventListener('click', () => toggleAssist('assistMove'));
$('btnAsMark').addEventListener('click', () => toggleAssist('assistMark'));
function syncAssistButtons() {
  $('btnAsMove').textContent = 'Seguir a bola: ' + (S.settings.assistMove ? 'ligado' : 'desligado');
  $('btnAsMark').textContent = 'Onde a bola cai: ' + (S.settings.assistMark ? 'ligado' : 'desligado');
}
function toggleAssist(k) {
  S.settings[k] = !S.settings[k]; saveSettings(); syncAssistButtons();
  feedback('ASSISTÊNCIA', (k === 'assistMove' ? 'SEGUIR A BOLA ' : 'MARCADOR ') + (S.settings[k] ? 'LIGADO' : 'DESLIGADO'), null);
}`);
rep("function setPaused(v) { if (!inPlay() && v) return; S.paused = v; el.pause.hidden = !v; if (v) $('btnResume').focus(); }",
    "function setPaused(v) { if (!inPlay() && v) return; S.paused = v; el.pause.hidden = !v; if (v) { syncAssistButtons(); $('btnResume').focus(); } }");

// ---------- elenco e atributos ----------
rep("const clamp = (v, a, b) => Math.max(a, Math.min(b, v));", `const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// elenco fictício inspirado em estilos de jogo do circuito; nomes podem ser trocados no menu
const ATTRS = [['forca', 'Força'], ['vel', 'Velocidade'], ['def', 'Defesa'], ['curta', 'Curta'], ['lob', 'Lob'], ['smash', 'Smash'], ['saque', 'Saque']];
const ATTR_W = { forca: .14, vel: .16, def: .16, curta: .12, lob: .12, smash: .16, saque: .14 };
const ROSTER = [
  { id: 'luca',   name: 'Luca Ferrante',  pais: 'ITA', estilo: 'Finalizador',       a: { forca: 92, vel: 78, def: 74, curta: 70, lob: 72, smash: 93, saque: 86 }, look: { skin: '#d2a07a', hair: '#2b1d14', cap: '#fbf6ea', glasses: true, band: true, num: '7', racket: 'proteo' } },
  { id: 'diego',  name: 'Diego Brandão',  pais: 'BRA', estilo: 'Muralha na defesa', a: { forca: 76, vel: 88, def: 93, curta: 80, lob: 85, smash: 79, saque: 77 }, look: { skin: '#8d5a3b', hair: '#120c08', glasses: true, band: true, num: '10', racket: 'kronos' } },
  { id: 'thiago', name: 'Thiago Marins',  pais: 'BRA', estilo: 'Saque e smash',     a: { forca: 91, vel: 72, def: 70, curta: 64, lob: 70, smash: 88, saque: 94 }, look: { skin: '#c68a5e', hair: '#3a2615', visor: '#17324d', num: '3', racket: 'medusa' } },
  { id: 'matteo', name: 'Matteo Ravelli', pais: 'ITA', estilo: 'Mão de seda',       a: { forca: 70, vel: 80, def: 84, curta: 93, lob: 88, smash: 75, saque: 74 }, look: { skin: '#e2b48f', hair: '#5a3a1e', cap: '#0b7a83', num: '21', racket: 'supercarbon' } },
  { id: 'rafa',   name: 'Rafa Quiroga',   pais: 'ESP', estilo: 'Completo',          a: { forca: 82, vel: 82, def: 82, curta: 80, lob: 80, smash: 82, saque: 80 }, look: { skin: '#c99068', hair: '#1b120c', cap: '#17324d', glasses: true, num: '5', racket: 'kronos' } },
  { id: 'bruno',  name: 'Bruno Toledo',   pais: 'BRA', estilo: 'Promessa',          a: { forca: 70, vel: 74, def: 62, curta: 60, lob: 64, smash: 66, saque: 64 }, look: { skin: '#b07a52', hair: '#2a1a0e', num: '18', racket: 'proteo' } },
  { id: 'giulia', name: 'Giulia Santoro', pais: 'ITA', estilo: 'Completa',          fem: true, a: { forca: 82, vel: 86, def: 88, curta: 86, lob: 88, smash: 86, saque: 84 }, look: { skin: '#e2b48f', hair: '#6a3f1d', visor: '#fbf6ea', tank: true, num: '11', racket: 'medusa' } },
  { id: 'marina', name: 'Marina Duarte',  pais: 'BRA', estilo: 'Defensora veloz',   fem: true, a: { forca: 72, vel: 92, def: 91, curta: 78, lob: 84, smash: 76, saque: 76 }, look: { skin: '#a8704a', hair: '#1b120c', visor: '#17324d', glasses: true, tank: true, num: '8', racket: 'supercarbon' } },
  { id: 'carla',  name: 'Carla Bianchi',  pais: 'ITA', estilo: 'Rainha do lob',     fem: true, a: { forca: 70, vel: 80, def: 84, curta: 82, lob: 94, smash: 74, saque: 78 }, look: { skin: '#efc6a3', hair: '#a8743a', cap: '#fbf6ea', glasses: true, tank: true, num: '4', racket: 'proteo' } },
  { id: 'livia',  name: 'Lívia Prado',    pais: 'BRA', estilo: 'Saque bomba',       fem: true, a: { forca: 88, vel: 76, def: 72, curta: 68, lob: 72, smash: 84, saque: 92 }, look: { skin: '#c68a5e', hair: '#2b1d14', visor: '#ff5a1f', tank: true, num: '9', racket: 'kronos' } },
  { id: 'sofia',  name: 'Sofía Martín',   pais: 'ESP', estilo: 'Jogo de rede',      fem: true, a: { forca: 74, vel: 84, def: 80, curta: 91, lob: 80, smash: 80, saque: 76 }, look: { skin: '#d8a47e', hair: '#3a2615', glasses: true, tank: true, num: '13', racket: 'medusa' } },
  { id: 'nina',   name: 'Nina Alves',     pais: 'BRA', estilo: 'Iniciante',         fem: true, a: { forca: 58, vel: 66, def: 60, curta: 58, lob: 62, smash: 56, saque: 58 }, look: { skin: '#8d5a3b', hair: '#120c08', visor: '#fbf6ea', tank: true, num: '1', racket: 'supercarbon' } },
];
const overall = a => Math.round(Object.keys(ATTR_W).reduce((t, k) => t + a[k] * ATTR_W[k], 0));
let NAMES = {};
try { NAMES = JSON.parse(localStorage.getItem('pdo-names') || '{}') || {}; } catch (e) { NAMES = {}; }
const charById = id => ROSTER.find(c => c.id === id) || ROSTER[0];
const nameOf = c => (NAMES[c.id] && NAMES[c.id].trim()) || c.name;
const shortOf = c => { const w = nameOf(c).trim().split(/\\s+/); return w[w.length - 1].toUpperCase(); };
const KITS = [
  [{ shirt: '#ff5a1f', trim: '#fbf6ea', shorts: '#17324d' }, { shirt: '#ff7a3d', trim: '#17324d', shorts: '#17324d' }],
  [{ shirt: '#0b7a83', trim: '#fbf6ea', shorts: '#f2efe6' }, { shirt: '#13939c', trim: '#ffd23f', shorts: '#f2efe6' }],
];
const ATTR_OF = { smash: 'smash', drive: 'smash', lob: 'lob', curta: 'curta', defesa: 'def' };
const attrK = (p, k) => (p.char ? p.char.a[k] : 70) / 100;`);

// habilidade da CPU e da parceira a partir dos atributos + cérebro da dificuldade
rep("const skillOf = p => p.team === 0 ? DIFF.medio : DIFF[S.settings.diff];", `function charSkill(p) {
  const brain = p.team === 0 ? DIFF.medio : DIFF[S.settings.diff];
  if (!p.char) return brain;
  const a = p.char.a, tech = (a.curta + a.lob + a.smash + a.def) / 400;
  const dm = p.team === 1 ? { facil: .9, medio: 1, dificil: 1.06 }[S.settings.diff] : 1;
  return {
    speed: (3.4 + a.vel * .027) * dm, react: brain.react, smart: brain.smart, letGo: brain.letGo,
    miss: brain.miss * lerp(1.7, .45, a.def / 100), err: brain.err * lerp(1.7, .45, tech),
    q: [clamp(brain.q[0] - .12 + tech * .16, .25, .95), clamp(brain.q[1] - .08 + tech * .1, .4, 1)],
  };
}
const skillOf = p => p.skill || (p.team === 0 ? DIFF.medio : DIFF[S.settings.diff]);`);

// alcance da defesa e qualidade do golpe dependem dos atributos
rep("function reachOf(type) { return type === 'defesa' ? 1.75 : 1.35; }", "function reachOf(type, p) { return type === 'defesa' ? 1.55 + (p ? attrK(p, 'def') : .65) * .32 : 1.35; }");
rep("  return dh <= reachOf(type) * (scale || 1) && ball.pos.y >= .12 && ball.pos.y <= maxY;", "  return dh <= reachOf(type, p) * (scale || 1) && ball.pos.y >= .12 && ball.pos.y <= maxY;");
rep("  const reach = reachOf(type);\n  const idealY", "  const reach = reachOf(type, p);\n  const idealY");
rep("  if (type === 'defesa') q = Math.max(q, .6);\n  return clamp(q, .1, 1);", "  if (type === 'defesa') q = Math.max(q, .6);\n  q *= lerp(.86, 1.06, attrK(p, ATTR_OF[type] || 'def'));\n  return clamp(q, .1, 1);");

// pressão: defesa do jogador reduz bola levantada/fora
rep("    const qq = mod.timing === undefined ? q : q * .6 + mod.timing * .4;", "    const qq = clamp((mod.timing === undefined ? q : q * .6 + mod.timing * .4) + (attrK(p, 'def') - .7) * .5, 0, 1);");
// força, precisão e saque
rep("  const dir = p.team === 0 ? -1 : 1;\n  const lim = C.halfW - .35;", `  if (p.char) {
    const A = p.char.a;
    spec.noise *= lerp(1.6, .65, (isServe ? A.saque : A[ATTR_OF[key]] || A.def) / 100);
    if (!isServe && (key === 'smash' || key === 'drive')) spec.speed *= lerp(.82, 1.12, A.forca / 100);
    if (isServe && spec.speed) spec.speed *= lerp(.88, 1.1, (A.forca + A.saque) / 200);
    if (isServe) mod.oppMissBoost = (mod.oppMissBoost || 0) + Math.max(0, (A.saque - 60) / 100) * .18;
  }
  const dir = p.team === 0 ? -1 : 1;
  const lim = C.halfW - .35;`);
// faixa verde: smash e saque
rep("  if (kind === 'smash') MTR.half *= smashZoneScale();", "  if (kind === 'smash') MTR.half *= smashZoneScale() * clamp((human.char.a.smash - 35) / 58, .3, 1.1);\n  if (kind === 'serve') MTR.half *= clamp((human.char.a.saque - 35) / 55, .3, 1.15);");
// velocidade do jogador
rep("  const spd = P_SPEED * (p.charging ? .75 : 1);", "  const spd = P_SPEED * lerp(.82, 1.12, attrK(p, 'vel')) * (p.charging ? .75 : 1);");
// CPU erra mais smash com nota baixa
rep("        p.ai.willMiss = Math.random() < D.miss * (fast ? 2 : 1) + (ball.oppMiss || 0)", "        p.ai.willMiss = Math.random() < D.miss * (fast ? 2 : 1) + (ball.oppMiss || 0) + (p.ai.shot === 'smash' ? (1 - attrK(p, 'smash')) * .12 : 0)");

// nomes no placar e nos avisos
rep("  $('nmP').textContent = dupla() ? 'VOCÊS' : 'VOCÊ';", `  const tn = t => teams[t].map(p => p.char ? (dupla() ? shortOf(p.char).slice(0, 4) : shortOf(p.char)) : 'CPU').join('/');
  $('nmP').textContent = tn(0); $('nmC').textContent = tn(1);`);
rep("const whoTag = p => p.isHuman ? '' : p.team === 0 ? 'PARCEIRA · ' : 'CPU · ';", "const whoTag = p => p.isHuman ? '' : (p.char ? shortOf(p.char) : p.team === 0 ? 'PARCEIRA' : 'CPU') + ' · ';");

// trocar o visual conforme o personagem
rep("function applyRackets() {\n  const keys = Object.keys(RACKETS); const mine = RACKETS[S.settings.racket] ? S.settings.racket : 'proteo';\n  const others = keys.filter(x => x !== mine);\n  [[human, mine], [partner, others[0]], [cpuA, others[1]], [cpuB, others[2]]].forEach(([p, key]) => {",
`function rebuildModel(p, look) {
  const vis = p.model.group.visible;
  scene.remove(p.model.group);
  p.look = look; p.model = makeAthlete(look); p.model.group.visible = vis;
  if (p.skin) { scene.remove(p.skin.holder); scene.remove(p.skin.racket); p.skin = null; }
  if (GLB.male && GLB.female) { try { attachSkin(p, look.fem ? GLB.female : GLB.male); } catch (e) { p.skin = null; } }
}
function assignCharacters() {
  const pk = S.settings.pick;
  [[human, pk.me, 0, 0], [partner, pk.mate, 0, 1], [cpuA, pk.o1, 1, 0], [cpuB, pk.o2, 1, 1]].forEach(([p, id, team, idx]) => {
    const c = charById(id);
    p.char = c;
    const look = Object.assign({}, c.look, KITS[team][idx], { fem: !!c.fem });
    if (p.lookKey !== c.id) { rebuildModel(p, look); p.lookKey = c.id; }
    p.skill = p.isHuman ? null : charSkill(p);
    p.name = nameOf(c);
  });
  if (fpSkin) fpSkin.color.copy(col(human.look.skin));
}
function applyRackets() {
  const mine = RACKETS[S.settings.racket] ? S.settings.racket : 'proteo';
  [[human, mine], [partner, partner.char ? partner.char.look.racket : 'medusa'], [cpuA, cpuA.char ? cpuA.char.look.racket : 'kronos'], [cpuB, cpuB.char ? cpuB.char.look.racket : 'supercarbon']].forEach(([p, key]) => {`);
rep("  const skin = mat('#c68a5e', { roughness: .55 });", "  const skin = mat('#c68a5e', { roughness: .55 }); fpSkin = skin;");
rep("let fpWrist = null;", "let fpWrist = null, fpSkin = null;");
rep("function newMatch() {\n  configureMode();", "function newMatch() {\n  assignCharacters();\n  configureMode();");
rep("    if (ok) { try { attachSkin(human, GLB.male); attachSkin(cpuA, GLB.male); attachSkin(partner, GLB.female); attachSkin(cpuB, GLB.female); } catch (e) { console.warn('modelos 3D indisponíveis', e); } }",
    "    assignCharacters(); configureMode();");

// ---------- seletor de personagens no menu ----------
rep("function startFromMenu() {", `const SLOT_LABEL = { me: 'Você', mate: 'Sua dupla', o1: 'Adversário', o2: 'Adversário 2' };
function renderPick(slot) {
  const box = document.querySelector('.pick[data-slot="' + slot + '"]'); if (!box) return;
  const c = charById(S.settings.pick[slot]);
  box.hidden = !dupla() && (slot === 'mate' || slot === 'o2');
  const bars = ATTRS.map(([k, lbl]) => { const v = c.a[k]; return '<span>' + lbl + '</span><span class="bar"><i class="' + (v >= 85 ? 'hi' : v <= 65 ? 'lo' : '') + '" style="width:' + v + '%"></i></span><b>' + v + '</b>'; }).join('');
  box.innerHTML = '<div class="pick-h"><span class="who">' + SLOT_LABEL[slot] + '</span><button type="button" class="arw" data-d="-1" aria-label="Anterior">‹</button><button type="button" class="arw" data-d="1" aria-label="Próximo">›</button></div>'
    + '<div class="pick-top"><div style="min-width:0"><input class="pnm" type="text" id="nm-' + slot + '" maxlength="28" aria-label="Nome do jogador"><div class="meta">' + c.pais + ' · ' + c.estilo + (c.fem ? ' · feminino' : ' · masculino') + '</div></div>'
    + '<div class="ovr">' + overall(c.a) + '<small>OVR</small></div></div><div class="bars">' + bars + '</div>';
  const inp = box.querySelector('.pnm'); inp.value = nameOf(c);
  inp.addEventListener('input', () => { NAMES[c.id] = inp.value; try { localStorage.setItem('pdo-names', JSON.stringify(NAMES)); } catch (e) {} });
  box.querySelectorAll('.arw').forEach(b => b.addEventListener('click', () => cyclePick(slot, +b.dataset.d)));
}
function renderRoster() { ['me', 'mate', 'o1', 'o2'].forEach(renderPick); }
function cyclePick(slot, d) {
  const active = dupla() ? ['me', 'mate', 'o1', 'o2'] : ['me', 'o1'];
  const used = new Set(active.filter(k => k !== slot).map(k => S.settings.pick[k]));
  let i = ROSTER.findIndex(c => c.id === S.settings.pick[slot]);
  for (let n = 0; n < ROSTER.length; n++) { i = (i + d + ROSTER.length) % ROSTER.length; if (!used.has(ROSTER[i].id)) break; }
  S.settings.pick[slot] = ROSTER[i].id; saveSettings(); renderPick(slot);
}
document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', () => { S.settings.mode = r.value; renderRoster(); }));
function startFromMenu() {`);
fs.writeFileSync(f, s);
console.log('ok');
