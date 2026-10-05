import test from 'node:test';
import assert from 'node:assert/strict';
import { matchStats, titleFor, achievementsFor, TITLES, ACHIEVEMENTS } from '../src/achievements.js';
import { createMatch, ATTACK } from '../src/engine.js';
import { localEvaluator } from '../src/evaluators/local.js';
import zh from '../web/i18n/zh.js';
import en from '../web/i18n/en.js';

const NO = { A: false, B: false };

async function play(circuits, plan, readPolicy = () => ({})) {
  const m = createMatch({ circuits, evaluator: localEvaluator, plan, config: { rounds: plan.length } });
  while (!m.isOver) {
    const { observed } = await m.startRound();
    await m.resolveRound(readPolicy(observed));
  }
  return m;
}

test('执剑人对执剑人，三次干扰都读心识破：智子克星，并解锁首次识破', async () => {
  const plan = [NO, { A: false, B: true }, NO, { A: false, B: true }, NO, { A: false, B: true }];
  const m = await play({ A: 1, B: 1 }, plan, (o) => ({ A: o.B === ATTACK }));
  const s = matchStats({ history: m.history, totals: m.totals, eraId: 'chaotic', myCircuit: 1 });
  assert.equal(s.caught, 3);
  assert.equal(titleFor(s), 'sophonBreaker');
  const got = achievementsFor(s);
  for (const a of ['firstCatch', 'sophonBreaker', 'unbroken']) assert.ok(got.includes(a), a);
  assert.ok(!got.includes('firstWin'), '平局不算胜利');
});

test('清理者全程打击：黑暗森林猎人', async () => {
  const m = await play({ A: 4, B: 3 }, Array(6).fill(NO));
  const s = matchStats({ history: m.history, totals: m.totals, eraId: 'stable', myCircuit: 4 });
  assert.equal(titleFor(s), 'darkHunter');
  assert.ok(achievementsFor(s).includes('darkForest'));
  assert.ok(achievementsFor(s).includes('bigWin'));
});

test('三日凌空不读心取胜：盲眼通关', async () => {
  const m = await play({ A: 4, B: 1 }, Array(6).fill(NO));
  const s = matchStats({ history: m.history, totals: m.totals, eraId: 'triple', myCircuit: 4 });
  assert.equal(s.outcome, 'win');
  const got = achievementsFor(s);
  assert.ok(got.includes('blindTriple') && got.includes('frugal'));
});

test('我方被干扰，对方读心洗清：解锁“被冤枉的人”', async () => {
  const plan = [NO, NO, { A: true, B: false }, NO];
  const m = await play({ A: 1, B: 1 }, plan, (o) => ({ B: o.A === ATTACK }));
  const s = matchStats({ history: m.history, totals: m.totals, eraId: 'stable', myCircuit: 1 });
  assert.ok(achievementsFor(s).includes('framed'));
});

test('任何一局都有称号（兜底）', () => {
  const s = matchStats({ history: [], totals: { A: 0, B: 0 }, eraId: 'stable', myCircuit: 2 });
  assert.equal(titleFor(s), 'wanderer');
});

test('每个称号、成就都有中英文名字和说明', () => {
  for (const [id] of TITLES) for (const d of [zh, en]) assert.ok(d[`title.${id}`], `title.${id}`);
  for (const [id] of ACHIEVEMENTS) {
    for (const d of [zh, en]) {
      assert.ok(d[`ach.${id}`], `ach.${id}`);
      assert.ok(d[`ach.${id}.desc`], `ach.${id}.desc`);
    }
  }
});
