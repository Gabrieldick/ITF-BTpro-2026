// @ts-nocheck
// telas do modo carreira
import './14-carreira';
import { $s } from '../state';
import { ATTRS, GEAR, PLAY_STYLES, RACKET_STATS, STAFF, clamp, heightOf, nameOf, overall, racketBonus, shortOf, rkSummary } from './00-base';
import { S, NET } from './01-estado';
import { RACKETS } from './05-atletas';
import { ac } from './08-audio';
import { BALL_STYLES, setBallStyle } from './07-glb';
import { $, el, feedback, hideBanner, newMatch, startDrill, DRILL_LVL, DRILLS, simulateRest } from './09-interface';
import { applyCam, readMenu, saveSettings, setPaused, syncMenu, toggleCam, togglePause, toggleSound, applyMeterLook } from './12-controles';
import { clRecover, clNewPassword, clFromLink, CL, clSignUp, clSignIn, clSignOut, clList, clPull, clRemove, clSyncAll, clFlush, clTime, clLocalTime, crGate, crBandTarget, crNatural, crEquipB, crSkipByes, crAutoDays, crSimTour, crUf, crStateSquad, crCatN, crMinCat, crCatPts, CAT_NAMES, crStartTarget, crPresetAttrs, crFormWord, crEnergyMod, crCanUp, DAY_NAMES, DAY_FULL, crDate, crDateTxt, crUpcoming, crNextDay, crRestUntil, crAvgRating, npcPts, RANK_BEST, crDay1Rounds, HAIRS, SEASON_WEEKS, SKINS, TIERS, careerMatchEnded, crCap, crChar, crCharOvr, crCoach, crCreate, crEnter, crGearBonus, crHire, crLessonIncome, crMaxTier, crMeOvr, crMigrate, crMyMatch, crNRounds, crNextWeek, crPlayMatch, crPlaySim, crPts, crRank, crRanking, crResolveEvent, crRest, crRoundNames, crSetPartner, crSyncChars, crTeamName, crTeamOvr, crTierUnlocked, crTrain, crUpCost, crUpgrade, crWeekOptions, crWillPartner, crWorld, crXpMul, saveCareer, crSlots, crLoadSlot, crCloseSlot, crDeleteSlot, crExportData, crImportData, crRepoSaves, crImportUrl, SAVE_REPO, SAVE_DIR, crSaveErr , INVEST, crInv, crInvBuy, crFamaTarget, STATE_INFO, crStateRanking, crDrillReward, crH2H, crRivalOf, STATES, crTourT, crTravel, LIFE, crLife, crLifeBuy, crGoalOptions, crPickGoal, crGoalDone, crMoodWord, crMoodBonus, crPartnerAct } from './14-carreira';
import { playStyleOf } from './16-ia';
import { COUNTRIES, flagSVG } from '../flags';
// ---------- telas ----------
let crTab = 'agenda';
const money = v => '$' + Math.round(v).toLocaleString('pt-BR');
let crEntry = '';
document.querySelectorAll('[data-entry]').forEach(b => b.addEventListener('click', () => { crEntry = b.dataset.entry; renderCareer(); }));
function openCareer() { readMenu(); el.menu.hidden = true; $('career').hidden = false; document.body.classList.add('in-menu'); if ($s.CR) { crMigrate(); crSyncChars(); } renderCareer(); }
function renderCareer() {
  // sem carreira aberta: três abas (conta, carregar, criar)
  if (!$s.CR && !crEntry) crEntry = crSlots().length || CL.sess ? 'load' : 'new';
  $('crEntry').hidden = !!$s.CR;
  document.querySelectorAll('[data-entry]').forEach(b => b.classList.toggle('sel', b.dataset.entry === crEntry));
  $('crNew').hidden = !!$s.CR || crEntry !== 'new'; $('crHub').hidden = !$s.CR; $('crSaves').hidden = !!$s.CR || crEntry !== 'load'; $('crAccount').hidden = !!$s.CR || crEntry !== 'conta';
  $('crExport').hidden = $('crSwitch').hidden = !$s.CR;
  { const cb = $('crCloudBtn'); cb.hidden = !$s.CR; cb.textContent = CL.sess ? '☁️ Nuvem ✓' : '☁️ Nuvem'; }
  if (!$s.CR) { renderSaves(); renderCrNew(); return; }
  const meO = overall($s.CR.me.a), inGame = crMeOvr(), rank = crRank(), pts = crPts();
  $('crHead').innerHTML = '<div class="cr-id"><div class="ovr">' + meO + '<small>OVR</small></div><div><b>' + esc($s.CR.me.name) + '</b><span>' + $s.CR.age + ' anos · ' + $s.CR.me.estilo + ' · potencial ' + crCap() + ' (máx. 99 pela nota) · em jogo ' + inGame + ' · fama ' + Math.round($s.CR.fama || 0) + '</span></div></div>'
    + '<div class="cr-kpis"><div><b>' + rank + 'º</b>ranking (' + pts + ' pts)</div><div><b>' + money($s.CR.money) + '</b>dinheiro</div><div><b>' + Math.floor($s.CR.pe) + '</b>pontos de evolução</div><div><b>' + crDateTxt($s.CR.season, $s.CR.week, $s.CR.day, true) + '</b>temporada ' + $s.CR.season + ' · semana ' + $s.CR.week + '/' + SEASON_WEEKS + '</div></div>'
    + '<div class="cr-stars"><span>Dificuldade</span>' + [1, 2, 3, 4, 5, 6].map(n => '<button type="button" class="' + (n <= ($s.CR.stars || 3) ? 'on' : '') + '" data-stars="' + n + '" title="' + n + (n === 3 ? ' (padrão)' : '') + '">★</button>').join('') + '<small>' + ['Bem fácil', 'Fácil', 'Padrão', 'Difícil', 'Muito difícil', 'Lendário'][($s.CR.stars || 3) - 1] + '</small></div>'
    + '<div class="cr-energy"><span>Energia</span><span class="bar"><i class="' + ($s.CR.energy < 40 ? 'lo' : $s.CR.energy > 75 ? 'hi' : '') + '" style="width:' + $s.CR.energy + '%"></i></span><b>' + $s.CR.energy + '</b>' + (crEnergyMod() ? '<small class="cr-emod ' + (crEnergyMod() > 0 ? 'hi' : 'lo') + '">' + (crEnergyMod() > 0 ? '+' : '−') + Math.abs(crEnergyMod()) + ' nos atributos</small>' : '') + '</div>';
  $('crHead').querySelectorAll('[data-stars]').forEach(b => b.addEventListener('click', () => { $s.CR.stars = +b.dataset.stars; saveCareer(); renderCareer(); }));
  document.querySelectorAll('#crTabs button').forEach(b => b.classList.toggle('sel', b.dataset.t === crTab));
  const busy = $s.CR.tour && !$s.CR.tour.done;
  $('crTabs').hidden = !!($s.CR.tour && !$s.CR.tour.pending);
  const crm = crSaveErr() || $s.CR.lastMsg || ''; $('crMsg').textContent = crm; $('crMsg').hidden = !crm;
  const body = $('crBody');
  if ($s.CR.tour && !$s.CR.tour.pending) { body.innerHTML = crTourHTML(); bindTour(); return; }
  body.innerHTML = ({ agenda: crAgendaHTML, jogador: crPlayerHTML, parceiros: crPartnersHTML, loja: crShopHTML, patrocinio: crSponsorHTML, ranking: crRankingHTML, historico: crHistoryHTML, negocios: crBizHTML }[crTab])();
  bindCareerBody();
}
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
function crAgendaHTML() {
  if ($s.CR.event) return '<div class="cr-card gold"><div class="eyebrow">Evento da semana</div><b>' + esc($s.CR.event.text) + '</b><div class="cta-row" style="margin-top:6px">' + $s.CR.event.opts.map((o, i) => '<button class="' + (i ? 'ghost' : 'cta') + ' sm" data-ev="' + i + '">' + esc(o) + '</button>').join('') + '</div></div>';
  const opts = crWeekOptions(), p = $s.CR.partner ? crChar($s.CR.partner) : null;
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
    + '<div class="cr-card"><div class="eyebrow">Treino físico e técnico</div><b>Treinar</b><span>+' + (Math.round((.9 + (crInv('quadra') ? .6 : 0)) * crXpMul() * 10) / 10).toString().replace('.', ',') + ' ponto de evolução · −6 energia</span><span>Custo: ' + money(crInv('quadra') ? 0 : 20 * (crMaxTier() + 1)) + '</span><button class="ghost sm" id="crTrain"' + ($s.CR.injury ? ' disabled' : '') + '>Treinar hoje</button></div>'
    + '<div class="cr-card"><div class="eyebrow">Treino com desafio</div><b>Treinar na quadra</b><span>Curtas, defesa, smash, saque ou combinados: evolução por acerto; cumprindo a meta, um pouco de potencial · −5 energia</span><button class="ghost sm" id="crDrill"' + ($s.CR.injury ? ' disabled' : '') + '>Escolher desafio</button></div>'
    + '<div class="cr-card"><div class="eyebrow">Renda extra</div><b>Dar aulas</b><span>+' + money(Math.round(crLessonIncome() * .3 / 10) * 10) + ' · −2 energia</span><button class="ghost sm" id="crCoach">Dar aulas hoje</button></div>'
    + '<div class="cr-card"><div class="eyebrow">Recuperação</div><b>Descansar</b><span>+14 de energia' + (crLife('crio') ? ' (+6 da crioterapia)' : '') + '. 3 dias de descanso na semana aceleram a volta de lesão.</span><div class="cta-row"><button class="ghost sm" id="crRest">Descansar hoje</button><button class="ghost sm" id="crRestUntil">' + (reg ? 'Descansar até o torneio' : 'Descansar até o fim da semana') + '</button><button class="ghost sm" id="crAuto" title="Treina enquanto a energia deixa e descansa o necessário para chegar inteiro ao torneio">' + (reg ? 'Dias automáticos até o torneio' : 'Semana automática') + '</button></div></div></div>';
  const regC = reg ? '<div class="cr-card gold"><div class="eyebrow">Inscrito · ' + (crTourT(reg).pro ? 'sábado e domingo' : 'sábado') + '</div><b>' + esc(reg.name) + '</b><span>' + (crTourT(reg).pro ? 'Sábado: primeiras rodadas. Domingo: semifinal e final (se chegar lá).' : 'Todas as rodadas no sábado.') + '</span></div>' : '';
  // inscrições da semana: até sexta
  const open = !reg && d <= 5;
  const tours = !reg ? '<p class="section-label">Torneios desta semana' + (open ? ' · inscrições até sexta' : ' · inscrições encerradas') + '</p>' + (open ? '<div class="cr-cards">' + opts.map((o, i) => {
      const when = '<span class="cr-when">' + crDateTxt($s.CR.season, $s.CR.week, 6) + (o.days > 1 ? ' e ' + crDateTxt($s.CR.season, $s.CR.week, 7) : '') + '</span>';
      if (o.special && o.special !== 'estadual') return '<div class="cr-card gold"><div class="eyebrow">Seleção · convocação</div><b>' + esc(o.name) + '</b>' + when + (o.notCalled ? '<span>Você não foi convocado. ' + esc(o.info) + '</span>' : '<span>Você foi convocado! Joga ao lado de ' + esc(nameOf(crChar(o.mate))) + '.' + (o.info ? ' ' + esc(o.info) : '') + ' Sem inscrição nem viagem; não conta para o ranking, mas dá fama, evolução e prêmio.</span><button class="cta sm" data-enter="' + i + '">Defender a seleção</button>') + '</div>';
      const T = TIERS[o.tier]; const cost = o.special === 'estadual' || o.singles ? Math.round(T.fee * .5) + (o.singles ? crTravel(T) : 0) : (o.wild ? 0 : T.fee) + crTravel(T);
      if (o.singles) return '<div class="cr-card"><div class="eyebrow">Simples · chave de 8</div><b>' + esc(o.name) + '</b>' + when + '<span>Sem parceiro: só você. Adversários OVR ' + T.ovr[0] + '–' + T.ovr[1] + '</span><span>Campeão: ' + money(Math.round(T.prize[0] * .5)) + ' · não conta para o ranking de duplas</span><span>Custo: ' + money(cost) + '</span><button class="ghost sm" data-enter="' + i + '"' + ($s.CR.money < cost ? ' disabled' : '') + '>Inscrever</button></div>';
      return '<div class="cr-card' + (o.tier === 9 ? ' gold' : '') + '"><div class="eyebrow">' + T.nome + ' · chave de ' + T.draw + '</div><b>' + esc(o.name) + '</b>' + when + '<span>Adversários OVR ' + T.ovr[0] + '–' + T.ovr[1] + '</span><span>Campeão: ' + money(T.prize[0]) + ' · ' + (o.special === 'estadual' ? Math.round(T.pts[0] * .5) : T.pts[0]) + ' pts</span><span>Custo: ' + money(cost) + (T.travel ? ' (inscrição ' + money(T.fee) + ' + viagem ' + money(T.travel) + ')' : '') + '</span><button class="cta sm" data-enter="' + i + '"' + ($s.CR.money < cost ? ' disabled' : '') + '>Inscrever</button></div>';
    }).join('') + '</div>' : '<p class="cr-note">' + (wlog[6] === 'Torneio' ? 'Torneio do fim de semana encerrado.' : 'Fim de semana sem torneio: aproveite para treinar ou descansar.') + ' Na segunda abrem as inscrições da próxima semana.</p>') : '';
  // próximos torneios do seu nível no calendário
  const up = crUpcoming(8);
  const cal = up.length ? '<p class="section-label">Próximos torneios profissionais</p>' + (crMaxTier() < 3 ? '<p class="cr-note">O ITF BT10 libera com ' + TIERS[3].req + ' pontos no ranking ou com um título no Amador A.</p>' : '') + '<div class="cr-list">' + up.map(x => '<div class="cr-row' + (x.o.locked ? ' dim' : '') + '"><span class="cr-pos">S' + x.w + '</span><div><b>' + esc(x.o.name) + '</b><small>' + x.date + (x.o.tier !== undefined && !x.o.special ? ' · ' + TIERS[x.o.tier].nome + ' · campeão ' + TIERS[x.o.tier].pts[0] + ' pts' : '') + '</small></div></div>').join('') + '</div>' : '';
  return '<div class="cr-ladder">' + ladder + '</div>'
    + '<div class="cr-week">' + week + '</div>'
    + '<p class="cr-note">Parceiro: <b>' + (p ? esc(nameOf(p)) + ' (' + crCharOvr(p) + ')' : 'nenhum — um parceiro de ocasião será escolhido na inscrição') + '</b>' + (p ? ' · entrosamento ' + '★'.repeat($s.CR.chem) + '☆'.repeat(5 - $s.CR.chem) + ' · humor: ' + crMoodWord() : '') + '</p>'
    + goal + injC + regC + acts + tours + cal;
}
function crPlayerHTML() {
  const eq = crEquipB();
  const rows = ATTRS.map(([k, lbl]) => { const v = $s.CR.me.a[k], c = crUpCost(v, k), extra = Math.round(eq[k] || 0); return '<span>' + lbl + (crNatural(k) ? ' ★' : '') + '</span><span class="bar"><i class="' + (v >= 85 ? 'hi' : v <= 60 ? 'lo' : '') + '" style="width:' + v + '%"></i></span><b>' + v + (extra ? '<em class="' + (extra > 0 ? 'up' : 'dn') + '">' + (extra > 0 ? '+' : '') + extra + '</em>' : '') + '</b><button class="arw" data-up="' + k + '"' + ($s.CR.pe < c || !crCanUp(k) ? ' disabled' : '') + (!crCanUp(k) && v < 99 ? ' title="Subir este atributo passaria o overall do potencial atual: jogue bem para subir"' : '') + ' title="Custa ' + c + ' ponto(s)">+' + c + '</button>'; }).join('');
  const log = $s.CR.ovrLog.filter((x, i, a) => i === 0 || x.o !== a[i - 1].o).slice(-12).map(x => 'T' + x.s + 'S' + x.w + ': ' + x.o).join(' → ');
  return '<div class="cr-two"><div><p class="section-label">Atributos (gaste pontos de evolução)</p><div class="bars cr-bars">' + rows + '</div><p class="cr-note">Potencial atual: <b>' + crCap() + '</b> (máximo 99: até o 90 ele sobe com as partidas e os treinos; do 90 ao 99 segue a média das suas últimas 15 notas). Seu overall não passa do potencial atual, mesmo com pontos de evolução sobrando (cada atributo pode ir até 99, desde que o overall caiba). Ele sobe com a sua <b>nota</b> em cada partida (defesas boas, smashes e curtas certos sobem; erros descem) e um pouco ao cumprir desafios na quadra.' + (() => { const g = crGate(); return g.next ? ' <b>Marco:</b> para passar de ' + g.cap + ' precisa de ' + g.next.txt + ' (você tem ' + g.have + ').' : ($s.CR.potCur >= 90 ? ' <b>Faixa 90–99:</b> o potencial segue a média das últimas 15 notas (média 10 → 99, média 5 → 90; abaixo do teto, o overall desce). Alvo hoje: ' + crBandTarget($s.CR.ratings || []).toFixed(1).replace('.', ',') + '.' : ' Todos os marcos cumpridos: a partir do 90 o potencial segue a sua nota média.'); })()
    + (crNatural('forca') === null ? ' Completo: acima de 90, todo atributo custa 1,4×.' : ' Acima de 90, atributos fora do seu estilo custam o dobro (os do estilo estão marcados com ★).') + (crAvgRating() !== null ? ' Média das últimas notas: <b>' + crAvgRating().toFixed(1).replace('.', ',') + '</b>.' : '') + ' Em verde/vermelho: efeito da raquete e dos equipamentos.</p></div>'
    + '<div><p class="section-label">Evolução do overall</p><p class="cr-note">' + log + '</p><p class="section-label">Títulos</p><p class="cr-note">' + (Object.keys($s.CR.titles).length ? Object.entries($s.CR.titles).map(([t, n]) => TIERS[t].curto + ' ×' + n).join(' · ') : 'Nenhum ainda.') + '</p>'
    + '<p class="section-label">Partidas</p><fieldset class="seg"><div class="pills"><input type="radio" name="crGames" id="crG4" value="4"' + ($s.CR.games === 4 ? ' checked' : '') + '><label for="crG4">Set curto · 4 games</label><input type="radio" name="crGames" id="crG6" value="6"' + ($s.CR.games === 6 ? ' checked' : '') + '><label for="crG6">Set · 6 games</label></div></fieldset>'
    + '<p class="section-label">Seu lado na dupla</p><label class="cr-field"><select id="crMeSide" class="cr-sel"><option value="esquerda"' + ($s.CR.side === 'esquerda' ? ' selected' : '') + '>Esquerda</option><option value="direita"' + (($s.CR.side || 'direita') === 'direita' ? ' selected' : '') + '>Direita</option></select></label>'
    + ($s.CR.me.pais === 'BRA' ? '<p class="section-label">Estado (estaduais e seleção estadual)</p><label class="cr-field"><select id="crMeUf" class="cr-sel">' + STATES.map(([k, n]) => '<option value="' + k + '"' + (k === ($s.CR.me.uf || 'SP') ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>' : '')
    + crLookHTML()
    + '<p class="section-label">Nacionalidade</p><label class="cr-field"><span class="cr-nat">' + flagSVG($s.CR.me.pais) + '<select id="crMeNat">' + COUNTRIES.map(c => '<option value="' + c.code + '"' + (c.code === $s.CR.me.pais ? ' selected' : '') + '>' + c.nome + '</option>').join('') + '</select></span></label>'
    + '<div class="cta-row" style="margin-top:10px"><button class="ghost sm" id="crReset">Apagar carreira</button></div></div></div>';
}
// aparência do seu jogador: dá para mudar a qualquer momento da carreira (vale a partir da próxima partida)
const HAIR_ST = [['', 'Automático'], ['curto', 'Curto'], ['raspado', 'Raspado'], ['careca', 'Careca'], ['cacheado', 'Cacheado'], ['topete', 'Topete'], ['moicano', 'Moicano'], ['longo', 'Longo'], ['rabo', 'Rabo de cavalo'], ['coque', 'Coque'], ['tranca', 'Trança']];
const BEARDS = [['', 'Sem barba'], ['barba', 'Barba'], ['cavanhaque', 'Cavanhaque'], ['bigode', 'Bigode']];
const ACCS = [['cap', 'Boné'], ['visor', 'Viseira'], ['band', 'Faixa'], ['none', 'Nada']];
const lookAcc = L => L.cap ? 'cap' : L.visor ? 'visor' : L.headband ? 'band' : 'none';
function crLookHTML() {
  const me = $s.CR.me, L = me.look;
  const sw = (arr, key) => arr.map(c => '<button type="button" class="cr-sw' + (L[key] === c ? ' sel' : '') + '" data-look-' + key + '="' + c + '" style="background:' + c + '" aria-label="' + c + '"></button>').join('');
  const sel = (id, opts, v) => '<select id="' + id + '" class="cr-sel">' + opts.map(([k, n]) => '<option value="' + k + '"' + (k === (v || '') ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>';
  return '<p class="section-label">Aparência</p><div class="cr-sws"><div><span class="cr-lbl">Pele</span>' + sw(SKINS, 'skin') + '</div><div><span class="cr-lbl">Cabelo</span>' + sw(HAIRS, 'hair') + '</div></div>'
    + '<div class="cr-look"><label class="cr-field">Corte ' + sel('crLkHair', HAIR_ST, L.hairStyle) + '</label>'
    + (me.fem ? '' : '<label class="cr-field">Barba ' + sel('crLkBeard', BEARDS, L.beard) + '</label>')
    + '<label class="cr-field">Na cabeça ' + sel('crLkAcc', ACCS, lookAcc(L)) + '</label>'
    + '<label class="cr-field">Óculos ' + sel('crLkGlass', [['1', 'Com óculos'], ['', 'Sem óculos']], L.glasses ? '1' : '') + '</label></div>'
    + '<p class="cr-note">Vale a partir da próxima partida.</p>';
}
function bindLook() {
  const L = () => $s.CR.me.look, done = () => { crSyncChars(); saveCareer(); renderCareer(); };
  document.querySelectorAll('[data-look-skin]').forEach(b => b.addEventListener('click', () => { L().skin = b.dataset.lookSkin; done(); }));
  document.querySelectorAll('[data-look-hair]').forEach(b => b.addEventListener('click', () => { L().hair = b.dataset.lookHair; done(); }));
  const on = (id, fn) => { const e = $(id); if (e) e.addEventListener('change', () => { fn(e.value); done(); }); };
  on('crLkHair', v => { if (v) L().hairStyle = v; else delete L().hairStyle; });
  on('crLkBeard', v => { L().beard = v; });
  on('crLkAcc', v => { const l = L(); delete l.cap; delete l.visor; delete l.headband; if (v === 'cap') l.cap = '#fbf6ea'; else if (v === 'visor') l.visor = '#fbf6ea'; else if (v === 'band') l.headband = '#ff5a1f'; else l.headband = ''; }); // '' impede a faixa automática
  on('crLkGlass', v => { L().glasses = !!v; });
}
function crPersonRow(c, extra, btn) {
  const fw = c.id === 'crme' ? null : crFormWord(c.id);
  return '<div class="cr-row"><span class="ovr sm">' + crCharOvr(c) + (fw ? '<i class="cr-form ' + (fw[0][0] === '▲' ? 'up' : 'dn') + '" title="' + fw[1] + '">' + fw[0] + '</i>' : '') + '</span><div><b>' + flagSVG(c.pais) + ' ' + esc(nameOf(c)) + '</b><small>' + c.pais + ' · ' + (c.id === 'crme' ? c.estilo : 'joga ' + PLAY_STYLES[playStyleOf(c)].nome.toLowerCase()) + ' · ' + Math.round(heightOf(c) * 100) + ' cm' + (c.canhoto ? ' · canhoto' : '') + (extra ? ' · ' + extra : '') + '</small></div>' + (btn || '') + '</div>';
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
  return '<p class="section-label">Seu parceiro</p>' + (cur ? crPersonRow(cur, 'entrosamento ' + $s.CR.chem + '/5', '<button class="ghost sm" data-drop="1">Desfazer dupla</button>') + acts : '<p class="cr-note">Sem parceiro fixo.</p>')
    + (offers.length ? '<p class="section-label">Convites (de quem você venceu)</p>' + offers.map(c => crPersonRow(c, 'quer jogar com você', '<button class="cta sm" data-partner="' + c.id + '">Aceitar</button>')).join('') : '')
    + '<p class="section-label">Mercado de parceiros</p><p class="cr-note">Quem aceita depende do seu overall, dos seus pontos no ranking e de você já ter vencido o jogador. Quem está muito acima no ranking só joga com você depois de perder para você. Entrosamento sobe a cada torneio juntos.</p>'
    + '<div class="cr-list">' + list.map(x => crPersonRow(x.c, x.w.why + ' · ' + npcPts(x.c.id) + ' pts', x.w.ok ? '<button class="ghost sm" data-partner="' + x.c.id + '">Formar dupla</button>' : '<span class="cr-lock">🔒</span>')).join('') + '</div>';
}
// ícone de cada atributo nos bônus de raquetes e equipamentos
const ATTR_IC = { forca: '💪', vel: '👟', def: '🛡️', backhand: '↩️', curta: '🪶', lob: '🌈', smash: '💥', saque: '🎾', leitura: '🧠', voleio: '⚡' };
const bonusChips = b => Object.entries(b).map(([a, v]) => '<em class="' + (v > 0 ? 'up' : 'dn') + '" title="' + ATTRS.find(x => x[0] === a)[1] + '">' + ATTR_IC[a] + ' ' + (v > 0 ? '+' : '') + v + ' ' + ATTRS.find(x => x[0] === a)[1] + '</em>').join(' ');
const rkKind = b => { const pos = k => Math.max(0, b[k] || 0), atk = pos('forca') + pos('smash') + pos('saque'), ctl = pos('def') + pos('curta') + pos('lob') + pos('backhand') + pos('vel'); return atk + ctl <= 2 ? ['🪵', 'Básica'] : atk > ctl + 2 ? ['⚡', 'Potência'] : ctl > atk + 2 ? ['🎯', 'Controle'] : ['⚖️', 'Equilíbrio']; };
function crShopHTML() {
  const disc = $s.CR.discount || 0;
  const rk = Object.entries(RACKET_STATS).sort((x, y) => ($s.CR.rackets.includes(y[0]) - $s.CR.rackets.includes(x[0])) || (y[0] === 'assinatura') - (x[0] === 'assinatura') || x[1].preco - y[1].preco).map(([k, r]) => {
    const own = $s.CR.rackets.includes(k), eq = $s.CR.racket === k, price = Math.round(r.preco * (1 - disc));
    const bonus = bonusChips(r.b), tot = Object.values(r.b).reduce((t, v) => t + v, 0), kd = rkKind(r.b);
    return '<div class="cr-row' + (eq ? ' me' : '') + '"><span class="cr-rk" data-r="' + k + '"></span><div><b>' + r.nome + (eq ? ' · em uso' : '') + ' <span class="rk-tag" title="' + kd[1] + '">' + kd[0] + ' ' + kd[1] + '</span> <span class="rk-tot ' + (tot >= 0 ? 'up' : 'dn') + '" title="Soma dos bônus">' + (tot > 0 ? '+' : '') + tot + '</span></b><small>' + r.desc + '</small><small class="rk-b">' + bonus + '</small></div>' + (eq ? '' : own ? '<button class="ghost sm" data-equip="' + k + '">Usar</button>' : '<button class="cta sm" data-buy="' + k + '"' + ($s.CR.money < price ? ' disabled' : '') + '>' + money(price) + '</button>') + '</div>';
  }).join('');
  const gr = GEAR.map(g => {
    const own = $s.CR.gear.includes(g.id);
    const bonus = bonusChips(g.b);
    return '<div class="cr-row"><span class="cr-ic">🎒</span><div><b>' + g.nome + '</b><small>' + g.desc + '</small><small>' + bonus + '</small></div>' + (own ? '<span class="cr-own">comprado</span>' : '<button class="cta sm" data-gear="' + g.id + '"' + ($s.CR.money < g.preco ? ' disabled' : '') + '>' + money(g.preco) + '</button>') + '</div>';
  }).join('');
  const st = STAFF.map(x => {
    const own = !!$s.CR.staff[x.id];
    return '<div class="cr-row' + (own ? ' me' : '') + '"><span class="cr-ic">' + (x.head ? '🧢' : '👤') + '</span><div><b>' + x.nome + '</b><small>' + x.desc + (x.head ? ' Só um técnico principal por vez.' : '') + '</small></div>' + (own ? '<span class="cr-own">contratado</span>' : '<button class="cta sm" data-hire="' + x.id + '"' + ($s.CR.money < x.preco ? ' disabled' : '') + '>' + money(x.preco) + '</button>') + '</div>';
  }).join('');
  return (disc ? '<p class="cr-msg">Promoção ativa: ' + Math.round(disc * 100) + '% de desconto na próxima raquete.</p>' : '')
    + '<div class="cr-two"><div><p class="section-label">🎾 Raquetes (' + Object.keys(RACKET_STATS).length + ')</p><div class="cr-list">' + rk + '</div></div>'
    + '<div><p class="section-label">🧢 Equipe técnica (contrato até o fim da temporada)</p><div class="cr-list" style="max-height:260px">' + st + '</div><p class="section-label" style="margin-top:10px">🎒 Equipamentos</p><div class="cr-list" style="max-height:220px">' + gr + '</div></div></div>';
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
  const sig = crInv('marca') >= 2 && $s.CR.racket !== 'assinatura' ? '<p class="cr-msg">Você não está usando a raquete da sua marca. <button class="cta sm" data-equip="assinatura">Usar a assinatura</button></p>' : '';
  return sig + '<p class="cr-note">Investimentos permanentes (não acabam no fim da temporada). Cada nível exige o anterior e conquistas na carreira.</p>' + tracks
    + '<p class="section-label">Estilo de vida</p><div class="cr-list">' + life + '</div>';
}
function crSponsorHTML() {
  const act = $s.CR.sponsors.map(x => '<div class="cr-row me"><span class="cr-ic">🤝</span><div><b>' + esc(x.brand) + '</b><small>' + money(x.weekly) + ' por semana · bônus de ' + money(x.bonus) + ' por título · faltam ' + x.left + ' semanas</small></div></div>').join('');
  const off = $s.CR.spOffers.map((x, i) => '<div class="cr-row"><span class="cr-ic">✉️</span><div><b>' + esc(x.brand) + '</b><small>' + money(x.weekly) + ' por semana durante ' + x.weeks + ' semanas · bônus de ' + money(x.bonus) + ' por título</small></div><div class="cta-row"><button class="cta sm" data-sp-ok="' + i + '"' + ($s.CR.sponsors.length >= 2 ? ' disabled title="Máximo de 2 patrocinadores"' : '') + '>Assinar</button><button class="ghost sm" data-sp-no="' + i + '">Recusar</button></div></div>').join('');
  return '<div class="cr-energy"><span>Fama</span><span class="bar"><i class="hi" style="width:' + Math.round($s.CR.fama) + '%"></i></span><b>' + Math.round($s.CR.fama) + '</b></div>'
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
    return tabs + '<p class="section-label">Ranking de ' + esc(STATES.find(x => x[0] === uf)[1]) + ' · ' + r.length + ' atletas · você é o ' + (me + 1) + 'º</p><div class="cr-list">' + show.map(x => { const i = r.indexOf(x), c = crChar(x.id); return '<div class="cr-row' + (x.id === 'crme' ? ' me' : '') + '"><span class="cr-pos">' + (i + 1) + '</span><div><b>' + flagSVG(c.pais) + ' ' + esc(nameOf(c)) + '</b><small>' + uf + ' · OVR ' + crCharOvr(c) + ' · ' + (crRanking().findIndex(y => y.id === x.id) + 1) + 'º no mundo</small></div><b class="cr-pts">' + x.pts + '</b></div>'; }).join('') + '</div>';
  }
  if (crRankView === 'pts') return tabs + crMyPtsHTML();
  if (crRankView === 'nac') { // ranking nacional: só os atletas do seu país (mesmos pontos do mundial)
    const all = crRanking(), r = all.filter(x => { const c = crChar(x.id); return c && c.pais === pais; }), me = r.findIndex(x => x.id === 'crme');
    const show = r.slice(0, 30); if (me >= 30) show.push(...r.slice(Math.max(30, me - 2), me + 3));
    return tabs + '<p class="section-label">Ranking ' + esc(natName) + ' · ' + r.length + ' atletas · você é o ' + (me + 1) + 'º</p><div class="cr-list">' + show.map(x => { const i = r.indexOf(x), c = crChar(x.id); return '<div class="cr-row' + (x.id === 'crme' ? ' me' : '') + '"><span class="cr-pos">' + (i + 1) + '</span><div><b>' + flagSVG(c.pais) + ' ' + esc(nameOf(c)) + '</b><small>' + (c.pais === 'BRA' && crUf(c) ? crUf(c) + ' · ' : '') + 'OVR ' + crCharOvr(c) + ' · ' + (all.indexOf(x) + 1) + 'º no mundo</small></div><b class="cr-pts">' + x.pts + '</b></div>'; }).join('') + '</div>';
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
    + '<div class="cr-list">' + (show.length ? show.map(x => { const i = r.indexOf(x), c = x.c, pick = sq.includes(x.id); return '<div class="cr-row' + (x.id === 'crme' ? ' me' : '') + '"><span class="cr-pos">' + (i + 1) + '</span><div><b>' + flagSVG(c.pais) + ' ' + esc(nameOf(c)) + (pick ? ' <small>· convocado</small>' : '') + '</b><small>OVR ' + x.ovr + '</small></div><b class="cr-pts">' + x.pts + '</b></div>'; }).join('') : '<p class="cr-note">Ninguém nesta categoria.</p>') + '</div>'
    + (sq.some(id => !r.find(x => x.id === id)) ? '<p class="cr-note">Faltou gente na categoria: completa com ' + sq.filter(id => !r.find(x => x.id === id)).map(id => esc(nameOf(crChar(id)))).join(' e ') + ' (de uma categoria abaixo).</p>' : '')
    + status;
}
// seus pontos: os resultados das últimas 52 semanas, os 10 que contam e quando cada um sai da conta
function crMyPtsHTML() {
  const now = ($s.CR.season - 1) * SEASON_WEEKS + $s.CR.week;
  const hist = $s.CR.history || [];
  const list = $s.CR.results.filter(r => r.w > now - SEASON_WEEKS && r.pts > 0).map(r => {
    const h = hist.find(x => (x.s - 1) * SEASON_WEEKS + x.w === r.w && x.pts === r.pts);
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
  const r = crRanking(), me = r.findIndex(x => x.id === 'crme');
  const show = r.slice(0, 30); if (me >= 30) show.push(...r.slice(Math.max(30, me - 2), me + 3));
  return '<p class="section-label">Ranking ' + ($s.CR.me.fem ? 'feminino' : 'masculino') + ' (' + RANK_BEST + ' melhores resultados das últimas ' + SEASON_WEEKS + ' semanas)</p><div class="cr-list">' + show.map(x => { const i = r.indexOf(x), c = crChar(x.id); return '<div class="cr-row' + (x.id === 'crme' ? ' me' : '') + '"><span class="cr-pos">' + (i + 1) + '</span><div><b>' + flagSVG(c.pais) + ' ' + esc(nameOf(c)) + '</b><small>' + c.pais + ' · OVR ' + crCharOvr(c) + '</small></div><b class="cr-pts">' + x.pts + '</b></div>'; }).join('') + '</div>';
}
function crRivalsHTML() {
  const l = Object.values($s.CR.h2h || {}).filter(h => h.w + h.l >= 3 && h.w && h.l).sort((a, b) => (b.w + b.l) - (a.w + a.l)).slice(0, 8);
  return l.length ? '<p class="section-label">Rivais (confronto direto)</p><div class="cr-list">' + l.map(h => '<div class="cr-row"><span class="cr-ic">🔥</span><div><b>' + esc(h.name) + '</b><small>' + h.w + ' vitórias · ' + h.l + ' derrotas</small></div></div>').join('') + '</div>' : '';
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
      + (t.stand ? '<p class="section-label">Classificação dos estados (4 / 2 / 1 por categoria)</p><div class="cr-list">' + t.stand.map((x, i) => '<div class="cr-row' + (x.uf === t.teams[t.me].uf ? ' me' : '') + '"><span class="cr-pos">' + (i + 1) + '</span><div><b>' + esc(STATES.find(q => q[0] === x.uf)[1]) + '</b><small>' + ['C', 'B', 'A', 'Pro'].map((c, k) => c + ': ' + (x.cats[k] ? x.cats[k] + 'º' : '–')).join(' · ') + '</small></div><b class="cr-pts">' + x.pts + '</b></div>').join('') + '</div>' : '')
      + (s.offers.length ? '<span>Convites para formar dupla: ' + s.offers.map(id => esc(nameOf(crChar(id)))).join(', ') + ' (veja em Parceiros)</span>' : '') + '<span class="cr-note">' + t.log.map(esc).join(' · ') + '</span></div>';
  } else if (mm) {
    const opp = t.teams[mm.a === t.me ? mm.b : mm.a];
    const sty = id => PLAY_STYLES[playStyleOf(crChar(id))].nome.toLowerCase();
    const h = crH2H(opp), riv = crRivalOf(opp);
    msg = (riv ? '<p class="cr-msg">🔥 Clássico! Confronto direto: ' + h.w + '–' + h.l + '. Vencer rende bônus.</p>' : h.w + h.l ? '<p class="cr-note">Confronto direto: ' + h.w + '–' + h.l + '</p>' : '')
      + (t.singles ? '' : '<p class="cr-note">Seu lado na dupla: <select id="crSide" class="cr-sel"><option value="esquerda">Esquerda</option><option value="direita">Direita</option></select></p>')
      + '<p class="cr-note">Tática: <select id="crTactic" class="cr-sel"><option value="normal">Equilibrada</option><option value="fraco">Atacar o mais fraco</option><option value="meio">Jogar no meio</option><option value="lobs">Lobs no fundo</option></select></p>'
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
    crPlay: () => { const ts = $('crTactic'); if (ts) { S.settings.tactic = ts.value; saveSettings(); } crPlayMatch(); },
    crSim: () => { crPlaySim(); renderCareer(); },
    crSimAll: () => { crSimTour(); renderCareer(); },
    // acabou no sábado: o domingo fica livre; acabou no domingo: vira a semana
    crDone: () => { if ($s.CR.day < 7) { $s.CR.tour = null; crNextDay(); } else crNextWeek(); crTab = 'agenda'; renderCareer(); },
    crSunday: () => { $s.CR.tour.night = false; saveCareer(); renderCareer(); },
  };
  ['crPlay', 'crSim', 'crSimAll', 'crDone', 'crSunday'].forEach(b);
  const ts = $('crTactic'); if (ts) ts.value = S.settings.tactic || 'normal';
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
  body.querySelectorAll('[data-drop]').forEach(bt => bt.addEventListener('click', () => { $s.CR.partner = null; $s.CR.chem = 0; saveCareer(); renderCareer(); }));
  body.querySelectorAll('[data-buy]').forEach(bt => bt.addEventListener('click', () => { const k = bt.dataset.buy, r = RACKET_STATS[k], price = Math.round(r.preco * (1 - ($s.CR.discount || 0))); if ($s.CR.money >= price) { $s.CR.money -= price; $s.CR.discount = 0; $s.CR.rackets.push(k); $s.CR.racket = k; $s.CR.me.look.racket = k; $s.CR.lastMsg = 'Comprou a ' + r.nome + '.'; saveCareer(); } renderCareer(); }));
  body.querySelectorAll('[data-life]').forEach(bt => bt.addEventListener('click', () => { crLifeBuy(bt.dataset.life); renderCareer(); }));
  body.querySelectorAll('[data-pact]').forEach(bt => bt.addEventListener('click', () => { crPartnerAct(bt.dataset.pact); renderCareer(); }));
  body.querySelectorAll('[data-goal]').forEach(bt => bt.addEventListener('click', () => { crPickGoal(+bt.dataset.goal); renderCareer(); }));
  body.querySelectorAll('[data-rkview]').forEach(bt => bt.addEventListener('click', () => { crRankView = bt.dataset.rkview; renderCareer(); }));
  body.querySelectorAll('[data-selcat]').forEach(bt => bt.addEventListener('click', () => { crSelCat = +bt.dataset.selcat; renderCareer(); }));
  body.querySelectorAll('[data-inv]').forEach(bt => bt.addEventListener('click', () => { crInvBuy(bt.dataset.inv); renderCareer(); }));
  body.querySelectorAll('[data-hire]').forEach(bt => bt.addEventListener('click', () => { crHire(bt.dataset.hire); renderCareer(); }));
  body.querySelectorAll('[data-ev]').forEach(bt => bt.addEventListener('click', () => { crResolveEvent(+bt.dataset.ev); renderCareer(); }));
  body.querySelectorAll('[data-sp-ok]').forEach(bt => bt.addEventListener('click', () => { const o = $s.CR.spOffers.splice(+bt.dataset.spOk, 1)[0]; if (o && $s.CR.sponsors.length < 2) { $s.CR.sponsors.push(Object.assign(o, { left: o.weeks })); $s.CR.lastMsg = 'Contrato assinado com ' + o.brand + '.'; } saveCareer(); renderCareer(); }));
  body.querySelectorAll('[data-sp-no]').forEach(bt => bt.addEventListener('click', () => { $s.CR.spOffers.splice(+bt.dataset.spNo, 1); saveCareer(); renderCareer(); }));
  body.querySelectorAll('[data-equip]').forEach(bt => bt.addEventListener('click', () => { $s.CR.racket = bt.dataset.equip; $s.CR.me.look.racket = $s.CR.racket; saveCareer(); renderCareer(); }));
  body.querySelectorAll('[data-gear]').forEach(bt => bt.addEventListener('click', () => { const g = GEAR.find(x => x.id === bt.dataset.gear); if ($s.CR.money >= g.preco) { $s.CR.money -= g.preco; if (g.staff) $s.CR.staff[g.id] = true; else $s.CR.gear.push(g.id); $s.CR.lastMsg = 'Comprou: ' + g.nome + '.'; crSyncChars(); saveCareer(); } renderCareer(); }));
  body.querySelectorAll('input[name=crGames]').forEach(r => r.addEventListener('change', () => { $s.CR.games = +r.value; saveCareer(); }));
  const ms = $('crMeSide'); if (ms) ms.addEventListener('change', () => { $s.CR.side = ms.value; saveCareer(); });
  if (crTab === 'jogador') bindLook();
  const mu = $('crMeUf'); if (mu) mu.addEventListener('change', () => { $s.CR.me.uf = mu.value; crSyncChars(); saveCareer(); renderCareer(); });
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
if (CL.sess) clSyncAll().then(() => acctBtnTxt());
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
  crCreate({ uf: $('crUf') ? $('crUf').value : 'SP', hairStyle: $('crHairSt').value || '', beard: $('crBeard').value || '', pais: $('crNat').value || 'BRA', name: ($('crName').value || '').trim() || 'Promessa', fem: crForm.fem, alt: crForm.alt, style: crForm.style, perfil: crForm.perfil, attrs: crForm.attrs, start: +($('crStart') ? $('crStart').value : 0) || 0, skin: crForm.skin, hair: crForm.hair, acc: crForm.acc, canhoto: crForm.canhoto, glasses: Math.random() < .5 });
  crTab = 'agenda'; $s.CR.lastMsg = 'Bem-vindo ao circuito! Comece pelo ' + TIERS[$s.CR.startTier || 0].nome + ', ache um parceiro e suba no ranking.'; saveCareer(); renderCareer();
}
// pelo menu principal sempre abre a tela de escolher/criar (a carreira aberta é salva e fechada); a volta de uma partida continua indo direto
$('btnCareer').addEventListener('click', () => { if ($s.CR) { saveCareer(); crCloseSlot(); } crEntry = null; crSaveMsg(''); openCareer(); });
$('crBack').addEventListener('click', () => { $('career').hidden = true; toMenu(); });
$('crCreate').addEventListener('click', crStart);
$('crNat').innerHTML = COUNTRIES.map(c => '<option value="' + c.code + '"' + (c.code === 'BRA' ? ' selected' : '') + '>' + c.nome + '</option>').join('');
const natFlag = () => { $('crNatFlag').innerHTML = flagSVG($('crNat').value); const uw = $('crUfWrap'); if (uw) uw.hidden = $('crNat').value !== 'BRA'; };
$('crUf').innerHTML = STATES.map(([k, n]) => '<option value="' + k + '">' + n + '</option>').join('');
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
$('rkSel').innerHTML = Object.entries(RACKET_STATS).sort((x, y) => x[1].preco - y[1].preco).map(([k, r]) => '<option value="' + k + '">' + r.nome + ' (' + rkSummary(k) + ')</option>').join('');
$('rkSel').addEventListener('change', () => { rkInfo(); readMenu(); });
function startFromMenu() { ac(); readMenu(); newMatch(); }
function toMenu() {
  if (NET.role && NET.onMenu) { NET.onMenu(); return; } // online: volta para a sala, não para o menu
  if (S.careerActive) careerMatchEnded(false); // abandonar conta como derrota
  S.mode = 'menu'; S.paused = false; el.pause.hidden = true; el.over.hidden = true; el.menu.hidden = false;
  document.body.classList.add('in-menu'); hideBanner(); syncMenu(); menuStep('home');
}
// menu em passos: início (blocos) → partida rápida 1 (elenco e modalidade) → 2 (jogadores) → 3 (ajustes) → começar
function menuStep(st) {
  const m = $('menu'); m.dataset.step = st;
  m.querySelectorAll('section[data-step]').forEach(sec => { sec.hidden = sec.dataset.step !== st; });
  readMenu(); syncMenu();
  const dupla = S.settings.mode === 'dupla';
  const side = m.querySelector('input[name=side]'), tac = $('tacticSel');
  if (side) side.closest('fieldset').hidden = !dupla;
  if (tac) tac.closest('label').hidden = !dupla;
  m.scrollTop = 0;
}
document.querySelectorAll('#menu [data-goto]').forEach(b => b.addEventListener('click', () => { ac(); menuStep(b.dataset.goto); }));
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
  $('tutHow').hidden = true; ac(); readMenu(); S.careerDrill = false;
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
$('btnGameCfg').addEventListener('click', () => { $('gameCfg').hidden = false; });
$('gameCfgClose').addEventListener('click', () => { $('gameCfg').hidden = true; });
// nomes sobre os jogadores (pausa): alterna normal → pequenos → simples → escondidos
const TAG_STYLES = ['normal', 'pequena', 'simples', 'off'], TAG_TXT = { normal: 'normal', pequena: 'pequenos', simples: 'simples', off: 'escondidos' };
const syncTagsBtn = () => { $('btnTags').textContent = 'Nomes: ' + TAG_TXT[S.settings.tagStyle || 'normal']; };
$('btnTags').addEventListener('click', () => { const c = S.settings.tagStyle || 'normal'; S.settings.tagStyle = TAG_STYLES[(TAG_STYLES.indexOf(c) + 1) % TAG_STYLES.length]; saveSettings(); applyMeterLook(); syncTagsBtn(); });
syncTagsBtn();
document.querySelectorAll('[data-barcfg]').forEach(b => b.addEventListener('click', () => { $('barCfg').hidden = false; }));
$('barCfgClose').addEventListener('click', () => { $('barCfg').hidden = true; });
$('btnBall').addEventListener('click', () => { const l = Object.keys(BALL_STYLES), cur = S.settings.ballStyle || 'laranja'; S.settings.ballStyle = l[(l.indexOf(cur) + 1) % l.length]; saveSettings(); setBallStyle(S.settings.ballStyle); syncAssistButtons(); });
function syncAssistButtons() {
  $('btnAsMove').textContent = 'Seguir a bola: ' + (S.settings.assistMove ? 'ligado' : 'desligado');
  $('btnAsMark').textContent = 'Onde a bola cai: ' + (S.settings.assistMark ? 'ligado' : 'desligado');
  $('btnShotTxt').textContent = 'Nome do golpe: ' + SHOT_TXT[S.settings.shotText || 'discreto'];
  $('btnBall').textContent = 'Bolinha: ' + (BALL_STYLES[S.settings.ballStyle || 'laranja'] || BALL_STYLES.laranja).nome.replace(' (padrão)', '').toLowerCase();
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
