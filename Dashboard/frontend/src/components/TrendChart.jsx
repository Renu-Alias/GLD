import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { formatTime } from '../lib/format';

const RANGES = [
  { label: '30s', ms: 30_000 },
  { label: '1m', ms: 60_000 },
  { label: '5m', ms: 300_000 },
  { label: 'All', ms: Infinity },
];

const DEFAULT_THRESHOLDS = { warning: 500, danger: 800, adcMax: 1023 };

const sevColor = (v, t) =>
  (v >= t.danger ? 'var(--c-crit)' : v >= t.warning ? 'var(--c-warn)' : 'var(--c-safe)');
const sevBg = (v, t) =>
  (v >= t.danger ? 'var(--c-crit-bg)' : v >= t.warning ? 'var(--c-warn-bg)' : 'var(--c-safe-bg)');
const sevBorder = (v, t) =>
  (v >= t.danger ? 'var(--c-crit-border)' : v >= t.warning ? 'var(--c-warn-border)' : 'var(--c-safe-border)');

function CustomTooltip({ active, payload, thresholds }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const v = point.value;
  return (
    <div
      className="rounded-lg px-3 py-2.5 shadow-lg"
      style={{ background: '#fff', border: `1px solid ${sevBorder(v, thresholds)}` }}
    >
      <p className="text-[10px] font-medium mb-1 uppercase tracking-widest" style={{ color: 'var(--c-muted)' }}>
        {formatTime(point.t)} IST
      </p>
      <p className="font-mono text-[15px] font-bold tabular-nums" style={{ color: sevColor(v, thresholds) }}>
        {v.toLocaleString()}
        <span className="text-[10px] font-normal ml-1" style={{ color: 'var(--c-muted)' }}>ADC</span>
      </p>
    </div>
  );
}

function ChartDefs() {
  return (
    <defs>
      <linearGradient id="gasGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#2878A8" stopOpacity={0.18} />
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

export default function TrendChart({
  data = [],
  thresholds = DEFAULT_THRESHOLDS,
  sampleIntervalMs = null,
}) {
  const [rangeIdx, setRangeIdx] = useState(3);
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };

  // Time-window slicing (the previous version sliced by a fixed point count,
  // which silently mislabelled the ranges once the sample rate changed).
  const visible = useMemo(() => {
    const windowMs = RANGES[rangeIdx].ms;
    if (windowMs === Infinity) return data;
    if (data.length === 0) return data;
    const cutoff = data[data.length - 1].t - windowMs;
    const sliced = data.filter((d) => d.t >= cutoff);
    return sliced.length > 1 ? sliced : data.slice(-2);
  }, [data, rangeIdx]);

  const maxVal = visible.length
    ? Math.max(...visible.map((d) => d.value), t.danger * 1.1)
    : t.adcMax;
  const yDomain = [0, Math.min(t.adcMax, Math.ceil(maxVal * 1.12 / 100) * 100)];

  const warnColor = '#D99A24';
  const critColor = '#D64550';

  return (
    <div className="card flex flex-col h-full relative">
      <div
        className="flex items-center justify-between px-4 pt-3.5 pb-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--c-border)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: '#EBF3FA' }}>
            <TrendingUp size={11} strokeWidth={2.5} style={{ color: '#2878A8' }} />
          </div>
          <span className="text-[12px] font-semibold" style={{ color: 'var(--c-navy)' }}>
            Real-Time Gas Trend
          </span>
          <span className="font-mono text-[10px] ml-1" style={{ color: 'var(--c-muted)' }}>
            {visible.length} pts
            {sampleIntervalMs ? ` @ ${sampleIntervalMs} ms` : ''}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4" style={{ borderTop: '1.5px dashed #D99A24' }} />
              <span className="font-semibold" style={{ color: warnColor }}>Warn {t.warning}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4" style={{ borderTop: '1.5px dashed #D64550' }} />
              <span className="font-semibold" style={{ color: critColor }}>Danger {t.danger}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-0.5 rounded-full" style={{ background: '#2878A8' }} />
              <span style={{ color: 'var(--c-muted)' }}>ADC</span>
            </span>
          </div>

          <div className="h-4" style={{ width: 1, background: 'var(--c-border)' }} />

          <div
            className="flex items-center gap-0.5 rounded-lg p-0.5"
            style={{ background: '#F4F6F8', border: '1px solid var(--c-border)' }}
          >
            {RANGES.map((r, i) => (
              <button
                key={r.label}
                onClick={() => setRangeIdx(i)}
                className="px-2.5 py-1 rounded-md text-[10px] font-bold transition-all"
                style={i === rangeIdx ? { background: 'var(--c-navy)', color: '#fff' } : { color: 'var(--c-muted)' }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 px-2 py-3 min-h-0">
        {visible.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={visible} margin={{ top: 14, right: 30, left: 0, bottom: 0 }}>
              <ChartDefs />

              <CartesianGrid strokeDasharray="3 4" stroke="#E5E9EE" vertical={false} />

              <XAxis
                dataKey="t"
                tickFormatter={formatTime}
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
                tickFormatter={v => (v >= 1000 ? `${v / 1000}k` : v)}
              />

              <Tooltip content={<CustomTooltip thresholds={t} />} cursor={{ stroke: '#DCE2E8', strokeWidth: 1 }} />

              <ReferenceLine
                y={t.warning}
                stroke={warnColor}
                strokeDasharray="4 3"
                strokeWidth={1.5}
                label={<RefLabel color={warnColor} text={`Warn ${t.warning}`} />}
              />
              <ReferenceLine
                y={t.danger}
                stroke={critColor}
                strokeDasharray="4 3"
                strokeWidth={1.5}
                label={<RefLabel color={critColor} text={`Danger ${t.danger}`} />}
              />

              <Area
                type="monotone"
                dataKey="value"
                stroke="#2878A8"
                strokeWidth={2}
                fill="url(#gasGrad)"
                dot={false}
                activeDot={{ r: 3.5, fill: '#2878A8', strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {data.length === 0 && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[12px]"
          style={{ color: 'var(--c-muted)' }}
        >
          <TrendingUp size={22} strokeWidth={1.5} />
          <p className="font-semibold">No telemetry received yet</p>
          <p className="text-[10px]">The trend appears as soon as the ESP32 sends its first reading</p>
        </div>
      )}
    </div>
  );
}