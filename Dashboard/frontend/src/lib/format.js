export const TIME_ZONE = 'Asia/Kolkata';

export function formatTime(epochMs) {
  if (epochMs == null) return '--:--:--';
  return new Date(epochMs).toLocaleTimeString('en-IN', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function formatDate(epochMs) {
  if (epochMs == null) return '';
  return new Date(epochMs).toLocaleDateString('en-IN', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Elapsed time as the incident table shows it: "820 ms", "12.4 s", "3 m 07 s". */
export function formatDuration(ms) {
  if (ms == null) return '--';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  const totalSeconds = Math.round(ms / 1000);
  return `${Math.floor(totalSeconds / 60)} m ${String(totalSeconds % 60).padStart(2, '0')} s`;
}

/** "just now" / "3 s ago" / "2 m 14 s ago", for the last-update indicator. */
export function formatAge(ms) {
  if (ms == null) return 'never';
  if (ms < 1500) return 'just now';
  return `${formatDuration(ms)} ago`;
}

/** Sample interval in the firmware's own units -> human cadence for a label. */
export function formatSampleInterval(sampleMs) {
  if (!sampleMs) return null;
  if (sampleMs < 1000) return `${sampleMs} ms`;
  const seconds = sampleMs / 1000;
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)} s`;
}