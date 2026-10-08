// ============================================================
//  Сборщик данных для сайта.
//  Запуск:  node scripts/build-sources.mjs
//  Пишет:   data/aiiq.json     — полный список моделей aiiq.org (офлайн-копия для сайта)
//           data/sources.json  — рейтинги 6 независимых источников
//
//  Если источник не ответил — берём его прошлую версию из data/sources.json
//  и помечаем stale:true, чтобы сайт не остался без данных.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { canon, normalizeAiiq } from '../js/normalize.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const F_SOURCES = path.join(ROOT, 'data/sources.json');
const F_AIIQ = path.join(ROOT, 'data/aiiq.json');
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131 Safari/537.36' };
const TOP = 100;

async function get(url, { ms = 25000, json = false, headers = {}, tries = 2 } = {}) {
  let err;
  for (let i = 0; i < tries; i++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { headers: { ...UA, ...headers }, signal: ctl.signal, redirect: 'follow' });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
      return json ? await r.json() : await r.text();
    } catch (e) {
      err = e;
    } finally {
      clearTimeout(t);
    }
  }
  throw err;
}

const ghHeaders = process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};

// сортировка по баллу, одна запись на модель (лучший режим), затем ранги
function rankify(list) {
  const best = new Map();
  for (const x of list) if (!best.has(x.key) || best.get(x.key).score < x.score) best.set(x.key, x);
  const out = [...best.values()].sort((a, b) => b.score - a.score);
  out.forEach((x, i) => { x.rank = i + 1; });
  return out;
}

// ---------- 1. AI IQ (композитный IQ по ~40 бенчмаркам) ----------
async function srcAiiq() {
  const d = await get('https://www.aiiq.org/api/v1/models', { json: true });
  const all = d.models.map(normalizeAiiq);
  const withIq = all.filter((m) => m.iq != null);
  if (withIq.length < 20) throw new Error('aiiq: подозрительно мало моделей ' + withIq.length);
  fs.writeFileSync(F_AIIQ, JSON.stringify({
    updatedAt: d.updatedAt, methodology: d.methodologyVersion, models: all,
  }));
  const models = rankify(withIq.map((m) => ({ name: m.name, key: m.key, score: m.iq })).slice(0, 400)).slice(0, TOP);
  return {
    id: 'aiiq', name: 'AI IQ', org: 'aiiq.org (Liberated Software)', fresh: 'live', url: 'https://aiiq.org',
    method: 'Композитный IQ по ~40 публичным бенчмаркам: ARC Prize, FrontierMath, LiveCodeBench, Terminal-Bench, OSWorld и др.',
    risk: 'Агрегатор сам выбирает бенчмарки и веса, поэтому результат зависит от методики оператора.',
    unit: 'IQ', models,
  };
}

// ---------- 2. LMArena (слепые голосования людей) ----------
// Страница отдаёт данные JSON-ом внутри Next.js-потока (кавычки экранированы).
async function srcArena() {
  const html = await get('https://arena.ai/leaderboard/text', { ms: 40000 });
  const models = [], seen = new Set();
  const re = /\\"modelDisplayName\\":\\"([^"\\]+)\\",\\"rating\\":([\d.]+)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const name = m[1], score = Math.round(+m[2]);
    if (score > 900 && score < 2000 && !seen.has(name)) {
      seen.add(name);
      models.push({ name, key: canon(name.replace(/-max$/, '')), score });
    }
  }
  if (models.length < 10) throw new Error('arena: разметка страницы изменилась (' + models.length + ' строк)');
  // у одной модели бывает несколько режимов (high/thinking) — оставляем лучший
  const best = new Map();
  for (const x of models) if (!best.has(x.key) || best.get(x.key).score < x.score) best.set(x.key, x);
  return {
    id: 'arena', name: 'LMArena', org: 'Arena Intelligence', fresh: 'live', url: 'https://arena.ai/leaderboard/text',
    method: 'Слепые парные сравнения: миллионы голосов живых пользователей, ELO-рейтинг.',
    risk: 'Голоса людей — это вкус: стиль и оформление ответа влияют на оценку, возможна накрутка.',
    unit: 'ELO', models: rankify([...best.values()]).slice(0, TOP),
  };
}

