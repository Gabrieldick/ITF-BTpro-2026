const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };

// alturas estimadas (cm); podem ser corrigidas no cartão de cada personagem
const H = { spot: 186, gianote: 190, barao: 188, capeletti: 183, gigio: 180, lock: 185, burmak: 193, carlo: 187, santana: 182, ramires: 180, rodrigo: 184, fonte: 178, toledo: 179,
  kudina: 178, semena: 174, marquezin: 170, chou: 168, gaspar: 175, valentim: 166, casadi: 176, grael: 170, dias: 162, miler: 173, cimadi: 168, daino: 172, tripa: 169, vida: 171, justi: 170, nobre: 173, nogueiro: 167, damata: 174, peracine: 166, pereira: 165, alves: 164 };
s = s.replace(/\{ id: '(\w+)', name: '([^']+)', pais:/g, (m, id, name) => H[id] ? "{ id: '" + id + "', name: '" + name + "', alt: " + H[id] + ", pais:" : m);

rep("const nameOf = c =>", `let HEIGHTS = {};
try { HEIGHTS = JSON.parse(localStorage.getItem('pdo-heights') || '{}') || {}; } catch (e) { HEIGHTS = {}; }
const heightOf = c => clamp(+(HEIGHTS[c.id] || c.alt || (c.fem ? 170 : 183)), 150, 215) / 100;
// fator de altura: >0 baixo (mais ágil em bola baixa), <0 alto (alcança mais em cima)
const shortK = p => clamp((1.82 - (p.height || 1.85)) / .2, -1, 1);
const hScale = p => (p.height || 1.87) / 1.87;
const nameOf = c =>`);
// altura muda o tamanho do jogador
rep("    p.name = nameOf(c);", "    p.name = nameOf(c);\n    p.height = heightOf(c); p.model.group.scale.setScalar(hScale(p)); if (p.skin) p.skin.holder.scale.setScalar(hScale(p));");
// alcance: mais alto pega bola mais alta; mais baixo alcança melhor bola baixa
rep("  const maxY = type === 'smash' ? 3.0 : 2.6;", "  const maxY = (type === 'smash' ? 3.0 : 2.6) * hScale(p);\n  if (ball.pos.y < .8) scale = (scale || 1) * (1 + .14 * shortK(p));");
rep("  return _sh.distanceTo(ball.pos) <= 1.08;", "  return _sh.distanceTo(ball.pos) <= 1.08 * hScale(p);");
rep("    if (side && pos.y >= 1.75 && pos.distanceTo(_ts) <= .95) return t;", "    if (side && pos.y >= 1.75 && pos.distanceTo(_ts) <= .95 * hScale(p)) return t;");
rep("    if (pos.z * sgn < .3 || pos.y < .5 || pos.y > 2.6) continue;", "    if (pos.z * sgn < .3 || pos.y < .5 - .12 * shortK(p) || pos.y > 2.6 * hScale(p)) continue;");
// curta e bola baixa: baixos tocam melhor
rep("  q *= lerp(.86, 1.06, attrK(p, ATTR_OF[type] || 'def'));", "  q *= lerp(.86, 1.06, attrK(p, ATTR_OF[type] || 'def'));\n  if (type === 'curta' || ball.pos.y < .8) q *= 1 + .07 * shortK(p);");
// agilidade: mais baixos saem um pouco mais rápido, ainda mais atrás de bola baixa
rep("  const spd = P_SPEED * lerp(.82, 1.12, attrK(p, 'vel')) * (p.charging ? .75 : 1);",
    "  const lowBall = ball.state === 'live' && S.lastTeam === 1 && humanPlan.plan && humanPlan.id === S.hitId && humanPlan.plan.pt.y < 1;\n  const spd = P_SPEED * lerp(.82, 1.12, attrK(p, 'vel')) * (1 + shortK(p) * (lowBall ? .1 : .03)) * (p.charging ? .75 : 1);");
rep("  moveToward(p, tx, tz, D.speed, dt);", "  const lowB = p.ai.plan && p.ai.planId === S.hitId && p.ai.plan.pt.y < 1;\n  moveToward(p, tx, tz, D.speed * (1 + shortK(p) * (lowB ? .1 : .03)), dt);");
// câmera e etiqueta acompanham a altura
rep("    camPos.set(human.pos.x, human.model.hips.position.y + .78 + bob + human.model.group.position.y * .8, human.pos.z + .05);",
    "    camPos.set(human.pos.x, (human.model.hips.position.y + .78) * hScale(human) + bob + human.model.group.position.y * .8, human.pos.z + .05);");
rep("    _tv.set(p.pos.x, 2.12 + p.model.group.position.y, p.pos.z).project(camera);", "    _tv.set(p.pos.x, 2.12 * hScale(p) + p.model.group.position.y, p.pos.z).project(camera);");
// cartão: altura editável
rep(".pick .meta { font-size: 12px; color: #5b6b78; margin-top: 2px; }", `.pick .meta { font-size: 12px; color: #5b6b78; margin-top: 2px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.palt { width: 58px; font: 600 12px var(--f-num); border: 1px solid #d9cfba; border-radius: 6px; padding: 1px 4px; background: #fff; color: var(--ink); }`);
rep("<div class=\"meta\">' + c.pais + ' · ' + c.estilo + (c.fem ? ' · feminino' : ' · masculino') + '</div></div>'",
    "<div class=\"meta\"><span>' + c.pais + ' · ' + c.estilo + (c.fem ? ' · feminino' : ' · masculino') + '</span><label>Altura <input class=\"palt\" type=\"number\" min=\"150\" max=\"215\" id=\"alt-' + slot + '\" value=\"' + Math.round(heightOf(c) * 100) + '\"> cm</label></div></div>'");
rep("  inp.addEventListener('change', renderRoster);", `  inp.addEventListener('change', renderRoster);
  const ai = box.querySelector('.palt');
  ai.addEventListener('change', () => { const v = clamp(Math.round(+ai.value || 0), 150, 215); ai.value = v; HEIGHTS[c.id] = v; try { localStorage.setItem('pdo-heights', JSON.stringify(HEIGHTS)); } catch (e) {} });`);
// teclas digitadas na altura não podem mover o jogador
rep("  if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'text') return;", "  if (e.target && e.target.tagName === 'INPUT' && (e.target.type === 'text' || e.target.type === 'number')) return;");
fs.writeFileSync(f, s);
console.log('ok', (s.match(/alt: \d+/g) || []).length);
