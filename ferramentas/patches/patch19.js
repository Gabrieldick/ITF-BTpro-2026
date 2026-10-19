const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };
function between(startMark, endMark, repl) {
  const a = s.indexOf(startMark); if (a < 0) throw new Error('start not found: ' + startMark);
  const b = s.indexOf(endMark, a + startMark.length); if (b < 0) throw new Error('end not found: ' + endMark);
  s = s.slice(0, a) + repl + s.slice(b);
}

between('const RACKET_GEO = (() => {', '// protetor de aro em volta da cabeça', `// padrão de furos e aberturas do pescoço de cada modelo
const RK_POLY = RACKET_EDGE_PTS;
function rkInside(x, y) { let c = false; for (let i = 0, j = RK_POLY.length - 1; i < RK_POLY.length; j = i++) { const a = RK_POLY[i], b = RK_POLY[j]; if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; }
function rkEdge(x, y) { let m = 9; for (let i = 0; i < RK_POLY.length - 1; i++) { const a = RK_POLY[i], b = RK_POLY[i + 1]; const dx = b.x - a.x, dy = b.y - a.y; const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1); m = Math.min(m, Math.hypot(x - a.x - dx * t, y - a.y - dy * t)); } return m; }
// pontos ao longo do contorno, deslocados para dentro
function rkRing(inset, step, yMin) {
  const out = []; let acc = 0;
  for (let i = 0; i < RK_POLY.length - 1; i++) {
    const a = RK_POLY[i], b = RK_POLY[i + 1]; const len = Math.hypot(b.x - a.x, b.y - a.y);
    for (let d = 0; d < len; d += .002) {
      acc += .002; if (acc < step) continue; acc = 0;
      const x = a.x + (b.x - a.x) * d / len, y = a.y + (b.y - a.y) * d / len;
      if (y < yMin) continue;
      const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len; // normal para dentro (contorno anti-horário)
      out.push([x + nx * inset, y + ny * inset]);
    }
  }
  return out.filter(([x, y]) => rkInside(x, y) && rkEdge(x, y) > inset * .8);
}
const inTri = (x, y, cx, cy, sz) => { const h = sz * 1.78; const top = cy + sz, bot = cy - sz * .78; if (y > top || y < bot) return false; const half = (top - y) / h * sz * 1.08 * 2; return Math.abs(x - cx) < half; };
const RACKET_HOLES = {
  supercarbon: { r: .0058, pts: (() => { const p = []; [-1, 1].forEach(sd => { for (let i = 0; i < 6; i++) p.push([sd * .093, .093 - i * .026]); for (let i = 0; i < 7; i++) p.push([sd * .067, .117 - i * .026]); }); return p; })(),
    throat: [[[-.05, -.112], [-.017, -.116], [-.033, -.15]], [[-.012, -.121], [.012, -.121], [0, -.158]], [[.05, -.112], [.017, -.116], [.033, -.15]]] },
  medusa: { r: .0068, pts: (() => { const p = []; let row = 0; for (let y = -.068; y < .15; y += .031, row++) for (let x = -.12 + (row % 2 ? .017 : 0); x < .12; x += .034) if (rkInside(x, y) && rkEdge(x, y) > .021) p.push([x, y]); return p; })(),
    throat: [[[-.022, -.116], [.022, -.116], [0, -.162]]] },
  proteo: { r: .006, pts: rkRing(.02, .027, -.085).concat(rkRing(.045, .03, -.06).filter(([x, y]) => !inTri(x, y, 0, .005, .08))),
    throat: [[[-.011, -.121], [-.05, -.112], [-.017, -.171]], [[.011, -.121], [.05, -.112], [.017, -.171]]] },
  kronos: { r: .006, pts: rkRing(.019, .025, -.085).concat(rkRing(.042, .027, -.07).filter(([x, y]) => !inTri(x, y, 0, .005, .085))),
    throat: [[[-.018, -.12], [.018, -.12], [0, -.15]]] },
};
const RACKET_GEOS = {};
function racketGeo(key) {
  if (RACKET_GEOS[key]) return RACKET_GEOS[key];
  const cfg = RACKET_HOLES[key] || RACKET_HOLES.proteo;
  const s = racketOutline();
  cfg.pts.forEach(([x, y]) => { const h = new THREE.Path(); h.absarc(x, y, cfg.r, 0, Math.PI * 2, true); s.holes.push(h); });
  cfg.throat.forEach(tri => {
    const h = new THREE.Path(); const c = tri.reduce((a, p) => [a[0] + p[0] / 3, a[1] + p[1] / 3], [0, 0]);
    // cantos arredondados: cada vértice puxado um pouco para o centro
    const pt = i => { const p = tri[(i + 3) % 3]; return [p[0] + (c[0] - p[0]) * .12, p[1] + (c[1] - p[1]) * .12]; };
    const mid = (i, j) => { const a = pt(i), b = pt(j); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
    const m0 = mid(0, 1); h.moveTo(m0[0], m0[1]);
    for (let i = 1; i <= 3; i++) { const v = pt(i), m = mid(i, i + 1); h.quadraticCurveTo(v[0], v[1], m[0], m[1]); }
    s.holes.push(h);
  });
  const g = new THREE.ExtrudeGeometry(s, { depth: .016, bevelEnabled: true, bevelThickness: .0035, bevelSize: .003, bevelSegments: 3, curveSegments: 10 });
  g.translate(0, 0, -.008);
  return (RACKET_GEOS[key] = g);
}
`);
rep("  const face = new THREE.Mesh(RACKET_GEO, []);", "  const face = new THREE.Mesh(racketGeo(key), []);");
rep("    face.material = [M.face, M.edge]; bumper.material = M.bumper;", "    face.geometry = racketGeo(RACKETS[k] ? k : 'proteo'); face.material = [M.face, M.edge]; bumper.material = M.bumper;");
rep("  window.__pdo = { tick:", "  window.__pdo = { scene, tick:");
fs.writeFileSync(f, s);
console.log('ok', Object.keys({}).length);
