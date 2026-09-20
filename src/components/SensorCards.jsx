import React from 'react';
import { Radio, Compass, Activity, ShieldCheck } from 'lucide-react';

export default function SensorCards({
  anchorTableData,
  imuData,
  pleData,
  ekfState,
  motionState
}) {
  return (
    <div className="tech-panel p-5 rounded-xl space-y-4">
      <div className="flex items-center justify-between border-b border-charcoal-700 pb-3">
        <h3 className="font-semibold text-white tracking-wide text-sm flex items-center space-x-2">
          <Activity className="w-4 h-4 text-cyber-cyan" />
          <span>Real-Time Sensor Telemetry</span>
        </h3>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/30">
          ONLINE
        </span>
      </div>

      {/* LoRa RSSI Summary */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span className="flex items-center space-x-1">
            <Radio className="w-3 h-3 text-cyber-cyan" />
            <span>LoRa RSSI Inbound</span>
          </span>
          <span>Avg: {pleData.variance < 4 ? 'Optimal' : 'Noisy'}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          {anchorTableData.slice(0, 4).map(a => (
            <div key={a.id} className="bg-charcoal-900 p-2 rounded border border-charcoal-800 flex justify-between items-center">
              <span className="text-slate-400">{a.name || a.id}:</span>
              <span className="font-bold text-cyber-cyan">{a.rssi} dBm</span>
            </div>
          ))}
        </div>
      </div>

      {/* 6-DoF IMU Readings */}
      <div className="space-y-1.5 border-t border-charcoal-800 pt-3">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400">
          <span className="flex items-center space-x-1">
            <Compass className="w-3 h-3 text-lavender-400" />
            <span>IMU Odometry (10 Hz)</span>
          </span>
          <span className="text-lavender-300">{motionState.state}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs font-mono text-center">
          <div className="bg-charcoal-900 p-2 rounded border border-charcoal-800">
            <div className="text-[10px] text-slate-500">ACCELERATION</div>
            <div className="font-bold text-white mt-0.5">{motionState.accelMagnitude} m/s²</div>
          </div>
          <div className="bg-charcoal-900 p-2 rounded border border-charcoal-800">
            <div className="text-[10px] text-slate-500">GYROSCOPE</div>
            <div className="font-bold text-white mt-0.5">{motionState.gyroMagnitude} rad/s</div>
          </div>
          <div className="bg-charcoal-900 p-2 rounded border border-charcoal-800">
            <div className="text-[10px] text-slate-500">HEADING</div>
            <div className="font-bold text-cyber-amber mt-0.5">{imuData.heading ?? 0}°</div>
          </div>
        </div>
      </div>

      {/* Adaptive PLE and Filter Diagnostics */}
      <div className="space-y-2 border-t border-charcoal-800 pt-3">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">Adaptive PLE (n):</span>
          <span className="font-bold text-cyber-green">{pleData.currentPLE}</span>
        </div>
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">PLE Status:</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
            pleData.status === 'STABLE' ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/30' :
            pleData.status === 'HIGH INTERFERENCE' ? 'bg-cyber-rose/10 text-cyber-rose border border-cyber-rose/30' :
            'bg-cyber-amber/10 text-cyber-amber border border-cyber-amber/30'
          }`}>
            {pleData.status}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-slate-400">EKF Confidence:</span>
          <div className="flex items-center space-x-2">
            <div className="w-16 h-1.5 bg-charcoal-800 rounded-full overflow-hidden">
              <div className="h-full bg-lavender-500" style={{ width: `${ekfState.confidence}%` }} />
            </div>
            <span className="font-bold text-lavender-400">{ekfState.confidence}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}