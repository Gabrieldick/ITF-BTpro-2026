// Gera ponto-de-ouro.html: o jogo inteiro num arquivo só (abre com dois cliques, sem servidor).
// 1) vite build no modo "single" (JS e CSS embutidos); 2) embute os recursos de public/assets em base64.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
execSync('npx vite build --mode single', { cwd: root, stdio: 'inherit' });

const html = fs.readFileSync(path.join(root, 'dist-single', 'index.html'), 'utf8');
const src = fs.readFileSync(path.join(root, 'src', 'assets.ts'), 'utf8');
const files = [...src.matchAll(/'([\w-]+)': '([\w.-]+)'/g)].map(m => [m[1], m[2]]);
const blocks = files.map(([id, file]) => {
  const p = path.join(root, 'public', 'assets', file);
  if (!fs.existsSync(p)) { console.warn('faltando ' + file + ' (o jogo usa o recurso alternativo)'); return ''; }
  return '<script type="application/octet-stream" id="' + id + '">' + fs.readFileSync(p).toString('base64') + '</script>';
}).join('\n');
if (!html.includes('<!--ASSETS-->')) throw new Error('marcador <!--ASSETS--> não encontrado');
// os recursos precisam vir antes do script do jogo, que lê as tags ao iniciar
let out = html.replace('<!--ASSETS-->', '');
out = out.replace('<script type="module"', blocks + '\n<script type="module"');
fs.writeFileSync(path.join(root, 'ponto-de-ouro.html'), out);
console.log('ponto-de-ouro.html: ' + (out.length / 1048576).toFixed(1) + ' MB');
