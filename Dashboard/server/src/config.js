import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const num = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Thresholds fall back to the values compiled into GLD.ino. Once the board boots
 * it sends a #CFG line and these get replaced by whatever the firmware actually
 * uses, so the dashboard can never render a threshold the sensor is not using.
 */
export const DEFAULT_THRESHOLDS = {
  warning: 500,
  warningClear: 420,
  danger: 800,
  dangerClear: 700,
  adcMax: 1023,
};

export const config = {
  host: process.env.HOST || '127.0.0.1',
  port: num(process.env.PORT, 4310),

  /** Explicit port, e.g. COM7. When null the board is auto-detected. */
  serialPath: process.env.SERIAL_PORT || null,
  baudRate: num(process.env.BAUD, 115200),

  /** Re-scan for the board every N ms while disconnected. */
  rescanIntervalMs: num(process.env.RESCAN_MS, 2000),

  /** A reading older than this marks the feed stale (firmware blocks ~5s on SMS). */
  staleAfterMs: num(process.env.STALE_MS, 3000),

  /** No reading ever seen within this window -> "waiting for board". */
  coldStartMs: num(process.env.COLD_START_MS, 15000),

  /** Ring buffer depth handed to the UI. 720 samples x 250ms ~= last 3 minutes. */
  historyPoints: num(process.env.HISTORY_POINTS, 720),

  /** Newest-first incident log cap. */
  incidentLimit: num(process.env.INCIDENT_LIMIT, 100),

  /** Synthetic feed for UI work with no board attached. Never on by default. */
  demo: process.argv.includes('--demo') || process.env.DEMO === '1',

  staticDir: path.resolve(here, '..', 'frontend', 'dist'),
};