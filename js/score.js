// Чистая логика рейтинга: без DOM, без сети. Покрыта тестами (tests/score.test.js).

// Критерии. kind=dim — измерение IQ (линейная шкала), kind=rank — перцентиль (устойчив к выбросам).
export const CRITERIA = [
  { id: 'iq',        label: 'Общий IQ',          short: 'IQ',     kind: 'dim',  get: (m) => m.iq },
  { id: 'code',      label: 'Код',               short: 'Код',    kind: 'dim',  get: (m) => m.dims.code },
  { id: 'agent',     label: 'Агенты и ПК',       short: 'Агент',  kind: 'dim',  get: (m) => m.dims.agent },
  { id: 'math',      label: 'Математика',        short: 'Матем',  kind: 'dim',  get: (m) => m.dims.math },
  { id: 'academic',  label: 'Наука и знания',    short: 'Наука',  kind: 'dim',  get: (m) => m.dims.academic },
  { id: 'abstract',  label: 'Абстрактное мышление', short: 'Абстр', kind: 'dim', get: (m) => m.dims.abstract },
  { id: 'reliab',    label: 'Надёжность',        short: 'Надёжн', kind: 'dim',  get: (m) => m.dims.reliab },
  { id: 'knowledge', label: 'Офисная работа',    short: 'Офис',   kind: 'dim',  get: (m) => m.dims.knowledge },
  { id: 'price',     label: 'Дешевизна',         short: 'Цена',   kind: 'rank', get: (m) => m.cost,  invert: true },
  { id: 'speed',     label: 'Скорость',          short: 'Скорость', kind: 'rank', get: (m) => m.speed },
  { id: 'ctx',       label: 'Длина контекста',   short: 'Контекст', kind: 'rank', get: (m) => m.ctx },
];

export const CRIT = Object.fromEntries(CRITERIA.map((c) => [c.id, c]));

const W = (o) => Object.fromEntries(CRITERIA.map((c) => [c.id, o[c.id] ?? 0]));

// Сценарии «что мне нужно». Веса 0–10.
export const PRESETS = [
  { id: 'universal', icon: '⚖️', label: 'Универсал', hint: 'Лучшая модель «вообще»',
    w: W({ iq: 10, code: 4, agent: 3, math: 3, academic: 3, abstract: 2, reliab: 3, knowledge: 3, price: 2, speed: 1, ctx: 1 }) },
  { id: 'code', icon: '💻', label: 'Программирование', hint: 'Код, агенты, надёжность',
    w: W({ iq: 3, code: 10, agent: 6, reliab: 6, math: 1, price: 2, speed: 2, ctx: 2 }) },
  { id: 'agents', icon: '🤖', label: 'Агенты', hint: 'Работа с ПК и длинные цепочки действий',
    w: W({ iq: 3, agent: 10, reliab: 8, code: 5, knowledge: 4, price: 2, speed: 2, ctx: 3 }) },
  { id: 'science', icon: '🔬', label: 'Наука и математика', hint: 'Сложные рассуждения',
    w: W({ iq: 4, math: 10, academic: 8, abstract: 6, reliab: 2 }) },
  { id: 'value', icon: '💰', label: 'Дёшево и умно', hint: 'Лучшее качество за доллар',
    w: W({ iq: 6, code: 3, reliab: 3, knowledge: 2, price: 10, speed: 2 }) },
  { id: 'fast', icon: '⚡', label: 'Быстро', hint: 'Скорость ответа важнее всего',
    w: W({ iq: 6, code: 2, reliab: 2, speed: 10, price: 3 }) },
  { id: 'longctx', icon: '📚', label: 'Длинные документы', hint: 'Большой контекст и знания',
    w: W({ iq: 5, knowledge: 6, academic: 3, ctx: 10, price: 2, reliab: 3 }) },
  { id: 'open', icon: '🔓', label: 'Открытые веса', hint: 'Можно запускать у себя', os: true,
    w: W({ iq: 10, code: 4, agent: 3, math: 3, academic: 3, abstract: 2, reliab: 3, knowledge: 3, price: 2, speed: 1, ctx: 1 }) },
];
export const PRESET = Object.fromEntries(PRESETS.map((p) => [p.id, p]));

const MISSING = 30; // нет данных ≠ хорошо: неизвестное значение получает пессимистичные 30 из 100

// Доля значений строго меньше v + половина равных → 0..100
function pctRank(sortedAsc, v) {
  const n = sortedAsc.length;
  if (!n) return 50;
  let lo = 0, hi = n;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (sortedAsc[mid] < v) lo = mid + 1; else hi = mid; }
  const less = lo;
  hi = lo;
  while (hi < n && sortedAsc[hi] === v) hi++;
  return ((less + (hi - less) / 2) / n) * 100;
}

