import test from 'node:test';
import assert from 'node:assert/strict';
import { nextAlert } from '../src/alertPolicy.js';

const warn = { severity: 'warning' };
const crit = { severity: 'critical' };

test('alerts once when an incident opens', () => {
  assert.deepEqual(nextAlert(null, { event: 'incident-open', incident: warn }), { send: true, last: 'warning' });
});

test('stays quiet while a warning incident continues', () => {
  assert.deepEqual(nextAlert('warning', { event: null, incident: warn }), { send: false, last: 'warning' });
});

test('alerts again when the same incident escalates to critical', () => {
  assert.deepEqual(nextAlert('warning', { event: null, incident: crit }), { send: true, last: 'critical' });
});

test('does not repeat once critical', () => {
  assert.deepEqual(nextAlert('critical', { event: null, incident: crit }), { send: false, last: 'critical' });
});

test('an incident that opens already critical alerts once', () => {
  assert.deepEqual(nextAlert(null, { event: 'incident-open', incident: crit }), { send: true, last: 'critical' });
});

test('a resumed critical incident after a restart does not re-alert', () => {
  assert.deepEqual(nextAlert(null, { event: null, incident: crit }), { send: false, last: 'critical' });
});

test('closing resets so the next leak alerts again', () => {
  assert.deepEqual(nextAlert('critical', { event: 'incident-close', incident: crit }), { send: false, last: null });
  assert.deepEqual(nextAlert(null, { event: 'incident-open', incident: warn }), { send: true, last: 'warning' });
});

test('no incident means no alert and a reset', () => {
  assert.deepEqual(nextAlert('warning', { event: null, incident: null }), { send: false, last: null });
});
