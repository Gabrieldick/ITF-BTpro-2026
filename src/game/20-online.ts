// @ts-nocheck
// modo online: jogar com um amigo pelo navegador, sem servidor próprio (WebRTC ponto a ponto via PeerJS).
// O anfitrião roda a partida inteira (física, IA, placar) como no jogo normal; o convidado só manda as
// entradas (direção e golpes apertados/soltos) e desenha o estado que chega ~30 vezes por segundo,
// interpolando entre os dois últimos estados para ficar suave. No 1×1 o convidado está no time de cima:
// na tela dele tudo é espelhado, para ele jogar do lado de baixo como sempre.
import './19-loop';
import { $s } from '../state';
import { HEIGHTS, NAMES, ROSTER, charById } from './00-base';
import { S, NET } from './01-estado';
import { cpuA, cpuB, human, partner } from './06-modelos';
import { applyPlayerStyle, applyRackets, assignCharacters, ball, puff, resetTrail } from './07-glb';
import { ac, sndHit, sndSand } from './08-audio';
import { $, configureMode, el, feedback, hideBanner, newMatch, pointShow, renderBoard, serveBanner, showOver } from './09-interface';
import { defenseFlash } from './11-mira';
import { MTR, inPlay, makeRemoteCtl, meterDom, pressShot, readMenu, releaseShot, syncMenu } from './12-controles';
import { humanPlan, localInput } from './16-ia';

const PREFIX = 'ponto-de-ouro-sala-';            // prefixo do id no servidor público do PeerJS
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I, que confundem ao ditar o código
const PROTO = 1;                                 // versão das mensagens: os dois lados precisam da mesma
const SEND_MS = 33;                              // estado do anfitrião ~30 vezes por segundo
const INTERP_MS = 70;                            // o convidado desenha esse tanto no passado, para sempre ter dois estados
const TIMEOUT_MS = 8000;                         // sem nenhuma mensagem por esse tempo = conexão perdida
const PL = [human, partner, cpuA, cpuB];         // ordem fixa dos jogadores nas mensagens (a do anfitrião)
const PLAY_MODES = ['serve', 'toss', 'rally', 'dead'];

const ON = {
  peer: null, conn: null, open: false, code: '', rtt: 0, lastRecv: 0, hb: 0, backup: null,
  // anfitrião
  ctl: null, outq: [], lastSend: 0, prevMode: '', guestPick: null, mode: 'coop',
  // convidado
  G: null, mirror: false, buf: [], evq: [], offs: [], off: null, inMatch: false, prevMode2: '', inKey: '', inT: 0,
  mySmashes: 0, nameBak: null, boardKey: '', mrTimer: 0,
};
const r3 = x => Math.round(x * 1000) / 1000;

// ---------- tela ----------
const ui = {
  show(part) {
    el.menu.hidden = true; $('online').hidden = false;
    ['onStart', 'onHost', 'onGuest'].forEach(id => { $(id).hidden = id !== part; });
  },
  msg(text, ok) { const m = $('onMsg'); m.textContent = text || ''; m.hidden = !text; m.classList.toggle('ok', !!ok); },
  status() {
    const lat = ON.open && ON.rtt ? ' · ' + Math.round(ON.rtt) + ' ms' : '';
    if (NET.role === 'host') {
      $('onHostStatus').textContent = ON.open ? 'Amigo conectado' + lat + '.' : 'Esperando seu amigo entrar com o código…';
      $('onPlay').disabled = !ON.open;
    }
    if (NET.role === 'guest') $('onGuestStatus').textContent = (ON.open ? 'Conectado à sala ' + ON.code + lat : 'Conectando à sala ' + ON.code + '…') + '.';
    const chip = $('netChip');
    if (chip) { chip.hidden = !NET.role || !ON.open || !inPlay(); chip.textContent = 'Online' + lat; }
  },
};
function openOnline() {
  ac(); readMenu(); // usa o que está marcado no menu (modo, jogadores, dificuldade)
  ui.msg(''); ui.show(NET.role === 'host' ? 'onHost' : NET.role === 'guest' ? 'onGuest' : 'onStart');
  if (!NET.role) setTimeout(() => $('onCode').focus(), 0);
}
function closeOnline() { $('online').hidden = true; el.menu.hidden = false; syncMenu(); }

