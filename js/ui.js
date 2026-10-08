import { h, raw, esc, $, $$, setHtml } from './dom.js';
import { CRITERIA, CRIT, PRESETS, PRESET, applyScores, insights, fmtUsd, fmtCtx, fmtNum } from './score.js';
import { state, PRICE_STEPS } from './state.js';
import { scatterSvg, radarSvg, X_AXES, Y_AXES, RADAR_AXES } from './charts.js';
import { NEW_DAYS, PAGE_SIZE, REF_PROVIDERS, SRC_ORDER } from './config.js';
import { codes, refUrl } from './refs.js';

// Общие данные приложения. Заполняет main.js.
export const app = {
  models: [], byId: new Map(), stats: null, sources: null, consensus: [], meta: null,
  order: [], visible: [], base: [], provClass: new Map(), provCount: new Map(),
};

// ---------- утилиты ----------
const DAY = 864e5;
export const isNew = (m) => {
  if (!m.release) return false;
  const d = (Date.now() - Date.parse(m.release)) / DAY;
  return d >= -7 && d <= NEW_DAYS;
};
export function ago(iso) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (!Number.isFinite(s)) return '';
  if (s < 90) return 'только что';
  if (s < 3600) return Math.round(s / 60) + ' мин назад';
  if (s < 86400) return Math.round(s / 3600) + ' ч назад';
  return Math.round(s / 86400) + ' дн назад';
}
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const heat = (p) => (p == null ? 'h0' : p >= 90 ? 'h4' : p >= 70 ? 'h3' : p >= 40 ? 'h2' : p >= 15 ? 'h1' : 'h0');
const safeUrl = (u) => (typeof u === 'string' && u.startsWith('https://www.aiiq.org/') ? u : null);
export const provCls = (p) => 'pc' + (app.provClass.has(p) ? app.provClass.get(p) : 8);
const maxPriceText = () => (state.maxPrice == null ? 'любая' : '$' + state.maxPrice + ' /1M');

// ---------- вычисление: сортировка и фильтры ----------
const SORT_VAL = {
  score: (m) => m.score, iq: (m) => m.iq, code: (m) => m.dims.code, agent: (m) => m.dims.agent, math: (m) => m.dims.math,
  cost: (m) => m.cost, speed: (m) => m.speed, ctx: (m) => m.ctx, name: (m) => m.name.toLowerCase(), release: (m) => m.release,
};

function passesBase(m) {
  if (state.os && !m.os) return false;
  if (state.maxPrice != null && (m.cost == null || m.cost > state.maxPrice)) return false;
  if (state.providers.size && !state.providers.has(m.provider)) return false;
  return true;
}
function matchesQuery(m) {
  const q = state.q.trim().toLowerCase();
  return !q || m.name.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q);
}

export function compute() {
  app.order = applyScores(app.models, state.w);
  app.base = app.order.filter(passesBase);
  const rows = app.base.filter(matchesQuery);
  const get = SORT_VAL[state.sort.key] || SORT_VAL.score;
  rows.sort((a, b) => {
    const x = get(a), y = get(b);
    if (x == null && y == null) return a.rank - b.rank;
    if (x == null) return 1;
    if (y == null) return -1;
    const c = typeof x === 'string' ? x.localeCompare(y, 'ru') : x - y;
    return (c * state.sort.dir) || (a.rank - b.rank);
  });
  app.visible = rows;
}

export function indexProviders() {
  const cnt = new Map();
  for (const m of app.models) cnt.set(m.provider, (cnt.get(m.provider) || 0) + 1);
  app.provCount = cnt;
  const top = [...cnt.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8);
  app.provClass = new Map(top.map(([p], i) => [p, i]));
}

// ---------- шапка героя ----------
export function renderStatus() {
  const el = $('#status');
  const { meta } = app;
  if (!meta) return;
  el.className = 'eyebrow ' + (meta.live ? 'live' : 'cache');
  el.textContent = meta.live
    ? `Live · aiiq.org · обновлено ${ago(meta.updatedAt)} · ${app.models.length} моделей`
    : `Офлайн-копия от ${fmtDate(meta.updatedAt)} · ${app.models.length} моделей (API недоступен)`;
  $('#footMeta').textContent = meta.methodology ? `Методика aiiq: ${meta.methodology}.` : '';
}

