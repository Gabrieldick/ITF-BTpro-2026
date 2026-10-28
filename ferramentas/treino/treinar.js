// Treino da CPU no simulador: estratégia evolutiva (pares antitéticos) sobre os parâmetros de decisão da IA.
// Cada candidato joga, trocando de lado, contra a Lendária de sempre (AIP_BASE), contra a própria IA (a média atual do
// treino) e contra o outro tipo de IA (Treinada × Planejadora, como estão no arquivo); a média anda na direção dos que mais
// venceram. Assim ela não vira só um robô de ganhar da Lendária (--rivais muda a lista: lendaria,eu,outra). A nota soma também a fração de golpes no verde (--verde, peso; o tempo de cada golpe
// é decisão da IA: tLead/tSmash/tServe). No fim grava o melhor conjunto em src/game/16-ia.ts (AIP_TUNED ou PLN_TUNED).
//
//   npm run build:sim
//   node ferramentas/treino/treinar.js --grupo aip --geracoes 40 --pontos 300 --aplicar
//   node ferramentas/treino/treinar.js --grupo pln --geracoes 30 --pontos 300 --aplicar   (IA Planejadora)
const { fork } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');

if (process.argv[2] === 'worker') {
  const J = require('./sim.js').criarJogo();
  process.on('message', ({ id, a, b, n }) => {
    const r1 = J.jogar(n, a, b), r2 = J.jogar(n, b, a);
    process.send({ id, pts: r1[0] + r2[1], tot: r1[0] + r1[1] + r2[0] + r2[1], perf: ((r1.perf[0] || 0) + (r2.perf[1] || 0)) / 2 });
  });
  process.send({ ready: true });
  return;
}

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const GRUPO = arg('grupo', 'aip'), GER = +arg('geracoes', 40), PTS = +arg('pontos', 300), PARES = +arg('pares', 4), SIG = +arg('sigma', .12), LR = +arg('lr', .6), VERDE = +arg('verde', .1);
const IA = path.join(__dirname, '../../src/game/16-ia.ts');

const ESPACO = GRUPO === 'pln' ? {
  thr: [.5, 1.1], err: [.5, 5], out: [.8, 3], marg: [.05, .3], counter: [0, 3], press: [0, .5], reach: [.4, 1.3],
  bSmash: [-.3, .3], bDef: [-.3, .3], bCurta: [-.3, .3], bLob: [-.3, .3], bKick: [-.3, .3],
} : {
  bestP: [1, 3], smartAim: [.5, 3], gapDirect: [1, 4], weakW: [0, 16], errW: [0, 1], bhAim: [0, 1], lobNet: [.2, 1], lobAttr: [0, 2],
  curtaBase: [.2, 1], curtaAttr: [0, 1.2], curtaMid: [0, 1], smashW: [.5, 1.5], defBase: [.1, .6], tie: [0, .3], fav: [0, 1],
  deepSmashAvoid: [0, 4], deepMin: [4.3, 6.3], ahead: [0, 1.2], letGoMin: [0, .3], serveSmash: [.4, .97], serveLob: [0, .3], serveCurta: [0, .3],
  // opcionais (sem eles no AIP_BASE vale o comportamento de sempre): limites da leitura, posição, lob e profundidade de cada golpe
  aimMax: [.4, 1], bestMax: [.5, 1], homeShift: [0, 1], homeHw: [1.2, 2.4], homeZ: [3.3, 6.2], rush: [0, 3], recvHw: [1, 2.4], recvZ: [-.5, 2.5],
  sideOff: [0, .7], lobPow: [.2, 1], lobKickP: [0, .8], d_smash: [0, 1], d_defesa: [0, 1], d_lob: [0, 1], d_curta: [0, 1], d_saque: [0, 1],
  // tempo do golpe (s): aperto antes da bola chegar, e quanto antes (−) ou depois (+) do ideal para a barra do smash e do saque;
  // começam no meio da faixa (sem saber onde fica o verde) e o treino é que acha
  tLead: [0, .8], tSmash: [-.2, .3], tServe: [-.3, .2],
};
// ponto de partida dos opcionais: o equivalente ao comportamento de sempre
const PADRAO = { aimMax: .85, bestMax: .92, homeShift: .5, homeHw: 1.8, homeZ: 4.6, rush: 0, recvHw: 1.6, recvZ: 1.1, sideOff: .35, lobPow: .7, lobKickP: .2,
  d_smash: .5, d_defesa: .5, d_lob: .5, d_curta: .5, d_saque: .5 };
