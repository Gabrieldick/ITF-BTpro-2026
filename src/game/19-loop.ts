// @ts-nocheck
// laço principal e início
import './18-animacao';
import * as THREE from 'three';
import { STEP, RACKET_STATS, charById } from './00-base';
import { makeRacket } from './05-atletas';
import { S, NET } from './01-estado';
import { camera, renderer, scene } from './02-render';
import { applyArena, seaMat, sky, updateArena } from './03-cenario';
import { ACT, READY, SERVE_KEYS } from './04-poses';
import { MALE, cpuA, cpuB, human, partner } from './06-modelos';
import { PALM, CURL, GLB, applyPlayerStyle, applyRackets, assignCharacters, ball, ballMark, diveMark, fpArm, fpWrist, loadModels } from './07-glb';
import { HITS, applyGfx, getResScale, setResScale, setMenuRes } from './08-audio';
import { $, configureMode, el, renderBoard, setupPoint } from './09-interface';
import { MTR, applyCam, inPlay, setPaused, syncMenu } from './12-controles';
import { step } from './17-bola';
import { doHit } from './10-fisica';
import { READY_FP, updateCamera, updateVisuals } from './18-animacao';
import { RP, recordTick, replayCamera, replayTick, startReplay } from './21-replay';
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
let menuMode = false, menuN = 0;
function frame(now) {
  requestAnimationFrame(frame);
  // com um menu aberto (menu, carreira, campeonato) a quadra vira fundo: metade da resolução e sombras a cada 4 quadros,
  // assim o fundo segue fluido e a página responde na hora (o hover dos botões demorava com o 3D pesado atrás)
  const inMenu = !NET.role && document.body.classList.contains('in-menu');
  if (inMenu !== menuMode) { menuMode = inMenu; setMenuRes(inMenu); renderer.shadowMap.autoUpdate = !inMenu; renderer.shadowMap.needsUpdate = true; }
  if (inMenu && ++menuN % 4 === 0) renderer.shadowMap.needsUpdate = true;
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
  let vdt = dt;
  if (S.mode === 'replay' && RP.list) vdt = replayTick(dt);
  else if (!S.paused && inPlay()) recordTick(dt);
  updateVisuals(vdt);
  updateArena(dt);
  updateCamera(dt);
  if (S.mode === 'replay') replayCamera(dt);
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
  window.__pdo = { NET, MTR, doHit, step, MALE, READY_FP, updCam: dt => updateCamera(dt), HITS, scene, tick: dt => { if (S.mode === 'replay' && RP.list) updateVisuals(replayTick(dt)); else { step(dt); recordTick(dt); updateVisuals(dt); } }, replay: startReplay, rpCam: replayCamera, STEP, fpArm, get fpWrist() { return fpWrist; }, perf: { tick: perfTick, FPS }, arena: applyArena, camera, S, ball, human, partner, cpuA, cpuB, renderer, ACT, SERVE_KEYS, READY, CURL, PALM, GLB, makeRacket, RACKET_STATS, applyPlayerStyle, assignCharacters, charById, ballMark, diveMark };
  loadModels().then(ok => {
    assignCharacters(); configureMode();
    if (!ok) { const fs2 = document.getElementById('fsPlayers'); if (fs2) fs2.hidden = true; }
    applyRackets(); applyPlayerStyle();
    $('loading').hidden = true;
    requestAnimationFrame(frame);
  });
}
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});

