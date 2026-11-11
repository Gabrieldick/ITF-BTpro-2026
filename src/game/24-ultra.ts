// @ts-nocheck
// ---------- Modo Ultrarrealista ----------
// Uma terceira opção de "Jogadores" (além de Desenhado e Realista) para computador com placa de vídeo:
//  · céu fotográfico (HDRI "pure sky" do Poly Haven, CC0) no fundo e iluminando a cena (luz por imagem)
//  · mar com reflexo do céu, brilho do sol e espuma; areia com relevo e detalhe fotografados (Poly Haven, CC0)
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
import { HORIZON, MAX_ANISO, SUN_DIR, camera, hemi, renderer, scene, sun } from './02-render';
import { ULTRA_U, sea, seaMat, setSunElev, sky } from './03-cenario';

const BASE = import.meta.env.BASE_URL + 'assets/ultra/';
const U = { want: false, on: false, loading: null, ok: false, meta: null, tex: {}, env: null, composer: null, passes: {}, saved: null, w: 0, h: 0, pr: 0, focus: 8, dof: 0 };
const ultraWanted = () => S.settings.players === 'ultra';
const ultraOn = () => U.on;

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
      const [skyT, sandN, sandD, beachN, env] = await Promise.all([
        loadTex('sky.jpg', true), loadTex('areia-n.jpg', false, true), loadTex('areia-d.jpg', true, true), loadTex('praia-n.jpg', false, true),
        new Promise(res => new RGBELoader().load(BASE + 'env.hdr', t => res(t), undefined, () => res(null))),
      ]);
      if (!skyT || !env) return false;
      // céu de fundo: sem mipmaps (a emenda do atan2 apareceria como uma linha) e repetindo na horizontal
      skyT.wrapS = THREE.RepeatWrapping; skyT.wrapT = THREE.ClampToEdgeWrapping; skyT.generateMipmaps = false; skyT.minFilter = THREE.LinearFilter; skyT.magFilter = THREE.LinearFilter; skyT.needsUpdate = true;
      // cópia pequena e borrada do céu para o reflexo do mar (com mipmaps)
      const c = document.createElement('canvas'); c.width = 1024; c.height = 256; c.getContext('2d').drawImage(skyT.image, 0, 0, 1024, 256);
      const skyS = new THREE.CanvasTexture(c); skyS.colorSpace = THREE.SRGBColorSpace; skyS.wrapS = THREE.RepeatWrapping; skyS.wrapT = THREE.ClampToEdgeWrapping;
      env.mapping = THREE.EquirectangularReflectionMapping;
      const pm = new THREE.PMREMGenerator(renderer); U.env = pm.fromEquirectangular(env).texture; pm.dispose(); env.dispose();
      U.meta = meta; U.tex = { sky: skyT, skyS, sandN, sandD, beachN };
      U.ok = true; return true;
    } catch (e) { return false; }
  })();
  return U.loading;
}

