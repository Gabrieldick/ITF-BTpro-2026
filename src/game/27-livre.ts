// @ts-nocheck
// ---------- Modo livre da carreira (andar pela casa, quintal, rua, arena e ir ao torneio) ----------
// O seu jogador anda (WASD/setas, Shift corre, E interage, Esc volta) por um pequeno bairro montado longe da quadra do jogo:
// a casa (vista em corte, sem teto), o quintal com a quadra própria (quando comprada em Negócios), a rua com a van para o
// torneio e a arena de treino no fim da rua. Os pontos de interação usam as mesmas ações da tela da carreira (treinar,
// desafio, dar aulas, descansar, ir ao torneio). A animação de andar é a da partida (com a captura de movimento).
import * as THREE from 'three';
import { $s } from '../state';
import { S } from './01-estado';
import { camera, canvasTex, mat, scene, sun, SUN_DIR } from './02-render';
import { cpuA, cpuB, human, partner } from './06-modelos';
import { crInv, crTrain, crRest, crRestUntil, crCoach, crDateTxt, crTourT, crMyMatch, saveCareer } from './14-carreira';
import { nameOf } from './00-base';

const H0 = new THREE.Vector3(320, 0, 40); // origem do bairro no mundo (longe da quadra, fora do cenário da praia)
const LV = { on: false, group: null, spots: [], boxes: [], yaw: 0, camYaw: Math.PI, camPitch: .5, vel: new THREE.Vector3(), near: null, msgT: 0, saved: null, actions: {}, drag: null, keys: {}, built: '' };
const P = (x, z) => new THREE.Vector3(H0.x + x, 0, H0.z + z);

