# Converte capturas de movimento da CMU (uso livre) para o arquivo do modo Ultrarrealista:
#   public/assets/ultra/mocap.json  (lista dos trechos, ossos, direções de repouso)
#   public/assets/ultra/mocap.bin   (Int16: por quadro, 22 quatérnios + 5 pontos + apoios dos pés)
# uso: python converte.py <pasta data/ do banco CMU em BVH> <pasta de saída>
# Referencial de saída = o do boneco do jogo: x para a direita, y para cima, z para trás (o corpo olha para −z).
import sys, json, numpy as np
from mocap import Clip, BONES, smooth

D, OUT = sys.argv[1], sys.argv[2]
NB = len(BONES); REC = NB * 4 + 15 + 1
LS = [i for i, (g, m) in enumerate(BONES) if g.startswith('Left')]; RS = [i for i, (g, m) in enumerate(BONES) if g.startswith('Right')]


def load(code): return Clip('%s/%s/%s.bvh' % (D, code.split('_')[0].zfill(3), code))


def strikes(c, s, f0, f1):
    """quadros em que o pé s (0 esq, 1 dir) encosta no chão"""
    ct = c.contact[:, s]; return [f for f in range(max(1, f0), f1) if ct[f] and not ct[f - 1]]


def find_cycle(c, f0, f1, tmin, tmax, ncyc=1, cond=None):
    """melhor ciclo [a, b) entre apoios do pé esquerdo: poses de a e b o mais parecidas possível.
    cond(vel média do ciclo) filtra pela direção/velocidade do deslocamento"""
    L = strikes(c, 0, f0, f1); best = None
    for i, a in enumerate(L):
        for b in L[i + 1:]:
            T = (b - a) / c.fps
            if T < tmin * ncyc or T > tmax * ncyc: continue
            if len(strikes(c, 1, a, b)) != ncyc: continue
            v = c.vel[a:b]
            if cond and not (cond(v.mean(0)) and all(cond(x) for x in v[::3])): continue
            d = np.linalg.norm(c.P[a] - c.P[b], axis=-1).mean() + .02 * np.linalg.norm(c.vel[a] - c.vel[b])
            if best is None or d < best[0]: best = (d, a, b)
    return best


def frames(c, a, b, loop=False, mirror=False):
    """registros Int16 dos quadros a..b-1 (com fechamento de ciclo quando loop=True)"""
    q = c.quats(0, c.n); p = c.pts(0, c.n); ct = c.contact.copy()
    if loop:
        # fecha o ciclo: nos últimos k quadros mistura com o que vinha antes do começo
        k = min(max(2, int((b - a) * .22)), a)
        qq = q[a:b].copy(); pp = p[a:b].copy()
        for i in range(k):
            w = (i + 1) / (k + 1); fb = b - k + i; fa = a - k + i
            qa = q[fa].copy(); fl = (qa * q[fb]).sum(-1) < 0; qa[fl] *= -1
            x = q[fb] * (1 - w) + qa * w; qq[fb - a] = x / np.linalg.norm(x, axis=-1, keepdims=True)
            pp[fb - a] = p[fb] * (1 - w) + p[fa] * w
        q2, p2, c2 = qq, pp, ct[a:b]
    else: q2, p2, c2 = q[a:b].copy(), p[a:b].copy(), ct[a:b]
    if mirror:  # espelha no plano sagital: troca esquerda/direita
        q2 = q2 * [1, -1, -1, 1]; qm = q2.copy(); qm[:, LS] = q2[:, RS]; qm[:, RS] = q2[:, LS]; q2 = qm
        p2 = p2 * [-1, 1, 1]; p2 = p2[:, [0, 3, 4, 1, 2]]; c2 = c2[:, ::-1]
    # captura (x esq, z frente) → jogo (x dir, z trás): giro de 180° em y
    q2 = q2 * [-1, 1, -1, 1]; p2 = p2 * [-1, 1, -1]
    rec = np.zeros((len(q2), REC), np.int16)
    rec[:, :NB * 4] = np.clip(np.round(q2.reshape(len(q2), -1) * 32767), -32767, 32767)
    rec[:, NB * 4:NB * 4 + 15] = np.clip(np.round(p2.reshape(len(p2), -1) * 1000), -32767, 32767)
    rec[:, -1] = c2[:, 0].astype(int) | (c2[:, 1].astype(int) << 1)
    return rec


