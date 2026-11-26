import { and, asc, eq, like, ne } from 'drizzle-orm';
import { db } from '../db/index.js';
import { generateUniqueSlug } from './slug.js';
import { invitations, invitationContents, invitationAssets } from '../db/schema.js';
import { removeFiles, copyUploadFile } from './upload.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

const owned = (id, userId) => and(eq(invitations.id, id), eq(invitations.userId, userId));

export async function createInvitation(userId, { title, method }) {
  const slug = await generateUniqueSlug(title);
  return db.transaction(async (tx) => {
    const [inv] = await tx.insert(invitations).values({ userId, title, method, slug }).returning();
    await tx.insert(invitationContents).values({ invitationId: inv.id, content: {} });
    return inv;
  });
}

export async function getOwnedInvitation(id, userId) {
  if (!isUuid(id)) return null;
  const [inv] = await db.select().from(invitations).where(owned(id, userId)).limit(1);
  return inv ?? null;
}

export async function updateOwnedInvitation(id, userId, values) {
  if (!isUuid(id)) return null;
  const [inv] = await db.update(invitations).set(values).where(owned(id, userId)).returning();
  return inv ?? null;
}

export async function deleteOwnedInvitation(id, userId) {
  if (!isUuid(id)) return false;

  // Ambil nama file dulu (hanya untuk undangan milik user), sebelum baris cascade terhapus
  const assets = await db
    .select({ filename: invitationAssets.filename })
    .from(invitationAssets)
    .innerJoin(invitations, eq(invitations.id, invitationAssets.invitationId))
    .where(owned(id, userId));

  const rows = await db.delete(invitations).where(owned(id, userId)).returning({ id: invitations.id });
  if (rows.length === 0) return false;

  await removeFiles(assets.map((a) => a.filename));
  return true;
}

// Salin undangan beserta konten dan file asetnya ke draf baru
export async function duplicateOwnedInvitation(id, userId) {
  const orig = await getOwnedInvitation(id, userId);
  if (!orig) return null;

  const [origContent] = await db.select().from(invitationContents)
    .where(eq(invitationContents.invitationId, orig.id)).limit(1);
  const origAssets = await db.select().from(invitationAssets)
    .where(eq(invitationAssets.invitationId, orig.id));

  const newSlug = await generateUniqueSlug(`${orig.title} salinan`);

  // Salin file fisik dulu dengan nama baru agar penghapusan salah satu undangan tidak merusak yang lain
  const copiedFiles = [];
  try {
    const assetPairs = [];
    for (const a of origAssets) {
      const nextName = await copyUploadFile(a.filename);
      copiedFiles.push(nextName);
      assetPairs.push({ old: a, nextFilename: nextName });
    }

    return await db.transaction(async (tx) => {
      const [copy] = await tx.insert(invitations).values({
        userId,
        slug: newSlug,
        title: `${orig.title} (Salinan)`.slice(0, 120),
        method: orig.method,
        status: 'draft',
        templateKey: orig.templateKey,
      }).returning();

      let jsonText = JSON.stringify(origContent?.content ?? {});
      for (const { old, nextFilename } of assetPairs) {
        const [inserted] = await tx.insert(invitationAssets).values({
          invitationId: copy.id,
          filename: nextFilename,
          originalName: old.originalName,
          mimeType: old.mimeType,
          sizeBytes: old.sizeBytes,
          width: old.width,
          height: old.height,
          kind: old.kind,
        }).returning({ id: invitationAssets.id });
        jsonText = jsonText.replaceAll(old.id, inserted.id);
      }

      await tx.insert(invitationContents).values({
        invitationId: copy.id,
        content: JSON.parse(jsonText),
      });
      return copy;
    });
  } catch (err) {
    await removeFiles(copiedFiles);
    throw err;
  }
}

export async function deleteInvitationAsAdmin(id) {
  if (!isUuid(id)) return false;

  const assets = await db
    .select({ filename: invitationAssets.filename })
    .from(invitationAssets)
    .where(eq(invitationAssets.invitationId, id));

  const rows = await db.delete(invitations).where(eq(invitations.id, id)).returning({ id: invitations.id });
  if (rows.length === 0) return false;

  await removeFiles(assets.map((a) => a.filename));
  return true;
}

// Kode error PostgreSQL 23505 = unique_violation
export const isUniqueViolation = (err) => (err?.code ?? err?.cause?.code) === '23505';

// kind: 'image' (bawaan) | 'audio' | 'svg' | 'all'
export async function listAssets(invitationId, kind = 'image') {
  const filters = [eq(invitationAssets.invitationId, invitationId)];
  if (kind === 'image') {
    filters.push(like(invitationAssets.mimeType, 'image/%'), ne(invitationAssets.mimeType, 'image/svg+xml'));
  }
  if (kind === 'audio') filters.push(like(invitationAssets.mimeType, 'audio/%'));
  if (kind === 'svg') filters.push(eq(invitationAssets.mimeType, 'image/svg+xml'));
  return db
    .select()
    .from(invitationAssets)
    .where(and(...filters))
    .orderBy(asc(invitationAssets.createdAt));
}