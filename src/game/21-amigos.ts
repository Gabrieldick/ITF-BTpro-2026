// @ts-nocheck
// amigos e chat (precisa da conta na nuvem): nome de usuário único, lista de amigos com pedidos, conversa só do dia
// (o servidor esconde e apaga as de dias anteriores), convite para a sua sala do online e status
// (online / ausente depois de 3 min fora da página / não perturbe sem som / aparecer offline).
// Tabelas e regras de acesso: supabase/amigos.sql. O status vai por Realtime Presence (só o id da conta e o status).
import './20-online';
import { S, NET } from './01-estado';
import { $s } from '../state';
import { ac } from './08-audio';
import { CL, sbRest, clToken, SB_URL, SB_KEY } from './14-carreira';
import { $, el } from './09-interface';
import { inPlay } from './12-controles';
import { ON, openOnline, joinRoom } from './20-online';

const AM = {
  me: '', name: null, nameLoaded: false, setup: false, // setup: tabelas existem no servidor
  friends: [], // { id, name, st: 'pending-in' | 'pending-out' | 'ok' }
  msgs: {}, unread: {}, pres: {}, view: 'list', chat: null, open: false, err: '', note: '',
  act: {}, // o que cada amigo está fazendo: { act: 'sala' | 'carreira' | 'partida' | 'menu', room, pl (jogando) }
  rt: null, ch: null, mode: 'auto', away: false, awaySince: 0, tracked: '', lastLoad: 0,
};
try { AM.mode = localStorage.getItem('pdo-amigos-st') || 'auto'; } catch (e) {}
const ST_TXT = { on: 'Online', away: 'Ausente', dnd: 'Não perturbe', off: 'Offline' };
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uidOf = at => { try { return JSON.parse(atob(at.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub || ''; } catch (e) { return ''; } };
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const readKey = () => 'pdo-amigos-lido-' + AM.me + '-' + today();
let lastRead = {};
const loadRead = () => { try { lastRead = JSON.parse(localStorage.getItem(readKey()) || '{}'); } catch (e) { lastRead = {}; } };
const saveRead = () => { try { localStorage.setItem(readKey(), JSON.stringify(lastRead)); } catch (e) {} };
const errMsg = e => /relation .* does not exist|Could not find the table|schema cache/i.test(e.message) ? 'O servidor ainda não tem as tabelas de amigos (rode supabase/amigos.sql no Supabase).' : e.message;

// meu status para os amigos: escolhido (não perturbe / offline) ou automático (online, ausente após 3 min fora da página)
const myStatus = () => AM.mode === 'invis' ? 'off' : AM.mode === 'dnd' ? 'dnd' : AM.away ? 'away' : 'on';

// ---------- dados ----------
let loading = null;
function loadAll() { if (!loading) loading = loadAll0().finally(() => { loading = null; }); return loading; } // um carregamento por vez
async function loadAll0() {
  if (!CL.sess) return;
  const tk = await clToken(); if (!tk) return;
  const me = uidOf(tk); if (me !== AM.me) { AM.me = me; AM.name = null; AM.nameLoaded = false; AM.msgs = {}; AM.unread = {}; loadRead(); }
  AM.lastLoad = Date.now();
  try {
    const p = await sbRest('profiles?select=username&user_id=eq.' + me);
    AM.name = p && p[0] ? p[0].username : null; AM.nameLoaded = true; AM.setup = true; AM.err = '';
    const fr = await sbRest('friendships?select=requester,addressee,status') || [];
    const ids = [...new Set(fr.map(f => f.requester === me ? f.addressee : f.requester))];
    const names = ids.length ? await sbRest('profiles?select=user_id,username&user_id=in.(' + ids.join(',') + ')') || [] : [];
    const nm = Object.fromEntries(names.map(n => [n.user_id, n.username]));
    AM.friends = fr.map(f => { const id = f.requester === me ? f.addressee : f.requester; return { id, name: nm[id] || '?', st: f.status === 'accepted' ? 'ok' : f.requester === me ? 'pending-out' : 'pending-in' }; })
      .sort((a, b) => a.name.localeCompare(b.name));
    await sbRest('rpc/purge_old_messages', { method: 'POST', body: '{}' }).catch(() => {});
    const ms = await sbRest('messages?select=id,sender,recipient,kind,body,created_at&order=created_at.asc&limit=1000') || [];
    const keep = AM.msgs; AM.msgs = {}; AM.unread = {};
    ms.forEach(m => addMsg(m, false));
    const td = today(); Object.values(keep).flat().forEach(m => { if (new Date(m.created_at).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }) === td) addMsg(m, false); }); // o que chegou durante o carregamento (só de hoje)
    Object.values(AM.msgs).forEach(l => l.sort((a, b) => a.id - b.id));
  } catch (e) { AM.err = errMsg(e); if (/tabelas/.test(AM.err)) AM.setup = false; }
  connect(); render(); badge();
}
function addMsg(m, live) {
  const other = m.sender === AM.me ? m.recipient : m.sender;
  const l = AM.msgs[other] || (AM.msgs[other] = []);
  if (l.some(x => x.id === m.id)) return;
  l.push(m); if (l.length > 300) l.shift();
  const mine = m.sender === AM.me, seen = AM.open && AM.view === 'chat' && AM.chat === other && !document.hidden;
  if (!mine && !seen && (!lastRead[other] || m.created_at > lastRead[other])) AM.unread[other] = (AM.unread[other] || 0) + 1;
  if (seen) { lastRead[other] = m.created_at; saveRead(); }
  if (live && !mine) {
    if (myStatus() !== 'dnd') ping(m.kind === 'invite');
    if (!seen) toast(m);
  }
}

