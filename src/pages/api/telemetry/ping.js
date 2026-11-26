import { clientIp, isRateLimited } from '../../../lib/guest.js';
import { recordTelemetryPing, telemetryPingSchema } from '../../../lib/telemetry.js';

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });

export async function POST({ request, clientAddress }) {
  const ip = clientIp(request, clientAddress);
  if (isRateLimited(`telemetry:${ip}`, 30, 60 * 60 * 1000)) {
    return json(429, { error: 'Terlalu banyak permintaan telemetri.' });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Payload JSON tidak valid.' });
  }

  const parsed = telemetryPingSchema.safeParse(body);
  if (!parsed.success) {
    return json(400, { error: 'Data telemetri tidak valid.' });
  }

  await recordTelemetryPing(parsed.data);
  return json(200, { ok: true });
}
