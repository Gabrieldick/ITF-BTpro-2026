const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };

// tipo físico de cada atleta (descrições enviadas pelo usuário)
const BUILD = {
  kudina: 'atletico', semena: 'esguio', marquezin: 'compacto', chou: 'compacto', miler: 'esguio', gaspar: 'compacto', nobre: 'esguio', cimadi: 'forte',
  daino: 'esguio', franceschini: 'atletico', grael: 'esguio', palos: 'atletico', magalhaes: 'esguio', podlubna: 'esguio', pansani: 'compacto', abreu: 'atletico',
  nogueiro: 'forte', leite: 'esguio', cortes: 'atletico', damata: 'forte',
  spot: 'compacto', gianote: 'esguio', barao: 'forte', mola: 'forte', gigio: 'compacto', capeletti: 'forte', lock: 'atletico', ramires: 'esguio', burmak: 'esguio',
  grusso: 'forte', beccaccioli: 'atletico', giovannini: 'esguio', allan: 'compacto', gramos: 'esguio', guegano: 'esguio', bollettinari: 'compacto', branco: 'atletico',
  niklass: 'esguio', galeazzi: 'forte', hrusso: 'atletico',
};
const LEFTY = new Set(['barao', 'allan']);
let cnt = 0;
s = s.replace(/\{ id: '(\w+)', name: '([^']+)', alt: (\d+), pais: '([^']+)', estilo: '([^']+)',( fem: true,)?( canhoto: true,)?/g, (m, id, name, alt, pais, estilo, fem, can) => {
  cnt++;
  const b = BUILD[id] || 'atletico';
  return `{ id: '${id}', name: '${name}', alt: ${alt}, pais: '${pais}', estilo: '${estilo}', build: '${b}',${fem || ''}${LEFTY.has(id) ? ' canhoto: true,' : ''}`;
});
// o visual recebe o tipo físico
rep("    const look = Object.assign({}, c.look, KITS[team][idx], { fem: !!c.fem });", "    const look = Object.assign({}, c.look, KITS[team][idx], { fem: !!c.fem, build: c.build });");
rep("    if (p.lookKey !== c.id) { rebuildModel(p, look); p.lookKey = c.id; }", "    if (p.lookKey !== c.id + c.build) { rebuildModel(p, look); p.lookKey = c.id + c.build; }");
// proporções conforme o tipo físico (tronco/ombros e grossura dos membros)
rep("  scene.add(root);\n  return { group: root, hips, spine, headG, legs, armR: arms[1], armL: arms[-1], blob, tail, racket };",
`  const BF = { compacto: [1.06, 1.08], forte: [1.12, 1.12], esguio: [.92, .87], atletico: [1, 1] }[o.build] || [1, 1];
  if (BF[0] !== 1 || BF[1] !== 1) {
    spine.children.forEach(c => { if (c.isMesh) { c.scale.x *= BF[0]; c.scale.z *= 1 + (BF[0] - 1) * .6; c.position.x *= BF[0]; } });
    [arms[1].sh, arms[-1].sh].forEach(sh => { sh.position.x *= BF[0]; });
    const thick = g => g.children.forEach(c => { if (c.isMesh) { c.scale.x *= BF[1]; c.scale.z *= BF[1]; } });
    legs.forEach(L => { thick(L.thigh); thick(L.knee); });
    [arms[1], arms[-1]].forEach(A => { thick(A.sh); thick(A.el); });
  }
  scene.add(root);
  return { group: root, hips, spine, headG, legs, armR: arms[1], armL: arms[-1], blob, tail, racket };`);
// cartão mostra tipo físico e mão
rep("<span>' + c.pais + ' · ' + c.estilo + (c.fem ? ' · feminino' : ' · masculino') + '</span>",
    "<span>' + c.pais + ' · ' + c.estilo + ' · ' + ({ compacto: 'compacto', forte: 'forte', esguio: 'esguio', atletico: 'atlético' }[c.build] || 'atlético') + (c.canhoto ? ' · canhoto' : ' · destro') + (c.fem ? ' · feminino' : ' · masculino') + '</span>");
fs.writeFileSync(f, s);
console.log('ok', cnt);
