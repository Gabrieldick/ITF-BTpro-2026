// @ts-nocheck
// ---------- Modo Ultrarrealista ----------
// Uma terceira opção de "Jogadores" (além de Desenhado e Realista) para computador com placa de vídeo:
//  · luz por imagem: um céu fotografado (HDRI do Poly Haven, CC0) ilumina jogadores e cenário; o céu e o mar que se veem
//    continuam os do jogo (mais leves); areia com relevo e detalhe fotografados (Poly Haven, CC0)
//  · pós-processamento: oclusão de luz ambiente (GTAO), brilho (bloom), foco de câmera nos replays (bokeh),
//    antisserrilhado 4×, gradação de cor, vinheta e grão de filme
//  · sombras em 4096
// Os recursos pesados (public/assets/ultra) só são baixados quando o modo é ligado. A jogabilidade não muda.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { S } from './01-estado';
import { MAX_ANISO, SUN_DIR, camera, hemi, renderer, scene, sun } from './02-render';
import { ULTRA_U, sky } from './03-cenario';
import { mocapLoad } from './25-mocap';
import { ALL } from './06-modelos';

const BASE = import.meta.env.BASE_URL + 'assets/ultra/';
const U = { want: false, on: false, loading: null, ok: false, meta: null, tex: {}, env: null, composer: null, passes: {}, saved: null, w: 0, h: 0, pr: 0, focus: 8, dof: 0 };
const ultraWanted = () => S.settings.players === 'ultra';
const ultraOn = () => U.on;
const EXPO = .8, ENVI = .7;

// ---------- recursos ----------
function loadTex(file, srgb, repeat) {
  return new Promise(res => new THREE.TextureLoader().load(BASE + file, t => {
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = MAX_ANISO; }
    res(t);
  }, undefined, () => res(null)));
}
function loadAssets() {
  if (U.loading) return U.loading;
  U.loading = (async () => {
    try {
      const meta = await fetch(BASE + 'ceu.json').then(r => (r.ok ? r.json() : null)).catch(() => null);
      if (!meta) return false;
      // (céu e mar continuam os do jogo, mais leves: o modo gasta a placa de vídeo nos jogadores, na luz e nas sombras)
      const [sandN, sandD, beachN, env] = await Promise.all([
        loadTex('areia-n.jpg', false, true), loadTex('areia-d.jpg', true, true), loadTex('praia-n.jpg', false, true),
        new Promise(res => new RGBELoader().load(BASE + 'env.hdr', t => res(t), undefined, () => res(null))),
      ]);
      if (!env) return false;
      env.mapping = THREE.EquirectangularReflectionMapping;
      const pm = new THREE.PMREMGenerator(renderer); U.env = pm.fromEquirectangular(env).texture; pm.dispose(); env.dispose();
      U.meta = meta; U.tex = { sandN, sandD, beachN };
      U.ok = true; return true;
    } catch (e) { return false; }
  })();
  return U.loading;
}

