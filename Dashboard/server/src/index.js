import http from 'node:http';
import { config, DEFAULT_THRESHOLDS } from './config.js';
import { Session } from './session.js';
import { LineDecoder, parseLine } from './telemetry.js';
import { SerialSource } from './serialSource.js';
import { DemoSource } from './demoSource.js';
import { SseHub } from './sse.js';
import { createRequestHandler } from './http.js';

const log = (...args) => console.log(...args);
const warn = (...args) => console.warn(...args);

const session = new Session({
  thresholds: DEFAULT_THRESHOLDS,
  historyPoints: config.historyPoints,
  incidentLimit: config.incidentLimit,
  staleAfterMs: config.staleAfterMs,
  coldStartMs: config.coldStartMs,
  source: config.demo ? 'demo' : 'serial',
});

const hub = new SseHub();

let lastLink = null;

// ── Line intake ───────────────────────────────────────────────────────────────

function handleLine(line) {
  const parsed = parseLine(line);

  if (!parsed) return;

  if (parsed.kind === 'config') {
    session.setThresholds(parsed.thresholds);
    if (parsed.sampleIntervalMs) {
      log(`[bridge] firmware config: ${JSON.stringify(parsed.thresholds)} `
        + `sample ${parsed.sampleIntervalMs}ms`);
    }
    hub.broadcast('config', {
      thresholds: session.thresholds,
      sampleIntervalMs: parsed.sampleIntervalMs,
    });
    return;
  }

  const { event, incident } = session.ingest(parsed);

  hub.broadcast('reading', {
    value: parsed.value,
    severity: parsed.severity,
    state: parsed.state,
    warmup: parsed.warmup,
    muted: parsed.muted,
    rssi: parsed.rssi,
    uptimeMs: parsed.uptimeMs,
    at: session.lastReadingAt,
  });

  if (event) hub.broadcast('incident', { event, incident });

  if (parsed.source === 'legacy' && !session.warnedLegacy) {
    session.warnedLegacy = true;
    warn('[bridge] board is sending legacy "Gas Value:" frames — reflash GLD.ino for full telemetry');
  }
}

// ── Wiring ────────────────────────────────────────────────────────────────────

let serial = null;
let demo = null;

if (config.demo) {
  warn('[bridge] DEMO MODE — readings are synthetic, not from a sensor.');
  demo = new DemoSource();
  demo.on('line', handleLine);
  demo.start();
} else {
  serial = new SerialSource({
    path: config.serialPath,
    baudRate: config.baudRate,
    rescanIntervalMs: config.rescanIntervalMs,
    logger: { log, warn },
  });

  const decoder = new LineDecoder({
    onLine: handleLine,
    onOverflow: (len) => warn(`[bridge] dropped ${len} buffered bytes — check the baud rate`),
  });

  serial.on('chunk', (chunk) => decoder.push(chunk.toString('utf8')));
  serial.on('open', ({ path: label }) => {
    log(`[bridge] connected to ${path}${label ? ` (${label})` : ''} — waiting for telemetry`);
  });

  serial.start().catch((err) => warn(`[bridge] could not start serial source: ${err.message}`));
}

const getStatus = () =>
  serial
    ? serial.status
    : { open: true, path: 'synthetic (demo)', error: null, ports: [], connectedAt: null };

const listPorts = async () => (serial ? serial.listPorts() : []);

// ── HTTP ──────────────────────────────────────────────────────────────────────

const handler = createRequestHandler({ session, getStatus, listPorts });

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/stream') {
    hub.addClient(req, res, { ...session.snapshot(), serial: getStatus() });
    return;
  }

  handler(req, res);
});

const heartbeat = setInterval(() => hub.heartbeat(), 15000);
heartbeat.unref?.();

// The link badge in the UI is derived from reading freshness; tell the browser
// when that verdict flips even though no new frame arrived to trigger a push.
const linkWatch = setInterval(() => {
  const link = session.linkState();
  if (link !== lastLink) {
    if (lastLink !== null) hub.broadcast('link', { link });
    lastLink = link;
  }
}, 500);
linkWatch.unref?.();

server.listen(config.port, config.host, () => {
  log('');
  log('  Gas Leak Dashboard bridge');
  log(`  API      http://${config.host}:${config.port}/api/health`);
  log(`  Stream   http://${config.host}:${config.port}/api/stream`);
  log(`  Feed     ${config.demo ? 'synthetic (DEMO MODE)' : `serial ${config.serialPath ?? 'auto-detect'} @ ${config.baudRate} baud`}`);
  log('');
});

// ── Shutdown ──────────────────────────────────────────────────────────────────

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`\n[bridge] ${signal} received, shutting down`);
  clearInterval(heartbeat);
  clearInterval(linkWatch);
  serial?.stop();
  demo?.stop();
  hub.closeAll();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref?.();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));