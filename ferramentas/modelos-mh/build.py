# Monta um atleta a partir do MakeHuman (CC0) no Blender: corpo com formas, roupa (camisa/regata + short/saia),
# cabelo, olhos e cílios, esqueleto com os nomes que o jogo usa (Hips, Spine, LeftArm…) e exporta GLB.
# uso: blend/bin/python build.py <saida.glb> <json de parâmetros> [render.png]
import sys, os, json, math
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np, bpy, mhlib
from mathutils import Vector

out = sys.argv[1]; P = json.loads(sys.argv[2]); RENDER = sys.argv[3] if len(sys.argv) > 3 else None
G = P.get('gender', 'male'); fem = G == 'female'

V0, VT, F = mhlib.load_obj()
V = V0.copy()
def add(name, w):
    if abs(w) < 1e-4: return
    idx, dl = mhlib.load_target(name); V[idx] += dl * w
# etnia (define o sexo também)
for race in ('caucasian', 'african', 'asian'):
    add(f'macrodetails/{race}-{G}-young', P.get(race, 1 if race == 'caucasian' else 0))
# musculatura × peso (bilinear entre min/média/máx)
def lv(x): return {'min': max(0, (.5 - x) * 2), 'average': 1 - abs(x - .5) * 2, 'max': max(0, (x - .5) * 2)}
mu, we = lv(P.get('muscle', .5)), lv(P.get('weight', .5))
for m, wm in mu.items():
    for w, ww in we.items():
        if m == 'average' and w == 'average': continue
        if wm * ww > 1e-4: add(f'macrodetails/universal-{G}-young-{m}muscle-{w}weight', wm * ww)
h = P.get('height', .5)
if h > .5: add(f'macrodetails/height/{G}-young-averagemuscle-averageweight-maxheight', (h - .5) * 2)
elif h < .5: add(f'macrodetails/height/{G}-young-averagemuscle-averageweight-minheight', (.5 - h) * 2)
add(f'macrodetails/proportions/{G}-young-averagemuscle-averageweight-idealproportions', P.get('proportions', .8))
if fem: add('breast/female-young-averagemuscle-averageweight-maxcup-averagefirmness', P.get('cup', .1)); add('breast/female-young-averagemuscle-averageweight-averagecup-maxfirmness', .5)

# esqueleto (posições das juntas pela malha já deformada)
S = mhlib.skel()
J = {k: V[v].mean(0) for k, v in S['joints'].items()}
def jh(b): return J[S['bones'][b]['head']]
def jt(b): return J[S['bones'][b]['tail']]

# ossos do jogo ← ossos do MakeHuman (pesos somados)
face = [b for b in S['bones'] if b.split('.')[0].rstrip('0123456789') in ('jaw', 'eye', 'levator', 'oculi', 'orbicularis', 'oris', 'risorius', 'special', 'temporalis', 'tongue') or b.startswith('tongue')]
MAP = {
    'Hips': (['root', 'spine05', 'pelvis.L', 'pelvis.R'], None, 'root', lambda: jh('spine04')),
    'Spine': (['spine04'], 'Hips', 'spine04', lambda: jh('spine03')),
    'Spine1': (['spine03'], 'Spine', 'spine03', lambda: jh('spine02')),
    'Spine2': (['spine02', 'spine01', 'breast.L', 'breast.R'], 'Spine1', 'spine02', lambda: jh('neck01')),
    'Neck': (['neck01', 'neck02', 'neck03'], 'Spine2', 'neck01', lambda: jh('head')),
    'Head': (['head'] + face, 'Neck', 'head', lambda: jt('head')),
}
for s, M in (('L', 'Left'), ('R', 'Right')):
    MAP[M + 'Shoulder'] = ([f'clavicle.{s}', f'shoulder01.{s}'], 'Spine2', f'clavicle.{s}', lambda s=s: jh(f'upperarm01.{s}'))
    MAP[M + 'Arm'] = ([f'upperarm01.{s}', f'upperarm02.{s}'], M + 'Shoulder', f'upperarm01.{s}', lambda s=s: jh(f'lowerarm01.{s}'))
    MAP[M + 'ForeArm'] = ([f'lowerarm01.{s}', f'lowerarm02.{s}'], M + 'Arm', f'lowerarm01.{s}', lambda s=s: jh(f'wrist.{s}'))
    MAP[M + 'Hand'] = ([f'wrist.{s}'] + [f'metacarpal{i}.{s}' for i in range(1, 5)], M + 'ForeArm', f'wrist.{s}', lambda s=s: jh(f'finger3-1.{s}'))
    for fi, fn in ((1, 'Thumb'), (2, 'Index'), (3, 'Middle'), (4, 'Ring'), (5, 'Pinky')):
        for j in (1, 2, 3):
            MAP[f'{M}Hand{fn}{j}'] = ([f'finger{fi}-{j}.{s}'], f'{M}Hand' if j == 1 else f'{M}Hand{fn}{j-1}', f'finger{fi}-{j}.{s}', lambda b=f'finger{fi}-{j}.{s}': jt(b))
    MAP[M + 'UpLeg'] = ([f'upperleg01.{s}', f'upperleg02.{s}'], 'Hips', f'upperleg01.{s}', lambda s=s: jh(f'lowerleg01.{s}'))
    MAP[M + 'Leg'] = ([f'lowerleg01.{s}', f'lowerleg02.{s}'], M + 'UpLeg', f'lowerleg01.{s}', lambda s=s: jh(f'foot.{s}'))
    MAP[M + 'Foot'] = ([f'foot.{s}'], M + 'Leg', f'foot.{s}', lambda s=s: jh(f'toe3-1.{s}'))
    MAP[M + 'ToeBase'] = ([b for b in S['bones'] if b.startswith('toe') and b.endswith('.' + s)], M + 'Foot', f'toe3-1.{s}', lambda s=s: jt(f'toe3-3.{s}'))
src2dst = {b: d for d, (src, *_ ) in MAP.items() for b in src}

# MakeHuman (dm, Y para cima, frente +Z) → Blender (m, Z para cima, frente −Y): (x, y, z) → (x, −z, y) · 0,1; pés no chão
SC = .1
def cv(p): return Vector((p[0] * SC, -p[2] * SC, p[1] * SC))
foot0 = min(V[list({v for vs, ts, g in F if g == 'body' for v in vs})][:, 1])
OFF = Vector((0, 0, -foot0 * SC))
VB = [cv(p) + OFF for p in V]

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
# armadura
arm_d = bpy.data.armatures.new('Rig'); arm = bpy.data.objects.new('Rig', arm_d); sc.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='EDIT')
for name, (src, parent, headb, tailf) in MAP.items():
    e = arm_d.edit_bones.new(name); e.head = cv(jh(headb)) + OFF; e.tail = cv(tailf()) + OFF
    if (e.tail - e.head).length < .005: e.tail = e.head + Vector((0, 0, .03))
for name, (src, parent, *_ ) in MAP.items():
    if parent: arm_d.edit_bones[name].parent = arm_d.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')

# pesos por vértice (somando os ossos do MakeHuman que viram cada osso do jogo)
W = mhlib.weights(); VW = {}
for b, lst in W.items():
    d = src2dst.get(b, 'Head' if b in face else None)
    if not d: continue
    for v, w in lst: VW.setdefault(v, {}); VW[v][d] = VW[v].get(d, 0) + w

import bmesh
def cvec(n): return Vector((n[0], -n[2], n[1]))
def trim(ob, cuts):
    # corta a peça com planos (no espaço do MakeHuman): tira o lado para onde a normal aponta; side ±1 limita a um lado (x)
    bm = bmesh.new(); bm.from_mesh(ob.data)
    for co, no, side, *xm in cuts:
        pc = cv(co) + OFF; pn = cvec(no).normalized(); xmin = (xm[0] * SC) if xm else .003
        geom = [e for e in bm.verts[:] + bm.edges[:] + bm.faces[:] if side == 0 or all((v.co.x * side) > xmin for v in (e.verts if hasattr(e, 'verts') else [e]))]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=pc, plane_no=pn, clear_outer=True)
    bm.to_mesh(ob.data); bm.free(); ob.data.update()
def part(name, faces, mat, smooth=True):
    vids = sorted({v for vs, ts, g in faces for v in vs}); rem = {v: i for i, v in enumerate(vids)}
    me = bpy.data.meshes.new(name)
    me.from_pydata([VB[v] for v in vids], [], [[rem[v] for v in vs] for vs, ts, g in faces])
    uv = me.uv_layers.new(name='UVMap')
    li = 0
    for fi, (vs, ts, g) in enumerate(faces):
        for t in ts: uv.data[li].uv = VT[t] if t >= 0 else (0, 0); li += 1
    for p in me.polygons: p.use_smooth = smooth
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    ob.data.materials.append(mat)
    for bn in MAP: ob.vertex_groups.new(name=bn)
    for v in vids:
        for bn, w in VW.get(v, {}).items(): ob.vertex_groups[bn].add([rem[v]], w, 'REPLACE')
    ob.parent = arm; md = ob.modifiers.new('Rig', 'ARMATURE'); md.object = arm
    return ob, vids, rem

def mat(name, col, rough=.6, sss=0, metal=0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough
    if sss: b.inputs['Subsurface Weight'].default_value = sss; b.inputs['Subsurface Radius'].default_value = (1, .2, .1)
    return m
def srgb(h): h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]; return tuple(((x + .055) / 1.055) ** 2.4 if x > .04045 else x / 12.92 for x in c)

def dom(v):
    w = VW.get(v); return max(w, key=w.get) if w else None
