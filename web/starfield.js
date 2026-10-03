// 背景动画：三体星系的实时引力模拟（Canvas 2D，无第三方依赖）。
// 三颗太阳的运动由 src/threebody.js 数值积分得出，不是预先做好的动画。
// 用户开启“减少动态效果”时只画静态画面。

import { createSimulation } from '../src/threebody.js';

const SUN_COLORS = ['255, 196, 120', '255, 236, 190', '255, 150, 90'];
const PLANET_COLOR = '120, 190, 255';
const TRAIL = { sun: 160, planet: 260 };
const SPEED = { stable: 0.55, chaotic: 0.7, triple: 0.5 }; // 每秒推进的模拟时间
const VIEW_RADIUS = 3.2; // 画面要容纳的模拟坐标半径
// 星体大小随画面缩放（单位：模拟坐标），并设下限，小窗口里也看得清。
const SUN_CORE = 0.11;
const SUN_GLOW = 0.75;
const PLANET_SIZE = 0.05;
const size = (r, scale, min) => Math.max(min, r * scale);
const MODE_LABEL = { stable: '恒纪元', chaotic: '乱纪元', triple: '三日凌空' };

// anchor：页面主内容区。宽屏时星系画在它右侧的留白里，窄屏时画在内容背后。
export function createStarfield(canvas, caption, anchor) {
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let sim = createSimulation('stable');
  let trails = [];
  let stars = [];
  let flash = 0;
  let w = 0;
  let h = 0;
  let last = 0;
  let raf = 0;
  let label = null; // 覆盖显示的纪元名，比如对局中的“未知纪元”

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: Math.round((w * h) / 5000) }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.2 + 0.2,
      phase: Math.random() * Math.PI * 2,
    }));
    draw(performance.now());
  }

  function resetTrails() {
    trails = [...sim.suns, sim.planet].map(() => []);
  }

  // 星系中心：右侧留白足够宽时画在留白中间，否则画在视口中间偏上（内容背后）。
  function view() {
    const right = anchor ? anchor.getBoundingClientRect().right : w / 2;
    const free = w - right;
    if (free > 320) return { cx: right + free / 2, cy: h * 0.45, scale: (Math.min(free, h) / 2 / VIEW_RADIUS) * 0.95 };
    return { cx: w / 2, cy: h * 0.4, scale: (Math.min(w, h) / 2 / VIEW_RADIUS) * 1.05 };
  }

  function updateCaption() {
    if (caption) caption.textContent = `三体运动实时引力模拟 · ${label ?? MODE_LABEL[sim.mode]} · 三体星球文明已毁灭 ${sim.destroyed} 次`;
  }

  function draw(now) {
    ctx.clearRect(0, 0, w, h);
    for (const s of stars) {
      const a = reduceMotion.matches ? 0.6 : 0.35 + 0.35 * Math.sin(now / 900 + s.phase);
      ctx.fillStyle = `rgba(220, 228, 255, ${a})`;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }

    const { cx, cy, scale } = view();
    const bodies = [...sim.suns, sim.planet];
    bodies.forEach((b, i) => {
      const trail = trails[i];
      const color = i < 3 ? SUN_COLORS[i] : PLANET_COLOR;
      for (let k = 1; k < trail.length; k++) {
        ctx.strokeStyle = `rgba(${color}, ${(k / trail.length) * (i < 3 ? 0.35 : 0.5)})`;
        ctx.lineWidth = i < 3 ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.moveTo(cx + trail[k - 1].x * scale, cy + trail[k - 1].y * scale);
        ctx.lineTo(cx + trail[k].x * scale, cy + trail[k].y * scale);
        ctx.stroke();
      }
    });

    // 光晕用叠加混合，太阳靠近时光晕会融在一起变亮
    const core = size(SUN_CORE, scale, 9);
    const glowR = size(SUN_GLOW, scale, 70);
    ctx.globalCompositeOperation = 'lighter';
    sim.suns.forEach((s, i) => {
      const x = cx + s.x * scale;
      const y = cy + s.y * scale;
      const glow = ctx.createRadialGradient(x, y, core * 0.5, x, y, glowR);
      glow.addColorStop(0, `rgba(${SUN_COLORS[i]}, 0.85)`);
      glow.addColorStop(0.2, `rgba(${SUN_COLORS[i]}, 0.4)`);
      glow.addColorStop(0.5, `rgba(${SUN_COLORS[i]}, 0.12)`);
      glow.addColorStop(1, `rgba(${SUN_COLORS[i]}, 0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
    sim.suns.forEach((s, i) => {
      const x = cx + s.x * scale;
      const y = cy + s.y * scale;
      const body = ctx.createRadialGradient(x - core * 0.3, y - core * 0.3, 0, x, y, core);
      body.addColorStop(0, '#fffaf0');
      body.addColorStop(1, `rgb(${SUN_COLORS[i]})`);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(x, y, core, 0, Math.PI * 2);
      ctx.fill();
    });

    // 三体星球：亮面朝向质心方向，带一圈淡蓝大气
    const p = sim.planet;
    const px = cx + p.x * scale;
    const py = cy + p.y * scale;
    const pr = size(PLANET_SIZE, scale, 5);
    const atmo = ctx.createRadialGradient(px, py, pr, px, py, pr * 2.6);
    atmo.addColorStop(0, `rgba(${PLANET_COLOR}, 0.35)`);
    atmo.addColorStop(1, `rgba(${PLANET_COLOR}, 0)`);
    ctx.fillStyle = atmo;
    ctx.beginPath();
    ctx.arc(px, py, pr * 2.6, 0, Math.PI * 2);
    ctx.fill();
    const lit = Math.atan2(cy - py, cx - px);
    const planet = ctx.createRadialGradient(px + Math.cos(lit) * pr * 0.5, py + Math.sin(lit) * pr * 0.5, 0, px, py, pr);
    planet.addColorStop(0, '#e6f4ff');
    planet.addColorStop(1, '#2d5f99');
    ctx.fillStyle = planet;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();

    // 文明毁灭时整个画面闪一下
    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 120, 80, ${flash * 0.18})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const events = sim.advance(dt * SPEED[sim.mode]);
    if (events.includes('suns-escaped')) resetTrails();
    if (events.includes('planet-destroyed')) trails[3] = [];
    if (events.some((e) => e !== 'triple-reset')) {
      flash = 1;
      updateCaption();
    }
    flash = Math.max(0, flash - dt * 1.5);
    [...sim.suns, sim.planet].forEach((b, i) => {
      const trail = trails[i];
      trail.push({ x: b.x, y: b.y });
      if (trail.length > (i < 3 ? TRAIL.sun : TRAIL.planet)) trail.shift();
    });
    draw(now);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    cancelAnimationFrame(raf);
    if (reduceMotion.matches) {
      draw(performance.now());
      return;
    }
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function setMode(mode, nextLabel = null) {
    label = nextLabel;
    if (mode === sim.mode) {
      updateCaption();
      return;
    }
    const destroyed = sim.destroyed;
    sim = createSimulation(mode);
    sim.destroyed = destroyed;
    resetTrails();
    updateCaption();
    draw(performance.now());
  }

  window.addEventListener('resize', resize);
  reduceMotion.addEventListener('change', start);
  resetTrails();
  resize();
  updateCaption();
  start();

  return { setMode, get mode() { return sim.mode; }, get destroyed() { return sim.destroyed; } };
}
