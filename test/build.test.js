import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, 'github_pages');

test('npm run build 产出 GitHub Pages 可用的 github_pages/', () => {
  execFileSync(process.execPath, [join(root, 'scripts/build.js')], { stdio: 'pipe' });
  for (const f of ['index.html', '404.html', '.nojekyll', 'web/app.js', 'web/style.css', 'src/engine.js']) assert.ok(existsSync(join(out, f)), `缺少 github_pages/${f}`);
  assert.ok(!existsSync(join(out, 'web/index.html')), '入口应该只在 github_pages/index.html');
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  assert.match(html, /href="\.\/web\/style\.css"/);
  assert.match(html, /src="\.\/web\/app\.js"/);
  // 不能有以 / 开头的绝对路径，否则部署在 /ChainOfSuspicion/ 子路径下会 404
  assert.doesNotMatch(html, /(href|src)="\/(?!\/)/);
});

test('打包后所有相对 import 都能找到文件', () => {
  const seen = new Set();
  const missing = [];
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const m of readFileSync(file, 'utf8').matchAll(/(?:import|from)\s*[^;]*?['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const target = join(dirname(file), m[1]);
      if (existsSync(target)) walk(target);
      else missing.push(`${file} -> ${m[1]}`);
    }
  };
  walk(join(out, 'web/app.js'));
  assert.deepEqual(missing, []);
  assert.ok(seen.size > 15);
});

test('中英文 README 互相链接，章节数一致', () => {
  const zh = readFileSync(join(root, 'README.md'), 'utf8');
  const en = readFileSync(join(root, 'README.en.md'), 'utf8');
  assert.ok(zh.includes('(README.en.md)') && en.includes('(README.md)'));
  const headings = (s) => s.split('\n').filter((l) => /^#{1,3} /.test(l)).length;
  assert.equal(headings(en), headings(zh));
});
