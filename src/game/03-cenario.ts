// @ts-nocheck
// céu, mar, areia, quadra e cenário da praia
import './02-render';
import * as THREE from 'three';
import { C, HALF_W, SHORE_Z, V3, WATERLINE, ZONE3, clamp, fbm, rand, smooth } from './00-base';
import { HORIZON, MAX_ANISO, SUN_DIR, canvasTex, col, hemi, mat, renderer, scene, sun } from './02-render';
const PROPS = []; // guarda-sóis e palmeiras perto da quadra (somem quando há arquibancada)
// ---------- Céu procedural com nuvens e sol ----------
const SKY_VS = 'varying vec3 vDir; void main(){ vDir = position; vec4 w = modelMatrix*vec4(position,1.); gl_Position = projectionMatrix*viewMatrix*w; }';
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
sky.renderOrder = -10; sky.frustumCulled = false;
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
  uniforms: { time: { value: 0 }, sunDir: { value: SUN_DIR }, hor: { value: HORIZON }, shore: { value: WATERLINE } },
  vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
  fragmentShader: [
    'uniform float time; uniform vec3 sunDir; uniform vec3 hor; uniform float shore; varying vec3 vW;',
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
    ' float dist = shore - vW.z;',
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
sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.02, SHORE_Z + 4 - 1500); scene.add(sea);
// ---------- Areia ----------
function makeSandTextures(N) {
  const H = new Float32Array(N * N);
  const cA = document.createElement('canvas'); cA.width = cA.height = N;
  const cN = document.createElement('canvas'); cN.width = cN.height = N;
  const xa = cA.getContext('2d'), xn = cN.getContext('2d');
  const ia = xa.createImageData(N, N), inn = xn.createImageData(N, N);
  const P = 6;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N;
    const f = fbm(u * P, v * P, P, 4, 3);
    const rip = Math.sin(2 * Math.PI * (3 * u + 5 * v) + f * 7) * .5 + .5;
    const g = Math.random();
    H[y * N + x] = f * .8 + rip * .25 + g * .35;
    const i = (y * N + x) * 4;
    const k = .9 + (f - .5) * .35 + (g - .5) * .12;
    let r = 222 * k, gg = 197 * k, b = 150 * k;
    const sp = Math.random();
    if (sp < .012) { r *= .55; gg *= .5; b *= .45; }          // grãos escuros
    else if (sp < .03) { r = 250; gg = 244; b = 228; }        // grãos claros
    else if (sp < .034) { r *= 1.05; gg *= .8; b *= .7; }      // grãos avermelhados
    ia.data[i] = clamp(r, 0, 255); ia.data[i + 1] = clamp(gg, 0, 255); ia.data[i + 2] = clamp(b, 0, 255); ia.data[i + 3] = 255;
  }
  const str = 2.2;
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
const sand = new THREE.Mesh(sandGeo, sandMat);
sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0, 90);
sand.receiveShadow = true;
scene.add(sand);
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
  [ZONE3, -ZONE3].forEach(z => { const m = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 - .1, 0.006, .035), tapeFaint); m.position.set(0, 0.003, z); g.add(m); });
  [ZONE3, 5].forEach(d => [1, -1].forEach(sz => [1, -1].forEach(sx => { const m = new THREE.Mesh(new THREE.BoxGeometry(.32, 0.008, .05), tapeMat); m.position.set(sx * (hw + .16), 0.004, sz * d); g.add(m); })));
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .03, 8), mat('#f4f1ea')); p.position.set(a * hw, .015, b * C.halfL); g.add(p);
  });
  scene.add(g);
});
// Rede
const netTex = canvasTex(64, 64, (x, w, h) => {
  x.clearRect(0, 0, w, h); x.strokeStyle = 'rgba(6,9,12,1)'; x.lineWidth = 9; x.strokeRect(0, 0, w, h);
}, false);
netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping; netTex.repeat.set(C.netHalf * 2 / .045, 1 / .045);
const netMat = new THREE.MeshStandardMaterial({ color: col('#0e1216'), map: netTex, transparent: true, alphaTest: .12, side: THREE.DoubleSide, roughness: .9 });
const net = new THREE.Mesh(new THREE.PlaneGeometry(C.netHalf * 2, 1.0), netMat);
net.position.set(0, C.netH - .5, 0); scene.add(net);
const drawBand = c => (x, w, h) => { x.fillStyle = '#f6f4ee'; x.fillRect(0, 0, w, h); x.fillStyle = c; for (let i = 0; i < w; i += 64) x.fillRect(i, 0, 32, h); };
const bandTex = canvasTex(512, 16, drawBand('#1f4fb8'));
bandTex.wrapS = THREE.RepeatWrapping; bandTex.repeat.set(3, 1);
const band = new THREE.Mesh(new THREE.BoxGeometry(C.netHalf * 2, .07, .012), mat('#ffffff', { map: bandTex, roughness: .6 }));
band.position.set(0, C.netH - .035, 0); band.castShadow = true; scene.add(band);
const padMat = mat('#1f4fb8', { roughness: .7 });
const band2 = new THREE.Mesh(new THREE.BoxGeometry(C.netHalf * 2, .035, .01), mat('#1f4fb8'));
band2.position.set(0, C.netH - 1.0, 0); scene.add(band2);
// altura da rede da partida: 1,80 m no profissional masculino, 1,70 m no feminino, misto e amador
function setNetHeight(h) { C.netH = h; net.position.y = h - .5; band.position.y = h - .035; band2.position.y = h - 1.0; }
[-1, 1].forEach(s => {
  const px = s * (C.netHalf + .12);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.045, .05, 1.95, 16), mat('#e9edf0', { roughness: .25, metalness: .7 }));
  post.position.set(px, .975, 0); post.castShadow = true; scene.add(post);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, 1.4, 16), padMat);
  pad.position.set(px, .7, 0); pad.castShadow = true; scene.add(pad);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 8), mat('#d8dde0', { metalness: .7, roughness: .3 })); cap.position.set(px, 1.96, 0); scene.add(cap);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, 2.6, 4), mat('#e8e2d0'));
  rope.position.set(px + s * .65, .95, 0); rope.rotation.z = s * .62; scene.add(rope);
  const peg = new THREE.Mesh(new THREE.CylinderGeometry(.02, .03, .12, 6), mat('#6b4b2e')); peg.position.set(px + s * 1.3, .05, 0); scene.add(peg);
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
  g.position.set(x, -.05, z); g.rotation.y = Math.random() * Math.PI * 2; scene.add(g); PROPS.push(g);
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
  g.position.set(x, 0, z); g.rotation.y = rand(0, Math.PI * 2); scene.add(g); PROPS.push(g);
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
  g.position.set(-26, 0, -30); g.rotation.y = .4; scene.add(g);
}
// morros ao longe
{
  const hillMat = mat('#4b6b3e', { roughness: 1, flatShading: true });
  [[-520, -700, 160, 70], [-380, -820, 120, 45], [600, -900, 220, 90], [420, -760, 110, 40]].forEach(([x, z, r, h]) => {
    const geo = new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const pa = geo.attributes.position;
    for (let i = 0; i < pa.count; i++) { const y = pa.getY(i); const n = fbm(pa.getX(i) * .02 + 3, pa.getZ(i) * .02 + 3, 4096, 3, 5); pa.setY(i, y * (h / r) * (.7 + n * .6)); }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, hillMat); m.position.set(x, -2, z); scene.add(m);
  });
}

