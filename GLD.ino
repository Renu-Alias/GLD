#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <time.h>

#include "secrets.h"
#include "certs.h"

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
#define LOG_INTERVAL_MS 1000UL

#define NORMAL_LOG_INTERVAL_MS 5000UL

#define SMS_HOST "www.fast2sms.com"
#define SMS_PATH "/dev/bulkV2"
#define SMS_ROUTE "q"
#define SMS_HTTP_TIMEOUT_MS 5000
#define SMS_RETRY_INTERVAL_MS 60000UL
#define WIFI_CONNECT_TIMEOUT_MS 20000UL
#define WIFI_RETRY_INTERVAL_MS 15000UL
#define IST_OFFSET_SEC 19800

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

bool lastButtonState = HIGH;

unsigned long lastDebounceTime = 0;

unsigned long lastBuzzerTime = 0;
bool buzzerState = false;

bool wifiReady = false;
bool timeSyncStarted = false;
unsigned long lastWifiRetryTime = 0;

bool smsAttempted = false;
unsigned long lastSmsAttemptTime = 0;

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

void startTimeSync() {

  if (timeSyncStarted) {
    return;
  }

  timeSyncStarted = true;

  configTime(IST_OFFSET_SEC, 0, "pool.ntp.org", "time.nist.gov");

  Serial.println("[TIME] ntp sync started");
}

