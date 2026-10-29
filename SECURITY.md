# Security Notes

How secrets and network access are handled. The ESP32 no longer talks to any cloud service. Alerts go out from the Node server, so most of what matters is on the computer running it.

## Secrets

| Secret | Lives in | Git |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | `Dashboard/server/.env` | ignored |
| `TELEGRAM_CHAT_ID` | `Dashboard/server/.env` | ignored |
| `DATABASE_URL` (holds the Postgres password) | `Dashboard/server/.env` | ignored |
| `WIFI_SSID`, `WIFI_PASSWORD` | `secrets.h` | ignored |

`.gitignore` covers `.env`, `.env.*`, `*.env` and `env`. The last two exist because a secrets file saved without its leading dot was nearly committed once. `.env.example` is tracked and has no values.

Before every push, run `git status` and look for anything that is not source.

## If the bot token leaks

Anyone with the token can send messages as your bot and read what people send to it. It gives no access to your Telegram account.

1. Send `/revoke` to @BotFather and pick the bot.
2. Put the new token in `.env`.
3. Restart the server.

The same goes for a token pasted into a chat, an issue or a screenshot.

## What the alert reveals

Each message has a gas level, a time and a safety instruction. It has no address and no name. Telegram bot messages are not end-to-end encrypted, so Telegram's servers can read them.

## The dashboard has no login

The server binds to `127.0.0.1` by default, so only the computer it runs on can open it. Setting `HOST=0.0.0.0` makes it reachable from the whole network with no password. The API also sends `access-control-allow-origin: *`, so any web page open on a machine that can reach it can read the readings. The routes are read-only (`GET` and `OPTIONS`). Only expose it on a network you trust.

## Known limits

- **Alerts depend on a computer.** If the server is off, offline, or the board is unplugged, the buzzer and LED still sound and no message is sent.
- **A failed send is not retried.** If Telegram is unreachable when a leak opens, that message is lost. The server logs `[alert] Failed to send`.
- **One recipient.** `TELEGRAM_CHAT_ID` holds one chat.
- **Not SMS.** The phone needs the Telegram app and a data connection.
- **`DATABASE_URL` is optional.** Alerts do not need it. Incident history is not saved without it.
