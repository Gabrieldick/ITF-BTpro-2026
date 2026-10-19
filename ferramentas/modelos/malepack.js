// Jogador masculino escaneado (pose A) -> esqueleto do jogo, com pesos e máscara do short no atlas.
// Uso: node malepack.js male-ms.bin saida.bin
const fs = require('fs');
const M = require('./carolread.js')(process.argv[2])[0];
const OUT = process.argv[3];
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const pw = (pts, x) => { let i = 0; while (i < pts.length - 2 && x > pts[i + 1][0]) i++; const [a, A] = pts[i], [b, B] = pts[i + 1]; return A + (x - a) * (B - A) / (b - a); };

// esqueleto do jogo (masculino, em pé, braços pendurados)
const R = { hipX: .092, H: .89, kn: .47, an: .04, hips: .92, spine: 1.04, head: 1.66, shX: .205, shY: 1.51, ua: .285, fa: .27 };
// medidas do modelo
const C = { cut: .13, kn: .51, H: .90, sh: [.18, 1.50], wrist: [.67, 1.06], neck: 1.60 };
const VY = [[C.cut, .07], [C.kn, R.kn], [C.H, R.H], [C.sh[1], R.shY]];
const neckY = pw(VY, C.neck), HS = .92, XS = 1;
// cintura mais marcada (a polo é larga) e pernas um pouco mais cheias
// largura do tronco por altura: quadril um pouco mais cheio, cintura leve, costas e ombros mais estreitos
const XW = [[.7, 1], [.84, 1.1], [.98, 1.08], [1.12, .96], [1.3, .88], [1.48, .84], [1.62, .9]];
const ZW = [[.84, 1.04], [1.0, 1], [1.2, .95], [1.45, .93], [1.62, 1]];
const waistK = y => pw(XW, Math.min(1.62, Math.max(.7, y)));
const depthK = y => pw(ZW, Math.min(1.62, Math.max(.84, y)));
const SHX = R.shX - .02; // encaixe do braço um pouco para dentro
const legXC = [[0, .158], [.12, .138], [.2, .134], [.32, .129], [.44, .131], [.52, .116], [.6, .106], [.68, .097], [.76, .092]];
const legZC = [[0, .02], [.16, .078], [.2, .094], [.44, .088], [.48, .076], [.52, .057], [.56, .043], [.6, .031], [.68, .021], [.76, .009]];
const armDir = (() => { const dx = C.wrist[0] - C.sh[0], dy = C.wrist[1] - C.sh[1], l = Math.hypot(dx, dy); return { dx: dx / l, dy: dy / l, len: l }; })();
const armRot = Math.PI / 2 - Math.atan2(-armDir.dy, armDir.dx); // quanto falta para o braço ficar pendurado
const armK = (R.ua + R.fa) / armDir.len;
// escápulas e costas ficam no tronco; só ombro (deltoide) para fora vai com o braço
const isArm = (x, y) => { const ax = Math.abs(x); return y > .9 && y < 1.62 && (ax > .215 || (ax > .2 && y > 1.38)); };
const isHead = (x, y) => y > C.neck - .02 && Math.abs(x) < .16;

function map(x, y, z) {
  const ax = Math.abs(x), s = x < 0 ? -1 : 1;
  // tronco/pernas: alturas por trechos; pernas trazidas para baixo do quadril
  let Y = pw(VY, y), X = x * XS * waistK(y), Z = z * depthK(y);
  if (y < .8) {
    const t = 1 - smooth(.68, .8, y);
    const lc = pw(legXC, y), lz = pw(legZC, y), th = 1 + .1 * t;
    X = s * lerp(ax * XS * waistK(y), R.hipX + (ax - lc) * th, t);
    Z = lerp(z * depthK(y), .015 + (z - lz) * th, t);
  }
  if (isArm(x, y)) {
    // ao longo do braço encurta até o punho; depois baixa o braço inteiro girando no ombro
    const vx = ax - C.sh[0], vy = y - C.sh[1];
    const along = vx * armDir.dx + vy * armDir.dy, px = vx - along * armDir.dx, py = vy - along * armDir.dy;
    const na = along <= 0 ? along : along <= armDir.len ? along * armK : armDir.len * armK + (along - armDir.len);
    const lx = armDir.dx * na + px, ly = armDir.dy * na + py;
    const w = smooth(.0, .12, along), a = -armRot * w, c = Math.cos(a), sn = Math.sin(a);
    const rx = lx * c - ly * sn, ry = lx * sn + ly * c;
    const t = smooth(.2, .24, ax) * (y > 1.38 ? 1 : smooth(.215, .23, ax));
    X = lerp(X, s * (SHX + rx), t); Y = lerp(Y, R.shY + ry, t); Z = lerp(Z, z - .05, t);
  }
  if (isHead(x, y)) {
    const t = smooth(C.neck - .02, C.neck + .05, y);
    X = lerp(X, x * HS, t); Y = lerp(Y, neckY + (y - C.neck) * HS, t); Z = lerp(Z, z * HS, t);
  }
  return [X, Y, Z];
}

