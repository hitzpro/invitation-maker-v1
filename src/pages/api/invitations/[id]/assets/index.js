import { count, eq } from 'drizzle-orm';
import { db } from '../../../../../db/index.js';
import { invitationAssets } from '../../../../../db/schema.js';
import { json, guardUser } from '../../../../../lib/guards.js';
import { getOwnedInvitation } from '../../../../../lib/invitations.js';
import {
  MAX_ASSETS_PER_INVITATION, UploadError, getMaxUploadBytes, processImageUpload, removeFiles,
} from '../../../../../lib/upload.js';

export async function POST({ params, locals, request }) {
  const denied = guardUser(locals);
  if (denied) return denied;

  const inv = await getOwnedInvitation(params.id, locals.user.id);
  if (!inv) return json(404, { error: 'Undangan tidak ditemukan' });

  // Tolak lebih awal sebelum body dibaca ke memori
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > getMaxUploadBytes() + 1024 * 1024) {
    return json(413, { error: 'Ukuran file terlalu besar' });
  }

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(invitationAssets)
    .where(eq(invitationAssets.invitationId, inv.id));
  if (total >= MAX_ASSETS_PER_INVITATION) {
    return json(409, { error: `Maksimal ${MAX_ASSETS_PER_INVITATION} gambar per undangan` });
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
    meta = await processImageUpload(file);
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
        width: meta.width,
        height: meta.height,
      })
      .returning();
    return json(201, { id: asset.id, url: `/uploads/${asset.filename}` });
  } catch (err) {
    await removeFiles([meta.filename]); // jangan tinggalkan file yatim
    console.error(err);
    return json(500, { error: 'Gagal menyimpan data gambar' });
  }
}