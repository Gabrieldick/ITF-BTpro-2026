const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, () => b); };

// estilos de jogo dos bots (além da habilidade)
rep("const racketBonus = key =>", `// estilo de jogo: que golpes prefere, onde se posiciona, quanto arrisca e como saca
// w: peso de cada golpe em bola comum · high: chance de smash em bola alta · home: metros mais perto (−) ou mais longe (+) da rede
// speed/noise: força e precisão dos golpes · err: erros não forçados · react: tempo de reação · serve: pesos [smash, lob, curta, seguro]
const PLAY_STYLES = {
  agressivo: { nome: 'Agressivo', desc: 'Ataca tudo: smash e drive fortes, joga mais à frente e erra mais.', w: { smash: 3, lob: .5, curta: .5, defesa: 1 }, high: .93, mid: .5, home: -.7, speed: 1.08, noise: 1.15, err: 1.3, react: 1, serve: [.97, 0, .01, .02], aimBody: .45 },
  paredao: { nome: 'Paredão', desc: 'Fica no fundo e devolve tudo: erra pouco e ataca pouco.', w: { smash: .6, lob: 1.3, curta: .4, defesa: 3 }, high: .62, mid: 0, home: .8, speed: .93, noise: .85, err: .7, react: .95, serve: [.7, .05, .02, .23] },
  tatico: { nome: 'Tático', desc: 'Curtas, lobs e bolas nos espaços vazios e nos cantos.', w: { smash: .8, lob: 1.6, curta: 1.8, defesa: 1.2 }, high: .75, mid: .1, home: 0, speed: .97, noise: .9, err: .9, react: 1, serve: [.74, .1, .11, .05], corners: true },
  rede: { nome: 'Voleador', desc: 'Joga colado na rede: reflexo rápido e bola no chão.', w: { smash: 2, lob: .4, curta: 1.5, defesa: 1.2 }, high: .88, mid: .35, home: -1.3, speed: 1.03, noise: 1, err: 1.1, react: .78, serve: [.95, 0, .03, .02] },
  lobista: { nome: 'Lobista', desc: 'Empurra o adversário para trás com lobs altos e pacientes.', w: { smash: .7, lob: 3, curta: .6, defesa: 1.4 }, high: .7, mid: 0, home: 1, speed: .95, noise: .9, err: .85, react: 1, serve: [.8, .12, .02, .06], lobHigh: true },
  completo: { nome: 'Equilibrado', desc: 'Faz de tudo um pouco.', w: { smash: 1, lob: 1, curta: 1, defesa: 2.2 }, high: .8, mid: 0, home: 0, speed: 1, noise: 1, err: 1, react: 1, serve: null },
};
// estilo de cada personagem: pela descrição real, pelo estilo da carreira ou pelos atributos
function playStyleOf(c) {
  if (!c) return 'completo';
  if (c.jogo && PLAY_STYLES[c.jogo]) return c.jogo;
  const e = (c.estilo || '').toLowerCase();
  if (/rede|voleio|bloqueio|reflexo/.test(e)) return 'rede';
  if (/lob/.test(e) && !/curta|toque/.test(e)) return 'lobista';
  if (/toque|curta|tátic|tatic|geometria|técnica|criativ|efeito|precis/.test(e)) return 'tatico';
  if (/defes|defend|defensor|paciência|solidez|consist|regular/.test(e)) return 'paredao';
  if (/smash|ataque|atacante|potente|potência|agress|força|drive|explos|saque|intensidade|define/.test(e)) return 'agressivo';
  const a = c.a, atk = (a.smash + a.forca + a.saque) / 3, def = (a.def + a.vel) / 2, toq = (a.curta + a.lob) / 2, m = (atk + def + toq) / 3;
  if (atk > m + 1.5) return 'agressivo'; if (def > m + 1.5) return 'paredao'; if (toq > m + 1.5) return 'tatico';
  // equilibrados fictícios ganham variedade pelo id
  if (c.fict) { const h = [...c.id].reduce((t, ch) => t + ch.charCodeAt(0), 0) % 5; return h === 0 ? 'rede' : h === 1 ? 'lobista' : 'completo'; }
  return 'completo';
}
const styleOf = p => PLAY_STYLES[p.playStyle] || PLAY_STYLES.completo;
const racketBonus = key =>`);
// guarda o estilo de cada jogador na escalação
rep("    p.skill = p.isHuman ? null : charSkill(p);", "    p.playStyle = playStyleOf(c);\n    p.skill = p.isHuman ? null : charSkill(p);");
// erros e reação conforme o estilo
rep("    speed: (2.9 + a.vel * .022) * dm, react: brain.react, smart: brain.smart, letGo: brain.letGo,\n    miss: brain.miss * lerp(1.7, .45, a.def / 100), err: brain.err * lerp(1.7, .45, tech),",
    "    speed: (2.9 + a.vel * .022) * dm, react: brain.react * styleOf(p).react, smart: brain.smart, letGo: brain.letGo,\n    miss: brain.miss * lerp(1.7, .45, a.def / 100), err: brain.err * lerp(1.7, .45, tech) * styleOf(p).err,");
// mira: agressivo joga no corpo de quem está na rede, tático procura os cantos
rep("function aiAim(p) {\n  if (Math.random() < skillOf(p).smart) return gapX(p.team, .5);",
    "function aiAim(p) {\n  const st = styleOf(p), lim = C.halfW - .6;\n  if (st.aimBody && Math.random() < st.aimBody) { const opp = teams[1 - p.team].slice().sort((a, b) => Math.abs(a.pos.z) - Math.abs(b.pos.z))[0]; if (opp) return clamp(opp.pos.x + rand(-.35, .35), -lim, lim); }\n  if (st.corners && Math.random() < .8) { const g = gapX(p.team, .2); return Math.sign(g || rand(-1, 1)) * Math.max(Math.abs(g), lim * .75); }\n  if (Math.random() < skillOf(p).smart) return gapX(p.team, .5);");
