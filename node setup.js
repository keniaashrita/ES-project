// setup.js - Automated file generator for Adaptive LoRa-IMU Fusion project
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const files = {
  // 1. index.html
  'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23a78bfa'><path d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'/></svg>" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Adaptive LoRa–IMU Sensor Fusion | Embedded GPS-Free Positioning</title>
  </head>
  <body class="bg-slate-950 text-slate-100 antialiased min-h-screen selection:bg-purple-600 selection:text-white">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,

  // 2. src/index.css
  'src/index.css': `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    background-color: #07090e;
    color: #e2e8f0;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }
}

.tech-panel {
  background: linear-gradient(135deg, rgba(17, 21, 34, 0.85) 0%, rgba(12, 15, 23, 0.95) 100%);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(167, 139, 250, 0.18);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.45);
}

@keyframes node-pulse {
  0%, 100% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.3); opacity: 0.2; }
}

.animate-pulse-ring {
  animation: node-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: #0c0f17;
}
::-webkit-scrollbar-thumb {
  background: #232b42;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #8b5cf6;
}`,

  // 3. src/main.jsx
  'src/main.jsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,

  // 4. vite.config.js
  'vite.config.js': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  }
});`,

  // 5. tailwind.config.js
  'tailwind.config.js': `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        charcoal: {
          950: '#07090e',
          900: '#0c0f17',
          850: '#111522',
          800: '#171d2e',
          700: '#232b42',
        },
        lavender: {
          300: '#d8b4fe',
          400: '#c4b5fd',
          500: '#a78bfa',
          600: '#8b5cf6',
        },
        cyber: {
          cyan: '#38bdf8',
          green: '#34d399',
          amber: '#fbbf24',
          rose: '#f43f5e'
        }
      }
    },
  },
  plugins: [],
};`,

  // 6. src/algorithms/rssiModel.js
  'src/algorithms/rssiModel.js': `export function generateGaussianNoise(mean = 0, stdDev = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdDev;
}

export function calculateRSSI(trueDistance, config) {
  const {
    rssi0 = -40,
    d0 = 1.0,
    ple = 2.0,
    noiseStd = 1.5,
    multipathStd = 0.8
  } = config;

  const d = Math.max(0.2, trueDistance);
  const pathLoss = 10 * ple * Math.log10(d / d0);
  const shadowFading = generateGaussianNoise(0, noiseStd);
  const multipath = generateGaussianNoise(0, multipathStd);

  const rssi = rssi0 - pathLoss + shadowFading + multipath;
  return Number(rssi.toFixed(2));
}

