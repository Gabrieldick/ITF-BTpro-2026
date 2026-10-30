// @ts-nocheck
// modelos GLB (jogadores realistas do MakeHuman) e escalação dos personagens
import './06-modelos';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { assetBuf } from '../assets';
import { ACCESS, TOP_KINDS, BOT_KINDS, PATTERNS, G, KITS, V3, charById, clamp, effA, hScale, heightOf, nameOf, racketBonus, rand , lookExtras } from './00-base';
import { S } from './01-estado';
import { camera, canvasTex, col, mat, scene } from './02-render';
import { ENV, sandH } from './03-cenario';
import { RACKETS, SHADOW_TEX, capsuleGeo, makeRacket, setRacketModels } from './05-atletas';
import { brandMark } from './marcas';
import { ALL, cpuA, cpuB, human, makeAthlete, makePlayer, partner } from './06-modelos';
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
      // sombra: detalhes pequenos e as mechas recortadas (olhos, cílios, óculos, barba, cards de cabelo) não aparecem no mapa
      // de sombra (~1,4 cm por pixel) e custavam metade da passada de sombra; a casca do cabelo já faz a silhueta da cabeça
      o.castShadow = !/^(Eyes|Lashes|Brow|Glasses|Beard|Goatee|Mustache|HairFringe|HairCards|HairCurlyCards|HairTiedCards|HairLong|HairBob|PonyCards|Teeth|Tongue)/.test(o.name); o.receiveShadow = true; o.frustumCulled = false;
      if (o.material) {
        o.material = o.material.clone(); o.material.envMapIntensity = .6;
        // barba e raspado ficam a 1–2 mm da pele: puxados para a frente na profundidade (não piscam com a pele de longe)
        if (/^(Beard|Goatee|Mustache|HairBuzz)/.test(o.name)) { o.material.polygonOffset = true; o.material.polygonOffsetFactor = -2; o.material.polygonOffsetUnits = -6; }
        // casca do cabelo e sobrancelha também ficam colados na cabeça: de longe a pele "furava" a casca perto da orelha (piscava)
        else if (/^(Hair|Brow)$/.test(o.name)) { o.material.polygonOffset = true; o.material.polygonOffsetFactor = -1; o.material.polygonOffsetUnits = -4; }
      }
    }
    if (o.isBone) { const k = o.name.replace(/^mixamorig[:_]?/, ''); B[k] = o; o.userData.rq = o.quaternion.clone(); o.userData.rp = o.position.clone(); all.push(o); }
  });
  if (!B.Hips || !B.RightHand || !B.LeftFoot) { scene.remove(holder); return; }
  // um esqueleto só por jogador: o clone dava um para cada peça (corpo, blusa, short, cabelo…), e cada um recalculava os 52
  // ossos e mandava a textura deles para a placa de vídeo todo quadro (~60 por quadro com 4 jogadores)
  { let sh = null; root.traverse(o => { if (!o.isSkinnedMesh) return; if (!sh) { sh = o.skeleton; return; }
    const sk = o.skeleton; if (sk === sh || sk.bones.length !== sh.bones.length) return;
    for (let i = 0; i < sk.bones.length; i++) if (sk.bones[i] !== sh.bones[i] || !sk.boneInverses[i].equals(sh.boneInverses[i])) return;
    o.skeleton = sh; }); }
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
// Pele: (1) poros — mapa de normais fino e repetido (células de Worley + rugas), gerado aqui (não pesa no download), que
// some de longe para não cintilar; (2) a luz "atravessa" a pele: o difuso se estende um pouco além da linha de sombra e
// essa faixa puxa para o vermelho (sangue sob a pele), em vez do corte cinza de plástico; (3) brilho irregular (rugosidade
// varia com manchas finas) e suor: ao longo da partida a pele fica mais brilhante (molhada)
const PORE = (() => {
  const N = 256, H = new Float32Array(N * N), G = 32, pts = [];
  let sd = 12345; const rnd = () => { sd = (sd * 1103515245 + 12345) >>> 0; return (sd >>> 8) / 16777216; };
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) pts.push([(i + rnd()) / G, (j + rnd()) / G, .5 + rnd() * .7]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, ci = Math.floor(u * G), cj = Math.floor(v * G); let d1 = 9, w = 1;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = (ci + di + G) % G, jj = (cj + dj + G) % G, q = pts[jj * G + ii];
      let dx = q[0] - u, dy = q[1] - v; dx -= Math.round(dx); dy -= Math.round(dy);
      const d = Math.hypot(dx, dy) * G; if (d < d1) { d1 = d; w = q[2]; }
    }
    // poro = covinha no centro da célula; borda das células = sulcos finos (a "malha" da pele)
    H[y * N + x] = -Math.exp(-(d1 * d1) / (.06 * w)) * .9 + Math.min(1, d1) * .25;
  }
  // rugas finas cruzadas (repetem no ladrilho)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const u = x / N * Math.PI * 2, v = y / N * Math.PI * 2; H[y * N + x] += .08 * Math.sin(u * 11 + v * 7 + Math.sin(v * 3) * 2) + .06 * Math.sin(u * 5 - v * 13 + Math.sin(u * 2) * 3); }
  const D = new Uint8Array(N * N * 4), at = (x, y) => H[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let nx = (at(x - 1, y) - at(x + 1, y)) * 1.6, ny = (at(x, y - 1) - at(x, y + 1)) * 1.6; const L = Math.hypot(nx, ny, 1);
    const k = (y * N + x) * 4, lo = .5 + .5 * Math.sin(x / N * Math.PI * 6 + Math.sin(y / N * Math.PI * 4) * 2) * Math.sin(y / N * Math.PI * 4 + 1.3); // manchas largas (brilho/suor)
    D[k] = (nx / L * .5 + .5) * 255; D[k + 1] = (-ny / L * .5 + .5) * 255; D[k + 2] = (1 / L * .5 + .5) * 255; D[k + 3] = lo * 255;
  }
  const t = new THREE.DataTexture(D, N, N, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 4; t.needsUpdate = true;
  return t;
})();
const SKIN_LIGHT = THREE.ShaderChunk.lights_physical_pars_fragment.replace('reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
  `{ float nl = dot( geometryNormal, directLight.direction ), wr = saturate( ( nl + .4 ) / 1.4 );
    vec3 sss = mix( vec3( 1., .42, .3 ), vec3( 1. ), smoothstep( -.05, .5, nl ) );
    reflectedLight.directDiffuse += wr * sss * directLight.color * BRDF_Lambert( material.diffuseColor );
    // orelha (fina) contra o sol: a luz atravessa e ela fica avermelhada
    reflectedLight.directDiffuse += skEar * pow( saturate( dot( geometryViewDir, - directLight.direction ) ), 3. ) * vec3( 1., .32, .2 ) * directLight.color * material.diffuseColor * 1.6; }`);
