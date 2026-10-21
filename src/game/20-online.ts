// @ts-nocheck
// modo online: jogar com amigos pelo navegador, sem servidor próprio (WebRTC ponto a ponto via PeerJS).
// Quem cria a sala (anfitrião) roda a partida inteira (física, CPU, placar) como no jogo normal; os
// convidados (até 7) só mandam as entradas (direção e golpes apertados/soltos) e desenham o estado que
// chega ~30 vezes por segundo, interpolando entre os dois últimos estados para ficar suave.
// Na sala cada um escolhe personagem e lugar (Time A/B, direita/esquerda); lugar vazio é da CPU e quem
// não senta assiste. Cada um vê a quadra do lado do próprio time (o time de cima vê tudo espelhado).
// Também dá para fazer um campeonato: chave com todos da sala (completada com CPU), uma partida por vez.
import './19-loop';
import { $s } from '../state';
import { C, HEIGHTS, NAMES, P_SPEED, ROSTER, SWING_DUR, TOSS_T, ZONE3, attrK, bG, charById, clamp, lerp, nameOf, overall, shortOf } from './00-base';
import { S, NET } from './01-estado';
import { cpuA, cpuB, human, partner } from './06-modelos';
import { applyPlayerStyle, applyRackets, assignCharacters, ball, puff, resetTrail, sparkle } from './07-glb';
import { ac, sndHit, sndSand } from './08-audio';
import { $, configureMode, el, feedback, hideBanner, newMatch, pointShow, renderBoard, serveBanner, showOver, shotFeedback } from './09-interface';
import { defenseFlash } from './11-mira';
import { MTR, inPlay, makeRemoteCtl, meterDom, pressShot, readMenu, releaseShot, syncMenu } from './12-controles';
import { humanPlan, localInput } from './16-ia';
import { sideOf } from './18-animacao';

const PREFIX = 'ponto-de-ouro-sala-';            // prefixo do id no servidor público do PeerJS
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I, que confundem ao ditar o código
const PROTO = 2;                                 // versão das mensagens: todos precisam da mesma
const sendMs = () => ON.guests.length <= 3 ? 16 : 33; // estado do anfitrião 60 vezes por segundo (30 com sala cheia)
const INTERP_START = 50;                         // atraso de desenho inicial do convidado; depois se ajusta à rede (ms)
const TIMEOUT_MS = 8000;                         // sem nenhuma mensagem por esse tempo = conexão perdida
const MAX_GUESTS = 7;                            // 8 pessoas por sala (campeonato); 4 jogam por vez
const PL = [human, partner, cpuA, cpuB];         // ordem fixa dos jogadores nas mensagens (a do anfitrião)
const PLAY_MODES = ['serve', 'toss', 'rally', 'dead'];
// lugares na quadra: lado visto por quem está naquele time
const SEATS = ['A1', 'A2', 'B1', 'B2'];
const SEAT_SIDE = { A1: 'dir', A2: 'esq', B1: 'dir', B2: 'esq' };
const activeSeats = mode => mode === 'simples' ? ['A1', 'B1'] : SEATS;

const ON = {
  peer: null, code: '', open: false, hb: 0, backup: null, nameBak: null, name: '',
  // anfitrião
  guests: [], gid: 0, self: { id: 'host', name: '', pick: '' }, room: null, outq: [], lastSend: 0, lastL: 0, prevMode: '', match: null, inMatch: false,
  // convidado
  conn: null, rtt: 0, lastRecv: 0, myId: '', L: null, G: null, mirror: false, myIdx: -1, buf: [], evq: [], offs: [], off: null,
  fast: null, interp: 0, gap: 0, inSeq: 0, inKey: '', inT: 0, mySmashes: 0, boardKey: '', mrTimer: 0, seatsKey: '', pickKey: '', champKey: '',
};
const r3 = x => Math.round(x * 1000) / 1000;
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const byOvr = () => ROSTER.slice().sort((x, y) => overall(y.a) - overall(x.a));
const charLabel = id => { const c = charById(id); return nameOf(c) + ' · ' + overall(c.a); };
try { ON.name = localStorage.getItem('pdo-online-name') || ''; } catch (e) {}

// ---------- telas ----------
function showPart(part) {
  el.menu.hidden = true; $('online').hidden = false;
  $('onStart').hidden = part !== 'onStart'; $('onRoom').hidden = part !== 'onRoom';
}
function msg(text, ok) { const m = $('onMsg'); m.textContent = text || ''; m.hidden = !text; m.classList.toggle('ok', !!ok); }
function chipStatus() {
  const chip = $('netChip'); if (!chip) return;
  chip.hidden = !NET.role || !inPlay();
  if (NET.role === 'host') chip.textContent = 'Online · ' + (ON.guests.length + 1) + ' na sala';
  else chip.textContent = 'Online' + (ON.rtt ? ' · ' + Math.round(ON.rtt) + ' ms' : '') + (S.spectate ? ' · assistindo' : '');
}
function openOnline() {
  ac(); readMenu(); // usa o que está marcado no menu (games, dificuldade, jogadores)
  msg('');
  if (NET.role) { showPart('onRoom'); renderRoom(true); } else { showPart('onStart'); $('onName').value = ON.name; setTimeout(() => $('onCode').focus(), 0); }
}
function closeOnline() { $('online').hidden = true; el.menu.hidden = false; syncMenu(); }
function myName() {
  const n = ($('onName').value || '').trim().slice(0, 16) || 'Jogador';
  ON.name = n; try { localStorage.setItem('pdo-online-name', n); } catch (e) {}
  return n;
}

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
    // só para a abertura: depois, um erro do servidor de sinalização não pode derrubar as conexões já feitas
    const fail = e => { clearTimeout(t); p.destroy(); rej(e); };
    p.once('open', () => { clearTimeout(t); p.off('error', fail); res(p); });
    p.once('error', fail);
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
const sendTo = (conn, m) => { if (conn && conn.open) { try { conn.send(m); } catch (e) {} } };
// canal rápido: na mesma conexão WebRTC, sem ordem e sem retransmissão (estado da partida e direção).
// Um pacote perdido não segura os seguintes (no canal normal do PeerJS ele seguraria); o próximo já o substitui.
function fastChan(conn, onMsg) {
  try {
    const dc = conn.peerConnection.createDataChannel('pdo-rapido', { negotiated: true, id: 100, ordered: false, maxRetransmits: 0 });
    dc.onmessage = e => { try { onMsg(JSON.parse(e.data)); } catch (er) {} };
    return dc;
  } catch (e) { return null; }
}
function sendFast(dc, conn, m) {
  if (dc && dc.readyState === 'open') { try { dc.send(JSON.stringify(m)); return; } catch (e) {} }
  sendTo(conn, m); // canal rápido ainda não abriu (ou o navegador não deixou): vai pelo normal
}
const send = m => { if (NET.role === 'guest') sendTo(ON.conn, m); };
function backupSettings() { if (!ON.backup) ON.backup = JSON.parse(JSON.stringify(S.settings)); }

