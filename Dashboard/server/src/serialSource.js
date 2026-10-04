import { EventEmitter } from 'node:events';

/**
 * USB vendor IDs of the serial bridges that appear when an ESP32 dev board is
 * plugged into a laptop over USB (Type-B / Type-C cable).
 */
const KNOWN_USB_IDS = new Map([
  ['0x303a', 'Espressif native USB (ESP32-S2/S3/C3)'],
  ['0x10c4', 'Silicon Labs CP210x'],
  ['0x1a86', 'QinHeng CH340/CH341'],
  ['0x0403', 'FTDI FT232'],
  ['0x1b4f', 'SparkFun'],
  ['0x2341', 'Arduino'],
]);

const normaliseHex = (value) =>
  typeof value === 'string' ? value.toLowerCase().replace(/^0x/, '').padStart(4, '0') : '';

export function describePort(port) {
  const vid = normaliseHex(port.vendorId);
  const known = KNOWN_USB_IDS.get(vid);
  const ids = port.vendorId && port.productId ? `${port.vendorId}:${port.productId}` : '';
  const detail = [port.manufacturer, port.product].filter(Boolean).join(' ');
  return {
    path: port.path,
    manufacturer: port.manufacturer ?? null,
    product: port.product ?? null,
    vendorId: port.vendorId ?? null,
    productId: port.productId ?? null,
    serialNumber: port.serialNumber ?? null,
    usbIds: ids || null,
    recognised: Boolean(known),
    recognisedAs: known ?? null,
    detail: detail || null,
  };
}

/**
 * Chooses which port to open.
 *
 * Deliberately conservative: if several unrelated ports are present and none of
 * them look like an ESP32, this returns null instead of grabbing a random
 * COM port (which would be a modem or a Bluetooth stack). `SERIAL_PORT=COMx`
 * is the escape hatch.
 */
export function pickPort(descriptions, explicitPath = null) {
  if (explicitPath) {
    const match = descriptions.find((p) => p.path.toLowerCase() === explicitPath.toLowerCase());
    if (match) return match;
    return { path: explicitPath, synthetic: true };
  }

  const recognised = descriptions.filter((p) => p.recognised);
  if (recognised.length === 1) return recognised[0];
  if (recognised.length > 1) return recognised[0];

  if (descriptions.length === 1) return descriptions[0];

  return null;
}

/** Turns the raw errno into something a person can act on. */
export function friendlyOpenError(err, path) {
  const code = err?.code ?? '';
  const message = String(err?.message ?? err);

  if (code === 'EBUSY' || code === 'EACCES' || /access is denied|resource busy|open/i.test(message)) {
    return `${path} is already open by another program. Close the Arduino IDE Serial Monitor `
      + `and any other serial monitor, then reconnect the cable.`;
  }
  if (code === 'ENOENT' || /no such file|cannot find/i.test(message)) {
    return `${path} disappeared — the board was unplugged or reset.`;
  }
  if (/timeout|timed out/i.test(message)) {
    return `Timed out opening ${path}. Check the cable is a data cable, not a charge-only cable.`;
  }
  return `Could not open ${path}: ${message}`;
}

/**
 * Owns the lifetime of the USB serial connection: connect, stream complete
 * lines, and keep retrying when the board is unplugged or resets.
 *
 * `serialport` is imported lazily so that `--demo` mode and the unit tests run
 * even where the native module is unavailable.
 */
export class SerialSource extends EventEmitter {
  #port = null;
  #opening = false;
  #stopped = true;
  #retryTimer = null;
  #SerialPortCtor = null;

  constructor({ path = null, baudRate = 115200, rescanIntervalMs = 2000, logger = console } = {}) {
    super();
    this.path = path;
    this.baudRate = baudRate;
    this.rescanIntervalMs = rescanIntervalMs;
    this.logger = logger;
    this.status = {
      open: false,
      path: this.path,
      error: null,
      lastError: null,
      ports: [],
      connectedAt: null,
    };
  }

  async #load() {
    if (this.#SerialPortCtor) return this.#SerialPortCtor;
    const mod = await import('serialport');
    this.#SerialPortCtor = mod.SerialPort;
    return this.#SerialPortCtor;
  }

  async listPorts() {
    const SerialPort = await this.#load();
    const ports = await SerialPort.list();
    const descriptions = ports.map(describePort).sort((a, b) => a.path.localeCompare(b.path));
    this.status.ports = descriptions;
    return descriptions;
  }

  async start() {
    this.#stopped = false;
    return this.#connect();
  }

  stop() {
    this.#stopped = true;
    if (this.#retryTimer) {
      clearTimeout(this.#retryTimer);
      this.#retryTimer = null;
    }
    if (this.#port?.isOpen) this.#port.close(() => {});
    this.#port = null;
  }

  async #connect() {
    if (this.#stopped || this.#opening || this.#port?.isOpen) return;
    this.#opening = true;

    try {
      const descriptions = await this.listPorts();
      const target = pickPort(descriptions, this.path);

      if (!target) {
        this.status.open = false;
        this.status.path = null;
        this.status.error = descriptions.length === 0
          ? 'No serial port found. Connect the ESP32 with a USB data cable and check Device Manager.'
          : `Found ${descriptions.length} ports but none look like an ESP32 `
            + `(${descriptions.map((p) => p.path).join(', ')}). Set SERIAL_PORT=COMx to choose one.`;
        this.#scheduleRetry();
        return;
      }

      this.status.error = null;
      this.status.path = target.path;

      const SerialPort = await this.#load();
      const port = new SerialPort(
        {
          path: target.path,
          baudRate: this.baudRate,
          dataBits: 8,
          stopBits: 1,
          parity: 'none',
          autoOpen: false,
        },
        // @serialport/bindings-cpp emits 'error' rather than throwing for these.
      );

      port.on('data', (chunk) => this.emit('chunk', chunk));
      port.on('error', (err) => this.#handleDrop(friendlyOpenError(err, target.path), err));

      port.open((err) => {
        this.#opening = false;

        if (err) {
          this.#handleDrop(friendlyOpenError(err, target.path), err);
          return;
        }

        this.status.open = true;
        this.status.lastError = null;
        this.status.connectedAt = Date.now();
        this.#port = port;
        this.emit('open', { path: target.path, label: target.recognisedAs ?? target.detail ?? null });
        this.logger.log(`[bridge] serial open on ${target.path} @ ${this.baudRate} baud`);
      });
    } catch (err) {
      this.#opening = false;
      this.#handleDrop(friendlyOpenError(err, this.path ?? 'serial'), err);
    }
  }

  #handleDrop(message, err) {
    if (this.#port?.isOpen) {
      try {
        this.#port.close(() => {});
      } catch {
        /* already gone */
      }
    }
    this.#port = null;
    this.status.open = false;
    this.status.error = message;
    this.status.lastError = { message, at: Date.now(), code: err?.code ?? null };
    this.emit('close', { message });
    this.logger.warn(`[bridge] ${message}`);
    this.#scheduleRetry();
  }

  #scheduleRetry() {
    if (this.#stopped || this.#retryTimer) return;
    this.#retryTimer = setTimeout(() => {
      this.#retryTimer = null;
      this.#connect();
    }, this.rescanIntervalMs);
    this.#retryTimer.unref?.();
  }
}