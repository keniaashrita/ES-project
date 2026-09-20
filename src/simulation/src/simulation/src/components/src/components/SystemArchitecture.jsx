import React from 'react';
import { Cpu, Radio, GitFork, ShieldCheck, Terminal, Layers } from 'lucide-react';

export default function SystemArchitecture() {
  return (
    <div className="space-y-8 font-sans">
      {/* Visual Block Diagram */}
      <div className="tech-panel p-6 rounded-xl">
        <h3 className="font-semibold text-white tracking-wide text-base mb-2 flex items-center space-x-2">
          <Layers className="w-5 h-5 text-lavender-400" />
          <span>System Dataflow & Processing Architecture</span>
        </h3>
        <p className="text-xs text-slate-400 mb-6">
          High-level schematic showing sensor abstraction, parameter adaptation, and recursive EKF fusion.
        </p>

        <div className="p-6 bg-charcoal-900 rounded-xl border border-charcoal-700 font-mono text-xs overflow-x-auto">
          <pre className="text-slate-300 leading-relaxed select-all">
{`
                  ┌───────────────────────────────┐
                  │      Fixed LoRa Anchors       │
                  │   A1(5,5), A2(45,5), A3(25,45)│
                  └───────────────┬───────────────┘
                                  │ 868 MHz RF Packets (1 Hz)
                                  ▼
┌──────────────────┐     ┌────────────────────────────────┐
│  6-DoF IMU Node  │     │     RSSI Distance Estimation   │
│ Accel (ax,ay,az) │     │ d = d0 · 10^((RSSI0-RSSI)/10n) │
│ Gyro  (gx,gy,gz) │     └───────────────┬────────────────┘
└────────┬─────────┘                     │
         │ 10 Hz                         ▼
         ▼                       ┌────────────────────────────────┐
┌──────────────────┐             │    Non-Linear Trilateration    │
│  IMU Dead        │             │  (Linearized Multilateration)  │
│  Reckoning       │             └───────────────┬────────────────┘
│  + ZUPT Engine   │                             │ z = [x_l, y_l]^T
└────────┬─────────┘                             ▼
         │ a_k                   ┌────────────────────────────────┐
         │ (Control Input)       │   Adaptive R Covariance Engine │
         │                       │ R_k = R_base·(1+β·Var(RSSI))   │
         │                       └───────────────┬────────────────┘
         ▼                                       │ R_k
┌────────────────────────────────────────────────┴────────────────┐
│                Adaptive Extended Kalman Filter                  │
│                                                                 │
│ Predict:   x_pred = F · x + B · a_k                             │
│            P_pred = F · P · F^T + Q                             │
│ Update:    y = z - H · x_pred                                   │
│            K = P_pred · H^T · (H · P_pred · H^T + R_k)^-1       │
│            x = x_pred + K · y,   P = (I - K · H) · P_pred       │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
                 ┌───────────────────────────────┐
                 │ Fused State: (x, y, vx, vy)   │
                 │ 2D Radar Display & Telemetry  │
                 └───────────────────────────────┘
`}
          </pre>
        </div>
      </div>

      {/* Hardware Migration Guide */}
      <div className="tech-panel p-6 rounded-xl space-y-4">
        <h3 className="font-semibold text-white tracking-wide text-base flex items-center space-x-2">
          <Terminal className="w-5 h-5 text-cyber-cyan" />
          <span>Physical Hardware Migration Guide (Drop-In Integration)</span>
        </h3>
        <p className="text-xs text-slate-300">
          The code is engineered around the <code className="text-lavender-300 font-mono">SensorProvider</code> abstract interface.
          To connect real hardware (e.g. an ESP32 or Raspberry Pi with an SX1262 LoRa module and an MPU6050 IMU), replace the provider instance in <code className="text-lavender-300 font-mono">App.jsx</code>:
        </p>

        <div className="bg-charcoal-900 p-4 rounded-lg border border-charcoal-800 font-mono text-xs text-cyber-green">
          <pre>
{`// 1. In App.jsx, switch to the WebSerial hardware provider:
import { WebSerialSensorProvider } from './simulation/SensorProvider';

const hardwareProvider = new WebSerialSensorProvider(115200);
await hardwareProvider.connect();

// 2. Transmit JSON lines from your ESP32 over USB Serial:
// {"type":"IMU","data":{"ax":0.12,"ay":-0.04,"az":9.81,"gx":0.01,"gy":-0.02,"gz":0.0}}
// {"type":"LORA","data":[{"anchorId":"A1","rssi":-58},{"anchorId":"A2","rssi":-64}]}`}
          </pre>
        </div>
      </div>
    </div>
  );
}