import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import sharp from 'sharp';
import { db } from '../../db/index.js';
import { invitationAssets, invitations } from '../../db/schema.js';
import { getInvitationContent } from '../../lib/content.js';
import { SLUG_RE } from '../../lib/slug.js';
import { getCacheDir, getUploadDir } from '../../lib/upload.js';

const notFound = () => new Response('Not found', { status: 404 });

export async function GET({ params }) {
  const slug = (params.slug ?? '').replace(/\.jpg$/, '');
  if (!SLUG_RE.test(slug)) return notFound();

  // Hanya undangan published dan tidak dinonaktifkan
  const [inv] = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.slug, slug), eq(invitations.status, 'published'), eq(invitations.isDisabled, false)))
    .limit(1);
  if (!inv) return notFound();

  const content = await getInvitationContent(inv.id);
  const coverId = content.sections.cover.imageId;
  if (!coverId) return notFound();

  const [asset] = await db
    .select({ filename: invitationAssets.filename })
    .from(invitationAssets)
    .where(and(eq(invitationAssets.id, coverId), eq(invitationAssets.invitationId, inv.id)))
    .limit(1);
  if (!asset) return notFound();

  const dir = path.join(getCacheDir(), 'og');
  const cached = path.join(dir, asset.filename.replace(/\.webp$/, '.jpg'));

  let data;
  try {
    data = await readFile(cached);
  } catch {
    let original;
    try {
      original = await readFile(path.join(getUploadDir(), asset.filename));
    } catch {
      return notFound();
    }
    data = await sharp(original)
      .resize(1200, 630, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();

    await mkdir(dir, { recursive: true });
    const tmp = `${cached}.${randomUUID()}.tmp`;
    await writeFile(tmp, data).then(() => rename(tmp, cached)).catch(() => {});
  }

  return new Response(data, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Length': String(data.length),
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}