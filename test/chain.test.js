import test from 'node:test';
import assert from 'node:assert/strict';
import { linkState, chainSummary } from '../src/chain.js';
import { createMatch, ATTACK, COOPERATE } from '../src/engine.js';
import { localEvaluator } from '../src/evaluators/local.js';

const rec = (round, A, B, readA = null, readB = null) => ({ round, finalAction: { A, B }, readResult: { A: readA, B: readB } });

test('链环状态：完好、修复、裂痕、断裂', () => {
  assert.equal(linkState(rec(1, COOPERATE, COOPERATE)), 'intact');
  assert.equal(linkState(rec(1, COOPERATE, COOPERATE, 'interference')), 'mended');
  assert.equal(linkState(rec(1, COOPERATE, ATTACK)), 'cracked');
  assert.equal(linkState(rec(1, ATTACK, COOPERATE, null, 'genuine')), 'cracked');
  assert.equal(linkState(rec(1, ATTACK, ATTACK)), 'broken');
});

test('真实对局：执剑人对执剑人，第 3 轮干扰不读心，猜疑链从第 3 轮开始一直延续', async () => {
  const NO = { A: false, B: false };
  const plan = [NO, NO, { A: true, B: false }, NO, NO, NO];
  const m = createMatch({ circuits: { A: 1, B: 1 }, evaluator: localEvaluator, plan, config: { rounds: 6 } });
  while (!m.isOver) {
    await m.startRound();
    await m.resolveRound({});
  }
  const s = chainSummary(m.history);
  assert.deepEqual(s.states, ['intact', 'intact', 'cracked', 'cracked', 'cracked', 'cracked']);
  assert.equal(s.firstCrackRound, 3);
  assert.equal(s.longestRun, 4);
});

test('真实对局：同样的干扰，读心识破后链环被修复，之后一直完好', async () => {
  const NO = { A: false, B: false };
  const plan = [NO, NO, { A: false, B: true }, NO, NO, NO];
  const m = createMatch({ circuits: { A: 1, B: 1 }, evaluator: localEvaluator, plan, config: { rounds: 6 } });
  while (!m.isOver) {
    const { observed } = await m.startRound();
    await m.resolveRound({ A: observed.B === ATTACK });
  }
  const s = chainSummary(m.history);
  assert.deepEqual(s.states, ['intact', 'intact', 'mended', 'intact', 'intact', 'intact']);
  assert.equal(s.firstCrackRound, null);
  assert.equal(s.mended, 1);
});
