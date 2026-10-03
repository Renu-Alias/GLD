import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Flame, History, ShieldAlert, Search } from 'lucide-react';

// ── Severity row config — uses CSS custom properties ──────────────────────────
const SEV_ROW = {
  critical: {
    rowBg:      '#FDECEE',
    leftBorder: '#D64550',
    valColor:   'var(--c-crit)',
    badge: {
      bg: '#FDECEE', border: 'var(--c-crit-border)',
      text: 'var(--c-crit)', label: 'Critical', Icon: Flame,
    },
  },
  warning: {
    rowBg:      '#FFF7E6',
    leftBorder: '#D99A24',
    valColor:   'var(--c-warn)',
    badge: {
      bg: '#FFF7E6', border: 'var(--c-warn-border)',
      text: 'var(--c-warn)', label: 'Warning', Icon: AlertTriangle,
    },
  },
  normal: {
    rowBg:      '#EAF8F3',
    leftBorder: '#16A37A44',
    valColor:   'var(--c-navy)',
    badge: {
      bg: '#EAF8F3', border: 'var(--c-safe-border)',
      text: 'var(--c-safe)', label: 'Normal', Icon: CheckCircle2,
    },
  },
};

function SeverityBadge({ level }) {
  const cfg = (SEV_ROW[level] ?? SEV_ROW.normal).badge;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text }}
    >
      <cfg.Icon size={9} strokeWidth={3} />
      {cfg.label}
    </span>
  );
}

function ActivePill() {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold" style={{ color: 'var(--c-crit)' }}>
      <span className="relative flex h-1.5 w-1.5">
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
          style={{ background: 'var(--c-crit)' }}
        />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: 'var(--c-crit)' }} />
      </span>
      Active
    </span>
  );
}

function IncidentRow({ incident, index }) {
  const cfg = SEV_ROW[incident.severity] ?? SEV_ROW.normal;
  return (
    <tr
      style={{ background: cfg.rowBg, borderLeft: `2px solid ${cfg.leftBorder}` }}
      className="hover:brightness-95 transition-all duration-100"
    >
      <td className="pl-3 pr-2 py-2 text-[10px] font-mono text-center" style={{ color: 'var(--c-muted)' }}>
        {index + 1}
      </td>
      <td className="px-3 py-2">
        <span className="font-mono text-[11px] whitespace-nowrap" style={{ color: 'var(--c-navy)' }}>
          {incident.timestamp}
        </span>
      </td>
      <td className="px-3 py-2 text-center">
        <span className="font-mono text-[12px] font-bold tabular-nums" style={{ color: cfg.valColor }}>
          {incident.peakValue.toLocaleString()}
        </span>
        <span className="text-[9px] ml-0.5" style={{ color: 'var(--c-muted)' }}>ADC</span>
      </td>
      <td className="px-3 py-2 text-center">
        <SeverityBadge level={incident.severity} />
      </td>
      <td className="px-3 pr-3 py-2 text-right">
        {incident.resolved
          ? <span className="font-mono text-[11px]" style={{ color: 'var(--c-muted)' }}>{incident.duration}</span>
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
      <div
        className="flex items-center justify-between px-4 pt-3.5 pb-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--c-border)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center"
            style={{ background: '#F4F6F8' }}
          >
            <History size={11} strokeWidth={2.5} style={{ color: 'var(--c-muted)' }} />
          </div>
          <span className="text-[12px] font-semibold" style={{ color: 'var(--c-navy)' }}>
            Incident History
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {criticalCount > 0 && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold"
              style={{
                background: 'var(--c-crit-bg)',
                border: '1px solid var(--c-crit-border)',
                color: 'var(--c-crit)',
              }}
            >
              <ShieldAlert size={9} strokeWidth={3} />
              {criticalCount} Critical
            </span>
          )}
          <span className="text-[10px] font-semibold tabular-nums" style={{ color: 'var(--c-muted)' }}>
            {incidents.length} total
          </span>
        </div>
      </div>

      {/* ── Filter tabs ─────────────────────────── */}
      <div
        className="flex items-center gap-1 px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--c-border)', background: '#FAFBFC' }}
      >
        <Search size={10} className="mr-1" strokeWidth={2} style={{ color: 'var(--c-muted)' }} />
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className="px-2.5 py-1 rounded text-[10px] font-bold transition-all"
            style={
              filter === tab.key
                ? { background: '#EBF3FA', color: '#2878A8', border: '1px solid #C0D8ED' }
                : { color: 'var(--c-muted)', border: '1px solid transparent' }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Column headers ──────────────────────── */}
      <div
        className="flex-shrink-0"
        style={{ background: '#FAFBFC', borderBottom: '1px solid var(--c-border)' }}
      >
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
          <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: 'var(--c-muted)' }}>
            <CheckCircle2 size={24} strokeWidth={1.5} style={{ color: 'var(--c-safe)' }} />
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
            <tbody>
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
