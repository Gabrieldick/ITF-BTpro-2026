// visuais das outras raquetes: fundo, cores de destaque, padrão e nome
function mkRacketDraw(c) {
  return (x, w, h) => {
    if (c.carbon) carbonBase(x, w, h, c.bg, .08); else { x.fillStyle = c.bg; x.fillRect(0, 0, w, h); }
    x.lineWidth = 6;
    if (c.pattern === 'stripes') { x.fillStyle = c.a1; for (let i = 0; i < 4; i++) x.fillRect(0, h * (.16 + i * .12), w, h * .04); }
    else if (c.pattern === 'waves') { x.strokeStyle = c.a1; for (let k = 0; k < 5; k++) { x.lineWidth = 5 - k * .6; x.beginPath(); for (let i = 0; i <= w; i += 6) { const y = h * (.2 + k * .1) + Math.sin(i / 22 + k) * 9; i ? x.lineTo(i, y) : x.moveTo(i, y); } x.stroke(); } }
    else if (c.pattern === 'diag') { x.fillStyle = c.a1; x.beginPath(); x.moveTo(0, h * .55); x.lineTo(w, h * .12); x.lineTo(w, h * .28); x.lineTo(0, h * .7); x.fill(); if (c.a2) { x.fillStyle = c.a2; x.beginPath(); x.moveTo(0, h * .62); x.lineTo(w, h * .33); x.lineTo(w, h * .37); x.lineTo(0, h * .66); x.fill(); } }
    else if (c.pattern === 'chevron') { x.strokeStyle = c.a1; x.lineWidth = 9; for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(w * .12, h * (.2 + k * .12)); x.lineTo(w / 2, h * (.32 + k * .12)); x.lineTo(w * .88, h * (.2 + k * .12)); x.stroke(); } if (c.a2) { x.strokeStyle = c.a2; x.lineWidth = 3; x.beginPath(); x.moveTo(w * .12, h * .56); x.lineTo(w / 2, h * .66); x.lineTo(w * .88, h * .56); x.stroke(); } }
    else if (c.pattern === 'rings') { x.strokeStyle = c.a1; for (let k = 0; k < 5; k++) { x.lineWidth = 2 + (k % 2) * 2; x.beginPath(); x.arc(w / 2, h * .42, 18 + k * 18, 0, Math.PI * 2); x.stroke(); } }
    else if (c.pattern === 'tri') { x.strokeStyle = c.a1; x.lineWidth = 3; for (let k = 0; k < 5; k++) { triPath(x, w / 2, h * .42, 20 + k * 15); x.stroke(); } }
    x.fillStyle = c.band || c.a1; x.fillRect(0, h * .74, w, h * .1);
    modelName(x, c.label, h * .79, c.labelColor || c.bg, c.label.length > 9 ? 11 : 13);
  };
}
const RACKET_STYLES = {
  tropic: { bg: '#2fb6a7', a1: '#ffe14d', pattern: 'stripes', label: 'TROPIC', labelColor: '#1d4f49', edge: '#ffe14d', holes: 'proteo' },
  brisa: { bg: '#9fd8ff', a1: '#ffffff', pattern: 'waves', label: 'BRISA JR', labelColor: '#2457c5', edge: '#ffffff', holes: 'medusa' },
  mare: { bg: '#0e3b5c', a1: '#4fd1c5', pattern: 'waves', label: 'MARÉ', edge: '#4fd1c5', holes: 'medusa' },
  coral: { bg: '#ff6f61', a1: '#2b1d14', a2: '#fbf6ea', pattern: 'diag', label: 'CORAL', labelColor: '#fbf6ea', band: '#2b1d14', edge: '#2b1d14', holes: 'kronos' },
  duna: { bg: '#e8c48a', a1: '#8a5a2b', pattern: 'waves', label: 'DUNA', labelColor: '#fbf6ea', edge: '#8a5a2b', holes: 'medusa' },
  tufao: { bg: '#151515', a1: '#ff2d2d', a2: '#fbf6ea', pattern: 'chevron', label: 'TUFÃO', labelColor: '#151515', carbon: true, edge: '#ff2d2d', holes: 'kronos' },
  atol: { bg: '#0b7a83', a1: '#fbf6ea', pattern: 'rings', label: 'ATOL', edge: '#fbf6ea', holes: 'medusa' },
  ventosul: { bg: '#f4f1ea', a1: '#2457c5', a2: '#ffb11f', pattern: 'diag', label: 'VENTO SUL', labelColor: '#f4f1ea', edge: '#2457c5', holes: 'proteo' },
  recife: { bg: '#3b1f5c', a1: '#ffb11f', pattern: 'tri', label: 'RECIFE', edge: '#ffb11f', holes: 'proteo' },
  tsunami: { bg: '#06263f', a1: '#18a0fb', pattern: 'waves', label: 'TSUNAMI', carbon: true, edge: '#18a0fb', holes: 'kronos' },
  eclipse: { bg: '#101010', a1: '#c9a24a', pattern: 'rings', label: 'ECLIPSE 3K', labelColor: '#101010', carbon: true, edge: '#c9a24a', holes: 'supercarbon' },
  zenite: { bg: '#f7f7f7', a1: '#e8a317', a2: '#0f2436', pattern: 'chevron', label: 'ZÊNITE', labelColor: '#f7f7f7', band: '#0f2436', edge: '#e8a317', holes: 'supercarbon' },
};
Object.entries(RACKET_STYLES).forEach(([k, c]) => { RACKETS[k] = { edge: c.edge, grip: '#141516', throat: c.edge, holes: c.holes, draw: mkRacketDraw(c) }; });
