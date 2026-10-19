// @ts-nocheck
// modo carreira: circuito, ranking, torneios, economia, eventos
import './13-campeonato';
import { $s } from '../state';
import { ATTRS, GEAR, RACKET_STATS, ROSTER, STAFF, clamp, effA, nameOf, overall, racketBonus, rand, shortOf } from './00-base';
import { S } from './01-estado';
import { ac } from './08-audio';
import { $, newMatch } from './09-interface';
import { money } from './15-carreira-telas';
// ================= MODO CARREIRA =================
// circuito em escada (amador -> ITF -> Sand Series -> Mundial), ranking de 26 semanas, dinheiro, evolução e parceiros
const TIERS = [
  { id: 'C', nome: 'Amador Categoria C', curto: 'AMADOR C', ovr: [44, 58], draw: 8, fee: 30, travel: 0, prize: [400, 200, 90, 40], pts: [25, 16, 9, 4], xp: [3, 2, 2, 1], diff: 'facil', req: 0, cities: ['Copa Praia do Forte', 'Open Itapuã', 'Desafio Guarujá', 'Torneio da Pajuçara', 'Copa Jurerê', 'Open Ponta Negra'] },
  { id: 'B', nome: 'Amador Categoria B', curto: 'AMADOR B', ovr: [50, 64], draw: 8, fee: 60, travel: 0, prize: [900, 450, 180, 90], pts: [45, 30, 18, 8], xp: [4, 3, 2, 1], diff: 'facil', req: 60, cities: ['Open Balneário Camboriú', 'Copa Ipanema', 'Torneio Porto de Galinhas', 'Open Maresias', 'Copa Iracema'] },
  { id: 'A', nome: 'Amador Categoria A', curto: 'AMADOR A', ovr: [56, 69], draw: 8, fee: 120, travel: 60, prize: [1800, 900, 350, 180], pts: [75, 50, 30, 14], xp: [5, 4, 3, 1], diff: 'medio', req: 160, cities: ['Open Florianópolis', 'Copa Salvador', 'Open Búzios', 'Torneio Natal', 'Copa Vitória'] },
  { id: 'BT10', nome: 'ITF BT10', curto: 'BT10', ovr: [61, 74], draw: 8, fee: 200, travel: 250, prize: [3500, 1700, 700, 250], pts: [120, 80, 50, 20], xp: [6, 5, 3, 2], diff: 'medio', req: 320, cities: ['BT10 Fortaleza', 'BT10 Aruba', 'BT10 Maceió', 'BT10 Cascais', 'BT10 Valência'] },
  { id: 'BT50', nome: 'ITF BT50', curto: 'BT50', ovr: [66, 78], draw: 16, fee: 350, travel: 500, prize: [7000, 3500, 1600, 700, 200], pts: [200, 140, 90, 50, 18], xp: [8, 6, 4, 3, 1], diff: 'medio', req: 600, cities: ['BT50 Cervia', 'BT50 Barcelona', 'BT50 João Pessoa', 'BT50 Lignano', 'BT50 Montpellier'] },
  { id: 'BT100', nome: 'ITF BT100', curto: 'BT100', ovr: [70, 82], draw: 16, fee: 500, travel: 800, prize: [14000, 7000, 3200, 1300, 400], pts: [350, 240, 150, 80, 30], xp: [9, 7, 5, 3, 2], diff: 'medio', req: 1000, cities: ['BT100 Copacabana', 'BT100 Riccione', 'BT100 Aruba', 'BT100 Gran Canaria'] },
  { id: 'BT200', nome: 'ITF BT200', curto: 'BT200', ovr: [74, 86], draw: 16, fee: 800, travel: 1200, prize: [28000, 14000, 6500, 2600, 800], pts: [550, 380, 240, 130, 50], xp: [11, 8, 6, 4, 2], diff: 'dificil', req: 1600, cities: ['BT200 Rio de Janeiro', 'BT200 Ravenna', 'BT200 Terracina', 'BT200 Fortaleza'] },
  { id: 'BT400', nome: 'ITF BT400', curto: 'BT400', ovr: [78, 90], draw: 16, fee: 1200, travel: 1800, prize: [50000, 25000, 12000, 5000, 1500], pts: [850, 600, 380, 200, 80], xp: [13, 10, 7, 4, 2], diff: 'dificil', req: 2500, cities: ['BT400 Aruba', 'BT400 Ravenna', 'BT400 Copacabana', 'BT400 Cervia'] },
  { id: 'SS', nome: 'Sand Series', curto: 'SAND SERIES', ovr: [82, 95], draw: 16, fee: 2000, travel: 2500, prize: [90000, 45000, 22000, 9000, 3000], pts: [1300, 900, 580, 300, 120], xp: [16, 12, 8, 5, 3], diff: 'dificil', req: 3800, cities: ['Sand Series Cervia', 'Sand Series Fortaleza', 'Sand Series Ravenna', 'Sand Series Aruba'] },
  { id: 'WC', nome: 'Campeonato Mundial ITF', curto: 'MUNDIAL', ovr: [84, 99], draw: 16, fee: 0, travel: 3000, prize: [150000, 75000, 36000, 15000, 5000], pts: [2000, 1400, 900, 500, 200], xp: [20, 14, 10, 6, 3], diff: 'dificil', req: 1e9, cities: ['Mundial de Matosinhos'] },
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
      look.racket = pick(ovr < 52 ? ['basica', 'tropic'] : ovr < 58 ? ['tropic', 'brisa', 'fibra'] : ovr < 64 ? ['fibra', 'mare', 'coral', 'duna'] : ovr < 72 ? ['duna', 'medusa', 'proteo', 'coral', 'mare', 'tufao'] : ovr < 80 ? ['kronos', 'atol', 'proteo', 'ventosul', 'recife', 'tufao', 'medusa'] : ['supercarbon', 'tsunami', 'eclipse', 'recife', ovr > 85 ? 'zenite' : 'kronos']);
      out.push({ id: 'f' + g + i, name, alt: Math.round(fem ? 170 + (rnd() - .5) * 14 : 184 + (rnd() - .5) * 16), pais, estilo: STYLES[style].nome, build: pick(['atletico', 'atletico', 'esguio', 'compacto', 'forte']), fem, canhoto: rnd() < .12 || undefined, age: 18 + Math.floor(rnd() * 16), a: makeAttrs(ovr, style, rnd), look, fict: true });
    }
  });
  return out;
}
// ---------- estado ----------
$s.CR = null;
try { $s.CR = JSON.parse(localStorage.getItem('pdo-career') || 'null'); } catch (e) { $s.CR = null; }
const saveCareer = () => { try { localStorage.setItem('pdo-career', JSON.stringify($s.CR)); } catch (e) {} };
function crSyncChars() {
  $s.CAREER_CHARS = $s.CR ? $s.CR.pool.concat([crMeChar()]) : [];
}
// você em jogo: atributos + equipamentos (a raquete entra na hora da partida) - cansaço
function crGearBonus() { const b = {}; ($s.CR.gear || []).forEach(id => { const g = GEAR.find(x => x.id === id); if (g && g.b) for (const k in g.b) b[k] = (b[k] || 0) + g.b[k]; }); return b; }
function crFatigue() { const p = $s.CR.energy < 60 ? -Math.round((60 - $s.CR.energy) / 8) : 0; const b = {}; for (const [k] of ATTRS) b[k] = p; return b; }
function crMental() { const b = {}; if ($s.CR.staff.psico) for (const [k] of ATTRS) b[k] = 1; return b; }
function crMeChar() { const m = $s.CR.me; return Object.assign({}, m, { a: effA(m.a, crGearBonus(), crFatigue(), crMental()) }); }
const crMeOvr = () => overall(effA($s.CR.me.a, crGearBonus(), racketBonus($s.CR.racket), crFatigue(), crMental()));
const crCharOvr = c => c.id === 'crme' ? crMeOvr() : overall(effA(c.a, racketBonus(c.look && c.look.racket)));
// mundo do seu gênero (fictícios + astros reais)
const crWorld = () => $s.CR.pool.filter(c => !!c.fem === !!$s.CR.me.fem).concat(ROSTER.filter(c => !!c.fem === !!$s.CR.me.fem));
const crChar = id => id === 'crme' ? crMeChar() : ($s.CR.pool.find(c => c.id === id) || ROSTER.find(c => c.id === id));
const absWeek = () => ($s.CR.season - 1) * SEASON_WEEKS + $s.CR.week;
const crPts = () => $s.CR.results.filter(r => r.w > absWeek() - SEASON_WEEKS).reduce((t, r) => t + r.pts, 0);
function crRanking() {
  const list = crWorld().map(c => ({ id: c.id, pts: Math.round($s.CR.npc[c.id] || 0) }));
  list.push({ id: 'crme', pts: crPts() });
  return list.sort((x, y) => y.pts - x.pts || (x.id === 'crme' ? 1 : -1));
}
const crRank = () => crRanking().findIndex(r => r.id === 'crme') + 1;
const npcTier = o => { let t = 0; for (let i = 0; i < 9; i++) if (TIERS[i].ovr[0] + 3 <= o) t = i; return t; };
// semana dos outros: quem joga ganha pontos conforme a força dentro do nível
function crSimWorld(rnd) {
  rnd = rnd || Math.random;
  $s.CR.pool.concat(ROSTER).forEach(c => {
    const o = crCharOvr(c), t = npcTier(o), T = TIERS[t];
    let p = ($s.CR.npc[c.id] || 0) * (SEASON_WEEKS - 1) / SEASON_WEEKS;
    if (rnd() < .6) {
      const perf = (o - (T.ovr[0] + T.ovr[1]) / 2) / ((T.ovr[1] - T.ovr[0]) / 2) + gaussR(rnd) * .6;
      const idx = perf > 1.25 ? 0 : perf > .75 ? 1 : perf > .25 ? 2 : perf > -.35 ? 3 : 4;
      p += T.pts[Math.min(idx, T.pts.length - 1)];
    }
    $s.CR.npc[c.id] = p;
  });
}
function gaussR(rnd) { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function crTierUnlocked(i) {
  if (i === 9) return false;
  return i === 0 || ($s.CR.titles[i - 1] || 0) > 0 || crPts() >= TIERS[i].req || $s.CR.maxTier >= i;
}
function crMaxTier() { let m = 0; for (let i = 0; i < 9; i++) if (crTierUnlocked(i)) m = i; return m; }
// opções da semana: torneios do seu nível, um abaixo e às vezes um acima para quem já pode
function crWeekOptions() {
  const rnd = mulberry($s.CR.seed + absWeek() * 97);
  const top = crMaxTier(), opts = [];
  const tiers = [top, Math.max(0, top - 1), top > 0 ? Math.max(0, top - 2) : top];
  if ($s.CR.week === SEASON_WEEKS && crRank() <= 16) tiers.unshift(9);
  const seen = new Set();
  tiers.forEach((t, k) => {
    const T = TIERS[t]; let city = T.cities[Math.floor(rnd() * T.cities.length)];
    if (seen.has(t + city)) city = T.cities[(T.cities.indexOf(city) + 1) % T.cities.length];
    seen.add(t + city);
    opts.push({ tier: t, name: t >= 3 && t < 9 ? city : city + (t < 3 ? ' · ' + T.curto : '') });
  });
  const list = opts.filter((o, i, arr) => arr.findIndex(x => x.name === o.name) === i).slice(0, 4);
  if ($s.CR.wildcard > 0 && top < 8) { const T = TIERS[top + 1]; list.unshift({ tier: top + 1, name: T.cities[Math.floor(rnd() * T.cities.length)] + ' (wildcard)', wild: true }); }
  return list;
}
// ---------- criação ----------
function crCreate(o) {
  const seed = Math.floor(Math.random() * 1e9);
  const rnd = mulberry(seed + 7);
  const promessa = o.perfil === 'promessa';
  const target = promessa ? 52 : 60;
  const me = { id: 'crme', name: o.name || 'Você', alt: o.alt, pais: 'BRA', estilo: STYLES[o.style].nome, build: o.build || 'atletico', fem: o.fem, canhoto: o.canhoto || undefined,
    a: makeAttrs(target, o.style, rnd), look: Object.assign({ skin: o.skin, hair: o.hair, num: '99', racket: 'basica' }, o.acc === 'cap' ? { cap: '#fbf6ea' } : o.acc === 'visor' ? { visor: '#fbf6ea' } : {}, o.fem ? { tank: true } : {}, { glasses: !!o.glasses, band: true }) };
  $s.CR = { v: 1, seed, me, pot: promessa ? 94 + Math.floor(rnd() * 4) : 86 + Math.floor(rnd() * 4), age: promessa ? 17 : 22,
    money: promessa ? 800 : 1200, pe: 0, energy: 100, season: 1, week: 1, results: [], npc: {}, titles: {}, maxTier: 0,
    partner: null, chem: 0, offers: [], beat: {}, racket: 'basica', rackets: promessa ? ['basica'] : ['basica', 'fibra'], gear: [], staff: {},
    history: [], ovrLog: [], tour: null, games: 4, lastMsg: '', pool: genPool(seed) };
  if (!promessa) $s.CR.racket = 'fibra';
  crMigrate();
  const r2 = mulberry(seed + 11); for (let i = 0; i < SEASON_WEEKS; i++) crSimWorld(r2);
  $s.CR.ovrLog.push({ s: 1, w: 1, o: overall($s.CR.me.a) });
  crSyncChars(); saveCareer();
}
// ---------- parceiros ----------
function crRankBonus() { const r = crRank(), n = crWorld().length + 1; return r <= 10 ? 8 : r <= 25 ? 6 : r <= 50 ? 4 : r <= n * .5 ? 2 : 0; }
function crWillPartner(c) {
  if ($s.CR.offers.includes(c.id)) return { ok: true, why: 'Convite aceito' };
  const me = crMeOvr(), o = crCharOvr(c), beat = Math.min(2, $s.CR.beat[c.id] || 0);
  const lim = me + 4 + crRankBonus() + beat * 3;
  if (o <= lim) return { ok: true, why: beat ? 'Respeita você: já perdeu para você' : 'Topa jogar com você' };
  return { ok: false, why: o - lim > 8 ? 'Fora do seu nível por enquanto' : 'Quer alguém com mais ranking ou que já o tenha vencido' };
}
function crSetPartner(id) { if ($s.CR.partner !== id) { $s.CR.partner = id; $s.CR.chem = 0; } $s.CR.offers = $s.CR.offers.filter(x => x !== id); saveCareer(); }
// ---------- torneio ----------
const SEED8 = [[0, 7], [3, 4], [2, 5], [1, 6]], SEED16 = [[0, 15], [7, 8], [4, 11], [3, 12], [2, 13], [5, 10], [6, 9], [1, 14]];
const crTeamOvr = t => Math.round((crCharOvr(crChar(t.a)) + crCharOvr(crChar(t.b))) / 2);
const crTeamName = t => shortOf(crChar(t.a)) + ' / ' + shortOf(crChar(t.b));
function crEnter(opt) {
  const T = TIERS[opt.tier], cost = (opt.wild ? 0 : T.fee) + T.travel;
  if ($s.CR.money < cost) { $s.CR.lastMsg = 'Dinheiro insuficiente para a inscrição e a viagem.'; return false; }
  if (!$s.CR.partner) { // parceiro de ocasião: o melhor que aceitar dentro do nível
    const cand = crWorld().filter(c => crCharOvr(c) <= T.ovr[1] && crWillPartner(c).ok).sort((x, y) => crCharOvr(y) - crCharOvr(x));
    if (!cand.length) { $s.CR.lastMsg = 'Ninguém aceitou ser seu parceiro neste torneio.'; return false; }
    $s.CR.partner = cand[0].id; $s.CR.chem = 0;
  }
  $s.CR.money -= cost; if (opt.wild) $s.CR.wildcard = 0;
  const rnd = Math.random;
  const busy = new Set(['crme', $s.CR.partner]);
  let lo = T.ovr[0] - 2, hi = T.ovr[1] + 2, field = [];
  const need = (T.draw - 1) * 2;
  while (field.length < need && hi < 120) {
    field = crWorld().filter(c => !busy.has(c.id)).filter(c => { const o = crCharOvr(c); return o >= lo && o <= hi; });
    lo -= 3; hi += 3;
  }
  field.sort(() => rnd() - .5); field = field.slice(0, need).sort((x, y) => crCharOvr(y) - crCharOvr(x));
  const teams = [{ a: 'crme', b: $s.CR.partner, me: true }];
  for (let i = 0; i + 1 < field.length; i += 2) teams.push({ a: field[i].id, b: field[i + 1].id });
  teams.sort((x, y) => crTeamOvr(y) - crTeamOvr(x));
  const me = teams.findIndex(t => t.me);
  const seedOrder = T.draw === 16 ? SEED16 : SEED8;
  $s.CR.tour = { tier: opt.tier, name: opt.name, teams, me, round: 0, alive: true, champion: null, done: false, beaten: [], log: [],
    rounds: [seedOrder.map(([a, b]) => ({ a: a < teams.length ? a : -1, b: b < teams.length ? b : -1, w: null, score: '' }))] };
  $s.CR.tour.rounds[0].forEach(m => { if (m.w === null && (m.a < 0 || m.b < 0)) { m.w = m.a < 0 ? m.b : m.a; m.score = 'passa direto'; } });
  $s.CR.lastMsg = ''; saveCareer();
  return true;
}
const crRoundNames = n => n === 4 ? ['Oitavas', 'Quartas', 'Semifinal', 'Final'] : ['Quartas', 'Semifinal', 'Final'];
const crNRounds = () => TIERS[$s.CR.tour.tier].draw === 16 ? 4 : 3;
function crMyMatch() { const t = $s.CR.tour; if (!t || t.done || t.round >= crNRounds()) return null; return t.rounds[t.round].find(m => m.w === null && (m.a === t.me || m.b === t.me)) || null; }
function crScore(N, rnd) { const l = Math.floor((rnd || Math.random)() * (N - 1)); return N + '–' + l; }
function crSimOne(m, isMine) {
  const t = $s.CR.tour, A = t.teams[m.a], B = t.teams[m.b];
  let sa = crTeamOvr(A), sb = crTeamOvr(B);
  if (A.me) sa += $s.CR.chem * .4; if (B.me) sb += $s.CR.chem * .4;
  const pA = 1 / (1 + Math.exp(-(sa - sb) / 3));
  m.w = Math.random() < pA ? m.a : m.b;
  const N = isMine ? $s.CR.games : 6; m.score = crScore(N);
}
function crAfterMyMatch(won) {
  const t = $s.CR.tour; $s.CR.energy = Math.max(0, $s.CR.energy - 10);
  const mm = t.rounds[t.round].find(m => m.a === t.me || m.b === t.me);
  const opp = t.teams[mm.a === t.me ? mm.b : mm.a];
  $s.CR.pe += Math.round((won ? 1 + t.tier * .3 : .5) * crXpMul());
  if (won) { [opp.a, opp.b].forEach(id => { $s.CR.beat[id] = ($s.CR.beat[id] || 0) + 1; t.beaten.push(id); }); }
  else t.alive = false;
  t.log.push((won ? 'Vitória' : 'Derrota') + ' ' + mm.score + ' contra ' + crTeamName(opp));
  crAdvance();
  if (!t.alive) while (t.champion === null) crAdvance();
  if (t.champion !== null) crFinishTour();
  saveCareer();
}
function crAdvance() {
  const t = $s.CR.tour, cur = t.rounds[t.round];
  cur.forEach(m => { if (m.w === null) crSimOne(m, false); });
  if (cur.length === 1) { t.champion = cur[0].w; t.round = crNRounds(); return; }
  const nx = []; for (let k = 0; k < cur.length; k += 2) nx.push({ a: cur[k].w, b: cur[k + 1].w, w: null, score: '' });
  t.rounds.push(nx); t.round++;
}
function crPlaySim() {
  const mm = crMyMatch(); if (!mm) return;
  crSimOne(mm, true); crAfterMyMatch(mm.w === $s.CR.tour.me);
}
function crFinishTour() {
  const t = $s.CR.tour, T = TIERS[t.tier], nR = crNRounds();
  // fase em que caiu: 0 campeão, 1 vice, 2 semi, 3 quartas, 4 oitavas
  let place = 0;
  if (t.champion !== t.me) { const lostAt = t.rounds.findIndex(rd => rd.some(m => (m.a === t.me || m.b === t.me) && m.w !== null && m.w !== t.me)); place = nR - lostAt; }
  const prize = T.prize[place] || 0, pts = T.pts[place] || 0, xp = Math.round((T.xp[place] || 0) * crXpMul());
  $s.CR.money += prize; $s.CR.pe += xp;
  $s.CR.results.push({ w: absWeek(), pts });
  if (place === 0) { $s.CR.titles[t.tier] = ($s.CR.titles[t.tier] || 0) + 1; $s.CR.maxTier = Math.max($s.CR.maxTier, Math.min(8, t.tier + 1));
    const bon = $s.CR.sponsors.reduce((x, sp) => x + sp.bonus, 0); if (bon) { $s.CR.money += bon; t.sponsorBonus = bon; }
    crAddFama(3 + t.tier * 2); if (Math.random() < .35) crMaybeSponsor(true); }
  else if (place === 1) crAddFama(1 + t.tier * .5);
  $s.CR.chem = Math.min(5, $s.CR.chem + 1);
  // quem você venceu pode querer jogar com você
  const offers = [];
  const myPartnerO = $s.CR.partner ? crCharOvr(crChar($s.CR.partner)) : 0;
  [...new Set(t.beaten)].forEach(id => { const c = crChar(id); if (!c || $s.CR.offers.includes(id) || id === $s.CR.partner) return; const o = crCharOvr(c); if (o > myPartnerO && o <= crMeOvr() + 14 && Math.random() < .4) offers.push(id); });
  $s.CR.offers = $s.CR.offers.concat(offers).slice(-4);
  const placeName = place === 0 ? 'Campeão' : place === 1 ? 'Vice-campeão' : place === 2 ? 'Semifinal' : place === 3 ? 'Quartas' : 'Oitavas';
  t.summary = { place, placeName, prize, pts, xp, offers };
  $s.CR.history.unshift({ s: $s.CR.season, w: $s.CR.week, name: t.name, tier: T.curto, place: placeName, prize, pts, partner: $s.CR.partner ? nameOf(crChar($s.CR.partner)) : '' });
  $s.CR.history = $s.CR.history.slice(0, 60);
  t.done = true;
}
const crXpMul = () => 1 + crStaffList().reduce((t, x) => t + (x.xp || 0), 0) + ($s.CR.mentor > 0 ? .5 : 0) + ($s.CR.age <= 20 ? .3 : 0);
// ---------- semana ----------
function crNextWeek(note) {
  $s.CR.tour = null;
  $s.CR.energy = Math.min(100, $s.CR.energy + 10 + crStaffList().reduce((t, x) => t + (x.energy || 0), 0));
  crSimWorld();
  $s.CR.week++;
  let msg = note || '';
  const spm = crSponsorWeek(); if (spm) msg += (msg ? ' ' : '') + spm;
  crAddFama(-.4); if ($s.CR.mentor > 0) $s.CR.mentor--; if ($s.CR.wildcard > 0) $s.CR.wildcard--;
  crMaybeSponsor();
  if (Math.random() < .3) { const ev = crRollEvent(); if (ev) msg += (msg ? ' ' : '') + ev; }
  if ($s.CR.week > SEASON_WEEKS) {
    const pos = crRank();
    msg = 'Fim da temporada ' + $s.CR.season + ': você terminou em ' + pos + 'º no ranking. ' + msg;
    $s.CR.season++; $s.CR.week = 1; $s.CR.age++; $s.CR.staff = {};
    // o mundo envelhece: jovens melhoram, veteranos caem
    // o mundo envelhece: jovens melhoram (mais devagar perto do topo), veteranos caem e quem passa dos 34 se aposenta
    const rnd = mulberry($s.CR.seed + $s.CR.season * 131);
    $s.CR.pool.forEach(c => {
      c.age = (c.age || 24) + 1;
      if (c.age > 34) { // aposentou: entra um novato no lugar
        const bank = NAME_BANK[c.pais] || NAME_BANK.BRA; let sur = bank.s[Math.floor(rnd() * bank.s.length)]; if (c.fem && c.pais === 'RUS') sur += 'a';
        c.name = bank[c.fem ? 'f' : 'm'][Math.floor(rnd() * bank[c.fem ? 'f' : 'm'].length)] + ' ' + sur; c.age = 18;
        c.a = makeAttrs(Math.round(44 + rnd() * 14), ['atacante', 'defensor', 'tatico', 'completo'][Math.floor(rnd() * 4)], rnd); $s.CR.npc[c.id] = 0; return;
      }
      const o = overall(c.a), d = (c.age < 23 ? 1.6 : c.age < 28 ? .6 : c.age > 31 ? -1.3 : 0) * (o > 84 && c.age < 31 ? .3 : 1);
      const ch = Math.round(d + gaussR(rnd) * 1.1); for (const [k] of ATTRS) c.a[k] = clamp(c.a[k] + ch, 30, 93);
    });
    if ($s.CR.age > 31) for (const [k] of [['vel']]) $s.CR.me.a[k] = Math.max(40, $s.CR.me.a[k] - 1);
  }
  $s.CR.ovrLog.push({ s: $s.CR.season, w: $s.CR.week, o: overall($s.CR.me.a) }); $s.CR.ovrLog = $s.CR.ovrLog.slice(-80);
  $s.CR.lastMsg = msg; crSyncChars(); saveCareer();
}
function crTrain() {
  const cost = 80 * (crMaxTier() + 1);
  if ($s.CR.money < cost) { $s.CR.lastMsg = 'Treino custa $' + cost + '.'; return; }
  if ($s.CR.energy < 20) { $s.CR.lastMsg = 'Energia baixa demais para treinar: descanse.'; return; }
  $s.CR.money -= cost; $s.CR.energy -= 15; const g = Math.round(4 * crXpMul()); $s.CR.pe += g;
  crNextWeek('Semana de treino: +' + g + ' pontos de evolução.');
}
function crCoach() { const g = crLessonIncome(); $s.CR.money += g; $s.CR.energy = Math.max(0, $s.CR.energy - 5); crNextWeek('Semana dando aulas: +' + money(g) + '.'); }
function crRest() { $s.CR.energy = Math.min(100, $s.CR.energy + 45); crNextWeek('Semana de descanso: energia recuperada.'); }
// 60→70 é rápido, 70→80 bem mais lento, 80→90 o mais difícil
const crUpCostBase = v => v < 55 ? 1 : v < 62 ? 2 : v < 68 ? 3 : v < 72 ? 4 : v < 76 ? 6 : v < 80 ? 8 : v < 84 ? 12 : v < 88 ? 17 : v < 92 ? 24 : 32;
const crUpCost = (v, k) => Math.max(1, Math.round(crUpCostBase(v) * (crStaffList().some(x => x.cheap && x.cheap.includes(k)) ? .75 : 1)));
const crCap = () => Math.min(99, $s.CR.pot);
function crUpgrade(k) { const v = $s.CR.me.a[k], c = crUpCost(v, k); if ($s.CR.pe < c || v >= crCap()) return; $s.CR.pe -= c; $s.CR.me.a[k]++; crSyncChars(); saveCareer(); }
// ---------- partida jogada ----------
function crPlayMatch() {
  const mm = crMyMatch(); if (!mm) return;
  const t = $s.CR.tour, opp = t.teams[mm.a === t.me ? mm.b : mm.a];
  $s.CR.prev = { pick: Object.assign({}, S.settings.pick), mode: S.settings.mode, diff: S.settings.diff, racket: S.settings.racket, games: S.settings.games };
  crSyncChars();
  S.settings.mode = 'dupla'; S.settings.diff = TIERS[t.tier].diff; S.settings.racket = $s.CR.racket; S.settings.games = $s.CR.games;
  S.settings.pick = { me: 'crme', mate: $s.CR.partner, o1: opp.a, o2: opp.b };
  S.careerActive = true; saveCareer();
  $('career').hidden = true; ac(); newMatch();
}
function careerMatchEnded(won) {
  S.careerActive = false;
  const mm = crMyMatch();
  if ($s.CR.prev) { Object.assign(S.settings, { pick: $s.CR.prev.pick, mode: $s.CR.prev.mode, diff: $s.CR.prev.diff, racket: $s.CR.prev.racket, games: $s.CR.prev.games }); $s.CR.prev = null; }
  if (!mm) return;
  const g = S.score.games;
  mm.w = won ? $s.CR.tour.me : (mm.a === $s.CR.tour.me ? mm.b : mm.a);
  mm.score = g[0] + g[1] ? Math.max(g[0], g[1]) + '–' + Math.min(g[0], g[1]) : 'W.O.';
  crAfterMyMatch(won);
}
// ---------- saves antigos ----------
function crMigrate() {
  if (!$s.CR) return;
  $s.CR.fama = $s.CR.fama || 0; $s.CR.sponsors = $s.CR.sponsors || []; $s.CR.spOffers = $s.CR.spOffers || []; $s.CR.mentor = $s.CR.mentor || 0; $s.CR.discount = $s.CR.discount || 0; $s.CR.wildcard = $s.CR.wildcard || 0;
  if ($s.CR.staff.tecnico) { delete $s.CR.staff.tecnico; $s.CR.staff.tec2 = true; }
  if ($s.CR.staff.preparador) { delete $s.CR.staff.preparador; $s.CR.staff.prep = true; }
}
// ---------- equipe técnica ----------
const crStaffList = () => STAFF.filter(s => $s.CR.staff[s.id]);
function crHire(id) {
  const s = STAFF.find(x => x.id === id); if (!s || $s.CR.staff[id] || $s.CR.money < s.preco) return;
  if (s.head) STAFF.filter(x => x.head).forEach(x => delete $s.CR.staff[x.id]); // um técnico principal por vez
  $s.CR.money -= s.preco; $s.CR.staff[id] = true; $s.CR.lastMsg = 'Contratado até o fim da temporada: ' + s.nome + '.'; saveCareer();
}
// ---------- aulas ----------
// rende conforme o nível, sempre bem menos que o título do seu nível
const crLessonIncome = () => Math.max(120, Math.round(TIERS[crMaxTier()].prize[0] * .15 / 10) * 10);
// ---------- fama e patrocínio ----------
const BRANDS = ['Areia Fina', 'Solar Max Protetor', 'MarAzul Seguros', 'Coco Gelado', 'Tropicália Moda Praia', 'Ondas Telecom', 'Brisa Energéticos', 'Duna Óculos', 'Litoral Bank', 'Salina Isotônico', 'Farol Viagens', 'Arrecife Calçados', 'Maresia Relógios', 'Sol & Sal Cosméticos'];
function crAddFama(v) { $s.CR.fama = clamp(($s.CR.fama || 0) + v, 0, 100); }
function crMaybeSponsor(force) {
  if ($s.CR.sponsors.length + $s.CR.spOffers.length >= 4) return;
  if (!force && Math.random() > .08 + $s.CR.fama / 250) return;
  const used = new Set($s.CR.sponsors.concat($s.CR.spOffers).map(s => s.brand));
  const free = BRANDS.filter(b => !used.has(b)); if (!free.length) return;
  const weekly = Math.round((30 + 22 * Math.pow(crMaxTier() + 1, 1.7) + $s.CR.fama * 4) * rand(.75, 1.25) / 10) * 10;
  const weeks = Math.random() < .5 ? 13 : 26;
  $s.CR.spOffers.push({ brand: free[Math.floor(Math.random() * free.length)], weekly, bonus: weekly * (3 + Math.floor(Math.random() * 4)), weeks });
}
function crSponsorWeek() {
  let paid = 0; const ended = [];
  $s.CR.sponsors.forEach(s => { paid += s.weekly; s.left--; if (s.left <= 0) ended.push(s.brand); });
  $s.CR.sponsors = $s.CR.sponsors.filter(s => s.left > 0);
  $s.CR.money += paid;
  return (paid ? 'Patrocínios: +' + money(paid) + '.' : '') + (ended.length ? ' Contrato encerrado: ' + ended.join(', ') + '.' : '');
}
// ---------- eventos aleatórios ----------
const EVENTS = {
  clinica: { w: 3, ok: () => true, run: () => { const g = Math.round(crLessonIncome() * .7); $s.CR.money += g; $s.CR.energy = Math.max(0, $s.CR.energy - 5); return 'Um clube te chamou para uma clínica no fim de semana: +' + money(g) + '.'; } },
  treinoPro: { w: 2, ok: () => true, run: () => { const g = 2 + Math.floor(Math.random() * 3); $s.CR.pe += g; return 'Um jogador do top 20 te chamou para treinar junto: +' + g + ' pontos de evolução.'; } },
  chuva: { w: 2, ok: () => true, run: () => { $s.CR.energy = Math.min(100, $s.CR.energy + 15); return 'Chuva a semana toda: treinos cancelados, mas o corpo agradeceu (+15 energia).'; } },
  calor: { w: 2, ok: () => true, run: () => { $s.CR.energy = Math.max(0, $s.CR.energy - 15); return 'Onda de calor na areia: −15 de energia.'; } },
  viral: { w: 1.5, ok: () => true, run: () => { crAddFama(6); crMaybeSponsor(true); return 'Um ponto seu viralizou nas redes! +6 de fama e uma marca quer conversar (veja Patrocínios).'; } },
  imprensa: { w: 1.5, ok: () => $s.CR.fama >= 10, run: () => { crAddFama(3); return 'Entrevista na TV sobre o seu momento no circuito: +3 de fama.'; } },
  promo: { w: 1.5, ok: () => true, run: () => { $s.CR.discount = .3; return 'Promoção na loja: 30% de desconto na próxima raquete.'; } },
  bolsa: { w: 1, ok: () => crMaxTier() >= 3, run: () => { const g = TIERS[crMaxTier()].travel; $s.CR.money += g; return 'A federação liberou uma bolsa de viagem: +' + money(g) + '.'; } },
  wildcard: { w: 1.2, ok: () => crMaxTier() < 8, run: () => { $s.CR.wildcard = 2; return 'Você ganhou um wildcard para um torneio acima do seu nível na próxima semana!'; } },
  lesao: { w: 1.6, ok: () => true, choice: () => { const c = $s.CR.staff.fisio ? 0 : 150 * (crMaxTier() + 1); return { text: 'Você sentiu o ombro no treino.', opts: [c ? 'Fisioterapia (' + money(c) + ')' : 'Tratar com seu fisioterapeuta', 'Seguir no sacrifício (−' + ($s.CR.staff.fisio ? 15 : 30) + ' energia)'], data: { c } }; },
    resolve: (i, d) => { if (i === 0) { if ($s.CR.money < d.c) { $s.CR.energy = Math.max(0, $s.CR.energy - 30); return 'Sem dinheiro para a fisioterapia: −30 de energia.'; } $s.CR.money -= d.c; return 'Ombro tratado, sem prejuízo.'; } $s.CR.energy = Math.max(0, $s.CR.energy - ($s.CR.staff.fisio ? 15 : 30)); return 'Jogando no sacrifício: energia caiu.'; } },
  quebrou: { w: .7, ok: () => $s.CR.racket !== 'basica', choice: () => { const r = RACKET_STATS[$s.CR.racket], c = Math.round(r.preco * .2); return { text: 'Sua ' + r.nome + ' trincou num smash.', opts: ['Consertar (' + money(c) + ')', 'Aposentar a raquete'], data: { c } }; },
    resolve: (i, d) => { if (i === 0 && $s.CR.money >= d.c) { $s.CR.money -= d.c; return 'Raquete consertada.'; } const old = $s.CR.racket; $s.CR.rackets = $s.CR.rackets.filter(k => k !== old); if (!$s.CR.rackets.includes('basica')) $s.CR.rackets.push('basica'); $s.CR.racket = $s.CR.rackets.slice().sort((a, b) => RACKET_STATS[b].preco - RACKET_STATS[a].preco)[0]; $s.CR.me.look.racket = $s.CR.racket; return 'Você voltou para a ' + RACKET_STATS[$s.CR.racket].nome + '.'; } },
  parceiro: { w: 1.4, ok: () => !!$s.CR.partner, choice: () => ({ text: nameOf(crChar($s.CR.partner)) + ' anda insatisfeito com a divisão de bolas.', opts: ['Conversar e acertar', 'Deixar para lá'] }),
    resolve: i => { if (i === 0) { $s.CR.chem = Math.min(5, $s.CR.chem + 1); return 'Conversa boa: entrosamento subiu.'; } $s.CR.chem = Math.max(0, $s.CR.chem - 2); if (Math.random() < .35) { const n = nameOf(crChar($s.CR.partner)); $s.CR.partner = null; $s.CR.chem = 0; return n + ' desfez a dupla.'; } return 'O clima esfriou: entrosamento caiu.'; } },
  beneficente: { w: 1.2, ok: () => true, choice: () => ({ text: 'Convite para um torneio beneficente de exibição.', opts: ['Jogar (−15 energia, +fama)', 'Recusar'] }),
    resolve: i => { if (i === 0) { $s.CR.energy = Math.max(0, $s.CR.energy - 15); crAddFama(7); crMaybeSponsor(); return 'Exibição lotada: +7 de fama.'; } return 'Você preferiu poupar energia.'; } },
  mentor: { w: 1, ok: () => $s.CR.money > 400, choice: () => { const c = 300 * (crMaxTier() + 1); return { text: 'Um ex-campeão mundial se oferece para ser seu mentor por 4 semanas.', opts: ['Aceitar (' + money(c) + ', +50% de evolução)', 'Recusar'], data: { c } }; },
    resolve: (i, d) => { if (i === 0 && $s.CR.money >= d.c) { $s.CR.money -= d.c; $s.CR.mentor = 4; return 'Mentoria começou: 4 semanas com +50% de evolução.'; } return 'Fica para a próxima.'; } },
  furto: { w: .8, ok: () => $s.CR.gear.length > 0 && crMaxTier() >= 3, choice: () => { const id = $s.CR.gear[Math.floor(Math.random() * $s.CR.gear.length)], g = GEAR.find(x => x.id === id); return { text: 'Furtaram sua mochila na viagem: ' + g.nome + ' sumiu.', opts: ['Repor (' + money(g.preco) + ')', 'Ficar sem'], data: { id, c: g.preco } }; },
    resolve: (i, d) => { if (i === 0 && $s.CR.money >= d.c) { $s.CR.money -= d.c; return 'Equipamento reposto.'; } $s.CR.gear = $s.CR.gear.filter(x => x !== d.id); return 'Você vai jogar sem esse equipamento.'; } },
};
function crRollEvent() {
  const list = Object.entries(EVENTS).filter(([, e]) => e.ok());
  let r = Math.random() * list.reduce((t, [, e]) => t + e.w, 0);
  for (const [id, e] of list) { if ((r -= e.w) <= 0) {
    if (e.choice) { const c = e.choice(); $s.CR.event = Object.assign({ id }, c); return ''; }
    return e.run();
  } }
  return '';
}
function crResolveEvent(i) {
  const ev = $s.CR.event; if (!ev) return;
  $s.CR.event = null; $s.CR.lastMsg = EVENTS[ev.id].resolve(i, ev.data || {}) || ''; crSyncChars(); saveCareer();
}

export { HAIRS, SEASON_WEEKS, SKINS, TIERS, careerMatchEnded, crCap, crChar, crCharOvr, crCoach, crCreate, crEnter, crGearBonus, crHire, crLessonIncome, crMaxTier, crMeOvr, crMigrate, crMyMatch, crNRounds, crNextWeek, crPlayMatch, crPlaySim, crPts, crRank, crRanking, crResolveEvent, crRest, crRoundNames, crSetPartner, crSyncChars, crTeamName, crTeamOvr, crTierUnlocked, crTrain, crUpCost, crUpgrade, crWeekOptions, crWillPartner, crWorld, crXpMul, saveCareer };
