// setup_hardware.js — Creates all directories and files for ESP32 hardware integration
// Run: node setup_hardware.js

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = '.';

// Create directories
const dirs = [
  'firmware/tracker',
  'firmware/anchor_a', 
  'firmware/anchor_b',
  'server',
  'src/hardware'
];

dirs.forEach(d => {
  const full = join(ROOT, d);
  if (!existsSync(full)) {
    mkdirSync(full, { recursive: true });
    console.log(`  Created: ${full}`);
  }
});

// ─────────────────────────────────────────────────────────
// FILE 1: firmware/anchor_a/anchor_a.ino
// ─────────────────────────────────────────────────────────
writeFileSync(join(ROOT, 'firmware/anchor_a/anchor_a.ino'), `
/*
 * ESP32 Wi-Fi Anchor A — Indoor Positioning System
 * Creates a Wi-Fi Access Point with SSID "INDOOR_ANCHOR_A"
 * The tracker ESP32 scans for this SSID and measures RSSI.
 * 
 * Hardware: Any ESP32 development board
 * No additional sensors required.
 */

#include <WiFi.h>

const char* ANCHOR_SSID = "INDOOR_ANCHOR_A";
const char* ANCHOR_PASS = "";  // Open AP (no password)
const int   CHANNEL     = 1;   // Wi-Fi channel

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("=== INDOOR POSITIONING: ANCHOR A ===");
  Serial.print("Starting AP with SSID: ");
  Serial.println(ANCHOR_SSID);
  
  WiFi.mode(WIFI_AP);
  WiFi.softAP(ANCHOR_SSID, ANCHOR_PASS, CHANNEL, 0, 4);
  
  Serial.print("AP IP address: ");
  Serial.println(WiFi.softAPIP());
  Serial.println("Anchor A is broadcasting. Do not move this device.");
}

void loop() {
  // Anchors are passive — they only broadcast.
  // Print station count every 10 seconds for diagnostics.
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint > 10000) {
    lastPrint = millis();
    Serial.print("[ANCHOR_A] Uptime: ");
    Serial.print(millis() / 1000);
    Serial.print("s | Connected stations: ");
    Serial.println(WiFi.softAPgetStationNum());
  }
  delay(100);
}
`.trimStart());
console.log('  Wrote: firmware/anchor_a/anchor_a.ino');


// ─────────────────────────────────────────────────────────
// FILE 2: firmware/anchor_b/anchor_b.ino
// ─────────────────────────────────────────────────────────
writeFileSync(join(ROOT, 'firmware/anchor_b/anchor_b.ino'), `
/*
 * ESP32 Wi-Fi Anchor B — Indoor Positioning System
 * Creates a Wi-Fi Access Point with SSID "INDOOR_ANCHOR_B"
 */

#include <WiFi.h>

const char* ANCHOR_SSID = "INDOOR_ANCHOR_B";
const char* ANCHOR_PASS = "";
const int   CHANNEL     = 6;  // Different channel to reduce interference

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("=== INDOOR POSITIONING: ANCHOR B ===");
  Serial.print("Starting AP with SSID: ");
  Serial.println(ANCHOR_SSID);
  
  WiFi.mode(WIFI_AP);
  WiFi.softAP(ANCHOR_SSID, ANCHOR_PASS, CHANNEL, 0, 4);
  
  Serial.print("AP IP address: ");
  Serial.println(WiFi.softAPIP());
  Serial.println("Anchor B is broadcasting. Do not move this device.");
}

void loop() {
  static unsigned long lastPrint = 0;
  if (millis() - lastPrint > 10000) {
    lastPrint = millis();
    Serial.print("[ANCHOR_B] Uptime: ");
    Serial.print(millis() / 1000);
    Serial.print("s | Connected stations: ");
    Serial.println(WiFi.softAPgetStationNum());
  }
  delay(100);
}
`.trimStart());
console.log('  Wrote: firmware/anchor_b/anchor_b.ino');


