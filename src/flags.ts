// bandeiras desenhadas em SVG (o Windows não mostra emoji de bandeira)
// cada desenho usa viewBox 0 0 30 20

const h3 = (a: string, b: string, c: string, mid = 1) => { const t = 20 / (2 + mid); return `<rect width="30" height="20" fill="${b}"/><rect width="30" height="${t}" fill="${a}"/><rect y="${20 - t}" width="30" height="${t}" fill="${c}"/>`; };
const v3 = (a: string, b: string, c: string) => `<rect width="10" height="20" fill="${a}"/><rect x="10" width="10" height="20" fill="${b}"/><rect x="20" width="10" height="20" fill="${c}"/>`;
const h2 = (a: string, b: string) => `<rect width="30" height="10" fill="${a}"/><rect y="10" width="30" height="10" fill="${b}"/>`;
const star = (cx: number, cy: number, r: number, fill: string) => {
  let d = '';
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .42 : r; d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(2) + ' ' + (cy + Math.sin(a) * rr).toFixed(2); }
  return `<path d="${d}Z" fill="${fill}"/>`;
};

const DRAW: Record<string, string> = {
  BRA: `<rect width="30" height="20" fill="#009b3a"/><path d="M15 2.2 27.6 10 15 17.8 2.4 10Z" fill="#fedf00"/><circle cx="15" cy="10" r="4.4" fill="#002776"/><path d="M10.8 9.2q4.4-1.4 8.4 1.6" stroke="#fff" stroke-width=".8" fill="none"/>`,
  ITA: v3('#009246', '#fff', '#ce2b37'),
  FRA: v3('#0055a4', '#fff', '#ef4135'),
  ESP: h3('#aa151b', '#f1bf00', '#aa151b', 2),
  RUS: h3('#fff', '#0039a6', '#d52b1e'),
  POR: `<rect width="30" height="20" fill="#da291c"/><rect width="12" height="20" fill="#046a38"/><circle cx="12" cy="10" r="3.6" fill="#ffe900"/><circle cx="12" cy="10" r="2" fill="#da291c"/>`,
  ARG: h3('#74acdf', '#fff', '#74acdf') + `<circle cx="15" cy="10" r="2" fill="#f6b40e"/>`,
  LAT: h3('#9e3039', '#fff', '#9e3039', .5),
  VEN: h3('#ffcc00', '#00247d', '#cf142b') + [0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = Math.PI * (.2 + .6 * i / 7); return `<circle cx="${(15 - Math.cos(a) * 4.2).toFixed(2)}" cy="${(11.6 - Math.sin(a) * 3.2).toFixed(2)}" r=".45" fill="#fff"/>`; }).join(''),
  USA: Array.from({ length: 13 }, (_, i) => `<rect y="${(i * 20 / 13).toFixed(2)}" width="30" height="${(20 / 13 + .02).toFixed(2)}" fill="${i % 2 ? '#fff' : '#b22234'}"/>`).join('') + `<rect width="12" height="10.8" fill="#3c3b6e"/>`,
  GER: h3('#000', '#dd0000', '#ffce00'),
  NED: h3('#ae1c28', '#fff', '#21468b'),
  BEL: v3('#000', '#fdda24', '#ef3340'),
  SUI: `<rect width="30" height="20" fill="#da291c"/><rect x="13" y="4" width="4" height="12" fill="#fff"/><rect x="9" y="8" width="12" height="4" fill="#fff"/>`,
  GBR: `<rect width="30" height="20" fill="#012169"/><path d="M0 0 30 20M30 0 0 20" stroke="#fff" stroke-width="4"/><path d="M0 0 30 20M30 0 0 20" stroke="#c8102e" stroke-width="1.4"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6"/><path d="M15 0v20M0 10h30" stroke="#c8102e" stroke-width="3.4"/>`,
  URU: Array.from({ length: 9 }, (_, i) => `<rect y="${(i * 20 / 9).toFixed(2)}" width="30" height="${(20 / 9 + .02).toFixed(2)}" fill="${i % 2 ? '#0038a8' : '#fff'}"/>`).join('') + `<rect width="11" height="11.1" fill="#fff"/><circle cx="5.5" cy="5.5" r="2.8" fill="#fcd116"/>`,
  CHI: h2('#fff', '#d52b1e') + `<rect width="10" height="10" fill="#0039a6"/>` + star(5, 5, 2.8, '#fff'),
  MEX: v3('#006847', '#fff', '#ce1126') + `<circle cx="15" cy="10" r="2.2" fill="#8c5b2b"/>`,
  COL: `<rect width="30" height="20" fill="#ce1126"/><rect width="30" height="15" fill="#003893"/><rect width="30" height="10" fill="#fcd116"/>`,
  PER: v3('#d91023', '#fff', '#d91023'),
  PAR: h3('#d52b1e', '#fff', '#0038a8') + `<circle cx="15" cy="10" r="1.6" fill="none" stroke="#2a7a2a" stroke-width=".5"/>`,
  ARU: `<rect width="30" height="20" fill="#418fde"/><rect y="13" width="30" height="1.2" fill="#fbe122"/><rect y="15.4" width="30" height="1.2" fill="#fbe122"/>` + star(5, 5, 3, '#fff') + star(5, 5, 2, '#ef3340'),
  JPN: `<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="5.6" fill="#bc002d"/>`,
  POL: h2('#fff', '#dc143c'),
  UKR: h2('#0057b7', '#ffd700'),
  AUT: h3('#ed2939', '#fff', '#ed2939'),
  HUN: h3('#ce2939', '#fff', '#477050'),
  CZE: h2('#fff', '#d7141a') + `<path d="M0 0 15 10 0 20Z" fill="#11457e"/>`,
  GRE: Array.from({ length: 9 }, (_, i) => `<rect y="${(i * 20 / 9).toFixed(2)}" width="30" height="${(20 / 9 + .02).toFixed(2)}" fill="${i % 2 ? '#fff' : '#0d5eaf'}"/>`).join('') + `<rect width="11.1" height="11.1" fill="#0d5eaf"/><path d="M5.55 0v11.1M0 5.55h11.1" stroke="#fff" stroke-width="2.2"/>`,
  CAN: `<rect width="30" height="20" fill="#fff"/><rect width="7.5" height="20" fill="#d80621"/><rect x="22.5" width="7.5" height="20" fill="#d80621"/>` + star(15, 10.4, 4.2, '#d80621'),
  AUS: `<rect width="30" height="20" fill="#012169"/>` + star(7.5, 15, 2.4, '#fff') + star(23, 5, 1.4, '#fff') + star(19.5, 10, 1.4, '#fff') + star(25.8, 9, 1.4, '#fff') + star(23, 16, 1.4, '#fff'),
  RSA: `<rect width="30" height="20" fill="#fff"/><rect width="30" height="6.6" fill="#e03c31"/><rect y="13.4" width="30" height="6.6" fill="#001489"/><path d="M0 0 13 10 0 20Z" fill="#007749"/><path d="M0 3.2 9 10 0 16.8Z" fill="#000"/>`,
  MAR: `<rect width="30" height="20" fill="#c1272d"/><path d="M15 6.2 17.2 13 11.4 8.8H18.6L12.8 13Z" fill="none" stroke="#006233" stroke-width=".8"/>`,
  ISR: `<rect width="30" height="20" fill="#fff"/><rect y="2" width="30" height="2.6" fill="#0038b8"/><rect y="15.4" width="30" height="2.6" fill="#0038b8"/><path d="M15 6.4 18.2 12H11.8ZM15 13.6 11.8 8H18.2Z" fill="none" stroke="#0038b8" stroke-width=".7"/>`,
};