void maintainWifi() {

  if (WiFi.status() == WL_CONNECTED) {

    if (!wifiReady) {
      Serial.println("[WIFI] reconnected");
    }

    wifiReady = true;

    startTimeSync();

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

String urlEncode(const String &text) {

  String encoded = "";

  for (size_t i = 0; i < text.length(); i++) {

    char c = text.charAt(i);

    bool unreserved =
        (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
        (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.' || c == '~';

    if (unreserved) {
      encoded += c;
    } else {
      char escape[4];
      snprintf(escape, sizeof(escape), "%%%02X", (unsigned char)c);
      encoded += escape;
    }
  }

  return encoded;
}

String buildNumbersParam() {

  const String raw = ALERT_PHONE_NUMBERS;

  String result = "";

  size_t start = 0;

  for (size_t i = 0; i <= raw.length(); i++) {

    if (i != raw.length() && raw.charAt(i) != ',') {
      continue;
    }

    String number = raw.substring(start, i);
    number.trim();
    number.replace(" ", "");

    if (number.length() > 0) {

      if (number.length() != 10) {

        Serial.print("[SMS] skipping malformed number: ");
        Serial.println(number);

      } else {

        if (result.length() > 0) {
          result += ",";
        }

        result += urlEncode(number);
      }
    }

    start = i + 1;
  }

  return result;
}

int countAlertNumbers() {

  const String valid = buildNumbersParam();

  if (valid.length() == 0) {
    return 0;
  }

  int count = 1;

  for (size_t i = 0; i < valid.length(); i++) {
    if (valid.charAt(i) == ',') {
      count++;
    }
  }

  return count;
}

String buildTimestamp() {

  time_t now = time(nullptr);

  if (now < 1700000000) {
    return String("time-unavailable");
  }

  struct tm timeInfo;
  localtime_r(&now, &timeInfo);

  char buffer[32];
  strftime(buffer, sizeof(buffer), "%d-%m-%Y %H:%M:%S IST", &timeInfo);

  return String(buffer);
}

String buildAlertMessage(int gasValue) {

  String message = "LPG LEAK ALERT: gas level ";
  message += gasValue;
  message += "/1023 at ";
  message += buildTimestamp();
  message += ". Check kitchen now.";

  return message;
}

bool sendAlertSms(int gasValue) {

  lastSmsAttemptTime = millis();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[SMS] skipped, wifi offline");
    return false;
  }

  String message = buildAlertMessage(gasValue);

  if (message.length() > 160) {
    Serial.println("[SMS] message too long, trimming");
    message = message.substring(0, 157) + "...";
  }

  String numbers = buildNumbersParam();

  if (numbers.length() == 0) {
    Serial.println("[SMS] no valid numbers configured, aborting");
    return false;
  }

  String uri = String(SMS_PATH);
  uri += "?route=";
  uri += SMS_ROUTE;
  uri += "&message=";
  uri += urlEncode(message);
  uri += "&numbers=";
  uri += numbers;

  WiFiClientSecure client;
  client.setCACert(ROOT_CA_ISRG_X1);

  HTTPClient http;
  http.setTimeout(SMS_HTTP_TIMEOUT_MS);

  if (!http.begin(client, String("https://") + SMS_HOST + uri)) {
    Serial.println("[SMS] http begin failed");
    return false;
  }

  http.addHeader("Authorization", FAST2SMS_API_KEY);
  http.addHeader("Accept", "application/json");

  int statusCode = http.GET();

  String response = http.getString();

  http.end();

  String compact = response;
  compact.replace(" ", "");

  bool accepted =
      (statusCode == 200) &&
      (compact.indexOf("\"return\":true") >= 0 ||
       compact.indexOf("Messagesentsuccessfully") >= 0);

  Serial.print("[SMS] ");
  Serial.print(accepted ? "sent" : "failed");
  Serial.print(", http status: ");
  Serial.print(statusCode);
  Serial.print(", body: ");
  Serial.println(response);

  return accepted;
}

bool buttonPressed() {

  bool reading = digitalRead(BUTTON_PIN);

  if (reading != lastButtonState) {
    lastDebounceTime = millis();
    lastButtonState = reading;
  }

  if (millis() - lastDebounceTime < DEBOUNCE_MS) {
    return false;
  }

  if (reading == LOW) {
    lastButtonState = HIGH;
    return true;
  }

  return false;
}

void updateState(int gasValue) {

  if (alarmState == STATE_DANGER) {

    if (gasValue < DANGER_CLEAR_THRESHOLD) {
      alarmState = STATE_WARNING;
    }

  } else if (alarmState == STATE_WARNING) {

    if (gasValue >= DANGER_THRESHOLD) {
      alarmState = STATE_DANGER;
    } else if (gasValue < WARNING_CLEAR_THRESHOLD) {
      alarmState = STATE_SAFE;
    }

  } else {

    if (gasValue >= WARNING_THRESHOLD) {
      alarmState = STATE_WARNING;
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

void setup() {

  Serial.begin(115200);

  pinMode(BUZZER_PIN, OUTPUT);

  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);

  pinMode(BUTTON_PIN, INPUT_PULLUP);

  noTone(BUZZER_PIN);

  Serial.print("[SMS] configured valid alert numbers: ");
  Serial.println(countAlertNumbers());

  connectWifi();

  maintainWifi();

  bootTime = millis();

  Serial.print("[WARMUP] MQ-6 stabilising for ");
  Serial.print(SENSOR_WARMUP_MS / 1000);
  Serial.println("s, blue LED indicates calibrating");
}

void loop() {

  maintainWifi();

  unsigned long currentTime = millis();

  int gasValue = analogRead(MQ6_PIN);

  if (readButton()) {
    processButton(gasValue);
  }

  if (!warmupComplete && currentTime - bootTime >= SENSOR_WARMUP_MS) {
    warmupComplete = true;
    Serial.println("[WARMUP] complete, gas readings now active");
  }

  if (!warmupComplete) {

    bool blink = ((currentTime / 400) % 2) == 0;
    setLed(0, 0, blink ? HIGH : LOW);
    noTone(BUZZER_PIN);
    buzzerState = false;

    if (currentTime - lastLogTime >= LOG_INTERVAL_MS) {
      lastLogTime = currentTime;
      Serial.print("Gas Value: ");
      Serial.print(gasValue);
      Serial.println(" (warming up)");
    }

    return;
  }

  updateState(gasValue);

  if (alarmState == STATE_SAFE) {

    alarmMuted = false;

    smsAttempted = false;

    setLed(0, HIGH, 0);

    noTone(BUZZER_PIN);
    buzzerState = false;

    if (currentTime - lastLogTime >= NORMAL_LOG_INTERVAL_MS) {
      lastLogTime = currentTime;
      Serial.print("Gas Value: ");
      Serial.println(gasValue);
    }

    return;
  }

  if (alarmState == STATE_WARNING) {

    setLed(HIGH, HIGH, 0);

    updateBuzzer(BUZZER_WARN_TONE_HZ, BUZZER_WARN_PERIOD_MS);

  } else {

    setLed(HIGH, 0, 0);

    updateBuzzer(BUZZER_DANGER_TONE_HZ, BUZZER_DANGER_PERIOD_MS);

    if (!smsAttempted || currentTime - lastSmsAttemptTime >= SMS_RETRY_INTERVAL_MS) {
      smsAttempted = true;
      keepToneRunningDuringSms();
      sendAlertSms(gasValue);
    }
  }

  if (currentTime - lastLogTime >= LOG_INTERVAL_MS) {
    lastLogTime = currentTime;
    Serial.print("Gas Value: ");
    Serial.print(gasValue);
    Serial.print(" state: ");
    Serial.println(alarmState == STATE_WARNING ? "WARNING" : "DANGER");
  }
}
