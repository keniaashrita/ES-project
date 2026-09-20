export function detectMotionState(imuData) {
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
}
