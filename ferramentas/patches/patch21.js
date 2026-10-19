const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };

// carrega e recorta as batidas gravadas quando o áudio é liberado pelo primeiro clique
rep("function ac() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }",
    "function ac() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); loadHitSounds(actx); } catch (e) { actx = null; } }");
rep("function sndHit(power) {", `// batidas recortadas do arquivo em Sounds/ (início de cada batida em segundos e pico medido)
const HIT_CUTS = {
  forte: [[5.463, .97], [10.177, .97]],
  media: [[.484, .58], [11.654, .56], [3.103, .64]],
  fraca: [[13.574, .42], [2.42, .34], [6.251, .32], [13.05, .29]],
};
const HITS = { forte: [], media: [], fraca: [] };
function loadHitSounds(a) {
  const n = document.getElementById('snd-hits'); const txt = n && n.textContent ? n.textContent.trim() : '';
  if (!txt) return;
  let ab;
  try { const bin = atob(txt); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); ab = u.buffer; } catch (e) { return; }
  a.decodeAudioData(ab, buf => {
    const sr = buf.sampleRate, len = Math.floor(.22 * sr), fade = Math.floor(.06 * sr);
    for (const g in HIT_CUTS) for (const [t0, pk] of HIT_CUTS[g]) {
      const out = a.createBuffer(buf.numberOfChannels, len, sr), s0 = Math.max(0, Math.floor((t0 - .004) * sr));
      for (let c = 0; c < buf.numberOfChannels; c++) {
        const src = buf.getChannelData(c), dst = out.getChannelData(c);
        for (let i = 0; i < len && s0 + i < src.length; i++) {
          const env = i < 40 ? i / 40 : i > len - fade ? (len - i) / fade : 1;
          dst[i] = src[s0 + i] * env / pk;
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
    src.playbackRate.value = rand(.94, 1.06);
    const gn = a0.createGain(); gn.gain.value = ({ forte: .95, media: .75, fraca: .55 })[g] * rand(.9, 1.05);
    src.connect(gn).connect(a0.destination); src.start();
    return;
  }
  sndHitSynth(power);
}
function sndHitSynth(power) {`);
fs.writeFileSync(f, s);
console.log('ok');
