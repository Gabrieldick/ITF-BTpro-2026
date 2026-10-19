// separa as peças do uniforme e grava um binário compacto (metros, y para cima, frente em -z)
const fs = require('fs'), read = require('./glbread.js');
const [src, out, kind] = process.argv.slice(2);
const { pos, nor, idx } = read(src); const n = pos.length / 3;
const par = new Int32Array(n).map((_, i) => i); const find = x => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
const uni = (a, c) => { a = find(a); c = find(c); if (a !== c) par[a] = c; };
for (let t = 0; t < idx.length; t += 3) { uni(idx[t], idx[t + 1]); uni(idx[t], idx[t + 2]); }
const key = new Map(); for (let i = 0; i < n; i++) { const k = pos[i*3].toFixed(3) + ',' + pos[i*3+1].toFixed(3) + ',' + pos[i*3+2].toFixed(3); if (key.has(k)) uni(i, key.get(k)); else key.set(k, i); }
const box = new Map();
for (let i = 0; i < n; i++) { const r = find(i); let c = box.get(r); if (!c) box.set(r, c = { n: 0, z0: 1e9, z1: -1e9, ax: 0 }); c.n++; c.z0 = Math.min(c.z0, pos[i*3+2]); c.z1 = Math.max(c.z1, pos[i*3+2]); c.ax = Math.max(c.ax, Math.abs(pos[i*3])); }
// 0 = parte de cima, 1 = short, 2 = saia, -1 = descarta (tênis, meias, munhequeiras)
const label = c => {
  if (c.ax > 28 || c.z0 < 50) return -1;
  if (kind === 'm') return c.z0 >= 90 && c.z1 > 120 ? 0 : 1;
  return c.z0 >= 100 ? 0 : 2;
};
const lab = new Int8Array(n); for (let i = 0; i < n; i++) lab[i] = label(box.get(find(i)));
const map = new Int32Array(n).fill(-1); let m = 0; for (let i = 0; i < n; i++) if (lab[i] >= 0) map[i] = m++;
const P = new Float32Array(m * 3), N = new Int8Array(m * 3), L = new Uint8Array(m);
for (let i = 0; i < n; i++) { const j = map[i]; if (j < 0) continue;
  P[j*3] = -pos[i*3] / 100; P[j*3+1] = pos[i*3+2] / 100; P[j*3+2] = pos[i*3+1] / 100;
  N[j*3] = Math.round(-nor[i*3] * 127); N[j*3+1] = Math.round(nor[i*3+2] * 127); N[j*3+2] = Math.round(nor[i*3+1] * 127); L[j] = lab[i]; }
const I = []; for (let t = 0; t < idx.length; t += 3) { const a = map[idx[t]], b = map[idx[t+1]], c = map[idx[t+2]]; if (a >= 0 && b >= 0 && c >= 0) I.push(a, b, c); }
if (m > 65535) throw new Error('too many verts');
const hdr = Buffer.alloc(8); hdr.writeUInt32LE(m, 0); hdr.writeUInt32LE(I.length, 4);
let body = Buffer.concat([hdr, Buffer.from(P.buffer), Buffer.from(N.buffer), Buffer.from(L.buffer)]);
if (body.length % 2) body = Buffer.concat([body, Buffer.alloc(1)]);
body = Buffer.concat([body, Buffer.from(new Uint16Array(I).buffer)]);
fs.writeFileSync(out, body);
const cnt = [0, 0, 0]; for (let j = 0; j < m; j++) cnt[L[j]]++;
console.log(out, 'verts', m, 'tris', I.length / 3, 'parts', cnt, 'bytes', body.length);
