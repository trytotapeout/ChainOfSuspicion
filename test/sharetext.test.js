import test from 'node:test';
import assert from 'node:assert/strict';
import zh from '../web/i18n/zh.js';
import en from '../web/i18n/en.js';
import { TITLES } from '../src/achievements.js';
import { CIRCUITS_EN, ERAS_EN } from '../web/i18n/data.js';
import { CIRCUITS } from '../src/circuits.js';
import { ERAS } from '../src/eras.js';

// X 的字数：中日韩字符算 2，其他算 1，链接固定算 23
function xWeight(text) {
  let w = 0;
  const rest = text.replace(/https?:\/\/\S+/g, () => {
    w += 23;
    return '';
  });
  for (const ch of rest) w += /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(ch) ? 2 : 1;
  return w;
}

const fill = (s, p) => s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? String(p[k]) : m));

test('战报文字在最长情况下也不超过 X 的 280 字', () => {
  for (const [lang, d, names, eras] of [['zh', zh, CIRCUITS.map((c) => c.name), ERAS.map((e) => e.name)], ['en', en, Object.values(CIRCUITS_EN).map((c) => c.name), Object.values(ERAS_EN).map((e) => e.name)]]) {
    const longest = (xs) => xs.reduce((a, b) => (xWeight(b) > xWeight(a) ? b : a));
    const title = longest(TITLES.map(([id]) => d[`title.${id}`]));
    const brain = `#4 ${longest(names)}`;
    const chain = fill(d['chain.started'], { round: 10, run: 10 });
    const text = `${fill(d['share.text'], { title, era: longest(eras), brain, opp: brain, a: 50, b: 50, chain })} https://trytotapeout.github.io/ChainOfSuspicion/`;
    assert.ok(xWeight(text) <= 280, `${lang} 战报 ${xWeight(text)} 字：${text}`);
  }
});
