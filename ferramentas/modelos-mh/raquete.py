# Raquetes de beach tennis no Blender (medidas de mercado: 50 cm, cabeça ~22,5 cm, 22 mm de espessura):
# face em carbono com borda chanfrada, garganta vazada, protetor de aro, cabo com overgrip, ponteira e cordão.
# Gera um GLB com a face de cada padrão de furação (o jogo pinta a arte de cada modelo por cima, pelo UV).
# uso: blend/bin/python raquete.py <saida.glb> [render.png]
import sys, math
import numpy as np, bpy, bmesh
from mathutils import Vector

out = sys.argv[1]; RENDER = sys.argv[2] if len(sys.argv) > 2 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# contorno (metade direita, da garganta y = −0,205 até a ponta y = +0,16; spline Catmull-Rom): a cabeça oval das
# raquetes de beach tennis do circuito (todas têm praticamente a mesma silhueta; o que muda é furação, garganta e arte)
SHAPES = {
    'oval': [[.02, -.205], [.03, -.183], [.052, -.148], [.082, -.114], [.116, -.066], [.14, -.011], [.145, .044], [.137, .085], [.11, .126], [.06, .152], [0, .16]],
}
k = .82
def sy(y): return -.12 + (y + .12) * 1.1 if y > -.12 else y
def catmull(pts, n=7):
    out_ = [pts[0]]
    for i in range(len(pts) - 1):
        p0 = np.array(pts[max(i - 1, 0)]); p1 = np.array(pts[i]); p2 = np.array(pts[i + 1]); p3 = np.array(pts[min(i + 2, len(pts) - 1)])
        for t in np.linspace(0, 1, n + 1)[1:]:
            out_.append(tuple(.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)))
    return out_
OUTLINE, POLY = None, None
def set_shape(name):
    global OUTLINE, POLY
    R = SHAPES[name]
    right = [(x * k, sy(y)) for x, y in R]; left = [(-x * k, sy(y)) for x, y in R[:-1]][::-1]
    ctrl = [(-.02 * k, -.205), (.02 * k, -.205)] + right[1:] + left
    OUTLINE = [ctrl[0]] + catmull(ctrl[1:] + [ctrl[0]])[:-1]
    POLY = np.array(OUTLINE)
def inside(x, y):
    c = False; n = len(POLY)
    for i in range(n):
        a, b = POLY[i], POLY[i - 1]
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]: c = not c
    return c
def edge_d(x, y):
    m = 9
    for i in range(len(POLY)):
        a, b = POLY[i - 1], POLY[i]; d = b - a; t = np.clip(((x - a[0]) * d[0] + (y - a[1]) * d[1]) / (d @ d + 1e-12), 0, 1)
        m = min(m, math.hypot(x - a[0] - d[0] * t, y - a[1] - d[1] * t))
    return m
def ring(inset, step, y0=-.09, y1=1, xs=None):  # pontos ao longo do contorno, para dentro
    pts, acc = [], 0
    P = list(POLY) + [POLY[0]]
    for i in range(len(P) - 1):
        a, b = np.array(P[i]), np.array(P[i + 1]); L = np.linalg.norm(b - a)
        for d in np.arange(0, L, .001):
            acc += .001
            if acc < step: continue
            acc = 0; q = a + (b - a) * d / L; nrm = np.array([-(b - a)[1], (b - a)[0]]) / L; q = q + nrm * inset
            if y0 <= q[1] <= y1 and inside(*q) and edge_d(*q) > inset * .8 and (xs is None or xs(q)): pts.append(tuple(q))
    return pts
def grid(dx=.034, dy=.031, inset=.021, y0=-.07):
    p, row = [], 0
    y = y0
    while y < .15:
        x = -.12 + (dx / 2 if row % 2 else 0)
        while x < .12:
            if inside(x, y) and edge_d(x, y) > inset: p.append((x, y))
            x += dx
        y += dy; row += 1
    return p
def xarms(off=.027, step=.024):  # furos contornando um X grande (os dois braços sem furo)
    pts = []
    for (x0, y0, x1, y1) in [(-.085, .125, .07, -.055), (.085, .125, -.07, -.055)]:
        L = math.hypot(x1 - x0, y1 - y0); nx, ny = -(y1 - y0) / L, (x1 - x0) / L
        for t in np.arange(0, L, step):
            cx, cy = x0 + (x1 - x0) * t / L, y0 + (y1 - y0) * t / L
            for sgn in (1, -1):
                q = (cx + nx * off * sgn, cy + ny * off * sgn)
                if inside(*q) and edge_d(*q) > .019 and all(abs((q[0] - a) * (d - b) - (q[1] - b) * (c - a)) / math.hypot(c - a, d - b) > off * .8 for (a, b, c, d) in [(-.085, .125, .07, -.055), (.085, .125, -.07, -.055)]): pts.append(q)
    return pts
