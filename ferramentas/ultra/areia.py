# Texturas de areia fotografadas (Poly Haven, CC0) no formato do modo Ultrarrealista:
#   areia-n.jpg  — relevo fino (normal, 2048) da areia revolvida (sand_01, 1,5 m por repetição)
#   areia-d.jpg  — detalhe de cor: luminância da foto dividida pela média (o jogo multiplica pela cor da areia de cada arena) + oclusão
#   praia-n.jpg  — relevo largo (normal, 1024) com as ondulações da praia vista de cima (aerial_beach_01, 30 m por repetição)
# uso: python areia.py <pasta com os jpg baixados> <pasta de saída>
import sys, numpy as np, cv2
src, out = sys.argv[1], sys.argv[2]
n = cv2.imread(src + '/sand_01_nor_gl_2k.jpg'); cv2.imwrite(out + '/areia-n.jpg', n, [cv2.IMWRITE_JPEG_QUALITY, 88])
d = cv2.imread(src + '/sand_01_diff_2k.jpg').astype(np.float32) / 255; ao = cv2.imread(src + '/sand_01_ao_2k.jpg', 0).astype(np.float32) / 255
lin = np.power(d, 2.2); lum = lin @ np.array([.0722, .7152, .2126], np.float32)
big = cv2.GaussianBlur(lum, (0, 0), 160)                      # tira as manchas grandes (a repetição não aparece de longe)
det = np.clip(lum / big * (.55 + .45 * ao) * .5, 0, 1)        # 0,5 = neutro
cv2.imwrite(out + '/areia-d.jpg', (np.power(det, 1 / 2.2) * 255 + .5).astype(np.uint8), [cv2.IMWRITE_JPEG_QUALITY, 88])
p = cv2.imread(src + '/aerial_beach_01_nor_gl_2k.jpg'); cv2.imwrite(out + '/praia-n.jpg', cv2.resize(p, (1024, 1024), interpolation=cv2.INTER_AREA), [cv2.IMWRITE_JPEG_QUALITY, 88])
print('ok')
