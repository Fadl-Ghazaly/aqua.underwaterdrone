/*
 * AQUADRON - ESP32 Code for Water Quality Monitoring
 * Sensors: pH, TDS, Turbidity
 * Communication: Bluetooth Serial_
 */

#include <BluetoothSerial.h>

// ============================================
// PIN DEFINITIONS
// ============================================
#define PH_PIN 34      // ADC1_CH6
#define TDS_PIN 35     // ADC1_CH7
#define TURB_PIN 32    // ADC1_CH4
#define LED_PIN 2      // Built-in LED

// ============================================
// CALIBRATION CONSTANTS
// ============================================
// pH Calibration (adjust based on your sensor)
float PH_NEUTRAL = 7.0;
float PH_VOLTAGE_OFFSET = 2.5;
float PH_SLOPE = 0.18;

// TDS Calibration
float TDS_FACTOR = 1.0;

// Turbidity Calibration
float TURB_FACTOR = 1.0;

// ============================================
// GLOBAL VARIABLES
// ============================================
BluetoothSerial SerialBT;
unsigned long lastReadingTime = 0;
const unsigned long READING_INTERVAL = 2000; // 2 seconds
int readingCount = 0;

// ============================================
// SETUP
// ============================================
void setup() {
  // Initialize Serial
  Serial.begin(115200);
  SerialBT.begin("AQUADRON-ESP32"); // Bluetooth device name
  
  // Initialize pins
  pinMode(LED_PIN, OUTPUT);
  pinMode(PH_PIN, INPUT);
  pinMode(TDS_PIN, INPUT);
  pinMode(TURB_PIN, INPUT);
  
  // ADC Configuration
  analogReadResolution(12); // 12-bit resolution (0-4095)
  analogSetAttenuation(ADC_11db); // 0-3.3V range
  
  // Startup signal
  for(int i = 0; i < 3; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(200);
    digitalWrite(LED_PIN, LOW);
    delay(200);
  }
  
  Serial.println("AQUADRON - ESP32 Ready");
  SerialBT.println("AQUADRON - System Ready");
}

// ============================================
// MAIN LOOP
// ============================================
void loop() {
  unsigned long currentTime = millis();
  
  if (currentTime - lastReadingTime >= READING_INTERVAL) {
    lastReadingTime = currentTime;
    
    // Read all sensors
    float pH = readPH();
    float tds = readTDS();
    float turb = readTurbidity();
    
    // Format data: pH,TDS,Turbidity
    String data = String(pH, 2) + "," + 
                  String(tds, 0) + "," + 
                  String(turb, 1);
    
    // Send via Bluetooth
    SerialBT.println(data);
    
    // Also send to Serial for debugging
    Serial.print("Data " + String(++readingCount) + ": ");
    Serial.println(data);
    
    // Toggle LED to indicate transmission
    digitalWrite(LED_PIN, HIGH);
    delay(50);
    digitalWrite(LED_PIN, LOW);
  }
  
  // Handle Bluetooth commands
  if (SerialBT.available()) {
    String command = SerialBT.readString();
    command.trim();
    
    if (command == "STATUS") {
      SerialBT.println("AQUADRON-ONLINE");
    }
    else if (command == "CALIBRATE") {
      SerialBT.println("CALIBRATION_MODE");
      // Add calibration routine here
    }
    else if (command == "INFO") {
      SerialBT.println("AQUADRON Water Quality Monitor");
      SerialBT.println("Sensors: pH, TDS, Turbidity");
      SerialBT.println("Interval: 2 seconds");
    }
  }
}

// ============================================
// SENSOR READINGS
// ============================================

/**
 * Read pH sensor
 * Returns pH value (0-14)
 */
float readPH() {
  int rawValue = analogRead(PH_PIN);
  float voltage = rawValue * (3.3 / 4095.0);
  
  // Convert voltage to pH
  // Formula: pH = 7.0 + ((2.5 - voltage) / 0.18)
  float pH = PH_NEUTRAL + ((PH_VOLTAGE_OFFSET - voltage) / PH_SLOPE);
  
  // Constrain to valid range
  pH = constrain(pH, 0.0, 14.0);
  
  return pH;
}

/**
 * Read TDS sensor
 * Returns TDS in ppm
 */
float readTDS() {
  int rawValue = analogRead(TDS_PIN);
  float voltage = rawValue * (3.3 / 4095.0);
  
  // TDS conversion formula
  // Based on standard TDS sensor characteristic curve
  float compensationCoefficient = 1.0 + 0.02 * (25.0 - 25.0); // Temperature compensation (assume 25°C)
  float compensationVoltage = voltage / compensationCoefficient;
  
  float tds = (133.42 * pow(compensationVoltage, 3) 
               - 255.86 * pow(compensationVoltage, 2) 
               + 857.39 * compensationVoltage) * TDS_FACTOR;
  
  tds = constrain(tds, 0.0, 1000.0);
  
  return tds;
}

/**
 * Read Turbidity sensor
 * Returns turbidity in NTU
 */
float readTurbidity() {
  int rawValue = analogRead(TURB_PIN);
  float voltage = rawValue * (3.3 / 4095.0);
  
  // Convert voltage to NTU
  // Relationship: voltage decreases as turbidity increases
  float turbidity = 3000.0 * (1.0 - (voltage / 3.3)) * TURB_FACTOR;
  
  turbidity = constrain(turbidity, 0.0, 1000.0);
  
  return turbidity;
}

/**
 * Get sensor status for debugging
 */
String getSensorStatus() {
  String status = "";
  
  status += "pH:" + String(analogRead(PH_PIN));
  status += ",TDS:" + String(analogRead(TDS_PIN));
  status += ",TURB:" + String(analogRead(TURB_PIN));
  
  return status;
}

/**
 * Average multiple readings for stability
 */
float averageReadings(int pin, int samples = 10) {
  long sum = 0;
  
  for(int i = 0; i < samples; i++) {
    sum += analogRead(pin);
    delayMicroseconds(100);
  }
  
  return sum / (float)samples;
}