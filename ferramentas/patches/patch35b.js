const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };
rep(`      <fieldset class="seg"><legend>Raquete</legend>`, `      <fieldset class="seg"><legend>Roupa</legend><div class="pills">
        <input type="radio" name="uniforms" id="uniOn" value="uniforme" checked><label for="uniOn">Uniforme 3D</label>
        <input type="radio" name="uniforms" id="uniOff" value="simples"><label for="uniOff">Simples</label>
      </div></fieldset>
      <fieldset class="seg"><legend>Raquete</legend>`);
rep("racket: 'proteo', players: 'desenhado' },", "racket: 'proteo', players: 'desenhado', uniforms: 'uniforme' },");
rep("S.settings.players = v('players');", "S.settings.players = v('players'); S.settings.uniforms = v('uniforms') || 'uniforme';");
rep("set('players', S.settings.players);", "set('players', S.settings.players); set('uniforms', S.settings.uniforms || 'uniforme');");
rep("    if (p.lookKey !== c.id + c.build) { rebuildModel(p, look); p.lookKey = c.id + c.build; }", "    const lk = c.id + c.build + (S.settings.uniforms || '');\n    if (p.lookKey !== lk) { rebuildModel(p, look); p.lookKey = lk; }");
rep("const UNI_ON = () => !(typeof S !== 'undefined' && S.settings && S.settings.uniforms === 'simples');", "const UNI_ON = () => { try { return S.settings.uniforms !== 'simples'; } catch (e) { return true; } };");
fs.writeFileSync(f, s); console.log('ok');
