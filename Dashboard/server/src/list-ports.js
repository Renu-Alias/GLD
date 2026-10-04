import { SerialSource } from './serialSource.js';
import { pickPort } from './serialSource.js';

const source = new SerialSource();
const ports = await source.listPorts();

if (ports.length === 0) {
  console.log('No serial ports found.');
  console.log('Connect the ESP32 with a USB data cable, then run this again.');
  process.exit(0);
}

console.log(`\n${ports.length} serial port(s):\n`);
for (const p of ports) {
  const tag = p.recognised ? `[ESP32?] ${p.recognisedAs}` : '[      ] not recognised';
  console.log(`  ${p.path.padEnd(10)} ${tag}`);
  if (p.detail) console.log(`  ${''.padEnd(10)} ${p.detail}`);
  if (p.usbIds) console.log(`  ${''.padEnd(10)} USB ${p.usbIds}${p.serialNumber ? `  SN ${p.serialNumber}` : ''}`);
}

const target = pickPort(ports);
console.log('');
console.log(target
  ? `Auto-selected: ${target.path}\nStart the bridge with:  npm start`
  : 'Could not auto-select a board. Start it with an explicit port:\n  $env:SERIAL_PORT="COM7"; npm start');
console.log('');