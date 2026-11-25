import { and, count, eq, like } from 'drizzle-orm';
import { db } from '../../../../db/index.js';
import { invitationAssets } from '../../../../db/schema.js';
import { json, guardUser } from '../../../../lib/guards.js';
import { getOwnedInvitation } from '../../../../lib/invitations.js';
import {
  MAX_AUDIO_PER_INVITATION, UploadError, getMaxAudioBytes, processAudioUpload, removeFiles,
} from '../../../../lib/upload.js';

export async function POST({ params, locals, request }) {
  const denied = guardUser(locals);
  if (denied) return denied;

  const inv = await getOwnedInvitation(params.id, locals.user.id);
  if (!inv) return json(404, { error: 'Undangan tidak ditemukan' });

  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > getMaxAudioBytes() + 1024 * 1024) return json(413, { error: 'Ukuran file terlalu besar' });

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(invitationAssets)
    .where(and(eq(invitationAssets.invitationId, inv.id), like(invitationAssets.mimeType, 'audio/%')));
  if (total >= MAX_AUDIO_PER_INVITATION) {
    return json(409, { error: `Maksimal ${MAX_AUDIO_PER_INVITATION} lagu per undangan` });
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json(400, { error: 'Permintaan tidak valid' });
  }

  const file = form.get('file');
  let meta;
  try {
    meta = await processAudioUpload(file);
  } catch (err) {
    if (err instanceof UploadError) return json(err.status, { error: err.message });
    console.error(err);
    return json(500, { error: 'Terjadi kesalahan server' });
  }

  try {
    const [asset] = await db
      .insert(invitationAssets)
      .values({
        invitationId: inv.id,
        filename: meta.filename,
        originalName: file.name.slice(0, 200),
        mimeType: meta.mimeType,
        sizeBytes: meta.sizeBytes,
      })
      .returning();
    return json(201, { id: asset.id, url: `/audio/${asset.filename}`, name: asset.originalName });
  } catch (err) {
    await removeFiles([meta.filename]);
    console.error(err);
    return json(500, { error: 'Gagal menyimpan data lagu' });
  }
}