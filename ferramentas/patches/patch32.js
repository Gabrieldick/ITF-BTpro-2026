const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };

// ---------- recebedores esperam o saque na linha dos 3 m ----------
rep("    const r = teams[1 - S.server][0]; r.pos.set(0, 0, 5.8 * sgn(r.team));", "    const r = teams[1 - S.server][0]; r.pos.set(0, 0, (ZONE3 + .3) * sgn(r.team));");
rep("      else p.pos.set(p.slot * 1.9, 0, 5.6 * s);", "      else p.pos.set(p.slot * 1.9, 0, (ZONE3 + .3) * s);");

// ---------- velocidades mais realistas, com mais inércia ----------
rep("const P_SPEED = 5.4;", "const P_SPEED = 4.5;");
rep("  const k = Math.min(1, dt * 11);\n  p.vel.x += (tvx - p.vel.x) * k;", "  const k = Math.min(1, dt * 7);\n  p.vel.x += (tvx - p.vel.x) * k;");
rep("  const k = Math.min(1, dt * 10);\n  p.vel.x += (vx - p.vel.x) * k;", "  const k = Math.min(1, dt * 7);\n  p.vel.x += (vx - p.vel.x) * k;");
rep("    speed: (3.4 + a.vel * .027) * dm,", "    speed: (2.9 + a.vel * .022) * dm,");
rep("  facil:   { speed: 4.0,", "  facil:   { speed: 3.4,");
rep("  medio:   { speed: 4.9,", "  medio:   { speed: 4.1,");
rep("  dificil: { speed: 5.7,", "  dificil: { speed: 4.8,");

// ---------- corpo contínuo (skinning) ----------
// pernas: só os ossos; a pele vem depois
rep(`  const thighG = latheGeo(fem ? [[0, .06], [.088, .02], [.088, -.06], [.078, -.18], [.064, -.3], [.052, -.4], [0, -.45]] : [[0, .06], [.08, .02], [.083, -.06], [.077, -.18], [.066, -.3], [.054, -.4], [0, -.45]], 16, .95);
  const shinG = latheGeo([[0, .04], [.05, 0], [.056, -.08], [.054, -.15], [.044, -.25], [.033, -.36], [.029, -.42], [0, -.45]], 14, 1);
  shinG.translate(0, 0, .008); if (fem) shinG.scale(.92, 1, .92);
  const legShortG = latheGeo([[0, .03], [.093, .03], [.097, -.07], [.1, -.16], [0, -.16]], 16, 1);
  const legs = [];
  [-1, 1].forEach(s => {
    const thigh = new THREE.Group(); thigh.position.set(s * hipX, -.03, 0); hips.add(thigh);
    mesh(thighG, skinM, thigh); mesh(legShortG, shortM, thigh);
    const knee = new THREE.Group(); knee.position.y = -.42; thigh.add(knee);
    mesh(shinG, skinM, knee);
    const ankle = new THREE.Group(); ankle.position.y = -.43; knee.add(ankle);
    mesh(new THREE.SphereGeometry(.04, 12, 8), skinM, ankle, 0, -.035, .02).scale.set(1, .8, 1.1);
    mesh(new THREE.SphereGeometry(.045, 14, 8), skinM, ankle, 0, -.045, -.07).scale.set(.95, .55, 2.0);
    mesh(new THREE.SphereGeometry(.034, 10, 6), skinM, ankle, 0, -.052, -.16).scale.set(1.15, .5, .8);
    legs.push({ thigh, knee, ankle });
  });`, `  const BF = { compacto: [1.06, 1.08], forte: [1.12, 1.12], esguio: [.92, .87], atletico: [1, 1] }[o.build] || [1, 1];
  const legs = [];
  const footG = FOOT_GEO[fem ? 1 : 0];
  [-1, 1].forEach(s => {
    const thigh = new THREE.Group(); thigh.position.set(s * hipX, -.03, 0); hips.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -.42; thigh.add(knee);
    const ankle = new THREE.Group(); ankle.position.y = -.43; knee.add(ankle);
    mesh(footG, skinM, ankle).scale.x = s; // pé com arco, calcanhar e dedos
    legs.push({ thigh, knee, ankle });
  });`);
