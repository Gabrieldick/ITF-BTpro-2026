// @ts-nocheck
// telas do modo carreira
import './14-carreira';
import { $s } from '../state';
import { SERVE_STYLES, GEAR_SLOTS, gearOn, GEAR_CAP, ATTRS, attrOf, GEAR, PLAY_STYLES, RACKET_STATS, STAFF, clamp, heightOf, nameOf, overall, racketBonus, shortOf, rkSummary, TOP_KINDS, BOT_KINDS, PATTERNS, OUTFIT_COLORS, ACCESS, FABRIC_NOME } from './00-base';
import { S, NET } from './01-estado';
import { RACKETS, SIG_PATTERNS, SIG_HOLES, makeRacket } from './05-atletas';
import { ac, applyGfx } from './08-audio';
import { BALL_STYLES, setBallStyle, applyPlayerStyle, applyRackets, assignCharacters, makePreview, makeServePreview } from './07-glb';
import * as THREE from 'three';
import { $, el, feedback, hideBanner, newMatch, startDrill, DRILL_LVL, DRILLS, simulateRest } from './09-interface';
import { renderBinds, applyCam, readMenu, saveSettings, setPaused, syncMenu, toggleCam, togglePause, toggleSound, applyMeterLook } from './12-controles';
import { crSigLv, crSigPts, crSigUp, SIG_LV_PTS, SIG_LV_COST, tieRank, crResLabel, crOverload, SIG_PTS, SIG_MAX, SIG_ATTRS, crSigB, crSigSet, crSigLook, crSigReady, crMasterCap, crMasterFree, crRacketOk, crMasterSign, crMasterTake, crMasterEnd, crPotBarHTML, crPairBoard, crSnapBase, ACH, crAchCheck, crTitlesN, crH2HP, crRivalP, crNemesis, crRivalsIn, crChem, crChemLv, CHEM_NOME, clRecover, clNewPassword, clFromLink, CL, clSignUp, clSignIn, clSignOut, clList, clPull, clRemove, clSyncAll, clFlush, clTime, clLocalTime, crGate, crBandTarget, crNatural, crEquipB, crSkipByes, crAutoDays, crSimTour, crUf, crStateSquad, crCatN, crMinCat, crCatPts, CAT_NAMES, crStartTarget, crPresetAttrs, crFormWord, crEnergyMod, crCanUp, DAY_NAMES, DAY_FULL, crDate, crDateTxt, crSeasonCal, crUpcoming, crNextDay, crRestUntil, crAvgRating, npcPts, RANK_BEST, crDay1Rounds, HAIRS, SEASON_WEEKS, SKINS, TIERS, careerMatchEnded, crCap, crChar, crCharOvr, crCoach, crCreate, crEnter, crGearBonus, crHire, crLessonIncome, crMaxTier, crMeOvr, crMigrate, crMyMatch, crNRounds, crNextWeek, crPlayMatch, crPlaySim, crPts, crRank, crRanking, crResolveEvent, crRest, crRoundNames, crSetPartner, crSyncChars, crTeamName, crTeamOvr, crTierUnlocked, crTrain, crUpCost, crUpgrade, crWeekOptions, crWillPartner, crWorld, crXpMul, saveCareer, crSlots, crLoadSlot, crCloseSlot, crDeleteSlot, crExportData, crImportData, crRepoSaves, crImportUrl, SAVE_REPO, SAVE_DIR, crSaveErr , INVEST, crInv, crInvBuy, crFamaTarget, STATE_INFO, crStateRanking, crDrillReward, crH2H, crRivalOf, STATES, crTourT, crTravel, LIFE, crLife, crLifeBuy, crGoalOptions, crPickGoal, crGoalDone, crMoodWord, crMoodBonus, crPartnerAct, crPeMax, crPairs, crAgeOf } from './14-carreira';
import { playStyleOf } from './16-ia';
import { COUNTRIES, flagSVG } from '../flags';
// ---------- telas ----------
let crTab = 'agenda';
// abas agrupadas: cada grupo tem as suas sub-abas (a primeira é a que abre)
const CR_GROUPS = { agenda: [['agenda', 'Semana'], ['calendario', 'Calendário']], jogador: [['jogador', 'Atributos'], ['parceiros', 'Dupla'], ['ajustes', 'Ajustes']], loja: [['loja', 'Loja']], ranking: [['ranking', 'Ranking']], patrocinio: [['patrocinio', 'Patrocínios']], negocios: [['negocios', 'Negócios']], historico: [['historico', 'Histórico'], ['trofeus', 'Troféus']] };
const crGroupOf = t => Object.keys(CR_GROUPS).find(g => CR_GROUPS[g].some(x => x[0] === t)) || 'agenda';
const money = v => '$' + Math.round(v).toLocaleString('pt-BR');
let crEntry = '';
document.querySelectorAll('[data-entry]').forEach(b => b.addEventListener('click', () => { crEntry = b.dataset.entry; renderCareer(); }));
function openCareer() {
  readMenu(); el.menu.hidden = true; $('career').hidden = false; document.body.classList.add('in-menu');
  // com conta: espera a sincronização ao abrir o jogo (puxa a versão da nuvem) antes de a carreira passar a salvar
  // o que a própria tela gera ao abrir (migração, opções da semana) não conta como jogar: a base é tirada depois do 1º desenho
  const go = () => { if ($s.CR) { crMigrate(); crSyncChars(); } if (CL.msg === 'Sincronizando com a nuvem…') CL.msg = ''; renderCareer(); if (!CL.based) { CL.based = true; crSnapBase(); } CL.crReady = true; };
  if (CL.sess && !CL.synced && CL.syncP) { CL.msg = 'Sincronizando com a nuvem…'; renderCareer(); CL.syncP.then(go, go); } else go();
}
let crFeedOpen = false, crPairsOpen = false;
// coluna do lado (tela larga) ou dois quadros que abrem e fecham (celular): duplas do circuito e feed com as notícias
const crWideQ = window.matchMedia ? window.matchMedia('(min-width: 1120px)') : { matches: true, addEventListener() {} }; // (o simulador de treino roda sem navegador)
function crSideLayout() { document.querySelector('.cr-card-main').classList.toggle('wide', !!$s.CR && crWideQ.matches); }
if (crWideQ.addEventListener) crWideQ.addEventListener('change', () => { crSideLayout(); if ($s.CR && !$('career').hidden) renderCrSide(); });
function renderCrSide() {
  crSideLayout();
  const wide = crWideQ.matches, side = $('crSide');
  const B = crPairBoard(10), N = $s.CR.news || [];
  const pairs = '<details class="cr-feed cr-pairs-box"' + (wide || crPairsOpen ? ' open' : '') + '><summary>🤝 Duplas do circuito</summary><table class="cr-pairs">' + B.map((t, i) => '<tr' + (t.me ? ' class="me"' : '') + '><td class="n">' + (i + 1) + '</td><td><b data-prof="' + (t.me ? t.b : t.a) + '">' + esc(t.name) + '</b><small>' + esc(t.ten) + '</small></td><td class="v">' + t.p + ' pts<small>OVR ' + t.o + '</small></td></tr>').join('') + '</table></details>';
  const feed = '<details class="cr-feed cr-news-box"' + (wide || crFeedOpen ? ' open' : '') + '><summary>📰 Feed do circuito' + (N.length ? ' (' + N.length + ')' : '') + '</summary><div class="cr-feed-list">' + (N.length ? N.map(n => { const s0 = Math.floor((n.w - 1) / SEASON_WEEKS) + 1, w0 = n.w - (s0 - 1) * SEASON_WEEKS; return '<div class="cr-tweet"><span class="ic">' + n.i + '</span><div><b>' + esc(n.h) + '</b> <small>T' + s0 + ' · sem ' + w0 + '</small><p>' + esc(n.t) + '</p></div></div>'; }).join('') : '<p class="cr-tweet">Sem notícias ainda: jogue uma semana.</p>') + '</div></details>';
  side.innerHTML = pairs + feed;
  side.querySelector('.cr-pairs-box').addEventListener('toggle', e => { if (!wide) crPairsOpen = e.target.open; });
  side.querySelector('.cr-news-box').addEventListener('toggle', e => { if (!wide) crFeedOpen = e.target.open; });
}
function renderCareer() {
  // sem carreira aberta: três abas (conta, carregar, criar)
  if (!$s.CR && !crEntry) crEntry = crSlots().length || CL.sess ? 'load' : 'new';
  $('crEntry').hidden = !!$s.CR;
  document.querySelectorAll('[data-entry]').forEach(b => b.classList.toggle('sel', b.dataset.entry === crEntry));
  $('crNew').hidden = !!$s.CR || crEntry !== 'new'; $('crHub').hidden = !$s.CR; $('crSaves').hidden = !!$s.CR || crEntry !== 'load'; $('crAccount').hidden = !!$s.CR || crEntry !== 'conta';
  $('crExport').hidden = $('crSwitch').hidden = $('crGuideBtn').hidden = !$s.CR;
  { const cb = $('crCloudBtn'); cb.hidden = !$s.CR; cb.textContent = CL.sess ? '☁️ Nuvem ✓' : '☁️ Nuvem'; }
  crSideLayout(); document.querySelector('.cr-card-main').classList.toggle('in-hub', !!$s.CR);
  if (!$s.CR) { renderSaves(); renderCrNew(); return; }
  const meO = overall($s.CR.me.a), inGame = crMeOvr(), rank = crRank(), pts = crPts();
  const st = $s.CR.stars || 3, em = crEnergyMod(), en = $s.CR.energy;
  $('crHead').innerHTML = '<div class="cr-strip">'
    + '<div class="cs-id"><div class="ovr">' + meO + '<small>OVR</small></div><div><b>' + esc($s.CR.me.name) + '</b><small>' + $s.CR.age + ' anos · ' + $s.CR.me.estilo + ' · pot. ' + crCap() + (inGame !== meO ? ' · em jogo ' + inGame : '') + ' · fama ' + Math.round($s.CR.fama || 0) + '</small></div></div>'
    + '<div class="cs-k"><b>' + rank + 'º</b><small>' + pts + ' pts</small></div>'
    + '<div class="cs-k"><b>' + money($s.CR.money) + '</b><small>dinheiro</small></div>'
    + '<div class="cs-k" title="Pontos de evolução (máx. ' + crPeMax() + ')"><b>' + Math.floor($s.CR.pe) + '</b><small>evolução</small></div>'
    + '<div class="cs-k"><b>' + crDateTxt($s.CR.season, $s.CR.week, $s.CR.day, true) + '</b><small>T' + $s.CR.season + ' · sem ' + $s.CR.week + '/' + SEASON_WEEKS + '</small></div>'
    + '<div class="cs-k cs-en" title="Energia' + (em ? ': ' + (em > 0 ? '+' : '−') + Math.abs(em) + ' nos atributos' : '') + '"><span class="bar"><i class="' + (en < 40 ? 'lo' : en > 75 ? 'hi' : '') + '" style="width:' + en + '%"></i></span><small>energia ' + en + (em ? ' <em class="' + (em > 0 ? 'hi' : 'lo') + '">' + (em > 0 ? '+' : '−') + Math.abs(em) + '</em>' : '') + '</small></div>'
    + '<div class="cs-k cr-stars cs-diff" title="Dificuldade da carreira (clique nas estrelas para mudar)"><small class="cs-lbl">Dificuldade</small><span class="cs-st">' + [1, 2, 3, 4, 5, 6].map(n => '<button type="button" class="' + (n <= st ? 'on' : '') + '" data-stars="' + n + '" title="' + ['Bem fácil', 'Fácil', 'Padrão', 'Difícil', 'Muito difícil', 'Lendário'][n - 1] + '">★</button>').join('') + '</span><small>' + ['Bem fácil', 'Fácil', 'Padrão', 'Difícil', 'Muito difícil', 'Lendário'][st - 1] + '</small></div>'
    + '</div>';
  renderCrSide();
  $('crHead').querySelectorAll('[data-stars]').forEach(b => b.addEventListener('click', () => { $s.CR.stars = +b.dataset.stars; saveCareer(); renderCareer(); }));
  const grp = crGroupOf(crTab), subs = CR_GROUPS[grp];
  document.querySelectorAll('#crTabs button').forEach(b => b.classList.toggle('sel', b.dataset.g === grp));
  const sub = $('crSub'); sub.hidden = subs.length < 2 || !!($s.CR.tour && !$s.CR.tour.pending);
  sub.innerHTML = subs.length < 2 ? '' : subs.map(([t, n]) => '<button type="button" data-t="' + t + '"' + (t === crTab ? ' class="sel"' : '') + '>' + n + '</button>').join('');
  sub.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => { crTab = b.dataset.t; $s.CR.lastMsg = ''; renderCareer(); }));
  const busy = $s.CR.tour && !$s.CR.tour.done;
  $('crTabs').hidden = !!($s.CR.tour && !$s.CR.tour.pending);
  const crm = crSaveErr() || $s.CR.lastMsg || ''; $('crMsg').textContent = crm; $('crMsg').hidden = !crm;
  const body = $('crBody');
  if ($s.CR.tour && !$s.CR.tour.pending) { body.innerHTML = crTourHTML(); bindTour(); return; }
  body.innerHTML = ({ agenda: crAgendaHTML, calendario: crCalendarHTML, jogador: crPlayerHTML, parceiros: crPartnersHTML, loja: crShopHTML, patrocinio: crSponsorHTML, ranking: crRankingHTML, historico: crHistoryHTML, negocios: crBizHTML, trofeus: crTrophyHTML, ajustes: crSettingsHTML }[crTab])();
  bindCareerBody();
  if (GD.i >= 0) guidePaint();
}
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
function crAgendaHTML() {
  if ($s.CR.event) return '<div class="cr-card gold"><div class="eyebrow">Evento da semana</div><b>' + esc($s.CR.event.text) + '</b><div class="cta-row" style="margin-top:6px">' + $s.CR.event.opts.map((o, i) => '<button class="' + (i ? 'ghost' : 'cta') + ' sm" data-ev="' + i + '">' + esc(o) + '</button>').join('') + '</div></div>';
  const opts = crWeekOptions(), p = $s.CR.partner ? crChar($s.CR.partner) : null;
  // arcos ativos dos eventos (duram semanas)
  const arcs = [(($s.CR.load || 0) > 4.5 ? '⚠️ Carga alta: risco de lesão (' + Math.round(crOverload() * 100) + '% por torneio). Descanse alguns dias.' : ''), ($s.CR.hurt > 0 ? '🩼 Jogando no sacrifício: −3 em tudo (' + $s.CR.hurt + ' sem.)' : ''), ($s.CR.slump > 0 ? '😞 Crise de confiança: −1 em tudo (' + $s.CR.slump + ' sem.)' : ''), ($s.CR.conf > 0 ? '🧠 Psicólogo: +1 em tudo (' + $s.CR.conf + ' sem.)' : ''),
    ($s.CR.coach > 0 ? '🧢 Técnico campeão: +30% evolução/potencial, −20% dos prêmios (' + $s.CR.coach + ' sem.)' : ''), ($s.CR.spBet ? '🎯 Desafio da ' + esc($s.CR.spBet.brand) + ': título em ' + $s.CR.spBet.weeks + ' sem. vale ' + money($s.CR.spBet.reward) : ''), ($s.CR.feud ? '🔥 Duelo com ' + esc($s.CR.feud.name) + ' (' + $s.CR.feud.weeks + ' sem.)' : '')].filter(Boolean);
  const arcC = arcs.length ? '<div class="cr-card"><div class="eyebrow">Em andamento</div>' + arcs.map(a => '<span>' + a + '</span>').join('') + '</div>' : '';
  const injC = $s.CR.injury ? '<div class="cr-card"><div class="eyebrow">Lesionado</div><b>' + esc($s.CR.injury.nome) + '</b><span>Faltam ' + $s.CR.injury.weeks + ' semana(s). Sem torneios nem treino pesado; descansar acelera a volta.' + ($s.CR.staff.fisio ? '' : ' Um fisioterapeuta (Loja) encurta lesões futuras.') + '</span></div>' : '';
  const goal = $s.CR.goal ? '<div class="cr-card' + (crGoalDone($s.CR.goal) ? ' gold' : '') + '"><div class="eyebrow">Meta da temporada</div><b>' + esc($s.CR.goal.txt) + '</b><span>' + (crGoalDone($s.CR.goal) ? 'Cumprida por enquanto ✔ — vale no fim da temporada' : 'Ainda não cumprida') + ' · prêmio ' + money($s.CR.goal.money) + ' e ' + $s.CR.goal.pe + ' pontos de evolução</span></div>'
    : '<div class="cr-card gold"><div class="eyebrow">Escolha a meta da temporada</div><span>Cumprida até o fim da temporada, dá dinheiro, evolução e fama.</span><div class="cta-row" style="margin-top:6px">' + crGoalOptions().map((o, i) => '<button class="ghost sm" data-goal="' + i + '" title="' + money(o.money) + ' · +' + o.pe + ' PE">' + esc(o.txt) + '</button>').join('') + '</div></div>';
  const ladder = TIERS.map((T, i) => '<span class="' + (crTierUnlocked(i) || (i === 9 && crRank() <= 16) ? 'on' : '') + ($s.CR.titles[i] ? ' won' : '') + '" title="' + esc(T.nome) + (i && i < 9 ? ' · libera com ' + T.req + ' pts ou título no nível abaixo' : i === 9 ? ' · semana 51, top 16' : '') + '">' + T.curto + ($s.CR.titles[i] ? ' 🏆' + $s.CR.titles[i] : '') + '</span>').join('');
  const reg = $s.CR.tour && $s.CR.tour.pending ? $s.CR.tour : null, d = $s.CR.day, wlog = $s.CR.wlog || {};
  // a semana: 7 dias, com o que foi feito em cada um e o torneio no fim de semana
  const regDays = reg ? (crTourT(reg).pro ? [6, 7] : [6]) : [];
  const week = DAY_NAMES.map((n, i) => { const k = i + 1, dt = crDate($s.CR.season, $s.CR.week, k);
    const what = wlog[k] || (regDays.includes(k) ? 'Torneio' : k === d ? 'Hoje' : '');
    return '<div class="cr-day' + (k === d ? ' today' : k < d ? ' past' : '') + (regDays.includes(k) ? ' tour' : '') + '"><b>' + n + '</b><small>' + dt.getDate() + '/' + (dt.getMonth() + 1) + '</small><span>' + esc(what) + '</span></div>'; }).join('');
  const T0 = TIERS[crMaxTier()];
  const acts = '<p class="section-label">Hoje · ' + DAY_FULL[d - 1] + '</p><div class="cr-cards">'
    + '<div class="cr-card cr-act act-fis">' + ACT_ART.fis + '<div class="eyebrow">Treino físico e técnico</div><b>Treinar</b><span>+' + (Math.round((.9 + (crInv('quadra') ? .6 : 0)) * crXpMul() * 10) / 10).toString().replace('.', ',') + ' ponto de evolução · −6 energia</span><span>Custo: ' + money(crInv('quadra') ? 0 : 20 * (crMaxTier() + 1)) + '</span><button class="ghost sm" id="crTrain"' + ($s.CR.injury ? ' disabled' : '') + '>Treinar hoje</button></div>'
    + '<div class="cr-card cr-act act-des">' + ACT_ART.des + '<div class="eyebrow">Treino com desafio</div><b>Treinar na quadra</b><span>Curtas, defesa, smash, saque ou combinados: evolução por acerto; cumprindo a meta, um pouco de potencial · −5 energia</span><button class="ghost sm" id="crDrill"' + ($s.CR.injury ? ' disabled' : '') + '>Escolher desafio</button></div>'
    + '<div class="cr-card cr-act act-aula">' + ACT_ART.aula + '<div class="eyebrow">Renda extra</div><b>Dar aulas</b><span>+' + money(Math.round(crLessonIncome() * .3 / 10) * 10) + ' · −2 energia</span><button class="ghost sm" id="crCoach">Dar aulas hoje</button></div>'
    + '<div class="cr-card cr-act act-desc">' + ACT_ART.desc + '<div class="eyebrow">Recuperação</div><b>Descansar</b><span>+14 de energia' + (crLife('crio') ? ' (+6 da crioterapia)' : '') + '. 3 dias de descanso na semana aceleram a volta de lesão.</span><div class="cta-row"><button class="ghost sm" id="crRest">Descansar hoje</button><button class="ghost sm" id="crRestUntil">' + (reg ? 'Descansar até o torneio' : 'Descansar até o fim da semana') + '</button><button class="ghost sm" id="crAuto" title="Treina enquanto a energia deixa e descansa o necessário para chegar inteiro ao torneio">' + (reg ? 'Dias automáticos até o torneio' : 'Semana automática') + '</button></div></div></div>';
  const regC = reg ? '<div class="cr-card gold"><div class="eyebrow">Inscrito · ' + (crTourT(reg).pro ? 'sábado e domingo' : 'sábado') + '</div><b>' + esc(reg.name) + '</b><span>' + (crTourT(reg).pro ? 'Sábado: primeiras rodadas. Domingo: semifinal e final (se chegar lá).' : 'Todas as rodadas no sábado.') + '</span></div>' : '';
  // inscrições da semana: até sexta
  const open = !reg && d <= 5;
  const tours = !reg ? '<p class="section-label">Torneios desta semana' + (open ? ' · inscrições até sexta' : ' · inscrições encerradas') + '</p>' + (open ? '<div class="cr-cards">' + opts.map((o, i) => {
      const when = '<span class="cr-when">' + crDateTxt($s.CR.season, $s.CR.week, 6) + (o.days > 1 ? ' e ' + crDateTxt($s.CR.season, $s.CR.week, 7) : '') + '</span>';
      if (o.special && o.special !== 'estadual') return '<div class="cr-card gold"><div class="eyebrow">Seleção · convocação</div><b>' + esc(o.name) + '</b>' + when + (o.notCalled ? '<span>Você não foi convocado. ' + esc(o.info) + '</span>' : '<span>Você foi convocado! Joga ao lado de ' + esc(nameOf(crChar(o.mate))) + '.' + (o.info ? ' ' + esc(o.info) : '') + ' Sem inscrição nem viagem; não conta para o ranking, mas dá fama, evolução e prêmio.</span><button class="cta sm" data-enter="' + i + '">Defender a seleção</button>') + '</div>';
      const T = TIERS[o.tier]; const cost = o.special === 'estadual' || o.singles ? Math.round(T.fee * .5) + (o.singles ? crTravel(T) : 0) : (o.wild ? 0 : T.fee) + crTravel(T);
      if (o.singles) return '<div class="cr-card"><div class="eyebrow">Simples · chave de 8</div><b>' + esc(o.name) + '</b>' + when + '<span>Sem parceiro: só você. Adversários OVR ' + T.ovr[0] + '–' + T.ovr[1] + '</span><span>Campeão: ' + money(Math.round(T.prize[0] * .5)) + ' · não conta para o ranking de duplas</span><span>Custo: ' + money(cost) + '</span><button class="ghost sm" data-enter="' + i + '"' + ($s.CR.money < cost ? ' disabled' : '') + '>Inscrever</button></div>';
      return '<div class="cr-card' + (o.tier === 9 ? ' gold' : '') + (o.up ? ' up' : '') + '"><div class="eyebrow">' + T.nome + ' · chave de ' + T.draw + (o.up ? ' · ⚠️ acima do seu nível' : '') + '</div><b>' + esc(o.name) + '</b>' + when + '<span>Adversários OVR ' + T.ovr[0] + '–' + T.ovr[1] + (o.up ? ' (você: ' + crMeOvr() + ')' : '') + '</span><span>Campeão: ' + money(T.prize[0]) + ' · ' + (o.special === 'estadual' ? Math.round(T.pts[0] * .5) : Math.round(T.pts[0] * (o.mult || 1))) + ' pts' + ((o.mult || 1) > 1 ? ' (etapa de maior valor)' : '') + '</span><span>Custo: ' + money(cost) + (T.travel ? ' (inscrição ' + money(T.fee) + ' + viagem ' + money(T.travel) + ')' : '') + '</span><button class="cta sm" data-enter="' + i + '"' + ($s.CR.money < cost ? ' disabled' : '') + '>Inscrever</button></div>';
    }).join('') + '</div>' : '<p class="cr-note">' + (wlog[6] === 'Torneio' ? 'Torneio do fim de semana encerrado.' : 'Fim de semana sem torneio: aproveite para treinar ou descansar.') + ' Na segunda abrem as inscrições da próxima semana.</p>') : '';
  // próximo torneio do seu nível (o calendário completo fica na aba Calendário)
  const nx = crUpcoming(1)[0];
  const cal = '<p class="cr-note cr-nextcal">' + (nx ? '🗓️ Próximo: <b>' + esc(nx.o.name) + '</b> · ' + nx.date + ' · ' : '') + '<button type="button" class="ghost sm" data-t-go="calendario">Ver calendário</button></p>';
  // a ação principal (torneios da semana) vem primeiro; a escada de categorias e o calendário ficam no fim
  return '<div class="cr-tours">' + regC + tours + '</div>'
    + '<div class="cr-week">' + week + '</div>'
    + '<p class="cr-note">Parceiro: <b>' + (p ? esc(nameOf(p)) + ' (' + crCharOvr(p) + ')' : 'nenhum — um parceiro de ocasião será escolhido na inscrição') + '</b>' + (p ? ' · química ' + crChem() + ' (' + CHEM_NOME[crChemLv()] + ') · humor: ' + crMoodWord() : '') + '</p>'
    + injC + arcC + '<div class="cr-goal">' + goal + '</div><div class="cr-acts">' + acts + '</div><p class="section-label">Categorias</p><div class="cr-ladder">' + ladder + '</div>' + cal;
}
// ilustrações dos cards do dia (SVG, no canto do card): academia, quadra com cones, prancheta de aula e rede na praia
const ACT_ART = {
  fis: '<svg class="cr-act-art" viewBox="0 0 160 120" aria-hidden="true"><defs><linearGradient id="aF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a3d"/><stop offset="1" stop-color="#ff3d6e"/></linearGradient></defs>'
    + '<circle cx="112" cy="58" r="46" fill="url(#aF)" opacity=".22"/><g transform="rotate(-18 100 60)"><rect x="58" y="54" width="84" height="8" rx="4" fill="#cfd8e3"/><rect x="62" y="36" width="12" height="44" rx="4" fill="#ff5a1f"/><rect x="76" y="42" width="9" height="32" rx="3" fill="#ff8a3d"/><rect x="126" y="36" width="12" height="44" rx="4" fill="#ff5a1f"/><rect x="115" y="42" width="9" height="32" rx="3" fill="#ff8a3d"/></g>'
    + '<path d="M70 98 q8 -16 22 -16 q14 0 22 16 z" fill="#ffd23f"/><rect x="83" y="74" width="18" height="10" rx="5" fill="none" stroke="#ffd23f" stroke-width="4"/><path d="M20 30 q30 40 10 80" stroke="#7fd3ff" stroke-width="3" fill="none" stroke-dasharray="2 5" stroke-linecap="round"/></svg>',
  des: '<svg class="cr-act-art" viewBox="0 0 160 120" aria-hidden="true"><rect x="40" y="14" width="96" height="96" rx="4" fill="#e9d6a6" opacity=".28" stroke="#fbf6ea" stroke-opacity=".7" stroke-width="2"/><line x1="40" y1="62" x2="136" y2="62" stroke="#fbf6ea" stroke-width="3"/>'
    + '<g fill="#ff8a3d"><path d="M58 92 l5 -10 l5 10 z"/><path d="M110 88 l5 -10 l5 10 z"/><path d="M84 100 l5 -10 l5 10 z"/></g><circle cx="74" cy="34" r="12" fill="none" stroke="#3fd17a" stroke-width="3"/><circle cx="74" cy="34" r="4" fill="#3fd17a"/>'
    + '<path d="M118 96 Q100 40 76 36" stroke="#ffd23f" stroke-width="2.5" fill="none" stroke-dasharray="5 4"/><circle cx="118" cy="96" r="5" fill="#ffd23f"/></svg>',
  aula: '<svg class="cr-act-art" viewBox="0 0 160 120" aria-hidden="true"><rect x="40" y="16" width="100" height="74" rx="6" fill="#0b7a83" opacity=".55" stroke="#fbf6ea" stroke-opacity=".6" stroke-width="2"/><line x1="40" y1="53" x2="140" y2="53" stroke="#fbf6ea" stroke-opacity=".5" stroke-width="2"/>'
    + '<g stroke="#fbf6ea" stroke-width="3" stroke-linecap="round"><path d="M58 28 l8 8 M66 28 l-8 8"/><path d="M110 68 l8 8 M118 68 l-8 8"/></g><circle cx="118" cy="32" r="5" fill="none" stroke="#ffd23f" stroke-width="3"/><circle cx="64" cy="74" r="5" fill="none" stroke="#ffd23f" stroke-width="3"/>'
    + '<path d="M66 40 Q86 48 108 66" stroke="#ff86c0" stroke-width="2.5" fill="none" marker-end="none"/><path d="M104 60 l5 7 l-8 1" fill="#ff86c0"/><rect x="84" y="90" width="12" height="22" fill="#9aa3ad"/></svg>',
  desc: '<svg class="cr-act-art" viewBox="0 0 160 120" aria-hidden="true"><defs><linearGradient id="aD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a5a"/><stop offset="1" stop-color="#ff5a8a" stop-opacity=".4"/></linearGradient></defs>'
    + '<circle cx="104" cy="70" r="26" fill="url(#aD)"/><path d="M20 82 q20 -6 40 0 t40 0 t40 0 t40 0 v40 h-160 z" fill="#1f6fd1" opacity=".55"/><path d="M20 94 q20 -6 40 0 t40 0 t40 0 t40 0 v30 h-160 z" fill="#17324d" opacity=".7"/>'
    + '<path d="M52 98 Q50 60 60 30" stroke="#6a3f1d" stroke-width="5" fill="none"/><g fill="#2e9e57"><path d="M60 30 q-26 -4 -34 10 q18 -10 34 -10z"/><path d="M60 30 q24 -10 36 2 q-18 -6 -36 -2z"/><path d="M60 30 q-8 -22 6 -28 q-6 14 -6 28z"/><path d="M60 30 q20 6 22 24 q-10 -16 -22 -24z"/></g>'
    + '<path d="M62 64 Q90 80 122 58" stroke="#fbf6ea" stroke-width="2.5" fill="none"/></svg>' };
