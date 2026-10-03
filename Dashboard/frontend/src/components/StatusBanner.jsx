import { AlertTriangle, CheckCircle2, Flame, BarChart2, Zap, TrendingUp } from 'lucide-react';

// ── Severity helpers ─────────────────────────────────────────────────────────

export function getSeverity(value) {
  if (value < 500) return 'normal';
  if (value <= 800) return 'warning';
  return 'critical';
}

const SEVERITY_CONFIG = {
  normal: {
    label:        'Normal / Safe',
    subLabel:     'Gas levels within acceptable limits.',
    ledLabel:     'GREEN',
    ledClass:     'led-green',
    badgeBg:      'bg-emerald-50',
    badgeBorder:  'border-emerald-200',
    badgeText:    'text-emerald-700',
    valueText:    'text-slate-900',
    valueBg:      'bg-slate-50',
    valueBorder:  'border-slate-200',
    stripBg:      null,
    Icon:         CheckCircle2,
    iconColor:    'text-emerald-500',
  },
  warning: {
    label:        'Leakage Detected — Warning',
    subLabel:     'Gas concentration is elevated. Inspect the area.',
    ledLabel:     'AMBER',
    ledClass:     'led-amber',
    badgeBg:      'bg-amber-50',
    badgeBorder:  'border-amber-200',
    badgeText:    'text-amber-700',
    valueText:    'text-amber-700',
    valueBg:      'bg-amber-50',
    valueBorder:  'border-amber-200',
    stripBg:      null,
    Icon:         AlertTriangle,
    iconColor:    'text-amber-500',
  },
  critical: {
    label:        'DANGER — Critical Leakage',
    subLabel:     'Evacuate immediately! Gas levels are critically high.',
    ledLabel:     'RED',
    ledClass:     'led-red',
    badgeBg:      'bg-red-50',
    badgeBorder:  'border-red-300',
    badgeText:    'text-red-700',
    valueText:    'text-red-600',
    valueBg:      'bg-red-50',
    valueBorder:  'border-red-300',
    stripBg:      'bg-red-600',
    Icon:         Flame,
    iconColor:    'text-red-500',
  },
};

// ── Sub-components ───────────────────────────────────────────────────────────

function LEDIndicator({ config }) {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
        RGB LED
      </p>
      <div className="flex items-center gap-3 px-5 py-3 bg-slate-950 rounded-xl border border-slate-800 shadow-inner">
        <span
          className={`inline-block w-5 h-5 rounded-full flex-shrink-0 ${config.ledClass}`}
          aria-label={`LED: ${config.ledLabel}`}
        />
        <span className="font-mono text-[13px] font-semibold tracking-[0.2em] text-slate-200">
          {config.ledLabel}
        </span>
      </div>
    </div>
  );
}

