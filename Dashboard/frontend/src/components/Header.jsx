import { useEffect, useState } from 'react';
import { Activity, Wifi, WifiOff, Radio } from 'lucide-react';

function getISTDateTime(date) {
  const time = date.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const dateStr = date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
  });
  return { time, dateStr };
}

/**
 * Props:
 *   isOnline  {boolean}
 *   latencyMs {number} — simulated round-trip latency in ms
 */
export default function Header({ isOnline = true, latencyMs = 24 }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { time, dateStr } = getISTDateTime(now);

  return (
    <header className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm">
      {/* Indigo accent bar */}
      <div className="h-[2px] bg-gradient-to-r from-indigo-500 via-indigo-400 to-slate-200" />

      <div className="flex items-center justify-between px-5 py-2.5">
        {/* ── Left: Identity ───────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 shadow-sm">
            <Activity size={15} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-[14px] font-semibold tracking-tight text-slate-900 leading-tight">
              Gas Leakage Monitoring System
            </h1>
            <p className="text-[10px] font-medium text-slate-400 tracking-widest uppercase leading-tight">
              Industrial IoT Safety Node #01
            </p>
          </div>
        </div>

        {/* ── Right: Status + Clock ────────────────── */}
        <div className="flex items-center gap-4">
          {/* Connection status pill */}
          {isOnline ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-50 border border-emerald-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <Wifi size={11} className="text-emerald-600" strokeWidth={2.5} />
              <span className="text-[11px] font-semibold text-emerald-700 tracking-wide">Online</span>
              <div className="w-px h-3 bg-emerald-200" />
              <Radio size={10} className="text-slate-400" strokeWidth={2} />
              <span className="font-mono text-[11px] text-slate-500">
                <span className="text-emerald-600 font-bold">{latencyMs}</span>ms
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-100 border border-slate-200">
              <span className="inline-flex h-2 w-2 rounded-full bg-slate-400" />
              <WifiOff size={11} className="text-slate-400" strokeWidth={2.5} />
              <span className="text-[11px] font-semibold text-slate-400">Offline</span>
            </div>
          )}

          {/* Divider */}
          <div className="h-7 w-px bg-slate-200" />

          {/* Live IST clock */}
          <div className="flex flex-col items-end">
            <span className="font-mono text-[17px] font-bold text-slate-900 tabular-nums leading-tight tracking-tight">
              {time}
              <span className="text-[11px] font-normal text-indigo-500 ml-1.5 tracking-widest">IST</span>
            </span>
            <span className="text-[10px] font-medium text-slate-400 leading-tight">{dateStr}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
