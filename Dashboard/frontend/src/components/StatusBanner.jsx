import { AlertTriangle, CheckCircle2, Flame } from 'lucide-react';

// ── Severity helpers ─────────────────────────────────────────────────────────

/**
 * Derives severity tier from raw gas ADC value.
 * @param {number} value
 * @returns {'normal'|'warning'|'critical'}
 */
export function getSeverity(value) {
  if (value < 500) return 'normal';
  if (value <= 800) return 'warning';
  return 'critical';
}

/** Per-severity display tokens */
const SEVERITY_CONFIG = {
  normal: {
    label:          'Normal / Safe',
    subLabel:       'Gas levels within acceptable limits.',
    ledLabel:       'GREEN',
    ledClass:       'led-green',
    ledBg:          'bg-emerald-500',
    badgeBg:        'bg-emerald-50',
    badgeBorder:    'border-emerald-200',
    badgeText:      'text-emerald-700',
    valueBg:        'bg-slate-50',
    valueText:      'text-slate-900',
    bannerBg:       '',
    bannerBorder:   'border-slate-200',
    Icon:           CheckCircle2,
    iconColor:      'text-emerald-500',
  },
  warning: {
    label:          'Leakage Detected — Warning',
    subLabel:       'Gas concentration is elevated. Inspect the area.',
    ledLabel:       'AMBER',
    ledClass:       'led-amber',
    ledBg:          'bg-amber-400',
    badgeBg:        'bg-amber-50',
    badgeBorder:    'border-amber-200',
    badgeText:      'text-amber-700',
    valueBg:        'bg-amber-50',
    valueText:      'text-amber-700',
    bannerBg:       'bg-amber-50',
    bannerBorder:   'border-amber-300',
    Icon:           AlertTriangle,
    iconColor:      'text-amber-500',
  },
  critical: {
    label:          'DANGER — Critical Leakage',
    subLabel:       'Evacuate immediately! Gas levels are critically high.',
    ledLabel:       'RED',
    ledClass:       'led-red',
    ledBg:          'bg-red-500',
    badgeBg:        'bg-red-50',
    badgeBorder:    'border-red-300',
    badgeText:      'text-red-700',
    valueBg:        'bg-red-50',
    valueText:      'text-red-600',
    bannerBg:       'bg-red-50',
    bannerBorder:   'border-red-400',
    Icon:           Flame,
    iconColor:      'text-red-500',
  },
};

// ── Sub-components ───────────────────────────────────────────────────────────

/** Glowing RGB LED pill */
function LEDIndicator({ config }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
        RGB LED Status
      </p>
      <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-950 rounded-xl border border-slate-800">
        {/* The glowing LED orb — ledClass applies the CSS glow keyframe animation */}
        <span
          className={`inline-block w-5 h-5 rounded-full ${config.ledClass}`}
          aria-label={`LED color: ${config.ledLabel}`}
        />
        <span className="font-mono text-[13px] font-medium tracking-widest text-slate-200">
          {config.ledLabel}
        </span>
      </div>
    </div>
  );
}

/** Large numeric gas value display */
function GasValueDisplay({ value, config }) {
  return (
    <div className={`flex flex-col items-center justify-center px-8 py-5 rounded-xl border ${config.bannerBorder} ${config.bannerBg || 'bg-white'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
        Current Gas Value
      </p>
      <div className="flex items-end gap-2">
        <span className={`font-mono text-6xl font-bold leading-none tabular-nums ${config.valueText}`}>
          {value.toLocaleString()}
        </span>
        <span className="text-[13px] font-medium text-slate-400 mb-1.5">ADC</span>
      </div>
    </div>
  );
}

/** Status / severity badge */
function SeverityBadge({ config }) {
  const { Icon, iconColor, label, subLabel, badgeBg, badgeBorder, badgeText } = config;
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${badgeBorder} ${badgeBg}`}>
      <Icon size={18} className={`${iconColor} flex-shrink-0 mt-0.5`} strokeWidth={2} />
      <div>
        <p className={`text-[13px] font-semibold leading-tight ${badgeText}`}>{label}</p>
        <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">{subLabel}</p>
      </div>
    </div>
  );
}

/** Mini stat tile */
function StatTile({ label, value, unit, accent = 'text-slate-900' }) {
  return (
    <div className="flex flex-col gap-0.5 px-4 py-3 bg-white rounded-xl border border-slate-200">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`font-mono text-[22px] font-semibold tabular-nums leading-tight ${accent}`}>
        {value}
        {unit && <span className="text-[13px] font-normal text-slate-400 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

/**
 * StatusBanner — primary focal point showing current gas value, severity,
 * LED state, and quick stats.
 *
 * Props:
 *   currentValue  {number}  — raw ADC gas sensor reading
 *   peakToday     {number}  — highest reading in the current session
 *   sampleCount   {number}  — total readings taken this session
 *   alertCount    {number}  — number of alert events
 */
export default function StatusBanner({
  currentValue = 0,
  peakToday    = 0,
  sampleCount  = 0,
  alertCount   = 0,
}) {
  const severity = getSeverity(currentValue);
  const config   = SEVERITY_CONFIG[severity];

  // Critical: show a high-contrast top alert strip
  const showCriticalStrip = severity === 'critical';

  return (
    <div className={`card flex-shrink-0 overflow-hidden`}>
      {/* Critical alert strip */}
      {showCriticalStrip && (
        <div className="flex items-center justify-center gap-2 bg-red-600 px-4 py-1.5">
          <Flame size={13} className="text-white" strokeWidth={2.5} />
          <p className="text-[12px] font-bold text-white tracking-wider uppercase">
            Critical Alert — Immediate Action Required
          </p>
          <Flame size={13} className="text-white" strokeWidth={2.5} />
        </div>
      )}

      <div className="flex items-stretch gap-0 divide-x divide-slate-100">
        {/* ── Gas value + severity ─────────────────── */}
        <div className="flex flex-col items-center justify-center gap-3 px-8 py-5 flex-1">
          <GasValueDisplay value={currentValue} config={config} />
          <SeverityBadge config={config} />
        </div>

        {/* ── LED indicator ───────────────────────── */}
        <div className="flex flex-col items-center justify-center gap-3 px-8 py-5">
          <LEDIndicator config={config} />

          {/* Threshold guide */}
          <div className="flex flex-col gap-1 mt-1 text-[11px] text-slate-500 font-mono">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>&lt; 500 — Normal</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>500 – 800 — Warning</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
              <span>&gt; 800 — Critical</span>
            </div>
          </div>
        </div>

        {/* ── Quick stats ─────────────────────────── */}
        <div className="flex flex-col justify-center gap-3 px-8 py-5">
          <StatTile
            label="Peak Today"
            value={peakToday.toLocaleString()}
            unit="ADC"
            accent={getSeverity(peakToday) === 'critical' ? 'text-red-600' : getSeverity(peakToday) === 'warning' ? 'text-amber-600' : 'text-slate-900'}
          />
          <StatTile label="Samples Taken" value={sampleCount.toLocaleString()} />
          <StatTile
            label="Alert Events"
            value={alertCount}
            accent={alertCount > 0 ? 'text-red-600' : 'text-slate-900'}
          />
        </div>
      </div>
    </div>
  );
}
