// @ts-nocheck
// ---------- Replays: cada ponto vira um clipe ----------
// Grava o ponto com o tempo de jogo de cada quadro e, ao fim do ponto, "limpa" a jogada para o replay:
// reamostra a 60 quadros por segundo, leva o corpo de quem bate até a bola (a raquete encontra a bola no ponto de
// contato ideal), refaz cada golpe com o tempo certo até o contato e suaviza os deslocamentos.
// O replay anda no tempo do jogo (com câmera lenta suave nos lances decisivos) e cada clipe pode virar um vídeo.
import * as THREE from 'three';
import { TOSS_T, clamp, hScale } from './00-base';
import { S } from './01-estado';
import { camera, renderer } from './02-render';
import { cpuA, cpuB, human, partner } from './06-modelos';
import { ball } from './07-glb';
import { getResScale, setResScale } from './08-audio';
import { $, el } from './09-interface';

const HZ = 60, MAX_CLIPS = 80;
const PL = () => [human, partner, cpuA, cpuB];
const REC = { cur: [], hits: [], t: 0, prevMode: '', deadT: -1, done: false, lastHit: -1, n: 0 };
const RP = { list: null, i: 0, t: 0, speed: 1, cam: new THREE.Vector3(10, 4, 0), look: new THREE.Vector3(), onEnd: null, rec: null };

