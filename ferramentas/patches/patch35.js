const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };

// perfis do quadril compartilhados entre o desenho e o ajuste do uniforme
rep("  mesh(latheGeo(fem ? [[0, -.03], [.09, -.045], [.15, -.04], [.18, .0], [.18, .07], [.15, .14], [0, .145]] : [[0, -.03], [.085, -.045], [.14, -.04], [.168, .0], [.17, .08], [.152, .14], [0, .145]], 24, .74), shortM, hips);",
    "  mesh(latheGeo(PELVIS_PROF[fem ? 1 : 0], 24, .74), shortM, hips);");

rep("function skinMat(m) {", `const PELVIS_PROF = [[[0, -.03], [.085, -.045], [.14, -.04], [.168, .0], [.17, .08], [.152, .14], [0, .145]], [[0, -.03], [.09, -.045], [.15, -.04], [.18, .0], [.18, .07], [.15, .14], [0, .145]]];
// raio de um perfil [r, y] na altura y (pega o maior raio entre os trechos que cruzam y)
function profR(prof, y) {
  let best = 0;
  for (let i = 0; i < prof.length - 1; i++) {
    const [r0, y0] = prof[i], [r1, y1] = prof[i + 1];
    if ((y - y0) * (y - y1) <= 0 && y0 !== y1) best = Math.max(best, lerp(r0, r1, (y - y0) / (y1 - y0)));
  }
  if (!best) { const pts = prof.filter(([r]) => r > 0); best = y < pts[0][1] ? pts[0][0] : pts[pts.length - 1][0]; }
  return best;
}
// ---------- uniformes baixados (camisa/short masculino, top/saia feminino) ----------
const UNIFORM = {};
function uniformData(fem) {
  const k = fem ? 'f' : 'm';
  if (k in UNIFORM) return UNIFORM[k];
  UNIFORM[k] = null;
  try {
    const buf = b64Buf(fem ? 'uni-f' : 'uni-m'); if (!buf) return null;
    const dv = new DataView(buf), n = dv.getUint32(0, true), ni = dv.getUint32(4, true);
    let o = 8; const P = new Float32Array(buf.slice(o, o + n * 12)); o += n * 12;
    const N = new Int8Array(buf, o, n * 3); o += n * 3;
    const L = new Uint8Array(buf, o, n); o += n; if (o % 2) o++;
    const I = new Uint16Array(buf.slice(o, o + ni * 2));
    // perfil da roupa em fatias de 1 cm: largura, frente/trás e, abaixo do gancho, cada perna
    const bands = {};
    const B = (part, b) => { const key = part + ':' + b; return bands[key] || (bands[key] = { w: 0, z0: 1e9, z1: -1e9, l: [{ a: 1e9, b: 0, z0: 1e9, z1: -1e9 }, { a: 1e9, b: 0, z0: 1e9, z1: -1e9 }] }); };
    for (let i = 0; i < n; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], part = L[i] === 0 ? 0 : 1, b = Math.round(y * 100);
      const Q = B(part, b); Q.w = Math.max(Q.w, Math.abs(x)); Q.z0 = Math.min(Q.z0, z); Q.z1 = Math.max(Q.z1, z);
      const lo = Q.l[x < 0 ? 0 : 1]; lo.a = Math.min(lo.a, Math.abs(x)); lo.b = Math.max(lo.b, Math.abs(x)); lo.z0 = Math.min(lo.z0, z); lo.z1 = Math.max(lo.z1, z);
    }
    // gancho do short: fatia mais alta em que as pernas ainda estão separadas
    let crotch = 0;
    for (const key in bands) { const [part, b] = key.split(':').map(Number); if (part === 1 && Math.min(bands[key].l[0].a, bands[key].l[1].a) > .008 && b / 100 > crotch && b / 100 < .9) crotch = b / 100; }
    const band = (part, y) => { // média de 5 fatias vizinhas para suavizar
      const c = Math.round(y * 100); let w = 0, z0 = 0, z1 = 0, ln = [[0, 0, 0, 0], [0, 0, 0, 0]], k = 0;
      for (let d = -2; d <= 2; d++) { const Q = bands[part + ':' + (c + d)]; if (!Q) continue; k++; w += Q.w; z0 += Q.z0; z1 += Q.z1; Q.l.forEach((lo, i) => { ln[i][0] += lo.a; ln[i][1] += lo.b; ln[i][2] += lo.z0; ln[i][3] += lo.z1; }); }
      if (!k) return null;
      return { w: w / k, cz: (z0 + z1) / 2 / k, d: Math.max(.02, (z1 - z0) / 2 / k), l: ln.map(v => ({ c: (v[0] + v[1]) / 2 / k, w: Math.max(.02, (v[1] - v[0]) / 2 / k), cz: (v[2] + v[3]) / 2 / k, d: Math.max(.02, (v[3] - v[2]) / 2 / k) })) };
    };
    UNIFORM[k] = { n, P, N, L, I, band, crotch };
  } catch (e) { UNIFORM[k] = null; }
  return UNIFORM[k];
}
// veste o atleta: cada fatia da roupa é reescalada para o corpo dele (com folga), e cada vértice é preso aos ossos
function buildUniform(G, fem, ctx) {
  const { spineY, H, kn, shY, headY, hipX, BF, torsoProf, bones, thighI, hipsI, spineI, thighR } = ctx;
  const tz = .62 * (1 + (BF[0] - 1) * .6);
  // altura da roupa (manequim) -> altura no nosso esqueleto
  const LM = [[.40, H - .4], [.78, H - .085], [.88, H], [1.08, spineY + .03], [1.33, shY - .09], [1.46, shY + .02], [1.50, shY + .075], [1.57, headY - .01]];
  const mapY = gy => { let i = 0; while (i < LM.length - 2 && gy > LM[i + 1][0]) i++; const [a, A] = LM[i], [b, Bv] = LM[i + 1]; return A + (gy - a) * (Bv - A) / (b - a); };
  const slope = gy => (mapY(gy + .005) - mapY(gy - .005)) / .01;
  const torso = Y => { const py = Y - spineY; const r = Math.max(profR(torsoProf, clamp(py, 0, .555)), py > .46 ? .062 * (fem ? .9 : 1) : 0); return [r * BF[0], r * tz, -(fem ? .016 : .007) * smooth(.24, .34, py) * (1 - smooth(.44, .5, py))]; };
  const pelvis = Y => profR(PELVIS_PROF[fem ? 1 : 0], Y - ctx.hipsY);
  const ref = fem ? G.band(1, 1.0) : null;
  const refT = fem ? (() => { const Y = mapY(1.0); return [Math.max(pelvis(Y), hipX + thighR(Y)) + .035, pelvis(Y) * .74 + .06]; })() : null;
  const n = G.n, pos = [], nor = [], uv = [], si = [], sw = [], part = [];
  const nv = new V3();
  for (let i = 0; i < n; i++) {
    const x = G.P[i * 3], gy = G.P[i * 3 + 1], z = G.P[i * 3 + 2], L = G.L[i];
    const Y = mapY(gy), sy = slope(gy), side = x < 0 ? 0 : 1;
    let X, Z, kx, kz;
    if (L === 0) { // camisa / top
      const b = G.band(0, gy) || { w: .15, cz: 0, d: .12 }, [rx, rz, cz] = torso(Y), m = fem ? .014 : .016;
      kx = (rx + m) / b.w; kz = (rz + m) / b.d; X = x * kx; Z = (z - b.cz) * kz + cz;
    } else {
      const b = G.band(1, gy) || { w: .18, cz: 0, d: .12, l: [{ c: .1, w: .08, cz: 0, d: .08 }, { c: .1, w: .08, cz: 0, d: .08 }] };
      // parte de cima do short / cós da saia: veste o quadril
      const prx = Math.max(pelvis(Y), hipX + thighR(Math.min(Y, H))) + .016, prz = pelvis(Y) * .74 + .022;
      let px = x * prx / b.w, pz = (z - b.cz) * prz / b.d, pkx = prx / b.w, pkz = prz / b.d;
      if (L === 2) { // saia: abaixo do quadril mantém o rodado da roupa, só ampliado
        const t = smooth(1.0, 1.05, gy);
        const sx = refT[0] / ref.w, sz = refT[1] / ref.d;
        px = lerp(x * sx, px, t); pz = lerp((z - ref.cz) * sz, pz, t); pkx = lerp(sx, pkx, t); pkz = lerp(sz, pkz, t);
        X = px; Z = pz; kx = pkx; kz = pkz;
      } else { // short: abaixo do gancho cada perna veste a coxa
        const lo = b.l[side], s = side ? 1 : -1, rl = thighR(Y) + .03;
        const lx = s * (hipX + (Math.abs(x) - lo.c) * rl / lo.w), lz = (z - lo.cz) * rl * 1.04 / lo.d;
        const t = smooth(G.crotch - .01, G.crotch + .06, gy);
        X = lerp(lx, px, t); Z = lerp(lz, pz, t); kx = lerp(rl / lo.w, pkx, t); kz = lerp(rl * 1.04 / lo.d, pkz, t);
      }
    }
    pos.push(X, Y, Z);
    nv.set(G.N[i * 3] / kx, G.N[i * 3 + 1] / sy, G.N[i * 3 + 2] / kz).normalize(); nor.push(nv.x, nv.y, nv.z);
    let a = Math.atan2(X, Z) / (Math.PI * 2); if (a < 0) a += 1;
    uv.push(a, L === 0 ? (Y - (spineY - .1)) / (headY - spineY + .05) : (Y - (H - .45)) / (ctx.hipsY + .15 - (H - .45)));
    // ossos: tronco/quadril para a camisa; quadril/coxa para short e saia
    let b0 = hipsI, b1 = spineI, t = 0;
    if (L === 0) t = smooth(spineY - .02, spineY + .12, Y);
    else {
      b1 = thighI[side];
      t = L === 1 ? smooth(H + .05, H - .06, Y) * smooth(0, .04, Math.abs(X)) : .5 * smooth(H + .02, H - .1, Y) * smooth(0, .07, Math.abs(X));
    }
    si.push(b0, b1, 0, 0); sw.push(1 - t, t, 0, 0); part.push(L === 0 ? 0 : 1);
  }
  // costura do mapa cilíndrico (nas costas): triângulos que cruzam ganham cópias com u + 1
  const out = [[], []];
  const dup = new Map();
  for (let t = 0; t < G.I.length; t += 3) {
    const tri = [G.I[t], G.I[t + 1], G.I[t + 2]], us = tri.map(i => uv[i * 2]);
    const wrap = Math.max(...us) - Math.min(...us) > .5;
    const ids = tri.map((i, k) => {
      if (!wrap || us[k] >= .5) return i;
      let j = dup.get(i);
      if (j == null) { j = pos.length / 3; dup.set(i, j); pos.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); nor.push(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]); uv.push(uv[i * 2] + 1, uv[i * 2 + 1]); si.push(si[i * 4], si[i * 4 + 1], 0, 0); sw.push(sw[i * 4], sw[i * 4 + 1], 0, 0); }
      return j;
    });
    out[part[tri[0]]].push(...ids);
  }
  const mk = idx => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    g.setIndex(idx); return g;
  };
  return { top: mk(out[0]), bottom: mk(out[1]) };
}
function skinMat(m) {`);

