const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };

// opção no menu + crédito (CC BY)
rep(`        <input type="radio" name="players" id="plDraw" value="desenhado" checked><label for="plDraw">Desenhado</label>
      </div></fieldset>`, `        <input type="radio" name="players" id="plDraw" value="desenhado" checked><label for="plDraw">Desenhado</label>
        <input type="radio" name="players" id="plCarol" value="carol"><label for="plCarol">Carol nas mulheres</label>
      </div><p class="credit" style="margin:.4rem 0 0;font-size:.72rem;opacity:.7">Carol: “Carol Tennis Player Girl” de agra_aoe, licença CC BY 4.0 (Sketchfab).</p></fieldset>`);
rep("  p.lefty = !!(p.char && p.char.canhoto) && S.settings.players === 'desenhado';", "  p.lefty = !!(p.char && p.char.canhoto) && S.settings.players !== '3d';");
rep("  const on = S.settings.players !== 'desenhado';", "  const on = S.settings.players === '3d';");
rep("    p.model.group.traverse(o => { if (o.isMesh && o !== p.model.blob) o.visible = !on; });", "    p.model.group.traverse(o => { if (o.isMesh && o !== p.model.blob) o.visible = !on && !o.userData.off; });");
rep("  m.headG.traverse(o => { if (o.isMesh) o.visible = !on; });\n  // tronco", "  m.headG.traverse(o => { if (o.isMesh) o.visible = !on && !o.userData.off; });\n  // tronco");
rep("    const lk = c.id + c.build + (S.settings.uniforms || '');", "    const lk = c.id + c.build + (S.settings.uniforms || '') + (S.settings.players === 'carol' ? 'C' : '');");

