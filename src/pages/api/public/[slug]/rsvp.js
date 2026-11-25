import { and, eq } from 'drizzle-orm';
import { db } from '../../../../db/index.js';
import { invitations, rsvps } from '../../../../db/schema.js';
import { json } from '../../../../lib/guards.js';
import { SLUG_RE } from '../../../../lib/slug.js';
import { clientIp, isRateLimited, rsvpSchema } from '../../../../lib/guest.js';

export async function POST({ params, request, clientAddress }) {
  const slug = params.slug ?? '';
  if (!SLUG_RE.test(slug)) return json(404, { error: 'Undangan tidak ditemukan' });

  const [inv] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(and(eq(invitations.slug, slug), eq(invitations.status, 'published'), eq(invitations.isDisabled, false)))
    .limit(1);
  if (!inv) return json(404, { error: 'Undangan tidak ditemukan' });

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'Permintaan tidak valid' });
  }

  const parsed = rsvpSchema.safeParse(body);
  if (!parsed.success) {
    return json(422, { error: parsed.error.issues[0].message });
  }

  // Honeypot terisi -> bot; balas sukses tanpa menyimpan
  if (parsed.data.website) return json(201, { ok: true });

  const ip = clientIp(request, clientAddress);
  if (isRateLimited(`rsvp:${slug}:${ip}`, 5, 10 * 60 * 1000)) {
    return json(429, { error: 'Terlalu banyak kiriman. Coba lagi beberapa menit lagi.' });
  }

  const { guestName, attendance, guestCount } = parsed.data;
  await db.insert(rsvps).values({
    invitationId: inv.id,
    guestName,
    attendance,
    guestCount: attendance === 'hadir' ? guestCount : 0,
  });

  return json(201, { ok: true });
}