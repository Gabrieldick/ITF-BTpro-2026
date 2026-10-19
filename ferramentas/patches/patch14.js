const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const a = s.indexOf('const ROSTER = [');
const b = s.indexOf('];\nconst overall', a);
if (a < 0 || b < 0) throw new Error('roster not found');
const roster = `const ROSTER = [
  { id: 'spot',     name: 'Matheus Spot',     pais: 'ITA', estilo: 'Completo e agressivo', a: { forca: 90, vel: 90, def: 92, curta: 90, lob: 90, smash: 94, saque: 90 }, look: { skin: '#d6a47c', hair: '#2b1d14', cap: '#fbf6ea', glasses: true, band: true, num: '1', racket: 'proteo' } },
  { id: 'burmak',   name: 'Nikolai Burmak',   pais: 'RUS', estilo: 'Força bruta',          a: { forca: 95, vel: 82, def: 82, curta: 76, lob: 80, smash: 95, saque: 90 }, look: { skin: '#efc6a3', hair: '#7a5a3a', visor: '#17324d', glasses: true, band: true, num: '2', racket: 'kronos' } },
  { id: 'capeletti',name: 'Miguel Capeletti', pais: 'ITA', estilo: 'Tático',               a: { forca: 84, vel: 80, def: 90, curta: 88, lob: 90, smash: 86, saque: 85 }, look: { skin: '#d8a47e', hair: '#1b120c', cap: '#17324d', glasses: true, num: '3', racket: 'medusa' } },
  { id: 'carlo',    name: 'Lucas Carlo',      pais: 'ITA', estilo: 'Smash e saque',        a: { forca: 88, vel: 84, def: 84, curta: 80, lob: 82, smash: 90, saque: 89 }, look: { skin: '#e2b48f', hair: '#3a2615', glasses: true, band: true, num: '4', racket: 'supercarbon' } },
  { id: 'giovanetti',name: 'Tomás Giovanetti', pais: 'ITA', estilo: 'Potência',            a: { forca: 90, vel: 86, def: 82, curta: 78, lob: 80, smash: 91, saque: 88 }, look: { skin: '#c99068', hair: '#2a1a0e', cap: '#fbf6ea', glasses: false, num: '5', racket: 'kronos' } },
  { id: 'barao',    name: 'André Barão',      pais: 'BRA', estilo: 'Agressivo',            a: { forca: 88, vel: 84, def: 85, curta: 82, lob: 84, smash: 89, saque: 86 }, look: { skin: '#b07a52', hair: '#120c08', glasses: true, band: true, num: '6', racket: 'proteo' } },
  { id: 'santana',  name: 'Tales Santana',    pais: 'BRA', estilo: 'Defesa sólida',        a: { forca: 82, vel: 88, def: 89, curta: 84, lob: 85, smash: 84, saque: 82 }, look: { skin: '#8d5a3b', hair: '#120c08', visor: '#fbf6ea', glasses: false, num: '7', racket: 'medusa' } },
  { id: 'ramires',  name: 'Antonio Ramires',  pais: 'ESP', estilo: 'Variado',              a: { forca: 85, vel: 86, def: 84, curta: 87, lob: 82, smash: 86, saque: 84 }, look: { skin: '#c68a5e', hair: '#1b120c', cap: '#0b7a83', glasses: true, num: '8', racket: 'supercarbon' } },
  { id: 'rodrigo',  name: 'Gerardo Rodrigo',  pais: 'ESP', estilo: 'Consistente',          a: { forca: 83, vel: 84, def: 86, curta: 84, lob: 85, smash: 84, saque: 83 }, look: { skin: '#d2a07a', hair: '#3a2615', glasses: false, band: true, num: '9', racket: 'kronos' } },
  { id: 'fonte',    name: 'Vinícius Fonte',   pais: 'BRA', estilo: 'Velocidade',           a: { forca: 80, vel: 90, def: 84, curta: 82, lob: 82, smash: 83, saque: 80 }, look: { skin: '#a8704a', hair: '#1b120c', cap: '#ff5a1f', glasses: true, num: '10', racket: 'proteo' } },
  { id: 'toledo',   name: 'Bruno Toledo',     pais: 'BRA', estilo: 'Promessa',             a: { forca: 70, vel: 74, def: 62, curta: 60, lob: 64, smash: 66, saque: 64 }, look: { skin: '#b07a52', hair: '#2a1a0e', num: '18', racket: 'proteo' } },
  { id: 'gaspar',   name: 'Júlia Gaspar',     pais: 'ITA', estilo: 'Completa',             fem: true, a: { forca: 86, vel: 90, def: 92, curta: 90, lob: 90, smash: 90, saque: 86 }, look: { skin: '#e2b48f', hair: '#6a3f1d', visor: '#fbf6ea', glasses: true, tank: true, num: '11', racket: 'medusa' } },
  { id: 'nobre',    name: 'Nicole Nobre',     pais: 'ITA', estilo: 'Toque e lob',          fem: true, a: { forca: 82, vel: 88, def: 90, curta: 89, lob: 91, smash: 85, saque: 85 }, look: { skin: '#efc6a3', hair: '#a8743a', cap: '#fbf6ea', glasses: false, tank: true, num: '12', racket: 'supercarbon' } },
  { id: 'miler',    name: 'Rafaela Miler',    pais: 'BRA', estilo: 'Potente',              fem: true, a: { forca: 88, vel: 86, def: 87, curta: 84, lob: 85, smash: 89, saque: 87 }, look: { skin: '#d8a47e', hair: '#2b1d14', visor: '#17324d', glasses: true, tank: true, num: '13', racket: 'kronos' } },
  { id: 'valentim', name: 'Nina Valentim',    pais: 'ITA', estilo: 'Defesa',               fem: true, a: { forca: 80, vel: 87, def: 90, curta: 86, lob: 88, smash: 83, saque: 82 }, look: { skin: '#e2b48f', hair: '#3a2615', visor: '#ff5a1f', glasses: false, tank: true, num: '14', racket: 'proteo' } },
  { id: 'cimadi',   name: 'Sofia Cimadi',     pais: 'ITA', estilo: 'Rápida',               fem: true, a: { forca: 80, vel: 90, def: 86, curta: 86, lob: 85, smash: 83, saque: 81 }, look: { skin: '#d6a47c', hair: '#5a3a1e', cap: '#17324d', glasses: true, tank: true, num: '15', racket: 'medusa' } },
  { id: 'dias',     name: 'Paty Dias',        pais: 'VEN', estilo: 'Curta e rede',         fem: true, a: { forca: 79, vel: 88, def: 87, curta: 90, lob: 84, smash: 82, saque: 80 }, look: { skin: '#b07a52', hair: '#1b120c', visor: '#fbf6ea', glasses: true, tank: true, num: '16', racket: 'supercarbon' } },
  { id: 'daino',    name: 'Flávia Daino',     pais: 'ITA', estilo: 'Regular',              fem: true, a: { forca: 81, vel: 84, def: 86, curta: 84, lob: 86, smash: 83, saque: 82 }, look: { skin: '#efc6a3', hair: '#6a3f1d', cap: '#0b7a83', glasses: false, tank: true, num: '17', racket: 'kronos' } },
  { id: 'cortes',   name: 'Joana Cortês',     pais: 'BRA', estilo: 'Experiente',           fem: true, a: { forca: 80, vel: 83, def: 85, curta: 87, lob: 86, smash: 81, saque: 81 }, look: { skin: '#c68a5e', hair: '#2b1d14', visor: '#17324d', glasses: true, tank: true, num: '19', racket: 'medusa' } },
  { id: 'alves',    name: 'Bia Alves',        pais: 'BRA', estilo: 'Iniciante',            fem: true, a: { forca: 58, vel: 66, def: 60, curta: 58, lob: 62, smash: 56, saque: 58 }, look: { skin: '#8d5a3b', hair: '#120c08', visor: '#fbf6ea', tank: true, num: '20', racket: 'supercarbon' } },
`;
s = s.slice(0, a) + roster + s.slice(b);
const def = "{ me: 'spot', mate: 'gaspar', o1: 'burmak', o2: 'nobre' }";
s = s.split("{ me: 'luca', mate: 'giulia', o1: 'diego', o2: 'marina' }").join(def);
// ids salvos de versões antigas que não existem mais voltam ao padrão
s = s.replace("  S.settings.pick = Object.assign(" + def + ", savedSettings.pick || {});",
  "  S.settings.pick = Object.assign(" + def + ", savedSettings.pick || {});\n  const dflt = " + def + ";\n  for (const k in S.settings.pick) if (!ROSTER.some(c => c.id === S.settings.pick[k])) S.settings.pick[k] = dflt[k];");
s = s.replace('elenco fictício inspirado em estilos de jogo do circuito; nomes podem ser trocados no menu', 'elenco com nomes que lembram jogadores do circuito; atributos são estimativas do jogo e os nomes podem ser trocados no menu');
fs.writeFileSync(f, s);
console.log('ok', (s.match(/me: 'spot'/g) || []).length);