// Считает для каждой модели нормализованные оценки 0..100 по каждому критерию (m.s).
// Нормализация считается по ВСЕМ моделям, а не по отфильтрованным: оценка не прыгает от фильтров.
export function prepare(models) {
  const stats = {};
  for (const c of CRITERIA) {
    const vals = models.map(c.get).filter((v) => v != null && !Number.isNaN(v)).sort((a, b) => a - b);
    stats[c.id] = { vals, n: vals.length, lo: vals.length ? vals[Math.floor(vals.length * 0.05)] : 0, hi: vals.length ? vals[vals.length - 1] : 1 };
  }
  for (const m of models) {
    m.s = {};   // оценка для сводного балла, 0..100
    m.p = {};   // честный перцентиль среди моделей с данными, 0..100 (выше = лучше)
    for (const c of CRITERIA) {
      const v = c.get(m);
      const st = stats[c.id];
      if (v == null || Number.isNaN(v) || !st.n) { m.s[c.id] = null; m.p[c.id] = null; continue; }
      const p = pctRank(st.vals, v);
      m.p[c.id] = c.invert ? 100 - p : p;
      if (c.kind === 'dim') {
        // линейная шкала от 5-го перцентиля до максимума; если все значения равны — нейтральные 50
        m.s[c.id] = st.hi === st.lo ? 50 : Math.max(0, Math.min(100, ((v - st.lo) / (st.hi - st.lo)) * 100));
      } else {
        m.s[c.id] = m.p[c.id];
      }
    }
  }
  return stats;
}

// Сводный балл 0..100 и доля покрытия данными (по весу).
export function scoreModel(m, w) {
  let sum = 0, tot = 0, have = 0;
  for (const c of CRITERIA) {
    const wi = w[c.id] || 0;
    if (!wi) continue;
    tot += wi;
    const s = m.s[c.id];
    if (s != null) have += wi;
    sum += wi * (s ?? MISSING);
  }
  if (!tot) return { score: 0, coverage: 1 };
  return { score: sum / tot, coverage: have / tot };
}

export function applyScores(models, w) {
  for (const m of models) { const r = scoreModel(m, w); m.score = r.score; m.coverage = r.coverage; }
  const order = [...models].sort((a, b) => b.score - a.score);
  order.forEach((m, i) => { m.rank = i + 1; });
  return order;
}

export function isEmptyWeights(w) { return !CRITERIA.some((c) => w[c.id] > 0); }

// Граница Парето: модели, которые никто не обходит одновременно по x и y.
// better='low' — чем меньше x, тем лучше (цена); 'high' — чем больше x, тем лучше (скорость, контекст).
export function pareto(items, xOf, yOf, better) {
  const pts = items.filter((m) => xOf(m) != null && yOf(m) != null);
  pts.sort((a, b) => (better === 'low' ? xOf(a) - xOf(b) : xOf(b) - xOf(a)) || yOf(b) - yOf(a));
  const out = [];
  let best = -Infinity;
  for (const m of pts) if (yOf(m) > best) { out.push(m); best = yOf(m); }
  return out;
}

export const fmtUsd = (v) => (v == null ? '—' : v >= 100 ? '$' + Math.round(v) : v >= 10 ? '$' + v.toFixed(1) : '$' + v.toFixed(2));
export const fmtCtx = (v) => (v == null ? '—' : v >= 1e6 ? +(v / 1e6).toFixed(1) + 'M' : Math.round(v / 1000) + 'K');
export const fmtNum = (v, d = 0) => (v == null ? '—' : (+v).toFixed(d));

// Автоматические плюсы и минусы из данных. Ничего не выдумываем: каждая строка опирается на число.
export function insights(m, stats) {
  const pros = [], cons = [];
  const push = (arr, weight, text) => arr.push({ weight, text });
  const top = (p) => Math.max(1, Math.round(100 - p)); // «топ-N%» по честному перцентилю

  for (const c of CRITERIA) {
    const s = m.p[c.id];
    if (s == null) continue;
    if (c.id === 'price') {
      if (s >= 85) push(pros, s, `Дёшево: ${fmtUsd(m.cost)} за 1M токенов — дешевле ${Math.round(s)}% моделей`);
      else if (s <= 15) push(cons, 100 - s, `Дорого: ${fmtUsd(m.cost)} за 1M токенов — дороже ${Math.round(100 - s)}% моделей`);
    } else if (c.id === 'speed') {
      if (s >= 85) push(pros, s, `Быстрая: ${m.speed} токенов/с (быстрее ${Math.round(s)}% моделей)`);
      else if (s <= 15) push(cons, 100 - s, `Медленная: ${m.speed} токенов/с (медленнее ${Math.round(100 - s)}% моделей)`);
    } else if (c.id === 'ctx') {
      if (s >= 85) push(pros, s, `Длинный контекст: ${fmtCtx(m.ctx)} токенов`);
      else if (s <= 15) push(cons, 100 - s, `Короткий контекст: ${fmtCtx(m.ctx)} токенов`);
    } else {
      const v = c.get(m);
      if (s >= 90) push(pros, s, `${c.label}: ${v} — топ-${top(s)}% среди моделей`);
      else if (s <= 15 && c.id !== 'iq') push(cons, 100 - s, `Слабее других: ${c.label.toLowerCase()} (${v})`);
    }
  }
  if (m.os) push(pros, 70, 'Открытые веса: можно запускать у себя и дообучать');
  else if (m.p.iq != null && m.p.iq >= 80) push(cons, 40, 'Закрытая модель: только через API провайдера');
  if (m.cost == null) push(cons, 60, 'Нет данных о цене');
  if (m.speed == null) push(cons, 30, 'Нет данных о скорости');
  const cut = (a) => a.sort((x, y) => y.weight - x.weight).slice(0, 4).map((x) => x.text);
  return { pros: cut(pros), cons: cut(cons) };
}
