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
