const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };

rep(`<label for="plCarol">Carol nas mulheres</label>`, `<label for="plCarol">Modelos realistas</label>`);
rep(`Carol: “Carol Tennis Player Girl” de agra_aoe, licença CC BY 4.0 (Sketchfab).</p>`, `Modelos realistas: jogadoras com a “Carol Tennis Player Girl” de agra_aoe (CC BY 4.0, Sketchfab); jogadores com um modelo escaneado de tenista.</p>`);
rep("    const lk = c.id + c.build + (S.settings.uniforms || '') + (S.settings.players === 'carol' ? 'C' : '');", "    const lk = c.id + c.build + (S.settings.uniforms || '') + (S.settings.players === 'carol' ? 'C' : '') + (look.shirt || '') + (look.skin || '');");

rep("const CAROL_ON = () => {", `// ---------- jogador masculino escaneado (simplificado e convertido para o nosso esqueleto) ----------
const MALE = { data: undefined };
function maleData() {
  if (MALE.data !== undefined) return MALE.data;
  MALE.data = null;
  try {
    const buf = b64Buf('male-geo'); if (!buf) return null;
    const dv = new DataView(buf);
    if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'MAL1') return null;
    const n = dv.getUint32(4, true), ni = dv.getUint32(8, true), MS = dv.getUint32(12, true); let o = 16;
    const take = (T, len) => { const bytes = len * T.BYTES_PER_ELEMENT, a = new T(buf.slice(o, o + bytes)); o += bytes; o = (o + 3) & ~3; return a; };
    const P = take(Int16Array, n * 3), N = take(Int8Array, n * 3), U = take(Uint16Array, n * 2), SI = take(Uint8Array, n * 4), SW = take(Uint8Array, n * 4), I = take(Uint16Array, ni), mask = take(Uint8Array, MS * MS);
    const pos = new Float32Array(n * 3); for (let i = 0; i < n * 3; i++) pos[i] = P[i] / 16000;
    const mk = idx => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(N, 3, true));
      g.setAttribute('uv', new THREE.BufferAttribute(U, 2, true));
      g.setAttribute('skinIndex', new THREE.BufferAttribute(SI, 4));
      g.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4, true));
      g.setIndex(new THREE.BufferAttribute(idx, 1)); return g;
    };
    // cabeça, tronco e braço de cima separados (somem na 1ª pessoa)
    const up = [], rest = [], isUp = i => { const b = SI[i * 4]; return b === 1 || b === 2 || b === 9 || b === 12; };
    for (let t = 0; t < I.length; t += 3) (isUp(I[t]) || isUp(I[t + 1]) || isUp(I[t + 2]) ? up : rest).push(I[t], I[t + 1], I[t + 2]);
    const D = { geoRest: mk(Uint16Array.from(rest)), geoUp: mk(Uint16Array.from(up)), mask, MS, img: null, cls: null, ref: null, waiting: [] };
    const nimg = new Image(); const nt = new THREE.Texture(nimg); nt.flipY = false; nimg.onload = () => { nt.needsUpdate = true; };
    nimg.src = 'data:image/jpeg;base64,' + document.getElementById('male-nor').textContent.trim(); D.normal = nt;
    const img = new Image();
    img.onload = () => { D.img = img; maleClassify(D); D.waiting.splice(0).forEach(fn => fn()); };
    img.src = 'data:image/jpeg;base64,' + document.getElementById('male-col').textContent.trim();
    MALE.data = D;
  } catch (e) { MALE.data = null; }
  return MALE.data;
}
// separa camisa (azul), short (branco dentro da máscara do short) e o resto (pele, cabelo, faixa)
function maleClassify(D) {
  const W = D.img.width, H = D.img.height, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.drawImage(D.img, 0, 0); const px = x.getImageData(0, 0, W, H).data;
  const cls = new Uint8Array(W * H), sum = [0, 0, 0], cnt = [0, 0, 0];
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const i = y * W + xx, r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    const L = (r * .3 + g * .59 + b * .11) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const inShorts = D.mask[Math.min(D.MS - 1, (y * D.MS / H) | 0) * D.MS + Math.min(D.MS - 1, (xx * D.MS / W) | 0)];
    let k = 0;
    if (b > r + 22 && b > g + 4) k = 1;
    else if (inShorts && L > .5 && mx - mn < 48) k = 2;
    cls[i] = k; sum[k] += L; cnt[k]++;
  }
  D.cls = cls; D.data = px; D.W = W; D.H = H; D.ref = sum.map((v, k) => cnt[k] ? v / cnt[k] : .5);
}
function maleTexture(D, o) {
  const c = document.createElement('canvas'); const t = new THREE.CanvasTexture(c);
  t.flipY = false; t.encoding = THREE.sRGBEncoding; t.anisotropy = MAX_ANISO;
  const paint = () => {
    c.width = D.W; c.height = D.H; const x = c.getContext('2d'), im = x.createImageData(D.W, D.H), out = im.data, px = D.data;
    // cores em sRGB (o canvas trabalha em sRGB)
    const sh = new THREE.Color(o.shirt), so = new THREE.Color(o.shorts), a = new THREE.Color(o.skin), bb = new THREE.Color('#c98f6c');
    const sk = { r: clamp(a.r / bb.r, .3, 1.15), g: clamp(a.g / bb.g, .3, 1.15), b: clamp(a.b / bb.b, .3, 1.15) };
    for (let i = 0; i < D.cls.length; i++) {
      const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], k = D.cls[i];
      if (k === 0) { const warm = r > g && g > b; out[i * 4] = warm ? Math.min(255, r * sk.r) : r; out[i * 4 + 1] = warm ? Math.min(255, g * sk.g) : g; out[i * 4 + 2] = warm ? Math.min(255, b * sk.b) : b; }
      else {
        const L = (r * .3 + g * .59 + b * .11) / 255, cc = k === 1 ? sh : so, f = clamp(L / D.ref[k], .35, 1.6) * 255;
        out[i * 4] = Math.min(255, cc.r * f); out[i * 4 + 1] = Math.min(255, cc.g * f); out[i * 4 + 2] = Math.min(255, cc.b * f);
      }
      out[i * 4 + 3] = 255;
    }
    x.putImageData(im, 0, 0); t.needsUpdate = true;
  };
  if (D.cls) paint(); else D.waiting.push(paint);
  return t;
}
function buildMale(root, R, o, bones, D) {
  root.updateMatrixWorld(true);
  const skel = new THREE.Skeleton(bones);
  const off = m => { if (m.isMesh) { m.visible = false; m.userData.off = true; } };
  R.headG.traverse(off); R.hips.children.forEach(off);
  [-1, 1].forEach(s => { R.arms[s].wrist.children.forEach(off); R.arms[s].el.children.forEach(off); });
  const m = new THREE.MeshStandardMaterial({ map: maleTexture(D, o), normalMap: D.normal, roughness: .72, metalness: 0, side: THREE.DoubleSide, envMapIntensity: .5 });
  m.skinning = true;
  const hide = [];
  [D.geoRest, D.geoUp].forEach((geo, k) => {
    const sm = new THREE.SkinnedMesh(geo, m); sm.castShadow = true; sm.receiveShadow = true; sm.frustumCulled = false;
    root.add(sm); sm.updateMatrixWorld(true); sm.bind(skel, sm.matrixWorld);
    if (k === 1) hide.push(sm);
  });
  return hide;
}
const CAROL_ON = () => {`);
rep("  const CD = fem && CAROL_ON() ? carolData() : null;\n  if (CD) {", "  const MD = !fem && CAROL_ON() ? maleData() : null;\n  if (MD) return buildMale(root, R, o, bones, MD);\n  const CD = fem && CAROL_ON() ? carolData() : null;\n  if (CD) {");
fs.writeFileSync(f, s); console.log('ok');
