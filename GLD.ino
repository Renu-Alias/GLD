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
#define DANGER_THRESHOLD 800

#define SMS_HOST "www.fast2sms.com"
#define SMS_PATH "/dev/bulkV2"
#define SMS_ROUTE "q"
#define SMS_HTTP_TIMEOUT_MS 5000
#define SMS_RETRY_INTERVAL_MS 60000UL
#define WIFI_CONNECT_TIMEOUT_MS 20000UL
#define WIFI_RETRY_INTERVAL_MS 15000UL
#define IST_OFFSET_SEC 19800

bool alarmMuted = false;

bool lastButtonState = HIGH;

unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 50;

unsigned long lastBuzzerTime = 0;
bool buzzerState = false;

bool wifiReady = false;
unsigned long lastWifiRetryTime = 0;

bool smsAttempted = false;
unsigned long lastSmsAttemptTime = 0;

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

  const String raw = ALERT_PHONE_NUMBERS;

  int count = 0;
  size_t start = 0;

  for (size_t i = 0; i <= raw.length(); i++) {

    if (i == raw.length() || raw.charAt(i) == ',') {

      if (raw.substring(start, i).trim().length() > 0) {
        count++;
      }

      start = i + 1;
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
  gmtime_r(&now, &timeInfo);

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

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[SMS] skipped, wifi offline");
    return false;
  }

  lastSmsAttemptTime = millis();

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

  bool accepted = (statusCode == 200 && compact.indexOf("\"return\":false") < 0);

  Serial.print("[SMS] ");
  Serial.print(accepted ? "sent" : "failed");
  Serial.print(", http status: ");
  Serial.print(statusCode);
  Serial.print(", body: ");
  Serial.println(response);

  return accepted;
}

void setup() {
  Serial.begin(115200);

  pinMode(BUZZER_PIN, OUTPUT);

  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);

  pinMode(BUTTON_PIN, INPUT_PULLUP);

  noTone(BUZZER_PIN);

  Serial.print("[SMS] configured alert numbers: ");
  Serial.println(countAlertNumbers());

  connectWifi();

  if (wifiReady) {
    configTime(IST_OFFSET_SEC, 0, "pool.ntp.org", "time.nist.gov");
  }
}

void loop() {

  maintainWifi();

  int gasValue = analogRead(MQ6_PIN);

  Serial.print("Gas Value: ");
  Serial.println(gasValue);

  // BUTTON
  bool buttonState = digitalRead(BUTTON_PIN);

  if (buttonState == LOW && lastButtonState == HIGH) {

    delay(50);

    if (digitalRead(BUTTON_PIN) == LOW) {

      if (gasValue >= WARNING_THRESHOLD) {
        alarmMuted = true;
        noTone(BUZZER_PIN);
        buzzerState = false;

        Serial.println("ALARM MUTED");
      }
    }
  }

  lastButtonState = buttonState;


  // NORMAL
  if (gasValue < WARNING_THRESHOLD) {

    alarmMuted = false;

    smsAttempted = false;

    digitalWrite(RED_PIN, LOW);
    digitalWrite(GREEN_PIN, HIGH);
    digitalWrite(BLUE_PIN, LOW);

    noTone(BUZZER_PIN);
    buzzerState = false;
  }


  // WARNING
  else if (gasValue >= WARNING_THRESHOLD && gasValue < DANGER_THRESHOLD) {

    digitalWrite(RED_PIN, HIGH);
    digitalWrite(GREEN_PIN, HIGH);
    digitalWrite(BLUE_PIN, LOW);

    if (alarmMuted) {

      noTone(BUZZER_PIN);
      buzzerState = false;

    } else {

      unsigned long currentTime = millis();

      if (currentTime - lastBuzzerTime >= 300) {

        lastBuzzerTime = currentTime;

        buzzerState = !buzzerState;

        if (buzzerState) {
          tone(BUZZER_PIN, 1000);
        } else {
          noTone(BUZZER_PIN);
        }
      }
    }
  }


  // DANGER
  else {

    digitalWrite(RED_PIN, HIGH);
    digitalWrite(GREEN_PIN, LOW);
    digitalWrite(BLUE_PIN, LOW);

    if (!smsAttempted || millis() - lastSmsAttemptTime >= SMS_RETRY_INTERVAL_MS) {
      smsAttempted = true;
      sendAlertSms(gasValue);
    }
    if (alarmMuted) {

      noTone(BUZZER_PIN);
      buzzerState = false;

    } else {

      unsigned long currentTime = millis();

      if (currentTime - lastBuzzerTime >= 150) {

        lastBuzzerTime = currentTime;

        buzzerState = !buzzerState;

        if (buzzerState) {
          tone(BUZZER_PIN, 2000);
        } else {
          noTone(BUZZER_PIN);
        }
      }
    }
  }
}