export function rssiToDistance(rssi, rssi0 = -40, ple = 2.0, d0 = 1.0) {
  const safePLE = Math.max(1.1, ple);
  const exponent = (rssi0 - rssi) / (10 * safePLE);
  const estimatedDist = d0 * Math.pow(10, exponent);
  return Number(Math.max(0.2, Math.min(120, estimatedDist)).toFixed(2));
}`,

  // 7. src/algorithms/adaptivePLE.js
  'src/algorithms/adaptivePLE.js': `export class AdaptivePLEEstimator {
  constructor(initialPLE = 2.0, smoothingFactor = 0.08) {
    this.initialPLE = initialPLE;
    this.currentPLE = initialPLE;
    this.smoothingFactor = smoothingFactor;
    this.rssiHistory = new Map();
    this.historyWindow = 10;
    this.status = 'STABLE';
    this.lastVariance = 1.0;
  }

  reset(initialPLE = 2.0) {
    this.initialPLE = initialPLE;
    this.currentPLE = initialPLE;
    this.rssiHistory.clear();
    this.status = 'STABLE';
    this.lastVariance = 1.0;
  }

  update(anchorObservations, rssi0 = -40) {
    if (!anchorObservations || anchorObservations.length === 0) {
      return {
        currentPLE: this.currentPLE,
        status: this.status,
        variance: this.lastVariance,
        adjustment: this.currentPLE - this.initialPLE
      };
    }

    let totalVariance = 0;
    let validAnchors = 0;
    let instantPLEEstimates = [];

    for (const obs of anchorObservations) {
      const { anchorId, rssi, priorDistance } = obs;
      if (!this.rssiHistory.has(anchorId)) {
        this.rssiHistory.set(anchorId, []);
      }
      const history = this.rssiHistory.get(anchorId);
      history.push(rssi);
      if (history.length > this.historyWindow) {
        history.shift();
      }

      if (history.length >= 3) {
        const mean = history.reduce((sum, v) => sum + v, 0) / history.length;
        const variance = history.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (history.length - 1);
        totalVariance += variance;
        validAnchors++;
      }

      if (priorDistance && priorDistance > 1.2) {
        const logRatio = 10 * Math.log10(priorDistance);
        if (Math.abs(logRatio) > 0.1) {
          const estimatedN = (rssi0 - rssi) / logRatio;
          if (estimatedN >= 1.5 && estimatedN <= 5.0) {
            instantPLEEstimates.push(estimatedN);
          }
        }
      }
    }

    const avgVariance = validAnchors > 0 ? totalVariance / validAnchors : 1.0;
    this.lastVariance = avgVariance;

    if (avgVariance > 6.0) {
      this.status = 'HIGH INTERFERENCE';
    } else if (avgVariance > 3.0) {
      this.status = 'ENVIRONMENT CHANGED';
    } else {
      this.status = 'STABLE';
    }

    if (instantPLEEstimates.length > 0) {
      const meanInstantN = instantPLEEstimates.reduce((sum, n) => sum + n, 0) / instantPLEEstimates.length;
      const dynamicAlpha = this.status === 'ENVIRONMENT CHANGED' ? 0.15 : this.smoothingFactor;
      this.currentPLE = (1 - dynamicAlpha) * this.currentPLE + dynamicAlpha * meanInstantN;
      this.currentPLE = Math.max(1.6, Math.min(4.8, this.currentPLE));
    }

    return {
      currentPLE: Number(this.currentPLE.toFixed(2)),
      initialPLE: Number(this.initialPLE.toFixed(2)),
      status: this.status,
      variance: Number(avgVariance.toFixed(2)),
      adjustment: Number((this.currentPLE - this.initialPLE).toFixed(2))
    };
  }
}`,

  // 8. src/algorithms/trilateration.js
  'src/algorithms/trilateration.js': `export function estimatePositionTrilateration(anchors) {
  const validAnchors = anchors.filter(a => typeof a.estimatedDistance === 'number' && a.estimatedDistance > 0);
  
  if (validAnchors.length < 3) {
    return {
      success: false,
      position: null,
      error: 'Insufficient anchors for 2D trilateration. Minimum 3 required.'
    };
  }

  const n = validAnchors.length;
  const ref = validAnchors[n - 1];
  const xk = ref.x;
  const yk = ref.y;
  const dk = ref.estimatedDistance;

  const A = [];
  const B = [];

  for (let i = 0; i < n - 1; i++) {
    const ai = validAnchors[i];
    const xi = ai.x;
    const yi = ai.y;
    const di = ai.estimatedDistance;

    A.push([2 * (xi - xk), 2 * (yi - yk)]);
    B.push((xi * xi - xk * xk) + (yi * yi - yk * yk) + (dk * dk - di * di));
  }

  let at_a_00 = 0, at_a_01 = 0, at_a_10 = 0, at_a_11 = 0;
  let at_b_0 = 0, at_b_1 = 0;

  for (let i = 0; i < A.length; i++) {
    const a0 = A[i][0];
    const a1 = A[i][1];
    const b = B[i];

    at_a_00 += a0 * a0;
    at_a_01 += a0 * a1;
    at_a_10 += a1 * a0;
    at_a_11 += a1 * a1;

    at_b_0 += a0 * b;
    at_b_1 += a1 * b;
  }

  const det = at_a_00 * at_a_11 - at_a_01 * at_a_10;
  if (Math.abs(det) < 1e-6) {
    return {
      success: false,
      position: null,
      error: 'Collinear anchor geometry detected.'
    };
  }

  const inv_00 = at_a_11 / det;
  const inv_01 = -at_a_01 / det;
  const inv_10 = -at_a_10 / det;
  const inv_11 = at_a_00 / det;

  let estX = inv_00 * at_b_0 + inv_01 * at_b_1;
  let estY = inv_10 * at_b_0 + inv_11 * at_b_1;

  const gdop = Math.sqrt(Math.max(1.0, inv_00 + inv_11));

  let totalResidual = 0;
  for (const a of validAnchors) {
    const geoDist = Math.hypot(estX - a.x, estY - a.y);
    totalResidual += Math.abs(geoDist - a.estimatedDistance);
  }
  const meanResidual = totalResidual / validAnchors.length;

  return {
    success: true,
    position: {
      x: Number(estX.toFixed(2)),
      y: Number(estY.toFixed(2))
    },
    gdop: Number(gdop.toFixed(2)),
    meanResidual: Number(meanResidual.toFixed(2))
  };
}`,

  // 9. src/algorithms/imuDeadReckoning.js
  'src/algorithms/imuDeadReckoning.js': `export class IMUDeadReckoning {
  constructor(initialPosition = { x: 12.0, y: 8.0 }, initialVelocity = { x: 0, y: 0 }) {
    this.x = initialPosition.x;
    this.y = initialPosition.y;
    this.vx = initialVelocity.x;
    this.vy = initialVelocity.y;
    this.heading = 0;
  }

  reset(position = { x: 12.0, y: 8.0 }) {
    this.x = position.x;
    this.y = position.y;
    this.vx = 0;
    this.vy = 0;
    this.heading = 0;
  }

  integrate(imuData, dt = 0.1, applyZUPT = false) {
    const { ax, ay, gz } = imuData;
    this.heading = (this.heading + (gz * (180 / Math.PI)) * dt + 360) % 360;

    if (applyZUPT) {
      this.vx *= 0.5;
      this.vy *= 0.5;
      if (Math.abs(this.vx) < 0.01) this.vx = 0;
      if (Math.abs(this.vy) < 0.01) this.vy = 0;
    } else {
      this.vx += ax * dt;
      this.vy += ay * dt;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    return {
      x: Number(this.x.toFixed(3)),
      y: Number(this.y.toFixed(3)),
      vx: Number(this.vx.toFixed(3)),
      vy: Number(this.vy.toFixed(3)),
      heading: Number(this.heading.toFixed(1))
    };
  }
}`,

  // 10. src/algorithms/motionDetection.js
  'src/algorithms/motionDetection.js': `export function detectMotionState(imuData) {
  const { ax, ay, az, gx, gy, gz } = imuData;
  const accelMag = Math.hypot(ax, ay);
  const gyroMag = Math.hypot(gx, gy, gz);

  let state = 'MOVING';
  let isStationary = false;

  if (accelMag < 0.15 && gyroMag < 0.08) {
    state = 'STATIC';
    isStationary = true;
  } else if (Math.abs(gz) > 0.25 || gyroMag > 0.35) {
    state = 'TURNING';
    isStationary = false;
  } else {
    state = 'MOVING';
    isStationary = false;
  }

  return {
    state,
    isStationary,
    accelMagnitude: Number(accelMag.toFixed(3)),
    gyroMagnitude: Number(gyroMag.toFixed(3))
  };
}`,

  // 11. src/algorithms/adaptiveEKF.js
  'src/algorithms/adaptiveEKF.js': `export class AdaptiveEKF {
  constructor(initialX = 25.0, initialY = 25.0) {
    this.state = [initialX, initialY, 0.0, 0.0];
    this.P = [
      [1.0, 0.0, 0.0, 0.0],
      [0.0, 1.0, 0.0, 0.0],
      [0.0, 0.0, 0.5, 0.0],
      [0.0, 0.0, 0.0, 0.5]
    ];
    this.qAccel = 0.25;
    this.baseR = 4.0;
    this.currentR = 4.0;
    this.lastInnovation = [0.0, 0.0];
    this.lastKalmanGain = [0.5, 0.5];
    this.confidence = 92;
  }

  reset(x = 25.0, y = 25.0) {
    this.state = [x, y, 0.0, 0.0];
    this.P = [
      [1.0, 0.0, 0.0, 0.0],
      [0.0, 1.0, 0.0, 0.0],
      [0.0, 0.0, 0.5, 0.0],
      [0.0, 0.0, 0.0, 0.5]
    ];
    this.lastInnovation = [0.0, 0.0];
    this.lastKalmanGain = [0.5, 0.5];
    this.confidence = 92;
  }

  predict(imu, dt = 0.1) {
    const { ax = 0, ay = 0 } = imu;
    const [px, py, vx, vy] = this.state;

    this.state[0] = px + vx * dt + 0.5 * ax * dt * dt;
    this.state[1] = py + vy * dt + 0.5 * ay * dt * dt;
    this.state[2] = vx + ax * dt;
    this.state[3] = vy + ay * dt;

    const p00 = this.P[0][0], p01 = this.P[0][1], p02 = this.P[0][2], p03 = this.P[0][3];
    const p10 = this.P[1][0], p11 = this.P[1][1], p12 = this.P[1][2], p13 = this.P[1][3];
    const p20 = this.P[2][0], p21 = this.P[2][1], p22 = this.P[2][2], p23 = this.P[2][3];
    const p30 = this.P[3][0], p31 = this.P[3][1], p32 = this.P[3][2], p33 = this.P[3][3];

    const dt2 = dt * dt;
    const dt3 = dt2 * dt / 2.0;
    const dt4 = dt2 * dt2 / 4.0;
    const q = this.qAccel;

    this.P[0][0] = p00 + dt * (p20 + p02) + dt2 * p22 + q * dt4;
    this.P[0][1] = p01 + dt * p21 + dt * p03 + dt2 * p23;
    this.P[0][2] = p02 + dt * p22 + q * dt3;
    this.P[0][3] = p03 + dt * p23;

    this.P[1][0] = p10 + dt * p30 + dt * p12 + dt2 * p32;
    this.P[1][1] = p11 + dt * (p31 + p13) + dt2 * p33 + q * dt4;
    this.P[1][2] = p12 + dt * p32;
    this.P[1][3] = p13 + dt * p33 + q * dt3;

    this.P[2][0] = p20 + dt * p22 + q * dt3;
    this.P[2][1] = p21 + dt * p23;
    this.P[2][2] = p22 + q * dt2;
    this.P[2][3] = p23;

    this.P[3][0] = p30 + dt * p32;
    this.P[3][1] = p31 + dt * p33 + q * dt3;
    this.P[3][2] = p32;
    this.P[3][3] = p33 + q * dt2;

    this._updateConfidence();
    return this.getState();
  }

  update(loraPos, quality = {}) {
    const { rssiVariance = 1.0, gdop = 1.5, isPacketDropped = false } = quality;

    if (isPacketDropped || !loraPos) {
      return { updated: false, state: this.getState() };
    }

    const beta = 1.8;
    const adaptiveR = this.baseR * (1.0 + beta * Math.max(0, rssiVariance - 0.5)) * Math.max(1.0, gdop / 1.5);
    this.currentR = Number(adaptiveR.toFixed(2));

    const yx = loraPos.x - this.state[0];
    const yy = loraPos.y - this.state[1];
    this.lastInnovation = [Number(yx.toFixed(3)), Number(yy.toFixed(3))];

    const s00 = this.P[0][0] + adaptiveR;
    const s11 = this.P[1][1] + adaptiveR;

    const kx0 = this.P[0][0] / s00;
    const ky1 = this.P[1][1] / s11;
    const kx2 = this.P[2][0] / s00;
    const ky3 = this.P[3][1] / s11;
    this.lastKalmanGain = [Number(kx0.toFixed(3)), Number(ky1.toFixed(3))];

    this.state[0] += kx0 * yx;
    this.state[1] += ky1 * yy;
    this.state[2] += kx2 * yx;
    this.state[3] += ky3 * yy;

    this.P[0][0] *= (1.0 - kx0);
    this.P[1][1] *= (1.0 - ky1);
    this.P[2][2] *= Math.max(0.05, 1.0 - kx2 * 0.5);
    this.P[3][3] *= Math.max(0.05, 1.0 - ky3 * 0.5);

    this._updateConfidence();
    return { updated: true, adaptiveR: this.currentR, state: this.getState() };
  }

  _updateConfidence() {
    const posUncertainty = Math.sqrt(this.P[0][0] + this.P[1][1]);
    const conf = Math.max(20, Math.min(98, 100 - posUncertainty * 14));
    this.confidence = Math.round(conf);
  }

  getState() {
    return {
      x: Number(this.state[0].toFixed(2)),
      y: Number(this.state[1].toFixed(2)),
      vx: Number(this.state[2].toFixed(2)),
      vy: Number(this.state[3].toFixed(2)),
      confidence: this.confidence,
      rValue: this.currentR,
      kalmanGain: this.lastKalmanGain,
      innovation: this.lastInnovation
    };
  }
}`,

  // 12. src/simulation/SensorProvider.js
  'src/simulation/SensorProvider.js': `export class SensorProvider {
  getIMUData() { throw new Error('Not implemented'); }
  getLoRaData() { throw new Error('Not implemented'); }
}

export class SimulationSensorProvider extends SensorProvider {
  constructor() {
    super();
    this.currentIMU = { ax: 0, ay: 0, az: 9.81, gx: 0, gy: 0, gz: 0, timestamp: Date.now() };
    this.currentLoRa = [];
  }

  updateSensors(imu, lora) {
    this.currentIMU = { ...imu, timestamp: Date.now() };
    this.currentLoRa = lora || [];
  }

  getIMUData() { return this.currentIMU; }
  getLoRaData() { return this.currentLoRa; }
}`,

  // 13. src/simulation/trajectory.js
  'src/simulation/trajectory.js': `export function generateTrajectoryPoint(type, timeSec, origin = { x: 25, y: 25 }) {
  let x = origin.x, y = origin.y, vx = 0, vy = 0, ax = 0, ay = 0, heading = 0;

  switch (type) {
    case 'Circular': {
      const radius = 16;
      const speed = 0.25;
      const angle = (timeSec * speed) % (2 * Math.PI);
      x = origin.x + radius * Math.cos(angle);
      y = origin.y + radius * Math.sin(angle);
      vx = -radius * speed * Math.sin(angle);
      vy = radius * speed * Math.cos(angle);
      ax = -radius * speed * speed * Math.cos(angle);
      ay = -radius * speed * speed * Math.sin(angle);
      heading = (Math.atan2(vy, vx) * (180 / Math.PI) + 360) % 360;
      break;
    }
    case 'Square': {
      const side = 28;
      const period = 32;
      const t = timeSec % period;
      const speed = (4 * side) / period;
      if (t < period * 0.25) {
        x = (origin.x - side / 2) + (t / (period * 0.25)) * side;
        y = origin.y - side / 2;
        vx = speed; heading = 0;
      } else if (t < period * 0.5) {
        x = origin.x + side / 2;
        y = (origin.y - side / 2) + ((t - period * 0.25) / (period * 0.25)) * side;
        vy = speed; heading = 90;
      } else if (t < period * 0.75) {
        x = (origin.x + side / 2) - ((t - period * 0.5) / (period * 0.25)) * side;
        y = origin.y + side / 2;
        vx = -speed; heading = 180;
      } else {
        x = origin.x - side / 2;
        y = (origin.y + side / 2) - ((t - period * 0.75) / (period * 0.25)) * side;
        vy = -speed; heading = 270;
      }
      break;
    }
    case 'Straight Line': {
      const distance = 36;
      const speed = 1.2;
      const cycle = (timeSec * speed) % (distance * 2);
      const currDist = cycle < distance ? cycle : (2 * distance - cycle);
      const direction = cycle < distance ? 1 : -1;
      x = (origin.x - distance / 2) + currDist;
      y = origin.y;
      vx = speed * direction;
      heading = direction > 0 ? 0 : 180;
      break;
    }
    case 'Random Walk': {
      const scale = 15;
      x = origin.x + scale * Math.sin(timeSec * 0.18) * Math.cos(timeSec * 0.11);
      y = origin.y + scale * Math.cos(timeSec * 0.32) * Math.sin(timeSec * 0.18);
      heading = (Math.atan2(Math.cos(timeSec * 0.32), Math.sin(timeSec * 0.18)) * (180 / Math.PI) + 360) % 360;
      break;
    }
    default: {
      const a = 16, speed = 0.2, t = timeSec * speed;
      x = origin.x + (a * Math.cos(t)) / (1 + Math.sin(t) * Math.sin(t));
      y = origin.y + (a * Math.sin(t) * Math.cos(t)) / (1 + Math.sin(t) * Math.sin(t));
      vx = -a * Math.sin(t);
      vy = a * Math.cos(2 * t);
      heading = (Math.atan2(vy, vx) * (180 / Math.PI) + 360) % 360;
      break;
    }
  }

  return {
    x: Number(Math.max(2, Math.min(48, x)).toFixed(2)),
    y: Number(Math.max(2, Math.min(48, y)).toFixed(2)),
    vx: Number(vx.toFixed(2)),
    vy: Number(vy.toFixed(2)),
    ax: Number(ax.toFixed(2)),
    ay: Number(ay.toFixed(2)),
    heading: Number(heading.toFixed(1))
  };
}`,

  // 14. src/simulation/environment.js
  'src/simulation/environment.js': `export const ENVIRONMENTS = {
  'Open Outdoor': {
    name: 'Open Outdoor',
    ple: 2.0,
    rssiNoiseStd: 1.2,
    multipathStd: 0.5,
    packetLossProb: 0.01,
  },
  'Semi-Outdoor': {
    name: 'Semi-Outdoor',
    ple: 2.4,
    rssiNoiseStd: 2.2,
    multipathStd: 1.2,
    packetLossProb: 0.04,
  },
  'Indoor': {
    name: 'Indoor',
    ple: 2.85,
    rssiNoiseStd: 3.5,
    multipathStd: 2.0,
    packetLossProb: 0.08,
  },
  'High Multipath': {
    name: 'High Multipath',
    ple: 3.3,
    rssiNoiseStd: 5.2,
    multipathStd: 3.8,
    packetLossProb: 0.15,
  },
  'Obstructed': {
    name: 'Obstructed',
    ple: 4.0,
    rssiNoiseStd: 7.0,
    multipathStd: 4.5,
    packetLossProb: 0.28,
  }
};`,

  // 15. src/utils/calculations.js
  'src/utils/calculations.js': `export function calculateDistance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function calculateRMSE(errors) {
  if (!errors || errors.length === 0) return 0;
  const sumSquares = errors.reduce((acc, val) => acc + val * val, 0);
  return Number(Math.sqrt(sumSquares / errors.length).toFixed(2));
}

export function calculateMean(values) {
  if (!values || values.length === 0) return 0;
  return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
}

export function calculateMax(values) {
  if (!values || values.length === 0) return 0;
  return Number(Math.max(...values).toFixed(2));
}`,

  // 16. src/utils/exportData.js
  'src/utils/exportData.js': `export function exportToCSV(telemetryHistory, filename = 'lora_imu_sensor_fusion_log.csv') {
  if (!telemetryHistory || telemetryHistory.length === 0) {
    alert('No telemetry data available to export.');
    return;
  }
  const headers = [
    'timestamp','true_x','true_y','imu_x','imu_y','lora_x','lora_y','fused_x','fused_y',
    'rssi_anchor_1','rssi_anchor_2','rssi_anchor_3','ple','r_value','kalman_gain','position_error'
  ];
  const rows = telemetryHistory.map(d => [
    d.timestamp, d.true_x, d.true_y, d.imu_x, d.imu_y,
    d.lora_x !== null ? d.lora_x : '', d.lora_y !== null ? d.lora_y : '',
    d.fused_x, d.fused_y, d.rssi_anchor_1 ?? '', d.rssi_anchor_2 ?? '', d.rssi_anchor_3 ?? '',
    d.ple, d.r_value, d.kalman_gain, d.position_error
  ]);
  const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToJSON(telemetryHistory, filename = 'lora_imu_sensor_fusion_log.json') {
  if (!telemetryHistory || telemetryHistory.length === 0) {
    alert('No telemetry data available to export.');
    return;
  }
  const blob = new Blob([JSON.stringify(telemetryHistory, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}`,

  // 17. src/components/Dashboard.jsx
  'src/components/Dashboard.jsx': `import React from 'react';
import { Activity, Radio, Navigation, Cpu, ShieldCheck, Zap, Target } from 'lucide-react';
import SensorCards from './SensorCards';

export default function Dashboard({
  simulationStatus, groundTruth, fusedPosition, imuPosition, loraPosition,
  positionError, imuError, loraError, anchorTableData, imuData, pleData,
  ekfState, motionState, packetStats
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="tech-panel p-3 rounded-lg border-l-4 border-l-cyber-green">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>SYSTEM STATUS</span>
            <Activity className="w-3.5 h-3.5 text-cyber-green" />
          </div>
          <div className="text-lg font-mono font-bold text-white tracking-wider">{simulationStatus}</div>
          <div className="text-[10px] text-cyber-green mt-0.5">Rate: 10 Hz (dt=0.1s)</div>
        </div>

        <div className="tech-panel p-3 rounded-lg border-l-4 border-l-cyber-rose">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>GPS MODULE</span>
            <Navigation className="w-3.5 h-3.5 text-cyber-rose" />
          </div>
          <div className="text-lg font-mono font-bold text-cyber-rose tracking-wider">DISABLED</div>
          <div className="text-[10px] text-slate-400 mt-0.5">GPS-Denied Operation</div>
        </div>

        <div className="tech-panel p-3 rounded-lg border-l-4 border-l-cyber-cyan">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>LoRa 868MHz</span>
            <Radio className="w-3.5 h-3.5 text-cyber-cyan" />
          </div>
          <div className="text-lg font-mono font-bold text-cyber-cyan tracking-wider">
            {packetStats.lastUpdateSec < 2.0 ? 'CONNECTED' : 'STANDBY'}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Loss: {packetStats.lossRate}% | 1 Hz Rx</div>
        </div>

        <div className="tech-panel p-3 rounded-lg border-l-4 border-l-lavender-500">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>6-DoF IMU</span>
            <Cpu className="w-3.5 h-3.5 text-lavender-400" />
          </div>
          <div className="text-lg font-mono font-bold text-lavender-400 tracking-wider">ACTIVE</div>
          <div className="text-[10px] text-slate-400 mt-0.5">ZUPT: {motionState.state}</div>
        </div>

        <div className="tech-panel p-3 rounded-lg border-l-4 border-l-cyber-amber">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>ADAPTIVE EKF</span>
            <ShieldCheck className="w-3.5 h-3.5 text-cyber-amber" />
          </div>
          <div className="text-lg font-mono font-bold text-cyber-amber tracking-wider">{ekfState.confidence}% CONF</div>
          <div className="text-[10px] text-slate-400 mt-0.5">R_adapt = {ekfState.rValue}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="tech-panel p-5 rounded-xl lg:col-span-2">
          <div className="flex items-center justify-between border-b border-charcoal-700 pb-3 mb-4">
            <div className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-lavender-400" />
              <h3 className="font-semibold text-white tracking-wide">Real-Time Coordinate Telemetry</h3>
            </div>
            <div className="text-xs font-mono px-2.5 py-1 rounded bg-charcoal-800 border border-charcoal-700 text-slate-300">
              Grid: 50m × 50m
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="bg-charcoal-900 p-3 rounded-lg border border-charcoal-700">
              <div className="text-[11px] font-mono text-slate-400 mb-1">GROUND TRUTH</div>
              <div className="text-sm font-mono text-slate-200">X: <span className="font-bold text-white">{groundTruth.x.toFixed(2)}</span> m</div>
              <div className="text-sm font-mono text-slate-200">Y: <span className="font-bold text-white">{groundTruth.y.toFixed(2)}</span> m</div>
              <div className="text-[10px] text-cyber-green mt-1">Reference</div>
            </div>

            <div className="bg-charcoal-900 p-3 rounded-lg border border-lavender-500/40">
              <div className="text-[11px] font-mono text-lavender-400 mb-1">FUSED ESTIMATE</div>
              <div className="text-sm font-mono text-slate-200">X: <span className="font-bold text-lavender-300">{fusedPosition.x.toFixed(2)}</span> m</div>
              <div className="text-sm font-mono text-slate-200">Y: <span className="font-bold text-lavender-300">{fusedPosition.y.toFixed(2)}</span> m</div>
              <div className="text-[10px] text-cyber-cyan mt-1">Error: <span className="font-bold">{positionError.toFixed(2)} m</span></div>
            </div>

            <div className="bg-charcoal-900 p-3 rounded-lg border border-charcoal-700">
              <div className="text-[11px] font-mono text-cyber-rose mb-1">IMU ONLY</div>
              <div className="text-sm font-mono text-slate-200">X: <span className="font-bold">{imuPosition.x.toFixed(2)}</span> m</div>
              <div className="text-sm font-mono text-slate-200">Y: <span className="font-bold">{imuPosition.y.toFixed(2)}</span> m</div>
              <div className="text-[10px] text-cyber-rose mt-1">Drift: <span className="font-bold">{imuError.toFixed(2)} m</span></div>
            </div>

            <div className="bg-charcoal-900 p-3 rounded-lg border border-charcoal-700">
              <div className="text-[11px] font-mono text-cyber-amber mb-1">LoRa ONLY</div>
              <div className="text-sm font-mono text-slate-200">X: <span className="font-bold">{loraPosition ? loraPosition.x.toFixed(2) : '--'}</span> m</div>
              <div className="text-sm font-mono text-slate-200">Y: <span className="font-bold">{loraPosition ? loraPosition.y.toFixed(2) : '--'}</span> m</div>
              <div className="text-[10px] text-cyber-amber mt-1">Scatter: <span className="font-bold">{loraError ? loraError.toFixed(2) : '--'} m</span></div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-charcoal-850 rounded-lg border border-charcoal-700 flex flex-wrap items-center justify-between text-xs font-mono">
            <div className="flex items-center space-x-2 text-slate-300">
              <Zap className="w-4 h-4 text-cyber-cyan" />
              <span>Target Accuracy: <strong className="text-white">Sub-3.0 m</strong></span>
            </div>
            <div className="text-slate-400">
              Simulated Fused Error: <strong className={\`font-mono \${positionError < 3.0 ? 'text-cyber-green' : 'text-cyber-amber'}\`}>
                {positionError.toFixed(2)} m
              </strong>
            </div>
          </div>
        </div>

        <SensorCards 
          anchorTableData={anchorTableData}
          imuData={imuData}
          pleData={pleData}
          ekfState={ekfState}
          motionState={motionState}
        />
      </div>

      <div className="tech-panel p-5 rounded-xl">
        <h3 className="font-semibold text-white tracking-wide text-sm mb-3">Live LoRa Anchor Status</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-charcoal-850 text-slate-400 uppercase border-b border-charcoal-700">
              <tr>
                <th className="py-2.5 px-3">Anchor</th>
                <th className="py-2.5 px-3">Position</th>
                <th className="py-2.5 px-3">RSSI</th>
                <th className="py-2.5 px-3">True Dist</th>
                <th className="py-2.5 px-3">Est Dist</th>
                <th className="py-2.5 px-3">Error</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-800">
              {anchorTableData.map(anchor => (
                <tr key={anchor.id} className="hover:bg-charcoal-800/60">
                  <td className="py-2 px-3 font-bold text-lavender-400">{anchor.name || anchor.id}</td>
                  <td className="py-2 px-3 text-slate-300">({anchor.x}m, {anchor.y}m)</td>
                  <td className="py-2 px-3 text-cyber-cyan font-bold">{anchor.rssi} dBm</td>
                  <td className="py-2 px-3 text-slate-300">{anchor.trueDistance.toFixed(2)} m</td>
                  <td className="py-2 px-3 text-slate-200">{anchor.estimatedDistance.toFixed(2)} m</td>
                  <td className="py-2 px-3 text-cyber-amber">{Math.abs(anchor.trueDistance - anchor.estimatedDistance).toFixed(2)} m</td>
                  <td className="py-2 px-3"><span className="px-2 py-0.5 rounded text-[10px] bg-cyber-green/10 text-cyber-green border border-cyber-green/30">ONLINE</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}`,

  // 18. src/components/SimulationMap.jsx
  'src/components/SimulationMap.jsx': `import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Zap, ShieldAlert, WifiOff, Crosshair } from 'lucide-react';

export default function SimulationMap({
  anchors, onAnchorMove, groundTruth, fusedPosition, imuPosition, loraPosition,
  history, isRunning, onStart, onPause, onReset, trajectoryType, onTrajectoryChange,
  onRunDemo, onIntroduceInterference, onSimulatePacketLoss
}) {
  const [draggedAnchorId, setDraggedAnchorId] = useState(null);
  const svgRef = useRef(null);
  const GRID_SIZE = 50;
  const SVG_VIEWBOX = 600;
  const scale = SVG_VIEWBOX / GRID_SIZE;

  const toSvgX = m => m * scale;
  const toSvgY = m => (GRID_SIZE - m) * scale;

  const handleMouseMove = e => {
    if (!draggedAnchorId || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const meterX = Math.max(1, Math.min(49, Math.round(((e.clientX - rect.left) / rect.width) * GRID_SIZE)));
    const meterY = Math.max(1, Math.min(49, Math.round(GRID_SIZE - ((e.clientY - rect.top) / rect.height) * GRID_SIZE)));
    onAnchorMove(draggedAnchorId, meterX, meterY);
  };

  useEffect(() => {
    const handleUp = () => setDraggedAnchorId(null);
    window.addEventListener('mouseup', handleUp);
    return () => window.removeEventListener('mouseup', handleUp);
  }, []);

  return (
    <div className="space-y-4">
      <div className="tech-panel p-4 rounded-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          {isRunning ? (
            <button onClick={onPause} className="flex items-center space-x-1 px-4 py-2 rounded-lg bg-cyber-amber/20 text-cyber-amber border border-cyber-amber/40 hover:bg-cyber-amber/30 text-xs font-mono font-bold">
              <Pause className="w-4 h-4" /><span>PAUSE</span>
            </button>
          ) : (
            <button onClick={onStart} className="flex items-center space-x-1 px-4 py-2 rounded-lg bg-cyber-green/20 text-cyber-green border border-cyber-green/40 hover:bg-cyber-green/30 text-xs font-mono font-bold">
              <Play className="w-4 h-4" /><span>START</span>
            </button>
          )}
          <button onClick={onReset} className="flex items-center space-x-1 px-3 py-2 rounded-lg bg-charcoal-800 text-slate-300 border border-charcoal-700 hover:bg-charcoal-700 text-xs font-mono">
            <RotateCcw className="w-3.5 h-3.5" /><span>RESET</span>
          </button>
        </div>

        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="text-slate-400">TRAJECTORY:</span>
          <select value={trajectoryType} onChange={e => onTrajectoryChange(e.target.value)} className="bg-charcoal-900 text-lavender-300 border border-charcoal-700 rounded-lg px-2.5 py-1.5 focus:outline-none">
            <option value="Circular">Circular Orbit (16m)</option>
            <option value="Square">Square Perimeter (28m)</option>
            <option value="Straight Line">Linear Back-and-Forth</option>
            <option value="Random Walk">Random Walk</option>
            <option value="Custom">Figure-8 Lemniscate</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <button onClick={onRunDemo} className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-lavender-600/30 text-lavender-300 border border-lavender-500/50 hover:bg-lavender-600/50 text-xs font-mono font-semibold">
            <Zap className="w-3.5 h-3.5 text-lavender-400" /><span>RUN DEMO</span>
          </button>
          <button onClick={onIntroduceInterference} className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-cyber-rose/20 text-cyber-rose border border-cyber-rose/40 hover:bg-cyber-rose/30 text-xs font-mono">
            <ShieldAlert className="w-3.5 h-3.5" /><span>INTERFERENCE</span>
          </button>
          <button onClick={onSimulatePacketLoss} className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-cyber-amber/20 text-cyber-amber border border-cyber-amber/40 hover:bg-cyber-amber/30 text-xs font-mono">
            <WifiOff className="w-3.5 h-3.5" /><span>PACKET LOSS</span>
          </button>
        </div>
      </div>

      <div className="tech-panel p-4 rounded-xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Crosshair className="w-4 h-4 text-lavender-400" />
            <h3 className="font-semibold text-white tracking-wide text-sm">2D Positioning Grid (0–50m)</h3>
          </div>
          <span className="text-[11px] text-slate-400">Click & drag anchors to reposition</span>
        </div>

        <div className="relative w-full aspect-square max-h-[640px] bg-charcoal-950 border border-charcoal-800 rounded-lg overflow-hidden select-none">
          <svg ref={svgRef} viewBox={\`0 0 \${SVG_VIEWBOX} \${SVG_VIEWBOX}\`} className="w-full h-full cursor-crosshair" onMouseMove={handleMouseMove}>
            <rect width="100%" height="100%" fill="#090c14" />
            {[0, 10, 20, 30, 40, 50].map(val => (
              <g key={val} className="text-[10px] fill-slate-600 font-mono">
                <line x1={toSvgX(val)} y1="0" x2={toSvgX(val)} y2={SVG_VIEWBOX} stroke="rgba(167, 139, 250, 0.08)" />
                <line x1="0" y1={toSvgY(val)} x2={SVG_VIEWBOX} y2={toSvgY(val)} stroke="rgba(167, 139, 250, 0.08)" />
                <text x={toSvgX(val) + 4} y={SVG_VIEWBOX - 6}>{val}m</text>
                {val > 0 && <text x={6} y={toSvgY(val) - 4}>{val}m</text>}
              </g>
            ))}

            {history.length > 1 && (
              <polyline fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.6" points={history.map(h => \`\${toSvgX(h.true_x)},\${toSvgY(h.true_y)}\`).join(' ')} />
            )}
            {history.length > 1 && (
              <polyline fill="none" stroke="#f43f5e" strokeWidth="1.8" opacity="0.75" points={history.map(h => \`\${toSvgX(h.imu_x)},\${toSvgY(h.imu_y)}\`).join(' ')} />
            )}
            {history.filter(h => h.lora_x !== null).map((h, i) => (
              <circle key={i} cx={toSvgX(h.lora_x)} cy={toSvgY(h.lora_y)} r="2" fill="#fbbf24" opacity="0.4" />
            ))}
            {history.length > 1 && (
              <polyline fill="none" stroke="#a78bfa" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" points={history.map(h => \`\${toSvgX(h.fused_x)},\${toSvgY(h.fused_y)}\`).join(' ')} />
            )}

            {anchors.map(anchor => {
              const ax = toSvgX(anchor.x), ay = toSvgY(anchor.y);
              return (
                <g key={anchor.id} className="cursor-move" onMouseDown={e => { e.stopPropagation(); setDraggedAnchorId(anchor.id); }}>
                  <circle cx={ax} cy={ay} r="14" fill="rgba(56, 189, 248, 0.1)" stroke="#38bdf8" strokeWidth="1.5" />
                  <circle cx={ax} cy={ay} r="5" fill="#38bdf8" />
                  <text x={ax} y={ay - 16} textAnchor="middle" className="text-[11px] font-mono font-bold fill-cyber-cyan">{anchor.name || anchor.id}</text>
                </g>
              );
            })}

            <circle cx={toSvgX(imuPosition.x)} cy={toSvgY(imuPosition.y)} r="6" fill="#f43f5e" opacity="0.9" />
            {loraPosition && <circle cx={toSvgX(loraPosition.x)} cy={toSvgY(loraPosition.y)} r="5" fill="#fbbf24" />}
            <circle cx={toSvgX(groundTruth.x)} cy={toSvgY(groundTruth.y)} r="6" fill="#10b981" />

            <g>
              <circle cx={toSvgX(fusedPosition.x)} cy={toSvgY(fusedPosition.y)} r="16" fill="none" stroke="#a78bfa" strokeWidth="1.5" className="animate-pulse-ring" />
              <circle cx={toSvgX(fusedPosition.x)} cy={toSvgY(fusedPosition.y)} r="7" fill="#8b5cf6" stroke="#ffffff" strokeWidth="1.5" />
            </g>
          </svg>

          <div className="absolute bottom-3 left-3 bg-charcoal-900/90 border border-charcoal-700 p-3 rounded-lg text-xs font-mono space-y-1">
            <div className="flex items-center space-x-2"><div className="w-2.5 h-2.5 rounded-full bg-cyber-cyan" /><span className="text-slate-300">Anchor</span></div>
            <div className="flex items-center space-x-2"><div className="w-2.5 h-0.5 border-b border-dashed border-cyber-green" /><span className="text-slate-300">Ground Truth</span></div>
            <div className="flex items-center space-x-2"><div className="w-2.5 h-0.5 bg-cyber-rose" /><span className="text-slate-300">IMU (Drifting)</span></div>
            <div className="flex items-center space-x-2"><div className="w-2 h-2 rounded-full bg-cyber-amber" /><span className="text-slate-300">LoRa</span></div>
            <div className="flex items-center space-x-2"><div className="w-2.5 h-1 bg-lavender-400 rounded-full" /><span className="text-lavender-300 font-bold">Fused EKF</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}`,

  // 19. src/components/SensorCards.jsx
  'src/components/SensorCards.jsx': `import React from 'react';
import { Activity, Compass, Radio } from 'lucide-react';

export default function SensorCards({ anchorTableData, imuData, pleData, ekfState, motionState }) {
  return (
    <div className="tech-panel p-5 rounded-xl space-y-4">
      <div className="flex items-center justify-between border-b border-charcoal-700 pb-3">
        <h3 className="font-semibold text-white tracking-wide text-sm flex items-center space-x-2">
          <Activity className="w-4 h-4 text-cyber-cyan" />
          <span>Real-Time Sensor Telemetry</span>
        </h3>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30">ONLINE</span>
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-mono text-slate-400">LoRa RSSI Inbound</div>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          {anchorTableData.slice(0, 4).map(a => (
            <div key={a.id} className="bg-charcoal-900 p-2 rounded border border-charcoal-800 flex justify-between">
              <span className="text-slate-400">{a.name || a.id}:</span>
              <span className="font-bold text-cyber-cyan">{a.rssi} dBm</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 border-t border-charcoal-800 pt-3">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span>IMU Odometry</span>
          <span className="text-lavender-300">{motionState.state}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs font-mono text-center">
          <div className="bg-charcoal-900 p-2 rounded border border-charcoal-800">
            <div className="text-[10px] text-slate-500">ACCEL</div>
            <div className="font-bold text-white">{motionState.accelMagnitude} m/s²</div>
          </div>
          <div className="bg-charcoal-900 p-2 rounded border border-charcoal-800">
            <div className="text-[10px] text-slate-500">GYRO</div>
            <div className="font-bold text-white">{motionState.gyroMagnitude} rad/s</div>
          </div>
          <div className="bg-charcoal-900 p-2 rounded border border-charcoal-800">
            <div className="text-[10px] text-slate-500">HEADING</div>
            <div className="font-bold text-cyber-amber">{imuData.heading ?? 0}°</div>
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t border-charcoal-800 pt-3 text-xs font-mono">
        <div className="flex justify-between">
          <span className="text-slate-400">Adaptive PLE (n):</span>
          <span className="font-bold text-cyber-green">{pleData.currentPLE}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">EKF Confidence:</span>
          <span className="font-bold text-lavender-400">{ekfState.confidence}%</span>
        </div>
      </div>
    </div>
  );
}`,

  // 20. src/components/AnchorPanel.jsx
  'src/components/AnchorPanel.jsx': `import React, { useState } from 'react';
import { Plus, Trash2, Radio } from 'lucide-react';

export default function AnchorPanel({ anchors, onAddAnchor, onDeleteAnchor }) {
  const [name, setName] = useState('');
  const [x, setX] = useState(20);
  const [y, setY] = useState(20);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddAnchor({ name: name.trim(), x: Number(x), y: Number(y) });
    setName('');
  };

  return (
    <div className="space-y-6">
      <div className="tech-panel p-5 rounded-xl">
        <h3 className="font-semibold text-white tracking-wide text-sm mb-4 flex items-center space-x-2">
          <Plus className="w-4 h-4 text-cyber-cyan" />
          <span>Deploy New Anchor Node</span>
        </h3>
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
          <input type="text" placeholder="Anchor ID (e.g. A5)" value={name} onChange={e => setName(e.target.value)} className="bg-charcoal-900 border border-charcoal-700 rounded px-3 py-2 text-white" required />
          <input type="number" min="0" max="50" placeholder="X (0-50m)" value={x} onChange={e => setX(e.target.value)} className="bg-charcoal-900 border border-charcoal-700 rounded px-3 py-2 text-white" required />
          <input type="number" min="0" max="50" placeholder="Y (0-50m)" value={y} onChange={e => setY(e.target.value)} className="bg-charcoal-900 border border-charcoal-700 rounded px-3 py-2 text-white" required />
          <button type="submit" className="py-2 bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40 hover:bg-cyber-cyan/30 rounded font-bold">DEPLOY</button>
        </form>
      </div>

      <div className="tech-panel p-5 rounded-xl">
        <h3 className="font-semibold text-white tracking-wide text-sm mb-3">Configured Anchors ({anchors.length})</h3>
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-charcoal-850 text-slate-400 border-b border-charcoal-700">
            <tr>
              <th className="p-2.5">ID</th><th className="p-2.5">Position</th><th className="p-2.5">RSSI</th><th className="p-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-800">
            {anchors.map(a => (
              <tr key={a.id}>
                <td className="p-2.5 font-bold text-lavender-400">{a.name || a.id}</td>
                <td className="p-2.5 text-slate-300">({a.x}m, {a.y}m)</td>
                <td className="p-2.5 text-cyber-cyan">{a.rssi ?? '--'} dBm</td>
                <td className="p-2.5 text-right">
                  <button onClick={() => onDeleteAnchor(a.id)} className="text-slate-500 hover:text-cyber-rose"><Trash2 className="w-4 h-4 inline" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}`,

  // 21. src/components/SensorData.jsx
  'src/components/SensorData.jsx': `import React, { useState } from 'react';
import { Clock } from 'lucide-react';

export default function SensorData({ history }) {
  const [timeWindow, setTimeWindow] = useState(30);
  const windowedHistory = history.slice(-timeWindow * 10);

  const renderSVGChart = (dataKey, strokeColor, label, unit) => {
    const values = windowedHistory.map(d => d[dataKey]).filter(v => v !== null && !isNaN(v));
    if (values.length < 2) return null;
    const actualMin = Math.min(...values);
    const actualMax = Math.max(...values);
    const range = Math.max(0.001, actualMax - actualMin);
    const width = 500, height = 100;
    const points = values.map((val, idx) => {
      const x = (idx / (values.length - 1)) * width;
      const y = height - ((val - actualMin) / range) * (height - 16) - 8;
      return \`\${x},\${y}\`;
    }).join(' ');
    const lastVal = values[values.length - 1];

    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs font-mono">
          <span className="text-slate-400">{label}</span>
          <span className="font-bold" style={{ color: strokeColor }}>{lastVal.toFixed(2)} {unit}</span>
        </div>
        <div className="w-full h-24 bg-charcoal-900 border border-charcoal-800 rounded relative overflow-hidden">
          <svg viewBox={\`0 0 \${width} \${height}\`} preserveAspectRatio="none" className="w-full h-full">
            <polyline fill="none" stroke={strokeColor} strokeWidth="2" points={points} />
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="tech-panel p-4 rounded-xl flex items-center justify-between text-xs font-mono">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-lavender-400" />
          <span className="text-slate-400">WINDOW:</span>
          {[10, 30, 60].map(s => (
            <button key={s} onClick={() => setTimeWindow(s)} className={\`px-3 py-1 rounded border \${timeWindow === s ? 'bg-lavender-600/40 text-lavender-300 border-lavender-500' : 'bg-charcoal-900 text-slate-400 border-charcoal-700'}\`}>
              {s}s
            </button>
          ))}
        </div>
        <div className="text-slate-400">{windowedHistory.length} frames logged</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="tech-panel p-5 rounded-xl">{renderSVGChart('position_error', '#a78bfa', 'Position Error', 'm')}</div>
        <div className="tech-panel p-5 rounded-xl">{renderSVGChart('ple', '#34d399', 'Adaptive PLE', 'n')}</div>
        <div className="tech-panel p-5 rounded-xl">{renderSVGChart('r_value', '#fbbf24', 'Measurement Covariance (R)', 'var')}</div>
        <div className="tech-panel p-5 rounded-xl">{renderSVGChart('imu_drift_error', '#f43f5e', 'IMU Drift Error', 'm')}</div>
      </div>
    </div>
  );
}`,

  // 22. src/components/EKFPanel.jsx
  'src/components/EKFPanel.jsx': `import React from 'react';
import { Cpu, ArrowRight } from 'lucide-react';

export default function EKFPanel({ fusedPosition, loraPosition, ekfState, pleData }) {
  return (
    <div className="space-y-6">
      <div className="tech-panel p-6 rounded-xl">
        <h3 className="font-semibold text-white tracking-wide text-base mb-2 flex items-center space-x-2">
          <Cpu className="w-5 h-5 text-lavender-400" />
          <span>Adaptive Extended Kalman Filter Architecture</span>
        </h3>
        <p className="text-xs text-slate-400 mb-6">IMU dead reckoning propagation (10Hz) corrected by LoRa trilateration (1Hz).</p>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center text-center font-mono text-xs">
          <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-700">
            <div className="text-[10px] text-cyber-rose font-bold">10 Hz IMU</div>
            <div className="font-bold text-white">Acceleration</div>
          </div>
          <div className="hidden md:flex justify-center text-lavender-400"><ArrowRight className="w-5 h-5" /></div>
          <div className="bg-charcoal-900 p-4 rounded-xl border border-lavender-500/40">
            <div className="text-[10px] text-lavender-400 font-bold">PREDICTION</div>
            <div className="font-bold text-white">x̂_k|k-1 = F·x + B·u</div>
          </div>
          <div className="hidden md:flex justify-center text-lavender-400"><ArrowRight className="w-5 h-5" /></div>
          <div className="bg-charcoal-900 p-4 rounded-xl border border-cyber-green/40">
            <div className="text-[10px] text-cyber-green font-bold">FUSED STATE</div>
            <div className="font-bold text-cyber-green">({fusedPosition.x}m, {fusedPosition.y}m)</div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-charcoal-800 grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs text-center">
          <div className="bg-charcoal-900 p-3 rounded-lg border border-cyber-cyan/30">
            <div className="text-slate-400">LoRa Measurement</div>
            <div className="text-white font-bold">({loraPosition ? loraPosition.x : '--'}m, {loraPosition ? loraPosition.y : '--'}m)</div>
          </div>
          <div className="bg-charcoal-900 p-3 rounded-lg border border-cyber-amber/30">
            <div className="text-slate-400">Kalman Gain K</div>
            <div className="text-cyber-amber font-bold">({ekfState.kalmanGain[0]}, {ekfState.kalmanGain[1]})</div>
          </div>
          <div className="bg-charcoal-900 p-3 rounded-lg border border-lavender-500/30">
            <div className="text-slate-400">Adaptive R Covariance</div>
            <div className="text-white font-bold">{ekfState.rValue}</div>
          </div>
        </div>
      </div>
    </div>
  );
}`,

  // 23. src/components/PerformancePanel.jsx
  'src/components/PerformancePanel.jsx': `import React from 'react';
import { calculateRMSE, calculateMean, calculateMax } from '../utils/calculations';

export default function PerformancePanel({ history }) {
  if (!history || history.length < 5) {
    return <div className="tech-panel p-10 text-center font-mono text-slate-400">Run simulation for at least 5s to calculate benchmark.</div>;
  }

  const fusedErrors = history.map(d => d.position_error);
  const imuErrors = history.map(d => d.imu_drift_error || 0);
  const loraErrors = history.map(d => d.lora_error).filter(v => v !== null && !isNaN(v));

  const fusedRMSE = calculateRMSE(fusedErrors);
  const imuRMSE = calculateRMSE(imuErrors);
  const loraRMSE = calculateRMSE(loraErrors);

  return (
    <div className="space-y-6">
      <div className="tech-panel p-6 rounded-xl border-l-4 border-l-lavender-500 flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-white">Target: Sub-3.0m Accuracy</h3>
          <p className="text-xs text-slate-400 mt-1">Calculated in real-time from active simulation coordinates.</p>
        </div>
        <div className="text-right font-mono">
          <div className="text-xs text-slate-400">SIMULATED RMSE</div>
          <div className={\`text-2xl font-bold \${fusedRMSE < 3.0 ? 'text-cyber-green' : 'text-cyber-amber'}\`}>
            {fusedRMSE.toFixed(2)} m
          </div>
        </div>
      </div>

      <div className="tech-panel p-5 rounded-xl">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-charcoal-850 text-slate-400 border-b border-charcoal-700">
            <tr>
              <th className="p-3">Mode</th><th className="p-3">RMSE</th><th className="p-3">Mean Error</th><th className="p-3">Max Drift</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-800">
            <tr>
              <td className="p-3 text-cyber-rose font-bold">IMU Dead Reckoning</td>
              <td className="p-3 text-slate-200">{imuRMSE.toFixed(2)} m</td>
              <td className="p-3 text-slate-200">{calculateMean(imuErrors).toFixed(2)} m</td>
              <td className="p-3 text-cyber-rose">{calculateMax(imuErrors).toFixed(2)} m</td>
            </tr>
            <tr>
              <td className="p-3 text-cyber-amber font-bold">LoRa RSSI Trilateration</td>
              <td className="p-3 text-slate-200">{loraRMSE.toFixed(2)} m</td>
              <td className="p-3 text-slate-200">{calculateMean(loraErrors).toFixed(2)} m</td>
              <td className="p-3 text-cyber-amber">{calculateMax(loraErrors).toFixed(2)} m</td>
            </tr>
            <tr className="bg-lavender-600/10 font-bold">
              <td className="p-3 text-lavender-400">Adaptive LoRa–IMU Fusion</td>
              <td className="p-3 text-cyber-green">{fusedRMSE.toFixed(2)} m</td>
              <td className="p-3 text-white">{calculateMean(fusedErrors).toFixed(2)} m</td>
              <td className="p-3 text-white">{calculateMax(fusedErrors).toFixed(2)} m</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}`,

  // 24. src/components/SystemArchitecture.jsx
  'src/components/SystemArchitecture.jsx': `import React from 'react';
import { Layers, Terminal } from 'lucide-react';

export default function SystemArchitecture() {
  return (
    <div className="space-y-6">
      <div className="tech-panel p-6 rounded-xl">
        <h3 className="font-semibold text-white tracking-wide text-base mb-4 flex items-center space-x-2">
          <Layers className="w-5 h-5 text-lavender-400" />
          <span>System Dataflow & Processing Architecture</span>
        </h3>
        <div className="p-6 bg-charcoal-900 rounded-xl border border-charcoal-700 font-mono text-xs text-slate-300 overflow-x-auto">
          <pre>{
\`LoRa Anchors (1Hz) ──> RSSI Log-Distance Model ──> Trilateration ──> Adaptive R Scaling ──┐
                                                                                           │
IMU Sensor (10Hz)  ──> IMU Dead Reckoning (ZUPT) ─> EKF Prediction Step ─────────────────> EKF Update ──> Fused (x, y)\`
          }</pre>
        </div>
      </div>
    </div>
  );
}`,

  // 25. src/App.jsx
  'src/App.jsx': `import React, { useState, useEffect, useRef } from 'react';
import { Download } from 'lucide-react';

import { calculateRSSI, rssiToDistance } from './algorithms/rssiModel';
import { AdaptivePLEEstimator } from './algorithms/adaptivePLE';
import { estimatePositionTrilateration } from './algorithms/trilateration';
import { IMUDeadReckoning } from './algorithms/imuDeadReckoning';
import { detectMotionState } from './algorithms/motionDetection';
import { AdaptiveEKF } from './algorithms/adaptiveEKF';

import { generateTrajectoryPoint } from './simulation/trajectory';
import { ENVIRONMENTS } from './simulation/environment';

import { exportToCSV, exportToJSON } from './utils/exportData';
import { calculateDistance } from './utils/calculations';

import Dashboard from './components/Dashboard';
import SimulationMap from './components/SimulationMap';
import AnchorPanel from './components/AnchorPanel';
import SensorData from './components/SensorData';
import EKFPanel from './components/EKFPanel';
import PerformancePanel from './components/PerformancePanel';
import SystemArchitecture from './components/SystemArchitecture';

const DEFAULT_ANCHORS = [
  { id: 'A1', name: 'Anchor A1', x: 5, y: 5 },
  { id: 'A2', name: 'Anchor A2', x: 45, y: 5 },
  { id: 'A3', name: 'Anchor A3', x: 25, y: 45 },
  { id: 'A4', name: 'Anchor A4', x: 5, y: 40 }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [isRunning, setIsRunning] = useState(true);
  const [trajectoryType, setTrajectoryType] = useState('Circular');
  const [environmentKey, setEnvironmentKey] = useState('Open Outdoor');
  const [packetLossRate, setPacketLossRate] = useState(5);

  const [anchors, setAnchors] = useState(DEFAULT_ANCHORS);
  const [groundTruth, setGroundTruth] = useState({ x: 25, y: 25, vx: 0, vy: 0, heading: 0 });
  const [fusedPosition, setFusedPosition] = useState({ x: 25, y: 25 });
  const [imuPosition, setImuPosition] = useState({ x: 25, y: 25 });
  const [loraPosition, setLoraPosition] = useState({ x: 25, y: 25 });

  const [positionError, setPositionError] = useState(0.25);
  const [imuError, setImuError] = useState(0.0);
  const [loraError, setLoraError] = useState(0.0);
  const [pleData, setPleData] = useState({ currentPLE: 2.0, initialPLE: 2.0, status: 'STABLE', variance: 1.0 });
  const [ekfState, setEkfState] = useState({ confidence: 94, rValue: 4.0, kalmanGain: [0.5, 0.5], innovation: [0, 0] });
  const [imuTelemetry, setImuTelemetry] = useState({ ax: 0, ay: 0, az: 9.81, gx: 0, gy: 0, gz: 0, heading: 0 });
  const [motionState, setMotionState] = useState({ state: 'MOVING', accelMagnitude: 0.5, gyroMagnitude: 0.05 });
  const [packetStats, setPacketStats] = useState({ sent: 0, received: 0, lossRate: 5, lastUpdateSec: 0 });
  const [anchorTableData, setAnchorTableData] = useState([]);
  const [telemetryHistory, setTelemetryHistory] = useState([]);

  const ekfRef = useRef(new AdaptiveEKF(25, 25));
  const imuReckoningRef = useRef(new IMUDeadReckoning({ x: 25, y: 25 }));
  const pleEstimatorRef = useRef(new AdaptivePLEEstimator(2.0));
  const simTimeRef = useRef(0);
  const loRaTimerRef = useRef(0);
  const demoIntervalRef = useRef(null);

  const handleReset = () => {
    simTimeRef.current = 0;
    loRaTimerRef.current = 0;
    const origin = { x: 25, y: 25, vx: 0, vy: 0, heading: 0 };
    setGroundTruth(origin);
    setFusedPosition({ x: 25, y: 25 });
    setImuPosition({ x: 25, y: 25 });
    setLoraPosition({ x: 25, y: 25 });
    ekfRef.current.reset(25, 25);
    imuReckoningRef.current.reset({ x: 25, y: 25 });
    pleEstimatorRef.current.reset(ENVIRONMENTS[environmentKey].ple);
    setTelemetryHistory([]);
  };

  const handleRunDemo = () => {
    handleReset();
    setTrajectoryType('Circular');
    setEnvironmentKey('Open Outdoor');
    setIsRunning(true);
    if (demoIntervalRef.current) clearTimeout(demoIntervalRef.current);
    demoIntervalRef.current = setTimeout(() => setActiveTab('Performance'), 15000);
  };

  useEffect(() => {
    if (!isRunning) return;
    const dt = 0.1;
    const interval = setInterval(() => {
      simTimeRef.current += dt;
      loRaTimerRef.current += dt;
      const env = ENVIRONMENTS[environmentKey];

      const gt = generateTrajectoryPoint(trajectoryType, simTimeRef.current);
      setGroundTruth(gt);

      const imuData = {
        ax: gt.ax + (Math.random() - 0.5) * 0.08 + 0.03,
        ay: gt.ay + (Math.random() - 0.5) * 0.08 - 0.02,
        az: 9.81 + (Math.random() - 0.5) * 0.05,
        gx: (Math.random() - 0.5) * 0.02,
        gy: (Math.random() - 0.5) * 0.02,
        gz: ((gt.heading * Math.PI) / 180) * 0.1 + (Math.random() - 0.5) * 0.01
      };
      setImuTelemetry({ ...imuData, heading: gt.heading });

      const motion = detectMotionState(imuData);
      setMotionState(motion);

      const imuIntegrated = imuReckoningRef.current.integrate(imuData, dt, motion.isStationary);
      setImuPosition({ x: imuIntegrated.x, y: imuIntegrated.y });

      ekfRef.current.predict(imuData, dt);

      let currentLoraPos = loraPosition;
      let currentAnchorTable = [];

      if (loRaTimerRef.current >= 1.0) {
        loRaTimerRef.current = 0;
        setPacketStats(prev => ({ ...prev, sent: prev.sent + 1 }));

        const isDropped = Math.random() < (packetLossRate / 100);
        if (!isDropped) {
          setPacketStats(prev => ({ ...prev, received: prev.received + 1, lastUpdateSec: 0 }));

          const anchorObservations = anchors.map(anchor => {
            const trueDist = calculateDistance(gt.x, gt.y, anchor.x, anchor.y);
            const rssi = calculateRSSI(trueDist, {
              rssi0: -40, d0: 1.0, ple: env.ple,
              noiseStd: env.rssiNoiseStd, multipathStd: env.multipathStd
            });
            const estDist = rssiToDistance(rssi, -40, pleEstimatorRef.current.currentPLE, 1.0);

            return {
              id: anchor.id, name: anchor.name, x: anchor.x, y: anchor.y,
              trueDistance: trueDist, rssi, estimatedDistance: estDist,
              priorDistance: calculateDistance(fusedPosition.x, fusedPosition.y, anchor.x, anchor.y)
            };
          });

          currentAnchorTable = anchorObservations;
          setAnchorTableData(anchorObservations);

          const pleResult = pleEstimatorRef.current.update(anchorObservations, -40);
          setPleData(pleResult);

          const loraResult = estimatePositionTrilateration(anchorObservations);
          if (loraResult.success && loraResult.position) {
            currentLoraPos = loraResult.position;
            setLoraPosition(currentLoraPos);
            ekfRef.current.update(currentLoraPos, {
              rssiVariance: pleResult.variance,
              gdop: loraResult.gdop,
              isPacketDropped: false
            });
          }
        } else {
          setPacketStats(prev => ({ ...prev, lastUpdateSec: Number((prev.lastUpdateSec + 1.0).toFixed(1)) }));
          ekfRef.current.update(null, { isPacketDropped: true });
        }
      }

      const currentEKFState = ekfRef.current.getState();
      const fused = { x: currentEKFState.x, y: currentEKFState.y };
      setFusedPosition(fused);
      setEkfState(currentEKFState);

      const currFusedErr = calculateDistance(fused.x, fused.y, gt.x, gt.y);
      const currImuErr = calculateDistance(imuIntegrated.x, imuIntegrated.y, gt.x, gt.y);
      const currLoraErr = currentLoraPos ? calculateDistance(currentLoraPos.x, currentLoraPos.y, gt.x, gt.y) : null;

      setPositionError(currFusedErr);
      setImuError(currImuErr);
      if (currLoraErr !== null) setLoraError(currLoraErr);

      const frame = {
        timestamp: Number(simTimeRef.current.toFixed(1)),
        true_x: gt.x, true_y: gt.y,
        imu_x: imuIntegrated.x, imu_y: imuIntegrated.y,
        lora_x: currentLoraPos ? currentLoraPos.x : null,
        lora_y: currentLoraPos ? currentLoraPos.y : null,
        fused_x: fused.x, fused_y: fused.y,
        rssi_anchor_1: currentAnchorTable[0]?.rssi ?? null,
        rssi_anchor_2: currentAnchorTable[1]?.rssi ?? null,
        rssi_anchor_3: currentAnchorTable[2]?.rssi ?? null,
        ple: pleEstimatorRef.current.currentPLE,
        r_value: currentEKFState.rValue,
        kalman_gain: currentEKFState.kalmanGain[0],
        position_error: Number(currFusedErr.toFixed(2)),
        imu_drift_error: Number(currImuErr.toFixed(2)),
        lora_error: currLoraErr !== null ? Number(currLoraErr.toFixed(2)) : null
      };

      setTelemetryHistory(prev => {
        const next = [...prev, frame];
        return next.length > 600 ? next.slice(-600) : next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, trajectoryType, environmentKey, packetLossRate, anchors]);

  const handleAnchorMove = (id, newX, newY) => {
    setAnchors(prev => prev.map(a => a.id === id ? { ...a, x: newX, y: newY } : a));
  };

  const handleAddAnchor = (anchor) => {
    const id = \`A\${anchors.length + 1}\`;
    setAnchors(prev => [...prev, { ...anchor, id }]);
  };

  const handleDeleteAnchor = (id) => {
    if (anchors.length <= 3) {
      alert('Cannot delete anchor. Minimum 3 anchors required for 2D trilateration.');
      return;
    }
    setAnchors(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="min-h-screen bg-charcoal-950 text-slate-100 flex flex-col">
      <header className="tech-panel border-b border-charcoal-700 px-6 py-3 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-lavender-600/20 border border-lavender-500/50 flex items-center justify-center text-lavender-400 font-mono font-bold text-sm">
              AE
            </div>
            <div>
              <h1 className="text-base font-bold text-white font-mono">Adaptive LoRa–IMU Fusion</h1>
              <p className="text-[11px] text-lavender-400 font-mono">GPS-Free Real-Time Positioning</p>
            </div>
          </div>

          <nav className="flex items-center space-x-1 bg-charcoal-900 p-1 rounded-lg border border-charcoal-800 text-xs font-mono">
            {['Dashboard', 'Simulation', 'Anchors', 'Sensor Data', 'EKF Fusion', 'Performance', 'Architecture'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={\`px-3.5 py-1.5 rounded-md transition \${activeTab === tab ? 'bg-lavender-600 text-white font-bold' : 'text-slate-400 hover:bg-charcoal-800'}\`}
              >
                {tab}
              </button>
            ))}
          </nav>

          <div className="flex items-center space-x-2">
            <button onClick={() => exportToCSV(telemetryHistory)} className="flex items-center space-x-1 px-3 py-1.5 rounded bg-charcoal-800 text-slate-300 border border-charcoal-700 text-xs font-mono hover:bg-charcoal-700">
              <Download className="w-3.5 h-3.5 text-cyber-cyan" /><span>CSV</span>
            </button>
            <button onClick={() => exportToJSON(telemetryHistory)} className="flex items-center space-x-1 px-3 py-1.5 rounded bg-charcoal-800 text-slate-300 border border-charcoal-700 text-xs font-mono hover:bg-charcoal-700">
              <Download className="w-3.5 h-3.5 text-lavender-400" /><span>JSON</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 flex-1 space-y-6">
        <div className="tech-panel p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">ENVIRONMENT:</span>
            <select value={environmentKey} onChange={e => setEnvironmentKey(e.target.value)} className="bg-charcoal-900 text-white border border-charcoal-700 rounded px-2.5 py-1">
              {Object.keys(ENVIRONMENTS).map(env => <option key={env} value={env}>{env}</option>)}
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">PACKET LOSS:</span>
            <input type="range" min="0" max="50" step="5" value={packetLossRate} onChange={e => setPacketLossRate(Number(e.target.value))} className="w-24 cursor-pointer" />
            <span className="text-cyber-amber font-bold">{packetLossRate}%</span>
          </div>
          <div className="flex items-center space-x-3 text-slate-400">
            <span>Sent: <strong className="text-white">{packetStats.sent}</strong></span>
            <span>Rx: <strong className="text-cyber-green">{packetStats.received}</strong></span>
            <span>Time: <strong className="text-cyber-cyan">{simTimeRef.current.toFixed(1)}s</strong></span>
          </div>
        </div>

        {activeTab === 'Dashboard' && (
          <Dashboard
            simulationStatus={isRunning ? 'RUNNING' : 'PAUSED'}
            groundTruth={groundTruth} fusedPosition={fusedPosition} imuPosition={imuPosition} loraPosition={loraPosition}
            positionError={positionError} imuError={imuError} loraError={loraError}
            anchorTableData={anchorTableData} imuData={imuTelemetry} pleData={pleData}
            ekfState={ekfState} motionState={motionState} packetStats={packetStats}
          />
        )}
        {activeTab === 'Simulation' && (
          <SimulationMap
            anchors={anchors} onAnchorMove={handleAnchorMove}
            groundTruth={groundTruth} fusedPosition={fusedPosition} imuPosition={imuPosition} loraPosition={loraPosition}
            history={telemetryHistory} isRunning={isRunning}
            onStart={() => setIsRunning(true)} onPause={() => setIsRunning(false)} onReset={handleReset}
            trajectoryType={trajectoryType} onTrajectoryChange={setTrajectoryType}
            onRunDemo={handleRunDemo} onIntroduceInterference={() => { setEnvironmentKey('High Multipath'); setPacketLossRate(20); }}
            onSimulatePacketLoss={() => setPacketLossRate(50)}
          />
        )}
        {activeTab === 'Anchors' && (
          <AnchorPanel anchors={anchors} onAddAnchor={handleAddAnchor} onDeleteAnchor={handleDeleteAnchor} />
        )}
        {activeTab === 'Sensor Data' && (
          <SensorData history={telemetryHistory} />
        )}
        {activeTab === 'EKF Fusion' && (
          <EKFPanel fusedPosition={fusedPosition} loraPosition={loraPosition} ekfState={ekfState} pleData={pleData} />
        )}
        {activeTab === 'Performance' && (
          <PerformancePanel history={telemetryHistory} />
        )}
        {activeTab === 'Architecture' && (
          <SystemArchitecture />
        )}
      </main>
    </div>
  );
}`
};

console.log('Writing clean project files...');

for (const [relPath, content] of Object.entries(files)) {
  const fullPath = path.join(__dirname, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
  console.log('Created:', relPath);
}

console.log('\\nProject generated successfully!');