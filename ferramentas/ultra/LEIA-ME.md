# Recursos do modo Ultrarrealista

Os arquivos de `public/assets/ultra/` são gerados por estes scripts a partir de material de uso livre:

| Saída | Origem | Licença |
|---|---|---|
| `sky.jpg`, `env.hdr`, `ceu.json` | HDRI "Kloofendal 48d Partly Cloudy (Pure Sky)", Poly Haven | CC0 |
| `areia-n.jpg`, `areia-d.jpg` | textura "Sand 01", Poly Haven | CC0 |
| `praia-n.jpg` | textura "Aerial Beach 01", Poly Haven | CC0 |

```
python ceu.py   <hdri 8k .hdr>            ../../public/assets/ultra
python areia.py <pasta com os jpg 2k>     ../../public/assets/ultra
```

Precisam de `numpy` e `opencv-python-headless` (cabem no mesmo ambiente do Blender em `../modelos-mh/blend`).

## Captura de movimento (deslocamento dos jogadores)

`mocap.json` e `mocap.bin` vêm do banco de captura de movimento da Carnegie Mellon (CMU Graphics Lab Motion Capture
Database, uso livre, inclusive em produtos; só não pode revender os dados), na conversão para BVH de B. Hahne (cgspeed).

> The data used in this project was obtained from mocap.cs.cmu.edu. The database was created with funding from NSF EIA-0196217.

| Script | O que faz |
|---|---|
| `bvh.py` | lê um BVH e calcula posições e rotações de cada osso |
| `mocap.py` | põe a captura no referencial de rumo (raiz no chão, corpo olhando para a frente), mede velocidade e apoios dos pés |
| `varre.py`, `analisa.py`, `picos.py`, `previa.py` | ajudam a escolher capturas e trechos (resumo, linha do tempo, gestos, boneco de palitos) |
| `converte.py` | acha os ciclos (caminhada, trote, corrida, passo lateral, recuo), fecha o laço e grava os arquivos do jogo |

```
python converte.py <pasta data/ do banco em BVH> ../../public/assets/ultra
```

No jogo, `src/game/25-mocap.ts` aplica a pose da captura no esqueleto do jogador (quadril, coluna, pernas e pés),
misturando os ciclos pela velocidade e direção; a posição do jogador continua vindo da jogabilidade.