// ---------- tempo real: mensagens, pedidos e status ----------
async function connect() {
  if (!CL.sess || !AM.me || !AM.setup) return;
  const tk = await clToken(); if (!tk) return;
  if (AM.rt) { AM.rt.setAuth(tk); track(); return; }
  try {
    const { RealtimeClient } = await import('@supabase/realtime-js');
    const rt = new RealtimeClient(SB_URL.replace(/^http/, 'ws') + '/realtime/v1', { params: { apikey: SB_KEY } });
    AM.rt = rt; rt.setAuth(tk);
    const ch = rt.channel('amigos-v1', { config: { presence: { key: AM.me } } });
    ch.on('presence', { event: 'sync' }, () => {
      const st = ch.presenceState(); AM.pres = {};
      for (const [k, arr] of Object.entries(st)) { const last = arr[arr.length - 1]; if (last && last.st) { AM.pres[k] = last.st; AM.act[k] = last; } }
      render();
    });
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'recipient=eq.' + AM.me }, p => { addMsg(p.new, true); render(); badge(); });
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: 'addressee=eq.' + AM.me }, p => { if (p.eventType === 'INSERT' && myStatus() !== 'dnd') ping(false); refresh(); });
    ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'friendships', filter: 'requester=eq.' + AM.me }, () => refresh());
    AM.ch = ch;
    ch.subscribe(s => { if (s === 'SUBSCRIBED') { AM.tracked = ''; track(); } });
  } catch (e) { AM.rt = null; AM.ch = null; }
}
function disconnect() {
  if (AM.rt) { try { AM.rt.disconnect(); } catch (e) {} }
  AM.rt = null; AM.ch = null; AM.tracked = ''; AM.pres = {}; AM.act = {};
}
// o que eu estou fazendo (vai junto com o status; quem aparece offline não manda nada)
function myAct() {
  const pl = !!inPlay();
  if (NET.role && ON.code) return { act: 'sala', room: ON.code, pl };
  if (S.careerActive || ($s.CR && !$('career').hidden)) return { act: 'carreira', pl: pl && !!S.careerActive };
  return pl ? { act: 'partida', pl } : { act: 'menu' };
}
async function track() {
  if (!AM.ch) return;
  const st = myStatus(), info = st === 'off' ? null : Object.assign({ st }, myAct()), key = JSON.stringify(info);
  if (key === AM.tracked) return; AM.tracked = key;
  try { if (!info) await AM.ch.untrack(); else await AM.ch.track(info); } catch (e) { AM.tracked = ''; }
}
// "Online · na sala ABCDE (jogando)"
function actTxt(id) {
  const s = AM.pres[id] || 'off', a = AM.act[id]; if (s === 'off' || !a) return ST_TXT[s];
  const t = a.act === 'sala' ? 'na sala ' + esc(a.room || '') : a.act === 'carreira' ? 'na carreira' : a.act === 'partida' ? 'numa partida' : 'no menu';
  return ST_TXT[s] + ' · ' + t + (a.pl && a.act !== 'partida' ? ' (jogando)' : '');
}
let refreshT = 0;
function refresh() { clearTimeout(refreshT); refreshT = setTimeout(loadAll, 400); }

