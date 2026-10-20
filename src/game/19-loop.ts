// @ts-nocheck
// laço principal e início
import './18-animacao';
import * as THREE from 'three';
import { STEP } from './00-base';
import { S, NET } from './01-estado';
import { camera, renderer, scene } from './02-render';
import { applyArena, seaMat, sky, updateArena } from './03-cenario';
import { ACT, READY, SERVE_KEYS } from './04-poses';
import { MALE, cpuA, cpuB, human, partner } from './06-modelos';
import { CURL, GLB, applyPlayerStyle, applyRackets, assignCharacters, ball, fpArm, fpWrist, loadModels } from './07-glb';
import { HITS, applyGfx, getResScale, setResScale } from './08-audio';
import { $, configureMode, el, renderBoard, setupPoint } from './09-interface';
import { applyCam, inPlay, setPaused, syncMenu } from './12-controles';
import { step } from './17-bola';
import { READY_FP, updateCamera, updateVisuals } from './18-animacao';
// ---------- Loop ----------
let last = performance.now();
// medição de fps a cada segundo: 2 s seguidos abaixo de 54 reduz a resolução; com folga, volta aos poucos
const FPS = { n: 0, t: 0, good: 0, bad: 0, lockUntil: 0, lastUp: -1e9, el: null, show: false };
function perfTick(now, gap) {
  if (gap > 100) return; // aba escondida/pausa longa
  FPS.n++; FPS.t += gap;
  if (FPS.t < 1000) return;
  const fps = FPS.n * 1000 / FPS.t; FPS.n = 0; FPS.t = 0;
  const sc = getResScale();
  if (S.settings.autoRes !== false && inPlay()) {
    if (fps < 54) {
      FPS.good = 0;
      if (++FPS.bad >= 2) {
        FPS.bad = 0;
        if (now - FPS.lastUp < 8000) FPS.lockUntil = now + 60000; // subiu e voltou a travar: fica nesta resolução por um minuto
        if (sc > .55) setResScale(Math.max(.55, sc * .85));
      }
    } else {
      FPS.bad = 0;
      if (++FPS.good >= 6 && sc < 1 && now > FPS.lockUntil) { FPS.good = 0; FPS.lastUp = now; setResScale(Math.min(1, sc / .9)); }
    }
  }
  if (FPS.show) {
    if (!FPS.el) { FPS.el = document.createElement('div'); FPS.el.id = 'fpsBox'; document.body.appendChild(FPS.el); }
    FPS.el.textContent = Math.round(fps) + ' fps · ' + Math.round(renderer.getPixelRatio() * 100) + '% res';
  }
}
addEventListener('keydown', e => { if (e.key && e.key.toLowerCase() === 'f' && !e.repeat && !(e.target && e.target.tagName === 'INPUT')) { FPS.show = !FPS.show; if (FPS.el) FPS.el.hidden = !FPS.show; } });
// ---------- Replays: grava cada ponto e guarda os 3 melhores ----------
const REC = { cur: [], prevMode: '', deadF: -1, done: false };
const RP = { list: null, i: 0, f: 0, cam: new THREE.Vector3(10, 4, 0), look: new THREE.Vector3() };
const PL = () => [human, partner, cpuA, cpuB];
function snap() {
  return { b: [ball.pos.x, ball.pos.y, ball.pos.z, ball.vel.x, ball.vel.y, ball.vel.z], bs: ball.state,
    p: PL().map(p => [p.pos.x, p.pos.z, p.vel.x, p.vel.z, p.swing.t, p.swing.type, p.swing.dur, p.swing.side, p.swing.var, p.jump, p.jumpDur, p.jumpH, p.charging ? 1 : 0, p.dive ? p.dive.t : -1, p.dive ? p.dive.dur : 0, p.split || 0]) };
}
function recordTick() {
  const m = S.mode;
  if (m === 'serve' && REC.prevMode !== 'serve') { REC.cur = []; REC.deadF = -1; REC.done = false; }
  if (['serve', 'toss', 'rally', 'dead'].includes(m) && !S.drill) {
    if (m !== 'serve' && REC.cur.length < 1500) REC.cur.push(snap());
    if (m === 'dead' && REC.deadF < 0) REC.deadF = REC.cur.length;
    if (REC.deadF >= 0 && !REC.done && REC.cur.length - REC.deadF > 50) { REC.done = true; keepHighlight(); }
  }
  REC.prevMode = m;
}
function keepHighlight() {
  const lp = S.lastPoint; if (!lp || REC.cur.length < 30) return;
  const score = lp.rally + (lp.kind === 'in' ? 1 : 0) + (lp.cat === 'smash' && lp.kind === 'in' ? 3 : 0) + (lp.cat === 'curta' && lp.kind === 'in' ? 3 : 0) + (lp.cat === 'voleio' ? 2 : 0) + (lp.dive ? 5 : 0) + (lp.w === 0 ? 2 : 0);
  // câmera lenta perto das batidas (mudança brusca de velocidade da bola)
  const fr = REC.cur.slice(Math.max(0, REC.cur.length - 900));
  fr.forEach((s, i) => { if (i && Math.hypot(s.b[3] - fr[i - 1].b[3], s.b[5] - fr[i - 1].b[5]) > 3) for (let k = Math.max(0, i - 14); k < Math.min(fr.length, i + 20); k++) fr[k].slow = true; });
  S.highlights = (S.highlights || []).concat([{ frames: fr, score, text: lp.text }]).sort((a, b) => b.score - a.score).slice(0, 3);
}
function applySnap(s) {
  ball.pos.set(s.b[0], s.b[1], s.b[2]); ball.vel.set(s.b[3], s.b[4], s.b[5]); ball.state = s.bs === 'held' ? 'held' : s.bs;
  PL().forEach((p, i) => { const a = s.p[i]; p.pos.set(a[0], 0, a[1]); p.vel.set(a[2], 0, a[3]); p.swing.t = a[4]; p.swing.type = a[5]; p.swing.dur = a[6]; p.swing.side = a[7]; p.swing.var = a[8]; p.jump = a[9]; p.jumpDur = a[10]; p.jumpH = a[11]; p.charging = !!a[12]; p.dive = a[13] >= 0 ? { t: a[13], dur: a[14] } : null; p.split = a[15]; });
}
function startReplay() {
  if (!S.highlights || !S.highlights.length) return;
  RP.list = S.highlights.slice(); RP.i = 0; RP.f = 0;
  el.over.hidden = true; S.mode = 'replay'; document.body.classList.add('in-replay'); $('replayBar').hidden = false;
  $('replayTxt').textContent = RP.list[0].text;
}
function endReplay() {
  RP.list = null; S.mode = 'over'; document.body.classList.remove('in-replay'); $('replayBar').hidden = true; el.over.hidden = false;
  PL().forEach(p => { p.swing.t = -1; p.charging = false; p.dive = null; p.vel.set(0, 0, 0); });
}
function replayTick(dt) {
  const h = RP.list[RP.i], fr = h.frames;
  const cur = fr[Math.min(fr.length - 1, Math.floor(RP.f))];
  RP.f += dt * 60 * (cur.slow ? .35 : 1);
  if (RP.f >= fr.length) { RP.i++; RP.f = 0; if (RP.i >= RP.list.length) return endReplay(); $('replayTxt').textContent = RP.list[RP.i].text; return; }
  applySnap(cur);
}
$('btnReplay').addEventListener('click', startReplay);
$('replaySkip').addEventListener('click', () => { if (S.mode === 'replay') endReplay(); });
addEventListener('keydown', e => { if (S.mode === 'replay' && (e.key === 'Escape' || e.key === ' ')) { e.stopImmediatePropagation(); e.preventDefault(); endReplay(); } }, true);
function frame(now) {
  requestAnimationFrame(frame);
  perfTick(now, now - last);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (NET.role === 'guest') { if (NET.guestTick) NET.guestTick(dt); } // convidado: só aplica o estado que chega do anfitrião
  else if (!S.paused && inPlay()) {
    // o tempo do quadro inteiro dividido em passos iguais (~1/120 s): tudo anda exatamente o tempo que passou,
    // sem quadros "parados" ou "dobrados" (com passo fixo, telas de 144 Hz alternavam 0 e 1 passo e davam trancos)
    const n = Math.max(1, Math.round(dt / STEP)), h = dt / n;
    for (let i = 0; i < n; i++) step(h);
  }
  if (NET.role === 'host' && NET.hostTick) NET.hostTick(now);
  const tsec = now / 1000;
  seaMat.uniforms.time.value = tsec; sky.material.uniforms.time.value = tsec;
  if (S.mode === 'replay' && RP.list) replayTick(dt);
  else if (!S.paused) recordTick();
  updateVisuals(dt);
  updateArena(dt);
  updateCamera(dt);
  if (S.mode === 'replay') { // câmera lateral acompanhando a bola
    const k = 1 - Math.exp(-dt * 3);
    RP.cam.lerp(new THREE.Vector3(9.5, 3.4, ball.pos.z * .55 + 1.5), k); RP.look.lerp(new THREE.Vector3(ball.pos.x * .4, 1.1, ball.pos.z * .8), k);
    camera.position.copy(RP.cam); camera.lookAt(RP.look);
  }
  renderer.render(scene, camera);
}
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
// ---------- Início (com hot reload do viewer) ----------
function snapshot() {
  return { settings: S.settings, score: S.score, server: S.server, serverIdx: S.serverIdx, tbPlayed: S.tbPlayed, stats: S.stats, inMatch: inPlay() };
}
window.claude?.hot?.snapshot?.(snapshot);
function start(data) {
  data = data || {};
  if (data.settings) Object.assign(S.settings, data.settings);
  syncMenu(); configureMode(); applyCam(); applyGfx();
  human.pos.set(.9, 0, 5.5); cpuA.pos.set(-.6, 0, -5.8); partner.pos.set(-1.9, 0, 4.8); cpuB.pos.set(1.9, 0, -4.8);
  document.body.classList.add('in-menu');
  if (data.inMatch && data.score) {
    S.score = data.score; S.server = data.server || 0; S.serverIdx = data.serverIdx || [0, 0]; S.tbPlayed = data.tbPlayed || 0; S.stats = data.stats || S.stats; S.matchWinner = null;
    el.menu.hidden = true; document.body.classList.remove('in-menu');
    setupPoint(); setPaused(true);
  }
  renderBoard();
  window.__pdo = { MALE, READY_FP, updCam: dt => updateCamera(dt), HITS, scene, tick: dt => { if (S.mode === 'replay' && RP.list) replayTick(dt); else { step(dt); recordTick(); } updateVisuals(dt); }, replay: startReplay, STEP, fpArm, get fpWrist() { return fpWrist; }, perf: { tick: perfTick, FPS }, arena: applyArena, camera, S, ball, human, partner, cpuA, cpuB, renderer, ACT, SERVE_KEYS, READY, CURL, GLB };
  loadModels().then(ok => {
    assignCharacters(); configureMode();
    if (!ok) { const fs2 = document.getElementById('fsPlayers'); if (fs2) fs2.hidden = true; }
    applyRackets(); applyPlayerStyle();
    $('loading').hidden = true;
    requestAnimationFrame(frame);
  });
}
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});