def horseshoe(c=(0, .03), radii=(.05, .074, .098), step=.024):  # anéis em ferradura em volta do triângulo central
    pts = []
    for r in radii:
        n = max(6, int(2 * math.pi * r / step))
        for i in range(n):
            a = i / n * 2 * math.pi
            if abs(math.atan2(math.sin(a + math.pi / 2), math.cos(a + math.pi / 2))) < .7: continue  # aberto embaixo
            q = (c[0] + r * math.cos(a), c[1] + r * math.sin(a))
            if inside(*q) and edge_d(*q) > .018: pts.append(q)
    return pts
def star_gaps(c=(0, .025), r=.058):  # furos entre os braços de uma estrela de 4 pontas
    return [(c[0] + r * math.cos(a), c[1] + r * math.sin(a)) for a in (math.pi / 4, 3 * math.pi / 4, 5 * math.pi / 4, 7 * math.pi / 4)]
# posição no jogo: cabo de y = 0 a −0,15; face de −0,15 (garganta) a −0,50 (ponta); espessura em z
SX, SY = .95, .96
def place(x, y): return (-x * SX, -(.15 + (y + .205) * SY))
def add_curve(name, loops, extrude, bevel, res=1):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '2D'; cu.fill_mode = 'BOTH'
    cu.extrude = extrude; cu.bevel_depth = bevel; cu.bevel_resolution = res
    for lp in loops:
        sp = cu.splines.new('POLY'); sp.points.add(len(lp) - 1)
        for i, (x, y) in enumerate(lp): px, py = place(x, y); sp.points[i].co = (px, py, 0, 1)
        sp.use_cyclic_u = True
    ob = bpy.data.objects.new(name, cu); sc.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get(); me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob); return me
def finish(name, me, uvfun=None, smooth_angle=None):
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    if uvfun:
        uv = me.uv_layers.new(name='UVMap') if not me.uv_layers else me.uv_layers[0]
        for f in me.polygons:
            for li in f.loop_indices: uv.data[li].uv = uvfun(me.vertices[me.loops[li].vertex_index].co, f)
    for f in me.polygons: f.use_smooth = smooth_angle is not None
    if smooth_angle is not None:
        try: me.set_sharp_from_angle(angle=smooth_angle)
        except Exception: pass
    # o glTF é Y para cima: deita a malha (o jogo usa o plano XY com espessura em z)
    ob.rotation_euler = (math.pi / 2, 0, 0)
    return ob
def mat(name, col, rough=.5):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough; return m
M_FACE, M_EDGE = mat('Face', (.06, .06, .07), .45), mat('Edge', (.8, .8, .82), .35)
# UV da face = coordenada do desenho original (o jogo mapeia a arte com repeat/offset)
def shape_uv(co, f):
    x = -co.x / SX; y = (-co.y - .15) / SY - .205
    return (x, y)
THICK = .0094; BEV = .0018  # 2 × (0,0094 + 0,0018) ≈ 22 mm
def spaced(pts, r):  # sem furos encostados (nem no contorno): o preenchimento da face quebra
    out_ = []
    for q in pts:
        if edge_d(*q) > r + .007 and all(math.hypot(q[0] - o[0], q[1] - o[1]) > 2 * r + .0045 for o in out_): out_.append(q)
    return out_
def rtri(tri, n=5):  # triângulo com cantos arredondados
    c = np.mean(tri, axis=0); P = [np.array(p) + (c - np.array(p)) * .12 for p in tri]; out_ = []
    for i in range(3):
        a, v, b = (P[i - 1] + P[i]) / 2, P[i], (P[i] + P[(i + 1) % 3]) / 2
        for t in np.linspace(0, 1, n, endpoint=False): out_.append(tuple((1 - t) ** 2 * a + 2 * (1 - t) * t * v + t * t * b))
    return out_
