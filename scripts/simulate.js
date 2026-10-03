// 批量模拟：4 个电路两两对战，比较“从不读心”和“被打击就读心”的平均得分，用来调平衡。
// 用法：node scripts/simulate.js [干扰率=0.2] [轮数=10] [局数=2000]

import { CIRCUITS } from '../src/circuits.js';
import { createMatch, ATTACK } from '../src/engine.js';
import { localEvaluator } from '../src/evaluators/local.js';

const rate = Number(process.argv[2] ?? 0.2);
const rounds = Number(process.argv[3] ?? 10);
const games = Number(process.argv[4] ?? 2000);

async function avgScore(a, b, read) {
  let sum = 0;
  for (let g = 0; g < games; g++) {
    const m = createMatch({ circuits: { A: a, B: b }, evaluator: localEvaluator, seed: g + 1, config: { rounds, interferenceRate: rate } });
    while (!m.isOver) {
      const { observed } = await m.startRound();
      await m.resolveRound({ A: read && observed.B === ATTACK });
    }
    sum += m.totals.A;
  }
  return sum / games;
}

console.log(`干扰率 ${rate}，每局 ${rounds} 轮，每组 ${games} 局。表中是行方（我方）平均得分。\n`);
for (const read of [false, true]) {
  console.log(read ? '【我方被打击就读心】' : '【我方从不读心】');
  const header = ['我方 \\ 对手', ...CIRCUITS.map((c) => `#${c.id}${c.name}`), '平均'];
  const rows = [];
  for (const a of CIRCUITS) {
    const cells = [];
    for (const b of CIRCUITS) cells.push(await avgScore(a.id, b.id, read));
    const mean = cells.reduce((x, y) => x + y, 0) / cells.length;
    rows.push([`#${a.id}${a.name}`, ...cells.map((v) => v.toFixed(1)), mean.toFixed(1)]);
  }
  console.log([header, ...rows].map((r) => r.join('\t')).join('\n') + '\n');
}
