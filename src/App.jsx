import React, { useState, useEffect, useRef } from 'react';
import { Download } from 'lucide-react';
import { HardwareProvider } from './hardware/HardwareProvider';

import { calculateRSSI, rssiToDistance } from './algorithms/rssiModel';
import { AdaptivePLEEstimator } from './algorithms/adaptivePLE';
import { estimatePositionTrilateration } from './algorithms/trilateration';
import { IMUDeadReckoning } from './algorithms/imuDeadReckoning';
import { detectMotionState } from './algorithms/motionDetection';
import { AdaptiveEKF } from './algorithms/adaptiveEKF';

import { generateTrajectoryPoint } from './simulation/trajectory';
import { ENVIRONMENTS } from './simulation/environment';

import { exportToCSV, exportToJSON } from './utils/exportData';
import { calculateDistance } from './utils/calculations';

import Dashboard from './components/Dashboard';
import SimulationMap from './components/SimulationMap';
import AnchorPanel from './components/AnchorPanel';
import SensorData from './components/SensorData';
import EKFPanel from './components/EKFPanel';
import PerformancePanel from './components/PerformancePanel';
import SystemArchitecture from './components/SystemArchitecture';

const DEFAULT_ANCHORS = [
  { id: 'A1', name: 'Anchor A1', x: 5, y: 5 },
  { id: 'A2', name: 'Anchor A2', x: 45, y: 5 },
  { id: 'A3', name: 'Anchor A3', x: 25, y: 45 },
  { id: 'A4', name: 'Anchor A4', x: 5, y: 40 }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [isRunning, setIsRunning] = useState(true);
  const [trajectoryType, setTrajectoryType] = useState('Circular');
  const [environmentKey, setEnvironmentKey] = useState('Open Outdoor');
  const [packetLossRate, setPacketLossRate] = useState(5);

  const [anchors, setAnchors] = useState(DEFAULT_ANCHORS);
  const [groundTruth, setGroundTruth] = useState({ x: 25, y: 25, vx: 0, vy: 0, heading: 0 });
  const [fusedPosition, setFusedPosition] = useState({ x: 25, y: 25 });
  const [imuPosition, setImuPosition] = useState({ x: 25, y: 25 });
  const [loraPosition, setLoraPosition] = useState({ x: 25, y: 25 });

  const [positionError, setPositionError] = useState(0.25);
  const [imuError, setImuError] = useState(0.0);
  const [loraError, setLoraError] = useState(0.0);
  const [pleData, setPleData] = useState({ currentPLE: 2.0, initialPLE: 2.0, status: 'STABLE', variance: 1.0 });
  const [ekfState, setEkfState] = useState({ confidence: 94, rValue: 4.0, kalmanGain: [0.5, 0.5], innovation: [0, 0] });
  const [imuTelemetry, setImuTelemetry] = useState({ ax: 0, ay: 0, az: 9.81, gx: 0, gy: 0, gz: 0, heading: 0 });
  const [motionState, setMotionState] = useState({ state: 'MOVING', accelMagnitude: 0.5, gyroMagnitude: 0.05 });
  const [packetStats, setPacketStats] = useState({ sent: 0, received: 0, lossRate: 5, lastUpdateSec: 0 });
  const [anchorTableData, setAnchorTableData] = useState([]);
  const [telemetryHistory, setTelemetryHistory] = useState([]);

  // ── Hardware Mode ──
  const [dataSource, setDataSource] = useState('simulation'); // 'simulation' | 'hardware'
  const [hwStatus, setHwStatus] = useState({
    gatewayConnected: false,
    deviceConnected: false,
    stale: true,
    lastPosition: null,
    lastTelemetry: null,
    messageCount: 0
  });
  const hwProviderRef = useRef(null);

  const ekfRef = useRef(new AdaptiveEKF(25, 25));
  const imuReckoningRef = useRef(new IMUDeadReckoning({ x: 25, y: 25 }));
  const pleEstimatorRef = useRef(new AdaptivePLEEstimator(2.0));
  const simTimeRef = useRef(0);
  const loRaTimerRef = useRef(0);
  const demoIntervalRef = useRef(null);

  // ── Hardware WebSocket Connection ──
  useEffect(() => {
    if (dataSource !== 'hardware') {
      if (hwProviderRef.current) {
        hwProviderRef.current.disconnect();
        hwProviderRef.current = null;
      }
      return;
    }

    const hw = new HardwareProvider('ws://localhost:8765');
    hwProviderRef.current = hw;

    hw.onTelemetry = (data) => {
      setHwStatus(hw.getStatus());

      // Feed hardware IMU data into existing algorithms
      if (data.imu && data.imu.ok) {
        const imuData = {
          ax: data.imu.a[0],
          ay: data.imu.a[1],
          az: data.imu.a[2],
          gx: data.imu.g[0],
          gy: data.imu.g[1],
          gz: data.imu.g[2]
        };
        setImuTelemetry({ ...imuData, heading: 0 });
        const motion = detectMotionState(imuData);
        setMotionState(motion);
        const imuInt = imuReckoningRef.current.integrate(
          imuData,
          0.1,
          motion.isStationary
        );
        setImuPosition({ x: imuInt.x, y: imuInt.y });
        ekfRef.current.predict(imuData, 0.1);
      }

      // Feed hardware anchor data
      if (data.position && data.position.valid) {
        const pos = { x: data.position.x, y: data.position.y };
        setLoraPosition(pos);
        setFusedPosition(pos);
        setPositionError(0); // No ground truth in hardware mode
      }

      // Update anchor table
      if (data.anchors) {
        setAnchorTableData(data.anchors.map(a => ({
          id: a.id,
          name: 'Anchor ' + a.id,
          x: a.id === 'A' ? 2 : 8,
          y: 0,
          rssi: a.rssi,
          estimatedDistance: a.distance || 0,
          trueDistance: 0
        })));
      }
    };

    hw.onStatus = () => setHwStatus(hw.getStatus());
    hw.onConnect = () => setHwStatus(hw.getStatus());
    hw.onDisconnect = () => setHwStatus(hw.getStatus());
    hw.connect();

    return () => hw.disconnect();
  }, [dataSource]);

  const handleReset = () => {
    simTimeRef.current = 0;
    loRaTimerRef.current = 0;
    const origin = { x: 25, y: 25, vx: 0, vy: 0, heading: 0 };
    setGroundTruth(origin);
    setFusedPosition({ x: 25, y: 25 });
    setImuPosition({ x: 25, y: 25 });
    setLoraPosition({ x: 25, y: 25 });
    ekfRef.current.reset(25, 25);
    imuReckoningRef.current.reset({ x: 25, y: 25 });
    pleEstimatorRef.current.reset(ENVIRONMENTS[environmentKey].ple);
    setTelemetryHistory([]);
  };

  const handleRunDemo = () => {
    handleReset();
    setTrajectoryType('Circular');
    setEnvironmentKey('Open Outdoor');
    setIsRunning(true);
    if (demoIntervalRef.current) clearTimeout(demoIntervalRef.current);
    demoIntervalRef.current = setTimeout(() => setActiveTab('Performance'), 15000);
  };

  useEffect(() => {
    if (!isRunning || dataSource === 'hardware') return;
    const dt = 0.1;
    const interval = setInterval(() => {
      simTimeRef.current += dt;
      loRaTimerRef.current += dt;
      const env = ENVIRONMENTS[environmentKey];

      const gt = generateTrajectoryPoint(trajectoryType, simTimeRef.current);
      setGroundTruth(gt);

      const imuData = {
        ax: gt.ax + (Math.random() - 0.5) * 0.08 + 0.03,
        ay: gt.ay + (Math.random() - 0.5) * 0.08 - 0.02,
        az: 9.81 + (Math.random() - 0.5) * 0.05,
        gx: (Math.random() - 0.5) * 0.02,
        gy: (Math.random() - 0.5) * 0.02,
        gz: ((gt.heading * Math.PI) / 180) * 0.1 + (Math.random() - 0.5) * 0.01
      };
      setImuTelemetry({ ...imuData, heading: gt.heading });

      const motion = detectMotionState(imuData);
      setMotionState(motion);

      const imuIntegrated = imuReckoningRef.current.integrate(imuData, dt, motion.isStationary);
      setImuPosition({ x: imuIntegrated.x, y: imuIntegrated.y });

      ekfRef.current.predict(imuData, dt);

      let currentLoraPos = loraPosition;
      let currentAnchorTable = [];

      if (loRaTimerRef.current >= 1.0) {
        loRaTimerRef.current = 0;
        setPacketStats(prev => ({ ...prev, sent: prev.sent + 1 }));

        const isDropped = Math.random() < (packetLossRate / 100);
        if (!isDropped) {
          setPacketStats(prev => ({ ...prev, received: prev.received + 1, lastUpdateSec: 0 }));

          const anchorObservations = anchors.map(anchor => {
            const trueDist = calculateDistance(gt.x, gt.y, anchor.x, anchor.y);
            const rssi = calculateRSSI(trueDist, {
              rssi0: -40, d0: 1.0, ple: env.ple,
              noiseStd: env.rssiNoiseStd, multipathStd: env.multipathStd
            });
            const estDist = rssiToDistance(rssi, -40, pleEstimatorRef.current.currentPLE, 1.0);

            return {
              id: anchor.id, name: anchor.name, x: anchor.x, y: anchor.y,
              trueDistance: trueDist, rssi, estimatedDistance: estDist,
              priorDistance: calculateDistance(fusedPosition.x, fusedPosition.y, anchor.x, anchor.y)
            };
          });

          currentAnchorTable = anchorObservations;
          setAnchorTableData(anchorObservations);

          const pleResult = pleEstimatorRef.current.update(anchorObservations, -40);
          setPleData(pleResult);

          const loraResult = estimatePositionTrilateration(anchorObservations);
          if (loraResult.success && loraResult.position) {
            currentLoraPos = loraResult.position;
            setLoraPosition(currentLoraPos);
            ekfRef.current.update(currentLoraPos, {
              rssiVariance: pleResult.variance,
              gdop: loraResult.gdop,
              isPacketDropped: false
            });
          }
        } else {
          setPacketStats(prev => ({ ...prev, lastUpdateSec: Number((prev.lastUpdateSec + 1.0).toFixed(1)) }));
          ekfRef.current.update(null, { isPacketDropped: true });
        }
      }

      const currentEKFState = ekfRef.current.getState();
      const fused = { x: currentEKFState.x, y: currentEKFState.y };
      setFusedPosition(fused);
      setEkfState(currentEKFState);

      const currFusedErr = calculateDistance(fused.x, fused.y, gt.x, gt.y);
      const currImuErr = calculateDistance(imuIntegrated.x, imuIntegrated.y, gt.x, gt.y);
      const currLoraErr = currentLoraPos ? calculateDistance(currentLoraPos.x, currentLoraPos.y, gt.x, gt.y) : null;

      setPositionError(currFusedErr);
      setImuError(currImuErr);
      if (currLoraErr !== null) setLoraError(currLoraErr);

      const frame = {
        timestamp: Number(simTimeRef.current.toFixed(1)),
        true_x: gt.x, true_y: gt.y,
        imu_x: imuIntegrated.x, imu_y: imuIntegrated.y,
        lora_x: currentLoraPos ? currentLoraPos.x : null,
        lora_y: currentLoraPos ? currentLoraPos.y : null,
        fused_x: fused.x, fused_y: fused.y,
        rssi_anchor_1: currentAnchorTable[0]?.rssi ?? null,
        rssi_anchor_2: currentAnchorTable[1]?.rssi ?? null,
        rssi_anchor_3: currentAnchorTable[2]?.rssi ?? null,
        ple: pleEstimatorRef.current.currentPLE,
        r_value: currentEKFState.rValue,
        kalman_gain: currentEKFState.kalmanGain[0],
        position_error: Number(currFusedErr.toFixed(2)),
        imu_drift_error: Number(currImuErr.toFixed(2)),
        lora_error: currLoraErr !== null ? Number(currLoraErr.toFixed(2)) : null
      };

      setTelemetryHistory(prev => {
        const next = [...prev, frame];
        return next.length > 600 ? next.slice(-600) : next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, trajectoryType, environmentKey, packetLossRate, anchors, dataSource]);

  const handleAnchorMove = (id, newX, newY) => {
    setAnchors(prev => prev.map(a => a.id === id ? { ...a, x: newX, y: newY } : a));
  };

  const handleAddAnchor = (anchor) => {
    const id = `A${anchors.length + 1}`;
    setAnchors(prev => [...prev, { ...anchor, id }]);
  };

  const handleDeleteAnchor = (id) => {
    if (anchors.length <= 3) {
      alert('Cannot delete anchor. Minimum 3 anchors required for 2D trilateration.');
      return;
    }
    setAnchors(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="min-h-screen bg-charcoal-950 text-slate-100 flex flex-col">
      <header className="tech-panel border-b border-charcoal-700 px-6 py-3 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-lavender-600/20 border border-lavender-500/50 flex items-center justify-center text-lavender-400 font-mono font-bold text-sm">
              AE
            </div>
            <div>
              <h1 className="text-base font-bold text-white font-mono">Adaptive LoRa–IMU Fusion</h1>
              <p className="text-[11px] text-lavender-400 font-mono">GPS-Free Real-Time Positioning</p>
            </div>
          </div>

          <nav className="flex items-center space-x-1 bg-charcoal-900 p-1 rounded-lg border border-charcoal-800 text-xs font-mono">
            {['Dashboard', 'Simulation', 'Anchors', 'Sensor Data', 'EKF Fusion', 'Performance', 'Architecture'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3.5 py-1.5 rounded-md transition ${activeTab === tab ? 'bg-lavender-600 text-white font-bold' : 'text-slate-400 hover:bg-charcoal-800'}`}
              >
                {tab}
              </button>
            ))}
          </nav>

          <div className="flex items-center space-x-2">
            {/* Data Source Toggle */}
            <div className="flex items-center space-x-1 bg-charcoal-900 p-0.5 rounded border border-charcoal-700 text-xs font-mono">
              <button
                onClick={() => setDataSource('simulation')}
                className={`px-2.5 py-1 rounded transition ${dataSource === 'simulation' ? 'bg-lavender-600 text-white' : 'text-slate-400'}`}
              >
                SIM
              </button>
              <button
                onClick={() => setDataSource('hardware')}
                className={`px-2.5 py-1 rounded transition ${dataSource === 'hardware' ? 'bg-cyber-green text-white' : 'text-slate-400'}`}
              >
                HW
              </button>
            </div>

            {dataSource === 'hardware' && (
              <span className={`text-xs font-mono flex items-center space-x-1 ${hwStatus.deviceConnected ? 'text-cyber-green' : 'text-cyber-rose'}`}>
                <span className={`w-2 h-2 rounded-full ${hwStatus.deviceConnected ? 'bg-cyber-green animate-pulse' : 'bg-cyber-rose'}`} />
                <span>{hwStatus.deviceConnected ? 'ESP32' : 'DISCONN'}</span>
              </span>
            )}

            {/* Existing CSV/JSON buttons */}
            <button onClick={() => exportToCSV(telemetryHistory)} className="flex items-center space-x-1 px-3 py-1.5 rounded bg-charcoal-800 text-slate-300 border border-charcoal-700 text-xs font-mono hover:bg-charcoal-700">
              <Download className="w-3.5 h-3.5 text-cyber-cyan" /><span>CSV</span>
            </button>
            <button onClick={() => exportToJSON(telemetryHistory)} className="flex items-center space-x-1 px-3 py-1.5 rounded bg-charcoal-800 text-slate-300 border border-charcoal-700 text-xs font-mono hover:bg-charcoal-700">
              <Download className="w-3.5 h-3.5 text-lavender-400" /><span>JSON</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 flex-1 space-y-6">
        <div className="tech-panel p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">ENVIRONMENT:</span>
            <select value={environmentKey} onChange={e => setEnvironmentKey(e.target.value)} className="bg-charcoal-900 text-white border border-charcoal-700 rounded px-2.5 py-1">
              {Object.keys(ENVIRONMENTS).map(env => <option key={env} value={env}>{env}</option>)}
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">PACKET LOSS:</span>
            <input type="range" min="0" max="50" step="5" value={packetLossRate} onChange={e => setPacketLossRate(Number(e.target.value))} className="w-24 cursor-pointer" />
            <span className="text-cyber-amber font-bold">{packetLossRate}%</span>
          </div>
          <div className="flex items-center space-x-3 text-slate-400">
            <span>Sent: <strong className="text-white">{packetStats.sent}</strong></span>
            <span>Rx: <strong className="text-cyber-green">{packetStats.received}</strong></span>
            <span>Time: <strong className="text-cyber-cyan">{simTimeRef.current.toFixed(1)}s</strong></span>
          </div>
        </div>

        {activeTab === 'Dashboard' && (
          <Dashboard
            simulationStatus={dataSource === 'hardware'
              ? (hwStatus.deviceConnected ? 'HARDWARE' : 'HW DISCONN')
              : (isRunning ? 'RUNNING' : 'PAUSED')}
            dataSource={dataSource}
            hwStatus={hwStatus}
            groundTruth={groundTruth} fusedPosition={fusedPosition} imuPosition={imuPosition} loraPosition={loraPosition}
            positionError={positionError} imuError={imuError} loraError={loraError}
            anchorTableData={anchorTableData} imuData={imuTelemetry} pleData={pleData}
            ekfState={ekfState} motionState={motionState} packetStats={packetStats}
          />
        )}
        {activeTab === 'Simulation' && (
          <SimulationMap
            anchors={anchors} onAnchorMove={handleAnchorMove}
            groundTruth={groundTruth} fusedPosition={fusedPosition} imuPosition={imuPosition} loraPosition={loraPosition}
            history={telemetryHistory} isRunning={isRunning}
            onStart={() => setIsRunning(true)} onPause={() => setIsRunning(false)} onReset={handleReset}
            trajectoryType={trajectoryType} onTrajectoryChange={setTrajectoryType}
            onRunDemo={handleRunDemo} onIntroduceInterference={() => { setEnvironmentKey('High Multipath'); setPacketLossRate(20); }}
            onSimulatePacketLoss={() => setPacketLossRate(50)}
          />
        )}
        {activeTab === 'Anchors' && (
          <AnchorPanel anchors={anchors} onAddAnchor={handleAddAnchor} onDeleteAnchor={handleDeleteAnchor} />
        )}
        {activeTab === 'Sensor Data' && (
          <SensorData history={telemetryHistory} />
        )}
        {activeTab === 'EKF Fusion' && (
          <EKFPanel fusedPosition={fusedPosition} loraPosition={loraPosition} ekfState={ekfState} pleData={pleData} />
        )}
        {activeTab === 'Performance' && (
          <PerformancePanel history={telemetryHistory} />
        )}
        {activeTab === 'Architecture' && (
          <SystemArchitecture />
        )}
      </main>
    </div>
  );
}
