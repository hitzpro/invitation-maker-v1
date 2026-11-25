import { desc, eq } from 'drizzle-orm';
import { db } from '../../../../db/index.js';
import { guestMessages, rsvps } from '../../../../db/schema.js';
import { guardUser, json } from '../../../../lib/guards.js';
import { getOwnedInvitation } from '../../../../lib/invitations.js';

// Cegah CSV formula injection di Excel/Sheets + escape tanda kutip
function csvCell(v) {
  const s = String(v ?? '').replace(/\r?\n/g, ' ');
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

const ATTENDANCE_LABEL = { hadir: 'Hadir', tidak_hadir: 'Tidak hadir', ragu: 'Ragu' };

export async function GET({ params, locals }) {
  const denied = guardUser(locals);
  if (denied) return denied;

  const inv = await getOwnedInvitation(params.id, locals.user.id);
  if (!inv) return json(404, { error: 'Undangan tidak ditemukan' });

  const [rsvpRows, wishRows] = await Promise.all([
    db.select().from(rsvps).where(eq(rsvps.invitationId, inv.id)).orderBy(desc(rsvps.createdAt)),
    db.select().from(guestMessages).where(eq(guestMessages.invitationId, inv.id)).orderBy(desc(guestMessages.createdAt)),
  ]);

  const fmt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
  const lines = [['Tipe', 'Nama Tamu', 'Kehadiran', 'Jumlah Tamu', 'Ucapan', 'Waktu'].map(csvCell).join(',')];

  for (const r of rsvpRows) {
    lines.push([
      'RSVP',
      r.guestName,
      ATTENDANCE_LABEL[r.attendance] ?? r.attendance,
      r.attendance === 'hadir' ? r.guestCount : 0,
      '',
      fmt.format(r.createdAt),
    ].map(csvCell).join(','));
  }

  for (const w of wishRows) {
    lines.push([
      'Ucapan',
      w.guestName,
      '',
      '',
      w.message,
      fmt.format(w.createdAt),
    ].map(csvCell).join(','));
  }

  // BOM UTF-8 agar karakter Indonesia terbaca benar di Excel
  const body = '\uFEFF' + lines.join('\r\n');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tamu-${inv.slug}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}