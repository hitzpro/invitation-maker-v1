import { json, guardUser } from '../../../../lib/guards.js';
import { getOwnedInvitation, listAssets } from '../../../../lib/invitations.js';
import {
  VersionConflictError, getContentWithVersion, replaceInvitationContent,
} from '../../../../lib/content.js';
import { validateContent } from '../../../../lib/content-schema.js';

const MAX_BODY_BYTES = 200 * 1024;

export async function GET({ params, locals }) {
  const denied = guardUser(locals);
  if (denied) return denied;

  const inv = await getOwnedInvitation(params.id, locals.user.id);
  if (!inv) return json(404, { error: 'Undangan tidak ditemukan' });

  return json(200, await getContentWithVersion(inv.id));
}

export async function PUT({ params, locals, request }) {
  const denied = guardUser(locals);
  if (denied) return denied;

  const inv = await getOwnedInvitation(params.id, locals.user.id);
  if (!inv) return json(404, { error: 'Undangan tidak ditemukan' });
  if (inv.method !== 'manual') {
    return json(400, { error: 'Undangan ini dibuat dengan formulir otomatis dan tidak memakai editor' });
  }

  // Tolak body besar sebelum dibaca ke memori
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY_BYTES) return json(413, { error: 'Data terlalu besar' });

  let body;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return json(400, { error: 'Permintaan tidak valid' });
  }
  if (!body || typeof body !== 'object' || typeof body.content !== 'object') {
    return json(400, { error: 'Permintaan tidak valid' });
  }
  const expectedVersion = typeof body.version === 'string' ? body.version : null;

  const assetIds = (await listAssets(inv.id)).map((a) => a.id);
  const audioIds = (await listAssets(inv.id, 'audio')).map((a) => a.id);
  const svgIds = (await listAssets(inv.id, 'svg')).map((a) => a.id);
  const result = validateContent(body.content, { assetIds, audioIds, svgIds });
  if (result.errors) return json(422, { error: 'Validasi gagal', errors: result.errors });

  try {
    const { version } = await replaceInvitationContent(inv.id, result.data, expectedVersion);
    return json(200, { version });
  } catch (err) {
    if (err instanceof VersionConflictError) {
      return json(409, { error: 'conflict', content: err.content, version: err.version });
    }
    console.error(err);
    return json(500, { error: 'Terjadi kesalahan server' });
  }
}