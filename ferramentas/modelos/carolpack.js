// Converte a Carol (pose T, proporções de desenho) para o esqueleto do jogo e grava um binário compacto
// com pesos de pele já calculados. Uso: node carolpack.js carolraw.bin saida.bin
const fs = require('fs');
const M = require('./carolread.js')(process.argv[2]);
const OUT = process.argv[3];
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const pw = (pts, x) => { let i = 0; while (i < pts.length - 2 && x > pts[i + 1][0]) i++; const [a, A] = pts[i], [b, B] = pts[i + 1]; return A + (x - a) * (B - A) / (b - a); };

// peças: 0 munhequeira, 1 meia, 2 tênis, 3 saia, 4 camisa, 5 cabeça, 6 cabelo, 7 boné, 8 corpo
const KIND = ['wrist', 'socks', 'shoes', 'skirt', 'shirt', 'head', 'hair', 'cap', 'body'];
const DROP = new Set([1, 2]); // descalça como os outros jogadores

// esqueleto do jogo (feminino, em pé) com braços abertos em pose T
const R = { hipX: .1, H: .89, kn: .47, an: .04, hips: .92, spine: 1.04, head: 1.66, shX: .182, shY: 1.51, ua: .285, fa: .27 };
// medidas da Carol
const C = { an: .10, kn: .49, H: .81, sh: 1.365, shX: .17, wrist: .60, neck: 1.44 };
const VY = [[C.an, R.an], [C.kn, R.kn], [C.H, R.H], [C.sh, R.shY], [C.neck, pw([[C.H, R.H], [C.sh, R.shY]], C.neck)]];
const neckY = VY[4][1];
const HS = .8; // cabeça um pouco menor (mais realista)
const legDz = [[0, -.06], [.2, -.065], [.4, -.066], [.5, -.04], [.6, -.018], [.72, -.012], [.8, 0]];
const XS = 1.07;
function mapT(x, y, z, kind) {
  // tronco e pernas
  let Y = pw(VY.slice(0, 4), y), X = x * XS, Z = z + (y < .8 ? pw(legDz, y) : 0);
  // braços (pose T): estica ao longo do braço até o punho; a mão mantém o tamanho
  const ax = Math.abs(x), s = Math.sign(x) || 1;
  if (ax > .13 && y > 1.22 && y < 1.5 && kind !== 'head' && kind !== 'hair' && kind !== 'cap') {
    const along = ax - C.shX, armLen = C.wrist - C.shX, ours = R.ua + R.fa;
    const na = along <= armLen ? along * ours / armLen : ours + (along - armLen);
    const aX = s * (R.shX + na), aY = R.shY + (y - C.sh), aZ = z;
    const t = smooth(.13, .19, ax);
    X = lerp(X, aX, t); Y = lerp(Y, aY, t); Z = lerp(Z, aZ, t);
  }
  // cabeça, cabelo, boné (e gola): escala uniforme a partir da base do pescoço
  if (kind === 'head' || kind === 'hair' || kind === 'cap' || (kind === 'shirt' && y > 1.42 && ax < .13)) {
    const t = kind === 'shirt' ? smooth(1.42, 1.47, y) : smooth(1.38, 1.47, y);
    const hX = x * HS, hY = neckY + (y - C.neck) * HS, hZ = z * HS;
    X = lerp(X, hX, t); Y = lerp(Y, hY, t); Z = lerp(Z, hZ, t);
  }
  return [X, Y, Z];
}

