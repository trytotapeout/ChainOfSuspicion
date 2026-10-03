// 三体运动的实时数值模拟，用于背景动画（G = 1，三颗太阳质量都是 1）。
// 用蛙跳法（kick-drift-kick）积分：辛积分器，长时间运行能量也基本守恒。
// 三体星球是一个无质量的测试粒子，只受三颗太阳的引力，不影响太阳。
//
// 模式：
//   stable  恒纪元：Chenciner–Montgomery 8 字形周期解，三颗太阳沿同一条 8 字轨道永远互相追逐
//   chaotic 乱纪元：随机初始条件，混沌运动；太阳被甩飞就重新开始
//   triple  三日凌空：欧拉共线解，三颗太阳排成一线一起旋转（不稳定，偏离后重置）

export const DT = 0.002;
const SOFTENING = { stable: 0, chaotic: 0.1, triple: 0 };
const PLANET_ORBIT = 2.4;
const PLANET_SOFTENING = 0.05;
const ESCAPE_RADIUS = 6; // 太阳离质心超过这个距离视为被甩飞
const PLANET_LOST_RADIUS = 8; // 星球被甩出星系
const PLANET_BURN_RADIUS = 0.12; // 星球坠入太阳
const TRIPLE_DRIFT = 0.05; // 共线解中间那颗太阳偏离质心超过这个距离就重置

function toCenterOfMassFrame(bodies) {
  const n = bodies.length;
  const c = bodies.reduce((a, b) => ({ x: a.x + b.x / n, y: a.y + b.y / n, vx: a.vx + b.vx / n, vy: a.vy + b.vy / n }), { x: 0, y: 0, vx: 0, vy: 0 });
  for (const b of bodies) {
    b.x -= c.x;
    b.y -= c.y;
    b.vx -= c.vx;
    b.vy -= c.vy;
  }
  return bodies;
}

export function energy(suns, eps = 0) {
  let e = 0;
  for (const s of suns) e += 0.5 * (s.vx * s.vx + s.vy * s.vy);
  for (let i = 0; i < suns.length; i++) {
    for (let j = i + 1; j < suns.length; j++) {
      const dx = suns[i].x - suns[j].x;
      const dy = suns[i].y - suns[j].y;
      e -= 1 / Math.sqrt(dx * dx + dy * dy + eps * eps);
    }
  }
  return e;
}

function minSeparation(suns) {
  let m = Infinity;
  for (let i = 0; i < suns.length; i++) {
    for (let j = i + 1; j < suns.length; j++) m = Math.min(m, Math.hypot(suns[i].x - suns[j].x, suns[i].y - suns[j].y));
  }
  return m;
}

export function initialSuns(mode, rng = Math.random) {
  if (mode === 'stable') {
    const v3 = [-0.93240737, -0.86473146];
    return [
      { x: 0.97000436, y: -0.24308753, vx: -v3[0] / 2, vy: -v3[1] / 2 },
      { x: -0.97000436, y: 0.24308753, vx: -v3[0] / 2, vy: -v3[1] / 2 },
      { x: 0, y: 0, vx: v3[0], vy: v3[1] },
    ];
  }
  if (mode === 'triple') {
    // 外侧太阳受到的引力 1/1² + 1/2² = 5/4，正好提供半径 1 的圆周运动所需的向心力。
    const v = Math.sqrt(5 / 4);
    return [
      { x: -1, y: 0, vx: 0, vy: -v },
      { x: 0, y: 0, vx: 0, vy: 0 },
      { x: 1, y: 0, vx: 0, vy: v },
    ];
  }
  // 随机初始条件：动量归零，太阳之间不要太近，总能量为负（束缚态，不会马上飞散）。
  for (let tries = 0; tries < 200; tries++) {
    const suns = Array.from({ length: 3 }, () => ({ x: rng() * 2 - 1, y: rng() * 2 - 1, vx: (rng() * 2 - 1) * 0.5, vy: (rng() * 2 - 1) * 0.5 }));
    toCenterOfMassFrame(suns);
    if (minSeparation(suns) > 0.5 && energy(suns, SOFTENING.chaotic) < -0.3) return suns;
  }
  return initialSuns('stable');
}

