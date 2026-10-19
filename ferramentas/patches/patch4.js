const fs = require('fs');
const file = process.argv[2];
let s = fs.readFileSync(file, 'utf8');
function between(startMark, endMark, repl) {
  const a = s.indexOf(startMark); if (a < 0) throw new Error('start not found: ' + startMark);
  const b = s.indexOf(endMark, a + startMark.length); if (b < 0) throw new Error('end not found: ' + endMark);
  s = s.slice(0, a) + repl + s.slice(b);
}
function rep(a, b) { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 90)); s = s.replace(a, b); }

// scripts do carregador de modelos + marcador onde o build embute os GLB
rep('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>',
`<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js"></script>
<!--MODELS-->`);
rep('<div id="loading">Preparando a areia…</div>', '<div id="loading">Preparando a areia e os jogadores…</div>');

// menu: escolha da raquete
rep(`      <label class="chk"><input type="checkbox" id="assist" checked>`, `      <fieldset class="seg"><legend>Raquete</legend><div class="pills">
        <input type="radio" name="racket" id="rkMed" value="medusa"><label for="rkMed">Medusa</label>
        <input type="radio" name="racket" id="rkKro" value="kronos"><label for="rkKro">Kronos</label>
        <input type="radio" name="racket" id="rkPro" value="proteo" checked><label for="rkPro">Proteo</label>
        <input type="radio" name="racket" id="rkSup" value="supercarbon"><label for="rkSup">Supercarbon</label>
      </div></fieldset>
      <label class="chk"><input type="checkbox" id="assist" checked>`);
rep("settings: { mode: 'simples', cam: '3p', diff: 'medio', games: 4, assist: true, gfx: 'alto' },", "settings: { mode: 'simples', cam: '3p', diff: 'medio', games: 4, assist: true, gfx: 'alto', racket: 'proteo' },");
rep("S.settings.games = +v('len'); S.settings.gfx = v('gfx');", "S.settings.games = +v('len'); S.settings.gfx = v('gfx'); S.settings.racket = v('racket');");
rep("set('len', S.settings.games); set('gfx', S.settings.gfx);", "set('len', S.settings.games); set('gfx', S.settings.gfx); set('racket', S.settings.racket);");