const KEYS = Object.keys(ESPACO);

// valores atuais do arquivo (AIP_BASE / PLN_BASE e o que já foi treinado) via o próprio simulador
const J0 = require('./sim.js').criarJogo(), AI = J0.AI;
const BASE = GRUPO === 'pln' ? AI.PLN_BASE : AI.AIP_BASE;
const norm = o => KEYS.map(k => { const [lo, hi] = ESPACO[k], v = o[k] != null ? o[k] : PADRAO[k] != null ? PADRAO[k] : (lo + hi) / 2; return Math.min(1, Math.max(0, (v - lo) / (hi - lo))); });
const denorm = v => Object.fromEntries(KEYS.map((k, i) => { const [lo, hi] = ESPACO[k]; return [k, +(lo + Math.min(1, Math.max(0, v[i])) * (hi - lo)).toFixed(3)]; }));
const cfgDe = v => GRUPO === 'pln'
  ? { mode: 'planejadora', adj: .5, params: AI.AIP_TUNED, plan: Object.assign({}, BASE, denorm(v)) }
  : { mode: 'treinada', adj: .5, params: Object.assign({}, BASE, denorm(v)) };
// adversários: a Lendária de sempre, a própria IA (autojogo: a média atual do treino) e o outro tipo de IA (como está no arquivo).
// Para comparar gerações (escolher o melhor), "eu" vira a versão inicial, que não muda durante o treino
const LENDARIA = { mode: 'base', adj: .5, params: AI.AIP_BASE };
const OUTRA = GRUPO === 'pln' ? { mode: 'treinada', adj: .5, params: AI.AIP_TUNED } : { mode: 'planejadora', adj: .5, params: AI.AIP_TUNED, plan: AI.PLN_TUNED };
const RIVAIS = String(arg('rivais', 'lendaria,eu,outra')).split(',').filter(r => ['lendaria', 'eu', 'outra'].includes(r));
const FIXOS = RIVAIS.map(r => r === 'eu' ? 'inicial' : r);
const NOME = { lendaria: 'Lendária', eu: 'ela mesma', inicial: 'versão anterior', outra: GRUPO === 'pln' ? 'Treinada' : 'Planejadora' };
let M0 = null; // parâmetros do começo do treino (normalizados)
const rival = (r, m) => r === 'lendaria' ? LENDARIA : r === 'outra' ? OUTRA : cfgDe(r === 'inicial' ? M0 : m);

// trabalhadores (um por núcleo)
const NW = Math.max(1, Math.min(+arg('nucleos', os.cpus().length), 8));
const ws = [], fila = [], pend = new Map(); let seq = 0;
function despacha() { for (const w of ws) if (w.livre && fila.length) { const t = fila.shift(); w.livre = false; w.p.send(t.msg); pend.set(t.msg.id, { t, w }); } }
const joga = (a, b, n) => new Promise(res => { fila.push({ msg: { id: ++seq, a, b, n }, res }); despacha(); });
async function inicia() {
  await Promise.all(Array.from({ length: NW }, () => new Promise(ok => {
    const p = fork(__filename, ['worker']), w = { p, livre: false }; ws.push(w);
    p.on('message', m => {
      if (m.ready) { w.livre = true; ok(); despacha(); return; }
      const e = pend.get(m.id); pend.delete(m.id); w.livre = true; e.t.res(m); despacha();
    });
  })));
}
// avalia cfg contra cada rival (n pontos por lado contra cada um, em `partes` pedaços entre os núcleos); nota = média das
// vitórias + peso × fração no verde
async function avalia(cfg, rivais, m, n, partes = 1) {
  const rs = await Promise.all(rivais.map(r => Promise.all(Array.from({ length: partes }, () => joga(cfg, rival(r, m), Math.ceil(n / partes))))));
  const wins = {}; let perf = 0;
  rivais.forEach((r, i) => { const t = rs[i]; wins[r] = t.reduce((a, x) => a + x.pts, 0) / t.reduce((a, x) => a + x.tot, 0); perf += t.reduce((a, x) => a + x.perf, 0) / t.length; });
  const win = rivais.reduce((a, r) => a + wins[r], 0) / rivais.length; perf /= rivais.length;
  return { wins, win, perf, f: win + VERDE * perf };
}
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const pct = x => (x * 100).toFixed(1) + '%';
const porRival = r => Object.entries(r.wins).map(([k, v]) => NOME[k] + ' ' + pct(v)).join(', ');

