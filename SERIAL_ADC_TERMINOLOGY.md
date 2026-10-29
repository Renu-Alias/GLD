# Serial, COM Ports, ADC, and Samples - Explained

This document explains the terms you'll see on the Gas Leak Dashboard (bridge + UI) - specifically **COM3**, **Samples received**, and why the gas value is reported as **ADC**.

## What is COM3?

COM3 is a **Windows serial port name** (also called a "COM port"). 

- **Serial communication**: The ESP32 communicates with your computer over USB. Windows exposes that as a virtual serial port (e.g., `COM3`, `COM4`, `COM7`).
- **How it's assigned**: The port number depends on which USB port you plug into and what drivers are installed (often CP210x, CH340, or the native ESP32 USB driver).
- **In this project**: The bridge (`Dashboard/server`) uses the `serialport` package to open that port at **115200 baud** and read lines the firmware prints (like `TELEM,...`). You can see which port is used in the bridge logs: `Feed     serial COM3 @ 115200 baud ...` or it may auto-detect.
- **Finding it**: You can list ports with `npm run ports` in `Dashboard/server`, or via Device Manager (Ports (COM & LPT)).

## What does "Samples received" mean?

"Samples received" refers to how many **telemetry frames** (samples) the bridge has successfully parsed from the ESP32 since it started or since the session began.

- **One sample = one reading**: The firmware takes an ADC reading of the MQ-6 sensor roughly every `SAMPLE_INTERVAL_MS` (default 250 ms) and emits a `TELEM` line like:
  ```
  TELEM,gas=512,state=WARNING,up=123456,rssi=-62,muted=0,warm=0
  ```
- **Counted by the bridge**: In `Dashboard/server/src/session.js`, `this.sampleCount += 1` is incremented for each parsed reading frame (regardless of whether it's from live telemetry or legacy frames). This count is shown in the dashboard stats as "Samples received" (or related to sample count).
- **Not the same as "rows in DB"**: The trend chart stores samples in SQLite (`readings.db`) as they come in; "samples received" is the counter tracked by the bridge session. New samples continue to increase the count as long as the ESP32 is sending data.
- **Resets on bridge restart**: Since it's a session counter in memory, restarting the bridge resets `sampleCount` to 0 (though historical trend data may remain in SQLite).

## Why is it ADC?

ADC stands for **Analog-to-Digital Converter**. The value you see (`gas`, `Peak ADC`, etc.) is a raw ADC count, not a calibrated ppm (parts per million) value.

- **Analog sensor**: The MQ-6 gas sensor outputs an analog voltage that varies with LPG concentration. The ESP32 reads this voltage on **GPIO33** (ADC1).
- **Conversion**: The ESP32's ADC converts the 0-3.3V analog signal to a digital number. With default settings (12-bit, 11dB attenuation) this gives a range of roughly **0-1023**.
- **Raw value**: The firmware does `analogRead()` on GPIO33 and sends that raw count as `gas=` in the `TELEM` line. The bridge passes it through unchanged.
- **Thresholds are in ADC counts**: The firmware's alarm thresholds (`WARNING_THRESHOLD`, `DANGER_THRESHOLD`, etc.) are defined in ADC counts (defaults 500/800/420/700). The dashboard also shows reference lines based on these ADC thresholds.
- **Calibration needed**: Different MQ-6 sensors and conditions (temperature/humidity) will give different ADC readings for the same concentration. That's why the README says "Thresholds are uncalibrated placeholders" - you need to calibrate for your specific setup.

## Quick Reference

| Term | Meaning |
|---|---|
| COM3 | Windows virtual serial port the ESP32 is connected to (via USB). |
| Samples received | Number of telemetry reading frames parsed by the bridge since startup. |
| ADC | Raw digital count (0-1023) from the ESP32's analog-to-digital converter reading the MQ-6 sensor voltage. |
| TELEM | Firmware line format that sends `gas=`, `state=`, `rssi=`, etc. to the bridge. |
| 115200 baud | Serial communication speed between ESP32 and computer. |

## Related Files
- `GLD.ino` - Firmware that reads ADC on GPIO33 and emits TELEM
- `Dashboard/server/src/serialSource.js` - Handles serial connection to COM port
- `Dashboard/server/src/telemetry.js` - Parses TELEM/legacy frames
- `Dashboard/server/src/session.js` - Tracks sampleCount and incidents
- `README.md` - Hardware/pin map and calibration info
