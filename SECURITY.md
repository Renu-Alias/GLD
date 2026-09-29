# Security Notes

Working notes on how credentials and network trust are handled in this firmware.
Expandable — add further sections here as the design evolves.

---

## 1. Credentials (`secrets.h`)

### Setup

`secrets.h` is created locally from `secrets.h.example` and is **not** committed.
The repo's only `.gitignore` entry is `secrets.h`, so the file is invisible to git
but still sits in the working directory on disk.

Required macros:

| Macro | Purpose |
|---|---|
| `WIFI_SSID` | Hotspot network name |
| `WIFI_PASSWORD` | Hotspot password |
| `FAST2SMS_API_KEY` | Authorization header value for the SMS gateway |
| `ALERT_PHONE_NUMBERS` | Comma-separated 10-digit recipients |

### `#pragma once`

`secrets.h` opens with `#pragma once`, an include guard. It tells the compiler to
process the file only on the first `#include` and skip it thereafter. Without it,
a second translation unit including the same header would redefine macros like
`WIFI_SSID` and fail the build with "macro redefined".

The older, equivalent form is wrapping the file body in
`#ifndef` / `#define` / `#endif`.

### Encoding notes

`WIFI_SSID` values may contain characters that look syntactically significant but
are not, inside a double-quoted string literal:

- **Apostrophes** (`'`) are ordinary characters. Only `"` and `\` need escaping.
- **Smart quotes** — an iOS hotspot named `Renu's iPhone` uses U+2019 (right
  single quotation mark), a 3-byte UTF-8 sequence, not ASCII `'`. This compiles
  and works, but the bytes must match what the hotspot advertises or the
  association will fail. Copy/paste the SSID from the phone's settings rather than
  retyping it.
- The file must be **UTF-8 without a BOM**. A BOM would corrupt the first line
  (`#pragma once`) and break compilation. Verified: the file begins directly with
  `#pragma` (`23 70 72 61 67 6D`).

### Number format

`ALERT_PHONE_NUMBERS` must be comma-separated 10-digit Indian mobiles with **no
`+91` prefix and no spaces**. The delimiter is significant — see §2.

### Operational risk

`secrets.h` holds a live Fast2SMS key and the WiFi password in plaintext. It is
git-ignored, but any of these still leaks it:

- Pasting the file into an issue, chat, or commit
- Cloud backup of the project directory
- A screen share or screenshot

If the file is ever exposed, rotate the Fast2SMS key from the dashboard.

---

## 2. Recipient list encoding (a fixed bug)

`urlEncode()` percent-encodes everything outside the RFC 3986 unreserved set. The
original code applied it to the whole recipient list:

```c
uri += urlEncode(String(ALERT_PHONE_NUMBERS));   // WRONG
```

`ALERT_PHONE_NUMBERS` is a **delimited list**, not an opaque token. Encoding it
turned the delimiter into `%2C`:

```
8921335626,6238455534   →   8921335626%2C6238455534
```

Fast2SMS received that as a single malformed number rather than two recipients and
rejected the request. **No SMS would ever have been delivered.** The local
buzzer/LED alarm was unaffected — it is GPIO-only — so the failure would have been
silent: the unit looked healthy while remote alerting was completely dead.

`buildNumbersParam()` now encodes each number individually and joins with literal
commas:

```c
if (result.length() > 0) {
  result += ",";
}
result += urlEncode(number);
```

It also drops entries that are not exactly 10 digits (logging each one) and
returns an empty string if nothing valid remains, so `sendAlertSms()` aborts
cleanly instead of firing a request guaranteed to fail.

`countAlertNumbers()` runs once in `setup()` to print the configured count, so a
typo in `secrets.h` is visible at boot rather than during a leak.

**Verified** by extracting the parsing functions, compiling them against a
`String` stub, and asserting the output. Result: `8921335626,6238455534`, no
`%2C` present, correct percent-encoding on the message body.

### A related trap

Per-number encoding is correct *because* these values are digits. The
delimiter-safe path only holds when the comma is the sole structural character.
If the list ever gains a country prefix, a `+91` form, or spaces, the parser
silently drops it as malformed rather than sending to the wrong number.

