const fs = require('fs');
const f = process.argv[2];
let s = fs.readFileSync(f, 'utf8');
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 90)); s = s.replace(a, b); };

// 1ª pessoa com o corpo do próprio jogador: some só a cabeça e o tronco, braços e raquete seguem as animações
rep("  human.model.group.visible = !fp; fpArm.visible = fp;", `  const fpBody = fp && !(human.skin && human.skinOn);
  setFpBody(fpBody);
  human.model.group.visible = !fp || fpBody; fpArm.visible = fp && !fpBody;`);
rep("function updateCamera(dt) {", `let fpBodyOn = false;
function setFpBody(on) {
  if (on === fpBodyOn && human.model.__fpModel === human.model) return;
  fpBodyOn = on; human.model.__fpModel = human.model;
  const m = human.model;
  m.headG.traverse(o => { if (o.isMesh) o.visible = !on; });
  m.spine.children.forEach(o => { if (o.isMesh) o.visible = !on; });
}
const _eye = new V3();
function updateCamera(dt) {`);
rep("    camPos.set(human.pos.x, (human.model.hips.position.y + .78) * hScale(human) + bob + human.model.group.position.y * .8, human.pos.z + .05);",
    "    if (fpBodyOn) { human.model.headG.localToWorld(_eye.set(0, .11, -.09)); camPos.copy(_eye); }\n    else camPos.set(human.pos.x, (human.model.hips.position.y + .78) * hScale(human) + bob + human.model.group.position.y * .8, human.pos.z + .05);");
// na espera em 1ª pessoa a raquete fica mais baixa e à direita para não tapar a bola
rep("  else poseAt(READY_KEYS, READY_U, 0, pose);", "  else poseAt(p === human && fpBodyOn ? READY_FP_KEYS : READY_KEYS, READY_U, 0, pose);");
rep("const READY_KEYS = [READY, READY], READY_U = [0, 1];", "const READY_KEYS = [READY, READY], READY_U = [0, 1];\nconst READY_FP = P({ rh: [.3, .2, -.36], rp: [.9, -.6, .3], wx: 1.25, wr: 1.0, lh: [-.06, .18, -.34] });\nconst READY_FP_KEYS = [READY_FP, READY_FP];");
fs.writeFileSync(f, s);
console.log('ok');