// raquetes inspiradas nos modelos escolhidos
between('function makeRacket(color, accent) {', 'function headGeo(fem) {', `function carbonBase(x, w, h, base, alpha) {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  x.globalAlpha = alpha;
  for (let i = 0; i < w; i += 6) for (let j = 0; j < h; j += 6) { x.fillStyle = ((i + j) / 6) % 2 ? '#000' : '#fff'; x.fillRect(i, j, 6, 3); }
  x.globalAlpha = 1;
}
function triPath(x, cx, cy, sz) { x.beginPath(); x.moveTo(cx, cy - sz); x.lineTo(cx + sz * 1.08, cy + sz * .78); x.lineTo(cx - sz * 1.08, cy + sz * .78); x.closePath(); }
function zigzag(x, y, w, amp, n, color, lw) {
  x.strokeStyle = color; x.lineWidth = lw; x.lineJoin = 'miter'; x.beginPath();
  for (let i = 0; i <= n; i++) { const px = i * w / n, py = y + (i % 2 ? amp : -amp) * .5; i ? x.lineTo(px, py) : x.moveTo(px, py); }
  x.stroke();
}
function hatch(x, color, step, lw) { x.save(); x.clip(); x.strokeStyle = color; x.lineWidth = lw; for (let i = -300; i < 300; i += step) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 256, 256); x.stroke(); x.beginPath(); x.moveTo(i + 256, 0); x.lineTo(i, 256); x.stroke(); } x.restore(); }
function modelName(x, text, y, color, size) { x.fillStyle = color; x.font = 'bold ' + size + 'px Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, y); }
const RACKETS = {
  medusa: { edge: '#e7dcc6', grip: '#17181a', throat: '#e7dcc6', draw(x, w, h) {
    carbonBase(x, w, h, '#211c19', .09);
    const gr = x.createRadialGradient(w / 2, h * .42, 10, w / 2, h * .42, 150); gr.addColorStop(0, 'rgba(120,80,60,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#caa56b'; x.lineWidth = 2.5; for (let k = 0; k < 6; k++) { triPath(x, w / 2, h * .44, 22 + k * 13); x.stroke(); }
    x.strokeStyle = 'rgba(202,165,107,.55)'; x.lineWidth = 1.5; for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; x.beginPath(); x.moveTo(w / 2 + Math.cos(t) * 100, h * .44 + Math.sin(t) * 100); x.lineTo(w / 2 + Math.cos(t) * 118, h * .44 + Math.sin(t) * 118); x.stroke(); }
    x.fillStyle = '#e9dfca'; x.fillRect(0, h * .73, w, h * .27);
    zigzag(x, h * .745, w, 16, 16, '#b8915a', 4);
    modelName(x, 'MEDUSA', h * .86, '#8a6a3c', 17);
  } },
  kronos: { edge: '#3a2a1f', grip: '#121314', throat: '#2a1d16', draw(x, w, h) {
    carbonBase(x, w, h, '#2a1d16', .07);
    for (let i = 0; i < 260; i++) { x.fillStyle = 'rgba(226,131,46,' + rand(.15, .5) + ')'; x.fillRect(Math.random() * w, Math.random() * h * .7, 1.5, 1.5); }
    triPath(x, w / 2, h * .44, 78); x.fillStyle = '#6f6a65'; x.fill(); triPath(x, w / 2, h * .44, 78); hatch(x, 'rgba(30,30,30,.55)', 6, 1.2);
    triPath(x, w / 2, h * .48, 40); x.fillStyle = '#2a1d16'; x.fill();
    triPath(x, w / 2, h * .44, 78); x.strokeStyle = '#b9b3ac'; x.lineWidth = 3; x.stroke();
    x.fillStyle = '#1b130e'; x.fillRect(0, h * .72, w, h * .28);
    zigzag(x, h * .735, w, 18, 16, '#e2832e', 5);
    modelName(x, 'KRONOS', h * .85, '#d9d2c8', 15);
  } },
  proteo: { edge: '#0a1838', grip: '#121314', throat: '#0c1d45', draw(x, w, h) {
    const gr = x.createRadialGradient(w * .45, h * .35, 20, w / 2, h * .5, 190); gr.addColorStop(0, '#3c78e0'); gr.addColorStop(.6, '#1d4cb0'); gr.addColorStop(1, '#0b2462'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
    x.globalAlpha = .08; for (let i = 0; i < h; i += 3) { x.fillStyle = i % 6 ? '#fff' : '#000'; x.fillRect(0, i, w, 1); } x.globalAlpha = 1;
    triPath(x, w / 2, h * .42, 80); x.fillStyle = '#151a22'; x.fill(); triPath(x, w / 2, h * .42, 80); hatch(x, 'rgba(90,100,120,.5)', 7, 1);
    triPath(x, w / 2, h * .47, 40); x.fillStyle = '#1d4cb0'; x.fill();
    x.fillStyle = '#0d1a3c'; x.fillRect(0, h * .72, w, h * .28);
    zigzag(x, h * .735, w, 18, 14, '#f4f6f8', 4);
    modelName(x, 'PROTEO', h * .85, '#cfe0ff', 15);
  } },
  supercarbon: { edge: '#f4f5f6', grip: '#f2f2ef', throat: '#e9ecee', draw(x, w, h) {
    const gr = x.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#f5f6f7'); gr.addColorStop(1, '#c9ced3'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
    carbonBase(x, 0, 0, '#000', 0);
    const cx = w / 2, cy = h * .48;
    for (let k = 0; k < 5; k++) {
      x.strokeStyle = k % 2 ? '#1d6fd6' : '#22b3e6'; x.lineWidth = 9 - k;
      x.beginPath(); x.ellipse(cx, cy, 34 + k * 17, 22 + k * 11, -.35, Math.PI * (.9 + k * .1), Math.PI * (2.2 + k * .1)); x.stroke();
    }
    x.fillStyle = '#22b3e6'; x.beginPath(); x.ellipse(cx, cy, 26, 17, -.35, 0, Math.PI * 2); x.fill();
    for (let i = 0; i < 160; i++) { x.fillStyle = 'rgba(255,255,255,' + rand(.3, .9) + ')'; const a = Math.random() * Math.PI * 2, r = Math.random(); x.fillRect(cx + Math.cos(a) * 24 * r, cy + Math.sin(a) * 15 * r, 1.5, 1.5); }
    modelName(x, 'SUPERCARBON', h * .1, '#163a7a', 15);
  } },
};
const RACKET_MATS = {};
function racketMats(key) {
  if (RACKET_MATS[key]) return RACKET_MATS[key];
  const r = RACKETS[key];
  const t = canvasTex(256, 256, (x, w, h) => r.draw(x, w, h));
  t.repeat.set(1 / .27, 1 / .3); t.offset.set(.5, .5);
  return (RACKET_MATS[key] = {
    face: mat('#ffffff', { map: t, roughness: .32, metalness: .15, envMapIntensity: 1.2 }),
    edge: mat(r.edge, { roughness: .35, metalness: .1 }),
    grip: mat(r.grip, { roughness: .9 }),
    throat: mat(r.throat, { roughness: .35 }),
  });
}
function makeRacket(key) {
  const g = new THREE.Group();
  const face = new THREE.Mesh(RACKET_GEO, []); face.position.y = -.215 - .148; face.castShadow = true; g.add(face);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(.017, .019, .17, 12)); handle.position.y = -.085; g.add(handle);
  const butt = new THREE.Mesh(new THREE.CylinderGeometry(.021, .021, .015, 12), mat('#15181b')); g.add(butt);
  const throat = [-1, 1].map(sd => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.016, .09, .018));
    arm.position.set(sd * .03, -.19, 0); arm.rotation.z = sd * -.45; g.add(arm); return arm;
  });
  g.userData.setStyle = k => {
    const M = racketMats(RACKETS[k] ? k : 'proteo');
    face.material = [M.face, M.edge]; handle.material = M.grip; throat.forEach(a => { a.material = M.throat; });
  };
  g.userData.setStyle(key);
  return g;
}

`);
rep("  const racket = makeRacket(o.racket, o.trim); racket.position.y = .03; arms[1].wrist.add(racket);", "  const racket = makeRacket(o.racket); racket.position.y = .03; arms[1].wrist.add(racket);");
rep("  return { group: root, hips, spine, headG, legs, armR: arms[1], armL: arms[-1], blob, tail };", "  return { group: root, hips, spine, headG, legs, armR: arms[1], armL: arms[-1], blob, tail, racket };");
rep("  const r = makeRacket('#ff5a1f', '#fbf6ea'); r.position.y = -.45; fpArm.add(r);", "  fpRacket = makeRacket('proteo'); fpRacket.position.y = -.45; fpArm.add(fpRacket);");
rep("const fpArm = new THREE.Group();", "let fpRacket = null;\nconst fpArm = new THREE.Group();");
rep("racket: '#ff5a1f', num: '7', band: true }, true, 'Você');", "racket: 'proteo', num: '7', band: true }, true, 'Você');");
rep("racket: '#ffd23f', num: '11', fem: true, tank: true }, false, 'Parceira');", "racket: 'medusa', num: '11', fem: true, tank: true }, false, 'Parceira');");
rep("racket: '#0b7a83', num: '3', band: true }, false, 'CPU');", "racket: 'kronos', num: '3', band: true }, false, 'CPU');");
rep("racket: '#1f4fb8', num: '9', fem: true, tank: true }, false, 'CPU 2');", "racket: 'supercarbon', num: '9', fem: true, tank: true }, false, 'CPU 2');");

