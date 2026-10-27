// Treino da CPU no simulador: estratégia evolutiva (pares antitéticos) sobre os parâmetros de decisão da IA.
// Cada candidato joga contra a CPU Lendária de sempre (AIP_BASE), trocando de lado, e a média anda na direção
// dos candidatos que mais venceram. No fim grava o melhor conjunto em src/game/16-ia.ts (AIP_TUNED ou PLN_TUNED).
//
//   npm run build:sim
//   node ferramentas/treino/treinar.js --grupo aip --geracoes 40 --pontos 300 --aplicar
//   node ferramentas/treino/treinar.js --grupo pln --geracoes 30 --pontos 300 --aplicar   (IA Planejadora)
const { fork } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');

if (process.argv[2] === 'worker') {
  const J = require('./sim.js').criarJogo();
  process.on('message', ({ id, a, b, n }) => {
    const r1 = J.jogar(n, a, b), r2 = J.jogar(n, b, a);
    process.send({ id, pts: r1[0] + r2[1], tot: r1[0] + r1[1] + r2[0] + r2[1] });
  });
  process.send({ ready: true });
  return;
}

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const GRUPO = arg('grupo', 'aip'), GER = +arg('geracoes', 40), PTS = +arg('pontos', 300), PARES = +arg('pares', 4), SIG = +arg('sigma', .12), LR = +arg('lr', .6);
const IA = path.join(__dirname, '../../src/game/16-ia.ts');

const ESPACO = GRUPO === 'pln' ? {
  thr: [.5, 1.1], err: [.5, 5], out: [.8, 3], marg: [.05, .3], counter: [0, 3], press: [0, .5], reach: [.4, 1.3],
  bSmash: [-.3, .3], bDef: [-.3, .3], bCurta: [-.3, .3], bLob: [-.3, .3], bKick: [-.3, .3],
} : {
  bestP: [1, 3], smartAim: [.5, 3], gapDirect: [1, 4], weakW: [0, 16], errW: [0, 1], bhAim: [0, 1], lobNet: [.2, 1], lobAttr: [0, 1.2],
  curtaBase: [.2, 1], curtaAttr: [0, 1.2], curtaMid: [0, .6], smashW: [.5, 1.5], defBase: [.1, .6], tie: [0, .3], fav: [0, 1],
  deepSmashAvoid: [0, 4], deepMin: [4.3, 6.3], ahead: [0, 1.2], letGoMin: [0, .3], serveSmash: [.4, .97], serveLob: [0, .3], serveCurta: [0, .3],
};
const KEYS = Object.keys(ESPACO);

// valores atuais do arquivo (AIP_BASE / PLN_BASE e o que já foi treinado) via o próprio simulador
const J0 = require('./sim.js').criarJogo(), AI = J0.AI;
const BASE = GRUPO === 'pln' ? AI.PLN_BASE : AI.AIP_BASE;
const norm = o => KEYS.map(k => { const [lo, hi] = ESPACO[k]; return Math.min(1, Math.max(0, (o[k] - lo) / (hi - lo))); });
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
      const e = pend.get(m.id); pend.delete(m.id); w.livre = true; e.t.res(m.pts / m.tot); despacha();
    });
  })));
}
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const pct = x => (x * 100).toFixed(1) + '%';

(async () => {
  await inicia();
  const ini = GRUPO === 'pln' ? AI.PLN_TUNED : AI.AIP_TUNED;
  let m = norm(ini), melhor = { v: m.slice(), f: await avalia(cfgDe(m), PTS * 4) };
  console.log(`grupo ${GRUPO} · ${KEYS.length} parâmetros · ${NW} núcleos · inicial ${pct(melhor.f)} contra a Lendária`);
  const t0 = Date.now();
  for (let g = 1; g <= GER; g++) {
    const eps = Array.from({ length: PARES }, () => KEYS.map(gauss));
    const fs2 = await Promise.all(eps.flatMap(e => [avalia(cfgDe(m.map((x, i) => x + SIG * e[i]))), avalia(cfgDe(m.map((x, i) => x - SIG * e[i])))]));
    const mean = fs2.reduce((a, b) => a + b, 0) / fs2.length, sd = Math.sqrt(fs2.reduce((a, b) => a + (b - mean) ** 2, 0) / fs2.length) || 1e-3;
    const grad = KEYS.map((_, i) => eps.reduce((a, e, j) => a + (fs2[2 * j] - fs2[2 * j + 1]) / sd * e[i], 0) / PARES);
    m = m.map((x, i) => Math.min(1, Math.max(0, x + LR * SIG * grad[i])));
    let linha = `ger ${g}/${GER} · candidatos ${pct(mean)} (${pct(Math.min(...fs2))}–${pct(Math.max(...fs2))})`;
    if (g % 5 === 0 || g === GER) {
      const f = await avalia(cfgDe(m), PTS * 4); linha += ` · média ${pct(f)}`;
      if (f > melhor.f) { melhor = { v: m.slice(), f }; linha += ' ★'; }
    }
    console.log(linha + ` · ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  }
  // confirma o melhor com mais pontos
  const conf = await Promise.all(Array.from({ length: NW }, () => avalia(cfgDe(melhor.v), PTS * 3)));
  const fConf = conf.reduce((a, b) => a + b, 0) / conf.length;
  const res = denorm(melhor.v);
  console.log(`melhor: ${pct(fConf)} contra a Lendária (confirmação com ${NW * PTS * 6} pontos)`);
  console.log(JSON.stringify(res));
  fs.writeFileSync(path.join(__dirname, `resultado-${GRUPO}.json`), JSON.stringify({ vitoria: +fConf.toFixed(4), params: res }, null, 2) + '\n');
  if (arg('aplicar', false)) {
    const nome = GRUPO === 'pln' ? 'PLN' : 'AIP', src = fs.readFileSync(IA, 'utf8');
    const re = new RegExp(`const ${nome}_TUNED = Object\\.assign\\(\\{\\}, ${nome}_BASE[^\\n]*`);
    fs.writeFileSync(IA, src.replace(re, `const ${nome}_TUNED = Object.assign({}, ${nome}_BASE, { ${Object.entries(res).map(([k, v]) => k + ': ' + String(v).replace(/^(-?)0\./, '$1.')).join(', ')} }); // treino: ${pct(fConf)} contra a Lendária`));
    console.log(`gravado em src/game/16-ia.ts (${nome}_TUNED)`);
  }
  ws.forEach(w => w.p.kill());
})();
