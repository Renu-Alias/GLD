import { AlertTriangle, CheckCircle2, Flame, TrendingUp, BarChart2, Zap, ShieldCheck } from 'lucide-react';

// ── Severity helpers ─────────────────────────────────────────────────────────

export function getSeverity(value) {
  if (value < 500) return 'normal';
  if (value <= 800) return 'warning';
  return 'critical';
}

const SEV = {
  normal: {
    label:       'Normal / Safe',
    subLabel:    'All readings within acceptable limits.',
    ledClass:    'led-green',
    ledLabel:    'GREEN',
    ledTextColor:'text-emerald-400',
    valueColor:  'text-slate-900',
    valueBg:     'bg-emerald-50',
    valueBorder: 'border-emerald-200',
    badgeBg:     'bg-emerald-50',
    badgeBorder: 'border-emerald-200',
    badgeText:   'text-emerald-700',
    stripBg:     null,
    Icon:        CheckCircle2,
  },
  warning: {
    label:       'Leakage Detected — Warning',
    subLabel:    'Elevated concentration. Inspect the area.',
    ledClass:    'led-amber',
    ledLabel:    'AMBER',
    ledTextColor:'text-amber-500',
    valueColor:  'text-amber-700',
    valueBg:     'bg-amber-50',
    valueBorder: 'border-amber-200',
    badgeBg:     'bg-amber-50',
    badgeBorder: 'border-amber-200',
    badgeText:   'text-amber-700',
    stripBg:     null,
    Icon:        AlertTriangle,
  },
  critical: {
    label:       'DANGER — Critical Leakage',
    subLabel:    'Evacuate immediately!',
    ledClass:    'led-red',
    ledLabel:    'RED',
    ledTextColor:'text-rose-400',
    valueColor:  'text-rose-600',
    valueBg:     'bg-rose-50',
    valueBorder: 'border-rose-200',
    badgeBg:     'bg-rose-50',
    badgeBorder: 'border-rose-300',
    badgeText:   'text-rose-700',
    stripBg:     'bg-red-600',
    Icon:        Flame,
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function GasValueDisplay({ value, sev }) {
  return (
    <div className={`flex flex-col items-center justify-center px-8 py-4 rounded-xl border-2 ${sev.valueBorder} ${sev.valueBg}`}>
      <span className="kpi-label mb-2">Current Gas Level</span>
      <div className="flex items-end gap-2 leading-none">
        <span className={`font-mono text-[64px] font-bold tabular-nums leading-none ${sev.valueColor}`}>
          {value.toLocaleString()}
        </span>
        <span className="font-mono text-[14px] font-semibold text-slate-400 mb-2">ADC</span>
      </div>
    </div>
  );
}

function StatusBadge({ sev }) {
  const { Icon, badgeBg, badgeBorder, badgeText, label, subLabel } = sev;
  return (
    <div className={`flex items-start gap-2.5 px-4 py-2.5 rounded-lg border ${badgeBorder} ${badgeBg} w-full`}>
      <Icon size={15} className={`${badgeText} flex-shrink-0 mt-0.5`} strokeWidth={2.5} />
      <div>
        <p className={`text-[12px] font-bold leading-tight ${badgeText}`}>{label}</p>
        <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{subLabel}</p>
      </div>
    </div>
  );
}

/** Physical LED module — intentionally uses a dark housing to represent hardware */
function LEDModule({ sev }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="kpi-label">RGB LED Status</span>
      <div className="flex items-center gap-3 px-5 py-3 bg-slate-900 rounded-xl border border-slate-700">
        <span className={`w-5 h-5 ${sev.ledClass}`} aria-label={`LED: ${sev.ledLabel}`} />
        <span className={`font-mono text-[13px] font-bold tracking-[0.2em] ${sev.ledTextColor}`}>
          {sev.ledLabel}
        </span>
      </div>
    </div>
  );
}

function ThresholdTable() {
  const rows = [
    { dot: 'bg-rose-500',    range: '> 800',   label: 'Critical', text: 'text-rose-600'    },
    { dot: 'bg-amber-400',   range: '500–800', label: 'Warning',  text: 'text-amber-600'   },
    { dot: 'bg-emerald-500', range: '< 500',   label: 'Safe',     text: 'text-emerald-700' },
  ];
  return (
    <div className="flex flex-col gap-2">
      <span className="kpi-label mb-0.5">Threshold Reference</span>
      {rows.map(r => (
        <div key={r.label} className="flex items-center gap-2.5">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${r.dot}`} />
          <span className="font-mono text-[11px] text-slate-500 tabular-nums w-14">{r.range}</span>
          <span className={`text-[11px] font-semibold ${r.text}`}>{r.label}</span>
        </div>
      ))}
    </div>
  );
}

function KpiCard({ label, value, unit, sub, accentClass, Icon: Ic, iconClass }) {
  return (
    <div className={`flex flex-col gap-1 px-4 py-3 bg-white rounded-xl border border-slate-200 border-t-2 ${accentClass} shadow-sm`}>
      <div className="flex items-center gap-1.5">
        <Ic size={10} className={iconClass} strokeWidth={2.5} />
        <span className="kpi-label">{label}</span>
      </div>
      <p className="font-mono text-[22px] font-bold tabular-nums text-slate-900 leading-tight">
        {value}
        {unit && <span className="text-[11px] font-normal text-slate-400 ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-[10px] text-slate-400 font-medium leading-tight">{sub}</p>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function StatusBanner({ currentValue = 0, peakToday = 0, sampleCount = 0, alertCount = 0 }) {
  const sev     = SEV[getSeverity(currentValue)];
  const peakSev = getSeverity(peakToday);

  return (
    <div className="card flex-shrink-0 overflow-hidden">
      {/* Critical strip */}
      {sev.stripBg && (
        <div className={`flex items-center justify-center gap-2 ${sev.stripBg} py-1.5`}>
          <Flame size={11} className="text-white" strokeWidth={3} />
          <span className="text-[11px] font-black text-white tracking-[0.15em] uppercase">
            Critical Alert — Immediate Action Required
          </span>
          <Flame size={11} className="text-white" strokeWidth={3} />
        </div>
      )}

      {/* 3-column grid: threshold | gas value | LED + KPIs */}
      <div className="grid grid-cols-[200px_1fr_280px] divide-x divide-slate-200">

        {/* Col 1: Threshold reference */}
        <div className="flex flex-col justify-center px-5 py-4 bg-slate-50/70">
          <ThresholdTable />
        </div>

        {/* Col 2: Primary gas value + status badge */}
        <div className="flex flex-col items-center justify-center gap-3 px-8 py-5">
          <GasValueDisplay value={currentValue} sev={sev} />
          <StatusBadge sev={sev} />
        </div>

        {/* Col 3: LED module + KPI cards */}
        <div className="flex flex-col justify-center gap-4 px-5 py-4">
          <LEDModule sev={sev} />
          <div className="divider-h" />
          <div className="grid grid-cols-1 gap-2">
            <KpiCard
              label="Peak Today"
              value={peakToday.toLocaleString()}
              unit="ADC"
              accentClass={
                peakSev === 'critical' ? 'border-t-rose-500'
                : peakSev === 'warning' ? 'border-t-amber-500'
                : 'border-t-emerald-500'
              }
              Icon={TrendingUp}
              iconClass={
                peakSev === 'critical' ? 'text-rose-500'
                : peakSev === 'warning' ? 'text-amber-500'
                : 'text-emerald-500'
              }
            />
            <div className="grid grid-cols-2 gap-2">
              <KpiCard
                label="Samples"
                value={sampleCount.toLocaleString()}
                sub="1 sample / 2s"
                accentClass="border-t-indigo-500"
                Icon={BarChart2}
                iconClass="text-indigo-500"
              />
              <KpiCard
                label="Alerts"
                value={alertCount}
                sub={alertCount > 0 ? 'Critical events' : 'All clear'}
                accentClass={alertCount > 0 ? 'border-t-rose-500' : 'border-t-slate-300'}
                Icon={alertCount > 0 ? Zap : ShieldCheck}
                iconClass={alertCount > 0 ? 'text-rose-500' : 'text-slate-400'}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