// ---------- céu ----------
// a imagem guarda L/(L+1) (ver ferramentas/ultra/ceu.py); o sol da foto fica na direção do sol do jogo (uRot gira junto na troca de lado)
const SKY_VS = 'varying vec3 vDir; void main(){ vDir = position; vec4 w = modelMatrix*vec4(position,1.); gl_Position = (projectionMatrix*viewMatrix*w).xyww; }';
const SKY_COMMON = `
uniform sampler2D tSky; uniform float uRot; uniform vec3 sunDir; uniform vec3 uHor;
vec3 skyTex(sampler2D t, vec3 d) {
  float u = atan(d.z, d.x) * 0.15915494 + 0.5 + uRot;
  float v = asin(clamp(d.y, 0.0, 1.0)) * 0.63661977;
  vec3 e = texture2D(t, vec2(u, clamp(v, 0.003, 0.997))).rgb;
  return e / (1.0 - min(e, vec3(0.985)));
}`;
let skyMat = null, seaUltra = null;
function buildMaterials() {
  const m = U.meta, hor = new THREE.Vector3(...m.horizon);
  const uRot = { value: 0 };
  skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
    uniforms: { tSky: { value: U.tex.sky }, uRot, sunDir: { value: SUN_DIR }, uHor: { value: hor }, time: { value: 0 }, cloudsOn: { value: 1 } },
    vertexShader: SKY_VS,
    fragmentShader: SKY_COMMON + `
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  vec3 L = skyTex(tSky, d);
  L = mix(L, uHor, smoothstep(0.03, -0.05, d.y));              // abaixo do horizonte: névoa
  float sd = dot(d, sunDir);
  L += vec3(1.0, 0.93, 0.82) * (smoothstep(0.99996, 0.999985, sd) * 900.0 + pow(max(sd, 0.0), 2500.0) * 14.0 + pow(max(sd, 0.0), 180.0) * 1.2); // disco e halo do sol
  gl_FragColor = vec4(L, 1.0);
}`,
  });
  skyMat.userData.uRot = uRot;
  // mar: ondas em várias escalas, reflexo do céu (cópia borrada), cor da água pela profundidade, brilho do sol e espuma
  seaUltra = new THREE.ShaderMaterial({
    fog: false, toneMapped: false,
    uniforms: { time: seaMat.uniforms.time, sunDir: { value: SUN_DIR }, shore: seaMat.uniforms.shore, zs: seaMat.uniforms.zs, tSky: { value: U.tex.skyS }, uRot, uHor: { value: hor }, uE: { value: (m.sunE * Math.sin(m.elev) + m.skyE) / Math.PI } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: SKY_COMMON + `
uniform float time, shore, zs, uE; varying vec3 vW;
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f); return mix(mix(h21(i), h21(i+vec2(1.,0.)), u.x), mix(h21(i+vec2(0.,1.)), h21(i+vec2(1.,1.)), u.x), u.y); }
vec2 wv(vec2 p, vec2 d, float k, float a, float s){ float ph = dot(p, d)*k + time*s; return d*(a*k*cos(ph)); }
void main(){
  vec2 p = vW.xz; float dcam = length(vW.xz - cameraPosition.xz);
  // ondas: as grandes sempre; as pequenas somem com a distância (não cintilam no horizonte)
  vec2 g = vec2(0.);
  g += wv(p, normalize(vec2(0.25, 1.)), 0.16, 0.42, 0.9);
  g += wv(p, normalize(vec2(-0.6, 1.)), 0.37, 0.16, 1.5);
  g += wv(p, normalize(vec2(0.9, 0.4)), 0.83, 0.06, 2.2) * (1. - smoothstep(300., 900., dcam));
  float f1 = 1. - smoothstep(60., 320., dcam), f2 = 1. - smoothstep(20., 140., dcam);
  g += (wv(p, normalize(vec2(-0.2, -1.)), 1.9, 0.022, 3.0) + wv(p, normalize(vec2(1., -0.3)), 3.3, 0.011, 3.9) + wv(p, normalize(vec2(-0.8, 0.5)), 5.1, 0.006, 4.6)) * f1;
  g += (wv(p, normalize(vec2(0.4, 0.9)), 9.7, 0.0028, 6.1) + wv(p, normalize(vec2(-0.5, -0.7)), 15.3, 0.0016, 7.7)) * f2;
  // encrespado fino por ruído (vento)
  float nz = n2(p*0.9 + time*vec2(0.3, 0.5)) - n2(p*0.9 + vec2(0.11, 0.) + time*vec2(0.3, 0.5));
  float nz2 = n2(p*0.9 + time*vec2(0.3, 0.5)) - n2(p*0.9 + vec2(0., 0.11) + time*vec2(0.3, 0.5));
  g += vec2(nz, nz2) * 0.55 * f1;
  vec3 n = normalize(vec3(-g.x, 1., -g.y));
  vec3 V = normalize(cameraPosition - vW);
  float fres = 0.02 + 0.98*pow(1. - max(dot(n, V), 0.), 5.);
  vec3 R = reflect(-V, n); R.y = abs(R.y);
  vec3 refl = skyTex(tSky, R);
  float dist = shore - vW.z*zs;
  // cor da água: luz que volta de dentro (raso turquesa → fundo azul) × a luz que chega
  vec3 body = mix(vec3(0.060, 0.300, 0.270), vec3(0.008, 0.045, 0.085), smoothstep(0., 90., dist)) * uE;
  body = mix(vec3(0.42, 0.36, 0.24) * uE * 0.8, body, smoothstep(0., 9., dist));   // bem no raso aparece a areia do fundo
  vec3 c = mix(body, refl, fres);
  float sp = max(dot(R, sunDir), 0.);
  c += vec3(1., .93, .8) * (pow(sp, 900.) * 55. + pow(sp, 90.) * 0.7 + pow(sp, 12.) * 0.05);
  // espuma: linha de arrebentação que vai e volta, faixa na beira e carneirinhos ao longe
  float wash = sin(dist*0.55 - time*1.3 + sin(vW.x*0.08)*2.);
  float tex = 0.55 + 0.45*n2(p*3.1 + time*0.2) * n2(p*7.3 - time*0.15) * 2.;
  float foam = smoothstep(0.72, 1., wash) * (1. - smoothstep(0., 20., dist)) * tex;
  foam += (1. - smoothstep(0., 2.2 + 1.2*sin(time*0.7 + vW.x*0.13), dist)) * tex;
  foam += smoothstep(0.86, 0.97, n2(p*0.07 + time*0.05) * n2(p*0.31 - time*0.08) * 1.9) * 0.5 * f1;
  c = mix(c, vec3(0.86, 0.88, 0.88) * uE * 0.95, clamp(foam, 0., 1.) * 0.85);
  c = mix(c, uHor, smoothstep(350., 1500., dcam) * 0.9);
  gl_FragColor = vec4(c, 1.);
}`,
  });
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
      if (o.isPoints || o.isLine) { o.visible = false; return; }
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
  const ao = new AOPass(scene, camera, w, h, { radius: .5, distanceExponent: 1.4, thickness: 1.2, scale: 1.15, samples: 16, distanceFallOff: 1, screenSpaceRadius: false }, { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 16 });
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

// ---------- ligar / desligar ----------
function apply(on) {
  if (on === U.on) return;
  U.on = on;
  if (on) {
    if (!skyMat) buildMaterials();
    if (!U.composer) buildComposer();
    U.saved = { sky: sky.material, sea: sea.material, env: scene.environment, envI: scene.environmentIntensity, fog: scene.fog.color.clone(), hor: HORIZON.clone(), expo: renderer.toneMappingExposure, shadow: sun.shadow.mapSize.x, clouds: sky.material.uniforms.cloudsOn.value };
    sky.material = skyMat; sea.material = seaUltra;
    scene.environment = U.env; scene.environmentIntensity = 1;
    renderer.toneMappingExposure = .6; // sol + céu fotografado somam mais luz que a cena desenhada: exposição de câmera mais fechada
    const hc = U.meta.horizon; HORIZON.setRGB(hc[0], hc[1], hc[2]); // (a névoa da cena usa o mesmo objeto de cor)
    setSunElev(U.meta.elev);
    ULTRA_U.uUltra.value = 1; ULTRA_U.tUN.value = U.tex.sandN; ULTRA_U.tUD.value = U.tex.sandD; ULTRA_U.tUB.value = U.tex.beachN;
    if (sun.shadow.mapSize.x !== 4096) { sun.shadow.mapSize.set(4096, 4096); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  } else if (U.saved) {
    const s = U.saved;
    sky.material = s.sky; sea.material = s.sea; scene.environment = s.env; scene.environmentIntensity = s.envI; HORIZON.copy(s.hor);
    scene.environmentRotation.y = 0; hemi.visible = true;
    renderer.toneMappingExposure = s.expo;
    setSunElev(null);
    ULTRA_U.uUltra.value = 0;
    if (sun.shadow.mapSize.x !== s.shadow) { sun.shadow.mapSize.set(s.shadow, s.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    U.saved = null;
  }
}
// chamado a cada quadro pelo laço: decide se o modo está valendo (opção ligada, recursos carregados, sem tela dividida)
function ultraSync(split) {
  const want = ultraWanted() && !split;
  if (want && !U.ok) { if (!U.loading) loadAssets(); if (U.on) apply(false); return false; }
  apply(want);
  return U.on;
}
// desenha o quadro com o pós-processamento
function ultraRender(dt) {
  sizeComposer();
  const flip = SUN_DIR.x < 0; // troca de lado: o sol (e o céu com ele) gira 180°
  skyMat.userData.uRot.value = flip ? .5 : 0;
  scene.environmentRotation.y = flip ? Math.PI : 0;
  const indoor = !sky.visible;
  hemi.visible = indoor; scene.environmentIntensity = indoor ? .4 : 1;
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
