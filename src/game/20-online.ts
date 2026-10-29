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
import { C, HEIGHTS, NAMES, P_SPEED, ROSTER, SWING_DUR, TOSS_T, ZONE3, attrK, velMul, accOf, accelStep, backZ, backAcc, bG, charById, clamp, lerp, nameOf, overall, shortOf, RACKET_STATS, leituraOf, voleioOf, ATTRS, attrOf, effA, racketBonus, rkSummary } from './00-base';
import { S, NET } from './01-estado';
import { cpuA, cpuB, human, partner } from './06-modelos';
import { applyPlayerStyle, applyRackets, assignCharacters, ball, ballMark, puff, resetTrail, sparkle, greenWave } from './07-glb';
import { ac, sndHit, sndSand } from './08-audio';
import { crSlots, crSlotChar, crCharFromJSON, clCareerChars, CL, SB_URL, SB_KEY } from './14-carreira';
import { $, configureMode, el, feedback, hideBanner, newMatch, pointShow, renderBoard, serveBanner, showOver, shotFeedback, showReview, COURTS } from './09-interface';
import { defenseFlash, tossDurOf } from './11-mira';
import { startMeter, MTR, inPlay, makeRemoteCtl, meterDom, pressShot, readMenu, releaseShot, syncMenu, saveSettings, renderBallPickers, renderBinds, renderCourtPickers, applyMeterLook } from './12-controles';
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
// ---------- lista de salas abertas (Supabase Realtime Presence: sem tabela; a sala some sozinha quando o anfitrião sai) ----------
const RL = { client: null, ch: null, rooms: [], tracked: false, state: '', last: '' };
async function rlChannel() {
  if (RL.ch) return RL.ch;
  const { RealtimeClient } = await import('@supabase/realtime-js');
  RL.client = new RealtimeClient(SB_URL.replace(/^http/, 'ws') + '/realtime/v1', { params: { apikey: SB_KEY } });
  const ch = RL.client.channel('salas-v1', { config: { presence: { key: 'p' + Math.random().toString(36).slice(2, 9) } } });
  ch.on('presence', { event: 'sync' }, () => { RL.rooms = Object.values(ch.presenceState()).flat().filter(x => x && x.code); renderRoomList(); });
  RL.ch = ch; RL.state = 'conectando'; renderRoomList();
  try { await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('tempo esgotado')), 12000); ch.subscribe(st => { if (st === 'SUBSCRIBED') { clearTimeout(t); res(); } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { clearTimeout(t); rej(new Error(st)); } }); }); }
  catch (e) { try { RL.client.disconnect(); } catch (e2) {} RL.client = null; RL.ch = null; RL.tracked = false; throw e; } // sem servidor: para de tentar (tenta de novo ao reabrir o online)
  RL.state = 'ok'; renderRoomList();
  return ch;
}
const rlPublic = () => !$('onPublic') || $('onPublic').checked;
// anfitrião: anuncia (ou atualiza) a sala na lista; só quando o jogador deixou a sala pública
async function rlAnnounce() {
  if (NET.role !== 'host' || !ON.room || !ON.code) return;
  if (!rlPublic()) { rlStop(); return; }
  const info = { code: ON.code, host: (ON.self && ON.self.name) || 'Jogador', mode: ON.room.mode, n: members().length, playing: !!ON.room.playing };
  const key = JSON.stringify(info); if (key === RL.last && RL.tracked) return; RL.last = key;
  try { const ch = await rlChannel(); await ch.track(Object.assign({ at: Date.now() }, info)); RL.tracked = true; } catch (e) { RL.state = 'erro'; }
}
async function rlStop() { RL.last = ''; if (RL.ch && RL.tracked) { RL.tracked = false; try { await RL.ch.untrack(); } catch (e) {} } }
function renderRoomList() {
  const box = $('onRooms'); if (!box) return;
  if (RL.state === 'erro') { box.innerHTML = '<p class="cr-note cr-wrap">Lista de salas indisponível agora (sem conexão com o servidor). Entre pelo código.</p>'; return; }
  if (RL.state !== 'ok') { box.innerHTML = '<p class="cr-note cr-wrap">Procurando salas abertas…</p>'; return; }
  const list = RL.rooms.filter(r => r.code !== ON.code).sort((a, b) => (a.playing - b.playing) || (b.at - a.at));
  box.innerHTML = list.length ? list.map(r => '<div class="cr-slot"><div class="who"><b>Sala de ' + escHtml(r.host || 'Jogador') + '</b><span>' + (r.mode === 'simples' ? 'Simples' : 'Dupla') + ' · ' + (r.n || 1) + (r.n === 1 ? ' jogador' : ' jogadores') + ' · código ' + escHtml(r.code) + (r.playing ? ' · em partida' : '') + '</span></div><div class="acts"><button class="cta sm" data-room="' + escHtml(r.code) + '">Entrar</button></div></div>').join('')
    : '<p class="cr-note cr-wrap">Nenhuma sala aberta agora. Crie uma e ela aparece aqui para os outros.</p>';
  box.querySelectorAll('[data-room]').forEach(b => b.addEventListener('click', () => { $('onCode').value = b.dataset.room; joinRoom(); }));
}
const escHtml = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function openOnline() {
  ac(); readMenu(); // usa o que está marcado no menu (games, dificuldade, jogadores)
  msg('');
  if (NET.role) { showPart('onRoom'); renderRoom(true); } else { showPart('onStart'); $('onName').value = ON.name; setTimeout(() => $('onCode').focus(), 0); }
  if (!QQ.on) { qFill(); qLoadCloud(); } // carreiras da conta (nuvem) para a fila
  if (!NET.role) { renderRoomList(); rlChannel().catch(() => { RL.state = 'erro'; renderRoomList(); }); }
}
function closeOnline() { if (QQ.on) queueStop(); $('online').hidden = true; el.menu.hidden = false; syncMenu(); }
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
  if (!t && e && e.message) console.warn('online', e);
  return 'Erro na conexão' + (t ? ' (' + t + ')' : e && e.message ? ' (' + String(e.message).slice(0, 80) + ')' : '') + '. Tente de novo.';
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
    ON.peer = peer; ON.code = code; ON.open = true; NET.role = 'host'; backupSettings(); S.cpuLv = 3;
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
  if (QQ.auto) queueHostTick();
}
// personagens da CPU: sem repetir nenhum que alguém da sala escolheu
function sanitizeCC(c, mid) {
  if (!c || typeof c !== 'object' || !c.a) return null;
  const a = {}; for (const k of ['forca', 'vel', 'def', 'backhand', 'curta', 'lob', 'smash', 'saque']) a[k] = clamp(Math.round(+c.a[k] || 50), 30, 99);
  a.leitura = clamp(Math.round(+c.a.leitura || leituraOf(a)), 30, 99);
  a.voleio = clamp(Math.round(+c.a.voleio || voleioOf(a)), 30, 99);
  const L = c.look || {}, look = {};
  for (const k of ['skin', 'hair', 'hairStyle', 'beard', 'cap', 'visor', 'headband', 'glasses', 'band', 'tank', 'num', 'glassStyle', 'lens']) if (L[k] !== undefined && typeof L[k] !== 'object') look[k] = typeof L[k] === 'string' ? L[k].slice(0, 24) : L[k];
  look.racket = RACKET_STATS[L.racket] ? L.racket : 'proteo';
  return { id: 'cc_' + mid, name: String(c.name || 'Jogador').slice(0, 24), alt: clamp(+c.alt || 182, 150, 215), pais: String(c.pais || 'BRA').slice(0, 3).toUpperCase(), fem: !!c.fem,
    build: ['atletico', 'esguio', 'compacto', 'forte'].includes(c.build) ? c.build : 'atletico', estilo: String(c.estilo || 'Carreira').slice(0, 30), canhoto: !!c.canhoto || undefined, a, look, career: true };
}
const regOnlineChars = list => { $s.ONLINE_CHARS = (list || members()).filter(m => m.cc).map(m => m.cc); };
function fixCpu() {
  const used = new Set(members().map(m => m.pick).filter(Boolean));
  const free = () => byOvr().find(c => !used.has(c.id)).id;
  for (const s of SEATS) { let id = ON.room.cpu[s]; if (!id || used.has(id) || !ROSTER.some(c => c.id === id)) id = free(); ON.room.cpu[s] = id; used.add(id); }
}
function lobbyState() {
  return {
    code: ON.code, kind: ON.room.kind, mode: ON.room.mode, games: S.settings.games, diff: S.settings.diff, court: S.settings.court || 'praia',
    members: members().map(m => ({ id: m.id, name: m.name, pick: m.pick, rtt: m.id === 'host' ? 0 : Math.round(m.rtt), cc: m.cc || null, rk: m.rk || '' })),
    seats: ON.room.seats, cpu: ON.room.cpu, champ: ON.room.champ, playing: ON.room.playing, cpuLv: ON.room.cpuLv || 3,
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
    if ((ROSTER.some(c => c.id === id) || (mem.cc && id === mem.cc.id)) && !members().some(x => x !== mem && x.pick === id)) mem.pick = id;
  }
  // personagem da carreira de quem está na sala: o anfitrião confere os valores e passa a valer para todos
  // raquete escolhida por quem está na sala ('' = a do personagem)
  if (m[0] === 'pd') { mem.pd = clamp(Math.round(+m[1] || 3), 1, 6); const g = guestById(mid); if (g && g.ctl) { g.ctl.pd = mem.pd; g.ctl.p.pdRemote = mem.pd; } } // dificuldade de timing de cada jogador
  if (m[0] === 'racket' && !room.playing) mem.rk = RACKET_STATS[m[1]] && m[1] !== 'assinatura' ? m[1] : '';
  if (m[0] === 'cchar' && !room.playing) { const cc = sanitizeCC(m[1], mid); if (cc) { mem.cc = cc; mem.pick = cc.id; regOnlineChars(); } }
  if (mid === 'host' && m[0] === 'cpu' && SEATS.includes(m[1]) && ROSTER.some(c => c.id === m[2]) && !members().some(x => x.pick === m[2])) {
    const other = SEATS.find(s => s !== m[1] && room.cpu[s] === m[2]); if (other) room.cpu[other] = room.cpu[m[1]];
    room.cpu[m[1]] = m[2];
  }
  if (mid === 'host' && m[0] === 'cpulv' && !room.playing) { room.cpuLv = clamp(Math.round(+m[1] || 3), 1, 6); S.cpuLv = room.cpuLv; } // nível da CPU (estrelas)
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
  if (k === 'seat' || k === 'pick' || k === 'cchar' || k === 'racket' || k === 'pd') { act(g.id, d); return; } // ações da sala vindas de quem entrou
  if (!c) return;
  if (k === 'i') {
    if (d[4] <= g.inSeq) return; g.inSeq = d[4]; // chegou fora de ordem: já há uma mais nova
    if (d[5] > 0) { g.interp = d[5]; c.lag = lagOf(g); }
    const s = c.p.team === 0 ? 1 : -1; c.ix = (+d[1] || 0) * s; c.iz = (+d[2] || 0) * s; c.assistMove = !!d[3]; return; // time de cima: a tela dele é espelhada
  }
  // o convidado sorteia a altura do lançamento e o lugar do verde do smash e manda junto: os dois usam o mesmo valor
  if (k === 's' && inPlay()) { if (d[2]) { c.tossF = d[3] || 0; c.smC = d[4] || 0; pressShot(d[1], c); } else releaseShot(d[1], c); }
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
    if (g) { g.ctl = makeRemoteCtl(p); g.ctl.lag = lagOf(g); g.plIdx = i; g.ctl.pd = g.pd || 3; p.pdRemote = g.pd || 3; NET.remote.push(g.ctl); }
  });
  if (!human.netHuman) human.mtr = MTR;
  S.spectate = !hostSeat; document.body.classList.toggle('spectate', S.spectate);
  S.settings.mode = mode; S.settings.format = 'set';
  S.settings.pick = { me: pickByPl[0], mate: pickByPl[1], o1: pickByPl[2], o2: pickByPl[3] };
  const c0 = charById(pickByPl[0]); S.settings.racket = (c0.look && c0.look.racket) || S.settings.racket;
  S.careerActive = false; S.champActive = false;
  // raquete de cada boneco: a escolhida por quem joga com ele (ou a do personagem)
  const rkByPl = ownerByPl.map(o => { const m = o && (o === 'host' ? ON.self : guestById(o)); return (m && m.rk) || ''; });
  S.rkPick = { me: rkByPl[0], mate: rkByPl[1], o1: rkByPl[2], o2: rkByPl[3] };
  ON.match = { plSeat, ownerByPl, pickByPl, rkByPl, champM, teamOfSim: [t0, t1] };
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
  return { me: g.plIdx, picks: M.pickByPl, rackets: M.rkByPl || [], humans: M.ownerByPl.map(o => !!o), players: PL.map(p => p.netName || ''), court: S.settings.court || 'praia', settings: { mode: S.settings.mode, games: S.settings.games, diff: S.settings.diff, format: S.settings.format }, names, heights };
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
  else if (k === 'wave') ON.outq.push(['wave', r3(a.x), r3(a.z)]);
  else if (k === 'review') ON.outq.push(['rev', a.x, a.z, a.axis, a.inB ? 1 : 0, a.mg]);
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
  // CPUs do campeonato: mesmo gênero de quem joga (todas mulheres → feminino; homens e mulheres → misto, com duplas mistas)
  // e nível perto do de quem joga (média dos personagens das pessoas na sala)
  const hc = mem.map(m => charById(m.pick)), fems = hc.map(c => !!c.fem), mixed = fems.includes(true) && fems.includes(false), allF = !fems.includes(false);
  const target = hc.reduce((t, c) => t + overall(c.a), 0) / Math.max(1, hc.length);
  const free = fem => { // fem: true/false/undefined (qualquer, no misto)
    const pool = ROSTER.filter(c => !used.has(c.id) && (fem === undefined ? (mixed || !!c.fem === allF) : !!c.fem === fem));
    const pick = pool.map(c => ({ c, d: Math.abs(overall(c.a) - target) + Math.random() * 3 })).sort((x, y) => x.d - y.d)[0] || { c: byOvr().find(c => !used.has(c.id)) };
    used.add(pick.c.id); return pick.c.id;
  };
  const entries = mem.map(m => ({ mid: m.id, name: m.name, pick: m.pick }));
  let size = 2; while (size < entries.length) size *= 2;
  for (let i = 0; entries.length < size; i++) entries.push({ mid: null, name: '', pick: free(mixed ? i % 2 === 0 : undefined) });
  // dupla: cada um joga com um parceiro da CPU (no misto, do outro gênero; nas CPUs, um homem e uma mulher)
  if (mode === 'dupla') entries.forEach(e => { const f = !!charById(e.pick).fem; e.mate = free(mixed ? !f : undefined); });
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
    send(['pd', S.settings.playerDiff || 3]); // a sua dificuldade de timing vale nas suas barras e golpes
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
  if (down) { LS.tossF = .82 + Math.random() * .38; LS.smC = .5 + Math.random() * .42; }
  send(down ? ['s', type, 1, LS.tossF, LS.smC] : ['s', type, 0]);
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
    // monta a barra com a mesma conta do anfitrião (duração do lançamento, verde e faixa): quando os dados dele chegam, nada pula
    const td = tossDurOf(type, LS.tossF); human.tossDur = td.dur; human.tossMul = td.mul;
    startMeter('serve', type, { m: MTR, p: human, remote: false });
    LS.meter = { kind: 'serve', type, t0: now, fill: MTR.fill };
    return;
  }
  if (S.mode !== 'rally' || (LS.t >= 0 && LS.t < LS.dur * .8)) return;
  if (type === 'smash' || type === 'lob') {
    LS.charge = type; LS.c0 = now; LS.t = -1;
    if (type === 'smash') MTR.center = LS.smC || .78; // o verde já começa no lugar certo
    if (type === 'lob') { const tk = [1.45, 1.2, 1, .87, .75, .66][clamp(Math.round(+S.settings.playerDiff || 3), 1, 6) - 1]; LS.meter = { kind: 'lob', type, t0: now, fill: .45 }; Object.assign(MTR, { active: true, kind: 'lob', type, t: 0, v: 0, center: -1, half: 0, tk, altoLo: clamp(.75 - (tk - 1) * .4, .55, .86), lmax: 1 + lerp(.25, .1, Math.min(1, attrK(human, 'lob'))) / tk }); meterDom(MTR); }
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
  if (k === 'L') { ON.L = d[1]; regOnlineChars(d[1].members || []); if (!$('online').hidden && !ON.inMatch) renderRoom(); return; }
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
  Object.assign(S.settings, cfg.settings); S.netCourt = cfg.court || 'praia';
  const pick = {}, rk = {}; ON.G.forEach((p, i) => { pick[SLOT.get(p)] = cfg.picks[i]; rk[SLOT.get(p)] = (cfg.rackets || [])[i] || ''; }); S.settings.pick = pick; S.rkPick = rk;
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
  } else if (k === 'sand') { sndSand(); puff(e[1] * m, e[2] * m, 16, 1); ballMark(e[1] * m, e[2] * m); }
  else if (k === 'spark') sparkle({ x: e[1] * m, y: e[2], z: e[3] * m });
  else if (k === 'wave') greenWave({ x: e[1] * m, z: e[2] * m });
  else if (k === 'rev') showReview({ x: e[1] * m, z: e[2] * m, axis: e[3], inB: !!e[4], mg: e[5] });
  else if (k === 'fb') shotFeedback(e[1], e[2], e[3]);
  else if (k === 'def') defenseFlash(e[1]);
  else if (k === 'ms') { Object.assign(MTR, { active: true, kind: e[1], type: e[2], center: e[3], half: e[4], pw: e[5] || .2, lmax: e[6] || undefined, tk: e[7] || 1, altoLo: e[8] || undefined, fill: e[9] || (e[1] === 'lob' ? .45 : .9) }); if (!LS.meter) { MTR.t = 0; MTR.v = 0; } clearTimeout(ON.mrTimer); meterDom(MTR); }
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
  const spd = P_SPEED * velMul(p.char ? attrOf(p.char.a, 'vel') : 70) * (S.femPace ? .88 : 1) * (p.charging ? .75 : 1);
  const tvx = ix * spd, tvz = backZ(PR.z > 0 ? 0 : 1, iz * spd); // mesma aceleração (e para trás mais lento) do anfitrião; lado pela posição (a tela do convidado pode estar espelhada)
  [PR.vx, PR.vz] = accelStep(PR.vx, PR.vz, tvx, tvz, dt, backAcc(PR.z > 0 ? 0 : 1, tvz, (accOf(p.char ? attrOf(p.char.a, 'vel') : 70) * (S.femPace ? .85 : 1)) * (p.burst > 0 && len > .1 ? 1.6 : 1)));
  PR.x += PR.vx * dt; PR.z += PR.vz * dt;
  const lim = C.halfW + 3, recv = S.mode === 'serve' || S.mode === 'toss'; // quem não saca fica atrás dos 3 m até o saque (o parceiro do sacador, dos 6 m no profissional)
  PR.x = clamp(PR.x, -lim, lim); PR.z = clamp(PR.z, recv ? (p.team === S.server ? S.zoneR || ZONE3 : ZONE3) + .05 : .4, 11.5);
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
  rlStop();
  const was = NET.role;
  if (was === 'host') for (const g of ON.guests) { sendTo(g.conn, ['bye']); const c = g.conn; setTimeout(() => { try { c.close(); } catch (e) {} }, 150); }
  if (was === 'guest') { send(['bye']); const c = ON.conn; setTimeout(() => { try { c && c.close(); } catch (e) {} }, 150); }
  const p = ON.peer; if (p) setTimeout(() => { try { p.destroy(); } catch (e) {} }, 200);
  clearInterval(ON.hb);
  $s.ONLINE_CHARS = []; S.rkPick = null;
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
// ---------- fichas dos jogadores na sala (atributos de cada personagem, com a raquete escolhida) ----------
function charCard(c, rk, who, small, team) {
  if (!c) return '';
  const a = effA(c.a, rk ? racketBonus(rk) : null), ov = overall(a);
  const bars = ATTRS.map(([k, lbl]) => { const v = attrOf(a, k); return '<span>' + lbl + '</span><span class="bar"><i class="' + (v >= 85 ? 'hi' : v <= 60 ? 'lo' : '') + '" style="width:' + v + '%"></i></span><b>' + v + '</b>'; }).join('');
  return '<div class="on-cardi' + (small ? ' sm' : '') + (team ? ' t' + team : '') + '"><div class="on-cardh"><div class="ovr">' + ov + '<small>OVR</small></div><div><b>' + escHtml(nameOf(c)) + '</b><span>' + (who ? escHtml(who) + ' · ' : '') + (c.pais || '') + ' · ' + (c.canhoto ? 'canhoto' : 'destro') + ' · ' + escHtml(c.estilo || '') + (rk && RACKET_STATS[rk] ? ' · raquete ' + escHtml(RACKET_STATS[rk].nome) : '') + '</span></div></div><div class="bars">' + bars + '</div></div>';
}
function renderCards(L) {
  const my = L.members.find(m => m.id === (ON.myId || 'host')), seatOf = id => Object.entries(L.seats || {}).filter(([, v]) => v === id).map(([k]) => k)[0];
  const teamOf = k => k ? (k[0] === 'A' ? 'a' : 'b') : '';
  if (my) $('onMyCard').innerHTML = charCard(charById(my.cc ? my.cc.id : my.pick), my.rk || null, 'você', false, L.kind === 'match' ? teamOf(seatOf(my.id)) : '');
  // cartões coloridos por equipe (time A laranja, time B azul; quem assiste fica neutro): time A, time B e depois quem assiste
  const list = L.members.map(m => { const k = L.kind === 'match' ? seatOf(m.id) : null; return { k, html: charCard(charById(m.cc ? m.cc.id : m.pick), m.rk || null, m.name + (k ? ' · lugar ' + k : L.kind === 'match' ? ' · assistindo' : ''), true, teamOf(k)) }; });
  if (L.kind === 'match') Object.entries(L.seats || {}).forEach(([k, v]) => { if (!v && L.cpu && L.cpu[k] && (L.mode === 'dupla' || /1$/.test(k))) list.push({ k, html: charCard(charById(L.cpu[k]), null, 'CPU · lugar ' + k, true, teamOf(k)) }); });
  const ord = x => !x.k ? 3 : x.k[0] === 'A' ? 1 : 2;
  const grp = t => list.filter(x => ord(x) === t).sort((x, y) => (x.k || '').localeCompare(y.k || '')).map(x => x.html).join('');
  const head = (t, cls) => '<p class="section-label on-team ' + cls + '">' + t + '</p>';
  $('onAllCards').innerHTML = L.kind === 'match'
    ? (grp(1) ? head('Time A', 'ta') + '<div class="on-cards">' + grp(1) + '</div>' : '') + (grp(2) ? head('Time B', 'tb') + '<div class="on-cards">' + grp(2) + '</div>' : '') + (grp(3) ? head('Assistindo', '') + '<div class="on-cards">' + grp(3) + '</div>' : '')
    : '<div class="on-cards">' + list.map(x => x.html).join('') + '</div>';
}
document.querySelectorAll('[data-ontab]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('[data-ontab]').forEach(x => x.classList.toggle('sel', x === b));
  document.querySelectorAll('[data-onpane]').forEach(pn => { pn.hidden = pn.dataset.onpane !== b.dataset.ontab; });
}));
function renderRoom(force) {
  const L = ON.L; if (!L) return;
  try { renderCards(L); } catch (e) {}
  if (NET.role === 'host') rlAnnounce(); // atualiza a sala na lista pública (jogadores, em partida)
  const host = NET.role === 'host', me = ON.myId || (host ? 'host' : '');
  $('onCodeShow').textContent = L.code;
  const myRtt = host ? '' : ON.rtt ? ' · ' + Math.round(ON.rtt) + ' ms' : '';
  $('onStatus').textContent = (host ? 'Você criou a sala' : 'Conectado à sala' + myRtt) + ' · ' + L.members.length + (L.members.length > 1 ? ' pessoas' : ' pessoa') + (L.playing ? ' · partida em andamento' : '');
  $('onMembers').innerHTML = L.members.map(m => '<div class="on-member"><b>' + esc(m.name) + '</b>' + (m.id === 'host' ? ' <small>criou a sala</small>' : '') + (m.id === me ? ' <small>(você)</small>' : '') + ' <small>· ' + esc(charLabel(m.pick)) + (m.id !== 'host' && m.rtt ? ' · ' + m.rtt + ' ms' : '') + '</small></div>').join('');
  // seu personagem (sem repetir o de outra pessoa)
  const mine = memberOf(L, me), taken = new Set(L.members.filter(m => m.id !== me).map(m => m.pick));
  const pk = JSON.stringify([mine && mine.pick, [...taken], L.playing, mine && mine.cc && mine.cc.name]);
  fillCcSlots();
  { const ck = (L.court || 'praia') + (NET.role === 'host' && !L.playing); if (ON.courtKey !== ck) { ON.courtKey = ck; renderCourtPickers(L.court || 'praia', NET.role === 'host' && !L.playing); } }
  { const rs = $('onRk'); if (rs && document.activeElement !== rs) { const want = (mine && mine.rk) || ''; if (!rs.options.length) rs.innerHTML = '<option value="">A do personagem</option>' + Object.entries(RACKET_STATS).filter(([k]) => k !== 'assinatura').map(([k, r]) => '<option value="' + k + '">' + esc(r.nome) + ' (' + rkSummary(k) + ')</option>').join(''); rs.value = want; } }
  if ((force || pk !== ON.pickKey) && document.activeElement !== $('onPick')) {
    ON.pickKey = pk;
    $('onPick').innerHTML = (mine && mine.cc ? '<option value="' + mine.cc.id + '"' + (mine.pick === mine.cc.id ? ' selected' : '') + '>★ ' + overall(mine.cc.a) + ' · ' + (mine.cc.canhoto ? 'L' : 'R') + ' · ' + esc(mine.cc.name) + ' (sua carreira)</option>' : '') + byOvr().map(c => '<option value="' + c.id + '"' + (mine && c.id === mine.pick ? ' selected' : '') + (taken.has(c.id) ? ' disabled' : '') + '>' + overall(c.a) + ' · ' + (c.canhoto ? 'L' : 'R') + ' · ' + esc(nameOf(c)) + ' (' + c.pais + ')' + (taken.has(c.id) ? ' · em uso' : '') + '</option>').join('');
    $('onPick').disabled = L.playing;
  }
  document.querySelectorAll('input[name=onKind]').forEach(r => { r.checked = r.value === L.kind; r.disabled = !host || L.playing; });
  const champRunning = L.champ && L.champ.champion === null;
  document.querySelectorAll('input[name=onMode]').forEach(r => { r.checked = r.value === L.mode; r.disabled = !host || L.playing || (L.kind === 'champ' && champRunning); });
  document.querySelectorAll('input[name=onGames]').forEach(r => { r.checked = +r.value === L.games; r.disabled = !host || L.playing; });
  { const cl = $('onCpuLv'); cl.value = String(L.cpuLv || 3); cl.disabled = !host || L.playing; }
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
    else if (host) h += '<span class="who cpu">CPU</span><select class="cr-sel" data-cpu="' + s + '"' + (L.playing ? ' disabled' : '') + '>' + byOvr().map(c => '<option value="' + c.id + '"' + (c.id === L.cpu[s] ? ' selected' : '') + (L.members.some(x => x.pick === c.id) ? ' disabled' : '') + '>' + overall(c.a) + ' · ' + (c.canhoto ? 'L' : 'R') + ' · ' + esc(nameOf(c)) + '</option>').join('') + '</select>';
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
S.onPd = v => { if (NET.role === 'guest') send(['pd', v]); }; // mudou a dificuldade de timing durante a sala
function doAct(m) { if (NET.role === 'host') act('host', m); else send(m); }

// ---------- botões e atalhos ----------
$('btnOnline').addEventListener('click', openOnline);
$('onBack').addEventListener('click', closeOnline);
$('onCreate').addEventListener('click', createRoom);
$('onJoin').addEventListener('click', joinRoom);
$('onCode').addEventListener('keydown', e => { if (e.key === 'Enter') joinRoom(); });
$('onCode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); });
$('onPick').addEventListener('change', e => doAct(['pick', e.target.value]));
$('onRk').addEventListener('change', e => doAct(['racket', e.target.value]));
// configurações dentro do online (bolinha, nome do golpe, marcações e teclas)
$('onCfgBtn').addEventListener('click', () => {
  $('shotTextSel2').value = S.settings.shotText || 'discreto'; $('assistMark2').checked = !!S.settings.assistMark; $('aimArrow2').checked = S.settings.aimArrow !== false;
  renderBallPickers(); renderBinds(); applyMeterLook(); $('onCfg').hidden = false;
});
$('onCfgClose').addEventListener('click', () => { $('onCfg').hidden = true; });
$('shotTextSel2').addEventListener('change', e => { S.settings.shotText = e.target.value; saveSettings(); });
$('assistMark2').addEventListener('change', e => { S.settings.assistMark = e.target.checked; saveSettings(); });
$('aimArrow2').addEventListener('change', e => { S.settings.aimArrow = e.target.checked; saveSettings(); });
NET.onCourt = () => { if (NET.role === 'host') broadcast(); }; // quem criou a sala trocou a quadra: avisa todos
// personagem da carreira: de um save deste navegador ou de um arquivo .json
function fillCcSlots() {
  const sel = $('onCcSlot'); if (!sel || document.activeElement === sel) return;
  const sl = crSlots(), key = sl.map(x => x.id + x.ovr).join();
  if (sel.dataset.k === key) return; sel.dataset.k = key;
  sel.innerHTML = sl.length ? sl.map(x => '<option value="' + x.id + '">' + esc(x.name) + ' · OVR ' + x.ovr + ' · ' + esc(x.tier) + '</option>').join('') : '<option value="">Nenhuma carreira salva neste navegador</option>';
}
function useCareerChar(c) {
  if (!c) { msg('Não deu para ler esse save de carreira.'); return; }
  doAct(['cchar', c]); msg('Você vai jogar com ' + c.name + ' (OVR ' + overall(c.a) + ').');
}
$('onCcUse').addEventListener('click', () => { const id = $('onCcSlot').value; if (id) useCareerChar(crSlotChar(id)); });
$('onCcFile').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => useCareerChar(crCharFromJSON(String(rd.result))); rd.readAsText(f); e.target.value = ''; });
document.querySelectorAll('input[name=onKind]').forEach(r => r.addEventListener('change', () => doAct(['kind', r.value])));
document.querySelectorAll('input[name=onMode]').forEach(r => r.addEventListener('change', () => doAct(['mode', r.value])));
document.querySelectorAll('input[name=onGames]').forEach(r => r.addEventListener('change', () => doAct(['games', r.value])));
$('onCpuLv').addEventListener('change', e => doAct(['cpulv', e.target.value]));
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
// ---------- partida rápida: fila (Realtime Presence) ----------
// quem procura entra no canal 'fila-v1' com a modalidade; juntou gente suficiente (4 na dupla, 2 na simples), o primeiro
// da fila cria a sala e avisa os outros pelo canal; eles entram sozinhos e o anfitrião distribui os lugares e começa.
// Na dupla, depois de 30 s com pelo menos 2 na fila, completa com CPU.
const QQ = { on: false, mode: 'dupla', id: '', client: null, ch: null, at: 0, leading: false, auto: null, t: 0 };
const qStatus = t => { const e = $('onQStatus'); e.textContent = t || ''; e.hidden = !t; };
function queueUi() { $('onQueue').hidden = QQ.on; ['onQMode', 'onQCat', 'onQPick', 'onQRk', 'onQCpu'].forEach(id => { $(id).disabled = QQ.on; }); $('onQCancel').hidden = !QQ.on; }
// escolhas da fila: categoria (masculino/feminino/misto), personagem (da categoria) e raquete; ficam salvas no aparelho
let QPREF = { cat: 'masc', pick: '', rk: '', cpu: false }; try { Object.assign(QPREF, JSON.parse(localStorage.getItem('pdo-fila') || '{}')); } catch (e) {}
function qFill() {
  const cat = $('onQCat').value, okCat = c => cat === 'misto' || !!c.fem === (cat === 'fem'), list = byOvr().filter(okCat);
  // personagens das carreiras salvas na nuvem da sua conta (valor 'cr:<id>'), no topo da lista
  const ccs = (CL.sess ? QCC.list : []).filter(o => okCat(o.c)).map(o => ({ v: 'cr:' + o.id, c: o.c }));
  const sel = list.some(c => c.id === QPREF.pick) || ccs.some(o => o.v === QPREF.pick) ? QPREF.pick : (ccs[0] && ccs[0].v) || (list.find(c => c.id === S.settings.pick.me) || list[0] || {}).id || '';
  $('onQPick').innerHTML = ccs.map(o => '<option value="' + o.v + '">★ ' + overall(o.c.a) + ' · ' + (o.c.canhoto ? 'L' : 'R') + ' · ' + esc(o.c.name) + ' (sua carreira' + (cat === 'misto' ? ' · ' + (o.c.fem ? 'fem' : 'masc') : '') + ')</option>').join('') + list.map(c => '<option value="' + c.id + '">' + overall(c.a) + ' · ' + (c.canhoto ? 'L' : 'R') + ' · ' + esc(nameOf(c)) + ' (' + c.pais + (cat === 'misto' ? ' · ' + (c.fem ? 'fem' : 'masc') : '') + ')</option>').join('');
  $('onQPick').value = sel; // a escolha salva continua valendo (a lista da nuvem pode chegar depois)
  const rs = $('onQRk'); if (!rs.options.length) rs.innerHTML = '<option value="">A do personagem</option>' + Object.entries(RACKET_STATS).filter(([k]) => k !== 'assinatura').map(([k, r]) => '<option value="' + k + '">' + esc(r.nome) + ' (' + rkSummary(k) + ')</option>').join('');
  rs.value = QPREF.rk || '';
}
// carreiras da nuvem (só com a conta conectada); baixadas ao abrir o online
const QCC = { list: [], busy: false };
async function qLoadCloud() {
  if (!CL.sess) { QCC.list = []; return; }
  if (QCC.busy) return; QCC.busy = true;
  try { QCC.list = await clCareerChars(); } catch (e) { QCC.list = []; }
  QCC.busy = false; if (!QQ.on) qFill();
}
function qSave() { QPREF = { cat: $('onQCat').value, pick: $('onQPick').value, rk: $('onQRk').value, cpu: $('onQCpu').checked }; try { localStorage.setItem('pdo-fila', JSON.stringify(QPREF)); } catch (e) {} }
async function queueStart() {
  if (QQ.on || NET.role) return;
  qSave(); if (!QPREF.pick) return;
  // personagem da carreira: vai para a sala pelo mesmo caminho do "Usar" da sala (o anfitrião confere os valores)
  QQ.cc = QPREF.pick.startsWith('cr:') ? (QCC.list.find(o => 'cr:' + o.id === QPREF.pick) || {}).c || null : null;
  if (QPREF.pick.startsWith('cr:') && !QQ.cc) { qStatus('Não achei essa carreira na sua conta. Entre na conta (Carreira → Nuvem) e tente de novo.'); return; }
  if (!QQ.cc) S.settings.pick.me = QPREF.pick; // entra na sala com esse personagem
  QQ.cat = QPREF.cat; QQ.fem = !!(QQ.cc || charById(QPREF.pick) || {}).fem;
  QQ.on = true; QQ.mode = $('onQMode').value === 'simples' ? 'simples' : 'dupla'; QQ.id = 'q' + Math.random().toString(36).slice(2, 10); QQ.at = Date.now(); QQ.leading = false;
  queueUi(); qStatus('Conectando à fila…');
  try {
    const { RealtimeClient } = await import('@supabase/realtime-js');
    QQ.client = new RealtimeClient(SB_URL.replace(/^http/, 'ws') + '/realtime/v1', { params: { apikey: SB_KEY } });
    const ch = QQ.client.channel('fila-v1', { config: { presence: { key: QQ.id }, broadcast: { self: false } } });
    ch.on('presence', { event: 'sync' }, () => queueSync());
    ch.on('broadcast', { event: 'go' }, ({ payload }) => { if (QQ.on && payload && Array.isArray(payload.ids) && payload.ids.includes(QQ.id) && payload.code) queueGo(payload.code); });
    QQ.ch = ch;
    await new Promise((res, rej) => { const to = setTimeout(() => rej(new Error('tempo esgotado')), 9000); ch.subscribe(st => { if (st === 'SUBSCRIBED') { clearTimeout(to); res(); } else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { clearTimeout(to); rej(new Error(st)); } }); });
    await ch.track({ mode: QQ.mode, cat: QQ.cat, fem: QQ.fem, cpu: !!QPREF.cpu, at: QQ.at, name: myName() });
    clearInterval(QQ.t); QQ.t = setInterval(queueSync, 2000); // o tempo de espera conta mesmo sem mudança na fila
  } catch (e) { queueStop(); qStatus('Fila indisponível agora (sem conexão com o servidor). Crie uma sala ou entre pelo código.'); }
}
function queueStop(keepMsg) {
  QQ.on = false; clearInterval(QQ.t);
  try { if (QQ.ch) QQ.ch.untrack(); } catch (e) {}
  setTimeout(() => { try { if (QQ.client) QQ.client.disconnect(); } catch (e) {} QQ.client = null; QQ.ch = null; }, 600);
  queueUi(); if (!keepMsg) qStatus('');
}
function queueSync() {
  if (!QQ.on || !QQ.ch || QQ.leading) return;
  const st = QQ.ch.presenceState(), need = QQ.mode === 'simples' ? 2 : 4;
  const list = Object.entries(st).map(([k, a]) => Object.assign({ k }, a[a.length - 1])).filter(x => x && x.mode === QQ.mode && (x.cat || 'masc') === QQ.cat).sort((a, b) => (a.at - b.at) || (a.k < b.k ? -1 : 1));
  const waited = (Date.now() - (list[0] ? list[0].at : QQ.at)) / 1000;
  let group = null;
  if (QQ.cat === 'misto' && QQ.mode === 'dupla') { const M = list.filter(x => !x.fem), F = list.filter(x => x.fem); if (M.length >= 2 && F.length >= 2) group = M.slice(0, 2).concat(F.slice(0, 2)).sort((a, b) => a.at - b.at); } // mista: dois homens e duas mulheres
  else if (list.length >= need) group = list.slice(0, need);
  else if (QQ.mode === 'dupla' && waited >= 30) { const ok = list.filter(x => x.cpu); if (ok.length >= 2) group = ok.slice(0, 3); } // completa com CPU só entre quem aceitou
  const me = list.findIndex(x => x.k === QQ.id);
  const cnt = QQ.cat === 'misto' && QQ.mode === 'dupla' ? list.filter(x => !x.fem).length + ' homens e ' + list.filter(x => x.fem).length + ' mulheres na fila (precisa de 2 de cada)' : list.length + ' de ' + need + ' na fila';
  qStatus('Procurando partida (' + (QQ.mode === 'simples' ? 'simples' : 'dupla') + ' ' + { masc: 'masculina', fem: 'feminina', misto: 'mista' }[QQ.cat] + '): ' + cnt + (QQ.mode === 'dupla' && QPREF.cpu ? (list.filter(x => x.cpu).length >= 2 ? ' · completa com CPU em ' + Math.max(0, Math.ceil(30 - waited)) + ' s' : ' · com 2 ou mais que aceitam CPU, completa depois de 30 s') : QQ.mode === 'dupla' ? ' · só jogadores de verdade' : '') + '…');
  if (group && group[0].k === QQ.id && me >= 0) queueLead(group.map(x => x.k));
}
// o primeiro da fila cria a sala e chama os outros
async function queueLead(ids) {
  QQ.leading = true; qStatus('Partida encontrada! Criando a sala…');
  const pub = $('onPublic'); const pubWas = pub ? pub.checked : true; if (pub) pub.checked = false; // sala da fila não aparece na lista
  S.settings.mode = QQ.mode; await createRoom(); if (pub) pub.checked = pubWas;
  if (!ON.code || NET.role !== 'host') { QQ.leading = false; qStatus('Não consegui criar a sala; tentando de novo…'); return; }
  ON.room.mode = QQ.mode; if (QQ.cc) act('host', ['cchar', QQ.cc]); if (QPREF.rk) act('host', ['racket', QPREF.rk]); broadcast();
  QQ.auto = { n: ids.length, until: Date.now() + 25000, cat: QQ.cat };
  try { await QQ.ch.send({ type: 'broadcast', event: 'go', payload: { ids: ids.filter(i => i !== QQ.id), code: ON.code } }); } catch (e) {}
  queueStop(true); qStatus('');
}
function queueGo(code) {
  queueStop(true); qStatus('Partida encontrada! Entrando na sala ' + code + '…'); $('onCode').value = code; joinRoom();
  const cc = QQ.cc; // personagem da carreira e raquete escolhida, assim que entrar
  if (cc || QPREF.rk) { let n = 0; const iv = setInterval(() => { n++; if (NET.role === 'guest' && ON.L) { if (cc) send(['cchar', cc]); if (QPREF.rk) send(['racket', QPREF.rk]); clearInterval(iv); } else if (n > 40) clearInterval(iv); }, 500); }
}
// anfitrião da fila: senta todo mundo intercalando os times (CPU nos lugares vazios) e começa quando todos chegarem
function queueHostTick() {
  const room = ON.room, A = QQ.auto; if (!room || room.playing) { QQ.auto = null; return; }
  const here = members().filter(m => m === ON.self || m.open);
  if (here.length < A.n && Date.now() < A.until) { msg('Esperando os jogadores da fila: ' + here.length + ' de ' + A.n + '…', true); return; }
  const order = room.mode === 'simples' ? ['A1', 'B1'] : ['A1', 'B1', 'A2', 'B2'], chOf = m => (m.cc && m.pick === m.cc.id ? m.cc : charById(m.pick)), fem = m => !!(chOf(m) || {}).fem;
  // mista: homens primeiro (A1, B1) e mulheres depois (A2, B2) → cada time com um de cada
  const ppl = here.slice(0, order.length); if (A.cat === 'misto') ppl.sort((x, y) => fem(x) - fem(y));
  room.seats = { A1: null, A2: null, B1: null, B2: null }; ppl.forEach((m, i) => { room.seats[order[i]] = m === ON.self ? 'host' : m.id; });
  // CPU nos lugares vazios: da categoria (na mista, o oposto do parceiro) e perto do nível de quem está jogando
  const used = new Set(members().map(m => m.pick)), avg = ppl.reduce((t, m) => t + overall((chOf(m) || { a: {} }).a), 0) / Math.max(1, ppl.length);
  for (const st of order) { if (room.seats[st]) continue;
    const mate = room.seats[st[0] + (st[1] === '1' ? '2' : '1')], mm = mate && (mate === 'host' ? ON.self : guestById(mate));
    const wantF = A.cat === 'fem' ? true : A.cat === 'masc' ? false : mm ? !fem(mm) : st[1] === '2';
    const c = byOvr().filter(x => !!x.fem === wantF && !used.has(x.id)).sort((x, y) => Math.abs(overall(x.a) - avg) - Math.abs(overall(y.a) - avg))[0];
    if (c) { room.cpu[st] = c.id; used.add(c.id); } }
  fixCpu(); broadcast(); QQ.auto = null; msg('');
  setTimeout(() => { if (NET.role === 'host' && !ON.room.playing) hostPlay(); }, 1200);
}
if (typeof window !== 'undefined') window.__pdoQQ = { QQ, QCC, queueSync, qLoadCloud };
// teste: barra do saque montada como no convidado × como no anfitrião (mesmo sorteio do lançamento)
if (typeof window !== 'undefined') window.__pdoSrvMeter = (type, tf) => {
  const g = {}, td = tossDurOf(type, tf); human.tossDur = td.dur; human.tossMul = td.mul; startMeter('serve', type, { m: g, p: human, remote: false });
  const h = { out: [], m: {}, p: human, remote: true }; human.tossDur = tossDurOf(type, tf).dur; startMeter('serve', type, h);
  const ms = h.out[0]; MTR.active = false; el.meter.hidden = true;
  return { convidado: { centro: +g.center.toFixed(3), faixa: +g.half.toFixed(3), vel: g.fill }, anfitriao: { centro: +ms[3].toFixed(3), faixa: +ms[4].toFixed(3), vel: ms[9] } };
};
$('onQueue').addEventListener('click', queueStart);
$('onQCat').addEventListener('change', () => { qSave(); qFill(); qSave(); });
$('onQPick').addEventListener('change', qSave); $('onQRk').addEventListener('change', qSave);
$('onQCat').value = QPREF.cat || 'masc'; $('onQCpu').checked = !!QPREF.cpu; $('onQCpu').addEventListener('change', qSave); qFill();
$('onQCancel').addEventListener('click', () => queueStop());
// link com #sala=CÓDIGO: abre a tela do online com o código preenchido
{
  const m = /sala=([A-Za-z0-9]{5})/.exec(location.hash);
  if (m) { $('onCode').value = m[1].toUpperCase(); openOnline(); setTimeout(() => $('onJoin').focus(), 0); }
}
addEventListener('beforeunload', () => { if (NET.role === 'guest') send(['bye']); else if (NET.role === 'host') for (const g of ON.guests) sendTo(g.conn, ['bye']); });
// para testes no console
window.__pdoNet = { ON, NET };
export { ON, openOnline, joinRoom };
if (typeof window !== 'undefined') window.__pdoON = { ON, renderRoom: f => renderRoom(f), showPart: x => showPart(x), startChamp: () => startChamp() };
