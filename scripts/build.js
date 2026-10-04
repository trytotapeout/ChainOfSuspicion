// 打包成 GitHub Pages 可以直接发布的静态站点，输出到 github_pages/。
// 由 .github/workflows/pages.yml 发布：推送到 main 后，GitHub Actions 把这个目录部署到 Pages。
//
// 项目没有构建依赖，“打包”就是把浏览器要用到的文件原样复制过去：
//   github_pages/index.html      入口（来自 web/index.html）
//   github_pages/web/…           界面脚本、样式、文案
//   github_pages/src/…           游戏规则、电路、钱包等模块（浏览器直接用 ES module 加载）
//   github_pages/.nojekyll       让 GitHub Pages 跳过 Jekyll 处理，原样发布
//   github_pages/404.html        和入口相同，打错路径时也能进游戏
// 页面里的路径都是相对路径，所以部署在 https://<用户>.github.io/<仓库>/ 这种子路径下也能用。

import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, 'github_pages');

// 浏览器用不到的文件不发布
const skip = (path) => /(^|[/\\])(\.DS_Store|.*\.test\.js)$/.test(path);

async function listFiles(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(full)));
    else if (!skip(full)) files.push(full);
  }
  return files;
}

async function copyDir(name) {
  const files = await listFiles(join(root, name));
  for (const file of files) {
    const target = join(out, relative(root, file));
    await mkdir(dirname(target), { recursive: true });
    await cp(file, target);
  }
  return files.length;
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

// 入口页从 web/ 提到根目录，资源路径从 ./xxx 改成 ./web/xxx
const html = (await readFile(join(root, 'web/index.html'), 'utf8'))
  .replace('href="./style.css"', 'href="./web/style.css"')
  .replace('src="./app.js"', 'src="./web/app.js"');
if (!html.includes('./web/style.css') || !html.includes('./web/app.js')) throw new Error('web/index.html 里的资源路径不是预期的 ./style.css 和 ./app.js');
await writeFile(join(out, 'index.html'), html);
await writeFile(join(out, '404.html'), html);
await writeFile(join(out, '.nojekyll'), '');

const counts = { web: await copyDir('web'), src: await copyDir('src') };
// github_pages/web/index.html 用不到（入口在 github_pages/index.html），删掉避免混淆
await rm(join(out, 'web/index.html'));

let bytes = 0;
for (const f of await listFiles(out)) bytes += (await stat(f)).size;
console.log(`已打包到 github_pages/：web ${counts.web - 1} 个文件，src ${counts.src} 个文件，共 ${(bytes / 1024).toFixed(1)} KB`);
console.log('提交并推送到 main 后，GitHub Actions 会自动发布到 Pages');
