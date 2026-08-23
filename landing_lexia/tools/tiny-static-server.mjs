// tiny-static-server.mjs — Servidor estático mínimo para validar landing
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join, normalize } from 'path';

const PORT = 8766;
const ROOT = process.argv[2] || '.';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain; charset=utf-8',
  '.webm': 'video/webm',
  '.mp4':  'video/mp4'
};

createServer(async (req, res) => {
  try {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (url === '/') url = '/index.html';
    const safe = normalize(join(ROOT, url));
    if (!safe.startsWith(normalize(ROOT))) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    const data = await readFile(safe);
    res.writeHead(200, { 'Content-Type': MIME[extname(safe)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 ' + req.url);
  }
}).listen(PORT, () => console.log('Static server on http://localhost:' + PORT));
