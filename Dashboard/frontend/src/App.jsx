import { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import StatusBanner, { getSeverity } from './components/StatusBanner';
import TrendChart from './components/TrendChart';
import IncidentHistory from './components/IncidentHistory';

// ── Constants ────────────────────────────────────────────────────────────────

const SAMPLE_INTERVAL_MS = 2000;  // New sensor reading every 2 s
const MAX_CHART_POINTS   = 40;    // Rolling window for trend chart

// ── IST formatting helper ────────────────────────────────────────────────────

function toIST(date) {
  return date.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour:     '2-digit',
    minute:   '2-digit',
    second:   '2-digit',
    hour12:   false,
  });
}

// ── Scenario phases ──────────────────────────────────────────────────────────
// The simulation cycles Normal → Warning → Critical → Normal so every severity
// state is demonstrated within the first ~2 minutes.

const SCENARIO_PHASES = [
  { mean: 320, std: 40, duration: 10 },
  { mean: 420, std: 50, duration: 8  },
  { mean: 620, std: 60, duration: 10 },
  { mean: 920, std: 80, duration: 10 },
  { mean: 700, std: 55, duration: 8  },
  { mean: 380, std: 45, duration: 8  },
];

// ── Pure utility functions ───────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function gaussianRandom(mean, std) {
  // Box-Muller transform — never returns 0 thanks to (1 - Math.random())
  const u1 = 1 - Math.random();
  const u2 = 1 - Math.random();
  const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

// ── Seed builders (called exactly once, outside render) ──────────────────────

function buildSeedHistory() {
  const now    = Date.now();
  const total  = SCENARIO_PHASES.reduce((acc, p) => acc + p.duration, 0);
  let   cursor = now - total * SAMPLE_INTERVAL_MS;
  const points = [];

  for (const phase of SCENARIO_PHASES) {
    for (let i = 0; i < phase.duration; i++) {
      const value = clamp(Math.round(gaussianRandom(phase.mean, phase.std)), 0, 1023);
      points.push({ time: toIST(new Date(cursor)), value });
      cursor += SAMPLE_INTERVAL_MS;
    }
  }
  return points;
}

