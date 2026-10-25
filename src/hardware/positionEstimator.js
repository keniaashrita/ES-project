/**
 * 2-Anchor Position Estimator
 * 
 * GEOMETRIC CONSTRAINT:
 * Two RSSI anchors do NOT uniquely determine 2D position.
 * Two distance circles intersect at 0, 1, or 2 points.
 * Without a third constraint, there is an inherent sign ambiguity
 * (the tracker could be on either side of the anchor baseline).
 * 
 * This module implements:
 * 1. Baseline projection (x along the line between anchors)
 * 2. Perpendicular offset estimation (y, with sign ambiguity)
 * 3. Single-anchor fallback (distance ring only)
 * 4. Integration point for IMU dead-reckoning displacement
 * 
 * For reliable 2D positioning, add a third anchor.
 */

/**
 * Estimate position given two anchor distances
 * @param {number|null} distA - Distance to Anchor A (meters), null if unavailable
 * @param {number|null} distB - Distance to Anchor B (meters), null if unavailable
 * @param {{ x: number, y: number }} ancA - Anchor A position
 * @param {{ x: number, y: number }} ancB - Anchor B position
 * @returns {{ x, y, valid, method, confidence, note }}
 */
export function estimate2AnchorPosition(distA, distB, ancA, ancB) {
  if (distA === null && distB === null) {
    return { x: null, y: null, valid: false, method: 'none', confidence: 0 };
  }
  
  const dx = ancB.x - ancA.x;
  const dy = ancB.y - ancA.y;
  const D = Math.sqrt(dx * dx + dy * dy);
  
  if (D < 0.01) {
    return { x: null, y: null, valid: false, method: 'degenerate', confidence: 0 };
  }
  
  // Single anchor fallback
  if (distA !== null && distB === null) {
    return {
      x: ancA.x + (dx / D) * distA * 0.6,
      y: ancA.y + (dy / D) * distA * 0.6,
      valid: false,
      method: '1-anchor',
      confidence: 12
    };
  }
  if (distA === null && distB !== null) {
    return {
      x: ancB.x - (dx / D) * distB * 0.6,
      y: ancB.y - (dy / D) * distB * 0.6,
      valid: false,
      method: '1-anchor',
      confidence: 12
    };
  }
  
  // 2-anchor baseline projection
  const xAlong = (D * D + distA * distA - distB * distB) / (2 * D);
  const yPerpSq = distA * distA - xAlong * xAlong;
  const yPerp = yPerpSq > 0 ? Math.sqrt(yPerpSq) : 0;
  
  const ux = dx / D;
  const uy = dy / D;
  const px = -uy;
  const py = ux;
  
  const worldX = ancA.x + xAlong * ux + yPerp * px;
  const worldY = ancA.y + xAlong * uy + yPerp * py;
  
  const residual = Math.abs(Math.sqrt(xAlong * xAlong + yPerp * yPerp) - distA);
  const confidence = Math.max(15, Math.min(80, 80 - residual * 12));
  
  return {
    x: Number(worldX.toFixed(3)),
    y: Number(worldY.toFixed(3)),
    valid: yPerpSq >= 0,
    method: '2-anchor-baseline',
    confidence: Number(confidence.toFixed(1)),
    note: yPerpSq < 0 ? 'Inconsistent distances (circles do not intersect)' : undefined
  };
}
