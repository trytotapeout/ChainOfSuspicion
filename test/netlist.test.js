import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateNetlist, decodeNetlist } from '../src/netlist.js';
import { CIRCUITS } from '../src/circuits.js';
import { evaluateLocal } from '../src/evaluators/local.js';

test('链上网表的模拟结果和电路真值表一致', () => {
  for (const c of CIRCUITS) {
    for (const x of [0, 1]) assert.equal(simulateNetlist(c.netlist, [x]).output, evaluateLocal(c.id, x), `#${c.id} IN0=${x}`);
  }
});

test('门数和链上 circuitInfo 的 gateCount 一致（4、3、4、5，共 16 个 NAND）', () => {
  assert.deepEqual(CIRCUITS.map((c) => c.netlist.length), [4, 3, 4, 5]);
});

test('解码链上原始网表字节', () => {
  // #3 拯救派铸造交易里的网表
  assert.deepEqual(decodeNetlist('0000000200000200000002000003000000040000040000000500000500'.slice(0, 56)), [[2, 2], [2, 3], [4, 4], [5, 5]]);
  assert.throws(() => decodeNetlist('01000002000002'), /不支持/);
});

test('引用未计算的线时报错', () => {
  assert.throws(() => simulateNetlist([[5, 5]], [1]), /尚未计算/);
});
