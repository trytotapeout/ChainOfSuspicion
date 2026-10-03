// 4 个大脑电路的元数据。电路逻辑本身不在这里，而是由 evaluator 计算，
// 这样以后换成 TapeOut eval 时，只需替换 evaluator，元数据和游戏规则都不用动。
// 输入：对手上一轮的动作；输出：本轮动作。1 = 交流（合作），0 = 打击（攻击）。
// tapeoutId：TapeOut 的 TapeID，格式“电路号.链代码.处理器编号”（X Layer 链代码为 2），null 表示还没流片。
// nftId：电路 NFT 在 Circuits 合约（ERC-721）里的 tokenId，也就是 eval 时传的电路号。
// wiring：用 NAND 实现的接法，界面的大脑说明弹窗会展示。
// 链上调用：Circuits 合约 eval(uint256 电路号, bytes 输入)，输入输出按小端位序打包，bit0 = IN0 / OUT0。
//   #1 流片交易 0x18a70855fa03cdb0373e0cf25e8e4b1bd94541bbae0dd7ac5ab5435a51e62423
//   #2 流片交易 0x7c6ec250b7bbb37000c548ca147247fcf0262fa77de448c927e505cbc3bd25c3
// 4 个电路在本项目 processor 上的链上电路号正好是 1～4，和游戏内编号一致。

// X Layer（chainId 196）上本项目 processor 的 Circuits 合约。
export const TAPEOUT = {
  chainId: 196,
  circuits: '0x2503025c0355a005a60cd93c971e4e816456c8bd',
  explorer: 'https://www.oklink.com/zh-hans/x-layer/evm/address/0x2503025c0355A005a60CD93c971E4e816456c8bd',
};

export const CIRCUITS = [
  { id: 1, name: '执剑人', gate: '传递', desc: '你不动我不动，你打我必还手', tapeoutId: '1.2.271', nftId: 1,
    wiring: 'A = NAND(IN0, IN0) = ¬IN0；OUT0 = NAND(A, A) = IN0。两次取反，负负得正。' },
  { id: 2, name: '逆行者', gate: '取反', desc: '你交流我打击，你打击我交流', tapeoutId: '2.2.271', nftId: 2,
    wiring: 'OUT0 = NAND(IN0, IN0) = ¬IN0。一个与非门就是取反。' },
  { id: 3, name: '拯救派', gate: '恒 1', desc: '永远相信善意', tapeoutId: '3.2.271', nftId: 3,
    wiring: 'A = NAND(IN0, IN0) = ¬IN0；OUT0 = NAND(IN0, A) = ¬(x ∧ ¬x) = 1。' },
  { id: 4, name: '清理者', gate: '恒 0', desc: '黑暗森林猎人，见光就打', tapeoutId: '4.2.271', nftId: 4,
    wiring: '在拯救派的恒 1 后面再接一个 NAND(B, B) 取反：OUT0 = ¬1 = 0。' },
];

// 智子干扰永远把被干扰方的电路替换成 #4 清理者。
export const INTERFERENCE_CIRCUIT_ID = 4;

export function getCircuit(id) {
  const circuit = CIRCUITS.find((c) => c.id === id);
  if (!circuit) throw new Error(`未知电路 #${id}`);
  return circuit;
}
