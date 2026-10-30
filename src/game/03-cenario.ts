// @ts-nocheck
// céu, mar, areia, quadra e cenário da praia
import './02-render';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { C, HALF_W, SHORE_Z, V3, WATERLINE, ZONE3, clamp, fbm, rand, smooth } from './00-base';
import { HORIZON, MAX_ANISO, SUN_DIR, canvasTex, col, hemi, mat, renderer, scene, sun } from './02-render';
// juntar o cenário parado: centenas de peças pequenas (palmeiras, quiosques, prédios, arquibancadas, placas) viravam uma
// chamada de desenho cada (e outra na sombra). Junta, dentro de cada grupo, as peças visíveis com o mesmo material numa
// malha só; o que se mexe é InstancedMesh (fica de fora), e quem precisa ficar separado marca userData.dyn
const _mInv = new THREE.Matrix4(), _mRel = new THREE.Matrix4();
// material igual por propriedades (as peças do cenário criam um material novo a cada uma, mesmo com a mesma cor)
const matKey = m => m.map || m.emissiveMap || m.normalMap || m.alphaMap || m.onBeforeCompile.toString() !== THREE.Material.prototype.onBeforeCompile.toString() || !m.isMeshStandardMaterial ? m.uuid
  : [m.type, m.color.getHexString(), m.emissive.getHexString(), m.emissiveIntensity, m.roughness, m.metalness, m.flatShading, m.side, m.transparent, m.opacity, m.vertexColors, m.envMapIntensity, m.depthWrite, m.visible].join('|');
// keep: as peças originais ficam (o chamador esconde o grupo de origem); cada material vira uma malha, mesmo que seja uma peça só
function mergeStatic(root, target, keep) {
  const roots = Array.isArray(root) ? root : [root]; target = target || roots[0];
  target.updateMatrixWorld(true); roots.forEach(r => r.updateMatrixWorld(true)); _mInv.copy(target.matrixWorld).invert();
  const buckets = new Map();
  roots.forEach(root => root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.userData.dyn || Array.isArray(o.material) || !o.geometry || o.geometry.morphAttributes.position) return;
    for (let a = o; a && a !== root; a = a.parent) if (!a.visible || a.userData.dyn) return;
    _mRel.multiplyMatrices(_mInv, o.matrixWorld); if (_mRel.determinant() < 0) return; // espelhada: inverteria as faces
    const g = o.geometry, sig = Object.keys(g.attributes).sort().map(k => k + g.attributes[k].itemSize).join(',') + (g.index ? 'i' : 'n');
    const k = matKey(o.material) + sig + o.castShadow + o.receiveShadow + o.renderOrder;
    if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push([o, _mRel.clone()]);
  }));
  buckets.forEach(list => {
    if (list.length < 2 && !keep) return;
    const geos = list.map(([o, m]) => { const gg = o.geometry.clone(); for (const n in gg.morphAttributes) delete gg.morphAttributes[n]; gg.applyMatrix4(m); return gg; });
    const merged = mergeGeometries(geos, false); geos.forEach(g => g.dispose()); if (!merged) return;
    const o0 = list[0][0], mesh = new THREE.Mesh(merged, o0.material);
    mesh.castShadow = o0.castShadow; mesh.receiveShadow = o0.receiveShadow; mesh.renderOrder = o0.renderOrder; mesh.name = 'merged';
    target.add(mesh); if (!keep) list.forEach(([o]) => o.parent.remove(o));
  });
}
// guarda-sóis e palmeiras: juntos numa malha por material (refeito a cada arena, porque cada uma esconde uns e mostra outros)
const PROPM = new THREE.Group(); PROPM.name = 'props-juntos';
const PROPS = []; // guarda-sóis e palmeiras perto da quadra (somem quando há arquibancada)
// ambiente (mar, areia, quadra, decoração e arena): gira 180° na troca de lado; o céu fica (só o sol muda de lado)
const ENV = new THREE.Group(); ENV.name = 'ambiente'; scene.add(ENV);
setTimeout(() => confMesh(), 0); // o confete já existe (escondido) para o aquecimento dos shaders compilar
// ---------- Céu procedural com nuvens e sol ----------
// o céu fica na profundidade máxima e é desenhado depois do resto: só os pixels de céu que aparecem calculam as nuvens
// (antes ele vinha primeiro e as nuvens eram calculadas na tela inteira, embaixo da areia e da quadra)
const SKY_VS = 'varying vec3 vDir; void main(){ vDir = position; vec4 w = modelMatrix*vec4(position,1.); gl_Position = (projectionMatrix*viewMatrix*w).xyww; }';
const SKY_FS = [
  'uniform vec3 sunDir; uniform float time; uniform float ground; uniform float cloudsOn; varying vec3 vDir;',
  'float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }',
  'float n2(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.-2.*f);',
  ' return mix(mix(h21(i), h21(i+vec2(1.,0.)), u.x), mix(h21(i+vec2(0.,1.)), h21(i+vec2(1.,1.)), u.x), u.y); }',
  'float fbm(vec2 p){ float a = .5, s = 0.; for(int i=0;i<5;i++){ s += a*n2(p); p *= 2.03; a *= .5; } return s; }',
  'void main(){',
  ' vec3 d = normalize(vDir);',
  ' float h = max(d.y, 0.);',
  ' vec3 zen = vec3(0.10, 0.28, 0.70); vec3 hor = vec3(0.58, 0.72, 0.84);',
  ' vec3 c = mix(hor, zen, pow(h, 0.45));',
  ' float sd = max(dot(d, sunDir), 0.);',
  ' c += vec3(1.0, .82, .58)*pow(sd, 6.)*0.22 + vec3(1., .9, .75)*pow(sd, 90.)*0.5;',
  ' c = mix(c, vec3(1.6, 1.5, 1.35), smoothstep(0.9994, 0.9998, sd));',
  ' if (cloudsOn > .5 && d.y > 0.) {',
  '  vec2 uv = d.xz/(d.y + 0.12)*1.4 + vec2(time*0.004, time*0.002);',
  '  float cl = fbm(uv*1.1);',
  '  float cov = smoothstep(0.52, 0.78, cl) * smoothstep(0.0, 0.18, d.y);',
  '  float shade = fbm(uv*1.1 + sunDir.xz*0.06);',
  '  vec3 cc = mix(vec3(0.95,0.96,1.0), vec3(0.62,0.68,0.78), clamp((cl-shade)*3.+0.25, 0., 1.));',
  '  cc += vec3(1.,.9,.7)*pow(sd,8.)*0.4;',
  '  c = mix(c, cc, cov*0.9);',
  ' }',
  ' if (d.y < 0.) c = mix(hor, vec3(0.50, 0.42, 0.30), ground*smoothstep(0., -0.25, d.y));',
  ' gl_FragColor = vec4(c, 1.);',
  ' #include <colorspace_fragment>',
  '}'].join('\n');
