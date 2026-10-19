const read = require('./glbread.js');
for (const f of process.argv.slice(2)) {
  const { pos, idx, json } = read(f);
  const n = pos.length / 3; console.log('==', f, 'verts', n, 'tris', idx ? idx.length / 3 : 'none', 'node', JSON.stringify(json.nodes[0]));
  // componentes conexas (une vértices na mesma posição também)
  const par = new Int32Array(n).map((_, i) => i); const find = x => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
  const uni = (a, c) => { a = find(a); c = find(c); if (a !== c) par[a] = c; };
  for (let t = 0; t < idx.length; t += 3) { uni(idx[t], idx[t + 1]); uni(idx[t], idx[t + 2]); }
  const key = new Map(); for (let i = 0; i < n; i++) { const k = pos[i*3].toFixed(3) + ',' + pos[i*3+1].toFixed(3) + ',' + pos[i*3+2].toFixed(3); if (key.has(k)) uni(i, key.get(k)); else key.set(k, i); }
  const comp = new Map();
  for (let i = 0; i < n; i++) { const r = find(i); let c = comp.get(r); if (!c) comp.set(r, c = { n: 0, min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }); c.n++; for (let k = 0; k < 3; k++) { c.min[k] = Math.min(c.min[k], pos[i*3+k]); c.max[k] = Math.max(c.max[k], pos[i*3+k]); } }
  [...comp.values()].sort((a, b) => b.n - a.n).forEach(c => console.log(c.n, 'min', c.min.map(v => v.toFixed(1)).join(','), 'max', c.max.map(v => v.toFixed(1)).join(',')));
}
