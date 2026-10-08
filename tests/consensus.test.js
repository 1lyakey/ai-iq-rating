import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConsensus } from '../js/data.js';

const src = (id, fresh, keys) => ({
  id, fresh,
  models: keys.map((k, i) => ({ key: k, name: k, score: 100 - i, rank: i + 1 })),
});

test('консенсус: берём только модели, подтверждённые ≥2 источниками', () => {
  const sources = { sources: [
    src('a', 'live', ['x', 'y', 'z', 'solo-a', 'q', 'r']),
    src('b', 'live', ['y', 'x', 'solo-b', 'z', 'q', 'r']),
  ] };
  const res = buildConsensus(sources, []);
  const keys = res.map((c) => c.key);
  assert.ok(!keys.includes('solo-a') && !keys.includes('solo-b'));
  assert.deepEqual(new Set(keys), new Set(['x', 'y', 'z', 'q', 'r']));
  assert.equal(res[0].rank, 1);
});

test('консенсус: устаревший снимок весит вдвое меньше живого', () => {
  // m1 первый в живом и последний в снимке, m2 наоборот
  const sources = { sources: [
    src('live', 'live', ['m1', 'm2', 'f1', 'f2', 'f3']),
    { ...src('snap', 'snapshot', ['f1', 'f2', 'f3', 'm2', 'm1']) },
  ] };
  const res = buildConsensus(sources, []);
  const m1 = res.find((c) => c.key === 'm1'), m2 = res.find((c) => c.key === 'm2');
  assert.ok(m1.score > m2.score, 'живой источник должен перевешивать снимок');
});

test('консенсус: источник с пустым списком или без данных не ломает расчёт', () => {
  assert.deepEqual(buildConsensus(null, []), []);
  const sources = { sources: [src('a', 'live', ['x', 'y', 'z', 'q', 'r']), { id: 'empty', fresh: 'live', models: [] }] };
  assert.deepEqual(buildConsensus(sources, []), []);
});
