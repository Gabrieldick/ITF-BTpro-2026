import { defineConfig } from 'vite';

// Pacote só para o simulador de partidas (ferramentas/teste): o jogo num script único,
// com o three.js de fora (o simulador fornece uma versão falsa, sem gráficos), rodando no Node.
export default defineConfig({
  build: {
    outDir: 'ferramentas/teste/build',
    emptyOutDir: true,
    copyPublicDir: false,
    minify: false,
    lib: { entry: 'src/sim-entry.ts', formats: ['iife'], name: 'PontoDeOuro', fileName: () => 'jogo-sim.js' },
    rollupOptions: {
      external: ['three', 'three/examples/jsm/loaders/GLTFLoader.js', 'three/examples/jsm/utils/SkeletonUtils.js'],
      output: {
        inlineDynamicImports: true,
        interop: 'esModule', // usa o three.js falso do simulador direto, sem copiar as propriedades
        globals: { three: 'THREE', 'three/examples/jsm/loaders/GLTFLoader.js': 'THREE_GLTF', 'three/examples/jsm/utils/SkeletonUtils.js': 'THREE_SKEL' },
      },
    },
  },
});
