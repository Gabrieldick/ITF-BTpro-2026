const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };
function between(startMark, endMark, repl) {
  const a = s.indexOf(startMark); if (a < 0) throw new Error('start not found: ' + startMark);
  const b = s.indexOf(endMark, a + startMark.length); if (b < 0) throw new Error('end not found: ' + endMark);
  s = s.slice(0, a) + repl + s.slice(b);
}

between('const RACKET_GEO = (() => {', 'function carbonBase(', `// raquete de beach tennis: cabeça em gota que afina num pescoço vazado, face rígida com furos
function racketOutline() {
  const s = new THREE.Shape();
  s.moveTo(-.02, -.205); s.lineTo(.02, -.205);
  s.bezierCurveTo(.03, -.17, .055, -.14, .085, -.10);
  s.bezierCurveTo(.12, -.055, .132, 0, .13, .05);
  s.bezierCurveTo(.128, .11, .085, .156, 0, .158);
  s.bezierCurveTo(-.085, .156, -.128, .11, -.13, .05);
  s.bezierCurveTo(-.132, 0, -.12, -.055, -.085, -.10);
  s.bezierCurveTo(-.055, -.14, -.03, -.17, -.02, -.205);
  return s;
}
const RACKET_EDGE_PTS = racketOutline().getPoints(16);
const RACKET_GEO = (() => {
  const s = racketOutline();
  const poly = RACKET_EDGE_PTS;
  const inside = (x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
  const edgeD = (x, y) => { let m = 9; for (let i = 0; i < poly.length - 1; i++) { const a = poly[i], b = poly[i + 1]; const dx = b.x - a.x, dy = b.y - a.y; const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1); m = Math.min(m, Math.hypot(x - a.x - dx * t, y - a.y - dy * t)); } return m; };
  // furos em colmeia, acompanhando o contorno
  let row = 0;
  for (let y = -.098; y < .15; y += .0215, row++) {
    for (let x = -.13 + (row % 2 ? .0125 : 0); x < .13; x += .025) {
      if (inside(x, y) && edgeD(x, y) > .019) { const h = new THREE.Path(); h.absarc(x, y, .0062, 0, Math.PI * 2, true); s.holes.push(h); }
    }
  }
  // aberturas triangulares do pescoço
  [-1, 1].forEach(sd => {
    const h = new THREE.Path();
    h.moveTo(sd * .011, -.121); h.quadraticCurveTo(sd * .03, -.114, sd * .05, -.112);
    h.quadraticCurveTo(sd * .036, -.142, sd * .017, -.171); h.quadraticCurveTo(sd * .009, -.146, sd * .011, -.121);
    s.holes.push(h);
  });
  const g = new THREE.ExtrudeGeometry(s, { depth: .016, bevelEnabled: true, bevelThickness: .0035, bevelSize: .003, bevelSegments: 3, curveSegments: 10 });
  g.translate(0, 0, -.008); return g;
})();
// protetor de aro em volta da cabeça
const BUMPER_GEO = (() => {
  const pts = RACKET_EDGE_PTS.filter(p => p.y > -.07).map(p => new V3(p.x, p.y, 0));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, .0072, 8, false);
})();
const STRAP_GEO = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(0, .004, 0), new V3(.02, .034, .004), new V3(.009, .074, .009), new V3(-.012, .069, .006), new V3(-.021, .03, 0), new V3(0, .004, 0)]), 30, .0024, 6, false);
const GRIP_TEX = canvasTex(64, 256, (x, w, h) => {
  x.fillStyle = '#dcdcdc'; x.fillRect(0, 0, w, h);
  x.strokeStyle = '#8a8a8a'; x.lineWidth = 5;
  for (let i = -h; i < h * 2; i += 22) { x.beginPath(); x.moveTo(0, i); x.lineTo(w, i + 34); x.stroke(); }
  for (let i = 0; i < 900; i++) { x.fillStyle = 'rgba(0,0,0,' + rand(.03, .1) + ')'; x.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
});
GRIP_TEX.wrapS = GRIP_TEX.wrapT = THREE.RepeatWrapping; GRIP_TEX.repeat.set(1, 3);
`);

between('const RACKET_MATS = {};', 'function headGeo(fem) {', `const RACKET_MATS = {};
function racketMats(key) {
  if (RACKET_MATS[key]) return RACKET_MATS[key];
  const r = RACKETS[key];
  const t = canvasTex(512, 512, (x) => { x.scale(2, 2); r.draw(x, 256, 256); });
  // mapeia o contorno (x de -0,135 a 0,135; y de -0,21 a 0,16) no desenho inteiro
  t.repeat.set(1 / .27, 1 / .37); t.offset.set(.5, .21 / .37);
  return (RACKET_MATS[key] = {
    face: new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: t, roughness: .4, metalness: .12, clearcoat: .8, clearcoatRoughness: .18, envMapIntensity: 1.1 }),
    edge: mat(r.edge, { roughness: .35, metalness: .12 }),
    bumper: mat(r.edge, { roughness: .6 }),
    grip: mat(r.grip, { map: GRIP_TEX, roughness: .92 }),
    cap: mat(r.throat, { roughness: .35, metalness: .2 }),
  });
}
const STRAP_MAT = mat('#1b1e22', { roughness: .8 });
function makeRacket(key) {
  const g = new THREE.Group();
  const face = new THREE.Mesh(RACKET_GEO, []); face.rotation.z = Math.PI; face.position.y = -.365; face.castShadow = true; g.add(face);
  const bumper = new THREE.Mesh(BUMPER_GEO); bumper.rotation.z = Math.PI; bumper.position.y = -.365; bumper.castShadow = true; g.add(bumper);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(.0165, .0185, .165, 8)); handle.position.y = -.0825; g.add(handle);
  const butt = new THREE.Mesh(new THREE.CylinderGeometry(.021, .019, .014, 16)); butt.position.y = .002; g.add(butt);
  const strap = new THREE.Mesh(STRAP_GEO, STRAP_MAT); g.add(strap);
  g.userData.setStyle = k => {
    const M = racketMats(RACKETS[k] ? k : 'proteo');
    face.material = [M.face, M.edge]; bumper.material = M.bumper; handle.material = M.grip; butt.material = M.cap;
  };
  g.userData.setStyle(key);
  return g;
}

`);
// nomes dos modelos dentro da faixa, longe das aberturas do pescoço
rep("    modelName(x, 'MEDUSA', h * .86, '#8a6a3c', 17);", "    modelName(x, 'MEDUSA', h * .795, '#8a6a3c', 12);");
rep("    modelName(x, 'KRONOS', h * .85, '#d9d2c8', 15);", "    modelName(x, 'KRONOS', h * .795, '#d9d2c8', 12);");
rep("    modelName(x, 'PROTEO', h * .85, '#cfe0ff', 15);", "    modelName(x, 'PROTEO', h * .795, '#cfe0ff', 12);");
rep("    modelName(x, 'SUPERCARBON', h * .1, '#163a7a', 15);", "    modelName(x, 'SUPERCARBON', h * .2, '#163a7a', 12);");
fs.writeFileSync(f, s);
console.log('ok');