---

## 3. TLS trust (`certs.h`)

### The problem with `setInsecure()`

The SMS request transmits `FAST2SMS_API_KEY` in the `Authorization` header. The
original code did:

```c
WiFiClientSecure client;
client.setInsecure();
```

This encrypts the traffic but **disables certificate validation**. Any device on
the WiFi network can present a self-signed certificate, terminate the connection,
and read the API key. The TLS gave obfuscation, not security.

### What the root certificate does

The ESP32 has no built-in trust store. The handshake works like this:

```
ISRG Root X1        self-signed, public. Holds the private key.
   └─ signs → R3   Let's Encrypt intermediate (public key only)
         └─ signs → fast2sms.com's certificate   ← presented in the handshake
```

The device receives only the leaf. It walks *up* the chain verifying each
signature until it reaches a certificate it already trusts — the **anchor of
trust**. Without that anchor, there are only two options:

- Trust everything (`setInsecure()`) — vulnerable to interception
- Trust nothing — every request fails

`setCACert(ROOT_CA_ISRG_X1)` supplies the anchor, so the handshake succeeds only
if the presented chain terminates at a root the firmware deliberately trusts.

```c
WiFiClientSecure client;
client.setCACert(ROOT_CA_ISRG_X1);
```

### Why `certs.h` is committed

The root certificate is **public data**, not a secret. Anyone can download it.
Its trustworthiness comes from your firmware pinning that exact root, not from
concealing it. Committing it means a fresh clone builds without an extra manual
step, and reviewers can verify the fingerprint. `secrets.h` stays ignored.

### Pinning a single root

A browser-style trust store holds ~150 roots and costs hundreds of KB of flash.
This firmware makes one HTTPS request to one known host, so it pins the single
root that host's chain terminates at.

**Tradeoff:** if Fast2SMS switches certificate authority, the connection fails
until `certs.h` is updated. That is a safe failure — a hard error in the serial
log, never a silent downgrade. If another HTTPS endpoint is added later signed by
a different CA, add that root to the same file. `setCACert` *replaces* the list;
it does not append.

### Verification performed

The certificate was **not** transcribed from memory. It was fetched, then its
fingerprint checked against an independent third-party source (the ISRG 2021
WebTrust audit report) before being written to the file:

```
SHA-256: 96:BC:EC:06:26:49:76:F3:74:60:77:9A:CF:28:C5:A7:CF:E8:A3:C0:AA:E1:1A:8F:FC:EE:05:C0:BD:DF:08:C6
         Subject: C = US, O = Internet Security Research Group, CN = ISRG Root X1
         Valid: Jun 2015 - Jun 2035
```

The C string in `certs.h` was then compiled with gcc, dumped back out,
base64-decoded and re-hashed to confirm the macro line-continuation preserved
every byte: 1391 bytes DER, fingerprint identical. Re-verify with:

```powershell
# decode certs.h's macro, hash the DER, compare against the value above
```

---

## 4. Known limitations

- **The message travels in the URL query string**, not a request body
  (`GET /dev/bulkV2?route=q&message=...&numbers=...`). `HTTPClient` may exceed
  its internal URL buffer for longer messages. The 160-char trim keeps it safe
  today; extending the alert text could break it. A `POST` body would be the
  robust fix.
- **No compile verification of the firmware itself.** No ESP32/Arduino
  toolchain (`arduino-cli`, `platformio`, `idf.py`) is installed on the dev
  machine, so `main.c` has not been through a real compiler. The
  `WiFiClientSecure` / `HTTPClient` calls are unverified by a compiler. The
  string and parsing code changed in this work *was* extracted and tested under
  gcc. Install the ESP32 board package to get a genuine build.
- **Retry behaviour is unpolished.** When WiFi is down, `sendAlertSms()` returns
  before setting `lastSmsAttemptTime`, so the `DANGER` branch re-enters every
  loop iteration and prints a "wifi offline" line each time. The upside is that
  the alert fires immediately once connectivity returns, which is the correct
  priority for a gas leak. The cost is serial log noise.
- **Supabase logging described in `README.md` is not implemented** in the
  firmware. The README currently overstates the remote layer.
