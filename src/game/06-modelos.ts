// @ts-nocheck
// uniformes baixados, Carol e jogador masculino escaneado
import './05-atletas';
import * as THREE from 'three';
import { $s } from '../state';
import { assetUrl } from '../assets';
import { SWING_DUR, V3, clamp, lerp, smooth } from './00-base';
import { S } from './01-estado';
import { MAX_ANISO, col, mat, scene } from './02-render';
import { newPose } from './04-poses';
import { FOOT_GEO, HAND_GEO, PELVIS_PROF, SHADOW_TEX, THUMB_GEO, chainRings, headGeo, latheGeo, makeRacket, profR, shirtTex, shortsTex, skinTubeGeo } from './05-atletas';
import { b64Buf } from './07-glb';
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
  const pelvis = Y => profR(PELVIS_PROF[fem ? 1 : 0], clamp(Y - ctx.hipsY, -.03, .12));
  const hipW = Y => Math.max(pelvis(Y), lerp(pelvis(Y), hipX + thighR(Math.min(Y, H)), smooth(ctx.hipsY + .06, ctx.hipsY - .03, Y)));
  const legRef = !fem ? G.band(1, G.crotch - .08) : null; // perna do short: um só ajuste, sem degraus
  const ref = fem ? G.band(1, 1.0) : null;
  const refT = fem ? (() => { const Y = mapY(1.0); return [Math.max(pelvis(Y), hipX + thighR(Y)) + .035, pelvis(Y) * .74 + .06]; })() : null;
  const n = G.n, pos = [], nor = [], uv = [], si = [], sw = [], part = [];
  const nv = new V3();
  for (let i = 0; i < n; i++) {
    const x = G.P[i * 3], gy = G.P[i * 3 + 1], z = G.P[i * 3 + 2], L = G.L[i];
    const shirtLift = L === 0 ? .07 * smooth(1.1, .92, gy) : 0;
    const Y = mapY(gy) + shirtLift, sy = slope(gy), side = x < 0 ? 0 : 1;
    let X, Z, kx, kz;
    if (L === 0) { // camisa / top
      const b = G.band(0, gy) || { w: .15, cz: 0, d: .12 }, m = fem ? .014 : .016;
      let [rx, rz, cz] = torso(Y);
      // barra da camisa por fora do short/saia (como no modelo original)
      const over = smooth(ctx.hipsY + .2, ctx.hipsY + .1, Y);
      if (over > 0) { rx = lerp(rx, Math.max(rx, pelvis(Y) + .022 - m), over); rz = lerp(rz, Math.max(rz, pelvis(Y) * .74 + .03 - m), over); }
      kx = (rx + m) / b.w; kz = (rz + m) / b.d; X = x * kx; Z = (z - b.cz) * kz + cz;
      // fatias com poucos vértices (barra, gola) podem esticar demais: nada sai mais de 18% da elipse do corpo
      const e = Math.hypot(X / (rx + m), (Z - cz) / (rz + m));
      if (e > 1.18) { X *= 1.18 / e; Z = cz + (Z - cz) * 1.18 / e; }
    } else {
      const b = G.band(1, gy) || { w: .18, cz: 0, d: .12, l: [{ c: .1, w: .08, cz: 0, d: .08 }, { c: .1, w: .08, cz: 0, d: .08 }] };
      // parte de cima do short / cós da saia: veste o quadril
      const prx = hipW(Y) + .016, prz = pelvis(Y) * .74 + .022;
      let px = x * prx / b.w, pz = (z - b.cz) * prz / b.d, pkx = prx / b.w, pkz = prz / b.d;
      if (L === 2) { // saia: abaixo do quadril mantém o rodado da roupa, só ampliado
        const t = smooth(1.0, 1.05, gy);
        const sx = refT[0] / ref.w, sz = refT[1] / ref.d;
        px = lerp(x * sx, px, t); pz = lerp((z - ref.cz) * sz, pz, t); pkx = lerp(sx, pkx, t); pkz = lerp(sz, pkz, t);
        X = px; Z = pz; kx = pkx; kz = pkz;
      } else { // short: abaixo do gancho cada perna veste a coxa
        const lo = legRef.l[side], s = side ? 1 : -1, rl = thighR(G.crotch - .08 > 0 ? mapY(G.crotch - .08) : Y) + .03;
        const lx = s * (hipX + (Math.abs(x) - lo.c) * rl / lo.w), lz = (z - lo.cz) * rl * 1.04 / lo.d;
        const t = smooth(G.crotch - .01, G.crotch + .06, gy);
        X = lerp(lx, px, t); Z = lerp(lz, pz, t); kx = lerp(rl / lo.w, pkx, t); kz = lerp(rl * 1.04 / lo.d, pkz, t);
        const e = Math.hypot(px / prx, pz / prz) * t;
        if (e > 1.2) { X *= 1.2 / e; Z *= 1.2 / e; }
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
      t = L === 1 ? smooth(H + .12, H - .05, Y) * (.25 + .75 * smooth(0, .07, Math.abs(X))) * smooth(H + .16, H + .08, Y + 0) : .5 * smooth(H + .02, H - .1, Y) * smooth(0, .07, Math.abs(X));
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
const UNI_ON = () => { try { return S.settings.uniforms !== 'simples'; } catch (e) { return true; } };
// ---------- Carol (modelo baixado, convertido para o nosso esqueleto) ----------
const CAROL = { data: undefined };
const CAROL_KIND = ['wrist', 'socks', 'shoes', 'skirt', 'shirt', 'head', 'hair', 'cap', 'body'];
function carolData() {
  if (CAROL.data !== undefined) return CAROL.data;
  CAROL.data = null;
  try {
    const buf = b64Buf('carol-geo'); if (!buf) return null;
    const dv = new DataView(buf);
    if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'CRL2') return null;
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
      const url = assetUrl('carol-tex' + p.k); if (!url) return;
      const img = new Image(); const t = new THREE.Texture(img);
      t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAX_ANISO;
      img.onload = () => { t.needsUpdate = true; };
      img.src = url;
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
  // malha já convertida para a pose de repouso do esqueleto
  root.updateMatrixWorld(true);
  const skelT = new THREE.Skeleton(bones);
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
// ---------- jogador masculino escaneado (simplificado e convertido para o nosso esqueleto) ----------
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
    const img = new Image();
    img.onload = () => { D.img = img; maleClassify(D); D.waiting.splice(0).forEach(fn => fn()); };
    img.src = assetUrl('male-col');
    MALE.data = D;
  } catch (e) { MALE.data = null; }
  return MALE.data;
}
// separa camisa (azul), short (branco dentro da máscara do short) e o resto (pele, cabelo, faixa)
function maleClassify(D) {
  const W = D.img.width, H = D.img.height, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.drawImage(D.img, 0, 0); const px = x.getImageData(0, 0, W, H).data;
  const cls = new Uint8Array(W * H), sum = [0, 0, 0, 0], cnt = [0, 0, 0, 0], skin = [0, 0, 0, 0];
  for (let y = 0; y < H; y++) for (let xx = 0; xx < W; xx++) {
    const i = y * W + xx, r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    const L = (r * .3 + g * .59 + b * .11) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const mv = D.mask[Math.min(D.MS - 1, (y * D.MS / H) | 0) * D.MS + Math.min(D.MS - 1, (xx * D.MS / W) | 0)], inShorts = mv === 1, inSock = mv === 2;
    let k = 0;
    const sat = mx ? (mx - mn) / mx : 0, bluish = b > r + 8 && b >= g - 6;
    if (inShorts && sat < .4 && L > .2 && !(r > b + 18)) k = 2;            // short: branco/cinza (até a sombra azulada) dentro da área do short
    else if (inSock && sat < .35 && L > .3 && !(r > b + 18)) k = 3; // meia: vira pele (jogo descalço)
    else if (bluish && !(L > .82 && sat < .1)) k = 1;     // camisa: qualquer tom azulado (sombra ou brilho)
    if (!k && r > g && g > b && sat > .2 && L > .3) { skin[0] += r; skin[1] += g; skin[2] += b; skin[3]++; }
    cls[i] = k; sum[k] += L; cnt[k]++;
  }
  D.cls = cls; D.data = px; D.W = W; D.H = H; D.ref = sum.map((v, k) => cnt[k] ? v / cnt[k] : .5);
  D.skin = skin[3] ? [skin[0] / skin[3], skin[1] / skin[3], skin[2] / skin[3]] : [200, 150, 120];
}
function maleTexture(D, o) {
  const c = document.createElement('canvas'); const t = new THREE.CanvasTexture(c);
  t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAX_ANISO;
  const paint = () => {
    c.width = D.W; c.height = D.H; const x = c.getContext('2d'), im = x.createImageData(D.W, D.H), out = im.data, px = D.data;
    // cores em sRGB (o canvas trabalha em sRGB)
    const sh = new THREE.Color(o.shirt), so = new THREE.Color(o.shorts), a = new THREE.Color(o.skin), bb = new THREE.Color('#c98f6c');
    const sk = { r: clamp(a.r / bb.r, .3, 1.15), g: clamp(a.g / bb.g, .3, 1.15), b: clamp(a.b / bb.b, .3, 1.15) };
    for (let i = 0; i < D.cls.length; i++) {
      const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2], k = D.cls[i];
      if (k === 0) { const warm = r > g && g > b; out[i * 4] = warm ? Math.min(255, r * sk.r) : r; out[i * 4 + 1] = warm ? Math.min(255, g * sk.g) : g; out[i * 4 + 2] = warm ? Math.min(255, b * sk.b) : b; }
      else if (k === 3) { const L = (r * .3 + g * .59 + b * .11) / 255, f = clamp(L / D.ref[3], .75, 1.15); out[i * 4] = Math.min(255, D.skin[0] * sk.r * f); out[i * 4 + 1] = Math.min(255, D.skin[1] * sk.g * f); out[i * 4 + 2] = Math.min(255, D.skin[2] * sk.b * f); }
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
  // sem normal map: na malha simplificada ele criava brilhos espelhados onde o tecido estica
  const m = new THREE.MeshStandardMaterial({ map: maleTexture(D, o), roughness: .88, metalness: 0, side: THREE.DoubleSide, envMapIntensity: .35 });
  m.skinning = true;
  const hide = [];
  [D.geoRest, D.geoUp].forEach((geo, k) => {
    const sm = new THREE.SkinnedMesh(geo, m); sm.castShadow = true; sm.receiveShadow = true; sm.frustumCulled = false;
    root.add(sm); sm.updateMatrixWorld(true); sm.bind(skel, sm.matrixWorld);
    if (k === 1) hide.push(sm);
  });
  return hide;
}
const CAROL_ON = () => { try { return S.settings.players === 'carol'; } catch (e) { return false; } };
function skinMat(m) { const c = m.clone(); c.skinning = true; return c; }
function buildBodySkin(root, R, o, fem, BF, torsoProf, M) {
  const bones = [R.hips, R.spine, R.headG];
  R.legs.forEach(L => bones.push(L.thigh, L.knee, L.ankle));
  [-1, 1].forEach(s => bones.push(R.arms[s].sh, R.arms[s].el, R.arms[s].wrist));
  const bi = b => bones.indexOf(b);
  root.updateMatrixWorld(true);
  const wp = b => b.getWorldPosition(new V3());
  const hipsY = wp(R.hips).y, spineY = wp(R.spine).y, headY = wp(R.headG).y;
  const fl = fem ? .93 : 1, th = BF[1];
  const parts = { skin: [], up: [], shirt: [], sleeve: [], shorts: [], neck: [] };
  // pernas: glúteo/coxa cheia, quadríceps à frente, joelho mais fino, panturrilha atrás, tornozelo fino
  R.legs.forEach(L => {
    const hp = wp(L.thigh), kn = wp(L.knee).y, an = wp(L.ankle).y, H = hp.y;
    const chain = [[bi(R.hips), 9], [bi(L.thigh), H, .07], [bi(L.knee), kn, .05], [bi(L.ankle), an, .035]];
    const thighK = fem ? 1.14 : 1.1, calfK = fem ? .96 : 1.06;
    const LEG = [[H + .08, .05], [H + .05, .07], [H, .082], [H - .07, .088 * thighK, -.004], [H - .15, .085 * thighK, -.008], [H - .24, .077 * thighK, -.008], [H - .32, .066, -.004],
      [kn + .04, .056], [kn, .05, -.004], [kn - .04, .049, .002], [kn - .09, .053 * calfK, .01], [kn - .14, .057 * calfK, .014], [kn - .2, .053 * calfK, .011], [kn - .27, .043, .006],
      [an + .33 - .2, .034, .002], [an + .05, .029], [an + .01, .029, .004], [an - .03, .027, .006]];
    parts.skin.push({ x: hp.x, z: hp.z, rings: chainRings(LEG.map(([y, r, cz]) => [y, r * fl * th, cz || 0]), chain, y => y > kn ? .96 : .92, y => y > kn ? 1.04 : 1.06) });
    const SH = [[H + .12, .07], [H + .08, .1], [H + .03, .114], [H - .04, .118], [H - (fem ? .1 : .15), .119], [H - (fem ? .11 : .16), .113]];
    parts.shorts.push({ x: hp.x, z: hp.z, rings: chainRings(SH.map(([y, r]) => [y, r * th * (fem ? .97 : 1)]), chain.slice(0, 2), 1, 1.02) });
  });
  // braços: deltoide preso em parte ao tronco, bíceps à frente, antebraço achatado, punho fino
  [-1, 1].forEach(s => {
    const A = R.arms[s], S0 = wp(A.sh), E = wp(A.el).y, W = wp(A.wrist).y, Y = S0.y;
    const chain = [[bi(R.spine), 9], [bi(A.sh), Y, .04], [bi(A.el), E, .035], [bi(A.wrist), W, .02]];
    const ku = (fem ? .86 : 1) * th, kf = (fem ? .88 : 1) * th;
    const UP = [[Y + .065, .026, 0, -s * .024, .3], [Y + .045, .046, 0, -s * .013, .5], [Y + .02, .056, 0, -s * .004, .72], [Y - .01, .058, 0, 0, .9], [Y - .06, .055], [Y - .12, .05, -.004], [Y - .18, .045, -.003], [Y - .24, .039], [E, .036]];
    const FO = [[E, .036], [E - .035, .04, .004], [E - .085, .041, .002], [E - .145, .035], [E - .205, .028], [W + .025, .0245], [W, .023], [W - .015, .02]];
    parts.up.push({ x: S0.x, z: S0.z, rings: chainRings(UP.map(([y, r, cz, cx, f]) => [y, r * ku, cz, cx, f]), chain, 1, .93) });
    parts.skin.push({ x: S0.x, z: S0.z, rings: chainRings(FO.map(([y, r, cz]) => [y, r * kf, cz || 0]), chain, 1.06, .84) });
    if (!o.tank) {
      const SL = [[Y + .075, .03, 0, -s * .026, .28], [Y + .05, .054, 0, -s * .014, .48], [Y + .02, .064, 0, -s * .004, .72], [Y - .01, .065, 0, 0, .9], [Y - .06, .062], [Y - .1, .059], [Y - .11, .055]];
      parts.sleeve.push({ x: S0.x, z: S0.z, rings: chainRings(SL.map(([y, r, cz, cx, f]) => [y, r * ku, cz, cx, f]), chain, 1, .95) });
    }
  });
  // tronco (camisa): cintura presa ao quadril, peito ao tronco; peito/busto um pouco à frente
  const tw = BF[0], tz = .62 * (1 + (BF[0] - 1) * .6);
  const TOR = [[spineY - .07, torsoProf[1][0]]].concat(torsoProf.filter(([r]) => r > 0).map(([r, y]) => [spineY + y, r]));
  parts.shirt.push({ x: 0, z: 0, rings: chainRings(TOR.map(([y, r]) => { const py = y - spineY; return [y, r, -(fem ? .016 : .007) * smooth(.24, .34, py) * (1 - smooth(.44, .5, py))]; }), [[bi(R.spine), 9], [bi(R.hips), spineY + .04, .07]], tw, tz) });
  // pescoço: trapézio largo embaixo, preso à cabeça em cima
  const nk = fem ? .88 : 1;
  parts.neck.push({ x: 0, z: 0, rings: chainRings([[spineY + .5, .062], [spineY + .54, .052], [headY - .02, .049], [headY + .02, .047], [headY + .06, .045]].map(([y, r]) => [y, r * nk * Math.sqrt(th), .008]), [[bi(R.headG), 9], [bi(R.spine), headY, .04]], 1, .96) });
  const skel = new THREE.Skeleton(bones);
  const hide = [];
  const add = (list, m, seg) => {
    if (!list.length) return null;
    const sm = new THREE.SkinnedMesh(skinTubeGeo(list, seg), m);
    sm.castShadow = true; sm.receiveShadow = true; sm.frustumCulled = false;
    root.add(sm); sm.bind(skel); return sm;
  };
  const MD = !fem && CAROL_ON() ? maleData() : null;
  if (MD) return buildMale(root, R, o, bones, MD);
  const CD = fem && CAROL_ON() ? carolData() : null;
  if (CD) { if (R.tail) R.tail.visible = false; return buildCarol(root, R, o, bones, CD); }
  const skinS = skinMat(M.skinM), shirtS = skinMat(M.shirtM), shortS = skinMat(M.shortM);
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
  return hide.filter(Boolean);
}
function makeAthlete(o) {
  const fem = !!o.fem;
  const skinM = mat(o.skin, { roughness: .5, envMapIntensity: .45 });
  const shirtM = mat('#ffffff', { map: shirtTex(o), roughness: .88 });
  const shortM = mat('#ffffff', { map: shortsTex(o), roughness: .9 });
  const hairM = mat(o.hair, { roughness: .65 });
  const trimM = mat(o.trim, { roughness: .8 });
  const root = new THREE.Group();
  const mesh = (g, m, parent, x, y, z) => { const ms = new THREE.Mesh(g, m); ms.castShadow = true; ms.receiveShadow = true; ms.position.set(x || 0, y || 0, z || 0); parent.add(ms); return ms; };
  const hips = new THREE.Group(); hips.position.y = .92; root.add(hips);
  mesh(latheGeo(PELVIS_PROF[fem ? 1 : 0], 24, .74), shortM, hips);
  const hipX = fem ? .1 : .092;
  const BF = { compacto: [1.06, 1.08], forte: [1.12, 1.12], esguio: [.92, .87], atletico: [1, 1] }[o.build] || [1, 1];
  const legs = [];
  const footG = FOOT_GEO[fem ? 1 : 0];
  [-1, 1].forEach(s => {
    const thigh = new THREE.Group(); thigh.position.set(s * hipX, -.03, 0); hips.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -.42; thigh.add(knee);
    const ankle = new THREE.Group(); ankle.position.y = -.43; knee.add(ankle);
    mesh(footG, skinM, ankle).scale.x = s; // pé com arco, calcanhar e dedos
    legs.push({ thigh, knee, ankle });
  });
  const spine = new THREE.Group(); spine.position.y = .12; hips.add(spine);
  const torsoProf = fem
    ? [[0, 0], [.14, 0], [.135, .07], [.126, .16], [.136, .25], [.158, .32], [.168, .38], [.17, .43], [.16, .47], [.12, .51], [.07, .54], [.04, .55], [0, .555]]
    : [[0, 0], [.145, 0], [.15, .07], [.152, .16], [.168, .27], [.19, .37], [.2, .43], [.19, .48], [.15, .52], [.09, .55], [.05, .565], [0, .57]];
  const shX = (fem ? .182 : .205) * BF[0];
  const headG = new THREE.Group(); headG.position.y = .62; headG.rotation.order = 'YXZ'; spine.add(headG);
  const hd = new THREE.Group(); hd.scale.setScalar(fem ? .95 : 1); headG.add(hd);
  mesh(headGeo(fem), skinM, hd, 0, .1, 0);
  mesh(new THREE.SphereGeometry(.017, 8, 6), skinM, hd, 0, .092, -.105).scale.set(.8, 1.1, 1.2);
  [-1, 1].forEach(s => mesh(new THREE.SphereGeometry(.022, 8, 6), skinM, hd, s * .092, .1, .005).scale.set(.45, 1, .8));
  if (!o.glasses) {
    const white = mat('#f4f1ea', { roughness: .3 }), iris = mat('#2a1c12', { roughness: .2 }), brow = mat(o.hair, { roughness: .8 });
    [-1, 1].forEach(s => {
      mesh(new THREE.SphereGeometry(.013, 10, 8), white, hd, s * .035, .116, -.083);
      mesh(new THREE.SphereGeometry(.0075, 8, 6), iris, hd, s * .035, .116, -.095);
      mesh(new THREE.BoxGeometry(.032, .006, .01), brow, hd, s * .036, .136, -.092).rotation.z = s * -.12;
    });
  }
  mesh(new THREE.BoxGeometry(.032, .006, .008), mat('#8a4b3c', { roughness: .6 }), hd, 0, .058, -.096);
  // penteados
  const hs = o.hairStyle || (fem ? 'rabo' : 'curto');
  const capHair = (k, open) => { const h = mesh(new THREE.SphereGeometry(.108 * k, 22, 12, 0, Math.PI * 2, 0, Math.PI * open), hairM, hd, 0, .118, .01); h.scale.set(1, 1.12, 1.1); h.rotation.x = .28; return h; };
  if (hs !== 'careca') capHair(hs === 'raspado' ? .99 : 1, hs === 'raspado' ? .5 : fem || hs === 'longo' ? .62 : .54);
  if (hs === 'cacheado') for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, rr = .085; mesh(new THREE.SphereGeometry(.038, 8, 6), hairM, hd, Math.cos(a) * rr, .17 + Math.sin(i * 1.7) * .02, .02 + Math.sin(a) * rr); }
  if (hs === 'topete') mesh(new THREE.SphereGeometry(.06, 12, 8), hairM, hd, 0, .215, -.045).scale.set(1.3, .8, 1.1);
  if (hs === 'moicano') mesh(new THREE.BoxGeometry(.03, .06, .2), hairM, hd, 0, .225, .03);
  if (hs === 'longo') { const lg = new THREE.CylinderGeometry(.1, .08, .2, 16, 1, true, -Math.PI * .62, Math.PI * 1.24); lg.scale(1, 1, 1.1); mesh(lg, hairM, hd, 0, .05, .03).material.side = THREE.DoubleSide; } // aberto na frente (rosto)
  let tail = null;
  if (hs === 'rabo' || hs === 'tranca') {
    tail = new THREE.Group(); tail.position.set(0, .15, .1); hd.add(tail);
    mesh(new THREE.CylinderGeometry(.018, .018, .02, 10), trimM, tail, 0, -.005, 0);
    const seg = hs === 'tranca' ? [[.026, -.04, .02], [.024, -.085, .03], [.022, -.13, .035], [.02, -.175, .04], [.018, -.22, .04], [.016, -.265, .04]] : [[.034, -.045, .02], [.03, -.1, .035], [.024, -.155, .04], [.017, -.2, .04]];
    seg.forEach(([r, y, z]) => mesh(new THREE.SphereGeometry(r, 10, 8), hairM, tail, 0, y, z).scale.set(1, hs === 'tranca' ? 1.1 : 1.4, 1));
  }
  if (hs === 'coque') mesh(new THREE.SphereGeometry(.045, 12, 10), hairM, hd, 0, .2, .085);
  // barba
  if (!fem && o.beard) {
    if (o.beard === 'barba') mesh(new THREE.SphereGeometry(.068, 16, 10), hairM, hd, 0, .058, -.034).scale.set(1.22, .78, .95); // queixo e mandíbula
    if (o.beard === 'cavanhaque') mesh(new THREE.SphereGeometry(.025, 10, 8), hairM, hd, 0, .035, -.09).scale.set(1.1, 1.2, .8);
    if (o.beard === 'barba' || o.beard === 'bigode') mesh(new THREE.BoxGeometry(.045, .01, .012), hairM, hd, 0, .068, -.1);
  }
  // faixa de cabelo
  if (o.headband && !o.cap && !o.visor) mesh(new THREE.TorusGeometry(.104, .011, 6, 24), mat(o.headband, { roughness: .8 }), hd, 0, .16, .005).rotation.x = Math.PI / 2 + .25;
  if (o.cap) {
    const capM = mat(o.cap, { roughness: .8 });
    mesh(new THREE.SphereGeometry(.112, 20, 10, 0, Math.PI * 2, 0, Math.PI * .45), capM, hd, 0, .13, 0).scale.set(1, 1.05, 1.1);
    mesh(new THREE.CylinderGeometry(.11, .11, .008, 18, 1, false, Math.PI * .5, Math.PI), capM, hd, 0, .165, -.06).scale.set(1, 1, 1.15);
  }
  if (o.visor) {
    const vm = mat(o.visor, { roughness: .7 });
    mesh(new THREE.CylinderGeometry(.106, .106, .035, 20, 1, true), vm, hd, 0, .16, 0).scale.set(.95, 1, 1.12);
    mesh(new THREE.CylinderGeometry(.11, .11, .007, 18, 1, false, Math.PI * .5, Math.PI), vm, hd, 0, .15, -.07).scale.set(1, 1, 1.2);
  }
  if (o.glasses) {
    const gGeo = new THREE.TorusGeometry(.1, .014, 6, 24, Math.PI * .9); gGeo.rotateZ(Math.PI * .05); gGeo.rotateX(-Math.PI / 2);
    const lensM = mat(o.lens || '#0b0d10', { roughness: .06, metalness: .7, envMapIntensity: 1.6 });
    if (o.glassStyle === 'redondo') { [-1, 1].forEach(s => mesh(new THREE.TorusGeometry(.022, .004, 6, 16), lensM, hd, s * .036, .118, -.1)); mesh(new THREE.CylinderGeometry(.03, .03, .006, 12), lensM, hd, 0, .118, -.102).visible = false; [-1, 1].forEach(s => mesh(new THREE.CircleGeometry(.02, 14), lensM, hd, s * .036, .118, -.103).rotation.y = Math.PI); }
    else { const gl = mesh(gGeo, lensM, hd, 0, .118, 0); gl.scale.set(.96, 1.3, 1.08); }
  }
  const arms = {};
  [-1, 1].forEach(s => {
    const sh = new THREE.Group(); sh.position.set(s * shX, .47, 0); spine.add(sh);
    const el = new THREE.Group(); el.position.y = -.285; sh.add(el);
    if (o.band && s > 0) mesh(new THREE.CylinderGeometry(.031, .029, .045, 14), trimM, el, 0, -.235, 0);
    const wrist = new THREE.Group(); wrist.position.y = -.27; el.add(wrist);
    const hand = mesh(HAND_GEO[fem ? 1 : 0], skinM, wrist); hand.scale.x = s;
    mesh(THUMB_GEO, skinM, wrist, s * -.012, -.022, -.024).rotation.set(-.5, 0, s * .5);
    arms[s] = { sh, el, wrist };
  });
  const racket = makeRacket(o.racket); racket.position.y = .03; arms[1].wrist.add(racket);
  racket.traverse(m => { if (m.isMesh) m.castShadow = true; });
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(.9, .9), new THREE.MeshBasicMaterial({ map: SHADOW_TEX, transparent: true, depthWrite: false, opacity: .45 }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = .012; root.add(blob);
  const fpHide = buildBodySkin(root, { hips, spine, headG, legs, arms }, o, fem, BF, torsoProf, { skinM, shirtM, shortM });
  scene.add(root);
  return { group: root, hips, spine, headG, legs, armR: arms[1], armL: arms[-1], blob, tail, racket, fpHide };
}
function makePlayer(team, slot, look, isHuman, name) {
  return {
    team, slot, isHuman, name, look, skin: null, pos: new V3(), vel: new V3(), model: makeAthlete(look), gait: 0, footDown: [true, true],
    swing: { t: -1, type: 'defesa', hit: false, dur: SWING_DUR, side: 1, meter: null }, inputX: 0, jump: 0, yaw: 0, split: 0,
    charging: false, tossT: 0, headYaw: 0, headPitch: 0, debug: null, pose: newPose(),
    ai: { planId: -1, plan: null, reactT: 0, willMiss: false, letGo: false, shot: 'defesa', swung: false },
  };
}
const human   = makePlayer(0, 1,  { skin: '#c68a5e', shirt: '#ff5a1f', trim: '#fbf6ea', shorts: '#17324d', hair: '#2b1d14', cap: '#fbf6ea', glasses: true, racket: 'proteo', num: '7', band: true }, true, 'Você');
const partner = makePlayer(0, -1, { skin: '#e2b48f', shirt: '#ff7a3d', trim: '#17324d', shorts: '#17324d', hair: '#6a3f1d', visor: '#fbf6ea', glasses: false, racket: 'medusa', num: '11', fem: true, tank: true }, false, 'Parceira');
const cpuA    = makePlayer(1, 1,  { skin: '#8d5a3b', shirt: '#0b7a83', trim: '#fbf6ea', shorts: '#f2efe6', hair: '#120c08', cap: '#17324d', glasses: true, racket: 'kronos', num: '3', band: true }, false, 'CPU');
const cpuB    = makePlayer(1, -1, { skin: '#b07a52', shirt: '#13939c', trim: '#ffd23f', shorts: '#f2efe6', hair: '#2a1a0e', visor: '#17324d', glasses: false, racket: 'supercarbon', num: '9', fem: true, tank: true }, false, 'CPU 2');
const ALL = [human, partner, cpuA, cpuB];
$s.players = [human, cpuA];
$s.teams = [[human], [cpuA]];

export { ALL, MALE, cpuA, cpuB, human, makeAthlete, partner };
