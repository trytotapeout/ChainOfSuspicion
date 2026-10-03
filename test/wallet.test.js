import test from 'node:test';
import assert from 'node:assert/strict';
import { createWallet, readMemo, BURN_ADDRESS, friendlyWalletError, readTransaction } from '../src/wallet.js';

// 模拟 EIP-1193 钱包，记录收到的请求。
function mockProvider({ chainId = '0xc4', missingChain = false, receipts = [{ status: '0x1' }] } = {}) {
  const calls = [];
  let sent = 0;
  let receiptIndex = 0;
  return {
    calls,
    async request({ method, params }) {
      calls.push(method);
      switch (method) {
        case 'eth_requestAccounts':
          return ['0xabc'];
        case 'eth_chainId':
          return chainId;
        case 'wallet_switchEthereumChain':
          if (missingChain) throw Object.assign(new Error('unknown chain'), { code: 4902 });
          return null;
        case 'wallet_addEthereumChain':
          return null;
        case 'eth_sendTransaction':
          sent += 1;
          this.lastTx = params[0];
          return `0xhash${sent}`;
        case 'eth_getTransactionReceipt':
          return receipts[Math.min(receiptIndex++, receipts.length - 1)];
        default:
          throw new Error(`unexpected ${method}`);
      }
    },
  };
}

const fast = { sleep: async () => {} };

test('读心交易：烧 0.0001 OKB 到黑洞地址，data 记录局和轮', async () => {
  const provider = mockProvider();
  const wallet = createWallet({ provider, ...fast });
  const hash = await wallet.payForRead({ seed: 42, round: 3 });
  assert.equal(hash, '0xhash1');
  assert.deepEqual(provider.lastTx, { from: '0xabc', to: BURN_ADDRESS, value: '0x5af3107a4000', data: readMemo(42, 3) });
  assert.equal(Buffer.from(readMemo(42, 3).slice(2), 'hex').toString(), 'chainofsuspicion:read:42:3');
});

test('不在 X Layer 时切换网络；钱包没有这条链时先添加', async () => {
  const p1 = mockProvider({ chainId: '0x38' });
  await createWallet({ provider: p1, ...fast }).payForRead({ seed: 1, round: 1 });
  assert.ok(p1.calls.includes('wallet_switchEthereumChain'));
  assert.ok(!p1.calls.includes('wallet_addEthereumChain'));

  const p2 = mockProvider({ chainId: '0x38', missingChain: true });
  await createWallet({ provider: p2, ...fast }).payForRead({ seed: 1, round: 1 });
  assert.ok(p2.calls.includes('wallet_addEthereumChain'));
});

test('确认超时后重试同一轮，不会重复付款', async () => {
  let t = 0;
  const provider = mockProvider({ receipts: [null] });
  const wallet = createWallet({ provider, sleep: async () => {}, now: () => (t += 50000) });
  await assert.rejects(() => wallet.payForRead({ seed: 7, round: 2 }), /不会重复付款/);
  provider.request = ((orig) => async (args) => (args.method === 'eth_getTransactionReceipt' ? { status: '0x1' } : orig.call(provider, args)))(provider.request);
  assert.equal(await wallet.payForRead({ seed: 7, round: 2 }), '0xhash1');
  assert.equal(provider.calls.filter((m) => m === 'eth_sendTransaction').length, 1);
});

test('交易链上执行失败时报错，不执行读心', async () => {
  const wallet = createWallet({ provider: mockProvider({ receipts: [{ status: '0x0' }] }), ...fast });
  await assert.rejects(() => wallet.payForRead({ seed: 1, round: 1 }), /执行失败/);
});

test('没有钱包、用户取消时给出可读的提示', async () => {
  await assert.rejects(() => createWallet({ provider: null }).payForRead({ seed: 1, round: 1 }), /没有检测到钱包/);
  assert.equal(friendlyWalletError({ code: 4001 }), '你在钱包里取消了这笔交易');
});

test('开局承诺：发给自己的 0 OKB 交易，data 为承诺；重试不重复发送', async () => {
  const provider = mockProvider();
  const wallet = createWallet({ provider, ...fast });
  const hash = await wallet.commitMatch({ data: '0xc0ffee' });
  assert.equal(hash, '0xhash1');
  assert.deepEqual(provider.lastTx, { from: '0xabc', to: '0xabc', value: '0x0', data: '0xc0ffee' });
  await wallet.commitMatch({ data: '0xc0ffee' });
  assert.equal(provider.calls.filter((m) => m === 'eth_sendTransaction').length, 1);
});

test('readTransaction 用公共 RPC 读回交易 data 和确认状态', async () => {
  const fetchImpl = async (url, { body }) => {
    const { method } = JSON.parse(body);
    const result = method === 'eth_getTransactionByHash' ? { from: '0xabc', to: '0xabc', input: '0xc0ffee' } : { status: '0x1', blockNumber: '0x10' };
    return { json: async () => ({ result }) };
  };
  assert.deepEqual(await readTransaction('0xh', { fetchImpl, rpcs: ['x'] }), { from: '0xabc', to: '0xabc', data: '0xc0ffee', blockNumber: 16, success: true });
});
