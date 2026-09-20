import React from 'react';
import { calculateRMSE, calculateMean, calculateMax } from '../utils/calculations';

export default function PerformancePanel({ history }) {
  if (!history || history.length < 5) {
    return <div className="tech-panel p-10 text-center font-mono text-slate-400">Run simulation for at least 5s to calculate benchmark.</div>;
  }

  const fusedErrors = history.map(d => d.position_error);
  const imuErrors = history.map(d => d.imu_drift_error || 0);
  const loraErrors = history.map(d => d.lora_error).filter(v => v !== null && !isNaN(v));

  const fusedRMSE = calculateRMSE(fusedErrors);
  const imuRMSE = calculateRMSE(imuErrors);
  const loraRMSE = calculateRMSE(loraErrors);

  return (
    <div className="space-y-6">
      <div className="tech-panel p-6 rounded-xl border-l-4 border-l-lavender-500 flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-white">Target: Sub-3.0m Accuracy</h3>
          <p className="text-xs text-slate-400 mt-1">Calculated in real-time from active simulation coordinates.</p>
        </div>
        <div className="text-right font-mono">
          <div className="text-xs text-slate-400">SIMULATED RMSE</div>
          <div className={`text-2xl font-bold ${fusedRMSE < 3.0 ? 'text-cyber-green' : 'text-cyber-amber'}`}>
            {fusedRMSE.toFixed(2)} m
          </div>
        </div>
      </div>

      <div className="tech-panel p-5 rounded-xl">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-charcoal-850 text-slate-400 border-b border-charcoal-700">
            <tr>
              <th className="p-3">Mode</th><th className="p-3">RMSE</th><th className="p-3">Mean Error</th><th className="p-3">Max Drift</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-800">
            <tr>
              <td className="p-3 text-cyber-rose font-bold">IMU Dead Reckoning</td>
              <td className="p-3 text-slate-200">{imuRMSE.toFixed(2)} m</td>
              <td className="p-3 text-slate-200">{calculateMean(imuErrors).toFixed(2)} m</td>
              <td className="p-3 text-cyber-rose">{calculateMax(imuErrors).toFixed(2)} m</td>
            </tr>
            <tr>
              <td className="p-3 text-cyber-amber font-bold">LoRa RSSI Trilateration</td>
              <td className="p-3 text-slate-200">{loraRMSE.toFixed(2)} m</td>
              <td className="p-3 text-slate-200">{calculateMean(loraErrors).toFixed(2)} m</td>
              <td className="p-3 text-cyber-amber">{calculateMax(loraErrors).toFixed(2)} m</td>
            </tr>
            <tr className="bg-lavender-600/10 font-bold">
              <td className="p-3 text-lavender-400">Adaptive LoRa–IMU Fusion</td>
              <td className="p-3 text-cyber-green">{fusedRMSE.toFixed(2)} m</td>
              <td className="p-3 text-white">{calculateMean(fusedErrors).toFixed(2)} m</td>
              <td className="p-3 text-white">{calculateMax(fusedErrors).toFixed(2)} m</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
