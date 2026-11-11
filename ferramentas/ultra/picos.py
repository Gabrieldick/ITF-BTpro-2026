# Lista os gestos de uma captura: picos de velocidade de uma mão (em m/s, relativa ao quadril)
# uso: python picos.py <arquivo.bvh> [Right|Left]
import sys, numpy as np
from bvh import BVH
b = BVH(sys.argv[1]); side = sys.argv[2] if len(sys.argv) > 2 else 'Right'
P, R = b.fk(); sc = 1.75 / (P[0, b.idx['Head'], 1] - P[0, b.idx['LeftToeBase'], 1] + 1e-9) * .93
h = (P[:, b.idx[side + 'Hand']] - P[:, 0]) * sc
v = np.linalg.norm(np.gradient(h, b.dt, axis=0), axis=1); k = max(1, int(.05 / b.dt)); v = np.convolve(v, np.ones(k) / k, 'same')
pk = [i for i in range(k, len(v) - k) if v[i] == v[max(0, i - 40):i + 41].max() and v[i] > 4]
print(sys.argv[1].split('/')[-1], 'fps', round(1 / b.dt), 'quadros', b.nf, '| picos:', ', '.join('%d (%.1f m/s, mão a %.2f m)' % (i, v[i], (P[i, b.idx[side + 'Hand'], 1] - P[:, b.idx['LeftToeBase'], 1].min()) * sc) for i in pk))
