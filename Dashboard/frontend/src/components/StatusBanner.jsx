import {
  AlertTriangle, CheckCircle2, Flame, TrendingUp, BarChart2, Zap, ShieldCheck, VolumeX, Thermometer,
} from 'lucide-react';
import { formatSampleInterval } from '../lib/format';

const DEFAULT_THRESHOLDS = { warning: 500, danger: 800 };

export function getSeverity(value, thresholds = DEFAULT_THRESHOLDS) {
  if (value == null) return 'normal';
  if (value >= thresholds.danger) return 'critical';
  if (value >= thresholds.warning) return 'warning';
  return 'normal';
}

const SEV = {
  normal: {
    label: 'Normal / Safe',
    subLabel: 'LPG concentration within acceptable limits.',
    ledClass: 'led-green',
    ledLabel: 'GREEN',
    ledTextColor: 'var(--c-safe)',
    valueBg: 'var(--c-safe-bg)',
    valueBorder: 'var(--c-safe-border)',
    badgeBg: 'var(--c-safe-bg)',
    badgeBorder: 'var(--c-safe-border)',
    badgeColor: 'var(--c-safe)',
    stripBg: null,
    Icon: CheckCircle2,
  },
  warning: {
    label: 'Leakage Detected - Warning',
    subLabel: 'Elevated concentration. Inspect the area.',
    ledClass: 'led-amber',
    ledLabel: 'AMBER',
    ledTextColor: 'var(--c-warn)',
    valueBg: 'var(--c-warn-bg)',
    valueBorder: 'var(--c-warn-border)',
    badgeBg: 'var(--c-warn-bg)',
    badgeBorder: 'var(--c-warn-border)',
    badgeColor: 'var(--c-warn)',
    stripBg: null,
    Icon: AlertTriangle,
  },
  critical: {
    label: 'DANGER - Critical Leakage',
    subLabel: 'Evacuate immediately!',
    ledClass: 'led-red',
    ledLabel: 'RED',
    ledTextColor: 'var(--c-crit)',
    valueBg: 'var(--c-crit-bg)',
    valueBorder: 'var(--c-crit-border)',
    badgeBg: 'var(--c-crit-bg)',
    badgeBorder: 'var(--c-crit-border)',
    badgeColor: 'var(--c-crit)',
    stripBg: 'var(--c-crit)',
    Icon: Flame,
  },
};

function GasValueDisplay({ value, sev, hasData }) {
  return (
    <div
      className="flex flex-col items-center justify-center px-8 py-4 rounded-xl"
      style={{ background: sev.valueBg, border: `2px solid ${sev.valueBorder}` }}
    >
      <span className="kpi-label mb-2">Current Gas Level</span>
      <div className="flex items-end gap-2 leading-none">
        <span
          className="font-mono text-[64px] font-bold tabular-nums leading-none"
          style={{ color: hasData ? 'var(--c-navy)' : 'var(--c-muted)' }}
        >
          {hasData ? value.toLocaleString() : '--'}
        </span>
        <span className="font-mono text-[14px] font-semibold mb-2" style={{ color: 'var(--c-muted)' }}>
          ADC
        </span>
      </div>
      <div
        className="mt-2 rounded-full"
        style={{ height: 3, width: 48, background: '#2878A8' }}
      />
    </div>
  );
}

function StatusBadge({ sev, hasData, warmup, muted }) {
  const { Icon, badgeBg, badgeBorder, badgeColor, label, subLabel } = sev;

  const detail = !hasData
    ? 'No reading has been received from the sensor yet.'
    : warmup
      ? 'MQ-6 still stabilising - readings are excluded from the incident log.'
      : muted
        ? 'Buzzer muted from the board. LED still shows the real condition.'
        : subLabel;

  return (
    <div
      className="flex items-start gap-2.5 px-4 py-2.5 rounded-lg w-full"
      style={{ background: badgeBg, border: `1px solid ${badgeBorder}` }}
    >
      <Icon size={15} className="flex-shrink-0 mt-0.5" style={{ color: badgeColor }} strokeWidth={2.5} />
      <div className="flex-1">
        <p className="text-[12px] font-bold leading-tight" style={{ color: badgeColor }}>
          {hasData ? label : 'Awaiting Sensor'}
        </p>
        <p className="text-[11px] leading-tight mt-0.5" style={{ color: 'var(--c-muted)' }}>{detail}</p>
      </div>
      {hasData && muted && <VolumeX size={13} strokeWidth={2.5} style={{ color: badgeColor }} />}
      {hasData && warmup && <Thermometer size={13} strokeWidth={2.5} style={{ color: badgeColor }} />}
    </div>
  );
}

