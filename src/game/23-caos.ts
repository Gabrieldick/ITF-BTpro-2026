// @ts-nocheck
// ---------- Modo Caos (partida rápida): poderes ----------
// Quem está sem poder ganha um sorteado (no começo do ponto ou, depois de usar um, 3 rebatidas depois que ele acabar). Usa quando quiser (E no teclado, LB no controle; jogador 2
// sem controle: 9). Alguns valem na hora por alguns segundos, outros "armam" o próximo golpe. A CPU usa os dela também.
import { $s } from '../state';
import { S, NET } from './01-estado';
import { ball, ballMesh, sparkle } from './07-glb';
import { human } from './06-modelos';
import { ROOF } from './03-cenario';
import { G } from './00-base';

const POWERS = {
  // os de tempo (now = segundos) também acabam quando o ponto acaba
  turbo: { nome: 'Turbo', ic: '⚡', desc: 'corre muito mais rápido por 5 s', now: 5 },
  ima: { nome: 'Ímã', ic: '🧲', desc: 'alcança bolas bem mais longe por 6 s', now: 6 },
  gelo: { nome: 'Gelo', ic: '❄️', desc: 'congela os adversários por 2 s', now: 2 },
  gigante: { nome: 'Gigante', ic: '🦒', desc: 'fica gigante por 7 s: alcança bolas muito mais altas e longe', now: 7 },
  curupira: { nome: 'Curupira', ic: '👣', desc: 'vira os pés dos adversários por 5 s: controles de movimento invertidos (a CPU fica perdida e lenta)', now: 5 },
  ouro: { nome: 'Mão de ouro', ic: '✨', desc: 'tudo no verde por 8 s: barras perfeitas e curtas no tempo certo', now: 8 },
  bomba: { nome: 'Bomba', ic: '💣', desc: 'o próximo golpe sai fortíssimo' },
  curva: { nome: 'Curva maluca', ic: '🌀', desc: 'a próxima bola vai serpenteando: para os lados, para frente e para trás' },
  lua: { nome: 'Lob lunar', ic: '🌙', desc: 'o próximo golpe vira um lob que vai às alturas e despenca no fundo' },
  fantasma: { nome: 'Bola fantasma', ic: '👻', desc: 'a próxima bola some no meio do caminho' },
  muralha: { nome: 'Muralha', ic: '🛡️', desc: 'a próxima devolução nunca erra' },
};
const KEYS = Object.keys(POWERS);
// (no online quem roda os poderes é o anfitrião; o convidado manda o "usar" e recebe o estado de cada um)
const caosOn = () => S.settings.gm === 'caos' && !S.careerActive && !S.champActive && !S.drill && !S.tutorial;
const now = () => performance.now() / 1000;
const CD = 3; // rebatidas de espera depois que o poder acaba
let hits = 0; // rebatidas contadas no modo Caos
const live = () => S.mode === 'serve' || S.mode === 'toss' || S.mode === 'rally';

// ---------- painel: o seu poder (e o do jogador 2 no mesmo PC) ----------
let hud = null, toastT = 0;
function hudEl() {
  if (hud) return hud;
  hud = document.createElement('div'); hud.id = 'caosHud'; hud.hidden = true;
  hud.innerHTML = '<div class="cz-me"></div><div class="cz-p2"></div><div class="cz-toast"></div>';
  document.body.append(hud); return hud;
}
const slotHTML = (p, key, who) => {
  if (!p || (p === human && S.spectate)) return '';
  return slotMain(p, key, who) + (caosInvert(p) ? '<small class="inv">👣 Curupira: controles invertidos!</small>' : p.pwFrozen > now() ? '<small class="inv">❄️ congelado</small>' : '');
};
const slotMain = (p, key, who) => {
  const held = p.pw && POWERS[p.pw], armed = p.pwNext && POWERS[p.pwNext], on = p.pwOn && p.pwOn.until > now() && POWERS[p.pwOn.id];
  if (armed) return '<b class="arm">' + armed.ic + ' ' + armed.nome + '</b><small>' + who + 'armado: ' + armed.desc + '</small>';
  if (on) return '<b class="on">' + on.ic + ' ' + on.nome + '</b><small>' + who + 'ativo · ' + Math.ceil(p.pwOn.until - now()) + ' s</small>';
  if (held) return '<b>' + held.ic + ' ' + held.nome + ' <kbd>' + key + '</kbd></b><small>' + who + held.desc + '</small>';
  const w = p.pwReady ? p.pwReady - hits : 0;
  return '<b class="none">sem poder</b><small>' + who + (w > 0 ? 'novo poder em ' + w + (w === 1 ? ' rebatida' : ' rebatidas') : 'ganha outro no próximo ponto') + '</small>';
};
// quem usou, do ponto de vista de quem está nesta tela
const whoOf = p => p === human ? 'Você' : p.isHuman && !p.netHuman ? 'Jogador 2' : p.team === human.team ? 'Parceiro' : 'Adversário';
function caosNotify(p, id, isNew) {
  const P = pwId(id) && POWERS[id]; if (!p || !P) return;
  if (isNew) { if (p === human && !S.spectate) toast('Novo poder: ' + P.ic + ' ' + P.nome); else if (p.isHuman && !p.netHuman) toast('J2 · novo poder: ' + P.ic + ' ' + P.nome); return; }
  sparkle({ x: p.pos.x, y: 1.4, z: p.pos.z });
  toast(whoOf(p) + ' usou ' + P.ic + ' ' + P.nome);
}
function toast(txt) { const h = hudEl(), t = h.querySelector('.cz-toast'); t.textContent = txt; t.classList.add('show'); toastT = 1.6; }

