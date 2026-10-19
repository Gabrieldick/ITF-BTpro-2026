const fs = require('fs'), path = require('path');
const f = process.argv[2], dir = __dirname;
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, () => b); };
const rd = n => fs.readFileSync(path.join(dir, n), 'utf8');

// A) raquetes, equipamentos e equipe
{ const a = s.indexOf('// raquetes e equipamentos: alteram'), b = s.indexOf('const racketBonus = key => (RACKET_STATS[key] || RACKET_STATS.proteo).b;\n');
  if (a < 0 || b < 0) throw new Error('early block');
  s = s.slice(0, a) + rd('rackets-early.js') + s.slice(b + 'const racketBonus = key => (RACKET_STATS[key] || RACKET_STATS.proteo).b;\n'.length); }
// B) visuais das novas raquetes
rep('const RACKET_MATS = {};', rd('rackets-visual.js') + 'const RACKET_MATS = {};');
rep('  const cfg = RACKET_HOLES[key] || RACKET_HOLES.proteo;', '  const cfg = RACKET_HOLES[key] || RACKET_HOLES[(RACKETS[key] || {}).holes] || RACKET_HOLES.proteo;');
// C) menu: lista com todas as raquetes
rep(`      <fieldset class="seg"><legend>Raquete</legend><div class="pills">
        <input type="radio" name="racket" id="rkMed" value="medusa"><label for="rkMed">Medusa</label>
        <input type="radio" name="racket" id="rkKro" value="kronos"><label for="rkKro">Kronos</label>
        <input type="radio" name="racket" id="rkPro" value="proteo" checked><label for="rkPro">Proteo</label>
        <input type="radio" name="racket" id="rkSup" value="supercarbon"><label for="rkSup">Supercarbon</label>
      </div><p style="margin:.4rem 0 0;font-size:.78rem;color:#5b6b78">A raquete muda seus atributos: Medusa controle (+curta +defesa +backhand) · Proteo equilíbrio · Kronos potência (+força +smash +saque, −curta) · Supercarbon topo de linha.</p></fieldset>`,
`      <fieldset class="seg"><legend>Raquete</legend><select class="psel" id="rkSel" aria-label="Raquete"></select><p id="rkInfo" style="margin:.4rem 0 0;font-size:.78rem;color:#5b6b78"></p></fieldset>`);
rep("S.settings.racket = v('racket');", "S.settings.racket = $('rkSel').value || 'proteo';");
rep("set('racket', S.settings.racket);", "$('rkSel').value = RACKET_STATS[S.settings.racket] ? S.settings.racket : 'proteo'; rkInfo();");
// D) fictícios usam a raquete do seu nível
rep("      look.racket = ovr < 55 ? 'basica' : ovr < 63 ? 'fibra' : pick(['medusa', 'proteo', 'kronos', ovr > 78 ? 'supercarbon' : 'proteo']);",
    "      look.racket = pick(ovr < 52 ? ['basica', 'tropic'] : ovr < 58 ? ['tropic', 'brisa', 'fibra'] : ovr < 64 ? ['fibra', 'mare', 'coral', 'duna'] : ovr < 72 ? ['duna', 'medusa', 'proteo', 'coral', 'mare', 'tufao'] : ovr < 80 ? ['kronos', 'atol', 'proteo', 'ventosul', 'recife', 'tufao', 'medusa'] : ['supercarbon', 'tsunami', 'eclipse', 'recife', ovr > 85 ? 'zenite' : 'kronos']);");
// E) você em jogo: + psicólogo
rep("function crMeChar() { const m = CR.me; return Object.assign({}, m, { a: effA(m.a, crGearBonus(), crFatigue()) }); }\nconst crMeOvr = () => overall(effA(CR.me.a, crGearBonus(), racketBonus(CR.racket), crFatigue()));",
    "function crMental() { const b = {}; if (CR.staff.psico) for (const [k] of ATTRS) b[k] = 1; return b; }\nfunction crMeChar() { const m = CR.me; return Object.assign({}, m, { a: effA(m.a, crGearBonus(), crFatigue(), crMental()) }); }\nconst crMeOvr = () => overall(effA(CR.me.a, crGearBonus(), racketBonus(CR.racket), crFatigue(), crMental()));");
