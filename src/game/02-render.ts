// @ts-nocheck
// renderizador, cena, luzes e texturas
import './01-estado';
import * as THREE from 'three';
import { V3 } from './00-base';
// ---------- Renderer & scene ----------
const host = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
host.appendChild(renderer.domElement);
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();
const col = h => new THREE.Color(h).convertSRGBToLinear();
function mat(hex, o) { return new THREE.MeshStandardMaterial(Object.assign({ color: col(hex), roughness: .8, metalness: 0, envMapIntensity: .8 }, o || {})); }
function canvasTex(w, h, draw, srgb) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = MAX_ANISO;
  if (srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const scene = new THREE.Scene();
const HORIZON = new THREE.Color(0.58, 0.72, 0.84);
scene.fog = new THREE.Fog(HORIZON, 140, 1400);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.05, 3200);
camera.position.set(0, 6, 16);
scene.add(camera);
const SUN_DIR = new V3(0.62, 0.66, -0.42).normalize();
const hemi = new THREE.HemisphereLight(col('#bfdcff'), col('#d9bf8c'), 0.35 * Math.PI);
scene.add(hemi);
const sun = new THREE.DirectionalLight(col('#fff3e2'), 2.5 * Math.PI);
sun.position.copy(SUN_DIR).multiplyScalar(40);
sun.castShadow = true;
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 5, far: 90 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun); scene.add(sun.target);

export { HORIZON, MAX_ANISO, SUN_DIR, camera, canvasTex, col, hemi, mat, renderer, scene, sun };
