// 猜疑链可视化：一轮一个链环，横向连成一条链。
// 完好 = 金色，裂痕 = 红色裂缝，断裂 = 链环裂成两半并错开，修复 = 青色焊补，未进行的轮次 = 虚线。
// 刚结算的那一环播放一次动画（裂开、断开或焊上）。状态由 src/chain.js 计算。

const LINK_W = 46;
const STEP = 38; // 相邻链环的间距，小于宽度，链环互相套住
const H = 44;
const CY = H / 2;

// 竖向小链环把两个横向链环扣在一起
const joint = (x) => `<rect class="cv-joint" x="${x - 5}" y="${CY - 9}" width="10" height="18" rx="5" />`;

function linkSvg(state, x, round, isNew) {
  const cls = `cv-link cv-${state}${isNew ? ' cv-new' : ''}`;
  const ring = `<rect class="cv-ring" x="${x}" y="${CY - 11}" width="${LINK_W}" height="22" rx="11" />`;
  const label = `<text class="cv-round" x="${x + LINK_W / 2}" y="${CY + 4}">${round}</text>`;
  if (state === 'broken') {
    // 左右两半分开，中间留缝
    const half = (dx, side) =>
      `<path class="cv-ring cv-half cv-half-${side}" d="${side === 'l'
        ? `M${x + LINK_W / 2 - 3 + dx} ${CY - 11} H${x + 11 + dx} A11 11 0 0 0 ${x + 11 + dx} ${CY + 11} H${x + LINK_W / 2 - 3 + dx}`
        : `M${x + LINK_W / 2 + 3 + dx} ${CY - 11} H${x + LINK_W - 11 + dx} A11 11 0 0 1 ${x + LINK_W - 11 + dx} ${CY + 11} H${x + LINK_W / 2 + 3 + dx}`}" />`;
    return `<g class="${cls}">${half(-3, 'l')}${half(3, 'r')}${label}</g>`;
  }
  const crack =
    state === 'cracked'
      ? `<path class="cv-crack" d="M${x + LINK_W / 2 - 2} ${CY - 13} l4 7 l-5 5 l4 6 l-2 8" />`
      : state === 'mended'
        ? `<path class="cv-weld" d="M${x + LINK_W / 2 - 1} ${CY - 13} l3 7 l-4 5 l3 6 l-1 8" />`
        : '';
  return `<g class="${cls}">${ring}${crack}${label}</g>`;
}

// states：已结算轮次的链环状态；total：总轮数；newIndex：刚结算的那一环（播放动画），没有就传 -1
export function chainSvg({ states, total, newIndex = -1, aria }) {
  const width = 8 + (total - 1) * STEP + LINK_W + 8;
  const parts = [];
  for (let i = 0; i < total; i++) {
    const x = 8 + i * STEP;
    if (i > 0) parts.push(joint(x + (LINK_W - STEP) / 2 - 1));
    parts.push(i < states.length ? linkSvg(states[i], x, i + 1, i === newIndex) : `<g class="cv-link cv-pending"><rect class="cv-ring" x="${x}" y="${CY - 11}" width="${LINK_W}" height="22" rx="11" /></g>`);
  }
  return `<svg class="chainviz" viewBox="0 0 ${width} ${H}" preserveAspectRatio="xMinYMid meet" role="img" aria-label="${aria}">${parts.join('')}</svg>`;
}
