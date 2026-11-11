# Linha do tempo de uma captura: a cada 0,25 s, velocidade para a frente / para a esquerda (m/s), giro (°/s), altura do
# quadril e apoios (E/D). Serve para escolher trechos sem olhar quadro a quadro.
import sys, numpy as np
from mocap import Clip
c = Clip(sys.argv[1]); st = max(1, int(round(c.fps * .25)))
print(sys.argv[1].split('/')[-1], '| %.1f s | %d quadros a %d fps' % (c.n / c.fps, c.n, round(c.fps)))
out = []
for f in range(0, c.n - st, st):
    v = c.vel[f:f + st].mean(0); ct = c.contact[f:f + st].mean(0)
    out.append('%4d f%+.1f l%+.1f g%+4.0f h%.2f %s%s' % (f, v[2], v[0], np.degrees(c.wyaw[f:f + st].mean()), c.P[f:f + st, 0, 1].mean(), 'E' if ct[0] > .5 else '-', 'D' if ct[1] > .5 else '-'))
for i in range(0, len(out), 5): print(' | '.join(out[i:i + 5]))
