// ---------- saves antigos ----------
function crMigrate() {
  if (!CR) return;
  CR.fama = CR.fama || 0; CR.sponsors = CR.sponsors || []; CR.spOffers = CR.spOffers || []; CR.mentor = CR.mentor || 0; CR.discount = CR.discount || 0; CR.wildcard = CR.wildcard || 0;
  if (CR.staff.tecnico) { delete CR.staff.tecnico; CR.staff.tec2 = true; }
  if (CR.staff.preparador) { delete CR.staff.preparador; CR.staff.prep = true; }
}
// ---------- equipe técnica ----------
const crStaffList = () => STAFF.filter(s => CR.staff[s.id]);
function crHire(id) {
  const s = STAFF.find(x => x.id === id); if (!s || CR.staff[id] || CR.money < s.preco) return;
  if (s.head) STAFF.filter(x => x.head).forEach(x => delete CR.staff[x.id]); // um técnico principal por vez
  CR.money -= s.preco; CR.staff[id] = true; CR.lastMsg = 'Contratado até o fim da temporada: ' + s.nome + '.'; saveCareer();
}
// ---------- aulas ----------
// rende conforme o nível, sempre bem menos que o título do seu nível
const crLessonIncome = () => Math.max(120, Math.round(TIERS[crMaxTier()].prize[0] * .15 / 10) * 10);
// ---------- fama e patrocínio ----------
const BRANDS = ['Areia Fina', 'Solar Max Protetor', 'MarAzul Seguros', 'Coco Gelado', 'Tropicália Moda Praia', 'Ondas Telecom', 'Brisa Energéticos', 'Duna Óculos', 'Litoral Bank', 'Salina Isotônico', 'Farol Viagens', 'Arrecife Calçados', 'Maresia Relógios', 'Sol & Sal Cosméticos'];
function crAddFama(v) { CR.fama = clamp((CR.fama || 0) + v, 0, 100); }
function crMaybeSponsor(force) {
  if (CR.sponsors.length + CR.spOffers.length >= 4) return;
  if (!force && Math.random() > .08 + CR.fama / 250) return;
  const used = new Set(CR.sponsors.concat(CR.spOffers).map(s => s.brand));
  const free = BRANDS.filter(b => !used.has(b)); if (!free.length) return;
  const weekly = Math.round((30 + 22 * Math.pow(crMaxTier() + 1, 1.7) + CR.fama * 4) * rand(.75, 1.25) / 10) * 10;
  const weeks = Math.random() < .5 ? 13 : 26;
  CR.spOffers.push({ brand: free[Math.floor(Math.random() * free.length)], weekly, bonus: weekly * (3 + Math.floor(Math.random() * 4)), weeks });
}
function crSponsorWeek() {
  let paid = 0; const ended = [];
  CR.sponsors.forEach(s => { paid += s.weekly; s.left--; if (s.left <= 0) ended.push(s.brand); });
  CR.sponsors = CR.sponsors.filter(s => s.left > 0);
  CR.money += paid;
  return (paid ? 'Patrocínios: +' + money(paid) + '.' : '') + (ended.length ? ' Contrato encerrado: ' + ended.join(', ') + '.' : '');
}
// ---------- eventos aleatórios ----------
const EVENTS = {
  clinica: { w: 3, ok: () => true, run: () => { const g = Math.round(crLessonIncome() * .7); CR.money += g; CR.energy = Math.max(0, CR.energy - 5); return 'Um clube te chamou para uma clínica no fim de semana: +' + money(g) + '.'; } },
  treinoPro: { w: 2, ok: () => true, run: () => { const g = 2 + Math.floor(Math.random() * 3); CR.pe += g; return 'Um jogador do top 20 te chamou para treinar junto: +' + g + ' pontos de evolução.'; } },
  chuva: { w: 2, ok: () => true, run: () => { CR.energy = Math.min(100, CR.energy + 15); return 'Chuva a semana toda: treinos cancelados, mas o corpo agradeceu (+15 energia).'; } },
  calor: { w: 2, ok: () => true, run: () => { CR.energy = Math.max(0, CR.energy - 15); return 'Onda de calor na areia: −15 de energia.'; } },
  viral: { w: 1.5, ok: () => true, run: () => { crAddFama(6); crMaybeSponsor(true); return 'Um ponto seu viralizou nas redes! +6 de fama e uma marca quer conversar (veja Patrocínios).'; } },
  imprensa: { w: 1.5, ok: () => CR.fama >= 10, run: () => { crAddFama(3); return 'Entrevista na TV sobre o seu momento no circuito: +3 de fama.'; } },
  promo: { w: 1.5, ok: () => true, run: () => { CR.discount = .3; return 'Promoção na loja: 30% de desconto na próxima raquete.'; } },
  bolsa: { w: 1, ok: () => crMaxTier() >= 3, run: () => { const g = TIERS[crMaxTier()].travel; CR.money += g; return 'A federação liberou uma bolsa de viagem: +' + money(g) + '.'; } },
  wildcard: { w: 1.2, ok: () => crMaxTier() < 8, run: () => { CR.wildcard = 2; return 'Você ganhou um wildcard para um torneio acima do seu nível na próxima semana!'; } },
  lesao: { w: 1.6, ok: () => true, choice: () => { const c = CR.staff.fisio ? 0 : 150 * (crMaxTier() + 1); return { text: 'Você sentiu o ombro no treino.', opts: [c ? 'Fisioterapia (' + money(c) + ')' : 'Tratar com seu fisioterapeuta', 'Seguir no sacrifício (−' + (CR.staff.fisio ? 15 : 30) + ' energia)'], data: { c } }; },
    resolve: (i, d) => { if (i === 0) { if (CR.money < d.c) { CR.energy = Math.max(0, CR.energy - 30); return 'Sem dinheiro para a fisioterapia: −30 de energia.'; } CR.money -= d.c; return 'Ombro tratado, sem prejuízo.'; } CR.energy = Math.max(0, CR.energy - (CR.staff.fisio ? 15 : 30)); return 'Jogando no sacrifício: energia caiu.'; } },
  quebrou: { w: 1.3, ok: () => CR.racket !== 'basica', choice: () => { const r = RACKET_STATS[CR.racket], c = Math.round(r.preco * .2); return { text: 'Sua ' + r.nome + ' trincou num smash.', opts: ['Consertar (' + money(c) + ')', 'Aposentar a raquete'], data: { c } }; },
    resolve: (i, d) => { if (i === 0 && CR.money >= d.c) { CR.money -= d.c; return 'Raquete consertada.'; } const old = CR.racket; CR.rackets = CR.rackets.filter(k => k !== old); if (!CR.rackets.includes('basica')) CR.rackets.push('basica'); CR.racket = CR.rackets.slice().sort((a, b) => RACKET_STATS[b].preco - RACKET_STATS[a].preco)[0]; CR.me.look.racket = CR.racket; return 'Você voltou para a ' + RACKET_STATS[CR.racket].nome + '.'; } },
  parceiro: { w: 1.4, ok: () => !!CR.partner, choice: () => ({ text: nameOf(crChar(CR.partner)) + ' anda insatisfeito com a divisão de bolas.', opts: ['Conversar e acertar', 'Deixar para lá'] }),
    resolve: i => { if (i === 0) { CR.chem = Math.min(5, CR.chem + 1); return 'Conversa boa: entrosamento subiu.'; } CR.chem = Math.max(0, CR.chem - 2); if (Math.random() < .35) { const n = nameOf(crChar(CR.partner)); CR.partner = null; CR.chem = 0; return n + ' desfez a dupla.'; } return 'O clima esfriou: entrosamento caiu.'; } },
  beneficente: { w: 1.2, ok: () => true, choice: () => ({ text: 'Convite para um torneio beneficente de exibição.', opts: ['Jogar (−15 energia, +fama)', 'Recusar'] }),
    resolve: i => { if (i === 0) { CR.energy = Math.max(0, CR.energy - 15); crAddFama(7); crMaybeSponsor(); return 'Exibição lotada: +7 de fama.'; } return 'Você preferiu poupar energia.'; } },
  mentor: { w: 1, ok: () => CR.money > 400, choice: () => { const c = 300 * (crMaxTier() + 1); return { text: 'Um ex-campeão mundial se oferece para ser seu mentor por 4 semanas.', opts: ['Aceitar (' + money(c) + ', +50% de evolução)', 'Recusar'], data: { c } }; },
    resolve: (i, d) => { if (i === 0 && CR.money >= d.c) { CR.money -= d.c; CR.mentor = 4; return 'Mentoria começou: 4 semanas com +50% de evolução.'; } return 'Fica para a próxima.'; } },
  furto: { w: .8, ok: () => CR.gear.length > 0 && crMaxTier() >= 3, choice: () => { const id = CR.gear[Math.floor(Math.random() * CR.gear.length)], g = GEAR.find(x => x.id === id); return { text: 'Furtaram sua mochila na viagem: ' + g.nome + ' sumiu.', opts: ['Repor (' + money(g.preco) + ')', 'Ficar sem'], data: { id, c: g.preco } }; },
    resolve: (i, d) => { if (i === 0 && CR.money >= d.c) { CR.money -= d.c; return 'Equipamento reposto.'; } CR.gear = CR.gear.filter(x => x !== d.id); return 'Você vai jogar sem esse equipamento.'; } },
};
function crRollEvent() {
  const list = Object.entries(EVENTS).filter(([, e]) => e.ok());
  let r = Math.random() * list.reduce((t, [, e]) => t + e.w, 0);
  for (const [id, e] of list) { if ((r -= e.w) <= 0) {
    if (e.choice) { const c = e.choice(); CR.event = Object.assign({ id }, c); return ''; }
    return e.run();
  } }
  return '';
}
function crResolveEvent(i) {
  const ev = CR.event; if (!ev) return;
  CR.event = null; CR.lastMsg = EVENTS[ev.id].resolve(i, ev.data || {}) || ''; crSyncChars(); saveCareer();
}
