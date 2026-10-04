import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });
  res.end(payload);
}

/**
 * Serves the production build of the frontend from the same origin as the API,
 * so the dashboard also works when opened straight from the bridge with no Vite
 * dev server running. Absent `frontend/dist` this 404s and `index.js` prints a
 * hint to run the dev server instead.
 */
function serveStatic(req, res) {
  if (!fs.existsSync(config.staticDir)) {
    sendJson(res, 404, {
      error: 'frontend build not found',
      detail: `Expected ${config.staticDir}. Run "npm run build" in Dashboard/frontend, or use the Vite dev server.`,
    });
    return;
  }

  const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let filePath = path.join(config.staticDir, urlPath);

  // Keep traversal inside the build directory.
  if (!filePath.startsWith(config.staticDir)) {
    sendJson(res, 403, { error: 'forbidden' });
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(config.staticDir, 'index.html');
  }

  const type = MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
  const immutable = filePath.includes(`${path.sep}assets${path.sep}`);

  res.writeHead(200, {
    'content-type': type,
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  fs.createReadStream(filePath).pipe(res);
}

export function createRequestHandler({ session, getStatus, listPorts }) {
  return function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,OPTIONS',
        'access-control-allow-headers': 'content-type',
      });
      res.end();
      return;
    }

    if (url.pathname === '/api/health') {
      sendJson(res, 200, {
        ok: true,
        demo: session.source === 'demo',
        link: session.linkState(),
        serial: getStatus(),
        thresholds: session.thresholds,
        lastReadingAt: session.lastReadingAt,
      });
      return;
    }

    if (url.pathname === '/api/snapshot') {
      sendJson(res, 200, {
        ...session.snapshot(),
        serial: getStatus(),
      });
      return;
    }

    if (url.pathname === '/api/ports') {
      Promise.resolve(listPorts())
        .then((ports) => sendJson(res, 200, { ports }))
        .catch((err) => sendJson(res, 500, { error: String(err?.message ?? err) }));
      return;
    }

    if (url.pathname.startsWith('/api/')) {
      sendJson(res, 404, { error: 'unknown endpoint', path: url.pathname });
      return;
    }

    serveStatic(req, res);
  };
}