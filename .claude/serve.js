// Servidor estático simples para testar o jogo no navegador (node .claude/serve.js)
// POST /__shot?name=x grava uma captura PNG enviada pela página (para conferir o visual com o painel oculto)
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const root = path.join(__dirname, '..');
const shots = process.env.SHOT_DIR || path.join(os.tmpdir(), 'golden-point-shots');
fs.mkdirSync(shots, { recursive: true });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.bin': 'application/octet-stream', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  if (req.method === 'POST' && req.url.startsWith('/__shot')) {
    const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'shot').replace(/[^\w-]/g, '');
    let body = ''; req.on('data', c => { body += c; });
    req.on('end', () => {
      const b64 = body.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(path.join(shots, name + '.png'), Buffer.from(b64, 'base64'));
      res.writeHead(200); res.end('ok');
    });
    return;
  }
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(8766, () => console.log('http://localhost:8766  capturas em ' + shots));
