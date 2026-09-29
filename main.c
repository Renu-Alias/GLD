#define MQ6_PIN 33
#define BUZZER_PIN 25

#define RED_PIN 32
#define GREEN_PIN 2
#define BLUE_PIN 4

#define BUTTON_PIN 27

bool alarmMuted = false;

bool lastButtonState = HIGH;

unsigned long lastDebounceTime = 0;
const unsigned long debounceDelay = 50;

unsigned long lastBuzzerTime = 0;
bool buzzerState = false;

void setup() {
  Serial.begin(115200);

  pinMode(BUZZER_PIN, OUTPUT);

  pinMode(RED_PIN, OUTPUT);
  pinMode(GREEN_PIN, OUTPUT);
  pinMode(BLUE_PIN, OUTPUT);

  pinMode(BUTTON_PIN, INPUT_PULLUP);

  noTone(BUZZER_PIN);
}

void loop() {

  int gasValue = analogRead(MQ6_PIN);

  Serial.print("Gas Value: ");
  Serial.println(gasValue);

  // BUTTON
  bool buttonState = digitalRead(BUTTON_PIN);

  if (buttonState == LOW && lastButtonState == HIGH) {

    delay(50);

    if (digitalRead(BUTTON_PIN) == LOW) {

      if (gasValue >= 500) {
        alarmMuted = true;
        noTone(BUZZER_PIN);
        buzzerState = false;

        Serial.println("ALARM MUTED");
      }
    }
  }

  lastButtonState = buttonState;


  // NORMAL
  if (gasValue < 500) {

    alarmMuted = false;

    digitalWrite(RED_PIN, LOW);
    digitalWrite(GREEN_PIN, HIGH);
    digitalWrite(BLUE_PIN, LOW);

    noTone(BUZZER_PIN);
    buzzerState = false;
  }


  // WARNING
  else if (gasValue >= 500 && gasValue < 800) {

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