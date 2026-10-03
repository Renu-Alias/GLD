import { useEffect, useState } from 'react';
import { Cpu, Wifi, WifiOff, Activity } from 'lucide-react';

function getISTDateTime(date) {
  const time = date.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const dateStr = date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  });
  return { time, dateStr };
}

export default function Header({ isOnline = true }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { time, dateStr } = getISTDateTime(now);

  return (
    <header className="flex-shrink-0 bg-white border-b border-slate-200 shadow-sm">
      {/* Indigo accent bar across the top */}
      <div className="h-0.5 bg-gradient-to-r from-indigo-500 via-indigo-400 to-slate-300" />

      <div className="flex items-center justify-between px-6 py-3">
        {/* Left — Branding */}
        <div className="flex items-center gap-3">
          {/* Icon badge with indigo ring */}
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600 ring-1 ring-indigo-700/30 shadow-sm">
            <Activity size={17} className="text-white" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight text-slate-900 leading-tight">
              Gas Leakage Monitoring System
            </h1>
            <p className="text-[11px] text-slate-400 font-medium tracking-widest uppercase leading-tight">
              Smart Gas Leak Detector &amp; Alert System
            </p>
          </div>
        </div>

        {/* Right — Clock + status */}
        <div className="flex items-center gap-5">
          {/* Live IST clock */}
          <div className="text-right">
            <p className="font-mono text-[18px] font-semibold text-slate-900 leading-tight tabular-nums tracking-tight">
              {time}
              <span className="text-slate-400 text-[12px] font-normal ml-1.5 tracking-normal">IST</span>
            </p>
            <p className="text-[11px] text-slate-400 font-medium leading-tight">{dateStr}</p>
          </div>

          {/* Divider */}
          <div className="h-9 w-px bg-slate-200" />

          {/* Connection status pill */}
          {isOnline ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <Wifi size={12} className="text-emerald-600" strokeWidth={2.5} />
              <span className="text-[12px] font-semibold text-emerald-700 tracking-wide">Device Online</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-400" />
              <WifiOff size={12} className="text-slate-400" strokeWidth={2.5} />
              <span className="text-[12px] font-semibold text-slate-400 tracking-wide">Device Offline</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
