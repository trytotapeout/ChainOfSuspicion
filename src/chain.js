// 猜疑链：把每一轮的结算结果归成一个链环的状态，界面据此画出“信任之链”。
//
//   intact  完好：双方都交流
//   mended  修复：本轮有人读心识破了智子干扰，裂痕被补上（最终动作已改回真实值）
//   cracked 裂痕：一方打击
//   broken  断裂：双方互相打击
//
// 只依据引擎给出的 finalAction 和 readResult，和界面无关，方便测试。

import { ATTACK } from './engine.js';

export function linkState(record) {
  const caught = record.readResult.A === 'interference' || record.readResult.B === 'interference';
  const strikes = (record.finalAction.A === ATTACK ? 1 : 0) + (record.finalAction.B === ATTACK ? 1 : 0);
  if (strikes === 2) return 'broken';
  if (strikes === 1) return 'cracked';
  return caught ? 'mended' : 'intact';
}

// 整条链的统计：猜疑链从哪一轮开始（第一次出现打击），连续断裂的最长段，被修复了几次。
export function chainSummary(records) {
  const states = records.map(linkState);
  const firstCrack = states.findIndex((s) => s === 'cracked' || s === 'broken');
  let longest = 0;
  let run = 0;
  for (const s of states) {
    run = s === 'cracked' || s === 'broken' ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  return {
    states,
    firstCrackRound: firstCrack === -1 ? null : records[firstCrack].round,
    longestRun: longest,
    mended: states.filter((s) => s === 'mended').length,
    intact: states.filter((s) => s === 'intact' || s === 'mended').length,
  };
}
