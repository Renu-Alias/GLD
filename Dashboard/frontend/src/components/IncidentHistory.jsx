import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Flame, History, ShieldAlert, Search } from 'lucide-react';

// ── Severity row config ───────────────────────────────────────────────────────
const SEV_ROW = {
  critical: {
    rowBg:    'bg-rose-500/10',
    border:   'border-l-2 border-l-rose-500',
    valColor: 'text-rose-600',
    badge:    { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', label: 'Critical', Icon: Flame },
  },
  warning: {
    rowBg:    'bg-amber-500/10',
    border:   'border-l-2 border-l-amber-500',
    valColor: 'text-amber-700',
    badge:    { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', label: 'Warning', Icon: AlertTriangle },
  },
  normal: {
    rowBg:    'bg-emerald-500/5',
    border:   'border-l-2 border-l-emerald-500/40',
    valColor: 'text-slate-700',
    badge:    { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: 'Normal', Icon: CheckCircle2 },
  },
};

function SeverityBadge({ level }) {
  const cfg = (SEV_ROW[level] ?? SEV_ROW.normal).badge;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold ${cfg.bg} ${cfg.border} ${cfg.text}`}>
      <cfg.Icon size={9} strokeWidth={3} />
      {cfg.label}
    </span>
  );
}

function ActivePill() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-rose-600">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
      </span>
      Active
    </span>
  );
}

function IncidentRow({ incident, index }) {
  const cfg = SEV_ROW[incident.severity] ?? SEV_ROW.normal;
  return (
    <tr className={`${cfg.rowBg} ${cfg.border} hover:brightness-95 transition-all duration-100`}>
      <td className="pl-3 pr-2 py-2 text-[10px] font-mono text-slate-400 text-center">{index + 1}</td>
      <td className="px-3 py-2">
        <span className="font-mono text-[11px] text-slate-600 whitespace-nowrap">{incident.timestamp}</span>
      </td>
      <td className="px-3 py-2 text-center">
        <span className={`font-mono text-[12px] font-bold tabular-nums ${cfg.valColor}`}>
          {incident.peakValue.toLocaleString()}
        </span>
        <span className="text-[9px] text-slate-400 ml-0.5">ADC</span>
      </td>
      <td className="px-3 py-2 text-center">
        <SeverityBadge level={incident.severity} />
      </td>
      <td className="px-3 pr-3 py-2 text-right">
        {incident.resolved
          ? <span className="font-mono text-[11px] text-slate-500">{incident.duration}</span>
          : <ActivePill />
        }
      </td>
    </tr>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function IncidentHistory({ incidents = [] }) {
  const [filter, setFilter] = useState('all');

  const criticalCount = incidents.filter(i => i.severity === 'critical').length;
  const warningCount  = incidents.filter(i => i.severity === 'warning').length;

  const filtered = filter === 'all'
    ? incidents
    : incidents.filter(i => i.severity === filter);

  const FILTER_TABS = [
    { key: 'all',      label: `All (${incidents.length})` },
    { key: 'critical', label: `Critical (${criticalCount})` },
    { key: 'warning',  label: `Warn (${warningCount})` },
  ];

  return (
    <div className="card flex flex-col h-full overflow-hidden">
      {/* ── Card header ─────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-3 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center">
            <History size={11} className="text-slate-500" strokeWidth={2.5} />
          </div>
          <span className="text-[12px] font-semibold text-slate-800">Incident History</span>
        </div>
        <div className="flex items-center gap-1.5">
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-rose-200 bg-rose-50 text-[10px] font-bold text-rose-700">
              <ShieldAlert size={9} strokeWidth={3} />
              {criticalCount} Critical
            </span>
          )}
          <span className="text-[10px] font-semibold text-slate-400 tabular-nums">
            {incidents.length} total
          </span>
        </div>
      </div>

      {/* ── Filter tabs ─────────────────────────── */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-100 flex-shrink-0 bg-slate-50/80">
        <Search size={10} className="text-slate-400 mr-1" strokeWidth={2} />
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
              filter === tab.key
                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Column headers ──────────────────────── */}
      <div className="flex-shrink-0 bg-slate-50 border-b border-slate-100">
        <table className="w-full table-fixed">
          <colgroup>
            <col className="w-8" />
            <col className="w-[33%]" />
            <col className="w-[16%]" />
            <col className="w-[26%]" />
            <col className="w-[19%]" />
          </colgroup>
          <thead>
            <tr>
              <th className="pl-3 pr-2 py-1.5 kpi-label text-center">#</th>
              <th className="px-3 py-1.5 kpi-label text-left">Timestamp (IST)</th>
              <th className="px-3 py-1.5 kpi-label text-center">Peak ADC</th>
              <th className="px-3 py-1.5 kpi-label text-center">Severity</th>
              <th className="px-3 pr-3 py-1.5 kpi-label text-right">Duration</th>
            </tr>
          </thead>
        </table>
      </div>

      {/* ── Scrollable rows ─────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
            <CheckCircle2 size={24} strokeWidth={1.5} className="text-emerald-300" />
            <p className="text-[12px] font-semibold">No events match this filter</p>
          </div>
        ) : (
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-8" />
              <col className="w-[33%]" />
              <col className="w-[16%]" />
              <col className="w-[26%]" />
              <col className="w-[19%]" />
            </colgroup>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((inc, i) => (
                <IncidentRow key={inc.id} incident={inc} index={i} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
