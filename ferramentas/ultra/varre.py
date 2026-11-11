# Resumo de várias capturas (uma linha cada): duração, e no miolo (20%–85%) a velocidade média frente/esquerda, o giro e passos
import sys, glob, numpy as np
from mocap import Clip
idx = {}
for l in open('/home/user/una-dinosauria/cmu-mocap/cmu-mocap-index-text.txt', errors='ignore'):
    p = l.strip().split('\t')
    if len(p) >= 2: idx[p[0]] = p[1][:38]
for path in sys.argv[1:]:
    try: c = Clip(path)
    except Exception as e: print(path, 'erro', e); continue
    a, b = int(c.n * .2), int(c.n * .85); v = c.vel[a:b]
    st = [int(np.sum((~c.contact[a:b - 1, s]) & c.contact[a + 1:b, s])) for s in (0, 1)]
    nm = path.split('/')[-1][:-4]
    print('%-7s %-38s %5.1fs  f%+.1f±%.1f  l%+.1f±%.1f  giro %3.0f°/s  h%.2f  passos E%d D%d' % (nm, idx.get(nm, ''), c.n / c.fps, v[:, 2].mean(), v[:, 2].std(), v[:, 0].mean(), v[:, 0].std(), np.degrees(np.abs(c.wyaw[a:b]).mean()), c.P[a:b, 0, 1].mean(), st[0], st[1]))
