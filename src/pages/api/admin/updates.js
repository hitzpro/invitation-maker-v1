import { isDemoMode } from '../../../lib/demo.js';
import { applyUpdateSync, checkForUpdates } from '../../../lib/updater.js';

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });

function hasValidOrigin(request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (origin && host) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return request.headers.get('x-requested-with') === 'fetch';
}

export async function GET({ locals }) {
  if (isDemoMode()) {
    return json(403, { error: 'Fitur sinkronisasi hanya aktif pada instalasi lokal.' });
  }
  if (!locals.user || locals.user.role !== 'admin') {
    return json(403, { error: 'Hanya administrator yang dapat memeriksa pembaruan.' });
  }

  const result = await checkForUpdates();
  return json(result.ok ? 200 : 502, result);
}

export async function POST({ locals, request }) {
  if (isDemoMode()) {
    return json(403, { error: 'Fitur sinkronisasi hanya aktif pada instalasi lokal.' });
  }
  if (!locals.user || locals.user.role !== 'admin') {
    return json(403, { error: 'Hanya administrator yang dapat melakukan sinkronisasi update.' });
  }
  if (!hasValidOrigin(request)) {
    return json(403, { error: 'Permintaan tidak valid (origin tidak cocok).' });
  }

  const result = await applyUpdateSync();
  return json(result.ok ? 200 : 409, result);
}