// tronco: só o grupo; camisa, ombros e pescoço viram pele contínua
rep(`  mesh(latheGeo(torsoProf, 28, .62), shirtM, spine);
  const shX = fem ? .182 : .205;
  mesh(new THREE.SphereGeometry(1, 18, 10), shirtM, spine, 0, .5, .01).scale.set(shX * .85, .055, .095);
  [-1, 1].forEach(s => mesh(new THREE.SphereGeometry(fem ? .054 : .064, 14, 10), o.tank ? skinM : shirtM, spine, s * shX, .47, 0).scale.set(1, 1.05, .95));
  mesh(new THREE.CylinderGeometry(fem ? .042 : .048, fem ? .05 : .058, .12, 12), skinM, spine, 0, .58, 0);`,
`  const shX = (fem ? .182 : .205) * BF[0];`);
// braços: ossos + mão fechada na empunhadura
rep(`  const upG = latheGeo(fem ? scaleProf(UP_ARM, .86) : UP_ARM, 14, .92), foreG = latheGeo(fem ? scaleProf(FORE_ARM, .88) : FORE_ARM, 14, .9);
  const sleeveG = latheGeo([[0, .07], [.064, .05], [.066, -.03], [.062, -.11], [0, -.11]], 14, 1);
  [-1, 1].forEach(s => {
    const sh = new THREE.Group(); sh.position.set(s * shX, .47, 0); spine.add(sh);
    mesh(upG, skinM, sh); if (!o.tank) mesh(sleeveG, shirtM, sh);
    const el = new THREE.Group(); el.position.y = -.285; sh.add(el);
    mesh(foreG, skinM, el);
    if (o.band && s > 0) mesh(new THREE.CylinderGeometry(.032, .032, .045, 12), trimM, el, 0, -.23, 0);
    const wrist = new THREE.Group(); wrist.position.y = -.27; el.add(wrist);
    mesh(new THREE.SphereGeometry(.042, 12, 8), skinM, wrist, 0, -.03, 0).scale.set(.72, 1.05, .62);
    arms[s] = { sh, el, wrist };
  });`, `  [-1, 1].forEach(s => {
    const sh = new THREE.Group(); sh.position.set(s * shX, .47, 0); spine.add(sh);
    const el = new THREE.Group(); el.position.y = -.285; sh.add(el);
    if (o.band && s > 0) mesh(new THREE.CylinderGeometry(.031, .029, .045, 14), trimM, el, 0, -.235, 0);
    const wrist = new THREE.Group(); wrist.position.y = -.27; el.add(wrist);
    const hand = mesh(HAND_GEO[fem ? 1 : 0], skinM, wrist); hand.scale.x = s;
    mesh(THUMB_GEO, skinM, wrist, s * -.012, -.022, -.024).rotation.set(-.5, 0, s * .5);
    arms[s] = { sh, el, wrist };
  });`);
rep(`  const BF = { compacto: [1.06, 1.08], forte: [1.12, 1.12], esguio: [.92, .87], atletico: [1, 1] }[o.build] || [1, 1];
  if (BF[0] !== 1 || BF[1] !== 1) {
    spine.children.forEach(c => { if (c.isMesh) { c.scale.x *= BF[0]; c.scale.z *= 1 + (BF[0] - 1) * .6; c.position.x *= BF[0]; } });
    [arms[1].sh, arms[-1].sh].forEach(sh => { sh.position.x *= BF[0]; });
    const thick = g => g.children.forEach(c => { if (c.isMesh) { c.scale.x *= BF[1]; c.scale.z *= BF[1]; } });
    legs.forEach(L => { thick(L.thigh); thick(L.knee); });
    [arms[1], arms[-1]].forEach(A => { thick(A.sh); thick(A.el); });
  }
  scene.add(root);
  return { group: root, hips, spine, headG, legs, armR: arms[1], armL: arms[-1], blob, tail, racket };`,
`  const fpHide = buildBodySkin(root, { hips, spine, headG, legs, arms }, o, fem, BF, torsoProf, { skinM, shirtM, shortM });
  scene.add(root);
  return { group: root, hips, spine, headG, legs, armR: arms[1], armL: arms[-1], blob, tail, racket, fpHide };`);

