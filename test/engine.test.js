import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, scoreRound, createInterferencePlan, ATTACK, COOPERATE } from '../src/engine.js';
import { localEvaluator } from '../src/evaluators/local.js';

const NO = { A: false, B: false };
// 6 轮，第 3 轮干扰 A（与讨论中的例子一致）
const PLAN_A3 = [NO, NO, { A: true, B: false }, NO, NO, NO];

async function play(match, readPolicy = () => ({})) {
  while (!match.isOver) {
    const { round, observed } = await match.startRound();
    await match.resolveRound(readPolicy(round, observed));
  }
  return match;
}

test('本地电路真值表', async () => {
  const table = {};
  for (const id of [1, 2, 3, 4]) table[id] = [await localEvaluator.evaluate(id, 0), await localEvaluator.evaluate(id, 1)];
  assert.deepEqual(table, { 1: [0, 1], 2: [1, 0], 3: [1, 1], 4: [0, 0] });
});

test('计分表', () => {
  assert.deepEqual(scoreRound(COOPERATE, COOPERATE), { A: 3, B: 3 });
  assert.deepEqual(scoreRound(ATTACK, COOPERATE), { A: 5, B: 0 });
  assert.deepEqual(scoreRound(COOPERATE, ATTACK), { A: 0, B: 5 });
  assert.deepEqual(scoreRound(ATTACK, ATTACK), { A: 1, B: 1 });
});

test('执剑人对执剑人，无干扰 18:18', async () => {
  const m = createMatch({ circuits: { A: 1, B: 1 }, evaluator: localEvaluator, plan: Array(6).fill(NO), config: { rounds: 6 } });
  await play(m);
  assert.deepEqual(m.totals, { A: 18, B: 18 });
});

test('第 3 轮干扰 A，B 不读心：猜疑链 16:16', async () => {
  const m = createMatch({ circuits: { A: 1, B: 1 }, evaluator: localEvaluator, plan: PLAN_A3, config: { rounds: 6 } });
  await play(m);
  assert.deepEqual(m.history.map((r) => [r.finalAction.A, r.finalAction.B]), [[1, 1], [1, 1], [0, 1], [1, 0], [0, 1], [1, 0]]);
  assert.deepEqual(m.totals, { A: 16, B: 16 });
});

test('第 3 轮干扰 A，B 读心：识破干扰，退费，18:18', async () => {
  const m = createMatch({ circuits: { A: 1, B: 1 }, evaluator: localEvaluator, plan: PLAN_A3, config: { rounds: 6 } });
  await play(m, (round, obs) => ({ B: obs.A === ATTACK }));
  assert.equal(m.history[2].readResult.B, 'interference');
  assert.equal(m.history[2].readCost.B, 0);
  assert.deepEqual(m.totals, { A: 18, B: 18 });
});

test('对手本来就是清理者，读心扣 1 分', async () => {
  const m = createMatch({ circuits: { A: 4, B: 1 }, evaluator: localEvaluator, plan: [NO], config: { rounds: 1 } });
  await m.startRound();
  const r = await m.resolveRound({ B: true });
  assert.equal(r.readResult.B, 'genuine');
  assert.deepEqual(r.score, { A: 5, B: -1 });
});

test('对手没打击时不能读心', async () => {
  const m = createMatch({ circuits: { A: 1, B: 1 }, evaluator: localEvaluator, plan: [NO], config: { rounds: 1 } });
  await m.startRound();
  await assert.rejects(() => m.resolveRound({ B: true }));
});

test('同一个 seed 生成同一份干扰计划，赛后可重放', async () => {
  assert.deepEqual(createInterferencePlan(42, 10, 0.3), createInterferencePlan(42, 10, 0.3));
  const run = async () => play(createMatch({ circuits: { A: 1, B: 2 }, evaluator: localEvaluator, seed: 7, config: { rounds: 10, interferenceRate: 0.3 } }));
  const [m1, m2] = [await run(), await run()];
  assert.deepEqual(m1.reveal(), m2.reveal());
});

test('startRound 告诉每方自己是否被干扰，以及原本想做的动作', async () => {
  // A 是执剑人，第 1 轮输入默认交流，原本会交流；被干扰后打出打击
  const m = createMatch({ circuits: { A: 1, B: 4 }, evaluator: localEvaluator, plan: [{ A: true, B: true }], config: { rounds: 1 } });
  const { observed, self } = await m.startRound();
  assert.equal(observed.A, ATTACK);
  assert.deepEqual(self.A, { interfered: true, intended: COOPERATE });
  // B 本来就是清理者，干扰没有改变动作
  assert.deepEqual(self.B, { interfered: true, intended: ATTACK });
});
