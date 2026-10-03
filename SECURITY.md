# Security Notes

Working notes on how credentials and network trust are handled in this firmware.
Expandable - add further sections here as the design evolves.

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
| `CD_API_KEY` | `Authorization` header value for CircuitDigest Cloud |
| `CD_TEMPLATE_ID` | Numeric SMS template ID (`108` for this project) |
| `CD_MOBILE` | Single recipient, `91` + 10 digits |

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
- **Smart quotes** - an iOS hotspot named `Renu's iPhone` uses U+2019 (right
  single quotation mark), a 3-byte UTF-8 sequence, not ASCII `'`. This compiles
  and works, but the bytes must match what the hotspot advertises or the
  association will fail. Copy/paste the SSID from the phone's settings rather than
  retyping it.
- The file must be **UTF-8 without a BOM**. A BOM would corrupt the first line
  (`#pragma once`) and break compilation. Verified: the file begins directly with
  `#pragma` (`23 70 72 61 67 6D`).

### Number format

`CD_MOBILE` is a **single** recipient: `91` followed by the 10-digit number, with
**no `+`, no spaces and no separators**. The country code is required by the
gateway's international format - do not read it as part of the subscriber number.

### The recipient must be OTP-linked

CircuitDigest Cloud only delivers to numbers already linked to the account via OTP
verification (`SMS -> Link Phone Number`). An unlinked number is rejected by the
API. This is deliberate anti-abuse policy, and it has a security upside worth
keeping: an attacker who obtained both the API key and `CD_MOBILE` still cannot
redirect alerts to a number of their own choosing.

The upside has a matching downside - you cannot text a neighbour or a second
family member who is not linked, and you must verify a number on the cloud
dashboard before the device is of any use.

### Operational risk

`secrets.h` holds a live CircuitDigest key and the WiFi password in plaintext. It
is git-ignored, but any of these still leaks it:

- Pasting the file into an issue, chat, or commit
- Cloud backup of the project directory
- A screen share or screenshot

If the file is ever exposed, rotate the CircuitDigest key from *Account -> API
Key*. Rotating it does **not** require reflashing: the key is sent as an
`Authorization` header on every request, so edit `secrets.h`, recompile, re-flash.

---

## 2. Message construction and template variables

### Why the payload is hand-built

The gateway takes the message as **template variables**, not free text. The
request body is assembled directly:

```c
String payload = "{\"mobiles\":\"" + String(CD_MOBILE) + "\"" +
                 ",\"var1\":\"" + String(GAS_LABEL)   + "\"" +
                 ",\"var2\":\"" + alertStateLabel(state) + "\"}";
```

producing, for a leak:

```json
{"mobiles":"919876543210","var1":"LPG gas level","var2":"DANGER"}
```

Two consequences worth knowing before editing this:

- **No user-supplied text reaches the body.** Every field is a compile-time
  macro or a fixed string from `alertStateLabel()`, so there is no JSON-escaping
  or injection surface today. If you ever interpolate the gas reading or a
  caller-supplied string, this stops being true and you must escape properly.
- **There is no timestamp, and there cannot easily be one.** Template variables
  are capped at 30 characters and reject special characters, so there is nowhere
  to put a clock time. The earlier design interpolated one; it was removed
  rather than quietly truncated by the gateway. Correlate SMS against the serial
  log.

`buildSmsPayload()` is exercised directly by the host test harness, which asserts
the exact byte-for-byte JSON above.

### Gateway migration, and a bug it inherited

The original code targeted Fast2SMS with a **comma-separated recipient list**,
and percent-encoded the whole list:

```c
uri += urlEncode(String(ALERT_PHONE_NUMBERS));   // WRONG
```

`ALERT_PHONE_NUMBERS` was a **delimited list**, not an opaque token. Encoding it
turned the delimiter into `%2C`:

```
8921335626,6238455534   ->   8921335626%2C6238455534
```

Fast2SMS received that as a single malformed number rather than two recipients
and rejected the request. **No SMS would ever have been delivered.** The local
buzzer/LED alarm was unaffected - it is GPIO-only - so the failure would have
been silent: the unit looked healthy while remote alerting was completely dead.