// geometrias e montagem da pele
rep("function makeAthlete(o) {", `// pé: calcanhar arredondado, arco, peito do pé alto perto do tornozelo e dedos achatados
const FOOT_GEO = [1, .9].map(k => {
  const g = new THREE.SphereGeometry(1, 22, 14), pa = g.attributes.position;
  for (let i = 0; i < pa.count; i++) {
    const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
    const t = (1 - z) / 2; // 0 calcanhar, 1 dedos
    const w = (.03 + .016 * smooth(0, .68, t) - .01 * smooth(.86, 1, t)) * k;
    const top = (.056 - .036 * smooth(.25, .95, t)) * k;
    const yy = y >= 0 ? y * top : y * .014;
    const arch = y < 0 && x * (1) < 0 ? 0 : 0;
    pa.setXYZ(i, x * w + .004 * smooth(.3, 1, t), -.028 + yy + arch, lerp(.058, -.19, t) * k);
  }
  g.computeVertexNormals(); return g;
});
// mão fechada em volta do cabo (o cabo passa pelo eixo y do punho)
const HAND_GEO = [1, .9].map(k => {
  const g = new THREE.LatheGeometry([[0, -.094], [.026, -.088], [.03, -.07], [.031, -.04], [.03, -.012], [.024, .006], [0, .012]].map(([r, y]) => new THREE.Vector2(r * k, y * k)), 16);
  const pa = g.attributes.position;
  for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), z = pa.getZ(i); pa.setX(i, x * (x > 0 ? .78 : 1.05)); pa.setZ(i, z * (z < 0 ? 1.12 : .82) + (z < 0 ? -.004 : 0)); }
  g.computeVertexNormals(); return g;
});
const THUMB_GEO = (() => { const g = new THREE.CylinderGeometry(.011, .013, .05, 10); g.translate(0, -.025, 0); return g; })();
function smooth(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

// tubos de pele presos a vários ossos: os anéis perto de cada junta misturam os dois ossos vizinhos,
// então cotovelo, joelho, ombro e cintura dobram sem emenda
function skinTubeGeo(parts, seg) {
  const pos = [], uv = [], si = [], sw = [], idx = [];
  const v = new V3(), a = new V3(), b = new V3(), n = new V3();
  const tri = (i0, i1, i2, dx, dy, dz) => {
    v.fromArray(pos, i0 * 3); a.fromArray(pos, i1 * 3).sub(v); b.fromArray(pos, i2 * 3).sub(v); n.crossVectors(a, b);
    if (n.x * dx + n.y * dy + n.z * dz < 0) idx.push(i0, i2, i1); else idx.push(i0, i1, i2);
  };
  const seams = [];
  for (const P of parts) {
    const R = P.rings, base = pos.length / 3, y0 = R[0].y, y1 = R[R.length - 1].y;
    R.forEach(r => {
      seams.push([pos.length / 3, pos.length / 3 + seg]);
      for (let j = 0; j <= seg; j++) {
        const an = j / seg * Math.PI * 2;
        pos.push(P.x + r.cx + Math.sin(an) * r.rx, r.y, P.z + r.cz + Math.cos(an) * r.rz);
        uv.push(j / seg, (r.y - Math.min(y0, y1)) / (Math.abs(y1 - y0) || 1));
        si.push(r.b0, r.b1, 0, 0); sw.push(1 - r.t, r.t, 0, 0);
      }
    });
    for (let i = 0; i < R.length - 1; i++) for (let j = 0; j < seg; j++) {
      const q = base + i * (seg + 1) + j, w = q + seg + 1;
      const r = R[i], cx = P.x + r.cx, cz = P.z + r.cz, an = (j + .5) / seg * Math.PI * 2;
      tri(q, w, q + 1, Math.sin(an), 0, Math.cos(an)); tri(w, w + 1, q + 1, Math.sin(an), 0, Math.cos(an));
    }
    [[0, y0 > y1 ? 1 : -1], [R.length - 1, y0 > y1 ? -1 : 1]].forEach(([ri, dir]) => {
      if (P.open && P.open.includes(ri)) return;
      const r = R[ri], c = pos.length / 3;
      pos.push(P.x + r.cx, r.y + dir * r.rx * .25, P.z + r.cz); uv.push(.5, ri ? 1 : 0); si.push(r.b0, r.b1, 0, 0); sw.push(1 - r.t, r.t, 0, 0);
      for (let j = 0; j < seg; j++) { const q = base + ri * (seg + 1) + j; tri(c, q, q + 1, 0, dir, 0); }
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx); g.computeVertexNormals();
  const nr = g.attributes.normal;
  for (const [i, k] of seams) { n.set(nr.getX(i) + nr.getX(k), nr.getY(i) + nr.getY(k), nr.getZ(i) + nr.getZ(k)).normalize(); nr.setXYZ(i, n.x, n.y, n.z); nr.setXYZ(k, n.x, n.y, n.z); }
  return g;
}
// anéis de um membro: [y, raio, deslocamento à frente/atrás, deslocamento lateral, peso forçado do osso de baixo]
// chain: ossos de cima para baixo com a altura da junta e a largura da mistura
function chainRings(list, chain, kx, kz) {
  return list.map(([y, r, cz, cx, force]) => {
    let best = 1, bd = 1e9;
    for (let k = 1; k < chain.length; k++) { const d = Math.abs(y - chain[k][1]); if (d < bd) { bd = d; best = k; } }
    const [, J, band] = chain[best];
    let t = force != null ? force : smooth(0, 1, (band - (y - J)) / (2 * band));
    const kxx = typeof kx === 'function' ? kx(y) : kx, kzz = typeof kz === 'function' ? kz(y) : kz;
    return { y, rx: r * kxx, rz: r * kzz, cx: cx || 0, cz: cz || 0, b0: chain[best - 1][0], b1: chain[best][0], t };
  });
}
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
    const thighK = fem ? 1.05 : 1, calfK = fem ? .9 : 1;
    const LEG = [[H + .1, .06], [H + .06, .084], [H, .091], [H - .07, .09 * thighK, -.004], [H - .15, .085 * thighK, -.008], [H - .24, .077 * thighK, -.008], [H - .32, .066, -.004],
      [kn + .04, .056], [kn, .05, -.004], [kn - .04, .049, .002], [kn - .09, .053 * calfK, .01], [kn - .14, .057 * calfK, .014], [kn - .2, .053 * calfK, .011], [kn - .27, .043, .006],
      [an + .33 - .2, .034, .002], [an + .05, .029], [an + .01, .029, .004], [an - .03, .027, .006]];
    parts.skin.push({ x: hp.x, z: hp.z, rings: chainRings(LEG.map(([y, r, cz]) => [y, r * fl * th, cz || 0]), chain, y => y > kn ? .96 : .92, y => y > kn ? 1.04 : 1.06) });
    const SH = [[H + .11, .095], [H + .06, .1], [H, .103], [H - .08, .106], [H - (fem ? .1 : .145), .107], [H - (fem ? .11 : .155), .104]];
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
      const SL = [[Y + .075, .03, 0, -s * .026, .28], [Y + .05, .054, 0, -s * .014, .48], [Y + .02, .066, 0, -s * .004, .72], [Y - .01, .068, 0, 0, .9], [Y - .06, .066], [Y - .1, .064], [Y - .11, .06]];
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
  const skinS = skinMat(M.skinM), shirtS = skinMat(M.shirtM), shortS = skinMat(M.shortM);
  add(parts.skin, skinS, 18); add(parts.shorts, shortS, 22);
  hide.push(add(parts.up, o.tank ? skinS : skinS, 18), add(parts.sleeve, shirtS, 18), add(parts.shirt, shirtS, 30), add(parts.neck, skinS, 16));
  return hide.filter(Boolean);
}
function makeAthlete(o) {`);