// ---------- montagem ----------
function box(g, w, h, d, x, y, z, color, o) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, o)); m.position.set(x, y, z); m.castShadow = !(o && o.noShadow); m.receiveShadow = true; g.add(m); return m; }
function solid(x0, z0, x1, z1) { LV.boxes.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]); }
function label(text, sub) {
  const t = canvasTex(512, 128, (x, w, h) => { x.fillStyle = 'rgba(4,14,40,.82)'; x.beginPath(); x.roundRect(4, 4, w - 8, h - 8, 26); x.fill(); x.strokeStyle = '#33c3ff'; x.lineWidth = 4; x.stroke();
    x.fillStyle = '#fff'; x.font = '800 italic 46px Barlow Condensed, Arial Narrow, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text.toUpperCase(), w / 2, sub ? 48 : h / 2);
    if (sub) { x.fillStyle = '#9fe6ff'; x.font = '600 28px Arial'; x.fillText(sub, w / 2, 92); } }, true);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(2.4, .6, 1); s.renderOrder = 5; return s;
}
// ponto de interação: círculo no chão + placa flutuante
function spot(g, id, x, z, title, sub, r = 1.1) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * .78, r, 40), new THREE.MeshBasicMaterial({ color: 0x33c3ff, transparent: true, opacity: .55, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(x, .03, z); g.add(ring);
  const l = label(title, sub); l.position.set(x, 2.5, z); g.add(l);
  LV.spots.push({ id, x, z, r: r + .3, ring, label: l, title });
}
function build() {
  const key = [crInv('quadra'), crInv('moradia')].join('|');
  if (LV.group && LV.built === key) return;
  if (LV.group) { scene.remove(LV.group); LV.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  LV.built = key; LV.spots = []; LV.boxes = [];
  const g = new THREE.Group(); g.position.copy(H0); LV.group = g; scene.add(g);
  const nice = crInv('moradia') >= 2;
  // chão: areia, grama do quintal, calçada e rua
  box(g, 200, .2, 200, 15, -.1, 10, '#e8d7ae', { noShadow: true });
  box(g, 22, .04, 14, 0, .02, 12, '#7fb069', { noShadow: true });
  box(g, 160, .05, 8, 10, .03, 24, '#3a3f47', { noShadow: true });
  for (let i = -60; i < 80; i += 5) box(g, 2.2, .02, .18, i, .07, 24, '#f2f2f2', { noShadow: true });
  box(g, 160, .1, 2.2, 10, .05, 19, '#c9c4b8', { noShadow: true });
  // ---- casa (12 x 10, porta na frente) ----
  const W = nice ? '#f4efe6' : '#e9e2d4', Hh = 2.6, t = .2;
  box(g, 12, .08, 10, 0, .04, 0, nice ? '#b98b5e' : '#a77d55', { noShadow: true }); // piso de madeira
  box(g, 12, Hh, t, 0, Hh / 2, -5, W); solid(-6, -5.2, 6, -4.8);                    // fundo
  box(g, t, Hh, 10, -6, Hh / 2, 0, W); solid(-6.2, -5, -5.8, 5);                    // esquerda
  box(g, t, Hh, 10, 6, Hh / 2, 0, W); solid(5.8, -5, 6.2, 5);                       // direita
  box(g, 4.8, Hh, t, -3.6, Hh / 2, 5, W); solid(-6, 4.8, -1.2, 5.2);                // frente, à esquerda da porta
  box(g, 4.8, Hh, t, 3.6, Hh / 2, 5, W); solid(1.2, 4.8, 6, 5.2);                   // frente, à direita da porta
  box(g, t, Hh, 4.2, 1, Hh / 2, -2.9, W); solid(.9, -5, 1.1, -.8);                  // parede do quarto
  box(g, 4.4, .1, .3, 0, Hh, 5, W, { noShadow: true });
  // quarto: cama
  box(g, 2, .45, 2.4, 3.6, .25, -3.4, '#3d5a80'); box(g, 2, .2, .6, 3.6, .55, -4.4, '#f5f5f5'); solid(2.6, -4.6, 4.6, -2.2);
  spot(g, 'cama', 3.6, -1.5, 'Cama', 'Descansar', 1);
  // sala: sofá, TV, estante de troféus, computador
  box(g, 3, .45, 1, -3, .25, -1, '#e07a5f'); box(g, 3, .7, .3, -3, .5, -1.4, '#c45f46'); solid(-4.5, -1.6, -1.5, -.5);
  box(g, 2.4, 1.3, .1, -3, 1.4, -4.85, '#111317'); box(g, 2.6, .5, .5, -3, .25, -4.6, '#5c4433'); solid(-4.3, -4.9, -1.7, -4.3);
  spot(g, 'tv', -3, -3.2, 'TV', 'Notícias e entrevistas', .9);
  box(g, .5, 2, 2.2, -5.6, 1, 2.6, '#6b4f3a'); solid(-5.9, 1.5, -5.3, 3.7);
  const nT = Object.values($s.CR.titles || {}).reduce((a, b) => a + b, 0);
  for (let i = 0; i < Math.min(nT, 12); i++) { const tr = new THREE.Mesh(new THREE.CylinderGeometry(.06, .1, .3, 10), mat('#e8b923', { metalness: .8, roughness: .3 })); tr.position.set(-5.45, .35 + Math.floor(i / 4) * .55 + .2, 1.8 + (i % 4) * .5); g.add(tr); }
  spot(g, 'trofeus', -4.4, 2.6, 'Troféus', nT + ' títulos', .8);
  box(g, 1.4, .75, .7, 3.8, .38, 3.6, '#5c4433'); box(g, .7, .45, .05, 3.8, 1, 3.4, '#1d2430'); solid(3.1, 3.2, 4.5, 4);
  spot(g, 'pc', 3.8, 2.4, 'Computador', 'Agenda da carreira', .9);
  // ---- quintal: quadra própria ou o espaço vazio ----
  if (crInv('quadra') >= 1) {
    const cw = 8, cl = 16, cx = 18, cz = 2; // quadra de beach (8 x 16) ao lado da casa
    box(g, cw + 4, .06, cl + 4, cx, .04, cz, '#f1e2b8', { noShadow: true });
    const line = (w, d, x, z) => box(g, w, .02, d, x, .08, z, '#1f4fb8', { noShadow: true });
    line(cw, .06, cx, cz - cl / 2); line(cw, .06, cx, cz + cl / 2); line(.06, cl, cx - cw / 2, cz); line(.06, cl, cx + cw / 2, cz);
    box(g, cw + .6, .9, .03, cx, 1.25, cz, '#ffffff', { transparent: true, opacity: .45 }); box(g, .1, 1.75, .1, cx - cw / 2 - .3, .88, cz, '#1f4fb8'); box(g, .1, 1.75, .1, cx + cw / 2 + .3, .88, cz, '#1f4fb8');
    solid(cx - cw / 2 - .4, cz - .1, cx + cw / 2 + .4, cz + .1);
    spot(g, 'quadraDesafio', cx, cz + 5, 'Sua quadra', 'Treino com desafio');
    spot(g, 'quadraTreino', cx, cz - 5, 'Sua quadra', 'Treino físico e técnico');
  } else {
    const s = label('Quadra própria', 'Compre em Negócios'); s.position.set(18, 1.6, 2); s.scale.set(3.2, .8, 1); g.add(s);
    box(g, .1, 1.2, .1, 18, .6, 2, '#6b4f3a');
  }
  // ---- rua: van para o torneio e ponto de táxi ----
  box(g, 4.4, 1.9, 1.9, -8, 1.15, 22.4, '#f2f2f2'); box(g, 1.2, 1.2, 1.85, -6.2, 1.3, 22.4, '#2b3445'); solid(-10.2, 21.4, -5.8, 23.4);
  [[-9.4, 21.5], [-9.4, 23.3], [-6.6, 21.5], [-6.6, 23.3]].forEach(([x, z]) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(.38, .38, .25, 16), mat('#1b1b1d')); w.rotation.x = Math.PI / 2; w.position.set(x, .38, z); g.add(w); });
  spot(g, 'torneio', -8, 19.6, 'Van', 'Ir ao torneio');
  // ---- arena de treino no fim da rua ----
  const ax = 46, az = 34;
  box(g, 24, .06, 18, ax, .04, az, '#f1e2b8', { noShadow: true });
  [[-1, 1]].forEach(() => {});
  box(g, 8, 4, .3, ax - 8, 2, az - 9, '#2457c5'); box(g, 8, 4, .3, ax + 8, 2, az - 9, '#2457c5'); // frente com entrada no meio
  box(g, 24, 4, .3, ax, 2, az + 9, '#2457c5'); solid(ax - 12, az + 8.8, ax + 12, az + 9.2);
  box(g, .3, 4, 18, ax - 12, 2, az, '#2457c5'); solid(ax - 12.2, az - 9, ax - 11.8, az + 9);
  box(g, .3, 4, 18, ax + 12, 2, az, '#2457c5'); solid(ax + 11.8, az - 9, ax + 12.2, az + 9);
  { const s = label('Arena de treino', 'Beach tennis'); s.position.set(ax, 5.2, az - 8.6); s.scale.set(5, 1.25, 1); g.add(s); }
  box(g, 8, .02, 16, ax, .08, az + 1, '#ffffff', { noShadow: true, transparent: true, opacity: .25 });
  box(g, 8.6, .9, .03, ax, 1.25, az + 1, '#ffffff', { transparent: true, opacity: .45 }); solid(ax - 4.4, az + .9, ax + 4.4, az + 1.1);
  spot(g, 'arenaTreino', ax - 6, az - 5, 'Treinar', 'Físico e técnico');
  spot(g, 'arenaDesafio', ax + 6, az - 5, 'Desafio', 'Curta, defesa, smash…');
  spot(g, 'aulas', ax, az + 6.5, 'Dar aulas', 'Renda extra');
  // palmeiras e postes ao longo da rua
  for (let x = -40; x <= 70; x += 14) { const tr = new THREE.Mesh(new THREE.CylinderGeometry(.14, .22, 5, 8), mat('#8a6a45')); tr.position.set(x, 2.5, 17.6); tr.castShadow = true; g.add(tr);
    for (let k = 0; k < 6; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(.35, 2.6, 4), mat('#3f8f4a')); f.position.set(x + Math.cos(k) * .9, 4.9, 17.6 + Math.sin(k) * .9); f.rotation.z = Math.cos(k) * 1.2; f.rotation.x = Math.sin(k) * 1.2; g.add(f); } }
  // limites do bairro
  solid(-50, -40, -49, 60); solid(80, -40, 81, 60); solid(-50, -40, 81, -39); solid(-50, 59, 81, 60); solid(ax - 12, az - 9.2, ax - 4, az - 8.8); solid(ax + 4, az - 9.2, ax + 12, az - 8.8);
}

