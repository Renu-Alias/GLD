import test from 'node:test';
import assert from 'node:assert/strict';
import { Session } from '../src/session.js';
import { parseLine } from '../src/telemetry.js';

let clock = 1_700_000_000_000;
const now = () => clock;
const tick = (ms = 250) => { clock += ms; };

function feed(session, value, state, stepMs = 250) {
  tick(stepMs);
  return session.ingest(parseLine(
    `TELEM,gas=${value},state=${state},up=${clock},rssi=-60,muted=0,warm=0`,
  ));
}

function fresh() {
  clock = 1_700_000_000_000;
  return new Session({ now, historyPoints: 5, incidentLimit: 3, staleAfterMs: 3000 });
}

test('tracks the latest reading', () => {
  const s = fresh();
  feed(s, 300, 'SAFE');
  feed(s, 512, 'WARNING');
  assert.equal(s.latest.value, 512);
  assert.equal(s.latest.severity, 'warning');
  assert.equal(s.sampleCount, 2);
});

test('history is capped at historyPoints', () => {
  const s = fresh();
  for (let i = 0; i < 12; i++) feed(s, 300 + i, 'SAFE');
  assert.equal(s.history.length, 5);
  assert.equal(s.history.at(-1).value, 311);
});

test('opens an incident on the first non-safe frame and closes it on return to safe', () => {
  const s = fresh();
  feed(s, 300, 'SAFE');
  assert.equal(s.incidents.length, 0);

  const open = feed(s, 620, 'WARNING');
  assert.equal(open.event, 'incident-open');
  assert.equal(s.incidents.length, 1);
  assert.equal(s.incidents[0].resolved, false);
  assert.equal(s.incidents[0].severity, 'warning');

  feed(s, 650, 'WARNING');
  const close = feed(s, 350, 'SAFE');
  assert.equal(close.event, 'incident-close');
  assert.equal(s.incidents.length, 1);
  assert.equal(s.incidents[0].resolved, true);
  assert.equal(s.incidents[0].peakValue, 650);
});

test('consecutive alarm frames stay one incident and do not re-open', () => {
  const s = fresh();
  feed(s, 620, 'WARNING');
  const second = feed(s, 640, 'WARNING');
  assert.equal(second.event, null);
  assert.equal(s.incidents.length, 1);
  assert.equal(s.incidents[0].samples, 2);
});

test('an incident escalates to critical but keeps its identity', () => {
  const s = fresh();
  feed(s, 620, 'WARNING');
  feed(s, 900, 'DANGER');
  assert.equal(s.incidents.length, 1);
  assert.equal(s.incidents[0].severity, 'critical');
});

test('incident duration comes from real timestamps', () => {
  const s = fresh();
  feed(s, 620, 'WARNING', 250);
  feed(s, 630, 'WARNING', 250);
  feed(s, 640, 'WARNING', 250);
  feed(s, 300, 'SAFE', 250);
  const inc = s.snapshot().incidents[0];
  assert.equal(inc.durationMs, 750);
  assert.equal(inc.samples, 3);
});

test('an unresolved incident serialises its live duration as zero', () => {
  const s = fresh();
  feed(s, 620, 'WARNING');
  feed(s, 630, 'WARNING');
  assert.equal(s.snapshot().incidents[0].resolved, false);
});

test('incident log is capped newest first', () => {
  const s = fresh();
  for (let i = 0; i < 5; i++) {
    feed(s, 620, 'WARNING');
    feed(s, 300, 'SAFE');
  }
  assert.equal(s.incidents.length, 3);
  assert.ok(s.incidents[0].startedAt > s.incidents[1].startedAt);
});

test('warmup frames never open an incident', () => {
  const s = fresh();
  const r = s.ingest(parseLine('TELEM,gas=980,state=WARMUP,up=5000,rssi=-70,muted=0,warm=1'));
  assert.equal(r.event, null);
  assert.equal(s.incidents.length, 0);
  assert.equal(s.snapshot().device.warmup, true);
});

