import { useEffect, useState } from 'react';
import {
  Activity, WifiOff, Radio, Usb, Cable, FlaskConical, Thermometer,
} from 'lucide-react';
import { formatAge, formatTime } from '../lib/format';

const IST = { timeZone: 'Asia/Kolkata' };

/**
 * link:      'live' | 'stale' | 'waiting' | 'no-data'   (from the bridge)
 * bridge:    'open' | 'connecting' | 'reconnecting' | 'closed'
 *
 * The badge deliberately reports the USB serial link rather than a WiFi link:
 * the dashboard's data path is USB, and the ESP32's WiFi state is a separate
 * concern (it only carries the SMS alert).
 */
const LINK = {
  live: { label: 'Sensor Live', Icon: Usb, color: 'var(--c-safe)', bg: 'var(--c-safe-bg)', border: 'var(--c-safe-border)' },
  stale: { label: 'Feed Stale', Icon: Usb, color: 'var(--c-warn)', bg: 'var(--c-warn-bg)', border: 'var(--c-warn-border)' },
  waiting: { label: 'Connecting', Icon: Radio, color: '#2878A8', bg: '#EBF3FA', border: '#C0D8ED' },
  'no-data': { label: 'No Sensor', Icon: WifiOff, color: 'var(--c-crit)', bg: 'var(--c-crit-bg)', border: 'var(--c-crit-border)' },
};

export default function Header({
  link = 'waiting',
  isDemo = false,
  serialPath = null,
  lastReadingAt = null,
  warmup = false,
}) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const cfg = LINK[link] ?? LINK.waiting;
  const { Icon } = cfg;

  const time = now.toLocaleTimeString('en-IN', {
    ...IST,
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const dateStr = now.toLocaleDateString('en-IN', {
    ...IST, day: '2-digit', month: 'short', year: 'numeric',
  });

  const age = lastReadingAt ? now.getTime() - lastReadingAt : null;

  return (
    <header
      className="flex-shrink-0 shadow-sm"
      style={{ background: '#ffffff', borderBottom: '1px solid var(--c-border)' }}
    >
      <div
        className="h-[2px]"
        style={{ background: 'linear-gradient(to right, var(--c-navy), #2E4068, var(--c-border))' }}
      />

      <div className="flex items-center justify-between px-5 py-2.5">
        {/* Left: Identity */}
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
              MQ-6 LPG Sensor · USB Serial Node #01
            </p>
          </div>
        </div>

        {/* Right: link status + clock */}
        <div className="flex items-center gap-4">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-md"
            style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
          >
            {link === 'live' ? (
              <span className="relative flex h-2 w-2">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                  style={{ background: cfg.color }}
                />
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: cfg.color }} />
              </span>
            ) : (
              <span className="inline-flex h-2 w-2 rounded-full" style={{ background: cfg.color }} />
            )}

            <Icon size={11} strokeWidth={2.5} style={{ color: cfg.color }} />
            <span className="text-[11px] font-semibold tracking-wide" style={{ color: cfg.color }}>
              {cfg.label}
            </span>

            <div className="w-px h-3" style={{ background: cfg.border }} />

            <span className="font-mono text-[10px] whitespace-nowrap" style={{ color: 'var(--c-muted)' }}>
              {lastReadingAt ? (
                <>
                  <span style={{ color: cfg.color }}>{formatTime(lastReadingAt)}</span>
                  {' · '}
                  {formatAge(age)}
                </>
              ) : (
                'no reading yet'
              )}
            </span>
          </div>

          {/* Simulated-data marker: must never be mistaken for a live sensor. */}
          {isDemo && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md"
              style={{ background: 'var(--c-warn-bg)', border: '1px solid var(--c-warn-border)' }}
            >
              <FlaskConical size={11} strokeWidth={2.5} style={{ color: 'var(--c-warn)' }} />
              <span className="text-[11px] font-bold tracking-wide" style={{ color: 'var(--c-warn)' }}>
                SIMULATED
              </span>
            </div>
          )}

          {/* Firmware flags that explain the current reading. */}
          {warmup && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md"
              style={{ background: '#EBF3FA', border: '1px solid #C0D8ED' }}
            >
              <Thermometer size={11} strokeWidth={2.5} style={{ color: '#2878A8' }} />
              <span className="text-[11px] font-semibold" style={{ color: '#2878A8' }}>Warm-up</span>
            </div>
          )}

          {/* Serial port identity - proves which board is feeding the screen. */}
          {serialPath && (
            <div className="flex items-center gap-1.5">
              <Cable size={11} strokeWidth={2} style={{ color: 'var(--c-muted)' }} />
              <span className="font-mono text-[10px]" style={{ color: 'var(--c-muted)' }}>
                {serialPath}
              </span>
            </div>
          )}

          <div className="h-7" style={{ width: 1, background: 'var(--c-border)' }} />

          <div className="flex flex-col items-end">
            <span
              className="font-mono text-[17px] font-bold tabular-nums leading-tight tracking-tight"
              style={{ color: 'var(--c-navy)' }}
            >
              {time}
              <span className="text-[11px] font-normal ml-1.5 tracking-widest" style={{ color: '#2878A8' }}>
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