// ausente: mais de 3 minutos fora da página (outra aba, janela minimizada ou sem foco)
setInterval(() => {
  const out = document.hidden || !document.hasFocus();
  if (out) { if (!AM.awaySince) AM.awaySince = Date.now(); } else AM.awaySince = 0;
  const away = !!AM.awaySince && Date.now() - AM.awaySince > 180000;
  if (away !== AM.away) { AM.away = away; render(); }
  track(); // status e atividade (só manda se mudou)
  // sessão mudou (entrou/saiu da conta) ou passou o dia
  const logged = !!CL.sess;
  if (!logged && AM.me) { AM.me = ''; AM.friends = []; AM.msgs = {}; AM.unread = {}; disconnect(); render(); badge(); }
  else if (logged && (!AM.me || Date.now() - AM.lastLoad > 10 * 60000)) loadAll(); // renova o token do tempo real e os dados
  syncBtn();
}, 3000);
addEventListener('focus', () => { if (AM.awaySince) { AM.awaySince = 0; if (AM.away) { AM.away = false; track(); render(); } } });

// ---------- som e aviso ----------
function ping(invite) {
  const a = ac(); if (!a) return; const t = a.currentTime;
  (invite ? [660, 880, 990] : [880, 1320]).forEach((f, i) => {
    const o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t + i * .09); g.gain.linearRampToValueAtTime(.12, t + i * .09 + .01); g.gain.exponentialRampToValueAtTime(.001, t + i * .09 + .22);
    o.connect(g); g.connect(a.destination); o.start(t + i * .09); o.stop(t + i * .09 + .25);
  });
}
function toast(m) {
  if (myStatus() === 'dnd') return;
  const f = AM.friends.find(x => x.id === m.sender), box = $('amToast');
  box.innerHTML = '<b>' + esc(f ? f.name : 'Amigo') + '</b> ' + (m.kind === 'invite' ? 'te convidou para a sala ' + esc(m.body) : esc(m.body.slice(0, 80)));
  box.hidden = false; box.onclick = () => { box.hidden = true; openPanel(m.sender); };
  clearTimeout(box._t); box._t = setTimeout(() => { box.hidden = true; }, 6000);
}

// ---------- ações ----------
async function saveName(v) {
  const u = (v || '').trim().toLowerCase();
  if (!/^[a-z0-9_.]{3,16}$/.test(u)) { AM.note = 'Use de 3 a 16 caracteres: letras sem acento, números, _ ou ponto.'; render(); return; }
  try {
    if (AM.name) await sbRest('profiles?user_id=eq.' + AM.me, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ username: u }) });
    else await sbRest('profiles', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: AM.me, username: u }) });
    AM.name = u; AM.note = 'Nome salvo.'; AM.editName = false;
    if (!ON.name || ON.name === 'Jogador') ON.name = u;
  } catch (e) { AM.note = /duplicate|unique/i.test(e.message) ? 'Esse nome já está em uso. Escolha outro.' : errMsg(e); }
  render();
}
async function addFriend(v) {
  const u = (v || '').trim().toLowerCase().replace(/^@/, '');
  if (!u) return;
  if (u === AM.name) { AM.note = 'Esse é você.'; render(); return; }
  try {
    const p = await sbRest('profiles?select=user_id,username&username=eq.' + encodeURIComponent(u));
    if (!p || !p[0]) { AM.note = 'Ninguém com o nome "' + u + '".'; render(); return; }
    const id = p[0].user_id, ex = AM.friends.find(f => f.id === id);
    if (ex && ex.st === 'pending-in') return accept(id);
    if (ex) { AM.note = ex.st === 'ok' ? 'Vocês já são amigos.' : 'Pedido já enviado.'; render(); return; }
    await sbRest('friendships', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ addressee: id }) });
    AM.note = 'Pedido enviado para ' + u + '.'; await loadAll();
  } catch (e) { AM.note = /duplicate|unique/i.test(e.message) ? 'Já existe um pedido entre vocês.' : errMsg(e); render(); }
}
async function accept(id) {
  try { await sbRest('friendships?requester=eq.' + id + '&addressee=eq.' + AM.me, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'accepted' }) }); AM.note = ''; await loadAll(); }
  catch (e) { AM.note = errMsg(e); render(); }
}
async function unfriend(id) {
  try { await sbRest('friendships?or=(and(requester.eq.' + id + ',addressee.eq.' + AM.me + '),and(requester.eq.' + AM.me + ',addressee.eq.' + id + '))', { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    if (AM.chat === id) { AM.view = 'list'; AM.chat = null; } await loadAll(); }
  catch (e) { AM.note = errMsg(e); render(); }
}
async function send(to, body, kind = 'msg') {
  body = (body || '').trim().slice(0, 500); if (!body) return false;
  try {
    const r = await sbRest('messages', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ recipient: to, body, kind }) });
    if (r && r[0]) addMsg(r[0], false); else refresh();
    render(); return true;
  } catch (e) { AM.note = /row-level|policy/i.test(e.message) ? 'Só dá para mandar mensagem para amigos.' : errMsg(e); render(); return false; }
}
// sala do amigo em que dá para entrar (ele não está offline e eu não estou nela)
const fRoom = id => { const a = AM.act[id]; return AM.pres[id] && AM.pres[id] !== 'off' && a && a.act === 'sala' && a.room && a.room !== ON.code ? a.room : ''; };
const myRoom = () => NET.role && ON.code ? ON.code : '';
function joinInvite(code) {
  if (NET.role) { AM.note = ON.code === code ? 'Você já está nessa sala.' : 'Saia da sala atual antes de entrar em outra.'; render(); return; }
  if (inPlay() || (el.menu.hidden && $('online').hidden && $('career').hidden)) { AM.note = 'Termine ou saia da partida para entrar na sala.'; render(); return; }
  closePanel(); $('career').hidden = true;
  openOnline(); $('onCode').value = code; joinRoom();
}

