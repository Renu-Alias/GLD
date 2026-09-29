# Smart LPG Gas Leak Detection & Alert System

An embedded IoT system for real-time LPG leak detection and local + remote alerting in domestic kitchens.

## Overview

LPG is colourless and essentially odourless — the safety odorant added to it only works as a warning if someone is present, awake, and able to smell it. This project closes that awareness gap with a low-cost, always-on ESP32 monitor that continuously samples the air near the cylinder and stove, raises an immediate local audible + visual alarm the instant a leak is detected, and pushes a remote SMS notification so that someone away from the kitchen is informed too.

The local alarm path is entirely GPIO-driven and has **no dependency on WiFi** — it keeps working even during a network or connectivity outage. Remote notification rides on top of that as a best-effort layer.

## Features

- Continuous LPG concentration sensing with the MQ-6 gas sensor
- Local audible alarm (buzzer, two distinct tones) and visual alarm (RGB LED), both WiFi-independent
- Manual-override button to mute the buzzer during an alarm
- SMS alert to registered mobile numbers with gas level and timestamp
- TLS-pinned HTTPS to the SMS gateway, with the API key verified as a real `Authorization` header

> **Not implemented:** Supabase cloud logging, a real-time sync dashboard, and sensor/alert history storage are described in earlier drafts of this document but **do not exist in the firmware**. There is no code for them. See *Known gaps* below.

## System Architecture

The system is organized into four layers:

1. **Sensing Layer** — MQ-6 gas sensor (via a 10 kΩ load resistor) continuously samples air near the cylinder/stove; a push button provides a second local input.
2. **Control / Processing Layer** — ESP32 runs the embedded-C firmware: ADC sampling → threshold comparison → GPIO control → WiFi. Powered through a regulated 9 V/USB supply with a stabilizing capacitor on the rail.
3. **Local Output Layer** (WiFi-independent) — buzzer and RGB LED driven directly by GPIO, so the physical alarm fires regardless of network state.
4. **Remote Layer** (over WiFi) — SMS via the Fast2SMS gateway.

Detection → local alarm (layers 1–3) forms a closed loop that never touches the network; the remote layer is an add-on, not a dependency.

## Hardware Components

| Component | Qty | Role |
|---|---|---|
| ESP32 dev board | 1 | Processing + built-in WiFi |
| MQ-6 LPG gas sensor module | 1 | Gas concentration sensing |
| 5 mm 4-pin common-cathode RGB LED | 1 | Visual alarm indicator |
| 5 V **passive** buzzer | 1 | Audible alarm |
| 2N2222 transistor | 1 | Buffers the buzzer driven by GPIO PWM |
| 1 kΩ resistor | 1 | Transistor base resistor |
| 220 Ω resistors | 3 | RGB LED current limiting |
| 10 kΩ load resistor | 1 | MQ-6 signal conditioning |
| Push button | 1 | Manual override / alarm mute |
| Stabilizing capacitor | 1 | Smooths the power rail |
| Breadboard, jumper wires | — | Prototyping |
| 9 V/USB power supply + regulator | 1 | Power source |
| Enclosure | 1 | Housing |

The buzzer **must be passive** — the firmware drives it with `tone()`, which requires a passive element. An active buzzer will emit a fixed tone and the two-stage WARNING/DANGER distinction will not be audible.

## Pin Map (ESP32)

These values are taken from `GLD.ino` and are the authoritative source. An earlier version of this README listed different pins; if you wired hardware from that version, **re-check every connection**.

| Signal | ESP32 Pin | Notes |
|---|---|---|
| MQ-6 VCC | 3V3 | |
| MQ-6 GND | GND | |
| MQ-6 AO | **GPIO33** | ADC1_CH5 |
| RGB LED – Red | **GPIO32** | via 220 Ω |
| RGB LED – Green | **GPIO2** | via 220 Ω — see caution below |
| RGB LED – Blue | **GPIO4** | via 220 Ω — **currently unused**, see Known gaps |
| RGB LED – common cathode | GND | |
| Buzzer control (2N2222 base) | **GPIO25** | via 1 kΩ |
| Push button | **GPIO27** | `INPUT_PULLUP`, active-low |

