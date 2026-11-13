# Gera as falas das entrevistas com a voz neural Kokoro (pesos Apache 2.0) em public/assets/voz/<voz>/<hash>.ogg
# Uso: python3 -I ferramentas/vozes/gerar.py <modelo.onnx> <voices.bin>   (pip install kokoro-onnx soundfile; precisa de ffmpeg)
# textos.json sai do jogo (window.__pdoHist / __pdoLivre); falado.json troca nomes ({p}, {o}…) por algo que dá para falar.
import json, os, re, subprocess, sys, tempfile
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
k = Kokoro(sys.argv[1], sys.argv[2]); man = {}
for pasta, (voz, textos) in VOZES.items():
    os.makedirs(os.path.join(OUT, pasta), exist_ok=True); man[pasta] = []
    for t in sorted(textos):
        fala = F.get(t, t); fala = re.sub(r'\(.*?\)', '', fala).strip()
        if '{' in fala or not fala: print('pulei', t); continue
        nome = h(t); dst = os.path.join(OUT, pasta, nome + '.ogg'); man[pasta].append(nome)
        if os.path.exists(dst): continue
        s, sr = k.create(fala, voice=voz, speed=1.05 if pasta[0] == 'r' else 1.0, lang='pt-br')
        with tempfile.NamedTemporaryFile(suffix='.wav') as w:
            sf.write(w.name, s, sr)
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', w.name, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse', '-c:a', 'libopus', '-b:a', '28k', '-ac', '1', dst], check=True)
        print(pasta, nome, fala[:60], flush=True)
json.dump(man, open(os.path.join(OUT, 'index.json'), 'w'))
print('pronto', {p: len(v) for p, v in man.items()})
