// @ts-nocheck
// configurações e estado da partida
import './00-base';
import { ROSTER } from './00-base';
// ---------- Settings & state ----------
const S = {
  mode: 'menu',            // menu | serve | toss | rally | dead | over
  paused: false,
  settings: { gender: 'mista', pick: { me: 'spot', mate: 'gaspar', o1: 'burmak', o2: 'nobre' }, assistMove: true, assistMark: true, mode: 'simples', cam: '3p', diff: 'medio', games: 4, assist: true, gfx: 'alto', racket: 'proteo', players: 'desenhado', uniforms: 'uniforme', side: 'direita', fovFp: 72 },
  score: { pts: [0, 0], games: [0, 0], tb: false },
  server: 0, serverIdx: [0, 0], serverPlayer: null, tbPlayed: 0,
  lastTeam: -1, hitId: 0, assign: [null, null], assignId: [-1, -1],
  serveType: null, aiServeT: 0, deadT: 0, matchWinner: null,
  rally: 0, stats: { pts: [0, 0], maxRally: 0, smashes: 0 },
  orbit: 0, shake: 0, muted: false,
};
let savedSettings = null;
try { savedSettings = JSON.parse(localStorage.getItem('pdo-settings') || 'null'); } catch (e) {}
if (savedSettings) {
  Object.assign(S.settings, savedSettings);
  if (savedSettings.assistMove === undefined && savedSettings.assist !== undefined) { S.settings.assistMove = S.settings.assistMark = !!savedSettings.assist; }
  S.settings.pick = Object.assign({ me: 'spot', mate: 'gaspar', o1: 'burmak', o2: 'nobre' }, savedSettings.pick || {});
  const dflt = { me: 'spot', mate: 'gaspar', o1: 'burmak', o2: 'nobre' };
  for (const k in S.settings.pick) if (!ROSTER.some(c => c.id === S.settings.pick[k])) S.settings.pick[k] = dflt[k];
}
const isMobile = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
if (isMobile && !(savedSettings && savedSettings.gfx)) S.settings.gfx = 'leve';

export { S, isMobile };