// F) evolução: equipe, mentor e curva bem mais íngreme no topo
rep("const crXpMul = () => 1 + (CR.staff.tecnico ? .5 : 0) + (CR.staff.preparador ? .3 : 0) + (CR.age <= 20 ? .3 : 0);",
    "const crXpMul = () => 1 + crStaffList().reduce((t, x) => t + (x.xp || 0), 0) + (CR.mentor > 0 ? .5 : 0) + (CR.age <= 20 ? .3 : 0);");
rep("const crUpCost = v => v < 55 ? 1 : v < 65 ? 2 : v < 72 ? 3 : v < 78 ? 5 : v < 84 ? 7 : v < 90 ? 10 : 14;",
    "// 60→70 é rápido, 70→80 bem mais lento, 80→90 o mais difícil\nconst crUpCostBase = v => v < 55 ? 1 : v < 62 ? 2 : v < 68 ? 3 : v < 72 ? 4 : v < 76 ? 6 : v < 80 ? 8 : v < 84 ? 12 : v < 88 ? 17 : v < 92 ? 24 : 32;\nconst crUpCost = (v, k) => Math.max(1, Math.round(crUpCostBase(v) * (crStaffList().some(x => x.cheap && x.cheap.includes(k)) ? .75 : 1)));");
rep("function crUpgrade(k) { const v = CR.me.a[k], c = crUpCost(v);", "function crUpgrade(k) { const v = CR.me.a[k], c = crUpCost(v, k);");
rep("const rows = ATTRS.map(([k, lbl]) => { const v = CR.me.a[k], c = crUpCost(v),", "const rows = ATTRS.map(([k, lbl]) => { const v = CR.me.a[k], c = crUpCost(v, k),");
// G) semana: energia da equipe, patrocínios, fama, eventos
rep("  CR.energy = Math.min(100, CR.energy + (CR.staff.preparador ? 18 : 10));", "  CR.energy = Math.min(100, CR.energy + 10 + crStaffList().reduce((t, x) => t + (x.energy || 0), 0));");
rep("  const rk = crRank(); if (rk <= 50) { const sp = (51 - rk) * 20; CR.money += sp; msg += (msg ? ' ' : '') + 'Patrocínio da semana: ' + money(sp) + '.'; }\n",
    "  const spm = crSponsorWeek(); if (spm) msg += (msg ? ' ' : '') + spm;\n  crAddFama(-.4); if (CR.mentor > 0) CR.mentor--; if (CR.wildcard > 0) CR.wildcard--;\n  crMaybeSponsor();\n  if (Math.random() < .3) { const ev = crRollEvent(); if (ev) msg += (msg ? ' ' : '') + ev; }\n");
// H) aulas: rendem conforme o nível, menos que um título, pouca energia
rep("function crCoach() { const g = 150 * (crMaxTier() + 1); CR.money += g; CR.energy = Math.max(0, CR.energy - 10);", "function crCoach() { const g = crLessonIncome(); CR.money += g; CR.energy = Math.max(0, CR.energy - 5);");
rep("<b>Dar aulas</b><span>+' + money(150 * (crMaxTier() + 1)) + ' · −10 energia · sem evolução</span>", "<b>Dar aulas</b><span>+' + money(crLessonIncome()) + ' · −5 energia · sem evolução</span><span>Rende mais conforme você sobe de nível.</span>");
// I) título: bônus de patrocínio e fama
rep("  if (place === 0) { CR.titles[t.tier] = (CR.titles[t.tier] || 0) + 1; CR.maxTier = Math.max(CR.maxTier, Math.min(8, t.tier + 1)); }",
    "  if (place === 0) { CR.titles[t.tier] = (CR.titles[t.tier] || 0) + 1; CR.maxTier = Math.max(CR.maxTier, Math.min(8, t.tier + 1));\n    const bon = CR.sponsors.reduce((x, sp) => x + sp.bonus, 0); if (bon) { CR.money += bon; t.sponsorBonus = bon; }\n    crAddFama(3 + t.tier * 2); if (Math.random() < .35) crMaybeSponsor(true); }\n  else if (place === 1) crAddFama(1 + t.tier * .5);");
