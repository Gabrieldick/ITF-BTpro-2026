#!/bin/sh
# gera os dois modelos do jogo (public/assets/mh-male.glb e mh-female.glb) com todas as peças; o jogo escolhe e pinta.
# Precisa do Blender como módulo Python:  python3 -m venv blend && blend/bin/pip install bpy   (e ./baixar.sh antes)
set -e
cd "$(dirname "$0")"; PY=${PY:-blend/bin/python}; OUT=../../public/assets
$PY build.py $OUT/mh-male.glb '{"gender":"male","all":1,"muscle":0.7,"weight":0.42,"height":0.5,"skin":"#d9a982","hair":"#7a7a7a","brow":"#2a1e16","beard":0.55,"shirt":"#ffffff","shorts":"#ffffff","texRes":2048}'
$PY build.py $OUT/mh-female.glb '{"gender":"female","all":1,"muscle":0.62,"weight":0.4,"height":0.5,"skin":"#d9a982","hair":"#7a7a7a","brow":"#2a1e16","beard":0,"shirt":"#ffffff","shorts":"#ffffff","skirtC":"#ffffff","ponytail":2.5,"cup":0.15,"texRes":2048}'
