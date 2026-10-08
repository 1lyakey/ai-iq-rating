// Общий модуль: работает и в браузере, и в Node (сборщик данных).
// 1) canon()          — приводит названия моделей из разных источников к одному ключу
// 2) normalizeAiiq()  — превращает сырой ответ aiiq.org в плоскую модель

const EFFORT = /-(?:high|medium|low|xhigh|minimal|thinking|reasoning|non-reasoning|preview|beta|latest|adaptive|extended|effort|\d+k)(?=-|$)/g;

export function canon(raw) {
  let s = String(raw ?? '').toLowerCase().trim();
  s = s.replace(/^.*\//, '');                       // "org/model" → "model"
  s = s.replace(/\(.*?\)/g, ' ');
  s = s.replace(/[_\s]+/g, '-');
  s = s.replace(/^claude-/, '');
  s = s.replace(/-?(?:19|20)\d{2}-?\d{2}-?\d{2}(?=-|$)/g, '');   // даты 20251101 / 2025-11-01
  for (let i = 0; i < 3; i++) s = s.replace(EFFORT, '');         // суффиксы режимов
  s = s.replace(/(^|[^\d])(\d)-(\d)(?!\d)/g, '$1$2.$3');         // 4-5 → 4.5
  s = s.replace(/[^a-z0-9.]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
  return s || 'unknown';
}

const D = {
  'abstract-reasoning': 'abstract',
  'mathematical-reasoning': 'math',
  'academic-reasoning': 'academic',
  'programmatic-reasoning': 'code',
  'computer-use': 'agent',
  'reliability': 'reliab',
  'knowledge-work': 'knowledge',
};

export function normalizeAiiq(m) {
  const dims = {};
  for (const [src, dst] of Object.entries(D)) dims[dst] = m.dimensions?.[src] ?? null;
  return {
    id: m.id ?? m.name,
    key: canon(m.name),
    name: m.name,
    provider: m.provider ?? '—',
    country: m.country ?? null,
    type: m.modelType ?? 'general',
    iq: m.iq ?? null,
    dims,
    cost: m.cost?.effectivePer1M ?? null,
    priceIn: m.cost?.inputPer1M ?? null,
    priceOut: m.cost?.outputPer1M ?? null,
    speed: m.speed?.medianTokensPerSecond ?? null,
    ctx: m.contextWindow ?? null,
    params: m.parametersB ?? null,
    release: m.releaseDate ?? null,
    os: !!m.openSource || m.modelType === 'openWeight',
    url: m.url ?? null,
  };
}
