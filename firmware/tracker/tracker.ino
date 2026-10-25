/*
 * ESP32 Indoor Positioning Tracker
 * 
 * Hardware:
 *   - ESP32-WROVER (30 pin)
 *   - MPU6050 via I2C: SDA=GPIO32, SCL=GPIO33, VCC=3.3V, GND=GND
 *   - MPU6050 address: 0x68 (AD0 unconnected)
 * 
 * Operation:
 *   - Reads MPU6050 at ~10 Hz (accelerometer + gyroscope)
 *   - Scans for INDOOR_ANCHOR_A and INDOOR_ANCHOR_B SSIDs at ~1 Hz
 *   - Outputs newline-delimited JSON over USB serial at 115200 baud
 * 
 * IMPORTANT: Wi-Fi scanning blocks for ~100-300ms per scan.
 *   The firmware interleaves IMU reads between scans to maintain
 *   high IMU update rate.
 */

#include <Wire.h>
#include <WiFi.h>

// ── Pin Configuration ──
#define I2C_SDA 32
#define I2C_SCL 33
#define MPU6050_ADDR 0x68

// ── Anchor SSIDs to scan for ──
const char* ANCHOR_A_SSID = "INDOOR_ANCHOR_A";
const char* ANCHOR_B_SSID = "INDOOR_ANCHOR_B";

// ── Timing ──
const unsigned long IMU_INTERVAL_MS  = 100;   // 10 Hz IMU
const unsigned long SCAN_INTERVAL_MS = 1000;  // 1 Hz Wi-Fi scan

// ── Device identity ──
const char* DEVICE_ID = "tracker_01";
const int SCHEMA_VERSION = 1;

// ── State ──
bool     mpuReady = false;
int16_t  rawAx, rawAy, rawAz, rawGx, rawGy, rawGz, rawTemp;
int      rssiA = -127;  // sentinel: not detected
int      rssiB = -127;
bool     anchorAValid = false;
bool     anchorBValid = false;
unsigned long lastScanMs  = 0;
unsigned long lastImuMs   = 0;
unsigned long rssiAgeMs   = 0;
unsigned long scanCount   = 0;

// ── MPU6050 Register Setup ──
void initMPU6050() {
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(400000);  // 400 kHz I2C
  delay(50);
  
  // Check WHO_AM_I
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x75);  // WHO_AM_I register
  Wire.endTransmission(false);
  Wire.requestFrom(MPU6050_ADDR, 1);
  uint8_t whoAmI = Wire.read();
  
  if (whoAmI != 0x68 && whoAmI != 0x72) {
    Serial.println("{\"error\":\"MPU6050 not found\",\"who_am_i\":" + String(whoAmI) + "}");
    mpuReady = false;
    return;
  }
  
  // Wake up (clear SLEEP bit)
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x6B);  // PWR_MGMT_1
  Wire.write(0x00);
  Wire.endTransmission();
  delay(10);
  
  // Set accelerometer range: +/- 4g (AFS_SEL=1)
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x1C);  // ACCEL_CONFIG
  Wire.write(0x08);  // +/- 4g
  Wire.endTransmission();
  
  // Set gyroscope range: +/- 500 deg/s (FS_SEL=1)
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x1B);  // GYRO_CONFIG
  Wire.write(0x08);  // +/- 500 deg/s
  Wire.endTransmission();
  
  // Set DLPF to ~20 Hz bandwidth
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x1A);  // CONFIG
  Wire.write(0x04);  // DLPF_CFG = 4 (~20 Hz)
  Wire.endTransmission();
  
  mpuReady = true;
  Serial.println("{\"event\":\"mpu6050_init\",\"status\":\"ok\",\"who_am_i\":" + String(whoAmI) + "}");
}

// ── Read raw MPU6050 data ──
void readMPU6050() {
  if (!mpuReady) return;
  
  Wire.beginTransmission(MPU6050_ADDR);
  Wire.write(0x3B);  // Start at ACCEL_XOUT_H
  Wire.endTransmission(false);
  Wire.requestFrom(MPU6050_ADDR, 14);
  
  rawAx   = (Wire.read() << 8) | Wire.read();
  rawAy   = (Wire.read() << 8) | Wire.read();
  rawAz   = (Wire.read() << 8) | Wire.read();
  rawTemp = (Wire.read() << 8) | Wire.read();
  rawGx   = (Wire.read() << 8) | Wire.read();
  rawGy   = (Wire.read() << 8) | Wire.read();
  rawGz   = (Wire.read() << 8) | Wire.read();
}

