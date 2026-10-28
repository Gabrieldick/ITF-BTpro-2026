// @ts-nocheck
// modelos GLB (jogadores realistas do MakeHuman) e escalação dos personagens
import './06-modelos';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { assetBuf } from '../assets';
import { PATTERNS, G, KITS, V3, charById, clamp, effA, hScale, heightOf, nameOf, racketBonus, rand , lookExtras } from './00-base';
import { S } from './01-estado';
import { camera, canvasTex, col, mat, scene } from './02-render';
import { RACKETS, SHADOW_TEX, capsuleGeo, makeRacket, setRacketModels } from './05-atletas';
import { ALL, cpuA, cpuB, human, makeAthlete, partner } from './06-modelos';
import { charSkill, playStyleOf } from './16-ia';
// ---------- Jogadores com modelo 3D (GLB) dirigidos pelo rig de animação ----------
const GLB = { male: null, female: null };
function b64Buf(id) { return assetBuf(id); }
function loadModels() {
  return new Promise(resolve => {
    const loader = new GLTFLoader();
    const jobs = [['male', 'glb-male'], ['female', 'glb-female']].map(([k, id]) => new Promise(r => {
      let buf = null; try { buf = b64Buf(id); } catch (e) { buf = null; }
      if (!buf) return r();
      try { loader.parse(buf, '', g => { GLB[k] = g; r(); }, () => r()); } catch (e) { r(); }
    }));
    // raquetes modeladas no Blender (geometria; a arte de cada modelo continua pintada no jogo)
    jobs.push(new Promise(r => { let buf = null; try { buf = b64Buf('glb-rk'); } catch (e) { buf = null; } if (!buf) return r(); try { loader.parse(buf, '', g => { setRacketModels(g); r(); }, () => r()); } catch (e) { r(); } }));
    Promise.all(jobs).then(() => resolve(!!(GLB.male && GLB.female)));
    setTimeout(() => resolve(!!(GLB.male && GLB.female)), 15000);
  });
}
const ROT_BONES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'RightShoulder'];
const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];
// pegada: a mão se orienta pelo cabo (palma no cabo, mão na diagonal), os dedos fecham em volta dele e a raquete encaixa no punho
const CURL = { sign: 1, ps: 1, sx: 1, ga: .9, grip: [1.25, 1.45, 1.0], thumb: [1.0, .6, .5], relax: .3, pd: .028, fist: .72, q: new THREE.Quaternion() };
const PALM = { angle: 1.5 }; // giro da mão livre no smash (rad)
function attachSkin(p, gltf) {
  const root = SkeletonUtils.clone(gltf.scene);
  const holder = new THREE.Group(); holder.add(root); scene.add(holder);
  const B = {}, all = [];
  root.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      if (o.material) {
        o.material = o.material.clone(); o.material.envMapIntensity = .6;
        // barba e raspado ficam a 1–2 mm da pele: puxados para a frente na profundidade (não piscam com a pele de longe)
        if (/^(Beard|Goatee|Mustache|HairBuzz)/.test(o.name)) { o.material.polygonOffset = true; o.material.polygonOffsetFactor = -2; o.material.polygonOffsetUnits = -6; }
      }
    }
    if (o.isBone) { const k = o.name.replace(/^mixamorig[:_]?/, ''); B[k] = o; o.userData.rq = o.quaternion.clone(); o.userData.rp = o.position.clone(); all.push(o); }
  });
  if (!B.Hips || !B.RightHand || !B.LeftFoot) { scene.remove(holder); return; }
  holder.updateMatrixWorld(true);
  const wp = b => b.getWorldPosition(new V3());
  const d = (a, b) => wp(B[a]).distanceTo(wp(B[b]));
  const k = {
    holder, B, all, restW: {},
    faceFix: wp(B.LeftUpLeg).x > wp(B.RightUpLeg).x ? Math.PI : 0,
    footH: wp(B.LeftFoot).y,
    arm: [d('RightArm', 'RightForeArm'), d('RightForeArm', 'RightHand')],
    armL: [d('LeftArm', 'LeftForeArm'), d('LeftForeArm', 'LeftHand')],
    leg: [d('LeftUpLeg', 'LeftLeg'), d('LeftLeg', 'LeftFoot')],
    toe: { L: wp(B.LeftToeBase).sub(wp(B.LeftFoot)), R: wp(B.RightToeBase).sub(wp(B.RightFoot)) },
    racket: makeRacket(p.look.racket),
  };
  ROT_BONES.forEach(n => { k.restW[n] = new THREE.Quaternion(); });
  // membros: cada osso guarda, no próprio espaço, a direção do filho e o eixo da dobra (cotovelo dobra para a frente,
  // joelho para trás). No jogo o osso é orientado por esses dois eixos (direção + plano da dobra): sem a torção aleatória
  // de só "apontar" o osso, que fazia o braço girar em eixos estranhos no smash e no backhand
  const fw = new V3(k.toe.L.x, 0, k.toe.L.z).normalize(), bw = fw.clone().negate();
  k.lim = {};
  [['RightArm', 'RightForeArm', fw], ['RightForeArm', 'RightHand', fw], ['LeftArm', 'LeftForeArm', fw], ['LeftForeArm', 'LeftHand', fw],
   ['RightUpLeg', 'RightLeg', bw], ['RightLeg', 'RightFoot', bw], ['LeftUpLeg', 'LeftLeg', bw], ['LeftLeg', 'LeftFoot', bw]].forEach(([a, c, F]) => {
    const u = wp(B[c]).sub(wp(B[a])).normalize(), h = new V3().crossVectors(u, F).normalize(), qi = B[a].getWorldQuaternion(new THREE.Quaternion()).invert();
    u.applyQuaternion(qi); h.applyQuaternion(qi);
    k.lim[a] = { mi: new THREE.Matrix4().makeBasis(u, h, new V3().crossVectors(u, h)).transpose(), h: null };
  });
  // mãos: direção punho→dedos, normal da palma e eixo de fechar de cada dedo (no espaço de cada osso)
  k.hand = {};
  for (const S of ['Right', 'Left']) {
    const H = B[S + 'Hand'], m1 = B[S + 'HandMiddle1'], i1 = B[S + 'HandIndex1'], p1 = B[S + 'HandPinky1'];
    if (!H || !m1 || !i1 || !p1) continue;
    const d = wp(m1).sub(wp(H)).normalize(), lat = wp(i1).sub(wp(p1)).normalize(), pn = new V3().crossVectors(lat, d).normalize();
    const hq = H.getWorldQuaternion(new THREE.Quaternion()).invert(), dl = d.clone().applyQuaternion(hq), pl = pn.clone().applyQuaternion(hq);
    const fingers = [];
    for (const f of ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb']) for (let j = 1; j <= 3; j++) {
      const bn = B[S + 'Hand' + f + j]; if (!bn) continue;
      fingers.push({ b: bn, j, thumb: f === 'Thumb', ax: (f === 'Thumb' ? d : lat).clone().applyQuaternion(bn.getWorldQuaternion(new THREE.Quaternion()).invert()).normalize() });
    }
    k.hand[S] = { mi: new THREE.Matrix4().makeBasis(dl, pl, new V3().crossVectors(dl, pl)).transpose(), fingers, len: wp(m1).distanceTo(wp(H)) };
  }
  k.mh = new THREE.Box3().setFromObject(root).max.y || 1.8; k.s = 1; root.userData.mh = k.mh; // altura do modelo (para a escala pela altura do personagem)
  dressSkin(p, root);
  k.racket.traverse(m => { if (m.isMesh) m.castShadow = true; }); scene.add(k.racket);
  p.skin = k;
  p.model.group.traverse(o => { if (o.isMesh && o !== p.model.blob) o.visible = false; });
}
// veste o modelo realista conforme o personagem: o arquivo traz todas as peças (blusas, short, saia, cabelo, rabo de cavalo,
// manguito, meião, óculos); escolhe as do personagem (sempre as mesmas para ele) e pinta pele, cabelo e uniforme do time
const SKIN_BASE = new THREE.Color('#d9a982'), HAIR_BASE = new THREE.Color('#7a7a7a');
function tint(m, target, base) { if (!m) return; const t = col(target); m.color.setRGB(t.r / base.r, t.g / base.g, t.b / base.b); }
const HAIR_PARTS = ['Hair', 'HairCards', 'HairFringe', 'HairBuzz', 'HairMohawk', 'HairCurly', 'HairCurlyCards', 'HairLong', 'HairBob', 'Bun', 'Pony', 'PonyCards'];
const BEARDS = ['Beard', 'Goatee', 'Mustache'];
// estampa da blusa no modelo realista: desenhada no shader pela posição de repouso do tecido (acompanha o tecido no
// movimento); logo do patrocinador no peito
const PAT_GLSL = `
float pHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float pNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(pHash(i), pHash(i + vec2(1.0, 0.0)), f.x), mix(pHash(i + vec2(0.0, 1.0)), pHash(i + vec2(1.0, 1.0)), f.x), f.y); }
float patF(int id, vec3 q, float H) {
  float y = q.y / H, x = q.x, yy = q.y;
  if (id == 1) return step(0.5, fract(y * 22.0));
  if (id == 2) return step(0.78, fract(x * 14.0 + 0.5));
  if (id == 3) return 1.0 - step(0.05, abs(x * 0.9 + (yy - H * 0.72) * 0.8));
  if (id == 4) return smoothstep(0.58, 0.8, y);
  if (id == 5) return step(0.125, abs(x));
  if (id == 6) return step(0.55, fract(y * 10.0 + abs(x) * 6.0));
  if (id == 7) { vec2 g = vec2(x * 18.0, yy * 18.0); g.x += step(1.0, mod(floor(g.y), 2.0)) * 0.5; return 1.0 - step(0.2, length(fract(g) - 0.5)); }
  if (id == 8) { float n = pNoise(vec2(x, yy) * 9.0) * 0.65 + pNoise(vec2(x, yy) * 23.0) * 0.35; return step(0.56, n); }
  if (id == 9) return step(0.795, y);
  if (id == 10) return step(0.6, fract(y * 14.0 + sin(x * 26.0) * 0.22));
  if (id == 11) { vec2 g = vec2(x, yy) * 7.0; float n = pNoise(g) + 0.5 * pNoise(g * 2.3 + 7.0); float l = abs(fract(g.x * 1.7 + g.y * 0.6) - 0.5); return step(0.92, n) * step(0.12, l); }
  return 0.0;
}`;
const LOGO_TEX = {};
function logoTex(brand, color) {
  const k = brand + color; if (LOGO_TEX[k]) return LOGO_TEX[k];
  const c = document.createElement('canvas'); c.width = 512; c.height = 160; const x = c.getContext('2d');
  x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle'; let fs = 96; x.font = '900 ' + fs + 'px Arial, sans-serif';
  while (x.measureText(brand.toUpperCase()).width > 480 && fs > 30) { fs -= 6; x.font = '900 ' + fs + 'px Arial, sans-serif'; }
  x.fillText(brand.toUpperCase(), 256, 80);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (LOGO_TEX[k] = t);
}
function patShirt(m, id, c2, logo, logoCol, H) {
  const U = m.userData.pat || (m.userData.pat = { uPat: { value: 0 }, uC2: { value: new THREE.Color() }, uH: { value: 1.76 }, uLogo: { value: null }, uLogoOn: { value: 0 } });
  U.uPat.value = id; U.uC2.value.copy(c2); U.uH.value = H; U.uLogo.value = logo ? logoTex(logo, logoCol) : null; U.uLogoOn.value = logo ? 1 : 0;
  if (m.userData.patOn) return; m.userData.patOn = true;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;\nuniform int uPat; uniform vec3 uC2; uniform float uH; uniform sampler2D uLogo; uniform float uLogoOn;' + PAT_GLSL)
      .replace('#include <map_fragment>', `#include <map_fragment>
      diffuseColor.rgb = mix(diffuseColor.rgb, uC2, patF(uPat, vRest, uH));
      if (uLogoOn > 0.5 && vRest.z > 0.0) { vec2 lu = vec2((vRest.x + 0.09) / 0.18, (vRest.y - uH * 0.735) / 0.056); if (lu.x > 0.0 && lu.x < 1.0 && lu.y > 0.0 && lu.y < 1.0) { vec4 lc = texture2D(uLogo, lu); diffuseColor.rgb = mix(diffuseColor.rgb, lc.rgb, lc.a); } }`);
  };
  m.customProgramCacheKey = () => 'patShirt'; m.needsUpdate = true;
}
function dressSkin(p, root) {
  const look = p.look || {}, c = p.char || {}, fem = !!look.fem;
  let h = 2166136261; for (const ch of String(c.id || c.name || '')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const r = k => ((h >>> (k * 3)) % 997) / 997;
  const parts = {}; root.traverse(o => { if (o.isMesh) (parts[o.name] = parts[o.name] || []).push(o); });
  const show = (n, on) => (parts[n] || []).forEach(o => { o.visible = on; o.userData.off = !on; });
  const matOf = n => (parts[n] || [])[0] && parts[n][0].material;
  // roupa: homens de camiseta (às vezes regata); mulheres de regata + short, cropped + saia, camiseta + saia ou macacão (regata + saia da mesma cor)
  let top, skirt = false, dress = false, berm = false;
  if (look.top) { top = look.top === 'crop' && !fem ? 'tee' : look.top; skirt = fem && look.bottom === 'saia'; berm = look.bottom === 'bermuda'; } // uniforme próprio
  else if (fem) { const o = Math.floor(r(1) * 4); top = ['tank', 'crop', 'tee', 'tank'][o]; skirt = o > 0; dress = o === 3; }
  else { top = r(1) < .72 ? 'tee' : 'tank'; berm = r(6) < .25; }
  ['tee', 'tank', 'crop'].forEach(t => show('Top_' + t, t === top));
  show('Skirt', skirt); show('Bermuda', berm && !skirt); show('Shorts', !(berm && !skirt));
  // cabelo: cada corte é um conjunto de peças do arquivo (casca, mechas, borda, rabo, coque…); barba idem
  const hs = look.hairStyle || '';
  const cut = fem ? ({ coque: ['Hair', 'HairCards', 'HairFringe', 'Bun'], longo: ['Hair', 'HairLong', 'HairFringe'], cacheado: ['Hair', 'HairLong', 'HairFringe'], curto: ['Hair', 'HairBob', 'HairFringe'] }[hs] || ['Hair', 'HairCards', 'HairFringe', 'Pony', 'PonyCards'])
    : ({ careca: [], raspado: ['HairBuzz'], moicano: ['HairBuzz', 'HairMohawk'], cacheado: ['HairCurly', 'HairCurlyCards'], longo: ['Hair', 'HairLong', 'HairFringe'] }[hs] || ['Hair', 'HairCards', 'HairFringe']);
  const bd = fem ? '' : ({ barba: 'Beard', cavanhaque: 'Goatee', bigode: 'Mustache' }[look.beard] || '');
  // boné/viseira/faixa: o boné esconde o volume do cabelo (fica a base curta por baixo; o rabo sai por trás)
  const cap = !!look.cap, vis = !cap && !!look.visor, band = !cap && !vis && !!look.headband;
  const under = cap ? ['HairCards', 'HairFringe', 'HairMohawk', 'HairCurlyCards', 'Bun'] : vis || band ? ['HairFringe', 'HairMohawk'] : [];
  HAIR_PARTS.forEach(n => show(n, cut.includes(n) && !under.includes(n)));
  if (cap && hs === 'cacheado' && !fem) show('Hair', true);
  show('Cap', cap); show('CapBrim', cap); show('Visor', vis); show('VisorBrim', vis); show('Headband', band);
  [['Cap', look.cap], ['CapBrim', look.cap], ['Visor', look.visor], ['VisorBrim', look.visor], ['Headband', look.headband]].forEach(([n, c]) => { const m = matOf(n); if (m && c) m.color.copy(col(c)); });
  BEARDS.forEach(n => { show(n, n === bd); show(n + 'Edge', n === bd); });
  show('Glasses', !!look.glasses); show('GlassesFrame', !!look.glasses);
  show('ArmSleeve', r(2) < .22 && !c.canhoto); show('Calf', fem && r(3) < .3); // (o manguito do arquivo é do braço direito)
  // pele: os trechos que a blusa escolhida cobre somem (não atravessam a roupa)
  for (const n in parts) if (n.startsWith('BodySk_')) show(n, !n.slice(7).split('_').includes(top));
  // físico: formas do arquivo sobre o atlético
  const shape = { esguio: { Magro: 1 }, compacto: { Gordo: .7 }, forte: { Forte: 1 } }[look.build || c.build] || {};
  root.traverse(o => { if (o.isMesh && o.morphTargetDictionary) for (const k in o.morphTargetDictionary) o.morphTargetInfluences[o.morphTargetDictionary[k]] = shape[k] || 0; });
  // cores (cada jogador tem os próprios materiais, clonados em attachSkin)
  for (const n in parts) if (n === 'Body' || n.startsWith('BodySk_')) parts[n].forEach(o => tint(o.material, look.skin || '#c68a62', SKIN_BASE));
  for (const n of HAIR_PARTS.concat(BEARDS, BEARDS.map(x => x + 'Edge'))) (parts[n] || []).forEach(o => tint(o.material, look.hair || '#2a1a0e', HAIR_BASE));
  const shirt = col(look.shirt || '#1f6fd1'), shorts = col(look.shorts || '#17324d');
  // estampa: a do uniforme próprio; os outros jogadores ganham uma (sempre a mesma para cada um) na cor do detalhe do time
  const pat = look.pattern || ['liso', 'liso', 'liso', 'listras', 'lateral', 'ombros', 'degrade', 'faixas', 'chevron'][Math.floor(r(7) * 9)];
  ['tee', 'tank', 'crop'].forEach(t => { const m = matOf('Top_' + t); if (m) { m.color.copy(shirt); patShirt(m, PATTERNS[pat] ? PATTERNS[pat].id : 0, col(look.shirt2 || look.trim || '#fbf6ea'), look.logo, look.shirt2 || look.trim || '#fbf6ea', p.skin ? p.skin.mh : (root.userData.mh || 1.76)); } });
  if (matOf('Bermuda')) matOf('Bermuda').color.copy(shorts);
  if (matOf('Shorts')) matOf('Shorts').color.copy(dress ? shirt : shorts);
  if (matOf('Skirt')) matOf('Skirt').color.copy(dress ? shirt : shorts);
  const trim = col(look.trim || '#fbf6ea');
  if (matOf('ArmSleeve')) matOf('ArmSleeve').color.copy(trim); if (matOf('Calf')) matOf('Calf').color.copy(trim);
  if (matOf('Glasses')) matOf('Glasses').color.copy(col(look.lens || '#0b0d10'));
  if (matOf('GlassesFrame')) matOf('GlassesFrame').color.copy(col(look.frame || '#15171a'));
}
// escala do modelo pela altura do personagem (os comprimentos usados na animação acompanham)
function scaleSkin(p) {
  const k = p.skin; if (!k) return;
  const s = (p.height || 1.8) / (k.mh || 1.8), f = s / (k.s || 1); if (Math.abs(f - 1) < 1e-4) return;
  k.holder.scale.setScalar(s); k.s = s;
  k.arm = k.arm.map(x => x * f); k.armL = k.armL.map(x => x * f); k.leg = k.leg.map(x => x * f);
  k.toe.L.multiplyScalar(f); k.toe.R.multiplyScalar(f); k.footH *= f;
}
const _k1 = new V3(), _k2 = new V3(), _k3 = new V3(), _kS = new V3(), _kM = new V3(), _kE = new V3(), _kU = new V3(), _kT = new V3(), _kP = new V3(), _kJ = new V3();
const _ka = new V3(), _kb = new V3(), _kc = new V3(), _ke1 = new V3(), _ke2 = new V3(), _ke3 = new V3();
const _kq = new THREE.Quaternion(), _kq2 = new THREE.Quaternion(), _kq3 = new THREE.Quaternion(), _kD = new THREE.Quaternion(), _kH = new THREE.Quaternion(), _kN = new THREE.Quaternion();
const _kR = new THREE.Quaternion(), _kRi = new THREE.Quaternion(), _kI = new THREE.Quaternion(), _kSq = new THREE.Quaternion(), _kHg = new THREE.Quaternion();
function setDelta(bone, restW, D) {
  _kq.copy(_kR).multiply(D).multiply(_kRi).multiply(restW);
  bone.parent.getWorldQuaternion(_kq2); _kq2.invert().multiply(_kq);
  bone.quaternion.copy(_kq2); bone.updateMatrixWorld(true);
}
function aimBone(bone, child, target) {
  const bp = bone.getWorldPosition(_ka);
  const cd = child.getWorldPosition(_kb).sub(bp);
  if (cd.lengthSq() < 1e-10) return;
  cd.normalize();
  _kc.subVectors(target, bp); if (_kc.lengthSq() < 1e-10) return; _kc.normalize();
  _kq.setFromUnitVectors(cd, _kc);
  bone.getWorldQuaternion(_kq2); _kq.multiply(_kq2);
  bone.parent.getWorldQuaternion(_kq3); _kq3.invert().multiply(_kq);
  bone.quaternion.copy(_kq3); bone.updateMatrixWorld(true);
}
function jointPos(S, T, pole, L1, L2, out) {
  _ke1.subVectors(T, S); const dist = clamp(_ke1.length(), .05, L1 + L2 - .002); _ke1.normalize();
  const a1 = Math.acos(clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1));
  _ke2.crossVectors(_ke1, pole); if (_ke2.lengthSq() < 1e-8) _ke2.set(1, 0, 0); _ke2.normalize();
  _ke3.crossVectors(_ke2, _ke1).normalize();
  return out.copy(S).addScaledVector(_ke1, Math.cos(a1) * L1).addScaledVector(_ke3, Math.sin(a1) * L1);
}
const _kR2 = new THREE.Quaternion(), _rx = new V3(), _ry = new V3(), _rz = new V3();
const _kMa = new THREE.Matrix4(), _ku = new V3(), _kl = new V3(), _kh = new V3(), _kx = new V3();
// orienta o osso (no mundo) para que a direção do filho seja u e o eixo da dobra seja h
function orientBone(bone, L, u, h) {
  _kx.crossVectors(u, h); _kMa.makeBasis(u, h, _kx).multiply(L.mi); _kq.setFromRotationMatrix(_kMa);
  bone.parent.getWorldQuaternion(_kq3); _kq3.invert().multiply(_kq); bone.quaternion.copy(_kq3); bone.updateMatrixWorld(true);
}
function limbIK(upper, lower, end, rS, rM, rE, L1, L2, rigLen, scaleTarget, yOff, Lu, Ll) {
  rS.getWorldPosition(_kS); rM.getWorldPosition(_kM); rE.getWorldPosition(_kE);
  upper.getWorldPosition(_kU);
  if (scaleTarget) _kT.subVectors(_kE, _kS).multiplyScalar((L1 + L2) / rigLen).add(_kU); else _kT.copy(_kE);
  _kT.y += yOff || 0;
  _kP.addVectors(_kS, _kE).multiplyScalar(.5); _kP.subVectors(_kM, _kP);
  jointPos(_kU, _kT, _kP, L1, L2, _kJ);
  if (!Lu || !Ll) { aimBone(upper, lower, _kJ); aimBone(lower, end, _kT); return; }
  // eixo da dobra: do próprio cotovelo/joelho (u × l); quase esticado, vem do lado para onde o rig aponta a junta
  _ku.subVectors(_kJ, _kU).normalize(); _kl.subVectors(_kT, _kJ).normalize();
  _kh.crossVectors(_ku, _kl); _kP.normalize(); _kx.crossVectors(_kP, _ku); _kh.addScaledVector(_kx, .12);
  _kh.addScaledVector(_ku, -_kh.dot(_ku));
  if (_kh.lengthSq() < 1e-6) { if (Lu.h) _kh.copy(Lu.h); else return; }
  _kh.normalize();
  if (Lu.h) { if (Lu.h.dot(_kh) < .2) _kh.lerp(Lu.h, .5).normalize(); Lu.h.copy(_kh); } else Lu.h = _kh.clone(); // sem virar de um quadro para o outro
  orientBone(upper, Lu, _ku, _kh);
  orientBone(lower, Ll, _kl, _kh);
}
function driveSkin(p) {
  const k = p.skin, m = p.model, B = k.B;
  const vis = m.group.visible; k.holder.visible = vis; k.racket.visible = vis;
  if (!vis) return;
  k.holder.position.copy(m.group.position); k.holder.rotation.y = m.group.rotation.y + k.faceFix;
  for (const b of k.all) b.quaternion.copy(b.userData.rq);
  B.Hips.position.copy(B.Hips.userData.rp);
  k.holder.updateMatrixWorld(true);
  for (const n of ROT_BONES) if (B[n]) B[n].getWorldQuaternion(k.restW[n]);
  _kR.copy(m.group.quaternion); _kRi.copy(_kR).invert();
  // canhoto: o rig desenhado está espelhado (escala x negativa); no modelo 3D trocamos os lados dos membros e
  // espelhamos as rotações do tronco e da cabeça (reflexão em x: q → (x, −y, −z, w))
  const L = !!p.lefty, mir = q => L ? q.set(q.x, -q.y, -q.z, q.w) : q;
  // quadril desce e desloca como no rig
  _k1.set(m.hips.position.x * (L ? -1 : 1), m.hips.position.y - .92, m.hips.position.z).applyQuaternion(_kR);
  B.Hips.getWorldPosition(_k2).add(_k1); B.Hips.parent.worldToLocal(_k2); B.Hips.position.copy(_k2); B.Hips.updateMatrixWorld(true);
  const sq = mir(_kSq.copy(m.spine.quaternion));
  const D = t => _kD.copy(_kI).slerp(sq, t);
  setDelta(B.Hips, k.restW.Hips, D(.25));
  setDelta(B.Spine, k.restW.Spine, D(.5));
  setDelta(B.Spine1, k.restW.Spine1, D(.78));
  setDelta(B.Spine2, k.restW.Spine2, D(1));
  setDelta(B.LeftShoulder, k.restW.LeftShoulder, D(1));
  setDelta(B.RightShoulder, k.restW.RightShoulder, D(1));
  _kH.copy(sq).multiply(mir(_kHg.copy(m.headG.quaternion))); _kN.copy(sq).slerp(_kH, .5);
  setDelta(B.Neck, k.restW.Neck, _kN); setDelta(B.Head, k.restW.Head, _kH);
  // braço da raquete do rig → braço direito do modelo (esquerdo no canhoto); pernas também trocam de lado
  const R = L ? 'Left' : 'Right', O = L ? 'Right' : 'Left', aR = L ? k.armL : k.arm, aO = L ? k.arm : k.armL;
  limbIK(B[R + 'Arm'], B[R + 'ForeArm'], B[R + 'Hand'], m.armR.sh, m.armR.el, m.armR.wrist, aR[0], aR[1], .555, true, 0, k.lim[R + 'Arm'], k.lim[R + 'ForeArm']);
  limbIK(B[O + 'Arm'], B[O + 'ForeArm'], B[O + 'Hand'], m.armL.sh, m.armL.el, m.armL.wrist, aO[0], aO[1], .555, true, 0, k.lim[O + 'Arm'], k.lim[O + 'ForeArm']);
  // mão livre apontando a bola no smash: gira o punho (palma meio para cima / para o corpo)
  if ((p.prep || 0) > .02 && B[O + 'Hand']) {
    const h = B[O + 'Hand']; B[O + 'ForeArm'].getWorldPosition(_ka); h.getWorldPosition(_kb); _kc.subVectors(_kb, _ka).normalize();
    _kq.setFromAxisAngle(_kc, p.prep * PALM.angle * (L ? -1 : 1)); h.getWorldQuaternion(_kq2); _kq.multiply(_kq2);
    h.parent.getWorldQuaternion(_kq3); _kq3.invert().multiply(_kq); h.quaternion.copy(_kq3); h.updateMatrixWorld(true);
  }
  const l0 = m.legs[L ? 1 : 0], l1 = m.legs[L ? 0 : 1];
  limbIK(B.LeftUpLeg, B.LeftLeg, B.LeftFoot, l0.thigh, l0.knee, l0.ankle, k.leg[0], k.leg[1], .85, false, k.footH - .07, k.lim.LeftUpLeg, k.lim.LeftLeg);
  limbIK(B.RightUpLeg, B.RightLeg, B.RightFoot, l1.thigh, l1.knee, l1.ankle, k.leg[0], k.leg[1], .85, false, k.footH - .07, k.lim.RightUpLeg, k.lim.RightLeg);
  // pés planos na areia
  [['LeftFoot', 'LeftToeBase', k.toe.L], ['RightFoot', 'RightToeBase', k.toe.R]].forEach(([f, t, v]) => {
    if (!B[f] || !B[t]) return;
    B[f].getWorldPosition(_k3); _k1.copy(v).applyQuaternion(k.holder.quaternion).add(_k3); aimBone(B[f], B[t], _k1);
  });
  // mão da raquete: orientada pelo cabo da raquete do rig; dedos fecham em volta; raquete encaixada no punho
  const H = B[R + 'Hand'], Hd = k.hand[R], Ho = k.hand[O];
  m.racket.getWorldQuaternion(_kR2); _rx.set(1, 0, 0).applyQuaternion(_kR2); _ry.set(0, 1, 0).applyQuaternion(_kR2); _rz.set(0, 0, 1).applyQuaternion(_kR2);
  if (Hd) {
    const sx = CURL.sx * (L ? -1 : 1);
    _kc.copy(_ry).multiplyScalar(-Math.cos(CURL.ga)).addScaledVector(_rx, Math.sin(CURL.ga) * sx).normalize();   // punho → dedos
    _kb.copy(_rz).multiplyScalar(CURL.ps * (L ? -1 : 1)); _kb.addScaledVector(_kc, -_kb.dot(_kc)).normalize();    // palma
    orientBone(H, Hd, _kc, _kb);
    for (const F of Hd.fingers) { CURL.q.setFromAxisAngle(F.ax, (F.thumb ? CURL.thumb[F.j - 1] : CURL.grip[F.j - 1]) * CURL.sign); F.b.quaternion.multiply(CURL.q); F.b.updateMatrixWorld(true); }
    // centro do punho fechado: um pouco à frente do punho, do lado da palma; o cabo passa por ali
    H.getWorldPosition(_kU).addScaledVector(_kc, Hd.len * CURL.fist).addScaledVector(_kb, CURL.pd);
    k.racket.position.copy(_kU).addScaledVector(_ry, .075);
  } else { H.getWorldPosition(_kU); m.racket.getWorldPosition(_k3); m.armR.wrist.getWorldPosition(_k2); k.racket.position.copy(_k3).add(_kU).sub(_k2); }
  k.racket.quaternion.copy(_kR2);
  // mão livre: dedos meio fechados (relaxada)
  if (Ho) for (const F of Ho.fingers) { CURL.q.setFromAxisAngle(F.ax, CURL.relax * (F.thumb ? .5 : 1) * CURL.sign); F.b.quaternion.multiply(CURL.q); F.b.updateMatrixWorld(true); }
}
// canhoto = modelo desenhado espelhado (o modelo 3D troca os lados em driveSkin)
function applyLefty(p) {
  p.lefty = !!(p.char && p.char.canhoto);
  p.model.group.scale.set(hScale(p) * (p.lefty ? -1 : 1), hScale(p), hScale(p));
}
function applyPlayerStyle() {
  const on = S.settings.players === '3d';
  for (const p of ALL) {
    if (!p.skin) continue;
    p.skinOn = on;
    p.model.group.traverse(o => { if (o.isMesh && o !== p.model.blob) o.visible = !on && !o.userData.off; });
    p.skin.holder.traverse(o => { if (o.isMesh) o.visible = on && !o.userData.off; });
    if (!on) { p.skin.holder.visible = false; p.skin.racket.visible = false; }
  }
  for (const p of ALL) if (p.char) applyLefty(p);
}
function rebuildModel(p, look) {
  const vis = p.model.group.visible;
  scene.remove(p.model.group);
  p.look = look; p.model = makeAthlete(look); p.model.group.visible = vis;
  if (p.skin) { scene.remove(p.skin.holder); scene.remove(p.skin.racket); p.skin = null; }
  if (GLB.male && GLB.female) { try { attachSkin(p, look.fem ? GLB.female : GLB.male); } catch (e) { p.skin = null; } }
}
function assignCharacters() {
  const pk = S.settings.pick;
  // partida mista (homens e mulheres em quadra): a mulher joga com ~88% dos atributos (95 → 84), pela diferença física
  const ids = S.settings.mode === 'dupla' ? [pk.me, pk.mate, pk.o1, pk.o2] : [pk.me, pk.o1], fems = ids.map(id => !!charById(id).fem);
  const mixed = fems.includes(true) && fems.includes(false) && !S.careerActive; // a carreira nunca é mista
  const rkp = S.rkPick || {}; // online: raquete escolhida por quem joga com cada boneco
  [[human, pk.me, 0, 0, 'me'], [partner, pk.mate, 0, 1, 'mate'], [cpuA, pk.o1, 1, 0, 'o1'], [cpuB, pk.o2, 1, 1, 'o2']].forEach(([p, id, team, idx, slot]) => {
    const c = charById(id);
    // atributos em jogo: base + raquete (a sua vem do menu/carreira; a dos outros, do equipamento de cada um)
    p.rkKey = rkp[slot] || (p === human ? S.settings.racket : c.look && c.look.racket) || 'proteo';
    let a = c.rkIn ? Object.assign({}, c.a) : effA(c.a, racketBonus(p.rkKey)); // carreira: você já vem com a raquete (e o equipamento) somados
    if (mixed && c.fem) { const m = {}; for (const k in a) m[k] = Math.max(30, Math.round(a[k] * .885)); a = m; }
    p.char = Object.assign({}, c, { a });
    const look = Object.assign({}, lookExtras(c), c.look, KITS[team][idx], { fem: !!c.fem, build: c.build });
    // uniforme próprio (carreira): blusa, estampa, cores, parte de baixo e logo do patrocinador no lugar do uniforme da equipe
    const OF = c.look && c.look.outfit;
    if (OF) Object.assign(look, { shirt: OF.c1, shirt2: OF.c2, pattern: OF.pat, top: OF.top, bottom: OF.bot, shorts: OF.bc, logo: OF.logo || '' });
    const lk = c.id + c.build + (S.settings.uniforms || '') + (S.settings.players === 'carol' ? 'C' : '') + (look.shirt || '') + (OF ? JSON.stringify(OF) : '') + (look.skin || '') + [look.hair, look.hairStyle, look.beard, look.headband, look.glasses, look.glassStyle, look.lens, look.cap, look.visor].join('|');
    if (p.lookKey !== lk || (GLB.male && GLB.female && !p.skin)) { rebuildModel(p, look); p.lookKey = lk; } // (os modelos 3D podem ter terminado de carregar depois)
    p.playStyle = playStyleOf(c);
    p.skill = p.isHuman ? null : charSkill(p);
    p.name = nameOf(c);
    p.height = heightOf(c); applyLefty(p); scaleSkin(p);
  });
  if (fpSkin) fpSkin.color.copy(col(human.look.skin));
}
function applyRackets() {
  const mine = RACKETS[S.settings.racket] ? S.settings.racket : 'proteo';
  [[human, human.rkKey || mine], [partner, partner.rkKey || (partner.char ? partner.char.look.racket : 'medusa')], [cpuA, cpuA.rkKey || (cpuA.char ? cpuA.char.look.racket : 'kronos')], [cpuB, cpuB.rkKey || (cpuB.char ? cpuB.char.look.racket : 'supercarbon')]].forEach(([p, key]) => {
    p.look.racket = key; p.model.racket.userData.setStyle(key); if (p.skin) p.skin.racket.userData.setStyle(key);
  });
  if (fpRacket) fpRacket.userData.setStyle(human.rkKey || mine); // a mesma raquete do seu jogador
}
// braço em primeira pessoa (preso à câmera)
let fpRacket = null;
let fpWrist = null, fpSkin = null;
// o braço fica dentro de um grupo espelhável (canhoto em primeira pessoa)
const fpMirror = new THREE.Group(); camera.add(fpMirror);
const fpArm = new THREE.Group(); fpArm.position.set(.24, -.34, -.34); fpArm.rotation.order = 'YXZ'; fpMirror.add(fpArm);
{
  const skin = mat('#c68a5e', { roughness: .55 }); fpSkin = skin;
  fpArm.add(new THREE.Mesh(capsuleGeo(.04, .03, .4), skin));
  const hand = new THREE.Mesh(new THREE.SphereGeometry(.038, 10, 8), skin); hand.scale.set(.8, 1.2, .65); hand.position.y = -.44; fpArm.add(hand);
  const wband = new THREE.Mesh(new THREE.CylinderGeometry(.036, .036, .04, 12), mat('#ff5a1f')); wband.position.y = -.36; fpArm.add(wband);
  fpWrist = new THREE.Group(); fpWrist.position.y = -.44; fpArm.add(fpWrist);
  fpRacket = makeRacket('proteo'); fpRacket.position.y = .03; fpWrist.add(fpRacket);
}
fpArm.visible = false;
// Bola
// modelos de bolinha (escolhidos nas configurações): cores do fundo, dos pontinhos, da costura e do brilho
const BALL_STYLES = {
  laranja: { nome: 'Laranja (padrão)', c: ['#ff7a12', '#ff5a00'], sp: [255, 110, 170, 20, 70], seam: 'rgba(255,236,170,.98)', em: '#ff4d00' },
  amarela: { nome: 'Amarela', c: ['#eef25a', '#d4e02c'], sp: [240, 230, 255, 40, 90], seam: 'rgba(255,255,255,.95)', em: '#a8b400' },
  limao: { nome: 'Verde-limão', c: ['#b8f04c', '#8ed82c'], sp: [150, 220, 255, 40, 90], seam: 'rgba(255,255,255,.95)', em: '#5aa800' },
  rosa: { nome: 'Rosa', c: ['#ff86c0', '#ff4f9a'], sp: [255, 120, 190, 150, 210], seam: 'rgba(255,255,255,.95)', em: '#ff2d7a' },
  azul: { nome: 'Azul', c: ['#46a8ff', '#1f6fe0'], sp: [60, 140, 220, 200, 255], seam: 'rgba(255,214,70,.98)', em: '#1f6fe0' },
  branca: { nome: 'Branca', c: ['#f6f4ee', '#dedad0'], sp: [200, 190, 220, 170, 200], seam: 'rgba(255,90,31,.95)', em: '#9a958a' },
  itf: { nome: 'Laranja ITF (costura azul)', c: ['#ff7a12', '#ff5200'], sp: [255, 110, 160, 20, 60], seam: 'rgba(31,79,184,.98)', em: '#ff4d00' },
};
function drawBall(x, w, h, st) {
  const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, st.c[0]); gr.addColorStop(1, st.c[1]);
  x.fillStyle = gr; x.fillRect(0, 0, w, h);
  const [r, g0, g1, b0, b1] = st.sp;
  for (let i = 0; i < 1800; i++) { x.fillStyle = `rgba(${r},${rand(g0, g1) | 0},${rand(b0, b1) | 0},${rand(.1, .3)})`; x.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
  x.strokeStyle = st.seam; x.lineWidth = 6; x.beginPath();
  for (let i = 0; i <= w; i++) { const y = h / 2 + Math.sin(i / w * Math.PI * 4) * h * .28; i ? x.lineTo(i, y) : x.moveTo(i, y); }
  x.stroke();
}
const ballTex = canvasTex(256, 128, (x, w, h) => drawBall(x, w, h, BALL_STYLES.laranja));
const ball = { pos: new V3(0, 1, 0), vel: new V3(), state: 'held' };
const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(.055, 24, 16), mat('#ffffff', { map: ballTex, roughness: .8, emissive: col('#ff4d00'), emissiveIntensity: .32 }));
let ballStyleKey = 'laranja';
function setBallStyle(k) {
  const st = BALL_STYLES[k] || BALL_STYLES.laranja; if (ballStyleKey === k && k) return; ballStyleKey = k;
  const cv = ballTex.image; drawBall(cv.getContext('2d'), cv.width, cv.height, st); ballTex.needsUpdate = true;
  ballMesh.material.emissive.copy(col(st.em));
}
scene.add(ballMesh);
const ballShadow = new THREE.Mesh(new THREE.PlaneGeometry(.3, .3), new THREE.MeshBasicMaterial({ map: SHADOW_TEX, transparent: true, depthWrite: false }));
ballShadow.rotation.x = -Math.PI / 2; scene.add(ballShadow);
const TRAIL_N = 14;
const trailPos = new Float32Array(TRAIL_N * 3);
const trailGeo = new THREE.BufferGeometry(); trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: col('#ffb070'), transparent: true, opacity: .4 }));
trail.frustumCulled = false; scene.add(trail);
function resetTrail() { for (let i = 0; i < TRAIL_N; i++) { trailPos[i * 3] = ball.pos.x; trailPos[i * 3 + 1] = ball.pos.y; trailPos[i * 3 + 2] = ball.pos.z; } trailGeo.attributes.position.needsUpdate = true; }
const RING_MINE = col('#ff5a1f'), RING_MATE = col('#00b84a'); // verde mais forte (aparece melhor na areia)
const landRing = new THREE.Mesh(new THREE.RingGeometry(.16, .22, 40), new THREE.MeshBasicMaterial({ color: RING_MINE.clone(), transparent: true, opacity: .8, depthWrite: false }));
landRing.rotation.x = -Math.PI / 2; landRing.visible = false; scene.add(landRing);
const reachRing = new THREE.Mesh(new THREE.RingGeometry(1.32, 1.35, 72), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .18, depthWrite: false }));
reachRing.rotation.x = -Math.PI / 2; scene.add(reachRing);
// Pegadas na areia
const FP_N = 260;
const footTex = canvasTex(32, 64, (x) => { const gr = x.createRadialGradient(16, 16, 2, 16, 16, 15); gr.addColorStop(0, 'rgba(0,0,0,.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.save(); x.scale(1, 2); x.fillStyle = gr; x.beginPath(); x.arc(16, 16, 15, 0, Math.PI * 2); x.fill(); x.restore(); }, false);
const prints = new THREE.InstancedMesh(new THREE.PlaneGeometry(.1, .24), new THREE.MeshBasicMaterial({ map: footTex, transparent: true, depthWrite: false, color: col('#6b5233'), opacity: .3 }), FP_N);
prints.frustumCulled = false; scene.add(prints);
let fpIdx = 0;
const dummyObj = new THREE.Object3D();
function clearPrints() { for (let i = 0; i < FP_N; i++) { dummyObj.position.set(0, -10, 0); dummyObj.rotation.set(0, 0, 0); dummyObj.updateMatrix(); prints.setMatrixAt(i, dummyObj.matrix); } prints.instanceMatrix.needsUpdate = true; }
clearPrints();
function stamp(x, z, ang) {
  dummyObj.position.set(x, .011, z); dummyObj.rotation.set(-Math.PI / 2, 0, ang); dummyObj.updateMatrix();
  prints.setMatrixAt(fpIdx, dummyObj.matrix); prints.instanceMatrix.needsUpdate = true; fpIdx = (fpIdx + 1) % FP_N;
}
// Grãos de areia levantados
const PN = 120;
const pPos = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN);
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: col('#d9bf8c'), size: .045, transparent: true, opacity: .9, depthWrite: false }));
particles.frustumCulled = false; scene.add(particles);
for (let i = 0; i < PN; i++) pPos[i * 3 + 1] = -10;
let pIdx = 0;
function puff(x, z, n, power) {
  for (let k = 0; k < n; k++) {
    const i = pIdx; pIdx = (pIdx + 1) % PN;
    pPos[i * 3] = x + rand(-.05, .05); pPos[i * 3 + 1] = .03; pPos[i * 3 + 2] = z + rand(-.05, .05);
    const a = Math.random() * Math.PI * 2, s = rand(.3, 1.4) * power;
    pVel[i * 3] = Math.cos(a) * s; pVel[i * 3 + 1] = rand(1, 2.6) * power; pVel[i * 3 + 2] = Math.sin(a) * s; pLife[i] = rand(.5, .9);
  }
}
// estrelinhas do saque perfeito: pequenas e rápidas (somem em ~0,85 s)
const SN = 22, sGeo = new THREE.BufferGeometry(), sPos = new Float32Array(SN * 3), sVel = new Float32Array(SN * 3), sCol = new Float32Array(SN * 3);
sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3)); sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
const starTex = canvasTex(32, 32, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? w * .12 : w / 2; x.lineTo(w / 2 + Math.cos(a) * r, w / 2 + Math.sin(a) * r); } x.fill(); });
const sparks = new THREE.Points(sGeo, new THREE.PointsMaterial({ size: .12, map: starTex, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
sparks.frustumCulled = false; sparks.visible = false; scene.add(sparks);
let sLife = 0;
function sparkle(p) {
  const c = new THREE.Color();
  for (let i = 0; i < SN; i++) {
    sPos[i * 3] = p.x; sPos[i * 3 + 1] = p.y; sPos[i * 3 + 2] = p.z;
    const a = Math.random() * Math.PI * 2, b = rand(-.6, 1), sp = rand(.7, 1.8);
    sVel[i * 3] = Math.cos(a) * Math.cos(b) * sp; sVel[i * 3 + 1] = Math.sin(b) * sp + .3; sVel[i * 3 + 2] = Math.sin(a) * Math.cos(b) * sp;
    c.set(Math.random() < .7 ? '#ffd23f' : '#ffffff'); sCol[i * 3] = c.r; sCol[i * 3 + 1] = c.g; sCol[i * 3 + 2] = c.b;
  }
  sGeo.attributes.color.needsUpdate = true; sLife = .85; sparks.visible = true;
}
// golpe perfeito (smash ou lob chutado): ondinha verde que se abre no chão em volta de quem bateu
const WAVES = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(.42, .5, 48), new THREE.MeshBasicMaterial({ color: col('#39ff7a'), transparent: true, opacity: 0, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.visible = false; m.userData.t = 0; scene.add(m); return m; });
let waveI = 0;
function greenWave(p) { const m = WAVES[waveI++ % WAVES.length]; m.position.set(p.x, .03, p.z); m.userData.t = .6; m.visible = true; }
function updateParticles(dt) {
  for (const m of WAVES) if (m.visible) { m.userData.t -= dt; const u = 1 - Math.max(0, m.userData.t) / .6; const sc = .4 + u * 2.4; m.scale.set(sc, sc, 1); m.material.opacity = (1 - u) * .95; if (m.userData.t <= 0) m.visible = false; }
  if (sLife > 0) {
    sLife -= dt; sparks.material.opacity = Math.min(1, Math.max(0, sLife / .85) * 1.4);
    for (let i = 0; i < SN; i++) { sVel[i * 3 + 1] -= 1.2 * dt; sPos[i * 3] += sVel[i * 3] * dt; sPos[i * 3 + 1] += sVel[i * 3 + 1] * dt; sPos[i * 3 + 2] += sVel[i * 3 + 2] * dt; }
    sGeo.attributes.position.needsUpdate = true; if (sLife <= 0) sparks.visible = false;
  }
  for (let i = 0; i < PN; i++) {
    if (pLife[i] <= 0) continue;
    pLife[i] -= dt; pVel[i * 3 + 1] -= G * dt;
    pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
    if (pPos[i * 3 + 1] < .01 || pLife[i] <= 0) { pPos[i * 3 + 1] = -10; pLife[i] = 0; }
  }
  pGeo.attributes.position.needsUpdate = true;
}

export { PALM, greenWave, drawBall, BALL_STYLES, setBallStyle, CURL, GLB, RING_MATE, RING_MINE, TRAIL_N, applyPlayerStyle, applyRackets, assignCharacters, b64Buf, ball, ballMesh, ballShadow, clearPrints, driveSkin, fpArm, fpWrist, landRing, loadModels, particles, puff, sparkle, reachRing, resetTrail, stamp, trail, trailGeo, trailPos, updateParticles };
