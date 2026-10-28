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
def finepart(name, faces, m, keep, disp, cuts=2, groups=None):
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
def thigh_t(p):
    s = 'L' if p[0] > 0 else 'R'; return along(p, j0(f'upperleg01.{s}'), j0(f'lowerleg01.{s}'))
def neckline(p, depthF, depthB):  # altura do decote naquele ponto (redondo, mais fundo no meio)
    top = j0('neck01')[1] - .12; d = depthF if p[2] > .25 else depthB
    return top - d * max(0., 1 - (p[0] / .62) ** 2)
def top_keep(p, kind, m=0.):
    if p[1] < WAIST0 - P.get('hemDrop', .3) + m: return False  # barra
    arm = KW['arm'] > .5 and abs(p[0]) > ARMX - .2
    if kind in ('tank', 'crop'):
        if kind == 'crop' and p[1] < P.get('cropHem', 3.6) + m: return False
        if p[1] > neckline(p, P.get('neckF', .75), P.get('neckB', .4)) - m: return False
        ax = .95 + .62 * min(1., max(0., (4.95 - p[1]) / .65))  # cava: alça estreita em cima, abre até a lateral
        return abs(p[0]) < ax - m
    if p[1] > neckline(p, P.get('neckF', .28), .08) - m: return False
    return (not arm) or sleeve_t(p) < P.get('sleeve', .38) - m * .3
def shorts_keep(p, m=0.):
    if p[1] > WAIST0 + .05 - m: return False
    if p[1] > j0('upperleg01.L')[1] + .3: return True
    return thigh_t(p) < P.get('shortLen', .5) - m * .3
def armfrac(v):
    d = VW.get(v, {}); t = sum(d.values()) or 1; return sum(w for b, w in d.items() if 'Arm' in b or 'Hand' in b) / t
def top_keep_v(v, m):
    KW['arm'] = armfrac(v); return top_keep(V0[v], TOP, m)
tf = [f for f in F if f[2] == 'helper-tights']
ALL = bool(P.get('all'))  # modelo do jogo: todas as peças no mesmo arquivo (o jogo liga/desliga e pinta)
TOPS = (['tank', 'crop', 'tee'] if fem else ['tee', 'tank']) if ALL else [P.get('top', 'tank' if fem else 'tee')]
BOT = P.get('bottom', 'shorts')  # shorts | skirt | dress
TOP = TOPS[0]
sh_sup = [f for f in tf if any(shorts_keep(V0[v]) for v in f[0])]
# pele escondida pela roupa sai (não atravessa quando ele se mexe); margem perto das bordas. No modelo do jogo, só o que
# todas as variações cobrem (short sempre; tronco só onde todas as blusas cobrem)
def hidden(vs):
    global TOP
    if all(shorts_keep(V0[v], .3) for v in vs): return True
    ok = True
    for k in TOPS:
        TOP = k
        if not all(top_keep_v(v, .3) for v in vs): ok = False; break
    TOP = TOPS[0]; return ok
BODY_OB, _bv, BODY_REM = part('Body', [f for f in body_f if not hidden(f[0])], mat('Skin', srgb(P.get('skin', '#c68a62')), .5, .12))
shirtC = P.get('shirt', '#1f6fd1'); botC = shirtC if BOT == 'dress' else P.get('shorts', '#222222')
SHIRT_M = mat('Shirt', srgb(shirtC), .8)
for kind in TOPS:
    TOP = kind
    LOOSE = P.get('loose', .28 if (kind == 'tee' and not fem) else .12 if kind == 'tee' else .06)
    def shirt_disp(p, L=LOOSE):
        g = P.get('clothGap', .1)
        if KW['arm'] > .5: return g + L * .5 * min(1, max(0, sleeve_t(p) / .4))  # manga solta
        return g + L * smooth01(4.4, WAIST0 - .3, p[1]) * (1 + .15 * math.sin(p[0] * 9))  # folga do peito para baixo (dobras leves)
    top_sup = [f for f in tf if any(top_keep_v(v, 0) for v in f[0])]
    finepart('Top_' + kind if ALL else 'Shirt', top_sup, SHIRT_M, lambda p, k=kind: top_keep(p, k), shirt_disp, cuts=2)
