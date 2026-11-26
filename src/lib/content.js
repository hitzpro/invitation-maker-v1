import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { invitations, invitationContents } from '../db/schema.js';
export const PATTERN_KINDS = ['none', 'floral', 'leaf', 'kawung', 'dots', 'waves'];
export const SURFACES = ['plain', 'white', 'tint', 'solid', 'image'];

export const LAYOUTS = ['centered', 'split'];
export const FRAMES = ['circle', 'rounded', 'arch', 'oval', 'hexagon', 'heart'];
export const GALLERY_LAYOUTS = ['grid', 'carousel', 'masonry', 'mosaic'];
export const TIMELINE_STYLES = ['line', 'alternate', 'cards', 'minimal'];

export const FONT_FAMILIES = ['default', 'sans', 'script'];
export const ORNAMENT_KINDS = ['flower', 'branch', 'corner', 'divider', 'sparkle', 'custom'];
export const ORNAMENT_POSITIONS = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];
export const ORNAMENT_SIZES = ['sm', 'md', 'lg'];

const FONT_ROLES = ['title', 'heading', 'body'];
const defaultFont = () => ({ family: 'default', bold: false, italic: false });
const defaultFonts = () => Object.fromEntries(FONT_ROLES.map((r) => [r, defaultFont()]));

// ---------- Kontrak ----------
export const SECTION_ORDER = [
  'cover', 'couple', 'event', 'countdown', 'story',
  'gallery', 'location', 'gift', 'rsvp', 'wishes', 'closing',
];
export const TIMEZONES = { 'Asia/Jakarta': 'WIB', 'Asia/Makassar': 'WITA', 'Asia/Jayapura': 'WIT' };
export const EVENT_SLOTS = [
  { key: 'akad', label: 'Akad Nikah' },
  { key: 'resepsi', label: 'Resepsi' },
];
export const STORY_SLOTS = 3;

export const PHOTO_ROLES = [
  { value: '', label: 'Tidak dipakai' },
  { value: 'cover', label: 'Cover' },
  { value: 'bride', label: 'Foto mempelai wanita' },
  { value: 'groom', label: 'Foto mempelai pria' },
  { value: 'gallery', label: 'Galeri' },
];

const emptyPerson = () => ({ name: '', fullName: '', parents: '', photoId: null, photoPos: { x: 50, y: 50 } });

const defaultStyle = (overrides = {}) => ({
  surface: 'plain',
  pattern: false,
  animate: false,
  bg: { imageId: null, opacity: 100, overlay: 40 },
  ...overrides,
});

export function defaultContent() {
  const content = {
    version: 1,
    theme: {
      primaryColor: '#8b7561',
      pattern: { kind: 'none', opacity: 15, all: true },
      animation: { enabled: false, all: true },
    },
    sectionOrder: [...SECTION_ORDER],
    sections: {
      cover: {
        enabled: true, heading: 'The Wedding Of', imageId: null,
        extraImageIds: [], slideshow: { interval: 5, zoom: true },
        style: { layout: 'centered' },
      },
      couple: {
        enabled: true, intro: '', bride: emptyPerson(), groom: emptyPerson(),
        style: defaultStyle({ layout: 'centered', frame: 'circle' }),
      },
      event: { enabled: true, timezone: 'Asia/Jakarta', items: [], style: defaultStyle({ layout: 'centered' }) },
      countdown: { enabled: true, style: defaultStyle({ surface: 'solid', layout: 'centered' }) },
      story: { enabled: true, items: [], style: defaultStyle({ timeline: 'line' }) },
      gallery: { enabled: true, imageIds: [], style: defaultStyle({ layout: 'grid' }) },
      location: {
        enabled: true, venueName: '', address: '', mapsUrl: '',
        style: defaultStyle({ layout: 'centered' }),
      },
      gift: {
        enabled: true,
        intro: 'Doa restu Anda merupakan karunia yang sangat berarti bagi kami. Jika ingin memberi tanda kasih, dapat melalui rekening berikut:',
        qrisImageId: null,
        accounts: [],
        style: defaultStyle({ layout: 'centered' }),
      },
      rsvp: { enabled: true, style: defaultStyle({ surface: 'white' }) },
      wishes: { enabled: true, style: defaultStyle() },
      closing: { enabled: true, message: '', style: defaultStyle({ layout: 'centered' }) },
    },
  };

  content.decorations = [];
  content.music = { assetId: null, autoplay: false, loop: true, volume: 70 };
  for (const section of Object.values(content.sections)) section.fonts = defaultFonts();
  return content;
}

const asObject = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

function mergeFonts(base, own) {
  const src = asObject(own);
  return Object.fromEntries(FONT_ROLES.map((r) => [r, { ...base[r], ...asObject(src[r]) }]));
}

