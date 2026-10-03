import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

const RANGES = [
  { label: '1m',  points: 30       },
  { label: '5m',  points: 150      },
  { label: '15m', points: 450      },
  { label: 'All', points: Infinity },
];

// ── Custom light tooltip ─────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const v      = payload[0].value;
  const isCrit = v > 800;
  const isWarn = v >= 500 && v <= 800;
  const col    = isCrit ? '#e11d48' : isWarn ? '#d97706' : '#059669';
  const border = isCrit ? '#fecdd3' : isWarn ? '#fde68a' : '#a7f3d0';
  return (
    <div className="bg-white border rounded-lg px-3 py-2.5 shadow-lg" style={{ borderColor: border }}>
      <p className="text-[10px] text-slate-400 font-medium mb-1 uppercase tracking-widest">{label} IST</p>
      <p className="font-mono text-[15px] font-bold tabular-nums" style={{ color: col }}>
        {v.toLocaleString()}
        <span className="text-[10px] font-normal text-slate-400 ml-1">ADC</span>
      </p>
    </div>
  );
}

function ChartDefs() {
  return (
    <defs>
      <linearGradient id="gasGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.2} />
        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.01} />
      </linearGradient>
    </defs>
  );
}

function RefLabel({ viewBox, color, text }) {
  const x = (viewBox?.x ?? 0) + (viewBox?.width ?? 0) - 6;
  const y = (viewBox?.y ?? 0) - 5;
  return (
    <text x={x} y={y} textAnchor="end" fill={color}
      fontSize={9} fontWeight={700} fontFamily="JetBrains Mono, monospace">
      {text}
    </text>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function TrendChart({ data = [] }) {
  const [rangeIdx, setRangeIdx] = useState(3);

  const visible = useMemo(() => {
    const pts = RANGES[rangeIdx].points;
    return pts === Infinity ? data : data.slice(-pts);
  }, [data, rangeIdx]);

  const maxVal  = visible.length ? Math.max(...visible.map(d => d.value), 1000) : 1000;
  const yDomain = [0, Math.ceil(maxVal * 1.12 / 100) * 100];

  return (
    <div className="card flex flex-col h-full relative">
      {/* ── Card header ───────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-indigo-50 flex items-center justify-center">
            <TrendingUp size={11} className="text-indigo-500" strokeWidth={2.5} />
          </div>
          <span className="text-[12px] font-semibold text-slate-800">Real-Time Gas Trend</span>
          <span className="font-mono text-[10px] text-slate-400 ml-1">{visible.length} pts</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Legend */}
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 border-t border-dashed border-amber-400" />
              <span className="text-amber-600 font-semibold">Warn 500</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 border-t border-dashed border-rose-400" />
              <span className="text-rose-600 font-semibold">Danger 800</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 rounded-full bg-indigo-500" />
              <span className="text-slate-500">ADC</span>
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200" />

          {/* Time-range toggles */}
          <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg border border-slate-200 p-0.5">
            {RANGES.map((r, i) => (
              <button
                key={r.label}
                onClick={() => setRangeIdx(i)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  i === rangeIdx
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Chart ─────────────────────────────────── */}
      <div className="flex-1 px-2 py-3 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={visible} margin={{ top: 14, right: 30, left: 0, bottom: 0 }}>
            <ChartDefs />

            <CartesianGrid strokeDasharray="3 4" stroke="#f1f5f9" vertical={false} />

            <XAxis
              dataKey="time"
              tick={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', fill: '#94a3b8' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              interval="preserveStartEnd"
              minTickGap={48}
            />
            <YAxis
              domain={yDomain}
              tick={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={v => v >= 1000 ? `${v / 1000}k` : v}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }} />

            <ReferenceLine y={500} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.5}
              label={<RefLabel color="#d97706" text="Warn 500" />} />
            <ReferenceLine y={800} stroke="#f43f5e" strokeDasharray="4 3" strokeWidth={1.5}
              label={<RefLabel color="#e11d48" text="Danger 800" />} />

            <Area
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              strokeWidth={2}
              fill="url(#gasGrad)"
              dot={false}
              activeDot={{ r: 3.5, fill: '#6366f1', strokeWidth: 0 }}
              isAnimationActive
              animationDuration={400}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {data.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-[12px] text-slate-400">
          Awaiting sensor data…
        </div>
      )}
    </div>
  );
}
