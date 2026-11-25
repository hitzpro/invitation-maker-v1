import { z } from 'zod';
import {
  SECTION_ORDER, TIMEZONES, TIME_RE, PATTERN_KINDS, SURFACES,
  LAYOUTS, FRAMES, GALLERY_LAYOUTS, TIMELINE_STYLES, isRealDate,
  FONT_FAMILIES, ORNAMENT_KINDS, ORNAMENT_POSITIONS, ORNAMENT_SIZES,
} from './content.js';


const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Isian kosong diperbolehkan (draf); format tetap dijaga
const text = (max) => z.string().trim().max(max, `Maksimal ${max} karakter`);
const assetId = z.string().regex(UUID_RE, 'ID gambar tidak valid');
const nullableAssetId = assetId.nullable();
const enabled = z.boolean();

const dateField = z.string().refine((v) => v === '' || isRealDate(v), 'Tanggal tidak valid');
const timeField = z.string().refine((v) => v === '' || TIME_RE.test(v), 'Jam tidak valid');

// Hanya http(s): mencegah javascript: di atribut href
const urlField = z
  .string()
  .trim()
  .max(500, 'Maksimal 500 karakter')
  .refine(
    (v) => v === '' || (/^https?:\/\//i.test(v) && URL.canParse(v)),
    'Tautan harus diawali http:// atau https://'
  );

const person = z.object({
  name: text(40),
  fullName: text(100),
  parents: text(200),
  photoId: nullableAssetId,
});

const eventItem = z.object({
  key: text(30),
  label: text(60),
  date: dateField,
  startTime: timeField,
  endTime: timeField,
  venue: text(120),
  address: text(300),
});

const storyItem = z.object({
  title: text(80),
  date: text(40),
  text: text(600),
});

export const MAX_EVENTS = 6;
export const MAX_STORIES = 10;
export const MAX_GALLERY = 30;

// Rasio kontras terhadap putih (WCAG). Warna utama dipakai sebagai latar teks putih.
function contrastWithWhite(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (luminance + 0.05);
}

const styleSchema = z.object({
  surface: z.enum(SURFACES),
  pattern: z.boolean(),
  animate: z.boolean(),
  bg: z.object({
    imageId: nullableAssetId,
    opacity: z.number().int().min(10).max(100),
    overlay: z.number().int().min(0).max(80),
  }),
});

export const MAX_DECORATIONS = 20;

const fontSpec = z.object({ family: z.enum(FONT_FAMILIES), bold: z.boolean(), italic: z.boolean() });
const fontsSchema = z.object({ title: fontSpec, heading: fontSpec, body: fontSpec });
const section = (shape) => z.object({ enabled, fonts: fontsSchema, ...shape });

const decorationSchema = z.object({
  kind: z.enum(ORNAMENT_KINDS),
  section: z.enum(SECTION_ORDER),
  position: z.enum(ORNAMENT_POSITIONS),
  size: z.enum(ORNAMENT_SIZES),
  flip: z.boolean(),
});

export const contentSchema = z.object({
  version: z.literal(1),
  theme: z.object({
    primaryColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Warna harus berformat #RRGGBB')
      .refine(
        (v) => !/^#[0-9a-fA-F]{6}$/.test(v) || contrastWithWhite(v) >= 3,
        'Warna terlalu terang, teks putih di atasnya akan sulit dibaca. Pilih warna yang lebih gelap.'
      ),
    pattern: z.object({
      kind: z.enum(PATTERN_KINDS),
      opacity: z.number().int().min(5, 'Minimal 5').max(40, 'Maksimal 40'),
      all: z.boolean(),
    }),
    animation: z.object({ enabled: z.boolean(), all: z.boolean() }),
  }),
  sectionOrder: z
    .array(z.enum(SECTION_ORDER))
    .length(SECTION_ORDER.length, 'Urutan section tidak valid')
    .refine((order) => new Set(order).size === order.length, 'Urutan section tidak valid')
    .refine((order) => order[0] === 'cover', 'Cover harus berada di urutan pertama'),
  sections: z.object({
    cover: section({
      heading: text(60),
      imageId: nullableAssetId,
      extraImageIds: z.array(assetId).max(7, 'Maksimal 7 foto tambahan'),
      slideshow: z.object({ interval: z.number().int().min(3).max(15), zoom: z.boolean() }),
      style: z.object({ layout: z.enum(LAYOUTS) }),
    }),
    couple: section({
      intro: text(500),
      bride: person,
      groom: person,
      style: styleSchema.extend({ layout: z.enum(LAYOUTS), frame: z.enum(FRAMES) }),
    }),
    event: section({
      timezone: z.enum(Object.keys(TIMEZONES)),
      items: z.array(eventItem).max(MAX_EVENTS, `Maksimal ${MAX_EVENTS} acara`),
      style: styleSchema.extend({ layout: z.enum(LAYOUTS) }),
    }),
    countdown: section({ style: styleSchema.extend({ layout: z.enum(LAYOUTS) }) }),
    story: section({
      items: z.array(storyItem).max(MAX_STORIES, `Maksimal ${MAX_STORIES} cerita`),
      style: styleSchema.extend({ timeline: z.enum(TIMELINE_STYLES) }),
    }),
    gallery: section({
      imageIds: z.array(assetId).max(MAX_GALLERY, `Maksimal ${MAX_GALLERY} foto`),
      style: styleSchema.extend({ layout: z.enum(GALLERY_LAYOUTS) }),
    }),
    location: section({
      venueName: text(120),
      address: text(300),
      mapsUrl: urlField,
      style: styleSchema.extend({ layout: z.enum(LAYOUTS) }),
    }),
    rsvp: section({ style: styleSchema }),
    wishes: section({ style: styleSchema }),
    closing: section({
      message: text(600),
      style: styleSchema.extend({ layout: z.enum(LAYOUTS) }),
    }),
  }),
  decorations: z.array(decorationSchema).max(MAX_DECORATIONS, `Maksimal ${MAX_DECORATIONS} hiasan`),
  music: z.object({
    assetId: nullableAssetId,
    autoplay: z.boolean(),
    loop: z.boolean(),
    volume: z.number().int().min(0).max(100),
  }),
});

function collect(issues) {
  const errors = {};
  for (const issue of issues) errors[issue.path.join('.')] ??= issue.message;
  return errors;
}

// Mengembalikan { data } atau { errors } (kunci error berupa path, misalnya "sections.event.items.0.date").
// assetIds = daftar gambar milik undangan; referensi di luar daftar ini ditolak.
export function validateContent(raw, { assetIds = [], audioIds = [] } = {}) {
  const parsed = contentSchema.safeParse(raw);
  if (!parsed.success) return { errors: collect(parsed.error.issues) };

  const content = parsed.data;
  const allowed = new Set(assetIds);
  const errors = {};
  const check = (path, id) => {
    if (id && !allowed.has(id)) errors[path] = 'Gambar tidak ditemukan di undangan ini';
  };

  const s = content.sections;
  check('sections.cover.imageId', s.cover.imageId);
  check('sections.couple.bride.photoId', s.couple.bride.photoId);
  check('sections.couple.groom.photoId', s.couple.groom.photoId);

  s.cover.extraImageIds.forEach((id, i) => check(`sections.cover.extraImageIds.${i}`, id));
  for (const [key, sec] of Object.entries(s)) {
    if (sec.style?.bg?.imageId) check(`sections.${key}.style.bg.imageId`, sec.style.bg.imageId);
  }

  s.gallery.imageIds.forEach((id, i) => check(`sections.gallery.imageIds.${i}`, id));
  if (new Set(s.gallery.imageIds).size !== s.gallery.imageIds.length) {
    errors['sections.gallery.imageIds'] = 'Ada foto yang terpilih lebih dari sekali';
  }

  if (content.music.assetId && !audioIds.includes(content.music.assetId)) {
    errors['music.assetId'] = 'Lagu tidak ditemukan di undangan ini';
  }

  return Object.keys(errors).length ? { errors } : { data: content };
}