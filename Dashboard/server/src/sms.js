import twilio from 'twilio';

let client = null;

function getClient() {
  if (client) return client;
  
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_SECRET;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  // Prefer API Key auth (recommended)
  if (sid && apiKeySid && apiKeySecret) {
    client = twilio(apiKeySid, apiKeySecret, { accountSid: sid });
    console.log('[sms] Using Twilio API Key authentication');
    return client;
  }

  // Fallback to Auth Token auth
  if (sid && authToken) {
    client = twilio(sid, authToken);
    console.log('[sms] Using Twilio Auth Token authentication');
    return client;
  }

  console.warn('[sms] Twilio not configured. Need either (TWILIO_ACCOUNT_SID + TWILIO_API_KEY_SID + TWILIO_API_SECRET) or (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN)');
  return null;
}

export async function sendLeakSms({ severity, peakValue }) {
  try {
    const client = getClient();
    if (!client) return false;

    const from = process.env.TWILIO_FROM_NUMBER;
    const to = process.env.SMS_TO_NUMBER;

    if (!from || !to) {
      console.warn('[sms] Missing TWILIO_FROM_NUMBER or SMS_TO_NUMBER');
      return false;
    }

    const body = `GAS LEAK ALERT!\nSeverity: ${severity.toUpperCase()}\nPeak ADC: ${peakValue}\nCheck the dashboard immediately.`;

    const msg = await client.messages.create({
      body,
      from,
      to,
    });

    console.log(`[sms] Sent SMS to ${to} | SID: ${msg.sid}`);
    return true;
  } catch (err) {
    console.error('[sms] Failed to send SMS:', err.message);
    return false;
  }
}

// Initialize on startup to verify configuration
try {
  getClient();
} catch (e) {
  console.warn('[sms] init error:', e.message);
}