// ---------- ações ----------
const ACT = {
  cama: { txt: () => (($s.CR.tour && $s.CR.tour.pending) ? 'Descansar até o torneio' : 'Descansar hoje (+14 energia)'), run: () => { if ($s.CR.tour && $s.CR.tour.pending) crRestUntil(); else crRest(); } },
  tv: { txt: () => (($s.CR.talks || []).length ? 'Ver a entrevista pendente' : 'Ver o noticiário'), run: () => { if (($s.CR.talks || []).length) LV.actions.openCareer(); else LV.msg('📺 ' + ((($s.CR.feed || [])[0] || {}).t || 'Nada de novo no circuito hoje.')); } },
  trofeus: { txt: () => 'Ver troféus', run: () => { const t = $s.CR.titles || {}, n = Object.values(t).reduce((a, b) => a + b, 0); LV.msg(n ? '🏆 ' + n + ' títulos na estante.' : 'A estante está esperando o primeiro troféu.'); } },
  pc: { txt: () => 'Abrir a agenda da carreira', run: () => LV.actions.openCareer() },
  quadraTreino: { txt: () => 'Treinar na sua quadra (sem custo)', run: () => crTrain() },
  quadraDesafio: { txt: () => 'Treino com desafio na sua quadra', run: () => LV.actions.drill() },
  arenaTreino: { txt: () => 'Treinar na arena', run: () => crTrain() },
  arenaDesafio: { txt: () => 'Treino com desafio', run: () => LV.actions.drill() },
  aulas: { txt: () => 'Dar aulas hoje', run: () => crCoach() },
  torneio: { txt: () => { const t = $s.CR.tour; return !t ? 'Ver os torneios da semana' : t.pending ? 'Ir ao torneio (descansa até sábado)' : t.done ? 'Voltar do torneio' : 'Ir para a quadra do torneio'; },
    run: () => { const t = $s.CR.tour; if (t && t.pending) crRestUntil(); LV.actions.openCareer(); } },
};

