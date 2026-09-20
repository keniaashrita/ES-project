# Adaptive LoRa–IMU Sensor Fusion for GPS-Free Real-Time Positioning

An embedded-systems capstone research prototype demonstrating continuous, GPS-denied 2D indoor/campus localization through multi-sensor fusion.

---

## 1. Problem Statement
Autonomous mobile robots, search-and-rescue teams, and asset tracking nodes frequently operate in **GPS-denied environments** (dense urban canyons, multistory warehouses, tunnels, and disaster rubble). 
- **Pure Inertial Dead Reckoning (IMU)** suffers from cumulative quadratic drift due to accelerometer integration bias and gyro noise:
  $$\Delta p(t) \approx \frac{1}{2} b_a t^2$$
- **Pure LoRa RSSI Multilateration** provides absolute spatial reference but experiences high multipath reflections, non-line-of-sight (NLOS) shadow fading, and low packet update rates (0.1–1 Hz).

## 2. Proposed Architecture & Solution
This project establishes a **Dual-Rate Adaptive Extended Kalman Filter (EKF)**:
1. **High-Frequency IMU Prediction (10 Hz, dt = 0.1s)** propagates state coordinates rapidly during dynamic maneuvers.
2. **Low-Frequency LoRa Measurement Updates (1 Hz)** bound long-term cumulative drift.
3. **Adaptive Path-Loss Exponent (PLE)** dynamically updates $n$ online to adapt to environmental obstacles without hardcoding.
4. **Adaptive Measurement Noise Covariance ($R$)** scales $R$ upward during RSSI volatility, causing the EKF to rely on smooth IMU dead reckoning and discard multipath spikes.

---

## 3. Mathematical Formulations

### Log-Distance Path Loss Model
$$RSSI(d) = RSSI_0 - 10 \cdot n \cdot \log_{10}\left(\frac{d}{d_0}\right) + X_\sigma + X_{mp}$$
Distance inversion:
$$\hat{d} = d_0 \cdot 10^{\frac{RSSI_0 - RSSI}{10 \cdot n}}$$

### Adaptive Path Loss Exponent Smoothing
$$n_k = (1 - \alpha) n_{k-1} + \alpha \cdot \hat{n}_{instant}$$

### Linearized Multilateration (Trilateration)
Subtracting reference anchor $k$ from $M \ge 3$ circle equations:
$$2(x_i - x_k)x + 2(y_i - y_k)y = (x_i^2 - x_k^2) + (y_i^2 - y_k^2) + (\hat{d}_k^2 - \hat{d}_i^2)$$
$$A \hat{p} = B \implies \hat{p} = (A^T A)^{-1} A^T B$$

### Adaptive Extended Kalman Filter (EKF)
State Vector:
$$x = \begin{bmatrix} p_x & p_y & v_x & v_y \end{bmatrix}^T$$
Prediction ($10\text{ Hz}$):
$$x_{k|k-1} = F x_{k-1|k-1} + B a_{imu}, \quad P_{k|k-1} = F P F^T + Q$$
Adaptive Covariance Scaling:
$$R_k = R_{base} \cdot \left(1 + \beta \cdot \sigma^2_{RSSI}\right) \cdot \text{GDOP}$$
Update ($1\text{ Hz}$):
$$y = z - H x_{pred}, \quad K = P_{pred} H^T (H P_{pred} H^T + R_k)^{-1}$$
$$x = x_{pred} + K y, \quad P = (I - K H) P_{pred}$$

---

## 4. How to Run Locally

### Prerequisites
- Node.js (v18 or v20+)
- npm

### Installation & Execution
```bash
# 1. Clone repository or create project folder
cd adaptive-lora-imu-fusion

# 2. Install dependencies
npm install

# 3. Launch Vite development server
npm run dev