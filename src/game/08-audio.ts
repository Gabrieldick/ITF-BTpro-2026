// @ts-nocheck
// qualidade gráfica e áudio
import './07-glb';
import { assetBuf } from '../assets';
import { rand } from './00-base';
import { S } from './01-estado';
import { renderer, sun } from './02-render';
import { sky } from './03-cenario';
import { particles } from './07-glb';
// ---------- Qualidade gráfica ----------
// resolução: base pela qualidade x escala dinâmica (cai quando o jogo não segura 60 fps)
let resScale = 1;
const basePR = () => { const dpr = window.devicePixelRatio || 1; return S.settings.gfx !== 'leve' ? Math.min(dpr, 1.5) : Math.min(dpr, 1); };
// com menu aberto a quadra fica só de fundo: metade da resolução (segue a 60 fps e libera a placa de vídeo)
let menuScale = 1;
function applyPR() { renderer.setPixelRatio(basePR() * resScale * menuScale); }
function setMenuRes(on) { const v = on ? .5 : 1; if (v === menuScale) return; menuScale = v; applyPR(); }
function setResScale(v) { if (Math.abs(v - resScale) < .01) return; resScale = v; applyPR(); }
const getResScale = () => resScale;
function applyGfx() {
  const hi = S.settings.gfx !== 'leve';
  applyPR();
  const size = hi ? 2048 : 1024;
  if (sun.shadow.mapSize.x !== size) {
    sun.shadow.mapSize.set(size, size);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  }
  sky.material.uniforms.cloudsOn.value = hi ? 1 : 0;
  particles.visible = hi;
}
// ---------- Áudio ----------
let actx = null;
function ac() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); loadHitSounds(actx); } catch (e) { actx = null; } } if (actx && actx.state === 'suspended') actx.resume().catch(() => {}); return actx; }
function noiseBurst(a, t, dur, freq, gain) {
  const len = Math.floor(a.sampleRate * dur); const buf = a.createBuffer(1, len, a.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource(); src.buffer = buf; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = .8;
  const g = a.createGain(); g.gain.value = gain; src.connect(f).connect(g).connect(a.destination); src.start(t);
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
  const g = a.createGain(); g.gain.value = .9; comp.connect(g).connect(a.destination);
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
  out.connect(lp); lp.connect(a.destination);
  const dl = a.createDelay(.2); dl.delayTime.value = .045; const fb = a.createGain(); fb.gain.value = .22; const wet = a.createGain(); wet.gain.value = .28;
  const dlp = a.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 1400;
  lp.connect(dl); dl.connect(dlp); dlp.connect(fb); fb.connect(dl); dlp.connect(wet); wet.connect(a.destination);
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
    o.connect(g).connect(a.destination); o.start(t + d); o.stop(t + d + .22);
  });
}
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
  src.connect(f).connect(g).connect(a.destination); src.start(); lfo.start();
  surf = { g };
}

export { setMenuRes, HITS, ac, applyGfx, setResScale, getResScale, sndHit, sndSand, sndWhistle, surf };
