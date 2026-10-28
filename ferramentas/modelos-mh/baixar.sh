#!/bin/sh
# baixa do repositório do MakeHuman (tudo CC0) só o que o gerador usa: malha base, esqueleto, pesos e formas do corpo
set -e
cd "$(dirname "$0")"; D=mh/data; R=https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data
get() { mkdir -p "$D/$(dirname "$1")"; [ -s "$D/$1" ] || curl -sSf --max-time 300 -o "$D/$1" "$R/$1"; }
get 3dobjs/base.obj; get rigs/default.mhskel; get rigs/default_weights.mhw
for g in male female; do
  for r in caucasian african asian; do get targets/macrodetails/$r-$g-young.target; done
  for m in min average max; do for w in min average max; do
    [ "$m$w" = averageaverage ] || get targets/macrodetails/universal-$g-young-${m}muscle-${w}weight.target
  done; done
  get targets/macrodetails/height/$g-young-averagemuscle-averageweight-maxheight.target
  get targets/macrodetails/height/$g-young-averagemuscle-averageweight-minheight.target
  get targets/macrodetails/proportions/$g-young-averagemuscle-averageweight-idealproportions.target
done
get targets/breast/female-young-averagemuscle-averageweight-maxcup-averagefirmness.target
get targets/breast/female-young-averagemuscle-averageweight-averagecup-maxfirmness.target
echo ok
