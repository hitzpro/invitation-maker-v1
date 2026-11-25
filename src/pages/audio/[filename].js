import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { invitationAssets, invitations } from '../../db/schema.js';
import { AUDIO_FILENAME_RE, getUploadDir } from '../../lib/upload.js';

const MIME = { mp3: 'audio/mpeg', m4a: 'audio/mp4', ogg: 'audio/ogg' };
const notFound = () => new Response('Not found', { status: 404 });

export async function GET({ params, locals, request }) {
  const { filename } = params;
  if (!AUDIO_FILENAME_RE.test(filename ?? '')) return notFound();

  const [row] = await db
    .select({ ownerId: invitations.userId, status: invitations.status, isDisabled: invitations.isDisabled })
    .from(invitationAssets)
    .innerJoin(invitations, eq(invitations.id, invitationAssets.invitationId))
    .where(eq(invitationAssets.filename, filename))
    .limit(1);
  if (!row) return notFound();

  const user = locals.user;
  const isPublic = row.status === 'published' && !row.isDisabled;
  if (!isPublic && !(user && (user.id === row.ownerId || user.role === 'admin'))) return notFound();

  const filePath = path.join(getUploadDir(), filename);
  let size;
  try {
    size = (await stat(filePath)).size;
  } catch {
    return notFound();
  }

  const headers = {
    'Content-Type': MIME[filename.split('.').pop()],
    'Accept-Ranges': 'bytes',
    'Cache-Control': isPublic ? 'public, max-age=86400' : 'private, no-cache',
    'X-Content-Type-Options': 'nosniff',
  };

  // Safari/iOS mewajibkan dukungan Range untuk memutar audio
  const range = request.headers.get('range');
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    let start;
    let end;
    if (m && (m[1] !== '' || m[2] !== '')) {
      if (m[1] === '') {
        start = Math.max(size - Number(m[2]), 0); // "bytes=-N": N byte terakhir
        end = size - 1;
      } else {
        start = Number(m[1]);
        end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
      }
    }
    if (start === undefined || start > end || start >= size) {
      return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
    }
    return new Response(Readable.toWeb(createReadStream(filePath, { start, end })), {
      status: 206,
      headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
    });
  }

  return new Response(Readable.toWeb(createReadStream(filePath)), {
    headers: { ...headers, 'Content-Length': String(size) },
  });
}