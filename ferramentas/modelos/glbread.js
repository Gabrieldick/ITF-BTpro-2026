const fs = require('fs');
module.exports = function read(file) {
  const b = fs.readFileSync(file); const len = b.readUInt32LE(12); const j = JSON.parse(b.slice(20, 20 + len).toString());
  const binStart = 20 + len + 8; const dv = new DataView(b.buffer, b.byteOffset, b.length);
  const acc = i => { const a = j.accessors[i], bv = j.bufferViews[a.bufferView]; const off = binStart + (bv.byteOffset || 0) + (a.byteOffset || 0);
    const n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type]; const T = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array }[a.componentType];
    const es = T.BYTES_PER_ELEMENT, stride = bv.byteStride || n * es, out = new T(a.count * n);
    const get = { 5126: o => dv.getFloat32(o, true), 5125: o => dv.getUint32(o, true), 5123: o => dv.getUint16(o, true) }[a.componentType];
    for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = get(off + k * stride + c * es);
    return out; };
  const p = j.meshes[0].primitives[0];
  return { pos: acc(p.attributes.POSITION), nor: acc(p.attributes.NORMAL), idx: p.indices != null ? acc(p.indices) : null, json: j };
};