// ---------- anfitrião: sala ----------
const guestById = id => ON.guests.find(g => g.id === id);
const members = () => [ON.self].concat(ON.guests);
async function createRoom() {
  if (NET.role) return;
  const name = myName();
  $('onCreate').disabled = true; msg('Criando a sala…', true);
  try {
    const Peer = await loadPeer();
    let peer = null, code = '';
    for (let i = 0; i < 4 && !peer; i++) {
      code = randCode();
      try { peer = await openPeer(Peer, PREFIX + code); } catch (e) { if (e.type !== 'unavailable-id') throw e; }
    }
    if (!peer) throw { type: 'unavailable-id' };
    ON.peer = peer; ON.code = code; ON.open = true; NET.role = 'host'; backupSettings();
    ON.self = { id: 'host', name, pick: S.settings.pick.me };
    const pk = S.settings.pick;
    ON.room = { kind: 'match', mode: S.settings.mode === 'simples' ? 'simples' : 'dupla', seats: { A1: 'host', A2: null, B1: null, B2: null }, cpu: { A1: pk.mate, A2: pk.mate, B1: pk.o1, B2: pk.o2 }, champ: null, playing: false };
    fixCpu();
    peer.on('connection', conn => {
      if (ON.guests.length >= MAX_GUESTS) { conn.on('open', () => { conn.send(['full']); setTimeout(() => conn.close(), 400); }); return; }
      const g = { id: 'g' + (++ON.gid), conn, fast: null, open: false, name: 'Jogador', pick: '', rtt: 0, interp: INTERP_START, inSeq: -1, lastRecv: performance.now(), ctl: null, plIdx: -1 };
      conn.on('open', () => { g.open = true; g.lastRecv = performance.now(); g.fast = fastChan(conn, d => { g.lastRecv = performance.now(); hostData(g, d); }); });
      conn.on('data', d => { g.lastRecv = performance.now(); hostData(g, d); });
      conn.on('close', () => guestLost(g));
      conn.on('error', () => guestLost(g));
    });
    peer.on('disconnected', () => { if (NET.role === 'host' && !peer.destroyed) peer.reconnect(); }); // caiu o servidor de sinalização; quem já entrou continua
    peer.on('error', e => { if (e.type !== 'peer-unavailable' && !ON.guests.length) msg(errText(e)); });
    clearInterval(ON.hb);
    ON.hb = setInterval(hostBeat, 1000);
    msg(''); showPart('onRoom'); broadcast();
  } catch (e) { msg(errText(e)); }
  $('onCreate').disabled = false;
}
function hostBeat() {
  const now = performance.now();
  for (const g of ON.guests.slice()) {
    sendTo(g.conn, ['ping', now]);
    if (g.open && now - g.lastRecv > TIMEOUT_MS) guestLost(g);
  }
  if (now - ON.lastL > 3000) broadcast(); // atualiza os pings na tela de todos
}
// personagens da CPU: sem repetir nenhum que alguém da sala escolheu
function fixCpu() {
  const used = new Set(members().map(m => m.pick).filter(Boolean));
  const free = () => byOvr().find(c => !used.has(c.id)).id;
  for (const s of SEATS) { let id = ON.room.cpu[s]; if (!id || used.has(id) || !ROSTER.some(c => c.id === id)) id = free(); ON.room.cpu[s] = id; used.add(id); }
}
function lobbyState() {
  return {
    code: ON.code, kind: ON.room.kind, mode: ON.room.mode, games: S.settings.games, diff: S.settings.diff,
    members: members().map(m => ({ id: m.id, name: m.name, pick: m.pick, rtt: m.id === 'host' ? 0 : Math.round(m.rtt) })),
    seats: ON.room.seats, cpu: ON.room.cpu, champ: ON.room.champ, playing: ON.room.playing,
  };
}
function broadcast() {
  if (NET.role !== 'host') return;
  ON.lastL = performance.now();
  const L = lobbyState(); ON.L = L; ON.myId = 'host';
  for (const g of ON.guests) sendTo(g.conn, ['L', L]);
  if (!$('online').hidden) renderRoom();
}
// pedidos de quem está na sala (o anfitrião passa por aqui também)
function act(mid, m) {
  const mem = mid === 'host' ? ON.self : guestById(mid); if (!mem) return;
  const room = ON.room;
  if (m[0] === 'seat' && !room.playing && room.kind === 'match') {
    for (const s of SEATS) if (room.seats[s] === mid) room.seats[s] = null;
    if (SEATS.includes(m[1]) && !room.seats[m[1]]) room.seats[m[1]] = mid;
  }
  if (m[0] === 'pick' && !room.playing) {
    const id = m[1];
    if (ROSTER.some(c => c.id === id) && !members().some(x => x !== mem && x.pick === id)) mem.pick = id;
  }
  if (mid === 'host' && m[0] === 'cpu' && SEATS.includes(m[1]) && ROSTER.some(c => c.id === m[2]) && !members().some(x => x.pick === m[2])) {
    const other = SEATS.find(s => s !== m[1] && room.cpu[s] === m[2]); if (other) room.cpu[other] = room.cpu[m[1]];
    room.cpu[m[1]] = m[2];
  }
  if (mid === 'host' && m[0] === 'kind' && !room.playing) room.kind = m[1] === 'champ' ? 'champ' : 'match';
  if (mid === 'host' && m[0] === 'games' && !room.playing) { S.settings.games = +m[1] === 6 ? 6 : 4; const r = document.querySelector('input[name=len][value="' + S.settings.games + '"]'); if (r) r.checked = true; } // duração escolhida na sala (o menu em passos não passa pela escolha de games)
  if (mid === 'host' && m[0] === 'mode' && !room.playing && !(room.champ && room.champ.champion === null)) room.mode = m[1] === 'simples' ? 'simples' : 'dupla';
  fixCpu(); broadcast();
}
function hostData(g, d) {
  if (!Array.isArray(d)) return;
  const k = d[0], c = g.ctl;
  if (k === 'ping') { sendTo(g.conn, ['pong', d[1]]); return; }
  if (k === 'pong') { const r = performance.now() - d[1]; g.rtt = g.rtt ? g.rtt * .7 + r * .3 : r; if (g.ctl) g.ctl.lag = lagOf(g); return; }
  if (k === 'bye') { guestLost(g, g.name + ' saiu da sala.'); return; }
  if (k === 'hello') {
    if (!d[1] || d[1].v !== PROTO) { sendTo(g.conn, ['old']); return; }
    g.name = String(d[1].name || 'Jogador').slice(0, 16);
    const want = d[1].pick, used = new Set(members().filter(x => x !== g).map(x => x.pick));
    g.pick = ROSTER.some(c => c.id === want) && !used.has(want) ? want : byOvr().find(ch => !used.has(ch.id)).id;
    if (!ON.guests.includes(g)) ON.guests.push(g);
    sendTo(g.conn, ['welcome', { id: g.id }]);
    msg(g.name + ' entrou na sala.', true);
    fixCpu(); broadcast(); return;
  }
  if (k === 'seat' || k === 'pick') { act(g.id, d); return; }
  if (!c) return;
  if (k === 'i') {
    if (d[4] <= g.inSeq) return; g.inSeq = d[4]; // chegou fora de ordem: já há uma mais nova
    if (d[5] > 0) { g.interp = d[5]; c.lag = lagOf(g); }
    const s = c.p.team === 0 ? 1 : -1; c.ix = (+d[1] || 0) * s; c.iz = (+d[2] || 0) * s; c.assistMove = !!d[3]; return; // time de cima: a tela dele é espelhada
  }
  if (k === 's' && inPlay()) { if (d[2]) pressShot(d[1], c); else releaseShot(d[1], c); }
}
// quanto o convidado vê a bola atrasada: ida e volta + o atraso de desenho dele (para descontar no tempo do golpe)
const lagOf = g => Math.min(.3, (g.rtt + (g.interp || INTERP_START)) / 1000);
// alguém saiu ou caiu
function guestLost(g, text) {
  const i = ON.guests.indexOf(g); if (i < 0) return;
  ON.guests.splice(i, 1);
  setTimeout(() => { try { g.conn.close(); } catch (e) {} }, 100);
  for (const s of SEATS) if (ON.room.seats[s] === g.id) ON.room.seats[s] = null;
  const why = text || g.name + ' desconectou.';
  if (ON.inMatch && g.plIdx >= 0 && S.mode !== 'over') { hostToLobby(why + ' A partida foi interrompida.'); return; }
  if (g.ctl) { NET.remote = NET.remote.filter(c => c !== g.ctl); g.ctl.p.isHuman = false; g.ctl.p.netHuman = false; g.ctl = null; }
  if (ON.match && g.plIdx >= 0) ON.match.ownerByPl[g.plIdx] = null; // "Jogar de novo" segue com a CPU no lugar dele
  msg(why); fixCpu(); broadcast();
}
function clearRemote() {
  for (const p of PL) { p.isHuman = p === human; p.netHuman = false; p.netName = ''; p.mtr = null; p.inputX = 0; p.inputZ = 0; }
  human.mtr = MTR; NET.remote = [];
  for (const g of ON.guests) { g.ctl = null; g.plIdx = -1; }
  S.spectate = false; document.body.classList.remove('spectate');
}
// monta a partida: lugares (A1..B2) → bonecos do anfitrião. O time do anfitrião (ou o A, se ele só assiste)
// é o time de baixo da simulação; o boneco "human" é o lugar dele.
function startMatch(owners, picks, mode, champM) {
  const act = activeSeats(mode), hostSeat = act.find(s => owners[s] === 'host');
  const t0 = hostSeat ? hostSeat[0] : 'A', t1 = t0 === 'A' ? 'B' : 'A';
  let plSeat;
  if (mode === 'simples') plSeat = [t0 + '1', null, t1 + '1', null];
  else {
    const hs = hostSeat || t0 + '1', other = hs[1] === '1' ? t0 + '2' : t0 + '1';
    plSeat = [hs, other, t1 + '2', t1 + '1']; // no time de cima, o slot +1 (cpuA) é a esquerda de quem está lá
    S.settings.side = SEAT_SIDE[hs] === 'dir' ? 'direita' : 'esquerda';
  }
  const ownerByPl = plSeat.map(s => (s && owners[s]) || null);
  const used = new Set(plSeat.map(s => s && picks[s]).filter(Boolean));
  const pickByPl = plSeat.map(s => (s && picks[s]) || (() => { const id = byOvr().find(c => !used.has(c.id)).id; used.add(id); return id; })());
  clearRemote();
  PL.forEach((p, i) => {
    const o = ownerByPl[i];
    p.isHuman = !!o; p.netHuman = !!o && o !== 'host';
    const g = p.netHuman && guestById(o);
    p.netName = o ? (o === 'host' ? ON.self.name : (g && g.name) || '') : ''; // nome de quem joga com este boneco (aparece na etiqueta)
    if (g) { g.ctl = makeRemoteCtl(p); g.ctl.lag = lagOf(g); g.plIdx = i; NET.remote.push(g.ctl); }
  });
  if (!human.netHuman) human.mtr = MTR;
  S.spectate = !hostSeat; document.body.classList.toggle('spectate', S.spectate);
  S.settings.mode = mode; S.settings.format = 'set';
  S.settings.pick = { me: pickByPl[0], mate: pickByPl[1], o1: pickByPl[2], o2: pickByPl[3] };
  const c0 = charById(pickByPl[0]); S.settings.racket = (c0.look && c0.look.racket) || S.settings.racket;
  S.careerActive = false; S.champActive = false;
  ON.match = { plSeat, ownerByPl, pickByPl, champM, teamOfSim: [t0, t1] };
  ON.room.playing = true; broadcast();
  $('online').hidden = true; ON.outq = [];
  newMatch(); // chama onNewMatch (manda a configuração a cada um) e depois monta o primeiro ponto
}
function hostPlay() {
  const room = ON.room;
  if (room.playing) return;
  if (room.kind === 'match') {
    const act = activeSeats(room.mode);
    if (!act.some(s => room.seats[s])) { msg('Ninguém sentou: escolha um lugar antes de começar.'); return; }
    const picks = {}; act.forEach(s => { const o = room.seats[s]; const m = o && (o === 'host' ? ON.self : guestById(o)); picks[s] = m ? m.pick : room.cpu[s]; });
    startMatch(room.seats, picks, room.mode, null);
    return;
  }
  if (!room.champ || room.champ.champion !== null) { startChamp(); return; }
  const m = nextChampMatch(); if (!m) return;
  const ch = room.champ, A = ch.entries[m.a], B = ch.entries[m.b];
  const live = e => e.mid && (e.mid === 'host' || guestById(e.mid)) ? e.mid : null;
  startMatch({ A1: live(A), A2: null, B1: live(B), B2: null }, { A1: A.pick, A2: A.mate, B1: B.pick, B2: B.mate }, ch.mode, m);
}
function hostCfg(g) {
  const M = ON.match, names = {}, heights = {};
  M.pickByPl.forEach(id => { if (NAMES[id]) names[id] = NAMES[id]; if (HEIGHTS[id]) heights[id] = HEIGHTS[id]; });
  return { me: g.plIdx, picks: M.pickByPl, humans: M.ownerByPl.map(o => !!o), players: PL.map(p => p.netName || ''), settings: { mode: S.settings.mode, games: S.settings.games, diff: S.settings.diff, format: S.settings.format }, names, heights };
}
function meterOf(c) { const m = c && c.m; return m && m.active ? [m.kind, m.type, r3(m.t), r3(m.v), m.center, m.half] : null; }
function hostState(now) {
  return {
    t: now, m: S.mode, bs: ball.state, gk: ball.gk || 1, ap: ball.apex || 0,
    b: [ball.pos.x, ball.pos.y, ball.pos.z, ball.vel.x, ball.vel.y, ball.vel.z].map(r3),
    p: PL.map(p => {
      const sw = p.swing, M = p.charging ? (p.mtr || MTR) : null, ct = p.contact;
      return [r3(p.pos.x), r3(p.pos.z), r3(p.vel.x), r3(p.vel.z), r3(sw.t), sw.type, sw.dur, r3(sw.side || 0), sw.var || '', sw.hit ? 1 : 0,
        r3(p.jump || 0), p.jumpDur || 0, p.jumpH || 0, M ? M.type : 0, M ? r3(M.t) : 0, p.dive ? r3(p.dive.t) : -1, p.dive ? p.dive.dur : 0, r3(p.split || 0), r3(p.tossT || 0),
        ct ? [r3(ct.x), r3(ct.y), r3(ct.z), r3(ct.u), ct.hitId] : 0, r3(p.tossDur || TOSS_T)];
    }),
    sc: S.score, sv: S.server, si: S.serverIdx, sp: PL.indexOf(S.serverPlayer), lt: S.lastTeam, hid: S.hitId, r: S.rally,
    w: S.wind || { x: 0, z: 0 }, ht: S.heat ? 1 : 0, pr: S.pressure || '', stk: S.streak || null, mt: null,
  };
}
function hostTick(now) {
  if (NET.role !== 'host') return;
  if (S.mode === 'over' && ON.prevMode !== 'over' && ON.inMatch) {
    const ps = PL.map(p => { const k = $s.players.indexOf(p); return k >= 0 && S.pstats && S.pstats[k] ? S.pstats[k] : null; });
    ON.outq.push(['over', { w: S.matchWinner, st: S.stats, ps }]);
    if (ON.match && ON.match.champM) champResult();
    if (ON.room.kind === 'champ') $('btnAgain').hidden = true; // no campeonato a próxima partida sai da chave
  }
  ON.prevMode = S.mode;
  const common = ON.outq.splice(0);
  const st = now - ON.lastSend >= sendMs() - 2 ? hostState(now) : null;
  if (st) ON.lastSend = now;
  for (const g of ON.guests) {
    const evs = common.map(e => e[0] === 'cfg' ? ['cfg', hostCfg(g)] : e);
    if (g.ctl && g.ctl.out.length) evs.push(...g.ctl.out.splice(0));
    if (evs.length) sendTo(g.conn, ['e', now, evs]);
    if (st) { st.mt = meterOf(g.ctl); sendFast(g.fast, g.conn, ['st', st]); }
  }
  if (inPlay() === $('netChip').hidden) chipStatus();
}
NET.hostTick = hostTick;
NET.ev = (k, a, b) => {
  if (NET.role !== 'host' || !ON.guests.length) return;
  if (k === 'hit') ON.outq.push(['hit', PL.indexOf(a), b]);
  else if (k === 'sand') ON.outq.push(['sand', r3(a), r3(b)]);
  else if (k === 'spark') ON.outq.push(['spark', r3(a.x), r3(a.y), r3(a.z)]);
};
NET.onNewMatch = () => { if (NET.role !== 'host') return; ON.inMatch = true; ON.outq.push(['cfg']); };
NET.onSetupPoint = () => { if (NET.role === 'host') ON.outq.push(['sv', PL.indexOf(S.serverPlayer)]); };
NET.onPoint = (w, ev, reason) => { if (NET.role === 'host') ON.outq.push(['pt', w, ev, reason, S.lastPoint]); };
// todos de volta para a sala (fim da partida, "Sair para o menu" do anfitrião ou alguém que estava jogando caiu)
function hostToLobby(text) {
  ON.outq.push(['tolobby', text || '']);
  hostTick(performance.now());
  clearRemote(); ON.room.playing = false; ON.match = null;
  toLobbyScreen(); showPart('onRoom'); msg(text || ''); fixCpu(); broadcast();
}
// "Sair para o menu"/"Menu" no online: volta para a sala; o convidado que estava jogando sai da sala
NET.onMenu = () => {
  if (NET.role === 'host') hostToLobby(inPlay() ? 'Quem criou a sala encerrou a partida.' : '');
  else if (NET.role === 'guest') {
    if (inPlay() && ON.myIdx >= 0) { leave('Você saiu da partida.'); return; }
    toLobbyScreen(); showPart('onRoom'); msg(''); renderRoom(true);
  }
};