function spawnPlanet(rng) {
  const a = rng() * Math.PI * 2;
  const v = Math.sqrt(3 / PLANET_ORBIT); // 绕总质量 3 的圆轨道速度
  return { x: PLANET_ORBIT * Math.cos(a), y: PLANET_ORBIT * Math.sin(a), vx: -v * Math.sin(a), vy: v * Math.cos(a) };
}

function sunAccelerations(suns, eps) {
  const acc = suns.map(() => ({ ax: 0, ay: 0 }));
  for (let i = 0; i < suns.length; i++) {
    for (let j = i + 1; j < suns.length; j++) {
      const dx = suns[j].x - suns[i].x;
      const dy = suns[j].y - suns[i].y;
      const r2 = dx * dx + dy * dy + eps * eps;
      const inv = 1 / (r2 * Math.sqrt(r2));
      acc[i].ax += dx * inv;
      acc[i].ay += dy * inv;
      acc[j].ax -= dx * inv;
      acc[j].ay -= dy * inv;
    }
  }
  return acc;
}

function planetAcceleration(planet, suns) {
  let ax = 0;
  let ay = 0;
  for (const s of suns) {
    const dx = s.x - planet.x;
    const dy = s.y - planet.y;
    const r2 = dx * dx + dy * dy + PLANET_SOFTENING * PLANET_SOFTENING;
    const inv = 1 / (r2 * Math.sqrt(r2));
    ax += dx * inv;
    ay += dy * inv;
  }
  return { ax, ay };
}

export function createSimulation(mode = 'stable', rng = Math.random) {
  const sim = { mode, suns: [], planet: null, time: 0, destroyed: 0 };
  let carry = 0;

  function reset(nextMode = sim.mode) {
    sim.mode = nextMode;
    sim.suns = initialSuns(nextMode, rng);
    sim.planet = spawnPlanet(rng);
    sim.time = 0;
    carry = 0;
  }

  function step() {
    const eps = SOFTENING[sim.mode];
    const all = [...sim.suns, sim.planet];
    let acc = [...sunAccelerations(sim.suns, eps), planetAcceleration(sim.planet, sim.suns)];
    all.forEach((b, i) => {
      b.vx += acc[i].ax * DT / 2;
      b.vy += acc[i].ay * DT / 2;
      b.x += b.vx * DT;
      b.y += b.vy * DT;
    });
    acc = [...sunAccelerations(sim.suns, eps), planetAcceleration(sim.planet, sim.suns)];
    all.forEach((b, i) => {
      b.vx += acc[i].ax * DT / 2;
      b.vy += acc[i].ay * DT / 2;
    });
    sim.time += DT;
  }

  // 检查是否需要重置，返回发生的事件。星球坠入太阳或被甩出，都算一次文明毁灭。
  function check() {
    const events = [];
    if (sim.suns.some((s) => Math.hypot(s.x, s.y) > ESCAPE_RADIUS)) {
      reset();
      sim.destroyed += 1;
      events.push('suns-escaped');
      return events;
    }
    if (sim.mode === 'triple' && Math.hypot(sim.suns[1].x, sim.suns[1].y) > TRIPLE_DRIFT) {
      sim.suns = initialSuns('triple', rng);
      events.push('triple-reset');
    }
    const p = sim.planet;
    if (Math.hypot(p.x, p.y) > PLANET_LOST_RADIUS || sim.suns.some((s) => Math.hypot(s.x - p.x, s.y - p.y) < PLANET_BURN_RADIUS)) {
      sim.planet = spawnPlanet(rng);
      sim.destroyed += 1;
      events.push('planet-destroyed');
    }
    return events;
  }

  // 推进 t 个模拟时间单位（内部按固定步长积分，单次最多 2000 步，防止切回标签页时卡顿）。
  sim.advance = (t) => {
    carry += t;
    const n = Math.min(2000, Math.floor(carry / DT));
    carry -= n * DT;
    if (n === 2000) carry = 0;
    const events = [];
    for (let i = 0; i < n; i++) {
      step();
      if (i % 10 === 9 || i === n - 1) events.push(...check());
    }
    return events;
  };
  sim.reset = reset;

  reset(mode);
  return sim;
}