rep("<span>Prêmio ' + money(s.prize) + ' · +' + s.pts + ' pts de ranking · +' + s.xp + ' pontos de evolução</span>'",
    "<span>Prêmio ' + money(s.prize) + (t.sponsorBonus ? ' + bônus de patrocínio ' + money(t.sponsorBonus) : '') + ' · +' + s.pts + ' pts de ranking · +' + s.xp + ' pontos de evolução</span>'");
// J) wildcard
rep("  return opts.filter((o, i, arr) => arr.findIndex(x => x.name === o.name) === i).slice(0, 4);",
    "  const list = opts.filter((o, i, arr) => arr.findIndex(x => x.name === o.name) === i).slice(0, 4);\n  if (CR.wildcard > 0 && top < 8) { const T = TIERS[top + 1]; list.unshift({ tier: top + 1, name: T.cities[Math.floor(rnd() * T.cities.length)] + ' (wildcard)', wild: true }); }\n  return list;");
rep("  const T = TIERS[opt.tier], cost = T.fee + T.travel;", "  const T = TIERS[opt.tier], cost = (opt.wild ? 0 : T.fee) + T.travel;");
rep("  CR.money -= cost;\n", "  CR.money -= cost; if (opt.wild) CR.wildcard = 0;\n");
rep("opts.map((o, i) => { const T = TIERS[o.tier]; const cost = T.fee + T.travel;", "opts.map((o, i) => { const T = TIERS[o.tier]; const cost = (o.wild ? 0 : T.fee) + T.travel;");
// K) agenda: evento pendente pede uma escolha antes de seguir
rep("function crAgendaHTML() {\n", "function crAgendaHTML() {\n  if (CR.event) return '<div class=\"cr-card gold\"><div class=\"eyebrow\">Evento da semana</div><b>' + esc(CR.event.text) + '</b><div class=\"cta-row\" style=\"margin-top:6px\">' + CR.event.opts.map((o, i) => '<button class=\"' + (i ? 'ghost' : 'cta') + ' sm\" data-ev=\"' + i + '\">' + esc(o) + '</button>').join('') + '</div></div>';\n");
// L) loja: raquetes (com desconto), equipamentos e equipe técnica
{ const a = s.indexOf('function crShopHTML() {'), b = s.indexOf('function crRankingHTML() {');
  s = s.slice(0, a) + `function crShopHTML() {
  const disc = CR.discount || 0;
  const rk = Object.entries(RACKET_STATS).sort((x, y) => x[1].preco - y[1].preco).map(([k, r]) => {
    const own = CR.rackets.includes(k), eq = CR.racket === k, price = Math.round(r.preco * (1 - disc));
    const bonus = Object.entries(r.b).map(([a, v]) => '<em class="' + (v > 0 ? 'up' : 'dn') + '">' + (v > 0 ? '+' : '') + v + ' ' + ATTRS.find(x => x[0] === a)[1] + '</em>').join(' ');
    return '<div class="cr-row' + (eq ? ' me' : '') + '"><span class="cr-rk" data-r="' + k + '"></span><div><b>' + r.nome + (eq ? ' · em uso' : '') + '</b><small>' + r.desc + '</small><small>' + bonus + '</small></div>' + (eq ? '' : own ? '<button class="ghost sm" data-equip="' + k + '">Usar</button>' : '<button class="cta sm" data-buy="' + k + '"' + (CR.money < price ? ' disabled' : '') + '>' + money(price) + '</button>') + '</div>';
  }).join('');
  const gr = GEAR.map(g => {
    const own = CR.gear.includes(g.id);
    const bonus = Object.entries(g.b).map(([a, v]) => '<em class="up">+' + v + ' ' + ATTRS.find(x => x[0] === a)[1] + '</em>').join(' ');
    return '<div class="cr-row"><span class="cr-ic">🎒</span><div><b>' + g.nome + '</b><small>' + g.desc + '</small><small>' + bonus + '</small></div>' + (own ? '<span class="cr-own">comprado</span>' : '<button class="cta sm" data-gear="' + g.id + '"' + (CR.money < g.preco ? ' disabled' : '') + '>' + money(g.preco) + '</button>') + '</div>';
  }).join('');
  const st = STAFF.map(x => {
    const own = !!CR.staff[x.id];
    return '<div class="cr-row' + (own ? ' me' : '') + '"><span class="cr-ic">' + (x.head ? '🧢' : '👤') + '</span><div><b>' + x.nome + '</b><small>' + x.desc + (x.head ? ' Só um técnico principal por vez.' : '') + '</small></div>' + (own ? '<span class="cr-own">contratado</span>' : '<button class="cta sm" data-hire="' + x.id + '"' + (CR.money < x.preco ? ' disabled' : '') + '>' + money(x.preco) + '</button>') + '</div>';
  }).join('');
  return (disc ? '<p class="cr-msg">Promoção ativa: ' + Math.round(disc * 100) + '% de desconto na próxima raquete.</p>' : '')
    + '<div class="cr-two"><div><p class="section-label">Raquetes (' + Object.keys(RACKET_STATS).length + ')</p><div class="cr-list">' + rk + '</div></div>'
    + '<div><p class="section-label">Equipe técnica (contrato até o fim da temporada)</p><div class="cr-list" style="max-height:260px">' + st + '</div><p class="section-label" style="margin-top:10px">Equipamentos</p><div class="cr-list" style="max-height:220px">' + gr + '</div></div></div>';
}
function crSponsorHTML() {
  const act = CR.sponsors.map(x => '<div class="cr-row me"><span class="cr-ic">🤝</span><div><b>' + esc(x.brand) + '</b><small>' + money(x.weekly) + ' por semana · bônus de ' + money(x.bonus) + ' por título · faltam ' + x.left + ' semanas</small></div></div>').join('');
  const off = CR.spOffers.map((x, i) => '<div class="cr-row"><span class="cr-ic">✉️</span><div><b>' + esc(x.brand) + '</b><small>' + money(x.weekly) + ' por semana durante ' + x.weeks + ' semanas · bônus de ' + money(x.bonus) + ' por título</small></div><div class="cta-row"><button class="cta sm" data-sp-ok="' + i + '"' + (CR.sponsors.length >= 2 ? ' disabled title="Máximo de 2 patrocinadores"' : '') + '>Assinar</button><button class="ghost sm" data-sp-no="' + i + '">Recusar</button></div></div>').join('');
  return '<div class="cr-energy"><span>Fama</span><span class="bar"><i class="hi" style="width:' + Math.round(CR.fama) + '%"></i></span><b>' + Math.round(CR.fama) + '</b></div>'
    + '<p class="cr-note">Fama sobe com títulos, finais e eventos (TV, redes, exibições) e cai devagar com o tempo. Quanto mais fama e mais alto o seu nível, melhores as propostas. Até 2 patrocinadores ao mesmo tempo (camisa e boné).</p>'
    + '<p class="section-label">Contratos ativos</p>' + (act || '<p class="cr-note">Nenhum ainda.</p>')
    + '<p class="section-label">Propostas</p>' + (off || '<p class="cr-note">Nenhuma proposta no momento. Vença torneios e apareça para atrair marcas.</p>');
}
` + s.slice(b); }
rep('<button type="button" data-t="historico">Histórico</button>', '<button type="button" data-t="patrocinio">Patrocínios</button><button type="button" data-t="historico">Histórico</button>');
rep("loja: crShopHTML, ranking: crRankingHTML, historico: crHistoryHTML }[crTab])();", "loja: crShopHTML, patrocinio: crSponsorHTML, ranking: crRankingHTML, historico: crHistoryHTML }[crTab])();");
rep("' · potencial ' + CR.pot + ' · em jogo ' + inGame + '</span>", "' · potencial ' + CR.pot + ' · em jogo ' + inGame + ' · fama ' + Math.round(CR.fama || 0) + '</span>");
// M) botões novos
rep("  body.querySelectorAll('[data-buy]').forEach(bt => bt.addEventListener('click', () => { const k = bt.dataset.buy, r = RACKET_STATS[k]; if (CR.money >= r.preco) { CR.money -= r.preco; CR.rackets.push(k); CR.racket = k; CR.lastMsg = 'Comprou a ' + r.nome + '.'; saveCareer(); } renderCareer(); }));",
    `  body.querySelectorAll('[data-buy]').forEach(bt => bt.addEventListener('click', () => { const k = bt.dataset.buy, r = RACKET_STATS[k], price = Math.round(r.preco * (1 - (CR.discount || 0))); if (CR.money >= price) { CR.money -= price; CR.discount = 0; CR.rackets.push(k); CR.racket = k; CR.me.look.racket = k; CR.lastMsg = 'Comprou a ' + r.nome + '.'; saveCareer(); } renderCareer(); }));
  body.querySelectorAll('[data-hire]').forEach(bt => bt.addEventListener('click', () => { crHire(bt.dataset.hire); renderCareer(); }));
  body.querySelectorAll('[data-ev]').forEach(bt => bt.addEventListener('click', () => { crResolveEvent(+bt.dataset.ev); renderCareer(); }));
  body.querySelectorAll('[data-sp-ok]').forEach(bt => bt.addEventListener('click', () => { const o = CR.spOffers.splice(+bt.dataset.spOk, 1)[0]; if (o && CR.sponsors.length < 2) { CR.sponsors.push(Object.assign(o, { left: o.weeks })); CR.lastMsg = 'Contrato assinado com ' + o.brand + '.'; } saveCareer(); renderCareer(); }));
  body.querySelectorAll('[data-sp-no]').forEach(bt => bt.addEventListener('click', () => { CR.spOffers.splice(+bt.dataset.spNo, 1); saveCareer(); renderCareer(); }));`);