// ── Wi-Fi scan for anchor SSIDs ──
void scanAnchors() {
  anchorAValid = false;
  anchorBValid = false;
  rssiA = -127;
  rssiB = -127;
  
  int n = WiFi.scanNetworks(false, false, false, 120);  // active scan, 120ms per channel
  
  for (int i = 0; i < n; i++) {
    String ssid = WiFi.SSID(i);
    if (ssid == ANCHOR_A_SSID) {
      rssiA = WiFi.RSSI(i);
      anchorAValid = true;
    }
    if (ssid == ANCHOR_B_SSID) {
      rssiB = WiFi.RSSI(i);
      anchorBValid = true;
    }
  }
  
  WiFi.scanDelete();
  scanCount++;
  rssiAgeMs = 0;
}

// ── Emit telemetry JSON ──
void emitTelemetry() {
  // Convert raw values to physical units
  // Accel: raw / 8192.0 * 9.80665  (for +/-4g range, LSB = 8192/g)
  // Gyro:  raw / 65.5 * (PI/180)   (for +/-500 dps, LSB = 65.5 dps, convert to rad/s)
  float ax = (rawAx / 8192.0) * 9.80665;
  float ay = (rawAy / 8192.0) * 9.80665;
  float az = (rawAz / 8192.0) * 9.80665;
  float gx = (rawGx / 65.5) * 0.01745329;  // deg/s to rad/s
  float gy = (rawGy / 65.5) * 0.01745329;
  float gz = (rawGz / 65.5) * 0.01745329;
  float tempC = rawTemp / 340.0 + 36.53;
  
  // Build JSON manually (no ArduinoJson dependency)
  Serial.print("{\"sv\":");
  Serial.print(SCHEMA_VERSION);
  Serial.print(",\"type\":\"telemetry\",\"id\":\"");
  Serial.print(DEVICE_ID);
  Serial.print("\",\"ts\":");
  Serial.print(millis());
  Serial.print(",\"imu\":{\"ok\":");
  Serial.print(mpuReady ? "true" : "false");
  Serial.print(",\"a\":[");
  Serial.print(ax, 3); Serial.print(",");
  Serial.print(ay, 3); Serial.print(",");
  Serial.print(az, 3);
  Serial.print("],\"g\":[");
  Serial.print(gx, 4); Serial.print(",");
  Serial.print(gy, 4); Serial.print(",");
  Serial.print(gz, 4);
  Serial.print("],\"t\":");
  Serial.print(tempC, 1);
  Serial.print("},\"anc\":[");
  
  // Anchor A
  Serial.print("{\"id\":\"A\",\"ssid\":\"");
  Serial.print(ANCHOR_A_SSID);
  Serial.print("\",\"rssi\":");
  Serial.print(rssiA);
  Serial.print(",\"v\":");
  Serial.print(anchorAValid ? "true" : "false");
  Serial.print("},");
  
  // Anchor B
  Serial.print("{\"id\":\"B\",\"ssid\":\"");
  Serial.print(ANCHOR_B_SSID);
  Serial.print("\",\"rssi\":");
  Serial.print(rssiB);
  Serial.print(",\"v\":");
  Serial.print(anchorBValid ? "true" : "false");
  Serial.print("}]");
  
  Serial.print(",\"rssi_age\":");
  Serial.print(rssiAgeMs);
  Serial.print(",\"scan_n\":");
  Serial.print(scanCount);
  Serial.println("}");
}

// ── Main ──
void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("{\"event\":\"boot\",\"device\":\"" + String(DEVICE_ID) + "\",\"sv\":" + String(SCHEMA_VERSION) + "}");
  
  // Initialize MPU6050
  initMPU6050();
  
  // Set Wi-Fi to station mode for scanning (do NOT connect to any AP)
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);
  
  Serial.println("{\"event\":\"wifi_init\",\"status\":\"ok\",\"mode\":\"STA_SCAN\"}");
}

void loop() {
  unsigned long now = millis();
  
  // ── IMU read at ~10 Hz ──
  if (now - lastImuMs >= IMU_INTERVAL_MS) {
    lastImuMs = now;
    readMPU6050();
    rssiAgeMs = now - lastScanMs;
    emitTelemetry();
  }
  
  // ── Wi-Fi scan at ~1 Hz ──
  // Wi-Fi scanning blocks ~100-300ms. We do it between IMU reads.
  if (now - lastScanMs >= SCAN_INTERVAL_MS) {
    lastScanMs = now;
    scanAnchors();
  }
}
