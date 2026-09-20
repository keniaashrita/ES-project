/**
 * Log-Distance Path Loss Model for LoRa RF propagation
 *
 * RSSI(d) = RSSI_0 - 10 * n * log10(d / d_0) + X_sigma + X_multipath
 *
 * where:
 *   RSSI_0: Reference signal strength at distance d_0 (typically -40 dBm at 1 m)
 *   d_0: Reference distance (1 m)
 *   n: Path Loss Exponent (PLE), e.g. 2.0 (free space), 2.5-3.5 (indoor/clutter)
 *   X_sigma: Gaussian shadow fading noise N(0, sigma^2)
 *   X_multipath: Fast fading fluctuation
 */

/**
 * Generates a normally distributed random variable using Box-Muller transform
 * @param {number} mean 
 * @param {number} stdDev 
 * @returns {number}
 */
export function generateGaussianNoise(mean = 0, stdDev = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdDev;
}

/**
 * Calculates simulated RSSI received from an anchor at a given distance
 * @param {number} trueDistance - Distance in meters
 * @param {Object} config - { rssi0, d0, ple, noiseStd, multipathStd }
 * @returns {number} RSSI in dBm
 */
export function calculateRSSI(trueDistance, config) {
  const {
    rssi0 = -40,
    d0 = 1.0,
    ple = 2.0,
    noiseStd = 1.5,
    multipathStd = 0.8
  } = config;

  // Prevent singularity when distance is very close to zero
  const d = Math.max(0.2, trueDistance);

  // Core log-distance deterministic path loss
  const pathLoss = 10 * ple * Math.log10(d / d0);

  // Shadow fading & multipath perturbations
  const shadowFading = generateGaussianNoise(0, noiseStd);
  const multipath = generateGaussianNoise(0, multipathStd);

  const rssi = rssi0 - pathLoss + shadowFading + multipath;
  return Number(rssi.toFixed(2));
}

/**
 * Inverts the path loss model to estimate distance from measured RSSI
 * d_hat = d_0 * 10 ^ ((RSSI_0 - RSSI) / (10 * n))
 * @param {number} rssi - Measured RSSI in dBm
 * @param {number} rssi0 - Reference RSSI at 1 meter
 * @param {number} ple - Path Loss Exponent to use for inversion
 * @param {number} d0 - Reference distance (default 1.0 m)
 * @returns {number} Estimated distance in meters
 */
export function rssiToDistance(rssi, rssi0 = -40, ple = 2.0, d0 = 1.0) {
  const safePLE = Math.max(1.1, ple);
  const exponent = (rssi0 - rssi) / (10 * safePLE);
  const estimatedDist = d0 * Math.pow(10, exponent);
  // Clamp to realistic bounds [0.2m, 120m]
  return Number(Math.max(0.2, Math.min(120, estimatedDist)).toFixed(2));
}