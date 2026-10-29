# How to run GLD

An ESP32 watches an MQ-6 gas sensor and sounds a buzzer and LED when LPG shows up. A small Node server reads the board over USB and sends a Telegram message to your phone.

The buzzer and LED work without WiFi or a laptop. The Telegram message needs the board plugged into a computer that is running the server and online.

It sends one message per leak. It sends nothing when the leak clears.

## What you need

- The ESP32 board wired as in the README pin map
- A USB data cable (some cables only charge)
- A computer with Node.js 20 or newer
- Telegram on your phone

## 1. Get the code

```bash
git clone https://github.com/Renu-Alias/GLD.git
cd GLD
```

## 2. Flash the board

1. Copy `secrets.h.example` to `secrets.h` and fill in your WiFi name and password. `secrets.h` is gitignored.
2. Open `GLD.ino` in the Arduino IDE with the ESP32 board package installed.
3. Pick your ESP32 board and port, then upload.

Skip this step if the board already runs the firmware.

## 3. Make a Telegram bot

1. In Telegram, message **@BotFather** and send `/newbot`. Copy the token it gives you.
2. Open your new bot, press Start, and send it any message.
3. Find your chat id:
   ```bash
   curl -s "https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates"
   ```
   Look for `"chat":{"id":123456789`. That number is your chat id.

A bot cannot message you first, which is why step 2 matters. Without it the chat id lookup comes back empty.

## 4. Configure the server

```bash
cd Dashboard/server
cp .env.example .env
```

Edit `.env`:

```
TELEGRAM_BOT_TOKEN=<token from BotFather>
TELEGRAM_CHAT_ID=<your chat id>
DATABASE_URL=
```

`DATABASE_URL` is optional. Leave it empty and the dashboard works, but incident history is not saved to Postgres. Alerts do not depend on it.

Never commit `.env`. The token lets anyone send messages as your bot. If it leaks, send `/revoke` to @BotFather.

## 5. Start the server

Plug the ESP32 in, then:

```bash
npm install
npm start
```

Open http://127.0.0.1:4310 for the dashboard. Keep the terminal open, because closing it stops the alerts.

If the server cannot find the board, give it the port:

| System | Port | Command |
|---|---|---|
| Linux | `/dev/ttyUSB0` | `SERIAL_PORT=/dev/ttyUSB0 npm start` |
| Windows | `COM7` (check Device Manager) | `$env:SERIAL_PORT="COM7"; npm start` |

`npm run ports` lists what the server can see. On Linux your user must be in the `dialout` group to open the port.

## 6. Test it

With the server running, hold something gassy near the sensor, such as an unlit lighter. When the reading passes ADC 500 you should hear the buzzer and get a message like this on your phone:

```
⚠️ LPG LEAK: WARNING

Gas level: 512 (sensor reading)
Time: 29 Oct, 11:42 pm

Gas is building up. Close the cylinder regulator, open windows and doors, and keep flames and switches off.
```

## If it does not work

| Symptom | Likely cause |
|---|---|
| `[alert] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID` | `.env` is not in `Dashboard/server`, or it is named `env` without the dot |
| `Telegram rejected the message: 400` | Wrong chat id, or you never sent your bot a message |
| `Telegram rejected the message: 401` | Wrong or revoked bot token |
| No board found | Charge-only cable, or no `dialout` access on Linux |
| Buzzer sounds, no message | Server not running, laptop offline, or the board is not plugged into it |

Do not use `npm run demo` with real credentials. It feeds fake readings, and nobody has checked whether those send a real alert.
