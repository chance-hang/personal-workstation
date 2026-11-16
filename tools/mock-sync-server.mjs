import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local preview port');
const previewOnly = process.env.MOCK_PREVIEW_ONLY === '1';
const bindHost = process.env.MOCK_BIND_HOST || (previewOnly ? '127.0.0.1' : '0.0.0.0');
const gistId = 'local-mock';
const mock = { content: null, version: 0 };

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function etag() { return `"mock-${mock.version}"`; }

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  if (previewOnly && (pathname === '/' || pathname === '/index.html') && url.searchParams.get('mockSync') !== '1') {
    url.searchParams.set('mockSync', '1');
    res.writeHead(302, { Location: '/?' + url.searchParams + '#time-quadrants', 'Cache-Control': 'no-store' });
    res.end();
    return;
  }

  if (pathname === '/phone') {
    res.writeHead(302, { Location: '/?mockSync=1', 'Cache-Control': 'no-store' });
    res.end();
    return;
  }

  if (pathname.startsWith('/__mock_gists')) {
    if (req.method === 'GET' && pathname === `/__mock_gists/${gistId}`) {
      return send(res, 200, {
        id: gistId,
        files: mock.content ? { 'data.json': { content: mock.content } } : {}
      }, { ETag: etag() });
    }
    if (req.method === 'PATCH' && pathname === `/__mock_gists/${gistId}`) {
      if (req.headers['if-match'] && req.headers['if-match'] !== etag()) {
        return send(res, 412, { message: 'Mock ETag mismatch' }, { ETag: etag() });
      }
      try {
        const payload = JSON.parse(await readBody(req));
        mock.content = payload.files['data.json'].content;
        mock.version += 1;
        return send(res, 200, { id: gistId, files: { 'data.json': { content: mock.content } } }, { ETag: etag() });
      } catch {
        return send(res, 400, { message: 'Invalid mock payload' });
      }
    }
    if (req.method === 'GET' && pathname === `/__mock_gists/${gistId}/commits`) {
      return send(res, 200, []);
    }
    return send(res, 404, { message: 'Mock endpoint not found' });
  }

  let filePath = decodeURIComponent(pathname);
  if (filePath === '/') filePath = '/index.html';
  // LAN acceptance serves application assets only, never repository metadata.
  if (!['/index.html', '/app.js', '/styles.css'].includes(filePath)) {
    return send(res, 404, { message: 'Not Found' });
  }
  const file = join(root, filePath);
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    return send(res, 404, { message: 'Not Found' });
  }
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
  const headers = { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' };
  if (previewOnly && filePath === '/index.html') {
    headers['Content-Security-Policy'] = "default-src 'self'; connect-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; object-src 'none'; base-uri 'none'; form-action 'self'";
  }
  res.writeHead(200, headers);
  createReadStream(file).pipe(res);
});

server.listen(port, bindHost, () => {
  console.log(`LOCAL_MOCK_SERVER_READY http://127.0.0.1:${port}/?mockSync=1`);
  console.log(`Use http://localhost:${port}/?mockSync=1 as a second isolated browser origin.`);
});
