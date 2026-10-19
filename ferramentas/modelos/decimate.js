// Simplifica a malha escaneada por agrupamento em grade:
// posição e normal por célula (compartilhadas entre pedaços do atlas, sem rachaduras); UV por (pedaço, célula).
const fs = require('fs');
const M = require('./carolread.js')(process.argv[2])[0];
const CELL = +process.argv[4] || .01, HEAD = +process.argv[5] || .006;
const { n, P, N, U, I } = M;
// pedaços do atlas = componentes conexas pelos índices (as costuras já vêm com vértices separados)
const par = new Int32Array(n).map((_, i) => i); const find = x => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
for (let t = 0; t < I.length; t += 3) { const a = find(I[t]), b = find(I[t + 1]), c = find(I[t + 2]); par[a] = c; par[b] = c; }
const chart = new Int32Array(n); for (let i = 0; i < n; i++) chart[i] = find(i);
// célula espacial (mais fina na cabeça e nas mãos)
const cellOf = i => { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; const fine = y > 1.5 || Math.abs(x) > .55; const c = fine ? HEAD : CELL; return (fine ? 'f' : 'c') + Math.floor(x / c) + ',' + Math.floor(y / c) + ',' + Math.floor(z / c); };
const cell = new Array(n); const cn = new Map();
for (let i = 0; i < n; i++) { const k = cellOf(i); cell[i] = k; let a = cn.get(k); if (!a) cn.set(k, a = [0, 0, 0]); a[0] += N[i * 3]; a[1] += N[i * 3 + 1]; a[2] += N[i * 3 + 2]; }
// camadas opostas (tecido dos dois lados) não se misturam
const gkey = new Array(n);
for (let i = 0; i < n; i++) { const a = cn.get(cell[i]); const d = a[0] * N[i * 3] + a[1] * N[i * 3 + 1] + a[2] * N[i * 3 + 2]; gkey[i] = cell[i] + (d < 0 ? '-' : '+'); }
const G = new Map();
for (let i = 0; i < n; i++) { let g = G.get(gkey[i]); if (!g) G.set(gkey[i], g = { p: [0, 0, 0], nn: [0, 0, 0], c: 0 }); for (let q = 0; q < 3; q++) { g.p[q] += P[i * 3 + q]; g.nn[q] += N[i * 3 + q]; } g.c++; }
const V = new Map(), outP = [], outN = [], outU = [], acc = [];
const vid = new Int32Array(n);
for (let i = 0; i < n; i++) {
  const k = gkey[i] + '|' + chart[i]; let id = V.get(k);
  if (id == null) { id = acc.length; V.set(k, id); acc.push({ g: G.get(gkey[i]), u: [0, 0], c: 0 }); }
  const A = acc[id]; vid[i] = id; A.c++;
  const g = A.g, d = (P[i*3] - g.p[0] / g.c) ** 2 + (P[i*3+1] - g.p[1] / g.c) ** 2 + (P[i*3+2] - g.p[2] / g.c) ** 2;
  if (A.best == null || d < A.best) { A.best = d; A.u[0] = U[i * 2]; A.u[1] = U[i * 2 + 1]; }
}
acc.forEach(A => { const g = A.g; outP.push(g.p[0] / g.c, g.p[1] / g.c, g.p[2] / g.c); const l = Math.hypot(...g.nn) || 1; outN.push(g.nn[0] / l, g.nn[1] / l, g.nn[2] / l); outU.push(A.u[0], A.u[1]); });
const seen = new Set(), outI = []; let flipped = 0;
for (let t = 0; t < I.length; t += 3) {
  const a = vid[I[t]], b = vid[I[t + 1]], c = vid[I[t + 2]];
  if (a === b || b === c || a === c) continue;
  const key = [a, b, c].sort((x, y) => x - y).join(',');
  if (seen.has(key)) continue;
  // triângulo que virou ao juntar vértices (mostraria o avesso, escuro): descarta
  const ax = outP[b*3]-outP[a*3], ay = outP[b*3+1]-outP[a*3+1], az = outP[b*3+2]-outP[a*3+2], bx = outP[c*3]-outP[a*3], by = outP[c*3+1]-outP[a*3+1], bz = outP[c*3+2]-outP[a*3+2];
  const fx = ay*bz-az*by, fy = az*bx-ax*bz, fz = ax*by-ay*bx;
  const ox = P[I[t]*3+1], _o = 0;
  const e1 = [P[I[t+1]*3]-P[I[t]*3], P[I[t+1]*3+1]-P[I[t]*3+1], P[I[t+1]*3+2]-P[I[t]*3+2]], e2 = [P[I[t+2]*3]-P[I[t]*3], P[I[t+2]*3+1]-P[I[t]*3+1], P[I[t+2]*3+2]-P[I[t]*3+2]];
  const gx = e1[1]*e2[2]-e1[2]*e2[1], gy = e1[2]*e2[0]-e1[0]*e2[2], gz = e1[0]*e2[1]-e1[1]*e2[0];
  if (fx*gx + fy*gy + fz*gz <= 0) { flipped++; continue; }
  // UV dobrado (pegaria a cor de outro pedaço do atlas): descarta
  const uvA = (outU[b*2]-outU[a*2])*(outU[c*2+1]-outU[a*2+1]) - (outU[b*2+1]-outU[a*2+1])*(outU[c*2]-outU[a*2]);
  const uvO = (U[I[t+1]*2]-U[I[t]*2])*(U[I[t+2]*2+1]-U[I[t]*2+1]) - (U[I[t+1]*2+1]-U[I[t]*2+1])*(U[I[t+2]*2]-U[I[t]*2]);
  if (uvA * uvO <= 0) { flipped++; continue; }
  seen.add(key); outI.push(a, b, c);
}
const m = acc.length;
const hdr = new Uint32Array([1, m, outI.length]);
const out = Buffer.concat([Buffer.from(hdr.buffer), Buffer.from(new Float32Array(outP).buffer), Buffer.from(new Float32Array(outN).buffer), Buffer.from(new Float32Array(outU).buffer), Buffer.from(new Uint32Array(outI).buffer)]);
fs.writeFileSync(process.argv[3], out);
console.log('flipped', flipped, 'charts', new Set(chart).size, 'verts', n, '->', m, 'tris', I.length / 3, '->', outI.length / 3);
