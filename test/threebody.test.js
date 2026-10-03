import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation, initialSuns, energy, DT } from '../src/threebody.js';
import { createRng } from '../src/rng.js';

const FIGURE8_PERIOD = 6.32591398;

test('恒纪元：8 字形解运行一个周期后回到起点，能量守恒', () => {
  const sim = createSimulation('stable', createRng(1));
  const start = sim.suns.map((s) => ({ ...s }));
  const e0 = energy(sim.suns);
  // 单次 advance 有步数上限（防卡顿），分段推进
  for (let t = 0; t < FIGURE8_PERIOD - 1e-9; t += 0.5) sim.advance(Math.min(0.5, FIGURE8_PERIOD - t));
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.hypot(sim.suns[i].x - start[i].x, sim.suns[i].y - start[i].y) < 0.02, `太阳 ${i} 偏离起点`);
  }
  assert.ok(Math.abs(energy(sim.suns) - e0) < 1e-4, '能量漂移过大');
});

test('三日凌空：共线解的引力正好提供向心力', () => {
  const [outer] = initialSuns('triple');
  const v2 = outer.vx ** 2 + outer.vy ** 2;
  // 外侧太阳到中间太阳距离 1，到另一侧太阳距离 2
  assert.ok(Math.abs(v2 / 1 - (1 / 1 + 1 / 4)) < 1e-12);
});

test('乱纪元：随机初始条件动量为零、是束缚态', () => {
  const rng = createRng(7);
  for (let k = 0; k < 20; k++) {
    const suns = initialSuns('chaotic', rng);
    const px = suns.reduce((a, s) => a + s.vx, 0);
    const py = suns.reduce((a, s) => a + s.vy, 0);
    assert.ok(Math.abs(px) < 1e-12 && Math.abs(py) < 1e-12);
    assert.ok(energy(suns, 0.1) < 0);
  }
});

test('太阳被甩飞时整体重置，并记一次文明毁灭', () => {
  const sim = createSimulation('chaotic', createRng(3));
  sim.suns[0].x = 100;
  const events = sim.advance(DT * 10);
  assert.ok(events.includes('suns-escaped'));
  assert.equal(sim.destroyed, 1);
  assert.ok(sim.suns.every((s) => Math.hypot(s.x, s.y) < 6));
});

test('星球坠入太阳时重生，并记一次文明毁灭', () => {
  const sim = createSimulation('stable', createRng(5));
  Object.assign(sim.planet, { x: sim.suns[2].x, y: sim.suns[2].y, vx: sim.suns[2].vx, vy: sim.suns[2].vy });
  const events = sim.advance(DT * 10);
  assert.ok(events.includes('planet-destroyed'));
  assert.equal(sim.destroyed, 1);
});

test('飞星纪元：远处双星 + 近处太阳的分层构型长期稳定，星球不会毁灭', () => {
  const sim = createSimulation('flying', createRng(9));
  for (let i = 0; i < 120; i++) sim.advance(0.5);
  assert.equal(sim.destroyed, 0);
  const [near, b, c] = sim.suns;
  assert.ok(Math.hypot(b.x - c.x, b.y - c.y) < 0.6, '双星散开了');
  assert.ok(Math.hypot(b.x - near.x, b.y - near.y) > 2, '飞星离得太近');
  const d = Math.hypot(sim.planet.x - near.x, sim.planet.y - near.y);
  assert.ok(d > 0.3 && d < 0.6, `星球偏离了近处太阳：${d}`);
});

test('长时间运行不会产生 NaN', () => {
  for (const mode of ['stable', 'chaotic', 'triple', 'flying']) {
    const sim = createSimulation(mode, createRng(11));
    for (let i = 0; i < 50; i++) sim.advance(0.5);
    for (const b of [...sim.suns, sim.planet]) assert.ok(Number.isFinite(b.x) && Number.isFinite(b.vy), mode);
  }
});