// ---------- entrar e sair ----------
function enter() {
  if (!$s.CR || LV.on) return;
  build();
  LV.on = true; LV.saved = { mode: S.mode, pos: human.pos.clone() };
  S.mode = 'livre';
  document.body.classList.remove('in-menu'); document.body.classList.add('livre');
  document.getElementById('career').hidden = true;
  [partner, cpuA, cpuB].forEach(p => { if (p) p.livreHide = true; });
  human.pos.copy(P(0, 1.5)); human.vel.set(0, 0, 0); human.feet = null; LV.camYaw = 0; LV.camPitch = .62;
  hud(true); LV.msg('Bem-vindo em casa. WASD para andar, Shift corre, E interage, Esc volta.');
}
function exit(toCareer = true) {
  if (!LV.on) return;
  LV.on = false; S.mode = 'menu'; document.body.classList.remove('livre');
  [partner, cpuA, cpuB].forEach(p => { if (p) { p.livreHide = false; if (p.model) p.model.group.visible = true; } });
  human.pos.set(.9, 0, 5.5); human.vel.set(0, 0, 0); human.feet = null; human.forceYaw = null;
  hud(false);
  if (toCareer) { document.body.classList.add('in-menu'); document.getElementById('career').hidden = false; if (LV.actions.render) LV.actions.render(); }
}

