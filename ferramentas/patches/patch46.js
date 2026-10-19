const fs = require('fs'), path = require('path');
const f = process.argv[2], dir = __dirname;
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, () => b); };
const rd = n => fs.readFileSync(path.join(dir, n), 'utf8');

rep('</style>', rd('career.css') + '</style>');
rep('<!-- Pausa -->', rd('career.html') + '<!-- Pausa -->');
rep('      <button class="ghost" id="btnChamp">Campeonato</button>', '      <button class="ghost" id="btnChamp">Campeonato</button>\n      <button class="ghost" id="btnCareer">Carreira</button>');
rep('      <button class="cta" id="btnOverChamp" hidden>Ver a chave</button>', '      <button class="cta" id="btnOverChamp" hidden>Ver a chave</button>\n      <button class="cta" id="btnOverCareer" hidden>Voltar à carreira</button>');
// raquetes valem atributos (também fora da carreira)
rep(`        <input type="radio" name="racket" id="rkSup" value="supercarbon"><label for="rkSup">Supercarbon</label>
      </div></fieldset>`, `        <input type="radio" name="racket" id="rkSup" value="supercarbon"><label for="rkSup">Supercarbon</label>
      </div><p style="margin:.4rem 0 0;font-size:.78rem;color:#5b6b78">A raquete muda seus atributos: Medusa controle (+curta +defesa +backhand) · Proteo equilíbrio · Kronos potência (+força +smash +saque, −curta) · Supercarbon topo de linha.</p></fieldset>`);
rep("const ATTR_W = { forca: .13, vel: .15, def: .15, backhand: .08, curta: .11, lob: .11, smash: .15, saque: .12 };", "const ATTR_W = { forca: .13, vel: .15, def: .15, backhand: .08, curta: .11, lob: .11, smash: .15, saque: .12 };\n" + rd('career-early.js'));
rep("const charById = id => ROSTER.find(c => c.id === id) || ROSTER[0];", "let CAREER_CHARS = []; // jogador da carreira e personagens fictícios\nconst charById = id => ROSTER.find(c => c.id === id) || CAREER_CHARS.find(c => c.id === id) || ROSTER[0];");
rep("    p.char = c;\n    const look = Object.assign({}, c.look, KITS[team][idx], { fem: !!c.fem, build: c.build });",
    "    // atributos em jogo: base + raquete (a sua vem do menu/carreira; a dos outros, do equipamento de cada um)\n    p.char = Object.assign({}, c, { a: effA(c.a, racketBonus(p === human ? S.settings.racket : c.look && c.look.racket)) });\n    const look = Object.assign({}, c.look, KITS[team][idx], { fem: !!c.fem, build: c.build });");
// fim de partida e abandono
rep("  const inChamp = !!S.champActive;\n  if (inChamp) champMatchEnded(w === 0);\n  $('btnOverChamp').hidden = !inChamp; $('btnAgain').hidden = inChamp;",
    "  const inChamp = !!S.champActive, inCareer = !!S.careerActive;\n  if (inChamp) champMatchEnded(w === 0);\n  if (inCareer) careerMatchEnded(w === 0);\n  $('btnOverChamp').hidden = !inChamp; $('btnOverCareer').hidden = !inCareer; $('btnAgain').hidden = inChamp || inCareer;");
rep("function toMenu() {\n", "function toMenu() {\n  if (S.careerActive) careerMatchEnded(false); // abandonar conta como derrota\n");
rep("function startFromMenu() {", rd('career.js') + "\nfunction startFromMenu() {");
// visuais das raquetes de entrada
rep("  supercarbon: { edge: '#f4f5f6',", `  basica: { edge: '#6b5a44', grip: '#2a2420', throat: '#5a4a38', draw(x, w, h) {
    x.fillStyle = '#9a8a70'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) { x.strokeStyle = 'rgba(70,50,30,' + rand(.08, .2) + ')'; x.lineWidth = rand(1, 3); x.beginPath(); x.moveTo(0, i * 10 + rand(-3, 3)); x.bezierCurveTo(w * .3, i * 10 + rand(-6, 6), w * .7, i * 10 + rand(-6, 6), w, i * 10); x.stroke(); }
    x.fillStyle = '#2f6f4f'; x.fillRect(0, h * .74, w, h * .1);
    modelName(x, 'AREIA', h * .79, '#f4ead2', 13);
  } },
  fibra: { edge: '#e9eef3', grip: '#1d2a3a', throat: '#d7e1ea', draw(x, w, h) {
    x.fillStyle = '#e8eef4'; x.fillRect(0, 0, w, h);
    x.globalAlpha = .18; for (let i = -h; i < w; i += 9) { x.strokeStyle = '#7a8ea4'; x.lineWidth = 1; x.beginPath(); x.moveTo(i, 0); x.lineTo(i + h, h); x.stroke(); } x.globalAlpha = 1;
    x.fillStyle = '#1f6fd1'; x.beginPath(); x.moveTo(0, h * .3); x.lineTo(w, h * .18); x.lineTo(w, h * .26); x.lineTo(0, h * .38); x.fill();
    x.fillStyle = '#ffb11f'; x.beginPath(); x.moveTo(0, h * .42); x.lineTo(w, h * .3); x.lineTo(w, h * .33); x.lineTo(0, h * .45); x.fill();
    modelName(x, 'SPEED', h * .79, '#1f6fd1', 14);
  } },
  supercarbon: { edge: '#f4f5f6',`);
fs.writeFileSync(f, s); console.log('ok');