const COUNTRIES: { code: string, nome: string }[] = [
  ['BRA', 'Brasil'], ['ITA', 'Itália'], ['ESP', 'Espanha'], ['FRA', 'França'], ['POR', 'Portugal'], ['ARG', 'Argentina'],
  ['RUS', 'Rússia'], ['LAT', 'Letônia'], ['VEN', 'Venezuela'], ['URU', 'Uruguai'], ['CHI', 'Chile'], ['PAR', 'Paraguai'],
  ['COL', 'Colômbia'], ['PER', 'Peru'], ['MEX', 'México'], ['ARU', 'Aruba'], ['USA', 'Estados Unidos'], ['CAN', 'Canadá'],
  ['GER', 'Alemanha'], ['NED', 'Holanda'], ['BEL', 'Bélgica'], ['SUI', 'Suíça'], ['AUT', 'Áustria'], ['GBR', 'Reino Unido'],
  ['POL', 'Polônia'], ['CZE', 'Chéquia'], ['HUN', 'Hungria'], ['UKR', 'Ucrânia'], ['GRE', 'Grécia'], ['ISR', 'Israel'],
  ['MAR', 'Marrocos'], ['RSA', 'África do Sul'], ['JPN', 'Japão'], ['AUS', 'Austrália'],
].map(([code, nome]) => ({ code, nome }));

function flagSVG(code: string, cls = 'flag'): string {
  const d = DRAW[code];
  if (!d) return `<span class="${cls} flag-txt">${code || ''}</span>`;
  return `<svg class="${cls}" viewBox="0 0 30 20" preserveAspectRatio="none" role="img" aria-label="${code}"><title>${code}</title>${d}</svg>`;
}
const countryName = (code: string) => (COUNTRIES.find(c => c.code === code) || { nome: code }).nome;

export { COUNTRIES, flagSVG, countryName };