function LEDModule({ sev, hasData }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="kpi-label">RGB LED Status</span>
      <div
        className="flex items-center gap-3 px-5 py-3 rounded-xl"
        style={{ background: '#172033', border: '1px solid #2E4068' }}
      >
        {hasData ? (
          <>
            <span className={`w-5 h-5 ${sev.ledClass}`} aria-label={`LED: ${sev.ledLabel}`} />
            <span className="font-mono text-[13px] font-bold tracking-[0.2em]" style={{ color: sev.ledTextColor }}>
              {sev.ledLabel}
            </span>
          </>
        ) : (
          <>
            <span className="w-5 h-5 rounded-full opacity-30" style={{ background: '#7A8699' }} />
            <span className="font-mono text-[13px] font-bold tracking-[0.2em]" style={{ color: '#7A8699' }}>
              OFFLINE
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function ThresholdTable({ thresholds }) {
  const { warning, danger, adcMax } = thresholds;
  const rows = [
    { color: 'var(--c-crit)', range: `>= ${danger}`, label: 'Critical' },
    { color: 'var(--c-warn)', range: `${warning} - ${danger - 1}`, label: 'Warning' },
    { color: 'var(--c-safe)', range: `< ${warning}`, label: 'Safe' },
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
      <p className="text-[9px] font-medium leading-tight mt-0.5" style={{ color: 'var(--c-muted)' }}>
        Reported by the ESP32 over serial (0-{adcMax} ADC)
      </p>
    </div>
  );
}

function KpiCard({ label, value, unit, sub, accentColor, Icon: Ic }) {
  return (
    <div
      className="flex flex-col gap-1 px-4 py-3 bg-white rounded-xl shadow-sm"
      style={{ border: `1px solid var(--c-border)`, borderTop: `2px solid ${accentColor}` }}
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

export default function StatusBanner({
  currentValue = null,
  peakValue = 0,
  sampleCount = 0,
  alertCount = 0,
  thresholds = DEFAULT_THRESHOLDS,
  sampleIntervalMs = null,
  hasData = false,
  muted = false,
  warmup = false,
}) {
  const sev = SEV[getSeverity(currentValue, thresholds)];
  const peakSev = getSeverity(peakValue, thresholds);

  const peakAccent = peakSev === 'critical' ? 'var(--c-crit)'
    : peakSev === 'warning' ? 'var(--c-warn)'
    : 'var(--c-safe)';

  const cadence = formatSampleInterval(sampleIntervalMs);

  return (
    <div className="card flex-shrink-0 overflow-hidden">
      {sev.stripBg && (
        <div className="flex items-center justify-center gap-2 py-1.5" style={{ background: sev.stripBg }}>
          <Flame size={11} className="text-white" strokeWidth={3} />
          <span className="text-[11px] font-black text-white tracking-[0.15em] uppercase">
            Critical Alert - Immediate Action Required
          </span>
          <Flame size={11} className="text-white" strokeWidth={3} />
        </div>
      )}

      <div className="grid grid-cols-[200px_1fr_280px]">
        <div
          className="flex flex-col justify-center px-5 py-4"
          style={{ borderRight: `1px solid var(--c-border)`, background: '#FAFBFC' }}
        >
          <ThresholdTable thresholds={thresholds} />
        </div>

        <div
          className="flex flex-col items-center justify-center gap-3 px-8 py-5"
          style={{ borderRight: `1px solid var(--c-border)` }}
        >
          <GasValueDisplay value={currentValue} sev={sev} hasData={hasData} />
          <StatusBadge sev={sev} hasData={hasData} warmup={warmup} muted={muted} />
        </div>

        <div className="flex flex-col justify-center gap-4 px-5 py-4">
          <LEDModule sev={sev} hasData={hasData} />
          <div className="divider-h" />
          <div className="grid grid-cols-1 gap-2">
            <KpiCard
              label="Peak (session)"
              value={hasData ? peakValue.toLocaleString() : '--'}
              unit="ADC"
              accentColor={peakAccent}
              Icon={TrendingUp}
            />
            <div className="grid grid-cols-2 gap-2">
              <KpiCard
                label="Samples"
                value={sampleCount.toLocaleString()}
                sub={cadence ? `1 sample / ${cadence}` : 'samples received'}
                accentColor="#2878A8"
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