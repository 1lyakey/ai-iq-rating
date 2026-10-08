import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CRITERIA, PRESETS, prepare, applyScores, scoreModel, pareto, insights, isEmptyWeights } from '../js/score.js';

const mk = (name, o = {}) => ({
  name, provider: 'P', iq: 120, dims: { code: 120, agent: 120, math: 120, academic: 120, abstract: 120, reliab: 120, knowledge: 120 },
  cost: 5, speed: 100, ctx: 200000, os: false, ...o, dims: { code: 120, agent: 120, math: 120, academic: 120, abstract: 120, reliab: 120, knowledge: 120, ...(o.dims || {}) },
});

test('пресеты: у каждого есть положительные веса по всем критериям-ключам', () => {
  for (const p of PRESETS) {
    assert.ok(!isEmptyWeights(p.w), p.id);
    assert.deepEqual(Object.keys(p.w).sort(), CRITERIA.map((c) => c.id).sort());
  }
});

test('цена: дешёвая модель получает больше очков по критерию price', () => {
  const ms = [mk('cheap', { cost: 0.1 }), mk('mid', { cost: 5 }), mk('dear', { cost: 80 })];
  prepare(ms);
  assert.ok(ms[0].s.price > ms[1].s.price && ms[1].s.price > ms[2].s.price);
});

test('вес кода меняет победителя', () => {
  const ms = [mk('coder', { iq: 110, dims: { code: 150 } }), mk('thinker', { iq: 140, dims: { code: 100 } })];
  prepare(ms);
  const codeOnly = Object.fromEntries(CRITERIA.map((c) => [c.id, c.id === 'code' ? 10 : 0]));
  const iqOnly = Object.fromEntries(CRITERIA.map((c) => [c.id, c.id === 'iq' ? 10 : 0]));
  assert.equal(applyScores(ms, codeOnly)[0].name, 'coder');
  assert.equal(applyScores(ms, iqOnly)[0].name, 'thinker');
});

test('нет данных о цене → штраф, а не бонус; coverage < 1', () => {
  const ms = [mk('known', { cost: 5 }), mk('unknown', { cost: null }), mk('x', { cost: 1 })];
  prepare(ms);
  const w = Object.fromEntries(CRITERIA.map((c) => [c.id, c.id === 'price' ? 10 : 0]));
  const a = scoreModel(ms[0], w), b = scoreModel(ms[1], w);
  assert.equal(b.score, 30);
  assert.equal(b.coverage, 0);
  assert.equal(a.coverage, 1);
});

test('оценки в диапазоне 0..100', () => {
  const ms = Array.from({ length: 30 }, (_, i) => mk('m' + i, { iq: 90 + i, cost: 0.1 * (i + 1), speed: 10 * (i + 1) }));
  prepare(ms);
  for (const m of ms) for (const c of CRITERIA) assert.ok(m.s[c.id] >= 0 && m.s[c.id] <= 100, c.id + ' ' + m.s[c.id]);
});

test('pareto: цена↓, качество↑', () => {
  const ms = [mk('a', { cost: 1 }), mk('b', { cost: 2 }), mk('c', { cost: 3 }), mk('d', { cost: 4 })];
  ms[0].score = 50; ms[1].score = 70; ms[2].score = 60; ms[3].score = 90;
  const p = pareto(ms, (m) => m.cost, (m) => m.score, 'low').map((m) => m.name);
  assert.deepEqual(p, ['a', 'b', 'd']);
});

test('insights: каждая строка опирается на число, максимум 4', () => {
  const ms = Array.from({ length: 40 }, (_, i) => mk('m' + i, { iq: 100 + i, cost: i + 1, speed: 5 * (i + 1), ctx: 8000 * (i + 1), dims: { code: 100 + i } }));
  const st = prepare(ms);
  const best = ms[39], worst = ms[0];
  const ib = insights(best, st), iw = insights(worst, st);
  assert.ok(ib.pros.length >= 1 && ib.pros.length <= 4);
  assert.ok(iw.pros.some((t) => /Дёшево/.test(t)));
  assert.ok(ib.cons.some((t) => /Дорого/.test(t)));
});

test('реальные данные: победитель универсала — топ по IQ, пересчёт стабилен', { skip: !fs.existsSync(new URL('../data/aiiq.json', import.meta.url)) }, async () => {
  const { normalizeAiiq } = await import('../js/normalize.js');
  const raw = JSON.parse(fs.readFileSync(new URL('../data/aiiq.json', import.meta.url), 'utf8'));
  const ms = raw.models.filter((m) => m.iq != null);
  prepare(ms);
  const uni = PRESETS.find((p) => p.id === 'universal').w;
  const order = applyScores(ms, uni);
  const topIq = [...ms].sort((a, b) => b.iq - a.iq).slice(0, 10).map((m) => m.name);
  assert.ok(topIq.includes(order[0].name), `победитель ${order[0].name} не в топ-10 по IQ`);
  const vals = PRESETS.map((p) => applyScores(ms, p.w)[0].name);
  assert.ok(new Set(vals).size >= 3, 'пресеты должны давать разных победителей: ' + vals.join(', '));
  void normalizeAiiq;
});
