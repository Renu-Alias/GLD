import { useState, useEffect, useCallback, useRef } from 'react';
import Header from './components/Header';
import StatusBanner, { getSeverity } from './components/StatusBanner';
import TrendChart from './components/TrendChart';
import IncidentHistory from './components/IncidentHistory';

// ── Constants ────────────────────────────────────────────────────────────────

const SAMPLE_INTERVAL_MS = 2000;
const MAX_CHART_POINTS   = 40;

// ── IST helper ───────────────────────────────────────────────────────────────

function toIST(date) {
  return date.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

// ── Scenario phases ──────────────────────────────────────────────────────────
// Expanded to produce 10+ distinct incident events in the seed history.
// Each contiguous block of non-normal phases separated by a normal block
// becomes one incident entry.
const SCENARIO_PHASES = [
  // Session starts in normal
  { mean: 310, std: 35, duration: 6  },
  // Incident 1: warning spike
  { mean: 640, std: 55, duration: 7  },
  { mean: 380, std: 40, duration: 5  },
  // Incident 2: critical spike
  { mean: 890, std: 75, duration: 8  },
  { mean: 350, std: 35, duration: 4  },
  // Incident 3: warning
  { mean: 590, std: 50, duration: 6  },
  { mean: 300, std: 30, duration: 4  },
  // Incident 4: critical
  { mean: 950, std: 80, duration: 9  },
  { mean: 370, std: 40, duration: 5  },
  // Incident 5: warning
  { mean: 710, std: 60, duration: 6  },
  { mean: 330, std: 35, duration: 4  },
  // Incident 6: warning short
  { mean: 530, std: 45, duration: 5  },
  { mean: 290, std: 30, duration: 4  },
  // Incident 7: critical
  { mean: 870, std: 70, duration: 7  },
  { mean: 360, std: 35, duration: 4  },
  // Incident 8: warning
  { mean: 660, std: 55, duration: 6  },
  { mean: 320, std: 30, duration: 4  },
  // Incident 9: critical
  { mean: 920, std: 80, duration: 8  },
  { mean: 340, std: 35, duration: 4  },
  // Incident 10: warning (last seed block — stays active)
  { mean: 680, std: 55, duration: 5  },
  // Live phases continue cycling from here
  { mean: 380, std: 45, duration: 6  },
];

// ── Utilities ────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function gaussianRandom(mean, std) {
  const u1 = 1 - Math.random();
  const u2 = 1 - Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ── Seed builders ────────────────────────────────────────────────────────────

function buildSeedHistory() {
  const total  = SCENARIO_PHASES.reduce((a, p) => a + p.duration, 0);
  let   cursor = Date.now() - total * SAMPLE_INTERVAL_MS;
  const pts    = [];
  for (const phase of SCENARIO_PHASES) {
    for (let i = 0; i < phase.duration; i++) {
      const value = clamp(Math.round(gaussianRandom(phase.mean, phase.std)), 0, 1023);
      pts.push({ time: toIST(new Date(cursor)), value });
      cursor += SAMPLE_INTERVAL_MS;
    }
  }
  return pts;
}

function buildSeedIncidents(chartData) {
  const incidents     = [];
  let   id            = 1;
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
      if (value > eventPeak)    eventPeak = value;
      if (level === 'critical') eventLevel = 'critical';

      const isLast       = i === chartData.length - 1;
      const nextIsNormal = !isLast && getSeverity(chartData[i + 1].value) === 'normal';

      if (nextIsNormal || isLast) {
        const dur = (((i - eventStartIdx) + 1) * SAMPLE_INTERVAL_MS / 1000).toFixed(0);
        incidents.push({
          id:        id++,
          timestamp: eventStart,
          peakValue: eventPeak,
          severity:  eventLevel,
          duration:  `${dur} s`,
          resolved:  !isLast,
        });
        inEvent = false; eventStart = null;
        eventPeak = 0;   eventLevel = 'normal'; eventStartIdx = 0;
      }
    }
  }
  return incidents;
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  // All seed state initialised lazily — called once on mount only
  const [chartData,    setChartData]    = useState(() => buildSeedHistory().slice(-MAX_CHART_POINTS));
  const [currentValue, setCurrentValue] = useState(() => {
    const h = buildSeedHistory(); return h[h.length - 1]?.value ?? 0;
  });
  const [peakToday,    setPeakToday]    = useState(() => {
    const h = buildSeedHistory(); return Math.max(...h.map(d => d.value));
  });
  const [sampleCount,  setSampleCount]  = useState(() =>
    SCENARIO_PHASES.reduce((a, p) => a + p.duration, 0)
  );
  const [incidents,    setIncidents]    = useState(() => {
    const h = buildSeedHistory(); return buildSeedIncidents(h);
  });
  // Simulated latency (jitters slightly each tick to feel live)
  const [latencyMs, setLatencyMs] = useState(24);
  const [isOnline]                = useState(true);

  const openIncidentRef = useRef(null);
  const phaseRef        = useRef({ phaseIndex: SCENARIO_PHASES.length - 1, stepInPhase: 0 });

  const tick = useCallback(() => {
    const { phaseIndex, stepInPhase } = phaseRef.current;
    const phase    = SCENARIO_PHASES[phaseIndex];
    const newVal   = clamp(Math.round(gaussianRandom(phase.mean, phase.std)), 0, 1023);
    const newTime  = toIST(new Date());
    const newLevel = getSeverity(newVal);

    const nextStep = stepInPhase + 1;
    phaseRef.current = nextStep >= phase.duration
      ? { phaseIndex: (phaseIndex + 1) % SCENARIO_PHASES.length, stepInPhase: 0 }
      : { phaseIndex, stepInPhase: nextStep };

    setCurrentValue(newVal);
    setPeakToday(prev => Math.max(prev, newVal));
    setSampleCount(prev => prev + 1);
    // Jitter latency ±5 ms
    setLatencyMs(prev => Math.max(8, Math.min(80, prev + Math.round((Math.random() - 0.5) * 10))));

    setChartData(prev => {
      const next = [...prev, { time: newTime, value: newVal }];
      return next.length > MAX_CHART_POINTS ? next.slice(-MAX_CHART_POINTS) : next;
    });

    if (newLevel !== 'normal') {
      if (!openIncidentRef.current) {
        const newInc = { id: Date.now(), timestamp: newTime, peakValue: newVal, severity: newLevel, resolved: false, duration: '—' };
        openIncidentRef.current = newInc;
        setIncidents(prev => [newInc, ...prev]);
      } else {
        const updated = {
          ...openIncidentRef.current,
          peakValue: Math.max(openIncidentRef.current.peakValue, newVal),
          severity:  newLevel === 'critical' ? 'critical' : openIncidentRef.current.severity,
        };
        openIncidentRef.current = updated;
        const uid = updated.id;
        setIncidents(prev => prev.map(i => i.id === uid ? updated : i));
      }
    } else if (openIncidentRef.current) {
      const closed   = { ...openIncidentRef.current, resolved: true, duration: `${Math.round(SAMPLE_INTERVAL_MS * 3 / 1000)} s` };
      const closedId = closed.id;
      openIncidentRef.current = null;
      setIncidents(prev => prev.map(i => i.id === closedId ? closed : i));
    }
  }, []);

  useEffect(() => {
    const id = setInterval(tick, SAMPLE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [tick]);

  const criticalCount = incidents.filter(i => i.severity === 'critical').length;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100">
      <Header isOnline={isOnline} latencyMs={latencyMs} />

      <main className="flex flex-col flex-1 gap-2.5 p-3 overflow-hidden min-h-0">
        {/* Hero status banner */}
        <StatusBanner
          currentValue={currentValue}
          peakToday={peakToday}
          sampleCount={sampleCount}
          alertCount={criticalCount}
        />

        {/* Lower split: chart 7 : history 5 */}
        <div className="flex flex-1 gap-2.5 min-h-0">
          <div className="flex-[7] min-w-0">
            <TrendChart data={chartData} />
          </div>
          <div className="flex-[5] min-w-0">
            <IncidentHistory incidents={incidents} />
          </div>
        </div>
      </main>
    </div>
  );
}
