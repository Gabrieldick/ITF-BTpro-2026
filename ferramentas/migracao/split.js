// Divide o script único do jogo em módulos ES (TypeScript sem checagem por enquanto), preservando a ordem de execução.
// Uso: node split.js <src.html> <pasta-do-projeto> [--analyze]
const fs = require('fs'), path = require('path');
const acorn = require('acorn'), walk = require('acorn-walk'), escope = require('eslint-scope');
const [, , SRC, OUT, MODE] = process.argv;
const html = fs.readFileSync(SRC, 'utf8');

// ---------- 1) extrai CSS, corpo e script ----------
const css = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));
const headPart = html.slice(0, html.indexOf('<style>'));
const scriptTag = html.indexOf('<script src="https://cdnjs');
let body = html.slice(html.indexOf('</style>') + 8, scriptTag);
body = body.replace('<!--MODELS-->', '');
const sStart = html.indexOf('<script>\n') + 9, sEnd = html.lastIndexOf('</script>');
let js = html.slice(sStart, sEnd);
// desembrulha (function () { 'use strict'; ... })();
js = js.replace(/^\s*\(function \(\) \{\n'use strict';\n/, '');
js = js.replace(/\}\)\(\);\s*$/, '\n');

// ---------- 2) adaptações: three.js atual e recursos em arquivos ----------
const rep = (a, b) => { if (!js.includes(a)) throw new Error('missing: ' + a.slice(0, 80)); js = js.split(a).join(b); };
rep('renderer.outputEncoding = THREE.sRGBEncoding;', 'renderer.outputColorSpace = THREE.SRGBColorSpace;');
js = js.replace(/\.encoding = THREE\.sRGBEncoding/g, '.colorSpace = THREE.SRGBColorSpace');
rep('#include <encodings_fragment>', '#include <colorspace_fragment>');
// luzes: o three.js atual usa iluminação física (antes as intensidades eram multiplicadas por π internamente)
rep("new THREE.HemisphereLight(col('#bfdcff'), col('#d9bf8c'), 0.35)", "new THREE.HemisphereLight(col('#bfdcff'), col('#d9bf8c'), 0.35 * Math.PI)");
rep("new THREE.DirectionalLight(col('#fff3e2'), 2.5)", "new THREE.DirectionalLight(col('#fff3e2'), 2.5 * Math.PI)");
rep('    if (!THREE.GLTFLoader || !THREE.SkeletonUtils) return resolve(false);\n', '');
rep('new THREE.GLTFLoader()', 'new GLTFLoader()');
rep('THREE.SkeletonUtils.clone(', 'SkeletonUtils.clone(');
// recursos: vêm do módulo de assets (arquivos ou embutidos no HTML de arquivo único)
js = js.replace(/function b64Buf\(id\) \{[\s\S]*?\n\}\n/, 'function b64Buf(id) { return assetBuf(id); }\n');
rep("const el = document.getElementById('carol-tex' + p.k); if (!el) return;", "const url = assetUrl('carol-tex' + p.k); if (!url) return;");
rep("img.src = 'data:image/jpeg;base64,' + el.textContent.trim();", 'img.src = url;');
rep("img.src = 'data:image/jpeg;base64,' + document.getElementById('male-col').textContent.trim();", "img.src = assetUrl('male-col');");
js = js.replace(/  const n = document\.getElementById\('snd-hits'\);[\s\S]*?\n  a\.decodeAudioData\(ab,/, "  const ab0 = assetBuf('snd-hits'); if (!ab0) return;\n  const ab = ab0.slice(0);\n  a.decodeAudioData(ab,");
if (js.includes("getElementById('snd-hits')")) throw new Error('snd-hits not replaced');

// ---------- 3) análise de escopo ----------
const ast = acorn.parse(js, { ecmaVersion: 2022, sourceType: 'module', locations: true, ranges: true });
const sm = escope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
const top = sm.scopes.find(s => s.type === 'module'); // escopo do módulo
const lines = js.split('\n');
// seções → módulos
const SECTIONS = [
  [null, '00-base'],
  ['// ---------- Settings & state', '01-estado'],
  ['// ---------- Renderer & scene', '02-render'],
  ['// ---------- Céu procedural', '03-cenario'],
  ['// ---------- Poses', '04-poses'],
  ['// ---------- Atletas', '05-atletas'],
  ['// ---------- uniformes baixados', '06-modelos'],
  ['// ---------- Jogadores com modelo 3D (GLB)', '07-glb'],
  ['// ---------- Qualidade gráfica', '08-audio'],
  ['// ---------- DOM', '09-interface'],
  ['// ---------- Física', '10-fisica'],
  ['// ---------- mira', '11-mira'],
  ['// ---------- Controles', '12-controles'],
  ['// ---------- Campeonato', '13-campeonato'],
  ['// ================= MODO CARREIRA', '14-carreira'],
  ['// ---------- telas', '15-carreira-telas'],
  ['// ---------- Planejamento', '16-ia'],
  ['// ---------- Bola', '17-bola'],
  ['// ---------- Animação', '18-animacao'],
  ['// ---------- Loop', '19-loop'],
];
const marks = SECTIONS.map(([m, name]) => {
  if (!m) return { line: 1, name };
  const i = lines.findIndex(l => l.startsWith(m)); if (i < 0) throw new Error('marker ' + m);
  return { line: i + 1, name };
});
const modOfLine = ln => { let r = 0; marks.forEach((m, i) => { if (ln >= m.line) r = i; }); return r; };
const stmts = ast.body.map((n, i) => ({ node: n, idx: i, mod: modOfLine(n.loc.start.line) }));
// funções que fazem mais sentido em outro módulo (declarações de função podem mudar de lugar: são içadas)
const MOVE_FN = {
  doHit: '10-fisica', solveShot: '10-fisica', predictLanding: '10-fisica',
  charSkill: '16-ia', aiAim: '16-ia', gapX: '16-ia', chooseAIShot: '16-ia', chooseAIServe: '16-ia', homeOf: '16-ia', updateAI: '16-ia', playStyleOf: '16-ia',
  humanAim: '11-mira', updateAimMarker: '11-mira', buildAim: '11-mira', aimAutoX: '11-mira', humanDepthT: '11-mira',
};
const modIndex = Object.fromEntries(SECTIONS.map(([, n], i) => [n, i]));
stmts.forEach(s => { if (s.node.type === 'FunctionDeclaration' && MOVE_FN[s.node.id.name] !== undefined) s.mod = modIndex[MOVE_FN[s.node.id.name]]; });
const stmtOf = node => { // índice do statement de topo que contém o nó
  let lo = 0, hi = ast.body.length - 1;
  while (lo <= hi) { const m = (lo + hi) >> 1, b = ast.body[m]; if (node.start < b.start) hi = m - 1; else if (node.start >= b.end) lo = m + 1; else return m; }
  return -1;
};
const vars = new Map(); // nome → { decl: idx do statement, kind, mod, refs: [], crossWrite }
for (const v of top.variables) {
  const def = v.defs[0]; if (!def) continue;
  const declNode = def.parent && def.parent.type === 'VariableDeclaration' ? def.parent : def.node;
  const si = stmtOf(declNode);
  vars.set(v.name, { name: v.name, kind: def.type === 'FunctionName' ? 'function' : def.parent && def.parent.kind, si, mod: stmts[si].mod, v, crossWrite: false });
}
for (const [name, info] of vars) {
  for (const r of info.v.references) {
    const si = stmtOf(r.identifier); if (si < 0) continue;
    const m = stmts[si].mod;
    if (m !== info.mod && r.isWrite() && !(r.init)) info.crossWrite = true;
  }
}
const shared = [...vars.values()].filter(v => v.crossWrite);
console.log('top-level vars', vars.size, 'shared mutable', shared.map(v => v.name + '(' + v.kind + ')').join(', '));
// globais implícitas (atribuídas sem declaração)
const implicit = top.through.filter(r => r.isWrite()).map(r => r.identifier.name);
if (implicit.length) console.log('implicit globals written:', [...new Set(implicit)].join(', '));
const perMod = SECTIONS.map(() => 0); stmts.forEach(s => perMod[s.mod]++);
console.log('statements per module', SECTIONS.map(([, n], i) => n + ':' + perMod[i]).join(' '));
if (MODE === '--analyze') process.exit(0);

// ---------- 4) reescrita: variáveis reatribuídas fora do módulo viram $s.nome ----------
const sharedSet = new Set(shared.map(v => v.name));
const edits = []; // [start, end, text]
const parents = new Map();
walk.fullAncestor(ast, (node, st, anc) => { if (node.type === 'Identifier') parents.set(node, anc[anc.length - 2]); });
for (const v of shared) {
  for (const r of v.v.references) {
    const id = r.identifier, par = parents.get(id);
    if (par && par.type === 'Property' && par.shorthand && par.value === id) edits.push([id.start, id.end, id.name + ': $s.' + id.name]);
    else edits.push([id.start, id.end, '$s.' + id.name]);
  }
}
// declarações de variáveis compartilhadas: "let x = a, y;" → "$s.x = a; $s.y = undefined;" (as não compartilhadas continuam declaradas)
for (const s of stmts) {
  const n = s.node; if (n.type !== 'VariableDeclaration') continue;
  if (!n.declarations.some(d => d.id.type === 'Identifier' && sharedSet.has(d.id.name))) continue;
  const parts = n.declarations.map(d => {
    const init = d.init ? js.slice(d.init.start, d.init.end) : 'undefined';
    if (d.id.type === 'Identifier' && sharedSet.has(d.id.name)) return { shared: true, text: '$s.' + d.id.name + ' = ' + applyEdits(init, d.init ? d.init.start : 0) + ';' };
    return { shared: false, text: n.kind + ' ' + js.slice(d.start, d.end) + ';' };
  });
  s.replaced = parts.map(p => p.text).join(' ');
}
function applyEdits(text, offset) { // aplica as edições que caem dentro de [offset, offset+len)
  const es = edits.filter(e => e[0] >= offset && e[1] <= offset + text.length).sort((a, b) => b[0] - a[0]);
  for (const [a, b, t] of es) text = text.slice(0, a - offset) + t + text.slice(b - offset);
  return text;
}
// texto de cada statement (com comentários que o precedem)
let prevEnd = 0;
for (const s of stmts) {
  const lead = js.slice(prevEnd, s.node.start); // comentários/linhas em branco antes do statement
  s.lead = lead; prevEnd = s.node.end;
  s.text = s.replaced || applyEdits(js.slice(s.node.start, s.node.end), s.node.start);
}
const tail = js.slice(prevEnd);

// ---------- 5) módulos com imports/exports ----------
const mods = SECTIONS.map(([, name], i) => ({ name, i, stmts: [], exports: new Set(), imports: new Map(), usesS: false, three: false, gltf: false, skel: false, assets: new Set() }));
stmts.forEach(s => mods[s.mod].stmts.push(s));
for (const [name, info] of vars) {
  if (sharedSet.has(name)) continue;
  for (const r of info.v.references) {
    const si = stmtOf(r.identifier); if (si < 0) continue;
    const m = stmts[si].mod; if (m === info.mod) continue;
    mods[info.mod].exports.add(name);
    if (!mods[m].imports.has(info.mod)) mods[m].imports.set(info.mod, new Set());
    mods[m].imports.get(info.mod).add(name);
  }
}
const ASSET_FNS = ['assetBuf', 'assetUrl'];
mods.forEach(m => {
  const src = m.stmts.map(s => s.text).join('\n');
  m.usesS = /\$s\./.test(src); m.three = /\bTHREE\./.test(src); m.gltf = /\bGLTFLoader\b/.test(src); m.skel = /\bSkeletonUtils\./.test(src);
  ASSET_FNS.forEach(fn => { if (new RegExp('\\b' + fn + '\\(').test(src)) m.assets.add(fn); });
});
const GAME = path.join(OUT, 'src', 'game');
fs.mkdirSync(GAME, { recursive: true });
const DESC = {
  '00-base': 'constantes, elenco de atletas, raquetes, equipe técnica, estilos de jogo e utilitários',
  '01-estado': 'configurações e estado da partida',
  '02-render': 'renderizador, cena, luzes e texturas',
  '03-cenario': 'céu, mar, areia, quadra e cenário da praia',
  '04-poses': 'poses-chave dos golpes e variações',
  '05-atletas': 'corpo dos atletas (pele contínua), raquetes e jogadores',
  '06-modelos': 'uniformes baixados, Carol e jogador masculino escaneado',
  '07-glb': 'modelos GLB (Michelle/Soldier) e escalação dos personagens',
  '08-audio': 'qualidade gráfica e áudio',
  '09-interface': 'elementos da interface e placar',
  '10-fisica': 'física da bola, trajetórias e o golpe (doHit)',
  '11-mira': 'mira do jogador: seta, alvo e arco',
  '12-controles': 'teclado, toque, barras de força e menus',
  '13-campeonato': 'modo campeonato',
  '14-carreira': 'modo carreira: circuito, ranking, torneios, economia, eventos',
  '15-carreira-telas': 'telas do modo carreira',
  '16-ia': 'inteligência artificial: planejamento, estilos, escolha de golpes',
  '17-bola': 'atualização da bola e pontos',
  '18-animacao': 'animação procedural com cinemática inversa e câmera',
  '19-loop': 'laço principal e início',
};
mods.forEach((m, k) => {
  const head = ['// @ts-nocheck', '// ' + DESC[m.name]];
  if (k > 0) head.push("import './" + mods[k - 1].name + "';"); // encadeia: garante a mesma ordem de execução do arquivo original
  if (m.three) head.push("import * as THREE from 'three';");
  if (m.gltf) head.push("import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';");
  if (m.skel) head.push("import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';");
  if (m.usesS) head.push("import { $s } from '../state';");
  if (m.assets.size) head.push('import { ' + [...m.assets].join(', ') + " } from '../assets';");
  [...m.imports.keys()].sort((a, b) => a - b).forEach(j => head.push('import { ' + [...m.imports.get(j)].sort().join(', ') + " } from './" + mods[j].name + "';"));
  let body = m.stmts.map(s => s.lead.replace(/^\n+/, '\n') + s.text).join('');
  if (k === mods.length - 1) body += tail;
  const exp = m.exports.size ? '\nexport { ' + [...m.exports].sort().join(', ') + ' };\n' : '\n';
  fs.writeFileSync(path.join(GAME, m.name + '.ts'), head.join('\n') + '\n' + body.trim() + '\n' + exp);
});
fs.writeFileSync(path.join(OUT, 'src', 'state.ts'), '// estado compartilhado: variáveis reatribuídas por mais de um módulo\n// (' + shared.map(v => v.name).join(', ') + ')\nexport const $s: any = {};\n');
fs.writeFileSync(path.join(OUT, 'src', 'styles.css'), css.trim() + '\n');
const indexHtml = `<!doctype html>
<html lang="pt-BR">
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${headPart.trim()}
</head>
<body>
${body.trim()}
<!--ASSETS-->
<script type="module" src="/src/main.ts"></script>
</body>
</html>
`;
fs.writeFileSync(path.join(OUT, 'index.html'), indexHtml);
console.log('wrote', mods.length, 'modules; last =', mods[mods.length - 1].name);