// ---------- Arenas: cores da quadra por local e arquibancadas conforme o tamanho do torneio ----------
// size 0 = praia aberta · 1 = arquibancada pequena num lado · 2 = dos dois lados com placas · 3 = estádio (lados + fundo)
const ARENA = { group: new THREE.Group(), key: '', crowd: [], cheerT: 0 };
scene.add(ARENA.group);
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
  ARENA.group.add(body, head);
  ARENA.crowd.push({ body, head, seats, ph: seats.map(() => Math.random() * 6) });
}
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
  sandMat.color.copy(col(a.sand));
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
  if (a.size === 0 && a.text) boards(0, -(C.halfL + 3.5), 8, 'x', a.board[0], a.board[1], a.text); // torneio local: uma faixa no fundo
  if (a.amateur) { // público em pé dos dois lados e no fundo, e duas quadras vizinhas com jogo
    const spots = [];
    // não fica perto da câmera (atrás da sua linha de fundo), só da metade da quadra para lá
    [-1, 1].forEach(sd => { for (let z = -C.halfL + .5; z < 3.5; z += rand(.6, 1.3)) if (Math.random() < .8) spots.push([sd * (HALF_W.dupla + rand(2, 3)), z]); });
    for (let x = -5; x <= 5; x += rand(.8, 1.5)) if (Math.random() < .6) spots.push([x, -(C.halfL + rand(4.2, 5.2))]);
    standingCrowd(spots);
    sideGames([-(HALF_W.dupla * 2 + 5), HALF_W.dupla * 2 + 5]);
  }
  if (a.size >= 2) { boards(-(W - .6), -1, L - 2, 'z', a.board[0], a.board[1], a.text); boards(W - .6, -1, L - 2, 'z', a.board[0], a.board[1], a.text); }
  if (a.size >= 3) boards(0, -(C.halfL + 4.4), 2 * W - 2.4, 'x', a.board[0], a.board[1], a.text);
  indoorHall(a);
  if (!a.indoor && (a.amateur || a.size >= 1)) beachDecor(a);
}
// ambiente fechado (points e arenas cobertas): paredes, telhado com fileiras de luz; sem céu, mar, palmeiras nem sol forte
const LIGHT0 = { sun: null, hemi: null, hemiC: null, hemiG: null };
// ---------- patrocínios e decoração dos eventos (marcas fictícias) ----------
const ADS = [['AREIA FINA', '#ffd23f', '#17324d'], ['SOLAR MAX', '#ff5a1f', '#ffffff'], ['MARAZUL SEGUROS', '#1f4fb8', '#ffffff'], ['COCO GELADO', '#2e9e57', '#ffffff'], ['ONDAS TELECOM', '#7b2ff7', '#ffffff'],
  ['BRISA ENERGÉTICO', '#e2364a', '#ffe14d'], ['DUNA ÓCULOS', '#111111', '#ffd23f'], ['LITORAL BANK', '#0b7a83', '#ffffff'], ['SALINA ISOTÔNICO', '#33c3ff', '#0b1d3f'], ['FAROL VIAGENS', '#ff8a00', '#17324d'], ['MARESIA RELÓGIOS', '#fbf6ea', '#17324d'], ['SOL & SAL', '#ffb3c1', '#7a1630']];