// ---------- conexão ----------
let PeerCls = null;
async function loadPeer() {
  if (!PeerCls) { const m = await import('peerjs'); PeerCls = m.Peer || m.default; }
  return PeerCls;
}
function openPeer(Peer, id) {
  return new Promise((res, rej) => {
    const p = id ? new Peer(id, { debug: 1 }) : new Peer({ debug: 1 });
    const t = setTimeout(() => { p.destroy(); rej({ type: 'timeout' }); }, 15000);
    p.once('open', () => { clearTimeout(t); res(p); });
    p.once('error', e => { clearTimeout(t); p.destroy(); rej(e); });
  });
}
const randCode = () => Array.from({ length: 5 }, () => ALPH[Math.floor(Math.random() * ALPH.length)]).join('');
function errText(e) {
  const t = e && e.type;
  if (t === 'peer-unavailable') return 'Sala não encontrada. Confira o código (e se a sala ainda está aberta).';
  if (t === 'browser-incompatible') return 'Este navegador não suporta WebRTC.';
  if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'timeout') return 'Não foi possível falar com o servidor de conexão. Verifique a internet e tente de novo.';
  return 'Erro na conexão' + (t ? ' (' + t + ')' : '') + '.';
}
function send(msg) { if (ON.conn && ON.open && ON.conn.open) { try { ON.conn.send(msg); } catch (e) {} } }
function backupSettings() { if (!ON.backup) ON.backup = JSON.parse(JSON.stringify(S.settings)); }
function wire(conn) {
  ON.conn = conn; ON.lastRecv = performance.now();
  conn.on('data', onData);
  conn.on('close', () => { if (ON.conn === conn) lost(); });
  conn.on('error', () => { if (ON.conn === conn) lost(); });
  clearInterval(ON.hb);
  ON.hb = setInterval(() => {
    if (!ON.conn) return;
    send(['ping', performance.now()]);
    if (ON.open && performance.now() - ON.lastRecv > TIMEOUT_MS) lost();
  }, 1000);
}
async function createRoom() {
  if (NET.role) return;
  $('onCreate').disabled = true; ui.msg('Criando a sala…', true);
  try {
    const Peer = await loadPeer();
    let peer = null, code = '';
    for (let i = 0; i < 4 && !peer; i++) {
      code = randCode();
      try { peer = await openPeer(Peer, PREFIX + code); } catch (e) { if (e.type !== 'unavailable-id') throw e; }
    }
    if (!peer) throw { type: 'unavailable-id' };
    ON.peer = peer; ON.code = code; NET.role = 'host'; backupSettings();
    peer.on('connection', conn => {
      if (ON.conn) { conn.on('open', () => { conn.send(['full']); setTimeout(() => conn.close(), 400); }); return; } // a sala é para 2
      wire(conn);
      conn.on('open', () => { ON.open = true; ON.lastRecv = performance.now(); ui.msg('Seu amigo entrou! Escolha o modo e comece.', true); ui.status(); });
    });
    peer.on('disconnected', () => { if (NET.role === 'host' && !peer.destroyed) peer.reconnect(); }); // caiu o servidor de sinalização; a conexão já feita continua
    peer.on('error', e => { if (e.type === 'peer-unavailable') return; if (!ON.open) ui.msg(errText(e)); });
    $('onCodeShow').textContent = code;
    ui.msg(''); ui.show('onHost'); ui.status();
  } catch (e) { ui.msg(errText(e)); }
  $('onCreate').disabled = false;
}
async function joinRoom() {
  if (NET.role) return;
  const code = ($('onCode').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 5) { ui.msg('O código tem 5 letras/números.'); return; }
  $('onJoin').disabled = true; ui.msg('Conectando à sala ' + code + '…', true);
  try {
    const Peer = await loadPeer();
    const peer = await openPeer(Peer, null);
    ON.peer = peer; ON.code = code;
    await new Promise((res, rej) => {
      const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      const t = setTimeout(() => rej({ type: 'timeout-conn' }), 15000);
      peer.on('error', e => { clearTimeout(t); rej(e); });
      conn.on('open', () => { clearTimeout(t); wire(conn); res(); });
    });
    NET.role = 'guest'; ON.open = true; backupSettings();
    send(['hello', { v: PROTO, pick: S.settings.pick.me }]);
    ui.msg(''); ui.show('onGuest'); ui.status();
  } catch (e) {
    if (ON.peer) { ON.peer.destroy(); ON.peer = null; }
    ui.msg(e && e.type === 'timeout-conn' ? 'A sala não respondeu. Pode ser bloqueio de rede (alguns roteadores/empresas impedem a conexão direta).' : errText(e));
  }
  $('onJoin').disabled = false;
}
// sai do online de vez (fecha a sala ou sai dela) e volta à tela do online com o aviso
function leave(msg) {
  const wasRole = NET.role;
  if (ON.conn) { send(['bye']); const c = ON.conn; setTimeout(() => { try { c.close(); } catch (e) {} }, 150); }
  const p = ON.peer; if (p) setTimeout(() => { try { p.destroy(); } catch (e) {} }, 200);
  clearInterval(ON.hb);
  Object.assign(ON, { peer: null, conn: null, open: false, code: '', rtt: 0, ctl: null, outq: [], G: null, mirror: false, buf: [], evq: [], offs: [], off: null, inMatch: false, guestPick: null });
  NET.role = null; NET.remote = [];
  clearRemote(); restoreNames();
  if (ON.backup) { for (const k in ON.backup) S.settings[k] = ON.backup[k]; ON.backup = null; }
  if (wasRole) toLobbyScreen();
  assignCharacters(); configureMode(); applyRackets(); applyPlayerStyle();
  ui.show('onStart'); ui.msg(msg || ''); ui.status();
}
// conexão caiu (ou o outro saiu)
function lost(msg) {
  if (!NET.role) return;
  if (NET.role === 'guest') { leave(msg || 'A conexão com a sala caiu. Volte a entrar com o código.'); return; }
  // anfitrião: a sala continua aberta esperando alguém entrar de novo
  const c = ON.conn; ON.conn = null; ON.open = false; clearInterval(ON.hb);
  if (c) setTimeout(() => { try { c.close(); } catch (e) {} }, 100);
  clearRemote(); toLobbyScreen();
  ui.show('onHost'); ui.msg(msg || 'Seu amigo desconectou. A sala continua aberta: ele pode entrar de novo com o mesmo código.'); ui.status();
}
// sai da partida (sem desconectar) para a tela da sala
function toLobbyScreen() {
  S.mode = 'menu'; S.paused = false; el.pause.hidden = true; el.over.hidden = true; el.menu.hidden = true;
  document.body.classList.add('in-menu'); document.body.classList.remove('in-replay'); $('replayBar').hidden = true;
  hideBanner(); el.meter.hidden = true; MTR.active = false; human.charging = false;
  ON.inMatch = false; ui.status();
}