// ─────────────────────────────────────────────────────────
// FILE 3: firmware/tracker/tracker.ino
// ─────────────────────────────────────────────────────────
writeFileSync(join(ROOT, 'firmware/tracker/tracker.ino'), `
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
    Serial.println("{\\"error\\":\\"MPU6050 not found\\",\\"who_am_i\\":" + String(whoAmI) + "}");
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
  Serial.println("{\\"event\\":\\"mpu6050_init\\",\\"status\\":\\"ok\\",\\"who_am_i\\":" + String(whoAmI) + "}");
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
  Serial.print("{\\"sv\\":");
  Serial.print(SCHEMA_VERSION);
  Serial.print(",\\"type\\":\\"telemetry\\",\\"id\\":\\"");
  Serial.print(DEVICE_ID);
  Serial.print("\\",\\"ts\\":");
  Serial.print(millis());
  Serial.print(",\\"imu\\":{\\"ok\\":");
  Serial.print(mpuReady ? "true" : "false");
  Serial.print(",\\"a\\":[");
  Serial.print(ax, 3); Serial.print(",");
  Serial.print(ay, 3); Serial.print(",");
  Serial.print(az, 3);
  Serial.print("],\\"g\\":[");
  Serial.print(gx, 4); Serial.print(",");
  Serial.print(gy, 4); Serial.print(",");
  Serial.print(gz, 4);
  Serial.print("],\\"t\\":");
  Serial.print(tempC, 1);
  Serial.print("},\\"anc\\":[");
  
  // Anchor A
  Serial.print("{\\"id\\":\\"A\\",\\"ssid\\":\\"");
  Serial.print(ANCHOR_A_SSID);
  Serial.print("\\",\\"rssi\\":");
  Serial.print(rssiA);
  Serial.print(",\\"v\\":");
  Serial.print(anchorAValid ? "true" : "false");
  Serial.print("},");
  
  // Anchor B
  Serial.print("{\\"id\\":\\"B\\",\\"ssid\\":\\"");
  Serial.print(ANCHOR_B_SSID);
  Serial.print("\\",\\"rssi\\":");
  Serial.print(rssiB);
  Serial.print(",\\"v\\":");
  Serial.print(anchorBValid ? "true" : "false");
  Serial.print("}]");
  
  Serial.print(",\\"rssi_age\\":");
  Serial.print(rssiAgeMs);
  Serial.print(",\\"scan_n\\":");
  Serial.print(scanCount);
  Serial.println("}");
}

// ── Main ──
void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("{\\"event\\":\\"boot\\",\\"device\\":\\"" + String(DEVICE_ID) + "\\",\\"sv\\":" + String(SCHEMA_VERSION) + "}");
  
  // Initialize MPU6050
  initMPU6050();
  
  // Set Wi-Fi to station mode for scanning (do NOT connect to any AP)
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);
  
  Serial.println("{\\"event\\":\\"wifi_init\\",\\"status\\":\\"ok\\",\\"mode\\":\\"STA_SCAN\\"}");
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
`.trimStart());
console.log('  Wrote: firmware/tracker/tracker.ino');


// ─────────────────────────────────────────────────────────
// FILE 4: server/package.json
// ─────────────────────────────────────────────────────────
writeFileSync(join(ROOT, 'server/package.json'), JSON.stringify({
  name: "esp32-positioning-gateway",
  version: "1.0.0",
  type: "module",
  scripts: {
    start: "node index.js",
    "start:sim": "node index.js --simulate"
  },
  dependencies: {
    serialport: "^12.0.0",
    ws: "^8.18.0",
    "better-sqlite3": "^11.0.0",
    dotenv: "^16.4.0"
  }
}, null, 2) + '\n');
console.log('  Wrote: server/package.json');


// ─────────────────────────────────────────────────────────
// FILE 5: server/.env.example
// ─────────────────────────────────────────────────────────
writeFileSync(join(ROOT, 'server/.env.example'), `
# ── Serial Port Configuration ──
# Windows: COM3, COM4, etc.  Linux/Mac: /dev/ttyUSB0, /dev/ttyACM0
SERIAL_PORT=COM3
SERIAL_BAUD=115200

# ── WebSocket Server ──
WS_PORT=8765

# ── Anchor Positions (meters, local coordinate frame) ──
ANCHOR_A_X=2.0
ANCHOR_A_Y=0.0
ANCHOR_B_X=8.0
ANCHOR_B_Y=0.0

# ── RSSI Calibration ──
# RSSI_REF: RSSI measured at exactly 1 meter from anchor (dBm)
# PLE: Path-Loss Exponent for your environment (2.0=free space, 2.5-3.5=indoor)
RSSI_REF=-45
PLE=2.4

# ── Logging ──
DB_PATH=./data/telemetry.db
LOG_RAW=true

# ── Update Rate ──
# How often to forward position updates to dashboard (ms)
POSITION_UPDATE_INTERVAL_MS=200
`.trimStart());
console.log('  Wrote: server/.env.example');


// ─────────────────────────────────────────────────────────
// FILE 6: server/config.js
// ─────────────────────────────────────────────────────────
writeFileSync(join(ROOT, 'server/config.js'), `
import 'dotenv/config';

export const config = {
  serial: {
    port: process.env.SERIAL_PORT || 'COM3',
    baud: parseInt(process.env.SERIAL_BAUD || '115200', 10)
  },
  ws: {
    port: parseInt(process.env.WS_PORT || '8765', 10)
  },
  anchors: {
    A: {
      x: parseFloat(process.env.ANCHOR_A_X || '2.0'),
      y: parseFloat(process.env.ANCHOR_A_Y || '0.0'),
      ssid: 'INDOOR_ANCHOR_A'
    },
    B: {
      x: parseFloat(process.env.ANCHOR_B_X || '8.0'),
      y: parseFloat(process.env.ANCHOR_B_Y || '0.0'),
      ssid: 'INDOOR_ANCHOR_B'
    }
  },
  rssi: {
    ref: parseFloat(process.env.RSSI_REF || '-45'),
    ple: parseFloat(process.env.PLE || '2.4'),
    minValid: -90,    // ignore RSSI weaker than this
    sentinel: -127    // means "not detected"
  },
  db: {
    path: process.env.DB_PATH || './data/telemetry.db'
  },
  logRaw: process.env.LOG_RAW === 'true',
  positionUpdateIntervalMs: parseInt(process.env.POSITION_UPDATE_INTERVAL_MS || '200', 10)
};

export default config;
`.trimStart());
console.log('  Wrote: server/config.js');