> **Caution on GPIO2:** it is an ESP32 strapping pin, sampled at reset to help select the boot mode. Avoid forcing it from a load during power-on. It works as an output in normal operation, but a different pin (e.g. GPIO26) is a safer choice for the green channel if you are still changing the wiring.

MQ-6 is on GPIO33 (ADC1), deliberately — ADC2 pins are unusable while WiFi is active, and this project needs ADC reads and WiFi to coexist.

## Firmware Logic

The firmware (`GLD.ino`, Arduino C++) runs a loop that:

1. **ADC sampling** — reads the MQ-6 analog output on GPIO33 with `analogRead()`
   (12-bit, 0–1023) at the default 11 dB attenuation, giving roughly the full
   0–3.3 V range. Sampling is gated to one read every `SAMPLE_INTERVAL_MS`
   (250 ms); the rest of the loop runs free so the mute button stays responsive.
2. **Threshold logic** — the raw reading is compared against the four threshold
   defines described under *Firmware Logic* below.
3. **State machine** — three states drive all outputs, latched so the state
   persists between samples. Transitions use **hysteresis**, so a reading that
   oscillates around a threshold cannot make the alarm flicker:
   - **SAFE** — LED green, buzzer off, alarm un-muted, SMS re-armed
   - **WARNING** — entered at **≥ 500**, left below **420**. LED amber (red +
     green), buzzer beeps at **1000 Hz**, toggling every 300 ms
   - **DANGER** — entered at **≥ 800**, left below **700**. LED **solid red**,
     buzzer beeps at **2000 Hz**, toggling every 150 ms, and one SMS is sent
     per leak event

   The clear thresholds sit 80–100 counts below the trip thresholds, which is
   the gap that prevents chatter. A jump from SAFE straight to DANGER (e.g. gas
   arrives while you are looking at the serial monitor) escalates in a single
   sample rather than passing through WARNING first.

4. **Manual override** — the button toggles the buzzer mute whenever the state is
   not SAFE. Muting does **not** clear the alarm state; the LED keeps showing the
   real condition, and the mute is released automatically on returning to SAFE.
5. **SMS** — one message per leak event, not re-sent every iteration. While the
   unit stays in DANGER it retries every `SMS_RETRY_INTERVAL_MS` (60 s). If the
   network is down, no request is attempted at all and the "wifi offline" notice
   is rate-limited to once every 5 s; the moment connectivity returns the alert
   is sent rather than waiting out the retry window.
6. **Warm-up** — for the first `SENSOR_WARMUP_MS` (20 s) after boot the firmware
   **ignores gas readings entirely** and blinks the blue LED to show it is
   calibrating. This prevents a false alarm from an unstabilised MQ-6. It has
   no effect on the timer starting from the end of `setup()`.

### Alarm behaviour under a blocking network call

The SMS request is synchronous and can take several seconds. Immediately before
the request the firmware re-asserts a continuous tone on the buzzer
(`holdToneDuringSms()`), so the alarm keeps sounding through the network call
instead of dropping into the silent half of its beep cycle. The beep cadence
resumes normally once the request returns.

### Things the firmware still does *not* do

- **The red LED does not blink.** DANGER holds red solid. There is no blink
  pattern and no LED brightness/PWM control.
- **No leak-to-alarm latency measurement** or response-time logging exists in
  the code.
- **Thresholds are uncalibrated placeholders** (500/800/420/700). See Calibration.

## Getting Started

1. Wire the hardware per the pin map above.
2. Install **Arduino IDE 2.x**.
3. Add the ESP32 board support: *Tools → Board → Boards Manager*, search for **esp32**, install **“esp32 by Espressif Systems”** (v3.x).
4. Create your local credentials file by copying `secrets.h.example` to `secrets.h` and filling it in:
   ```powershell
   Copy-Item secrets.h.example secrets.h
   notepad secrets.h
   ```
   `secrets.h` is git-ignored and must not be committed. It needs:
   - `WIFI_SSID` / `WIFI_PASSWORD` — the network the ESP32 joins
   - `FAST2SMS_API_KEY` — from the Fast2SMS developer dashboard
   - `ALERT_PHONE_NUMBERS` — comma-separated 10-digit Indian mobiles, **no `+91`**, no spaces
