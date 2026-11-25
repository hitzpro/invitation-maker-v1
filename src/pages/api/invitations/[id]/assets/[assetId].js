import { and, eq } from 'drizzle-orm';
import { db } from '../../../../../db/index.js';
import { invitationAssets } from '../../../../../db/schema.js';
import { json, guardUser } from '../../../../../lib/guards.js';
import { getOwnedInvitation, isUuid } from '../../../../../lib/invitations.js';
import { removeFiles } from '../../../../../lib/upload.js';
import { removeAssetReferences } from '../../../../../lib/content.js';

export async function DELETE({ params, locals }) {
  const denied = guardUser(locals);
  if (denied) return denied;

  const inv = await getOwnedInvitation(params.id, locals.user.id);
  if (!inv || !isUuid(params.assetId)) return json(404, { error: 'Tidak ditemukan' });

  const [asset] = await db
    .delete(invitationAssets)
    .where(and(eq(invitationAssets.id, params.assetId), eq(invitationAssets.invitationId, inv.id)))
    .returning({ filename: invitationAssets.filename });

  if (!asset) return json(404, { error: 'Tidak ditemukan' });

  await removeFiles([asset.filename]);
  await removeAssetReferences(inv.id, params.assetId);
  return json(200, { ok: true });
}