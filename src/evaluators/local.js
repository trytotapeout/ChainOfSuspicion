// 本地模拟 evaluator：用代码模拟 4 个 1 位电路。
//
// Evaluator 接口（换成 TapeOut 时保持一致即可）：
//   name: string
//   evaluate(circuitId: number, input: 0 | 1): Promise<0 | 1>
//
// 以后流片铸造后，新建 evaluators/tapeout.js，在 evaluate 里调用 TapeOut 官方 eval，
// 把 circuitId 映射到对应的 NFT，再在 web/app.js 里把 localEvaluator 换掉即可。

const GATES = {
  1: (x) => x, // 传递
  2: (x) => x ^ 1, // 取反
  3: () => 1, // 恒 1
  4: () => 0, // 恒 0
};

export const localEvaluator = {
  name: '本地代码模拟',
  async evaluate(circuitId, input) {
    if (input !== 0 && input !== 1) throw new Error(`输入必须是 0 或 1，收到 ${input}`);
    const gate = GATES[circuitId];
    if (!gate) throw new Error(`未知电路 #${circuitId}`);
    return gate(input);
  },
};
