// 电脑对手：选电路和决定是否读心。只使用它“能看到”的信息。

import { CIRCUITS } from './circuits.js';
import { ATTACK } from './engine.js';

export function pickCircuit(rng = Math.random) {
  return CIRCUITS[Math.floor(rng() * CIRCUITS.length)].id;
}

// 读心策略：被打击就读心；一旦读出过一次真打击，说明对手本性就会打击，以后不再花钱。
export function createReadPolicy() {
  let caughtGenuine = false;
  return {
    shouldRead(opponentObserved) {
      return opponentObserved === ATTACK && !caughtGenuine;
    },
    learn(readResult) {
      if (readResult === 'genuine') caughtGenuine = true;
    },
  };
}
