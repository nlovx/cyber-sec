// Простой статический сервер для локального запуска: node tools/serve.mjs [порт]
// Нужен только если хочешь открывать по http:// (например, чтобы работал буфер обмена
// в «копировать команду»). Иначе достаточно двойного клика по index.html.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = Number(process.argv[2]) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8'
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const fp = path.join(root, path.normalize(rel));
  if (!fp.startsWith(root)) { res.writeHead(403).end('forbidden'); return; }
  fs.readFile(fp, (err, buf) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, {
      'content-type': TYPES[path.extname(fp)] || 'application/octet-stream',
      // Всегда отдаём свежие файлы — чтобы правки были видны после обычного обновления (F5).
      'cache-control': 'no-cache, no-store, must-revalidate'
    });
    res.end(buf);
  });
}).listen(port, () => console.log(`CYBER SEC → http://localhost:${port}`));
