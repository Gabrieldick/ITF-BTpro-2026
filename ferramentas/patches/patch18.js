const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };

rep('#loading {', `.tag {
  position: fixed; z-index: 4; transform: translate(-50%, -100%); pointer-events: none; white-space: nowrap;
  display: flex; align-items: center; gap: 6px; padding: 3px 9px 3px 7px; border-radius: 999px;
  background: rgba(15, 36, 54, .72); color: var(--foam); font: 800 12px var(--f-body); letter-spacing: .04em;
  border: 1.5px solid rgba(251, 246, 234, .25); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
}
.tag::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--buoy); }
.tag.t1::before { background: #7fd6db; }
.tag.me { border-color: var(--buoy); }
.tag b { font-family: var(--f-num); font-size: 11px; color: var(--gold); }
.tag em { font-style: normal; font-size: 10px; letter-spacing: .12em; color: #ffc7a8; }
body.in-menu .tag { display: none; }

#loading {`);
rep('<div id="fb"></div>', '<div id="fb"></div>\n<div id="tags"></div>');
rep("function updateVisuals(dt) {", `// etiqueta com nome e overall acima de cada jogador
const _tv = new V3();
const TAGS = new Map();
function tagFor(p) {
  let t = TAGS.get(p);
  if (!t) { t = document.createElement('div'); t.className = 'tag'; $('tags').appendChild(t); TAGS.set(p, t); }
  return t;
}
function updateTags(fp) {
  for (const p of ALL) {
    const t = tagFor(p);
    const show = S.mode !== 'menu' && players.includes(p) && !(fp && p === human);
    if (!show) { t.hidden = true; continue; }
    _tv.set(p.pos.x, 2.12 + p.model.group.position.y, p.pos.z).project(camera);
    if (_tv.z > 1 || Math.abs(_tv.x) > 1.2 || Math.abs(_tv.y) > 1.2) { t.hidden = true; continue; }
    t.hidden = false;
    const key = (p.char ? p.char.id + nameOf(p.char) : p.name) + (p === human);
    if (t.dataset.k !== key) {
      t.dataset.k = key;
      t.className = 'tag t' + p.team + (p === human ? ' me' : '');
      t.innerHTML = '';
      if (p === human) { const e = document.createElement('em'); e.textContent = 'VOCÊ'; t.append(e); }
      t.append(p.char ? shortOf(p.char) : p.name);
      if (p.char) { const b = document.createElement('b'); b.textContent = overall(p.char.a); t.append(b); }
    }
    t.style.left = ((_tv.x * .5 + .5) * innerWidth) + 'px';
    t.style.top = ((-_tv.y * .5 + .5) * innerHeight) + 'px';
  }
}
function updateVisuals(dt) {`);
rep("  placeMeter(fp);", "  placeMeter(fp);\n  updateTags(fp);");
fs.writeFileSync(f, s);
console.log('ok');
