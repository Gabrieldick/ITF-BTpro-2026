const fs = require('fs'); const f = process.argv[2]; let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 80)); s = s.replace(a, b); };
// braços baixados no próprio arquivo: rotação gradual em volta do ombro (sem bico no ombro)
rep("function map(x, y, z, kind) {", "function mapT(x, y, z, kind) {");
rep("// ossos: 0 quadril", `function map(x, y, z, kind) {
  const p = mapT(x, y, z, kind);
  if (kind === 'head' || kind === 'hair' || kind === 'cap' || kind === 'skirt') return p;
  const s = p[0] < 0 ? -1 : 1, ax = Math.abs(p[0]);
  if (p[1] < 1.3 || ax < R.shX - .07) return p;
  const w = smooth(R.shX - .07, R.shX + .09, ax), a = -s * Math.PI / 2 * w;
  const dx = p[0] - s * R.shX, dy = p[1] - R.shY, c = Math.cos(a), sn = Math.sin(a);
  return [s * R.shX + dx * c - dy * sn, R.shY + dx * sn + dy * c, p[2]];
}
// ossos: 0 quadril`);
// segmentos dos braços na posição de repouso (pendurados)
rep("  seg(a, [sx, R.shY, 0], [sx + s * R.ua, R.shY, 0], s); seg(a + 1, [sx + s * R.ua, R.shY, 0], [sx + s * (R.ua + R.fa), R.shY, 0], s); seg(a + 2, [sx + s * (R.ua + R.fa), R.shY, 0], [sx + s * (R.ua + R.fa + .19), R.shY, 0], s);",
    "  seg(a, [sx, R.shY, 0], [sx, R.shY - R.ua, 0], s); seg(a + 1, [sx, R.shY - R.ua, 0], [sx, R.shY - R.ua - R.fa, 0], s); seg(a + 2, [sx, R.shY - R.ua - R.fa, 0], [sx, R.shY - R.ua - R.fa - .19, 0], s);");
rep("const bufs = [Buffer.from('CRL1')", "const bufs = [Buffer.from('CRL2')");
fs.writeFileSync(f, s); console.log('ok');
