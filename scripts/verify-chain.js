// 联网核对：用链上 eval 跑 4 个大脑的完整真值表，和本地模拟对比。
// 用法：npm run verify-chain
import { CIRCUITS } from '../src/circuits.js';
import { localEvaluator } from '../src/evaluators/local.js';
import { tapeoutEvaluator } from '../src/evaluators/tapeout.js';

let ok = true;
for (const c of CIRCUITS) {
  const row = [];
  for (const input of [0, 1]) {
    const [chain, local] = await Promise.all([tapeoutEvaluator.evaluate(c.id, input), localEvaluator.evaluate(c.id, input)]);
    if (chain !== local) ok = false;
    row.push(`IN0=${input} → 链上 ${chain} / 本地 ${local}${chain === local ? '' : '  ✗ 不一致'}`);
  }
  console.log(`#${c.id} ${c.name}（TapeID ${c.tapeoutId}）\n  ${row.join('\n  ')}`);
}
console.log(ok ? '\n✓ 4 个链上电路与本地模拟完全一致' : '\n✗ 存在不一致');
process.exit(ok ? 0 : 1);
