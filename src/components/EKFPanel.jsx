import React from 'react';
import { Cpu, ArrowRight } from 'lucide-react';

export default function EKFPanel({ fusedPosition, loraPosition, ekfState, pleData }) {
  return (
    <div className="space-y-6">
      <div className="tech-panel p-6 rounded-xl">
        <h3 className="font-semibold text-white tracking-wide text-base mb-2 flex items-center space-x-2">
          <Cpu className="w-5 h-5 text-lavender-400" />
          <span>Adaptive Extended Kalman Filter Architecture</span>
        </h3>
        <p className="text-xs text-slate-400 mb-6">IMU dead reckoning propagation (10Hz) corrected by LoRa trilateration (1Hz).</p>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center text-center font-mono text-xs">
          <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-700">
            <div className="text-[10px] text-cyber-rose font-bold">10 Hz IMU</div>
            <div className="font-bold text-white">Acceleration</div>
          </div>
          <div className="hidden md:flex justify-center text-lavender-400"><ArrowRight className="w-5 h-5" /></div>
          <div className="bg-charcoal-900 p-4 rounded-xl border border-lavender-500/40">
            <div className="text-[10px] text-lavender-400 font-bold">PREDICTION</div>
            <div className="font-bold text-white">x̂_k|k-1 = F·x + B·u</div>
          </div>
          <div className="hidden md:flex justify-center text-lavender-400"><ArrowRight className="w-5 h-5" /></div>
          <div className="bg-charcoal-900 p-4 rounded-xl border border-cyber-green/40">
            <div className="text-[10px] text-cyber-green font-bold">FUSED STATE</div>
            <div className="font-bold text-cyber-green">({fusedPosition.x}m, {fusedPosition.y}m)</div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-charcoal-800 grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs text-center">
          <div className="bg-charcoal-900 p-3 rounded-lg border border-cyber-cyan/30">
            <div className="text-slate-400">LoRa Measurement</div>
            <div className="text-white font-bold">({loraPosition ? loraPosition.x : '--'}m, {loraPosition ? loraPosition.y : '--'}m)</div>
          </div>
          <div className="bg-charcoal-900 p-3 rounded-lg border border-cyber-amber/30">
            <div className="text-slate-400">Kalman Gain K</div>
            <div className="text-cyber-amber font-bold">({ekfState.kalmanGain[0]}, {ekfState.kalmanGain[1]})</div>
          </div>
          <div className="bg-charcoal-900 p-3 rounded-lg border border-lavender-500/30">
            <div className="text-slate-400">Adaptive R Covariance</div>
            <div className="text-white font-bold">{ekfState.rValue}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
