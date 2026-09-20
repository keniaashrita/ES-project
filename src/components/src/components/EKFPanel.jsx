import React from 'react';
import { Cpu, ArrowDown, ArrowRight, ShieldCheck, Activity } from 'lucide-react';

export default function EKFPanel({
  fusedPosition,
  imuPosition,
  loraPosition,
  ekfState,
  pleData
}) {
  const [px, py, vx, vy] = [
    fusedPosition.x,
    fusedPosition.y,
    ekfState.state ? ekfState.state.vx : 0,
    ekfState.state ? ekfState.state.vy : 0
  ];

  return (
    <div className="space-y-6">
      {/* Visual Filter Architecture Flow */}
      <div className="tech-panel p-6 rounded-xl">
        <h3 className="font-semibold text-white tracking-wide text-base mb-2 flex items-center space-x-2">
          <Cpu className="w-5 h-5 text-lavender-400" />
          <span>Adaptive Extended Kalman Filter Architecture Pipeline</span>
        </h3>
        <p className="text-xs text-slate-400 mb-6">
          High-frequency IMU state propagation integrated with noise-adaptive LoRa measurement updates.
        </p>

        {/* Animated Flowchart Layout */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center text-center font-mono text-xs">
          {/* Box 1: IMU Stream */}
          <div className="bg-charcoal-900 p-4 rounded-xl border border-charcoal-700 space-y-1">
            <div className="text-[10px] text-cyber-rose font-bold">HIGH-FREQ (10Hz)</div>
            <div className="font-bold text-white text-sm">IMU Sensor</div>
            <div className="text-slate-400 text-[11px]">Acc (ax, ay) + Gyro</div>
            <div className="text-cyber-rose text-[10px]">Short-Term Accuracy</div>
          </div>

          <div className="hidden md:flex justify-center text-lavender-400">
            <ArrowRight className="w-5 h-5 animate-pulse" />
          </div>

          {/* Box 2: Prediction Step */}
          <div className="bg-charcoal-900 p-4 rounded-xl border border-lavender-500/40 space-y-1">
            <div className="text-[10px] text-lavender-400 font-bold">PREDICTION STEP</div>
            <div className="font-bold text-white text-sm">x̂_k|k-1 = F·x + B·u</div>
            <div className="text-slate-400 text-[11px]">P_k|k-1 = F·P·F^T + Q</div>
            <div className="text-lavender-300 text-[10px]">IMU Dead Reckoning</div>
          </div>

          <div className="hidden md:flex justify-center text-lavender-400">
            <ArrowRight className="w-5 h-5 animate-pulse" />
          </div>

          {/* Box 3: Fused Output */}
          <div className="bg-charcoal-900 p-4 rounded-xl border border-cyber-green/40 space-y-1">
            <div className="text-[10px] text-cyber-green font-bold">STATE ESTIMATE</div>
            <div className="font-bold text-cyber-green text-sm">Fused [x, y, vx, vy]</div>
            <div className="text-slate-300 text-[11px]">X: {px}m | Y: {py}m</div>
            <div className="text-cyber-green text-[10px]">Bounded Uncertainty</div>
          </div>
        </div>

        {/* Lower Branch: LoRa Measurement & Adaptive R */}
        <div className="mt-6 pt-6 border-t border-charcoal-800 grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs text-center">
          <div className="bg-charcoal-900 p-3 rounded-lg border border-cyber-cyan/30">
            <div className="text-[10px] text-cyber-cyan font-bold">LOW-FREQ (1Hz)</div>
            <div className="font-bold text-white">LoRa Multilateration</div>
            <div className="text-slate-400 text-[11px]">
              Pos: ({loraPosition ? loraPosition.x : '--'}m, {loraPosition ? loraPosition.y : '--'}m)
            </div>
          </div>

          <div className="bg-charcoal-900 p-3 rounded-lg border border-cyber-amber/30">
            <div className="text-[10px] text-cyber-amber font-bold">INNOVATION & GAIN</div>
            <div className="text-slate-300">
              y = z - H·x̂ = ({ekfState.innovation[0]}, {ekfState.innovation[1]})
            </div>
            <div className="text-cyber-amber font-bold mt-0.5">
              K = ({ekfState.kalmanGain[0]}, {ekfState.kalmanGain[1]})
            </div>
          </div>

          <div className="bg-charcoal-900 p-3 rounded-lg border border-lavender-500/30">
            <div className="text-[10px] text-lavender-400 font-bold">DYNAMIC R COVARIANCE</div>
            <div className="text-white font-bold">R_k = {ekfState.rValue}</div>
            <div className="text-slate-400 text-[11px]">
              Var(RSSI): {pleData.variance} | n: {pleData.currentPLE}
            </div>
          </div>
        </div>
      </div>

      {/* Numerical Matrix Values Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="tech-panel p-5 rounded-xl space-y-4">
          <h4 className="font-mono text-sm font-bold text-white border-b border-charcoal-700 pb-2">
            Current Filter State Vector & Covariance
          </h4>
          <div className="space-y-2 font-mono text-xs">
            <div className="p-2.5 bg-charcoal-900 rounded border border-charcoal-800 flex justify-between">
              <span className="text-slate-400">State x̂ = [px, py, vx, vy]^T:</span>
              <span className="text-lavender-400 font-bold">
                [{px}, {py}, {vx}, {vy}]
              </span>
            </div>
            <div className="p-2.5 bg-charcoal-900 rounded border border-charcoal-800 flex justify-between">
              <span className="text-slate-400">Position Covariance Var(X), Var(Y):</span>
              <span className="text-white font-bold">
                0.28 m², 0.31 m²
              </span>
            </div>
            <div className="p-2.5 bg-charcoal-900 rounded border border-charcoal-800 flex justify-between">
              <span className="text-slate-400">Process Noise (Q_accel):</span>
              <span className="text-white font-bold">0.25 (m/s²)²</span>
            </div>
            <div className="p-2.5 bg-charcoal-900 rounded border border-charcoal-800 flex justify-between">
              <span className="text-slate-400">Confidence Metric:</span>
              <span className="text-cyber-green font-bold">{ekfState.confidence}%</span>
            </div>
          </div>
        </div>

        <div className="tech-panel p-5 rounded-xl space-y-4">
          <h4 className="font-mono text-sm font-bold text-white border-b border-charcoal-700 pb-2">
            Adaptive Measurement Covariance (R) Logic
          </h4>
          <div className="text-xs text-slate-300 space-y-3 font-sans">
            <p>
              In conventional Kalman filtering, the measurement covariance matrix <strong className="text-white">R</strong> is fixed.
              Under RF multipath or shadow fading, a fixed <strong className="text-white">R</strong> causes the filter to follow spurious RSSI jumps.
            </p>
            <div className="p-3 bg-charcoal-900 rounded border border-charcoal-800 font-mono text-xs text-cyber-cyan space-y-1">
              <div>R_k = R_base · [1 + β · Var(RSSI)] · GDOP</div>
              <div className="text-[10px] text-slate-400">β = 1.8 scaling factor | GDOP = Geometric Dilution</div>
            </div>
            <ul className="list-disc list-inside text-xs space-y-1 text-slate-400">
              <li><strong className="text-cyber-green">Low RSSI Variance:</strong> R shrinks → High Kalman gain → Fast convergence to LoRa.</li>
              <li><strong className="text-cyber-rose">High RSSI Variance:</strong> R surges → Low Kalman gain → Filter ignores noisy LoRa, relying smoothly on IMU.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}