bones = lambda *ns: set(ns)
# corpo
body_f = [f for f in F if f[2] == 'body']
# ---------- roupa e cabelo com cortes finos ----------
# cada peça sai de uma malha auxiliar do MakeHuman (justa ao corpo, saia ou a própria pele da cabeça), é subdividida e
# recortada por funções no corpo neutro (linhas curvas: decote, cava, manga, barra), e afastada da pele pela normal
J0 = {k: V0[v].mean(0) for k, v in S['joints'].items()}
def j0(b, w='head'): return J0[S['bones'][b][w]]
def along(c, a, b): return float(np.dot(c - a, b - a) / np.dot(b - a, b - a))
def vnormals(faces):
    N = np.zeros_like(V)
    for vs, ts, g in faces:
        n = np.cross(V[vs[1]] - V[vs[0]], V[vs[2]] - V[vs[0]])
        for v in vs: N[v] += n
    return N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
KW = {'arm': 0}  # peso de braço do vértice que está sendo testado (vem do esqueleto)
FP_NAMES = ['Body']  # peças que seguem o corpo (recebem as formas magro/gordo/forte)
def finepart(name, faces, m, keep, disp, cuts=2, groups=None):
    FP_NAMES.append(name)
    ob, vids, rem = part(name, faces, m)
    ob.shape_key_add(name='Basis'); k = ob.shape_key_add(name='N')
    for v in vids: k.data[rem[v]].co = Vector(V0[v])
    bm = bmesh.new(); bm.from_mesh(ob.data)
    if cuts: bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    bm.normal_update(); sk = bm.verts.layers.shape.get('N'); dl = bm.verts.layers.deform.active
    gi = {g.index: g.name for g in ob.vertex_groups}
    def armw(v): d = v[dl]; t = sum(d.values()) or 1; return sum(w for i, w in d.items() if 'Arm' in gi[i] or 'Hand' in gi[i]) / t  # fração do peso no braço
    dead = []
    for v in bm.verts:
        p0 = np.array(v[sk]); KW['arm'] = armw(v)
        if not keep(p0): dead.append(v); continue
        v.co += v.normal * disp(p0) * SC
    bmesh.ops.delete(bm, geom=dead, context='VERTS')
    # bordas lisas: suaviza os vértices da borda ao longo dela (tira o serrilhado do recorte)
    for it in range(6):
        bv = {}
        for e in bm.edges:
            if e.is_boundary:
                a_, b_ = e.verts; bv.setdefault(a_, []).append(b_); bv.setdefault(b_, []).append(a_)
        new = {v: sum((n.co for n in ns), Vector()) / len(ns) for v, ns in bv.items() if len(ns) == 2}
        for v, c in new.items(): v.co = v.co.lerp(c, .5)
    for l in list(bm.verts.layers.shape.values()): bm.verts.layers.shape.remove(l)
    ob.shape_key_clear(); bm.to_mesh(ob.data); bm.free(); ob.data.update()
    if groups:  # pesos fixos (cabelo: cabeça)
        for g in ob.vertex_groups: g.remove(range(len(ob.data.vertices)))
        for bn, w in groups.items(): ob.vertex_groups[bn].add(range(len(ob.data.vertices)), w, 'REPLACE')
    return ob