// ─────────────────────────────────────────────────────────
// FILE 7: server/db.js
// ─────────────────────────────────────────────────────────
writeFileSync(join(ROOT, 'server/db.js'), `
import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import config from './config.js';

// Ensure data directory exists
const dbDir = dirname(config.db.path);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const db = new Database(config.db.path);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// ── Schema ──
db.exec(\`
  CREATE TABLE IF NOT EXISTS raw_telemetry (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    received_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    device_id    TEXT    NOT NULL,
    timestamp_ms INTEGER NOT NULL,
    ax           REAL,
    ay           REAL,
    az           REAL,
    gx           REAL,
    gy           REAL,
    gz           REAL,
    rssi_a       INTEGER,
    rssi_b       INTEGER,
    anchor_a_valid INTEGER DEFAULT 0,
    anchor_b_valid INTEGER DEFAULT 0,
    rssi_age_ms  INTEGER,
    imu_ok       INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS position_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    recorded_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    device_id    TEXT    NOT NULL,
    timestamp_ms INTEGER NOT NULL,
    est_x        REAL,
    est_y        REAL,
    heading      REAL,
    method       TEXT,
    valid        INTEGER DEFAULT 0,
    confidence   REAL,
    dist_a       REAL,
    dist_b       REAL
  );

  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at TEXT    NOT NULL DEFAULT (datetime('now')),
    device_id   TEXT,
    event_type  TEXT    NOT NULL,
    detail      TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_raw_device_ts ON raw_telemetry(device_id, timestamp_ms);
  CREATE INDEX IF NOT EXISTS idx_pos_device_ts ON position_log(device_id, recorded_at);
  CREATE INDEX IF NOT EXISTS idx_events_type   ON events(event_type, occurred_at);
\`);

// ── Prepared Statements ──
const insertRaw = db.prepare(\`
  INSERT INTO raw_telemetry (device_id, timestamp_ms, ax, ay, az, gx, gy, gz,
    rssi_a, rssi_b, anchor_a_valid, anchor_b_valid, rssi_age_ms, imu_ok)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
\`);

const insertPosition = db.prepare(\`
  INSERT INTO position_log (device_id, timestamp_ms, est_x, est_y, heading,
    method, valid, confidence, dist_a, dist_b)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
\`);

const insertEvent = db.prepare(\`
  INSERT INTO events (device_id, event_type, detail) VALUES (?, ?, ?)
\`);

export function logRawTelemetry(t) {
  try {
    insertRaw.run(
      t.id || 'unknown', t.ts || 0,
      t.imu?.a?.[0] ?? null, t.imu?.a?.[1] ?? null, t.imu?.a?.[2] ?? null,
      t.imu?.g?.[0] ?? null, t.imu?.g?.[1] ?? null, t.imu?.g?.[2] ?? null,
      t.anc?.[0]?.rssi ?? -127, t.anc?.[1]?.rssi ?? -127,
      t.anc?.[0]?.v ? 1 : 0, t.anc?.[1]?.v ? 1 : 0,
      t.rssi_age ?? null, t.imu?.ok ? 1 : 0
    );
  } catch (e) {
    console.error('[DB] Raw insert error:', e.message);
  }
}

export function logPosition(p) {
  try {
    insertPosition.run(
      p.deviceId, p.timestampMs,
      p.x, p.y, p.heading ?? null,
      p.method, p.valid ? 1 : 0, p.confidence ?? null,
      p.distA ?? null, p.distB ?? null
    );
  } catch (e) {
    console.error('[DB] Position insert error:', e.message);
  }
}

export function logEvent(deviceId, type, detail) {
  try {
    insertEvent.run(deviceId || null, type, typeof detail === 'string' ? detail : JSON.stringify(detail));
  } catch (e) {
    console.error('[DB] Event insert error:', e.message);
  }
}

export function queryPositionHistory(deviceId, limitMinutes = 30) {
  return db.prepare(\`
    SELECT * FROM position_log
    WHERE device_id = ? AND recorded_at >= datetime('now', '-' || ? || ' minutes')
    ORDER BY recorded_at DESC
    LIMIT 500
  \`).all(deviceId, limitMinutes);
}

export function queryRecentRaw(deviceId, limit = 100) {
  return db.prepare(\`
    SELECT * FROM raw_telemetry
    WHERE device_id = ?
    ORDER BY id DESC
    LIMIT ?
  \`).all(deviceId, limit);
}

// Retention: delete records older than N days
export function pruneOldRecords(days = 7) {
  const cutoff = days.toString();
  db.prepare("DELETE FROM raw_telemetry WHERE received_at < datetime('now', '-' || ? || ' days')").run(cutoff);
  db.prepare("DELETE FROM position_log WHERE recorded_at < datetime('now', '-' || ? || ' days')").run(cutoff);
  db.prepare("DELETE FROM events WHERE occurred_at < datetime('now', '-' || ? || ' days')").run(cutoff);
}

export default db;
`.trimStart());
console.log('  Wrote: server/db.js');


