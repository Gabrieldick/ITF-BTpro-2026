// @ts-nocheck
// laço principal e início
import './18-animacao';
import { STEP } from './00-base';
import { S } from './01-estado';
import { camera, renderer, scene } from './02-render';
import { seaMat, sky } from './03-cenario';
import { ACT, READY, SERVE_KEYS } from './04-poses';
import { MALE, cpuA, cpuB, human, partner } from './06-modelos';
import { CURL, GLB, applyPlayerStyle, applyRackets, assignCharacters, ball, fpArm, fpWrist, loadModels } from './07-glb';
import { HITS, applyGfx, getResScale, setResScale } from './08-audio';
import { $, configureMode, el, renderBoard, setupPoint } from './09-interface';
import { applyCam, inPlay, setPaused, syncMenu } from './12-controles';
import { step } from './17-bola';
import { READY_FP, updateCamera, updateVisuals } from './18-animacao';
// ---------- Loop ----------
let last = performance.now(), acc = 0;
// medição de fps a cada segundo: abaixo de 57 reduz a resolução; com folga, volta aos poucos
const FPS = { n: 0, t: 0, good: 0, lockUntil: 0, lastUp: -1e9, el: null, show: false };
function perfTick(now, gap) {
  if (gap > 100) return; // aba escondida/pausa longa
  FPS.n++; FPS.t += gap;
  if (FPS.t < 1000) return;
  const fps = FPS.n * 1000 / FPS.t; FPS.n = 0; FPS.t = 0;
  const sc = getResScale();
  if (S.settings.autoRes !== false && inPlay()) {
    if (fps < 57) {
      FPS.good = 0;
      if (now - FPS.lastUp < 8000) FPS.lockUntil = now + 60000; // subiu e voltou a travar: fica nesta resolução por um minuto
      if (sc > .55) setResScale(Math.max(.55, sc * .85));
    } else if (++FPS.good >= 6 && sc < 1 && now > FPS.lockUntil) { FPS.good = 0; FPS.lastUp = now; setResScale(Math.min(1, sc / .9)); }
  }
  if (FPS.show) {
    if (!FPS.el) { FPS.el = document.createElement('div'); FPS.el.id = 'fpsBox'; document.body.appendChild(FPS.el); }
    FPS.el.textContent = Math.round(fps) + ' fps · ' + Math.round(renderer.getPixelRatio() * 100) + '% res';
  }
}
addEventListener('keydown', e => { if (e.key && e.key.toLowerCase() === 'f' && !e.repeat && !(e.target && e.target.tagName === 'INPUT')) { FPS.show = !FPS.show; if (FPS.el) FPS.el.hidden = !FPS.show; } });
function frame(now) {
  requestAnimationFrame(frame);
  perfTick(now, now - last);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (!S.paused && inPlay()) {
    acc += dt;
    while (acc >= STEP) { step(STEP); acc -= STEP; }
  } else acc = 0;
  const tsec = now / 1000;
  seaMat.uniforms.time.value = tsec; sky.material.uniforms.time.value = tsec;
  updateVisuals(dt);
  updateCamera(dt);
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
  window.__pdo = { MALE, READY_FP, updCam: dt => updateCamera(dt), HITS, scene, tick: dt => { step(dt); updateVisuals(dt); }, STEP, fpArm, get fpWrist() { return fpWrist; }, perf: { tick: perfTick, FPS }, camera, S, ball, human, partner, cpuA, cpuB, renderer, ACT, SERVE_KEYS, READY, CURL, GLB };
  loadModels().then(ok => {
    assignCharacters(); configureMode();
    if (!ok) { const fs2 = document.getElementById('fsPlayers'); if (fs2) fs2.hidden = true; }
    applyRackets(); applyPlayerStyle();
    $('loading').hidden = true;
    requestAnimationFrame(frame);
  });
}
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});