TOP = TOPS[0]
finepart('Shorts', sh_sup, mat('Shorts', srgb(botC if BOT == 'shorts' else P.get('under', botC)), .8), shorts_keep, lambda p: .065)
if BOT in ('skirt', 'dress') or (ALL and fem):  # saia pregueada por cima do short: da cintura até o comprimento pedido
    hem = j0('upperleg01.L')[1] - P.get('skirtLen', 2.1)
    sk = [f for f in F if f[2] == 'helper-skirt']
    def skirt_disp(p):  # pregas: ondas em volta da cintura, mais fundas perto da barra
        a = math.atan2(p[0], p[2] - .1); k = smooth01(WAIST0, hem, p[1])
        return .07 + (P.get('pleats', .09) * abs(math.sin(a * 9)) + .12) * k
    finepart('Skirt', sk, mat('Skirt', srgb(botC if BOT == 'dress' else P.get('skirtC', botC)), .8), lambda p: hem < p[1] < WAIST0 + (.2 if BOT == 'dress' else .05), skirt_disp, cuts=3)
# cabelo: casca a partir da pele da cabeça, acima da linha do cabelo (alta na testa, acima das orelhas, baixa na nuca);
# mais volume no topo, afinando até a borda
NRM = vnormals(body_f)
HC = np.array([0, 7.6, .55])
def hairline(p):
    phi = abs(math.atan2(p[0], p[2] - HC[2])) / math.pi
    return np.interp(phi, [0, .3, .5, .72, 1], [P.get('hairFront', 8.0), 7.92, 7.62, 7.3, P.get('hairBack', 6.78)])
def hair_amt(p): return float(np.clip((p[1] - hairline(p)) / .75, 0, 1)) ** 1.3
if P.get('hair', '#2a1a0e') != 'none':
    hs = [f for f in body_f if any(V0[v][1] > hairline(V0[v]) - .25 for v in f[0]) and V0[f[0][0]][1] > 6.3]
    thick = P.get('hairThick', .16 if not fem else (.09 if P.get('ponytail') else .22))  # preso: rente à cabeça
    HAIR_OB = finepart('Hair', hs, mat('Hair', srgb(P.get('hair', '#2a1a0e')), .75), lambda p: p[1] > hairline(p) - .03,
             lambda p: .012 + thick * hair_amt(p) * (.55 + .45 * min(1, max(0, (p[1] - 7.6) / .9))) * (1 + P.get('messy', 0 if fem else .45) * (math.sin(p[0] * 23 + p[2] * 7) * math.sin(p[2] * 19 - p[1] * 11) + .3 * math.sin(p[0] * 47 + p[1] * 31))), groups={'Head': 1})
bvids = sorted({v for f in body_f for v in f[0]})

# rabo de cavalo: tubo que sai de trás da cabeça e cai nas costas (acompanha a cabeça e um pouco o pescoço)
if P.get('ponytail'):
    hd = jh('head'); base = hd + np.array([0, .75, -.62]); L = P.get('ponytail')
    pts = [base + np.array([0, -L * t * .95, -.55 * math.sin(t * 1.6) - .1 * t]) for t in np.linspace(0, 1, 9)]
    rad = [.42, .4, .36, .32, .28, .23, .18, .13, .06]
    vs_, fs_ = [], []
    for i, (c, r) in enumerate(zip(pts, rad)):
        for k in range(10):
            a_ = k / 10 * 2 * math.pi; vs_.append(cv(c + np.array([math.cos(a_) * r, 0, math.sin(a_) * r * .85])) + OFF)
    for i in range(8):
        for k in range(10): fs_.append([i * 10 + k, i * 10 + (k + 1) % 10, (i + 1) * 10 + (k + 1) % 10, (i + 1) * 10 + k])
    me = bpy.data.meshes.new('Pony'); me.from_pydata(vs_, [], fs_); me.uv_layers.new(name='UVMap')
    for pg in me.polygons: pg.use_smooth = True
    ob = bpy.data.objects.new('Pony', me); sc.collection.objects.link(ob); ob.data.materials.append(bpy.data.materials['Hair'])
    for bn in MAP: ob.vertex_groups.new(name=bn)
    for i in range(9):
        wn = min(1, i / 8) * .5
        for k in range(10): ob.vertex_groups['Head'].add([i * 10 + k], 1 - wn, 'REPLACE'); ob.vertex_groups['Neck'].add([i * 10 + k], wn, 'REPLACE')
    ob.parent = arm; md = ob.modifiers.new('Rig', 'ARMATURE'); md.object = arm
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
def calf_t(p):
    s = 'L' if p[0] > 0 else 'R'; return along(p, j0(f'lowerleg01.{s}'), j0(f'foot.{s}'))
def fore_t(p):
    s = 'L' if p[0] > 0 else 'R'; return along(p, j0(f'lowerarm01.{s}'), j0(f'wrist.{s}'))