5. Open the sketch: *File → Open…* and select **`GLD.ino`**.

   > The sketch folder name and the `.ino` file name must match, so the folder must be `GLD` and the file `GLD.ino`. If you rename one, rename the other. This is a hard requirement of the Arduino build system, not a convention.

6. Select *Tools → Board → ESP32 Arduino → ESP32 Dev Module*, pick the correct COM port, then compile and upload.

   Alternatively, with [arduino-cli](https://arduino.github.io/arduino-cli/latest/getting-started/):
   ```powershell
   arduino-cli core install esp32:esp32
   arduino-cli compile --fqbn esp32:esp32:esp32 GLD.ino
   arduino-cli upload  --fqbn esp32:esp32:esp32 -p COMx GLD.ino
   ```

### The board cannot join an iPhone hotspot in all cases

Recent iPhones default Personal Hotspot to 5 GHz with WPA3, which most ESP32 boards cannot associate with. If WiFi connection times out, set the hotspot to **2.4 GHz** and **WPA2**. The serial log prints the failure reason at 115200 baud.

## Calibration

MQ-6 units vary — calibrate before deployment:

1. Power on and wait for the blue warm-up blink to stop. The firmware ignores
   readings for the first 20 s, so the serial log is clean during warm-up.
2. Monitor the raw ADC value in clean air to establish a baseline.
3. In a well-ventilated area, briefly expose the sensor to a small LPG source and note the reading.
4. Adjust all four thresholds in `GLD.ino` to suit, then re-test:

   | Define | Default | Meaning |
   |---|---|---|
   | `WARNING_THRESHOLD` | 500 | enter WARNING at or above this |
   | `WARNING_CLEAR_THRESHOLD` | 420 | leave WARNING below this |
   | `DANGER_THRESHOLD` | 800 | enter DANGER at or above this |
   | `DANGER_CLEAR_THRESHOLD` | 700 | leave DANGER below this |

   Each clear threshold must stay comfortably below its trip threshold (about
   80–100 counts). If you set them too close, the hysteresis is lost and the
   alarm will chatter. The defaults are placeholders, not calibrated values.

## Testing Checklist

- Boot: blue LED blinks for 20 s, then the LED shows green in clean air
- Green → amber → red transition, buzzer tone change from 1000 Hz to 2000 Hz
- Exactly one SMS on a brief, ventilated gas exposure, with a plausible gas level
- **SMS timestamp matches your wall clock** — this catches timezone bugs, which
  are easy to reintroduce
- Pressing the button mutes the buzzer during an active alarm without clearing
  the LED state; pressing again unmutes
- Buzzer returns on its own once the reading drops below `WARNING_CLEAR_THRESHOLD`
- Green state and SMS re-arm after the gas clears

## Known gaps

Honest list of what is missing or weak, so it is not mistaken for working:

| Gap | Impact |
|---|---|
| Supabase logging / dashboard | **Not implemented at all**, despite earlier docs |
| Red LED never blinks | No visual urgency escalation in DANGER |
| Thresholds uncalibrated | Defaults are placeholders; see Calibration |
| SMS send is synchronous | Blocks the loop for up to ~5 s; mitigated by holding a continuous tone, but the button and LED freeze for that duration |
| Thresholds are absolute ADC counts | No compensation for sensor drift or ambient temperature |
| Single shared MQTT-free retry | A permanently failing gateway is retried every 60 s forever, with no backoff or give-up |
| Green LED on GPIO2 | Strapping pin; see the caution in the pin map |
| Calibrated threshold values | Defaults are placeholders |

## Project Scope

**Included:** continuous MQ-6 sensing, GPIO-driven local alarm with a two-stage tone, SMS alerting, TLS-pinned transport.

**Not included (future work):** automatic regulator/electricity shutoff, ventilation control, cylinder-weight monitoring, battery backup for mains cuts, cloud logging and dashboards, and field validation across multiple real kitchen installations (this cycle is lab/prototype testing only).

## Security

Credential handling, the recipient-list encoding bug, and the TLS root pinning are documented in [SECURITY.md](SECURITY.md).
