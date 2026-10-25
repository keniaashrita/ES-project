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