// ─────────────────────────────────────────────────────────
// FILE 8: server/index.js
// ─────────────────────────────────────────────────────────
writeFileSync(join(ROOT, 'server/index.js'), `
/*
 * ESP32 Indoor Positioning Gateway
 * 
 * Reads ESP32 tracker via USB serial, processes telemetry,
 * estimates position, logs to SQLite, forwards via WebSocket.
 * 
 * Usage:
 *   node index.js              # Real serial connection
 *   node index.js --simulate   # Simulated telemetry (no hardware)
 */

import { WebSocketServer } from 'ws';
import config from './config.js';
import { logRawTelemetry, logPosition, logEvent, pruneOldRecords } from './db.js';

const SIMULATE = process.argv.includes('--simulate');

// ── RSSI to Distance ──
function rssiToDistance(rssi, rssiRef, ple) {
  if (rssi <= -127 || rssi > 0) return null;
  const exponent = (rssiRef - rssi) / (10 * Math.max(1.1, ple));
  const dist = Math.pow(10, exponent);
  return Math.max(0.1, Math.min(100, dist));
}

// ── Simple 2-Anchor Position Estimator ──
// With only 2 anchors, full 2D trilateration is underdetermined.
// This estimator projects the tracker onto the line between anchors
// and estimates an approximate Y offset using the distance constraint.
function estimatePosition2Anchor(distA, distB, anchorA, anchorB) {
  if (distA === null && distB === null) {
    return { x: null, y: null, valid: false, method: 'none', confidence: 0 };
  }
  
  const dx = anchorB.x - anchorA.x;
  const dy = anchorB.y - anchorA.y;
  const D = Math.sqrt(dx * dx + dy * dy);  // inter-anchor distance
  
  if (D < 0.1) {
    return { x: null, y: null, valid: false, method: 'degenerate', confidence: 0 };
  }
  
  // If only one anchor is available, estimate distance ring only
  if (distA !== null && distB === null) {
    return {
      x: anchorA.x + distA * 0.5,
      y: anchorA.y,
      valid: false,
      method: '1-anchor-ring',
      confidence: 10,
      note: 'Only Anchor A detected. Position is rough estimate along anchor direction.'
    };
  }
  if (distA === null && distB !== null) {
    return {
      x: anchorB.x - distB * 0.5,
      y: anchorB.y,
      valid: false,
      method: '1-anchor-ring',
      confidence: 10,
      note: 'Only Anchor B detected.'
    };
  }
  
  // Both anchors: solve for x along the anchor baseline
  // Using the law of cosines projection:
  // x_along = (D^2 + dA^2 - dB^2) / (2*D)
  const xAlong = (D * D + distA * distA - distB * distB) / (2 * D);
  
  // y_perp^2 = dA^2 - x_along^2 (may be negative due to noise)
  const yPerpSq = distA * distA - xAlong * xAlong;
  const yPerp = yPerpSq > 0 ? Math.sqrt(yPerpSq) : 0;
  
  // Transform from anchor-baseline coordinates to world coordinates
  const ux = dx / D;
  const uy = dy / D;
  const px = -uy;  // perpendicular unit vector
  const py = ux;
  
  // There's a sign ambiguity for yPerp (above or below the baseline)
  // Without a third anchor, we cannot resolve this. Default to positive side.
  const worldX = anchorA.x + xAlong * ux + yPerp * px;
  const worldY = anchorA.y + xAlong * uy + yPerp * py;
  
  // Confidence based on geometric consistency
  const residual = Math.abs(Math.sqrt(xAlong * xAlong + yPerp * yPerp) - distA);
  const confidence = Math.max(10, Math.min(80, 80 - residual * 15));
  
  return {
    x: Number(worldX.toFixed(3)),
    y: Number(worldY.toFixed(3)),
    valid: true,
    method: '2-anchor-baseline',
    confidence: Number(confidence.toFixed(1)),
    xAlong: Number(xAlong.toFixed(3)),
    yPerp: Number(yPerp.toFixed(3)),
    note: '2-anchor estimate. Y-axis has sign ambiguity without a third anchor.'
  };
}

// ── RSSI Exponential Moving Average Filter ──
class RSSIFilter {
  constructor(alpha = 0.3) {
    this.alpha = alpha;
    this.values = {};  // anchorId -> filtered RSSI
  }
  update(anchorId, rssi) {
    if (rssi <= -127) return this.values[anchorId] ?? -127;
    if (!(anchorId in this.values) || this.values[anchorId] <= -127) {
      this.values[anchorId] = rssi;
    } else {
      this.values[anchorId] = this.alpha * rssi + (1 - this.alpha) * this.values[anchorId];
    }
    return this.values[anchorId];
  }
  get(anchorId) {
    return this.values[anchorId] ?? -127;
  }
}

// ── Simple IMU Dead Reckoning ──
class SimpleIMUTracker {
  constructor() {
    this.vx = 0; this.vy = 0;
    this.dx = 0; this.dy = 0; // displacement from last anchor fix
    this.heading = 0;
    this.lastTs = null;
    this.gravityZ = 9.81;
    this.biasAx = 0; this.biasAy = 0;
    this.calibSamples = 0;
    this.calibrating = true;
  }
  
  update(ax, ay, az, gz, tsMs) {
    if (this.lastTs === null) {
      this.lastTs = tsMs;
      return;
    }
    const dt = Math.min(0.5, (tsMs - this.lastTs) / 1000.0);
    this.lastTs = tsMs;
    
    if (dt <= 0) return;
    
    // Auto-calibrate bias from first 20 samples (assume stationary at start)
    if (this.calibrating && this.calibSamples < 20) {
      this.biasAx += ax / 20;
      this.biasAy += ay / 20;
      this.calibSamples++;
      if (this.calibSamples >= 20) {
        this.calibrating = false;
        console.log('[IMU] Bias calibration complete:', this.biasAx.toFixed(4), this.biasAy.toFixed(4));
      }
      return;
    }
    
    // Remove estimated bias
    const corrAx = ax - this.biasAx;
    const corrAy = ay - this.biasAy;
    
    // ZUPT: if acceleration is very small, assume stationary
    const accelMag = Math.sqrt(corrAx * corrAx + corrAy * corrAy);
    if (accelMag < 0.15) {
      this.vx *= 0.7;
      this.vy *= 0.7;
    } else {
      this.vx += corrAx * dt;
      this.vy += corrAy * dt;
    }
    
    this.dx += this.vx * dt;
    this.dy += this.vy * dt;
    this.heading += gz * (180 / Math.PI) * dt;
    this.heading = ((this.heading % 360) + 360) % 360;
  }
  
  getDisplacement() {
    return { dx: this.dx, dy: this.dy, heading: this.heading };
  }
  
  resetDisplacement() {
    this.dx = 0; this.dy = 0;
    this.vx *= 0.1; this.vy *= 0.1;  // dampen velocity on anchor fix
  }
}

// ══════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════

console.log('╔══════════════════════════════════════════════╗');
console.log('║  ESP32 Indoor Positioning Gateway            ║');
console.log('║  Mode: ' + (SIMULATE ? 'SIMULATED' : 'SERIAL    ') + '                        ║');
console.log('╚══════════════════════════════════════════════╝');

const rssiFilter = new RSSIFilter(0.3);
const imuTracker = new SimpleIMUTracker();
let lastPosition = { x: null, y: null, valid: false, method: 'none', confidence: 0 };
let deviceConnected = false;
let lastTelemetryTs = 0;
let messageCount = 0;
let errorCount = 0;

// ── WebSocket Server ──
const wss = new WebSocketServer({ port: config.ws.port });
console.log('[WS] WebSocket server listening on port', config.ws.port);

function broadcast(data) {
  const json = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) {  // OPEN
      client.send(json);
    }
  }
}

wss.on('connection', (ws) => {
  console.log('[WS] Client connected');
  // Send current state immediately
  ws.send(JSON.stringify({
    type: 'state',
    connected: deviceConnected,
    position: lastPosition,
    config: {
      anchors: config.anchors,
      rssi: config.rssi
    }
  }));
  
  ws.on('close', () => console.log('[WS] Client disconnected'));
});

// ── Process a telemetry message from ESP32 ──
function processTelemetry(msg) {
  messageCount++;
  lastTelemetryTs = Date.now();
  
  if (!msg || msg.type !== 'telemetry') return;
  
  // Log raw data
  if (config.logRaw) {
    logRawTelemetry(msg);
  }
  
  // Filter RSSI
  const ancA = msg.anc?.find(a => a.id === 'A');
  const ancB = msg.anc?.find(a => a.id === 'B');
  
  const filteredRssiA = ancA?.v ? rssiFilter.update('A', ancA.rssi) : rssiFilter.get('A');
  const filteredRssiB = ancB?.v ? rssiFilter.update('B', ancB.rssi) : rssiFilter.get('B');
  
  // Convert to distance
  const distA = (ancA?.v && filteredRssiA > config.rssi.minValid) 
    ? rssiToDistance(filteredRssiA, config.rssi.ref, config.rssi.ple) : null;
  const distB = (ancB?.v && filteredRssiB > config.rssi.minValid)
    ? rssiToDistance(filteredRssiB, config.rssi.ref, config.rssi.ple) : null;
  
  // IMU update
  if (msg.imu?.ok && msg.imu.a && msg.imu.g) {
    imuTracker.update(msg.imu.a[0], msg.imu.a[1], msg.imu.a[2], msg.imu.g[2], msg.ts);
  }
  
  // Position estimation (on fresh RSSI, not every IMU frame)
  const rssiAge = msg.rssi_age ?? 9999;
  if (rssiAge < 200 && (distA !== null || distB !== null)) {
    const posEst = estimatePosition2Anchor(distA, distB, config.anchors.A, config.anchors.B);
    
    if (posEst.valid) {
      // Blend with IMU displacement for inter-RSSI smoothing
      const imuDisp = imuTracker.getDisplacement();
      lastPosition = {
        ...posEst,
        heading: imuTracker.heading,
        distA: distA ? Number(distA.toFixed(2)) : null,
        distB: distB ? Number(distB.toFixed(2)) : null
      };
      imuTracker.resetDisplacement();
      
      // Log position
      logPosition({
        deviceId: msg.id,
        timestampMs: msg.ts,
        x: lastPosition.x,
        y: lastPosition.y,
        heading: lastPosition.heading,
        method: lastPosition.method,
        valid: lastPosition.valid,
        confidence: lastPosition.confidence,
        distA: lastPosition.distA,
        distB: lastPosition.distB
      });
    }
  }
  
  // Broadcast to dashboard
  broadcast({
    type: 'telemetry',
    deviceId: msg.id,
    timestamp: msg.ts,
    imu: msg.imu,
    anchors: [
      { id: 'A', rssi: ancA?.rssi ?? -127, rssiFiltered: Number(filteredRssiA.toFixed(1)), valid: ancA?.v ?? false, distance: distA ? Number(distA.toFixed(2)) : null },
      { id: 'B', rssi: ancB?.rssi ?? -127, rssiFiltered: Number(filteredRssiB.toFixed(1)), valid: ancB?.v ?? false, distance: distB ? Number(distB.toFixed(2)) : null }
    ],
    position: lastPosition,
    rssiAge: rssiAge,
    messageCount: messageCount
  });
}

// ── Serial Reader or Simulator ──
if (SIMULATE) {
  console.log('[SIM] Starting simulated telemetry stream...');
  deviceConnected = true;
  logEvent('simulator', 'connect', 'Simulated device connected');
  
  let simTime = 0;
  setInterval(() => {
    simTime += 100;
    const angle = (simTime / 1000) * 0.3;
    const simMsg = {
      sv: 1,
      type: 'telemetry',
      id: 'tracker_sim',
      ts: simTime,
      imu: {
        ok: true,
        a: [
          0.08 * Math.sin(angle) + (Math.random() - 0.5) * 0.05,
          0.05 * Math.cos(angle) + (Math.random() - 0.5) * 0.05,
          9.78 + (Math.random() - 0.5) * 0.1
        ],
        g: [
          (Math.random() - 0.5) * 0.02,
          (Math.random() - 0.5) * 0.02,
          0.01 * Math.sin(angle * 0.5)
        ],
        t: 25.3
      },
      anc: [
        { id: 'A', ssid: 'INDOOR_ANCHOR_A', rssi: -48 - Math.floor(Math.random() * 10), v: true },
        { id: 'B', ssid: 'INDOOR_ANCHOR_B', rssi: -55 - Math.floor(Math.random() * 12), v: Math.random() > 0.1 }
      ],
      rssi_age: simTime % 1000 < 200 ? 0 : (simTime % 1000)
    };
    processTelemetry(simMsg);
  }, 100);
  
} else {
  console.log('[SERIAL] Opening', config.serial.port, 'at', config.serial.baud, 'baud...');
  
  // Dynamic import to avoid crash when serialport isn't needed (simulate mode)
  const { SerialPort } = await import('serialport');
  const { ReadlineParser } = await import('@serialport/parser-readline');
  
  let port = null;
  let reconnectTimer = null;
  
  function connectSerial() {
    try {
      port = new SerialPort({
        path: config.serial.port,
        baudRate: config.serial.baud,
        autoOpen: false
      });
      
      const parser = port.pipe(new ReadlineParser({ delimiter: '\\n' }));
      
      port.on('open', () => {
        console.log('[SERIAL] Connected to', config.serial.port);
        deviceConnected = true;
        logEvent(null, 'serial_connect', { port: config.serial.port });
        broadcast({ type: 'status', connected: true });
      });
      
      parser.on('data', (line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed[0] !== '{') return;
        
        try {
          const msg = JSON.parse(trimmed);
          
          // Handle events (boot, init, errors)
          if (msg.event) {
            console.log('[ESP32 EVENT]', msg.event, msg.status || '');
            logEvent(msg.device || 'tracker', msg.event, msg);
            return;
          }
          
          // Handle telemetry
          if (msg.type === 'telemetry') {
            processTelemetry(msg);
          }
        } catch (e) {
          errorCount++;
          if (errorCount % 100 === 1) {
            console.warn('[SERIAL] Parse error #' + errorCount + ':', e.message, '| Line:', trimmed.substring(0, 80));
          }
        }
      });
      
      port.on('error', (err) => {
        console.error('[SERIAL] Error:', err.message);
        deviceConnected = false;
        logEvent(null, 'serial_error', err.message);
        broadcast({ type: 'status', connected: false });
        scheduleReconnect();
      });
      
      port.on('close', () => {
        console.log('[SERIAL] Port closed');
        deviceConnected = false;
        logEvent(null, 'serial_disconnect', { port: config.serial.port });
        broadcast({ type: 'status', connected: false });
        scheduleReconnect();
      });
      
      port.open();
      
    } catch (err) {
      console.error('[SERIAL] Failed to open:', err.message);
      scheduleReconnect();
    }
  }
  
  function scheduleReconnect() {
    if (reconnectTimer) return;
    console.log('[SERIAL] Reconnecting in 3 seconds...');
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectSerial();
    }, 3000);
  }
  
  connectSerial();
}

// ── Periodic maintenance ──
setInterval(() => {
  // Check for stale connection
  if (deviceConnected && !SIMULATE && Date.now() - lastTelemetryTs > 5000) {
    console.warn('[HEALTH] No telemetry for 5s, marking device as disconnected');
    deviceConnected = false;
    broadcast({ type: 'status', connected: false });
  }
}, 5000);

// Prune old records daily
setInterval(() => pruneOldRecords(7), 24 * 60 * 60 * 1000);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\\nShutting down...');
  wss.close();
  process.exit(0);
});

console.log('[READY] Gateway running. Dashboard WebSocket: ws://localhost:' + config.ws.port);
`.trimStart());
console.log('  Wrote: server/index.js');


