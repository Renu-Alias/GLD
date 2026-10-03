import { Clock, AlertTriangle, CheckCircle2, Flame, History } from 'lucide-react';

// ── Severity badge component ─────────────────────────────────────────────────

const BADGE_CONFIG = {
  normal: {
    label:   'Normal',
    bg:      'bg-emerald-50',
    border:  'border-emerald-200',
    text:    'text-emerald-700',
    Icon:    CheckCircle2,
  },
  warning: {
    label:   'Warning',
    bg:      'bg-amber-50',
    border:  'border-amber-200',
    text:    'text-amber-700',
    Icon:    AlertTriangle,
  },
  critical: {
    label:   'Critical',
    bg:      'bg-red-50',
    border:  'border-red-200',
    text:    'text-red-700',
    Icon:    Flame,
  },
};

function SeverityBadge({ level }) {
  const cfg = BADGE_CONFIG[level] ?? BADGE_CONFIG.normal;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${cfg.bg} ${cfg.border} ${cfg.text}`}
    >
      <cfg.Icon size={10} strokeWidth={2.5} />
      {cfg.label}
    </span>
  );
}

// ── Duration pill ────────────────────────────────────────────────────────────

function DurationPill({ duration, resolved }) {
  if (!resolved) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
        </span>
        Active
      </span>
    );
  }
  return (
    <span className="text-[12px] font-mono text-slate-500">{duration}</span>
  );
}

// ── Table row ────────────────────────────────────────────────────────────────

function IncidentRow({ incident, index }) {
  const isCritical = incident.severity === 'critical';
  const rowBase    = isCritical
    ? 'bg-red-50/60 border-l-2 border-l-red-400'
    : 'border-l-2 border-l-transparent';

  return (
    <tr className={`${rowBase} hover:bg-slate-50 transition-colors duration-100`}>
      {/* Index */}
      <td className="pl-4 pr-2 py-2.5 text-[11px] font-mono text-slate-400 text-center w-8">
        {index + 1}
      </td>

      {/* Timestamp */}
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <Clock size={11} className="text-slate-400 flex-shrink-0" strokeWidth={2} />
          <span className="font-mono text-[12px] text-slate-700 whitespace-nowrap">
            {incident.timestamp}
          </span>
        </div>
      </td>

      {/* Peak value */}
      <td className="px-3 py-2.5 text-center">
        <span
          className={`font-mono text-[13px] font-semibold tabular-nums ${
            incident.severity === 'critical'
              ? 'text-red-600'
              : incident.severity === 'warning'
              ? 'text-amber-600'
              : 'text-slate-700'
          }`}
        >
          {incident.peakValue.toLocaleString()}
        </span>
        <span className="text-[10px] text-slate-400 ml-0.5">ADC</span>
      </td>

      {/* Severity badge */}
      <td className="px-3 py-2.5 text-center">
        <SeverityBadge level={incident.severity} />
      </td>

      {/* Duration / status */}
      <td className="px-3 pr-4 py-2.5 text-right">
        <DurationPill duration={incident.duration} resolved={incident.resolved} />
      </td>
    </tr>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

/**
 * IncidentHistory — scrollable table of past leakage events.
 *
 * Props:
 *   incidents  {Array}  — list of incident objects:
 *     { id, timestamp, peakValue, severity, duration, resolved }
 */
export default function IncidentHistory({ incidents = [] }) {
  const criticalCount = incidents.filter(i => i.severity === 'critical').length;

  return (
    <div className="card flex flex-col h-full overflow-hidden">
      {/* Card header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <History size={15} className="text-slate-500" strokeWidth={2} />
          <h2 className="text-[13px] font-semibold text-slate-800">Incident History</h2>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 border border-red-200 text-[11px] font-semibold text-red-700">
              <Flame size={9} strokeWidth={3} />
              {criticalCount} Critical
            </span>
          )}
          <span className="text-[12px] text-slate-400 font-medium">
            {incidents.length} events
          </span>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex-shrink-0">
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-8" />
            <col className="w-[38%]" />
            <col className="w-[18%]" />
            <col className="w-[22%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="pl-4 pr-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-center">#</th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-left">Timestamp (IST)</th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-center">Peak ADC</th>
              <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-center">Severity</th>
              <th className="px-3 pr-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 text-right">Duration</th>
            </tr>
          </thead>
        </table>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-10 text-slate-400">
            <CheckCircle2 size={28} strokeWidth={1.5} className="text-emerald-300" />
            <p className="text-[13px] font-medium">No incidents recorded</p>
            <p className="text-[11px]">Gas levels have remained within safe limits.</p>
          </div>
        ) : (
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-8" />
              <col className="w-[38%]" />
              <col className="w-[18%]" />
              <col className="w-[22%]" />
              <col className="w-[20%]" />
            </colgroup>
            <tbody className="divide-y divide-slate-50">
              {incidents.map((incident, i) => (
                <IncidentRow key={incident.id} incident={incident} index={i} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
