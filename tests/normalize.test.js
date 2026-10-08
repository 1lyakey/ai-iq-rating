import test from 'node:test';
import assert from 'node:assert/strict';
import { canon, normalizeAiiq } from '../js/normalize.js';

test('canon: одинаковые модели из разных источников совпадают', () => {
  assert.equal(canon('claude-fable-5-high'), 'fable-5');
  assert.equal(canon('fable-5'), 'fable-5');
  assert.equal(canon('claude-opus-4-5-20251101-thinking-medium-effort'), 'opus-4.5');
  assert.equal(canon('opus-4.5'), 'opus-4.5');
  assert.equal(canon('Gemini 3.8 Flash'), 'gemini-3.8-flash');
  assert.equal(canon('GLM-5.3'), 'glm-5.3');
  assert.equal(canon('meta-llama/Llama-3.3-70B-Instruct'), 'llama-3.3-70b-instruct');
  assert.equal(canon('o3-mini-high'), 'o3-mini');
});

test('canon: не склеивает разные размеры и версии', () => {
  assert.notEqual(canon('qwen3-235b-a22b'), canon('qwen3-23b'));
  assert.notEqual(canon('gpt-5.4'), canon('gpt-5.5'));
  assert.equal(canon('qwen3-235b-a22b'), 'qwen3-235b-a22b');
  assert.equal(canon(null), 'unknown');
});

test('normalizeAiiq: плоская модель', () => {
  const m = normalizeAiiq({
    id: 'x', name: 'Model-X', provider: 'P', iq: 120, modelType: 'openWeight',
    dimensions: { 'programmatic-reasoning': 130, 'computer-use': null },
    cost: { effectivePer1M: 1.5, inputPer1M: 1, outputPer1M: 4 },
    speed: { medianTokensPerSecond: 80 }, contextWindow: 200000, releaseDate: '2026-01-01',
  });
  assert.equal(m.dims.code, 130);
  assert.equal(m.dims.agent, null);
  assert.equal(m.cost, 1.5);
  assert.equal(m.speed, 80);
  assert.equal(m.os, true);
  assert.equal(m.key, 'model-x');
});