if P.get('armSleeve') or ALL:  # 'R' (braço da raquete) ou 'L'
    sg = 1 if P.get('armSleeve') == 'L' else -1
    arm_sup = [f for f in body_f if all(V0[v][0] * sg > ARMX - .2 for v in f[0]) and any(armfrac(v) > .4 for v in f[0])]
    finepart('ArmSleeve', arm_sup, mat('ArmSleeve', srgb(P.get('sleeveC', '#ffffff')), .7),
             lambda p: KW['arm'] > .5 and p[0] * sg > 0 and (sleeve_t(p) > .55 or fore_t(p) > -.2) and fore_t(p) < .93, lambda p: .03)
if P.get('calf') or ALL:
    leg_sup = [f for f in body_f if V0[f[0][0]][1] < -2.5]
    finepart('Calf', leg_sup, mat('Calf', srgb(P.get('calfC', '#d7eef0')), .7), lambda p: .12 < calf_t(p) < .86, lambda p: .03)
# óculos escuros: lentes curvas na frente dos olhos + ponte e hastes finas
if P.get('glasses') or ALL:
    gm_ = bpy.data.meshes.new('Glasses'); bmg = bmesh.new()
    for sg in (1, -1):
        ev = sorted({v for f in F if f[2] == ('helper-l-eye' if sg > 0 else 'helper-r-eye') for v in f[0]})
        c = V[ev].mean(0) + np.array([.03 * sg, .03, .3]); ring = []  # na frente do olho (pelo olho já deformado)
        for i in range(16):
            a = i / 16 * 2 * math.pi; q = c + np.array([math.cos(a) * .27, math.sin(a) * .19, -.05 * (math.cos(a) * sg + 1)])
            ring.append(bmg.verts.new(cv(q) + OFF))
        bmg.faces.new(ring)
    bmg.to_mesh(gm_); bmg.free()
    go_ = bpy.data.objects.new('Glasses', gm_); sc.collection.objects.link(go_); go_.data.materials.append(mat('Lens', (.01, .01, .012), .08))
    go_.vertex_groups.new(name='Head').add(range(len(gm_.vertices)), 1, 'REPLACE'); go_.parent = arm; md = go_.modifiers.new('Rig', 'ARMATURE'); md.object = arm
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
    sk_ = srgb(P.get('skin', '#c68a62'))
    col = mix(sk_, tuple(c * .88 for c in sk_), mul(noise(4, 3), 1.0))            # manchas grandes, suaves
    col = mix(col, tuple(c * 1.06 for c in sk_), mul(noise(40, 2), .5))           # variação média
    col = mix(col, (sk_[0] * 1.1, sk_[1] * .84, sk_[2] * .8), mul(s1.outputs[1], .55))  # vermelhidão
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
bake_skin(BODY_OB, BODY_REM)
# cabelo: fios (ruído esticado na direção da frente para trás) assados numa textura; superfície fosca
def bake_hair(ob):
    m = ob.data.materials[0]; nt = m.node_tree; N = nt.nodes; Lk = nt.links
    for n in list(N): N.remove(n)
    out = N.new('ShaderNodeOutputMaterial'); em_ = N.new('ShaderNodeEmission'); Lk.new(em_.outputs[0], out.inputs['Surface'])
    tc = N.new('ShaderNodeTexCoord'); mp = N.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (420, 18, 420); Lk.new(tc.outputs['Object'], mp.inputs['Vector'])
    nz = N.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 1; nz.inputs['Detail'].default_value = 6; Lk.new(mp.outputs[0], nz.inputs['Vector'])
    hc = srgb(P.get('hair', '#2a1a0e'))
    cr = N.new('ShaderNodeValToRGB'); cr.color_ramp.elements[0].color = (*[c * .55 for c in hc], 1); cr.color_ramp.elements[1].color = (*[min(1, c * 1.45 + .01) for c in hc], 1)
    Lk.new(nz.outputs['Fac'], cr.inputs[0]); Lk.new(cr.outputs[0], em_.inputs['Color'])
    img = bpy.data.images.new('HairColor', 1024, 1024); it = N.new('ShaderNodeTexImage'); it.image = img; N.active = it
    for o in sc.objects: o.select_set(False)
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type='EMIT', margin=6, use_clear=True)
    for n in list(N): N.remove(n)
    out = N.new('ShaderNodeOutputMaterial'); bs = N.new('ShaderNodeBsdfPrincipled'); Lk.new(bs.outputs[0], out.inputs['Surface'])
    ti = N.new('ShaderNodeTexImage'); ti.image = img; Lk.new(ti.outputs['Color'], bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = .72
if 'HAIR_OB' in globals(): bake_hair(HAIR_OB)

# exporta (Y para cima no glTF)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=False, export_apply=False, export_skins=True, export_animations=False, export_morph=False, export_yup=True, export_image_format='JPEG', export_jpeg_quality=88)
print('OK', out, 'altura', round(max(v.z for v in VB if True) , 2))

if RENDER:
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
