// @ts-nocheck
// ---------- Modo Caos (partida rápida): poderes ----------
// No começo de cada ponto, quem está sem poder ganha um sorteado. Usa quando quiser (E no teclado, LB no controle; jogador 2
// sem controle: 9). Alguns valem na hora por alguns segundos, outros "armam" o próximo golpe. A CPU usa os dela também.
import { $s } from '../state';
import { S, NET } from './01-estado';
import { ball, ballMesh, sparkle } from './07-glb';
import { human } from './06-modelos';

const POWERS = {
  // os de efeito contínuo valem até o fim do ponto
  turbo: { nome: 'Turbo', ic: '⚡', desc: 'corre muito mais rápido até o fim do ponto', now: 1 },
  ima: { nome: 'Ímã', ic: '🧲', desc: 'alcança bolas bem mais longe até o fim do ponto', now: 1 },
  gelo: { nome: 'Gelo', ic: '❄️', desc: 'deixa os adversários lentos até o fim do ponto', now: 1 },
  gigante: { nome: 'Gigante', ic: '🦒', desc: 'fica gigante até o fim do ponto: alcança bolas muito mais altas e longe', now: 1 },
  ouro: { nome: 'Mão de ouro', ic: '✨', desc: 'tudo no verde até o fim do ponto: barras perfeitas e curtas no tempo certo', now: 1 },
  bomba: { nome: 'Bomba', ic: '💣', desc: 'o próximo golpe sai fortíssimo' },
  curva: { nome: 'Curva maluca', ic: '🌀', desc: 'a próxima bola faz uma curva enorme' },
  lua: { nome: 'Lob lunar', ic: '🌙', desc: 'o próximo golpe vira um lob altíssimo que despenca no fundo' },
  fantasma: { nome: 'Bola fantasma', ic: '👻', desc: 'a próxima bola some no meio do caminho' },
  muralha: { nome: 'Muralha', ic: '🛡️', desc: 'a próxima devolução nunca erra' },
};
const KEYS = Object.keys(POWERS);
const caosOn = () => S.settings.gm === 'caos' && !S.careerActive && !S.champActive && !S.drill && !S.tutorial && !NET.role;
const now = () => performance.now() / 1000;
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
  if (!p) return '';
  const held = p.pw && POWERS[p.pw], armed = p.pwNext && POWERS[p.pwNext], on = p.pwOn && p.pwOn.until > now() && POWERS[p.pwOn.id];
  if (armed) return '<b class="arm">' + armed.ic + ' ' + armed.nome + '</b><small>' + who + 'armado: ' + armed.desc + '</small>';
  if (on) return '<b class="on">' + on.ic + ' ' + on.nome + '</b><small>' + who + 'ativo até o fim do ponto</small>';
  if (held) return '<b>' + held.ic + ' ' + held.nome + ' <kbd>' + key + '</kbd></b><small>' + who + held.desc + '</small>';
  return '<b class="none">sem poder</b><small>' + who + 'ganha outro no próximo ponto</small>';
};
function toast(txt) { const h = hudEl(), t = h.querySelector('.cz-toast'); t.textContent = txt; t.classList.add('show'); toastT = 1.6; }

// ---------- usar ----------
function caosActivate(p) {
  if (!caosOn() || !p || !p.pw || !live()) return false;
  const id = p.pw, P = POWERS[id], t = now(); p.pw = null;
  if (P.now) {
    p.pwOn = { id, until: Infinity };
    if (id === 'gelo') $s.players.forEach(o => { if (o.team !== p.team) o.pwFrozen = Infinity; });
  } else p.pwNext = id;
  sparkle({ x: p.pos.x, y: 1.4, z: p.pos.z });
  toast((p === human ? 'Você usou ' : p.isHuman ? 'Jogador 2 usou ' : p.team === human.team ? 'Parceiro usou ' : 'Adversário usou ') + P.ic + ' ' + P.nome);
  return true;
}

