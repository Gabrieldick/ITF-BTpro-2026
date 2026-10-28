# leitura do MakeHuman (CC0): malha base, alvos de forma, esqueleto e pesos
import json, numpy as np, os
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mh', 'data')  # baixado por baixar.sh
def load_obj():
    V, VT, F = [], [], []
    g = None
    for ln in open(os.path.join(D, '3dobjs/base.obj')):
        if ln.startswith('v '): V.append([float(x) for x in ln.split()[1:4]])
        elif ln.startswith('vt '): VT.append([float(x) for x in ln.split()[1:3]])
        elif ln.startswith('g '): g = ln.split()[1]
        elif ln.startswith('f '):
            vs, ts = [], []
            for t in ln.split()[1:]:
                a = t.split('/'); vs.append(int(a[0]) - 1); ts.append(int(a[1]) - 1 if len(a) > 1 and a[1] else -1)
            F.append((vs, ts, g))
    return np.array(V), np.array(VT), F
def load_target(name):
    p = os.path.join(D, 'targets', name + '.target')
    idx, dl = [], []
    for ln in open(p):
        if ln.startswith('#') or not ln.strip(): continue
        a = ln.split(); idx.append(int(a[0])); dl.append([float(x) for x in a[1:4]])
    return np.array(idx, dtype=int), np.array(dl)
def skel(): return json.load(open(os.path.join(D, 'rigs/default.mhskel')))
def weights(): return json.load(open(os.path.join(D, 'rigs/default_weights.mhw')))['weights']
