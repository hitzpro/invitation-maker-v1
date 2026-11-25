import { and, eq } from 'drizzle-orm';
import { db } from '../../../../db/index.js';
import { invitations } from '../../../../db/schema.js';
import { getInvitationContent } from '../../../../lib/content.js';
import { eventInstantISO, sortedEvents } from '../../../../lib/render-data.js';
import { SLUG_RE } from '../../../../lib/slug.js';

const toIcsUtc = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const escIcs = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

export async function GET({ params, url }) {
  const slug = params.slug ?? '';
  if (!SLUG_RE.test(slug)) return new Response('Not found', { status: 404 });

  const [inv] = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.slug, slug), eq(invitations.status, 'published'), eq(invitations.isDisabled, false)))
    .limit(1);
  if (!inv) return new Response('Not found', { status: 404 });

  const content = await getInvitationContent(inv.id);
  const events = sortedEvents(content);
  const idx = Math.max(0, Number(url.searchParams.get('i')) || 0);
  const ev = events[idx];
  if (!ev) return new Response('Not found', { status: 404 });

  const tz = content.sections.event.timezone;
  const startIso = eventInstantISO(ev, tz);
  const endIso = ev.endTime
    ? eventInstantISO({ ...ev, startTime: ev.endTime }, tz)
    : new Date(new Date(startIso).getTime() + 2 * 60 * 60 * 1000).toISOString();

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Undangan Digital//ID',
    'BEGIN:VEVENT',
    `UID:${inv.id}-${idx}@undangan`,
    `DTSTAMP:${toIcsUtc(new Date().toISOString())}`,
    `DTSTART:${toIcsUtc(startIso)}`,
    `DTEND:${toIcsUtc(endIso)}`,
    `SUMMARY:${escIcs(`${inv.title} - ${ev.label}`)}`,
    `LOCATION:${escIcs([ev.venue, ev.address].filter(Boolean).join(', '))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${inv.slug}-${idx + 1}.ics"`,
    },
  });
}