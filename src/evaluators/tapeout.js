// 链上 evaluator：调用 X Layer 上 TapeOut 流片的真实电路。
//
// 合约：本项目 processor 的 Circuits 合约（地址见 circuits.js 的 TAPEOUT）。
// 方法：eval(uint256 id, bytes inputs) view returns (bytes)
//   - view 调用，不发交易、不需要钱包、不消耗 Gas。
//   - 输入输出按小端位序打包成 bytes：第 1 个字节的 bit0 = IN0 / OUT0。
// 游戏编号 1～4 就是链上电路号 1～4（TapeID 1.2.271 ～ 4.2.271）。

import { TAPEOUT } from '../circuits.js';

const EVAL_SELECTOR = '934d06ea'; // keccak256("eval(uint256,bytes)") 前 4 字节
const RPCS = ['https://rpc.xlayer.tech', 'https://xlayerrpc.okx.com'];
const TIMEOUT_MS = 8000;

const word = (n) => BigInt(n).toString(16).padStart(64, '0');

// eval(id, bytes[1]) 的 calldata：selector | id | bytes 偏移 0x40 | 长度 1 | 数据（右侧补 0）
export function encodeEvalCall(circuitNo, input) {
  const data = input.toString(16).padStart(2, '0').padEnd(64, '0');
  return '0x' + EVAL_SELECTOR + word(circuitNo) + word(64) + word(1) + data;
}

// 解析返回的 bytes，取第 1 个字节的 bit0。返回值必须是 0x00 或 0x01，否则视为电路不合规。
export function decodeEvalResult(hex) {
  const body = hex.startsWith('0x') ? hex.slice(2) : hex;
  const offset = parseInt(body.slice(0, 64), 16) * 2;
  const length = parseInt(body.slice(offset, offset + 64), 16);
  if (!(length >= 1)) throw new Error(`eval 返回了空输出：${hex}`);
  const firstByte = parseInt(body.slice(offset + 64, offset + 66), 16);
  if (firstByte !== 0 && firstByte !== 1) throw new Error(`eval 输出不是 0/1：0x${firstByte.toString(16)}`);
  return firstByte;
}

export function createTapeoutEvaluator({ fetchImpl, rpcs = RPCS, contract = TAPEOUT.circuits } = {}) {
  // 每次调用时再取全局 fetch，不在创建时固定下来，这样网络环境变化后重试仍然有效。
  const doFetch = fetchImpl ?? ((...args) => globalThis.fetch(...args));
  const evaluator = {
    name: 'X Layer 链上 TapeOut 电路',
    // 本局累计的链上调用次数，界面用来展示“每一步都是链上算的”。
    calls: 0,
    async evaluate(circuitNo, input) {
      if (input !== 0 && input !== 1) throw new Error(`输入必须是 0 或 1，收到 ${input}`);
      const body = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: contract, data: encodeEvalCall(circuitNo, input) }, 'latest'],
      });
      let lastError;
      for (const rpc of rpcs) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
          const res = await doFetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body, signal: controller.signal });
          const json = await res.json();
          if (json.error) throw new Error(json.error.message ?? JSON.stringify(json.error));
          const output = decodeEvalResult(json.result);
          evaluator.calls += 1;
          return output;
        } catch (err) {
          lastError = err;
        } finally {
          clearTimeout(timer);
        }
      }
      throw new Error(`链上 eval 调用失败（电路 #${circuitNo}）：${lastError?.message ?? lastError}`);
    },
  };
  return evaluator;
}

export const tapeoutEvaluator = createTapeoutEvaluator();
