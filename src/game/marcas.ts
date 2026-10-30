// @ts-nocheck
// símbolos das marcas de raquete (estilizados a partir das raquetes e logos reais, nomes com uma letra trocada): o disco
// com o X da Herue's, o "nox" da Nux, o AMA angular da Ana Sport, o K de barra e chevron da Kona, o Z com a faixa verde
// da Zanb, a estrela-cometa da Drop Shut, a oval de traços da Mormaji, o olho com redemoinho da Vizion, a barbatana da
// Shank e as três faixas da Adibas. Desenha centrado em (cx, cy) com "raio" r (largura total ~2r); fg = cor principal
function brandMark(x, brand, cx, cy, r, fg, bg, o = {}) { // o.ring: centro vazado (Vizion); o.swirl: cor dos arcos (Vizion)
  const b = String(brand || '').toLowerCase(); x.save(); x.translate(cx, cy); x.fillStyle = fg; x.strokeStyle = fg; x.lineJoin = 'round'; x.lineCap = 'round';
  const poly = (pts, s = r) => { x.beginPath(); pts.forEach(([a, c], i) => i ? x.lineTo(a * s, c * s) : x.moveTo(a * s, c * s)); x.closePath(); x.fill(); };
  if (b.startsWith('herue')) { // disco vermelho, X branco vazado e quatro pontas finas saindo em diagonal
    x.fillStyle = '#e30613'; [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sy]) => poly([[sx * .42, sy * .5], [sx * 1.05, sy * 1.05], [sx * .5, sy * .42]]));
    x.beginPath(); x.arc(0, 0, r * .62, 0, Math.PI * 2); x.fill();
    x.strokeStyle = bg || '#ffffff'; x.lineCap = 'butt'; x.lineWidth = r * .2; x.beginPath(); x.moveTo(-r * .44, -r * .44); x.lineTo(r * .44, r * .44); x.moveTo(r * .44, -r * .44); x.lineTo(-r * .44, r * .44); x.stroke(); }
  else if (b.startsWith('nux')) { // "nux" minúsculo, arredondado (como o "nox")
    x.font = '700 ' + Math.round(r * 1.05) + 'px "Arial Rounded MT Bold", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('nux', 0, 0); }
  else if (b.startsWith('ana')) { // AMA: um zigue-zague grosso de pontas arredondadas (A-M-A emendados), os A com a barra de
    // baixo separada da perna de fora por um corte inclinado; desenhado numa grade 1050x250 (como o logo) e reescalado
    const k = r * 2.5 / 1050, X = v => (v - 525) * k, Y = v => (v - 135) * k;
    x.save(); x.beginPath(); x.rect(X(-60), Y(-10), 1170 * k, 260 * k); x.clip();
    x.lineWidth = 98 * k; x.lineJoin = 'round'; x.lineCap = 'butt'; x.beginPath();
    [[60, 262], [215, 52], [335, 240], [410, 52], [525, 240], [640, 52], [715, 240], [835, 52], [990, 262]].forEach(([a, c], i) => i ? x.lineTo(X(a), Y(c)) : x.moveTo(X(a), Y(c))); x.stroke();
    const q = pts => { x.beginPath(); pts.forEach(([a, c], i) => i ? x.lineTo(X(a), Y(c)) : x.moveTo(X(a), Y(c))); x.closePath(); x.fill(); };
    q([[205, 188], [330, 188], [330, 250], [160, 250]]); q([[845, 188], [720, 188], [720, 250], [890, 250]]); x.restore(); }
  else if (b.startsWith('kuna')) { // K de barra vertical + chevron, em degradê amarelo → verde → azul
    const g = x.createLinearGradient(-r, -r, r, r); g.addColorStop(0, '#f5e663'); g.addColorStop(.5, '#7ee0a8'); g.addColorStop(1, '#3aa0ff'); x.fillStyle = g;
    poly([[-.7, -.9], [-.38, -.9], [-.38, .9], [-.7, .9]]); poly([[.62, -.9], [.95, -.9], [.18, 0], [.95, .9], [.62, .9], [-.15, 0]]); }
  else if (b.startsWith('zanb')) { // Z com a faixa verde inclinada (o "A" do logo)
    poly([[-.85, -.6], [.25, -.6], [.25, -.35], [-.38, .38], [.25, .38], [.25, .6], [-.85, .6], [-.85, .35], [-.22, -.38], [-.85, -.38]]);
    x.fillStyle = '#21d67a'; poly([[.42, .6], [.78, -.6], [1.0, -.6], [.64, .6]]); }
  else if (b.startsWith('drop')) { // estrela de quatro pontas dourada com a ponta de baixo-esquerda longa (cometa)
    const g = x.createLinearGradient(r, -r, -r, r); g.addColorStop(0, '#ffd27a'); g.addColorStop(1, '#e8890c'); x.fillStyle = g;
    poly([[0, -.85], [.14, -.14], [.8, 0], [.14, .14], [-.75, 1.0], [-.14, .14], [-.65, 0], [-.14, -.14]]); }
  else if (b.startsWith('mormaji')) { // oval formada por três traços inclinados
    x.save(); x.rotate(-.5); x.beginPath(); x.ellipse(0, 0, r * .95, r * .55, 0, 0, Math.PI * 2); x.clip();
    for (let k = -1; k <= 1; k++) { x.fillRect(-r, k * r * .36 - r * .11, r * 2, r * .2); } x.restore(); }
  else if (b.startsWith('vizion')) { // olho: elipse inclinada no centro (cheia ou só o contorno) + dois arcos de redemoinho afinando nas pontas
    x.save(); x.rotate(-.4); x.beginPath(); x.ellipse(0, 0, r * .5, r * .32, 0, 0, Math.PI * 2);
    if (o.ring) { x.lineWidth = r * .1; x.stroke(); } else x.fill();
    if (o.swirl) x.strokeStyle = o.swirl;
    const arc = (rx, ry, a0, a1, w) => { for (let k = 0; k < 14; k++) { const t0 = a0 + (a1 - a0) * k / 14, t1 = a0 + (a1 - a0) * (k + 1) / 14; x.lineWidth = r * w * Math.sin(Math.PI * (k + .5) / 14); x.beginPath(); x.ellipse(0, 0, rx, ry, 0, t0, t1); x.stroke(); } };
    arc(r * .98, r * .62, Math.PI * .8, Math.PI * 1.9, .2); arc(r * .8, r * .5, -Math.PI * .2, Math.PI * .75, .16); x.restore(); }
  else if (b.includes('bee')) { // abelha da linha Poison Bee (Ana Sport): vista de cima, asas abertas, abdômen listrado e ferrão
    const y = o.stripe || '#f5c400';
    x.globalAlpha = .9; [[-1, -.2], [1, -.2], [-1, .12], [1, .12]].forEach(([sx, dy], i) => { x.save(); x.translate(sx * r * .32, r * dy); x.rotate(sx * (i < 2 ? -.5 : -.15)); x.beginPath(); x.ellipse(sx * r * .32, 0, r * (i < 2 ? .46 : .34), r * (i < 2 ? .2 : .15), 0, 0, Math.PI * 2); x.fillStyle = bg || '#fff'; x.fill(); x.lineWidth = r * .06; x.stroke(); x.restore(); }); x.globalAlpha = 1;
    x.beginPath(); x.arc(0, -r * .62, r * .16, 0, Math.PI * 2); x.fill(); // cabeça
    x.lineWidth = r * .05; x.beginPath(); x.moveTo(-r * .06, -r * .74); x.quadraticCurveTo(-r * .12, -r * .95, -r * .26, -r * .98); x.moveTo(r * .06, -r * .74); x.quadraticCurveTo(r * .12, -r * .95, r * .26, -r * .98); x.stroke();
    x.beginPath(); x.ellipse(0, -r * .32, r * .2, r * .17, 0, 0, Math.PI * 2); x.fill(); // tórax
    x.save(); x.beginPath(); x.moveTo(0, -r * .16); x.bezierCurveTo(r * .36, -r * .1, r * .32, r * .5, 0, r * .88); x.bezierCurveTo(-r * .32, r * .5, -r * .36, -r * .1, 0, -r * .16); x.fill(); x.clip();
    x.fillStyle = y; for (let k = 0; k < 3; k++) x.fillRect(-r * .5, r * (-.02 + k * .22), r, r * .1); x.restore(); }
  else if (b.startsWith('shank')) { // barbatana (o "A" do logo) com a cauda curva
    x.beginPath(); x.moveTo(-r * .9, r * .65); x.quadraticCurveTo(-r * .2, -r * .2, r * .25, -r * .95); x.quadraticCurveTo(r * .2, -r * .1, r * .55, r * .2); x.quadraticCurveTo(r * .75, r * .45, r * .95, r * .9); x.quadraticCurveTo(r * .55, r * .5, r * .2, r * .65); x.closePath(); x.fill(); }
  else if (b.startsWith('adibas')) { for (let k = 0; k < 3; k++) poly([[-.95 + k * .62, .75], [-.68 + k * .62, .75 - (.55 + k * .45)], [-.36 + k * .62, .75 - (.55 + k * .45)], [-.63 + k * .62, .75]]); }
  else { x.font = '900 ' + Math.round(r * 1.4) + 'px Arial Black, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText((brand || '?').slice(0, 1).toUpperCase(), 0, r * .05); }
  x.restore();
}
if (typeof window !== 'undefined') window.__pdoBrand = brandMark;
export { brandMark };
