import React from 'react';
import { 
  Activity, 
  Radio, 
  Navigation, 
  Cpu, 
  ShieldCheck, 
  AlertTriangle,
  Zap,
  Target
} from 'lucide-react';
import SensorCards from './SensorCards';

export default function Dashboard({
  simulationStatus,
  dataSource,
  hwStatus,
  groundTruth,
  fusedPosition,
  imuPosition,
  loraPosition,
  positionError,
  imuError,
  loraError,
  anchorTableData,
  imuData,
  pleData,
  ekfState,
  motionState,
  packetStats
}) {
  return (
    <div className="space-y-6">
      {/* System Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="tech-panel p-3 rounded-lg border-l-4 border-l-cyber-green">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>SYSTEM STATUS</span>
            <Activity className="w-3.5 h-3.5 text-cyber-green" />
          </div>
          <div className="text-lg font-mono font-bold text-white tracking-wider">
            {simulationStatus}
          </div>
          <div className="text-[10px] text-cyber-green mt-0.5">Rate: 10 Hz (dt=0.1s)</div>
        </div>

        <div className="tech-panel p-3 rounded-lg border-l-4 border-l-cyber-rose">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>GPS MODULE</span>
            <Navigation className="w-3.5 h-3.5 text-cyber-rose" />
          </div>
          <div className="text-lg font-mono font-bold text-cyber-rose tracking-wider">
            DISABLED
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">GPS-Denied Operation</div>
        </div>

        <div className="tech-panel p-3 rounded-lg border-l-4 border-l-cyber-cyan">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>LoRa 868MHz</span>
            <Radio className="w-3.5 h-3.5 text-cyber-cyan" />
          </div>
          <div className="text-lg font-mono font-bold text-cyber-cyan tracking-wider">
            {packetStats.lastUpdateSec < 2.0 ? 'CONNECTED' : 'STANDBY'}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Loss: {packetStats.lossRate}% | 1 Hz Rx
          </div>
        </div>

        <div className="tech-panel p-3 rounded-lg border-l-4 border-l-lavender-500">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>6-DoF IMU</span>
            <Cpu className="w-3.5 h-3.5 text-lavender-400" />
          </div>
          <div className="text-lg font-mono font-bold text-lavender-400 tracking-wider">
            ACTIVE
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">ZUPT: {motionState.state}</div>
        </div>

        <div className="tech-panel p-3 rounded-lg border-l-4 border-l-cyber-amber">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>ADAPTIVE EKF</span>
            <ShieldCheck className="w-3.5 h-3.5 text-cyber-amber" />
          </div>
          <div className="text-lg font-mono font-bold text-cyber-amber tracking-wider">
            {ekfState.confidence}% CONF
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">R_adapt = {ekfState.rValue}</div>
        </div>
      </div>

      {/* Hardware Status Panel — only visible in hardware mode */}
      {dataSource === 'hardware' && (
        <div className="tech-panel p-4 rounded-xl border border-cyber-cyan/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white tracking-wide text-sm flex items-center space-x-2">
              <Radio className="w-4 h-4 text-cyber-cyan" />
              <span>ESP32 Hardware Status</span>
            </h3>
            <span className={`text-xs font-mono px-2 py-0.5 rounded ${
              hwStatus?.deviceConnected
                ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/30'
                : 'bg-cyber-rose/10 text-cyber-rose border border-cyber-rose/30'
            }`}>
              {hwStatus?.deviceConnected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            <div className="bg-charcoal-900 p-2.5 rounded border border-charcoal-800">
              <div className="text-slate-500 text-[10px]">GATEWAY</div>
              <div className={`font-bold ${hwStatus?.gatewayConnected ? 'text-cyber-green' : 'text-cyber-rose'}`}>
                {hwStatus?.gatewayConnected ? 'ONLINE' : 'OFFLINE'}
              </div>
            </div>

            <div className="bg-charcoal-900 p-2.5 rounded border border-charcoal-800">
              <div className="text-slate-500 text-[10px]">MESSAGES</div>
              <div className="font-bold text-white">{hwStatus?.messageCount || 0}</div>
            </div>

            <div className="bg-charcoal-900 p-2.5 rounded border border-charcoal-800">
              <div className="text-slate-500 text-[10px]">POSITION</div>
              <div className={`font-bold ${hwStatus?.lastPosition?.valid ? 'text-cyber-green' : 'text-cyber-amber'}`}>
                {hwStatus?.lastPosition?.valid ? 'VALID' : 'ESTIMATING'}
              </div>
            </div>

            <div className="bg-charcoal-900 p-2.5 rounded border border-charcoal-800">
              <div className="text-slate-500 text-[10px]">METHOD</div>
              <div className="font-bold text-cyber-cyan">{hwStatus?.lastPosition?.method || 'N/A'}</div>
            </div>
          </div>

          {hwStatus?.lastPosition?.note && (
            <div className="mt-2 text-[10px] text-cyber-amber font-mono flex items-center space-x-1">
              <AlertTriangle className="w-3 h-3" />
              <span>{hwStatus.lastPosition.note}</span>
            </div>
          )}
        </div>
      )}

      {/* Primary Position Card & Comparative Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="tech-panel p-5 rounded-xl lg:col-span-2">
          <div className="flex items-center justify-between border-b border-charcoal-700 pb-3 mb-4">
            <div className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-lavender-400" />
              <h3 className="font-semibold text-white tracking-wide">Real-Time Coordinate Telemetry</h3>
            </div>
            <div className="text-xs font-mono px-2.5 py-1 rounded bg-charcoal-800 border border-charcoal-700 text-slate-300">
              Grid: 50m × 50m
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="bg-charcoal-900/80 p-3 rounded-lg border border-charcoal-700">
              <div className="text-[11px] font-mono text-slate-400 mb-1">GROUND TRUTH</div>
              <div className="text-sm font-mono text-slate-200">
                X: <span className="font-bold text-white">{groundTruth.x.toFixed(2)}</span> m
              </div>
              <div className="text-sm font-mono text-slate-200">
                Y: <span className="font-bold text-white">{groundTruth.y.toFixed(2)}</span> m
              </div>
              <div className="text-[10px] text-cyber-green mt-1">Reference Trajectory</div>
            </div>

            <div className="bg-charcoal-900/80 p-3 rounded-lg border border-lavender-500/40 shadow-sm shadow-lavender-500/10">
              <div className="text-[11px] font-mono text-lavender-400 mb-1">FUSED ESTIMATE (EKF)</div>
              <div className="text-sm font-mono text-slate-200">
                X: <span className="font-bold text-lavender-300">{fusedPosition.x.toFixed(2)}</span> m
              </div>
              <div className="text-sm font-mono text-slate-200">
                Y: <span className="font-bold text-lavender-300">{fusedPosition.y.toFixed(2)}</span> m
              </div>
              <div className="text-[10px] text-cyber-cyan mt-1">
                Error: <span className="font-bold">{positionError.toFixed(2)} m</span>
              </div>
            </div>

            <div className="bg-charcoal-900/80 p-3 rounded-lg border border-charcoal-700">
              <div className="text-[11px] font-mono text-cyber-rose mb-1">IMU DEAD RECKONING</div>
              <div className="text-sm font-mono text-slate-200">
                X: <span className="font-bold text-slate-300">{imuPosition.x.toFixed(2)}</span> m
              </div>
              <div className="text-sm font-mono text-slate-200">
                Y: <span className="font-bold text-slate-300">{imuPosition.y.toFixed(2)}</span> m
              </div>
              <div className="text-[10px] text-cyber-rose mt-1">
                Drift: <span className="font-bold">{imuError.toFixed(2)} m</span>
              </div>
            </div>

            <div className="bg-charcoal-900/80 p-3 rounded-lg border border-charcoal-700">
              <div className="text-[11px] font-mono text-cyber-amber mb-1">LoRa TRILATERATION</div>
              <div className="text-sm font-mono text-slate-200">
                X: <span className="font-bold text-slate-300">{loraPosition ? loraPosition.x.toFixed(2) : '--'}</span> m
              </div>
              <div className="text-sm font-mono text-slate-200">
                Y: <span className="font-bold text-slate-300">{loraPosition ? loraPosition.y.toFixed(2) : '--'}</span> m
              </div>
              <div className="text-[10px] text-cyber-amber mt-1">
                Scatter Err: <span className="font-bold">{loraError ? loraError.toFixed(2) : '--'} m</span>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-charcoal-850 rounded-lg border border-charcoal-700 flex flex-wrap items-center justify-between text-xs font-mono">
            <div className="flex items-center space-x-2 text-slate-300">
              <Zap className="w-4 h-4 text-cyber-cyan" />
              <span>Target Accuracy: <strong className="text-white">Sub-3.0 m</strong></span>
            </div>
            <div className="text-slate-400">
              Simulated Fused Error: <strong className={`font-mono ${positionError < 3.0 ? 'text-cyber-green' : 'text-cyber-amber'}`}>
                {positionError.toFixed(2)} meters
              </strong>
            </div>
            <div className="text-slate-400">
              Correction Factor: <strong className="text-lavender-400">{((1 - (positionError / Math.max(0.1, imuError))) * 100).toFixed(0)}% drift bound</strong>
            </div>
          </div>
        </div>

        {/* Dense Sensor Telemetry Component */}
        <SensorCards 
          anchorTableData={anchorTableData}
          imuData={imuData}
          pleData={pleData}
          ekfState={ekfState}
          motionState={motionState}
        />
      </div>

      {/* Live Anchor RF Data Table */}
      <div className="tech-panel p-5 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-cyber-cyan" />
            <h3 className="font-semibold text-white tracking-wide text-sm">
              Live LoRa Anchor Network Status
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Log-Distance Path Loss Model: d = d0 · 10^((RSSI0 - RSSI)/(10n))
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-charcoal-850 text-slate-400 uppercase border-b border-charcoal-700">
              <tr>
                <th className="py-2.5 px-3">Anchor</th>
                <th className="py-2.5 px-3">Position (X, Y)</th>
                <th className="py-2.5 px-3">RSSI</th>
                <th className="py-2.5 px-3">True Distance</th>
                <th className="py-2.5 px-3">Estimated Distance</th>
                <th className="py-2.5 px-3">Ranging Error</th>
                <th className="py-2.5 px-3">Signal Quality</th>
                <th className="py-2.5 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-800">
              {anchorTableData.map(anchor => {
                const error = Math.abs(anchor.trueDistance - anchor.estimatedDistance);
                const quality = Math.max(10, Math.min(100, Math.round(100 - (Math.abs(anchor.rssi + 45) * 1.3))));
                return (
                  <tr key={anchor.id} className="hover:bg-charcoal-800/60 transition-colors">
                    <td className="py-2 px-3 font-bold text-lavender-400">{anchor.name || anchor.id}</td>
                    <td className="py-2 px-3 text-slate-300">({anchor.x}m, {anchor.y}m)</td>
                    <td className="py-2 px-3 text-cyber-cyan font-bold">{anchor.rssi} dBm</td>
                    <td className="py-2 px-3 text-slate-300">{anchor.trueDistance.toFixed(2)} m</td>
                    <td className="py-2 px-3 text-slate-200">{anchor.estimatedDistance.toFixed(2)} m</td>
                    <td className="py-2 px-3 text-cyber-amber">{error.toFixed(2)} m</td>
                    <td className="py-2 px-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-16 h-1.5 bg-charcoal-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-cyber-green rounded-full" 
                            style={{ width: `${quality}%` }}
                          />
                        </div>
                        <span className="text-slate-400 text-[10px]">{quality}%</span>
                      </div>
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-cyber-green/10 text-cyber-green border border-cyber-green/30">
                        ONLINE
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}