function GasValueDisplay({ value, config }) {
  return (
    <div className={`flex flex-col items-center justify-center px-10 py-5 rounded-xl border-2 ${config.valueBorder} ${config.valueBg}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
        Current Gas Level
      </p>
      <div className="flex items-end gap-2">
        <span className={`font-mono text-6xl font-bold leading-none tabular-nums ${config.valueText}`}>
          {value.toLocaleString()}
        </span>
        <span className="text-[14px] font-semibold text-slate-400 mb-1.5">ADC</span>
      </div>
    </div>
  );
}

function SeverityBadge({ config }) {
  const { Icon, iconColor, label, subLabel, badgeBg, badgeBorder, badgeText } = config;
  return (
    <div className={`flex items-start gap-3 px-4 py-2.5 rounded-lg border ${badgeBorder} ${badgeBg}`}>
      <Icon size={16} className={`${iconColor} flex-shrink-0 mt-0.5`} strokeWidth={2.5} />
      <div>
        <p className={`text-[12px] font-bold leading-tight ${badgeText}`}>{label}</p>
        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{subLabel}</p>
      </div>
    </div>
  );
}

function ThresholdGuide() {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">
        Thresholds
      </p>
      {[
        { color: 'bg-emerald-500', label: '< 500', desc: 'Normal' },
        { color: 'bg-amber-400',   label: '500–800', desc: 'Warning' },
        { color: 'bg-red-500',     label: '> 800',  desc: 'Critical' },
      ].map(({ color, label, desc }) => (
        <div key={desc} className="flex items-center gap-2.5">
          <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
          <span className="font-mono text-[11px] text-slate-500 tabular-nums">{label}</span>
          <span className="text-[11px] text-slate-400">—</span>
          <span className="text-[11px] text-slate-600 font-medium">{desc}</span>
        </div>
      ))}
    </div>
  );
}

// Stat tile with a coloured top border accent
function StatTile({ label, value, unit, accentClass, icon: Icon, iconClass }) {
  return (
    <div className={`flex flex-col gap-1 px-4 py-3 bg-white rounded-xl border border-slate-200 border-t-2 ${accentClass} shadow-sm`}>
      <div className="flex items-center gap-1.5">
        <Icon size={11} className={iconClass} strokeWidth={2.5} />
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      </div>
      <p className="font-mono text-[22px] font-bold tabular-nums leading-tight text-slate-900">
        {value}
        {unit && <span className="text-[12px] font-normal text-slate-400 ml-1">{unit}</span>}
      </p>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function StatusBanner({
  currentValue = 0,
  peakToday    = 0,
  sampleCount  = 0,
  alertCount   = 0,
}) {
  const severity = getSeverity(currentValue);
  const config   = SEVERITY_CONFIG[severity];
  const peakSev  = getSeverity(peakToday);

  return (
    <div className="card flex-shrink-0 overflow-hidden">
      {/* Critical alert strip */}
      {config.stripBg && (
        <div className={`flex items-center justify-center gap-2 ${config.stripBg} px-4 py-1.5`}>
          <Flame size={12} className="text-white" strokeWidth={2.5} />
          <p className="text-[11px] font-bold text-white tracking-[0.12em] uppercase">
            Critical Alert — Immediate Action Required
          </p>
          <Flame size={12} className="text-white" strokeWidth={2.5} />
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto_auto] divide-x divide-slate-100">

        {/* ── Column 1: Gas value + status ─────────────── */}
        <div className="flex flex-col items-center justify-center gap-3 px-8 py-5">
          <GasValueDisplay value={currentValue} config={config} />
          <SeverityBadge config={config} />
        </div>

        {/* ── Column 2: LED + threshold legend ─────────── */}
        <div className="flex flex-col items-center justify-center gap-5 px-8 py-5 bg-slate-50/60">
          <LEDIndicator config={config} />
          <div className="w-full h-px bg-slate-200" />
          <ThresholdGuide />
        </div>

        {/* ── Column 3: Quick stats ─────────────────────── */}
        <div className="flex flex-col justify-center gap-3 px-8 py-5">
          <StatTile
            label="Peak Today"
            value={peakToday.toLocaleString()}
            unit="ADC"
            accentClass={
              peakSev === 'critical' ? 'border-t-red-400'
              : peakSev === 'warning' ? 'border-t-amber-400'
              : 'border-t-emerald-400'
            }
            icon={TrendingUp}
            iconClass={
              peakSev === 'critical' ? 'text-red-400'
              : peakSev === 'warning' ? 'text-amber-400'
              : 'text-emerald-400'
            }
          />
          <StatTile
            label="Samples Taken"
            value={sampleCount.toLocaleString()}
            accentClass="border-t-indigo-400"
            icon={BarChart2}
            iconClass="text-indigo-400"
          />
          <StatTile
            label="Alert Events"
            value={alertCount}
            accentClass={alertCount > 0 ? 'border-t-red-400' : 'border-t-slate-300'}
            icon={Zap}
            iconClass={alertCount > 0 ? 'text-red-400' : 'text-slate-300'}
          />
        </div>

      </div>
    </div>
  );
}
