# Ferramentas do Ponto de Ouro

Scripts auxiliares usados para montar o jogo. Nenhum deles é necessário para **jogar**: o jogo é só o `ponto-de-ouro.html` na pasta acima.
Todos rodam com Node.js (`node arquivo.js ...`), a partir desta pasta.

## Como o jogo é montado

- `../src/ponto-de-ouro.src.html` — o código-fonte do jogo (HTML + JavaScript + Three.js).
- `../build.js` — junta o código-fonte com os modelos 3D, texturas e sons (embutidos em base64) e gera `../ponto-de-ouro.html`.

```
node ../build.js
```

## modelos/ — conversão dos modelos baixados

| Arquivo | O que faz |
|---|---|
| `glbread.js` | lê a malha de um arquivo `.glb` |
| `prep.js` | separa as peças dos uniformes (camisa/short/saia) e gera `../models/uniform-m.bin` e `uniform-f.bin` |
| `carolread.js` | lê os arquivos intermediários (`dados/*.bin`) |
| `carolpack.js` | converte a Carol para o esqueleto do jogo (proporções, braços, pesos) → `../models/carol.bin` |
| `simp.js` | simplifica a malha escaneada do jogador masculino (meshoptimizer) |
| `decimate.js` | simplificação antiga por grade (substituída pelo `simp.js`) |
| `malepack.js` | converte o jogador masculino para o esqueleto, corta o tênis e gera a máscara do short → `../models/male.bin` |
| `analyze.js`, `profile.js`, `carolan.js`, `malean.js` | medições (fatias, larguras, alturas) usadas para calibrar os encaixes |
| `dados/` | malhas intermediárias já extraídas dos `.glb` (para reconverter sem abrir o navegador) |

Exemplos:

```
node prep.js "../models/Mens Tennis Uniforms Set1.glb" ../models/uniform-m.bin m
node carolpack.js dados/carol-raw.bin ../models/carol.bin
npm install          (só uma vez, instala o meshoptimizer para o simp.js)
node simp.js dados/masculino-raw.bin dados/masculino-simplificado.bin 40000
node malepack.js dados/masculino-simplificado.bin ../models/male.bin
```

Depois de reconverter qualquer modelo, rode `node ../build.js`.

## teste/ — simulação de partidas sem abrir o jogo

- `simular.js` — joga uma partida inteira com um robô no seu lugar e mostra pontos, ralis e motivos de cada ponto.
- `simular-estilos.js` — igual, mas força um estilo de jogo nos adversários (`STY=agressivo`, `paredao`, `tatico`, `rede`, `lobista`, `completo`).

```
node teste/simular.js ../src/ponto-de-ouro.src.html medio bot dupla
```

## patches/ — histórico das mudanças

Cada `patchNN.js` aplicou um conjunto de mudanças no código-fonte (ficam como registro; não precisam ser rodados de novo, já estão no `src`).
Os arquivos `career*.js`, `career.html`, `career.css`, `rackets-*.js` e `aim.js` são os blocos de código do modo carreira, das raquetes e da mira, do jeito que foram inseridos.
