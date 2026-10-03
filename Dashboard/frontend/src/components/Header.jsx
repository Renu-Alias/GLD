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

export default function Header({ isOnline = true, latencyMs = 24 }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { time, dateStr } = getISTDateTime(now);

  return (
    <header
      className="flex-shrink-0 shadow-sm"
      style={{ background: '#ffffff', borderBottom: '1px solid var(--c-border)' }}
    >
      {/* Top accent bar — navy → transparent */}
      <div
        className="h-[2px]"
        style={{ background: 'linear-gradient(to right, var(--c-navy), #2E4068, var(--c-border))' }}
      />

      <div className="flex items-center justify-between px-5 py-2.5">
        {/* ── Left: Identity ───────────────────────── */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg shadow-sm"
            style={{ background: 'var(--c-navy)' }}
          >
            <Activity size={15} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1
              className="text-[14px] font-semibold tracking-tight leading-tight"
              style={{ color: 'var(--c-navy)' }}
            >
              Gas Leakage Monitoring System
            </h1>
            <p
              className="text-[10px] font-medium tracking-widest uppercase leading-tight"
              style={{ color: 'var(--c-muted)' }}
            >
              Industrial IoT Safety Node #01
            </p>
          </div>
        </div>

        {/* ── Right: Status + Clock ────────────────── */}
        <div className="flex items-center gap-4">
          {/* Connection status pill */}
          {isOnline ? (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-md"
              style={{
                background: 'var(--c-safe-bg)',
                border: '1px solid var(--c-safe-border)',
              }}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                  style={{ background: 'var(--c-safe)' }}
                />
                <span
                  className="relative inline-flex h-2 w-2 rounded-full"
                  style={{ background: 'var(--c-safe)' }}
                />
              </span>
              <Wifi size={11} strokeWidth={2.5} style={{ color: 'var(--c-safe)' }} />
              <span
                className="text-[11px] font-semibold tracking-wide"
                style={{ color: 'var(--c-safe)' }}
              >
                Online
              </span>
              <div className="w-px h-3" style={{ background: 'var(--c-safe-border)' }} />
              <Radio size={10} strokeWidth={2} style={{ color: 'var(--c-muted)' }} />
              <span className="font-mono text-[11px]" style={{ color: 'var(--c-muted)' }}>
                <span className="font-bold" style={{ color: 'var(--c-safe)' }}>{latencyMs}</span>ms
              </span>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-md"
              style={{ background: '#F4F6F8', border: '1px solid var(--c-border)' }}
            >
              <span className="inline-flex h-2 w-2 rounded-full bg-slate-400" />
              <WifiOff size={11} strokeWidth={2.5} style={{ color: 'var(--c-muted)' }} />
              <span className="text-[11px] font-semibold" style={{ color: 'var(--c-muted)' }}>
                Offline
              </span>
            </div>
          )}

          {/* Divider */}
          <div className="h-7" style={{ width: 1, background: 'var(--c-border)' }} />

          {/* Live IST clock */}
          <div className="flex flex-col items-end">
            <span
              className="font-mono text-[17px] font-bold tabular-nums leading-tight tracking-tight"
              style={{ color: 'var(--c-navy)' }}
            >
              {time}
              <span
                className="text-[11px] font-normal ml-1.5 tracking-widest"
                style={{ color: 'var(--c-accent)' }}
              >
                IST
              </span>
            </span>
            <span className="text-[10px] font-medium leading-tight" style={{ color: 'var(--c-muted)' }}>
              {dateStr}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
