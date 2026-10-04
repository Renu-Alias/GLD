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

  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    sendJson(res, 400, { error: 'malformed request path' });
    return;
  }

  // Resolve against the root and compare with a trailing separator, so neither
  // "../" nor a sibling directory that merely shares the root's name prefix
  // ("dist-old") can escape the build directory.
  const root = path.resolve(config.staticDir);
  let filePath = path.resolve(root, `.${path.posix.normalize(urlPath)}`);

  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    sendJson(res, 403, { error: 'forbidden' });
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // Client-side routing: unknown paths fall back to the SPA shell.
    filePath = path.join(root, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, {
      error: 'not found',
      detail: `${config.staticDir} has no index.html. Re-run "npm run build" in Dashboard/frontend.`,
    });
    return;
  }

  const type = MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
  const immutable = filePath.startsWith(path.join(root, 'assets') + path.sep);

  res.writeHead(200, {
    'content-type': type,
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });

  // Node suppresses the body of a HEAD response for us, so this is correct for
  // HEAD requests too.
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (res.headersSent) res.end();
    else sendJson(res, 500, { error: 'could not read file' });
  });
  stream.pipe(res);
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