// Carol: dados, materiais e montagem no esqueleto
rep("function skinMat(m) {", `// ---------- Carol (modelo baixado, convertido para o nosso esqueleto) ----------
const CAROL = { data: undefined };
const CAROL_KIND = ['wrist', 'socks', 'shoes', 'skirt', 'shirt', 'head', 'hair', 'cap', 'body'];
function carolData() {
  if (CAROL.data !== undefined) return CAROL.data;
  CAROL.data = null;
  try {
    const buf = b64Buf('carol-geo'); if (!buf) return null;
    const dv = new DataView(buf);
    if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'CRL1') return null;
    let o = 4; const cnt = dv.getUint32(o, true); o += 4;
    const take = (T, len) => { const bytes = len * T.BYTES_PER_ELEMENT, a = new T(buf.slice(o, o + bytes)); o += bytes; o = (o + 3) & ~3; return a; };
    const parts = [];
    for (let q = 0; q < cnt; q++) {
      const k = dv.getUint32(o, true), n = dv.getUint32(o + 4, true), ni = dv.getUint32(o + 8, true); o += 12;
      const P = take(Int16Array, n * 3), N = take(Int8Array, n * 3), U = take(Uint16Array, n * 2), SI = take(Uint8Array, n * 4), SW = take(Uint8Array, n * 4), I = take(Uint16Array, ni);
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
      const kind = CAROL_KIND[k];
      if (kind === 'body') {
        // braço de cima e ombros separados: somem na 1ª pessoa
        const up = [], rest = [], isUp = i => SI[i * 4] === 9 || SI[i * 4] === 12 || SI[i * 4] === 1;
        for (let t = 0; t < I.length; t += 3) (isUp(I[t]) || isUp(I[t + 1]) || isUp(I[t + 2]) ? up : rest).push(I[t], I[t + 1], I[t + 2]);
        parts.push({ k, kind, geo: mk(Uint16Array.from(rest)) }, { k, kind: 'bodyUp', geo: mk(Uint16Array.from(up)) });
      } else parts.push({ k, kind, geo: mk(I) });
    }
    const tex = {};
    parts.forEach(p => {
      if (tex[p.k]) return;
      const el = document.getElementById('carol-tex' + p.k); if (!el) return;
      const img = new Image(); const t = new THREE.Texture(img);
      t.flipY = false; t.encoding = THREE.sRGBEncoding; t.anisotropy = MAX_ANISO;
      img.onload = () => { t.needsUpdate = true; };
      img.src = 'data:image/jpeg;base64,' + el.textContent.trim();
      tex[p.k] = t;
    });
    CAROL.data = { parts, tex };
  } catch (e) { CAROL.data = null; }
  return CAROL.data;
}
// tinge a textura original com a cor do jogador/time (multiplicação, relativa à cor de base da Carol)
function carolTint(target, base) {
  const a = col(target), b = col(base);
  return new THREE.Color(clamp(a.r / b.r, .2, 1.15), clamp(a.g / b.g, .2, 1.15), clamp(a.b / b.b, .2, 1.15));
}
function buildCarol(root, R, o, bones, D) {
  // pose T para o encaixe: braços abertos na horizontal
  const zR = R.arms[1].sh.rotation.z, zL = R.arms[-1].sh.rotation.z;
  R.arms[1].sh.rotation.z = Math.PI / 2; R.arms[-1].sh.rotation.z = -Math.PI / 2;
  root.updateMatrixWorld(true);
  const skelT = new THREE.Skeleton(bones);
  R.arms[1].sh.rotation.z = zR; R.arms[-1].sh.rotation.z = zL;
  root.updateMatrixWorld(true);
  // o desenho some (fica só o pé descalço e a raquete)
  const off = m => { if (m.isMesh) { m.visible = false; m.userData.off = true; } };
  R.headG.traverse(off); R.hips.children.forEach(off);
  [-1, 1].forEach(s => { R.arms[s].wrist.children.forEach(off); R.arms[s].el.children.forEach(off); });
  const tint = {
    body: carolTint(o.skin, '#e9b291'), bodyUp: carolTint(o.skin, '#e9b291'), head: carolTint(o.skin, '#e9b291'),
    hair: carolTint(o.hair, '#6e4128'), shirt: col(o.shirt).lerp(new THREE.Color(1, 1, 1), .25), skirt: col(o.shorts).lerp(new THREE.Color(1, 1, 1), .15),
    cap: col(o.cap || o.visor || o.trim), wrist: col(o.trim),
  };
  const hide = [];
  for (const p of D.parts) {
    const m = new THREE.MeshStandardMaterial({ map: D.tex[p.k] || null, color: tint[p.kind] || new THREE.Color(1, 1, 1), roughness: p.kind === 'hair' ? .5 : p.kind === 'head' || p.kind.startsWith('body') ? .55 : .85, metalness: 0, side: THREE.DoubleSide, envMapIntensity: .5 });
    m.skinning = true;
    const sm = new THREE.SkinnedMesh(p.geo, m); sm.castShadow = true; sm.receiveShadow = true; sm.frustumCulled = false;
    root.add(sm); sm.updateMatrixWorld(true); sm.bind(skelT, sm.matrixWorld);
    if (p.kind === 'head' || p.kind === 'hair' || p.kind === 'cap' || p.kind === 'shirt' || p.kind === 'bodyUp') hide.push(sm);
  }
  return hide;
}
const CAROL_ON = () => { try { return S.settings.players === 'carol'; } catch (e) { return false; } };
function skinMat(m) {`);
rep("  const skinS = skinMat(M.skinM), shirtS = skinMat(M.shirtM), shortS = skinMat(M.shortM);\n  const G = UNI_ON() ? uniformData(fem) : null;",
    "  const CD = fem && CAROL_ON() ? carolData() : null;\n  if (CD) { if (R.tail) R.tail.visible = false; return buildCarol(root, R, o, bones, CD); }\n  const skinS = skinMat(M.skinM), shirtS = skinMat(M.shirtM), shortS = skinMat(M.shortM);\n  const G = UNI_ON() ? uniformData(fem) : null;");
fs.writeFileSync(f, s); console.log('ok');
