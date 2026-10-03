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
  const value      = payload[0].value;
  const isWarning  = value >= 500 && value <= 800;
  const isCritical = value > 800;

  const textColor   = isCritical ? 'text-red-600'   : isWarning ? 'text-amber-600'   : 'text-emerald-600';
  const borderColor = isCritical ? 'border-red-200' : isWarning ? 'border-amber-200' : 'border-emerald-200';
  const dotColor    = isCritical ? 'bg-red-400'     : isWarning ? 'bg-amber-400'     : 'bg-emerald-400';

  return (
    <div className={`bg-white border ${borderColor} rounded-lg shadow-lg px-3 py-2.5`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotColor}`} />
        <p className="text-[11px] text-slate-400 font-medium">{label} IST</p>
      </div>
      <p className={`font-mono text-[16px] font-bold tabular-nums ${textColor}`}>
        {value.toLocaleString()}
        <span className="text-[11px] font-normal text-slate-400 ml-1.5">ADC</span>
      </p>
    </div>
  );
}

function ChartGradient() {
  return (
    <defs>
      <linearGradient id="gasGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.2} />
        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
      </linearGradient>
    </defs>
  );
}

function RefLineLabel({ color, viewBox, labelText }) {
  return (
    <text
      x={(viewBox?.width ?? 0) + (viewBox?.x ?? 0) - 6}
      y={(viewBox?.y ?? 0) - 5}
      textAnchor="end"
      fill={color}
      fontSize={10}
      fontWeight={700}
      fontFamily="JetBrains Mono, monospace"
    >
      {labelText}
    </text>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function TrendChart({ data = [] }) {
  const maxValue = data.length ? Math.max(...data.map(d => d.value), 1000) : 1000;
  const yDomain  = [0, Math.ceil(maxValue * 1.12 / 100) * 100];

  return (
    // Left indigo border accent to colour-code the card
    <div className="card flex flex-col h-full relative border-l-[3px] border-l-indigo-400">
      {/* Card header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-indigo-50">
            <TrendingUp size={13} className="text-indigo-500" strokeWidth={2.5} />
          </div>
          <h2 className="text-[13px] font-semibold text-slate-800">Gas Level Trend</h2>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[11px] font-medium text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-dashed border-amber-400" />
            <span className="text-amber-600 font-semibold">Warn 500</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t-2 border-dashed border-red-400" />
            <span className="text-red-600 font-semibold">Danger 800</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded-full bg-indigo-500" />
            <span>Gas ADC</span>
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 px-2 py-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 14, right: 28, left: 0, bottom: 0 }}>
            <ChartGradient />

            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              interval="preserveStartEnd"
              minTickGap={44}
            />
            <YAxis
              domain={yDomain}
              tick={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              width={42}
              tickFormatter={v => v.toLocaleString()}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }} />

            <ReferenceLine
              y={500}
              stroke="#f59e0b"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              label={<RefLineLabel color="#d97706" labelText="Warn 500" />}
            />
            <ReferenceLine
              y={800}
              stroke="#ef4444"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              label={<RefLineLabel color="#dc2626" labelText="Danger 800" />}
            />

            <Area
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#gasGradient)"
              dot={false}
              activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
              isAnimationActive
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {data.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-[13px] text-slate-400">
          Awaiting sensor data…
        </div>
      )}
    </div>
  );
}