// 1ª pessoa: esconde a cabeça, o tronco e o braço de cima (pele contínua)
rep(`  m.spine.children.forEach(o => { if (o.isMesh) o.visible = !on; });
  // braço de cima some (passaria colado no olho); antebraço, mão e raquete continuam
  [m.armR.sh, m.armL.sh].forEach(sh => sh.children.forEach(o => { if (o.isMesh) o.visible = !on; }));`,
`  // tronco, pescoço e braço de cima somem (passariam colados no olho); antebraço, mão e raquete continuam
  (m.fpHide || []).forEach(o => { o.visible = !on; });`);

// ---------- movimento mais fluido ----------
rep("  const m = p.model, pose = p.pose;\n  const sp = Math.hypot(p.vel.x, p.vel.z), run = clamp(sp / 5, 0, 1);",
    "  const m = p.model; let pose = p.poseT || (p.poseT = newPose());\n  const sp = Math.hypot(p.vel.x, p.vel.z), run = clamp(sp / 4.2, 0, 1);");
rep("  if (mirror) mirrorPose(pose);\n  // tronco e quadril", `  if (mirror) mirrorPose(pose);
  // a postura real persegue a postura-alvo: sem estalos ao começar, trocar de lado ou terminar um golpe
  const acting = swingU >= 0 || p.charging || (S.mode === 'toss' && S.serverPlayer === p);
  blendPose(p.pose, pose, p.debug ? 1 : 1 - Math.exp(-dt * (acting ? 30 : 10)));
  pose = p.pose;
  p.breath = (p.breath || Math.random() * 6) + dt;
  // tronco e quadril`);
