import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  Radio,
  Cpu,
  Navigation,
  Download,
  Play,
  Pause,
  RotateCcw,
  Zap,
  Wifi,
  Crosshair,
  Gauge,
  Database,
  GitBranch,
  Signal,
  CircleDot,
} from "lucide-react";

import { calculateRSSI, rssiToDistance } from "./algorithms/rssiModel";
import { AdaptivePLEEstimator } from "./algorithms/adaptivePLE";
import { estimatePositionTrilateration } from "./algorithms/trilateration";
import { IMUDeadReckoning } from "./algorithms/imuDeadReckoning";
import { detectMotionState } from "./algorithms/motionDetection";
import { AdaptiveEKF } from "./algorithms/adaptiveEKF";

import { generateTrajectoryPoint } from "./simulation/trajectory";
import { ENVIRONMENTS } from "./simulation/environment";

import { exportToCSV, exportToJSON } from "./utils/exportData";
import { calculateDistance } from "./utils/calculations";

import SimulationMap from "./components/SimulationMap";
import AnchorPanel from "./components/AnchorPanel";
import SensorData from "./components/SensorData";
import EKFPanel from "./components/EKFPanel";
import PerformancePanel from "./components/PerformancePanel";
import SystemArchitecture from "./components/SystemArchitecture";


/* =========================================================
   DEFAULT ANCHORS
========================================================= */

const DEFAULT_ANCHORS = [
  { id: "A1", name: "Anchor A1", x: 5, y: 5 },
  { id: "A2", name: "Anchor A2", x: 45, y: 5 },
  { id: "A3", name: "Anchor A3", x: 25, y: 45 },
  { id: "A4", name: "Anchor A4", x: 5, y: 40 },
];


/* =========================================================
   SMALL UI COMPONENTS
========================================================= */

function Panel({ children, className = "" }) {
  return (
    <div
      className={`
        rounded-xl
        border border-slate-800/80
        bg-[#0b1220]/95
        shadow-[0_8px_30px_rgba(0,0,0,0.18)]
        ${className}
      `}
    >
      {children}
    </div>
  );
}


function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-start gap-2.5">
        {Icon && (
          <div className="mt-0.5 text-cyan-400">
            <Icon size={14} />
          </div>
        )}

        <div>
          <h2 className="text-[11px] font-bold tracking-[0.14em] text-slate-200 uppercase">
            {title}
          </h2>

          {subtitle && (
            <p className="mt-1 text-[9px] font-mono text-slate-500 uppercase">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="h-1 w-1 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,.7)]" />
    </div>
  );
}


function MetricCard({
  icon: Icon,
  label,
  value,
  subtitle,
  accent = "cyan",
  status = true,
}) {
  const accentClass =
    accent === "violet"
      ? "text-violet-400"
      : accent === "green"
      ? "text-emerald-400"
      : "text-cyan-400";

  const dotClass =
    accent === "violet"
      ? "bg-violet-400"
      : accent === "green"
      ? "bg-emerald-400"
      : "bg-cyan-400";

  return (
    <Panel className="relative overflow-hidden p-3.5">
      <div className="absolute right-3 top-3 opacity-60">
        {Icon && <Icon size={14} className={accentClass} />}
      </div>

      <div className="text-[8px] font-mono font-semibold tracking-[0.14em] text-slate-500">
        {label}
      </div>

      <div className="mt-2 flex items-center gap-2">
        {status && (
          <span
            className={`h-1.5 w-1.5 rounded-full ${dotClass} shadow-[0_0_7px_currentColor]`}
          />
        )}

        <span className={`text-[17px] font-bold tracking-tight ${accentClass}`}>
          {value}
        </span>
      </div>

      {subtitle && (
        <div className="mt-1.5 text-[8px] font-mono text-slate-500">
          {subtitle}
        </div>
      )}
    </Panel>
  );
}


/* =========================================================
   COORDINATE MAP
========================================================= */

