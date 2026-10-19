// @ts-nocheck
// telas do modo carreira
import './14-carreira';
import { $s } from '../state';
import { ATTRS, GEAR, PLAY_STYLES, RACKET_STATS, STAFF, clamp, heightOf, nameOf, overall, racketBonus, shortOf } from './00-base';
import { S } from './01-estado';
import { RACKETS } from './05-atletas';
import { ac } from './08-audio';
import { $, el, feedback, hideBanner, newMatch } from './09-interface';
import { applyCam, readMenu, saveSettings, setPaused, syncMenu, toggleCam, togglePause, toggleSound } from './12-controles';
import { HAIRS, SEASON_WEEKS, SKINS, TIERS, careerMatchEnded, crCap, crChar, crCharOvr, crCoach, crCreate, crEnter, crGearBonus, crHire, crLessonIncome, crMaxTier, crMeOvr, crMigrate, crMyMatch, crNRounds, crNextWeek, crPlayMatch, crPlaySim, crPts, crRank, crRanking, crResolveEvent, crRest, crRoundNames, crSetPartner, crSyncChars, crTeamName, crTeamOvr, crTierUnlocked, crTrain, crUpCost, crUpgrade, crWeekOptions, crWillPartner, crWorld, crXpMul, saveCareer, crSlots, crLoadSlot, crCloseSlot, crDeleteSlot, crExportData, crImportData, crRepoSaves, crImportUrl, SAVE_REPO, SAVE_DIR, crSaveErr , INVEST, crInv, crInvBuy, crFamaTarget } from './14-carreira';
import { playStyleOf } from './16-ia';
import { COUNTRIES, flagSVG } from '../flags';
// ---------- telas ----------
let crTab = 'agenda';
const money = v => '$' + Math.round(v).toLocaleString('pt-BR');
function openCareer() { readMenu(); el.menu.hidden = true; $('career').hidden = false; document.body.classList.add('in-menu'); if ($s.CR) { crMigrate(); crSyncChars(); } renderCareer(); }
function renderCareer() {
  $('crNew').hidden = !!$s.CR; $('crHub').hidden = !$s.CR; $('crSaves').hidden = !!$s.CR;
  $('crExport').hidden = $('crSwitch').hidden = !$s.CR;
  if (!$s.CR) { renderSaves(); renderCrNew(); return; }
  const meO = overall($s.CR.me.a), inGame = crMeOvr(), rank = crRank(), pts = crPts();
  $('crHead').innerHTML = '<div class="cr-id"><div class="ovr">' + meO + '<small>OVR</small></div><div><b>' + esc($s.CR.me.name) + '</b><span>' + $s.CR.age + ' anos · ' + $s.CR.me.estilo + ' · potencial ' + $s.CR.pot + ' · em jogo ' + inGame + ' · fama ' + Math.round($s.CR.fama || 0) + '</span></div></div>'
    + '<div class="cr-kpis"><div><b>' + rank + 'º</b>ranking (' + pts + ' pts)</div><div><b>' + money($s.CR.money) + '</b>dinheiro</div><div><b>' + $s.CR.pe + '</b>pontos de evolução</div><div><b>T' + $s.CR.season + ' · S' + $s.CR.week + '</b>de ' + SEASON_WEEKS + ' semanas</div></div>'
    + '<div class="cr-energy"><span>Energia</span><span class="bar"><i class="' + ($s.CR.energy < 40 ? 'lo' : $s.CR.energy > 75 ? 'hi' : '') + '" style="width:' + $s.CR.energy + '%"></i></span><b>' + $s.CR.energy + '</b></div>';
  document.querySelectorAll('#crTabs button').forEach(b => b.classList.toggle('sel', b.dataset.t === crTab));
  const busy = $s.CR.tour && !$s.CR.tour.done;
  $('crTabs').hidden = !!$s.CR.tour;
  const crm = crSaveErr() || $s.CR.lastMsg || ''; $('crMsg').textContent = crm; $('crMsg').hidden = !crm;
  const body = $('crBody');
  if ($s.CR.tour) { body.innerHTML = crTourHTML(); bindTour(); return; }
  body.innerHTML = ({ agenda: crAgendaHTML, jogador: crPlayerHTML, parceiros: crPartnersHTML, loja: crShopHTML, patrocinio: crSponsorHTML, ranking: crRankingHTML, historico: crHistoryHTML, negocios: crBizHTML }[crTab])();
  bindCareerBody();
}
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
function crAgendaHTML() {
  if ($s.CR.event) return '<div class="cr-card gold"><div class="eyebrow">Evento da semana</div><b>' + esc($s.CR.event.text) + '</b><div class="cta-row" style="margin-top:6px">' + $s.CR.event.opts.map((o, i) => '<button class="' + (i ? 'ghost' : 'cta') + ' sm" data-ev="' + i + '">' + esc(o) + '</button>').join('') + '</div></div>';
  const opts = crWeekOptions(), p = $s.CR.partner ? crChar($s.CR.partner) : null;
  const ladder = TIERS.map((T, i) => '<span class="' + (crTierUnlocked(i) || (i === 9 && $s.CR.week === SEASON_WEEKS && crRank() <= 16) ? 'on' : '') + ($s.CR.titles[i] ? ' won' : '') + '" title="' + esc(T.nome) + (i && i < 9 ? ' · libera com ' + T.req + ' pts ou título no nível abaixo' : i === 9 ? ' · última semana, top 16' : '') + '">' + T.curto + ($s.CR.titles[i] ? ' 🏆' + $s.CR.titles[i] : '') + '</span>').join('');
  return '<div class="cr-ladder">' + ladder + '</div>'
    + '<p class="cr-note">Parceiro: <b>' + (p ? esc(nameOf(p)) + ' (' + crCharOvr(p) + ')' : 'nenhum — um parceiro de ocasião será escolhido na inscrição') + '</b>' + (p ? ' · entrosamento ' + '★'.repeat($s.CR.chem) + '☆'.repeat(5 - $s.CR.chem) : '') + '</p>'
    + '<div class="cr-cards">' + opts.map((o, i) => { const T = TIERS[o.tier]; const cost = (o.wild ? 0 : T.fee) + T.travel; return '<div class="cr-card' + (o.tier === 9 ? ' gold' : '') + '"><div class="eyebrow">' + T.nome + ' · chave de ' + T.draw + '</div><b>' + esc(o.name) + '</b><span>Adversários OVR ' + T.ovr[0] + '–' + T.ovr[1] + '</span><span>Campeão: ' + money(T.prize[0]) + ' · ' + T.pts[0] + ' pts</span><span>Custo: ' + money(cost) + (T.travel ? ' (inscrição ' + money(T.fee) + ' + viagem ' + money(T.travel) + ')' : '') + '</span><button class="cta sm" data-enter="' + i + '"' + ($s.CR.money < cost ? ' disabled' : '') + '>Inscrever</button></div>'; }).join('')
    + '<div class="cr-card"><div class="eyebrow">Semana de treino</div><b>Treinar</b><span>+' + Math.round(4 * crXpMul()) + ' pontos de evolução · −15 energia</span><span>Custo: ' + money(80 * (crMaxTier() + 1)) + '</span><button class="ghost sm" id="crTrain">Treinar</button></div>'
    + '<div class="cr-card"><div class="eyebrow">Renda extra</div><b>Dar aulas</b><span>+' + money(crLessonIncome()) + ' · −5 energia · sem evolução</span><span>Rende mais conforme você sobe de nível.</span><button class="ghost sm" id="crCoach">Dar aulas</button></div>'
    + '<div class="cr-card"><div class="eyebrow">Semana livre</div><b>Descansar</b><span>+45 de energia. Jogador cansado rende menos.</span><button class="ghost sm" id="crRest">Descansar</button></div></div>';
}
function crPlayerHTML() {
  const gear = crGearBonus(), rk = racketBonus($s.CR.racket);
  const rows = ATTRS.map(([k, lbl]) => { const v = $s.CR.me.a[k], c = crUpCost(v, k), extra = (gear[k] || 0) + (rk[k] || 0); return '<span>' + lbl + '</span><span class="bar"><i class="' + (v >= 85 ? 'hi' : v <= 60 ? 'lo' : '') + '" style="width:' + v + '%"></i></span><b>' + v + (extra ? '<em class="' + (extra > 0 ? 'up' : 'dn') + '">' + (extra > 0 ? '+' : '') + extra + '</em>' : '') + '</b><button class="arw" data-up="' + k + '"' + ($s.CR.pe < c || v >= crCap() ? ' disabled' : '') + ' title="Custa ' + c + ' ponto(s)">+' + c + '</button>'; }).join('');
  const log = $s.CR.ovrLog.filter((x, i, a) => i === 0 || x.o !== a[i - 1].o).slice(-12).map(x => 'T' + x.s + 'S' + x.w + ': ' + x.o).join(' → ');
  return '<div class="cr-two"><div><p class="section-label">Atributos (gaste pontos de evolução)</p><div class="bars cr-bars">' + rows + '</div><p class="cr-note">Limite pelo potencial: ' + crCap() + '. Em verde/vermelho: efeito da raquete e dos equipamentos.</p></div>'
    + '<div><p class="section-label">Evolução do overall</p><p class="cr-note">' + log + '</p><p class="section-label">Títulos</p><p class="cr-note">' + (Object.keys($s.CR.titles).length ? Object.entries($s.CR.titles).map(([t, n]) => TIERS[t].curto + ' ×' + n).join(' · ') : 'Nenhum ainda.') + '</p>'
    + '<p class="section-label">Partidas</p><fieldset class="seg"><div class="pills"><input type="radio" name="crGames" id="crG4" value="4"' + ($s.CR.games === 4 ? ' checked' : '') + '><label for="crG4">Set curto · 4 games</label><input type="radio" name="crGames" id="crG6" value="6"' + ($s.CR.games === 6 ? ' checked' : '') + '><label for="crG6">Set · 6 games</label></div></fieldset>'
    + '<p class="section-label">Nacionalidade</p><label class="cr-field"><span class="cr-nat">' + flagSVG($s.CR.me.pais) + '<select id="crMeNat">' + COUNTRIES.map(c => '<option value="' + c.code + '"' + (c.code === $s.CR.me.pais ? ' selected' : '') + '>' + c.nome + '</option>').join('') + '</select></span></label>'
    + '<div class="cta-row" style="margin-top:10px"><button class="ghost sm" id="crReset">Apagar carreira</button></div></div></div>';
}
function crPersonRow(c, extra, btn) {
  return '<div class="cr-row"><span class="ovr sm">' + crCharOvr(c) + '</span><div><b>' + flagSVG(c.pais) + ' ' + esc(nameOf(c)) + '</b><small>' + c.pais + ' · ' + (c.id === 'crme' ? c.estilo : 'joga ' + PLAY_STYLES[playStyleOf(c)].nome.toLowerCase()) + ' · ' + Math.round(heightOf(c) * 100) + ' cm' + (c.canhoto ? ' · canhoto' : '') + (extra ? ' · ' + extra : '') + '</small></div>' + (btn || '') + '</div>';
}
function crPartnersHTML() {
  const cur = $s.CR.partner ? crChar($s.CR.partner) : null;
  const myO = crMeOvr();
  // primeiro quem aceita (do mais forte ao mais fraco), depois os mais próximos que ainda não aceitam
  const all = crWorld().filter(c => c.id !== $s.CR.partner).map(c => ({ c, o: crCharOvr(c), w: crWillPartner(c) })).filter(x => x.o >= myO - 15 && x.o <= myO + 22);
  const list = all.filter(x => x.w.ok).sort((x, y) => y.o - x.o).slice(0, 36).concat(all.filter(x => !x.w.ok).sort((x, y) => x.o - y.o).slice(0, 10));
  const offers = $s.CR.offers.map(crChar).filter(Boolean);
  return '<p class="section-label">Seu parceiro</p>' + (cur ? crPersonRow(cur, 'entrosamento ' + $s.CR.chem + '/5', '<button class="ghost sm" data-drop="1">Desfazer dupla</button>') : '<p class="cr-note">Sem parceiro fixo.</p>')
    + (offers.length ? '<p class="section-label">Convites (de quem você venceu)</p>' + offers.map(c => crPersonRow(c, 'quer jogar com você', '<button class="cta sm" data-partner="' + c.id + '">Aceitar</button>')).join('') : '')
    + '<p class="section-label">Mercado de parceiros</p><p class="cr-note">Quem aceita depende do seu overall, dos seus pontos no ranking e de você já ter vencido o jogador. Quem está muito acima no ranking só joga com você depois de perder para você. Entrosamento sobe a cada torneio juntos.</p>'
    + '<div class="cr-list">' + list.map(x => crPersonRow(x.c, x.w.why + ' · ' + Math.round($s.CR.npc[x.c.id] || 0) + ' pts', x.w.ok ? '<button class="ghost sm" data-partner="' + x.c.id + '">Formar dupla</button>' : '<span class="cr-lock">🔒</span>')).join('') + '</div>';
}
function crShopHTML() {
  const disc = $s.CR.discount || 0;
  const rk = Object.entries(RACKET_STATS).sort((x, y) => x[1].preco - y[1].preco).map(([k, r]) => {
    const own = $s.CR.rackets.includes(k), eq = $s.CR.racket === k, price = Math.round(r.preco * (1 - disc));
    const bonus = Object.entries(r.b).map(([a, v]) => '<em class="' + (v > 0 ? 'up' : 'dn') + '">' + (v > 0 ? '+' : '') + v + ' ' + ATTRS.find(x => x[0] === a)[1] + '</em>').join(' ');
    return '<div class="cr-row' + (eq ? ' me' : '') + '"><span class="cr-rk" data-r="' + k + '"></span><div><b>' + r.nome + (eq ? ' · em uso' : '') + '</b><small>' + r.desc + '</small><small>' + bonus + '</small></div>' + (eq ? '' : own ? '<button class="ghost sm" data-equip="' + k + '">Usar</button>' : '<button class="cta sm" data-buy="' + k + '"' + ($s.CR.money < price ? ' disabled' : '') + '>' + money(price) + '</button>') + '</div>';
  }).join('');
  const gr = GEAR.map(g => {
    const own = $s.CR.gear.includes(g.id);
    const bonus = Object.entries(g.b).map(([a, v]) => '<em class="up">+' + v + ' ' + ATTRS.find(x => x[0] === a)[1] + '</em>').join(' ');
    return '<div class="cr-row"><span class="cr-ic">🎒</span><div><b>' + g.nome + '</b><small>' + g.desc + '</small><small>' + bonus + '</small></div>' + (own ? '<span class="cr-own">comprado</span>' : '<button class="cta sm" data-gear="' + g.id + '"' + ($s.CR.money < g.preco ? ' disabled' : '') + '>' + money(g.preco) + '</button>') + '</div>';
  }).join('');
  const st = STAFF.map(x => {
    const own = !!$s.CR.staff[x.id];
    return '<div class="cr-row' + (own ? ' me' : '') + '"><span class="cr-ic">' + (x.head ? '🧢' : '👤') + '</span><div><b>' + x.nome + '</b><small>' + x.desc + (x.head ? ' Só um técnico principal por vez.' : '') + '</small></div>' + (own ? '<span class="cr-own">contratado</span>' : '<button class="cta sm" data-hire="' + x.id + '"' + ($s.CR.money < x.preco ? ' disabled' : '') + '>' + money(x.preco) + '</button>') + '</div>';
  }).join('');
  return (disc ? '<p class="cr-msg">Promoção ativa: ' + Math.round(disc * 100) + '% de desconto na próxima raquete.</p>' : '')
    + '<div class="cr-two"><div><p class="section-label">Raquetes (' + Object.keys(RACKET_STATS).length + ')</p><div class="cr-list">' + rk + '</div></div>'
    + '<div><p class="section-label">Equipe técnica (contrato até o fim da temporada)</p><div class="cr-list" style="max-height:260px">' + st + '</div><p class="section-label" style="margin-top:10px">Equipamentos</p><div class="cr-list" style="max-height:220px">' + gr + '</div></div></div>';
}
function crBizHTML() {
  const tracks = Object.entries(INVEST).map(([k, tr]) => {
    const lv = crInv(k);
    const rows = tr.niveis.map((n, i) => {
      const done = i < lv, next = i === lv, why = next ? n.req() : '';
      const btn = done ? '<span class="cr-own">feito</span>' : next ? (why ? '<span class="cr-lock" title="' + esc(why) + '">🔒</span>' : '<button class="cta sm" data-inv="' + k + '"' + ($s.CR.money < n.preco ? ' disabled' : '') + '>' + money(n.preco) + '</button>') : '<span class="cr-lock">🔒</span>';
      return '<div class="cr-row' + (done ? ' me' : '') + '"><span class="cr-ic">' + tr.ic + '</span><div><b>' + n.nome + '</b><small>' + n.desc + '</small>' + (next && why ? '<small><em class="dn">' + esc(why) + '</em></small>' : '') + (!done && !next ? '<small>Liberado depois do nível anterior · ' + money(n.preco) + '</small>' : '') + '</div>' + btn + '</div>';
    }).join('');
    return '<p class="section-label">' + tr.nome + ' · nível ' + lv + '/' + tr.niveis.length + '</p><div class="cr-list">' + rows + '</div>';
  }).join('');
  return '<p class="cr-note">Investimentos permanentes (não acabam no fim da temporada). Cada nível exige o anterior e conquistas na carreira.</p>' + tracks;
}
function crSponsorHTML() {
  const act = $s.CR.sponsors.map(x => '<div class="cr-row me"><span class="cr-ic">🤝</span><div><b>' + esc(x.brand) + '</b><small>' + money(x.weekly) + ' por semana · bônus de ' + money(x.bonus) + ' por título · faltam ' + x.left + ' semanas</small></div></div>').join('');
  const off = $s.CR.spOffers.map((x, i) => '<div class="cr-row"><span class="cr-ic">✉️</span><div><b>' + esc(x.brand) + '</b><small>' + money(x.weekly) + ' por semana durante ' + x.weeks + ' semanas · bônus de ' + money(x.bonus) + ' por título</small></div><div class="cta-row"><button class="cta sm" data-sp-ok="' + i + '"' + ($s.CR.sponsors.length >= 2 ? ' disabled title="Máximo de 2 patrocinadores"' : '') + '>Assinar</button><button class="ghost sm" data-sp-no="' + i + '">Recusar</button></div></div>').join('');
  return '<div class="cr-energy"><span>Fama</span><span class="bar"><i class="hi" style="width:' + Math.round($s.CR.fama) + '%"></i></span><b>' + Math.round($s.CR.fama) + '</b></div>'
    + '<p class="cr-note">A fama acompanha a sua posição no ranking e o peso dos seus títulos: hoje o seu nível sustenta <b>' + Math.round(crFamaTarget()) + '</b> de fama. Títulos e eventos (TV, redes, exibições) dão picos, mas ela volta aos poucos para esse valor. Quanto mais fama e mais alto o seu nível, melhores as propostas. Até 2 patrocinadores ao mesmo tempo (camisa e boné).</p>'
    + '<p class="section-label">Contratos ativos</p>' + (act || '<p class="cr-note">Nenhum ainda.</p>')
    + '<p class="section-label">Propostas</p>' + (off || '<p class="cr-note">Nenhuma proposta no momento. Vença torneios e apareça para atrair marcas.</p>');
}
function crRankingHTML() {
  const r = crRanking(), me = r.findIndex(x => x.id === 'crme');
  const show = r.slice(0, 30); if (me >= 30) show.push(...r.slice(Math.max(30, me - 2), me + 3));
  return '<p class="section-label">Ranking ' + ($s.CR.me.fem ? 'feminino' : 'masculino') + ' (pontos das últimas ' + SEASON_WEEKS + ' semanas)</p><div class="cr-list">' + show.map(x => { const i = r.indexOf(x), c = crChar(x.id); return '<div class="cr-row' + (x.id === 'crme' ? ' me' : '') + '"><span class="cr-pos">' + (i + 1) + '</span><div><b>' + flagSVG(c.pais) + ' ' + esc(nameOf(c)) + '</b><small>' + c.pais + ' · OVR ' + crCharOvr(c) + '</small></div><b class="cr-pts">' + x.pts + '</b></div>'; }).join('') + '</div>';
}
function crHistoryHTML() {
  return '<p class="section-label">Últimos torneios</p><div class="cr-list">' + ($s.CR.history.length ? $s.CR.history.map(h => '<div class="cr-row"><span class="cr-pos">T' + h.s + '<br>S' + h.w + '</span><div><b>' + esc(h.name) + '</b><small>' + h.tier + ' · ' + h.place + (h.partner ? ' · com ' + esc(h.partner) : '') + '</small></div><b class="cr-pts">' + money(h.prize) + '<br>' + h.pts + ' pts</b></div>').join('') : '<p class="cr-note">Nenhum torneio ainda.</p>') + '</div>';
}
function crTourHTML() {
  const t = $s.CR.tour, T = TIERS[t.tier], names = crRoundNames(crNRounds());
  const br = '<div class="bracket-wrap"><div class="bracket" style="grid-template-columns:repeat(' + crNRounds() + ',minmax(150px,1fr));min-width:' + (crNRounds() * 170) + 'px">' + names.map((nm, r) => {
    const rd = t.rounds[r] || [];
    return '<div class="rd"><h4>' + nm + '</h4>' + (rd.length ? rd.map(m => {
      const row = i => { if (i < 0) return '<div class="tm l">—<b></b></div>'; const tm = t.teams[i]; const cls = (m.w === null ? '' : m.w === i ? 'w' : 'l') + (i === t.me ? ' me' : ''); return '<div class="tm ' + cls + '">' + crTeamName(tm) + '<b>' + crTeamOvr(tm) + '</b></div>'; };
      return '<div class="m' + (m.a === t.me || m.b === t.me ? ' mine' : '') + '">' + row(m.a) + row(m.b) + (m.score ? '<div class="tm"><b>' + m.score + '</b></div>' : '') + '</div>';
    }).join('') : '<div class="m"><div class="tm l">a definir</div></div>') + '</div>';
  }).join('') + '</div></div>';
  const mm = crMyMatch();
  let msg = '';
  if (t.done && t.summary) {
    const s = t.summary;
    msg = '<div class="cr-sum"><b class="champion">' + (s.place === 0 ? '🏆 Campeões do ' + esc(t.name) + '!' : s.placeName) + '</b><span>Prêmio ' + money(s.prize) + (t.sponsorBonus ? ' + bônus de patrocínio ' + money(t.sponsorBonus) : '') + ' · +' + s.pts + ' pts de ranking · +' + s.xp + ' pontos de evolução</span>'
      + (s.offers.length ? '<span>Convites para formar dupla: ' + s.offers.map(id => esc(nameOf(crChar(id)))).join(', ') + ' (veja em Parceiros)</span>' : '') + '<span class="cr-note">' + t.log.map(esc).join(' · ') + '</span></div>';
  } else if (mm) {
    const opp = t.teams[mm.a === t.me ? mm.b : mm.a];
    const sty = id => PLAY_STYLES[playStyleOf(crChar(id))].nome.toLowerCase();
    msg = '<p class="lede">' + names[t.round] + ': vocês contra <b>' + crTeamName(opp) + '</b> (OVR ' + crTeamOvr(opp) + '): ' + esc(shortOf(crChar(opp.a))) + ' é ' + sty(opp.a) + ', ' + esc(shortOf(crChar(opp.b))) + ' é ' + sty(opp.b) + '. Sua dupla: OVR ' + crTeamOvr(t.teams[t.me]) + '.</p>';
  }
  return '<div class="eyebrow">' + T.nome + ' · ' + esc(t.name) + '</div>' + br + msg
    + '<div class="cta-row">' + (t.done ? '<button class="cta" id="crDone">Continuar</button>' : mm ? '<button class="cta" id="crPlay">Jogar partida</button><button class="ghost" id="crSim">Simular partida</button>' : '') + '</div>';
}
function bindTour() {
  const b = id => $(id) && $(id).addEventListener('click', fn[id]);
  const fn = {
    crPlay: () => crPlayMatch(),
    crSim: () => { crPlaySim(); renderCareer(); },
    crDone: () => { crNextWeek(); crTab = 'agenda'; renderCareer(); },
  };
  ['crPlay', 'crSim', 'crDone'].forEach(b);
}
function bindCareerBody() {
  const body = $('crBody');
  body.querySelectorAll('[data-enter]').forEach(bt => bt.addEventListener('click', () => { const o = crWeekOptions()[+bt.dataset.enter]; if (o && crEnter(o)) crSyncChars(); renderCareer(); }));
  const tr = $('crTrain'); if (tr) tr.addEventListener('click', () => { crTrain(); renderCareer(); });
  const rs = $('crRest'); if (rs) rs.addEventListener('click', () => { crRest(); renderCareer(); });
  const co = $('crCoach'); if (co) co.addEventListener('click', () => { crCoach(); renderCareer(); });
  body.querySelectorAll('[data-up]').forEach(bt => bt.addEventListener('click', () => { crUpgrade(bt.dataset.up); renderCareer(); }));
  body.querySelectorAll('[data-partner]').forEach(bt => bt.addEventListener('click', () => { crSetPartner(bt.dataset.partner); $s.CR.lastMsg = 'Nova dupla: ' + nameOf(crChar(bt.dataset.partner)) + '.'; renderCareer(); }));
  body.querySelectorAll('[data-drop]').forEach(bt => bt.addEventListener('click', () => { $s.CR.partner = null; $s.CR.chem = 0; saveCareer(); renderCareer(); }));
  body.querySelectorAll('[data-buy]').forEach(bt => bt.addEventListener('click', () => { const k = bt.dataset.buy, r = RACKET_STATS[k], price = Math.round(r.preco * (1 - ($s.CR.discount || 0))); if ($s.CR.money >= price) { $s.CR.money -= price; $s.CR.discount = 0; $s.CR.rackets.push(k); $s.CR.racket = k; $s.CR.me.look.racket = k; $s.CR.lastMsg = 'Comprou a ' + r.nome + '.'; saveCareer(); } renderCareer(); }));
  body.querySelectorAll('[data-inv]').forEach(bt => bt.addEventListener('click', () => { crInvBuy(bt.dataset.inv); renderCareer(); }));
  body.querySelectorAll('[data-hire]').forEach(bt => bt.addEventListener('click', () => { crHire(bt.dataset.hire); renderCareer(); }));
  body.querySelectorAll('[data-ev]').forEach(bt => bt.addEventListener('click', () => { crResolveEvent(+bt.dataset.ev); renderCareer(); }));
  body.querySelectorAll('[data-sp-ok]').forEach(bt => bt.addEventListener('click', () => { const o = $s.CR.spOffers.splice(+bt.dataset.spOk, 1)[0]; if (o && $s.CR.sponsors.length < 2) { $s.CR.sponsors.push(Object.assign(o, { left: o.weeks })); $s.CR.lastMsg = 'Contrato assinado com ' + o.brand + '.'; } saveCareer(); renderCareer(); }));
  body.querySelectorAll('[data-sp-no]').forEach(bt => bt.addEventListener('click', () => { $s.CR.spOffers.splice(+bt.dataset.spNo, 1); saveCareer(); renderCareer(); }));
  body.querySelectorAll('[data-equip]').forEach(bt => bt.addEventListener('click', () => { $s.CR.racket = bt.dataset.equip; $s.CR.me.look.racket = $s.CR.racket; saveCareer(); renderCareer(); }));
  body.querySelectorAll('[data-gear]').forEach(bt => bt.addEventListener('click', () => { const g = GEAR.find(x => x.id === bt.dataset.gear); if ($s.CR.money >= g.preco) { $s.CR.money -= g.preco; if (g.staff) $s.CR.staff[g.id] = true; else $s.CR.gear.push(g.id); $s.CR.lastMsg = 'Comprou: ' + g.nome + '.'; crSyncChars(); saveCareer(); } renderCareer(); }));
  body.querySelectorAll('input[name=crGames]').forEach(r => r.addEventListener('change', () => { $s.CR.games = +r.value; saveCareer(); }));
  const mn = $('crMeNat'); if (mn) mn.addEventListener('change', () => { $s.CR.me.pais = mn.value; crSyncChars(); saveCareer(); renderCareer(); });
  const rst = $('crReset'); if (rst) rst.addEventListener('click', () => { if (rst.dataset.sure) { $s.CR = null; saveCareer(); crSyncChars(); renderCareer(); } else { rst.dataset.sure = '1'; rst.textContent = 'Clique de novo para confirmar'; } });
  body.querySelectorAll('.cr-rk').forEach(sp => { const r = RACKETS[sp.dataset.r]; if (r) sp.style.background = r.edge; });
}
// ---------- saves ----------
function crDownload(id) {
  const d = crExportData(id); if (!d) return;
  const url = URL.createObjectURL(new Blob([d.text], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = d.file; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return d.file;
}
function crSaveMsg(t) { const m = $('crSaveMsg'); m.textContent = t || ''; m.hidden = !t; }
const fmtDate = iso => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : ' · salvo ' + d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
function renderSaves() {
  const list = crSlots();
  $('crSlotList').innerHTML = list.length ? list.map(c => '<div class="cr-slot"><div class="who"><b>' + esc(c.name) + ' · OVR ' + c.ovr + '</b><span>T' + c.season + ' S' + c.week + ' · ' + c.tier + ' · ' + money(c.money) + fmtDate(c.savedAt) + '</span></div>'
    + '<div class="acts"><button class="cta sm" data-slot-load="' + esc(c.id) + '">Continuar</button><button class="ghost sm" data-slot-exp="' + esc(c.id) + '">Exportar</button><button class="ghost sm" data-slot-del="' + esc(c.id) + '">Apagar</button></div></div>').join('')
    : '<span class="cr-lbl">Nenhuma carreira salva neste navegador ainda. Crie uma abaixo ou importe um save.</span>';
  const L = $('crSlotList');
  L.querySelectorAll('[data-slot-load]').forEach(b => b.addEventListener('click', () => { if (crLoadSlot(b.dataset.slotLoad)) { crTab = 'agenda'; crSaveMsg(''); renderCareer(); } }));
  L.querySelectorAll('[data-slot-exp]').forEach(b => b.addEventListener('click', () => { const fn = crDownload(b.dataset.slotExp); if (fn) crSaveMsg('Baixado: ' + fn + '. Para abrir em outro lugar, coloque o arquivo na pasta ' + SAVE_DIR + '/ do repositório e use "Carregar do GitHub", ou use "Importar arquivo".'); }));
  L.querySelectorAll('[data-slot-del]').forEach(b => b.addEventListener('click', () => { if (b.dataset.sure) { crDeleteSlot(b.dataset.slotDel); crSaveMsg('Carreira apagada deste navegador.'); renderCareer(); } else { b.dataset.sure = '1'; b.textContent = 'Confirmar'; } }));
}
function crAfterImport(r) {
  crSaveMsg(r.msg);
  if (r.ok && crLoadSlot(r.id)) { crTab = 'agenda'; $s.CR.lastMsg = r.msg; crSaveMsg(''); }
  renderCareer();
}
$('crFile').addEventListener('change', e => {
  const file = e.target.files && e.target.files[0]; e.target.value = '';
  if (!file) return;
  file.text().then(t => crAfterImport(crImportData(t)), () => crSaveMsg('Não consegui ler o arquivo.'));
});
$('crRepo').addEventListener('click', async () => {
  const box = $('crRepoList'); box.hidden = false; box.innerHTML = '<span class="cr-lbl">Procurando saves em github.com/' + SAVE_REPO + '/' + SAVE_DIR + ' …</span>';
  try {
    const files = await crRepoSaves();
    box.innerHTML = files.length ? files.map((f, i) => '<div class="cr-slot"><div class="who"><b>' + esc(f.name) + '</b><span>pasta ' + SAVE_DIR + '/ do repositório</span></div><div class="acts"><button class="cta sm" data-repo="' + i + '">Carregar</button></div></div>').join('')
      : '<span class="cr-lbl">Nenhum save na pasta ' + SAVE_DIR + '/ do repositório ainda.</span>';
    box.querySelectorAll('[data-repo]').forEach(b => b.addEventListener('click', async () => { b.disabled = true; try { crAfterImport(await crImportUrl(files[+b.dataset.repo].url)); } catch (err) { crSaveMsg('Falha ao baixar: ' + err.message); b.disabled = false; } }));
  } catch (err) { box.innerHTML = '<span class="cr-lbl">Não consegui acessar o GitHub (' + esc(err.message) + '). Sem internet? Use "Importar arquivo".</span>'; }
});
$('crExport').addEventListener('click', () => { saveCareer(); const fn = crDownload(); if (fn) { $s.CR.lastMsg = 'Save baixado: ' + fn + '. Coloque na pasta ' + SAVE_DIR + '/ do repositório e faça o push para abrir em outro lugar.'; renderCareer(); } });
$('crSwitch').addEventListener('click', () => { saveCareer(); crCloseSlot(); crSaveMsg(''); renderCareer(); });
// criação
const crForm = { fem: false, style: 'completo', perfil: 'promessa', skin: SKINS[2], hair: HAIRS[1], acc: 'cap', canhoto: false, alt: 182 };
function renderCrNew() {
  const sw = (arr, key) => arr.map(c => '<button type="button" class="cr-sw' + (crForm[key] === c ? ' sel' : '') + '" data-' + key + '="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>').join('');
  $('crSw').innerHTML = '<div><span class="cr-lbl">Pele</span>' + sw(SKINS, 'skin') + '</div><div><span class="cr-lbl">Cabelo</span>' + sw(HAIRS, 'hair') + '</div>';
  $('crSw').querySelectorAll('[data-skin]').forEach(b => b.addEventListener('click', () => { crForm.skin = b.dataset.skin; renderCrNew(); }));
  $('crSw').querySelectorAll('[data-hair]').forEach(b => b.addEventListener('click', () => { crForm.hair = b.dataset.hair; renderCrNew(); }));
  $('crAltV').textContent = crForm.alt + ' cm';
}
function crStart() {
  const v = n => { const i = document.querySelector('input[name=' + n + ']:checked'); return i ? i.value : null; };
  crForm.fem = v('crGen') === 'f'; crForm.style = v('crStyle') || 'completo'; crForm.perfil = v('crPerfil') || 'promessa'; crForm.acc = v('crAcc') || 'cap'; crForm.canhoto = v('crHand') === 'c';
  crCreate({ pais: $('crNat').value || 'BRA', name: ($('crName').value || '').trim() || 'Promessa', fem: crForm.fem, alt: crForm.alt, style: crForm.style, perfil: crForm.perfil, skin: crForm.skin, hair: crForm.hair, acc: crForm.acc, canhoto: crForm.canhoto, glasses: Math.random() < .5 });
  crTab = 'agenda'; $s.CR.lastMsg = 'Bem-vindo ao circuito! Comece pelo Amador C, ache um parceiro e suba no ranking.'; saveCareer(); renderCareer();
}
$('btnCareer').addEventListener('click', openCareer);
$('crBack').addEventListener('click', () => { $('career').hidden = true; toMenu(); });
$('crCreate').addEventListener('click', crStart);
$('crNat').innerHTML = COUNTRIES.map(c => '<option value="' + c.code + '"' + (c.code === 'BRA' ? ' selected' : '') + '>' + c.nome + '</option>').join('');
const natFlag = () => { $('crNatFlag').innerHTML = flagSVG($('crNat').value); };
$('crNat').addEventListener('change', natFlag); natFlag();
$('crAlt').addEventListener('input', e => { crForm.alt = +e.target.value; $('crAltV').textContent = crForm.alt + ' cm'; });
document.querySelectorAll('input[name=crGen]').forEach(r => r.addEventListener('change', () => { const f = r.value === 'f'; crForm.alt = f ? 168 : 182; $('crAlt').value = crForm.alt; $('crAltV').textContent = crForm.alt + ' cm'; }));
document.querySelectorAll('#crTabs button').forEach(b => b.addEventListener('click', () => { crTab = b.dataset.t; $s.CR.lastMsg = ''; renderCareer(); }));
$('btnOverCareer').addEventListener('click', () => { el.over.hidden = true; openCareer(); });
if ($s.CR) { crMigrate(); crSyncChars(); }
// lista de raquetes do menu principal
function rkInfo() {
  const r = RACKET_STATS[$('rkSel').value]; if (!r) return;
  $('rkInfo').innerHTML = esc(r.desc) + ' ' + Object.entries(r.b).map(([a, v]) => '<em class="' + (v > 0 ? 'up' : 'dn') + '">' + (v > 0 ? '+' : '') + v + ' ' + ATTRS.find(x => x[0] === a)[1] + '</em>').join(' ');
}
$('rkSel').innerHTML = Object.entries(RACKET_STATS).sort((x, y) => x[1].preco - y[1].preco).map(([k, r]) => '<option value="' + k + '">' + r.nome + '</option>').join('');
$('rkSel').addEventListener('change', () => { rkInfo(); readMenu(); });
function startFromMenu() { ac(); readMenu(); newMatch(); }
function toMenu() {
  if (S.careerActive) careerMatchEnded(false); // abandonar conta como derrota
  S.mode = 'menu'; S.paused = false; el.pause.hidden = true; el.over.hidden = true; el.menu.hidden = false;
  document.body.classList.add('in-menu'); hideBanner(); syncMenu();
}
$('btnPlay').addEventListener('click', startFromMenu);
$('btnResume').addEventListener('click', () => setPaused(false));
$('btnPauseCam').addEventListener('click', () => { toggleCam(); setPaused(false); });
$('btnAsMove').addEventListener('click', () => toggleAssist('assistMove'));
$('btnAsMark').addEventListener('click', () => toggleAssist('assistMark'));
function syncAssistButtons() {
  $('btnAsMove').textContent = 'Seguir a bola: ' + (S.settings.assistMove ? 'ligado' : 'desligado');
  $('btnAsMark').textContent = 'Onde a bola cai: ' + (S.settings.assistMark ? 'ligado' : 'desligado');
}
function adjustFov(d) {
  S.settings.fovFp = clamp((S.settings.fovFp || 72) + d, 55, 110); saveSettings(); applyCam();
  feedback('FOV ' + S.settings.fovFp + '°', S.settings.cam === '1p' ? '1ª PESSOA' : 'VALE NA 1ª PESSOA', null);
}
$('fovFp').addEventListener('input', e => { S.settings.fovFp = +e.target.value; $('fovFpV').textContent = e.target.value + '°'; saveSettings(); applyCam(); });
function toggleAssist(k) {
  S.settings[k] = !S.settings[k]; saveSettings(); syncAssistButtons();
  feedback('ASSISTÊNCIA', (k === 'assistMove' ? 'SEGUIR A BOLA ' : 'MARCADOR ') + (S.settings[k] ? 'LIGADO' : 'DESLIGADO'), null);
}
$('btnQuit').addEventListener('click', toMenu);
$('btnAgain').addEventListener('click', () => { ac(); newMatch(); });
$('btnMenu').addEventListener('click', toMenu);
el.btnCam.addEventListener('click', e => { toggleCam(); e.currentTarget.blur(); });
el.btnSnd.addEventListener('click', e => { toggleSound(); e.currentTarget.blur(); });
$('btnPause').addEventListener('click', e => { togglePause(); e.currentTarget.blur(); });

export { adjustFov, money, rkInfo, startFromMenu, syncAssistButtons, toMenu, toggleAssist };
