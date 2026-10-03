// 本地静态服务器（零依赖）。只监听 127.0.0.1，不对外暴露。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.PORT ?? 5173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const rel = normalize(path === '/' ? '/web/index.html' : path).replace(/^(\.\.[/\\])+/, '');
  // 只允许访问 web/ 和 src/
  if (!/^[/\\](web|src)[/\\]/.test(rel)) {
    res.writeHead(404).end('not found');
    return;
  }
  try {
    const body = await readFile(join(root, rel));
    res.writeHead(200, { 'content-type': types[extname(rel)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`猜疑链 MVP: http://localhost:${port}`));
