// Gera ponto-de-ouro.html a partir de src/ponto-de-ouro.src.html,
// embutindo os modelos 3D (models/) e os sons (Sounds/) para o jogo abrir direto do disco.
// Uso: node build.js
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const src = fs.readFileSync(path.join(dir, 'src', 'ponto-de-ouro.src.html'), 'utf8');
const embeds = [
  ['glb-male', 'models/Soldier.glb'],
  ['glb-female', 'models/Michelle.glb'],
  ['uni-m', 'models/uniform-m.bin'],
  ['uni-f', 'models/uniform-f.bin'],
  ['carol-geo', 'models/carol.bin'],
  ['carol-tex0', 'models/carol-tex0.jpg'],
  ['carol-tex3', 'models/carol-tex3.jpg'],
  ['carol-tex4', 'models/carol-tex4.jpg'],
  ['carol-tex5', 'models/carol-tex5.jpg'],
  ['carol-tex6', 'models/carol-tex6.jpg'],
  ['carol-tex7', 'models/carol-tex7.jpg'],
  ['carol-tex8', 'models/carol-tex8.jpg'],
  ['male-geo', 'models/male.bin'],
  ['male-col', 'models/male-col.jpg'],
  ['snd-hits', 'Sounds/freesound_community-tennis-ball-being-hit-72611.mp3'],
];
const blocks = embeds.map(([id, file]) => {
  const p = path.join(dir, file);
  if (!fs.existsSync(p)) { console.warn('faltando ' + file + ' (o jogo usa o recurso alternativo)'); return ''; }
  return '<script type="application/octet-stream" id="' + id + '">' + fs.readFileSync(p).toString('base64') + '</script>';
}).join('\n');

if (!src.includes('<!--MODELS-->')) throw new Error('marcador <!--MODELS--> não encontrado');
const out = src.replace('<!--MODELS-->', blocks);
fs.writeFileSync(path.join(dir, 'ponto-de-ouro.html'), out);
console.log('ponto-de-ouro.html: ' + (out.length / 1048576).toFixed(1) + ' MB');