// ---------- usar ----------
function caosActivate(p) {
  if (!caosOn() || !p || !p.pw || !live()) return false;
  if (NET.role === 'guest') { if (p === human && !S.spectate && NET.caosUse) NET.caosUse(); return false; } // convidado: pede ao anfitrião
  const id = p.pw, P = POWERS[id], t = now(); p.pw = null;
  if (P.now) {
    p.pwOn = { id, until: t + P.now };
    if (id === 'gelo') $s.players.forEach(o => { if (o.team !== p.team) o.pwFrozen = t + P.now; });
    if (id === 'curupira') $s.players.forEach(o => { if (o.team !== p.team) o.pwInv = t + P.now; });
  } else p.pwNext = id;
  caosNotify(p, id, false);
  if (NET.role === 'host' && NET.ev) NET.ev('caos', p, [id, 0]);
  return true;
}

// ---------- efeitos ----------
function caosSpeedK(p) {
  if (!caosOn() || !p) return 1;
  const t = now(); let k = 1;
  if (p.pwOn && p.pwOn.id === 'turbo' && p.pwOn.until > t) k *= 1.4;
  if (p.pwFrozen && p.pwFrozen > t) k *= .25;
  if (!p.isHuman && !p.netHuman && caosInvert(p)) k *= .6; // CPU com os pés virados: perdida e lenta
  return k;
}
// curupira: o movimento de quem foi atingido sai invertido
const caosInvert = p => caosOn() && p && p.pwInv && p.pwInv > now();
const pwActive = (p, id) => caosOn() && p && p.pwOn && p.pwOn.id === id && p.pwOn.until > now();
const caosReachK = p => pwActive(p, 'ima') ? 1.5 : pwActive(p, 'gigante') ? 1.3 : 1;
// gigante: alcança ~2 m mais alto (para cima); mão de ouro: golpes sempre no tempo certo
const caosTallM = p => pwActive(p, 'gigante') ? 2 : 0;
const caosGold = p => pwActive(p, 'ouro');
// golpe de quem armou um poder: muda o golpe (chamado no doHit); devolve o que o doHit ainda precisa fazer
function caosShot(p, key, spec, mod, isServe) {
  if (!caosOn() || !p || !p.pwNext) return null;
  const id = p.pwNext; p.pwNext = null; p.pwReady = hits + 1 + CD; // esta batida não conta na espera
  const P = POWERS[id], out = { id };
  if (id === 'bomba') { if (spec.speed) spec.speed *= 1.45; if (spec.T) spec.T *= .72; mod.oppMissBoost = (mod.oppMissBoost || 0) + .3; }
  else if (id === 'curva') out.crazy = true;
  else if (id === 'lua') { // ~14 m de altura (no ginásio, até um pouco abaixo do teto)
    const top = ROOF.h ? Math.min(14, ROOF.h - 1.2) : 14, gk = 1.2; // gravidade forte: despenca rápido
    spec.T = Math.sqrt(8 * Math.max(4, top - ball.pos.y) / (G * gk)); spec.gk = gk; spec.depth = [6.8, 7.6]; spec.margin = 1; delete spec.speed; spec.lowArc = false; spec.lunar = true; mod.oppMissBoost = (mod.oppMissBoost || 0) + .15; }
  else if (id === 'muralha') out.shield = true;
  else if (id === 'fantasma') out.ghost = true;
  spec.label = P.ic + ' ' + P.nome.toUpperCase();
  return out;
}
// depois da batida: a bola fantasma some um pouco depois de sair da raquete e reaparece perto de quem vai receber
function caosAfterHit(fx) {
  ball.ghost = fx && fx.ghost ? { t0: now() } : null;
  ball.crazy = fx && fx.crazy ? { t: 0 } : null;
  if (!caosOn()) return;
  hits++;
  // espera acabou: ganha um poder novo na hora
  $s.players.forEach(p => { if (p.pwReady && hits >= p.pwReady && !p.pw && !p.pwNext && !p.pwOn) give(p); });
}
function give(p) {
  p.pw = KEYS[Math.floor(Math.random() * KEYS.length)]; p.pwReady = 0;
  caosNotify(p, p.pw, true);
  if (NET.role === 'host' && NET.ev) NET.ev('caos', p, [p.pw, 1]);
}