// ---------- 3. SWE-bench Verified ----------
async function srcSwe() {
  const tree = await get('https://api.github.com/repos/SWE-bench/experiments/git/trees/main?recursive=1', { json: true, headers: ghHeaders });
  const files = (tree.tree || []).filter((x) => /^evaluation\/verified\/.+\/results\/results\.json$/.test(x.path));
  const byModel = {};
  for (const f of files) {
    const mm = f.path.match(/^evaluation\/verified\/(\d{8})_([a-z0-9.\-]+?)_(.+?)\/results\/results\.json$/);
    if (!mm) continue;
    const [, date, harness, model] = mm;
    const k = canon(model);
    if (!byModel[k] || byModel[k].date < date) byModel[k] = { date, harness, model, path: f.path };
  }
  // сначала самые свежие — именно они интересны
  const entries = Object.entries(byModel).sort((a, b) => b[1].date.localeCompare(a[1].date)).slice(0, 80);
  const models = [];
  for (const [key, info] of entries) {
    try {
      const res = await get('https://raw.githubusercontent.com/SWE-bench/experiments/main/' + info.path, { json: true, ms: 15000, tries: 1 });
      const resolved = (res.resolved || []).length;
      const total = resolved + (res.unresolved || []).length + (res.no_generation || []).length + (res.no_logs || []).length;
      if (total >= 100 && resolved > 0) {   // меньше 100 задач — не Verified-прогон
        models.push({ name: info.model.replace(/-/g, ' '), key, score: Math.round((resolved / total) * 1000) / 10, label: `${resolved}/${total}`, date: info.date });
      }
    } catch { /* битый файл — пропускаем */ }
  }
  if (models.length < 5) throw new Error('swe: мало результатов ' + models.length);
  return {
    id: 'swe', name: 'SWE-bench Verified', org: 'Princeton NLP', fresh: 'live', url: 'https://www.swebench.com',
    method: 'Реальные баг-фиксы из GitHub (500 задач), проверка автотестами. Оценки агентных систем.',
    risk: 'Измеряет только программирование; результат зависит от выбранной обвязки (агента).',
    unit: '% решённых', models: rankify(models).slice(0, TOP),
  };
}

// ---------- 4. Hugging Face Open LLM Leaderboard ----------
async function srcHf() {
  const d = await get('https://datasets-server.huggingface.co/first-rows?dataset=open-llm-leaderboard%2Fcontents&config=default&split=train', { json: true });
  const cols = (d.features || []).map((f) => f.name);
  const scoreCol = cols.find((c) => /average|overall|score/i.test(c)) || 'Average ⬆️';
  const models = (d.rows || []).map((r) => {
    const o = r.row;
    const name = o.fullname || o.model || o.Model || '';
    const sc = parseFloat(o[scoreCol]);
    return name && !Number.isNaN(sc) ? { name: String(name), key: canon(name), score: Math.round(sc * 100) / 100 } : null;
  }).filter(Boolean);
  if (models.length < 5) throw new Error('hf: пустой ответ');
  return {
    id: 'hf', name: 'HF Open LLM', org: 'Hugging Face', fresh: 'live',
    url: 'https://huggingface.co/spaces/open-llm-leaderboard/open_llm_leaderboard',
    method: 'Воспроизводимые прогоны открытых моделей: MMLU-Pro, GPQA, IFEval, MATH, MUSR.',
    risk: 'Только модели с открытыми весами: флагманы OpenAI, Anthropic и Google сюда не попадают.',
    unit: 'средний балл', models: rankify(models).slice(0, TOP),
  };
}