// ossos: 0 quadril, 1 tronco, 2 cabeça, 3-5 perna esq, 6-8 perna dir, 9-11 braço esq, 12-14 braço dir
const segs = [];
const seg = (b, a, c, side) => segs.push({ b, a, c, side });
seg(0, [0, .84, 0], [0, 1.04, 0], 0); seg(1, [0, 1.04, 0], [0, 1.58, 0], 0); seg(2, [0, 1.64, 0], [0, 1.95, 0], 0);
[-1, 1].forEach((s, i) => {
  const o = i ? 6 : 3, x = s * R.hipX;
  seg(o, [x, R.H, 0], [x, R.kn, 0], s); seg(o + 1, [x, R.kn, 0], [x, R.an, 0], s); seg(o + 2, [x, R.an, 0], [x, 0, -.16], s);
  const a = i ? 12 : 9, sx = s * R.shX;
  seg(a, [sx, R.shY, 0], [sx, R.shY - R.ua, 0], s); seg(a + 1, [sx, R.shY - R.ua, 0], [sx, R.shY - R.ua - R.fa, 0], s); seg(a + 2, [sx, R.shY - R.ua - R.fa, 0], [sx, R.shY - R.ua - R.fa - .2, 0], s);
});
const LEG = new Set([3, 4, 5, 6, 7, 8]), ARM = new Set([9, 10, 11, 12, 13, 14]);
function segDist(p, S) {
  const ab = [S.c[0] - S.a[0], S.c[1] - S.a[1], S.c[2] - S.a[2]], ap = [p[0] - S.a[0], p[1] - S.a[1], p[2] - S.a[2]];
  const t = Math.max(0, Math.min(1, (ab[0] * ap[0] + ab[1] * ap[1] + ab[2] * ap[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2)));
  return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t);
}
function weights(p, head, armSrc, low) {
  const [X, Y] = p, side = X < 0 ? -1 : 1;
  if (head) { const t = smooth(neckY - .02, neckY + .06, Y); return [[2, t], [1, 1 - t]]; }
  const c = [];
  for (const S of segs) {
    if (LEG.has(S.b) && ((S.side !== side && Math.abs(X) > .02) || Y > R.H + .02 || armSrc)) continue;
    if (ARM.has(S.b) && (!armSrc || S.side !== side)) continue;
    if (armSrc && S.b === 0) continue;
    if (S.b === 2) continue;
    if (low && S.b === 1) continue; // short e barra da camisa: só quadril e coxas
    c.push([S.b, 1 / (segDist(p, S) + .004) ** 4]);
  }
  c.sort((a, b) => b[1] - a[1]);
  const top = c.slice(0, 3), sum = top.reduce((s, v) => s + v[1], 0);
  return top.map(([b, w]) => [b, w / sum]);
}
function inv3(m) {
  const [a, b, c, d, e, f, g, h, i] = m, A = e * i - f * h, B = -(d * i - f * g), Cc = d * h - e * g, det = a * A + b * B + c * Cc;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, Cc / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}
