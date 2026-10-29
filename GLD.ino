#include <Arduino.h>
#include <WiFi.h>

#include "secrets.h"

#define MQ6_PIN 33
#define BUZZER_PIN 25

#define RED_PIN 32
#define GREEN_PIN 2
#define BLUE_PIN 4

#define BUTTON_PIN 27

#define WARNING_THRESHOLD 500
#define WARNING_CLEAR_THRESHOLD 420
#define DANGER_THRESHOLD 800
#define DANGER_CLEAR_THRESHOLD 700

#define SENSOR_WARMUP_MS 20000UL
#define SAMPLE_INTERVAL_MS 250UL
#define LOG_INTERVAL_MS 2500UL
#define SAFE_LOG_INTERVAL_MS 10000UL

// Serial telemetry consumed by the Dashboard bridge (Dashboard/server).
// Emitted once per ADC sample, alongside the human-readable log lines.
#define TELEM_TAG "TELEM"
#define CFG_TAG "#CFG"

// Alerts are sent by the Node.js bridge (Telegram). The ESP32 only raises the local alarm.

#define WIFI_CONNECT_TIMEOUT_MS 20000UL
#define WIFI_RETRY_INTERVAL_MS 15000UL

#define DEBOUNCE_MS 50UL

#define BUZZER_WARN_TONE_HZ 1000
#define BUZZER_DANGER_TONE_HZ 2000
#define BUZZER_WARN_PERIOD_MS 300UL
#define BUZZER_DANGER_PERIOD_MS 150UL

enum AlarmState {
  STATE_SAFE,
  STATE_WARNING,
  STATE_DANGER
};

AlarmState alarmState = STATE_SAFE;

bool alarmMuted = false;

bool buttonStableState = HIGH;
bool buttonPressHandled = true;
unsigned long lastDebounceTime = 0;

unsigned long lastBuzzerTime = 0;
bool buzzerState = false;

bool wifiReady = false;
unsigned long lastWifiRetryTime = 0;

bool warmupComplete = false;
unsigned long bootTime = 0;

unsigned long lastSampleTime = 0;
unsigned long lastLogTime = 0;

