import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// "npm run build" gera o site (dist/) com os recursos em arquivos, para o GitHub Pages.
// "npm run build:single" usa o modo "single": tudo num HTML só, que abre com dois cliques.
export default defineConfig(({ mode }) => mode === 'single'
  ? {
    base: './',
    plugins: [viteSingleFile()],
    build: { outDir: 'dist-single', copyPublicDir: false, chunkSizeWarningLimit: 4000 },
  }
  : {
    base: './',
    build: { outDir: 'dist', chunkSizeWarningLimit: 4000 },
  });
