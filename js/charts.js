import { h, raw } from './dom.js';
import { fmtUsd, fmtCtx, pareto } from './score.js';

// ---------- Диаграмма рассеяния: цена/скорость/контекст ↔ качество ----------
const M0 = { l: 54, r: 20, t: 16, b: 44 };

export const X_AXES = {
  cost:  { label: 'Цена за 1M токенов, $ (лог. шкала) — левее лучше', get: (m) => m.cost, log: true, better: 'low', fmt: fmtUsd, ticks: [0.1, 0.3, 1, 3, 10, 30, 100] },
  speed: { label: 'Скорость, токенов в секунду — правее лучше', get: (m) => m.speed, log: false, better: 'high', fmt: (v) => v, ticks: null },
  ctx:   { label: 'Контекст, токенов (лог. шкала) — правее лучше', get: (m) => m.ctx, log: true, better: 'high', fmt: fmtCtx, ticks: [8e3, 32e3, 128e3, 512e3, 2e6] },
};
export const Y_AXES = {
  score: { label: 'Сводный балл', get: (m) => m.score },
  iq: { label: 'Общий IQ', get: (m) => m.iq },
};

function niceTicks(lo, hi, count = 6) {
  const span = hi - lo || 1;
  const raw0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw0));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw0) || mag * 10;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

export function scatterSvg({ items, x, y, colorOf, selected = [], highlight = null, width = 760 }) {
  // размер в пикселях = размеру контейнера, поэтому шрифты не раздуваются на широких экранах
  const W = Math.max(300, Math.round(width));
  const H = W < 560 ? Math.round(W * 1.05) : Math.max(340, Math.min(540, Math.round(W * 0.48)));
  const M = W < 560 ? { l: 40, r: 12, t: 12, b: 42 } : M0;
  const ax = X_AXES[x], ay = Y_AXES[y];
  const pts = items.filter((m) => ax.get(m) != null && ay.get(m) != null && !(ax.log && ax.get(m) <= 0));
  if (pts.length < 2) return h`<div class="empty">Недостаточно данных для графика</div>`;

  const xs = pts.map(ax.get), ys = pts.map(ay.get);
  const tx = (v) => (ax.log ? Math.log10(v) : v);
  let x0 = Math.min(...xs.map(tx)), x1 = Math.max(...xs.map(tx));
  const padX = (x1 - x0) * 0.06 || 0.2; x0 -= padX; x1 += padX;
  const y0 = Math.floor(Math.min(...ys) / 5) * 5 - 2, y1 = Math.ceil(Math.max(...ys) / 5) * 5 + 2;
  const sx = (v) => M.l + ((tx(v) - x0) / (x1 - x0)) * (W - M.l - M.r);
  const sy = (v) => H - M.b - ((v - y0) / (y1 - y0)) * (H - M.t - M.b);

  const front = pareto(pts, ax.get, ay.get, ax.better);
  const frontIds = new Set(front.map((m) => m.id));
  const line = [...front].sort((a, b) => sx(ax.get(a)) - sx(ax.get(b)))
    .map((m, i) => `${i ? 'L' : 'M'}${sx(ax.get(m)).toFixed(1)},${sy(ay.get(m)).toFixed(1)}`).join(' ');

  const xt = (ax.ticks || niceTicks(Math.min(...xs), Math.max(...xs), 6)).filter((t) => tx(t) >= x0 && tx(t) <= x1);
  const yt = niceTicks(y0, y1, 6);

  // подписи: граница Парето + топ-4 по качеству; без наложений
  const want = [...new Map([...front, ...[...pts].sort((a, b) => ay.get(b) - ay.get(a)).slice(0, 4)].map((m) => [m.id, m])).values()];
  const placed = [];
  const labels = [];
  for (const m of want) {
    const cx = sx(ax.get(m)), cy = sy(ay.get(m));
    const wTxt = m.name.length * 6.1 + 6;
    const left = cx + wTxt + 10 > W - M.r;
    const bx = left ? cx - 9 - wTxt : cx + 9;
    const box = { x: bx, y: cy - 8, w: wTxt, h: 14 };
    if (placed.some((b) => box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y)) continue;
    placed.push(box);
    labels.push(h`<text class="pt-label" x="${left ? cx - 9 : cx + 9}" y="${cy + 3.5}" text-anchor="${left ? 'end' : 'start'}">${m.name}</text>`);
  }

  const dots = [...pts].sort((a, b) => (frontIds.has(a.id) ? 1 : 0) - (frontIds.has(b.id) ? 1 : 0)).map((m) => {
    const sel = selected.includes(m.id), fr = frontIds.has(m.id), hl = highlight && !highlight.has(m.id);
    return h`<circle class="pt ${colorOf(m)} ${fr ? 'fr' : ''} ${sel ? 'sel' : ''} ${hl ? 'dim' : ''}" data-act="open" data-id="${m.id}" cx="${sx(ax.get(m)).toFixed(1)}" cy="${sy(ay.get(m)).toFixed(1)}" r="${sel ? 8 : fr ? 6.5 : 4.8}" tabindex="0" role="button" aria-label="${m.name}, ${ay.label} ${ay.get(m).toFixed ? ay.get(m).toFixed(0) : ay.get(m)}"/>`;
  });

  return h`<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="График: ${ay.label} против ${ax.label}. Точек: ${pts.length}">
    ${xt.map((t) => h`<line class="grid" x1="${sx(t)}" x2="${sx(t)}" y1="${M.t}" y2="${H - M.b}"/><text class="tick" x="${sx(t)}" y="${H - M.b + 18}" text-anchor="middle">${ax.fmt(t)}</text>`)}
    ${yt.map((t) => h`<line class="grid" x1="${M.l}" x2="${W - M.r}" y1="${sy(t)}" y2="${sy(t)}"/><text class="tick" x="${M.l - 8}" y="${sy(t) + 4}" text-anchor="end">${t}</text>`)}
    <text class="axis-title" x="${(M.l + W - M.r) / 2}" y="${H - 6}" text-anchor="middle">${ax.label}</text>
    <text class="axis-title" transform="translate(13 ${(M.t + H - M.b) / 2}) rotate(-90)" text-anchor="middle">${ay.label}</text>
    ${front.length > 1 ? h`<path class="front" d="${line}"/>` : ''}
    ${dots}
    ${labels}
  </svg>`;
}

