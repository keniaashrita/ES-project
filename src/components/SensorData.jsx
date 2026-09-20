import React, { useState } from 'react';
import { Clock } from 'lucide-react';

export default function SensorData({ history }) {
  const [timeWindow, setTimeWindow] = useState(30);
  const windowedHistory = history.slice(-timeWindow * 10);

  const renderSVGChart = (dataKey, strokeColor, label, unit) => {
    const values = windowedHistory.map(d => d[dataKey]).filter(v => v !== null && !isNaN(v));
    if (values.length < 2) return null;
    const actualMin = Math.min(...values);
    const actualMax = Math.max(...values);
    const range = Math.max(0.001, actualMax - actualMin);
    const width = 500, height = 100;
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
          <span className="font-bold" style={{ color: strokeColor }}>{lastVal.toFixed(2)} {unit}</span>
        </div>
        <div className="w-full h-24 bg-charcoal-900 border border-charcoal-800 rounded relative overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-full">
            <polyline fill="none" stroke={strokeColor} strokeWidth="2" points={points} />
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="tech-panel p-4 rounded-xl flex items-center justify-between text-xs font-mono">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-lavender-400" />
          <span className="text-slate-400">WINDOW:</span>
          {[10, 30, 60].map(s => (
            <button key={s} onClick={() => setTimeWindow(s)} className={`px-3 py-1 rounded border ${timeWindow === s ? 'bg-lavender-600/40 text-lavender-300 border-lavender-500' : 'bg-charcoal-900 text-slate-400 border-charcoal-700'}`}>
              {s}s
            </button>
          ))}
        </div>
        <div className="text-slate-400">{windowedHistory.length} frames logged</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="tech-panel p-5 rounded-xl">{renderSVGChart('position_error', '#a78bfa', 'Position Error', 'm')}</div>
        <div className="tech-panel p-5 rounded-xl">{renderSVGChart('ple', '#34d399', 'Adaptive PLE', 'n')}</div>
        <div className="tech-panel p-5 rounded-xl">{renderSVGChart('r_value', '#fbbf24', 'Measurement Covariance (R)', 'var')}</div>
        <div className="tech-panel p-5 rounded-xl">{renderSVGChart('imu_drift_error', '#f43f5e', 'IMU Drift Error', 'm')}</div>
      </div>
    </div>
  );
}
