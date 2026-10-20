import * as THREE from 'three';
import './styles.css';
import { preloadAssets } from './assets';

// O jogo faz a conversão de cores sRGB→linear por conta própria (como no three.js r128):
// desliga a conversão automática das versões novas para manter as mesmas cores.
THREE.ColorManagement.enabled = false;

// Carrega modelos, texturas e som antes de montar a cena; depois executa os módulos do jogo,
// na mesma ordem do arquivo original (cada módulo importa o anterior; o último é o do modo online).
preloadAssets().then(() => import('./game/20-online'));
