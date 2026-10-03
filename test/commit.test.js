import test from 'node:test';
import assert from 'node:assert/strict';
import { keccak256 } from '../src/keccak.js';
import { computeCommitment, commitCalldata, parseCommitCalldata, verifyMatch, commitmentPreimage, randomSalt } from '../src/commit.js';
import { createInterferencePlan } from '../src/engine.js';
import { webcrypto } from 'node:crypto';

test('keccak256 标准测试向量', () => {
  assert.equal(keccak256(''), '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
  assert.equal(keccak256('abc'), '0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45');
  // 合约 eval 的函数选择器，和链上实测一致
  assert.ok(keccak256('eval(uint256,bytes)').startsWith('0x934d06ea'));
  // 正好跨过一个分块（136 字节）
  assert.equal(keccak256('a'.repeat(136)).length, 66);
});

const secret = { seed: 123456789, salt: 'ab'.repeat(32), eraId: 'chaotic', aiCircuit: 4, rounds: 10, interferenceRate: 0.4 };

test('承诺原文格式固定，哈希可复算', () => {
  assert.equal(commitmentPreimage(secret), `chainofsuspicion:v1|seed=123456789|salt=${'ab'.repeat(32)}|era=chaotic|ai=4|rounds=10|rate=0.4`);
  assert.equal(computeCommitment(secret), keccak256(commitmentPreimage(secret)));
});

test('交易 data 编码后能原样解析回承诺', () => {
  const c = computeCommitment(secret);
  const data = commitCalldata(c);
  assert.ok(Buffer.from(data.slice(2), 'hex').toString('latin1').startsWith('chainofsuspicion:commit:'));
  assert.equal(parseCommitCalldata(data), c);
  assert.equal(parseCommitCalldata(data.toUpperCase().replace('0X', '0x')), c);
  assert.equal(parseCommitCalldata('0x1234'), null);
});

test('赛后验证：承诺和干扰计划都对得上才算通过', () => {
  const c = computeCommitment(secret);
  const plan = createInterferencePlan(secret.seed, secret.rounds, secret.interferenceRate);
  assert.equal(verifyMatch({ onChainCommitment: c, secret, playedPlan: plan }).ok, true);

  // 有人改了对手大脑：哈希对不上
  assert.equal(verifyMatch({ onChainCommitment: c, secret: { ...secret, aiCircuit: 1 }, playedPlan: plan }).commitmentOk, false);

  // 对局中偷偷多插了一次干扰：重放对不上
  const tampered = plan.map((r) => ({ ...r }));
  tampered[0].A = !tampered[0].A;
  const r = verifyMatch({ onChainCommitment: c, secret, playedPlan: tampered });
  assert.equal(r.commitmentOk, true);
  assert.equal(r.planOk, false);
});

test('salt 是 32 字节随机数', () => {
  // Node 18 没有全局 crypto，浏览器里用 globalThis.crypto
  const s = randomSalt(webcrypto);
  assert.match(s, /^[0-9a-f]{64}$/);
  assert.notEqual(s, randomSalt(webcrypto));
});