// ─────────────────────────────────────────────────────────
// FILE 9: src/hardware/calibration.js
// ─────────────────────────────────────────────────────────
writeFileSync(join(ROOT, 'src/hardware/calibration.js'), `
/**
 * RSSI Calibration Configuration
 * 
 * These values must be measured in your actual deployment environment.
 * 
 * CALIBRATION PROCEDURE:
 * 1. Place tracker at exactly 1 meter from Anchor A
 * 2. Record ~30 seconds of RSSI readings
 * 3. Take the mean RSSI — this is your RSSI_REF for Anchor A
 * 4. Repeat for Anchor B
 * 5. Place tracker at a known distance (e.g. 5m) and measure RSSI
 * 6. Solve for PLE: n = (RSSI_REF - RSSI_measured) / (10 * log10(d))
 * 
 * LIMITATIONS:
 * - RSSI varies ±5-10 dBm due to multipath, body shadowing, orientation
 * - PLE changes with obstacles, people, doors
 * - Two anchors cannot uniquely determine 2D position (sign ambiguity)
 * - Double-integrated IMU drifts quadratically; not reliable beyond ~10s
 */

export const DEFAULT_CALIBRATION = {
  anchors: {
    A: { id: 'A', ssid: 'INDOOR_ANCHOR_A', x: 2.0, y: 0.0, rssiRef: -45 },
    B: { id: 'B', ssid: 'INDOOR_ANCHOR_B', x: 8.0, y: 0.0, rssiRef: -45 }
  },
  
  ple: 2.4,              // Path-Loss Exponent (calibrate for your environment)
  rssiMinValid: -90,     // Ignore RSSI weaker than this
  rssiSentinel: -127,    // ESP32 sentinel for "not detected"
  
  // EMA filter smoothing factor (0 = no smoothing, 1 = no filtering)
  rssiFilterAlpha: 0.3,
  
  // Grid dimensions for display (meters)
  gridWidth: 10,
  gridHeight: 8
};

/**
 * Convert RSSI to estimated distance using log-distance path loss model
 * d = 10^((RSSI_REF - RSSI) / (10 * PLE))
 */
export function rssiToDistanceCalibrated(rssi, rssiRef = -45, ple = 2.4) {
  if (rssi <= -127 || rssi > 0) return null;
  const safePLE = Math.max(1.1, ple);
  const exponent = (rssiRef - rssi) / (10 * safePLE);
  const dist = Math.pow(10, exponent);
  return Math.max(0.1, Math.min(100, dist));
}
`.trimStart());
console.log('  Wrote: src/hardware/calibration.js');


