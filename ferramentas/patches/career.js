// ================= MODO CARREIRA =================
// circuito em escada (amador -> ITF -> Sand Series -> Mundial), ranking de 26 semanas, dinheiro, evolução e parceiros
const TIERS = [
  { id: 'C', nome: 'Amador Categoria C', curto: 'AMADOR C', ovr: [44, 58], draw: 8, fee: 30, travel: 0, prize: [400, 200, 90, 0], pts: [25, 16, 9, 4], xp: [6, 4, 3, 1], diff: 'facil', req: 0, cities: ['Copa Praia do Forte', 'Open Itapuã', 'Desafio Guarujá', 'Torneio da Pajuçara', 'Copa Jurerê', 'Open Ponta Negra'] },
  { id: 'B', nome: 'Amador Categoria B', curto: 'AMADOR B', ovr: [50, 64], draw: 8, fee: 60, travel: 0, prize: [900, 450, 180, 60], pts: [45, 30, 18, 8], xp: [8, 6, 4, 2], diff: 'facil', req: 60, cities: ['Open Balneário Camboriú', 'Copa Ipanema', 'Torneio Porto de Galinhas', 'Open Maresias', 'Copa Iracema'] },
  { id: 'A', nome: 'Amador Categoria A', curto: 'AMADOR A', ovr: [56, 69], draw: 8, fee: 120, travel: 60, prize: [1800, 900, 350, 120], pts: [75, 50, 30, 14], xp: [10, 7, 5, 2], diff: 'medio', req: 160, cities: ['Open Florianópolis', 'Copa Salvador', 'Open Búzios', 'Torneio Natal', 'Copa Vitória'] },
  { id: 'BT10', nome: 'ITF BT10', curto: 'BT10', ovr: [61, 74], draw: 8, fee: 200, travel: 250, prize: [3500, 1700, 700, 250], pts: [120, 80, 50, 20], xp: [12, 9, 6, 3], diff: 'medio', req: 320, cities: ['BT10 Fortaleza', 'BT10 Aruba', 'BT10 Maceió', 'BT10 Cascais', 'BT10 Valência'] },
  { id: 'BT50', nome: 'ITF BT50', curto: 'BT50', ovr: [66, 78], draw: 16, fee: 350, travel: 500, prize: [7000, 3500, 1600, 700, 200], pts: [200, 140, 90, 50, 18], xp: [15, 11, 8, 5, 2], diff: 'medio', req: 600, cities: ['BT50 Cervia', 'BT50 Barcelona', 'BT50 João Pessoa', 'BT50 Lignano', 'BT50 Montpellier'] },
  { id: 'BT100', nome: 'ITF BT100', curto: 'BT100', ovr: [70, 82], draw: 16, fee: 500, travel: 800, prize: [14000, 7000, 3200, 1300, 400], pts: [350, 240, 150, 80, 30], xp: [18, 13, 9, 6, 3], diff: 'medio', req: 1000, cities: ['BT100 Copacabana', 'BT100 Riccione', 'BT100 Aruba', 'BT100 Gran Canaria'] },
  { id: 'BT200', nome: 'ITF BT200', curto: 'BT200', ovr: [74, 86], draw: 16, fee: 800, travel: 1200, prize: [28000, 14000, 6500, 2600, 800], pts: [550, 380, 240, 130, 50], xp: [22, 16, 11, 7, 3], diff: 'dificil', req: 1600, cities: ['BT200 Rio de Janeiro', 'BT200 Ravenna', 'BT200 Terracina', 'BT200 Fortaleza'] },
  { id: 'BT400', nome: 'ITF BT400', curto: 'BT400', ovr: [78, 90], draw: 16, fee: 1200, travel: 1800, prize: [50000, 25000, 12000, 5000, 1500], pts: [850, 600, 380, 200, 80], xp: [26, 19, 13, 8, 4], diff: 'dificil', req: 2500, cities: ['BT400 Aruba', 'BT400 Ravenna', 'BT400 Copacabana', 'BT400 Cervia'] },
  { id: 'SS', nome: 'Sand Series', curto: 'SAND SERIES', ovr: [82, 95], draw: 16, fee: 2000, travel: 2500, prize: [90000, 45000, 22000, 9000, 3000], pts: [1300, 900, 580, 300, 120], xp: [32, 23, 16, 10, 5], diff: 'dificil', req: 3800, cities: ['Sand Series Cervia', 'Sand Series Fortaleza', 'Sand Series Ravenna', 'Sand Series Aruba'] },
  { id: 'WC', nome: 'Campeonato Mundial ITF', curto: 'MUNDIAL', ovr: [84, 99], draw: 16, fee: 0, travel: 3000, prize: [150000, 75000, 36000, 15000, 5000], pts: [2000, 1400, 900, 500, 200], xp: [40, 28, 20, 12, 6], diff: 'dificil', req: 1e9, cities: ['Mundial de Matosinhos'] },
];
const SEASON_WEEKS = 26;
// ---------- mundo fictício ----------
function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const NAME_BANK = {
  BRA: { m: ['Lucas', 'Pedro', 'Gabriel', 'Rafael', 'Thiago', 'Bruno', 'Diego', 'Felipe', 'Mateus', 'Caio', 'Vitor', 'Igor', 'Renan', 'Arthur', 'Enzo', 'Davi', 'Murilo', 'Otávio', 'Leandro', 'Rodrigo', 'Heitor', 'Samuel'], f: ['Ana', 'Beatriz', 'Carolina', 'Larissa', 'Fernanda', 'Gabriela', 'Isabela', 'Juliana', 'Letícia', 'Mariana', 'Natália', 'Paula', 'Camila', 'Bianca', 'Luana', 'Yasmin', 'Clara', 'Manuela', 'Lívia', 'Renata', 'Débora', 'Helena'], s: ['Silva', 'Souza', 'Costa', 'Ferreira', 'Almeida', 'Ribeiro', 'Carvalho', 'Gomes', 'Martins', 'Rocha', 'Barbosa', 'Pires', 'Teixeira', 'Moreira', 'Cardoso', 'Nunes', 'Lopes', 'Mendes', 'Freitas', 'Campos', 'Vieira', 'Fonseca'] },
  ITA: { m: ['Marco', 'Luca', 'Matteo', 'Andrea', 'Simone', 'Riccardo', 'Alessandro', 'Enrico', 'Paolo', 'Davide', 'Federico', 'Lorenzo'], f: ['Giulia', 'Chiara', 'Francesca', 'Martina', 'Sara', 'Alessia', 'Valentina', 'Elisa', 'Silvia', 'Aurora'], s: ['Rossi', 'Ferrari', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Galli', 'Conti', 'De Luca', 'Moretti', 'Fontana', 'Gatti'] },
  ESP: { m: ['Pablo', 'Javier', 'Sergio', 'Hugo', 'Álvaro', 'Iker', 'Adrián'], f: ['Lucía', 'Carmen', 'Inés', 'Paula', 'Irene', 'Noelia'], s: ['García', 'Martínez', 'López', 'Sánchez', 'Romero', 'Navarro', 'Torres', 'Ruiz'] },
  FRA: { m: ['Julien', 'Théo', 'Antoine', 'Louis', 'Maxime'], f: ['Camille', 'Léa', 'Chloé', 'Manon', 'Inès'], s: ['Moreau', 'Laurent', 'Girard', 'Dubois', 'Lefebvre', 'Mercier'] },
  RUS: { m: ['Ivan', 'Dmitri', 'Pavel', 'Artem', 'Sergei'], f: ['Anastasia', 'Daria', 'Olga', 'Polina', 'Ksenia'], s: ['Petrov', 'Smirnov', 'Volkov', 'Sokolov', 'Orlov', 'Kozlov'] },
  POR: { m: ['João', 'Nuno', 'Diogo', 'Tiago', 'Rui'], f: ['Inês', 'Mafalda', 'Beatriz', 'Rita', 'Matilde'], s: ['Pereira', 'Santos', 'Oliveira', 'Rodrigues', 'Antunes', 'Marques'] },
  ARG: { m: ['Nicolás', 'Joaquín', 'Facundo', 'Tomás'], f: ['Sofía', 'Valentina', 'Micaela', 'Agustina'], s: ['Fernández', 'González', 'Gómez', 'Díaz', 'Acosta'] },
};
const COUNTRY_W = [['BRA', .42], ['ITA', .2], ['ESP', .1], ['FRA', .06], ['RUS', .07], ['POR', .07], ['ARG', .08]];
const SKINS = ['#f1cfae', '#e2b48f', '#d2a07a', '#c68a5e', '#a8704a', '#8d5a3b', '#6b4229'];
const HAIRS = ['#120c08', '#2b1d14', '#3a2615', '#5a3a1e', '#6a3f1d', '#a8743a', '#c99a5a', '#7a5a3a'];
const STYLES = {
  atacante: { nome: 'Atacante', d: { forca: 5, smash: 6, saque: 4, def: -4, curta: -4, lob: -3, backhand: -2, vel: 0 } },
  defensor: { nome: 'Defensor', d: { def: 6, vel: 5, backhand: 3, smash: -4, forca: -4, saque: -3, curta: 0, lob: 0 } },
  tatico: { nome: 'Tático', d: { curta: 6, lob: 6, backhand: 3, forca: -5, smash: -4, saque: -2, def: 0, vel: -1 } },
  completo: { nome: 'Completo', d: {} },
};
// gera atributos com um overall alvo e um estilo
function makeAttrs(target, style, rnd) {
  const a = {}; const d = (STYLES[style] || STYLES.completo).d;
  for (const [k] of ATTRS) a[k] = target + (d[k] || 0) + Math.round((rnd() - .5) * 6);
  // ajusta para bater o overall alvo
  for (let i = 0; i < 6; i++) { const diff = target - overall(a); if (!diff) break; for (const [k] of ATTRS) a[k] += diff; }
  for (const [k] of ATTRS) a[k] = clamp(a[k], 30, 99);
  return a;
}
function genPool(seed) {
  const rnd = mulberry(seed); const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const country = () => { let r = rnd(); for (const [c, w] of COUNTRY_W) { if ((r -= w) <= 0) return c; } return 'BRA'; };
  const out = [], used = new Set();
  ['m', 'f'].forEach(g => {
    for (let i = 0; i < 150; i++) {
      const pais = country(), bank = NAME_BANK[pais];
      let name, tries = 0;
      do { let sur = pick(bank.s); if (g === 'f' && pais === 'RUS') sur += 'a'; name = pick(bank[g]) + ' ' + sur; } while (used.has(name) && ++tries < 20);
      used.add(name);
      // muitos jogadores fracos e poucos fortes (amadores até o topo do circuito)
      const ovr = Math.round(44 + 42 * Math.pow(rnd(), 1.25));
      const style = pick(['atacante', 'defensor', 'tatico', 'completo', 'completo']);
      const fem = g === 'f';
      const look = { skin: pick(SKINS), hair: pick(HAIRS), num: String(10 + Math.floor(rnd() * 89)) };
      const acc = rnd(); if (acc < .35) look.cap = pick(['#fbf6ea', '#17324d', '#0b7a83']); else if (acc < .65) look.visor = pick(['#fbf6ea', '#17324d', '#ff5a1f']);
      if (rnd() < .5) look.glasses = true; if (rnd() < .5) look.band = true; if (fem) look.tank = true;
      look.racket = ovr < 55 ? 'basica' : ovr < 63 ? 'fibra' : pick(['medusa', 'proteo', 'kronos', ovr > 78 ? 'supercarbon' : 'proteo']);
      out.push({ id: 'f' + g + i, name, alt: Math.round(fem ? 170 + (rnd() - .5) * 14 : 184 + (rnd() - .5) * 16), pais, estilo: STYLES[style].nome, build: pick(['atletico', 'atletico', 'esguio', 'compacto', 'forte']), fem, canhoto: rnd() < .12 || undefined, age: 18 + Math.floor(rnd() * 16), a: makeAttrs(ovr, style, rnd), look, fict: true });
    }
  });
  return out;
}

// ---------- estado ----------
let CR = null;
try { CR = JSON.parse(localStorage.getItem('pdo-career') || 'null'); } catch (e) { CR = null; }
const saveCareer = () => { try { localStorage.setItem('pdo-career', JSON.stringify(CR)); } catch (e) {} };
function crSyncChars() {
  CAREER_CHARS = CR ? CR.pool.concat([crMeChar()]) : [];
}
// você em jogo: atributos + equipamentos (a raquete entra na hora da partida) - cansaço
function crGearBonus() { const b = {}; (CR.gear || []).forEach(id => { const g = GEAR.find(x => x.id === id); if (g && g.b) for (const k in g.b) b[k] = (b[k] || 0) + g.b[k]; }); return b; }
function crFatigue() { const p = CR.energy < 60 ? -Math.round((60 - CR.energy) / 8) : 0; const b = {}; for (const [k] of ATTRS) b[k] = p; return b; }
function crMeChar() { const m = CR.me; return Object.assign({}, m, { a: effA(m.a, crGearBonus(), crFatigue()) }); }
const crMeOvr = () => overall(effA(CR.me.a, crGearBonus(), racketBonus(CR.racket), crFatigue()));
const crCharOvr = c => c.id === 'crme' ? crMeOvr() : overall(effA(c.a, racketBonus(c.look && c.look.racket)));
// mundo do seu gênero (fictícios + astros reais)
const crWorld = () => CR.pool.filter(c => !!c.fem === !!CR.me.fem).concat(ROSTER.filter(c => !!c.fem === !!CR.me.fem));
const crChar = id => id === 'crme' ? crMeChar() : (CR.pool.find(c => c.id === id) || ROSTER.find(c => c.id === id));
const absWeek = () => (CR.season - 1) * SEASON_WEEKS + CR.week;
const crPts = () => CR.results.filter(r => r.w > absWeek() - SEASON_WEEKS).reduce((t, r) => t + r.pts, 0);
function crRanking() {
  const list = crWorld().map(c => ({ id: c.id, pts: Math.round(CR.npc[c.id] || 0) }));
  list.push({ id: 'crme', pts: crPts() });
  return list.sort((x, y) => y.pts - x.pts || (x.id === 'crme' ? 1 : -1));
}
const crRank = () => crRanking().findIndex(r => r.id === 'crme') + 1;
const npcTier = o => { let t = 0; for (let i = 0; i < 9; i++) if (TIERS[i].ovr[0] + 3 <= o) t = i; return t; };
// semana dos outros: quem joga ganha pontos conforme a força dentro do nível
function crSimWorld(rnd) {
  rnd = rnd || Math.random;
  CR.pool.concat(ROSTER).forEach(c => {
    const o = crCharOvr(c), t = npcTier(o), T = TIERS[t];
    let p = (CR.npc[c.id] || 0) * (SEASON_WEEKS - 1) / SEASON_WEEKS;
    if (rnd() < .6) {
      const perf = (o - (T.ovr[0] + T.ovr[1]) / 2) / ((T.ovr[1] - T.ovr[0]) / 2) + gaussR(rnd) * .6;
      const idx = perf > 1.25 ? 0 : perf > .75 ? 1 : perf > .25 ? 2 : perf > -.35 ? 3 : 4;
      p += T.pts[Math.min(idx, T.pts.length - 1)];
    }
    CR.npc[c.id] = p;
  });
}
function gaussR(rnd) { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function crTierUnlocked(i) {
  if (i === 9) return false;
  return i === 0 || (CR.titles[i - 1] || 0) > 0 || crPts() >= TIERS[i].req || CR.maxTier >= i;
}
function crMaxTier() { let m = 0; for (let i = 0; i < 9; i++) if (crTierUnlocked(i)) m = i; return m; }
// opções da semana: torneios do seu nível, um abaixo e às vezes um acima para quem já pode
function crWeekOptions() {
  const rnd = mulberry(CR.seed + absWeek() * 97);
  const top = crMaxTier(), opts = [];
  const tiers = [top, Math.max(0, top - 1), top > 0 ? Math.max(0, top - 2) : top];
  if (CR.week === SEASON_WEEKS && crRank() <= 16) tiers.unshift(9);
  const seen = new Set();
  tiers.forEach((t, k) => {
    const T = TIERS[t]; let city = T.cities[Math.floor(rnd() * T.cities.length)];
    if (seen.has(t + city)) city = T.cities[(T.cities.indexOf(city) + 1) % T.cities.length];
    seen.add(t + city);
    opts.push({ tier: t, name: t >= 3 && t < 9 ? city : city + (t < 3 ? ' · ' + T.curto : '') });
  });
  return opts.filter((o, i, arr) => arr.findIndex(x => x.name === o.name) === i).slice(0, 4);
}

// ---------- criação ----------
function crCreate(o) {
  const seed = Math.floor(Math.random() * 1e9);
  const rnd = mulberry(seed + 7);
  const promessa = o.perfil === 'promessa';
  const target = promessa ? 52 : 60;
  const me = { id: 'crme', name: o.name || 'Você', alt: o.alt, pais: 'BRA', estilo: STYLES[o.style].nome, build: o.build || 'atletico', fem: o.fem, canhoto: o.canhoto || undefined,
    a: makeAttrs(target, o.style, rnd), look: Object.assign({ skin: o.skin, hair: o.hair, num: '99', racket: 'basica' }, o.acc === 'cap' ? { cap: '#fbf6ea' } : o.acc === 'visor' ? { visor: '#fbf6ea' } : {}, o.fem ? { tank: true } : {}, { glasses: !!o.glasses, band: true }) };
  CR = { v: 1, seed, me, pot: promessa ? 94 + Math.floor(rnd() * 4) : 86 + Math.floor(rnd() * 4), age: promessa ? 17 : 22,
    money: promessa ? 500 : 1200, pe: 0, energy: 100, season: 1, week: 1, results: [], npc: {}, titles: {}, maxTier: 0,
    partner: null, chem: 0, offers: [], beat: {}, racket: 'basica', rackets: promessa ? ['basica'] : ['basica', 'fibra'], gear: [], staff: {},
    history: [], ovrLog: [], tour: null, games: 4, lastMsg: '', pool: genPool(seed) };
  if (!promessa) CR.racket = 'fibra';
  const r2 = mulberry(seed + 11); for (let i = 0; i < SEASON_WEEKS; i++) crSimWorld(r2);
  CR.ovrLog.push({ s: 1, w: 1, o: overall(CR.me.a) });
  crSyncChars(); saveCareer();
}

// ---------- parceiros ----------
function crRankBonus() { const r = crRank(), n = crWorld().length + 1; return r <= 10 ? 8 : r <= 25 ? 6 : r <= 50 ? 4 : r <= n * .5 ? 2 : 0; }
function crWillPartner(c) {
  if (CR.offers.includes(c.id)) return { ok: true, why: 'Convite aceito' };
  const me = crMeOvr(), o = crCharOvr(c), beat = Math.min(2, CR.beat[c.id] || 0);
  const lim = me + 4 + crRankBonus() + beat * 3;
  if (o <= lim) return { ok: true, why: beat ? 'Respeita você: já perdeu para você' : 'Topa jogar com você' };
  return { ok: false, why: o - lim > 8 ? 'Fora do seu nível por enquanto' : 'Quer alguém com mais ranking ou que já o tenha vencido' };
}
function crSetPartner(id) { if (CR.partner !== id) { CR.partner = id; CR.chem = 0; } CR.offers = CR.offers.filter(x => x !== id); saveCareer(); }

// ---------- torneio ----------
const SEED8 = [[0, 7], [3, 4], [2, 5], [1, 6]], SEED16 = [[0, 15], [7, 8], [4, 11], [3, 12], [2, 13], [5, 10], [6, 9], [1, 14]];
const crTeamOvr = t => Math.round((crCharOvr(crChar(t.a)) + crCharOvr(crChar(t.b))) / 2);
const crTeamName = t => shortOf(crChar(t.a)) + ' / ' + shortOf(crChar(t.b));
function crEnter(opt) {
  const T = TIERS[opt.tier], cost = T.fee + T.travel;
  if (CR.money < cost) { CR.lastMsg = 'Dinheiro insuficiente para a inscrição e a viagem.'; return false; }
  if (!CR.partner) { // parceiro de ocasião: o melhor que aceitar dentro do nível
    const cand = crWorld().filter(c => crCharOvr(c) <= T.ovr[1] && crWillPartner(c).ok).sort((x, y) => crCharOvr(y) - crCharOvr(x));
    if (!cand.length) { CR.lastMsg = 'Ninguém aceitou ser seu parceiro neste torneio.'; return false; }
    CR.partner = cand[0].id; CR.chem = 0;
  }
  CR.money -= cost;
  const rnd = Math.random;
  const busy = new Set(['crme', CR.partner]);
  let lo = T.ovr[0] - 2, hi = T.ovr[1] + 2, field = [];
  const need = (T.draw - 1) * 2;
  while (field.length < need && hi < 120) {
    field = crWorld().filter(c => !busy.has(c.id)).filter(c => { const o = crCharOvr(c); return o >= lo && o <= hi; });
    lo -= 3; hi += 3;
  }
  field.sort(() => rnd() - .5); field = field.slice(0, need).sort((x, y) => crCharOvr(y) - crCharOvr(x));
  const teams = [{ a: 'crme', b: CR.partner, me: true }];
  for (let i = 0; i + 1 < field.length; i += 2) teams.push({ a: field[i].id, b: field[i + 1].id });
  teams.sort((x, y) => crTeamOvr(y) - crTeamOvr(x));
  const me = teams.findIndex(t => t.me);
  const seedOrder = T.draw === 16 ? SEED16 : SEED8;
  CR.tour = { tier: opt.tier, name: opt.name, teams, me, round: 0, alive: true, champion: null, done: false, beaten: [], log: [],
    rounds: [seedOrder.map(([a, b]) => ({ a: a < teams.length ? a : -1, b: b < teams.length ? b : -1, w: null, score: '' }))] };
  CR.tour.rounds[0].forEach(m => { if (m.w === null && (m.a < 0 || m.b < 0)) { m.w = m.a < 0 ? m.b : m.a; m.score = 'passa direto'; } });
  CR.lastMsg = ''; saveCareer();
  return true;
}
const crRoundNames = n => n === 4 ? ['Oitavas', 'Quartas', 'Semifinal', 'Final'] : ['Quartas', 'Semifinal', 'Final'];
const crNRounds = () => TIERS[CR.tour.tier].draw === 16 ? 4 : 3;
function crMyMatch() { const t = CR.tour; if (!t || t.done || t.round >= crNRounds()) return null; return t.rounds[t.round].find(m => m.w === null && (m.a === t.me || m.b === t.me)) || null; }
function crScore(N, rnd) { const l = Math.floor((rnd || Math.random)() * (N - 1)); return N + '–' + l; }
function crSimOne(m, isMine) {
  const t = CR.tour, A = t.teams[m.a], B = t.teams[m.b];
  let sa = crTeamOvr(A), sb = crTeamOvr(B);
  if (A.me) sa += CR.chem * .4; if (B.me) sb += CR.chem * .4;
  const pA = 1 / (1 + Math.exp(-(sa - sb) / 3));
  m.w = Math.random() < pA ? m.a : m.b;
  const N = isMine ? CR.games : 6; m.score = crScore(N);
}
function crAfterMyMatch(won) {
  const t = CR.tour; CR.energy = Math.max(0, CR.energy - 10);
  const mm = t.rounds[t.round].find(m => m.a === t.me || m.b === t.me);
  const opp = t.teams[mm.a === t.me ? mm.b : mm.a];
  CR.pe += Math.round((won ? 2 + t.tier * .5 : 1) * crXpMul());
  if (won) { [opp.a, opp.b].forEach(id => { CR.beat[id] = (CR.beat[id] || 0) + 1; t.beaten.push(id); }); }
  else t.alive = false;
  t.log.push((won ? 'Vitória' : 'Derrota') + ' ' + mm.score + ' contra ' + crTeamName(opp));
  crAdvance();
  if (!t.alive) while (t.champion === null) crAdvance();
  if (t.champion !== null) crFinishTour();
  saveCareer();
}
function crAdvance() {
  const t = CR.tour, cur = t.rounds[t.round];
  cur.forEach(m => { if (m.w === null) crSimOne(m, false); });
  if (cur.length === 1) { t.champion = cur[0].w; t.round = crNRounds(); return; }
  const nx = []; for (let k = 0; k < cur.length; k += 2) nx.push({ a: cur[k].w, b: cur[k + 1].w, w: null, score: '' });
  t.rounds.push(nx); t.round++;
}
function crPlaySim() {
  const mm = crMyMatch(); if (!mm) return;
  crSimOne(mm, true); crAfterMyMatch(mm.w === CR.tour.me);
}
function crFinishTour() {
  const t = CR.tour, T = TIERS[t.tier], nR = crNRounds();
  // fase em que caiu: 0 campeão, 1 vice, 2 semi, 3 quartas, 4 oitavas
  let place = 0;
  if (t.champion !== t.me) { const lostAt = t.rounds.findIndex(rd => rd.some(m => (m.a === t.me || m.b === t.me) && m.w !== null && m.w !== t.me)); place = nR - lostAt; }
  const prize = T.prize[place] || 0, pts = T.pts[place] || 0, xp = Math.round((T.xp[place] || 0) * crXpMul());
  CR.money += prize; CR.pe += xp;
  CR.results.push({ w: absWeek(), pts });
  if (place === 0) { CR.titles[t.tier] = (CR.titles[t.tier] || 0) + 1; CR.maxTier = Math.max(CR.maxTier, Math.min(8, t.tier + 1)); }
  CR.chem = Math.min(5, CR.chem + 1);
  // quem você venceu pode querer jogar com você
  const offers = [];
  const myPartnerO = CR.partner ? crCharOvr(crChar(CR.partner)) : 0;
  [...new Set(t.beaten)].forEach(id => { const c = crChar(id); if (!c || CR.offers.includes(id) || id === CR.partner) return; const o = crCharOvr(c); if (o > myPartnerO && o <= crMeOvr() + 14 && Math.random() < .4) offers.push(id); });
  CR.offers = CR.offers.concat(offers).slice(-4);
  const placeName = place === 0 ? 'Campeão' : place === 1 ? 'Vice-campeão' : place === 2 ? 'Semifinal' : place === 3 ? 'Quartas' : 'Oitavas';
  t.summary = { place, placeName, prize, pts, xp, offers };
  CR.history.unshift({ s: CR.season, w: CR.week, name: t.name, tier: T.curto, place: placeName, prize, pts, partner: CR.partner ? nameOf(crChar(CR.partner)) : '' });
  CR.history = CR.history.slice(0, 60);
  t.done = true;
}
const crXpMul = () => 1 + (CR.staff.tecnico ? .5 : 0) + (CR.staff.preparador ? .3 : 0);

// ---------- semana ----------
function crNextWeek(note) {
  CR.tour = null;
  CR.energy = Math.min(100, CR.energy + (CR.staff.preparador ? 18 : 10));
  crSimWorld();
  CR.week++;
  let msg = note || '';
  if (CR.week > SEASON_WEEKS) {
    const pos = crRank();
    msg = 'Fim da temporada ' + CR.season + ': você terminou em ' + pos + 'º no ranking. ' + msg;
    CR.season++; CR.week = 1; CR.age++; CR.staff = {};
    // o mundo envelhece: jovens melhoram, veteranos caem
    CR.pool.forEach(c => { c.age = (c.age || 24) + 1; const d = c.age < 23 ? 2 : c.age < 28 ? 1 : c.age > 32 ? -1.5 : 0; const ch = Math.round(d + gauss() * 1.2); for (const [k] of ATTRS) c.a[k] = clamp(c.a[k] + ch, 30, 97); });
    if (CR.age > 31) for (const [k] of [['vel']]) CR.me.a[k] = Math.max(40, CR.me.a[k] - 1);
  }
  CR.ovrLog.push({ s: CR.season, w: CR.week, o: overall(CR.me.a) }); CR.ovrLog = CR.ovrLog.slice(-80);
  CR.lastMsg = msg; crSyncChars(); saveCareer();
}
function crTrain() {
  const cost = 80 * (crMaxTier() + 1);
  if (CR.money < cost) { CR.lastMsg = 'Treino custa $' + cost + '.'; return; }
  if (CR.energy < 20) { CR.lastMsg = 'Energia baixa demais para treinar: descanse.'; return; }
  CR.money -= cost; CR.energy -= 15; const g = Math.round(5 * crXpMul()); CR.pe += g;
  crNextWeek('Semana de treino: +' + g + ' pontos de evolução.');
}
function crRest() { CR.energy = Math.min(100, CR.energy + 45); crNextWeek('Semana de descanso: energia recuperada.'); }
const crUpCost = v => v < 55 ? 1 : v < 65 ? 2 : v < 75 ? 3 : v < 85 ? 4 : v < 92 ? 6 : 8;
const crCap = () => Math.min(99, CR.pot + 3);
function crUpgrade(k) { const v = CR.me.a[k], c = crUpCost(v); if (CR.pe < c || v >= crCap()) return; CR.pe -= c; CR.me.a[k]++; crSyncChars(); saveCareer(); }

// ---------- partida jogada ----------
function crPlayMatch() {
  const mm = crMyMatch(); if (!mm) return;
  const t = CR.tour, opp = t.teams[mm.a === t.me ? mm.b : mm.a];
  CR.prev = { pick: Object.assign({}, S.settings.pick), mode: S.settings.mode, diff: S.settings.diff, racket: S.settings.racket, games: S.settings.games };
  crSyncChars();
  S.settings.mode = 'dupla'; S.settings.diff = TIERS[t.tier].diff; S.settings.racket = CR.racket; S.settings.games = CR.games;
  S.settings.pick = { me: 'crme', mate: CR.partner, o1: opp.a, o2: opp.b };
  S.careerActive = true; saveCareer();
  $('career').hidden = true; ac(); newMatch();
}
function careerMatchEnded(won) {
  S.careerActive = false;
  const mm = crMyMatch();
  if (CR.prev) { Object.assign(S.settings, { pick: CR.prev.pick, mode: CR.prev.mode, diff: CR.prev.diff, racket: CR.prev.racket, games: CR.prev.games }); CR.prev = null; }
  if (!mm) return;
  const g = S.score.games;
  mm.w = won ? CR.tour.me : (mm.a === CR.tour.me ? mm.b : mm.a);
  mm.score = Math.max(g[0], g[1]) + '–' + Math.min(g[0], g[1]);
  crAfterMyMatch(won);
}

// ---------- telas ----------
let crTab = 'agenda';
const money = v => '$' + Math.round(v).toLocaleString('pt-BR');
function openCareer() { readMenu(); el.menu.hidden = true; $('career').hidden = false; document.body.classList.add('in-menu'); if (CR) crSyncChars(); renderCareer(); }
function renderCareer() {
  $('crNew').hidden = !!CR; $('crHub').hidden = !CR;
  if (!CR) { renderCrNew(); return; }
  const meO = overall(CR.me.a), inGame = crMeOvr(), rank = crRank(), pts = crPts();
  $('crHead').innerHTML = '<div class="cr-id"><div class="ovr">' + meO + '<small>OVR</small></div><div><b>' + esc(CR.me.name) + '</b><span>' + CR.age + ' anos · ' + CR.me.estilo + ' · potencial ' + CR.pot + ' · em jogo ' + inGame + '</span></div></div>'
    + '<div class="cr-kpis"><div><b>' + rank + 'º</b>ranking (' + pts + ' pts)</div><div><b>' + money(CR.money) + '</b>dinheiro</div><div><b>' + CR.pe + '</b>pontos de evolução</div><div><b>T' + CR.season + ' · S' + CR.week + '</b>de ' + SEASON_WEEKS + ' semanas</div></div>'
    + '<div class="cr-energy"><span>Energia</span><span class="bar"><i class="' + (CR.energy < 40 ? 'lo' : CR.energy > 75 ? 'hi' : '') + '" style="width:' + CR.energy + '%"></i></span><b>' + CR.energy + '</b></div>';
  document.querySelectorAll('#crTabs button').forEach(b => b.classList.toggle('sel', b.dataset.t === crTab));
  const busy = CR.tour && !CR.tour.done;
  $('crTabs').hidden = !!CR.tour;
  $('crMsg').textContent = CR.lastMsg || ''; $('crMsg').hidden = !CR.lastMsg;
  const body = $('crBody');
  if (CR.tour) { body.innerHTML = crTourHTML(); bindTour(); return; }
  body.innerHTML = ({ agenda: crAgendaHTML, jogador: crPlayerHTML, parceiros: crPartnersHTML, loja: crShopHTML, ranking: crRankingHTML, historico: crHistoryHTML }[crTab])();
  bindCareerBody();
}
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
function crAgendaHTML() {
  const opts = crWeekOptions(), p = CR.partner ? crChar(CR.partner) : null;
  const ladder = TIERS.map((T, i) => '<span class="' + (crTierUnlocked(i) || (i === 9 && CR.week === SEASON_WEEKS && crRank() <= 16) ? 'on' : '') + (CR.titles[i] ? ' won' : '') + '" title="' + esc(T.nome) + (i && i < 9 ? ' · libera com ' + T.req + ' pts ou título no nível abaixo' : i === 9 ? ' · última semana, top 16' : '') + '">' + T.curto + (CR.titles[i] ? ' 🏆' + CR.titles[i] : '') + '</span>').join('');
  return '<div class="cr-ladder">' + ladder + '</div>'
    + '<p class="cr-note">Parceiro: <b>' + (p ? esc(nameOf(p)) + ' (' + crCharOvr(p) + ')' : 'nenhum — um parceiro de ocasião será escolhido na inscrição') + '</b>' + (p ? ' · entrosamento ' + '★'.repeat(CR.chem) + '☆'.repeat(5 - CR.chem) : '') + '</p>'
    + '<div class="cr-cards">' + opts.map((o, i) => { const T = TIERS[o.tier]; const cost = T.fee + T.travel; return '<div class="cr-card' + (o.tier === 9 ? ' gold' : '') + '"><div class="eyebrow">' + T.nome + ' · chave de ' + T.draw + '</div><b>' + esc(o.name) + '</b><span>Adversários OVR ' + T.ovr[0] + '–' + T.ovr[1] + '</span><span>Campeão: ' + money(T.prize[0]) + ' · ' + T.pts[0] + ' pts</span><span>Custo: ' + money(cost) + (T.travel ? ' (inscrição ' + money(T.fee) + ' + viagem ' + money(T.travel) + ')' : '') + '</span><button class="cta sm" data-enter="' + i + '"' + (CR.money < cost ? ' disabled' : '') + '>Inscrever</button></div>'; }).join('')
    + '<div class="cr-card"><div class="eyebrow">Semana de treino</div><b>Treinar</b><span>+' + Math.round(5 * crXpMul()) + ' pontos de evolução · −15 energia</span><span>Custo: ' + money(80 * (crMaxTier() + 1)) + '</span><button class="ghost sm" id="crTrain">Treinar</button></div>'
    + '<div class="cr-card"><div class="eyebrow">Semana livre</div><b>Descansar</b><span>+45 de energia. Jogador cansado rende menos.</span><button class="ghost sm" id="crRest">Descansar</button></div></div>';
}
function crPlayerHTML() {
  const gear = crGearBonus(), rk = racketBonus(CR.racket);
  const rows = ATTRS.map(([k, lbl]) => { const v = CR.me.a[k], c = crUpCost(v), extra = (gear[k] || 0) + (rk[k] || 0); return '<span>' + lbl + '</span><span class="bar"><i class="' + (v >= 85 ? 'hi' : v <= 60 ? 'lo' : '') + '" style="width:' + v + '%"></i></span><b>' + v + (extra ? '<em class="' + (extra > 0 ? 'up' : 'dn') + '">' + (extra > 0 ? '+' : '') + extra + '</em>' : '') + '</b><button class="arw" data-up="' + k + '"' + (CR.pe < c || v >= crCap() ? ' disabled' : '') + ' title="Custa ' + c + ' ponto(s)">+' + c + '</button>'; }).join('');
  const log = CR.ovrLog.filter((x, i, a) => i === 0 || x.o !== a[i - 1].o).slice(-12).map(x => 'T' + x.s + 'S' + x.w + ': ' + x.o).join(' → ');
  return '<div class="cr-two"><div><p class="section-label">Atributos (gaste pontos de evolução)</p><div class="bars cr-bars">' + rows + '</div><p class="cr-note">Limite pelo potencial: ' + crCap() + '. Em verde/vermelho: efeito da raquete e dos equipamentos.</p></div>'
    + '<div><p class="section-label">Evolução do overall</p><p class="cr-note">' + log + '</p><p class="section-label">Títulos</p><p class="cr-note">' + (Object.keys(CR.titles).length ? Object.entries(CR.titles).map(([t, n]) => TIERS[t].curto + ' ×' + n).join(' · ') : 'Nenhum ainda.') + '</p>'
    + '<p class="section-label">Partidas</p><fieldset class="seg"><div class="pills"><input type="radio" name="crGames" id="crG4" value="4"' + (CR.games === 4 ? ' checked' : '') + '><label for="crG4">Set curto · 4 games</label><input type="radio" name="crGames" id="crG6" value="6"' + (CR.games === 6 ? ' checked' : '') + '><label for="crG6">Set · 6 games</label></div></fieldset>'
    + '<div class="cta-row" style="margin-top:10px"><button class="ghost sm" id="crReset">Apagar carreira</button></div></div></div>';
}
function crPersonRow(c, extra, btn) {
  return '<div class="cr-row"><span class="ovr sm">' + crCharOvr(c) + '</span><div><b>' + esc(nameOf(c)) + '</b><small>' + c.pais + ' · ' + c.estilo + ' · ' + Math.round(heightOf(c) * 100) + ' cm' + (c.canhoto ? ' · canhoto' : '') + (extra ? ' · ' + extra : '') + '</small></div>' + (btn || '') + '</div>';
}
function crPartnersHTML() {
  const cur = CR.partner ? crChar(CR.partner) : null;
  const myO = crMeOvr();
  const list = crWorld().filter(c => c.id !== CR.partner).map(c => ({ c, o: crCharOvr(c), w: crWillPartner(c) })).filter(x => x.o >= myO - 12 && x.o <= myO + 22).sort((x, y) => y.o - x.o).slice(0, 40);
  const offers = CR.offers.map(crChar).filter(Boolean);
  return '<p class="section-label">Seu parceiro</p>' + (cur ? crPersonRow(cur, 'entrosamento ' + CR.chem + '/5', '<button class="ghost sm" data-drop="1">Desfazer dupla</button>') : '<p class="cr-note">Sem parceiro fixo.</p>')
    + (offers.length ? '<p class="section-label">Convites (de quem você venceu)</p>' + offers.map(c => crPersonRow(c, 'quer jogar com você', '<button class="cta sm" data-partner="' + c.id + '">Aceitar</button>')).join('') : '')
    + '<p class="section-label">Mercado de parceiros</p><p class="cr-note">Quem aceita depende do seu overall, do seu ranking e de você já ter vencido o jogador. Entrosamento sobe a cada torneio juntos.</p>'
    + '<div class="cr-list">' + list.map(x => crPersonRow(x.c, x.w.why + ' · ' + Math.round(CR.npc[x.c.id] || 0) + ' pts', x.w.ok ? '<button class="ghost sm" data-partner="' + x.c.id + '">Formar dupla</button>' : '<span class="cr-lock">🔒</span>')).join('') + '</div>';
}
function crShopHTML() {
  const rk = Object.entries(RACKET_STATS).map(([k, r]) => {
    const own = CR.rackets.includes(k), eq = CR.racket === k;
    const bonus = Object.entries(r.b).map(([a, v]) => '<em class="' + (v > 0 ? 'up' : 'dn') + '">' + (v > 0 ? '+' : '') + v + ' ' + ATTRS.find(x => x[0] === a)[1] + '</em>').join(' ');
    return '<div class="cr-row"><span class="cr-rk" data-r="' + k + '"></span><div><b>' + r.nome + (eq ? ' · em uso' : '') + '</b><small>' + r.desc + '</small><small>' + bonus + '</small></div>' + (eq ? '' : own ? '<button class="ghost sm" data-equip="' + k + '">Usar</button>' : '<button class="cta sm" data-buy="' + k + '"' + (CR.money < r.preco ? ' disabled' : '') + '>' + money(r.preco) + '</button>') + '</div>';
  }).join('');
  const gr = GEAR.map(g => {
    const own = g.staff ? !!CR.staff[g.id] : CR.gear.includes(g.id);
    const bonus = g.b ? Object.entries(g.b).map(([a, v]) => '<em class="up">+' + v + ' ' + ATTRS.find(x => x[0] === a)[1] + '</em>').join(' ') : '';
    return '<div class="cr-row"><span class="cr-ic">' + (g.staff ? '👤' : '🎒') + '</span><div><b>' + g.nome + '</b><small>' + g.desc + '</small><small>' + bonus + '</small></div>' + (own ? '<span class="cr-own">' + (g.staff ? 'contratado' : 'comprado') + '</span>' : '<button class="cta sm" data-gear="' + g.id + '"' + (CR.money < g.preco ? ' disabled' : '') + '>' + money(g.preco) + '</button>') + '</div>';
  }).join('');
  return '<div class="cr-two"><div><p class="section-label">Raquetes</p><div class="cr-list">' + rk + '</div></div><div><p class="section-label">Equipamentos e equipe</p><div class="cr-list">' + gr + '</div></div></div>';
}
function crRankingHTML() {
  const r = crRanking(), me = r.findIndex(x => x.id === 'crme');
  const show = r.slice(0, 30); if (me >= 30) show.push(...r.slice(Math.max(30, me - 2), me + 3));
  return '<p class="section-label">Ranking ' + (CR.me.fem ? 'feminino' : 'masculino') + ' (pontos das últimas ' + SEASON_WEEKS + ' semanas)</p><div class="cr-list">' + show.map(x => { const i = r.indexOf(x), c = crChar(x.id); return '<div class="cr-row' + (x.id === 'crme' ? ' me' : '') + '"><span class="cr-pos">' + (i + 1) + '</span><div><b>' + esc(nameOf(c)) + '</b><small>' + c.pais + ' · OVR ' + crCharOvr(c) + '</small></div><b class="cr-pts">' + x.pts + '</b></div>'; }).join('') + '</div>';
}
function crHistoryHTML() {
  return '<p class="section-label">Últimos torneios</p><div class="cr-list">' + (CR.history.length ? CR.history.map(h => '<div class="cr-row"><span class="cr-pos">T' + h.s + '<br>S' + h.w + '</span><div><b>' + esc(h.name) + '</b><small>' + h.tier + ' · ' + h.place + (h.partner ? ' · com ' + esc(h.partner) : '') + '</small></div><b class="cr-pts">' + money(h.prize) + '<br>' + h.pts + ' pts</b></div>').join('') : '<p class="cr-note">Nenhum torneio ainda.</p>') + '</div>';
}
function crTourHTML() {
  const t = CR.tour, T = TIERS[t.tier], names = crRoundNames(crNRounds());
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
    msg = '<div class="cr-sum"><b class="champion">' + (s.place === 0 ? '🏆 Campeões do ' + esc(t.name) + '!' : s.placeName) + '</b><span>Prêmio ' + money(s.prize) + ' · +' + s.pts + ' pts de ranking · +' + s.xp + ' pontos de evolução</span>'
      + (s.offers.length ? '<span>Convites para formar dupla: ' + s.offers.map(id => esc(nameOf(crChar(id)))).join(', ') + ' (veja em Parceiros)</span>' : '') + '<span class="cr-note">' + t.log.map(esc).join(' · ') + '</span></div>';
  } else if (mm) {
    const opp = t.teams[mm.a === t.me ? mm.b : mm.a];
    msg = '<p class="lede">' + names[t.round] + ': vocês contra <b>' + crTeamName(opp) + '</b> (OVR ' + crTeamOvr(opp) + '). Sua dupla: OVR ' + crTeamOvr(t.teams[t.me]) + '.</p>';
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
  body.querySelectorAll('[data-up]').forEach(bt => bt.addEventListener('click', () => { crUpgrade(bt.dataset.up); renderCareer(); }));
  body.querySelectorAll('[data-partner]').forEach(bt => bt.addEventListener('click', () => { crSetPartner(bt.dataset.partner); CR.lastMsg = 'Nova dupla: ' + nameOf(crChar(bt.dataset.partner)) + '.'; renderCareer(); }));
  body.querySelectorAll('[data-drop]').forEach(bt => bt.addEventListener('click', () => { CR.partner = null; CR.chem = 0; saveCareer(); renderCareer(); }));
  body.querySelectorAll('[data-buy]').forEach(bt => bt.addEventListener('click', () => { const k = bt.dataset.buy, r = RACKET_STATS[k]; if (CR.money >= r.preco) { CR.money -= r.preco; CR.rackets.push(k); CR.racket = k; CR.lastMsg = 'Comprou a ' + r.nome + '.'; saveCareer(); } renderCareer(); }));
  body.querySelectorAll('[data-equip]').forEach(bt => bt.addEventListener('click', () => { CR.racket = bt.dataset.equip; CR.me.look.racket = CR.racket; saveCareer(); renderCareer(); }));
  body.querySelectorAll('[data-gear]').forEach(bt => bt.addEventListener('click', () => { const g = GEAR.find(x => x.id === bt.dataset.gear); if (CR.money >= g.preco) { CR.money -= g.preco; if (g.staff) CR.staff[g.id] = true; else CR.gear.push(g.id); CR.lastMsg = 'Comprou: ' + g.nome + '.'; crSyncChars(); saveCareer(); } renderCareer(); }));
  body.querySelectorAll('input[name=crGames]').forEach(r => r.addEventListener('change', () => { CR.games = +r.value; saveCareer(); }));
  const rst = $('crReset'); if (rst) rst.addEventListener('click', () => { if (rst.dataset.sure) { CR = null; saveCareer(); crSyncChars(); renderCareer(); } else { rst.dataset.sure = '1'; rst.textContent = 'Clique de novo para confirmar'; } });
  body.querySelectorAll('.cr-rk').forEach(sp => { const r = RACKETS[sp.dataset.r]; if (r) sp.style.background = r.edge; });
}
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
  crCreate({ name: ($('crName').value || '').trim() || 'Promessa', fem: crForm.fem, alt: crForm.alt, style: crForm.style, perfil: crForm.perfil, skin: crForm.skin, hair: crForm.hair, acc: crForm.acc, canhoto: crForm.canhoto, glasses: Math.random() < .5 });
  crTab = 'agenda'; CR.lastMsg = 'Bem-vindo ao circuito! Comece pelo Amador C, ache um parceiro e suba no ranking.'; saveCareer(); renderCareer();
}
$('btnCareer').addEventListener('click', openCareer);
$('crBack').addEventListener('click', () => { $('career').hidden = true; toMenu(); });
$('crCreate').addEventListener('click', crStart);
$('crAlt').addEventListener('input', e => { crForm.alt = +e.target.value; $('crAltV').textContent = crForm.alt + ' cm'; });
document.querySelectorAll('input[name=crGen]').forEach(r => r.addEventListener('change', () => { const f = r.value === 'f'; crForm.alt = f ? 168 : 182; $('crAlt').value = crForm.alt; $('crAltV').textContent = crForm.alt + ' cm'; }));
document.querySelectorAll('#crTabs button').forEach(b => b.addEventListener('click', () => { crTab = b.dataset.t; CR.lastMsg = ''; renderCareer(); }));
$('btnOverCareer').addEventListener('click', () => { el.over.hidden = true; openCareer(); });
if (CR) crSyncChars();
