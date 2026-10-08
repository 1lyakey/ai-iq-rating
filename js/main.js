import { $, $$, h, setHtml } from './dom.js';
import { prepare, PRESET } from './score.js';
import { loadModels, loadSources, buildConsensus } from './data.js';
import { state, readHash, writeHash, storeSet, MAX_CMP, PRICE_STEPS } from './state.js';
import { loadCodes, saveCodes, resetCodes, shareUrl, codes } from './refs.js';
import { REFRESH_MS, PAGE_SIZE, REF_PROVIDERS } from './config.js';
import {
  app, compute, indexProviders, renderStatus, renderPresets, renderWeights, syncWeights, renderFilters, renderPodium,
  renderFresh, renderTableHead, renderTable, renderChartControls, renderChart, renderCmpBar, renderDetail, renderCompare,
  renderConsensus, renderPartners, renderRefFields, tipHtml, toast, keepFocus, defaultDir,
} from './ui.js';

// ---------- обновление интерфейса ----------
function update({ hash = true } = {}) {
  compute();
  keepFocus(() => {
    renderPresets();
    renderFilters();
    renderPodium();
    renderTableHead();
    renderTable();
    renderChartControls();
    renderChart();
    renderCmpBar();
  });
  if (hash) writeHash();
}

function applyData(md, sources) {
  app.meta = md;
  app.models = md.models;
  app.stats = prepare(app.models);
  app.byId = new Map(app.models.map((m) => [m.id, m]));
  if (sources !== undefined) app.sources = sources;
  indexProviders();
  app.consensus = buildConsensus(app.sources, app.models);
  state.cmp = state.cmp.filter((id) => app.byId.has(id));
  renderStatus();
  renderFresh();
  renderConsensus();
  update({ hash: false });
}

// ---------- диалоги ----------
function openDetail(id) {
  if (!renderDetail(id)) return;
  state.open = id;
  const d = $('#detail');
  if (!d.open) d.showModal();
  writeHash();
}
function openCompare() {
  if (!renderCompare()) return;
  const d = $('#compare');
  if (!d.open) d.showModal();
}
function toggleCmp(id, keepDetail = false) {
  const i = state.cmp.indexOf(id);
  if (i >= 0) state.cmp.splice(i, 1);
  else if (state.cmp.length >= MAX_CMP) { toast(`В сравнение можно добавить максимум ${MAX_CMP} модели`); update(); return; }
  else state.cmp.push(id);
  update();
  if (keepDetail && $('#detail').open) renderDetail(id);
  if ($('#compare').open) { if (!renderCompare()) $('#compare').close(); }
}

function setPreset(id) {
  const prevOs = PRESET[state.preset]?.os;
  state.preset = id;
  state.w = { ...PRESET[id].w };
  if (PRESET[id].os) state.os = true;
  else if (prevOs) state.os = false;
  state.limit = 0;
  syncWeights();
  update();
}

// ---------- события ----------
document.addEventListener('click', (e) => {
  const cell = e.target.closest('td.cmp');
  if (cell) { const row = cell.closest('tr[data-id]'); if (row) { toggleCmp(row.dataset.id); return; } }
  const t = e.target.closest('[data-act]');
  if (!t) {
    const dlg = e.target.closest('dialog');
    if (dlg === e.target) dlg.close();            // клик по подложке
    return;
  }
  const id = t.dataset.id;
  switch (t.dataset.act) {
    case 'preset': setPreset(id); break;
    case 'open': openDetail(id); break;
    case 'close': t.closest('dialog')?.close(); break;
    case 'cmp-toggle': toggleCmp(id, t.dataset.keep === '1'); break;
    case 'cmp-clear': state.cmp = []; update(); $('#compare').close(); break;
    case 'open-compare': openCompare(); break;
    case 'prov': state.providers.has(id) ? state.providers.delete(id) : state.providers.add(id); state.limit = 0; update(); break;
    case 'clear-providers': state.providers.clear(); update(); break;
    case 'sort':
      state.sort = state.sort.key === id ? { key: id, dir: -state.sort.dir } : { key: id, dir: defaultDir(id) };
      update(); break;
    case 'more': state.limit = Math.max(state.limit, PAGE_SIZE) + PAGE_SIZE; renderTable(); break;
    case 'reset-weights': state.os = false; setPreset('universal'); break;
    case 'chart-x': state.chart.x = id; update(); break;
    case 'chart-y': state.chart.y = id; update(); break;
    case 'cons-tab': state.cons = id; keepFocus(renderConsensus); writeHash(); break;
    case 'theme': toggleTheme(); break;
    case 'share': share(); break;
    case 'ref-save': {
      const vals = {};
      $$('[data-ref]').forEach((i) => { vals[i.dataset.ref] = i.value.trim(); });
      saveCodes(vals); renderPartners(); renderRefFields();
      $('#refStatus').textContent = '✓ Сохранено в этом браузере. Ссылки в блоке «Где попробовать» обновлены.';
      break;
    }
    case 'ref-reset': resetCodes(); renderPartners(); renderRefFields(); $('#refStatus').textContent = 'Сброшено.'; break;
    case 'ref-copy': copy(shareUrl(), 'Ссылка с вашими кодами скопирована'); break;
    default: break;
  }
});

