import test from 'node:test';
import assert from 'node:assert/strict';
import { ERAS, resolveEra, eraConfig } from '../src/eras.js';
import { createMatch } from '../src/engine.js';
import { localEvaluator } from '../src/evaluators/local.js';

test('每个纪元都有可用参数', () => {
  for (const e of ERAS) {
    const { era } = resolveEra(e.id, () => 0.5);
    const cfg = eraConfig(era);
    assert.ok(cfg.rounds >= 3, e.id);
    assert.ok(cfg.interferenceRate >= 0 && cfg.interferenceRate < 1, e.id);
    assert.equal(typeof cfg.allowRead, 'boolean', e.id);
  }
});

test('未知纪元只会抽到恒纪元或乱纪元，并标记为隐藏', () => {
  assert.deepEqual([resolveEra('unknown', () => 0).era.id, resolveEra('unknown', () => 0.99).era.id], ['stable', 'chaotic']);
  assert.equal(resolveEra('unknown').hidden, true);
  assert.equal(resolveEra('stable').hidden, false);
});

test('三日凌空禁止读心', async () => {
  const cfg = eraConfig(resolveEra('triple').era);
  const m = createMatch({ circuits: { A: 4, B: 1 }, evaluator: localEvaluator, plan: Array(cfg.rounds).fill({ A: false, B: false }), config: cfg });
  await m.startRound();
  await assert.rejects(() => m.resolveRound({ B: true }), /不能读心/);
  // 不读心可以正常结算
  assert.deepEqual((await m.resolveRound({})).score, { A: 5, B: 0 });
});
