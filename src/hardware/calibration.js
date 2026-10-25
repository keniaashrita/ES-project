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