function skyMaterial(ground) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, toneMapped: false, fog: false,
    uniforms: { sunDir: { value: SUN_DIR }, time: { value: 0 }, ground: { value: ground }, cloudsOn: { value: 1 } },
    vertexShader: SKY_VS, fragmentShader: SKY_FS,
  });
}
const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), skyMaterial(0));
sky.renderOrder = 1000; sky.frustumCulled = false;
scene.add(sky);
// luz ambiente e reflexos a partir de uma cópia do céu
try {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMaterial(1));
  envSky.material.uniforms.cloudsOn.value = 0;
  envScene.add(envSky);
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;
  pmrem.dispose();
} catch (e) { hemi.intensity = 0.8; }
// ---------- Mar ----------
const seaMat = new THREE.ShaderMaterial({
  toneMapped: false, fog: false,
  uniforms: { time: { value: 0 }, sunDir: { value: SUN_DIR }, hor: { value: HORIZON }, shore: { value: WATERLINE }, zs: { value: 1 } },
  vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
  fragmentShader: [
    'uniform float time; uniform vec3 sunDir; uniform vec3 hor; uniform float shore; uniform float zs; varying vec3 vW;',
    'vec2 wv(vec2 p, vec2 d, float k, float a, float s){ float ph = dot(p, d)*k + time*s; return d*(a*k*cos(ph)); }',
    'void main(){',
    ' vec2 p = vW.xz; vec2 g = vec2(0.);',
    ' g += wv(p, normalize(vec2(0.25, 1.)), 0.18, 0.35, 1.0);',
    ' g += wv(p, normalize(vec2(-0.6, 1.)), 0.43, 0.12, 1.7);',
    ' g += wv(p, normalize(vec2(0.9, 0.4)), 1.1, 0.04, 2.6);',
    ' g += wv(p, normalize(vec2(-0.2, -1.)), 2.3, 0.015, 3.4);',
    ' g += wv(p, normalize(vec2(1., -0.3)), 4.7, 0.006, 4.9);',
    ' float dcam = length(vW.xz - cameraPosition.xz);',
    ' g *= 1.0 - smoothstep(200., 900., dcam)*0.8;',
    ' vec3 n = normalize(vec3(-g.x, 1., -g.y));',
    ' vec3 V = normalize(cameraPosition - vW);',
    ' float fres = 0.02 + 0.98*pow(1. - max(dot(n, V), 0.), 5.);',
    ' vec3 R = reflect(-V, n);',
    ' vec3 skyc = mix(hor, vec3(0.10, 0.28, 0.70), pow(clamp(R.y, 0., 1.), 0.45));',
    ' float dist = shore - vW.z*zs;',
    ' vec3 shallow = vec3(0.10, 0.42, 0.40); vec3 deep = vec3(0.012, 0.09, 0.16);',
    ' vec3 water = mix(shallow, deep, smoothstep(0., 70., dist));',
    ' vec3 c = mix(water, skyc, fres);',
    ' float sp = max(dot(R, sunDir), 0.);',
    ' c += vec3(1., .93, .8)*(pow(sp, 600.)*8. + pow(sp, 60.)*0.25);',
    ' float wash = sin(dist*0.55 - time*1.3 + sin(vW.x*0.08)*2.);',
    ' float foam = smoothstep(0.75, 1., wash)*(1. - smoothstep(0., 18., dist));',
    ' foam += (1. - smoothstep(0., 2.5 + 1.2*sin(time*0.7 + vW.x*0.13), dist));',
    ' c = mix(c, vec3(0.92, 0.94, 0.93), clamp(foam, 0., 1.)*0.8);',
    ' c = mix(c, hor, smoothstep(250., 1450., dcam));',
    ' gl_FragColor = vec4(c, 1.);',
    ' #include <colorspace_fragment>',
    '}'].join('\n')
});
const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 3000, 1, 1), seaMat);
sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.02, SHORE_Z + 4 - 1500); ENV.add(sea);
// ---------- Areia ----------
// areia de praia (ondulação leve do vento) ou areia revirada da quadra (montinhos e buracos de pisada, sem ondulação);
// grãos de cores diferentes (quartzo claro, bege, marrom, minerais escuros)
function makeSandTextures(N, churn) {
  const H = new Float32Array(N * N);
  const cA = document.createElement('canvas'); cA.width = cA.height = N;
  const cN = document.createElement('canvas'); cN.width = cN.height = N;
  const xa = cA.getContext('2d'), xn = cN.getContext('2d');
  const ia = xa.createImageData(N, N), inn = xn.createImageData(N, N);
  const P = 6;
  // buracos de pisada/montinhos (quadra): bacias com borda levantada, espalhadas e sobrepostas
  const pits = [];
  if (churn) for (let i = 0; i < 95; i++) pits.push([Math.random() * N, Math.random() * N, N * (.02 + Math.random() * .045), Math.random() < .75 ? 1 : -.7]);
  const PH = new Float32Array(N * N); // altura dos buracos, carimbada só em volta de cada um
  for (const [px, py, r, sg] of pits) {
    const R = Math.ceil(r * 1.6);
    for (let oy = -R; oy <= R; oy++) for (let ox = -R; ox <= R; ox++) {
      const d = Math.hypot(ox, oy * 1.3) / r; if (d > 1.6) continue;
      const x = ((Math.round(px) + ox) % N + N) % N, y = ((Math.round(py) + oy) % N + N) % N;
      PH[y * N + x] += sg * (d < 1 ? -(1 - d * d) * .9 : Math.sin((d - 1) / .6 * Math.PI) * .35); // fundo + borda empurrada para cima
    }
  }
  const pitH = (x, y) => PH[y * N + x];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N;
    const f = fbm(u * P, v * P, P, 4, churn ? 7 : 3), f2 = fbm(u * 24, v * 24, 24, 3, churn ? 11 : 5);
    const rip = churn ? 0 : Math.sin(2 * Math.PI * (3 * u + 5 * v) + f * 7) * .5 + .5;
    const g = Math.random();
    H[y * N + x] = churn ? f * .9 + f2 * .6 + pitH(x, y) * 1.4 + g * .4 : f * .8 + rip * .14 + f2 * .3 + g * .35;
    const i = (y * N + x) * 4;
    // revirada: a areia de baixo aparece mais clara/seca nas bordas dos buracos e mais escura no fundo
    const sh = churn ? clamp(pitH(x, y) * .22, -.16, .1) : 0;
    const k = .9 + (f - .5) * .3 + (f2 - .5) * .12 + (g - .5) * .14 + sh;
    let r = 222 * k, gg = 197 * k, b = 150 * k;
    const sp = Math.random();
    if (sp < .016) { r *= .5; gg *= .46; b *= .42; }            // minerais escuros
    else if (sp < .04) { r = 252; gg = 247; b = 234; }          // quartzo claro
    else if (sp < .055) { r *= 1.06; gg *= .82; b *= .68; }      // grãos avermelhados
    else if (sp < .075) { r *= .86; gg *= .8; b *= .72; }        // grãos marrons
    ia.data[i] = clamp(r, 0, 255); ia.data[i + 1] = clamp(gg, 0, 255); ia.data[i + 2] = clamp(b, 0, 255); ia.data[i + 3] = 255;
  }
  const str = churn ? 4.6 : 2.2;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const l = H[y * N + (x - 1 + N) % N], r = H[y * N + (x + 1) % N], t = H[((y - 1 + N) % N) * N + x], b = H[((y + 1) % N) * N + x];
    let nx = (l - r) * str, ny = (t - b) * str, nz = 1; const L = Math.hypot(nx, ny, nz); nx /= L; ny /= L; nz /= L;
    const i = (y * N + x) * 4;
    inn.data[i] = (nx * .5 + .5) * 255; inn.data[i + 1] = (ny * .5 + .5) * 255; inn.data[i + 2] = (nz * .5 + .5) * 255; inn.data[i + 3] = 255;
  }
  xa.putImageData(ia, 0, 0); xn.putImageData(inn, 0, 0);
  const ta = new THREE.CanvasTexture(cA), tn = new THREE.CanvasTexture(cN);
  ta.colorSpace = THREE.SRGBColorSpace;
  [ta, tn].forEach(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = MAX_ANISO; t.repeat.set(90, 70); });
  return { ta, tn };
}
const sandTex = makeSandTextures(512);
const sandGeo = new THREE.PlaneGeometry(420, 320, 168, 128);
{
  const pa = sandGeo.attributes.position;
  const colors = new Float32Array(pa.count * 3);
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), y = pa.getY(i);
    const wz = 90 - y;
    const d = Math.max(0, Math.max(Math.abs(x) - 19, Math.abs(wz) - 16)); // plano até 19 m para os lados (cabem as quadras vizinhas dos amadores)
    let hgt = Math.min(1, d / 20) * (Math.sin(x * .07) * 1.1 + Math.cos(wz * .09) * .8 + 1.3) * smooth(-30, -12, wz);
    hgt += (fbm(x * .08 + 50, wz * .08 + 50, 4096, 3, 9) - .5) * .25 * Math.min(1, d / 4 + .15);
    hgt -= .6 * smooth(SHORE_Z + 4, SHORE_Z - 8, wz);
    hgt *= 1 - smooth(31, 39, wz); // do lado da terra a areia acaba plana no calçadão (a cidade fica atrás)
    pa.setZ(i, hgt);
    const macro = fbm(x * .02 + 10, wz * .02 + 10, 4096, 3, 21);
    let k = .9 + (macro - .5) * .22;
    if (Math.abs(x) < 6.5 && Math.abs(wz) < 10.5) k += .05;
    const wet = smooth(-44, WATERLINE, wz);
    colors[i * 3] = k * (1 - wet * .45); colors[i * 3 + 1] = k * (1 - wet * .42); colors[i * 3 + 2] = k * (1 - wet * .35);
  }
  sandGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  sandGeo.computeVertexNormals();
}
const sandMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: sandTex.ta, normalMap: sandTex.tn, normalScale: new THREE.Vector2(.9, .9), roughness: .97, metalness: 0, vertexColors: true, envMapIntensity: .6 });
// no shader: duas escalas da mesma textura (some a repetição) e, na quadra e em volta, a areia revirada no lugar da de praia
const churnTex = makeSandTextures(512, true);
sandMat.onBeforeCompile = sh => {
  sh.uniforms.tChurn = { value: churnTex.ta }; sh.uniforms.tChurnN = { value: churnTex.tn }; sh.uniforms.uCourt = { value: new THREE.Vector2(6.2, 11) };
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSandW;')
    .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSandW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vSandW;\nuniform sampler2D tChurn, tChurnN;\nuniform vec2 uCourt;\nfloat sandCourt() { return 1.0 - smoothstep(0.0, 4.0, max(abs(vSandW.x) - uCourt.x, abs(vSandW.z) - uCourt.y)); }')
    // areia de fora e areia revirada da quadra: só lê as texturas do lado que aparece (na transição, as duas); as derivadas
    // vêm de fora do if (dentro dele o mipmap automático não vale)
    .replace('vec4 sampledDiffuseColor = texture2D( map, vMapUv );', `vec2 uvB = vMapUv * 0.371 + vec2(0.13, 0.57), sdx = dFdx(vMapUv), sdy = dFdy(vMapUv);
    float ct = sandCourt();
    vec4 sBase = vec4(0.), sChurn = vec4(0.);
    if (ct < 0.999) sBase = mix(textureGrad(map, vMapUv, sdx, sdy), textureGrad(map, uvB, sdx * 0.371, sdy * 0.371), 0.45);
    if (ct > 0.001) sChurn = mix(textureGrad(tChurn, vMapUv, sdx, sdy), textureGrad(tChurn, uvB * 1.7, sdx * 0.63, sdy * 0.63), 0.4);
    vec4 sampledDiffuseColor = mix(sBase, sChurn, ct);`)
    .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', `vec2 nuvB = vNormalMapUv * 0.371 + vec2(0.13, 0.57), ndx = dFdx(vNormalMapUv), ndy = dFdy(vNormalMapUv);
    float nct = sandCourt(); vec3 nBase = vec3(0.), nChurn = vec3(0.);
    if (nct < 0.999) nBase = mix(textureGrad(normalMap, vNormalMapUv, ndx, ndy).xyz, textureGrad(normalMap, nuvB, ndx * 0.371, ndy * 0.371).xyz, 0.45);
    if (nct > 0.001) nChurn = mix(textureGrad(tChurnN, vNormalMapUv, ndx, ndy).xyz, textureGrad(tChurnN, nuvB * 1.7, ndx * 0.63, ndy * 0.63).xyz, 0.4);
    vec3 mapN = mix(nBase, nChurn, nct) * 2.0 - 1.0;`);
};
const sand = new THREE.Mesh(sandGeo, sandMat);
sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0, 90);
sand.receiveShadow = true;
ENV.add(sand);
// relevo da areia da quadra: malha fina (8 cm) por cima da quadra e arredores, com montinhos de 1–3 cm; mais revirada e
// funda onde mais se pisa (fundo da quadra no saque e na frente da rede). Some perto das fitas e na borda (encaixa na areia
// de fora: mesma textura, mesmas cores). sandH também posiciona as pegadas em cima do relevo
const CS = { hx: 7, hz: 12.5, step: .08 };
function sandWear(x, z) {
  let w = 0;
  for (const zz of [8.7, -8.7]) w += Math.exp(-(x * x) / 4 - ((Math.abs(z) - Math.abs(zz)) ** 2) / .5) * (Math.sign(z) === Math.sign(zz) ? 1 : 0);
  w += Math.exp(-(x * x) / 6 - ((Math.abs(z) - 2.2) ** 2) / 1.2) * .7; // frente da rede
  return Math.min(1, w);
}
function sandH(x, z) {
  if (Math.abs(x) > CS.hx || Math.abs(z) > CS.hz) return 0;
  const w = sandWear(x, z);
  let h = (fbm(x * 2.2 + 31, z * 2.2 + 17, 4096, 3, 41) - .5) * .03 * (1 + w * 1.4) + (fbm(x * 7 + 3, z * 7 + 9, 4096, 2, 43) - .5) * .009 * (1 + w) - .012 * w;
  // perto das fitas (das duas quadras: simples e dupla) a areia fica rente
  let dl = Math.abs(Math.abs(z) - C.halfL);
  for (const hw of Object.values(HALF_W)) dl = Math.min(dl, Math.abs(Math.abs(x) - hw) + (Math.abs(z) > C.halfL ? Math.abs(z) - C.halfL : 0));
  h *= smooth(.04, .22, dl);
  h *= smooth(0, .8, CS.hx - Math.abs(x)) * smooth(0, .8, CS.hz - Math.abs(z)); // borda: encaixa na areia plana de fora
  return h;
}
// cor da areia de fora no ponto (a mesma conta dos vértices dela, interpolada como na malha grossa)
function baseSandCol(x, wz) {
  const node = (nx, nz) => { const macro = fbm(nx * .02 + 10, nz * .02 + 10, 4096, 3, 21); let k = .9 + (macro - .5) * .22; if (Math.abs(nx) < 6.5 && Math.abs(nz) < 10.5) k += .05; const wet = smooth(-44, WATERLINE, nz); return [k * (1 - wet * .45), k * (1 - wet * .42), k * (1 - wet * .35)]; };
  const gx = (x + 210) / 2.5, gy = (90 - wz + 160) / 2.5, i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j;
  const X = k => -210 + k * 2.5, Z = k => 90 - (-160 + k * 2.5);
  const a = node(X(i), Z(j)), b = node(X(i + 1), Z(j)), c = node(X(i), Z(j + 1)), d = node(X(i + 1), Z(j + 1));
  return [0, 1, 2].map(n => (a[n] * (1 - fx) + b[n] * fx) * (1 - fy) + (c[n] * (1 - fx) + d[n] * fx) * fy);
}
const courtSandMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: sandTex.ta, normalMap: sandTex.tn, normalScale: new THREE.Vector2(.9, .9), roughness: .97, metalness: 0, vertexColors: true, envMapIntensity: .6 });
courtSandMat.onBeforeCompile = sandMat.onBeforeCompile; // mesmo shader da areia de fora
{
  const nx = Math.round(CS.hx * 2 / CS.step), nz = Math.round(CS.hz * 2 / CS.step);
  const g = new THREE.PlaneGeometry(CS.hx * 2, CS.hz * 2, nx, nz); g.rotateX(-Math.PI / 2);
  const pa = g.attributes.position, uv = g.attributes.uv, colors = new Float32Array(pa.count * 3);
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), z = pa.getZ(i), h = sandH(x, z), w = sandWear(x, z);
    pa.setY(i, h + .0015);
    uv.setXY(i, (x + 210) / 420, (90 - z + 160) / 320); // o mesmo UV da areia de fora (textura contínua)
    const c = baseSandCol(x, z), dk = 1 - .07 * w - clamp(-h / .03, 0, 1) * .06; // revirada e no fundo dos buracos: um pouco mais escura
    colors[i * 3] = c[0] * dk; colors[i * 3 + 1] = c[1] * dk; colors[i * 3 + 2] = c[2] * dk;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, courtSandMat); m.receiveShadow = true; ENV.add(m);
}
// ---------- Quadra ----------
const tapeMat = mat('#1f4fb8', { roughness: .55 });
const linesGroup = { simples: new THREE.Group(), dupla: new THREE.Group() };
const tapeFaint = new THREE.MeshStandardMaterial({ color: col('#1f4fb8'), roughness: .6, transparent: true, opacity: .28, depthWrite: false });
function tape(group, w, l, x, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.008, l), tapeMat); m.position.set(x, 0.004, z); m.receiveShadow = true; group.add(m); }
Object.entries(HALF_W).forEach(([k, hw]) => {
  const g = linesGroup[k];
  tape(g, hw * 2 + .05, .05, 0, C.halfL); tape(g, hw * 2 + .05, .05, 0, -C.halfL);
  tape(g, .05, C.halfL * 2 + .05, hw, 0); tape(g, .05, C.halfL * 2 + .05, -hw, 0);
  // linha dos 3 m: não é uma linha de verdade na quadra; só um traço apagado por dentro e marcas na lateral (3 m e 5 m)
  // (no profissional o parceiro de quem saca fica atrás dos 6 m: setZoneLine move o segundo traço)
  [ZONE3, -ZONE3].forEach(z => [0, 1].forEach(mv => { const m = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 - .1, 0.006, .035), tapeFaint); m.position.set(0, 0.003, z); if (mv) m.userData.zone = Math.sign(z); g.add(m); })); // 3 m (recepção) e a do parceiro do sacador
  [ZONE3, 6].forEach(d => [1, -1].forEach(sz => [1, -1].forEach(sx => { const m = new THREE.Mesh(new THREE.BoxGeometry(.32, 0.008, .05), tapeMat); m.position.set(sx * (hw + .16), 0.004, sz * d); g.add(m); })));
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .03, 8), mat('#f4f1ea')); p.position.set(a * hw, .015, b * C.halfL); g.add(p);
  });
  ENV.add(g);
});
// Rede
const netTex = canvasTex(64, 64, (x, w, h) => {
  x.clearRect(0, 0, w, h); x.strokeStyle = 'rgba(6,9,12,1)'; x.lineWidth = 9; x.strokeRect(0, 0, w, h);
}, false);
netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping; netTex.repeat.set(C.netHalf * 2 / .045, 1 / .045);
const netMat = new THREE.MeshStandardMaterial({ color: col('#0e1216'), map: netTex, transparent: true, alphaTest: .12, side: THREE.DoubleSide, roughness: .9 });
const net = new THREE.Mesh(new THREE.PlaneGeometry(C.netHalf * 2, 1.0), netMat);
net.position.set(0, C.netH - .5, 0); ENV.add(net);
const drawBand = c => (x, w, h) => { x.fillStyle = '#f6f4ee'; x.fillRect(0, 0, w, h); x.fillStyle = c; for (let i = 0; i < w; i += 64) x.fillRect(i, 0, 32, h); };
const bandTex = canvasTex(512, 16, drawBand('#1f4fb8'));
bandTex.wrapS = THREE.RepeatWrapping; bandTex.repeat.set(3, 1);
const band = new THREE.Mesh(new THREE.BoxGeometry(C.netHalf * 2, .07, .012), mat('#ffffff', { map: bandTex, roughness: .6 }));
// torneio com patrocinador master: a faixa da rede leva o nome da marca repetido, nas cores dela
const bandBrandTex = canvasTex(2048, 32, () => {}); bandBrandTex.wrapS = THREE.RepeatWrapping;
function drawBrandBand(name, bg, fg) { const x = bandBrandTex.image.getContext('2d'), w = bandBrandTex.image.width, h = bandBrandTex.image.height;
  x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.font = 'italic 900 24px Arial Black, Arial, sans-serif'; x.textBaseline = 'middle';
  const step = x.measureText(name).width + 90; for (let px = 30; px < w; px += step) { x.fillText(name, px, h / 2 + 1); x.fillRect(px + step - 60, h / 2 - 3, 30, 6); }
  bandTex.needsUpdate = true; bandBrandTex.needsUpdate = true; }
band.position.set(0, C.netH - .035, 0); band.castShadow = true; ENV.add(band);
const padMat = mat('#1f4fb8', { roughness: .7 });
const band2 = new THREE.Mesh(new THREE.BoxGeometry(C.netHalf * 2, .035, .01), mat('#1f4fb8'));
band2.position.set(0, C.netH - 1.0, 0); ENV.add(band2);
// altura da rede da partida: 1,80 m no profissional masculino, 1,70 m no feminino, misto e amador
// traço da linha que segura o parceiro do sacador até o saque: 3 m no amador, 6 m no profissional (a recepção fica nos 3 m)
function setZoneLine(z) { Object.values(linesGroup).forEach(g => g.children.forEach(m => { if (m.userData.zone) m.position.z = m.userData.zone * z; })); }
function setNetHeight(h) { C.netH = h; net.position.y = h - .5; band.position.y = h - .035; band2.position.y = h - 1.0; }
[-1, 1].forEach(s => {
  const px = s * (C.netHalf + .12);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.045, .05, 1.95, 16), mat('#e9edf0', { roughness: .25, metalness: .7 }));
  post.position.set(px, .975, 0); post.castShadow = true; ENV.add(post);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 1.4, 16), padMat);
  pad.position.set(px, .7, 0); pad.castShadow = true; ENV.add(pad);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 8), mat('#d8dde0', { metalness: .7, roughness: .3 })); cap.position.set(px, 1.96, 0); ENV.add(cap);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, 2.6, 4), mat('#e8e2d0'));
  rope.position.set(px + s * .65, .95, 0); rope.rotation.z = s * .62; ENV.add(rope);
  const peg = new THREE.Mesh(new THREE.CylinderGeometry(.02, .03, .12, 6), mat('#6b4b2e')); peg.position.set(px + s * 1.3, .05, 0); ENV.add(peg);
});
// ---------- Cenário ----------
const barkTex = canvasTex(64, 256, (x, w, h) => {
  x.fillStyle = '#8b6d4b'; x.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 9) { x.fillStyle = `rgba(60,40,22,${rand(.35, .6)})`; x.fillRect(0, y, w, rand(2, 4)); x.fillStyle = `rgba(200,170,130,${rand(.15, .3)})`; x.fillRect(0, y + 4, w, 2); }
  for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(40,25,10,${rand(.05, .2)})`; x.fillRect(Math.random() * w, Math.random() * h, 1, rand(2, 8)); }
});
barkTex.wrapS = barkTex.wrapT = THREE.RepeatWrapping; barkTex.repeat.set(2, 6);
const frondTex = canvasTex(128, 512, (x, w, h) => {
  x.clearRect(0, 0, w, h);
  x.strokeStyle = '#5c6b2a'; x.lineWidth = 4; x.beginPath(); x.moveTo(w / 2, h); x.lineTo(w / 2, 0); x.stroke();
  for (let i = 0; i < 46; i++) {
    const t = i / 46; const y = h - t * h * .98; const len = (w / 2 - 4) * Math.sin(Math.PI * Math.min(1, .15 + t * .95)) * (1 - t * .25);
    [-1, 1].forEach(s => {
      x.strokeStyle = `hsl(${rand(82, 100)}, ${rand(42, 58)}%, ${rand(24, 36)}%)`; x.lineWidth = rand(4, 6); x.lineCap = 'round';
      x.beginPath(); x.moveTo(w / 2, y); x.quadraticCurveTo(w / 2 + s * len * .5, y - 10, w / 2 + s * len, y - 26 - t * 10); x.stroke();
    });
  }
});
const frondMat = new THREE.MeshStandardMaterial({ map: frondTex, alphaTest: .5, side: THREE.DoubleSide, roughness: .75, envMapIntensity: .5 });
const frondDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: frondTex, alphaTest: .5 });
const frondGeo = (() => {
  const g = new THREE.PlaneGeometry(1.3, 3.6, 4, 12); g.translate(0, 1.8, 0);
  const pa = g.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), y = pa.getY(i); const t = y / 3.6;
    pa.setZ(i, -1.6 * t * t + Math.abs(x) * .35);
  }
  g.computeVertexNormals(); return g;
})();
function palm(x, z, h, lean) {
  const g = new THREE.Group();
  const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(new V3(lean * t * t * h, t * h, Math.sin(t * 2.4) * .25)); }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tg = new THREE.TubeGeometry(curve, 24, .2, 10, false);
  {
    const pa = tg.attributes.position; const p = new V3();
    for (let i = 0; i <= 24; i++) {
      const t = i / 24; const c = curve.getPointAt(t); const s = 1.15 - .4 * t + (i < 2 ? .25 : 0);
      for (let j = 0; j <= 10; j++) { const k = i * 11 + j; p.set(pa.getX(k), pa.getY(k), pa.getZ(k)).sub(c).multiplyScalar(s).add(c); pa.setXYZ(k, p.x, p.y, p.z); }
    }
    tg.computeVertexNormals();
  }
  const trunk = new THREE.Mesh(tg, mat('#ffffff', { map: barkTex, roughness: .95 })); trunk.castShadow = true; g.add(trunk);
  const top = curve.getPointAt(1);
  const n = 11;
  for (let i = 0; i < n; i++) {
    const piv = new THREE.Group(); piv.position.copy(top); piv.rotation.y = i / n * Math.PI * 2 + rand(-.2, .2);
    const f = new THREE.Mesh(frondGeo, frondMat); f.customDepthMaterial = frondDepth;
    f.rotation.x = -(rand(.5, 1.25)); f.scale.setScalar(rand(.8, 1.15)); f.castShadow = true; f.receiveShadow = true;
    piv.add(f); g.add(piv);
  }
  for (let i = 0; i < 5; i++) { const nut = new THREE.Mesh(new THREE.SphereGeometry(.13, 10, 8), mat('#5a3f22', { roughness: .6 })); nut.position.copy(top).add(new V3(rand(-.2, .2), -.2, rand(-.2, .2))); g.add(nut); }
  g.position.set(x, -.05, z); g.rotation.y = Math.random() * Math.PI * 2; ENV.add(g); PROPS.push(g);
}
palm(-10.5, -6, 7.5, .25); palm(-12.5, 5, 8.5, -.2); palm(11, -9, 8, .3); palm(13, 6, 7, -.25);
palm(-15, -22, 9, .2); palm(16, -23, 8.5, .15); palm(-9.5, 18, 7, .2); palm(10.5, 20, 8, -.3);
palm(-22, 2, 9.5, .15); palm(24, -4, 10, -.2); palm(-28, -16, 8, .2); palm(30, 14, 9, -.15);
function stripeTex(c1, c2, n) { return canvasTex(256, 32, (x, w, h) => { for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? c2 : c1; x.fillRect(i * w / n, 0, w / n + 1, h); } }); }
function umbrella(x, z, c1, c2) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 2.4, 8), mat('#eceae4', { metalness: .5, roughness: .4 })); pole.position.y = 1.2; pole.castShadow = true; g.add(pole);
  const top = new THREE.Mesh(new THREE.ConeGeometry(1.6, .5, 16, 1, true), mat('#ffffff', { map: stripeTex(c1, c2, 16), side: THREE.DoubleSide, roughness: .85 }));
  top.position.y = 2.35; top.castShadow = true; g.add(top);
  const towel = new THREE.Mesh(new THREE.PlaneGeometry(.85, 1.8), mat('#ffffff', { map: stripeTex(c2, '#f4efe2', 6) }));
  towel.rotation.x = -Math.PI / 2; towel.rotation.z = rand(-.3, .3); towel.position.set(.9, .02, .3); towel.receiveShadow = true; g.add(towel);
  const chair = new THREE.Group(); const fr = mat('#c9c4b8', { metalness: .4, roughness: .4 });
  [-.25, .25].forEach(cx => {
    const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .6, 6), fr); leg1.position.set(cx, .22, .15); leg1.rotation.x = .5; chair.add(leg1);
    const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, .9, 6), fr); leg2.position.set(cx, .35, -.15); leg2.rotation.x = -.45; chair.add(leg2);
  });
  const seat = new THREE.Mesh(new THREE.PlaneGeometry(.5, .55), mat(c1, { side: THREE.DoubleSide })); seat.position.set(0, .3, .1); seat.rotation.x = -1.2; chair.add(seat);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(.5, .7), mat(c1, { side: THREE.DoubleSide })); back.position.set(0, .55, -.25); back.rotation.x = -.45; chair.add(back);
  chair.position.set(-.8, 0, .4); chair.rotation.y = rand(-.6, .6); chair.traverse(m => { if (m.isMesh) m.castShadow = true; }); g.add(chair);
  g.position.set(x, 0, z); g.rotation.y = rand(0, Math.PI * 2); ENV.add(g); PROPS.push(g);
}
umbrella(-8.2, 1.5, '#ff5a1f', '#fbf6ea'); umbrella(8.6, -3, '#ffd23f', '#1f4fb8'); umbrella(-9, -15, '#1f4fb8', '#fbf6ea');
umbrella(9, 12, '#0b7a83', '#fbf6ea'); umbrella(-18, 10, '#e2364a', '#fbf6ea'); umbrella(19, -12, '#ff5a1f', '#ffd23f');
// posto de salva-vidas
{
  const g = new THREE.Group(); const wood = mat('#b98a5a', { roughness: .9 }); const red = mat('#d6332f', { roughness: .7 });
  [[-.8, -.8], [.8, -.8], [-.8, .8], [.8, .8]].forEach(([a, b]) => { const l = new THREE.Mesh(new THREE.BoxGeometry(.12, 3, .12), wood); l.position.set(a, 1.5, b); l.castShadow = true; g.add(l); });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(2, .12, 2), wood); floor.position.y = 3; g.add(floor);
  const hut = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.3, 1.8), mat('#f2efe6')); hut.position.y = 3.7; hut.castShadow = true; g.add(hut);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.6, .7, 4), red); roof.position.y = 4.7; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.82, .25, 1.82), red); stripe.position.y = 3.6; g.add(stripe);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(.7, .06, 3.6), wood); ramp.position.set(0, 1.5, 2.4); ramp.rotation.x = .95; g.add(ramp);
  g.position.set(-26, 0, -30); g.rotation.y = .4; ENV.add(g);
}
// morros ao longe
{
  const hillMat = mat('#4b6b3e', { roughness: 1, flatShading: true });
  [[-520, -700, 160, 70], [-380, -820, 120, 45], [600, -900, 220, 90], [420, -760, 110, 40]].forEach(([x, z, r, h]) => {
    const geo = new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const pa = geo.attributes.position;
    for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); const n = fbm(pa.getX(i) * .02 + 3, pa.getZ(i) * .02 + 3, 4096, 3, 5); pa.setY(i, y * (h / r) * (.7 + n * .6)); }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, hillMat); m.position.set(x, -2, z); ENV.add(m);
  });
}