// ---------- tela ----------
const dot = id => { const s = AM.pres[id] || 'off'; return '<i class="am-dot ' + s + '" title="' + ST_TXT[s] + '"></i>'; };
const hhmm = t => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
function render() {
  const box = $('amBody'); if (!box || !AM.open) return;
  let h = '';
  if (!CL.sess) {
    h = '<p class="am-note">Entre na sua conta para ter amigos, conversar e mandar convites para a sua sala.</p><button type="button" class="cta" data-am="acct">Entrar na conta</button>';
  } else if (AM.err && !AM.setup) {
    h = '<p class="am-note">' + esc(AM.err) + '</p><button type="button" class="ghost sm" data-am="retry">Tentar de novo</button>';
  } else if (!AM.nameLoaded) {
    h = '<p class="am-note">Carregando…</p>';
  } else if (!AM.name || AM.editName) {
    h = '<div class="am-sec"><b>' + (AM.name ? 'Trocar nome de usuário' : 'Escolha seu nome de usuário') + '</b><p class="am-note">É como seus amigos te acham. Único entre todas as contas: 3 a 16 caracteres (letras, números, _ ou ponto).</p>'
      + '<div class="am-row"><input id="amName" type="text" maxlength="16" placeholder="ex.: gabriel_bt" value="' + esc(AM.name || '') + '" autocomplete="off"><button type="button" class="cta sm" data-am="name">Salvar</button></div>'
      + (AM.name ? '<button type="button" class="ghost sm" data-am="cancelname">Cancelar</button>' : '') + '</div>';
  } else if (AM.view === 'chat' && AM.chat) {
    const f = AM.friends.find(x => x.id === AM.chat) || { name: '?' }, l = AM.msgs[AM.chat] || [], room = myRoom();
    h = '<div class="am-chathead"><button type="button" class="ghost sm" data-am="back">‹ Amigos</button>' + dot(AM.chat) + '<b>' + esc(f.name) + '</b><span class="am-sub">' + actTxt(AM.chat) + '</span></div>' + (fRoom(AM.chat) ? '<button type="button" class="cta sm" data-am="join" data-code="' + esc(fRoom(AM.chat)) + '">Entrar na sala ' + esc(fRoom(AM.chat)) + '</button>' : '')
      + '<div class="am-msgs" id="amMsgs">' + (l.length ? l.map(m => {
        const mine = m.sender === AM.me;
        if (m.kind === 'invite') return '<div class="am-msg inv ' + (mine ? 'me' : '') + '"><span>' + (mine ? 'Você convidou para a sala ' : 'Convite para a sala ') + '<b>' + esc(m.body) + '</b></span>' + (mine ? '' : '<button type="button" class="cta sm" data-am="join" data-code="' + esc(m.body) + '">Entrar</button>') + '<small>' + hhmm(m.created_at) + '</small></div>';
        return '<div class="am-msg ' + (mine ? 'me' : '') + '"><span>' + esc(m.body) + '</span><small>' + hhmm(m.created_at) + '</small></div>';
      }).join('') : '<p class="am-note">Nenhuma mensagem hoje. As conversas somem no dia seguinte.</p>') + '</div>'
      + '<div class="am-row"><input id="amText" type="text" maxlength="500" placeholder="Mensagem" autocomplete="off"><button type="button" class="cta sm" data-am="send">Enviar</button></div>'
      + (room ? '<button type="button" class="ghost sm" data-am="invite">🎾 Convidar para a sala ' + room + '</button>' : '');
  } else {
    const inc = AM.friends.filter(f => f.st === 'pending-in'), out = AM.friends.filter(f => f.st === 'pending-out'), ok = AM.friends.filter(f => f.st === 'ok'), room = myRoom();
    const order = { on: 0, dnd: 1, away: 2, off: 3 };
    ok.sort((a, b) => (order[AM.pres[a.id] || 'off'] - order[AM.pres[b.id] || 'off']) || a.name.localeCompare(b.name));
    h = '<div class="am-me"><span>Você: <b>@' + esc(AM.name) + '</b></span><button type="button" class="ghost xs" data-am="editname">trocar</button>'
      + '<select id="amSt"><option value="auto">🟢 Online (ausente após 3 min fora)</option><option value="dnd">⛔ Não perturbe (sem som)</option><option value="invis">⚪ Aparecer offline</option></select></div>'
      + '<div class="am-row"><input id="amAdd" type="text" maxlength="17" placeholder="Adicionar amigo pelo nome de usuário" autocomplete="off"><button type="button" class="cta sm" data-am="add">Adicionar</button></div>'
      + (inc.length ? '<div class="am-sec"><b>Pedidos de amizade</b>' + inc.map(f => '<div class="am-fr"><span>@' + esc(f.name) + '</span><span class="am-act"><button type="button" class="cta xs" data-am="accept" data-id="' + f.id + '">Aceitar</button><button type="button" class="ghost xs" data-am="decline" data-id="' + f.id + '">Recusar</button></span></div>').join('') + '</div>' : '')
      + '<div class="am-sec"><b>Amigos (' + ok.length + ')</b>' + (ok.length ? ok.map(f => {
        const n = AM.unread[f.id] || 0;
        return '<div class="am-fr" data-am="chat" data-id="' + f.id + '">' + dot(f.id) + '<span class="am-nm">@' + esc(f.name) + '<small>' + actTxt(f.id) + '</small></span>'
          + (n ? '<em class="am-badge">' + n + '</em>' : '') + '<span class="am-act">'
          + (fRoom(f.id) ? '<button type="button" class="cta xs" data-am="join" data-code="' + esc(fRoom(f.id)) + '" title="Entrar na sala ' + esc(fRoom(f.id)) + '">Entrar</button>' : '')
          + (room ? '<button type="button" class="ghost xs" data-am="invite1" data-id="' + f.id + '" title="Convidar para a sala ' + room + '">🎾</button>' : '')
          + '<button type="button" class="ghost xs" data-am="remove" data-id="' + f.id + '" title="Desfazer amizade">✕</button></span></div>';
      }).join('') : '<p class="am-note">Ainda sem amigos. Adicione pelo nome de usuário.</p>') + '</div>'
      + (out.length ? '<div class="am-sec"><b>Pedidos enviados</b>' + out.map(f => '<div class="am-fr"><span>@' + esc(f.name) + ' <small>aguardando</small></span><span class="am-act"><button type="button" class="ghost xs" data-am="decline" data-id="' + f.id + '">Cancelar</button></span></div>').join('') + '</div>' : '');
  }
  if (AM.note) h += '<p class="am-note am-flash">' + esc(AM.note) + '</p>';
  box.innerHTML = h;
  const st = $('amSt'); if (st) { st.value = AM.mode; st.onchange = () => { AM.mode = st.value; try { localStorage.setItem('pdo-amigos-st', AM.mode); } catch (e) {} track(); render(); }; }
  const ms = $('amMsgs'); if (ms) ms.scrollTop = ms.scrollHeight;
  const enter = (id, act) => { const i = $(id); if (i) i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); act(); } }; };
  enter('amName', () => saveName($('amName').value));
  enter('amAdd', () => addFriend($('amAdd').value));
  enter('amText', () => sendText());
  if (AM.view === 'chat' && AM.chat) { const n = AM.unread[AM.chat]; const l = AM.msgs[AM.chat] || []; if (n || l.length) { AM.unread[AM.chat] = 0; if (l.length) { lastRead[AM.chat] = l[l.length - 1].created_at; saveRead(); } badge(); } }
}
async function sendText() { const i = $('amText'); if (!i) return; const v = i.value; i.value = ''; if (!(await send(AM.chat, v))) i.value = v; const j = $('amText'); if (j) j.focus(); }
function badge() {
  const n = Object.values(AM.unread).reduce((t, v) => t + v, 0) + AM.friends.filter(f => f.st === 'pending-in').length;
  const b = $('amBadge'); if (b) { b.textContent = n > 9 ? '9+' : String(n); b.hidden = !n && !(CL.sess && AM.nameLoaded && !AM.name && AM.setup); if (!n && !b.hidden) b.textContent = '!'; }
}
// o botão aparece nos menus (na partida, só o aviso de mensagem nova)
function syncBtn() {
  const b = $('amBtn'); if (!b) return;
  const show = !inPlay() || S.paused;
  b.hidden = !show; if (!show && AM.open) closePanel();
}
function openPanel(chat) {
  AM.open = true; $('amPanel').hidden = false; AM.note = '';
  if (chat) { AM.view = 'chat'; AM.chat = chat; }
  render(); if (CL.sess && (!AM.nameLoaded || Date.now() - AM.lastLoad > 60000)) loadAll();
}
function closePanel() { AM.open = false; $('amPanel').hidden = true; }

