# ITF-BT Pro 2026 — beach tennis 3D

Jogo de beach tennis 3D feito com [three.js](https://threejs.org/), TypeScript e [Vite](https://vitejs.dev/). Roda no navegador, no computador e no celular.

**Jogar online:** https://gabrieldick.github.io/ITF-BTpro-2026/

**Jogar sem internet:** abra `ponto-de-ouro.html` (dois cliques). É o jogo inteiro num arquivo só, com modelos, texturas e sons embutidos.

## Modos
- **Partida rápida:** simples ou dupla, escolhendo atletas do circuito (overall, atributos, altura e estilo de jogo).
- **Campeonato:** chave de 8 duplas (masculino, feminino ou misto) com as duplas reais da temporada ou a sua dupla montada.
- **Treino:** desafios com lançador (curtas no verde, defenda os smashes, smash perfeito).
- **Online:** jogue com um amigo pela internet, em dupla contra a CPU ou um contra o outro (veja abaixo).
- **Carreira:** crie seu jogador e suba do Amador C ao Mundial — ~3.800 atletas fictícios + astros reais, ranking de 26 semanas, dinheiro, evolução de atributos, parceiros, equipe técnica, patrocínios, eventos aleatórios e 18 raquetes.

## Jogar online com um amigo

Não precisa de conta nem de servidor: os dois navegadores se conectam direto (WebRTC, pela biblioteca [PeerJS](https://peerjs.com/); o servidor público gratuito do PeerJS só apresenta um navegador ao outro).

1. Um de vocês abre o jogo, ajusta no menu os jogadores e a dificuldade e clica em **Online → Criar sala**. Aparece um código de 5 letras (e o botão **Copiar link**).
2. O outro abre o jogo, clica em **Online**, digita o código e clica em **Entrar na sala** (ou só abre o link copiado).
3. Quem criou a sala escolhe o modo e clica em **Começar partida**:
   - **Dupla:** vocês dois no mesmo time contra a CPU (quem entrou joga como a dupla de quem criou).
   - **Simples · 1 contra 1:** um contra o outro. Cada um vê a própria quadra do lado de baixo.
4. Quem entrou joga com o personagem marcado como **Você** no menu dele (se não for repetido). Os controles são os mesmos do jogo normal.

Como funciona: quem cria a sala roda a partida inteira (física, CPU e placar), como no jogo normal; o outro manda só as teclas apertadas e recebe o estado da partida cerca de 30 vezes por segundo. No fim da partida, **Jogar de novo** (de quem criou) começa outra; **Menu** volta para a sala. Se a conexão cair, os dois voltam para a tela do online com um aviso; a sala de quem criou continua aberta com o mesmo código.

Limites do protótipo:
- A latência pesa para quem entrou: ele vê a bola um pouco atrasada (o chip *Online · NN ms* no canto mostra o tempo de ida e volta). O jogo desconta esse atraso nas barras de força e no tempo do golpe, mas com mais de ~150 ms fica mais difícil.
- A partida não pausa (Esc só abre o menu por cima). Se quem criou a sala trocar de aba ou minimizar, a partida congela para os dois.
- Alguns roteadores e redes de empresa/universidade bloqueiam a conexão direta (não há servidor TURN). Se não conectar, tente outra rede (por exemplo, o 4G do celular).
- Só duas pessoas por sala (2 contra 2 com quatro humanos ainda não existe).

Para testar sozinho, abra o jogo em duas janelas lado a lado (abas escondidas param a animação do navegador).

## Saves da carreira

O jogo guarda várias carreiras no navegador (Carreira → **Carreiras**). Para levar uma carreira para outro computador ou celular:

1. Na carreira, clique em **Exportar save** — baixa `carreira-<nome>.json`.
2. Coloque o arquivo na pasta [`saves/`](saves/) e faça o push (ou suba pelo site do GitHub: *Add file → Upload files*).
3. No outro lugar, abra o jogo e use **Carreira → Carreiras → Carregar do GitHub**. Sem internet, use **Importar arquivo**.

## Controles (teclado)
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
| B / N / V | assistências: seguir a bola / onde a bola cai / flecha de mira |
| F | mostra o contador de FPS e a resolução |
| L ou Espaço numa bola baixa fora do alcance | mergulho |
| Esc | pausa |

No celular: joystick e botões na tela.

## Desenvolvimento

Precisa do [Node.js](https://nodejs.org/) 20 ou mais novo.

```
npm install
npm run dev            # servidor local com recarga automática
npm run build          # site em dist/ (o que vai para o GitHub Pages)
npm run build:single   # ponto-de-ouro.html, o jogo num arquivo só
npm run typecheck      # verificação do TypeScript
npm run simular        # joga uma partida simulada no Node e mostra as estatísticas
```

A cada push na `main`, o GitHub Actions compila e publica o site (`.github/workflows/pages.yml`).

## Estrutura

| Pasta/arquivo | Conteúdo |
|---|---|
| `index.html` | página do jogo (menus e telas) |
| `src/main.ts` | entrada: carrega os recursos e inicia o jogo |
| `src/assets.ts` | lista e carregamento de modelos, texturas e som |
| `src/state.ts` | estado compartilhado entre módulos |
| `src/styles.css` | estilos da interface |
| `src/game/` | o jogo em módulos, na ordem de execução: base, estado, render, cenário, poses, atletas, modelos, áudio, interface, física, mira, controles, campeonato, carreira, IA, bola, animação, laço principal e modo online (`20-online.ts`) |
| `public/assets/` | recursos usados pelo jogo (modelos convertidos, texturas, som) |
| `models/`, `Sounds/` | arquivos originais baixados (fonte dos recursos) |
| `saves/` | saves de carreira exportados (o jogo lê esta pasta pelo GitHub) |
| `ferramentas/` | conversores de modelos, simulador de partidas e histórico das mudanças (veja `ferramentas/LEIA-ME.md`) |
| `scripts/build-single.mjs` | gera o HTML de arquivo único |
| `legado/` | a versão antiga em arquivo único (antes da divisão em módulos) |

Os módulos em `src/game/` ainda têm `// @ts-nocheck`: compilam como TypeScript, mas a tipagem estrita vai ser ligada aos poucos, módulo por módulo.

## Créditos dos recursos

- **three.js** e os modelos **Michelle** e **Soldier** (exemplos do repositório three.js).
- **Carol Tennis Player Girl** — agra_aoe, licença CC BY 4.0 (Sketchfab).
- **Mens/Womens Tennis Uniforms Set1** — modelos gratuitos baixados da internet.
- **Jogador masculino escaneado** — modelo gratuito baixado da internet (autor e licença a confirmar).
- **Sons de batida** — freesound community.

Nomes de atletas são paródias dos jogadores reais do circuito.
