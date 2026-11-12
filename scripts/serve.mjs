// خادم محلي بسيط لتجربة الواجهة في المتصفح: npm run build && npm run serve  (أضف ?tv=1 لوضع التلفاز)
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const www = join(dirname(fileURLToPath(import.meta.url)), '..', 'www');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
http.createServer((q, r) => { const p = join(www, decodeURIComponent(q.url.split('?')[0]).replace(/^\/$/, '/index.html')); if (!p.startsWith(www) || !existsSync(p)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); r.end(readFileSync(p)); }).listen(5173, '127.0.0.1', () => console.log('http://127.0.0.1:5173/   (TV: http://127.0.0.1:5173/?tv=1)'));