// ---------- mensagens ----------
function onData(d) {
  if (!Array.isArray(d)) return;
  ON.lastRecv = performance.now();
  const k = d[0];
  if (k === 'ping') { send(['pong', d[1]]); return; }
  if (k === 'pong') { const r = performance.now() - d[1]; ON.rtt = ON.rtt ? ON.rtt * .7 + r * .3 : r; if (ON.ctl) ON.ctl.lag = Math.min(.3, (ON.rtt + INTERP_MS) / 1000); ui.status(); return; }
  if (k === 'bye') { lost(NET.role === 'host' ? 'Seu amigo saiu da sala. Ela continua aberta com o mesmo código.' : 'Quem criou a sala fechou a sala.'); return; }
  if (NET.role === 'host') hostData(d); else if (NET.role === 'guest') guestData(d);
}

// ---------- anfitrião ----------
function clearRemote() { for (const p of PL) if (p !== human) { p.isHuman = false; p.netHuman = false; p.mtr = null; p.inputX = 0; p.inputZ = 0; } NET.remote = []; ON.ctl = null; }
function hostData(d) {
  const c = ON.ctl, k = d[0];
  if (k === 'hello') {
    if (d[1] && d[1].v !== PROTO) { send(['old']); return; }
    ON.guestPick = d[1] && d[1].pick; return;
  }
  if (!c) return;
  if (k === 'i') { const s = c.p.team === 0 ? 1 : -1; c.ix = (+d[1] || 0) * s; c.iz = (+d[2] || 0) * s; c.assistMove = !!d[3]; return; } // time de cima: a tela dele é espelhada
  if (k === 's' && inPlay()) { if (d[2]) pressShot(d[1], c); else releaseShot(d[1], c); }
}
// começa uma partida: dupla (amigo é a sua dupla) ou 1×1 (amigo é o adversário)
function hostStart() {
  if (!ON.open) return;
  ON.mode = document.querySelector('input[name=onMode]:checked').value;
  const coop = ON.mode === 'coop', slot = coop ? 'mate' : 'o1';
  S.settings.mode = coop ? 'dupla' : 'simples'; S.settings.format = 'set';
  // o amigo joga com o personagem que ele escolheu como "Você" (se não for repetido)
  const used = (coop ? ['me', 'o1', 'o2'] : ['me']).map(k => S.settings.pick[k]);
  if (ON.guestPick && ROSTER.some(c => c.id === ON.guestPick) && !used.includes(ON.guestPick)) S.settings.pick[slot] = ON.guestPick;
  clearRemote();
  const p = coop ? partner : cpuA;
  p.isHuman = true; p.netHuman = true;
  ON.ctl = makeRemoteCtl(p); ON.ctl.lag = Math.min(.3, (ON.rtt + INTERP_MS) / 1000);
  NET.remote = [ON.ctl];
  S.careerActive = false; S.champActive = false;
  $('online').hidden = true; ON.outq = [];
  newMatch(); // chama onNewMatch (manda a configuração) e depois monta o primeiro ponto
}
function hostCfg() {
  const pk = Object.assign({}, S.settings.pick), ids = Object.values(pk);
  const names = {}, heights = {};
  ids.forEach(id => { if (NAMES[id]) names[id] = NAMES[id]; if (HEIGHTS[id]) heights[id] = HEIGHTS[id]; });
  return { mode: ON.mode, settings: { mode: S.settings.mode, games: S.settings.games, diff: S.settings.diff, format: S.settings.format }, pick: pk, names, heights, side: S.settings.side };
}
function meterOf(c) { const m = c && c.m; return m && m.active ? [m.kind, m.type, r3(m.t), r3(m.v), m.center, m.half] : null; }
function hostState(now) {
  return {
    t: now, m: S.mode, bs: ball.state, gk: ball.gk || 1, ap: ball.apex || 0,
    b: [ball.pos.x, ball.pos.y, ball.pos.z, ball.vel.x, ball.vel.y, ball.vel.z].map(r3),
    p: PL.map(p => {
      const sw = p.swing, M = p.charging ? (p.mtr || MTR) : null;
      return [r3(p.pos.x), r3(p.pos.z), r3(p.vel.x), r3(p.vel.z), r3(sw.t), sw.type, sw.dur, r3(sw.side || 0), sw.var || '', sw.hit ? 1 : 0,
        r3(p.jump || 0), p.jumpDur || 0, p.jumpH || 0, M ? M.type : 0, M ? r3(M.t) : 0, p.dive ? r3(p.dive.t) : -1, p.dive ? p.dive.dur : 0, r3(p.split || 0), r3(p.tossT || 0)];
    }),
    sc: S.score, sv: S.server, si: S.serverIdx, sp: PL.indexOf(S.serverPlayer), lt: S.lastTeam, hid: S.hitId, r: S.rally,
    w: S.wind || { x: 0, z: 0 }, ht: S.heat ? 1 : 0, pr: S.pressure || '', stk: S.streak || null, mt: meterOf(ON.ctl),
  };
}
function hostTick(now) {
  if (!ON.open) { ON.prevMode = S.mode; return; }
  if (S.mode === 'over' && ON.prevMode !== 'over' && ON.inMatch) {
    const ps = PL.map(p => { const k = $s.players.indexOf(p); return k >= 0 && S.pstats && S.pstats[k] ? S.pstats[k] : null; });
    ON.outq.push(['over', { w: S.matchWinner, st: S.stats, ps }]);
  }
  ON.prevMode = S.mode;
  const evs = ON.outq.splice(0);
  if (ON.ctl && ON.ctl.out.length) evs.push(...ON.ctl.out.splice(0));
  if (evs.length) send(['e', now, evs]);
  if (now - ON.lastSend >= SEND_MS) { ON.lastSend = now; send(['st', hostState(now)]); }
  if (inPlay() !== !$('netChip').hidden) ui.status();
}
NET.hostTick = hostTick;
NET.ev = (k, a, b) => {
  if (NET.role !== 'host' || !ON.open) return;
  if (k === 'hit') ON.outq.push(['hit', PL.indexOf(a), b]);
  else if (k === 'sand') ON.outq.push(['sand', r3(a), r3(b)]);
};
NET.onNewMatch = () => { if (NET.role !== 'host') return; ON.inMatch = true; ON.outq.push(['cfg', hostCfg()]); };
NET.onSetupPoint = () => { if (NET.role === 'host') ON.outq.push(['sv', PL.indexOf(S.serverPlayer)]); };
NET.onPoint = (w, ev, reason) => { if (NET.role === 'host') ON.outq.push(['pt', w, ev, reason, S.lastPoint]); };
// "Sair para o menu"/"Menu" no online: o anfitrião volta para a sala; o convidado também, a não ser no meio da partida (aí sai)
NET.onMenu = () => {
  if (NET.role === 'host') {
    if (ON.open) ON.outq.push(['lobby', inPlay() ? 'Quem criou a sala encerrou a partida.' : '']);
    hostTick(performance.now());
    clearRemote(); toLobbyScreen(); ui.show('onHost'); ui.msg(''); ui.status();
  } else if (NET.role === 'guest') {
    if (inPlay()) { leave('Você saiu da partida.'); return; }
    toLobbyScreen(); ui.show('onGuest'); ui.msg(''); ui.status();
  }
};

