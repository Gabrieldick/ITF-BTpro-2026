# Folha de pré-visualização de uma captura (boneco de palitos, visto de lado e de frente), para escolher trechos.
# uso: python previa.py <arquivo.bvh> <saida.jpg> [quadro inicial] [quadro final] [quantos]
import sys, numpy as np
from PIL import Image, ImageDraw
from bvh import BVH
b = BVH(sys.argv[1]); out = sys.argv[2]
P, R = b.fk()
f0 = int(sys.argv[3]) if len(sys.argv) > 3 else 0; f1 = int(sys.argv[4]) if len(sys.argv) > 4 else b.nf - 1; n = int(sys.argv[5]) if len(sys.argv) > 5 else 24
fr = np.linspace(f0, min(f1, b.nf - 1), n).astype(int)
h = P[0, b.idx['Head'], 1] - min(P[0, b.idx['LeftFoot'], 1], P[0, b.idx['RightFoot'], 1])
print('quadros', b.nf, 'fps', round(1 / b.dt), 'altura(un.)', round(h, 2), 'duração %.1fs' % (b.nf * b.dt))
S = 150; W = Image.new('RGB', (S * 12, S * 2 * ((n + 11) // 12)), 'white'); d = ImageDraw.Draw(W)
ground = min(P[:, b.idx['LeftToeBase'], 1].min(), P[:, b.idx['RightToeBase'], 1].min())
for k, f in enumerate(fr):
    hip = P[f, 0]
    # rumo do corpo: do quadril (esquerda → direita), para olhar sempre de lado e de frente
    lr = P[f, b.idx['RightUpLeg']] - P[f, b.idx['LeftUpLeg']]; lr[1] = 0; lr /= np.linalg.norm(lr) + 1e-9; fw = np.array([-lr[2], 0, lr[0]])
    for view in (0, 1):
        ox = (k % 12) * S + S / 2; oy = (k // 12) * 2 * S + view * S + S * .93; sc = S * .8 / (h * 1.25)
        ax = fw if view == 0 else lr
        def pr(p): q = p - hip; return (ox + (q @ ax) * sc, oy - (p[1] - ground) * sc)
        d.line([(ox - S * .45, oy), (ox + S * .45, oy)], fill=(200, 200, 200))
        for j in range(len(b.names)):
            pa = b.parent[j]
            if pa < 0: continue
            nm = b.names[j]; col = (200, 40, 40) if nm.startswith('Right') or nm.startswith('R') and not nm.startswith('Ro') else (40, 60, 200) if nm.startswith('L') and nm != 'LowerBack' else (30, 30, 30)
            d.line([pr(P[f, pa]), pr(P[f, j])], fill=col, width=2)
        if view == 0: d.text((ox - S * .45, oy - S * .9), str(f), fill=(0, 0, 0))
W.save(out, quality=85)