test('link goes live, then stale once frames stop', () => {
  const s = fresh();
  feed(s, 300, 'SAFE');
  assert.equal(s.snapshot().link, 'live');
  tick(4000);
  assert.equal(s.snapshot().link, 'stale');
});

test('link reports waiting before the first frame arrives', () => {
  const s = fresh();
  assert.equal(s.snapshot().link, 'waiting');
});

test('link reports no-data after the cold-start window', () => {
  const s = fresh();
  tick(60_000);
  assert.equal(s.snapshot().link, 'no-data');
});

test('peak and mean are session statistics', () => {
  const s = fresh();
  feed(s, 300, 'SAFE');
  feed(s, 900, 'DANGER');
  feed(s, 600, 'WARNING');
  feed(s, 300, 'SAFE');
  const { stats } = s.snapshot();
  assert.equal(stats.peakValue, 900);
  assert.equal(stats.meanValue, 525);
  assert.equal(stats.sampleCount, 4);
});

test('firmware #CFG values replace the defaults so the UI cannot drift', () => {
  const s = fresh();
  s.setThresholds({ warning: 300, danger: 600, warningClear: 250, dangerClear: 520 });
  assert.equal(s.thresholds.warning, 300);
  assert.equal(s.thresholds.danger, 600);
  // Untouched keys keep their previous value.
  assert.equal(s.thresholds.adcMax, 1023);
});

test('recalibrated firmware thresholds move the incident boundary', () => {
  const s = fresh();
  s.setThresholds({ warning: 300, warningClear: 250, danger: 600, dangerClear: 520 });
  feed(s, 450, 'SAFE');      // safe under the old 500 threshold...
  assert.equal(s.incidents.length, 0);
  feed(s, 350, 'UNKNOWN');   // ...but an incident once the board says 300
});

test('legacy frames without a state are classified with firmware hysteresis', () => {
  const s = fresh();
  const legacy = (value) => s.ingest(parseLine(`Gas Value: ${value}`));

  legacy(300);
  assert.equal(s.incidents.length, 0);

  assert.equal(legacy(520).event, 'incident-open');
  assert.equal(s.incidents.length, 1);
  assert.equal(s.incidents[0].severity, 'warning');

  // 460 is above the 500 trip threshold? No — it is below it but still above the
  // 420 clear threshold, so the incident must stay open rather than chatter.
  assert.equal(legacy(460).event, null);
  assert.equal(s.incidents.length, 1);
  assert.equal(s.incidents[0].resolved, false);

  assert.equal(legacy(410).event, 'incident-close');
  assert.equal(s.incidents[0].resolved, true);
});

test('the classifier follows authoritative telemetry state', () => {
  const s = fresh();
  const legacy = (value) => s.ingest(parseLine(`Gas Value: ${value}`));

  // Firmware says WARNING at 520 -> incident opens from telemetry, not legacy.
  feed(s, 520, 'WARNING');
  assert.equal(s.incidents.length, 1);

  // A legacy frame at 460 must be read against WARNING (clear at 420), so the
  // incident stays open. A stale classifier would have closed it here.
  assert.equal(legacy(460).event, null);
  assert.equal(s.incidents.length, 1);

  assert.equal(legacy(410).event, 'incident-close');
});

test('a config line is not treated as a reading', () => {
  const s = fresh();
  const r = s.ingest(parseLine('#CFG,warn=500,danger=800'));
  assert.equal(r.event, null);
  assert.equal(s.sampleCount, 0);
});

test('snapshot exposes everything the dashboard renders', () => {
  const s = fresh();
  feed(s, 620, 'WARNING');
  const snap = s.snapshot();
  assert.deepEqual(Object.keys(snap).sort(), [
    'device', 'frameSource', 'history', 'incidents', 'isDemo',
    'latest', 'link', 'source', 'stats', 'thresholds',
  ]);
  assert.equal(snap.frameSource, 'telemetry');
  assert.equal(snap.isDemo, false);
  assert.equal(snap.latest.state, 'WARNING');
  assert.equal(snap.device.rssi, -60);
});