// 称号和成就：根据一局的结果（对局记录、猜疑链、纪元、出战大脑）算出来，和界面无关。
//
// 称号：每局一个，按 TITLES 的顺序取第一个满足条件的（越特别的越靠前），最后一个是兜底。
// 成就：一局可以解锁多个；跨局的“已解锁”记录由界面存在浏览器本地（web/achievements-store.js）。
//
// 输入 stats 由 matchStats() 从引擎的 history 里统计出来，测试里也可以直接构造。

import { ATTACK } from './engine.js';
import { chainSummary } from './chain.js';

export function matchStats({ history, totals, eraId, myCircuit, eraHidden = false }) {
  const chain = chainSummary(history);
  const myReads = history.filter((r) => r.readResult.A);
  return {
    rounds: history.length,
    myScore: totals.A,
    oppScore: totals.B,
    outcome: totals.A > totals.B ? 'win' : totals.A < totals.B ? 'lose' : 'draw',
    eraId,
    eraHidden,
    myCircuit,
    reads: myReads.length,
    caught: myReads.filter((r) => r.readResult.A === 'interference').length,
    wasted: myReads.filter((r) => r.readResult.A === 'genuine').length,
    myStrikes: history.filter((r) => r.finalAction.A === ATTACK).length,
    // 我方被智子干扰、最后又被对方读心洗清的次数
    clearedByOpp: history.filter((r) => r.readResult.B === 'interference').length,
    chain,
  };
}

// 称号：[id, 条件]
export const TITLES = [
  ['sophonBreaker', (s) => s.caught >= 3],
  ['darkHunter', (s) => s.rounds > 0 && s.myStrikes === s.rounds],
  ['flawless', (s) => s.rounds > 0 && s.chain.firstCrackRound === null],
  ['chainBreaker', (s) => s.caught >= 1 && s.outcome === 'win'],
  ['lostInSuspicion', (s) => s.chain.longestRun >= 5],
  ['redeemer', (s) => s.myCircuit === 3 && s.outcome !== 'lose'],
  ['survivor', (s) => s.outcome === 'win'],
  ['wanderer', () => true],
];

// 成就：[id, 条件]
export const ACHIEVEMENTS = [
  ['firstWin', (s) => s.outcome === 'win'],
  ['firstCatch', (s) => s.caught >= 1],
  ['sophonBreaker', (s) => s.caught >= 3],
  ['blindTriple', (s) => s.eraId === 'triple' && s.outcome === 'win'],
  ['frugal', (s) => s.reads === 0 && s.outcome === 'win'],
  ['unbroken', (s) => s.rounds > 0 && s.chain.firstCrackRound === null],
  ['darkForest', (s) => s.rounds > 0 && s.myStrikes === s.rounds],
  ['framed', (s) => s.clearedByOpp >= 1],
  ['seer', (s) => s.eraHidden && s.caught >= 1 && s.wasted === 0],
  ['bigWin', (s) => s.myScore - s.oppScore >= 15],
];

export function titleFor(stats) {
  return TITLES.find(([, ok]) => ok(stats))[0];
}

export function achievementsFor(stats) {
  return ACHIEVEMENTS.filter(([, ok]) => ok(stats)).map(([id]) => id);
}