// ---------- modelos GLB ligados ao rig ----------
rep("let teams = [[human], [cpuA]];", `let teams = [[human], [cpuA]];

// ---------- Jogadores com modelo 3D (GLB) dirigidos pelo rig de animação ----------
const GLB = { male: null, female: null };
function b64Buf(id) {
  const n = document.getElementById(id); const txt = n && n.textContent ? n.textContent.trim() : '';
  if (!txt) return null;
  const bin = atob(txt); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
}
function loadModels() {
  return new Promise(resolve => {
    if (!THREE.GLTFLoader || !THREE.SkeletonUtils) return resolve(false);
    const loader = new THREE.GLTFLoader();
    const jobs = [['male', 'glb-male'], ['female', 'glb-female']].map(([k, id]) => new Promise(r => {
      let buf = null; try { buf = b64Buf(id); } catch (e) { buf = null; }
      if (!buf) return r();
      try { loader.parse(buf, '', g => { GLB[k] = g; r(); }, () => r()); } catch (e) { r(); }
    }));
    Promise.all(jobs).then(() => resolve(!!(GLB.male && GLB.female)));
    setTimeout(() => resolve(!!(GLB.male && GLB.female)), 15000);
  });
}
const ROT_BONES = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'RightShoulder'];
const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];
const CURL = { axis: new V3(1, 0, 0), angle: 1.1, q: new THREE.Quaternion() };
function attachSkin(p, gltf) {
  const root = THREE.SkeletonUtils.clone(gltf.scene);
  const holder = new THREE.Group(); holder.add(root); scene.add(holder);
  const B = {}, all = [];
  root.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (o.material) { o.material = o.material.clone(); o.material.envMapIntensity = .6; } }
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
  k.racket.traverse(m => { if (m.isMesh) m.castShadow = true; }); scene.add(k.racket);
  p.skin = k;
  p.model.group.traverse(o => { if (o.isMesh && o !== p.model.blob) o.visible = false; });
}
const _k1 = new V3(), _k2 = new V3(), _k3 = new V3(), _kS = new V3(), _kM = new V3(), _kE = new V3(), _kU = new V3(), _kT = new V3(), _kP = new V3(), _kJ = new V3();
const _ka = new V3(), _kb = new V3(), _kc = new V3(), _ke1 = new V3(), _ke2 = new V3(), _ke3 = new V3();
const _kq = new THREE.Quaternion(), _kq2 = new THREE.Quaternion(), _kq3 = new THREE.Quaternion(), _kD = new THREE.Quaternion(), _kH = new THREE.Quaternion(), _kN = new THREE.Quaternion();
const _kR = new THREE.Quaternion(), _kRi = new THREE.Quaternion(), _kI = new THREE.Quaternion();
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
function limbIK(upper, lower, end, rS, rM, rE, L1, L2, rigLen, scaleTarget, yOff) {
  rS.getWorldPosition(_kS); rM.getWorldPosition(_kM); rE.getWorldPosition(_kE);
  upper.getWorldPosition(_kU);
  if (scaleTarget) _kT.subVectors(_kE, _kS).multiplyScalar((L1 + L2) / rigLen).add(_kU); else _kT.copy(_kE);
  _kT.y += yOff || 0;
  _kP.addVectors(_kS, _kE).multiplyScalar(.5); _kP.subVectors(_kM, _kP);
  jointPos(_kU, _kT, _kP, L1, L2, _kJ);
  aimBone(upper, lower, _kJ);
  aimBone(lower, end, _kT);
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
  // quadril desce e desloca como no rig
  _k1.set(m.hips.position.x, m.hips.position.y - .92, m.hips.position.z).applyQuaternion(_kR);
  B.Hips.getWorldPosition(_k2).add(_k1); B.Hips.parent.worldToLocal(_k2); B.Hips.position.copy(_k2); B.Hips.updateMatrixWorld(true);
  const sq = m.spine.quaternion;
  const D = t => _kD.copy(_kI).slerp(sq, t);
  setDelta(B.Hips, k.restW.Hips, D(.25));
  setDelta(B.Spine, k.restW.Spine, D(.5));
  setDelta(B.Spine1, k.restW.Spine1, D(.78));
  setDelta(B.Spine2, k.restW.Spine2, D(1));
  setDelta(B.LeftShoulder, k.restW.LeftShoulder, D(1));
  setDelta(B.RightShoulder, k.restW.RightShoulder, D(1));
  _kH.copy(sq).multiply(m.headG.quaternion); _kN.copy(sq).slerp(_kH, .5);
  setDelta(B.Neck, k.restW.Neck, _kN); setDelta(B.Head, k.restW.Head, _kH);
  limbIK(B.RightArm, B.RightForeArm, B.RightHand, m.armR.sh, m.armR.el, m.armR.wrist, k.arm[0], k.arm[1], .555, true, 0);
  limbIK(B.LeftArm, B.LeftForeArm, B.LeftHand, m.armL.sh, m.armL.el, m.armL.wrist, k.armL[0], k.armL[1], .555, true, 0);
  limbIK(B.LeftUpLeg, B.LeftLeg, B.LeftFoot, m.legs[0].thigh, m.legs[0].knee, m.legs[0].ankle, k.leg[0], k.leg[1], .85, false, k.footH - .07);
  limbIK(B.RightUpLeg, B.RightLeg, B.RightFoot, m.legs[1].thigh, m.legs[1].knee, m.legs[1].ankle, k.leg[0], k.leg[1], .85, false, k.footH - .07);
  // pés planos na areia
  [['LeftFoot', 'LeftToeBase', k.toe.L], ['RightFoot', 'RightToeBase', k.toe.R]].forEach(([f, t, v]) => {
    if (!B[f] || !B[t]) return;
    B[f].getWorldPosition(_k3); _k1.copy(v).applyQuaternion(k.holder.quaternion).add(_k3); aimBone(B[f], B[t], _k1);
  });
  // mão direita segue o cabo da raquete e fecha os dedos
  m.racket.getWorldPosition(_k3); m.armR.wrist.getWorldPosition(_k2);
  m.racket.localToWorld(_k1.set(0, -.36, 0)).sub(_k3);
  if (B.RightHandMiddle1) { B.RightHand.getWorldPosition(_kU).addScaledVector(_k1, .3); aimBone(B.RightHand, B.RightHandMiddle1, _kU); }
  CURL.q.setFromAxisAngle(CURL.axis, CURL.angle);
  for (const f of FINGERS) for (let j = 1; j <= 3; j++) { const b = B['RightHand' + f + j]; if (b) b.quaternion.multiply(CURL.q); }
  B.RightHand.updateMatrixWorld(true);
  // raquete visível presa na mão do modelo
  m.racket.getWorldQuaternion(k.racket.quaternion);
  B.RightHand.getWorldPosition(_kU);
  k.racket.position.copy(_k3).add(_kU).sub(_k2);
}
function applyRackets() {
  const keys = Object.keys(RACKETS); const mine = RACKETS[S.settings.racket] ? S.settings.racket : 'proteo';
  const others = keys.filter(x => x !== mine);
  [[human, mine], [partner, others[0]], [cpuA, others[1]], [cpuB, others[2]]].forEach(([p, key]) => {
    p.look.racket = key; p.model.racket.userData.setStyle(key); if (p.skin) p.skin.racket.userData.setStyle(key);
  });
  if (fpRacket) fpRacket.userData.setStyle(mine);
}`);
rep("    team, slot, isHuman, name, pos: new V3(), vel: new V3(), model: makeAthlete(look),", "    team, slot, isHuman, name, look, skin: null, pos: new V3(), vel: new V3(), model: makeAthlete(look),");
rep("  m.blob.position.y = .012 - jy; const bs = 1 - jy; m.blob.scale.set(bs, bs, 1);\n}", "  m.blob.position.y = .012 - jy; const bs = 1 - jy; m.blob.scale.set(bs, bs, 1);\n  m.group.updateMatrixWorld(true);\n}");
rep("  for (const p of ALL) if (p.model.group.visible || p === human) animateAthlete(p, dt);", "  for (const p of ALL) if (p.model.group.visible || p === human) animateAthlete(p, dt);\n  for (const p of ALL) if (p.skin) driveSkin(p);");
rep("  applyCam(); applyGfx(); startSurf();\n  setupPoint();", "  applyCam(); applyGfx(); applyRackets(); startSurf();\n  setupPoint();");
rep(`  renderBoard();
  $('loading').hidden = true;
  window.__pdo = { S, ball, human, partner, cpuA, cpuB, renderer, ACT, SERVE_KEYS, READY };
  requestAnimationFrame(frame);`, `  renderBoard();
  window.__pdo = { S, ball, human, partner, cpuA, cpuB, renderer, ACT, SERVE_KEYS, READY, CURL, GLB };
  loadModels().then(ok => {
    if (ok) { try { attachSkin(human, GLB.male); attachSkin(cpuA, GLB.male); attachSkin(partner, GLB.female); attachSkin(cpuB, GLB.female); } catch (e) { console.warn('modelos 3D indisponíveis', e); } }
    applyRackets();
    $('loading').hidden = true;
    requestAnimationFrame(frame);
  });`);
fs.writeFileSync(file, s);
console.log('ok');