// ---------- a cada quadro ----------
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
function tick(dt) {
  if (!LV.on) return;
  // os outros jogadores somem
  [partner, cpuA, cpuB].forEach(p => { if (p && p.livreHide) { if (p.model) p.model.group.visible = false; if (p.skin) { p.skin.holder.visible = false; p.skin.racket.visible = false; } } });
  const k = LV.keys, run = k.shift;
  let ix = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0), iz = (k.s || k.arrowdown ? 1 : 0) - (k.w || k.arrowup ? 1 : 0);
  if (LV.joy) { ix += LV.joy.x; iz += LV.joy.y; }
  const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
  // direção relativa à câmera
  const cy = Math.cos(LV.camYaw), sy = Math.sin(LV.camYaw), tx = ix * cy + iz * sy, tz = -ix * sy + iz * cy;
  const vmax = run ? 5.2 : 1.9, acc = il > .05 ? 9 : 12;
  LV.vel.x += (tx * vmax - LV.vel.x) * Math.min(1, dt * acc); LV.vel.z += (tz * vmax - LV.vel.z) * Math.min(1, dt * acc);
  human.vel.set(LV.vel.x, 0, LV.vel.z);
  human.pos.x += LV.vel.x * dt; human.pos.z += LV.vel.z * dt;
  // colisão com as paredes e móveis (círculo contra caixas)
  const lx = human.pos.x - H0.x, lz = human.pos.z - H0.z, R = .32; let px = lx, pz = lz;
  for (const [x0, z0, x1, z1] of LV.boxes) { const cx = Math.max(x0, Math.min(px, x1)), cz = Math.max(z0, Math.min(pz, z1)), dx = px - cx, dz = pz - cz, d = Math.hypot(dx, dz);
    if (d < R) { if (d > 1e-4) { px = cx + dx / d * R; pz = cz + dz / d * R; } else { px += R; } } }
  human.pos.x = H0.x + px; human.pos.z = H0.z + pz;
  // para onde o corpo olha: para onde anda
  const sp = Math.hypot(LV.vel.x, LV.vel.z);
  if (sp > .3) { const want = Math.atan2(-LV.vel.x, -LV.vel.z); let d = want - LV.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); LV.yaw += d * Math.min(1, dt * 10); }
  human.forceYaw = LV.yaw;
  // ponto de interação mais perto
  let near = null, nd = 9;
  for (const s of LV.spots) { const d = Math.hypot(px - s.x, pz - s.z); s.ring.material.opacity = d < s.r ? .95 : .45; if (d < s.r && d < nd) { nd = d; near = s; } }
  if (near !== LV.near) { LV.near = near; prompt(); }
  LV.spots.forEach(s => { const d = Math.hypot(px - s.x, pz - s.z); s.label.visible = d < 16; });
  // nome do lugar onde está
  { const where = px > -6 && px < 6 && pz > -5 && pz < 5 ? 'Casa de ' + nameOf($s.CR.me).split(' ')[0] : px > 10 && px < 26 && pz > -8 && pz < 12 ? 'Quintal' : px > 33 && px < 59 && pz > 24 && pz < 44 ? 'Arena de treino' : pz > 17 && pz < 28 ? 'Rua da praia' : 'Bairro';
    if (where !== LV.where) { LV.where = where; const e = document.querySelector('#livreHud .lv-where'); if (e) e.textContent = where; } }
  if (LV.msgT > 0 && (LV.msgT -= dt) <= 0) { const m = document.getElementById('livreMsg'); if (m) m.hidden = true; }
}
// câmera: atrás do jogador, girada pelo mouse (arrastando) ou Q/E… (E é interagir: gira com Q e R); dentro de casa sobe e olha de cima
function cam(dt) {
  if (!LV.on) return false;
  const k = LV.keys; if (k.q) LV.camYaw += dt * 1.8; if (k.r) LV.camYaw -= dt * 1.8;
  const lx = human.pos.x - H0.x, lz = human.pos.z - H0.z, inside = lx > -6 && lx < 6 && lz > -5 && lz < 5;
  const dist = inside ? 5.2 : 6.4, pitch = inside ? .95 : LV.camPitch, h = 1.2;
  _v.set(human.pos.x + Math.sin(LV.camYaw) * Math.cos(pitch) * dist, h + Math.sin(pitch) * dist, human.pos.z + Math.cos(LV.camYaw) * Math.cos(pitch) * dist);
  const kk = 1 - Math.exp(-dt * 6);
  camera.position.lerp(_v, kk); _w.set(human.pos.x, 1.1, human.pos.z);
  LV.look = (LV.look || _w.clone()).lerp(_w, kk); camera.lookAt(LV.look);
  if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }
  sun.target.position.set(human.pos.x, 0, human.pos.z); sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 40);
  return true;
}

