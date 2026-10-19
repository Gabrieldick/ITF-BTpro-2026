// simplificação com meshoptimizer (preserva costuras de UV)
const fs = require('fs');
const { MeshoptSimplifier } = require('meshoptimizer');
const M = require('./carolread.js')(process.argv[2])[0];
const target = +process.argv[4] || 45000;
MeshoptSimplifier.ready.then(() => {
  const [idx, err] = MeshoptSimplifier.simplify(M.I, M.P, 3, target * 3, .02, []);
  const map = new Int32Array(M.n).fill(-1); let m = 0; const I = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) { const v = idx[i]; if (map[v] < 0) map[v] = m++; I[i] = map[v]; }
  const P = new Float32Array(m * 3), N = new Float32Array(m * 3), U = new Float32Array(m * 2);
  for (let v = 0; v < M.n; v++) { const j = map[v]; if (j < 0) continue; for (let q = 0; q < 3; q++) { P[j * 3 + q] = M.P[v * 3 + q]; N[j * 3 + q] = M.N[v * 3 + q]; } U[j * 2] = M.U[v * 2]; U[j * 2 + 1] = M.U[v * 2 + 1]; }
  fs.writeFileSync(process.argv[3], Buffer.concat([Buffer.from(new Uint32Array([1, m, I.length]).buffer), Buffer.from(P.buffer), Buffer.from(N.buffer), Buffer.from(U.buffer), Buffer.from(I.buffer)]));
  console.log('verts', M.n, '->', m, 'tris', M.I.length / 3, '->', I.length / 3, 'err', err.toFixed(5));
});