THROAT = {  # aberturas da garganta (triângulos de cantos arredondados)
    'butterfly': [[(-.008, -.121), (-.047, -.113), (-.012, -.172)], [(.008, -.121), (.047, -.113), (.012, -.172)]],      # borboleta (ponte central)
    'xfour': [[(-.03, -.114), (.03, -.114), (0, -.137)], [(-.011, -.152), (.011, -.152), (0, -.178)], [(-.046, -.116), (-.016, -.143), (-.026, -.16)], [(.046, -.116), (.016, -.143), (.026, -.16)]],
    'tri1': [[(-.028, -.125), (.028, -.125), (0, -.178)]],
    'atri': [[(-.03, -.122), (.03, -.122), (0, -.142)], [(-.017, -.15), (.017, -.15), (0, -.178)]],                    # "A": barra no meio
    'drop': [[(-.013, -.137), (.013, -.137), (0, -.168)]],
    'tri2': [[(-.011, -.121), (-.05, -.112), (-.017, -.171)], [(.011, -.121), (.05, -.112), (.017, -.171)]],
    'tri3': [[(-.05, -.112), (-.017, -.116), (-.033, -.15)], [(-.012, -.121), (.012, -.121), (0, -.158)], [(.05, -.112), (.017, -.116), (.033, -.15)]],
}
# desenhos de face: silhueta + furação + garganta (inspirados nas linhas de raquete do circuito 2025/2026, sem marca)
DESIGNS = {  # furações (as mesmas de antes, já aprovadas): o jogo escolhe uma por modelo e pinta a arte por cima
    'full': ('oval', .0072, lambda: grid(), 'tri1'),                                                               # furos no rosto todo
    'ring': ('oval', .0062, lambda: ring(.019, .025, -.085) + ring(.042, .027, -.07), 'tri1'),                      # duas voltas inteiras
    'side1': ('oval', .0068, lambda: ring(.021, .024, -.075, .1, lambda q: abs(q[0]) > .045), 'tri2'),              # uma fileira de cada lado
    'side2': ('oval', .0064, lambda: ring(.02, .023, -.075, .095, lambda q: abs(q[0]) > .04) + ring(.043, .025, -.05, .08, lambda q: abs(q[0]) > .04), 'tri3'),  # duas fileiras de cada lado
    'arc': ('oval', .0064, lambda: ring(.02, .024, .0, 1) + ring(.043, .026, .03, 1), 'tri2'),                      # arco no topo
    'band': ('oval', .0066, lambda: [(x, y) for x in (-.027, 0, .027) for y in np.arange(-.04, .12, .028) if inside(x, y)], 'tri3'),  # faixa central
}
for key, (shape, r, holes, thr) in DESIGNS.items():
    set_shape(shape)
    pts = spaced(holes(), r)
    loops = [OUTLINE] + [[(x + r * math.cos(a), y + r * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 10, endpoint=False)] for x, y in pts] + [rtri(t) for t in THROAT[thr]]
    me = add_curve('F_' + key, loops, THICK, BEV)
    # separa a face (tampas, com a arte) da borda (paredes e chanfro)
    bm = bmesh.new(); bm.from_mesh(me); bm.normal_update()
    me_c = bpy.data.meshes.new('F_' + key); bm2 = bm.copy(); bmesh.ops.delete(bm2, geom=[f for f in bm2.faces if abs(f.normal.z) <= .985], context='FACES'); bm2.to_mesh(me_c); bm2.free()
    me_w = bpy.data.meshes.new('E_' + key); bm3 = bm.copy(); bmesh.ops.delete(bm3, geom=[f for f in bm3.faces if abs(f.normal.z) > .985], context='FACES'); bm3.to_mesh(me_w); bm3.free(); bm.free()
    finish('F_' + key, me_c, lambda co, f: shape_uv(co, f)).data.materials.append(M_FACE)
    finish('E_' + key, me_w, lambda co, f: shape_uv(co, f), smooth_angle=math.radians(50)).data.materials.append(M_EDGE)
    print(key, shape, len(pts), 'furos')
# protetor de aro (um por silhueta): perfil em U achatado que abraça a borda da cabeça (do pescoço para cima)
M_BUMP = mat('Bumper', (.85, .85, .85), .6)
for shape in SHAPES:
    set_shape(shape)
    right_side = [p for p in OUTLINE if p[0] >= 0 and p[1] > -.07]; left_side = [p for p in OUTLINE if p[0] < 0 and p[1] > -.07]
    arc = sorted(right_side, key=lambda p: p[1]) + sorted(left_side, key=lambda p: -p[1])
    cu = bpy.data.curves.new('Bumper', 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('POLY'); sp.points.add(len(arc) - 1)
    for i, (x, y) in enumerate(arc): px, py = place(x, y); sp.points[i].co = (px, py, 0, 1)
    prof = bpy.data.curves.new('BumperProf', 'CURVE'); prof.dimensions = '2D'; ps = prof.splines.new('POLY')
    U = [(-.0035, -.0128), (.0030, -.0128), (.0052, -.0095), (.0058, 0), (.0052, .0095), (.0030, .0128), (-.0035, .0128)]
    ps.points.add(len(U) - 1)
    for i, (a, b) in enumerate(U): ps.points[i].co = (a, b, 0, 1)
    po = bpy.data.objects.new('BumperProf', prof); sc.collection.objects.link(po)
    cu.bevel_mode = 'OBJECT'; cu.bevel_object = po; cu.use_fill_caps = True
    ob = bpy.data.objects.new('BumperTmp', cu); sc.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get(); me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg)); bpy.data.objects.remove(ob); bpy.data.objects.remove(po)
    finish('Bumper_' + shape, me, smooth_angle=math.radians(60)).data.materials.append(M_BUMP)