const AD_TEX = new Map();
function adTex(i, wide) {
  const k = i + (wide ? 'w' : ''); if (AD_TEX.has(k)) return AD_TEX.get(k);
  const [name, bg, fg] = ADS[i % ADS.length], W = wide ? 512 : 256, H = wide ? 128 : 128;
  const t = canvasTex(W, H, (x, w, h) => { x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.fillRect(0, h - 10, w, 4);
    x.font = 'bold ' + (wide ? 54 : Math.min(44, Math.floor(w / name.length * 1.7))) + 'px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(name, w / 2, h / 2 - 4); });
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
  g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z) * .3; ARENA.group.add(g);
  for (let k = 0; k < 3; k++) spots.push([x + rand(-1.2, 1.2), z + 1.9 + rand(0, 1)]);
}
// decoração dos torneios na praia: placas de patrocínio, bandeiras, barracas e um food truck
function beachDecor(a) {
  const hw = HALF_W.dupla, spots = [];
  // placas baixas atrás do fundo do adversário e nas laterais (fora da área de jogo)
  for (let i = 0, x = -7.5; x <= 7.6; x += 2.5, i++) adBoard(x, -(C.halfL + 2.6), 2.3, .62, i);
  [-1, 1].forEach((sd, k) => { for (let i = 0, z = -C.halfL + 1; z <= 2; z += 3, i++) adBoard(sd * (hw + 1.9), z, 2.6, .55, i + 3 + k * 4, sd * -Math.PI / 2); });
  // bandeiras nas pontas
  [[-hw - 3, -C.halfL - 3.4], [hw + 3, -C.halfL - 3.4], [-hw - 3.6, 1.5], [hw + 3.6, 1.5]].forEach(([x, z], i) => featherFlag(x, z, i * 3 + 1));
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
  const bar = (bx, bz) => {
    const wood = mat('#6b4a32', { roughness: .7 }), top = mat('#e9e4da', { roughness: .4 });
    const ct = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.05, .8), wood); ct.position.set(bx, .52, bz); ARENA.group.add(ct);
    const tp = new THREE.Mesh(new THREE.BoxGeometry(4.4, .06, 1), top); tp.position.set(bx, 1.08, bz); ARENA.group.add(tp);
    const sh = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.2, .35), mat('#3b2a1f')); sh.position.set(bx, 1.1, bz - 1.6); ARENA.group.add(sh);
    const bc = ['#2e7d32', '#c62828', '#f9a825', '#1565c0', '#ffffff'];
    for (let r = 0; r < 2; r++) for (let i = 0; i < 12; i++) { const bt = new THREE.Mesh(new THREE.CylinderGeometry(.045, .05, .3, 6), mat(bc[(i + r) % bc.length], { roughness: .3 })); bt.position.set(bx - 1.9 + i * .34, 1.0 + r * .6, bz - 1.38); ARENA.group.add(bt); }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, .7), new THREE.MeshBasicMaterial({ map: canvasTex(256, 64, (x, w, h) => { x.fillStyle = a.board[0]; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.fillText('BEACH BAR', w / 2, 46); }) }));
    sign.position.set(bx, 2.75, bz - 1.4); ARENA.group.add(sign);
    for (let i = 0; i < 5; i++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(.2, .14, .75, 10), mat('#2b2f35', { metalness: .4, roughness: .5 })); st.position.set(bx - 1.6 + i * .8, .38, bz + .75); ARENA.group.add(st); }
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
}
// confete do título: papéis coloridos caindo sobre a quadra
const CONF = { mesh: null, items: [], t: 0 };
function confetti() {
  if (!CONF.mesh) {
    CONF.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(.09, .06), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), 360);
    CONF.mesh.frustumCulled = false; scene.add(CONF.mesh);
    const c = new THREE.Color(), cols = ['#ff5a1f', '#ffd23f', '#4fd18b', '#2457c5', '#fbf6ea', '#e2364a', '#7fd6db'];
    for (let i = 0; i < 360; i++) CONF.mesh.setColorAt(i, c.set(cols[i % cols.length]).convertSRGBToLinear());
  }
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
const _cm = new THREE.Matrix4(), _cp = new V3(), _cq = new THREE.Quaternion(), _cs = new V3(1, 1, 1);
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
  });
}

export { setNetHeight, confetti, applyArena, cheerArena, updateArena, linesGroup, seaMat, sky };
