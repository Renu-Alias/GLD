import { DEFAULT_THRESHOLDS } from './config.js';
import { STATE, severityForState, isIncidentState } from './telemetry.js';

/**
 * Mirrors the firmware's hysteresis so that legacy frames — which carry no state
 * field — still produce an incident log that matches what the hardware actually
 * did, instead of chattering at the raw trip threshold.
 */
class HysteresisClassifier {
  #state = STATE.SAFE;

  constructor(thresholds) {
    this.update_thresholds(thresholds);
  }

  update_thresholds({ warning, warningClear, danger, dangerClear }) {
    this.warning = warning ?? this.warning;
    this.warningClear = warningClear ?? this.warningClear;
    this.danger = danger ?? this.danger;
    this.dangerClear = dangerClear ?? this.dangerClear;
  }

  update(value) {
    if (this.#state === STATE.DANGER) {
      if (value < this.dangerClear) this.#state = STATE.WARNING;
    } else if (this.#state === STATE.WARNING) {
      if (value >= this.danger) this.#state = STATE.DANGER;
      else if (value < this.warningClear) this.#state = STATE.SAFE;
    } else if (value >= this.danger) {
      this.#state = STATE.DANGER;
    } else if (value >= this.warning) {
      this.#state = STATE.WARNING;
    }
    return this.#state;
  }

  /**
   * Adopts a state reported by the firmware. Without this, a stream that mixes
   * telemetry frames (authoritative state) with legacy frames (no state) would
   * classify the legacy ones against a classifier that had never seen the
   * telemetry, and the incident log would show phantom re-openings.
   */
  sync(state) {
    if (isIncidentState(state)) this.#state = state;
    else if (state === STATE.SAFE) this.#state = STATE.SAFE;
    return this.#state;
  }

  get state() {
    return this.#state;
  }
}

let nextIncidentId = 1;

/**
 * Turns a stream of readings into everything the dashboard renders: the latest
 * value, the trend ring buffer, the incident log and session stats.
 *
 * Stateful and deliberately free of I/O so it can be tested by feeding it lines.
 */
export class Session {
  constructor({
    thresholds = DEFAULT_THRESHOLDS,
    historyPoints = 720,
    incidentLimit = 100,
    staleAfterMs = 3000,
    coldStartMs = 15000,
    source = 'serial',
    now = Date.now,
  } = {}) {
    this.now = now;
    this.thresholds = { ...thresholds };
    this.historyPoints = historyPoints;
    this.incidentLimit = incidentLimit;
    this.staleAfterMs = staleAfterMs;
    this.coldStartMs = coldStartMs;
    this.source = source;

    this.reset();
  }

  reset() {
    this.createdAt = this.now();
    this.history = [];
    this.incidents = [];
    this.openIncident = null;
    this.latest = null;
    this.sampleCount = 0;
    this.peakValue = 0;
    this.sumValue = 0;
    this.startedAt = null;
    this.lastReadingAt = null;
    this.frameSource = null;
    this.warmup = false;
    this.muted = false;
    this.rssi = null;
    this.uptimeMs = null;
    this.warnedLegacy = false;
    this.classifier = new HysteresisClassifier(this.thresholds);
  }

  /** Accepts a partial set from the firmware #CFG banner. */
  setThresholds(partial) {
    if (!partial) return;
    const next = { ...this.thresholds };
    for (const [key, value] of Object.entries(partial)) {
      if (typeof value === 'number' && Number.isFinite(value)) next[key] = value;
    }
    this.thresholds = next;
    this.classifier.update_thresholds(next);
  }

