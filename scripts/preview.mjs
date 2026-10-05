// Local fixture server only. Never connects to Cloudflare Access or production D1.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname, sep } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const prefs = new Map([['hannah:do:cancun-yucatan:punta-laguna', 'want']]);
const types = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.svg':'image/svg+xml', '.webp':'image/webp', '.jpg':'image/jpeg' };
export function previewServer(port = 4173) {
  return createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/bootstrap') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({profile:'emrys', preferences:[...prefs].map(([key,value]) => {
        const [profile,...parts] = key.split(':'); return {profile,item_key:parts.join(':'),value};
      })})); return;
    }
    if (url.pathname === '/api/preference' && req.method === 'POST') {
      let body = ''; for await (const chunk of req) body += chunk;
      const {item_key,value} = JSON.parse(body);
      value === null ? prefs.delete(`emrys:${item_key}`) : prefs.set(`emrys:${item_key}`,value);
      res.setHeader('Content-Type','application/json'); res.end('{"ok":true}'); return;
    }
    const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep) || url.pathname.includes('/.')) { res.writeHead(403); res.end(); return; }
    try { const data = await readFile(path); res.setHeader('Content-Type',types[extname(path)] || 'application/octet-stream'); res.end(data); }
    catch { res.writeHead(404); res.end('Not found'); }
  }).listen(port, '127.0.0.1');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  previewServer(); console.log('Fixture preview: http://127.0.0.1:4173 — Emrys test profile; no production writes.');
}
