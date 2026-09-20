/**
 * Online Adaptive Path-Loss Exponent (PLE) Estimator
 *
 * In real RF environments, walls, obstacles, and human traffic cause the effective
 * PLE (n) to drift from free-space (n=2.0) to dense-clutter (n=3.5+).
 * This module tracks RSSI variance and geometric innovation to dynamically adapt n
 * using exponential smoothing:
 *
 *   n_new = (1 - alpha) * n_prev + alpha * n_est
 */

export class AdaptivePLEEstimator {
  constructor(initialPLE = 2.0, smoothingFactor = 0.08) {
    this.initialPLE = initialPLE;
    this.currentPLE = initialPLE;
    this.smoothingFactor = smoothingFactor;
    this.rssiHistory = new Map(); // anchorId -> Array of last N RSSI values
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

  /**
   * Updates the PLE estimator with the latest RSSI observations and reference distance
   * @param {Array} anchorObservations - Array of { anchorId, rssi, priorDistance }
   * @param {number} rssi0 - Reference RSSI at 1 meter
   * @returns {Object} { currentPLE, status, variance, adjustment }
   */
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

      // Compute rolling variance for this anchor
      if (history.length >= 3) {
        const mean = history.reduce((sum, v) => sum + v, 0) / history.length;
        const variance = history.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (history.length - 1);
        totalVariance += variance;
        validAnchors++;
      }

      // If prior distance is available (from EKF/IMU state), compute instantaneous n
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

    // Detect environment change threshold
    if (avgVariance > 6.0) {
      this.status = 'HIGH INTERFERENCE';
    } else if (avgVariance > 3.0) {
      this.status = 'ENVIRONMENT CHANGED';
    } else {
      this.status = 'STABLE';
    }

    // Adapt PLE if valid estimates exist
    if (instantPLEEstimates.length > 0) {
      const meanInstantN = instantPLEEstimates.reduce((sum, n) => sum + n, 0) / instantPLEEstimates.length;
      
      // Adaptive alpha: adapt faster when environment changes, smoothly when stable
      const dynamicAlpha = this.status === 'ENVIRONMENT CHANGED' ? 0.15 : this.smoothingFactor;
      this.currentPLE = (1 - dynamicAlpha) * this.currentPLE + dynamicAlpha * meanInstantN;
      
      // Keep within realistic physical bounds
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
}