import { useEffect, useState } from 'react';
import { Cpu, Wifi, WifiOff } from 'lucide-react';

/**
 * Formats a Date object as IST time and date strings.
 * IST = UTC+5:30
 */
function getISTDateTime(date) {
  const options = {
    timeZone: 'Asia/Kolkata',
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  const dateOptions = {
    timeZone: 'Asia/Kolkata',
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  };
  const time = date.toLocaleTimeString('en-IN', options);
  const dateStr = date.toLocaleDateString('en-IN', dateOptions);
  return { time, dateStr };
}

/**
 * Header — top bar with project identity, live IST clock, and device status.
 *
 * Props:
 *   isOnline  {boolean}  — whether the device connection is active
 */
export default function Header({ isOnline = true }) {
  const [now, setNow] = useState(new Date());

  // Tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { time, dateStr } = getISTDateTime(now);

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 shadow-sm flex-shrink-0">
      {/* Left — Branding */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-900">
          <Cpu size={18} className="text-white" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-[15px] font-semibold tracking-tight text-slate-900 leading-tight">
            Gas Leakage Monitoring System
          </h1>
          <p className="text-[11px] text-slate-400 font-medium tracking-wide uppercase leading-tight">
            Smart Gas Leak Detector &amp; Alert System
          </p>
        </div>
      </div>

      {/* Right — Clock + Connection */}
      <div className="flex items-center gap-6">
        {/* Live clock */}
        <div className="text-right">
          <p className="font-mono text-[17px] font-medium text-slate-900 leading-tight tabular-nums">
            {time}
            <span className="text-slate-400 text-[13px] font-normal ml-1.5">IST</span>
          </p>
          <p className="text-[12px] text-slate-500 font-normal leading-tight">
            {dateStr}
          </p>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-slate-200" />

        {/* Device connection status */}
        <div className="flex items-center gap-2">
          {isOnline ? (
            <>
              {/* Pulsating green dot */}
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <Wifi size={14} className="text-emerald-500" strokeWidth={2} />
              <span className="text-[12px] font-medium text-emerald-600">Device Online</span>
            </>
          ) : (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-400" />
              </span>
              <WifiOff size={14} className="text-slate-400" strokeWidth={2} />
              <span className="text-[12px] font-medium text-slate-400">Device Offline</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
