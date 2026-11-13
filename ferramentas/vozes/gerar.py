# Gera as falas das entrevistas com a voz neural Kokoro (pesos Apache 2.0) em public/assets/voz/<voz>/<hash>.ogg
# Uso: python3 -I ferramentas/vozes/gerar.py <modelo.onnx> <voices.bin>   (pip install kokoro-onnx soundfile; precisa de ffmpeg)
# textos.json sai do jogo (window.__pdoHist / __pdoLivre); falado.json troca nomes ({p}, {o}…) por algo que dá para falar.
import json, os, re, subprocess, sys, tempfile
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro
AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(os.path.dirname(AQUI))
OUT = os.path.join(RAIZ, 'public', 'assets', 'voz')
def h(s):  # FNV-1a 32 bits do texto em UTF-8 (o jogo calcula igual)
    x = 0x811c9dc5
    for b in s.encode('utf-8'): x = ((x ^ b) * 0x01000193) & 0xffffffff
    return format(x, '08x')
T = json.load(open(os.path.join(AQUI, 'textos.json'))); F = json.load(open(os.path.join(AQUI, 'falado.json')))
rep, jog = set(), set()   # repórter fala perguntas; jogador fala respostas
for k, qs in T['QA'].items():
    for q in qs: rep.add(q['q']); jog.update(q['a'].values())
for v in T['Q_OPEN'].values(): rep.update(x for x in v if x.strip())
for v in T['A_OPEN'].values(): jog.update(x for x in v if x.strip())
rep.update(T['FAN'])
VOZES = {'rm': ('pm_santa', rep), 'rf': ('pf_dora', rep), 'jm': ('pm_alex', jog), 'jf': ('pf_dora', jog)}
WH = re.compile(r'^(o que|que |qual|quais|como|quem|para quem|onde|por que|quando|quanto|de onde)', re.I)
def pergunta(s, sr, fala):
    # o modelo quase não sobe o tom no "?": sobe a altura no fim da frase (mais nas perguntas de sim/não, que sobem no português)
    a = np.abs(s); i = len(s) - 1
    while i > 0 and a[i] < 0.01: i -= 1
    end = i + 1; tail = int(sr * .6); st = max(0, end - tail)
    top = 1.07 if WH.search(fala.split('?')[0].split('.')[-1].split(':')[-1].strip()) else 1.14
    out = [s[:st]]; n = 6; L = (end - st) // n
    for j in range(n):
        c = s[st + j * L: st + (j + 1) * L if j < n - 1 else end]; f = 1 + (top - 1) * ((j + 1) / n) ** 1.4
        m = max(2, int(len(c) / f)); c2 = np.interp(np.linspace(0, len(c) - 1, m), np.arange(len(c)), c)
        fd = min(64, len(c2) // 4, len(out[-1]))
        if fd > 0: r = np.linspace(0, 1, fd); c2[:fd] = out[-1][-fd:] * (1 - r) + c2[:fd] * r; out[-1] = out[-1][:-fd]
        out.append(c2)
    out.append(s[end:]); return np.concatenate(out).astype(np.float32)
k = Kokoro(sys.argv[1], sys.argv[2]); man = {}
for pasta, (voz, textos) in VOZES.items():
    os.makedirs(os.path.join(OUT, pasta), exist_ok=True); man[pasta] = []
    for t in sorted(textos):
        fala = F.get(t, t); fala = re.sub(r'\(.*?\)', '', fala).strip()
        if '{' in fala or not fala: print('pulei', t); continue
        nome = h(t); dst = os.path.join(OUT, pasta, nome + '.ogg'); man[pasta].append(nome)
        if os.path.exists(dst): continue
        s, sr = k.create(fala, voice=voz, speed=1.05 if pasta[0] == 'r' else 1.0, lang='pt-br')
        if fala.rstrip().endswith('?'): s = pergunta(s, sr, fala)
        with tempfile.NamedTemporaryFile(suffix='.wav') as w:
            sf.write(w.name, s, sr)
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', w.name, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse', '-c:a', 'libopus', '-b:a', '28k', '-ac', '1', dst], check=True)
        print(pasta, nome, fala[:60], flush=True)
json.dump(man, open(os.path.join(OUT, 'index.json'), 'w'))
print('pronto', {p: len(v) for p, v in man.items()})
