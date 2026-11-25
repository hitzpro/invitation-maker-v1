import { randomBytes } from 'node:crypto';
import { and, eq, ne } from 'drizzle-orm';
import { db } from '../db/index.js';
import { invitations } from '../db/schema.js';

export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'dashboard', 'login', 'logout', 'register', 'setup', 'og',
  '403', '404', 'uploads', '_astro', 'assets', 'static', 'public',
  'favicon.ico', 'robots.txt', 'sitemap.xml','audio', 'healthz',
]);

// huruf kecil/angka, dipisah tanda hubung tunggal
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '');
}

// Mengembalikan pesan error, atau null kalau valid
export function validateSlug(slug) {
  if (slug.length < 3) return 'URL minimal 3 karakter';
  if (slug.length > 50) return 'URL maksimal 50 karakter';
  if (!SLUG_RE.test(slug)) {
    return 'Hanya huruf kecil, angka, dan tanda hubung (tidak boleh diawali, diakhiri, atau berurutan)';
  }
  if (RESERVED_SLUGS.has(slug)) return 'URL ini dipakai sistem, pilih yang lain';
  return null;
}

export async function isSlugTaken(slug, exceptId = null) {
  const where = exceptId
    ? and(eq(invitations.slug, slug), ne(invitations.id, exceptId))
    : eq(invitations.slug, slug);
  const [row] = await db.select({ id: invitations.id }).from(invitations).where(where).limit(1);
  return Boolean(row);
}

export async function generateUniqueSlug(title) {
  let base = slugify(title) || 'undangan';
  if (base.length < 3 || RESERVED_SLUGS.has(base)) base = `${base}-undangan`;

  if (!(await isSlugTaken(base))) return base;

  for (let i = 0; i < 5; i++) {
    const candidate = `${base}-${randomBytes(2).toString('hex')}`;
    if (!(await isSlugTaken(candidate))) return candidate;
  }
  throw new Error('Gagal membuat slug unik');
}