rep("  m.spine.rotation.set(-(pose.lean + run * .1), pose.tw, -pose.bend);",
    `  const idle = (1 - run) * (acting ? 0 : 1);
  m.hips.rotation.set(0, Math.sin(p.gait) * .11 * run, Math.cos(p.gait) * .035 * run);
  m.spine.rotation.set(-(pose.lean + run * .1) + Math.sin(p.breath * 1.9) * .012 * idle, pose.tw - Math.sin(p.gait) * .16 * run, -pose.bend - Math.cos(p.gait) * .03 * run);
  _hq.copy(m.hips.quaternion).invert();`);
rep("    _a.set(fx - m.hips.position.x, fy - m.hips.position.y, fz - m.hips.position.z);\n    _b.set(s * .12, 0, -1);",
    "    _a.set(fx - m.hips.position.x, fy - m.hips.position.y, fz - m.hips.position.z).applyQuaternion(_hq);\n    _b.set(s * .12, 0, -1).applyQuaternion(_hq);");
rep("    _q1.copy(L.thigh.quaternion).multiply(L.knee.quaternion).invert();",
    "    _q1.copy(m.hips.quaternion).multiply(L.thigh.quaternion).multiply(L.knee.quaternion).invert();");
rep("const _a = new V3(), _b = new V3(), _c = new V3(), _e = new V3(), _g = new V3(), _q1 = new THREE.Quaternion();",
    `const _a = new V3(), _b = new V3(), _c = new V3(), _e = new V3(), _g = new V3(), _q1 = new THREE.Quaternion(), _hq = new THREE.Quaternion();
function blendPose(dst, src, k) {
  for (const key in src) { if (Array.isArray(src[key])) { for (let j = 0; j < 3; j++) dst[key][j] += (src[key][j] - dst[key][j]) * k; } else dst[key] += (src[key] - dst[key]) * k; }
}`);
fs.writeFileSync(f, s);
console.log('ok');