# cabo: seção octogonal arredondada, alargando na ponteira; UV cilíndrico (o overgrip espiral vem da textura do jogo)
def lathe(name, prof_, seg=24, oct_=.06):
    bm = bmesh.new(); rings = []
    for (y, r) in prof_:
        ring_ = []
        for i in range(seg):
            a = i / seg * 2 * math.pi; rr = r * (1 + oct_ * math.cos(8 * a))  # facetas do cabo (oitavado suave)
            ring_.append(bm.verts.new((rr * math.cos(a), y, rr * math.sin(a) * .86)))
        rings.append(ring_)
    for j in range(len(rings) - 1):
        for i in range(seg): bm.faces.new([rings[j][i], rings[j][(i + 1) % seg], rings[j + 1][(i + 1) % seg], rings[j + 1][i]])
    bm.faces.new(rings[0][::-1]); bm.faces.new(rings[-1])
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    uv = me.uv_layers.new(name='UVMap')
    for f in me.polygons:
        for li in f.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co; uv.data[li].uv = ((math.atan2(v.z, v.x) / (2 * math.pi)) % 1, -v.y / .15)
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    for f in me.polygons: f.use_smooth = True
    return ob
# (o cabo é feito já no espaço do jogo: eixo y; não precisa deitar)
g = lathe('Grip', [(-.006, .0168), (-.02, .0170), (-.08, .0172), (-.13, .0176), (-.148, .0185), (-.153, .0172)])
g.rotation_euler = (math.pi / 2, 0, 0); g.data.materials.append(mat('Grip', (.08, .08, .09), .9))
c = lathe('Cap', [(.006, .0150), (.004, .0205), (-.004, .0215), (-.008, .0186)], oct_=.0)
c.rotation_euler = (math.pi / 2, 0, 0); c.data.materials.append(mat('Cap', (.9, .9, .9), .35))
# cordão (laço) saindo da ponteira
cu = bpy.data.curves.new('Leash', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = .0023; cu.bevel_resolution = 2
sp = cu.splines.new('NURBS'); L = [(0, .006, 0), (.018, .03, .004), (.012, .07, .009), (-.01, .072, .006), (-.02, .032, 0), (0, .006, 0)]
sp.points.add(len(L) - 1)
for i, (x, y, z) in enumerate(L): sp.points[i].co = (x, y, z, 1)
sp.order_u = 3; sp.use_endpoint_u = True
ob = bpy.data.objects.new('LeashTmp', cu); sc.collection.objects.link(ob)
dg = bpy.context.evaluated_depsgraph_get(); me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg)); bpy.data.objects.remove(ob)
lo = bpy.data.objects.new('Leash', me); sc.collection.objects.link(lo); lo.rotation_euler = (math.pi / 2, 0, 0); lo.data.materials.append(mat('Leash', (.03, .03, .035), .8))
for f in me.polygons: f.use_smooth = True

# aplica o giro na malha (o jogo usa só as geometrias, sem os nós)
for o in sc.objects:
    if o.type == 'MESH': o.data.transform(o.matrix_basis); o.matrix_basis.identity()
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_yup=True, export_apply=True, export_materials='PLACEHOLDER', export_normals=True)
print('OK', out, [o.name for o in sc.objects])

if RENDER:  # prévia: três faces lado a lado
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 32; sc.render.resolution_x, sc.render.resolution_y = 2400, 700
    for o in sc.objects: o.hide_render = True
    w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (.8, .85, .9, 1)
    keys = list(DESIGNS)
    for i, key in enumerate(keys):
        for nm in ('F_' + key, 'E_' + key, 'Bumper_' + DESIGNS[key][0], 'Grip', 'Cap', 'Leash'):
            o = sc.objects[nm].copy() if not nm.startswith(('F_', 'E_')) else sc.objects[nm]
            if o.name not in sc.collection.objects: sc.collection.objects.link(o)
            o.hide_render = False; o.location.x = (i - (len(keys) - 1) / 2) * .27
    sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN')); sun.data.energy = 4; sun.rotation_euler = (math.radians(30), 0, math.radians(20)); sc.collection.objects.link(sun)
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.location = (0, -2.6, -.25); cam.rotation_euler = (math.radians(90), math.radians(180), 0); cam.data.lens = 40
    sc.render.filepath = RENDER; bpy.ops.render.render(write_still=True)