That entire encoding path is now gone. CircuitDigest takes one recipient in a
JSON body, so there is no delimiter to mangle and no `urlEncode()` call to get
wrong. The single-recipient design also removed the `ALERT_PHONE_NUMBERS`
separator trap described in the original notes - with one number there is no
ambiguity between data and structure.

### Why Fast2SMS was abandoned

Two independent blockers, neither fixable in firmware:

1. **Account gate.** The API rejected requests with HTTP 400 / status code 999
   until a completed 100 INR transaction existed on the account. Not a code
   defect, and not something the firmware can work around.
2. **Chain mismatch.** Fast2SMS presented a chain terminating at GlobalSign ECC
   Root CA - R4, while `certs.h` pinned only ISRG Root X1 - so the pinned-anchor
   handshake could never succeed. Fixing that would have meant loosening trust or
   chasing their CA of the month.

CircuitDigest was chosen instead: it works from a free account, and its chain
terminates at a root that could be verified independently (section 3).

---

## 3. TLS trust (`certs.h`)

### The problem with `setInsecure()`

The SMS request transmits `CD_API_KEY` in the `Authorization` header. The
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
ISRG Root X2       self-signed, public. Holds the private key.
   |
   +-- signs -> Root YE      Let's Encrypt cross-signed intermediate
          |
          +-- signs -> YE2   Let's Encrypt intermediate
                 |
                 +-- signs -> circuitdigest.cloud   <- presented in the handshake
```

The device receives only the leaf. It walks *up* the chain verifying each
signature until it reaches a certificate it already trusts - the **anchor of
trust**. Without that anchor, there are only two options:

- Trust everything (`setInsecure()`) - vulnerable to interception
- Trust nothing - every request fails

`setCACert(SMS_ROOT_CA_BUNDLE)` supplies the anchor, so the handshake succeeds
only if the presented chain terminates at a root the firmware deliberately trusts.

```c
WiFiClientSecure client;
client.setCACert(SMS_ROOT_CA_BUNDLE);
```

### Why `certs.h` is committed

The root certificate is **public data**, not a secret. Anyone can download it.
Its trustworthiness comes from your firmware pinning that exact root, not from
concealing it. Committing it means a fresh clone builds without an extra manual
step, and reviewers can verify the fingerprint. `secrets.h` stays ignored.

### Why the bundle holds three roots

`setCACert` takes one PEM string, and that string may contain **several**
certificates - the ESP32 implementation splits on the `-----END CERTIFICATE-----`
boundary and treats each block as an independent anchor. `SMS_ROOT_CA_BUNDLE`
therefore holds three roots:

| Root | Bytes | Role |
|---|---|---|
| GlobalSign ECC Root CA - R4 | 480 | leftover from Fast2SMS |
| ISRG Root X1 | 1391 | leftover from Fast2SMS |
| ISRG Root X2 | 543 | **required** - current CircuitDigest anchor |

Only the last is load-bearing today. The first two are retained because they are
~1.9 KB of flash total and dropping them buys little; removing them is a safe
simplification if you prefer a minimal bundle. Keeping them costs nothing and
removes a tripwire if the gateway ever falls back to an older chain.

Note the inverse trap: `setCACert` **replaces** the list, it does not append. A
second call with a single root discards the bundle. Pass `SMS_ROOT_CA_BUNDLE`
every time.

**Tradeoff:** if CircuitDigest switches certificate authority, the connection
fails until `certs.h` is updated. That is a safe failure - a hard error in the
serial log, never a silent downgrade.

### Verification performed

The certificates were **not** transcribed from memory. The live chain was fetched
directly from the endpoint and its SHA-256 fingerprints captured:

```
0. CN=circuitdigest.cloud
   SHA256: 5B:3C:D2:B8:D5:B5:86:9F:22:04:F6:2C:9F:67:E0:D8:D0:F3:C0:B4:A3:86:4A:F1:3F:6C:40:45:6D:BD:5E:45
