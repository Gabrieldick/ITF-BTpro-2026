// @ts-nocheck
// modo carreira: circuito, ranking, torneios, economia, eventos
import './13-campeonato';
import { $s } from '../state';
import { ATTRS, GEAR, RACKET_STATS, ROSTER, STAFF, clamp, effA, nameOf, overall, racketBonus, rand, shortOf } from './00-base';
import { S } from './01-estado';
import { ac } from './08-audio';
import { $, newMatch, scoreText } from './09-interface';
import { money } from './15-carreira-telas';
import { countryName } from '../flags';
import LZString from 'lz-string';
// ================= MODO CARREIRA =================
// circuito em escada (amador -> ITF -> Sand Series -> Mundial), ranking de 26 semanas, dinheiro, evolução e parceiros
const TIERS = [
  { id: 'C', nome: 'Amador Categoria C', curto: 'AMADOR C', ovr: [35, 50], draw: 8, fee: 30, travel: 0, prize: [400, 200, 90, 40], pts: [3, 2, 1, 0], xp: [3, 2, 2, 1], diff: 'facil', req: 0, cities: ['Copa Praia do Forte', 'Open Itapuã', 'Desafio Guarujá', 'Torneio da Pajuçara', 'Copa Jurerê', 'Open Ponta Negra'] },
  { id: 'B', nome: 'Amador Categoria B', curto: 'AMADOR B', ovr: [42, 57], draw: 8, fee: 60, travel: 0, prize: [900, 450, 180, 90], pts: [5, 3, 2, 1], xp: [4, 3, 2, 1], diff: 'facil', req: 10, cities: ['Open Balneário Camboriú', 'Copa Ipanema', 'Torneio Porto de Galinhas', 'Open Maresias', 'Copa Iracema'] },
  { id: 'A', nome: 'Amador Categoria A', curto: 'AMADOR A', ovr: [49, 63], draw: 8, fee: 120, travel: 60, prize: [1800, 900, 350, 180], pts: [8, 5, 3, 1], xp: [5, 4, 3, 1], diff: 'medio', req: 25, cities: ['Open Florianópolis', 'Copa Salvador', 'Open Búzios', 'Torneio Natal', 'Copa Vitória'] },
  { id: 'BT10', nome: 'ITF BT10', curto: 'BT10', ovr: [56, 70], draw: 8, fee: 200, travel: 250, prize: [3500, 1700, 700, 250], pts: [10, 7, 4, 2], xp: [6, 5, 3, 2], diff: 'medio', req: 45, cities: ['BT10 Fortaleza', 'BT10 Aruba', 'BT10 Maceió', 'BT10 Cascais', 'BT10 Valência'] },
  { id: 'BT50', nome: 'ITF BT50', curto: 'BT50', ovr: [62, 76], draw: 16, fee: 350, travel: 500, prize: [7000, 3500, 1600, 700, 200], pts: [50, 35, 22, 12, 5], xp: [8, 6, 4, 3, 1], diff: 'medio', req: 80, cities: ['BT50 Cervia', 'BT50 Barcelona', 'BT50 João Pessoa', 'BT50 Lignano', 'BT50 Montpellier'] },
  { id: 'BT100', nome: 'ITF BT100', curto: 'BT100', ovr: [68, 81], draw: 16, fee: 500, travel: 800, prize: [14000, 7000, 3200, 1300, 400], pts: [100, 70, 45, 25, 10], xp: [9, 7, 5, 3, 2], diff: 'medio', req: 250, cities: ['BT100 Copacabana', 'BT100 Riccione', 'BT100 Aruba', 'BT100 Gran Canaria'] },
  { id: 'BT200', nome: 'ITF BT200', curto: 'BT200', ovr: [73, 86], draw: 16, fee: 800, travel: 1200, prize: [28000, 14000, 6500, 2600, 800], pts: [210, 150, 95, 50, 20], xp: [11, 8, 6, 4, 2], diff: 'dificil', req: 600, cities: ['BT200 Rio de Janeiro', 'BT200 Ravenna', 'BT200 Terracina', 'BT200 Fortaleza'] },
  { id: 'BT400', nome: 'ITF BT400', curto: 'BT400', ovr: [78, 90], draw: 16, fee: 1200, travel: 1800, prize: [50000, 25000, 12000, 5000, 1500], pts: [450, 320, 200, 110, 45], xp: [13, 10, 7, 4, 2], diff: 'dificil', req: 1300, cities: ['BT400 Sul Special Cup', 'BT400 Matinhos', 'BT400 Cuiabá', 'BT400 Feira de Santana', 'BT400 Maceió', 'BT400 Marechal Deodoro', 'BT400 Petrolina', 'BT400 Amazônia Open Sunset', 'BT400 Cervia', 'BT400 Saint-Georges-de-Didonne'] }, // etapas reais (2025): quase todas no Brasil
  { id: 'SS', nome: 'Sand Series', curto: 'SAND SERIES', ovr: [82, 95], draw: 16, fee: 2000, travel: 2500, prize: [90000, 45000, 22000, 9000, 3000], pts: [750, 530, 340, 180, 75], xp: [16, 12, 8, 5, 3], diff: 'dificil', req: 2800, cities: ['Sand Series Cervia', 'Sand Series Fortaleza', 'Sand Series Ravenna', 'Sand Series Aruba'] },
  { id: 'WC', nome: 'Campeonato Mundial ITF', curto: 'MUNDIAL', ovr: [84, 99], draw: 16, fee: 0, travel: 3000, prize: [150000, 75000, 36000, 15000, 5000], pts: [1000, 700, 450, 250, 100], xp: [20, 14, 10, 6, 3], diff: 'dificil', req: 1e9, cities: ['Mundial de Matosinhos'] },
];
const SEASON_WEEKS = 52; // a temporada é um ano: 52 semanas de 7 dias
const RANK_BEST = 10;    // o ranking soma os 10 melhores resultados das últimas 52 semanas
// ---------- calendário: dias, datas e torneios do ano ----------
const DAY_NAMES = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
const DAY_FULL = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
// data real: a temporada 1 é 2026; a semana 1 começa na primeira segunda-feira de janeiro
function crDate(season, week, day) {
  const Y = 2025 + season, j1 = new Date(Y, 0, 1).getDay(), mon = 1 + (8 - j1) % 7;
  return new Date(Y, 0, mon + (week - 1) * 7 + (day - 1));
}
const crDateTxt = (season, week, day, withYear) => { const d = crDate(season, week, day); return DAY_NAMES[day - 1] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + (withYear ? ' ' + d.getFullYear() : ''); };
// quantas semanas do ano têm torneio de cada nível profissional (os amadores têm toda semana)
const CAL_N = { 3: 44, 4: 36, 5: 28, 6: 22, 7: 15, 8: 7 };
const CALC = { key: '', cal: null };
function crSeasonCal(season) {
  const key = $s.CR.seed + ':' + season;
  if (CALC.key === key) return CALC.cal;
  const rnd = mulberry($s.CR.seed + season * 7919), cal = {};
  for (let w = 1; w <= SEASON_WEEKS; w++) cal[w] = [];
  for (const [t, n] of Object.entries(CAL_N)) {
    const ws = []; for (let w = 1; w <= 49; w++) ws.push(w); // semanas 50–52: Mundial e fim de ano
    for (let i = ws.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [ws[i], ws[j]] = [ws[j], ws[i]]; }
    ws.slice(0, n).forEach(w => cal[w].push(+t));
  }
  cal[51].push(9); // Mundial (top 16 do ranking)
  CALC.key = key; CALC.cal = cal;
  return cal;
}
// 10 melhores resultados
const bestN = arr => arr.sort((a, b) => b - a).slice(0, RANK_BEST).reduce((t, v) => t + v, 0);
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
// criação: overall inicial pela categoria e o perfil, e os atributos de um estilo (sem sorteio) para a tela de criação
const crStartTarget = (perfil, start) => { const T0 = TIERS[clamp(Math.round(start || 0), 0, 6)], mid = (T0.ovr[0] + T0.ovr[1]) / 2; return Math.round(perfil === 'promessa' ? mid - 2 : mid + 3); };
function crPresetAttrs(target, style) { return makeAttrs(target, style, () => .5); }
// gera atributos com um overall alvo e um estilo
function makeAttrs(target, style, rnd) {
  const a = {}; const d = (STYLES[style] || STYLES.completo).d;
  for (const [k] of ATTRS) a[k] = target + (d[k] || 0) + Math.round((rnd() - .5) * 6);
  // ajusta para bater o overall alvo
  for (let i = 0; i < 6; i++) { const diff = target - overall(a); if (!diff) break; for (const [k] of ATTRS) a[k] += diff; }
  for (const [k] of ATTRS) a[k] = clamp(a[k], 30, 99);
  return a;
}
// ~400 por ranking (contando os astros reais); saves antigos com 150 são completados no crMigrate
const POOL_N = 1900; // ~1.900 por gênero (+ astros reais): ~60 atletas por estado
function genPool(seed, from = 0, to = POOL_N, used = new Set()) {
  const rnd = mulberry(seed + from * 7919); const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const country = () => { let r = rnd(); for (const [c, w] of COUNTRY_W) { if ((r -= w) <= 0) return c; } return 'BRA'; };
  const out = [];
  ['m', 'f'].forEach(g => {
    for (let i = from; i < to; i++) {
      const pais = country(), bank = NAME_BANK[pais];
      let name, tries = 0;
      do { let sur = pick(bank.s); if (g === 'f' && pais === 'RUS') sur += 'a'; name = pick(bank[g]) + ' ' + sur; } while (used.has(name) && ++tries < 20);
      used.add(name);
      // muitos jogadores fracos e poucos fortes (amadores até o topo do circuito)
      const ovr = Math.round(35 + 51 * Math.pow(rnd(), 1.25)); // de ~35 (amador C) a ~86
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
// ---------- saves: várias carreiras no navegador + arquivo .json ----------
// localStorage: 'pdo-careers' = índice { v: 2, active, ids }; cada carreira na sua chave 'pdo-career-<id>' (comprimida).
// Só a carreira que mudou é regravada, e um pouco depois da última ação (os dias passam rápido sem travar).
// Formato antigo: 'pdo-careers' = todas as carreiras juntas num texto só (convertido na primeira gravação).
const SAVE_KEY = 'pdo-careers', SAVE_FMT = 'ponto-de-ouro/carreira', SLOT_KEY = id => 'pdo-career-' + id;
let SAVES = { active: null, slots: {} };
const DIRTY = new Set(); let saveT = 0;
const unpack = raw => !raw ? null : raw.startsWith('LZ:') ? JSON.parse(LZString.decompressFromUTF16(raw.slice(3)) || 'null') : JSON.parse(raw);
try {
  const idx = unpack(localStorage.getItem(SAVE_KEY));
  if (idx && idx.v === 2 && Array.isArray(idx.ids)) {
    SAVES.active = idx.active || null;
    idx.ids.forEach(id => { try { const c = unpack(localStorage.getItem(SLOT_KEY(id))); if (c) SAVES.slots[id] = c; } catch (e) {} });
  } else if (idx && idx.slots) { SAVES = idx; Object.keys(SAVES.slots).forEach(id => DIRTY.add(id)); } // antigo: regrava separado
} catch (e) {}
if (!SAVES.slots) SAVES = { active: null, slots: {} };
// save antigo de uma carreira só
try { const old = JSON.parse(localStorage.getItem('pdo-career') || 'null'); if (old && !Object.keys(SAVES.slots).length) { old.id = old.id || 'c' + old.seed; SAVES.slots[old.id] = old; SAVES.active = old.id; } } catch (e) {}
$s.CR = SAVES.active && SAVES.slots[SAVES.active] || null;
let saveErr = '';
// grava já: o índice e as carreiras que mudaram
function flushSaves() {
  clearTimeout(saveT); saveT = 0;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 2, active: SAVES.active, ids: Object.keys(SAVES.slots) }));
    DIRTY.forEach(id => { const c = SAVES.slots[id]; if (c) localStorage.setItem(SLOT_KEY(id), 'LZ:' + LZString.compressToUTF16(JSON.stringify(c))); else localStorage.removeItem(SLOT_KEY(id)); });
    DIRTY.clear(); localStorage.removeItem('pdo-career'); saveErr = '';
  } catch (e) { saveErr = 'Não foi possível salvar no navegador (espaço cheio?). Exporte a carreira para um arquivo.'; }
}
// grava o índice já (barato) e as carreiras um pouco depois da última mudança
function writeSaves() { clearTimeout(saveT); saveT = setTimeout(flushSaves, 700); }
if (typeof window !== 'undefined') { addEventListener('pagehide', flushSaves); addEventListener('beforeunload', flushSaves); document.addEventListener('visibilitychange', () => { if (document.hidden && saveT) flushSaves(); }); }
const saveCareer = () => {
  if ($s.CR) { $s.CR.id = $s.CR.id || 'c' + $s.CR.seed; $s.CR.savedAt = new Date().toISOString(); SAVES.slots[$s.CR.id] = $s.CR; SAVES.active = $s.CR.id; DIRTY.add($s.CR.id); }
  else if (SAVES.active) { DIRTY.add(SAVES.active); delete SAVES.slots[SAVES.active]; SAVES.active = null; }
  writeSaves();
};
// lista para a tela de carreiras (mais recente primeiro)
function crSlots() {
  return Object.values(SAVES.slots).map(c => ({ id: c.id, name: c.me.name, ovr: overall(c.me.a), season: c.season, week: c.week, tier: TIERS[c.maxTier || 0].curto, money: c.money, savedAt: c.savedAt || '' }))
    .sort((a, b) => (b.savedAt > a.savedAt ? 1 : -1));
}
// personagem de um save (para jogar online): atributos com os equipamentos e a raquete em uso
function crCharFromSave(c) {
  if (!c || !c.me || !c.me.a) return null;
  const gb = {}; (c.gear || []).forEach(id => { const g = GEAR.find(x => x.id === id); if (g && g.b) for (const k in g.b) gb[k] = (gb[k] || 0) + g.b[k]; });
  const me = c.me, rk = c.racket === 'assinatura' ? 'zenite' : c.racket || 'basica';
  // mesmo limite da carreira: raquete + equipamento somam com retorno decrescente (a raquete entra de novo na partida, então desconta)
  const rb = racketBonus(rk), eq = {}; for (const [k] of ATTRS) { const t = (gb[k] || 0) + (rb[k] || 0); eq[k] = (t > 2 ? Math.min(3, 2 + (t - 2) * .25) : t) - (rb[k] || 0); }
  return { name: me.name, alt: me.alt, pais: me.pais, fem: !!me.fem, build: me.build, estilo: me.estilo, canhoto: me.canhoto, a: effA(me.a, eq), look: Object.assign({}, me.look, { racket: rk }) };
}
const crSlotChar = id => crCharFromSave(SAVES.slots[id]);
function crCharFromJSON(text) { let o; try { o = JSON.parse(text); } catch (e) { return null; } return crCharFromSave(o && o.formato === SAVE_FMT ? o.carreira : o); }
function crLoadSlot(id) { const c = SAVES.slots[id]; if (!c) return false; $s.CR = c; SAVES.active = id; writeSaves(); crMigrate(); crSyncChars(); return true; }
// sai da carreira atual sem apagar (volta para a lista)
function crCloseSlot() { $s.CR = null; SAVES.active = null; writeSaves(); crSyncChars(); }
function crDeleteSlot(id) { delete SAVES.slots[id]; DIRTY.add(id); if (SAVES.active === id) { SAVES.active = null; $s.CR = null; crSyncChars(); } flushSaves(); }
// arquivo .json com a carreira (para guardar no git e abrir em outro lugar)
function crExportData(id) {
  const c = SAVES.slots[id || SAVES.active]; if (!c) return null;
  const slug = String(c.me.name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'carreira';
  return { file: 'carreira-' + slug + '.json', text: JSON.stringify({ formato: SAVE_FMT, versao: 1, salvoEm: c.savedAt || new Date().toISOString(), carreira: c }) };
}
// lê um arquivo exportado; devolve { ok, msg, id }
function crImportData(text) {
  let o; try { o = JSON.parse(text); } catch (e) { return { ok: false, msg: 'O arquivo não é um JSON válido.' }; }
  const c = o && o.formato === SAVE_FMT ? o.carreira : o;
  if (!c || !c.me || !c.me.a || !c.seed || !c.pool || !c.season) return { ok: false, msg: 'Esse arquivo não é um save de carreira do ITF-BT Pro 2026.' };
  c.id = c.id || 'c' + c.seed;
  const cur = SAVES.slots[c.id];
  const replaced = !!cur;
  const wk52 = x => (x.v || 1) < 2 ? x.week * 2 - 1 : x.week; // saves antigos: semanas de 26
  if (cur && (cur.season * 100 + wk52(cur)) > (c.season * 100 + wk52(c)) && typeof confirm === 'function'
    && !confirm('A carreira "' + cur.me.name + '" salva aqui está mais adiantada (T' + cur.season + ' S' + cur.week + ') que a do arquivo (T' + c.season + ' S' + c.week + '). Substituir pela do arquivo?')) return { ok: false, msg: 'Importação cancelada.' };
  SAVES.slots[c.id] = c; DIRTY.add(c.id); flushSaves();
  return { ok: true, id: c.id, msg: (replaced ? 'Carreira atualizada: ' : 'Carreira importada: ') + c.me.name + ' (T' + c.season + ' S' + c.week + ').' };
}
// saves guardados na pasta saves/ do repositório no GitHub
const SAVE_REPO = 'Gabrieldick/ITF-BTpro-2026', SAVE_DIR = 'saves';
async function crRepoSaves() {
  const r = await fetch('https://api.github.com/repos/' + SAVE_REPO + '/contents/' + SAVE_DIR + '?ref=main', { headers: { Accept: 'application/vnd.github+json' } });
  if (r.status === 404) return [];
  if (!r.ok) throw new Error('GitHub respondeu ' + r.status);
  return (await r.json()).filter(f => f.type === 'file' && /\.json$/i.test(f.name)).map(f => ({ name: f.name, url: f.download_url }));
}
const crSaveErr = () => saveErr;
async function crImportUrl(url) { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) return { ok: false, msg: 'Não consegui baixar o save (' + r.status + ').' }; return crImportData(await r.text()); }
function crSyncChars() {
  if ($s.CR) crSignature();
  // o parceiro joga melhor quando está contente e pior quando está insatisfeito
  const mb = $s.CR && $s.CR.partner ? crMoodBonus() : 0, mbB = {}; if (mb) for (const [k] of ATTRS) mbB[k] = mb;
  // na partida cada um joga com a sua fase (e os reais com a evolução da carreira)
  $s.CAREER_CHARS = $s.CR ? $s.CR.pool.concat(ROSTER).map(c => { const fb = crFormB(c.id), on = Object.keys(fb).length || (mb && c.id === $s.CR.partner); return on ? Object.assign({}, c, { a: effA(c.a, fb, mb && c.id === $s.CR.partner ? mbB : null) }) : c; }).concat([crMeChar()]) : [];
}
// você em jogo: atributos + equipamentos (a raquete entra na hora da partida) - cansaço
function crGearBonus() { const b = {}; ($s.CR.gear || []).forEach(id => { const g = GEAR.find(x => x.id === id); if (g && g.b) for (const k in g.b) b[k] = (b[k] || 0) + g.b[k]; }); return b; }
// energia no desempenho (todos os atributos): abaixo de 10 → −4, de 20 → −3, de 30 → −2, de 45 → −1; acima de 85 → +1
const crEnergyMod = () => { const e = $s.CR.energy; return e < 10 ? -4 : e < 20 ? -3 : e < 30 ? -2 : e < 45 ? -1 : e > 85 ? 1 : 0; };
function crFatigue() { const p = crEnergyMod(); const b = {}; for (const [k] of ATTRS) b[k] = p; return b; }
function crMental() { const b = {}; if ($s.CR.staff.psico) for (const [k] of ATTRS) b[k] = 1; return b; }
// equipamento (raquete + acessórios + psicólogo) somado por atributo, com retorno decrescente: até +2 vale cheio,
// o que passa disso vale 25%, e nunca mais que +3 (os pontos fracos da raquete continuam valendo inteiros)
function crEquipB() {
  const g = crGearBonus(), r = racketBonus($s.CR.racket), m = crMental(), out = {};
  for (const [k] of ATTRS) { const b = (g[k] || 0) + (r[k] || 0) + (m[k] || 0); out[k] = b > 2 ? Math.min(3, 2 + (b - 2) * .25) : b; }
  return out;
}
// rkIn: a raquete já está somada (a partida não soma de novo)
function crMeChar() { const m = $s.CR.me; return Object.assign({}, m, { a: effA(m.a, crEquipB(), crFatigue()), rkIn: true }); }
const crMeOvr = () => overall(effA($s.CR.me.a, crEquipB(), crFatigue()));
// fase de cada atleta: oscila semana a semana (−3 a +3 em todos os atributos); os profissionais reais também mudam de
// nível de uma temporada para outra (até ±4), já que eles não envelhecem como os fictícios
const crFormV = id => Math.round((($s.CR && $s.CR.form) || {})[id] || 0) + ((($s.CR && $s.CR.drift) || {})[id] || 0);
function crFormB(id) { const v = crFormV(id), b = {}; if (v) for (const [k] of ATTRS) b[k] = v; return b; }
const crFormWord = id => { const v = Math.round((($s.CR && $s.CR.form) || {})[id] || 0); return v >= 2 ? ['▲▲', 'em grande fase'] : v === 1 ? ['▲', 'em boa fase'] : v <= -2 ? ['▼▼', 'em má fase'] : v === -1 ? ['▼', 'em fase ruim'] : null; };
function crFormWeek() {
  const f = $s.CR.form = $s.CR.form || {}, rnd = Math.random;
  crWorld().forEach(c => { const v = (f[c.id] || 0) * .8 + gaussR(rnd) * .9; if (Math.abs(v) < .05) delete f[c.id]; else f[c.id] = Math.round(clamp(v, -3.4, 3.4) * 100) / 100; });
}
function crDriftSeason(rnd) {
  const d = $s.CR.drift = $s.CR.drift || {};
  ROSTER.forEach(c => { const v = clamp((d[c.id] || 0) + Math.round(gaussR(rnd) * .9), -4, 4); if (v) d[c.id] = v; else delete d[c.id]; });
}
const crCharOvr = c => c.id === 'crme' ? crMeOvr() : overall(effA(c.a, racketBonus(c.look && c.look.racket), crFormB(c.id)));
// mundo do seu gênero (fictícios + astros reais)
const crWorld = () => $s.CR.pool.filter(c => !!c.fem === !!$s.CR.me.fem).concat(ROSTER.filter(c => !!c.fem === !!$s.CR.me.fem));
const POOL_IDX = { pool: null, len: 0, map: null };
function poolGet(id) {
  if (POOL_IDX.pool !== $s.CR.pool || POOL_IDX.len !== $s.CR.pool.length) { POOL_IDX.pool = $s.CR.pool; POOL_IDX.len = $s.CR.pool.length; POOL_IDX.map = new Map($s.CR.pool.map(c => [c.id, c])); }
  return POOL_IDX.map.get(id);
}
const crChar = id => id === 'crme' ? crMeChar() : (poolGet(id) || ROSTER.find(c => c.id === id));
const absWeek = () => ($s.CR.season - 1) * SEASON_WEEKS + $s.CR.week;
const crPts = () => bestN($s.CR.results.filter(r => r.w > absWeek() - SEASON_WEEKS).map(r => r.pts));
// resultados dos outros: lista compacta (semana absoluta * 10000 + pontos), só os 12 melhores ainda válidos
const npcPts = id => { const a = ($s.CR.npcR || {})[id]; if (!a) return 0; const lim = absWeek() - SEASON_WEEKS; return bestN(a.filter(x => Math.floor(x / 10000) > lim).map(x => x - Math.floor(x / 10000) * 10000)); };
const RK = { key: '', list: null };
function crRanking() {
  const key = [$s.CR.id, $s.CR.season, $s.CR.week, $s.CR.results.length, $s.CR.pool.length, $s.CR.me.fem ? 1 : 0, RK.gen || 0].join('|');
  if (RK.key === key && RK.list) return RK.list;
  const list = crWorld().map(c => ({ id: c.id, pts: npcPts(c.id) }));
  list.push({ id: 'crme', pts: crPts() });
  RK.key = key; RK.list = list.sort((x, y) => y.pts - x.pts || (x.id === 'crme' ? 1 : -1));
  return RK.list;
}
// ranking só com os atletas de um estado (mesmos pontos do ranking geral)
function crStateRanking(uf) { return crRanking().filter(r => { const c = crChar(r.id); return c && c.pais === 'BRA' && crUf(c) === uf; }); }
const crRank = () => crRanking().findIndex(r => r.id === 'crme') + 1;
const npcTier = o => { let t = 0; for (let i = 0; i < 9; i++) if (TIERS[i].ovr[0] + 3 <= o) t = i; return t; };
// ---------- categorias do Brasileiro de Seleções Estaduais: C, B, A e Profissional (BT10 em diante) ----------
// catN[id] = [torneios na C, na B, na A, no profissional, pontos acumulados no profissional] (a carreira toda)
// catR[id] = resultados das últimas 52 semanas por categoria ((semana + 1000) * 100000 + categoria * 10000 + pontos;
// o +1000 mantém positivo o ano simulado antes da semana 1)
// quem jogou 3 torneios numa categoria sai do ranking das de baixo e não joga mais nelas; da A só sai com 70 pontos no profissional
const CAT_NAMES = ['C', 'B', 'A', 'Profissional'];
const catOfTier = t => Math.min(3, t);
const crCatN = id => (($s.CR.catN || {})[id]) || [0, 0, 0, 0, 0];
function crMinCat(id) { const n = crCatN(id); return n[4] >= 70 ? 3 : n[2] >= 3 || n[3] >= 3 ? 2 : n[1] >= 3 ? 1 : 0; }
const crMinTier = id => crMinCat(id); // categoria mínima = nível mínimo de torneio (C=0, B=1, A=2, profissional=3)
function crCatAdd(id, tier, pts, aw, noR) { // noR: estrangeiro, não entra nos rankings estaduais
  const N = $s.CR.catN = $s.CR.catN || {}, R = $s.CR.catR = $s.CR.catR || {}, k = catOfTier(tier);
  const n = N[id] = N[id] || [0, 0, 0, 0, 0]; n[k] = Math.min(99, n[k] + 1); if (k === 3) n[4] = Math.min(9999, n[4] + pts);
  if (pts > 0 && !noR) { const lim = aw - SEASON_WEEKS; let a = (R[id] || []).filter(x => Math.floor(x / 100000) - 1000 > lim); a.push((aw + 1000) * 100000 + k * 10000 + pts); if (a.length > 12) { a.sort((x, y) => y % 10000 - x % 10000); a.length = 12; } R[id] = a; }
}
// pontos de cada categoria (10 melhores das últimas 52 semanas)
function crCatPts(id) {
  const out = [0, 0, 0, 0], a = ($s.CR.catR || {})[id]; if (!a) return out;
  const lim = absWeek() - SEASON_WEEKS, by = [[], [], [], []];
  a.forEach(x => { if (Math.floor(x / 100000) - 1000 > lim) by[Math.floor(x / 10000) % 10].push(x % 10000); });
  return by.map(l => bestN(l));
}
// categoria em que o atleta joga hoje (o nível dele, nunca abaixo da categoria mínima)
const crCatLevel = c => Math.max(crMinCat(c.id), c.id === 'crme' ? catOfTier(crMaxTier()) : catOfTier(npcTier(crCharOvr(c))));
// ranking de uma categoria (só atletas de um estado, se uf): quem ainda pode jogar nela e tem pontos nela ou joga nela hoje
function crCatRanking(k, uf) {
  const out = [];
  crWorld().concat([crMeChar()]).forEach(c => {
    if (uf && (c.pais !== 'BRA' || crUf(c) !== uf)) return;
    if (crMinCat(c.id) > k) return;
    const pts = crCatPts(c.id)[k];
    if (pts > 0 || crCatLevel(c) === k) out.push({ id: c.id, pts, ovr: crCharOvr(c), c });
  });
  return out.sort((x, y) => y.pts - x.pts || y.ovr - x.ovr);
}
// saves antigos: monta as contagens e os pontos por categoria a partir dos resultados que já existem
function crCatSeed() {
  $s.CR.catN = {}; $s.CR.catR = {};
  const L = $s.CR.pool.concat(ROSTER);
  L.forEach(c => { const a = ($s.CR.npcR || {})[c.id]; if (!a) return; const t = npcTier(crCharOvr(c)); a.slice().sort((x, y) => x - y).forEach(x => crCatAdd(c.id, t, x - Math.floor(x / 10000) * 10000, Math.floor(x / 10000), c.pais !== 'BRA')); });
  ($s.CR.history || []).slice().reverse().forEach(h => { const ti = TIERS.findIndex(T => T.curto === h.tier); if (ti >= 0 && ti < 9) crCatAdd('crme', ti, h.pts || 0, (h.s - 1) * SEASON_WEEKS + h.w); });
  $s.CR.catV = 1;
}
// semana dos outros (semana absoluta aw): cada um joga o torneio do seu nível que existir naquela semana
// (ou o de baixo) e guarda o resultado; o ranking soma os 10 melhores das últimas 52 semanas
function crSimWorld(rnd, list, aw, ovrs) {
  rnd = rnd || Math.random; RK.gen = (RK.gen || 0) + 1;
  if (aw === undefined) aw = absWeek();
  const season = Math.floor((aw - 1) / SEASON_WEEKS) + 1, wk = aw - (season - 1) * SEASON_WEEKS;
  const cal = crSeasonCal(season)[wk] || [], lim = aw - SEASON_WEEKS, R = $s.CR.npcR = $s.CR.npcR || {};
  (list || $s.CR.pool.concat(ROSTER)).forEach(c => {
    const o = ovrs ? ovrs.get(c.id) : crCharOvr(c);
    const mt = crMinTier(c.id);
    let t = Math.max(npcTier(o), mt); while (t >= 3 && !cal.includes(t)) t--;
    let arr = R[c.id];
    if (t >= mt && rnd() < (t >= 3 ? .55 : .45)) {
      const T = TIERS[t], perf = (o - (T.ovr[0] + T.ovr[1]) / 2) / ((T.ovr[1] - T.ovr[0]) / 2) + gaussR(rnd) * .6;
      const idx = perf > 1.25 ? 0 : perf > .75 ? 1 : perf > .25 ? 2 : perf > -.35 ? 3 : 4, pts = T.pts[Math.min(idx, T.pts.length - 1)];
      if (pts > 0) { arr = arr || []; arr.push(aw * 10000 + pts); }
      crCatAdd(c.id, t, pts, aw, c.pais !== 'BRA');
    }
    if (arr) {
      arr = arr.filter(x => Math.floor(x / 10000) > lim);
      if (arr.length > 12) { arr.sort((x, y) => (y - Math.floor(y / 10000) * 10000) - (x - Math.floor(x / 10000) * 10000)); arr.length = 12; }
      if (arr.length) R[c.id] = arr; else delete R[c.id];
    }
  });
}
// um ano inteiro de resultados do mundo (criação da carreira e migração dos saves antigos)
function crSimYear(seedK, list) {
  const r = mulberry($s.CR.seed + seedK), L = list || $s.CR.pool.concat(ROSTER), ovrs = new Map(L.map(c => [c.id, crCharOvr(c)])), now = absWeek();
  for (let aw = now - SEASON_WEEKS + 1; aw <= now; aw++) crSimWorld(r, L, aw, ovrs);
}
function gaussR(rnd) { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function crTierUnlocked(i) {
  if (i === 9) return false;
  return i === 0 || ($s.CR.titles[i - 1] || 0) > 0 || crPts() >= TIERS[i].req || $s.CR.maxTier >= i;
}
function crMaxTier() { let m = 0; for (let i = 0; i < 9; i++) if (crTierUnlocked(i)) m = i; return Math.max(m, crMinTier('crme')); } // nunca abaixo da categoria mínima
// opções de uma semana: os torneios do calendário no seu nível e até 3 abaixo (amadores toda semana; profissionais só nas
// semanas em que existem). Na semana 51, o Mundial para o top 16
function crWeekOptions(wk) {
  if (wk === undefined) wk = $s.CR.week;
  if ($s.CR.injury && wk === $s.CR.week) return [];
  const aw = ($s.CR.season - 1) * SEASON_WEEKS + wk;
  const rnd = mulberry($s.CR.seed + aw * 97);
  const top = crMaxTier(), opts = [], cal = crSeasonCal($s.CR.season)[wk] || [];
  const tiers = [top, top - 1, top - 2, top - 3].filter(t => t >= crMinTier('crme') && (t < 3 || cal.includes(t))).slice(0, 3);
  if (cal.includes(9) && crRank() <= 16) tiers.unshift(9);
  const seen = new Set();
  tiers.forEach((t, k) => {
    const T = TIERS[t]; let city = T.cities[Math.floor(rnd() * T.cities.length)];
    if (seen.has(t + city)) city = T.cities[(T.cities.indexOf(city) + 1) % T.cities.length];
    seen.add(t + city);
    const uf = $s.CR.me.pais === 'BRA' ? $s.CR.me.uf || 'SP' : null;
    if (t < 3 && uf && STATE_INFO[uf]) { // amadores: nas cidades do seu estado
      const pre = ['Copa', 'Open', 'Torneio', 'Desafio', 'Circuito'];
      city = pre[Math.floor(rnd() * pre.length)] + ' ' + crAmateurPlace(uf, rnd);
      if (seen.has(t + city)) city += ' II';
      seen.add(t + city);
      opts.push({ tier: t, name: city + ' · ' + T.curto, uf }); return;
    }
    opts.push({ tier: t, name: t >= 3 && t < 9 ? city : city + (t < 3 ? ' · ' + T.curto : '') });
  });
  const list = opts.filter((o, i, arr) => arr.findIndex(x => x.name === o.name) === i).slice(0, 4);
  if ($s.CR.wildcard > 0 && top < 8 && (top + 1 < 3 || cal.includes(top + 1)) && wk === $s.CR.week) { const T = TIERS[top + 1]; list.unshift({ tier: top + 1, name: T.cities[Math.floor(rnd() * T.cities.length)] + ' (wildcard)', wild: true }); }
  const out = crSpecialOptions(wk).concat(list);
  const st = tiers.find(t => t < 9); // simples: o nível mais alto que tem torneio nesta semana
  if (aw % 3 === 0 && st !== undefined) { const T = TIERS[st]; out.push({ singles: true, tier: st, name: 'Simples · ' + T.cities[Math.floor(rnd() * T.cities.length)] + (st < 3 ? ' · ' + T.curto : '') }); }
  out.forEach(o => { o.days = crOptPro(o) ? 2 : 1; });
  return out;
}
const crOptPro = o => o.special && o.special !== 'estadual' ? true : o.tier >= 3 && o.special !== 'estadual';
// próximos torneios profissionais do seu nível (e um acima) para planejar o calendário
function crUpcoming(n) {
  const top = crMaxTier(), out = [];
  for (let w = $s.CR.week + 1; w <= SEASON_WEEKS && out.length < (n || 8); w++) {
    const cal = crSeasonCal($s.CR.season)[w] || [];
    crWeekOptions(w).filter(o => o.special && o.special !== 'estadual' ? !o.notCalled : o.tier >= Math.max(3, top - 1) && o.tier <= top + 1 && !o.wild && !o.singles).forEach(o => out.push({ w, o, date: crDateTxt($s.CR.season, w, 6) + (o.days > 1 ? '–' + crDate($s.CR.season, w, 7).getDate() : '') }));
    if (cal.includes(top + 1) && top + 1 < 9 && top + 1 >= 3 && out.filter(x => x.o.locked).length < 3) out.push({ w, o: { tier: top + 1, name: TIERS[top + 1].curto + ' (acima do seu nível)', locked: true }, date: crDateTxt($s.CR.season, w, 6) });
  }
  return out.slice(0, n || 8);
}
// ---------- criação ----------
function crCreate(o) {
  const seed = Math.floor(Math.random() * 1e9);
  const rnd = mulberry(seed + 7);
  const promessa = o.perfil === 'promessa';
  // categoria inicial (padrão: Amador C): o overall começa no meio da faixa dela (promessa um pouco abaixo, experiente acima)
  const st = clamp(Math.round(o.start || 0), 0, 6), T0 = TIERS[st];
  const target = crStartTarget(o.perfil, st);
  // pontos distribuídos na tela de criação: valem se não passarem do total do estilo e ficarem dentro dos limites
  let attrs = null;
  if (o.attrs) { const base = crPresetAttrs(target, o.style), sum = a => ATTRS.reduce((t, [k]) => t + a[k], 0);
    if (ATTRS.every(([k]) => o.attrs[k] >= Math.max(30, target - 15) && o.attrs[k] <= target + 15) && sum(o.attrs) <= sum(base)) attrs = Object.assign({}, o.attrs); }
  const me = { id: 'crme', uf: (o.pais || 'BRA') === 'BRA' ? o.uf || 'SP' : undefined, name: o.name || 'Você', alt: o.alt, pais: o.pais || 'BRA', estilo: STYLES[o.style].nome, build: o.build || 'atletico', fem: o.fem, canhoto: o.canhoto || undefined,
    a: attrs || makeAttrs(target, o.style, rnd), look: Object.assign({ skin: o.skin, hair: o.hair, num: '99', racket: 'basica' }, o.acc === 'cap' ? { cap: '#fbf6ea' } : o.acc === 'visor' ? { visor: '#fbf6ea' } : o.acc === 'band' ? { headband: '#ff5a1f' } : {}, o.hairStyle ? { hairStyle: o.hairStyle } : {}, !o.fem && o.beard ? { beard: o.beard } : { beard: '' }, o.fem ? { tank: true } : {}, { glasses: !!o.glasses, band: true }) };
  $s.CR = { v: 2, id: 'c' + seed, seed, me, pot: promessa ? 94 + Math.floor(rnd() * 4) : 86 + Math.floor(rnd() * 4), age: (promessa ? 17 : 22) + Math.round(st * .8),
    money: Math.round((promessa ? 800 : 1200) + (st ? T0.prize[0] * .6 : 0)), pe: 0, energy: 100, season: 1, week: 1, day: 1, wlog: {}, results: [], npcR: {}, titles: {}, maxTier: st, startTier: st,
    partner: null, chem: 0, offers: [], beat: {}, racket: 'basica', rackets: promessa ? ['basica'] : ['basica', 'fibra'], gear: [], staff: {},
    history: [], ovrLog: [], tour: null, games: 4, lastMsg: '', pool: genPool(seed) };
  if (!promessa) $s.CR.racket = 'fibra';
  if (st >= 2) { const rk = st >= 5 ? 'proteo' : st >= 3 ? 'coral' : 'mare'; $s.CR.rackets.push(rk); $s.CR.racket = rk; } // começando mais alto, já tem uma raquete melhor
  me.look.racket = $s.CR.racket;
  $s.CR.v = 2; $s.CR.potCur = Math.min($s.CR.pot, overall(me.a) + 6);
  crMigrate();
  crSimYear(11);
  $s.CR.ovrLog.push({ s: 1, w: 1, o: overall($s.CR.me.a) });
  crSyncChars(); saveCareer();
}
// ---------- parceiros ----------
function crRankBonus() { const r = crRank(), n = crWorld().length + 1; return r <= 10 ? 8 : r <= 25 ? 6 : r <= 50 ? 4 : r <= n * .5 ? 2 : 0; }
function crWillPartner(c) {
  if ($s.CR.offers.includes(c.id)) return { ok: true, why: 'Convite aceito' };
  const me = crMeOvr(), o = crCharOvr(c), beat = Math.min(2, $s.CR.beat[c.id] || 0);
  // quem está muito acima no ranking só aceita se você já o venceu (ou se ele mesmo convidar)
  const myPts = crPts(), pts = npcPts(c.id);
  if (!beat && pts > Math.max(myPts * 1.6 + 60, myPts + 120)) return { ok: false, why: 'Muito acima no ranking: só joga com quem o vencer' };
  const lim = me + 3 + Math.floor(crRankBonus() / 2) + beat * 3;
  if (o <= lim) return { ok: true, why: beat ? 'Respeita você: já perdeu para você' : 'Topa jogar com você' };
  return { ok: false, why: o - lim > 8 ? 'Fora do seu nível por enquanto' : 'Quer alguém com mais ranking ou que já o tenha vencido' };
}
function crSetPartner(id) { if ($s.CR.partner !== id) { $s.CR.partner = id; $s.CR.chem = 0; $s.CR.mood = 60; } $s.CR.offers = $s.CR.offers.filter(x => x !== id); saveCareer(); }
// humor do parceiro (0–100): sobe com vitórias e com o que você faz por ele, cai com derrotas; muito baixo, ele desfaz a dupla
const crMoodWord = () => { const m = $s.CR.mood; return m >= 80 ? 'empolgado' : m >= 60 ? 'contente' : m >= 40 ? 'neutro' : m >= 25 ? 'insatisfeito' : 'quer sair'; };
const crMoodBonus = () => { const m = $s.CR.mood; return m >= 80 ? 2 : m >= 65 ? 1 : m < 25 ? -3 : m < 40 ? -1 : 0; };
function crMood(v, why) {
  if (!$s.CR.partner) return '';
  $s.CR.mood = clamp(($s.CR.mood ?? 60) + v, 0, 100);
  if ($s.CR.mood < 15) { const n = nameOf(crChar($s.CR.partner)); $s.CR.partner = null; $s.CR.chem = 0; $s.CR.mood = 60; return n + ' estava muito insatisfeito e desfez a dupla.'; }
  return why || '';
}
// ações com o parceiro (uma de cada por semana)
function crPartnerAct(k) {
  if (!$s.CR.partner) return;
  $s.CR.pact = $s.CR.pact || {};
  if ($s.CR.pact[k] === absWeek()) { $s.CR.lastMsg = 'Já fizeram isso esta semana.'; return; }
  const n = nameOf(crChar($s.CR.partner));
  if (k === 'jantar') { const c = 150 * (crMaxTier() + 1); if ($s.CR.money < c) { $s.CR.lastMsg = 'Dinheiro insuficiente.'; return; } $s.CR.money -= c; $s.CR.lastMsg = crMood(8, 'Jantar com ' + n + ': o clima melhorou (+8 de humor).'); }
  if (k === 'treino') { if ($s.CR.energy < 15) { $s.CR.lastMsg = 'Energia baixa demais.'; return; } $s.CR.energy -= 10; const g = Math.round(2 * crXpMul()); $s.CR.pe += g; if (Math.random() < .35) $s.CR.chem = Math.min(5, $s.CR.chem + 1); $s.CR.lastMsg = crMood(4, 'Treino em dupla com ' + n + ': +' + g + ' pontos de evolução e +4 de humor.'); }
  if (k === 'conversa') { const up = $s.CR.mood < 50 ? 6 : 3; $s.CR.lastMsg = crMood(up, 'Conversa franca com ' + n + ' sobre o calendário: +' + up + ' de humor.'); }
  $s.CR.pact[k] = absWeek(); crSyncChars(); saveCareer();
}
// ---------- metas da temporada ----------
function crGoalOptions() {
  const r = crRank(), mt = crMaxTier(), o = overall($s.CR.me.a), T = TIERS[mt];
  const top = r <= 3 ? 1 : r <= 10 ? 3 : r <= 25 ? 10 : r <= 60 ? 25 : r <= 150 ? 60 : 150;
  return [
    { id: 'rank', txt: 'Terminar a temporada no top ' + top + ' do ranking', n: top, money: Math.round(T.prize[0] * .6), pe: 18, fama: 4 },
    { id: 'titulo', txt: 'Ganhar um título de ' + T.curto + ' ou maior', n: mt, money: Math.round(T.prize[0] * .4), pe: 24, fama: 6 },
    { id: 'ovr', txt: 'Chegar a ' + (o + 2) + ' de overall', n: o + 2, money: Math.round(T.prize[0] * .3), pe: 10, fama: 2 },
  ];
}
function crPickGoal(i) { const o = crGoalOptions()[i]; if (!o) return; $s.CR.goal = Object.assign({ season: $s.CR.season, t0: Object.assign({}, $s.CR.titles) }, o); $s.CR.lastMsg = 'Meta da temporada: ' + o.txt + '.'; saveCareer(); }
function crGoalDone(g) {
  if (!g) return false;
  if (g.id === 'rank') return crRank() <= g.n;
  if (g.id === 'ovr') return overall($s.CR.me.a) >= g.n;
  if (g.id === 'titulo') return Object.entries($s.CR.titles).some(([k, v]) => +k >= g.n && v > ((g.t0 || {})[k] || 0));
  return false;
}
// ---------- estilo de vida: gastos com benefício ----------
const LIFE = [
  { id: 'nutri', nome: 'Nutricionista esportivo', preco: 4000, temp: true, desc: '+5 de energia por semana (até o fim da temporada).' },
  { id: 'imprensa', nome: 'Assessoria de imprensa', preco: 6000, temp: true, desc: '+1 de fama por semana, até o que o seu nível sustenta +12 (até o fim da temporada).' },
  { id: 'crio', nome: 'Sala de recuperação (crioterapia)', preco: 12000, desc: 'Semana de descanso recupera +20 de energia a mais.' },
  { id: 'carro', nome: 'Carro e motorista para as viagens', preco: 20000, desc: 'Viagens dos torneios 30% mais baratas.' },
  { id: 'casa', nome: 'Casa na praia', preco: 90000, desc: '+3 de energia por semana e o humor do parceiro cai mais devagar (vocês treinam lá).' },
  { id: 'social', nome: 'Projeto social de beach tennis', preco: 30000, desc: 'Escolinha para crianças da comunidade: +6 de fama na hora e +1 de fama a cada título.' },
];
const crLife = id => !!(($s.CR.life || {})[id] || ($s.CR.lifeS || {})[id]);
function crLifeBuy(id) {
  const it = LIFE.find(x => x.id === id); if (!it || crLife(id)) return;
  if ($s.CR.money < it.preco) { $s.CR.lastMsg = 'Dinheiro insuficiente para ' + it.nome + '.'; return; }
  $s.CR.money -= it.preco; (it.temp ? $s.CR.lifeS : $s.CR.life)[id] = true;
  if (id === 'social') crAddFama(6);
  $s.CR.lastMsg = 'Comprado: ' + it.nome + '.'; saveCareer();
}
const crTravel = T => Math.round(T.travel * (crLife('carro') ? .7 : 1));
// ---------- estados e seleções ----------
const STATES = [['SP', 'São Paulo'], ['RJ', 'Rio de Janeiro'], ['SC', 'Santa Catarina'], ['BA', 'Bahia'], ['CE', 'Ceará'], ['PE', 'Pernambuco'], ['RS', 'Rio Grande do Sul'], ['PR', 'Paraná'], ['ES', 'Espírito Santo'], ['RN', 'Rio Grande do Norte'], ['AL', 'Alagoas'], ['PB', 'Paraíba'], ['MG', 'Minas Gerais'], ['DF', 'Distrito Federal']];
// cidades (praias e quadras) de cada estado para os torneios amadores e estaduais, e as cores da arena (bandeira do estado)
const STATE_INFO = {
  SP: { cities: ['Guarujá', 'Santos', 'Ubatuba', 'Ilhabela', 'Maresias', 'São Paulo · Ibirapuera'], pal: { line: '#d6332f', trim: '#111111', sand: '#f7ecd6', seat: '#111111', board: ['#111111', '#ffffff'] } },
  RJ: { cities: ['Copacabana', 'Ipanema', 'Búzios', 'Niterói', 'Arraial do Cabo', 'Barra da Tijuca'], pal: { line: '#1f4fb8', trim: '#ffffff', sand: '#fffdf8', seat: '#1f4fb8', board: ['#1f4fb8', '#ffffff'] } },
  SC: { cities: ['Florianópolis', 'Balneário Camboriú', 'Itajaí', 'Bombinhas', 'Garopaba', 'Jurerê'], pal: { line: '#d6332f', trim: '#0a7d3c', sand: '#f3e7cf', seat: '#0a7d3c', board: ['#d6332f', '#ffffff'] } },
  BA: { cities: ['Salvador', 'Porto Seguro', 'Itacaré', 'Praia do Forte', 'Itapuã'], pal: { line: '#1f4fb8', trim: '#d6332f', sand: '#fffaf0', seat: '#d6332f', board: ['#1f4fb8', '#ffffff'] } },
  CE: { cities: ['Fortaleza', 'Jericoacoara', 'Canoa Quebrada', 'Cumbuco', 'Iracema'], pal: { line: '#0a7d3c', trim: '#ffd23f', sand: '#fffdf6', seat: '#0a7d3c', board: ['#0a7d3c', '#ffd23f'] } },
  PE: { cities: ['Recife', 'Porto de Galinhas', 'Olinda', 'Boa Viagem'], pal: { line: '#1f4fb8', trim: '#ffd23f', sand: '#fffaf0', seat: '#d6332f', board: ['#1f4fb8', '#ffd23f'] } },
  RS: { cities: ['Porto Alegre', 'Torres', 'Capão da Canoa', 'Tramandaí', 'Xangri-lá'], pal: { line: '#0a7d3c', trim: '#d6332f', sand: '#ead8b4', seat: '#0a7d3c', board: ['#0a7d3c', '#ffd23f'] } },
  PR: { cities: ['Curitiba', 'Matinhos', 'Guaratuba', 'Caiobá', 'Ilha do Mel'], pal: { line: '#0a7d3c', trim: '#1f4fb8', sand: '#efdfbf', seat: '#1f4fb8', board: ['#0a7d3c', '#ffffff'] } },
  ES: { cities: ['Vitória', 'Vila Velha', 'Guarapari', 'Camburi'], pal: { line: '#1f4fb8', trim: '#e86fa0', sand: '#f8ecd8', seat: '#e86fa0', board: ['#1f4fb8', '#ffffff'] } },
  RN: { cities: ['Natal', 'Pipa', 'Ponta Negra', 'Genipabu'], pal: { line: '#0a7d3c', trim: '#ffffff', sand: '#fffdf6', seat: '#0a7d3c', board: ['#0a7d3c', '#ffffff'] } },
  AL: { cities: ['Maceió', 'Maragogi', 'Pajuçara', 'São Miguel dos Milagres'], pal: { line: '#d6332f', trim: '#1f4fb8', sand: '#fffdf8', seat: '#1f4fb8', board: ['#d6332f', '#ffffff'] } },
  PB: { cities: ['João Pessoa', 'Cabedelo', 'Tambaú', 'Cabo Branco'], pal: { line: '#d6332f', trim: '#111111', sand: '#fffaf0', seat: '#111111', board: ['#d6332f', '#111111'] } },
  MG: { cities: ['Belo Horizonte', 'Uberlândia', 'Juiz de Fora', 'Lagoa da Pampulha'], pal: { line: '#d6332f', trim: '#ffffff', sand: '#e9d3a8', seat: '#d6332f', board: ['#d6332f', '#ffffff'] } },
  DF: { cities: ['Brasília', 'Lago Paranoá', 'Taguatinga'], pal: { line: '#0a7d3c', trim: '#ffd23f', sand: '#ead7ae', seat: '#0a7d3c', board: ['#0a7d3c', '#ffd23f'] } },
};
// arenas e points de beach tennis da capital de cada estado (copas amadoras e estaduais)
const VENUES = {
  SP: ['São Paulo', ['Arena Vila Olímpia', 'Point Pinheiros', 'Arena Moema', 'Beach Point Tatuapé', 'Arena Santana', 'Point Morumbi', 'Arena Brooklin', 'Point Vila Madalena']],
  RJ: ['Rio de Janeiro', ['Point do Leblon', 'Arena Barra', 'Arena Recreio', 'Point Botafogo', 'Arena Flamengo', 'Point Leme', 'Arena Tijuca']],
  SC: ['Florianópolis', ['Arena Jurerê', 'Point Lagoa da Conceição', 'Arena Campeche', 'Point Coqueiros', 'Arena Trindade', 'Point Canasvieiras']],
  BA: ['Salvador', ['Arena Pituba', 'Point Barra', 'Arena Itapuã', 'Point Rio Vermelho', 'Arena Stella Maris', 'Point Ondina']],
  CE: ['Fortaleza', ['Arena Beira-Mar', 'Point Meireles', 'Arena Praia do Futuro', 'Point Aldeota', 'Arena Cocó']],
  PE: ['Recife', ['Arena Boa Viagem', 'Point Pina', 'Arena Casa Forte', 'Point Graças', 'Arena Piedade']],
  RS: ['Porto Alegre', ['Arena Moinhos', 'Point Orla do Guaíba', 'Arena Petrópolis', 'Point Ipanema', 'Arena Menino Deus']],
  PR: ['Curitiba', ['Arena Batel', 'Point Água Verde', 'Arena Ecoville', 'Point Bigorrilho', 'Arena Barigui']],
  ES: ['Vitória', ['Arena Camburi', 'Point Praia do Canto', 'Arena Jardim da Penha', 'Point Curva da Jurema']],
  RN: ['Natal', ['Arena Ponta Negra', 'Point Areia Preta', 'Arena Lagoa Nova', 'Point Via Costeira']],
  AL: ['Maceió', ['Arena Ponta Verde', 'Point Jatiúca', 'Arena Pajuçara', 'Point Cruz das Almas']],
  PB: ['João Pessoa', ['Arena Tambaú', 'Point Cabo Branco', 'Arena Manaíra', 'Point Bessa']],
  MG: ['Belo Horizonte', ['Arena Pampulha', 'Point Savassi', 'Arena Belvedere', 'Point Lourdes', 'Arena Buritis']],
  DF: ['Brasília', ['Arena Lago Sul', 'Point Asa Norte', 'Arena Sudoeste', 'Point Pontão', 'Arena Lago Norte']],
};
// local de um torneio amador: metade das vezes uma arena/point da capital, metade uma cidade do estado
function crAmateurPlace(uf, rnd) {
  const v = VENUES[uf];
  if (v && rnd() < .55) return v[1][Math.floor(rnd() * v[1].length)] + ' · ' + v[0];
  const cs = STATE_INFO[uf].cities; return cs[Math.floor(rnd() * cs.length)];
}
const AMERICAS = ['BRA', 'ARG', 'VEN', 'URU', 'CHI', 'PAR', 'COL', 'PER', 'MEX', 'USA', 'CAN', 'ARU'];
const hashId = id => { let h = 2166136261; for (const ch of String(id)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
const crUf = c => c.id === 'crme' ? ($s.CR.me.uf || 'SP') : c.pais === 'BRA' ? STATES[hashId(c.id) % STATES.length][0] : null;
const ufName = uf => (STATES.find(x => x[0] === uf) || [uf, uf])[1];
// torneios especiais: estaduais (desde o Amador C), seleções estaduais e seleções nacionais (com convocação)
const SPECIAL = {
  estadual: { nome: 'Estadual', pro: false },
  selEst: { nome: 'Brasileiro de Seleções Estaduais', curto: 'SELEÇÕES ESTADUAIS', tier: 5, draw: 8, prize: [6000, 3000, 1500, 600], pts: [0, 0, 0, 0], xp: [10, 7, 5, 3], fama: [6, 3, 1, 0], pro: true },
  pan: { nome: 'Jogos Pan-Americanos', curto: 'PAN-AMERICANO', tier: 7, draw: 8, prize: [20000, 10000, 5000, 2000], pts: [0, 0, 0, 0], xp: [16, 12, 8, 5], fama: [12, 6, 3, 1], pro: true },
  confed: { nome: 'Copa das Confederações', curto: 'CONFEDERAÇÕES', tier: 7, draw: 8, prize: [30000, 15000, 7000, 3000], pts: [0, 0, 0, 0], xp: [18, 13, 9, 5], fama: [14, 7, 3, 1], pro: true },
  mundSel: { nome: 'Mundial de Seleções', curto: 'MUNDIAL DE SELEÇÕES', tier: 8, draw: 16, prize: [50000, 25000, 12000, 5000, 1500], pts: [0, 0, 0, 0, 0], xp: [22, 16, 11, 7, 3], fama: [20, 10, 5, 2, 0], pro: true },
};
// dados do torneio atual (normal ou especial)
function crTourT(t) {
  const base = Object.assign({}, TIERS[t.tier], { pro: t.tier >= 3 });
  if (t.singles) return Object.assign(base, { nome: 'Simples · ' + TIERS[t.tier].nome, draw: 8, prize: TIERS[t.tier].prize.map(v => Math.round(v * .5)), pts: TIERS[t.tier].pts.map(() => 0), xp: TIERS[t.tier].xp.map(v => v + 1) });
  if (!t.special) return base;
  if (t.special === 'estadual') return Object.assign(base, { nome: 'Estadual ' + ufName($s.CR.me.uf || 'SP') + ' · ' + TIERS[t.tier].curto, prize: TIERS[t.tier].prize.map(v => Math.round(v * .7)), pts: TIERS[t.tier].pts.map(v => Math.round(v * .5)), xp: TIERS[t.tier].xp.map(v => v + 1), draw: 8, pro: false });
  if (t.mixed) { const k = [.12, .18, .25, .4, .55, .7, .85, 1, 1.1][t.tier] || 1; return Object.assign(base, SPECIAL.selEst, { tier: t.tier, diff: TIERS[t.tier].diff, prize: SPECIAL.selEst.prize.map(v => Math.round(v * k / 10) * 10) }); }
  return Object.assign(base, SPECIAL[t.special]);
}
// duplas por grupo (país ou estado): os dois melhores de cada um (você entra no seu grupo)
function crGroupTeams(groupOf, filter) {
  const g = {};
  crWorld().concat([crMeChar()]).forEach(c => { const k = groupOf(c); if (k && (!filter || filter(k))) (g[k] = g[k] || []).push(c); });
  return Object.entries(g).filter(([, l]) => l.length >= 2).map(([k, l]) => { l.sort((x, y) => crCharOvr(y) - crCharOvr(x)); return { key: k, a: l[0].id, b: l[1].id, rank: l.findIndex(c => c.id === 'crme') + 1, ovr: (crCharOvr(l[0]) + crCharOvr(l[1])) / 2 }; });
}
// convocação: você precisa estar entre os 2 melhores do seu país (ou estado)
function crCallUp(kind) {
  const nat = kind !== 'selEst';
  const myKey = nat ? $s.CR.me.pais : ($s.CR.me.pais === 'BRA' ? $s.CR.me.uf || 'SP' : null);
  if (!myKey) return null;
  const teams = crGroupTeams(nat ? c => c.pais : c => (c.pais === 'BRA' ? crUf(c) : null), kind === 'pan' ? k => AMERICAS.includes(k) : null);
  const mine = teams.find(t => t.key === myKey);
  const called = mine && (mine.a === 'crme' || mine.b === 'crme');
  const myRank = (() => { const l = crWorld().concat([crMeChar()]).filter(c => (nat ? c.pais : crUf(c)) === myKey && (nat || c.pais === 'BRA')).sort((x, y) => crCharOvr(y) - crCharOvr(x)); return l.findIndex(c => c.id === 'crme') + 1; })();
  return { teams, mine, called, myRank, myKey };
}
// ---------- interestadual misto: cada estado leva o top 2 do ranking estadual de cada categoria ----------
// (C, B, A e Profissional). O confronto entre dois estados tem um jogo por categoria; você joga o da sua
const crCatName = k => k >= 3 ? 'categoria Profissional' : 'categoria ' + CAT_NAMES[k];
const crCatShort = k => k >= 3 ? 'PROFISSIONAL' : TIERS[k].curto;
// nível dos adversários do seu jogo: na Profissional, o seu nível de torneio
const crCatTier = k => k >= 3 ? clamp(crMaxTier(), 3, 8) : k;
function crStateSquads() {
  const ufs = new Set(); crWorld().forEach(c => { if (c.pais === 'BRA') ufs.add(crUf(c)); }); if ($s.CR.me.pais === 'BRA') ufs.add($s.CR.me.uf || 'SP');
  const out = {};
  for (const uf of ufs) { const q = crStateSquad(uf); if (q.str) out[uf] = q; }
  return out;
}
// seleção de um estado: rankings das 4 categorias e as duplas convocadas (str 0 = sem nenhuma dupla completa)
function crStateSquad(uf) {
  {
    const cats = [0, 1, 2, 3].map(k => crCatRanking(k, uf));
    const used = new Set(), squad = {}, rank = {};
    // de cima para baixo: quem está no ranking de duas categorias joga na mais alta
    for (let k = 3; k >= 0; k--) { squad[k] = []; for (const x of cats[k]) { if (squad[k].length >= 2) break; if (!used.has(x.id)) { used.add(x.id); squad[k].push(x.id); } } }
    // categoria sem dois nomes no estado: completa com quem sobrou das categorias de baixo (ninguém desce de categoria)
    for (let k = 1; k <= 3; k++) for (let d = 1; d <= k && squad[k].length < 2; d++) for (const x of cats[k - d]) { if (squad[k].length >= 2) break; if (!used.has(x.id)) { used.add(x.id); squad[k].push(x.id); } }
    for (let k = 3; k >= 0; k--) { const p = cats[k].findIndex(x => x.id === 'crme'); if (p >= 0) { rank.cat = k; rank.pos = p + 1; break; } }
    const full = Object.values(squad).filter(x => x.length === 2);
    return { uf, squad, rank, cats, str: full.reduce((t, x) => t + crTeamOvr({ a: x[0], b: x[1] }), 0) };
  }
}
// convocação do interestadual: você está numa das duplas do seu estado (na sua categoria ou completando uma vizinha)
function crCallUpMixed() {
  const myKey = $s.CR.me.pais === 'BRA' ? $s.CR.me.uf || 'SP' : null; if (!myKey) return null;
  const all = crStateSquads(), mine = all[myKey];
  const cat = mine ? +(Object.keys(mine.squad).find(k => mine.squad[k].length === 2 && mine.squad[k].includes('crme')) ?? -1) : -1;
  return { all, mine, called: cat >= 0, cat, mate: cat >= 0 ? mine.squad[cat].find(id => id !== 'crme') : null, myKey,
    info: mine ? 'Você é o ' + (mine.rank.pos || '?') + 'º do ranking estadual da ' + crCatName(mine.rank.cat || 0) + ' (vão os 2 primeiros de cada categoria).' : 'Seu estado não tem seleção formada.' };
}
// dupla de um estado numa categoria (ou a mais próxima que ele tiver)
function crSquadPair(sq, k) { for (const d of [0, -1, 1, -2, 2, -3, 3]) { const x = sq[k + d]; if (x && x.length === 2) return x; } return null; }
// confronto entre dois estados: um jogo por categoria; quem não tem dupla na categoria perde por W.O.
// my: resultado do seu jogo (true = seu estado venceu); empate no número de jogos: vale o da categoria mais alta
function crTieSim(A, B, my) {
  const t = $s.CR.tour, res = [];
  for (let k = 3; k >= 0; k--) {
    const a = A.squad[k], b = B.squad[k], fa = a && a.length === 2, fb = b && b.length === 2;
    if (!fa && !fb) continue;
    let aw;
    if (my !== undefined && k === t.cat && (A.me ? fa : fb)) aw = A.me ? my : !my;
    else if (fa && fb) { const sa = crTeamOvr({ a: a[0], b: a[1] }), sb = crTeamOvr({ a: b[0], b: b[1] }); aw = Math.random() < 1 / (1 + Math.exp(-(sa - sb) / 3)); }
    else aw = fa;
    res.push(aw);
  }
  const na = res.filter(Boolean).length, nb = res.length - na;
  return { aWon: na > nb || (na === nb && res[0]), na, nb };
}
// seu jogo do confronto terminou: os outros jogos são simulados e o confronto decide quem avança
function crMixedAfter(mm, myWon, myScore) {
  const t = $s.CR.tour, A = t.teams[mm.a], B = t.teams[mm.b];
  const r = crTieSim(A, B, myWon), hi = Math.max(r.na, r.nb), lo = Math.min(r.na, r.nb);
  mm.w = r.aWon ? mm.a : mm.b; mm.score = hi + '–' + lo;
  const tieWon = mm.w === t.me;
  t.log.push('Seu jogo (' + crCatShort(t.cat) + '): ' + (myWon ? 'vitória' : 'derrota') + (myScore ? ' ' + myScore : '') + ' · confronto ' + (tieWon ? 'vencido' : 'perdido') + ' ' + hi + '–' + lo);
  return tieWon;
}
function crEnterMixed(opt) {
  const cu = crCallUpMixed(), sp = SPECIAL.selEst;
  if (!cu || !cu.called) { $s.CR.lastMsg = 'Você não foi convocado.'; return false; }
  // os 8 estados mais fortes (com o seu) disputam as 4 categorias; você joga a chave da sua, as outras são simuladas
  const states = Object.values(cu.all).filter(st => st.uf !== cu.myKey).sort((x, y) => y.str - x.str).slice(0, sp.draw - 1).concat([cu.mine]);
  const mk = (st, me) => { const p = me ? ['crme', cu.mate] : st.squad[cu.cat]; return { a: p[0], b: p[1], label: ufName(st.uf), pais: 'BRA', uf: st.uf, me }; };
  const teams = states.filter(st => st.uf === cu.myKey || (st.squad[cu.cat] || []).length === 2).map(st => mk(st, st.uf === cu.myKey));
  teams.sort((x, y) => crTeamOvr(y) - crTeamOvr(x));
  const me = teams.findIndex(t => t.me);
  $s.CR.tour = { states: states.map(st => ({ uf: st.uf, squad: st.squad })), tier: crCatTier(cu.cat), cat: cu.cat, mixed: true, special: 'selEst', mate: cu.mate, name: opt.name + ' · ' + crCatShort(cu.cat), teams, me, star: null, round: 0, alive: true, champion: null, done: false, beaten: [], log: [],
    rounds: [SEED8.map(([a, b]) => ({ a: a < teams.length ? a : -1, b: b < teams.length ? b : -1, w: null, score: '' }))] };
  $s.CR.tour.rounds[0].forEach(m => { if (m.w === null && (m.a < 0 || m.b < 0)) { m.w = m.a < 0 ? m.b : m.a; m.score = 'passa direto'; } });
  $s.CR.lastMsg = 'Convocado! ' + ufName(cu.myKey) + ' joga o ' + sp.nome + ' com a dupla de cada categoria; você joga a chave da ' + crCatName(cu.cat) + ' ao lado de ' + nameOf(crChar(cu.mate)) + '. Campeão da categoria soma 4 pontos para o estado, vice 2 e 3º lugar 1.';
  crTourDays(); saveCareer();
  return true;
}
// calendário dos especiais
function crSpecialOptions(wk) {
  const w = wk === undefined ? $s.CR.week : wk, out = [], br = $s.CR.me.pais === 'BRA';
  if (br && (w === 10 || w === 36)) { const band = Math.max(crMinTier('crme'), Math.min(crMaxTier(), 4)); const uf = STATE_INFO[$s.CR.me.uf] ? $s.CR.me.uf : 'SP', cs = STATE_INFO[uf].cities.concat(VENUES[uf][1].map(v => v + ' · ' + VENUES[uf][0])); out.push({ special: 'estadual', tier: band, uf, name: 'Estadual ' + uf + ' · ' + cs[(absWeek() + band) % cs.length] + ' · ' + TIERS[band].curto }); }
  const nat = w === 22 && br ? 'selEst' : w === 30 ? ($s.CR.season % 2 ? (AMERICAS.includes($s.CR.me.pais) ? 'pan' : null) : 'confed') : w === 42 ? 'mundSel' : null;
  if (nat) {
    const S2 = SPECIAL[nat];
    if (nat === 'selEst') {
      const cu = crCallUpMixed();
      if (cu && cu.called) out.push({ special: nat, tier: crCatTier(cu.cat), name: S2.nome, mate: cu.mate, info: 'Você joga a chave da ' + crCatName(cu.cat) + ' (campeão soma 4 pontos para o estado, vice 2, 3º 1).' });
      else if (cu) out.push({ special: nat, tier: S2.tier, name: S2.nome, notCalled: true, info: cu.info });
      return out;
    }
    const cu = crCallUp(nat);
    if (cu && cu.called) out.push({ special: nat, tier: S2.tier, name: S2.nome, mate: cu.mine.a === 'crme' ? cu.mine.b : cu.mine.a });
    else if (cu) out.push({ special: nat, tier: S2.tier, name: S2.nome, notCalled: true, info: cu.mine ? 'Convocados: ' + nameOf(crChar(cu.mine.a)) + ' e ' + nameOf(crChar(cu.mine.b)) + '. Você é o ' + cu.myRank + 'º ' + (nat === 'selEst' ? 'do seu estado' : 'do seu país') + ' (só os 2 melhores vão).' : 'Seu país não tem dupla para este torneio.' });
  }
  return out;
}
// ---------- torneio ----------
const SEED8 = [[0, 7], [3, 4], [2, 5], [1, 6]], SEED16 = [[0, 15], [7, 8], [4, 11], [3, 12], [2, 13], [5, 10], [6, 9], [1, 14]];
const crTeamOvr = t => t.b ? Math.round((crCharOvr(crChar(t.a)) + crCharOvr(crChar(t.b))) / 2) : crCharOvr(crChar(t.a));
const crTeamName = t => (t.label ? t.label + ' · ' : '') + shortOf(crChar(t.a)) + (t.b ? ' / ' + shortOf(crChar(t.b)) : '');
function crEnter(opt) {
  if (opt.notCalled) return false;
  if (opt.special === 'selEst') return crEnterMixed(opt);
  if (opt.special && opt.special !== 'estadual') return crEnterNation(opt);
  if (opt.singles) return crEnterSingles(opt);
  const T = TIERS[opt.tier], cost = opt.special === 'estadual' ? Math.round(T.fee * .5) : (opt.wild ? 0 : T.fee) + crTravel(T);
  if ($s.CR.money < cost) { $s.CR.lastMsg = 'Dinheiro insuficiente para a inscrição e a viagem.'; return false; }
  if (!$s.CR.partner) { // parceiro de ocasião: o melhor que aceitar dentro do nível
    const cand = crWorld().filter(c => crCharOvr(c) <= T.ovr[1] && crWillPartner(c).ok).sort((x, y) => crCharOvr(y) - crCharOvr(x));
    if (!cand.length) { $s.CR.lastMsg = 'Ninguém aceitou ser seu parceiro neste torneio.'; return false; }
    $s.CR.partner = cand[0].id; $s.CR.chem = 0; $s.CR.mood = 55;
  }
  $s.CR.money -= cost; if (opt.wild) $s.CR.wildcard = 0;
  const rnd = Math.random;
  const busy = new Set(['crme', $s.CR.partner]);
  let lo = T.ovr[0] - 2, hi = T.ovr[1] + 2, field = [];
  const need = (T.draw - 1) * 2;
  while (field.length < need && hi < 120) {
    const localOnly = opt.special === 'estadual' || !!opt.uf;
    field = crWorld().filter(c => !busy.has(c.id) && (!localOnly || crUf(c) === (opt.uf || $s.CR.me.uf || 'SP') || (lo < T.ovr[0] - 6 && c.pais === 'BRA') || (!opt.special && lo < T.ovr[0] - 9))).filter(c => { const o = crCharOvr(c); return o >= lo && o <= hi; });
    lo -= 3; hi += 3;
  }
  field.sort(() => rnd() - .5); field = field.slice(0, need).sort((x, y) => crCharOvr(y) - crCharOvr(x));
  // de vez em quando um astro de nível mais alto joga um BT10/BT50 com um parceiro bem mais fraco (no máximo a cada 6 semanas)
  let star = null;
  if ((opt.tier === 3 || opt.tier === 4) && field.length >= 4 && absWeek() - ($s.CR.lastStar || -99) >= 6 && rnd() < .22) {
    const cands = crWorld().filter(c => !busy.has(c.id) && crCharOvr(c) >= T.ovr[1] + 5 && crCharOvr(c) <= T.ovr[1] + 14);
    if (cands.length) {
      star = cands[Math.floor(rnd() * cands.length)];
      const n0 = field.length; field = field.filter(c => c.id !== star.id);
      const weak = field.pop(); // o mais fraco da chave vira o parceiro do astro
      if (field.length > n0 - 2) field.pop(); // mantém o número de duplas
      $s.CR.lastStar = absWeek();
      field.push(star, weak);
    }
  }
  const teams = [{ a: 'crme', b: $s.CR.partner, me: true }];
  const pairs = star ? field.slice(0, -2) : field;
  for (let i = 0; i + 1 < pairs.length; i += 2) teams.push({ a: pairs[i].id, b: pairs[i + 1].id });
  if (star) teams.push({ a: star.id, b: field[field.length - 1].id, star: true });
  teams.sort((x, y) => crTeamOvr(y) - crTeamOvr(x));
  const me = teams.findIndex(t => t.me);
  const seedOrder = T.draw === 16 ? SEED16 : SEED8;
  $s.CR.tour = { tier: opt.tier, special: opt.special || null, uf: opt.uf || (opt.special === 'estadual' ? $s.CR.me.uf || 'SP' : null), name: opt.name, teams, me, star: star ? star.id : null, round: 0, alive: true, champion: null, done: false, beaten: [], log: [],
    rounds: [seedOrder.map(([a, b]) => ({ a: a < teams.length ? a : -1, b: b < teams.length ? b : -1, w: null, score: '' }))] };
  $s.CR.tour.rounds[0].forEach(m => { if (m.w === null && (m.a < 0 || m.b < 0)) { m.w = m.a < 0 ? m.b : m.a; m.score = 'passa direto'; } });
  $s.CR.lastMsg = star ? 'Surpresa na chave: ' + nameOf(star) + ' (OVR ' + crCharOvr(star) + ') veio jogar este torneio. Se vencer a dupla dele, ele pode querer jogar com você.' : ''; crTourDays(); saveCareer();
  return true;
}
// o torneio começa no sábado: até lá ele fica marcado (pending) e os dias seguem livres
function crTourDays() {
  const t = $s.CR.tour; if (!t) return;
  t.day = 1; t.pending = $s.CR.day < 6;
  if (t.pending) $s.CR.lastMsg = (($s.CR.lastMsg || '') + ' Inscrição feita: o torneio começa no sábado. Até lá, use os dias para treinar ou descansar.').trim();
  else $s.CR.day = 6;
}
// rodadas do sábado: no profissional, tudo menos semifinal e final (que ficam para o domingo); no amador, tudo
const crDay1Rounds = t => crTourT(t).pro ? crNRounds() - 2 : crNRounds();
// torneio de simples: 8 jogadores do seu nível, sem parceiro
function crEnterSingles(opt) {
  const T = TIERS[opt.tier], cost = Math.round(T.fee * .5) + crTravel(T);
  if ($s.CR.money < cost) { $s.CR.lastMsg = 'Dinheiro insuficiente para a inscrição e a viagem.'; return false; }
  $s.CR.money -= cost;
  let lo = T.ovr[0], hi = T.ovr[1], field = [];
  while (field.length < 7 && hi < 120) { field = crWorld().filter(c => { const o = crCharOvr(c); return o >= lo && o <= hi; }); lo -= 3; hi += 3; }
  field = field.sort(() => Math.random() - .5).slice(0, 7);
  const teams = [{ a: 'crme', b: null, me: true }].concat(field.map(c => ({ a: c.id, b: null })));
  teams.sort((x, y) => crTeamOvr(y) - crTeamOvr(x));
  const me = teams.findIndex(t => t.me);
  $s.CR.tour = { tier: opt.tier, singles: true, name: opt.name, teams, me, star: null, round: 0, alive: true, champion: null, done: false, beaten: [], log: [],
    rounds: [SEED8.map(([a, b]) => ({ a: a < teams.length ? a : -1, b: b < teams.length ? b : -1, w: null, score: '' }))] };
  $s.CR.lastMsg = ''; crTourDays(); saveCareer();
  return true;
}
function crEnterNation(opt) {
  const kind = opt.special, sp = SPECIAL[kind], cu = crCallUp(kind);
  if (!cu || !cu.called) { $s.CR.lastMsg = 'Você não foi convocado.'; return false; }
  const lbl = k => kind === 'selEst' ? ufName(k) : countryName(k);
  let teams = cu.teams.filter(t => t.key !== cu.myKey).sort((x, y) => y.ovr - x.ovr).slice(0, sp.draw - 1).map(t => ({ a: t.a, b: t.b, label: lbl(t.key), pais: kind === 'selEst' ? 'BRA' : t.key }));
  teams.unshift({ a: 'crme', b: opt.mate, me: true, label: lbl(cu.myKey), pais: kind === 'selEst' ? 'BRA' : cu.myKey });
  teams.sort((x, y) => crTeamOvr(y) - crTeamOvr(x));
  const me = teams.findIndex(t => t.me), seedOrder = sp.draw === 16 ? SEED16 : SEED8;
  $s.CR.tour = { tier: sp.tier, special: kind, mate: opt.mate, name: opt.name, teams, me, star: null, round: 0, alive: true, champion: null, done: false, beaten: [], log: [],
    rounds: [seedOrder.map(([a, b]) => ({ a: a < teams.length ? a : -1, b: b < teams.length ? b : -1, w: null, score: '' }))] };
  $s.CR.tour.rounds[0].forEach(m => { if (m.w === null && (m.a < 0 || m.b < 0)) { m.w = m.a < 0 ? m.b : m.a; m.score = 'passa direto'; } });
  crSkipByes();
  $s.CR.lastMsg = 'Convocado! Você joga o ' + sp.nome + ' ao lado de ' + nameOf(crChar(opt.mate)) + '.'; crTourDays(); saveCareer();
  return true;
}
const crRoundNames = n => n === 4 ? ['Oitavas', 'Quartas', 'Semifinal', 'Final'] : ['Quartas', 'Semifinal', 'Final'];
const crNRounds = () => crTourT($s.CR.tour).draw === 16 ? 4 : 3;
// faixa de baixo do placar: "BT400 RAVENNA – FINAL"
function crBoardTitle() { const t = $s.CR && $s.CR.tour; if (!t) return ''; const rn = crRoundNames(crNRounds())[t.round] || ''; return (t.name + (rn ? ' – ' + rn : '')).toUpperCase(); }
const crIsFinal = () => !!($s.CR && $s.CR.tour && !$s.CR.tour.done && $s.CR.tour.round === crNRounds() - 1);
function crMyMatch() { const t = $s.CR.tour; if (!t || t.done || t.round >= crNRounds()) return null; return t.rounds[t.round].find(m => m.w === null && (m.a === t.me || m.b === t.me)) || null; }
function crScore(N, rnd) { const l = Math.floor((rnd || Math.random)() * (N - 1)); return N + '–' + l; }
function crSimOne(m, isMine) {
  const t = $s.CR.tour, A = t.teams[m.a], B = t.teams[m.b];
  if (t.mixed && A.squad && B.squad) { // formato antigo (confronto entre estados), só para torneio já em andamento
    if (isMine) { const mine = A.me ? A : B, opp = A.me ? B : A; const sa = crTeamOvr(mine) + $s.CR.chem * .4 + crMoodBonus() * .5, sb = crTeamOvr(opp); crMixedAfter(m, Math.random() < 1 / (1 + Math.exp(-(sa - sb) / 3)), crScore($s.CR.games)); return; }
    const r = crTieSim(A, B); m.w = r.aWon ? m.a : m.b; m.score = Math.max(r.na, r.nb) + '–' + Math.min(r.na, r.nb); return;
  }
  let sa = crTeamOvr(A), sb = crTeamOvr(B);
  if (!t.singles) { if (A.me) sa += $s.CR.chem * .4 + crMoodBonus() * .5; if (B.me) sb += $s.CR.chem * .4 + crMoodBonus() * .5; }
  { const st = (3 - ($s.CR.stars || 3)) * 1.5; if (A.me) sa += st; if (B.me) sb += st; } // dificuldade em estrelas vale na partida simulada também
  const pA = 1 / (1 + Math.exp(-(sa - sb) / 3));
  m.w = Math.random() < pA ? m.a : m.b;
  const N = isMine ? $s.CR.games : 6; m.score = crScore(N);
}
// confrontos diretos: duplas (ou jogadores) que você enfrenta muito viram rivais
const h2hKey = tm => [tm.a, tm.b].filter(Boolean).sort().join('+');
function crH2H(tm) { return ($s.CR.h2h || {})[h2hKey(tm)] || { w: 0, l: 0 }; }
function crRivalOf(tm) { const h = crH2H(tm); return h.w + h.l >= 3 && h.w >= 1 && h.l >= 1; }
function crAfterMyMatch(won) {
  const t = $s.CR.tour; $s.CR.energy = Math.max(0, $s.CR.energy - 10 - (t.heat ? 5 : 0)); // calor forte cansa mais
  const mm = t.rounds[t.round].find(m => m.a === t.me || m.b === t.me);
  const opp = t.teams[mm.a === t.me ? mm.b : mm.a];
  // evolução por partida: vitória ≈ 4 no Amador C, ≈ 9 no BT200 e ≈ 11 no Sand Series (sobe bem menos que o custo dos atributos);
  // derrota rende 30% disso
  const winPE = 4 + t.tier * .9;
  $s.CR.pe += Math.round((won ? winPE : winPE * .3) * crXpMul());
  // nota alta rende mais (a partir de 8; nota 10 dobra o que a vitória dá)
  const rb = t.lastRating && t.lastRating.r > 8 ? Math.round((t.lastRating.r - 8) / 2 * winPE * crXpMul() * 10) / 10 : 0;
  if (rb > 0) $s.CR.pe += rb;
  { const wasRival = crRivalOf(opp); $s.CR.h2h = $s.CR.h2h || {}; const k = h2hKey(opp), h = $s.CR.h2h[k] || { w: 0, l: 0, name: crTeamName(opp) }; won ? h.w++ : h.l++; h.name = crTeamName(opp); $s.CR.h2h[k] = h;
    if (won && wasRival) { const bon = Math.round(crTourT(t).prize[0] * .1 / 10) * 10; $s.CR.money += bon; $s.CR.pe += 2; crAddFama(2); t.log.push('Clássico vencido contra rivais: +' + money(bon) + ', +2 PE, +2 fama'); }
    else if (!wasRival && crRivalOf(opp)) t.log.push('Nasce uma rivalidade com ' + crTeamName(opp) + ' (' + h.w + '–' + h.l + ')'); }
  if (won) { [opp.a, opp.b].filter(Boolean).forEach(id => { $s.CR.beat[id] = ($s.CR.beat[id] || 0) + 1; t.beaten.push(id); }); }
  else t.alive = false;
  t.log.push((won ? 'Vitória' : 'Derrota') + ' ' + mm.score + ' contra ' + crTeamName(opp) + (t.lastRating ? ' · nota ' + t.lastRating.r.toFixed(1).replace('.', ',') + (rb > 0 ? ' (+' + String(rb).replace('.', ',') + ' PE pela nota)' : '') + (t.lastRating.g > .005 ? ' · potencial +' + t.lastRating.g.toFixed(2).replace('.', ',') : '') : ''));
  t.lastRating = null;
  crAdvance();
  if (!t.alive) while (t.champion === null) crAdvance();
  else crSkipByes();
  if (t.champion !== null && !t.done) crFinishTour();
  // fim do sábado num torneio profissional: semifinal e final ficam para o domingo (descanso da noite: +12 de energia)
  else if (t.day === 1 && t.round >= crDay1Rounds(t)) { t.day = 2; t.night = true; $s.CR.day = 7; $s.CR.energy = Math.min(100, $s.CR.energy + 12); crWlog(6, 'Torneio'); }
  saveCareer();
}
function crAdvance() {
  const t = $s.CR.tour, cur = t.rounds[t.round];
  cur.forEach(m => { if (m.w === null && (m.a < 0 || m.b < 0)) { m.w = m.a < 0 ? m.b : m.a; m.score = m.w < 0 ? '' : 'passa direto'; } }); // vaga vazia: passa direto
  cur.forEach(m => { if (m.w === null) crSimOne(m, false); });
  if (cur.length === 1) { t.champion = cur[0].w; t.round = crNRounds(); return; }
  const nx = []; for (let k = 0; k < cur.length; k += 2) nx.push({ a: cur[k].w, b: cur[k + 1].w, w: null, score: '' });
  t.rounds.push(nx); t.round++;
}
// chave com menos duplas que vagas: rodadas só de "passa direto" andam sozinhas até ter jogo seu (ou até o fim)
function crSkipByes() {
  const t = $s.CR.tour; if (!t || t.done || !t.rounds) return;
  let g = 0;
  const bye = () => t.rounds[t.round] && t.rounds[t.round].forEach(m => { if (m.w === null && (m.a < 0 || m.b < 0)) { m.w = m.a < 0 ? m.b : m.a; m.score = m.w < 0 ? '' : 'passa direto'; } });
  bye();
  while (!crMyMatch() && t.champion === null && t.round < crNRounds() && t.alive && g++ < 6) { crAdvance(); bye(); }
  if (t.champion !== null && !t.done) crFinishTour();
  if (g) saveCareer();
}
function crPlaySim() {
  const mm = crMyMatch(); if (!mm) return;
  crSimOne(mm, true);
  // simulada: nota neutra (rende pouco potencial; jogar bem de verdade rende mais)
  const won = mm.w === $s.CR.tour.me, r = won ? 6.2 : 5.6; $s.CR.tour.lastRating = { r, g: crPotGain(r, $s.CR.tour.tier) }; crRate(r);
  crAfterMyMatch(won);
}
// interestadual por categorias: cada categoria dá 4 pontos ao campeão, 2 ao vice e 1 ao 3º; a soma decide o estado campeão
const SEL_PTS = [4, 2, 1];
function crPairWin(a, b) { const sa = crTeamOvr({ a: a[0], b: a[1] }), sb = crTeamOvr({ a: b[0], b: b[1] }); return Math.random() < 1 / (1 + Math.exp(-(sa - sb) / 3)); }
// chave simulada de uma categoria: [campeão, vice, 3º] (o 3º sai do jogo entre os perdedores das semifinais)
function crSimCatBracket(list) {
  let rd = list.slice().sort((x, y) => crTeamOvr({ a: y.p[0], b: y.p[1] }) - crTeamOvr({ a: x.p[0], b: x.p[1] }));
  const sz = rd.length <= 2 ? 2 : rd.length <= 4 ? 4 : 8, seeds = sz === 8 ? SEED8 : sz === 4 ? [[0, 3], [1, 2]] : [[0, 1]];
  let cur = seeds.map(([i, j]) => [rd[i] || null, rd[j] || null]), semiL = [];
  while (true) {
    const win = cur.map(([x, y]) => { if (!x || !y) return x || y; const w = crPairWin(x.p, y.p) ? x : y; if (cur.length === 2) semiL.push(w === x ? y : x); return w; });
    if (win.length === 1) { const champ = win[0], vice = cur[0][0] === champ ? cur[0][1] : cur[0][0]; const third = semiL.length === 2 ? (crPairWin(semiL[0].p, semiL[1].p) ? semiL[0] : semiL[1]) : semiL[0] || null; return [champ, vice, third].map(x => x && x.uf); }
    cur = []; for (let i = 0; i < win.length; i += 2) cur.push([win[i], win[i + 1] || null]);
  }
}
function crSelStandings(t, place) {
  const pts = {}, cats = {};
  t.states.forEach(st => { pts[st.uf] = 0; cats[st.uf] = [null, null, null, null]; });
  const give = (k, podium) => podium.forEach((uf, i) => { if (uf && pts[uf] !== undefined) { pts[uf] += SEL_PTS[i]; cats[uf][k] = i + 1; } });
  for (let k = 0; k < 4; k++) {
    if (k === t.cat) {
      // a sua chave: campeão, vice e 3º (disputa entre os perdedores das semifinais, simulada)
      const fin = t.rounds[t.rounds.length - 1][0], ufOf = i => i >= 0 ? t.teams[i].uf : null;
      const semis = t.rounds[t.rounds.length - 2] || [], sl = semis.map(m => m.w === m.a ? m.b : m.a).filter(i => i >= 0);
      const tm = i => t.teams[i], pr = i => [tm(i).a, tm(i).b], third = sl.length === 2 ? (crPairWin(pr(sl[0]), pr(sl[1])) ? sl[0] : sl[1]) : sl.length ? sl[0] : -1;
      t.third = third;
      give(k, [ufOf(fin.w), ufOf(fin.w === fin.a ? fin.b : fin.a), third >= 0 ? ufOf(third) : null]);
    } else give(k, crSimCatBracket(t.states.filter(st => (st.squad[k] || []).length === 2).map(st => ({ uf: st.uf, p: st.squad[k] }))));
  }
  const tit = uf => cats[uf].filter(x => x === 1).length;
  return Object.keys(pts).map(uf => ({ uf, pts: pts[uf], cats: cats[uf] })).sort((x, y) => y.pts - x.pts || tit(y.uf) - tit(x.uf) || (y.cats[3] ? 4 - y.cats[3] : 0) - (x.cats[3] ? 4 - x.cats[3] : 0));
}
function crFinishTour() {
  const t = $s.CR.tour, T = crTourT(t), nR = crNRounds(), nation = (t.special && t.special !== 'estadual') || t.singles;
  // fase em que caiu: 0 campeão, 1 vice, 2 semi, 3 quartas, 4 oitavas
  let place = 0;
  if (t.champion !== t.me) { const lostAt = t.rounds.findIndex(rd => rd.some(m => (m.a === t.me || m.b === t.me) && m.w !== null && m.w !== t.me)); place = nR - lostAt; }
  // títulos e finais rendem bem mais evolução (bônus cresce com o nível do torneio)
  const xpBonus = place === 0 ? 4 + t.tier * 1.6 : place === 1 ? 1.5 + t.tier * .6 : 0;
  const prize = T.prize[place] || 0, pts = T.pts[place] || 0, xp = Math.round(((T.xp[place] || 0) + xpBonus) * crXpMul());
  $s.CR.money += prize; $s.CR.pe += xp;
  $s.CR.results.push({ w: absWeek(), pts });
  if (!nation) crCatAdd('crme', t.tier, pts, absWeek()); // conta para as categorias das seleções estaduais
  if (t.mixed && t.states) {
    t.stand = crSelStandings(t, place);
    const me = t.stand.findIndex(x => x.uf === t.teams[t.me].uf), top = t.stand[0];
    t.log.push(ufName(top.uf) + ' é o estado campeão com ' + top.pts + ' pontos' + (me > 0 ? '; ' + ufName(t.teams[t.me].uf) + ' ficou em ' + (me + 1) + 'º com ' + t.stand[me].pts : '') + '.');
    if (me === 0) { crAddFama(3); $s.CR.honors = $s.CR.honors || []; $s.CR.honors.unshift({ s: $s.CR.season, name: SPECIAL.selEst.nome + ' (por estados)', place: 'Campeão' }); }
  }
  if (t.special || t.singles) { // estaduais, seleções e simples: honrarias próprias
    if (T.fama) crAddFama(T.fama[place] || 0); else if (place === 0) crAddFama(2);
    $s.CR.honors = $s.CR.honors || []; if (place <= 1) $s.CR.honors.unshift({ s: $s.CR.season, name: T.nome || t.name, place: place === 0 ? 'Campeão' : 'Vice' });
  }
  if (place === 0 && !t.special && !t.singles) { $s.CR.titles[t.tier] = ($s.CR.titles[t.tier] || 0) + 1; $s.CR.maxTier = Math.max($s.CR.maxTier, Math.min(8, t.tier + 1));
    const bon = $s.CR.sponsors.reduce((x, sp) => x + sp.bonus, 0); if (bon) { $s.CR.money += bon; t.sponsorBonus = bon; }
    crAddFama(1 + t.tier * 1.6 + (crInv('marca') >= 3 ? 2 : 0)); if (Math.random() < .35) crMaybeSponsor(true); }
  else if (place === 1 && !t.special && !t.singles) crAddFama(.3 + t.tier * .5);
  if (!nation) $s.CR.chem = Math.min(5, $s.CR.chem + 1);
  if (!nation) { const mv = place === 0 ? 15 : place === 1 ? 7 : place === 2 ? 2 : -8 - (crTeamOvr(t.teams[t.me]) >= T.ovr[1] ? 4 : 0); const mm = crMood(mv); if (mm) t.moodMsg = mm; }
  if (place === 0 && crLife('social')) crAddFama(1);
  // quem você venceu pode querer jogar com você
  const offers = [];
  const myPartnerO = $s.CR.partner ? crCharOvr(crChar($s.CR.partner)) : 0;
  if (!nation) [...new Set(t.beaten)].forEach(id => { const c = crChar(id); if (!c || $s.CR.offers.includes(id) || id === $s.CR.partner) return; const o = crCharOvr(c), star = id === t.star; if (o > myPartnerO && (star ? Math.random() < .5 : o <= crMeOvr() + 14 && Math.random() < .4)) offers.push(id); });
  $s.CR.offers = $s.CR.offers.concat(offers).slice(-4);
  const injMsg = crInjuryRoll(1); if (injMsg) t.moodMsg = (t.moodMsg ? t.moodMsg + ' ' : '') + injMsg;
  const placeName = place === 0 ? 'Campeão' : place === 1 ? 'Vice-campeão' : place === 2 ? 'Semifinal' : place === 3 ? 'Quartas' : 'Oitavas';
  t.summary = { place, placeName, prize, pts, xp, offers };
  $s.CR.history.unshift({ s: $s.CR.season, w: $s.CR.week, name: t.name, tier: T.curto, place: placeName, prize, pts, partner: $s.CR.partner ? nameOf(crChar($s.CR.partner)) : '' });
  $s.CR.history = $s.CR.history.slice(0, 60);
  t.done = true;
  crWlog(6, 'Torneio'); if ($s.CR.day === 7) crWlog(7, 'Torneio');
}
// multiplicador de evolução: os bônus (técnico, mentor, idade, CT, embalo) somam com retorno decrescente
// (+90% sozinho vale ~+62%; tudo junto não passa muito de ×2,2), para os ganhos não crescerem tanto quanto os custos
const crXpMul = () => { const x = crStaffList().reduce((t, s) => t + (s.xp || 0), 0) + ($s.CR.mentor > 0 ? .5 : 0) + ($s.CR.age <= 20 ? .3 : 0) + crInvXp() + ($s.CR.boostW > 0 ? .4 : 0); return 1 + x / (1 + x * .5); };
// ---------- negócios: investimentos permanentes para o fim da carreira ----------
// cada linha tem níveis; cada nível exige o anterior e algo da carreira (fama, títulos, ranking)
const crTitlesAt = t => Object.entries($s.CR.titles || {}).reduce((n, [k, v]) => n + (+k >= t ? v : 0), 0);
const INVEST = {
  marca: { nome: 'Marca pessoal', ic: '🏷️', niveis: [
    { nome: 'Marca própria', preco: 25000, desc: 'Royalties toda semana conforme a sua fama; a fama cai pela metade da velocidade.', req: () => $s.CR.fama >= 30 ? '' : 'Precisa de 30 de fama' },
    { nome: 'Raquete assinatura', preco: 400000, desc: 'Sua raquete sob medida: melhor que a Zênite e com +2 nos seus três melhores atributos. Royalties em dobro.', req: () => crTitlesAt(5) >= 1 ? '' : 'Precisa de um título de BT100 ou maior' },
    { nome: 'Linha completa de produtos', preco: 650000, desc: 'Roupas, bolas e acessórios com seu nome: royalties ×3,5 e +2 de fama a cada título.', req: () => $s.CR.fama >= 60 && crTitlesAt(7) >= 1 ? '' : 'Precisa de 60 de fama e um título de BT400 ou maior' },
  ] },
  quadra: { nome: 'Quadra de beach', ic: '🏖️', niveis: [
    { nome: 'Quadra própria', preco: 15000, desc: 'Treinar fica de graça e rende +3 pontos de evolução; aulas rendem 40% mais.', req: () => '' },
    { nome: 'Arena com iluminação', preco: 45000, desc: 'Aluguel da arena toda semana; treino gasta menos energia (10 em vez de 15).', req: () => crTitlesAt(4) >= 1 ? '' : 'Precisa de um título de BT50 ou maior' },
  ] },
  ct: { nome: 'Centro de treinamento (CT)', ic: '🏟️', niveis: [
    { nome: 'CT', preco: 80000, desc: '+35% de pontos de evolução e +6 de energia por semana.', req: () => (($s.CR.inv || {}).quadra || 0) >= 1 ? '' : 'Precisa da quadra própria' },
    { nome: 'CT de alto rendimento', preco: 200000, desc: 'Mais +35% de evolução e +2 de potencial (o limite dos seus atributos).', req: () => crTitlesAt(6) >= 2 ? '' : 'Precisa de dois títulos de BT200 ou maiores' },
    { nome: 'Academia de base', preco: 420000, desc: 'Mais +20% de evolução, +1 de potencial e mensalidades dos alunos toda semana.', req: () => crTitlesAt(8) >= 1 ? '' : 'Precisa de um título do Mundial' },
  ] },
};
const crInv = k => (($s.CR && $s.CR.inv) || {})[k] || 0;
function crInvXp() { if (!$s.CR) return 0; const c = crInv('ct'); return (c >= 1 ? .35 : 0) + (c >= 2 ? .35 : 0) + (c >= 3 ? .2 : 0); }
function crInvBuy(k) {
  const tr = INVEST[k], lv = crInv(k), n = tr && tr.niveis[lv]; if (!n) return;
  const why = n.req(); if (why) { $s.CR.lastMsg = why + '.'; return; }
  if ($s.CR.money < n.preco) { $s.CR.lastMsg = 'Dinheiro insuficiente para ' + n.nome + '.'; return; }
  $s.CR.money -= n.preco; $s.CR.inv = Object.assign({}, $s.CR.inv, { [k]: lv + 1 });
  if (k === 'ct' && lv + 1 === 2) $s.CR.pot = Math.min(99, $s.CR.pot + 2);
  if (k === 'ct' && lv + 1 === 3) $s.CR.pot = Math.min(99, $s.CR.pot + 1);
  if (k === 'marca' && lv + 1 === 2) { crSignature(); if (!$s.CR.rackets.includes('assinatura')) $s.CR.rackets.push('assinatura'); $s.CR.racket = 'assinatura'; $s.CR.me.look.racket = 'assinatura'; }
  $s.CR.lastMsg = 'Investimento feito: ' + n.nome + '.'; crSyncChars(); saveCareer();
}
// raquete assinatura: Zênite + 2 nos três melhores atributos do jogador
function crSignature() {
  if (crInv('marca') < 2) return;
  const b = Object.assign({}, RACKET_STATS.zenite.b);
  Object.entries($s.CR.me.a).sort((x, y) => y[1] - x[1]).slice(0, 3).forEach(([k]) => { b[k] = (b[k] || 0) + 2; });
  RACKET_STATS.assinatura = { nome: 'Assinatura ' + $s.CR.me.name, preco: 0, desc: 'Sua raquete sob medida, da sua marca.', b };
}
// renda semanal dos investimentos
function crInvWeek() {
  let g = 0;
  const m = crInv('marca'); if (m) g += Math.round(($s.CR.fama || 0) * 12 * (m >= 3 ? 3.5 : m >= 2 ? 2 : 1));
  if (crInv('quadra') >= 2) g += 350 * (crMaxTier() + 1);
  if (crInv('ct') >= 3) g += 2500;
  if (g) $s.CR.money += g;
  return g;
}
// ---------- semana ----------
function crNextWeek(note) {
  $s.CR.tour = null; $s.CR.day = 1; $s.CR.wlog = {};
  $s.CR.energy = Math.min(100, $s.CR.energy + 10 + crStaffList().reduce((t, x) => t + (x.energy || 0), 0) + (crInv('ct') >= 1 ? 6 : 0) + (crLife('nutri') ? 5 : 0) + (crLife('casa') ? 3 : 0));
  let msg = note || '';
  if ($s.CR.partner) $s.CR.mood += (55 - $s.CR.mood) * (crLife('casa') ? .04 : .08);
  if (crLife('imprensa')) crAddFama(1);
  if ($s.CR.boostW > 0) $s.CR.boostW--;
  crFormWeek();
  if ($s.CR.injury) { $s.CR.injury.weeks -= 1 + (($s.CR.restDays || 0) >= 3 ? 1 : 0); if ($s.CR.injury.weeks <= 0) { msg += (msg ? ' ' : '') + 'Recuperado da lesão: liberado para competir.'; $s.CR.injury = null; } }
  $s.CR.restDays = 0;
  crSimWorld();
  $s.CR.week++;
  const spm = crSponsorWeek(); if (spm) msg += (msg ? ' ' : '') + spm;
  const ivg = crInvWeek(); if (ivg) msg += (msg ? ' ' : '') + 'Negócios renderam ' + money(ivg) + '.';
  crFamaWeek(); if ($s.CR.mentor > 0) $s.CR.mentor--; if ($s.CR.wildcard > 0) $s.CR.wildcard--;
  crMaybeSponsor();
  if (Math.random() < .3) { const ev = crRollEvent(); if (ev) msg += (msg ? ' ' : '') + ev; }
  if ($s.CR.week > SEASON_WEEKS) {
    const pos = crRank();
    msg = 'Fim da temporada ' + $s.CR.season + ': você terminou em ' + pos + 'º no ranking. ' + msg;
    if ($s.CR.goal) {
      const g = $s.CR.goal;
      if (crGoalDone(g)) { $s.CR.money += g.money; $s.CR.pe += g.pe; crAddFama(g.fama); msg += ' Meta cumprida (' + g.txt + '): +' + money(g.money) + ', +' + g.pe + ' pontos de evolução.'; }
      else msg += ' Meta não cumprida: ' + g.txt + '.';
    }
    $s.CR.goal = null; $s.CR.lifeS = {};
    $s.CR.season++; $s.CR.week = 1; $s.CR.age++; $s.CR.staff = {};
    // o mundo envelhece: jovens melhoram, veteranos caem
    // o mundo envelhece: jovens melhoram (mais devagar perto do topo), veteranos caem e quem passa dos 34 se aposenta
    const rnd = mulberry($s.CR.seed + $s.CR.season * 131);
    $s.CR.pool.forEach(c => {
      c.age = (c.age || 24) + 1;
      if (c.age > 34) { // aposentou: entra um novato no lugar
        const bank = NAME_BANK[c.pais] || NAME_BANK.BRA; let sur = bank.s[Math.floor(rnd() * bank.s.length)]; if (c.fem && c.pais === 'RUS') sur += 'a';
        c.name = bank[c.fem ? 'f' : 'm'][Math.floor(rnd() * bank[c.fem ? 'f' : 'm'].length)] + ' ' + sur; c.age = 18;
        c.a = makeAttrs(Math.round(35 + rnd() * 15), ['atacante', 'defensor', 'tatico', 'completo'][Math.floor(rnd() * 4)], rnd); if ($s.CR.npcR) delete $s.CR.npcR[c.id]; return;
      }
      const o = overall(c.a), d = (c.age < 23 ? 1.6 : c.age < 28 ? .6 : c.age > 31 ? -1.3 : 0) * (o > 84 && c.age < 31 ? .3 : 1);
      const ch = Math.round(d + gaussR(rnd) * 1.1); for (const [k] of ATTRS) c.a[k] = clamp(c.a[k] + ch, 30, 93);
    });
    crDriftSeason(rnd);
    if ($s.CR.age > 31) for (const [k] of [['vel']]) $s.CR.me.a[k] = Math.max(40, $s.CR.me.a[k] - 1);
  }
  $s.CR.ovrLog.push({ s: $s.CR.season, w: $s.CR.week, o: overall($s.CR.me.a) }); $s.CR.ovrLog = $s.CR.ovrLog.slice(-80);
  $s.CR.lastMsg = msg; crSyncChars(); saveCareer();
}
// lesões: competir ou treinar muito cansado pode machucar; o fisioterapeuta encurta a recuperação
const INJ = ['Distensão na panturrilha', 'Tendinite no ombro', 'Entorse no tornozelo', 'Dor lombar', 'Lesão no punho'];
function crInjuryRoll(mult) {
  if ($s.CR.injury) return '';
  const e = $s.CR.energy, ch = e < 30 ? (30 - e) / 30 * .32 * (mult || 1) : 0;
  if (Math.random() >= ch) return '';
  const w = Math.max(1, Math.floor(1 + Math.random() * 4) - ($s.CR.staff.fisio ? 1 : 0));
  $s.CR.injury = { nome: INJ[Math.floor(Math.random() * INJ.length)], weeks: w };
  return 'Lesão: ' + $s.CR.injury.nome + ' (' + w + (w > 1 ? ' semanas' : ' semana') + ' parado). Jogar cansado cobrou o preço.';
}
// cada dia tem uma atividade: treinar, treinar na quadra (desafio), dar aulas ou descansar
const fmt1 = v => (Math.round(v * 10) / 10).toString().replace('.', ',');
function crWlog(d, txt) { $s.CR.wlog = $s.CR.wlog || {}; $s.CR.wlog[d] = txt; }
// recompensa do treino na quadra com desafio (conta como o dia); cumprir a meta também dá um pouco de potencial
function crDrillReward(ok, pass, rew) {
  rew = rew || 1; // nível do desafio: mais difícil, mais recompensa
  const g = (ok * .3 + (pass ? 1.5 : 0)) * crXpMul() * rew;
  $s.CR.pe += g; $s.CR.energy = Math.max(0, $s.CR.energy - 5);
  const pg = pass ? Math.min(.03 * rew * clamp(1 - ($s.CR.potCur - 65) / 40, .3, 1) * clamp(1 - ($s.CR.potCur - overall($s.CR.me.a) - 4) / 6, .03, 1), $s.CR.pot - $s.CR.potCur) : 0; if (pg > 0) $s.CR.potCur += pg;
  crWlog($s.CR.day, 'Quadra');
  crNextDay('Treino na quadra: ' + ok + ' acertos' + (pass ? ' (meta cumprida, +' + fmt1(pg) + ' de potencial)' : '') + ', +' + fmt1(g) + ' pontos de evolução.');
  return fmt1(g);
}
function crTrain() {
  if ($s.CR.injury) { $s.CR.lastMsg = 'Lesionado: nada de treino pesado. Descanse ou faça fisioterapia.'; return; }
  const cost = crInv('quadra') ? 0 : 20 * (crMaxTier() + 1);
  if ($s.CR.money < cost) { $s.CR.lastMsg = 'Treino custa $' + cost + '.'; return; }
  if ($s.CR.energy < 10) { $s.CR.lastMsg = 'Energia baixa demais para treinar: descanse.'; return; }
  const inj = crInjuryRoll(.2);
  $s.CR.money -= cost; $s.CR.energy -= crInv('quadra') >= 2 ? 4 : 6; const g = (.9 + (crInv('quadra') ? .6 : 0)) * crXpMul(); $s.CR.pe += g;
  crWlog($s.CR.day, 'Treino');
  crNextDay('Dia de treino: +' + fmt1(g) + ' pontos de evolução.' + (inj ? ' ' + inj : ''));
}
function crCoach() { const g = Math.round(crLessonIncome() * .3 / 10) * 10; $s.CR.money += g; $s.CR.energy = Math.max(0, $s.CR.energy - 2); crWlog($s.CR.day, 'Aulas'); crNextDay('Dia de aulas: +' + money(g) + '.'); }
function crRest() { $s.CR.restDays = ($s.CR.restDays || 0) + 1; const g = 14 + (crLife('crio') ? 6 : 0); $s.CR.energy = Math.min(100, $s.CR.energy + g); crWlog($s.CR.day, 'Descanso'); crNextDay('Dia de descanso: +' + g + ' de energia.'); }
// descansa até o torneio começar (sábado) ou, sem torneio, até o fim da semana
function crRestUntil() {
  const wk = $s.CR.week; let n = 0;
  while ($s.CR.week === wk && !($s.CR.tour && !$s.CR.tour.pending) && !$s.CR.event && n < 7) { crRest(); n++; }
  if (n > 1) $s.CR.lastMsg = n + ' dias de descanso. ' + ($s.CR.lastMsg || '');
  saveCareer();
}
// semana automática: treina enquanto a energia permite e descansa o necessário para chegar inteiro ao torneio
// (sem torneio: treina com energia acima de 40 e vai até o fim da semana)
function crAutoDays() {
  const wk = $s.CR.week, pe0 = $s.CR.pe; let n = 0, tr = 0, rs = 0;
  while ($s.CR.week === wk && !($s.CR.tour && !$s.CR.tour.pending) && !$s.CR.event && n < 7) {
    const cost = crInv('quadra') ? 0 : 20 * (crMaxTier() + 1), pend = $s.CR.tour && $s.CR.tour.pending;
    const after = Math.max(0, 5 - $s.CR.day); // dias livres depois de hoje antes do sábado
    const can = !$s.CR.injury && $s.CR.money >= cost && $s.CR.energy >= 10;
    const ok = pend ? $s.CR.energy - 6 + 14 * after >= 88 : $s.CR.energy >= 40;
    if (can && ok) { crTrain(); tr++; } else { crRest(); rs++; }
    n++;
  }
  $s.CR.lastMsg = 'Dias automáticos: ' + tr + ' treino(s) e ' + rs + ' descanso(s) · +' + fmt1($s.CR.pe - pe0) + ' pontos de evolução. ' + ($s.CR.lastMsg || '');
  saveCareer();
}
// simula as suas partidas que faltam no torneio (inclusive a virada para o domingo)
function crSimTour() {
  const t = $s.CR.tour; let g = 0;
  while (t && !t.done && g++ < 12) { if (t.night) t.night = false; if (!crMyMatch()) break; crPlaySim(); }
  saveCareer();
}
// passa o dia; no sábado o torneio inscrito começa; depois do domingo, vira a semana
function crNextDay(note) {
  if ($s.CR.day >= 7) return crNextWeek(note);
  $s.CR.day++;
  let msg = note || '';
  if ($s.CR.day >= 6 && $s.CR.tour && $s.CR.tour.pending) { $s.CR.tour.pending = false; $s.CR.day = 6; msg += (msg ? ' ' : '') + 'Sábado: dia de torneio!'; }
  $s.CR.lastMsg = msg; crSyncChars(); saveCareer();
}
// 60→70 é rápido, 70→80 bem mais lento, 80→90 o mais difícil
// a reta final é a mais cara: cada ponto acima de 90 custa bem mais
// custo de +1 num atributo: começa barato (amador) e fica bem caro perto do topo; um pouco mais lento que antes
const crUpCostBase = v => v < 45 ? 1 : v < 55 ? 2 : v < 62 ? 3 : v < 68 ? 4 : v < 72 ? 5 : v < 76 ? 7 : v < 80 ? 10 : v < 84 ? 14 : v < 88 ? 20 : v < 90 ? 28 : v < 92 ? 40 : v < 94 ? 56 : v < 96 ? 78 : 100;
const crUpCost = (v, k) => Math.max(1, Math.round(crUpCostBase(v) * (crStaffList().some(x => x.cheap && x.cheap.includes(k)) ? .75 : 1)));
// potencial atual: teto do overall (não adianta ter pontos de evolução acima dele). Só sobe jogando bem:
// cada partida dá potencial conforme a nota (0–10) e o nível do torneio, até o potencial máximo do atleta
const crCap = () => Math.min(99, Math.floor($s.CR.potCur ?? $s.CR.pot));
function crPotGain(rating, tier) {
  if (rating < 5.5) return 0;
  const room = clamp(($s.CR.pot - $s.CR.potCur) / 8, .15, 1);
  // potencial muito acima do seu overall quase não sobe mais (os pontos de evolução precisam alcançar)
  const ahead = clamp(1 - ($s.CR.potCur - overall($s.CR.me.a) - 4) / 6, .03, 1);
  // quanto mais alto o potencial, mais devagar ele sobe (≈7 por temporada no começo, ≈4 perto dos 85)
  const hiK = clamp(1 - ($s.CR.potCur - 65) / 40, .3, 1);
  const g = Math.min($s.CR.pot - $s.CR.potCur, (rating - 5.5) * .03 * (.8 + (tier || 0) * .05) * room * ahead * hiK);
  if (g <= 0) return 0;
  $s.CR.potCur += g;
  return g;
}
function crRate(r) { $s.CR.ratings = ($s.CR.ratings || []).concat([Math.round(r * 10) / 10]).slice(-20); }
const crAvgRating = () => { const l = ($s.CR.ratings || []).slice(-10); return l.length ? l.reduce((t, v) => t + v, 0) / l.length : null; };
// o potencial limita o OVERALL: cada atributo pode ir até 99, desde que o overall não passe do potencial atual
const crCanUp = k => { const a = $s.CR.me.a; if (a[k] >= 99) return false; return overall(Object.assign({}, a, { [k]: a[k] + 1 })) <= crCap(); };
function crUpgrade(k) { const v = $s.CR.me.a[k], c = crUpCost(v, k); if ($s.CR.pe < c || !crCanUp(k)) return; $s.CR.pe -= c; $s.CR.me.a[k]++; crSyncChars(); saveCareer(); }
// ---------- partida jogada ----------
function crPlayMatch() {
  const mm = crMyMatch(); if (!mm) return;
  const t = $s.CR.tour, opp = t.teams[mm.a === t.me ? mm.b : mm.a];
  $s.CR.prev = { pick: Object.assign({}, S.settings.pick), mode: S.settings.mode, diff: S.settings.diff, racket: S.settings.racket, games: S.settings.games, format: S.settings.format, side: S.settings.side };
  S.settings.side = $s.CR.side || 'direita'; // seu lado na dupla (escolhido na carreira; padrão: direita)
  const proFinal = crIsFinal() && crTourT(t).pro; // finais de torneios profissionais: 2 sets (de 4 ou 6 games, conforme a sua configuração) + super tie-break
  crSyncChars();
  S.settings.mode = t.singles ? 'simples' : 'dupla'; S.settings.diff = crTourT(t).diff; S.settings.racket = $s.CR.racket; S.settings.games = $s.CR.games; S.settings.format = proFinal ? 'pro' : 'set';
  S.settings.pick = { me: 'crme', mate: t.teams[t.me].b || t.mate || $s.CR.partner || opp.a, o1: opp.a, o2: opp.b || opp.a };
  S.careerStars = $s.CR.stars || 3; // dificuldade escolhida (3 = padrão: acompanha o nível do torneio)
  S.careerActive = true; saveCareer(); flushSaves();
  $('career').hidden = true; ac(); newMatch();
}
function careerMatchEnded(won, rating) {
  S.careerActive = false;
  const mm = crMyMatch();
  if (mm && rating !== undefined && $s.CR.tour) { const g = crPotGain(rating, $s.CR.tour.tier); crRate(rating); $s.CR.tour.lastRating = { r: rating, g }; }
  const sTxt = scoreText(), g = S.score.games, hasSets = (S.score.hist || []).length > 0;
  if ($s.CR.prev) { Object.assign(S.settings, { pick: $s.CR.prev.pick, mode: $s.CR.prev.mode, diff: $s.CR.prev.diff, racket: $s.CR.prev.racket, games: $s.CR.prev.games, format: $s.CR.prev.format || 'set', side: $s.CR.prev.side || S.settings.side }); $s.CR.prev = null; }
  if (!mm) return;
  mm.w = won ? $s.CR.tour.me : (mm.a === $s.CR.tour.me ? mm.b : mm.a);
  mm.score = hasSets ? sTxt : g[0] + g[1] ? Math.max(g[0], g[1]) + '–' + Math.min(g[0], g[1]) : 'W.O.';
  if ($s.CR.tour.mixed && !$s.CR.tour.states) won = crMixedAfter(mm, won, mm.score);
  crAfterMyMatch(won);
}
// ---------- saves antigos ----------
function crMigrate() {
  if (!$s.CR) return;
  $s.CR.fama = $s.CR.fama || 0; $s.CR.sponsors = $s.CR.sponsors || []; $s.CR.spOffers = $s.CR.spOffers || []; $s.CR.mentor = $s.CR.mentor || 0; $s.CR.discount = $s.CR.discount || 0; $s.CR.wildcard = $s.CR.wildcard || 0;
  if ($s.CR.staff.tecnico) { delete $s.CR.staff.tecnico; $s.CR.staff.tec2 = true; }
  if ($s.CR.staff.preparador) { delete $s.CR.staff.preparador; $s.CR.staff.prep = true; }
  $s.CR.inv = $s.CR.inv || {};
  if (($s.CR.inv.marca || 0) >= 2 && !$s.CR.rackets.includes('assinatura')) $s.CR.rackets.push('assinatura'); // a raquete da sua marca é sempre sua
  if (!RACKET_STATS[$s.CR.racket] && $s.CR.racket !== 'assinatura') $s.CR.racket = $s.CR.rackets[0] || 'basica';
  if ($s.CR.mood === undefined) $s.CR.mood = 60;
  if ($s.CR.me.pais === 'BRA' && !$s.CR.me.uf) $s.CR.me.uf = 'SP';
  $s.CR.life = $s.CR.life || {}; $s.CR.lifeS = $s.CR.lifeS || {}; $s.CR.boostW = $s.CR.boostW || 0;
  if ($s.CR.goal === undefined) $s.CR.goal = null;
  // mundo maior: completa os saves antigos até POOL_N por gênero
  const nM = $s.CR.pool.filter(c => !c.fem).length;
  let extra = null;
  if (nM < POOL_N) { extra = genPool($s.CR.seed, nM, POOL_N, new Set($s.CR.pool.map(c => c.name))); $s.CR.pool = $s.CR.pool.concat(extra); }
  if (($s.CR.v || 1) < 2) {
    // v2: ano de 52 semanas com dias, pontos no padrão ITF e ranking dos 10 melhores resultados
    const w2 = w => Math.min(SEASON_WEEKS, Math.max(1, w * 2 - 1));
    $s.CR.week = w2($s.CR.week);
    const placeIdx = { 'Campeão': 0, 'Vice-campeão': 1, 'Semifinal': 2, 'Quartas': 3, 'Oitavas': 4 };
    ($s.CR.history || []).forEach(h => { h.w = w2(h.w); });
    $s.CR.results = ($s.CR.history || []).map(h => {
      const ti = TIERS.findIndex(T => T.curto === h.tier), pi = placeIdx[h.place];
      let pts = ti >= 0 && pi !== undefined && h.pts > 0 ? TIERS[ti].pts[pi] || 0 : 0;
      if (/^Estadual/.test(h.name || '')) pts = Math.round(pts * .5);
      return { w: (h.s - 1) * SEASON_WEEKS + h.w, pts };
    }).filter(r => r.pts > 0);
    delete $s.CR.npc; $s.CR.npcR = {}; crSimYear(41);
    const ovr = overall($s.CR.me.a), mx = Math.max(...Object.values($s.CR.me.a));
    $s.CR.potCur = Math.max(Math.min($s.CR.pot, ovr + 3), mx);
    $s.CR.wlog = {}; $s.CR.day = 1;
    const t = $s.CR.tour;
    if (t && !t.done) { t.pending = false; t.day = t.round >= crDay1Rounds(t) ? 2 : 1; $s.CR.day = t.day === 2 ? 7 : 6; }
    $s.CR.v = 2; extra = null;
    $s.CR.lastMsg = 'Carreira atualizada: agora o ano tem 52 semanas com dias, torneios em datas do calendário, pontos no padrão ITF (ranking = 10 melhores resultados do último ano) e potencial que sobe com a sua nota em cada partida.';
  } else if (extra) crSimYear(31, extra);
  if ($s.CR.potCur === undefined) $s.CR.potCur = Math.max(Math.min($s.CR.pot, overall($s.CR.me.a) + 3), Math.max(...Object.values($s.CR.me.a)));
  if ($s.CR.day === undefined) $s.CR.day = 1;
  if (nM < POOL_N || $s.CR.v === 2 && !$s.CR.migr2) { $s.CR.migr2 = true; saveCareer(); }
  // profissionais reais novos na lista: ganham um ano de resultados para entrar no ranking com pontos
  if ($s.CR.npcR && $s.CR.rosterN !== ROSTER.length) { const miss = ROSTER.filter(c => !$s.CR.npcR[c.id]); if (miss.length) crSimYear(7717, miss); $s.CR.rosterN = ROSTER.length; }
  if ($s.CR.catV !== 1 && $s.CR.npcR) { crCatSeed(); saveCareer(); }
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
const crLessonIncome = () => Math.round(Math.max(120, Math.round(TIERS[crMaxTier()].prize[0] * .15 / 10) * 10) * (crInv('quadra') ? 1.4 : 1));
// ---------- fama e patrocínio ----------
const BRANDS = ['Areia Fina', 'Solar Max Protetor', 'MarAzul Seguros', 'Coco Gelado', 'Tropicália Moda Praia', 'Ondas Telecom', 'Brisa Energéticos', 'Duna Óculos', 'Litoral Bank', 'Salina Isotônico', 'Farol Viagens', 'Arrecife Calçados', 'Maresia Relógios', 'Sol & Sal Cosméticos'];
// fama acompanha a sua posição no ranking (como um ranking de popularidade), mais o prestígio dos títulos:
// 1º do ranking ≈ 100, top 10 ≈ 55, top 50 ≈ 25; títulos grandes somam até +18. Eventos e títulos dão picos,
// mas a fama nunca passa muito do que o seu nível sustenta e volta aos poucos para esse alvo.
function crFamaTarget() {
  const rank = crRank(), N = crWorld().length + 1;
  const base = 100 * Math.pow(Math.max(0, 1 - Math.log(rank) / Math.log(N)), 1.3);
  const prestige = Math.min(18, Object.entries($s.CR.titles || {}).reduce((t, [k, v]) => t + v * .3 * Math.pow(+k + 1, 1.4), 0));
  return clamp(base + prestige, 0, 100);
}
function crAddFama(v) { const cap = Math.min(100, crFamaTarget() + 12); const f = $s.CR.fama || 0; $s.CR.fama = v >= 0 ? Math.max(f, Math.min(f + v, cap)) : Math.max(0, f + v); } // ganhar nunca reduz; acima do teto o pico não soma
function crFamaWeek() {
  const tg = crFamaTarget(), f = $s.CR.fama || 0;
  // acima do alvo cai devagar (mais devagar ainda com marca própria); abaixo sobe aos poucos
  $s.CR.fama = clamp(f + (tg - f) * (f > tg ? (crInv('marca') ? .05 : .1) : .08), 0, 100);
}
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
  quebrou: { w: .7, ok: () => $s.CR.racket !== 'basica' && $s.CR.racket !== 'assinatura', choice: () => { const r = RACKET_STATS[$s.CR.racket], c = Math.round(r.preco * .2); return { text: 'Sua ' + r.nome + ' trincou num smash.', opts: ['Consertar (' + money(c) + ')', 'Aposentar a raquete'], data: { c } }; },
    resolve: (i, d) => { if (i === 0 && $s.CR.money >= d.c) { $s.CR.money -= d.c; return 'Raquete consertada.'; } const old = $s.CR.racket; $s.CR.rackets = $s.CR.rackets.filter(k => k !== old); if (!$s.CR.rackets.includes('basica')) $s.CR.rackets.push('basica'); $s.CR.racket = $s.CR.rackets.slice().sort((a, b) => RACKET_STATS[b].preco - RACKET_STATS[a].preco)[0]; $s.CR.me.look.racket = $s.CR.racket; return 'Você voltou para a ' + RACKET_STATS[$s.CR.racket].nome + '.'; } },
  parceiro: { w: 1.4, ok: () => !!$s.CR.partner && $s.CR.mood < 60, choice: () => ({ text: nameOf(crChar($s.CR.partner)) + ' anda insatisfeito com a divisão de bolas.', opts: ['Conversar e acertar', 'Deixar para lá'] }),
    resolve: i => { if (i === 0) { $s.CR.chem = Math.min(5, $s.CR.chem + 1); return 'Conversa boa: entrosamento subiu.'; } $s.CR.chem = Math.max(0, $s.CR.chem - 2); if (Math.random() < .35) { const n = nameOf(crChar($s.CR.partner)); $s.CR.partner = null; $s.CR.chem = 0; return n + ' desfez a dupla.'; } return 'O clima esfriou: entrosamento caiu.'; } },
  beneficente: { w: 1.2, ok: () => true, choice: () => ({ text: 'Convite para um torneio beneficente de exibição.', opts: ['Jogar (−15 energia, +fama)', 'Recusar'] }),
    resolve: i => { if (i === 0) { $s.CR.energy = Math.max(0, $s.CR.energy - 15); crAddFama(7); crMaybeSponsor(); return 'Exibição lotada: +7 de fama.'; } return 'Você preferiu poupar energia.'; } },
  mentor: { w: 1, ok: () => $s.CR.money > 400, choice: () => { const c = 300 * (crMaxTier() + 1); return { text: 'Um ex-campeão mundial se oferece para ser seu mentor por 4 semanas.', opts: ['Aceitar (' + money(c) + ', +50% de evolução)', 'Recusar'], data: { c } }; },
    resolve: (i, d) => { if (i === 0 && $s.CR.money >= d.c) { $s.CR.money -= d.c; $s.CR.mentor = 4; return 'Mentoria começou: 4 semanas com +50% de evolução.'; } return 'Fica para a próxima.'; } },
  europa: { w: .9, ok: () => crMaxTier() >= 3, choice: () => { const c = 400 * (crMaxTier() + 1); return { text: 'Uma academia na Itália te convida para treinar 4 semanas com a elite do circuito.', opts: ['Ir (' + money(c) + ', +40% de evolução por 4 semanas)', 'Ficar no Brasil'], data: { c } }; },
    resolve: (i, d) => { if (i === 0 && $s.CR.money >= d.c) { $s.CR.money -= d.c; $s.CR.boostW = 4; return 'Temporada na Itália: 4 semanas com +40% de evolução.'; } return 'Você preferiu manter a rotina.'; } },
  premiacao: { w: 1.1, ok: () => !!$s.CR.partner && crMaxTier() >= 2, choice: () => { const c = Math.round(TIERS[crMaxTier()].prize[0] * .15 / 10) * 10; return { text: nameOf(crChar($s.CR.partner)) + ' quer uma divisão maior das premiações daqui pra frente.', opts: ['Aceitar (' + money(c) + ' agora)', 'Negar'], data: { c } }; },
    resolve: (i, d) => { if (i === 0 && $s.CR.money >= d.c) { $s.CR.money -= d.c; return crMood(15, 'Acordo fechado: seu parceiro ficou bem mais contente (+15 de humor).'); } return crMood(-14, 'Seu parceiro não gostou nada (−14 de humor).') || 'Seu parceiro não gostou nada (−14 de humor).'; } },
  serie: { w: .8, ok: () => $s.CR.fama >= 15, choice: () => ({ text: 'Uma série de TV quer acompanhar o seu dia a dia nas próximas semanas.', opts: ['Topar (+8 de fama, −15 de energia)', 'Manter a privacidade'] }),
    resolve: i => { if (i === 0) { $s.CR.energy = Math.max(0, $s.CR.energy - 15); crAddFama(8); crMaybeSponsor(); return 'Gravações começaram: +8 de fama.'; } return 'Você preferiu focar nos treinos.'; } },
  rival: { w: .8, ok: () => !!$s.CR.partner && crMaxTier() >= 3, choice: () => ({ text: 'Uma dupla rival provocou vocês nas redes antes do próximo torneio.', opts: ['Responder à altura', 'Ignorar'] }),
    resolve: i => { if (i === 0) { crAddFama(3); return crMood(Math.random() < .5 ? 8 : -6, 'A resposta repercutiu: +3 de fama.') || 'A resposta repercutiu: +3 de fama.'; } return crMood(2, 'Vocês preferiram responder na quadra.') || 'Vocês preferiram responder na quadra.'; } },
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

export { crEquipB, crSkipByes, crAutoDays, crSimTour, crStateSquad, crCatN, crMinCat, crCatPts, CAT_NAMES, crCharFromSave, crSlotChar, crCharFromJSON, crStartTarget, crPresetAttrs, crFormWord, crEnergyMod, crCanUp, flushSaves, DAY_NAMES, DAY_FULL, crDate, crDateTxt, crSeasonCal, crUpcoming, crNextDay, crRestUntil, crAvgRating, npcPts, RANK_BEST, crDay1Rounds, crWlog, STATE_INFO, crStateRanking, crDrillReward, crH2H, crRivalOf, STATES, crTourT, crUf, crTravel, LIFE, crLife, crLifeBuy, crGoalOptions, crPickGoal, crGoalDone, crMoodWord, crMoodBonus, crPartnerAct, crIsFinal, crFamaTarget, INVEST, crInv, crInvBuy, crInvWeek, crBoardTitle, HAIRS, SEASON_WEEKS, SKINS, TIERS, careerMatchEnded, crCap, crChar, crCharOvr, crCoach, crCreate, crEnter, crGearBonus, crHire, crLessonIncome, crMaxTier, crMeOvr, crMigrate, crMyMatch, crNRounds, crNextWeek, crPlayMatch, crPlaySim, crPts, crRank, crRanking, crResolveEvent, crRest, crRoundNames, crSetPartner, crSyncChars, crTeamName, crTeamOvr, crTierUnlocked, crTrain, crUpCost, crUpgrade, crWeekOptions, crWillPartner, crWorld, crXpMul, saveCareer, crSlots, crLoadSlot, crCloseSlot, crDeleteSlot, crExportData, crImportData, crRepoSaves, crImportUrl, SAVE_REPO, SAVE_DIR, crSaveErr };
// gancho de depuração (testes no navegador), como o window.__pdo do jogo
if (typeof window !== 'undefined') window.__pdoCR = { get CR() { return $s.CR; }, charFromJSON: t => crCharFromJSON(t), create: o => crCreate(o), meOvr: () => crMeOvr(), importData: t => crImportData(t), loadSlot: id => crLoadSlot(id), enter: o => crEnter(o), playSim: () => crPlaySim(), playMatch: () => crPlayMatch(), ranking: () => crRanking(), pts: () => crPts(), weekOptions: w => crWeekOptions(w), cal: () => crSeasonCal($s.CR.season), squad: uf => crStateSquad(uf), squads: () => crStateSquads(), catN: id => crCatN(id), minCat: id => crMinCat(id), nextWeek: () => crNextWeek() };