// ---------- lado da terra (aparece depois da troca de lado): dunas com vegetação, calçadão, avenida e cidade ----------
{
  const L = new THREE.Group(); L.name = 'cidade'; ENV.add(L);
  // vegetação nas dunas (tufos de capim)
  {
    const geo = new THREE.ConeGeometry(.18, .8, 4); geo.translate(0, .4, 0);
    const im = new THREE.InstancedMesh(geo, mat('#8a9a52', { roughness: 1, flatShading: true }), 420), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < 420; i++) {
      const x = rand(-120, 120), z = rand(22, 37); if (Math.abs(x) < 20 && z < 26) { i--; continue; }
      const sc = rand(.4, 1); e.set(rand(-.2, .2), rand(0, 6.3), rand(-.2, .2)); q.setFromEuler(e);
      m4.compose(new V3(x, rand(.4, 1.6) * (1 - smooth(31, 37, z)), z), q, new V3(sc, sc * rand(.7, 1.4), sc)); im.setMatrixAt(i, m4);
    }
    im.castShadow = true; L.add(im);
  }
  // calçadão com as ondas de pedra portuguesa
  const wave = canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#f2efe6'; x.fillRect(0, 0, w, h); x.strokeStyle = '#1d1f22'; x.lineWidth = 18;
    for (const y0 of [32, 96]) { x.beginPath(); for (let i = 0; i <= w; i += 4) { const y = y0 + Math.sin(i / w * Math.PI * 2) * 22; i ? x.lineTo(i, y) : x.moveTo(i, y); } x.stroke(); }
  });
  wave.wrapS = wave.wrapT = THREE.RepeatWrapping; wave.repeat.set(70, 1.5);
  const walk = new THREE.Mesh(new THREE.PlaneGeometry(420, 6.5), mat('#ffffff', { map: wave, roughness: .9 })); walk.rotation.x = -Math.PI / 2; walk.position.set(0, .06, 43.2); walk.receiveShadow = true; L.add(walk);
  const curb = new THREE.Mesh(new THREE.BoxGeometry(420, .35, .35), mat('#d9d4c8')); curb.position.set(0, .17, 39.9); curb.receiveShadow = true; L.add(curb);
  // avenida (duas faixas com a linha amarela) e a calçada do outro lado
  const road = canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#3a3d42'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { x.fillStyle = Math.random() < .5 ? '#34373c' : '#43464b'; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    x.fillStyle = '#e8c33a'; x.fillRect(0, h / 2 - 3, w * .55, 6); x.fillStyle = '#e9e9e9'; x.fillRect(0, 4, w, 4); x.fillRect(0, h - 8, w, 4);
  });
  road.wrapS = THREE.RepeatWrapping; road.repeat.set(60, 1);
  const av = new THREE.Mesh(new THREE.PlaneGeometry(420, 11), mat('#ffffff', { map: road, roughness: .95 })); av.rotation.x = -Math.PI / 2; av.position.set(0, .05, 52); av.receiveShadow = true; L.add(av);
  const side2 = new THREE.Mesh(new THREE.PlaneGeometry(420, 5), mat('#c9c5bb', { roughness: .95 })); side2.rotation.x = -Math.PI / 2; side2.position.set(0, .07, 60); L.add(side2);
  // postes e palmeiras no calçadão
  const poleM = mat('#5d646b', { metalness: .6, roughness: .45 }), lampM = new THREE.MeshBasicMaterial({ color: col('#fff6d8') });
  for (let x = -91; x <= 91; x += 14) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.08, .12, 7, 8), poleM); pole.position.y = 3.5; pole.castShadow = true; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, 1.6), poleM); arm.position.set(0, 6.9, .7); g.add(arm);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(.4, .14, .7), lampM); lamp.position.set(0, 6.8, 1.4); g.add(lamp);
    g.position.set(x, 0, 46.6); L.add(g);
  }
  [-77, -49, -21, 21, 49, 77].forEach((x, i) => palm(x, 41.5, 8 + (i % 3), i % 2 ? .15 : -.15));
  // carros parados e passando
  const CAR = ['#d8d8d8', '#1d1f22', '#b8202a', '#2a5bd7', '#f2f2f2', '#6b7077', '#e3a21a', '#1f6b4a'], glass = mat('#1b2a36', { roughness: .2, metalness: .4 }), tire = mat('#141414');
  for (let i = 0; i < 16; i++) {
    const g = new THREE.Group(), body = mat(CAR[i % CAR.length], { roughness: .35, metalness: .5 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(4.2, .9, 1.8), body); b.position.y = .75; b.castShadow = true; g.add(b);
    const c = new THREE.Mesh(new THREE.BoxGeometry(2.2, .7, 1.6), glass); c.position.set(-.2, 1.5, 0); g.add(c);
    [[-1.3, .9], [1.3, .9], [-1.3, -.9], [1.3, -.9]].forEach(([wx, wz]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .25, 12), tire); w.rotation.x = Math.PI / 2; w.position.set(wx, .34, wz); g.add(w); });
    const lane = i % 3 === 0 ? 57 : i % 2 ? 49.6 : 54.4;
    g.position.set(-105 + i * 13.5 + rand(-3, 3), 0, lane); if (lane === 54.4) g.rotation.y = Math.PI; L.add(g);
  }
  // prédios: uma fileira na beira da avenida e outra mais alta atrás (janelas em textura)
  const winTex = (base, lit) => canvasTex(64, 128, (x, w, h) => {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) { x.fillStyle = Math.random() < lit ? '#f4e7b8' : Math.random() < .5 ? '#2c3e50' : '#3b5268'; x.fillRect(4 + c * 15, 6 + r * 15.5, 10, 9); }
  });
  const FAC = ['#d9cdb8', '#c4ad88', '#aebcc7', '#d2b8aa', '#a9b3ab', '#ddd5c6', '#bcc6d2', '#cdbf96', '#b07d62', '#8fa3a8'];
  const building = (x, z, w, d, h, far) => {
    const t = winTex(far ? '#9fb0c2' : FAC[Math.floor(rand(0, FAC.length))], .08); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.max(1, Math.round(w / 5)), Math.max(1, Math.round(h / 9)));
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat('#ffffff', { map: t, roughness: .8 }));
    m.position.set(x, h / 2, z); if (!far) m.castShadow = true; L.add(m);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w * .9, .8, d * .9), mat(far ? '#8e9cab' : '#9aa1a8')); roof.position.set(x, h + .4, z); L.add(roof);
  };
  for (let x = -170; x < 170;) { const w = rand(11, 20), h = rand(12, 38); building(x + w / 2, 80 + rand(0, 4), w, rand(12, 16), h, false); x += w + rand(1.5, 4); }
  for (let x = -300; x < 300;) { const w = rand(16, 30), h = rand(40, 115); building(x + w / 2, 125 + rand(0, 45), w, rand(16, 24), h, true); x += w + rand(4, 14); }
}