1. CN=YE2, O=Let's Encrypt, C=US
   SHA256: 97:65:8D:E8:C6:8D:FA:98:AC:E1:E5:02:8A:63:D5:4A:1A:AE:91:1B:3E:21:47:10:76:C6:85:0C:D0:8C:BA:B4
2. CN=Root YE, O=ISRG, C=US
   SHA256: 0F:C0:90:1C:CA:2B:AE:9E:9F:DB:B0:2D:50:D0:2F:10:94:F7:B3:66:72:08:69:91:B9:E8:97:62:6D:C4:85:F0
3. CN=ISRG Root X2, O=Internet Security Research Group, C=US
   SHA256: 69:72:9B:8E:15:A8:6E:FC:17:7A:57:AF:B7:17:1D:FC:64:AD:D2:8C:2F:CA:8C:F1:50:7E:34:45:3C:CB:14:70
```

Element 3 is the self-signed anchor. Root YE (element 2) is an *intermediate*,
cross-signed by X2 - so the device must trust X2 specifically, not Root YE, and
not the `Root YE` self-signature some tools show.

The three PEMs in `certs.h` were then parsed out of the C macro, base64-decoded
and re-hashed to confirm the line-continuation escaped every byte intact. All
three match, and the X2 entry reproduces the live anchor above exactly:

```
GlobalSign ECC Root CA - R4  480 bytes  B0:85:D7:0B:96:4F:19:1A:73:E4:AF:0D:54:AE:7A:0E:07:AA:FD:AF:9B:71:DD:08:62:13:8A:B7:32:5A:24:A2
ISRG Root X1                1391 bytes  96:BC:EC:06:26:49:76:F3:74:60:77:9A:CF:28:C5:A7:CF:E8:A3:C0:AA:E1:1A:8F:FC:EE:05:C0:BD:DF:08:C6
ISRG Root X2                 543 bytes  69:72:9B:8E:15:A8:6E:FC:17:7A:57:AF:B7:17:1D:FC:64:AD:D2:8C:2F:CA:8C:F1:50:7E:34:45:3C:CB:14:70
```

Re-verify the bundle at any time:

```powershell
# parse certs.h PEM blocks, hash each DER, compare against the table above
```

---

## 4. Known limitations

- **The SMS carries no timestamp.** Template variables cannot hold one, so the
  message cannot be correlated to a wall-clock time on its own. This was a
  deliberate removal, not an oversight.
- **No build for the real target.** No ESP32/Arduino toolchain (`arduino-cli`,
  `platformio`) is installed on the dev machine, so `GLD.ino` has never been
  through the Xtensa compiler. It *has* been compiled with g++ against stub
  Arduino headers, which proves the logic compiles and passes 19 assertions
  (payload shape, retry capping, offline handling, hysteresis) but does **not**
  prove the hardware calls are correct. Install the ESP32 board package and build
  before trusting it on a real board.
- **The SMS send is synchronous and blocks the main loop** for the duration of
  the request (up to `SMS_HTTP_TIMEOUT_MS`, plus DNS and the TLS handshake). The
  buzzer is deliberately held to a continuous tone across the call so the alarm
  never goes silent, but the mute button and LED are unresponsive meanwhile. A
  FreeRTOS task on core 0 would remove this entirely.
- **Retry is flat and capped.** `SMS_RETRY_INTERVAL_MS` (15 min) with
  `SMS_MAX_ATTEMPTS_PER_EVENT` (3). There is no exponential backoff, and after
  the third attempt the firmware stops trying until the state returns to SAFE -
  so a leak that begins while the gateway is down produces no alert at all, and
  the serial log is the only evidence. The cap is deliberate: it is what keeps a
  60 s retry loop from burning the entire 15/day allowance in ~15 minutes.
- **Daily quota is invisible to the firmware.** The gateway allows 15 SMS/day.
  Five sustained leak events exhaust it. The device cannot see the counter, so
  exhaustion fails silently until the quota resets.
- **Only OTP-linked recipients can be alerted**, by gateway policy (section 1).
- **The bundle still carries two unused roots** from the previous gateway
  (section 3). Harmless, but they are dead weight.
- **Supabase logging described in `README.md` is not implemented** in the
  firmware. The README has been corrected to say so explicitly.
