import { EventEmitter } from 'node:events';
import { DEFAULT_THRESHOLDS } from './config.js';

const PHASES = [
  { mean: 300, std: 28, samples: 60 },
  { mean: 640, std: 50, samples: 30 },   // warning event
  { mean: 380, std: 40, samples: 25 },
  { mean: 910, std: 70, samples: 35 },   // danger event
  { mean: 340, std: 32, samples: 25 },
  { mean: 560, std: 45, samples: 22 },   // warning event
  { mean: 310, std: 30, samples: 30 },
  { mean: 880, std: 65, samples: 30 },   // danger event
  { mean: 360, std: 35, samples: 25 },
];

const gaussian = (mean, std) => {
  const u1 = 1 - Math.random();
  const u2 = 1 - Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const stateFor = (value, t) => {
  if (t.warning < value) return 'DANGER';
  if (value >= t.warning) return 'WARNING';
  return 'SAFE';
};

/**
 * Synthetic feed for working on the UI with no board attached.
 *
 * It emits frames in the *exact* wire format the firmware emits, so the demo path
 * goes through the same parser, session state machine and API as real hardware.
 * The only difference is the `source` flag, which the UI renders as a visible
 * "SIMULATED" badge — a demo reading must never be mistaken for a sensor value.
 */
export class DemoSource extends EventEmitter {
  #timer = null;
  #uptimeMs = 0;
  #phase = 0;
  #step = 0;

  constructor({ sampleIntervalMs = 250, warmupSamples = 80 } = {}) {
    super();
    this.sampleIntervalMs = sampleIntervalMs;
    this.warmupSamples = warmupSamples;
    this.thresholds = { ...DEFAULT_THRESHOLDS };
  }

  start() {
    const t = this.thresholds;

    const configLine =
      `#CFG,warn=${t.warning},danger=${t.danger},warnClear=${t.warningClear},`
      + `dangerClear=${t.dangerClear},sampleMs=${this.sampleIntervalMs},adcMax=${t.adcMax}`;
    this.emit('line', configLine);

    this.emit('line', '[WARMUP] MQ-6 stabilising for 20s, blue LED blinks while calibrating');

    this.#timer = setInterval(() => this.#tick(), this.sampleIntervalMs);
    this.#timer.unref?.();
  }

  stop() {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
  }

  #tick() {
    this.#uptimeMs += this.sampleIntervalMs;
    const t = this.thresholds;
    const warming = this.#uptimeMs < this.warmupSamples * this.sampleIntervalMs;

    let value;
    let state;

    if (warming) {
      value = clamp(Math.round(gaussian(240, 90)), 0, t.adcMax);
      state = 'WARMUP';
    } else {
      const phase = PHASES[this.#phase];
      value = clamp(Math.round(gaussian(phase.mean, phase.std)), 0, t.adcMax);
      state = stateFor(value, t);

      this.#step += 1;
      if (this.#step >= phase.samples) {
        this.#step = 0;
        this.#phase = (this.#phase + 1) % PHASES.length;
      }
    }

    this.emit(
      'line',
      `TELEM,gas=${value},state=${state},up=${this.#uptimeMs},rssi=-58,muted=0,warm=${warming ? 1 : 0}`,
    );
  }
}