import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

// ── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const value = payload[0].value;
  const isWarning  = value >= 500 && value <= 800;
  const isCritical = value > 800;
  const textColor  = isCritical ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-emerald-600';
  const borderColor = isCritical ? 'border-red-200' : isWarning ? 'border-amber-200' : 'border-emerald-200';

  return (
    <div className={`bg-white border ${borderColor} rounded-lg shadow-lg px-3 py-2`}>
      <p className="text-[11px] text-slate-400 font-medium mb-0.5">{label} IST</p>
      <p className={`font-mono text-[15px] font-semibold tabular-nums ${textColor}`}>
        {value.toLocaleString()}
        <span className="text-[11px] font-normal text-slate-400 ml-1">ADC</span>
      </p>
    </div>
  );
}

// ── Gradient color by severity (injected into SVG defs) ──────────────────────

function ChartGradient() {
  return (
    <defs>
      <linearGradient id="gasGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
      </linearGradient>
    </defs>
  );
}

// ── Label for reference lines ────────────────────────────────────────────────

function RefLineLabel({ value, color, viewBox, labelText }) {
  return (
    <text
      x={(viewBox?.width ?? 0) + (viewBox?.x ?? 0) - 4}
      y={(viewBox?.y ?? 0) - 5}
      textAnchor="end"
      fill={color}
      fontSize={10}
      fontWeight={600}
      fontFamily="JetBrains Mono, monospace"
    >
      {labelText || value}
    </text>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

/**
 * TrendChart — smooth area chart showing gas ADC values over time.
 * Includes horizontal threshold reference lines for Warning (500) and Danger (800).
 *
 * Props:
 *   data  {Array<{ time: string, value: number }>}  — time-series data points
 */
export default function TrendChart({ data = [] }) {
  // Y-axis domain: at minimum 0–1000 to always show both thresholds
  const maxValue  = data.length ? Math.max(...data.map(d => d.value), 1000) : 1000;
  const yDomain   = [0, Math.ceil(maxValue * 1.12 / 100) * 100];

  return (
    <div className="card flex flex-col h-full">
      {/* Card header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-indigo-500" strokeWidth={2} />
          <h2 className="text-[13px] font-semibold text-slate-800">Gas Level Trend</h2>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 text-[11px] font-medium text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 border-t-2 border-dashed border-amber-400" />
            Warning 500
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-5 border-t-2 border-dashed border-red-400" />
            Danger 800
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded-full bg-indigo-500" />
            Gas Value
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 px-3 py-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 24, left: 0, bottom: 0 }}>
            <ChartGradient />

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#f1f5f9"
              vertical={false}
            />

            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              interval="preserveStartEnd"
              minTickGap={40}
            />

            <YAxis
              domain={yDomain}
              tick={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={v => v.toLocaleString()}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1.5 }} />

            {/* Warning threshold */}
            <ReferenceLine
              y={500}
              stroke="#f59e0b"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              label={<RefLineLabel color="#f59e0b" labelText="Warn 500" />}
            />

            {/* Danger threshold */}
            <ReferenceLine
              y={800}
              stroke="#ef4444"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              label={<RefLineLabel color="#ef4444" labelText="Danger 800" />}
            />

            <Area
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#gasGradient)"
              dot={false}
              activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
              isAnimationActive={true}
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Empty state */}
      {data.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-[13px] text-slate-400">
          Awaiting sensor data…
        </div>
      )}
    </div>
  );
}