// ─────────────────────────────────────────────────────────
// FILE 10: src/hardware/positionEstimator.js
// ─────────────────────────────────────────────────────────
writeFileSync(join(ROOT, 'src/hardware/positionEstimator.js'), `
/**
 * 2-Anchor Position Estimator
 * 
 * GEOMETRIC CONSTRAINT:
 * Two RSSI anchors do NOT uniquely determine 2D position.
 * Two distance circles intersect at 0, 1, or 2 points.
 * Without a third constraint, there is an inherent sign ambiguity
 * (the tracker could be on either side of the anchor baseline).
 * 
 * This module implements:
 * 1. Baseline projection (x along the line between anchors)
 * 2. Perpendicular offset estimation (y, with sign ambiguity)
 * 3. Single-anchor fallback (distance ring only)
 * 4. Integration point for IMU dead-reckoning displacement
 * 
 * For reliable 2D positioning, add a third anchor.
 */

/**
 * Estimate position given two anchor distances
 * @param {number|null} distA - Distance to Anchor A (meters), null if unavailable
 * @param {number|null} distB - Distance to Anchor B (meters), null if unavailable
 * @param {{ x: number, y: number }} ancA - Anchor A position
 * @param {{ x: number, y: number }} ancB - Anchor B position
 * @returns {{ x, y, valid, method, confidence, note }}
 */
export function estimate2AnchorPosition(distA, distB, ancA, ancB) {
  if (distA === null && distB === null) {
    return { x: null, y: null, valid: false, method: 'none', confidence: 0 };
  }
  
  const dx = ancB.x - ancA.x;
  const dy = ancB.y - ancA.y;
  const D = Math.sqrt(dx * dx + dy * dy);
  
  if (D < 0.01) {
    return { x: null, y: null, valid: false, method: 'degenerate', confidence: 0 };
  }
  
  // Single anchor fallback
  if (distA !== null && distB === null) {
    return {
      x: ancA.x + (dx / D) * distA * 0.6,
      y: ancA.y + (dy / D) * distA * 0.6,
      valid: false,
      method: '1-anchor',
      confidence: 12
    };
  }
  if (distA === null && distB !== null) {
    return {
      x: ancB.x - (dx / D) * distB * 0.6,
      y: ancB.y - (dy / D) * distB * 0.6,
      valid: false,
      method: '1-anchor',
      confidence: 12
    };
  }
  
  // 2-anchor baseline projection
  const xAlong = (D * D + distA * distA - distB * distB) / (2 * D);
  const yPerpSq = distA * distA - xAlong * xAlong;
  const yPerp = yPerpSq > 0 ? Math.sqrt(yPerpSq) : 0;
  
  const ux = dx / D;
  const uy = dy / D;
  const px = -uy;
  const py = ux;
  
  const worldX = ancA.x + xAlong * ux + yPerp * px;
  const worldY = ancA.y + xAlong * uy + yPerp * py;
  
  const residual = Math.abs(Math.sqrt(xAlong * xAlong + yPerp * yPerp) - distA);
  const confidence = Math.max(15, Math.min(80, 80 - residual * 12));
  
  return {
    x: Number(worldX.toFixed(3)),
    y: Number(worldY.toFixed(3)),
    valid: yPerpSq >= 0,
    method: '2-anchor-baseline',
    confidence: Number(confidence.toFixed(1)),
    note: yPerpSq < 0 ? 'Inconsistent distances (circles do not intersect)' : undefined
  };
}
`.trimStart());
console.log('  Wrote: src/hardware/positionEstimator.js');


