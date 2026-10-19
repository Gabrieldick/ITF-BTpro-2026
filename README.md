# Ponto de Ouro — beach tennis 3D

Jogo de beach tennis 3D feito em HTML + JavaScript com [three.js](https://threejs.org/) (r128). Roda direto no navegador, sem instalar nada.

## Jogar

Abra **`ponto-de-ouro.html`** no navegador (dois cliques). O arquivo já traz embutidos os modelos 3D, as texturas e os sons.

### Modos
- **Partida rápida:** simples ou dupla, escolhendo atletas do circuito (com overall, atributos, altura e estilo de jogo).
- **Campeonato:** chave de 8 duplas (masculino, feminino ou misto) com as duplas reais da temporada ou a sua dupla montada.
- **Carreira:** crie seu jogador e suba do Amador C ao Mundial: ranking de 26 semanas, dinheiro, evolução de atributos, parceiros, equipe técnica, patrocínios, eventos aleatórios e 18 raquetes.

### Controles (teclado)
| Tecla | Ação |
|---|---|
| WASD / setas | correr |
| A/D na hora do golpe | lado da mira |
| W/S na hora do golpe | profundidade (curta ou funda) |
| J (segurar) | smash, com barra de tempo |
| K (segurar) | lob, com barra de força |
| L | curta |
| Espaço | defesa |
| C | 1ª / 3ª pessoa |
| − / = | FOV da 1ª pessoa |
| B / N / V | assistências: seguir a bola / onde a bola cai / mira |
| Esc | pausa |

No celular: joystick e botões na tela.

## Estrutura

| Pasta/arquivo | Conteúdo |
|---|---|
| `src/ponto-de-ouro.src.html` | código-fonte do jogo |
| `build.js` | gera `ponto-de-ouro.html` embutindo modelos, texturas e sons (`node build.js`) |
| `models/` | modelos 3D originais e convertidos (`*.bin`, texturas `*.jpg`) |
| `Sounds/` | sons de batida |
| `ferramentas/` | conversores de modelos, simulador de partidas e histórico de mudanças (veja `ferramentas/LEIA-ME.md`) |
| `.claude/` | servidor local de teste (`serve.js`) e visualizador de modelos |

## Créditos dos recursos

- **three.js** e os modelos **Michelle** e **Soldier** (exemplos do repositório three.js).
- **Carol Tennis Player Girl** — agra_aoe, licença CC BY 4.0 (Sketchfab).
- **Mens/Womens Tennis Uniforms Set1** — modelos gratuitos baixados da internet.
- **Jogador masculino escaneado** — modelo gratuito baixado da internet (autor e licença a confirmar).
- **Sons de batida** — freesound community.

Nomes de atletas são paródias dos jogadores reais do circuito.
