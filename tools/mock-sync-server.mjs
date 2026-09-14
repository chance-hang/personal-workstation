import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const root = process.cwd();
const gistId = '0d43906075e8377ee1cdf2d0e0537052';
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
  const file = join(root, filePath);
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    return send(res, 404, { message: 'Not Found' });
  }
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
  res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
});

server.listen(4173, '0.0.0.0', () => {
  console.log('LOCAL_MOCK_SERVER_READY http://127.0.0.1:4173/?mockSync=1');
  console.log('Use http://localhost:4173/?mockSync=1 as a second isolated browser origin.');
});
