import Header from './components/Header';
import StatusBanner from './components/StatusBanner';
import TrendChart from './components/TrendChart';
import IncidentHistory from './components/IncidentHistory';
import FeedNotice from './components/FeedNotice';
import { useSensorFeed } from './hooks/useSensorFeed';

/**
 * The dashboard is a pure view over the sensor feed.
 *
 * There is no simulated data anywhere in this component: `currentValue`,
 * `history` and `incidents` are exactly what the ESP32 reported over USB serial,
 * relayed by the bridge in Dashboard/server. When the board is not connected the
 * screen says so instead of inventing numbers.
 */
export default function App() {
  const feed = useSensorFeed();
  const {
    bridge,
    bridgeError,
    link,
    isDemo,
    frameSource,
    serial,
    thresholds,
    sampleIntervalMs,
    latest,
    history,
    incidents,
    stats,
    device,
  } = feed;

  const currentValue = latest?.value ?? null;
  const criticalCount = incidents.filter((i) => i.severity === 'critical').length;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-100">
      <Header
        link={link}
        isDemo={isDemo}
        serialPath={serial?.path}
        lastReadingAt={stats.lastReadingAt}
        warmup={device.warmup}
      />

      <FeedNotice
        bridge={bridge}
        bridgeError={bridgeError}
        link={link}
        isDemo={isDemo}
        frameSource={frameSource}
        serialError={serial?.error}
        warmup={device.warmup}
      />

      <main className="flex flex-col flex-1 gap-2.5 p-3 overflow-hidden min-h-0">
        <StatusBanner
          currentValue={currentValue}
          peakValue={stats.peakValue}
          sampleCount={stats.sampleCount}
          alertCount={criticalCount}
          thresholds={thresholds}
          sampleIntervalMs={sampleIntervalMs}
          hasData={currentValue !== null}
          muted={device.muted}
          warmup={device.warmup}
        />

        <div className="flex flex-1 gap-2.5 min-h-0">
          <div className="flex-[7] min-w-0">
            <TrendChart data={history} thresholds={thresholds} sampleIntervalMs={sampleIntervalMs} />
          </div>
          <div className="flex-[5] min-w-0">
            <IncidentHistory incidents={incidents} />
          </div>
        </div>
      </main>
    </div>
  );
}