// tira meias e tênis (fica descalço com o pé do jogo)
const keepV = new Uint8Array(M.n); for (let i = 0; i < M.n; i++) keepV[i] = M.P[i * 3 + 1] >= C.cut - .005 ? 1 : 0;
const tris = []; for (let t = 0; t < M.I.length; t += 3) if (keepV[M.I[t]] && keepV[M.I[t + 1]] && keepV[M.I[t + 2]]) tris.push(M.I[t], M.I[t + 1], M.I[t + 2]);
const remap = new Int32Array(M.n).fill(-1); let n = 0; const I = new Uint16Array(tris.length);
tris.forEach((v, k) => { if (remap[v] < 0) remap[v] = n++; I[k] = remap[v]; });
if (n > 65535) throw new Error('verts');
const P = new Int16Array(n * 3), N = new Int8Array(n * 3), U = new Uint16Array(n * 2), SI = new Uint8Array(n * 4), SW = new Uint8Array(n * 4);
const shortsV = new Uint8Array(n);
const e = .002;
for (let v = 0; v < M.n; v++) {
  const i = remap[v]; if (i < 0) continue;
  const x = M.P[v * 3], y = M.P[v * 3 + 1], z = M.P[v * 3 + 2];
  const p = map(x, y, z), jx = map(x + e, y, z), jy = map(x, y + e, z), jz = map(x, y, z + e);
  const J = [(jx[0] - p[0]) / e, (jy[0] - p[0]) / e, (jz[0] - p[0]) / e, (jx[1] - p[1]) / e, (jy[1] - p[1]) / e, (jz[1] - p[1]) / e, (jx[2] - p[2]) / e, (jy[2] - p[2]) / e, (jz[2] - p[2]) / e];
  const Ji = inv3(J), nx = M.N[v * 3], ny = M.N[v * 3 + 1], nz = M.N[v * 3 + 2];
  let a = Ji[0] * nx + Ji[3] * ny + Ji[6] * nz, b = Ji[1] * nx + Ji[4] * ny + Ji[7] * nz, c = Ji[2] * nx + Ji[5] * ny + Ji[8] * nz;
  const l = Math.hypot(a, b, c) || 1;
  for (let q = 0; q < 3; q++) P[i * 3 + q] = Math.round(p[q] * 16000);
  N[i * 3] = Math.round(a / l * 127); N[i * 3 + 1] = Math.round(b / l * 127); N[i * 3 + 2] = Math.round(c / l * 127);
  U[i * 2] = Math.round(Math.min(1, Math.max(0, M.U[v * 2])) * 65535); U[i * 2 + 1] = Math.round(Math.min(1, Math.max(0, M.U[v * 2 + 1])) * 65535);
  const w = weights(p, isHead(x, y), isArm(x, y), y < 1.0); let tot = 0;
  w.forEach(([bn, wt], q) => { SI[i * 4 + q] = bn; SW[i * 4 + q] = Math.round(wt * 255); tot += SW[i * 4 + q]; });
  SW[i * 4] += 255 - tot;
  shortsV[i] = y > .675 && y < 1.0 && Math.abs(x) < .26 ? 1 : y < .345 ? 2 : 0;
}
// máscara do short no atlas (128 x 128): pinta os triângulos do short no espaço UV
const MS = 256, mask = new Uint8Array(MS * MS);
for (let t = 0; t < I.length; t += 3) {
  const a = I[t], b = I[t + 1], c = I[t + 2]; const lab = [shortsV[a], shortsV[b], shortsV[c]], kind = lab.filter(v => v === 1).length >= 2 ? 1 : lab.filter(v => v === 2).length >= 2 ? 2 : 0; if (!kind) continue;
  const pts = [a, b, c].map(i => [U[i * 2] / 65535 * MS, U[i * 2 + 1] / 65535 * MS]);
  const x0 = Math.floor(Math.min(...pts.map(p => p[0]))) - 1, x1 = Math.ceil(Math.max(...pts.map(p => p[0]))) + 1, y0 = Math.floor(Math.min(...pts.map(p => p[1]))) - 1, y1 = Math.ceil(Math.max(...pts.map(p => p[1]))) + 1;
  const ed = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const area = ed(pts[0], pts[1], pts[2]);
  for (let yy = Math.max(0, y0); yy <= Math.min(MS - 1, y1); yy++) for (let xx = Math.max(0, x0); xx <= Math.min(MS - 1, x1); xx++) {
    const q = [xx + .5, yy + .5]; let w0 = ed(pts[1], pts[2], q), w1 = ed(pts[2], pts[0], q), w2 = ed(pts[0], pts[1], q);
    if (area < 0) { w0 = -w0; w1 = -w1; w2 = -w2; }
    if (w0 >= -1.2 && w1 >= -1.2 && w2 >= -1.2) mask[yy * MS + xx] = kind;
  }
}
const pad4 = b => b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - b.length % 4)]) : b;
const out = Buffer.concat([Buffer.from('MAL1'), Buffer.from(new Uint32Array([n, I.length, MS]).buffer), ...[P, N, U, SI, SW, I, mask].map(a => pad4(Buffer.from(a.buffer)))]);
fs.writeFileSync(OUT, out);
let y0 = 9, y1 = -9, x1 = 0; for (let i = 0; i < n; i++) { y0 = Math.min(y0, P[i * 3 + 1] / 16000); y1 = Math.max(y1, P[i * 3 + 1] / 16000); x1 = Math.max(x1, Math.abs(P[i * 3] / 16000)); }
console.log('ok verts', n, 'tris', I.length / 3, 'bytes', out.length, 'y', y0.toFixed(3), y1.toFixed(3), 'x', x1.toFixed(3), 'mask px', mask.reduce((s, v) => s + v, 0), 'armRot', (armRot * 180 / Math.PI).toFixed(1), 'armK', armK.toFixed(2));
