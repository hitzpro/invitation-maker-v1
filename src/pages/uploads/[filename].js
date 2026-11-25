import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { db } from '../../db/index.js';
import { invitationAssets, invitations } from '../../db/schema.js';
import { FILENAME_RE, getCacheDir, getUploadDir } from '../../lib/upload.js';

const WIDTHS = new Set([480, 1200]); // daftar putih: mencegah pembuatan varian sembarang

// Alasan hanya ditampilkan di mode dev
const notFound = (reason) =>
  new Response(import.meta.env.DEV ? `Not found (${reason})` : 'Not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });

async function resizedVariant(filename, width) {
  const dir = path.join(getCacheDir(), 'img');
  const cached = path.join(dir, `${filename.replace(/\.webp$/, '')}-${width}.webp`);

  try {
    return await readFile(cached);
  } catch {
    // belum ada di cache: buat
  }

  const original = await readFile(path.join(getUploadDir(), filename));
  const data = await sharp(original).resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();

  // tulis ke file sementara lalu rename, supaya request lain tidak pernah membaca file setengah jadi
  await mkdir(dir, { recursive: true });
  const tmp = `${cached}.${randomUUID()}.tmp`;
  await writeFile(tmp, data).then(() => rename(tmp, cached)).catch(() => {});
  return data;
}

export async function GET({ params, locals, url }) {
  const { filename } = params;
  if (!FILENAME_RE.test(filename ?? '')) return notFound('nama file tidak valid');

  const [row] = await db
    .select({
      ownerId: invitations.userId,
      status: invitations.status,
      isDisabled: invitations.isDisabled,
    })
    .from(invitationAssets)
    .innerJoin(invitations, eq(invitations.id, invitationAssets.invitationId))
    .where(eq(invitationAssets.filename, filename))
    .limit(1);

  if (!row) return notFound('tidak ada di database');

  const user = locals.user;
  const isPublic = row.status === 'published' && !row.isDisabled;
  const canView = isPublic || (user && (user.id === row.ownerId || user.role === 'admin'));
  if (!canView) return notFound(user ? 'akun ini bukan pemilik' : 'belum login / sesi tidak terbaca');

  const width = Number(url.searchParams.get('w'));
  let data;
  try {
    data = WIDTHS.has(width)
      ? await resizedVariant(filename, width)
      : await readFile(path.join(getUploadDir(), filename));
  } catch {
    return notFound('file tidak ada di disk');
  }

  return new Response(data, {
    headers: {
      'Content-Type': 'image/webp',
      'Content-Length': String(data.length),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': isPublic ? 'public, max-age=86400' : 'private, no-cache',
    },
  });
}