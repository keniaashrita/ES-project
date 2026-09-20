import React, { useState } from 'react';
import { LineChart, Clock, Filter, Radio } from 'lucide-react';

export default function SensorData({ history, anchors }) {
  const [timeWindow, setTimeWindow] = useState(30); // 10, 30, 60 seconds
  const [selectedAnchor, setSelectedAnchor] = useState('all');

  // Filter history based on time window
  const windowedHistory = history.slice(-timeWindow * 10);

  // SVG mini-plotter helper
  const renderSVGChart = (dataKey, strokeColor, label, unit, minY = null, maxY = null) => {
    if (windowedHistory.length < 2) {
      return (
        <div className="h-28 flex items-center justify-center text-xs text-slate-500 font-mono">
          Awaiting telemetry samples...
        </div>
      );
    }

    const values = windowedHistory.map(d => d[dataKey]).filter(v => v !== null && !isNaN(v));
    if (values.length === 0) return null;

    const actualMin = minY !== null ? minY : Math.min(...values);
    const actualMax = maxY !== null ? maxY : Math.max(...values);
    const range = Math.max(0.001, actualMax - actualMin);

    const width = 500;
    const height = 100;

    const points = values.map((val, idx) => {
      const x = (idx / (values.length - 1)) * width;
      const y = height - ((val - actualMin) / range) * (height - 16) - 8;
      return `${x},${y}`;
    }).join(' ');

    const lastVal = values[values.length - 1];

    return (
      <div className="space-y-1">
        <div className="flex justify-between text-xs font-mono">
          <span className="text-slate-400">{label}</span>
          <span className="font-bold" style={{ color: strokeColor }}>
            {typeof lastVal === 'number' ? lastVal.toFixed(2) : lastVal} {unit}
          </span>
        </div>
        <div className="w-full h-24 bg-charcoal-900 border border-charcoal-800 rounded relative overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full">
            <polyline fill="none" stroke={strokeColor} strokeWidth="2" points={points} />
          </svg>
          <div className="absolute top-1 left-2 text-[9px] font-mono text-slate-500">
            Max: {actualMax.toFixed(1)} {unit}
          </div>
          <div className="absolute bottom-1 left-2 text-[9px] font-mono text-slate-500">
            Min: {actualMin.toFixed(1)} {unit}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Chart Filter Controls */}
      <div className="tech-panel p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-lavender-400" />
          <span className="text-slate-400">TIME WINDOW:</span>
          {[10, 30, 60].map(sec => (
            <button
              key={sec}
              onClick={() => setTimeWindow(sec)}
              className={`px-3 py-1 rounded border transition ${
                timeWindow === sec
                  ? 'bg-lavender-600/40 text-lavender-300 border-lavender-500'
                  : 'bg-charcoal-900 text-slate-400 border-charcoal-700 hover:text-white'
              }`}
            >
              {sec}s
            </button>
          ))}
        </div>

        <div className="text-slate-400">
          Showing <strong className="text-white">{windowedHistory.length}</strong> telemetry frames (10 Hz)
        </div>
      </div>

      {/* Grid of Real-Time Scrolling Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="tech-panel p-5 rounded-xl">
          {renderSVGChart('position_error', '#a78bfa', 'EKF Position Error vs Time', 'm', 0, 5)}
        </div>

        <div className="tech-panel p-5 rounded-xl">
          {renderSVGChart('ple', '#34d399', 'Adaptive Path-Loss Exponent (PLE)', 'n', 1.8, 4.0)}
        </div>

        <div className="tech-panel p-5 rounded-xl">
          {renderSVGChart('rssi_anchor_1', '#38bdf8', 'Anchor A1 RSSI Signal', 'dBm', -90, -40)}
        </div>

        <div className="tech-panel p-5 rounded-xl">
          {renderSVGChart('r_value', '#fbbf24', 'EKF Measurement Covariance (R)', 'var', 0, 25)}
        </div>

        <div className="tech-panel p-5 rounded-xl">
          {renderSVGChart('kalman_gain', '#c4b5fd', 'Kalman Gain (Kx)', 'ratio', 0, 1.0)}
        </div>

        <div className="tech-panel p-5 rounded-xl">
          {renderSVGChart('imu_drift_error', '#f43f5e', 'IMU Dead Reckoning Drift Error', 'm', 0, 20)}
        </div>
      </div>
    </div>
  );
}