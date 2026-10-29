# GLD (Gas Leak Detection) - Comprehensive Project Documentation

## Overview
Smart LPG Gas Leak Detection & Alert System for domestic kitchens using ESP32 + MQ-6 sensor with local alarm and web dashboard.

## Key Components
- **Firmware**: GLD.ino (ESP32, Arduino C++) - ADC sampling, state machine, local alarms
- **Dashboard Server**: Node.js bridge (Express) reading serial telemetry, serving HTTP/SSE
- **Dashboard UI**: React + Vite frontend
- **Databases**: PostgreSQL (incident history), SQLite (trend readings)

## Hardware
ESP32, MQ-6 (GPIO33), RGB LED (GPIO32/2/4), Passive buzzer (GPIO25 via 2N2222), Button (GPIO27), 10kΩ load resistor.

## Firmware State Machine
- SAFE: Green LED, buzzer off (gas < 500)
- WARNING: Amber LED, 1000Hz beep 300ms (>=500, <800) 
- DANGER: Red solid LED, 2000Hz beep 150ms (>=800)
Hysteresis: WARNING clears <420, DANGER clears <700. 20s warmup blinks blue.

## Alerts
The Node server sends a Telegram message when a leak opens (WARNING, ADC 500) and one more if it escalates to DANGER (ADC 800). The ESP32 sends nothing itself. Rules: Dashboard/server/src/alertPolicy.js.

## Dashboard
Runs on port 4310. Reads TELEM/#CFG from serial 115200 baud. Auto-detects ESP32 ports. Supports demo mode.
API: /api/health, /api/snapshot, /api/stream (SSE). Serves built frontend from dist/.

## Databases
- PostgreSQL: leakage_history table for incidents (started_at, ended_at, peak_adc, severity). Generated resolved/duration_ms.
- SQLite: readings.db for trend chart data.

## Quick Start
1. Copy secrets.h.example to secrets.h, add WiFi credentials
2. Flash GLD.ino to ESP32
3. Create a Telegram bot and fill Dashboard/server/.env (see HOW_TO_RUN.md)
4. cd Dashboard/server && npm install && npm start
5. Open http://127.0.0.1:4310

## Files
See README.md, DATABASE_SCHEMA.md, GLD_info.md for details.