// ---------- campeonato ----------
// chave com todos da sala; completa com CPU até 2, 4 ou 8; partidas entre CPUs são decididas na hora
function startChamp() {
  const mode = ON.room.mode, mem = members();
  if (new Set(mem.map(m => m.pick)).size < mem.length) { msg('Cada um precisa de um personagem diferente.'); return; }
  const used = new Set(mem.map(m => m.pick));
  const free = () => { const id = byOvr().find(c => !used.has(c.id)).id; used.add(id); return id; };
  const entries = mem.map(m => ({ mid: m.id, name: m.name, pick: m.pick }));
  let size = 2; while (size < entries.length) size *= 2;
  while (entries.length < size) entries.push({ mid: null, name: '', pick: free() });
  if (mode === 'dupla') entries.forEach(e => { e.mate = free(); }); // cada um joga com um parceiro da CPU
  // sorteia a chave, separando as pessoas das CPUs o máximo possível
  const hum = entries.filter(e => e.mid).sort(() => Math.random() - .5), cpu = entries.filter(e => !e.mid);
  const order = [];
  for (let i = 0; i < size / 2; i++) { const a = hum.shift() || cpu.shift(); const b = cpu.shift() || hum.shift(); order.push(a, b); }
  const r0 = []; for (let i = 0; i < size; i += 2) r0.push({ a: i, b: i + 1, w: null, score: '' });
  ON.room.champ = { mode, entries: order, rounds: [r0], champion: null };
  champAdvance(); msg(''); broadcast();
}
const entryLive = e => !!(e.mid && (e.mid === 'host' || guestById(e.mid)));
function champAdvance() {
  const ch = ON.room.champ;
  for (;;) {
    const r = ch.rounds[ch.rounds.length - 1];
    r.forEach(m => {
      if (m.w !== null || entryLive(ch.entries[m.a]) || entryLive(ch.entries[m.b])) return;
      const A = charById(ch.entries[m.a].pick), B = charById(ch.entries[m.b].pick); // CPU contra CPU: pelo overall
      const pA = 1 / (1 + Math.exp(-(overall(A.a) - overall(B.a)) / 2.5)), N = S.settings.games;
      m.w = Math.random() < pA ? m.a : m.b; m.score = N + '–' + Math.floor(Math.random() * (N - 1)); m.sim = true;
    });
    if (r.some(m => m.w === null)) return;
    if (r.length === 1) { ch.champion = r[0].w; return; }
    const nr = []; for (let k = 0; k < r.length; k += 2) nr.push({ a: r[k].w, b: r[k + 1].w, w: null, score: '' });
    ch.rounds.push(nr);
  }
}
function nextChampMatch() { const ch = ON.room.champ; if (!ch || ch.champion !== null) return null; return ch.rounds[ch.rounds.length - 1].find(m => m.w === null) || null; }
function champResult() {
  const M = ON.match, m = M.champM, wTeam = M.teamOfSim[S.matchWinner], g = S.score.games, iA = M.teamOfSim.indexOf('A');
  m.w = wTeam === 'A' ? m.a : m.b; m.score = g[iA] + '–' + g[1 - iA];
  champAdvance(); broadcast();
}

