import * as THREE from 'three';
import './styles.css';
import { preloadAssets } from './assets';

// O jogo faz a conversão de cores sRGB→linear por conta própria (como no three.js r128):
// desliga a conversão automática das versões novas para manter as mesmas cores.
THREE.ColorManagement.enabled = false;

// versão do jogo no menu principal (definida no build pelo vite.config.ts)
declare const __APP_VER__: string, __APP_BUILD__: string, __APP_DATE__: string;
{
  const v = typeof __APP_VER__ !== 'undefined' ? __APP_VER__ : '', b = typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : '', d = typeof __APP_DATE__ !== 'undefined' ? __APP_DATE__ : '';
  const el = document.getElementById('appVer');
  if (el && v) el.textContent = 'Versão ' + v.split('.')[0] + (b ? ' · build ' + b : '') + (d ? ' · ' + d.split('-').reverse().join('/') : '');
}

// Carrega modelos, texturas e som antes de montar a cena; depois executa os módulos do jogo,
// na mesma ordem do arquivo original (cada módulo importa o anterior; o último é o do modo online).
preloadAssets().then(() => import('./game/20-online'));
