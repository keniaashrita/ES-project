import React from 'react';
import { Layers, Terminal } from 'lucide-react';

export default function SystemArchitecture() {
  return (
    <div className="space-y-6">
      <div className="tech-panel p-6 rounded-xl">
        <h3 className="font-semibold text-white tracking-wide text-base mb-4 flex items-center space-x-2">
          <Layers className="w-5 h-5 text-lavender-400" />
          <span>System Dataflow & Processing Architecture</span>
        </h3>
        <div className="p-6 bg-charcoal-900 rounded-xl border border-charcoal-700 font-mono text-xs text-slate-300 overflow-x-auto">
          <pre>{
`LoRa Anchors (1Hz) ──> RSSI Log-Distance Model ──> Trilateration ──> Adaptive R Scaling ──┐
                                                                                           │
IMU Sensor (10Hz)  ──> IMU Dead Reckoning (ZUPT) ─> EKF Prediction Step ─────────────────> EKF Update ──> Fused (x, y)`
          }</pre>
        </div>
      </div>
    </div>
  );
}