function map(x, y, z, kind) {
  const p = mapT(x, y, z, kind);
  if (kind === 'head' || kind === 'hair' || kind === 'cap' || kind === 'skirt') return p;
  const s = p[0] < 0 ? -1 : 1, ax = Math.abs(p[0]);
  if (p[1] < 1.3 || ax < R.shX - .07) return p;
  const w = smooth(R.shX - .07, R.shX + .09, ax), a = -s * Math.PI / 2 * w;
  const dx = p[0] - s * R.shX, dy = p[1] - R.shY, c = Math.cos(a), sn = Math.sin(a);
  return [s * R.shX + dx * c - dy * sn, R.shY + dx * sn + dy * c, p[2]];
}
// ossos: 0 quadril, 1 tronco, 2 cabeça, 3-5 perna esq (coxa, joelho, tornozelo), 6-8 perna dir, 9-11 braço esq (ombro, cotovelo, punho), 12-14 braço dir
const segs = [];
const seg = (b, a, c, side) => segs.push({ b, a, c, side });
seg(0, [0, .84, 0], [0, 1.04, 0], 0);
seg(1, [0, 1.04, 0], [0, 1.56, 0], 0);
seg(2, [0, 1.62, 0], [0, 1.95, 0], 0);
[-1, 1].forEach((s, i) => {
  const o = i ? 6 : 3, x = s * R.hipX;
  seg(o, [x, R.H, 0], [x, R.kn, 0], s); seg(o + 1, [x, R.kn, 0], [x, R.an, 0], s); seg(o + 2, [x, R.an, 0], [x, 0, -.16], s);
  const a = i ? 12 : 9, sx = s * R.shX;
  seg(a, [sx, R.shY, 0], [sx, R.shY - R.ua, 0], s); seg(a + 1, [sx, R.shY - R.ua, 0], [sx, R.shY - R.ua - R.fa, 0], s); seg(a + 2, [sx, R.shY - R.ua - R.fa, 0], [sx, R.shY - R.ua - R.fa - .19, 0], s);
});
const LEG = new Set([3, 4, 5, 6, 7, 8]), ARM = new Set([9, 10, 11, 12, 13, 14]);
function segDist(p, S) {
  const ab = [S.c[0] - S.a[0], S.c[1] - S.a[1], S.c[2] - S.a[2]], ap = [p[0] - S.a[0], p[1] - S.a[1], p[2] - S.a[2]];
  const t = Math.max(0, Math.min(1, (ab[0] * ap[0] + ab[1] * ap[1] + ab[2] * ap[2]) / (ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2)));
  return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t);
}
function weights(p, kind, armSrc) {
  const [X, Y] = p, side = X < 0 ? -1 : 1;
  if (kind === 'head' || kind === 'hair' || kind === 'cap') { const t = smooth(neckY - .02, neckY + .06, Y); return [[2, t], [1, 1 - t]]; }
  if (kind === 'skirt') { const t = .45 * smooth(R.H + .02, R.H - .1, Y) * smooth(0, .07, Math.abs(X)); return [[0, 1 - t], [side < 0 ? 3 : 6, t]]; }
  const c = [];
  for (const S of segs) {
    if (LEG.has(S.b) && (S.side !== side && Math.abs(X) > .02)) continue;
    if (LEG.has(S.b) && Y > R.H + .12) continue;
    if (ARM.has(S.b) && (!armSrc || S.side !== side)) continue;
    if (armSrc && (LEG.has(S.b) || S.b === 0)) continue;
    if (S.b === 2 && Y < neckY - .03) continue;
    const d = segDist(p, S) + .004;
    c.push([S.b, 1 / d ** 4]);
  }
  c.sort((a, b) => b[1] - a[1]);
  const top = c.slice(0, 3), sum = top.reduce((s, v) => s + v[1], 0);
  return top.map(([b, w]) => [b, w / sum]);
}
// normal: inversa-transposta da jacobiana do mapeamento (diferenças finitas)
function inv3(m) {
  const [a, b, c, d, e, f, g, h, i] = m, A = e * i - f * h, B = -(d * i - f * g), Cc = d * h - e * g, det = a * A + b * B + c * Cc;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, Cc / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}