// ---------- convidado ----------
NET.shot = (type, down) => { if (ON.inMatch && inPlay()) send(['s', type, down ? 1 : 0]); };
function guestData(d) {
  const k = d[0], now = performance.now();
  if (k === 'st') {
    const s = d[1];
    ON.offs.push([now, now - s.t]); while (ON.offs.length && now - ON.offs[0][0] > 3000) ON.offs.shift();
    ON.off = Math.min(...ON.offs.map(o => o[1])); // menor atraso visto = relógio do anfitrião + viagem mais rápida
    ON.buf.push(s); if (ON.buf.length > 60) ON.buf.shift();
    return;
  }
  if (k === 'e') { for (const e of d[2]) ON.evq.push({ t: d[1], e }); return; }
  if (k === 'full') { leave('Essa sala já tem dois jogadores.'); return; }
  if (k === 'old') { leave('Vocês estão com versões diferentes do jogo. Recarreguem a página (Ctrl+F5) e tentem de novo.'); }
}
const mT = t => (t < 0 || !ON.mirror ? t : 1 - t);
const swap2 = a => (ON.mirror && a ? [a[1], a[0]] : a);
function restoreNames() {
  if (!ON.nameBak) return;
  for (const [id, [n, h]] of Object.entries(ON.nameBak)) { if (n === undefined) delete NAMES[id]; else NAMES[id] = n; if (h === undefined) delete HEIGHTS[id]; else HEIGHTS[id] = h; }
  ON.nameBak = null;
}
function guestStart(cfg) {
  const coop = cfg.mode === 'coop';
  ON.mirror = !coop;
  ON.G = coop ? [partner, human, cpuA, cpuB] : [cpuA, partner, human, cpuB]; // índice do anfitrião → boneco aqui
  const hp = cfg.pick;
  S.settings.pick = coop ? { me: hp.mate, mate: hp.me, o1: hp.o1, o2: hp.o2 } : { me: hp.o1, mate: hp.mate, o1: hp.me, o2: hp.o2 };
  Object.assign(S.settings, cfg.settings);
  S.settings.side = cfg.side === 'esquerda' ? 'direita' : 'esquerda'; // o amigo fica do outro lado da dupla
  const mine = charById(S.settings.pick.me);
  S.settings.racket = (mine.look && mine.look.racket) || S.settings.racket;
  // nomes e alturas personalizados do anfitrião (só na memória; voltam ao sair)
  restoreNames(); ON.nameBak = {};
  for (const id of Object.values(cfg.pick)) {
    ON.nameBak[id] = [NAMES[id], HEIGHTS[id]];
    if (cfg.names[id] !== undefined) NAMES[id] = cfg.names[id]; else delete NAMES[id];
    if (cfg.heights[id] !== undefined) HEIGHTS[id] = cfg.heights[id]; else delete HEIGHTS[id];
  }
  for (const p of PL) { p.isHuman = p === human; p.netHuman = p === ON.G[0]; p.mtr = null; }
  human.mtr = MTR;
  S.careerActive = false; S.champActive = false;
  $('online').hidden = true; document.body.classList.remove('in-replay'); $('replayBar').hidden = true;
  ON.mySmashes = 0; ON.boardKey = '';
  newMatch(true);
  ON.inMatch = true; ui.status();
}
function guestSetupPoint(i) {
  const sp = ON.G[i] || human;
  S.celebrate = null; S.mode = 'serve'; S.serverPlayer = sp; ball.state = 'held';
  $s.players.forEach(p => { p.swing.t = -1; p.swing.meter = null; p.charging = false; p.dive = null; });
  MTR.active = false; el.meter.hidden = true; humanPlan.id = -1;
  resetTrail(); renderBoard(); serveBanner(sp);
}
function guestOver(d) {
  S.matchWinner = mT(d.w);
  S.stats = { pts: swap2(d.st.pts), maxRally: d.st.maxRally, smashes: ON.mySmashes };
  S.pstats = [];
  d.ps.forEach((x, i) => { const k = $s.players.indexOf(ON.G[i]); if (k >= 0 && x) S.pstats[k] = x; });
  el.pause.hidden = true; el.meter.hidden = true;
  showOver();
  $('btnAgain').hidden = true; // quem recomeça é o anfitrião
  ui.status();
}
function guestEvent(e) {
  const k = e[0], m = ON.mirror ? -1 : 1;
  if (k === 'cfg') { guestStart(e[1]); return; }
  if (k === 'lobby') { toLobbyScreen(); ui.show('onGuest'); ui.msg(e[1] || ''); ui.status(); return; }
  if (!ON.inMatch) return;
  if (k === 'sv') guestSetupPoint(e[1]);
  else if (k === 'pt') {
    const w = mT(e[1]);
    S.lastPoint = Object.assign({}, e[4] || {}, { w });
    pointShow(w, e[2], e[3], false);
  } else if (k === 'hit') {
    sndHit(e[2]);
    if (e[2] === 1) { const me = ON.G[e[1]] === human; S.shake = me ? .25 : .1; if (me) ON.mySmashes++; }
  } else if (k === 'sand') { sndSand(); puff(e[1] * m, e[2] * m, 16, 1); }
  else if (k === 'fb') feedback(e[1], e[2], e[3]);
  else if (k === 'def') defenseFlash(e[1]);
  else if (k === 'ms') { Object.assign(MTR, { active: true, kind: e[1], type: e[2], center: e[3], half: e[4], t: 0, v: 0 }); clearTimeout(ON.mrTimer); meterDom(MTR); }
  else if (k === 'mr') {
    MTR.active = false; human.charging = false;
    el.meter.className = e[1]; el.mRes.textContent = e[2]; el.mFill.style.height = e[3] + '%'; el.meter.hidden = false;
    clearTimeout(ON.mrTimer); ON.mrTimer = setTimeout(() => { if (!MTR.active) el.meter.hidden = true; }, 900);
  } else if (k === 'mh') { MTR.active = false; el.meter.hidden = true; }
  else if (k === 'over') guestOver(e[1]);
}
// aplica o estado entre dois quadros do anfitrião (a = anterior, b = seguinte, k de 0 a 1)
function applyState(a, b, k) {
  const L = (x, y) => x + (y - x) * k, m = ON.mirror ? -1 : 1;
  ball.pos.set(L(a.b[0], b.b[0]) * m, L(a.b[1], b.b[1]), L(a.b[2], b.b[2]) * m);
  ball.vel.set(b.b[3] * m, b.b[4], b.b[5] * m);
  ball.state = b.bs; ball.gk = b.gk; ball.apex = b.ap;
  PL.forEach((_, i) => {
    const p = ON.G[i], pa = a.p[i], pb = b.p[i], sw = p.swing;
    p.pos.set(L(pa[0], pb[0]) * m, 0, L(pa[1], pb[1]) * m);
    p.vel.set(L(pa[2], pb[2]) * m, 0, L(pa[3], pb[3]) * m);
    const same = pa[5] === pb[5] && pa[4] >= 0 && pb[4] >= pa[4];
    sw.t = same ? L(pa[4], pb[4]) : pb[4]; sw.type = pb[5]; sw.dur = pb[6]; sw.side = pb[7]; sw.var = pb[8]; sw.hit = !!pb[9];
    p.jump = pb[10]; p.jumpDur = pb[11]; p.jumpH = pb[12];
    p.charging = !!pb[13];
    if (p === human) { if (p.charging) { MTR.type = pb[13]; MTR.t = pb[14]; } }
    else p.mtr = p.charging ? { type: pb[13], t: pb[14] } : null;
    p.dive = pb[15] >= 0 ? { t: pb[15], dur: pb[16], landed: true } : null;
    p.split = pb[17]; p.tossT = pb[18] >= pa[18] ? L(pa[18], pb[18]) : pb[18];
  });
  // barra de força do convidado
  if (b.mt) { MTR.active = true; MTR.kind = b.mt[0]; MTR.type = b.mt[1]; MTR.t = b.mt[2]; MTR.v = a.mt ? L(a.mt[3], b.mt[3]) : b.mt[3]; MTR.center = b.mt[4]; MTR.half = b.mt[5]; }
  else if (MTR.active) MTR.active = false;
  // placar e estado do ponto
  const sc = b.sc;
  S.score = ON.mirror ? { pts: swap2(sc.pts), games: swap2(sc.games), tb: sc.tb, stb: sc.stb, sets: swap2(sc.sets || [0, 0]), hist: (sc.hist || []).map(h => [h[1], h[0], h[2]]), stbDone: sc.stbDone } : sc;
  S.server = mT(b.sv); S.serverIdx = swap2(b.si); S.serverPlayer = b.sp >= 0 ? ON.G[b.sp] : null;
  S.lastTeam = mT(b.lt); S.hitId = b.hid; S.rally = b.r;
  S.wind = { x: b.w.x * m, z: b.w.z * m }; S.heat = !!b.ht; S.pressure = b.pr;
  S.streak = b.stk ? { team: mT(b.stk.team), n: b.stk.n } : null;
  if (PLAY_MODES.includes(S.mode)) {
    if (S.mode === 'serve' && b.m === 'toss') hideBanner();
    S.mode = b.m;
  }
  const key = JSON.stringify([S.score, S.server, S.streak && S.streak.n, S.wind.x > 0]);
  if (key !== ON.boardKey) { ON.boardKey = key; renderBoard(); }
}
function guestTick() {
  if (!ON.open) return;
  const now = performance.now();
  // entradas: direção a cada mudança (e de tempos em tempos, caso alguma se perca)
  if (ON.inMatch && inPlay()) {
    const [ix, iz] = localInput();
    human.inputX = ix; human.inputZ = iz; // só para a flecha de mira desenhada aqui
    const key = ix.toFixed(2) + ',' + iz.toFixed(2) + ',' + (S.settings.assistMove ? 1 : 0);
    if (key !== ON.inKey || now - ON.inT > 250) { ON.inKey = key; ON.inT = now; send(['i', +ix.toFixed(3), +iz.toFixed(3), S.settings.assistMove ? 1 : 0]); }
  }
  if (ON.off === null) return;
  const rt = now - ON.off - INTERP_MS;
  const buf = ON.buf;
  if (ON.inMatch && buf.length && PLAY_MODES.includes(S.mode)) {
    let i = buf.findIndex(s => s.t >= rt), a, b, k = 0;
    if (i === -1) { a = b = buf[buf.length - 1]; } // atrasou: segura o último estado
    else if (i === 0) { a = b = buf[0]; }
    else { a = buf[i - 1]; b = buf[i]; k = (rt - a.t) / Math.max(1, b.t - a.t); }
    if (i > 1) buf.splice(0, i - 1);
    if (PLAY_MODES.includes(b.m)) applyState(a, b, Math.min(1, Math.max(0, k)));
  } else if (buf.length > 3) buf.splice(0, buf.length - 3);
  while (ON.evq.length && ON.evq[0].t <= rt) guestEvent(ON.evq.shift().e);
}
NET.guestTick = guestTick;

