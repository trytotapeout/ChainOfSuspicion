// 中英文切换：当前语言、翻译函数、静态页面文案的套用。
// 静态 HTML 用属性标注：
//   data-i18n="键"            替换 textContent
//   data-i18n-html="键"       替换 innerHTML（文案里带标签时用）
//   data-i18n-aria="键"       替换 aria-label
//   data-lang="zh" / "en"     整块内容只在对应语言下显示（规则弹窗这类长文）
// 动态内容由 app.js 在切换语言时重新渲染。

import zh from './i18n/zh.js';
import en from './i18n/en.js';
import { CIRCUITS_EN, ERAS_EN } from './i18n/data.js';
import { getCircuit } from '../src/circuits.js';
import { getEra } from '../src/eras.js';

export const DICTS = { zh, en };
const STORAGE_KEY = 'chainofsuspicion.lang';

function initialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {
    // 隐私模式下 localStorage 可能不可用，退回浏览器语言
  }
  return /^zh/i.test(navigator.language ?? '') ? 'zh' : 'en';
}

let lang = initialLang();
const listeners = [];

export const getLang = () => lang;

// 翻译：找不到键时退回中文，再找不到就显示键名（方便发现漏翻）。
export function t(key, params = {}) {
  const text = DICTS[lang][key] ?? DICTS.zh[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
}

// 大脑、纪元的多语言字段
export function circuitText(id) {
  const c = getCircuit(id);
  return lang === 'en' ? { ...c, ...CIRCUITS_EN[id] } : c;
}

export function eraText(id) {
  const e = getEra(id);
  return lang === 'en' ? { ...e, ...ERAS_EN[id] } : e;
}

export function applyStatic(root = document) {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = t('page.title');
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const el of root.querySelectorAll('[data-lang]')) el.hidden = el.dataset.lang !== lang;
}

export function setLang(next) {
  if (next !== 'zh' && next !== 'en') return;
  lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // 忽略：只是记不住选择
  }
  applyStatic();
  for (const fn of listeners) fn(lang);
}

export const onLangChange = (fn) => listeners.push(fn);
