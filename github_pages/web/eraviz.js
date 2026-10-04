// 纪元卡片的天象：天空、太阳、温度计和光照条。数值只用来营造氛围，不影响计分。
// 动效（温度摆动、光照闪烁、热浪、霜冻、迷雾）都写在 CSS 里，按纪元类名区分。

export const ERA_SKY_INFO = {
  stable: { temp: '22°C', tempPct: 52, lightPct: 60, suns: 1 },
  chaotic: { temp: '-60°C ~ 70°C', tempPct: 50, lightPct: 50, suns: 1 },
  triple: { temp: '>1000°C', tempPct: 100, lightPct: 100, suns: 3 },
  flying: { temp: '-80°C', tempPct: 12, lightPct: 18, suns: 2 },
  unknown: { temp: '?', tempPct: 50, lightPct: 50, suns: 0 },
};

function sunsSvg(id, count) {
  if (id === 'unknown') return '<text class="ev-fog-mark" x="50" y="34">?</text>';
  if (id === 'flying') {
    // 近处一颗暗淡的太阳 + 远处两颗小飞星
    return '<circle class="ev-sun" cx="30" cy="30" r="9" /><circle class="ev-star" cx="74" cy="16" r="2.4" /><circle class="ev-star" cx="80" cy="19" r="2" />';
  }
  if (count === 3) return [24, 50, 76].map((x) => `<circle class="ev-sun" cx="${x}" cy="24" r="9" />`).join('');
  return '<circle class="ev-sun" cx="50" cy="26" r="11" />';
}

export function eraSkyHtml(id, labels) {
  const info = ERA_SKY_INFO[id];
  return `<div class="era-sky era-sky-${id}" aria-hidden="true">
      <svg viewBox="0 0 100 44" preserveAspectRatio="xMidYMid slice">
        <rect class="ev-bg" x="0" y="0" width="100" height="44" />
        ${sunsSvg(id, info.suns)}
        <path class="ev-ground" d="M0 40 Q25 34 50 39 T100 37 L100 44 L0 44 Z" />
      </svg>
    </div>
    <div class="era-gauges">
      <div class="gauge gauge-temp" title="${labels.temp}">
        <span class="gauge-icon">🌡</span>
        <span class="gauge-bar"><span class="gauge-fill" style="--pct: ${info.tempPct}%"></span></span>
        <span class="gauge-value">${info.temp}</span>
      </div>
      <div class="gauge gauge-light" title="${labels.light}">
        <span class="gauge-icon">☀</span>
        <span class="gauge-bar"><span class="gauge-fill" style="--pct: ${info.lightPct}%"></span></span>
        <span class="gauge-value">${labels.lightValue}</span>
      </div>
    </div>`;
}