// ---------- botões e atalhos ----------
$('btnOnline').addEventListener('click', openOnline);
$('onBack').addEventListener('click', closeOnline);
$('onCreate').addEventListener('click', createRoom);
$('onJoin').addEventListener('click', joinRoom);
$('onCode').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
$('onCode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); });
$('onPlay').addEventListener('click', () => { ac(); hostStart(); });
$('onLeaveH').addEventListener('click', () => { leave(''); closeOnline(); });
$('onLeaveG').addEventListener('click', () => { leave(''); closeOnline(); });
$('onCopy').addEventListener('click', () => {
  const link = location.href.split('#')[0] + '#sala=' + ON.code;
  const done = () => ui.msg('Link copiado: ' + link, true);
  if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, () => ui.msg('Mande este link: ' + link, true)); else ui.msg('Mande este link: ' + link, true);
});
{ // chip de latência no canto, durante a partida
  const chip = document.createElement('span'); chip.className = 'chip'; chip.id = 'netChip'; chip.hidden = true;
  $('tr').prepend(chip);
}
// link com #sala=CÓDIGO: abre a tela do online com o código preenchido
{
  const m = /sala=([A-Za-z0-9]{5})/.exec(location.hash);
  if (m) { $('onCode').value = m[1].toUpperCase(); openOnline(); setTimeout(() => $('onJoin').focus(), 0); }
}
addEventListener('beforeunload', () => { if (NET.role) send(['bye']); });
// para testes no console
window.__pdoNet = { ON, NET };
