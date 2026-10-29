import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { SseHub } from '../src/sse.js';

/** Minimal stand-ins for the request and response objects of an SSE connection. */
class FakeReq extends EventEmitter {}

class FakeRes extends EventEmitter {
  chunks = [];
  ended = false;
  throwOnWrite = false;

  writeHead(status, headers) {
    this.status = status;
    this.headers = headers;
    return this;
  }

  write(chunk) {
    if (this.throwOnWrite) throw new Error('socket gone');
    this.chunks.push(chunk);
    return true;
  }

  end() {
    this.ended = true;
    return this;
  }

  get body() {
    return this.chunks.join('');
  }

  /** Parses `event:`/`data:` frames out of everything written so far. */
  events() {
    return this.body
      .split('\n\n')
      .filter((frame) => frame.startsWith('event: '))
      .map((frame) => {
        const [nameLine, dataLine] = frame.split('\n');
        return {
          name: nameLine.slice('event: '.length),
          data: JSON.parse(dataLine.slice('data: '.length)),
        };
      });
  }
}

const HELLO = { source: 'serial', link: 'live', latest: { value: 512 } };

function connect(hub, hello = HELLO) {
  const req = new FakeReq();
  const res = new FakeRes();
  hub.addClient(req, res, hello);
  return { req, res };
}

test('a new client gets SSE headers, a reconnect hint and a hello snapshot', () => {
  const hub = new SseHub();
  const { res } = connect(hub);

  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/event-stream/);
  assert.equal(res.headers['cache-control'], 'no-cache, no-transform');
  assert.equal(res.headers['x-accel-buffering'], 'no');
  assert.match(res.body, /retry: 2000/);

  const [hello] = res.events();
  assert.equal(hello.name, 'hello');
  assert.deepEqual(hello.data, HELLO);
});

test('a client is told how many dashboards are watching', () => {
  const hub = new SseHub();
  const first = connect(hub);
  const second = connect(hub);

  assert.equal(hub.size, 2);
  assert.equal(first.res.events().at(-1).data.clients, 1);
  assert.equal(second.res.events().at(-1).data.clients, 2);
});

test('a broadcast reaches every connected client', () => {
  const hub = new SseHub();
  const a = connect(hub);
  const b = connect(hub);

  hub.broadcast('reading', { value: 700, severity: 'warning' });

  for (const { res } of [a, b]) {
    const reading = res.events().find((e) => e.name === 'reading');
    assert.deepEqual(reading.data, { value: 700, severity: 'warning' });
  }
});

test('broadcasting with no clients connected is a no-op', () => {
  const hub = new SseHub();
  hub.broadcast('reading', { value: 1 });
  assert.equal(hub.size, 0);
});

test('the heartbeat is a comment frame, not an event the UI has to handle', () => {
  const hub = new SseHub();
  const { res } = connect(hub);

  hub.heartbeat();

  assert.match(res.body, /: ping/);
  assert.equal(res.events().some((e) => e.name === 'ping'), false);
});

test('a disconnected browser is dropped from the fan-out', () => {
  const hub = new SseHub();
  const a = connect(hub);
  const b = connect(hub);

  a.req.emit('close');

  assert.equal(hub.size, 1);
  assert.equal(b.res.events().at(-1).data.clients, 1);

  b.req.emit('close');
  assert.equal(hub.size, 0);
});

test('an error on the request or response also drops the client', () => {
  const hub = new SseHub();
  const { req, res } = connect(hub);

  req.emit('error', new Error('reset'));
  assert.equal(hub.size, 0);

  const other = connect(hub);
  other.res.emit('error', new Error('reset'));
  assert.equal(hub.size, 0);
  assert.equal(res.ended, false);
});

test('a client whose socket has died is evicted on the next write', () => {
  const hub = new SseHub();
  const dead = connect(hub);
  const live = connect(hub);

  dead.res.throwOnWrite = true;
  hub.broadcast('reading', { value: 1 });

  assert.equal(hub.size, 1);
  assert.equal(live.res.events().filter((e) => e.name === 'reading').length, 1);
});

test('a client whose socket has died is evicted by the heartbeat too', () => {
  const hub = new SseHub();
  const { res } = connect(hub);
  res.throwOnWrite = true;

  hub.heartbeat();
  assert.equal(hub.size, 0);
});

test('shutdown ends every stream instead of leaving sockets hanging', () => {
  const hub = new SseHub();
  const a = connect(hub);
  const b = connect(hub);

  hub.closeAll();

  assert.equal(hub.size, 0);
  assert.ok(a.res.ended);
  assert.ok(b.res.ended);
});
