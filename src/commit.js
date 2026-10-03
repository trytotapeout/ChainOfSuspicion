// 开局承诺：开局前把整局的秘密（seed、真实纪元、对手大脑）做成哈希写上链，赛后公开原文。
// 任何人都能用公开的原文重新算哈希、对比链上的承诺，再用 seed 重放干扰计划，
// 确认这局的规则在开局前就定好了，对局中没被改过。
//
// 承诺原文格式（一行文本，字段顺序固定）：
//   chainofsuspicion:v1|seed=<seed>|salt=<32 字节十六进制>|era=<真实纪元>|ai=<对手大脑编号>|rounds=<轮数>|rate=<干扰率>
// salt 用 crypto.getRandomValues 生成：seed 只有 32 位，不加 salt 的话可以暴力猜出来。
//
// 链上交易：玩家钱包发给自己的 0 OKB 交易，data = UTF-8("chainofsuspicion:commit:") + 32 字节哈希。

import { keccak256 } from './keccak.js';
import { createInterferencePlan } from './engine.js';

const PREFIX = 'chainofsuspicion:commit:';
const prefixHex = () => [...new TextEncoder().encode(PREFIX)].map((b) => b.toString(16).padStart(2, '0')).join('');

export function randomSalt(cryptoImpl = globalThis.crypto) {
  const bytes = cryptoImpl.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function commitmentPreimage({ seed, salt, eraId, aiCircuit, rounds, interferenceRate }) {
  return `chainofsuspicion:v1|seed=${seed}|salt=${salt}|era=${eraId}|ai=${aiCircuit}|rounds=${rounds}|rate=${interferenceRate}`;
}

export function computeCommitment(secret) {
  return keccak256(commitmentPreimage(secret));
}

export function commitCalldata(commitment) {
  return '0x' + prefixHex() + commitment.slice(2);
}

// 从链上交易的 data 里取出承诺哈希；格式不对返回 null。
export function parseCommitCalldata(data) {
  const hex = String(data).toLowerCase().replace(/^0x/, '');
  const p = prefixHex();
  if (!hex.startsWith(p) || hex.length !== p.length + 64) return null;
  return '0x' + hex.slice(p.length);
}

// 赛后验证：链上承诺 = 原文哈希，并且用公开的 seed 重放出来的干扰计划和实际对局一致。
export function verifyMatch({ onChainCommitment, secret, playedPlan }) {
  const recomputed = computeCommitment(secret);
  const commitmentOk = Boolean(onChainCommitment) && onChainCommitment.toLowerCase() === recomputed;
  const replayed = createInterferencePlan(secret.seed, secret.rounds, secret.interferenceRate);
  const planOk = replayed.length === playedPlan.length && replayed.every((r, i) => r.A === playedPlan[i].A && r.B === playedPlan[i].B);
  return { recomputed, commitmentOk, planOk, ok: commitmentOk && planOk };
}