// ---------- curva maluca ----------
// desvio do trajeto: x = Ax·sen(π·kx·t/T), z = Az·sen(π·kz·t/T) (com kx, kz inteiros os dois voltam a zero no quique)
function crazyStep(dt) {
  const c = ball.crazy;
  if (ball.state !== 'live') { ball.crazy = null; return; }
  if (!c.T) { // primeiro passo depois da batida: tempo até o quique e o desenho da curva
    const g = G * (ball.gk || 1), y = ball.pos.y, vy = ball.vel.y;
    c.T = Math.max(.6, (vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * y))) / g);
    c.kx = 2 + Math.floor(Math.random() * 2); c.kz = 1 + Math.floor(Math.random() * 2);
    c.ax = (Math.random() < .5 ? -1 : 1) * (1.6 + Math.random() * 1.2);
    // para frente/trás: sem fazer a bola voltar para trás (velocidade do desvio < 60% da velocidade para a frente)
    const vz = Math.abs(ball.vel.z) || 1; c.az = (Math.random() < .5 ? -1 : 1) * Math.min(2.2, .6 * vz * c.T / (Math.PI * c.kz));
    c.ox = c.oz = 0;
  }
  c.t += dt;
  if (c.t >= c.T) { ball.pos.x -= c.ox; ball.pos.z -= c.oz; ball.crazy = null; return; }
  const u = Math.PI * c.t / c.T, ox = c.ax * Math.sin(u * c.kx), oz = c.az * Math.sin(u * c.kz);
  ball.pos.x += ox - c.ox; ball.pos.z += oz - c.oz; c.ox = ox; c.oz = oz;
}

