import { AlertTriangle, CheckCircle2, Flame, TrendingUp, BarChart2, Zap, ShieldCheck } from 'lucide-react';

// ── Severity helpers ─────────────────────────────────────────────────────────

export function getSeverity(value) {
  if (value < 500) return 'normal';
  if (value <= 800) return 'warning';
  return 'critical';
}

// All colours reference the CSS custom properties defined in index.css
const SEV = {
  normal: {
    label:        'Normal / Safe',
    subLabel:     'All readings within acceptable limits.',
    ledClass:     'led-green',
    ledLabel:     'GREEN',
    ledTextColor: 'var(--c-safe)',
    valueColor:   'var(--c-navy)',
    valueBg:      'var(--c-safe-bg)',
    valueBorder:  'var(--c-safe-border)',
    badgeBg:      'var(--c-safe-bg)',
    badgeBorder:  'var(--c-safe-border)',
    badgeColor:   'var(--c-safe)',
    stripBg:      null,
    Icon:         CheckCircle2,
  },
  warning: {
    label:        'Leakage Detected — Warning',
    subLabel:     'Elevated concentration. Inspect the area.',
    ledClass:     'led-amber',
    ledLabel:     'AMBER',
    ledTextColor: 'var(--c-warn)',
    valueColor:   'var(--c-warn)',
    valueBg:      'var(--c-warn-bg)',
    valueBorder:  'var(--c-warn-border)',
    badgeBg:      'var(--c-warn-bg)',
    badgeBorder:  'var(--c-warn-border)',
    badgeColor:   'var(--c-warn)',
    stripBg:      null,
    Icon:         AlertTriangle,
  },
  critical: {
    label:        'DANGER — Critical Leakage',
    subLabel:     'Evacuate immediately!',
    ledClass:     'led-red',
    ledLabel:     'RED',
    ledTextColor: 'var(--c-crit)',
    valueColor:   'var(--c-crit)',
    valueBg:      'var(--c-crit-bg)',
    valueBorder:  'var(--c-crit-border)',
    badgeBg:      'var(--c-crit-bg)',
    badgeBorder:  'var(--c-crit-border)',
    badgeColor:   'var(--c-crit)',
    stripBg:      'var(--c-crit)',
    Icon:         Flame,
  },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function GasValueDisplay({ value, sev }) {
  return (
    <div
      className="flex flex-col items-center justify-center px-8 py-4 rounded-xl"
      style={{
        background:   sev.valueBg,
        border:       `2px solid ${sev.valueBorder}`,
      }}
    >
      <span className="kpi-label mb-2">Current Gas Level</span>
      <div className="flex items-end gap-2 leading-none">
        {/* Gas level number uses navy per spec regardless of severity */}
        <span
          className="font-mono text-[64px] font-bold tabular-nums leading-none"
          style={{ color: 'var(--c-navy)' }}
        >
          {value.toLocaleString()}
        </span>
        <span className="font-mono text-[14px] font-semibold mb-2" style={{ color: 'var(--c-muted)' }}>
          ADC
        </span>
      </div>
      {/* Accent underline using gas level card accent colour */}
      <div
        className="mt-2 rounded-full"
        style={{ height: 3, width: 48, background: 'var(--c-accent)' }}
      />
    </div>
  );
}

function StatusBadge({ sev }) {
  const { Icon, badgeBg, badgeBorder, badgeColor, label, subLabel } = sev;
  return (
    <div
      className="flex items-start gap-2.5 px-4 py-2.5 rounded-lg w-full"
      style={{ background: badgeBg, border: `1px solid ${badgeBorder}` }}
    >
      <Icon size={15} className="flex-shrink-0 mt-0.5" style={{ color: badgeColor }} strokeWidth={2.5} />
      <div>
        <p className="text-[12px] font-bold leading-tight" style={{ color: badgeColor }}>{label}</p>
        <p className="text-[11px] leading-tight mt-0.5" style={{ color: 'var(--c-muted)' }}>{subLabel}</p>
      </div>
    </div>
  );
}

function LEDModule({ sev }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="kpi-label">RGB LED Status</span>
      <div
        className="flex items-center gap-3 px-5 py-3 rounded-xl"
        style={{ background: '#172033', border: '1px solid #2E4068' }}
      >
        <span className={`w-5 h-5 ${sev.ledClass}`} aria-label={`LED: ${sev.ledLabel}`} />
        <span
          className="font-mono text-[13px] font-bold tracking-[0.2em]"
          style={{ color: sev.ledTextColor }}
        >
          {sev.ledLabel}
        </span>
      </div>
    </div>
  );
}