document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('tr.trow, th[data-act], .pod, .tcard, circle.pt')) {
    e.preventDefault();
    e.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }
  if (e.key === '/' && !e.target.matches?.('input, textarea, select')) { e.preventDefault(); $('#filtersBox').open = true; $('#search').focus(); }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'search') { state.q = t.value; state.limit = 0; update(); }
  else if (t.dataset.w) {
    state.w[t.dataset.w] = +t.value;
    state.preset = 'custom';
    $('#wv_' + t.dataset.w).textContent = t.value;
    state.limit = 0;
    update();
  } else if (t.id === 'priceMax') {
    const i = +t.value;
    state.maxPrice = i >= PRICE_STEPS.length ? null : PRICE_STEPS[i];
    update();
  }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'osOnly') { state.os = e.target.checked; state.limit = 0; update(); }
  if (e.target.id === 'sortSel') { const k = e.target.value; state.sort = { key: k, dir: defaultDir(k) }; update(); }
});

for (const id of ['detail', 'compare']) {
  $('#' + id).addEventListener('close', () => { if (id === 'detail') { state.open = null; writeHash(); } });
}

// Подсказка на графике
const box = $('.chart-box'), tip = $('#tip');
function showTip(e) {
  const c = e.target.closest?.('circle.pt');
  if (!c) { tip.hidden = true; return; }
  const m = app.byId.get(c.dataset.id);
  if (!m) return;
  setHtml(tip, tipHtml(m));
  tip.hidden = false;
  const r = box.getBoundingClientRect();
  let x, y;
  if (e.clientX) { x = e.clientX - r.left + 14; y = e.clientY - r.top + 14; }
  else { const b = c.getBoundingClientRect(); x = b.left - r.left + 16; y = b.top - r.top + 16; }
  x = Math.min(x, r.width - tip.offsetWidth - 8); y = Math.min(y, r.height - tip.offsetHeight - 8);
  tip.style.left = Math.max(4, x) + 'px'; tip.style.top = Math.max(4, y) + 'px';
}
$('#chart').addEventListener('mousemove', showTip);
$('#chart').addEventListener('focusin', showTip);
$('#chart').addEventListener('mouseleave', () => { tip.hidden = true; });
$('#chart').addEventListener('focusout', () => { tip.hidden = true; });

let rz; let lastW = 0;
new ResizeObserver(() => {
  const w = $('#chart').clientWidth;
  if (!app.models.length || Math.abs(w - lastW) < 4) return;
  lastW = w; clearTimeout(rz); rz = setTimeout(renderChart, 120);
}).observe($('#chart'));

// ---------- прочее ----------
function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  storeSet('theme', next);
}
async function copy(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch { toast('Не удалось скопировать — возьмите ссылку из адресной строки'); }
}
function share() { writeHash(); copy(location.href, 'Ссылка на этот вид рейтинга скопирована'); }

// ---------- старт ----------
async function init() {
  readHash();
  loadCodes();
  if (innerWidth <= 1020) $('#filtersBox').open = false;   // на телефоне сразу показываем рейтинг, а не фильтры
  renderPresets(); renderWeights(); renderTableHead(); renderChartControls(); renderPartners(); renderRefFields();
  $('#status').textContent = 'Загружаю данные…';

  const [md, src] = await Promise.all([loadModels().catch((e) => ({ fatal: e })), loadSources()]);
  if (md.fatal) {
    $('#status').className = 'eyebrow';
    $('#status').textContent = 'Не удалось загрузить данные';
    setHtml($('#podium'), h`<li class="empty">Нет связи с aiiq.org и нет локальной копии (${md.fatal.message}).<br><button class="btn" id="retry">Повторить</button></li>`);
    $('#retry')?.addEventListener('click', () => location.reload());
    return;
  }
  applyData(md, src);
  if (state.open && app.byId.has(state.open)) openDetail(state.open); else state.open = null;
  if (new URLSearchParams(location.hash.slice(1)).get('c') && state.cmp.length >= 2) { /* сравнение открывается кнопкой */ }

  setInterval(async () => {
    try {
      const next = await loadModels();
      if (next.live && next.updatedAt !== app.meta?.updatedAt) applyData(next);
    } catch { /* остаёмся на текущих данных */ }
  }, REFRESH_MS);
  setInterval(renderStatus, 60 * 1000);
}

init().catch((e) => { console.error("INIT FAILED:", e); const s = document.querySelector("#status"); if (s) s.textContent = "Ошибка: " + e.message; });
export { REF_PROVIDERS, codes };
