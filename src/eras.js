// 纪元：开局选择，决定一局的轮数、智子干扰率和能否读心。
// 三体世界的纪元无法预测，所以另有“未知纪元”：从恒纪元、乱纪元里随机抽一个，赛后才公开。

export const ERAS = [
  {
    id: 'stable',
    name: '恒纪元',
    rounds: 10,
    interferenceRate: 0.05,
    allowRead: true,
    desc: '三颗太阳安分守己，智子很少出手。对方打击你，多半是真心的，读心可能白花钱。',
  },
  {
    id: 'chaotic',
    name: '乱纪元',
    rounds: 10,
    interferenceRate: 0.4,
    allowRead: true,
    desc: '天象混乱，智子频繁操控大脑。打击多半是误会，值得读心，否则猜疑链一触即发。',
  },
  {
    id: 'triple',
    name: '三日凌空',
    rounds: 6,
    interferenceRate: 0.3,
    allowRead: false,
    desc: '三颗太阳同时升起，读心失效。误会无法澄清，只能靠大脑本身扛住猜疑链。',
  },
  {
    id: 'unknown',
    name: '未知纪元',
    hidden: ['stable', 'chaotic'],
    desc: '系统从恒纪元和乱纪元里随机抽一个，对局中不告诉你，赛后才公开。你要从打击的频率里自己判断。',
  },
];

export function getEra(id) {
  const era = ERAS.find((e) => e.id === id);
  if (!era) throw new Error(`未知纪元 ${id}`);
  return era;
}

// 把玩家的选择解析成实际纪元；“未知纪元”在这里随机抽签。
export function resolveEra(id, rng = Math.random) {
  const era = getEra(id);
  if (!era.hidden) return { era, hidden: false };
  const pick = era.hidden[Math.floor(rng() * era.hidden.length)];
  return { era: getEra(pick), hidden: true };
}

export function eraConfig(era) {
  return { rounds: era.rounds, interferenceRate: era.interferenceRate, allowRead: era.allowRead };
}
