/**
 * Decide whether a reading should trigger a Telegram alert.
 *
 * One alert when an incident opens, and one more when that same incident
 * escalates from warning to critical. `prev` is the severity seen on the
 * previous reading (null when no incident was open). After a server restart
 * mid-leak `prev` is null, so a resumed incident does not re-alert.
 *
 * @returns {{ send: boolean, last: string|null }} `last` is the value to pass
 *   back in as `prev` on the next reading.
 */
export function nextAlert(prev, { event, incident }) {
  if (event === 'incident-close' || !incident) return { send: false, last: null };

  const severity = incident.severity;
  if (event === 'incident-open') return { send: true, last: severity };
  if (prev === 'warning' && severity === 'critical') return { send: true, last: severity };
  return { send: false, last: severity };
}
