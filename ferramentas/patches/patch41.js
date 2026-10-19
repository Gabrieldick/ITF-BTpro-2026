const fs = require('fs'); const f = process.argv[2]; let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 80)); s = s.replace(a, b); };
rep(`        <input type="radio" name="mode" id="modD" value="dupla"><label for="modD">Dupla · 2×2</label>
      </div></fieldset>`, `        <input type="radio" name="mode" id="modD" value="dupla"><label for="modD">Dupla · 2×2</label>
      </div></fieldset>
      <fieldset class="seg"><legend>Seu lado na dupla</legend><div class="pills">
        <input type="radio" name="side" id="sideR" value="direita" checked><label for="sideR">Direita</label>
        <input type="radio" name="side" id="sideL" value="esquerda"><label for="sideL">Esquerda</label>
      </div></fieldset>`);
rep("racket: 'proteo', players: 'desenhado', uniforms: 'uniforme' },", "racket: 'proteo', players: 'desenhado', uniforms: 'uniforme', side: 'direita' },");
rep("S.settings.players = v('players');", "S.settings.players = v('players'); S.settings.side = v('side') || 'direita';");
rep("set('players', S.settings.players);", "set('players', S.settings.players); set('side', S.settings.side || 'direita');");
// direita = +x para quem está do lado de baixo (olhando para a rede)
rep("  human.slot = d ? 1 : 0; cpuA.slot = d ? 1 : 0;", "  const mySide = S.settings.side === 'esquerda' ? -1 : 1;\n  human.slot = d ? mySide : 0; partner.slot = -mySide; cpuA.slot = d ? 1 : 0; cpuB.slot = -1;");
fs.writeFileSync(f, s); console.log('ok');