// ---------- interface ----------
function hud(on) {
  let el = document.getElementById('livreHud');
  if (!el) {
    el = document.createElement('div'); el.id = 'livreHud';
    el.innerHTML = '<div class="lv-top"><b class="lv-where"></b><span class="lv-day"></span><button type="button" class="ghost sm" id="livreExit">Voltar à carreira (Esc)</button></div>'
      + '<div id="livrePrompt" class="lv-prompt" hidden><kbd>E</kbd><span></span></div><div id="livreMsg" class="lv-msg" hidden></div>'
      + '<div class="lv-help">WASD ou setas: andar · Shift: correr · E: interagir · Q/R ou arrastar: girar a câmera</div>'
      + '<div class="lv-joy" id="livreJoy"><i></i></div><button type="button" class="lv-act" id="livreAct">E</button>';
    document.body.appendChild(el);
    el.querySelector('#livreExit').addEventListener('click', () => exit(true));
    el.querySelector('#livreAct').addEventListener('click', interact);
    // joystick de toque
    const J = el.querySelector('#livreJoy'), knob = J.querySelector('i');
    const mv = e => { const r = J.getBoundingClientRect(), t = e.touches ? e.touches[0] : e, x = (t.clientX - r.left - r.width / 2) / (r.width / 2), y = (t.clientY - r.top - r.height / 2) / (r.height / 2), l = Math.max(1, Math.hypot(x, y)); LV.joy = { x: x / l, y: y / l }; knob.style.transform = 'translate(' + (x / l * 30) + 'px,' + (y / l * 30) + 'px)'; };
    J.addEventListener('pointerdown', e => { J.setPointerCapture(e.pointerId); mv(e); }); J.addEventListener('pointermove', e => { if (LV.joy) mv(e); });
    J.addEventListener('pointerup', () => { LV.joy = null; knob.style.transform = ''; });
  }
  el.hidden = !on;
  if (on) { el.querySelector('.lv-day').textContent = crDateTxt($s.CR.season, $s.CR.week, $s.CR.day) + ' · energia ' + Math.round($s.CR.energy) + ' · ' + money2($s.CR.money); LV.where = ''; }
}
const money2 = v => '$' + Math.round(v).toLocaleString('pt-BR');
function prompt() {
  const el = document.getElementById('livrePrompt'); if (!el) return;
  const s = LV.near, a = s && ACT[s.id]; el.hidden = !a; if (a) el.querySelector('span').textContent = a.txt();
  const b = document.getElementById('livreAct'); if (b) b.classList.toggle('on', !!a);
}
LV.msg = t => { const m = document.getElementById('livreMsg'); if (!m) return; m.textContent = t; m.hidden = !t; LV.msgT = 5; };
function interact() {
  const s = LV.near, a = s && ACT[s.id]; if (!a || !$s.CR) return;
  const before = $s.CR.lastMsg; a.run(); saveCareer();
  if (!LV.on) return; // a ação saiu do modo livre (carreira, desafio)
  if ($s.CR.lastMsg && $s.CR.lastMsg !== before) LV.msg($s.CR.lastMsg);
  hud(true); prompt();
  if (($s.CR.talks || []).length && LV.actions.talk) LV.actions.talk();
}

// teclado e mouse (só no modo livre)
addEventListener('keydown', e => {
  if (!LV.on) return; const k = e.key.toLowerCase();
  if (k === 'escape') { exit(true); return; }
  if (k === 'e' && !e.repeat) { interact(); e.preventDefault(); return; }
  LV.keys[k] = true; if (k === 'shift') LV.keys.shift = true;
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
}, true);
addEventListener('keyup', e => { const k = e.key.toLowerCase(); LV.keys[k] = false; if (k === 'shift') LV.keys.shift = false; }, true);
addEventListener('pointerdown', e => { if (LV.on && e.target && e.target.tagName === 'CANVAS') LV.drag = e.clientX; });
addEventListener('pointermove', e => { if (LV.on && LV.drag != null) { LV.camYaw -= (e.clientX - LV.drag) * .006; LV.drag = e.clientX; } });
addEventListener('pointerup', () => { LV.drag = null; });

if (typeof window !== 'undefined') window.__pdoLivre = { LV, enter, exit, tick, interact, P, H0 };
export { LV as LIVRE, enter as livreEnter, exit as livreExit, tick as livreTick, cam as livreCam };
