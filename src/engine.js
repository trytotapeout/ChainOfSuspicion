// 猜疑链对局引擎（与界面无关，纯规则）。
//
// 每一轮分两步：
//   1. startRound()：系统用 evaluator 算出双方本轮动作。若该方本轮被智子干扰，
//      就用 #4 清理者代替它的电路来算。返回双方“看到的”动作。
//   2. resolveRound({ A: 是否读心, B: 是否读心 })：处理读心请求，然后计分。
//
// 读心规则：用被读方“原本的电路”重新 eval 本轮。
//   - 结果与看到的不同 → 确认是智子干扰：把被读方本轮动作改回真实值，读心费退还。
//   - 结果相同 → 确认是真打击：扣读心费，比分不变。
// 下一轮的输入用“纠正后”的动作，所以读心能切断猜疑链。

import { INTERFERENCE_CIRCUIT_ID } from './circuits.js';
import { createRng } from './rng.js';

export const COOPERATE = 1;
export const ATTACK = 0;

// 计分：都交流 3:3，偷袭 5:0，都打击 1:1。
export const DEFAULT_PAYOFF = {
  bothCooperate: 3,
  temptation: 5,
  sucker: 0,
  bothAttack: 1,
};

export const DEFAULT_CONFIG = {
  rounds: 10,
  interferenceRate: 0.2,
  readCost: 1,
  firstInput: COOPERATE,
  payoff: DEFAULT_PAYOFF,
};

const SIDES = ['A', 'B'];
const other = (side) => (side === 'A' ? 'B' : 'A');

export function scoreRound(a, b, payoff = DEFAULT_PAYOFF) {
  if (a === COOPERATE && b === COOPERATE) return { A: payoff.bothCooperate, B: payoff.bothCooperate };
  if (a === ATTACK && b === ATTACK) return { A: payoff.bothAttack, B: payoff.bothAttack };
  if (a === ATTACK) return { A: payoff.temptation, B: payoff.sucker };
  return { A: payoff.sucker, B: payoff.temptation };
}

// 开局前一次性生成整局干扰计划：plan[i] = { A: 是否干扰, B: 是否干扰 }。
// 以后上链时，承诺的就是这份计划（或 seed）的哈希。
export function createInterferencePlan(seed, rounds, rate) {
  const rng = createRng(seed);
  return Array.from({ length: rounds }, () => ({ A: rng() < rate, B: rng() < rate }));
}

// plan 可选：测试或重放时直接传入干扰计划，否则由 seed 生成。
export function createMatch({ circuits, evaluator, seed, plan: fixedPlan, config = {} }) {
  const cfg = { ...DEFAULT_CONFIG, ...config, payoff: { ...DEFAULT_PAYOFF, ...config.payoff } };
  if (!circuits?.A || !circuits?.B) throw new Error('需要双方的出战电路');
  if (!evaluator) throw new Error('需要 evaluator');

  const plan = fixedPlan ?? createInterferencePlan(seed, cfg.rounds, cfg.interferenceRate);
  if (plan.length < cfg.rounds) throw new Error('干扰计划轮数不足');
  const history = [];
  const totals = { A: 0, B: 0 };
  let pending = null;

  // 本方本轮的输入 = 对手上一轮纠正后的动作。
  const inputFor = (side) => {
    const last = history[history.length - 1];
    return last ? last.finalAction[other(side)] : cfg.firstInput;
  };

  async function startRound() {
    if (pending) throw new Error('上一轮还没有结算');
    if (history.length >= cfg.rounds) throw new Error('对局已经结束');

    const index = history.length;
    const input = {};
    const usedCircuit = {};
    const observed = {};
    for (const side of SIDES) {
      input[side] = inputFor(side);
      usedCircuit[side] = plan[index][side] ? INTERFERENCE_CIRCUIT_ID : circuits[side];
      observed[side] = await evaluator.evaluate(usedCircuit[side], input[side]);
    }
    pending = { round: index + 1, input, usedCircuit, interfered: { ...plan[index] }, observed };

    // self[side]：只能给该方自己看的信息。每方知道自己的电路，本来就能推断出自己是否被干扰，
    // 所以告诉它不泄露对手信息。intended 是它原本电路的输出，用来判断干扰是否真的改变了动作。
    const self = {};
    for (const side of SIDES) {
      const interfered = plan[index][side];
      const intended = interfered ? await evaluator.evaluate(circuits[side], input[side]) : observed[side];
      self[side] = { interfered, intended };
    }
    // observed 是双方都能看到的动作；对手是否被干扰要到赛后公开。
    return { round: pending.round, observed: { ...observed }, self };
  }

  async function resolveRound(reads = {}) {
    if (!pending) throw new Error('请先开始本轮');
    const { round, input, usedCircuit, interfered, observed } = pending;
    const finalAction = { ...observed };
    const readResult = { A: null, B: null };
    const readCost = { A: 0, B: 0 };

    for (const reader of SIDES) {
      if (!reads[reader]) continue;
      const target = other(reader);
      // 智子只会把动作改成打击，所以只有看到打击时读心才有意义。
      if (observed[target] !== ATTACK) throw new Error(`第 ${round} 轮 ${target} 没有打击，不能读心`);
      const truth = await evaluator.evaluate(circuits[target], input[target]);
      if (truth !== observed[target]) {
        readResult[reader] = 'interference';
        finalAction[target] = truth;
      } else {
        readResult[reader] = 'genuine';
        readCost[reader] = cfg.readCost;
      }
    }

    const base = scoreRound(finalAction.A, finalAction.B, cfg.payoff);
    const score = { A: base.A - readCost.A, B: base.B - readCost.B };
    totals.A += score.A;
    totals.B += score.B;

    const record = { round, input, usedCircuit, interfered, observed, readResult, readCost, finalAction, score, totals: { ...totals } };
    history.push(record);
    pending = null;
    return record;
  }

  return {
    config: cfg,
    get round() {
      return history.length + (pending ? 1 : 0);
    },
    get isOver() {
      return history.length >= cfg.rounds;
    },
    get totals() {
      return { ...totals };
    },
    get history() {
      return history.slice();
    },
    startRound,
    resolveRound,
    // 赛后公开：出战电路、干扰计划、seed，任何人都能重放验证。
    reveal() {
      if (history.length < cfg.rounds) throw new Error('对局结束后才能公开');
      return { seed, circuits: { ...circuits }, plan: plan.map((p) => ({ ...p })), history: history.slice() };
    },
  };
}
