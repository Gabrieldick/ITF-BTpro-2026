const read = require('./glbread.js');
const f = process.argv[2], zlo = +process.argv[3], zhi = +process.argv[4], nmin = +process.argv[5] || 0, nmax = +process.argv[6] || 1e9;
const { pos, idx } = read(f); const n = pos.length / 3;
const par = new Int32Array(n).map((_, i) => i); const find = x => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
const uni = (a, c) => { a = find(a); c = find(c); if (a !== c) par[a] = c; };
for (let t = 0; t < idx.length; t += 3) { uni(idx[t], idx[t + 1]); uni(idx[t], idx[t + 2]); }
const key = new Map(); for (let i = 0; i < n; i++) { const k = pos[i*3].toFixed(3) + ',' + pos[i*3+1].toFixed(3) + ',' + pos[i*3+2].toFixed(3); if (key.has(k)) uni(i, key.get(k)); else key.set(k, i); }
const cnt = new Map(); for (let i = 0; i < n; i++) { const r = find(i); cnt.set(r, (cnt.get(r) || 0) + 1); }
const bands = {};
for (let i = 0; i < n; i++) { const c = cnt.get(find(i)); if (c < nmin || c > nmax) continue; const z = pos[i*3+2]; if (z < zlo || z > zhi) continue;
  const b = Math.floor(z / 4) * 4; const B = bands[b] || (bands[b] = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, n: 0, ax: 1e9 });
  B.x0 = Math.min(B.x0, pos[i*3]); B.x1 = Math.max(B.x1, pos[i*3]); B.y0 = Math.min(B.y0, pos[i*3+1]); B.y1 = Math.max(B.y1, pos[i*3+1]); B.n++; B.ax = Math.min(B.ax, Math.abs(pos[i*3])); }
Object.keys(bands).map(Number).sort((a, b) => a - b).forEach(b => { const B = bands[b]; console.log(b, 'x', B.x0.toFixed(1), B.x1.toFixed(1), 'y', B.y0.toFixed(1), B.y1.toFixed(1), 'min|x|', B.ax.toFixed(1), 'n', B.n); });
