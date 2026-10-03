// 4 个大脑电路的元数据。电路逻辑本身不在这里，而是由 evaluator 计算，
// 这样以后换成 TapeOut eval 时，只需替换 evaluator，元数据和游戏规则都不用动。
// 输入：对手上一轮的动作；输出：本轮动作。1 = 交流（合作），0 = 打击（攻击）。
// tapeoutId：TapeOut 的 TapeID，格式“电路号.链代码.处理器编号”（X Layer 链代码为 2），null 表示还没流片。
// nftId：电路 NFT 在 Circuits 合约（ERC-721）里的 tokenId，也就是 eval 时传的电路号。
// wiring：链上网表的接法说明，界面的大脑说明弹窗会展示。
// netlist：链上 netlist(id) 解码出的 NAND 门列表，每项 [输入 a 线号, 输入 b 线号]；
//   线 0/1 是常量，线 2 是 IN0，第 k 个门输出在线 3 + k，最后一个门就是 OUT0。格式见 src/netlist.js。
// mintTx：流片铸造这枚电路 NFT 的交易哈希（已核对：成功、由部署钱包发起、铸造的正是该 tokenId）。
// 链上调用：Circuits 合约 eval(uint256 电路号, bytes 输入)，输入输出按小端位序打包，bit0 = IN0 / OUT0。
// 4 个电路在本项目 processor 上的链上电路号正好是 1～4，和游戏内编号一致。

// X Layer（chainId 196）上本项目 processor 的 Circuits 合约。
export const TAPEOUT = {
  chainId: 196,
  circuits: '0x2503025c0355a005a60cd93c971e4e816456c8bd',
  explorer: 'https://www.oklink.com/zh-hans/x-layer/evm/address/0x2503025c0355A005a60CD93c971E4e816456c8bd',
};

export const mintTxUrl = (hash) => `https://www.oklink.com/zh-hans/x-layer/evm/tx/${hash}`;

export const CIRCUITS = [
  { id: 1, name: '执剑人', gate: '传递', desc: '你不动我不动，你打我必还手', tapeoutId: '1.2.271', nftId: 1,
    mintTx: '0x18a70855fa03cdb0373e0cf25e8e4b1bd94541bbae0dd7ac5ab5435a51e62423',
    wiring: '4 个 NAND 串联，每个都把两个输入接在同一根线上（即取反）：取反 4 次，负负得正，OUT0 = IN0。',
    netlist: [[2, 2], [3, 3], [4, 4], [5, 5]] },
  { id: 2, name: '逆行者', gate: '取反', desc: '你交流我打击，你打击我交流', tapeoutId: '2.2.271', nftId: 2,
    mintTx: '0x7c6ec250b7bbb37000c548ca147247fcf0262fa77de448c927e505cbc3bd25c3',
    wiring: '3 个 NAND 串联，每个都是取反：取反 3 次，OUT0 = ¬IN0。',
    netlist: [[2, 2], [3, 3], [4, 4]] },
  { id: 3, name: '拯救派', gate: '恒 1', desc: '永远相信善意', tapeoutId: '3.2.271', nftId: 3,
    mintTx: '0x036e8cf69e81ff5ef3a5399939e8fd62d748cb270c01f05aad7e8902b158c2f2',
    wiring: 'A = NAND(IN0, IN0) = ¬IN0；B = NAND(IN0, A) = ¬(x ∧ ¬x) = 1；再串 2 个取反 NAND：OUT0 = 1。共 4 个 NAND。',
    netlist: [[2, 2], [2, 3], [4, 4], [5, 5]] },
  { id: 4, name: '清理者', gate: '恒 0', desc: '黑暗森林猎人，见光就打', tapeoutId: '4.2.271', nftId: 4,
    mintTx: '0xae48453a32e898279c041c2bc8f591240791979afddcce004ab9d1506608a04b',
    wiring: '前两个 NAND 和拯救派一样得到恒 1，再串 3 个取反 NAND：OUT0 = ¬1 = 0。共 5 个 NAND。',
    netlist: [[2, 2], [2, 3], [4, 4], [5, 5], [6, 6]] },
];

// 智子干扰永远把被干扰方的电路替换成 #4 清理者。
export const INTERFERENCE_CIRCUIT_ID = 4;

export function getCircuit(id) {
  const circuit = CIRCUITS.find((c) => c.id === id);
  if (!circuit) throw new Error(`未知电路 #${id}`);
  return circuit;
}
