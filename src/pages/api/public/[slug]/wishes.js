import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../../../db/index.js';
import { guestMessages, invitations } from '../../../../db/schema.js';
import { json } from '../../../../lib/guards.js';
import { SLUG_RE } from '../../../../lib/slug.js';
import { clientIp, isRateLimited, wishSchema } from '../../../../lib/guest.js';

async function findPublished(slug) {
  if (!SLUG_RE.test(slug)) return null;
  const [inv] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(and(eq(invitations.slug, slug), eq(invitations.status, 'published'), eq(invitations.isDisabled, false)))
    .limit(1);
  return inv ?? null;
}

export async function GET({ params, url }) {
  const inv = await findPublished(params.slug ?? '');
  if (!inv) return json(404, { error: 'Undangan tidak ditemukan' });

  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 20));

  const items = await db
    .select({
      id: guestMessages.id,
      guestName: guestMessages.guestName,
      message: guestMessages.message,
      createdAt: guestMessages.createdAt,
    })
    .from(guestMessages)
    .where(eq(guestMessages.invitationId, inv.id))
    .orderBy(desc(guestMessages.createdAt))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = items.length > limit;
  return json(200, { items: items.slice(0, limit), hasMore });
}

export async function POST({ params, request, clientAddress }) {
  const slug = params.slug ?? '';
  const inv = await findPublished(slug);
  if (!inv) return json(404, { error: 'Undangan tidak ditemukan' });

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Permintaan tidak valid' });
  }

  const parsed = wishSchema.safeParse(body);
  if (!parsed.success) {
    return json(422, { error: parsed.error.issues[0].message });
  }

  // Honeypot terisi -> bot; balas sukses palsu tanpa menyimpan
  if (parsed.data.website) {
    return json(201, {
      item: { guestName: parsed.data.guestName, message: parsed.data.message, createdAt: new Date().toISOString() },
    });
  }

  const ip = clientIp(request, clientAddress);
  if (isRateLimited(`wish:${slug}:${ip}`, 5, 10 * 60 * 1000)) {
    return json(429, { error: 'Terlalu banyak kiriman. Coba lagi beberapa menit lagi.' });
  }

  const [saved] = await db
    .insert(guestMessages)
    .values({
      invitationId: inv.id,
      guestName: parsed.data.guestName,
      message: parsed.data.message,
    })
    .returning({
      id: guestMessages.id,
      guestName: guestMessages.guestName,
      message: guestMessages.message,
      createdAt: guestMessages.createdAt,
    });

  return json(201, { item: saved });
}