# Smart LPG Gas Leak Detection & Alert System
 
An embedded IoT system for real-time LPG leak detection and dependency-free local + remote alerting in domestic kitchens.
 
## Overview
 
LPG is colourless and essentially odourless — the safety odorant added to it only works as a warning if someone is present, awake, and able to smell it. This project closes that awareness gap with a low-cost, always-on ESP32-based monitor that continuously samples the air near the cylinder and stove, raises an immediate local audible + visual alarm the instant a leak is detected, and pushes a remote notification (SMS + cloud log) so that someone away from the kitchen is informed too.
 
The local alarm path is entirely GPIO-driven and has **no dependency on WiFi** — it keeps working even during a network or connectivity outage. Remote notification (SMS + Supabase logging) rides on top of that as a best-effort layer.
 
## Features
 
- Continuous LPG concentration sensing with the MQ-6 gas sensor
- Local audible alarm (buzzer, variable ring patterns) and visual alarm (multi-colour LED, variable brightness/blink patterns), both WiFi-independent
- Manual-override switch to silence/reset the local alarm
- SMS alert to registered mobile numbers with gas concentration level and timestamp
- Supabase cloud logging of sensor readings and alert history, with a real-time sync dashboard
- Documented MQ-6 warm-up/calibration procedure and measured leak-to-alarm response latency
## System Architecture
 
The system is organized into four layers:
 
1. **Sensing Layer** — MQ-6 gas sensor (via a 10kΩ load resistor) continuously samples air near the cylinder/stove; a manual-override switch provides a second local input.
2. **Control / Processing Layer** — ESP32 runs the embedded-C firmware: ADC sampling → threshold-comparison logic → GPIO control → WiFi. Powered through a regulated 9V/USB supply with a stabilizing capacitor on the rail.
3. **Local Output Layer** (WiFi-independent) — buzzer and multi-colour LED, driven directly by GPIO so the physical alarm fires instantly regardless of network state.
4. **Remote / Cloud Layer** (over WiFi) — SMS gateway to registered numbers, Supabase for sensor/alert logging, and a real-time sync dashboard.
Detection → local alarm (layers 1–3) forms a closed loop that never touches the network; the remote layer is an add-on, not a dependency.
 
## Hardware Components
 
| Component | Qty | Role |
|---|---|---|
| ESP32 dev board | 1 | Processing + built-in WiFi |
| MQ-6 LPG gas sensor module | 1 | Gas concentration sensing |
| 5mm 4-pin common-cathode RGB LED | 1 | Visual alarm indicator |
| 5V passive buzzer | 1 | Audible alarm |
| 2N2222 transistor | 1 | Switches the buzzer via GPIO PWM |
| 1 kΩ resistor | 1 | Transistor base resistor |
| 220 Ω resistors | 5 | RGB LED current limiting (3 used) + spares |
| 10 kΩ load resistor | 1 | MQ-6 signal conditioning |
| Push button | 1 | Manual override / alarm silence |
| Stabilizing capacitor | 1 | Smooths the power rail |
| Breadboard, jumper wires, connector wires | — | Prototyping |
| 9V/USB power supply + regulator | 1 | Power source |
| Enclosure | 1 | Housing |
 
## Pin Map (ESP32)
 
| Signal | ESP32 Pin |
|---|---|
| MQ-6 VCC | 3V3 |
| MQ-6 GND | GND |
| MQ-6 AO | GPIO34 (ADC1_CH6) |
| RGB LED – Red | GPIO25 (via 220Ω) |
| RGB LED – Green | GPIO26 (via 220Ω) |
| RGB LED – Blue | GPIO27 (via 220Ω) |
| RGB LED – common cathode | GND |
| Buzzer control (2N2222 base) | GPIO18 (via 1kΩ) |
| Push button | GPIO19 (INPUT_PULLUP) |
 
## Firmware Logic
 
The firmware (Embedded C, ESP32) runs a simple, robust loop:
 
1. **ADC sampling** — read the MQ-6's analog output on GPIO34 at a fixed interval (~300–500 ms), using the ESP32's 12-bit ADC in its full 0–3.3V range.
2. **Threshold logic** — compare the raw reading against two calibrated thresholds (`WARNING_THRESHOLD`, `DANGER_THRESHOLD`), with hysteresis on both boundaries so the system doesn't flicker between states near a threshold.
3. **State machine** — three states drive all outputs:
   - `SAFE` — LED green, buzzer off
   - `WARNING` — LED amber, buzzer off (early heads-up)
   - `DANGER` — LED red (blinking), buzzer sounding, one SMS + Supabase log entry sent per leak event (not re-sent every loop)
4. The manual-override button mutes the buzzer during `DANGER` without clearing the alarm state — the system only returns to `SAFE` once the sensor reading actually drops back down.
## Getting Started
 
1. Wire the hardware per the pin map above.
2. Install the ESP-IDF toolchain (v5.x).
3. Set your WiFi, SMS gateway, and Supabase credentials in the firmware configuration section.
4. Build and flash:
```
   idf.py set-target esp32
   idf.py build flash monitor
```
5. Let the MQ-6 warm up (~20s) before relying on readings.
## Calibration
 
MQ-6 units vary — calibrate before deployment:
 
1. Monitor the raw ADC value in clean air for a few minutes to establish a baseline.
2. In a well-ventilated area, briefly expose the sensor to a small LPG source and note the reading.
3. Set `WARNING_THRESHOLD` just above the clean-air baseline and `DANGER_THRESHOLD` at the observed leak-exposure level; re-test after adjusting.
## Testing Checklist
 
- Boot sequence: warm-up indicator → green (safe) in clean air
- Amber → red transition, buzzer tone, and one SMS + Supabase log entry on a brief, ventilated gas exposure
- Manual-override button mutes the buzzer during an active alarm without clearing the LED state
- System returns to green and re-arms once gas clears
## Project Scope
 
**Included:** continuous MQ-6 sensing, GPIO-driven local alarm, SMS alerting, Supabase logging, documented calibration and response-time measurement.
 
**Not included (future work):** automatic regulator/electricity shutoff, ventilation control, cylinder-weight monitoring, battery backup for mains power cuts, and field validation across multiple real kitchen installations (this cycle is lab/prototype testing only).
 
## Team
 
Fathima P A, Manya K S, Meenakshi Menon, Renu Alias
B.Tech Computer Science and Engineering — Semester 5
Course: Microcontrollers · PBCST504
 