// escolha do golpe pelo estilo
rep(`function chooseAIShot(p, y) {
  const r = Math.random();
  if (y >= 2.1 && r < .8) return 'smash';
  if (oppNearNet(p.team) && r < .55) return 'lob';
  if (oppAllDeep(p.team) && r < .4) return 'curta';
  if (Math.hypot(ball.vel.x, ball.vel.z) > 14) return 'defesa';
  const r2 = Math.random();
  return r2 < .45 ? 'defesa' : r2 < .65 ? 'lob' : r2 < .82 ? 'curta' : 'smash';
}`, `function chooseAIShot(p, y) {
  const st = styleOf(p), r = Math.random();
  if (y >= 2.1 && r < st.high) return 'smash';
  if (y >= 1.45 && y < 2.1 && Math.random() < st.mid) return 'smash'; // drive na meia altura
  if (oppNearNet(p.team) && Math.random() < clamp(.55 * st.w.lob, .12, .9)) return 'lob';
  if (oppAllDeep(p.team) && Math.random() < clamp(.4 * st.w.curta, .1, .85)) return 'curta';
  if (Math.hypot(ball.vel.x, ball.vel.z) > 14) return Math.random() < st.mid * .5 ? 'smash' : 'defesa';
  const w = st.w, tot = w.smash + w.lob + w.curta + w.defesa; let r2 = Math.random() * tot;
  for (const k of ['defesa', 'lob', 'curta', 'smash']) { if ((r2 -= w[k]) <= 0) return k; }
  return 'defesa';
}`);
// saque pelo estilo
rep("  const types = ['smash', 'lob', 'curta', 'defesa']; let r = Math.random();\n  for (let i = 0; i < 4; i++) { if ((r -= w[i]) <= 0) return types[i]; }",
    "  const types = ['smash', 'lob', 'curta', 'defesa']; let r = Math.random();\n  const sw = styleOf(p).serve; const ww = sw ? w.map((v, i) => (v + sw[i]) / 2) : w;\n  for (let i = 0; i < 4; i++) { if ((r -= ww[i]) <= 0) return types[i]; }");
// posição de espera
rep("  if (!dupla()) return [clamp(ball.pos.x * .35, -1.5, 1.5), s * (S.settings.diff === 'dificil' && p.team === 1 ? 4.6 : 5.2)];\n  return [p.slot * 1.9 + clamp(ball.pos.x * .25, -.8, .8), s * 4.6];",
    "  const hz = styleOf(p).home;\n  if (!dupla()) return [clamp(ball.pos.x * .35, -1.5, 1.5), s * clamp((S.settings.diff === 'dificil' && p.team === 1 ? 4.6 : 5.2) + hz, 3.4, 6.4)];\n  return [p.slot * 1.9 + clamp(ball.pos.x * .25, -.8, .8), s * clamp(4.6 + hz, 3.3, 6.2)];");
// força/precisão e lob do estilo nos golpes da CPU
rep("            const r = doHit(p, shot, rand(D.q[0], D.q[1]), false, shot === 'lob' ? { lobPower: oppNearNet(p.team) ? rand(.65, .98) : rand(.3, .95) } : {});",
    "            const st = styleOf(p);\n            const r = doHit(p, shot, rand(D.q[0], D.q[1]), false, Object.assign({ speedMul: st.speed, noiseMul: st.noise }, shot === 'lob' ? { lobPower: st.lobHigh ? rand(.72, 1) : oppNearNet(p.team) ? rand(.65, .98) : rand(.3, .95) } : {}));");
// mostra o estilo no cartão do jogador
rep("' · ' + c.estilo + ' · ' + ({ compacto: 'compacto', forte: 'forte', esguio: 'esguio', atletico: 'atlético' }[c.build] || 'atlético') + (c.canhoto ? ' · canhoto' : ' · destro')",
    "' · ' + c.estilo + ' · joga ' + PLAY_STYLES[playStyleOf(c)].nome.toLowerCase() + ' · ' + ({ compacto: 'compacto', forte: 'forte', esguio: 'esguio', atletico: 'atlético' }[c.build] || 'atlético') + (c.canhoto ? ' · canhoto' : ' · destro')");
// carreira: estilo nos cartões e no próximo jogo
rep("'</b><small>' + c.pais + ' · ' + c.estilo + ' · ' + Math.round(heightOf(c) * 100) + ' cm'", "'</b><small>' + c.pais + ' · ' + (c.id === 'crme' ? c.estilo : 'joga ' + PLAY_STYLES[playStyleOf(c)].nome.toLowerCase()) + ' · ' + Math.round(heightOf(c) * 100) + ' cm'");
rep("    msg = '<p class=\"lede\">' + names[t.round] + ': vocês contra <b>' + crTeamName(opp) + '</b> (OVR ' + crTeamOvr(opp) + '). Sua dupla: OVR ' + crTeamOvr(t.teams[t.me]) + '.</p>';",
    "    const sty = id => PLAY_STYLES[playStyleOf(crChar(id))].nome.toLowerCase();\n    msg = '<p class=\"lede\">' + names[t.round] + ': vocês contra <b>' + crTeamName(opp) + '</b> (OVR ' + crTeamOvr(opp) + '): ' + esc(shortOf(crChar(opp.a))) + ' é ' + sty(opp.a) + ', ' + esc(shortOf(crChar(opp.b))) + ' é ' + sty(opp.b) + '. Sua dupla: OVR ' + crTeamOvr(t.teams[t.me]) + '.</p>';");
fs.writeFileSync(f, s); console.log('ok');