// ---------- pós-processamento ----------
const GRADE = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, uVig: { value: .22 }, uGrain: { value: .018 }, uSat: { value: 1.06 }, uCon: { value: 1.04 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time, uVig, uGrain, uSat, uCon; varying vec2 vUv;
float h(vec2 p){ p = fract(p*vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y)*p.x); }
void main(){
  vec2 q = vUv - .5; float r2 = dot(q, q);
  // aberração cromática leve nas bordas (lente)
  vec2 off = q * r2 * 0.006;
  vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
  float l = dot(c, vec3(.2126, .7152, .0722));
  c = mix(vec3(l), c, uSat);                                  // saturação
  c = (c - .5) * uCon + .5;                                   // contraste
  c *= 1. - uVig * smoothstep(.15, .75, r2 * 1.6);            // vinheta
  c += (h(vUv * 913. + fract(time) * 71.) - .5) * uGrain;     // grão de filme (também disfarça degraus no céu)
  gl_FragColor = vec4(clamp(c, 0., 1.), 1.);
}`,
};
// oclusão: fora do cálculo o que é transparente ou recortado (rastros, marcas, folhas e mechas viravam placas sólidas)
class AOPass extends GTAOPass {
  overrideVisibility() {
    const cache = this._visibilityCache;
    this.scene.traverse(o => {
      cache.set(o, o.visible);
      if (o.isPoints || o.isLine || o.isSprite) { o.visible = false; return; } // (a poeira dos passos e do quique é feita de placas: entrava na oclusão como um retângulo escuro na areia)
      const m = o.material;
      if (o.isMesh && m && !Array.isArray(m) && (m.transparent || m.alphaTest > 0 || m.depthWrite === false || o.userData.noAO)) o.visible = false;
    });
  }
}
function buildComposer() {
  const pr = renderer.getPixelRatio(), w = Math.floor(innerWidth * pr), h = Math.floor(innerHeight * pr);
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
  const comp = new EffectComposer(renderer, rt);
  comp.setPixelRatio(1); comp.setSize(w, h);
  const rp = new RenderPass(scene, camera);
  const ao = new AOPass(scene, camera, w, h, { radius: .5, distanceExponent: 1.4, thickness: 1.2, scale: 1.15, samples: 8, distanceFallOff: 1, screenSpaceRadius: false }, { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 8 });
  ao.blendIntensity = .9;
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), .32, .72, 4.2);
  const bokeh = new BokehPass(scene, camera, { focus: 8, aperture: .00012, maxblur: .006 }); bokeh.enabled = false;
  const out = new OutputPass();
  const grade = new ShaderPass(GRADE);
  comp.addPass(rp); comp.addPass(ao); comp.addPass(bloom); comp.addPass(bokeh); comp.addPass(out); comp.addPass(grade);
  U.composer = comp; U.passes = { rp, ao, bloom, bokeh, out, grade }; U.w = w; U.h = h; U.pr = pr;
}
function sizeComposer() {
  const pr = renderer.getPixelRatio(), w = Math.max(2, Math.floor(innerWidth * pr)), h = Math.max(2, Math.floor(innerHeight * pr));
  if (w === U.w && h === U.h) return;
  U.w = w; U.h = h; U.pr = pr; U.composer.setSize(w, h);
}

// ---------- jogadores ----------
// materiais dos jogadores no modo: trama de tecido nas roupas e no boné (relevo fino, some de longe), olhos úmidos que
// refletem o céu, cabelo e barba com mais brilho, pele com poros mais marcados. Passa de tempos em tempos (as roupas
// trocam de material quando o visual muda) e desfaz tudo ao sair do modo
let WEAVE = null;
function weaveTex() {
  if (WEAVE) return WEAVE;
  const n = 64, c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'), im = x.createImageData(n, n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { // malha esportiva: fios cruzados com furinhos
    const u = i / n * Math.PI * 8, v = j / n * Math.PI * 8, h = .5 + .25 * Math.sin(u) * Math.cos(v * .5) + .25 * Math.cos(v) * Math.sin(u * .5) + (Math.random() - .5) * .12;
    const k = (j * n + i) * 4, g = Math.max(0, Math.min(255, h * 255)); im.data[k] = im.data[k + 1] = im.data[k + 2] = g; im.data[k + 3] = 255; }
  x.putImageData(im, 0, 0);
  WEAVE = new THREE.CanvasTexture(c); WEAVE.wrapS = WEAVE.wrapT = THREE.RepeatWrapping; WEAVE.repeat.set(80, 80); WEAVE.anisotropy = MAX_ANISO;
  return WEAVE;
}
const CLOTH_RE = /^(Top_|Shorts|ShortS|Bermuda|Skirt|Compress|Legging|Cap|Visor|Headband|Wristband|ArmSleeve|Calf)/, HAIR_RE = /^(Hair|Bun|Pony|Braid|Beard|Goatee|Mustache|Brow)/;
function ultraPlayers(on) {
  for (const p of ALL) {
    if (!p.skin || !p.skin.holder) continue;
    if (p.skinU) p.skinU.uPoreK.value = on ? 1.35 : S.settings.gfx === 'leve' ? 0 : .8;
    p.skin.holder.traverse(o => {
      const m = o.isMesh && o.material; if (!m || Array.isArray(m) || !m.isMeshStandardMaterial || !!m.userData.ultraP === on) return;
      const kind = CLOTH_RE.test(o.name) ? 'cloth' : /^Eyes/.test(o.name) ? 'eye' : HAIR_RE.test(o.name) ? 'hair' : '';
      if (!kind) return;
      if (on) {
        m.userData.ultraP = true; m.userData.u0 = [m.roughness, m.envMapIntensity];
        if (kind === 'cloth') { if (!m.bumpMap) { m.bumpMap = weaveTex(); m.bumpScale = .55; m.userData.uBump = true; m.needsUpdate = true; } }
        else if (kind === 'eye') { m.roughness = .07; m.envMapIntensity = 1.6; }
        else { m.roughness = Math.max(.3, m.roughness * .72); m.envMapIntensity = 1.1; }
      } else {
        m.userData.ultraP = false; const u0 = m.userData.u0; if (u0) { m.roughness = u0[0]; m.envMapIntensity = u0[1]; }
        if (m.userData.uBump) { m.bumpMap = null; m.userData.uBump = false; m.needsUpdate = true; }
      }
    });
  }
}
let plTick = 0;

// ---------- ligar / desligar ----------
function apply(on) {
  if (on === U.on) return;
  U.on = on;
  if (on) {
    if (!U.composer) buildComposer();
    U.saved = { env: scene.environment, envI: scene.environmentIntensity, expo: renderer.toneMappingExposure, shadow: sun.shadow.mapSize.x };
    scene.environment = U.env; scene.environmentIntensity = ENVI;
    renderer.toneMappingExposure = EXPO; // a luz do céu fotografado soma com o sol: exposição um pouco mais fechada
    ULTRA_U.uUltra.value = 1; ULTRA_U.tUN.value = U.tex.sandN; ULTRA_U.tUD.value = U.tex.sandD; ULTRA_U.tUB.value = U.tex.beachN;
    if (sun.shadow.mapSize.x !== 4096) { sun.shadow.mapSize.set(4096, 4096); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  } else if (U.saved) {
    const s = U.saved;
    scene.environment = s.env; scene.environmentIntensity = s.envI;
    scene.environmentRotation.y = 0; hemi.visible = true;
    renderer.toneMappingExposure = s.expo;
    ULTRA_U.uUltra.value = 0;
    if (sun.shadow.mapSize.x !== s.shadow) { sun.shadow.mapSize.set(s.shadow, s.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    U.saved = null;
  }
}
// chamado a cada quadro pelo laço: decide se o modo está valendo (opção ligada, recursos carregados, sem tela dividida)
function ultraSync(split) {
  const want = ultraWanted() && !split;
  if (ultraWanted()) mocapLoad(); // capturas de movimento (valem também com tela dividida)
  if (want && !U.ok) { if (!U.loading) loadAssets(); if (U.on) apply(false); return false; }
  const was = U.on; apply(want);
  if (U.on ? (plTick++ % 90 === 0 || !was) : was) ultraPlayers(U.on);
  return U.on;
}
// desenha o quadro com o pós-processamento
function ultraRender(dt) {
  sizeComposer();
  const flip = SUN_DIR.x < 0; // troca de lado: o sol (e o céu com ele) gira 180°
  scene.environmentRotation.y = flip ? Math.PI : 0;
  const indoor = !sky.visible;
  hemi.visible = indoor; scene.environmentIntensity = indoor ? .4 : ENVI;
  const P = U.passes;
  P.grade.uniforms.time.value = (P.grade.uniforms.time.value + dt) % 100;
  // foco de câmera (fundo desfocado) só nas câmeras de cinema: replay, cerimônia, comemoração e menu
  const cine = S.mode === 'replay' || S.mode === 'ceremony' || S.mode === 'menu' || S.mode === 'over' || !!S.debugDof;
  U.dof += ((cine ? 1 : 0) - U.dof) * Math.min(1, dt * 4);
  P.bokeh.enabled = U.dof > .02;
  if (P.bokeh.enabled) {
    const f = S.dofFocus || focusDist();
    U.focus += (f - U.focus) * Math.min(1, dt * 6);
    P.bokeh.uniforms.focus.value = U.focus; P.bokeh.uniforms.aperture.value = .00016 * U.dof; P.bokeh.uniforms.maxblur.value = .007 * U.dof;
    P.bokeh.uniforms.aspect.value = camera.aspect; P.bokeh.uniforms.nearClip.value = camera.near; P.bokeh.uniforms.farClip.value = camera.far;
  }
  U.composer.render(dt);
}
// distância de foco: o jogador mais perto do centro da tela (ou a bola)
const _v = new THREE.Vector3();
function focusDist() {
  let best = 12, bs = 9;
  for (const p of (S.focusList || [])) { _v.set(p.x, 1.2, p.z).project(camera); const s = _v.x * _v.x + _v.y * _v.y; if (_v.z < 1 && s < bs) { bs = s; best = Math.hypot(camera.position.x - p.x, camera.position.y - 1.2, camera.position.z - p.z); } }
  return best;
}
if (typeof window !== 'undefined') window.__pdoUltra = { U, loadAssets, apply, ultraSync };
export { ultraOn, ultraWanted, ultraSync, ultraRender, loadAssets as ultraLoad };
