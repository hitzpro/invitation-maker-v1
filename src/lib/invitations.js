import { and, asc, eq, like } from 'drizzle-orm';
import { db } from '../db/index.js';
import { invitations, invitationContents } from '../db/schema.js';
import { generateUniqueSlug } from './slug.js';
import { invitations, invitationContents, invitationAssets } from '../db/schema.js';
import { removeFiles } from './upload.js';

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

// Kode error PostgreSQL 23505 = unique_violation
export const isUniqueViolation = (err) => (err?.code ?? err?.cause?.code) === '23505';

// kind: 'image' (bawaan) | 'audio' | 'all'
export async function listAssets(invitationId, kind = 'image') {
  const filters = [eq(invitationAssets.invitationId, invitationId)];
  if (kind === 'image') filters.push(like(invitationAssets.mimeType, 'image/%'));
  if (kind === 'audio') filters.push(like(invitationAssets.mimeType, 'audio/%'));
  return db
    .select()
    .from(invitationAssets)
    .where(and(...filters))
    .orderBy(asc(invitationAssets.createdAt));
}