const parts = [];
M.forEach((m, k) => {
  if (DROP.has(k)) return;
  const kind = KIND[k], n = m.n;
  const P = new Int16Array(n * 3), N = new Int8Array(n * 3), U = new Uint16Array(n * 2), SI = new Uint8Array(n * 4), SW = new Uint8Array(n * 4);
  const e = .002;
  for (let i = 0; i < n; i++) {
    const x = m.P[i * 3], y = m.P[i * 3 + 1], z = m.P[i * 3 + 2];
    const p = map(x, y, z, kind);
    const jx = map(x + e, y, z, kind), jy = map(x, y + e, z, kind), jz = map(x, y, z + e, kind);
    const J = [(jx[0] - p[0]) / e, (jy[0] - p[0]) / e, (jz[0] - p[0]) / e, (jx[1] - p[1]) / e, (jy[1] - p[1]) / e, (jz[1] - p[1]) / e, (jx[2] - p[2]) / e, (jy[2] - p[2]) / e, (jz[2] - p[2]) / e];
    const Ji = inv3(J); // normal' = Ji^T n
    const nx = m.N[i * 3], ny = m.N[i * 3 + 1], nz = m.N[i * 3 + 2];
    let a = Ji[0] * nx + Ji[3] * ny + Ji[6] * nz, b = Ji[1] * nx + Ji[4] * ny + Ji[7] * nz, c = Ji[2] * nx + Ji[5] * ny + Ji[8] * nz;
    const l = Math.hypot(a, b, c) || 1; a /= l; b /= l; c /= l;
    for (let q = 0; q < 3; q++) P[i * 3 + q] = Math.round(p[q] * 16000);
    N[i * 3] = Math.round(a * 127); N[i * 3 + 1] = Math.round(b * 127); N[i * 3 + 2] = Math.round(c * 127);
    U[i * 2] = Math.round(Math.min(1, Math.max(0, m.U[i * 2])) * 65535); U[i * 2 + 1] = Math.round(Math.min(1, Math.max(0, m.U[i * 2 + 1])) * 65535);
    const armSrc = kind === 'wrist' || ((kind === 'body' || kind === 'shirt') && y > 1.22 && y < 1.5 && Math.abs(x) > .13);
    const w = weights(p, kind, armSrc); let tot = 0;
    w.forEach(([bn, wt], q) => { SI[i * 4 + q] = bn; SW[i * 4 + q] = Math.round(wt * 255); tot += SW[i * 4 + q]; });
    SW[i * 4] += 255 - tot;
  }
  if (n > 65535) throw new Error('verts');
  parts.push({ k, kind, n, P, N, U, SI, SW, I: Uint16Array.from(m.I) });
});
// formato: 'CRL1', nPartes; por parte: k(u8) pad(3) n(u32) ni(u32), P, N, U, SI, SW, I (cada bloco alinhado a 4)
const bufs = [Buffer.from('CRL2'), Buffer.from(new Uint32Array([parts.length]).buffer)];
const pad4 = b => b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - b.length % 4)]) : b;
for (const p of parts) {
  bufs.push(Buffer.from(new Uint32Array([p.k, p.n, p.I.length]).buffer));
  [p.P, p.N, p.U, p.SI, p.SW, p.I].forEach(a => bufs.push(pad4(Buffer.from(a.buffer))));
}
const out = Buffer.concat(bufs); fs.writeFileSync(OUT, out);
console.log('ok', parts.map(p => p.kind + ':' + p.n).join(' '), out.length, 'bytes');
// conferência: alturas finais
parts.forEach(p => { let y0 = 9, y1 = -9, x1 = 0; for (let i = 0; i < p.n; i++) { const y = p.P[i * 3 + 1] / 16000; y0 = Math.min(y0, y); y1 = Math.max(y1, y); x1 = Math.max(x1, Math.abs(p.P[i * 3] / 16000)); } console.log(p.kind, 'y', y0.toFixed(3), y1.toFixed(3), 'x', x1.toFixed(3)); });
