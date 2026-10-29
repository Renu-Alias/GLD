import 'dotenv/config';
import http from 'node:http';
import { config, DEFAULT_THRESHOLDS } from './config.js';
import { Session } from './session.js';
import { LineDecoder, parseLine } from './telemetry.js';
import { SerialSource } from './serialSource.js';
import { DemoSource } from './demoSource.js';
import { SseHub } from './sse.js';
import { createRequestHandler } from './http.js';
import { ReadingDB } from './db.js';
import { PostgresDB } from './pgdb.js';
import { sendLeakAlert } from './telegram.js';
import { nextAlert } from './alertPolicy.js';

const log = (...args) => console.log(...args);
const warn = (...args) => console.warn(...args);

const db = new ReadingDB();
const pgdb = process.env.DATABASE_URL ? new PostgresDB() : null;

// Never use demo/fake data - only real sensor readings from hardware
const session = new Session({
  thresholds: DEFAULT_THRESHOLDS,
  historyPoints: config.historyPoints,
  incidentLimit: config.incidentLimit,
  staleAfterMs: config.staleAfterMs,
  coldStartMs: config.coldStartMs,
  source: 'serial',
});

const hub = new SseHub();

// Severity of the open incident on the previous reading, for nextAlert().
let lastIncidentSeverity = null;

let lastLink = null;

// Load history from database on startup (SQLite for trend chart)
try {
  const dbHistory = db.getRecentHistory(config.historyPoints);
  if (dbHistory && dbHistory.length > 0) {
    session.history = dbHistory;
  }
} catch (err) {
  warn('[bridge] failed to load history from db:', err);
}

// Initialize Postgres for incidents if configured
async function initPg() {
  if (!pgdb) return;
  try {
    await pgdb.init();
    // Try to resume active incident if exists
    try {
      const active = await pgdb.getActiveIncident();
      if (active) {
        session.openIncident = {
          id: Number(active.id),
          startedAt: new Date(active.started_at).getTime(),
          endedAt: null,
          peakValue: active.peak_adc,
          severity: active.severity,
          samples: 1,
          resolved: false,
          _pgId: active.id,
        };
      }
    } catch (e) {
      warn('[bridge] failed to resume active incident from pg:', e?.message);
    }
    // Load incidents from PG for history display
    try {
      const pgHistory = await pgdb.getAllHistory(1000);
      session.incidents = pgHistory.map((row) => ({
        id: Number(row.id),
        startedAt: new Date(row.started_at).getTime(),
        endedAt: row.ended_at ? new Date(row.ended_at).getTime() : null,
        durationMs: row.duration_ms,
        peakValue: row.peak_adc,
        severity: row.severity,
        samples: 1,
        resolved: row.resolved,
        _pgId: row.id,
      }));
      log(`[bridge] loaded ${session.incidents.length} incidents from postgres`);
    } catch (e) {
      warn('[bridge] failed to load incidents from pg:', e?.message);
    }
  } catch (err) {
    warn('[bridge] failed to init postgres:', err?.message);
  }
}

