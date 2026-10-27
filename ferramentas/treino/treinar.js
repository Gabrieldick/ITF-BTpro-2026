// Treino da CPU no simulador: estratégia evolutiva (pares antitéticos) sobre os parâmetros de decisão da IA.
// Cada candidato joga contra a CPU Lendária de sempre (AIP_BASE), trocando de lado, e a média anda na direção
// dos candidatos que mais venceram. A nota soma também a fração de golpes no verde (--verde, peso; o tempo de cada golpe
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
const ADV = { mode: 'base', adj: .5, params: AI.AIP_BASE };

// trabalhadores (um por núcleo)
const NW = Math.max(1, Math.min(+arg('nucleos', os.cpus().length), 8));
const ws = [], fila = [], pend = new Map(); let seq = 0;
function despacha() { for (const w of ws) if (w.livre && fila.length) { const t = fila.shift(); w.livre = false; w.p.send(t.msg); pend.set(t.msg.id, { t, w }); } }
function avalia(cfg, n = PTS) { return new Promise(res => { fila.push({ msg: { id: ++seq, a: cfg, b: ADV, n }, res }); despacha(); }); }
async function inicia() {
  await Promise.all(Array.from({ length: NW }, () => new Promise(ok => {
    const p = fork(__filename, ['worker']), w = { p, livre: false }; ws.push(w);
    p.on('message', m => {
      if (m.ready) { w.livre = true; ok(); despacha(); return; }
      const e = pend.get(m.id); pend.delete(m.id); w.livre = true; e.t.res({ win: m.pts / m.tot, perf: m.perf, f: m.pts / m.tot + VERDE * m.perf }); despacha();
    });
  })));
}
// avaliação maior (da média e do melhor): dividida entre os núcleos
async function avaliaGrande(cfg, n) {
  const rs = await Promise.all(Array.from({ length: NW }, () => avalia(cfg, Math.ceil(n / NW))));
  const med = k => rs.reduce((a, r) => a + r[k], 0) / rs.length;
  return { win: med('win'), perf: med('perf'), f: med('f') };
}
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const pct = x => (x * 100).toFixed(1) + '%';

(async () => {
  await inicia();
  const ini = GRUPO === 'pln' ? AI.PLN_TUNED : AI.AIP_TUNED;
  let m = norm(ini), r0 = await avaliaGrande(cfgDe(m), PTS * 4), melhor = { v: m.slice(), f: r0.f, r: r0 };
  console.log(`grupo ${GRUPO} · ${KEYS.length} parâmetros · ${NW} núcleos · inicial ${pct(r0.win)} contra a Lendária, ${pct(r0.perf)} no verde`);
  const t0 = Date.now();
  for (let g = 1; g <= GER; g++) {
    const sig = SIG * (1 - .6 * (g - 1) / GER); // passos menores no fim, para assentar
    const eps = Array.from({ length: PARES }, () => KEYS.map(gauss));
    const rs = await Promise.all(eps.flatMap(e => [avalia(cfgDe(m.map((x, i) => x + sig * e[i]))), avalia(cfgDe(m.map((x, i) => x - sig * e[i])))]));
    const fs2 = rs.map(r => r.f), mean = fs2.reduce((a, b) => a + b, 0) / fs2.length, sd = Math.sqrt(fs2.reduce((a, b) => a + (b - mean) ** 2, 0) / fs2.length) || 1e-3;
    const grad = KEYS.map((_, i) => eps.reduce((a, e, j) => a + (fs2[2 * j] - fs2[2 * j + 1]) / sd * e[i], 0) / PARES);
    m = m.map((x, i) => Math.min(1, Math.max(0, x + LR * sig * grad[i])));
    const med = k => rs.reduce((a, r) => a + r[k], 0) / rs.length;
    let linha = `ger ${g}/${GER} · candidatos ${pct(med('win'))} (${pct(Math.min(...rs.map(r => r.win)))}–${pct(Math.max(...rs.map(r => r.win)))}), verde ${pct(med('perf'))}`;
    if (g % 5 === 0 || g === GER) {
      const r = await avaliaGrande(cfgDe(m), PTS * 4); linha += ` · média ${pct(r.win)}, verde ${pct(r.perf)}`;
      if (r.f > melhor.f) { melhor = { v: m.slice(), f: r.f, r }; linha += ' ★'; fs.writeFileSync(path.join(__dirname, `parcial-${GRUPO}.json`), JSON.stringify({ vitoria: r.win, verde: r.perf, params: denorm(m) }, null, 2) + '\n'); }
    }
    console.log(linha + ` · ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  }
  // confirma o melhor com mais pontos
  const conf = await Promise.all(Array.from({ length: NW }, () => avalia(cfgDe(melhor.v), PTS * 3)));
  const fConf = conf.reduce((a, b) => a + b.win, 0) / conf.length, pConf = conf.reduce((a, b) => a + b.perf, 0) / conf.length;
  const res = denorm(melhor.v);
  console.log(`melhor: ${pct(fConf)} contra a Lendária, ${pct(pConf)} no verde (confirmação com ${NW * PTS * 6} pontos)`);
  console.log(JSON.stringify(res));
  fs.writeFileSync(path.join(__dirname, `resultado-${GRUPO}.json`), JSON.stringify({ vitoria: +fConf.toFixed(4), verde: +pConf.toFixed(4), params: res }, null, 2) + '\n');
  if (arg('aplicar', false)) {
    const nome = GRUPO === 'pln' ? 'PLN' : 'AIP', src = fs.readFileSync(IA, 'utf8');
    const re = new RegExp(`const ${nome}_TUNED = Object\\.assign\\(\\{\\}, ${nome}_BASE[^\\n]*`);
    fs.writeFileSync(IA, src.replace(re, `const ${nome}_TUNED = Object.assign({}, ${nome}_BASE, { ${Object.entries(res).map(([k, v]) => k + ': ' + String(v).replace(/^(-?)0\./, '$1.')).join(', ')} }); // treino: ${pct(fConf).replace('.', ',')} contra a Lendária, ${pct(pConf).replace('.', ',')} no verde`));
    console.log(`gravado em src/game/16-ia.ts (${nome}_TUNED)`);
  }
  ws.forEach(w => w.p.kill());
})();
