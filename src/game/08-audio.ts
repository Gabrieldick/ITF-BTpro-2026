// @ts-nocheck
// qualidade gráfica e áudio
import './07-glb';
import { assetBuf } from '../assets';
import { rand } from './00-base';
import { S } from './01-estado';
import * as THREE from 'three';
import { renderer, sun, scene } from './02-render';
import { CROWD_SND, sky, setCourtSandDetail } from './03-cenario';
import { particles } from './07-glb';
// ---------- Qualidade gráfica ----------
// resolução: base pela qualidade x escala dinâmica (cai quando o jogo não segura 60 fps)
let resScale = 1;
// resolução escolhida: alta = nítida até em tela de alta densidade (2x); média = 1x; baixa = 75%; automática = pela
// qualidade (1,5x ou 1x) e cai sozinha quando não segura 60 fps
const resMode = () => S.settings.res || 'auto';
const basePR = () => { const dpr = window.devicePixelRatio || 1, m = resMode();
  if (m === 'alta') return Math.min(dpr, 2); if (m === 'media') return 1; if (m === 'baixa') return .75;
  return S.settings.gfx !== 'leve' ? Math.min(dpr, 1.5) : Math.min(dpr, 1); };
// com menu aberto a quadra fica só de fundo (escurecida atrás do painel): 38% da resolução, segue a 60 fps e libera a placa de vídeo
let menuScale = 1;
function applyPR() { renderer.setPixelRatio(basePR() * (resMode() === 'auto' ? resScale : 1) * menuScale); }
// hero: tela inicial com o jogador em destaque (precisa de mais resolução que o fundo desfocado dos outros menus)
function setMenuRes(on, hero) { const v = !on ? 1 : hero ? (S.settings.gfx === 'leve' ? .55 : .8) : .38; if (v === menuScale) return; menuScale = v; applyPR(); }
function setResScale(v) { if (Math.abs(v - resScale) < .01) return; resScale = v; applyPR(); }
const getResScale = () => resScale;
function applyGfx() {
  const hi = S.settings.gfx !== 'leve';
  applyPR();
  const size = S.settings.players === 'ultra' && hi ? 4096 : hi ? 2048 : 1024;
  if (sun.shadow.mapSize.x !== size) {
    sun.shadow.mapSize.set(size, size);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  }
  sky.material.uniforms.cloudsOn.value = hi ? 1 : 0;
  particles.visible = hi;
  // Leve: sombra com filtro simples (PCF) e areia da quadra com menos vértices
  const st = hi ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  if (renderer.shadowMap.type !== st) { renderer.shadowMap.type = st; scene.traverse(o => { const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { x.needsUpdate = true; }); }); }
  setCourtSandDetail(hi);
}
// ---------- Áudio ----------
let actx = null;
// canais de volume (mixer das configurações): cada som sai por um canal, e todos passam pelo geral
const VOL_DEF = { master: 1, music: .45, hits: 1, crowd: .7, amb: .8, fx: .8, voz: .9 };
const vol = k => { const v = (S.settings.vol || {})[k]; return v == null ? VOL_DEF[k] : Math.max(0, Math.min(1, +v || 0)); };
const BUS = {};
function bus(k) { const a = actx; if (!BUS.master) { BUS.master = a.createGain(); BUS.master.connect(a.destination); BUS.master.gain.value = S.muted ? 0 : vol('master'); }
  if (!BUS[k]) { BUS[k] = a.createGain(); BUS[k].gain.value = vol(k); BUS[k].connect(BUS.master); } return BUS[k]; }