(async () => {
  await inicia();
  const ini = GRUPO === 'pln' ? AI.PLN_TUNED : AI.AIP_TUNED;
  let m = norm(ini); M0 = m.slice();
  const NR = Math.ceil(PTS / RIVAIS.length), NG = Math.ceil(PTS * 4 / FIXOS.length); // pontos por rival: candidato / avaliação maior
  const r0 = await avalia(cfgDe(m), FIXOS, m, NG, NW); let melhor = { v: m.slice(), f: r0.f, r: r0 }; // (contra a versão anterior = ela mesma: ~50%)
  console.log(`grupo ${GRUPO} · ${KEYS.length} parâmetros · ${NW} núcleos · rivais: ${RIVAIS.map(r => NOME[r]).join(', ')} · inicial: ${porRival(r0)}, ${pct(r0.perf)} no verde`);
  const t0 = Date.now();
  for (let g = 1; g <= GER; g++) {
    const sig = SIG * (1 - .6 * (g - 1) / GER); // passos menores no fim, para assentar
    const eps = Array.from({ length: PARES }, () => KEYS.map(gauss));
    const rs = await Promise.all(eps.flatMap(e => [avalia(cfgDe(m.map((x, i) => x + sig * e[i])), RIVAIS, m, NR), avalia(cfgDe(m.map((x, i) => x - sig * e[i])), RIVAIS, m, NR)]));
    const fs2 = rs.map(r => r.f), mean = fs2.reduce((a, b) => a + b, 0) / fs2.length, sd = Math.sqrt(fs2.reduce((a, b) => a + (b - mean) ** 2, 0) / fs2.length) || 1e-3;
    const grad = KEYS.map((_, i) => eps.reduce((a, e, j) => a + (fs2[2 * j] - fs2[2 * j + 1]) / sd * e[i], 0) / PARES);
    m = m.map((x, i) => Math.min(1, Math.max(0, x + LR * sig * grad[i])));
    const med = k => rs.reduce((a, r) => a + r[k], 0) / rs.length;
    let linha = `ger ${g}/${GER} · candidatos ${pct(med('win'))}, verde ${pct(med('perf'))}`;
    if (g % 5 === 0 || g === GER) {
      const r = await avalia(cfgDe(m), FIXOS, m, NG, NW); linha += ` · média: ${porRival(r)}, verde ${pct(r.perf)}`;
      if (r.f > melhor.f) { melhor = { v: m.slice(), f: r.f, r }; linha += ' ★'; fs.writeFileSync(path.join(__dirname, `parcial-${GRUPO}.json`), JSON.stringify({ vitorias: r.wins, verde: r.perf, params: denorm(m) }, null, 2) + '\n'); }
    }
    console.log(linha + ` · ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  }
  // confirma o melhor com mais pontos, contra os rivais fixos
  const conf = await avalia(cfgDe(melhor.v), FIXOS, melhor.v, PTS * 6, NW);
  const res = denorm(melhor.v);
  console.log(`melhor: ${porRival(conf)}, ${pct(conf.perf)} no verde (confirmação com ${PTS * 12} pontos por rival)`);
  console.log(JSON.stringify(res));
  fs.writeFileSync(path.join(__dirname, `resultado-${GRUPO}.json`), JSON.stringify({ vitorias: conf.wins, verde: +conf.perf.toFixed(4), params: res }, null, 2) + '\n');
  if (arg('aplicar', false)) {
    const nome = GRUPO === 'pln' ? 'PLN' : 'AIP', src = fs.readFileSync(IA, 'utf8');
    const re = new RegExp(`const ${nome}_TUNED = Object\\.assign\\(\\{\\}, ${nome}_BASE[^\\n]*`);
    const nota = Object.entries(conf.wins).map(([k, v]) => pct(v).replace('.', ',') + ' contra ' + (k === 'lendaria' ? 'a Lendária' : k === 'outra' ? 'a ' + NOME.outra : 'a versão anterior')).join(', ');
    fs.writeFileSync(IA, src.replace(re, `const ${nome}_TUNED = Object.assign({}, ${nome}_BASE, { ${Object.entries(res).map(([k, v]) => k + ': ' + String(v).replace(/^(-?)0\./, '$1.')).join(', ')} }); // treino: ${nota}, ${pct(conf.perf).replace('.', ',')} no verde`));
    console.log(`gravado em src/game/16-ia.ts (${nome}_TUNED)`);
  }
  ws.forEach(w => w.p.kill());
})();