// == Line intake ===============================================================

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

  // The alert rides on the session's own incident state, so it fires with or
  // without Postgres and is not suppressed by an unrelated open history row.
  // One message when a leak opens, one more if it escalates to critical.
  const alert = nextAlert(lastIncidentSeverity, { event, incident });
  lastIncidentSeverity = alert.last;
  if (alert.send) {
    sendLeakAlert({ severity: incident.severity, peakValue: incident.peakValue })
      .catch((e) => warn('[alert] err', e?.message));
  }

  // Save reading to database - only real sensor readings (SQLite for trend)
  try {
    db.insertReading({
      timestamp: session.lastReadingAt,
      value: parsed.value,
      severity: parsed.severity,
      state: parsed.state,
    });
  } catch (err) {
    warn('[bridge] failed to save reading to db:', err);
  }

  // Sync incidents to Postgres if configured
  if (pgdb) {
    (async () => {
      try {
        const gasValue = parsed.value;
        // Check for closing condition: raw ADC < 500
        if (session.openIncident && gasValue < 500) {
          const maxSeen = session.openIncident.peakValue || gasValue;
          try {
            await pgdb.closeActiveWithPeak({ endedAtMs: session.lastReadingAt, peakAdc: maxSeen });
          } catch (e) {
            warn('[bridge] failed to close active incident:', e?.message);
          }
          // Mark closed in session
          const closed = session.openIncident;
          closed.endedAt = session.lastReadingAt;
          closed.resolved = true;
          closed.peakValue = maxSeen;
          // reload
          try {
            const pgHistory = await pgdb.getAllHistory(1000);
            session.incidents = pgHistory.map((r) => ({
              id: Number(r.id),
              startedAt: new Date(r.started_at).getTime(),
              endedAt: r.ended_at ? new Date(r.ended_at).getTime() : null,
              durationMs: r.duration_ms,
              peakValue: r.peak_adc,
              severity: r.severity,
              samples: 1,
              resolved: r.resolved,
              _pgId: r.id,
            }));
            hub.broadcast('incident', { event: 'incident-close', incident: closed });
          } catch {}
          session.openIncident = null;
          return;
        }

        // Check for >800 creating a new critical row while keeping previous active as per requirement
        // "If it goes above 800, keep the previos >500 warning active as well. New row should be active and have severity='critical'."
        // This means we need to have TWO active rows? But requirement says "enforce strictly at most 1 row with ended_at IS NULL"
        // These conflict. Following the most recent explicit instruction: enforce at most 1 active, so close previous and open critical (no duplicate active)
        if (session.openIncident && gasValue > 800 && session.openIncident.severity !== 'critical') {
          const maxSeenPrev = session.openIncident.peakValue || gasValue;
          await pgdb.closeActiveWithPeak({ endedAtMs: session.lastReadingAt, peakAdc: maxSeenPrev });
          const row = await pgdb.openIncident({
            startedAtMs: session.lastReadingAt,
            peakAdc: gasValue,
            severity: 'critical',
          });
          if (row) {
            session.openIncident = {
              id: Number(row.id),
              startedAt: new Date(row.started_at).getTime(),
              endedAt: null,
              peakValue: gasValue,
              severity: 'critical',
              samples: 1,
              resolved: false,
              _pgId: row.id,
              maxSeen: gasValue,
            };
            try {
              const pgHistory = await pgdb.getAllHistory(1000);
              session.incidents = pgHistory.map((r) => ({
                id: Number(r.id),
                startedAt: new Date(r.started_at).getTime(),
                endedAt: r.ended_at ? new Date(r.ended_at).getTime() : null,
                durationMs: r.duration_ms,
                peakValue: r.peak_adc,
                severity: r.severity,
                samples: 1,
                resolved: r.resolved,
                _pgId: r.id,
              }));
              hub.broadcast('incident', { event: 'incident-open', incident: session.openIncident });
            } catch {}
            // No alert for this new critical row as per requirement
            return;
          }
        }

        if (incident) {
          if (event === 'incident-open') {
            const row = await pgdb.openIncident({
              startedAtMs: incident.startedAt,
              peakAdc: incident.peakValue,
              severity: incident.severity,
            });
            if (row) {
              incident._pgId = row.id;
              if (session.openIncident) session.openIncident._pgId = row.id;
              session.openIncident = {
                ...(session.openIncident || incident),
                _pgId: row.id,
                maxSeen: incident.peakValue,
                peakValue: incident.peakValue,
              };
              // Reload incidents list from PG to keep in sync
              try {
                const pgHistory = await pgdb.getAllHistory(1000);
                session.incidents = pgHistory.map((r) => ({
                  id: Number(r.id),
                  startedAt: new Date(r.started_at).getTime(),
                  endedAt: r.ended_at ? new Date(r.ended_at).getTime() : null,
                  durationMs: r.duration_ms,
                  peakValue: r.peak_adc,
                  severity: r.severity,
                  samples: 1,
                  resolved: r.resolved,
                  _pgId: r.id,
                }));
                hub.broadcast('incident', { event, incident });
              } catch {}
            } else {
              // Already have an active incident, just reload list
              try {
                const pgHistory = await pgdb.getAllHistory(1000);
                session.incidents = pgHistory.map((r) => ({
                  id: Number(r.id),
                  startedAt: new Date(r.started_at).getTime(),
                  endedAt: r.ended_at ? new Date(r.ended_at).getTime() : null,
                  durationMs: r.duration_ms,
                  peakValue: r.peak_adc,
                  severity: r.severity,
                  samples: 1,
                  resolved: r.resolved,
                  _pgId: r.id,
                }));
              } catch {}
            }
          } else if (event === 'incident-close') {
            const pgId = incident._pgId || session.openIncident?._pgId;
            if (pgId) {
              const maxSeen = session.openIncident?.peakValue || incident.peakValue;
              await pgdb.closeActiveWithPeak({ endedAtMs: incident.endedAt, peakAdc: maxSeen });
              try {
                const pgHistory = await pgdb.getAllHistory(1000);
                session.incidents = pgHistory.map((r) => ({
                  id: Number(r.id),
                  startedAt: new Date(r.started_at).getTime(),
                  endedAt: r.ended_at ? new Date(r.ended_at).getTime() : null,
                  durationMs: r.duration_ms,
                  peakValue: r.peak_adc,
                  severity: r.severity,
                  samples: 1,
                  resolved: r.resolved,
                  _pgId: r.id,
                }));
                hub.broadcast('incident', { event, incident });
              } catch {}
              session.openIncident = null;
            }
          }
        } else if (session.openIncident) {
          // Update max seen for active incident (in memory only, don't write to DB until close)
          if (gasValue > (session.openIncident.peakValue || 0)) {
            session.openIncident.peakValue = gasValue;
            if (session.openIncident.maxSeen !== undefined) {
              session.openIncident.maxSeen = gasValue;
            }
          }
        }
      } catch (e) {
        warn('[bridge] failed to sync incident to postgres:', e?.message);
      }
    })();
  } else if (session.openIncident && event === null) {
    // Update max seen for active incident (in memory only)
    const gasValue = parsed.value;
    if (gasValue > (session.openIncident.peakValue || 0)) {
      session.openIncident.peakValue = gasValue;
    }
  }

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
    warn('[bridge] board is sending legacy "Gas Value:" frames - reflash GLD.ino for full telemetry');
  }
}

