import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import zh from '../web/i18n/zh.js';
import en from '../web/i18n/en.js';
import { CIRCUITS_EN, ERAS_EN } from '../web/i18n/data.js';
import { designGuideHtml } from '../web/i18n/guide.js';
import { CIRCUITS } from '../src/circuits.js';
import { ERAS } from '../src/eras.js';
import { VERSION } from '../src/version.js';

const params = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('中英文案键名完全一致，参数也一致', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
  for (const k of Object.keys(zh)) assert.deepEqual(params(en[k]), params(zh[k]), `参数不一致：${k}`);
});

test('每个大脑、纪元都有英文名称和描述', () => {
  for (const c of CIRCUITS) for (const f of ['name', 'gate', 'desc', 'wiring']) assert.ok(CIRCUITS_EN[c.id]?.[f], `#${c.id} 缺少 ${f}`);
  for (const e of ERAS) for (const f of ['name', 'desc']) assert.ok(ERAS_EN[e.id]?.[f], `${e.id} 缺少 ${f}`);
});

test('页面和脚本里用到的键名都有文案', () => {
  const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
  const used = new Set([
    ...[...html.matchAll(/data-i18n(?:-html|-aria)?="([^"]+)"/g)].map((m) => m[1]),
    ...[...js.matchAll(/\bt\('([^']+)'/g)].map((m) => m[1]),
  ]);
  // 动态拼出来的键：钱包状态、错误、结局、电路计算方式
  for (const k of ['connect', 'switch', 'confirmCommit', 'waitCommit', 'confirmRead', 'waitRead']) used.add(`status.${k}`);
  for (const k of ['noProvider', 'noAccount', 'txFailed', 'txTimeout', 'txNotFound', 'readTx', 'eval']) used.add(`err.wallet.${k}`);
  for (const k of ['win', 'lose', 'draw']) used.add(`fate.${k}`).add(`verdict.${k}`);
  for (const k of ['chain', 'local']) used.add(`evaluator.${k}`);
  for (const k of used) assert.ok(k in zh, `缺少文案：${k}`);
});

test('设计指南中英文都包含完整的 8 行真值表', () => {
  for (const lang of ['zh', 'en']) {
    const html = designGuideHtml(lang, (a) => (a ? 'C' : 'S'));
    assert.equal((html.match(/<td>C<\/td>|<td>S<\/td>/g) ?? []).length, 8, lang);
    assert.ok(html.includes('0xEE') && html.includes('0xA5') && html.includes('0x88'), lang);
  }
});

test('规则弹窗中英文两份都在', () => {
  const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('data-lang="zh"') && html.includes('data-lang="en"'));
});

test('版本号和 package.json 一致', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(VERSION, pkg.version);
});