// ---------- Радар: сравнение до 4 моделей по измерениям IQ ----------
export const RADAR_AXES = [
  { id: 'abstract', label: 'Абстракт' }, { id: 'math', label: 'Математика' }, { id: 'academic', label: 'Наука' },
  { id: 'code', label: 'Код' }, { id: 'agent', label: 'Агенты' }, { id: 'reliab', label: 'Надёжность' }, { id: 'knowledge', label: 'Офис' },
];

export function radarSvg(models, range) {
  const S = 360, c = S / 2, R = 118;
  const [lo, hi] = range;
  const n = RADAR_AXES.length;
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i, v) => {
    const k = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
    return [c + Math.cos(ang(i)) * R * k, c + Math.sin(ang(i)) * R * k];
  };
  const rings = [0.25, 0.5, 0.75, 1];
  return h`<svg class="radar" viewBox="0 0 ${S} ${S}" role="img" aria-label="Радар-диаграмма сравнения моделей">
    ${rings.map((k) => h`<polygon class="ring" points="${RADAR_AXES.map((_, i) => `${(c + Math.cos(ang(i)) * R * k).toFixed(1)},${(c + Math.sin(ang(i)) * R * k).toFixed(1)}`).join(' ')}"/>`)}
    ${RADAR_AXES.map((a, i) => {
      const [lx, ly] = [c + Math.cos(ang(i)) * (R + 24), c + Math.sin(ang(i)) * (R + 20)];
      return h`<line class="spoke" x1="${c}" y1="${c}" x2="${(c + Math.cos(ang(i)) * R).toFixed(1)}" y2="${(c + Math.sin(ang(i)) * R).toFixed(1)}"/><text class="tick" x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="middle">${a.label}</text>`;
    })}
    ${rings.map((k) => h`<text class="tick dim" x="${c + 3}" y="${(c - R * k + 11).toFixed(1)}">${Math.round(lo + (hi - lo) * k)}</text>`)}
    ${models.map((m, mi) => {
      const pts = RADAR_AXES.map((a, i) => pt(i, m.dims[a.id] ?? lo).map((v) => v.toFixed(1)).join(','));
      return h`<polygon class="shape rc${mi}" points="${pts.join(' ')}"/>`;
    })}
  </svg>`;
}

export { raw };
