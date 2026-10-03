// 读心付费：连接钱包，在 X Layer 上发一笔交易，把 0.0001 OKB 烧进黑洞地址。
//
// 每次读心都是一笔真实的链上交易，交易 data 里写着“哪一局、第几轮”，在浏览器里就能查到。
// 交易确认成功后才执行读心（链上 eval）。同一局同一轮只付一次：确认超时后重试，
// 会继续等原来那笔交易，不会重复付款。

export const READ_FEE_WEI = 100000000000000n; // 0.0001 OKB
export const READ_FEE_LABEL = '0.0001 OKB';
export const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
export const XLAYER = {
  chainId: '0xc4', // 196
  chainName: 'X Layer Mainnet',
  nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
  rpcUrls: ['https://rpc.xlayer.tech'],
  blockExplorerUrls: ['https://www.oklink.com/x-layer'],
};
export const txUrl = (hash) => `https://www.oklink.com/zh-hans/x-layer/evm/tx/${hash}`;

const RECEIPT_TIMEOUT_MS = 90000;
const RECEIPT_POLL_MS = 1500;

// 优先用 OKX 钱包（X Layer 是 OKX 的链），否则用标准 EIP-1193 钱包。
export function detectProvider(win = globalThis) {
  return win.okxwallet ?? win.ethereum ?? null;
}

// 交易 data：UTF-8 文本“chainofsuspicion:read:<seed>:<round>”转成十六进制。
export function readMemo(seed, round) {
  const bytes = new TextEncoder().encode(`chainofsuspicion:read:${seed}:${round}`);
  return '0x' + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 赛后验证用公共 RPC 读交易，不需要钱包，任何人都能验证。
export async function readTransaction(hash, { fetchImpl, rpcs = XLAYER.rpcUrls.concat('https://xlayerrpc.okx.com') } = {}) {
  const doFetch = fetchImpl ?? ((...args) => globalThis.fetch(...args));
  let lastError;
  for (const rpc of rpcs) {
    try {
      const call = async (method) => {
        const res = await doFetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: [hash] }) });
        const json = await res.json();
        if (json.error) throw new Error(json.error.message ?? JSON.stringify(json.error));
        return json.result;
      };
      const [tx, receipt] = [await call('eth_getTransactionByHash'), await call('eth_getTransactionReceipt')];
      if (!tx) throw new Error('链上查不到这笔交易');
      return { from: tx.from, to: tx.to, data: tx.input, blockNumber: receipt ? parseInt(receipt.blockNumber, 16) : null, success: receipt?.status === '0x1' };
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`读取链上交易失败：${lastError?.message ?? lastError}`);
}

export function friendlyWalletError(err) {
  if (err?.code === 4001) return '你在钱包里取消了这笔交易';
  if (err?.code === -32002) return '钱包里已经有一个待处理的请求，请先在钱包里处理';
  return err?.message ?? String(err);
}

// provider 可以直接传入，也可以传 getProvider：钱包插件有时在页面加载后才注入，所以每次请求时再取。
export function createWallet({ provider, getProvider = () => provider, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = () => Date.now() } = {}) {
  let account = null;
  // 每局每轮付过的交易：key = `${seed}:${round}`，防止重试时重复付款。
  const paid = new Map();

  const request = (method, params) => {
    const p = getProvider();
    if (!p) throw new Error('没有检测到钱包插件，请安装 OKX Wallet 或其他 EVM 钱包');
    return p.request({ method, params });
  };

  async function connect() {
    const accounts = await request('eth_requestAccounts');
    if (!accounts?.length) throw new Error('钱包没有返回账户');
    account = accounts[0];
    return account;
  }

  async function ensureXLayer() {
    const current = await request('eth_chainId');
    if (String(current).toLowerCase() === XLAYER.chainId) return;
    try {
      await request('wallet_switchEthereumChain', [{ chainId: XLAYER.chainId }]);
    } catch (err) {
      // 4902：钱包里还没有这条链，先添加
      if (err?.code !== 4902) throw err;
      await request('wallet_addEthereumChain', [XLAYER]);
    }
  }

  async function waitForReceipt(hash) {
    const deadline = now() + RECEIPT_TIMEOUT_MS;
    while (now() < deadline) {
      const receipt = await request('eth_getTransactionReceipt', [hash]);
      if (receipt) {
        if (receipt.status !== '0x1') throw new Error(`读心交易执行失败：${hash}`);
        return receipt;
      }
      await sleep(RECEIPT_POLL_MS);
    }
    throw new Error(`读心交易还没确认，请稍后重试（不会重复付款）：${hash}`);
  }

  // 开局承诺：玩家钱包发给自己一笔 0 OKB 的交易，data 里是承诺哈希。只花 Gas。
  // 同一个承诺只发一次：确认超时后重试会继续等原来那笔交易。
  async function commitMatch({ data, onStatus = () => {} }) {
    let hash = paid.get(data);
    if (!hash) {
      if (!account) {
        onStatus('连接钱包');
        await connect();
      }
      onStatus('切换到 X Layer');
      await ensureXLayer();
      onStatus('请在钱包中确认开局承诺交易（0 OKB，只花 Gas）');
      hash = await request('eth_sendTransaction', [{ from: account, to: account, value: '0x0', data }]);
      paid.set(data, hash);
    }
    onStatus('等待开局承诺在 X Layer 上确认', hash);
    await waitForReceipt(hash);
    return hash;
  }

  // 为某局某轮的读心付费，返回交易哈希。onStatus 用来更新界面提示。
  async function payForRead({ seed, round, onStatus = () => {} }) {
    const key = `${seed}:${round}`;
    let hash = paid.get(key);
    if (!hash) {
      if (!account) {
        onStatus('连接钱包');
        await connect();
      }
      onStatus('切换到 X Layer');
      await ensureXLayer();
      onStatus(`请在钱包中确认读心交易（${READ_FEE_LABEL}）`);
      hash = await request('eth_sendTransaction', [
        { from: account, to: BURN_ADDRESS, value: '0x' + READ_FEE_WEI.toString(16), data: readMemo(seed, round) },
      ]);
      paid.set(key, hash);
    }
    onStatus('等待读心交易在 X Layer 上确认', hash);
    await waitForReceipt(hash);
    return hash;
  }

  return {
    get account() {
      return account;
    },
    get available() {
      return Boolean(getProvider());
    },
    connect,
    ensureXLayer,
    payForRead,
    commitMatch,
  };
}
