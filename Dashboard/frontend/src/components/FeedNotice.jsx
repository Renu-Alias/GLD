import { AlertTriangle, PlugZap, Radio, FlaskConical, Thermometer } from 'lucide-react';

const TONE = {
  error: { bg: 'var(--c-crit-bg)', border: 'var(--c-crit-border)', color: 'var(--c-crit)', Icon: AlertTriangle },
  warn: { bg: 'var(--c-warn-bg)', border: 'var(--c-warn-border)', color: 'var(--c-warn)', Icon: PlugZap },
  info: { bg: '#EBF3FA', border: '#C0D8ED', color: '#2878A8', Icon: Radio },
};

function Strip({ tone, children }) {
  const t = TONE[tone];
  return (
    <div
      className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-1.5"
      style={{ background: t.bg, borderBottom: `1px solid ${t.border}` }}
    >
      <t.Icon size={12} strokeWidth={2.5} style={{ color: t.color }} />
      <span className="text-[11px] font-semibold tracking-wide text-center" style={{ color: t.color }}>
        {children}
      </span>
    </div>
  );
}

/**
 * States plainly whether the numbers on screen came off the MQ-6 sensor.
 *
 * This is the guard against the worst failure mode of a monitoring dashboard:
 * showing a plausible-looking gas reading while nothing is actually connected.
 * A simulated reading is never allowed to look like a live one, and the order of
 * these checks matters -- an unreachable bridge outranks everything, because if
 * the bridge is down no reading on screen is real regardless of its label.
 */
function resolveNotice({ bridge, bridgeError, link, isDemo, frameSource, serialError }) {
  if (bridge === 'closed' || bridgeError) {
    return {
      tone: 'error',
      text: bridgeError ?? 'The dashboard bridge is unreachable. No readings are being displayed.',
    };
  }
  if (isDemo) {
    return {
      tone: 'warn',
      text: 'SIMULATED DATA - the bridge is running in --demo mode. '
        + 'These values are generated, not measured by the MQ-6 sensor.',
    };
  }
  if (link === 'no-data') {
    return {
      tone: 'error',
      text: 'No sensor data received. Connect the ESP32 over USB and start the bridge.',
    };
  }
  if (serialError) {
    return { tone: 'error', text: serialError };
  }
  if (link === 'stale') {
    return {
      tone: 'warn',
      text: 'Reading feed is stale - no telemetry frame arrived in the last few seconds. '
        + 'The value shown is the last one received and may no longer be current.',
    };
  }
  if (link === 'waiting') {
    return {
      tone: 'info',
      text: 'Waiting for the first reading from the ESP32 on the USB serial link...',
    };
  }
  if (frameSource === 'legacy') {
    return {
      tone: 'warn',
      text: 'Board is running pre-telemetry firmware, so readings arrive only on the slow '
        + '"Gas Value:" log line. Reflash GLD.ino for full-rate telemetry.',
    };
  }
  return null;
}

export default function FeedNotice({
  bridge = 'connecting',
  bridgeError = null,
  link = 'waiting',
  isDemo = false,
  frameSource = null,
  serialError = null,
  warmup = false,
}) {
  const notice = resolveNotice({ bridge, bridgeError, link, isDemo, frameSource, serialError });

  return (
    <>
      {notice && <Strip tone={notice.tone}>{notice.text}</Strip>}
      {warmup && (
        <div
          className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-1.5"
          style={{ background: '#EBF3FA', borderBottom: '1px solid #C0D8ED' }}
        >
          <Thermometer size={12} strokeWidth={2.5} style={{ color: '#2878A8' }} />
          <span className="text-[11px] font-semibold tracking-wide" style={{ color: '#2878A8' }}>
            MQ-6 warming up - the sensor is not stabilised yet, so these readings are
            excluded from the incident log
          </span>
        </div>
      )}
    </>
  );
}