// ---------- convidado ----------
async function joinRoom() {
  if (NET.role) return;
  const code = ($('onCode').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 5) { msg('O código tem 5 letras/números.'); return; }
  const name = myName();
  $('onJoin').disabled = true; msg('Conectando à sala ' + code + '…', true);
  try {
    const Peer = await loadPeer();
    const peer = await openPeer(Peer, null);
    ON.peer = peer; ON.code = code;
    await new Promise((res, rej) => {
      const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      const t = setTimeout(() => rej({ type: 'timeout-conn' }), 15000);
      peer.on('error', e => { clearTimeout(t); rej(e); });
      conn.on('open', () => {
        clearTimeout(t); ON.conn = conn; ON.lastRecv = performance.now();
        conn.on('data', guestData);
        ON.fast = fastChan(conn, guestData);
        conn.on('close', () => { if (ON.conn === conn) leave('A conexão com a sala caiu. Volte a entrar com o código.'); });
        conn.on('error', () => { if (ON.conn === conn) leave('A conexão com a sala caiu. Volte a entrar com o código.'); });
        res();
      });
    });
    NET.role = 'guest'; ON.open = true; backupSettings();
    send(['hello', { v: PROTO, name, pick: S.settings.pick.me }]);
    clearInterval(ON.hb);
    ON.hb = setInterval(() => {
      send(['ping', performance.now()]);
      if (performance.now() - ON.lastRecv > TIMEOUT_MS) leave('A conexão com a sala caiu. Volte a entrar com o código.');
    }, 1000);
    msg(''); showPart('onRoom'); $('onStatus').textContent = 'Conectado. Carregando a sala…';
  } catch (e) {
    if (ON.peer) { ON.peer.destroy(); ON.peer = null; }
    msg(e && e.type === 'timeout-conn' ? 'A sala não respondeu. Pode ser bloqueio de rede (alguns roteadores/empresas impedem a conexão direta).' : errText(e));
  }
  $('onJoin').disabled = false;
}
// golpe apertado/solto: vai na hora para o anfitrião e já começa a animação (e a barra do lob/saque) aqui,
// sem esperar a volta da rede
NET.shot = (type, down) => {
  if (!ON.inMatch || ON.myIdx < 0 || !inPlay()) return;
  send(['s', type, down ? 1 : 0]);
  localShot(type, down);
};
// previsão local do próprio jogador: golpe, carga e barra que dependem só do tempo
const LS = { t: -1, type: '', dur: 0, side: 1, until: 0, charge: null, c0: 0, meter: null };
function localShot(type, down) {
  const now = performance.now();
  if (!down) {
    if (LS.charge === type) { // soltou o smash/lob: o golpe sai daqui mesmo
      LS.charge = null; LS.type = type; LS.dur = SWING_DUR; LS.t = SWING_DUR * .3; LS.side = sideOf(human);
      if (type === 'lob' && LS.meter) LS.meter.stop = now;
    }
    if (LS.meter && LS.meter.kind === 'serve' && LS.meter.type === type && now - LS.meter.t0 > 150) LS.meter.stop = now;
    return;
  }
  if (S.mode === 'serve' && S.serverPlayer === human && !LS.meter) { // saque: a barra anda pelo tempo, igual no anfitrião
    LS.meter = { kind: 'serve', type, t0: now, fill: .9 };
    Object.assign(MTR, { active: true, kind: 'serve', type, t: 0, v: 0, center: TOSS_T / .9, half: MTR.half || .068 }); meterDom(MTR);
    return;
  }
  if (S.mode !== 'rally' || (LS.t >= 0 && LS.t < LS.dur * .8)) return;
  if (type === 'smash' || type === 'lob') {
    LS.charge = type; LS.c0 = now; LS.t = -1;
    if (type === 'lob') { LS.meter = { kind: 'lob', type, t0: now, fill: .45 }; Object.assign(MTR, { active: true, kind: 'lob', type, t: 0, v: 0, center: -1, half: 0 }); meterDom(MTR); }
    return;
  }
  LS.type = type; LS.dur = type === 'curta' ? .5 : SWING_DUR; LS.t = 0; LS.side = sideOf(human);
}
function localShotTick(dt, now) {
  const sw = human.swing;
  if (LS.t >= 0) { LS.t += dt; if (LS.t >= LS.dur) { LS.t = -1; LS.until = now + ON.rtt + ON.interp + 80; } }
  if (LS.charge) { human.charging = true; MTR.type = LS.charge; MTR.t = (now - LS.c0) / 1000; sw.t = -1; }
  else if (LS.t >= 0) { human.charging = false; sw.t = LS.t; sw.type = LS.type; sw.dur = LS.dur; sw.side = LS.side; sw.hit = false; }
  else if (now < LS.until) { sw.t = -1; human.charging = false; } // o golpe que o anfitrião ainda mostra (atrasado) já foi desenhado aqui
  // barra do lob e do saque: anda pelo relógio daqui (o anfitrião mede o mesmo tempo entre apertar e soltar)
  const M = LS.meter;
  if (M) {
    const t = ((M.stop || now) - M.t0) / 1000;
    MTR.active = !M.stop; MTR.kind = M.kind; MTR.type = M.type; MTR.v = t / M.fill; MTR.t = t;
    // o anfitrião não aceitou o aperto (ou o ponto acabou): sem resultado em tempo, a barra some
    if ((M.stop && now - M.stop > ON.rtt + ON.interp + 400) || (M.kind === 'serve' && S.mode !== 'serve' && S.mode !== 'toss' && now - M.t0 > 2500) || S.mode === 'dead') {
      LS.meter = null; if (!MTR.active || M.stop) { MTR.active = false; el.meter.hidden = true; }
    }
  }
}
function onState(s) {
  const now = performance.now(), buf = ON.buf, last = buf[buf.length - 1];
  if (last && s.t <= last.t) return; // canal rápido: chegou depois de um mais novo, já não serve
  if (last) ON.gap = ON.gap ? ON.gap * .9 + (s.t - last.t) * .1 : s.t - last.t;
  s.rcv = now;
  ON.offs.push([now, now - s.t]); while (ON.offs.length && now - ON.offs[0][0] > 3000) ON.offs.shift();
  const offs = ON.offs.map(o => o[1]).sort((x, y) => x - y);
  ON.off = offs[0]; // menor atraso visto = relógio do anfitrião + viagem mais rápida
  // atraso de desenho: intervalo entre estados + variação da rede (quase o pior caso dos últimos 3 s)
  const jit = offs[Math.floor((offs.length - 1) * .95)] - ON.off;
  const target = clamp((ON.gap || 33) + jit + 5, 18, 150);
  ON.interp = !ON.interp ? INTERP_START : target > ON.interp ? ON.interp * .7 + target * .3 : ON.interp * .98 + target * .02;
  buf.push(s); if (buf.length > 120) buf.shift();
}
function guestData(d) {
  if (!Array.isArray(d)) return;
  const k = d[0], now = performance.now();
  ON.lastRecv = now;
  if (k === 'st') { onState(d[1]); return; }
  if (k === 'e') { for (const e of d[2]) ON.evq.push({ t: d[1], e }); return; }
  if (k === 'ping') { send(['pong', d[1]]); return; }
  if (k === 'pong') { const r = now - d[1]; ON.rtt = ON.rtt ? ON.rtt * .7 + r * .3 : r; return; }
  if (k === 'L') { ON.L = d[1]; if (!$('online').hidden && !ON.inMatch) renderRoom(); return; }
  if (k === 'welcome') { ON.myId = d[1].id; return; }
  if (k === 'bye') { leave('Quem criou a sala fechou a sala.'); return; }
  if (k === 'full') { leave('Essa sala já está cheia (8 pessoas).'); return; }
  if (k === 'old') leave('Vocês estão com versões diferentes do jogo. Recarreguem a página (Ctrl+F5) e tentem de novo.');
}
const mT = t => (t < 0 || !ON.mirror ? t : 1 - t);
const swap2 = a => (ON.mirror && a ? [a[1], a[0]] : a);
function restoreNames() {
  if (!ON.nameBak) return;
  for (const [id, [n, h]] of Object.entries(ON.nameBak)) { if (n === undefined) delete NAMES[id]; else NAMES[id] = n; if (h === undefined) delete HEIGHTS[id]; else HEIGHTS[id] = h; }
  ON.nameBak = null;
}
// índice do anfitrião → boneco aqui: quem joga é sempre o "human" (time de baixo); no time de cima, tudo espelhado
const VIEW = [[human, partner, cpuA, cpuB], [partner, human, cpuA, cpuB], [cpuA, cpuB, human, partner], [cpuB, cpuA, partner, human]];
const SLOT = new Map([[human, 'me'], [partner, 'mate'], [cpuA, 'o1'], [cpuB, 'o2']]);
function guestStart(cfg) {
  const me = cfg.me;
  ON.myIdx = me; ON.mirror = me >= 2; ON.G = VIEW[Math.max(0, me)];
  S.spectate = me < 0; document.body.classList.toggle('spectate', S.spectate);
  Object.assign(S.settings, cfg.settings);
  const pick = {}; ON.G.forEach((p, i) => { pick[SLOT.get(p)] = cfg.picks[i]; }); S.settings.pick = pick;
  const mine = charById(pick.me); S.settings.racket = (mine.look && mine.look.racket) || S.settings.racket;
  // nomes e alturas personalizados do anfitrião (só na memória; voltam ao sair)
  restoreNames(); ON.nameBak = {};
  for (const id of cfg.picks) {
    if (!(id in ON.nameBak)) ON.nameBak[id] = [NAMES[id], HEIGHTS[id]];
    if (cfg.names[id] !== undefined) NAMES[id] = cfg.names[id]; else delete NAMES[id];
    if (cfg.heights[id] !== undefined) HEIGHTS[id] = cfg.heights[id]; else delete HEIGHTS[id];
  }
  ON.G.forEach((p, i) => { p.isHuman = i === me; p.netHuman = cfg.humans[i] && i !== me; p.netName = (cfg.players || [])[i] || ''; p.mtr = null; });
  human.mtr = MTR;
  S.careerActive = false; S.champActive = false;
  $('online').hidden = true; document.body.classList.remove('in-replay'); $('replayBar').hidden = true;
  ON.mySmashes = 0; ON.boardKey = ''; PR.on = false; Object.assign(LS, { t: -1, until: 0, charge: null, meter: null });
  newMatch(true);
  ON.inMatch = true; chipStatus();
}
function guestSetupPoint(i) {
  const sp = ON.G[i] || human;
  S.celebrate = null; S.mode = 'serve'; S.serverPlayer = sp; ball.state = 'held';
  $s.players.forEach(p => { p.swing.t = -1; p.swing.meter = null; p.charging = false; p.dive = null; });
  MTR.active = false; el.meter.hidden = true; humanPlan.id = -1;
  PR.on = false; Object.assign(LS, { t: -1, until: 0, charge: null, meter: null });
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
  chipStatus();
}
function guestEvent(e) {
  const k = e[0], m = ON.mirror ? -1 : 1;
  if (k === 'cfg') { guestStart(e[1]); return; }
  if (k === 'tolobby') { toLobbyScreen(); S.spectate = false; document.body.classList.remove('spectate'); showPart('onRoom'); msg(e[1] || ''); renderRoom(true); return; }
  if (!ON.inMatch) return;
  if (k === 'sv') guestSetupPoint(e[1]);
  else if (k === 'pt') {
    const w = mT(e[1]);
    S.lastPoint = Object.assign({}, e[4] || {}, { w });
    pointShow(w, e[2], e[3], false);
  } else if (k === 'hit') {
    sndHit(e[2]);
    if (e[2] === 1) { const me = ON.G[e[1]] === human && !S.spectate; S.shake = me ? .25 : .1; if (me) ON.mySmashes++; }
  } else if (k === 'sand') { sndSand(); puff(e[1] * m, e[2] * m, 16, 1); }
  else if (k === 'spark') sparkle({ x: e[1] * m, y: e[2], z: e[3] * m });
  else if (k === 'fb') shotFeedback(e[1], e[2], e[3]);
  else if (k === 'def') defenseFlash(e[1]);
  else if (k === 'ms') { Object.assign(MTR, { active: true, kind: e[1], type: e[2], center: e[3], half: e[4], pw: e[5] || .2 }); if (!LS.meter) { MTR.t = 0; MTR.v = 0; } clearTimeout(ON.mrTimer); meterDom(MTR); }
  else if (k === 'mr') {
    MTR.active = false; human.charging = false; LS.meter = null;
    el.meter.className = e[1]; el.mRes.textContent = e[2]; el.mFill.style.height = e[3] + '%'; el.meter.hidden = false;
    clearTimeout(ON.mrTimer); ON.mrTimer = setTimeout(() => { if (!MTR.active) el.meter.hidden = true; }, 900);
  } else if (k === 'mh') { MTR.active = false; el.meter.hidden = true; LS.meter = null; LS.charge = null; }
  else if (k === 'over') guestOver(e[1]);
}
// aplica o estado entre dois quadros do anfitrião (a = anterior, b = seguinte, k de 0 a 1)
// ex: segundos além do último estado (pacote atrasado): bola e jogadores seguem pela velocidade
function applyState(a, b, k, ex = 0) {
  const L = (x, y) => x + (y - x) * k, m = ON.mirror ? -1 : 1;
  ball.pos.set(L(a.b[0], b.b[0]) * m, L(a.b[1], b.b[1]), L(a.b[2], b.b[2]) * m);
  ball.vel.set(b.b[3] * m, b.b[4], b.b[5] * m);
  ball.state = b.bs; ball.gk = b.gk; ball.apex = b.ap;
  if (ex > 0 && (b.bs === 'live' || b.bs === 'toss')) { ball.pos.addScaledVector(ball.vel, ex); ball.pos.y = Math.max(C.ballR, ball.pos.y - .5 * bG() * ex * ex); ball.vel.y -= bG() * ex; }
  PL.forEach((_, i) => {
    const p = ON.G[i], pa = a.p[i], pb = b.p[i], sw = p.swing;
    p.pos.set(L(pa[0], pb[0]) * m, 0, L(pa[1], pb[1]) * m);
    p.vel.set(L(pa[2], pb[2]) * m, 0, L(pa[3], pb[3]) * m);
    if (ex > 0) p.pos.addScaledVector(p.vel, ex);
    const same = pa[5] === pb[5] && pa[4] >= 0 && pb[4] >= pa[4];
    sw.t = same ? L(pa[4], pb[4]) : pb[4]; sw.type = pb[5]; sw.dur = pb[6]; sw.side = pb[7]; sw.var = pb[8]; sw.hit = !!pb[9];
    p.jump = pb[10]; p.jumpDur = pb[11]; p.jumpH = pb[12];
    p.charging = !!pb[13];
    if (p === human && !S.spectate) { if (p.charging) { MTR.type = pb[13]; MTR.t = pb[14]; } }
    else p.mtr = p.charging ? { type: pb[13], t: pb[14] } : null;
    p.dive = pb[15] >= 0 ? { t: pb[15], dur: pb[16], landed: true } : null;
    p.split = pb[17]; p.tossT = pb[18] >= pa[18] ? L(pa[18], pb[18]) : pb[18];
    p.tossDur = pb[20] || TOSS_T; // altura de cada lançamento do saque (o tempo até o contato)
    const ct = pb[19]; p.contact = ct ? { x: ct[0] * m, y: ct[1], z: ct[2] * m, u: ct[3], hitId: ct[4] } : null; // raquete vai até onde bateu
  });
  // barra de força de quem está jogando aqui
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
// previsão do próprio jogador: anda na hora com o teclado/joystick (mesma conta de movimento do anfitrião)
// e vai sendo corrigido pela posição que o anfitrião mandou para o mesmo instante das entradas
const PR = { on: false, x: 0, z: 0, vx: 0, vz: 0, hist: [] };
function predictOwn(dt, now, newest, ix, iz) {
  const p = human, len = Math.hypot(ix, iz), m = ON.mirror ? -1 : 1, hp = newest.p[ON.myIdx];
  const serving = S.serverPlayer === p && (S.mode === 'serve' || S.mode === 'toss');
  const free = (S.mode === 'rally' || S.mode === 'serve' || S.mode === 'toss') && !serving && hp[15] < 0 && !(S.settings.assistMove && len < .1);
  if (!free) { PR.on = false; return; } // saque, mergulho, "seguir a bola" e intervalo: fica com a posição do anfitrião
  if (!PR.on) { Object.assign(PR, { on: true, x: p.pos.x, z: p.pos.z, vx: p.vel.x, vz: p.vel.z, hist: [] }); }
  const spd = P_SPEED * lerp(.82, 1.12, attrK(p, 'vel')) * (p.charging ? .75 : 1);
  const tvx = ix * spd, tvz = iz * spd, rev = tvx * PR.vx + tvz * PR.vz < 0;
  const k = Math.min(1, dt * (rev ? 5 : len < .1 ? 9 : 7.5));
  PR.vx += (tvx - PR.vx) * k; PR.vz += (tvz - PR.vz) * k;
  PR.x += PR.vx * dt; PR.z += PR.vz * dt;
  const lim = C.halfW + 3, recv = S.mode === 'serve' || S.mode === 'toss'; // quem não saca fica atrás dos 3 m até o saque
  PR.x = clamp(PR.x, -lim, lim); PR.z = clamp(PR.z, recv ? ZONE3 + .05 : .4, 11.5);
  PR.hist.push({ t: now, x: PR.x, z: PR.z }); while (PR.hist.length && now - PR.hist[0].t > 1500) PR.hist.shift();
  // o último estado do anfitrião já conta as entradas mandadas até ~1 ida e volta antes de chegar
  const tRef = newest.rcv - ON.rtt;
  let h = PR.hist[0]; for (const e of PR.hist) { if (e.t > tRef) break; h = e; }
  const hx = hp[0] * m, hz = hp[1] * m, ex = hx - h.x, ez = hz - h.z;
  if (Math.hypot(ex, ez) > 2) { Object.assign(PR, { x: hx, z: hz, hist: [] }); } // longe demais (ponto novo, empurrão): pula para lá
  else { const c = Math.min(1, dt * 6), cx = ex * c, cz = ez * c; PR.x += cx; PR.z += cz; for (const e of PR.hist) { e.x += cx; e.z += cz; } }
  p.pos.x = PR.x; p.pos.z = PR.z; p.vel.x = PR.vx; p.vel.z = PR.vz;
}
let lastTick = 0;
function guestTick() {
  if (NET.role !== 'guest') return;
  const now = performance.now(), dt = Math.min(.05, lastTick ? (now - lastTick) / 1000 : .016); lastTick = now;
  const playing = ON.inMatch && ON.myIdx >= 0 && inPlay();
  let ix = 0, iz = 0;
  // entradas: direção a cada mudança (e 20 vezes por segundo, caso alguma se perca no canal rápido)
  if (playing) {
    [ix, iz] = localInput();
    human.inputX = ix; human.inputZ = iz; // flecha de mira desenhada aqui
    const key = ix.toFixed(2) + ',' + iz.toFixed(2) + ',' + (S.settings.assistMove ? 1 : 0);
    if (key !== ON.inKey || now - ON.inT > 50) { ON.inKey = key; ON.inT = now; sendFast(ON.fast, ON.conn, ['i', +ix.toFixed(3), +iz.toFixed(3), S.settings.assistMove ? 1 : 0, ++ON.inSeq, Math.round(ON.interp)]); }
  }
  if (ON.off === null) return;
  const rt = now - ON.off - (ON.interp || INTERP_START);
  const buf = ON.buf;
  if (ON.inMatch && buf.length && PLAY_MODES.includes(S.mode)) {
    let i = buf.findIndex(s => s.t >= rt), a, b, k = 0, ex = 0;
    if (i === -1) { a = b = buf[buf.length - 1]; ex = Math.min(.1, (rt - b.t) / 1000); } // atrasou: segue pela velocidade por até 0,1 s
    else if (i === 0) { a = b = buf[0]; }
    else { a = buf[i - 1]; b = buf[i]; k = (rt - a.t) / Math.max(1, b.t - a.t); }
    if (i > 1) buf.splice(0, i - 1);
    if (PLAY_MODES.includes(b.m)) {
      applyState(a, b, Math.min(1, Math.max(0, k)), ex);
      if (playing) { predictOwn(dt, now, buf[buf.length - 1], ix, iz); localShotTick(dt, now); }
    }
  } else if (buf.length > 3) buf.splice(0, buf.length - 3);
  while (ON.evq.length && ON.evq[0].t <= rt) guestEvent(ON.evq.shift().e);
  if (inPlay() === $('netChip').hidden) chipStatus();
}
NET.guestTick = guestTick;

// ---------- sair ----------
// sai do online de vez (fecha a sala ou sai dela) e volta à tela inicial do online com o aviso
function leave(text) {
  const was = NET.role;
  if (was === 'host') for (const g of ON.guests) { sendTo(g.conn, ['bye']); const c = g.conn; setTimeout(() => { try { c.close(); } catch (e) {} }, 150); }
  if (was === 'guest') { send(['bye']); const c = ON.conn; setTimeout(() => { try { c && c.close(); } catch (e) {} }, 150); }
  const p = ON.peer; if (p) setTimeout(() => { try { p.destroy(); } catch (e) {} }, 200);
  clearInterval(ON.hb);
  Object.assign(ON, { peer: null, conn: null, open: false, code: '', rtt: 0, guests: [], room: null, outq: [], match: null, inMatch: false, L: null, G: null, mirror: false, myIdx: -1, buf: [], evq: [], offs: [], off: null, myId: '', seatsKey: '', pickKey: '', champKey: '', fast: null, interp: 0, gap: 0 });
  NET.role = null;
  clearRemote(); restoreNames();
  if (ON.backup) { for (const k in ON.backup) S.settings[k] = ON.backup[k]; ON.backup = null; }
  if (was) toLobbyScreen();
  assignCharacters(); configureMode(); applyRackets(); applyPlayerStyle();
  showPart('onStart'); $('onName').value = ON.name; msg(text || ''); chipStatus();
}
// sai da partida (sem desconectar) para a tela da sala
function toLobbyScreen() {
  S.mode = 'menu'; S.paused = false; el.pause.hidden = true; el.over.hidden = true; el.menu.hidden = true;
  document.body.classList.add('in-menu'); document.body.classList.remove('in-replay'); $('replayBar').hidden = true;
  hideBanner(); el.meter.hidden = true; MTR.active = false; human.charging = false;
  ON.inMatch = false; chipStatus();
}

// ---------- tela da sala (igual para anfitrião e convidados; só o anfitrião muda tipo/modalidade/CPU) ----------
function memberOf(L, id) { return L.members.find(m => m.id === id); }
function renderRoom(force) {
  const L = ON.L; if (!L) return;
  const host = NET.role === 'host', me = ON.myId || (host ? 'host' : '');
  $('onCodeShow').textContent = L.code;
  const myRtt = host ? '' : ON.rtt ? ' · ' + Math.round(ON.rtt) + ' ms' : '';
  $('onStatus').textContent = (host ? 'Você criou a sala' : 'Conectado à sala' + myRtt) + ' · ' + L.members.length + (L.members.length > 1 ? ' pessoas' : ' pessoa') + (L.playing ? ' · partida em andamento' : '');
  $('onMembers').innerHTML = L.members.map(m => '<div class="on-member"><b>' + esc(m.name) + '</b>' + (m.id === 'host' ? ' <small>criou a sala</small>' : '') + (m.id === me ? ' <small>(você)</small>' : '') + ' <small>· ' + esc(charLabel(m.pick)) + (m.id !== 'host' && m.rtt ? ' · ' + m.rtt + ' ms' : '') + '</small></div>').join('');
  // seu personagem (sem repetir o de outra pessoa)
  const mine = memberOf(L, me), taken = new Set(L.members.filter(m => m.id !== me).map(m => m.pick));
  const pk = JSON.stringify([mine && mine.pick, [...taken], L.playing]);
  if ((force || pk !== ON.pickKey) && document.activeElement !== $('onPick')) {
    ON.pickKey = pk;
    $('onPick').innerHTML = byOvr().map(c => '<option value="' + c.id + '"' + (mine && c.id === mine.pick ? ' selected' : '') + (taken.has(c.id) ? ' disabled' : '') + '>' + overall(c.a) + ' · ' + esc(nameOf(c)) + ' (' + c.pais + ')' + (taken.has(c.id) ? ' · em uso' : '') + '</option>').join('');
    $('onPick').disabled = L.playing;
  }
  document.querySelectorAll('input[name=onKind]').forEach(r => { r.checked = r.value === L.kind; r.disabled = !host || L.playing; });
  const champRunning = L.champ && L.champ.champion === null;
  document.querySelectorAll('input[name=onMode]').forEach(r => { r.checked = r.value === L.mode; r.disabled = !host || L.playing || (L.kind === 'champ' && champRunning); });
  document.querySelectorAll('input[name=onGames]').forEach(r => { r.checked = +r.value === L.games; r.disabled = !host || L.playing; });
  $('onMatch').hidden = L.kind !== 'match'; $('onChamp').hidden = L.kind !== 'champ';
  if (L.kind === 'match') renderSeats(L, me, host, force); else renderChamp(L, me, host, force);
  const play = $('onPlay');
  play.hidden = !host; play.disabled = L.playing;
  play.textContent = L.kind === 'match' ? 'Começar partida' : !L.champ || L.champ.champion !== null ? 'Começar campeonato' : 'Jogar a próxima partida';
}
function renderSeats(L, me, host, force) {
  const key = JSON.stringify([L.mode, L.seats, L.cpu, L.members.map(m => [m.id, m.name, m.pick]), me, L.playing, host]);
  if (!force && key === ON.seatsKey) return;
  ON.seatsKey = key;
  const act = activeSeats(L.mode), single = L.mode === 'simples';
  const card = s => {
    const o = L.seats[s], m = o && memberOf(L, o), mineS = o === me;
    let h = '<div class="on-seat' + (mineS ? ' mine' : '') + '"><small>' + (single ? 'Jogador' : SEAT_SIDE[s] === 'dir' ? 'Direita' : 'Esquerda') + '</small>';
    if (m) h += '<span class="who">' + esc(m.name) + (mineS ? ' (você)' : '') + '</span><small>' + esc(charLabel(m.pick)) + '</small>';
    else if (host) h += '<span class="who cpu">CPU</span><select class="cr-sel" data-cpu="' + s + '"' + (L.playing ? ' disabled' : '') + '>' + byOvr().map(c => '<option value="' + c.id + '"' + (c.id === L.cpu[s] ? ' selected' : '') + (L.members.some(x => x.pick === c.id) ? ' disabled' : '') + '>' + overall(c.a) + ' · ' + esc(nameOf(c)) + '</option>').join('') + '</select>';
    else h += '<span class="who cpu">CPU</span><small>' + esc(charLabel(L.cpu[s])) + '</small>';
    if (!L.playing && (!o || mineS)) h += '<button type="button" class="ghost sm" data-seat="' + (mineS ? '' : s) + '">' + (mineS ? 'Levantar' : 'Sentar aqui') + '</button>';
    return h + '</div>';
  };
  const team = t => '<div class="on-team t' + t + '"><h4>Time ' + t + '</h4>' + act.filter(s => s[0] === t).map(card).join('') + '</div>';
  $('onSeats').innerHTML = team('A') + team('B');
  $('onSeats').querySelectorAll('[data-seat]').forEach(b => b.addEventListener('click', () => doAct(['seat', b.dataset.seat || null])));
  $('onSeats').querySelectorAll('[data-cpu]').forEach(sel => sel.addEventListener('change', () => doAct(['cpu', sel.dataset.cpu, sel.value])));
}
function renderChamp(L, me, host, force) {
  const ch = L.champ, key = JSON.stringify([ch, L.members.map(m => [m.id, m.name, m.pick]), L.mode, me, host]);
  if (!force && key === ON.champKey) return;
  ON.champKey = key;
  const box = $('onChamp');
  if (!ch) {
    let size = 2; while (size < L.members.length) size *= 2;
    box.innerHTML = '<p class="keys">Todos da sala entram na chave, cada um com o personagem escolhido' + (L.mode === 'dupla' ? ' e um parceiro da CPU' : '') + '. ' + L.members.length + (L.members.length > 1 ? ' pessoas' : ' pessoa') + ' → chave de ' + size + (size > L.members.length ? ' (completa com CPU)' : '') + '. As partidas são uma por vez: quem não está jogando assiste.</p>';
    return;
  }
  const ent = i => { const e = ch.entries[i]; if (!e) return '—'; const c = charById(e.pick); return e.mid ? esc(e.name) + ' <small>(' + esc(shortOf(c)) + ')</small>' : 'CPU <small>(' + esc(shortOf(c)) + ')</small>'; };
  const names = n => n === 1 ? 'Final' : n === 2 ? 'Semifinal' : n === 4 ? 'Quartas' : 'Oitavas';
  const next = ch.champion === null ? ch.rounds[ch.rounds.length - 1].find(m => m.w === null) : null;
  const rounds = ch.rounds.map(r => '<div class="rd"><h5>' + names(r.length) + '</h5>' + r.map(m => '<div class="m' + (m === next || (next && m.a === next.a && m.b === next.b) ? ' next' : '') + '">'
    + ['a', 'b'].map(s => '<div class="' + (m.w === null ? '' : m.w === m[s] ? 'w' : 'l') + '"><span>' + ent(m[s]) + '</span></div>').join('')
    + (m.score ? '<div><small>' + esc(m.score) + (m.sim ? ' · simulado' : '') + '</small></div>' : '') + '</div>').join('') + '</div>').join('');
  let info = '';
  if (ch.champion !== null) info = '<p class="on-status">🏆 Campeão: ' + ent(ch.champion) + '</p>';
  else if (next) info = '<p class="keys">Próxima partida: <b>' + ent(next.a) + '</b> contra <b>' + ent(next.b) + '</b>.</p>';
  box.innerHTML = '<div class="on-bracket">' + rounds + '</div>' + info + (host ? '<div class="cta-row"><button type="button" class="ghost sm" id="onChampNew">' + (ch.champion !== null ? 'Montar outro campeonato' : 'Cancelar o campeonato') + '</button></div>' : '');
  const nb = $('onChampNew'); if (nb) nb.addEventListener('click', () => { ON.room.champ = null; broadcast(); });
}
// ação na sala: o convidado pede ao anfitrião; o anfitrião aplica direto
function doAct(m) { if (NET.role === 'host') act('host', m); else send(m); }

// ---------- botões e atalhos ----------
$('btnOnline').addEventListener('click', openOnline);
$('onBack').addEventListener('click', closeOnline);
$('onCreate').addEventListener('click', createRoom);
$('onJoin').addEventListener('click', joinRoom);
$('onCode').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
$('onCode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); });
$('onPick').addEventListener('change', e => doAct(['pick', e.target.value]));
document.querySelectorAll('input[name=onKind]').forEach(r => r.addEventListener('change', () => doAct(['kind', r.value])));
document.querySelectorAll('input[name=onMode]').forEach(r => r.addEventListener('change', () => doAct(['mode', r.value])));
document.querySelectorAll('input[name=onGames]').forEach(r => r.addEventListener('change', () => doAct(['games', r.value])));
$('onPlay').addEventListener('click', () => { ac(); if (NET.role === 'host') hostPlay(); });
$('onLeave').addEventListener('click', () => { leave(''); closeOnline(); });
$('onCopy').addEventListener('click', () => {
  const link = location.href.split('#')[0] + '#sala=' + ON.code;
  const done = () => msg('Link copiado: ' + link, true);
  if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, () => msg('Mande este link: ' + link, true)); else msg('Mande este link: ' + link, true);
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
addEventListener('beforeunload', () => { if (NET.role === 'guest') send(['bye']); else if (NET.role === 'host') for (const g of ON.guests) sendTo(g.conn, ['bye']); });
// para testes no console
window.__pdoNet = { ON, NET };