function applyVol() { if (actx) { for (const k of ['hits', 'crowd', 'amb', 'fx']) bus(k).gain.value = vol(k); BUS.master.gain.value = S.muted ? 0 : vol('master'); } }
function ac() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); loadHitSounds(actx); } catch (e) { actx = null; } } if (actx && actx.state === 'suspended') actx.resume().catch(() => {}); return actx; }
function noiseBurst(a, t, dur, freq, gain) {
  const len = Math.floor(a.sampleRate * dur); const buf = a.createBuffer(1, len, a.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource(); src.buffer = buf; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = .8;
  const g = a.createGain(); g.gain.value = gain; src.connect(f).connect(g).connect(bus('fx')); src.start(t);
}
// batidas recortadas do arquivo em Sounds/ (início de cada batida em segundos e pico medido)
const HIT_CUTS = {
  forte: [[4.096, .881], [11.783, .739]],
  media: [[11.783, .739], [7.897, .5]],
  fraca: [[7.897, .5]],
};
const HITS = { forte: [], media: [], fraca: [] };
let HIT_BUS = null;
// compressor suave na saída das batidas: evita distorção quando duas batidas se sobrepõem
function hitBus(a) {
  if (HIT_BUS) return HIT_BUS;
  const comp = a.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = .002; comp.release.value = .12;
  const g = a.createGain(); g.gain.value = .9; comp.connect(g).connect(bus('hits'));
  return (HIT_BUS = comp);
}
function loadHitSounds(a) {
  const ab0 = assetBuf('snd-hits'); if (!ab0) return;
  const ab = ab0.slice(0);
  a.decodeAudioData(ab, buf => {
    const sr = buf.sampleRate, len = Math.floor(.25 * sr), fade = Math.floor(.08 * sr);
    for (const g in HIT_CUTS) for (const [t0, pk] of HIT_CUTS[g]) {
      const out = a.createBuffer(buf.numberOfChannels, len, sr), s0 = Math.max(0, Math.floor((t0 - .004) * sr));
      for (let c = 0; c < buf.numberOfChannels; c++) {
        const src = buf.getChannelData(c), dst = out.getChannelData(c);
        for (let i = 0; i < len && s0 + i < src.length; i++) {
          const env = i < 40 ? i / 40 : i > len - fade ? (len - i) / fade : 1;
          dst[i] = src[s0 + i] * env / pk * .55; // folga para não estourar
        }
      }
      HITS[g].push(out);
    }
  }, () => {});
}
function sndHit(power) {
  if (S.muted) return; const a0 = ac(); if (!a0) return;
  const g = power >= .7 ? 'forte' : power >= .3 ? 'media' : 'fraca';
  const list = HITS[g].length ? HITS[g] : HITS.media.length ? HITS.media : null;
  if (list) {
    const src = a0.createBufferSource(); src.buffer = list[Math.floor(Math.random() * list.length)];
    src.playbackRate.value = ({ forte: 1, media: .97, fraca: .9 })[g] * rand(.97, 1.03);
    const gn = a0.createGain(); gn.gain.value = ({ forte: .8, media: .6, fraca: .42 })[g] * rand(.92, 1.04);
    src.connect(gn).connect(hitBus(a0)); src.start();
    return;
  }
  sndHitSynth(power);
}
function sndHitSynth(power) {
  if (S.muted) return; const a = ac(); if (!a) return; const t = a.currentTime;
  // saída com corte de agudos e um eco curto de ambiente aberto (menos seco)
  const out = a.createGain(); out.gain.value = .5 + power * .35;
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = .5;
  out.connect(lp); lp.connect(bus('hits'));
  const dl = a.createDelay(.2); dl.delayTime.value = .045; const fb = a.createGain(); fb.gain.value = .22; const wet = a.createGain(); wet.gain.value = .28;
  const dlp = a.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 1400;
  lp.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(wet); wet.connect(bus('hits'));
  // 'pop' oco e macio da bola despressurizada na face de carbono
  const len = Math.floor(a.sampleRate * .09), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (a.sampleRate * .016));
  const nz = a.createBufferSource(); nz.buffer = buf;
  const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 720 + power * 260; bp.Q.value = .9;
  nz.connect(bp).connect(out); nz.start(t);
  // corpo grave
  const o = a.createOscillator(), g = a.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(230 + power * 70, t); o.frequency.exponentialRampToValueAtTime(140, t + .08);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.55, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + .11);
  o.connect(g).connect(out); o.start(t); o.stop(t + .12);
}
function sndSand() { if (S.muted) return; const a = ac(); if (!a) return; noiseBurst(a, a.currentTime, .18, 500, .5); }
function sndWhistle(good) {
  if (S.muted) return; const a = ac(); if (!a) return; const t = a.currentTime;
  [0, .12].forEach((d, i) => {
    const o = a.createOscillator(), g = a.createGain(); o.type = 'sine';
    o.frequency.value = good ? (i ? 880 : 660) : (i ? 330 : 440);
    g.gain.setValueAtTime(.0001, t + d); g.gain.exponentialRampToValueAtTime(.18, t + d + .02); g.gain.exponentialRampToValueAtTime(.0001, t + d + .2);
    o.connect(g).connect(bus('fx')); o.start(t + d); o.stop(t + d + .22);
  });
}
// ---------- torcida (gravações reais, baixadas só quando precisam) ----------
// Plateia de tênis: mais palmas que gritos. leve: só palmas, curtas (ponto comum) · ponto: palmas com um pouco de vibração
// (ponto bonito, game) · forte: palmas cheias com vibração (set e partida) · titulo: vibração longa com palmas · aplauso: quadra
// sem arquibancada. Vários trechos de cada (nunca o mesmo duas vezes seguidas)
const CROWD_FILES = { leve: [1, 2, 3, 4, 5].map(i => 'torcida-leve' + i + '.mp3'), ponto: [1, 2, 3, 4].map(i => 'torcida-ponto' + i + '.mp3'), forte: [1, 2, 3, 4].map(i => 'torcida-forte' + i + '.mp3'),
  titulo: ['torcida-titulo.mp3'], aplauso: ['aplauso.mp3', 'aplauso2.mp3'], fundo: ['torcida-fundo.mp3'] };
