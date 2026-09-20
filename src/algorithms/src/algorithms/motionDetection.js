/**
 * Motion State Classifier & Zero-Velocity Update (ZUPT) Engine
 *
 * Classifies sensor motion into:
 *   - STATIC: Device is motionless; activates ZUPT to constrain velocity to 0
 *   - MOVING: Device is traveling along linear trajectory
 *   - TURNING: Angular velocity exceeds turning threshold
 */

export function detectMotionState(imuData) {
  const { ax, ay, az, gx, gy, gz } = imuData;

  // Compute 3D Acceleration magnitude (excluding gravity if compensated)
  const accelMag = Math.hypot(ax, ay);
  const gyroMag = Math.hypot(gx, gy, gz);

  let state = 'MOVING';
  let isStationary = false;

  // Stationary condition: acceleration magnitude near 0, gyroscope near 0
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
}
