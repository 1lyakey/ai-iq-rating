import { CRITERIA, PRESET } from './score.js';

// Всё состояние интерфейса живёт в одном объекте и в адресной строке (#hash),
// поэтому любой вид рейтинга можно отправить ссылкой.
export const state = {
  preset: 'universal',          // id пресета или 'custom'
  w: { ...PRESET.universal.w }, // текущие веса 0..10
  q: '',
  providers: new Set(),         // пусто = все
  os: false,                    // только открытые веса
  maxPrice: null,               // $/1M, null = без ограничения
  sort: { key: 'score', dir: -1 },
  limit: 0,                     // 0 = PAGE_SIZE
  cmp: [],                      // id моделей в сравнении (до 4)
  open: null,                   // id открытой модели
  chart: { x: 'cost', y: 'score' },
  cons: 'consensus',            // вкладка источников
  theme: null,
};

export const MAX_CMP = 4;
export const PRICE_STEPS = [0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50]; // + «без лимита»

const num = (v) => { if (v == null || v === '') return null; const n = +v; return Number.isFinite(n) ? n : null; };

export function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const s = state;
  const pr = p.get('p');
  if (pr && (PRESET[pr] || pr === 'custom')) s.preset = pr;
  if (s.preset !== 'custom') s.w = { ...PRESET[s.preset].w };
  const w = p.get('w');
  if (w) {
    for (const part of w.split(',')) {
      const [k, v] = part.split('.');
      if (CRITERIA.some((c) => c.id === k) && num(v) != null) s.w[k] = Math.max(0, Math.min(10, Math.round(+v)));
    }
    s.preset = 'custom';
  }
  s.q = (p.get('q') || '').slice(0, 80);
  s.os = p.get('os') === '1' || (s.preset !== 'custom' && PRESET[s.preset]?.os === true && p.get('os') !== '0');
  s.maxPrice = num(p.get('mp'));
  s.providers = new Set((p.get('prov') || '').split(',').filter(Boolean).slice(0, 20));
  const so = (p.get('s') || '').split('.');
  if (so[0]) s.sort = { key: so[0], dir: so[1] === 'a' ? 1 : -1 };
  s.cmp = (p.get('c') || '').split(',').filter(Boolean).slice(0, MAX_CMP);
  s.open = p.get('m') || null;
  if (p.get('cx')) s.chart.x = p.get('cx');
  if (p.get('cy')) s.chart.y = p.get('cy');
  if (p.get('t')) s.cons = p.get('t');
}

export function writeHash() {
  const s = state;
  const p = new URLSearchParams();
  if (s.preset !== 'universal') p.set('p', s.preset);
  if (s.preset === 'custom') p.set('w', CRITERIA.map((c) => `${c.id}.${s.w[c.id] || 0}`).join(','));
  if (s.q) p.set('q', s.q);
  if (s.os && !(PRESET[s.preset]?.os)) p.set('os', '1');
  if (!s.os && PRESET[s.preset]?.os) p.set('os', '0');
  if (s.maxPrice != null) p.set('mp', s.maxPrice);
  if (s.providers.size) p.set('prov', [...s.providers].join(','));
  if (!(s.sort.key === 'score' && s.sort.dir === -1)) p.set('s', s.sort.key + (s.sort.dir === 1 ? '.a' : '.d'));
  if (s.cmp.length) p.set('c', s.cmp.join(','));
  if (s.open) p.set('m', s.open);
  if (s.chart.x !== 'cost') p.set('cx', s.chart.x);
  if (s.chart.y !== 'score') p.set('cy', s.chart.y);
  if (s.cons !== 'consensus') p.set('t', s.cons);
  const str = p.toString();
  const url = location.pathname + location.search + (str ? '#' + str : '');
  try { history.replaceState(null, '', url); } catch { /* sandboxed iframe */ }
}

export function storeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
export function storeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* приватный режим */ } }