// monta os elementos (botão flutuante, painel e aviso)
{
  const wrap = document.createElement('div');
  wrap.innerHTML = '<button type="button" id="amBtn" class="am-btn" title="Amigos e chat">👥 Amigos<em id="amBadge" class="am-badge" hidden></em></button>'
    + '<aside id="amPanel" class="am-panel card" hidden><div class="am-head"><div class="eyebrow">Amigos e chat</div><button type="button" class="ghost xs" id="amClose" aria-label="Fechar">✕</button></div><div id="amBody" class="am-body"></div></aside>'
    + '<div id="amToast" class="am-toast" hidden></div>';
  document.body.append(...wrap.children);
  $('amBtn').addEventListener('click', () => AM.open ? closePanel() : openPanel());
  $('amClose').addEventListener('click', closePanel);
  $('amBody').addEventListener('click', e => {
    const t = e.target.closest('[data-am]'); if (!t) return;
    const a = t.dataset.am, id = t.dataset.id;
    if (e.target.closest('.am-act') && a === 'chat') return;
    AM.note = '';
    if (a === 'acct') { closePanel(); $('btnAcct').click(); }
    else if (a === 'retry') loadAll();
    else if (a === 'name') saveName($('amName').value);
    else if (a === 'editname') { AM.editName = true; render(); }
    else if (a === 'cancelname') { AM.editName = false; render(); }
    else if (a === 'add') addFriend($('amAdd').value);
    else if (a === 'accept') accept(id);
    else if (a === 'decline') unfriend(id);
    else if (a === 'remove') { if (confirm('Desfazer a amizade?')) unfriend(id); }
    else if (a === 'chat') { AM.view = 'chat'; AM.chat = id; render(); setTimeout(() => { const i = $('amText'); if (i) i.focus(); }, 0); }
    else if (a === 'back') { AM.view = 'list'; AM.chat = null; render(); }
    else if (a === 'send') sendText();
    else if (a === 'invite' && myRoom()) send(AM.chat, myRoom(), 'invite');
    else if (a === 'invite1' && myRoom()) send(id, myRoom(), 'invite').then(ok => { if (ok) { AM.note = 'Convite enviado.'; render(); } });
    else if (a === 'join') joinInvite(t.dataset.code);
  });
  syncBtn(); badge();
  if (CL.sess) loadAll();
}
// para testes no console
window.__pdoAM = { AM, loadAll, render, openPanel };
