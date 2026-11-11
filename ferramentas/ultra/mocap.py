# Captura de movimento (CMU, BVH cgspeed) → forma canônica usada pelo modo Ultrarrealista.
# Eixos da captura: x = esquerda do ator, y = para cima, z = frente. Tudo sai no "referencial de rumo": a raiz é o ponto do
# chão embaixo do quadril (suavizado) e o eixo z aponta para onde o corpo está virado (rumo suavizado).
import numpy as np
from bvh import BVH

# osso do jogo ← osso da captura
BONES = [('Hips', 'Hips'), ('Spine', 'LowerBack'), ('Spine1', 'Spine'), ('Spine2', 'Spine1'), ('Neck', 'Neck'), ('Head', 'Head'),
         ('LeftShoulder', 'LeftShoulder'), ('LeftArm', 'LeftArm'), ('LeftForeArm', 'LeftForeArm'), ('LeftHand', 'LeftHand'),
         ('RightShoulder', 'RightShoulder'), ('RightArm', 'RightArm'), ('RightForeArm', 'RightForeArm'), ('RightHand', 'RightHand'),
         ('LeftUpLeg', 'LeftUpLeg'), ('LeftLeg', 'LeftLeg'), ('LeftFoot', 'LeftFoot'), ('LeftToeBase', 'LeftToeBase'),
         ('RightUpLeg', 'RightUpLeg'), ('RightLeg', 'RightLeg'), ('RightFoot', 'RightFoot'), ('RightToeBase', 'RightToeBase')]
# direção de cada osso na pose zerada da captura = para o primeiro filho
CHILD = {'Hips': 'LowerBack', 'LowerBack': 'Spine', 'Spine': 'Spine1', 'Spine1': 'Neck', 'Neck': 'Neck1', 'Head': 'Head_End',
         'LeftShoulder': 'LeftArm', 'LeftArm': 'LeftForeArm', 'LeftForeArm': 'LeftHand', 'LeftHand': 'LeftFingerBase',
         'RightShoulder': 'RightArm', 'RightArm': 'RightForeArm', 'RightForeArm': 'RightHand', 'RightHand': 'RightFingerBase',
         'LeftUpLeg': 'LeftLeg', 'LeftLeg': 'LeftFoot', 'LeftFoot': 'LeftToeBase', 'LeftToeBase': 'LeftToeBase_End',
         'RightUpLeg': 'RightLeg', 'RightLeg': 'RightFoot', 'RightFoot': 'RightToeBase', 'RightToeBase': 'RightToeBase_End'}


def m2q(m):
    """matriz de rotação (…,3,3) → quatérnio (…,4) na ordem x, y, z, w"""
    m = np.asarray(m); t = m[..., 0, 0] + m[..., 1, 1] + m[..., 2, 2]
    q = np.zeros(m.shape[:-2] + (4,))
    w = np.sqrt(np.maximum(0, 1 + t)) / 2; x = np.sqrt(np.maximum(0, 1 + m[..., 0, 0] - m[..., 1, 1] - m[..., 2, 2])) / 2
    y = np.sqrt(np.maximum(0, 1 - m[..., 0, 0] + m[..., 1, 1] - m[..., 2, 2])) / 2; z = np.sqrt(np.maximum(0, 1 - m[..., 0, 0] - m[..., 1, 1] + m[..., 2, 2])) / 2
    q[..., 0] = np.copysign(x, m[..., 2, 1] - m[..., 1, 2]); q[..., 1] = np.copysign(y, m[..., 0, 2] - m[..., 2, 0]); q[..., 2] = np.copysign(z, m[..., 1, 0] - m[..., 0, 1]); q[..., 3] = w
    return q


def smooth(x, k):
    """média móvel (janela k quadros, bordas repetidas) ao longo do tempo"""
    if k <= 1: return x
    pad = k // 2; xp = np.concatenate([np.repeat(x[:1], pad, 0), x, np.repeat(x[-1:], pad, 0)], 0)
    c = np.cumsum(np.concatenate([np.zeros_like(xp[:1]), xp], 0), 0)
    return (c[k:] - c[:-k])[:len(x)] / k


