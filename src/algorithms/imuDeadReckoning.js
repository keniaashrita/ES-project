/**
 * IMU Dead Reckoning Model
 *
 * Implements discrete double-integration of acceleration:
 *   v_{k} = v_{k-1} + a_k * dt
 *   p_{k} = p_{k-1} + v_k * dt
 *
 * In an unassisted IMU, integration of small accelerometer bias (b_a)
 * causes unbounded quadratic position drift (p_drift ~ 0.5 * b_a * t^2).
 */

export class IMUDeadReckoning {
  constructor(initialPosition = { x: 12.0, y: 8.0 }, initialVelocity = { x: 0, y: 0 }) {
    this.x = initialPosition.x;
    this.y = initialPosition.y;
    this.vx = initialVelocity.x;
    this.vy = initialVelocity.y;
    this.heading = 0; // degrees
    this.gyroBias = 0.02; // rad/s bias
    this.accelBiasX = 0.04; // m/s^2 bias
    this.accelBiasY = -0.03; // m/s^2 bias
  }

  reset(position = { x: 12.0, y: 8.0 }) {
    this.x = position.x;
    this.y = position.y;
    this.vx = 0;
    this.vy = 0;
    this.heading = 0;
  }

  /**
   * Integrate an IMU measurement over timestep dt
   * @param {Object} imuData - { ax, ay, az, gx, gy, gz } in body/world frame
   * @param {number} dt - Time delta in seconds (typically 0.1s at 10Hz)
   * @param {boolean} applyZUPT - Whether Zero-Velocity Update is currently active
   * @returns {Object} Updated IMU-only position and velocity
   */
  integrate(imuData, dt = 0.1, applyZUPT = false) {
    const { ax, ay, gz } = imuData;

    // Update heading from gyroscope z-rate
    this.heading = (this.heading + (gz * (180 / Math.PI)) * dt + 360) % 360;

    if (applyZUPT) {
      // Zero-Velocity Update dampens velocity drift during static periods
      this.vx *= 0.5;
      this.vy *= 0.5;
      if (Math.abs(this.vx) < 0.01) this.vx = 0;
      if (Math.abs(this.vy) < 0.01) this.vy = 0;
    } else {
      // Integrate acceleration to get velocity
      this.vx += ax * dt;
      this.vy += ay * dt;
    }

    // Integrate velocity to get position
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
}