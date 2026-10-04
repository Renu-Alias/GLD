# Gas Leak Dashboard bridge

A small Node service that sits between the ESP32 and the browser. It reads the
telemetry the firmware writes to USB serial, turns it into incidents, and serves
the dashboard over HTTP + Server-Sent Events.

No database, no cloud, no build step: run the firmware and this, and the
dashboard is live.

## Quick start

```powershell
cd Dashboard/server
npm install
npm start          # real hardware
npm run demo       # synthetic readings, no board needed
npm run ports      # list serial ports and see which one would be picked
```

Then open <http://127.0.0.1:4310>. If `Dashboard/frontend/dist` exists the
bridge serves the built UI itself; otherwise use the Vite dev server
(`npm run dev` in `Dashboard/frontend`, which proxies `/api` here).

## How it fits together

```
ESP32  --USB serial, 115200 baud-->  bridge  --HTTP + SSE-->  browser
GLD.ino     TELEM / #CFG lines        session state        React dashboard
```

| File | Responsibility |
|---|---|
| `src/index.js` | Wires the source, session and HTTP server together; owns shutdown |
| `src/telemetry.js` | Pure parsers for the serial line protocol, plus the line reassembler |
| `src/session.js` | Readings → latest value, trend history, incident log, stats, link health |
| `src/serialSource.js` | USB serial connection, port auto-detection, reconnect, friendly errors |
| `src/demoSource.js` | Synthetic feed in the exact firmware wire format |
| `src/sse.js` | Event fan-out to connected browsers |
| `src/http.js` | JSON API plus static hosting of the frontend build |

The demo source emits real `TELEM` lines and goes through the same parser and
session as hardware, so the demo path cannot drift from the real one. It is the
only place synthetic data can enter, and `isDemo` in every response lets the UI
label it as simulated.

## Serial line protocol

Emitted by `GLD.ino`, parsed by `src/telemetry.js`.

**One telemetry frame per ADC sample:**

```
TELEM,gas=512,state=WARNING,up=123456,rssi=-62,muted=0,warm=0
```

| Field | Meaning |
|---|---|
| `gas` | Raw MQ-6 ADC count, 0–1023. The only required field. |
| `state` | `SAFE`, `WARNING`, `DANGER`, `WARMUP`, or absent |
| `up` | Board uptime in ms (`millis()`) |
| `rssi` | WiFi RSSI, or `0` when offline |
| `muted` | `1` while the button has muted the buzzer |
| `warm` | `1` during the 20 s sensor warm-up |

**Threshold banner, sent once at boot:**

```
#CFG,warn=500,danger=800,warnClear=420,dangerClear=700,sampleMs=250,adcMax=1023
```

The UI's reference lines come from this banner, not from the bridge's defaults,
so the dashboard can never show a threshold the sensor is not using.

**Legacy frames** from firmware predating telemetry are still accepted:

```
Gas Value: 512 state: WARNING
```

These carry no state field often enough that the bridge re-applies the firmware's
hysteresis locally, and the incident log still matches what the hardware did.
Legacy firmware also rate-limits its output (2.5 s alarming, 10 s safe), so the
chart simply updates more slowly. The bridge warns once when it sees them.

Anything else on the port (WiFi logs, boot ROM noise) is ignored.

## HTTP API

| Endpoint | Returns |
|---|---|
| `GET /api/health` | Liveness, `demo` flag, link state, thresholds, serial status |
| `GET /api/snapshot` | Full dashboard state: latest, history, incidents, stats, device |
| `GET /api/stream` | The SSE stream (below) |
| `GET /api/ports` | Serial ports with USB IDs and whether they look like an ESP32 |

All responses are JSON with `cache-control: no-store` and
`access-control-allow-origin: *`, so the UI can be served from the Vite dev
server on a different port without a CORS setup.

## SSE stream

`GET /api/stream` sends a `hello` event with the full snapshot, so a browser that
connects late is immediately correct and never has to poll.

| Event | When | Payload |
|---|---|---|
| `hello` | On connect | Full snapshot plus `serial` status |
| `reading` | Every ADC sample | `value`, `severity`, `state`, `warmup`, `muted`, `rssi`, `uptimeMs`, `at` |
| `incident` | On open/close | `{ event: 'incident-open'\|'incident-close', incident }` |
| `config` | After a `#CFG` banner | `thresholds`, `sampleIntervalMs` |
| `link` | When link health changes | `link` |
| `peers` | On connect/disconnect | `clients` |

A comment frame (`: ping`) every 15 s keeps proxies from closing an idle stream.
Clients are dropped automatically when their socket dies.

`link` is one of:

| Value | Meaning |
|---|---|
| `waiting` | Bridge up, no frame yet, still inside the cold-start window |
| `no-data` | No frame at all within `COLD_START_MS` — check the board and cable |
| `live` | A frame arrived within `STALE_MS` |
| `stale` | Frames stopped — the firmware blocks for seconds while sending an SMS |

## Configuration

All optional; every value has a working default.

| Variable | Default | Meaning |
|---|---|---|
| `HOST` | `127.0.0.1` | Bind address. Use `0.0.0.0` to reach the dashboard from a phone |
| `PORT` | `4310` | HTTP port |
| `SERIAL_PORT` | auto | Explicit port, e.g. `COM7`. Overrides auto-detection |
| `BAUD` | `115200` | Must match the firmware |
| `RESCAN_MS` | `2000` | How often to re-scan for a missing board |
| `STALE_MS` | `3000` | Age at which a reading marks the feed stale |
| `COLD_START_MS` | `15000` | No data at all within this window → `no-data` |
| `HISTORY_POINTS` | `720` | Trend ring buffer depth (≈ 3 min at 250 ms) |
| `INCIDENT_LIMIT` | `100` | Incident log cap |
| `DEMO` | off | `1` for synthetic readings, same as `npm run demo` |

Example — pin the port and expose the dashboard on the LAN:

```powershell
$env:SERIAL_PORT = "COM7"
$env:HOST = "0.0.0.0"
npm start
```

## Port selection

Auto-detection is deliberately conservative. A port is preferred if its USB
vendor ID is a known serial bridge (Espressif `0x303a`, Silicon Labs `0x10c4`,
CH340 `0x1a86`, FTDI `0x0403`, …). If exactly one port is present it is used even
when unrecognised. If several unrecognised ports are present **nothing** is
opened, because grabbing a random COM port means opening a modem or a Bluetooth
stack — set `SERIAL_PORT` instead.

The port is reopened automatically after a reset or replug.

## Tests

```powershell
npm test
```

Covers the parsers, the session state machine (hysteresis, incident open/close,
stats, link health), port selection and error messages, the JSON API and static
file serving, and the SSE hub. No hardware and no native serial module required —
`serialport` is imported lazily, so `--demo` and the tests run anywhere.