def smooth01(e0, e1, x): t = min(1., max(0., (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t)
WAIST0 = P.get('waist', 1.35)
ARMX = abs(j0('upperarm01.L')[0]) - .4  # depois disso é braço
def sleeve_t(p):
    s = 'L' if p[0] > 0 else 'R'; return along(p, j0(f'upperarm01.{s}'), j0(f'lowerarm01.{s}'))
def calf_t(p):
    s = 'L' if p[0] > 0 else 'R'; return along(p, j0(f'lowerleg01.{s}'), j0(f'foot.{s}'))
def fore_t(p):
    s = 'L' if p[0] > 0 else 'R'; return along(p, j0(f'lowerarm01.{s}'), j0(f'wrist.{s}'))
def thigh_t(p):
    s = 'L' if p[0] > 0 else 'R'; return along(p, j0(f'upperleg01.{s}'), j0(f'lowerleg01.{s}'))
def neckline(p, depthF, depthB):  # altura do decote naquele ponto (redondo, mais fundo no meio)
    top = j0('neck01')[1] - .12; d = depthF if p[2] > .25 else depthB
    return top - d * max(0., 1 - (p[0] / .62) ** 2) if abs(p[0]) < .62 else 99.  # longe do pescoço não corta (o alto do ombro ficava furado)
def top_keep(p, kind, m=0.):
    if p[1] < WAIST0 - P.get('hemDrop', .3) + m: return False  # barra
    arm = KW['arm'] > .5 and abs(p[0]) > ARMX - .2
    if kind == 'sbra':  # top esportivo: alças largas e barra logo abaixo do peito
        if p[1] < P.get('braHem', 3.62) + m: return False
        if p[1] > neckline(p, P.get('neckF', .75) + .15, .55) - m: return False
        ax = 1.05 + .55 * min(1., max(0., (4.95 - p[1]) / .65))
        return abs(p[0]) < ax - m
    if kind == 'cav':  # camiseta cavada: gola redonda, sem manga, cava funda
        if p[1] > neckline(p, P.get('neckF', .28), .08) - m: return False
        if arm: return False
        ax = 1.3 + .45 * min(1., max(0., (4.6 - p[1]) / .6))
        return abs(p[0]) < ax - m
    if kind in ('tank', 'crop'):
        if kind == 'crop' and p[1] < P.get('cropHem', 3.6) + m: return False
        if p[1] > neckline(p, P.get('neckF', .75), P.get('neckB', .4)) - m: return False
        ax = .95 + .62 * min(1., max(0., (4.95 - p[1]) / .65))  # cava: alça estreita em cima, abre até a lateral
        return abs(p[0]) < ax - m
    if p[1] > neckline(p, P.get('neckF', .28), .08) - m: return False
    if kind == 'long': return (not arm) or fore_t(p) < P.get('cuff', .9) - m * .3  # manga longa até o punho
    return (not arm) or sleeve_t(p) < P.get('sleeve', .38) - m * .3
def shorts_keep(p, m=0., L=None):
    if p[1] > WAIST0 + .05 - m: return False
    if p[1] > j0('upperleg01.L')[1] + .3: return True
    return thigh_t(p) < (L or P.get('shortLen', .5)) - m * .3
def armfrac(v):
    d = VW.get(v, {}); t = sum(d.values()) or 1; return sum(w for b, w in d.items() if 'Arm' in b or 'Hand' in b) / t
def top_keep_v(v, m):
    KW['arm'] = armfrac(v); return top_keep(V0[v], TOP, m)
tf = [f for f in F if f[2] == 'helper-tights']
ALL = bool(P.get('all'))  # modelo do jogo: todas as peças no mesmo arquivo (o jogo liga/desliga e pinta)
TOPS = (['tank', 'crop', 'tee', 'long', 'sbra', 'cav'] if fem else ['tee', 'tank', 'long', 'cav']) if ALL else [P.get('top', 'tank' if fem else 'tee')]
SHORTEST = .3 if ALL else P.get('shortLen', .5)  # o short mais curto do arquivo (a pele só sai onde todos cobrem)
BOT = P.get('bottom', 'shorts')  # shorts | skirt | dress
TOP = TOPS[0]
sh_sup = [f for f in tf if any(shorts_keep(V0[v]) for v in f[0])]
# pele escondida pela roupa sai (não atravessa quando ele se mexe); margem perto das bordas. No modelo do jogo, só o que
# todas as variações cobrem (short sempre; tronco só onde todas as blusas cobrem)
# O resto vira peças separadas pelas blusas que cobrem cada trecho (BodySk_tee: só a camiseta cobre…): o jogo esconde a pele
# que a blusa do jogador cobre (o ombro não atravessa a camiseta)
def cover(vs):
    global TOP
    if all(shorts_keep(V0[v], .3, SHORTEST) for v in vs): return None
    cs = []
    for k in TOPS:
        TOP = k
        if all(top_keep_v(v, .3) for v in vs): cs.append(k)
    TOP = TOPS[0]
    return None if len(cs) == len(TOPS) else tuple(sorted(cs))
FACE_COV = [cover(f[0]) for f in body_f]
BODY_COV = [c for c in FACE_COV if c is not None]
BODY_OB, _bv, BODY_REM = part('Body', [f for f, c in zip(body_f, FACE_COV) if c is not None], mat('Skin', srgb(P.get('skin', '#c68a62')), .5, .12))
shirtC = P.get('shirt', '#1f6fd1'); botC = shirtC if BOT == 'dress' else P.get('shorts', '#222222')
SHIRT_M = mat('Shirt', srgb(shirtC), .8)
for kind in TOPS:
    TOP = kind
    LOOSE = P.get('loose', .2 if (kind in ('tee', 'long', 'cav') and not fem) else .12 if kind in ('tee', 'long', 'cav') else .03 if kind == 'sbra' else .06)
    def shirt_disp(p, L=LOOSE):
        g = P.get('clothGap', .1)
        if KW['arm'] > .5: return g + L * .3 * min(1, max(0, sleeve_t(p) / .4)) * (1 - .7 * smooth01(.35, .85, fore_t(p)))  # manga solta (a longa justa no punho)
        return g + L * smooth01(4.4, WAIST0 - .3, p[1]) * (1 + .15 * math.sin(p[0] * 9))  # folga do peito para baixo (dobras leves)
    top_sup = [f for f in tf if any(top_keep_v(v, 0) for v in f[0])]
    finepart('Top_' + kind if ALL else 'Shirt', top_sup, SHIRT_M, lambda p, k=kind: top_keep(p, k), shirt_disp, cuts=2)
TOP = TOPS[0]
finepart('Shorts', sh_sup, mat('Shorts', srgb(botC if BOT == 'shorts' else P.get('under', botC)), .8), shorts_keep, lambda p: .065)
if ALL:  # bermuda (loja da carreira): até perto do joelho, mais solta embaixo
    bm_sup = [f for f in tf if any(shorts_keep(V0[v], 0, .8) for v in f[0])]
    finepart('Bermuda', bm_sup, mat('Bermuda', srgb(botC), .82), lambda p: shorts_keep(p, 0, .8), lambda p: .07 + .06 * smooth01(.3, .8, thigh_t(p)) * (p[1] < j0('upperleg01.L')[1] + .3))
if ALL:  # shortinho (mais curto), bermuda de compressão (justa até o joelho) e legging 3/4 (só elas)
    for nm, L, d in (('ShortS', .3, .065), ('Compress', .95, .045)) + ((('Legging', 1.62, .042),) if fem else ()):
        sup = [f for f in tf if any(shorts_keep(V0[v], 0, L) for v in f[0])] if True else None
        finepart(nm, sup, mat(nm, srgb(botC), .8), lambda p, L=L: shorts_keep(p, 0, L), lambda p, d=d: d)
if BOT in ('skirt', 'dress') or (ALL and fem):  # saia pregueada por cima do short: da cintura até o comprimento pedido
    hem = j0('upperleg01.L')[1] - P.get('skirtLen', 2.1)
    sk = [f for f in F if f[2] == 'helper-skirt']
    def skirt_disp(p):  # pregas: ondas em volta da cintura, mais fundas perto da barra
        a = math.atan2(p[0], p[2] - .1); k = smooth01(WAIST0, hem, p[1])
        return .07 + (P.get('pleats', .09) * abs(math.sin(a * 9)) + .12) * k
    finepart('Skirt', sk, mat('Skirt', srgb(botC if BOT == 'dress' else P.get('skirtC', botC)), .8), lambda p: hem < p[1] < WAIST0 + (.2 if BOT == 'dress' else .05), skirt_disp, cuts=3)
    if ALL:  # saia curta (mesmas pregas, barra bem mais alta)
        hem = j0('upperleg01.L')[1] - P.get('skirtLenS', 1.35)
        finepart('SkirtS', sk, mat('SkirtS', srgb(P.get('skirtC', botC)), .8), lambda p: hem < p[1] < WAIST0 + .05, skirt_disp, cuts=3)
# ---------- cabelo e barba ----------
# base: casca fina sobre a pele da cabeça (acima da linha do cabelo) com textura de fios que correm na direção do
# penteado; por cima, mechas (tiras com fios na transparência) que crescem andando pela superfície da cabeça: cada passo
# volta para a distância certa da pele (contornam a cabeça), com volume e pontas soltas onde o corte é mais comprido.
# Cada corte é uma peça separada no mesmo arquivo; o jogo mostra a do jogador e pinta com a cor do cabelo.
from mathutils.bvhtree import BVHTree
NRM = vnormals(body_f)
HC = np.array([0, 7.6, .55])
def hairline(p):
    phi = abs(math.atan2(p[0], p[2] - HC[2])) / math.pi
    return np.interp(phi, [0, .3, .5, .72, 1], [P.get('hairFront', 8.0), 7.92, 7.62, 7.3, P.get('hairBack', 6.78)])
def hair_amt(p): return float(np.clip((p[1] - hairline(p)) / .75, 0, 1)) ** 1.3
bvids = sorted({v for f in body_f for v in f[0]})
HAIRON = P.get('hair', '#2a1a0e') != 'none'
def h01(hx): hx = hx.lstrip('#'); return np.array([int(hx[i:i + 2], 16) / 255 for i in (0, 2, 4)])
HAIRC = h01(P.get('hair', '#2a1a0e') if HAIRON else '#2a1a0e')  # sRGB 0-1 (as texturas já saem na cor do cabelo)
HEADF = [list(f[0]) for f in body_f if V0[f[0][0]][1] > 4.6]  # cabeça, pescoço e ombros (colisão do cabelo comprido)
BVH = BVHTree.FromPolygons([tuple(map(float, x)) for x in V], HEADF)
HCM = HC + (V[S['joints']['head____head']].mean(0) - J0['head____head'])  # centro da cabeça (deformada)
def surf(q):  # ponto mais próximo da pele, normal suave e o ponto equivalente no corpo neutro
    loc, _, i, _ = BVH.find_nearest(Vector(tuple(map(float, q)))); vs = HEADF[i]
    n = NRM[vs].sum(0); n /= np.linalg.norm(n) + 1e-9; loc = np.array(loc)
    j = vs[int(np.argmin(((V[vs] - loc) ** 2).sum(1)))]
    return loc, n, V0[j] + (loc - V[j])
def unit(x): return x / (np.linalg.norm(x) + 1e-9)
def tang(x, n): return unit(x - np.dot(x, n) * n)
def rot(t, n, a): return t * math.cos(a) + np.cross(n, t) * math.sin(a)
def flow(q, n, B): return tang(B(q) if callable(B) else B - q, n)  # para o polo B (base do rabo…) ou pelo campo B(q)
def BACK(q):  # penteado para trás: de frente para trás no topo (sobe na testa), descendo nas laterais e na nuca
    d = unit(q - HCM); return np.array([0, -1.2 * smooth01(.5, -.3, d[1]), -1.])
def mh_of(co): return np.array([co[0] / SC, (co[2] - OFF[2]) / SC, -co[1] / SC])

# texturas de fios (numpy): cor = cor do cabelo × intensidade (média 1); nas mechas o alfa recorta os fios
def strand_tex(name, w, h, n, seed, wd=(.6, 1.6), opaque=False, tips=(.55, 1.), wave=(1., 4.), bg=.42, root=.7):
    rng = np.random.default_rng(seed); ys = np.linspace(0, 1, h); xs = np.arange(w)
    C = np.full((h, w), bg if opaque else .9); A = np.ones((h, w)) if opaque else np.zeros((h, w))
    for i in range(n):
        x0 = rng.uniform(0, w); amp = rng.uniform(*wave); cx = x0 + np.sin(ys * rng.uniform(3, 8) + rng.uniform(0, 6)) * amp
        dx = (xs[None, :] - cx[:, None] + w / 2) % w - w / 2; ww = rng.uniform(*wd)
        prof = np.exp(-(dx / ww) ** 2)
        if not opaque: prof = prof * np.clip((rng.uniform(*tips) - ys) / .15, 0, 1)[:, None]
        br = rng.uniform(.55, 1.4); C = C * (1 - prof) + br * prof; A = np.maximum(A, prof)
    C *= root + (1 - root) * np.clip(ys / .35, 0, 1)[:, None]  # raiz mais escura (profundidade)
    m = A > .35; C /= C[m].mean() if m.any() else 1
    img = np.zeros((h, w, 4), np.float32); img[..., :3] = np.clip(HAIRC[None, None, :] * C[..., None], 0, 1); img[..., 3] = A
    im = bpy.data.images.new(name, w, h, alpha=not opaque); im.pixels.foreach_set(np.ascontiguousarray(img[::-1]).ravel()); im.pack()
    return im
def curl_tex(name, w=512, h=512, n=900, seed=4, ln=(14, 34), bg=.5, dirsd=.5):  # fios curtos e curvos (barba, raspado)
    rng = np.random.default_rng(seed); C = np.full((h, w), bg); A = np.zeros((h, w))
    yy, xx = np.mgrid[0:h, 0:w]
    for i in range(n):
        x0, y0 = rng.uniform(0, w), rng.uniform(0, h); L = rng.uniform(*ln); a0 = rng.normal(-math.pi / 2, dirsd); cu = rng.uniform(-.09, .09)
        br = rng.uniform(.55, 1.4)
        for s in range(int(L)):
            a = a0 + cu * s; x0 += math.cos(a); y0 -= math.sin(a)
            xi, yi = int(x0) % w, int(y0) % h
            for ox, oy, k in ((0, 0, 1), (1, 0, .5), (0, 1, .5)):
                X, Y = (xi + ox) % w, (yi + oy) % h; C[Y, X] = C[Y, X] * (1 - k) + br * k; A[Y, X] = max(A[Y, X], k)
    def blur(X): return (X * 4 + np.roll(X, 1, 0) + np.roll(X, -1, 0) + np.roll(X, 1, 1) + np.roll(X, -1, 1)) / 8
    A = np.clip(blur(A) * 1.6, 0, 1); C = blur(C)
    m = A > .35; C /= C[m].mean()
    img = np.zeros((h, w, 4), np.float32); img[..., :3] = np.clip(HAIRC[None, None, :] * C[..., None], 0, 1); img[..., 3] = A
    im = bpy.data.images.new(name, w, h, alpha=True); im.pixels.foreach_set(img.ravel()); im.pack()
    return im
def hair_mat(name, im, cut=None, rough=.62):
    m = bpy.data.materials.new(name); m.use_nodes = True; m.use_backface_culling = False
    nt = m.node_tree; N = nt.nodes; Lk = nt.links; b = N['Principled BSDF']
    it = N.new('ShaderNodeTexImage'); it.image = im; Lk.new(it.outputs['Color'], b.inputs['Base Color'])
    if cut is not None:  # recorte (MASK no glTF)
        gt = N.new('ShaderNodeMath'); gt.operation = 'GREATER_THAN'; gt.inputs[1].default_value = cut
        Lk.new(it.outputs['Alpha'], gt.inputs[0]); Lk.new(gt.outputs[0], b.inputs['Alpha'])
    b.inputs['Roughness'].default_value = rough
    return m
def head_w(q):  # pesos: cabeça; o que desce além do pescoço acompanha o tronco
    a = smooth01(6.5, 5.6, q[1]); return {'Head': 1 - a, 'Spine2': a} if a > 0 else {'Head': 1.}
def card_obj(name, cards, mat_):
    # cards: (pontos ao longo da mecha [MH], larguras, vetores laterais) → tiras com UV (raiz no alto da textura)
    vs_, fs_, uvs_, wts = [], [], [], []
    rng = np.random.default_rng(7)
    for pts, wid, sides in cards:
        u0 = rng.uniform(0, .7); u1 = u0 + .3; base = len(vs_); n = len(pts)
        for i, (pnt, wd, sd) in enumerate(zip(pts, wid, sides)):
            for s_, u in ((-1, u0), (1, u1)):
                vs_.append(cv(pnt + sd * wd * .5 * s_) + OFF); uvs_.append((u, 1 - i / (n - 1))); wts.append(head_w(pnt))
        for i in range(n - 1): fs_.append([base + 2 * i, base + 2 * i + 1, base + 2 * i + 3, base + 2 * i + 2])
    me = bpy.data.meshes.new(name); me.from_pydata(vs_, [], fs_); uv = me.uv_layers.new(name='UVMap')
    for f in me.polygons:
        f.use_smooth = True
        for li in f.loop_indices: uv.data[li].uv = uvs_[me.loops[li].vertex_index]
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob); ob.data.materials.append(mat_)
    for bn in MAP: ob.vertex_groups.new(name=bn)
    for i, w in enumerate(wts):
        for bn, x in w.items(): ob.vertex_groups[bn].add([i], x, 'REPLACE')
    ob.parent = arm; md = ob.modifiers.new('Rig', 'ARMATURE'); md.object = arm
    return ob

# casca (base do cabelo): UV em volta do eixo cabeça→polo, os fios da textura correm na direção do penteado
HS = [f for f in body_f if any(V0[v][1] > hairline(V0[v]) - .25 for v in f[0]) and V0[f[0][0]][1] > 6.3]
def shell(name, thick, B, mat_, bumps=None):
    def off(p): return .012 + thick * hair_amt(p) * (.55 + .45 * min(1, max(0, (p[1] - 7.6) / .9))) + (bumps(p) if bumps else 0)
    ob = finepart(name, HS, mat_, lambda p: p[1] > hairline(p) - .03, off, cuts=3, groups={'Head': 1})
    A = unit(B - HCM) if not callable(B) else unit(np.array([0, .35, -1.])); e1 = unit(np.array([0, 1., 0]) - A[1] * A); e2 = np.cross(A, e1)
    me = ob.data; uv = me.uv_layers[0]
    for f in me.polygons:
        for li in f.loop_indices:
            d = mh_of(me.vertices[me.loops[li].vertex_index].co) - HCM
            pol = math.acos(float(np.clip(np.dot(unit(d), A), -1, 1))); az = math.atan2(np.dot(d, e2), np.dot(d, e1))
            uv.data[li].uv = ((az / (2 * math.pi) + .5) * 7, pol / math.pi * 2.5)
    return ob, off
# raízes: pontos sorteados (por área) na pele acima da linha do cabelo
def scalp_roots(n, rng, cond=lambda p0: True):
    tri = []
    for f in HS:
        vs = f[0]
        for a, b, c in ((vs[0], vs[1], vs[2]), (vs[0], vs[2], vs[3])) if len(vs) == 4 else ((vs[0], vs[1], vs[2]),):
            tri.append((a, b, c))
    tri = np.array(tri); ar = np.linalg.norm(np.cross(V[tri[:, 1]] - V[tri[:, 0]], V[tri[:, 2]] - V[tri[:, 0]]), axis=1); ar /= ar.sum()
    out = []
    while len(out) < n:
        t = tri[rng.choice(len(tri), p=ar)]; r1, r2 = rng.random(), rng.random()
        if r1 + r2 > 1: r1, r2 = 1 - r1, 1 - r2
        w = np.array([1 - r1 - r2, r1, r2]); p0 = (V0[t] * w[:, None]).sum(0)
        if p0[1] > hairline(p0) - .01 and cond(p0): out.append(((V[t] * w[:, None]).sum(0), p0))
    return out
def grow(root, t0, L, nseg, hfun, B, hug=True, grav=0., steer=.3, wave=0., wph=0.):
    s, n, p0 = surf(root); pts = [s + n * hfun(p0, 0.)]; nrm = [n]; t = tang(t0, n); ds = L / (nseg - 1)
    for k in range(1, nseg):
        f = k / (nseg - 1); q = pts[-1] + t * ds
        if wave: q = q + np.cross(nrm[-1], t) * wave * math.sin(f * 9 + wph) * ds
        s, n, p0 = surf(q); h = hfun(p0, f); dist = float(np.dot(q - s, n))
        if hug or dist < h: q = q + n * (h - dist)
        tn = unit(q - pts[-1])
        t = unit((tang(tn, n) if hug else tn) + steer * flow(q, n, B) + np.array([0, -grav * f, 0]))
        pts.append(q); nrm.append(n)
    sides = []
    for k in range(nseg):
        d = unit(pts[min(k + 1, nseg - 1)] - pts[max(k - 1, 0)]); sides.append(unit(np.cross(nrm[k], d)))
    return pts, sides, nrm
def clump_rng(p0, size, seed):
    k = tuple(np.floor(p0 / size).astype(int)); return np.random.default_rng(abs(hash((k, seed))) % (2 ** 32))
HAIR_PARTS = {}
if HAIRON:
    CARD_M = hair_mat('HairCards', strand_tex('HairCardsTex', 256, 1024, 130, 3), cut=.35, rough=.55)
    SHELL_M = hair_mat('Hair', strand_tex('HairTex', 512, 1024, 420, 5, wd=(.7, 1.8), opaque=True), rough=.7)
    hd = jh('head'); PONY0 = hd + np.array([0, .75, -.62])  # base do rabo de cavalo
    rng = np.random.default_rng(11)
    if not fem:
        # curto (como a foto): laterais e nuca curtas e rentes; em cima mais comprido, jogado para cima e para trás,
        # com mechas agrupadas em tufos de direção parecida e pontas soltas (bagunçado)
        _, offS = shell('Hair', P.get('hairThick', .07), BACK, SHELL_M)
        cards = []
        for root, p0 in scalp_roots(P.get('cards', 2600), rng):
            s, n, _ = surf(root); top = smooth01(7.75, 8.4, p0[1]); fr = smooth01(.55, 1.05, p0[2]) * top
            cr = clump_rng(p0, .17, 1); ang = cr.normal(0, .8) * top + rng.normal(0, .15)
            t0 = rot(flow(root, n, BACK) + np.array([0, -.8 * (1 - top), 0]), n, ang)
            L = (.13 + .42 * top) * rng.uniform(.75, 1.2); nseg = 3 + int(round(4 * top))
            lift = .008 + (.09 + .16 * cr.random()) * top * rng.uniform(.5, 1.2); qf = .17 * fr * rng.uniform(.6, 1.2) + .05 * top
            hf = lambda q0, f, lift=lift, qf=qf: offS(q0) + .006 + lift * f ** 1.5 + qf * min(1, f * 3) * (1 - .5 * f)
            pts, sides, nrm = grow(root, t0, L, nseg, hf, BACK, steer=.25)
            tw = rng.normal(0, .55) * top; sides = [unit(sd + nn * tw) for sd, nn in zip(sides, nrm)]
            wid = [(.06 + .06 * top) * rng.uniform(.8, 1.25) * (1 - .45 * f) for f in np.linspace(0, 1, nseg)]
            cards.append((pts, wid, sides))
        card_obj('HairCards', cards, CARD_M)
        # raspado (máquina): só a casca rente
        shell('HairBuzz', .006, BACK, hair_mat('HairBuzzM', curl_tex('HairBuzzTex', n=14000, seed=21, ln=(8, 16), dirsd=.25), cut=.35, rough=.8))
        # moicano: faixa do meio em pé, para cima e para trás
        cards = []
        for root, p0 in scalp_roots(900, rng, lambda p0: abs(p0[0]) < .2 and p0[1] > 7.9):
            s, n, _ = surf(root); t0 = rot(flow(root, n, BACK), n, rng.normal(0, .15)); L = rng.uniform(.4, .6)
            lift = rng.uniform(.18, .3); hf = lambda q0, f, lift=lift: offS(q0) * .3 + .01 + lift * min(1, f * 1.6)
            pts, sides, nrm = grow(root, t0, L, 6, hf, BACK, steer=.2)
            cards.append((pts, [rng.uniform(.07, .11) * (1 - .4 * f) for f in np.linspace(0, 1, 6)], sides))
        card_obj('HairMohawk', cards, CARD_M)
        # cacheado: casca alta com cachos (calombos) e textura de fios curvos
        _, offC = shell('HairCurly', .1, BACK, hair_mat('HairCurlyM', curl_tex('HairCurlyTex', n=6000, seed=9, bg=.55, dirsd=1.5), rough=.75))
        cards = []
        for root, p0 in scalp_roots(1700, rng):
            s, n, _ = surf(root); top = smooth01(7.6, 8.3, p0[1])
            t0 = rot(flow(root, n, BACK), n, rng.uniform(-1.2, 1.2)); L = rng.uniform(.14, .24) * (.55 + .45 * top); ns = 8
            lift = rng.uniform(.03, .1) * (.3 + .7 * top)
            hf = lambda q0, f, lift=lift: offC(q0) - .02 + lift * f
            pts, sides, nrm = grow(root, t0, L, ns, hf, BACK, steer=0)
            R = rng.uniform(.025, .04); turns = rng.uniform(1.6, 2.6); ph = rng.uniform(0, 6.3); out_ = []
            for k in range(ns):  # cacho: a mecha gira em volta do próprio caminho (e a tira torce junto)
                a = ph + turns * 2 * math.pi * k / (ns - 1); c_, s_ = math.cos(a), math.sin(a)
                pts[k] = pts[k] + (sides[k] * c_ + nrm[k] * s_) * R * min(1, k / 2); out_.append(unit(sides[k] * -s_ + nrm[k] * c_ + sides[k] * .4))
            cards.append((pts, [rng.uniform(.07, .1)] * ns, out_))
        card_obj('HairCurlyCards', cards, CARD_M)
        LONG_B = BACK
        LONG_L = (1.3, 1.9)
    else:
        # rente e puxado para trás até a base do rabo (rabo, trança, coque)
        _, offS = shell('Hair', P.get('hairThick', .02), PONY0, SHELL_M)
        cards = []
        for root, p0 in scalp_roots(P.get('cards', 1800), rng):
            s, n, _ = surf(root); L = rng.uniform(.5, .85)
            t0 = rot(flow(root, n, PONY0), n, rng.normal(0, .06))
            hf = lambda q0, f: offS(q0) + .005 + .004 * f
            pts, sides, nrm = grow(root, t0, L, 6, hf, PONY0, steer=.5)
            cards.append((pts, [rng.uniform(.1, .16) * (1 - .3 * f) for f in np.linspace(0, 1, 6)], sides))
        card_obj('HairCards', cards, CARD_M)
        LONG_B = BACK
        LONG_L = (2.2, 3.0)
    # solto e comprido: dos dois lados da risca para trás e caindo (gravidade), sem atravessar cabeça, pescoço e ombros
    def long_cards(name, Lr, n=1150, seed=2):
        r_ = np.random.default_rng(seed); cards = []
        for root, p0 in scalp_roots(n, r_, lambda p0: p0[1] > 7.05):  # a nuca baixa fica com a base (sem "rabinho")
            s, n_, _ = surf(root); top = smooth01(7.6, 8.4, p0[1])
            part = np.array([np.sign(p0[0] + 1e-3) * .6, 0, 0]) * smooth01(.5, 1.1, p0[2])  # risca no meio, na frente
            t0 = unit(flow(root, n_, LONG_B) + part); L = r_.uniform(*Lr) * (.75 + .25 * top); ns = 8
            off0 = .11 if fem else .1
            lift = r_.uniform(.0, .06) * top
            hf = lambda q0, f, lift=lift: max(.012 + off0 * hair_amt(q0) + .01 + lift * min(1, f * 4) + .02 * f, .13 if q0[1] < hairline(q0) - .15 else 0)
            pts, sides, nrm = grow(root, t0, L, ns, hf, LONG_B, hug=False, grav=1.6, steer=.5, wave=.25 if fem else .1, wph=r_.uniform(0, 6))
            cards.append([pts, [r_.uniform(.13, .22) * (1 - .55 * f) for f in np.linspace(0, 1, ns)], sides, tuple(np.floor(p0 / .22).astype(int))])
        groups = {}
        for c in cards: groups.setdefault(c[3], []).append(c)
        for g in groups.values():  # mechas: as pontas do mesmo grupo se juntam
            mean = np.mean([np.array(c[0]) for c in g], axis=0)
            for c in g: c[0] = [p + (m - p) * .55 * (k / (ns - 1)) ** 1.5 for k, (p, m) in enumerate(zip(c[0], mean))]
        card_obj(name, [c[:3] for c in cards], CARD_M)
    long_cards('HairLong', LONG_L)
    # borda: fios curtinhos e finos saindo um pouco antes da linha do cabelo (tira o degrau da casca na testa e na nuca)
    FB = BACK if not fem else PONY0; cards = []
    for root, p0 in scalp_roots(900, np.random.default_rng(31), lambda p0: p0[1] < hairline(p0) + .12):
        s, n, _ = surf(root); t0 = rot(flow(root, n, FB), n, rng.normal(0, .25))
        root = root - t0 * rng.uniform(.0, .05)  # começa um pouco antes da borda
        hf = lambda q0, f: .01 + .006 * f
        pts, sides, nrm = grow(root, t0, rng.uniform(.08, .16), 3, hf, FB, steer=.3)
        cards.append((pts, [rng.uniform(.035, .06) * (1 - .5 * f) for f in (0, .5, 1)], sides))
    card_obj('HairFringe', cards, CARD_M)
    if fem:
        long_cards('HairBob', (.95, 1.25), 1000, 6)
        # coque: bola de mechas enroladas na base do rabo
        bc = PONY0 + np.array([0, -.05, -.2]); bcards = []
        for k in range(70):
            ax_ = unit(rng.normal(0, 1, 3)); u = unit(np.cross(ax_, rng.normal(0, 1, 3))); w_ = np.cross(ax_, u); R = rng.uniform(.24, .33)
            a0 = rng.uniform(0, 6.3); arc = rng.uniform(3, 4.5)
            pts = [bc + (u * math.cos(a0 + arc * t) + w_ * math.sin(a0 + arc * t)) * R * np.array([1.15, .9, 1]) for t in np.linspace(0, 1, 10)]
            bcards.append((pts, [rng.uniform(.14, .2)] * 10, [ax_] * 10))
        card_obj('Bun', bcards, CARD_M)
# rabo de cavalo: núcleo fino + mechas em volta que acompanham a curva e se abrem na ponta
if P.get('ponytail'):
    hd = jh('head'); base = hd + np.array([0, .75, -.62]); L = P.get('ponytail')
    pts = [base + np.array([0, -L * t * .95, -.55 * math.sin(t * 1.6) - .1 * t]) for t in np.linspace(0, 1, 9)]
    rad = [.3, .3, .27, .24, .21, .17, .13, .09, .04]
    vs_, fs_ = [], []
    for i, (c, r) in enumerate(zip(pts, rad)):
        for k in range(10):
            a_ = k / 10 * 2 * math.pi; vs_.append(cv(c + np.array([math.cos(a_) * r, 0, math.sin(a_) * r * .85])) + OFF)
    for i in range(8):
        for k in range(10): fs_.append([i * 10 + k, i * 10 + (k + 1) % 10, (i + 1) * 10 + (k + 1) % 10, (i + 1) * 10 + k])
    me = bpy.data.meshes.new('Pony'); me.from_pydata(vs_, [], fs_); uvp = me.uv_layers.new(name='UVMap')
    for pg in me.polygons:
        pg.use_smooth = True
        for li in pg.loop_indices:
            vi = me.loops[li].vertex_index; uvp.data[li].uv = ((vi % 10) / 10 * 3, vi // 10 / 8 * 3)
    ob = bpy.data.objects.new('Pony', me); sc.collection.objects.link(ob); ob.data.materials.append(bpy.data.materials['Hair'])
    for bn in MAP: ob.vertex_groups.new(name=bn)
    for i in range(9):
        wn = min(1, i / 8) * .5
        for k in range(10): ob.vertex_groups['Head'].add([i * 10 + k], 1 - wn, 'REPLACE'); ob.vertex_groups['Neck'].add([i * 10 + k], wn, 'REPLACE')
    ob.parent = arm; md = ob.modifiers.new('Rig', 'ARMATURE'); md.object = arm
    rng = np.random.default_rng(5); pq = []
    for k in range(40):
        a_ = k / 40 * 2 * math.pi + rng.uniform(-.1, .1); spread = rng.uniform(.9, 1.45)
        ring = [c + np.array([math.cos(a_ + .3 * t) * r * spread, 0, math.sin(a_ + .3 * t) * r * .85 * spread]) for t, (c, r) in enumerate(zip(pts, [.32, .33, .31, .28, .26, .24, .22, .2, .18]))]
        side = np.array([-math.sin(a_), 0, math.cos(a_)])
        pq.append((ring, [rng.uniform(.16, .26)] * 9, [side] * 9))
    card_obj('PonyCards', pq, bpy.data.materials['HairCards'])
# barba: casca curta sobre o rosto (fios curvos com recorte, bordas pelo próprio recorte dos fios), três desenhos
if not fem and P.get('beards', ALL):
    BEARD_M = hair_mat('Beard', curl_tex('BeardTex', n=26000, seed=12, ln=(6, 14), bg=.6), cut=.3, rough=.75)
    face_f = [f for f in body_f if V0[f[0][0]][1] > 5.7 and V0[f[0][0]][1] < 7.5 and V0[f[0][0]][2] > 0]
    def nolips(p): return (p[0] / .28) ** 2 + ((p[1] - 6.67) / .115) ** 2 > 1
    def full(p):
        ax = abs(p[0]); top = 6.8 + .34 * smooth01(.34, .8, ax)
        if ax > .68 and p[1] > 6.8 and p[2] < .72: return False  # orelha
        return p[1] < top and p[1] > 6.3 + .4 * smooth01(.25, .75, ax) - .08 * smooth01(.9, .5, p[2]) and p[2] > .45 and ax < .82 and nolips(p) and not (ax < .2 and p[1] > 6.83)
    def stache(p): return abs(p[0]) < .34 - .15 * smooth01(6.7, 6.6, p[1]) and 6.6 < p[1] < 6.86 and p[2] > 1.15 and nolips(p)
    def goatee(p): return (abs(p[0]) < .27 and 6.18 < p[1] < 6.62 and p[2] > .95 and nolips(p)) or stache(p)
    BEARD_E = hair_mat('BeardEdge', curl_tex('BeardEdgeTex', n=7000, seed=14, ln=(6, 14), bg=.75), cut=.3, rough=.75)
    def core(keep, m=.055): return lambda p: all(keep(p + np.array(o)) for o in ((0, 0, 0), (m, 0, 0), (-m, 0, 0), (0, m, 0), (0, -m, 0), (0, 0, m)))
    # miolo denso + faixa da borda com fios ralos (a barba falha até sumir, sem borda dura); rente à pele
    for nm_, keep_, m_ in (('Beard', full, .06), ('Goatee', goatee, .045), ('Mustache', stache, .03)):
        cr_ = core(keep_, m_)
        finepart(nm_, face_f, BEARD_M, cr_, lambda p: .012 + .01 * smooth01(6.7, 6.3, p[1]), cuts=2)
        finepart(nm_ + 'Edge', face_f, BEARD_E, lambda p, k=keep_, c=core(keep_, m_ + .035): k(p) and not c(p), lambda p: .014 + .01 * smooth01(6.7, 6.3, p[1]), cuts=2)
    for ob in [o for o in sc.objects if o.name in ('Beard', 'Goatee', 'Mustache', 'BeardEdge', 'GoateeEdge', 'MustacheEdge')]:
        me = ob.data; uv = me.uv_layers[0]
        for f in me.polygons:
            for li in f.loop_indices:
                q = mh_of(me.vertices[me.loops[li].vertex_index].co)  # projeção pelo lado da face (sob o queixo: de baixo)
                uv.data[li].uv = (q[0] * 4, q[2] * 4) if abs(f.normal[2]) > .65 else ((q[0] + q[2] * .5) * 4, q[1] * 4)
# boné, viseira e faixa (o jogo mostra conforme o personagem e pinta na cor dele): copa/faixa saem da pele da cabeça
# (casca acima do cabelo curto), a aba é uma lâmina curva na frente
if ALL and HAIRON:
    def capline(p):
        phi = abs(math.atan2(p[0], p[2] - HC[2])) / math.pi
        return np.interp(phi, [0, .3, .5, .75, 1], [7.82, 7.78, 7.62, 7.45, 7.38])
    HEADV = np.array([v for v in bvids if 7.0 < V0[v][1] < 8.4 and V0[v][2] > -.2])
    def ring_pt(phi, y, off):  # ponto da pele na altura y (corpo neutro), na direção phi (0 = frente), afastado pela normal
        p0 = V0[HEADV]; ang = np.arctan2(p0[:, 0], p0[:, 2] - HC[2])
        w = (np.abs(p0[:, 1] - y) < .07) & (np.abs(ang - phi) < .12)
        if not w.any(): w = np.abs(ang - phi) < .2
        vv = HEADV[w][np.argmin(np.abs(V0[HEADV[w]][:, 1] - y))]
        return V[vv] + NRM[vv] * off
    def brim(name, m_, y0, L=.78, off=.11):
        vs_, fs_ = [], []; phis = np.linspace(-1.15, 1.15, 25); rows = []
        qs = [ring_pt(ph, y0 + .04 * (abs(ph) / 1.15) ** 2, off) for ph in phis]
        for it in range(6): qs = [qs[0]] + [(qs[i - 1] + 2 * qs[i] + qs[i + 1]) / 4 for i in range(1, len(qs) - 1)] + [qs[-1]]  # borda lisa
        for ph, q in zip(phis, qs):
            out_ = unit(np.array([math.sin(ph), 0, math.cos(ph)])); Lk = L * max(0, math.cos(ph * 1.15)) ** .6 + .05
            row = [q + out_ * Lk * t + np.array([0, -.16 * t * t * Lk, 0]) for t in np.linspace(0, 1, 5)]
            rows.append(row)
        for side in (1, -1):  # duas faces da aba (espessura de 2 mm)
            b0 = len(vs_)
            for row in rows:
                for q in row: vs_.append(cv(q + np.array([0, .01 * side, 0])) + OFF)
            for i in range(len(rows) - 1):
                for j in range(4):
                    a_, b_, c_, d_ = b0 + i * 5 + j, b0 + i * 5 + j + 1, b0 + (i + 1) * 5 + j + 1, b0 + (i + 1) * 5 + j
                    fs_.append([a_, b_, c_, d_] if side > 0 else [d_, c_, b_, a_])
        n1 = len(rows) * 5  # borda da aba
        for i in range(len(rows) - 1):
            j = 4; fs_.append([i * 5 + j, (i + 1) * 5 + j, n1 + (i + 1) * 5 + j, n1 + i * 5 + j])
        me = bpy.data.meshes.new(name); me.from_pydata(vs_, [], fs_); me.uv_layers.new(name='UVMap')
        for f in me.polygons: f.use_smooth = True
        ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob); ob.data.materials.append(m_)
        ob.vertex_groups.new(name='Head').add(range(len(vs_)), 1, 'REPLACE'); ob.parent = arm; md = ob.modifiers.new('Rig', 'ARMATURE'); md.object = arm
    CAP_M = mat('Cap', (.9, .9, .9), .75)
    capf = [f for f in body_f if V0[f[0][0]][1] > 7.0]
    finepart('Cap', capf, CAP_M, lambda p: p[1] > capline(p), lambda p: .11 + .05 * smooth01(7.8, 8.5, p[1]), groups={'Head': 1})
    brim('CapBrim', CAP_M, 7.82)
    VIS_M = mat('Visor', (.9, .9, .9), .7)
    finepart('Visor', capf, VIS_M, lambda p: capline(p) - .02 < p[1] < capline(p) + .26, lambda p: .12, groups={'Head': 1})
    brim('VisorBrim', VIS_M, 7.8, L=.72, off=.12)
    band_y = lambda p: np.interp(abs(math.atan2(p[0], p[2] - HC[2])) / math.pi, [0, .3, .5, .75, 1], [8.02, 7.98, 7.82, 7.62, 7.55])
    finepart('Headband', capf, mat('Headband', (.9, .9, .9), .85), lambda p: abs(p[1] - band_y(p)) < .11, lambda p: .1, groups={'Head': 1})
# olhos: esfera subdividida com íris e pupila pelo ângulo em relação à frente do olho (anel escuro na borda da íris),
# branco levemente rosado nos cantos; brilho molhado
eyes_f = [f for f in F if f[2] in ('helper-l-eye', 'helper-r-eye')]
eo = finepart('Eyes', eyes_f, mat('Eyes', (1, 1, 1), .06), lambda p: True, lambda p: 0, cuts=3)
em = eo.data; ca = em.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
iris = srgb(P.get('iris', '#4a2f1b'))
for side in (1, -1):
    vs = [v for v in em.vertices if v.co.x * side > 0]
    c = sum((v.co for v in vs), Vector()) / len(vs); fwd = Vector((.06 * side, -1, 0)).normalized()
    for v in vs:
        a = (v.co - c).normalized().angle(fwd)
        if a < .17: col = (.01, .01, .01)
        elif a < .44: k = (a - .17) / .27; col = tuple(ch * (1.15 - .5 * k) if a < .40 else ch * .35 for ch in iris)
        else: col = (.9, .86, .84) if a < 1.0 else (.85, .7, .68)
        ca.data[v.index].color = (*col, 1)
nt = em.materials[0].node_tree; cn = nt.nodes.new('ShaderNodeVertexColor'); cn.layer_name = 'Col'
nt.links.new(cn.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])
# manguito de compressão (um braço) e meião (panturrilhas): casca justa sobre a pele
if P.get('armSleeve') or ALL:  # 'R' (braço da raquete) ou 'L'
    # no modelo do jogo, os dois braços: ArmSleeve (direito, destros) e ArmSleeveL (esquerdo, canhotos)
    for nm, sg in ((('ArmSleeve', -1), ('ArmSleeveL', 1)) if ALL else (('ArmSleeve', 1 if P.get('armSleeve') == 'L' else -1),)):
        arm_sup = [f for f in body_f if all(V0[v][0] * sg > ARMX - .2 for v in f[0]) and any(armfrac(v) > .4 for v in f[0])]
        finepart(nm, arm_sup, mat(nm, srgb(P.get('sleeveC', '#ffffff')), .7),
                 lambda p, sg=sg: KW['arm'] > .5 and p[0] * sg > 0 and (sleeve_t(p) > .55 or fore_t(p) > -.2) and fore_t(p) < .93, lambda p: .03)
