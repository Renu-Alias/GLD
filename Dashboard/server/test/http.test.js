import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { config } from '../src/config.js';
import { createRequestHandler } from '../src/http.js';
import { Session } from '../src/session.js';
import { parseLine } from '../src/telemetry.js';

const PORTS = [{ path: 'COM7', recognised: true }];
const SERIAL = { open: true, path: 'COM7', error: null, ports: PORTS };

/** Builds a temporary frontend build: index.html, a hashed asset, and a sibling dir. */
function makeDist() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'gld-dist-'));
  const dist = path.join(parent, 'dist');
  fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>GLD</title>');
  fs.writeFileSync(path.join(dist, 'assets', 'index-abc123.js'), 'console.log(1)');

  // Sibling whose name starts with the root's name: a naive startsWith() guard
  // would happily serve this.
  fs.mkdirSync(path.join(parent, 'dist-old'), { recursive: true });
  fs.writeFileSync(path.join(parent, 'dist-old', 'secret.txt'), 'TOP SECRET');
  return parent;
}

/** Runs `fn` against a real HTTP server on an ephemeral port. */
async function withServer(fn, { staticDir } = {}) {
  const session = new Session({ staleAfterMs: 3000 });
  session.ingest(parseLine('TELEM,gas=512,state=WARNING,up=100,rssi=-60,muted=0,warm=0'));

  const previousDir = config.staticDir;
  if (staticDir !== undefined) config.staticDir = staticDir;

  const server = http.createServer(createRequestHandler({
    session,
    getStatus: () => ({ ...SERIAL }),
    listPorts: async () => PORTS,
  }));

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    await fn(base);
  } finally {
    config.staticDir = previousDir;
    await new Promise((resolve) => server.close(resolve));
  }
}

async function get(base, pathname, init) {
  const res = await fetch(base + pathname, init);
  return { status: res.status, headers: res.headers, body: await res.text() };
}

test('GET /api/health reports the live link and the firmware thresholds', async () => {
  await withServer(async (base) => {
    const { status, body } = await get(base, '/api/health');
    assert.equal(status, 200);

    const health = JSON.parse(body);
    assert.equal(health.ok, true);
    assert.equal(health.demo, false);
    assert.equal(health.link, 'live');
    assert.equal(health.thresholds.warning, 500);
    assert.equal(health.serial.path, 'COM7');
    assert.equal(health.lastReadingAt > 0, true);
  });
});

test('GET /api/snapshot returns everything the dashboard needs in one response', async () => {
  await withServer(async (base) => {
    const { status, body } = await get(base, '/api/snapshot');
    assert.equal(status, 200);

    const snap = JSON.parse(body);
    assert.equal(snap.latest.value, 512);
    assert.equal(snap.latest.severity, 'warning');
    assert.equal(snap.history.length, 1);
    assert.equal(snap.incidents.length, 1);
    assert.equal(snap.stats.sampleCount, 1);
    assert.equal(snap.serial.open, true);
  });
});

test('GET /api/ports lists the serial ports for the UI to choose from', async () => {
  await withServer(async (base) => {
    const { status, body } = await get(base, '/api/ports');
    assert.equal(status, 200);
    assert.deepEqual(JSON.parse(body).ports, PORTS);
  });
});

test('a failing port enumeration is a 500, not a crashed process', async () => {
  const session = new Session();
  const server = http.createServer(createRequestHandler({
    session,
    getStatus: () => SERIAL,
    listPorts: async () => { throw new Error('native module missing'); },
  }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const { status, body } = await get(`http://127.0.0.1:${server.address().port}`, '/api/ports');
  assert.equal(status, 500);
  assert.match(body, /native module missing/);
  await new Promise((resolve) => server.close(resolve));
});

test('an unknown API path is a JSON 404, never the SPA shell', async () => {
  await withServer(async (base) => {
    const { status, body } = await get(base, '/api/nope');
    assert.equal(status, 404);
    assert.equal(JSON.parse(body).error, 'unknown endpoint');
  });
});

test('OPTIONS answers the preflight the browser sends', async () => {
  await withServer(async (base) => {
    const { status, headers } = await get(base, '/api/health', { method: 'OPTIONS' });
    assert.equal(status, 204);
    assert.equal(headers.get('access-control-allow-origin'), '*');
    assert.match(headers.get('access-control-allow-methods'), /GET/);
  });
});

test('a HEAD request gets the headers with no body', async () => {
  await withServer(async (base) => {
    const { status, body } = await get(base, '/api/health', { method: 'HEAD' });
    assert.equal(status, 200);
    assert.equal(body, '');
  });
});

test('the built dashboard is served from the API origin', async () => {
  const parent = makeDist();
  await withServer(async (base) => {
    const { status, headers, body } = await get(base, '/');
    assert.equal(status, 200);
    assert.match(headers.get('content-type'), /text\/html/);
    assert.equal(headers.get('cache-control'), 'no-cache');
    assert.match(body, /<title>GLD<\/title>/);
  }, { staticDir: path.join(parent, 'dist') });
});

test('hashed assets are served immutable', async () => {
  const parent = makeDist();
  await withServer(async (base) => {
    const { status, headers } = await get(base, '/assets/index-abc123.js');
    assert.equal(status, 200);
    assert.match(headers.get('content-type'), /javascript/);
    assert.match(headers.get('cache-control'), /immutable/);
  }, { staticDir: path.join(parent, 'dist') });
});

test('an unknown path falls back to the SPA shell for client-side routing', async () => {
  const parent = makeDist();
  await withServer(async (base) => {
    const { status, body } = await get(base, '/incidents/42');
    assert.equal(status, 200);
    assert.match(body, /<title>GLD<\/title>/);
  }, { staticDir: path.join(parent, 'dist') });
});

test('a missing frontend build explains how to produce one', async () => {
  await withServer(async (base) => {
    const { status, body } = await get(base, '/');
    assert.equal(status, 404);
    assert.equal(JSON.parse(body).error, 'frontend build not found');
  }, { staticDir: path.join(os.tmpdir(), 'gld-does-not-exist') });
});

test('a build directory with no index.html does not crash the bridge', async () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'gld-empty-'));
  await withServer(async (base) => {
    const { status, body } = await get(base, '/');
    assert.equal(status, 404);
    assert.equal(JSON.parse(body).error, 'not found');
  }, { staticDir: empty });
});

test('a traversal attempt never serves a file from outside the build', async () => {
  const parent = makeDist();
  await withServer(async (base) => {
    // %5c is a backslash. URL normalisation leaves this segment intact, so it is
    // the one traversal form that actually reaches the filesystem.
    const { status, body } = await get(base, '/..%5cdist-old%5csecret.txt');
    assert.notEqual(status, 200);
    assert.ok(!body.includes('TOP SECRET'), 'must not leak a file outside the build directory');
  }, { staticDir: path.join(parent, 'dist') });
});

test('a malformed percent-encoded path is a 400, not an exception', async () => {
  const parent = makeDist();
  await withServer(async (base) => {
    const { status, body } = await get(base, '/%zz');
    assert.equal(status, 400);
    assert.equal(JSON.parse(body).error, 'malformed request path');
  }, { staticDir: path.join(parent, 'dist') });
});