function skinShader(m, U) {
  if (!m || m.userData.skinOn) return; m.userData.skinOn = true;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uPore; uniform float uPoreK, uSweat; uniform vec3 uHead; varying vec3 vRest; float skEar = 0.;')
      .replace('#include <map_fragment>', `#include <map_fragment>
      { vec3 q = vRest - uHead; float ax = abs(q.x); // (relativo ao osso da cabeça, na pose de repouso)
        float nose = (1. - smoothstep(.012, .03, ax)) * smoothstep(.1, .12, q.z) * smoothstep(-.03, -.01, q.y) * (1. - smoothstep(.035, .05, q.y));
        float cheek = smoothstep(.022, .035, ax) * (1. - smoothstep(.055, .065, ax)) * smoothstep(.07, .09, q.z) * smoothstep(-.035, -.02, q.y) * (1. - smoothstep(.02, .03, q.y));
        float shoulder = smoothstep(.08, .12, ax) * (1. - smoothstep(.2, .24, ax)) * smoothstep(-.19, -.16, q.y) * (1. - smoothstep(-.12, -.1, q.y));
        diffuseColor.rgb *= mix(vec3(1.), vec3(1.05, .84, .8), clamp(nose * .8 + cheek * .45 + shoulder * .4, 0., 1.)); // marca de sol
        skEar = smoothstep(.055, .065, ax) * (1. - smoothstep(.088, .1, ax)) * smoothstep(-.02, -.005, q.y) * (1. - smoothstep(.06, .075, q.y)) * (1. - smoothstep(.025, .05, abs(q.z))); }`)
      .replace('#include <lights_physical_pars_fragment>', SKIN_LIGHT)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      #if defined( USE_NORMALMAP_TANGENTSPACE ) && defined( USE_MAP )
      { vec2 pu = vMapUv * 46.0; vec4 pt = texture2D( uPore, pu );
        float fw = length( fwidth( pu ) ) * 256.0, pk = uPoreK * ( 1.0 - smoothstep( 1.5, 6.0, fw ) );
        vec3 dn = pt.xyz * 2.0 - 1.0; normal = normalize( normal + ( tbn[0] * dn.x + tbn[1] * dn.y ) * pk );
        float lo = texture2D( uPore, vMapUv * 3.0 ).a;
        roughnessFactor = clamp( roughnessFactor * ( .82 + .36 * lo ) * ( 1.0 - uSweat * ( .3 + .35 * lo ) ), .2, 1.0 ); }
      #endif`);
  };
  m.customProgramCacheKey = () => 'skinPore'; m.needsUpdate = true;
}
const skinUniforms = () => ({ uHead: { value: new THREE.Vector3(0, 1.6, .045) }, uPore: { value: PORE }, uPoreK: { value: S.settings.gfx === 'leve' ? 0 : .8 }, uSweat: { value: 0 }, uSway: { value: new THREE.Vector3() } });
const SKIN_BASE = new THREE.Color('#d9a982'), HAIR_BASE = new THREE.Color('#7a7a7a');
function tint(m, target, base) { if (!m) return; const t = col(target); m.color.setRGB(t.r / base.r, t.g / base.g, t.b / base.b); }
const HAIR_PARTS = ['Hair', 'HairTied', 'HairTiedCards', 'BunM', 'HairCards', 'HairFringe', 'HairBuzz', 'HairMohawk', 'HairCurly', 'HairCurlyCards', 'HairLong', 'HairBob', 'Bun', 'Pony', 'PonyCards'];
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
  float ax = abs(x), z = q.z, kx = H / 1.76; // kx: largura proporcional à altura do modelo
  // três faixas: do colarinho por cima do ombro até a manga (correm no sentido do braço)
  if (id == 12) { if (ax < 0.08 * kx || y < 0.66) return 0.0; return (1.0 - step(0.011, abs(z))) + (1.0 - step(0.011, abs(z - 0.034))) + (1.0 - step(0.011, abs(z + 0.034))); }
  // três faixas descendo pelas laterais do tronco
  if (id == 13) { if (ax < 0.12 * kx || ax > 0.2 * kx || y > 0.8) return 0.0; return (1.0 - step(0.01, abs(z))) + (1.0 - step(0.01, abs(z - 0.032))) + (1.0 - step(0.01, abs(z + 0.032))); }
  // gola (em volta do pescoço) e punhos (barra da manga)
  if (id == 14) { float neck = step(0.805, y) * step(ax, 0.11 * kx); float cuff = step(0.255 * kx, ax) * step(0.6, y); return max(neck, cuff); }
  // respingos de tinta: manchas grandes e gotinhas em volta
  if (id == 15) { vec2 g = vec2(x, yy); float n = pNoise(g * 11.0) * 0.7 + pNoise(g * 29.0) * 0.3; float d = pNoise(g * 70.0); return max(step(0.74, n), step(0.9, d) * step(0.55, n)); }
  // linhas geométricas em diagonal, fortes em cima e sumindo para baixo
  if (id == 16) { float a1 = 1.0 - step(0.12, abs(fract((x + yy) * 14.0) - 0.5) * 2.0); float a2 = 1.0 - step(0.12, abs(fract((x - yy) * 14.0) - 0.5) * 2.0); return max(a1, a2) * smoothstep(0.58, 0.82, y); }
  // faixa larga no peito com dois frisos
  if (id == 17) { float b = step(0.705, y) * (1.0 - step(0.765, y)); float f1 = (1.0 - step(0.004, abs(y - 0.695))) + (1.0 - step(0.004, abs(y - 0.775))); return max(b, f1); }
  // laterais ventiladas: furinhos em grade nas laterais
  if (id == 18) { if (ax < 0.115 * kx || y > 0.8) return 0.0; vec2 g = vec2(z, yy) * 90.0; return 1.0 - step(0.28, length(fract(g) - 0.5)); }
  // pinceladas: degradê com pinceladas horizontais irregulares
  if (id == 19) { float n = pNoise(vec2(x * 3.0, yy * 26.0)) * 0.6 + pNoise(vec2(x * 9.0, yy * 60.0)) * 0.4; return smoothstep(0.35, 0.75, (y - 0.55) * 3.2 + (n - 0.5) * 0.9); }
  // mármore: veios finos e tortos
  if (id == 20) { vec2 g = vec2(x + z * 0.6, yy); float n = pNoise(g * 5.0) * 0.7 + pNoise(g * 13.0) * 0.3; return 1.0 - smoothstep(0.02, 0.09, abs(sin(g.x * 5.0 + g.y * 8.0 + n * 6.0))); }
  // raios: listras em zigue-zague
  if (id == 21) { float zig = abs(fract(yy * 9.0) - 0.5) * 0.35; return 1.0 - step(0.06, abs(fract((x + z * 0.5) * 5.0 + zig) - 0.5)); }
  // xadrez (as faixas que se cruzam ficam mais fortes)
  if (id == 22) { float a = step(0.55, fract((x + z * 0.5) * 9.0)), b = step(0.55, fract(yy * 9.0)); return (a + b) * 0.5; }
  // onça-pintada: rosetas abertas espalhadas
  if (id == 23) { vec2 g = vec2(x + z * 0.6, yy) * 15.0, i = floor(g), f = fract(g); vec2 c = vec2(pHash(i), pHash(i + 3.1)) * 0.4 + 0.3; float d = length(f - c) * (0.85 + pHash(i + 1.7) * 0.4);
    return step(0.13, d) * (1.0 - step(0.27, d)) * step(0.25, pHash(i + 7.3)) * step(0.3, fract(atan(f.y - c.y, f.x - c.x) * 0.48 + pHash(i))); }
  // camuflada pixel: blocos quadrados
  if (id == 24) { vec2 g = floor(vec2(x + z * 0.6, yy) * 30.0); return step(0.55, pNoise(g / 4.0) * 0.7 + pHash(g) * 0.3); }
  return 0.0;
}`;
// tecidos: uFab 1 dry-fit (furinhos), 2 acetinado, 3 fio de ouro (riscas metálicas), 4 black label, 5 brilho (lantejoulas), 6 carbono
const TOPS_ALL = ['tee', 'tank', 'crop', 'long', 'sbra', 'cav'], BOTS_ALL = ['Shorts', 'Bermuda', 'Skirt', 'SkirtS', 'ShortS', 'Compress', 'Legging'];
const FAB_ID = { dry: 1, satin: 2, gold: 3, black: 4, glitter: 5, carbon: 6 };
const FAB_GLSL = `
uniform float uFab;
float fabH(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float fabMask(vec3 q) {
  if (uFab > 2.5 && uFab < 3.5) return step(0.88, fract(q.y * 55.0 + q.x * 2.0));
  if (uFab > 4.5 && uFab < 5.5) return step(0.95, fabH(floor(vec2(q.x + q.z, q.y) * 480.0)));
  return 0.0; }`;
const FAB_BASE = `
  if (uFab > 0.5 && uFab < 1.5) { vec2 fg = fract(vec2(vRest.x + vRest.z, vRest.y) * 240.0) - 0.5; diffuseColor.rgb *= 1.0 - 0.3 * (1.0 - step(0.2, length(fg))); }
  if (uFab > 3.5 && uFab < 4.5) diffuseColor.rgb = mix(vec3(0.03, 0.03, 0.04), diffuseColor.rgb, 0.1);
  if (uFab > 5.5) { vec2 fc = floor(vec2(vRest.x + vRest.z, vRest.y) * 150.0); diffuseColor.rgb = mix(vec3(0.045), diffuseColor.rgb, 0.15) * (mod(fc.x + fc.y, 4.0) < 2.0 ? 1.45 : 0.95); }`;
const FAB_TOP = `
  { float fm = fabMask(vRest); if (uFab > 2.5 && uFab < 3.5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.76, 0.3), fm); if (uFab > 4.5 && uFab < 5.5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), fm * 0.7); }`;
const FAB_RM = `
  if (uFab > 1.5 && uFab < 2.5) roughnessFactor *= 0.5; if (uFab > 3.5 && uFab < 4.5) roughnessFactor *= 0.55; if (uFab > 5.5) roughnessFactor *= 0.5;
  roughnessFactor = mix(roughnessFactor, 0.22, fabMask(vRest));`;
const FAB_MT = `
  metalnessFactor = mix(metalnessFactor, 0.95, fabMask(vRest));`;
const fabPatch = fs => fs.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>' + FAB_RM).replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>' + FAB_MT);
const LOGO_TEX = {};
function logoTex(brand, color) {
  // símbolo da marca grande (o mesmo das raquetes e placas) com o nome embaixo; textura quadrada
  const k = brand + color; if (LOGO_TEX[k]) return LOGO_TEX[k];
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const x = c.getContext('2d');
  brandMark(x, brand, 256, 200, 170, color, 'rgba(0,0,0,0)', { mono: true });
  x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle'; let fs = 84; x.font = '900 ' + fs + 'px Arial, sans-serif';
  while (x.measureText(brand.toUpperCase()).width > 490 && fs > 30) { fs -= 6; x.font = '900 ' + fs + 'px Arial, sans-serif'; }
  x.fillText(brand.toUpperCase(), 256, 445);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return (LOGO_TEX[k] = t);
}
// roupa balançando: a barra (da camisa, da saia, a boca do short) se atrasa nas arrancadas e freadas e com o vento da
// corrida; peso 0 no alto da peça e 1 na barra (pela altura na pose de repouso); só metade do deslocamento que entraria
// no corpo, para o tecido não atravessar a pele
// dobras do tecido: relevo procedural (só sombreamento) — ondas na barra, diagonais nas axilas; nos shorts, na boca da
// perna. Perturba a normal pela derivada da altura (como um bump map), sem textura
const FOLD_FRAG = h => `
  { float hf = ${h};
    vec2 dH = vec2(dFdx(hf), dFdy(hf)) * .004;
    vec3 sX = normalize(dFdx(-vViewPosition)), sY = normalize(dFdy(-vViewPosition)), R1 = cross(sY, normal), R2 = cross(normal, sX);
    float fd = dot(sX, R1) * faceDirection; normal = normalize(abs(fd) * normal - sign(fd) * (dH.x * R1 + dH.y * R2)); }`;
const SWAY_VERT = `
  { float sw_w = 1.0 - smoothstep(uSwY.x, uSwY.y, position.y); vec2 sn = normalize(objectNormal.xz + 1e-4);
    float into = dot(sn, uSway.xz) < 0.0 ? .3 : 1.0; transformed += uSway * sw_w * sw_w * into * uSwY.z; }`;
function swayRange(o, k) { const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); const b = g.boundingBox; return new THREE.Vector3(b.min.y, b.min.y + (b.max.y - b.min.y) * .65, k); }
function swayCloth(o, sway, k) {
  const m = o.material; if (!m || m.userData.swayOn) return; m.userData.swayOn = true;
  const U = m.userData.sw = { uSway: sway, uSwY: { value: swayRange(o, k) }, uFab: { value: 0 } };
  m.onBeforeCompile = sh => { Object.assign(sh.uniforms, U); sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform vec3 uSway; uniform vec3 uSwY; varying vec3 vRest;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;' + SWAY_VERT);
    sh.fragmentShader = fabPatch(sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSwY; varying vec3 vRest;' + FAB_GLSL).replace('#include <map_fragment>', '#include <map_fragment>' + FAB_BASE + FAB_TOP)).replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>' + FOLD_FRAG('sin(vRest.y * 60. + vRest.x * 28. + sin(vRest.x * 40.) * 1.2) * (1. - smoothstep(uSwY.x + .01, uSwY.x + .12, vRest.y)) * .7')); };
  m.customProgramCacheKey = () => 'swayCloth'; m.needsUpdate = true;
}
function patShirt(m, id, c2, logo, logoCol, H, sweat, sway, swY, fab, logoPos) {
  const U = m.userData.pat || (m.userData.pat = { uPat: { value: 0 }, uC2: { value: new THREE.Color() }, uH: { value: 1.76 }, uLogo: { value: null }, uLogoOn: { value: 0 }, uLogoPos: { value: 0 }, uSweat: sweat || { value: 0 }, uSway: sway || { value: new THREE.Vector3() }, uSwY: { value: swY || new THREE.Vector3(0, 0, 0) }, uFab: { value: 0 } });
  U.uPat.value = id; U.uC2.value.copy(c2); U.uH.value = H; U.uLogo.value = logo ? logoTex(logo, logoCol) : null; U.uLogoOn.value = logo ? 1 : 0; U.uLogoPos.value = logoPos === 'costas' ? 1 : logoPos === 'ambos' ? 2 : 0; U.uFab.value = fab || 0;
  if (m.userData.patOn) return; m.userData.patOn = true;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest; uniform vec3 uSway; uniform vec3 uSwY;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;' + SWAY_VERT);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;\nuniform int uPat; uniform vec3 uC2; uniform float uH; uniform sampler2D uLogo; uniform float uLogoOn; uniform float uLogoPos; uniform float uSweat; uniform vec3 uSwY;' + PAT_GLSL + FAB_GLSL)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>' + FOLD_FRAG('sin(vRest.y * 85. + sin(vRest.x * 23.) * 1.6) * (1. - smoothstep(uSwY.x + .02, uSwY.x + .16, vRest.y)) * .6 + sin((abs(vRest.x) * 1.2 + vRest.y) * 70.) * smoothstep(.12, .16, abs(vRest.x)) * (1. - smoothstep(.22, .26, abs(vRest.x))) * smoothstep(uH * .7, uH * .73, vRest.y) * (1. - smoothstep(uH * .79, uH * .81, vRest.y)) * .45'))
      .replace('#include <map_fragment>', `#include <map_fragment>` + FAB_BASE + `
      diffuseColor.rgb = mix(diffuseColor.rgb, uC2, patF(uPat, vRest, uH));` + FAB_TOP + `
      // suor: tecido molhado escurece — faixa no meio das costas, no peito e nas axilas, com borda irregular
      { float hy = vRest.y / uH, ax = abs(vRest.x), nz = sin(vRest.x * 61.0 + vRest.y * 23.0) * sin(vRest.y * 47.0 - vRest.x * 17.0) * .35;
        float back = (1.0 - smoothstep(.08, .2, ax + nz * .06)) * smoothstep(.56, .66, hy) * (1.0 - smoothstep(.78, .84, hy)) * step(vRest.z, 0.0);
        float chest = (1.0 - smoothstep(.04, .11, ax + nz * .04)) * smoothstep(.66, .71, hy) * (1.0 - smoothstep(.76, .8, hy)) * step(0.0, vRest.z);
        float pit = (1.0 - smoothstep(.03, .07, abs(ax - .17) + nz * .03)) * smoothstep(.68, .72, hy) * (1.0 - smoothstep(.76, .79, hy));
        float sw = clamp((max(back, max(chest * .8, pit)) - (1.0 - uSweat) * 1.1 + .1) * 1.6, 0.0, 1.0);
        diffuseColor.rgb *= 1.0 - .4 * sw; }
      // logo do patrocinador: no peito (17 cm) e/ou grande nas costas (25 cm, lido de trás)
      if (uLogoOn > 0.5) { vec2 lu = vec2(-1.0);
        if (vRest.z > 0.0 && uLogoPos != 1.0) lu = vec2((vRest.x + 0.085) / 0.17, (vRest.y - uH * 0.68) / 0.17);
        else if (vRest.z <= 0.0 && uLogoPos > 0.5) lu = vec2((0.125 - vRest.x) / 0.25, (vRest.y - uH * 0.645) / 0.25);
        if (lu.x > 0.0 && lu.x < 1.0 && lu.y > 0.0 && lu.y < 1.0) { vec4 lc = texture2D(uLogo, lu); diffuseColor.rgb = mix(diffuseColor.rgb, lc.rgb, lc.a); } }`);
    sh.fragmentShader = fabPatch(sh.fragmentShader);
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
  // roupa: homens de camiseta (às vezes regata ou cavada; bermuda ou compressão); mulheres de regata + short, cropped + saia,
  // camiseta + saia, macacão (regata + saia da mesma cor), top + short curto ou cavada + saia curta. O uniforme próprio
  // (carreira) já vem com a peça do modelo (look.top/look.bottom) e o tecido (look.fab/look.bfab)
  let top, bot, dress = false;
  if (look.top) { top = look.top; bot = look.bottom || 'short'; }
  else if (fem) { const o = Math.floor(r(1) * 6); top = ['tank', 'crop', 'tee', 'tank', 'sbra', 'cav'][o]; bot = ['short', 'saia', 'saia', 'saia', 'shortinho', 'saiaC'][o]; dress = o === 3; }
  else { const t = r(1); top = t < .66 ? 'tee' : t < .9 ? 'tank' : 'cav'; const b = r(6); bot = b < .22 ? 'bermuda' : b > .95 ? 'compress' : 'short'; }
  if (!fem) { if (top === 'crop' || top === 'sbra') top = 'tee'; if (bot === 'legging') bot = 'compress'; if (bot === 'saia' || bot === 'saiaC') bot = 'short'; } // peças que só existem no modelo feminino
  if (!parts['Top_' + top]) top = 'tee';
  TOPS_ALL.forEach(t => show('Top_' + t, t === top));
  // saia: com o short por baixo (a curta com o short curto)
  const BP = { short: ['Shorts'], bermuda: ['Bermuda'], shortinho: ['ShortS'], compress: ['Compress'], legging: ['Legging'], saia: ['Skirt', 'Shorts'], saiaC: ['SkirtS', 'ShortS'] }[bot] || ['Shorts'];
  if (!parts[BP[0]]) BP.splice(0, BP.length, 'Shorts');
  BOTS_ALL.forEach(n => show(n, BP.includes(n)));
  // cabelo: cada corte é um conjunto de peças do arquivo (casca, mechas, borda, rabo, coque…); barba idem
  const hs = look.hairStyle || '';
  const cut = fem ? ({ coque: ['Hair', 'HairCards', 'HairFringe', 'Bun'], longo: ['Hair', 'HairLong', 'HairFringe'], cacheado: ['Hair', 'HairLong', 'HairFringe'], curto: ['Hair', 'HairBob', 'HairFringe'] }[hs] || ['Hair', 'HairCards', 'HairFringe', 'Pony', 'PonyCards'])
    : ({ coque: ['HairTied', 'HairTiedCards', 'HairFringe', 'BunM'], careca: [], raspado: ['HairBuzz'], moicano: ['HairBuzz', 'HairMohawk'], cacheado: ['HairCurly', 'HairCurlyCards'], longo: ['Hair', 'HairLong', 'HairFringe'] }[hs] || ['Hair', 'HairCards', 'HairFringe']);
  const bd = fem ? '' : ({ barba: 'Beard', cavanhaque: 'Goatee', bigode: 'Mustache' }[look.beard] || '');
  // boné/viseira/faixa: o boné esconde o volume do cabelo (fica a base curta por baixo; o rabo sai por trás)
  const cap = !!look.cap, vis = !cap && !!look.visor, band = !cap && !vis && !!look.headband;
  const under = cap ? ['HairCards', 'HairFringe', 'HairMohawk', 'HairCurlyCards', 'Bun', 'BunM', 'HairTiedCards'] : vis || band ? ['HairFringe', 'HairMohawk'] : [];
  HAIR_PARTS.forEach(n => show(n, cut.includes(n) && !under.includes(n)));
  if (cap && hs === 'cacheado' && !fem) show('Hair', true);
  show('Cap', cap); show('CapBrim', cap); show('Visor', vis); show('VisorBrim', vis); show('Headband', band);
  [['Cap', look.cap], ['CapBrim', look.cap], ['Visor', look.visor], ['VisorBrim', look.visor], ['Headband', look.headband]].forEach(([n, c]) => { const m = matOf(n); if (m && c) m.color.copy(col(c)); });
  BEARDS.forEach(n => { show(n, n === bd); show(n + 'Edge', n === bd); });
  show('Glasses', !!look.glasses); show('GlassesFrame', !!look.glasses);
  // manguito (braço da raquete), meião e munhequeiras: os outros sorteiam; a sua jogadora/o seu jogador usa o que comprou (look.acc)
  const AC = look.acc;
  // lados (L/R/LR): a sua carreira escolhe; os outros usam o manguito no braço da raquete e meião/munhequeira nos dois
  { const racket = c.canhoto ? 'L' : 'R', side = (k, def) => AC ? (AC[k] ? AC[k + 'Side'] || def : '') : '';
    const sl = AC ? side('sleeve', racket) : r(2) < .22 ? racket : '', cf = AC ? side('calf', 'LR') : fem && r(3) < .3 ? 'LR' : '', wr = AC ? side('wrist', 'LR') : r(4) < .3 ? (r(5) < .5 ? 'LR' : racket) : '';
    show('ArmSleeve', sl.includes('R')); show('ArmSleeveL', sl.includes('L'));
    show('CalfR', cf.includes('R')); show('CalfL', cf.includes('L')); show('Calf', !!cf);
    show('WristbandR', wr.includes('R')); show('WristbandL', wr.includes('L')); show('Wristband', !!wr); }  // (o manguito do arquivo é do braço direito)
  // pele: os trechos que a blusa escolhida cobre somem (não atravessam a roupa)
  for (const n in parts) if (n.startsWith('BodySk_')) show(n, !n.slice(7).split('_').includes(top));
  // físico: formas do arquivo sobre o atlético
  // (muito magro: a forma Magro além do arquivo — corpo e roupa afinam juntos, todas as peças têm as mesmas formas)
  const shape = { fino: { Magro: look.fem ? 5 : 4 }, // (no masculino, além de ~4 o short deforma no quadril)
     esguio: { Magro: 1 }, compacto: { Gordo: .7 }, forte: { Forte: 1 } }[look.build || c.build] || {};
  root.traverse(o => { if (o.isMesh && o.morphTargetDictionary) for (const k in o.morphTargetDictionary) o.morphTargetInfluences[o.morphTargetDictionary[k]] = shape[k] || 0; });
  // cores (cada jogador tem os próprios materiais, clonados em attachSkin)
  for (const n in parts) if (n === 'Body' || n.startsWith('BodySk_')) parts[n].forEach(o => tint(o.material, look.skin || '#c68a62', SKIN_BASE));
  const SU = p.skinU || (p.skinU = skinUniforms()); SU.uPoreK.value = S.settings.gfx === 'leve' ? 0 : .8;
  { const b = (parts.Body || [])[0]; const sk = b && b.skeleton; const hi = sk ? sk.bones.findIndex(x => /Head$/.test(x.name)) : -1; if (hi >= 0) { const M = sk.boneInverses[hi].clone().invert(); SU.uHead.value.setFromMatrixPosition(M); } }
  for (const n in parts) if (n === 'Body' || n.startsWith('BodySk_')) parts[n].forEach(o => skinShader(o.material, SU));
  for (const n of HAIR_PARTS.concat(BEARDS, BEARDS.map(x => x + 'Edge'))) (parts[n] || []).forEach(o => tint(o.material, look.hair || '#2a1a0e', HAIR_BASE));
  const shirt = col(look.shirt || '#1f6fd1'), shorts = col(look.shorts || '#17324d');
  // estampa: a do uniforme próprio; os outros jogadores ganham uma (sempre a mesma para cada um) na cor do detalhe do time
  const pat = look.pattern || ['liso', 'liso', 'listras', 'lateral', 'ombros', 'degrade', 'faixas', 'chevron', 'tresfaixas', 'faixaslado', 'gola', 'peito', 'geodegrade', 'pinceladas'][Math.floor(r(7) * 14)];
  TOPS_ALL.forEach(t => { const m = matOf('Top_' + t); if (m) { m.color.copy(shirt); patShirt(m, PATTERNS[pat] ? PATTERNS[pat].id : 0, col(look.shirt2 || look.trim || '#fbf6ea'), look.logo, look.logoCol || look.shirt2 || look.trim || '#fbf6ea', p.skin ? p.skin.mh : (root.userData.mh || 1.76), (p.skinU || (p.skinU = skinUniforms())).uSweat, p.skinU.uSway, swayRange(parts['Top_' + t][0], t === 'crop' || t === 'sbra' ? .4 : 1), FAB_ID[look.fab] || 0, look.logoPos); } });
  for (const [n, k] of [['Skirt', 1.3], ['SkirtS', 1], ['Shorts', .45], ['ShortS', .35], ['Bermuda', .5], ['Compress', .3], ['Legging', .3]]) (parts[n] || []).forEach(o => { swayCloth(o, p.skinU.uSway, k); o.material.userData.sw.uFab.value = FAB_ID[look.bfab] || 0; });
  for (const n of BOTS_ALL) if (matOf(n)) matOf(n).color.copy(dress && (n === 'Shorts' || n === 'Skirt') ? shirt : shorts);
  const trim = col(look.trim || '#fbf6ea');
  for (const n of ['ArmSleeve', 'ArmSleeveL']) if (matOf(n)) matOf(n).color.copy(col(AC && AC.sleeve || look.trim || '#fbf6ea')); for (const n of ['Calf', 'CalfR', 'CalfL']) if (matOf(n)) matOf(n).color.copy(col(AC && AC.calf || look.trim || '#fbf6ea'));
  // munhequeira: cor escolhida (ou a do detalhe do time); a de fio de ouro brilha como metal
  for (const n of ['Wristband', 'WristbandR', 'WristbandL']) { const m = matOf(n); if (m) { const gold = AC && AC.wristFab === 'gold'; m.color.copy(col(gold ? '#ffc640' : AC && AC.wrist || look.trim || '#fbf6ea')); m.metalness = gold ? .9 : 0; m.roughness = gold ? .3 : .95; } }
  // boné/viseira/faixa black label (preto acetinado) ou fio de ouro (metal)
  for (const n of ['Cap', 'CapBrim', 'Visor', 'VisorBrim', 'Headband']) { const m = matOf(n); if (!m) continue; if (m.userData.r0 == null) { m.userData.r0 = m.roughness; m.userData.m0 = m.metalness; }
    const f = AC && AC.headFab; if (f === 'gold') { m.color.copy(col('#ffc640')); m.metalness = .9; m.roughness = .3; } else if (f === 'black') { m.color.copy(col('#0c0c0f')); m.metalness = .1; m.roughness = .35; } else { m.metalness = m.userData.m0; m.roughness = m.userData.r0; } }
  // óculos: lente espelhada (metal liso na cor da lente) ou escura comum
  { const m = matOf('Glasses'); if (m) { if (m.userData.r0 == null) { m.userData.r0 = m.roughness; m.userData.m0 = m.metalness; } m.color.copy(col(look.lens || '#0b0d10')); m.metalness = look.mirror ? .85 : m.userData.m0; m.roughness = look.mirror ? .12 : m.userData.r0; } }
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
  k.holder.position.copy(m.group.position); k.holder.quaternion.copy(m.group.quaternion).multiply(_kFace.setFromAxisAngle(_kY, k.faceFix)); // rotação inteira do boneco (o peixinho tomba o corpo)
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
  [['LeftFoot', 'LeftToeBase', k.toe.L, l0], ['RightFoot', 'RightToeBase', k.toe.R, l1]].forEach(([f, t, v, lg]) => {
    if (!B[f] || !B[t]) return;
    B[f].getWorldPosition(_k3); _k1.copy(v).applyQuaternion(k.holder.quaternion);
    if (lg.roll) { _k2.set(_k1.z, 0, -_k1.x).normalize(); _kq.setFromAxisAngle(_k2, lg.roll); _k1.applyQuaternion(_kq); } // ponta do pé para baixo
    _k1.add(_k3); aimBone(B[f], B[t], _k1);
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
const _kFace = new THREE.Quaternion(), _kY = new THREE.Vector3(0, 1, 0);
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
// visual do personagem em quadra: extras do id, aparência dele, uniforme do time (ou o uniforme próprio da carreira)
function charLook(c, team, idx) {
  const look = Object.assign({}, lookExtras(c), c.look, KITS[team][idx], { fem: !!c.fem, build: c.build });
  // jogadoras quase nunca usam boné: vira viseira (a maioria) ou faixa, na mesma cor (a sua jogadora da carreira escolhe)
  if (c.fem && look.cap && c.id !== 'crme') { let h = 0; for (const ch of String(c.id || c.name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; if (h % 10 < 7) look.visor = look.cap; else look.headband = look.cap; look.cap = ''; }
  const OF = c.look && c.look.outfit; // blusa, estampa, cores, parte de baixo e logo do patrocinador no lugar do uniforme da equipe
  if (OF) { const T = TOP_KINDS[OF.top] || {}, B = BOT_KINDS[OF.bot] || {};
    Object.assign(look, { shirt: OF.c1, shirt2: OF.c2, pattern: OF.pat, top: T.g || OF.top, fab: T.f || '', bottom: B.g || OF.bot, bfab: B.f || '', shorts: OF.bc, logo: OF.logo || '', logoCol: OF.logoCol || '', logoPos: OF.logoPos || '' }); }
  // acessórios comprados (só a sua carreira tem look.acc): lente espelhada troca a cor da lente
  if (look.acc && look.acc.lens && ACCESS[look.acc.lens]) { look.lens = ACCESS[look.acc.lens].lens; look.mirror = true; }
  return look;
}
// prévia do jogador (editor da carreira): o modelo realista vestido como em quadra, parado; sem os modelos, o desenhado
// boneco animado para a prévia do saque no editor da carreira: um jogador à parte (fora da quadra), com o modelo realista
// e a raquete, que a tela do editor move para a cena dela
function makeServePreview(c) {
  const look = charLook(c, 0, 0), g = c.fem ? GLB.female : GLB.male;
  if (!g) return null;
  const p = makePlayer(0, 1, look, false, 'prévia'); p.char = c; p.preview = true;
  attachSkin(p, g); scene.remove(p.skin.holder); scene.remove(p.skin.racket);
  p.skin.racket.userData.setStyle(look.racket || 'proteo');
  p.height = heightOf(c); applyLefty(p); scaleSkin(p); p.skinOn = true;
  return p;
}
function makePreview(c) {
  const look = charLook(c, 0, 0), g = c.fem ? GLB.female : GLB.male;
  if (!g) { const m = makeAthlete(look); m.group.scale.setScalar(heightOf(c) / 1.8); return m.group; }
  const root = SkeletonUtils.clone(g.scene);
  root.traverse(o => { if (o.isMesh) { o.frustumCulled = false; if (o.material) { o.material = o.material.clone(); if (/^(Beard|Goatee|Mustache|HairBuzz)/.test(o.name)) { o.material.polygonOffset = true; o.material.polygonOffsetFactor = -2; o.material.polygonOffsetUnits = -6; } else if (/^(Hair|Brow)$/.test(o.name)) { o.material.polygonOffset = true; o.material.polygonOffsetFactor = -1; o.material.polygonOffsetUnits = -4; } } } });
  const mh = new THREE.Box3().setFromObject(root).max.y || 1.8; root.userData.mh = mh;
  dressSkin({ look, char: c }, root);
  root.scale.setScalar(heightOf(c) / mh);
  return root;
}
function assignCharacters() {
  const pk = S.settings.pick;
  // partida mista (homens e mulheres em quadra): a mulher joga com ~88% dos atributos (95 → 84), pela diferença física
  const ids = S.settings.mode === 'dupla' ? [pk.me, pk.mate, pk.o1, pk.o2] : [pk.me, pk.o1], fems = ids.map(id => !!charById(id).fem);
  const mixed = fems.includes(true) && fems.includes(false) && !S.careerActive; // a carreira nunca é mista
  S.femPace = fems.every(Boolean) ? 1 : 0; // só mulheres em quadra: jogo menos explosivo, mais trocas (ver 10-fisica)
  const rkp = S.rkPick || {}; // online: raquete escolhida por quem joga com cada boneco
  [[human, pk.me, 0, 0, 'me'], [partner, pk.mate, 0, 1, 'mate'], [cpuA, pk.o1, 1, 0, 'o1'], [cpuB, pk.o2, 1, 1, 'o2']].forEach(([p, id, team, idx, slot]) => {
    const c = charById(id);
    // atributos em jogo: base + raquete (a sua vem do menu/carreira; a dos outros, do equipamento de cada um)
    p.rkKey = rkp[slot] || (p === human ? S.settings.racket : c.look && c.look.racket) || 'proteo';
    let a = c.rkIn ? Object.assign({}, c.a) : effA(c.a, racketBonus(p.rkKey)); // carreira: você já vem com a raquete (e o equipamento) somados
    if (mixed && c.fem) { const m = {}; for (const k in a) m[k] = Math.max(30, Math.round(a[k] * .885)); a = m; }
    p.char = Object.assign({}, c, { a });
    const look = charLook(c, team, idx), OF = c.look && c.look.outfit;
    const lk = c.id + c.build + (S.settings.uniforms || '') + (S.settings.players === 'carol' ? 'C' : '') + (look.shirt || '') + (OF ? JSON.stringify(OF) : '') + (look.skin || '') + [look.hair, look.hairStyle, look.beard, look.headband, look.glasses, look.glassStyle, look.lens, look.cap, look.visor, look.acc ? JSON.stringify(look.acc) : ''].join('|');
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
const latheGeoFP = (prof, zs) => { const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 22); g.scale(1, 1, zs); g.computeVertexNormals(); return g; };
let fpRacket = null;
let fpWrist = null, fpSkin = null;
// o braço fica dentro de um grupo espelhável (canhoto em primeira pessoa)
const fpMirror = new THREE.Group(); camera.add(fpMirror);
const fpArm = new THREE.Group(); fpArm.position.set(.24, -.34, -.34); fpArm.rotation.order = 'YXZ'; fpMirror.add(fpArm);
{
  // pele: textura clara (a cor do jogador entra no color) com variação de tom, poros e uns pelinhos; o relevo sai da mesma imagem
  const skTex = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#fff5ef'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { const g = x.createRadialGradient(0, 0, 0, 0, 0, 1); const r = rand(12, 40); g.addColorStop(0, `rgba(${rand(200, 235) | 0},${rand(150, 190) | 0},${rand(140, 175) | 0},${rand(.05, .14)})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.save(); x.translate(Math.random() * w, Math.random() * h); x.scale(r, r * rand(.6, 1.6)); x.fillStyle = g; x.fillRect(-1, -1, 2, 2); x.restore(); }
    for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(110,70,55,${rand(.04, .13)})`; x.fillRect(Math.random() * w, Math.random() * h, 1.2, 1.2); }
    x.strokeStyle = 'rgba(90,60,45,.12)'; x.lineWidth = .7; for (let i = 0; i < 260; i++) { const px = Math.random() * w, py = Math.random() * h; x.beginPath(); x.moveTo(px, py); x.lineTo(px + rand(-2, 2), py + rand(3, 6)); x.stroke(); }
  }, true);
  skTex.wrapS = skTex.wrapT = THREE.RepeatWrapping; skTex.repeat.set(2, 3);
  const skin = new THREE.MeshPhysicalMaterial({ color: col('#c68a5e'), map: skTex, bumpMap: skTex, bumpScale: .6, roughness: .5, sheen: .2, sheenRoughness: .6, sheenColor: col('#ffcfb0'), clearcoat: .08, clearcoatRoughness: .5 }); fpSkin = skin;
  // antebraço: perfil anatômico (mais grosso perto do cotovelo, afina no pulso) e achatado, não um tubo
  const fore = new THREE.Mesh(latheGeoFP([[0, .03], [.03, .022], [.045, -.01], [.05, -.06], [.048, -.12], [.042, -.2], [.035, -.29], [.029, -.37], [.026, -.42], [.027, -.45], [0, -.47]], .78), skin);
  fpArm.add(fore);
  // dorso da mão saindo do pulso, os dedos fechados em volta do cabo e o polegar por cima (no espaço do pulso)
  const back = new THREE.Mesh(new THREE.SphereGeometry(.03, 14, 10), skin); back.scale.set(1.05, 1.1, .62); back.position.set(0, -.47, .004); fpArm.add(back);
  fpWrist = new THREE.Group(); fpWrist.position.y = -.44; fpArm.add(fpWrist);
  fpRacket = makeRacket('proteo'); fpRacket.position.y = .03; fpWrist.add(fpRacket);
  const fist = new THREE.Group(); fist.position.y = -.035; fpWrist.add(fist);
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.TorusGeometry(.024, .0105 - i * .0007, 8, 14, Math.PI * 1.45), skin); f.rotation.set(Math.PI / 2, 0, -.6); f.position.y = .03 - i * .021; fist.add(f);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(.0105 - i * .0007, 8, 6), skin); tip.position.set(Math.cos(-.6 + Math.PI * 1.45) * .024, .03 - i * .021, -Math.sin(-.6 + Math.PI * 1.45) * .024); fist.add(tip); }
  const palm = new THREE.Mesh(new THREE.SphereGeometry(.03, 12, 8), skin); palm.scale.set(.75, 1.45, .75); palm.position.set(-.022, 0, 0); fist.add(palm);
  const thumb = new THREE.Mesh(capsuleGeo(.011, .0095, .05, 8), skin); thumb.position.set(.006, .04, .02); thumb.rotation.set(.3, 0, 2.4); fist.add(thumb);
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
// Marcas na areia (pegadas, bola quicando, peixinho): cada uma é um mapa de altura desenhado num canvas → mapa de normais
// (o sol ilumina a parede de um lado e sombreia a outra) + cor: fundo mais escuro e úmido, borda de areia empurrada um
// pouco mais clara, e transparência parcial para o grão da areia continuar aparecendo. Ficam no cenário (giram junto na
// troca de lado) e em cima do relevo da areia da quadra
function bakeDecal(W, H, draw, rimK = .45, grain = .12) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, W, H); draw(x);
  const src = x.getImageData(0, 0, W, H).data, M = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) M[i] = src[i * 4] / 255;
  const blur = (A, r) => { let B = A; for (let pass = 0; pass < 2; pass++) { const T = new Float32Array(W * H), U = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const ii = i + k; if (ii >= 0 && ii < W) { s += B[y * W + ii]; n++; } } T[y * W + i] = s / n; }
    for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < H) { s += T[yy * W + i]; n++; } } U[y * W + i] = s / n; }
    B = U; } return B; };
  const Ms = blur(M, Math.max(2, Math.round(W / 40))), Mb = blur(M, Math.round(W / 14));
  const Hh = new Float32Array(W * H), al = new Float32Array(W * H), rimA = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const rim = Math.max(0, Mb[i] - Ms[i]) * 1.6, gn = (Math.random() - .5) * grain;
    Hh[i] = -Ms[i] + rim * rimK + gn; rimA[i] = rim;
    al[i] = Math.min(1, Ms[i] * .78 + rim * .5) * (.85 + Math.random() * .3);
  }
  // borda da imagem sem nada (as instâncias encostam umas nas outras sem marcar o retângulo)
  const fade = (i, n) => Math.min(1, Math.min(i, n - 1 - i) / 4);
  const cc = document.createElement('canvas'); cc.width = W; cc.height = H; const cx = cc.getContext('2d'), ci = cx.createImageData(W, H);
  const nc = document.createElement('canvas'); nc.width = W; nc.height = H; const nx = nc.getContext('2d'), ni = nx.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) {
    const k = y * W + i, hL = Hh[y * W + Math.max(0, i - 1)], hR = Hh[y * W + Math.min(W - 1, i + 1)], hU = Hh[Math.max(0, y - 1) * W + i], hD = Hh[Math.min(H - 1, y + 1) * W + i];
    let vx = (hL - hR) * 3.6, vy = (hD - hU) * 3.6, vz = 1; const L = Math.hypot(vx, vy, vz); vx /= L; vy /= L; vz /= L;
    ni.data[k * 4] = (vx * .5 + .5) * 255; ni.data[k * 4 + 1] = (vy * .5 + .5) * 255; ni.data[k * 4 + 2] = (vz * .5 + .5) * 255; ni.data[k * 4 + 3] = 255;
    // fundo: areia úmida/compactada bem mais escura; borda: areia solta e seca, um tico mais clara
    const d = Ms[k], sh = (1 - d * .5 + rimA[k] * .14) * (.94 + Math.random() * .12);
    ci.data[k * 4] = Math.min(255, 208 * sh); ci.data[k * 4 + 1] = Math.min(255, 182 * sh); ci.data[k * 4 + 2] = Math.min(255, 140 * sh);
    ci.data[k * 4 + 3] = al[k] * fade(i, W) * fade(y, H) * 255;
  }
  cx.putImageData(ci, 0, 0); nx.putImageData(ni, 0, 0);
  const map = new THREE.CanvasTexture(cc), nrm = new THREE.CanvasTexture(nc); map.colorSpace = THREE.SRGBColorSpace;
  return { map, nrm };
}
// pé direito: calcanhar e sola afundam mais (o peso vai neles), a borda de fora do arco e os dedos menos
const FOOT = bakeDecal(128, 256, x => {
  const el = (v, cx, cy, rx, ry, a = 0) => { x.fillStyle = `rgb(${v},${v},${v})`; x.beginPath(); x.ellipse(cx, cy, rx, ry, a, 0, Math.PI * 2); x.fill(); };
  el(215, 74, 150, 22, 46, -.08); el(255, 66, 206, 25, 30); el(255, 60, 92, 33, 29, -.15);
  el(215, 40, 46, 13, 15, -.2); el(200, 61, 38, 9, 10); el(190, 77, 43, 8, 9); el(180, 91, 52, 7, 8); el(170, 103, 65, 6, 7);
});
// cratera redonda (bola quicando) e marca alongada e irregular (corpo deslizando no peixinho)
const CRATER = bakeDecal(64, 64, x => { const g = x.createRadialGradient(32, 32, 2, 32, 32, 20); g.addColorStop(0, '#fff'); g.addColorStop(.7, '#bbb'); g.addColorStop(1, '#000'); x.fillStyle = g; x.beginPath(); x.arc(32, 32, 20, 0, Math.PI * 2); x.fill(); }, .7, .1);
const SMEAR = bakeDecal(96, 256, x => {
  for (let i = 0; i < 26; i++) { const t = i / 25, v = 120 + 135 * Math.sin(Math.PI * Math.min(1, t * 1.25)); x.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
    x.beginPath(); x.ellipse(48 + (Math.random() - .5) * 10, 52 + t * 170, 26 + 8 * Math.sin(Math.PI * t) + Math.random() * 4, 18, 0, 0, Math.PI * 2); x.fill(); }
  x.strokeStyle = 'rgb(170,170,170)'; x.lineCap = 'round'; // sulcos rasos das mãos/dedos arrastando à frente do corpo
  for (let i = 0; i < 4; i++) { x.lineWidth = 2 + Math.random() * 2; x.beginPath(); let px = 30 + i * 11 + (Math.random() - .5) * 4; x.moveTo(px, 44);
    for (let y = 40; y > 6 + Math.random() * 14; y -= 6) { px += (Math.random() - .5) * 2.5; x.lineTo(px, y); } x.stroke(); }
}, .6, .14);
function decalLayer(tex, n, w, h, op = 1) {
  const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex.map, normalMap: tex.nrm, normalScale: new THREE.Vector2(1.5, 1.5), transparent: true, opacity: op, depthWrite: false, roughness: .97, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), n);
  m.frustumCulled = false; m.receiveShadow = true; ENV.add(m); return { m, n, i: 0 };
}
// quantas marcas cabem antes de a mais velha sumir (cada camada é uma fila circular): a areia vai ficando mexida ao longo da partida
const FP_N = 1400;
const prints = decalLayer(FOOT, FP_N, .14, .3), oldPrints = decalLayer(FOOT, 420, .14, .3, .55), marks = decalLayer(CRATER, 220, .16, .16), smears = decalLayer(SMEAR, 320, .7, 1.5);
const dummyObj = new THREE.Object3D();
// x, z no mundo (já com a troca de lado aplicada) → espaço do cenário
function putDecal(L, x, z, ang, sx = 1, sz = 1, lift = .004) {
  const r = ENV.rotation.y, c = Math.cos(r), sn = Math.sin(r), lx = c * x - sn * z, lz = sn * x + c * z;
  dummyObj.position.set(lx, sandH(lx, lz) + lift, lz); dummyObj.rotation.set(-Math.PI / 2, 0, ang - r);
  dummyObj.scale.set(sx, sz, 1); dummyObj.updateMatrix();
  L.m.setMatrixAt(L.i, dummyObj.matrix); L.m.instanceMatrix.needsUpdate = true; L.i = (L.i + 1) % L.n;
}
function hideLayer(L) { for (let i = 0; i < L.n; i++) { dummyObj.position.set(0, -10, 0); dummyObj.rotation.set(0, 0, 0); dummyObj.scale.set(1, 1, 1); dummyObj.updateMatrix(); L.m.setMatrixAt(i, dummyObj.matrix); } L.m.instanceMatrix.needsUpdate = true; L.i = 0; }
// Começo de partida: areia limpa, mas com pegadas velhas e apagadas de quem jogou antes (mais perto do fundo e da rede),
// como numa quadra de verdade que ninguém passou o rodo
function clearPrints() {
  [prints, marks, smears, oldPrints].forEach(hideLayer);
  const r0 = ENV.rotation.y; ENV.rotation.y = 0;
  for (let k = 0; k < oldPrints.n / 2; k++) {
    const side = Math.random() < .5 ? 1 : -1, zone = Math.random();
    let x = (Math.random() - .5) * 8.6, z = zone < .45 ? side * (6.5 + Math.random() * 3) : zone < .75 ? side * (1 + Math.random() * 2.5) : side * Math.random() * 8.5;
    let a = Math.random() * Math.PI * 2; const steps = 1 + (Math.random() * 3 | 0);
    for (let s = 0; s < steps * 2 && oldPrints.i < oldPrints.n - 1; s++) {
      const ft = s % 2 ? -1 : 1, px = x + Math.cos(a) * .09 * ft, pz = z - Math.sin(a) * .09 * ft;
      putDecal(oldPrints, px, pz, a + (Math.random() - .5) * .2, ft, 1 + Math.random() * .2, .003);
      x -= Math.sin(a) * .36; z -= Math.cos(a) * .36; a += (Math.random() - .5) * .5;
    }
  }
  ENV.rotation.y = r0;
}
clearPrints();
// side: 1 pé direito, −1 esquerdo · deep: correndo/aterrissando a pegada sai mais comprida (areia arrastada)
function stamp(x, z, ang, side = 1, deep = 0) { putDecal(prints, x, z, ang + (Math.random() - .5) * .12, side, 1 + deep * .25); }
// bola tocando a areia: pequena cratera (e um pouco alongada na direção em que vinha)
function ballMark(x, z, vx = 0, vz = 0) { const v = Math.hypot(vx, vz); putDecal(marks, x, z, v > .1 ? Math.atan2(vx, vz) : Math.random() * 6.3, 1, 1 + Math.min(.8, v * .05), .005); }
// peixinho: marca do corpo deslizando na direção do mergulho, começando um pouco antes de onde parou
// pé arrastando (arrancada, freada, pouso): a mesma marca do peixinho, bem menor, na direção do movimento; k = tamanho
function scuffMark(x, z, vx, vz, k = .35) { const v = Math.hypot(vx, vz) || 1; putDecal(smears, x - vx / v * .1 * k, z - vz / v * .1 * k, Math.atan2(vx, vz) + Math.PI, k * (.8 + Math.random() * .4), k * (.7 + Math.random() * .5), .0036); }
function diveMark(x, z, dx, dz) { const a = Math.atan2(dx, dz); putDecal(smears, x - dx * .5, z - dz * .5, a + Math.PI, 1, 1, .0035); }
// Grãos de areia levantados
const PN = 360;
const pPos = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN);
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: col('#d9bf8c'), size: .045, transparent: true, opacity: .9, depthWrite: false }));
particles.frustumCulled = false; scene.add(particles);
for (let i = 0; i < PN; i++) pPos[i * 3 + 1] = -10;
let pIdx = 0;
// dx, dz: direção do movimento (peixinho, arrancada): a areia espirra mais para lá · dust: nuvem de poeira (0 a 1)
function puff(x, z, n, power, dx = 0, dz = 0, dust = 0) {
  for (let k = 0; k < n; k++) {
    const i = pIdx; pIdx = (pIdx + 1) % PN;
    pPos[i * 3] = x + rand(-.06, .06); pPos[i * 3 + 1] = .03; pPos[i * 3 + 2] = z + rand(-.06, .06);
    const a = Math.random() * Math.PI * 2, s = rand(.3, 1.4) * power;
    pVel[i * 3] = Math.cos(a) * s + dx * rand(.5, 2.2) * power; pVel[i * 3 + 1] = rand(1, 2.6) * power; pVel[i * 3 + 2] = Math.sin(a) * s + dz * rand(.5, 2.2) * power; pLife[i] = rand(.5, 1);
  }
  if (dust > 0 && particles.visible) for (let k = 0; k < 2 + dust * 3; k++) { const d = DUST[dIdx]; dIdx = (dIdx + 1) % DUST.length; d.visible = true; d.userData.t = 0; d.userData.T = rand(.7, 1.2) * (.7 + dust * .5); d.userData.s = rand(.35, .6) * (.6 + dust); d.position.set(x + rand(-.2, .2) + dx * .2, .12, z + rand(-.2, .2) + dz * .2); d.userData.v = [dx * rand(.3, .8) + rand(-.25, .25), rand(.15, .4), dz * rand(.3, .8) + rand(-.25, .25)]; }
}
// nuvenzinhas de poeira (sprites suaves que crescem e somem)
const DUST_TEX = canvasTex(64, 64, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(226,206,168,.55)'); g.addColorStop(.6, 'rgba(226,206,168,.22)'); g.addColorStop(1, 'rgba(226,206,168,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
const DUST = Array.from({ length: 18 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: DUST_TEX, transparent: true, depthWrite: false, opacity: 0 })); s.visible = false; scene.add(s); return s; });
let dIdx = 0;
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
  for (const d of DUST) if (d.visible) { const u = (d.userData.t += dt) / d.userData.T; if (u >= 1) { d.visible = false; continue; } const sc = d.userData.s * (1 + u * 1.6); d.scale.set(sc, sc * .7, 1); d.material.opacity = Math.sin(Math.PI * Math.min(1, u * 1.4)) * .7 * (1 - u); d.position.x += d.userData.v[0] * dt; d.position.y += d.userData.v[1] * dt; d.position.z += d.userData.v[2] * dt; }
  for (let i = 0; i < PN; i++) {
    if (pLife[i] <= 0) continue;
    pLife[i] -= dt; pVel[i * 3 + 1] -= G * dt;
    pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
    if (pPos[i * 3 + 1] < .01 || pLife[i] <= 0) { pPos[i * 3 + 1] = -10; pLife[i] = 0; }
  }
  pGeo.attributes.position.needsUpdate = true;
}

export { makeServePreview, makePreview, PALM, greenWave, drawBall, BALL_STYLES, setBallStyle, CURL, GLB, RING_MATE, RING_MINE, TRAIL_N, applyPlayerStyle, applyRackets, assignCharacters, b64Buf, ball, ballMesh, ballShadow, clearPrints, driveSkin, fpArm, fpWrist, landRing, loadModels, particles, puff, sparkle, reachRing, resetTrail, stamp, ballMark, diveMark, scuffMark, trail, trailGeo, trailPos, updateParticles };
