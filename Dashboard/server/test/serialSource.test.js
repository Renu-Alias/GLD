import test from 'node:test';
import assert from 'node:assert/strict';
import { describePort, friendlyOpenError, pickPort } from '../src/serialSource.js';

const port = (over = {}) => ({ path: 'COM7', ...over });

test('recognises the Espressif native USB bridge', () => {
  const d = describePort(port({ vendorId: '0x303A', productId: '0x1001' }));
  assert.equal(d.recognised, true);
  assert.match(d.recognisedAs, /Espressif/);
});

test('recognises the common USB-UART bridges', () => {
  for (const [vid, name] of [['0x10c4', /Silicon Labs/], ['0x1a86', /CH340/], ['0x0403', /FTDI/]]) {
    assert.equal(describePort(port({ vendorId: vid })).recognised, true, vid);
    assert.match(describePort(port({ vendorId: vid })).recognisedAs, name);
  }
});

test('an unknown or missing USB id is not recognised', () => {
  assert.equal(describePort(port({ vendorId: '0x1234' })).recognised, false);
  assert.equal(describePort(port()).recognised, false);
  assert.equal(describePort(port()).recognisedAs, null);
});

test('a short vendor id is zero padded rather than missed', () => {
  // Some bindings report "303a" with no 0x prefix and fewer than 4 digits.
  assert.equal(describePort(port({ vendorId: '303a' })).recognised, true);
});

test('port metadata is normalised for the UI', () => {
  const d = describePort(port({
    vendorId: '0x10c4',
    productId: '0xea60',
    manufacturer: 'Silicon Labs',
    product: 'CP2102N USB to UART Bridge',
    serialNumber: 'ABC123',
  }));
  assert.equal(d.usbIds, '0x10c4:0xea60');
  assert.equal(d.detail, 'Silicon Labs CP2102N USB to UART Bridge');
  assert.equal(d.serialNumber, 'ABC123');
});

test('missing optional metadata becomes null, not undefined', () => {
  const d = describePort(port());
  assert.equal(d.manufacturer, null);
  assert.equal(d.product, null);
  assert.equal(d.vendorId, null);
  assert.equal(d.usbIds, null);
  assert.equal(d.detail, null);
});

test('a single recognised board is auto-selected', () => {
  const ports = [describePort(port({ path: 'COM3' })), describePort(port({ path: 'COM7', vendorId: '0x303a' }))];
  assert.equal(pickPort(ports).path, 'COM7');
});

test('one port is picked even when it is not a recognised board', () => {
  // Better than doing nothing: the common case is a single board plugged in.
  assert.equal(pickPort([describePort(port({ path: 'COM4' }))]).path, 'COM4');
});

test('several unrecognised ports yield no automatic choice', () => {
  // Grabbing a random COM port would open a modem or a Bluetooth stack.
  const ports = ['COM3', 'COM4', 'COM5'].map((p) => describePort(port({ path: p })));
  assert.equal(pickPort(ports), null);
});

test('the first of several recognised boards is chosen', () => {
  const ports = [
    describePort(port({ path: 'COM7', vendorId: '0x303a' })),
    describePort(port({ path: 'COM9', vendorId: '0x1a86' })),
  ];
  assert.equal(pickPort(ports).path, 'COM7');
});

test('an explicit port wins over auto-detection', () => {
  const ports = [describePort(port({ path: 'COM7', vendorId: '0x303a' }))];
  assert.equal(pickPort(ports, 'COM7').path, 'COM7');
  assert.equal(pickPort(ports, 'com7').path, 'COM7', 'matching must be case-insensitive');
});

test('an explicit port that is absent is still attempted', () => {
  const target = pickPort([describePort(port({ path: 'COM7' }))], 'COM12');
  assert.deepEqual(target, { path: 'COM12', synthetic: true });
});

test('a port held by another program explains itself', () => {
  const msg = friendlyOpenError({ code: 'EBUSY', message: 'Resource temporarily unavailable' }, 'COM7');
  assert.match(msg, /COM7/);
  assert.match(msg, /already open by another program/);
  assert.match(msg, /Arduino IDE/);
});

test('an unplugged board is reported as unplugged', () => {
  assert.match(friendlyOpenError({ code: 'ENOENT', message: 'no such file' }, 'COM7'), /unplugged/);
});

test('a charge-only cable is the likely cause of an open timeout', () => {
  assert.match(friendlyOpenError({ code: 'ETIMEDOUT', message: 'timeout' }, 'COM7'), /data cable/);
});

test('an unrecognised failure still names the port and the reason', () => {
  const msg = friendlyOpenError({ code: 'EWEIRD', message: 'something odd' }, 'COM7');
  assert.match(msg, /COM7/);
  assert.match(msg, /something odd/);
});
