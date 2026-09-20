/**
 * Mathematical & Statistical Metrics Utility
 */

export function calculateDistance(x1, y1, x2, y2) {
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
}