// ---------- 5. LiveBench (снимок мая 2025) ----------
async function srcLiveBench() {
  const csv = await get('https://livebench.ai/table_2025_05_30.csv');
  const lines = csv.trim().split('\n');
  const models = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    if (cells.length < 5) continue;
    const nums = cells.slice(1).map(Number).filter((n) => !Number.isNaN(n));
    if (!nums.length) continue;
    models.push({ name: cells[0].trim(), key: canon(cells[0]), score: Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100 });
  }
  if (models.length < 5) throw new Error('livebench: пустой CSV');
  return {
    id: 'livebench', name: 'LiveBench', org: 'Abacus.AI, NYU и др.', fresh: 'snapshot', snapshot: '2025-05-30', url: 'https://livebench.ai',
    method: 'Задачи с автопроверкой, обновляемые каждый выпуск (защита от утечки в обучение). 20 категорий.',
    risk: 'Последний доступный снимок — май 2025, моделей 2026 года здесь нет.',
    unit: 'средний балл', models: rankify(models).slice(0, TOP),
  };
}

// ---------- 6. Aider Polyglot ----------
async function srcAider() {
  const html = await get('https://aider.chat/docs/leaderboards/', { ms: 30000 });
  const models = [], seen = new Set();
  const re = /<td[^>]*><span>([^<]+)<\/span><\/td>\s*<td class="bar-cell">[\s\S]*?<span>(\d{1,3}(?:\.\d)?)%<\/span>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const name = m[1].trim().replace(/\s*\(.*?\)\s*/g, ' ').trim();
    const score = +m[2], key = canon(name);
    if (score >= 5 && !seen.has(key)) { seen.add(key); models.push({ name, key, score }); }
  }
  if (models.length < 5) throw new Error('aider: разметка изменилась');
  return {
    id: 'aider', name: 'Aider Polyglot', org: 'Aider', fresh: 'snapshot', snapshot: '2025', url: 'https://aider.chat/docs/leaderboards/',
    method: '225 задач на C++, Go, Java, JS, Python, Rust: модель сама правит файлы и проходит тесты.',
    risk: 'Снимок 2025 года и узкий фокус — редактирование кода.',
    unit: '% решённых', models: rankify(models).slice(0, TOP),
  };
}

// ---------- запуск ----------
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const prev = readJson(F_SOURCES);
const prevById = Object.fromEntries((prev?.sources || []).map((s) => [s.id, s]));

const jobs = [['aiiq', srcAiiq], ['arena', srcArena], ['swe', srcSwe], ['hf', srcHf], ['livebench', srcLiveBench], ['aider', srcAider]];
const sources = [];
let failed = 0;
for (const [id, fn] of jobs) {
  try {
    const s = await fn();
    // снимки статичны: если свежий сбор не удался, держим прошлый, а удался — берём новый
    sources.push({ ...s, error: null, stale: false });
    console.log(`ok   ${id.padEnd(10)} ${s.models.length} моделей`);
  } catch (e) {
    failed++;
    const old = prevById[id];
    console.error(`FAIL ${id.padEnd(10)} ${e.message}${old ? ' → оставляю прошлую версию' : ''}`);
    if (old) {
      // чистим мусор старого формата: «100% = 2/2 задач» — не результат
      const ok = (m) => { const t = +String(m.label ?? m.scoreLabel ?? '').split('/')[1]; return Number.isNaN(t) || t >= 100; };
      sources.push({ ...old, models: old.models.filter(ok), error: e.message, stale: true });
    }
    else sources.push({ id, name: id, org: '', fresh: 'snapshot', url: '', method: '', risk: '', unit: '', models: [], error: e.message, stale: true });
  }
}

// timestamp меняем только если данные реально изменились — иначе бот коммитит впустую
const strip = (s) => JSON.stringify(s.map(({ error, stale, ...r }) => r));
const changed = !prev || strip(prev.sources) !== strip(sources);
const out = { updated: changed ? new Date().toISOString() : prev.updated, sources };
if (changed || JSON.stringify(prev.sources.map((s) => [s.id, s.error, s.stale])) !== JSON.stringify(sources.map((s) => [s.id, s.error, s.stale]))) {
  fs.writeFileSync(F_SOURCES, JSON.stringify(out));
  console.log('data/sources.json обновлён');
} else {
  console.log('data/sources.json без изменений');
}
if (sources.every((s) => s.error)) process.exit(1);