  /**
   * @param {object} reading a `kind: 'reading'` frame from parseLine()
   * @returns {{ event: 'incident-open'|'incident-close'|null, incident?: object }}
   */
  ingest(reading) {
    if (!reading || reading.kind !== 'reading') return { event: null };

    const at = this.now();

    // A frame without a state field (legacy firmware) is classified locally;
    // a frame with one is authoritative, so the classifier is synced to it.
    let { state, severity, countsAsIncident } = reading;
    if (state === STATE.UNKNOWN) {
      state = this.classifier.update(reading.value);
      severity = severityForState(state);
      countsAsIncident = isIncidentState(state);
    } else {
      this.classifier.sync(state);
    }

    this.startedAt ??= at;
    this.lastReadingAt = at;
    this.frameSource = reading.source;
    this.sampleCount += 1;
    this.peakValue = Math.max(this.peakValue, reading.value);
    this.sumValue += reading.value;
    this.warmup = Boolean(reading.warmup);
    this.muted = Boolean(reading.muted);
    if (reading.rssi !== null && reading.rssi !== undefined) this.rssi = reading.rssi;
    if (reading.uptimeMs !== null && reading.uptimeMs !== undefined) {
      this.uptimeMs = reading.uptimeMs;
    }

    this.history.push({ t: at, value: reading.value, severity });
    if (this.history.length > this.historyPoints) {
      this.history.splice(0, this.history.length - this.historyPoints);
    }

    const event = this.#trackIncident({
      at,
      value: reading.value,
      severity,
      countsAsIncident,
    });

    this.latest = {
      value: reading.value,
      severity,
      state,
      warmup: this.warmup,
      muted: this.muted,
      at,
    };

    return { event: event?.type ?? null, incident: event?.incident ?? null };
  }

  #trackIncident({ at, value, severity, countsAsIncident }) {
    if (countsAsIncident) {
      if (!this.openIncident) {
        this.openIncident = {
          id: nextIncidentId++,
          startedAt: at,
          endedAt: null,
          peakValue: value,
          severity,
          samples: 1,
          resolved: false,
        };
        this.incidents.unshift(this.openIncident);
        this.#trimIncidents();
        return { type: 'incident-open', incident: this.openIncident };
      }

      this.openIncident.peakValue = Math.max(this.openIncident.peakValue, value);
      this.openIncident.samples += 1;
      if (severity === 'critical') this.openIncident.severity = 'critical';
      return { type: null, incident: this.openIncident };
    }

    if (this.openIncident) {
      const closed = this.openIncident;
      closed.endedAt = at;
      closed.resolved = true;
      this.openIncident = null;
      return { type: 'incident-close', incident: closed };
    }

    return { type: null };
  }

  #trimIncidents() {
    if (this.incidents.length > this.incidentLimit) {
      this.incidents.length = this.incidentLimit;
    }
  }

  /** Link health: is the board actually talking right now? */
  linkState(at = this.now()) {
    if (this.lastReadingAt === null) {
      return at - this.createdAt < this.coldStartMs ? 'waiting' : 'no-data';
    }
    return at - this.lastReadingAt > this.staleAfterMs ? 'stale' : 'live';
  }

  serializeIncident(incident) {
    const endedAt = incident.endedAt ?? this.lastReadingAt ?? incident.startedAt;
    return {
      id: incident.id,
      startedAt: incident.startedAt,
      endedAt: incident.endedAt,
      durationMs: Math.max(0, endedAt - incident.startedAt),
      peakValue: incident.peakValue,
      severity: incident.severity,
      samples: incident.samples,
      resolved: incident.resolved,
    };
  }

  snapshot(at = this.now()) {
    const link = this.linkState(at);
    const samples = this.sampleCount;

    return {
      source: this.source,
      frameSource: this.frameSource,
      link,
      isDemo: this.source === 'demo',
      thresholds: this.thresholds,
      latest: this.latest,
      history: this.history,
      incidents: this.incidents.map((i) => this.serializeIncident(i)),
      stats: {
        sampleCount: samples,
        peakValue: this.peakValue,
        meanValue: samples > 0 ? Math.round(this.sumValue / samples) : null,
        startedAt: this.startedAt,
        lastReadingAt: this.lastReadingAt,
      },
      device: {
        warmup: this.warmup,
        muted: this.muted,
        rssi: this.rssi,
        uptimeMs: this.uptimeMs,
      },
    };
  }
}