// ---------- efeitos ----------
function caosSpeedK(p) {
  if (!caosOn() || !p) return 1;
  const t = now(); let k = 1;
  if (p.pwOn && p.pwOn.id === 'turbo' && p.pwOn.until > t) k *= 1.4;
  if (p.pwFrozen && p.pwFrozen > t) k *= .55;
  return k;
}
const pwActive = (p, id) => caosOn() && p && p.pwOn && p.pwOn.id === id && p.pwOn.until > now();
const caosReachK = p => pwActive(p, 'ima') ? 1.5 : pwActive(p, 'gigante') ? 1.3 : 1;
// gigante: alcança ~2 m mais alto (para cima); mão de ouro: golpes sempre no tempo certo
const caosTallM = p => pwActive(p, 'gigante') ? 2 : 0;
const caosGold = p => pwActive(p, 'ouro');
// golpe de quem armou um poder: muda o golpe (chamado no doHit); devolve o que o doHit ainda precisa fazer
function caosShot(p, key, spec, mod, isServe) {
  if (!caosOn() || !p || !p.pwNext) return null;
  const id = p.pwNext; p.pwNext = null;
  const P = POWERS[id], out = { id };
  if (id === 'bomba') { if (spec.speed) spec.speed *= 1.45; if (spec.T) spec.T *= .72; mod.oppMissBoost = (mod.oppMissBoost || 0) + .3; }
  else if (id === 'curva') { spec.cA = [(Math.random() < .5 ? -1 : 1) * 7.5, 0]; spec.cAk = 1; }
  else if (id === 'lua') { spec.T = 3.1; spec.gk = .62; spec.depth = [6.8, 7.6]; spec.margin = 1; delete spec.speed; spec.lowArc = false; spec.lunar = true; mod.oppMissBoost = (mod.oppMissBoost || 0) + .15; }
  else if (id === 'muralha') out.shield = true;
  else if (id === 'fantasma') out.ghost = true;
  spec.label = P.ic + ' ' + P.nome.toUpperCase();
  return out;
}
// depois da batida: a bola fantasma some um pouco depois de sair da raquete e reaparece perto de quem vai receber
function caosAfterHit(fx) { ball.ghost = fx && fx.ghost ? { t0: now() } : null; }

// ---------- a cada passo ----------
let aiT = 0;
function caosStep(dt) {
  const h = hudEl(), on = caosOn() && S.mode !== 'menu' && S.mode !== 'replay';
  h.hidden = !on;
  if (!on) { if (ballMesh && !ballMesh.visible && ball.ghost) ballMesh.visible = true; ball.ghost = null; return; }
  // ponto acabou: os poderes de efeito contínuo acabam junto
  if (S.mode === 'dead' || S.mode === 'over') endTimed();
  // bola fantasma: some entre 0,25 s e 0,85 s depois da batida
  if (ball.ghost && ballMesh) { const a = now() - ball.ghost.t0; ballMesh.visible = !(a > .25 && a < .85 && ball.state === 'live'); if (a >= .85) ball.ghost = null; }
  // gigante: o boneco cresce (e volta ao tamanho normal no fim)
  $s.players.forEach(p => { const big = pwActive(p, 'gigante') ? 1.45 : 1, g = p.model && p.model.group; if (!g) return;
    const k = (p.caosK || 1); if (Math.abs(k - big) > .001) { const r = big / k; g.scale.multiplyScalar(r); if (p.skin && p.skin.holder) p.skin.holder.scale.multiplyScalar(r); p.caosK = big; } });
  // CPU: usa o poder em algum momento do ponto
  aiT -= dt;
  if (aiT <= 0) { aiT = .5; if (S.mode === 'rally') $s.players.forEach(p => { if (!p.isHuman && !p.netHuman && p.pw && Math.random() < .18) caosActivate(p); }); }
  // painel
  h.querySelector('.cz-me').innerHTML = slotHTML(human, 'E', '');
  const p2 = $s.players.find(p => p !== human && p.isHuman);
  const e2 = h.querySelector('.cz-p2'); e2.hidden = !p2; if (p2) e2.innerHTML = slotHTML(p2, '9', 'J2 · ');
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) h.querySelector('.cz-toast').classList.remove('show'); }
}
// fim dos efeitos contínuos (fim do ponto): tira o poder ativo, o gelo e o tamanho de gigante
function endTimed() {
  $s.players.forEach(p => {
    p.pwOn = null; p.pwFrozen = 0;
    const k = p.caosK || 1; if (k !== 1 && p.model && p.model.group) { p.model.group.scale.multiplyScalar(1 / k); if (p.skin && p.skin.holder) p.skin.holder.scale.multiplyScalar(1 / k); } p.caosK = 1;
  });
}
// começo de cada ponto: quem está sem poder ganha um
function caosPointStart() {
  const on = caosOn();
  endTimed();
  $s.players.forEach(p => {
    if (!on) { p.pw = null; p.pwNext = null; return; }
    if (!p.pw && !p.pwNext) p.pw = KEYS[Math.floor(Math.random() * KEYS.length)];
  });
  ball.ghost = null; if (ballMesh) ballMesh.visible = true;
}

export { POWERS, caosTallM, caosGold, caosOn, caosActivate, caosSpeedK, caosReachK, caosShot, caosAfterHit, caosStep, caosPointStart };