// Menggabungkan data dari database dengan default, supaya field yang hilang tidak merusak renderer
export function normalizeContent(raw) {
  const base = defaultContent();
  const src = asObject(raw);
  const srcSections = asObject(src.sections);

  const sections = {};
  for (const key of SECTION_ORDER) {
    const own = asObject(srcSections[key]);
    sections[key] = { ...base.sections[key], ...own };
    if (base.sections[key].style) {
      sections[key].style = { ...base.sections[key].style, ...asObject(own.style) };
    }
    sections[key].fonts = mergeFonts(base.sections[key].fonts, own.fonts);
  }
  for (const who of ['bride', 'groom']) {
    const rawPerson = asObject(asObject(srcSections.couple)[who]);
    sections.couple[who] = {
      ...emptyPerson(),
      ...rawPerson,
      photoPos: { x: 50, y: 50, ...asObject(rawPerson.photoPos) },
    };
  }

  const srcTheme = asObject(src.theme);
  const theme = {
    ...base.theme,
    ...srcTheme,
    pattern: { ...base.theme.pattern, ...asObject(srcTheme.pattern) },
    animation: { ...base.theme.animation, ...asObject(srcTheme.animation) },
  };

  const order = src.sectionOrder;
  const validOrder = Array.isArray(order) && order.every((k) => SECTION_ORDER.includes(k));
  const mergedOrder = validOrder ? [...new Set([...order, ...SECTION_ORDER])] : base.sectionOrder;

  return {
    version: 1,
    theme,
    sectionOrder: mergedOrder,
    sections,
    decorations: Array.isArray(src.decorations)
      ? src.decorations.map((d) => ({ assetId: null, ...asObject(d) }))
      : [],
    music: { ...base.music, ...asObject(src.music) },
  };
}

// ---------- Akses database ----------
export async function getInvitationContent(invitationId) {
  const [row] = await db
    .select()
    .from(invitationContents)
    .where(eq(invitationContents.invitationId, invitationId))
    .limit(1);
  return normalizeContent(row?.content);
}

// Baca-ubah-tulis dalam satu transaksi dengan row lock (aman bila dua tab menyimpan bersamaan)
export async function updateInvitationContent(invitationId, updater) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(invitationContents)
      .where(eq(invitationContents.invitationId, invitationId))
      .for('update');

    const next = updater(normalizeContent(row?.content));

    if (row) {
      await tx.update(invitationContents).set({ content: next }).where(eq(invitationContents.id, row.id));
    } else {
      await tx.insert(invitationContents).values({ invitationId, content: next });
    }
    await tx.update(invitations).set({ updatedAt: new Date() }).where(eq(invitations.id, invitationId));
    return next;
  });
}

// ---------- Validasi ----------
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const req = (label, max) =>
  z.string().trim().min(1, `${label} wajib diisi`).max(max, `Maksimal ${max} karakter`);
const opt = (max) => z.string().trim().max(max, `Maksimal ${max} karakter`);

const personSchema = z.object({
  name: req('Nama panggilan', 40),
  fullName: req('Nama lengkap', 100),
  parents: opt(200),
});

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isRealDate(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
}

function zodErrors(issues) {
  const errors = {};
  for (const issue of issues) errors[issue.path.join('_')] ??= issue.message;
  return errors;
}

function validateCouple(raw) {
  const parsed = z
    .object({ intro: opt(500), bride: personSchema, groom: personSchema })
    .safeParse({
      intro: str(raw.intro),
      bride: { name: str(raw.bride_name), fullName: str(raw.bride_fullName), parents: str(raw.bride_parents) },
      groom: { name: str(raw.groom_name), fullName: str(raw.groom_fullName), parents: str(raw.groom_parents) },
    });
  return parsed.success ? { data: parsed.data } : { errors: zodErrors(parsed.error.issues) };
}

