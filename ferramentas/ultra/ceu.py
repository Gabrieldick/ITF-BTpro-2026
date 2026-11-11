# Prepara o céu fotográfico do modo Ultrarrealista a partir de um HDRI "pure sky" do Poly Haven (CC0):
#   sky.jpg  — metade de cima do céu (8192×2048, sRGB) para o fundo
#   env.hdr  — 1024×512 para a iluminação (sol limitado, chão trocado pela cor da areia)
#   ceu.json — onde está o sol na imagem e as escalas para a luz bater com o sol do jogo
# uso: python ceu.py <hdri 8k .hdr> <pasta de saída>
import sys, json, numpy as np, cv2
src, out = sys.argv[1], sys.argv[2]
im = cv2.imread(src, cv2.IMREAD_UNCHANGED)[:, :, ::-1].astype(np.float32)  # RGB linear
H, W = im.shape[:2]
lum = im @ np.array([.2126, .7152, .0722], np.float32)
# sol: centro do brilho máximo (média ponderada dos pixels mais fortes)
thr = np.percentile(lum, 99.995); ys, xs = np.nonzero(lum >= thr); w = lum[ys, xs]
sy, sx = float((ys * w).sum() / w.sum()), float((xs * w).sum() / w.sum())
elev = (0.5 - (sy + .5) / H) * np.pi; u0 = (sx + .5) / W
# direção de cada pixel (convenção do three: u = atan2(z, x)/2π + .5, v = asin(y)/π + .5; v=1 no alto)
v = 1 - (np.arange(H) + .5) / H; u = (np.arange(W) + .5) / W
lat = (v - .5) * np.pi; lon = (u - .5) * 2 * np.pi
dy = np.sin(lat)[:, None] * np.ones((1, W)); dxz = np.cos(lat)[:, None]
dx = dxz * np.cos(lon)[None, :]; dz = dxz * np.sin(lon)[None, :]
sd = np.array([np.cos(elev) * np.cos((u0 - .5) * 2 * np.pi), np.sin(elev), np.cos(elev) * np.sin((u0 - .5) * 2 * np.pi)])
cosS = dx * sd[0] + dy * sd[1] + dz * sd[2]
dOm = (np.pi / H) * (2 * np.pi / W) * np.cos(lat)[:, None] * np.ones((1, W))
up = dy > 0; sunM = cosS > np.cos(np.radians(4.0))
E_sun = float((lum * np.maximum(dy, 0) * dOm)[sunM].sum())           # irradiância horizontal do disco do sol (+halo)
E_sky = float((lum * np.maximum(dy, 0) * dOm)[up & ~sunM].sum())      # do resto do céu
E_sunN = float((lum * np.maximum(cosS, 0) * dOm)[sunM].sum())         # irradiância do sol numa superfície virada para ele
print('sol: elevação %.1f°, u0 %.4f | E_sol(horizontal) %.1f, E_céu %.1f → céu = %.0f%% do total' % (np.degrees(elev), u0, E_sun, E_sky, 100 * E_sky / (E_sun + E_sky)))
# escala: no jogo o sol é uma luz direcional de intensidade 2,5π (irradiância numa superfície virada para ele);
# o céu entra na mesma unidade
K = (2.5 * np.pi) / E_sunN
sky = im * K
# ---- env.hdr (iluminação): sol limitado (a luz direcional do jogo já é o sol) e chão = areia clara iluminada ----
env = sky.copy()
lim = np.percentile((lum * K)[up & ~sunM], 99.9) * 1.5
env = np.minimum(env, lim)
hor = env[int(H * .47):int(H * .495)].reshape(-1, 3).mean(0)          # cor média do horizonte
E_tot = 2.5 * np.pi * np.sin(elev) + E_sky * K
sand = np.array([.80, .72, .58], np.float32) * (E_tot / np.pi) * .9   # luz que a areia devolve (difusa)
t = np.clip((-dy) / .12, 0, 1)[:, :, None]                            # transição suave abaixo do horizonte
env = env * (1 - t) + (hor * (1 - np.clip((-dy) / .5, 0, 1)[:, :, None] * .0) * 0 + sand) * t
env = cv2.resize(env, (1024, 512), interpolation=cv2.INTER_AREA)
cv2.imwrite(out + '/env.hdr', np.ascontiguousarray(env[:, :, ::-1]).astype(np.float32))
# ---- sky.jpg (fundo): metade de cima. Guardado comprimido (e = L/(L+1), invertido no shader: L = e/(1−e)) para caber
# do azul do céu (L≈0,3) às nuvens ao lado do sol (L≈6+) em 8 bits; o disco do sol o shader desenha por cima ----
top = sky[:H // 2]
white = 1.0
enc = np.clip(top / (top + white), 0, .985)
enc = np.where(enc <= .0031308, enc * 12.92, 1.055 * np.power(enc, 1 / 2.4) - .055)
cv2.imwrite(out + '/sky.jpg', (enc[:, :, ::-1] * 255 + .5).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 92])
meta = dict(u0=u0, elev=float(elev), white=white, sunE=2.5 * np.pi, skyE=E_sky * K, horizon=[float(x) for x in hor], lim=float(lim))
json.dump(meta, open(out + '/ceu.json', 'w')); print(meta)
