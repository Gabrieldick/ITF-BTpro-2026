// Ambiente do simulador para treinar a CPU: carrega o jogo sem gráficos (ferramentas/teste/build/jogo-sim.js,
// gerado por `npm run build:sim`) e joga pontos de CPU contra CPU nos dois times, cada um com o seu modo de IA.
const fs = require('fs'), vm = require('vm'), path = require('path');
const FILE = path.join(__dirname, '../teste/build/jogo-sim.js');

function criarJogo() {
  const src = fs.readFileSync(FILE, 'utf8');
  const dummy = new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => 0 : (k === 'getMaxAnisotropy' ? () => 1 : dummy), set: () => true, apply: () => dummy, construct: () => dummy });
  class V3 { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this } copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this } clone() { return new V3(this.x, this.y, this.z) } add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this } sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this } multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this } addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this } length() { return Math.hypot(this.x, this.y, this.z) } normalize() { const l = this.length() || 1; return this.multiplyScalar(1 / l) } distanceTo(v) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z) } lerp(v, a) { this.x += (v.x - this.x) * a; this.y += (v.y - this.y) * a; this.z += (v.z - this.z) * a; return this } subVectors(a, b) { return this.set(a.x - b.x, a.y - b.y, a.z - b.z) } crossVectors(a, b) { return this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x) } dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z } lengthSq() { return this.dot(this) } fromArray(a) { return this.set(a[0], a[1], a[2]) } negate() { return this.multiplyScalar(-1) } project() { return this } applyQuaternion() { return this } }
  const THREE = new Proxy({ Vector3: V3 }, { get: (t, k) => k in t ? t[k] : dummy });
  const mkEl = id => ({ id, hidden: false, textContent: '', innerHTML: '', style: { setProperty() {} }, dataset: {}, checked: true, value: '', disabled: false, options: [], classList: { s: new Set(), add(c) { this.s.add(c) }, remove(c) { this.s.delete(c) }, toggle(c, v) { if (v === undefined) v = !this.s.has(c); v ? this.s.add(c) : this.s.delete(c) }, contains(c) { return this.s.has(c) } }, addEventListener() {}, append() {}, appendChild() {}, prepend() {}, remove() {}, querySelector() { return mkEl('q') }, querySelectorAll() { return [] }, focus() {}, blur() {}, setPointerCapture() {}, getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 } }, firstChild: { textContent: '' } });
  const els = {}, getEl = id => els[id] || (els[id] = mkEl(id));
  const listeners = {}; let now = 0, raf = null;
  const VALS = { players: '3d', racket: 'proteo', mode: 'dupla', cam: '3p', diff: 'medio', len: '6', gfx: 'baixo', format: 'set' };
  const document = { getElementById: getEl, querySelectorAll: () => [], querySelector: q => { if (!q.startsWith('input')) return getEl(q); const m = q.match(/name=(\w+)/); return { value: VALS[m && m[1]], checked: true }; }, createElement: () => Object.assign(mkEl('c'), { getContext: () => dummy, width: 0, height: 0 }), body: mkEl('body'), documentElement: mkEl('html'), addEventListener() {}, hidden: false, hasFocus: () => true, activeElement: null };
  const sb = { THREE, document, window: null, navigator: { getGamepads: () => [] }, performance: { now: () => now }, requestAnimationFrame: f => { raf = f }, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {}, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f) }, KeyboardEvent: function () {}, location: { hash: '', search: '' }, console, Math, JSON, Object, Array, Set, Map, Float32Array, Symbol, Number, Date };
  sb.window = sb; vm.createContext(sb); sb.THREE_GLTF = { GLTFLoader: dummy }; sb.THREE_SKEL = dummy;
  vm.runInContext(src, sb);
  getEl('menu').hidden = false; getEl('menu').dataset.step = 'q3';
  (listeners.keydown || []).forEach(f => f({ key: 'Enter', repeat: false, preventDefault() {}, target: {} }));
  const P = sb.__pdo, AI = sb.__pdoAI;
  P.human.isHuman = false; // os quatro jogadores pela CPU
  return {
    P, AI,
    // joga n pontos: modos/parâmetros por time; devolve os pontos de cada time
    jogar(n, cfg0, cfg1) {
      const S = P.S; S.simAI = { 0: cfg0, 1: cfg1 }; S.settings.games = 99; S.score.games = [0, 0];
      for (const p of [P.human, P.partner, P.cpuA, P.cpuB]) p.skill = AI.charSkill(p);
      const start = S.stats.pts.slice(); let guard = 0;
      while ((S.stats.pts[0] - start[0]) + (S.stats.pts[1] - start[1]) < n && guard++ < n * 4000) {
        P.step(1 / 120);
        if (S.mode === 'over') { S.mode = 'dead'; S.matchWinner = null; S.score.games = [0, 0]; S.deadT = .1; }
      }
      return [S.stats.pts[0] - start[0], S.stats.pts[1] - start[1]];
    },
  };
}
module.exports = { criarJogo };
