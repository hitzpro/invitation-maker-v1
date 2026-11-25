import { z } from 'zod';

// Peta penyimpan timestamp request per kunci ("aksi:slug:ip")
const hits = new Map();

// Batas laju: maksimal `max` kiriman per `windowMs`
export function isRateLimited(key, max = 5, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);

  // Bersihkan entri kedaluwarsa sesekali agar memori tidak menumpuk
  if (hits.size > 2000) {
    for (const [k, times] of hits) {
      const alive = times.filter((t) => now - t < windowMs);
      if (alive.length) hits.set(k, alive);
      else hits.delete(k);
    }
  }
  return false;
}

export function clientIp(request, clientAddress) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || clientAddress || 'unknown';
}

export const rsvpSchema = z.object({
  guestName: z.string().trim().min(2, 'Nama minimal 2 karakter').max(60, 'Nama maksimal 60 karakter'),
  attendance: z.enum(['hadir', 'tidak_hadir', 'ragu'], { message: 'Pilih status kehadiran' }),
  guestCount: z.coerce.number().int().min(1, 'Minimal 1 tamu').max(10, 'Maksimal 10 tamu'),
  website: z.string().optional(), // honeypot
});

export const wishSchema = z.object({
  guestName: z.string().trim().min(2, 'Nama minimal 2 karakter').max(60, 'Nama maksimal 60 karakter'),
  message: z.string().trim().min(3, 'Ucapan minimal 3 karakter').max(500, 'Ucapan maksimal 500 karakter'),
  website: z.string().optional(), // honeypot
});