if ALL:  # munhequeiras (os dois punhos)
    wr_sup = [f for f in body_f if all(abs(V0[v][0]) > ARMX - .2 for v in f[0]) and any(armfrac(v) > .4 for v in f[0])]
    for nm, sg in (('WristbandR', -1), ('WristbandL', 1)):  # um por punho (o jogo escolhe esquerdo, direito ou os dois)
        finepart(nm, [f for f in wr_sup if V0[f[0][0]][0] * sg > 0], mat(nm, srgb('#ffffff'), .95), lambda p, sg=sg: KW['arm'] > .5 and p[0] * sg > 0 and .72 < fore_t(p) < .9, lambda p: .07)
if P.get('calf') or ALL:
    leg_sup = [f for f in body_f if V0[f[0][0]][1] < -2.5]
    for nm, sg in ((('CalfR', -1), ('CalfL', 1)) if ALL else (('Calf', 0),)):  # no jogo, uma perna de cada vez
        finepart(nm, [f for f in leg_sup if V0[f[0][0]][0] * sg >= 0], mat(nm, srgb(P.get('calfC', '#d7eef0')), .7), lambda p, sg=sg: p[0] * sg >= 0 and .12 < calf_t(p) < .86, lambda p: .03)
# óculos esportivos: lentes largas e curvas (envolventes), armação em volta, ponte e hastes até as orelhas
if P.get('glasses') or ALL:
    hshift = V[S['joints']['head____head']].mean(0) - J0['head____head']
    lens_bm = bmesh.new(); fr_bm = bmesh.new()
    def sq(a, e=3.2): c_, s_ = math.cos(a), math.sin(a); return np.sign(c_) * abs(c_) ** (2 / e), np.sign(s_) * abs(s_) ** (2 / e)
    def box(bm, a, b, wdt, up):  # barra fina de a até b
        d = b - a; d /= np.linalg.norm(d) + 1e-9; s1 = np.cross(d, up); s1 /= np.linalg.norm(s1) + 1e-9; s2 = np.cross(s1, d)
        cs = [(1, 1), (-1, 1), (-1, -1), (1, -1)]; ra = [bm.verts.new(cv(a + (s1 * x + s2 * y) * wdt) + OFF) for x, y in cs]; rb = [bm.verts.new(cv(b + (s1 * x + s2 * y) * wdt) + OFF) for x, y in cs]
        for i in range(4): bm.faces.new([ra[i], ra[(i + 1) % 4], rb[(i + 1) % 4], rb[i]])
    inner = {}
    for sg in (1, -1):
        ev = sorted({v for f in F if f[2] == ('helper-l-eye' if sg > 0 else 'helper-r-eye') for v in f[0]})
        c = V[ev].mean(0) + np.array([.04 * sg, .02, .3])
        pts = []
        for i in range(24):
            a = i / 24 * 2 * math.pi; x_, y_ = sq(a); x_ *= .33; y_ *= .19 * (1 - .2 * max(0, -math.sin(a)) * (x_ * sg < 0))
            pts.append(c + np.array([x_, y_, -.11 * ((x_ * sg + .33) / .66) ** 2]))  # envolve para os lados
        lens_bm.faces.new([lens_bm.verts.new(cv(q) + OFF) for q in pts])
        for i in range(24): box(fr_bm, pts[i] + np.array([0, 0, .01]), pts[(i + 1) % 24] + np.array([0, 0, .01]), .014, np.array([0, 0, 1.]))
        outer = max(pts, key=lambda q: q[0] * sg); inner[sg] = min(pts, key=lambda q: q[0] * sg + abs(q[1] - c[1]) * 2)
        ear = np.array([.86 * sg, 7.33, .22]) + hshift
        box(fr_bm, outer + np.array([0, .06, 0]), ear, .014, np.array([0, 1., 0]))
    box(fr_bm, inner[1] + np.array([0, .05, .01]), inner[-1] + np.array([0, .05, .01]), .022, np.array([0, 1., 0]))
    for nm_, bm_, m_ in (('Glasses', lens_bm, mat('Lens', (.01, .01, .012), .05)), ('GlassesFrame', fr_bm, mat('Frame', (.03, .03, .035), .35))):
        me_ = bpy.data.meshes.new(nm_); bm_.to_mesh(me_); bm_.free()
        o_ = bpy.data.objects.new(nm_, me_); sc.collection.objects.link(o_); o_.data.materials.append(m_)
        o_.vertex_groups.new(name='Head').add(range(len(me_.vertices)), 1, 'REPLACE'); o_.parent = arm; md = o_.modifiers.new('Rig', 'ARMATURE'); md.object = arm