// calendário: todos os torneios que você pode jogar no resto da temporada, mês a mês (cor do nível, data, pontos)
const TIER_COR = ['#9aa3ad', '#9aa3ad', '#9aa3ad', '#3fd17a', '#2fb7c9', '#1f6fd1', '#9b5cff', '#ff86c0', '#ff8a3d', '#ffd23f'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
function crCalendarHTML() {
  const up = crUpcoming(80), reg = $s.CR.tour && $s.CR.tour.pending ? $s.CR.tour : null;
  const byM = new Map();
  up.forEach(x => { const m = crDate($s.CR.season, x.w, 6).getMonth(); if (!byM.has(m)) byM.set(m, []); byM.get(m).push(x); });
  const chip = x => { const t = x.o.tier, T = t !== undefined ? TIERS[t] : null, c = x.o.special && x.o.special !== 'estadual' ? '#ffd23f' : TIER_COR[t] || '#9aa3ad';
    return '<div class="cr-calev' + (x.o.locked ? ' dim' : '') + '" style="--tc:' + c + '"><span class="cr-cald"><b>' + crDate($s.CR.season, x.w, 6).getDate() + '</b><small>sem ' + x.w + '</small></span><div><b>' + esc(x.o.name) + '</b><small>'
      + (T && (!x.o.special || x.o.special === 'estadual') ? T.nome + (x.o.special ? ' · estadual' : ' · campeão ' + Math.round(T.pts[0] * (x.o.mult || 1)) + ' pts · ' + money(T.prize[0])) : x.o.special ? 'Seleção / torneio especial' : '') + (x.o.locked ? ' · 🔒' : '') + '</small></div></div>'; };
  const months = [...byM.entries()].map(([m, xs]) => '<div class="cr-calm"><p class="section-label">' + MESES[m] + '</p>' + xs.map(chip).join('') + '</div>').join('');
  const legend = [[3, 'BT10'], [4, 'BT50'], [5, 'BT100'], [6, 'BT200'], [7, 'BT400'], [8, 'Sand Series'], [9, 'Mundial']].map(([t, n]) => '<span style="--tc:' + TIER_COR[t] + '">' + n + '</span>').join('');
  return '<p class="section-label">Calendário · temporada ' + $s.CR.season + ' · você está na semana ' + $s.CR.week + '/' + SEASON_WEEKS + '</p>'
    + (reg ? '<div class="cr-card gold"><div class="eyebrow">Inscrito nesta semana</div><b>' + esc(reg.name) + '</b></div>' : '')
    + (crMaxTier() < 3 ? '<p class="cr-note">O ITF BT10 libera com ' + TIERS[3].req + ' pontos no ranking ou com um título no Amador A. Os amadores e estaduais aparecem na Agenda, semana a semana.</p>' : '<p class="cr-note">Como profissional, você pode jogar qualquer torneio do circuito, até o Sand Series (os acima do seu nível têm adversários bem mais fortes). As inscrições abrem na segunda da semana do torneio, na Agenda.</p>')
    + '<div class="cr-legend">' + legend + '<span class="yr-key">contorno = você pode jogar</span></div>' + crYearGrid()
    + (months ? '<p class="section-label">Próximos torneios</p><div class="cr-cal">' + months + '</div>' : '<p class="cr-note">Nenhum torneio profissional no resto da temporada.</p>');
}
// a temporada inteira numa grade: cada semana com os níveis que têm torneio; contorno nos que você pode jogar
function crYearGrid() {
  const cal = crSeasonCal($s.CR.season), top = crMaxTier(), reg = $s.CR.tour && $s.CR.tour.pending ? $s.CR.week : 0;
  const can = t => t === 9 ? crRank() <= 16 : t >= Math.max(3, top - 1) && t <= (top >= 3 ? 8 : top + 1);
  const byM = Array.from({ length: 12 }, () => []);
  for (let w = 1; w <= SEASON_WEEKS; w++) byM[crDate($s.CR.season, w, 6).getMonth()].push(w);
  return '<div class="yr-grid">' + byM.map((ws, m) => '<div class="yr-m"><b>' + MESES[m].slice(0, 3) + '</b><div class="yr-ws">' + ws.map(w => {
    const ts = (cal[w] || []).filter(t => t >= 3).sort((a, b) => b - a), ok = ts.some(can), d = crDate($s.CR.season, w, 6);
    return '<span class="yr-w' + (w < $s.CR.week ? ' past' : w === $s.CR.week ? ' now' : '') + (ok && w >= $s.CR.week ? ' can' : '') + (w === reg ? ' reg' : '') + '" title="Semana ' + w + ' · ' + d.getDate() + '/' + (m + 1) + (ts.length ? ': ' + ts.map(t => TIERS[t].curto).join(', ') : ': só amadores') + '"><small>' + d.getDate() + '</small>' + ts.slice(0, 3).map(t => '<i style="background:' + TIER_COR[t] + '"></i>').join('') + '</span>';
  }).join('') + '</div></div>').join('') + '</div>';
}
function crPlayerHTML() {
  const eq = crEquipB();
  const rows = ATTRS.map(([k, lbl]) => { const v = $s.CR.me.a[k], c = crUpCost(v, k), extra = Math.round(eq[k] || 0); return '<span>' + lbl + (crNatural(k) ? ' ★' : '') + '</span><span class="bar"><i class="' + (v >= 85 ? 'hi' : v <= 60 ? 'lo' : '') + '" style="width:' + v + '%"></i></span><b>' + v + (extra ? '<em class="' + (extra > 0 ? 'up' : 'dn') + '">' + (extra > 0 ? '+' : '') + extra + '</em>' : '') + '</b><button class="arw" data-up="' + k + '"' + ($s.CR.pe < c || !crCanUp(k) ? ' disabled' : '') + (!crCanUp(k) && v < 99 ? ' title="Subir este atributo passaria o overall do potencial atual: jogue bem para subir"' : '') + ' title="Custa ' + c + ' ponto(s)">+' + c + '</button>'; }).join('');
  const log = $s.CR.ovrLog.filter((x, i, a) => i === 0 || x.o !== a[i - 1].o).slice(-12).map(x => 'T' + x.s + 'S' + x.w + ': ' + x.o).join(' → ');
  return '<div class="cr-two"><div><p class="section-label">Atributos (gaste pontos de evolução)</p><div class="bars cr-bars">' + rows + '</div>' + crPotBarHTML(0) + '<p class="cr-note">Potencial atual: <b>' + crCap() + '</b> (máximo 99: até o 90 ele sobe com as partidas e os treinos; do 90 ao 99 segue a média das suas últimas 15 notas). Seu overall não passa do potencial atual, mesmo com pontos de evolução sobrando (cada atributo pode ir até 99, desde que o overall caiba). Ele sobe com a sua <b>nota</b> em cada partida (defesas boas, smashes e curtas certos sobem; erros descem) e um pouco ao cumprir desafios na quadra.' + (() => { const g = crGate(); return g.next ? ' <b>Marco:</b> para passar de ' + g.cap + ' precisa de ' + g.next.txt + ' (você tem ' + g.have + ').' : ($s.CR.potCur >= 90 ? ' <b>Faixa 90–99:</b> o potencial segue a média das últimas 15 notas (média 10 → 99, média 5 → 90; abaixo do teto, o overall desce). Alvo hoje: ' + crBandTarget($s.CR.ratings || []).toFixed(1).replace('.', ',') + '.' : ' Todos os marcos cumpridos: a partir do 90 o potencial segue a sua nota média.'); })()
    + (crNatural('forca') === null ? ' Completo: acima de 90, todo atributo custa 1,4×.' : ' Acima de 90, atributos fora do seu estilo custam o dobro (os do estilo estão marcados com ★).') + (crAvgRating() !== null ? ' Média das últimas notas: <b>' + crAvgRating().toFixed(1).replace('.', ',') + '</b>.' : '') + ' Em verde/vermelho: efeito da raquete e dos equipamentos.</p></div>'
    + '<div><p class="section-label">Evolução do overall</p><p class="cr-note">' + log + '</p><p class="section-label">Títulos</p><p class="cr-note">' + (Object.keys($s.CR.titles).length ? Object.entries($s.CR.titles).map(([t, n]) => TIERS[t].curto + ' ×' + n).join(' · ') : 'Nenhum ainda.') + '</p>'
    + '<p class="section-label">Aparência e uniforme</p><div class="cta-row"><button type="button" class="cta" id="crEditBtn">✏️ Editar jogador</button></div>'
    + '</div></div>';
}
// ajustes da carreira (antes ficavam misturados com os atributos)
function crSettingsHTML() {
  return '<div class="cr-set">'
    + '<p class="section-label">Partidas da carreira</p><fieldset class="seg"><div class="pills"><input type="radio" name="crGames" id="crG4" value="4"' + ($s.CR.games === 4 ? ' checked' : '') + '><label for="crG4">Set curto · 4 games</label><input type="radio" name="crGames" id="crG6" value="6"' + ($s.CR.games === 6 ? ' checked' : '') + '><label for="crG6">Set · 6 games</label></div></fieldset>'
    + '<p class="section-label">Seu lado na dupla</p><label class="cr-field"><select id="crMeSide" class="cr-sel"><option value="esquerda"' + ($s.CR.side === 'esquerda' ? ' selected' : '') + '>Esquerda</option><option value="direita"' + (($s.CR.side || 'direita') === 'direita' ? ' selected' : '') + '>Direita</option></select></label>'
    + ($s.CR.me.pais === 'BRA' ? '<p class="section-label">Estado (estaduais e seleção estadual)</p><label class="cr-field"><select id="crMeUf" class="cr-sel">' + STATES.map(([k, n]) => '<option value="' + k + '"' + (k === ($s.CR.me.uf || 'SP') ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' : '')
    + '<p class="section-label">Nacionalidade</p><label class="cr-field"><span class="cr-nat">' + flagSVG($s.CR.me.pais) + '<select id="crMeNat">' + COUNTRIES.map(c => '<option value="' + c.code + '"' + (c.code === $s.CR.me.pais ? ' selected' : '') + '>' + c.nome + '</option>').join('') + '</select></span></label>'
    + '<p class="section-label">Save</p><p class="cr-note">Apagar a carreira não tem volta (exporte o save antes, no botão do topo).</p><div class="cta-row"><button class="ghost sm" id="crReset">Apagar carreira</button></div></div>';
}
// aparência do seu jogador: dá para mudar a qualquer momento da carreira (vale a partir da próxima partida)
const HAIR_ST = [['', 'Automático'], ['curto', 'Curto'], ['raspado', 'Raspado'], ['careca', 'Careca'], ['cacheado', 'Cacheado'], ['topete', 'Topete'], ['moicano', 'Moicano'], ['longo', 'Longo'], ['rabo', 'Rabo de cavalo'], ['coque', 'Coque (samurai nos homens)'], ['tranca', 'Trança']];
const BUILDS = [['fino', 'Muito magro'], ['esguio', 'Magro'], ['atletico', 'Atlético'], ['forte', 'Forte (musculoso)'], ['compacto', 'Pesado']]; // só a aparência
const BEARDS = [['', 'Sem barba'], ['barba', 'Barba'], ['cavanhaque', 'Cavanhaque'], ['bigode', 'Bigode']];
const ACCS = [['cap', 'Boné'], ['visor', 'Viseira'], ['band', 'Faixa'], ['none', 'Nada']];
const lookAcc = L => L.cap ? 'cap' : L.visor ? 'visor' : L.headband ? 'band' : 'none';
function crEditHTML() {
  const me = $s.CR.me, L = me.look;
  const sw = (arr, key) => arr.map(c => '<button type="button" class="cr-sw' + (L[key] === c ? ' sel' : '') + '" data-look-' + key + '="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>').join('');
  const sel = (id, opts, v) => '<select id="' + id + '" class="cr-sel">' + opts.map(([k, n]) => '<option value="' + k + '"' + (k === (v || '') ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>';
  // abas: cada parte do jogador numa página (antes era tudo numa lista longa); a aba do saque mostra o saque animado
  const tab = ED.tab || 'corpo', T = [['corpo', 'Corpo'], ['cabeca', 'Cabeça e acessórios'], ['uniforme', 'Uniforme'], ['saque', 'Saque']];
  const sec = (k, h) => '<div class="ed-sec" data-sec="' + k + '"' + (k === tab ? '' : ' hidden') + '>' + h + '</div>';
  return '<div class="ed-tabs" role="tablist">' + T.map(([k, n]) => '<button type="button" role="tab" data-ed-tab="' + k + '" class="' + (k === tab ? 'on' : '') + '">' + n + '</button>').join('') + '</div>'
    + sec('corpo', '<div class="cr-sws ed-col"><div><span class="cr-lbl">Pele</span><div class="ed-swl">' + sw(SKINS, 'skin') + '</div></div><div><span class="cr-lbl">Cabelo</span><div class="ed-swl">' + sw(HAIRS, 'hair') + '</div></div></div>'
      + '<div class="cr-look"><label class="cr-field">Corte ' + sel('crLkHair', HAIR_ST, L.hairStyle) + '</label>'
      + (me.fem ? '' : '<label class="cr-field">Barba ' + sel('crLkBeard', BEARDS, L.beard) + '</label>')
      + '<label class="cr-field">Biotipo ' + sel('crLkBuild', BUILDS, me.build || 'atletico') + '</label></div>')
    + sec('cabeca', '<div class="cr-look"><label class="cr-field">Na cabeça ' + sel('crLkAcc', ACCS, lookAcc(L)) + '</label>'
      + '<label class="cr-field">Óculos ' + sel('crLkGlass', [['1', 'Com óculos'], ['', 'Sem óculos']], L.glasses ? '1' : '') + '</label></div>' + crAccHTML())
    + sec('uniforme', crOutfitHTML())
    + sec('saque', crServeHTML())
    + '<p class="cr-note">Vale a partir da próxima partida.</p>';
}
// jeito de sacar (por cima): parte de um estilo pronto e ajusta agachar, pulo, avanço e para onde lança a bola
const SRV_SL = [['crouch', 'Agachar no troféu', .5, 2, .05, v => Math.round(v * 100) + '%'], ['jump', 'Altura do pulo', 0, .6, .02, v => v < .03 ? 'sem pulo' : Math.round(v * 100) + ' cm'],
  ['drive', 'Avanço no pulo', 0, 1.4, .05, v => Math.round(v * 100) + '%'], ['tossX', 'Lançamento para o lado', 0, .55, .01, v => v > .35 ? 'bem de lado (slice)' : v < .12 ? 'em cima da cabeça' : Math.round(v * 100) + ' cm'],
  ['tossZ', 'Lançamento à frente', .25, .95, .01, v => v < .42 ? 'atrás (topspin)' : v > .75 ? 'bem à frente (pancada)' : Math.round(v * 100) + ' cm']];
function crServeHTML() {
  const cur = Object.assign({}, SERVE_STYLES.classico, $s.CR.serveStyle || { preset: 'classico' });
  return '<label class="cr-field">Estilo ' + '<select id="crSrvPre" class="cr-sel"><option value="">Personalizado</option>' + Object.entries(SERVE_STYLES).map(([k, v]) => '<option value="' + k + '"' + (cur.preset === k ? ' selected' : '') + '>' + v.nome + '</option>').join('') + '</select></label>'
    + '<div class="cr-srv">' + SRV_SL.map(([k, n, mn, mx, stp, fmt]) => '<label class="cr-field cr-rng">' + n + ' <input type="range" id="crSrv_' + k + '" min="' + mn + '" max="' + mx + '" step="' + stp + '" value="' + cur[k] + '"><small id="crSrvV_' + k + '">' + fmt(cur[k]) + '</small></label>').join('') + '</div>'
    + '<p class="cr-note">Lançar de lado dá mais curva (slice); atrás da cabeça, topspin; bem à frente, pancada reta.</p>';
}
// acessórios: cor do boné/viseira/faixa (livre) e o que foi comprado na loja (munhequeiras, manguito, meião, lentes, peças especiais)
function crAccHTML() {
  const L = $s.CR.me.look, A = L.acc || {}, own = ($s.CR.wardrobe.acc || []);
  const sel = (id, opts, v) => '<select id="' + id + '" class="cr-sel">' + opts.map(([k, n]) => '<option value="' + k + '"' + (k === (v || '') ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>';
  const sw = (key, cur) => OUTFIT_COLORS.map(c => '<button type="button" class="cr-sw' + (cur === c ? ' sel' : '') + '" data-acc-' + key + '="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>').join('');
  const headC = L.cap || L.visor || L.headband || '';
  let h = '<p class="section-label">Acessórios</p>';
  if (headC) h += '<div class="cr-sws ed-col"><div><span class="cr-lbl">Cor do ' + (L.cap ? 'boné' : L.visor ? 'viseira' : 'faixa') + '</span><div class="ed-swl">' + sw('head', headC) + '</div></div></div>';
  const has = k => own.includes(k), slotOwn = sl => own.filter(k => ACCESS[k] && ACCESS[k].slot === sl);
  const f = [];
  // lado: não, esquerdo, direito ou os dois (manguito: padrão no braço da raquete)
  const SIDES = [['', 'Não'], ['L', 'Esquerda'], ['R', 'Direita'], ['LR', 'Ambos']], cur = (k, def) => A[k] ? A[k + 'Side'] || def : '';
  if (has('munhe')) f.push('<label class="cr-field">Munhequeiras ' + sel('crAcWrist', SIDES, cur('wrist', 'LR')) + '</label>' + (has('munheGold') ? '<label class="cr-field">Munhequeira ' + sel('crAcWristF', [['', 'Comum'], ['gold', 'Fio de Ouro']], A.wristFab) + '</label>' : ''));
  if (has('manguito')) f.push('<label class="cr-field">Manguito ' + sel('crAcSleeve', SIDES, cur('sleeve', $s.CR.me.canhoto ? 'L' : 'R')) + '</label>');
  if (has('meiao')) f.push('<label class="cr-field">Meião ' + sel('crAcCalf', SIDES, cur('calf', 'LR')) + '</label>');
  if (slotOwn('lens').length) f.push('<label class="cr-field">Lente dos óculos ' + sel('crAcLens', [['', 'Escura']].concat(slotOwn('lens').map(k => [k, ACCESS[k].nome.replace('Lente ', '')])), A.lens) + '</label>');
  if (slotOwn('headfab').length) f.push('<label class="cr-field">Boné/viseira ' + sel('crAcHead', [['', 'Comum']].concat(slotOwn('headfab').map(k => [ACCESS[k].fab, ACCESS[k].nome.replace('Boné/viseira ', '')])), A.headFab) + '</label>');
  if (f.length) h += '<div class="cr-look">' + f.join('') + '</div>';
  const cs = [['wrist', 'Munhequeiras'], ['sleeve', 'Manguito'], ['calf', 'Meião']].filter(([k]) => A[k] && !(k === 'wrist' && A.wristFab === 'gold'));
  if (cs.length) h += '<div class="cr-sws">' + cs.map(([k, n]) => '<div><span class="cr-lbl">Cor: ' + n + '</span>' + sw(k, A[k]) + '</div>').join('') + '</div>';
  if (!f.length) h += '<p class="cr-note">Munhequeiras, manguito, meião, lentes espelhadas e peças exclusivas: Loja › Acessórios.</p>';
  return h;
}
// uniforme próprio: modelo, estampa, cores e o logo de um patrocinador ativo (a marca paga 20% a mais com o logo na camisa)
function crOutfitHTML() {
  const me = $s.CR.me, O = me.look.outfit, W = $s.CR.wardrobe, fem = !!me.fem;
  const sel = (id, opts, v) => '<select id="' + id + '" class="cr-sel">' + opts.map(([k, n]) => '<option value="' + k + '"' + (k === (v || '') ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>';
  const own = (list, cat) => list.filter(k => cat[k] && (!cat[k].fem || fem)).map(k => [k, cat[k].nome]);
  let h = '<p class="section-label">Uniforme</p><label class="cr-field">' + sel('crOfOn', [['', 'Uniforme da equipe'], ['1', 'Meu uniforme']], O ? '1' : '') + '</label>';
  if (!O) return h + '<p class="cr-note">Compre modelos de blusa, estampas e bermuda/saia na Loja e monte o seu.</p>';
  const sw = (key, cur) => OUTFIT_COLORS.map(c => '<button type="button" class="cr-sw' + (cur === c ? ' sel' : '') + '" data-of-' + key + '="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>').join('');
  h += '<div class="cr-look"><label class="cr-field">Blusa ' + sel('crOfTop', own(W.tops, TOP_KINDS), O.top) + '</label><label class="cr-field">Estampa ' + sel('crOfPat', own(W.pats, PATTERNS), O.pat) + '</label>'
    + '<label class="cr-field">Embaixo ' + sel('crOfBot', own(W.bots, BOT_KINDS), O.bot) + '</label>'
    + '<label class="cr-field">Logo ' + sel('crOfLogo', $s.CR.master ? [[$s.CR.master.brand, $s.CR.master.brand + ' (master)']] : [['', 'Sem logo']].concat($s.CR.sponsors.map(x => [x.brand, x.brand])), $s.CR.master ? $s.CR.master.brand : O.logo) + '</label></div>'
    + ((O.logo || $s.CR.master) ? '<label class="cr-field">Posição do logo ' + sel('crOfLogoPos', [['', 'No peito'], ['costas', 'Nas costas (grande)'], ['ambos', 'Peito e costas']], O.logoPos) + '</label>' : '')
    + '<div class="cr-sws"><div><span class="cr-lbl">Cor da blusa</span>' + sw('c1', O.c1) + '</div><div><span class="cr-lbl">Cor da estampa</span>' + sw('c2', O.c2) + '</div><div><span class="cr-lbl">Cor de baixo</span>' + sw('bc', O.bc) + '</div>'
    + ((O.logo || $s.CR.master) ? '<div><span class="cr-lbl">Cor do logo</span>' + sw('lc', O.logoCol || O.c2) + '</div>' : '') + '</div>'
    + ($s.CR.master ? '<p class="cr-note">Patrocínio master: o uniforme é da ' + $s.CR.master.brand + ' (só o logo dela na camisa).</p>' : $s.CR.sponsors.length ? '<p class="cr-note">Com o logo de um patrocinador na blusa, ele paga 20% a mais por semana.</p>' : '');
  return h;
}
const pre0 = () => $('crSrvPre');
function bindLook(done) {
  const L = () => $s.CR.me.look;
  document.querySelectorAll('[data-look-skin]').forEach(b => b.addEventListener('click', () => { L().skin = b.dataset.lookSkin; done(); }));
  document.querySelectorAll('[data-look-hair]').forEach(b => b.addEventListener('click', () => { L().hair = b.dataset.lookHair; done(); }));
  const on = (id, fn) => { const e = $(id); if (e) e.addEventListener('change', () => { fn(e.value); done(); }); };
  on('crLkHair', v => { if (v) L().hairStyle = v; else delete L().hairStyle; });
  on('crLkBeard', v => { L().beard = v; });
  on('crLkAcc', v => { const l = L(); delete l.cap; delete l.visor; delete l.headband; if (v === 'cap') l.cap = '#fbf6ea'; else if (v === 'visor') l.visor = '#fbf6ea'; else if (v === 'band') l.headband = '#ff5a1f'; else l.headband = ''; }); // '' impede a faixa automática
  on('crLkGlass', v => { L().glasses = !!v; });
  on('crLkBuild', v => { $s.CR.me.build = v; });
  on('crOfOn', v => { if (v) L().outfit = { top: 'tee', pat: 'liso', bot: 'short', c1: '#1f6fd1', c2: '#fbf6ea', bc: '#17324d', logo: $s.CR.master ? $s.CR.master.brand : '' }; else delete L().outfit; });
  const A = () => (L().acc = L().acc || {});
  document.querySelectorAll('[data-acc-head]').forEach(b => b.addEventListener('click', () => { const l = L(), c = b.dataset.accHead; if (l.cap) l.cap = c; else if (l.visor) l.visor = c; else if (l.headband) l.headband = c; done(); }));
  ['wrist', 'sleeve', 'calf'].forEach(k => document.querySelectorAll('[data-acc-' + k + ']').forEach(b => b.addEventListener('click', () => { A()[k] = b.getAttribute('data-acc-' + k); done(); })));
  ['wrist', 'sleeve', 'calf'].forEach(k => on('crAc' + k[0].toUpperCase() + k.slice(1), v => { const a = A(); a[k + 'Side'] = v; a[k] = v ? (a[k] || '#fbf6ea') : ''; }));
  on('crAcWristF', v => { A().wristFab = v; });
  on('crAcLens', v => { A().lens = v; if (v) L().glasses = true; });
  on('crAcHead', v => { A().headFab = v; });
  { const bt = $('crSrvPrev'); if (bt) bt.addEventListener('click', () => { ED.srv = !ED.srv; ED.st = 0; bt.textContent = ED.srv ? 'Ver aparência' : '▶ Ver saque'; srvPreviewShow(); }); }
  { const pre = $('crSrvPre'); if (pre) pre.addEventListener('change', () => { ED.srv = true; ED.st = 0; if (pre.value) { const v = SERVE_STYLES[pre.value]; $s.CR.serveStyle = { preset: pre.value, crouch: v.crouch, jump: v.jump, drive: v.drive, tossX: v.tossX, tossZ: v.tossZ }; } done(); }); }
  SRV_SL.forEach(([k, , , , , fmt]) => { const r = $('crSrv_' + k); if (r) r.addEventListener('input', () => { if (!ED.srv) { ED.srv = true; ED.st = 0; const bt = $('crSrvPrev'); if (bt) bt.textContent = 'Ver aparência'; srvPreviewShow(); } const st = $s.CR.serveStyle = Object.assign({}, SERVE_STYLES.classico, $s.CR.serveStyle || {}); st[k] = +r.value; st.preset = ''; const o = $('crSrvV_' + k); if (o) o.textContent = fmt(+r.value); if (pre0()) pre0().value = ''; }); });
  const OF = () => L().outfit || {};
  on('crOfTop', v => { OF().top = v; }); on('crOfPat', v => { OF().pat = v; }); on('crOfBot', v => { OF().bot = v; }); on('crOfLogo', v => { OF().logo = $s.CR.master ? $s.CR.master.brand : v; }); on('crOfLogoPos', v => { OF().logoPos = v; });
  ['c1', 'c2', 'bc', 'lc'].forEach(k => document.querySelectorAll('[data-of-' + k + ']').forEach(b => b.addEventListener('click', () => { if (L().outfit) { L().outfit[k === 'lc' ? 'logoCol' : k] = b.getAttribute('data-of-' + k); done(); } })));
}
// editor do jogador: janela com a prévia 3D (gira sozinha; arraste para girar) e as opções de aparência, biotipo e uniforme
const ED = { el: null, r: null, scene: null, cam: null, model: null, rot: .5, drag: null, raf: 0, srv: false, sp: null, st: 0, ball: null, last: 0 };
// prévia do saque: o seu jogador repete o lançamento e o saque com o estilo escolhido (agachar, pulo, lançamento); a bola
// sobe para onde o estilo lança. Arraste para girar a câmera em volta
function srvPreviewShow() {
  if (!ED.scene) return;
  if (ED.srv && !ED.sp) { const me = $s.CR.me; try { ED.sp = makeServePreview(Object.assign({}, me, { id: 'crme', look: me.look })); } catch (e) { ED.sp = null; }
    if (ED.sp) { ED.scene.add(ED.sp.skin.holder, ED.sp.skin.racket); ED.ball = new THREE.Mesh(new THREE.SphereGeometry(.035, 12, 8), new THREE.MeshStandardMaterial({ color: 0xff7a12, roughness: .6 })); ED.scene.add(ED.ball); } }
  if (ED.model) ED.model.visible = !ED.srv || !ED.sp;
  if (!ED.srv && ED.cam) { const h = ED.h || 1.8; ED.cam.position.set(0, h * .6, h * 2.25); ED.cam.lookAt(0, h * .52, 0); }
  if (ED.sp) { ED.sp.skin.holder.visible = ED.srv; ED.sp.skin.racket.visible = ED.srv; ED.ball.visible = false; }
}
function srvPreviewDrop() { if (!ED.sp) return; ED.scene.remove(ED.sp.skin.holder, ED.sp.skin.racket, ED.ball); ED.sp = null; }
function srvPreviewTick(dt) {
  const p = ED.sp; if (!p || !S.previewAnim) return;
  const st = p.srvSt = Object.assign({}, SERVE_STYLES.classico, $s.CR.serveStyle || {}), td = .72, hand = $s.CR.me.canhoto ? -1 : 1;
  ED.st += dt; if (ED.st > td + 1.1) { ED.st = 0; p.jumped = false; }
  const t = ED.st;
  p.model.group.visible = true; p.pos.set(0, 0, t > td - .22 && t < td + .6 ? -st.drive * .5 * Math.min(1, (t - td + .22) / .5) : 0);
  if (t < td) { p.debug = { type: 'serve', u: t / td }; if (t > td - .22 && !p.jumped) { p.jumped = true; if (st.jump > .02) { p.jump = .55; p.jumpDur = .55; p.jumpH = st.jump; } } }
  else if (t < td + .5) p.debug = { type: 'smash_saque', u: (t - td) / .5 };
  else p.debug = null;
  S.previewAnim(p, dt);
  // bola: sai da mão aos 30% do lançamento e chega ao ponto de contato no fim; depois do contato some para a frente
  const b = ED.ball, s0 = .3 * td;
  if (t < s0) { b.visible = true; b.position.set(.05 * hand, 1.05 + t / s0 * .45, -.35); }
  else if (t < td) { const k = (t - s0) / (td - s0); b.visible = true; b.position.set(st.tossX * hand * k, 1.5 + (2.62 - 1.5) * k + 1.1 * Math.sin(Math.PI * k) * .8, -.35 - (st.tossZ - .35) * k + p.pos.z * k); }
  else if (t < td + .25) { const k = (t - td) / .25; b.position.set(st.tossX * hand, 2.62 - k * .6, -st.tossZ + p.pos.z - k * 6); }
  else b.visible = false;
}
function openEditor() {
  if (!ED.el) {
    const m = document.createElement('div'); m.id = 'crEdit'; m.className = 'cr-edit'; m.hidden = true;
    m.innerHTML = '<div class="cr-edit-box"><div class="cr-edit-head"><b>Editar jogador</b><button type="button" class="cta sm" id="crEditOk">Pronto</button></div>'
      + '<div class="cr-edit-body"><div class="cr-edit-prev"><canvas id="crEditCv" width="340" height="460"></canvas><small>Arraste para girar</small></div><div class="cr-edit-opts" id="crEditOpts"></div></div></div>';
    document.body.append(m); ED.el = m;
    const cv = $('crEditCv');
    ED.r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); ED.r.outputColorSpace = THREE.SRGBColorSpace; ED.r.toneMapping = THREE.ACESFilmicToneMapping;
    ED.r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    ED.scene = new THREE.Scene(); ED.scene.add(new THREE.HemisphereLight(0xfff6e8, 0x8a7458, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(2, 4, 3); ED.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x9fd0ff, .9); rim.position.set(-3, 2, -3); ED.scene.add(rim);
    ED.cam = new THREE.PerspectiveCamera(30, 340 / 460, .1, 50);
    cv.addEventListener('pointerdown', e => { ED.drag = e.clientX; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => { if (ED.drag == null) return; ED.rot += (e.clientX - ED.drag) * .012; ED.drag = e.clientX; });
    cv.addEventListener('pointerup', () => { ED.drag = null; });
    $('crEditOk').addEventListener('click', closeEditor);
    m.addEventListener('click', e => { if (e.target === m) closeEditor(); });
  }
  ED.el.hidden = false; renderEditor(); refreshPreview();
  const loop = () => { if (ED.el.hidden) return; const now = performance.now(), dt = Math.min(.05, (now - (ED.last || now)) / 1000); ED.last = now;
    if (ED.srv && ED.sp) { srvPreviewTick(dt); const a = ED.rot + 1.2, zc = -.45; ED.cam.position.set(Math.sin(a) * 6.2, 1.6, Math.cos(a) * 6.2 + zc); ED.cam.lookAt(0, 1.35, zc); }
    else if (ED.model) ED.model.rotation.y = ED.rot; // parado: você gira arrastando
    ED.r.render(ED.scene, ED.cam); ED.raf = requestAnimationFrame(loop); };
  cancelAnimationFrame(ED.raf); loop();
}
function closeEditor() { if (!ED.el) return; ED.el.hidden = true; cancelAnimationFrame(ED.raf); renderCareer(); }
function renderEditor() {
  const box = $('crEditOpts'); box.innerHTML = crEditHTML();
  bindLook(() => { crSyncChars(); saveCareer(); renderEditor(); refreshPreview(); });
  box.querySelectorAll('[data-ed-tab]').forEach(b => b.addEventListener('click', () => {
    ED.tab = b.dataset.edTab; box.querySelectorAll('[data-ed-tab]').forEach(x => x.classList.toggle('on', x === b));
    box.querySelectorAll('.ed-sec').forEach(x => { x.hidden = x.dataset.sec !== ED.tab; });
    ED.srv = ED.tab === 'saque'; ED.st = 0; srvPreviewShow(); }));
}
function refreshPreview() {
  if (ED.model) { ED.scene.remove(ED.model); ED.model.traverse(o => { if (o.isMesh && o.material && o.material.dispose) o.material.dispose(); }); }
  const me = $s.CR.me, c = Object.assign({}, me, { id: 'crme', look: me.look });
  try { ED.model = makePreview(c); } catch (e) { ED.model = null; }
  if (!ED.model) return;
  ED.scene.add(ED.model); ED.model.rotation.y = ED.rot;
  const h = new THREE.Box3().setFromObject(ED.model).max.y || 1.8; ED.h = h;
  ED.cam.position.set(0, h * .6, h * 2.25); ED.cam.lookAt(0, h * .52, 0);
  srvPreviewDrop(); srvPreviewShow();
}
function crPersonRow(c, extra, btn) {
  const fw = c.id === 'crme' ? null : crFormWord(c.id);
  return '<div class="cr-row" data-prof="' + c.id + '"><span class="ovr sm">' + crCharOvr(c) + (fw ? '<i class="cr-form ' + (fw[0][0] === '▲' ? 'up' : 'dn') + '" title="' + fw[1] + '">' + fw[0] + '</i>' : '') + '</span><div><b>' + flagSVG(c.pais) + ' ' + esc(nameOf(c)) + '</b><small>' + c.pais + ' · ' + (c.id === 'crme' ? c.estilo : 'joga ' + PLAY_STYLES[playStyleOf(c)].nome.toLowerCase()) + ' · ' + Math.round(heightOf(c) * 100) + ' cm' + (c.canhoto ? ' · canhoto' : '') + (extra ? ' · ' + extra : '') + '</small></div>' + (btn || '') + '</div>';
}
function crPartnersHTML() {
  const cur = $s.CR.partner ? crChar($s.CR.partner) : null;
  const myO = crMeOvr();
  // primeiro quem aceita (do mais forte ao mais fraco), depois os mais próximos que ainda não aceitam
  const all = crWorld().filter(c => c.id !== $s.CR.partner).map(c => ({ c, o: crCharOvr(c), w: crWillPartner(c) })).filter(x => x.o >= myO - 15 && x.o <= myO + 22);
  const list = all.filter(x => x.w.ok).sort((x, y) => y.o - x.o).slice(0, 36).concat(all.filter(x => !x.w.ok).sort((x, y) => x.o - y.o).slice(0, 10));
  const offers = $s.CR.offers.map(crChar).filter(Boolean);
  const mood = Math.round($s.CR.mood ?? 60), mb = crMoodBonus();
  const acts = cur ? '<div class="cr-energy"><span>Humor</span><span class="bar"><i class="' + (mood < 40 ? 'lo' : mood >= 70 ? 'hi' : '') + '" style="width:' + mood + '%"></i></span><b>' + mood + '</b></div>'
    + '<p class="cr-note">' + esc(nameOf(cur)) + ' está <b>' + crMoodWord() + '</b>' + (mb ? ' · em jogo: ' + (mb > 0 ? '+' : '') + mb + ' em todos os atributos' : '') + '. Vitórias e títulos animam; derrotas cedo desanimam; abaixo de 15 ele desfaz a dupla.</p>'
    + '<div class="cta-row"><button class="ghost sm" data-pact="jantar">Jantar juntos (' + money(150 * (crMaxTier() + 1)) + ', +8)</button><button class="ghost sm" data-pact="treino">Treinar em dupla (−10 energia, +PE, +4)</button><button class="ghost sm" data-pact="conversa">Conversar sobre o calendário (+3)</button></div>' : '';
  return '<p class="section-label">Seu parceiro</p>' + (cur ? crPersonRow(cur, 'química ' + crChem() + ' · ' + CHEM_NOME[crChemLv()], '<button class="ghost sm" data-drop="1">Desfazer dupla</button>') + chemBar() + acts : '<p class="cr-note">Sem parceiro fixo.</p>')
    + (offers.length ? '<p class="section-label">Convites (de quem você venceu)</p>' + offers.map(c => crPersonRow(c, 'quer jogar com você', '<button class="cta sm" data-partner="' + c.id + '">Aceitar</button>')).join('') : '')
    + '<p class="section-label">Mercado de parceiros</p><p class="cr-note">Quem aceita depende do seu overall, dos seus pontos no ranking e de você já ter vencido o jogador. Quem está muito acima no ranking só joga com você depois de perder para você. A química sobe a cada partida juntos (mais na vitória) e fica guardada se vocês se separarem.</p>'
    + '<div class="cr-list">' + list.map(x => crPersonRow(x.c, x.w.why + ' · ' + npcPts(x.c.id) + ' pts', x.w.ok ? '<button class="ghost sm" data-partner="' + x.c.id + '">Formar dupla</button>' : '<span class="cr-lock">🔒</span>')).join('') + '</div>';
}
// ícone de cada atributo nos bônus de raquetes e equipamentos
const ATTR_IC = { forca: '💪', vel: '👟', def: '🛡️', backhand: '↩️', curta: '🪶', lob: '🌈', smash: '💥', saque: '🎾', leitura: '🧠', folego: '🫁', voleio: '⚡' };
const bonusChips = b => Object.entries(b).map(([a, v]) => '<em class="' + (v > 0 ? 'up' : 'dn') + '" title="' + ATTRS.find(x => x[0] === a)[1] + '">' + ATTR_IC[a] + ' ' + (v > 0 ? '+' : '') + v + ' ' + ATTRS.find(x => x[0] === a)[1] + '</em>').join(' ');
const RKF = { kind: 'all', own: 'all', sort: 'preco', afford: false };
const rkTot = b => Object.values(b).reduce((t, v) => t + v, 0);
// diferença para a raquete em uso, atributo por atributo
function rkCmp(b) {
  const cur = (RACKET_STATS[$s.CR.racket] || { b: {} }).b, ks = [...new Set(Object.keys(b).concat(Object.keys(cur)))];
  const d = ks.map(k => [k, (b[k] || 0) - (cur[k] || 0)]).filter(([, v]) => v);
  return '<small class="rk-cmp">' + (d.length ? 'vs. a sua: ' + d.map(([k, v]) => '<em class="' + (v > 0 ? 'up' : 'dn') + '">' + (v > 0 ? '+' : '−') + Math.abs(v) + ' ' + ATTRS.find(x => x[0] === k)[1] + '</em>').join(' ') : 'igual à sua nos atributos') + '</small>';
}
const rkKind = b => { const pos = k => Math.max(0, b[k] || 0), atk = pos('forca') + pos('smash') + pos('saque'), ctl = pos('def') + pos('curta') + pos('lob') + pos('backhand') + pos('vel'); return atk + ctl <= 2 ? ['🪵', 'Básica'] : atk > ctl + 2 ? ['⚡', 'Potência'] : ctl > atk + 2 ? ['🎯', 'Controle'] : ['⚖️', 'Equilíbrio']; };
// raquete própria: desenho, cores e a distribuição dos pontos de bônus
// prévia 3D da raquete própria (gira sozinha devagar e com o arraste): um renderizador só, que muda de lugar a cada tela
const SG = { r: null, scene: null, cam: null, g: null, rk: null, rot: .3, drag: null, raf: 0 };
function sigPreview3D() {
  const host = $('crSigPrev3d'); cancelAnimationFrame(SG.raf); if (!host || !RACKETS.assinatura) return;
  if (!SG.r) {
    SG.r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); SG.r.outputColorSpace = THREE.SRGBColorSpace; SG.r.toneMapping = THREE.ACESFilmicToneMapping;
    SG.r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); SG.r.setSize(150, 210);
    SG.scene = new THREE.Scene(); SG.scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7a90, 1.6)); const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(1, 2, 3); SG.scene.add(d);
    SG.cam = new THREE.PerspectiveCamera(30, 150 / 210, .05, 10); SG.cam.position.set(0, .3, 1.3); SG.cam.lookAt(0, .3, 0);
    SG.g = new THREE.Group(); SG.scene.add(SG.g); SG.rk = makeRacket('assinatura'); SG.rk.rotation.z = Math.PI; SG.g.add(SG.rk);
    const cv = SG.r.domElement; cv.style.cursor = 'grab'; cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', e => { SG.drag = e.clientX; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => { if (SG.drag == null) return; SG.rot += (e.clientX - SG.drag) * .015; SG.drag = e.clientX; });
    cv.addEventListener('pointerup', () => { SG.drag = null; });
  }
  SG.rk.userData.setStyle('assinatura'); host.appendChild(SG.r.domElement);
  const loop = () => { if (!SG.r.domElement.isConnected) return; SG.g.rotation.y = SG.rot; SG.r.render(SG.scene, SG.cam); SG.raf = requestAnimationFrame(loop); }; loop();
}
function crSigHTML() {
  if (!$s.CR.rackets.includes('assinatura')) return '<p class="cr-note">🎾 Raquete própria: com um patrocínio master, a marca faz a sua raquete quando você chegar a 70 de fama ou ganhar um BT200 (ou maior). ' + ($s.CR.master ? 'Patrocínio atual: ' + esc($s.CR.master.brand) + '.' : 'Você ainda não tem patrocínio master.') + '</p>';
  const L = Object.assign({ bg: '#0b0b0b', a1: '#ff6a00', a2: '#ffd23f', pattern: 'diag', carbon: true }, $s.CR.sigLook), b = crSigB(), used = Object.values(b).reduce((t, v) => t + v, 0);
  const sw = (key, cur) => OUTFIT_COLORS.map(c => '<button type="button" class="cr-sw' + (cur === c ? ' sel' : '') + '" data-sig-' + key + '="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>').join('');
  const rows = SIG_ATTRS.map(k => { const v = b[k] || 0, nm = (ATTRS.find(x => x[0] === k) || [k, k])[1];
    return '<span>' + nm + '</span><span class="bar"><i class="' + (v > 0 ? 'hi' : v < 0 ? 'lo' : '') + '" style="width:' + Math.round(Math.abs(v) / SIG_MAX * 100) + '%"></i></span><b>' + (v > 0 ? '+' : '') + v + '</b><span class="sig-pm"><button class="arw" data-sigb="' + k + ':-1"' + (v <= -2 ? ' disabled' : '') + '>−</button><button class="arw" data-sigb="' + k + ':1"' + (v >= SIG_MAX || used >= SIG_PTS ? ' disabled' : '') + '>+</button></span>'; }).join('');
  return '<p class="section-label">🎾 Sua raquete própria' + ($s.CR.master ? ' · logo ' + esc($s.CR.master.brand) : '') + '</p><div class="cr-card sig-card"><div class="sig-top"><div id="crSigPrev3d" class="sig-prev3d" title="Arraste para girar"></div><div class="cr-look">'
    + '<label class="cr-field">Desenho <select id="crSigPat" class="cr-sel">' + SIG_PATTERNS.map(([k, n]) => '<option value="' + k + '"' + (k === L.pattern ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>'
    + '<label class="cr-field">Acabamento <select id="crSigCarb" class="cr-sel"><option value="1"' + (L.carbon ? ' selected' : '') + '>Carbono</option><option value=""' + (!L.carbon ? ' selected' : '') + '>Liso</option></select></label>'
    + '<label class="cr-field">Furação <select id="crSigHoles" class="cr-sel">' + SIG_HOLES.map(([k, n]) => '<option value="' + k + '"' + (k === (L.holes || 'side1') ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label></div></div>'
    + '<div class="cr-sws ed-col"><div><span class="cr-lbl">Fundo</span>' + sw('bg', L.bg) + '</div><div><span class="cr-lbl">Desenho</span>' + sw('a1', L.a1) + '</div><div><span class="cr-lbl">Detalhe</span>' + sw('a2', L.a2) + '</div><div><span class="cr-lbl">Grip</span>' + sw('grip', L.grip || '#141414') + '</div></div>'
    + (() => { const lv = crSigLv(), P = crSigPts(), nx = lv < 7 ? SIG_LV_COST[lv] : 0;
      return '<p class="cr-note sig-lv">Nível <b>' + lv + '/7</b> · <b>+' + P + '</b> pontos' + (lv < 7 ? ' <button class="cta sm" data-sigup="1"' + ($s.CR.money < nx ? ' disabled' : '') + '>Melhorar para o nível ' + (lv + 1) + ' (+' + SIG_LV_PTS[lv] + ') · ' + money(nx) + '</button>' : ' (máximo)') + '</p>'
        + '<p class="cr-note">Atributos: distribua ' + P + ' pontos (até +' + SIG_MAX + ' em cada; dá para tirar até −2 de um para pôr em outro). Livres: <b>' + (P - used) + '</b></p>'; })()
    + '<div class="bars cr-bars sig-bars">' + rows + '</div>'
    + ($s.CR.racket !== 'assinatura' ? '<button class="cta sm" data-equip="assinatura">Usar a raquete própria</button>' : '') + '</div>';
}
function crShopHTML() {
  const disc = $s.CR.discount || 0;
  // filtros e ordem da lista de raquetes; cada uma mostra a diferença para a que está em uso
  const all = Object.entries(RACKET_STATS), kinds = [...new Set(all.map(([, r]) => rkKind(r.b)[1]))];
  const list = all.filter(([k, r]) => (RKF.kind === 'all' || rkKind(r.b)[1] === RKF.kind) && (RKF.own === 'all' || (RKF.own === 'minhas') === $s.CR.rackets.includes(k)) && (!RKF.afford || $s.CR.rackets.includes(k) || $s.CR.money >= Math.round(r.preco * (1 - disc))))
    .sort((x, y) => ($s.CR.racket === y[0]) - ($s.CR.racket === x[0]) || ({ preco: x[1].preco - y[1].preco, precod: y[1].preco - x[1].preco, bonus: rkTot(y[1].b) - rkTot(x[1].b) || x[1].preco - y[1].preco, nome: x[1].nome.localeCompare(y[1].nome) })[RKF.sort]);
  const tools = '<div class="rk-tools rk-filter"><div class="pills">' + [['all', 'Todas']].concat(kinds.map(k => [k, k])).map(([k, n]) => '<button type="button" class="ghost sm' + (RKF.kind === k ? ' sel' : '') + '" data-rkf="kind:' + k + '">' + n + '</button>').join('') + '</div>'
    + '<div class="pills">' + [['all', 'Todas'], ['minhas', 'Minhas'], ['loja', 'À venda']].map(([k, n]) => '<button type="button" class="ghost sm' + (RKF.own === k ? ' sel' : '') + '" data-rkf="own:' + k + '">' + n + '</button>').join('') + '<label class="chk rk-aff"><input type="checkbox" data-rkaff' + (RKF.afford ? ' checked' : '') + '> Só as que dá para comprar</label></div>'
    + '<label class="rk-sort">Ordenar <select class="cr-sel" data-rksort>' + [['preco', 'Preço: menor primeiro'], ['precod', 'Preço: maior primeiro'], ['bonus', 'Soma dos bônus'], ['nome', 'Nome']].map(([k, n]) => '<option value="' + k + '"' + (RKF.sort === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label></div>';
  const rk = list.map(([k, r]) => {
    const own = $s.CR.rackets.includes(k), eq = $s.CR.racket === k, price = Math.round(r.preco * (1 - disc));
    const bonus = bonusChips(r.b), tot = Object.values(r.b).reduce((t, v) => t + v, 0), kd = rkKind(r.b);
    return '<div class="cr-row' + (eq ? ' me' : '') + '"><span class="cr-rk" data-r="' + k + '"></span><div><b>' + r.nome + (eq ? ' · em uso' : '') + ' <span class="rk-tag" title="' + kd[1] + '">' + kd[0] + ' ' + kd[1] + '</span> <span class="rk-tot ' + (tot >= 0 ? 'up' : 'dn') + '" title="Soma dos bônus">' + (tot > 0 ? '+' : '') + tot + '</span></b><small>' + r.desc + '</small><small class="rk-b">' + bonus + '</small>' + (eq ? '' : rkCmp(r.b)) + '</div>' + (eq ? '' : !crRacketOk(k) ? '<button class="ghost sm" disabled title="Patrocínio master: só raquetes da ' + $s.CR.master.brand + '">Só ' + esc($s.CR.master.brand) + '</button>' : own ? '<button class="ghost sm" data-equip="' + k + '">Usar</button>' : crMasterFree(k) ? '<button class="cta sm" data-mtake="' + k + '" title="A ' + $s.CR.master.brand + ' te dá esta raquete">Pegar grátis</button>' : '<button class="cta sm" data-buy="' + k + '"' + ($s.CR.money < price ? ' disabled' : '') + (crMasterFree(k) === false && $s.CR.master ? ' title="Acima do teto do contrato (' + money(crMasterCap()) + '): compre ou ganhe mais fama"' : '') + '>' + money(price) + '</button>') + '</div>';
  }).join('') || '<p class="cr-note">Nenhuma raquete com esses filtros.</p>';
  // equipamentos por categoria: um em uso de cada (como a raquete); comprar o melhor de uma categoria já põe em uso
  const on = new Set(gearOn($s.CR.gear, $s.CR.gearEq));
  const gr = GEAR_SLOTS.map(([sl, nm]) => '<p class="section-label" style="margin-top:6px">' + nm + '</p>' + GEAR.filter(g => g.slot === sl).sort((a, b) => a.preco - b.preco).map(g => {
    const own = $s.CR.gear.includes(g.id), use = on.has(g.id), bonus = bonusChips(g.b);
    return '<div class="cr-row' + (use ? ' me' : '') + '"><span class="cr-ic">🎒</span><div><b>' + g.nome + (use ? ' · em uso' : '') + '</b><small>' + g.desc + '</small><small>' + bonus + '</small></div>'
      + (use ? '<button class="ghost sm" data-gearoff="' + sl + '">Tirar</button>' : own ? '<button class="ghost sm" data-gearuse="' + g.id + '">Usar</button>' : '<button class="cta sm" data-gear="' + g.id + '"' + ($s.CR.money < g.preco ? ' disabled' : '') + '>' + money(g.preco) + '</button>') + '</div>';
  }).join('')).join('');
  const st = STAFF.map(x => {
    const own = !!$s.CR.staff[x.id];
    return '<div class="cr-row' + (own ? ' me' : '') + '"><span class="cr-ic">' + (x.head ? '🧢' : '👤') + '</span><div><b>' + x.nome + '</b><small>' + x.desc + (x.head ? ' Só um técnico principal por vez.' : '') + '</small></div>' + (own ? '<span class="cr-own">contratado</span>' : '<button class="cta sm" data-hire="' + x.id + '"' + ($s.CR.money < x.preco ? ' disabled' : '') + '>' + money(x.preco) + '</button>') + '</div>';
  }).join('');
  const sub = SHOP_TABS.map(([k, n]) => '<button type="button" class="' + (shopTab === k ? 'sel' : '') + '" data-shop="' + k + '">' + n + '</button>').join('');
  const head = (disc ? '<p class="cr-msg">Promoção ativa: ' + Math.round(disc * 100) + '% de desconto na próxima raquete.</p>' : '') + '<div class="cr-tabs cr-shop-tabs">' + sub + '</div>';
  if (shopTab === 'raquetes') return head + crSigHTML() + '<p class="section-label">🎾 Raquetes (' + list.length + ' de ' + all.length + ')</p>' + tools + '<div class="cr-list rk-shop">' + rk + '</div>';
  if (shopTab === 'equipe') return head + '<div class="cr-two"><div><p class="section-label">🧢 Equipe técnica (contrato até o fim da temporada)</p><div class="cr-list">' + st + '</div></div><div><p class="section-label">🎒 Equipamentos</p><p class="cr-note">Um em uso por categoria, como a raquete (quanto melhor, mais caro). Somando tudo, no máximo +' + GEAR_CAP + ' por atributo.</p><div class="cr-list">' + gr + '</div></div></div>';
  return head + crClothesHTML(shopTab);
}
// ---------- loja de roupas: parte de cima, de baixo, estampas, acessórios e a vitrine das exclusivas ----------
const SHOP_TABS = [['raquetes', '🎾 Raquetes'], ['equipe', '🧢 Equipe e equipamentos'], ['cima', '👕 Parte de cima'], ['baixo', '🩳 Parte de baixo'], ['estampas', '🎨 Estampas'], ['acess', '🕶️ Acessórios'], ['exclusivas', '💎 Exclusivas']];
let shopTab = 'raquetes';
const CLOTH_CAT = { tops: TOP_KINDS, bots: BOT_KINDS, pats: PATTERNS, acc: ACCESS };
// exclusiva: pede posição no ranking, um título (nível do torneio) ou fama
function exOk(ex) {
  if (!ex) return '';
  if (ex.rank && crRank() > ex.rank) return 'Só para quem está no top ' + ex.rank + ' do ranking';
  if (ex.title != null && !($s.CR.titles[ex.title] > 0)) return 'Só para campeões do ' + TIERS[ex.title].curto;
  if (ex.fama && ($s.CR.fama || 0) < ex.fama) return 'Pede fama ' + ex.fama + ' (você tem ' + Math.round($s.CR.fama || 0) + ')';
  return '';
}
const exTxt = ex => ex.rank ? 'Top ' + ex.rank : ex.title != null ? 'Campeões do ' + TIERS[ex.title].curto : 'Fama ' + ex.fama;
// desenho da peça (silhueta na cor do seu uniforme, com o tecido por cima)
const G_PATH = {
  tee: 'M12 6 L16 4 Q20 7 24 4 L28 6 L36 12 L32 17 L29 15 L29 36 L11 36 L11 15 L8 17 L4 12 Z', long: 'M12 6 L16 4 Q20 7 24 4 L28 6 L37 30 L33 32 L29 18 L29 36 L11 36 L11 18 L7 32 L3 30 Z',
  tank: 'M14 4 L17 4 Q20 9 23 4 L26 4 Q26 12 30 14 L30 36 L10 36 L10 14 Q14 12 14 4 Z', cav: 'M12 5 L16 4 Q20 7 24 4 L28 5 Q27 13 31 15 L30 36 L10 36 L9 15 Q13 13 12 5 Z',
  crop: 'M14 4 L17 4 Q20 9 23 4 L26 4 Q26 12 30 14 L30 26 L10 26 L10 14 Q14 12 14 4 Z', sbra: 'M14 6 L17 6 Q20 12 23 6 L26 6 Q27 14 30 16 L30 24 L10 24 L10 16 Q13 14 14 6 Z',
  short: 'M9 6 L31 6 L33 26 L22 26 L20 14 L18 26 L7 26 Z', shortinho: 'M9 6 L31 6 L32 19 L22 19 L20 13 L18 19 L8 19 Z', bermuda: 'M9 6 L31 6 L33 33 L22 33 L20 14 L18 33 L7 33 Z',
  compress: 'M10 6 L30 6 L30 32 L22 32 L20 14 L18 32 L10 32 Z', legging: 'M10 6 L30 6 L28 37 L22 37 L20 14 L18 37 L12 37 Z', saia: 'M10 6 L30 6 L35 28 L5 28 Z', saiaC: 'M10 6 L30 6 L34 20 L6 20 Z' };
let gsvgN = 0;
function garmentSVG(g, c, f, pat) {
  const id = 'gf' + (++gsvgN), base = f === 'black' ? '#111114' : f === 'carbon' ? '#26262a' : c;
  const defs = { dry: '<pattern id="' + id + '" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".6" fill="rgba(0,0,0,.28)"/></pattern>',
    gold: '<pattern id="' + id + '" width="40" height="4" patternUnits="userSpaceOnUse"><rect y="3.2" width="40" height=".8" fill="#ffc640"/></pattern>',
    glitter: '<pattern id="' + id + '" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1" cy="2" r=".6" fill="#fff"/><circle cx="4" cy="5" r=".5" fill="#fff"/></pattern>',
    carbon: '<pattern id="' + id + '" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="#444"/><rect x="2" y="2" width="2" height="2" fill="#444"/></pattern>',
    black: '<pattern id="' + id + '" width="40" height="5" patternUnits="userSpaceOnUse"><rect y="4.5" width="40" height=".5" fill="rgba(255,255,255,.12)"/></pattern>',
    satin: '<linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="rgba(255,255,255,0)"/><stop offset=".45" stop-color="rgba(255,255,255,.45)"/><stop offset=".6" stop-color="rgba(255,255,255,0)"/></linearGradient>' }[f] || '';
  const d = G_PATH[g] || G_PATH.tee, pl = (g === 'saia' || g === 'saiaC') ? '<path d="M15 6 L13 ' + (g === 'saia' ? 28 : 20) + ' M20 6 L20 ' + (g === 'saia' ? 28 : 20) + ' M25 6 L27 ' + (g === 'saia' ? 28 : 20) + '" stroke="rgba(0,0,0,.25)" stroke-width=".8"/>' : '';
  return '<svg class="cr-gsvg" viewBox="0 0 40 40" aria-hidden="true"><defs>' + defs + '</defs><path d="' + d + '" fill="' + base + '" stroke="rgba(0,0,0,.35)" stroke-width=".8"/>' + (pat || '') + (defs ? '<path d="' + d + '" fill="url(#' + id + ')"/>' : '') + pl + '</svg>';
}
// estampa no desenho: só uma ideia do padrão (a peça na cor da blusa, o padrão na cor da estampa)
const PAT_SVG = { listras: c => '<path d="M8 12h24M8 18h24M8 24h24M8 30h24" stroke="' + c + '" stroke-width="2.4"/>', faixas: c => '<path d="M15 8v28M25 8v28" stroke="' + c + '" stroke-width="3"/>', diagonal: c => '<path d="M10 30L30 10" stroke="' + c + '" stroke-width="4"/>',
  bolinhas: c => '<g fill="' + c + '"><circle cx="15" cy="14" r="1.6"/><circle cx="25" cy="14" r="1.6"/><circle cx="20" cy="21" r="1.6"/><circle cx="15" cy="28" r="1.6"/><circle cx="25" cy="28" r="1.6"/></g>', chevron: c => '<path d="M11 16l9 6 9-6M11 24l9 6 9-6" stroke="' + c + '" stroke-width="2.4" fill="none"/>',
  xadrez: c => '<path d="M15 8v28M25 8v28M8 16h24M8 26h24" stroke="' + c + '" stroke-width="3" opacity=".7"/>', raios: c => '<path d="M14 8l-3 7 4 1-3 8M26 10l-3 7 4 1-3 8" stroke="' + c + '" stroke-width="2" fill="none"/>',
  onca: c => '<g fill="none" stroke="' + c + '" stroke-width="1.6"><circle cx="15" cy="15" r="2.4"/><circle cx="25" cy="21" r="2.4"/><circle cx="16" cy="28" r="2.4"/></g>', marmore: c => '<path d="M10 12q8 6 4 12t12 8M18 8q4 8 12 10" stroke="' + c + '" stroke-width="1.2" fill="none"/>' };
function crClothesHTML(tab) {
  const W = $s.CR.wardrobe, fem = !!$s.CR.me.fem, O = $s.CR.me.look.outfit || {}, c1 = O.c1 || '#1f6fd1', c2 = O.c2 || '#fbf6ea', bc = O.bc || '#17324d';
  const row = (slot, k, c) => {
    const own = (W[slot] || []).includes(k), why = exOk(c.ex), cat = slot === 'tops' ? 'Parte de cima' : slot === 'bots' ? 'Parte de baixo' : slot === 'pats' ? 'Estampa' : 'Acessório';
    const ic = slot === 'tops' ? garmentSVG(c.g || k, c1, c.f) : slot === 'bots' ? garmentSVG(c.g || k, bc, c.f) : slot === 'pats' ? garmentSVG('tee', c1, '', PAT_SVG[k] ? PAT_SVG[k](c2) : '') : '<span class="cr-ic">' + (c.ic || '🎒') + '</span>';
    const tags = (c.f ? '<span class="rk-tag">' + FABRIC_NOME[c.f] + '</span> ' : '') + (c.ex ? '<span class="rk-tag ex">💎 ' + exTxt(c.ex) + '</span>' : '');
    const btn = own ? '<span class="cr-own">comprado</span>' : why ? '<span class="cr-lock" title="' + esc(why) + '">🔒 ' + money(c.preco) + '</span>' : '<button class="cta sm" data-cloth="' + slot + ':' + k + '"' + ($s.CR.money < c.preco ? ' disabled' : '') + '>' + money(c.preco) + '</button>';
    return '<div class="cr-row cr-cloth' + (c.ex ? ' ex' : '') + '">' + ic + '<div><b>' + c.nome + '</b> ' + tags + '<small>' + cat + (why ? ' · <em class="dn">' + esc(why) + '</em>' : '') + '</small></div>' + btn + '</div>';
  };
  const list = (slot, exOnly) => Object.entries(CLOTH_CAT[slot]).filter(([k, c]) => (!c.fem || fem) && !!c.ex === !!exOnly).sort((x, y) => x[1].preco - y[1].preco).map(([k, c]) => row(slot, k, c)).join('');
  const note = '<p class="cr-note">Monte o uniforme e escolha os acessórios na aba Jogador (Editar aparência).</p>';
  if (tab === 'cima') return note + '<div class="cr-list cr-grid2">' + list('tops') + '</div>';
  if (tab === 'baixo') return note + '<div class="cr-list cr-grid2">' + list('bots') + '</div>';
  if (tab === 'estampas') return note + '<div class="cr-list cr-grid2">' + list('pats') + '</div>';
  if (tab === 'acess') return note + '<div class="cr-list cr-grid2">' + list('acc') + '</div>';
  return '<p class="cr-note">Coleções limitadas: Carbono (top 100), Black Label (top 30), Fio de Ouro (top 10), Diamante (fama 80) e a Edição Mundial (só para campeões do Mundial).</p>'
    + ['tops', 'bots', 'pats', 'acc'].map(sl => { const h = list(sl, true); return h ? '<p class="section-label">' + { tops: '👕 Parte de cima', bots: '🩳 Parte de baixo', pats: '🎨 Estampas', acc: '🕶️ Acessórios' }[sl] + '</p><div class="cr-list cr-grid2">' + h + '</div>' : ''; }).join('');
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
  const life = LIFE.map(it => { const own = crLife(it.id); return '<div class="cr-row' + (own ? ' me' : '') + '"><span class="cr-ic">' + ({ nutri: '🥗', imprensa: '📰', crio: '🧊', carro: '🚗', casa: '🏠', social: '🤝' }[it.id]) + '</span><div><b>' + it.nome + (it.temp ? ' · temporada' : '') + '</b><small>' + it.desc + '</small></div>' + (own ? '<span class="cr-own">' + (it.temp ? 'contratado' : 'comprado') + '</span>' : '<button class="cta sm" data-life="' + it.id + '"' + ($s.CR.money < it.preco ? ' disabled' : '') + '>' + money(it.preco) + '</button>') + '</div>'; }).join('');
  const sig = $s.CR.rackets.includes('assinatura') && $s.CR.racket !== 'assinatura' ? '<p class="cr-msg">Você não está usando a sua raquete própria. <button class="cta sm" data-equip="assinatura">Usar a assinatura</button></p>' : '';
  return sig + '<p class="cr-note">Investimentos permanentes (não acabam no fim da temporada). Cada nível exige o anterior e conquistas na carreira.</p>' + tracks
    + '<p class="section-label">Estilo de vida</p><div class="cr-list">' + life + '</div>';
}
function crSponsorHTML() {
  const act = $s.CR.sponsors.map(x => '<div class="cr-row me"><span class="cr-ic">🤝</span><div><b>' + esc(x.brand) + '</b><small>' + money(x.weekly) + ' por semana · bônus de ' + money(x.bonus) + ' por título · faltam ' + x.left + ' semanas</small></div></div>').join('');
  const off = $s.CR.spOffers.map((x, i) => '<div class="cr-row"><span class="cr-ic">✉️</span><div><b>' + esc(x.brand) + '</b><small>' + money(x.weekly) + ' por semana durante ' + x.weeks + ' semanas · bônus de ' + money(x.bonus) + ' por título</small></div><div class="cta-row"><button class="cta sm" data-sp-ok="' + i + '"' + ($s.CR.sponsors.length >= 2 ? ' disabled title="Máximo de 2 patrocinadores"' : '') + '>Assinar</button><button class="ghost sm" data-sp-no="' + i + '">Recusar</button></div></div>').join('');
  const M = $s.CR.master, mo = $s.CR.mOffers || [];
  const offRows = mo.map((x, i) => '<div class="cr-row"><span class="cr-ic">⭐</span><div><b>' + esc(x.brand) + ' · master' + (M ? ' (proposta melhor)' : '') + '</b><small>' + money(x.weekly) + ' por semana durante ' + x.weeks + ' semanas · bônus de ' + money(x.bonus) + ' por título · raquetes da marca grátis (até ' + money(crMasterCap()) + ') e a sua raquete própria com o logo dela' + (M ? ' · a ' + esc(x.brand) + ' paga a rescisão com a ' + esc(M.brand) : '') + '</small></div><div class="cta-row"><button class="cta sm" data-msign="' + i + '">' + (M ? 'Trocar' : 'Assinar') + '</button><button class="ghost sm" data-mno="' + i + '">Recusar</button></div></div>').join('');
  const master = '<p class="section-label">Patrocínio master (marca de raquete)</p>' + (M
    ? offRows + '<div class="cr-row me"><span class="cr-ic">⭐</span><div><b>' + esc(M.brand) + ' · master</b><small>' + money(M.weekly) + ' por semana · bônus de ' + money(M.bonus) + ' por título · faltam ' + M.left + ' semanas · raquetes da marca grátis até ' + money(crMasterCap()) + ' (na Loja)</small></div><button class="ghost sm" id="crMasterEnd" title="Multa de 8 semanas">Romper (' + money(M.weekly * 8) + ')</button></div>'
    : mo.length ? offRows
    : '<p class="cr-note">Nenhuma marca de raquete ainda. A partir do BT50, com fama, as marcas (Nux, Herue\'s, Kuna…) fazem propostas.</p>')
    + '<p class="cr-note">Com patrocínio master você só pode usar raquetes e o uniforme (logo) dessa marca enquanto durar o contrato.</p>';
  return master + '<div class="cr-energy"><span>Fama</span><span class="bar"><i class="hi" style="width:' + Math.round($s.CR.fama) + '%"></i></span><b>' + Math.round($s.CR.fama) + '</b></div>'
    + '<p class="cr-note">A fama acompanha a sua posição no ranking e o peso dos seus títulos: hoje o seu nível sustenta <b>' + Math.round(crFamaTarget()) + '</b> de fama. Títulos e eventos (TV, redes, exibições) dão picos, mas ela volta aos poucos para esse valor. Quanto mais fama e mais alto o seu nível, melhores as propostas. Até 2 patrocinadores ao mesmo tempo (camisa e boné).</p>'
    + '<p class="section-label">Contratos ativos</p>' + (act || '<p class="cr-note">Nenhum ainda.</p>')
    + '<p class="section-label">Propostas</p>' + (off || '<p class="cr-note">Nenhuma proposta no momento. Vença torneios e apareça para atrair marcas.</p>');
}
let crRankView = 'geral';
function crRankingHTML() {
  const uf = $s.CR.me.pais === 'BRA' ? $s.CR.me.uf || 'SP' : null;
  const ptsBtn = '<button type="button" class="ghost sm' + (crRankView === 'pts' ? ' sel' : '') + '" data-rkview="pts">Meus pontos</button>';
  const pais = $s.CR.me.pais || 'BRA', natName = (COUNTRIES.find(x => x.code === pais) || { nome: pais }).nome;
  const natBtn = '<button type="button" class="ghost sm' + (crRankView === 'nac' ? ' sel' : '') + '" data-rkview="nac">' + esc(natName) + '</button>';
  const tabs = !uf ? '<div class="pills" style="margin-bottom:6px"><button type="button" class="ghost sm' + (crRankView === 'geral' ? ' sel' : '') + '" data-rkview="geral">Mundial</button>' + natBtn + ptsBtn + '</div>' : '<div class="pills" style="margin-bottom:6px"><button type="button" class="ghost sm' + (crRankView === 'geral' ? ' sel' : '') + '" data-rkview="geral">Mundial</button>' + natBtn + ptsBtn + '<button type="button" class="ghost sm' + (crRankView === 'uf' ? ' sel' : '') + '" data-rkview="uf">' + esc(STATES.find(x => x[0] === uf)[1]) + '</button><button type="button" class="ghost sm' + (crRankView === 'sel' ? ' sel' : '') + '" data-rkview="sel">Seleção estadual</button></div>';
  if (crRankView === 'sel' && uf) return tabs + crSelRankHTML(uf);
  if (crRankView === 'uf' && uf) {
    const r = crStateRanking(uf), me = r.findIndex(x => x.id === 'crme');
    const show = r.slice(0, 30); if (me >= 30) show.push(...r.slice(Math.max(30, me - 2), me + 3));
    return tabs + '<p class="section-label">Ranking de ' + esc(STATES.find(x => x[0] === uf)[1]) + ' · ' + r.length + ' atletas · você é o ' + tieRank(r, me) + 'º</p><div class="cr-list">' + show.map(x => { const i = r.indexOf(x), c = crChar(x.id); return '<div class="cr-row' + (x.id === 'crme' ? ' me' : '') + '" data-prof="' + x.id + '"><span class="cr-pos">' + tieRank(r, i) + '</span><div><b>' + flagSVG(c.pais) + ' ' + esc(nameOf(c)) + '</b><small>' + uf + ' · OVR ' + crCharOvr(c) + ' · ' + (() => { const W = crRanking(); return tieRank(W, W.findIndex(y => y.id === x.id)); })() + 'º no mundo</small></div><b class="cr-pts">' + x.pts + '</b></div>'; }).join('') + '</div>';
  }
  if (crRankView === 'pts') return tabs + crMyPtsHTML();
  if (crRankView === 'nac') { // ranking nacional: só os atletas do seu país (mesmos pontos do mundial)
    const all = crRanking(), r = all.filter(x => { const c = crChar(x.id); return c && c.pais === pais; }), me = r.findIndex(x => x.id === 'crme');
    return tabs + '<p class="section-label">Ranking ' + esc(natName) + ' · ' + r.length + ' atletas · você é o ' + tieRank(r, me) + 'º</p>' + crRankList(r, c => (c.pais === 'BRA' && crUf(c) ? crUf(c) + ' · ' : '') + tieRank(all, all.findIndex(y => y.id === c.id)) + 'º no mundo');
  }
  return tabs + crRankingGeral();
}
// rankings das categorias do Brasileiro de Seleções Estaduais (C, B, A e Profissional) do seu estado
let crSelCat = null;
function crSelRankHTML(uf) {
  const q = crStateSquad(uf), n = crCatN('crme'), mc = crMinCat('crme');
  if (crSelCat === null) crSelCat = q.rank.cat ?? Math.max(mc, 0);
  const k = crSelCat, r = q.cats[k], sq = q.squad[k] || [], me = r.findIndex(x => x.id === 'crme');
  const pills = '<div class="pills" style="margin-bottom:6px">' + CAT_NAMES.map((nm, i) => '<button type="button" class="ghost sm' + (i === k ? ' sel' : '') + '" data-selcat="' + i + '">' + (i < 3 ? 'Categoria ' : '') + nm + '</button>').join('') + '</div>';
  const show = r.slice(0, 30); if (me >= 30) show.push(...r.slice(Math.max(30, me - 2), me + 3));
  const status = '<p class="cr-note">Vão ao Brasileiro de Seleções Estaduais os 2 primeiros de cada categoria (quem aparece em duas joga na mais alta). Quem joga 3 torneios numa categoria sai do ranking das de baixo e não pode mais jogar nelas; da A só sai quem acumula 70 pontos no profissional.<br>Seus torneios: C ' + n[0] + ' · B ' + n[1] + ' · A ' + n[2] + ' · Profissional ' + n[3] + ' (' + n[4] + ' pts acumulados). '
    + (mc ? 'Você não joga mais ' + (mc === 1 ? 'a categoria C' : mc === 2 ? 'as categorias C e B' : 'os amadores') + '.' : 'Você pode jogar todas as categorias.')
    + (mc === 2 && n[4] < 70 ? ' Faltam ' + (70 - n[4]) + ' pts no profissional para sair da A.' : '') + '</p>';
  return pills + '<p class="section-label">' + esc(STATES.find(x => x[0] === uf)[1]) + ' · ' + (k < 3 ? 'categoria ' : '') + CAT_NAMES[k] + ' · ' + r.length + ' atletas' + (me >= 0 ? ' · você é o ' + (me + 1) + 'º' : mc > k ? ' · você não está mais nesta categoria' : '') + '</p>'
    + '<div class="cr-list">' + (show.length ? show.map(x => { const i = r.indexOf(x), c = x.c, pick = sq.includes(x.id); return '<div class="cr-row' + (x.id === 'crme' ? ' me' : '') + '" data-prof="' + x.id + '"><span class="cr-pos">' + tieRank(r, i) + '</span><div><b>' + flagSVG(c.pais) + ' ' + esc(nameOf(c)) + (pick ? ' <small>· convocado</small>' : '') + '</b><small>OVR ' + x.ovr + '</small></div><b class="cr-pts">' + x.pts + '</b></div>'; }).join('') : '<p class="cr-note">Ninguém nesta categoria.</p>') + '</div>'
    + (sq.some(id => !r.find(x => x.id === id)) ? '<p class="cr-note">Faltou gente na categoria: completa com ' + sq.filter(id => !r.find(x => x.id === id)).map(id => esc(nameOf(crChar(id)))).join(' e ') + ' (de uma categoria abaixo).</p>' : '')
    + status;
}
// seus pontos: os resultados das últimas 52 semanas, os 10 que contam e quando cada um sai da conta
function crMyPtsHTML() {
  const now = ($s.CR.season - 1) * SEASON_WEEKS + $s.CR.week;
  const hist = $s.CR.history || [];
  const list = $s.CR.results.filter(r => r.w > now - SEASON_WEEKS && r.pts > 0).map(r => {
    const wk = x => (x.s - 1) * SEASON_WEEKS + x.w === r.w, h = hist.find(x => wk(x) && x.pts === r.pts) || hist.find(wk); // (migrações antigas mudaram o valor de alguns resultados)
    return { pts: r.pts, left: r.w + SEASON_WEEKS - now, name: h ? h.name : 'Torneio', sub: h ? h.tier + ' · ' + h.place : '', when: h ? 'T' + h.s + ' S' + h.w : '' };
  }).sort((x, y) => y.pts - x.pts || x.left - y.left);
  if (!list.length) return '<p class="section-label">Seus pontos</p><p class="cr-note">Nenhum resultado com pontos nas últimas ' + SEASON_WEEKS + ' semanas.</p>';
  const row = (x, i, on) => '<div class="cr-row' + (on ? ' me' : '') + '"><span class="cr-pos">' + (on ? i + 1 : '–') + '</span><div><b>' + esc(x.name) + '</b><small>' + (x.when ? x.when + ' · ' : '') + esc(x.sub) + ' · sai da conta em ' + x.left + (x.left === 1 ? ' semana' : ' semanas') + '</small></div><b class="cr-pts">' + x.pts + '</b></div>';
  const top = list.slice(0, RANK_BEST), rest = list.slice(RANK_BEST);
  const next = top.slice().sort((x, y) => x.left - y.left)[0];
  return '<p class="section-label">Seus pontos · ' + crPts() + ' (soma dos ' + RANK_BEST + ' melhores resultados das últimas ' + SEASON_WEEKS + ' semanas)</p>'
    + '<p class="cr-note">Cada resultado vale por ' + SEASON_WEEKS + ' semanas. O próximo a sair é ' + esc(next.name) + ' (' + next.pts + ' pts) em ' + next.left + (next.left === 1 ? ' semana' : ' semanas') + (rest.length ? '; quando um sair, entra o melhor dos que estão de fora' : '') + '.</p>'
    + '<div class="cr-list">' + top.map((x, i) => row(x, i, true)).join('') + '</div>'
    + (rest.length ? '<p class="section-label">Fora da conta (só valem se ficarem entre os ' + RANK_BEST + ' melhores)</p><div class="cr-list">' + rest.map(x => row(x, 0, false)).join('') + '</div>' : '');
}
function crRankingGeral() {
  const r = crRanking();
  return '<p class="section-label">Ranking ' + ($s.CR.me.fem ? 'feminino' : 'masculino') + ' (' + RANK_BEST + ' melhores resultados das últimas ' + SEASON_WEEKS + ' semanas)</p>' + crRankList(r, c => c.pais);
}
// lista do ranking: uma linha por atleta, ou uma linha só para a dupla quando os dois estão lado a lado com os mesmos pontos
function crRankList(r, sub) {
  const P = $s.CR.pairs || {}, me = r.findIndex(x => x.id === 'crme'), myMate = $s.CR.partnerTemp ? null : $s.CR.partner;
  const mateOf = id => id === 'crme' ? myMate : id === myMate ? 'crme' : P[id];
  const who = (c, id) => '<span class="rk-who" data-prof="' + id + '">' + flagSVG(c.pais) + ' <b>' + esc(nameOf(c)) + '</b> <small>' + esc(sub(c)) + ' · ' + crCharOvr(c) + '</small></span>';
  // os 100 primeiros e, se você estiver mais para baixo, a sua vizinhança
  const rows = [], N = Math.min(r.length, 100), near = me >= N ? [Math.max(N, me - 6), Math.min(r.length, me + 7)] : null;
  const idx = [...Array(N).keys()].concat(near ? [-1, ...Array.from({ length: near[1] - near[0] }, (_, k) => near[0] + k)] : []);
  for (let j = 0; j < idx.length; j++) {
    const i = idx[j]; if (i < 0) { rows.push('<div class="rk-gap">⋯</div>'); continue; }
    const x = r[i], y = idx[j + 1] === i + 1 ? r[i + 1] : null, c = crChar(x.id); if (!c) continue;
    const two = y && y.pts === x.pts && mateOf(x.id) === y.id && crChar(y.id);
    rows.push('<div class="cr-row rk1' + (x.id === 'crme' || (two && y.id === 'crme') ? ' me' : '') + '"><span class="cr-pos">' + tieRank(r, i) + '</span><div class="rk-names">' + who(c, x.id) + (two ? '<span class="rk-sep">/</span>' + who(crChar(y.id), y.id) : '') + '</div><b class="cr-pts">' + x.pts + '</b></div>');
    if (two) j++;
  }
  return (me >= 0 ? '<div class="cta-row rk-tools"><button type="button" class="ghost sm" data-rkme>📍 Minha posição (' + tieRank(r, me) + 'º)</button><small>' + r.length + ' atletas · os ' + N + ' primeiros' + (near ? ' e a sua posição' : '') + '</small></div>' : '')
    + '<div class="cr-list rk-long">' + rows.join('') + '</div>';
}
function crRivalsHTML() {
  const l = Object.entries($s.CR.h2hP || {}).filter(([id]) => crRivalP(id)).sort((a, b) => (b[1].w + b[1].l) - (a[1].w + a[1].l)).slice(0, 10);
  return '<p class="section-label">Rivais (confronto direto)</p>' + (l.length ? '<div class="cr-list">' + l.map(([id, h]) => { const c = crChar(id), nem = crNemesis(id);
    return '<div class="cr-row"><span class="cr-ic">' + (nem ? '💀' : '🔥') + '</span><div><b>' + esc(h.name) + (c ? ' <small>(' + crCharOvr(c) + ')</small>' : '') + '</b><small>' + (nem ? 'Carrasco · ' : '') + h.w + ' vitórias · ' + h.l + ' derrotas</small></div></div>'; }).join('') + '</div>'
    : '<p class="cr-note">Ninguém ainda. Rival é quem você enfrentou 3 vezes ou mais, com vitória e derrota dos dois lados; quem te vence 3 vezes sem perder vira carrasco. Contra rival a CPU joga mais focada, e vencer rende bônus.</p>');
}
// sala de troféus: estante com os títulos por nível, honrarias, números da carreira e as conquistas
function crTrophyHTML() {
  crAchCheck();
  const T = $s.CR.titles || {}, got = $s.CR.ach || {};
  const shelf = TIERS.map((t, i) => T[i] ? '<div class="tr-cup' + (i >= 7 ? ' gold' : i >= 3 ? ' silver' : '') + '"><span class="tr-ic">🏆</span><b>' + T[i] + '×</b><small>' + esc(t.curto) + '</small></div>' : '').join('');
  const hon = ($s.CR.honors || []).slice(0, 12);
  const mw = $s.CR.mw || 0, ml = $s.CR.ml || 0;
  const stats = [['Títulos', crTitlesN()], ['Vitórias', mw], ['Derrotas', ml], ['Aproveitamento', mw + ml ? Math.round(mw / (mw + ml) * 100) + '%' : '—'], ['Melhor nota', $s.CR.bestR ? String($s.CR.bestR).replace('.', ',') : '—'], ['Ventaglios', $s.CR.vent || 0]];
  const done = ACH.filter(a => got[a[0]]).length;
  return '<p class="section-label">Estante</p>' + (shelf ? '<div class="tr-shelf">' + shelf + '</div>' : '<p class="cr-note">Nenhum título ainda. O primeiro troféu vai aqui.</p>')
    + (hon.length ? '<p class="section-label">Honrarias</p><div class="cr-list">' + hon.map(h => '<div class="cr-row"><span class="cr-ic">' + (h.place === 'Campeão' ? '🥇' : '🥈') + '</span><div><b>' + esc(h.name) + '</b><small>' + esc(h.place) + ' · temporada ' + h.s + '</small></div></div>').join('') + '</div>' : '')
    + '<p class="section-label">Números da carreira</p><div class="tr-stats">' + stats.map(([k, v]) => '<div><b>' + v + '</b><small>' + k + '</small></div>').join('') + '</div>'
    + '<p class="section-label">Conquistas (' + done + ' de ' + ACH.length + ')</p><div class="tr-ach">' + ACH.map(([id, ic, nome, desc, f, goal]) => {
      const ok = !!got[id]; let v = 0; try { v = f(); } catch (e) {} const pc = Math.min(100, Math.round(v / goal * 100));
      return '<div class="tr-a' + (ok ? ' ok' : '') + '"><span class="tr-ai">' + (ok ? ic : '🔒') + '</span><div><b>' + nome + '</b><small>' + desc + (ok ? ' · ' + got[id] : '') + '</small>' + (!ok && goal > 1 ? '<span class="bar"><i style="width:' + pc + '%"></i></span>' : '') + '</div></div>';
    }).join('') + '</div>';
}
function crHistoryHTML() {
  return crRivalsHTML() + '<p class="section-label">Últimos torneios</p><div class="cr-list">' + ($s.CR.history.length ? $s.CR.history.map(h => '<div class="cr-row"><span class="cr-pos">T' + h.s + '<br>S' + h.w + '</span><div><b>' + esc(h.name) + '</b><small>' + h.tier + ' · ' + h.place + (h.partner ? ' · com ' + esc(h.partner) : '') + '</small></div><b class="cr-pts">' + money(h.prize) + '<br>' + h.pts + ' pts</b></div>').join('') : '<p class="cr-note">Nenhum torneio ainda.</p>') + '</div>';
}
const crIsFinalT = t => !t.done && t.round === crNRounds() - 1;
function crTourHTML() {
  crSkipByes(); // corrige chaves antigas travadas em "passa direto"
  const t = $s.CR.tour, T = crTourT(t), names = crRoundNames(crNRounds());
  const br = '<div class="bracket-wrap"><div class="bracket" style="grid-template-columns:repeat(' + crNRounds() + ',minmax(150px,1fr));min-width:' + (crNRounds() * 170) + 'px">' + names.map((nm, r) => {
    const rd = t.rounds[r] || [];
    return '<div class="rd"><h4>' + nm + '</h4>' + (rd.length ? rd.map((m, mi) => {
      const flags = tm => [...new Set([tm.a, tm.b].filter(Boolean).map(id => (crChar(id) || {}).pais).filter(Boolean))].map(c => flagSVG(c)).join('') + ' ';
      const row = i => { if (i < 0) return '<div class="tm l">—<b></b></div>'; const tm = t.teams[i]; const cls = (m.w === null ? '' : m.w === i ? 'w' : 'l') + (i === t.me ? ' me' : ''); return '<div class="tm ' + cls + '">' + (i !== t.me && crRivalsIn(tm).length ? '🔥 ' : '') + (tm.label ? '' : flags(tm)) + crTeamName(tm) + (t.seeds && t.seeds[i] ? ' <i class="seed">[' + t.seeds[i] + ']</i>' : '') + '<b>' + crTeamOvr(tm) + '</b></div>'; };
      // caminho até a final: os jogos que a sua dupla ainda pode jogar ficam marcados
      const r0 = t.rounds[0] || [], my0 = r0.findIndex(x => x.a === t.me || x.b === t.me), onPath = t.alive && my0 >= 0 && r > t.round && mi === (my0 >> r);
      return '<div class="m' + (m.a === t.me || m.b === t.me ? ' mine' : '') + (onPath ? ' path' : '') + '">' + row(m.a) + row(m.b) + (m.score ? '<div class="tm"><b>' + m.score + '</b></div>' : '') + '</div>';
    }).join('') : '<div class="m"><div class="tm l">a definir</div></div>') + '</div>';
  }).join('') + '</div></div>';
  const mm = crMyMatch();
  let msg = '';
  if (t.done && t.summary) {
    const s = t.summary;
    msg = '<div class="cr-sum"><b class="champion">' + (s.place === 0 ? '🏆 Campeões do ' + esc(t.name) + '!' : s.placeName) + '</b><span>Prêmio ' + money(s.prize) + (t.sponsorBonus ? ' + bônus de patrocínio ' + money(t.sponsorBonus) : '') + ' · +' + s.pts + ' pts de ranking · +' + s.xp + ' pontos de evolução</span>'
      + (t.stand ? '<p class="section-label">Classificação dos estados (4 / 2 / 1 por categoria)</p><div class="cr-list">' + t.stand.map((x, i) => '<div class="cr-row' + (x.uf === t.teams[t.me].uf ? ' me' : '') + '"><span class="cr-pos">' + (i + 1) + '</span><div><b>' + esc(STATES.find(q => q[0] === x.uf)[1]) + '</b><small>' + ['C', 'B', 'A', 'Pro'].map((c, k) => c + ': ' + (x.cats[k] ? x.cats[k] + 'º' : '–')).join(' · ') + '</small></div><b class="cr-pts">' + x.pts + '</b></div>').join('') + '</div>' : '')
      + (s.offers.length ? '<span>Convites para formar dupla: ' + s.offers.map(id => esc(nameOf(crChar(id)))).join(', ') + ' (veja em Jogador e dupla › Dupla)</span>' : '') + '<span class="cr-note">' + t.log.map(esc).join(' · ') + '</span></div>';
  } else if (mm) {
    const opp = t.teams[mm.a === t.me ? mm.b : mm.a];
    const sty = id => PLAY_STYLES[playStyleOf(crChar(id))].nome.toLowerCase();
    const h = crH2H(opp), riv = crRivalOf(opp);
    const rv = crRivalsIn(opp), pTxt = [opp.a, opp.b].filter(Boolean).map(id => { const x = crH2HP(id); return x.w + x.l ? esc(shortOf(crChar(id))) + ' ' + x.w + '–' + x.l : ''; }).filter(Boolean).join(' · ');
    msg = (riv ? '<p class="cr-msg">🔥 Clássico!' + (rv.length ? ' ' + rv.map(id => (crNemesis(id) ? '💀 ' : '') + esc(shortOf(crChar(id)))).join(' e ') + (rv.length > 1 ? ' são rivais' : crNemesis(rv[0]) ? ' é o seu carrasco' : ' é seu rival') + '.' : '') + ' Confronto direto: ' + (pTxt || h.w + '–' + h.l) + '. A CPU vem mais focada; vencer rende bônus.</p>' : pTxt ? '<p class="cr-note">Confronto direto: ' + pTxt + '</p>' : '')
      + ($s.CR.feud && (opp.a === $s.CR.feud.id || opp.b === $s.CR.feud.id) ? '<p class="cr-msg">⚔️ Duelo aceito contra ' + esc($s.CR.feud.name) + ': vencer vale +8 de fama, dinheiro e PE; perder custa 5 de fama.</p>' : '')
      + (t.singles ? '' : '<p class="cr-note">Seu lado na dupla: <select id="crSide" class="cr-sel"><option value="esquerda">Esquerda</option><option value="direita">Direita</option></select></p>')
      + '<p class="cr-note">Tática: <select id="crTactic" class="cr-sel"><option value="normal">Equilibrada</option><option value="fraco">Atacar o mais fraco</option><option value="meio">Jogar no meio</option><option value="lobs">Lobs no fundo</option></select> Formação: <select id="crForm2" class="cr-sel"><option value="normal">Equilibrada</option><option value="rede">Parceiro colado na rede</option><option value="fundo">Parceiro no fundo</option></select> Games por set: <select id="crGamesT" class="cr-sel"><option value="4"' + ($s.CR.games === 4 ? ' selected' : '') + '>4 games</option><option value="6"' + ($s.CR.games === 6 ? ' selected' : '') + '>6 games</option></select></p>'
      + (t.mixed ? (t.states ? '<p class="cr-note">Brasileiro por categorias (top 2 do ranking estadual de cada uma): vocês jogam a chave da ' + esc(t.cat >= 3 ? 'PROFISSIONAL' : TIERS[t.cat].curto) + '. Em cada categoria o campeão soma 4 pontos para o estado, o vice 2 e o 3º 1; a soma das 4 categorias dá o estado campeão.</p>' : '<p class="cr-note">Confronto entre estados: um jogo por categoria (top 2 do ranking estadual de cada uma). Vocês jogam o da ' + esc(t.cat >= 3 ? 'PROFISSIONAL' : TIERS[t.cat].curto) + '; os outros são simulados e vence o estado que ganhar mais jogos.</p>') : '')
      + '<p class="lede">' + names[t.round] + ': ' + (t.singles ? 'você' : 'vocês') + ' contra <b>' + crTeamName(opp) + '</b> (OVR ' + crTeamOvr(opp) + '): ' + esc(shortOf(crChar(opp.a))) + ' é ' + sty(opp.a) + (opp.b ? ', ' + esc(shortOf(crChar(opp.b))) + ' é ' + sty(opp.b) + '. Sua dupla: OVR ' : '. Você: OVR ') + crTeamOvr(t.teams[t.me]) + '.</p>';
  }
  const dayTxt = '<p class="cr-note"><b>Dia ' + (t.day || 1) + ' · ' + crDateTxt($s.CR.season, $s.CR.week, $s.CR.day) + '</b>' + (T.pro && !t.done ? (t.day === 2 ? ' · semifinal e final hoje' : ' · semifinal e final no domingo') : '') + '</p>';
  if (t.night && !t.done) return '<div class="eyebrow">' + esc(t.name) + '</div>' + br + '<div class="cr-sum"><b>Fim do sábado: ' + (t.singles ? 'você está' : 'vocês estão') + ' na semifinal!</b><span>Amanhã (domingo) tem semifinal e, vencendo, a final. A noite de descanso recuperou 12 de energia.</span><span class="cr-note">' + t.log.map(esc).join(' · ') + '</span></div><div class="cta-row"><button class="cta" id="crSunday">Ir para o domingo</button><button class="ghost" id="crSimAll">Simular o resto do torneio</button></div>';
  return dayTxt + '<div class="eyebrow">' + (t.special ? esc(T.nome) : t.singles ? esc(t.name) + ' · ' + esc(TIERS[t.tier].nome) : esc(T.nome) + ' · ' + esc(t.name)) + (crIsFinalT(t) && T.pro ? ' · final em 2 sets de ' + $s.CR.games + ' games + super tie-break' : '') + '</div>' + br + msg
    + '<div class="cta-row">' + (t.done ? '<button class="cta" id="crDone">Continuar</button>' : mm ? '<button class="cta" id="crPlay">Jogar partida</button><button class="ghost" id="crSim">Simular partida</button><button class="ghost" id="crSimAll">Simular o resto do torneio</button>' : '') + '</div>';
}
function bindTour() {
  const b = id => $(id) && $(id).addEventListener('click', fn[id]);
  const fn = {
    crPlay: () => { const ts = $('crTactic'), fs = $('crForm2'); if (ts) S.settings.tactic = ts.value; if (fs) S.settings.formation = fs.value; saveSettings(); crPlayMatch(); },
    crSim: () => { crPlaySim(); renderCareer(); },
    crSimAll: () => { crSimTour(); renderCareer(); },
    // acabou no sábado: o domingo fica livre; acabou no domingo: vira a semana
    crDone: () => { if ($s.CR.day < 7) { $s.CR.tour = null; crNextDay(); } else crNextWeek(); crTab = 'agenda'; renderCareer(); },
    crSunday: () => { $s.CR.tour.night = false; saveCareer(); renderCareer(); },
  };
  ['crPlay', 'crSim', 'crSimAll', 'crDone', 'crSunday'].forEach(b);
  { const gt = $('crGamesT'); if (gt) gt.addEventListener('change', () => { $s.CR.games = +gt.value; saveCareer(); renderCareer(); }); } // games por set: muda no meio do torneio (vale da próxima partida)
  const ts = $('crTactic'); if (ts) ts.value = S.settings.tactic || 'normal'; const fs2 = $('crForm2'); if (fs2) fs2.value = S.settings.formation || 'normal';
  const sd = $('crSide'); if (sd) { sd.value = $s.CR.side || 'direita'; sd.addEventListener('change', () => { $s.CR.side = sd.value; saveCareer(); }); }
}
function bindCareerBody() {
  const body = $('crBody');
  body.querySelectorAll('[data-enter]').forEach(bt => bt.addEventListener('click', () => { const o = crWeekOptions()[+bt.dataset.enter]; if (o && crEnter(o)) crSyncChars(); renderCareer(); }));
  const tr = $('crTrain'); if (tr) tr.addEventListener('click', () => { crTrain(); renderCareer(); });
  const rs = $('crRest'); if (rs) rs.addEventListener('click', () => { crRest(); renderCareer(); });
  const ru = $('crRestUntil'); if (ru) ru.addEventListener('click', () => { crRestUntil(); renderCareer(); });
  const au = $('crAuto'); if (au) au.addEventListener('click', () => { crAutoDays(); renderCareer(); });
  const dr = $('crDrill'); if (dr) dr.addEventListener('click', openDrillFromCareer);
  const co = $('crCoach'); if (co) co.addEventListener('click', () => { crCoach(); renderCareer(); });
  body.querySelectorAll('[data-up]').forEach(bt => bt.addEventListener('click', () => { crUpgrade(bt.dataset.up); renderCareer(); }));
  body.querySelectorAll('[data-partner]').forEach(bt => bt.addEventListener('click', () => { crSetPartner(bt.dataset.partner); $s.CR.lastMsg = 'Nova dupla: ' + nameOf(crChar(bt.dataset.partner)) + '.'; renderCareer(); }));
  body.querySelectorAll('[data-drop]').forEach(bt => bt.addEventListener('click', () => { $s.CR.partner = null; $s.CR.partnerTemp = false; saveCareer(); renderCareer(); }));
  body.querySelectorAll('[data-buy]').forEach(bt => bt.addEventListener('click', () => { const k = bt.dataset.buy, r = RACKET_STATS[k], price = Math.round(r.preco * (1 - ($s.CR.discount || 0))); if ($s.CR.money >= price && crRacketOk(k)) { $s.CR.money -= price; $s.CR.discount = 0; $s.CR.rackets.push(k); $s.CR.racket = k; $s.CR.me.look.racket = k; $s.CR.lastMsg = 'Comprou a ' + r.nome + '.'; saveCareer(); } renderCareer(); }));
  body.querySelectorAll('[data-life]').forEach(bt => bt.addEventListener('click', () => { crLifeBuy(bt.dataset.life); renderCareer(); }));
  body.querySelectorAll('[data-pact]').forEach(bt => bt.addEventListener('click', () => { crPartnerAct(bt.dataset.pact); renderCareer(); }));
  body.querySelectorAll('[data-goal]').forEach(bt => bt.addEventListener('click', () => { crPickGoal(+bt.dataset.goal); renderCareer(); }));
  body.querySelectorAll('[data-rkview]').forEach(bt => bt.addEventListener('click', () => { crRankView = bt.dataset.rkview; renderCareer(); }));
  body.querySelectorAll('[data-rkf]').forEach(bt => bt.addEventListener('click', () => { const [k, v] = bt.dataset.rkf.split(':'); RKF[k] = v; renderCareer(); }));
  body.querySelectorAll('[data-rksort]').forEach(e => e.addEventListener('change', () => { RKF.sort = e.value; renderCareer(); }));
  body.querySelectorAll('[data-rkaff]').forEach(e => e.addEventListener('change', () => { RKF.afford = e.checked; renderCareer(); }));
  body.querySelectorAll('[data-rkme]').forEach(bt => bt.addEventListener('click', () => { const L = body.querySelector('.rk-long'), m = L && L.querySelector('.cr-row.me'); if (m) { L.scrollTop = m.offsetTop - L.offsetTop - L.clientHeight / 2 + m.offsetHeight / 2; m.classList.remove('flash'); void m.offsetWidth; m.classList.add('flash'); } }));
  body.querySelectorAll('[data-selcat]').forEach(bt => bt.addEventListener('click', () => { crSelCat = +bt.dataset.selcat; renderCareer(); }));
  body.querySelectorAll('[data-inv]').forEach(bt => bt.addEventListener('click', () => { crInvBuy(bt.dataset.inv); renderCareer(); }));
  body.querySelectorAll('[data-hire]').forEach(bt => bt.addEventListener('click', () => { crHire(bt.dataset.hire); renderCareer(); }));
  body.querySelectorAll('[data-ev]').forEach(bt => bt.addEventListener('click', () => { crResolveEvent(+bt.dataset.ev); renderCareer(); }));
  body.querySelectorAll('[data-sp-ok]').forEach(bt => bt.addEventListener('click', () => { const o = $s.CR.spOffers.splice(+bt.dataset.spOk, 1)[0]; if (o && $s.CR.sponsors.length < 2) { $s.CR.sponsors.push(Object.assign(o, { left: o.weeks })); $s.CR.lastMsg = 'Contrato assinado com ' + o.brand + '.'; } saveCareer(); renderCareer(); }));
  body.querySelectorAll('[data-sp-no]').forEach(bt => bt.addEventListener('click', () => { $s.CR.spOffers.splice(+bt.dataset.spNo, 1); saveCareer(); renderCareer(); }));
  // card com uma ação só (treinar, aulas, desafio, inscrever num torneio…): o card inteiro vale como o botão
  body.querySelectorAll('.cr-card').forEach(cd => { const bs = cd.querySelectorAll('button, select, input'); if (bs.length !== 1 || bs[0].tagName !== 'BUTTON' || bs[0].disabled) return;
    cd.classList.add('one'); cd.addEventListener('click', e => { if (!e.target.closest('button, a, select, input')) bs[0].click(); }); });
  body.querySelectorAll('[data-t-go]').forEach(bt => bt.addEventListener('click', () => { crTab = bt.dataset.tGo; renderCareer(); }));
  body.querySelectorAll('[data-shop]').forEach(bt => bt.addEventListener('click', () => { shopTab = bt.dataset.shop; renderCareer(); }));
  // raquete própria: prévia, cores, desenho e pontos
  sigPreview3D();
  ['bg', 'a1', 'a2', 'grip'].forEach(k => body.querySelectorAll('[data-sig-' + k + ']').forEach(bt => bt.addEventListener('click', () => { crSigLook(k, bt.getAttribute('data-sig-' + k)); renderCareer(); })));
  { const sh = $('crSigHoles'); if (sh) sh.addEventListener('change', () => { crSigLook('holes', sh.value); crSyncChars(); renderCareer(); }); }
  body.querySelectorAll('[data-sigup]').forEach(bt => bt.addEventListener('click', () => { crSigUp(); renderCareer(); }));
  { const sp = $('crSigPat'); if (sp) sp.addEventListener('change', () => { crSigLook('pattern', sp.value); renderCareer(); }); const sc = $('crSigCarb'); if (sc) sc.addEventListener('change', () => { crSigLook('carbon', !!sc.value); renderCareer(); }); }
  body.querySelectorAll('[data-sigb]').forEach(bt => bt.addEventListener('click', () => { const [k, d] = bt.dataset.sigb.split(':'); crSigSet(k, +d); renderCareer(); }));
  body.querySelectorAll('[data-mtake]').forEach(bt => bt.addEventListener('click', () => { crMasterTake(bt.dataset.mtake); renderCareer(); }));
  body.querySelectorAll('[data-msign]').forEach(bt => bt.addEventListener('click', () => { crMasterSign(+bt.dataset.msign); renderCareer(); }));
  body.querySelectorAll('[data-mno]').forEach(bt => bt.addEventListener('click', () => { $s.CR.mOffers.splice(+bt.dataset.mno, 1); saveCareer(); renderCareer(); }));
  const mEnd = $('crMasterEnd'); if (mEnd) mEnd.addEventListener('click', () => { crMasterEnd(); renderCareer(); });
  body.querySelectorAll('[data-equip]').forEach(bt => bt.addEventListener('click', () => { if (!crRacketOk(bt.dataset.equip)) return; $s.CR.racket = bt.dataset.equip; $s.CR.me.look.racket = $s.CR.racket; saveCareer(); renderCareer(); }));
  body.querySelectorAll('[data-cloth]').forEach(bt => bt.addEventListener('click', () => {
    const [slot, k] = bt.dataset.cloth.split(':'), c = (CLOTH_CAT[slot] || {})[k], W = $s.CR.wardrobe; W[slot] = W[slot] || [];
    if (!c || $s.CR.money < c.preco || W[slot].includes(k) || exOk(c.ex)) return;
    $s.CR.money -= c.preco; W[slot].push(k); if (c.ex) $s.CR.fama = ($s.CR.fama || 0) + 2;
    $s.CR.lastMsg = 'Comprou: ' + c.nome + (c.ex ? ' (peça exclusiva: +2 de fama)' : '') + '. ' + (slot === 'acc' ? 'Use na aba Jogador.' : 'Monte o uniforme na aba Jogador.'); saveCareer(); renderCareer();
  }));
  body.querySelectorAll('[data-gear]').forEach(bt => bt.addEventListener('click', () => { const g = GEAR.find(x => x.id === bt.dataset.gear); if ($s.CR.money >= g.preco) { $s.CR.money -= g.preco; if (g.staff) $s.CR.staff[g.id] = true; else { $s.CR.gear.push(g.id); const E = $s.CR.gearEq = $s.CR.gearEq || {}, cur = GEAR.find(x => x.id === E[g.slot]); if (!cur || cur.preco < g.preco) E[g.slot] = g.id; } $s.CR.lastMsg = 'Comprou: ' + g.nome + '.'; crSyncChars(); saveCareer(); } renderCareer(); }));
  body.querySelectorAll('[data-gearuse]').forEach(bt => bt.addEventListener('click', () => { const g = GEAR.find(x => x.id === bt.dataset.gearuse); if (g) { ($s.CR.gearEq = $s.CR.gearEq || {})[g.slot] = g.id; crSyncChars(); saveCareer(); } renderCareer(); }));
  body.querySelectorAll('[data-gearoff]').forEach(bt => bt.addEventListener('click', () => { ($s.CR.gearEq = $s.CR.gearEq || {})[bt.dataset.gearoff] = null; crSyncChars(); saveCareer(); renderCareer(); }));
  body.querySelectorAll('input[name=crGames]').forEach(r => r.addEventListener('change', () => { $s.CR.games = +r.value; saveCareer(); }));
  const ms = $('crMeSide'); if (ms) ms.addEventListener('change', () => { $s.CR.side = ms.value; saveCareer(); });
  if (crTab === 'jogador') { const eb = $('crEditBtn'); if (eb) eb.addEventListener('click', openEditor); }
  const mu = $('crMeUf'); if (mu) mu.addEventListener('change', () => { $s.CR.me.uf = mu.value; crSyncChars(); saveCareer(); renderCareer(); });
  const mn = $('crMeNat'); if (mn) mn.addEventListener('change', () => { $s.CR.me.pais = mn.value; crSyncChars(); saveCareer(); renderCareer(); });
  const rst = $('crReset'); if (rst) rst.addEventListener('click', () => { if (rst.dataset.sure) { $s.CR = null; saveCareer(); crSyncChars(); renderCareer(); } else { rst.dataset.sure = '1'; rst.textContent = 'Clique de novo para confirmar'; } });
  body.querySelectorAll('.cr-rk').forEach(sp => { const r = RACKETS[sp.dataset.r]; if (r) sp.style.background = r.edge; });
}

// ---------- tutorial da carreira: tour guiado (abre sozinho na 1ª carreira e pelo botão ❓ Tutorial) ----------
const GUIDE = [
  { t: 'Bem-vindo à carreira', b: 'Você começa no amador e sobe até o circuito mundial. Cada semana tem 7 dias: de segunda a sexta você treina, dá aulas ou descansa; no fim de semana joga torneios. Os torneios dão pontos no ranking, dinheiro e evolução. Vamos ver cada parte da tela.' },
  { sel: '#crHead .cs-id', t: 'Seu jogador', b: 'OVR é o seu overall (a média dos atributos). O potencial ("pot.") é o teto atual: o overall não passa dele. O potencial sobe jogando bem (a nota de cada partida) e cumprindo desafios. Fama abre patrocínios e peças exclusivas.' },
  { sel: '#crHead .cr-strip', t: 'A faixa do topo', b: 'Da esquerda para a direita: posição no ranking e pontos, dinheiro, pontos de evolução (para gastar em atributos), a data (temporada e semana), a energia e a dificuldade. Clique nas estrelas da dificuldade para mudar quando quiser.' },
  { sel: '#crHead .cs-en', t: 'Energia', b: 'Treinar e jogar gastam energia; descansar recupera. Com energia alta você joga um pouco melhor (+ nos atributos); com energia baixa, pior. Jogar muitos torneios seguidos e treinar demais aumenta o risco de lesão.' },
  { tab: 'agenda', sel: '#crTabs', t: 'As abas', b: 'Agenda (semana e calendário), Jogador e dupla (atributos, dupla e ajustes), Loja, Ranking, Patrocínios, Negócios e Histórico (resultados e troféus). Algumas abas têm sub-abas logo embaixo.' },
  { tab: 'agenda', sel: '.cr-tours', t: 'Torneios da semana', b: 'Aqui aparecem os torneios do fim de semana. As inscrições vão até sexta. Cada card mostra o nível, o nível dos adversários (OVR), quanto o campeão ganha em dinheiro e pontos e quanto custa (inscrição + viagem). Torneio marcado "acima do seu nível" tem adversários bem mais fortes.' },
  { tab: 'agenda', sel: '.cr-week', t: 'A semana', b: 'Cada dia mostra o que você fez. Hoje fica destacado. O torneio acontece no sábado (no profissional, sábado e domingo).' },
  { tab: 'agenda', sel: '.cr-goal', t: 'Meta da temporada', b: 'Escolha uma meta no começo da temporada. Cumprida até o fim do ano, ela dá dinheiro, pontos de evolução e fama.' },
  { tab: 'agenda', sel: '.cr-acts', t: 'O que fazer hoje', b: 'Treinar dá pontos de evolução (gasta energia e um pouco de dinheiro). O treino com desafio é jogado na quadra: evolução por acerto e um pouco de potencial. Dar aulas rende dinheiro. Descansar recupera energia. "Dias automáticos" treina e descansa por você até o torneio, chegando inteiro.' },
  { tab: 'agenda', sel: '.cr-ladder', t: 'Categorias', b: 'Amador C, B e A, depois ITF BT10, BT50, BT100, BT200, BT400, Sand Series e o Mundial. Cada categoria libera com pontos no ranking ou com um título na categoria de baixo.' },
  { tab: 'calendario', sel: '.yr-grid', t: 'Calendário', b: 'O ano inteiro: cada semana mostra os níveis que têm torneio (pelas cores). As semanas com contorno são as que você pode jogar. Use para planejar quando descansar e quando ir para os torneios grandes.' },
  { tab: 'jogador', sel: '.cr-bars', t: 'Atributos', b: 'Gaste pontos de evolução no "+" de cada atributo. O custo sobe conforme o atributo fica alto, e o overall não passa do potencial. Os números em verde e vermelho são o efeito da raquete e dos equipamentos.' },
  { tab: 'parceiros', sel: '#crBody', t: 'Dupla', b: 'Na dupla, o parceiro faz muita diferença. Jogadores melhores só aceitam jogar com você quando você tem nível (ranking e overall) parecido. A química cresce jogando juntos e dá bônus.' },
  { tab: 'ajustes', sel: '.cr-set', t: 'Ajustes', b: 'Partidas de 4 ou 6 games, seu lado na dupla, estado e nacionalidade. Para mudar a aparência e o uniforme, use "Editar jogador" na aba Atributos.' },
  { tab: 'loja', sel: '.cr-shop-tabs', t: 'Loja', b: 'Raquetes (com filtros e a comparação com a sua), equipe técnica e equipamentos (bônus nos atributos), e roupas. Peças exclusivas pedem ranking, títulos ou fama.' },
  { tab: 'ranking', sel: '#crBody', t: 'Ranking', b: 'Conta a soma dos seus 10 melhores resultados das últimas 52 semanas: cada resultado vale por um ano e depois sai da conta. "Meus pontos" mostra quais contam e quando saem. O botão "Minha posição" leva até você na lista.' },
  { tab: 'patrocinio', sel: '#crBody', t: 'Patrocínios', b: 'Com fama e bons resultados chegam ofertas de patrocínio (dinheiro por semana e bônus por título). O patrocínio master dá raquete própria e torneios com a marca dele.' },
  { tab: 'negocios', sel: '#crBody', t: 'Negócios', b: 'Invista o dinheiro em negócios (marca própria, coleção com o patrocinador, quadra de beach…) para ter renda toda semana e outros benefícios, como treinar de graça na sua quadra.' },
  { tab: 'historico', sel: '#crBody', t: 'Histórico e troféus', b: 'Todos os seus torneios e resultados, e na sub-aba Troféus as conquistas da carreira.' },
  { sel: '.cr-topbtns', t: 'Salvar', b: 'A carreira salva sozinha neste navegador. Com uma conta (☁️ Nuvem) ela fica salva também na nuvem e abre em outros aparelhos. "Exportar save" baixa um arquivo de backup. Este tutorial fica no botão ❓ Tutorial.' },
  { tab: 'agenda', t: 'Pronto!', b: 'Para começar: escolha a meta da temporada, treine durante a semana e se inscreva num torneio do seu nível até sexta. Boa sorte no circuito!' },
];
const GD = { i: -1, el: null, box: null };
function guideStart() { if (!$s.CR) return; GD.i = 0; guideShow(); }
function guideEnd() {
  if (GD.box) GD.box.hidden = true; if (GD.el) GD.el.classList.remove('crt-hl'); GD.el = null; GD.i = -1;
  if ($s.CR && !$s.CR.tutSeen) { $s.CR.tutSeen = 1; saveCareer(); }
  crTab = 'agenda'; renderCareer();
}
function guideShow() {
  const st = GUIDE[GD.i]; if (!st) { guideEnd(); return; }
  if (st.tab && crTab !== st.tab) { crTab = st.tab; renderCareer(); }
  guidePaint();
}
// desenha o destaque e a caixa (renderCareer recria a tela, então repinta depois de cada desenho)
function guidePaint() {
  const st = GUIDE[GD.i]; if (!st) return;
  if (GD.el) GD.el.classList.remove('crt-hl');
  GD.el = st.sel ? document.querySelector('#career ' + st.sel) : null;
  if (GD.el) { GD.el.classList.add('crt-hl'); GD.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  if (!GD.box) {
    const b = document.createElement('div'); b.id = 'crGuide'; b.className = 'crt-box';
    b.innerHTML = '<div class="crt-n"></div><b class="crt-t"></b><p class="crt-b"></p><div class="cta-row"><button type="button" class="ghost sm" data-gd="skip">Pular tutorial</button><span class="crt-sp"></span><button type="button" class="ghost sm" data-gd="prev">Voltar</button><button type="button" class="cta sm" data-gd="next">Próximo</button></div>';
    document.body.append(b); GD.box = b;
    b.addEventListener('click', e => { const a = e.target.closest('[data-gd]'); if (!a) return; const k = a.dataset.gd;
      if (k === 'skip') guideEnd(); else if (k === 'prev') { GD.i = Math.max(0, GD.i - 1); guideShow(); } else { GD.i++; guideShow(); } });
  }
  const B = GD.box; B.hidden = false;
  B.querySelector('.crt-n').textContent = 'Tutorial da carreira · ' + (GD.i + 1) + ' de ' + GUIDE.length;
  B.querySelector('.crt-t').textContent = st.t; B.querySelector('.crt-b').textContent = st.b;
  B.querySelector('[data-gd=prev]').hidden = GD.i === 0;
  B.querySelector('[data-gd=next]').textContent = GD.i === GUIDE.length - 1 ? 'Começar' : 'Próximo';
  // a caixa fica embaixo; se o destaque estiver na metade de baixo, vai para cima
  setTimeout(() => { const r = GD.el && GD.el.getBoundingClientRect(); B.classList.toggle('top', !!r && (r.top + r.bottom) / 2 > innerHeight * .55); }, 380);
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
// conta na nuvem (Supabase): entrar/criar conta, status do salvamento e carreiras salvas online
let clRows = null, clBusy = false;
async function clRefresh() { if (!CL.sess) { clRows = null; return; } try { clRows = await clList(); } catch (e) { clRows = []; CL.msg = 'Nuvem: ' + e.message; } renderCloud(); }
function renderCloud() {
  const box = $('crCloud'), list = $('crCloudList'); if (!box) return;
  const note = t => '<p class="cr-note cr-wrap">' + esc(t) + '</p>';
  if (!CL.sess) {
    box.innerHTML = '<div class="cr-cloud-in"><b>Entrar ou criar conta</b><span>Com uma conta, as carreiras vão para a nuvem sozinhas e abrem em qualquer aparelho.</span>'
      + '<div class="cr-login"><input id="clEmail" class="cr-sel" type="email" placeholder="e-mail" autocomplete="email"><input id="clPw" class="cr-sel" type="password" placeholder="senha (mín. 6)" autocomplete="current-password"></div>'
      + '<div class="cta-row"><button class="cta sm" id="clIn" type="button">Entrar</button><button class="ghost sm" id="clUp" type="button">Criar conta</button><button class="ghost sm" id="clForgot" type="button">Esqueci a senha</button></div>'
      + (CL.msg ? note(CL.msg) : '') + '</div>';
    if (list) list.innerHTML = note('Entre na sua conta (aba Conta) para ver e baixar as carreiras salvas na nuvem.');
    const go = async (fn, up) => {
      const em = $('clEmail').value.trim(), pw = $('clPw').value;
      if (!em || pw.length < 6) { CL.msg = 'Preencha o e-mail e uma senha de pelo menos 6 caracteres.'; renderCloud(); return; }
      if (clBusy) return; clBusy = true; CL.msg = up ? 'Criando a conta…' : 'Entrando…'; renderCloud();
      try { const r = await fn(em, pw); CL.msg = r === 'confirm' ? 'Conta criada! Confirme o e-mail pelo link enviado e depois clique em Entrar.' : 'Conectado. Suas carreiras deste navegador já estão na nuvem.'; if (r !== 'confirm') { crEntry = 'load'; } }
      catch (e) { CL.msg = e.message; }
      clBusy = false; renderCareer(); clRefresh();
    };
    $('clIn').addEventListener('click', () => go(clSignIn)); $('clUp').addEventListener('click', () => go(clSignUp, true));
    $('clForgot').addEventListener('click', async () => {
      const em = $('clEmail').value.trim(); if (!em) { CL.msg = 'Digite o seu e-mail e clique em "Esqueci a senha".'; renderCloud(); return; }
      try { await clRecover(em); CL.msg = 'Se houver uma conta com ' + em + ', chegou um e-mail com o link para criar uma nova senha (veja também o spam).'; }
      catch (e) { CL.msg = 'Não consegui enviar: ' + e.message; }
      renderCloud();
    });
    return;
  }
  box.innerHTML = '<div class="cr-cloud-in"><b>Conectado: ' + esc(CL.sess.email || '') + '</b><span>As carreiras sobem para a nuvem sozinhas a cada save.</span>' + (CL.msg ? note(CL.msg) : '')
    + '<div class="cta-row"><button class="ghost sm" id="clSync" type="button">Sincronizar agora</button><button class="ghost sm" id="clOut" type="button">Sair da conta</button></div></div>';
  $('clOut').addEventListener('click', () => { clSignOut(); clRows = null; renderCareer(); });
  $('clSync').addEventListener('click', async () => { CL.msg = 'Sincronizando…'; renderCloud(); await clSyncAll(); await clRefresh(); });
  if (!list) return;
  const rows = clRows || [];
  list.innerHTML = clRows === null ? note('Carregando as carreiras da nuvem…') : rows.length ? rows.map(r => {
      const lt = clLocalTime(r.id), ct = clTime(r.updated_at), here = lt > 0, newer = ct > lt + 1000;
      return '<div class="cr-slot"><div class="who"><b>' + esc(r.name || r.id) + '</b><span>T' + (r.season || 1) + ' S' + (r.week || 1) + fmtDate(r.updated_at) + (here ? (newer ? ' · mais nova que a deste aparelho' : ' · já está neste aparelho') : ' · não está neste aparelho') + '</span></div>'
        + '<div class="acts"><button class="' + (newer || !here ? 'cta' : 'ghost') + ' sm" data-cl-pull="' + esc(r.id) + '">' + (here ? 'Usar a da nuvem' : 'Baixar e continuar') + '</button><button class="ghost sm" data-cl-del="' + esc(r.id) + '">Apagar da nuvem</button></div></div>'; }).join('')
    : note('Nenhuma carreira na nuvem ainda: elas sobem sozinhas quando você joga conectado.');
  list.querySelectorAll('[data-cl-pull]').forEach(b => b.addEventListener('click', async () => {
    const id = b.dataset.clPull, r = rows.find(x => x.id === id), lt = clLocalTime(id);
    if (lt && r && clTime(r.updated_at) + 1000 < lt && !confirm('A versão deste aparelho é mais nova que a da nuvem. Substituir pela da nuvem mesmo assim?')) return;
    b.disabled = true; b.textContent = 'Baixando…';
    try { const cid = await clPull(id); if (crLoadSlot(cid)) { crTab = 'agenda'; $s.CR.lastMsg = 'Carreira baixada da nuvem.'; } renderCareer(); }
    catch (e) { CL.msg = 'Falha ao baixar: ' + e.message; renderCloud(); }
  }));
  list.querySelectorAll('[data-cl-del]').forEach(b => b.addEventListener('click', async () => {
    if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Confirmar'; return; }
    try { await clRemove(b.dataset.clDel); CL.msg = 'Apagada da nuvem (a deste aparelho continua).'; } catch (e) { CL.msg = 'Falha ao apagar: ' + e.message; }
    clRefresh();
  }));
}
// configurações vindas da conta (outro aparelho): atualiza o menu, a barra, os nomes e a câmera
CL.onPrefs = () => { try { syncMenu(); applyMeterLook(); applyCam(); } catch (e) {} CL.msg = 'Configurações da sua conta aplicadas.'; if (CL.onChange) CL.onChange(); };
// conta no menu principal: usa o mesmo quadro (move o elemento para a janela da conta e devolve ao fechar)
const acctBtnTxt = () => { const b = $('btnAcct'); if (b) b.textContent = CL.sess ? '👤 ' + (CL.sess.email || 'Conta') : '👤 Conta'; };
$('btnAcct').addEventListener('click', () => { $('acctSlot').appendChild($('crCloud')); renderCloud(); $('acctOv').hidden = false; });
$('acctClose').addEventListener('click', () => { $('acctOv').hidden = true; $('crAccount').appendChild($('crCloud')); acctBtnTxt(); });
// login automático: a sessão fica guardada neste navegador; ao abrir o jogo ela é renovada e as carreiras/configurações sincronizam
if (CL.sess) CL.syncP = clSyncAll().then(() => acctBtnTxt());
CL.onPulled = () => { if (!$('career').hidden) renderCareer(); }; // a carreira aberta foi trocada pela da nuvem
acctBtnTxt();
CL.onChange = () => { acctBtnTxt(); if (!$('crSaves').hidden || !$('crAccount').hidden || !$('acctOv').hidden) { renderCloud(); if (CL.sess && /^Salvo/.test(CL.msg)) clRefresh(); } };
function renderSaves() {
  renderCloud(); if (CL.sess && clRows === null) clRefresh();
  const list = crSlots();
  $('crSlotList').innerHTML = list.length ? list.map(c => '<div class="cr-slot"><div class="who"><b>' + esc(c.name) + ' · OVR ' + c.ovr + '</b><span>T' + c.season + ' S' + c.week + ' · ' + c.tier + ' · ' + money(c.money) + fmtDate(c.savedAt) + '</span></div>'
    + '<div class="acts"><button class="cta sm" data-slot-load="' + esc(c.id) + '">Continuar</button><button class="ghost sm" data-slot-exp="' + esc(c.id) + '">Exportar</button><button class="ghost sm" data-slot-del="' + esc(c.id) + '">Apagar</button></div></div>').join('')
    : '<p class="cr-note cr-wrap">Nenhuma carreira salva neste navegador. Crie uma na aba Criar carreira, baixe da nuvem ou importe um arquivo.</p>';
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
  const box = $('crRepoList'); box.hidden = false; box.innerHTML = '<p class="cr-note cr-wrap">Procurando saves em github.com/' + SAVE_REPO + '/' + SAVE_DIR + ' …</p>';
  try {
    const files = await crRepoSaves();
    box.innerHTML = files.length ? files.map((f, i) => '<div class="cr-slot"><div class="who"><b>' + esc(f.name) + '</b><span>pasta ' + SAVE_DIR + '/ do repositório</span></div><div class="acts"><button class="cta sm" data-repo="' + i + '">Carregar</button></div></div>').join('')
      : '<p class="cr-note cr-wrap">Nenhum save na pasta ' + SAVE_DIR + '/ do repositório ainda.</p>';
    box.querySelectorAll('[data-repo]').forEach(b => b.addEventListener('click', async () => { b.disabled = true; try { crAfterImport(await crImportUrl(files[+b.dataset.repo].url)); } catch (err) { crSaveMsg('Falha ao baixar: ' + err.message); b.disabled = false; } }));
  } catch (err) { box.innerHTML = '<p class="cr-note cr-wrap">Não consegui acessar o GitHub (' + esc(err.message) + '). Sem internet? Use "Importar arquivo".</p>'; }
});
$('crExport').addEventListener('click', () => { saveCareer(); const fn = crDownload(); if (fn) { $s.CR.lastMsg = 'Save baixado: ' + fn + '. Coloque na pasta ' + SAVE_DIR + '/ do repositório e faça o push para abrir em outro lugar.'; renderCareer(); } });
$('crSwitch').addEventListener('click', () => { saveCareer(); crCloseSlot(); crEntry = 'load'; crSaveMsg(''); renderCareer(); });
// botão da nuvem: abre a lista de carreiras com a conta no topo (logado, a carreira já sobe sozinha)
$('crCloudBtn').addEventListener('click', () => { saveCareer(); if (CL.sess) clFlush(); crCloseSlot(); crEntry = CL.sess ? 'load' : 'conta'; crSaveMsg(''); renderCareer(); const c = $('crCloud'); if (c) c.scrollIntoView({ block: 'start' }); });
// criação
const crForm = { fem: false, style: 'completo', perfil: 'promessa', skin: SKINS[2], hair: HAIRS[1], acc: 'cap', canhoto: false, alt: 182, attrs: null, key: '' };
// atributos na criação: o estilo distribui os pontos; dá para mexer com − e + (o total não passa o do estilo)
const crRadio = n => { const i = document.querySelector('input[name=' + n + ']:checked'); return i ? i.value : null; };
function renderCrAttrs(reset) {
  const box = $('crAttrs'); if (!box) return;
  const style = crRadio('crStyle') || 'completo', perfil = crRadio('crPerfil') || 'promessa', start = +($('crStart') ? $('crStart').value : 0) || 0;
  const target = crStartTarget(perfil, start), key = style + '|' + target, base = crPresetAttrs(target, style);
  if (reset || !crForm.attrs || crForm.key !== key) { crForm.attrs = Object.assign({}, base); crForm.key = key; }
  const sum = a => ATTRS.reduce((t, [k]) => t + a[k], 0), free = sum(base) - sum(crForm.attrs), lo = Math.max(30, target - 15), hi = target + 15;
  box.innerHTML = '<div class="cra-head"><b>Overall ' + overall(crForm.attrs) + '</b><span>' + (free > 0 ? free + (free > 1 ? ' pontos livres' : ' ponto livre') : 'todos os pontos usados') + '</span><button type="button" class="ghost sm" id="craReset">Voltar ao estilo</button></div>'
    + ATTRS.map(([k, nm]) => { const v = crForm.attrs[k], d = v - base[k];
      return '<div class="cra-row"><span>' + nm + '</span><button type="button" class="ghost sm" data-cra="' + k + '" data-d="-1"' + (v <= lo ? ' disabled' : '') + '>−</button><span class="cra-bar"><i style="width:' + Math.round((v - 30) / 69 * 100) + '%"></i></span><b>' + v + (d ? '<small class="' + (d > 0 ? 'up' : 'dn') + '">' + (d > 0 ? '+' : '') + d + '</small>' : '') + '</b><button type="button" class="ghost sm" data-cra="' + k + '" data-d="1"' + (v >= hi || free <= 0 ? ' disabled' : '') + '>+</button></div>'; }).join('');
  box.querySelectorAll('[data-cra]').forEach(b => b.addEventListener('click', () => { crForm.attrs[b.dataset.cra] += +b.dataset.d; renderCrAttrs(); }));
  $('craReset').addEventListener('click', () => renderCrAttrs(true));
}
document.querySelectorAll('input[name=crStyle], input[name=crPerfil]').forEach(r => r.addEventListener('change', () => renderCrAttrs(true)));
if ($('crStart')) $('crStart').addEventListener('change', () => renderCrAttrs(true));
// criar carreira em etapas: identidade → aparência → começo → estilo e atributos
let crnStep = 1;
function crnShow(n) {
  crnStep = Math.max(1, Math.min(4, n));
  document.querySelectorAll('#crNew [data-crn]').forEach(x => { x.hidden = +x.dataset.crn !== crnStep; });
  document.querySelectorAll('#crNew [data-crn-go]').forEach(x => { x.classList.toggle('sel', +x.dataset.crnGo === crnStep); x.classList.toggle('done', +x.dataset.crnGo < crnStep); });
  $('crnPrev').hidden = crnStep === 1; $('crnNext').hidden = crnStep === 4; $('crCreate').hidden = crnStep !== 4;
  if (crnStep === 4) renderCrAttrs();
  const c = document.querySelector('#career'); if (c) c.scrollTop = 0;
}
document.querySelectorAll('#crNew [data-crn-go]').forEach(b => b.addEventListener('click', () => crnShow(+b.dataset.crnGo)));
$('crnPrev').addEventListener('click', () => crnShow(crnStep - 1));
$('crnNext').addEventListener('click', () => crnShow(crnStep + 1));
function renderCrNew() {
  const sw = (arr, key) => arr.map(c => '<button type="button" class="cr-sw' + (crForm[key] === c ? ' sel' : '') + '" data-' + key + '="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>').join('');
  $('crSw').innerHTML = '<div><span class="cr-lbl">Pele</span>' + sw(SKINS, 'skin') + '</div><div><span class="cr-lbl">Cabelo</span>' + sw(HAIRS, 'hair') + '</div>';
  $('crSw').querySelectorAll('[data-skin]').forEach(b => b.addEventListener('click', () => { crForm.skin = b.dataset.skin; renderCrNew(); }));
  $('crSw').querySelectorAll('[data-hair]').forEach(b => b.addEventListener('click', () => { crForm.hair = b.dataset.hair; renderCrNew(); }));
  $('crAltV').textContent = crForm.alt + ' cm';
  renderCrAttrs();
}
function crStart() {
  const v = n => { const i = document.querySelector('input[name=' + n + ']:checked'); return i ? i.value : null; };
  crForm.fem = v('crGen') === 'f'; crForm.style = v('crStyle') || 'completo'; crForm.perfil = v('crPerfil') || 'promessa'; crForm.acc = v('crAcc') || 'cap'; crForm.canhoto = v('crHand') === 'c';
  crCreate({ uf: $('crUf') ? $('crUf').value : 'SP', hairStyle: $('crHairSt').value || '', beard: $('crBeard').value || '', build: $('crBuild') ? $('crBuild').value : 'atletico', pais: $('crNat').value || 'BRA', name: ($('crName').value || '').trim() || 'Promessa', fem: crForm.fem, alt: crForm.alt, style: crForm.style, perfil: crForm.perfil, attrs: crForm.attrs, start: +($('crStart') ? $('crStart').value : 0) || 0, skin: crForm.skin, hair: crForm.hair, acc: crForm.acc, canhoto: crForm.canhoto, glasses: Math.random() < .5 });
  crTab = 'agenda'; $s.CR.lastMsg = 'Bem-vindo ao circuito! Comece pelo ' + TIERS[$s.CR.startTier || 0].nome + ', ache um parceiro e suba no ranking.'; saveCareer(); renderCareer(); setTimeout(guideStart, 400);
}
// pelo menu principal sempre abre a tela de escolher/criar (a carreira aberta é salva e fechada); a volta de uma partida continua indo direto
$('btnCareer').addEventListener('click', () => { if ($s.CR) { saveCareer(); crCloseSlot(); } crEntry = null; crSaveMsg(''); openCareer(); });
$('crBack').addEventListener('click', () => { if (GD.i >= 0) guideEnd(); $('career').hidden = true; toMenu(); });
$('crGuideBtn').addEventListener('click', guideStart);
$('crCreate').addEventListener('click', crStart);
$('crNat').innerHTML = COUNTRIES.map(c => '<option value="' + c.code + '"' + (c.code === 'BRA' ? ' selected' : '') + '>' + c.nome + '</option>').join('');
const natFlag = () => { $('crNatFlag').innerHTML = flagSVG($('crNat').value); const uw = $('crUfWrap'); if (uw) uw.hidden = $('crNat').value !== 'BRA'; };
$('crUf').innerHTML = STATES.map(([k, n]) => '<option value="' + k + '">' + n + '</option>').join('');
$('crNat').addEventListener('change', natFlag); natFlag();
$('crAlt').addEventListener('input', e => { crForm.alt = +e.target.value; $('crAltV').textContent = crForm.alt + ' cm'; });
document.querySelectorAll('input[name=crGen]').forEach(r => r.addEventListener('change', () => { const f = r.value === 'f'; crForm.alt = f ? 168 : 182; $('crAlt').value = crForm.alt; $('crAltV').textContent = crForm.alt + ' cm'; }));
document.querySelectorAll('#crTabs button').forEach(b => b.addEventListener('click', () => { if (crGroupOf(crTab) !== b.dataset.g) crTab = CR_GROUPS[b.dataset.g][0][0]; $s.CR.lastMsg = ''; renderCareer(); }));
$('btnOverCareer').addEventListener('click', () => { el.over.hidden = true; openCareer(); });
if ($s.CR) { crMigrate(); crSyncChars(); }
// lista de raquetes do menu principal
function rkInfo() {
  const r = RACKET_STATS[$('rkSel').value]; if (!r) return;
  $('rkInfo').innerHTML = esc(r.desc) + ' ' + Object.entries(r.b).map(([a, v]) => '<em class="' + (v > 0 ? 'up' : 'dn') + '">' + (v > 0 ? '+' : '') + v + ' ' + ATTRS.find(x => x[0] === a)[1] + '</em>').join(' ');
}
$('rkSel').innerHTML = Object.entries(RACKET_STATS).sort((x, y) => x[1].preco - y[1].preco).map(([k, r]) => '<option value="' + k + '" title="' + rkSummary(k) + '">' + r.nome + ' · ' + rkKind(r.b)[1] + '</option>').join('');
$('rkSel').addEventListener('change', () => { rkInfo(); readMenu(); });
function startFromMenu() { ac(); readMenu(); newMatch(); }
function toMenu() {
  if (NET.role && NET.onMenu) { NET.onMenu(); return; } // online: volta para a sala, não para o menu
  if (S.careerActive) careerMatchEnded(false); // abandonar conta como derrota
  S.mode = 'menu'; S.paused = false; el.pause.hidden = true; el.over.hidden = true; el.menu.hidden = false;
  document.body.classList.add('in-menu'); hideBanner(); syncMenu(); menuStep('home');
}
// menu: início (blocos) → partida rápida (uma tela só) → começar; Configurações volta para a tela de onde veio
let menuPrev = 'home';
function qmDupla() {
  const m = $('menu'), dupla = (m.querySelector('input[name=mode]:checked') || {}).value === 'dupla';
  const side = m.querySelector('input[name=side]'), tac = $('tacticSel'), fsel = $('formSel');
  if (side) side.closest('fieldset').hidden = !dupla;
  if (tac) tac.closest('label').hidden = !dupla; if (fsel) fsel.closest('label').hidden = !dupla;
}
document.querySelectorAll('#menu input[name=mode]').forEach(r => r.addEventListener('change', qmDupla));
// 2 jogadores no mesmo PC: explica quem usa o quê e avisa se não há controle conectado
function qmLocal2() {
  const v = (document.querySelector('#menu input[name=local2]:checked') || {}).value, n = $('local2Note'); if (!n) return;
  const pad = navigator.getGamepads && [...navigator.getGamepads()].some(g => g && g.connected);
  n.hidden = !v; n.classList.toggle('warn', !!v && !pad);
  n.textContent = (v === 'coop' ? 'Juntos: o jogador 2 é a sua dupla (na simples, vira um contra o outro).' : 'Contra: o jogador 2 fica do outro lado da rede (na dupla, com a CPU de parceira).') + ' Jogador 1 no teclado, jogador 2 no controle (Xbox/PS).' + (pad ? '' : ' Nenhum controle conectado: conecte um e aperte um botão.');
}
document.querySelectorAll('#menu input[name=local2]').forEach(r => r.addEventListener('change', qmLocal2));
addEventListener('gamepadconnected', qmLocal2); addEventListener('gamepaddisconnected', qmLocal2);
function menuStep(st) {
  const m = $('menu');
  if (st === 'back') st = menuPrev; else if (st === 'cfg' && m.dataset.step !== 'cfg' && m.dataset.step !== 'keys') menuPrev = m.dataset.step || 'home';
  m.dataset.step = st;
  m.querySelectorAll('section[data-step]').forEach(sec => { sec.hidden = sec.dataset.step !== st; });
  readMenu(); syncMenu(); qmDupla(); qmLocal2();
  m.scrollTop = 0;
}
// configurações em abas
document.querySelectorAll('#menu [data-cfgt]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('#menu [data-cfgt]').forEach(x => x.classList.toggle('sel', x === b));
  document.querySelectorAll('#menu [data-cfgp]').forEach(x => { x.hidden = x.dataset.cfgp !== b.dataset.cfgt; });
}));
document.querySelectorAll('#menu [data-goto]').forEach(b => b.addEventListener('click', () => { ac(); menuStep(b.dataset.goto); }));
// configurações: aplicar confirma e já mostra (gráficos, jogadores realista/desenhado, roupa, raquete)
$('cfgApply').addEventListener('click', () => {
  ac(); readMenu(); syncMenu();
  try { applyGfx(); assignCharacters(); applyRackets(); applyPlayerStyle(); } catch (e) {}
  const b = $('cfgApply'); b.textContent = '✓ Aplicado'; clearTimeout(b._t); b._t = setTimeout(() => { b.textContent = 'Aplicar'; }, 2500);
});
$('btnStart').addEventListener('click', startFromMenu);
// treino com desafios (menu): sem recompensa, só para praticar
let drillFromCareer = null;
$('btnDrill').addEventListener('click', () => { drillFromCareer = null; el.menu.hidden = true; $('drillPick').hidden = false; drillInfo(); });
$('drillBack').addEventListener('click', () => { $('drillPick').hidden = true; if (drillFromCareer) openCareer(); else el.menu.hidden = false; });
// nível do desafio: mostra a meta de cada treino e (na carreira) quanto rende
const drillLvl = () => { const i = document.querySelector('input[name=drillLvl]:checked'); return i ? +i.value : 1; };
function drillInfo() {
  const L = DRILL_LVL[drillLvl()];
  document.querySelectorAll('[data-drill]').forEach(b => { b.textContent = DRILLS[b.dataset.drill].nome + ' · ' + L.goal[b.dataset.drill] + ' de ' + DRILLS[b.dataset.drill].max; });
  $('drillInfo').textContent = drillFromCareer ? 'Recompensa na carreira: ×' + String(L.rew).replace('.', ',') + ' (pontos de evolução e potencial ao cumprir a meta).' : 'Mais difícil: meta maior e bolas mais rápidas e abertas.';
}
document.querySelectorAll('input[name=drillLvl]').forEach(r => r.addEventListener('change', drillInfo));
document.querySelectorAll('[data-drill]').forEach(b => b.addEventListener('click', () => {
  $('drillPick').hidden = true; ac(); readMenu(); const lvl = drillLvl(), rew = DRILL_LVL[lvl].rew;
  const cr = drillFromCareer; S.careerDrill = !!cr;
  if (cr) { const prev = { pick: Object.assign({}, S.settings.pick), mode: S.settings.mode }; S.settings.pick = Object.assign({}, S.settings.pick, { me: 'crme' }); S.careerActive = false;
    startDrill(b.dataset.drill, (ok, pass) => { Object.assign(S.settings, prev); const g = crDrillReward(ok, pass, rew); $('stTable').innerHTML += '<p class="cr-note">Carreira: +' + g + ' pontos de evolução' + (pass ? ' e um pouco de potencial' : '') + '.</p>'; }, lvl); }
  else startDrill(b.dataset.drill, null, lvl);
}));
$('btnAgain').addEventListener('click', e => { if (S.lastDrill && $('overEyebrow').textContent.startsWith('Treino')) { e.stopImmediatePropagation(); el.over.hidden = true; startDrill(S.lastDrill, null, S.lastDrillLvl); } }, true);
// ---------- tutorial: lições em ordem (os treinos no nível fácil) com medalha ----------
const TUT = [
  { kind: 'saque', t: 'Saque', how: ['Segure o golpe para lançar a bola e <b>solte quando o marcador estiver na faixa verde</b>.', '<b>J</b> saque forte (smash) · <b>K</b> alto · <b>L</b> curto · <b>Espaço</b> seguro (por baixo).', 'No controle: <b>X</b> smash, <b>Y</b> lob, <b>B</b> curta, <b>LT</b> defesa.', 'Meta: saques bons dentro da quadra.'] },
  { kind: 'defesa', t: 'Defesa', how: ['O lançador vai mandar smashes em você.', 'Corra com <b>WASD</b> (ou as setas) até a bola e aperte <b>Espaço</b> quando o anel no chão ficar <b>verde</b>.', 'Cedo ou tarde demais a bola sobe ou espirra.', 'Meta: defesas que passam e ficam dentro.'] },
  { kind: 'curtas', t: 'Curta', how: ['A curta é um toque que morre perto da rede: ótima quando o adversário está no fundo.', 'Aperte <b>L</b> no tempo verde. Na hora do golpe, <b>S</b> deixa mais curta e <b>A/D</b> escolhem o lado.', 'Meta: curtas boas (amarelas valem; verdes são matadoras).'] },
  { kind: 'smash', t: 'Smash', how: ['Bola alta perto da rede é hora de finalizar.', 'Segure <b>J</b>: a barra enche; <b>solte na faixa verde</b> para o smash perfeito.', 'Perto da rede (até os 3 m) o smash vira finalização: muito mais difícil de defender.', 'Meta: smashes perfeitos.'] },
  { kind: 'ataque', t: 'Curta e smash', how: ['Duas bolas seguidas: primeiro uma <b>curta</b> (L), depois um <b>smash</b> (J) na bola que volta alta.', 'A sequência só vale se as duas saírem certas.'] },
  { kind: 'contra', t: 'Defesa e contra-ataque', how: ['Defenda o smash (<b>Espaço</b> no verde) e, na bola seguinte, ataque com <b>smash</b> (J).', 'É o ritmo de um ponto de verdade: segurar e virar o jogo.'] },
];
const TUT_MED = ['', '🥉', '🥈', '🥇'], TUT_NOME = ['—', 'bronze', 'prata', 'ouro'];
let tutMed = {}; try { tutMed = JSON.parse(localStorage.getItem('pdo-tutorial') || '{}'); } catch (e) {}
// medalha: bronze = cumpriu a meta; prata = metade do caminho entre a meta e o total; ouro = quase todas
function tutMedal(ok, goal, max) { if (ok < goal) return 0; if (ok >= max - 1) return 3; return ok >= goal + Math.ceil((max - goal) / 2) ? 2 : 1; }
function renderTut() {
  $('tutList').innerHTML = TUT.map((l, i) => {
    const m = tutMed[l.kind] || 0, open = i === 0 || (tutMed[TUT[i - 1].kind] || 0) > 0 || m > 0;
    return '<button type="button" class="tut-item' + (open ? '' : ' lock') + '" data-tut="' + i + '"' + (open ? '' : ' disabled') + '><span class="tut-n">' + (i + 1) + '</span><span class="tut-t"><b>' + l.t + '</b><small>' + (open ? (m ? 'Medalha de ' + TUT_NOME[m] + (m < 3 ? ' · tente o ouro' : '') : 'Não feita') : '🔒 Faça a lição anterior') + '</small></span><span class="tut-m">' + (TUT_MED[m] || '') + '</span></button>';
  }).join('') + '<p class="cr-note">Medalha: 🥉 cumprir a meta · 🥈 passar bem da meta · 🥇 acertar quase todas.</p>';
}
let tutCur = -1;
function tutShowHow(i) {
  const l = TUT[i]; tutCur = i;
  $('tutHowN').textContent = 'Lição ' + (i + 1) + ' de ' + TUT.length; $('tutHowT').textContent = l.t.toUpperCase();
  const G = DRILL_LVL[0].goal[l.kind], M = DRILLS[l.kind].max;
  $('tutHowB').innerHTML = l.how.map(x => '<p>' + x + '</p>').join('') + '<p class="cr-note">Meta: ' + G + ' de ' + M + ' bolas (🥉 ' + G + ' · 🥈 ' + (G + Math.ceil((M - G) / 2)) + ' · 🥇 ' + (M - 1) + ').</p>';
  $('tutPick').hidden = true; $('tutHow').hidden = false;
}
function tutStart() {
  const i = tutCur, l = TUT[i]; if (!l) return;
  $('tutHow').hidden = true; ac(); readMenu(); S.careerDrill = false; S.tutPending = true;
  startDrill(l.kind, (ok, pass) => {
    const m = tutMedal(ok, DRILL_LVL[0].goal[l.kind], DRILLS[l.kind].max), best = Math.max(m, tutMed[l.kind] || 0);
    tutMed[l.kind] = best; try { localStorage.setItem('pdo-tutorial', JSON.stringify(tutMed)); } catch (e) {}
    $('overEyebrow').textContent = 'Tutorial · lição ' + (i + 1) + ' · ' + l.t;
    $('overTitle').textContent = m ? 'MEDALHA DE ' + TUT_NOME[m].toUpperCase() + ' ' + TUT_MED[m] : 'QUASE LÁ';
    const nx = TUT[i + 1];
    $('stTable').innerHTML += '<div class="cta-row" style="margin-top:10px">' + (m && nx ? '<button type="button" class="cta" data-tutnext="' + (i + 1) + '">Próxima lição: ' + nx.t + '</button>' : '') + '<button type="button" class="ghost sm" data-tutagain="' + i + '">' + (m ? 'Tentar ' + (m < 3 ? 'medalha melhor' : 'de novo') : 'Tentar de novo') + '</button><button type="button" class="ghost sm" data-tutlist="1">Lições</button></div>';
    $('btnOverCareer').hidden = true; $('btnAgain').hidden = true;
  }, 0);
}
$('btnTut').addEventListener('click', () => { el.menu.hidden = true; renderTut(); $('tutPick').hidden = false; });
$('tutBack').addEventListener('click', () => { $('tutPick').hidden = true; el.menu.hidden = false; });
$('tutHowBack').addEventListener('click', () => { $('tutHow').hidden = true; renderTut(); $('tutPick').hidden = false; });
$('tutGo').addEventListener('click', tutStart);
$('tutList').addEventListener('click', e => { const b = e.target.closest('[data-tut]'); if (b && !b.disabled) tutShowHow(+b.dataset.tut); });
$('stTable').addEventListener('click', e => {
  const n = e.target.closest('[data-tutnext]'), a = e.target.closest('[data-tutagain]'), l = e.target.closest('[data-tutlist]');
  if (!n && !a && !l) return;
  el.over.hidden = true; S.mode = 'menu';
  if (n) tutShowHow(+n.dataset.tutnext); else if (a) tutShowHow(+a.dataset.tutagain); else { renderTut(); $('tutPick').hidden = false; }
});
function openDrillFromCareer() { drillFromCareer = true; $('career').hidden = true; $('drillPick').hidden = false; drillInfo(); }
// barra de química com o parceiro atual
function chemBar() {
  const v = crChem(), lv = crChemLv(), nx = [20, 50, 80, 100][lv];
  return '<div class="cr-energy"><span>Química</span><span class="bar"><i class="' + (lv >= 2 ? 'hi' : '') + '" style="width:' + v + '%"></i></span><b>' + v + '</b></div>'
    + '<p class="cr-note"><b>' + CHEM_NOME[lv] + '</b>' + (lv >= 2 ? ' · em jogo: +' + (lv - 1) + ' em todos os atributos para vocês dois e o parceiro reage mais rápido' : lv === 1 ? ' · o parceiro já reage um pouco mais rápido' : '') + (lv < 3 ? ' · próximo nível em ' + nx : '') + '. Cada partida juntos aproxima a dupla (vitória mais).</p>';
}
$('btnResume').addEventListener('click', () => setPaused(false));
$('btnSimRest').addEventListener('click', () => { setPaused(false); simulateRest(); }); // carreira: termina a partida no simulador (nota do que já foi jogado)
$('btnPauseCam').addEventListener('click', () => { toggleCam(); setPaused(false); });
$('btnAsMove').addEventListener('click', () => toggleAssist('assistMove'));
$('btnAsMark').addEventListener('click', () => toggleAssist('assistMark'));
// nome do golpe na tela: completo → discreto → desligado
const SHOT_TXT = { completo: 'completo', discreto: 'discreto', off: 'desligado' };
$('btnShotTxt').addEventListener('click', () => { const l = Object.keys(SHOT_TXT), cur = S.settings.shotText || 'discreto'; S.settings.shotText = l[(l.indexOf(cur) + 1) % l.length]; saveSettings(); syncAssistButtons(); });
$('shotTextSel').addEventListener('change', e => { S.settings.shotText = e.target.value; saveSettings(); });
// barra de força na pausa: tamanho e opacidade (alternam)
// barra de golpe: menu próprio (configurações, online e pausa)
$('btnGameCfg').addEventListener('click', () => { $('gcKeys').open = false; renderBinds(); $('gameCfg').hidden = false; });
// teclas durante o jogo (pausa): a mesma lista das Configurações, dentro do quadro de configurações do jogo
$('btnPzKeys').addEventListener('click', () => { $('gcKeys').open = true; renderBinds(); $('gameCfg').hidden = false; });
$('gameCfgClose').addEventListener('click', () => { $('gameCfg').hidden = true; });
// nomes sobre os jogadores (pausa): alterna normal → pequenos → simples → escondidos
const TAG_STYLES = ['normal', 'pequena', 'simples', 'off'], TAG_TXT = { normal: 'normal', pequena: 'pequenos', simples: 'simples', off: 'escondidos' };
const syncTagsBtn = () => { $('btnTags').querySelector('b').textContent = TAG_TXT[S.settings.tagStyle || 'normal']; };
$('btnTags').addEventListener('click', () => { const c = S.settings.tagStyle || 'normal'; S.settings.tagStyle = TAG_STYLES[(TAG_STYLES.indexOf(c) + 1) % TAG_STYLES.length]; saveSettings(); applyMeterLook(); syncTagsBtn(); });
syncTagsBtn();
document.querySelectorAll('[data-barcfg]').forEach(b => b.addEventListener('click', () => { $('barCfg').hidden = false; }));
$('barCfgClose').addEventListener('click', () => { $('barCfg').hidden = true; });
$('btnBall').addEventListener('click', () => { const l = Object.keys(BALL_STYLES), cur = S.settings.ballStyle || 'laranja'; S.settings.ballStyle = l[(l.indexOf(cur) + 1) % l.length]; saveSettings(); setBallStyle(S.settings.ballStyle); syncAssistButtons(); });
function syncAssistButtons() {
  // pausa: interruptores (ligado/desligado) e opções que giram mostrando o valor à direita
  [['btnAsMove', 'assistMove'], ['btnAsMark', 'assistMark']].forEach(([id, k]) => { const b = $(id); b.classList.toggle('on', !!S.settings[k]); b.setAttribute('aria-checked', S.settings[k] ? 'true' : 'false'); });
  $('btnShotTxt').querySelector('b').textContent = SHOT_TXT[S.settings.shotText || 'discreto'];
  $('btnBall').querySelector('b').textContent = (BALL_STYLES[S.settings.ballStyle || 'laranja'] || BALL_STYLES.laranja).nome.replace(' (padrão)', '').toLowerCase();
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

// ---------- perfil do jogador (toque num nome do ranking/parceiros) ----------
const PF = { el: null, r: null, scene: null, cam: null, model: null, raf: 0, rot: .4, drag: null };
function openProfile(id) {
  if (!$s.CR || id === 'crme') return;
  const c = crChar(id); if (!c) return;
  if (!PF.el) {
    const m = document.createElement('div'); m.id = 'crProf'; m.className = 'cr-edit'; m.hidden = true;
    m.innerHTML = '<div class="cr-edit-box"><div class="cr-edit-head"><b id="crProfName"></b><button type="button" class="cta sm" id="crProfOk">Fechar</button></div><div class="cr-edit-body"><div class="cr-edit-prev"><canvas id="crProfCv" width="300" height="420"></canvas></div><div class="cr-edit-opts" id="crProfInfo"></div></div></div>';
    document.body.append(m); PF.el = m;
    { const cv = $('crProfCv'); cv.style.cursor = 'grab'; cv.addEventListener('pointerdown', e => { PF.drag = e.clientX; cv.setPointerCapture(e.pointerId); }); cv.addEventListener('pointermove', e => { if (PF.drag == null) return; PF.rot += (e.clientX - PF.drag) * .012; PF.drag = e.clientX; }); cv.addEventListener('pointerup', () => { PF.drag = null; }); } // arraste para girar
    PF.r = new THREE.WebGLRenderer({ canvas: $('crProfCv'), antialias: true, alpha: true }); PF.r.outputColorSpace = THREE.SRGBColorSpace; PF.r.toneMapping = THREE.ACESFilmicToneMapping; PF.r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    PF.scene = new THREE.Scene(); PF.scene.add(new THREE.HemisphereLight(0xfff6e8, 0x8a7458, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(2, 4, 3); PF.scene.add(sun);
    PF.cam = new THREE.PerspectiveCamera(30, 300 / 420, .1, 20);
    $('crProfOk').addEventListener('click', () => { PF.el.hidden = true; cancelAnimationFrame(PF.raf); });
    m.addEventListener('click', e => { if (e.target === m) { PF.el.hidden = true; cancelAnimationFrame(PF.raf); } });
  }
  if (PF.model) { PF.scene.remove(PF.model); PF.model = null; }
  try { PF.model = makePreview(c); } catch (e) { PF.model = null; }
  if (PF.model) { PF.scene.add(PF.model); const h = new THREE.Box3().setFromObject(PF.model).max.y || 1.8; PF.cam.position.set(0, h * .6, h * 2.3); PF.cam.lookAt(0, h * .52, 0); }
  const R = crRanking(), pos = R.findIndex(x => x.id === id), P = crPairs(true), mate = P[id] ? crChar(P[id]) : null;
  const ageTxt = crAgeOfC(c), A = ATTRS.map(([k, lbl]) => { const v = attrOf(c.a, k); return '<span>' + lbl + '</span><span class="bar"><i class="' + (v >= 85 ? 'hi' : v <= 60 ? 'lo' : '') + '" style="width:' + v + '%"></i></span><b>' + v + '</b>'; }).join('');
  const awNow = ($s.CR.season - 1) * SEASON_WEEKS + $s.CR.week, wkTxt = w => { const s0 = Math.floor((w - 1) / SEASON_WEEKS) + 1; return 'T' + s0 + ' · sem ' + (w - (s0 - 1) * SEASON_WEEKS); };
  const res = (($s.CR.npcR || {})[id] || []).map(x => { const w = Math.floor(x / 10000); return { w, p: x - w * 10000 }; }).filter(r => r.w > awNow - SEASON_WEEKS && r.p > 0).sort((a, b) => b.p - a.p).slice(0, RANK_BEST);
  const sn = shortOf(c), news = ($s.CR.news || []).filter(n => n.t.toUpperCase().includes(sn.toUpperCase())).slice(0, 4);
  $('crProfName').innerHTML = flagSVG(c.pais) + ' ' + esc(nameOf(c));
  $('crProfInfo').innerHTML = '<div class="cr-kpis"><div><b>' + crCharOvr(c) + '</b>overall</div><div><b>' + (pos >= 0 ? tieRank(R, pos) + 'º' : '—') + '</b>ranking (' + npcPts(id) + ' pts)</div><div><b>' + (ageTxt || '—') + '</b>anos</div><div><b>' + Math.round(heightOf(c) * 100) + '</b>cm</div></div>'
    + '<p class="cr-note">' + esc(c.estilo || '') + ' · joga ' + esc(PLAY_STYLES[playStyleOf(c)].nome.toLowerCase()) + (c.canhoto ? ' · canhoto' : ' · destro') + '</p>'
    + '<p class="section-label">Dupla</p><p>' + (mate ? flagSVG(mate.pais) + ' ' + esc(nameOf(mate)) + ' (' + crCharOvr(mate) + ')' : id === $s.CR.partner ? 'Joga com você' : 'Sem dupla fixa') + '</p>'
    + '<p class="section-label">Atributos</p><div class="bars">' + A + '</div>'
    + (res.length ? '<p class="section-label">Resultados que contam no ranking (últimas 52 semanas)</p><div class="cr-res">' + res.map(r => '<span><b>' + r.p + '</b> ' + esc(crResLabel(r.p, r.w) || 'pts') + ' <small>' + (r.w > 0 ? wkTxt(r.w) : 'temporada anterior') + '</small></span>').join('') + '</div>' : '')
    + (news.length ? '<p class="section-label">Nas notícias</p>' + news.map(n => '<p class="cr-note">' + n.i + ' ' + esc(n.t) + '</p>').join('') : '');
  PF.el.hidden = false; cancelAnimationFrame(PF.raf);
  const loop = () => { if (PF.el.hidden) return; if (PF.model) PF.model.rotation.y = PF.rot; PF.r.render(PF.scene, PF.cam); PF.raf = requestAnimationFrame(loop); }; loop();
}
const crAgeOfC = c => crAgeOf(c);
document.addEventListener('click', e => { const el = e.target.closest && e.target.closest('[data-prof]'); if (!el || e.target.closest('button')) return; if (el.closest('#crBody') || el.closest('#crHead') || el.closest('#crSide')) openProfile(el.dataset.prof); });