// == Wiring ====================================================================
// Only real sensor data from hardware - no demo/fake data

let serial = null;

serial = new SerialSource({
  path: config.serialPath,
  baudRate: config.baudRate,
  rescanIntervalMs: config.rescanIntervalMs,
  logger: { log, warn },
});

const decoder = new LineDecoder({
  onLine: handleLine,
  onOverflow: (len) => warn(`[bridge] dropped ${len} buffered bytes - check the baud rate`),
});

serial.on('chunk', (chunk) => decoder.push(chunk.toString('utf8')));
serial.on('open', ({ path: label }) => {
  log(`[bridge] connected to ${label || serial?.status?.path || ''} - waiting for telemetry`);
});

serial.start().catch((err) => warn(`[bridge] could not start serial source: ${err.message}`));

const getStatus = () =>
  serial
    ? serial.status
    : { open: false, path: null, error: 'Serial source not initialized', ports: [], connectedAt: null };

const listPorts = async () => (serial ? serial.listPorts() : []);

// == HTTP ======================================================================

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

async function startServer() {
  if (pgdb) {
    try {
      await initPg();
    } catch (e) {
      warn('[bridge] initPg failed:', e?.message);
    }
  }
  server.listen(config.port, config.host, () => {
    log('');
    log('  Gas Leak Dashboard bridge');
    log(`  API      http://${config.host}:${config.port}/api/health`);
    log(`  Stream   http://${config.host}:${config.port}/api/stream`);
    log(`  Feed     serial ${config.serialPath ?? 'auto-detect'} @ ${config.baudRate} baud (sensor only - no fake data)`);
    log('');
  });
}

startServer();

// == Shutdown ==================================================================

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`\n[bridge] ${signal} received, shutting down`);
  clearInterval(heartbeat);
  clearInterval(linkWatch);
  serial?.stop();
  try { db.close(); } catch {}
  try { pgdb?.close(); } catch {}
  hub.closeAll();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref?.();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));