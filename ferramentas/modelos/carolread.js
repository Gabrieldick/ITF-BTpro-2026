const fs = require('fs');
module.exports = function (file) {
  const b = fs.readFileSync(file); const buf = b.buffer.slice(b.byteOffset, b.byteOffset + b.length);
  const cnt = new Uint32Array(buf, 0, 1)[0]; let o = 4; const meshes = [];
  for (let k = 0; k < cnt; k++) {
    const [n, ni] = new Uint32Array(buf.slice(o, o + 8)); o += 8;
    const P = new Float32Array(buf.slice(o, o + n * 12)); o += n * 12;
    const N = new Float32Array(buf.slice(o, o + n * 12)); o += n * 12;
    const U = new Float32Array(buf.slice(o, o + n * 8)); o += n * 8;
    const I = new Uint32Array(buf.slice(o, o + ni * 4)); o += ni * 4;
    meshes.push({ n, P, N, U, I });
  }
  return meshes;
};
