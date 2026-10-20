// @ts-nocheck
// céu, mar, areia, quadra e cenário da praia
import './02-render';
import * as THREE from 'three';
import { C, HALF_W, SHORE_Z, V3, WATERLINE, ZONE3, clamp, fbm, rand, smooth } from './00-base';
import { HORIZON, MAX_ANISO, SUN_DIR, canvasTex, col, hemi, mat, renderer, scene } from './02-render';
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
    const d = Math.max(0, Math.max(Math.abs(x) - 11, Math.abs(wz) - 16));
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
function tape(group, w, l, x, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.008, l), tapeMat); m.position.set(x, 0.004, z); m.receiveShadow = true; group.add(m); }
Object.entries(HALF_W).forEach(([k, hw]) => {
  const g = linesGroup[k];
  tape(g, hw * 2 + .05, .05, 0, C.halfL); tape(g, hw * 2 + .05, .05, 0, -C.halfL);
  tape(g, .05, C.halfL * 2 + .05, hw, 0); tape(g, .05, C.halfL * 2 + .05, -hw, 0);
  tape(g, hw * 2 + .05, .05, 0, ZONE3); tape(g, hw * 2 + .05, .05, 0, -ZONE3);
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .03, 8), mat('#f4f1ea')); p.position.set(a * hw, .015, b * C.halfL); g.add(p);
  });
  scene.add(g);
});
// Rede
const netTex = canvasTex(64, 64, (x, w, h) => {
  x.clearRect(0, 0, w, h); x.strokeStyle = 'rgba(12,18,24,1)'; x.lineWidth = 5; x.strokeRect(0, 0, w, h);
}, false);
netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping; netTex.repeat.set(C.netHalf * 2 / .045, 1 / .045);
const netMat = new THREE.MeshStandardMaterial({ color: col('#20262c'), map: netTex, transparent: true, alphaTest: .3, side: THREE.DoubleSide, roughness: .9 });
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
function applyArena(a) {
  a = Object.assign({ size: 0, line: '#1f4fb8', trim: '#1f4fb8', sand: '#ffffff', seat: '#2457c5', board: ['#0b1d3f', '#33c3ff'], text: 'ITF-BT PRO 2026' }, a || {});
  const key = JSON.stringify(a); if (key === ARENA.key) return; ARENA.key = key;
  tapeMat.color.copy(col(a.line)); padMat.color.copy(col(a.trim)); band2.material.color.copy(col(a.trim));
  const bc = bandTex.image.getContext('2d'); drawBand(a.trim)(bc, bandTex.image.width, bandTex.image.height); bandTex.needsUpdate = true;
  sandMat.color.copy(col(a.sand));
  // arquibancadas
  ARENA.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  ARENA.group.clear(); ARENA.crowd = [];
  PROPS.forEach(g => { g.visible = !(a.size > 0 && Math.abs(g.position.x) < 15 && g.position.z > -22 && g.position.z < 16); });
  const L = C.halfL * 2 + 4, W = 7.8;
  let seats = [];
  if (a.size >= 1) seats = seats.concat(bleachers(-1, -W, -1, L * (a.size >= 2 ? 1 : .7), a.size >= 3 ? 8 : a.size >= 2 ? 5 : 3, a.seat, 'z'));
  if (a.size >= 2) seats = seats.concat(bleachers(1, W, -1, L, a.size >= 3 ? 8 : 5, a.seat, 'z'));
  if (a.size >= 3) seats = seats.concat(bleachers(-1, 0, -(C.halfL + 5.5), 2 * W - 1, 6, a.seat, 'x'));
  crowd(seats);
  if (a.size === 0 && a.text) boards(0, -(C.halfL + 3.5), 8, 'x', a.board[0], a.board[1], a.text); // torneio local: uma faixa no fundo
  if (a.size >= 2) { boards(-(W - .6), -1, L - 2, 'z', a.board[0], a.board[1], a.text); boards(W - .6, -1, L - 2, 'z', a.board[0], a.board[1], a.text); }
  if (a.size >= 3) boards(0, -(C.halfL + 4.4), 2 * W - 2.4, 'x', a.board[0], a.board[1], a.text);
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
  if (!ARENA.crowd.length || ARENA.cheerT <= 0) return;
  ARENA.cheerT = Math.max(0, ARENA.cheerT - dt);
  const t = performance.now() / 1000, amp = Math.min(1, ARENA.cheerT) * .22;
  ARENA.crowd.forEach(cr => {
    cr.seats.forEach(([x, y, z, side, along], i) => {
      const j = Math.max(0, Math.sin(t * 9 + cr.ph[i])) * amp;
      _cq.setFromAxisAngle(new V3(0, 1, 0), along === 'z' ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : (side > 0 ? Math.PI : 0));
      _cm.compose(_cp.set(x, y + .31 + j, z), _cq, _cs); cr.body.setMatrixAt(i, _cm);
      _cm.compose(_cp.set(x, y + .75 + j, z), _cq, _cs); cr.head.setMatrixAt(i, _cm);
    });
    cr.body.instanceMatrix.needsUpdate = true; cr.head.instanceMatrix.needsUpdate = true;
  });
}

export { setNetHeight, confetti, applyArena, cheerArena, updateArena, linesGroup, seaMat, sky };
