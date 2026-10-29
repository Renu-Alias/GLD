import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LineDecoder,
  parseConfig,
  parseLegacy,
  parseLine,
  parseTelemetry,
  severityForState,
} from '../src/telemetry.js';

test('parses a telemetry frame', () => {
  const r = parseTelemetry('TELEM,gas=512,state=WARNING,up=123456,rssi=-62,muted=0,warm=0');
  assert.equal(r.value, 512);
  assert.equal(r.state, 'WARNING');
  assert.equal(r.severity, 'warning');
  assert.equal(r.uptimeMs, 123456);
  assert.equal(r.rssi, -62);
  assert.equal(r.muted, false);
  assert.equal(r.warmup, false);
  assert.equal(r.countsAsIncident, true);
});

test('a DANGER frame is a critical incident', () => {
  const r = parseTelemetry('TELEM,gas=901,state=DANGER,up=9000,rssi=-50,muted=1,warm=0');
  assert.equal(r.severity, 'critical');
  assert.equal(r.muted, true);
  assert.equal(r.countsAsIncident, true);
});

test('a WARMUP frame is never an incident, however high the raw count', () => {
  const r = parseTelemetry('TELEM,gas=990,state=WARMUP,up=2000,rssi=-70,muted=0,warm=1');
  assert.equal(r.severity, 'normal');
  assert.equal(r.warmup, true);
  assert.equal(r.countsAsIncident, false);
});

test('a SAFE frame is not an incident', () => {
  const r = parseTelemetry('TELEM,gas=300,state=SAFE,up=20000,rssi=-60,muted=0,warm=0');
  assert.equal(r.severity, 'normal');
  assert.equal(r.countsAsIncident, false);
});

test('field order does not matter and missing fields become null', () => {
  const r = parseTelemetry('TELEM,state=SAFE,gas=42');
  assert.equal(r.value, 42);
  assert.equal(r.uptimeMs, null);
  assert.equal(r.rssi, null);
});

test('ignores a telemetry frame with no numeric gas reading', () => {
  assert.equal(parseTelemetry('TELEM,state=SAFE'), null);
});

test('parses the boot config banner', () => {
  const c = parseConfig('#CFG,warn=500,danger=800,warnClear=420,dangerClear=700,sampleMs=250,adcMax=1023');
  assert.deepEqual(c.thresholds, {
    warning: 500,
    warningClear: 420,
    danger: 800,
    dangerClear: 700,
    adcMax: 1023,
  });
  assert.equal(c.sampleIntervalMs, 250);
});

test('parses legacy pre-telemetry firmware output', () => {
  const r = parseLegacy('Gas Value: 512 state: WARNING');
  assert.equal(r.value, 512);
  assert.equal(r.state, 'WARNING');
  assert.equal(r.severity, 'warning');
  assert.equal(r.source, 'legacy');
});

test('legacy line without a state still yields the value', () => {
  const r = parseLegacy('Gas Value: 300');
  assert.equal(r.value, 300);
  assert.equal(r.state, 'UNKNOWN');
});

test('severity mapping covers every firmware state', () => {
  assert.equal(severityForState('WARMUP'), 'normal');
  assert.equal(severityForState('SAFE'), 'normal');
  assert.equal(severityForState('WARNING'), 'warning');
  assert.equal(severityForState('DANGER'), 'critical');
  assert.equal(severityForState('nonsense'), 'normal');
});

test('parseLine returns null for non-telemetry output', () => {
  assert.equal(parseLine('[WIFI] connected, ip: 192.168.1.44'), null);
  assert.equal(parseLine('ets Jun  8 2016 00:22:57'), null);
  assert.equal(parseLine(''), null);
});

test('reassembles frames split across USB reads', () => {
  const lines = [];
  const decoder = new LineDecoder({ onLine: (l) => lines.push(l) });

  decoder.push('TELEM,gas=1,state=SAFE,up=1,rssi=-60,muted=0,warm=0\nTELEM,gas=2,sta');
  assert.equal(lines.length, 1, 'must not emit the incomplete frame');

  decoder.push('te=SAFE,up=2,rssi=-60,muted=0,warm=0\r\n');
  assert.equal(lines.length, 2);
  assert.equal(parseLine(lines[1]).value, 2, 'trailing CR must be stripped');
});

test('handles several frames arriving in one read', () => {
  const lines = [];
  const decoder = new LineDecoder({ onLine: (l) => lines.push(l) });
  decoder.push('TELEM,gas=1,state=SAFE\nTELEM,gas=2,state=SAFE\nTELEM,gas=3,state=SAFE\n');
  assert.equal(lines.length, 3);
});

test('drops blank lines', () => {
  const lines = [];
  new LineDecoder({ onLine: (l) => lines.push(l) }).push('\n\r\nTELEM,gas=1,state=SAFE\n');
  assert.equal(lines.length, 1);
});

test('resets the buffer on garbage overrun instead of growing forever', () => {
  let overflowed = 0;
  const decoder = new LineDecoder({ onLine: () => {}, onOverflow: () => overflowed++ });
  decoder.push('x'.repeat(9000));
  assert.equal(overflowed, 1);
  assert.ok(decoder.pending < 2000);
});