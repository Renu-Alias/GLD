import { Clock, AlertTriangle, CheckCircle2, Flame, History, ShieldAlert } from 'lucide-react';

// ── Severity badge ───────────────────────────────────────────────────────────

const BADGE_CONFIG = {
  normal: {
    label:  'Normal',
    bg:     'bg-emerald-50',
    border: 'border-emerald-200',
    text:   'text-emerald-700',
    Icon:   CheckCircle2,
  },
  warning: {
    label:  'Warning',
    bg:     'bg-amber-50',
    border: 'border-amber-200',
    text:   'text-amber-700',
    Icon:   AlertTriangle,
  },
  critical: {
    label:  'Critical',
    bg:     'bg-red-50',
    border: 'border-red-200',
    text:   'text-red-700',
    Icon:   Flame,
  },
};

function SeverityBadge({ level }) {
  const cfg = BADGE_CONFIG[level] ?? BADGE_CONFIG.normal;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold ${cfg.bg} ${cfg.border} ${cfg.text}`}>
      <cfg.Icon size={9} strokeWidth={3} />
      {cfg.label}
    </span>
  );
}

// ── Duration pill ────────────────────────────────────────────────────────────

function DurationPill({ duration, resolved }) {
  if (!resolved) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-600">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
        </span>
        Active
      </span>
    );
  }
  return <span className="font-mono text-[11px] text-slate-500">{duration}</span>;
}

// ── Table row ────────────────────────────────────────────────────────────────

function IncidentRow({ incident, index }) {
  const isCritical = incident.severity === 'critical';
  const isEven     = index % 2 === 0;

  const rowBg = isCritical
    ? 'bg-red-50/70'
    : isEven ? 'bg-white' : 'bg-slate-50/60';

  const leftBorder = isCritical
    ? 'border-l-2 border-l-red-400'
    : 'border-l-2 border-l-transparent';

  return (
    <tr className={`${rowBg} ${leftBorder} hover:bg-indigo-50/40 transition-colors duration-100`}>
      <td className="pl-4 pr-2 py-2.5 text-[11px] font-mono text-slate-400 text-center">
        {index + 1}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <Clock size={10} className="text-slate-400 flex-shrink-0" strokeWidth={2} />
          <span className="font-mono text-[11px] text-slate-700 whitespace-nowrap">{incident.timestamp}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 text-center">
        <span className={`font-mono text-[13px] font-bold tabular-nums ${
          isCritical ? 'text-red-600'
          : incident.severity === 'warning' ? 'text-amber-600'
          : 'text-slate-700'
        }`}>
          {incident.peakValue.toLocaleString()}
        </span>
        <span className="text-[9px] text-slate-400 ml-0.5 font-medium">ADC</span>
      </td>
      <td className="px-3 py-2.5 text-center">
        <SeverityBadge level={incident.severity} />
      </td>
      <td className="px-3 pr-4 py-2.5 text-right">
        <DurationPill duration={incident.duration} resolved={incident.resolved} />
      </td>
    </tr>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function IncidentHistory({ incidents = [] }) {
  const criticalCount = incidents.filter(i => i.severity === 'critical').length;

  return (
    // Left slate border to visually distinguish from the indigo-bordered chart
    <div className="card flex flex-col h-full overflow-hidden border-l-[3px] border-l-slate-400">
      {/* Card header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-slate-100">
            <History size={13} className="text-slate-500" strokeWidth={2.5} />
          </div>
          <h2 className="text-[13px] font-semibold text-slate-800">Incident History</h2>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-[10px] font-bold text-red-700">
              <ShieldAlert size={9} strokeWidth={3} />
              {criticalCount} Critical
            </span>
          )}
          <span className="text-[11px] font-semibold text-slate-400 tabular-nums">
            {incidents.length} events
          </span>
        </div>
      </div>

      {/* Column headers */}
      <div className="flex-shrink-0 bg-slate-50 border-b border-slate-100">
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-8" />
            <col className="w-[36%]" />
            <col className="w-[18%]" />
            <col className="w-[24%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead>
            <tr>
              <th className="pl-4 pr-2 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center">#</th>
              <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-400 text-left">Timestamp (IST)</th>
              <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center">Peak ADC</th>
              <th className="px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center">Severity</th>
              <th className="px-3 pr-4 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-400 text-right">Duration</th>
            </tr>
          </thead>
        </table>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-10 text-slate-400">
            <CheckCircle2 size={26} strokeWidth={1.5} className="text-emerald-300" />
            <p className="text-[13px] font-semibold">No incidents recorded</p>
            <p className="text-[11px] text-slate-400">Gas levels within safe limits.</p>
          </div>
        ) : (
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-8" />
              <col className="w-[36%]" />
              <col className="w-[18%]" />
              <col className="w-[24%]" />
              <col className="w-[18%]" />
            </colgroup>
            <tbody>
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
