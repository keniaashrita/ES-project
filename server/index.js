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
      
      const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
      
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
  console.log('\nShutting down...');
  wss.close();
  process.exit(0);
});

console.log('[READY] Gateway running. Dashboard WebSocket: ws://localhost:' + config.ws.port);
