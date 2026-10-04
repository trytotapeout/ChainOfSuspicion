// 大脑卡片的可视化：线框大脑缓慢转动，里面画的是这个大脑在链上的真实 NAND 网表。
// 悬停或选中时大脑“思考”：输入在 1 和 0 之间切换，信号沿网表逐个门传播，最后点亮输出。
// 门的取值由 src/netlist.js 按链上网表算出，不是写死的动画。

import { simulateNetlist } from '../src/netlist.js';

const W = 200;
const H = 120;
const NODE_Y = 62;
const STEP_MS = 260; // 信号每经过一个门的时间
const HOLD_MS = 900; // 输出亮起后停留的时间

// 线框大脑：两个半球的外轮廓 + 几道脑回
const BRAIN_PATH = [
  'M100 14 C76 6 44 12 34 32 C18 36 12 56 22 70 C14 86 28 104 50 104 C62 114 84 112 100 104',
  'M100 14 C124 6 156 12 166 32 C182 36 188 56 178 70 C186 86 172 104 150 104 C138 114 116 112 100 104',
  'M100 16 L100 102',
  'M44 40 C56 34 66 42 76 36',
  'M34 66 C48 58 60 70 74 62',
  'M54 90 C66 82 78 92 88 84',
  'M156 40 C144 34 134 42 124 36',
  'M166 66 C152 58 140 70 126 62',
  'M146 90 C134 82 122 92 112 84',
].map((d) => `<path d="${d}" />`).join('');

// 节点横向排开：IN0、各个门、OUT0。每个门的输入线从对应的源节点连过来。
function layout(gates) {
  const count = gates.length + 2;
  const x0 = 30;
  const dx = (W - 2 * x0) / (count - 1);
  const pos = (i) => x0 + i * dx;
  // 线号 → 节点下标：线 2 是 IN0（节点 0），门 k 的输出线 3+k 是节点 k+1
  const nodeOfWire = (wire) => (wire === 2 ? 0 : wire - 2);
  const edges = [];
  gates.forEach(([a, b], k) => {
    for (const src of new Set([a, b])) {
      if (src < 2) continue;
      edges.push({ from: nodeOfWire(src), to: k + 1 });
    }
  });
  edges.push({ from: gates.length, to: gates.length + 1 });
  return { count, pos, edges };
}

function edgePath(pos, { from, to }) {
  const x1 = pos(from);
  const x2 = pos(to);
  if (to - from === 1) return `M${x1} ${NODE_Y} L${x2} ${NODE_Y}`;
  // 跳过中间节点的连线从上方绕过去
  const lift = 18 + (to - from) * 4;
  return `M${x1} ${NODE_Y} C${x1} ${NODE_Y - lift} ${x2} ${NODE_Y - lift} ${x2} ${NODE_Y}`;
}

export function brainSvg(circuit, labels) {
  const { count, pos, edges } = layout(circuit.netlist);
  const nodes = [];
  for (let i = 0; i < count; i++) {
    const isIn = i === 0;
    const isOut = i === count - 1;
    const r = isIn || isOut ? 7 : 5.5;
    nodes.push(`<g class="bv-node${isIn ? ' bv-in' : ''}${isOut ? ' bv-out' : ''}" data-node="${i}">
      <circle cx="${pos(i)}" cy="${NODE_Y}" r="${r}" />
      ${isIn || isOut ? `<text x="${pos(i)}" y="${NODE_Y + 20}">${isIn ? 'IN' : 'OUT'}</text>` : ''}
    </g>`);
  }
  return `<svg class="brainviz" viewBox="0 0 ${W} ${H}" role="img" aria-label="${labels.aria}">
    <g class="bv-brain">${BRAIN_PATH}</g>
    <g class="bv-edges">${edges.map((e) => `<path class="bv-edge" data-to="${e.to}" d="${edgePath(pos, e)}" />`).join('')}</g>
    <g class="bv-nodes">${nodes.join('')}</g>
    <text class="bv-gates" x="${W / 2}" y="${H - 4}">${labels.gates}</text>
  </svg>`;
}

// 让一张卡片里的大脑开始思考。返回停止函数。
export function startThinking(svg, circuit, reduceMotion) {
  const nodes = [...svg.querySelectorAll('.bv-node')];
  const edges = [...svg.querySelectorAll('.bv-edge')];
  let input = 1;
  let timer = 0;
  let stopped = false;

  const paint = (values, upTo) => {
    nodes.forEach((n, i) => {
      n.classList.toggle('lit', i <= upTo);
      n.classList.toggle('on', i <= upTo && values[i] === 1);
      n.classList.toggle('off', i <= upTo && values[i] === 0);
    });
    edges.forEach((e) => e.classList.toggle('lit', Number(e.dataset.to) <= upTo));
  };

  const run = () => {
    if (stopped) return;
    const { wires, gateWires } = simulateNetlist(circuit.netlist, [input]);
    // 节点取值：IN0、每个门的输出、OUT0（等于最后一个门）
    const values = [input, ...gateWires.map((w) => wires[w]), wires[gateWires[gateWires.length - 1]]];
    if (reduceMotion) {
      paint(values, nodes.length - 1);
      return;
    }
    let step = 0;
    const tick = () => {
      if (stopped) return;
      paint(values, step);
      step += 1;
      if (step < nodes.length) timer = setTimeout(tick, STEP_MS);
      else
        timer = setTimeout(() => {
          input = 1 - input;
          run();
        }, HOLD_MS);
    };
    tick();
  };

  svg.classList.add('thinking');
  run();
  return () => {
    stopped = true;
    clearTimeout(timer);
    svg.classList.remove('thinking');
    paint([], -1);
  };
}