// ---------- gravação ----------
function snap() {
  return { t: REC.t, b: [ball.pos.x, ball.pos.y, ball.pos.z, ball.vel.x, ball.vel.y, ball.vel.z], bs: ball.state,
    p: PL().map(p => [p.pos.x, p.pos.z, p.swing.t, p.swing.type, p.swing.dur, p.swing.side, p.swing.var, p.jump || 0, p.jumpDur || 0, p.jumpH || 0, p.charging ? 1 : 0, p.dive ? p.dive.t : -1, p.dive ? p.dive.dur : 0, p.split || 0,
      S.mode === 'toss' && S.serverPlayer === p ? clamp(p.tossT / TOSS_T, 0, 1) : -1]) };
}
function recordTick(dt) {
  const m = S.mode;
  if (m === 'serve' && REC.prevMode !== 'serve') { REC.cur = []; REC.hits = []; REC.t = 0; REC.deadT = -1; REC.done = false; REC.lastHit = S.hitId; }
  if (['toss', 'rally', 'dead'].includes(m) && !S.drill && REC.cur.length < 3000) {
    REC.t += dt;
    const lh = S.lastHit;
    if (lh && lh.hitId === S.hitId && REC.lastHit !== S.hitId) { // golpe novo neste quadro
      REC.lastHit = S.hitId;
      const i = PL().indexOf(lh.p), c = lh.p.contact;
      if (i >= 0 && c) REC.hits.push({ t: REC.t, i, x: c.x, y: c.y, z: c.z, serve: lh.cat === 'saque', type: lh.p.swing.type, dur: lh.p.swing.dur, side: lh.p.swing.side, v: lh.p.swing.var, cat: lh.cat });
    }
    REC.cur.push(snap());
    if (m === 'dead' && REC.deadT < 0) REC.deadT = REC.t;
    if (REC.deadT >= 0 && !REC.done && REC.t - REC.deadT > 1.1) { REC.done = true; keepClip(); }
  }
  REC.prevMode = m;
}
// ---------- limpeza ----------
const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
function resample(F) {
  const out = [], T = F[F.length - 1].t; let j = 0;
  for (let t = F[0].t; t <= T + 1e-6; t += 1 / HZ) {
    while (j < F.length - 2 && F[j + 1].t < t) j++;
    const A = F[j], B = F[Math.min(F.length - 1, j + 1)], a = B.t > A.t ? clamp((t - A.t) / (B.t - A.t), 0, 1) : 0, N = a < .5 ? A : B;
    const L = (x, y) => x + (y - x) * a;
    out.push({ t, b: A.b.map((v, k) => L(v, B.b[k])), bs: N.bs,
      p: A.p.map((pa, i) => { const pb = B.p[i], pn = N.p[i];
        const st = pa[2] >= 0 && pb[2] >= 0 && pa[3] === pb[3] ? L(pa[2], pb[2]) : pn[2];
        return { x: L(pa[0], pb[0]), z: L(pa[1], pb[1]), st, ty: pn[3], sd: pn[4], ss: pn[5], sv: pn[6], j: pa[7] > 0 && pb[7] > 0 ? L(pa[7], pb[7]) : pn[7], jd: pn[8], jh: pn[9], ch: pn[10],
          dt: pa[11] >= 0 && pb[11] >= 0 ? L(pa[11], pb[11]) : pn[11], dd: pn[12], sp: L(pa[13], pb[13]), ts: pa[14] >= 0 && pb[14] >= 0 ? L(pa[14], pb[14]) : pn[14], c: null }; }) });
  }
  return out;
}
function cleanClip(F, hits, deadT) {
  const R = resample(F), t0 = F[0].t, N = R.length, idx = t => clamp(Math.round((t - t0) * HZ), 0, N - 1);
  const pl = PL();
  for (let i = 0; i < 4; i++) {
    const p = pl[i], fwdS = p.team === 0 ? -1 : 1, rightS = (p.team === 0 ? 1 : -1) * (p.lefty ? -1 : 1);
    const dx = new Float32Array(N), dz = new Float32Array(N), wsum = new Float32Array(N);
    hits.filter(h => h.i === i).forEach(h => {
      // onde o corpo precisa estar para a bola cair no meio da raquete
      const over = h.serve || (h.type === 'smash' && h.y >= 1.5), bh = !over && h.side < -.15;
      const lat = over ? .25 : bh ? -.55 : .62, fw = over ? .15 : .25;
      const k = idx(h.t), P = R[k].p[i];
      let cx = (h.x - rightS * lat) - P.x, cz = (h.z - fwdS * fw) - P.z;
      const m = Math.hypot(cx, cz); if (m > 1.8) { cx *= 1.8 / m; cz *= 1.8 / m; }
      for (let f = 0; f < N; f++) {
        const t = R[f].t - h.t, w = t < 0 ? sstep(-.6, -.08, t) : 1 - sstep(.12, .55, t);
        if (w > 0) { dx[f] += cx * w; dz[f] += cz * w; wsum[f] += w; }
      }
      // o golpe com o tempo certo: a raquete chega na bola no ponto de contato
      // por cima (smash e saque) o contato é depois de a raquete cair atrás das costas (45% do golpe) e o golpe fica um
      // pouco mais longo no replay: no jogo essa fase passa em menos de dois quadros e parece um tranco
      const ovr = h.serve || h.type === 'smash', cu = .45, dur = ovr ? Math.max(h.dur || .4, .62) : h.dur || .5, a = Math.max(0, idx(h.t - cu * dur)), b = idx(h.t + (1 - cu) * dur);
      // o golpe gravado (com o "salto" do tempo na batida) sai inteiro antes de entrar o limpo
      for (let f = k; f >= 0 && R[f].p[i].st >= 0; f--) R[f].p[i].st = -1;
      for (let f = k + 1; f < N && R[f].p[i].st >= 0; f++) R[f].p[i].st = -1;
      for (let f = a; f <= b; f++) {
        const Q = R[f].p[i]; Q.st = clamp(R[f].t - h.t + cu * dur, 0, dur - 1e-3); Q.ty = h.serve ? 'smash' : h.type; Q.sd = dur; Q.ts = -1; Q.ss = h.side; Q.sv = h.v; Q.ch = 0;
        Q.c = [h.x, h.y, h.z, cu, R[f].t < h.t ? 1 : 0]; // antes do contato a raquete já vai para onde vai bater
      }
      // bola acima do alcance do braço com a raquete: um pulinho até ela (no jogo o contato às vezes "estica")
      // um pulo só, com o ponto mais alto no contato: o pulo gravado (que começa na batida) sai, e entra um limpo
      // quando a bola está acima do alcance ou no smash alto (no jogo ele pula na hora da batida)
      const top = (over ? 2.45 : 2.05) * hScale(p), need = h.y - top;
      if (need > .04 || (over && !h.serve && h.y > 2.2)) {
        for (let f = idx(h.t - .5); f <= idx(h.t + .7); f++) R[f].p[i].j = 0;
        const jd = .42, jh = Math.min(.55, Math.max(need + .05, .26)), s0 = h.t - jd / 2;
        for (let f = idx(s0); f <= idx(s0 + jd); f++) { const Q = R[f].p[i], left = jd - (R[f].t - s0); if (left > 0 && left <= jd) { Q.j = left; Q.jd = jd; Q.jh = jh; } }
      }
      if (h.serve) for (let f = 0; f < a; f++) if (R[f].p[i].ts >= 0) R[f].p[i].ts = Math.min(R[f].p[i].ts, .999);
    });
    for (let f = 0; f < N; f++) { const Q = R[f].p[i], w = wsum[f] > 1 ? 1 / wsum[f] : 1; Q.x += dx[f] * w; Q.z += dz[f] * w; }
    // suavização (gaussiana ~70 ms) e velocidade a partir das posições suavizadas
    const X = R.map(r => r.p[i].x), Z = R.map(r => r.p[i].z), K = [1, 4, 7, 4, 1];
    for (let f = 0; f < N; f++) { let sx = 0, sz = 0, sw = 0; for (let o = -2; o <= 2; o++) { const g = clamp(f + o, 0, N - 1), w = K[o + 2]; sx += X[g] * w; sz += Z[g] * w; sw += w; } R[f].p[i].x = sx / sw; R[f].p[i].z = sz / sw; }
    for (let f = 0; f < N; f++) { const A = R[Math.max(0, f - 2)].p[i], B = R[Math.min(N - 1, f + 2)].p[i], dt = (Math.min(N - 1, f + 2) - Math.max(0, f - 2)) / HZ || 1; R[f].p[i].vx = (B.x - A.x) / dt; R[f].p[i].vz = (B.z - A.z) / dt; }
  }
  // câmera lenta suave: no golpe decisivo e no fim do ponto; um pouco nos smashes
  const slow = [];
  const last = hits[hits.length - 1];
  if (last) slow.push({ t: last.t, k: .7, w: .35 });
  hits.forEach(h => { if (h !== last && h.cat === 'smash') slow.push({ t: h.t, k: .4, w: .25 }); });
  if (deadT >= 0) slow.push({ t: deadT, k: .55, w: .3 });
  return { R, t0, slow };
}
function keepClip() {
  const lp = S.lastPoint; if (!lp || REC.cur.length < 30) return;
  const score = lp.rally + (lp.kind === 'in' ? 1 : 0) + (lp.cat === 'smash' && lp.kind === 'in' ? 3 : 0) + (lp.cat === 'curta' && lp.kind === 'in' ? 3 : 0) + (lp.cat === 'voleio' ? 2 : 0) + (lp.dive ? 5 : 0) + (lp.w === 0 ? 2 : 0);
  // até 20 s: o começo de um rally muito longo fica de fora
  const F = REC.cur.filter(s => s.t >= REC.t - 20), hits = REC.hits.filter(h => h.t >= F[0].t);
  const clip = cleanClip(F, hits, REC.deadT);
  const g = S.score && S.score.games ? S.score.games : [0, 0];
  clip.text = lp.text; clip.score = score; clip.n = ++REC.n; clip.games = g[0] + '–' + g[1]; clip.won = lp.w === 0;
  S.clips = (S.clips || []).concat([clip]).slice(-MAX_CLIPS);
  S.highlights = S.clips.slice().sort((a, b) => b.score - a.score).slice(0, 3).sort((a, b) => a.n - b.n);
}
// ---------- reprodução ----------
function speedAt(c, t) { let s = 1; c.slow.forEach(w => { s = Math.min(s, 1 - w.k * Math.exp(-(((t - w.t) / w.w) ** 2))); }); return Math.max(.25, s); }
function applyAt(c, t) {
  const R = c.R, x = clamp((t - c.t0) * HZ, 0, R.length - 1), f = Math.floor(x), a = x - f, A = R[f], B = R[Math.min(R.length - 1, f + 1)];
  const L = (u, v) => u + (v - u) * a, N = a < .5 ? A : B;
  ball.pos.set(L(A.b[0], B.b[0]), L(A.b[1], B.b[1]), L(A.b[2], B.b[2])); ball.vel.set(L(A.b[3], B.b[3]), L(A.b[4], B.b[4]), L(A.b[5], B.b[5]));
  ball.state = N.bs === 'held' ? 'toss' : N.bs;
  PL().forEach((p, i) => {
    const P = A.p[i], Q = B.p[i], M = N.p[i];
    p.pos.set(L(P.x, Q.x), 0, L(P.z, Q.z)); p.vel.set(L(P.vx, Q.vx), 0, L(P.vz, Q.vz));
    p.swing.t = P.st >= 0 && Q.st >= 0 && P.ty === Q.ty ? L(P.st, Q.st) : M.st; p.swing.type = M.ty; p.swing.dur = M.sd; p.swing.side = M.ss; p.swing.var = M.sv;
    p.swing.hit = !!M.c && !M.c[4]; p.contact = M.c ? { x: M.c[0], y: M.c[1], z: M.c[2], u: M.c[3], hitId: S.hitId, pre: !!M.c[4] } : null;
    p.jump = M.j; p.jumpDur = M.jd; p.jumpH = M.jh; p.charging = !!M.ch; p.dive = M.dt >= 0 ? { t: M.dt, dur: M.dd } : null; p.split = M.sp;
    p.rpToss = P.ts >= 0 && Q.ts >= 0 ? L(P.ts, Q.ts) : M.ts;
  });
}
const clipEnd = c => c.t0 + (c.R.length - 1) / HZ;
function showClipText() { const c = RP.list[RP.i]; $('replayTxt').textContent = '#' + c.n + ' · ' + c.text; RP.t = c.t0; }
function playClips(list, onEnd, rec) {
  if (!list || !list.length) return;
  RP.list = list.slice(); RP.i = 0; RP.onEnd = onEnd || null; RP.rec = rec || null;
  el.over.hidden = true; $('clips').hidden = true; S.mode = 'replay'; document.body.classList.add('in-replay'); $('replayBar').hidden = false;
  showClipText(); RP.cam.set(9.5, 3.4, ball.pos.z * .55 + 1.5);
}
function endReplay(skip) {
  if (!RP.list) return;
  const done = RP.onEnd, rec = RP.rec;
  RP.list = null; RP.onEnd = null; RP.rec = null; S.mode = 'over'; document.body.classList.remove('in-replay'); $('replayBar').hidden = true;
  PL().forEach(p => { p.swing.t = -1; p.swing.hit = false; p.contact = null; p.charging = false; p.dive = null; p.rpToss = -1; p.vel.set(0, 0, 0); });
  if (rec) rec.stop(!!skip);
  if (done) done(); else el.over.hidden = false;
}
// avança o replay; devolve o dt de jogo para a animação (câmera lenta = animação mais lenta também)
function replayTick(dt) {
  if (!RP.list) return dt;
  const c = RP.list[RP.i];
  RP.speed = speedAt(c, RP.t);
  RP.t += dt * RP.speed;
  if (RP.t > clipEnd(c)) { RP.i++; if (RP.i >= RP.list.length) { endReplay(); return dt; } showClipText(); return dt; }
  applyAt(c, RP.t);
  return dt * RP.speed;
}
// câmera de transmissão: lateral, acompanha a bola com suavidade e aproxima um pouco na câmera lenta
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
function replayCamera(dt) {
  const k = 1 - Math.exp(-dt * 2.2), zoom = 1 - (1 - RP.speed) * .35;
  _v.set(9.2 * zoom, 3.1 * zoom + .4, ball.pos.z * .5 + 1.2); RP.cam.lerp(_v, k);
  _w.set(ball.pos.x * .35, .9 + Math.min(ball.pos.y, 4) * .25, ball.pos.z * .75); RP.look.lerp(_w, 1 - Math.exp(-dt * 3.5));
  camera.position.copy(RP.cam); camera.lookAt(RP.look);
}
// ---------- vídeo: grava o canvas enquanto o clipe toca ----------
function videoType() {
  const MR = window.MediaRecorder; if (!MR) return null;
  return ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(t => MR.isTypeSupported && MR.isTypeSupported(t)) || null;
}
function saveVideo(clips, name, onEnd) {
  const type = videoType(), cv = renderer.domElement;
  if (!type || !cv.captureStream) { alert('Este navegador não grava vídeo do jogo. Tente no Chrome, Edge ou Firefox.'); return; }
  const prevRes = getResScale(); setResScale(1); // vídeo na resolução cheia
  const mr = new MediaRecorder(cv.captureStream(60), { mimeType: type, videoBitsPerSecond: 10e6 }), chunks = [];
  mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  let cancel = false;
  mr.onstop = () => {
    setResScale(prevRes);
    if (!cancel && chunks.length) {
      const blob = new Blob(chunks, { type: type.split(';')[0] }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name + (type.includes('mp4') ? '.mp4' : '.webm'); document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    }
  };
  mr.start(250);
  playClips(clips, onEnd, { stop: skip => { cancel = skip; mr.stop(); } });
  $('replayTxt').textContent = '● GRAVANDO · ' + $('replayTxt').textContent;
}
// ---------- lista de clipes ----------
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fileName = c => 'ponto-' + c.n + '-' + String(c.text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
function openClips() {
  const cl = S.clips || [], best = new Set(S.highlights || []);
  $('clipList').innerHTML = cl.length ? cl.slice().reverse().map(c => '<div class="clip-row' + (c.won ? ' won' : '') + '"><span class="clip-n">#' + c.n + '</span><span class="clip-t">' + (best.has(c) ? '★ ' : '') + esc(c.text) + '<small>games ' + c.games + ' · ' + Math.round(clipEnd(c) - c.t0) + ' s</small></span>'
    + '<button class="ghost sm" data-play="' + c.n + '">▶ Ver</button><button class="ghost sm" data-save="' + c.n + '">⬇ Vídeo</button></div>').join('') : '<p class="cr-note">Nenhum ponto gravado nesta partida.</p>';
  $('clipsBest').hidden = !best.size; $('clipsBestSave').hidden = !best.size || !videoType();
  el.over.hidden = true; $('clips').hidden = false;
}
const byN = n => (S.clips || []).find(c => c.n === +n);
$('clipList').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.play) playClips([byN(b.dataset.play)], openClips);
  else if (b.dataset.save) saveVideo([byN(b.dataset.save)], fileName(byN(b.dataset.save)), openClips);
});
$('clipsBest').addEventListener('click', () => playClips(S.highlights, openClips));
$('clipsBestSave').addEventListener('click', () => saveVideo(S.highlights, 'melhores-momentos', openClips));
$('clipsClose').addEventListener('click', () => { $('clips').hidden = true; el.over.hidden = false; });
$('btnReplay').addEventListener('click', openClips);
$('replaySkip').addEventListener('click', () => { if (S.mode === 'replay') endReplay(true); });
addEventListener('keydown', e => { if (S.mode === 'replay' && (e.key === 'Escape' || e.key === ' ')) { e.stopImmediatePropagation(); e.preventDefault(); endReplay(true); } }, true);
const startReplay = () => playClips(S.highlights);

export { RP, recordTick, replayCamera, replayTick, startReplay };
