import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeEvalCall, decodeEvalResult, createTapeoutEvaluator } from '../src/evaluators/tapeout.js';

const word = (n) => n.toString(16).padStart(64, '0');
// 链上 eval 返回 bytes 的 ABI 编码：偏移 0x20 | 长度 | 数据
const encodedBytes = (byte) => '0x' + word(32) + word(1) + byte.toString(16).padStart(2, '0').padEnd(64, '0');

test('eval calldata 编码（与链上实测一致）', () => {
  assert.equal(
    encodeEvalCall(3, 1),
    '0x934d06ea' + word(3) + word(64) + word(1) + '01'.padEnd(64, '0'),
  );
});

test('解析返回值，并拒绝非 0/1 输出', () => {
  assert.equal(decodeEvalResult(encodedBytes(0)), 0);
  assert.equal(decodeEvalResult(encodedBytes(1)), 1);
  assert.throws(() => decodeEvalResult(encodedBytes(2)), /不是 0\/1/);
  assert.throws(() => decodeEvalResult('0x' + word(32) + word(0)), /空输出/);
});

test('第一个 RPC 失败时切换到备用 RPC', async () => {
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    if (url === 'rpc-a') throw new Error('down');
    return { json: async () => ({ result: encodedBytes(1) }) };
  };
  const ev = createTapeoutEvaluator({ fetchImpl, rpcs: ['rpc-a', 'rpc-b'] });
  assert.equal(await ev.evaluate(1, 1), 1);
  assert.deepEqual(seen, ['rpc-a', 'rpc-b']);
  assert.equal(ev.calls, 1);
});

test('所有 RPC 都失败时报错，不静默返回', async () => {
  const ev = createTapeoutEvaluator({ fetchImpl: async () => ({ json: async () => ({ error: { message: 'boom' } }) }), rpcs: ['x'] });
  await assert.rejects(() => ev.evaluate(1, 0), /链上 eval 调用失败/);
});
