// 本地静态服务器（零依赖）。只监听 127.0.0.1，不对外暴露。
//
//   node scripts/serve.js          开发：直接用 web/ 和 src/，入口 http://localhost:5173/web/
//   node scripts/serve.js --docs   预览打包结果：把 docs/ 挂在 /ChainOfSuspicion/ 子路径下，
//                                  和 GitHub Pages 的 https://<用户>.github.io/ChainOfSuspicion/ 一致
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.PORT ?? 5173);
const docsMode = process.argv.includes('--docs');
const BASE = '/ChainOfSuspicion/';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

// 请求路径 → 磁盘上的相对路径；返回 null 表示不允许访问
function resolve(path) {
  if (docsMode) {
    if (!path.startsWith(BASE)) return null;
    const rel = path.slice(BASE.length) || 'index.html';
    return join('docs', normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  }
  const rel = normalize(path === '/web/' ? '/web/index.html' : path).replace(/^(\.\.[/\\])+/, '');
  // 只允许访问 web/ 和 src/
  return /^[/\\](web|src)[/\\]/.test(rel) ? rel : null;
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  // 页面用相对路径引用资源，所以入口要带结尾的斜杠
  const entry = docsMode ? BASE : '/web/';
  if (path === '/' || path === entry.slice(0, -1)) {
    res.writeHead(302, { location: entry }).end();
    return;
  }
  const rel = resolve(path);
  if (!rel) {
    res.writeHead(404).end('not found');
    return;
  }
  try {
    const body = await readFile(join(root, rel));
    res.writeHead(200, { 'content-type': types[extname(rel)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`猜疑链 Chain of Suspicion: http://localhost:${port}${docsMode ? BASE : '/web/'}`));
