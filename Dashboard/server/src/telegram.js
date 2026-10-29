const TIMEOUT_MS = 10000;

const LEVELS = {
  critical: { icon: '🚨', label: 'DANGER', advice: 'Leave the kitchen now. Close the cylinder regulator, open windows and doors, and do not touch any electrical switch or flame.' },
  warning: { icon: '⚠️', label: 'WARNING', advice: 'Gas is building up. Close the cylinder regulator, open windows and doors, and keep flames and switches off.' },
};
const FALLBACK = { icon: '⚠️', label: 'ALERT', advice: 'Check the kitchen and close the cylinder regulator.' };

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function formatLeakAlert({ severity, peakValue, at = new Date(), test = false }) {
  const level = LEVELS[String(severity).toLowerCase()] ?? FALLBACK;
  const when = at.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  });
  return [
    `${level.icon} <b>LPG LEAK: ${level.label}</b>${test ? '  <i>(test message)</i>' : ''}`,
    '',
    `Gas level: <b>${escapeHtml(peakValue)}</b> (sensor reading)`,
    `Time: ${escapeHtml(when)}`,
    '',
    escapeHtml(level.advice),
  ].join('\n');
}

/**
 * Push a leak alert to a Telegram chat. Resolves true only when Telegram
 * accepted the message; every failure is logged and returns false so a bad
 * network or token can never throw into the telemetry path.
 */
export async function sendLeakAlert({ severity, peakValue, test = false }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('[alert] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    return false;
  }

  const text = formatLeakAlert({ severity, peakValue, test });

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) {
      console.error(`[alert] Telegram rejected the message: ${res.status} ${body.description ?? ''}`.trim());
      return false;
    }
    console.log(`[alert] Sent Telegram alert to chat ${chatId} | message_id: ${body.result?.message_id}`);
    return true;
  } catch (err) {
    // err.message can carry the request URL, which contains the bot token.
    console.error('[alert] Failed to send Telegram alert:', String(err.message).replaceAll(token, '<token>'));
    return false;
  }
}
