// ---------- mira: seta no chão, alvo e arco da trajetória ----------
const AIM = { ring: null, dot: null, arrow: null, head: null, shaft: null, arc: null, cache: { id: -1, x: 0 } };
const AIM_COL = { smash: 0xff5a1f, drive: 0xff5a1f, lob: 0x5fb8ff, curta: 0xffd23f, defesa: 0x4fd18b, preview: 0xfbf6ea };
function aimAutoX() { if (AIM.cache.id !== S.hitId) { AIM.cache.id = S.hitId; AIM.cache.x = gapX(0, .3) * .8; } return AIM.cache.x; }
// W = mais curto (perto da rede), S = mais fundo; sem segurar, meio da faixa
function humanDepthT() { const iz = human.inputZ || 0; return iz < -.25 ? .08 : iz > .25 ? .92 : .5; }
function buildAim() {
  const mk = (geo, op) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide })); m.renderOrder = 5; scene.add(m); return m; };
  const rg = new THREE.RingGeometry(.82, 1, 48); rg.rotateX(-Math.PI / 2); AIM.ring = mk(rg, .85);
  const dg = new THREE.CircleGeometry(.13, 24); dg.rotateX(-Math.PI / 2); AIM.dot = mk(dg, .9);
  AIM.arrow = new THREE.Group(); scene.add(AIM.arrow);
  const sg = new THREE.PlaneGeometry(1, 1); sg.rotateX(-Math.PI / 2); sg.translate(0, 0, .5);
  AIM.shaft = new THREE.Mesh(sg, AIM.ring.material.clone()); AIM.shaft.material.opacity = .55; AIM.arrow.add(AIM.shaft);
  const sh = new THREE.Shape(); sh.moveTo(-.28, 0); sh.lineTo(.28, 0); sh.lineTo(0, .45); sh.lineTo(-.28, 0);
  const hg = new THREE.ShapeGeometry(sh); hg.rotateX(Math.PI / 2);
  AIM.head = new THREE.Mesh(hg, AIM.shaft.material); AIM.arrow.add(AIM.head);
  AIM.arrow.children.forEach(o => { o.renderOrder = 5; });
  const ag = new THREE.BufferGeometry(); ag.setAttribute('position', new THREE.BufferAttribute(new Float32Array(32 * 3), 3));
  AIM.arc = new THREE.Line(ag, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .75, depthWrite: false })); AIM.arc.frustumCulled = false; scene.add(AIM.arc);
}
const _aimTgt = new V3(), _aimSt = new V3();
function updateAimMarker() {
  if (!AIM.ring) buildAim();
  const sw = human.swing, active = human.charging || (sw.t >= 0 && !sw.hit);
  const show = S.settings.aimArrow !== false && S.mode === 'rally' && ball.state === 'live' && S.lastTeam === 1 && (active || assignee(0) === human);
  [AIM.ring, AIM.dot, AIM.arrow, AIM.arc].forEach(o => { o.visible = show; });
  if (!show) return;
  const type = human.charging ? (MTR.type === 'lob' ? 'lob' : 'smash') : active ? sw.type : 'preview';
  const contactY = humanPlan.id === S.hitId && humanPlan.plan ? humanPlan.plan.pt.y : ball.pos.y;
  const key = type === 'preview' ? 'defesa' : type === 'smash' && contactY < 1.9 ? 'drive' : type;
  const spec = SHOTS[key];
  let d0 = spec.depth[0], d1 = spec.depth[1];
  if (key === 'lob') { const lp = clamp(human.charging ? MTR.v : sw.lob ? sw.lob.power : .6, 0, 1); d0 = lerp(5.4, 6.4, lp); d1 = lerp(7.0, 7.6, lp); }
  const lim = C.halfW - .35;
  const x = clamp(humanAim(), -lim, lim), z = -lerp(d0, d1, humanDepthT());
  // imprecisão esperada: atributo do golpe e qualidade média
  const A = human.char ? human.char.a : null;
  const r = clamp(spec.noise * .45 * (A ? lerp(1.6, .65, (A[ATTR_OF[key]] || A.def) / 100) : 1) * 1.6, .28, 1.4);
  const col = AIM_COL[type] || 0xffffff;
  [AIM.ring, AIM.dot, AIM.shaft, AIM.arc].forEach(o => o.material.color.setHex(col));
  AIM.ring.position.set(x, .035, z); AIM.ring.scale.setScalar(r); AIM.dot.position.set(x, .04, z);
  // seta do jogador até o alvo
  const hx = human.pos.x, hz = human.pos.z, dx = x - hx, dz = z - hz, dist = Math.hypot(dx, dz);
  AIM.arrow.position.set(hx, .03, hz); AIM.arrow.rotation.y = Math.atan2(dx, dz);
  const L = Math.max(.2, dist - r - .45);
  AIM.shaft.scale.set(.14, 1, L); AIM.head.position.set(0, .002, L);
  // arco: do ponto de contato previsto até o alvo, com o efeito do golpe
  if (humanPlan.id === S.hitId && humanPlan.plan) _aimSt.copy(humanPlan.plan.pt); else _aimSt.set(hx + .5, 1.1, hz - .3);
  _aimTgt.set(x, C.ballR, z);
  const gk = { smash: 1.35, drive: 1.18, lob: 1.1, curta: .8, defesa: 1 }[key] || 1;
  const v = solveShot(_aimSt, _aimTgt, Object.assign({}, spec, { gk }));
  const T = Math.abs(v.z) > 1e-3 ? (z - _aimSt.z) / v.z : 1, pa = AIM.arc.geometry.attributes.position, g = G * gk;
  for (let i = 0; i < 32; i++) { const t = T * i / 31; pa.setXYZ(i, _aimSt.x + v.x * t, Math.max(.03, _aimSt.y + v.y * t - .5 * g * t * t), _aimSt.z + v.z * t); }
  pa.needsUpdate = true;
}
