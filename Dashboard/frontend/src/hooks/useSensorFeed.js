import { useEffect, useRef, useState } from 'react';

const DEFAULT_THRESHOLDS = {
  warning: 500,
  warningClear: 420,
  danger: 800,
  dangerClear: 700,
  adcMax: 1023,
};

const MAX_HISTORY = 720;

const INITIAL = {
  bridge: 'connecting',
  bridgeError: null,
  link: 'waiting',
  source: 'serial',
  isDemo: false,
  frameSource: null,
  serial: { open: false, path: null, error: null },
  thresholds: DEFAULT_THRESHOLDS,
  sampleIntervalMs: null,
  latest: null,
  history: [],
  incidents: [],
  stats: { sampleCount: 0, peakValue: 0, meanValue: null, startedAt: null, lastReadingAt: null },
  device: { warmup: false, muted: false, rssi: null, uptimeMs: null },
};

const BRIDGE_HINT =
  'Cannot reach the dashboard bridge. Start it with "npm start" in Dashboard/server '
  + '(use "npm run demo" to preview the UI without hardware).';

/**
 * Subscribes to the bridge's SSE stream and holds everything the dashboard
 * renders.
 *
 * Every value here originates from the ESP32 over USB serial: the bridge parses
 * the `TELEM` frames the firmware writes to the serial port and this hook only
 * relays them. The one exception is `--demo` mode, which the bridge flags with
 * `isDemo` so the UI can label synthetic readings as such.
 */
export function useSensorFeed({ apiBase = '/api' } = {}) {
  const [state, setState] = useState(INITIAL);
  const sourceRef = useRef(null);

  useEffect(() => {
    let disposed = false;
    const es = new EventSource(`${apiBase}/stream`);

    const patch = (fn) => setState((prev) => (disposed ? prev : fn(prev)));

    // Probing /api/health gives a real error message instead of the browser's
    // opaque EventSource failure, which is what the user needs to see.
    fetch(`${apiBase}/health`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((health) => {
        patch((prev) => ({
          ...prev,
          bridgeError: null,
          isDemo: Boolean(health.demo),
          thresholds: health.thresholds ?? prev.thresholds,
          link: health.link ?? prev.link,
        }));
      })
      .catch(() => {
        patch((prev) => ({ ...prev, bridge: 'closed', bridgeError: BRIDGE_HINT }));
      });

    es.onopen = () => {
      sourceRef.current = es;
      patch((prev) => ({ ...prev, bridge: 'open', bridgeError: null }));
    };

    es.onerror = () => {
      // EventSource reconnects by itself; this only reports the gap.
      patch((prev) => ({
        ...prev,
        bridge: sourceRef.current === es && es.readyState === 1 ? 'open' : 'reconnecting',
        bridgeError: BRIDGE_HINT,
      }));
    };

    es.addEventListener('hello', (event) => {
      const data = JSON.parse(event.data);
      patch((prev) => ({
        ...prev,
        bridge: 'open',
        bridgeError: null,
        source: data.source ?? prev.source,
        isDemo: Boolean(data.isDemo),
        frameSource: data.frameSource ?? null,
        link: data.link ?? prev.link,
        thresholds: data.thresholds ?? prev.thresholds,
        latest: data.latest ?? null,
        history: data.history ?? [],
        incidents: data.incidents ?? [],
        stats: data.stats ?? prev.stats,
        device: data.device ?? prev.device,
        serial: data.serial ?? prev.serial,
      }));
    });

    es.addEventListener('reading', (event) => {
      const r = JSON.parse(event.data);
      patch((prev) => {
        const history = [...prev.history, { t: r.at, value: r.value, severity: r.severity }];
        return {
          ...prev,
          link: 'live',
          latest: {
            value: r.value,
            severity: r.severity,
            state: r.state,
            warmup: r.warmup,
            muted: r.muted,
            at: r.at,
          },
          history: history.length > MAX_HISTORY ? history.slice(-MAX_HISTORY) : history,
          stats: {
            ...prev.stats,
            sampleCount: prev.stats.sampleCount + 1,
            peakValue: Math.max(prev.stats.peakValue, r.value),
            lastReadingAt: r.at,
          },
          device: { ...prev.device, warmup: r.warmup, muted: r.muted, rssi: r.rssi, uptimeMs: r.uptimeMs },
        };
      });
    });

    es.addEventListener('incident', (event) => {
      const { event: kind, incident } = JSON.parse(event.data);
      patch((prev) => {
        if (kind === 'incident-open') return { ...prev, incidents: [incident, ...prev.incidents] };
        return {
          ...prev,
          incidents: prev.incidents.map((i) => (i.id === incident.id ? incident : i)),
        };
      });
    });

    es.addEventListener('config', (event) => {
      const data = JSON.parse(event.data);
      patch((prev) => ({
        ...prev,
        thresholds: data.thresholds ?? prev.thresholds,
        sampleIntervalMs: data.sampleIntervalMs ?? prev.sampleIntervalMs,
      }));
    });

    es.addEventListener('link', (event) => {
      patch((prev) => ({ ...prev, link: JSON.parse(event.data).link }));
    });

    return () => {
      disposed = true;
      sourceRef.current = null;
      es.close();
    };
  }, [apiBase]);

  return state;
}

export default useSensorFeed;