// usa o uniforme no lugar da camisa/short desenhados
rep("  const skinS = skinMat(M.skinM), shirtS = skinMat(M.shirtM), shortS = skinMat(M.shortM);\n  add(parts.skin, skinS, 18); add(parts.shorts, shortS, 22);\n  hide.push(add(parts.up, o.tank ? skinS : skinS, 18), add(parts.sleeve, shirtS, 18), add(parts.shirt, shirtS, 30), add(parts.neck, skinS, 16));\n  return hide.filter(Boolean);",
`  const skinS = skinMat(M.skinM), shirtS = skinMat(M.shirtM), shortS = skinMat(M.shortM);
  const G = UNI_ON() ? uniformData(fem) : null;
  if (G) {
    // tecido: textura do time enrolada em volta do corpo
    [shirtS, shortS].forEach(m => { if (m.map) { m.map = m.map.clone(); m.map.wrapS = THREE.RepeatWrapping; m.map.needsUpdate = true; } m.roughness = .9; m.side = THREE.DoubleSide; });
    const thighR = y => lerp(.09, .056, clamp((R.legs[1] ? wp(R.legs[1].thigh).y - y : 0) / .42, 0, 1)) * (fem ? 1.14 : 1.1) * fl * th;
    const U = buildUniform(G, fem, { spineY, hipsY, H: wp(R.legs[1].thigh).y, kn: wp(R.legs[1].knee).y, shY: wp(R.arms[1].sh).y, headY, hipX: Math.abs(wp(R.legs[1].thigh).x), BF, torsoProf,
      bones, hipsI: bi(R.hips), spineI: bi(R.spine), thighI: [bi(R.legs[0].thigh), bi(R.legs[1].thigh)], thighR });
    const um = (geo, m) => { const sm = new THREE.SkinnedMesh(geo, m); sm.castShadow = true; sm.receiveShadow = true; sm.frustumCulled = false; root.add(sm); sm.bind(skel); return sm; };
    add(parts.skin, skinS, 18);
    if (fem) add(parts.shorts, shortS, 22); // bermuda de lycra por baixo da saia
    um(U.bottom, shortS);
    hide.push(add(parts.up, skinS, 18), add(parts.shirt, skinS, 30), add(parts.neck, skinS, 16), um(U.top, shirtS));
    return hide.filter(Boolean);
  }
  add(parts.skin, skinS, 18); add(parts.shorts, shortS, 22);
  hide.push(add(parts.up, o.tank ? skinS : skinS, 18), add(parts.sleeve, shirtS, 18), add(parts.shirt, shirtS, 30), add(parts.neck, skinS, 16));
  return hide.filter(Boolean);`);
rep("function skinMat(m) {", "const UNI_ON = () => !(typeof S !== 'undefined' && S.settings && S.settings.uniforms === 'simples');\nfunction skinMat(m) {");
fs.writeFileSync(f, s);
console.log('ok');
