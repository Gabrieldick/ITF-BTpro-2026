// @ts-nocheck
// configurações e estado da partida
import './00-base';
import { ROSTER } from './00-base';
// ---------- Settings & state ----------
const S = {
  mode: 'menu',            // menu | serve | toss | rally | dead | over
  paused: false,
  settings: { gender: 'mista', pick: { me: 'spot', mate: 'gaspar', o1: 'burmak', o2: 'nobre' }, assistMove: false, assistMoveV2: true, assistMark: true, mode: 'simples', cam: '3p', cam3: 'padrao', camDist: 100, diff: 'medio', games: 4, assist: true, gfx: 'alto', racket: 'proteo', players: 'desenhado', uniforms: 'simples', lookV2: true, side: 'direita', fovFp: 72, format: 'set', tactic: 'normal' },
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
  S.settings.format = 'set'; // o formato pro só vale dentro das finais da carreira
  if (savedSettings.assistMove === undefined && savedSettings.assist !== undefined) { S.settings.assistMove = S.settings.assistMark = !!savedSettings.assist; }
  // 'seguir a bola' passou a vir desligado: desliga uma vez nas configurações salvas antes da mudança
  if (!savedSettings.assistMoveV2) { S.settings.assistMove = false; S.settings.assistMoveV2 = true; }
  // padrão novo: personagens desenhados com roupa simples (aplicado uma vez nas configurações antigas)
  if (!savedSettings.lookV2) { S.settings.players = 'desenhado'; S.settings.uniforms = 'simples'; S.settings.lookV2 = true; }
  S.settings.pick = Object.assign({ me: 'spot', mate: 'gaspar', o1: 'burmak', o2: 'nobre' }, savedSettings.pick || {});
  const dflt = { me: 'spot', mate: 'gaspar', o1: 'burmak', o2: 'nobre' };
  for (const k in S.settings.pick) if (!ROSTER.some(c => c.id === S.settings.pick[k])) S.settings.pick[k] = dflt[k];
}
const isMobile = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
if (isMobile && !(savedSettings && savedSettings.gfx)) S.settings.gfx = 'leve';

// modo online: role 'host' (simula tudo) | 'guest' (só manda entradas e desenha o estado recebido) | null.
// O módulo 20-online preenche os ganchos; os outros módulos só chamam se existirem.
const NET = { role: null, ev: null, onPoint: null, onSetupPoint: null, onNewMatch: null, onMenu: null, guestTick: null, hostTick: null, shot: null, remote: [] };

export { S, isMobile, NET };