clips, blob = {}, []
def add(name, rec, fps, **kw):
    off = sum(len(b) for b in blob); blob.append(rec)
    clips[name] = dict(off=off, n=len(rec), dur=round(len(rec) / fps, 4), **kw)
    print('  + %-10s %3d quadros (%.2f s) %s' % (name, len(rec), len(rec) / fps, kw))


def cycle(name, codes, f0=None, f1=None, tmin=.45, tmax=1.5, mirror=False, ncyc=1, also_mirror=None, cond=None):
    """procura o melhor ciclo entre várias capturas (a de menor erro de fechamento)"""
    best = None
    for code in ([codes] if isinstance(codes, str) else codes):
        c = load(code); a0 = f0 if f0 is not None else int(c.n * .05); a1 = f1 if f1 is not None else c.n - 1
        r = find_cycle(c, a0, a1, tmin, tmax, ncyc, cond)
        if r and (best is None or r[0] < best[0][0]): best = (r, c, code)
    if not best: print('  !! sem ciclo para', name, codes); return
    (d, a, b), c, code = best; v = c.vel[a:b].mean(0)
    for nm, mr in ((name, mirror),) + (((also_mirror, not mirror),) if also_mirror else ()):
        sx = -1 if mr else 1
        add(nm, frames(c, a, b, True, mr), c.fps, loop=1, vel=[round(float(-v[0] * sx), 3), round(float(-v[2]), 3)], src=code, de=[int(a), int(b)], erro=round(float(d), 3))


def shot(name, code, a, b, mirror=False, arm=None, hit=None):
    """trecho de uma vez só (a, b, arm, hit em quadros do arquivo original); arm = fim da preparação, hit = contato/soltura"""
    c = load(code); st = int(round(1 / c.b.dt / c.fps)); kw = {}
    if arm is not None: kw = dict(keys=[round((arm - a) * c.b.dt, 4), round((hit - a) * c.b.dt, 4), round((b - a) * c.b.dt, 4)])
    add(name, frames(c, a // st, min(b // st + 1, c.n), False, mirror), c.fps, loop=0, src=code, de=[int(a), int(b)], **kw)


print('ciclos de deslocamento')
# (na captura: vel[0] > 0 = indo para a esquerda do ator; vel[2] > 0 = para a frente)
cycle('walk', ['35_01', '35_02', '07_01'])
cycle('jog', ['35_17', '35_18', '16_35', '16_36'], tmin=.4)
cycle('run', ['16_45', '16_46', '127_06', '127_08', '09_01', '09_02', '09_04'], tmin=.35, cond=lambda v: v[2] > 3.4)
# passo lateral (anda de lado, pé com pé); no jogo ele acelera e a base abaixa para virar o deslocamento de defesa
# (as capturas de defesa do basquete, 102_28/78_30, trocam de direção a cada 2 passos: não dão um ciclo limpo)
cycle('sideL', ['141_33', '143_40'], tmin=.3, tmax=1.2, cond=lambda v: v[0] > 1.0 and abs(v[2]) < .7, also_mirror='sideR')
cycle('back', ['141_31', '143_39', '76_11'], tmin=.35, tmax=1.4, cond=lambda v: v[2] < -.9 and abs(v[0]) < .5)

print('corpo dos golpes (gestos reais: o corpo vem daqui, a mão da raquete continua a do jogo)')
shot('throw', '141_11', 208, 368, arm=288, hit=297)   # arremesso por cima → smash e saque
shot('toss', '124_12', 56, 240, arm=120, hit=158)     # arremesso por baixo → lob, defesa e curta de forehand
shot('disc', '79_92', 344, 440, arm=380, hit=393)     # lançamento de disco (backhand) → golpes de backhand

c0 = load('35_01')
rest = {g: [round(float(x), 4) for x in (c0.rest_dir[g] * [-1, 1, -1])] for g, m in BONES}
json.dump(dict(fps=30, rec=REC, bones=[g for g, m in BONES], rest=rest, leg=.845, clips=clips), open(OUT + '/mocap.json', 'w'))
np.concatenate(blob).astype('<i2').tofile(OUT + '/mocap.bin')
print('total: %d quadros, %.0f kB' % (sum(len(b) for b in blob), sum(b.nbytes for b in blob) / 1024))
