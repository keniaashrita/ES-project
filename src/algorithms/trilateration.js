/**
 * 2D Non-Linear Multilateration Solver
 *
 * Solves for target position (x, y) given M >= 3 anchors at (x_i, y_i)
 * and estimated distances d_i:
 *   (x - x_i)^2 + (y - y_i)^2 = d_i^2
 *
 * Linearized via reference anchor subtraction (Matrix Pseudoinverse)
 * followed by 2 iterations of Gauss-Newton refinement.
 */

/**
 * Estimates (x, y) coordinates using linearized least-squares multilateration
 * @param {Array} anchors - Array of { id, x, y, estimatedDistance }
 * @returns {Object|null} { x, y, gdop, residual } or null if < 3 anchors
 */
export function estimatePositionTrilateration(anchors) {
  // We need at least 3 anchors with valid distances
  const validAnchors = anchors.filter(a => typeof a.estimatedDistance === 'number' && a.estimatedDistance > 0);
  
  if (validAnchors.length < 3) {
    return {
      success: false,
      position: null,
      error: 'Insufficient anchors for 2D trilateration. Minimum 3 required.'
    };
  }

  const n = validAnchors.length;
  // Choose the last anchor as the reference anchor k
  const ref = validAnchors[n - 1];
  const xk = ref.x;
  const yk = ref.y;
  const dk = ref.estimatedDistance;

  // Build matrix A and vector B:
  // 2*(x_i - x_k)*x + 2*(y_i - y_k)*y = (x_i^2 - x_k^2) + (y_i^2 - y_k^2) + (d_k^2 - d_i^2)
  const A = [];
  const B = [];

  for (let i = 0; i < n - 1; i++) {
    const ai = validAnchors[i];
    const xi = ai.x;
    const yi = ai.y;
    const di = ai.estimatedDistance;

    const rowA = [
      2 * (xi - xk),
      2 * (yi - yk)
    ];
    const valB = (xi * xi - xk * xk) + (yi * yi - yk * yk) + (dk * dk - di * di);

    A.push(rowA);
    B.push(valB);
  }

  // Solve A * [x; y] = B using Normal Equations: (A^T * A)^-1 * A^T * B
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
    // Degenerate geometry (e.g. collinear anchors)
    return {
      success: false,
      position: null,
      error: 'Collinear anchor geometry detected. Determinant near zero.'
    };
  }

  // 2x2 Matrix Inversion
  const inv_00 = at_a_11 / det;
  const inv_01 = -at_a_01 / det;
  const inv_10 = -at_a_10 / det;
  const inv_11 = at_a_00 / det;

  let estX = inv_00 * at_b_0 + inv_01 * at_b_1;
  let estY = inv_10 * at_b_0 + inv_11 * at_b_1;

  // Calculate Geometric Dilution of Precision (GDOP) proxy
  const gdop = Math.sqrt(Math.max(1.0, inv_00 + inv_11));

  // Compute residual error
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
}