bool connectWifi() {

  Serial.print("[WIFI] connecting to ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startTime = millis();

  while (WiFi.status() != WL_CONNECTED &&
         millis() - startTime < WIFI_CONNECT_TIMEOUT_MS) {
    delay(250);
  }

  wifiReady = (WiFi.status() == WL_CONNECTED);

  if (wifiReady) {
    Serial.print("[WIFI] connected, ip: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("[WIFI] connect timed out, local alarm stays active");
  }

  return wifiReady;
}

void maintainWifi() {

  if (WiFi.status() == WL_CONNECTED) {

    if (!wifiReady) {
      Serial.println("[WIFI] reconnected");
    }

    wifiReady = true;

    return;
  }

  wifiReady = false;

  unsigned long currentTime = millis();

  if (currentTime - lastWifiRetryTime < WIFI_RETRY_INTERVAL_MS) {
    return;
  }

  lastWifiRetryTime = currentTime;

  Serial.println("[WIFI] reconnecting");

  WiFi.reconnect();
}

const char *alertStateLabel(AlarmState state) {

  return (state == STATE_DANGER) ? "DANGER" : "WARNING";
}

bool buttonPressed() {

  bool reading = digitalRead(BUTTON_PIN);

  if (reading != buttonStableState) {
    lastDebounceTime = millis();
    buttonStableState = reading;
    if (reading == LOW) {
      buttonPressHandled = false;
    }
    return false;
  }

  if (millis() - lastDebounceTime < DEBOUNCE_MS) {
    return false;
  }

  if (buttonStableState == HIGH) {
    buttonPressHandled = true;
    return false;
  }

  if (buttonPressHandled) {
    return false;
  }

  buttonPressHandled = true;

  return true;
}

void updateState(int gasValue) {

  if (alarmState == STATE_DANGER) {

    if (gasValue < DANGER_CLEAR_THRESHOLD) {
      alarmState = STATE_WARNING;
      Serial.println("[STATE] DANGER -> WARNING");
    }

  } else if (alarmState == STATE_WARNING) {

    if (gasValue >= DANGER_THRESHOLD) {
      alarmState = STATE_DANGER;
      Serial.println("[STATE] WARNING -> DANGER");
    } else if (gasValue < WARNING_CLEAR_THRESHOLD) {
      alarmState = STATE_SAFE;
      Serial.println("[STATE] WARNING -> SAFE");
    }

  } else {

    if (gasValue >= DANGER_THRESHOLD) {
      alarmState = STATE_DANGER;
      Serial.println("[STATE] SAFE -> DANGER");
    } else if (gasValue >= WARNING_THRESHOLD) {
      alarmState = STATE_WARNING;
      Serial.println("[STATE] SAFE -> WARNING");
    }
  }
}

void setLed(int r, int g, int b) {

  digitalWrite(RED_PIN, r);
  digitalWrite(GREEN_PIN, g);
  digitalWrite(BLUE_PIN, b);
}

void updateBuzzer(unsigned int frequency, unsigned long period) {

  if (alarmMuted) {
    noTone(BUZZER_PIN);
    buzzerState = false;
    return;
  }

  unsigned long currentTime = millis();

  if (currentTime - lastBuzzerTime < period) {
    return;
  }

  lastBuzzerTime = currentTime;

  buzzerState = !buzzerState;

  if (buzzerState) {
    tone(BUZZER_PIN, frequency);
  } else {
    noTone(BUZZER_PIN);
  }
}

void logGas(int gasValue, const char *label) {

  Serial.print("Gas Value: ");
  Serial.print(gasValue);

  if (label != NULL) {
    Serial.print(" state: ");
    Serial.print(label);
  }

  Serial.println();
}

// Thresholds the dashboard renders as its reference lines. Sent once at boot so
// the UI can never drift from the values actually compiled into this firmware.
void emitConfig() {

  Serial.print(CFG_TAG);
  Serial.print(",warn=");
  Serial.print(WARNING_THRESHOLD);
  Serial.print(",danger=");
  Serial.print(DANGER_THRESHOLD);
  Serial.print(",warnClear=");
  Serial.print(WARNING_CLEAR_THRESHOLD);
  Serial.print(",dangerClear=");
  Serial.print(DANGER_CLEAR_THRESHOLD);
  Serial.print(",sampleMs=");
  Serial.print(SAMPLE_INTERVAL_MS);
  Serial.print(",adcMax=1023");
  Serial.println();
}

// One telemetry frame per ADC sample. Key=value comma pairs on a single line so
// the host parser never has to guess at field order.
void emitTelemetry(int gasValue, const char *label) {

  Serial.print(TELEM_TAG);
  Serial.print(",gas=");
  Serial.print(gasValue);
  Serial.print(",state=");
  Serial.print(label == NULL ? "UNKNOWN" : label);
  Serial.print(",up=");
  Serial.print(millis());
  Serial.print(",rssi=");
  Serial.print(WiFi.status() == WL_CONNECTED ? WiFi.RSSI() : 0);
  Serial.print(",muted=");
  Serial.print(alarmMuted ? 1 : 0);
  Serial.print(",warm=");
  Serial.print(warmupComplete ? 0 : 1);
  Serial.println();
}

void setup() {

  Serial.begin(115200);

  pinMode(BUZZER_PIN, OUTPUT);

  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);

  pinMode(BUTTON_PIN, INPUT_PULLUP);

  noTone(BUZZER_PIN);

  emitConfig();

  connectWifi();

  maintainWifi();

  bootTime = millis();

  Serial.print("[WARMUP] MQ-6 stabilising for ");
  Serial.print(SENSOR_WARMUP_MS / 1000);
  Serial.println("s, blue LED blinks while calibrating");
}

void loop() {

  maintainWifi();

  if (buttonPressed()) {

    if (alarmState != STATE_SAFE) {

      alarmMuted = !alarmMuted;

      if (alarmMuted) {
        noTone(BUZZER_PIN);
        buzzerState = false;
        Serial.println("[BUTTON] alarm muted");
      } else {
        Serial.println("[BUTTON] alarm unmuted");
      }
    }
  }

  unsigned long currentTime = millis();

  if (currentTime - lastSampleTime < SAMPLE_INTERVAL_MS) {
    return;
  }

  lastSampleTime = currentTime;

  int gasValue = analogRead(MQ6_PIN);

  if (!warmupComplete && currentTime - bootTime >= SENSOR_WARMUP_MS) {

    warmupComplete = true;

    Serial.println("[WARMUP] complete, gas readings now active");
  }

  if (!warmupComplete) {

    bool blink = ((currentTime / 400UL) % 2) == 0;

    setLed(0, 0, blink ? HIGH : LOW);

    noTone(BUZZER_PIN);
    buzzerState = false;

    if (currentTime - lastLogTime >= LOG_INTERVAL_MS) {
      lastLogTime = currentTime;
      logGas(gasValue, "warming up");
    }

    emitTelemetry(gasValue, "WARMUP");

    return;
  }

  updateState(gasValue);

  if (alarmState == STATE_SAFE) {

    alarmMuted = false;

    setLed(0, HIGH, 0);

    noTone(BUZZER_PIN);
    buzzerState = false;

    if (currentTime - lastLogTime >= SAFE_LOG_INTERVAL_MS) {
      lastLogTime = currentTime;
      logGas(gasValue, "SAFE");
    }

    emitTelemetry(gasValue, "SAFE");

    return;
  }

  if (alarmState == STATE_WARNING) {

    setLed(HIGH, HIGH, 0);

    updateBuzzer(BUZZER_WARN_TONE_HZ, BUZZER_WARN_PERIOD_MS);

  } else {

    setLed(HIGH, 0, 0);

    updateBuzzer(BUZZER_DANGER_TONE_HZ, BUZZER_DANGER_PERIOD_MS);
    // remote alert handled by the bridge
  }

  if (currentTime - lastLogTime >= LOG_INTERVAL_MS) {
    lastLogTime = currentTime;
    logGas(gasValue, alarmState == STATE_WARNING ? "WARNING" : "DANGER");
  }

  emitTelemetry(gasValue, alarmState == STATE_WARNING ? "WARNING" : "DANGER");
}
