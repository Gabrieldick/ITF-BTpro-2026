const fs = require('fs'); const f = process.argv[2]; let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 80)); s = s.replace(a, b); };
rep(`        <input type="radio" name="cam" id="cam1" value="1p"><label for="cam1">1ª pessoa</label>
      </div></fieldset>`, `        <input type="radio" name="cam" id="cam1" value="1p"><label for="cam1">1ª pessoa</label>
      </div><label style="display:flex;align-items:center;gap:.5rem;margin-top:.45rem;font-size:.85rem">FOV da 1ª pessoa <input type="range" id="fovFp" min="55" max="110" step="1" value="72" style="flex:1"> <span id="fovFpV">72°</span></label></fieldset>`);
rep("uniforms: 'uniforme', side: 'direita' },", "uniforms: 'uniforme', side: 'direita', fovFp: 72 },");
rep("  camera.fov = fp ? 72 : (dupla() ? 58 : 55); camera.updateProjectionMatrix();", "  camera.fov = fp ? (S.settings.fovFp || 72) : (dupla() ? 58 : 55); camera.updateProjectionMatrix();\n  const r = $('fovFp'); if (r) { r.value = S.settings.fovFp || 72; $('fovFpV').textContent = r.value + '°'; }");
// teclas - e = ajustam o FOV durante o jogo
rep("  else if (k === 'b') toggleAssist('assistMove');", "  else if (k === '-' || k === '=' || k === '+') adjustFov(k === '-' ? -5 : 5);\n  else if (k === 'b') toggleAssist('assistMove');");
rep("function toggleAssist(k) {", `function adjustFov(d) {
  S.settings.fovFp = clamp((S.settings.fovFp || 72) + d, 55, 110); saveSettings(); applyCam();
  feedback('FOV ' + S.settings.fovFp + '°', S.settings.cam === '1p' ? '1ª PESSOA' : 'VALE NA 1ª PESSOA', null);
}
$('fovFp').addEventListener('input', e => { S.settings.fovFp = +e.target.value; $('fovFpV').textContent = e.target.value + '°'; saveSettings(); applyCam(); });
function toggleAssist(k) {`);
fs.writeFileSync(f, s); console.log('ok');
