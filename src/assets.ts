// Recursos do jogo (modelos, texturas, som).
// No site eles vêm de public/assets; no HTML de arquivo único vêm embutidos em base64 (tags <script id="...">).
export const ASSET_FILES: Record<string, string> = {
  'glb-male': 'Soldier.glb',
  'glb-female': 'Michelle.glb',
  'uni-m': 'uniform-m.bin',
  'uni-f': 'uniform-f.bin',
  'carol-geo': 'carol.bin',
  'carol-tex0': 'carol-tex0.jpg',
  'carol-tex3': 'carol-tex3.jpg',
  'carol-tex4': 'carol-tex4.jpg',
  'carol-tex5': 'carol-tex5.jpg',
  'carol-tex6': 'carol-tex6.jpg',
  'carol-tex7': 'carol-tex7.jpg',
  'carol-tex8': 'carol-tex8.jpg',
  'male-geo': 'male.bin',
  'male-col': 'male-col.jpg',
  'snd-hits': 'hits.mp3',
};

const buffers = new Map<string, ArrayBuffer>();
const urls = new Map<string, string>();

function fromBase64(text: string): ArrayBuffer {
  const bin = atob(text);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

async function loadOne(id: string, file: string): Promise<void> {
  let buf: ArrayBuffer | null = null;
  const embedded = document.getElementById(id);
  if (embedded && embedded.textContent && embedded.textContent.trim()) {
    buf = fromBase64(embedded.textContent.trim());
  } else {
    try {
      const res = await fetch(import.meta.env.BASE_URL + 'assets/' + file);
      if (res.ok) buf = await res.arrayBuffer();
    } catch {
      buf = null; // sem o recurso o jogo usa o desenho/som alternativo
    }
  }
  if (!buf) return;
  buffers.set(id, buf);
  if (file.endsWith('.jpg')) urls.set(id, URL.createObjectURL(new Blob([buf], { type: 'image/jpeg' })));
}

export async function preloadAssets(): Promise<void> {
  await Promise.all(Object.entries(ASSET_FILES).map(([id, file]) => loadOne(id, file)));
}

/** Conteúdo binário de um recurso (ou null se não carregou). */
export const assetBuf = (id: string): ArrayBuffer | null => buffers.get(id) || null;
/** URL de imagem de um recurso (ou null). */
export const assetUrl = (id: string): string | null => urls.get(id) || null;
