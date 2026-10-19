// @ts-nocheck
// teclado, toque, barras de força e menus
import './11-mira';
import { ATTRS, C, HEIGHTS, NAMES, PLAY_STYLES, RACKET_STATS, ROSTER, SWING_DUR, TOSS_T, V3, bG, charById, clamp, hScale, heightOf, nameOf, overall } from './00-base';
import { S, isMobile } from './01-estado';
import { camera } from './02-render';
import { swingVar } from './04-poses';
import { human } from './06-modelos';
import { ball } from './07-glb';
import { ac, surf } from './08-audio';
import { $, dupla, el, feedback, isTouch, shotBtns } from './09-interface';
import { startJump, startToss } from './11-mira';
import { adjustFov, rkInfo, startFromMenu, syncAssistButtons, toggleAssist } from './15-carreira-telas';
import { humanPlan, playStyleOf } from './16-ia';
import { sideOf } from './18-animacao';
// ---------- Controles ----------
const keys = {};
const touch = { x: 0, z: 0, id: null };
const MTR = { active: false, kind: null, type: null, t: 0, v: 0, rate: 0, fill: .75, center: .78, half: .068, armedTap: false, showT: 0 };
const ZONE = { facil: .095, medio: .068, dificil: .048 };
const RES_WORD = { perfeito: 'PERFEITO', cedo: 'CEDO', tarde: 'TARDE' };
const LOB_MAX = 1.25;
// bola que vem de um lob alto cai mais rápido: a faixa perfeita do smash fica menor
function smashZoneScale() { return clamp(1.2 - ((ball.apex || 3.5) - 3.5) * .12, .45, 1.2); }
function smashIdealPoint() {
  if (ball.state !== 'live') return null;
  const pos = ball.pos.clone(), vel = ball.vel.clone(); const dt = .01;
  for (let t = 0; t < 3; t += dt) {
    vel.y -= bG() * dt; pos.addScaledVector(vel, dt);
    if (vel.y < 0 && pos.y <= 2.45) return pos;
    if (pos.y < C.ballR) return pos;
  }
  return null;
}
function startMeter(kind, type) {
  Object.assign(MTR, { active: true, kind, type, t: 0, v: 0, rate: 0, armedTap: false, showT: 0 });
  const half = ZONE[S.settings.diff];
  if (kind === 'smash') {
    // a faixa verde fica parada; a velocidade da barra se ajusta para o verde coincidir com a chegada da bola
    MTR.fill = .75; MTR.half = half; MTR.center = .78; human.charging = true; MTR.ideal = smashIdealPoint();
  }
  else if (kind === 'lob') { MTR.fill = .45; MTR.center = -1; MTR.half = 0; human.charging = true; }
  else { MTR.fill = .9; MTR.center = TOSS_T / .9; MTR.half = half * ({ defesa: 1.5, lob: 1.3, curta: 1.2, smash: 1 }[type] || 1); }
  if (kind === 'smash') MTR.half *= smashZoneScale() * clamp((human.char.a.smash - 35) / 58, .3, 1.1);
  if (kind === 'serve') MTR.half *= clamp((human.char.a.saque - 35) / 55, .3, 1.15);
  el.meter.className = kind === 'lob' ? 'lobm' : ''; el.meter.hidden = false; el.mRes.textContent = '';
  el.mLbl.textContent = kind === 'smash' ? 'SMASH' : kind === 'lob' ? 'LOB' : 'SAQUE';
  if (kind === 'lob') { el.mZone.style.bottom = (100 / LOB_MAX) + '%'; el.mZone.style.height = (100 - 100 / LOB_MAX) + '%'; }
  else { el.mZone.style.bottom = ((MTR.center - MTR.half) * 100) + '%'; el.mZone.style.height = (MTR.half * 200) + '%'; }
  el.mFill.style.height = '0%';
}
const _ts = new V3();
function timeToSmash(p) {
  if (ball.state !== 'live' || S.lastTeam === p.team) return null;
  p.model.armR.sh.getWorldPosition(_ts); _ts.y += Math.max(0, .25 - p.model.group.position.y);
  const pos = ball.pos.clone(), vel = ball.vel.clone(); const dt = .01;
  for (let t = 0; t < 2.5; t += dt) {
    const side = p.team === 0 ? pos.z > .05 : pos.z < -.05;
    if (side && pos.y >= 1.75 && pos.distanceTo(_ts) <= .95 * hScale(p)) return t;
    if (side && pos.y < 1.75 && pos.y >= .12 && Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z) <= 1.2) return t;
    vel.y -= bG() * dt; pos.addScaledVector(vel, dt);
    if (pos.y < C.ballR) return null;
  }
  return null;
}
// segundos até a bola entrar no alcance do jogador (null se não entra)
function timeToReach(p) {
  if (ball.state !== 'live' || S.lastTeam === p.team) return null;
  const pos = ball.pos.clone(), vel = ball.vel.clone(); const dt = .01;
  for (let t = 0; t < 2.5; t += dt) {
    const f0 = p.team === 0 ? 1 : -1;
    if ((p.team === 0 ? pos.z > .05 : pos.z < -.05) && pos.y >= 1.75 && Math.hypot(pos.x - (p.pos.x + .2 * f0), pos.y - 1.75, pos.z - p.pos.z) <= 1.0) return t;
    if ((p.team === 0 ? pos.z > .05 : pos.z < -.05) && pos.y < 1.75 && pos.y >= .12 && Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z) <= 1.2) return t;
    vel.y -= bG() * dt; pos.addScaledVector(vel, dt);
    if (pos.y < C.ballR) return null;
  }
  return null;
}
function cancelMeter() { MTR.active = false; human.charging = false; el.meter.hidden = true; }
function releaseMeter() {
  if (!MTR.active) return;
  const v = MTR.v, diff = v - MTR.center;
  if (MTR.kind === 'lob') {
    const lv = Math.min(v, LOB_MAX);
    const word = lv < .35 ? 'BAIXO' : lv < .75 ? 'MÉDIO' : lv <= 1 ? 'ALTO' : 'LONGO';
    MTR.active = false; MTR.showT = .9;
    el.meter.className = 'lobm ' + (lv < .35 ? 'cedo' : lv <= 1 ? (lv >= .75 ? 'perfeito' : '') : 'tarde');
    el.mRes.textContent = word; el.mFill.style.height = (lv / LOB_MAX * 100) + '%';
    human.charging = false;
    const sw = human.swing; sw.dur = SWING_DUR; sw.t = sw.dur * .3; sw.type = 'lob'; sw.hit = false; sw.meter = null; sw.lob = { power: lv, word }; sw.side = sideOf(human); sw.var = '';
    return;
  }
  const res = Math.abs(diff) <= MTR.half ? 'perfeito' : diff < 0 ? 'cedo' : 'tarde';
  const amt = clamp((Math.abs(diff) - MTR.half) / .3, 0, 1);
  MTR.active = false; MTR.showT = .9;
  el.meter.className = res; el.mRes.textContent = RES_WORD[res];
  el.mFill.style.height = (clamp(v, 0, 1) * 100) + '%';
  if (MTR.kind === 'smash') {
    human.charging = false;
    const sw = human.swing; sw.dur = SWING_DUR; sw.t = sw.dur * .3; sw.type = 'smash'; sw.hit = false; sw.meter = { res, amt, ideal: MTR.ideal }; sw.hold = 0; sw.var = swingVar('smash', ball.pos.y, human);
    if (ball.state === 'live' && ball.pos.y > 1.6) startJump(human, .42, .3);
  } else serveRelease(res, amt);
}
function serveRelease(res, amt) {
  if (S.mode !== 'toss' || S.serverPlayer !== human) return;
  const type = S.serveType; let q, mod;
  if (res === 'perfeito') { q = 1; mod = { speedMul: type === 'smash' ? 1.15 : 1, oppMissBoost: type === 'smash' ? .12 : .04 }; }
  else if (res === 'cedo') { q = .7 - .25 * amt; mod = { speedMul: .88 - .1 * amt }; }
  else { q = .5 - .25 * amt; mod = { misBoost: (type === 'smash' ? .3 : .12) + .3 * amt }; }
  // a batida acontece quando a raquete chega na bola (meio do movimento)
  human.pendingServe = { type, q, mod, res };
  const sw = human.swing; sw.t = sw.dur * .3; sw.type = 'smash'; sw.hit = false; sw.meter = null;
}
function pressShot(type) {
  ac();
  const b = shotBtns[type]; if (b) b.classList.add('press');
  if (S.paused) return;
  if (MTR.active && MTR.kind === 'serve' && MTR.armedTap) { releaseMeter(); return; }
  if (S.mode === 'serve' && S.serverPlayer === human) { startToss(human, type); startMeter('serve', type); return; }
  if (S.mode === 'rally' || S.mode === 'toss') {
    if (MTR.active && (MTR.kind === 'smash' || MTR.kind === 'lob')) cancelMeter();
    const sw = human.swing;
    if (sw.t >= 0 && sw.t < sw.dur * .8) return;
    if ((type === 'smash' || type === 'lob') && S.mode === 'rally') { sw.t = -1; sw.lob = null; startMeter(type, type); return; }
    sw.t = 0; sw.type = type; sw.dur = type === 'curta' ? .5 : SWING_DUR; sw.hit = false; sw.meter = null; sw.lob = null;
    sw.side = sideOf(human, humanPlan.id === S.hitId && humanPlan.plan ? humanPlan.plan.pt : null);
    sw.var = swingVar(type, humanPlan.id === S.hitId && humanPlan.plan ? humanPlan.plan.pt.y : ball.pos.y, human);
  }
}
function releaseShot(type) {
  const b = shotBtns[type]; if (b) b.classList.remove('press');
  if (!MTR.active) return;
  if (MTR.kind === 'serve') { if (MTR.t < .15) { MTR.armedTap = true; return; } releaseMeter(); }
  else if (type === MTR.type) releaseMeter();
}
const SHOT_KEYS = { j: 'smash', '1': 'smash', k: 'lob', '2': 'lob', l: 'curta', '3': 'curta', ' ': 'defesa', '4': 'defesa' };
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT' && (e.target.type === 'text' || e.target.type === 'number')) return;
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  keys[k] = true;
  if (e.repeat) return;
  if (!el.menu.hidden || !el.over.hidden) { if (k === 'enter' && !el.menu.hidden && !(document.activeElement && document.activeElement.tagName === 'BUTTON')) startFromMenu(); return; }
  if (SHOT_KEYS[k]) pressShot(SHOT_KEYS[k]);
  else if (k === 'c') toggleCam();
  else if (k === 'p' || k === 'escape') togglePause();
  else if (k === 'm') toggleSound();
  else if (k === '-' || k === '=' || k === '+') adjustFov(k === '-' ? -5 : 5);
  else if (k === 'b') toggleAssist('assistMove');
  else if (k === 'n') toggleAssist('assistMark');
  else if (k === 'v') { S.settings.aimArrow = S.settings.aimArrow === false; saveSettings(); feedback('MIRA', S.settings.aimArrow ? 'LIGADA' : 'DESLIGADA', null); }
});
addEventListener('keyup', e => { const k = e.key.toLowerCase(); keys[k] = false; if (SHOT_KEYS[k]) releaseShot(SHOT_KEYS[k]); });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (inPlay()) setPaused(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && inPlay()) setPaused(true); });
const inPlay = () => ['serve', 'toss', 'rally', 'dead'].includes(S.mode);
Object.entries(shotBtns).forEach(([type, b]) => {
  b.addEventListener('pointerdown', e => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (er) {} pressShot(type); });
  ['pointerup', 'pointercancel'].forEach(ev => b.addEventListener(ev, e => { e.preventDefault(); releaseShot(type); }));
});
function stickMove(e) {
  const r = el.stick.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let dx = e.clientX - cx, dy = e.clientY - cy; const R = r.width / 2 - 10; const d = Math.hypot(dx, dy);
  if (d > R) { dx *= R / d; dy *= R / d; }
  el.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  touch.x = dx / R; touch.z = dy / R;
}
el.stick.addEventListener('pointerdown', e => { e.preventDefault(); touch.id = e.pointerId; el.stick.setPointerCapture(e.pointerId); stickMove(e); });
el.stick.addEventListener('pointermove', e => { if (e.pointerId === touch.id) stickMove(e); });
const stickEnd = e => { if (e.pointerId !== touch.id) return; touch.id = null; touch.x = touch.z = 0; el.knob.style.transform = ''; };
el.stick.addEventListener('pointerup', stickEnd); el.stick.addEventListener('pointercancel', stickEnd);
function enableTouch() { document.body.classList.add('touch'); el.stick.hidden = false; }
if (isMobile) enableTouch();
addEventListener('touchstart', () => { if (!isTouch()) enableTouch(); }, { passive: true, once: true });
function applyCam() {
  const fp = S.settings.cam === '1p';
  el.btnCam.firstChild.textContent = fp ? '1ª pessoa' : '3ª pessoa';
  camera.fov = fp ? (S.settings.fovFp || 72) : (dupla() ? 58 : 55); camera.updateProjectionMatrix();
  const r = $('fovFp'); if (r) { r.value = S.settings.fovFp || 72; $('fovFpV').textContent = r.value + '°'; }
}
function toggleCam() { S.settings.cam = S.settings.cam === '1p' ? '3p' : '1p'; applyCam(); saveSettings(); }
function toggleSound() {
  S.muted = !S.muted; el.btnSnd.firstChild.textContent = S.muted ? 'Som desligado' : 'Som ligado';
  if (surf) surf.g.gain.value = 0;
}
function setPaused(v) { if (!inPlay() && v) return; S.paused = v; el.pause.hidden = !v; if (v) { syncAssistButtons(); $('btnResume').focus(); } }
function togglePause() { if (!inPlay()) return; setPaused(!S.paused); }
function saveSettings() { try { localStorage.setItem('pdo-settings', JSON.stringify(S.settings)); } catch (e) {} }
function readMenu() {
  const v = n => document.querySelector(`input[name=${n}]:checked`).value;
  S.settings.mode = v('mode'); S.settings.cam = v('cam'); S.settings.diff = v('diff'); S.settings.games = +v('len'); S.settings.gfx = v('gfx'); S.settings.racket = $('rkSel').value || 'proteo'; S.settings.players = v('players'); S.settings.side = v('side') || 'direita'; S.settings.uniforms = v('uniforms') || 'uniforme';
  S.settings.assistMove = $('assistMove').checked; S.settings.assistMark = $('assistMark').checked; S.settings.aimArrow = $('aimArrow').checked;
  saveSettings();
}
function syncMenu() {
  const set = (name, v) => { const i = document.querySelector(`input[name=${name}][value="${v}"]`); if (i) i.checked = true; };
  set('mode', S.settings.mode); set('cam', S.settings.cam); set('diff', S.settings.diff); set('len', S.settings.games); set('gfx', S.settings.gfx); $('rkSel').value = RACKET_STATS[S.settings.racket] ? S.settings.racket : 'proteo'; rkInfo(); set('players', S.settings.players); set('side', S.settings.side || 'direita'); set('uniforms', S.settings.uniforms || 'uniforme'); set('gender', S.settings.gender);
  $('assistMove').checked = !!S.settings.assistMove; $('assistMark').checked = !!S.settings.assistMark; $('aimArrow').checked = S.settings.aimArrow !== false;
  renderRoster();
}
const SLOT_LABEL = { me: 'Você', mate: 'Sua dupla', o1: 'Adversário', o2: 'Adversário 2' };
const activeSlots = () => dupla() ? ['me', 'mate', 'o1', 'o2'] : ['me', 'o1'];
// personagens disponíveis no filtro, do maior overall para o menor
function pool() {
  const g = S.settings.gender;
  return ROSTER.filter(c => g === 'mista' || (g === 'fem' ? c.fem : !c.fem)).sort((x, y) => overall(y.a) - overall(x.a));
}
function fixPicks() {
  const pl = pool(), used = new Set();
  activeSlots().forEach(k => {
    const id = S.settings.pick[k];
    if (pl.some(c => c.id === id) && !used.has(id)) { used.add(id); return; }
    const free = pl.find(c => !used.has(c.id)); if (free) { S.settings.pick[k] = free.id; used.add(free.id); }
  });
}
function renderPick(slot) {
  const box = document.querySelector('.pick[data-slot="' + slot + '"]'); if (!box) return;
  const c = charById(S.settings.pick[slot]);
  box.hidden = !activeSlots().includes(slot);
  const others = new Set(activeSlots().filter(k => k !== slot).map(k => S.settings.pick[k]));
  const opts = pool().map(o => '<option value="' + o.id + '"' + (o.id === c.id ? ' selected' : '') + (others.has(o.id) ? ' disabled' : '') + '>' + overall(o.a) + ' · ' + nameOf(o).replace(/</g, '') + ' (' + o.pais + ')' + (others.has(o.id) ? ' · em uso' : '') + '</option>').join('');
  const bars = ATTRS.map(([k, lbl]) => { const v = c.a[k]; return '<span>' + lbl + '</span><span class="bar"><i class="' + (v >= 85 ? 'hi' : v <= 65 ? 'lo' : '') + '" style="width:' + v + '%"></i></span><b>' + v + '</b>'; }).join('');
  box.innerHTML = '<div class="pick-h"><span class="who">' + SLOT_LABEL[slot] + '</span><button type="button" class="arw" data-d="-1" aria-label="Anterior">‹</button><button type="button" class="arw" data-d="1" aria-label="Próximo">›</button></div>'
    + '<select class="psel" id="sel-' + slot + '" aria-label="Escolher jogador da lista">' + opts + '</select>'
    + '<div class="pick-top"><div style="min-width:0"><input class="pnm" type="text" id="nm-' + slot + '" maxlength="28" aria-label="Nome do jogador"><div class="meta"><span>' + c.pais + ' · ' + c.estilo + ' · joga ' + PLAY_STYLES[playStyleOf(c)].nome.toLowerCase() + ' · ' + ({ compacto: 'compacto', forte: 'forte', esguio: 'esguio', atletico: 'atlético' }[c.build] || 'atlético') + (c.canhoto ? ' · canhoto' : ' · destro') + (c.fem ? ' · feminino' : ' · masculino') + '</span><label>Altura <input class="palt" type="number" min="150" max="215" id="alt-' + slot + '" value="' + Math.round(heightOf(c) * 100) + '"> cm</label></div></div>'
    + '<div class="ovr">' + overall(c.a) + '<small>OVR</small></div></div><div class="bars">' + bars + '</div>';
  const inp = box.querySelector('.pnm'); inp.value = nameOf(c);
  inp.addEventListener('input', () => { NAMES[c.id] = inp.value; try { localStorage.setItem('pdo-names', JSON.stringify(NAMES)); } catch (e) {} });
  inp.addEventListener('change', renderRoster);
  const ai = box.querySelector('.palt');
  ai.addEventListener('change', () => { const v = clamp(Math.round(+ai.value || 0), 150, 215); ai.value = v; HEIGHTS[c.id] = v; try { localStorage.setItem('pdo-heights', JSON.stringify(HEIGHTS)); } catch (e) {} });
  box.querySelector('.psel').addEventListener('change', e => { S.settings.pick[slot] = e.target.value; saveSettings(); renderRoster(); });
  box.querySelectorAll('.arw').forEach(b => b.addEventListener('click', () => cyclePick(slot, +b.dataset.d)));
}
function renderRoster() { fixPicks(); ['me', 'mate', 'o1', 'o2'].forEach(renderPick); }
function cyclePick(slot, d) {
  const pl = pool(); if (!pl.length) return;
  const used = new Set(activeSlots().filter(k => k !== slot).map(k => S.settings.pick[k]));
  let i = pl.findIndex(c => c.id === S.settings.pick[slot]);
  for (let n = 0; n < pl.length; n++) { i = (i + d + pl.length) % pl.length; if (!used.has(pl[i].id)) break; }
  S.settings.pick[slot] = pl[i].id; saveSettings(); renderRoster();
}
document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', () => { S.settings.mode = r.value; renderRoster(); }));
document.querySelectorAll('input[name=gender]').forEach(r => r.addEventListener('change', () => { S.settings.gender = r.value; saveSettings(); renderRoster(); }));

export { LOB_MAX, MTR, RES_WORD, applyCam, cancelMeter, inPlay, keys, readMenu, releaseMeter, saveSettings, setPaused, syncMenu, timeToSmash, toggleCam, togglePause, toggleSound, touch };
