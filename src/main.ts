import * as THREE from 'three';
import './styles.css';
import { preloadAssets } from './assets';

// O jogo faz a conversão de cores sRGB→linear por conta própria (como no three.js r128):
// desliga a conversão automática das versões novas para manter as mesmas cores.
THREE.ColorManagement.enabled = false;

// campos que não são de login: os gerenciadores de senha (1Password, LastPass, Bitwarden, Proton Pass…) não devem oferecer
// preencher nem criar alias de e-mail neles (ex.: o campo de altura do jogador). Vale também para os criados depois
{
  const LOGIN = new Set(['clEmail', 'clPw', 'clResetPw', 'clResetPw2']);
  const mark = (i: Element) => {
    if (!(i instanceof HTMLInputElement) || LOGIN.has(i.id) || i.type === 'password' || i.type === 'email' || i.dataset.formType) return;
    if (!['text', 'search', 'number', 'tel', ''].includes(i.type)) return;
    i.setAttribute('autocomplete', 'off'); i.setAttribute('data-1p-ignore', ''); i.setAttribute('data-lpignore', 'true');
    i.setAttribute('data-bwignore', 'true'); i.setAttribute('data-protonpass-ignore', 'true'); i.setAttribute('data-form-type', 'other');
  };
  const scan = (root: ParentNode) => root.querySelectorAll('input').forEach(mark);
  const start = () => { scan(document); new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n instanceof HTMLInputElement) mark(n); else if (n instanceof Element) scan(n); }))).observe(document.body, { childList: true, subtree: true }); };
  if (document.body) start(); else addEventListener('DOMContentLoaded', start);
}

// versão do jogo no menu principal (definida no build pelo vite.config.ts)
declare const __APP_VER__: string, __APP_BUILD__: string, __APP_DATE__: string, __APP_LOG__: string[][];
{
  const v = typeof __APP_VER__ !== 'undefined' ? __APP_VER__ : '', b = typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : '', d = typeof __APP_DATE__ !== 'undefined' ? __APP_DATE__ : '';
  const el = document.getElementById('appVer');
  if (el && v) el.textContent = 'Versão ' + v.split('.')[0] + (b ? ' · build ' + b : '') + (d ? ' · ' + d.split('-').reverse().join('/') : '');
  // botão "i": últimas mudanças, agrupadas por dia
  const log = typeof __APP_LOG__ !== 'undefined' ? __APP_LOG__ : [], btn = document.getElementById('btnLog'), ov = document.getElementById('logOv'), list = document.getElementById('logList');
  if (btn && ov && list && log.length) {
    btn.hidden = false;
    const esc = (t: string) => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
    let html = '', day = '';
    for (const [dt, msg] of log) {
      if (dt !== day) { html += (day ? '</ul>' : '') + '<h4>' + dt.split('-').reverse().join('/') + '</h4><ul>'; day = dt; }
      html += '<li>' + esc(msg || '') + '</li>';
    }
    list.innerHTML = html + '</ul>';
    btn.addEventListener('click', () => { ov.hidden = false; });
    document.getElementById('logClose')?.addEventListener('click', () => { ov.hidden = true; });
  }
}

// Carrega modelos, texturas e som antes de montar a cena; depois executa os módulos do jogo,
// na mesma ordem do arquivo original (cada módulo importa o anterior; o último é o de amigos e chat).
preloadAssets().then(() => import('./game/21-amigos'));