export function renderPresets() {
  setHtml($('#presets'), h`${PRESETS.map((p) => h`<button class="preset" data-act="preset" data-id="${p.id}" data-focus-key="preset-${p.id}" aria-pressed="${state.preset === p.id}">${p.icon} ${p.label}</button>`)}`);
  const hint = state.preset === 'custom' ? 'Свои веса — настройте их в блоке «Что для вас важно».' : PRESET[state.preset].hint;
  $('#presetHint').textContent = hint + (state.os ? ' · только открытые веса' : '');
  $('#customBadge').hidden = state.preset !== 'custom';
}

export function renderWeights() {
  setHtml($('#weights'), h`${CRITERIA.map((c) => h`<div class="wrow"><label for="w_${c.id}">${c.label}</label><b id="wv_${c.id}">${state.w[c.id]}</b><input type="range" id="w_${c.id}" data-w="${c.id}" min="0" max="10" step="1" value="${state.w[c.id]}"></div>`)}`);
}
export function syncWeights() {
  for (const c of CRITERIA) {
    const i = $('#w_' + c.id), b = $('#wv_' + c.id);
    if (i) i.value = state.w[c.id];
    if (b) b.textContent = state.w[c.id];
  }
}

export function renderFilters() {
  const provs = [...app.provCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  setHtml($('#providers'), h`${provs.map(([p, n]) => h`<button class="chip" data-act="prov" data-id="${p}" data-focus-key="prov-${p}" aria-pressed="${state.providers.has(p)}"><i class="${provCls(p)}"></i>${p} <small>${n}</small></button>`)}`);
  $('#clearProv').hidden = state.providers.size === 0;
  $('#osOnly').checked = state.os;
  const idx = state.maxPrice == null ? PRICE_STEPS.length : Math.max(0, PRICE_STEPS.indexOf(state.maxPrice));
  $('#priceMax').value = idx;
  $('#priceOut').textContent = maxPriceText();
  if (document.activeElement !== $('#search')) $('#search').value = state.q;
}

// ---------- пьедестал ----------
function ringSvg(score) {
  const r = 27, c = 2 * Math.PI * r;
  return h`<div class="ring"><svg viewBox="0 0 64 64" aria-hidden="true"><circle class="bg" cx="32" cy="32" r="${r}"/><circle class="fg" cx="32" cy="32" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - score / 100)).toFixed(1)}"/></svg><span>${Math.round(score)}</span></div>`;
}
export function renderPodium() {
  const top = app.base.slice(0, 3);
  if (!top.length) { setHtml($('#podium'), h`<li class="empty">Нет моделей под эти фильтры</li>`); return; }
  setHtml($('#podium'), h`${top.map((m, i) => h`<li class="pod" data-act="open" data-id="${m.id}" tabindex="0" role="button" aria-label="${m.name}: балл ${Math.round(m.score)}">
    <div class="medal">${i + 1}</div>
    <div>
      <div class="nm">${m.name}</div>
      <div class="sub">${m.flag} ${m.provider}${m.os ? ' · открытые веса' : ''}</div>
      <div class="facts"><span>IQ <b>${m.iq}</b></span><span>${fmtUsd(m.cost)}<b>/1M</b></span><span><b>${fmtNum(m.speed)}</b> т/с</span><span><b>${fmtCtx(m.ctx)}</b> контекст</span></div>
    </div>
    ${ringSvg(m.score)}
  </li>`)}`);
}

export function renderFresh() {
  const el = $('#fresh');
  const fresh = app.models.filter(isNew).sort((a, b) => b.release.localeCompare(a.release)).slice(0, 8);
  if (!fresh.length) { el.hidden = true; return; }
  el.hidden = false;
  setHtml(el, h`<span class="lab">Новинки</span>${fresh.map((m) => h`<button class="fresh-chip" data-act="open" data-id="${m.id}">${m.name}<small>${ago(m.release + 'T12:00:00Z')}</small></button>`)}`);
}

// ---------- таблица ----------
const COLS = [
  { k: 'rank', label: '#', title: 'Место по текущему сценарию', sort: false },
  { k: 'name', label: 'Модель', cls: 'l', first: 1 },
  { k: 'score', label: 'Балл', title: 'Сводный балл по выбранным весам' },
  { k: 'iq', label: 'IQ' },
  { k: 'code', label: 'Код' },
  { k: 'agent', label: 'Агент', hide: true },
  { k: 'math', label: 'Матем', hide: true },
  { k: 'cost', label: '$/1M', title: 'Эффективная цена за 1M токенов (с учётом расхода токенов)', first: 1 },
  { k: 'speed', label: 'т/с', hide: true, title: 'Токенов в секунду' },
  { k: 'ctx', label: 'Конт.', hide: true, title: 'Окно контекста' },
  { k: 'cmp', label: '⇄', title: 'Добавить в сравнение (до 4)', sort: false },
];

export const defaultDir = (k) => (COLS.find((c) => c.k === k)?.first ? 1 : -1);

export function renderTableHead() {
  setHtml($('#thead'), h`${COLS.map((c) => {
    const on = state.sort.key === c.k;
    const sortable = c.sort !== false;
    return h`<th class="${c.cls || ''} ${c.hide ? 'hide-m' : ''}" ${sortable ? raw(`data-act="sort" data-id="${c.k}" data-focus-key="sort-${c.k}" tabindex="0"`) : ''} ${on ? raw(`aria-sort="${state.sort.dir === 1 ? 'ascending' : 'descending'}"`) : ''} title="${c.title || ''}">${c.label}</th>`;
  })}`);
  const sel = $('#sortSel');
  if (!sel.options.length) {
    const names = { score: 'Сводный балл', iq: 'Общий IQ', code: 'Код', agent: 'Агенты', math: 'Математика', cost: 'Цена (дешевле выше)', speed: 'Скорость', ctx: 'Контекст', name: 'Название А–Я', release: 'Новизна' };
    for (const [k, v] of Object.entries(names)) sel.add(new Option(v, k));
  }
  sel.value = state.sort.key;
}

function cell(val, p, fmt = (v) => v, cls = '') {
  return h`<td class="v ${heat(p)} ${cls}">${val == null ? '—' : fmt(val)}</td>`;
}

export function renderTable() {
  const limit = Math.max(state.limit, PAGE_SIZE);
  const rows = app.visible.slice(0, limit);
  const showRank = true;
  setHtml($('#tbody'), rows.length ? h`${rows.map((m) => {
    const approx = m.coverage < 0.7;
    const inCmp = state.cmp.includes(m.id);
    return h`<tr class="trow ${inCmp ? 'sel-row' : ''}" data-act="open" data-id="${m.id}" tabindex="0">
      <td class="rk ${m.rank <= 3 ? 't' + m.rank : ''}">${showRank ? m.rank : ''}</td>
      <td class="nm"><span class="n">${m.name}</span>${isNew(m) ? h`<span class="tag new">new</span>` : ''}${m.os ? h`<span class="tag os">open</span>` : ''}<span class="s">${m.flag} ${m.provider} · ${fmtDate(m.release)}</span></td>
      <td class="sc"><div class="scorecell"><b>${Math.round(m.score)}</b><span class="bar-bg"><span class="bar-fg" style="width:${m.score.toFixed(0)}%"></span></span>${approx ? h`<span class="approx" title="Для ${Math.round((1 - m.coverage) * 100)}% выбранных критериев нет данных — модель получила за них 30 из 100">≈</span>` : ''}</div></td>
      ${cell(m.iq, m.p.iq)}
      ${cell(m.dims.code, m.p.code)}
      ${cell(m.dims.agent, m.p.agent, (v) => v, 'hide-m')}
      ${cell(m.dims.math, m.p.math, (v) => v, 'hide-m')}
      ${cell(m.cost, m.p.price, fmtUsd)}
      ${cell(m.speed, m.p.speed, (v) => v, 'hide-m')}
      ${cell(m.ctx, m.p.ctx, fmtCtx, 'hide-m')}
      <td class="cmp"><input type="checkbox" data-act="cmp-toggle" data-id="${m.id}" aria-label="Сравнить ${m.name}" ${inCmp ? 'checked' : ''}></td>
    </tr>`;
  })}` : h`<tr><td colspan="${COLS.length}" class="empty">Ничего не найдено. Попробуйте убрать фильтры.</td></tr>`);
  $('#count').innerHTML = `Показано <b>${rows.length}</b> из <b>${app.visible.length}</b>` + (app.visible.length !== app.models.length ? ` · всего в базе ${app.models.length}` : '');
  $('#moreBtn').hidden = rows.length >= app.visible.length;
  $('#moreBtn').textContent = `Показать ещё ${Math.min(PAGE_SIZE, app.visible.length - rows.length)}`;
}

// ---------- график ----------
export function renderChartControls() {
  const seg = (id, defs, cur, act) => setHtml($(id), h`${Object.entries(defs).map(([k, v]) => h`<button data-act="${act}" data-id="${k}" data-focus-key="${act}-${k}" aria-pressed="${cur === k}">${v}</button>`)}`);
  seg('#segX', { cost: 'Цена', speed: 'Скорость', ctx: 'Контекст' }, state.chart.x, 'chart-x');
  seg('#segY', { score: 'Сводный балл', iq: 'Общий IQ' }, state.chart.y, 'chart-y');
}
export function renderChart() {
  const q = state.q.trim();
  const hl = q ? new Set(app.base.filter(matchesQuery).map((m) => m.id)) : null;
  setHtml($('#chart'), scatterSvg({ items: app.base, x: state.chart.x, y: state.chart.y, colorOf: (m) => provCls(m.provider), selected: state.cmp, highlight: hl, width: $('#chart').clientWidth || 760 }));
  const top = [...app.provClass.entries()].sort((a, b) => a[1] - b[1]).map(([p]) => p);
  setHtml($('#legend'), h`${top.map((p) => h`<button class="chip" data-act="prov" data-id="${p}" aria-pressed="${state.providers.has(p)}"><i class="${provCls(p)}"></i>${p}</button>`)}<span class="chip" style="cursor:default"><i class="pc8"></i>Другие</span>`);
}

export function tipHtml(m) {
  const y = Y_AXES[state.chart.y];
  return h`<b>${m.flag} ${m.name}</b><span>${m.provider}</span><span>${y.label}: ${Math.round(y.get(m))} · место #${m.rank}</span><span>${fmtUsd(m.cost)}/1M · ${fmtNum(m.speed)} т/с · ${fmtCtx(m.ctx)}</span>`;
}

// ---------- панель сравнения ----------
export function renderCmpBar() {
  const bar = $('#cmpbar');
  const ms = state.cmp.map((id) => app.byId.get(id)).filter(Boolean);
  bar.hidden = ms.length === 0;
  document.body.style.paddingBottom = ms.length ? '70px' : '';
  setHtml($('#cmpChips'), h`${ms.map((m) => h`<span class="cmp-chip">${m.name}<button data-act="cmp-toggle" data-id="${m.id}" aria-label="Убрать ${m.name}">×</button></span>`)}`);
  const go = $('#cmpGo');
  go.disabled = ms.length < 2;
  go.textContent = ms.length < 2 ? 'Выберите ещё одну' : `Сравнить (${ms.length})`;
}

// ---------- карточка модели ----------
function insightsBlock(ins) {
  return h`<div class="pc">
    <div class="pros"><div class="hd">Плюсы</div><ul>${ins.pros.length ? ins.pros.map((t) => h`<li>${t}</li>`) : h`<li>Ярко выраженных сильных сторон нет</li>`}</ul></div>
    <div class="cons"><div class="hd">Минусы</div><ul>${ins.cons.length ? ins.cons.map((t) => h`<li>${t}</li>`) : h`<li>Заметных слабых мест нет</li>`}</ul></div>
  </div>`;
}

export function renderDetail(id) {
  const m = app.byId.get(id);
  const dlg = $('#detail');
  if (!m) return false;
  const ins = insights(m, app.stats);
  const cons = app.consensus.find((c) => c.key === m.key);
  const url = safeUrl(m.url);
  const inCmp = state.cmp.includes(m.id);
  const srcName = (sid) => app.sources?.sources.find((s) => s.id === sid)?.name || sid;
  setHtml(dlg, h`<div class="dlg">
    <div class="dlg-head">
      <div>
        <h2>${m.name}</h2>
        <p class="mini">${m.flag} ${m.provider} · релиз ${fmtDate(m.release)}${m.os ? ' · открытые веса' : ' · закрытая модель'}${m.params ? ` · ${m.params}B параметров` : ''}</p>
      </div>
      <button class="x" data-act="close" aria-label="Закрыть">✕</button>
    </div>
    <div class="pod" style="cursor:default;grid-template-columns:auto 1fr;gap:18px;margin-bottom:6px">
      ${ringSvg(m.score)}
      <div><div class="nm">Место #${m.rank} из ${app.models.length}</div><div class="sub">по сценарию «${state.preset === 'custom' ? 'свои веса' : PRESET[state.preset].label}»${m.coverage < 0.7 ? ' · ≈ часть данных отсутствует' : ''}</div></div>
    </div>
    <div class="kv">
      <div><small>IQ</small><b>${m.iq}</b></div>
      <div><small>Цена / 1M</small><b>${fmtUsd(m.cost)}</b></div>
      <div><small>Вход / выход</small><b>${m.priceIn != null ? fmtUsd(m.priceIn) + ' / ' + fmtUsd(m.priceOut) : '—'}</b></div>
      <div><small>Скорость</small><b>${m.speed != null ? m.speed + ' т/с' : '—'}</b></div>
      <div><small>Контекст</small><b>${fmtCtx(m.ctx)}</b></div>
    </div>
    <h3>Профиль способностей</h3>
    <div class="dimlist">${CRITERIA.filter((c) => c.kind === 'dim' && c.id !== 'iq').map((c) => {
      const v = c.get(m), s = m.s[c.id], p = m.p[c.id];
      return h`<div class="dimrow"><span>${c.label}</span><span class="track" title="${p != null ? 'лучше, чем у ' + Math.round(p) + '% моделей' : 'нет данных'}"><i style="width:${s == null ? 0 : s.toFixed(0)}%"></i></span><b>${v ?? '—'}</b></div>`;
    })}</div>
    ${insightsBlock(ins)}
    ${cons ? h`<h3>Независимые источники</h3><p class="mini">Консенсус: <b>#${cons.rank}</b> · подтверждено ${cons.coverage} из ${app.sources.sources.length}: ${Object.entries(cons.per).map(([sid, v]) => `${srcName(sid)} #${v.rank}`).join(' · ')}</p>` : ''}
    <div class="row" style="margin-top:20px">
      <button class="btn ${inCmp ? '' : 'primary'}" data-act="cmp-toggle" data-id="${m.id}" data-keep="1">${inCmp ? '✓ В сравнении — убрать' : '＋ Добавить в сравнение'}</button>
      ${url ? h`<a class="btn" href="${url}" target="_blank" rel="noopener noreferrer">Страница на aiiq.org ↗</a>` : ''}
    </div>
  </div>`);
  return true;
}

// ---------- сравнение ----------
export function renderCompare() {
  const ms = state.cmp.map((id) => app.byId.get(id)).filter(Boolean);
  const dlg = $('#compare');
  if (ms.length < 2) return false;
  // шкала подгоняется под выбранные модели, иначе близкие модели сливаются в одну фигуру
  const all = ms.flatMap((m) => RADAR_AXES.map((a) => m.dims[a.id])).filter((v) => v != null);
  const lo = Math.floor((Math.min(...all) - 8) / 5) * 5, hi = Math.ceil((Math.max(...all) + 3) / 5) * 5;
  const best = (vals, dir) => {
    const ok = vals.filter((v) => v != null);
    if (ok.length < 2) return new Set();
    const t = dir > 0 ? Math.max(...ok) : Math.min(...ok);
    return ok.every((v) => v === t) ? new Set() : new Set(vals.map((v, i) => (v === t ? i : -1)).filter((i) => i >= 0));
  };
  const rows = [
    ['Место в рейтинге', ms.map((m) => m.rank), -1, (v) => '#' + v],
    ['Сводный балл', ms.map((m) => m.score), 1, (v) => Math.round(v)],
    ['Общий IQ', ms.map((m) => m.iq), 1],
    ...RADAR_AXES.map((a) => [CRIT[a.id].label, ms.map((m) => m.dims[a.id]), 1]),
    ['Цена за 1M', ms.map((m) => m.cost), -1, fmtUsd],
    ['Скорость, т/с', ms.map((m) => m.speed), 1],
    ['Контекст', ms.map((m) => m.ctx), 1, fmtCtx],
  ];
  setHtml(dlg, h`<div class="dlg">
    <div class="dlg-head"><h2>Сравнение</h2><button class="x" data-act="close" aria-label="Закрыть">✕</button></div>
    <div class="cmp-grid">
      <div>${radarSvg(ms, [lo, hi])}</div>
      <div>
        <div class="cmp-legend">${ms.map((m, i) => h`<span class="sw${i}"><i></i><b>${m.name}</b></span>`)}</div>
        <p class="mini">Радар показывает 7 измерений IQ. Шкала: ${lo}–${hi}. Лучшее значение в строке подсвечено.</p>
        <div class="row"><button class="btn small" data-act="cmp-clear">Очистить сравнение</button></div>
      </div>
    </div>
    <table class="cmp-table">
      <thead><tr><th></th>${ms.map((m) => h`<th>${m.name}</th>`)}</tr></thead>
      <tbody>${rows.map(([label, vals, dir, f]) => {
        const b = best(vals, dir);
        return h`<tr><td>${label}</td>${vals.map((v, i) => h`<td class="${b.has(i) ? 'best' : ''}">${v == null ? '—' : f ? f(v) : v}</td>`)}</tr>`;
      })}
      <tr><td>Открытые веса</td>${ms.map((m) => h`<td>${m.os ? 'да' : 'нет'}</td>`)}</tr>
      </tbody>
    </table>
  </div>`);
  return true;
}

// ---------- консенсус ----------
export function renderConsensus() {
  const S = app.sources;
  if (!S) {
    $('#consNote').textContent = 'Не удалось загрузить data/sources.json.';
    setHtml($('#consTabs'), h``); setHtml($('#consBody'), h``);
    return;
  }
  const byId = Object.fromEntries(S.sources.map((s) => [s.id, s]));
  const live = S.sources.filter((s) => !s.stale && s.models.length);
  $('#consNote').textContent = `Обновлено ${ago(S.updated)} · работает источников: ${live.length} из ${S.sources.length} · моделей в консенсусе: ${app.consensus.length}. Модель попадает сюда, если её подтвердили минимум два источника.`;
  const tabs = [['consensus', '🎯 Консенсус'], ...SRC_ORDER.filter((id) => byId[id]).map((id) => [id, byId[id].name])];
  setHtml($('#consTabs'), h`${tabs.map(([id, label]) => h`<button class="tab" role="tab" data-act="cons-tab" data-id="${id}" data-focus-key="tab-${id}" aria-selected="${state.cons === id}">${label}</button>`)}`);

  if (state.cons === 'consensus' || !byId[state.cons]) {
    const n = S.sources.length;
    const top = app.consensus.slice(0, 10);
    setHtml($('#consBody'), h`<div class="top10">${top.map((c) => {
      const m = c.model, ins = m ? insights(m, app.stats) : null;
      return h`<article class="tcard" ${m ? raw(`data-act="open" data-id="${esc(m.id)}" tabindex="0"`) : ''}>
        <div class="place">${c.rank}</div>
        <div>
          <div class="nm">${c.name}</div>
          <div class="sub">${m ? `${m.flag} ${m.provider} · ` : ''}консенсус ${c.score.toFixed(1)}/100 · подтверждён ${c.coverage} из ${n}<span class="dots" aria-hidden="true">${S.sources.map((s) => h`<i class="${c.per[s.id] ? 'on' : ''}"></i>`)}</span></div>
          <div class="per">${Object.entries(c.per).sort((a, b) => a[1].rank - b[1].rank).map(([sid, v]) => h`<span class="${v.rank === 1 ? 'r1' : ''}">${byId[sid]?.name || sid} #${v.rank}</span>`)}</div>
          ${ins ? insightsBlock({ pros: ins.pros.slice(0, 3), cons: ins.cons.slice(0, 3) }) : h`<p class="mini">В базе aiiq нет данных для автоматических плюсов и минусов.</p>`}
        </div>
      </article>`;
    })}</div>
    <div class="table-wrap"><table class="rank-table"><thead><tr><th>#</th><th class="l">Модель</th><th>Консенсус</th><th>Источников</th></tr></thead><tbody>${app.consensus.slice(10, 40).map((c) => h`<tr class="trow" ${c.model ? raw(`data-act="open" data-id="${esc(c.model.id)}" tabindex="0"`) : ''}><td class="rk">${c.rank}</td><td class="nm"><span class="n">${c.name}</span><span class="s">${c.model ? c.model.provider : ''}</span></td><td class="v h2">${c.score.toFixed(1)}</td><td class="v h1">${c.coverage}/${n}</td></tr>`)}</tbody></table></div>
    <p class="mini">Ограничение: свежие модели 2026 года есть в основном в AI IQ и LMArena, поэтому у них покрытие 2 источника. Старые снимки (LiveBench 2025-05, Aider 2025) весят вдвое меньше.</p>`);
    return;
  }
  const s = byId[state.cons];
  setHtml($('#consBody'), h`<div class="src-info">
    <span class="pill ${s.fresh === 'live' ? 'live' : 'snap'}">${s.fresh === 'live' ? 'живой' : 'снимок' + (s.snapshot ? ' ' + s.snapshot : '')}</span>${s.stale ? h`<span class="pill snap">данные не обновились</span>` : ''}
    <b>${s.name}</b> · ${s.org} · <a href="${s.url}" target="_blank" rel="noopener noreferrer">открыть источник ↗</a><br>
    <b>Что измеряет:</b> ${s.method}<br><b>Слабое место:</b> <span class="warn">${s.risk}</span>${s.error ? h`<br><b>Ошибка последнего сбора:</b> ${s.error}` : ''}
  </div>
  <div class="table-wrap"><table class="rank-table"><thead><tr><th>#</th><th class="l">Модель</th><th>${s.unit || 'Балл'}</th></tr></thead><tbody>${s.models.slice(0, 40).map((e) => h`<tr><td class="rk ${e.rank <= 3 ? 't' + e.rank : ''}">${e.rank}</td><td class="nm"><span class="n">${e.name}</span></td><td class="v h2">${e.score}${e.label || e.scoreLabel ? ' (' + (e.label || e.scoreLabel) + ')' : ''}</td></tr>`)}</tbody></table></div>`);
}

// ---------- партнёры ----------
export function renderPartners() {
  setHtml($('#partners'), h`${REF_PROVIDERS.map((p) => h`<a class="partner" href="${refUrl(p)}" target="_blank" rel="noopener noreferrer sponsored"><b>${p.name}<span>↗</span></b><span>${p.desc}</span></a>`)}`);
}
export function renderRefFields() {
  setHtml($('#refFields'), h`${REF_PROVIDERS.map((p) => h`<div class="ref-field"><label for="rc_${p.key}">${p.name}</label><input id="rc_${p.key}" data-ref="${p.key}" type="text" placeholder="реф-код" value="${codes[p.key] || ''}" autocomplete="off" spellcheck="false"><span class="mini" style="grid-column:1/-1">Где взять: ${p.where}</span></div>`)}`);
}

// ---------- прочее ----------
let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

// Запоминает, что было в фокусе, и возвращает фокус после перерисовки.
export function keepFocus(fn) {
  const a = document.activeElement;
  const key = a && a.closest ? a.closest('[data-focus-key]')?.dataset.focusKey : null;
  fn();
  if (key) $(`[data-focus-key="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
}

export { X_AXES };