function buildSeedIncidents(chartData) {
  const incidents     = [];
  let   incidentId    = 1;
  let   inEvent       = false;
  let   eventStart    = null;
  let   eventPeak     = 0;
  let   eventLevel    = 'normal';
  let   eventStartIdx = 0;

  for (let i = 0; i < chartData.length; i++) {
    const { time, value } = chartData[i];
    const level = getSeverity(value);

    if (!inEvent && level !== 'normal') {
      inEvent       = true;
      eventStart    = time;
      eventPeak     = value;
      eventLevel    = level;
      eventStartIdx = i;
    } else if (inEvent) {
      if (value > eventPeak)        eventPeak = value;
      if (level === 'critical')     eventLevel = 'critical';

      const isLast       = i === chartData.length - 1;
      const nextIsNormal = !isLast && getSeverity(chartData[i + 1].value) === 'normal';

      if (nextIsNormal || isLast) {
        const durationSecs = (((i - eventStartIdx) + 1) * SAMPLE_INTERVAL_MS / 1000).toFixed(0);
        incidents.push({
          id:        incidentId++,
          timestamp: eventStart,
          peakValue: eventPeak,
          severity:  eventLevel,
          duration:  `${durationSecs} s`,
          resolved:  !isLast,
        });
        inEvent       = false;
        eventStart    = null;
        eventPeak     = 0;
        eventLevel    = 'normal';
        eventStartIdx = 0;
      }
    }
  }
  return incidents;
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  // Lazy initialisers — the functions are called only once on mount,
  // not on every re-render.
  const [chartData,     setChartData]     = useState(() => buildSeedHistory());
  const [currentValue,  setCurrentValue]  = useState(() => {
    const h = buildSeedHistory();
    return h[h.length - 1]?.value ?? 0;
  });
  const [peakToday,     setPeakToday]     = useState(() => {
    const h = buildSeedHistory();
    return Math.max(...h.map(d => d.value));
  });
  const [sampleCount,   setSampleCount]   = useState(() => {
    return SCENARIO_PHASES.reduce((acc, p) => acc + p.duration, 0);
  });
  const [incidents,     setIncidents]     = useState(() => {
    const h = buildSeedHistory();
    return buildSeedIncidents(h);
  });
  const [isOnline] = useState(true);

  // Refs for mutable values that shouldn't trigger re-renders
  const openIncidentRef = useRef(null);
  const phaseRef        = useRef({ phaseIndex: 0, stepInPhase: 0 });

  const tick = useCallback(() => {
    const { phaseIndex, stepInPhase } = phaseRef.current;
    const phase    = SCENARIO_PHASES[phaseIndex];
    const newVal   = clamp(Math.round(gaussianRandom(phase.mean, phase.std)), 0, 1023);
    const newTime  = toIST(new Date());
    const newLevel = getSeverity(newVal);

    // Advance scenario phase pointer
    const nextStep = stepInPhase + 1;
    phaseRef.current = nextStep >= phase.duration
      ? { phaseIndex: (phaseIndex + 1) % SCENARIO_PHASES.length, stepInPhase: 0 }
      : { phaseIndex, stepInPhase: nextStep };

    // Update scalar state
    setCurrentValue(newVal);
    setPeakToday(prev => Math.max(prev, newVal));
    setSampleCount(prev => prev + 1);

    // Rolling chart window
    setChartData(prev => {
      const next = [...prev, { time: newTime, value: newVal }];
      return next.length > MAX_CHART_POINTS ? next.slice(-MAX_CHART_POINTS) : next;
    });

    // ── Incident tracking ───────────────────────────────────────────────────
    if (newLevel !== 'normal') {
      if (!openIncidentRef.current) {
        // Open a new incident — capture to local const so the state updater
        // closure reads the right object even if the ref is overwritten later.
        const newIncident = {
          id:        Date.now(),
          timestamp: newTime,
          peakValue: newVal,
          severity:  newLevel,
          resolved:  false,
          duration:  '—',
        };
        openIncidentRef.current = newIncident;
        setIncidents(prev => [newIncident, ...prev]);
      } else {
        // Update peak / escalate severity of the open incident
        const updated = {
          ...openIncidentRef.current,
          peakValue: Math.max(openIncidentRef.current.peakValue, newVal),
          severity:  newLevel === 'critical' ? 'critical' : openIncidentRef.current.severity,
        };
        openIncidentRef.current = updated;
        // Capture id to avoid stale closure over the ref object
        const updatedId = updated.id;
        setIncidents(prev =>
          prev.map(inc => (inc.id === updatedId ? updated : inc))
        );
      }
    } else if (openIncidentRef.current) {
      // Gas returned to normal — close the open incident
      const closed = {
        ...openIncidentRef.current,
        resolved: true,
        duration: `${Math.round(SAMPLE_INTERVAL_MS * 3 / 1000)} s`,
      };
      const closedId = closed.id;
      openIncidentRef.current = null;
      setIncidents(prev =>
        prev.map(inc => (inc.id === closedId ? closed : inc))
      );
    }
  }, []); // no deps: all references are module-level constants or refs

  useEffect(() => {
    const id = setInterval(tick, SAMPLE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [tick]);

  const criticalCount = incidents.filter(i => i.severity === 'critical').length;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100">
      {/* ── Top header bar ─────────────────────────────── */}
      <Header isOnline={isOnline} />

      {/* ── Main content ───────────────────────────────── */}
      <main className="flex flex-col flex-1 gap-3 p-4 overflow-hidden">
        {/* Status banner — primary focal point */}
        <StatusBanner
          currentValue={currentValue}
          peakToday={peakToday}
          sampleCount={sampleCount}
          alertCount={criticalCount}
        />

        {/* Lower section: chart + incident table */}
        <div className="flex flex-1 gap-3 min-h-0">
          {/* Trend chart — 60% width */}
          <div className="flex-[3] min-w-0">
            <TrendChart data={chartData} />
          </div>

          {/* Incident history — 40% width */}
          <div className="flex-[2] min-w-0">
            <IncidentHistory incidents={incidents} />
          </div>
        </div>
      </main>
    </div>
  );
}