// N) lógica nova e migração
rep("// ---------- telas ----------", rd('career-extra.js') + "\n// ---------- telas ----------");
rep("function openCareer() { readMenu(); el.menu.hidden = true; $('career').hidden = false; document.body.classList.add('in-menu'); if (CR) crSyncChars(); renderCareer(); }",
    "function openCareer() { readMenu(); el.menu.hidden = true; $('career').hidden = false; document.body.classList.add('in-menu'); if (CR) { crMigrate(); crSyncChars(); } renderCareer(); }");
rep("  if (!promessa) CR.racket = 'fibra';", "  if (!promessa) CR.racket = 'fibra';\n  crMigrate();");
rep("\nif (CR) crSyncChars();", `
if (CR) { crMigrate(); crSyncChars(); }
// lista de raquetes do menu principal
function rkInfo() {
  const r = RACKET_STATS[$('rkSel').value]; if (!r) return;
  $('rkInfo').innerHTML = esc(r.desc) + ' ' + Object.entries(r.b).map(([a, v]) => '<em class="' + (v > 0 ? 'up' : 'dn') + '">' + (v > 0 ? '+' : '') + v + ' ' + ATTRS.find(x => x[0] === a)[1] + '</em>').join(' ');
}
$('rkSel').innerHTML = Object.entries(RACKET_STATS).sort((x, y) => x[1].preco - y[1].preco).map(([k, r]) => '<option value="' + k + '">' + r.nome + '</option>').join('');
$('rkSel').addEventListener('change', () => { rkInfo(); readMenu(); });`);
fs.writeFileSync(f, s); console.log('ok');