function validateEvent(raw) {
  const errors = {};
  const items = [];

  const timezone = str(raw.timezone);
  if (!Object.hasOwn(TIMEZONES, timezone)) errors.timezone = 'Pilih zona waktu';

  for (const slot of EVENT_SLOTS) {
    const f = {
      date: str(raw[`${slot.key}_date`]),
      startTime: str(raw[`${slot.key}_startTime`]),
      endTime: str(raw[`${slot.key}_endTime`]),
      venue: str(raw[`${slot.key}_venue`]),
      address: str(raw[`${slot.key}_address`]),
    };
    if (!Object.values(f).some(Boolean)) continue; // slot kosong dilewati

    const err = (field, msg) => (errors[`${slot.key}_${field}`] ??= msg);

    if (!f.date) err('date', 'Tanggal wajib diisi');
    else if (!isRealDate(f.date)) err('date', 'Tanggal tidak valid');

    if (!f.startTime) err('startTime', 'Jam mulai wajib diisi');
    else if (!TIME_RE.test(f.startTime)) err('startTime', 'Jam tidak valid');

    if (f.endTime) {
      if (!TIME_RE.test(f.endTime)) err('endTime', 'Jam tidak valid');
      else if (TIME_RE.test(f.startTime) && f.endTime <= f.startTime) {
        err('endTime', 'Jam selesai harus setelah jam mulai');
      }
    }

    if (!f.venue) err('venue', 'Nama tempat wajib diisi');
    else if (f.venue.length > 120) err('venue', 'Maksimal 120 karakter');
    if (f.address.length > 300) err('address', 'Maksimal 300 karakter');

    items.push({ key: slot.key, label: slot.label, ...f });
  }

  if (items.length === 0 && Object.keys(errors).length === 0) {
    errors._form = 'Isi minimal satu acara (Akad Nikah atau Resepsi)';
  }

  // Hanya http(s): mencegah javascript: di atribut href
  const mapsUrl = str(raw.mapsUrl);
  if (mapsUrl && (mapsUrl.length > 500 || !/^https?:\/\//i.test(mapsUrl) || !URL.canParse(mapsUrl))) {
    errors.mapsUrl = 'Masukkan tautan yang valid, diawali http:// atau https://';
  }

  return Object.keys(errors).length ? { errors } : { data: { timezone, items, mapsUrl } };
}

function validateStory(raw) {
  const errors = {};
  const items = [];

  for (let i = 1; i <= STORY_SLOTS; i++) {
    const title = str(raw[`story${i}_title`]);
    const date = str(raw[`story${i}_date`]);
    const text = str(raw[`story${i}_text`]);
    if (!title && !date && !text) continue;

    if (!title) errors[`story${i}_title`] = 'Judul wajib diisi';
    else if (title.length > 80) errors[`story${i}_title`] = 'Maksimal 80 karakter';
    if (date.length > 40) errors[`story${i}_date`] = 'Maksimal 40 karakter';
    if (!text) errors[`story${i}_text`] = 'Cerita wajib diisi';
    else if (text.length > 600) errors[`story${i}_text`] = 'Maksimal 600 karakter';

    items.push({ title, date, text });
  }

  const closing = str(raw.closing);
  if (closing.length > 600) errors.closing = 'Maksimal 600 karakter';

  return Object.keys(errors).length ? { errors } : { data: { items, closing } };
}

function validatePhotos(raw, assetIds) {
  const errors = {};
  const data = { coverId: null, brideId: null, groomId: null, galleryIds: [] };
  const single = { cover: 'coverId', bride: 'brideId', groom: 'groomId' };

  for (const id of assetIds) {
    const role = str(raw[`role_${id}`]);
    if (role === '') continue;

    if (role === 'gallery') {
      data.galleryIds.push(id);
    } else if (!Object.hasOwn(single, role)) {
      errors[`role_${id}`] = 'Pilihan tidak valid';
    } else if (data[single[role]]) {
      const label = PHOTO_ROLES.find((r) => r.value === role).label;
      errors[`role_${id}`] = `${label} sudah dipakai gambar lain`;
    } else {
      data[single[role]] = id;
    }
  }

  return Object.keys(errors).length ? { errors } : { data };
}


// Mengembalikan { data } atau { errors }
export function validateStep(stepKey, raw, ctx = {}) {
  if (stepKey === 'couple') return validateCouple(raw);
  if (stepKey === 'event') return validateEvent(raw);
  if (stepKey === 'story') return validateStory(raw);
  if (stepKey === 'photos') return validatePhotos(raw, ctx.assetIds ?? []);
  return { errors: { _form: 'Langkah tidak dikenal' } };
}

// ---------- Konversi form <-> konten ----------
export function applyStep(stepKey, content, data) {
  const s = structuredClone(content);

  if (stepKey === 'couple') {
    const c = s.sections.couple;
    c.intro = data.intro;
    c.bride = { ...c.bride, ...data.bride };
    c.groom = { ...c.groom, ...data.groom };
  }

  if (stepKey === 'event') {
    s.sections.event.timezone = data.timezone;
    s.sections.event.items = data.items;
    const first = data.items[0];
    s.sections.location = {
      ...s.sections.location,
      venueName: first.venue,
      address: first.address,
      mapsUrl: data.mapsUrl,
    };
  }

  if (stepKey === 'story') {
    s.sections.story.items = data.items;
    s.sections.closing.message = data.closing;
  }

  if (stepKey === 'photos') {
    s.sections.cover.imageId = data.coverId;
    s.sections.couple.bride.photoId = data.brideId;
    s.sections.couple.groom.photoId = data.groomId;
    s.sections.gallery.imageIds = data.galleryIds;
  }

  return s;
}

export function toFormValues(stepKey, content) {
  const s = content.sections;

  if (stepKey === 'couple') {
    const { bride, groom } = s.couple;
    return {
      intro: s.couple.intro,
      bride_name: bride.name, bride_fullName: bride.fullName, bride_parents: bride.parents,
      groom_name: groom.name, groom_fullName: groom.fullName, groom_parents: groom.parents,
    };
  }

  if (stepKey === 'event') {
    const v = { timezone: s.event.timezone, mapsUrl: s.location.mapsUrl };
    for (const slot of EVENT_SLOTS) {
      const item = s.event.items.find((i) => i.key === slot.key);
      v[`${slot.key}_date`] = item?.date ?? '';
      v[`${slot.key}_startTime`] = item?.startTime ?? '';
      v[`${slot.key}_endTime`] = item?.endTime ?? '';
      v[`${slot.key}_venue`] = item?.venue ?? '';
      v[`${slot.key}_address`] = item?.address ?? '';
    }
    return v;
  }

  if (stepKey === 'story') {
    const v = { closing: s.closing.message };
    for (let i = 1; i <= STORY_SLOTS; i++) {
      const item = s.story.items[i - 1];
      v[`story${i}_title`] = item?.title ?? '';
      v[`story${i}_date`] = item?.date ?? '';
      v[`story${i}_text`] = item?.text ?? '';
    }
    return v;
  }

  if (stepKey === 'photos') {
    const v = {};
    if (s.cover.imageId) v[`role_${s.cover.imageId}`] = 'cover';
    if (s.couple.bride.photoId) v[`role_${s.couple.bride.photoId}`] = 'bride';
    if (s.couple.groom.photoId) v[`role_${s.couple.groom.photoId}`] = 'groom';
    for (const id of s.gallery.imageIds) v[`role_${id}`] = 'gallery';
    return v;
  }

  return {};
}

// Dipanggil saat sebuah gambar dihapus: bersihkan referensinya agar tidak ada ID yatim
export function removeAssetReferences(invitationId, assetId) {
  return updateInvitationContent(invitationId, (c) => {
    const s = c.sections;
    if (s.cover.imageId === assetId) s.cover.imageId = null;
    if (s.couple.bride.photoId === assetId) s.couple.bride.photoId = null;
    if (s.couple.groom.photoId === assetId) s.couple.groom.photoId = null;
    if (s.gift?.qrisImageId === assetId) s.gift.qrisImageId = null;
    s.gallery.imageIds = s.gallery.imageIds.filter((id) => id !== assetId);
    if (c.music.assetId === assetId) c.music.assetId = null;
    
    s.cover.extraImageIds = s.cover.extraImageIds.filter((id) => id !== assetId);
    for (const sec of Object.values(s)) {
      if (sec.style?.bg?.imageId === assetId) sec.style.bg.imageId = null;
    }

    c.decorations = c.decorations.filter((d) => d.assetId !== assetId);
    return c;
  });
}

// ---------- Versi dan penggantian penuh (dipakai editor manual) ----------
export class VersionConflictError extends Error {
  constructor(content, version) {
    super('Konten telah berubah di tempat lain');
    this.content = content;
    this.version = version;
  }
}

export async function getContentWithVersion(invitationId) {
  const [row] = await db
    .select()
    .from(invitationContents)
    .where(eq(invitationContents.invitationId, invitationId))
    .limit(1);
  return {
    content: normalizeContent(row?.content),
    version: row?.updatedAt?.toISOString() ?? null,
  };
}

// Mengganti seluruh konten. Gagal (VersionConflictError) bila versi di database sudah berbeda.
export async function replaceInvitationContent(invitationId, nextContent, expectedVersion) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(invitationContents)
      .where(eq(invitationContents.invitationId, invitationId))
      .for('update');

    const currentVersion = row?.updatedAt?.toISOString() ?? null;
    if (row && expectedVersion !== currentVersion) {
      throw new VersionConflictError(normalizeContent(row.content), currentVersion);
    }

    const normalized = normalizeContent(nextContent);
    let saved;
    if (row) {
      [saved] = await tx
        .update(invitationContents)
        .set({ content: normalized })
        .where(eq(invitationContents.id, row.id))
        .returning({ updatedAt: invitationContents.updatedAt });
    } else {
      [saved] = await tx
        .insert(invitationContents)
        .values({ invitationId, content: normalized })
        .returning({ updatedAt: invitationContents.updatedAt });
    }

    await tx.update(invitations).set({ updatedAt: new Date() }).where(eq(invitations.id, invitationId));
    return { content: normalized, version: saved.updatedAt.toISOString() };
  });
}