const CROWD_BUF = {}, crowdPrev = {}; let crowdLast = null, crowdAmb = null;
function crowdPick(kind) { const l = CROWD_FILES[kind]; let i = Math.floor(Math.random() * l.length); if (l.length > 1 && i === crowdPrev[kind]) i = (i + 1 + Math.floor(Math.random() * (l.length - 1))) % l.length; crowdPrev[kind] = i; return l[i]; }
function crowdBuf(file, cb) {
  const c = CROWD_BUF[file]; if (c) { if (c.buf) cb(c.buf); else if (c.wait) c.wait.push(cb); return; }
  const a = ac(); if (!a) return; const e = (CROWD_BUF[file] = { buf: null, wait: [cb] });
  fetch(import.meta.env.BASE_URL + 'assets/som/' + file).then(r => (r.ok ? r.arrayBuffer() : Promise.reject())).then(ab => a.decodeAudioData(ab, b => { e.buf = b; e.wait.forEach(f => f(b)); e.wait = null; }, () => { e.wait = null; })).catch(() => { e.wait = null; });
}
// k: tamanho do momento (1,2 ponto comum · 1,9 ponto bonito · 2,3 game · 2,9 set · 3,2 partida · 4+ título) · crowd: lugares de
// torcida na arena (0 = quadra aberta) · m: de que lado a torcida está (acima de 1: ponto de quem ela apoia; abaixo: do outro)
function sndCheer(k, crowd, m = 1) {
  if (S.muted || typeof window === 'undefined') return; const a = ac(); if (!a) return;
  const now = a.currentTime, x = k * m;
  if (crowdLast && now - crowdLast.t < 1.5) { if (x <= crowdLast.x) return; try { crowdLast.g.gain.setTargetAtTime(0, now, .15); crowdLast.src.stop(now + .6); } catch (e) {} } // (título logo depois do ponto: troca pela maior)
  let kind, v;
  if (!crowd) { if (x < 2.1) return; kind = 'aplauso'; v = .22 + .1 * Math.min(1, (x - 2) / 2); } // quadra aberta: só palmas de quem está em volta, em game, set, partida e título
  else if (x >= 3.8) { kind = 'titulo'; v = .55; }
  else if (x >= 2.6) { kind = 'forte'; v = .4; }
  else if (x >= 1.75) { kind = 'ponto'; v = .26; }
  else if (x >= .95) { kind = 'leve'; v = .15; }
  else { if (Math.random() < .55) return; kind = 'leve'; v = .08; } // ponto de quem a torcida não apoia: quase nada
  if (crowd) v *= Math.min(1, .55 + crowd / 400) * Math.max(.6, Math.min(1.1, .75 + .25 * m));
  const mark = (crowdLast = { t: now, x, g: null, src: null });
  crowdBuf(crowdPick(kind), buf => {
    if (S.muted || crowdLast !== mark || a.currentTime - now > 1.2) return; // (chegou tarde demais: melhor nada que fora de hora)
    const src = a.createBufferSource(), g = a.createGain(); src.buffer = buf; src.playbackRate.value = rand(.94, 1.06); g.gain.value = v * rand(.85, 1.1);
    src.connect(g).connect(bus('crowd')); src.start(); mark.g = g; mark.src = src;
  });
}
// burburinho da arquibancada: só entre os pontos e baixo; no saque e durante o ponto a torcida fica em silêncio (e a
// vibração do ponto anterior some). Fora da partida (menus), tudo da torcida se cala
function sndCrowdAmb(on, inPoint) {
  if (typeof window === 'undefined' || !actx) return; // (o áudio só nasce depois de um toque do jogador)
  const now = actx.currentTime;
  if (crowdLast && crowdLast.g && (inPoint || S.muted || !on) && !crowdLast.cut) { crowdLast.cut = true; try { crowdLast.g.gain.setTargetAtTime(0, now, inPoint ? .35 : .08); crowdLast.src.stop(now + 2); } catch (e) {} }
  const v = on && !S.muted && !inPoint ? .05 : 0;
  if (crowdAmb) { if (crowdAmb.g && crowdAmb.v !== v) { crowdAmb.v = v; crowdAmb.g.gain.setTargetAtTime(v, now, v ? .8 : .15); } return; }
  if (!v) return;
  const amb = (crowdAmb = { g: null, v });
  crowdBuf(CROWD_FILES.fundo[0], buf => { const a = actx, src = a.createBufferSource(), g = a.createGain(); src.buffer = buf; src.loop = true; g.gain.value = 0; g.gain.setTargetAtTime(amb.v, a.currentTime, .8); src.connect(g).connect(bus('crowd')); src.start(); amb.g = g; });
}
CROWD_SND.cheer = sndCheer; CROWD_SND.amb = sndCrowdAmb;
// ---------- trilha dos menus ----------
// As faixas vêm de public/assets/musica/trilha.json (título, artista, estilo, licença — ver README): para tirar ou trocar
// uma música basta mexer nesse arquivo. Toca só nos menus, em ordem sorteada; some ao entrar na partida. Volume pelo
// mixer; S.settings.musicOff desliga. O mostrador #musBox (canto do menu) diz o que está tocando e deixa pular ou mutar
const MUS = { list: null, loading: false, order: [], i: 0, el: null, tryT: 0, cur: null, shown: '' };
function musLoad() {
  if (MUS.loading) return; MUS.loading = true;
  fetch(import.meta.env.BASE_URL + 'assets/musica/trilha.json').then(r => (r.ok ? r.json() : [])).then(l => { MUS.list = Array.isArray(l) ? l.filter(t => t && t.arquivo) : [];
    MUS.order = MUS.list.map((_, k) => k); for (let k = MUS.order.length - 1; k > 0; k--) { const r = Math.floor(Math.random() * (k + 1)); [MUS.order[k], MUS.order[r]] = [MUS.order[r], MUS.order[k]]; } }).catch(() => { MUS.list = []; });
}
function musSet(step) {
  if (!MUS.list || !MUS.list.length || !MUS.el) return;
  MUS.i = (MUS.i + (step || 0) + MUS.order.length) % MUS.order.length; MUS.cur = MUS.list[MUS.order[MUS.i]];
  MUS.el.src = import.meta.env.BASE_URL + 'assets/musica/' + MUS.cur.arquivo; MUS.el.play().catch(() => {});
}
function musicNext() { if (MUS.el && MUS.list && MUS.list.length) { MUS.el.volume = 0; musSet(1); musBox(true); } }
function musBox(inMenu) {
  const box = typeof document !== 'undefined' && document.getElementById('musBox'); if (!box) return;
  const off = !!S.settings.musicOff || S.muted, txt = !inMenu || !MUS.cur ? '' : (off ? 'off|' : 'on|') + MUS.cur.titulo + '|' + MUS.cur.artista;
  if (txt === MUS.shown) return; MUS.shown = txt;
  box.hidden = !txt; if (!txt) return;
  box.querySelector('.mus-t').textContent = off ? 'Música desligada' : MUS.cur.titulo; box.querySelector('.mus-a').textContent = off ? '' : MUS.cur.artista + (MUS.cur.estilo ? ' · ' + MUS.cur.estilo : '');
  box.querySelector('[data-mus="mute"]').textContent = off ? '🔇' : '🔊'; box.classList.toggle('off', off);
}
function musicTick(inMenu) {
  if (typeof Audio === 'undefined') return;
  const v = S.muted || S.settings.musicOff ? 0 : vol('master') * vol('music') * .3, on = inMenu && v > 0;
  if (inMenu && !MUS.list) musLoad();
  if (!MUS.el) { if (!on || !MUS.list || !MUS.list.length) { musBox(inMenu && !!MUS.cur); return; }
    MUS.el = new Audio(); MUS.el.preload = 'none'; MUS.el.volume = 0; MUS.el.addEventListener('ended', () => musSet(1)); MUS.el.addEventListener('error', () => { if (MUS.list.length > 1) setTimeout(() => musSet(1), 800); });
    musSet(0); MUS.tryT = performance.now(); }
  const m = MUS.el, cur = m.volume, tgt = on ? v : 0, nv = Math.abs(tgt - cur) < .004 ? tgt : cur + (tgt - cur) * .06; m.volume = Math.max(0, Math.min(1, nv));
  const t = performance.now();
  if (on && m.paused && t - MUS.tryT > 1500) { MUS.tryT = t; m.play().catch(() => {}); } // (antes do primeiro toque o navegador recusa: tenta de novo)
  else if (!on && !m.paused && m.volume < .01) m.pause();
  musBox(inMenu);
}
// a cada quadro (19-loop): fora da partida a torcida se cala e a música entra
function audioTick(inMenu) { if (inMenu) sndCrowdAmb(false, false); musicTick(inMenu); }
// som do mar ao fundo
let surf = null;
function startSurf() {
  if (surf || S.muted) return; const a = ac(); if (!a) return;
  const len = a.sampleRate * 4; const buf = a.createBuffer(1, len, a.sampleRate); const d = buf.getChannelData(0);
  let lastV = 0; for (let i = 0; i < len; i++) { lastV = lastV * .985 + (Math.random() * 2 - 1) * .015; d[i] = lastV * 6; }
  const src = a.createBufferSource(); src.buffer = buf; src.loop = true;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
  const g = a.createGain(); g.gain.value = .07;
  const lfo = a.createOscillator(); lfo.frequency.value = .11; const lg = a.createGain(); lg.gain.value = .05;
  lfo.connect(lg).connect(g.gain);
  src.connect(f).connect(g).connect(bus('amb')); src.start(); lfo.start();
  surf = { g };
}

export { musicNext, audioTick, applyVol, VOL_DEF, setMenuRes, HITS, ac, applyGfx, setResScale, getResScale, sndHit, sndSand, sndWhistle, surf };
