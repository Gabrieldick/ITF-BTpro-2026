# Leitura de BVH (conversão cgspeed do banco de captura de movimento da CMU) e cinemática direta.
# Tudo em numpy; ângulos em graus no arquivo, matrizes 3×3 aqui. Eixos do arquivo: Y para cima, Z para a frente do ator.
import numpy as np


def _rot(axis, a):
    c, s = np.cos(a), np.sin(a); z, o = np.zeros_like(a), np.ones_like(a)
    if axis == 'X': m = [[o, z, z], [z, c, -s], [z, s, c]]
    elif axis == 'Y': m = [[c, z, s], [z, o, z], [-s, z, c]]
    else: m = [[c, -s, z], [s, c, z], [z, z, o]]
    return np.stack([np.stack(r, -1) for r in m], -2)


class BVH:
    def __init__(self, path):
        tok = open(path).read().split()
        self.names, self.parent, self.offset, self.chan = [], [], [], []
        stack, i, cur = [], 0, -1
        while tok[i] != 'MOTION':
            t = tok[i]
            if t in ('ROOT', 'JOINT'):
                self.names.append(tok[i + 1]); self.parent.append(cur); self.offset.append(None); self.chan.append([]); cur = len(self.names) - 1; i += 2
            elif t == 'End':
                self.names.append(self.names[cur] + '_End'); self.parent.append(cur); self.offset.append(None); self.chan.append([]); cur = len(self.names) - 1; i += 2
            elif t == '{': stack.append(cur); i += 1
            elif t == '}': stack.pop(); cur = stack[-1] if stack else -1; i += 1
            elif t == 'OFFSET': self.offset[cur] = [float(x) for x in tok[i + 1:i + 4]]; i += 4
            elif t == 'CHANNELS': n = int(tok[i + 1]); self.chan[cur] = tok[i + 2:i + 2 + n]; i += 2 + n
            else: i += 1
        nf = int(tok[i + 2]); self.dt = float(tok[i + 5]); i += 6
        nch = sum(len(c) for c in self.chan)
        self.data = np.array(tok[i:i + nf * nch], dtype=np.float64).reshape(nf, nch)
        self.offset = np.array(self.offset); self.nf = nf
        self.idx = {n: k for k, n in enumerate(self.names)}

    def fk(self, zero=False):
        """posições (F,J,3) e rotações de mundo (F,J,3,3); zero=True: pose de repouso do arquivo (todas as rotações zeradas)"""
        F = 1 if zero else self.nf; J = len(self.names)
        R = np.zeros((F, J, 3, 3)); P = np.zeros((F, J, 3)); c = 0
        for j in range(J):
            loc = np.tile(np.eye(3), (F, 1, 1)); tr = np.tile(self.offset[j], (F, 1))
            for ch in self.chan[j]:
                v = np.zeros(F) if zero else self.data[:, c]; c += 1
                if ch.endswith('position'):
                    if self.parent[j] < 0 and not zero: tr = tr.copy(); tr[:, 'XYZ'.index(ch[0])] = v
                else: loc = loc @ _rot(ch[0], np.radians(v))
            pa = self.parent[j]
            if pa < 0: R[:, j] = loc; P[:, j] = tr
            else: R[:, j] = R[:, pa] @ loc; P[:, j] = P[:, pa] + np.einsum('fij,fj->fi', R[:, pa], tr)
        return P, R
