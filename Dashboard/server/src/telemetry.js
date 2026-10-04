/**
 * Parsers for the line protocol the ESP32 writes to USB serial at 115200 baud.
 *
 * Primary frame (emitted once per ADC sample by GLD.ino):
 *   TELEM,gas=512,state=WARNING,up=123456,rssi=-62,muted=0,warm=0
 *
 * Boot banner (emitted once, so the UI uses the firmware's real thresholds):
 *   #CFG,warn=500,danger=800,warnClear=420,dangerClear=700,sampleMs=250,adcMax=1023
 *
 * A legacy frame is also accepted so the dashboard still works against a board
 * flashed with firmware from before telemetry was added:
 *   Gas Value: 512 state: WARNING
 *
 * Everything here is pure so it can be unit tested without hardware.
 */

export const STATE = {
  WARMUP: 'WARMUP',
  SAFE: 'SAFE',
  WARNING: 'WARNING',
  DANGER: 'DANGER',
  UNKNOWN: 'UNKNOWN',
};

/** Firmware alarm state -> the severity vocabulary the React components use. */
export function severityForState(state) {
  switch (state) {
    case STATE.DANGER:
      return 'critical';
    case STATE.WARNING:
      return 'warning';
    default:
      // WARMUP and SAFE are both "not an incident".
      return 'normal';
  }
}

export function isIncidentState(state) {
  return state === STATE.WARNING || state === STATE.DANGER;
}

function parseKvPairs(body) {
  const out = {};
  for (const part of body.split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return out;
}

function toInt(value) {
  if (value === undefined || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/** `TELEM,...` -> reading object, or null if this is not a telemetry frame. */
export function parseTelemetry(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('TELEM,')) return null;

  const kv = parseKvPairs(trimmed.slice('TELEM,'.length));
  const gas = toInt(kv.gas);
  if (gas === null) return null;

  const state = (kv.state || STATE.UNKNOWN).toUpperCase();
  const muted = kv.muted === '1';
  const warm = kv.warm === '1';

  return {
    kind: 'reading',
    source: 'telemetry',
    value: gas,
    state,
    severity: severityForState(state),
    warmup: warm,
    muted,
    // WARMUP frames are not incidents even if the raw ADC count is high: the
    // sensor is unstabilised and the firmware ignores readings at this point.
    countsAsIncident: !warm && isIncidentState(state),
    uptimeMs: toInt(kv.up),
    rssi: toInt(kv.rssi),
  };
}

/** `#CFG,...` -> partial threshold set, or null. */
export function parseConfig(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('#CFG,')) return null;

  const kv = parseKvPairs(trimmed.slice('#CFG,'.length));
  const thresholds = {
    warning: toInt(kv.warn),
    warningClear: toInt(kv.warnClear),
    danger: toInt(kv.danger),
    dangerClear: toInt(kv.dangerClear),
    adcMax: toInt(kv.adcMax),
  };
  const sampleMs = toInt(kv.sampleMs);

  for (const [key, value] of Object.entries(thresholds)) {
    if (value === null) delete thresholds[key];
  }

  return {
    kind: 'config',
    thresholds,
    sampleIntervalMs: sampleMs,
  };
}

const LEGACY_RE = /^Gas Value:\s*(\d+)(?:\s*state:\s*(\w+))?/i;

/**
 * `Gas Value: 512 state: WARNING` -> reading object, or null.
 *
 * These lines are rate limited in the firmware (2.5 s while alarming, 10 s while
 * safe) so the dashboard samples noticeably slower against legacy firmware. That
 * is a property of the frame rate, not a defect in the parser.
 */
export function parseLegacy(line) {
  const match = LEGACY_RE.exec(line.trim());
  if (!match) return null;

  const gas = Number.parseInt(match[1], 10);
  if (!Number.isFinite(gas)) return null;

  const state = (match[2] || STATE.UNKNOWN).toUpperCase();
  return {
    kind: 'reading',
    source: 'legacy',
    value: gas,
    state,
    severity: severityForState(state),
    warmup: state === STATE.WARMUP,
    muted: false,
    countsAsIncident: isIncidentState(state),
    uptimeMs: null,
    rssi: null,
  };
}

export function parseLine(line) {
  return parseTelemetry(line) ?? parseConfig(line) ?? parseLegacy(line);
}

/**
 * Reassembles arbitrarily chunked serial bytes into complete lines.
 * The firmware writes frames with several `Serial.print` calls, so a USB read
 * can land mid-frame; nothing may be parsed until its newline has arrived.
 */
export class LineDecoder {
  #buffer = '';

  constructor({ onLine, onOverflow } = {}) {
    this.onLine = onLine ?? (() => {});
    this.onOverflow = onOverflow ?? (() => {});
  }

  push(chunk) {
    this.#buffer += chunk;

    if (this.#buffer.length > 8192) {
      // Runaway garbage (wrong baud rate, another program on the port).
      this.onOverflow(this.#buffer.length);
      this.#buffer = this.#buffer.slice(-1024);
    }

    let newline = this.#buffer.indexOf('\n');
    while (newline !== -1) {
      const line = this.#buffer.slice(0, newline).replace(/\r$/, '');
      this.#buffer = this.#buffer.slice(newline + 1);
      if (line.length > 0) this.onLine(line);
      newline = this.#buffer.indexOf('\n');
    }
  }

  get pending() {
    return this.#buffer.length;
  }
}