lash = [f for f in F if f[2].startswith('helper-') and 'eyelashes-2' in f[2]]  # só os cílios de cima (os de baixo pareciam delineador)
part('Lashes', lash, mat('Lashes', (.05, .035, .025), .8))

# ---------- textura da pele (assada no Blender): cor com variação, poros, vermelhidão (bochechas, nariz, orelhas, joelhos),
# lábios, sobrancelhas com fios, sombra dos olhos, barba rala (homens) e a linha do cabelo pintada sob a casca do cabelo ----------
def smooth01(e0, e1, x): t = min(1., max(0., (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t)
def masks(p):
    x, y, z = p; ax = abs(x)
    lips = smooth01(1.0, .7, (x / .25) ** 2 + ((y - 6.67) / .14) ** 2) * smooth01(1.36, 1.46, z)
    red = max(smooth01(.32, .12, np.linalg.norm([ax - .42, y - 6.95, z - 1.35])) * .8, smooth01(.22, .05, np.linalg.norm([x, y - 7.0, z - 1.62])) * .7,
              smooth01(.68, .8, ax) * smooth01(6.85, 7.0, y) * smooth01(7.65, 7.5, y) * (z < 1.0) * .7)
    for s_ in ('L', 'R'):
        k = j0(f'lowerleg01.{s_}'); red = max(red, smooth01(.45, .15, np.linalg.norm(p - k - np.array([0, 0, .25]))) * .5)
    yc = 7.47 + .075 * math.sin(math.pi * min(1, max(0, (ax - .07) / .58))) - .02 * max(0, ax - .45) / .2
    hh = .07 * (1 - .4 * min(1, max(0, (ax - .1) / .5)))
    brow = smooth01(hh, hh * .45, abs(y - yc)) * smooth01(.06, .11, ax) * smooth01(.66, .58, ax) * smooth01(1.0, 1.15, z)
    eye = 0.
    for sg in (1, -1): eye = max(eye, smooth01(.34, .16, np.linalg.norm([x - .31 * sg, (y - 7.3) * 1.3, z - 1.25])))
    stub = 0.
    if P.get('beard', .6 if not fem else 0):
        stub = smooth01(7.0, 6.82, y + .25 * (ax / .7) ** 2) * smooth01(5.95, 6.15, y) * smooth01(.78, .6, ax) * smooth01(.45, .7, z) * (1 - lips)
        stub = max(stub, smooth01(5.85, 6.0, y) * smooth01(6.3, 6.15, y) * smooth01(.55, .4, ax) * smooth01(.5, .7, z))
        stub *= P.get('beard', .6)
    scalp = smooth01(-.1, .06, y - hairline(p)) if P.get('hair', '#2a1a0e') != 'none' else 0.
    return lips, red, brow, eye, stub, scalp
SKIN_RES = P.get('texRes', 2048)
def bake_skin(ob, vids_map):
    me = ob.data
    c1 = me.color_attributes.new('M1', 'FLOAT_COLOR', 'POINT'); c2 = me.color_attributes.new('M2', 'FLOAT_COLOR', 'POINT')
    for v, i in vids_map.items():
        lips, red, brow, eye, stub, scalp = masks(V0[v]); c1.data[i].color = (lips, red, brow, eye); c2.data[i].color = (stub, scalp, 0, 1)
    m = ob.data.materials[0]; nt = m.node_tree; N = nt.nodes; Lk = nt.links
    for n in list(N): N.remove(n)
    out = N.new('ShaderNodeOutputMaterial'); em_ = N.new('ShaderNodeEmission'); Lk.new(em_.outputs[0], out.inputs['Surface'])
    a1 = N.new('ShaderNodeVertexColor'); a1.layer_name = 'M1'; a2 = N.new('ShaderNodeVertexColor'); a2.layer_name = 'M2'
    s1 = N.new('ShaderNodeSeparateColor'); Lk.new(a1.outputs['Color'], s1.inputs[0]); s1a = a1.outputs['Alpha']
    s2 = N.new('ShaderNodeSeparateColor'); Lk.new(a2.outputs['Color'], s2.inputs[0])
    tc = N.new('ShaderNodeTexCoord')
    def noise(scale, det=4):
        n = N.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = det; Lk.new(tc.outputs['Object'], n.inputs['Vector']); return n.outputs['Fac']
    def mix(a, b, f, mode='MIX'):
        mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = mode
        for src, dst in ((f, mx.inputs[0]), (a, mx.inputs[6]), (b, mx.inputs[7])):
            if isinstance(src, (int, float)): dst.default_value = src
            elif isinstance(src, tuple): dst.default_value = (*src, 1) if len(src) == 3 else src
            else: Lk.new(src, dst)
        return mx.outputs[2]
    def mul(a, k):
        mm = N.new('ShaderNodeMath'); mm.operation = 'MULTIPLY'; Lk.new(a, mm.inputs[0]) if not isinstance(a, float) else None; mm.inputs[1].default_value = k
        if isinstance(a, float): mm.inputs[0].default_value = a
        return mm.outputs[0]
    def mulsock(a, b):
        mm = N.new('ShaderNodeMath'); mm.operation = 'MULTIPLY'; Lk.new(a, mm.inputs[0]); Lk.new(b, mm.inputs[1]); return mm.outputs[0]
    # oclusão ambiente assada (dobras: olhos, nariz, orelhas, axilas, pescoço) — só corpo e olhos (roupa e cabelo mudam no jogo)
    hid = [o for o in sc.objects if o.type == 'MESH' and o.name not in ('Body', 'Eyes') and not o.hide_render]
    for o in hid: o.hide_render = True
    if not sc.world: sc.world = bpy.data.worlds.new('W0')
    sc.world.light_settings.distance = .12
    aoimg = bpy.data.images.new('SkinAO', SKIN_RES // 2, SKIN_RES // 2); ait = N.new('ShaderNodeTexImage'); ait.image = aoimg; N.active = ait
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.device = 'CPU'
    for o in sc.objects: o.select_set(False)
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type='AO', margin=8, use_clear=True)
    for o in hid: o.hide_render = False
    ao = N.new('ShaderNodeMapRange'); ao.inputs[1].default_value = .15; ao.inputs[2].default_value = 1; Lk.new(ait.outputs['Color'], ao.inputs[0])
    sk_ = srgb(P.get('skin', '#c68a62'))
    col = mix(sk_, tuple(c * .88 for c in sk_), mul(noise(4, 3), 1.0))            # manchas grandes, suaves
    col = mix(col, tuple(c * 1.06 for c in sk_), mul(noise(40, 2), .5))           # variação média
    col = mix(col, (sk_[0] * 1.1, sk_[1] * .8, sk_[2] * .76), mul(s1.outputs[1], .7))  # vermelhidão
    sp = N.new('ShaderNodeMapRange'); sp.inputs[1].default_value = .64; sp.inputs[2].default_value = .72; Lk.new(noise(160, 0), sp.inputs[0])
    col = mix(col, (sk_[0] * .72, sk_[1] * .6, sk_[2] * .55), mul(sp.outputs[0], .35))  # pintinhas e sardas
    col = mix(col, tuple(c * .82 for c in sk_), mul(s1a, .22))                    # sombra em volta dos olhos
    lipc = (sk_[0] * .9, sk_[1] * .52, sk_[2] * .55)
    col = mix(col, lipc, mul(s1.outputs[0], 1.0))                                 # lábios
    hairc = srgb(P.get('hair', '#2a1a0e')) if P.get('hair', '#2a1a0e') != 'none' else (.04, .03, .02)
    browc = srgb(P.get('brow', P.get('hair', '#2a1a0e'))) if P.get('hair') != 'none' else (.04, .03, .02)
    # fios: ruído esticado na horizontal
    mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (60, 600, 600); Lk.new(tc.outputs['Object'], mp.inputs['Vector'])
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1; nz.inputs['Detail'].default_value = 2; Lk.new(mp.outputs[0], nz.inputs['Vector'])
    cr = N.new('ShaderNodeMapRange'); cr.inputs[1].default_value = .25; cr.inputs[2].default_value = .5; Lk.new(nz.outputs['Fac'], cr.inputs[0])
    col = mix(col, browc, mul(mulsock(s1.outputs[2], cr.outputs[0]), 1.0))                  # sobrancelhas
    st = N.new('ShaderNodeMapRange'); st.inputs[1].default_value = .3; st.inputs[2].default_value = .55; Lk.new(noise(500, 1), st.inputs[0])
    col = mix(col, (sk_[0] * .42, sk_[1] * .42, sk_[2] * .46), mul(mulsock(s2.outputs[0], st.outputs[0]), .9))  # barba rala
    col = mix(col, hairc, mul(s2.outputs[1], .92))                                # couro cabeludo
    po = N.new('ShaderNodeMapRange'); po.inputs[1].default_value = .3; po.inputs[2].default_value = .7; Lk.new(noise(700, 2), po.inputs[0])
    col = mix(col, tuple(c * .93 for c in sk_), mul(po.outputs[0], .5))           # poros
    aoc = N.new('ShaderNodeMath'); aoc.operation = 'SUBTRACT'; aoc.inputs[0].default_value = 1; Lk.new(ao.outputs[0], aoc.inputs[1])
    col = mix(col, (sk_[0] * .38, sk_[1] * .26, sk_[2] * .24), mul(aoc.outputs[0], .75))  # sombra das dobras (quente, não cinza)
    Lk.new(col, em_.inputs['Color'])
    img = bpy.data.images.new('SkinColor', SKIN_RES, SKIN_RES); it = N.new('ShaderNodeTexImage'); it.image = img; N.active = it
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 1; sc.cycles.device = 'CPU'
    for o in sc.objects: o.select_set(False)
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type='EMIT', margin=6, use_clear=True)
    # relevo dos poros (mapa de normais)
    for n in list(N): N.remove(n)
    out = N.new('ShaderNodeOutputMaterial'); bs = N.new('ShaderNodeBsdfPrincipled'); Lk.new(bs.outputs[0], out.inputs['Surface'])
    tc = N.new('ShaderNodeTexCoord'); bp = N.new('ShaderNodeBump'); bp.inputs['Strength'].default_value = .25; bp.inputs['Distance'].default_value = .0006
    Lk.new(noise(600, 3), bp.inputs['Height']); Lk.new(bp.outputs['Normal'], bs.inputs['Normal'])
    nimg = bpy.data.images.new('SkinNormal', SKIN_RES // 2, SKIN_RES // 2); nimg.colorspace_settings.name = 'Non-Color'
    nit = N.new('ShaderNodeTexImage'); nit.image = nimg; N.active = nit
    bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT', margin=6, use_clear=True)
    # material final: textura de cor + normal, pele com subsuperfície (no render) e brilho leve
    for n in list(N): N.remove(n)
    out = N.new('ShaderNodeOutputMaterial'); bs = N.new('ShaderNodeBsdfPrincipled'); Lk.new(bs.outputs[0], out.inputs['Surface'])
    ti = N.new('ShaderNodeTexImage'); ti.image = img; Lk.new(ti.outputs['Color'], bs.inputs['Base Color'])
    tn = N.new('ShaderNodeTexImage'); tn.image = nimg; nm = N.new('ShaderNodeNormalMap'); Lk.new(tn.outputs['Color'], nm.inputs['Color']); Lk.new(nm.outputs['Normal'], bs.inputs['Normal'])
    bs.inputs['Roughness'].default_value = .52; bs.inputs['Subsurface Weight'].default_value = .12; bs.inputs['Subsurface Radius'].default_value = (1, .2, .1)
    me.color_attributes.remove(me.color_attributes['M1']); me.color_attributes.remove(me.color_attributes['M2'])
# tipos de corpo: o mesmo modelo montado com outro peso/musculatura vira forma (shape key) de cada peça que segue o corpo
MORPHS = P.get('morphs') if not P.get('dumpTo') else None
MORPHABLE = lambda: [o for o in sc.objects if o.type == 'MESH' and o.name in FP_NAMES and o.name != 'Eyes' and not o.name.startswith('Hair')]
if P.get('dumpTo'):
    np.savez(P['dumpTo'], **{o.name: np.array([v.co[:] for v in o.data.vertices], np.float32) for o in MORPHABLE()})
    print('DUMP', P['dumpTo']); sys.exit(0)
if MORPHS:
    import subprocess, tempfile
    tmp = tempfile.mkdtemp(); jobs = {}
    for kn, over in MORPHS.items():
        q = dict(P); q.update(over); q.pop('morphs', None); q['dumpTo'] = os.path.join(tmp, kn + '.npz'); q.pop('show', None)
        jobs[kn] = (subprocess.Popen([sys.executable, os.path.abspath(__file__), os.path.join(tmp, 'x.glb'), json.dumps(q)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL), q['dumpTo'])
    for kn, (pr, path) in jobs.items():
        pr.wait(); d = np.load(path)
        for o in MORPHABLE():
            if o.name in d.files and len(d[o.name]) == len(o.data.vertices):
                if not o.data.shape_keys: o.shape_key_add(name='Basis')
                k = o.shape_key_add(name=kn); k.data.foreach_set('co', d[o.name].ravel())
            else: print('forma ignorada', kn, o.name)
bake_skin(BODY_OB, BODY_REM)
# separa a pele por blusa que cobre (normais do corpo inteiro, sem costura de luz entre as peças)
def split_body():
    me = BODY_OB.data; vn = np.array([v.normal[:] for v in me.vertices])
    def keep_faces(ob, want):
        bm = bmesh.new(); bm.from_mesh(ob.data); oi = bm.verts.layers.int.new('oi')
        for v in bm.verts: v[oi] = v.index
        bm.faces.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if BODY_COV[f.index] != want], context='FACES')
        bm.to_mesh(ob.data); bm.free(); m2 = ob.data
        idx = [m2.attributes['oi'].data[i].value for i in range(len(m2.vertices))]
        m2.normals_split_custom_set_from_vertices([tuple(vn[i]) for i in idx]); m2.attributes.remove(m2.attributes['oi'])
    for g in sorted({c for c in BODY_COV if c}):
        o2 = BODY_OB.copy(); o2.data = BODY_OB.data.copy(); o2.name = 'BodySk_' + '_'.join(g); sc.collection.objects.link(o2)
        keep_faces(o2, g)
    keep_faces(BODY_OB, ())
if P.get('all'): split_body()

# exporta (Y para cima no glTF)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=False, export_apply=False, export_skins=True, export_animations=False, export_morph=bool(MORPHS), export_morph_normal=False, export_yup=True, export_image_format='JPEG', export_jpeg_quality=88)
print('OK', out, 'altura', round(max(v.z for v in VB if True) , 2))

if RENDER:
    if 'show' in P:  # prévia de um corte/barba: esconde as outras peças de cabelo
        for o in sc.objects:
            if o.name in ('Hair', 'HairCards', 'HairBuzz', 'HairMohawk', 'HairCurly', 'HairLong', 'HairBob', 'Bun', 'Pony', 'PonyCards', 'Beard', 'Goatee', 'Mustache', 'HairCurlyCards', 'HairFringe', 'BeardEdge', 'GoateeEdge', 'MustacheEdge', 'Cap', 'CapBrim', 'Visor', 'VisorBrim', 'Headband') and o.name.replace('Edge', '').replace('Brim', '') not in P['show']: o.hide_render = True
    for o in sc.objects:
        if o.name in P.get('hideParts', []) or o.name.split('.')[0] in P.get('hideParts', []): o.hide_render = True
    # prévia: Cycles na CPU, luz de sol + preenchimento, câmera frontal 3/4
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.device = 'CPU'
    sc.render.resolution_x, sc.render.resolution_y = 640, 900
    w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.55, .7, .9, 1); w.node_tree.nodes['Background'].inputs[1].default_value = .6
    sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN')); sun.data.energy = 4; sun.rotation_euler = (math.radians(50), 0, math.radians(30)); sc.collection.objects.link(sun)
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam')); sc.collection.objects.link(cam); sc.camera = cam
    hgt = max(v.z for v in VB)
    yaw = math.radians(P.get('yaw', 25)); d = 3.6
    if P.get('close'):
        tz = cv(jh('head'))[2] + OFF[2] + .1; d = .75
        cam.location = (math.sin(yaw) * d, -math.cos(yaw) * d, tz + .02); cam.data.lens = 60
        dirv = Vector((0, 0, tz)) - cam.location
    else:
        cam.location = (math.sin(yaw) * d, -math.cos(yaw) * d, hgt * .55); cam.data.lens = 50
        dirv = Vector((0, 0, hgt * .5)) - cam.location
    cam.rotation_euler = dirv.to_track_quat('-Z', 'Y').to_euler()
    gm = bpy.data.meshes.new('G'); gm.from_pydata([(-5, -5, 0), (5, -5, 0), (5, 5, 0), (-5, 5, 0)], [], [[0, 1, 2, 3]]); go = bpy.data.objects.new('G', gm); sc.collection.objects.link(go); go.data.materials.append(mat('Sand', srgb('#e6d3a3'), .9))
    sc.render.filepath = RENDER; bpy.ops.render.render(write_still=True); print('render', RENDER)
