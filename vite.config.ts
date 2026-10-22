import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// @ts-ignore (sem os tipos do Node no projeto)
import { execSync } from 'node:child_process';
import pkg from './package.json';

// versão do jogo mostrada no menu: número do package.json + commit + data do build
const sh = c => { try { return execSync(c, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { return ''; } };
const define = { __APP_VER__: JSON.stringify(pkg.version), __APP_BUILD__: JSON.stringify(sh('git rev-parse --short HEAD')), __APP_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)) };

// "npm run build" gera o site (dist/) com os recursos em arquivos, para o GitHub Pages.
// "npm run build:single" usa o modo "single": tudo num HTML só, que abre com dois cliques.
export default defineConfig(({ mode }) => mode === 'single'
  ? {
    base: './', define,
    plugins: [viteSingleFile()],
    build: { outDir: 'dist-single', copyPublicDir: false, chunkSizeWarningLimit: 4000 },
  }
  : {
    base: './', define,
    build: { outDir: 'dist', chunkSizeWarningLimit: 4000 },
  });
