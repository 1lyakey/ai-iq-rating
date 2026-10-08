import { REF_DEFAULTS, REF_PROVIDERS } from './config.js';
import { storeGet, storeSet } from './state.js';

// Приоритет кодов: параметры URL → localStorage → значения из config.js
export const codes = { ...REF_DEFAULTS };

export function loadCodes() {
  const q = new URLSearchParams(location.search);
  let saved = {};
  try { saved = JSON.parse(storeGet('refCodes') || '{}'); } catch { /* битый JSON */ }
  for (const p of REF_PROVIDERS) {
    const fromUrl = q.get('ref_' + p.key);
    const v = fromUrl || (!codes[p.key] ? saved[p.key] : null);
    if (v) codes[p.key] = String(v).replace(/[^\w.\-~]/g, '').slice(0, 64) || null;
  }
}

export function saveCodes(values) {
  const toSave = {};
  for (const p of REF_PROVIDERS) {
    const v = String(values[p.key] || '').replace(/[^\w.\-~]/g, '').slice(0, 64);
    codes[p.key] = v || REF_DEFAULTS[p.key] || null;
    if (v) toSave[p.key] = v;
  }
  storeSet('refCodes', JSON.stringify(toSave));
}

export function resetCodes() {
  for (const p of REF_PROVIDERS) codes[p.key] = REF_DEFAULTS[p.key] || null;
  storeSet('refCodes', '{}');
}

export function refUrl(p) {
  const c = codes[p.key];
  return c ? `${p.url}?${p.param}=${encodeURIComponent(c)}` : p.url;
}

export function shareUrl() {
  const parts = REF_PROVIDERS.filter((p) => codes[p.key]).map((p) => `ref_${p.key}=${encodeURIComponent(codes[p.key])}`);
  return location.origin + location.pathname + (parts.length ? '?' + parts.join('&') : '');
}
