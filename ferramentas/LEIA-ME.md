# Ferramentas do Ponto de Ouro

Scripts auxiliares usados para montar o jogo. Nenhum deles é necessário para **jogar**.
Os de `modelos/` rodam com Node.js a partir de `ferramentas/modelos`; os de `teste/`, a partir da raiz.

## Como o jogo é montado

O jogo agora é um projeto Vite + TypeScript (veja o README na raiz): o código fica em `../src/`, os recursos em `../public/assets/`.
`npm run build` gera o site e `npm run build:single` gera o `ponto-de-ouro.html` de arquivo único.

## modelos/ — conversão dos modelos baixados

| Arquivo | O que faz |
|---|---|
| `glbread.js` | lê a malha de um arquivo `.glb` |
| `prep.js` | separa as peças dos uniformes (camisa/short/saia) e gera `../public/assets/uniform-m.bin` e `uniform-f.bin` |
| `carolread.js` | lê os arquivos intermediários (`dados/*.bin`) |
| `carolpack.js` | converte a Carol para o esqueleto do jogo (proporções, braços, pesos) → `../public/assets/carol.bin` |
| `simp.js` | simplifica a malha escaneada do jogador masculino (meshoptimizer) |
| `decimate.js` | simplificação antiga por grade (substituída pelo `simp.js`) |
| `malepack.js` | converte o jogador masculino para o esqueleto, corta o tênis e gera a máscara do short → `../public/assets/male.bin` |
| `analyze.js`, `profile.js`, `carolan.js`, `malean.js` | medições (fatias, larguras, alturas) usadas para calibrar os encaixes |
| `dados/` | malhas intermediárias já extraídas dos `.glb` (para reconverter sem abrir o navegador) |

Exemplos:

```
node prep.js "../models/Mens Tennis Uniforms Set1.glb" ../public/assets/uniform-m.bin m
node carolpack.js dados/carol-raw.bin ../public/assets/carol.bin
npm install          (só uma vez, instala o meshoptimizer para o simp.js)
node simp.js dados/masculino-raw.bin dados/masculino-simplificado.bin 40000
node malepack.js dados/masculino-simplificado.bin ../public/assets/male.bin
```

Depois de reconverter qualquer modelo, rode `npm run build` (ou `npm run build:single`) na raiz.

## teste/ — simulação de partidas sem abrir o jogo

- `simular.js` — joga uma partida inteira com um robô no seu lugar e mostra pontos, ralis e motivos de cada ponto.
- `simular-estilos.js` — igual, mas força um estilo de jogo nos adversários (`STY=agressivo`, `paredao`, `tatico`, `rede`, `lobista` ou `completo`).

Eles rodam um pacote especial do jogo (`teste/build/jogo-sim.js`, gerado por `npm run build:sim`). Da raiz: `npm run simular`, ou

```
node ferramentas/teste/simular.js ferramentas/teste/build/jogo-sim.js medio bot dupla
```

## patches/ — histórico das mudanças

Cada `patchNN.js` aplicou um conjunto de mudanças no código-fonte (registro da época do arquivo único em `../legado/`; já estão incorporados no código).
Os arquivos `career*.js`, `career.html`, `career.css`, `rackets-*.js` e `aim.js` são os blocos de código do modo carreira, das raquetes e da mira, do jeito que foram inseridos.

## migracao/ — divisão do arquivo único em módulos

`split.js` lê `../legado/ponto-de-ouro.src.html`, analisa os escopos (acorn + eslint-scope) e gera `src/game/*.ts` com imports/exports, mantendo a ordem de execução original (cada módulo importa o anterior). Foi usado uma vez, na migração para Vite + TypeScript.
