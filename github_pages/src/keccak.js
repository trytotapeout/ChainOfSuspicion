// keccak256（以太坊用的原始 Keccak，填充 0x01…0x80，不是 NIST SHA3-256）。
// 只用于开局承诺这类短输入，用 BigInt 实现，代码短、好核对，不追求速度。

const MASK = (1n << 64n) - 1n;
const RATE = 136; // 字节：1600 - 2 × 256 位
const rotl = (x, n) => (n === 0n ? x : ((x << n) | (x >> (64n - n))) & MASK);

// 轮常数：由 LFSR 生成，避免手抄 24 个常数出错
const RC = [];
{
  let r = 1n;
  for (let i = 0; i < 24; i++) {
    let t = 0n;
    for (let j = 0; j < 7; j++) {
      r = ((r << 1n) ^ ((r >> 7n) * 0x71n)) % 256n;
      if (r & 2n) t ^= 1n << ((1n << BigInt(j)) - 1n);
    }
    RC.push(t);
  }
}

// ρ 步的旋转位数，下标 x + 5y
const ROT = Array(25).fill(0n);
{
  let x = 1;
  let y = 0;
  for (let t = 0; t < 24; t++) {
    ROT[x + 5 * y] = BigInt((((t + 1) * (t + 2)) / 2) % 64);
    [x, y] = [y, (2 * x + 3 * y) % 5];
  }
}

function keccakF(A) {
  const B = Array(25);
  for (let round = 0; round < 24; round++) {
    // θ
    const C = [0, 1, 2, 3, 4].map((x) => A[x] ^ A[x + 5] ^ A[x + 10] ^ A[x + 15] ^ A[x + 20]);
    for (let x = 0; x < 5; x++) {
      const D = C[(x + 4) % 5] ^ rotl(C[(x + 1) % 5], 1n);
      for (let y = 0; y < 25; y += 5) A[x + y] ^= D;
    }
    // ρ + π
    for (let x = 0; x < 5; x++) {
      for (let y = 0; y < 5; y++) B[y + 5 * ((2 * x + 3 * y) % 5)] = rotl(A[x + 5 * y], ROT[x + 5 * y]);
    }
    // χ
    for (let y = 0; y < 25; y += 5) {
      for (let x = 0; x < 5; x++) A[x + y] = B[x + y] ^ (~B[((x + 1) % 5) + y] & MASK & B[((x + 2) % 5) + y]);
    }
    // ι
    A[0] ^= RC[round];
  }
}

// 输入 Uint8Array 或字符串（按 UTF-8），返回 0x 开头的十六进制哈希
export function keccak256(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const padded = new Uint8Array(Math.floor(bytes.length / RATE + 1) * RATE);
  padded.set(bytes);
  padded[bytes.length] ^= 0x01;
  padded[padded.length - 1] ^= 0x80;

  const A = Array(25).fill(0n);
  for (let off = 0; off < padded.length; off += RATE) {
    for (let i = 0; i < RATE / 8; i++) {
      let lane = 0n;
      for (let b = 7; b >= 0; b--) lane = (lane << 8n) | BigInt(padded[off + i * 8 + b]);
      A[i] ^= lane;
    }
    keccakF(A);
  }

  let hex = '';
  for (let i = 0; i < 4; i++) {
    for (let b = 0; b < 8; b++) hex += Number((A[i] >> BigInt(8 * b)) & 0xffn).toString(16).padStart(2, '0');
  }
  return '0x' + hex;
}