// ─────────────────────────────────────────────────────────
// FILE 11: src/hardware/HardwareProvider.js
// ─────────────────────────────────────────────────────────
writeFileSync(join(ROOT, 'src/hardware/HardwareProvider.js'), `
/**
 * HardwareProvider — WebSocket client connecting React dashboard
 * to the Node.js ESP32 gateway.
 * 
 * Receives real-time telemetry + position updates and exposes them
 * via callbacks for integration into App.jsx.
 */

const DEFAULT_WS_URL = 'ws://localhost:8765';
const RECONNECT_DELAY_MS = 3000;
const STALE_THRESHOLD_MS = 5000;

export class HardwareProvider {
  constructor(wsUrl = DEFAULT_WS_URL) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.connected = false;
    this.deviceConnected = false;
    this.reconnectTimer = null;
    this.lastMessageTs = 0;
    
    // Callbacks
    this.onTelemetry = null;   // (data) => void
    this.onStatus = null;      // (status) => void
    this.onConnect = null;     // () => void
    this.onDisconnect = null;  // () => void
    
    // Latest state
    this.lastTelemetry = null;
    this.lastPosition = null;
    this.messageCount = 0;
  }
  
  connect() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
    }
    
    try {
      this.ws = new WebSocket(this.wsUrl);
    } catch (e) {
      console.error('[HW] WebSocket creation failed:', e.message);
      this._scheduleReconnect();
      return;
    }
    
    this.ws.onopen = () => {
      console.log('[HW] Connected to gateway');
      this.connected = true;
      if (this.onConnect) this.onConnect();
    };
    
    this.ws.onmessage = (event) => {
      this.lastMessageTs = Date.now();
      try {
        const data = JSON.parse(event.data);
        this.messageCount++;
        
        if (data.type === 'telemetry') {
          this.lastTelemetry = data;
          this.lastPosition = data.position;
          this.deviceConnected = true;
          if (this.onTelemetry) this.onTelemetry(data);
        }
        
        if (data.type === 'status') {
          this.deviceConnected = data.connected;
          if (this.onStatus) this.onStatus(data);
        }
        
        if (data.type === 'state') {
          this.deviceConnected = data.connected;
          this.lastPosition = data.position;
          if (this.onStatus) this.onStatus(data);
        }
      } catch (e) {
        // Ignore parse errors
      }
    };
    
    this.ws.onclose = () => {
      console.log('[HW] Disconnected from gateway');
      this.connected = false;
      this.deviceConnected = false;
      if (this.onDisconnect) this.onDisconnect();
      this._scheduleReconnect();
    };
    
    this.ws.onerror = (err) => {
      console.warn('[HW] WebSocket error');
      // onclose will fire after this
    };
  }
  
  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;  // prevent reconnect
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.deviceConnected = false;
  }
  
  _scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log('[HW] Reconnecting...');
      this.connect();
    }, RECONNECT_DELAY_MS);
  }
  
  isStale() {
    return Date.now() - this.lastMessageTs > STALE_THRESHOLD_MS;
  }
  
  getStatus() {
    return {
      gatewayConnected: this.connected,
      deviceConnected: this.deviceConnected,
      stale: this.isStale(),
      lastMessageAge: Date.now() - this.lastMessageTs,
      messageCount: this.messageCount,
      lastPosition: this.lastPosition,
      lastTelemetry: this.lastTelemetry
    };
  }
}

export default HardwareProvider;
`.trimStart());
console.log('  Wrote: src/hardware/HardwareProvider.js');


console.log('\\n✅ All hardware integration files created successfully!');
console.log('\\nNext steps:');
console.log('  1. cd server && npm install');
console.log('  2. Copy server/.env.example to server/.env and set your serial port');
console.log('  3. Modify src/App.jsx (see instructions below)');
console.log('  4. Run:  cd server && node index.js --simulate');
console.log('  5. Run:  cd .. && npm run dev');
console.log('\\n📝 See the integration guide for App.jsx and Dashboard.jsx changes.');