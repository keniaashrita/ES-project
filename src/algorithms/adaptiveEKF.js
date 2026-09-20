/**
 * Adaptive Extended Kalman Filter (EKF) for 2D LoRa-IMU Sensor Fusion
 *
 * State Vector:
 *   x = [p_x, p_y, v_x, v_y]^T
 *
 * High-frequency IMU Prediction (10 Hz):
 *   x_{k|k-1} = F * x_{k-1|k-1} + B * a_{imu}
 *   P_{k|k-1} = F * P_{k-1|k-1} * F^T + Q
 *
 * Low-frequency LoRa Measurement Update (1 Hz):
 *   z = [x_{lora}, y_{lora}]^T
 *   y = z - H * x_{pred}
 *   S = H * P_{pred} * H^T + R_adaptive
 *   K = P_{pred} * H^T * S^-1
 *   x = x_{pred} + K * y
 *   P = (I - K * H) * P_{pred}
 */

export class AdaptiveEKF {
  constructor(initialX = 12.0, initialY = 8.0) {
    // State: [px, py, vx, vy]
    this.state = [initialX, initialY, 0.0, 0.0];

    // State Covariance Matrix P (4x4)
    this.P = [
      [1.0, 0.0, 0.0, 0.0],
      [0.0, 1.0, 0.0, 0.0],
      [0.0, 0.0, 0.5, 0.0],
      [0.0, 0.0, 0.0, 0.5]
    ];

    // Base process noise spectral density
    this.qAccel = 0.25; // Accelerometer process noise variance

    // Base measurement covariance
    this.baseR = 4.0; // LoRa measurement variance (approx 2m standard dev)
    this.currentR = 4.0;

    // Diagnostic logging
    this.lastInnovation = [0.0, 0.0];
    this.lastKalmanGain = [0.5, 0.5];
    this.confidence = 92;
  }

  reset(x = 12.0, y = 8.0) {
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

  /**
   * STEP 1: EKF Prediction using IMU acceleration
   * @param {Object} imu - { ax, ay } acceleration in m/s^2
   * @param {number} dt - Timestep in seconds
   */
  predict(imu, dt = 0.1) {
    const { ax = 0, ay = 0 } = imu;
    const [px, py, vx, vy] = this.state;

    // State Transition:
    // px_new = px + vx * dt + 0.5 * ax * dt^2
    // py_new = py + vy * dt + 0.5 * ay * dt^2
    // vx_new = vx + ax * dt
    // vy_new = vy + ay * dt
    this.state[0] = px + vx * dt + 0.5 * ax * dt * dt;
    this.state[1] = py + vy * dt + 0.5 * ay * dt * dt;
    this.state[2] = vx + ax * dt;
    this.state[3] = vy + ay * dt;

    // State Transition Matrix F:
    // [1, 0, dt,  0]
    // [0, 1,  0, dt]
    // [0, 0,  1,  0]
    // [0, 0,  0,  1]

    // Calculate F * P * F^T
    const p00 = this.P[0][0], p01 = this.P[0][1], p02 = this.P[0][2], p03 = this.P[0][3];
    const p10 = this.P[1][0], p11 = this.P[1][1], p12 = this.P[1][2], p13 = this.P[1][3];
    const p20 = this.P[2][0], p21 = this.P[2][1], p22 = this.P[2][2], p23 = this.P[2][3];
    const p30 = this.P[3][0], p31 = this.P[3][1], p32 = this.P[3][2], p33 = this.P[3][3];

    // Process noise covariance Q (discrete continuous white noise model)
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

    return {
      predX: Number(this.state[0].toFixed(3)),
      predY: Number(this.state[1].toFixed(3)),
      predVx: Number(this.state[2].toFixed(3)),
      predVy: Number(this.state[3].toFixed(3))
    };
  }

  /**
   * STEP 2: EKF Measurement Update with Adaptive Noise Covariance R
   * @param {Object} loraPos - { x, y } estimated from trilateration
   * @param {Object} quality - { rssiVariance, gdop, isPacketDropped }
   */
  update(loraPos, quality = {}) {
    const { rssiVariance = 1.0, gdop = 1.5, isPacketDropped = false } = quality;

    // If packet was dropped, we skip the measurement update completely.
    // The EKF continues propagating state purely based on IMU prediction.
    if (isPacketDropped || !loraPos) {
      return {
        updated: false,
        reason: 'LoRa packet dropped or invalid measurement',
        state: this.getState()
      };
    }

    // DYNAMIC MEASUREMENT NOISE COVARIANCE (Adaptive R):
    // R_k = BaseR * (1 + beta * Var(RSSI)) * GDOP
    // When RSSI is volatile or anchors are poorly distributed (high GDOP),
    // R expands rapidly, lowering Kalman gain and relying more on IMU.
    const beta = 1.8;
    const adaptiveR = this.baseR * (1.0 + beta * Math.max(0, rssiVariance - 0.5)) * Math.max(1.0, gdop / 1.5);
    this.currentR = Number(adaptiveR.toFixed(2));

    // Measurement vector z = [zx, zy]^T
    const zx = loraPos.x;
    const zy = loraPos.y;

    // Innovation y = z - H * x_pred
    // H = [[1, 0, 0, 0], [0, 1, 0, 0]]
    const yx = zx - this.state[0];
    const yy = zy - this.state[1];
    this.lastInnovation = [Number(yx.toFixed(3)), Number(yy.toFixed(3))];

    // Innovation Covariance S = H * P * H^T + R
    const s00 = this.P[0][0] + adaptiveR;
    const s11 = this.P[1][1] + adaptiveR;

    // Kalman Gain K = P * H^T * S^-1
    const kx0 = this.P[0][0] / s00;
    const ky1 = this.P[1][1] / s11;
    const kx2 = this.P[2][0] / s00; // velocity correction gain
    const ky3 = this.P[3][1] / s11;
    this.lastKalmanGain = [Number(kx0.toFixed(3)), Number(ky1.toFixed(3))];

    // State Update: x = x + K * y
    this.state[0] += kx0 * yx;
    this.state[1] += ky1 * yy;
    this.state[2] += kx2 * yx;
    this.state[3] += ky3 * yy;

    // Covariance Update: P = (I - K * H) * P
    this.P[0][0] *= (1.0 - kx0);
    this.P[1][1] *= (1.0 - ky1);
    this.P[2][2] *= Math.max(0.05, 1.0 - kx2 * 0.5);
    this.P[3][3] *= Math.max(0.05, 1.0 - ky3 * 0.5);

    this._updateConfidence();

    return {
      updated: true,
      adaptiveR: this.currentR,
      innovation: this.lastInnovation,
      kalmanGain: this.lastKalmanGain,
      state: this.getState()
    };
  }

  _updateConfidence() {
    // Confidence derived from trace of position covariance
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
}