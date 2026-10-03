// 按 TapeOut 链上网表模拟电路，界面画“大脑里的电路”和信号传播动画时用。
//
// 网表格式（从链上 netlist(id) 和铸造交易解码，已用 4 个电路的链上 eval 结果验证）：
//   每个门 7 字节：1 字节类型（0x00 = NAND）+ 3 字节输入 a + 3 字节输入 b（线号，大端）
//   线号：0 = 常量 0，1 = 常量 1，2… = 输入引脚，之后第 k 个门的输出是线 2 + nIn + k
//   输出引脚取最后 nOut 个门的输出
// 这里只存每个门的两个输入线号。

export const CONST0 = 0;
export const CONST1 = 1;

// 返回所有线的取值：wires[i] 是线 i 的值；gateWires[k] 是第 k 个门输出所在的线号。
export function simulateNetlist(gates, inputs) {
  const wires = [0, 1, ...inputs];
  const gateWires = [];
  for (const [a, b] of gates) {
    if (a >= wires.length || b >= wires.length) throw new Error(`网表引用了尚未计算的线：${a}, ${b}`);
    gateWires.push(wires.length);
    wires.push(1 - (wires[a] & wires[b]));
  }
  return { wires, gateWires, output: wires[wires.length - 1] };
}

// 解析链上 netlist(id) 返回的原始字节（十六进制，不带 0x）
export function decodeNetlist(hex) {
  const gates = [];
  for (let i = 0; i < hex.length; i += 14) {
    const type = hex.slice(i, i + 2);
    if (type !== '00') throw new Error(`不支持的门类型 0x${type}`);
    gates.push([parseInt(hex.slice(i + 2, i + 8), 16), parseInt(hex.slice(i + 8, i + 14), 16)]);
  }
  return gates;
}
