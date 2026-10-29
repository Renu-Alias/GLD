# GLD Project - Quick Info

This document explains key terms you'll see on the Gas Leak Detection Dashboard: "Samples received", COM ports, ADC values, and related concepts.

## COM Ports (e.g., COM3)

- **What it is:** A Windows virtual serial port. When you connect the ESP32 via USB, Windows creates a COM port (e.g., `COM3`, `COM4`, `COM7`) for serial communication.
- **Purpose:** The Node.js bridge (`Dashboard/server`) uses this port to read data from the ESP32 at **115200 baud**.
- **Assignment:** The port number depends on which USB port you plug into and the USB-to-serial driver used (CP210x, CH340, or native ESP32 drivers).
- **Auto-detection:** The bridge can auto-detect the ESP32's port. You can also manually list ports with `npm run ports` in `Dashboard/server`.

## Samples Received

"Samples received" is the number of **telemetry frames** parsed by the bridge from the ESP32 since the bridge was started.

- **One sample = one reading:** The ESP32 takes a reading every `SAMPLE_INTERVAL_MS` (default 250 ms) and sends a `TELEM` line (e.g., `TELEM,gas=512,state=SAFE,...`).
- **Tracked in memory:** The bridge's `Session` class (`Dashboard/server/src/session.js`) increments `sampleCount` for each parsed reading frame.
- **Resets on restart:** Restarting the bridge resets this counter to 0. It does **not** reflect total historical samples stored in the database.
- **Separate from DB:** The trend chart uses SQLite (`readings.db`) to store readings over time, while "Samples received" is just a live session counter.

## Why ADC?

**ADC** stands for **Analog-to-Digital Converter**. The gas value shown on the dashboard is a raw ADC count, not a calibrated ppm value.

- **Analog sensor:** The MQ-6 LPG sensor outputs an analog voltage that varies with gas concentration.
- **Conversion:** The ESP32 reads this voltage on **GPIO33** (ADC1). Using its built-in ADC (12-bit, 11 dB attenuation by default), it converts 0-3.3V to a digital value in the range **0-1023**.
- **Raw output:** The firmware sends this raw count as `gas=` in the `TELEM` frame with no conversion to ppm.
- **Thresholds are in ADC counts:** Alarm thresholds (e.g., WARNING at 500, DANGER at 800) are defined in ADC counts.
- **Needs calibration:** Different sensors and environmental conditions give different readings for the same concentration. The default thresholds are placeholders and should be calibrated for your setup.

## Quick Summary

| Term | Meaning |
|---|---|
| **COM3** | Windows serial port the ESP32 is connected to via USB. |
| **Samples received** | Number of `TELEM` frames parsed since bridge startup (resets on restart). |
| **ADC (0-1023)** | Raw digital value from the ESP32 ADC reading the MQ-6 analog voltage. |
| **TELEM** | Telemetry line format sent by firmware containing `gas`, `state`, `rssi`, etc. |
| **115200 baud** | Serial communication speed between ESP32 and bridge. |

## Related Files

- `gld.ino` - Firmware reading ADC on GPIO33 and emitting TELEM
- `Dashboard/server/src/serialSource.js` - Serial port handling
- `Dashboard/server/src/telemetry.js` - TELEM parsing
- `Dashboard/server/src/session.js` - Tracks `sampleCount` and incidents
- `SERIAL_ADC_TERMINOLOGY.md` - More detailed version of this explanation
- `README.md` - Full hardware, pin map, and calibration details
