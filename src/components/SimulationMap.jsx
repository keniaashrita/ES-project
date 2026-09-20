import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Zap, 
  ShieldAlert, 
  WifiOff, 
  Crosshair, 
  Layers,
  HelpCircle
} from 'lucide-react';

export default function SimulationMap({
  anchors,
  onAnchorMove,
  groundTruth,
  fusedPosition,
  imuPosition,
  loraPosition,
  history,
  isRunning,
  onStart,
  onPause,
  onReset,
  trajectoryType,
  onTrajectoryChange,
  onRunDemo,
  onIntroduceInterference,
  onSimulatePacketLoss
}) {
  const [draggedAnchorId, setDraggedAnchorId] = useState(null);
  const [showLegend, setShowLegend] = useState(true);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const svgRef = useRef(null);

  // Coordinate scaling: 0-50 meters maps to 0-600 SVG pixels
  const GRID_SIZE = 50; // meters
  const SVG_VIEWBOX = 600; // pixels
  const scale = SVG_VIEWBOX / GRID_SIZE;

  const toSvgX = m => m * scale;
  const toSvgY = m => (GRID_SIZE - m) * scale; // Invert Y for cartesian convention

  const handleMouseDown = (id, e) => {
    e.stopPropagation();
    setDraggedAnchorId(id);
  };

  const handleMouseMove = e => {
    if (!draggedAnchorId || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const pixelX = e.clientX - rect.left;
    const pixelY = e.clientY - rect.top;

    let meterX = (pixelX / rect.width) * GRID_SIZE;
    let meterY = GRID_SIZE - (pixelY / rect.height) * GRID_SIZE;

    meterX = Math.max(1, Math.min(49, Math.round(meterX)));
    meterY = Math.max(1, Math.min(49, Math.round(meterY)));

    onAnchorMove(draggedAnchorId, meterX, meterY);
  };

  const handleMouseUp = () => {
    setDraggedAnchorId(null);
  };

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  return (
    <div className="space-y-4">
      {/* Control Action Bar */}
      <div className="tech-panel p-4 rounded-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          {isRunning ? (
            <button
              onClick={onPause}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-cyber-amber/20 text-cyber-amber border border-cyber-amber/40 hover:bg-cyber-amber/30 transition text-xs font-mono font-bold"
            >
              <Pause className="w-4 h-4" />
              <span>PAUSE</span>
            </button>
          ) : (
            <button
              onClick={onStart}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-cyber-green/20 text-cyber-green border border-cyber-green/40 hover:bg-cyber-green/30 transition text-xs font-mono font-bold"
            >
              <Play className="w-4 h-4" />
              <span>START SIMULATION</span>
            </button>
          )}

          <button
            onClick={onReset}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-charcoal-800 text-slate-300 border border-charcoal-700 hover:bg-charcoal-700 transition text-xs font-mono"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>RESET</span>
          </button>
        </div>

        {/* Trajectory Selector */}
        <div className="flex items-center space-x-2 text-xs font-mono">
          <span className="text-slate-400">TRAJECTORY:</span>
          <select
            value={trajectoryType}
            onChange={e => onTrajectoryChange(e.target.value)}
            className="bg-charcoal-900 text-lavender-300 border border-charcoal-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-lavender-500"
          >
            <option value="Circular">Circular Orbit (16m radius)</option>
            <option value="Square">Square Perimeter (28m)</option>
            <option value="Straight Line">Linear Back-and-Forth</option>
            <option value="Random Walk">Random Walk Dynamic</option>
            <option value="Custom">Figure-8 Lemniscate</option>
          </select>
        </div>

        {/* Stress & Demo Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onRunDemo}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-lavender-600/30 text-lavender-300 border border-lavender-500/50 hover:bg-lavender-600/50 transition text-xs font-mono font-semibold"
            title="Starts a 30-second automated academic evaluation"
          >
            <Zap className="w-3.5 h-3.5 text-lavender-400" />
            <span>RUN DEMO</span>
          </button>

          <button
            onClick={onIntroduceInterference}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-cyber-rose/20 text-cyber-rose border border-cyber-rose/40 hover:bg-cyber-rose/30 transition text-xs font-mono"
            title="Induces high multipath noise and tests adaptive R scaling"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>INTERFERENCE</span>
          </button>

          <button
            onClick={onSimulatePacketLoss}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-cyber-amber/20 text-cyber-amber border border-cyber-amber/40 hover:bg-cyber-amber/30 transition text-xs font-mono"
            title="Drops 50% of LoRa packets to demonstrate IMU dead reckoning carry-over"
          >
            <WifiOff className="w-3.5 h-3.5" />
            <span>PACKET LOSS</span>
          </button>
        </div>
      </div>

      {/* Main 2D Interactive Radar Grid */}
      <div className="tech-panel p-4 rounded-xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Crosshair className="w-4 h-4 text-lavender-400" />
            <h3 className="font-semibold text-white tracking-wide text-sm">
              2D Positioning Grid (0m – 50m Cartesian Space)
            </h3>
            <span className="text-[11px] text-slate-400">Drag anchors to reconfigure RF geometry</span>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <button
              onClick={() => setShowLegend(!showLegend)}
              className="text-slate-400 hover:text-white flex items-center space-x-1"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{showLegend ? 'Hide Legend' : 'Show Legend'}</span>
            </button>
            <button
              onClick={() => setShowHowItWorks(!showHowItWorks)}
              className="text-lavender-400 hover:text-lavender-300 flex items-center space-x-1"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>How it Works</span>
            </button>
          </div>
        </div>

        {/* Educational "How it works" Accordion */}
        {showHowItWorks && (
          <div className="mb-3 p-3 bg-charcoal-900 border border-lavender-500/30 rounded-lg text-xs space-y-1.5 text-slate-300 font-sans animate-fadeIn">
            <p>
              <strong className="text-cyber-rose">Why IMU?</strong> Provides high-frequency (10Hz) dead reckoning with zero latency, but quadratic drift accumulates due to bias.
            </p>
            <p>
              <strong className="text-cyber-amber">Why LoRa RSSI?</strong> Provides absolute spatial reference via multilateration at 1Hz, bounding long-term drift, but subject to RF multipath and variance.
            </p>
            <p>
              <strong className="text-lavender-400">Why Adaptive EKF?</strong> Combines IMU prediction with LoRa measurements while dynamically scaling measurement noise covariance <em>R</em> based on RSSI stability.
            </p>
          </div>
        )}

        {/* SVG Canvas Map */}
        <div className="relative w-full aspect-square max-h-[640px] bg-charcoal-950 border border-charcoal-800 rounded-lg overflow-hidden select-none">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_VIEWBOX} ${SVG_VIEWBOX}`}
            className="w-full h-full cursor-crosshair"
            onMouseMove={handleMouseMove}
          >
            <defs>
              {/* Radar Grid Pattern */}
              <pattern id="grid-pattern" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(167, 139, 250, 0.08)" strokeWidth="1" />
              </pattern>
              <pattern id="subgrid-pattern" width="12" height="12" patternUnits="userSpaceOnUse">
                <path d="M 12 0 L 0 0 0 12" fill="none" stroke="rgba(167, 139, 250, 0.03)" strokeWidth="0.5" />
              </pattern>
            </defs>

            {/* Background Grid */}
            <rect width="100%" height="100%" fill="#090c14" />
            <rect width="100%" height="100%" fill="url(#subgrid-pattern)" />
            <rect width="100%" height="100%" fill="url(#grid-pattern)" />

            {/* Range Rings from Center (25, 25) */}
            <circle cx={toSvgX(25)} cy={toSvgY(25)} r={scale * 10} fill="none" stroke="rgba(56, 189, 248, 0.1)" strokeDasharray="3 3" />
            <circle cx={toSvgX(25)} cy={toSvgY(25)} r={scale * 20} fill="none" stroke="rgba(56, 189, 248, 0.1)" strokeDasharray="3 3" />

            {/* Grid Coordinate Markers */}
            {[0, 10, 20, 30, 40, 50].map(val => (
              <g key={val} className="text-[10px] fill-slate-500 font-mono select-none">
                <text x={toSvgX(val) + 4} y={SVG_VIEWBOX - 6}>{val}m</text>
                {val > 0 && <text x={6} y={toSvgY(val) - 4}>{val}m</text>}
              </g>
            ))}

            {/* Historical Ground Truth Trajectory (Dashed Gray/Green) */}
            {history.length > 1 && (
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="1.5"
                strokeDasharray="4 4"
                opacity="0.6"
                points={history.map(h => `${toSvgX(h.true_x)},${toSvgY(h.true_y)}`).join(' ')}
              />
            )}

            {/* Historical IMU-Only Path (Drifting Red Line) */}
            {history.length > 1 && (
              <polyline
                fill="none"
                stroke="#f43f5e"
                strokeWidth="1.8"
                opacity="0.75"
                points={history.map(h => `${toSvgX(h.imu_x)},${toSvgY(h.imu_y)}`).join(' ')}
              />
            )}

            {/* Historical LoRa Trilateration Points (Noisy Amber Scatter) */}
            {history.filter(h => h.lora_x !== null).map((h, i) => (
              <circle
                key={i}
                cx={toSvgX(h.lora_x)}
                cy={toSvgY(h.lora_y)}
                r="2"
                fill="#fbbf24"
                opacity="0.4"
              />
            ))}

            {/* Historical Fused EKF Path (Solid Glowing Lavender Line) */}
            {history.length > 1 && (
              <polyline
                fill="none"
                stroke="#a78bfa"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={history.map(h => `${toSvgX(h.fused_x)},${toSvgY(h.fused_y)}`).join(' ')}
              />
            )}

            {/* Anchor Distance Measurement Circles (Latest Ping) */}
            {anchors.map(anchor => {
              const estRadius = (anchor.estimatedDistance || 0) * scale;
              return (
                <g key={`ping-${anchor.id}`}>
                  <circle
                    cx={toSvgX(anchor.x)}
                    cy={toSvgY(anchor.y)}
                    r={Math.max(2, estRadius)}
                    fill="none"
                    stroke="rgba(56, 189, 248, 0.12)"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                  {/* Line from anchor to target */}
                  <line
                    x1={toSvgX(anchor.x)}
                    y1={toSvgY(anchor.y)}
                    x2={toSvgX(fusedPosition.x)}
                    y2={toSvgY(fusedPosition.y)}
                    stroke="rgba(56, 189, 248, 0.18)"
                    strokeWidth="1"
                  />
                </g>
              );
            })}

            {/* Fixed Anchor Nodes (Draggable) */}
            {anchors.map(anchor => {
              const ax = toSvgX(anchor.x);
              const ay = toSvgY(anchor.y);
              return (
                <g
                  key={anchor.id}
                  className="cursor-move group"
                  onMouseDown={e => handleMouseDown(anchor.id, e)}
                >
                  <circle cx={ax} cy={ay} r="14" fill="rgba(56, 189, 248, 0.1)" stroke="#38bdf8" strokeWidth="1.5" />
                  <circle cx={ax} cy={ay} r="5" fill="#38bdf8" />
                  <text
                    x={ax}
                    y={ay - 16}
                    textAnchor="middle"
                    className="text-[11px] font-mono font-bold fill-cyber-cyan select-none"
                  >
                    {anchor.name || anchor.id}
                  </text>
                  <text
                    x={ax}
                    y={ay + 24}
                    textAnchor="middle"
                    className="text-[9px] font-mono fill-slate-400 select-none"
                  >
                    ({anchor.x}m, {anchor.y}m)
                  </text>
                </g>
              );
            })}

            {/* Current LoRa Estimation Marker (Yellow) */}
            {loraPosition && (
              <g>
                <circle cx={toSvgX(loraPosition.x)} cy={toSvgY(loraPosition.y)} r="5" fill="#fbbf24" opacity="0.85" />
                <circle cx={toSvgX(loraPosition.x)} cy={toSvgY(loraPosition.y)} r="9" fill="none" stroke="#fbbf24" strokeWidth="1" strokeDasharray="2 2" />
              </g>
            )}

            {/* Current IMU Dead Reckoning Marker (Red) */}
            <g>
              <circle cx={toSvgX(imuPosition.x)} cy={toSvgY(imuPosition.y)} r="6" fill="#f43f5e" opacity="0.9" />
            </g>

            {/* Current Ground Truth Marker (Green) */}
            <g>
              <circle cx={toSvgX(groundTruth.x)} cy={toSvgY(groundTruth.y)} r="6" fill="#10b981" opacity="0.95" />
              <circle cx={toSvgX(groundTruth.x)} cy={toSvgY(groundTruth.y)} r="12" fill="none" stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" />
            </g>

            {/* Current Fused EKF Target Device (Lavender Glowing Indicator) */}
            <g>
              <circle
                cx={toSvgX(fusedPosition.x)}
                cy={toSvgY(fusedPosition.y)}
                r="16"
                fill="none"
                stroke="#a78bfa"
                strokeWidth="1.5"
                className="animate-pulse-ring"
              />
              <circle
                cx={toSvgX(fusedPosition.x)}
                cy={toSvgY(fusedPosition.y)}
                r="7"
                fill="#8b5cf6"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
              {/* Heading Pointer Arrow */}
              {groundTruth.heading !== undefined && (
                <line
                  x1={toSvgX(fusedPosition.x)}
                  y1={toSvgY(fusedPosition.y)}
                  x2={toSvgX(fusedPosition.x) + 16 * Math.cos((groundTruth.heading * Math.PI) / 180)}
                  y2={toSvgY(fusedPosition.y) - 16 * Math.sin((groundTruth.heading * Math.PI) / 180)}
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}
            </g>
          </svg>

          {/* Floating Expandable Legend */}
          {showLegend && (
            <div className="absolute bottom-3 left-3 bg-charcoal-900/90 backdrop-blur border border-charcoal-700 p-3 rounded-lg text-xs font-mono space-y-1.5 shadow-xl">
              <div className="text-[10px] font-bold text-slate-400 mb-1 border-b border-charcoal-800 pb-1">
                MAP LEGEND
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-cyber-cyan border border-white/20" />
                <span className="text-slate-300">LoRa Anchor Node (Fixed)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-0.5 border-b-2 border-dashed border-cyber-green" />
                <span className="text-slate-300">Ground Truth Trajectory</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-0.5 bg-cyber-rose" />
                <span className="text-slate-300">IMU Dead Reckoning (Drifting)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 rounded-full bg-cyber-amber" />
                <span className="text-slate-300">LoRa Multilateration (Noisy)</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-1 bg-lavender-400 rounded-full" />
                <span className="text-lavender-300 font-bold">Fused EKF Estimate (Filtered)</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}