function ThresholdTable() {
  const rows = [
    { color: 'var(--c-crit)', range: '> 800',   label: 'Critical' },
    { color: 'var(--c-warn)', range: '500–800', label: 'Warning'  },
    { color: 'var(--c-safe)', range: '< 500',   label: 'Safe'     },
  ];
  return (
    <div className="flex flex-col gap-2">
      <span className="kpi-label mb-0.5">Threshold Reference</span>
      {rows.map(r => (
        <div key={r.label} className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
          <span className="font-mono text-[11px] tabular-nums w-14" style={{ color: 'var(--c-muted)' }}>
            {r.range}
          </span>
          <span className="text-[11px] font-semibold" style={{ color: r.color }}>{r.label}</span>
        </div>
      ))}
    </div>
  );
}

function KpiCard({ label, value, unit, sub, accentColor, Icon: Ic }) {
  return (
    <div
      className="flex flex-col gap-1 px-4 py-3 bg-white rounded-xl shadow-sm"
      style={{
        border:      `1px solid var(--c-border)`,
        borderTop:   `2px solid ${accentColor}`,
      }}
    >
      <div className="flex items-center gap-1.5">
        <Ic size={10} strokeWidth={2.5} style={{ color: accentColor }} />
        <span className="kpi-label">{label}</span>
      </div>
      <p className="font-mono text-[22px] font-bold tabular-nums leading-tight" style={{ color: 'var(--c-navy)' }}>
        {value}
        {unit && <span className="text-[11px] font-normal ml-1" style={{ color: 'var(--c-muted)' }}>{unit}</span>}
      </p>
      {sub && <p className="text-[10px] font-medium leading-tight" style={{ color: 'var(--c-muted)' }}>{sub}</p>}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function StatusBanner({ currentValue = 0, peakToday = 0, sampleCount = 0, alertCount = 0 }) {
  const sev     = SEV[getSeverity(currentValue)];
  const peakSev = getSeverity(peakToday);

  const peakAccent = peakSev === 'critical' ? 'var(--c-crit)'
    : peakSev === 'warning' ? 'var(--c-warn)'
    : 'var(--c-safe)';

  return (
    <div className="card flex-shrink-0 overflow-hidden">
      {/* Critical strip */}
      {sev.stripBg && (
        <div
          className="flex items-center justify-center gap-2 py-1.5"
          style={{ background: sev.stripBg }}
        >
          <Flame size={11} className="text-white" strokeWidth={3} />
          <span className="text-[11px] font-black text-white tracking-[0.15em] uppercase">
            Critical Alert — Immediate Action Required
          </span>
          <Flame size={11} className="text-white" strokeWidth={3} />
        </div>
      )}

      {/* 3-column grid */}
      <div
        className="grid grid-cols-[200px_1fr_280px]"
        style={{ borderTop: sev.stripBg ? undefined : 'none' }}
      >
        {/* Col 1: Threshold reference */}
        <div
          className="flex flex-col justify-center px-5 py-4"
          style={{ borderRight: `1px solid var(--c-border)`, background: '#FAFBFC' }}
        >
          <ThresholdTable />
        </div>

        {/* Col 2: Gas value + status badge */}
        <div
          className="flex flex-col items-center justify-center gap-3 px-8 py-5"
          style={{ borderRight: `1px solid var(--c-border)` }}
        >
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
              accentColor={peakAccent}
              Icon={TrendingUp}
            />
            <div className="grid grid-cols-2 gap-2">
              <KpiCard
                label="Samples"
                value={sampleCount.toLocaleString()}
                sub="1 sample / 2s"
                accentColor="var(--c-accent)"
                Icon={BarChart2}
              />
              <KpiCard
                label="Alerts"
                value={alertCount}
                sub={alertCount > 0 ? 'Critical events' : 'All clear'}
                accentColor={alertCount > 0 ? 'var(--c-crit)' : 'var(--c-border)'}
                Icon={alertCount > 0 ? Zap : ShieldCheck}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
