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

// ── Custom tooltip ────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const v      = payload[0].value;
  const isCrit = v > 800;
  const isWarn = v >= 500 && v <= 800;
  const color  = isCrit ? 'var(--c-crit)' : isWarn ? 'var(--c-warn)' : 'var(--c-safe)';
  const border = isCrit ? 'var(--c-crit-border)' : isWarn ? 'var(--c-warn-border)' : 'var(--c-safe-border)';
  const bg     = isCrit ? 'var(--c-crit-bg)'    : isWarn ? 'var(--c-warn-bg)'    : 'var(--c-safe-bg)';
  return (
    <div
      className="rounded-lg px-3 py-2.5 shadow-lg"
      style={{ background: '#fff', border: `1px solid ${border}` }}
    >
      <p className="text-[10px] font-medium mb-1 uppercase tracking-widest" style={{ color: 'var(--c-muted)' }}>
        {label} IST
      </p>
      <p className="font-mono text-[15px] font-bold tabular-nums" style={{ color }}>
        {v.toLocaleString()}
        <span className="text-[10px] font-normal ml-1" style={{ color: 'var(--c-muted)' }}>ADC</span>
      </p>
    </div>
  );
}

// ── SVG gradient — uses the brand blue line colour ────────────────────────────
function ChartDefs() {
  return (
    <defs>
      <linearGradient id="gasGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor="#2878A8" stopOpacity={0.18} />
        <stop offset="100%" stopColor="#2878A8" stopOpacity={0.01} />
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
      <div
        className="flex items-center justify-between px-4 pt-3.5 pb-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--c-border)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center"
            style={{ background: '#EBF3FA' }}
          >
            <TrendingUp size={11} strokeWidth={2.5} style={{ color: '#2878A8' }} />
          </div>
          <span className="text-[12px] font-semibold" style={{ color: 'var(--c-navy)' }}>
            Real-Time Gas Trend
          </span>
          <span className="font-mono text-[10px] ml-1" style={{ color: 'var(--c-muted)' }}>
            {visible.length} pts
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Legend */}
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-4"
                style={{ borderTop: '1.5px dashed var(--c-warn)' }}
              />
              <span className="font-semibold" style={{ color: 'var(--c-warn)' }}>Warn 500</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-4"
                style={{ borderTop: '1.5px dashed var(--c-crit)' }}
              />
              <span className="font-semibold" style={{ color: 'var(--c-crit)' }}>Danger 800</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-0.5 rounded-full"
                style={{ background: '#2878A8' }}
              />
              <span style={{ color: 'var(--c-muted)' }}>ADC</span>
            </span>
          </div>

          <div className="h-4" style={{ width: 1, background: 'var(--c-border)' }} />

          {/* Time-range toggles */}
          <div
            className="flex items-center gap-0.5 rounded-lg p-0.5"
            style={{ background: '#F4F6F8', border: '1px solid var(--c-border)' }}
          >
            {RANGES.map((r, i) => (
              <button
                key={r.label}
                onClick={() => setRangeIdx(i)}
                className="px-2.5 py-1 rounded-md text-[10px] font-bold transition-all"
                style={
                  i === rangeIdx
                    ? { background: 'var(--c-navy)', color: '#fff' }
                    : { color: 'var(--c-muted)' }
                }
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

            <CartesianGrid strokeDasharray="3 4" stroke="#E5E9EE" vertical={false} />

            <XAxis
              dataKey="time"
              tick={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', fill: '#7A8699' }}
              tickLine={false}
              axisLine={{ stroke: '#E5E9EE' }}
              interval="preserveStartEnd"
              minTickGap={48}
            />
            <YAxis
              domain={yDomain}
              tick={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', fill: '#7A8699' }}
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={v => v >= 1000 ? `${v / 1000}k` : v}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#DCE2E8', strokeWidth: 1 }} />

            {/* Warning threshold — #D99A24 */}
            <ReferenceLine
              y={500}
              stroke="#D99A24"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={<RefLabel color="#D99A24" text="Warn 500" />}
            />
            {/* Critical threshold — #D64550 */}
            <ReferenceLine
              y={800}
              stroke="#D64550"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={<RefLabel color="#D64550" text="Danger 800" />}
            />

            {/* Gas reading line — #2878A8 */}
            <Area
              type="monotone"
              dataKey="value"
              stroke="#2878A8"
              strokeWidth={2}
              fill="url(#gasGrad)"
              dot={false}
              activeDot={{ r: 3.5, fill: '#2878A8', strokeWidth: 0 }}
              isAnimationActive
              animationDuration={400}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {data.length === 0 && (
        <div
          className="absolute inset-0 flex items-center justify-center text-[12px]"
          style={{ color: 'var(--c-muted)' }}
        >
          Awaiting sensor data…
        </div>
      )}
    </div>
  );
}
