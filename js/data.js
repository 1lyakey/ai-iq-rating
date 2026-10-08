import { API_URL, FLAGS, SRC_ORDER, SRC_WEIGHT } from './config.js';
import { normalizeAiiq } from './normalize.js';

async function getJson(url, ms = 15000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

const finish = (list) => list
  .filter((m) => m.iq != null)
  .map((m) => ({ ...m, flag: FLAGS[m.country] || '🌐' }));

// Сначала живой API; если он недоступен — копия из репозитория (обновляется ботом каждые 6 часов).
export async function loadModels() {
  try {
    const d = await getJson(API_URL);
    return { models: finish(d.models.map(normalizeAiiq)), updatedAt: d.updatedAt, methodology: d.methodologyVersion, live: true };
  } catch (e) {
    const d = await getJson('data/aiiq.json');
    return { models: finish(d.models), updatedAt: d.updatedAt, methodology: d.methodology, live: false, error: e.message };
  }
}

export async function loadSources() {
  try { return await getJson('data/sources.json'); } catch { return null; }
}

// Консенсус: средний перцентиль позиции модели по источникам, где она есть.
// Берём только модели, подтверждённые минимум двумя источниками — один источник не может «протащить» модель.
export function buildConsensus(sources, models) {
  if (!sources) return [];
  const byKey = new Map(models.map((m) => [m.key, m]));
  const acc = new Map();
  const usable = sources.sources.filter((s) => s.models.length >= 5);
  for (const s of usable) {
    const n = s.models.length;
    const w = SRC_WEIGHT[s.fresh] ?? 0.5;
    for (const e of s.models) {
      const pct = n > 1 ? ((n - e.rank) / (n - 1)) * 100 : 100;
      const a = acc.get(e.key) || { key: e.key, name: e.name, per: {}, sum: 0, w: 0 };
      if (a.per[s.id]) continue;
      a.per[s.id] = { rank: e.rank, pct, score: e.score, label: e.label ?? e.scoreLabel ?? null };
      a.sum += pct * w; a.w += w;
      acc.set(e.key, a);
    }
  }
  const out = [];
  for (const a of acc.values()) {
    const cov = Object.keys(a.per).length;
    if (cov < 2) continue;
    const m = byKey.get(a.key);
    out.push({ ...a, coverage: cov, score: a.sum / a.w, model: m || null, name: m ? m.name : a.name });
  }
  out.sort((x, y) => y.score - x.score || y.coverage - x.coverage);
  out.forEach((c, i) => { c.rank = i + 1; });
  return out;
}

export { SRC_ORDER };