// ---------- Arenas: cores da quadra por local e arquibancadas conforme o tamanho do torneio ----------
// size 0 = praia aberta · 1 = arquibancada pequena num lado · 2 = dos dois lados com placas · 3 = estádio (lados + fundo)
const ARENA = { group: new THREE.Group(), key: '', crowd: [], cheerT: 0 };
ENV.add(ARENA.group);
const SKIN_C = ['#f1cfae', '#e2b48f', '#d2a07a', '#c68a5e', '#a8704a', '#8d5a3b', '#6b4229'];
function bleachers(side, x0, z0, len, rows, seatCol, along) {
  // along = 'z' (arquibancada lateral, de frente para a quadra em x) ou 'x' (no fundo, de frente em z)
  const g = new THREE.Group();
  const frame = mat('#9aa3aa', { metalness: .6, roughness: .45 }), seat = mat(seatCol, { roughness: .6 });
  const seats = [];
  for (let r = 0; r < rows; r++) {
    const off = r * .82, hgt = r * .45 + .3;
    const step = new THREE.Mesh(along === 'z' ? new THREE.BoxGeometry(.82, hgt, len) : new THREE.BoxGeometry(len, hgt, .82), r % 2 ? frame : seat);
    if (along === 'z') step.position.set(x0 + side * (off + .41), hgt / 2, z0); else step.position.set(x0, hgt / 2, z0 + side * (off + .41));
    step.receiveShadow = true; g.add(step);
    for (let i = 0; i < len / .62 - 1; i++) {
      if (Math.random() < .12) continue; // lugares vazios
      const u = -len / 2 + .5 + i * .62 + rand(-.05, .05);
      seats.push(along === 'z' ? [x0 + side * (off + .45), hgt, z0 + u, side, 'z'] : [x0 + u, hgt, z0 + side * (off + .45), side, 'x']);
    }
  }
  ARENA.group.add(g);
  return seats;
}
function crowd(seats) {
  if (!seats.length) return;
  const body = new THREE.InstancedMesh(new THREE.BoxGeometry(.4, .62, .3), new THREE.MeshStandardMaterial({ roughness: .8 }), seats.length);
  const head = new THREE.InstancedMesh(new THREE.SphereGeometry(.13, 10, 8), new THREE.MeshStandardMaterial({ roughness: .7 }), seats.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  const shirts = ['#ff5a1f', '#fbf6ea', '#17324d', '#ffd23f', '#0b7a83', '#e2364a', '#2457c5', '#7fd6db', '#3b1f5c', '#f4f1ea'];
  seats.forEach(([x, y, z, side, along], i) => {
    q.setFromAxisAngle(new V3(0, 1, 0), along === 'z' ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : (side > 0 ? Math.PI : 0));
    m4.compose(new V3(x, y + .31, z), q, new V3(1, 1, 1)); body.setMatrixAt(i, m4);
    m4.compose(new V3(x, y + .75, z), q, new V3(1, 1, 1)); head.setMatrixAt(i, m4);
    body.setColorAt(i, c.set(shirts[Math.floor(Math.random() * shirts.length)]).convertSRGBToLinear());
    head.setColorAt(i, c.set(SKIN_C[Math.floor(Math.random() * SKIN_C.length)]).convertSRGBToLinear());
  });
  // braços (descem ao lado do corpo; na comemoração metade levanta e balança) e algumas bandeiras erguidas
  const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(.08, .44, .08), new THREE.MeshStandardMaterial({ roughness: .8 }), seats.length * 2);
  seats.forEach(([x, y, z, side, along], i) => { const sc = SKIN_C[Math.floor(Math.random() * SKIN_C.length)]; arms.setColorAt(i * 2, c.set(sc).convertSRGBToLinear()); arms.setColorAt(i * 2 + 1, c.set(sc).convertSRGBToLinear()); });
  const flagIdx = seats.map((_, i) => i).filter(() => Math.random() < .07);
  if (flagIdx.length) {
    const FL = [['#009c3b', '#ffdf00', '#002776'], ['#009246', '#ffffff', '#ce2b37'], ['#0055a4', '#ffffff', '#ef4135'], ['#aa151b', '#f1bf00', '#aa151b']];
    const tex = canvasTex(256, 64, (x, w, h) => FL.forEach((f, k) => { const x0 = k * 64; f.forEach((cc, j) => { x.fillStyle = cc; x.fillRect(x0 + j * 21.3, 0, 22, h); }); if (k === 0) { x.fillStyle = '#ffdf00'; x.beginPath(); x.moveTo(x0 + 32, 10); x.lineTo(x0 + 56, 32); x.lineTo(x0 + 32, 54); x.lineTo(x0 + 8, 32); x.fill(); x.fillStyle = '#002776'; x.beginPath(); x.arc(x0 + 32, 32, 11, 0, 7); x.fill(); } }));
    flagIdx.forEach(i => { const [x, y, z, side, along] = seats[i], k = Math.floor(Math.random() * 4), g = new THREE.PlaneGeometry(.6, .4), uv = g.attributes.uv; for (let n = 0; n < uv.count; n++) uv.setX(n, (k + uv.getX(n)) / 4);
      const f = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: .9 })); f.position.set(x, y + 1.35, z); f.rotation.y = along === 'z' ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : (side > 0 ? Math.PI : 0); ARENA.group.add(f);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .9, 5), new THREE.MeshStandardMaterial({ color: 0x8a6a45 })); st.position.set(x, y + 1.0, z); ARENA.group.add(st); });
  }
  ARENA.group.add(body, head, arms);
  const cr = { body, head, arms, seats, ph: seats.map(() => Math.random() * 6) }; ARENA.crowd.push(cr); crowdArms(cr, 0, 0);
}
// braços: abaixados ao lado do corpo, ou (na comemoração, metade do público) levantados balançando
function crowdArms(cr, t, amp) {
  cr.seats.forEach(([x, y, z, side, along], i) => {
    const ang = along === 'z' ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : (side > 0 ? Math.PI : 0); _cq.setFromAxisAngle(_upC, ang);
    const up = amp > .02 && i % 2 === 0, j = Math.max(0, Math.sin(t * 9 + cr.ph[i])) * amp, wave = up ? Math.sin(t * 7 + cr.ph[i]) * .35 : 0;
    for (const sd of [-1, 1]) { _cp.set(sd * .25, up ? .98 : .3, 0).applyQuaternion(_cq); _cq2.setFromAxisAngle(_fw.set(0, 0, 1).applyQuaternion(_cq), up ? sd * -.25 + wave : sd * .08); _cq2.multiply(_cq);
      _cm.compose(_cp.set(x + _cp.x, y + _cp.y + j, z + _cp.z), _cq2, _cs); cr.arms.setMatrixAt(i * 2 + (sd > 0 ? 1 : 0), _cm); }
  });
  cr.arms.instanceMatrix.needsUpdate = true;
}
// faixas das arquibancadas: com patrocinador master, nas cores da marca e com o nome dela junto do torneio
const brd = a => a.mi != null ? [ADS[a.mi][1], ADS[a.mi][2]] : [a.board[0], a.board[1]];
const brdT = a => a.mi != null ? ADS[a.mi][0] + ' · ' + (a.text || '') : a.text;
function boards(x0, z0, len, along, c1, c2, text) {
  const t = canvasTex(1024, 64, (x, w, h) => { x.fillStyle = c1; x.fillRect(0, 0, w, h); x.fillStyle = c2; x.font = 'bold 40px sans-serif'; x.textBaseline = 'middle';
    const step = x.measureText(text).width + 70; for (let px = 24; px < w; px += step) x.fillText(text, px, h / 2); });
  const b = new THREE.Mesh(along === 'z' ? new THREE.BoxGeometry(.06, .7, len) : new THREE.BoxGeometry(len, .7, .06), [mat('#222'), mat('#222'), mat('#222'), mat('#222'), mat('#ffffff', { map: t, emissive: col('#ffffff'), emissiveMap: t, emissiveIntensity: .25 }), mat('#ffffff', { map: t, emissive: col('#ffffff'), emissiveMap: t, emissiveIntensity: .25 })]);
  if (along === 'z') { b.material = [mat('#ffffff', { map: t, emissive: col('#ffffff'), emissiveMap: t, emissiveIntensity: .25 }), mat('#ffffff', { map: t, emissive: col('#ffffff'), emissiveMap: t, emissiveIntensity: .25 }), mat('#222'), mat('#222'), mat('#222'), mat('#222')]; }
  b.position.set(x0, .35, z0); ARENA.group.add(b);
}
// ---------- torneio amador: torcida em pé na beira da quadra e outras quadras com jogos ao lado ----------
// tudo em malhas instanciadas (3 malhas para o público, 4 para os jogos) e sem sombra: quase não pesa
const SIDE = { courts: [], players: null, balls: null, n: 0 };
function standingCrowd(spots) {
  if (!spots.length) return;
  const n = spots.length, mk = (g, m) => { const im = new THREE.InstancedMesh(g, m, n); ARENA.group.add(im); return im; };
  const legs = mk(new THREE.CapsuleGeometry(.12, .55, 3, 8), new THREE.MeshStandardMaterial({ roughness: .85 }));
  const body = mk(new THREE.CapsuleGeometry(.17, .32, 4, 10), new THREE.MeshStandardMaterial({ roughness: .8 }));
  const head = mk(new THREE.SphereGeometry(.12, 10, 8), new THREE.MeshStandardMaterial({ roughness: .7 }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), one = new V3(1, 1, 1);
  const shirts = ['#ff5a1f', '#fbf6ea', '#17324d', '#ffd23f', '#0b7a83', '#e2364a', '#2457c5', '#7fd6db', '#f4f1ea', '#4fd18b'], shorts = ['#17324d', '#2a2a2a', '#c9b48a', '#2457c5', '#fbf6ea'];
  const seats = [];
  spots.forEach(([x, z], i) => {
    const yaw = Math.atan2(-x, -z * .35); q.setFromAxisAngle(new V3(0, 1, 0), yaw);
    m4.compose(new V3(x, .4, z), q, one); legs.setMatrixAt(i, m4);
    m4.compose(new V3(x, 1.1, z), q, one); body.setMatrixAt(i, m4);
    m4.compose(new V3(x, 1.53, z), q, one); head.setMatrixAt(i, m4);
    legs.setColorAt(i, c.set(Math.random() < .5 ? SKIN_C[Math.floor(Math.random() * SKIN_C.length)] : shorts[Math.floor(Math.random() * shorts.length)]).convertSRGBToLinear());
    body.setColorAt(i, c.set(shirts[Math.floor(Math.random() * shirts.length)]).convertSRGBToLinear());
    head.setColorAt(i, c.set(SKIN_C[Math.floor(Math.random() * SKIN_C.length)]).convertSRGBToLinear());
    seats.push([x, .79, z, yaw]);
  });
  ARENA.crowd.push({ body, head, seats, ph: seats.map(() => Math.random() * 6), stand: true });
}
function sideCourt(cx) {
  const g = new THREE.Group(), hw = HALF_W.dupla, tm = mat('#1f4fb8', { roughness: .6 });
  const T = (w, l, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, .008, l), tm); m.position.set(cx + x, .004, z); g.add(m); };
  T(hw * 2, .05, 0, C.halfL); T(hw * 2, .05, 0, -C.halfL); T(.05, C.halfL * 2, hw, 0); T(.05, C.halfL * 2, -hw, 0);
  const nt = new THREE.Mesh(new THREE.PlaneGeometry(C.netHalf * 2, 1), netMat); nt.position.set(cx, 1.2, 0); g.add(nt);
  const bd = new THREE.Mesh(new THREE.BoxGeometry(C.netHalf * 2, .06, .012), mat('#f6f4ee')); bd.position.set(cx, 1.68, 0); g.add(bd);
  [-1, 1].forEach(sd => { const po = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 1.8, 8), mat('#d8dde2', { metalness: .5, roughness: .4 })); po.position.set(cx + sd * (C.netHalf + .1), .9, 0); g.add(po); });
  ARENA.group.add(g);
  SIDE.courts.push({ cx, ph: Math.random() * 10, rally: 0 });
}
function sideGames(xs) {
  SIDE.courts = []; xs.forEach(sideCourt);
  const n = xs.length * 4; SIDE.n = n;
  const mk = (gm, m, k) => { const im = new THREE.InstancedMesh(gm, m, k); im.frustumCulled = false; ARENA.group.add(im); return im; };
  SIDE.players = [mk(new THREE.CapsuleGeometry(.12, .6, 3, 8), new THREE.MeshStandardMaterial({ color: col('#c68a5e'), roughness: .85 }), n),
    mk(new THREE.CapsuleGeometry(.17, .3, 4, 10), new THREE.MeshStandardMaterial({ roughness: .8 }), n), mk(new THREE.SphereGeometry(.12, 10, 8), new THREE.MeshStandardMaterial({ color: col('#d2a07a'), roughness: .7 }), n)];
  const c = new THREE.Color(), kits = ['#ff5a1f', '#2457c5', '#ffd23f', '#0b7a83', '#e2364a', '#fbf6ea'];
  for (let i = 0; i < n; i++) SIDE.players[1].setColorAt(i, c.set(kits[(Math.floor(i / 2) + Math.floor(i / 4)) % kits.length]).convertSRGBToLinear());
  SIDE.balls = mk(new THREE.SphereGeometry(.05, 8, 6), new THREE.MeshStandardMaterial({ color: col('#ffe14d'), roughness: .5 }), xs.length);
}
const _sm = new THREE.Matrix4(), _sq = new THREE.Quaternion(), _sv = new V3(), _s1 = new V3(1, 1, 1), _up = new V3(0, 1, 0);
function updateSideGames(dt) {
  if (!SIDE.players || !SIDE.courts.length || !SIDE.players[0].parent) return;
  const t = performance.now() / 1000;
  SIDE.courts.forEach((ct, k) => {
    // a bola vai e volta entre um jogador de cada lado; cada troca leva ~1,3 s
    const T = 1.3, u = (t + ct.ph) / T, n = Math.floor(u), f = u - n, from = n % 2, hw = HALF_W.dupla;
    const pos = [];
    for (let j = 0; j < 4; j++) {
      const team = j < 2 ? 0 : 1, side = j % 2 ? 1 : -1, zz = (team ? -1 : 1) * (5.2 + Math.sin(t * .7 + j + k) * 1.2);
      pos.push([ct.cx + side * hw * .5 + Math.sin(t * 1.3 + j * 2 + k) * .6, zz]);
    }
    const a = pos[from * 2 + (n % 4 < 2 ? 0 : 1)], b = pos[(1 - from) * 2 + ((n + 1) % 4 < 2 ? 0 : 1)];
    const bx = a[0] + (b[0] - a[0]) * f, bz = a[1] + (b[1] - a[1]) * f, by = 1 + Math.sin(Math.PI * f) * 2.6;
    _sm.compose(_sv.set(bx, by, bz), _sq.identity(), _s1); SIDE.balls.setMatrixAt(k, _sm);
    pos.forEach(([x, z], j) => {
      const i = k * 4 + j, hop = Math.abs(Math.sin(t * 6 + j)) * .04;
      _sq.setFromAxisAngle(_up, (j < 2 ? 0 : Math.PI) + Math.sin(t + j) * .3);
      _sm.compose(_sv.set(x, .43 + hop, z), _sq, _s1); SIDE.players[0].setMatrixAt(i, _sm);
      _sm.compose(_sv.set(x, 1.15 + hop, z), _sq, _s1); SIDE.players[1].setMatrixAt(i, _sm);
      _sm.compose(_sv.set(x, 1.58 + hop, z), _sq, _s1); SIDE.players[2].setMatrixAt(i, _sm);
    });
  });
  SIDE.players.forEach(m => { m.instanceMatrix.needsUpdate = true; }); SIDE.balls.instanceMatrix.needsUpdate = true;
}
function applyArena(a) {
  a = Object.assign({ size: 0, line: '#1f4fb8', trim: '#1f4fb8', sand: '#ffffff', seat: '#2457c5', board: ['#0b1d3f', '#33c3ff'], text: 'ITF-BT PRO 2026' }, a || {});
  const key = JSON.stringify(a); if (key === ARENA.key) return; ARENA.key = key;
  // linha da quadra nunca amarela (nem amarelada): se vier uma cor assim, usa o azul padrão
  { const lc = col(a.line), hsl = {}; lc.getHSL(hsl); tapeMat.color.copy(hsl.h > .08 && hsl.h < .2 && hsl.s > .3 && hsl.l > .25 ? col('#1f4fb8') : lc); tapeFaint.color.copy(tapeMat.color); } padMat.color.copy(col(a.trim)); band2.material.color.copy(col(a.trim));
  const bc = bandTex.image.getContext('2d'); drawBand(a.trim)(bc, bandTex.image.width, bandTex.image.height); bandTex.needsUpdate = true;
  // patrocinador master do torneio: faixa da rede, protetores e as placas alternadas com a marca
  a.mi = a.master ? ADS.findIndex(d => d[0] === a.master) : -1; if (a.mi < 0) a.mi = null;
  if (a.mi != null) { const [nm, bg, fg] = ADS[a.mi]; drawBrandBand(nm, bg, fg); band.material.map = bandBrandTex; padMat.color.copy(col(bg)); band2.material.color.copy(col(bg)); }
  else band.material.map = bandTex;
  band.material.needsUpdate = true;
  sandMat.color.copy(col(a.sand)); courtSandMat.color.copy(sandMat.color);
  // arquibancadas
  ARENA.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  ARENA.group.clear(); ARENA.crowd = [];
  PROPS.forEach(g => { g.visible = !((a.size > 0 || a.amateur) && Math.abs(g.position.x) < (a.amateur ? 20 : 15) && g.position.z > -22 && g.position.z < 16); });
  SIDE.players = null; SIDE.courts = [];
  const L = C.halfL * 2 + 4, W = 7.8;
  let seats = [];
  if (a.size >= 1) seats = seats.concat(bleachers(-1, -W, -1, L * (a.size >= 2 ? 1 : .7), a.size >= 3 ? 8 : a.size >= 2 ? 5 : 3, a.seat, 'z'));
  if (a.size >= 2) seats = seats.concat(bleachers(1, W, -1, L, a.size >= 3 ? 8 : 5, a.seat, 'z'));
  if (a.size >= 3) seats = seats.concat(bleachers(-1, 0, -(C.halfL + 5.5), 2 * W - 1, 6, a.seat, 'x'));
  crowd(seats);
  if (a.size === 0 && a.text) boards(0, -(C.halfL + 3.5), 8, 'x', ...brd(a), brdT(a)); // torneio local: uma faixa no fundo
  if (a.amateur) { // público em pé dos dois lados e no fundo, e duas quadras vizinhas com jogo
    const spots = [];
    // não fica perto da câmera (atrás da sua linha de fundo), só da metade da quadra para lá
    [-1, 1].forEach(sd => { for (let z = -C.halfL + .5; z < 3.5; z += rand(.6, 1.3)) if (Math.random() < .8) spots.push([sd * (HALF_W.dupla + rand(2, 3)), z]); });
    for (let x = -5; x <= 5; x += rand(.8, 1.5)) if (Math.random() < .6) spots.push([x, -(C.halfL + rand(4.2, 5.2))]);
    standingCrowd(spots);
    sideGames([-(HALF_W.dupla * 2 + 5), HALF_W.dupla * 2 + 5]);
  }
  if (a.size >= 2) { boards(-(W - .6), -1, L - 2, 'z', ...brd(a), brdT(a)); boards(W - .6, -1, L - 2, 'z', ...brd(a), brdT(a)); }
  if (a.size >= 3) boards(0, -(C.halfL + 4.4), 2 * W - 2.4, 'x', ...brd(a), brdT(a));
  indoorHall(a);
  if (!a.indoor && (a.amateur || a.size >= 1)) beachDecor(a);
  mergeStatic(ARENA.group); ENV.children.forEach(g => { if (g.name === 'cidade') mergeStatic(g); });
  if (!PROPM.parent) ENV.add(PROPM);
  PROPM.children.forEach(m => m.geometry.dispose()); PROPM.clear();
  const vis = PROPS.filter(g => g.visible); mergeStatic(vis, PROPM, true); vis.forEach(g => { g.visible = false; });
}
// ambiente fechado (points e arenas cobertas): paredes, telhado com fileiras de luz; sem céu, mar, palmeiras nem sol forte
const LIGHT0 = { sun: null, hemi: null, hemiC: null, hemiG: null };
// ---------- patrocínios e decoração dos eventos (marcas fictícias) ----------
// marcas das placas (fictícias / quase iguais às do circuito): [nome, fundo, cor da letra, logo, slogan, fundo 2 (degradê)]
const ADS = [
  ['NUX', '#f4f1ea', '#1b1b1d', 'x', 'BEACH TENNIS', '#d9d4c8'], ["HERUE'S", '#0e0e10', '#ffc21a', 'sun', 'BE A HERO', '#2a1440'], ['KUNA', '#121214', '#ff7a1a', 'k', 'GLADIATOR SERIES', '#2a1030'],
  ['ANA SPORT', '#f7f7f7', '#111111', 'bee', 'POISON BEE', '#d9dbde'], ['MORMAJI', '#ffffff', '#c9a24a', 'wave', 'SURF & SAND', '#f3e6ff'], ['DROP SHUT', '#121314', '#b7f000', 'star', 'PRIME ATTACK', '#2c2f33'],
  ['ZANB', '#faf8f4', '#1a1a1a', 'crown', 'BRUXO EDITION', '#e9dcc4'], ['SOLAR MAX', '#ff5a1f', '#ffffff', 'sunsc', 'PROTETOR FPS 70', '#ffb23f'], ['COCO GELADO', '#2e9e57', '#ffffff', 'coco', 'ÁGUA DE COCO', '#7fd67a'],
  ['BRISA ENERGÉTICO', '#e2364a', '#ffe14d', 'bolt', 'ENERGIA PRA SAQUE', '#7a1630'], ['SALINA ISOTÔNICO', '#33c3ff', '#0b1d3f', 'drop', 'HIDRATA NA AREIA', '#d6f4ff'], ['DUNA ÓCULOS', '#111111', '#ffd23f', 'shades', 'POLARIZADO', '#3a3a3a'],
  ['MARAZUL SEGUROS', '#1f4fb8', '#ffffff', 'shield', 'PROTEÇÃO QUE VAI LONGE', '#0b2462'], ['ONDAS TELECOM', '#7b2ff7', '#ffffff', 'signal', '5G NA PRAIA', '#3b1f9c'], ['LITORAL BANK', '#0b7a83', '#ffffff', 'coin', 'SEU DINHEIRO EM BOAS MÃOS', '#064a50'],
  ['FAROL VIAGENS', '#ff8a00', '#17324d', 'plane', 'DESTINOS DE AREIA', '#ffd23f'], ['CERVEJA PRAIANA', '#ffd23f', '#5a2d0c', 'mug', 'BEBA COM MODERAÇÃO', '#f39c12'], ['AREIA FINA', '#ffd23f', '#17324d', 'palm', 'MODA PRAIA', '#ffe9a0'],
];
function adLogo(x, kind, cx, cy, r, fg, bg) {
  x.save(); x.translate(cx, cy); x.fillStyle = fg; x.strokeStyle = fg; x.lineWidth = r * .14; x.lineCap = 'round'; x.lineJoin = 'round';
  const circ = (rr, fill) => { x.beginPath(); x.arc(0, 0, rr, 0, Math.PI * 2); fill ? x.fill() : x.stroke(); };
  if (kind === 'x') { x.lineWidth = r * .32; x.beginPath(); x.moveTo(-r * .7, -r * .7); x.lineTo(r * .7, r * .7); x.moveTo(r * .7, -r * .7); x.lineTo(-r * .7, r * .7); x.stroke(); }
  else if (kind === 'sun') { const g = x.createRadialGradient(0, 0, 2, 0, 0, r); g.addColorStop(0, '#fff3a0'); g.addColorStop(1, '#ff6a10'); x.fillStyle = g; circ(r * .85, true); x.strokeStyle = bg; x.lineWidth = r * .22; x.beginPath(); x.moveTo(-r * .6, -r * .6); x.lineTo(r * .6, r * .6); x.moveTo(r * .6, -r * .6); x.lineTo(-r * .6, r * .6); x.stroke(); }
  else if (kind === 'k') { const g = x.createLinearGradient(-r, -r, r, r); g.addColorStop(0, '#ffe23a'); g.addColorStop(.5, '#ff7a1a'); g.addColorStop(1, '#ff2fa0'); x.strokeStyle = g; x.lineWidth = r * .25; x.beginPath(); x.moveTo(-r * .45, -r * .8); x.lineTo(-r * .45, r * .8); x.moveTo(r * .55, -r * .8); x.lineTo(-r * .1, 0); x.lineTo(r * .55, r * .8); x.stroke(); }
  else if (kind === 'bee') { x.beginPath(); x.ellipse(0, r * .1, r * .45, r * .7, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = bg; for (const yy of [-.15, .2]) x.fillRect(-r * .45, yy * r, r * .9, r * .14); x.strokeStyle = fg; x.lineWidth = r * .1; x.beginPath(); x.ellipse(-r * .55, -r * .35, r * .35, r * .2, -.5, 0, Math.PI * 2); x.ellipse(r * .55, -r * .35, r * .35, r * .2, .5, 0, Math.PI * 2); x.stroke(); }
  else if (kind === 'wave') { const g = x.createLinearGradient(-r, 0, r, 0); g.addColorStop(0, '#6a2ccf'); g.addColorStop(.5, '#e0309a'); g.addColorStop(1, '#e8283a'); x.strokeStyle = g; x.lineWidth = r * .22; for (let k = 0; k < 2; k++) { x.beginPath(); for (let i = 0; i <= 20; i++) { const t = i / 20; x.lineTo(-r + t * 2 * r, k * r * .4 - r * .1 + Math.sin(t * Math.PI * 2) * r * .3); } x.stroke(); } }
  else if (kind === 'star') { x.beginPath(); for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4, rr = i % 2 ? r * .28 : r; x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } x.closePath(); x.fill(); }
  else if (kind === 'crown') { x.beginPath(); x.moveTo(-r * .8, r * .5); x.lineTo(-r * .8, -r * .4); x.lineTo(-r * .4, 0); x.lineTo(0, -r * .7); x.lineTo(r * .4, 0); x.lineTo(r * .8, -r * .4); x.lineTo(r * .8, r * .5); x.closePath(); x.fill(); }
  else if (kind === 'sunsc') { circ(r * .5, true); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.beginPath(); x.moveTo(Math.cos(a) * r * .65, Math.sin(a) * r * .65); x.lineTo(Math.cos(a) * r * .95, Math.sin(a) * r * .95); x.stroke(); } }
  else if (kind === 'coco') { x.fillStyle = '#6b3e1f'; circ(r * .7, true); x.fillStyle = '#fbf6ea'; x.beginPath(); x.arc(0, -r * .05, r * .5, Math.PI * 1.05, Math.PI * 1.95); x.fill(); x.strokeStyle = fg; x.lineWidth = r * .1; x.beginPath(); x.moveTo(r * .15, -r * .4); x.lineTo(r * .55, -r * 1.0); x.stroke(); }
  else if (kind === 'bolt') { x.beginPath(); x.moveTo(r * .2, -r); x.lineTo(-r * .5, r * .1); x.lineTo(0, r * .1); x.lineTo(-r * .2, r); x.lineTo(r * .5, -r * .15); x.lineTo(0, -r * .15); x.closePath(); x.fill(); }
  else if (kind === 'drop') { x.beginPath(); x.moveTo(0, -r); x.bezierCurveTo(r * .8, -r * .1, r * .7, r * .8, 0, r * .8); x.bezierCurveTo(-r * .7, r * .8, -r * .8, -r * .1, 0, -r); x.fill(); }
  else if (kind === 'shades') { x.beginPath(); x.ellipse(-r * .45, 0, r * .4, r * .3, 0, 0, Math.PI * 2); x.ellipse(r * .45, 0, r * .4, r * .3, 0, 0, Math.PI * 2); x.fill(); x.fillRect(-r * .1, -r * .12, r * .2, r * .08); }
  else if (kind === 'shield') { x.beginPath(); x.moveTo(0, -r * .9); x.lineTo(r * .75, -r * .55); x.quadraticCurveTo(r * .7, r * .5, 0, r * .95); x.quadraticCurveTo(-r * .7, r * .5, -r * .75, -r * .55); x.closePath(); x.fill(); }
  else if (kind === 'signal') { for (let k = 1; k <= 3; k++) { x.beginPath(); x.arc(0, r * .5, r * .32 * k, -Math.PI * .8, -Math.PI * .2); x.stroke(); } circ(r * .1, true); }
  else if (kind === 'coin') { circ(r * .75, false); x.font = '900 ' + Math.round(r) + 'px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('$', 0, r * .05); }
  else if (kind === 'plane') { x.rotate(-.5); x.beginPath(); x.moveTo(r, 0); x.lineTo(-r * .8, -r * .15); x.lineTo(-r * .8, r * .15); x.closePath(); x.fill(); x.fillRect(-r * .2, -r * .7, r * .3, r * 1.4); x.fillRect(-r * .8, -r * .35, r * .18, r * .7); }
  else if (kind === 'mug') { x.fillRect(-r * .5, -r * .5, r * .8, r * 1.1); x.lineWidth = r * .14; x.beginPath(); x.arc(r * .35, r * .05, r * .28, -Math.PI / 2, Math.PI / 2); x.stroke(); x.fillStyle = '#ffffff'; x.beginPath(); x.arc(-r * .3, -r * .55, r * .22, 0, 7); x.arc(0, -r * .62, r * .25, 0, 7); x.arc(r * .2, -r * .55, r * .2, 0, 7); x.fill(); }
  else if (kind === 'palm') { x.fillRect(-r * .06, -r * .2, r * .12, r); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * .55; x.beginPath(); x.ellipse(Math.cos(a) * r * .45, -r * .2 + Math.sin(a) * r * .35, r * .45, r * .12, a, 0, Math.PI * 2); x.fill(); } }
  x.restore();
}
const AD_TEX = new Map();
function adTex(i, wide) {
  const k = i + (wide ? 'w' : ''); if (AD_TEX.has(k)) return AD_TEX.get(k);
  const [name, bg, fg, logo, tag, bg2] = ADS[i % ADS.length], W = wide ? 512 : 256, H = 128;
  const t = canvasTex(W, H, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, bg); g.addColorStop(1, bg2 || bg); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.globalAlpha = .08; x.fillStyle = fg; for (let i = -h; i < w; i += 22) { x.beginPath(); x.moveTo(i, h); x.lineTo(i + h * .6, 0); x.lineTo(i + h * .6 + 8, 0); x.lineTo(i + 8, h); x.fill(); } x.globalAlpha = 1; // listras finas no fundo
    const lr = wide ? 40 : 30, lx = wide ? 70 : 42; adLogo(x, logo, lx, h / 2 - (wide ? 0 : 6), lr, fg, bg);
    x.fillStyle = fg; x.textAlign = 'left'; x.textBaseline = 'middle'; const tx = lx + lr + 14, room = w - tx - 12;
    let fs = wide ? 50 : 34; x.font = 'italic 900 ' + fs + 'px Arial Black, Arial, sans-serif'; while (x.measureText(name).width > room && fs > 14) { fs -= 2; x.font = 'italic 900 ' + fs + 'px Arial Black, Arial, sans-serif'; }
    x.fillText(name, tx, h / 2 - 12);
    x.font = 'bold ' + (wide ? 18 : 13) + 'px Arial, sans-serif'; x.globalAlpha = .85; let tg = tag; while (x.measureText(tg).width > room && tg.length > 4) tg = tg.slice(0, -1); x.fillText(tg, tx + 2, h / 2 + 24); x.globalAlpha = 1;
    x.fillStyle = fg; x.fillRect(0, h - 8, w, 3);
  });
  AD_TEX.set(k, t); return t;
}
// placa de patrocínio em pé (frente para a quadra)
function adBoard(x, z, w, h, i, ry) {
  const t = adTex(i, w / h > 2.5), fm = mat('#ffffff', { map: t, emissive: col('#ffffff'), emissiveMap: t, emissiveIntensity: .2 }), dk = mat('#2b2f35');
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, .05), [dk, dk, dk, dk, fm, dk]); b.position.set(x, h / 2 + .02, z); b.rotation.y = ry || 0; ARENA.group.add(b);
}
// bandeira "pena" (feather flag) com a cor de uma marca
function featherFlag(x, z, i) {
  const [, bg] = ADS[i % ADS.length], g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 3.2, 6), mat('#d8dde2', { metalness: .5 })); pole.position.y = 1.6; g.add(pole);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(.7, 2.4), new THREE.MeshStandardMaterial({ map: adTex(i), color: col(bg), side: THREE.DoubleSide, roughness: .8 }));
  f.position.set(.36, 1.95, 0); f.rotation.z = -.04; g.add(f);
  g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z) + Math.PI / 2; ARENA.group.add(g);
}
// barraca (tenda com teto de lona, balcão com a marca e gente em volta)
function tentStall(x, z, i, spots) {
  const [, bg, fg] = ADS[i % ADS.length], g = new THREE.Group();
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.1, .9, 4, 1), new THREE.MeshStandardMaterial({ color: col(bg), roughness: .8 })); roof.rotation.y = Math.PI / 4; roof.position.y = 2.75; g.add(roof);
  const legM = mat('#cfd4da', { metalness: .4 });
  for (const [lx, lz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 2.3, 6), legM); l.position.set(lx, 1.15, lz); g.add(l); }
  const valance = new THREE.Mesh(new THREE.BoxGeometry(2.9, .28, 2.9), new THREE.MeshStandardMaterial({ color: col(fg), roughness: .8 })); valance.position.y = 2.2; g.add(valance);
  const t = adTex(i), cm = mat('#ffffff', { map: t }), wm = mat('#f4f1ea');
  const ct = new THREE.Mesh(new THREE.BoxGeometry(2.4, .95, .6), [wm, wm, wm, wm, cm, wm]); ct.position.set(0, .48, .9); g.add(ct);
  g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z) * .3 + (z > 0 ? Math.PI : 0); ARENA.group.add(g); // do lado da terra a barraca vira para a quadra
  const zs = z > 0 ? -1 : 1; for (let k = 0; k < 3; k++) spots.push([x + rand(-1.2, 1.2), z + zs * (1.9 + rand(0, 1))]);
}
// decoração dos torneios na praia: placas de patrocínio, bandeiras, barracas e um food truck
function beachDecor(a) {
  const hw = HALF_W.dupla, spots = [], ab = (x, z, w, h, i, ry) => adBoard(x, z, w, h, a.mi != null && i % 2 === 0 ? a.mi : i, ry);
  // placas baixas atrás do fundo do adversário e nas laterais (fora da área de jogo)
  for (let i = 0, x = -7.5; x <= 7.6; x += 2.5, i++) ab(x, -(C.halfL + 2.6), 2.3, .62, i);
  [-1, 1].forEach((sd, k) => { for (let i = 0, z = -C.halfL + 1; z <= 2; z += 3, i++) ab(sd * (hw + 1.9), z, 2.6, .55, i + 3 + k * 4, sd * -Math.PI / 2); });
  // bandeiras nas pontas
  [[-hw - 3, -C.halfL - 3.4], [hw + 3, -C.halfL - 3.4], [-hw - 3.6, 1.5], [hw + 3.6, 1.5]].forEach(([x, z], i) => featherFlag(x, z, i * 3 + 1));
  // atrás do seu fundo de quadra também (aparece depois da troca de lado): placas viradas para a quadra e barracas
  for (let i = 0, x = -7.5; x <= 7.6; x += 2.5, i++) ab(x, C.halfL + 2.6, 2.3, .62, i + 2, Math.PI);
  [-11, 11].forEach((x, i) => tentStall(x, C.halfL + 9.5, i * 3 + 1, spots));
  // vila de barracas ao fundo
  [-12, -6.5, 6.5, 12].forEach((x, i) => tentStall(x, -(C.halfL + 9.5) - (i % 2) * 1.5, i * 2 + (a.amateur ? 0 : 5), spots));
  // food truck
  const ft = new THREE.Group(), body = mat('#fbf6ea', { roughness: .5 }), trim = mat(ADS[(a.amateur ? 3 : 1)][1]);
  const bx = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.2, 2), body); bx.position.y = 1.5; ft.add(bx);
  const st = new THREE.Mesh(new THREE.BoxGeometry(4.22, .5, 2.02), trim); st.position.y = .7; ft.add(st);
  const win = new THREE.Mesh(new THREE.BoxGeometry(2.2, .8, .05), mat('#1b2a36')); win.position.set(-.3, 1.75, 1.01); ft.add(win);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, .45), new THREE.MeshBasicMaterial({ map: adTex(a.amateur ? 3 : 1, true) })); sign.position.set(-.3, 2.45, 1.02); ft.add(sign);
  [[-1.4, .95], [1.4, .95], [-1.4, -.95], [1.4, -.95]].forEach(([wx, wz]) => { const wh = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, .25, 14), mat('#1a1a1a')); wh.rotation.x = Math.PI / 2; wh.position.set(wx, .35, wz); ft.add(wh); });
  ft.position.set(0, 0, -(C.halfL + 12.5)); ARENA.group.add(ft);
  for (let k = 0; k < 5; k++) spots.push([rand(-1.6, 1.6), -(C.halfL + 10.8) + rand(0, .8)]);
  standingCrowd(spots);
}
function indoorHall(a) {
  if (LIGHT0.sun === null) { LIGHT0.sun = sun.intensity; LIGHT0.hemi = hemi.intensity; LIGHT0.hemiC = hemi.color.clone(); LIGHT0.hemiG = hemi.groundColor.clone(); }
  const on = !!a.indoor;
  sky.visible = !on; sea.visible = !on;
  if (on) PROPS.forEach(g => { g.visible = false; });
  sun.intensity = on ? LIGHT0.sun * .62 : LIGHT0.sun; hemi.intensity = on ? LIGHT0.hemi * 1.35 : LIGHT0.hemi;
  hemi.color.copy(on ? col('#f4f1ea') : LIGHT0.hemiC); hemi.groundColor.copy(on ? col('#cdbf9f') : LIGHT0.hemiG);
  if (!on) return;
  const HX = 20, Z0 = -26, Z1 = 32, H = 11, len = Z1 - Z0;
  // parede: faixa de baixo com as cores do evento, painéis claros com nervuras e uma fileira de janelas altas
  const wallTex = canvasTex(512, 256, (x, w, h) => {
    x.fillStyle = '#d9dde3'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 32) { x.fillStyle = 'rgba(0,0,0,.06)'; x.fillRect(i, 0, 3, h); }
    x.fillStyle = '#8fb7d6'; for (let i = 8; i < w; i += 64) x.fillRect(i, 26, 48, 22); // janelas altas
    x.fillStyle = a.board[0]; x.fillRect(0, h - 46, w, 46); x.fillStyle = a.board[1]; x.fillRect(0, h - 50, w, 5);
  });
  wallTex.wrapS = THREE.RepeatWrapping;
  const wall = (wd, rx, ry, px, pz, rep) => { const t = wallTex.clone(); t.needsUpdate = true; t.repeat.set(rep, 1); const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, H), new THREE.MeshStandardMaterial({ map: t, roughness: .9 })); m.rotation.set(rx, ry, 0); m.position.set(px, H / 2, pz); ARENA.group.add(m); };
  wall(len, 0, Math.PI / 2, -HX, (Z0 + Z1) / 2, 6); wall(len, 0, -Math.PI / 2, HX, (Z0 + Z1) / 2, 6);
  wall(HX * 2, 0, 0, 0, Z0, 4); wall(HX * 2, 0, Math.PI, 0, Z1, 4);
  // telhado (visto de baixo) com estrutura e luminárias
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(HX * 2, len), mat('#5b6470', { roughness: 1 })); roof.rotation.x = Math.PI / 2; roof.position.set(0, H, (Z0 + Z1) / 2); ARENA.group.add(roof);
  const beamM = mat('#3b424c', { roughness: .8 }), lampM = new THREE.MeshBasicMaterial({ color: col('#fffbea') });
  for (let z = Z0 + 4; z < Z1; z += 6) { const bm = new THREE.Mesh(new THREE.BoxGeometry(HX * 2, .35, .25), beamM); bm.position.set(0, H - .2, z); ARENA.group.add(bm); }
  for (let x = -12; x <= 12; x += 6) for (let z = -18; z <= 20; z += 6) { const l = new THREE.Mesh(new THREE.BoxGeometry(2.4, .08, .5), lampM); l.position.set(x, H - .45, z); ARENA.group.add(l); }
  // piso de cimento: corredores entre as quadras, nas laterais e a área de convivência no fundo (bar e mesas)
  const floorM = new THREE.MeshStandardMaterial({ color: col('#a3a7ab'), roughness: .95, polygonOffset: true, polygonOffsetFactor: -2 });
  const floor = (x0, x1, z0, z1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), floorM); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, .035, (z0 + z1) / 2); m.receiveShadow = true; ARENA.group.add(m); };
  const zb = -(C.halfL + 3.2);
  [-1, 1].forEach(sd => { floor(sd > 0 ? 5.6 : -8.4, sd > 0 ? 8.4 : -5.6, Z0, Z1); floor(sd > 0 ? 17.8 : -HX, sd > 0 ? HX : -17.8, Z0, Z1); });
  floor(-HX, HX, Z0, zb);
  // bar no fundo: balcão, prateleira com garrafas, letreiro e banquetas
  const bar = (bx, bz, ry = 0) => {
    const g = new THREE.Group(); g.position.set(bx, 0, bz); g.rotation.y = ry; ARENA.group.add(g);
    const wood = mat('#6b4a32', { roughness: .7 }), top = mat('#e9e4da', { roughness: .4 });
    const ct = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.05, .8), wood); ct.position.set(0, .52, 0); g.add(ct);
    const tp = new THREE.Mesh(new THREE.BoxGeometry(4.4, .06, 1), top); tp.position.set(0, 1.08, 0); g.add(tp);
    const sh = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.2, .35), mat('#3b2a1f')); sh.position.set(0, 1.1, 0 - 1.6); g.add(sh);
    const bc = ['#2e7d32', '#c62828', '#f9a825', '#1565c0', '#ffffff'];
    for (let r = 0; r < 2; r++) for (let i = 0; i < 12; i++) { const bt = new THREE.Mesh(new THREE.CylinderGeometry(.045, .05, .3, 6), mat(bc[(i + r) % bc.length], { roughness: .3 })); bt.position.set(0 - 1.9 + i * .34, 1.0 + r * .6, 0 - 1.38); g.add(bt); }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, .7), new THREE.MeshBasicMaterial({ map: canvasTex(256, 64, (x, w, h) => { x.fillStyle = a.board[0]; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.fillText('BEACH BAR', w / 2, 46); }) }));
    sign.position.set(0, 2.75, 0 - 1.4); g.add(sign);
    for (let i = 0; i < 5; i++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(.2, .14, .75, 10), mat('#2b2f35', { metalness: .4, roughness: .5 })); st.position.set(0 - 1.6 + i * .8, .38, 0 + .75); g.add(st); }
  };
  bar(-11, -22.5); bar(11, -22.5);
  // paredes com patrocínios, portas, banheiros, vestiário, saída de emergência, máquinas de bebida e placar
  for (let i = 0, z = -18; z <= 22; z += 7, i++) { [-1, 1].forEach(sd => { const t = adTex(i * 2 + (sd > 0 ? 1 : 0), true); const ad = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.15), mat('#ffffff', { map: t, emissive: col('#ffffff'), emissiveMap: t, emissiveIntensity: .15 })); ad.position.set(sd * (HX - .06), 3.4, z); ad.rotation.y = -sd * Math.PI / 2; ARENA.group.add(ad); }); }
  for (let i = 0, x = -16; x <= 16; x += 8, i++) { const t = adTex(i + 5, true); const ad = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.25), mat('#ffffff', { map: t, emissive: col('#ffffff'), emissiveMap: t, emissiveIntensity: .15 })); ad.position.set(x, 4.6, Z0 + .06); ARENA.group.add(ad); }
  const signTex = (txt, bg, fg, ic) => canvasTex(256, 64, (x, w, h) => { x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText((ic ? ic + ' ' : '') + txt, w / 2, h / 2 + 1); });
  const door = (x, z, ry, w, txt, bg, fg, ic) => {
    const g = new THREE.Group();
    const fr = new THREE.Mesh(new THREE.BoxGeometry(w + .16, 2.36, .08), mat('#8a9097')); fr.position.y = 1.18; g.add(fr);
    const dm = mat('#4a5560', { roughness: .6 }); const n = w > 1.4 ? 2 : 1;
    for (let k = 0; k < n; k++) { const d = new THREE.Mesh(new THREE.BoxGeometry(w / n - .04, 2.2, .1), dm); d.position.set(-w / 2 + w / n * (k + .5), 1.12, .03); g.add(d); const hd = new THREE.Mesh(new THREE.BoxGeometry(.04, .3, .06), mat('#d8dde2', { metalness: .6 })); hd.position.set(-w / 2 + w / n * (k + .5) + (n > 1 ? (k ? -1 : 1) * (w / n / 2 - .12) : w / 2 - .16), 1.1, .1); g.add(hd); }
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .3), new THREE.MeshBasicMaterial({ map: signTex(txt, bg, fg, ic) })); sg.position.set(0, 2.62, .06); g.add(sg);
    g.position.set(x, 0, z); g.rotation.y = ry; ARENA.group.add(g);
  };
  door(-4.5, Z0 + .05, 0, 2.2, 'ENTRADA', '#17324d', '#ffffff');
  door(4.5, Z0 + .05, 0, 1.0, 'SAÍDA', '#1b9e4b', '#ffffff', '🏃');
  door(-HX + .05, -12, Math.PI / 2, 1.0, 'BANHEIRO', '#2457c5', '#ffffff', '🚹');
  door(-HX + .05, -9.5, Math.PI / 2, 1.0, 'BANHEIRO', '#c2185b', '#ffffff', '🚺');
  door(HX - .05, -12, -Math.PI / 2, 1.0, 'VESTIÁRIO', '#3b424c', '#ffffff');
  door(HX - .05, -9.5, -Math.PI / 2, 1.0, 'SAÍDA', '#1b9e4b', '#ffffff', '🏃');
  for (const [vx, vc] of [[-16.5, '#c62828'], [-15.4, '#1565c0'], [16.5, '#2e7d32']]) { const vm = new THREE.Mesh(new THREE.BoxGeometry(.95, 1.9, .75), [mat('#2b2f35'), mat('#2b2f35'), mat('#2b2f35'), mat('#2b2f35'), mat(vc, { emissive: col(vc), emissiveIntensity: .35 }), mat('#2b2f35')]); vm.position.set(vx, .95, Z0 + .5); ARENA.group.add(vm); }
  const sbT = canvasTex(256, 96, (x, w, h) => { x.fillStyle = '#0b0f14'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffd23f'; x.font = 'bold 26px monospace'; x.textAlign = 'center'; x.fillText(a.text || 'ARENA', w / 2, 34); x.fillStyle = '#ff5a1f'; x.font = 'bold 34px monospace'; x.fillText('BEACH TENNIS', w / 2, 76); });
  const sb = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.9), new THREE.MeshBasicMaterial({ map: sbT })); sb.position.set(0, 7.4, Z0 + .07); ARENA.group.add(sb);
  // mesas altas com gente em volta (convivência), mais gente nos corredores olhando os jogos
  const tableM = mat('#f4f1ea', { roughness: .5 }), poleM = mat('#2b2f35', { metalness: .5, roughness: .4 }), spots = [];
  for (const [tx, tz] of [[-5, -16], [0, -17.5], [5, -16], [-4, -20.5], [4, -20.5], [0, -23]]) {
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 1.05, 8), poleM); pl.position.set(tx, .53, tz); ARENA.group.add(pl);
    const tt = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .05, 18), tableM); tt.position.set(tx, 1.07, tz); ARENA.group.add(tt);
    const k = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < k; i++) { const an = i / k * Math.PI * 2 + Math.random(); spots.push([tx + Math.cos(an) * .75, tz + Math.sin(an) * .75]); }
  }
  for (let i = 0; i < 7; i++) spots.push([-11 + rand(-2, 2), -21 + rand(0, .8)], [11 + rand(-2, 2), -21 + rand(0, .8)]); // fila no bar
  [-1, 1].forEach(sd => { for (let z = -18; z < 14; z += rand(1.5, 3.2)) if (Math.random() < .6) spots.push([sd * rand(18.3, 19.4), z]); });
  standingCrowd(spots);
  // fundo do outro lado (aparece depois da troca de lado): piso, arquibancada com torcida, telão e patrocínios na parede
  floor(-HX, HX, C.halfL + 3.2, Z1);
  crowd(bleachers(1, 0, C.halfL + 4.6, 14, 3, a.seat || a.board[0], 'x')); // arquibancada pequena atrás do fundo
  // área de convivência deste lado também: dois bares virados para a quadra, mesas altas e gente em volta
  bar(-12, Z1 - 4, Math.PI); bar(12, Z1 - 4, Math.PI);
  const sp2 = [];
  for (const [tx, tz] of [[-5, 21], [0, 22.5], [5, 21], [-4, 25.5], [4, 25.5]]) {
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 1.05, 8), poleM); pl.position.set(tx, .53, tz); ARENA.group.add(pl);
    const tt = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .05, 18), tableM); tt.position.set(tx, 1.07, tz); ARENA.group.add(tt);
    const k = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < k; i++) { const an = i / k * Math.PI * 2 + Math.random(); sp2.push([tx + Math.cos(an) * .75, tz + Math.sin(an) * .75]); }
  }
  for (let i = 0; i < 5; i++) sp2.push([-12 + rand(-2, 2), Z1 - 5.6 - rand(0, .8)], [12 + rand(-2, 2), Z1 - 5.6 - rand(0, .8)]); // fila nos bares
  standingCrowd(sp2);
  const sb2 = sb.clone(); sb2.position.set(0, 7.4, Z1 - .07); sb2.rotation.y = Math.PI; ARENA.group.add(sb2);
  for (let i = 0, x = -16; x <= 16; x += 8, i++) { const t = adTex(i + 2, true); const ad = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.25), mat('#ffffff', { map: t, emissive: col('#ffffff'), emissiveMap: t, emissiveIntensity: .15 })); ad.position.set(x, 4.6, Z1 - .06); ad.rotation.y = Math.PI; ARENA.group.add(ad); }
  door(-HX * .6, Z1 - .05, Math.PI, 2.2, 'ENTRADA', '#17324d', '#ffffff'); door(HX * .6, Z1 - .05, Math.PI, 1.0, 'SAÍDA', '#1b9e4b', '#ffffff', '🏃');
}
// confete do título: papéis coloridos caindo sobre a quadra
const CONF = { mesh: null, items: [], t: 0 };
function confMesh() {
  if (!CONF.mesh) {
    CONF.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(.09, .06), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), 360);
    CONF.mesh.frustumCulled = false; scene.add(CONF.mesh);
    const c = new THREE.Color(), cols = ['#ff5a1f', '#ffd23f', '#4fd18b', '#2457c5', '#fbf6ea', '#e2364a', '#7fd6db'];
    for (let i = 0; i < 360; i++) CONF.mesh.setColorAt(i, c.set(cols[i % cols.length]).convertSRGBToLinear());
    CONF.mesh.visible = false;
  }
}
function confetti() {
  confMesh();
  CONF.items = Array.from({ length: 360 }, () => ({ x: rand(-6, 6), y: rand(5, 11), z: rand(-6, 8), vx: rand(-.4, .4), vy: rand(-1.6, -.8), rx: rand(0, 6), ry: rand(0, 6), w: rand(3, 8) }));
  CONF.t = 7; CONF.mesh.visible = true;
}
function updateConfetti(dt) {
  if (!CONF.mesh || CONF.t <= 0) return;
  CONF.t -= dt; if (CONF.t <= 0) { CONF.mesh.visible = false; return; }
  CONF.items.forEach((o, i) => {
    o.x += (o.vx + Math.sin(o.rx) * .3) * dt; o.y = Math.max(.02, o.y + o.vy * dt); o.rx += o.w * dt; o.ry += o.w * .7 * dt;
    _cq.setFromEuler(new THREE.Euler(o.rx, o.ry, 0)); _cm.compose(_cp.set(o.x, o.y, o.z), _cq, _cs); CONF.mesh.setMatrixAt(i, _cm);
  });
  CONF.mesh.instanceMatrix.needsUpdate = true;
}
// torcida comemora depois do ponto
function cheerArena(k) { ARENA.cheerT = Math.max(ARENA.cheerT, k || 1.4); }
const _cm = new THREE.Matrix4(), _cp = new V3(), _cq = new THREE.Quaternion(), _cq2 = new THREE.Quaternion(), _cs = new V3(1, 1, 1), _upC = new V3(0, 1, 0), _fw = new V3();
function updateArena(dt) {
  updateConfetti(dt);
  updateSideGames(dt);
  if (!ARENA.crowd.length || ARENA.cheerT <= 0) return;
  ARENA.cheerT = Math.max(0, ARENA.cheerT - dt);
  const t = performance.now() / 1000, amp = Math.min(1, ARENA.cheerT) * .22;
  ARENA.crowd.forEach(cr => {
    cr.seats.forEach(([x, y, z, side, along], i) => {
      const j = Math.max(0, Math.sin(t * 9 + cr.ph[i])) * amp;
      if (cr.stand) { // em pé: pulinho curto (as pernas ficam)
        _cq.setFromAxisAngle(new V3(0, 1, 0), side); const jj = j * .35;
        _cm.compose(_cp.set(x, 1.1 + jj, z), _cq, _cs); cr.body.setMatrixAt(i, _cm);
        _cm.compose(_cp.set(x, 1.53 + jj, z), _cq, _cs); cr.head.setMatrixAt(i, _cm); return;
      }
      _cq.setFromAxisAngle(new V3(0, 1, 0), along === 'z' ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : (side > 0 ? Math.PI : 0));
      _cm.compose(_cp.set(x, y + .31 + j, z), _cq, _cs); cr.body.setMatrixAt(i, _cm);
      _cm.compose(_cp.set(x, y + .75 + j, z), _cq, _cs); cr.head.setMatrixAt(i, _cm);
    });
    cr.body.instanceMatrix.needsUpdate = true; cr.head.instanceMatrix.needsUpdate = true;
    if (cr.arms) crowdArms(cr, t, amp);
  });
}

// troca de lado: o ambiente gira em volta da quadra e o sol vai para o outro lado (o jogo continua com o seu time embaixo)
const SUN_BASE = SUN_DIR.clone();
function setSide(flip) {
  const k = flip ? -1 : 1; ENV.rotation.y = flip ? Math.PI : 0;
  SUN_DIR.set(SUN_BASE.x * k, SUN_BASE.y, SUN_BASE.z * k);
  seaMat.uniforms.zs.value = k;
}
export { sandH, ENV, setSide, setNetHeight, setZoneLine, confetti, applyArena, cheerArena, updateArena, linesGroup, seaMat, sky };
