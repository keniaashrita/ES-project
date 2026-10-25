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
db.exec(`
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
`);

// ── Prepared Statements ──
const insertRaw = db.prepare(`
  INSERT INTO raw_telemetry (device_id, timestamp_ms, ax, ay, az, gx, gy, gz,
    rssi_a, rssi_b, anchor_a_valid, anchor_b_valid, rssi_age_ms, imu_ok)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertPosition = db.prepare(`
  INSERT INTO position_log (device_id, timestamp_ms, est_x, est_y, heading,
    method, valid, confidence, dist_a, dist_b)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertEvent = db.prepare(`
  INSERT INTO events (device_id, event_type, detail) VALUES (?, ?, ?)
`);

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
  return db.prepare(`
    SELECT * FROM position_log
    WHERE device_id = ? AND recorded_at >= datetime('now', '-' || ? || ' minutes')
    ORDER BY recorded_at DESC
    LIMIT 500
  `).all(deviceId, limitMinutes);
}

export function queryRecentRaw(deviceId, limit = 100) {
  return db.prepare(`
    SELECT * FROM raw_telemetry
    WHERE device_id = ?
    ORDER BY id DESC
    LIMIT ?
  `).all(deviceId, limit);
}

// Retention: delete records older than N days
export function pruneOldRecords(days = 7) {
  const cutoff = days.toString();
  db.prepare("DELETE FROM raw_telemetry WHERE received_at < datetime('now', '-' || ? || ' days')").run(cutoff);
  db.prepare("DELETE FROM position_log WHERE recorded_at < datetime('now', '-' || ? || ' days')").run(cutoff);
  db.prepare("DELETE FROM events WHERE occurred_at < datetime('now', '-' || ? || ' days')").run(cutoff);
}

export default db;