def roty(a):
    c, s = np.cos(a), np.sin(a); z, o = np.zeros_like(a), np.ones_like(a)
    return np.stack([np.stack([c, z, s], -1), np.stack([z, o, z], -1), np.stack([-s, z, c], -1)], -2)


class Clip:
    def __init__(self, path, fps=30, head_win=.5, root_win=.6):
        b = BVH(path); P, R = b.fk(); self.b = b
        st = max(1, int(round(1 / b.dt / fps))); self.fps = 1 / (b.dt * st)
        ix = b.idx
        # escala para metros: altura do quadril ao chão na pose de pé ≈ comprimento da perna
        leg = np.linalg.norm(b.offset[ix['LeftLeg']]) + np.linalg.norm(b.offset[ix['LeftFoot']])
        self.leg = leg; self.unit = .92 / (leg * 1.09)  # perna (coxa+canela) de ~0,845 m num adulto de 1,78 m
        P = P * self.unit
        ground = np.percentile(np.minimum(P[:, ix['LeftToeBase'], 1], P[:, ix['RightToeBase'], 1]), 2)
        P[:, :, 1] -= ground
        # rumo: quadril (esq → dir) e ombros, projetados no chão, suavizado
        lr = (P[:, ix['LeftUpLeg']] - P[:, ix['RightUpLeg']]) + .5 * (P[:, ix['LeftArm']] - P[:, ix['RightArm']])
        fw = np.stack([-lr[:, 2], np.zeros(len(lr)), lr[:, 0]], -1)
        fw = smooth(fw, int(head_win / b.dt) | 1); yaw = np.unwrap(np.arctan2(fw[:, 0], fw[:, 2]))
        root = smooth(P[:, 0] * [1, 0, 1], int(root_win / b.dt) | 1)
        Hi = roty(-yaw)                                         # mundo → referencial de rumo
        self.yaw = yaw[::st]; self.root = root[::st]
        Pl = np.einsum('fij,fkj->fki', Hi, P - root[:, None, :])
        Rl = np.einsum('fij,fkjl->fkil', Hi, R)
        self.P = Pl[::st]; self.R = Rl[::st]; self.n = len(self.P); self.ix = ix
        # velocidade da raiz no referencial de rumo (m/s) e giro (rad/s)
        v = np.gradient(root, b.dt, axis=0); self.vel = np.einsum('fij,fj->fi', Hi, v)[::st]; self.wyaw = np.gradient(yaw, b.dt)[::st]
        # apoio dos pés: tornozelo/ponta perto do chão e quase parados no mundo
        self.contact = np.zeros((self.n, 2), bool)
        for s, side in enumerate(('Left', 'Right')):
            toe = P[:, ix[side + 'ToeBase']]; ank = P[:, ix[side + 'Foot']]
            sp = np.linalg.norm(np.gradient(smooth(toe, 5), b.dt, axis=0), axis=1)
            self.contact[:, s] = ((toe[:, 1] < .09) & (sp < 1.1))[::st]
        self.rest_dir = {g: b.offset[ix[CHILD[m]]] / (np.linalg.norm(b.offset[ix[CHILD[m]]]) + 1e-9) for g, m in BONES}

    def quats(self, f0, f1):
        """quatérnios (rumo) dos ossos do jogo, quadros f0..f1 → (F, len(BONES), 4), sem saltos de sinal entre quadros"""
        q = m2q(np.stack([self.R[f0:f1, self.ix[m]] for g, m in BONES], 1))
        for f in range(1, len(q)):
            fl = (q[f] * q[f - 1]).sum(-1) < 0; q[f, fl] *= -1
        return q

    def pts(self, f0, f1):
        """posições (rumo, m): meio do quadril, joelhos e tornozelos"""
        ix = self.ix; names = ['LeftLeg', 'LeftFoot', 'RightLeg', 'RightFoot']
        mid = (self.P[f0:f1, ix['LeftUpLeg']] + self.P[f0:f1, ix['RightUpLeg']]) / 2   # meio das articulações do quadril
        return np.stack([mid] + [self.P[f0:f1, ix[n]] for n in names], 1)