function CoordinateMap({
  groundTruth,
  fusedPosition,
  imuPosition,
  loraPosition,
  anchors,
  history,
}) {
  const width = 700;
  const height = 390;
  const padding = 42;

  const mapX = (x) =>
    padding + (Math.max(0, Math.min(50, x)) / 50) * (width - padding * 2);

  const mapY = (y) =>
    height -
    padding -
    (Math.max(0, Math.min(50, y)) / 50) * (height - padding * 2);

  const trajectory = history
    .filter(
      (p) =>
        typeof p.fused_x === "number" &&
        typeof p.fused_y === "number"
    )
    .slice(-150);

  const path =
    trajectory.length > 1
      ? trajectory
          .map(
            (p, i) =>
              `${i === 0 ? "M" : "L"} ${mapX(p.fused_x)} ${mapY(
                p.fused_y
              )}`
          )
          .join(" ")
      : "";

  const gridLines = [];

  for (let i = 0; i <= 10; i++) {
    const x = padding + (i / 10) * (width - padding * 2);
    const y = padding + (i / 10) * (height - padding * 2);

    gridLines.push(
      <line
        key={`v-${i}`}
        x1={x}
        y1={padding}
        x2={x}
        y2={height - padding}
        stroke="#1e293b"
        strokeWidth="1"
        opacity="0.65"
      />
    );

    gridLines.push(
      <line
        key={`h-${i}`}
        x1={padding}
        y1={y}
        x2={width - padding}
        y2={y}
        stroke="#1e293b"
        strokeWidth="1"
        opacity="0.65"
      />
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-[#07101d]">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
      >
        <defs>
          <radialGradient id="mapGlow">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity=".16" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </radialGradient>

          <filter id="cyanGlow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {gridLines}

        {/* Axis */}
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#334155"
        />

        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="#334155"
        />

        {/* Axis labels */}
        <text
          x={width - 22}
          y={height - 25}
          fill="#64748b"
          fontSize="9"
          fontFamily="monospace"
        >
          X
        </text>

        <text
          x={23}
          y={25}
          fill="#64748b"
          fontSize="9"
          fontFamily="monospace"
        >
          Y
        </text>

        {/* trajectory */}
        {path && (
          <path
            d={path}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="1.5"
            opacity=".55"
            strokeDasharray="4 4"
          />
        )}

        {/* Anchor points */}
        {anchors.map((anchor) => (
          <g key={anchor.id}>
            <circle
              cx={mapX(anchor.x)}
              cy={mapY(anchor.y)}
              r="5"
              fill="#a78bfa"
              opacity=".9"
            />

            <circle
              cx={mapX(anchor.x)}
              cy={mapY(anchor.y)}
              r="10"
              fill="none"
              stroke="#8b5cf6"
              opacity=".25"
            />

            <text
              x={mapX(anchor.x) + 8}
              y={mapY(anchor.y) - 8}
              fill="#a78bfa"
              fontSize="8"
              fontFamily="monospace"
            >
              {anchor.id}
            </text>
          </g>
        ))}

        {/* Ground truth */}
        <circle
          cx={mapX(groundTruth.x)}
          cy={mapY(groundTruth.y)}
          r="5"
          fill="#f8fafc"
        />

        {/* IMU */}
        <circle
          cx={mapX(imuPosition.x)}
          cy={mapY(imuPosition.y)}
          r="4"
          fill="#a78bfa"
          opacity=".75"
        />

        {/* LoRa */}
        <circle
          cx={mapX(loraPosition.x)}
          cy={mapY(loraPosition.y)}
          r="4"
          fill="#f59e0b"
          opacity=".8"
        />

        {/* fused glow */}
        <circle
          cx={mapX(fusedPosition.x)}
          cy={mapY(fusedPosition.y)}
          r="24"
          fill="url(#mapGlow)"
        />

        <circle
          cx={mapX(fusedPosition.x)}
          cy={mapY(fusedPosition.y)}
          r="7"
          fill="#22d3ee"
          filter="url(#cyanGlow)"
        />

        <circle
          cx={mapX(fusedPosition.x)}
          cy={mapY(fusedPosition.y)}
          r="13"
          fill="none"
          stroke="#22d3ee"
          strokeOpacity=".4"
        />

        {/* current coordinate */}
        <text
          x={mapX(fusedPosition.x) + 11}
          y={mapY(fusedPosition.y) - 11}
          fill="#67e8f9"
          fontSize="9"
          fontFamily="monospace"
        >
          FUSED
        </text>

        {/* scale labels */}
        {[0, 10, 20, 30, 40, 50].map((v) => (
          <text
            key={`x-${v}`}
            x={mapX(v)}
            y={height - 23}
            textAnchor="middle"
            fill="#475569"
            fontSize="8"
            fontFamily="monospace"
          >
            {v}
          </text>
        ))}

        {[0, 10, 20, 30, 40, 50].map((v) => (
          <text
            key={`y-${v}`}
            x={27}
            y={mapY(v) + 3}
            fill="#475569"
            fontSize="8"
            fontFamily="monospace"
          >
            {v}
          </text>
        ))}
      </svg>

      {/* legend */}
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-3 rounded-md border border-slate-800 bg-[#08101c]/90 px-2.5 py-2">
        <LegendDot color="bg-white" label="Ground Truth" />
        <LegendDot color="bg-cyan-400" label="Fused" />
        <LegendDot color="bg-violet-400" label="IMU" />
        <LegendDot color="bg-amber-400" label="LoRa" />
      </div>
    </div>
  );
}


function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-1.5 text-[8px] font-mono text-slate-400">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </div>
  );
}


/* =========================================================
   EKF PANEL
========================================================= */

function DashboardEKF({ fusedPosition, ekfState }) {
  return (
    <Panel className="p-4">
      <SectionTitle
        icon={Cpu}
        title="Adaptive EKF"
        subtitle="State estimate"
      />

      <div className="flex items-center justify-center py-3">
        <div className="relative flex h-28 w-28 items-center justify-center rounded-full border border-cyan-400/30">
          <div className="absolute inset-2 rounded-full border border-cyan-400/10" />

          <div className="text-center">
            <div className="text-2xl font-bold text-cyan-300">
              {Number(ekfState?.confidence ?? 0).toFixed(0)}%
            </div>

            <div className="mt-1 text-[8px] font-mono uppercase tracking-widest text-slate-500">
              Confidence
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2 border-t border-slate-800 pt-3">
        <div className="text-[8px] font-mono tracking-widest text-slate-500">
          STATE ESTIMATE
        </div>

        <div className="grid grid-cols-2 gap-2">
          <ValueBox label="X" value={fusedPosition.x} unit="m" />
          <ValueBox label="Y" value={fusedPosition.y} unit="m" />
          <ValueBox label="Vx" value={ekfState?.vx ?? 0} unit="m/s" />
          <ValueBox label="Vy" value={ekfState?.vy ?? 0} unit="m/s" />
        </div>
      </div>

      <div className="mt-3 border-t border-slate-800 pt-3">
        <div className="text-[8px] font-mono tracking-widest text-slate-500">
          COVARIANCE
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <ValueBox
            label="Pxx"
            value={ekfState?.p?.[0]?.[0] ?? 0}
          />

          <ValueBox
            label="Pyy"
            value={ekfState?.p?.[1]?.[1] ?? 0}
          />
        </div>
      </div>

      <div className="mt-3 border-t border-slate-800 pt-3">
        <div className="text-[8px] font-mono tracking-widest text-slate-500">
          ADAPTIVE MEASUREMENT NOISE
        </div>

        <div className="mt-2 flex items-center justify-between rounded-lg bg-[#070d18] px-3 py-2">
          <span className="font-mono text-[9px] text-slate-500">
            R_adapt
          </span>

          <span className="font-mono text-sm text-cyan-300">
            {Number(ekfState?.rValue ?? 0).toFixed(2)}
          </span>
        </div>
      </div>
    </Panel>
  );
}


function ValueBox({ label, value, unit }) {
  return (
    <div className="rounded-md border border-slate-800 bg-[#080f1a] px-2.5 py-2">
      <div className="text-[7px] font-mono text-slate-600">
        {label}
      </div>

      <div className="mt-1 font-mono text-[11px] text-slate-200">
        {typeof value === "number" ? value.toFixed(2) : value}
        {unit && (
          <span className="ml-1 text-[7px] text-slate-600">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}


/* =========================================================
   MINI ANALYTICS
========================================================= */

function MiniChart({ data = [], dataKey, stroke = "#22d3ee" }) {
  const values = data
    .map((x) => Number(x[dataKey]))
    .filter((x) => Number.isFinite(x))
    .slice(-80);

  if (values.length < 2) {
    return (
      <div className="flex h-20 items-center justify-center text-[8px] font-mono text-slate-600">
        WAITING FOR DATA...
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 90 - ((value - min) / range) * 75;

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="h-20 w-full"
    >
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}


function LoRaPanel({ telemetryHistory, packetStats, pleData }) {
  const lastRSSI =
    telemetryHistory.length > 0
      ? telemetryHistory[telemetryHistory.length - 1]?.rssi_anchor_1
      : null;

  return (
    <Panel className="p-4">
      <SectionTitle
        icon={Radio}
        title="LoRa Signal Intelligence"
        subtitle="RSSI / path-loss"
      />

      <div className="grid grid-cols-2 gap-2">
        <SmallMetric
          label="RSSI"
          value={lastRSSI != null ? `${lastRSSI.toFixed(1)} dBm` : "--"}
        />

        <SmallMetric
          label="PACKET LOSS"
          value={`${packetStats.lossRate}%`}
        />

        <SmallMetric
          label="RX RATE"
          value="1 Hz"
        />

        <SmallMetric
          label="ADAPTIVE PLE"
          value={Number(pleData.currentPLE).toFixed(2)}
        />
      </div>

      <div className="mt-3 overflow-hidden rounded-md border border-slate-800 bg-[#070d18] px-2">
        <MiniChart
          data={telemetryHistory}
          dataKey="rssi_anchor_1"
          stroke="#22d3ee"
        />
      </div>

      <div className="mt-2 text-[8px] font-mono text-slate-500">
        PATH-LOSS EXPONENT N ={" "}
        <span className="text-cyan-400">
          {Number(pleData.currentPLE).toFixed(2)}
        </span>
      </div>
    </Panel>
  );
}


function IMUPanel({ imuTelemetry, motionState }) {
  return (
    <Panel className="p-4">
      <SectionTitle
        icon={Activity}
        title="IMU Motion Analysis"
        subtitle="Accelerometer · gyroscope"
      />

      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <SmallMetric
          label="ACCEL X"
          value={`${imuTelemetry.ax.toFixed(2)}`}
        />

        <SmallMetric
          label="ACCEL Y"
          value={`${imuTelemetry.ay.toFixed(2)}`}
        />

        <SmallMetric
          label="ACCEL Z"
          value={`${imuTelemetry.az.toFixed(2)}`}
        />

        <SmallMetric
          label="GYRO Z"
          value={`${imuTelemetry.gz.toFixed(3)}`}
        />
      </div>

      <div className="mt-3 rounded-md border border-violet-500/20 bg-violet-500/5 p-2.5">
        <div className="text-[7px] font-mono tracking-widest text-slate-500">
          MOTION STATE
        </div>

        <div className="mt-1 text-[11px] font-bold text-emerald-400">
          {motionState.state}
        </div>

        <div className="mt-1 text-[8px] font-mono text-slate-500">
          ZUPT: {motionState.isStationary ? "ACTIVE" : "MOVING"}
        </div>
      </div>
    </Panel>
  );
}


function AccuracyPanel({
  positionError,
  imuError,
  loraError,
  telemetryHistory,
}) {
  return (
    <Panel className="p-4">
      <SectionTitle
        icon={Crosshair}
        title="Position Accuracy"
        subtitle="Estimated error"
      />

      <div className="grid grid-cols-2 gap-2">
        <SmallMetric
          label="FUSED ERROR"
          value={`${positionError.toFixed(2)} m`}
        />

        <SmallMetric
          label="TARGET"
          value="< 3.0 m"
        />

        <SmallMetric
          label="IMU DRIFT"
          value={`${imuError.toFixed(2)} m`}
        />

        <SmallMetric
          label="LoRa ERROR"
          value={
            loraError != null
              ? `${loraError.toFixed(2)} m`
              : "--"
          }
        />
      </div>

      <div className="mt-3 overflow-hidden rounded-md border border-slate-800 bg-[#070d18] px-2">
        <MiniChart
          data={telemetryHistory}
          dataKey="position_error"
          stroke="#34d399"
        />
      </div>

      <div className="mt-2 text-[8px] font-mono text-slate-500">
        CONFIDENCE-BASED POSITION ESTIMATION
      </div>
    </Panel>
  );
}


function SmallMetric({ label, value }) {
  return (
    <div className="rounded-md border border-slate-800 bg-[#080f1a] px-2.5 py-2">
      <div className="text-[7px] font-mono tracking-wider text-slate-600">
        {label}
      </div>

      <div className="mt-1 text-[11px] font-mono font-semibold text-slate-200">
        {value}
      </div>
    </div>
  );
}


/* =========================================================
   SIMULATION CONTROLS
========================================================= */

function SimulationControls({
  isRunning,
  environmentKey,
  setEnvironmentKey,
  packetLossRate,
  setPacketLossRate,
  onStart,
  onPause,
  onReset,
}) {
  return (
    <Panel className="p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Gauge size={13} className="text-cyan-400" />

          <span className="text-[8px] font-mono tracking-widest text-slate-500">
            SIMULATION CONTROLS
          </span>
        </div>

        <div className="h-5 w-px bg-slate-800" />

        <select
          value={environmentKey}
          onChange={(e) => setEnvironmentKey(e.target.value)}
          className="rounded-md border border-slate-700 bg-[#070d18] px-2.5 py-1.5 text-[9px] font-mono text-slate-300 outline-none focus:border-cyan-500"
        >
          {Object.keys(ENVIRONMENTS).map((env) => (
            <option key={env} value={env}>
              {env}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono text-slate-500">
            PACKET LOSS
          </span>

          <input
            type="range"
            min="0"
            max="50"
            step="5"
            value={packetLossRate}
            onChange={(e) =>
              setPacketLossRate(Number(e.target.value))
            }
            className="w-24 accent-cyan-400"
          />

          <span className="min-w-[30px] font-mono text-[9px] text-cyan-400">
            {packetLossRate}%
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onStart}
            className="flex items-center gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[8px] font-bold font-mono text-cyan-300 transition hover:bg-cyan-500/20"
          >
            <Play size={11} />
            START
          </button>

          <button
            onClick={onPause}
            className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/40 px-3 py-1.5 text-[8px] font-bold font-mono text-slate-300 transition hover:bg-slate-800"
          >
            <Pause size={11} />
            PAUSE
          </button>

          <button
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/40 px-3 py-1.5 text-[8px] font-bold font-mono text-slate-300 transition hover:bg-slate-800"
          >
            <RotateCcw size={11} />
            RESET
          </button>
        </div>
      </div>

      <div className="mt-2 text-[7px] font-mono text-slate-600">
        {isRunning ? "SIMULATION ACTIVE · 10 Hz" : "SIMULATION PAUSED"}
      </div>
    </Panel>
  );
}


/* =========================================================
   ANCHOR TABLE
========================================================= */

function AnchorStatusTable({ data }) {
  return (
    <Panel className="overflow-hidden">
      <div className="p-4 pb-2">
        <SectionTitle
          icon={Signal}
          title="Live LoRa Anchor Status"
          subtitle="Synchronized anchor telemetry"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left">
          <thead>
            <tr className="border-y border-slate-800 bg-[#080f1a]">
              {[
                "ANCHOR",
                "POSITION",
                "RSSI",
                "TRUE DIST",
                "EST DIST",
                "ERROR",
                "STATUS",
              ].map((heading) => (
                <th
                  key={heading}
                  className="px-4 py-2 text-[7px] font-mono font-semibold tracking-widest text-slate-600"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan="7"
                  className="px-4 py-6 text-center text-[8px] font-mono text-slate-600"
                >
                  WAITING FOR LoRa TELEMETRY...
                </td>
              </tr>
            ) : (
              data.map((anchor) => {
                const error =
                  anchor.estimatedDistance - anchor.trueDistance;

                return (
                  <tr
                    key={anchor.id}
                    className="border-b border-slate-800/70 transition hover:bg-cyan-400/[0.025]"
                  >
                    <td className="px-4 py-2.5 font-mono text-[9px] font-bold text-violet-300">
                      {anchor.id}
                    </td>

                    <td className="px-4 py-2.5 font-mono text-[9px] text-slate-400">
                      ({anchor.x.toFixed(1)}, {anchor.y.toFixed(1)})
                    </td>

                    <td className="px-4 py-2.5 font-mono text-[9px] text-cyan-300">
                      {anchor.rssi.toFixed(1)} dBm
                    </td>

                    <td className="px-4 py-2.5 font-mono text-[9px] text-slate-400">
                      {anchor.trueDistance.toFixed(2)} m
                    </td>

                    <td className="px-4 py-2.5 font-mono text-[9px] text-slate-400">
                      {anchor.estimatedDistance.toFixed(2)} m
                    </td>

                    <td className="px-4 py-2.5 font-mono text-[9px] text-slate-300">
                      {error.toFixed(2)} m
                    </td>

                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-[7px] font-mono text-emerald-400">
                        <span className="h-1 w-1 rounded-full bg-emerald-400" />
                        ONLINE
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}


/* =========================================================
   SENSOR STREAM
========================================================= */

function SensorStream({ history }) {
  const rows = history.slice(-8).reverse();

  return (
    <Panel className="overflow-hidden">
      <div className="p-4 pb-2">
        <SectionTitle
          icon={Database}
          title="Live Sensor Stream"
          subtitle="Synchronized telemetry · simulated"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead>
            <tr className="border-y border-slate-800 bg-[#080f1a]">
              {[
                "TIME",
                "RSSI",
                "ACCEL X",
                "ACCEL Y",
                "ACCEL Z",
                "GYRO X",
                "GYRO Y",
                "GYRO Z",
                "POSITION ERROR",
              ].map((heading) => (
                <th
                  key={heading}
                  className="px-3 py-2 text-[7px] font-mono tracking-widest text-slate-600"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${row.timestamp}-${index}`}
                className="border-b border-slate-800/50"
              >
                <td className="px-3 py-2 font-mono text-[8px] text-cyan-300">
                  {row.timestamp}s
                </td>

                <td className="px-3 py-2 font-mono text-[8px] text-slate-400">
                  {row.rssi_anchor_1 != null
                    ? `${row.rssi_anchor_1.toFixed(1)}`
                    : "--"}
                </td>

                <td className="px-3 py-2 font-mono text-[8px] text-slate-400">
                  {row.ax != null ? row.ax.toFixed(3) : "--"}
                </td>

                <td className="px-3 py-2 font-mono text-[8px] text-slate-400">
                  {row.ay != null ? row.ay.toFixed(3) : "--"}
                </td>

                <td className="px-3 py-2 font-mono text-[8px] text-slate-400">
                  {row.az != null ? row.az.toFixed(3) : "--"}
                </td>

                <td className="px-3 py-2 font-mono text-[8px] text-slate-400">
                  {row.gx != null ? row.gx.toFixed(3) : "--"}
                </td>

                <td className="px-3 py-2 font-mono text-[8px] text-slate-400">
                  {row.gy != null ? row.gy.toFixed(3) : "--"}
                </td>

                <td className="px-3 py-2 font-mono text-[8px] text-slate-400">
                  {row.gz != null ? row.gz.toFixed(3) : "--"}
                </td>

                <td className="px-3 py-2 font-mono text-[8px] text-emerald-400">
                  {row.position_error?.toFixed(2)} m
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}


/* =========================================================
   ARCHITECTURE
========================================================= */

function ArchitectureFlow() {
  const nodes = [
    "6-DoF IMU",
    "Preprocessing",
    "ZUPT / Motion Detection",
    "IMU Dead Reckoning",
    "LoRa RSSI",
    "Adaptive Path-Loss",
    "Adaptive EKF",
    "GPS-Free Position",
  ];

  return (
    <Panel className="p-4">
      <SectionTitle
        icon={GitBranch}
        title="Fusion Architecture"
        subtitle="Real-time estimation pipeline"
      />

      <div className="flex flex-wrap items-center gap-2">
        {nodes.map((node, index) => (
          <React.Fragment key={node}>
            <div className="rounded-md border border-cyan-500/20 bg-cyan-500/[0.04] px-3 py-2 text-[8px] font-mono text-slate-300 transition hover:border-cyan-400/50 hover:bg-cyan-400/[0.06]">
              {node}
            </div>

            {index < nodes.length - 1 && (
              <div className="text-cyan-500/60">
                →
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </Panel>
  );
}


/* =========================================================
   MAIN APP
========================================================= */

export default function App() {
  const [activeTab, setActiveTab] = useState("Dashboard");

  const [isRunning, setIsRunning] = useState(true);

  const [trajectoryType, setTrajectoryType] =
    useState("Circular");

  const [environmentKey, setEnvironmentKey] =
    useState("Open Outdoor");

  const [packetLossRate, setPacketLossRate] =
    useState(5);

  const [anchors, setAnchors] =
    useState(DEFAULT_ANCHORS);

  const [groundTruth, setGroundTruth] = useState({
    x: 25,
    y: 25,
    vx: 0,
    vy: 0,
    heading: 0,
  });

  const [fusedPosition, setFusedPosition] = useState({
    x: 25,
    y: 25,
  });

  const [imuPosition, setImuPosition] = useState({
    x: 25,
    y: 25,
  });

  const [loraPosition, setLoraPosition] = useState({
    x: 25,
    y: 25,
  });

  const [positionError, setPositionError] =
    useState(0.25);

  const [imuError, setImuError] =
    useState(0);

  const [loraError, setLoraError] =
    useState(0);

  const [pleData, setPleData] = useState({
    currentPLE: 2,
    initialPLE: 2,
    status: "STABLE",
    variance: 1,
  });

  const [ekfState, setEkfState] = useState({
    confidence: 94,
    rValue: 4,
    kalmanGain: [0.5, 0.5],
    innovation: [0, 0],
  });

  const [imuTelemetry, setImuTelemetry] =
    useState({
      ax: 0,
      ay: 0,
      az: 9.81,
      gx: 0,
      gy: 0,
      gz: 0,
      heading: 0,
    });

  const [motionState, setMotionState] =
    useState({
      state: "MOVING",
      accelMagnitude: 0.5,
      gyroMagnitude: 0.05,
      isStationary: false,
    });

  const [packetStats, setPacketStats] =
    useState({
      sent: 0,
      received: 0,
      lossRate: 5,
      lastUpdateSec: 0,
    });

  const [anchorTableData, setAnchorTableData] =
    useState([]);

  const [telemetryHistory, setTelemetryHistory] =
    useState([]);

  const ekfRef = useRef(
    new AdaptiveEKF(25, 25)
  );

  const imuReckoningRef = useRef(
    new IMUDeadReckoning({
      x: 25,
      y: 25,
    })
  );

  const pleEstimatorRef = useRef(
    new AdaptivePLEEstimator(2)
  );

  const simTimeRef = useRef(0);

  const loRaTimerRef = useRef(0);

  const demoIntervalRef = useRef(null);


  /* =========================================================
     RESET
  ========================================================= */

  const handleReset = () => {
    simTimeRef.current = 0;
    loRaTimerRef.current = 0;

    const origin = {
      x: 25,
      y: 25,
      vx: 0,
      vy: 0,
      heading: 0,
    };

    setGroundTruth(origin);

    setFusedPosition({
      x: 25,
      y: 25,
    });

    setImuPosition({
      x: 25,
      y: 25,
    });

    setLoraPosition({
      x: 25,
      y: 25,
    });

    ekfRef.current.reset(25, 25);

    imuReckoningRef.current.reset({
      x: 25,
      y: 25,
    });

    pleEstimatorRef.current.reset(
      ENVIRONMENTS[environmentKey].ple
    );

    setTelemetryHistory([]);

    setAnchorTableData([]);

    setPacketStats({
      sent: 0,
      received: 0,
      lossRate: packetLossRate,
      lastUpdateSec: 0,
    });
  };


  /* =========================================================
     DEMO
  ========================================================= */

  const handleRunDemo = () => {
    handleReset();

    setTrajectoryType("Circular");
    setEnvironmentKey("Open Outdoor");
    setIsRunning(true);

    if (demoIntervalRef.current) {
      clearTimeout(demoIntervalRef.current);
    }

    demoIntervalRef.current = setTimeout(() => {
      setActiveTab("Performance");
    }, 15000);
  };


  /* =========================================================
     SIMULATION LOOP
  ========================================================= */

  useEffect(() => {
    if (!isRunning) return;

    const dt = 0.1;

    const interval = setInterval(() => {
      simTimeRef.current += dt;
      loRaTimerRef.current += dt;

      const env = ENVIRONMENTS[environmentKey];

      const gt = generateTrajectoryPoint(
        trajectoryType,
        simTimeRef.current
      );

      setGroundTruth(gt);


      /* -----------------------------
         IMU
      ----------------------------- */

      const imuData = {
        ax:
          gt.ax +
          (Math.random() - 0.5) * 0.08 +
          0.03,

        ay:
          gt.ay +
          (Math.random() - 0.5) * 0.08 -
          0.02,

        az:
          9.81 +
          (Math.random() - 0.5) * 0.05,

        gx:
          (Math.random() - 0.5) * 0.02,

        gy:
          (Math.random() - 0.5) * 0.02,

        gz:
          ((gt.heading * Math.PI) / 180) *
            0.1 +
          (Math.random() - 0.5) * 0.01,
      };

      setImuTelemetry({
        ...imuData,
        heading: gt.heading,
      });


      /* -----------------------------
         MOTION
      ----------------------------- */

      const motion =
        detectMotionState(imuData);

      setMotionState(motion);


      /* -----------------------------
         IMU DEAD RECKONING
      ----------------------------- */

      const imuIntegrated =
        imuReckoningRef.current.integrate(
          imuData,
          dt,
          motion.isStationary
        );

      setImuPosition({
        x: imuIntegrated.x,
        y: imuIntegrated.y,
      });


      /* -----------------------------
         EKF PREDICT
      ----------------------------- */

      ekfRef.current.predict(
        imuData,
        dt
      );


      let currentLoraPos = loraPosition;
      let currentAnchorTable = [];


      /* -----------------------------
         LoRa UPDATE
      ----------------------------- */

      if (loRaTimerRef.current >= 1.0) {
        loRaTimerRef.current = 0;

        setPacketStats((prev) => ({
          ...prev,
          sent: prev.sent + 1,
        }));

        const isDropped =
          Math.random() <
          packetLossRate / 100;


        if (!isDropped) {
          setPacketStats((prev) => ({
            ...prev,
            received: prev.received + 1,
            lastUpdateSec: 0,
          }));


          const anchorObservations =
            anchors.map((anchor) => {
              const trueDist =
                calculateDistance(
                  gt.x,
                  gt.y,
                  anchor.x,
                  anchor.y
                );

              const rssi = calculateRSSI(
                trueDist,
                {
                  rssi0: -40,
                  d0: 1,
                  ple: env.ple,
                  noiseStd: env.rssiNoiseStd,
                  multipathStd:
                    env.multipathStd,
                }
              );

              const estDist =
                rssiToDistance(
                  rssi,
                  -40,
                  pleEstimatorRef.current
                    .currentPLE,
                  1
                );

              return {
                id: anchor.id,
                name: anchor.name,
                x: anchor.x,
                y: anchor.y,
                trueDistance: trueDist,
                rssi,
                estimatedDistance: estDist,
                priorDistance:
                  calculateDistance(
                    fusedPosition.x,
                    fusedPosition.y,
                    anchor.x,
                    anchor.y
                  ),
              };
            });


          currentAnchorTable =
            anchorObservations;

          setAnchorTableData(
            anchorObservations
          );


          /* -----------------------------
             ADAPTIVE PLE
          ----------------------------- */

          const pleResult =
            pleEstimatorRef.current.update(
              anchorObservations,
              -40
            );

          setPleData(pleResult);


          /* -----------------------------
             TRILATERATION
          ----------------------------- */

          const loraResult =
            estimatePositionTrilateration(
              anchorObservations
            );


          if (
            loraResult.success &&
            loraResult.position
          ) {
            currentLoraPos =
              loraResult.position;

            setLoraPosition(
              currentLoraPos
            );

            ekfRef.current.update(
              currentLoraPos,
              {
                rssiVariance:
                  pleResult.variance,

                gdop:
                  loraResult.gdop,

                isPacketDropped:
                  false,
              }
            );
          }
        } else {
          setPacketStats((prev) => ({
            ...prev,
            lastUpdateSec:
              Number(
                (
                  prev.lastUpdateSec +
                  1
                ).toFixed(1)
              ),
          }));

          ekfRef.current.update(
            null,
            {
              isPacketDropped: true,
            }
          );
        }
      }


      /* -----------------------------
         EKF OUTPUT
      ----------------------------- */

      const currentEKFState =
        ekfRef.current.getState();

      const fused = {
        x: currentEKFState.x,
        y: currentEKFState.y,
      };

      setFusedPosition(fused);

      setEkfState(
        currentEKFState
      );


      /* -----------------------------
         ERRORS
      ----------------------------- */

      const currFusedErr =
        calculateDistance(
          fused.x,
          fused.y,
          gt.x,
          gt.y
        );

      const currImuErr =
        calculateDistance(
          imuIntegrated.x,
          imuIntegrated.y,
          gt.x,
          gt.y
        );

      const currLoraErr =
        currentLoraPos
          ? calculateDistance(
              currentLoraPos.x,
              currentLoraPos.y,
              gt.x,
              gt.y
            )
          : null;


      setPositionError(
        currFusedErr
      );

      setImuError(
        currImuErr
      );

      if (currLoraErr !== null) {
        setLoraError(
          currLoraErr
        );
      }


      /* -----------------------------
         TELEMETRY FRAME
      ----------------------------- */

      const frame = {
        timestamp:
          Number(
            simTimeRef.current.toFixed(1)
          ),

        true_x: gt.x,
        true_y: gt.y,

        imu_x: imuIntegrated.x,
        imu_y: imuIntegrated.y,

        lora_x:
          currentLoraPos
            ? currentLoraPos.x
            : null,

        lora_y:
          currentLoraPos
            ? currentLoraPos.y
            : null,

        fused_x: fused.x,
        fused_y: fused.y,

        rssi_anchor_1:
          currentAnchorTable[0]?.rssi ??
          null,

        rssi_anchor_2:
          currentAnchorTable[1]?.rssi ??
          null,

        rssi_anchor_3:
          currentAnchorTable[2]?.rssi ??
          null,

        ple:
          pleEstimatorRef.current
            .currentPLE,

        r_value:
          currentEKFState.rValue,

        kalman_gain:
          currentEKFState.kalmanGain[0],

        position_error:
          Number(
            currFusedErr.toFixed(2)
          ),

        imu_drift_error:
          Number(
            currImuErr.toFixed(2)
          ),

        lora_error:
          currLoraErr !== null
            ? Number(
                currLoraErr.toFixed(2)
              )
            : null,

        /* Added for sensor stream */
        ax: imuData.ax,
        ay: imuData.ay,
        az: imuData.az,
        gx: imuData.gx,
        gy: imuData.gy,
        gz: imuData.gz,
      };


      setTelemetryHistory((prev) => {
        const next = [
          ...prev,
          frame,
        ];

        return next.length > 600
          ? next.slice(-600)
          : next;
      });
    }, 100);

    return () =>
      clearInterval(interval);
  }, [
    isRunning,
    trajectoryType,
    environmentKey,
    packetLossRate,
    anchors,
  ]);


  /* =========================================================
     ANCHOR FUNCTIONS
  ========================================================= */

  const handleAnchorMove = (
    id,
    newX,
    newY
  ) => {
    setAnchors((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              x: newX,
              y: newY,
            }
          : a
      )
    );
  };


  const handleAddAnchor = (
    anchor
  ) => {
    const id =
      `A${anchors.length + 1}`;

    setAnchors((prev) => [
      ...prev,
      {
        ...anchor,
        id,
      },
    ]);
  };


  const handleDeleteAnchor = (
    id
  ) => {
    if (anchors.length <= 3) {
      alert(
        "Cannot delete anchor. Minimum 3 anchors required for 2D trilateration."
      );

      return;
    }

    setAnchors((prev) =>
      prev.filter(
        (a) => a.id !== id
      )
    );
  };


  /* =========================================================
     NAVIGATION
  ========================================================= */

  const tabs = [
    "Dashboard",
    "Simulation",
    "Anchors",
    "Sensor Data",
    "EKF Fusion",
    "Performance",
    "Architecture",
  ];


  /* =========================================================
     DASHBOARD
  ========================================================= */

  const DashboardView = () => (
    <div className="space-y-3">

      {/* METRIC CARDS */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">

        <MetricCard
          icon={Activity}
          label="SYSTEM STATUS"
          value={isRunning ? "RUNNING" : "PAUSED"}
          subtitle="10 Hz"
          accent="green"
        />

        <MetricCard
          icon={Navigation}
          label="GPS"
          value="DISABLED"
          subtitle="GPS-DENIED OPERATION"
        />

        <MetricCard
          icon={Radio}
          label="LoRa 868 MHz"
          value="CONNECTED"
          subtitle={`Loss: ${packetLossRate}% · 1 Hz Rx`}
          accent="cyan"
        />

        <MetricCard
          icon={Cpu}
          label="6-DoF IMU"
          value="ACTIVE"
          subtitle={`ZUPT: ${
            motionState.isStationary
              ? "STATIONARY"
              : "MOVING"
          }`}
          accent="violet"
        />

        <MetricCard
          icon={Zap}
          label="ADAPTIVE EKF"
          value={`${Number(
            ekfState.confidence ?? 0
          ).toFixed(0)}% CONF`}
          subtitle={`R_adapt = ${Number(
            ekfState.rValue ?? 0
          ).toFixed(2)}`}
        />

        <MetricCard
          icon={Crosshair}
          label="POSITION ERROR"
          value={`${positionError.toFixed(
            2
          )} m`}
          subtitle="FUSED ESTIMATE"
          accent="green"
        />
      </div>


      {/* MAIN VISUALIZATION */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,2fr)_350px]">

        <Panel className="p-4">

          <SectionTitle
            icon={Navigation}
            title="Real-Time Coordinate Telemetry"
            subtitle="Local frame · 50 × 50 m · 10 Hz"
          />

          <CoordinateMap
            groundTruth={groundTruth}
            fusedPosition={fusedPosition}
            imuPosition={imuPosition}
            loraPosition={loraPosition}
            anchors={anchors}
            history={telemetryHistory}
          />

          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">

            <CoordinateStat
              title="GROUND TRUTH"
              x={groundTruth.x}
              y={groundTruth.y}
            />

            <CoordinateStat
              title="FUSED ESTIMATE"
              x={fusedPosition.x}
              y={fusedPosition.y}
              error={positionError}
              accent="cyan"
            />

            <CoordinateStat
              title="IMU ONLY"
              x={imuPosition.x}
              y={imuPosition.y}
              error={imuError}
              accent="violet"
            />

            <CoordinateStat
              title="LoRa ONLY"
              x={loraPosition.x}
              y={loraPosition.y}
              error={loraError}
              accent="amber"
            />

          </div>
        </Panel>


        {/* EKF */}
        <DashboardEKF
          fusedPosition={fusedPosition}
          ekfState={ekfState}
        />

      </div>


      {/* ANALYTICS */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">

        <LoRaPanel
          telemetryHistory={telemetryHistory}
          packetStats={packetStats}
          pleData={pleData}
        />

        <IMUPanel
          imuTelemetry={imuTelemetry}
          motionState={motionState}
        />

        <AccuracyPanel
          positionError={positionError}
          imuError={imuError}
          loraError={loraError}
          telemetryHistory={telemetryHistory}
        />

      </div>


      {/* CONTROLS */}
      <SimulationControls
        isRunning={isRunning}
        environmentKey={environmentKey}
        setEnvironmentKey={
          setEnvironmentKey
        }
        packetLossRate={
          packetLossRate
        }
        setPacketLossRate={
          setPacketLossRate
        }
        onStart={() =>
          setIsRunning(true)
        }
        onPause={() =>
          setIsRunning(false)
        }
        onReset={handleReset}
      />


      {/* ANCHORS */}
      <AnchorStatusTable
        data={anchorTableData}
      />


      {/* SENSOR STREAM */}
      <SensorStream
        history={telemetryHistory}
      />


      {/* ARCHITECTURE */}
      <ArchitectureFlow />

    </div>
  );


  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100">

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#070a12]/95 backdrop-blur-xl">

        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3">

          <div className="flex items-center gap-3">

            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/5 font-mono text-xs font-bold text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,.08)]">
              AE
            </div>

            <div>
              <div className="font-mono text-[13px] font-bold tracking-tight text-slate-100">
                Adaptive LoRa–IMU Fusion
              </div>

              <div className="mt-0.5 font-mono text-[8px] tracking-widest text-cyan-500/80">
                GPS-FREE REAL-TIME POSITIONING
              </div>
            </div>

          </div>


          <div className="hidden items-center gap-4 md:flex">

            <div className="flex items-center gap-2 font-mono text-[8px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.8)]" />
              <span className="text-emerald-400">
                SYSTEM ONLINE
              </span>
            </div>

            <div className="font-mono text-[8px] text-slate-500">
              10 Hz
            </div>

            <div className="rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1 font-mono text-[7px] text-amber-400">
              GPS DENIED
            </div>

          </div>

        </div>
      </header>


      {/* NAVIGATION */}
      <div className="border-b border-slate-800/70 bg-[#080d17]">

        <div className="mx-auto max-w-[1500px] overflow-x-auto px-4">

          <nav className="flex min-w-max items-center gap-1 py-2">

            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() =>
                  setActiveTab(tab)
                }
                className={`
                  rounded-md px-3 py-1.5
                  font-mono text-[8px]
                  transition-all
                  ${
                    activeTab === tab
                      ? "border border-cyan-500/25 bg-cyan-500/10 text-cyan-300"
                      : "border border-transparent text-slate-500 hover:bg-slate-800/50 hover:text-slate-300"
                  }
                `}
              >
                {tab}
              </button>
            ))}

          </nav>

        </div>
      </div>


      {/* MAIN */}
      <main className="mx-auto w-full max-w-[1500px] px-3 py-3 sm:px-4 lg:px-5">

        {/* EXPORT */}
        <div className="mb-3 flex justify-end gap-2">

          <button
            onClick={() =>
              exportToCSV(
                telemetryHistory
              )
            }
            className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-[#0b1220] px-2.5 py-1.5 font-mono text-[8px] text-slate-400 transition hover:border-cyan-500/30 hover:text-cyan-300"
          >
            <Download size={11} />
            EXPORT CSV
          </button>

          <button
            onClick={() =>
              exportToJSON(
                telemetryHistory
              )
            }
            className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-[#0b1220] px-2.5 py-1.5 font-mono text-[8px] text-slate-400 transition hover:border-violet-500/30 hover:text-violet-300"
          >
            <Download size={11} />
            EXPORT JSON
          </button>

        </div>


        {/* DASHBOARD */}
        {activeTab === "Dashboard" && (
          <DashboardView />
        )}


        {/* SIMULATION */}
        {activeTab === "Simulation" && (
          <SimulationMap
            anchors={anchors}
            onAnchorMove={
              handleAnchorMove
            }
            groundTruth={groundTruth}
            fusedPosition={fusedPosition}
            imuPosition={imuPosition}
            loraPosition={loraPosition}
            history={telemetryHistory}
            isRunning={isRunning}
            onStart={() =>
              setIsRunning(true)
            }
            onPause={() =>
              setIsRunning(false)
            }
            onReset={handleReset}
            trajectoryType={
              trajectoryType
            }
            onTrajectoryChange={
              setTrajectoryType
            }
            onRunDemo={
              handleRunDemo
            }
            onIntroduceInterference={() => {
              setEnvironmentKey(
                "High Multipath"
              );

              setPacketLossRate(20);
            }}
            onSimulatePacketLoss={() =>
              setPacketLossRate(50)
            }
          />
        )}


        {/* ANCHORS */}
        {activeTab === "Anchors" && (
          <AnchorPanel
            anchors={anchors}
            onAddAnchor={
              handleAddAnchor
            }
            onDeleteAnchor={
              handleDeleteAnchor
            }
          />
        )}


        {/* SENSOR DATA */}
        {activeTab === "Sensor Data" && (
          <SensorData
            history={
              telemetryHistory
            }
          />
        )}


        {/* EKF */}
        {activeTab === "EKF Fusion" && (
          <EKFPanel
            fusedPosition={
              fusedPosition
            }
            loraPosition={
              loraPosition
            }
            ekfState={ekfState}
            pleData={pleData}
          />
        )}


        {/* PERFORMANCE */}
        {activeTab === "Performance" && (
          <PerformancePanel
            history={
              telemetryHistory
            }
          />
        )}


        {/* ARCHITECTURE */}
        {activeTab === "Architecture" && (
          <SystemArchitecture />
        )}

      </main>
    </div>
  );
}


/* =========================================================
   COORDINATE STAT
========================================================= */

function CoordinateStat({
  title,
  x,
  y,
  error,
  accent = "slate",
}) {
  const color =
    accent === "cyan"
      ? "text-cyan-300"
      : accent === "violet"
      ? "text-violet-300"
      : accent === "amber"
      ? "text-amber-300"
      : "text-slate-200";

  return (
    <div className="rounded-md border border-slate-800 bg-[#080f1a] px-3 py-2">

      <div className="text-[7px] font-mono tracking-widest text-slate-600">
        {title}
      </div>

      <div className={`mt-1.5 font-mono text-[10px] ${color}`}>
        X {x.toFixed(2)} m
      </div>

      <div className={`font-mono text-[10px] ${color}`}>
        Y {y.toFixed(2)} m
      </div>

      {error !== undefined && (
        <div className="mt-1 text-[7px] font-mono text-slate-600">
          ERROR {error.toFixed(2)} m
        </div>
      )}

    </div>
  );
}