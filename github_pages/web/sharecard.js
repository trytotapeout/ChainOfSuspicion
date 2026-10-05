// 战报图片：1200×630（X / Telegram 卡片的常用比例），用 Canvas 画，不依赖任何库和网络资源。
// 内容：游戏名、称号、纪元、双方大脑、比分、猜疑链、在线地址。

const W = 1200;
const H = 630;
const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", -apple-system, "Segoe UI", sans-serif';
const COLORS = { intact: '#f0b84b', mended: '#5ff0d0', cracked: '#ff6b6b', broken: '#ff6b6b' };
const BRAIN = { 1: '#f0b84b', 2: '#b48cff', 3: '#4fc3a1', 4: '#ff6b6b' };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 星空背景 + 三颗太阳的光晕
function drawSky(ctx) {
  const bg = ctx.createRadialGradient(W * 0.78, H * 0.35, 20, W * 0.78, H * 0.35, W * 0.8);
  bg.addColorStop(0, '#1d2340');
  bg.addColorStop(1, '#07080d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // 固定种子的星星，每张战报的星空一样
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  ctx.fillStyle = 'rgba(220, 228, 255, 0.7)';
  for (let i = 0; i < 160; i++) ctx.fillRect(rnd() * W, rnd() * H, rnd() * 1.6 + 0.4, rnd() * 1.6 + 0.4);
  for (const [x, y, c] of [[930, 150, '255, 196, 120'], [1040, 230, '255, 236, 190'], [880, 270, '255, 150, 90']]) {
    const g = ctx.createRadialGradient(x, y, 4, x, y, 90);
    g.addColorStop(0, `rgba(${c}, 0.9)`);
    g.addColorStop(0.25, `rgba(${c}, 0.3)`);
    g.addColorStop(1, `rgba(${c}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - 90, y - 90, 180, 180);
    ctx.fillStyle = `rgb(${c})`;
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawChain(ctx, states, x, y, maxW) {
  const n = Math.max(states.length, 1);
  const step = Math.min(70, (maxW - 60) / n);
  const w = step * 1.2;
  states.forEach((s, i) => {
    const lx = x + i * step;
    ctx.save();
    if (s === 'broken') {
      // 断成两半
      ctx.strokeStyle = COLORS.broken;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(lx + 16, y, 16, Math.PI / 2, Math.PI * 1.5);
      ctx.moveTo(lx + 16, y - 16);
      ctx.lineTo(lx + w / 2 - 6, y - 18);
      ctx.moveTo(lx + 16, y + 16);
      ctx.lineTo(lx + w / 2 - 6, y + 14);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(lx + w - 16, y, 16, -Math.PI / 2, Math.PI / 2);
      ctx.moveTo(lx + w - 16, y - 16);
      ctx.lineTo(lx + w / 2 + 6, y - 14);
      ctx.moveTo(lx + w - 16, y + 16);
      ctx.lineTo(lx + w / 2 + 6, y + 18);
      ctx.stroke();
    } else {
      ctx.strokeStyle = s === 'cracked' ? '#b98a4a' : COLORS.intact;
      ctx.lineWidth = 6;
      ctx.shadowColor = s === 'intact' ? 'rgba(240, 184, 75, 0.6)' : 'transparent';
      ctx.shadowBlur = 10;
      roundRect(ctx, lx, y - 16, w, 32, 16);
      ctx.stroke();
      if (s === 'cracked' || s === 'mended') {
        ctx.strokeStyle = COLORS[s];
        ctx.lineWidth = 4;
        ctx.shadowColor = COLORS[s];
        ctx.beginPath();
        ctx.moveTo(lx + w / 2 - 3, y - 19);
        ctx.lineTo(lx + w / 2 + 4, y - 7);
        ctx.lineTo(lx + w / 2 - 4, y + 2);
        ctx.lineTo(lx + w / 2 + 3, y + 11);
        ctx.lineTo(lx + w / 2 - 1, y + 20);
        ctx.stroke();
      }
    }
    ctx.restore();
  });
}

export function drawShareCard(canvas, d) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  drawSky(ctx);
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#f0b84b';
  ctx.font = `800 54px ${FONT}`;
  ctx.fillText(d.appTitle, 70, 110);
  ctx.fillStyle = '#9aa3b2';
  ctx.font = `500 26px ${FONT}`;
  ctx.fillText(d.caption, 70, 152);

  // 称号
  ctx.fillStyle = 'rgba(240, 184, 75, 0.14)';
  roundRect(ctx, 70, 190, 620, 96, 16);
  ctx.fill();
  ctx.fillStyle = '#9aa3b2';
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText(d.titleLabel, 96, 228);
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 40px ${FONT}`;
  ctx.fillText(d.title, 96, 270);

  // 双方大脑和比分
  ctx.font = `700 30px ${FONT}`;
  ctx.fillStyle = BRAIN[d.myId] ?? '#fff';
  ctx.fillText(d.myBrain, 70, 350);
  const vsX = 70 + ctx.measureText(d.myBrain).width + 18;
  ctx.fillStyle = '#9aa3b2';
  ctx.fillText('vs', vsX, 350);
  ctx.fillStyle = BRAIN[d.oppId] ?? '#fff';
  ctx.fillText(d.oppBrain, vsX + ctx.measureText('vs').width + 18, 350);
  ctx.fillStyle = d.outcome === 'lose' ? '#ff6b6b' : '#4fc3a1';
  ctx.font = `800 64px ${FONT}`;
  const score = `${d.a} : ${d.b}`;
  ctx.fillText(score, 70, 430);
  const scoreW = ctx.measureText(score).width;
  ctx.fillStyle = '#c9ced8';
  ctx.font = `500 26px ${FONT}`;
  ctx.fillText(d.era, 70 + scoreW + 30, 425);

  // 猜疑链
  drawChain(ctx, d.chain, 70, 500, W - 140);
  ctx.fillStyle = '#c9ced8';
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText(d.chainStory, 70, 560);

  ctx.fillStyle = '#9aa3b2';
  ctx.font = `500 20px ${FONT}`;
  ctx.fillText(d.url, 70, 600);
  ctx.textAlign = 'right';
  ctx.fillText('TapeOut · X Layer', W - 70, 600);
  ctx.textAlign = 'left';
  return canvas;
}