// ---------- a cada passo ----------
let aiT = 0;
function caosStep(dt) {
  const h = hudEl(), on = caosOn() && S.mode !== 'menu' && S.mode !== 'replay';
  h.hidden = !on;
  if (!on) { if (ballMesh && !ballMesh.visible && ball.ghost) ballMesh.visible = true; ball.ghost = null; return; }
  // ponto acabou: os poderes de tempo acabam junto, mesmo com tempo sobrando
  if (S.mode === 'dead' || S.mode === 'over') endTimed();
  // acabou o tempo do poder: começa a espera pelo próximo
  else $s.players.forEach(p => { if (p.pwOn && p.pwOn.until <= now()) { p.pwOn = null; p.pwReady = hits + CD; } });
  // bola fantasma: some entre 0,25 s e 0,85 s depois da batida
  if (ball.ghost && ballMesh) { const a = now() - ball.ghost.t0; ballMesh.visible = !(a > .25 && a < .85 && ball.state === 'live'); if (a >= .85) ball.ghost = null; }
  // curva maluca: a bola serpenteia (para os lados e para frente/trás) e volta ao trajeto no quique, no lugar mirado
  if (ball.crazy) crazyStep(dt);
  // CPU: usa o poder em algum momento do ponto
  aiT -= dt;
  if (aiT <= 0) { aiT = .5; if (S.mode === 'rally') $s.players.forEach(p => { if (!p.isHuman && !p.netHuman && p.pw && Math.random() < .18) caosActivate(p); }); }
  caosVisual(h, dt);
}
// gigante (tamanho do boneco) e painel: no anfitrião/offline e no convidado
function caosVisual(h, dt) {
  // gigante: o boneco cresce (e volta ao tamanho normal no fim)
  $s.players.forEach(p => { const big = pwActive(p, 'gigante') ? 1.45 : 1, g = p.model && p.model.group; if (!g) return;
    const k = (p.caosK || 1); if (Math.abs(k - big) > .001) { const r = big / k; g.scale.multiplyScalar(r); if (p.skin && p.skin.holder) p.skin.holder.scale.multiplyScalar(r); p.caosK = big; } });
  // painel
  h.querySelector('.cz-me').innerHTML = slotHTML(human, 'E', '');
  const p2 = $s.players.find(p => p !== human && p.isHuman && !p.netHuman);
  const e2 = h.querySelector('.cz-p2'); e2.hidden = !p2; if (p2) e2.innerHTML = slotHTML(p2, '9', 'J2 · ');
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) h.querySelector('.cz-toast').classList.remove('show'); }
}
// ---------- online ----------
// anfitrião → convidado: o poder de cada jogador [na mão, armado, ativo, s restantes, gelo s, curupira s, rebatidas de espera]
const r1 = x => Math.round(x * 10) / 10;
const left = u => (u && u > now() ? r1(Math.min(99, u - now())) : 0);
function caosPack(p) {
  return [p.pw || '', p.pwNext || '', p.pwOn ? p.pwOn.id : '', p.pwOn ? left(p.pwOn.until) : 0, left(p.pwFrozen), left(p.pwInv), p.pwReady ? Math.max(0, p.pwReady - hits) : 0];
}
const pwId = x => (typeof x === 'string' && Object.prototype.hasOwnProperty.call(POWERS, x) ? x : null);
const sec = x => Math.min(99, Math.max(0, +x || 0));
function caosUnpack(p, a) {
  if (!p) return;
  if (!Array.isArray(a)) { p.pw = p.pwNext = p.pwOn = null; p.pwFrozen = p.pwInv = p.pwReady = 0; return; }
  const t = now(), on = pwId(a[2]);
  p.pw = pwId(a[0]); p.pwNext = pwId(a[1]); p.pwOn = on ? { id: on, until: t + sec(a[3]) } : null;
  p.pwFrozen = sec(a[4]) ? t + sec(a[4]) : 0; p.pwInv = sec(a[5]) ? t + sec(a[5]) : 0;
  p.pwReady = Math.min(9, Math.max(0, Math.round(+a[6] || 0))); // (no convidado as rebatidas não contam: é o que falta)
}
// convidado: só painel e visual (quem roda os poderes é o anfitrião)
function caosGuestStep(dt) {
  const h = hudEl(), on = caosOn() && S.mode !== 'menu' && S.mode !== 'replay';
  h.hidden = !on; if (!on) return;
  caosVisual(h, dt);
}
// fim dos efeitos contínuos (fim do ponto): tira o poder ativo, o gelo e o tamanho de gigante
function endTimed() {
  $s.players.forEach(p => {
    if (p.pwOn) p.pwReady = hits + CD; // a espera começa quando o poder acaba
    p.pwOn = null; p.pwFrozen = 0; p.pwInv = 0;
    const k = p.caosK || 1; if (k !== 1 && p.model && p.model.group) { p.model.group.scale.multiplyScalar(1 / k); if (p.skin && p.skin.holder) p.skin.holder.scale.multiplyScalar(1 / k); } p.caosK = 1;
  });
}
// começo de cada ponto: quem está sem poder ganha um
function caosPointStart() {
  const on = caosOn();
  endTimed();
  if (NET.role === 'guest') return; // no online quem sorteia é o anfitrião (o convidado recebe o poder de cada um)
  $s.players.forEach(p => {
    if (!on) { p.pw = null; p.pwNext = null; p.pwReady = 0; return; }
    if (!p.pw && !p.pwNext && !(p.pwReady && hits < p.pwReady)) { p.pw = KEYS[Math.floor(Math.random() * KEYS.length)]; p.pwReady = 0; }
  });
  ball.ghost = null; ball.crazy = null; if (ballMesh) ballMesh.visible = true;
}

export { caosPack, caosUnpack, caosNotify, caosGuestStep, POWERS, caosInvert, caosTallM, caosGold, caosOn, caosActivate, caosSpeedK, caosReachK, caosShot, caosAfterHit, caosStep, caosPointStart };
