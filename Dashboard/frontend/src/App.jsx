import { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import StatusBanner, { getSeverity } from './components/StatusBanner';
import TrendChart from './components/TrendChart';
import IncidentHistory from './components/IncidentHistory';

// ── Constants ────────────────────────────────────────────────────────────────

const SAMPLE_INTERVAL_MS  = 2000;   // New sensor reading every 2 s
const MAX_CHART_POINTS    = 40;     // Rolling window for trend chart

// ── IST formatting helpers ───────────────────────────────────────────────────

function toIST(date) {
  return date.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour:     '2-digit',
    minute:   '2-digit',
    second:   '2-digit',
    hour12:   false,
  });
}

// ── Simulated sensor value generator ────────────────────────────────────────
// Produces a realistic random walk around a slowly drifting mean.
// The simulation cycles through Normal → Warning → Critical → back to Normal
// so every severity state is demonstrated on load.

const SCENARIO_PHASES = [
  { name: 'normal',   mean: 320,  std: 40,  duration: 10 },  // 10 samples
  { name: 'normal',   mean: 420,  std: 50,  duration: 8  },
  { name: 'warning',  mean: 620,  std: 60,  duration: 10 },
  { name: 'critical', mean: 920,  std: 80,  duration: 10 },
  { name: 'warning',  mean: 700,  std: 55,  duration: 8  },
  { name: 'normal',   mean: 380,  std: 45,  duration: 8  },
];

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function gaussianRandom(mean, std) {
  // Box-Muller transform
  const u1 = 1 - Math.random();
  const u2 = 1 - Math.random();
  const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

// ── Seed history ─────────────────────────────────────────────────────────────

function buildSeedHistory() {
  const now    = Date.now();
  const points = [];
  let   cursor = now - SCENARIO_PHASES.reduce((acc, p) => acc + p.duration, 0) * SAMPLE_INTERVAL_MS;

  for (const phase of SCENARIO_PHASES) {
    for (let i = 0; i < phase.duration; i++) {
      const raw   = gaussianRandom(phase.mean, phase.std);
      const value = clamp(Math.round(raw), 0, 1023);
      const date  = new Date(cursor);
      points.push({ time: toIST(date), value });
      cursor += SAMPLE_INTERVAL_MS;
    }
  }
  return points;
}

function buildSeedIncidents(chartData) {
  const incidents = [];
  let   incidentId  = 1;
  let   inEvent     = false;
  let   eventStart  = null;
  let   eventPeak   = 0;
  let   eventLevel  = 'normal';
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
      if (value > eventPeak) eventPeak = value;
      if (level === 'critical') eventLevel = 'critical';

      const isLast       = i === chartData.length - 1;
      const nextIsNormal = !isLast && getSeverity(chartData[i + 1].value) === 'normal';

      if (nextIsNormal || isLast) {
        const durationSecs = ((i - eventStartIdx + 1) * SAMPLE_INTERVAL_MS / 1000).toFixed(0);
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
  const seedHistory               = buildSeedHistory();
  const [chartData, setChartData] = useState(seedHistory);
  const [currentValue, setCurrentValue] = useState(
    seedHistory[seedHistory.length - 1]?.value ?? 0
  );
  const [peakToday, setPeakToday]   = useState(
    Math.max(...seedHistory.map(d => d.value))
  );
  const [sampleCount, setSampleCount] = useState(seedHistory.length);
  const [incidents, setIncidents]     = useState(buildSeedIncidents(seedHistory));
  const [isOnline]                    = useState(true);

  // Track open incident across ticks
  const openIncidentRef = useRef(null);
  const phaseRef        = useRef({ phaseIndex: 0, stepInPhase: 0 });

  const tick = useCallback(() => {
    const { phaseIndex, stepInPhase } = phaseRef.current;
    const phase   = SCENARIO_PHASES[phaseIndex];
    const rawVal  = gaussianRandom(phase.mean, phase.std);
    const newVal  = clamp(Math.round(rawVal), 0, 1023);
    const newTime = toIST(new Date());
    const newLevel = getSeverity(newVal);

    // Advance phase
    const nextStep  = stepInPhase + 1;
    phaseRef.current = nextStep >= phase.duration
      ? { phaseIndex: (phaseIndex + 1) % SCENARIO_PHASES.length, stepInPhase: 0 }
      : { phaseIndex, stepInPhase: nextStep };

    setCurrentValue(newVal);
    setPeakToday(prev => Math.max(prev, newVal));
    setSampleCount(prev => prev + 1);

    setChartData(prev => {
      const next = [...prev, { time: newTime, value: newVal }];
      return next.length > MAX_CHART_POINTS ? next.slice(-MAX_CHART_POINTS) : next;
    });

    // Incident tracking
    if (newLevel !== 'normal') {
      if (!openIncidentRef.current) {
        // Open new incident
        openIncidentRef.current = {
          id:        Date.now(),
          timestamp: newTime,
          peakValue: newVal,
          severity:  newLevel,
          resolved:  false,
          duration:  '—',
        };
        setIncidents(prev => [openIncidentRef.current, ...prev]);
      } else {
        // Update the open incident
        const updated = {
          ...openIncidentRef.current,
          peakValue: Math.max(openIncidentRef.current.peakValue, newVal),
          severity:
            newLevel === 'critical' ? 'critical' : openIncidentRef.current.severity,
        };
        openIncidentRef.current = updated;
        setIncidents(prev =>
          prev.map(inc => (inc.id === updated.id ? updated : inc))
        );
      }
    } else if (openIncidentRef.current) {
      // Close incident
      const closed = { ...openIncidentRef.current, resolved: true, duration: `${Math.round(SAMPLE_INTERVAL_MS * 3 / 1000)} s` };
      openIncidentRef.current = null;
      setIncidents(prev =>
        prev.map(inc => (inc.id === closed.id ? closed : inc))
      );
    }
  }, []);

  useEffect(() => {
    const id = setInterval(tick, SAMPLE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [tick]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
      {/* ── Top header bar ─────────────────────────────── */}
      <Header isOnline={isOnline} />

      {/* ── Main content ───────────────────────────────── */}
      <main className="flex flex-col flex-1 gap-3 p-4 overflow-hidden">
        {/* Status banner — primary focal point */}
        <StatusBanner
          currentValue={currentValue}
          peakToday={peakToday}
          sampleCount={sampleCount}
          alertCount={incidents.filter(i => i.severity === 'critical').length}
        />

        {/* Lower section: chart + incident table */}
        <div className="flex flex-1 gap-3 min-h-0">
          {/* Trend chart — left 60% */}
          <div className="flex-[3] min-w-0">
            <TrendChart data={chartData} />
          </div>

          {/* Incident history — right 40% */}
          <div className="flex-[2] min-w-0">
            <IncidentHistory incidents={incidents} />
          </div>
        </div>
      </main>
    </div>
  );
}
