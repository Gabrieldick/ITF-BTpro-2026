const M = require('./carolread.js')(process.argv[2]);
M.forEach((m, k) => { let mn = [9, 9, 9], mx = [-9, -9, -9]; for (let i = 0; i < m.n; i++) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], m.P[i*3+c]); mx[c] = Math.max(mx[c], m.P[i*3+c]); } console.log(k, m.n, mn.map(v => v.toFixed(3)).join(','), mx.map(v => v.toFixed(3)).join(',')); });
const B = M[0]; const bins = {};
for (let i = 0; i < B.n; i++) { const x = B.P[i*3], y = B.P[i*3+1], z = B.P[i*3+2]; const b = Math.round(y * 25) / 25; const Q = bins[b] || (bins[b] = { xs: [] }); Q.xs.push([x, z]); }
Object.keys(bins).map(Number).sort((a, b) => a - b).forEach(b => {
  const xs = bins[b].xs.map(p => p[0]).sort((a, c) => a - c);
  // grupos separados em x (pernas/braços/tronco)
  const groups = []; let g = [xs[0], xs[0]]; for (const x of xs) { if (x - g[1] > .02) { groups.push(g); g = [x, x]; } else g[1] = x; } groups.push(g);
  const zs = bins[b].xs.filter(p => Math.abs(p[0]) < .12).map(p => p[1]);
  console.log(b.toFixed(2), groups.map(g => '[' + g[0].toFixed(3) + ',' + g[1].toFixed(3) + ']').join(' '), 'z', zs.length ? Math.min(...zs).toFixed(3) + '..' + Math.max(...zs).toFixed(3) : '');
});
