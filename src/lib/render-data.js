import { getInvitationContent, TIMEZONES, isRealDate } from './content.js';
import { listAssets } from './invitations.js';
import { readSvgAsset } from './upload.js';
import { desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { guestMessages } from '../db/schema.js';


const OFFSETS = { 'Asia/Jakarta': '+07:00', 'Asia/Makassar': '+08:00', 'Asia/Jayapura': '+09:00' };
const DEFAULT_COLOR = '#8b5e3c';

// Hanya hex 6 digit: mencegah penyisipan CSS lewat atribut style
export const safeColor = (c) => (/^#[0-9a-fA-F]{6}$/.test(c ?? '') ? c : DEFAULT_COLOR);

export async function getRenderData(invitationId) {
const [content, imageRows, audioRows, svgRows, wishRows] = await Promise.all([
    getInvitationContent(invitationId),
    listAssets(invitationId),
    listAssets(invitationId, 'audio'),
    listAssets(invitationId, 'svg'),
    db
      .select({
        id: guestMessages.id,
        guestName: guestMessages.guestName,
        message: guestMessages.message,
        createdAt: guestMessages.createdAt,
      })
      .from(guestMessages)
      .where(eq(guestMessages.invitationId, invitationId))
      .orderBy(desc(guestMessages.createdAt))
      .limit(21),
  ]);

  const images = new Map(
    imageRows.map((a) => {
      const url = `/uploads/${a.filename}`;
      return [a.id, { url, thumb: `${url}?w=480`, medium: `${url}?w=1200`, width: a.width, height: a.height }];
    })
  );
  // Lagu disimpan di peta yang sama; hanya diakses lewat content.music.assetId
  for (const a of audioRows) images.set(a.id, { url: `/audio/${a.filename}`, audio: true });

  // SVG ornamen dibaca aman dari disk
  await Promise.all(
    svgRows.map(async (a) => {
      const parsed = await readSvgAsset(a.filename);
      if (parsed) images.set(a.id, { svg: true, ...parsed });
    })
  );

  return {
    content,
    images,
    wishes: wishRows.slice(0, 20),
    hasMoreWishes: wishRows.length > 20,
  };
}

// Section tampil jika enabled DAN datanya ada
const HAS_DATA = {
  cover: () => true,
  couple: (c) => Boolean(c.sections.couple.bride.name && c.sections.couple.groom.name),
  event: (c) => sortedEvents(c).length > 0,
  countdown: (c) => sortedEvents(c).length > 0,
  story: (c) => c.sections.story.items.length > 0,
  gallery: (c, images) => c.sections.gallery.imageIds.some((id) => images.has(id)),
  location: (c) => Boolean(c.sections.location.venueName),
  rsvp: () => true,
  wishes: () => true,
  closing: () => true,
  gift: (c, images) =>
    c.sections.gift.accounts.some((a) => a.bank.trim() && a.number.trim()) ||
    images.has(c.sections.gift.qrisImageId),
};

export function visibleSections(content, images) {
  return content.sectionOrder.filter(
    (key) => content.sections[key].enabled && HAS_DATA[key](content, images)
  );
}

// Hanya acara dengan tanggal valid yang bisa ditampilkan
export function sortedEvents(content) {
  return content.sections.event.items
    .filter((item) => isRealDate(item.date))
    .sort((a, b) =>
      `${a.date}T${a.startTime || '00:00'}`.localeCompare(`${b.date}T${b.startTime || '00:00'}`)
    );
}

// Tanggal disimpan apa adanya (tanpa zona), jadi diformat di UTC agar tidak bergeser
export function formatDate(dateStr) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeZone: 'UTC' }).format(
    new Date(`${dateStr}T12:00:00Z`)
  );
}

export function formatTime(item, timezone) {
  if (!item.startTime) return '';
  const range = item.endTime ? `${item.startTime} – ${item.endTime}` : item.startTime;
  return `${range} ${TIMEZONES[timezone] ?? ''}`.trim();
}


export function eventInstantISO(item, timezone) {
  return `${item.date}T${item.startTime || '00:00'}:00${OFFSETS[timezone] ?? '+07:00'}`;
}

export const SECTION_LABELS = {
  cover: 'Cover', couple: 'Mempelai', event: 'Acara', countdown: 'Countdown',
  story: 'Kisah Kami', gallery: 'Galeri', location: 'Lokasi',
  rsvp: 'RSVP', wishes: 'Ucapan', closing: 'Penutup', gift: 'Amplop Digital',
};

// Nama tamu dari ?to=... (di-escape otomatis oleh Astro saat dirender)
export function guestNameFrom(url) {
  return (url.searchParams.get('to') ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
}

// Daftar kekurangan yang menghalangi publikasi (kosong = layak publish)
export function publishProblems(content) {
  const problems = [];
  const { bride, groom } = content.sections.couple;
  if (!bride.name || !groom.name) problems.push('data mempelai belum lengkap');
  if (sortedEvents(content).length === 0) problems.push('belum ada acara dengan tanggal yang valid');
  return problems;
}

// Metadata untuk pratinjau tautan (WhatsApp, Telegram, dan sejenisnya)
export function buildShareMeta(inv, content, images, baseUrl) {
  const { couple, cover } = content.sections;
  const hasNames = couple.bride.name && couple.groom.name;
  const first = sortedEvents(content)[0];

  const details = [];
  if (first) details.push(formatDate(first.date));
  if (first?.venue) details.push(first.venue);

  return {
    title: hasNames ? `Undangan Pernikahan ${couple.bride.name} & ${couple.groom.name}` : inv.title,
    description: ['Kami mengundang Anda ke pernikahan kami', ...details].join(' · '),
    url: `${baseUrl}/${inv.slug}`,
    image: images.has(cover.imageId) ? `${baseUrl}/og/${inv.slug}.jpg` : null,
  };
}

// Pola/animasi aktif bila fitur menyala secara global DAN (berlaku untuk semua section ATAU dicentang di section itu)
export const patternOn = (theme, style) =>
  theme.pattern.kind !== 'none' && (theme.pattern.all || Boolean(style?.pattern));

export const animateOn = (theme, style) =>
  Boolean(theme.animation.enabled) && (theme.animation.all || Boolean(style?.animate));

const FONT_PREFIX = { title: 't', heading: 'h', body: 'b' };

// Atribut data-* untuk font per peran. Font "script" tidak mendukung tebal/miring.
export function fontAttrs(fonts) {
  const attrs = {};
  for (const [role, p] of Object.entries(FONT_PREFIX)) {
    const f = fonts?.[role];
    if (!f) continue;
    if (f.family === 'sans' || f.family === 'script') attrs[`data-${p}-font`] = f.family;
    if (f.family !== 'script') {
      if (f.bold) attrs[`data-${p}-bold`] = '';
      if (f.italic) attrs[`data-${p}-italic`] = '';
    }
  }
  return attrs;
}